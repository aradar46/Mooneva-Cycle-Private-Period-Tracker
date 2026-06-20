import { useEffect } from 'react';

// In-app review is unavailable on F-Droid builds (no Play Services).
// This is a no-op stub kept so call sites don't need to change.
export function useAppReview() {
    useEffect(() => {}, []);
}
