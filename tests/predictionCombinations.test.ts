import { describe, it, expect } from 'vitest';
import { getCyclePredictions } from '../services/logic';
import { addDays } from '../utils/dateUtils';
import { PeriodRecord, AppSettings, INITIAL_SYMPTOMS } from '../types';

const mockSettings: AppSettings = {
    discreteMode: false,
    userName: 'Test',
    predictionsPaused: false,
    isOnBirthControl: false,
    symptoms: INITIAL_SYMPTOMS,
    cycleLength: 28,
    periodLength: 5,
    lutealPhaseLength: 14,
    pmsLength: 3,
    showFertileWindow: true,
    onboardingCompleted: true,
    adaptivePrediction: true // Enable adaptive!
};

// Helper: PeriodRecord only needs startDate and days
const createPeriod = (startDate: string, days: number = 5): PeriodRecord => ({
    id: 'test-id',
    startDate,
    days,
    activeDays: Array.from({ length: days }, (_, i) => i)
});

describe('Prediction Combinations Integration', () => {

    it('should predict standard 28-day cycle correctly', () => {
        // Construct history: periods every 28 days
        // Jan 29 is target.
        // Jan 1 was last.
        // Dec 4 was before (28 days).
        // Nov 6 was before (28 days).
        const periods = [
            createPeriod('2023-11-06', 5),
            createPeriod('2023-12-04', 5),
            createPeriod('2024-01-01', 5)
        ];

        const predictions = getCyclePredictions(periods, { ...mockSettings, isPaused: mockSettings.predictionsPaused });

        expect(predictions.lastPeriodStart).toBe('2024-01-01');

        // Logic: Jan 1 + 28 days = Jan 29.
        expect(predictions.nextPeriodStart).toBe('2024-01-29');
        expect(predictions.cycleLengthUsed).toBe(28);
    });

    it('should adapt to steady short cycles (24 days)', () => {
        const lastStart = '2024-01-01';
        // Intervals of 24 days
        // Jan 1
        // Dec 8 (31+1 - 24 = 8)
        // Nov 14 (30+8 - 24 = 14)
        // Oct 21 (31+14 - 24 = 21)

        // Let's just use addDays to be safe
        const p1 = createPeriod(addDays(lastStart, -24 * 3));
        const p2 = createPeriod(addDays(lastStart, -24 * 2));
        const p3 = createPeriod(addDays(lastStart, -24 * 1));
        const p4 = createPeriod(lastStart);

        const periods = [p1, p2, p3, p4];

        const predictions = getCyclePredictions(periods, { ...mockSettings, isPaused: mockSettings.predictionsPaused });

        // Adaptive should pick up ~24 days.
        // Jan 1 + 24 = Jan 25.
        expect(predictions.nextPeriodStart).toBe('2024-01-25');
        // Source should be adaptive if logic works and N>=3
        expect(predictions.effective.source).toContain('adaptive');
    });

    it('should handle highly irregular cycles', () => {
        // Intervals: 35, 21, 40
        // P1: Start
        // P2: P1 + 35
        // P3: P2 + 21
        // P4: P3 + 40 (Last Period)

        const p1 = createPeriod('2023-09-01');
        const p2 = createPeriod(addDays(p1.startDate, 35));
        const p3 = createPeriod(addDays(p2.startDate, 21));
        const p4 = createPeriod(addDays(p3.startDate, 40));

        const periods = [p1, p2, p3, p4];

        // Last period is p4.
        // History cycles: 35, 21, 40.
        // Avg = 32.

        const predictions = getCyclePredictions(periods, { ...mockSettings, isPaused: mockSettings.predictionsPaused });

        expect(predictions.lastPeriodStart).toBe(p4.startDate);
        // Expect avg 32 days from last start
        const expectedNext = addDays(p4.startDate, 32);
        expect(predictions.nextPeriodStart).toBe(expectedNext);
    });

    it('should respect manual settings if history is insufficient', () => {
        const settings = { ...mockSettings, cycleLength: 30 };
        // Only one period, so no cycles to calculate average from
        const periods = [createPeriod('2024-01-01')];

        const predictions = getCyclePredictions(periods, { ...settings, isPaused: settings.predictionsPaused });

        // Uses settings.cycleLength (30)
        expect(predictions.nextPeriodStart).toBe('2024-01-31'); // Jan 1 + 30
        expect(predictions.effective.source).toBe('settings');
    });

});
