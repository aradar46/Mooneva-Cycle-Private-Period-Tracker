import { useEffect } from 'react';
import { InAppReview } from '@capacitor-community/in-app-review';

const OPEN_COUNT_KEY = 'mooneva_open_count';
const REVIEW_SHOWN_KEY = 'mooneva_review_shown';
const OPENS_REQUIRED = 10;

export function useAppReview() {
    useEffect(() => {
        const alreadyShown = localStorage.getItem(REVIEW_SHOWN_KEY) === 'true';
        if (alreadyShown) return;

        const count = parseInt(localStorage.getItem(OPEN_COUNT_KEY) ?? '0', 10) + 1;
        localStorage.setItem(OPEN_COUNT_KEY, String(count));

        if (count >= OPENS_REQUIRED) {
            localStorage.setItem(REVIEW_SHOWN_KEY, 'true');
            // Small delay so the app is fully rendered before the dialog appears
            const timer = setTimeout(async () => {
                try {
                    await InAppReview.requestReview();
                } catch {
                    // Silently ignore -- F-Droid / no Play Services / simulator
                }
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, []);
}
