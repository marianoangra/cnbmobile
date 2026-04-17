import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from './firebase';

const SESSION_KEY = 'cnb_session_token';

function gerarToken() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Gera novo token e salva na coleção privada sessions/{uid} e localmente.
// A coleção sessions só pode ser lida/escrita pelo próprio usuário (ver firestore.rules).
export async function registrarSessao(uid) {
  const token = gerarToken();
  await setDoc(doc(db, 'sessions', uid), { token }, { merge: false });
  await AsyncStorage.setItem(SESSION_KEY, token);
  return token;
}

export async function getTokenLocal() {
  return AsyncStorage.getItem(SESSION_KEY);
}

export async function limparSessao() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

// Listener em tempo real: detecta se outro dispositivo assumiu a sessão.
// Escuta sessions/{uid} (privado) ao invés do documento público usuarios/{uid}.
export function escutarSessao(uid, tokenLocal, onSessaoInvalidada) {
  return onSnapshot(doc(db, 'sessions', uid), async (snap) => {
    if (!snap.exists()) return;
    const tokenFirestore = snap.data().token;
    if (tokenFirestore && tokenLocal && tokenFirestore !== tokenLocal) {
      await limparSessao();
      signOut(auth);
      onSessaoInvalidada?.();
    }
  });
}
