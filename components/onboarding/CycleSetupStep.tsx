import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingCard, SettingRow, Toggle } from '../settings/SettingsUI';
import NumberSettingRow from '../settings/NumberSettingRow';

// Icons mirrored from Settings.tsx so this step matches the Cycle Management panel.
const Icons = {
    Brain: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A5 5 0 0 1 12 4a5 5 0 0 1 2.5-2 5.5 5.5 0 0 1 5.5 5.5c0 1.38-.5 2.63-1.32 3.58.11.16.21.32.32.42A4.5 4.5 0 1 1 12 18a4.5 4.5 0 1 1-7-3.5c.11-.1.21-.26.32-.42A5.48 5.48 0 0 1 4 7.5 5.5 5.5 0 0 1 9.5 2z" /><path d="M12 11V8" /><path d="M12 18v-3" /></svg>,
    Alert: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
    Egg: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a8 8 0 0 0 8-8c0-4.42-3.58-12-8-12s-8 7.58-8 12a8 8 0 0 0 8 8z" /></svg>,
    Pill: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></svg>,
    Pause: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
};

export interface CycleSetupValues {
    adaptivePrediction: boolean;
    cycleLength: number;
    periodLength: number;
    lutealPhaseLength: number;
    showFertileWindow: boolean;
    showPMS: boolean;
    pmsLength: number;
    isOnBirthControl: boolean;
    predictionsPaused: boolean;
}

interface CycleSetupStepProps {
    values: CycleSetupValues;
    onChange: (values: CycleSetupValues) => void;
}

/**
 * Onboarding mirror of the Settings > Cycle Management panel.
 * Same rows and the same interlocking rules, so what users set here is what
 * they find later in Settings.
 */
