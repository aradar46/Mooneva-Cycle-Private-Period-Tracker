import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCalendarSystem } from '../hooks/useCalendarSystem';

const mockI18n = vi.hoisted(() => ({
    language: 'en',
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: mockI18n,
        t: (key: string) => key,
    }),
}));

describe('useCalendarSystem week start', () => {
    beforeEach(() => {
        mockI18n.language = 'en';
    });

    it('uses Monday-first Gregorian calendars by default', () => {
        const { result } = renderHook(() => useCalendarSystem());

        expect(result.current.weekDayKeys).toEqual(['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']);

        const grid = result.current.getMonthGrid(2024, 4);
        expect(grid[0]).toMatchObject({ isCurrentMonth: false, label: 29 });
        expect(grid.find(cell => cell.isCurrentMonth)?.label).toBe(1);
    });

    it('honors a Sunday override for Gregorian calendars', () => {
        const { result } = renderHook(() => useCalendarSystem('sunday'));

        expect(result.current.weekDayKeys).toEqual(['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa']);

        const grid = result.current.getMonthGrid(2024, 4);
        expect(grid[0]).toMatchObject({ isCurrentMonth: false, label: 28 });
        expect(grid.find(cell => cell.isCurrentMonth)?.label).toBe(1);
    });

    it('uses Saturday-first Jalaali calendars by default for Persian', () => {
        mockI18n.language = 'fa';
        const { result } = renderHook(() => useCalendarSystem());

        expect(result.current.name).toBe('jalaali');
        expect(result.current.weekDayKeys).toEqual(['sa', 'su', 'mo', 'tu', 'we', 'th', 'fr']);

        const grid = result.current.getMonthGrid(1403, 0);
        expect(grid[0]).toMatchObject({ isCurrentMonth: false, label: 26 });
        expect(grid.find(cell => cell.isCurrentMonth)?.label).toBe(1);
    });

    it('honors a Monday override for Jalaali calendars', () => {
        mockI18n.language = 'fa';
        const { result } = renderHook(() => useCalendarSystem('monday'));

        expect(result.current.name).toBe('jalaali');
        expect(result.current.weekDayKeys).toEqual(['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']);

        const grid = result.current.getMonthGrid(1403, 0);
        expect(grid[0]).toMatchObject({ isCurrentMonth: false, label: 28 });
        expect(grid.find(cell => cell.isCurrentMonth)?.label).toBe(1);
    });
});
