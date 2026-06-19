import { describe, expect, it } from 'vitest';
import { hasDailyLogContent } from '../utils/dailyLogContent';
import type { DailyLog } from '../types';

const emptyLog: DailyLog = {
    date: '2026-06-19',
    flow: null,
    symptoms: [],
    notes: '',
};

describe('hasDailyLogContent', () => {
    it('treats an empty log as no content', () => {
        expect(hasDailyLogContent(emptyLog)).toBe(false);
    });

    it('treats pill-only logs as content', () => {
        expect(hasDailyLogContent({ ...emptyLog, pillTakenAt: '11:32' })).toBe(true);
    });
});
