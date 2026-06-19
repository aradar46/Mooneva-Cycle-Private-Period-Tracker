import { Share } from '@capacitor/share';
import { version } from '../package.json';
import Logger from '../services/logger';
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { AppSettings, FirstDayOfWeek, PeriodRecord } from '../types';
import { useTranslation } from 'react-i18next';
import { SettingCard, SettingRow, Toggle } from './settings/SettingsUI';
import DataManagementView from './settings/DataManagementView';
import NumberSettingRow from './settings/NumberSettingRow';
import { ClinicalReportView } from './settings/ClinicalReportView';
import { addDays, getTodayStr } from '../utils/dateUtils';
import { FIRST_DAY_OPTIONS, resolveFirstDayOfWeek } from '../utils/weekStart';

import { SubViewType, ViewType } from '../hooks/useAppNavigation';

interface SettingsProps {
  settings: AppSettings;
  onUpdate: (s: AppSettings) => void;
  onClose: () => void;
  subView: SubViewType;
  onSubViewChange: (v: SubViewType) => void;
  periods: PeriodRecord[];
  onUpdatePeriodWithdrawalBleed: (id: string, isWithdrawalBleed: boolean) => Promise<void>;
  onViewChange: (v: ViewType) => void;
}

const Icons = {
  Pause: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>,
  Zap: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  Brain: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A5 5 0 0 1 12 4a5 5 0 0 1 2.5-2 5.5 5.5 0 0 1 5.5 5.5c0 1.38-.5 2.63-1.32 3.58.11.16.21.32.32.42A4.5 4.5 0 1 1 12 18a4.5 4.5 0 1 1-7-3.5c.11-.1.21-.26.32-.42A5.48 5.48 0 0 1 4 7.5 5.5 5.5 0 0 1 9.5 2z" /><path d="M12 11V8" /><path d="M12 18v-3" /></svg>,
  Rotate: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>,
  Droplets: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16.3c2.2 0 4-1.8 4-4 0-3.3-4-6.3-4-6.3s-4 3-4 6.3c0 2.2 1.8 4 4 4z" /><path d="M17 19.3c1.7 0 3-1.3 3-3 0-2.5-3-4.8-3-4.8s-3 2.3-3 4.8c0 1.7 1.3 3 3 3z" /></svg>,
  Egg: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a8 8 0 0 0 8-8c0-4.42-3.58-12-8-12s-8 7.58-8 12a8 8 0 0 0 8 8z" /></svg>,
  Alert: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
  Sparkles: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>,
  Globe: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  Lock: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  Eye: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  Moon: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 7.5A9 9 0 1 1 12 3Z" /></svg>,
  Pill: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></svg>,
  Leaf: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8a7 7 0 0 1-10 10Z" /><path d="M19 2v10" /></svg>,
  Message: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  Bell: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  Calendar: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>,
  Database: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>,
  Share: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
};

