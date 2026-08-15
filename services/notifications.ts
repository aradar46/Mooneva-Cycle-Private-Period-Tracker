/**
 * Local notification scheduling for reminders.
 * Runs only on native (Android/iOS) via Capacitor.
 */

import { Capacitor } from '@capacitor/core';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import type { AppSettings, ContraceptionReminder, PredictionResults } from '../types';
import Logger from './logger';
import { addDays } from '../utils/dateUtils';

import i18n from './i18n';

const REMINDER_IDS = {
  reminderPeriodStart: 1,
  reminderPeriodEnd: 2,
  reminderPeriodInput: 3,
  reminderFertility: 4,
  reminderOvulation: 5,
  reminderDailyLog: 6,
  reminderPMS: 7,
  reminderPill: 9,
  reminderLate: 80 // Base for late (80-89)
} as const;

const CONTRACEPTION_REMINDER_IDS = {
  pill: 100,
  patchStart: 101,
  ringStart: 125,
  due: 137,
  warning: 138,
  start: 100,
  end: 139,
} as const;

const getNotifContent = (type: keyof typeof REMINDER_IDS, isDiscrete: boolean) => {
  const baseKey = type === 'reminderPeriodStart' ? 'period_starts' :
    type === 'reminderPeriodEnd' ? 'period_ends' :
      type === 'reminderPeriodInput' ? 'period_input_reminder' :
        type === 'reminderFertility' ? 'fertility_reminder' :
          type === 'reminderOvulation' ? 'ovulation_reminder' :
            type === 'reminderDailyLog' ? 'daily_log' :
              type === 'reminderPMS' ? 'pms_reminder' :
                type === 'reminderPill' ? 'pill_reminder' :
                  type === 'reminderLate' ? 'late_period' : '';

  const titleKey = isDiscrete ? `notifications.${baseKey}_discrete` : `notifications.${baseKey}`;
  const bodyKey = isDiscrete ? `notifications.${baseKey}_desc_discrete` : `notifications.${baseKey}_desc`;

  return {
    title: i18n.t(titleKey),
    body: i18n.t(bodyKey)
  };
};

const CHANNEL_ID = 'mooneva_reminders';
const DEFAULT_TIME = '09:00';

export const REMINDER_DEFAULT_TIMES = {
  reminderPeriodStartTime: '08:00',
  reminderFertilityTime: '08:15',
  reminderOvulationTime: '08:30',
  reminderPillDailyTime: '09:00',
  reminderPeriodLateTime: '10:00',
  reminderPMSTime: '19:00',
  reminderPeriodInputTime: '20:00',
  reminderPeriodEndTime: '20:15',
  reminderDailyLogTime: '20:30',
} as const;

/** Parse YYYY-MM-DD as local date (not UTC) to avoid timezone off-by-one */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function parseTimeHHmm(value: string | undefined, fallback = DEFAULT_TIME): { hour: number; minute: number } {
  const str = value || fallback;
  const [h, m] = str.split(':').map(Number);
  return { hour: isNaN(h) ? 9 : h, minute: isNaN(m) ? 0 : m };
}

function parseStrictLocalDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : undefined;
}

function parseStrictTime(value: string): { hour: number; minute: number } | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return undefined;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function isContraceptionReminderSchedulable(
  profile: ContraceptionReminder,
  now = new Date(),
): boolean {
  const time = parseStrictTime(profile.time);
  if (!time) return false;

  switch (profile.method) {
    case 'pill':
      return true;
    case 'patch':
    case 'ring':
      return parseStrictLocalDate(profile.anchorDate) !== undefined;
    case 'injection':
    case 'iud':
    case 'implant': {
      const dueDate = parseStrictLocalDate(profile.nextDate);
      const warningDays = profile.warningDays;
      if (
        !dueDate ||
        (warningDays !== undefined && (
          !Number.isInteger(warningDays) || warningDays < 0 || warningDays > 365
        ))
      ) {
        return false;
      }
      dueDate.setHours(time.hour, time.minute, 0, 0);
      return dueDate.getTime() > now.getTime();
    }
    default:
      assertNever(profile);
      return false;
  }
}

function localCalendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

function contraceptionContent(discrete: boolean) {
  return {
    title: i18n.t('notifications.contraception_reminder', { defaultValue: 'Reminder' }),
    body: i18n.t(
      discrete ? 'notifications.contraception_reminder_desc_discrete' : 'notifications.contraception_reminder_desc',
      { defaultValue: 'You have a scheduled reminder.' },
    ),
  };
}

