import type { AppSettings } from '../../types';

/**
 * Settings that participate in the cycle-management interlocks.
 * Keeping this smaller than AppSettings also lets onboarding use the same
 * rules before the rest of the app settings have been created.
 */
export type SettingsInterlockState = Pick<
  AppSettings,
  | 'adaptivePrediction'
  | 'cycleLength'
  | 'isOnBirthControl'
  | 'predictionsPaused'
  | 'showFertileWindow'
  | 'showPMS'
>;

/**
 * Apply the cycle-management rules after a settings change.
 *
 * This is intentionally pure: callers can use it for interactive Settings
 * changes, onboarding presets, and final onboarding normalization without
 * sharing UI state or persistence concerns.
 */
export function applySettingsInterlocks<T extends SettingsInterlockState>(
  state: T,
  change: Partial<T>
): T {
  const next = { ...state, ...change };

  if (next.isOnBirthControl) {
    next.showFertileWindow = false;
    next.adaptivePrediction = false;
    next.cycleLength = 28;
  }

  if (next.predictionsPaused) {
    next.adaptivePrediction = false;
    next.showFertileWindow = false;
    next.showPMS = false;
  }

  // Explicitly enabling adaptive prediction is the one transition that
  // resumes a paused prediction state. This matches the Settings toggle.
  if (change.adaptivePrediction === true && !next.isOnBirthControl) {
    next.adaptivePrediction = true;
    next.predictionsPaused = false;
  }

  return next;
}
