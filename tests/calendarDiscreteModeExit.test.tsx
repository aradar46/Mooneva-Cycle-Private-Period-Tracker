import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarScreen } from '../components/screens/CalendarScreen';
import type { AppSettings } from '../types';

const mockMooneva = vi.hoisted((): { value: unknown } => ({ value: null }));

vi.mock('../contexts/MoonevaContext', () => ({
    useMooneva: () => mockMooneva.value,
}));

vi.mock('../hooks/useDiscreteMode', () => ({
    useDiscreteMode: () => ({
        dummyTasks: [],
        toggleDummyTask: vi.fn(),
        updateDummyTaskText: vi.fn(),
        addDummyTask: vi.fn(),
    }),
}));

vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Calendar', () => ({ default: () => null }));
vi.mock('../components/DailyLogPanel', () => ({ default: () => null }));
vi.mock('../components/DayPreview', () => ({ DayPreview: () => null }));
vi.mock('../components/TimelineView', () => ({ default: () => null }));
vi.mock('../components/BottomNav', () => ({ default: () => null }));

vi.mock('react-i18next', () => ({
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
    useTranslation: () => ({ t: (key: string) => key }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const settings = {
    discreteMode: true,
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

describe('CalendarScreen discrete mode exit', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockMooneva.value = {
            logs: {},
            periods: [],
            settings,
            model: {
                cycles: [],
                predictions: {
                    nextPeriodStart: null,
                    fertileWindow: null,
                },
                getDayMeta: () => ({ header: null }),
            },
            actions: {
                bulkUpdateLogs: vi.fn(async () => undefined),
                restorePeriods: vi.fn(),
                toggleBleedingDay: vi.fn(async () => undefined),
                updateSettings: vi.fn(),
            },
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('requests a discrete-mode exit after a two-second long press', () => {
        const onRequestExitDiscreteMode = vi.fn();

        render(
            <CalendarScreen
                setSubView={vi.fn()}
                setView={vi.fn()}
                isCloaked
                onRequestExitDiscreteMode={onRequestExitDiscreteMode}
            />
        );

        const secretButton = screen.getByRole('button');
        fireEvent.touchStart(secretButton);
        act(() => vi.advanceTimersByTime(2000));
        fireEvent.touchEnd(secretButton);

        expect(onRequestExitDiscreteMode).toHaveBeenCalledOnce();
    });
});
