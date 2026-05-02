import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, Image, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, RefreshControl, Modal, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, Easing, interpolate,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import * as Battery from 'expo-battery';
import {
  Bell, ArrowUpRight, ArrowDownLeft,
  Gift, Wallet, Activity, Zap, Database, Cpu,
} from 'lucide-react-native';
import Avatar from '../components/Avatar';
import { diaKey, diaKeyDe } from '../utils/date';
import {
  notificacoesAtivas, agendarLembreteCarregamento,
  cancelarLembretes, abrirConfiguracoesSistema,
} from '../services/notificacoes';

import BannerCarousel from '../components/BannerCarousel';
import { getSaques, atualizarModo } from '../services/pontos';
import { useAccent } from '../context/AccentContext';
import { useTheme } from '../context/ThemeContext';

const PURPLE = '#c084fc';
import { onPontosUpdate } from '../services/chargeEvents';
import { useScreenTrace } from '../hooks/useScreenTrace';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIMARY  = '#c6ff4a';
const META     = 100000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function saudacaoKey() {
  const h = new Date().getHours();
  if (h < 12) return 'home.goodMorning';
  if (h < 18) return 'home.goodAfternoon';
  return 'home.goodEvening';
}

const FRASES_MOTIVACIONAIS = [
  'Vamos somar pontos hoje?',
  'Quero acumular mais pontos!',
  'Vou ver uma missão interessante hoje',
  'Cada carregada vale mais um passo',
  'Sua energia move o ranking',
  'Hora de subir na classificação!',
  'Que tal uma nova missão agora?',
  'Carregar é ganhar — bora lá!',
  'Mais um dia, mais pontos no bolso',
  'Você está a um carregamento do topo',
  'O ranking te espera. Vamos nessa?',
  'Seus pontos estão chamando!',
  'Hoje é um bom dia pra carregar',
  'Missões disponíveis — não perca!',
  'Pequenos passos, grandes pontos',
  'Carregue e suba no ranking',
  'Bora acumular e conquistar!',
  'Cada kWh conta. Vamos carregar?',
  'Seu saldo cresce a cada missão',
  'A liderança está ao seu alcance!',
];

function fraseDoDia() {
  const d = new Date();
  const seed = d.getFullYear() * 1000 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return FRASES_MOTIVACIONAIS[seed % FRASES_MOTIVACIONAIS.length];
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useEntrada(delayMs = 0) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(20);
  useEffect(() => {
    const cfg = { duration: 480, easing: Easing.out(Easing.cubic) };
    opacity.value    = withDelay(delayMs, withTiming(1, cfg));
    translateY.value = withDelay(delayMs, withTiming(0, cfg));
  }, []);
  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

function useCarregando() {
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    let sub;
    Battery.getBatteryStateAsync()
      .then(s => setCarregando(
        s === Battery.BatteryState.CHARGING || s === Battery.BatteryState.FULL
      ))
      .catch(() => {});
    sub = Battery.addBatteryStateListener(({ batteryState }) =>
      setCarregando(
        batteryState === Battery.BatteryState.CHARGING ||
        batteryState === Battery.BatteryState.FULL
      )
    );
    return () => sub?.remove();
  }, []);
  return carregando;
}

// ─── Dados estáticos (Figma) ──────────────────────────────────────────────────
const ATALHOS = [
  { Icon: Wallet,    label: 'Wallet',  id: 'wallet'  },
  { Icon: Activity,  label: 'DePIN',   id: 'depin'   },
  { Icon: Gift,      label: 'Airdrop', id: 'airdrop' },
  { Icon: Database,  label: 'Dados',   id: 'dados'   },
];

// Constrói lista de atividades reais a partir de saques + atividadeDias do perfil

