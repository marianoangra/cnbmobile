import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import BannerAd from '../components/BannerAd';
import AdmobBanner from '../components/AdmobBanner';
import Avatar from '../components/Avatar';

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

function loginHoje(ultimoLogin) {
  if (!ultimoLogin) return false;
  const d = ultimoLogin.toDate ? ultimoLogin.toDate() : new Date(ultimoLogin);
  const hoje = new Date();
  return d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
}

export default function HomeScreen({ route, navigation }) {
  const { perfil } = route.params || {};
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
  const e = useEntrada(320);

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const nome = perfil?.nome?.split(' ')[0] ?? 'Usuário';

  function handleBannerPress(id) {
    if (id === 'convite' || id === 'whatsapp') navigation.navigate('Perfil');
    else if (id === 'ranking') navigation.navigate('Ranking', { uid: perfil?.uid, perfil });
    else if (id === 'carregar') navigation.navigate('Carregar');
  }
  const loginFeitoHoje = loginHoje(perfil?.ultimoLogin);
  const temAfiliados = (perfil?.referidos ?? 0) > 0;
  const podeSacar = pontos >= META;

  function handleSaque() {
    if (!podeSacar) return Alert.alert('Pontos insuficientes', 'Você precisa de 100.000 pts para sacar.');
    navigation.navigate('Perfil');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Cabeçalho */}
      <Animated.View style={[styles.header, a]}>
        <View style={styles.headerLeft}>
          <Text style={styles.saudacao}>{saudacao()},</Text>
          <Text style={styles.nome}>{nome} 👋</Text>
        </View>
        <Avatar uri={perfil?.avatarURL} nome={perfil?.nome} size={46} borderColor={colors.primary} />
      </Animated.View>

      {/* Banner promocional */}
      <Animated.View style={[{ marginBottom: 16 }, b]}>
        <BannerAd onPress={handleBannerPress} />
      </Animated.View>

      {/* Anúncio AdMob */}
      <AdmobBanner />

      {/* Card de pontos */}
      <Animated.View style={[styles.mainCard, b]}>
        <View style={styles.mainCardTop}>
          <Text style={styles.mainLabel}>Seus Pontos</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>⚡ Ativo</Text>
          </View>
        </View>
        <Text style={styles.pontos}>{pontos.toLocaleString('pt-BR')}</Text>

        <View style={styles.progressBg}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>
            {faltam > 0 ? `Faltam ${faltam.toLocaleString('pt-BR')} pts para saque` : '🎉 Você pode sacar agora!'}
          </Text>
          <Text style={styles.progressPct}>{Math.round(progresso * 100)}%</Text>
        </View>
      </Animated.View>

      {/* Stats */}
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

      {/* Botão Saque */}
      <Animated.View style={[{ width: '100%' }, d]}>
        <TouchableOpacity
          style={[styles.saqueBtn, !podeSacar && styles.saqueBtnDisabled]}
          onPress={handleSaque}
          activeOpacity={0.85}>
          <Text style={styles.saqueBtnText}>💰 Solicitar Saque</Text>
        </TouchableOpacity>
        <Text style={styles.saqueInfo}>Saque em Pix a partir de 100 mil pontos</Text>
      </Animated.View>



    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 32 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: {},
  saudacao: { fontSize: 14, color: colors.secondary },
  nome: { fontSize: 24, fontWeight: 'bold', color: colors.white },

  mainCard: { backgroundColor: colors.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1a3a1a' },
  mainCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  mainLabel: { fontSize: 13, color: colors.secondary },
  badge: { backgroundColor: '#0d2a0d', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.primary },
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
  saqueBtnText: { color: colors.background, fontWeight: 'bold', fontSize: 16 },
  saqueInfo: { fontSize: 11, color: colors.secondary, textAlign: 'center', marginBottom: 16 },
});
