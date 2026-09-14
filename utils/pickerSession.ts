/**
 * Marks the window during which the app was backgrounded by a system picker or
 * share sheet rather than by the user leaving.
 *
 * Kept in a leaf module so consumers can read it without pulling in the auto-lock
 * hook's dependency chain (notifications, i18n).
 */
export const PICKER_SESSION_KEY = 'mooneva_picking_file';
export const PICKER_GRACE_PERIOD_MS = 20000;
