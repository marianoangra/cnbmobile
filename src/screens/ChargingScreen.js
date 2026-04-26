import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withTiming, withDelay, withRepeat, withSequence, withSpring,
  Easing, cancelAnimation, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Ellipse, Defs, RadialGradient, Stop } from 'react-native-svg';
import * as Battery from 'expo-battery';
import { Zap, Plug, TrendingUp } from 'lucide-react-native';
import { useCarregamento } from '../hooks/useCarregamento';
import { calcularAtividadeDiaria } from '../services/pontos';

// ── Constantes ────────────────────────────────────────────────────────────────
const NEON         = '#00FF7F';  // spring green — cor base da esfera
const NEON_TRIGGER = '#39FF14';  // lime elétrico — ativado ao atingir zona de disparo
const NEON_DARK    = '#00994D';  // sombra da esfera
const PRIMARY      = '#c6ff4a';  // mantido para seção inferior (consistência com o app)
const PULL_TRIGGER = 150;        // px para disparar atualização
const SZ           = 290;        // tamanho do container da esfera
const CC           = SZ / 2;     // centro

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// ── Anel orbital ──────────────────────────────────────────────────────────────
function OrbitalRing({ rx, ry, period, dashArray, color, strokeOpacity = 0.45, strokeWidth = 1.2, delay = 0, reverse = false }) {
  const rot = useSharedValue(0);

  useEffect(() => {
    rot.value = withDelay(
      delay,
      withRepeat(
        withTiming(reverse ? -360 : 360, { duration: period, easing: Easing.linear }),
        -1, false,
      ),
    );
    return () => cancelAnimation(rot);
  }, []);

  const rotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  return (
    <Animated.View
      style={[{ position: 'absolute', width: SZ, height: SZ }, rotStyle]}
      pointerEvents="none"
    >
      <Svg width={SZ} height={SZ}>
        <Ellipse
          cx={CC} cy={CC} rx={rx} ry={ry}
          stroke={color} strokeWidth={strokeWidth}
          fill="none" strokeOpacity={strokeOpacity}
          strokeDasharray={dashArray}
        />
      </Svg>
    </Animated.View>
  );
}

// ── Partícula orbital ─────────────────────────────────────────────────────────
// Orbita em torno do centro, percorrendo o anel principal
function OrbitalParticle({ color, period, radius }) {
  const rot = useSharedValue(0);

  useEffect(() => {
    rot.value = withRepeat(
      withTiming(360, { duration: period, easing: Easing.linear }),
      -1, false,
    );
    return () => cancelAnimation(rot);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: SZ, height: SZ }, style]}
    >
      <Svg width={SZ} height={SZ}>
        {/* ponto brilhante */}
        <Circle cx={CC + radius} cy={CC} r={5}   fill={color} opacity={0.9} />
        <Circle cx={CC + radius} cy={CC} r={9}   fill={color} opacity={0.35} />
        <Circle cx={CC + radius} cy={CC} r={14}  fill={color} opacity={0.12} />
      </Svg>
    </Animated.View>
  );
}

