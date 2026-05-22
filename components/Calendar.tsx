import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DailyLog, AppSettings, DayMeta } from '../types';
import { toLocalISOString } from '../utils/dateUtils';
import { formatNumber } from '../services/i18n';
import { CycleStatusData } from '../services/logic/status';
import { DayCell } from './calendar/DayCell';
import { useSwipe } from '../hooks/useSwipe';
import { useCalendarSystem } from '../hooks/useCalendarSystem';

interface CalendarProps {
  currentDate: Date;
  onDateClick: (dateStr: string) => void;
  selectedDate: string | null;
  cycleStatus: CycleStatusData;
  logs: Record<string, DailyLog>;
  getDayMeta: (dateStr: string) => DayMeta;
  settings: AppSettings;
  isCloaked: boolean;
  onBulkUpdate?: (updates: Record<string, DailyLog>) => void;
  onMonthChange: (newDate: Date) => void;
  onToggleBleedingDay?: (date: string) => void;
  onNextMonth?: () => void;
  onPrevMonth?: () => void;
  isEditMode?: boolean;
  onEditModeChange?: (isEdit: boolean) => void;
  onEditDone?: () => void;
  onEditCancel?: () => void;
  onStatusClick?: () => void;
  todayIsPeriod?: boolean;
}

const Calendar: React.FC<CalendarProps> = ({
  currentDate,
  onDateClick,
  selectedDate,
  cycleStatus,
  logs,
  getDayMeta,
  settings,
  isCloaked,
  onBulkUpdate,
  onMonthChange,
  onToggleBleedingDay,
  onNextMonth,
  onPrevMonth,
  isEditMode: controlledEditMode,
  onEditModeChange,
  onEditDone,
  onEditCancel,
  onStatusClick,
  todayIsPeriod
}) => {
  const { t, i18n } = useTranslation();
  const [showLegend, setShowLegend] = useState(false);
  const [localEditMode, setLocalEditMode] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const calendarSystem = useCalendarSystem();

  const isEditMode = controlledEditMode !== undefined ? controlledEditMode : localEditMode;
  const setIsEditMode = (val: boolean) => {
    if (onEditModeChange) onEditModeChange(val);
    else setLocalEditMode(val);
  };

  const handleDone = () => {
    if (onEditDone) onEditDone();
    else setIsEditMode(false);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2000);
  };

  // Convert "View Date" (Gregorian) to target system (e.g. 1403/11/01)
  const { days, year, month, isTodayMonth } = useMemo(() => {
    const displayDate = calendarSystem.toCalendarDate(currentDate);
    const { year, month } = displayDate;
    const days = calendarSystem.getMonthGrid(year, month);

    const todayParts = calendarSystem.today();
    const isTodayMonth = month === todayParts.month && year === todayParts.year;

    return { days, year, month, isTodayMonth };
  }, [currentDate, calendarSystem]);

  const swipeOptions = useMemo(() => ({
    onSwipeLeft: onNextMonth || (() => { }),
    onSwipeRight: onPrevMonth || (() => { }),
    threshold: 50
  }), [onNextMonth, onPrevMonth]);

  const swipeHandlers = useSwipe(swipeOptions);

  return (
    <div className="space-y-4">
      {!isCloaked && (
        <header className="w-full px-0">
          <div
            onClick={onStatusClick}
            className={`relative z-10 bg-[#F0F2F5] rounded-[32px] py-5 px-4 sm:py-8 sm:px-4 flex flex-col items-center text-center overflow-hidden transition-transform active:scale-[0.98] ${onStatusClick ? 'cursor-pointer' : ''}`}
            style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
          >
            <div className="flex flex-col items-center z-10 w-full px-2">
              <h1 className={`text-[clamp(18px,6vw,42px)] ${i18n.language === 'fa' ? 'font-bold' : 'font-extrabold'} text-slate-800 leading-none tracking-tight text-center px-1 whitespace-nowrap w-full overflow-visible`}>
                {cycleStatus.dayOfCycle != null && cycleStatus.cycleLength != null ? (
                  <>
                    {cycleStatus.title}
                    <span className="text-[#7598a0] font-normal">/{cycleStatus.cycleLength}</span>
                  </>
                ) : cycleStatus.title}
              </h1>
              <div className="flex flex-col items-center mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
                {cycleStatus.dayOfPeriod != null && cycleStatus.periodLength != null ? (
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] flex-shrink-0"></span>
                    <p className="text-rose-500 font-bold text-[clamp(10px,3vw,14px)] tracking-widest uppercase">
                      {t('calendar.period_progress')} {formatNumber(cycleStatus.dayOfPeriod)} / {formatNumber(cycleStatus.periodLength)}
                    </p>
                  </div>
                ) : cycleStatus.subtitle && (
                  <p className={`font-bold text-[clamp(10px,3vw,14px)] tracking-widest uppercase whitespace-nowrap ${cycleStatus.statusVariant === 'primary' ? 'text-cycle-period' :
                    cycleStatus.statusVariant === 'warning' ? 'text-warning' :
                      cycleStatus.statusVariant === 'success' ? 'text-success' :
                        cycleStatus.statusVariant === 'info' ? 'text-slate-600' :
                          cycleStatus.statusVariant === 'secondary' ? 'text-slate-600' :
                            'text-slate-400'
                    }`}>
                    {cycleStatus.subtitle}
                  </p>
                )}
                {cycleStatus.chance && (
                  <p className={`text-[clamp(9px,2.5vw,11px)] font-bold tracking-[0.3em] uppercase whitespace-nowrap ${cycleStatus.chanceVariant === 'peak' ? 'text-success animate-pulse' :
                    cycleStatus.chanceVariant === 'high' ? 'text-success' :
                      'text-slate-400'
                    }`}>
                    {t('calendar.fertility_label')}: {cycleStatus.chance}
                  </p>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {!isCloaked && cycleStatus.statusVariant === 'neutral' && (
        <div className="flex items-center justify-center gap-1.5 px-4 -mt-1 mb-1">
          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <p className="text-[10px] text-slate-400 font-medium text-center">
            {t('calendar.empty_state_hint', "Tap 'Period?' below to mark your last period")}
          </p>
          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}

      <div
        className="relative z-10 bg-[#F0F2F5] rounded-[32px] px-4 pt-4 pb-2 sm:pt-6 sm:pb-3 sm:px-4 transition-all overflow-hidden mt-3"
        style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
        {...swipeHandlers}
      >

        {/* Top row: Show Guide (left), month (center), Today (right) */}
        <div className="grid grid-cols-3 items-center mb-2 gap-2">
          <div className="flex gap-4 justify-self-start items-center">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="text-[8px] text-slate-500 font-semibold uppercase tracking-[0.15em] hover:text-slate-700 transition-colors"
            >
              {showLegend ? t('calendar.guide.hide') : t('calendar.guide.show')}
            </button>
          </div>
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 text-center">
            {/* Use the hook to format month/year */}
            {calendarSystem.formatMonthYear(year, month)}
          </h2>
          <button
            onClick={() => onMonthChange(new Date())}
            className={`text-[8px] uppercase tracking-[0.12em] transition-all justify-self-end font-bold mr-1 ${isTodayMonth
              ? 'text-slate-400 hover:text-slate-600'
              : 'bg-[#fb7185] text-white px-1.5 py-[2px] rounded-[4px] shadow-sm active:scale-95'
              }`}
          >
            {t('common.today') || 'Today'}
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarSystem.weekDayKeys.map((d) => (
            <div key={d} className="text-center text-[10px] sm:text-xs text-slate-400 font-black uppercase tracking-[0.2em] pt-2 pb-2">
              {t(`calendar.days.${d}`)}
            </div>
          ))}

          {days.map((cell, idx) => {
            const dateStr = toLocalISOString(cell.date);
            const meta = getDayMeta(dateStr);
            const log = logs[dateStr];
            const hasLog = !!log;
            const isSelected = dateStr === selectedDate;

            return (
              <DayCell
                key={`${dateStr}-${cell.isCurrentMonth}-${idx}`} // Unique key
                date={cell.date}
                dateStr={dateStr}
                isCurrentMonth={cell.isCurrentMonth}
                meta={meta}
                log={log}
                hasLog={hasLog}
                isSelected={isSelected}
                settings={settings}
                isEditMode={isEditMode}
                onDateClick={onDateClick}
                onToggleBleedingDay={onToggleBleedingDay}
                idx={idx}
                label={cell.label} // Pass custom label (Jalali day number)
              />
            );
          })}
        </div>

        {isEditMode && (
          <p className="text-center text-[9px] text-slate-400 font-medium tracking-wide mt-1 mb-0.5">
            {t('calendar.edit_mode_hint', 'Tap days to mark or unmark period days')}
          </p>
        )}

        {showSavedToast && (
          <div className="flex justify-center mt-1 mb-0.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8aacac]/20 text-[#5a7d87] text-[9px] font-bold uppercase tracking-wider">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t('calendar.period_saved', 'Period saved')}
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 items-center mt-2 pb-0">
          <button
            type="button"
            // Use hook to calculate previous month date
            onClick={() => {
              const newParts = calendarSystem.addMonths({ year, month, day: 1 }, -1);
              onMonthChange(calendarSystem.fromCalendarDate(newParts.year, newParts.month, 1));
            }}
            className="flex items-center justify-center w-8 h-8 text-slate-400 transition-all hover:text-slate-600 active:scale-90 justify-self-start"
            aria-label={t('calendar.prev_month', 'Previous month')}
          >
            <svg className="w-5 h-5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {isEditMode ? (
            <div className="flex items-center gap-2 justify-self-center">
              <button
                onClick={onEditCancel || (() => setIsEditMode(false))}
                className="px-4 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-[0.15em] transition-all duration-300 active:scale-[0.98] text-slate-500"
                style={{
                  backgroundColor: '#F0F2F5',
                  boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.4), -4px -4px 8px rgba(255, 255, 255, 0.8)'
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleDone}
                className="px-5 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-[0.15em] transition-all duration-300 active:scale-[0.98] bg-[#8aacac] text-white shadow-[4px_4px_10px_rgba(138,172,172,0.4)]"
              >
                {t('calendar.done', 'Done')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditMode(true)}
              className={`min-w-[140px] px-[15px] py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-[0.2em] active:scale-[0.98] justify-self-center flex items-center justify-center gap-2 ${todayIsPeriod ? 'text-slate-600' : 'animate-period-button'}`}
              style={{
                backgroundColor: '#F0F2F5',
                boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.8)'
              }}
            >
              {todayIsPeriod ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              ) : (
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5"
                fill="currentColor"
                style={{ filter: 'drop-shadow(0px 1px 1px rgba(138, 172, 172, 0.3))' }}
              >
                <path d="M12 21.5c-3.59 0-6.5-2.91-6.5-6.5 0-3.59 4-9.5 6.5-12.5 2.5 3 6.5 8.91 6.5 12.5 0 3.59-2.91 6.5-6.5 6.5z" />
              </svg>
              )}
              {todayIsPeriod ? t('calendar.edit_period', 'Edit Period') : t('calendar.period_question', 'Period?')}
            </button>
          )}
          <button
            type="button"
            // Use hook to calculate next month date
            onClick={() => {
              const newParts = calendarSystem.addMonths({ year, month, day: 1 }, 1);
              onMonthChange(calendarSystem.fromCalendarDate(newParts.year, newParts.month, 1));
            }}
            className="flex items-center justify-center w-8 h-8 text-slate-400 transition-all hover:text-slate-600 active:scale-90 justify-self-end"
            aria-label={t('calendar.next_month', 'Next month')}
          >
            <svg className="w-5 h-5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Guide popup (legend content in modal) */}
      {showLegend && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-slate-200/20 backdrop-blur-sm transition-all duration-300"
            onClick={() => setShowLegend(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-[32px] p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 relative overflow-hidden w-full max-w-[300px] max-h-[60vh] flex flex-col pointer-events-auto animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowLegend(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-20"
                aria-label={t('calendar.guide.hide')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>

              <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-[#FFF0F3] to-transparent opacity-40 z-0 pointer-events-none" />

              <div className="relative z-10 mb-4 pr-10">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">{t('calendar.legend_title')}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('calendar.guide_subtitle')}</p>
              </div>

              <div className="relative z-10 flex-1 overflow-y-auto px-6 custom-scrollbar space-y-4 pb-2">

                {/* HOW TO USE */}
                <div className="space-y-3 pb-3 border-b border-slate-100">
                  <div className="space-y-2">
                    <p className="text-[11px] font-black text-slate-700">
                      {t('calendar.how_to_log_period_title')}
                    </p>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {t('calendar.how_to_log_period_body')}
                    </p>
                    <p className="text-[10px] text-slate-400 italic leading-snug">
                      {t('calendar.how_to_log_period_tip')}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-black text-slate-700">
                      {t('calendar.how_to_log_daily_title')}
                    </p>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {t('calendar.how_to_log_daily_body')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-y-3">
                  {/* CATEGORY 1: FLOW */}
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-400/90 border-b border-rose-100 pb-1.5 mb-1">{t('calendar.category_flow')}</div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-rose-100 ring-1 ring-rose-200 shadow-sm flex items-center justify-center">
                      <span className="text-xs font-bold text-rose-500">24</span>
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold">{t('calendar.legend.logged_period', 'Period')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center overflow-hidden">
                      <span className="text-[10px] font-semibold text-slate-400 leading-none mb-0">12</span>
                      <svg className="w-[8px] h-[8px] text-rose-500 translate-y-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8 8 4 12 4 16a8 8 0 1016 0c0-4-4-8-8-14z" />
                      </svg>
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold">{t('calendar.legend.flow_logged', 'Flow Logged')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-rose-50/50 border border-rose-100/30 flex items-center justify-center">
                      <span className="text-[10px] font-semibold text-rose-400/80">25</span>
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold leading-tight">{t('calendar.legend.mid_flow_pause')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full border-2 border-dashed border-rose-300 bg-transparent flex items-center justify-center">
                      <span className="text-[10px] font-semibold text-rose-400/80">28</span>
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold">{t('calendar.legend.predicted_period', 'Expected Period')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9 shrink-0 rounded-full bg-rose-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-rose-500">1</span>
                      <div className="absolute top-0 right-0 translate-x-[10%] -translate-y-[10%] bg-white rounded-full p-0.5 shadow-sm border border-rose-100">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-rose-400">
                          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold">{t('calendar.legend.cycle_start')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9 shrink-0 rounded-full bg-rose-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-rose-500">1</span>
                      <div className="absolute top-0 right-0 translate-x-[10%] -translate-y-[10%] bg-white rounded-full p-0.5 shadow-sm border border-rose-100">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-indigo-400">
                          <path fillRule="evenodd" d="M19.5 6.5a3.5 3.5 0 0 0-7 0v11a3.5 3.5 0 1 0 7 0v-11ZM16 2a5.5 5.5 0 0 0-5.5 5.5v11a5.5 5.5 0 1 0 11 0v-11A5.5 5.5 0 0 0 16 2Zm-3.5 5.5v4.25h7V7.5a3.5 3.5 0 1 0-7 0Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="leading-tight">
                      <span className="text-[11px] text-slate-600 font-bold block">{t('calendar.legend.withdrawal_bleed')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center overflow-hidden">
                      <span className="text-[10px] font-semibold text-slate-400 leading-none mb-0">15</span>
                      <div className="w-[4px] h-[4px] rounded-full bg-rose-400 translate-y-0" />
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold">{t('calendar.legend.spotting')}</span>
                  </div>

                  {/* CATEGORY 2: FERTILITY */}
                  {settings.showFertileWindow && (
                    <>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-teal-600/80 border-b border-teal-100 pb-1.5 mt-2 mb-1">{t('calendar.category_fertility')}</div>

                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 shrink-0 rounded-full border-2 border-[#b0f4eb] bg-transparent flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-teal-500">12</span>
                          <div className="absolute top-0 right-0 translate-x-[15%] -translate-y-[15%] flex items-center justify-center">
                            <div className="w-2 h-2 bg-teal-500 rounded-full border border-white shadow-sm" />
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-600 font-bold">{t('calendar.legend.fertile_window')}</span>
                      </div>
                    </>
                  )}

                  {/* CATEGORY 3: LOGS */}
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400/80 border-b border-indigo-100 pb-1.5 mt-2 mb-1">{t('calendar.category_logs')}</div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-transparent border border-slate-200 shadow-sm flex items-center justify-center">
                      <span className="text-[10px] font-bold text-blue-400">26</span>
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold">{t('calendar.legend.pms')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center overflow-hidden">
                      <span className="text-[10px] font-semibold text-slate-400 leading-none mb-0">16</span>
                      <svg className="w-[8px] h-[8px] text-amber-500 translate-y-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold">{t('calendar.legend.symptoms')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center overflow-hidden">
                      <span className="text-[10px] font-semibold text-slate-400 leading-none mb-0">10</span>
                      <svg className="w-[9px] h-[9px] text-slate-400 translate-y-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold">{t('calendar.legend.notes')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-white ring-2 ring-accent ring-offset-2 flex items-center justify-center shadow-sm">
                      <span className="text-[10px] font-bold text-slate-400">30</span>
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold">{t('calendar.legend.today')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-white ring-2 ring-[#8b5cf6] ring-offset-2 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400">4</span>
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold">{t('calendar.legend.selected')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Calendar;