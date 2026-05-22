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