// ── Esfera Futurista ──────────────────────────────────────────────────────────
function EsferaFuturista({ carregando, pullY, phase }) {
  // Animações internas
  const floatY    = useSharedValue(0);   // flutuação idle
  const pulse     = useSharedValue(1);   // escala pulsante
  const glowAlpha = useSharedValue(0.12);
  const flashAnim = useSharedValue(0);   // flash de sucesso
  const ringAlpha = useSharedValue(0.45);

  // ── Idle float (sempre ativo) ─────────────────────────────────────────────
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-9, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(9,  { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    );
    return () => cancelAnimation(floatY);
  }, []);

  // ── Animação de carregamento ──────────────────────────────────────────────
  useEffect(() => {
    if (carregando) {
      // Pulsação da esfera
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 820, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.95, { duration: 820, easing: Easing.inOut(Easing.quad) }),
        ),
        -1, true,
      );
      // Glow pulsante
      glowAlpha.value = withRepeat(
        withSequence(
          withTiming(0.72, { duration: 680 }),
          withTiming(0.22, { duration: 680 }),
        ),
        -1, true,
      );
      // Anéis ficam mais vivos
      ringAlpha.value = withTiming(0.65, { duration: 500 });
    } else {
      cancelAnimation(pulse);
      cancelAnimation(glowAlpha);
      pulse.value     = withSpring(1, { damping: 12, stiffness: 180 });
      glowAlpha.value = withTiming(0.12, { duration: 600 });
      ringAlpha.value = withTiming(0.45, { duration: 400 });
    }
  }, [carregando]);

  // ── Animação de sucesso (flash + contração) ───────────────────────────────
  useEffect(() => {
    if (phase === 'success') {
      flashAnim.value = withSequence(
        withTiming(0.85, { duration: 90  }),
        withTiming(0,    { duration: 550 }),
      );
      pulse.value = withSequence(
        withTiming(1.40,  { duration: 100 }),
        withTiming(0.82,  { duration: 180 }),
        withSpring(1.0, { damping: 14, stiffness: 200 }),
      );
    }
  }, [phase]);

  const isTriggered = phase === 'triggered' || phase === 'refreshing' || phase === 'success';
  const neon     = isTriggered ? NEON_TRIGGER : NEON;
  const neonDark = isTriggered ? '#00AA00'    : NEON_DARK;

  // ── Estilo animado da esfera (responde ao pull) ───────────────────────────
  const sphereStyle = useAnimatedStyle(() => {
    const pY       = pullY.value;
    const pullMove = Math.min(pY * 0.52, 108);
    const pullScl  = 1 + Math.min(pY / PULL_TRIGGER, 1) * 0.11;
    return {
      transform: [
        { translateY: floatY.value + pullMove },
        { scale: pulse.value * pullScl },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowAlpha.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashAnim.value }));

  // ── Texto dinâmico ────────────────────────────────────────────────────────
  const textLabel = (() => {
    if (phase === 'triggered')  return { text: 'Solte para atualizar', color: NEON_TRIGGER };
    if (phase === 'pulling')    return { text: 'Puxe para atualizar',  color: NEON };
    if (phase === 'refreshing') return { text: 'Atualizando...',       color: NEON_TRIGGER };
    if (phase === 'success')    return { text: 'Atualizado',           color: NEON_TRIGGER };
    if (carregando)             return { text: 'Carregando ativo',     color: NEON };
    return { text: 'Em pausa', color: 'rgba(255,255,255,0.3)' };
  })();

  return (
    <View style={{ width: SZ, height: SZ, alignItems: 'center', justifyContent: 'center' }}>

      {/* Glow externo difuso */}
      <Animated.View
        pointerEvents="none"
        style={[{
          position: 'absolute',
          width: 230, height: 230, borderRadius: 115,
          backgroundColor: neon,
        }, glowStyle]}
      />

      {/* Anéis orbitais — giram independentemente */}
      <OrbitalRing
        rx={106} ry={24}  period={13500} dashArray="4 11"
        color={neon} strokeOpacity={isTriggered ? 0.65 : 0.4}
        delay={0}
      />
      <OrbitalRing
        rx={90}  ry={32}  period={8400}  dashArray="2 8"
        color={neon} strokeOpacity={isTriggered ? 0.7 : 0.5} strokeWidth={1.4}
        delay={300} reverse
      />
      <OrbitalRing
        rx={120} ry={14}  period={22000} dashArray="1 16"
        color={neon} strokeOpacity={isTriggered ? 0.4 : 0.2}
        delay={700}
      />

      {/* Partícula orbital no anel principal */}
      <OrbitalParticle color={neon} period={4200} radius={106} />

      {/* Esfera + texto dinâmico */}
      <Animated.View style={[{ alignItems: 'center' }, sphereStyle]}>

        {/* SVG da esfera com gradiente radial 3D */}
        <Svg width={144} height={144}>
          <Defs>
            <RadialGradient id="sphGrad" cx="36%" cy="32%" r="64%">
              <Stop offset="0%"   stopColor="#ffffff"  stopOpacity="0.95" />
              <Stop offset="18%"  stopColor={neon}     stopOpacity="1" />
              <Stop offset="62%"  stopColor={neonDark} stopOpacity="1" />
              <Stop offset="100%" stopColor="#001508"  stopOpacity="1" />
            </RadialGradient>
            <RadialGradient id="auraGrad" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor={neon} stopOpacity="0.32" />
              <Stop offset="100%" stopColor={neon} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {/* Aura suave ao redor */}
          <Circle cx={72} cy={72} r={70}  fill="url(#auraGrad)" />
          {/* Esfera principal */}
          <Circle cx={72} cy={72} r={54}  fill="url(#sphGrad)" />
          {/* Reflexo difuso */}
          <Circle cx={54} cy={50} r={13}  fill="rgba(255,255,255,0.18)" />
          {/* Ponto especular nítido */}
          <Circle cx={49} cy={45} r={5}   fill="rgba(255,255,255,0.58)" />
          <Circle cx={44} cy={41} r={2}   fill="rgba(255,255,255,0.85)" />
        </Svg>

        {/* Texto de estado */}
        <Text style={{
          marginTop: 14,
          fontSize: 9, letterSpacing: 2.8, textTransform: 'uppercase', fontWeight: '700',
          color: textLabel.color,
        }}>
          {textLabel.text}
        </Text>
      </Animated.View>

      {/* Flash de sucesso */}
      <Animated.View
        pointerEvents="none"
        style={[{
          position: 'absolute',
          width: 180, height: 180, borderRadius: 90,
          backgroundColor: neon,
        }, flashStyle]}
      />
    </View>
  );
}

