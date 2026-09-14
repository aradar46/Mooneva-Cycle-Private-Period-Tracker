import { registerPlugin } from '@capacitor/core';
import {
    autoBackupFileName,
    fingerprintBackupData,
    selectStaleAutoBackups,
    shouldRunAutoBackup,
} from './logic/autoBackup';
import { generateEncryptedBackup, readAutoBackupPassword, sanitizeSettingsForBackup } from './logic/storage';
import Logger from './logger';
import type { AppSettings, BackupData } from '../types';

/**
 * Drives one automatic-backup attempt: decide, encrypt, write, prune.
 *
 * The native side is a folder handle the user granted once — a SAF tree URI on
 * Android, a security-scoped bookmark on iOS. This module never touches the
 * filesystem directly.
 */

export interface BackupFolderPlugin {
    pickFolder(): Promise<{ cancelled: boolean; target?: string; label?: string }>;
    hasAccess(options: { target: string }): Promise<{ granted: boolean; refreshedTarget?: string }>;
    writeFile(options: { target: string; name: string; data: string }): Promise<{ name: string; refreshedTarget?: string }>;
    listFiles(options: { target: string }): Promise<{ names: string[] }>;
    deleteFile(options: { target: string; name: string }): Promise<{ deleted: boolean }>;
    releaseFolder(options: { target: string }): Promise<void>;
    /** iOS only: asks for expiring-task time so the run is not suspended mid-encrypt. */
    beginBackgroundTask(): Promise<void>;
    endBackgroundTask(): Promise<void>;
}

export const BackupFolder = registerPlugin<BackupFolderPlugin>('BackupFolder');

export interface AutoBackupOutcome {
    status: 'written' | 'skipped' | 'failed';
    /** Set only when iOS handed back a refreshed bookmark that must be persisted. */
    autoBackupTarget?: string;
    autoBackupLastRunAt?: number;
    autoBackupLastFingerprint?: string;
    autoBackupLastError?: string;
}

/** Same FileReader route shareOrDownloadBackup uses to hand a Blob to a native plugin. */
const blobToBase64 = async (blob: Blob): Promise<string> => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    await new Promise<void>((resolve, reject) => {
        reader.onload = () => resolve();
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read the backup file'));
    });
    return (reader.result as string).split(',')[1];
};

/**
 * Deletes auto-backups beyond the keep limit. Best effort by design: the backup
 * is already on disk at this point, so a pruning failure must not turn a
 * successful run into a reported failure.
 */
const pruneOldBackups = async (target: string): Promise<void> => {
    try {
        const { names } = await BackupFolder.listFiles({ target });
        for (const name of selectStaleAutoBackups(names)) {
            await BackupFolder.deleteFile({ target, name });
        }
    } catch (e) {
        Logger.warn('Auto-backup pruning failed; the new backup is still in place', e);
    }
};

/**
 * A run takes seconds (PBKDF2 over the whole dataset), and the app can be
 * backgrounded again before it finishes. Two overlapping runs would pick the
 * same one-second filename, and the second would delete the file the first is
 * still writing. One at a time.
 */
let inFlight = false;

export const runAutoBackup = async (
    settings: AppSettings,
    payload: BackupData,
    now: number = Date.now(),
    /** "Back up now": skip the once-a-day and nothing-changed gates, keep the in-flight lock. */
    force = false,
): Promise<AutoBackupOutcome> => {
    // Fingerprint what actually gets encrypted. The raw settings object carries
    // autoBackupLastFingerprint itself, so hashing it would change the answer
    // every run and the "nothing changed" rule could never fire.
    const fingerprint = fingerprintBackupData({
        ...payload,
        settings: sanitizeSettingsForBackup(payload.settings),
    });

    if (inFlight || (!force && !shouldRunAutoBackup(settings, fingerprint, now))) {
        return { status: 'skipped' };
    }

    const target = settings.autoBackupTarget as string;

    // iOS hands back a replacement when the stored bookmark went stale. A stale
    // bookmark resolves for a while and then stops for good, so the replacement
    // must be persisted whatever else happens in this run - dropping it on a
    // transient failure loses the destination permanently.
    let refreshedTarget: string | undefined;

    // A failed attempt keeps the previous run timestamp so the next background
    // event retries, rather than waiting out another full interval.
    const failed = (message: string): AutoBackupOutcome => ({
        status: 'failed',
        ...(refreshedTarget ? { autoBackupTarget: refreshedTarget } : {}),
        autoBackupLastRunAt: settings.autoBackupLastRunAt,
        autoBackupLastFingerprint: settings.autoBackupLastFingerprint,
        autoBackupLastError: message,
    });

    // Nothing may sit between this and the try: a throw in between would strand
    // the lock and silently stop auto-backup until the app restarts.
    inFlight = true;
    try {
        // iOS can suspend the WebView moments after backgrounding, which is exactly
        // when this runs. Best effort: platforms without the concept just reject.
        await BackupFolder.beginBackgroundTask().catch(() => {});

        const access = await BackupFolder.hasAccess({ target });
        refreshedTarget = access.refreshedTarget;

        if (!access.granted) {
            return failed('The backup folder is no longer available. Choose it again in Settings.');
        }

        const activeTarget = refreshedTarget ?? target;

        const password = await readAutoBackupPassword();
        if (!password) {
            return failed('The backup password is missing. Set it again in Settings.');
        }

        // Encrypt before touching the folder: a failure here must never leave a
        // partial or plaintext file in a folder the user can share.
        const blob = await generateEncryptedBackup(payload, password);
        const data = await blobToBase64(blob);

        const written = await BackupFolder.writeFile({
            target: activeTarget,
            name: autoBackupFileName(now),
            data,
        });
        refreshedTarget = written.refreshedTarget ?? refreshedTarget;

        await pruneOldBackups(refreshedTarget ?? activeTarget);

        return {
            status: 'written',
            ...(refreshedTarget ? { autoBackupTarget: refreshedTarget } : {}),
            autoBackupLastRunAt: now,
            autoBackupLastFingerprint: fingerprint,
            autoBackupLastError: undefined,
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        Logger.error('Automatic backup failed', e);
        return failed(message);
    } finally {
        inFlight = false;
        await BackupFolder.endBackgroundTask().catch(() => {});
    }
};
