import { describe, expect, it } from 'vitest';
import {
    PIN_MAX_LENGTH,
    PIN_MIN_LENGTH,
    isValidPin,
    normalizePinInput,
} from '../utils/pin';

describe('PIN rules', () => {
    it('keeps digits only and caps input at 12 digits', () => {
        expect(normalizePinInput('12ab34-56789012345')).toBe('123456789012');
    });

    it('accepts numeric PINs from 4 through 12 digits', () => {
        expect(PIN_MIN_LENGTH).toBe(4);
        expect(PIN_MAX_LENGTH).toBe(12);
        expect(isValidPin('1234')).toBe(true);
        expect(isValidPin('123456789012')).toBe(true);
    });

    it('rejects short, long, and non-numeric PINs', () => {
        expect(isValidPin('123')).toBe(false);
        expect(isValidPin('1234567890123')).toBe(false);
        expect(isValidPin('123a')).toBe(false);
    });
});
