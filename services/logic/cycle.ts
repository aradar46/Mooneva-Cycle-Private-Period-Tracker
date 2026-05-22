import { DailyLog, Cycle, PeriodRecord } from '../../types';

// --- Constants ---
const MIN_CYCLE_LENGTH = 18;
const MAX_CYCLE_LENGTH = 45;
/** Cycles longer than this are treated as tracking gaps (e.g. 153 days); excluded from averages, fertile hidden in UI */
const OUTLIER_THRESHOLD_DAYS = 60;
/** Max cycle length included in averages and eligible for prediction (long-normal 36–60 days) */
const MAX_ELIGIBLE_CYCLE_DAYS = 60;
export const MIN_GAP_DAYS = 3;
export const CYCLE_GAP_THRESHOLD_DAYS = 2;

// --- Date Utils ---
import { addDays, diffInDays } from '../../utils/dateUtils';


// --- Predicates ---
export const isAnyFlowDay = (log: DailyLog): boolean => {
    if (!log) return false;
    if ((log as any).isPeriod) return true; // Legacy support
    return !!log.flow;
};

export const isFullFlowDay = (log: DailyLog): boolean => {
    if (!log) return false;
    if ((log as any).isPeriod) return true; // Legacy support
    const hasFlow = !!log.flow;
    const isSpotting = log.flow === 'spotting';
    return hasFlow && !isSpotting;
};

// --- Period Utils ---
export const findNearbyPeriod = (
    targetDate: string,
    periods: PeriodRecord[],
    maxGap: number = MIN_GAP_DAYS
): PeriodRecord | null => {
    for (const period of periods) {
        const periodEnd = addDays(period.startDate, period.days - 1);
        const gapAfterPeriod = diffInDays(targetDate, periodEnd);
        if (gapAfterPeriod > 0 && gapAfterPeriod <= maxGap + 1) {
            return period;
        }
        const gapBeforePeriod = diffInDays(period.startDate, targetDate);
        if (gapBeforePeriod > 0 && gapBeforePeriod <= maxGap + 1) {
            return period;
        }
    }
    return null;
};







// Adaptive Prediction Constants
const MIN_ADAPTIVE_CYCLES = 3;

/**
 * Normalizes and clamps cycle length to medically typical ranges (21-45 days).
 */
/**
 * Generic helper to clamp and round a value within a range.
 */
const clampAndRound = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, Math.round(value)));
};

/**
 * Normalizes and clamps cycle length to medically typical ranges (21-45 days).
 */
const normalizeCycleLength = (length: number): number => clampAndRound(length, MIN_CYCLE_LENGTH, MAX_CYCLE_LENGTH);

/**
 * Normalizes and clamps period length to typical ranges (1-10 days).
 */
const normalizePeriodLength = (length: number): number => clampAndRound(length, 1, 10);



/**
 * True if cycle length indicates a tracking gap (e.g. 153 days); exclude from averages, hide fertile in UI.
 */
const isCycleOutlier = (length: number): boolean =>
    length > OUTLIER_THRESHOLD_DAYS;

/**
 * True if cycle is eligible for averages and fertile display (21–60 days: normal, short, long-normal).
 */
const isCycleEligibleForAverage = (length: number): boolean =>
    length >= MIN_CYCLE_LENGTH && length <= MAX_ELIGIBLE_CYCLE_DAYS;



/**
 * Calculates past cycles based on EXPLICIT Period Records.
 * 
 * @param periods - List of PeriodRecord entities
 * @param archivedBeforeDate - Optional date to filter out old cycles
 */
