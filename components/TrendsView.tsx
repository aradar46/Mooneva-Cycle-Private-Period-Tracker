import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DailyLog, Cycle, SymptomConfig, PeriodRecord, AppSettings, MOOD_OPTIONS } from '../types';
import { toLocalISOString, getTimestamp, diffInDays, addDays } from '../utils/dateUtils';
import { averageCycleLength, averagePeriodLength, getEligibleCycles, getPregnancySpans, isCycleOutlier } from '../services/logic/cycle';

/** The heatmaps run to the longest cycle in range, never past this. 45 is where
 *  `isCycleEligibleForAverage` stops calling a cycle normal; beyond it the days belong to a
 *  gap, not a cycle. A fixed 31 columns used to cut a 38-day cycle's whole PMS stretch off
 *  the chart, and left a 26-day user staring at five columns that could never hold data. */
const MAX_CYCLE_DAY_COLUMN = 45;

// Inlined useTrendStats Hook
interface TrendStatsProps {
  logs: Record<string, DailyLog>;
  cycles: Cycle[];
  periods: PeriodRecord[];
  range: 30 | 90 | 180 | 365;
  selectedSymptoms: string[];
  selectedMoods: string[];
  searchQuery: string;
}

const useTrendStats = ({
  logs,
  cycles,
  periods,
  range,
  selectedSymptoms,
  selectedMoods,
  searchQuery,
}: TrendStatsProps) => {

  const cutoffStr = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setHours(0, 0, 0, 0); // Start of local day
    cutoffDate.setDate(cutoffDate.getDate() - range);
    return toLocalISOString(cutoffDate);
  }, [range]);

  // Search/symptom/mood filters only. The date range is applied to cycles and periods
  // instead, so a cycle that reaches into the window is counted whole rather than
  // sliced at the cutoff, which would empty its first columns for no real reason.
  const filteredLogs = useMemo(() => {
    const result: Record<string, DailyLog> = {};

    const logEntries = Object.entries(logs) as [string, DailyLog][];
    logEntries.forEach(([date, log]) => {
      if (selectedSymptoms.length > 0) {
        const hasMatchingSymptom = log.symptoms.some(s => selectedSymptoms.includes(s));
        if (!hasMatchingSymptom) return;
      }
      if (selectedMoods.length > 0) {
        if (!log.mood) return;
        const logMoods = log.mood;
        const hasMatchingMood = logMoods.some(m => selectedMoods.includes(m));
        if (!hasMatchingMood) return;
      }

      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const noteMatch = log.notes?.toLowerCase().includes(query);
        const symptomMatch = log.symptoms.some(s => s.toLowerCase().includes(query));
        if (!noteMatch && !symptomMatch) return;
      }
      result[date] = log;
    });

    return result;
  }, [logs, selectedSymptoms, selectedMoods, searchQuery]);

  // Calculate a filtered list of cycles that match the active filters
  const filteredCycles = useMemo(() => {
    const DAY_MS = 86400000;
    const todayStr = toLocalISOString(new Date());

    const filteredLogTimestamps = new Set<number>();
    Object.keys(filteredLogs).forEach(dateStr => {
      filteredLogTimestamps.add(getTimestamp(dateStr));
    });

    return cycles.filter(c => {
      // A cycle counts when any part of it falls inside the window, not only when it
      // started there: on a 30 day range a cycle that began 40 days ago and ended 12
      // days ago is most of what actually happened in those 30 days.
      const cycleEnd = c.length ? addDays(c.startDate, c.length - 1) : todayStr;
      if (cycleEnd < cutoffStr) return false;
      // A gap of 600 days has no meaningful cycle day, pregnancy or otherwise, and it would
      // drag the axis out to its 45-day cap on the strength of one cycle.
      if (c.isOutlier) return false;
      // Ticking "exclude" used to drop the cycle from the averages while the charts under
      // them kept drawing it, so the page argued with itself about a cycle the user had
      // already ruled out. One tick, off the whole page.
      if (c.ignoreForAverages) return false;

      // If no filters are active, return true
      if (selectedSymptoms.length === 0 && selectedMoods.length === 0 && searchQuery.trim() === "") {
        return true;
      }

      const cycleStartUtc = getTimestamp(c.startDate);
      const cycleLen = c.length || 28;

      for (let i = 0; i < cycleLen; i++) {
        if (filteredLogTimestamps.has(cycleStartUtc + (i * DAY_MS))) {
          return true;
        }
      }
      return false;
    });
  }, [cycles, cutoffStr, filteredLogs, selectedSymptoms, selectedMoods, searchQuery]);

  // Periods on the same rule as cycles: any overlap with the window counts, and a period
  // the user ticked as excluded counts nowhere.
  const filteredPeriods = useMemo(
    () => periods.filter(p =>
      !p.ignoreForAverages && addDays(p.startDate, Math.max(1, p.days) - 1) >= cutoffStr
    ),
    [periods, cutoffStr]
  );

  /** The cycle you are living in. `getPastCycles` only emits finished cycles, because a
   *  cycle with no end has no length to average, so everything logged since your last
   *  period started was invisible in the heatmaps until your next one began. It carries no
   *  `length`, which keeps it out of the averages, the regularity bars and mood by phase,
   *  all of which need a finished cycle. The heatmaps count it up to today. */
  const openCycle = useMemo((): Cycle | null => {
    const todayStr = toLocalISOString(new Date());
    const last = [...periods]
      .filter(p => p.startDate <= todayStr && !p.ignoreForAverages)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    if (!last) return null;
    // A period record that is already closed by a later one is not the open cycle.
    if (cycles.some(c => c.startDate === last.startDate)) return null;
    // Stopped logging months ago: the same rule the rest of the app uses for a gap.
    if (isCycleOutlier(diffInDays(todayStr, last.startDate) + 1)) return null;
    return { startDate: last.startDate };
  }, [periods, cycles]);

  const heatmapCycles = useMemo(
    () => openCycle ? [...filteredCycles, openCycle] : filteredCycles,
    [filteredCycles, openCycle]
  );

  /** The last column worth drawing: the longest cycle in range, capped. Zero when there is
   *  nothing to count, in which case the sections do not render at all. */
  const heatmapDayCount = useMemo(() => {
    const todayStr = toLocalISOString(new Date());
    return heatmapCycles.reduce((longest, cycle) => {
      const reached = cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todayStr, cycle.startDate) + 1);
      return Math.max(longest, Math.min(reached, MAX_CYCLE_DAY_COLUMN));
    }, 0);
  }, [heatmapCycles]);

  /** How many of the counted cycles actually reached each cycle day. This is the
   *  denominator: day 5 exists in every cycle, day 30 only in the ones that ran that long,
   *  so raw counts made the late columns look empty when they were only rarer. */
  const cycleDayOpportunities = useMemo(() => {
    const counts: Record<number, number> = {};
    const todayStr = toLocalISOString(new Date());

    heatmapCycles.forEach(cycle => {
      const reached = cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todayStr, cycle.startDate) + 1);
      for (let day = 1; day <= Math.min(reached, heatmapDayCount); day++) {
        counts[day] = (counts[day] || 0) + 1;
      }
    });

    return counts;
  }, [heatmapCycles, heatmapDayCount]);

  /** Below this many cycles a column is drawn as "not enough data" rather than coloured:
   *  one cycle reaching day 33 would otherwise paint 100% off a single log. */
  const minOpportunities = useMemo(
    () => Math.min(heatmapCycles.length, Math.max(2, Math.ceil(heatmapCycles.length / 4))),
    [heatmapCycles.length]
  );

  // Average cycle and period length based on filtered data
  const rangeAverages = useMemo(() => {
    const relevantCycleAverage = averageCycleLength(filteredCycles);
    const relevantPeriodAverage = averagePeriodLength(filteredCycles);

    if (relevantCycleAverage !== null && relevantPeriodAverage !== null) {
      return { avgCycle: relevantCycleAverage, avgPeriod: relevantPeriodAverage };
    }

    const historicalCycleAverage = averageCycleLength(cycles);
    const historicalPeriodAverage = averagePeriodLength(cycles);
    if (historicalCycleAverage === null || historicalPeriodAverage === null) {
      return { avgCycle: null, avgPeriod: null, isInitial: true };
    }

    return {
      avgCycle: historicalCycleAverage,
      avgPeriod: historicalPeriodAverage,
      isHistorical: true
    };
  }, [filteredCycles, cycles]);

  // Statistics for main charts. Counted over the days the filtered cycles cover, so the
  // rows listed here are exactly the rows the heatmap below can fill.
  const statistics = useMemo(() => {
    const symptomCounts: Record<string, number> = {};

    const todayStatsStr = toLocalISOString(new Date());

    heatmapCycles.forEach(cycle => {
      const maxDay = Math.min(heatmapDayCount, cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todayStatsStr, cycle.startDate) + 1));
      for (let day = 1; day <= maxDay; day++) {
        const log = filteredLogs[addDays(cycle.startDate, day - 1)];
        if (!log) continue;
        log.symptoms.forEach(sym => {
          symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
        });
      }
    });

    const sortedSymptoms = Object.entries(symptomCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    return { sortedSymptoms };
  }, [filteredLogs, heatmapCycles, heatmapDayCount]);


  // Mood vs Day of Cycle Heatmap
  const moodHeatmap = useMemo(() => {
    const data: Record<string, Record<number, number>> = {};
    MOOD_OPTIONS.forEach(opt => { data[opt.id] = {}; });

    const todayMoodStr = toLocalISOString(new Date());

    heatmapCycles.forEach((cycle) => {
      const [y, m, d_val] = cycle.startDate.split('-').map(Number);
      const cycleStart = new Date(y, m - 1, d_val);
      const maxDay = Math.min(heatmapDayCount, cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todayMoodStr, cycle.startDate) + 1));
      for (let day = 1; day <= maxDay; day++) {
        const d = new Date(cycleStart);
        d.setDate(d.getDate() + (day - 1));
        const dStr = toLocalISOString(d);

        const log = filteredLogs[dStr];
        if (log && log.mood) {
          const logMoods = log.mood;
          logMoods.forEach(mood => {
            if (data[mood]) {
              data[mood][day] = (data[mood][day] || 0) + 1;
            }
          });
        }
      }
    });

    return data;
  }, [filteredLogs, heatmapCycles, heatmapDayCount]);

  const topSymptomNames = useMemo(() => statistics.sortedSymptoms.map(([name]) => name), [statistics.sortedSymptoms]);

  // Symptom vs Day of Cycle Heatmap
  const symptomHeatmap = useMemo(() => {
    const data: Record<string, Record<number, number>> = {};
    topSymptomNames.forEach(name => { data[name] = {}; });

    const todaySymptomStr = toLocalISOString(new Date());

    heatmapCycles.forEach((cycle) => {
      const [y, m, d_val] = cycle.startDate.split('-').map(Number);
      const cycleStart = new Date(y, m - 1, d_val);
      const maxDay = Math.min(heatmapDayCount, cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todaySymptomStr, cycle.startDate) + 1));
      for (let day = 1; day <= maxDay; day++) {
        const d = new Date(cycleStart);
        d.setDate(d.getDate() + (day - 1));
        const dStr = toLocalISOString(d);

        const log = filteredLogs[dStr];
        if (log && log.symptoms) {
          log.symptoms.forEach(s => {
            if (data[s]) {
              data[s][day] = (data[s][day] || 0) + 1;
            }
          });
        }
      }
    });

    return data;
  }, [filteredLogs, heatmapCycles, heatmapDayCount, topSymptomNames]);


  // Pill adherence vs Day of Cycle: count of cycles where the pill was taken on that day
  const pillHeatmap = useMemo(() => {
    const data: Record<number, number> = {};

    const todayPillStr = toLocalISOString(new Date());

    heatmapCycles.forEach((cycle) => {
      const [y, m, d_val] = cycle.startDate.split('-').map(Number);
      const cycleStart = new Date(y, m - 1, d_val);
      const maxDay = Math.min(heatmapDayCount, cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todayPillStr, cycle.startDate) + 1));
      for (let day = 1; day <= maxDay; day++) {
        const d = new Date(cycleStart);
        d.setDate(d.getDate() + (day - 1));
        const dStr = toLocalISOString(d);

        if (filteredLogs[dStr]?.pillTakenAt) {
          data[day] = (data[day] || 0) + 1;
        }
      }
    });

    return data;
  }, [filteredLogs, heatmapCycles, heatmapDayCount]);

  // Medications vs Day of Cycle: one row per medication, built only from the selected
  // range, so old one-off medications simply have no data here and never show up.
  const medsHeatmap = useMemo(() => {
    const data: Record<string, Record<number, number>> = {};

    const todayMedsStr = toLocalISOString(new Date());

    heatmapCycles.forEach((cycle) => {
      const [y, m, d_val] = cycle.startDate.split('-').map(Number);
      const cycleStart = new Date(y, m - 1, d_val);
      const maxDay = Math.min(heatmapDayCount, cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todayMedsStr, cycle.startDate) + 1));
      for (let day = 1; day <= maxDay; day++) {
        const d = new Date(cycleStart);
        d.setDate(d.getDate() + (day - 1));
        const dStr = toLocalISOString(d);

        for (const name of filteredLogs[dStr]?.meds || []) {
          if (!data[name]) data[name] = {};
          data[name][day] = (data[name][day] || 0) + 1;
        }
      }
    });

    return data;
  }, [filteredLogs, heatmapCycles, heatmapDayCount]);

  return {
    filteredLogs,
    filteredCycles,
    filteredPeriods,
    rangeAverages,
    statistics,
    moodHeatmap,
    symptomHeatmap,
    topSymptomNames,
    cycleDayOpportunities,
    minOpportunities,
    heatmapDayCount,
    pillHeatmap,
    medsHeatmap
  };
};

