import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

export const supportedLocales = ['en', 'zh', 'es'] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = 'en';

// Only initialize on client side
if (typeof window !== 'undefined') {
  i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: 'en',
      supportedLngs: ['en', 'zh', 'es'],
      defaultNS: 'common',
      ns: ['common'],
      interpolation: {
        escapeValue: false, // React already escapes
      },
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },
      detection: {
        order: ['cookie', 'localStorage', 'navigator', 'htmlTag'],
        lookupCookie: 'NEXT_LOCALE',
        lookupLocalStorage: 'i18nextLng',
        caches: ['cookie', 'localStorage'],
        cookieMinutes: 525600, // 1 year
      },
      react: {
        useSuspense: false, // Important for client-side rendering
      },
    });
}

export default i18n;
