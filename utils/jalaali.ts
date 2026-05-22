
// Utility for converting between Gregorian and Jalali calendars.
// Based on the algorithms from jalaali-js (MIT License)

/**
 * Converts a Gregorian date to Jalaali.
 */
export function toJalaali(gy: number, gm: number, gd: number) {
    return d2j(g2d(gy, gm, gd));
}

/**
 * Converts a Jalaali date to Gregorian.
 */
export function toGregorian(jy: number, jm: number, jd: number) {
    return d2g(j2d(jy, jm, jd));
}

/**
 * Checks whether a Jalaali year is a leap year.
 */
export function isLeapJalaaliYear(jy: number): boolean {
    return jalCal(jy).leap === 0;
}

/**
 * Returns the number of days in a specific Jalaali month.
 */
export function jalaaliMonthLength(jy: number, jm: number): number {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    if (isLeapJalaaliYear(jy)) return 30;
    return 29;
}

/*
  Internal helper functions
*/

// Calculates the Julian Day number from Gregorian or Julian calendar dates.
function g2d(gy: number, gm: number, gd: number): number {
    return Math.floor(Date.UTC(gy, gm - 1, gd) / 86400000);
}

// Calculates the Gregorian and Julian calendar dates from the Julian Day number.
function d2g(jdn: number) {
    const date = new Date(jdn * 86400000);
    return {
        gy: date.getUTCFullYear(),
        gm: date.getUTCMonth() + 1,
        gd: date.getUTCDate()
    };
}

function d2j(jdn: number) {
    const gy = d2g(jdn).gy; // calculate Gregorian year first
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(gy, 3, r.march);
    let jd: number;
    let jm: number;
    let k: number;

    k = jdn - jdn1f;
    if (k >= 0) {
        if (k <= 185) {
            jm = 1 + div(k, 31);
            jd = (k % 31) + 1;
            return { jy, jm, jd };
        } else {
            k -= 186;
        }
    } else {
        jy -= 1;
        k += 179;
        if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = (k % 30) + 1;
    return { jy, jm, jd };
}

function j2d(jy: number, jm: number, jd: number): number {
    const r = jalCal(jy);
    return g2d(jy + 621, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function jalCal(jy: number) {
    // Jalaali years starting the 33-year rule.
    const breaks = [
        -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
        2262, 2324, 2394, 2456, 3178,
    ];

    const bl = breaks.length;
    let gy = jy + 621;
    let leapJ = -14;
    let jp = breaks[0];
    let jump: number = 0; // default initialization

    if (jy < jp || jy >= breaks[bl - 1]) throw new Error('Invalid Jalaali year ' + jy);

    // Find the break point
    for (let i = 1; i < bl; i += 1) {
        const jm = breaks[i];
        jump = jm - jp;
        if (jy < jm) break;
        leapJ = leapJ + div(jump, 33) * 8 + div(jump % 33, 4);
        jp = jm;
    }

    let n = jy - jp;

    // Find the number of leap years from AD 621 to the beginning
    // of the current Jalaali year in the Persian calendar.
    leapJ = leapJ + div(n, 33) * 8 + div(n % 33 + 3, 4);
    if (div(jump, 33) === 4 && jump - n === 4) leapJ += 1; // Special case

    // And the same in the Gregorian calendar (until the year gy).
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;

    // Determine the first day of Jalaali year in terms of March day.
    const march = 20 + leapJ - leapG;

    return { leap: jump - n === 4 ? 1 : n % 33 - div(n % 33, 4) * 4, gy, march };
}

function div(a: number, b: number) {
    return ~~(a / b);
}

// Jalaali Month Names (English transliteration and native)
export const jalaaliMonths = [
    { name: 'Farvardin', fa: 'فروردین' },
    { name: 'Ordibehesht', fa: 'اردیبهشت' },
    { name: 'Khordad', fa: 'خرداد' },
    { name: 'Tir', fa: 'تیر' },
    { name: 'Mordad', fa: 'مرداد' },
    { name: 'Shahrivar', fa: 'شهریور' },
    { name: 'Mehr', fa: 'مهر' },
    { name: 'Aban', fa: 'آبان' },
    { name: 'Azar', fa: 'آذر' },
    { name: 'Dey', fa: 'دی' },
    { name: 'Bahman', fa: 'بهمن' },
    { name: 'Esfand', fa: 'اسفند' },
];
