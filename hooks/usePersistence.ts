import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DailyLog, AppSettings, INITIAL_SYMPTOMS, PeriodRecord } from '../types';
import { loadData, saveData, loadSettings, saveSettings, loadPeriods, savePeriods, findNearbyPeriod, MIN_GAP_DAYS } from '../services/logic';
import { addDays, diffInDays } from '../utils/dateUtils';
import { hasDailyLogContent } from '../utils/dailyLogContent';
import Logger from '../services/logger';
import { syncReminderNotifications } from '../services/notifications';

// Simple helper to sort periods by start date
const sortPeriods = (periods: PeriodRecord[]): PeriodRecord[] =>
    [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));

interface UsePersistenceResult {
    logs: Record<string, DailyLog>;
    periods: PeriodRecord[];
    settings: AppSettings;
    loading: boolean;
    updateLog: (date: string, data: DailyLog) => Promise<void>;
    bulkUpdateLogs: (updates: Record<string, DailyLog>) => Promise<void>;
    deleteLog: (date: string) => Promise<void>;
    updateSettings: (newSettings: AppSettings) => void;

    // Onboarding logic moved to Context
    startPeriod: (startDate: string, days?: number) => Promise<void>;
    editPeriod: (id: string, days: number) => Promise<void>;
    deletePeriod: (id: string) => Promise<void>;
    toggleBleedingDay: (date: string, effectivePeriodLength?: number) => Promise<void>;
    updatePeriodWithdrawalBleed: (id: string, isWithdrawalBleed: boolean) => Promise<void>;
    updatePeriodIgnoreForAverages: (id: string, ignoreForAverages: boolean) => Promise<void>;
    restorePeriods: (snapshot: PeriodRecord[]) => void;
}