function addContraceptionOneShot(
  notifications: LocalNotificationSchema[],
  id: number,
  target: Date,
  now: Date,
  method: ContraceptionReminder['method'],
  action: string,
  discrete: boolean,
) {
  if (target.getTime() <= now.getTime()) return;
  notifications.push({
    id,
    ...contraceptionContent(discrete),
    channelId: CHANNEL_ID,
    extra: { method, action },
    schedule: { at: target, repeats: false, allowWhileIdle: true },
  });
}

function addContraceptionCycle(
  notifications: LocalNotificationSchema[],
  method: 'patch' | 'ring',
  anchorDate: string,
  time: { hour: number; minute: number },
  now: Date,
  discrete: boolean,
) {
  const anchor = parseStrictLocalDate(anchorDate);
  if (!anchor) return;

  const phases = method === 'patch'
    ? [[0, 'apply'], [7, 'change'], [14, 'change'], [21, 'remove']] as const
    : [[0, 'insert'], [21, 'remove']] as const;
  const startId = method === 'patch' ? CONTRACEPTION_REMINDER_IDS.patchStart : CONTRACEPTION_REMINDER_IDS.ringStart;
  const elapsedCycles = Math.max(0, Math.floor((localCalendarDay(now) - localCalendarDay(anchor)) / 28));

  for (let cycle = 0; cycle < 6; cycle += 1) {
    for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
      const phase = phases[phaseIndex];
      if (!phase) continue;
      const target = new Date(anchor);
      target.setDate(target.getDate() + ((elapsedCycles + cycle) * 28) + phase[0]);
      target.setHours(time.hour, time.minute, 0, 0);
      addContraceptionOneShot(
        notifications,
        startId + (cycle * phases.length) + phaseIndex,
        target,
        now,
        method,
        phase[1],
        discrete,
      );
    }
  }
}

function assertNever(value: never): void {
  void value;
}

function staggerNotificationCollisions(notifications: LocalNotificationSchema[]): void {
  const scheduled = notifications.filter((notification) => notification.schedule?.at instanceof Date);
  const used = new Set<number>();
  for (const notification of [...scheduled].sort((a, b) => a.schedule!.at!.getTime() - b.schedule!.at!.getTime())) {
    const at = new Date(notification.schedule!.at!);
    while (used.has(at.getTime())) at.setMinutes(at.getMinutes() + 15);
    notification.schedule!.at = at;
    used.add(at.getTime());
  }
}

function addContraceptionReminders(
  profile: ContraceptionReminder,
  notifications: LocalNotificationSchema[],
  now: Date,
  discrete: boolean,
) {
  if (!profile.enabled || !isContraceptionReminderSchedulable(profile, now)) return;
  const time = parseStrictTime(profile.time);
  if (!time) return;

  switch (profile.method) {
    case 'pill':
      notifications.push({
        id: CONTRACEPTION_REMINDER_IDS.pill,
        ...contraceptionContent(discrete),
        channelId: CHANNEL_ID,
        extra: { method: profile.method, action: 'take' },
        schedule: { on: time, allowWhileIdle: true },
      });
      return;
    case 'patch':
    case 'ring':
      addContraceptionCycle(notifications, profile.method, profile.anchorDate, time, now, discrete);
      return;
    case 'injection':
    case 'iud':
    case 'implant': {
      const dueDate = parseStrictLocalDate(profile.nextDate);
      if (!dueDate) return;
      dueDate.setHours(time.hour, time.minute, 0, 0);
      addContraceptionOneShot(
        notifications,
        CONTRACEPTION_REMINDER_IDS.due,
        dueDate,
        now,
        profile.method,
        'due',
        discrete,
      );
      const warningDays = profile.warningDays;
      if (warningDays !== undefined) {
        const warningDate = new Date(dueDate);
        warningDate.setDate(warningDate.getDate() - warningDays);
        addContraceptionOneShot(
          notifications,
          CONTRACEPTION_REMINDER_IDS.warning,
          warningDate,
          now,
          profile.method,
          'warning',
          discrete,
        );
      }
      return;
    }
    default:
      return assertNever(profile);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'granted') return true;
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
}

let reminderSyncQueue = Promise.resolve();

export function syncReminderNotifications(settings: AppSettings, predictions?: PredictionResults | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();

  const nextSync = reminderSyncQueue.then(() => syncReminderNotificationsNow(settings, predictions));
  reminderSyncQueue = nextSync.catch(() => { });
  return nextSync;
}

