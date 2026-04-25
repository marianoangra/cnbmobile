import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import {
  Zap, LogIn, User, Wallet, TrendingUp, UserPlus, Flame, CheckCircle, Lock,
} from 'lucide-react-native';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIMARY = '#c6ff4a';

// ─── Helpers de data ──────────────────────────────────────────────────────────
function diaKey(offsetDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDias);
  return (
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, '0')}` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

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
function BarraProgresso({ progresso, completo }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(300, withTiming(progresso, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    }));
  }, [progresso]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));
  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderRadius: 99, height: 6, overflow: 'hidden',
    }}>
      <Animated.View style={[{
        height: 6, borderRadius: 99,
        backgroundColor: completo ? PRIMARY : 'rgba(198,255,74,0.55)',
      }, barStyle]} />
    </View>
  );
}

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
      <Lock size={10} color="rgba(255,255,255,0.4)" />
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Bloqueado</Text>
    </View>
  );
}

function MissionCard({ Icon, titulo, descricao, pontos, completo, bloqueado, progresso, labelProgresso, delay }) {
  const animStyle = useEntrada(delay);
  return (
    <Animated.View style={[animStyle, {
      backgroundColor: completo ? 'rgba(198,255,74,0.05)' : 'rgba(255,255,255,0.03)',
      borderWidth: 1,
      borderColor: completo ? 'rgba(198,255,74,0.18)' : 'rgba(255,255,255,0.07)',
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      opacity: bloqueado ? 0.55 : 1,
    }]}>

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
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 16 }}>
            {descricao}
          </Text>
        </View>

        <View style={{
          backgroundColor: 'rgba(198,255,74,0.08)',
          borderWidth: 1, borderColor: 'rgba(198,255,74,0.15)',
          borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4,
        }}>
          <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '700' }}>{pontos}</Text>
        </View>
      </View>

      {/* Barra de progresso */}
      <BarraProgresso progresso={progresso} completo={completo} />

      {/* Rodapé: label de progresso + badge de status */}
      <View style={{
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginTop: 8,
      }}>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>
          {labelProgresso}
        </Text>
        {completo ? <BadgeCompleto /> : bloqueado ? <BadgeBloqueado /> : null}
      </View>
    </Animated.View>
  );
}

function Secao({ titulo, subtitulo, animStyle }) {
  return (
    <Animated.View style={[animStyle, { marginBottom: 12 }]}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{titulo}</Text>
      {subtitulo ? (
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{subtitulo}</Text>
      ) : null}
    </Animated.View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function MissoesScreen({ route, navigation }) {
  const { user, perfil } = route?.params || {};

  const bloqueado      = !user;
  const atividadeDias  = perfil?.atividadeDias ?? {};
  const referidos      = perfil?.referidos ?? 0;

  const hojeOk    = carregouHoje(atividadeDias);
  const semanaTotal = ptsSemana(atividadeDias);
  const consec    = diasConsecutivos(atividadeDias);

  const a0 = useEntrada(0);
  const a1 = useEntrada(60);
  const a2 = useEntrada(120);
  const a3 = useEntrada(200);

  const MISSOES_DIARIAS = [
    {
      Icon: Zap,
      titulo: 'Carregar hoje',
      descricao: 'Conecte o carregador e acumule pontos hoje',
      pontos: '+500 pts',
      completo: !bloqueado && hojeOk,
      bloqueado,
      progresso: bloqueado ? 0 : hojeOk ? 1 : 0,
      labelProgresso: hojeOk ? 'Concluído hoje' : 'Nenhum carregamento hoje',
      delay: 120,
    },
    {
      Icon: LogIn,
      titulo: 'Login diário',
      descricao: 'Abrir o app ao menos uma vez por dia',
      pontos: '+100 pts',
      completo: !bloqueado,
      bloqueado,
      progresso: bloqueado ? 0 : 1,
      labelProgresso: bloqueado ? '0/1' : '1/1',
      delay: 160,
    },
    {
      Icon: User,
      titulo: 'Completar perfil',
      descricao: 'Adicione uma foto de perfil à sua conta',
      pontos: '+500 pts',
      completo: !bloqueado && !!perfil?.avatarURL,
      bloqueado,
      progresso: bloqueado ? 0 : perfil?.avatarURL ? 1 : 0,
      labelProgresso: perfil?.avatarURL ? 'Foto adicionada' : 'Sem foto de perfil',
      delay: 200,
    },
    {
      Icon: Wallet,
      titulo: 'Criar carteira Solana',
      descricao: 'Vincule seu endereço de carteira Phantom',
      pontos: '+1.000 pts',
      completo: !bloqueado && !!perfil?.walletAddress,
      bloqueado,
      progresso: bloqueado ? 0 : perfil?.walletAddress ? 1 : 0,
      labelProgresso: perfil?.walletAddress ? 'Carteira vinculada' : 'Carteira não configurada',
      delay: 240,
    },
  ];

  const MISSOES_SEMANAIS = [
    {
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
  ];

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
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              Missões
            </Text>
            <Text style={{
              fontSize: 26, fontWeight: '700', color: '#fff', letterSpacing: -0.5,
            }}>
              Seus desafios
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', marginTop: 4 }}>
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
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 16 }}>
                  Entre na sua conta para desbloquear as missões.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation?.navigate?.('Login')}
                activeOpacity={0.85}
                style={{
                  backgroundColor: PRIMARY, borderRadius: 10,
                  paddingHorizontal: 12, paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 11 }}>Entrar</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── Missões diárias ── */}
          <Secao
            titulo="Diárias"
            subtitulo="Renovam todo dia à meia-noite"
            animStyle={a1}
          />
          {MISSOES_DIARIAS.map(m => (
            <MissionCard key={m.titulo} {...m} />
          ))}

          <View style={{ height: 8 }} />

          {/* ── Missões semanais ── */}
          <Secao
            titulo="Semanais"
            subtitulo="Renovam toda segunda-feira"
            animStyle={a2}
          />
          {MISSOES_SEMANAIS.map(m => (
            <MissionCard key={m.titulo} {...m} />
          ))}

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
