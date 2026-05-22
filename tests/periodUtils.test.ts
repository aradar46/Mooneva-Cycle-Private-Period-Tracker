import { describe, it, expect } from 'vitest';
import { findNearbyPeriod } from '../services/logic/cycle';
import { PeriodRecord } from '../types';

describe('findNearbyPeriod', () => {
    const periods: PeriodRecord[] = [
        { id: '1', startDate: '2024-01-01', days: 5 }, // Ends on Jan 5
        { id: '2', startDate: '2024-02-01', days: 4 }  // Ends on Feb 4
    ];

    it('returns null when no periods within gap', () => {
        // Jan 15 is far from any period
        const result = findNearbyPeriod('2024-01-15', periods);
        expect(result).toBeNull();
    });

    it('returns period when date is within MIN_GAP_DAYS after period end', () => {
        // Jan 7 is 2 days after period 1 ends (Jan 5)
        const result = findNearbyPeriod('2024-01-07', periods);
        expect(result).not.toBeNull();
        expect(result?.id).toBe('1');
    });

    it('returns period when date is within MIN_GAP_DAYS before period start', () => {
        // Jan 30 is 2 days before period 2 starts (Feb 1)
        const result = findNearbyPeriod('2024-01-30', periods);
        expect(result).not.toBeNull();
        expect(result?.id).toBe('2');
    });

    it('returns null when date is beyond gap boundary', () => {
        // Jan 10 is 5 days after period 1 ends (Jan 5), beyond gap of 3+1
        const result = findNearbyPeriod('2024-01-10', periods);
        expect(result).toBeNull();
    });
});




