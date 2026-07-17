import { CSSProperties, TouchEvent, useCallback, useEffect, useRef, useState } from 'react';

interface UseSwipeOptions {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
}

interface SwipeApi {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: () => void;
    /** Apply to the sliding element. */
    slideStyle: CSSProperties;
    /** Run the same slide animation programmatically (e.g. arrow buttons). 'left' = next month. */
    triggerSwipe: (direction: 'left' | 'right') => void;
}

const SLIDE_MS = 200;
const AXIS_LOCK_PX = 12;        // finger must move this far before we treat it as a swipe
const COMMIT_FRACTION = 0.3;    // ...or drag past 30% of the container width
const FLICK_VELOCITY = 0.5;     // px/ms; a quick flick commits even on a short drag
const FLICK_MIN_PX = 24;

const reducedMotion = () =>
    typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Horizontal swipe with a paging animation: the content follows the finger 1:1,
 * and on release either springs back (below threshold) or slides fully out while
 * the new content slides in from the opposite side.
 */
export const useSwipe = ({ onSwipeLeft, onSwipeRight }: UseSwipeOptions): SwipeApi => {
    const [offset, setOffset] = useState(0);
    const [animated, setAnimated] = useState(false);

    const startX = useRef(0);
    const startY = useRef(0);
    const lastX = useRef(0);
    const lastTime = useRef(0);
    const velocity = useRef(0);
    const width = useRef(typeof window !== 'undefined' ? window.innerWidth : 360);
    // 'idle' | 'pending' (touched, axis not decided) | 'dragging' | 'scrolling' (vertical, ignore) | 'settling'
    const phase = useRef<'idle' | 'pending' | 'dragging' | 'scrolling' | 'settling'>('idle');
    const timers = useRef<number[]>([]);

    useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

    const later = (fn: () => void, ms: number) => {
        timers.current.push(window.setTimeout(fn, ms));
    };

    const settleBack = () => {
        phase.current = 'settling';
        setAnimated(true);
        setOffset(0);
        later(() => { phase.current = 'idle'; }, SLIDE_MS);
    };

    const commit = useCallback((direction: 'left' | 'right') => {
        const w = width.current;
        const callback = direction === 'left' ? onSwipeLeft : onSwipeRight;
        phase.current = 'settling';

        if (reducedMotion()) {
            setAnimated(false);
            setOffset(0);
            callback?.();
            phase.current = 'idle';
            return;
        }

        // 1. slide current content fully off-screen
        setAnimated(true);
        setOffset(direction === 'left' ? -w : w);
        later(() => {
            // 2. swap content and reposition it off-screen on the opposite side, unanimated
            setAnimated(false);
            setOffset(direction === 'left' ? w : -w);
            callback?.();
            // 3. next frame, slide it in
            requestAnimationFrame(() => requestAnimationFrame(() => {
                setAnimated(true);
                setOffset(0);
                later(() => { phase.current = 'idle'; }, SLIDE_MS);
            }));
        }, SLIDE_MS);
    }, [onSwipeLeft, onSwipeRight]);

    const onTouchStart = (e: TouchEvent) => {
        if (phase.current === 'settling') return;
        const t = e.targetTouches[0];
        startX.current = t.clientX;
        startY.current = t.clientY;
        lastX.current = t.clientX;
        lastTime.current = e.timeStamp;
        velocity.current = 0;
        width.current = (e.currentTarget as HTMLElement).clientWidth || window.innerWidth;
        phase.current = 'pending';
    };

    const onTouchMove = (e: TouchEvent) => {
        if (phase.current !== 'pending' && phase.current !== 'dragging') return;
        const t = e.targetTouches[0];
        const dx = t.clientX - startX.current;
        const dy = t.clientY - startY.current;

        if (phase.current === 'pending') {
            if (Math.abs(dy) > AXIS_LOCK_PX && Math.abs(dy) > Math.abs(dx)) {
                phase.current = 'scrolling'; // vertical scroll, hands off
                return;
            }
            if (Math.abs(dx) < AXIS_LOCK_PX) return; // not a swipe yet
            phase.current = 'dragging';
            setAnimated(false);
        }

        const dt = e.timeStamp - lastTime.current;
        if (dt > 0) velocity.current = (t.clientX - lastX.current) / dt;
        lastX.current = t.clientX;
        lastTime.current = e.timeStamp;
        setOffset(dx);
    };

    const onTouchEnd = () => {
        if (phase.current === 'pending' || phase.current === 'scrolling') {
            phase.current = 'idle';
            return;
        }
        if (phase.current !== 'dragging') return;

        const dx = lastX.current - startX.current;
        const farEnough = Math.abs(dx) > width.current * COMMIT_FRACTION;
        const flicked = Math.abs(velocity.current) > FLICK_VELOCITY
            && Math.abs(dx) > FLICK_MIN_PX
            && Math.sign(velocity.current) === Math.sign(dx);

        if (farEnough || flicked) {
            commit(dx < 0 ? 'left' : 'right');
        } else {
            settleBack();
        }
    };

    const triggerSwipe = useCallback((direction: 'left' | 'right') => {
        if (phase.current !== 'idle') return;
        commit(direction);
    }, [commit]);

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        triggerSwipe,
        slideStyle: {
            transform: `translateX(${Math.round(offset)}px)`,
            transition: animated ? `transform ${SLIDE_MS}ms ease-out` : 'none',
        },
    };
};
