import React, { useMemo } from 'react';
import { DailyLog, Cycle, MOOD_OPTIONS } from '../../types';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../services/i18n';
import { toLocalISOString } from '../../utils/dateUtils';


interface MoodByPhaseProps {
    logs: Record<string, DailyLog>;
    cycles: Cycle[];
}

interface PhaseMood {
    phase: string;
    icon: string;
    iconColor: string;
    dominantMood: string;
    moodEmoji: string;
    percentage: number;
    color: string;
    glowColor: string;
}

const MoodByPhase: React.FC<MoodByPhaseProps> = ({ logs, cycles }) => {
    const { t } = useTranslation();

    // Calculate mood distribution by cycle phase
    const phaseMoods = useMemo(() => {
        // Phase definitions (day ranges within a 28-day cycle)
        const phases = {
            menstrual: { name: t('trends.phase_menstrual'), range: [1, 5], icon: '🩸', iconColor: 'text-rose-500' },
            follicular: { name: t('trends.phase_follicular'), range: [6, 13], icon: '🌱', iconColor: 'text-lime-500' },
            ovulation: { name: t('trends.phase_ovulation'), range: [14, 16], icon: '✨', iconColor: 'text-amber-400' },
            luteal: { name: t('trends.phase_luteal'), range: [17, 28], icon: '🌙', iconColor: 'text-orange-400' },
        };

        const phaseMoodCounts: Record<string, Record<string, number>> = {
            menstrual: {},
            follicular: {},
            ovulation: {},
            luteal: {},
        };

        // Initialize counts for all moods
        Object.keys(phases).forEach(phase => {
            MOOD_OPTIONS.forEach(option => {
                phaseMoodCounts[phase][option.id] = 0;
            });
        });

        // Go through each cycle and count moods by phase
        cycles.forEach(cycle => {
            const [y, m, d] = cycle.startDate.split('-').map(Number);
            const cycleStart = new Date(y, m - 1, d);
            const cycleLength = cycle.length || 28;

            for (let dayNum = 1; dayNum <= cycleLength; dayNum++) {
                const date = new Date(cycleStart);
                date.setDate(date.getDate() + (dayNum - 1));
                const dateStr = toLocalISOString(date);
                const log = logs[dateStr];

                if (log?.mood) {
                    // Determine which phase this day belongs to
                    // Normalize to 28-day cycle
                    const normalizedDay = Math.round((dayNum / cycleLength) * 28);

                    let phaseKey = 'luteal';
                    for (const [key, phase] of Object.entries(phases)) {
                        if (normalizedDay >= phase.range[0] && normalizedDay <= phase.range[1]) {
                            phaseKey = key;
                            break;
                        }
                    }

                    const logMoods = Array.isArray(log.mood) ? log.mood : [log.mood];
                    logMoods.forEach(m => {
                        if (phaseMoodCounts[phaseKey] && phaseMoodCounts[phaseKey][m] !== undefined) {
                            phaseMoodCounts[phaseKey][m]++;
                        }
                    });
                }
            }
        });

        // Calculate dominant mood for each phase
        const results: PhaseMood[] = [];

        for (const [phaseKey, phaseData] of Object.entries(phases)) {
            const counts = phaseMoodCounts[phaseKey];
            const total = Object.values(counts).reduce((a, b) => a + b, 0);

            if (total === 0) {
                results.push({
                    phase: phaseData.name,
                    icon: phaseData.icon,
                    iconColor: phaseData.iconColor,
                    dominantMood: t('trends.no_data'),
                    moodEmoji: '—',
                    percentage: 0,
                    color: '#94a3b8', // slate-400 equivalent
                    glowColor: 'transparent'
                });
                continue;
            }

            // Find dominant mood
            let maxMood = MOOD_OPTIONS[0].id;
            let maxCount = -1;

            for (const [mood, count] of Object.entries(counts)) {
                if (count > maxCount) {
                    maxMood = mood as any; // safe cast as we initialized from options
                    maxCount = count;
                }
            }

            const percentage = Math.round((maxCount / total) * 100);
            const moodConfig = MOOD_OPTIONS.find(opt => opt.id === maxMood) || MOOD_OPTIONS[0];

            results.push({
                phase: phaseData.name,
                icon: phaseData.icon,
                iconColor: phaseData.iconColor,
                dominantMood: t(moodConfig.labelKey),
                moodEmoji: moodConfig.emoji,
                percentage,
                color: moodConfig.color, // Return hex directly
                glowColor: moodConfig.shadow
            });
        }

        return results;
    }, [logs, cycles]);

    if (cycles.length === 0) {
        return (
            <div className="bg-[#F0F2F5] rounded-[40px] p-8" style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}>
                <h3 className="text-sm font-extrabold tracking-[0.15em] text-slate-800 uppercase">{t('trends.mood_by_phase')}</h3>
                <p className="text-slate-400 text-sm text-center py-8">{t('trends.need_data_mood')}</p>
            </div>
        );
    }

    return (
        <div className="bg-[#F0F2F5] rounded-[32px] p-6" style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}>
            {/* Header - stacked for better mobile alignment */}
            <div className="flex flex-col gap-1 mb-6">
                <h2 className="text-sm font-extrabold tracking-[0.15em] text-slate-800 uppercase">
                    {t('trends.mood_by_phase')}
                </h2>
                <span className="text-xs font-medium text-slate-400">
                    {t('trends.mood_emotional_patterns')}
                </span>
            </div>

            {/* 2x2 Grid */}
            <div className="grid grid-cols-2 gap-4">
                {phaseMoods.map((phaseData) => (
                    <div
                        key={phaseData.phase}
                        className="p-4 rounded-2xl bg-[#F0F2F5] flex flex-col gap-3"
                        style={{ boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.8)' }}
                    >
                        {/* Phase Icon & Label */}
                        <div className="flex items-center gap-2">
                            <span className="text-base">{phaseData.icon}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                {phaseData.phase}
                            </span>
                        </div>

                        {/* Mood Info - left aligned */}
                        <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">{phaseData.moodEmoji}</span>
                            <span className="text-sm font-bold" style={{ color: phaseData.color }}>
                                {phaseData.dominantMood}
                            </span>
                        </div>

                        {phaseData.percentage > 0 && (
                            <p className="text-[10px] text-slate-400 font-medium">
                                {t('trends.percentage_of_time', { count: phaseData.percentage })}
                            </p>
                        )}

                        {/* Progress Bar */}
                        {phaseData.percentage > 0 && (
                            <div
                                className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden"
                                style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.7)' }}
                            >
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${phaseData.percentage}%`,
                                        backgroundColor: phaseData.color,
                                        boxShadow: `0 0 6px ${phaseData.glowColor}`
                                    }}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer Insight */}
            <div className="mt-8 text-center px-2">
                <p className="text-slate-400 text-[11px] leading-relaxed">
                    {t('trends.biology_insight')}
                </p>
            </div>
        </div>
    );
};

export default MoodByPhase;
