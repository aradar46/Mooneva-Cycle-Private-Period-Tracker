import { describe, expect, it } from 'vitest';
import { formatLocalTimeHHmm } from '../utils/timeFormat';

describe('formatLocalTimeHHmm', () => {
    it('formats local time with leading zeroes', () => {
        expect(formatLocalTimeHHmm(new Date(2026, 5, 19, 9, 5))).toBe('09:05');
        expect(formatLocalTimeHHmm(new Date(2026, 5, 19, 23, 45))).toBe('23:45');
    });
});
