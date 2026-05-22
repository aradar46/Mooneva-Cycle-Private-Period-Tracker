import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Logger from '../../services/logger';
import { useMooneva } from '../../contexts/MoonevaContext';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { addDays } from '../../utils/dateUtils';
import { formatNumber } from '../../services/i18n';
import { Cycle, DailyLog, MOOD_OPTIONS } from '../../types';

interface ClinicalReportViewProps {
    onClose: () => void;
}

interface CycleDetail {
    cycle: Cycle;
    days: (DailyLog & { cycleDay: number })[];
}

export const ClinicalReportView: React.FC<ClinicalReportViewProps> = ({ onClose }) => {
    const { t, i18n } = useTranslation();
    const { logs, model, settings, periods } = useMooneva();
    const [isSharing, setIsSharing] = React.useState(false);
    const [includeSymptoms, setIncludeSymptoms] = React.useState(true);
    const [includeNotes, setIncludeNotes] = React.useState(true);
    const [includeSex, setIncludeSex] = React.useState(true);
    const [includeLibido, setIncludeLibido] = React.useState(true);
    const [includeSecretion, setIncludeSecretion] = React.useState(true);

    const handleShare = async () => {
        setIsSharing(true);
        const element = document.getElementById('report-content');
        if (!element) return;

        // Adaptive scaling: Very long reports exceed canvas height limits (approx 65k pixels).
        // Reduced scale for sustainability in long reports.
        let scale = 2; // Default sharp scale for short reports
        if (cycleDetails.length > 25) scale = 1.0;
        else if (cycleDetails.length > 12) scale = 1.5;

        // Optimized for A4 PDF single page
        const opt = {
            margin: [10, 10, 10, 10] as [number, number, number, number],
            filename: 'mooneva_clinical_report.pdf',
            image: { type: 'jpeg' as const, quality: 0.95 }, // JPEG is more memory-efficient than PNG for PDF
            html2canvas: {
                scale: scale,
                useCORS: true,
                logging: false,
                letterRendering: false, // Turned off to avoid blank pages with complex layouts
                scrollY: 0, // Ensure content is captured from the top
                windowWidth: 800, // Ensure a consistent width for rendering
                backgroundColor: '#ffffff' // Explicitly set background
            },
            jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const, compress: true },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        try {
            await document.fonts.ready; // Wait for fonts to load

            // Lazy load html2pdf.js only when needed
            // @ts-ignore
            const html2pdf = (await import('html2pdf.js')).default;

            const pdfDataUri = await html2pdf().set(opt).from(element).outputPdf('datauristring');
            const base64Data = pdfDataUri.split(',')[1];
            const fileName = 'mooneva_clinical_report.pdf';
            const result = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Cache
            });

            await Share.share({
                title: t('settings.clinical_report'),
                url: result.uri,
                dialogTitle: t('settings.clinical_report')
            });

        } catch (error) {
            Logger.error('Error sharing PDF:', error);
            alert('Failed to share PDF. Please try again.');
        } finally {
            setIsSharing(false);
        }
    };

    // --- Data Preparation ---
    const cycleDetails: CycleDetail[] = useMemo(() => {
        // 1. Prepare cycles list including ongoing
        let allCycles = [...model.cycles];

        if (periods && periods.length > 0) {
            const lastPeriodStart = periods.reduce((latest, current) =>
                current.startDate > latest ? current.startDate : latest
                , periods[0].startDate);

            // Check if last period is already in cycles (it shouldn't be if it's ongoing)
            const exists = allCycles.some(c => c.startDate === lastPeriodStart);
            if (!exists) {
                const todayMs = Date.now();
                const startMs = new Date(lastPeriodStart).getTime();
                const diffDays = Math.ceil((todayMs - startMs) / (1000 * 60 * 60 * 24));

                const ongoingCycle: any = {
                    startDate: lastPeriodStart,
                    isOngoing: true,
                    length: diffDays + 1, // Include today
                    periodLength: periods.find(p => p.startDate === lastPeriodStart)?.days || 5
                };
                allCycles.push(ongoingCycle);
            }
        }

        // Sort cycles DESC (newest first)
        const sortedCycles = allCycles.sort((a, b) => b.startDate.localeCompare(a.startDate));

        return sortedCycles.map(cycle => {
            const cycleDays: (DailyLog & { cycleDay: number })[] = [];

            // For report, show all days up to length
            const effectiveLength = cycle.length || 28;

            for (let i = 0; i < effectiveLength; i++) {
                const date = addDays(cycle.startDate, i);
                const log = logs[date];

                // Only include days with data
                if (log && (log.flow || (log.symptoms && log.symptoms.length > 0) || (log.mood && (Array.isArray(log.mood) ? log.mood.length > 0 : true)) || log.notes || log.sexDrive || log.discharge || log.sexType)) {
                    cycleDays.push({ ...log, cycleDay: i + 1 });
                }
            }

            // Sort days DESC within the cycle as requested
            cycleDays.sort((a, b) => b.date.localeCompare(a.date));

            return {
                cycle,
                days: cycleDays
            };
        });
    }, [model.cycles, logs, periods]);

    // Calculate Averages (exclude ongoing from stats to avoid skewing)
    const averages = useMemo(() => {
        const validCycles = model.cycles.filter(c => !c.isWithdrawalBleed && !c.isOutlier && c.isValid !== false);
        if (validCycles.length === 0) return { avgCycle: '-', avgPeriod: '-' };

        const totalCycle = validCycles.reduce((sum, c) => sum + (c.length || 0), 0);
        const totalPeriod = validCycles.reduce((sum, c) => sum + (c.periodLength || 0), 0);

        return {
            avgCycle: Math.round(totalCycle / validCycles.length),
            avgPeriod: Math.round(totalPeriod / validCycles.length)
        };
    }, [model.cycles]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
    };

    const getFlowLabel = (flow: string | null) => {
        if (!flow) return '-';
        if (flow === 'heavy') return t('settings.flow_short_heavy');
        if (flow === 'medium') return t('settings.flow_short_medium');
        if (flow === 'light') return t('settings.flow_short_light');
        if (flow === 'spotting') return t('settings.flow_short_spotting');
        return '-';
    };

    // Formatting Helpers
    const formatSymptoms = (symptoms: string[] = []) => {
        if (!symptoms.length) return '-';
        const display = symptoms.slice(0, 3).map(s => t(`symptom.${s}`, s));
        if (symptoms.length > 3) display.push('...');
        return display.join(', ');
    };

    // Helper for Cycle Type Label
    const getCycleLabel = (cycle: Cycle) => {
        if (cycle.isWithdrawalBleed) return t('settings.pill_controlled');

        // Strict irregularity check: < 21 or > 35 days
        // We explicitly check length if it exists
        if (cycle.length && (cycle.length < 21 || cycle.length > 35)) {
            return t('settings.natural_irregular');
        }

        // Fallback to explicit properties if length check didn't trigger (e.g. undefined length)
        if (cycle.isOutlier || cycle.isValid === false) {
            return t('settings.natural_irregular');
        }

        return t('settings.natural');
    };

    const isRtl = i18n.dir() === 'rtl';

    return (
        <div className={`fixed inset-0 z-50 bg-white overflow-y-auto font-sans text-black animate-fade-in ${isRtl ? 'font-arabic tracking-normal' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Toolbar */}
            <div className="no-print sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md text-white shadow-md px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] border-b border-slate-700/50">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-90">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <span className="font-bold text-sm tracking-tight text-slate-200 uppercase">{t('settings.report_preview')}</span>
                    </div>

                    <button onClick={handleShare} disabled={isSharing} className="px-6 py-2 bg-blue-500 rounded-lg text-xs font-bold hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20 active:scale-95 text-white flex items-center gap-2">
                        {isSharing ? t('settings.saving') : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                                {t('common.share')}
                            </>
                        )}
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-start sm:justify-end border-t border-white/5 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${includeSymptoms ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 bg-transparent'}`}>
                            {includeSymptoms && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <input type="checkbox" checked={includeSymptoms} onChange={(e) => setIncludeSymptoms(e.target.checked)} className="hidden" />
                        <span className="text-[10px] font-medium text-slate-300 group-hover:text-white transition-colors select-none">{t('settings.include_symptoms')}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${includeNotes ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 bg-transparent'}`}>
                            {includeNotes && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} className="hidden" />
                        <span className="text-[10px] font-medium text-slate-300 group-hover:text-white transition-colors select-none">{t('settings.include_notes')}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${includeSex ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 bg-transparent'}`}>
                            {includeSex && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <input type="checkbox" checked={includeSex} onChange={(e) => setIncludeSex(e.target.checked)} className="hidden" />
                        <span className="text-[10px] font-medium text-slate-300 group-hover:text-white transition-colors select-none">{t('settings.include_sex')}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${includeLibido ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 bg-transparent'}`}>
                            {includeLibido && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <input type="checkbox" checked={includeLibido} onChange={(e) => setIncludeLibido(e.target.checked)} className="hidden" />
                        <span className="text-[10px] font-medium text-slate-300 group-hover:text-white transition-colors select-none">{t('settings.include_libido')}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${includeSecretion ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 bg-transparent'}`}>
                            {includeSecretion && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <input type="checkbox" checked={includeSecretion} onChange={(e) => setIncludeSecretion(e.target.checked)} className="hidden" />
                        <span className="text-[10px] font-medium text-slate-300 group-hover:text-white transition-colors select-none">{t('settings.include_secretion')}</span>
                    </label>
                </div>
            </div>

            {/* A4 Content Wrapper */}
            <div id="report-content" className="max-w-[210mm] mx-auto bg-white p-[15mm] text-xs leading-relaxed min-h-[297mm]">

                {/* Header */}
                <div className="mb-4 border-b-2 border-slate-900 pb-4">
                    <div className="flex justify-between items-baseline mb-2">
                        <span className="font-black text-2xl tracking-tight text-slate-900 uppercase">{t('settings.clinical_report')}</span>
                        <span className="font-mono text-slate-500">{new Date().toLocaleDateString(i18n.language)}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-slate-600 font-medium">
                        <span>{t('settings.patient_id')}: <span className="text-slate-900 font-bold">{settings.userName || 'Anonymous'}</span></span>
                        <div className={`${isRtl ? 'text-left' : 'text-right'}`}>
                            <div className="text-[10px] uppercase tracking-wider">{t('settings.source')}: <span className="font-bold">Mooneva Cycle: private period tracker</span></div>
                        </div>
                    </div>
                </div>



                {/* 1. Statistics & Summary Combined */}
                <div className="mb-10">
                    <div className="flex justify-between items-end mb-3 border-b border-slate-200 pb-1">
                        <div className="font-black uppercase tracking-wider text-[11px] text-slate-900">{t('settings.cycle_history_summary')}</div>
                        {/* Averages Inline */}
                        <div className="flex gap-4 text-[10px]">
                            <div>
                                <span className={`text-slate-500 uppercase font-bold ${isRtl ? 'ml-1' : 'mr-1'}`}>{t('settings.cycle_length_label')}:</span>
                                <span className="font-black text-slate-800">{averages.avgCycle}</span>
                            </div>
                            <div>
                                <span className={`text-slate-500 uppercase font-bold ${isRtl ? 'ml-1' : 'mr-1'}`}>{t('settings.period_length_label')}:</span>
                                <span className="font-black text-slate-800">{averages.avgPeriod}</span>
                            </div>
                        </div>
                    </div>

                    <table className={`w-full border-collapse border-b border-slate-200 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                                <th className="py-2 px-2 w-[25%]">{t('settings.table_start_date')}</th>
                                <th className="py-2 px-2 w-[25%]">{t('settings.cycle_type')}</th>
                                <th className="py-2 px-2 w-[25%]">{t('settings.table_cycle_length')}</th>
                                <th className="py-2 px-2 w-[25%]">{t('settings.period_duration')}</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-700">
                            {cycleDetails.map(({ cycle }, i) => (
                                <tr key={i} className="border-t border-slate-100">
                                    <td className="py-2 px-2 font-mono text-[11px]">{cycle.startDate}</td>
                                    <td className="py-2 px-2 text-[11px]">
                                        {getCycleLabel(cycle)}
                                    </td>
                                    <td className="py-2 px-2 font-bold">{cycle.length || '-'} <span className="text-[9px] font-normal text-slate-400">{t('common.days_short')}</span></td>
                                    <td className="py-2 px-2 font-bold">{cycle.periodLength || '-'} <span className="text-[9px] font-normal text-slate-400">{t('common.days_short')}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 2. Individual Cycle Details */}
                <div className="space-y-10">
                    {cycleDetails.map(({ cycle, days }, i) => (
                        <div key={i} className="break-inside-avoid page-break">
                            {/* Cycle Header */}
                            <div className="bg-slate-50 p-3 rounded-t-lg border border-slate-200 border-b-0 flex justify-between items-baseline mb-0">
                                <div>
                                    <span className="font-bold text-slate-900 text-sm">
                                        {t('settings.cycle_num', { count: cycleDetails.length - i })}: {formatDate(cycle.startDate)}
                                        {cycle.endDate ? ` – ${formatDate(cycle.endDate)}` : ''}
                                    </span>
                                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide font-medium">
                                        {getCycleLabel(cycle)}
                                    </div>
                                </div>
                                <div className={`text-[11px] text-slate-600 ${isRtl ? 'text-left' : 'text-right'}`}>
                                    <span className="font-semibold">{cycle.length} {t('common.days_short')}</span> {t('dashboard.cycle_active')}, <span className="font-semibold">{cycle.periodLength} {t('common.days_short')}</span> {t('settings.run_flux')}
                                </div>
                            </div>

                            {/* Cycle Data Table */}
                            <table className={`w-full border-collapse border border-slate-200 text-[11px] table-fixed ${isRtl ? 'text-right' : 'text-left'}`}>
                                <thead>
                                    <tr className="bg-slate-100 text-slate-600 uppercase tracking-wider font-bold text-[9px]">
                                        <th className={`py-2 px-2 w-[5%] ${isRtl ? 'border-l' : 'border-r'} border-slate-200`}>#</th>
                                        <th className={`py-2 px-2 w-[14%] ${isRtl ? 'border-l' : 'border-r'} border-slate-200`}>{t('common.date')}</th>
                                        <th className={`py-2 px-2 w-[8%] ${isRtl ? 'border-l' : 'border-r'} border-slate-200`}>{t('settings.flow')}</th>
                                        {(includeSex || includeLibido || includeSecretion) && (
                                            <th className={`py-2 px-2 w-[20%] ${isRtl ? 'border-l' : 'border-r'} border-slate-200`}>{t('settings.sex_libido_secretion')}</th>
                                        )}
                                        {includeSymptoms && <th className={`py-2 px-2 w-[28%] ${isRtl ? 'border-l' : 'border-r'} border-slate-200`}>{t('settings.symptoms_mood')}</th>}
                                        {includeNotes && <th className="py-2 px-2 w-[25%]">{t('settings.notes')}</th>}
                                    </tr>
                                </thead>
                                <tbody className="text-slate-700">
                                    {days.length > 0 ? days.map((day, dIdx) => (
                                        <tr key={dIdx} className="border-t border-slate-100 hover:bg-slate-50">
                                            <td className={`py-2 px-2 font-mono text-slate-400 ${isRtl ? 'border-l' : 'border-r'} border-slate-100`}>{day.cycleDay}</td>
                                            <td className={`py-2 px-2 font-mono ${isRtl ? 'border-l' : 'border-r'} border-slate-100`}>{formatDate(day.date)}</td>

                                            {/* Flow */}
                                            <td className={`py-2 px-2 text-center font-bold text-slate-800 ${isRtl ? 'border-l' : 'border-r'} border-slate-100`}>
                                                <span className="text-xs">{getFlowLabel(day.flow)}</span>
                                            </td>

                                            {/* Combined Sex / Libido / Secretion */}
                                            {(includeSex || includeLibido || includeSecretion) && (
                                                <td className={`py-2 px-2 ${isRtl ? 'border-l' : 'border-r'} border-slate-100 text-[9px]`}>
                                                    <div className="flex flex-col gap-0.5">
                                                        {(includeSex && day.sexType) && <div className="font-bold text-slate-800">{t(`log.sex_${day.sexType}`)}</div>}
                                                        {(includeLibido && day.sexDrive) && <div className="text-slate-600">{t('settings.libido')}: {t(`log.libido_${day.sexDrive}`)}</div>}
                                                        {(includeSecretion && day.discharge) && <div className="text-slate-500 opacity-80">{t(`log.discharge_${day.discharge}`)}</div>}
                                                    </div>
                                                </td>
                                            )}

                                            {/* Symptoms & Mood */}
                                            {includeSymptoms && (
                                                <td className={`py-2 px-2 ${isRtl ? 'border-l' : 'border-r'} border-slate-100`}>
                                                    <div className="flex flex-col gap-0.5">
                                                        {day.mood && (Array.isArray(day.mood) ? day.mood : [day.mood]).map(m => {
                                                            const config = MOOD_OPTIONS.find(opt => opt.id === m);
                                                            return (
                                                                <span key={m} className="text-[9px] font-bold text-slate-600 uppercase">
                                                                    {config ? config.emoji : ''} {t(`log.mood_${m}`, m)}
                                                                </span>
                                                            );
                                                        })}
                                                        <span className="text-slate-500 text-[10px] leading-tight">{formatSymptoms(day.symptoms)}</span>
                                                    </div>
                                                </td>
                                            )}

                                            {/* Notes - ENFORCED WRAP */}
                                            {includeNotes && (
                                                <td className="py-2 px-2 opacity-75 text-slate-500 text-[10px] leading-tight break-words whitespace-normal">
                                                    {day.notes || '-'}
                                                </td>
                                            )}
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={6} className="p-4 text-center text-slate-400 opacity-75">{t('settings.no_data_logged')}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-12 text-[9px] text-slate-300 text-center font-mono uppercase tracking-widest border-t border-slate-200 pt-4">
                    {t('settings.report_footer_new')}
                </div>
            </div>
        </div>
    );
};
