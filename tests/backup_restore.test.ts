
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateBackup, restoreBackup } from '../services/logic/storage';

// Mock Capacitor plugins and crypto
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

// Mock simple crypto for testing if not available (jsdom usually has it, but just in case)
if (!global.crypto.subtle) {
    Object.defineProperty(global.crypto, 'subtle', {
        value: {
            importKey: vi.fn().mockResolvedValue('key'),
            deriveKey: vi.fn().mockResolvedValue('key'),
            encrypt: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
            decrypt: vi.fn().mockResolvedValue(new TextEncoder().encode('{"data": "test"}')),
        }
    });
}

describe('Backup/Restore Logic', () => {
    const mockData: any = {
        data: { '2023-01-01': { date: '2023-01-01' } },
        settings: { userName: 'TestUser' },
        timestamp: '2023-01-01T00:00:00.000Z'
    };

    it('should generate unencrypted JSON backup when no password is provided', async () => {
        const result = await generateBackup(mockData, undefined);
        expect(result.filename).toBe('mooneva-backup.json');

        const text = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsText(result.blob);
        });
        const parsed = JSON.parse(text);
        expect(parsed).toEqual(mockData);
    });

    it('should generate encrypted backup when password is provided', async () => {
        // This test relies on the underlying generatesEncryptedBackup working.
        // Since we didn't mock that internal function easily without rewiring,
        // we assume the mocked crypto works or real crypto works.
        const result = await generateBackup(mockData, 'password123');
        expect(result.filename).toBe('mooneva-backup.enc');
        expect(result.blob.type).toBe('application/octet-stream');
    });

    it('should restore unencrypted JSON backup', async () => {
        const json = JSON.stringify(mockData);
        const file = new File([json], 'backup.json', { type: 'application/json' });

        const restored = await restoreBackup(file, undefined);
        expect(restored).toEqual(mockData);
    });

    it('should throw error when restoring unencrypted file as encrypted', async () => {
        const json = JSON.stringify(mockData);
        // User provides password, expecting encryption, but file is plain JSON
        const file = new File([json], 'backup.json', { type: 'application/json' });

        // Logic currently attempts to decrypt whatever is passed.
        // decryptBackup expects specific binary format. JSON text won't match version/salt/iv extraction likely.
        await expect(restoreBackup(file, 'password')).rejects.toThrow();
    });

    it('should throw error when restoring garbage data as JSON', async () => {
        const file = new File(['garbage data'], 'backup.json', { type: 'application/json' });
        await expect(restoreBackup(file, undefined)).rejects.toThrow(/Invalid file format/);
    });

    it('should include periods in backup and restore them', async () => {
        const mockDataWithPeriods: any = {
            data: { '2023-01-01': { date: '2023-01-01' } },
            settings: { userName: 'TestUser' },
            timestamp: '2023-01-01T00:00:00.000Z',
            periods: [{ id: 'p1', startDate: '2023-01-01', days: 5 }]
        };

        const result = await generateBackup(mockDataWithPeriods, undefined);
        const text = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsText(result.blob);
        });
        const parsed = JSON.parse(text);
        expect(parsed.periods).toEqual(mockDataWithPeriods.periods);
    });

    it('should restore legacy backup without periods field', async () => {
        const legacyBackup = {
            data: { '2023-01-01': { date: '2023-01-01' } },
            settings: { userName: 'TestUser' },
            timestamp: '2023-01-01T00:00:00.000Z'
            // No periods field - legacy backup
        };
        const json = JSON.stringify(legacyBackup);
        const file = new File([json], 'backup.json', { type: 'application/json' });

        const restored = await restoreBackup(file, undefined);
        expect(restored.data).toEqual(legacyBackup.data);
        expect(restored.settings).toEqual(legacyBackup.settings);
        expect(restored.periods).toBeUndefined(); // Legacy backup has no periods
    });
});
