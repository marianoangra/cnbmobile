import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';
import { criarPerfil } from '../services/pontos';
import { lerReferrerInstalacao, limparReferrer } from '../services/installReferrer';
import { colors } from '../theme/colors';

export default function RegisterScreen({ navigation }) {
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
    if (!nome || !email || !senha || !confirmar) return Alert.alert('Atenção', 'Preencha todos os campos.');
    if (senha !== confirmar) return Alert.alert('Atenção', 'As senhas não coincidem.');
    if (senha.length < 6) return Alert.alert('Atenção', 'Senha mínima de 6 caracteres.');
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), senha);
      await updateProfile(user, { displayName: nome });
      const result = await criarPerfil(user.uid, nome, email.trim(), codigoIndicacao.trim().toUpperCase() || null);
      if (result._indicacaoOk) {
        await limparReferrer();
        Alert.alert('🎁 Indicação registrada!', 'Seu amigo recebeu +100 pontos pela sua indicação!');
      }
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') Alert.alert('Erro', 'E-mail já cadastrado.');
      else if (e.message === 'Código inválido.') Alert.alert('Código inválido', 'O código de indicação não foi encontrado.');
      else Alert.alert('Erro', 'Não foi possível criar a conta.');
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
                <Text style={styles.logoBolt}>⚡</Text>
                <Text style={styles.logoText}>CNB</Text>
              </View>
            </View>

            <Text style={styles.title}>Criar Conta</Text>
            <Text style={styles.subtitle}>Junte-se à comunidade CNB</Text>

            <TextInput style={styles.input} placeholder="Nome completo" placeholderTextColor={colors.secondary}
              value={nome} onChangeText={setNome} autoCapitalize="words" />
            <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor={colors.secondary}
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Senha" placeholderTextColor={colors.secondary}
              value={senha} onChangeText={setSenha} secureTextEntry />
            <TextInput style={styles.input} placeholder="Confirmar senha" placeholderTextColor={colors.secondary}
              value={confirmar} onChangeText={setConfirmar} secureTextEntry />

            <View style={styles.indicacaoBox}>
              <Text style={styles.indicacaoLabel}>🎁 Código de indicação</Text>
              <TextInput
                style={[styles.input, styles.indicacaoInput]}
                placeholder="Opcional — ganhe bônus!"
                placeholderTextColor={colors.secondary}
                value={codigoIndicacao}
                onChangeText={t => setCodigoIndicacao(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={8}
              />
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={colors.background} />
                : <Text style={styles.btnText}>Criar Conta</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.link}>Já tem conta? <Text style={styles.linkDest}>Entrar</Text></Text>
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
  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: 1 },
  logoBolt: { fontSize: 20, lineHeight: 24 },
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
