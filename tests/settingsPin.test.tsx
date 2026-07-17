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
    'settings.pin_lock': 'PIN Lock',
    'settings.pin_disabled_desc': 'Set a 4-12 digit PIN',
    'settings.enter_pin': 'Enter 4-12 digit PIN',
    'settings.repeat_pin': 'Repeat PIN',
    'settings.enable_pin': 'Enable PIN',
    'settings.pin_security_desc': 'Your health data is encrypted on this device. This PIN controls access to the app.',
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

function renderSettings(onUpdate = vi.fn()) {
    render(
        <Settings
            settings={baseSettings}
            onUpdate={onUpdate}
            onClose={vi.fn()}
            subView="main"
            onSubViewChange={vi.fn()}
            periods={[]}
            onUpdatePeriodWithdrawalBleed={vi.fn(async () => undefined)}
            onViewChange={vi.fn()}
        />
    );
    return onUpdate;
}

describe('Settings PIN setup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(['1234', '123456789012'])('saves a supported %s PIN', async (pin) => {
        const user = userEvent.setup();
        const onUpdate = renderSettings();

        await user.click(screen.getByText('PIN Lock'));
        await user.type(screen.getByPlaceholderText('Enter 4-12 digit PIN'), pin);
        await user.type(screen.getByPlaceholderText('Repeat PIN'), pin);
        await user.click(screen.getByRole('button', { name: 'Enable PIN' }));

        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ pin }));
    });

    it('caps PIN setup input at 12 numeric digits', async () => {
        const user = userEvent.setup();
        renderSettings();

        await user.click(screen.getByText('PIN Lock'));
        const input = screen.getByPlaceholderText('Enter 4-12 digit PIN') as HTMLInputElement;
        await user.type(input, '12ab345678901234');

        expect(input.maxLength).toBe(12);
        expect(input.value).toBe('123456789012');
    });

    it('rejects a PIN shorter than 4 digits', async () => {
        const user = userEvent.setup();
        const onUpdate = renderSettings();
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

        await user.click(screen.getByText('PIN Lock'));
        await user.type(screen.getByPlaceholderText('Enter 4-12 digit PIN'), '123');
        await user.type(screen.getByPlaceholderText('Repeat PIN'), '123');
        await user.click(screen.getByRole('button', { name: 'Enable PIN' }));

        expect(alertSpy).toHaveBeenCalledWith('settings.pin_error');
        expect(onUpdate).not.toHaveBeenCalled();
        alertSpy.mockRestore();
    });
});
