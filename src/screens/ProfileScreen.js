import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  ChevronRight, Shield, Bell, Settings, Award, User,
} from 'lucide-react-native';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIMARY = '#c6ff4a';

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
      <Text style={{ fontSize: 11, color: nivel.cor, fontWeight: '600' }}>
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
      <Text style={{ fontSize: 22, fontWeight: '700', color: cor ?? '#fff' }}>{value}</Text>
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{label}</Text>
    </View>
  );
}

function MenuItem({ Icon, title, sub, onPress, danger }) {
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
        <Text style={{ fontSize: 14, color: danger ? '#FF4444' : '#fff', fontWeight: '500' }}>{title}</Text>
        {sub && <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{sub}</Text>}
      </View>
      {!danger && <ChevronRight size={16} color="rgba(255,255,255,0.3)" />}
    </TouchableOpacity>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function ProfileScreen({ route, navigation }) {
  const { user, perfil, onAtualizar, atualizarPerfil } = route?.params || {};

  const [saques, setSaques]               = useState([]);
  const [loadingSaques, setLoadingSaques] = useState(true);
  const [afiliados, setAfiliados]         = useState({ codigo: '', total: 0 });
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
        Alert.alert('Notificações ativadas!', 'Você receberá alertas de pontos e missões.');
      } else {
        Alert.alert('Permissão necessária', 'Ative as notificações nas Configurações do dispositivo para receber alertas do CNB Mobile.');
      }
    } else if (notifAtivas) {
      Alert.alert(
        'Desativar notificações',
        'Para desativar completamente, acesse as Configurações do dispositivo > CNB Mobile > Notificações.',
        [
          { text: 'Abrir Configurações', onPress: () => Notifications.requestPermissionsAsync() },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    } else {
      await AsyncStorage.removeItem('@cnb_notif_desabilitadas').catch(() => {});
      setNotifAtivas(true);
      if (perfil?.uid) registrarTokenPush(perfil.uid).catch(() => {});
      Alert.alert('Notificações reativadas!', 'Você voltará a receber alertas de pontos e missões.');
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
    if (!codigo) return Alert.alert('Atenção', 'Digite um código de indicação.');
    setAplicando(true);
    try {
      await processarIndicacao(perfil.uid, codigo);
      setCodigo('');
      afiliadosCacheRef.current = { data: null, ts: 0 };
      Alert.alert('Código aplicado!', 'Você foi indicado com sucesso. O indicador recebeu +100 pts.');
    } catch (e) {
      Alert.alert('Erro', e.message ?? 'Código inválido ou já utilizado.');
    } finally {
      setAplicando(false);
    }
  }

  async function handleCompartilharCodigo() {
    if (!afiliados.codigo) return;
    const link = `https://play.google.com/store/apps/details?id=com.cnb.cnbappv2&referrer=${afiliados.codigo}`;
    try {
      await Share.share({
        message:
          `⚡ Transforme o carregamento do seu celular em dinheiro real!\n\n` +
          `Baixe o CNB Mobile gratuitamente:\n${link}\n\n` +
          `O código de indicação já vem preenchido automaticamente ao instalar pelo link! 🎁`,
      });
    } catch { }
  }

  async function handleCopiarCodigo() {
    await Clipboard.setStringAsync(afiliados.codigo);
    Alert.alert('Copiado!', 'Código copiado para a área de transferência.');
  }

  async function handleLogout() {
    Alert.alert('Sair', 'Deseja mesmo sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => { limparSessao(); signOut(auth); } },
    ]);
  }

  async function handleExcluirConta() {
    Alert.alert('Excluir conta', 'Todos os seus dados e pontos serão apagados permanentemente.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: () => {
          Alert.alert('Confirmar exclusão', 'Tem certeza? Essa ação não pode ser desfeita.', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Sim, excluir tudo', style: 'destructive', onPress: async () => {
                try {
                  await excluirConta(perfil.uid, auth.currentUser);
                } catch (e) {
                  if (e.code === 'auth/requires-recent-login') {
                    Alert.alert('Necessário re-login', 'Faça logout e login novamente para excluir a conta.');
                  } else {
                    Alert.alert('Erro', 'Não foi possível excluir a conta.');
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
            <Text style={{ fontSize: 21, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 10 }}>
              Faça login para ver seu perfil
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 21, marginBottom: 36 }}>
              Acesse sua conta para ver pontos, saques e programa de indicação.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
              style={{ backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center' }}
            >
              <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>Entrar / Cadastrar</Text>
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
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>Perfil</Text>
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
                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 20 }}>
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
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
                  {perfilLocal?.nome ?? 'Usuário'}
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }} numberOfLines={1}>
                  {perfilLocal?.email ?? ''}
                </Text>
                <Text style={{ fontSize: 10, color: PRIMARY, marginTop: 3 }}>
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
                  <Text style={{ fontSize: 18, fontWeight: '600', color: PRIMARY }}>
                    {pontos.toLocaleString('pt-BR')}
                  </Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>
                    Pontos
                  </Text>
                </View>
                {/* Divider */}
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                {/* Ranking */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>
                    {minhaPos?.posicao ?? '—'}
                  </Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>
                    Ranking
                  </Text>
                </View>
                {/* Divider */}
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                {/* Indicações */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>{afiliados.total}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>
                    Indicações
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── Menu principal (4 itens do Figma) ── */}
          <Animated.View style={[{ gap: 8, marginBottom: 20 }, a2]}>
            {[
              { Icon: Wallet,   title: 'Carteira Solana',  sub: 'Phantom · ' + (perfilLocal?.walletAddress ? perfilLocal.walletAddress.slice(0,4) + '…' + perfilLocal.walletAddress.slice(-3) : '—'),
                onPress: () => navigation.navigate('Wallet', { user: perfilLocal }) },
              { Icon: Shield,   title: 'Privacidade ZK',   sub: 'Cloak ativo · saque sem rastro',
                onPress: () => navigation.navigate('Withdraw', { perfil: perfilLocal, initialAba: 'privado' }) },
              { Icon: Bell,     title: 'Notificações',     sub: notifAtivas ? 'Ativadas' : 'Desativadas',
                onPress: handleNotificacoes },
              { Icon: Settings, title: 'Preferências',     sub: 'Editar perfil, tema',
                onPress: handleEditarPerfil },
            ].map(({ Icon, title, sub, onPress }) => (
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
                  backgroundColor: 'rgba(198,255,74,0.1)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#fff' }}>{title}</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 }} numberOfLines={1}>{sub}</Text>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Programa de Indicação</Text>
              <View style={{
                backgroundColor: 'rgba(198,255,74,0.1)',
                borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
                borderWidth: 1, borderColor: 'rgba(198,255,74,0.25)',
              }}>
                <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '600' }}>{afiliados.total} indicados</Text>
              </View>
            </View>

            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18, marginBottom: 14 }}>
              Indique amigos e ganhe <Text style={{ color: PRIMARY, fontWeight: '600' }}>+100 pts</Text> por cada cadastro!
            </Text>

            {/* Código */}
            <View style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderWidth: 1, borderColor: 'rgba(198,255,74,0.2)',
              borderRadius: 12, padding: 12, marginBottom: 10,
            }}>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Seu código</Text>
              <Text style={{ fontSize: 24, fontWeight: '700', color: PRIMARY, letterSpacing: 4 }}>
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
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>Copiar</Text>
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
                <Text style={{ fontSize: 12, color: PRIMARY, fontWeight: '600' }}>Compartilhar</Text>
              </TouchableOpacity>
            </View>

            {!perfilLocal?.referidoPor && (
              <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 12 }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                  Tem um código de referência?
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
                      borderRadius: 10, padding: 10,
                      color: '#fff', fontSize: 14,
                      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                      letterSpacing: 2,
                    }}
                    placeholder="Digite o código"
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
                      : <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>Aplicar</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>

          {/* ── Histórico de saques ── */}
          <Animated.View style={[{ marginBottom: 24 }, a3]}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 12 }}>
              Histórico de Saques
            </Text>

            {loadingSaques ? (
              <ActivityIndicator color={PRIMARY} style={{ marginTop: 16 }} />
            ) : saques.length === 0 ? (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                borderRadius: 14, padding: 24, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 24, marginBottom: 8 }}>📭</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Nenhum saque realizado ainda</Text>
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
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{formatarData(s.criadoEm)}</Text>
                      <Text style={{ fontSize: 13, color: '#fff', marginTop: 2 }} numberOfLines={1}>{s.chavePix}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF4444' }}>
                        -{(s.pontos ?? 0).toLocaleString('pt-BR')} pts
                      </Text>
                      <Text style={{ fontSize: 11, color: STATUS_COLOR[s.status] ?? 'rgba(255,255,255,0.4)', marginTop: 2 }}>
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
              <Text style={{ color: '#FF4444', fontWeight: '600', fontSize: 14 }}>Sair da conta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleExcluirConta}
              activeOpacity={0.8}
              style={{ alignItems: 'center', paddingVertical: 12 }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Excluir minha conta</Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
