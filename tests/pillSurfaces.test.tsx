import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DayPreview } from '../components/DayPreview';
import { DayCell } from '../components/calendar/DayCell';
import { generateBackup } from '../services/logic/storage';
import type { AppSettings, DailyLog, DayMeta } from '../types';

const mockMooneva = vi.hoisted(() => ({
    value: {} as any,
}));

vi.mock('../contexts/MoonevaContext', () => ({
    useMooneva: () => mockMooneva.value,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: {
            language: 'en',
            dir: () => 'ltr',
        },
        t: (key: string, fallback?: string | { time: string }) => {
            const translations: Record<string, string> = {
                'log.pill_badge': 'Pill',
                'log.pill_taken_at': 'Pill taken at {{time}}',
                'log.tap_to_edit': 'Tap to Edit',
            };
            const translated = translations[key] ?? fallback ?? key;
            if (typeof fallback === 'object' && fallback !== null && 'time' in fallback) {
                return translated.replace('{{time}}', String((fallback as { time: string }).time));
            }
            return translated;
        },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('capacitor-secure-storage-plugin', () => ({
    SecureStoragePlugin: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        writeFile: vi.fn(),
    },
    Directory: { Cache: 'CACHE' },
}));

vi.mock('@capacitor/share', () => ({
    Share: {
        share: vi.fn(),
    },
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

const pillOnlyLog: DailyLog = {
    date: '2026-06-19',
    flow: null,
    symptoms: [],
    notes: '',
    pillTakenAt: '11:32',
};

async function readBlobText(blob: Blob): Promise<string> {
    return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
    });
}

describe('pill logging surfaces', () => {
    it('shows a pill time badge in day preview for pill-only days', () => {
        mockMooneva.value = {
            logs: {
                '2026-06-19': pillOnlyLog,
            },
            periods: [],
            model: {
                getDayMeta: () => baseMeta,
            },
        };

        render(<DayPreview date="2026-06-19" onClose={vi.fn()} onEdit={vi.fn()} />);

        expect(screen.getByLabelText('Pill taken at 11:32')).toBeDefined();
        expect(screen.getByText('Pill')).toBeDefined();
        expect(screen.getByText('11:32')).toBeDefined();
    });

    it('shows a distinct pill-taken indicator in day cells', () => {
        render(
            <DayCell
                date={new Date(2026, 5, 19)}
                dateStr="2026-06-19"
                isCurrentMonth
                meta={baseMeta}
                log={pillOnlyLog}
                hasLog
                isSelected={false}
                isEditMode={false}
                settings={baseSettings}
                onDateClick={vi.fn()}
                idx={0}
            />
        );

        expect(screen.getByLabelText('Pill taken')).toBeDefined();
    });

    it('includes pillTakenAt in plain JSON backup data', async () => {
        const result = await generateBackup({
            data: {
                '2026-06-19': pillOnlyLog,
            },
            settings: baseSettings,
            timestamp: '2026-06-19T09:32:00.000Z',
        }, undefined);

        const parsed = JSON.parse(await readBlobText(result.blob));

        expect(parsed.data['2026-06-19'].pillTakenAt).toBe('11:32');
    });
});
