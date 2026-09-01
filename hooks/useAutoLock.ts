import { useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { clearDeliveredNotifications } from '../services/notifications';
import { hasPin } from '../utils/pin';
import type { AppSettings } from '../types';

interface UseAutoLockParams {
    settings: AppSettings;
    loading: boolean;
}

export const PICKER_SESSION_KEY = 'mooneva_picking_file';
export const PICKER_GRACE_PERIOD_MS = 20000;

export const useAutoLock = ({ settings, loading }: UseAutoLockParams) => {
    const isPinConfigured = hasPin(settings);
    const [isLocked, setIsLocked] = useState(true);
    const backgroundedAt = useRef<number | null>(null);
    const initialLockResolved = useRef(false);

    useEffect(() => {
        if (loading || initialLockResolved.current) return;
        initialLockResolved.current = true;
        setIsLocked(isPinConfigured);
    }, [loading, isPinConfigured]);

    useEffect(() => {
        const setupAppStateListener = async () => {
            return await App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) {
                    clearDeliveredNotifications();

                    // Check if returning from a system file picker
                    const pickerTime = Number(sessionStorage.getItem(PICKER_SESSION_KEY) || 0);
                    if (pickerTime && Date.now() - pickerTime < PICKER_GRACE_PERIOD_MS) {
                        sessionStorage.removeItem(PICKER_SESSION_KEY);
                        setIsLocked(false);
                        backgroundedAt.current = null;
                        return;
                    }

                    if (isPinConfigured && backgroundedAt.current !== null) {
                        const elapsed = (Date.now() - backgroundedAt.current) / 1000;
                        const timeout = settings.lockTimeout ?? 120;
                        if (elapsed >= timeout) {
                            setIsLocked(true); // timeout exceeded — demand PIN
                        } else {
                            setIsLocked(false); // within grace period — auto-unlock silently
                        }
                    }
                    backgroundedAt.current = null;
                } else {
                    if (isPinConfigured) {
                        backgroundedAt.current = Date.now();
                        const pickerTime = Number(sessionStorage.getItem(PICKER_SESSION_KEY) || 0);
                        // Do not lock out if user is explicitly picking a file
                        if (!(pickerTime && Date.now() - pickerTime < PICKER_GRACE_PERIOD_MS)) {
                            setIsLocked(true);
                        }
                    }
                }
            });
        };

        const statePromise = setupAppStateListener();

        return () => {
            statePromise.then(l => l.remove());
        };
    }, [isPinConfigured, settings.lockTimeout]);

    return {
        isLocked,
        setIsLocked,
        isPinConfigured,
    };
};
