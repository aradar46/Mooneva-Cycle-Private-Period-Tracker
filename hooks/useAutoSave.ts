import { useEffect, useRef } from 'react';

/**
 * Debounced effect that flushes on unmount.
 */
export const useAutoSave = (
    callback: () => void,
    dependencies: React.DependencyList,
    delay: number = 600
) => {
    const callbackRef = useRef(callback);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            callbackRef.current();
            timeoutRef.current = null;
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, dependencies);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            callbackRef.current();
        };
    }, []);
};
