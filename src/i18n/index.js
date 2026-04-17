import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import pt from './pt.json';
import en from './en.json';

const deviceLang = getLocales()[0]?.languageCode ?? 'pt';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
    },
    lng: deviceLang.startsWith('pt') ? 'pt' : 'en',
    fallbackLng: 'pt',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;
