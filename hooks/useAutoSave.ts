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
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            callbackRef.current();
        }, delay);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, dependencies);

    useEffect(() => {
        return () => {
            callbackRef.current();
        };
    }, []);
};
