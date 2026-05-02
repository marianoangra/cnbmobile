import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { limparSessao } from '../services/session';
import { getSaques, excluirConta, getAfiliados, processarIndicacao, getPosicaoRanking } from '../services/pontos';
import { registrarTokenPush } from '../services/notificacoes';
import Avatar from '../components/Avatar';
import {
  Wallet, Share2, Copy, LogOut,
  ChevronRight, Shield, Bell, Settings, Award, User, Users, Database, Inbox, Cpu, Zap,
} from 'lucide-react-native';
import { useAccent } from '../context/AccentContext';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIMARY = '#c6ff4a';
const PURPLE  = '#c084fc';

const NIVEIS = [
  { min: 0,      label: 'Starter',   cor: '#8A9BB0' },
  { min: 1000,   label: 'Collector', cor: '#4FC3F7' },
  { min: 10000,  label: 'Earner',    cor: '#81C784' },
  { min: 50000,  label: 'Miner',     cor: PRIMARY   },
  { min: 100000, label: 'Validator', cor: '#FFD700' },
];

function calcularNivel(pontos) {
  let nivel = NIVEIS[0];
  for (const n of NIVEIS) {
    if (pontos >= n.min) nivel = n;
    else break;
  }
  return nivel;
}

const STATUS_LABEL = { pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado' };
const STATUS_COLOR = { pendente: '#F5A623', aprovado: PRIMARY, rejeitado: '#FF4444' };

// ─── Hook de entrada ──────────────────────────────────────────────────────────
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

// ─── Componentes internos ─────────────────────────────────────────────────────
function NivelBadge({ pontos }) {
  const nivel = calcularNivel(pontos);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
      borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: nivel.cor }} />
      <Text style={{ fontSize: 14, color: nivel.cor, fontWeight: '600' }}>
        {nivel.label}
      </Text>
    </View>
  );
}

function StatBox({ label, value, cor }) {
  return (
    <View style={{
      flex: 1, alignItems: 'center', paddingVertical: 14,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
      borderRadius: 14,
    }}>
      <Text style={{ fontSize: 29, fontWeight: '700', color: cor ?? '#fff' }}>{value}</Text>
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{label}</Text>
    </View>
  );
}

