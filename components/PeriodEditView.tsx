import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PeriodRecord } from '../types';
import { toLocalISOString, addDays, diffInDays } from '../utils/dateUtils';
import { useMooneva } from '../contexts/MoonevaContext';

interface PeriodEditViewProps {
    period: PeriodRecord;
    onClose: () => void;
}

/**
 * Dedicated Period Edit Screen.
 * Allows users to adjust period boundaries by toggling days on/off.
 */
const PeriodEditView: React.FC<PeriodEditViewProps> = ({ period, onClose }) => {
    const { t } = useTranslation();
    const { actions } = useMooneva();
    const { editPeriod, deletePeriod } = actions;

    // State: Track which days are "on" (bleeding)
    const [bleedingDays, setBleedingDays] = useState<Set<string>>(() => {
        const days = new Set<string>();
        for (let i = 0; i < period.days; i++) {
            days.add(addDays(period.startDate, i));
        }
        return days;
    });

    const todayStr = toLocalISOString(new Date());

    // Build calendar for the period's month and adjacent days
    const calendarDays = useMemo(() => {
        const startDate = new Date(period.startDate);
        const year = startDate.getFullYear();
        const month = startDate.getMonth();

        // Show 7 days before and 14 days after period start
        const rangeStart = addDays(period.startDate, -7);
        const rangeEnd = addDays(period.startDate, period.days + 14);

        const days: string[] = [];
        let current = rangeStart;
        while (current <= rangeEnd) {
            days.push(current);
            current = addDays(current, 1);
        }
        return days;
    }, [period]);

    const toggleDay = (dateStr: string) => {
        // Prevent editing future dates beyond today + 5
        if (dateStr > addDays(todayStr, 5)) return;

        setBleedingDays(prev => {
            const next = new Set(prev);
            if (next.has(dateStr)) {
                next.delete(dateStr);
            } else {
                next.add(dateStr);
            }
            return next;
        });
    };

    const handleSave = () => {
        if (bleedingDays.size === 0) {
            // No days selected - delete period
            if (window.confirm('Remove this period entirely?')) {
                deletePeriod(period.id);
                onClose();
            }
            return;
        }

        // Find min and max dates in selection
        const sortedDays = Array.from(bleedingDays).sort();
        const newStart = sortedDays[0];
        const newEnd = sortedDays[sortedDays.length - 1];
        const newDays = diffInDays(newEnd, newStart) + 1;

        // Note: This simple implementation extends the period to cover gaps
        // A more complex version could split into multiple periods
        editPeriod(period.id, newDays);
        onClose();
    };

    const handleDelete = () => {
        if (window.confirm('Remove this period?')) {
            deletePeriod(period.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-[#F0F2F5] z-[200] flex flex-col animate-fade-in">
            {/* Header */}
            <header className="px-6 pt-8 pb-4 flex justify-between items-center shrink-0">
                <button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center text-slate-400"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                    Edit Period
                </h2>
                <button
                    onClick={handleDelete}
                    className="w-10 h-10 flex items-center justify-center text-rose-400"
                    title="Delete Period"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
                    </svg>
                </button>
            </header>

            {/* Instructions */}
            <div className="px-6 pb-4">
                <p className="text-xs text-slate-400 text-center">
                    Tap days to toggle them on/off
                </p>
            </div>

            {/* Calendar Grid */}
            <main className="flex-1 overflow-y-auto px-6 pb-32">
                <div className="grid grid-cols-7 gap-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="text-center text-[10px] text-slate-400 font-bold uppercase py-2">
                            {d}
                        </div>
                    ))}
                    {calendarDays.map((dateStr) => {
                        const date = new Date(dateStr);
                        const isOn = bleedingDays.has(dateStr);
                        const isFuture = dateStr > addDays(todayStr, 5);
                        const isToday = dateStr === todayStr;

                        return (
                            <button
                                key={dateStr}
                                disabled={isFuture}
                                onClick={() => toggleDay(dateStr)}
                                className={`
                                    aspect-square rounded-2xl flex items-center justify-center
                                    text-sm font-semibold transition-all
                                    ${isOn
                                        ? 'bg-rose-100 text-rose-600 border-2 border-rose-300 shadow-sm scale-105'
                                        : 'bg-white text-slate-400 border border-slate-100'
                                    }
                                    ${isFuture ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'}
                                    ${isToday ? 'ring-2 ring-teal-400 ring-offset-2' : ''}
                                `}
                            >
                                {date.getDate()}
                            </button>
                        );
                    })}
                </div>

                {/* Summary */}
                <div
                    className="mt-6 p-4 bg-[#F0F2F5] rounded-2xl"
                    style={{ boxShadow: 'inset 4px 4px 8px rgba(163, 177, 198, 0.4), inset -4px -4px 8px rgba(255, 255, 255, 0.8)' }}
                >
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
                        Selected Days
                    </p>
                    <p className="text-2xl font-black text-slate-700">
                        {bleedingDays.size} {bleedingDays.size === 1 ? 'Day' : 'Days'}
                    </p>
                </div>
            </main>

            {/* Bottom Actions */}
            <div className="absolute bottom-10 left-6 right-6 z-20 flex gap-4">
                <button
                    onClick={onClose}
                    className="flex-1 py-4 rounded-full font-extrabold text-[10px] uppercase tracking-[0.2em] text-slate-500 transition-all active:scale-[0.98]"
                    style={{
                        backgroundColor: '#F0F2F5',
                        boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.4), -4px -4px 8px rgba(255, 255, 255, 0.8)'
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="flex-[2] py-4 rounded-full font-extrabold text-[10px] uppercase tracking-[0.2em] text-white bg-[#7598A0] transition-all active:scale-[0.98]"
                    style={{ boxShadow: '4px 4px 10px rgba(117, 152, 160, 0.4)' }}
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
};

export default PeriodEditView;