export const usePersistence = (): UsePersistenceResult => {
    const [logs, setLogs] = useState<Record<string, DailyLog>>({});
    const [periods, setPeriods] = useState<PeriodRecord[]>([]);
    const [settings, setSettings] = useState<AppSettings>({
        discreteMode: false,
        darkNeumorphism: false,
        userName: 'User',
        onboardingCompleted: false,
        symptoms: INITIAL_SYMPTOMS,
        predictionsPaused: false,
        isOnBirthControl: false,
        // Prediction Settings
        cycleLength: 28,
        periodLength: 5,
        lutealPhaseLength: 14,
        pmsLength: 3,
        showFertileWindow: true,
        showPMS: true,
    });
    const [loading, setLoading] = useState(true);

    // Ref to always access latest logs without stale closures
    const logsRef = useRef(logs);
    useEffect(() => { logsRef.current = logs; }, [logs]);

    // Initial Load
    useEffect(() => {
        const init = async () => {
            try {
                const loadedLogs = await loadData();
                setLogs(loadedLogs);
                const loadedSettings = loadSettings();

                // Repair symptoms: ensure all INITIAL_SYMPTOMS are present and remove "Others"
                if (loadedSettings && loadedSettings.symptoms) {
                    const missing = INITIAL_SYMPTOMS.filter(
                        is => !loadedSettings.symptoms.find(ls => ls.id === is.id)
                    );
                    const cleaned = loadedSettings.symptoms.filter(ls =>
                        INITIAL_SYMPTOMS.find(is => is.id === ls.id)
                    );

                    if (missing.length > 0 || cleaned.length !== loadedSettings.symptoms.length) {
                        loadedSettings.symptoms = [...cleaned, ...missing];
                        saveSettings(loadedSettings);
                    }
                }

                setSettings(loadedSettings);
                syncReminderNotifications(loadedSettings).catch(() => { });

                // Load periods and normalize to ensure all have the new fields
                const loadedPeriods = await loadPeriods();
                const normalized = loadedPeriods.map(p => ({
                    ...p,
                    isWithdrawalBleed: p.isWithdrawalBleed ?? false,
                    ignoreForAverages: p.ignoreForAverages ?? false
                }));
                setPeriods(sortPeriods(normalized));

                // Save normalized version if changed
                if (JSON.stringify(normalized) !== JSON.stringify(loadedPeriods)) {
                    savePeriods(normalized);
                }

            } catch (error) {
                Logger.error("CRITICAL: Failed to load app data", error);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // --- Debounced Logic ---
    useEffect(() => {
        if (loading) return;

        const timer = setTimeout(() => {
            saveData(logs);
        }, 1000); // Debounce 1s

        return () => clearTimeout(timer);
    }, [logs, loading]);

    const updateLog = useCallback(async (date: string, data: DailyLog) => {
        setLogs(prev => {
            const newLogs = { ...prev, [date]: data };
            if (!hasDailyLogContent(data)) {
                delete newLogs[date];
            }
            return newLogs;
        });

        // Option A: Auto-merge flow logs into period activeDays
        // If user logs flow on a gap day or trailing day, add it to the period
        if (data.flow) {
            setPeriods(prev => {
                let updated = [...prev];
                let changed = false;

                // Check if date is inside an existing period span (gap day case)
                const pIdx = updated.findIndex(p => {
                    const end = addDays(p.startDate, p.days - 1);
                    return date >= p.startDate && date <= end;
                });

                if (pIdx !== -1) {
                    const p = updated[pIdx];
                    const dayIdx = diffInDays(date, p.startDate);
                    let activeDays = p.activeDays ? [...p.activeDays] : Array.from({ length: p.days }, (_, i) => i);

                    if (!activeDays.includes(dayIdx)) {
                        // Gap day: add to activeDays
                        activeDays.push(dayIdx);
                        activeDays.sort((a, b) => a - b);
                        updated[pIdx] = { ...p, activeDays };
                        changed = true;
                    }
                } else {
                    // Check for trailing flow (immediately after a period ends)
                    const nearbyPeriod = updated.find(p => {
                        const periodEnd = addDays(p.startDate, p.days - 1);
                        const daysAfter = diffInDays(date, periodEnd);
                        return daysAfter === 1; // Only 1 day (24h) merge window
                    });

                    if (nearbyPeriod) {
                        const nIdx = updated.findIndex(p => p.id === nearbyPeriod.id);
                        const p = updated[nIdx];
                        const newDays = diffInDays(date, p.startDate) + 1;
                        const dayIdx = diffInDays(date, p.startDate);
                        let activeDays = p.activeDays ? [...p.activeDays] : Array.from({ length: p.days }, (_, i) => i);
                        activeDays.push(dayIdx);
                        activeDays.sort((a, b) => a - b);
                        updated[nIdx] = { ...p, days: newDays, activeDays };
                        changed = true;

                        // Recursive merge: check if extending this period now pulls in more existing flow logs
                        let keepMerging = true;
                        while (keepMerging) {
                            keepMerging = false;
                            const currentPeriod = updated[nIdx];
                            const newEnd = addDays(currentPeriod.startDate, currentPeriod.days - 1);
                            const nextDay = addDays(newEnd, 1);

                            if (logsRef.current[nextDay]?.flow) {
                                const extendedDays = currentPeriod.days + 1;
                                const extendedDayIdx = diffInDays(nextDay, currentPeriod.startDate);
                                let extActiveDays = currentPeriod.activeDays ? [...currentPeriod.activeDays] : [];
                                extActiveDays.push(extendedDayIdx);
                                extActiveDays.sort((a, b) => a - b);
                                updated[nIdx] = { ...currentPeriod, days: extendedDays, activeDays: extActiveDays };
                                keepMerging = true;
                            }
                        }
                    } else {
                        // NO period nearby: Create a brand new period record
                        // FIX: Only create a new period if the flow is NOT spotting.
                        // Spotting alone should not trigger a new cycle/period.
                        if (data.flow !== 'spotting') {
                            const defaultLen = settings.periodLength || 5;
                            const newPeriod: PeriodRecord = {
                                id: crypto.randomUUID(),
                                startDate: date,
                                days: defaultLen,
                                activeDays: [0], // Only the current day is active (the one being logged)
                                isWithdrawalBleed: settings.isOnBirthControl || false,
                                ignoreForAverages: false
                            };
                            updated.push(newPeriod);
                            updated.sort((a, b) => a.startDate.localeCompare(b.startDate));
                            changed = true;
                        }
                    }
                }

                if (changed) {
                    savePeriods(updated);
                    return updated;
                }
                return prev;
            });
        }
    }, [logs]);

    const bulkUpdateLogs = useCallback(async (updates: Record<string, DailyLog>) => {
        setLogs(prev => {
            const newLogs = { ...prev, ...updates };

            return newLogs;
        });
    }, []);

    const deleteLog = useCallback(async (date: string) => {
        setLogs(prev => {
            const newLogs = { ...prev };
            delete newLogs[date];

            return newLogs;
        });
    }, []);

    const updateSettingsWrapper = useCallback((newSettings: AppSettings) => {
        setSettings(newSettings);
        saveSettings(newSettings); // Settings are rare, instant save is fine/better
        syncReminderNotifications(newSettings).catch(() => { });
    }, []);



    // --- Period CRUD ---
    const startPeriod = useCallback(async (startDate: string, days?: number) => {
        setPeriods(prev => {
            const periodLen = days ?? settings.periodLength ?? 5;
            const newPeriod: PeriodRecord = {
                id: crypto.randomUUID(),
                startDate,
                days: periodLen,
                activeDays: Array.from({ length: periodLen }, (_, i) => i),
                isWithdrawalBleed: settings.isOnBirthControl || false,
                ignoreForAverages: false
            };
            // Replace any existing period on this exact date (e.g. auto-created by updateLog)
            const filtered = prev.filter(p => p.startDate !== startDate);
            const updated = sortPeriods([...filtered, newPeriod]);
            savePeriods(updated);
            return updated;
        });
    }, [settings.periodLength, settings.isOnBirthControl]);

    const editPeriod = useCallback(async (id: string, days: number) => {
        setPeriods(prev => {
            const updated = prev.map(p => p.id === id ? { ...p, days } : p);
            const resolved = sortPeriods(updated);
            savePeriods(resolved);
            return resolved;
        });
    }, []);

    const updatePeriodWithdrawalBleed = useCallback(async (id: string, isWithdrawalBleed: boolean) => {
        setPeriods(prev => {
            const updated = prev.map(p => p.id === id ? { ...p, isWithdrawalBleed } : p);
            savePeriods(updated);
            return updated;
        });
    }, []);

    const updatePeriodIgnoreForAverages = useCallback(async (id: string, ignoreForAverages: boolean) => {
        Logger.debug('updatePeriodIgnoreForAverages:', { id, ignoreForAverages });
        setPeriods(prev => {
            const updated = prev.map(p => p.id === id ? { ...p, ignoreForAverages } : p);
            Logger.debug('Updated periods:', updated);
            savePeriods(updated);
            return updated;
        });
    }, []);

    const deletePeriod = useCallback(async (id: string) => {
        setPeriods(prev => {
            const p = prev.find(item => item.id === id);
            if (p) {
                setLogs(curr => {
                    const nextLogs = { ...curr };
                    let changed = false;
                    for (let i = 0; i < p.days; i++) {
                        const d = addDays(p.startDate, i);
                        if (nextLogs[d]?.flow) {
                            nextLogs[d] = { ...nextLogs[d], flow: null };
                            changed = true;
                        }
                    }
                    return changed ? nextLogs : curr;
                });
            }

            const updated = prev.filter(item => item.id !== id);
            savePeriods(updated);
            return updated;
        });
    }, []);

    const toggleBleedingDay = useCallback(async (date: string, effectivePeriodLength?: number) => {
        setPeriods(prev => {
            let updated = [...prev];

            const pIdx = updated.findIndex(p => {
                const end = addDays(p.startDate, p.days - 1);
                return date >= p.startDate && date <= end;
            });

            if (pIdx !== -1) {
                const p = updated[pIdx];
                const dayIdx = diffInDays(date, p.startDate);
                let activeDays = p.activeDays ? [...p.activeDays] : Array.from({ length: p.days }, (_, i) => i);

                if (activeDays.includes(dayIdx)) {
                    // Removing a day

                    // User Request (New): Clear flow log for this day if it exists
                    setLogs(curr => {
                        if (curr[date]?.flow) {
                            return { ...curr, [date]: { ...curr[date], flow: null } };
                        }
                        return curr;
                    });

                    // User Request: If removing the START date (day 0), remove the entire period.
                    // This handles the "oops, wrong start date" case by clearing the auto-filled future days
                    // so the user can click the correct start date and get a fresh auto-fill.
                    if (dayIdx === 0) {
                        // Clean up logs for the entire period being removed
                        setLogs(curr => {
                            const nextLogs = { ...curr };
                            let changed = false;
                            for (let i = 0; i < p.days; i++) {
                                const d = addDays(p.startDate, i);
                                if (nextLogs[d]?.flow) {
                                    nextLogs[d] = { ...nextLogs[d], flow: null };
                                    changed = true;
                                }
                            }
                            return changed ? nextLogs : curr;
                        });

                        updated.splice(pIdx, 1);
                        savePeriods(sortPeriods(updated));
                        return updated;
                    }

                    activeDays = activeDays.filter(d => d !== dayIdx);
                } else {
                    activeDays.push(dayIdx);
                }

                if (activeDays.length === 0) {
                    updated.splice(pIdx, 1);
                } else {
                    activeDays.sort((a, b) => a - b);

                    const splitPeriodByGaps = (
                        activeDays: number[],
                        period: PeriodRecord
                    ): PeriodRecord[] => {
                        // SPLIT Logic: If gaps > MIN_GAP_DAYS + 1, break into separate records
                        const splitPieces: number[][] = [];
                        let currentPiece: number[] = [activeDays[0]];

                        for (let i = 1; i < activeDays.length; i++) {
                            if (activeDays[i] - activeDays[i - 1] > MIN_GAP_DAYS + 1) {
                                splitPieces.push(currentPiece);
                                currentPiece = [activeDays[i]];
                            } else {
                                currentPiece.push(activeDays[i]);
                            }
                        }
                        splitPieces.push(currentPiece);

                        if (splitPieces.length > 1) {
                            return splitPieces.map(piece => {
                                const first = piece[0];
                                const last = piece[piece.length - 1];
                                const newStart = addDays(period.startDate, first);
                                return {
                                    ...period,
                                    id: crypto.randomUUID(),
                                    startDate: newStart,
                                    days: (last - first) + 1,
                                    activeDays: piece.map(d => d - first)
                                };
                            });
                        } else {
                            const firstIdx = activeDays[0];
                            const lastIdx = activeDays[activeDays.length - 1];
                            const newStartDate = addDays(period.startDate, firstIdx);
                            const newSpanDays = (lastIdx - firstIdx) + 1;
                            const shiftedActiveDays = activeDays.map(d => d - firstIdx);

                            return [{
                                ...period,
                                startDate: newStartDate,
                                days: newSpanDays,
                                activeDays: shiftedActiveDays
                            }];
                        }
                    };

                    // Inside toggleBleedingDay:
                    const newPeriods = splitPeriodByGaps(activeDays, p);
                    updated.splice(pIdx, 1, ...newPeriods);
                }
            } else {
                const nearby = findNearbyPeriod(date, updated);
                if (nearby) {
                    const nIdx = updated.findIndex(p => p.id === nearby.id);
                    const p = updated[nIdx];
                    const periodEnd = addDays(p.startDate, p.days - 1);

                    if (date > periodEnd) {
                        const newDays = diffInDays(date, p.startDate) + 1;
                        const dayIdx = diffInDays(date, p.startDate);
                        let activeDays = p.activeDays ? [...p.activeDays] : Array.from({ length: p.days }, (_, i) => i);
                        activeDays.push(dayIdx);
                        updated[nIdx] = { ...p, days: newDays, activeDays: activeDays.sort((a, b) => a - b) };
                    } else {
                        const oldEnd = addDays(p.startDate, p.days - 1);
                        const newDays = diffInDays(oldEnd, date) + 1;
                        const shift = diffInDays(p.startDate, date);
                        let activeDays = p.activeDays ? p.activeDays.map(d => d + shift) : Array.from({ length: p.days }, (_, i) => i + shift);
                        activeDays.push(0);
                        updated[nIdx] = { ...p, startDate: date, days: newDays, activeDays: activeDays.sort((a, b) => a - b) };
                    }
                } else {
                    // Start new period — prefer adaptive length if provided, fall back to settings
                    const defaultLen = effectivePeriodLength || settings.periodLength || 5;
                    updated.push({
                        id: crypto.randomUUID(),
                        startDate: date,
                        days: defaultLen,
                        activeDays: Array.from({ length: defaultLen }, (_, i) => i),
                        isWithdrawalBleed: settings.isOnBirthControl || false,
                        ignoreForAverages: false
                    });
                }
            }

            const resolved = sortPeriods(updated);
            savePeriods(resolved);

            // Note: We no longer auto-set flow in logs when editing period span.
            // The period record (activeDays) is the source of truth for "period span".
            // Flow logs are optional details the user can add separately.

            return resolved;
        });
    }, [periods, logs, settings.periodLength, settings.isOnBirthControl]);

    const restorePeriods = useCallback((snapshot: PeriodRecord[]) => {
        setPeriods(snapshot);
        savePeriods(snapshot);
    }, []);


    return {
        logs,
        settings,
        loading,
        updateLog,
        bulkUpdateLogs,
        deleteLog,
        updateSettings: updateSettingsWrapper,
        periods,
        startPeriod,
        editPeriod,
        deletePeriod,
        toggleBleedingDay,
        updatePeriodWithdrawalBleed,
        updatePeriodIgnoreForAverages,
        restorePeriods
    };
};
