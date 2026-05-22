
import React, { createContext, useContext, ReactNode } from 'react';
import { usePersistence } from '../hooks/usePersistence';
import { useMoonevaModel } from '../hooks/useMoonevaModel';
import { DailyLog, AppSettings, DayMeta, PredictionResults, PeriodRecord, Cycle } from '../types';
import Logger from '../services/logger';

// Define the shape of our global context
interface MoonevaContextType {
    // Data State
    logs: Record<string, DailyLog>;
    periods: PeriodRecord[];
    settings: AppSettings;
    isLoading: boolean;

    // Derived Logic (The Model)
    model: {
        cycles: Cycle[];
        predictions: PredictionResults;
        getDayMeta: (date: string) => DayMeta;
    };

    // Actions (Mutations)
    actions: {
        updateLog: (date: string, data: DailyLog) => Promise<void>;
        bulkUpdateLogs: (updates: Record<string, DailyLog>) => Promise<void>;
        deleteLog: (date: string) => Promise<void>;
        updateSettings: (newSettings: AppSettings) => void;
        completeOnboarding: (newSettings: AppSettings, initialLog?: { date: string, log: DailyLog }) => Promise<void>;
        startPeriod: (startDate: string, days?: number) => Promise<void>;
        editPeriod: (id: string, days: number) => Promise<void>;
        deletePeriod: (id: string) => Promise<void>;
        toggleBleedingDay: (date: string) => Promise<void>;
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
        // Sync notifications whenever settings or predictions change
        // We pass the full predictions to enable date-specific one-shot reminders
        import('../services/notifications').then(({ syncReminderNotifications }) => {
            syncReminderNotifications(settings, model.predictions);
        });
    }, [settings, model.predictions.nextPeriodStart]);

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
            const today = new Date().toISOString().split('T')[0];
            const todayMeta = model.getDayMeta(today);

            const cycleDay = todayMeta.header?.dayOfCycle ?? 1;
            const cycleLength = settings.cycleLength ?? 28;

            // Calculate days until next period
            let daysUntilPeriod = 14;
            if (model.predictions.nextPeriodStart) {
                const nextStart = new Date(model.predictions.nextPeriodStart);
                const todayDate = new Date(today);
                daysUntilPeriod = Math.ceil((nextStart.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
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
                daysUntilOvulation: model.predictions.ovulationDate ? Math.ceil((new Date(model.predictions.ovulationDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)) : 14,
                discreteMode: settings.discreteMode ?? false
            }).catch(err => Logger.warn('Failed to sync widget data:', err));
        }).catch(() => {
            // Plugin not available (e.g., web platform) - silently ignore
        });
    }, [settings, model.predictions, model.getDayMeta]);

    // 3. Construct the refined context value
    const value: MoonevaContextType = {
        logs,
        periods,
        settings,
        isLoading: loading,
        model,
        actions: {
            updateLog,
            bulkUpdateLogs,
            deleteLog,
            updateSettings,
            completeOnboarding: async (newSettings, initialLog) => {
                updateSettings(newSettings);
                if (initialLog) {
                    await updateLog(initialLog.date, initialLog.log);
                    if (initialLog.log.flow) {
                        // Pass explicit length to avoid race condition with state update
                        await startPeriod(initialLog.date, newSettings.periodLength);
                    }
                }
            },
            startPeriod,
            editPeriod,
            deletePeriod,
            toggleBleedingDay,
            updatePeriodWithdrawalBleed,
            updatePeriodIgnoreForAverages,
            restorePeriods
        }
    };

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
