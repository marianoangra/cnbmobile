import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth } from '../services/firebase';
import { logLogin } from '../services/analytics';
import { colors } from '../theme/colors';

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleLogin() {
    if (!email || !senha) return Alert.alert(t('common.attention'), t('login.errorEmpty'));
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      logLogin();
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
        '✅ E-mail enviado',
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Animated.View style={[styles.logoArea, { opacity, transform: [{ translateY }] }]}>
            <View style={styles.logoBox}>
              <Text style={styles.logoBolt}>⚡</Text>
              <Text style={styles.logoText}>CNB</Text>
            </View>
            <Text style={styles.logoSub}>M O B I L E</Text>
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

            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={colors.background} />
                : <Text style={styles.btnText}>{t('login.submit')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleRecuperarSenha} activeOpacity={0.7} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7} style={{ marginTop: 24 }}>
              <Text style={styles.link}>{t('login.noAccount')} <Text style={styles.linkDest}>{t('login.register')}</Text></Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={{ marginTop: 8 }}>
              <Text style={[styles.link, { fontSize: 12 }]}>Continuar sem login</Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoBox: {
    width: 80, height: 80, borderRadius: 22,
    backgroundColor: colors.card, borderWidth: 2, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 1,
  },
  logoBolt: { fontSize: 22, lineHeight: 26 },
  logoText: { fontSize: 18, fontWeight: 'bold', color: colors.primary, letterSpacing: 2 },
  logoSub: { fontSize: 12, color: colors.secondary, letterSpacing: 8 },
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
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.secondary, fontSize: 12, marginHorizontal: 12 },
  btnGoogle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 20, gap: 10,
  },
  btnGoogleIcon: { fontSize: 18, fontWeight: 'bold', color: '#4285F4' },
  btnGoogleText: { color: colors.white, fontWeight: '600', fontSize: 15 },
});
