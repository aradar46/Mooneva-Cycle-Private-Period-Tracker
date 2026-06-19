import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSettings } from '../services/logic/storage';

vi.mock('capacitor-secure-storage-plugin', () => ({
    SecureStoragePlugin: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
    },
}));

vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        writeFile: vi.fn(),
    },
    Directory: { Documents: 'DOCUMENTS', Cache: 'CACHE' },
}));

vi.mock('@capacitor/share', () => ({
    Share: {
        share: vi.fn(),
    },
}));

describe('settings storage week start', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('preserves a valid first day of week value', () => {
        localStorage.setItem('mooneva_settings', JSON.stringify({
            userName: 'Test',
            firstDayOfWeek: 'sunday',
        }));

        expect(loadSettings().firstDayOfWeek).toBe('sunday');
    });

    it('drops an invalid first day of week value', () => {
        localStorage.setItem('mooneva_settings', JSON.stringify({
            userName: 'Test',
            firstDayOfWeek: 'friday',
        }));

        expect(loadSettings().firstDayOfWeek).toBeUndefined();
    });
});
