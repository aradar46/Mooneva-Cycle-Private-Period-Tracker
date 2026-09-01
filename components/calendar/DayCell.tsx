import React from 'react';
import { DayMeta, AppSettings, DailyLog } from '../../types';
import { diffInDays, getTodayStr } from '../../utils/dateUtils';
import { formatNumber } from '../../services/i18n';
import { SexMarkerIcon } from './SexMarkerIcon';

interface DayCellProps {
    date: Date;
    dateStr: string; // ISO string
    isCurrentMonth: boolean;
    meta: DayMeta;
    log?: DailyLog | null;
    hasLog: boolean;
    isSelected: boolean;
    isEditMode: boolean;
    settings: AppSettings;
    onDateClick: (dateStr: string) => void;
    onToggleBleedingDay?: (dateStr: string) => void;
    idx: number; // for blob shape calculation
    label?: number; // Optional custom label (e.g. for Jalali day number)
}

export const DayCell: React.FC<DayCellProps> = ({
    date,
    dateStr,
    isCurrentMonth,
    meta,
    log,
    hasLog,
    isSelected,
    isEditMode,
    settings,
    onDateClick,
    onToggleBleedingDay,
    idx,
    label
}) => {
    const hasFlow = meta.isPeriodSpan;
    const isInsideSpan = meta.isPeriod;
    const isStart = meta.isCycleStart;

    // Also check for flow logs (independent from period spans)
    const hasFlowLog = meta.intensity && meta.intensity !== 'spotting';

    // Predictions (hidden when in Edit Mode)
    const isPredPeriod = isEditMode ? false : meta.isForecastPeriod;
    const isPredFertile = isEditMode ? false : meta.isFertile;
    const isOvulation = isEditMode ? false : meta.isOvulation;
    // meta.isPMS already accounts for settings.showPMS (see useMoonevaModel.getDayMeta)
    const isPMS = isEditMode ? false : meta.isPMS;
    const isToday = meta.isToday;

    const hasSymptoms = (meta.symptoms?.length || 0) > 0;
    const isSpotting = meta.isSpotting;
    const sexType = log?.sexType;

    const todayStr = getTodayStr();
    const isFutureLocked = diffInDays(dateStr, todayStr) > 7;

    // Random blob shape for organic feel
    const blobShape = `blob-${(idx % 5) + 1}`;

    let containerClass = "bg-transparent text-slate-600 hover:bg-white/70 border border-transparent";
    let shapeClass = "rounded-2xl";

    // Priority: Period active days > Period span > Predictions
    if (hasFlow || hasFlowLog) {
        // Active bleeding day (either via activeDays or flow log)
        containerClass = `bg-rose-100 text-rose-700 z-10`;
        if ((isPredFertile || isOvulation) && !isSelected) {
            containerClass += ` ring-2 ring-emerald-400 ring-inset`;
        }
        shapeClass = "rounded-full";
    } else if (isInsideSpan) {
        // Gap day (inside period span but not bleeding)
        containerClass = `bg-rose-50/70 text-rose-600 border border-rose-200/60`;
        if ((isPredFertile || isOvulation) && !isSelected) {
            containerClass += ` ring-2 ring-emerald-400/50 ring-inset`;
        }
        shapeClass = "rounded-full";
    } else if (isEditMode) {
        if (isFutureLocked) {
            containerClass = `bg-transparent text-slate-300 border border-transparent opacity-40 grayscale pointer-events-none`;
        } else {
            containerClass = `bg-slate-50/40 text-slate-500 border border-dashed border-slate-300 hover:border-rose-400/60 hover:bg-rose-50/70 hover:text-rose-700`;
        }
        shapeClass = "rounded-xl";
    } else if (isPredPeriod) {
        containerClass = `bg-transparent border-2 border-dashed border-rose-300 text-rose-600`;
        shapeClass = "rounded-full";
    } else if (isOvulation) {
        containerClass = `bg-transparent border-2 border-teal-300 text-teal-700 z-10`;
        shapeClass = "rounded-full";
    } else if (isPredFertile) {
        containerClass = `border-2 border-teal-300 text-teal-700`;
        shapeClass = "rounded-full";
    } else if (hasLog && (hasSymptoms || isSpotting)) {
        containerClass = `bg-transparent ${isPMS ? 'text-blue-600' : 'text-slate-700'} hover:bg-white/70 border border-transparent`;
        shapeClass = "rounded-full";
    } else if (isPMS) {
        containerClass = `bg-transparent text-blue-600 hover:bg-blue-50/70 border border-transparent`;
        shapeClass = "rounded-full";
    } else {
        containerClass = "bg-transparent text-slate-600 hover:bg-white/70 border border-transparent";
    }

    return (
        <button
            key={dateStr}
            className={`
        calendar-day-cell aspect-square relative transition-all active:scale-90 flex items-center justify-center
        ${containerClass}
        ${shapeClass}
        ${isSelected ? 'ring-2 ring-[#8b5cf6] ring-offset-2 ring-offset-surface-card shadow-[0_0_14px_rgba(139,92,246,0.3)] z-50' : ''}
        ${!isSelected && isToday ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface-card z-20' : ''}
        ${!isCurrentMonth ? 'opacity-20 grayscale pointer-events-none' : ''}
        ${isEditMode && !isFutureLocked ? 'hover:scale-105 hover:ring-2 hover:ring-cycle-period/50 hover:z-30 cursor-crosshair' : ''}
      `}
            onClick={() => {
                if (meta.isUnavailableFuture) {
                    onDateClick(dateStr);
                    return;
                }
                if (isEditMode && onToggleBleedingDay && !isFutureLocked) {
                    onToggleBleedingDay(dateStr);
                } else {
                    onDateClick(dateStr);
                }
            }}
        >
            <div className="relative w-full h-full flex items-center justify-center">
                {/* Cycle Day Badge - top of the cell */}
                {meta.dayOfCycle && meta.dayOfCycle > 0 && !isEditMode && (
                    <span className="calendar-cycle-badge absolute top-[3px] left-1/2 -translate-x-1/2 text-[8px] font-extrabold text-slate-500/95 tracking-tight">
                        {formatNumber(meta.dayOfCycle)}
                    </span>
                )}
                {sexType && (
                    <SexMarkerIcon
                        type={sexType}
                        label={sexType === 'protected' ? 'Protected sex' : 'Unprotected sex'}
                        className={`calendar-sex-marker-edge calendar-sex-marker-${sexType} absolute top-1/2 -translate-y-1/2 text-purple-500 z-10 pointer-events-none`}
                    />
                )}
                <span className="calendar-date-row inline-flex items-center justify-center">
                    <span className={`calendar-day-number text-[15px] sm:text-base leading-none tracking-tight ${hasFlow || hasFlowLog || isOvulation || isPredFertile || isPredPeriod || isPMS || isSelected ? 'font-extrabold' : 'font-bold'}`}>
                        {formatNumber(label || date.getDate())}
                    </span>
                </span>

                {/* Indicators at bottom - micro icons - absolutely positioned to not affect number centering */}
                <div className="absolute bottom-[4px] left-0 right-0 flex items-center justify-center gap-[2px] h-[10px]">
                    {/* Flow indicator - droplet icon */}
                    {log?.flow && log.flow !== 'spotting' && (
                        <svg className="w-[9px] h-[9px] text-rose-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8 8 4 12 4 16a8 8 0 1016 0c0-4-4-8-8-14z" />
                        </svg>
                    )}
                    {/* Spotting - small dot */}
                    {isSpotting && (
                        <div className="w-[4px] h-[4px] rounded-full bg-rose-400" />
                    )}
                    {/* Symptoms - lightning bolt */}
                    {hasSymptoms && (
                        <svg className="w-[9px] h-[9px] text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                    )}
                    {/* Contraceptive pill taken - cyan capsule; other meds/supplements - violet capsule */}
                    {(log?.pillTakenAt || (log?.meds?.length ?? 0) > 0) && (
                        <svg aria-label={log?.pillTakenAt ? "Pill taken" : "Medication logged"} role="img" className={`w-[10px] h-[10px] ${log?.pillTakenAt ? 'text-cyan-500' : 'text-violet-400'}`} viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M19.5 6.5a3.5 3.5 0 0 0-7 0v11a3.5 3.5 0 1 0 7 0v-11ZM16 2a5.5 5.5 0 0 0-5.5 5.5v11a5.5 5.5 0 1 0 11 0v-11A5.5 5.5 0 0 0 16 2Zm-3.5 5.5v4.25h7V7.5a3.5 3.5 0 1 0-7 0Z" clipRule="evenodd" />
                        </svg>
                    )}
                    {/* Notes - paperclip */}
                    {log?.notes && (
                        <svg className="w-[9px] h-[9px] text-slate-500 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                    )}
                </div>
            </div>

            {/* Period Start / Withdrawal Bleed Icon – center on circle border (top-right) */}
            {
                isStart && (
                    <div className="absolute top-[13%] right-[13%] translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-0.5 z-10 shadow-sm border border-rose-100">
                        {meta.isWithdrawalBleed ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-indigo-400">
                                <path fillRule="evenodd" d="M19.5 6.5a3.5 3.5 0 0 0-7 0v11a3.5 3.5 0 1 0 7 0v-11ZM16 2a5.5 5.5 0 0 0-5.5 5.5v11a5.5 5.5 0 1 0 11 0v-11A5.5 5.5 0 0 0 16 2Zm-3.5 5.5v4.25h7V7.5a3.5 3.5 0 1 0-7 0Z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-rose-400">
                                <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                            </svg>
                        )}
                    </div>
                )
            }

            {/* Fertility Dot Indicators – center on circle border (top-right) */}
            {
                (isOvulation || isPredFertile) && !isStart && (
                    <div className={`absolute top-[13%] right-[13%] translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center ${isOvulation ? 'bg-white rounded-full p-0.5 shadow-sm border border-[#b0f4eb]' : ''}`}>
                        {isOvulation ? (
                            // Ovulation: Large pulsing dot
                            <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                        ) : (
                            // Fertile: Smaller dot
                            <div className="w-2 h-2 bg-teal-500/80 rounded-full border border-white" />
                        )}
                    </div>
                )
            }


        </button >
    );
};
