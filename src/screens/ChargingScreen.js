import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useCarregamento } from '../hooks/useCarregamento';

function formatarTempo(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ChargingScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, uid, onAtualizar } = route.params || {};

  const { carregando, pontosGanhos, segundosRestantes } = useCarregamento(uid, onAtualizar);

  const pulse = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const entradaOpacity = useRef(new Animated.Value(0)).current;
  const entradaY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entradaOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(entradaY, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!carregando) {
      pulse.setValue(1);
      glowOpacity.setValue(0.3);
      return;
    }
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.15, duration: 700, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.05, duration: 700, useNativeDriver: true }),
      ])
    );
    pulseAnim.start();
    glowAnim.start();
    return () => { pulseAnim.stop(); glowAnim.stop(); };
  }, [carregando]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.View style={[styles.loginGate, { opacity: entradaOpacity, transform: [{ translateY: entradaY }] }]}>
          <View style={styles.loginGateCircle}>
            <Text style={styles.loginGateIcon}>🔌</Text>
          </View>
          <Text style={styles.loginGateTitle}>Faça login para ganhar pontos</Text>
          <Text style={styles.loginGateSub}>
            Conecte-se à sua conta e acumule pontos reais enquanto carrega seu celular.
          </Text>
          <TouchableOpacity
            style={styles.loginGateBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}>
            <Text style={styles.loginGateBtnText}>Entrar / Cadastrar</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const progBonus = 1 - segundosRestantes / 3600;
  const minRestantes = Math.ceil(segundosRestantes / 60);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Animated.View style={[styles.container, { opacity: entradaOpacity, transform: [{ translateY: entradaY }] }]}>

        <View style={styles.circleArea}>
          <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />
          <Animated.View style={[styles.circle, { transform: [{ scale: pulse }] }]}>
            <Text style={styles.icon}>{carregando ? '⚡' : '🔌'}</Text>
          </Animated.View>
        </View>

        <Text style={styles.status}>{carregando ? 'Carregando' : 'Desconectado'}</Text>
        <Text style={styles.sub}>
          {carregando ? 'Você está ganhando pontos!' : 'Conecte o cabo USB para começar.'}
        </Text>

        {carregando && (
          <>
            <View style={styles.row}>
              <View style={[styles.card, styles.half]}>
                <Text style={styles.cardLabel}>Sessão atual</Text>
                <Text style={styles.cardVal}>+{pontosGanhos.toLocaleString('pt-BR')}</Text>
                <Text style={styles.cardSub}>pontos</Text>
              </View>
              <View style={[styles.card, styles.half, styles.bonusCard]}>
                <Text style={styles.cardLabel}>🎁 Próximo bônus</Text>
                <Text style={[styles.cardVal, styles.timerText]}>{formatarTempo(segundosRestantes)}</Text>
                <Text style={styles.cardSub}>{minRestantes} min restantes</Text>
              </View>
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Progresso para o bônus</Text>
                <Text style={styles.progressPct}>{Math.round(progBonus * 100)}%</Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${Math.round(progBonus * 100)}%` }]} />
              </View>
            </View>
          </>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Como ganhar pontos</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>⚡</Text>
            <Text style={styles.infoText}>+10 pts por minuto carregando</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🎁</Text>
            <Text style={styles.infoText}>+50 pts bônus a cada hora completa</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📅</Text>
            <Text style={styles.infoText}>+10 pts por login diário</Text>
          </View>
          <View style={[styles.infoRow, { marginBottom: 0 }]}>
            <Text style={styles.infoIcon}>👥</Text>
            <Text style={styles.infoText}>+100 pts por amigo indicado</Text>
          </View>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 20 },

    loginGate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    loginGateCircle: {
      width: 130, height: 130, borderRadius: 65,
      backgroundColor: colors.card,
      borderWidth: 2.5, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 32,
    },
    loginGateIcon: { fontSize: 52 },
    loginGateTitle: { fontSize: 22, fontWeight: 'bold', color: colors.white, textAlign: 'center', marginBottom: 12 },
    loginGateSub: { fontSize: 15, color: colors.secondary, textAlign: 'center', lineHeight: 22, marginBottom: 36 },
    loginGateBtn: {
      backgroundColor: colors.primary, borderRadius: 16,
      paddingVertical: 16, paddingHorizontal: 48,
      width: '100%', alignItems: 'center',
    },
    loginGateBtnText: { color: colors.background, fontWeight: 'bold', fontSize: 17 },

    circleArea: { alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    glowRing: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: colors.primary },
    circle: {
      width: 130, height: 130, borderRadius: 65,
      backgroundColor: colors.card,
      borderWidth: 2.5, borderColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    icon: { fontSize: 52 },

    status: { fontSize: 26, fontWeight: 'bold', color: colors.white, marginBottom: 6 },
    sub: { fontSize: 14, color: colors.secondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 },

    row: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 12 },
    half: { flex: 1 },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    bonusCard: { borderColor: colors.border, backgroundColor: colors.card },
    cardLabel: { fontSize: 11, color: colors.secondary, marginBottom: 4, textAlign: 'center' },
    cardVal: { fontSize: 28, fontWeight: 'bold', color: colors.primary },
    timerText: { fontSize: 26 },
    cardSub: { fontSize: 11, color: colors.secondary, marginTop: 2 },

    progressCard: { backgroundColor: colors.card, borderRadius: 14, padding: 14, width: '100%', marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressLabel: { fontSize: 13, color: colors.secondary },
    progressPct: { fontSize: 13, color: colors.primary, fontWeight: 'bold' },
    progressBg: { backgroundColor: colors.border, borderRadius: 6, height: 6, overflow: 'hidden' },
    progressFill: { backgroundColor: colors.primary, height: 6, borderRadius: 6 },

    infoCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, width: '100%', borderWidth: 1, borderColor: colors.border },
    infoTitle: { fontSize: 14, fontWeight: 'bold', color: colors.white, marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    infoIcon: { fontSize: 18, width: 24, textAlign: 'center' },
    infoText: { fontSize: 14, color: colors.secondary },
  });
}
