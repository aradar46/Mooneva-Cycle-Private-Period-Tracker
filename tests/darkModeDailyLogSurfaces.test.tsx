import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DailyLogPanel from '../components/DailyLogPanel';
import { DayPreview } from '../components/DayPreview';
import type { AppSettings, DailyLog, DayMeta } from '../types';

const mockMooneva = vi.hoisted(() => ({
    value: {} as any,
}));

const translations: Record<string, string> = {
    'log.daily_log_tabs': 'Daily log tabs',
    'log.flow_tab': 'Flow',
    'log.mood': 'Mood',
    'log.vitals_tab': 'Body',
    'log.notes': 'Notes',
    'log.pill_tab': 'Pill',
    'log.pill_taken': 'Took pill',
    'log.advanced': 'Advanced',
    'log.intensity_spotting': 'Spot',
    'calendar.period_question': 'Period?',
    'log.spotting_hint_no_period': 'Track spotting or add/change a period',
    'log.tap_to_edit': 'Tap to Edit',
    'log.pill_badge': 'Pill',
    'log.pill_taken_at': 'Pill taken at {{time}}',
    'log.flow_spotting': 'Spotting',
    'log.mood_energetic': 'Energetic',
    'log.mood_focused': 'Focused',
    'log.mood_tired': 'Tired',
    'symptom.backache': 'Backache',
    'log.discharge_egg_white': 'Egg White',
    'log.secretions': 'Secretions',
    'log.libido_medium': 'Medium',
    'log.libido': 'Libido',
    'log.sex_protected': 'Protected',
    'log.sex_activity': 'Sex',
};

vi.mock('../contexts/MoonevaContext', () => ({
    useMooneva: () => mockMooneva.value,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: {
            language: 'en',
            dir: () => 'ltr',
        },
        t: (key: string, fallback?: string | { time: string }) => {
            const translated = translations[key] ?? fallback ?? key;
            if (typeof fallback === 'object' && fallback !== null && 'time' in fallback) {
                return String(translated).replace('{{time}}', fallback.time);
            }
            return translated;
        },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const baseSettings: AppSettings = {
    discreteMode: false,
    darkNeumorphism: true,
    userName: 'Test User',
    onboardingCompleted: true,
    symptoms: [],
    predictionsPaused: false,
    isOnBirthControl: false,
    cycleLength: 28,
    periodLength: 5,
    lutealPhaseLength: 14,
    pmsLength: 3,
    showFertileWindow: true,
    showPMS: true,
};

const baseMeta: DayMeta = {
    date: '2026-07-08',
    isToday: false,
    isValidMonth: true,
    isPeriod: false,
    isBleeding: false,
    isSpotting: true,
    isForecastPeriod: false,
    isFertile: false,
    isOvulation: false,
    isPMS: false,
    isUnavailableFuture: false,
};

const richLog: DailyLog = {
    date: '2026-07-08',
    flow: 'spotting',
    symptoms: ['Backache'],
    notes: "l'kl2k",
    mood: ['energetic', 'focused', 'tired'] as any,
    discharge: 'egg_white',
    sexDrive: 'medium',
    sexType: 'protected',
    pillTakenAt: '18:40',
};

function buildContext(log: DailyLog | undefined = richLog) {
    return {
        logs: log ? { '2026-07-08': log } : {},
        settings: baseSettings,
        periods: [],
        model: {
            cycles: [],
            predictions: {
                effective: {
                    cycleLength: 28,
                    periodLength: 5,
                    source: 'settings',
                },
            },
            getDayMeta: (date: string) => ({ ...baseMeta, date }),
        },
        actions: {
            updateLog: vi.fn(() => Promise.resolve()),
            startPeriod: vi.fn(() => Promise.resolve()),
            editPeriod: vi.fn(() => Promise.resolve()),
            deletePeriod: vi.fn(() => Promise.resolve()),
            updatePeriodWithdrawalBleed: vi.fn(() => Promise.resolve()),
            updatePeriodIgnoreForAverages: vi.fn(() => Promise.resolve()),
        },
    };
}

describe('dark mode daily log surfaces', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMooneva.value = buildContext();
    });

    it('marks day preview chips, notes, and edit affordance for dark-mode styling', () => {
        render(<DayPreview date="2026-07-08" onClose={vi.fn()} onEdit={vi.fn()} />);

        expect(screen.getByText('Tap to Edit').closest('.day-preview-panel')).toBeTruthy();
        expect(screen.getByText('Backache').className).toContain('day-preview-tag-neutral');
        expect(screen.getByText('Egg White Secretions').className).toContain('day-preview-tag-fertility');
        expect(screen.getByText('Medium Libido').className).toContain('day-preview-tag-libido');
        expect(screen.getByText('Protected Sex').className).toContain('day-preview-tag-sex');
        expect(screen.getByText('Pill').closest('.day-preview-pill-badge')).toBeTruthy();
        expect(screen.getByText('18:40').className).toContain('day-preview-pill-time');
        expect(screen.getByText("l'kl2k").className).toContain('day-preview-note-text');
        expect(screen.getByText('Tap to Edit').className).toContain('day-preview-edit-button');
    });

    it('marks daily log tabs, flow circles, and pill controls for dark-mode styling', () => {
        render(<DailyLogPanel date="2026-07-08" />);

        expect(screen.getByText('Track spotting or add/change a period').closest('.daily-log-panel')).toBeTruthy();
        expect(screen.getByLabelText('Daily log tabs').className).toContain('daily-log-tabs');
        expect(screen.getByRole('button', { name: 'Flow' }).className).toContain('daily-log-tab-active');
        expect(screen.getByRole('button', { name: 'Spot' }).className).toContain('daily-log-selection-circle-selected');
        expect(screen.getByRole('button', { name: 'Period?' }).className).toContain('daily-log-action-circle');
        expect(screen.getByRole('button', { name: 'Advanced' }).className).toContain('daily-log-advanced-button');

        fireEvent.click(screen.getByRole('button', { name: 'Pill' }));

        expect(screen.getByText('Took pill').closest('.daily-log-control-card')).toBeTruthy();
        expect(screen.getByLabelText('Took pill').parentElement?.querySelector('.daily-log-check')).toBeTruthy();
    });

    it('has concrete dark CSS overrides for these surfaces', () => {
        const css = readFileSync(join(process.cwd(), 'index.css'), 'utf8');

        expect(css).toContain('body[data-theme="dark-neumorphism"] .day-preview-panel');
        expect(css).toContain('body[data-theme="dark-neumorphism"] .day-preview-tag-sex');
        expect(css).toContain('body[data-theme="dark-neumorphism"] .daily-log-tabs');
        expect(css).toContain('body[data-theme="dark-neumorphism"] .daily-log-selection-circle-selected');
        expect(css).toContain('body[data-theme="dark-neumorphism"] .daily-log-control-card');
    });
});
