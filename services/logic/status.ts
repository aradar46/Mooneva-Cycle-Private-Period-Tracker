import type { TFunction } from 'i18next';
import { AppSettings, PredictionResults, DayMeta } from '../../types';
import { addDays, diffInDays, toLocalISOString } from '../../utils/dateUtils';

export interface CycleStatusData {
    title: string;
    subtitle: string;
    chance?: string;
    chanceVariant?: 'low' | 'medium' | 'high' | 'peak';
    statusVariant?: 'neutral' | 'warning' | 'primary' | 'success' | 'info' | 'secondary';
    dayOfCycle?: number;
    cycleLength?: number;
    /** True when `title` is the "Day N" headline, so the view can render N/total
     *  through one translated template instead of gluing "/total" on the end. */
    titleIsCycleDay?: boolean;
    dayOfPeriod?: number;
    periodLength?: number;
}

/**
 * Pure mapping of DayMeta into localized Header labels.
 * 
 * UX-Optimized Color Logic:
 * - Primary (Rose): Active period - healthy, normal function
 * - Warning (Amber): Period late/due - requires attention
 * - Success (Teal): Fertile window - actionable for TTC users
 * - Info (Blue): Approaching period - informational
 * - Secondary (Purple): Normal cycle days
 * - Neutral (Gray): No data or paused
 */
/**
 * Which day of the cycle `dateStr` is, or undefined when there is no usable anchor.
 * Shared so the calendar badge and the header agree by construction - the badge needs
 * only this number, not the full status, and paying for the whole status (i18n lookups,
 * fertility bands, phase labels) on all 42 cells of a month was the reason it was split.
 */
export const computeDayOfCycle = (
    dateStr: string,
    anchorStart: string | null | undefined,
    cycleLength: number,
    today: string
): number | undefined => {
    if (!anchorStart) return undefined;
    const raw = diffInDays(dateStr, anchorStart) + 1;
    if (raw < 1) return undefined;
    const len = cycleLength || 28;
    // Wrap only for future dates past one cycle: a genuinely long past cycle should
    // show its real day count, not a wrapped one.
    return dateStr > today && raw > len ? ((raw - 1) % len) + 1 : raw;
};