// Sub-components
import TrendsFilterDrawer from './trends/TrendsFilterDrawer';
import TrendStatCards from './trends/TrendStatCards';
import HeatmapSection from './trends/HeatmapSection';
import CycleHistoryChart from './trends/CycleHistoryChart';
import AverageFlowCurve from './trends/AverageFlowCurve';
import MoodByPhase from './trends/MoodByPhase';

interface TrendsViewProps {
  logs: Record<string, DailyLog>;
  cycles: Cycle[];
  periods: PeriodRecord[];
  settings: AppSettings;
  onBack: () => void;
  availableSymptoms: SymptomConfig[];
}

const TrendsView: React.FC<TrendsViewProps> = ({ logs, cycles, periods, settings, onBack, availableSymptoms }) => {
  const { t } = useTranslation();

  // Local UI State
  const [range, setRange] = useState<30 | 90 | 180 | 365>(90);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Custom Hook for Logic
  const {
    rangeAverages,
    statistics,
    moodHeatmap,
    symptomHeatmap,
    topSymptomNames,
    cycleDayOpportunities,
    minOpportunities,
    heatmapDayCount,
    pillHeatmap,
    medsHeatmap,
    filteredCycles,
    filteredPeriods
  } = useTrendStats({
    logs,
    cycles,
    periods,
    range,
    selectedSymptoms,
    selectedMoods,
    searchQuery,
  });

  // Cycle-day charts have nothing to say during a pregnancy: there is no cycle to
  // count days against. The date-based charts above are unaffected and keep working.
  const pregnancyOpen = useMemo(
    () => getPregnancySpans(logs, periods).some(sp => sp.isOngoing),
    [logs, periods]
  );

  // The number the cards were actually built from, not the number in range: a cycle can
  // be in range and still be dropped for being a withdrawal bleed or manually excluded.
  const averagedCycleCount = useMemo(() => getEligibleCycles(filteredCycles).length, [filteredCycles]);

  const hasActiveFilters = selectedSymptoms.length > 0 || selectedMoods.length > 0 || searchQuery.trim() !== '';

  const clearFilters = () => {
    setSelectedSymptoms([]);
    setSelectedMoods([]);
    setSearchQuery('');
  };

  const toggleSymptomFilter = (symptom: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
    );
  };

  const toggleMoodFilter = (mood: string) => {
    setSelectedMoods(prev =>
      prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f5f4f2] animate-slide-up overflow-hidden no-scrollbar relative">
      {/* Decorative Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className={`absolute top-0 right-0 w-[500px] h-[500px] phase-accent-follicular blur-[100px] opacity-40 animate-blob-pulse`} />
        <div className={`absolute bottom-0 left-0 w-[400px] h-[400px] phase-accent-ovulation blur-[120px] opacity-30 animate-blob-pulse delay-700`} />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-6 pt-4 pb-32 space-y-6 relative z-10">

        {/* Range selector + stat cards grouped with tight spacing */}
        <div className="space-y-3">
          <div
            className="bg-[#F0F2F5] p-1.5 rounded-[2rem] flex items-center gap-1"
            style={{ boxShadow: 'inset 4px 4px 8px rgba(163, 177, 198, 0.4), inset -4px -4px 8px rgba(255, 255, 255, 0.8)' }}
          >
            {[30, 90, 180, 365].map((days) => (
              <button
                key={days}
                onClick={() => setRange(days as 30 | 90 | 180 | 365)}
                className={`flex-1 py-2.5 rounded-[1.5rem] text-[10px] font-extrabold uppercase tracking-[0.15em] transition-all duration-300 ${range === days
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
                style={range === days ? {
                  backgroundColor: '#7598a0',
                  boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.5), -2px -2px 6px rgba(255, 255, 255, 0.8), 0 0 12px rgba(117, 152, 160, 0.3)'
                } : {}}
              >
                {days === 365 ? t('trends.year') : t(`trends.${days}d`)}
              </button>
            ))}
          </div>

          {settings.adaptivePrediction && !settings.isOnBirthControl && (
            <div className="px-1">
              {(() => {
                // Same rule the prediction model uses, not a local copy of it. The
                // inline version agreed only because eligibility (18-45 days) sits
                // inside the outlier threshold (>60); raising MAX_CYCLE_LENGTH would
                // have silently split them.
                const eligibleCount = getEligibleCycles(cycles).length;

                if (eligibleCount < 3) {
                  const remaining = 3 - eligibleCount;
                  return (
                    <div
                      className="rounded-[28px] p-5 bg-[#F0F2F5] mb-4 border border-white/20"
                      style={{
                        boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)'
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-[#F0F2F5] flex items-center justify-center text-amber-500 shrink-0"
                          style={{ boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.8)' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
                          </svg>
                        </div>
                        <p className="text-[12px] font-bold text-slate-600 leading-relaxed pr-2">
                          {t('trends.adaptive_learning_remaining', { count: remaining })}
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

          <p className="px-2 pb-1 text-center text-[11px] leading-relaxed text-slate-500">
            {pregnancyOpen ? t('trends.pregnancy_note') : t('trends.completed_cycles_note')}
          </p>
          <TrendStatCards rangeAverages={rangeAverages} />

          {(rangeAverages.isHistorical || averagedCycleCount > 0) && (
            <p className="px-2 text-center text-[11px] leading-relaxed text-slate-500">
              {rangeAverages.isHistorical
                ? t('trends.no_data_range')
                : t('trends.based_on_cycles', { count: averagedCycleCount })}
            </p>
          )}
        </div>

        <TrendsFilterDrawer
          showFilters={showFilters}
          hasActiveFilters={hasActiveFilters}
          clearFilters={clearFilters}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          availableSymptoms={availableSymptoms}
          selectedSymptoms={selectedSymptoms}
          toggleSymptomFilter={toggleSymptomFilter}
          selectedMoods={selectedMoods}
          toggleMoodFilter={toggleMoodFilter}
        />

        {/* Cycle Regularity Bar Chart */}
        <CycleHistoryChart cycles={filteredCycles} />

        {/* Flow Pattern Curve */}
        <AverageFlowCurve logs={logs} periods={filteredPeriods} />

        {/* Mood by Phase Breakdown */}
        <MoodByPhase logs={logs} cycles={filteredCycles} settings={settings} />

        {/* Mood Timeline Heatmap */}
        {Object.values(moodHeatmap).some(days => Object.keys(days).length > 0) && (
          <HeatmapSection
            title={t('trends.mood_timeline')}
            gradientFrom="amber-100"
            gradientTo="amber-500"
            colorScale="orange"
            opportunities={cycleDayOpportunities}
            minOpportunities={minOpportunities}
            dayCount={heatmapDayCount}
            lowLabel={t('trends.rare')}
            highLabel={t('trends.likely')}
            rows={MOOD_OPTIONS.map((opt, idx) => ({
              id: opt.id,
              label: `${opt.emoji} ${t(opt.labelKey)}`,
              data: moodHeatmap[opt.id],
              config: {
                color: opt.color,
                secondary: opt.dark,
                wash: opt.shadow,
                blob: `blob-${(idx % 3) + 1}`
              }
            }))}
          />
        )}


        {/* Symptom Prevalence (Cycle Days) */}
        {topSymptomNames.length > 0 && (
          <HeatmapSection
            title={t('trends.symptom_timeline')}
            gradientFrom="indigo-100"
            gradientTo="indigo-500"
            opportunities={cycleDayOpportunities}
            minOpportunities={minOpportunities}
            dayCount={heatmapDayCount}
            lowLabel={t('trends.rare')}
            highLabel={t('trends.likely')}
            rows={topSymptomNames.map((symName, idx) => ({
              id: symName,
              label: symName,
              data: symptomHeatmap[symName],
              config: {
                color: 'rgb(129, 140, 248)',
                secondary: 'rgb(79, 70, 229)',
                wash: 'rgba(129, 140, 248, 0.1)',
                blob: `blob-${(idx % 5) + 1}`
              }
            }))}
          />
        )}

        {/* A pregnancy has no cycle days to count, so the three sections above render
            nothing at all. Say why, rather than ending the page in silence. */}
        {pregnancyOpen && Object.keys(cycleDayOpportunities).length === 0 && (
          <div
            className="bg-[#F0F2F5] rounded-[32px] p-6"
            style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
          >
            <p className="text-slate-400 text-sm text-center py-8 leading-relaxed">{t('trends.pregnancy_charts_paused')}</p>
          </div>
        )}

        {/* Pill Adherence (Cycle Days) — intensity = fraction of cycles where it was taken that day.
            Other medications share this section: one extra row each, only for medications
            actually taken inside the selected range. */}
        {(Object.keys(pillHeatmap).length > 0 || Object.keys(medsHeatmap).length > 0) && (
          <HeatmapSection
            title={t('trends.pill_timeline')}
            gradientFrom="teal-100"
            gradientTo="teal-500"
            colorScale="teal"
            opportunities={cycleDayOpportunities}
            minOpportunities={minOpportunities}
            dayCount={heatmapDayCount}
            lowLabel={t('trends.pill_low')}
            highLabel={t('trends.pill_high')}
            rows={[
              ...(Object.keys(pillHeatmap).length > 0 ? [{
                id: 'pill',
                label: `💊 ${t('trends.pill_taken')}`,
                data: pillHeatmap,
                config: {
                  color: 'rgb(45, 212, 191)',
                  secondary: 'rgb(13, 148, 136)',
                  wash: 'rgba(45, 212, 191, 0.1)',
                  blob: 'blob-1'
                }
              }] : []),
              ...Object.keys(medsHeatmap).map((name, idx) => ({
                id: name.toLowerCase(),
                label: name,
                data: medsHeatmap[name],
                config: {
                  color: 'rgb(45, 212, 191)',
                  secondary: 'rgb(13, 148, 136)',
                  wash: 'rgba(45, 212, 191, 0.1)',
                  blob: `blob-${(idx % 5) + 1}`
                }
              }))
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default TrendsView;
