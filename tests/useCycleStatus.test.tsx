import { describe, it, expect, vi } from 'vitest';
import { calculateCycleStatus } from '../services/logic/status';
import { AppSettings, INITIAL_SYMPTOMS } from '../types';
import { toLocalISOString } from '../utils/dateUtils';

// Mock Translation
const t = (key: string, options?: any) => {
    if (options?.day) return `${key}:${options.day}`;
    if (options?.count) return `${key}:${options.count}`;
    return key;
};

const mockSettings: AppSettings = {
    discreteMode: false,
    userName: 'User',
    predictionsPaused: false,
    isOnBirthControl: false,
    symptoms: INITIAL_SYMPTOMS,
    cycleLength: 28,
    periodLength: 5,
    lutealPhaseLength: 14,
    pmsLength: 3,
    showFertileWindow: true,
    onboardingCompleted: true,
    adaptivePrediction: false
};

const mockPredictions = (overrides: Partial<any> = {}) => ({
    lastPeriodStart: null,
    nextPeriodStart: null,
    nextPeriodEnd: null,
    fertileWindow: null,
    ovulationDate: null,
    pmsWindow: null,
    healthStatus: 'standard',
    periodLength: 5,
    cycleLengthUsed: 28,
    effective: { cycleLength: 28, periodLength: 5, source: 'settings' as const },
    userSettings: { cycleLength: 28, periodLength: 5 },
    ...overrides
});

const mockDayMeta = (overrides: Partial<any> = {}) => ({
    date: '2024-01-01',
    isToday: true,
    isValidMonth: true,
    isPeriod: false,
    isCycleStart: false,
    isSpotting: false,
    isForecastPeriod: false,
    isFertile: false,
    isOvulation: false,
    isPMS: false,
    isBleeding: false,
    ...overrides
});

describe('calculateCycleStatus', () => {
    it('should return "No Data" if lastPeriodStart is missing', () => {
        const result = calculateCycleStatus(mockDayMeta(), mockPredictions({}), mockSettings, t);
        expect(result.title).toBe('dashboard.hello');
    });

    it('should calculate Cycle Day 1 correctly when period starts today (LOGGED)', () => {
        const today = toLocalISOString(new Date());
        const predictions = mockPredictions({
            lastPeriodStart: today,
            nextPeriodStart: '2999-01-01'
        });
        const logs = { [today]: { flow: 'medium' } as any };

        const result = calculateCycleStatus(
            mockDayMeta({ date: today, isPeriod: true, dayOfPeriod: 1 }),
            predictions,
            mockSettings,
            t
        );

        expect(result.title).toBe('dashboard.cycle_day:1');
        expect(result.subtitle).toBe('dashboard.flow_logged');
        expect(result.statusVariant).toBe('primary');
    });

    it('should show "Expected Today" if period is predicted but not logged', () => {
        const today = toLocalISOString(new Date());
        const predictions = mockPredictions({
            lastPeriodStart: '2020-01-01',
            nextPeriodStart: today
        });

        const result = calculateCycleStatus(mockDayMeta({ date: today }), predictions, mockSettings, t);

        expect(result.title).toBe('dashboard.period_due');
        expect(result.subtitle).toContain('dashboard.expected_today');
        expect(result.statusVariant).toBe('warning');
    });

    it('should identify Fertile Window', () => {
        const todayStr = toLocalISOString(new Date());
        const d = new Date();
        d.setDate(d.getDate() - 13);
        const start = toLocalISOString(d);

        const next = new Date();
        next.setDate(next.getDate() + 15);
        const nextStr = toLocalISOString(next);

        const predictions = mockPredictions({
            lastPeriodStart: start,
            nextPeriodStart: nextStr,
            fertileWindow: {
                start: todayStr,
                end: nextStr
            }
        });

        const result = calculateCycleStatus(mockDayMeta({ date: todayStr, isFertile: true }), predictions, mockSettings, t);

        expect(result.statusVariant).toBe('success');
        expect(result.subtitle).toBe('dashboard.fertile_window');
    });
});