function MenuItem({ Icon, title, sub, onPress, danger }) {
  const PRIMARY = useAccent();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: danger ? 'rgba(255,68,68,0.1)' : 'rgba(198,255,74,0.1)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={danger ? '#FF4444' : PRIMARY} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, color: danger ? '#FF4444' : '#fff', fontWeight: '500' }}>{title}</Text>
        {sub && <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{sub}</Text>}
      </View>
      {!danger && <ChevronRight size={16} color="rgba(255,255,255,0.3)" />}
    </TouchableOpacity>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function ProfileScreen({ route, navigation }) {
  const PRIMARY = useAccent();
  const { t } = useTranslation();
  const { user, perfil, onAtualizar, atualizarPerfil } = route?.params || {};

  const [saques, setSaques]               = useState([]);
  const [loadingSaques, setLoadingSaques] = useState(true);
  const [afiliados, setAfiliados]         = useState({ codigo: '', total: 0, ativas: 0, bonus5k: false, bonus10k: false });
  const [perfilLocal, setPerfilLocal]     = useState(perfil);
  const [minhaPos, setMinhaPos]           = useState(null);
  const [codigoParaAplicar, setCodigo]    = useState('');
  const [aplicandoCodigo, setAplicando]   = useState(false);
  const [notifAtivas, setNotifAtivas]     = useState(true);
  const afiliadosCacheRef = useRef({ data: null, ts: 0 });
  const CACHE_TTL = 5 * 60 * 1000;

  // Carrega preferência de notificações salva
  useEffect(() => {
    AsyncStorage.getItem('@cnb_notif_desabilitadas')
      .then(v => { if (v === 'true') setNotifAtivas(false); })
      .catch(() => {});
  }, []);

  useEffect(() => { if (perfil) setPerfilLocal(perfil); }, [perfil]);

  const a0 = useEntrada(0);
  const a1 = useEntrada(80);
  const a2 = useEntrada(160);
  const a3 = useEntrada(240);

  useEffect(() => {
    if (!perfil?.uid) return;
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000));
    Promise.race([getSaques(perfil.uid), timeout])
      .then(setSaques)
      .catch(() => setSaques([]))
      .finally(() => setLoadingSaques(false));
  }, [perfil?.uid]);

  useEffect(() => {
    if (!perfil?.uid) return;
    getPosicaoRanking(perfil.uid)
      .then(pos => { if (pos) setMinhaPos(pos); })
      .catch(() => {});
  }, [perfil?.uid]);

  useFocusEffect(useCallback(() => {
    if (!perfil?.uid) return;
    let active = true;
    onAtualizar?.();
    const now = Date.now();
    if (afiliadosCacheRef.current.data && (now - afiliadosCacheRef.current.ts) < CACHE_TTL) {
      setAfiliados(afiliadosCacheRef.current.data);
      return;
    }
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000));
    Promise.race([getAfiliados(perfil.uid), timeout])
      .then(data => {
        if (active) {
          afiliadosCacheRef.current = { data, ts: Date.now() };
          setAfiliados(data);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [perfil?.uid]));

  async function handleNotificacoes() {
    const { status } = await Notifications.getPermissionsAsync().catch(() => ({ status: 'denied' }));
    if (status !== 'granted') {
      const { status: novo } = await Notifications.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
      if (novo === 'granted') {
        await AsyncStorage.removeItem('@cnb_notif_desabilitadas').catch(() => {});
        setNotifAtivas(true);
        if (perfil?.uid) registrarTokenPush(perfil.uid).catch(() => {});
        Alert.alert(t('profile.notifEnabled'), t('profile.notifEnabledMsg'));
      } else {
        Alert.alert(t('profile.notifPermRequired'), t('profile.notifPermMsg'));
      }
    } else if (notifAtivas) {
      Alert.alert(
        t('profile.notifPermRequired'),
        t('profile.notifDisableMsg'),
        [
          { text: t('profile.openSettings'), onPress: () => Notifications.requestPermissionsAsync() },
          { text: t('common.cancel'), style: 'cancel' },
        ]
      );
    } else {
      await AsyncStorage.removeItem('@cnb_notif_desabilitadas').catch(() => {});
      setNotifAtivas(true);
      if (perfil?.uid) registrarTokenPush(perfil.uid).catch(() => {});
      Alert.alert(t('profile.notifReenabled'), t('profile.notifReenabledMsg'));
    }
  }

  function handleEditarPerfil() {
    navigation.navigate('EditProfile', {
      perfil: perfilLocal,
      onSalvar: (updates) => {
        atualizarPerfil?.(updates);
        setPerfilLocal(prev => ({ ...prev, ...updates }));
      },
    });
  }

  async function handleAplicarCodigo() {
    const codigo = codigoParaAplicar.trim().toUpperCase();
    if (!codigo) return Alert.alert(t('common.attention'), t('profile.enterCodePrompt'));
    setAplicando(true);
    try {
      await processarIndicacao(perfil.uid, codigo);
      setCodigo('');
      afiliadosCacheRef.current = { data: null, ts: 0 };
      Alert.alert(t('profile.codeApplied'), t('profile.codeAppliedMsg'));
    } catch (e) {
      Alert.alert(t('common.error'), e.message ?? t('profile.invalidCode'));
    } finally {
      setAplicando(false);
    }
  }

  async function handleCompartilharCodigo() {
    if (!afiliados.codigo) return;
    const link = `https://cnbmobile-2053c.web.app/r/${afiliados.codigo}`;
    try {
      await Share.share({
        message:
          `Transforme o carregamento do seu celular em recompensas reais com o CNB Mobile.\n\n` +
          `Baixe gratuitamente:\n${link}\n\n` +
          `O código de indicação já vem preenchido ao instalar pelo link.`,
      });
    } catch { }
  }

  async function handleCopiarCodigo() {
    await Clipboard.setStringAsync(afiliados.codigo);
    Alert.alert(t('profile.copied'), t('profile.copiedMsg'));
  }

  async function handleLogout() {
    Alert.alert(t('profile.logoutTitle'), t('profile.logoutMsg'), [
      { text: t('profile.cancel'), style: 'cancel' },
      { text: t('profile.confirm'), style: 'destructive', onPress: () => { limparSessao(); signOut(auth); } },
    ]);
  }

  async function handleExcluirConta() {
    Alert.alert(t('profile.deleteTitle'), t('profile.deleteMsg'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteTitle'), style: 'destructive', onPress: () => {
          Alert.alert(t('profile.deleteConfirmTitle'), t('profile.deleteConfirmMsg'), [
            { text: t('profile.cancel'), style: 'cancel' },
            {
              text: t('profile.deleteConfirm'), style: 'destructive', onPress: async () => {
                try {
                  await excluirConta(perfil.uid, auth.currentUser);
                } catch (e) {
                  if (e.code === 'auth/requires-recent-login') {
                    Alert.alert(t('profile.requiresRelogin'), t('profile.deleteReloginError'));
                  } else {
                    Alert.alert(t('common.error'), t('profile.deleteError'));
                  }
                }
              },
            },
          ]);
        },
      },
    ]);
  }

  function formatarData(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR');
  }

  // ── Gate de login ──
  if (!user) {
    return (
      <LinearGradient colors={['#0b1310', '#0a0f0d', '#000000']} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: 'rgba(198,255,74,0.08)',
              borderWidth: 1.5, borderColor: 'rgba(198,255,74,0.2)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 24,
            }}>
              <User size={36} color={PRIMARY} />
            </View>
            <Text style={{ fontSize: 27, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 10 }}>
              {t('profile.loginToView')}
            </Text>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 21, marginBottom: 36 }}>
              {t('profile.loginToViewSub')}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
              style={{ backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center' }}
            >
              <Text style={{ color: '#000', fontWeight: '700', fontSize: 21 }}>{t('common.loginRegister')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const pontos = perfilLocal?.pontos ?? 0;

  return (
    <LinearGradient colors={['#0b1310', '#0a0f0d', '#000000']} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Avatar + Nome ── */}
          <Animated.View style={[{ paddingTop: 12, paddingBottom: 20 }, a0]}>
            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>{t('profile.profile')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              {/* Avatar 64px com Award badge */}
              <View style={{ position: 'relative' }}>
                <LinearGradient
                  colors={['#c6ff4a', '#2ecc71']}
                  start={{ x: 0.13, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{
                    width: 64, height: 64, borderRadius: 32,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {perfilLocal?.avatarURL ? (
                    <Avatar uri={perfilLocal.avatarURL} nome={perfilLocal.nome} size={64} />
                  ) : (
                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 26 }}>
                      {(perfilLocal?.nome ?? 'U').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </LinearGradient>
                {/* Award badge */}
                <View style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: PRIMARY,
                  borderWidth: 2, borderColor: '#000',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Award size={11} color="#000" />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 21, fontWeight: '600', color: '#fff' }}>
                  {perfilLocal?.nome ?? t('common.user')}
                </Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 2 }} numberOfLines={1}>
                  {perfilLocal?.email ?? ''}
                </Text>
                <Text style={{ fontSize: 13, color: PRIMARY, marginTop: 3 }}>
                  {calcularNivel(pontos).label}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* ── Stats grid (Figma: Pontos · #Ranking · Provas ZK) ── */}
          <Animated.View style={[{ marginBottom: 20 }, a1]}>
            <LinearGradient
              colors={['#14251a', '#0a130e']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: 'rgba(198,255,74,0.2)',
              }}
            >
              <View style={{ flexDirection: 'row' }}>
                {/* Pontos */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '600', color: PRIMARY }}>
                    {pontos.toLocaleString('pt-BR')}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>
                    Pontos
                  </Text>
                </View>
                {/* Divider */}
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                {/* Ranking */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '600', color: '#fff' }}>
                    {minhaPos?.posicao ?? '—'}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>
                    Ranking
                  </Text>
                </View>
                {/* Divider */}
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                {/* Indicações */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '600', color: '#fff' }}>{afiliados.total}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>
                    Indicações
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── Menu principal — itens variam conforme modo (lite/tech) ── */}
          <Animated.View style={[{ gap: 8, marginBottom: 20 }, a2]}>
            {(() => {
              const isLite = perfilLocal?.modo === 'lite';
              const items = [];
              if (!isLite) {
                items.push({
                  Icon: Wallet, title: 'Carteira Solana',
                  sub: perfilLocal?.walletAddress ? perfilLocal.walletAddress.slice(0,4) + '…' + perfilLocal.walletAddress.slice(-3) : '—',
                  onPress: () => navigation.navigate('Wallet', { user: perfilLocal }),
                });
              }
              items.push({
                Icon: Shield, title: 'Privacidade ZK', sub: 'Cloak ativo · saque sem rastro',
                onPress: () => navigation.navigate('Withdraw', { perfil: perfilLocal, initialAba: 'privado' }),
              });
              items.push({
                Icon: Bell, title: 'Notificações', sub: notifAtivas ? 'Ativadas' : 'Desativadas',
                onPress: handleNotificacoes,
              });
              items.push({
                Icon: Settings, title: 'Preferências', sub: 'Editar perfil, tema',
                onPress: handleEditarPerfil,
              });
              if (!isLite) {
                items.push({
                  Icon: Database, title: 'Dados', sub: 'Gerencie seus consentimentos',
                  onPress: () => navigation.navigate('Dados'),
                });
              }
              items.push({
                Icon: isLite ? Cpu : Zap, title: 'Modo do app', sub: isLite ? 'Lite · simplificado' : 'Tech · experiência completa',
                accent: isLite ? PURPLE : PRIMARY,
                onPress: () => navigation.navigate('ModoEscolha'),
              });
              return items;
            })().map(({ Icon, title, sub, onPress, accent }) => (
              <TouchableOpacity
                key={title}
                onPress={onPress}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  padding: 12, borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: accent ? `${accent}1A` : 'rgba(198,255,74,0.1)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} color={accent ?? PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '500', color: '#fff' }}>{title}</Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 1 }} numberOfLines={1}>{sub}</Text>
                </View>
                <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            ))}
          </Animated.View>

          {/* ── Programa de indicação ── */}
          <Animated.View style={[{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
            borderRadius: 16, padding: 16, marginBottom: 20,
          }, a2]}>

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>{t('profile.referralProgram')}</Text>
              <View style={{
                backgroundColor: 'rgba(198,255,74,0.1)',
                borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
                borderWidth: 1, borderColor: 'rgba(198,255,74,0.25)',
              }}>
                <Text style={{ fontSize: 13, color: PRIMARY, fontWeight: '600' }}>{afiliados.total} cadastros</Text>
              </View>
            </View>

            {/* Ativos vs total */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 10, padding: 10, marginBottom: 16,
            }}>
              <Users size={15} color={PRIMARY} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: '#fff', fontWeight: '500' }}>
                  {afiliados.ativas} de {afiliados.total} indicados já ativaram
                </Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  Ativo = carregou o celular por 3+ minutos
                </Text>
              </View>
            </View>

            {/* Milestones */}
            <Text style={{
              fontSize: 13, color: 'rgba(255,255,255,0.45)',
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
            }}>
              Bônus por indicados ativos
            </Text>

            {/* 5 ativos → 50k pts */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontSize: 16, color: afiliados.bonus5k ? PRIMARY : '#fff' }}>
                  5 ativos — +50.000 pts
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: afiliados.bonus5k ? PRIMARY : 'rgba(255,255,255,0.4)' }}>
                  {afiliados.bonus5k ? 'Recebido' : `${Math.min(afiliados.ativas, 5)}/5`}
                </Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                <View style={{
                  width: `${Math.min((afiliados.ativas / 5) * 100, 100)}%`,
                  height: 5, borderRadius: 99,
                  backgroundColor: afiliados.bonus5k ? PRIMARY : 'rgba(198,255,74,0.45)',
                }} />
              </View>
            </View>

            {/* 10 ativos → 100k pts */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontSize: 16, color: afiliados.bonus10k ? PRIMARY : '#fff' }}>
                  10 ativos — +100.000 pts
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: afiliados.bonus10k ? PRIMARY : 'rgba(255,255,255,0.4)' }}>
                  {afiliados.bonus10k ? 'Recebido' : `${Math.min(afiliados.ativas, 10)}/10`}
                </Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                <View style={{
                  width: `${Math.min((afiliados.ativas / 10) * 100, 100)}%`,
                  height: 5, borderRadius: 99,
                  backgroundColor: afiliados.bonus10k ? PRIMARY : 'rgba(198,255,74,0.45)',
                }} />
              </View>
            </View>

            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
              +100 pts imediato por cada novo cadastro via código
            </Text>

            {/* Código */}
            <View style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderWidth: 1, borderColor: 'rgba(198,255,74,0.2)',
              borderRadius: 12, padding: 12, marginBottom: 10,
            }}>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{t('profile.yourCode')}</Text>
              <Text style={{ fontSize: 32, fontWeight: '700', color: PRIMARY, letterSpacing: 4 }}>
                {afiliados.codigo || '---'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                onPress={handleCopiarCodigo}
                activeOpacity={0.8}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 10, paddingVertical: 10,
                }}
              >
                <Copy size={13} color="rgba(255,255,255,0.8)" />
                <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)' }}>{t('profile.copy')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCompartilharCodigo}
                activeOpacity={0.8}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  backgroundColor: 'rgba(198,255,74,0.1)',
                  borderWidth: 1, borderColor: 'rgba(198,255,74,0.25)',
                  borderRadius: 10, paddingVertical: 10,
                }}
              >
                <Share2 size={13} color={PRIMARY} />
                <Text style={{ fontSize: 16, color: PRIMARY, fontWeight: '600' }}>{t('profile.share')}</Text>
              </TouchableOpacity>
            </View>

            {!perfilLocal?.referidoPor && (
              <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 12 }}>
                <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                  Tem um código de referência?
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
                      borderRadius: 10, padding: 10,
                      color: '#fff', fontSize: 18,
                      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                      letterSpacing: 2,
                    }}
                    placeholder={t('profile.enterCode')}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={codigoParaAplicar}
                    onChangeText={v => setCodigo(v.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                  <TouchableOpacity
                    onPress={handleAplicarCodigo}
                    disabled={aplicandoCodigo}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: PRIMARY, borderRadius: 10,
                      paddingHorizontal: 16, paddingVertical: 10,
                      opacity: aplicandoCodigo ? 0.5 : 1,
                    }}
                  >
                    {aplicandoCodigo
                      ? <ActivityIndicator color="#000" size="small" />
                      : <Text style={{ color: '#000', fontWeight: '700', fontSize: 17 }}>{t('profile.apply')}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>

          {/* ── Histórico de saques ── */}
          <Animated.View style={[{ marginBottom: 24 }, a3]}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 12 }}>
              {t('profile.withdrawHistory')}
            </Text>

            {loadingSaques ? (
              <ActivityIndicator color={PRIMARY} style={{ marginTop: 16 }} />
            ) : saques.length === 0 ? (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                borderRadius: 14, padding: 24, alignItems: 'center',
              }}>
                <Inbox size={28} color="rgba(255,255,255,0.2)" style={{ marginBottom: 8 }} />
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 17 }}>{t('profile.noWithdrawals')}</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {saques.map(s => (
                  <View key={s.id} style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: 14,
                  }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{formatarData(s.criadoEm)}</Text>
                      <Text style={{ fontSize: 17, color: '#fff', marginTop: 2 }} numberOfLines={1}>
                        {s.chavePix
                          ? s.chavePix
                          : s.walletAddress
                            ? `${s.walletAddress.slice(0, 4)}…${s.walletAddress.slice(-4)}`
                            : 'Resgate'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: '#FF4444' }}>
                        -{(s.pontos ?? 0).toLocaleString('pt-BR')} pts
                      </Text>
                      <Text style={{ fontSize: 14, color: STATUS_COLOR[s.status] ?? 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* ── Ações de conta ── */}
          <Animated.View style={[{ gap: 8 }, a3]}>
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                borderWidth: 1, borderColor: 'rgba(255,68,68,0.3)',
                borderRadius: 12, paddingVertical: 14,
              }}
            >
              <LogOut size={15} color="#FF4444" />
              <Text style={{ color: '#FF4444', fontWeight: '600', fontSize: 18 }}>{t('profile.logout')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleExcluirConta}
              activeOpacity={0.8}
              style={{ alignItems: 'center', paddingVertical: 12 }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>{t('profile.deleteAccount')}</Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
