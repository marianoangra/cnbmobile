import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function getConfiguracaoApp() {
  try {
    const snap = await getDoc(doc(db, 'config', 'app'));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}
