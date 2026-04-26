import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import pt from './pt.json';
import en from './en.json';

const LANG_KEY = '@cnb_language';
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

// Aplica preferência salva pelo usuário (async, sem bloquear o init)
AsyncStorage.getItem(LANG_KEY)
  .then(lang => { if (lang && lang !== i18n.language) i18n.changeLanguage(lang); })
  .catch(() => {});

export async function salvarIdioma(lang) {
  await AsyncStorage.setItem(LANG_KEY, lang);
  i18n.changeLanguage(lang);
}

export default i18n;
