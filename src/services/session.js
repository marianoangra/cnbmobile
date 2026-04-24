import * as SecureStore from 'expo-secure-store';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from './firebase';

const SESSION_KEY = 'cnb_session_token';

function gerarToken() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Gera novo token e salva na coleção privada sessions/{uid} e localmente (SecureStore).
// A coleção sessions só pode ser lida/escrita pelo próprio usuário (ver firestore.rules).
export async function registrarSessao(uid) {
  const token = gerarToken();
  await setDoc(doc(db, 'sessions', uid), { token }, { merge: false });
  await SecureStore.setItemAsync(SESSION_KEY, token);
  return token;
}

export async function getTokenLocal() {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function limparSessao() {
  await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
}

// Listener em tempo real: detecta se outro dispositivo assumiu a sessão.
// Escuta sessions/{uid} (privado) ao invés do documento público usuarios/{uid}.
export function escutarSessao(uid, tokenLocal, onSessaoInvalidada) {
  return onSnapshot(
    doc(db, 'sessions', uid),
    async (snap) => {
      if (!snap.exists()) return;
      const tokenFirestore = snap.data().token;
      if (tokenFirestore && tokenLocal && tokenFirestore !== tokenLocal) {
        await limparSessao();
        signOut(auth);
        onSessaoInvalidada?.();
      }
    },
    () => {}, // ignora erros de permissão/rede silenciosamente
  );
}
