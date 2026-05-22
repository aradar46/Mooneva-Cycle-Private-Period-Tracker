
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DailyLog, FlowIntensity, MoodOptionConfig, MOOD_OPTIONS, PeriodRecord, SYMPTOM_GROUPS, DischargeType, SexDriveType, SexType } from '../types';
import { findNearbyPeriod } from '../services/logic';
import { toLocalISOString, addDays, diffInDays } from '../utils/dateUtils';
import { useAutoSave } from '../hooks/useAutoSave';
import { useMooneva } from '../contexts/MoonevaContext';
import { createPortal } from 'react-dom';
import PeriodEditView from './PeriodEditView';

interface DailyLogPanelProps {
    date: string;
    onClose?: () => void;
    onEditPeriod?: () => void;
}

const FLOW_INTENSITY_OPTIONS = [
    { id: 'spotting' as const, labelKey: 'log.intensity_spotting', defaultLabel: 'Spot', dot: 'w-1.5 h-1.5' },
    { id: 'light' as const, labelKey: 'log.intensity_light', defaultLabel: 'Light', dot: 'w-2.5 h-2.5' },
    { id: 'medium' as const, labelKey: 'log.intensity_medium', defaultLabel: 'Med', dot: 'w-3.5 h-3.5' },
    { id: 'heavy' as const, labelKey: 'log.intensity_heavy', defaultLabel: 'Heavy', dot: 'w-5 h-5' }
];

/**
 * DailyLog Panel.
 * Inline editable section below the calendar for the selected date.
 */
