import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, ScrollView, Alert, ActivityIndicator, Animated, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { auth } from '../services/firebase';
import { logLogin } from '../services/analytics';
import {
  WEB_CLIENT_ID,
  ANDROID_CLIENT_ID,
  IOS_CLIENT_ID,
  assinarFirebaseComIdToken,
  assinarFirebaseComApple,
  googleLoginDisponivel,
  appleLoginDisponivel,
} from '../services/authSocial';
import { useTheme } from '../context/ThemeContext';
import { Zap } from 'lucide-react-native';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const googleRedirectClientId = Platform.OS === 'ios' ? IOS_CLIENT_ID : ANDROID_CLIENT_ID;
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: `com.googleusercontent.apps.${googleRedirectClientId.split('.')[0]}:/oauthredirect`,
  });

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!appleLoginDisponivel) return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'success') {
      const idToken =
        googleResponse.authentication?.idToken ?? googleResponse.params?.id_token;
      if (!idToken) {
        setLoadingGoogle(false);
        return;
      }
      (async () => {
        try {
          await assinarFirebaseComIdToken(idToken);
          logLogin('google');
          navigation.goBack();
        } catch (e) {
          Alert.alert(t('common.error') || 'Erro', e?.message || 'Falha no login com Google');
        } finally {
          setLoadingGoogle(false);
        }
      })();
    } else if (googleResponse.type === 'error') {
      setLoadingGoogle(false);
      Alert.alert(
        t('common.error') || 'Erro',
        googleResponse.error?.message || 'Falha no login com Google',
      );
    } else {
      setLoadingGoogle(false);
    }
  }, [googleResponse]);

  async function handleLogin() {
    if (!email || !senha) return Alert.alert(t('common.attention'), t('login.errorEmpty'));
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      logLogin('email');
      navigation.goBack();
    } catch (e) {
      if (
        e.code === 'auth/user-not-found' ||
        e.code === 'auth/wrong-password' ||
        e.code === 'auth/invalid-credential'
      ) {
        Alert.alert(t('common.error'), t('login.errorInvalid'));
      } else {
        Alert.alert(t('common.error'), t('login.errorGeneric'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginGoogle() {
    if (!googleRequest) return;
    setLoadingGoogle(true);
    try {
      await googlePromptAsync();
    } catch (e) {
      setLoadingGoogle(false);
      Alert.alert(t('common.error') || 'Erro', e?.message || 'Falha no login com Google');
    }
  }

  async function handleLoginApple() {
    // IMPORTANT: do NOT call setLoadingApple(true) before signInAsync.
    // On iPad, the Apple Sign In sheet is presented as a popover anchored to the
    // native button. Triggering a React re-render (pointerEvents='none') while
    // the sheet is being shown causes the popover's "Continue" button to become
    // unresponsive. Set loading state only AFTER the sheet is dismissed.
    try {
      const bytes = await Crypto.getRandomBytesAsync(32);
      const rawNonce = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      // Apple sheet has been dismissed — safe to trigger loading state now
      setLoadingApple(true);
      if (!cred.identityToken) throw new Error('Sem identityToken retornado pela Apple.');
      await assinarFirebaseComApple({ identityToken: cred.identityToken, rawNonce });
      logLogin('apple');
      navigation.goBack();
    } catch (e) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert(t('common.error') || 'Erro', e?.message || 'Falha no login com Apple');
      }
    } finally {
      setLoadingApple(false);
    }
  }

  async function handleRecuperarSenha() {
    const emailDigitado = email.trim();
    if (!emailDigitado) {
      return Alert.alert(
        'Recuperar senha',
        'Digite seu e-mail no campo acima e toque em "Recuperar senha".',
      );
    }
    try {
      await sendPasswordResetEmail(auth, emailDigitado);
      Alert.alert(
        'E-mail enviado',
        `Verifique sua caixa de entrada em ${emailDigitado} e siga as instruções para redefinir sua senha.`,
      );
    } catch (e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-email') {
        Alert.alert('Erro', 'E-mail não encontrado. Verifique e tente novamente.');
      } else {
        Alert.alert('Erro', 'Não foi possível enviar o e-mail. Tente novamente.');
      }
    }
  }

  return (
    <SafeAreaView style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}>

          <Animated.View style={[styles.logoArea, { opacity, transform: [{ translateY }] }]}>
            <View style={styles.logoBox}>
              <Image
                source={require('../../assets/cnb-logo.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
          </Animated.View>

          <Animated.View style={[styles.form, { opacity, transform: [{ translateY }] }]}>
            <Text style={styles.title}>{t('login.title')}</Text>
            <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('login.email')}
              placeholderTextColor={colors.secondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder={t('login.password')}
              placeholderTextColor={colors.secondary}
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
            />

            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading || loadingGoogle || loadingApple} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={colors.background} />
                : <Text style={styles.btnText}>{t('login.submit')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleRecuperarSenha} activeOpacity={0.7} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            {(googleLoginDisponivel || (appleLoginDisponivel && appleAvailable)) && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OU</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialButtons}>
                  {appleLoginDisponivel && appleAvailable && (
                    <View
                      style={[styles.socialBtnWrapper, loadingApple && styles.socialBtnDisabled]}
                      pointerEvents={loadingApple || loadingGoogle || loading ? 'none' : 'auto'}
                    >
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                        cornerRadius={14}
                        style={styles.appleBtnNative}
                        onPress={handleLoginApple}
                      />
                      {loadingApple && (
                        <View style={styles.socialBtnOverlay} pointerEvents="none">
                          <ActivityIndicator color="#0A0F1E" />
                        </View>
                      )}
                    </View>
                  )}

                  {googleLoginDisponivel && (
                    <TouchableOpacity
                      style={[
                        styles.btnGoogle,
                        (loading || loadingGoogle || loadingApple || !googleRequest) && styles.socialBtnDisabled,
                      ]}
                      onPress={handleLoginGoogle}
                      disabled={loading || loadingGoogle || loadingApple || !googleRequest}
                      activeOpacity={0.9}
                      accessibilityRole="button"
                      accessibilityLabel="Entrar com Google"
                    >
                      {loadingGoogle ? (
                        <ActivityIndicator color="#1F1F1F" />
                      ) : (
                        <>
                          <Image source={require('../../assets/google-g.png')} style={styles.btnGoogleIcon} />
                          <Text style={styles.btnGoogleText}>Entrar com Google</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7} style={{ marginTop: 24 }}>
              <Text style={styles.link}>{t('login.noAccount')} <Text style={styles.linkDest}>{t('login.register')}</Text></Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={{ marginTop: 8 }}>
              <Text style={[styles.link, { fontSize: 12 }]}>Continuar sem login</Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    logoArea: { alignItems: 'center', marginBottom: 36 },
    logoBox: {
      width: 96, height: 96, borderRadius: 24,
      borderWidth: 2, borderColor: colors.primary,
      overflow: 'hidden',
    },
    logoImage: { width: '100%', height: '100%' },
    form: {},
    title: { fontSize: 28, fontWeight: 'bold', color: colors.white, marginBottom: 4 },
    subtitle: { fontSize: 15, color: colors.secondary, marginBottom: 28 },
    input: {
      backgroundColor: colors.card, borderRadius: 14, padding: 16,
      color: colors.white, fontSize: 16, marginBottom: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    btn: {
      backgroundColor: colors.primary, borderRadius: 14,
      padding: 16, alignItems: 'center', marginBottom: 16,
    },
    btnText: { color: colors.background, fontWeight: 'bold', fontSize: 16 },
    forgotBtn: { alignItems: 'flex-end', marginBottom: 4, marginTop: -8 },
    forgotText: { color: colors.secondary, fontSize: 13 },
    link: { color: colors.secondary, textAlign: 'center', fontSize: 14 },
    linkDest: { color: colors.primary, fontWeight: '600' },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    dividerText: {
      color: colors.secondary,
      fontSize: 11,
      marginHorizontal: 14,
      letterSpacing: 2,
      fontWeight: '600',
    },
    socialButtons: {
      gap: 12,
      marginBottom: 4,
    },
    socialBtnWrapper: {
      height: 52,
      borderRadius: 14,
      position: 'relative',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    appleBtnNative: {
      width: '100%',
      height: '100%',
    },
    socialBtnOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    socialBtnDisabled: {
      opacity: 0.55,
    },
    btnGoogle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      paddingHorizontal: 16,
      height: 52,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    btnGoogleIcon: { width: 20, height: 20, resizeMode: 'contain', marginRight: 12 },
    btnGoogleText: {
      color: '#1F1F1F',
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
  });
}
