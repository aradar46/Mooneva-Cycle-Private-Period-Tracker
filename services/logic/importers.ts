/**
 * Importers for other period trackers' export files.
 * Supported: drip (CSV), Flo (JSON data export), Clue (measurements.json).
 * Each parser produces plain Mooneva logs + periods; merging/saving is the caller's job.
 */

import { DailyLog, FlowIntensity, PeriodRecord, DischargeType, SexDriveType, SexType } from '../../types';
import { isAnyFlowDay, isFullFlowDay } from './cycle';
import { addDays, diffInDays, getTodayStr } from '../../utils/dateUtils';

export interface ExternalImportResult {
    source: 'drip' | 'flo' | 'clue';
    logs: Record<string, DailyLog>;
    periods: PeriodRecord[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

const emptyLog = (date: string): DailyLog => ({ date, flow: null, symptoms: [], notes: '' });

const appendNote = (log: DailyLog, note: string) => {
    log.notes = log.notes ? `${log.notes}\n${note}` : note;
};

const addSymptom = (log: DailyLog, id: string) => {
    if (!log.symptoms.includes(id)) log.symptoms.push(id);
};

// At runtime the app stores mood as an array of MOOD_OPTIONS ids (see DailyLogPanel),
// even though the declared type is a single legacy MoodType.
const addMood = (log: DailyLog, id: string) => {
    const moods = (Array.isArray(log.mood) ? log.mood : (log.mood ? [log.mood] : [])) as string[];
    if (!moods.includes(id)) moods.push(id);
    log.mood = moods as unknown as DailyLog['mood'];
};

/**
 * Group per-day bleeding logs into PeriodRecords (drip/Clue exports have no
 * period grouping). A run tolerates 1 skipped day; a new run starts beyond that.
 * Runs without at least one full-flow day (spotting only) are not periods.
 */
export const logsToPeriods = (logs: Record<string, DailyLog>): PeriodRecord[] => {
    const flowDates = Object.values(logs).filter(isAnyFlowDay).map(l => l.date).sort();
    const runs: string[][] = [];
    for (const d of flowDates) {
        const run = runs[runs.length - 1];
        if (run && diffInDays(d, run[run.length - 1]) <= 2) run.push(d);
        else runs.push([d]);
    }
    const periods: PeriodRecord[] = [];
    for (const run of runs) {
        // ponytail: period starts at first full-flow day; leading spotting stays log-only
        const start = run.find(d => isFullFlowDay(logs[d]));
        if (!start) continue;
        const days = run.filter(d => d >= start);
        const last = days[days.length - 1];
        periods.push({
            id: start,
            startDate: start,
            days: diffInDays(last, start) + 1,
            activeDays: days.map(d => diffInDays(d, start)),
        });
    }
    return periods;
};

// ---------------------------------------------------------------------------
// drip (CSV)
// ---------------------------------------------------------------------------

/** Minimal CSV parser: handles quoted fields, escaped quotes and newlines in quotes. */
const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); field = '';
            if (row.some(f => f !== '')) rows.push(row);
            row = [];
        } else field += c;
    }
    row.push(field);
    if (row.some(f => f !== '')) rows.push(row);
    return rows;
};

const DRIP_FLOW: FlowIntensity[] = ['spotting', 'light', 'medium', 'heavy'];
const DRIP_DESIRE: SexDriveType[] = ['low', 'medium', 'high'];
const DRIP_PAIN_SYMPTOM: Record<string, string> = {
    'pain.cramps': 'cramps',
    'pain.headache': 'headache',
    'pain.migraine': 'headache',
    'pain.backache': 'backache',
    'pain.nausea': 'nausea',
    'pain.tenderBreasts': 'tenderness',
};
const DRIP_MOOD: Record<string, string> = {
    'mood.happy': 'happy',
    'mood.sad': 'sad',
    'mood.stressed': 'anxious',
    'mood.balanced': 'calm',
    'mood.fine': 'calm',
    'mood.anxious': 'anxious',
    'mood.energetic': 'energetic',
    'mood.fatigue': 'tired',
    'mood.angry': 'irritable',
};
const DRIP_PROTECTED = ['sex.condom', 'sex.pill', 'sex.iud', 'sex.patch', 'sex.ring', 'sex.implant', 'sex.diaphragm'];

