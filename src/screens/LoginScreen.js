import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { colors } from '../theme/colors';

export default function LoginScreen({ navigation }) {
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
    if (!email || !senha) return Alert.alert('Atenção', 'Preencha todos os campos.');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
    } catch (e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        Alert.alert('Erro', 'E-mail ou senha inválidos.');
      } else {
        Alert.alert('Erro', 'Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
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
            <Text style={styles.title}>Entrar</Text>
            <Text style={styles.subtitle}>Bem-vindo de volta</Text>

            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor={colors.secondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor={colors.secondary}
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
            />

            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={colors.background} />
                : <Text style={styles.btnText}>Entrar</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7} style={{ marginTop: 20 }}>
              <Text style={styles.link}>Não tem conta? <Text style={styles.linkDest}>Cadastre-se</Text></Text>
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
    padding: 16, alignItems: 'center', marginBottom: 24,
  },
  btnText: { color: colors.background, fontWeight: 'bold', fontSize: 16 },
  link: { color: colors.secondary, textAlign: 'center', fontSize: 14 },
  linkDest: { color: colors.primary, fontWeight: '600' },
});
