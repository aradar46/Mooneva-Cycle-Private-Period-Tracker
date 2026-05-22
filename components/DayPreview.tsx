import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMooneva } from '../contexts/MoonevaContext';
import { MOOD_OPTIONS } from '../types';
import { toLocalISOString } from '../utils/dateUtils';

interface DayPreviewProps {
    date: string;
    onClose: () => void;
    onEdit: (date: string) => void;
}

export const DayPreview: React.FC<DayPreviewProps> = ({ date, onClose, onEdit }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'fa';
    const { logs, periods, model } = useMooneva();
    const { getDayMeta } = model;

    const log = logs[date];
    const meta = getDayMeta(date);
    const activePeriod = periods.find(p => {
        const start = new Date(p.startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + p.days - 1);
        const current = new Date(date);
        return current >= start && current <= end;
    });

    const hasContent = log && (log.flow || log.symptoms?.length || log.notes || log.mood || log.discharge || log.sexDrive || log.sexType);

    if (!hasContent && !activePeriod) {
        return null;
    }

    return (
        <div
            className="relative z-0 w-[95%] max-w-[95%] mx-auto bg-[#F0F2F5] rounded-b-[24px] px-3 py-3 animate-fade-in"
            style={{ boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.3), -6px -6px 12px rgba(255, 255, 255, 0.7)' }}
        >
            {/* Line 1: Flow, Mood and Close Button */}
            <div className="flex items-start justify-between mt-6 mb-2 px-0.5">
                <div className="flex flex-col gap-2 flex-1 min-w-0 mr-2">
                    <div className="flex items-center gap-2">
                        {activePeriod && (
                            <span
                                className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider px-2 h-[20px] rounded-lg flex items-center flex-shrink-0"
                                style={{
                                    backgroundColor: '#F0F2F5',
                                    boxShadow: '2px 2px 4px rgba(163, 177, 198, 0.3), -2px -2px 4px rgba(255, 255, 255, 0.8)'
                                }}
                            >
                                {t('log.day_x_of_y', { day: Math.floor((new Date(date).getTime() - new Date(activePeriod.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1, total: activePeriod.days })}
                            </span>
                        )}
                        {log?.flow && (
                            <div
                                className="flex items-center gap-1 px-2 h-[20px] rounded-lg flex-shrink-0"
                                style={{
                                    backgroundColor: '#F0F2F5',
                                    boxShadow: '2px 2px 4px rgba(163, 177, 198, 0.3), -2px -2px 4px rgba(255, 255, 255, 0.8)'
                                }}
                            >
                                <div className="flex items-center gap-1">
                                    <div className={`rounded-full bg-rose-600 ${log.flow === 'heavy' ? 'w-2 h-2' : log.flow === 'medium' ? 'w-1.5 h-1.5' : 'w-1 h-1'}`} />
                                    <span className="text-[10px] font-black uppercase text-rose-600">
                                        {t(`log.flow_${log.flow}`, log.flow)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    {log?.mood && (
                        <div className="flex flex-wrap gap-2">
                            {(Array.isArray(log.mood) ? log.mood : [log.mood]).map(m => {
                                const config = MOOD_OPTIONS.find(opt => opt.id === m);
                                if (!config) return null;
                                return (
                                    <div
                                        key={m}
                                        className="px-2 h-[20px] rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{
                                            backgroundColor: '#F0F2F5',
                                            boxShadow: '2px 2px 4px rgba(163, 177, 198, 0.3), -2px -2px 4px rgba(255, 255, 255, 0.8)',
                                            border: `1.5px solid ${config.color}`,
                                            color: config.dark,
                                        }}
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-wider leading-none mr-1">{config.emoji}</span>
                                        <span className="text-[10px] font-black uppercase tracking-wider leading-none">{t(config.labelKey)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-1 -mr-1 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Content Body */}
            <div className="space-y-2 px-1">
                {/* Symptoms & Vitals */}
                {(log?.symptoms?.length > 0 || log?.discharge || log?.sexDrive || log?.sexType || activePeriod?.isWithdrawalBleed || activePeriod?.ignoreForAverages) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        {log.symptoms?.map((s) => (
                            <span key={s} className="text-[10px] font-bold text-slate-500 bg-white/50 px-2 py-0.5 rounded-full">
                                {t(`symptom.${s.toLowerCase()}`, s)}
                            </span>
                        ))}
                        {log.discharge && (
                            <span className="text-[10px] font-bold text-teal-600 bg-teal-50/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                {isRtl
                                    ? `${t('log.secretions')} ${t(`log.discharge_${log.discharge}`, log.discharge)}`
                                    : `${t(`log.discharge_${log.discharge}`, log.discharge)} ${t('log.secretions')}`}
                            </span>
                        )}
                        {log.sexDrive && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                {isRtl
                                    ? `${t('log.libido')} ${t(`log.libido_${log.sexDrive}`, log.sexDrive)}`
                                    : `${t(`log.libido_${log.sexDrive}`, log.sexDrive)} ${t('log.libido')}`}
                            </span>
                        )}
                        {log.sexType && (
                            <span className="text-[10px] font-bold text-purple-600 bg-purple-50/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                {isRtl
                                    ? `${t('log.sex_activity')} ${t(`log.sex_${log.sexType}`, log.sexType)}`
                                    : `${t(`log.sex_${log.sexType}`, log.sexType)} ${t('log.sex_activity')}`}
                            </span>
                        )}
                        {activePeriod?.isWithdrawalBleed && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-full uppercase tracking-tighter flex items-center gap-1">
                                💊 {t('log.withdrawal_bleed_label')}
                            </span>
                        )}
                        {activePeriod?.ignoreForAverages && (
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50/50 px-2 py-0.5 rounded-full uppercase tracking-tighter flex items-center gap-1">
                                ⚠️ {t('log.excluded_label')}
                            </span>
                        )}
                    </div>
                )}

                {/* Notes - Subtler */}
                {log?.notes && (
                    <div className="relative group">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-200 rounded-full" />
                        <p className="text-[12px] text-slate-600 font-medium pl-3 py-0.5 leading-relaxed max-h-[80px] overflow-y-auto scrollbar-hide">
                            {log.notes}
                        </p>
                    </div>
                )}

                {/* Action Footer: Tap to Edit */}
                <button
                    onClick={() => onEdit(date)}
                    className="w-full mt-2 py-2 px-4 rounded-xl text-slate-400 font-bold text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:text-slate-600 transition-colors"
                    style={{
                        backgroundColor: '#F0F2F5',
                        boxShadow: '3px 3px 6px rgba(163, 177, 198, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.8)'
                    }}
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    {t('log.tap_to_edit')}
                </button>
            </div>
        </div>
    );
};
