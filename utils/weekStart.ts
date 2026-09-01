import type { FirstDayOfWeek } from '../types';

export type WeekDayKey = 'su' | 'mo' | 'tu' | 'we' | 'th' | 'fr' | 'sa';

export const FIRST_DAY_OPTIONS: FirstDayOfWeek[] = ['monday', 'sunday', 'saturday'];

const WEEK_DAY_KEYS: WeekDayKey[] = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];

const FIRST_DAY_INDEX: Record<FirstDayOfWeek, number> = {
    sunday: 0,
    monday: 1,
    saturday: 6,
};

export function normalizeFirstDayOfWeek(value: unknown): FirstDayOfWeek | undefined {
    return FIRST_DAY_OPTIONS.includes(value as FirstDayOfWeek)
        ? value as FirstDayOfWeek
        : undefined;
}

// Persian and Arabic calendars conventionally start the week on Saturday. This is only
// the default - the user can always override it in Settings.
const SATURDAY_START_LANGUAGES = new Set(['fa', 'ar']);

export function getLanguageDefaultFirstDayOfWeek(language: unknown): FirstDayOfWeek {
    const languageCode = typeof language === 'string' ? language.split('-')[0].toLowerCase() : '';
    return SATURDAY_START_LANGUAGES.has(languageCode) ? 'saturday' : 'monday';
}

export function resolveFirstDayOfWeek(language: unknown, override: unknown): FirstDayOfWeek {
    return normalizeFirstDayOfWeek(override) ?? getLanguageDefaultFirstDayOfWeek(language);
}

export function getWeekDayKeys(firstDayOfWeek: FirstDayOfWeek): WeekDayKey[] {
    const startIndex = FIRST_DAY_INDEX[firstDayOfWeek];
    return [...WEEK_DAY_KEYS.slice(startIndex), ...WEEK_DAY_KEYS.slice(0, startIndex)];
}

export function getLeadingDayCount(nativeDayIndex: number, firstDayOfWeek: FirstDayOfWeek): number {
    return (nativeDayIndex - FIRST_DAY_INDEX[firstDayOfWeek] + 7) % 7;
}
