import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '../components/Settings';
import type { AppSettings } from '../types';

const mockI18n = vi.hoisted(() => ({
    language: 'en',
    changeLanguage: vi.fn(),
}));

const translations: Record<string, string> = {
    'settings.first_day_of_week': 'First day of week',
    'settings.first_day_of_week_desc': 'Calendar weeks start on',
    'settings.week_start_monday': 'Monday',
    'settings.week_start_sunday': 'Sunday',
    'settings.week_start_saturday': 'Saturday',
    'settings.use_language_default': 'Use language default',
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: mockI18n,
        t: (key: string) => translations[key] ?? key,
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
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

function getFirstDaySelect(): HTMLSelectElement {
    return screen.getByLabelText('First day of week') as HTMLSelectElement;
}

function renderSettings(settings: AppSettings, onUpdate = vi.fn()) {
    render(
        <Settings
            settings={settings}
            onUpdate={onUpdate}
            onClose={vi.fn()}
            subView="main"
            onSubViewChange={vi.fn()}
            periods={[]}
            onUpdatePeriodWithdrawalBleed={vi.fn(() => Promise.resolve())}
            onViewChange={vi.fn()}
        />
    );

    return { onUpdate };
}

describe('Settings first day of week picker', () => {
    beforeEach(() => {
        mockI18n.language = 'en';
        vi.clearAllMocks();
    });

    it('shows the language default when no override is set', () => {
        renderSettings(baseSettings);

        expect(getFirstDaySelect().value).toBe('monday');
    });

    it('saves a concrete picker selection', async () => {
        const user = userEvent.setup();
        const { onUpdate } = renderSettings(baseSettings);

        await user.selectOptions(getFirstDaySelect(), 'saturday');

        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
            firstDayOfWeek: 'saturday',
        }));
    });

    it('clears the override when the reset action is used', async () => {
        const user = userEvent.setup();
        const { onUpdate } = renderSettings({
            ...baseSettings,
            firstDayOfWeek: 'sunday',
        });

        await user.click(screen.getByRole('button', { name: 'Use language default' }));

        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
            firstDayOfWeek: undefined,
        }));
    });
});
