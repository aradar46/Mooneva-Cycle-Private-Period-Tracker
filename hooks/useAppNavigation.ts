import { useState, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';

export type ViewType = 'calendar' | 'trends' | 'settings' | 'notifications';
export type SubViewType = 'main' | 'predictions' | 'data_management';

/**
 * Full-screen overlays that must swallow the hardware back before navigation sees it.
 * Without this a modal opened on the calendar falls through to the `view === 'calendar'`
 * branch below and exits the app instead of closing itself.
 *
 * A stack, not a single slot, so a modal opened over another (PinLock over anything)
 * closes the top one rather than leaking the one underneath.
 */
const backInterceptors: Array<() => void> = [];

export const pushBackInterceptor = (onBack: () => void): (() => void) => {
    backInterceptors.push(onBack);
    return () => {
        const i = backInterceptors.lastIndexOf(onBack);
        if (i !== -1) backInterceptors.splice(i, 1);
    };
};

export const useAppNavigation = () => {
    const [view, setViewState] = useState<ViewType>('calendar');
    const [previousView, setPreviousView] = useState<ViewType | null>(null);
    const [subView, setSubView] = useState<SubViewType>('main');
    /**
     * Where a settings sub-screen was opened from, when that was not the Settings list
     * itself (the calendar's backup shortcut). Closing it returns there instead of
     * stranding the user in a Settings screen they never opened.
     */
    const [subViewOrigin, setSubViewOrigin] = useState<ViewType | null>(null);
    const viewRef = useRef(view);
    viewRef.current = view;

    const setView = (newView: ViewType) => {
        setPreviousView(viewRef.current);
        setViewState(newView);
    };

    /** Jump straight to a settings sub-screen from another view. */
    const openSubViewFrom = (origin: ViewType, sub: SubViewType) => {
        setSubViewOrigin(origin);
        setPreviousView(viewRef.current);
        setViewState('settings');
        setSubView(sub);
    };

    const closeSubView = () => {
        setSubView('main');
        if (subViewOrigin) {
            setViewState(subViewOrigin);
            setSubViewOrigin(null);
        }
    };

    // Android Back Button Handling: go back without overwriting previousView
    useEffect(() => {
        const handleBackButton = async () => {
            const topOverlay = backInterceptors[backInterceptors.length - 1];
            if (topOverlay) {
                topOverlay();
            } else if (subView !== 'main') {
                closeSubView();
            } else if (view !== 'calendar') {
                // Always the calendar, never `previousView`. Going back to wherever the user
                // came from could land on the view they are already on (calendar -> trends ->
                // settings -> back leaves previousView at 'trends'), and back then did nothing
                // at all, forever.
                setViewState('calendar');
            } else {
                await CapApp.exitApp();
            }
        };

        const backButtonListener = CapApp.addListener('backButton', handleBackButton);

        return () => {
            backButtonListener.then(f => f.remove());
        };
    }, [view, subView, previousView]);

    return {
        view,
        setView,
        subView,
        setSubView,
        openSubViewFrom,
        closeSubView,
        previousView
    };
};
