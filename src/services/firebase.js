import { initializeApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence } from 'firebase/auth';
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

const app = initializeApp(firebaseConfig);

// Old Architecture: initializeAuth no nível do módulo funciona sem problema
export const auth = initializeAuth(app, { persistence: inMemoryPersistence });
export const db = getFirestore(app);
export const storage = getStorage(app);
