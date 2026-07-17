import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrendsView from '../components/TrendsView';
import type { AppSettings, Cycle, DailyLog } from '../types';
import { toLocalISOString } from '../utils/dateUtils';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: { language: 'en' },
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const settings: AppSettings = {
    discreteMode: false,
    darkNeumorphism: false,
    userName: 'Test User',
    onboardingCompleted: true,
    symptoms: [],
    predictionsPaused: false,
    isOnBirthControl: true,
    cycleLength: 28,
    periodLength: 5,
    lutealPhaseLength: 14,
    pmsLength: 3,
    showFertileWindow: true,
    showPMS: true,
};

const daysAgo = (n: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return toLocalISOString(d);
};

const makeLog = (date: string, extra: Partial<DailyLog>): DailyLog => ({
    date,
    flow: null,
    symptoms: [],
    notes: '',
    ...extra,
});

describe('Trends pill timeline', () => {
    it('shows the pill timeline when pill intake was logged', () => {
        const cycleStart = daysAgo(10);
        const pillDay = daysAgo(8);
        const cycles: Cycle[] = [{ startDate: cycleStart }];
        const logs: Record<string, DailyLog> = {
            [pillDay]: makeLog(pillDay, { pillTakenAt: '08:00' }),
        };

        render(
            <TrendsView
                logs={logs}
                cycles={cycles}
                periods={[]}
                settings={settings}
                onBack={vi.fn()}
                availableSymptoms={[]}
            />
        );

        expect(screen.getByText('trends.pill_timeline')).toBeDefined();
        expect(screen.getByText('💊 trends.pill_taken')).toBeDefined();
    });

    it('hides the pill timeline without pill logs', () => {
        render(
            <TrendsView
                logs={{}}
                cycles={[{ startDate: daysAgo(10) }]}
                periods={[]}
                settings={settings}
                onBack={vi.fn()}
                availableSymptoms={[]}
            />
        );

        expect(screen.queryByText('trends.pill_timeline')).toBeNull();
    });
});