export const getPastCycles = (
    periods: PeriodRecord[],
    archivedBeforeDate?: string,
    lutealPhaseLength?: number
): Cycle[] => {
    // Sort Oldest -> Newest to iterate chronologically
    const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));

    // Filter archived
    const filtered = archivedBeforeDate
        ? sorted.filter(p => p.startDate >= archivedBeforeDate)
        : sorted;

    if (filtered.length < 1) return [];

    const cycles: Cycle[] = [];
    for (let i = 0; i < filtered.length - 1; i++) {
        const current = filtered[i];
        const next = filtered[i + 1];

        // Use stored cycleLength if available, otherwise compute from gap
        const cycleLength = current.cycleLength ?? diffInDays(next.startDate, current.startDate);

        // Use active bleeding days count for periodLength, keep full span for display
        const periodDuration = current.activeDays
            ? current.activeDays.length
            : normalizePeriodLength(current.days);
        const spanDays = current.days;

        const isOutlier = isCycleOutlier(cycleLength);
        const isValid = isCycleEligibleForAverage(cycleLength);

        // Calculate historical fertile window (if valid/not outlier)
        let ovulationDate: string | undefined;
        let fertileStart: string | undefined;
        let fertileEnd: string | undefined;

        if (isOutlier || cycleLength < MIN_CYCLE_LENGTH) {
            // Explicitly clear prediction data for outliers and too-short cycles
            ovulationDate = undefined;
            fertileStart = undefined;
            fertileEnd = undefined;
        } else if (lutealPhaseLength) {
            // Next period start is next.startDate
            // Ovulation = Next Period Start - Luteal
            ovulationDate = addDays(next.startDate, -lutealPhaseLength);
            fertileStart = addDays(ovulationDate, -5);
            fertileEnd = addDays(ovulationDate, 1);
        }

        cycles.push({
            startDate: current.startDate,
            endDate: addDays(current.startDate, spanDays - 1),
            length: cycleLength,
            periodLength: periodDuration,
            spanDays,
            isOutlier,
            isValid,
            isWithdrawalBleed: current.isWithdrawalBleed,
            ignoreForAverages: current.ignoreForAverages,
            ovulationDate,
            fertileStart,
            fertileEnd
        });
    }

    return cycles;
};



/**
 * Filters past cycles to find "eligible" ones for adaptive prediction.
 * Criteria: length between 21 and 60 days (excludes gap cycles > 60).
 * Also excludes cycles marked as withdrawal bleeds (birth control).
 */
export const getEligibleCycles = (cycles: Cycle[]): Cycle[] => {
    return cycles.filter(c => {
        if (!c.length) return false;
        if (c.isOutlier) return false;
        if (c.isWithdrawalBleed) return false; // Exclude birth control cycles
        if (c.ignoreForAverages) return false; // Exclude manually ignored cycles
        return isCycleEligibleForAverage(c.length);
    });
};

/**
 * Computes adaptive cycle and period lengths dynamically from history.
 * Logic:
 * - Use last N (9, 6, 3) eligible cycles.
 * - Trimmed mean if N >= 6.
 * - Simple mean if N = 3.
 */
export const computeAdaptiveLengths = (eligibleCycles: Cycle[]) => {
    // We need at least 3 cycles to be safe
    if (eligibleCycles.length < MIN_ADAPTIVE_CYCLES) return null;

    // User-Intent Model: Simple Mean of last 3 cycles
    const recent = eligibleCycles.slice(-3);

    const getSimpleMean = (values: number[]) => {
        return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    };

    const cycleLengths = recent.map(c => c.length || 28);
    const periodLengths = recent.map(c => Math.max(1, Math.min(10, c.periodLength || 5)));

    const adaptiveCycle = getSimpleMean(cycleLengths);
    const adaptivePeriod = getSimpleMean(periodLengths);

    return {
        cycleLength: adaptiveCycle,
        periodLength: adaptivePeriod,
        source: 'adaptive' as const
    };
};

/**
 * Generates cycle predictions based on logged data and user settings.
 */