async function buscarAtividades(uid, atividadeDias) {
  const items = [];

  // 1. Últimos saques (máx 3)
  try {
    const saques = await getSaques(uid);
    saques.slice(0, 3).forEach(s => {
      const ts = s.criadoEm?.toDate ? s.criadoEm.toDate() : new Date(0);
      const tipo = s.chavePix ? 'Saque PIX' : s.walletAddress ? 'Resgate CNB' : 'Saque';
      items.push({
        Icon: ArrowUpRight,
        title: tipo,
        sub: ts.getTime() ? ts.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'Em processamento',
        value: `-${(s.pontos ?? 0).toLocaleString('pt-BR')} pts`,
        pos: false,
        ts: ts.getTime(),
      });
    });
  } catch { /* silencia */ }

  // 2. Dias com atividade de carregamento (últimos 7 dias)
  const hoje = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    const pts = atividadeDias?.[diaKeyDe(d)] ?? 0;
    if (pts > 0) {
      const labelDia = i === 0 ? 'Hoje' : i === 1 ? 'Ontem' : d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
      items.push({
        Icon: ArrowDownLeft,
        title: 'Pontos de carregamento',
        sub: `${labelDia} · carregamento`,
        value: `+${pts.toLocaleString('pt-BR')} pts`,
        pos: true,
        ts: d.setHours(23, 59, 59),
      });
    }
  }

  // Ordena por data decrescente, limita a 5
  items.sort((a, b) => b.ts - a.ts);
  return items.slice(0, 5);
}

// ─── Componentes internos ─────────────────────────────────────────────────────

function AvatarHeader({ onPress, borderColor }) {
  const PRIMARY = useAccent();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        width: 40, height: 40, borderRadius: 20,
        borderWidth: 2, borderColor: borderColor ?? PRIMARY,
        overflow: 'hidden',
      }}
    >
      <Image
        source={require('../../assets/cnb-logo.png')}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
}

