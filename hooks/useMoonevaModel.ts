import { useMemo, useCallback } from 'react';
import { DailyLog, AppSettings, Cycle, PredictionResults, DayMeta, PeriodRecord } from '../types';
import { getPastCycles, getCyclePredictions } from '../services/logic';
import { toLocalISOString, addDays, diffInDays } from '../utils/dateUtils';
import { calculateCycleStatus } from '../services/logic/status';
import { useTranslation } from 'react-i18next';

export interface MoonevaModel {
    // Data
    cycles: Cycle[];
    predictions: PredictionResults;

    // Helpers
    getDayMeta: (dateStr: string) => DayMeta;

    // Exposed model properties
    lastPeriodStart: string | null;
    predictionAnchorStart: string | null;
}

/**
 * Unified model hook.
 * Encapsulates all domain logic by composing specialized hooks.
 */
export const useMoonevaModel = (
    logs: Record<string, DailyLog>,
    periods: PeriodRecord[],
    settings: AppSettings
): MoonevaModel => {
    const { t } = useTranslation();

    // 1. History (Past)
    const cycles = useMemo(() => {
        return getPastCycles(periods, settings.historyArchivedDate, settings.lutealPhaseLength);
    }, [periods, settings.historyArchivedDate, settings.lutealPhaseLength]);

    // 2. Predictions (Future)
    const predictions = useMemo(() => {
        return getCyclePredictions(
            periods,
            {
                cycleLength: settings.cycleLength,
                periodLength: settings.periodLength,
                lutealPhaseLength: settings.lutealPhaseLength,
                pmsLength: settings.pmsLength,
                isPaused: settings.predictionsPaused,
                isOnBirthControl: settings.isOnBirthControl,
                showFertileWindow: settings.showFertileWindow,
                adaptivePrediction: settings.adaptivePrediction
            },
            settings.historyArchivedDate,
            6 // Predict 6 months ahead for Calendar
        );
    }, [periods, settings]);

    // 3. Day Meta Factory (The single source of truth for UI data)
    const getDayMeta = useCallback((dateStr: string): DayMeta => {
        const log = logs[dateStr];
        const todayStr = toLocalISOString(new Date());

        const isCycleStart = periods.some(p => p.startDate === dateStr);

        // Explicit Period Check
        const activePeriod = periods.find(p => {
            const end = addDays(p.startDate, p.days - 1);
            return dateStr >= p.startDate && dateStr <= end;
        });

        const isInsidePeriod = !!activePeriod;
        let isBleeding = false;
        if (activePeriod) {
            if (activePeriod.activeDays) {
                const dayIdx = diffInDays(dateStr, activePeriod.startDate);
                isBleeding = activePeriod.activeDays.includes(dayIdx);
            } else {
                // If no activeDays stored, assume all days in span are bleeding (legacy/default)
                isBleeding = true;
            }
        }

        // Check for trailing spotting that should extend the period
        // If spotting is logged immediately after a period ends, treat it as part of that period
        const findTrailingSpottingPeriod = (
            dateStr: string,
            logs: Record<string, DailyLog>,
            periods: PeriodRecord[]
        ): PeriodRecord | null => {
            let checkDate = dateStr;
            let daysBack = 0;
            const maxSpottingChain = 7;

            while (daysBack < maxSpottingChain) {
                const prevDate = addDays(checkDate, -1);
                const prevLog = logs[prevDate];

                // Check if prevDate is the end of a period
                const periodEndingYesterday = periods.find(p => {
                    const end = addDays(p.startDate, p.days - 1);
                    return prevDate === end;
                });

                if (periodEndingYesterday) return periodEndingYesterday;

                // If prevDate was also spotting, continue checking back
                if (prevLog?.flow === 'spotting') {
                    checkDate = prevDate;
                    daysBack++;
                } else {
                    break;
                }
            }
            return null;
        };

        // ... inside getDayMeta ...
        // Check for trailing spotting that should extend the period
        // If spotting is logged immediately after a period ends, treat it as part of that period
        let trailingSpottingPeriod: PeriodRecord | null = null;
        if (!isInsidePeriod && log?.flow === 'spotting') {
            trailingSpottingPeriod = findTrailingSpottingPeriod(dateStr, logs, periods);
        }

        const isTrailingSpotting = !!trailingSpottingPeriod;

        const meta: DayMeta = {
            date: dateStr,
            isToday: dateStr === todayStr,
            isValidMonth: true,
            isPeriod: isInsidePeriod || isTrailingSpotting,
            isBleeding: isBleeding || isTrailingSpotting,
            isCycleStart,
            isSpotting: log?.flow === 'spotting', // Show spotting indicator even for period-extension days
            isForecastPeriod: false,
            isFertile: false,
            isOvulation: false,
            isPMS: false,
            isUnavailableFuture: diffInDays(dateStr, todayStr) > 7,
            // Period tracking
            periodId: activePeriod?.id || trailingSpottingPeriod?.id,
            isWithdrawalBleed: activePeriod?.isWithdrawalBleed || trailingSpottingPeriod?.isWithdrawalBleed,
            intensity: log?.flow,
            symptoms: log?.symptoms,
            mood: log?.mood ? (Array.isArray(log.mood) ? log.mood : [log.mood]) : []
        };

        // Calculate Day of Period if active
        if (meta.isPeriod) {
            if (activePeriod) {
                const diff = Math.floor((new Date(dateStr).getTime() - new Date(activePeriod.startDate).getTime()) / (86400000)) + 1;
                meta.dayOfPeriod = diff;
            } else if (trailingSpottingPeriod) {
                // For trailing spotting, calculate day relative to the period it extends
                const periodActiveDays = trailingSpottingPeriod.activeDays?.length || trailingSpottingPeriod.days;
                const daysAfterPeriod = diffInDays(dateStr, addDays(trailingSpottingPeriod.startDate, trailingSpottingPeriod.days - 1));
                meta.dayOfPeriod = periodActiveDays + daysAfterPeriod;
            }
        }


        // Overlay Historical Fertile Window
        if (!settings.isOnBirthControl && settings.showFertileWindow) {
            cycles.forEach(cycle => {
                if (cycle.isOutlier) return; // Skip outliers

                if (cycle.fertileStart && cycle.fertileEnd) {
                    if (dateStr >= cycle.fertileStart && dateStr <= cycle.fertileEnd) {
                        meta.isFertile = true;
                    }
                }
                if (cycle.ovulationDate === dateStr) {
                    meta.isOvulation = true;
                }
            });
        }

        // Overlay Predictions
        if (!settings.predictionsPaused) {
            if (predictions.nextPeriodStart && predictions.nextPeriodEnd) {
                if (dateStr >= predictions.nextPeriodStart && dateStr <= predictions.nextPeriodEnd) {
                    meta.isForecastPeriod = true;
                }
            }

            predictions.futurePredictions?.forEach(fp => {
                if (dateStr >= fp.startDate && dateStr <= fp.endDate) meta.isForecastPeriod = true;
                if (fp.ovulationDate === dateStr) meta.isOvulation = true;
                if (!settings.isOnBirthControl && settings.showFertileWindow) {
                    if (fp.fertileStart && fp.fertileEnd && dateStr >= fp.fertileStart && dateStr <= fp.fertileEnd) {
                        meta.isFertile = true;
                    }
                }
            });

            if (!settings.isOnBirthControl && settings.showFertileWindow && predictions.fertileWindow) {
                if (dateStr >= predictions.fertileWindow.start && dateStr <= predictions.fertileWindow.end) {
                    meta.isFertile = true;
                }
            }
            if (predictions.ovulationDate === dateStr) meta.isOvulation = true;

            if (predictions.pmsWindow) {
                if (dateStr >= predictions.pmsWindow.start && dateStr <= predictions.pmsWindow.end) {
                    meta.isPMS = true;
                }
            }
        }

        // Calculate Anchor Date (Correct Cycle Start) for this specific view date
        // Instead of always using "lastPeriodStart" (which is global latest),
        // we find the latest period that started ON or BEFORE the view date.
        // This fixes negative cycle days when viewing dates before a future period.
        const anchorPeriod = periods
            .filter(p => p.startDate <= dateStr)
            .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

        const anchorDate = anchorPeriod ? anchorPeriod.startDate : undefined;

        // Attach Header Status
        meta.header = calculateCycleStatus(meta, predictions, settings, t, anchorDate);

        return meta;
    }, [logs, periods, settings, cycles, predictions, t]);

    return {
        cycles,
        predictions,
        getDayMeta,
        lastPeriodStart: predictions.lastPeriodStart,
        predictionAnchorStart: predictions.lastPeriodStart
    };
};
