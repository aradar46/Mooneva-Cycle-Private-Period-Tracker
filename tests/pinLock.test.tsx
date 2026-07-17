import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PinLock from '../components/PinLock';

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
        t: (key: string, fallback?: string) => translations[key] ?? fallback ?? key,
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

describe('PinLock', () => {
    it('accepts up to 12 numeric digits', () => {
        render(<PinLock correctPin="123456789012" onUnlock={vi.fn()} />);

        const input = screen.getByPlaceholderText('4-12 digit PIN') as HTMLInputElement;
        expect(input.inputMode).toBe('numeric');
        expect(input.maxLength).toBe(12);

        fireEvent.change(input, { target: { value: '12ab345678901234' } });

        expect(input.value).toBe('123456789012');
    });

    it('unlocks with a matching 12-digit PIN', () => {
        const onUnlock = vi.fn();
        render(<PinLock correctPin="123456789012" onUnlock={onUnlock} />);

        fireEvent.change(screen.getByPlaceholderText('4-12 digit PIN'), {
            target: { value: '123456789012' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));

        expect(onUnlock).toHaveBeenCalledOnce();
    });

    it('shows PIN-specific feedback without unlocking for a wrong PIN', () => {
        const onUnlock = vi.fn();
        render(<PinLock correctPin="1234" onUnlock={onUnlock} />);

        fireEvent.change(screen.getByPlaceholderText('4-12 digit PIN'), {
            target: { value: '9999' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));

        expect(screen.getByText('Incorrect PIN.')).toBeDefined();
        expect(onUnlock).not.toHaveBeenCalled();
    });

    it('uses exit-specific copy and supports cancellation', () => {
        const onCancel = vi.fn();
        render(
            <PinLock
                purpose="exitDiscreteMode"
                correctPin="1234"
                onUnlock={vi.fn()}
                onCancel={onCancel}
            />
        );

        expect(screen.getByText('Enter your PIN to exit discrete mode')).toBeDefined();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalledOnce();
    });
});
