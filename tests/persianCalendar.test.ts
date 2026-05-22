import { describe, it, expect } from 'vitest';
import { toJalaali, toGregorian, jalaaliMonthLength, isLeapJalaaliYear } from '../utils/jalaali';
import { useCalendarSystem } from '../hooks/useCalendarSystem';
// Mocking useTranslation for the hook test might be needed or we just test the logic directly if possible.

// 1. Test Low-Level Conversion Logic (jalaali.ts)
describe('Jalaali Calendar Utilities', () => {
    it('converts Gregorian to Jalaali correctly', () => {
        // 2024-03-20 -> 1403-01-01 (Nowruz 1403 - Leap Year 2024 shift) // Wait. If Nowruz is 20th.
        // 2024-03-19 -> 1402-12-29.
        const d1 = toJalaali(2024, 3, 20);
        expect(d1).toEqual({ jy: 1403, jm: 1, jd: 1 });

        // 2024-03-21 -> 1403-01-02
        const d2 = toJalaali(2024, 3, 21);
        expect(d2).toEqual({ jy: 1403, jm: 1, jd: 2 });

        // 2026-02-07 -> 1404-11-18 (Today's check)
        const d3 = toJalaali(2026, 2, 7);
        expect(d3).toEqual({ jy: 1404, jm: 11, jd: 18 });
    });

    it('converts Jalaali to Gregorian correctly', () => {
        // 1403-01-01 -> 2024-03-20 (Nowruz 1403, 2024 is a leap year)
        const g1 = toGregorian(1403, 1, 1);
        expect(g1).toEqual({ gy: 2024, gm: 3, gd: 20 });

        // 1404-11-18 -> 2026-02-07
        const g2 = toGregorian(1404, 11, 18);
        expect(g2).toEqual({ gy: 2026, gm: 2, gd: 7 });
    });

    it('calculates month lengths correctly', () => {
        // First 6 months have 31 days
        expect(jalaaliMonthLength(1403, 1)).toBe(31);
        expect(jalaaliMonthLength(1403, 6)).toBe(31);

        // Months 7-11 have 30 days
        expect(jalaaliMonthLength(1403, 7)).toBe(30);
        expect(jalaaliMonthLength(1403, 11)).toBe(30);

        // Esfand (12th month)
        // 1403 is NOT a leap year -> 29 days
        expect(jalaaliMonthLength(1403, 12)).toBe(30); // Wait, recent algo check: 
        // Let's verify our known leap years.
        // 1399 was leap (2020/2021) -> Esfand 30 days
        // 1403 (2024/2025) -> 2024 is leap, so 1403 begins in leap year. 
        // Transition happens in March.
        // 1403 starts March 2024. Ends March 2025.
        // 2024 is leap. 2025 is not.
        // The Jalali leap year logic is complex. Let's test the function directly.
    });

    it('identifies leap years correctly', () => {
        // 1399 (2020-2021) was a leap year
        expect(isLeapJalaaliYear(1399)).toBe(true);
        expect(jalaaliMonthLength(1399, 12)).toBe(30);

        // 1400 was NOT a leap year
        expect(isLeapJalaaliYear(1400)).toBe(false);
        expect(jalaaliMonthLength(1400, 12)).toBe(29);

        // 1403 is a leap year?
        // Check against online converters: 1403 is a leap year (Esfand has 30 days).
        expect(isLeapJalaaliYear(1403)).toBe(true);
        expect(jalaaliMonthLength(1403, 12)).toBe(30);
    });
});
