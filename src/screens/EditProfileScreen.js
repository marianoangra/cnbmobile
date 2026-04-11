import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import Avatar from '../components/Avatar';
import { atualizarNome } from '../services/pontos';

export default function EditProfileScreen({ route, navigation }) {
  const { perfil, onSalvar } = route.params || {};

  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleSalvar() {
    if (!nome.trim()) return Alert.alert('Atenção', 'O nome não pode estar vazio.');
    if (nome.trim() === perfil?.nome) {
      navigation.goBack();
      return;
    }
    setSalvando(true);
    try {
      await atualizarNome(perfil.uid, nome.trim());
      onSalvar?.({ nome: nome.trim(), avatarURL: perfil?.avatarURL });
      navigation.goBack();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <Animated.View style={[styles.content, { opacity, transform: [{ translateY }] }]}>

          {/* Avatar (somente exibição) */}
          <View style={styles.avatarSection}>
            <Avatar uri={perfil?.avatarURL} nome={nome || perfil?.nome} size={110} borderColor={colors.primary} />
          </View>

          {/* Nome */}
          <View style={styles.campo}>
            <Text style={styles.campoLabel}>Nome de usuário</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={t => { setNome(t); setAlterado(true); }}
              placeholder="Seu nome"
              placeholderTextColor={colors.secondary}
              autoCapitalize="words"
              maxLength={40}
              returnKeyType="done"
            />
            <Text style={styles.campoHint}>{nome.length}/40 caracteres</Text>
          </View>

          {/* Botão salvar */}
          <TouchableOpacity
            style={[styles.btnSalvar, !alterado && styles.btnSalvarInativo]}
            onPress={handleSalvar}
            disabled={salvando || !alterado}
            activeOpacity={0.85}>
            {salvando
              ? <ActivityIndicator color={colors.background} />
              : <Text style={styles.btnSalvarText}>Salvar alterações</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnCancelar} activeOpacity={0.7}>
            <Text style={styles.btnCancelarText}>Cancelar</Text>
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 24 },
  content: { alignItems: 'center' },

  avatarSection: { alignItems: 'center', marginBottom: 36, marginTop: 8 },

  campo: { width: '100%', marginBottom: 24 },
  campoLabel: { fontSize: 13, color: colors.secondary, marginBottom: 8, fontWeight: '600' },
  input: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16,
    color: colors.white, fontSize: 17, borderWidth: 1, borderColor: colors.border,
  },
  campoHint: { fontSize: 11, color: colors.border, marginTop: 6, textAlign: 'right' },

  btnSalvar: {
    width: '100%', backgroundColor: colors.primary,
    borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12,
  },
  btnSalvarInativo: { opacity: 0.45 },
  btnSalvarText: { color: colors.background, fontWeight: 'bold', fontSize: 16 },

  btnCancelar: { padding: 12 },
  btnCancelarText: { color: colors.secondary, fontSize: 15 },
});
