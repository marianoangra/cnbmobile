import React, { useEffect, useMemo, useState } from 'react';
import { diaKey } from '../utils/date';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import {
  Zap, LogIn, User, Wallet, TrendingUp, UserPlus, Flame,
  CheckCircle, Lock, Clock,
} from 'lucide-react-native';

// ─── Constantes de estilo ──────────────────────────────────────────────────────
const PRIMARY     = '#c6ff4a';
const PRIMARY_DIM = 'rgba(198,255,74,0.55)';
// Opacidades calibradas para atingir contraste mínimo WCAG AA (4.5:1)
// em fundo #0a0f0d. Valores abaixo de 0.55 falham em texto ≤12px.
const TEXT_MUTED  = 'rgba(255,255,255,0.60)';
const TEXT_FAINT  = 'rgba(255,255,255,0.55)';
const TRACK_BG    = 'rgba(255,255,255,0.10)';


function carregouHoje(atividadeDias = {}) {
  return (atividadeDias?.[diaKey(0)] ?? 0) > 0;
}

function ptsSemana(atividadeDias = {}) {
  let total = 0;
  for (let i = 0; i < 7; i++) total += atividadeDias?.[diaKey(i)] ?? 0;
  return total;
}

function diasConsecutivos(atividadeDias = {}) {
  let count = 0;
  for (let i = 0; i < 30; i++) {
    if ((atividadeDias?.[diaKey(i)] ?? 0) > 0) count++;
    else break;
  }
  return count;
}

// ─── Countdown helpers ────────────────────────────────────────────────────────
function segsAteMeiaNoite() {
  const agora = new Date();
  const meiaNoite = new Date();
  meiaNoite.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((meiaNoite - agora) / 1000));
}

function segsAteSegunda() {
  const agora = new Date();
  const diaSemana = agora.getDay(); // 0=dom … 6=sab
  // diasAteSegunda: 0 nunca ocorre — se já é segunda, próxima é em 7 dias
  const diasAteSegunda = diaSemana === 0 ? 1 : (8 - diaSemana) % 7 || 7;
  const proxSegunda = new Date(agora);
  proxSegunda.setDate(agora.getDate() + diasAteSegunda);
  proxSegunda.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((proxSegunda - agora) / 1000));
}

function formatarTempo(segs) {
  const h = Math.floor(segs / 3600);
  const m = Math.floor((segs % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  const s = segs % 60;
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

// ─── Hook de entrada ──────────────────────────────────────────────────────────
function useEntrada(delayMs = 0) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(20);
  useEffect(() => {
    const cfg = { duration: 480, easing: Easing.out(Easing.cubic) };
    opacity.value    = withDelay(delayMs, withTiming(1, cfg));
    translateY.value = withDelay(delayMs, withTiming(0, cfg));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

// ─── BarraProgresso ───────────────────────────────────────────────────────────
function BarraProgresso({ progresso, completo }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(300, withTiming(progresso, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progresso]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));
  return (
    <View style={{ backgroundColor: TRACK_BG, borderRadius: 99, height: 6, overflow: 'hidden' }}>
      <Animated.View style={[{
        height: 6, borderRadius: 99,
        backgroundColor: completo ? PRIMARY : PRIMARY_DIM,
      }, barStyle]} />
    </View>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────
function BadgeCompleto() {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(198,255,74,0.12)',
      borderWidth: 1, borderColor: 'rgba(198,255,74,0.28)',
      borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
    }}>
      <CheckCircle size={10} color={PRIMARY} />
      <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '700' }}>Completo</Text>
    </View>
  );
}

function BadgeBloqueado() {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
      borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
    }}>
      <Lock size={10} color={TEXT_FAINT} />
      <Text style={{ fontSize: 10, color: TEXT_FAINT, fontWeight: '600' }}>Bloqueado</Text>
    </View>
  );
}

