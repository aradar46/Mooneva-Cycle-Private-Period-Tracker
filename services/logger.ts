/// <reference types="vite/client" />



class Logger {
    private static isDev = import.meta.env.DEV;

    static info(message: string, ...args: any[]) {
        if (Logger.isDev) {
            console.log(`[INFO] ${message}`, ...args);
        }
    }

    static warn(message: string, ...args: any[]) {
        // In production, we might want to send this to a remote service like Sentry
        // For now, we allow it in console but developers must be careful not to log PII
        console.warn(`[WARN] ${message}`, ...args);
    }

    static error(message: string, ...args: any[]) {
        // In production, critical errors should be visible in console for debugging via USB
        console.error(`[ERROR] ${message}`, ...args);
    }

    static debug(message: string, ...args: any[]) {
        if (Logger.isDev) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    }
}

export default Logger;
