import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DailyLog, Cycle, SymptomConfig, PeriodRecord, AppSettings, MOOD_OPTIONS } from '../types';
import { toLocalISOString, getTimestamp, diffInDays } from '../utils/dateUtils';
import { isCycleEligibleForAverage } from '../services/logic/cycle';

// Inlined useTrendStats Hook
interface TrendStatsProps {
  logs: Record<string, DailyLog>;
  cycles: Cycle[];
  range: 30 | 90 | 180 | 365;
  selectedSymptoms: string[];
  selectedMoods: string[];
  searchQuery: string;
  settings: AppSettings;
}

const useTrendStats = ({
  logs,
  cycles,
  range,
  selectedSymptoms,
  selectedMoods,
  searchQuery,
  settings
}: TrendStatsProps) => {

  // Filter logs by date range and search criteria
  const filteredLogs = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setHours(0, 0, 0, 0); // Start of local day
    cutoffDate.setDate(cutoffDate.getDate() - range);
    const cutoffStr = toLocalISOString(cutoffDate);

    const result: Record<string, DailyLog> = {};

    const logEntries = Object.entries(logs) as [string, DailyLog][];
    logEntries.forEach(([date, log]) => {
      if (date < cutoffStr) return;

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
  }, [logs, range, selectedSymptoms, selectedMoods, searchQuery]);

  // Calculate a filtered list of cycles that match the active filters
  const filteredCycles = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setHours(0, 0, 0, 0);
    cutoffDate.setDate(cutoffDate.getDate() - range);
    const cutoffStr = toLocalISOString(cutoffDate);

    const DAY_MS = 86400000;

    const filteredLogTimestamps = new Set<number>();
    Object.keys(filteredLogs).forEach(dateStr => {
      filteredLogTimestamps.add(getTimestamp(dateStr));
    });

    return cycles.filter(c => {
      if (c.startDate < cutoffStr) return false;

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
  }, [cycles, range, filteredLogs, selectedSymptoms, selectedMoods, searchQuery]);

  // Average cycle and period length based on filtered data
  const rangeAverages = useMemo(() => {
    const defaultCycle = settings.cycleLength ?? 28;
    const defaultPeriod = settings.periodLength ?? 5;

    const filterOutliers = (list: Cycle[]) => list.filter(c => isCycleEligibleForAverage(c.length || 0));
    const validRelevant = filterOutliers(filteredCycles);

    if (validRelevant.length === 0) {
      const allValid = filterOutliers(cycles);
      if (allValid.length === 0) return { avgCycle: null, avgPeriod: null, isInitial: true };

      const avgCycle = Math.round(allValid.reduce((a, b) => a + (b.length || defaultCycle), 0) / allValid.length);
      const avgPeriod = Math.round(allValid.reduce((a, b) => a + Math.min((b.periodLength || defaultPeriod), 10), 0) / allValid.length);
      return { avgCycle, avgPeriod, isHistorical: true };
    }

    const avgCycle = Math.round(validRelevant.reduce((a, b) => a + (b.length || defaultCycle), 0) / validRelevant.length);
    const avgPeriod = Math.round(validRelevant.reduce((a, b) => a + Math.min((b.periodLength || defaultPeriod), 10), 0) / validRelevant.length);
    return { avgCycle, avgPeriod };
  }, [filteredCycles, cycles, settings.cycleLength, settings.periodLength]);

  // Statistics for main charts
  const statistics = useMemo(() => {
    const symptomCounts: Record<string, number> = {};

    const logValues = Object.values(filteredLogs) as DailyLog[];
    logValues.forEach(log => {
      log.symptoms.forEach(sym => {
        symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
      });
    });

    const sortedSymptoms = Object.entries(symptomCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    return { sortedSymptoms };
  }, [filteredLogs]);


  // Flow vs Day of Bleeding Heatmap
  const flowHeatmap = useMemo(() => {
    const data: Record<string, Record<number, number>> = {
      heavy: {},
      medium: {},
      light: {},
      spotting: {}
    };

    const todayStr = toLocalISOString(new Date());

    filteredCycles.forEach((cycle) => {
      const [y, m, d_val] = cycle.startDate.split('-').map(Number);
      const cycleStart = new Date(y, m - 1, d_val);
      // Use actual cycle length, or days-elapsed for unfinished cycle
      const maxDay = cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todayStr, cycle.startDate) + 1);
      for (let day = 1; day <= maxDay; day++) {
        const d = new Date(cycleStart);
        d.setDate(d.getDate() + (day - 1));
        const dStr = toLocalISOString(d);

        const log = filteredLogs[dStr];
        if (log && log.flow) {
          const cycleDay = Math.min(day, 31);
          data[log.flow][cycleDay] = (data[log.flow][cycleDay] || 0) + 1;
        }
      }
    });

    return data;
  }, [filteredLogs, filteredCycles]);

  const maxFlowFreq = useMemo(() => {
    let max = 1;
    Object.values(flowHeatmap).forEach(days => {
      Object.values(days).forEach(val => {
        if (val > max) max = val;
      });
    });
    return max;
  }, [flowHeatmap]);

  // Mood vs Day of Cycle Heatmap
  const moodHeatmap = useMemo(() => {
    const data: Record<string, Record<number, number>> = {};
    MOOD_OPTIONS.forEach(opt => { data[opt.id] = {}; });

    const todayMoodStr = toLocalISOString(new Date());

    filteredCycles.forEach((cycle) => {
      const [y, m, d_val] = cycle.startDate.split('-').map(Number);
      const cycleStart = new Date(y, m - 1, d_val);
      const maxDay = cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todayMoodStr, cycle.startDate) + 1);
      for (let day = 1; day <= maxDay; day++) {
        const d = new Date(cycleStart);
        d.setDate(d.getDate() + (day - 1));
        const dStr = toLocalISOString(d);

        const log = filteredLogs[dStr];
        if (log && log.mood) {
          const logMoods = log.mood;
          const cycleDay = Math.min(day, 31);
          logMoods.forEach(mood => {
            if (data[mood]) {
              data[mood][cycleDay] = (data[mood][cycleDay] || 0) + 1;
            }
          });
        }
      }
    });

    return data;
  }, [filteredLogs, filteredCycles]);

  const maxMoodFreq = useMemo(() => {
    let max = 1;
    Object.values(moodHeatmap).forEach(days => {
      Object.values(days).forEach(val => {
        if (val > max) max = val;
      });
    });
    return max;
  }, [moodHeatmap]);

  const topSymptomNames = useMemo(() => statistics.sortedSymptoms.map(([name]) => name), [statistics.sortedSymptoms]);

  // Symptom vs Day of Cycle Heatmap
  const symptomHeatmap = useMemo(() => {
    const data: Record<string, Record<number, number>> = {};
    topSymptomNames.forEach(name => { data[name] = {}; });

    const todaySymptomStr = toLocalISOString(new Date());

    filteredCycles.forEach((cycle) => {
      const [y, m, d_val] = cycle.startDate.split('-').map(Number);
      const cycleStart = new Date(y, m - 1, d_val);
      const maxDay = cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todaySymptomStr, cycle.startDate) + 1);
      for (let day = 1; day <= maxDay; day++) {
        const d = new Date(cycleStart);
        d.setDate(d.getDate() + (day - 1));
        const dStr = toLocalISOString(d);

        const log = filteredLogs[dStr];
        if (log && log.symptoms) {
          const cycleDay = Math.min(day, 31);
          log.symptoms.forEach(s => {
            if (data[s]) {
              data[s][cycleDay] = (data[s][cycleDay] || 0) + 1;
            }
          });
        }
      }
    });

    return data;
  }, [filteredLogs, filteredCycles, topSymptomNames]);

  const maxSymptomFreq = useMemo(() => {
    let max = 1;
    Object.values(symptomHeatmap).forEach(days => {
      Object.values(days).forEach(val => {
        if (val > max) max = val;
      });
    });
    return max;
  }, [symptomHeatmap]);


  // Pill adherence vs Day of Cycle: count of cycles where the pill was taken on that day
  const pillHeatmap = useMemo(() => {
    const data: Record<number, number> = {};

    const todayPillStr = toLocalISOString(new Date());

    filteredCycles.forEach((cycle) => {
      const [y, m, d_val] = cycle.startDate.split('-').map(Number);
      const cycleStart = new Date(y, m - 1, d_val);
      const maxDay = cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todayPillStr, cycle.startDate) + 1);
      for (let day = 1; day <= maxDay; day++) {
        const d = new Date(cycleStart);
        d.setDate(d.getDate() + (day - 1));
        const dStr = toLocalISOString(d);

        if (filteredLogs[dStr]?.pillTakenAt) {
          const cycleDay = Math.min(day, 31);
          data[cycleDay] = (data[cycleDay] || 0) + 1;
        }
      }
    });

    return data;
  }, [filteredLogs, filteredCycles]);

  // Medications vs Day of Cycle: one row per medication, built only from the selected
  // range, so old one-off medications simply have no data here and never show up.
  const medsHeatmap = useMemo(() => {
    const data: Record<string, Record<number, number>> = {};

    const todayMedsStr = toLocalISOString(new Date());

    filteredCycles.forEach((cycle) => {
      const [y, m, d_val] = cycle.startDate.split('-').map(Number);
      const cycleStart = new Date(y, m - 1, d_val);
      const maxDay = cycle.length
        ? cycle.length
        : Math.max(1, diffInDays(todayMedsStr, cycle.startDate) + 1);
      for (let day = 1; day <= maxDay; day++) {
        const d = new Date(cycleStart);
        d.setDate(d.getDate() + (day - 1));
        const dStr = toLocalISOString(d);

        for (const name of filteredLogs[dStr]?.meds || []) {
          const cycleDay = Math.min(day, 31);
          if (!data[name]) data[name] = {};
          data[name][cycleDay] = (data[name][cycleDay] || 0) + 1;
        }
      }
    });

    return data;
  }, [filteredLogs, filteredCycles]);

  return {
    filteredLogs,
    filteredCycles,
    rangeAverages,
    statistics,
    flowHeatmap,
    maxFlowFreq,
    moodHeatmap,
    maxMoodFreq,
    symptomHeatmap,
    maxSymptomFreq,
    topSymptomNames,
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
    flowHeatmap,
    maxFlowFreq,
    moodHeatmap,
    maxMoodFreq,
    symptomHeatmap,
    maxSymptomFreq,
    topSymptomNames,
    pillHeatmap,
    medsHeatmap,
    filteredCycles
  } = useTrendStats({
    logs,
    cycles,
    range,
    selectedSymptoms,
    selectedMoods,
    searchQuery,
    settings
  });

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

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pt-4 pb-32 space-y-6 relative z-10">

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
                const eligibleCount = cycles.filter(c =>
                  c.isValid && !c.isWithdrawalBleed && !c.ignoreForAverages
                ).length;

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
            {t('trends.completed_cycles_note')}
          </p>
          <TrendStatCards rangeAverages={rangeAverages} defaultCycleLength={settings.cycleLength} defaultPeriodLength={settings.periodLength} />
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
        <CycleHistoryChart cycles={cycles} />

        {/* Flow Pattern Curve */}
        <AverageFlowCurve logs={logs} periods={periods} />

        {/* Mood by Phase Breakdown */}
        <MoodByPhase logs={logs} cycles={cycles} />

        {/* Mood Timeline Heatmap */}
        {maxMoodFreq > 0 && (
          <HeatmapSection
            title={t('trends.mood_timeline')}
            gradientFrom="amber-100"
            gradientTo="amber-500"
            colorScale="orange"
            maxValue={maxMoodFreq}
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
            maxValue={maxSymptomFreq}
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

        {/* Pill Adherence (Cycle Days) — intensity = fraction of cycles where it was taken that day.
            Other medications share this section: one extra row each, only for medications
            actually taken inside the selected range. */}
        {(Object.keys(pillHeatmap).length > 0 || Object.keys(medsHeatmap).length > 0) && (
          <HeatmapSection
            title={t('trends.pill_timeline')}
            gradientFrom="teal-100"
            gradientTo="teal-500"
            colorScale="teal"
            maxValue={Math.max(filteredCycles.length, 1)}
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