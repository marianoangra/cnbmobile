import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
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
  QrCode, Wallet, Activity, BarChart3, Zap, Database,
} from 'lucide-react-native';
import Avatar from '../components/Avatar';
import { diaKey, diaKeyDe } from '../utils/date';
import {
  notificacoesAtivas, agendarLembreteCarregamento,
  cancelarLembretes, abrirConfiguracoesSistema,
} from '../services/notificacoes';

import BannerCarousel from '../components/BannerCarousel';
import { getSaques } from '../services/pontos';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIMARY  = '#c6ff4a';
const META     = 100000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
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
  { Icon: Wallet,    label: 'Wallet',  id: 'wallet' },
  { Icon: Activity,  label: 'DePIN',   id: 'depin'  },
  { Icon: QrCode,    label: 'Comprar', id: 'pix'    },
  { Icon: Database,  label: 'Dados',   id: 'dados'  },
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

function AvatarHeader({ user, perfil }) {
  const inicial = (perfil?.nome ?? 'U').charAt(0).toUpperCase();

  if (user && perfil?.avatarURL) {
    return <Avatar uri={perfil.avatarURL} nome={perfil.nome} size={40} borderColor={PRIMARY} />;
  }

  return (
    <LinearGradient
      colors={['#a6ff3d', '#2ecc71']}
      start={{ x: 0.13, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>{inicial}</Text>
    </LinearGradient>
  );
}

function CardPontos({ pontos, progresso, faltam, user, estaCarregando, onSaque, onPix, barStyle, pontosHoje }) {
  const pct = Math.round(progresso * 100);
  return (
    <LinearGradient
      colors={['#182418', '#0c1410', '#070a07']}
      locations={[0, 0.6, 1]}
      start={{ x: 0.05, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(198,255,74,0.25)',
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
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Seus pontos</Text>
        {estaCarregando ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: 'rgba(198,255,74,0.1)',
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
          }}>
            <Zap size={10} color={PRIMARY} strokeWidth={2.5} />
            <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '600' }}>Ativo</Text>
          </View>
        ) : user ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 2,
            backgroundColor: 'rgba(255,255,255,0.07)',
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
          }}>
            <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '700' }}>{pct}%</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}> da meta</Text>
          </View>
        ) : null}
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
            ? 'Entre para acumular pontos'
            : faltam > 0
              ? `Faltam ${faltam.toLocaleString('pt-BR')} pts para saque`
              : 'Meta atingida — disponível para saque'}
        </Text>
        {user && (
          <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '600' }}>{pct}%</Text>
        )}
      </View>

      {/* Botões CTA */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <TouchableOpacity
          onPress={onSaque}
          activeOpacity={0.85}
          style={{
            flex: 1, backgroundColor: PRIMARY,
            borderRadius: 12, paddingVertical: 10,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <ArrowUpRight size={14} color="#000" />
          <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' }}>Saque</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPix}
          activeOpacity={0.85}
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
            borderRadius: 12, paddingVertical: 10,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Wallet size={14} color="rgba(255,255,255,0.8)" />
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>CNB Privado</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

function Atalhos({ onPress }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
      {ATALHOS.map(({ Icon, label, id }) => (
        <TouchableOpacity
          key={id}
          onPress={() => onPress(id)}
          activeOpacity={0.75}
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
            borderRadius: 14, paddingVertical: 17,
            alignItems: 'center', gap: 7,
          }}
        >
          <Icon size={22} color={PRIMARY} />
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Atividades({ atividades, loading }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Atividades recentes</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />
      ) : atividades.length === 0 ? (
        <View style={{
          padding: 20, borderRadius: 12, alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
        }}>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
            Nenhuma atividade ainda
          </Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, textAlign: 'center' }}>
            Carregue seu celular para acumular pontos
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {atividades.map((t, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 12, borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: t.pos ? 'rgba(198,255,74,0.15)' : 'rgba(255,255,255,0.10)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <t.Icon size={16} color={t.pos ? PRIMARY : 'rgba(255,255,255,0.8)'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#fff' }} numberOfLines={1}>{t.title}</Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }} numberOfLines={1}>{t.sub}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: t.pos ? PRIMARY : 'rgba(255,255,255,0.8)' }}>
                {t.value}
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
  const { user, perfil, onAtualizar } = route?.params || {};
  const onAtualizarRef = useRef(onAtualizar);
  useEffect(() => { onAtualizarRef.current = onAtualizar; }, [onAtualizar]);

  const [frase] = useState(fraseDoDia);
  const [atividades, setAtividades]           = useState([]);
  const [loadingAtividades, setLoadingAtiv]   = useState(false);
  const [refreshing, setRefreshing]           = useState(false);

  const [focused, setFocused] = useState(true);
  const [modalNotif, setModalNotif]           = useState(false);
  const [notifAtiva, setNotifAtiva]           = useState(false);
  const [loadingNotif, setLoadingNotif]       = useState(false);

  // Verifica status de notificações ao abrir o modal
  async function abrirModalNotif() {
    const ativa = await notificacoesAtivas();
    setNotifAtiva(ativa);
    setModalNotif(true);
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
  const nome      = perfil?.nome?.split(' ')[0] ?? (user ? 'Usuário' : 'Visitante');
  const estaCarregando = useCarregando();

  // Badge dinâmico: pontos ganhos hoje vs ontem
  const _hoje = new Date();
  const pontosHoje = perfil?.atividadeDias?.[diaKeyDe(_hoje)] ?? 0;

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
    if (!podeSacar) return Alert.alert('Pontos insuficientes', 'Você precisa de 100.000 pts para sacar.');
    navigation.navigate('Withdraw', { perfil });
  }

  async function handleRefresh() {
    setRefreshing(true);
    await onAtualizarRef.current?.();
    setRefreshing(false);
  }

  function handlePrivado() {
    if (!user) return navigation.navigate('Login');
    navigation.navigate('Withdraw', { perfil, initialAba: 'privado' });
  }

  function handleAtalho(id) {
    if (id === 'pix')    return navigation.navigate('BuyTokens');
    if (id === 'depin')  return navigation.navigate('DePINInfo');
    if (id === 'wallet') return navigation.navigate('Wallet', { user: perfil });
    if (id === 'dados')  return navigation.navigate('Dados');
  }

  return (
    <LinearGradient
      colors={['#0b1310', '#0a0f0d', '#000000']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      {/* ── Modal de notificações ── */}
      <Modal visible={modalNotif} animationType="slide" transparent onRequestClose={() => setModalNotif(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setModalNotif(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={{
              backgroundColor: '#0d1a0d',
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              padding: 24, paddingBottom: 40,
              borderWidth: 1, borderColor: 'rgba(198,255,74,0.12)',
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
                Notificações
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
                Gerencie os alertas do CNB Mobile
              </Text>

              {/* Toggle lembrete diário */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: 14, padding: 16, marginBottom: 10,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
              }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 2 }}>
                    Lembrete diário de carregamento
                  </Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    Aviso às 20h se você ainda não carregou hoje
                  </Text>
                </View>
                {loadingNotif
                  ? <ActivityIndicator size="small" color={PRIMARY} />
                  : <Switch
                      value={notifAtiva}
                      onValueChange={handleToggleNotif}
                      trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(198,255,74,0.5)' }}
                      thumbColor={notifAtiva ? PRIMARY : '#fff'}
                    />
                }
              </View>

              {/* Linha informativa: alertas de pontos e missões */}
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: 14, padding: 16,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
              }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 2 }}>
                  Alertas de pontos e missões
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
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
              <AvatarHeader user={user} perfil={perfil} />
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                  {saudacao()}, {nome}!
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                  {frase}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={abrirModalNotif}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: notifAtiva
                  ? 'rgba(198,255,74,0.35)'
                  : 'rgba(255,255,255,0.10)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Bell size={16} color={notifAtiva ? PRIMARY : 'rgba(255,255,255,0.8)'} />
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
              onPix={handlePrivado}
              barStyle={barStyle}
              pontosHoje={pontosHoje}
            />
          </Animated.View>

          {/* ── Atalhos rápidos ── */}
          <Animated.View style={a2}>
            <Atalhos onPress={handleAtalho} />
          </Animated.View>



          {/* ── Banners (carousel) ── */}
          <Animated.View style={[{ marginBottom: 20 }, a3]}>
            <Text style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 8 }}>
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
