import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Battery from 'expo-battery';
import { useTheme } from '../context/ThemeContext';
import BannerAd from '../components/BannerAd';
import KastBanner from '../components/KastBanner';
import Avatar from '../components/Avatar';

function estaCarregandoOuCheia(state) {
  return state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
}

function useEstaCarregando() {
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    let sub;
    Battery.getBatteryStateAsync()
      .then(state => {
        setCarregando(estaCarregandoOuCheia(state));
      })
      .catch(() => {});
    sub = Battery.addBatteryStateListener(({ batteryState }) => {
      setCarregando(estaCarregandoOuCheia(batteryState));
    });
    return () => sub?.remove();
  }, []);
  return carregando;
}

const META = 100000;

function useEntrada(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 480, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 480, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function HomeScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, perfil, onAtualizar } = route.params || {};
  const onAtualizarRef = useRef(onAtualizar);
  useEffect(() => { onAtualizarRef.current = onAtualizar; }, [onAtualizar]);

  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      if (user) onAtualizarRef.current?.();
      return () => setFocused(false);
    }, [user])
  );

  const pontos = perfil?.pontos ?? 0;
  const progresso = Math.min(pontos / META, 1);
  const faltam = Math.max(META - pontos, 0);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progresso, duration: 900, delay: 300, useNativeDriver: false }).start();
  }, [pontos]);

  const a = useEntrada(0);
  const b = useEntrada(80);
  const c = useEntrada(160);
  const d = useEntrada(240);

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const estaCarregando = useEstaCarregando();
  const nome = perfil?.nome?.split(' ')[0] ?? (user ? 'Usuário' : 'Visitante');
  const podeSacar = pontos >= META;

  function handleBannerPress(id) {
    if (id === 'ranking') navigation.navigate('Ranking', { uid: perfil?.uid, perfil });
    else if (id === 'carregar') navigation.navigate('Carregar');
    else if (id === 'pix') {
      if (!user) return navigation.navigate('Login');
      if (podeSacar) navigation.navigate('Withdraw', { perfil });
    }
  }

  function handleSaque() {
    if (!user) return navigation.navigate('Login');
    if (!podeSacar) return Alert.alert('Pontos insuficientes', 'Você precisa de 100.000 pts para sacar.');
    navigation.navigate('Withdraw', { perfil });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Animated.View style={[styles.header, a]}>
          <View style={styles.headerLeft}>
            <Text style={styles.saudacao}>{saudacao()},</Text>
            <Text style={styles.nome}>{nome} 👋</Text>
          </View>

          {user ? (
            <Avatar uri={perfil?.avatarURL} nome={perfil?.nome} size={46} borderColor={colors.primary} />
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginBtn} activeOpacity={0.85}>
              <View style={styles.loginBtnCircle}>
                <Text style={styles.loginBtnIcon}>👤</Text>
              </View>
              <Text style={styles.loginBtnLabel}>Entrar</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        <Animated.View style={[{ marginBottom: 16 }, b]}>
          <BannerAd onPress={handleBannerPress} active={focused} />
        </Animated.View>

        <Animated.View style={[styles.mainCard, b]}>
          <View style={styles.mainCardTop}>
            <Text style={styles.mainLabel}>Seus Pontos</Text>
            {user && estaCarregando && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>⚡ Ativo</Text>
              </View>
            )}
          </View>
          <Text style={styles.pontos}>{pontos.toLocaleString('pt-BR')}</Text>

          <View style={styles.progressBg}>
            <Animated.View style={[styles.progressFill, { width: user ? progressWidth : '0%' }]} />
          </View>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>
              {!user
                ? 'Entre para acumular pontos'
                : faltam > 0
                  ? `Faltam ${faltam.toLocaleString('pt-BR')} pts para saque`
                  : '🎉 Você pode sacar agora!'}
            </Text>
            {user && <Text style={styles.progressPct}>{Math.round(progresso * 100)}%</Text>}
          </View>
        </Animated.View>

        <Animated.View style={[styles.row, c]}>
          <View style={[styles.statCard, styles.half]}>
            <Text style={styles.statIcon}>⏱</Text>
            <Text style={styles.statVal}>{perfil?.minutos ?? 0}</Text>
            <Text style={styles.statLabel}>Min. carregando</Text>
          </View>
          <View style={[styles.statCard, styles.half]}>
            <Text style={styles.statIcon}>💸</Text>
            <Text style={styles.statVal}>{perfil?.saques ?? 0}</Text>
            <Text style={styles.statLabel}>Saques realizados</Text>
          </View>
        </Animated.View>

        <Animated.View style={[{ width: '100%', marginBottom: 16 }, d]}>
          <KastBanner uid={perfil?.uid} />
        </Animated.View>

        <Animated.View style={[{ width: '100%' }, d]}>
          <TouchableOpacity
            style={[styles.saqueBtn, user && !podeSacar && styles.saqueBtnDisabled, !user && styles.saqueBtnGuest]}
            onPress={handleSaque}
            activeOpacity={0.85}>
            <Text style={[styles.saqueBtnText, !user && { color: colors.primary }]}>
              {user ? '💰 Solicitar Saque' : '🔑 Entrar para sacar'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.saqueInfo}>Saque em Pix a partir de 100 mil pontos</Text>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 32 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerLeft: {},
    saudacao: { fontSize: 14, color: colors.secondary },
    nome: { fontSize: 24, fontWeight: 'bold', color: colors.white },

    loginBtn: { alignItems: 'center' },
    loginBtnCircle: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: colors.card,
      borderWidth: 2, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    loginBtnIcon: { fontSize: 20 },
    loginBtnLabel: { fontSize: 10, color: colors.primary, fontWeight: '600', marginTop: 3 },

    mainCard: { backgroundColor: colors.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    mainCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    mainLabel: { fontSize: 13, color: colors.secondary },
    badge: { backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.primary },
    badgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
    pontos: { fontSize: 52, fontWeight: 'bold', color: colors.primary, marginBottom: 16, letterSpacing: -1 },
    progressBg: { backgroundColor: colors.border, borderRadius: 8, height: 8, marginBottom: 8, overflow: 'hidden' },
    progressFill: { backgroundColor: colors.primary, height: 8, borderRadius: 8 },
    progressInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressLabel: { fontSize: 12, color: colors.secondary, flex: 1 },
    progressPct: { fontSize: 12, color: colors.primary, fontWeight: 'bold' },

    row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    half: { flex: 1 },
    statCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    statIcon: { fontSize: 22, marginBottom: 6 },
    statVal: { fontSize: 28, fontWeight: 'bold', color: colors.primary },
    statLabel: { fontSize: 11, color: colors.secondary, marginTop: 4, textAlign: 'center' },

    saqueBtn: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 8 },
    saqueBtnDisabled: { opacity: 0.4 },
    saqueBtnGuest: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary },
    saqueBtnText: { color: colors.background, fontWeight: 'bold', fontSize: 16 },
    saqueInfo: { fontSize: 11, color: colors.secondary, textAlign: 'center', marginBottom: 16 },
  });
}
