import AsyncStorage from '@react-native-async-storage/async-storage';

export const CONSENTIMENTOS_KEY = '@cnb_dados_consentimentos';

// IDs que sempre são true independente do AsyncStorage
const ESSENCIAIS = ['analiticos'];

/**
 * Lê o estado de consentimentos do AsyncStorage.
 * Retorna um objeto { [id]: boolean }. Essenciais sempre true.
 */
export async function lerConsentimentos() {
  try {
    const json = await AsyncStorage.getItem(CONSENTIMENTOS_KEY);
    const salvos = json ? JSON.parse(json) : {};
    return {
      ...salvos,
      ...Object.fromEntries(ESSENCIAIS.map(id => [id, true])),
    };
  } catch {
    return Object.fromEntries(ESSENCIAIS.map(id => [id, true]));
  }
}

/**
 * Verifica se um consentimento específico está ativo.
 * Essenciais sempre retornam true.
 */
export async function temConsentimento(id) {
  if (ESSENCIAIS.includes(id)) return true;
  const consentimentos = await lerConsentimentos();
  return consentimentos[id] === true;
}
