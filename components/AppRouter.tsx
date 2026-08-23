import React, { useEffect, useState } from 'react';
import { useMooneva } from '../contexts/MoonevaContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAppReview } from '../hooks/useAppReview';
import { useAutoLock } from '../hooks/useAutoLock';
import { hasPin } from '../utils/pin';

import OnboardingWizard from './OnboardingWizard';
import PinLock from './PinLock';
import { WhatsNewModal } from './WhatsNewModal';

import { CalendarScreen } from './screens/CalendarScreen';
import { TrendsScreen } from './screens/TrendsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { NotificationManagerScreen } from './screens/NotificationManagerScreen';

type PendingPinAction = 'exitDiscreteMode' | null;
const WHATS_NEW_VERSION = '2.2.1';
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

    // --- Auto Lock Hook ---
    const { isLocked, setIsLocked, isPinConfigured } = useAutoLock({ settings, loading });

    // --- Onboarding & Modal State ---
    const [pendingPinAction, setPendingPinAction] = useState<PendingPinAction>(null);
    const [showWhatsNew, setShowWhatsNew] = useState(false);
    const hasData = Object.keys(logs).length > 0;
    const showOnboarding = !settings.onboardingCompleted && !hasData;

    useEffect(() => {
        if (loading || showOnboarding || (isPinConfigured && isLocked)) return;
        try {
            if (localStorage.getItem(WHATS_NEW_STORAGE_KEY) !== 'seen') {
                setShowWhatsNew(true);
            }
        } catch {
            setShowWhatsNew(true);
        }
    }, [loading, showOnboarding, isPinConfigured, isLocked]);

    const closeWhatsNew = () => {
        try {
            localStorage.setItem(WHATS_NEW_STORAGE_KEY, 'seen');
        } catch {
            // The dialog can still be dismissed if storage is unavailable.
        }
        setShowWhatsNew(false);
    };

    const requestExitDiscreteMode = () => {
        if (!isPinConfigured) {
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

    if (isLocked && isPinConfigured) {
        return (
            <PinLock
                pinHash={settings.pinHash}
                pinSalt={settings.pinSalt}
                correctPin={settings.pin}
                onUnlock={() => setIsLocked(false)}
            />
        );
    }

    if (pendingPinAction === 'exitDiscreteMode' && isPinConfigured) {
        return (
            <PinLock
                purpose="exitDiscreteMode"
                pinHash={settings.pinHash}
                pinSalt={settings.pinSalt}
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
