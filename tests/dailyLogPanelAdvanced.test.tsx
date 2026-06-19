import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DailyLogPanel from '../components/DailyLogPanel';
import type { AppSettings, PeriodRecord } from '../types';

const mockMooneva = vi.hoisted(() => ({
    value: {} as any,
}));

const translations: Record<string, string> = {
    'log.daily_log_tabs': 'Daily log tabs',
    'log.flow_tab': 'Flow',
    'log.mood': 'Mood',
    'log.vitals_tab': 'Body',
    'log.notes': 'Notes',
    'log.advanced': 'Advanced',
    'log.intensity_spotting': 'Spot',
    'log.intensity_light': 'Light',
    'log.intensity_medium': 'Med',
    'log.intensity_heavy': 'Heavy',
    'log.spotting_hint_no_period': 'Track spotting or add/change a period',
    'calendar.period_question': 'Period?',
    'log.period_type': 'Period Type',
    'log.withdrawal_bleed_question': 'Was this a withdrawal bleed?',
    'log.withdrawal_bleed_desc': 'Tag if on hormonal birth control (pill, ring, patch)',
    'log.withdrawal_tagged': 'This period is tagged as a withdrawal bleed and will be excluded from natural cycle statistics.',
    'log.stats': 'Statistics',
    'log.ignore_averages_question': 'Exclude from cycle averages?',
    'log.ignore_averages_desc': 'For irregular cycles (stress, illness, etc.)',
    'log.ignore_tagged': 'This period will be excluded from cycle length calculations and averages.',
    'log.no_period_advanced': 'This date is not part of a period. Start or select a period day to access advanced options.',
};

vi.mock('../contexts/MoonevaContext', () => ({
    useMooneva: () => mockMooneva.value,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => translations[key] ?? fallback ?? key,
    }),
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

const activePeriod: PeriodRecord = {
    id: 'period-1',
    startDate: '2026-06-19',
    days: 3,
    isWithdrawalBleed: false,
    ignoreForAverages: false,
};

function buildContext(periods: PeriodRecord[] = []) {
    return {
        logs: {},
        settings: baseSettings,
        periods,
        model: {
            cycles: [],
            predictions: {
                effective: {
                    cycleLength: 28,
                    periodLength: 5,
                    source: 'settings',
                },
            },
            getDayMeta: (date: string) => ({
                date,
                isToday: false,
                isValidMonth: true,
                isPeriod: false,
                isBleeding: false,
                isSpotting: false,
                isForecastPeriod: false,
                isFertile: false,
                isOvulation: false,
                isPMS: false,
                isUnavailableFuture: false,
            }),
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

function renderPanel(date = '2026-06-19', periods: PeriodRecord[] = []) {
    mockMooneva.value = buildContext(periods);
    const user = userEvent.setup();
    const view = render(<DailyLogPanel date={date} />);

    return {
        user,
        ...view,
        rerenderPanel: (nextDate: string, nextPeriods: PeriodRecord[] = periods) => {
            mockMooneva.value = buildContext(nextPeriods);
            view.rerender(<DailyLogPanel date={nextDate} />);
        },
    };
}

describe('DailyLogPanel advanced disclosure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('removes Advanced from the top tab row and shows it as a collapsed Flow disclosure', () => {
        renderPanel('2026-06-19', [activePeriod]);

        const tabRow = screen.getByLabelText('Daily log tabs');

        expect(within(tabRow).queryByRole('button', { name: 'Advanced' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Advanced' }).getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText('Was this a withdrawal bleed?')).toBeNull();
    });

    it('opens and closes Advanced under Flow', async () => {
        const { user } = renderPanel('2026-06-19', [activePeriod]);
        const advancedButton = screen.getByRole('button', { name: 'Advanced' });

        await user.click(advancedButton);

        expect(advancedButton.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText('Was this a withdrawal bleed?')).toBeDefined();

        await user.click(advancedButton);

        expect(advancedButton.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText('Was this a withdrawal bleed?')).toBeNull();
    });

    it('shows active-period controls when Advanced is open on a period date', async () => {
        const { user } = renderPanel('2026-06-19', [activePeriod]);

        await user.click(screen.getByRole('button', { name: 'Advanced' }));

        expect(screen.getByText('Was this a withdrawal bleed?')).toBeDefined();
        expect(screen.getByText('Exclude from cycle averages?')).toBeDefined();
    });

    it('shows disabled option previews with guidance when Advanced is open outside a period', async () => {
        const { user } = renderPanel('2026-06-19', []);

        await user.click(screen.getByRole('button', { name: 'Advanced' }));

        const guidance = screen.getByText('This date is not part of a period. Start or select a period day to access advanced options.');
        const withdrawalLabel = screen.getByText('Was this a withdrawal bleed?');
        const withdrawalPreview = withdrawalLabel.closest('[aria-disabled="true"]');
        const averagesPreview = screen.getByText('Exclude from cycle averages?').closest('[aria-disabled="true"]');

        expect(Boolean(guidance.compareDocumentPosition(withdrawalLabel) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
        expect(withdrawalPreview).toBeDefined();
        expect(averagesPreview).toBeDefined();
        expect(guidance).toBeDefined();

        await user.click(screen.getByText('Was this a withdrawal bleed?'));

        expect(mockMooneva.value.actions.updatePeriodWithdrawalBleed).not.toHaveBeenCalled();
    });

    it('collapses Advanced when the selected date changes', async () => {
        const { user, rerenderPanel } = renderPanel('2026-06-19', [activePeriod]);
        const advancedButton = screen.getByRole('button', { name: 'Advanced' });

        await user.click(advancedButton);

        expect(advancedButton.getAttribute('aria-expanded')).toBe('true');

        rerenderPanel('2026-06-20', [activePeriod]);

        expect(screen.getByRole('button', { name: 'Advanced' }).getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText('Was this a withdrawal bleed?')).toBeNull();
    });
});
