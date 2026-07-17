import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const expectedTranslations = {
    en: {
        'common.unlock': 'Unlock',
        'settings.pin_disabled_desc': 'Set a 4-12 digit PIN',
        'settings.pin_error': 'PIN must contain 4 to 12 digits.',
        'settings.enter_pin': 'Enter 4-12 digit PIN',
        'settings.repeat_pin': 'Repeat PIN',
        'settings.enable_pin': 'Enable PIN',
        'settings.pin_security_desc': 'Your health data is encrypted on this device. This PIN controls access to the app.',
        'settings.pin_unlock_prompt': 'Enter your PIN (4-12 digits)',
        'settings.pin_placeholder': '4-12 digit PIN',
        'settings.pin_exit_discrete_prompt': 'Enter your PIN to exit discrete mode',
        'settings.incorrect_pin': 'Incorrect PIN.',
        'settings.pins_dont_match': 'PINs do not match.',
        'calendar.legend.protected_sex': 'Protected sex',
        'calendar.legend.unprotected_sex': 'Unprotected sex',
    },
    de: {
        'common.unlock': 'Entsperren',
        'settings.pin_disabled_desc': 'Lege eine 4- bis 12-stellige PIN fest',
        'settings.pin_error': 'Die PIN muss aus 4 bis 12 Ziffern bestehen.',
        'settings.enter_pin': '4- bis 12-stellige PIN eingeben',
        'settings.repeat_pin': 'PIN wiederholen',
        'settings.enable_pin': 'PIN aktivieren',
        'settings.pin_security_desc': 'Deine Gesundheitsdaten sind auf diesem Gerät verschlüsselt. Diese PIN schützt den Zugriff auf die App.',
        'settings.pin_unlock_prompt': 'Gib deine PIN ein (4 bis 12 Ziffern)',
        'settings.pin_placeholder': '4- bis 12-stellige PIN',
        'settings.pin_exit_discrete_prompt': 'Gib deine PIN ein, um den Diskret-Modus zu beenden.',
        'settings.incorrect_pin': 'Falsche PIN.',
        'settings.pins_dont_match': 'PINs stimmen nicht überein.',
        'calendar.legend.protected_sex': 'Geschützter Sex',
        'calendar.legend.unprotected_sex': 'Ungeschützter Sex',
    },
    es: {
        'common.unlock': 'Desbloquear',
        'settings.pin_disabled_desc': 'Configura un PIN de 4 a 12 dígitos',
        'settings.pin_error': 'El PIN debe tener entre 4 y 12 dígitos.',
        'settings.enter_pin': 'Introduce un PIN de 4 a 12 dígitos',
        'settings.repeat_pin': 'Repite el PIN',
        'settings.enable_pin': 'Activar PIN',
        'settings.pin_security_desc': 'Tus datos de salud están cifrados en este dispositivo. Este PIN controla el acceso a la aplicación.',
        'settings.pin_unlock_prompt': 'Introduce tu PIN (de 4 a 12 dígitos)',
        'settings.pin_placeholder': 'PIN de 4 a 12 dígitos',
        'settings.pin_exit_discrete_prompt': 'Introduce tu PIN para salir del modo discreto.',
        'settings.incorrect_pin': 'PIN incorrecto.',
        'settings.pins_dont_match': 'Los PIN no coinciden.',
        'calendar.legend.protected_sex': 'Sexo protegido',
        'calendar.legend.unprotected_sex': 'Sexo sin protección',
    },
    fa: {
        'common.unlock': 'باز کردن قفل',
        'settings.pin_disabled_desc': 'یک پین ۴ تا ۱۲ رقمی تنظیم کنید',
        'settings.pin_error': 'پین باید ۴ تا ۱۲ رقم داشته باشد.',
        'settings.enter_pin': 'پین ۴ تا ۱۲ رقمی را وارد کنید',
        'settings.repeat_pin': 'پین را تکرار کنید',
        'settings.enable_pin': 'فعال کردن پین',
        'settings.pin_security_desc': 'داده‌های سلامت شما در این دستگاه رمزگذاری شده‌اند. این پین دسترسی به برنامه را کنترل می‌کند.',
        'settings.pin_unlock_prompt': 'پین خود را وارد کنید (۴ تا ۱۲ رقم)',
        'settings.pin_placeholder': 'پین ۴ تا ۱۲ رقمی',
        'settings.pin_exit_discrete_prompt': 'برای خروج از حالت مخفی، پین خود را وارد کنید.',
        'settings.incorrect_pin': 'پین نادرست است.',
        'settings.pins_dont_match': 'پین‌ها همخوانی ندارند.',
        'calendar.legend.protected_sex': 'رابطهٔ محافظت‌شده',
        'calendar.legend.unprotected_sex': 'رابطهٔ محافظت‌نشده',
    },
    fr: {
        'common.unlock': 'Déverrouiller',
        'settings.pin_disabled_desc': 'Définir un code PIN de 4 à 12 chiffres',
        'settings.pin_error': 'Le code PIN doit contenir entre 4 et 12 chiffres.',
        'settings.enter_pin': 'Saisissez un code PIN de 4 à 12 chiffres',
        'settings.repeat_pin': 'Répétez le code PIN',
        'settings.enable_pin': 'Activer le PIN',
        'settings.pin_security_desc': 'Vos données de santé sont chiffrées sur cet appareil. Ce code PIN contrôle l’accès à l’application.',
        'settings.pin_unlock_prompt': 'Saisissez votre code PIN (4 à 12 chiffres)',
        'settings.pin_placeholder': 'Code PIN de 4 à 12 chiffres',
        'settings.pin_exit_discrete_prompt': 'Saisissez votre code PIN pour quitter le mode d’application discret.',
        'settings.incorrect_pin': 'PIN incorrect.',
        'settings.pins_dont_match': 'Les PIN ne correspondent pas.',
        'calendar.legend.protected_sex': 'Rapport protégé',
        'calendar.legend.unprotected_sex': 'Rapport non protégé',
    },
    sv: {
        'common.unlock': 'Lås upp',
        'settings.pin_disabled_desc': 'Ange en PIN-kod med 4 till 12 siffror',
        'settings.pin_error': 'PIN-koden måste innehålla 4 till 12 siffror.',
        'settings.enter_pin': 'Ange en PIN-kod med 4 till 12 siffror',
        'settings.repeat_pin': 'Upprepa PIN-koden',
        'settings.enable_pin': 'Aktivera PIN-kod',
        'settings.pin_security_desc': 'Dina hälsodata är krypterade på den här enheten. PIN-koden styr åtkomsten till appen.',
        'settings.pin_unlock_prompt': 'Ange din PIN-kod (4 till 12 siffror)',
        'settings.pin_placeholder': 'PIN-kod med 4 till 12 siffror',
        'settings.pin_exit_discrete_prompt': 'Ange din PIN-kod för att avsluta diskret läge.',
        'settings.incorrect_pin': 'Fel PIN-kod.',
        'settings.pins_dont_match': 'PIN-koderna matchar inte.',
        'calendar.legend.protected_sex': 'Skyddat sex',
        'calendar.legend.unprotected_sex': 'Oskyddat sex',
    },
    zh: {
        'common.unlock': '解锁',
        'settings.pin_disabled_desc': '设置 4 到 12 位 PIN',
        'settings.pin_error': 'PIN 必须包含 4 到 12 位数字。',
        'settings.enter_pin': '输入 4 到 12 位 PIN',
        'settings.repeat_pin': '再次输入 PIN',
        'settings.enable_pin': '启用 PIN',
        'settings.pin_security_desc': '你的健康数据已在此设备上加密。此 PIN 用于控制应用访问。',
        'settings.pin_unlock_prompt': '输入你的 PIN（4 到 12 位数字）',
        'settings.pin_placeholder': '4 到 12 位 PIN',
        'settings.pin_exit_discrete_prompt': '输入 PIN 以退出伪装模式。',
        'settings.incorrect_pin': 'PIN 不正确。',
        'settings.pins_dont_match': 'PIN 不匹配。',
        'calendar.legend.protected_sex': '有保护性行为',
        'calendar.legend.unprotected_sex': '无保护性行为',
    },
} as const;

const readLocale = (locale: string) => JSON.parse(readFileSync(join(process.cwd(), 'locales', `${locale}.json`), 'utf8'));

const readPath = (source: unknown, path: string) => path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
}, source);

describe('recent locale keys', () => {
    for (const [locale, translations] of Object.entries(expectedTranslations)) {
        it(`has current PIN and calendar sex marker copy in ${locale}`, () => {
            const messages = readLocale(locale);

            for (const [key, value] of Object.entries(translations)) {
                expect(readPath(messages, key)).toBe(value);
            }
        });
    }
});
