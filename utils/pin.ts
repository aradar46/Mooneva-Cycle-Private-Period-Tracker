export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 12;

export const normalizePinInput = (value: string): string =>
    value.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH);

export const isValidPin = (value: string): boolean =>
    /^\d{4,12}$/.test(value);
