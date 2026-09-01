import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../ScreenWrapper';
import { useMooneva } from '../../contexts/MoonevaContext';
import { SettingRow, Toggle } from '../settings/SettingsUI';
import type { ViewType } from '../../hooks/useAppNavigation';
import {
  canScheduleExactAlarms,
  isContraceptionReminderSchedulable,
  openExactAlarmSettings,
  openNotificationSettings,
  REMINDER_DEFAULT_TIMES,
  requestNotificationPermission,
} from '../../services/notifications';
import { Capacitor } from '@capacitor/core';
import type { AppSettings, ContraceptionReminder } from '../../types';

const isValidReminderTime = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
const isValidReminderDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3]);
};
const isFutureReminderDateTime = (dateValue: string, timeValue: string) => {
  if (!isValidReminderDate(dateValue) || !isValidReminderTime(timeValue)) return false;
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime() > Date.now();
};

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
  const settingsRef = React.useRef(settings);
  React.useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const discrete = !!settings.discreteMode;
  const DEFAULT_REMINDER_TIME = '09:00';
  const contraceptionReminder = settings.contraceptionReminder ?? {
    enabled: false,
    method: 'pill',
    time: DEFAULT_REMINDER_TIME,
  } satisfies ContraceptionReminder;
  const canScheduleContraceptionReminder = isContraceptionReminderSchedulable(contraceptionReminder);
  const validReminderTime = isValidReminderTime(contraceptionReminder.time);
  const isDatedMethod = contraceptionReminder.method !== 'pill';
  let dateValue = '';
  if (contraceptionReminder.method === 'patch' || contraceptionReminder.method === 'ring') {
    dateValue = contraceptionReminder.anchorDate;
  } else if (contraceptionReminder.method === 'injection' || contraceptionReminder.method === 'iud' || contraceptionReminder.method === 'implant') {
    dateValue = contraceptionReminder.nextDate;
  }
  const invalidReminderTime = !validReminderTime;
  const validReminderDate = !isDatedMethod || isValidReminderDate(dateValue);
  const invalidReminderDate = isDatedMethod && !validReminderDate;
  const isDueDateMethod = contraceptionReminder.method === 'injection' || contraceptionReminder.method === 'iud' || contraceptionReminder.method === 'implant';
  const invalidReminderPastDate = isDueDateMethod && validReminderDate && validReminderTime && !isFutureReminderDateTime(dateValue, contraceptionReminder.time);
  const warningDaysInvalid = isDueDateMethod && contraceptionReminder.warningDays !== undefined && (
    !Number.isInteger(contraceptionReminder.warningDays) || contraceptionReminder.warningDays < 0 || contraceptionReminder.warningDays > 365
  );
  const validationKey = invalidReminderTime
    ? 'notifications.contraception_time_required'
    : invalidReminderDate
      ? 'notifications.contraception_date_invalid'
      : invalidReminderPastDate
        ? 'notifications.contraception_date_past'
        : warningDaysInvalid
          ? 'notifications.contraception_warning_invalid'
          : 'notifications.contraception_invalid_schedule';
  const scheduleDescriptionKey = contraceptionReminder.method === 'patch'
    ? 'notifications.contraception_schedule_patch'
    : contraceptionReminder.method === 'ring'
      ? 'notifications.contraception_schedule_ring'
      : 'notifications.contraception_schedule_due';
  const anchorDateLabelKey = contraceptionReminder.method === 'patch'
    ? 'notifications.contraception_anchor_date_patch'
    : 'notifications.contraception_anchor_date_ring';
  const scheduleDescriptionFallback = contraceptionReminder.method === 'patch'
    ? '4 weeks: change weekly ×3, then remove.'
    : contraceptionReminder.method === 'ring'
      ? '4 weeks: in for 3 weeks, out for 1.'
      : 'Due date reminder; early warning optional.';

  const promptExactAlarmIfNeeded = async () => {
    if (await canScheduleExactAlarms()) return;
    const msg = t(
      'notifications.exact_alarm_message',
      'Reminders may arrive late or not at all. Allow alarms & reminders in device settings for on-time delivery.',
    );
    if (confirm(msg)) await openExactAlarmSettings();
  };

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
      await promptExactAlarmIfNeeded();
    }
    updateSettings({ ...settings, [key]: nextState });
  };

  const updateContraceptionReminder = (profile: ContraceptionReminder) => {
    updateSettings({ ...settings, contraceptionReminder: profile });
  };

  const handleContraceptionToggle = async () => {
    if (contraceptionReminder.enabled) {
      updateContraceptionReminder({ ...contraceptionReminder, enabled: false });
      return;
    }
    if (!canScheduleContraceptionReminder) return;

    const granted = await requestNotificationPermission();
    if (!granted && Capacitor.isNativePlatform()) {
      const msg = t('notifications.permission_denied_message', 'Notifications are disabled. Please enable them in your device settings to receive reminders.');
      if (confirm(msg)) openNotificationSettings();
      return;
    }
    await promptExactAlarmIfNeeded();
    const latestSettings = settingsRef.current;
    const latestReminder = latestSettings.contraceptionReminder ?? {
      enabled: false,
      method: 'pill',
      time: DEFAULT_REMINDER_TIME,
    } satisfies ContraceptionReminder;
    if (JSON.stringify(latestReminder) !== JSON.stringify(contraceptionReminder)) return;
    if (!isContraceptionReminderSchedulable(latestReminder, new Date())) return;
    updateSettings({
      ...latestSettings,
      contraceptionReminder: { ...latestReminder, enabled: true },
    });
  };

  const handleContraceptionMethod = (method: string) => {
    switch (method) {
      case 'pill':
        updateContraceptionReminder({
          enabled: contraceptionReminder.enabled,
          method,
          time: contraceptionReminder.time,
        });
        return;
      case 'patch':
      case 'ring':
        updateContraceptionReminder({ enabled: false, method, time: contraceptionReminder.time, anchorDate: '' });
        return;
      case 'injection':
      case 'iud':
      case 'implant':
        updateContraceptionReminder({ enabled: false, method, time: contraceptionReminder.time, nextDate: '' });
        return;
    }
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
                  const timeValue = (settings[item.timeKey as keyof typeof settings] as string)
                    || REMINDER_DEFAULT_TIMES[item.timeKey as keyof typeof REMINDER_DEFAULT_TIMES]
                    || DEFAULT_REMINDER_TIME;
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

            {/* 2.5. Contraception reminder */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                {t('notifications.section_contraception')}
              </h2>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="space-y-3 px-4 py-4 bg-slate-50/80 border-t border-slate-50">
                  <label className="flex items-center justify-between gap-3" htmlFor="contraception-method">
                    <span className="text-[13px] text-slate-600 font-medium">{t('notifications.contraception_method')}</span>
                    <select
                      id="contraception-method"
                      value={contraceptionReminder.method}
                      onChange={(event) => handleContraceptionMethod(event.target.value)}
                      className="text-[13px] font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#7598a0]/30 outline-none"
                    >
                      {(['pill', 'patch', 'ring', 'injection', 'iud', 'implant'] as const).map((method) => (
                        <option key={method} value={method}>{t(`notifications.contraception_method_${method}`)}</option>
                      ))}
                    </select>
                  </label>

                  {(contraceptionReminder.method === 'patch' || contraceptionReminder.method === 'ring') && (
                    <>
                      <label className="flex items-center justify-between gap-3" htmlFor="contraception-anchor-date">
                        <span className="text-[13px] text-slate-600 font-medium">{t(anchorDateLabelKey, contraceptionReminder.method === 'patch' ? 'First patch day' : 'First ring day')}</span>
                        <input
                          id="contraception-anchor-date"
                          type="date"
                          required
                          aria-invalid={invalidReminderDate}
                          aria-describedby={!canScheduleContraceptionReminder ? 'contraception-standard-schedule contraception-date-validation' : 'contraception-standard-schedule'}
                          value={contraceptionReminder.anchorDate}
                          onChange={(event) => updateContraceptionReminder({ ...contraceptionReminder, anchorDate: event.target.value })}
                          className="text-[13px] font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#7598a0]/30 outline-none"
                        />
                      </label>
                      <p id="contraception-standard-schedule" className="text-[12px] text-slate-400">
                        {t(scheduleDescriptionKey, scheduleDescriptionFallback)}
                      </p>
                    </>
                  )}

                  {(contraceptionReminder.method === 'injection' || contraceptionReminder.method === 'iud' || contraceptionReminder.method === 'implant') && (
                    <>
                      <label className="flex items-center justify-between gap-3" htmlFor="contraception-next-date">
                        <span className="text-[13px] text-slate-600 font-medium">{t('notifications.contraception_next_date')}</span>
                        <input
                          id="contraception-next-date"
                          type="date"
                          required
                          aria-invalid={invalidReminderDate || invalidReminderPastDate}
                          aria-describedby={!canScheduleContraceptionReminder ? 'contraception-date-validation' : undefined}
                          value={contraceptionReminder.nextDate}
                          onChange={(event) => updateContraceptionReminder({ ...contraceptionReminder, nextDate: event.target.value })}
                          className="text-[13px] font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#7598a0]/30 outline-none"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3" htmlFor="contraception-warning-days">
                        <span className="text-[13px] text-slate-600 font-medium">{t('notifications.contraception_warning_days')}</span>
                        <input
                          id="contraception-warning-days"
                          type="number"
                          min="0"
                          max="365"
                          step="1"
                          aria-invalid={warningDaysInvalid}
                          aria-describedby={warningDaysInvalid ? 'contraception-date-validation' : undefined}
                          value={contraceptionReminder.warningDays ?? ''}
                          onChange={(event) => {
                            if (event.target.value === '') {
                              const { warningDays: _warningDays, ...profile } = contraceptionReminder;
                              updateContraceptionReminder(profile);
                              return;
                            }
                            const warningDays = Number(event.target.value);
                            if (Number.isInteger(warningDays) && warningDays >= 0 && warningDays <= 365) {
                              updateContraceptionReminder({ ...contraceptionReminder, warningDays });
                            }
                          }}
                          className="w-24 text-[13px] font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#7598a0]/30 outline-none"
                        />
                      </label>
                    </>
                  )}

                  <label className="flex items-center justify-between gap-3" htmlFor="contraception-time">
                    <span className="text-[13px] text-slate-600 font-medium">{t('notifications.contraception_time')}</span>
                    <input
                      id="contraception-time"
                      type="time"
                      required
                      aria-invalid={invalidReminderTime}
                      aria-describedby={!canScheduleContraceptionReminder ? 'contraception-date-validation' : undefined}
                      value={contraceptionReminder.time}
                      onChange={(event) => updateContraceptionReminder({ ...contraceptionReminder, time: event.target.value })}
                      className="text-[13px] font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#7598a0]/30 outline-none"
                    />
                  </label>

                  {!canScheduleContraceptionReminder && (
                    <p id="contraception-date-validation" role="alert" className="text-[12px] font-medium text-rose-600">
                      {t(validationKey)}
                    </p>
                  )}
                </div>
                <SettingRow
                  label={t('notifications.contraception_reminder')}
                  desc={t(discrete ? 'notifications.contraception_reminder_desc_discrete' : 'notifications.contraception_reminder_desc')}
                  last
                >
                  <label>
                    <span className="sr-only">{t('notifications.contraception_reminder')}</span>
                    <Toggle
                      active={contraceptionReminder.enabled}
                      onClick={handleContraceptionToggle}
                    />
                  </label>
                </SettingRow>
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