const DailyLogPanel: React.FC<DailyLogPanelProps> = ({
    date,
    onClose,
    onEditPeriod
}) => {
    const { t } = useTranslation();
    const {
        logs,
        settings,
        model,
        actions,
        periods
    } = useMooneva();

    const { getDayMeta } = model;
    const { updateLog, startPeriod, editPeriod, deletePeriod, updatePeriodWithdrawalBleed, updatePeriodIgnoreForAverages } = actions;

    const log = logs[date];

    // Internal state
    const [showPeriodEdit, setShowPeriodEdit] = useState(false);
    const [mergePrompt, setMergePrompt] = useState<{ show: boolean; nearbyPeriod: PeriodRecord } | null>(null);
    const [flow, setFlow] = useState<FlowIntensity>(log?.flow || null);
    const [symptoms, setSymptoms] = useState<string[]>(log?.symptoms || []);
    const [notes, setNotes] = useState(log?.notes || '');
    const [mood, setMood] = useState<string[]>(Array.isArray(log?.mood) ? log.mood : (log?.mood ? [log.mood] : []));
    const [discharge, setDischarge] = useState<DischargeType>(log?.discharge || null);
    const [sexDrive, setSexDrive] = useState<SexDriveType>(log?.sexDrive || null);
    const [sexType, setSexType] = useState<SexType>(log?.sexType || null);

    // Sync state when date/logs change
    useEffect(() => {
        const activeLog = logs[date];
        setFlow(activeLog?.flow || null);
        setSymptoms(activeLog?.symptoms || []);
        setNotes(activeLog?.notes || '');
        setMood(Array.isArray(activeLog?.mood) ? activeLog.mood : (activeLog?.mood ? [activeLog.mood] : []));
        setDischarge(activeLog?.discharge || null);
        setSexDrive(activeLog?.sexDrive || null);
        setSexType(activeLog?.sexType || null);
    }, [date, logs]);

    // Check if there is an existing period overlapping this date
    const activePeriod = useMemo(() => {
        return periods.find(p => {
            const end = addDays(p.startDate, p.days - 1);
            return date >= p.startDate && date <= end;
        });
    }, [periods, date]);

    // Derived Meta for Display
    const meta = getDayMeta(date);

    const saveToLog = useCallback(() => {
        updateLog(date, {
            date,
            flow,
            symptoms,
            notes,
            mood,
            discharge,
            sexDrive,
            sexType
        });
        // Note: Auto-period creation removed. Periods are managed via calendar toggle only.
    }, [date, flow, symptoms, notes, mood, discharge, sexDrive, sexType, updateLog]);

    useAutoSave(saveToLog, [flow, symptoms, notes, mood, discharge, sexDrive, sexType, saveToLog]);

    const handleMerge = () => {
        if (!mergePrompt?.nearbyPeriod) return;
        const nearby = mergePrompt.nearbyPeriod;
        const periodEnd = addDays(nearby.startDate, nearby.days - 1);

        if (date > periodEnd) {
            const newDays = diffInDays(date, nearby.startDate) + 1;
            editPeriod(nearby.id, newDays);
        } else if (date < nearby.startDate) {
            const periodEnd = addDays(nearby.startDate, nearby.days - 1);
            const newDays = diffInDays(periodEnd, date) + 1;
            deletePeriod(nearby.id);
            startPeriod(date, newDays);
        }
        setMergePrompt(null);
    };

    const handleDeclineMerge = () => {
        startPeriod(date, model.predictions.effective.periodLength);
        setMergePrompt(null);
    };

    const toggleSymptom = (sym: string) => {
        if (symptoms.includes(sym)) {
            setSymptoms(symptoms.filter(s => s !== sym));
        } else {
            setSymptoms([...symptoms, sym]);
        }
    };

    const isFuture = !!meta.isUnavailableFuture;
    const visibleSymptoms = settings.symptoms.filter(s => !s.isHidden);

    type TabId = 'flow' | 'mood' | 'symptoms' | 'notes' | 'advanced';
    const [activeTab, setActiveTab] = useState<TabId>('flow');
    const tabItems = [
        { id: 'flow' as const, labelKey: 'log.flow_tab' },
        { id: 'mood' as const, labelKey: 'log.mood' },
        { id: 'symptoms' as const, labelKey: 'log.vitals_tab' },
        { id: 'notes' as const, labelKey: 'log.notes' },
        { id: 'advanced' as const, labelKey: 'log.advanced' }
    ];

    const toggleMood = (m: string) => {
        if (mood.includes(m)) {
            setMood(mood.filter(x => x !== m));
        } else {
            if (mood.length < 3) {
                setMood([...mood, m]);
            }
        }
    };

    return (
        <>
            {showPeriodEdit && activePeriod && createPortal(
                <PeriodEditView
                    period={activePeriod}
                    onClose={() => setShowPeriodEdit(false)}
                />,
                document.body
            )}

            <div
                className="relative z-0 w-[95%] max-w-[95%] mx-auto bg-[#F0F2F5] rounded-b-[32px] px-4 py-4 animate-fade-in space-y-4"
                style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}
            >

                <div className="flex items-center gap-2 mb-4 mt-4">
                    {!meta.isUnavailableFuture && (
                        <div
                            className="flex-1 min-w-0 flex flex-nowrap gap-0 p-1.5 bg-[#F0F2F5] rounded-2xl overflow-x-auto no-scrollbar mt-[5px]"
                            style={{ boxShadow: 'inset 3px 3px 6px rgba(163, 177, 198, 0.4), inset -3px -3px 6px rgba(255, 255, 255, 0.8)' }}
                        >
                            {tabItems.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-shrink-0 flex items-center justify-center px-3 py-2 rounded-xl text-[11px] font-semibold tracking-wide uppercase transition-all duration-200
                                    ${activeTab === tab.id ? 'text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                                    style={activeTab === tab.id ? {
                                        backgroundColor: '#F0F2F5',
                                        boxShadow: '3px 3px 6px rgba(163, 177, 198, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.8)'
                                    } : {}}
                                >
                                    {t(tab.labelKey)}
                                </button>
                            ))}
                        </div>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 p-2 text-slate-500 hover:text-slate-700 transition-colors rounded-xl mt-[5px]"
                            style={{
                                backgroundColor: '#F0F2F5',
                                boxShadow: '3px 3px 6px rgba(163, 177, 198, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.8)'
                            }}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {meta.isUnavailableFuture ? (
                    <div className="py-[13px] px-6 text-center">
                        <p className="text-[13px] font-medium text-slate-400 leading-relaxed max-w-[240px] mx-auto">
                            {t('log.unavailable_future_date')}
                        </p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'flow' && (
                            <section className="flex flex-col gap-4">
                                {!activePeriod && (
                                    <p className="text-[11px] text-slate-500 text-center px-4">
                                        {t('log.spotting_hint_no_period')}
                                    </p>
                                )}
                                <div className="flex flex-col items-center gap-6 py-4">
                                    <div className="flex items-center justify-center gap-4">
                                        {!activePeriod ? (
                                            <>
                                                {/* Only Spotting */}
                                                <FlowCircle
                                                    isSelected={flow === 'spotting'}
                                                    onClick={() => setFlow(flow === 'spotting' ? null : 'spotting')}
                                                    label={t('log.intensity_spotting', 'Spot')}
                                                    dotClass="w-1.5 h-1.5"
                                                />
                                                {/* Start Period Action */}
                                                <ActionCircle
                                                    onClick={onEditPeriod || (() => { })}
                                                    label={t('calendar.period_question')}
                                                    icon={
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            className="w-5 h-5"
                                                            fill="#8aacac"
                                                            style={{ filter: 'drop-shadow(0px 1px 2px rgba(138, 172, 172, 0.4))' }}
                                                        >
                                                            <path d="M12 21.5c-3.59 0-6.5-2.91-6.5-6.5 0-3.59 4-9.5 6.5-12.5 2.5 3 6.5 8.91 6.5 12.5 0 3.59-2.91 6.5-6.5 6.5z" />
                                                        </svg>
                                                    }
                                                />
                                            </>
                                        ) : (
                                            /* All Flow intensities when inside a period */
                                            FLOW_INTENSITY_OPTIONS.map((f) => (
                                                <FlowCircle
                                                    key={f.id}
                                                    isSelected={flow === f.id}
                                                    onClick={() => setFlow(flow === f.id ? null : f.id)}
                                                    label={t(f.labelKey, f.defaultLabel)}
                                                    dotClass={f.dot}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeTab === 'mood' && (
                            <section className="flex flex-col gap-3">
                                <div className="flex flex-wrap gap-x-4 gap-y-3 py-4 items-center justify-center max-w-[280px] mx-auto">
                                    {MOOD_OPTIONS.map(opt => (
                                        <MoodCircle
                                            key={opt.id}
                                            config={opt}
                                            isSelected={mood.includes(opt.id)}
                                            onClick={() => toggleMood(opt.id)}
                                        >
                                            {t(opt.labelKey)}
                                        </MoodCircle>
                                    ))}
                                </div>
                            </section>
                        )}

                        {activeTab === 'symptoms' && (
                            <section className="flex flex-col gap-5 py-2">
                                <div className="flex flex-wrap gap-2">
                                    {visibleSymptoms
                                        .sort((a, b) => a.label.localeCompare(b.label))
                                        .map(sym => {
                                            const isSelected = symptoms.includes(sym.label);
                                            return (
                                                <button
                                                    key={sym.id}
                                                    onClick={() => toggleSymptom(sym.label)}
                                                    className={`px-3 py-2 rounded-xl text-[11px] font-bold tracking-tight transition-all duration-200 border
                                                     ${isSelected
                                                            ? 'bg-white scale-[0.98]'
                                                            : 'bg-white border-transparent text-slate-500 hover:border-slate-200'}`}
                                                    style={isSelected ? {
                                                        borderColor: '#fb7185',
                                                        color: '#fb7185',
                                                        boxShadow: 'inset 2px 2px 5px rgba(163, 177, 198, 0.4), inset -2px -2px 5px rgba(255, 255, 255, 0.8)'
                                                    } : {
                                                        boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.8)'
                                                    }}
                                                >
                                                    {t(`symptom.${sym.label.toLowerCase()}`, sym.label)}
                                                </button>
                                            );
                                        })}
                                </div>

                                {settings.showFertileWindow && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 pl-1">
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-teal-400">{t('log.secretions', 'Secretions')}</span>
                                            <div className="h-[1.5px] w-6 bg-teal-200 rounded-full" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'dry', label: 'log.discharge_dry' },
                                                { id: 'sticky_creamy', label: 'log.discharge_sticky_creamy' },
                                                { id: 'egg_white', label: 'log.discharge_egg_white' },
                                                { id: 'unusual', label: 'log.discharge_unusual' }
                                            ].map(opt => {
                                                const isSelected = discharge === opt.id;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => setDischarge(discharge === opt.id ? null : opt.id as DischargeType)}
                                                        className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 border
                                                ${isSelected
                                                                ? 'bg-white border-[#2dd4bf] text-[#2dd4bf]'
                                                                : 'bg-white border-transparent text-slate-400 hover:border-slate-200'}`}
                                                        style={isSelected ? {
                                                            boxShadow: 'inset 2px 2px 5px rgba(163, 177, 198, 0.4), inset -2px -2px 5px rgba(255, 255, 255, 0.8)'
                                                        } : {
                                                            boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.8)'
                                                        }}
                                                    >
                                                        {t(opt.label)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 pl-1">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">{t('log.sex_libido', 'Sex & Libido')}</span>
                                        <div className="h-[1.5px] w-6 bg-amber-200 rounded-full" />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="flex gap-2 p-1 bg-[#F0F2F5] rounded-xl border border-slate-200/50" style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.3)' }}>
                                            {[
                                                { id: 'low', label: t('log.libido_low', 'Low') },
                                                { id: 'medium', label: t('log.libido_medium', 'Medium') },
                                                { id: 'high', label: t('log.libido_high', 'High') }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setSexDrive(sexDrive === opt.id ? null : opt.id as SexDriveType)}
                                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all duration-200
                                            ${sexDrive === opt.id ? 'bg-white text-amber-600 shadow-sm border border-amber-100' : 'text-slate-400'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 p-1 bg-[#F0F2F5] rounded-xl border border-slate-200/50" style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.3)' }}>
                                            {[
                                                { id: 'protected', label: t('log.sex_protected', 'Protected') },
                                                { id: 'unprotected', label: t('log.sex_unprotected', 'Unprotected') }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setSexType(sexType === opt.id ? null : opt.id as SexType)}
                                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all duration-200
                                            ${sexType === opt.id ? 'bg-white text-[#a855f7] shadow-sm border border-[#a855f7]/30' : 'text-slate-400'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeTab === 'notes' && (
                            <section className="flex flex-col gap-3">
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={t('log.add_note_placeholder', 'Add your notes specific to this date...')}
                                    className="w-full min-h-[100px] p-3 text-xs font-medium text-slate-700 placeholder-slate-400 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-0 focus:border-slate-300 resize-none transition-all"
                                />
                            </section>
                        )}

                        {activeTab === 'advanced' && activePeriod && (
                            <section className="flex flex-col gap-4 py-2">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 pl-1">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">{t('log.period_type', 'Period Type')}</span>
                                        <div className="h-[1.5px] w-6 bg-indigo-200 rounded-full" />
                                    </div>
                                    <div
                                        className="flex items-center justify-between gap-3 p-4 bg-[#F0F2F5] rounded-xl border border-slate-200/50 cursor-pointer transition-all active:scale-[0.99]"
                                        style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.3)' }}
                                        onClick={() => updatePeriodWithdrawalBleed(activePeriod.id, !activePeriod.isWithdrawalBleed)}
                                    >
                                        <div className="flex-1">
                                            <label className="text-[11px] font-bold text-slate-700 cursor-pointer select-none block">
                                                {t('log.withdrawal_bleed_question', 'Was this a withdrawal bleed?')}
                                            </label>
                                            <p className="text-[9px] text-slate-400 mt-0.5">
                                                {t('log.withdrawal_bleed_desc', 'Tag if on hormonal birth control (pill, ring, patch)')}
                                            </p>
                                        </div>
                                        <div
                                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 border-2
                                            ${activePeriod.isWithdrawalBleed
                                                    ? 'bg-indigo-50 border-indigo-400 text-indigo-600'
                                                    : 'bg-white border-transparent text-transparent shadow-[1px_1px_2px_rgba(163,177,198,0.4)]'}`}
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </div>
                                    </div>
                                    {activePeriod.isWithdrawalBleed && (
                                        <p className="text-[10px] text-indigo-500 px-1 font-medium">
                                            💊 {t('log.withdrawal_tagged', 'This period is tagged as a withdrawal bleed and will be excluded from natural cycle statistics.')}
                                        </p>
                                    )}
                                </div>

                                {/* Ignore for Averages Toggle */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 pl-1">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">{t('log.stats')}</span>
                                        <div className="h-[1.5px] w-6 bg-amber-200 rounded-full" />
                                    </div>
                                    <div
                                        className="flex items-center justify-between gap-3 p-4 bg-[#F0F2F5] rounded-xl border border-slate-200/50 cursor-pointer transition-all active:scale-[0.99]"
                                        style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.3)' }}
                                        onClick={() => updatePeriodIgnoreForAverages(activePeriod.id, !activePeriod.ignoreForAverages)}
                                    >
                                        <div className="flex-1">
                                            <label className="text-[11px] font-bold text-slate-700 cursor-pointer select-none block">
                                                {t('log.ignore_averages_question', 'Exclude from cycle averages?')}
                                            </label>
                                            <p className="text-[9px] text-slate-400 mt-0.5">
                                                {t('log.ignore_averages_desc', 'For irregular cycles (stress, illness, etc.)')}
                                            </p>
                                        </div>
                                        <div
                                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 border-2
                                            ${activePeriod.ignoreForAverages
                                                    ? 'bg-amber-50 border-amber-400 text-amber-600'
                                                    : 'bg-white border-transparent text-transparent shadow-[1px_1px_2px_rgba(163,177,198,0.4)]'}`}
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </div>
                                    </div>
                                    {activePeriod.ignoreForAverages && (
                                        <p className="text-[10px] text-amber-500 px-1 font-medium">
                                            ⚠️ {t('log.ignore_tagged', 'This period will be excluded from cycle length calculations and averages.')}
                                        </p>
                                    )}
                                </div>
                            </section>
                        )}

                        {activeTab === 'advanced' && !activePeriod && (
                            <section className="flex flex-col items-center justify-center py-8">
                                <p className="text-xs text-slate-400 text-center">
                                    {t('log.no_period_advanced', 'This date is not part of a period. Start or select a period day to access advanced options.')}
                                </p>
                            </section>
                        )}
                    </>
                )}
            </div>

            {mergePrompt?.show && createPortal(
                <>
                    <div className="fixed inset-0 bg-black/30 z-[301] animate-fade-in" onClick={() => setMergePrompt(null)} />
                    <div className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-[302] bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                        <h3 className="text-lg font-black text-slate-800 mb-2">Nearby Period Detected</h3>
                        <p className="text-sm text-slate-500 mb-6">Would you like to merge this day into the existing period?</p>
                        <div className="flex gap-3">
                            <button onClick={handleDeclineMerge} className="flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-slate-500 bg-slate-100">New Period</button>
                            <button onClick={handleMerge} className="flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-white bg-rose-500">Merge</button>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    );
};

interface SelectionCircleProps {
    isSelected: boolean;
    onClick: () => void;
    colorConfig: { color: string; dark: string; shadow: string };
    children: React.ReactNode;
}

const SelectionCircle: React.FC<SelectionCircleProps> = ({ isSelected, onClick, colorConfig, children }) => (
    <button
        onClick={onClick}
        className={`relative flex flex-col items-center justify-center w-[58px] h-[58px] rounded-full transition-all duration-300 active:scale-95 ${isSelected ? 'z-10' : 'bg-[#F0F2F5]'}`}
        style={isSelected ? {
            boxShadow: `8px 8px 16px ${colorConfig.shadow}, -4px -4px 12px rgba(255, 255, 255, 0.8)`,
            border: `3px solid ${colorConfig.color}`,
            backgroundColor: `${colorConfig.color}1A`,
            color: colorConfig.dark
        } : {
            boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.4), -4px -4px 8px rgba(255, 255, 255, 0.8)',
            color: '#94a3b8',
            border: '1px solid transparent'
        }}
    >
        {children}
    </button>
);

const MoodCircle: React.FC<{ config: MoodOptionConfig; isSelected: boolean; onClick: () => void; children: React.ReactNode }> = ({
    config, isSelected, onClick, children
}) => (
    <SelectionCircle isSelected={isSelected} onClick={onClick} colorConfig={config}>
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-center px-1">{children}</span>
    </SelectionCircle>
);

const FlowCircle: React.FC<{ isSelected: boolean; onClick: () => void; label: string; dotClass: string }> = ({
    isSelected, onClick, label, dotClass
}) => {
    const config = { color: '#fb7185', dark: '#9f1239', shadow: 'rgba(251, 113, 133, 0.4)' };
    return (
        <SelectionCircle isSelected={isSelected} onClick={onClick} colorConfig={config}>
            <div className="flex flex-col items-center gap-1">
                <div className={`${dotClass} rounded-full transition-colors ${isSelected ? 'bg-rose-600' : 'bg-rose-300'}`} />
                <span className="text-[9px] font-black uppercase tracking-[0.05em]">{label}</span>
            </div>
        </SelectionCircle>
    );
};

const ActionCircle: React.FC<{ onClick: () => void; label: string; icon: React.ReactNode }> = ({
    onClick, label, icon
}) => {
    const config = { color: '#fb7185', dark: '#9f1239', shadow: 'rgba(251, 113, 133, 0.3)' };
    return (
        <SelectionCircle isSelected={false} onClick={onClick} colorConfig={config}>
            <div className="flex flex-col items-center gap-1">
                {icon}
                <span className="text-[9px] font-black uppercase tracking-[0.05em]">{label}</span>
            </div>
        </SelectionCircle>
    );
};

export default DailyLogPanel;
