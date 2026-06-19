import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DailyLogPanel from '../components/DailyLogPanel';
import type { AppSettings } from '../types';

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
    'log.pill_time': 'Pill time',
};

vi.mock('../contexts/MoonevaContext', () => ({
    useMooneva: () => mockMooneva.value,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => translations[key] ?? fallback ?? key,
    }),
}));

vi.mock('../utils/timeFormat', () => ({
    formatLocalTimeHHmm: () => '11:32',
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

function buildContext(log: any = undefined) {
    return {
        logs: log ? { '2026-06-19': log } : {},
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

function renderPanel(log: any = undefined) {
    mockMooneva.value = buildContext(log);
    const user = userEvent.setup();
    render(<DailyLogPanel date="2026-06-19" />);
    return { user };
}

describe('DailyLogPanel pill logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('records the current HH:mm time when Took pill is checked', async () => {
        const { user } = renderPanel();

        await user.click(screen.getByRole('button', { name: 'Pill' }));
        await user.click(screen.getByLabelText('Took pill'));

        await waitFor(() => {
            expect(mockMooneva.value.actions.updateLog).toHaveBeenLastCalledWith('2026-06-19', expect.objectContaining({
                pillTakenAt: '11:32',
            }));
        });
        expect((screen.getByLabelText('Pill time') as HTMLInputElement).value).toBe('11:32');
    });

    it('edits and removes pill time', async () => {
        const { user } = renderPanel({
            date: '2026-06-19',
            flow: null,
            symptoms: [],
            notes: '',
            pillTakenAt: '10:15',
        });

        await user.click(screen.getByRole('button', { name: 'Pill' }));
        const timeInput = await screen.findByLabelText('Pill time');
        fireEvent.change(timeInput, { target: { value: '08:05' } });

        await waitFor(() => {
            expect(mockMooneva.value.actions.updateLog).toHaveBeenLastCalledWith('2026-06-19', expect.objectContaining({
                pillTakenAt: '08:05',
            }));
        });

        await user.click(screen.getByLabelText('Took pill'));

        await waitFor(() => {
            expect(mockMooneva.value.actions.updateLog).toHaveBeenLastCalledWith('2026-06-19', expect.objectContaining({
                pillTakenAt: undefined,
            }));
        });
    });
});
