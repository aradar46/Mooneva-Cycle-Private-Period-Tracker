
import { App } from '@capacitor/app';
import { clearDeliveredNotifications } from '../services/notifications';

import React, { useEffect, useRef, useState } from 'react';
import { useMooneva } from '../contexts/MoonevaContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAppReview } from '../hooks/useAppReview';

import OnboardingWizard from './OnboardingWizard';
import PinLock from './PinLock';
import { WhatsNewModal } from './WhatsNewModal';

import { CalendarScreen } from './screens/CalendarScreen';
import { TrendsScreen } from './screens/TrendsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { NotificationManagerScreen } from './screens/NotificationManagerScreen';

type PendingPinAction = 'exitDiscreteMode' | null;
const WHATS_NEW_VERSION = '2.0.9';
const WHATS_NEW_STORAGE_KEY = `mooneva_whats_new_seen_${WHATS_NEW_VERSION}`;

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
    const [showWhatsNew, setShowWhatsNew] = useState(false);
    const backgroundedAt = useRef<number | null>(null);
    const initialLockResolved = useRef(false);
    const hasData = Object.keys(logs).length > 0;
    const showOnboarding = !settings.onboardingCompleted && !hasData;

    useEffect(() => {
        if (loading || initialLockResolved.current) return;
        initialLockResolved.current = true;
        setIsLocked(Boolean(settings.pin));
    }, [loading, settings.pin]);

    useEffect(() => {
        if (loading || showOnboarding || (settings.pin && isLocked)) return;
        try {
            if (localStorage.getItem(WHATS_NEW_STORAGE_KEY) !== 'seen') {
                setShowWhatsNew(true);
            }
        } catch {
            setShowWhatsNew(true);
        }
    }, [loading, showOnboarding, settings.pin, isLocked]);

    const closeWhatsNew = () => {
        try {
            localStorage.setItem(WHATS_NEW_STORAGE_KEY, 'seen');
        } catch {
            // The dialog can still be dismissed if storage is unavailable.
        }
        setShowWhatsNew(false);
    };

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

    if (showOnboarding) return <OnboardingWizard onComplete={completeOnboarding} />;

    const content = (() => {
        if (view === 'settings') {
            return <SettingsScreen subView={subView} setSubView={setSubView} setView={setView} isCloaked={settings.discreteMode} />;
        }

        if (view === 'notifications') {
            return <NotificationManagerScreen setView={setView} returnTo={previousView ?? 'calendar'} isCloaked={settings.discreteMode} />;
        }

        if (view === 'trends') {
            return <TrendsScreen setSubView={setSubView} setView={setView} isCloaked={settings.discreteMode} />;
        }

        return (
            <CalendarScreen
                setSubView={setSubView}
                setView={setView}
                isCloaked={settings.discreteMode}
                onRequestExitDiscreteMode={requestExitDiscreteMode}
            />
        );
    })();

    return (
        <>
            {content}
            {showWhatsNew && <WhatsNewModal onClose={closeWhatsNew} />}
        </>
    );
};
