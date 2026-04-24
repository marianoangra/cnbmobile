import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import { atualizarNome, uploadAvatar } from '../services/pontos';

export default function EditProfileScreen({ route, navigation }) {
  const { perfil, onSalvar } = route.params || {};
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [avatarURL, setAvatarURL] = useState(perfil?.avatarURL ?? null);
  const [salvando, setSalvando] = useState(false);
  const [trocandoAvatar, setTrocandoAvatar] = useState(false);
  const [alterado, setAlterado] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleTrocarAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria para trocar a foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setTrocandoAvatar(true);
    try {
      const url = await uploadAvatar(perfil.uid, result.assets[0].uri);
      setAvatarURL(url);
      onSalvar?.({ avatarURL: url });
    } catch (e) {
      Alert.alert('Erro ao salvar foto', e?.message ?? 'Tente novamente.');
    } finally {
      setTrocandoAvatar(false);
    }
  }

  async function handleSalvar() {
    if (!nome.trim()) return Alert.alert('Atenção', 'O nome não pode estar vazio.');
    const nomeIgual = nome.trim() === perfil?.nome;
    if (nomeIgual) {
      navigation.goBack();
      return;
    }

    setSalvando(true);
    try {
      await atualizarNome(perfil.uid, nome.trim());
      onSalvar?.({ nome: nome.trim() });
      navigation.goBack();
    } catch (e) {
      console.error('[EditProfile] erro ao salvar:', e);
      const detalhe = e?.code ?? e?.message ?? 'erro desconhecido';
      Alert.alert('Erro ao salvar', detalhe);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <Animated.View style={[styles.content, { opacity, transform: [{ translateY }] }]}>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handleTrocarAvatar} activeOpacity={0.8} disabled={trocandoAvatar} style={styles.avatarTouchable}>
              <Avatar uri={avatarURL} nome={nome || perfil?.nome} size={110} borderColor={colors.primary} />
              <View style={styles.avatarCameraBtn}>
                {trocandoAvatar
                  ? <ActivityIndicator color={colors.background} size="small" />
                  : <Text style={styles.avatarCameraIcon}>📷</Text>}
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Toque para alterar a foto</Text>
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
            <Text style={styles.campoHint}>{nome.trim().length}/40 caracteres</Text>
          </View>

          {/* Aparência */}
          <View style={styles.campo}>
            <Text style={styles.campoLabel}>Aparência</Text>
            <View style={styles.themeRow}>
              <TouchableOpacity
                style={[styles.themeBtn, isDark && styles.themeBtnAtivo]}
                onPress={() => !isDark && toggleTheme()}
                activeOpacity={0.8}>
                <Text style={styles.themeBtnIcon}>🌙</Text>
                <Text style={[styles.themeBtnText, isDark && styles.themeBtnTextAtivo]}>Dark</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeBtn, !isDark && styles.themeBtnAtivo]}
                onPress={() => isDark && toggleTheme()}
                activeOpacity={0.8}>
                <Text style={styles.themeBtnIcon}>☀️</Text>
                <Text style={[styles.themeBtnText, !isDark && styles.themeBtnTextAtivo]}>Light</Text>
              </TouchableOpacity>
            </View>
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

function createStyles(colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flexGrow: 1, padding: 24 },
    content: { alignItems: 'center' },

    avatarSection: { alignItems: 'center', marginBottom: 36, marginTop: 8 },
    avatarTouchable: { alignItems: 'center', marginBottom: 6 },
    avatarCameraBtn: {
      position: 'absolute', bottom: 4, right: 4,
      backgroundColor: colors.primary,
      borderRadius: 18, width: 34, height: 34,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: colors.background,
    },
    avatarCameraIcon: { fontSize: 15 },
    avatarHint: { fontSize: 12, color: colors.secondary },

    campo: { width: '100%', marginBottom: 24 },
    campoLabel: { fontSize: 13, color: colors.secondary, marginBottom: 8, fontWeight: '600' },
    input: {
      backgroundColor: colors.card, borderRadius: 14, padding: 16,
      color: colors.white, fontSize: 17, borderWidth: 1, borderColor: colors.border,
    },
    campoHint: { fontSize: 11, color: colors.border, marginTop: 6, textAlign: 'right' },

    themeRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    themeBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 14,
      borderWidth: 1.5, borderColor: colors.border,
    },
    themeBtnAtivo: { borderColor: colors.primary, backgroundColor: colors.background },
    themeBtnIcon: { fontSize: 18 },
    themeBtnText: { fontSize: 14, fontWeight: '600', color: colors.secondary },
    themeBtnTextAtivo: { color: colors.primary },

    btnSalvar: {
      width: '100%', backgroundColor: colors.primary,
      borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12,
    },
    btnSalvarInativo: { opacity: 0.45 },
    btnSalvarText: { color: colors.background, fontWeight: 'bold', fontSize: 16 },

    btnCancelar: { padding: 12 },
    btnCancelarText: { color: colors.secondary, fontSize: 15 },
  });
}
