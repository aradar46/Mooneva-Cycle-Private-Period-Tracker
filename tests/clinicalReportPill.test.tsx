import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClinicalReportView } from '../components/settings/ClinicalReportView';
import type { AppSettings, DailyLog } from '../types';

const mockMooneva = vi.hoisted(() => ({
    value: {} as any,
}));

vi.mock('../contexts/MoonevaContext', () => ({
    useMooneva: () => mockMooneva.value,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: {
            language: 'en',
            dir: () => 'ltr',
        },
        t: (key: string, fallback?: unknown) => {
            if (key === 'settings.cycle_num' && typeof fallback === 'object' && fallback && 'count' in fallback) {
                return `Cycle ${(fallback as { count: number }).count}`;
            }
            const translations: Record<string, string> = {
                'common.days_short': 'd',
                'log.pill_report_label': 'Pill',
                'settings.natural': 'Natural',
            };
            if (translations[key]) return translations[key];
            return typeof fallback === 'string' ? fallback : key;
        },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        writeFile: vi.fn(),
    },
    Directory: { Cache: 'CACHE' },
}));

vi.mock('@capacitor/share', () => ({
    Share: {
        share: vi.fn(),
    },
}));

const baseSettings: AppSettings = {
    discreteMode: false,
    darkNeumorphism: false,
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

const pillOnlyLog: DailyLog = {
    date: '2026-06-19',
    flow: null,
    symptoms: [],
    notes: '',
    pillTakenAt: '11:32',
};

describe('ClinicalReportView pill logging', () => {
    it('includes pill-only days in cycle detail rows', () => {
        mockMooneva.value = {
            logs: {
                '2026-06-19': pillOnlyLog,
            },
            settings: baseSettings,
            periods: [],
            model: {
                cycles: [{
                    startDate: '2026-06-19',
                    length: 1,
                    periodLength: 0,
                    isValid: true,
                }],
            },
        };

        render(<ClinicalReportView onClose={vi.fn()} />);

        expect(screen.getByText('Pill: 11:32')).toBeDefined();
    });
});
