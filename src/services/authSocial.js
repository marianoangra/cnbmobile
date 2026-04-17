import { NativeModules, Platform } from 'react-native';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';

const { FirebaseUISignIn } = NativeModules;

export async function loginComGoogle() {
  if (Platform.OS !== 'android') {
    throw new Error('Login com Google disponível apenas no Android por enquanto.');
  }
  const result = await FirebaseUISignIn.signInWithGoogle();
  const credential = GoogleAuthProvider.credential(result.idToken);
  return signInWithCredential(auth, credential);
}

// Indica se o login Google está disponível na plataforma atual
export const googleLoginDisponivel = Platform.OS === 'android';
