import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBTx_mrEx6_k9jbN8MeOYztJbsOc6zryl0",
  authDomain: "cnbmobile-2053c.firebaseapp.com",
  projectId: "cnbmobile-2053c",
  storageBucket: "cnbmobile-2053c.firebasestorage.app",
  messagingSenderId: "144617374104",
  appId: "1:144617374104:web:cb38f3303f12616f37abed",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// initializeAuth com AsyncStorage mantém a sessão entre fechamentos do app.
// O try/catch trata hot-reload do Expo Go (onde auth já pode estar inicializado).
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

export const db = getFirestore(app);
export const storage = getStorage(app);