function CardPontos({ pontos, progresso, faltam, user, estaCarregando, onSaque, barStyle, pontosHoje }) {
  const PRIMARY = useAccent();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const pct = Math.round(progresso * 100);
  return (
    <LinearGradient
      // Card destacado: mantém gradient escuro mesmo em light pra preservar
      // identidade visual do brand "JUICE" (verde sobre fundo escuro)
      colors={isDark ? ['#182418', '#0c1410', '#070a07'] : ['#1a2818', '#0e1a10', '#0a1208']}
      locations={[0, 0.6, 1]}
      start={{ x: 0.05, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.primaryStrong,
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {/* Glows radiais — fiel ao Figma */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%">
          <Defs>
            <RadialGradient id="gTR" cx="1" cy="0" r="1" gradientUnits="objectBoundingBox">
              <Stop offset="0%"   stopColor="#c6ff4a" stopOpacity="0.18" />
              <Stop offset="70%"  stopColor="#c6ff4a" stopOpacity="0" />
              <Stop offset="100%" stopColor="#c6ff4a" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="gBL" cx="0" cy="1" r="0.9" gradientUnits="objectBoundingBox">
              <Stop offset="0%"   stopColor="#2ecc71" stopOpacity="0.12" />
              <Stop offset="70%"  stopColor="#2ecc71" stopOpacity="0" />
              <Stop offset="100%" stopColor="#2ecc71" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gTR)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gBL)" />
        </Svg>
      </View>

      {/* Topo: label + badge */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{t('home.yourPoints')}</Text>
        {estaCarregando && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: 'rgba(198,255,74,0.1)',
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
          }}>
            <Zap size={10} color={PRIMARY} strokeWidth={2.5} />
            <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '600' }}>{t('home.active')}</Text>
          </View>
        )}
      </View>

      {/* Valor de pontos */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8 }}>
        <Text style={{
          fontSize: 40, fontWeight: '600', color: PRIMARY,
          lineHeight: 44, letterSpacing: -1,
        }}>
          {pontos.toLocaleString('pt-BR')}
        </Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '500', marginBottom: 6 }}>pts</Text>
      </View>

      {/* Barra de progresso */}
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderRadius: 99, height: 8, marginTop: 16,
        overflow: 'hidden',
      }}>
        <Animated.View style={[{
          backgroundColor: PRIMARY, height: 8, borderRadius: 99,
        }, barStyle]} />
      </View>

      {/* Texto de progresso */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', flex: 1 }}>
          {!user
            ? t('home.loginToAccumulate')
            : faltam > 0
              ? t('home.pointsLeft', { count: faltam.toLocaleString('pt-BR') })
              : t('home.metReached')}
        </Text>
        {user && (
          <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '600' }}>{pct}%</Text>
        )}
      </View>

      {/* Botão CTA */}
      <TouchableOpacity
        onPress={onSaque}
        activeOpacity={0.85}
        style={{
          marginTop: 16, backgroundColor: PRIMARY,
          borderRadius: 12, paddingVertical: 10,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <ArrowUpRight size={14} color="#000" />
        <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' }}>{t('home.withdraw')}</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

function Atalhos({ onPress }) {
  const PRIMARY = useAccent();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
      {ATALHOS.map(({ Icon, label, id }) => (
        <TouchableOpacity
          key={id}
          onPress={() => onPress(id)}
          activeOpacity={0.75}
          style={{
            flex: 1,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1, borderColor: colors.borderStrong,
            borderRadius: 14, paddingVertical: 17,
            alignItems: 'center', gap: 7,
          }}
        >
          <Icon size={22} color={PRIMARY} />
          <Text style={{ fontSize: 10, color: colors.textMuted }}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Atividades({ atividades, loading }) {
  const PRIMARY = useAccent();
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('home.recentActivity')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />
      ) : atividades.length === 0 ? (
        <View style={{
          padding: 20, borderRadius: 12, alignItems: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1, borderColor: colors.borderSubtle,
        }}>
          <Text style={{ fontSize: 13, color: colors.textDim, textAlign: 'center' }}>
            {t('home.noActivity')}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textGhost, marginTop: 4, textAlign: 'center' }}>
            {t('home.noActivitySub')}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {atividades.map((it, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 12, borderRadius: 12,
                backgroundColor: colors.surface,
                borderWidth: 1, borderColor: colors.borderSubtle,
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: it.pos ? colors.primaryMid : colors.surfaceStrong,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <it.Icon size={16} color={it.pos ? PRIMARY : colors.textStrong} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text }} numberOfLines={1}>{it.title}</Text>
                <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 2 }} numberOfLines={1}>{it.sub}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: it.pos ? PRIMARY : colors.textStrong }}>
                {it.value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function HomeScreen({ route, navigation }) {
  useScreenTrace('home_screen');
  const PRIMARY = useAccent();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const { user, perfil, onAtualizar } = route?.params || {};
  const onAtualizarRef = useRef(onAtualizar);
  useEffect(() => { onAtualizarRef.current = onAtualizar; }, [onAtualizar]);

  const [frase] = useState(fraseDoDia);
  const [atividades, setAtividades]           = useState([]);
  const [loadingAtividades, setLoadingAtiv]   = useState(false);
  const [refreshing, setRefreshing]           = useState(false);
  // Sincroniza pontos com o Firestore a cada tick do carregamento.
  // Aguarda 2s após o evento para garantir que o serviço já escreveu no Firestore.
  useEffect(() => {
    let timer;
    const unsub = onPontosUpdate(() => {
      clearTimeout(timer);
      timer = setTimeout(() => onAtualizarRef.current?.(), 2000);
    });
    return () => { unsub(); clearTimeout(timer); };
  }, []);

  const [focused, setFocused] = useState(true);
  const [modalNotif, setModalNotif]           = useState(false);
  const [notifAtiva, setNotifAtiva]           = useState(false);
  const [loadingNotif, setLoadingNotif]       = useState(false);
  const [modalPerfil, setModalPerfil]         = useState(false);

  // Verifica status de notificações ao abrir o modal
  async function abrirModalNotif() {
    const ativa = await notificacoesAtivas();
    setNotifAtiva(ativa);
    setModalNotif(true);
  }

  async function escolherModo(novo) {
    if (!perfil?.uid) return;
    try { await atualizarModo(perfil.uid, novo); } catch {}
    setModalPerfil(false);
  }

  async function handleToggleNotif(valor) {
    setLoadingNotif(true);
    try {
      if (valor) {
        const { status } = await import('expo-notifications')
          .then(n => n.requestPermissionsAsync());
        if (status === 'granted') {
          await agendarLembreteCarregamento();
          setNotifAtiva(true);
        } else {
          Alert.alert(
            'Permissão negada',
            'Abra as configurações do sistema para habilitar notificações.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Abrir configurações', onPress: abrirConfiguracoesSistema },
            ]
          );
        }
      } else {
        await cancelarLembretes();
        setNotifAtiva(false);
      }
    } finally {
      setLoadingNotif(false);
    }
  }
  useFocusEffect(useCallback(() => {
    setFocused(true);
    if (user) onAtualizarRef.current?.();
    return () => setFocused(false);
  }, [user]));

  // Busca atividades reais sempre que o perfil muda (pontos ou saques)
  useEffect(() => {
    if (!perfil?.uid) { setAtividades([]); return; }
    setLoadingAtiv(true);
    buscarAtividades(perfil.uid, perfil.atividadeDias)
      .then(setAtividades)
      .catch(() => setAtividades([]))
      .finally(() => setLoadingAtiv(false));
  }, [perfil?.uid, perfil?.pontos]);

  const pontos    = perfil?.pontos ?? 0;
  const progresso = Math.min(pontos / META, 1);
  const faltam    = Math.max(META - pontos, 0);
  const podeSacar = pontos >= META;
  const nome      = perfil?.nome?.split(' ')[0] ?? (user ? t('common.user') : 'Visitante');
  const estaCarregando = useCarregando();

  // Badge dinâmico: pontos ganhos hoje vs ontem
  const _hoje = new Date();
  const _ontem = new Date(_hoje); _ontem.setDate(_ontem.getDate() - 1);
  const pontosHoje   = perfil?.atividadeDias?.[diaKeyDe(_hoje)]  ?? 0;
  const pontosOntem  = perfil?.atividadeDias?.[diaKeyDe(_ontem)] ?? 0;
  const variacaoDia  = pontosOntem > 0
    ? (Math.abs(pontosHoje - pontosOntem) / pontosOntem * 100).toFixed(1)
    : null;

  // Barra de progresso animada
  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withDelay(300, withTiming(progresso, { duration: 900 }));
  }, [pontos]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${interpolate(barWidth.value, [0, 1], [0, 100])}%`,
  }));

  // Animações de entrada escalonadas
  const a0 = useEntrada(0);
  const a1 = useEntrada(60);
  const a2 = useEntrada(120);
  const a3 = useEntrada(180);
  const a4 = useEntrada(240);

  // Handlers de navegação
  function handleSaque() {
    if (!user) return navigation.navigate('Login');
    if (!podeSacar) return Alert.alert(t('home.insufficientPoints'), t('home.insufficientPointsMsg'));
    navigation.navigate('Withdraw', { perfil });
  }

  async function handleRefresh() {
    setRefreshing(true);
    await onAtualizarRef.current?.();
    setRefreshing(false);
  }

  function handleAtalho(id) {
    if (id === 'airdrop') return navigation.navigate('Airdrop', { perfil });
    if (id === 'depin')   return navigation.navigate('DePINInfo');
    if (id === 'wallet')  return navigation.navigate('Wallet', { user: perfil });
    if (id === 'dados')   return navigation.navigate('Dados');
  }

  // Background gradient — adapta ao tema
  const bgGradient = isDark
    ? ['#0b1310', '#0a0f0d', '#000000']
    : [colors.background, '#E7ECF1', '#DAE2EA'];

  return (
    <LinearGradient
      colors={bgGradient}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      {/* ── Modal de perfil (Lite / Tech) ── */}
      <Modal visible={modalPerfil} animationType="slide" transparent onRequestClose={() => setModalPerfil(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setModalPerfil(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={{
              backgroundColor: isDark ? '#090909' : colors.modalBg,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              padding: 24, paddingBottom: 48,
              borderWidth: 1, borderColor: colors.border,
            }}>
              {/* Handle */}
              <View style={{
                width: 40, height: 4, borderRadius: 2,
                backgroundColor: colors.borderStrong,
                alignSelf: 'center', marginBottom: 24,
              }} />

              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                Qual é o seu perfil?
              </Text>
              <Text style={{ fontSize: 13, color: colors.textFaint, marginBottom: 24, lineHeight: 19 }}>
                Personalize como o JUICE funciona para você
              </Text>

              {/* ── LITE ── */}
              <TouchableOpacity
                onPress={() => escolherModo('lite')}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 16,
                  backgroundColor: 'rgba(192,132,252,0.04)',
                  borderWidth: perfil?.modo === 'lite' ? 2 : 1.5,
                  borderColor: perfil?.modo === 'lite' ? PURPLE : 'rgba(192,132,252,0.28)',
                  borderRadius: 20, padding: 18, marginBottom: 12,
                }}
              >
                <View style={{
                  width: 52, height: 52, borderRadius: 26,
                  backgroundColor: 'rgba(192,132,252,0.10)',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Cpu size={24} color="#c084fc" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Lite</Text>
                    <View style={{
                      backgroundColor: 'rgba(192,132,252,0.12)',
                      borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                      borderWidth: 1, borderColor: 'rgba(192,132,252,0.30)',
                    }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#c084fc', letterSpacing: 1.2 }}>LITE</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textFaint, lineHeight: 18 }}>
                    Sou novo em Tecnologia — ouvi falar que é só colocar para carregar e ganhar
                  </Text>
                </View>
              </TouchableOpacity>

              {/* ── TECH ── */}
              <TouchableOpacity
                onPress={() => escolherModo('tech')}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 16,
                  backgroundColor: colors.primarySoft,
                  borderWidth: perfil?.modo === 'tech' ? 2 : 1.5,
                  borderColor: perfil?.modo === 'tech' ? PRIMARY : colors.primaryStrong,
                  borderRadius: 20, padding: 18,
                }}
              >
                <View style={{
                  width: 52, height: 52, borderRadius: 26,
                  backgroundColor: colors.primaryMid,
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Zap size={24} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Tech</Text>
                    <View style={{
                      backgroundColor: colors.primaryMid,
                      borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                      borderWidth: 1, borderColor: colors.primaryStrong,
                    }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: PRIMARY, letterSpacing: 1.2 }}>TECH</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textFaint, lineHeight: 18 }}>
                    Avançado em Tech — quero performar e me sinto confiante para utilizar todas as funções
                  </Text>
                </View>
              </TouchableOpacity>

            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal de notificações ── */}
      <Modal visible={modalNotif} animationType="slide" transparent onRequestClose={() => setModalNotif(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setModalNotif(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={{
              backgroundColor: isDark ? '#0d1a0d' : colors.modalBg,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              padding: 24, paddingBottom: 40,
              borderWidth: 1, borderColor: colors.primaryMid,
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                Notificações
              </Text>
              <Text style={{ fontSize: 12, color: colors.textFaint, marginBottom: 24 }}>
                Gerencie os alertas do JUICE
              </Text>

              {/* Toggle lembrete diário */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: colors.surfaceAlt,
                borderRadius: 14, padding: 16, marginBottom: 10,
                borderWidth: 1, borderColor: colors.border,
              }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 2 }}>
                    Lembrete diário de carregamento
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textFaint }}>
                    Aviso às 20h se você ainda não carregou hoje
                  </Text>
                </View>
                {loadingNotif
                  ? <ActivityIndicator size="small" color={PRIMARY} />
                  : <Switch
                      value={notifAtiva}
                      onValueChange={handleToggleNotif}
                      trackColor={{ false: colors.surfaceStrong, true: colors.primaryGlow }}
                      thumbColor={notifAtiva ? PRIMARY : '#fff'}
                    />
                }
              </View>

              {/* Linha informativa: alertas de pontos e missões */}
              <View style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: 14, padding: 16,
                borderWidth: 1, borderColor: colors.border,
              }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 2 }}>
                  Alertas de pontos e missões
                </Text>
                <Text style={{ fontSize: 11, color: colors.textFaint }}>
                  Enviados pelo servidor quando você completa uma missão ou recebe um bônus
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
        >

          {/* ── Header ── */}
          <Animated.View style={[
            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
            a0,
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AvatarHeader
                onPress={() => setModalPerfil(true)}
                borderColor={perfil?.modo === 'lite' ? PURPLE : PRIMARY}
              />
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  {t(saudacaoKey())}, {nome}!
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  {frase}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={abrirModalNotif}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1, borderColor: notifAtiva
                  ? 'rgba(198,255,74,0.35)'
                  : colors.borderStrong,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Bell size={16} color={notifAtiva ? PRIMARY : colors.textStrong} />
            </TouchableOpacity>
          </Animated.View>

          {/* ── Card de Pontos ── */}
          <Animated.View style={a1}>
            <CardPontos
              pontos={pontos}
              progresso={progresso}
              faltam={faltam}
              user={user}
              estaCarregando={estaCarregando}
              onSaque={handleSaque}
              barStyle={barStyle}
              pontosHoje={pontosHoje}
              modo={perfil?.modo}
            />
          </Animated.View>

          {/* ── Atalhos rápidos (somente Tech) ── */}
          {perfil?.modo !== 'lite' && (
            <Animated.View style={a2}>
              <Atalhos onPress={handleAtalho} />
            </Animated.View>
          )}



          {/* ── Banners (carousel) ── */}
          <Animated.View style={[{ marginBottom: 20 }, a3]}>
            <Text style={{ fontSize: 10, letterSpacing: 2, color: colors.textFaint, textTransform: 'uppercase', marginBottom: 8 }}>
              Parceiros
            </Text>
            <BannerCarousel uid={perfil?.uid} />
          </Animated.View>

          {/* ── Atividades ── */}
          <Animated.View style={a4}>
            <Atividades
              atividades={atividades}
              loading={loadingAtividades}
            />
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
