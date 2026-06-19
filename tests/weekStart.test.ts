import { describe, expect, it } from 'vitest';
import {
    getLanguageDefaultFirstDayOfWeek,
    getLeadingDayCount,
    getWeekDayKeys,
    normalizeFirstDayOfWeek,
    resolveFirstDayOfWeek,
} from '../utils/weekStart';
import { toGregorian } from '../utils/jalaali';

describe('week start helpers', () => {
    it('defaults Persian to Saturday and other languages to Monday', () => {
        expect(getLanguageDefaultFirstDayOfWeek('fa')).toBe('saturday');
        expect(getLanguageDefaultFirstDayOfWeek('fa-IR')).toBe('saturday');
        expect(getLanguageDefaultFirstDayOfWeek('en')).toBe('monday');
        expect(getLanguageDefaultFirstDayOfWeek('sv')).toBe('monday');
        expect(getLanguageDefaultFirstDayOfWeek(undefined)).toBe('monday');
    });

    it('uses an explicit override when present', () => {
        expect(resolveFirstDayOfWeek('fa', 'monday')).toBe('monday');
        expect(resolveFirstDayOfWeek('en', 'saturday')).toBe('saturday');
        expect(resolveFirstDayOfWeek('en', undefined)).toBe('monday');
    });

    it('ignores invalid stored values', () => {
        expect(normalizeFirstDayOfWeek('monday')).toBe('monday');
        expect(normalizeFirstDayOfWeek('sunday')).toBe('sunday');
        expect(normalizeFirstDayOfWeek('saturday')).toBe('saturday');
        expect(normalizeFirstDayOfWeek('friday')).toBeUndefined();
        expect(resolveFirstDayOfWeek('fa', 'friday')).toBe('saturday');
    });

    it('rotates weekday keys from the selected first day', () => {
        expect(getWeekDayKeys('monday')).toEqual(['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']);
        expect(getWeekDayKeys('sunday')).toEqual(['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa']);
        expect(getWeekDayKeys('saturday')).toEqual(['sa', 'su', 'mo', 'tu', 'we', 'th', 'fr']);
    });

    it('calculates Gregorian leading cells relative to the selected first day', () => {
        const mayFirst2024 = new Date(2024, 4, 1);

        expect(mayFirst2024.getDay()).toBe(3);
        expect(getLeadingDayCount(mayFirst2024.getDay(), 'monday')).toBe(2);
        expect(getLeadingDayCount(mayFirst2024.getDay(), 'sunday')).toBe(3);
        expect(getLeadingDayCount(mayFirst2024.getDay(), 'saturday')).toBe(4);
    });

    it('calculates Jalaali leading cells from the converted Gregorian weekday', () => {
        const farvardinFirst1403 = toGregorian(1403, 1, 1);
        const nativeDay = new Date(
            farvardinFirst1403.gy,
            farvardinFirst1403.gm - 1,
            farvardinFirst1403.gd
        ).getDay();

        expect(nativeDay).toBe(3);
        expect(getLeadingDayCount(nativeDay, 'saturday')).toBe(4);
        expect(getLeadingDayCount(nativeDay, 'monday')).toBe(2);
    });
});
