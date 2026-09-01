import { useMemo, useCallback, useEffect, useState } from 'react';
import { DailyLog, AppSettings, Cycle, PredictionResults, DayMeta, PeriodRecord } from '../types';
import { getPastCycles, getCyclePredictions } from '../services/logic';
import { toLocalISOString, addDays, diffInDays } from '../utils/dateUtils';
import { calculateCycleStatus, computeDayOfCycle } from '../services/logic/status';
import type { CycleStatusData } from '../services/logic/status';
import { useTranslation } from 'react-i18next';

/**
 * Spotting logged right after a period ends extends that period. Hoisted out of
 * getDayMeta: it captures nothing, and re-creating it per call meant one closure
 * allocation for every calendar cell on every render.
 */
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

        const periodEndingYesterday = periods.find(p =>
            prevDate === addDays(p.startDate, p.days - 1));
        if (periodEndingYesterday) return periodEndingYesterday;

        if (prevLog?.flow === 'spotting') {
            checkDate = prevDate;
            daysBack++;
        } else {
            break;
        }
    }
    return null;
};

/**
 * Latest period starting on or before dateStr. A single pass rather than
 * filter().sort()[0]: same answer, no sortedness assumption, and no two throwaway
 * arrays per calendar cell.
 */
const findAnchorStart = (periods: PeriodRecord[], dateStr: string): string | undefined => {
    let anchor: string | undefined;
    for (const p of periods) {
        if (p.startDate <= dateStr && (anchor === undefined || p.startDate > anchor)) {
            anchor = p.startDate;
        }
    }
    return anchor;
};

export interface MoonevaModel {
    // Data
    cycles: Cycle[];
    predictions: PredictionResults;

    // Helpers
    getDayMeta: (dateStr: string) => DayMeta;
    /** Full localized status for one day. Only the dashboard header needs this;
     *  calendar cells read meta.dayOfCycle instead. */
    getDayStatus: (dateStr: string) => CycleStatusData;

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

    // getDayMeta reads new Date() fresh on every call, so isToday is always
    // correct *when called* - but nothing re-renders the app at midnight on
    // its own, so a screen left open overnight keeps showing yesterday's
    // isToday until some unrelated state change happens to trigger a
    // re-render. This state ticks once at the next local midnight (and
    // reschedules itself) purely to force that re-render.
    const [todayStr, setTodayStr] = useState(() => toLocalISOString(new Date()));
    useEffect(() => {
        const now = new Date();
        const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
        const timer = setTimeout(() => {
            setTodayStr(toLocalISOString(new Date()));
        }, nextMidnight.getTime() - now.getTime());
        return () => clearTimeout(timer);
    }, [todayStr]);

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
            isBleeding, // strict: excludes trailing spotting (isFullFlowDay excludes it too)
            isPeriodSpan: isBleeding || isTrailingSpotting,
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
            mood: log?.mood ?? []
        };

        // Calculate Day of Period if active
        if (meta.isPeriod) {
            if (activePeriod) {
                meta.dayOfPeriod = diffInDays(dateStr, activePeriod.startDate) + 1;
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

            if (settings.showPMS && predictions.pmsWindow) {
                if (dateStr >= predictions.pmsWindow.start && dateStr <= predictions.pmsWindow.end) {
                    meta.isPMS = true;
                }
            }
        }

        // Anchor on the latest period starting on or before this date, not the global
        // latest, so dates before a future period don't get negative cycle days.
        // Cells only need the day number; the full status is getDayStatus below.
        if (!settings.predictionsPaused && !predictions.isStale) {
            meta.dayOfCycle = computeDayOfCycle(
                dateStr,
                findAnchorStart(periods, dateStr) ?? predictions.lastPeriodStart,
                predictions.cycleLengthUsed || predictions.effective?.cycleLength || 28,
                todayStr
            );
        }

        return meta;
    }, [logs, periods, settings, cycles, predictions, t, todayStr]);

    const getDayStatus = useCallback((dateStr: string): CycleStatusData => {
        const anchorDate = findAnchorStart(periods, dateStr);
        return calculateCycleStatus(getDayMeta(dateStr), predictions, settings, t, anchorDate);
    }, [getDayMeta, periods, predictions, settings, t]);

    return useMemo(() => ({
        cycles,
        predictions,
        getDayMeta,
        getDayStatus,
        lastPeriodStart: predictions.lastPeriodStart,
        predictionAnchorStart: predictions.lastPeriodStart
    }), [cycles, predictions, getDayMeta, getDayStatus]);
};
