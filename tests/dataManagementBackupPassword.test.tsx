import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DataManagementView from '../components/settings/DataManagementView';
import type { AppSettings } from '../types';

const storageMocks = vi.hoisted(() => ({
    generateEncryptedBackup: vi.fn(),
    shareOrDownloadBackup: vi.fn(),
    loadData: vi.fn(async () => ({})),
    wipeAllData: vi.fn(),
    decryptBackup: vi.fn(),
    saveData: vi.fn(),
    generateBackup: vi.fn(async () => ({
        blob: new Blob(['{}'], { type: 'application/json' }),
        filename: 'mooneva-backup.json',
    })),
    restoreBackup: vi.fn(),
    loadPeriods: vi.fn(async () => []),
    savePeriods: vi.fn(),
    parseExternalImport: vi.fn(),
}));

vi.mock('../services/logic', () => storageMocks);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
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

describe('DataManagementView encrypted backup password', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each(['', '   '])('blocks encrypted export for password %j', async (password) => {
        const user = userEvent.setup();
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

        render(
            <DataManagementView
                settings={baseSettings}
                onUpdate={vi.fn()}
                onBack={vi.fn()}
            />
        );

        await user.click(screen.getByRole('checkbox', { name: 'settings.protect_with_password' }));
        if (password) {
            await user.type(screen.getByPlaceholderText('settings.enter_password...'), password);
        }
        await user.click(screen.getByRole('button', { name: 'common.export' }));

        expect(alertSpy).toHaveBeenCalledWith('errors.backup_password');
        expect(storageMocks.loadData).not.toHaveBeenCalled();
        expect(storageMocks.generateBackup).not.toHaveBeenCalled();
        expect(storageMocks.shareOrDownloadBackup).not.toHaveBeenCalled();
    });
});
