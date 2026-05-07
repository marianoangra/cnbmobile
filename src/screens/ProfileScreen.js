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
  BadgeCheck,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAccent } from '../context/AccentContext';
import { useTheme } from '../context/ThemeContext';
import { subscribeUserAttestations } from '../services/attestations';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIMARY = '#c6ff4a';
const PURPLE  = '#c084fc';

const NIVEIS = [
  { min: 0,      labelKey: 'profile.levelStarter',   cor: '#8A9BB0' },
  { min: 1000,   labelKey: 'profile.levelCollector', cor: '#4FC3F7' },
  { min: 10000,  labelKey: 'profile.levelEarner',    cor: '#81C784' },
  { min: 50000,  labelKey: 'profile.levelMiner',     cor: PRIMARY   },
  { min: 100000, labelKey: 'profile.levelValidator', cor: '#FFD700' },
];

function calcularNivel(pontos) {
  let nivel = NIVEIS[0];
  for (const n of NIVEIS) {
    if (pontos >= n.min) nivel = n;
    else break;
  }
  return nivel;
}

const STATUS_KEY = { pendente: 'profile.statusPending', aprovado: 'profile.statusApproved', rejeitado: 'profile.statusRejected' };
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
  const { colors } = useTheme();
  const { t } = useTranslation();
  const nivel = calcularNivel(pontos);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: colors.border,
      borderWidth: 1, borderColor: colors.borderStrong,
      borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: nivel.cor }} />
      <Text style={{ fontSize: 14, color: nivel.cor, fontWeight: '600' }}>
        {t(nivel.labelKey)}
      </Text>
    </View>
  );
}

function StatBox({ label, value, cor }) {
  const { colors } = useTheme();
  return (
    <View style={{
      flex: 1, alignItems: 'center', paddingVertical: 14,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 14,
    }}>
      <Text style={{ fontSize: 29, fontWeight: '700', color: cor ?? colors.text }}>{value}</Text>
      <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 3 }}>{label}</Text>
    </View>
  );
}