export const getCyclePredictions = (
    periods: PeriodRecord[],
    settings: {
        cycleLength: number;
        periodLength: number;
        lutealPhaseLength: number;
        pmsLength: number;
        isPaused: boolean;
        isOnBirthControl: boolean;
        showFertileWindow: boolean;
        adaptivePrediction?: boolean;
    },
    archivedBeforeDate?: string,
    futureMonthsToPredict: number = 0
) => {
    // Helper for empty/paused states
    const emptyMeta = {
        effective: {
            cycleLength: settings.cycleLength,
            periodLength: settings.periodLength,
            source: 'settings' as const
        },
        userSettings: {
            cycleLength: settings.cycleLength,
            periodLength: settings.periodLength
        }
    };

    if (settings.isPaused) {
        return {
            lastPeriodStart: null,
            nextPeriodStart: null,
            nextPeriodEnd: null,
            fertileWindow: null,
            pmsWindow: null,
            ovulationDate: null,
            periodLength: settings.periodLength || 5, // Placeholder for strict mode
            cycleLengthUsed: settings.cycleLength || 28, // Placeholder for strict mode
            healthStatus: 'paused',
            futurePredictions: [],
            ...emptyMeta
        };
    }

    // 1. Get Sorted Periods (Newest First)
    // Note: arrays are usually Oldest->Newest. Reverse for "Latest" access.
    const sortedPeriods = [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate)); // Descending

    if (sortedPeriods.length === 0) {
        return {
            lastPeriodStart: null, nextPeriodStart: null, nextPeriodEnd: null,
            fertileWindow: null, pmsWindow: null, ovulationDate: null,
            periodLength: settings.periodLength || 5,
            cycleLengthUsed: settings.cycleLength || 28,
            healthStatus: 'empty',
            futurePredictions: [],
            ...emptyMeta
        };
    }

    // 2. Forecast Next Cycle
    const lastPeriod = sortedPeriods[0]; // Newest

    // --- Adaptive Logic ---
    let forecastedCycleLength = settings.cycleLength;
    let forecastedPeriodLength = settings.periodLength;
    let predictionSource: 'settings' | 'adaptive' = 'settings';

    if (settings.adaptivePrediction && !settings.isOnBirthControl) {
        // Selection Rule: filter first, then takeLast
        const pastCycles = getPastCycles(periods, archivedBeforeDate);
        const eligible = getEligibleCycles(pastCycles);
        const adaptive = computeAdaptiveLengths(eligible);

        if (adaptive) {
            forecastedCycleLength = normalizeCycleLength(adaptive.cycleLength);
            forecastedPeriodLength = normalizePeriodLength(adaptive.periodLength);
            predictionSource = adaptive.source;
        }
    }
    // Constants for return
    const effectiveCycleLength = forecastedCycleLength;
    const effectivePeriodLength = forecastedPeriodLength;

    // Note: Adaptive or Settings 
    // Predictions now rely on either strictly user settings or strictly adaptive history.

    // 3. Construct Prediction Results
    const nextPeriodStart = addDays(lastPeriod.startDate, effectiveCycleLength);
    // Use effectiveLength
    const nextPeriodEnd = addDays(nextPeriodStart, effectivePeriodLength - 1);

    // Update periods[0] projected length for replica consistency if needed, 
    // although replica isn't used for the main calc anymore.
    // However, if we want the calendar cells to match, we might need to update replica.ts too 
    // or just trust that `cycleLengthUsed` returned here overrides UI display.

    const ovulationDateStr = addDays(nextPeriodStart, -settings.lutealPhaseLength);

    const healthStatus = 'standard'; // simplified for now

    // Future Chain
    const futurePredictions = [];
    if (futureMonthsToPredict > 0) {
        let currentStart = nextPeriodStart;
        for (let i = 0; i < futureMonthsToPredict; i++) {
            // For future, use effective setting
            const pStart = addDays(currentStart, effectiveCycleLength);

            // Safety: Don't project if we are already in outlier territory (e.g. extremely long cycle setting)
            // But here we rely on effectiveCycleLength which is clamped. 
            // Just ensure we don't project indefinitely if something is broken.

            const pEnd = addDays(pStart, effectivePeriodLength - 1);
            const ov = addDays(pStart, -settings.lutealPhaseLength);

            futurePredictions.push({
                startDate: pStart,
                endDate: pEnd,
                ovulationDate: ov,
                fertileStart: addDays(ov, -5),
                fertileEnd: addDays(ov, 1),
                pmsStart: addDays(pStart, -settings.pmsLength),
                pmsEnd: addDays(pStart, -1)
            });
            currentStart = pStart;
        }
    }

    return {
        lastPeriodStart: lastPeriod.startDate,
        periodLength: effectivePeriodLength,
        cycleLengthUsed: effectiveCycleLength,
        effective: {
            cycleLength: effectiveCycleLength,
            periodLength: effectivePeriodLength,
            source: predictionSource
        },
        userSettings: {
            cycleLength: settings.cycleLength,
            periodLength: settings.periodLength
        },
        nextPeriodStart,
        nextPeriodEnd,
        fertileWindow: (settings.isOnBirthControl || !settings.showFertileWindow) ? null : {
            start: addDays(ovulationDateStr, -5),
            end: addDays(ovulationDateStr, 1)
        },
        ovulationDate: (settings.isOnBirthControl || !settings.showFertileWindow) ? null : ovulationDateStr,
        pmsWindow: {
            start: addDays(nextPeriodStart, -settings.pmsLength),
            end: addDays(nextPeriodStart, -1)
        },
        healthStatus,
        futurePredictions: (settings.isOnBirthControl || !settings.showFertileWindow)
            ? futurePredictions.map(p => ({ ...p, ovulationDate: null, fertileStart: null, fertileEnd: null }))
            : futurePredictions
    };
};
