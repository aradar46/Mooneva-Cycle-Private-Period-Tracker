
import React, { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { App } from '@capacitor/app';
import { usePersistence } from '../hooks/usePersistence';
import { useMoonevaModel } from '../hooks/useMoonevaModel';
import type { MoonevaModel } from '../hooks/useMoonevaModel';
import { DailyLog, AppSettings, PeriodRecord } from '../types';
import Logger from '../services/logger';
import { toLocalISOString, diffInDays } from '../utils/dateUtils';
import { PICKER_SESSION_KEY, PICKER_GRACE_PERIOD_MS } from '../utils/pickerSession';

// Define the shape of our global context
interface MoonevaContextType {
    // Data State
    logs: Record<string, DailyLog>;
    periods: PeriodRecord[];
    settings: AppSettings;
    isLoading: boolean;
    loadError: boolean;

    // Derived Logic (The Model)
    model: MoonevaModel;

    // Actions (Mutations)
    actions: {
        updateLog: (date: string, data: DailyLog) => Promise<void>;
        updateSettings: (newSettings: AppSettings) => void;
        runBackupNow: () => Promise<'written' | 'skipped' | 'failed'>;
        completeOnboarding: (newSettings: AppSettings, initialLog?: { date: string, log: DailyLog }) => Promise<void>;
        startPeriod: (startDate: string, days?: number, isWithdrawalBleed?: boolean) => Promise<void>;
        toggleBleedingDay: (date: string, effectivePeriodLength?: number) => Promise<void>;
        updatePeriodWithdrawalBleed: (id: string, isWithdrawalBleed: boolean) => Promise<void>;
        updatePeriodIgnoreForAverages: (id: string, ignoreForAverages: boolean) => Promise<void>;
        restorePeriods: (snapshot: PeriodRecord[]) => void;
    };
}

const MoonevaContext = createContext<MoonevaContextType | undefined>(undefined);

export const MoonevaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // 1. Persistence Layer (Load/Save)
    const {
        logs,
        settings,
        loading,
        loadError,
        updateLog,
        updateSettings,

        startPeriod,
        toggleBleedingDay,
        updatePeriodWithdrawalBleed,
        updatePeriodIgnoreForAverages,
        restorePeriods,
        periods
    } = usePersistence();

    // 2. Logic Layer (Derived State)
    const model = useMoonevaModel(logs, periods, settings);

    // Sync Smart Notifications (Side Effect)
    React.useEffect(() => {
        if (loading) return;

        let cancelled = false;

        // Sync notifications whenever settings or predictions change
        // We pass the full predictions to enable date-specific one-shot reminders
        import('../services/notifications')
            .then(({ syncReminderNotifications }) => {
                if (cancelled) return;
                return syncReminderNotifications(settings, model.predictions);
            })
            .catch(() => {
                if (!cancelled) Logger.warn('Failed to sync reminder notifications');
            });

        return () => {
            cancelled = true;
        };
    }, [loading, settings, model.predictions]);

    // Sync App Icon (Discrete Mode)
    React.useEffect(() => {
        import('../services/appIcon').then(({ default: AppIcon }) => {
            AppIcon.setIcon({ name: settings.discreteMode ? 'Todo' : 'Default' })
                .catch(err => Logger.warn('Failed to set app icon:', err));
        });
    }, [settings.discreteMode]);

    // Sync Android Widget Data
    React.useEffect(() => {
        import('../services/widgetSync').then(({ WidgetSync }) => {
            const today = toLocalISOString(new Date());
            const todayMeta = model.getDayMeta(today);

            const cycleDay = todayMeta.dayOfCycle ?? 1;
            const cycleLength = settings.cycleLength ?? 28;

            // Calculate days until next period
            let daysUntilPeriod = 14;
            if (model.predictions.nextPeriodStart) {
                daysUntilPeriod = diffInDays(model.predictions.nextPeriodStart, today);
            }

            // Determine current phase
            let currentPhase: 'period' | 'fertile' | 'ovulation' | 'luteal' | 'follicular' | 'pms' = 'follicular';
            if (todayMeta.isPeriod) {
                currentPhase = 'period';
            } else if (todayMeta.isOvulation) {
                currentPhase = 'ovulation';
            } else if (todayMeta.isFertile) {
                currentPhase = 'fertile';
            } else if (todayMeta.isPMS) {
                currentPhase = 'pms';
            }

            WidgetSync.updateWidgetData({
                cycleDay,
                cycleLength,
                daysUntilPeriod,
                currentPhase,
                daysUntilOvulation: model.predictions.ovulationDate ? diffInDays(model.predictions.ovulationDate, today) : 14,
                discreteMode: settings.discreteMode ?? false
            }).catch(err => Logger.warn('Failed to sync widget data:', err));
        }).catch(() => {
            // Plugin not available (e.g., web platform) - silently ignore
        });
        // ponytail: depends on predictions/settings, not getDayMeta's identity (which
        // changes on every log edit, including notes unrelated to the widget's phase
        // display) - getDayMeta is still called fresh above, so this only narrows how
        // often the sync runs, not what it computes when it does.
    }, [settings, model.predictions]);

    // Automatic Encrypted Backup to the user's chosen folder
    // Backgrounding is the trigger because it is the last reliable moment before
    // Android may kill the WebView. runAutoBackup decides whether this particular
    // event is actually due - most are not.
    // A run takes seconds, during which any log edit re-runs this effect. Reading
    // the live state through a ref means the run's result is still recorded
    // afterwards - dropping it would hide a permanent failure from Settings.
    //
    // Known one-render-cycle window: the ref is refreshed after commit, so a
    // settings change made in the same tick the backup promise resolves can be
    // overwritten by the merge below. Closing it properly needs functional
    // updates (updateSettings(prev => ...)), which usePersistence does not expose.
    // The window only opens right after backgrounding, when the user is not in
    // the app, so it is left as-is deliberately.
    const backupState = React.useRef({ settings, logs, periods, updateSettings });
    React.useEffect(() => {
        backupState.current = { settings, logs, periods, updateSettings };
    });

    React.useEffect(() => {
        if (loading) return;

        const listener = App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) return;

            const { settings: live, logs: liveLogs, periods: livePeriods } = backupState.current;
            if (!live.autoBackupEnabled || !live.autoBackupTarget) return;

            // Opening a share sheet or file picker also backgrounds the app. Writing
            // into the destination folder while the user has a picker open on it is
            // asking for trouble, and this is not a real "user left the app" event.
            const pickerTime = Number(sessionStorage.getItem(PICKER_SESSION_KEY) || 0);
            if (pickerTime && Date.now() - pickerTime < PICKER_GRACE_PERIOD_MS) return;

            import('../services/autoBackup')
                .then(({ runAutoBackup }) => runAutoBackup(live, {
                    data: liveLogs,
                    periods: livePeriods,
                    settings: live,
                    timestamp: new Date().toISOString(),
                }))
                .then(({ status, ...bookkeeping }) => {
                    // A skipped run changed nothing, so writing settings back would
                    // only churn storage on every single backgrounding.
                    if (status === 'skipped') return;
                    const current = backupState.current;
                    current.updateSettings({ ...current.settings, ...bookkeeping });
                })
                .catch(err => Logger.warn('Automatic backup failed', err));
        });

        return () => { listener.then(l => l.remove()).catch(() => {}); };
    }, [loading]);

    /**
     * "Back up now". Reads the datasets from disk rather than from React state, because
     * an import or an archive writes straight to storage and leaves the in-memory copies
     * behind until the next load. The background trigger above can use live state; a
     * user-initiated run has to be right whatever they did a moment ago.
     *
     * `force` skips the once-a-day and nothing-changed gates, not the in-flight lock.
     */
    const runBackupNow = useCallback(async (): Promise<'written' | 'skipped' | 'failed'> => {
        const { settings: live } = backupState.current;
        const [{ runAutoBackup }, { loadData, loadPeriods }] = await Promise.all([
            import('../services/autoBackup'),
            import('../services/logic/storage'),
        ]);
        const { status, ...bookkeeping } = await runAutoBackup(live, {
            data: await loadData(),
            periods: await loadPeriods(),
            settings: live,
            timestamp: new Date().toISOString(),
        }, Date.now(), true);

        if (status !== 'skipped') {
            const current = backupState.current;
            current.updateSettings({ ...current.settings, ...bookkeeping });
        }
        return status;
    }, []);

    // 3. Construct the refined context value
    const completeOnboarding = useCallback(async (
        newSettings: AppSettings,
        initialLog?: { date: string, log: DailyLog }
    ) => {
        updateSettings(newSettings);
        if (initialLog) {
            await updateLog(initialLog.date, initialLog.log);
            if (initialLog.log.flow) {
                // Pass explicit length and birth-control status to avoid a race with the state update
                await startPeriod(initialLog.date, newSettings.periodLength, newSettings.isOnBirthControl);
            }
        }
    }, [updateSettings, updateLog, startPeriod]);

    const actions = useMemo(() => ({
        updateLog,
        updateSettings,
        completeOnboarding,
        runBackupNow,
        startPeriod,
        toggleBleedingDay,
        updatePeriodWithdrawalBleed,
        updatePeriodIgnoreForAverages,
        restorePeriods
    }), [
        updateLog,
        updateSettings,
        completeOnboarding,
        runBackupNow,
        startPeriod,
        toggleBleedingDay,
        updatePeriodWithdrawalBleed,
        updatePeriodIgnoreForAverages,
        restorePeriods
    ]);

    const value: MoonevaContextType = useMemo(() => ({
        logs,
        periods,
        settings,
        isLoading: loading,
        loadError,
        model,
        actions
    }), [logs, periods, settings, loading, loadError, model, actions]);

    return (
        <MoonevaContext.Provider value={value}>
            {children}
        </MoonevaContext.Provider>
    );
};

// Hook Helper
export const useMooneva = () => {
    const context = useContext(MoonevaContext);
    if (!context) {
        throw new Error("useMooneva must be used within a MoonevaProvider");
    }
    return context;
};