function MenuItem({ Icon, title, sub, onPress, danger }) {
  const PRIMARY = useAccent();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
      }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: danger ? 'rgba(255,68,68,0.1)' : colors.primaryMid,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={danger ? colors.danger : PRIMARY} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, color: danger ? colors.danger : colors.text, fontWeight: '500' }}>{title}</Text>
        {sub && <Text style={{ fontSize: 14, color: colors.textDim, marginTop: 2 }}>{sub}</Text>}
      </View>
      {!danger && <ChevronRight size={16} color={colors.textGhost} />}
    </TouchableOpacity>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function ProfileScreen({ route, navigation }) {
  const PRIMARY = useAccent();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const { user, perfil, onAtualizar, atualizarPerfil } = route?.params || {};

  const [saques, setSaques]               = useState([]);
  const [loadingSaques, setLoadingSaques] = useState(true);
  const [attestations, setAttestations]   = useState([]);
  const [loadingAttestations, setLoadingAttestations] = useState(true);
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
    setLoadingAttestations(true);
    const unsub = subscribeUserAttestations(perfil.uid, (atts) => {
      setAttestations(atts);
      setLoadingAttestations(false);
    }, { max: 30 });
    return unsub;
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
          `Transforme o carregamento do seu celular em recompensas reais com o JUICE.\n\n` +
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

  // Background gradient — adapta ao tema
  const bgGradient = isDark
    ? ['#0b1310', '#0a0f0d', '#000000']
    : [colors.background, '#E7ECF1', '#DAE2EA'];

  // ── Gate de login ──
  if (!user) {
    return (
      <LinearGradient colors={bgGradient} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: colors.primarySoft,
              borderWidth: 1.5, borderColor: colors.primaryStrong,
              alignItems: 'center', justifyContent: 'center', marginBottom: 24,
            }}>
              <User size={36} color={PRIMARY} />
            </View>
            <Text style={{ fontSize: 27, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 10 }}>
              {t('profile.loginToView')}
            </Text>
            <Text style={{ fontSize: 18, color: colors.textFaint, textAlign: 'center', lineHeight: 21, marginBottom: 36 }}>
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
    <LinearGradient colors={bgGradient} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Avatar + Nome ── */}
          <Animated.View style={[{ paddingTop: 12, paddingBottom: 20 }, a0]}>
            <Text style={{ fontSize: 16, color: colors.textFaint, marginBottom: 16 }}>{t('profile.profile')}</Text>
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
                  borderWidth: 2, borderColor: isDark ? '#000' : colors.background,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Award size={11} color="#000" />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 21, fontWeight: '600', color: colors.text }}>
                  {perfilLocal?.nome ?? t('common.user')}
                </Text>
                <Text style={{ fontSize: 14, color: colors.textFaint, marginTop: 2 }} numberOfLines={1}>
                  {perfilLocal?.email ?? ''}
                </Text>
                <Text style={{ fontSize: 13, color: PRIMARY, marginTop: 3 }}>
                  {t(calcularNivel(pontos).labelKey)}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* ── Stats grid (Figma: Pontos · #Ranking · Provas ZK) ── */}
          <Animated.View style={[{ marginBottom: 20 }, a1]}>
            <LinearGradient
              // Mantém gradient escuro mesmo em light pra preservar destaque do card
              colors={isDark ? ['#14251a', '#0a130e'] : ['#16271a', '#0c1610']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: colors.primaryStrong,
              }}
            >
              <View style={{ flexDirection: 'row' }}>
                {/* Pontos */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '600', color: PRIMARY }}>
                    {pontos.toLocaleString('pt-BR')}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>
                    {t('profile.statPoints')}
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
                    {t('profile.statRanking')}
                  </Text>
                </View>
                {/* Divider */}
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                {/* Indicações */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '600', color: '#fff' }}>{afiliados.total}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>
                    {t('profile.statReferrals')}
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
                  Icon: Wallet, title: t('profile.solanaWallet'),
                  sub: perfilLocal?.walletAddress ? perfilLocal.walletAddress.slice(0,4) + '…' + perfilLocal.walletAddress.slice(-3) : null,
                  onPress: () => navigation.navigate('Wallet', { user: perfilLocal }),
                });
              }
              items.push({
                Icon: Shield, title: t('profile.zkPrivacy'), sub: t('profile.zkPrivacySub'),
                onPress: () => navigation.navigate('Withdraw', { perfil: perfilLocal, initialAba: 'privado' }),
              });
              items.push({
                Icon: Bell, title: t('profile.notifications'), sub: notifAtivas ? t('profile.notifEnabledShort') : t('profile.notifDisabledShort'),
                onPress: handleNotificacoes,
              });
              items.push({
                Icon: Settings, title: t('profile.preferences'), sub: t('profile.preferencesSub'),
                onPress: handleEditarPerfil,
              });
              if (!isLite) {
                items.push({
                  Icon: Database, title: t('profile.dataLabel'), sub: t('profile.dataSub'),
                  onPress: () => navigation.navigate('Dados'),
                });
              }
              items.push({
                Icon: isLite ? Cpu : Zap, title: t('profile.appMode'), sub: isLite ? t('profile.appModeLite') : t('profile.appModeTech'),
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
                  backgroundColor: colors.surface,
                  borderWidth: 1, borderColor: colors.borderSubtle,
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: accent ? `${accent}1A` : colors.primaryMid,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} color={accent ?? PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{title}</Text>
                  {sub ? (
                    <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 1 }} numberOfLines={1}>{sub}</Text>
                  ) : null}
                </View>
                <ChevronRight size={16} color={colors.textGhost} />
              </TouchableOpacity>
            ))}
          </Animated.View>

          {/* ── Programa de indicação ── */}
          <Animated.View style={[{
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 16, padding: 16, marginBottom: 20,
          }, a2]}>

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>{t('profile.referralProgram')}</Text>
              <View style={{
                backgroundColor: colors.primaryMid,
                borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
                borderWidth: 1, borderColor: colors.primaryStrong,
              }}>
                <Text style={{ fontSize: 13, color: PRIMARY, fontWeight: '600' }}>{t('profile.registrations', { count: afiliados.total })}</Text>
              </View>
            </View>

            {/* Ativos vs total */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: colors.surfaceAlt,
              borderRadius: 10, padding: 10, marginBottom: 16,
            }}>
              <Users size={15} color={PRIMARY} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: colors.text, fontWeight: '500' }}>
                  {t('profile.activatedCount', { active: afiliados.ativas, total: afiliados.total })}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 2 }}>
                  {t('profile.activeNote')}
                </Text>
              </View>
            </View>

            {/* Milestones */}
            <Text style={{
              fontSize: 13, color: colors.textDim,
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
            }}>
              {t('profile.activeBonus')}
            </Text>

            {/* 5 ativos → 50k pts */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontSize: 16, color: afiliados.bonus5k ? PRIMARY : colors.text }}>
                  {t('profile.fiveActives')}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: afiliados.bonus5k ? PRIMARY : colors.textDim }}>
                  {afiliados.bonus5k ? t('profile.received') : `${Math.min(afiliados.ativas, 5)}/5`}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.surfaceStrong, borderRadius: 99, height: 5, overflow: 'hidden' }}>
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
                <Text style={{ fontSize: 16, color: afiliados.bonus10k ? PRIMARY : colors.text }}>
                  {t('profile.tenActives')}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: afiliados.bonus10k ? PRIMARY : colors.textDim }}>
                  {afiliados.bonus10k ? t('profile.received') : `${Math.min(afiliados.ativas, 10)}/10`}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.surfaceStrong, borderRadius: 99, height: 5, overflow: 'hidden' }}>
                <View style={{
                  width: `${Math.min((afiliados.ativas / 10) * 100, 100)}%`,
                  height: 5, borderRadius: 99,
                  backgroundColor: afiliados.bonus10k ? PRIMARY : 'rgba(198,255,74,0.45)',
                }} />
              </View>
            </View>

            <Text style={{ fontSize: 14, color: colors.textDim, marginBottom: 14 }}>
              {t('profile.perReferralBonus')}
            </Text>

            {/* Código */}
            <View style={{
              backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
              borderWidth: 1, borderColor: colors.primaryStrong,
              borderRadius: 12, padding: 12, marginBottom: 10,
            }}>
              <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 4 }}>{t('profile.yourCode')}</Text>
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
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 1, borderColor: colors.borderStrong,
                  borderRadius: 10, paddingVertical: 10,
                }}
              >
                <Copy size={13} color={colors.textStrong} />
                <Text style={{ fontSize: 16, color: colors.textStrong }}>{t('profile.copy')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCompartilharCodigo}
                activeOpacity={0.8}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  backgroundColor: colors.primaryMid,
                  borderWidth: 1, borderColor: colors.primaryStrong,
                  borderRadius: 10, paddingVertical: 10,
                }}
              >
                <Share2 size={13} color={PRIMARY} />
                <Text style={{ fontSize: 16, color: PRIMARY, fontWeight: '600' }}>{t('profile.share')}</Text>
              </TouchableOpacity>
            </View>

            {!perfilLocal?.referidoPor && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                <Text style={{ fontSize: 16, color: colors.textFaint, marginBottom: 8 }}>
                  {t('profile.hasReferralCode')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
                      borderRadius: 10, padding: 10,
                      color: colors.text, fontSize: 18,
                      borderWidth: 1, borderColor: colors.borderStrong,
                      letterSpacing: 2,
                    }}
                    placeholder={t('profile.enterCode')}
                    placeholderTextColor={colors.textGhost}
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

          {/* ── Provas on-chain (atestações SAS de cada sessão) ── */}
          <Animated.View style={[{ marginBottom: 24 }, a3]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>
                {t('profile.onChainProofs')}
              </Text>
              {attestations.length > 0 && (
                <View style={{
                  backgroundColor: colors.primaryMid,
                  borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
                  borderWidth: 1, borderColor: colors.primaryStrong,
                }}>
                  <Text style={{ fontSize: 13, color: PRIMARY, fontWeight: '600' }}>
                    {attestations.length}
                  </Text>
                </View>
              )}
            </View>

            {loadingAttestations ? (
              <ActivityIndicator color={PRIMARY} style={{ marginTop: 16 }} />
            ) : attestations.length === 0 ? (
              <View style={{
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1, borderColor: colors.border,
                borderRadius: 14, padding: 24, alignItems: 'center',
              }}>
                <BadgeCheck size={28} color={colors.textGhost} style={{ marginBottom: 8 }} />
                <Text style={{ color: colors.textDim, fontSize: 16, textAlign: 'center', lineHeight: 22 }}>
                  {t('profile.noProofsHint')}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {attestations.map(att => (
                  <TouchableOpacity
                    key={att.id}
                    onPress={() => att.solscanUrl && WebBrowser.openBrowserAsync(att.solscanUrl).catch(() => {})}
                    disabled={!att.solscanUrl}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1, borderColor: colors.border,
                      borderRadius: 12, padding: 14,
                    }}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: att.isSas ? colors.primaryMid : colors.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <BadgeCheck size={16} color={att.isSas ? PRIMARY : colors.textGhost} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, color: colors.text, fontWeight: '500' }}>
                        {att.duracaoMinutos} min · {(att.pontos ?? 0).toLocaleString('pt-BR')} pts
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 2 }}>
                        {formatarData(att.criadoEm)}{att.isSas ? t('profile.sasSuffix') : t('profile.legacySuffix')}
                      </Text>
                    </View>
                    {att.solscanUrl && <ChevronRight size={16} color={colors.textGhost} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>

          {/* ── Histórico de saques ── */}
          <Animated.View style={[{ marginBottom: 24 }, a3]}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 }}>
              {t('profile.withdrawHistory')}
            </Text>

            {loadingSaques ? (
              <ActivityIndicator color={PRIMARY} style={{ marginTop: 16 }} />
            ) : saques.length === 0 ? (
              <View style={{
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1, borderColor: colors.border,
                borderRadius: 14, padding: 24, alignItems: 'center',
              }}>
                <Inbox size={28} color={colors.textGhost} style={{ marginBottom: 8 }} />
                <Text style={{ color: colors.textDim, fontSize: 17 }}>{t('profile.noWithdrawals')}</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {saques.map(s => (
                  <View key={s.id} style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1, borderColor: colors.border,
                    borderRadius: 12, padding: 14,
                  }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: 14, color: colors.textDim }}>{formatarData(s.criadoEm)}</Text>
                      <Text style={{ fontSize: 17, color: colors.text, marginTop: 2 }} numberOfLines={1}>
                        {s.chavePix
                          ? s.chavePix
                          : s.walletAddress
                            ? `${s.walletAddress.slice(0, 4)}…${s.walletAddress.slice(-4)}`
                            : t('profile.redemption')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.danger }}>
                        -{(s.pontos ?? 0).toLocaleString('pt-BR')} pts
                      </Text>
                      <Text style={{ fontSize: 14, color: STATUS_COLOR[s.status] ?? colors.textDim, marginTop: 2 }}>
                        {STATUS_KEY[s.status] ? t(STATUS_KEY[s.status]) : s.status}
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
              <LogOut size={15} color={colors.danger} />
              <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 18 }}>{t('profile.logout')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleExcluirConta}
              activeOpacity={0.8}
              style={{ alignItems: 'center', paddingVertical: 12 }}
            >
              <Text style={{ color: colors.textGhost, fontSize: 16 }}>{t('profile.deleteAccount')}</Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
