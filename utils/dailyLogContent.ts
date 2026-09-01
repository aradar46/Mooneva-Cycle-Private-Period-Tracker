import type { DailyLog } from '../types';

export const hasDailyLogContent = (log?: DailyLog | null): boolean => {
    if (!log) return false;

    const hasMood = (log.mood?.length ?? 0) > 0;

    return Boolean(
        log.flow ||
        log.pillTakenAt ||
        (log.meds && log.meds.length > 0) ||
        log.notes ||
        hasMood ||
        log.discharge ||
        log.sexDrive ||
        log.sexType ||
        (log.symptoms && log.symptoms.length > 0)
    );
};
