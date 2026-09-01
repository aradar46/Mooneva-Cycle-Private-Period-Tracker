/**
 * Data storage and settings management.
 * Handles encryption, legacy migrations, and schema versioning.
 */

import { INITIAL_SYMPTOMS } from '../../types';
import type {
    AppSettings,
    BackupData,
    ContraceptionReminder,
    DailyLog,
    PeriodRecord,
} from '../../types';
import Logger from '../logger';

import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { normalizeFirstDayOfWeek } from '../../utils/weekStart';

// --- Constants ---
const STORAGE_KEY_ENCRYPTED = 'mooneva_data_enc';
const STORAGE_KEY_PERIODS = 'mooneva_periods_enc';
const STORAGE_KEY_LEGACY = 'mooneva_data';
const SETTINGS_KEY = 'mooneva_settings'; // legacy plaintext, migrated on load
const SETTINGS_KEY_ENCRYPTED = 'mooneva_settings_enc';
const PBKDF2_ITERATIONS_DEVICE = 100000;
const PBKDF2_ITERATIONS_BACKUP_V1 = 100000;
// OWASP-recommended minimum for PBKDF2-HMAC-SHA256. Backups are the only
// password-derived keys in the app, so the iteration count actually matters here.
const PBKDF2_ITERATIONS_BACKUP_V2 = 600000;
const BACKUP_VERSION = 2;
const DEVICE_SECRET_KEY = 'mooneva_device_secret';

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const isContraceptionReminder = (value: unknown): value is ContraceptionReminder => {
    if (!isPlainRecord(value)) {
        return false;
    }

    if (
        !Object.hasOwn(value, 'enabled') ||
        typeof value.enabled !== 'boolean' ||
        !Object.hasOwn(value, 'method') ||
        typeof value.method !== 'string' ||
        !Object.hasOwn(value, 'time') ||
        typeof value.time !== 'string'
    ) {
        return false;
    }

    if (value.method === 'pill') {
        return true;
    }

    if (value.method === 'patch' || value.method === 'ring') {
        return Object.hasOwn(value, 'anchorDate') && typeof value.anchorDate === 'string';
    }

    if (value.method === 'injection' || value.method === 'iud' || value.method === 'implant') {
        if (!Object.hasOwn(value, 'nextDate') || typeof value.nextDate !== 'string') {
            return false;
        }

        if (!Object.hasOwn(value, 'warningDays')) {
            return true;
        }

        return typeof value.warningDays === 'number' &&
            Number.isInteger(value.warningDays) &&
            value.warningDays >= 0 &&
            value.warningDays <= 365;
    }

    return false;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 0x8000) {
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
    }
    return btoa(chunks.join(''));
};

/**
 * Older logs stored `mood` as a single string; it has been an array of MOOD_OPTIONS
 * ids for a long time. Normalising here means every reader can assume string[] rather
 * than repeating an Array.isArray dance, and the declared type can finally be honest.
 */
const migrateMoodToArray = (logs: Record<string, DailyLog>): Record<string, DailyLog> => {
    for (const log of Object.values(logs)) {
        const raw: unknown = (log as { mood?: unknown })?.mood;
        if (raw !== undefined && !Array.isArray(raw)) {
            (log as { mood?: string[] }).mood = raw ? [String(raw)] : [];
        }
    }
    return logs;
};

export const loadData = async (): Promise<Record<string, DailyLog>> => {
    const encryptedBase64 = localStorage.getItem(STORAGE_KEY_ENCRYPTED);

    if (!encryptedBase64) {
        // Check for legacy unencrypted data
        const legacyData = localStorage.getItem(STORAGE_KEY_LEGACY);
        if (legacyData) {
            try {
                const parsed = migrateMoodToArray(JSON.parse(legacyData));
                await saveData(parsed); // Migrate to encrypted
                localStorage.removeItem(STORAGE_KEY_LEGACY);
                return parsed;
            } catch (e) {
                Logger.error("Failed to migrate legacy data:", e);
            }
        }
        return {};
    }

    try {
        const masterKey = await getDeviceMasterKey();
        const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            masterKey,
            data
        );

        const decoder = new TextDecoder();
        const parsed = migrateMoodToArray(JSON.parse(decoder.decode(decrypted)));

        // In a future update, we can handle DATA_SCHEMA_VERSION migrations here
        return parsed;
    } catch (e) {
        Logger.error("Failed to decrypt local data:", e);
        throw e;
    }
};

