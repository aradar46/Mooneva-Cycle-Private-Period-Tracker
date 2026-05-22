import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../services/i18n';
import { Cycle } from '../types';
import { useCalendarSystem } from '../hooks/useCalendarSystem';
import { getTodayStr } from '../utils/dateUtils';

interface TimelineViewProps {
  cycles: Cycle[];
  predictions: { nextPeriodStart: string | null; fertileWindow: { start: string; end: string } | null };
  // No unused props
}

const TimelineView: React.FC<TimelineViewProps> = ({ cycles, predictions }) => {
  const { t, i18n } = useTranslation();
  const [showAll, setShowAll] = React.useState(false);
  const calendarSystem = useCalendarSystem();

  // Format dates: "Jan 30 - Feb 2" or "Bahman 10 - 15"
  const formatPeriodRange = (startDateStr: string, length: number) => {
    // 1. Get Gregorian Start Date
    const start = new Date(startDateStr);

    // 2. Get Gregorian End Date
    const end = new Date(startDateStr);
    end.setDate(end.getDate() + length - 1);

    // 3. Convert both to Target Calendar System
    const startParts = calendarSystem.toCalendarDate(start);
    const endParts = calendarSystem.toCalendarDate(end);

    // 4. Format Month Names
    // We can't use standard toLocaleDateString easily for Jalali month names unless we have the Polyfill, 
    // but our hook provides `formatMonthYear`. We just need the Month Name.
    // Let's extract month name from the hook's logic or add a helper. 
    // Since formatMonthYear returns "Month Year", we can split it or just add a helper to hook.
    // actually, let's just use the month index from startParts to get name if it's Jalali.

    // Helper to get month name
    const getMonthName = (year: number, month: number) => {
      // This is a bit hacky, relying on the formatMonthYear implementation
      const full = calendarSystem.formatMonthYear(year, month);
      return full.split(' ')[0]; // "Bahman 1403" -> "Bahman"
    };

    const startMonth = getMonthName(startParts.year, startParts.month);
    const endMonth = getMonthName(endParts.year, endParts.month);

    if (startParts.month === endParts.month) {
      return `${startMonth} ${formatNumber(startParts.day)} – ${formatNumber(endParts.day)}`;
    }
    return `${startMonth} ${formatNumber(startParts.day)} – ${endMonth} ${formatNumber(endParts.day)}`;
  };

  // Filter cycles to only show completed/started in the past
  const todayStr = getTodayStr();
  const historyCycles = cycles
    .filter(c => c.startDate <= todayStr)
    .slice()
    .reverse();

  const displayedHistory = showAll ? historyCycles : historyCycles.slice(0, 6);

  return (
    <div className="flex flex-col">
      <div className="mt-0">

        {/* New History Visualization */}
        {historyCycles.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm font-medium">
            {t('timeline.no_cycles')}
          </div>
        ) : (
          <div className="px-1 mt-8 scroll-mt-4">
            <div
              className="bg-[#F0F2F5] rounded-[32px] p-6"
              style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 pt-[9px]">{t('common.history')}</span>
                <div className="h-px flex-1 bg-slate-200"></div>
              </div>

              <div className="flex flex-col gap-8">
                {displayedHistory.map((cycle, idx) => {
                  const cycleLenForCalc = cycle.length || 28;
                  const periodLen = cycle.periodLength || 5;
                  const spanLen = cycle.spanDays || periodLen; // Full span for date display
                  const isGap = cycle.isOutlier === true;
                  const isShort = cycleLenForCalc < 18;
                  const isInvalid = isGap || isShort;

                  // Calculate percentages for bar segments using span for width
                  const periodWidth = Math.min(100, (spanLen / cycleLenForCalc) * 100);

                  // Fertile Window (hidden for gap/short cycles – tracking gap, not used for predictions)
                  const fertileStartDay = Math.max(0, cycleLenForCalc - 19);
                  const fertileEndDay = Math.max(0, cycleLenForCalc - 13);
                  const fertileDuration = Math.max(0, fertileEndDay - fertileStartDay);
                  const fertileLeft = (fertileStartDay / cycleLenForCalc) * 100;
                  const fertileWidth = (fertileDuration / cycleLenForCalc) * 100;
                  const showFertile = !isInvalid && fertileWidth > 0;

                  return (
                    <div key={`${cycle.startDate}-${idx}`} className="flex flex-col">
                      <div className="flex justify-between items-end mb-[2px]">
                        <span className="text-[11px] font-semibold text-black uppercase tracking-wide">
                          {formatPeriodRange(cycle.startDate, spanLen)}
                        </span>
                        {cycle.length != null && (
                          <span
                            className={`text-xs font-bold tabular-nums ${isInvalid ? 'text-slate-400' : 'text-primary'}`}
                            title={isGap
                              ? t('timeline.gap_hint')
                              : isShort
                                ? t('timeline.short_cycle_hint')
                                : undefined
                            }
                          >
                            {isInvalid && <span className="mr-0.5" aria-hidden="true">⚠</span>}
                            {formatNumber(cycle.length)}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar Container - Neumorphic Inset */}
                      <div
                        className="relative w-full h-4 bg-[#e4e7eb] rounded-full overflow-hidden border border-white/50"
                        style={{ boxShadow: 'inset 2px 2px 5px rgba(163, 177, 198, 0.3), inset -2px -2px 5px rgba(255, 255, 255, 0.7)' }}
                      >

                        {/* Period Segment */}
                        <div
                          className="absolute top-0 left-0 h-full bg-cycle-period rounded-full flex items-center justify-center z-20 border-r border-white/20"
                          style={{
                            width: `${periodWidth}%`,
                            boxShadow: '2px 0 4px rgba(251, 113, 133, 0.3)'
                          }}
                        >
                          <span className="text-[9px] font-bold text-white drop-shadow-sm">{formatNumber(periodLen)}</span>
                        </div>

                        {/* Fertile Segment – hidden for gap cycles */}
                        {showFertile && (
                          <div
                            className="absolute top-0 h-full bg-teal-400/30 flex items-center justify-center z-10"
                            style={{ left: `${fertileLeft}%`, width: `${fertileWidth}%` }}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-white/60 shadow-sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!showAll && historyCycles.length > 6 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full mt-10 py-3 rounded-2xl border border-slate-200/50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all active:scale-95"
                >
                  {t('timeline.show_more_count', { count: historyCycles.length - 6 })}
                </button>
              )}
            </div>
          </div>
        )}
        {/* Extra spacer to ensure visibility above floating navbars */}
        <div className="h-12 w-full" />
      </div>
    </div>
  );
};

export default TimelineView;