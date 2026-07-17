import type { DailyLog } from '../types';

export const hasDailyLogContent = (log?: DailyLog | null): boolean => {
    if (!log) return false;

    const hasMood = Array.isArray(log.mood) ? log.mood.length > 0 : Boolean(log.mood);

    return Boolean(
        log.flow ||
        log.pillTakenAt ||
        log.notes ||
        hasMood ||
        log.discharge ||
        log.sexDrive ||
        log.sexType ||
        (log.symptoms && log.symptoms.length > 0)
    );
};
