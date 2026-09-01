import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DailyLog, AppSettings, INITIAL_SYMPTOMS, PeriodRecord } from '../types';
import { loadData, saveData, loadSettings, saveSettings, loadPeriods, savePeriods, findNearbyPeriod, MIN_GAP_DAYS, cleanupStaleBackupFiles, DEFAULT_SETTINGS } from '../services/logic';
import { addDays, diffInDays } from '../utils/dateUtils';
import { hasDailyLogContent } from '../utils/dailyLogContent';
import { hashPin } from '../utils/pin';
import Logger from '../services/logger';
import { App } from '@capacitor/app';

// Simple helper to sort periods by start date
const sortPeriods = (periods: PeriodRecord[]): PeriodRecord[] =>
    [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));

interface UsePersistenceResult {
    logs: Record<string, DailyLog>;
    periods: PeriodRecord[];
    settings: AppSettings;
    loading: boolean;
    loadError: boolean;
    updateLog: (date: string, data: DailyLog) => Promise<void>;
    bulkUpdateLogs: (updates: Record<string, DailyLog>) => Promise<void>;
    deleteLog: (date: string) => Promise<void>;
    updateSettings: (newSettings: AppSettings) => void;

    // Onboarding logic moved to Context
    startPeriod: (startDate: string, days?: number, isWithdrawalBleed?: boolean) => Promise<void>;
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
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    // Ref to always access latest logs without stale closures
    const logsRef = useRef(logs);
    useEffect(() => { logsRef.current = logs; }, [logs]);

    const periodsRef = useRef(periods);
    useEffect(() => { periodsRef.current = periods; }, [periods]);

    // Clearing flow logs is a second state update, not part of deriving the next
    // periods array - running it inside a setPeriods updater makes that updater
    // impure, so StrictMode's double-invoke (and any discarded concurrent render)
    // replays it. Callers decide which dates to clear, then call this as a sibling.
    const clearFlowOnDates = useCallback((dates: string[]) => {
        if (dates.length === 0) return;
        setLogs(curr => {
            let changed = false;
            const next = { ...curr };
            for (const d of dates) {
                if (next[d]?.flow) {
                    next[d] = { ...next[d], flow: null };
                    changed = true;
                }
            }
            return changed ? next : curr;
        });
    }, []);

    const periodFlowDates = (p: PeriodRecord): string[] =>
        Array.from({ length: p.days }, (_, i) => addDays(p.startDate, i));

    const [loadError, setLoadError] = useState(false);
    const logsLoadFailedRef = useRef(false);
    const periodsLoadFailedRef = useRef(false);
    const settingsLoadFailedRef = useRef(false);

    const persistLogs = useCallback((data: Record<string, DailyLog>) => {
        if (logsLoadFailedRef.current) {
            Logger.warn('Skipping log save: initial load failed, refusing to overwrite possibly-undecrypted data');
            return Promise.resolve();
        }
        return saveData(data);
    }, []);

    const persistPeriods = useCallback((data: PeriodRecord[]) => {
        if (periodsLoadFailedRef.current) {
            Logger.warn('Skipping period save: initial load failed, refusing to overwrite possibly-undecrypted data');
            return Promise.resolve();
        }
        return savePeriods(data);
    }, []);

    const persistSettings = useCallback((data: AppSettings) => {
        if (settingsLoadFailedRef.current) {
            Logger.warn('Skipping settings save: initial load failed, refusing to overwrite possibly-undecrypted data');
            return Promise.resolve();
        }
        return saveSettings(data);
    }, []);