// ── Barra de progresso 1 hora ─────────────────────────────────────────────────
function ProgressoHora({ segundosRestantes, carregando }) {
  const progresso = (3600 - segundosRestantes) / 3600;
  const barWidth  = useSharedValue(progresso);

  useEffect(() => {
    barWidth.value = withTiming(progresso, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [segundosRestantes]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
  }));

  const mins    = Math.floor(segundosRestantes / 60);
  const secs    = segundosRestantes % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const pct     = Math.round(progresso * 100);

  return (
    <View style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Progresso da hora</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: carregando ? PRIMARY : 'rgba(255,255,255,0.25)' }}>
          {carregando ? `${timeStr} restante` : '--:--'}
        </Text>
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 6, borderRadius: 99, backgroundColor: PRIMARY }, barStyle]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
          {carregando ? '+50 pts bônus ao completar 1h' : 'Conecte o carregador para iniciar'}
        </Text>
        {carregando && (
          <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '600' }}>{pct}%</Text>
        )}
      </View>
    </View>
  );
}

// ── Bar chart 10 dias ──────────────────────────────────────────────────────────
const STATIC_BARS = [28, 42, 35, 58, 40, 72, 55, 68, 85, 78];

function BarChart({ heights }) {
  const bars = heights.every(h => h === 0) ? STATIC_BARS : heights;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 52 }}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={{
            width: 6, borderRadius: 3,
            height: (h / 100) * 52,
            backgroundColor: PRIMARY,
            opacity: 0.3 + (h / 100) * 0.7,
          }}
        />
      ))}
    </View>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function ChargingScreen({ route, navigation }) {
  const { user, uid, perfil, onAtualizar } = route?.params || {};
  const { carregando, pontosGanhos, segundosRestantes } = useCarregamento(uid, onAtualizar);

  const [bateria, setBateria] = useState(0);
  const [phase, setPhase]     = useState('idle');
  // 'idle' | 'pulling' | 'triggered' | 'refreshing' | 'success'

  useEffect(() => {
    Battery.getBatteryLevelAsync()
      .then(l => setBateria(Math.round(l * 100)))
      .catch(() => {});
    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) =>
      setBateria(Math.round(batteryLevel * 100))
    );
    return () => sub?.remove();
  }, []);

  // ── Animação de entrada ──────────────────────────────────────────────────
  const entrada  = useSharedValue(0);
  const entradaY = useSharedValue(24);
  useEffect(() => {
    const cfg = { duration: 520, easing: Easing.out(Easing.cubic) };
    entrada.value  = withTiming(1, cfg);
    entradaY.value = withTiming(0, cfg);
  }, []);
  const entradaStyle = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateY: entradaY.value }],
  }));

  // ── Pull-to-refresh ──────────────────────────────────────────────────────
  const pullY = useSharedValue(0);

  async function handleRefresh() {
    setPhase('refreshing');
    try {
      await Promise.race([
        onAtualizar?.() ?? Promise.resolve(),
        new Promise(res => setTimeout(res, 1600)),
      ]);
    } catch {}
    setPhase('success');
    setTimeout(() => setPhase('idle'), 1200);
  }

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        pullY.value = Math.min(event.translationY * 0.58, 200);
        if (pullY.value >= PULL_TRIGGER) {
          runOnJS(setPhase)('triggered');
        } else if (pullY.value > 8) {
          runOnJS(setPhase)('pulling');
        }
      }
    })
    .onEnd(() => {
      const didTrigger = pullY.value >= PULL_TRIGGER;
      pullY.value = withSpring(0, { damping: 20, stiffness: 220 });
      if (didTrigger) {
        runOnJS(handleRefresh)();
      } else {
        runOnJS(setPhase)('idle');
      }
    });

  const podeSacar  = (perfil?.pontos ?? 0) >= 100000;
  const barHeights = calcularAtividadeDiaria(perfil?.atividadeDias);

  // ── Gate de login ─────────────────────────────────────────────────────────
  if (!user) {
    return (
      <LinearGradient colors={['#0A0F1E', '#040810', '#000000']} locations={[0, 0.6, 1]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <Animated.View style={[{
            flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
          }, entradaStyle]}>
            <View style={{
              width: 96, height: 96, borderRadius: 48,
              backgroundColor: 'rgba(0,255,127,0.08)',
              borderWidth: 1.5, borderColor: 'rgba(0,255,127,0.2)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 28,
            }}>
              <Zap size={40} color={NEON} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 10 }}>
              Ganhe pontos carregando
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 21, marginBottom: 36 }}>
              Conecte-se à sua conta e acumule pontos reais enquanto carrega seu celular.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
              style={{
                backgroundColor: NEON, borderRadius: 14,
                paddingVertical: 14, width: '100%', alignItems: 'center',
              }}
            >
              <Text style={{ color: '#001508', fontWeight: '700', fontSize: 16 }}>Entrar / Cadastrar</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0A0F1E', '#040810', '#000000']} locations={[0, 0.6, 1]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Animated.View style={[{ flex: 1 }, entradaStyle]}>

          {/* ── Área da esfera com gesto de pull ── */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <EsferaFuturista
                carregando={carregando}
                pullY={pullY}
                phase={phase}
              />

              {/* Pontos + bateria abaixo da esfera */}
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <Text style={{
                  fontSize: 38, fontWeight: '600', letterSpacing: -0.5,
                  color: carregando ? NEON : 'rgba(255,255,255,0.55)',
                }}>
                  +{pontosGanhos.toLocaleString('pt-BR')}
                </Text>
                <Text style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginTop: 2 }}>
                  pontos on-chain
                </Text>
                {bateria > 0 && (
                  <View style={{
                    marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                  }}>
                    <Zap size={10} color="rgba(255,255,255,0.35)" />
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      Bateria {bateria}%
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          </GestureDetector>

          {/* ── Seção inferior ── */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 120, gap: 10 }}>

            {/* Card de recompensa + bar chart */}
            <LinearGradient
              colors={['#0d1a24', '#080f18']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: 'rgba(0,255,127,0.14)',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Recompensa acumulada</Text>
                <Text style={{ fontSize: 24, fontWeight: '600', color: PRIMARY, marginTop: 2 }}>
                  +{pontosGanhos.toLocaleString('pt-BR')}
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>pontos · on-chain</Text>
              </View>
              <BarChart heights={barHeights} />
            </LinearGradient>

            {/* Progresso da hora */}
            <ProgressoHora segundosRestantes={segundosRestantes} carregando={carregando} />

            {/* Botão de saque */}
            {podeSacar && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Withdraw', { perfil })}
                activeOpacity={0.88}
                style={{
                  backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <TrendingUp size={16} color="#000" />
                <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>Saque disponível</Text>
              </TouchableOpacity>
            )}

            {/* Badge de estado */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: carregando ? 'rgba(0,255,127,0.07)' : 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: carregando ? 'rgba(0,255,127,0.18)' : 'rgba(255,255,255,0.08)',
              borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7,
            }}>
              {carregando ? (
                <>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: NEON }} />
                  <Text style={{ fontSize: 12, color: NEON, fontWeight: '600' }}>
                    Sessão ativa · +{pontosGanhos.toLocaleString('pt-BR')} pts
                  </Text>
                </>
              ) : (
                <>
                  <Plug size={12} color="rgba(255,255,255,0.35)" />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                    Conecte o USB para começar
                  </Text>
                </>
              )}
            </View>

            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
              Saque disponível a partir de 100.000 pontos.
            </Text>
          </View>

        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}
