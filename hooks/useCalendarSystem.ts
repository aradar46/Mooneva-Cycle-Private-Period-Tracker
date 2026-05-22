import { useTranslation } from 'react-i18next';
import { toJalaali, toGregorian, jalaaliMonthLength, isLeapJalaaliYear, jalaaliMonths } from '../utils/jalaali';

export interface CalendarDateParts {
    year: number;
    month: number;
    day: number;
}

export interface CalendarSystem {
    name: 'gregorian' | 'jalaali';
    today: () => CalendarDateParts;
    getDaysInMonth: (year: number, month: number) => number;
    toCalendarDate: (date: Date) => CalendarDateParts;
    fromCalendarDate: (year: number, month: number, day: number) => Date;
    formatMonthYear: (year: number, month: number) => string;
    addMonths: (dateParts: CalendarDateParts, amount: number) => CalendarDateParts;
    getFirstDayOfWeek: (year: number, month: number) => number;
    weekDayKeys: string[];
    getMonthGrid: (year: number, month: number) => { date: Date; isCurrentMonth: boolean; label: number }[];
}

export const useCalendarSystem = (): CalendarSystem => {
    const { i18n, t } = useTranslation();
    const isJalaali = i18n.language === 'fa';

    if (isJalaali) {
        const jalaaliSystem: CalendarSystem = {
            name: 'jalaali',
            weekDayKeys: ['sa', 'su', 'mo', 'tu', 'we', 'th', 'fr'], // Persian week starts Saturday

            today: () => {
                const now = new Date();
                const j = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
                return { year: j.jy, month: j.jm - 1, day: j.jd };
            },

            getDaysInMonth: (year: number, month: number) => {
                return jalaaliMonthLength(year, month + 1);
            },

            toCalendarDate: (date: Date) => {
                const j = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
                return { year: j.jy, month: j.jm - 1, day: j.jd };
            },

            fromCalendarDate: (year: number, month: number, day: number) => {
                const g = toGregorian(year, month + 1, day);
                return new Date(g.gy, g.gm - 1, g.gd);
            },

            formatMonthYear: (year: number, month: number) => {
                const mName = jalaaliMonths[month]?.fa || jalaaliMonths[month]?.name;
                return `${mName} ${year}`;
            },

            addMonths: (dateParts: CalendarDateParts, amount: number) => {
                let { year, month, day } = dateParts;
                month += amount;

                if (amount > 0) {
                    while (month > 11) {
                        month -= 12;
                        year++;
                    }
                } else {
                    while (month < 0) {
                        month += 12;
                        year--;
                    }
                }

                const maxDays = jalaaliMonthLength(year, month + 1);
                if (day > maxDays) day = maxDays;

                return { year, month, day };
            },

            getFirstDayOfWeek: (year: number, month: number) => {
                const g = toGregorian(year, month + 1, 1);
                const gDate = new Date(g.gy, g.gm - 1, g.gd);
                const gDay = gDate.getDay();
                return (gDay + 1) % 7;
            },

            getMonthGrid: (year: number, month: number) => {
                const daysInCurrentMonth = jalaaliMonthLength(year, month + 1);
                const firstDayOfWeek = jalaaliSystem.getFirstDayOfWeek(year, month);
                const totalCellsNeeded = firstDayOfWeek + daysInCurrentMonth;
                const rowCount = Math.ceil(totalCellsNeeded / 7);
                const totalCells = rowCount * 7;

                const grid: { date: Date; isCurrentMonth: boolean; label: number }[] = [];
                const monthStartDateGregorian = jalaaliSystem.fromCalendarDate(year, month, 1);

                // Previous month's trailing days
                for (let i = firstDayOfWeek - 1; i >= 0; i--) {
                    const d = new Date(monthStartDateGregorian);
                    d.setDate(d.getDate() - (i + 1));
                    const label = jalaaliSystem.toCalendarDate(d).day;
                    grid.push({ date: d, isCurrentMonth: false, label });
                }

                // Current month's days
                for (let i = 1; i <= daysInCurrentMonth; i++) {
                    const d = jalaaliSystem.fromCalendarDate(year, month, i);
                    grid.push({ date: d, isCurrentMonth: true, label: i });
                }

                // Next month's leading days
                let nextMonthDay = 1;
                while (grid.length < totalCells) {
                    const d = jalaaliSystem.fromCalendarDate(year, month, daysInCurrentMonth + nextMonthDay);
                    grid.push({ date: d, isCurrentMonth: false, label: nextMonthDay++ });
                }

                return grid;
            }
        };
        return jalaaliSystem;
    }

    // Default Gregorian System
    const gregorianSystem: CalendarSystem = {
        name: 'gregorian',
        weekDayKeys: ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'],

        today: () => {
            const now = new Date();
            return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
        },

        getDaysInMonth: (year: number, month: number) => {
            return new Date(year, month + 1, 0).getDate();
        },

        toCalendarDate: (date: Date) => {
            return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
        },

        fromCalendarDate: (year: number, month: number, day: number) => {
            return new Date(year, month, day);
        },

        formatMonthYear: (year: number, month: number) => {
            const d = new Date(year, month, 1);
            return d.toLocaleDateString(i18n.language, { month: 'short', year: 'numeric' });
        },

        addMonths: (dateParts: CalendarDateParts, amount: number) => {
            const d = new Date(dateParts.year, dateParts.month + amount, 1);
            let targetDay = dateParts.day;
            const daysInNewMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            if (targetDay > daysInNewMonth) targetDay = daysInNewMonth;
            return { year: d.getFullYear(), month: d.getMonth(), day: targetDay };
        },

        getFirstDayOfWeek: (year: number, month: number) => {
            return new Date(year, month, 1).getDay();
        },

        getMonthGrid: (year: number, month: number) => {
            const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
            const firstDayOfWeek = new Date(year, month, 1).getDay();
            const totalCellsNeeded = firstDayOfWeek + daysInCurrentMonth;
            const rowCount = Math.ceil(totalCellsNeeded / 7);
            const totalCells = rowCount * 7;

            const grid: { date: Date; isCurrentMonth: boolean; label: number }[] = [];

            // Previous month
            const prevMonthDays = new Date(year, month, 0).getDate();
            for (let i = firstDayOfWeek - 1; i >= 0; i--) {
                const day = prevMonthDays - i;
                grid.push({ date: new Date(year, month - 1, day), isCurrentMonth: false, label: day });
            }

            // Current month
            for (let i = 1; i <= daysInCurrentMonth; i++) {
                grid.push({ date: new Date(year, month, i), isCurrentMonth: true, label: i });
            }

            // Next month
            let nextMonthDay = 1;
            while (grid.length < totalCells) {
                grid.push({ date: new Date(year, month + 1, nextMonthDay), isCurrentMonth: false, label: nextMonthDay++ });
            }

            return grid;
        }
    };
    return gregorianSystem;
};
