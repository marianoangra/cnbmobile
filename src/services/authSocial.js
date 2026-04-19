import { Platform } from 'react-native';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';

export const WEB_CLIENT_ID =
  '144617374104-uf0ruk2f94d2qvh0sj8u7dqgbgo1k0hm.apps.googleusercontent.com';

export const ANDROID_CLIENT_ID =
  '144617374104-f1na8of0dsq5d33fhi7qo8j1n9doddq7.apps.googleusercontent.com';

export async function assinarFirebaseComIdToken(idToken) {
  if (!idToken) throw new Error('idToken vazio recebido do Google.');
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export async function assinarFirebaseComApple({ identityToken, rawNonce }) {
  if (!identityToken) throw new Error('identityToken vazio recebido da Apple.');
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: identityToken, rawNonce });
  return signInWithCredential(auth, credential);
}

export const googleLoginDisponivel = Platform.OS === 'android' || Platform.OS === 'ios';
export const appleLoginDisponivel = Platform.OS === 'ios';
