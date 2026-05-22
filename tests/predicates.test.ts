import { describe, it, expect } from 'vitest';
import { isAnyFlowDay, isFullFlowDay } from '../services/logic/cycle';
import { DailyLog } from '../types';

describe('Logic Predicates', () => {
    describe('isAnyFlowDay', () => {
        it('returns true for spotting', () => {
            const log: DailyLog = { flow: 'spotting' } as DailyLog;
            expect(isAnyFlowDay(log)).toBe(true);
        });
        it('returns true for heavy flow', () => {
            const log: DailyLog = { flow: 'heavy' } as DailyLog;
            expect(isAnyFlowDay(log)).toBe(true);
        });
        it('returns true if explicit period even without flow string', () => {
            const log: DailyLog = { isPeriod: true } as unknown as DailyLog;
            expect(isAnyFlowDay(log)).toBe(true);
        });
        it('returns false for empty log', () => {
            const log: DailyLog = {} as DailyLog;
            expect(isAnyFlowDay(log)).toBe(false);
        });
    });

    describe('isFullFlowDay', () => {
        it('returns FALSE for spotting', () => {
            const log: DailyLog = { flow: 'spotting' } as DailyLog;
            expect(isFullFlowDay(log)).toBe(false);
        });
        it('returns true for heavy flow', () => {
            const log: DailyLog = { flow: 'heavy' } as DailyLog;
            expect(isFullFlowDay(log)).toBe(true);
        });
        it('returns true if explicitly marked as period regardless of spotting', () => {
            const log: DailyLog = { flow: 'spotting', isPeriod: true } as unknown as DailyLog;
            expect(isFullFlowDay(log)).toBe(true);
        });
    });
});
