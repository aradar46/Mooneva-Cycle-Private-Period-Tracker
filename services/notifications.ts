/**
 * Local notification scheduling for reminders.
 * Runs only on native (Android/iOS) via Capacitor.
 */

import { Capacitor } from '@capacitor/core';
import type { AppSettings, PredictionResults } from '../types';
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

/** Parse YYYY-MM-DD as local date (not UTC) to avoid timezone off-by-one */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function parseTimeHHmm(value: string | undefined): { hour: number; minute: number } {
  const str = value || DEFAULT_TIME;
  const [h, m] = str.split(':').map(Number);
  return { hour: isNaN(h) ? 9 : h, minute: isNaN(m) ? 0 : m };
}

/**
 * Adds a small offset to the time to prevent notification collisions.
 * Uses the ID to deterministically stagger notifications by 1 minute each.
 */
function getOffsetTime(baseDate: Date, id: number): Date {
  const offsetCurrent = new Date(baseDate);
  // Add 'id' minutes to stagger
  offsetCurrent.setMinutes(offsetCurrent.getMinutes() + (id % 10));
  return offsetCurrent;
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

export async function syncReminderNotifications(settings: AppSettings, predictions?: PredictionResults | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
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
    const allIds = [
      ...Object.values(REMINDER_IDS).filter(v => typeof v === 'number'),
      ...Array.from({ length: 10 }, (_, i) => REMINDER_IDS.reminderLate + i)
    ];
    await LocalNotifications.cancel({ notifications: allIds.map(id => ({ id })) });

    const notifications: any[] = [];
    const now = new Date();
    const discrete = !!settings.discreteMode;

    // --- 1. Daily Repeating Reminders (Only Daily Log today) ---
    // Note: We only keep Daily Log as a repeating daily reminder.
    // Period Start/End etc are date-specific and scheduled below.
    if (settings.reminderDailyLog) {
      const { hour, minute } = parseTimeHHmm(settings.reminderDailyLogTime);
      const at = new Date();
      at.setHours(hour, minute, 0, 0);

      if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);

      const content = getNotifContent('reminderDailyLog', discrete);
      notifications.push({
        id: REMINDER_IDS.reminderDailyLog,
        ...content,
        channelId: CHANNEL_ID,
        schedule: {
          at: getOffsetTime(at, REMINDER_IDS.reminderDailyLog),
          repeats: true,
          every: 'day',
          allowWhileIdle: true
        }
      });
    }

    // --- 1.5 Medication / Pill Reminder ---
    if (settings.reminderPillDaily) {
      const { hour, minute } = parseTimeHHmm(settings.reminderPillDailyTime);
      const at = new Date();
      at.setHours(hour, minute, 0, 0);

      // If scheduled time is in the past for today, schedule for tomorrow
      if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);

      const content = getNotifContent('reminderPill', discrete);
      notifications.push({
        id: REMINDER_IDS.reminderPill,
        ...content,
        channelId: CHANNEL_ID,
        schedule: {
          at: getOffsetTime(at, REMINDER_IDS.reminderPill),
          repeats: true,
          every: 'day',
          allowWhileIdle: true
        }
      });
    }

    // --- 2. Date-Specific One-Shot Reminders ---
    if (predictions) {
      // A. Expected Period Start
      if (settings.reminderPeriodStart && predictions.nextPeriodStart) {
        const { hour, minute } = parseTimeHHmm(settings.reminderPeriodStartTime);
        const target = parseLocalDate(predictions.nextPeriodStart);
        target.setHours(hour, minute, 0, 0);

        if (target.getTime() > now.getTime()) {
          const content = getNotifContent('reminderPeriodStart', discrete);
          notifications.push({
            id: REMINDER_IDS.reminderPeriodStart,
            ...content,
            channelId: CHANNEL_ID,
            schedule: {
              at: getOffsetTime(target, REMINDER_IDS.reminderPeriodStart),
              repeats: false,
              allowWhileIdle: true
            }
          });
        }
      }

      // B. Period Input Nudge (Same day as start, usually later)
      if (settings.reminderPeriodInput && predictions.nextPeriodStart) {
        const { hour, minute } = parseTimeHHmm(settings.reminderPeriodInputTime);
        const target = parseLocalDate(predictions.nextPeriodStart);
        target.setHours(hour, minute, 0, 0);

        if (target.getTime() > now.getTime()) {
          const content = getNotifContent('reminderPeriodInput', discrete);
          notifications.push({
            id: REMINDER_IDS.reminderPeriodInput,
            ...content,
            channelId: CHANNEL_ID,
            schedule: {
              at: getOffsetTime(target, REMINDER_IDS.reminderPeriodInput),
              repeats: false,
              allowWhileIdle: true
            }
          });
        }
      }

      // C. Expected Period End
      if (settings.reminderPeriodEnd && predictions.nextPeriodEnd) {
        const { hour, minute } = parseTimeHHmm(settings.reminderPeriodEndTime);
        const target = parseLocalDate(predictions.nextPeriodEnd);
        target.setHours(hour, minute, 0, 0);

        if (target.getTime() > now.getTime()) {
          const content = getNotifContent('reminderPeriodEnd', discrete);
          notifications.push({
            id: REMINDER_IDS.reminderPeriodEnd,
            ...content,
            channelId: CHANNEL_ID,
            schedule: {
              at: getOffsetTime(target, REMINDER_IDS.reminderPeriodEnd),
              repeats: false,
              allowWhileIdle: true
            }
          });
        }
      }

      // D. Fertility reminder
      if (settings.reminderFertility && predictions.fertileWindow?.start) {
        const { hour, minute } = parseTimeHHmm(settings.reminderFertilityTime);
        const target = parseLocalDate(predictions.fertileWindow.start);
        target.setHours(hour, minute, 0, 0);

        if (target.getTime() > now.getTime()) {
          const content = getNotifContent('reminderFertility', discrete);
          notifications.push({
            id: REMINDER_IDS.reminderFertility,
            ...content,
            channelId: CHANNEL_ID,
            schedule: {
              at: getOffsetTime(target, REMINDER_IDS.reminderFertility),
              repeats: false,
              allowWhileIdle: true
            }
          });
        }
      }

      // E. Ovulation Specific
      if (settings.reminderOvulation && predictions.ovulationDate) {
        const { hour, minute } = parseTimeHHmm(settings.reminderOvulationTime);
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
              at: getOffsetTime(target, REMINDER_IDS.reminderOvulation),
              repeats: false,
              allowWhileIdle: true
            }
          });
        }
      }

      // --- 3. Smart Reminders (PMS & Late) ---
      // A. PMS Reminder (3 days before)
      if (settings.reminderPMS && predictions.nextPeriodStart) {
        const { hour, minute } = parseTimeHHmm(settings.reminderPMSTime);
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
        const { hour, minute } = parseTimeHHmm(settings.reminderPeriodLateTime);
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
                at: getOffsetTime(checkDate, REMINDER_IDS.reminderLate),
                repeats: false,
                allowWhileIdle: true
              }
            });
          }
        }
      }
    }

    if (notifications.length > 0) {
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
