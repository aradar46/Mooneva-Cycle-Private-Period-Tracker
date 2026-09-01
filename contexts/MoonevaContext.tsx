
import React, { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { usePersistence } from '../hooks/usePersistence';
import { useMoonevaModel } from '../hooks/useMoonevaModel';
import type { MoonevaModel } from '../hooks/useMoonevaModel';
import { DailyLog, AppSettings, DayMeta, PredictionResults, PeriodRecord, Cycle } from '../types';
import Logger from '../services/logger';
import { toLocalISOString, diffInDays } from '../utils/dateUtils';

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
        bulkUpdateLogs: (updates: Record<string, DailyLog>) => Promise<void>;
        deleteLog: (date: string) => Promise<void>;
        updateSettings: (newSettings: AppSettings) => void;
        completeOnboarding: (newSettings: AppSettings, initialLog?: { date: string, log: DailyLog }) => Promise<void>;
        startPeriod: (startDate: string, days?: number, isWithdrawalBleed?: boolean) => Promise<void>;
        editPeriod: (id: string, days: number) => Promise<void>;
        deletePeriod: (id: string) => Promise<void>;
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
        bulkUpdateLogs,
        deleteLog,
        updateSettings,

        startPeriod,
        editPeriod,
        deletePeriod,
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
        bulkUpdateLogs,
        deleteLog,
        updateSettings,
        completeOnboarding,
        startPeriod,
        editPeriod,
        deletePeriod,
        toggleBleedingDay,
        updatePeriodWithdrawalBleed,
        updatePeriodIgnoreForAverages,
        restorePeriods
    }), [
        updateLog,
        bulkUpdateLogs,
        deleteLog,
        updateSettings,
        completeOnboarding,
        startPeriod,
        editPeriod,
        deletePeriod,
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
