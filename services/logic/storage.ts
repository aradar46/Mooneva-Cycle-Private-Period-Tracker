/**
 * Data storage and settings management.
 * Handles encryption, legacy migrations, and schema versioning.
 */

import { DailyLog, AppSettings, INITIAL_SYMPTOMS, PeriodRecord, BackupData } from '../../types';
import Logger from '../logger';

import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { diffInDays } from '../../utils/dateUtils';
import {
    isAnyFlowDay,
    isFullFlowDay,
    CYCLE_GAP_THRESHOLD_DAYS
} from './cycle';

// --- Constants ---
const STORAGE_KEY_ENCRYPTED = 'mooneva_data_enc';
const STORAGE_KEY_PERIODS = 'mooneva_periods_enc';
const STORAGE_KEY_LEGACY = 'mooneva_data';
const SETTINGS_KEY = 'mooneva_settings';
const PBKDF2_ITERATIONS_DEVICE = 100000;
const PBKDF2_ITERATIONS_BACKUP = 100000;
const DEVICE_LOCAL_SALT = "mooneva_local_salt_v1";
const DEVICE_SECRET_KEY = 'mooneva_device_secret';

export const loadData = async (): Promise<Record<string, DailyLog>> => {
    const encryptedBase64 = localStorage.getItem(STORAGE_KEY_ENCRYPTED);

    if (!encryptedBase64) {
        // Check for legacy unencrypted data
        const legacyData = localStorage.getItem(STORAGE_KEY_LEGACY);
        if (legacyData) {
            try {
                const parsed = JSON.parse(legacyData);
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
        const parsed = JSON.parse(decoder.decode(decrypted));

        // In a future update, we can handle DATA_SCHEMA_VERSION migrations here
        return parsed;
    } catch (e) {
        Logger.error("Failed to decrypt local data:", e);
        return {};
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

        const base64 = btoa(String.fromCharCode(...combined));
        localStorage.setItem(STORAGE_KEY_ENCRYPTED, base64);
    } catch (e) {
        Logger.error("Failed to save encrypted data:", e);
        throw e;
    }
};

export const loadSettings = (): AppSettings => {
    const settings = localStorage.getItem(SETTINGS_KEY);
    const defaults: AppSettings = {
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

    if (settings) {
        try {
            const parsed = JSON.parse(settings);

            // Legacy migrations
            if (parsed.theme === 'discrete' || parsed.cloakedMode) {
                parsed.discreteMode = true;
            }

            return {
                ...defaults,
                ...parsed
            };
        } catch (e) {
            Logger.error("Failed to load settings:", e);
        }
    }

    return defaults;
};

export const saveSettings = (settings: AppSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const wipeAllData = () => {
    localStorage.removeItem(STORAGE_KEY_ENCRYPTED);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(STORAGE_KEY_PERIODS);
    // Clear device secret keys for a full wipe
    localStorage.removeItem(DEVICE_SECRET_KEY);
    localStorage.removeItem(`${DEVICE_SECRET_KEY}_salt`);
    try {
        SecureStoragePlugin.remove({ key: DEVICE_SECRET_KEY });
        SecureStoragePlugin.remove({ key: `${DEVICE_SECRET_KEY}_salt` });
    } catch (e) {
        // SecureStorage may not be available on web
    }
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
        return [];
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

        const base64 = btoa(String.fromCharCode(...combined));
        localStorage.setItem(STORAGE_KEY_PERIODS, base64);
    } catch (e) {
        Logger.error("Failed to save encrypted periods:", e);
        throw e;
    }
};

// --- Crypto & Security (Merged) ---

const getDeviceMasterKey = async (): Promise<CryptoKey> => {
    let secret: string | null = null;
    let saltStr: string | null = null;

    try {
        const result = await SecureStoragePlugin.get({ key: DEVICE_SECRET_KEY });
        secret = result.value;
        const saltResult = await SecureStoragePlugin.get({ key: `${DEVICE_SECRET_KEY}_salt` });
        saltStr = saltResult.value;
    } catch (e) {
        // Falls back
    }

    if (!secret) {
        secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        try {
            await SecureStoragePlugin.set({ key: DEVICE_SECRET_KEY, value: secret });
        } catch (e) {
            Logger.warn('Secure storage unavailable, falling back to localStorage for device secret');
            localStorage.setItem(DEVICE_SECRET_KEY, secret);
        }
    }

    if (!saltStr) {
        saltStr = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        try {
            await SecureStoragePlugin.set({ key: `${DEVICE_SECRET_KEY}_salt`, value: saltStr });
        } catch (e) {
            Logger.warn('Secure storage unavailable, falling back to localStorage for device salt');
            localStorage.setItem(`${DEVICE_SECRET_KEY}_salt`, saltStr);
        }
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
            salt: encoder.encode(saltStr || DEVICE_LOCAL_SALT),
            iterations: PBKDF2_ITERATIONS_DEVICE,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
};

export const generateEncryptedBackup = async (data: BackupData, password: string): Promise<Blob> => {
    const version = new Uint8Array([1]); // Version 1
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
        { name: "PBKDF2", salt: salt, iterations: PBKDF2_ITERATIONS_BACKUP, hash: "SHA-256" },
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

    let offset = 0;
    const version = view[0];
    if (version === 1) {
        offset = 1;
    } else if (version > 1) {
        throw new Error(`Unsupported backup version (v${version}). Please update the app to import this backup.`);
    }
    // version 0 (legacy, no version byte): offset stays 0

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
        { name: "PBKDF2", salt: salt, iterations: PBKDF2_ITERATIONS_BACKUP, hash: "SHA-256" },
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

export const restoreBackup = async (file: File, password?: string): Promise<BackupData> => {
    if (password) {
        return decryptBackup(file, password);
    }
    // Plain JSON parsing
    try {
        const text = await readBlobAsText(file);
        return JSON.parse(text);
    } catch (e) {
        throw new Error("Invalid file format. Please ensure you uploaded a valid JSON backup, or check the box to decrypt if it is encrypted.");
    }
};

// --- Backup Sharing (Merged) ---

export const shareOrDownloadBackup = async (blob: Blob, filename = 'mooneva-backup.enc') => {
    try {
        // Convert Blob to Base64 for Capacitor
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        await new Promise((resolve) => (reader.onload = resolve));
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
