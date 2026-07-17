import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Calendar from '../components/Calendar';
import type { AppSettings, DayMeta } from '../types';

const translations: Record<string, string> = {
    'calendar.guide.show': 'Show Guide',
    'calendar.prev_month': 'Previous month',
    'calendar.next_month': 'Next month',
    'common.today': 'Today',
};

vi.mock('react-i18next', () => ({
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
    useTranslation: () => ({
        i18n: {
            language: 'en',
        },
        t: (key: string, fallback?: string) => translations[key] ?? fallback ?? key,
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
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

const baseMeta: DayMeta = {
    date: '2026-07-01',
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
};

const renderCalendar = (onMonthChange: ReturnType<typeof vi.fn>) => {
    render(
        <Calendar
            currentDate={new Date(2026, 6, 1)}
            onDateClick={vi.fn()}
            selectedDate={null}
            cycleStatus={{ title: '', subtitle: '', statusVariant: 'neutral' }}
            logs={{}}
            getDayMeta={(date) => ({ ...baseMeta, date })}
            settings={baseSettings}
            isCloaked={false}
            onMonthChange={onMonthChange}
        />
    );
    const surface = document.querySelector('.calendar-swipe-surface') as HTMLElement;
    const grid = document.querySelector('.calendar-month-grid') as HTMLElement;
    expect(surface).toBeTruthy();
    expect(grid).toBeTruthy();
    return { surface, grid };
};

describe('Calendar swipe motion', () => {
    it('follows the finger and slides to the next month past the threshold', () => {
        vi.useFakeTimers();
        const onMonthChange = vi.fn();
        const { surface, grid } = renderCalendar(onMonthChange);

        fireEvent.touchStart(surface, { targetTouches: [{ clientX: 500, clientY: 100 }] });
        fireEvent.touchMove(surface, { targetTouches: [{ clientX: 100, clientY: 100 }] });

        // dragging: content tracks the finger 1:1, unanimated
        expect(grid.style.transform).toBe('translateX(-400px)');
        expect(grid.style.transition).toBe('none');

        fireEvent.touchEnd(surface);

        // past threshold: animated slide fully off-screen, month not swapped yet
        expect(grid.style.transition).toContain('transform');
        expect(grid.style.transform).toBe(`translateX(-${window.innerWidth}px)`);
        expect(onMonthChange).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(250);
        });

        expect(onMonthChange).toHaveBeenCalledTimes(1);
        expect(onMonthChange.mock.calls[0][0]).toEqual(new Date(2026, 7, 1));
        vi.useRealTimers();
    });

    it('springs back without changing month on a short drag', () => {
        vi.useFakeTimers();
        const onMonthChange = vi.fn();
        const { surface, grid } = renderCalendar(onMonthChange);

        fireEvent.touchStart(surface, { targetTouches: [{ clientX: 220, clientY: 100 }] });
        fireEvent.touchMove(surface, { targetTouches: [{ clientX: 200, clientY: 100 }] });
        fireEvent.touchEnd(surface);

        expect(grid.style.transform).toBe('translateX(0px)');

        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(onMonthChange).not.toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('ignores a tap and small movements below the axis lock', () => {
        vi.useFakeTimers();
        const onMonthChange = vi.fn();
        const { surface, grid } = renderCalendar(onMonthChange);

        fireEvent.touchStart(surface, { targetTouches: [{ clientX: 220, clientY: 100 }] });
        fireEvent.touchMove(surface, { targetTouches: [{ clientX: 215, clientY: 100 }] });
        fireEvent.touchEnd(surface);

        expect(grid.style.transform).toBe('translateX(0px)');

        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(onMonthChange).not.toHaveBeenCalled();
        vi.useRealTimers();
    });
});
