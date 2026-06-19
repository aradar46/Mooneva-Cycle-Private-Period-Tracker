import type { DailyLog } from '../types';

export const hasDailyLogContent = (log?: DailyLog | null): boolean => {
    if (!log) return false;

    return Boolean(
        log.flow ||
        log.pillTakenAt ||
        log.notes ||
        log.mood ||
        log.discharge ||
        log.sexDrive ||
        log.sexType ||
        (log.symptoms && log.symptoms.length > 0)
    );
};
