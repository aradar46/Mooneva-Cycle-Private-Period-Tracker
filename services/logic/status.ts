import { AppSettings, PredictionResults, DayMeta } from '../../types';

export interface CycleStatusData {
    title: string;
    subtitle: string;
    chance?: string;
    chanceVariant?: 'low' | 'medium' | 'high' | 'peak';
    statusVariant?: 'neutral' | 'warning' | 'primary' | 'success' | 'info' | 'secondary';
    dayOfCycle?: number;
    cycleLength?: number;
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
export const calculateCycleStatus = (
    meta: DayMeta,
    predictions: PredictionResults,
    settings: AppSettings,
    t: (key: string, options?: any) => string,
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
    const [lsY, lsM, lsD] = effectiveStartStr.split('-').map(Number);
    const lastStart = new Date(lsY, lsM - 1, lsD);
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const dayDate = new Date(ty, tm - 1, td);
    dayDate.setHours(0, 0, 0, 0);

    const rawDayOfCycle = Math.floor((dayDate.getTime() - lastStart.getTime()) / (1000 * 3600 * 24)) + 1;
    const cycleLen = predictions.cycleLengthUsed || predictions.effective?.cycleLength || 28;

    // Wrap dayOfCycle ONLY for FUTURE predictions (days beyond today AND beyond cycle length)
    // Past cycles (even if 60+ days long) should show the actual day count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFutureDate = dayDate.getTime() > today.getTime();

    let dayOfCycle = rawDayOfCycle;
    if (isFutureDate && rawDayOfCycle > cycleLen) {
        // Wrap to show what day of the predicted cycle this would be
        dayOfCycle = ((rawDayOfCycle - 1) % cycleLen) + 1;
    }

    // FIX: Handle cases where we are viewing a date BEFORE the effective period start.
    // This happens if the user is viewing a date before their first logged period (future period is the anchor).
    if (rawDayOfCycle < 1) {
        const daysUntil = Math.ceil((lastStart.getTime() - dayDate.getTime()) / (1000 * 3600 * 24));
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
        const nextDay = new Date(predictions.nextPeriodStart);
        nextDay.setHours(0, 0, 0, 0);
        const diffTime = nextDay.getTime() - dayDate.getTime();
        const rawDays = Math.round(diffTime / (1000 * 3600 * 24));

        if (rawDays < 0) {
            overdueDays = Math.abs(rawDays);
        } else {
            dueInDays = rawDays;
        }
    }

    // Determine Fertility Band
    type FertilityBand = 'none' | 'fertile' | 'peak';
    let fertilityBand: FertilityBand = 'none';

    if (settings.showFertileWindow && !settings.isOnBirthControl && predictions.nextPeriodStart) {
        const nextDay = new Date(predictions.nextPeriodStart);
        nextDay.setHours(0, 0, 0, 0);
        const ovulationDate = new Date(nextDay);
        ovulationDate.setDate(ovulationDate.getDate() - (settings.lutealPhaseLength || 14));
        const diffToOvulation = Math.round((dayDate.getTime() - ovulationDate.getTime()) / (1000 * 3600 * 24));

        // Peak: -2, -1 (24-48h before ovulation)
        if (diffToOvulation >= -2 && diffToOvulation <= -1) {
            fertilityBand = 'peak';
        }
        // Fertile: -5 to 0 (excluding peak band overlaps if we treat them strictly, but logic says peak is a subset of fertile window)
        // Let's stick to the requested definition: "fertile means in fertile window but not peak day"
        else if ((diffToOvulation >= -5 && diffToOvulation <= 0) || diffToOvulation === 1) { // +1 is often low but sometimes included
            // Actually, standardized window usually ends on ovulation day (0). +1 is often irrelevant.
            // Following previous logic: -5 to -3 and 0 were 'High'. -2,-1 were 'Peak'.
            fertilityBand = 'fertile';
        }
    }

    const fertilityEnabled = settings.showFertileWindow && !settings.isOnBirthControl;

    // --- Step A: System Gates ---
    // 1. No Data
    if (!predictions.lastPeriodStart) {
        return {
            title: t('dashboard.hello', 'Hello'),
            subtitle: t('dashboard.log_to_start', 'Log period to start'),
            statusVariant: 'neutral',
            chance: undefined,
            chanceVariant: undefined
        };
    }

    // --- Step B: Hard Override (Late) ---
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
    let baseTitle = t('dashboard.cycle_day', { day: dayOfCycle });
    let baseSubtitle = t('dashboard.follicular_phase');
    let baseVariant: CycleStatusData['statusVariant'] = 'secondary';
    let baseDayOfPeriod: number | undefined = undefined;
    let basePeriodLength: number | undefined = undefined;

    if (flowActive) {
        // 4. Flow Active
        baseTitle = t('dashboard.cycle_day', { day: dayOfCycle }); // Or 'Period: Day X'
        baseSubtitle = t('dashboard.flow_logged');
        baseVariant = 'primary';
        baseDayOfPeriod = meta.dayOfPeriod;
        basePeriodLength = settings.periodLength || 5;
    } else if (dueInDays === 0) {
        // 5. Due Today
        baseTitle = t('dashboard.period_due', 'Period Due');
        baseSubtitle = t('dashboard.expected_today', 'Expected Today');
        baseVariant = 'warning';
    } else if (dueInDays === 1) {
        // 6. Due Tomorrow
        baseTitle = t('dashboard.period_soon');
        baseSubtitle = t('dashboard.expected_tomorrow');
        baseVariant = 'info';
    } else if (dueInDays !== null && dueInDays >= 2 && dueInDays <= 3) {
        // 7. Due in 2-3 Days
        baseTitle = t('dashboard.period_in', { count: dueInDays });
        baseSubtitle = t('dashboard.luteal_phase');
        baseVariant = 'secondary';
    } else {
        // 8. Normal Phase — determine actual phase from cycle position
        baseTitle = t('dashboard.cycle_day', { day: dayOfCycle });

        if (predictions.nextPeriodStart) {
            const nextDay = new Date(predictions.nextPeriodStart);
            nextDay.setHours(0, 0, 0, 0);
            const daysUntilNext = Math.round((nextDay.getTime() - dayDate.getTime()) / (1000 * 3600 * 24));
            const ovDay = new Date(nextDay);
            ovDay.setDate(ovDay.getDate() - (settings.lutealPhaseLength || 14));
            const isPastOvulation = dayDate.getTime() >= ovDay.getTime();

            if (dueInDays !== null && dueInDays >= 4 && dueInDays <= 7) {
                baseSubtitle = t('dashboard.pms_phase');
                baseVariant = 'secondary';
            } else if (isPastOvulation) {
                baseSubtitle = t('dashboard.luteal_phase');
                baseVariant = 'secondary';
            } else {
                baseSubtitle = t('dashboard.follicular_phase');
                baseVariant = 'secondary';
            }
        } else {
            baseSubtitle = t('dashboard.follicular_phase');
            baseVariant = 'secondary';
        }
    }

    // --- Step D: Fertility Overlay Rules ---
    const hasFertility = fertilityEnabled && (fertilityBand === 'fertile' || fertilityBand === 'peak');
    let finalTitle = baseTitle;
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
        finalSubtitle = t('dashboard.fertile_window');
        finalVariant = 'success';

        // Remove period specific metadata from the card face if replaced?
        // Logic says "Replace card copy". So we show "Day X" / "Fertile Window".
        // We might lose 'Flow logged' subtitle but that seems intentional per "fertility wins visible messaging".
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
        subtitle: finalSubtitle,
        chance: fertilityLabel,
        chanceVariant: fertilityLabelVariant,
        statusVariant: finalVariant,
        dayOfCycle,
        cycleLength: predictions.cycleLengthUsed || 28,
        dayOfPeriod: hasFertility ? undefined : baseDayOfPeriod, // Hide period dots if fertility overlay wins?
        // Actually, if flow is active but fertility wins copy, do we still showing the red dots?
        // The prompt says "Replace card copy". It doesn't explicitly say "hide period dots UI".
        // However, the `CycleStatusData` structure often drives the UI rendering mode.
        // If I pass `dayOfPeriod`, the current UI *might* force the Period View (red dots).
        // Let's check Calendar.tsx:
        // `{cycleStatus.dayOfPeriod != null ... ? ( <Period dots UI> ) : ( <Subtitle UI> )}`
        // So if I pass dayOfPeriod, it SHOWS period UI and HIDES subtitle.
        // But the prompt says: "Subtitle `Fertile Window`".
        // Use CASE: Short cycle coverage. Flow active + Fertile.
        // If I return `dayOfPeriod`, the UI shows "Period X / Y" and IGNORES subtitle.
        // To strictly follow "Subtitle: Fertile Window", I MUST NOT return `dayOfPeriod` if fertility wins.
        // So `dayOfPeriod: hasFertility ? undefined : baseDayOfPeriod` is CORRECT behavior to force subtitle view.
        periodLength: hasFertility ? undefined : basePeriodLength
    };
};
