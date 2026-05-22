import { useState, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';

export type ViewType = 'calendar' | 'timeline' | 'trends' | 'settings' | 'notifications';
export type SubViewType = 'main' | 'add_log' | 'edit_log' | 'predictions' | 'data_management';

export const useAppNavigation = () => {
    const [view, setViewState] = useState<ViewType>('calendar');
    const [previousView, setPreviousView] = useState<ViewType | null>(null);
    const [subView, setSubView] = useState<SubViewType>('main');
    const viewRef = useRef(view);
    viewRef.current = view;

    const setView = (newView: ViewType) => {
        setPreviousView(viewRef.current);
        setViewState(newView);
    };

    // Android Back Button Handling: go back without overwriting previousView
    useEffect(() => {
        const handleBackButton = async () => {
            if (subView !== 'main') {
                setSubView('main');
            } else if (view !== 'calendar') {
                setViewState(previousView ?? 'calendar');
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
        previousView
    };
};
