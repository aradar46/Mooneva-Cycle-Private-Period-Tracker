
import { App } from '@capacitor/app';
import { clearDeliveredNotifications } from '../services/notifications';

import React, { useEffect, useRef, useState } from 'react';
import { useMooneva } from '../contexts/MoonevaContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAppReview } from '../hooks/useAppReview';

import OnboardingWizard from './OnboardingWizard';
import PinLock from './PinLock';

import { CalendarScreen } from './screens/CalendarScreen';
import { TrendsScreen } from './screens/TrendsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { NotificationManagerScreen } from './screens/NotificationManagerScreen';

type PendingPinAction = 'exitDiscreteMode' | null;

export const AppRouter = () => {
    const {
        settings,
        isLoading: loading,
        logs,
        actions
    } = useMooneva();
    const { completeOnboarding } = actions;

    // --- Navigation & Theme Hooks ---
    const { view, setView, subView, setSubView, previousView } = useAppNavigation();
    useAppTheme({ view, discreteMode: !!settings.discreteMode, darkNeumorphism: !!settings.darkNeumorphism });
    useAppReview();

    // --- Security & Onboarding State ---
    const [isLocked, setIsLocked] = useState(true);
    const [pendingPinAction, setPendingPinAction] = useState<PendingPinAction>(null);
    const backgroundedAt = useRef<number | null>(null);
    const initialLockResolved = useRef(false);

    useEffect(() => {
        if (loading || initialLockResolved.current) return;
        initialLockResolved.current = true;
        setIsLocked(Boolean(settings.pin));
    }, [loading, settings.pin]);

    // --- Security Lifecycle ---

    useEffect(() => {
        const setupAppStateListener = async () => {
            return await App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) {
                    clearDeliveredNotifications();
                    if (settings.pin && backgroundedAt.current !== null) {
                        const elapsed = (Date.now() - backgroundedAt.current) / 1000;
                        const timeout = settings.lockTimeout ?? 120;
                        if (elapsed >= timeout) {
                            setIsLocked(true);  // timeout exceeded — keep locked, demand PIN
                        } else {
                            setIsLocked(false); // within grace period — auto-unlock silently
                        }
                    }
                    backgroundedAt.current = null;
                } else {
                    if (settings.pin) {
                        backgroundedAt.current = Date.now();
                        // Always show lock screen in app switcher (privacy)
                        // but appStateChange on resume decides whether PIN entry is needed
                        setIsLocked(true);
                    }
                }
            });
        };

        const statePromise = setupAppStateListener();

        return () => {
            statePromise.then(l => l.remove());
        };
    }, [settings.pin, settings.lockTimeout]);

    const requestExitDiscreteMode = () => {
        if (!settings.pin) {
            actions.updateSettings({ ...settings, discreteMode: false });
            return;
        }
        setPendingPinAction('exitDiscreteMode');
    };

    const confirmExitDiscreteMode = () => {
        actions.updateSettings({ ...settings, discreteMode: false });
        setPendingPinAction(null);
    };

    if (loading) return <div className="fixed inset-0 bg-[#fcfaf6]" />;

    if (isLocked && settings.pin) {
        return <PinLock correctPin={settings.pin} onUnlock={() => setIsLocked(false)} />;
    }

    if (pendingPinAction === 'exitDiscreteMode' && settings.pin) {
        return (
            <PinLock
                purpose="exitDiscreteMode"
                correctPin={settings.pin}
                onUnlock={confirmExitDiscreteMode}
                onCancel={() => setPendingPinAction(null)}
            />
        );
    }

    // Logic to determine if we show onboarding
    const hasData = Object.keys(logs).length > 0;
    const showOnboarding = !settings.onboardingCompleted && !hasData;

    if (showOnboarding) return <OnboardingWizard onComplete={completeOnboarding} />;

    if (view === 'settings') {
        return <SettingsScreen subView={subView} setSubView={setSubView} setView={setView} isCloaked={settings.discreteMode} />;
    }

    if (view === 'notifications') {
        return <NotificationManagerScreen setView={setView} returnTo={previousView ?? 'calendar'} isCloaked={settings.discreteMode} />;
    }

    if (view === 'trends') {
        return <TrendsScreen setSubView={setSubView} setView={setView} isCloaked={settings.discreteMode} />;
    }

    // Default: Calendar
    return (
        <CalendarScreen
            setSubView={setSubView}
            setView={setView}
            isCloaked={settings.discreteMode}
            onRequestExitDiscreteMode={requestExitDiscreteMode}
        />
    );
};
