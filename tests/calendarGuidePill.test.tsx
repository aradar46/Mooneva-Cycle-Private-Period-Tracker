import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Calendar from '../components/Calendar';
import type { AppSettings, DayMeta } from '../types';

const translations: Record<string, string> = {
    'calendar.guide.show': 'Show Guide',
    'calendar.guide.hide': 'Hide Guide',
    'calendar.legend_title': 'Legend',
    'calendar.guide_subtitle': 'Guide to symbols',
    'calendar.how_to_log_period_title': 'Log your period',
    'calendar.how_to_log_period_body': 'Tap days to log a period.',
    'calendar.how_to_log_period_tip': 'Swipe to older months first.',
    'calendar.how_to_log_daily_title': 'Log daily symptoms',
    'calendar.how_to_log_daily_body': 'Tap any day to log details.',
    'calendar.category_flow': 'Flow & Bleeding',
    'calendar.category_logs': 'Log Details',
    'calendar.legend.pill_logged': 'Pill logged',
    'common.today': 'Today',
};

vi.mock('react-i18next', () => ({
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
    showFertileWindow: false,
    showPMS: true,
};

const baseMeta: DayMeta = {
    date: '2026-06-19',
    isToday: false,
    isValidMonth: true,
    isPeriod: false,
    isBleeding: false,
    isSpotting: false,
    isForecastPeriod: false,
    isFertile: false,
    isOvulation: false,
    isPMS: false,
};

describe('Calendar guide pill legend', () => {
    it('explains the pill logged calendar indicator', () => {
        render(
            <Calendar
                currentDate={new Date(2026, 5, 1)}
                onDateClick={vi.fn()}
                selectedDate={null}
                cycleStatus={{ title: '', subtitle: '', statusVariant: 'neutral' }}
                logs={{}}
                getDayMeta={(date) => ({ ...baseMeta, date })}
                settings={baseSettings}
                isCloaked={false}
                onMonthChange={vi.fn()}
            />
        );

        fireEvent.click(screen.getByText('Show Guide'));

        expect(screen.getByText('Pill logged')).toBeDefined();
    });
});
