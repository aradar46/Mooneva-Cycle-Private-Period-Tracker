/**
 * Common Date Utilities
 */

export const toLocalISOString = (date: Date): string => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const getTimestamp = (dateStr: string): number => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
};

export const addDays = (dateStr: string, days: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().split('T')[0];
};

export const diffInDays = (dateStr1: string, dateStr2: string): number => {
    const t1 = getTimestamp(dateStr1);
    const t2 = getTimestamp(dateStr2);
    return Math.round((t1 - t2) / (1000 * 3600 * 24));
};

export const getTodayStr = (): string => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return toLocalISOString(today);
};

export const parseLocalDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
};

/**
 * Strictly validates a YYYY-MM-DD string: exact format, and a real calendar
 * date (rejects e.g. 2026-02-30, which the Date constructor would otherwise
 * silently roll over into March 2).
 */
export const parseStrictLocalDate = (value: string): Date | undefined => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return undefined;

    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
        ? date
        : undefined;
};