export const saveData = async (data: Record<string, DailyLog>) => {
    try {
        const masterKey = await getDeviceMasterKey();
        const encoder = new TextEncoder();

        // We could wrap the data in a metadata object with versioning
        const payload = JSON.stringify(data);

        const encodedData = encoder.encode(payload);
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            masterKey,
            encodedData
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        const base64 = bytesToBase64(combined);
        localStorage.setItem(STORAGE_KEY_ENCRYPTED, base64);
    } catch (e) {
        Logger.error("Failed to save encrypted data:", e);
        throw e;
    }
};

export const DEFAULT_SETTINGS: AppSettings = {
    discreteMode: false,
    darkNeumorphism: false,
    userName: 'User',
    onboardingCompleted: false,
    symptoms: INITIAL_SYMPTOMS,
    predictionsPaused: false,
    isOnBirthControl: false,
    // Prediction Settings
    cycleLength: 28,
    periodLength: 5,
    lutealPhaseLength: 14,
    pmsLength: 3,
    showFertileWindow: true,
    showPMS: true, // #20
    adaptivePrediction: false
};

export const loadSettings = async (): Promise<AppSettings> => {
    const defaults = DEFAULT_SETTINGS;

    const encryptedBase64 = localStorage.getItem(SETTINGS_KEY_ENCRYPTED);
    let settings: string | null = null;

    if (encryptedBase64) {
        try {
            const masterKey = await getDeviceMasterKey();
            const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);
            const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, masterKey, data);
            settings = new TextDecoder().decode(decrypted);
        } catch (e) {
            Logger.error("Failed to decrypt settings:", e);
            throw e;
        }
    } else {
        settings = localStorage.getItem(SETTINGS_KEY);
    }

    if (settings) {
        try {
            const parsed: unknown = JSON.parse(settings);
            if (!isPlainRecord(parsed)) {
                return defaults;
            }

            // Legacy migrations
            if (parsed.theme === 'discrete' || parsed.cloakedMode) {
                parsed.discreteMode = true;
            }

            const normalizedFirstDayOfWeek = normalizeFirstDayOfWeek(parsed.firstDayOfWeek);
            if (normalizedFirstDayOfWeek) {
                parsed.firstDayOfWeek = normalizedFirstDayOfWeek;
            } else {
                delete parsed.firstDayOfWeek;
            }

            const hasModernProfile = Object.hasOwn(parsed, 'contraceptionReminder');
            const modernProfile = hasModernProfile &&
                isContraceptionReminder(parsed.contraceptionReminder)
                ? parsed.contraceptionReminder
                : undefined;

            const normalizedSettings: AppSettings = {
                ...defaults,
                ...parsed
            };

            if (hasModernProfile) {
                delete normalizedSettings.contraceptionReminder;
            }
            if (modernProfile) {
                normalizedSettings.contraceptionReminder = modernProfile;
            }

            const hasValidLegacyPillSetting =
                (Object.hasOwn(parsed, 'reminderPillDaily') &&
                    typeof parsed.reminderPillDaily === 'boolean') ||
                (Object.hasOwn(parsed, 'reminderPillDailyTime') &&
                    typeof parsed.reminderPillDailyTime === 'string');
            if (!modernProfile && hasValidLegacyPillSetting) {
                normalizedSettings.contraceptionReminder = {
                    enabled: Object.hasOwn(parsed, 'reminderPillDaily') &&
                        typeof parsed.reminderPillDaily === 'boolean'
                        ? parsed.reminderPillDaily
                        : false,
                    method: 'pill',
                    time: Object.hasOwn(parsed, 'reminderPillDailyTime') &&
                        typeof parsed.reminderPillDailyTime === 'string'
                        ? parsed.reminderPillDailyTime
                        : '09:00',
                };
            }

            if (!encryptedBase64) {
                // First read of a legacy plaintext blob: persist encrypted, drop the plaintext copy.
                await saveSettings(normalizedSettings);
                localStorage.removeItem(SETTINGS_KEY);
            }

            return normalizedSettings;
        } catch (e) {
            Logger.error("Failed to load settings:", e);
        }
    }

    return defaults;
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
    try {
        const masterKey = await getDeviceMasterKey();
        const encoder = new TextEncoder();
        const encodedData = encoder.encode(JSON.stringify(settings));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            masterKey,
            encodedData
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        localStorage.setItem(SETTINGS_KEY_ENCRYPTED, bytesToBase64(combined));
    } catch (e) {
        Logger.error("Failed to save encrypted settings:", e);
        throw e;
    }
};

