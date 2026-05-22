import { describe, it, expect } from 'vitest';
import { getEligibleCycles, computeAdaptiveLengths } from '../services/logic/cycle';
import { Cycle } from '../types';

describe('Adaptive Prediction Logic', () => {

    // Helper to create mock cycles
    const createCycles = (lengths: number[]): Cycle[] => {
        return lengths.map(l => ({
            startDate: '2024-01-01', // Dummy
            length: l,
            periodLength: 5,
            endDate: '2024-01-06'
        }));
    };

    describe('getEligibleCycles', () => {
        it('should filter out cycles shorter than 18 days', () => {
            const cycles = createCycles([28, 17, 25]);
            const eligible = getEligibleCycles(cycles);
            expect(eligible).toHaveLength(2);
            expect(eligible.map(c => c.length)).toEqual([28, 25]);
        });

        it('should filter out gap cycles longer than 60 days', () => {
            const cycles = createCycles([28, 61, 60]);
            const eligible = getEligibleCycles(cycles);
            expect(eligible).toHaveLength(2);
            expect(eligible.map(c => c.length)).toEqual([28, 60]);
        });

        it('should include long-normal cycles 36–60 days in average', () => {
            const cycles = createCycles([28, 46, 50]);
            const eligible = getEligibleCycles(cycles);
            expect(eligible).toHaveLength(3);
            expect(eligible.map(c => c.length)).toEqual([28, 46, 50]);
        });

        it('should handle undefined length', () => {
            const cycles: Cycle[] = [{ startDate: '2024-01-01' }];
            const eligible = getEligibleCycles(cycles);
            expect(eligible).toHaveLength(0);
        });
    });

    describe('computeAdaptiveLengths', () => {
        it('should return null if fewer than 3 eligible cycles', () => {
            const cycles = createCycles([28, 28]);
            const result = computeAdaptiveLengths(cycles);
            expect(result).toBeNull();
        });

        it('should use simple mean for exactly 3-5 eligible cycles', () => {
            // Mean of 21, 30, 39 = 30
            const cycles = createCycles([21, 30, 39]);
            const result = computeAdaptiveLengths(cycles);
            expect(result).toEqual({
                cycleLength: 30,
                periodLength: 5,
                source: 'adaptive_3'
            });
        });

        it('should use simple mean for 6 eligible cycles (Mock implementation uses last 3)', () => {
            // 6 cycles: [21, 28, 29, 30, 31, 45]
            // Last 3: 30, 31, 45 -> Mean = 35.33 -> 35
            const cycles = createCycles([21, 28, 29, 30, 31, 45]);
            const result = computeAdaptiveLengths(cycles);
            expect(result).toEqual({
                cycleLength: 35,
                periodLength: 5,
                source: 'adaptive_3'
            });
        });

        it('should use simple mean for 9 eligible cycles', () => {
            // 9 cycles: [..., 28, 28, 28] -> Last 3 are 28
            const cycles = createCycles(Array(9).fill(28));
            const result = computeAdaptiveLengths(cycles);
            expect(result?.source).toBe('adaptive_3');
            expect(result?.cycleLength).toBe(28);
        });

        it('should prioritize the most recent N cycles', () => {
            // 10 eligible cycles. Oldest [35], rest [28].
            // Should pick last 9 (all 28).
            const lengths = [35, 28, 28, 28, 28, 28, 28, 28, 28, 28];
            const cycles = createCycles(lengths);
            const result = computeAdaptiveLengths(cycles);
            expect(result?.cycleLength).toBe(28);
            expect(result?.source).toBe('adaptive_3');
        });
    });
});
