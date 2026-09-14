import { toLocalISOString } from '../../utils/dateUtils';
import type { BackupData } from '../../types';

/**
 * Scheduling and retention rules for the automatic encrypted backup.
 *
 * Everything here is pure so the decision can be unit tested without a
 * filesystem, a picker, or a real clock. The side effects (encrypting and
 * writing through the native folder handle) live in the caller.
 */

/** Filename prefix that marks a file as ours, so retention never touches a user's own files. */
export const AUTO_BACKUP_PREFIX = 'mooneva-auto-';

/** How many auto-backups to keep in the destination folder before pruning the oldest. */
export const AUTO_BACKUP_KEEP = 3;

export interface AutoBackupState {
    autoBackupEnabled?: boolean;
    autoBackupTarget?: string;
    autoBackupLastRunAt?: number;
    autoBackupLastFingerprint?: string;
}

/**
 * FNV-1a over the serialized backup payload. This only has to answer "did
 * anything change since the last write", so a fast non-cryptographic hash is
 * the right tool — the backup itself is what gets encrypted.
 */
export const fingerprintBackupData = (backup: BackupData): string => {
    // timestamp is excluded on purpose: it is minted fresh for every run, so
    // including it would make the payload look changed every single time and the
    // "nothing changed, skip it" rule would never fire.
    const { data, settings, periods } = backup;
    const json = JSON.stringify({ data, settings, periods });
    let hash = 0x811c9dc5;
    for (let i = 0; i < json.length; i++) {
        hash ^= json.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

export const shouldRunAutoBackup = (
    state: AutoBackupState,
    currentFingerprint: string,
    now: number,
): boolean => {
    if (!state.autoBackupEnabled || !state.autoBackupTarget) return false;
    if (state.autoBackupLastFingerprint === currentFingerprint) return false;

    const lastRunAt = state.autoBackupLastRunAt;
    if (lastRunAt === undefined) return true;

    // A lastRunAt in the future means the clock moved backwards (timezone edit,
    // restored backup). Treat it as due rather than blocking backups until the
    // real time catches up.
    if (now < lastRunAt) return true;

    // Once per local calendar day, not a rolling 24 h gap. A rolling gap anchors to
    // the last success, so the eligible moment slides ~2 h later every day until it
    // passes the user's normal usage window and whole days get skipped (BUG-E).
    // Still at most one PBKDF2 run per day, which is what the interval protected.
    return toLocalISOString(new Date(lastRunAt)) !== toLocalISOString(new Date(now));
};

/**
 * Sortable UTC-stamped name. UTC (not local time) so the lexicographic order
 * retention relies on never breaks across a DST change.
 */
export const autoBackupFileName = (now: number): string => {
    const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    return `${AUTO_BACKUP_PREFIX}${stamp}.enc`;
};

/** The auto-backups to delete so that only AUTO_BACKUP_KEEP newest remain. */
export const selectStaleAutoBackups = (existingNames: string[]): string[] => {
    const ours = existingNames.filter((name) => name.startsWith(AUTO_BACKUP_PREFIX)).sort();
    return ours.slice(0, Math.max(0, ours.length - AUTO_BACKUP_KEEP));
};
