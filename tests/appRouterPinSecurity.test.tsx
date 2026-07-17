import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '../components/AppRouter';
import type { AppSettings } from '../types';

const mockMooneva = vi.hoisted((): { value: unknown } => ({ value: null }));
const calendarProps = vi.hoisted((): { onRequestExitDiscreteMode?: () => void } => ({}));

vi.mock('../contexts/MoonevaContext', () => ({
    useMooneva: () => mockMooneva.value,
}));

vi.mock('../hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        view: 'calendar',
        setView: vi.fn(),
        subView: 'main',
        setSubView: vi.fn(),
        previousView: null,
    }),
}));

vi.mock('../hooks/useAppTheme', () => ({ useAppTheme: vi.fn() }));
vi.mock('../hooks/useAppReview', () => ({ useAppReview: vi.fn() }));
vi.mock('../services/notifications', () => ({ clearDeliveredNotifications: vi.fn() }));

vi.mock('@capacitor/app', () => ({
    App: {
        addListener: vi.fn(async () => ({ remove: vi.fn() })),
    },
}));

vi.mock('../components/OnboardingWizard', () => ({ default: () => null }));
vi.mock('../components/screens/TrendsScreen', () => ({ TrendsScreen: () => null }));
vi.mock('../components/screens/SettingsScreen', () => ({ SettingsScreen: () => null }));
vi.mock('../components/screens/NotificationManagerScreen', () => ({ NotificationManagerScreen: () => null }));
vi.mock('../components/screens/CalendarScreen', () => ({
    CalendarScreen: (props: { onRequestExitDiscreteMode?: () => void }) => {
        calendarProps.onRequestExitDiscreteMode = props.onRequestExitDiscreteMode;
        return null;
    },
}));

const translations: Record<string, string> = {
    'settings.pin_lock': 'PIN Lock',
    'settings.pin_unlock_prompt': 'Enter your PIN (4-12 digits)',
    'settings.pin_exit_discrete_prompt': 'Enter your PIN to exit discrete mode',
    'settings.pin_placeholder': '4-12 digit PIN',
    'settings.incorrect_pin': 'Incorrect PIN.',
    'common.unlock': 'Unlock',
    'common.cancel': 'Cancel',
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => translations[key] ?? key,
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const baseSettings = {
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
} satisfies AppSettings;

function setContext(settings: AppSettings, isLoading: boolean) {
    const updateSettings = vi.fn();
    mockMooneva.value = {
        settings,
        isLoading,
        logs: {},
        periods: [],
        model: {
            cycles: [],
            predictions: {},
            getDayMeta: vi.fn(),
        },
        actions: {
            updateLog: vi.fn(async () => undefined),
            bulkUpdateLogs: vi.fn(async () => undefined),
            deleteLog: vi.fn(async () => undefined),
            updateSettings,
            completeOnboarding: vi.fn(async () => undefined),
            startPeriod: vi.fn(async () => undefined),
            editPeriod: vi.fn(async () => undefined),
            deletePeriod: vi.fn(async () => undefined),
            toggleBleedingDay: vi.fn(async () => undefined),
            updatePeriodWithdrawalBleed: vi.fn(async () => undefined),
            updatePeriodIgnoreForAverages: vi.fn(async () => undefined),
            restorePeriods: vi.fn(),
        },
    };
    return updateSettings;
}

function requestDiscreteExit() {
    const request = calendarProps.onRequestExitDiscreteMode;
    if (!request) throw new Error('Calendar did not receive the discrete exit request callback.');
    act(() => request());
}

function submitPin(pin: string) {
    fireEvent.change(screen.getByPlaceholderText('4-12 digit PIN'), {
        target: { value: pin },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
}

describe('AppRouter PIN security', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete calendarProps.onRequestExitDiscreteMode;
    });

    it('keeps a cold-started app locked when the saved PIN arrives after loading', () => {
        setContext({ ...baseSettings, pin: undefined }, true);
        const { rerender } = render(<AppRouter />);

        setContext({ ...baseSettings, pin: '1234' }, false);
        rerender(<AppRouter />);

        expect(screen.getByText('Enter your PIN (4-12 digits)')).toBeDefined();
    });

    it('checks the saved PIN before showing onboarding', () => {
        setContext({ ...baseSettings, onboardingCompleted: false, pin: '1234' }, false);
        render(<AppRouter />);

        expect(screen.getByText('Enter your PIN (4-12 digits)')).toBeDefined();
    });

    it('opens normally after loading when no PIN exists', () => {
        setContext({ ...baseSettings, pin: undefined }, false);
        render(<AppRouter />);

        expect(calendarProps.onRequestExitDiscreteMode).toBeTypeOf('function');
        expect(screen.queryByText('Enter your PIN (4-12 digits)')).toBeNull();
    });

    it('does not relock an unlocked session when the first PIN is saved', () => {
        setContext({ ...baseSettings, pin: undefined }, false);
        const { rerender } = render(<AppRouter />);

        setContext({ ...baseSettings, pin: '123456' }, false);
        rerender(<AppRouter />);

        expect(screen.queryByText('Enter your PIN (4-12 digits)')).toBeNull();
        expect(calendarProps.onRequestExitDiscreteMode).toBeTypeOf('function');
    });

    it('requires confirmation before exiting discrete mode when a PIN exists', () => {
        const updateSettings = setContext({
            ...baseSettings,
            discreteMode: true,
            pin: '1234',
        }, false);
        render(<AppRouter />);

        submitPin('1234');
        requestDiscreteExit();
        expect(screen.getByText('Enter your PIN to exit discrete mode')).toBeDefined();
        expect(updateSettings).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByText('Enter your PIN to exit discrete mode')).toBeNull();
        expect(updateSettings).not.toHaveBeenCalled();

        requestDiscreteExit();
        submitPin('1234');
        expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ discreteMode: false }));
    });

    it('exits discrete mode directly when no PIN exists', () => {
        const updateSettings = setContext({
            ...baseSettings,
            discreteMode: true,
            pin: undefined,
        }, false);
        render(<AppRouter />);

        requestDiscreteExit();
        expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ discreteMode: false }));
        expect(screen.queryByText('Enter your PIN to exit discrete mode')).toBeNull();
    });
});