export const wipeAllData = async () => {
    localStorage.removeItem(STORAGE_KEY_ENCRYPTED);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(SETTINGS_KEY_ENCRYPTED);
    localStorage.removeItem(STORAGE_KEY_PERIODS);
    // Clear device secret keys for a full wipe
    localStorage.removeItem(DEVICE_SECRET_KEY);
    localStorage.removeItem(`${DEVICE_SECRET_KEY}_salt`);
    try {
        await SecureStoragePlugin.remove({ key: DEVICE_SECRET_KEY });
        await SecureStoragePlugin.remove({ key: `${DEVICE_SECRET_KEY}_salt` });
    } catch (e) {
        // SecureStorage may not be available on web
    }
    cachedMasterKeyPromise = null;
    window.location.reload();
};

// --- Period Storage ---
export const loadPeriods = async (): Promise<PeriodRecord[]> => {
    const encryptedBase64 = localStorage.getItem(STORAGE_KEY_PERIODS);
    if (!encryptedBase64) return [];

    try {
        const masterKey = await getDeviceMasterKey();
        const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            masterKey,
            data
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    } catch (e) {
        Logger.error("Failed to decrypt periods:", e);
        throw e;
    }
};

export const savePeriods = async (periods: PeriodRecord[]) => {
    try {
        const masterKey = await getDeviceMasterKey();
        const encoder = new TextEncoder();
        const payload = JSON.stringify(periods);
        const encodedData = encoder.encode(payload);
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            masterKey,
            encodedData
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        const base64 = bytesToBase64(combined);
        localStorage.setItem(STORAGE_KEY_PERIODS, base64);
    } catch (e) {
        Logger.error("Failed to save encrypted periods:", e);
        throw e;
    }
};

// --- Crypto & Security (Merged) ---

const isKeyNotFoundError = (e: unknown): boolean => {
    const message = typeof e === 'string' ? e : e instanceof Error ? e.message : '';
    return message.toLowerCase().includes('does not exist');
};

/**
 * Reads one device-secret part: secure storage first, the localStorage fallback
 * second (the same place writeDeviceSecretPart falls back to when set() fails).
 * Throws on an ambiguous secure-storage error with no local fallback, rather than
 * letting the caller treat it as "absent" and mint (and overwrite) a new secret.
 */
const readDeviceSecretPart = async (key: string): Promise<string | null> => {
    try {
        const result = await SecureStoragePlugin.get({ key });
        return result.value;
    } catch (e) {
        const local = localStorage.getItem(key);
        if (local) return local;
        if (isKeyNotFoundError(e)) return null;
        Logger.warn(`Ambiguous secure-storage read failure for ${key}`, e);
        throw new Error(`Unable to read ${key}: secure storage error and no local fallback`);
    }
};

const writeDeviceSecretPart = async (key: string, value: string): Promise<void> => {
    try {
        await SecureStoragePlugin.set({ key, value });
    } catch (e) {
        Logger.warn(`Secure storage unavailable, falling back to localStorage for ${key}`);
        localStorage.setItem(key, value);
    }
};

const deriveDeviceMasterKey = async (): Promise<CryptoKey> => {
    let secret = await readDeviceSecretPart(DEVICE_SECRET_KEY);
    if (!secret) {
        secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        await writeDeviceSecretPart(DEVICE_SECRET_KEY, secret);
    }

    let saltStr = await readDeviceSecretPart(`${DEVICE_SECRET_KEY}_salt`);
    if (!saltStr) {
        saltStr = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        await writeDeviceSecretPart(`${DEVICE_SECRET_KEY}_salt`, saltStr);
    }

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode(saltStr),
            iterations: PBKDF2_ITERATIONS_DEVICE,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
};

// The device secret + salt never change once written, so the derived key is
// always identical - deriving it fresh on every save/load is pure wasted CPU
// (100k PBKDF2 rounds each time). Cache the promise, not just the resolved
// key, so concurrent calls before the first derivation resolves share one
// derivation instead of racing to start their own.
let cachedMasterKeyPromise: Promise<CryptoKey> | null = null;

const getDeviceMasterKey = async (): Promise<CryptoKey> => {
    if (!cachedMasterKeyPromise) {
        cachedMasterKeyPromise = deriveDeviceMasterKey().catch((e) => {
            // Don't let a transient failure (e.g. secure storage glitch) wedge
            // every future save/load for the rest of the session.
            cachedMasterKeyPromise = null;
            throw e;
        });
    }
    return cachedMasterKeyPromise;
};

/** Test-only: clears the cached key so each test can start from a fresh derivation. */
export const __resetDeviceMasterKeyCacheForTests = (): void => {
    cachedMasterKeyPromise = null;
};