const Settings: React.FC<SettingsProps> = ({ settings, onUpdate, onClose, subView, onSubViewChange, periods, onUpdatePeriodWithdrawalBleed, onViewChange }) => {
  const { t, i18n } = useTranslation();
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinMismatch, setPinMismatch] = useState(false);
  const [pinExpanded, setPinExpanded] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);
  const [viewReport, setViewReport] = useState(false);
  const [showBirthControlDialog, setShowBirthControlDialog] = useState(false);
  const [showAdaptiveOffWarning, setShowAdaptiveOffWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<'bc' | 'pause' | null>(null);
  const [periodForDialog, setPeriodForDialog] = useState<PeriodRecord | null>(null);
  const effectiveFirstDayOfWeek = resolveFirstDayOfWeek(i18n.language, settings.firstDayOfWeek);

  const activePeriod = useMemo(() => {
    const todayStr = getTodayStr();
    return periods.find(p => {
      const end = addDays(p.startDate, p.days - 1);
      return todayStr >= p.startDate && todayStr <= end;
    });
  }, [periods]);

  if (subView === 'predictions') {
    return (
      <div className="h-full flex flex-col bg-[#F0F2F5] animate-slide-left">
        <div
          className="flex items-center gap-4 p-6 bg-[#F0F2F5] sticky top-0 z-10"
        >
          <button
            onClick={() => onSubViewChange('main')}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-slate-500"
            style={{ boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.4), -4px -4px 8px rgba(255, 255, 255, 0.8)' }}
          >
            <span className="text-xl rtl:rotate-180">←</span>
          </button>
          <h2 className="text-lg font-extrabold text-slate-700 tracking-tight">{t('settings.cycle_mgmt_title')}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pb-24">
          <div className="max-w-lg mx-auto space-y-8">
            <SettingCard title={t('settings.cycle_config_section')}>
              <SettingRow label={t('settings.adaptive_prediction_label')} desc={settings.isOnBirthControl ? t('settings.on_bc_disabled') : t('settings.adaptive_prediction_desc_long')} icon={<Icons.Brain />}>
                <Toggle
                  active={!!settings.adaptivePrediction && !settings.isOnBirthControl}
                  onClick={() => {
                    if (!settings.isOnBirthControl) {
                      const nextVal = !settings.adaptivePrediction;
                      onUpdate({
                        ...settings,
                        adaptivePrediction: nextVal,
                        // If turning ON adaptive prediction, unpause predictions
                        ...(nextVal ? { predictionsPaused: false } : {})
                      });
                    }
                  }}
                  disabled={settings.isOnBirthControl}
                />
              </SettingRow>
              {!settings.adaptivePrediction && !settings.isOnBirthControl && (
                <div className="px-4 pb-3 -mt-2">
                  <p className="text-xs text-slate-400 italic">{t('settings.fixed_prediction_hint')}</p>
                </div>
              )}

              {(!settings.adaptivePrediction || settings.isOnBirthControl) && (
                <>
                  <NumberSettingRow
                    label={t('settings.cycle_length_label')}
                    description={t('settings.cycle_length_desc')}
                    icon={<Icons.Rotate />}
                    value={settings.cycleLength}
                    onChange={(val) => onUpdate({ ...settings, cycleLength: val })}
                    min={21}
                    max={45}
                    defaultValue={28}
                  />

                  <NumberSettingRow
                    label={t('settings.period_length_label')}
                    description={t('settings.period_length_desc')}
                    icon={<Icons.Droplets />}
                    value={settings.periodLength}
                    onChange={(val) => onUpdate({ ...settings, periodLength: val })}
                    min={2}
                    max={10}
                    defaultValue={5}
                  />

                  <NumberSettingRow
                    label={t('settings.luteal_phase_label')}
                    description={t('settings.luteal_phase_desc')}
                    icon={<Icons.Egg />}
                    value={settings.lutealPhaseLength}
                    onChange={(val) => onUpdate({ ...settings, lutealPhaseLength: val })}
                    min={10}
                    max={18}
                    defaultValue={14}
                  />
                </>
              )}
            </SettingCard>

            <SettingCard title={t('settings.fertility_pms_section')}>
              <SettingRow
                label={t('settings.show_fertile_window')}
                desc={settings.isOnBirthControl ? t('settings.on_bc_disabled') : t('settings.show_fertile_window_desc')}
                icon={<Icons.Sparkles />}
              >
                <Toggle
                  active={settings.showFertileWindow && !settings.isOnBirthControl}
                  onClick={() => !settings.isOnBirthControl && onUpdate({ ...settings, showFertileWindow: !settings.showFertileWindow })}
                  disabled={settings.isOnBirthControl}
                />
              </SettingRow>
              {settings.showFertileWindow && !settings.isOnBirthControl && (
                <div className="px-4 pb-4 -mt-1">
                  <div
                    className="rounded-xl p-4"
                    style={{ boxShadow: 'inset 2px 2px 4px rgba(163, 177, 198, 0.25), inset -2px -2px 4px rgba(255, 255, 255, 0.7)' }}
                  >
                    <p className="text-[12px] text-slate-600 leading-relaxed">
                      <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">{t('settings.fertility_disclaimer_title')}</span>{' '}
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
                </div>
              )}
            </SettingCard>

            <SettingCard title={t('settings.pms_window_section')}>
              <SettingRow label={t('settings.show_pms_window')} desc={t('settings.show_pms_window_desc')} icon={<Icons.Alert />}>
                <Toggle active={!!settings.showPMS} onClick={() => onUpdate({ ...settings, showPMS: !settings.showPMS })} />
              </SettingRow>

              {settings.showPMS && (
                <NumberSettingRow
                  label={t('settings.pms_window_label')}
                  description={t('settings.pms_window_desc')}
                  icon={<Icons.Alert />}
                  value={settings.pmsLength}
                  onChange={(val) => onUpdate({ ...settings, pmsLength: val })}
                  min={1}
                  max={7}
                  defaultValue={3}
                />
              )}
            </SettingCard>

            <SettingCard title={t('settings.birth_control')}>
              <SettingRow
                label={t('settings.birth_control')}
                desc={t('settings.birth_control_sub_desc')}
                icon={<Icons.Pill />}
              >
                <Toggle
                  active={settings.isOnBirthControl}
                  onClick={() => {
                    if (!settings.isOnBirthControl) {
                      // Turning ON
                      if (settings.adaptivePrediction) {
                        setPendingAction('bc');
                        setShowAdaptiveOffWarning(true);
                      } else {
                        onUpdate({
                          ...settings,
                          isOnBirthControl: true,
                          showFertileWindow: false,
                          adaptivePrediction: false,
                          cycleLength: 28
                        });
                      }
                    } else {
                      // Turning OFF: check if there's an active period
                      if (activePeriod) {
                        setPeriodForDialog(activePeriod);
                        setShowBirthControlDialog(true);
                      } else {
                        onUpdate({ ...settings, isOnBirthControl: false });
                      }
                    }
                  }}
                />
              </SettingRow>
              <div className="px-4 pb-3 -mt-2">
                {settings.isOnBirthControl ? (
                  <p className="text-xs text-amber-600 font-medium">{t('settings.bc_protected_msg')}</p>
                ) : (
                  <p className="text-xs text-slate-400 italic">{t('settings.birth_control_pill_hint')}</p>
                )}
              </div>
            </SettingCard>

            <SettingCard title={t('settings.pause_predictions')}>
              <SettingRow
                label={t('settings.pause_predictions')}
                desc={t('settings.pause_predictions_full_desc')}
                icon={<Icons.Pause />}
                last
              >
                <Toggle
                  active={settings.predictionsPaused}
                  onClick={() => {
                    const nextVal = !settings.predictionsPaused;
                    if (nextVal) {
                      if (settings.adaptivePrediction) {
                        setPendingAction('pause');
                        setShowAdaptiveOffWarning(true);
                      } else {
                        onUpdate({
                          ...settings,
                          predictionsPaused: true,
                          adaptivePrediction: false,
                          showFertileWindow: false,
                          showPMS: false
                        });
                      }
                    } else {
                      onUpdate({ ...settings, predictionsPaused: false });
                    }
                  }}
                />
              </SettingRow>
            </SettingCard>


          </div>
        </div>

        {/* Birth Control Toggle Dialog - inside predictions subview */}
        {showBirthControlDialog && periodForDialog && createPortal(
          <>
            <div className="fixed inset-0 bg-black/40 z-[301]" onClick={() => { setShowBirthControlDialog(false); setPeriodForDialog(null); }} />
            <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[302] bg-[#F0F2F5] rounded-2xl p-5 max-w-sm mx-auto" style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.5), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}>
              <h3 className="text-base font-bold text-slate-700 mb-1">{t('settings.birth_control_dialog_title', 'Current Period')}</h3>
              <p className="text-xs text-slate-500 mb-4">
                {t('settings.birth_control_dialog_message', 'You have an active period. How should it be tagged?')}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    onUpdatePeriodWithdrawalBleed(periodForDialog.id, true);
                    onUpdate({ ...settings, isOnBirthControl: false });
                    setShowBirthControlDialog(false);
                    setPeriodForDialog(null);
                  }}
                  className="py-3 rounded-xl font-semibold text-[11px] uppercase tracking-wide text-white bg-indigo-500"
                >
                  💊 {t('settings.birth_control_keep_withdrawal', 'Keep as Withdrawal Bleed')}
                </button>
                <button
                  onClick={() => {
                    onUpdatePeriodWithdrawalBleed(periodForDialog.id, false);
                    onUpdate({ ...settings, isOnBirthControl: false });
                    setShowBirthControlDialog(false);
                    setPeriodForDialog(null);
                  }}
                  className="py-3 rounded-xl font-semibold text-[11px] uppercase tracking-wide text-white bg-rose-400"
                >
                  ⭐ {t('settings.birth_control_tag_natural', 'Tag as Natural Period')}
                </button>
                <button
                  onClick={() => {
                    setShowBirthControlDialog(false);
                    setPeriodForDialog(null);
                  }}
                  className="py-2 rounded-xl font-medium text-[11px] text-slate-500"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          </>,
          document.body
        )}

        {/* Adaptive Prediction Off Warning */}
        {showAdaptiveOffWarning && createPortal(
          <>
            <div className="fixed inset-0 bg-black/40 z-[301]" onClick={() => { setShowAdaptiveOffWarning(false); setPendingAction(null); }} />
            <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[302] bg-[#F0F2F5] rounded-3xl p-6 max-w-sm mx-auto overflow-hidden" style={{ boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.5), -8px -8px 16px rgba(255, 255, 255, 0.8)' }}>
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-amber-500 mb-4" style={{ boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.8)' }}>
                <Icons.Brain />
              </div>
              <h3 className="text-lg font-extrabold text-slate-700 mb-2 leading-tight">{t('settings.adaptive_prediction_off_title')}</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                {t('settings.adaptive_prediction_off_desc')}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (pendingAction === 'bc') {
                      onUpdate({
                        ...settings,
                        isOnBirthControl: true,
                        showFertileWindow: false,
                        adaptivePrediction: false,
                        cycleLength: 28
                      });
                    } else if (pendingAction === 'pause') {
                      onUpdate({
                        ...settings,
                        predictionsPaused: true,
                        adaptivePrediction: false,
                        showFertileWindow: false,
                        showPMS: false
                      });
                    }
                    setShowAdaptiveOffWarning(false);
                    setPendingAction(null);
                  }}
                  className="w-full py-4 bg-[#7598a0] text-white rounded-2xl font-bold text-sm shadow-lg shadow-[#7598a0]/20 active:scale-[0.98] transition-all"
                >
                  {t('common.ok')}
                </button>
                <button
                  onClick={() => {
                    setShowAdaptiveOffWarning(false);
                    setPendingAction(null);
                  }}
                  className="w-full py-2 text-slate-400 font-bold text-xs uppercase tracking-widest active:opacity-60 transition-all"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
      </div>
    );
  }

  if (subView === 'data_management') {
    return <DataManagementView settings={settings} onUpdate={onUpdate} onBack={() => onSubViewChange('main')} />;
  }

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5] animate-slide-up relative">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {/* PREMIUM SPA BRANDING */}
        {/* PREMIUM BRANDING HEADER - COMPACT & NEUMORPHIC */}
        <div className="flex flex-col items-center pt-8 pb-4 px-8 text-center relative overflow-hidden">
          <div className="w-48 mb-2 relative filter drop-shadow-sm">
            <img
              src="/bitmap.png"
              alt={t('branding.logo_alt')}
              className="w-full h-auto opacity-90"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<h1 class="text-3xl font-black text-slate-700 tracking-tighter mb-1">Mooneva</h1>';
              }}
            />
          </div>
          <div className="space-y-0.5 relative z-10">
            <h2 className="text-xs font-bold text-slate-400 tracking-[0.2em] uppercase opacity-80">
              {t('branding.subtitle', 'Private Period Tracker')}
            </h2>
          </div>
        </div>

        <div className="px-4 space-y-6 max-w-lg mx-auto">
          {/* 0. About & Support (Consolidated & Neumorphic) */}
          <section>
            <div
              className="rounded-2xl p-4 bg-[#F0F2F5] space-y-4"
              style={{ boxShadow: 'inset 4px 4px 8px rgba(163, 177, 198, 0.3), inset -4px -4px 8px rgba(255, 255, 255, 0.7)' }}
            >
              <div className="text-center space-y-1.5 pt-1">
                <h3 className="text-base font-black tracking-tight">
                  <span style={{ color: '#005293' }}>{t('common.free', 'Free')}.</span>{' '}
                  <span style={{ color: '#ddca00' }}>{t('common.private', 'Private')}.</span>{' '}
                  <span style={{ color: '#005293' }}>{t('common.forever', 'Forever')}.</span>{' '}🇸🇪
                </h3>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed max-w-xs mx-auto">
                  {t('branding.passion_not_ads')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href="https://mooneva.se/pages/mooneva_cycle"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open('https://mooneva.se/pages/mooneva_cycle', '_system');
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-[#F0F2F5] text-slate-600 transition-all active:scale-[0.98] group"
                  style={{ boxShadow: '5px 5px 10px rgba(163, 177, 198, 0.3), -5px -5px 10px rgba(255, 255, 255, 0.8)' }}
                >
                  <div className="w-8 h-8 rounded-full bg-[#e8f4f8] flex items-center justify-center text-[#7598a0] shadow-inner group-hover:scale-110 transition-transform duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wide group-hover:text-[#7598a0] transition-colors">{t('common.about', 'About')}</span>
                </a>

                <button
                  onClick={async () => {
                    try {
                      await Share.share({
                        title: 'Mooneva',
                        text: t('share_message.text'),
                        url: 'https://mooneva.se/pages/mooneva_cycle',
                        dialogTitle: t('common.share')
                      });
                    } catch (error) {
                      Logger.error('Error sharing:', error);
                    }
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-[#F0F2F5] text-slate-600 transition-all active:scale-[0.98] group"
                  style={{ boxShadow: '5px 5px 10px rgba(163, 177, 198, 0.3), -5px -5px 10px rgba(255, 255, 255, 0.8)' }}
                >
                  <div className="w-8 h-8 rounded-full bg-[#e0f2fe] flex items-center justify-center text-sky-500 shadow-inner group-hover:scale-110 transition-transform duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wide group-hover:text-sky-500 transition-colors">{t('common.share')}</span>
                </button>
              </div>

              <div className="flex justify-center gap-6 pt-1 opacity-60 hover:opacity-100 transition-opacity">
                <a href="https://mooneva.se" target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-[#7598a0] transition-colors">
                  {t('common.website')}
                </a>
                <button onClick={() => setShowAbout(!showAbout)} className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-[#7598a0] transition-colors">
                  {t('branding.story_title')}
                </button>
              </div>

              {showAbout && (
                <div className="animate-fade-in pt-3 border-t border-slate-200/50">
                  <p className="text-[10px] text-slate-500 leading-relaxed text-justify relative">
                    <span className="text-2xl absolute -top-2 -left-1 opacity-20">❝</span>
                    {t('branding.story_body')}
                  </p>
                </div>
              )}
            </div>
          </section>
          {/* 1. Prediction Settings (grouped) */}
          <section>
            <SettingCard title={t('settings.predictions')}>
              <SettingRow
                label={t('settings.cycle_mgmt_title')}
                desc={t('settings.cycle_mgmt_desc')}
                icon={<Icons.Search />}
                onClick={() => onSubViewChange('predictions')}
                last
              />
            </SettingCard>
          </section>

          {/* 1.5 Reminders */}
          <section>
            <SettingCard title={t('common.notifications')}>
              <SettingRow
                label={t('settings.reminders')}
                desc={t('settings.reminders_desc')}
                icon={<Icons.Bell />}
                onClick={() => onViewChange('notifications')}
                last
              />
            </SettingCard>
          </section>

          {/* 2. Language */}
          <section>
            <SettingCard title={t('settings.language')}>
              <SettingRow label={t('settings.language')} icon={<Icons.Globe />}>
                <select
                  value={i18n.language}
                  onChange={(e) => {
                    const lang = e.target.value;
                    i18n.changeLanguage(lang);
                    document.dir = lang === 'fa' ? 'rtl' : 'ltr';
                  }}
                  className="bg-slate-100 border-none text-text-secondary text-sm font-medium rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-accent/20 outline-none"
                >
                  {[
                    { code: 'en', label: 'English' },
                    { code: 'zh', label: '中文' },
                    { code: 'es', label: 'Español' },
                    { code: 'sv', label: 'Svenska' },
                    { code: 'fa', label: 'فارسی' },
                    { code: 'de', label: 'Deutsch' }
                  ].map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.label}</option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow
                label={t('settings.first_day_of_week')}
                desc={t('settings.first_day_of_week_desc')}
                icon={<Icons.Calendar />}
                last
              >
                <div className="flex flex-col items-end gap-1">
                  <select
                    aria-label={t('settings.first_day_of_week')}
                    value={effectiveFirstDayOfWeek}
                    onChange={(e) => onUpdate({
                      ...settings,
                      firstDayOfWeek: e.target.value as FirstDayOfWeek
                    })}
                    className="bg-slate-100 border-none text-text-secondary text-sm font-medium rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-accent/20 outline-none"
                  >
                    {FIRST_DAY_OPTIONS.map(day => (
                      <option key={day} value={day}>{t(`settings.week_start_${day}`)}</option>
                    ))}
                  </select>
                  {settings.firstDayOfWeek && (
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...settings, firstDayOfWeek: undefined })}
                      className="text-[9px] font-bold uppercase tracking-wider text-[#7598a0] hover:text-[#5d7f87] transition-colors"
                    >
                      {t('settings.use_language_default')}
                    </button>
                  )}
                </div>
              </SettingRow>
            </SettingCard>
          </section>

          {/* Clinical Export Button (standalone) */}
          <button
            onClick={() => setShowPrivacyWarning(true)}
            className="w-full flex items-center justify-between p-5 bg-[#F0F2F5] rounded-2xl group active:scale-[0.98] transition-all"
            style={{
              boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)'
            }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>
              </div>
              <div className="text-start">
                <span className="block text-[14px] font-semibold text-slate-700 truncate">{t('settings.export_doctor_title')}</span>
                <span className="block text-xs font-medium text-slate-400 mt-0.5">{t('settings.export_doctor_desc')}</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200/50 flex items-center justify-center text-slate-400 group-hover:text-[#7598a0] group-hover:bg-white transition-all rtl:rotate-180">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
            </div>
          </button>

          {/* 3. Appearance */}
          <section>
            <SettingCard title="Privacy & Security">
              <SettingRow
                label={t('settings.dark_neumorphism')}
                desc={t('settings.dark_neumorphism_desc')}
                icon={<Icons.Moon />}
                last
              >
                <Toggle active={!!settings.darkNeumorphism} onClick={() => onUpdate({ ...settings, darkNeumorphism: !settings.darkNeumorphism })} />
              </SettingRow>
            </SettingCard>
          </section>

          {/* 3.5 Privacy — Discrete Mode */}
          <section>
            <SettingCard title="Privacy & Security">
              <SettingRow
                label={t('settings.discrete_mode')}
                desc={t('settings.discrete_mode_full_desc')}
                icon={<Icons.Eye />}
                last
              >
                <Toggle active={settings.discreteMode} onClick={() => onUpdate({ ...settings, discreteMode: !settings.discreteMode })} />
              </SettingRow>
            </SettingCard>
          </section>

          {/* 4. PIN Lock */}
          <section>
            <SettingCard title={t('settings.pin_lock')}>
              <SettingRow
                label={t('settings.pin_lock')}
                desc={settings.pin ? t('settings.pin_active') : t('common.disabled')}
                icon={<Icons.Lock />}
                onClick={() => !settings.pin && setPinExpanded(!pinExpanded)}
                last={!pinExpanded || !!settings.pin}
                rightElement={
                  settings.pin ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdate({ ...settings, pin: undefined }); }}
                      className="text-xs font-semibold text-rose-500 hover:text-rose-600 px-3 py-1.5 bg-rose-50 rounded-lg"
                    >
                      {t('settings.remove_pin')}
                    </button>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`text-slate-400 transition-transform duration-200 ${pinExpanded ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  )
                }
              />

              {/* Lock timeout selector — only when PIN is active */}
              {settings.pin && (
                <SettingRow
                  label={t('settings.lock_after')}
                  desc={t('settings.lock_after_desc')}
                  icon={<Icons.Pause />}
                  last
                  rightElement={
                    <div className="flex gap-1.5">
                      {([30, 120, 0] as const).map((val) => {
                        const labels: Record<number, string> = { 30: t('settings.lock_30s'), 120: t('settings.lock_2min'), 0: t('settings.lock_immediate') };
                        const active = (settings.lockTimeout ?? 120) === val;
                        return (
                          <button
                            key={val}
                            onClick={(e) => { e.stopPropagation(); onUpdate({ ...settings, lockTimeout: val }); }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${active ? 'bg-[#7598a0] text-white' : 'bg-slate-100 text-slate-500'}`}
                          >
                            {labels[val]}
                          </button>
                        );
                      })}
                    </div>
                  }
                />
              )}

              {/* Expandable PIN setup form */}
              {!settings.pin && pinExpanded && (
                <div className="px-5 pb-5 space-y-3">
                  <input
                    type="password"
                    placeholder={t('settings.enter_password')}
                    value={pinInput}
                    onChange={(e) => { setPinInput(e.target.value); setPinMismatch(false); }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:border-[#7598a0] focus:ring-1 focus:ring-[#7598a0] outline-none transition-all placeholder:text-slate-400"
                    autoComplete="new-password"
                  />
                  <input
                    type="password"
                    placeholder={t('settings.repeat_password')}
                    value={pinConfirm}
                    onChange={(e) => { setPinConfirm(e.target.value); setPinMismatch(false); }}
                    className={`w-full bg-white border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-[#7598a0] outline-none transition-all placeholder:text-slate-400 ${pinMismatch ? 'border-rose-400 focus:border-rose-400' : 'border-slate-300 focus:border-[#7598a0]'}`}
                    autoComplete="new-password"
                  />
                  {pinMismatch && (
                    <p className="text-xs text-rose-600 text-center">{t('settings.pins_dont_match')}</p>
                  )}
                  <button
                    onClick={() => {
                      if (pinInput.length < 4) {
                        alert(t('settings.pin_error'));
                        return;
                      }
                      if (pinInput !== pinConfirm) {
                        setPinMismatch(true);
                        return;
                      }
                      onUpdate({ ...settings, pin: pinInput });
                      setPinInput('');
                      setPinConfirm('');
                      setPinMismatch(false);
                      setPinExpanded(false);
                    }}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all transform active:scale-[0.98] ${pinInput.length >= 4 && pinInput === pinConfirm
                      ? 'bg-[#7598a0] text-white shadow-md shadow-[#7598a0]/20'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                  >
                    {t('common.enable_protection')}
                  </button>
                  <p className="text-[10px] text-center text-slate-400 px-4">
                    {t('settings.security_desc_long')}
                  </p>
                </div>
              )}
            </SettingCard>
          </section>

          {/* 5. Data Management */}
          <section>
            <SettingCard title={t('settings.data_management')}>
              <SettingRow
                label={t('settings.data_management')}
                desc={t('settings.data_mgmt_desc')}
                icon={<Icons.Database />}
                onClick={() => onSubViewChange('data_management')}
                last
              />
            </SettingCard>
          </section>

          {/* 6. Feedback */}
          <section>
            <div className="bg-gradient-to-br from-[#7598a0] to-[#5b7a82] rounded-2xl p-6 text-white shadow-lg shadow-[#7598a0]/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl backdrop-blur-sm">
                    <Icons.Message />
                  </div>
                  <h3 className="text-lg font-bold">{t('settings.feedback_title')}</h3>
                </div>

                <p className="text-blue-50 text-sm leading-relaxed mb-6 font-medium">
                  {t('settings.feedback_desc')}
                </p>

                <a
                  href="mailto:app@mooneva.se?subject=Mooneva App Feedback"
                  className="block w-full text-center bg-white text-[#5b7a82] py-3 rounded-xl font-bold text-sm shadow-sm active:scale-[0.98] transition-all hover:bg-slate-50"
                >
                  {t('settings.feedback_button')}
                </a>
              </div>
            </div>
          </section>

          {/* 7. Footer */}
          <div className="text-center pt-8 pb-12 space-y-4">
            <p className="text-[10px] text-slate-400 font-medium">v{version}</p>
          </div>
        </div>
      </div>

      {/* PRIVACY WARNING MODAL */}
      {showPrivacyWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl scale-100 animate-scale-in">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">{t('settings.medical_privacy_warning')}</h3>
            <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
              {t('settings.medical_privacy_desc')}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { setShowPrivacyWarning(false); setViewReport(true); }}
                className="w-full py-3 bg-[#7598a0] text-white rounded-xl font-bold text-sm shadow-lg shadow-[#7598a0]/20 hover:bg-[#66868d] transition-all"
              >
                {t('settings.generate_private_report')}
              </button>
              <button
                onClick={() => setShowPrivacyWarning(false)}
                className="w-full py-3 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl transition-all"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENDER REPORT VIEW */}
      {viewReport && <ClinicalReportView onClose={() => setViewReport(false)} />}

    </div>
  );
};

export default Settings;