    // Initial Load
    useEffect(() => {
        const init = async () => {
            let logsLoadFailed = false;
            let periodsLoadFailed = false;
            let settingsLoadFailed = false;

            try {
                const loadedLogs = await loadData();
                setLogs(loadedLogs);
            } catch (error) {
                Logger.error("CRITICAL: Failed to load logs; refusing to overwrite on-disk data", error);
                logsLoadFailed = true;
            }

            try {
                const loadedSettings = await loadSettings();

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
                        await persistSettings(loadedSettings);
                    }
                }

                // Migrate legacy plaintext PIN to salted PBKDF2 hash
                if (loadedSettings && loadedSettings.pin && (!loadedSettings.pinHash || !loadedSettings.pinSalt)) {
                    try {
                        const { hash, salt } = await hashPin(loadedSettings.pin);
                        loadedSettings.pinHash = hash;
                        loadedSettings.pinSalt = salt;
                        delete loadedSettings.pin;
                        await persistSettings(loadedSettings);
                    } catch (e) {
                        Logger.error("Failed to migrate legacy PIN to salted hash:", e);
                    }
                }

                setSettings(loadedSettings);
            } catch (error) {
                Logger.error("Failed to load settings", error);
                settingsLoadFailed = true;
            }

            try {
                const loadedPeriods = await loadPeriods();
                const normalized = loadedPeriods.map(p => ({
                    ...p,
                    isWithdrawalBleed: p.isWithdrawalBleed ?? false,
                    ignoreForAverages: p.ignoreForAverages ?? false
                }));
                setPeriods(sortPeriods(normalized));

                if (JSON.stringify(normalized) !== JSON.stringify(loadedPeriods)) {
                    persistPeriods(normalized);
                }
            } catch (error) {
                Logger.error("CRITICAL: Failed to load periods; refusing to overwrite on-disk data", error);
                periodsLoadFailed = true;
            }

            logsLoadFailedRef.current = logsLoadFailed;
            periodsLoadFailedRef.current = periodsLoadFailed;
            settingsLoadFailedRef.current = settingsLoadFailed;
            setLoadError(logsLoadFailed || periodsLoadFailed || settingsLoadFailed);

            cleanupStaleBackupFiles().catch(() => {});
            setLoading(false);
        };
        init();
    }, []);

    // --- Debounced Logic ---
    // The debounce is what makes an edit losable: swipe the app away inside the window
    // and the write never happens. flushPending below is the escape hatch, so the timer
    // and the data it would have written are kept where the flush can reach them.
    const pendingLogsSave = useRef<{ timer: ReturnType<typeof setTimeout>; data: Record<string, DailyLog> } | null>(null);
    const pendingPeriodsSave = useRef<{ timer: ReturnType<typeof setTimeout>; data: PeriodRecord[] } | null>(null);

    useEffect(() => {
        if (loading) return;

        const timer = setTimeout(() => {
            pendingLogsSave.current = null;
            persistLogs(logs);
        }, 1000); // Debounce 1s
        pendingLogsSave.current = { timer, data: logs };

        return () => clearTimeout(timer);
    }, [logs, loading, persistLogs]);

    useEffect(() => {
        if (loading) return;

        const timer = setTimeout(() => {
            pendingPeriodsSave.current = null;
            persistPeriods(periods);
        }, 1000); // Debounce 1s
        pendingPeriodsSave.current = { timer, data: periods };

        return () => clearTimeout(timer);
    }, [periods, loading, persistPeriods]);

    /** Write anything still sitting in the debounce window, right now. */
    const flushPending = useCallback(async () => {
        const logsSave = pendingLogsSave.current;
        const periodsSave = pendingPeriodsSave.current;
        pendingLogsSave.current = null;
        pendingPeriodsSave.current = null;

        const writes: Promise<unknown>[] = [];
        if (logsSave) {
            clearTimeout(logsSave.timer);
            writes.push(persistLogs(logsSave.data));
        }
        if (periodsSave) {
            clearTimeout(periodsSave.timer);
            writes.push(persistPeriods(periodsSave.data));
        }
        await Promise.allSettled(writes);
    }, [persistLogs, persistPeriods]);

    // Android can kill a backgrounded WebView without further warning, so the pause
    // event is the last reliable moment to get an edit onto disk.
    useEffect(() => {
        if (loading) return;

        const listener = App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) {
                flushPending().catch(err => Logger.error('Failed to flush on background:', err));
            }
        });

        return () => { listener.then(l => l.remove()).catch(() => {}); };
    }, [loading, flushPending]);

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
                    return updated;
                }
                return prev;
            });
        }
    }, [logs, settings.periodLength, settings.isOnBirthControl]);

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
        persistSettings(newSettings).catch(err => Logger.error('Failed to persist settings:', err));
    }, [persistSettings]);



    // --- Period CRUD ---
    const startPeriod = useCallback(async (startDate: string, days?: number, isWithdrawalBleed?: boolean) => {
        setPeriods(prev => {
            const periodLen = days ?? settings.periodLength ?? 5;
            const newPeriod: PeriodRecord = {
                id: crypto.randomUUID(),
                startDate,
                days: periodLen,
                activeDays: Array.from({ length: periodLen }, (_, i) => i),
                isWithdrawalBleed: isWithdrawalBleed ?? settings.isOnBirthControl ?? false,
                ignoreForAverages: false
            };
            // Replace any existing period on this exact date (e.g. auto-created by updateLog)
            const filtered = prev.filter(p => p.startDate !== startDate);
            const updated = sortPeriods([...filtered, newPeriod]);
            return updated;
        });
    }, [settings.periodLength, settings.isOnBirthControl]);

    const editPeriod = useCallback(async (id: string, days: number) => {
        setPeriods(prev => {
            const updated = prev.map(p => p.id === id ? { ...p, days } : p);
            const resolved = sortPeriods(updated);
            return resolved;
        });
    }, []);

    const updatePeriodWithdrawalBleed = useCallback(async (id: string, isWithdrawalBleed: boolean) => {
        setPeriods(prev => {
            const updated = prev.map(p => p.id === id ? { ...p, isWithdrawalBleed } : p);
            return updated;
        });
    }, []);

    const updatePeriodIgnoreForAverages = useCallback(async (id: string, ignoreForAverages: boolean) => {
        Logger.debug('updatePeriodIgnoreForAverages:', { id, ignoreForAverages });
        setPeriods(prev => {
            const updated = prev.map(p => p.id === id ? { ...p, ignoreForAverages } : p);
            Logger.debug('Updated periods:', updated);
            return updated;
        });
    }, []);

    const deletePeriod = useCallback(async (id: string) => {
        const target = periodsRef.current.find(item => item.id === id);
        if (target) clearFlowOnDates(periodFlowDates(target));
        setPeriods(prev => prev.filter(item => item.id !== id));
    }, [clearFlowOnDates]);

    const toggleBleedingDay = useCallback(async (date: string, effectivePeriodLength?: number) => {
        // Same lookup the updater does below, run against the current periods so the
        // log clearing can happen outside it. Both read the same array, so they agree.
        const containing = periodsRef.current.find(p =>
            date >= p.startDate && date <= addDays(p.startDate, p.days - 1));
        if (containing) {
            const dayIdx = diffInDays(date, containing.startDate);
            const activeDays = containing.activeDays
                ?? Array.from({ length: containing.days }, (_, i) => i);
            if (activeDays.includes(dayIdx)) {
                // Removing day 0 removes the whole period, so its days clear too.
                clearFlowOnDates(dayIdx === 0 ? periodFlowDates(containing) : [date]);
            }
        }

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
                    // Removing a day. The matching flow logs were already cleared above.

                    // User Request: If removing the START date (day 0), remove the entire period.
                    // This handles the "oops, wrong start date" case by clearing the auto-filled future days
                    // so the user can click the correct start date and get a fresh auto-fill.
                    if (dayIdx === 0) {
                        updated.splice(pIdx, 1);
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

            // Note: We no longer auto-set flow in logs when editing period span.
            // The period record (activeDays) is the source of truth for "period span".
            // Flow logs are optional details the user can add separately.

            return resolved;
        });
    }, [periods, logs, settings.periodLength, settings.isOnBirthControl]);

    const restorePeriods = useCallback((snapshot: PeriodRecord[]) => {
        setPeriods(snapshot);
    }, []);


    return {
        logs,
        settings,
        loading,
        loadError,
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
