import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { CyclePhaseKey } from '../../services/logic/status';

interface CycleInsightModalProps {
    phaseKey: CyclePhaseKey;
    onClose: () => void;
}

const SECTIONS = ['where_you_are', 'what_is_happening', 'what_you_may_notice', 'helpful_suggestions'] as const;

const PHASE_ART: Record<CyclePhaseKey, { symbol: string; color: string; wash: string }> = {
    neutral: { symbol: '✦', color: '#7598a0', wash: 'from-[#e4f0ef] to-[#f7f8f6]' },
    birth_control: { symbol: '◌', color: '#7598a0', wash: 'from-[#e5eeee] to-[#f7f8f6]' },
    menstrual: { symbol: '●', color: '#d77d8d', wash: 'from-[#fbe8eb] to-[#fff8f6]' },
    follicular: { symbol: '◒', color: '#87a66b', wash: 'from-[#edf4e8] to-[#f9faf5]' },
    ovulation: { symbol: '✦', color: '#d3a14c', wash: 'from-[#fff2d4] to-[#fffaf1]' },
    luteal: { symbol: '◐', color: '#a185b5', wash: 'from-[#f0eafa] to-[#faf8fc]' },
    pms: { symbol: '☾', color: '#9b789f', wash: 'from-[#eee8f4] to-[#faf8fc]' },
    late: { symbol: '↻', color: '#c38a62', wash: 'from-[#f9eadf] to-[#fffaf6]' },
};

export const CycleInsightModal: React.FC<CycleInsightModalProps> = ({ phaseKey, onClose }) => {
    const { t } = useTranslation();
    const art = PHASE_ART[phaseKey];

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    return createPortal((
        <div
            className="cycle-insight-backdrop fixed inset-0 z-[400] flex items-center justify-center"
            role="presentation"
            onClick={onClose}
        >
            <div
                className="cycle-insight-shell h-full w-full max-h-none rounded-none p-0 text-start animate-scale-in"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cycle-insight-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="cycle-insight-modal relative flex h-full min-h-0 flex-col overflow-hidden rounded-none bg-white px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),1rem)] shadow-none sm:px-8 sm:pt-8">
                    <button
                        type="button"
                        onClick={onClose}
                        className="cycle-insight-close absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-slate-400 shadow-[2px_2px_6px_rgba(163,177,198,0.25),-2px_-2px_6px_rgba(255,255,255,0.8)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-rotate-6 hover:text-slate-700 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7598a0]"
                        aria-label={t('common.close')}
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    </button>

                    <header className={`cycle-insight-hero relative mx-auto w-full max-w-2xl shrink-0 overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${art.wash} px-4 pb-5 pt-4`}>
                        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/40 blur-2xl" />
                        <div className="relative flex items-start gap-3 pr-10">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/75 text-xl shadow-[3px_4px_10px_rgba(163,177,198,0.2)]" style={{ color: art.color }} aria-hidden="true">
                                {art.symbol}
                            </div>
                            <div className="min-w-0 pt-0.5">
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{t('cycle_insight.title')}</p>
                                <h2 id="cycle-insight-title" className="mt-1 text-[1.35rem] font-bold leading-tight tracking-[-0.02em] text-slate-800">
                                    {t(`cycle_insight.phases.${phaseKey}.name`)}
                                </h2>
                            </div>
                        </div>
                        <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/70">
                            <div className="h-full w-1/3 rounded-full" style={{ backgroundColor: art.color }} />
                        </div>
                    </header>

                    <div className="cycle-insight-sections custom-scrollbar relative mx-auto mt-4 min-h-0 w-full max-w-2xl flex-1 space-y-2.5 overflow-y-auto pr-1 sm:mt-5">
                        <div className="absolute bottom-5 left-[9px] top-5 w-px bg-slate-200" aria-hidden="true" />
                        {SECTIONS.map((section, index) => (
                            <section key={section} className="relative pl-7">
                                <span className="absolute left-0 top-4 flex h-[19px] w-[19px] items-center justify-center rounded-full bg-white text-[9px] font-bold text-[#7598a0] shadow-[1px_2px_5px_rgba(163,177,198,0.3)]" aria-hidden="true">
                                    {index + 1}
                                </span>
                                <div className={`cycle-insight-section ${index === 0 ? 'cycle-insight-section-featured' : ''} rounded-[1.15rem] px-4 py-3.5`}>
                                    <h3 className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#557880]">
                                        {t(`cycle_insight.${section}`)}
                                    </h3>
                                    <p className="mt-1.5 text-xs leading-[1.55] text-slate-600 sm:text-[13px]">
                                        {t(`cycle_insight.phases.${phaseKey}.${section}`)}
                                    </p>
                                </div>
                            </section>
                        ))}
                    </div>

                    <p className="cycle-insight-disclaimer mx-auto mt-4 w-full max-w-2xl shrink-0 rounded-xl px-3 py-2.5 text-[10px] leading-[1.5] text-slate-400 sm:mt-5">
                        <span className="font-bold text-slate-500">{t('cycle_insight.disclaimer_title')}</span>{' '}
                        {t('cycle_insight.disclaimer_text')}
                    </p>

                    <button
                        type="button"
                        onClick={onClose}
                        className="cycle-insight-action mx-auto mt-3 block w-full max-w-2xl shrink-0 rounded-full bg-[#7598a0] px-4 py-3 text-sm font-bold text-white shadow-[0_8px_16px_rgba(117,152,160,0.22)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#668c95] active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7598a0] focus-visible:ring-offset-2 sm:mt-4"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    ), document.body);
};
