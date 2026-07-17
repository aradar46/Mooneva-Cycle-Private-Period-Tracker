import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DayCell } from '../components/calendar/DayCell';
import type { AppSettings, DailyLog, DayMeta } from '../types';

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

const baseLog: DailyLog = {
    date: '2026-06-19',
    flow: null,
    symptoms: [],
    notes: '',
};

function renderDayCell(log: DailyLog) {
    render(
        <DayCell
            date={new Date(2026, 5, 19)}
            dateStr="2026-06-19"
            isCurrentMonth
            meta={baseMeta}
            log={log}
            hasLog
            isSelected={false}
            isEditMode={false}
            settings={baseSettings}
            onDateClick={vi.fn()}
            idx={0}
        />
    );
}

describe('calendar sex markers', () => {
    it('shows protected sex as a purple heart-shield inside the left edge without shifting the date', () => {
        renderDayCell({ ...baseLog, sexType: 'protected' });

        const marker = screen.getByLabelText('Protected sex');
        const dayNumber = document.querySelector('.calendar-day-number');

        expect(marker.getAttribute('class')).toContain('calendar-sex-marker-edge');
        expect(marker.getAttribute('class')).toContain('calendar-sex-marker-heart-shield');
        expect(marker.getAttribute('class')).toContain('calendar-sex-marker-protected');
        expect(marker.getAttribute('class')).toContain('absolute');
        expect(marker.getAttribute('class')).toContain('text-purple-500');
        expect(marker.closest('.calendar-date-row')).toBeNull();
        expect(dayNumber?.textContent).toBe('19');
    });

    it('shows unprotected sex as a purple heart in the same edge position', () => {
        renderDayCell({ ...baseLog, sexType: 'unprotected' });

        const marker = screen.getByLabelText('Unprotected sex');

        expect(marker.getAttribute('class')).toContain('calendar-sex-marker-edge');
        expect(marker.getAttribute('class')).toContain('calendar-sex-marker-heart');
        expect(marker.getAttribute('class')).toContain('calendar-sex-marker-unprotected');
        expect(marker.getAttribute('class')).toContain('absolute');
        expect(marker.getAttribute('class')).toContain('text-purple-500');
    });
});