const CycleSetupStep: React.FC<CycleSetupStepProps> = ({ values, onChange }) => {
    const { t } = useTranslation();
    const set = (patch: Partial<CycleSetupValues>) => onChange({ ...values, ...patch });
    const [fertilityDisclaimerExpanded, setFertilityDisclaimerExpanded] = React.useState(false);

    // Content usually overflows on small phones. Track scroll position so the
    // "more below" hint only shows while there is actually more to see below.
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [hasMoreBelow, setHasMoreBelow] = React.useState(true);
    const checkOverflow = React.useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setHasMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    }, []);
    React.useEffect(() => {
        checkOverflow();
    }, [checkOverflow, values, fertilityDisclaimerExpanded]);

    return (
        <div className="flex flex-col h-full min-h-0">
            <h2 className="flex-shrink-0 text-lg font-black text-slate-800 tracking-tight text-center mb-2">
                {t('settings.cycle_mgmt_title')}
            </h2>

            {/* The card list overflows on most phones, so fade the bottom edge
                and bounce a chevron to signal there is more below (birth control / pause). */}
            <div className="flex-1 min-h-0 relative">
                <div ref={scrollRef} onScroll={checkOverflow} className="h-full overflow-y-auto no-scrollbar px-1 pb-6">
                    <div className="space-y-3">
                    <SettingCard>
                        <SettingRow
                            label={t('settings.adaptive_prediction_label')}
                            desc={values.isOnBirthControl ? t('settings.on_bc_disabled') : t('settings.adaptive_prediction_desc_long')}
                            icon={<Icons.Brain />}
                            last
                        >
                            <Toggle
                                active={values.adaptivePrediction && !values.isOnBirthControl}
                                onClick={() => {
                                    if (!values.isOnBirthControl) {
                                        const nextVal = !values.adaptivePrediction;
                                        set({
                                            adaptivePrediction: nextVal,
                                            // Turning adaptive on resumes predictions
                                            ...(nextVal ? { predictionsPaused: false } : {})
                                        });
                                    }
                                }}
                                disabled={values.isOnBirthControl}
                            />
                        </SettingRow>

                    </SettingCard>

                    <SettingCard>
                        <SettingRow
                            label={t('settings.show_fertile_window')}
                            desc={values.isOnBirthControl ? t('settings.on_bc_disabled') : t('settings.show_fertile_window_desc')}
                            icon={<Icons.Egg />}
                        >
                            <Toggle
                                active={values.showFertileWindow && !values.isOnBirthControl}
                                onClick={() => !values.isOnBirthControl && set({ showFertileWindow: !values.showFertileWindow })}
                                disabled={values.isOnBirthControl}
                            />
                        </SettingRow>

                        {values.showFertileWindow && !values.isOnBirthControl && (
                            <div className="px-4 pb-4 -mt-1">
                                <div
                                    className="rounded-xl overflow-hidden"
                                    style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.25), inset -2px -2px 4px rgba(255, 255, 255, 0.7)' }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setFertilityDisclaimerExpanded(!fertilityDisclaimerExpanded)}
                                        aria-expanded={fertilityDisclaimerExpanded}
                                        className="w-full flex items-center justify-between gap-2 p-4 text-left"
                                    >
                                        <span className="inline-flex items-center gap-1.5 text-amber-600 font-semibold text-[12px] [&_svg]:w-3.5 [&_svg]:h-3.5">
                                            <Icons.Alert />
                                            {t('settings.fertility_disclaimer_title')}
                                        </span>
                                        <svg
                                            className={`w-3.5 h-3.5 text-amber-600 shrink-0 transition-transform ${fertilityDisclaimerExpanded ? 'rotate-180' : ''}`}
                                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                                        >
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </button>
                                    {fertilityDisclaimerExpanded && (
                                        <div className="px-4 pb-4 -mt-1">
                                            <p className="text-[12px] text-slate-600 leading-relaxed">
                                                {t('settings.fertility_disclaimer_body')}
                                            </p>
                                            <a
                                                href="https://www.who.int/news-room/fact-sheets/detail/family-planning-contraception"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-block mt-2 text-[11px] font-semibold text-[#7598a0] hover:underline"
                                            >
                                                {t('common.learn_more')}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </SettingCard>

                    <SettingCard>
                        <SettingRow
                            label={t('settings.show_pms_window')}
                            desc={t('settings.show_pms_window_desc')}
                            icon={<Icons.Alert />}
                        >
                            <Toggle
                                active={values.showPMS}
                                onClick={() => set({ showPMS: !values.showPMS })}
                            />
                        </SettingRow>

                        {values.showPMS && (
                            <NumberSettingRow
                                label={t('settings.pms_window_label')}
                                description={t('settings.pms_window_desc')}
                                icon={<Icons.Alert />}
                                value={values.pmsLength}
                                onChange={(val) => set({ pmsLength: val })}
                                min={1}
                                max={7}
                                defaultValue={3}
                            />
                        )}
                    </SettingCard>

                    <SettingCard>
                        <SettingRow
                            label={t('settings.birth_control')}
                            desc={t('settings.birth_control_sub_desc')}
                            icon={<Icons.Pill />}
                        >
                            <Toggle
                                active={values.isOnBirthControl}
                                onClick={() => {
                                    if (!values.isOnBirthControl) {
                                        set({
                                            isOnBirthControl: true,
                                            showFertileWindow: false,
                                            adaptivePrediction: false,
                                            cycleLength: 28
                                        });
                                    } else {
                                        set({ isOnBirthControl: false });
                                    }
                                }}
                            />
                        </SettingRow>
                        <div className="pl-[64px] pr-4 pb-3 -mt-2">
                            {values.isOnBirthControl ? (
                                <p className="text-xs text-amber-600 font-medium">{t('settings.bc_protected_msg')}</p>
                            ) : (
                                <p className="text-xs text-slate-400 italic">{t('settings.birth_control_pill_hint')}</p>
                            )}
                        </div>
                    </SettingCard>

                    <SettingCard>
                        <SettingRow
                            label={t('settings.pause_predictions')}
                            desc={t('settings.pause_predictions_full_desc')}
                            icon={<Icons.Pause />}
                            last
                        >
                            <Toggle
                                active={values.predictionsPaused}
                                onClick={() => {
                                    const nextVal = !values.predictionsPaused;
                                    if (nextVal) {
                                        set({
                                            predictionsPaused: true,
                                            adaptivePrediction: false,
                                            showFertileWindow: false,
                                            showPMS: false
                                        });
                                    } else {
                                        set({ predictionsPaused: false });
                                    }
                                }}
                            />
                        </SettingRow>
                    </SettingCard>
                    </div>
                </div>
                {hasMoreBelow && (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#F0F2F5] to-transparent flex items-end justify-center pb-1">
                        <svg className="w-4 h-4 text-[#7598a0] animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CycleSetupStep;