export const parseDripCsv = (text: string): ExternalImportResult | null => {
    const rows = parseCsv(text);
    if (rows.length < 2) return null;
    const headers = rows[0].map(h => h.trim());
    if (headers[0] !== 'date' || !headers.includes('bleeding.value')) return null;

    const logs: Record<string, DailyLog> = {};
    for (const cells of rows.slice(1)) {
        const get = (col: string) => {
            const i = headers.indexOf(col);
            return i === -1 ? '' : (cells[i] ?? '').trim();
        };
        const isTrue = (col: string) => get(col).toLowerCase() === 'true';
        const date = get('date');
        if (!DATE_RE.test(date)) continue;
        const log = emptyLog(date);

        const bleeding = get('bleeding.value');
        if (bleeding !== '') {
            log.flow = DRIP_FLOW[Number(bleeding)] ?? null;
            if (isTrue('bleeding.exclude')) log.ignoreForAverages = true;
        }
        for (const [col, sym] of Object.entries(DRIP_PAIN_SYMPTOM)) if (isTrue(col)) addSymptom(log, sym);
        for (const [col, mood] of Object.entries(DRIP_MOOD)) if (isTrue(col)) addMood(log, mood);

        const desire = get('desire.value');
        if (desire !== '') log.sexDrive = DRIP_DESIRE[Number(desire)] ?? null;
        if (DRIP_PROTECTED.some(isTrue)) log.sexType = 'protected';
        else if (isTrue('sex.none') && (isTrue('sex.partner') || isTrue('sex.solo'))) log.sexType = 'unprotected';

        const texture = get('mucus.texture'); // 0 nothing, 1 creamy, 2 eggWhite
        if (texture === '1') log.discharge = 'sticky_creamy';
        else if (texture === '2') log.discharge = 'egg_white';
        else if (get('mucus.feeling') === '0') log.discharge = 'dry';

        if (get('note.value')) appendNote(log, get('note.value'));
        if (get('temperature.value')) appendNote(log, `BBT ${get('temperature.value')}°C${get('temperature.time') ? ' @ ' + get('temperature.time') : ''}`);
        for (const col of ['pain.note', 'mood.note', 'sex.note', 'temperature.note']) {
            if (get(col)) appendNote(log, get(col));
        }
        if (isTrue('pain.ovulationPain')) appendNote(log, 'ovulation pain');

        logs[date] = log;
    }
    if (!Object.keys(logs).length) return null;
    return { source: 'drip', logs, periods: logsToPeriods(logs) };
};

// ---------------------------------------------------------------------------
// Flo (JSON export, operationalData.cycles)
// ---------------------------------------------------------------------------

interface FloCycle { period_start_date?: string; period_end_date?: string; }

export const parseFloJson = (json: unknown): ExternalImportResult | null => {
    const cycles = (json as { operationalData?: { cycles?: FloCycle[] } })?.operationalData?.cycles;
    if (!Array.isArray(cycles) || !cycles.length) return null;

    const today = getTodayStr();
    const logs: Record<string, DailyLog> = {};
    const periods: PeriodRecord[] = [];
    for (const c of cycles) {
        const start = (c.period_start_date ?? '').slice(0, 10);
        if (!DATE_RE.test(start)) continue;
        let end = (c.period_end_date ?? '').slice(0, 10);
        if (!DATE_RE.test(end) || end < start) end = start;
        if (end > today) end = today;
        const days = diffInDays(end, start) + 1;
        for (let i = 0; i < days; i++) {
            const d = addDays(start, i);
            // Flo exports no intensity; medium is the neutral choice
            logs[d] = { ...emptyLog(d), flow: 'medium' };
        }
        periods.push({ id: start, startDate: start, days, activeDays: Array.from({ length: days }, (_, i) => i) });
    }
    if (!periods.length) return null;
    periods.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return { source: 'flo', logs, periods };
};

// ---------------------------------------------------------------------------
// Clue (measurements.json: flat array of { date, type, value })
// ---------------------------------------------------------------------------

interface ClueEntry { date?: string; type?: string; value?: unknown; }

