import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// --- Translation Resources ---
// Supported Languages: English, Swedish, Spanish, German, Chinese, Persian

import en from '../locales/en.json';
import sv from '../locales/sv.json';
import es from '../locales/es.json';
import de from '../locales/de.json';
import zh from '../locales/zh.json';
import fa from '../locales/fa.json';

const resources = {
    en: { translation: en },
    sv: { translation: sv },
    es: { translation: es },
    de: { translation: de },
    zh: { translation: zh },
    fa: { translation: fa }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // react already safes from xss
            format: (value, format, lng) => {
                if (typeof value === 'number' || (!isNaN(value) && !isNaN(parseFloat(value)))) {
                    // Eastern Arabic numerals for Arabic and Persian
                    const locales = lng === 'ar' ? 'ar-u-nu-arab' : lng === 'fa' ? 'fa-u-nu-arab' : lng;
                    return new Intl.NumberFormat(locales).format(value);
                }
                return value;
            }
        },
        detection: {
            order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage', 'cookie']
        }
    });

const applyLocaleSettings = (lng: string) => {
    document.documentElement.lang = lng;
    document.dir = lng === 'fa' ? 'rtl' : 'ltr';
};

i18n.on('languageChanged', (lng) => {
    applyLocaleSettings(lng);
});

// Apply settings immediately if already initialized, otherwise wait for event
if (i18n.isInitialized) {
    applyLocaleSettings(i18n.language);
} else {
    i18n.on('initialized', () => {
        applyLocaleSettings(i18n.language);
    });
}

// Utility to format numbers outside of translations
export const formatNumber = (val: number | string) => {
    const lng = i18n.language;
    const locales = lng === 'ar' ? 'ar-u-nu-arab' : lng === 'fa' ? 'fa-u-nu-arab' : lng;
    return new Intl.NumberFormat(locales).format(Number(val));
};


export default i18n;