export const calculateCycleStatus = (
    meta: DayMeta,
    predictions: PredictionResults,
    settings: AppSettings,
    t: TFunction,
    anchorDate?: string // New Parameter: Specific cycle start for this view date
): CycleStatusData => {
    // 1. Terminate if predictions are paused
    if (settings.predictionsPaused) {
        return {
            title: t('dashboard.tracking_paused'),
            subtitle: t('dashboard.resume_predictions', 'Resume to see predictions'),
            statusVariant: 'neutral'
        };
    }

    // 2. Birth Control Mode: Show "Protected" instead of fertility
    if (settings.isOnBirthControl) {
        if (!predictions.lastPeriodStart) {
            return {
                title: t('dashboard.protected', 'Protected'),
                subtitle: t('dashboard.log_to_start', 'Log period to start'),
                statusVariant: 'info'
            };
        }
        // Continue with normal flow but with "Protected" context
        // The rest of the function will handle period/cycle day logic
        // but fertility will be hidden (already handled by !settings.isOnBirthControl checks)
    }

    // 3. Terminate if no data (and no anchor provided)
    // If we have an anchor, we can calculate dayOfCycle even if global lastPeriodStart is missing/different
    const effectiveStartStr = anchorDate || predictions.lastPeriodStart;

    if (!effectiveStartStr) {
        return {
            title: t('dashboard.hello', 'Hello'),
            subtitle: t('dashboard.log_to_start', 'Log period to start'),
            statusVariant: 'neutral'
        };
    }

    // --- REFACTORED PRIORITY ALGORITHM (Steps A-E) ---
    // Inputs
    const todayStr = meta.date;
    const rawDayOfCycle = diffInDays(todayStr, effectiveStartStr) + 1;
    const cycleLen = predictions.cycleLengthUsed || predictions.effective?.cycleLength || 28;

    const dayOfCycle = computeDayOfCycle(
        todayStr, effectiveStartStr, cycleLen, toLocalISOString(new Date())
    ) ?? rawDayOfCycle;

    // FIX: Handle cases where we are viewing a date BEFORE the effective period start.
    // This happens if the user is viewing a date before their first logged period (future period is the anchor).
    if (rawDayOfCycle < 1) {
        const daysUntil = diffInDays(effectiveStartStr, todayStr);
        return {
            title: t('dashboard.period_in', { count: daysUntil }),
            subtitle: t('timeline.upcoming', 'Upcoming'),
            statusVariant: 'info',
            chance: undefined,
            chanceVariant: undefined,
            dayOfCycle: undefined // No cycle day before first period
        };
    }

    const flowActive = meta.isPeriod;

    // Calculate dueInDays
    let dueInDays: number | null = null;
    let overdueDays = 0;

    if (predictions.nextPeriodStart) {
        const rawDays = diffInDays(predictions.nextPeriodStart, todayStr);

        if (rawDays < 0) {
            overdueDays = Math.abs(rawDays);
        } else {
            dueInDays = rawDays;
        }
    }

    // Days from predicted ovulation (negative = before, 0 = ovulation day).
    // Ovulation is anchored to the next period minus the luteal length: the luteal
    // phase is the stable part of the cycle, the follicular phase absorbs variation.
    //
    // For a date past nextPeriodStart, anchor to the future cycle that actually
    // contains it. Measuring everything against the single next period leaves
    // ovulationDiff positive forever, so every far-out day reads "luteal" while
    // dayOfCycle has already wrapped - the card contradicts itself.
    let ovulationDiff: number | null = null;
    const anchorPeriodStart = (() => {
        if (!predictions.nextPeriodStart) return null;
        if (todayStr <= predictions.nextPeriodStart) return predictions.nextPeriodStart;
        const upcoming = predictions.futurePredictions?.find(p => todayStr <= p.startDate);
        return upcoming?.startDate ?? predictions.nextPeriodStart;
    })();
    if (anchorPeriodStart) {
        const ovulationDateStr = addDays(anchorPeriodStart, -(settings.lutealPhaseLength || 14));
        ovulationDiff = diffInDays(todayStr, ovulationDateStr);
    }

    // Determine Fertility Band
    type FertilityBand = 'none' | 'fertile' | 'peak';
    let fertilityBand: FertilityBand = 'none';

    // Fertile window: 5 days before ovulation through ovulation day. Sperm survive ~5
    // days, the oocyte ~12-24h, so the window closes at ovulation. Peak = the two days
    // before ovulation plus ovulation day (highest conception probability).
    if (settings.showFertileWindow && !settings.isOnBirthControl
        && ovulationDiff !== null && ovulationDiff >= -5 && ovulationDiff <= 0) {
        fertilityBand = ovulationDiff >= -2 ? 'peak' : 'fertile';
    }

    const fertilityEnabled = settings.showFertileWindow && !settings.isOnBirthControl;

    // --- Step B: Hard Override (Late) ---
    // A forecast built on a months-old record isn't a late period, it's missing data.
    // Say so instead of printing an overdue count nobody should act on.
    if (predictions.isStale) {
        return {
            title: t('dashboard.no_recent_data', 'No recent data'),
            subtitle: t('dashboard.log_to_resume', 'Log a period to resume predictions'),
            statusVariant: 'neutral',
            dayOfCycle: undefined
        };
    }

    // 2. Late
    if (overdueDays > 0) {
        // Late overrides basic card AND hides fertility
        const title = t('dashboard.period_late');
        const subtitle = t('common.days_overdue', { count: overdueDays });
        const variant = 'warning' as const;

        return {
            title,
            subtitle,
            statusVariant: variant,
            chance: undefined, // Hidden
            chanceVariant: undefined,
            dayOfCycle,
            cycleLength: predictions.cycleLengthUsed || 28
        };
    }

    // --- Step C: Determine Base Period Timing Card ---
    // Cycle phase in order: follicular -> ovulation -> luteal -> PMS. PMS is the tail
    // of the luteal phase, not a phase of its own, so it is checked after ovulation and
    // bounded by the same pmsWindow/showPMS the calendar uses. Menstrual days show the
    // period-progress row instead of a phase name.
    const phaseLabel = (): string => {
        // Ovulation is only named when fertility is shown at all (hidden on birth control).
        if (fertilityEnabled && ovulationDiff === 0) return t('dashboard.ovulation_day');
        if (settings.showPMS && dueInDays !== null
            && dueInDays >= 1 && dueInDays <= (settings.pmsLength ?? 3)) return t('dashboard.pms_phase');
        if (ovulationDiff !== null && ovulationDiff >= 0) return t('dashboard.luteal_phase');
        return t('dashboard.follicular_phase');
    };

    let baseTitle = t('dashboard.cycle_day', { day: dayOfCycle });
    let baseTitleIsCycleDay = true;
    let baseSubtitle = phaseLabel();
    let baseVariant: CycleStatusData['statusVariant'] = 'secondary';
    let baseDayOfPeriod: number | undefined = undefined;
    let basePeriodLength: number | undefined = undefined;

    if (flowActive) {
        // 4. Flow Active
        baseTitle = t('dashboard.cycle_day', { day: dayOfCycle }); // Or 'Period: Day X'
        baseSubtitle = t('dashboard.flow_logged');
        baseVariant = 'primary';
        baseDayOfPeriod = meta.dayOfPeriod;
        basePeriodLength = predictions.periodLength || settings.periodLength || 5;
    } else if (dueInDays === 0) {
        // 5. Due Today
        baseTitle = t('dashboard.period_due', 'Period Due');
        baseTitleIsCycleDay = false;
        baseSubtitle = t('dashboard.expected_today', 'Expected Today');
        baseVariant = 'warning';
    } else if (dueInDays === 1) {
        // 6. Due Tomorrow
        baseTitle = t('dashboard.period_soon');
        baseTitleIsCycleDay = false;
        baseSubtitle = t('dashboard.expected_tomorrow');
        baseVariant = 'info';
    } else if (dueInDays !== null && dueInDays >= 2 && dueInDays <= 3) {
        // 7. Due in 2-3 Days
        baseTitle = t('dashboard.period_in', { count: dueInDays });
        baseTitleIsCycleDay = false;
        baseSubtitle = phaseLabel();
        baseVariant = 'secondary';
    } else {
        // 8. Normal Phase
        baseTitle = t('dashboard.cycle_day', { day: dayOfCycle });
        baseSubtitle = phaseLabel();
        baseVariant = 'secondary';
    }

    // --- Step D: Fertility Overlay Rules ---
    const hasFertility = fertilityEnabled && (fertilityBand === 'fertile' || fertilityBand === 'peak');
    let finalTitle = baseTitle;
    let finalTitleIsCycleDay = baseTitleIsCycleDay;
    let finalSubtitle = baseSubtitle;
    let finalVariant: CycleStatusData['statusVariant'] = baseVariant;

    // 9. Overlay: fertile AND NOT flow active AND NOT due today
    // 10. Overlay: fertile AND (flow active OR due soon) -> Overlap wins for fertility
    // Basically: If hasFertility is true, it pretty much wins unless system gated.
    // The prompt says:
    // Rule 9: If hasFertility AND NOT flowActive AND NOT (dueInDays == 0) -> Replace.
    // Rule 10: If hasFertility AND (flowActive OR dueInDays in 0..3) -> Also replace.
    // This implies 'hasFertility' ALWAYS wins if we are not Late/Paused.

    if (hasFertility) {
        finalTitle = t('dashboard.cycle_day', { day: dayOfCycle });
        finalTitleIsCycleDay = true;
        // Append rather than replace: the phase stays the headline, fertility qualifies it.
        finalSubtitle = `${baseSubtitle} (${t('dashboard.fertile_window')})`;
        finalVariant = 'success';
    }


    // --- Step E: Fertility Label Output (Independent Overlay) ---
    // This is the little tag "FERTILITY: HIGH" or "Protected" for birth control
    let fertilityLabel: string | undefined = undefined;
    let fertilityLabelVariant: 'low' | 'medium' | 'high' | 'peak' | undefined = undefined;

    // Birth Control Mode: Show "Protected" badge instead of fertility
    if (settings.isOnBirthControl) {
        fertilityLabel = t('dashboard.protected', 'Protected');
        fertilityLabelVariant = 'low';
    } else if (!fertilityEnabled) {
        fertilityLabel = undefined;
    } else if (fertilityBand === 'peak') {
        fertilityLabel = t('dashboard.chance_peak');
        fertilityLabelVariant = 'peak';
    } else if (fertilityBand === 'fertile') {
        fertilityLabel = t('dashboard.chance_high');
        fertilityLabelVariant = 'high';
    } else {
        fertilityLabel = t('dashboard.chance_low');
        fertilityLabelVariant = 'low';
    }


    return {
        title: finalTitle,
        titleIsCycleDay: finalTitleIsCycleDay,
        subtitle: finalSubtitle,
        chance: fertilityLabel,
        chanceVariant: fertilityLabelVariant,
        statusVariant: finalVariant,
        dayOfCycle,
        cycleLength: predictions.cycleLengthUsed || 28,
        dayOfPeriod: baseDayOfPeriod,
        periodLength: basePeriodLength
    };
};
