import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../ScreenWrapper';
import { useMooneva } from '../../contexts/MoonevaContext';
import { SettingRow, Toggle } from '../settings/SettingsUI';
import { ViewType } from '../../hooks/useAppNavigation';
import { requestNotificationPermission, openNotificationSettings } from '../../services/notifications';
import { Capacitor } from '@capacitor/core';
import { AppSettings } from '../../types';

interface NotificationManagerScreenProps {
  setView: (view: ViewType) => void;
  returnTo?: ViewType;
  isCloaked: boolean;
}

export const NotificationManagerScreen: React.FC<NotificationManagerScreenProps> = ({
  setView,
  returnTo = 'calendar',
  isCloaked
}) => {
  const { t } = useTranslation();
  const { settings, actions } = useMooneva();
  const { updateSettings } = actions;
  const discrete = !!settings.discreteMode;

  useEffect(() => {
    requestNotificationPermission().catch(() => { });
  }, []);

  const DEFAULT_REMINDER_TIME = '09:00';

  const handleToggle = async (key: keyof AppSettings, currentValue: boolean) => {
    const nextState = !currentValue;
    if (nextState) {
      const granted = await requestNotificationPermission();
      if (!granted && Capacitor.isNativePlatform()) {
        const msg = t('notifications.permission_denied_message', 'Notifications are disabled. Please enable them in your device settings to receive reminders.');
        if (confirm(msg)) {
          openNotificationSettings();
        }
        return;
      }
    }
    updateSettings({ ...settings, [key]: nextState });
  };

  return (
    <ScreenWrapper>
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F0F2F5]">
        {/* Header: back + title */}
        <div className="flex items-center gap-4 px-4 py-4 border-b border-slate-100 shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => setView(returnTo)}
            className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center transition-colors text-slate-600"
            aria-label={t('common.back', 'Back')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex-1">
            {t('notifications.title', 'Notification Manager')}
          </h1>
        </div>

        <main className="flex-1 overflow-y-auto p-6 pb-24">
          <div className="max-w-lg mx-auto space-y-8">
            <p className="text-[12px] font-bold text-blue-600 leading-snug px-1">
              {t('notifications.discrete_mode_note')}
            </p>


            {/* 2. Action Reminders */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                {t('notifications.section_action_needed')}
              </h2>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                {[
                  { key: 'reminderDailyLog', timeKey: 'reminderDailyLogTime', labelKey: 'notifications.daily_log', descKey: 'notifications.daily_log_desc' },
                  { key: 'reminderPeriodInput', timeKey: 'reminderPeriodInputTime', labelKey: 'notifications.period_input_reminder', descKey: 'notifications.period_input_reminder_desc' },
                  { key: 'reminderPeriodEnd', timeKey: 'reminderPeriodEndTime', labelKey: 'notifications.period_ends', descKey: 'notifications.period_ends_desc' },
                  { key: 'reminderPeriodLate', timeKey: 'reminderPeriodLateTime', labelKey: 'notifications.late_period', descKey: 'notifications.late_period_desc' },
                ].map((item, index, arr) => {
                  const isOn = !!(settings[item.key as keyof typeof settings]);
                  const timeValue = (settings[item.timeKey as keyof typeof settings] as string) || DEFAULT_REMINDER_TIME;
                  const descKey = item.descKey ? (discrete ? item.descKey.replace('_desc', '_desc_discrete') : item.descKey) : undefined;
                  return (
                    <React.Fragment key={item.key}>
                      <SettingRow
                        label={t(item.labelKey)}
                        desc={descKey ? t(descKey) : undefined}
                        last={index === arr.length - 1 && !isOn}
                      >
                        <Toggle
                          active={isOn}
                          onClick={() => handleToggle(item.key as keyof AppSettings, isOn)}
                        />
                      </SettingRow>
                      {isOn && (
                        <div className={`flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 ${index !== arr.length - 1 ? 'border-b border-slate-50' : ''}`}>
                          <span className="text-[13px] text-slate-600 font-medium">{t('notifications.remind_at')}</span>
                          <input
                            type="time"
                            value={timeValue}
                            onChange={(e) => updateSettings({ ...settings, [item.timeKey]: e.target.value })}
                            className="text-[13px] font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#7598a0]/30 outline-none"
                          />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </section>

            {/* 2.5. Medication/Pill Reminder (General) */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                {t('notifications.section_birth_control', 'Medication')}
              </h2>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                {(() => {
                  const isOn = !!settings.reminderPillDaily;
                  const timeValue = settings.reminderPillDailyTime || DEFAULT_REMINDER_TIME;
                  return (
                    <>
                      <SettingRow
                        label={t('notifications.pill_reminder')}
                        desc={t(discrete ? 'notifications.pill_reminder_desc_discrete' : 'notifications.pill_reminder_desc')}
                      >
                        <Toggle
                          active={isOn}
                          onClick={() => handleToggle('reminderPillDaily', isOn)}
                        />
                      </SettingRow>
                      {isOn && (
                        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 border-t border-slate-50">
                          <span className="text-[13px] text-slate-600 font-medium">{t('notifications.remind_at')}</span>
                          <input
                            type="time"
                            value={timeValue}
                            onChange={(e) => updateSettings({ ...settings, reminderPillDailyTime: e.target.value })}
                            className="text-[13px] font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#7598a0]/30 outline-none"
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </section>

            {/* 3. Health Updates */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                {t('notifications.section_cycle_updates')}
              </h2>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                {[
                  { key: 'reminderPeriodStart', timeKey: 'reminderPeriodStartTime', labelKey: 'notifications.period_starts', descKey: 'notifications.period_starts_desc' },
                  { key: 'reminderPMS', timeKey: 'reminderPMSTime', labelKey: 'notifications.pms_reminder', descKey: 'notifications.pms_reminder_desc' },
                  { key: 'reminderFertility', timeKey: 'reminderFertilityTime', labelKey: 'notifications.fertility_reminder', descKey: 'notifications.fertility_reminder_desc' },
                  { key: 'reminderOvulation', timeKey: 'reminderOvulationTime', labelKey: 'notifications.ovulation_reminder', descKey: 'notifications.ovulation_reminder_desc' },
                ].map((item, index, arr) => {
                  const isOn = !!(settings[item.key as keyof typeof settings]);
                  const timeValue = (settings[item.timeKey as keyof typeof settings] as string) || DEFAULT_REMINDER_TIME;
                  const descKey = item.descKey ? (discrete ? item.descKey.replace('_desc', '_desc_discrete') : item.descKey) : undefined;
                  let desc = descKey ? t(descKey) : undefined;
                  return (
                    <React.Fragment key={item.key}>
                      <SettingRow
                        label={t(item.labelKey)}
                        desc={desc}
                        last={index === arr.length - 1 && !isOn}
                      >
                        <Toggle
                          active={isOn}
                          onClick={() => handleToggle(item.key as keyof AppSettings, isOn)}
                        />
                      </SettingRow>
                      {isOn && (
                        <div className={`flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 ${index !== arr.length - 1 ? 'border-b border-slate-50' : ''}`}>
                          <span className="text-[13px] text-slate-600 font-medium">{t('notifications.remind_at')}</span>
                          <input
                            type="time"
                            value={timeValue}
                            onChange={(e) => updateSettings({ ...settings, [item.timeKey]: e.target.value })}
                            className="text-[13px] font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#7598a0]/30 outline-none"
                          />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>
    </ScreenWrapper>
  );
};