// ─── CountdownDisplay — componente isolado com estado próprio ─────────────────
// Mantém o setInterval localmente: apenas este componente re-renderiza por segundo,
// não a tela inteira (corrige PERF-01).
function CountdownDisplay({ getFn }) {
  const [segs, setSegs] = useState(getFn);
  useEffect(() => {
    const t = setInterval(() => setSegs(getFn()), 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      accessibilityLabel={`Tempo restante: ${formatarTempo(segs)}`}
    >
      <Clock size={10} color={TEXT_FAINT} />
      <Text style={{ fontSize: 10, color: TEXT_FAINT, fontWeight: '600' }}>
        {formatarTempo(segs)}
      </Text>
    </View>
  );
}

// ─── MissionCard ──────────────────────────────────────────────────────────────
function MissionCard({ Icon, titulo, descricao, pontos, completo, bloqueado, progresso, labelProgresso, delay }) {
  const animStyle = useEntrada(delay);
  const statusLabel = completo ? 'Completa' : bloqueado ? 'Bloqueada' : `Progresso: ${labelProgresso}`;
  return (
    <Animated.View
      style={[animStyle, {
        backgroundColor: completo ? 'rgba(198,255,74,0.05)' : 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: completo ? 'rgba(198,255,74,0.18)' : 'rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        opacity: bloqueado ? 0.55 : 1,
      }]}
      accessible
      accessibilityRole="none"
      accessibilityLabel={`Missão: ${titulo}. ${descricao}. Recompensa: ${pontos}. ${statusLabel}`}
      accessibilityState={{ disabled: bloqueado }}
    >
      {/* Linha superior: ícone + título + badge de pontos */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <View style={{
          width: 40, height: 40, borderRadius: 20, flexShrink: 0,
          backgroundColor: completo ? 'rgba(198,255,74,0.14)' : 'rgba(255,255,255,0.06)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={completo ? PRIMARY : 'rgba(255,255,255,0.55)'} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 13, fontWeight: '600',
            color: completo ? '#fff' : 'rgba(255,255,255,0.85)',
            marginBottom: 2,
          }}>
            {titulo}
          </Text>
          <Text style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 16 }}>
            {descricao}
          </Text>
        </View>

        <View style={{
          backgroundColor: 'rgba(198,255,74,0.08)',
          borderWidth: 1, borderColor: 'rgba(198,255,74,0.15)',
          borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4,
          minWidth: 54, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '700' }}>{pontos}</Text>
        </View>
      </View>

      <BarraProgresso progresso={progresso} completo={completo} />

      <View style={{
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginTop: 8,
      }}>
        <Text style={{ fontSize: 10, color: TEXT_FAINT }}>{labelProgresso}</Text>
        {completo ? <BadgeCompleto /> : bloqueado ? <BadgeBloqueado /> : null}
      </View>
    </Animated.View>
  );
}

// ─── Secao ────────────────────────────────────────────────────────────────────
function Secao({ titulo, subtitulo, getCountdownFn, animStyle }) {
  return (
    <Animated.View style={[animStyle, { marginBottom: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{titulo}</Text>
        {getCountdownFn && <CountdownDisplay getFn={getCountdownFn} />}
      </View>
      {subtitulo ? (
        <Text style={{ fontSize: 11, color: TEXT_FAINT, marginTop: 2 }}>{subtitulo}</Text>
      ) : null}
    </Animated.View>
  );
}

// ─── Banner onboarding completo ───────────────────────────────────────────────
// Exibido no lugar dos cards quando todas as tarefas de onboarding estão feitas,
// evitando que a seção desapareça silenciosamente (corrige LOGICA-02).
function BannerOnboardingCompleto({ animStyle }) {
  return (
    <Animated.View style={[animStyle, {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: 'rgba(198,255,74,0.05)',
      borderWidth: 1, borderColor: 'rgba(198,255,74,0.18)',
      borderRadius: 14, padding: 14, marginBottom: 10,
    }]}>
      <CheckCircle size={18} color={PRIMARY} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 2 }}>
          Primeiros passos concluídos
        </Text>
        <Text style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 16 }}>
          Bônus de onboarding creditados na sua conta.
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Ordenar: pendentes primeiro ──────────────────────────────────────────────
function ordenarMissoes(missoes) {
  return [...missoes].sort((a, b) => {
    if (a.completo === b.completo) return 0;
    return a.completo ? 1 : -1;
  });
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function MissoesScreen({ route, navigation }) {
  const { user, perfil } = route?.params || {};

  const bloqueado     = !user;
  const atividadeDias = perfil?.atividadeDias ?? {};
  const referidos     = perfil?.referidos     ?? 0;

  const hojeOk      = carregouHoje(atividadeDias);
  const semanaTotal = ptsSemana(atividadeDias);
  const consec      = diasConsecutivos(atividadeDias);

  // BUG-03 — Login diário: usa perfil.ultimoLogin (campo server-side) para
  // verificar se houve login real hoje. Se o campo ainda não existir no backend,
  // considera completo para qualquer usuário logado (comportamento anterior).
  const loginHojeOk = !bloqueado && (
    perfil?.ultimoLogin ? perfil.ultimoLogin === diaKey(0) : true
  );

  const a0 = useEntrada(0);
  const a1 = useEntrada(60);
  const a2 = useEntrada(120);
  const a3 = useEntrada(200);

  // ── Missões de onboarding ─────────────────────────────────────────────────
  // useMemo evita recriar os objetos a cada render (corrige PERF-02).
  const temAvatarURL    = !!perfil?.avatarURL;
  const temWallet       = !!perfil?.walletAddress;

  const MISSOES_ONBOARDING = useMemo(() => [
    {
      id: 'onboarding-perfil',
      Icon: User,
      titulo: 'Completar perfil',
      descricao: 'Adicione uma foto de perfil à sua conta',
      pontos: '+500 pts',
      completo: !bloqueado && temAvatarURL,
      bloqueado,
      progresso: bloqueado ? 0 : temAvatarURL ? 1 : 0,
      labelProgresso: temAvatarURL ? 'Foto adicionada' : 'Sem foto de perfil',
      delay: 100,
    },
    {
      id: 'onboarding-carteira',
      Icon: Wallet,
      titulo: 'Criar carteira Solana',
      descricao: 'Vincule seu endereço de carteira Phantom',
      pontos: '+1.000 pts',
      completo: !bloqueado && temWallet,
      bloqueado,
      progresso: bloqueado ? 0 : temWallet ? 1 : 0,
      labelProgresso: temWallet ? 'Carteira vinculada' : 'Carteira não configurada',
      delay: 140,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [bloqueado, temAvatarURL, temWallet]);

  const onboardingCompleto = MISSOES_ONBOARDING.every(m => m.completo);

  // ── Missões diárias ───────────────────────────────────────────────────────
  const MISSOES_DIARIAS = useMemo(() => ordenarMissoes([
    {
      id: 'diaria-login',
      Icon: LogIn,
      titulo: 'Login diário',
      descricao: 'Abrir o app ao menos uma vez por dia',
      pontos: '+100 pts',
      completo: loginHojeOk,
      bloqueado,
      progresso: loginHojeOk ? 1 : 0,
      labelProgresso: loginHojeOk ? '1/1 — sessão ativa' : '0/1 — abra o app hoje',
      delay: 160,
    },
    {
      id: 'diaria-carregar',
      Icon: Zap,
      titulo: 'Carregar hoje',
      descricao: 'Conecte o carregador e acumule pontos hoje',
      pontos: '+500 pts',
      completo: !bloqueado && hojeOk,
      bloqueado,
      progresso: bloqueado ? 0 : hojeOk ? 1 : 0,
      labelProgresso: hojeOk ? 'Concluído hoje' : 'Nenhum carregamento hoje',
      delay: 200,
    },
  ]), [bloqueado, hojeOk, loginHojeOk]);

  // ── Missões semanais ──────────────────────────────────────────────────────
  const MISSOES_SEMANAIS = useMemo(() => ordenarMissoes([
    {
      id: 'semanal-pontos',
      Icon: TrendingUp,
      titulo: 'Acumular 1.000 pts esta semana',
      descricao: 'Some 1.000 pontos nos últimos 7 dias',
      pontos: '+200 pts',
      completo: !bloqueado && semanaTotal >= 1000,
      bloqueado,
      progresso: bloqueado ? 0 : Math.min(semanaTotal / 1000, 1),
      labelProgresso: bloqueado
        ? '0/1.000 pts'
        : `${semanaTotal.toLocaleString('pt-BR')}/1.000 pts`,
      delay: 280,
    },
    {
      id: 'semanal-amigo',
      Icon: UserPlus,
      titulo: 'Convidar 1 amigo',
      descricao: 'Indique um amigo com seu código de referência',
      pontos: '+2.000 pts',
      completo: !bloqueado && referidos >= 1,
      bloqueado,
      progresso: bloqueado ? 0 : Math.min(referidos, 1),
      labelProgresso: bloqueado ? '0/1 amigo' : `${Math.min(referidos, 1)}/1 amigo`,
      delay: 320,
    },
    {
      id: 'semanal-streak',
      Icon: Flame,
      titulo: 'Carregar 3 dias seguidos',
      descricao: 'Carregue o celular em 3 dias consecutivos',
      pontos: '+1.000 pts',
      completo: !bloqueado && consec >= 3,
      bloqueado,
      progresso: bloqueado ? 0 : Math.min(consec / 3, 1),
      labelProgresso: bloqueado ? '0/3 dias' : `${Math.min(consec, 3)}/3 dias`,
      delay: 360,
    },
  ]), [bloqueado, semanaTotal, referidos, consec]);

  return (
    <LinearGradient
      colors={['#0b1310', '#0a0f0d', '#000000']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ── */}
          <Animated.View style={[a0, { marginBottom: 24 }]}>
            <Text style={{ fontSize: 12, color: TEXT_FAINT, marginBottom: 4 }}>
              Missões
            </Text>
            <Text style={{ fontSize: 26, fontWeight: '700', color: '#fff', letterSpacing: -0.5 }}>
              Seus desafios
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>
              Complete missões e ganhe pontos extras
            </Text>
          </Animated.View>

          {/* ── Banner de login (apenas quando não logado) ── */}
          {bloqueado && (
            <Animated.View style={[a1, {
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: 'rgba(198,255,74,0.06)',
              borderWidth: 1, borderColor: 'rgba(198,255,74,0.18)',
              borderRadius: 14, padding: 14, marginBottom: 24,
            }]}>
              <Lock size={18} color={PRIMARY} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 2 }}>
                  Faça login para participar
                </Text>
                <Text style={{ fontSize: 11, color: TEXT_FAINT, lineHeight: 16 }}>
                  Entre na sua conta para desbloquear as missões.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation?.navigate?.('Login')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Fazer login para desbloquear missões"
                style={{
                  backgroundColor: PRIMARY, borderRadius: 10,
                  paddingHorizontal: 12, paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 11 }}>Entrar</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── Primeiros passos ── */}
          <Secao
            titulo="Primeiros passos"
            subtitulo="Complete uma vez e ganhe bônus permanente"
            animStyle={a1}
          />
          {onboardingCompleto
            ? <BannerOnboardingCompleto animStyle={a1} />
            : MISSOES_ONBOARDING.map(m => <MissionCard key={m.id} {...m} />)
          }

          <View style={{ height: 8 }} />

          {/* ── Missões diárias ── */}
          <Secao
            titulo="Diárias"
            subtitulo="Renovam todo dia à meia-noite"
            getCountdownFn={segsAteMeiaNoite}
            animStyle={a2}
          />
          {MISSOES_DIARIAS.map(m => (
            <MissionCard key={m.id} {...m} />
          ))}

          <View style={{ height: 8 }} />

          {/* ── Missões semanais ── */}
          <Secao
            titulo="Semanais"
            subtitulo="Renovam toda segunda-feira"
            getCountdownFn={segsAteSegunda}
            animStyle={a3}
          />
          {MISSOES_SEMANAIS.map(m => (
            <MissionCard key={m.id} {...m} />
          ))}

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
