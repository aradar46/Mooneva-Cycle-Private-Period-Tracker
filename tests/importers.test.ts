import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseExternalImport, parseDripCsv, parseFloJson, parseClueJson } from '@/services/logic/importers';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

describe('parseDripCsv', () => {
    const result = parseDripCsv(fixture('drip-export.csv'))!;

    it('parses all logged days', () => {
        expect(result).not.toBeNull();
        expect(result.source).toBe('drip');
        // 4 cycles x (1 spotting + 5 bleeding) + 4 extra days
        expect(Object.keys(result.logs)).toHaveLength(28);
    });

    it('maps bleeding values to flow', () => {
        expect(result.logs['2026-03-05'].flow).toBe('medium');
        expect(result.logs['2026-03-06'].flow).toBe('heavy');
        expect(result.logs['2026-03-09'].flow).toBe('spotting');
        expect(result.logs['2026-03-04'].flow).toBe('spotting'); // leading spotting day
        expect(result.logs['2026-03-04'].ignoreForAverages).toBe(true); // bleeding.exclude
    });

    it('maps symptoms, moods, desire, sex and mucus', () => {
        expect(result.logs['2026-03-05'].symptoms).toContain('cramps');
        expect(result.logs['2026-03-06'].symptoms).toContain('backache');
        expect(result.logs['2026-03-05'].mood).toContain('tired');
        expect(result.logs['2026-03-05'].mood).toContain('sad');
        expect(result.logs['2026-03-18'].sexDrive).toBe('high');
        expect(result.logs['2026-03-18'].discharge).toBe('egg_white');
        expect(result.logs['2026-03-18'].notes).toContain('BBT 36.4°C @ 07:30');
        expect(result.logs['2026-04-17'].sexType).toBe('protected');
        expect(result.logs['2026-04-17'].discharge).toBe('sticky_creamy');
        expect(result.logs['2026-05-16'].sexType).toBe('unprotected');
        expect(result.logs['2026-06-20'].discharge).toBe('dry');
        expect(result.logs['2026-06-20'].symptoms).toEqual(['headache']); // migraine dedupes into headache
    });

    it('handles quoted CSV fields with commas and escaped quotes', () => {
        expect(result.logs['2026-04-17'].notes).toContain('dinner with anna, felt great. "good" day');
    });

    it('groups bleeding days into periods, trimming leading spotting', () => {
        expect(result.periods).toHaveLength(4);
        expect(result.periods.map(p => p.startDate)).toEqual(['2026-03-05', '2026-04-03', '2026-05-02', '2026-06-01']);
        expect(result.periods[0].days).toBe(5);
        expect(result.periods[0].activeDays).toEqual([0, 1, 2, 3, 4]);
    });
});

describe('parseFloJson', () => {
    const result = parseFloJson(JSON.parse(fixture('flo-export.json')))!;

    it('builds periods from cycles, sorted ascending', () => {
        expect(result).not.toBeNull();
        expect(result.source).toBe('flo');
        expect(result.periods).toHaveLength(4);
        expect(result.periods.map(p => p.startDate)).toEqual(['2026-03-05', '2026-04-03', '2026-05-02', '2026-06-01']);
        expect(result.periods[0].days).toBe(5);
    });

    it('creates medium-flow logs for each period day', () => {
        expect(Object.keys(result.logs)).toHaveLength(20);
        expect(result.logs['2026-06-03'].flow).toBe('medium');
    });
});

describe('parseClueJson', () => {
    const result = parseClueJson(JSON.parse(fixture('clue-measurements.json')))!;

    it('parses measurements into logs and periods', () => {
        expect(result).not.toBeNull();
        expect(result.source).toBe('clue');
        expect(result.periods).toHaveLength(4);
        expect(result.periods.map(p => p.startDate)).toEqual(['2026-03-05', '2026-04-03', '2026-05-02', '2026-06-01']);
    });

    it('maps flow including very_heavy and spotting', () => {
        expect(result.logs['2026-03-05'].flow).toBe('medium');
        expect(result.logs['2026-03-06'].flow).toBe('heavy'); // very_heavy
        expect(result.logs['2026-03-04'].flow).toBe('spotting');
    });

    it('maps tags to symptoms, moods and fields', () => {
        expect(result.logs['2026-03-05'].symptoms).toEqual(expect.arrayContaining(['cramps', 'backache']));
        expect(result.logs['2026-03-05'].mood).toContain('sad');
        expect(result.logs['2026-03-05'].mood).toContain('tired'); // exhausted
        expect(result.logs['2026-03-18'].discharge).toBe('egg_white');
        expect(result.logs['2026-03-18'].sexDrive).toBe('high');
        expect(result.logs['2026-03-18'].sexType).toBe('unprotected');
        expect(result.logs['2026-04-17'].sexType).toBe('protected');
        expect(result.logs['2026-04-17'].notes).toContain('BBT 36.35°C');
        expect(result.logs['2026-06-20'].symptoms).toEqual(expect.arrayContaining(['headache', 'nausea', 'digestion']));
    });

    it('keeps unmapped options as notes and ignores unmapped categories', () => {
        expect(result.logs['2026-05-16'].notes).toContain('grateful');
        expect(result.logs['2026-06-20'].notes).toContain('tender ovaries');
        expect(result.logs['2026-06-25']).toBeUndefined(); // cravings-only day ignored
    });
});

describe('parseExternalImport (auto-detect)', () => {
    it('detects each format', () => {
        expect(parseExternalImport(fixture('drip-export.csv'))?.source).toBe('drip');
        expect(parseExternalImport(fixture('flo-export.json'))?.source).toBe('flo');
        expect(parseExternalImport(fixture('clue-measurements.json'))?.source).toBe('clue');
    });

    it('rejects garbage', () => {
        expect(parseExternalImport('hello world')).toBeNull();
        expect(parseExternalImport('{"foo": 1}')).toBeNull();
        expect(parseExternalImport('not,a,drip\n1,2,3')).toBeNull();
    });
});
