/// <reference types="vite/client" />

class Logger {
    private static isDev = Boolean(import.meta.env.DEV);

    static info(message: string, ...args: unknown[]) {
        if (Logger.isDev) {
            console.log(`[INFO] ${message}`, ...args);
        }
    }

    static warn(message: string, ...args: unknown[]) {
        if (Logger.isDev) {
            console.warn(`[WARN] ${message}`, ...args);
        } else {
            // In production, log message only to avoid leaking stack traces or PII to adb logcat
            console.warn(`[WARN] ${message}`);
        }
    }

    static error(message: string, ...args: unknown[]) {
        if (Logger.isDev) {
            console.error(`[ERROR] ${message}`, ...args);
        } else {
            // In production, log message only to avoid leaking stack traces or PII to adb logcat
            console.error(`[ERROR] ${message}`);
        }
    }

    static debug(message: string, ...args: unknown[]) {
        if (Logger.isDev) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    }
}

export default Logger;
