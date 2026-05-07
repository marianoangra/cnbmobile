import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth } from '../services/firebase';
import { criarPerfil } from '../services/pontos';
import { lerReferrerInstalacao } from '../services/installReferrer';
import { logCadastro, logIndicacaoUsada } from '../services/analytics';
import { useTheme } from '../context/ThemeContext';
import { Zap } from 'lucide-react-native';

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [codigoIndicacao, setCodigoIndicacao] = useState('');
  const [loading, setLoading] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    lerReferrerInstalacao().then(codigo => {
      if (codigo) setCodigoIndicacao(codigo);
    });
  }, []);

  async function handleRegister() {
    if (!nome || !email || !senha || !confirmar) return Alert.alert(t('common.attention'), t('register.errorEmpty'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return Alert.alert(t('common.attention'), t('register.errorInvalidEmail'));
    if (senha !== confirmar) return Alert.alert(t('common.attention'), t('register.errorPasswordMatch'));
    if (senha.length < 6) return Alert.alert(t('common.attention'), t('register.errorPasswordLength'));
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), senha);
      await updateProfile(user, { displayName: nome });
      const result = await criarPerfil(user.uid, nome, email.trim(), codigoIndicacao.trim().toUpperCase() || null);
      logCadastro();
      if (result._indicacaoOk) {
        logIndicacaoUsada();
        Alert.alert(t('register.referralSuccess'), t('register.referralSuccessMsg'));
      }
      navigation.navigate('MainTabs');
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') Alert.alert(t('common.error'), t('register.errorEmailInUse'));
      else if (e.message === 'Código inválido.') Alert.alert(t('common.error'), t('register.errorInvalidCode'));
      else Alert.alert(t('common.error'), t('register.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity, transform: [{ translateY }] }}>

            <View style={styles.logoArea}>
              <View style={styles.logoBox}>
                <Zap size={22} color={colors.primary} strokeWidth={2.5} />
                <Text style={styles.logoText}>CNB</Text>
              </View>
            </View>

            <Text style={styles.title}>{t('register.title')}</Text>
            <Text style={styles.subtitle}>{t('register.subtitle')}</Text>

            <TextInput style={styles.input} placeholder={t('register.name')} placeholderTextColor={colors.secondary}
              value={nome} onChangeText={setNome} autoCapitalize="words" />
            <TextInput style={styles.input} placeholder={t('register.email')} placeholderTextColor={colors.secondary}
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder={t('register.password')} placeholderTextColor={colors.secondary}
              value={senha} onChangeText={setSenha} secureTextEntry />
            <TextInput style={styles.input} placeholder={t('register.confirmPassword')} placeholderTextColor={colors.secondary}
              value={confirmar} onChangeText={setConfirmar} secureTextEntry />

            <View style={styles.indicacaoBox}>
              <Text style={styles.indicacaoLabel}>{t('register.referralCode')}</Text>
              <TextInput
                style={[styles.input, styles.indicacaoInput]}
                placeholder={t('register.referralPlaceholder')}
                placeholderTextColor={colors.secondary}
                value={codigoIndicacao}
                onChangeText={v => setCodigoIndicacao(v.toUpperCase())}
                autoCapitalize="characters"
                maxLength={10}
              />
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={colors.background} />
                : <Text style={styles.btnText}>{t('register.submit')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.link}>{t('register.hasAccount')} <Text style={styles.linkDest}>{t('register.login')}</Text></Text>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    logoArea: { alignItems: 'center', marginBottom: 28 },
    logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: 1 },
    logoText: { fontSize: 16, fontWeight: 'bold', color: colors.primary, letterSpacing: 2 },
    title: { fontSize: 28, fontWeight: 'bold', color: colors.white, marginBottom: 4 },
    subtitle: { fontSize: 15, color: colors.secondary, marginBottom: 24 },
    input: { backgroundColor: colors.card, borderRadius: 14, padding: 16, color: colors.white, fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    indicacaoBox: { marginBottom: 4 },
    indicacaoLabel: { fontSize: 13, color: colors.primary, fontWeight: '600', marginBottom: 6 },
    indicacaoInput: { borderColor: '#1a3a1a', backgroundColor: '#0a1a0a' },
    btn: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 16 },
    btnText: { color: colors.background, fontWeight: 'bold', fontSize: 16 },
    link: { color: colors.secondary, textAlign: 'center', fontSize: 14 },
    linkDest: { color: colors.primary, fontWeight: '600' },
  });
}