async function syncReminderNotificationsNow(settings: AppSettings, predictions?: PredictionResults | null): Promise<void> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // Android: create channel (required for Android 8+)
    if (Capacitor.getPlatform() === 'android') {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: 'Reminders',
        description: 'Period and daily log reminders',
        importance: 5, // MAX importance for heads-up
        visibility: 1, // Public (show on lock screen)
        vibration: true,
        lights: true
      });
    }

    // Cancel all existing reminders to prevent duplicates
    const allIds = [...new Set([
      ...Object.values(REMINDER_IDS).filter(v => typeof v === 'number'),
      ...Array.from({ length: 10 }, (_, i) => REMINDER_IDS.reminderLate + i),
      ...Array.from(
        { length: CONTRACEPTION_REMINDER_IDS.end - CONTRACEPTION_REMINDER_IDS.start + 1 },
        (_, i) => CONTRACEPTION_REMINDER_IDS.start + i,
      ),
    ])];
    await LocalNotifications.cancel({ notifications: allIds.map(id => ({ id })) });

    const notifications: LocalNotificationSchema[] = [];
    const now = new Date();
    const discrete = !!settings.discreteMode;

    // --- 1. Daily Repeating Reminders (Only Daily Log today) ---
    // Note: We only keep Daily Log as a repeating daily reminder.
    // Period Start/End etc are date-specific and scheduled below.
    if (settings.reminderDailyLog) {
      const { hour, minute } = parseTimeHHmm(settings.reminderDailyLogTime, REMINDER_DEFAULT_TIMES.reminderDailyLogTime);
      const content = getNotifContent('reminderDailyLog', discrete);
      notifications.push({
        id: REMINDER_IDS.reminderDailyLog,
        ...content,
        channelId: CHANNEL_ID,
        schedule: {
          on: { hour, minute },
          allowWhileIdle: true
        }
      });
    }

    // --- 1.5 Medication / Pill Reminder ---
    if (settings.contraceptionReminder) {
      addContraceptionReminders(settings.contraceptionReminder, notifications, now, discrete);
    } else if (settings.reminderPillDaily) {
      const { hour, minute } = parseTimeHHmm(settings.reminderPillDailyTime, REMINDER_DEFAULT_TIMES.reminderPillDailyTime);
      const content = getNotifContent('reminderPill', discrete);
      notifications.push({
        id: REMINDER_IDS.reminderPill,
        ...content,
        channelId: CHANNEL_ID,
        schedule: {
          on: { hour, minute },
          allowWhileIdle: true
        }
      });
    }

    // --- 2. Date-Specific One-Shot Reminders ---
    if (predictions) {
      // A. Expected Period Start
      if (settings.reminderPeriodStart && predictions.nextPeriodStart) {
        const { hour, minute } = parseTimeHHmm(settings.reminderPeriodStartTime, REMINDER_DEFAULT_TIMES.reminderPeriodStartTime);
        const target = parseLocalDate(predictions.nextPeriodStart);
        target.setHours(hour, minute, 0, 0);

        if (target.getTime() > now.getTime()) {
          const content = getNotifContent('reminderPeriodStart', discrete);
          notifications.push({
            id: REMINDER_IDS.reminderPeriodStart,
            ...content,
            channelId: CHANNEL_ID,
            schedule: {
              at: target,
              repeats: false,
              allowWhileIdle: true
            }
          });
        }
      }

      // B. Period Input Nudge (Same day as start, usually later)
      if (settings.reminderPeriodInput && predictions.nextPeriodStart) {
        const { hour, minute } = parseTimeHHmm(settings.reminderPeriodInputTime, REMINDER_DEFAULT_TIMES.reminderPeriodInputTime);
        const target = parseLocalDate(predictions.nextPeriodStart);
        target.setHours(hour, minute, 0, 0);

        if (target.getTime() > now.getTime()) {
          const content = getNotifContent('reminderPeriodInput', discrete);
          notifications.push({
            id: REMINDER_IDS.reminderPeriodInput,
            ...content,
            channelId: CHANNEL_ID,
            schedule: {
              at: target,
              repeats: false,
              allowWhileIdle: true
            }
          });
        }
      }

      // C. Expected Period End
      if (settings.reminderPeriodEnd && predictions.nextPeriodEnd) {
        const { hour, minute } = parseTimeHHmm(settings.reminderPeriodEndTime, REMINDER_DEFAULT_TIMES.reminderPeriodEndTime);
        const target = parseLocalDate(predictions.nextPeriodEnd);
        target.setHours(hour, minute, 0, 0);

        if (target.getTime() > now.getTime()) {
          const content = getNotifContent('reminderPeriodEnd', discrete);
          notifications.push({
            id: REMINDER_IDS.reminderPeriodEnd,
            ...content,
            channelId: CHANNEL_ID,
            schedule: {
              at: target,
              repeats: false,
              allowWhileIdle: true
            }
          });
        }
      }

      // D. Fertility reminder
      if (settings.reminderFertility && predictions.fertileWindow?.start) {
        const { hour, minute } = parseTimeHHmm(settings.reminderFertilityTime, REMINDER_DEFAULT_TIMES.reminderFertilityTime);
        const target = parseLocalDate(predictions.fertileWindow.start);
        target.setHours(hour, minute, 0, 0);

        if (target.getTime() > now.getTime()) {
          const content = getNotifContent('reminderFertility', discrete);
          notifications.push({
            id: REMINDER_IDS.reminderFertility,
            ...content,
            channelId: CHANNEL_ID,
            schedule: {
              at: target,
              repeats: false,
              allowWhileIdle: true
            }
          });
        }
      }

      // E. Ovulation Specific
      if (settings.reminderOvulation && predictions.ovulationDate) {
        const { hour, minute } = parseTimeHHmm(settings.reminderOvulationTime, REMINDER_DEFAULT_TIMES.reminderOvulationTime);
        // Alert usually ON the day OR day before? Bodies says 'Estimated ovulation is tomorrow.'
        // So we schedule it for OvulationDate - 1 day
        const target = parseLocalDate(predictions.ovulationDate);
        target.setDate(target.getDate() - 1);
        target.setHours(hour, minute, 0, 0);

        if (target.getTime() > now.getTime()) {
          const content = getNotifContent('reminderOvulation', discrete);
          notifications.push({
            id: REMINDER_IDS.reminderOvulation,
            ...content,
            channelId: CHANNEL_ID,
            schedule: {
              at: target,
              repeats: false,
              allowWhileIdle: true
            }
          });
        }
      }

      // --- 3. Smart Reminders (PMS & Late) ---
      // A. PMS Reminder (3 days before)
      if (settings.reminderPMS && predictions.nextPeriodStart) {
        const { hour, minute } = parseTimeHHmm(settings.reminderPMSTime, REMINDER_DEFAULT_TIMES.reminderPMSTime);
        const targetDate = parseLocalDate(predictions.nextPeriodStart);
        targetDate.setDate(targetDate.getDate() - 3);
        targetDate.setHours(hour, minute, 0, 0);

        if (targetDate.getTime() > now.getTime()) {
          const content = getNotifContent('reminderPMS', discrete);
          notifications.push({
            id: REMINDER_IDS.reminderPMS,
            ...content,
            channelId: CHANNEL_ID,
            schedule: {
              at: targetDate,
              repeats: false,
              allowWhileIdle: true
            }
          });
        } else {
          // Catch-up logic
          const oneDayBefore = parseLocalDate(predictions.nextPeriodStart);
          oneDayBefore.setDate(oneDayBefore.getDate() - 1);
          if (now.getTime() < oneDayBefore.getTime()) {
            const catchUpTime = new Date();
            catchUpTime.setMinutes(catchUpTime.getMinutes() + 10);
            const content = getNotifContent('reminderPMS', discrete);
            notifications.push({
              id: REMINDER_IDS.reminderPMS,
              ...content,
              channelId: CHANNEL_ID,
              schedule: { at: catchUpTime, repeats: false, allowWhileIdle: true }
            });
          }
        }
      }

      // B. Late Period Reminder (Checks for 7 days)
      if (settings.reminderPeriodLate && predictions.nextPeriodStart) {
        const { hour, minute } = parseTimeHHmm(settings.reminderPeriodLateTime, REMINDER_DEFAULT_TIMES.reminderPeriodLateTime);
        const startDate = parseLocalDate(predictions.nextPeriodStart);
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(hour, minute, 0, 0);

        for (let i = 0; i < 7; i++) {
          const checkDate = new Date(startDate);
          checkDate.setDate(checkDate.getDate() + i);
          if (checkDate.getTime() > now.getTime()) {
            const content = getNotifContent('reminderLate', discrete);
            notifications.push({
              id: REMINDER_IDS.reminderLate + i,
              ...content,
              channelId: CHANNEL_ID,
              schedule: {
                at: checkDate,
                repeats: false,
                allowWhileIdle: true
              }
            });
          }
        }
      }
    }

    if (notifications.length > 0) {
      staggerNotificationCollisions(notifications);
      await LocalNotifications.schedule({ notifications });
    }

  } catch (e) {

    Logger.warn('syncReminderNotifications failed', e);
  }
}

export async function clearDeliveredNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.removeAllDeliveredNotifications();
  } catch (e) {
    Logger.warn('Failed to clear notifications', e);
  }
}



export async function openNotificationSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { AndroidSettings, IOSSettings } = await import('capacitor-native-settings');
    if (Capacitor.getPlatform() === 'android') {
      await (AndroidSettings as any).open({
        option: 'app_notification',
      });
    } else {
      await (IOSSettings as any).open({
        option: 'app_notification',
      });
    }
  } catch (e) {
    Logger.warn('Failed to open settings', e);
  }
}