const CLUE_FLOW: Record<string, FlowIntensity> = {
    light: 'light', medium: 'medium', heavy: 'heavy', very_heavy: 'heavy',
};
const CLUE_PAIN: Record<string, string> = {
    period_cramps: 'cramps', lower_back: 'backache', breast_tenderness: 'tenderness',
    headache: 'headache', migraine: 'headache', migraine_with_aura: 'headache',
};
const CLUE_FEELINGS: Record<string, string> = {
    happy: 'happy', sad: 'sad', angry: 'irritable', anxious: 'anxious', indifferent: 'calm',
};
const CLUE_ENERGY: Record<string, string> = {
    energetic: 'energetic', fully_energized: 'energetic', tired: 'tired', exhausted: 'tired',
};
const CLUE_DISCHARGE: Record<string, DischargeType> = {
    none: 'dry', sticky: 'sticky_creamy', creamy: 'sticky_creamy', egg_white: 'egg_white',
};

const clueOptions = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(v => (v as { option?: string })?.option ?? '').filter(Boolean);
    const opt = (value as { option?: string })?.option;
    return opt ? [opt] : [];
};

export const parseClueJson = (json: unknown): ExternalImportResult | null => {
    if (!Array.isArray(json)) return null;
    const entries = json as ClueEntry[];
    if (!entries.some(e => typeof e?.date === 'string' && typeof e?.type === 'string')) return null;

    const logs: Record<string, DailyLog> = {};
    for (const entry of entries) {
        const date = (entry.date ?? '').slice(0, 10);
        if (!DATE_RE.test(date) || !entry.type) continue;
        const log = logs[date] ?? (logs[date] = emptyLog(date));
        const options = clueOptions(entry.value);

        switch (entry.type) {
            case 'period':
                log.flow = CLUE_FLOW[options[0]] ?? 'medium';
                break;
            case 'spotting':
                log.flow = log.flow ?? 'spotting';
                break;
            case 'pain':
                for (const o of options) {
                    if (o === 'pain_free') continue;
                    if (CLUE_PAIN[o]) addSymptom(log, CLUE_PAIN[o]);
                    else appendNote(log, o.replace(/_/g, ' '));
                }
                break;
            case 'feelings':
                for (const o of options) {
                    if (CLUE_FEELINGS[o]) addMood(log, CLUE_FEELINGS[o]);
                    else appendNote(log, o.replace(/_/g, ' '));
                }
                break;
            case 'energy':
                for (const o of options) if (CLUE_ENERGY[o]) addMood(log, CLUE_ENERGY[o]);
                break;
            case 'sex_life':
                for (const o of options) {
                    if (o === 'protected_sex') log.sexType = 'protected';
                    else if (o === 'unprotected_sex' || o === 'withdrawal') log.sexType = 'unprotected';
                    else if (o === 'high_sex_drive') log.sexDrive = 'high';
                    else if (o === 'low_sex_drive') log.sexDrive = 'low';
                }
                break;
            case 'digestion':
                for (const o of options) addSymptom(log, o === 'nauseous' ? 'nausea' : 'digestion');
                break;
            case 'discharge':
                log.discharge = CLUE_DISCHARGE[options[0]] ?? log.discharge ?? null;
                break;
            case 'bbt': {
                const v = (entry.value as { temperature?: number })?.temperature;
                if (typeof v === 'number') appendNote(log, `BBT ${v}°C`);
                break;
            }
            // ponytail: remaining Clue categories (cravings, skin, hair, ...) dropped;
            // dump into notes if users ask for them
        }
    }
    for (const [date, log] of Object.entries(logs)) {
        const isEmpty = !log.flow && !log.symptoms.length && !log.notes
            && !log.mood && !log.discharge && !log.sexDrive && !log.sexType;
        if (isEmpty) delete logs[date];
    }
    if (!Object.keys(logs).length) return null;
    return { source: 'clue', logs, periods: logsToPeriods(logs) };
};

// ---------------------------------------------------------------------------
// Entry point: detect + parse
// ---------------------------------------------------------------------------

export const parseExternalImport = (text: string): ExternalImportResult | null => {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        let json: unknown;
        try { json = JSON.parse(trimmed); } catch { return null; }
        return parseFloJson(json) ?? parseClueJson(json);
    }
    return parseDripCsv(text);
};
