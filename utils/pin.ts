import type { AppSettings } from '../types';

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 12;

export const normalizePinInput = (value: string): string =>
    value.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH);

export const isValidPin = (value: string): boolean =>
    /^\d{4,12}$/.test(value);

export const hasPin = (settings?: AppSettings | null): boolean =>
    Boolean(settings?.pinHash || settings?.pin);

const bytesToHex = (bytes: Uint8Array): string =>
    Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

const hexToBytes = (hex: string): Uint8Array => {
    const len = hex.length / 2;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
};

/**
 * Derives a salted PBKDF2-SHA256 hash (100,000 iterations) for the PIN.
 */
export const hashPin = async (
    pin: string,
    existingSalt?: string
): Promise<{ hash: string; salt: string }> => {
    const saltBytes = existingSalt
        ? hexToBytes(existingSalt)
        : crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );
    const hash = bytesToHex(new Uint8Array(derivedBits));
    const salt = bytesToHex(saltBytes);
    return { hash, salt };
};

/**
 * Verifies a candidate PIN against stored hash/salt, or falls back to legacy plaintext PIN.
 */
export const verifyPin = async (
    inputPin: string,
    expectedHash?: string,
    salt?: string,
    legacyPin?: string
): Promise<boolean> => {
    if (expectedHash && salt) {
        const { hash } = await hashPin(inputPin, salt);
        return hash === expectedHash;
    }
    if (legacyPin) {
        return inputPin === legacyPin;
    }
    return false;
};