export const generateEncryptedBackup = async (data: BackupData, password: string): Promise<Blob> => {
    const version = new Uint8Array([BACKUP_VERSION]);
    const textEncoder = new TextEncoder();
    const encodedData = textEncoder.encode(JSON.stringify(data));
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: PBKDF2_ITERATIONS_BACKUP_V2, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedContent = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encodedData
    );

    return new Blob(
        [version, salt, iv, new Uint8Array(encryptedContent)],
        { type: 'application/octet-stream' }
    );
};

export const decryptBackup = async (file: File, password: string): Promise<BackupData> => {
    const buffer = await file.arrayBuffer();
    const view = new Uint8Array(buffer);

    const version = view[0];
    if (version !== 1 && version !== 2) {
        throw new Error(`Unsupported backup version (v${version}). Please update the app to import this backup.`);
    }
    const offset = 1;

    // v2 raised the iteration count; older backups must still decrypt with theirs.
    const iterations = version === 2
        ? PBKDF2_ITERATIONS_BACKUP_V2
        : PBKDF2_ITERATIONS_BACKUP_V1;

    const salt = buffer.slice(offset, offset + 16);
    const iv = buffer.slice(offset + 16, offset + 28);
    const data = buffer.slice(offset + 28);

    const textEncoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(iv) },
            key,
            data
        );
        const textDecoder = new TextDecoder();
        return JSON.parse(textDecoder.decode(decrypted));
    } catch (e) {
        throw new Error("Incorrect password or damaged file. Please verify your password and try again.");
    }
};

export const generateBackup = async (data: BackupData, password?: string): Promise<{ blob: Blob, filename: string }> => {
    if (password) {
        const blob = await generateEncryptedBackup(data, password);
        return { blob, filename: 'mooneva-backup.enc' };
    } else {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        return { blob, filename: 'mooneva-backup.json' };
    }
};

const readBlobAsText = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(blob);
    });
};

// Generous cap for years of daily logs as JSON/encrypted text; guards against
// an oversized file hanging the device on decrypt/parse. Shared with the
// other-app import path, which reads whole files the same way.
export const MAX_IMPORT_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidBackupShape = (value: unknown): value is BackupData =>
    isPlainObject(value) && isPlainObject(value.data) && isPlainObject(value.settings);

export const restoreBackup = async (file: File, password?: string): Promise<BackupData> => {
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
        throw new Error("Backup file is too large (max 50MB).");
    }

    let restored: unknown;
    if (password) {
        restored = await decryptBackup(file, password);
    } else {
        // Plain JSON parsing
        try {
            const text = await readBlobAsText(file);
            restored = JSON.parse(text);
        } catch (e) {
            throw new Error("Invalid file format. Please ensure you uploaded a valid JSON backup, or check the box to decrypt if it is encrypted.");
        }
    }

    if (!isValidBackupShape(restored)) {
        throw new Error("Invalid file format. Please ensure you uploaded a valid JSON backup, or check the box to decrypt if it is encrypted.");
    }
    return restored;
};

// --- Backup Sharing (Merged) ---

export const shareOrDownloadBackup = async (blob: Blob, filename = 'mooneva-backup.enc') => {
    try {
        // Convert Blob to Base64 for Capacitor
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        await new Promise<void>((resolve, reject) => {
            reader.onload = () => resolve();
            reader.onerror = () => reject(reader.error ?? new Error('Failed to read backup file'));
        });
        const base64Data = (reader.result as string).split(',')[1];

        // Write file to Cache Directory
        const result = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.Cache,
        });

        // Share the File URI
        await Share.share({
            title: 'Mooneva Backup',
            text: filename.endsWith('.enc') ? 'Keep this file safe! It is encrypted with your password.' : 'Mooneva backup file.',
            files: [result.uri],
        });

        // Clean up temporary cache export file after sharing
        setTimeout(async () => {
            try {
                await Filesystem.deleteFile({
                    path: filename,
                    directory: Directory.Cache,
                });
            } catch {
                // Best effort cleanup
            }
        }, 60000);

    } catch (e) {
        // Fallback to classic download (Browsers / Desktop)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

export const cleanupStaleBackupFiles = async () => {
    try {
        const files = await Filesystem.readdir({
            path: '',
            directory: Directory.Cache,
        });
        for (const file of files.files) {
            if (file.name.startsWith('mooneva-backup')) {
                try {
                    await Filesystem.deleteFile({
                        path: file.name,
                        directory: Directory.Cache,
                    });
                } catch {
                    // Ignore individual removal errors
                }
            }
        }
    } catch {
        // Cache directory read not supported on web
    }
};
