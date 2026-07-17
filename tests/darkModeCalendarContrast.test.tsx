import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    'calendar.category_fertility': 'Fertility',
    'calendar.category_logs': 'Log Details',
    'calendar.legend.flow_logged': 'Flow Logged',
    'calendar.legend.mid_flow_pause': 'Mid-flow period pause',
    'calendar.legend.predicted_period': 'Expected Period',
    'calendar.legend.cycle_start': 'Cycle Start',
    'calendar.legend.withdrawal_bleed': 'Withdrawal Bleed (Pill Bleed)',
    'calendar.legend.spotting': 'Spotting',
    'calendar.legend.fertile_window': 'Fertile Window',
    'calendar.legend.pms': 'PMS Days',
    'calendar.legend.symptoms': 'Symptoms',
    'calendar.legend.pill_logged': 'Pill logged',
    'calendar.legend.protected_sex': 'Protected sex',
    'calendar.legend.unprotected_sex': 'Unprotected sex',
    'calendar.legend.notes': 'Day Notes',
    'calendar.legend.today': 'Today',
    'calendar.legend.selected': 'Selected Day',
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
};

const renderOpenGuide = () => {
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
            onMonthChange={vi.fn()}
        />
    );

    fireEvent.click(screen.getByText('Show Guide'));
    return document.querySelector('.calendar-guide-list') as HTMLElement;
};

describe('dark mode calendar contrast', () => {
    it('does not turn hover-only calendar day backgrounds into permanent dark fills', () => {
        const css = readFileSync(join(process.cwd(), 'index.css'), 'utf8');

        expect(css).not.toContain('[class*="bg-white/70"]');
        expect(css).not.toContain('[class*="bg-rose-50"]');
        expect(css).not.toContain('[class*="bg-rose-100"]');
        expect(css).not.toContain('[class*="bg-blue-50"]');
        expect(css).not.toContain('[class*="bg-slate-50/40"]');
        expect(css).not.toContain('[class*="bg-emerald-100"]');
    });

    it('gives legend states semantic hooks for dark-mode colors and rings', () => {
        const guideList = renderOpenGuide();
        const inGuide = within(guideList);

        expect(inGuide.getByText('Flow & Bleeding').className).toContain('calendar-guide-section-flow');
        expect(inGuide.getByText('Fertility').className).toContain('calendar-guide-section-fertility');
        expect(inGuide.getByText('Log Details').className).toContain('calendar-guide-section-logs');

        const markerFor = (label: string) => {
            const row = inGuide.getByText(label).closest('.flex');
            expect(row).toBeTruthy();
            return row!.firstElementChild as HTMLElement;
        };

        expect(markerFor('Period').className).toContain('calendar-guide-period-marker');
        expect(markerFor('Mid-flow period pause').className).toContain('calendar-guide-period-soft-marker');
        expect(markerFor('Cycle Start').className).toContain('calendar-guide-period-marker');
        expect(markerFor('Withdrawal Bleed (Pill Bleed)').className).toContain('calendar-guide-period-marker');
        const protectedSexMarker = markerFor('Protected sex');
        const unprotectedSexMarker = markerFor('Unprotected sex');
        expect(protectedSexMarker.className).toContain('calendar-guide-sex-protected-marker');
        expect(unprotectedSexMarker.className).toContain('calendar-guide-sex-unprotected-marker');
        expect(protectedSexMarker.querySelector('.calendar-sex-marker-heart-shield')?.getAttribute('class')).toContain('text-purple-500');
        expect(unprotectedSexMarker.querySelector('.calendar-sex-marker-heart')?.getAttribute('class')).toContain('text-purple-500');
        expect(markerFor('Today').className).toContain('calendar-guide-today-marker');
        expect(markerFor('Selected Day').className).toContain('calendar-guide-selected-marker');
    });
});
