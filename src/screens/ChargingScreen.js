import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withTiming, withDelay, withRepeat, withSequence,
  Easing, interpolate, cancelAnimation,
} from 'react-native-reanimated';
import Svg, {
  Circle, Defs, LinearGradient as SvgGradient, Stop,
  RadialGradient,
} from 'react-native-svg';
import * as Battery from 'expo-battery';
import { Zap, Plug, TrendingUp } from 'lucide-react-native';
import { useCarregamento } from '../hooks/useCarregamento';
import { calcularAtividadeDiaria } from '../services/pontos';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIMARY = '#c6ff4a';
const R        = 92;
const SW       = 14;
const CX       = 110;
const CY       = 110;
const CIRC     = 2 * Math.PI * R;
const SVG_SIZE = 220;

// Platinum palette — ativada silenciosamente para 100k+ pontos
const PT = {
  arc1:  '#FFFFFF',
  arc2:  '#D4D8DC',
  arc3:  '#8EA0AC',
  halo:  'rgba(210,220,228,0.13)',
  glow:  'rgba(220,228,234,0.18)',
  ring:  'rgba(200,210,218,0.45)',
  inner: 'rgba(220,228,234,',
  spark1: '#FFFFFF',
  spark2: '#B8C8D4',
  text:  '#E8EEF2',
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Anel SVG ────────────────────────────────────────────────────────────────
function AnelSVG({ pct, carregando, platinum }) {
  const dashOffset = useSharedValue(CIRC);
  const plasmaRot  = useSharedValue(0);
  const innerAlpha = useSharedValue(0.15);

  useEffect(() => {
    dashOffset.value = withDelay(300,
      withTiming(CIRC - (pct / 100) * CIRC, { duration: 1600, easing: Easing.bezier(0.22, 1, 0.36, 1) })
    );
  }, [pct]);

  // Animações condicionadas ao estado de carregamento
  useEffect(() => {
    if (carregando) {
      plasmaRot.value = withRepeat(withTiming(360, { duration: 3600, easing: Easing.linear }), -1, false);
      innerAlpha.value = withRepeat(
        withSequence(withTiming(0.5, { duration: 1200 }), withTiming(0.15, { duration: 1200 })),
        -1, true,
      );
    } else {
      cancelAnimation(plasmaRot);
      cancelAnimation(innerAlpha);
      innerAlpha.value = withTiming(0.15, { duration: 400 });
    }
    return () => {
      cancelAnimation(plasmaRot);
      cancelAnimation(innerAlpha);
    };
  }, [carregando]);

  const mainArcProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const plasmaRotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${plasmaRot.value}deg` }],
  }));

  const innerAlphaProps = useAnimatedProps(() => ({
    strokeOpacity: innerAlpha.value,
  }));

  const arc1  = platinum ? PT.arc1  : '#E4FF8A';
  const arc2  = platinum ? PT.arc2  : PRIMARY;
  const arc3  = platinum ? PT.arc3  : '#2ecc71';
  const pCol  = platinum ? PT.spark1 : PRIMARY;
  const haloC = platinum ? PT.halo  : 'rgba(198,255,74,0.10)';
  const ringC = platinum ? PT.ring  : PRIMARY;
  const textActive = platinum ? PT.text : PRIMARY;

  return (
    <View style={{ width: SVG_SIZE, height: SVG_SIZE, alignItems: 'center', justifyContent: 'center' }}>

      {/* Halo de fundo */}
      <View style={{
        position: 'absolute', width: 320, height: 320, borderRadius: 160,
        backgroundColor: haloC,
        top: (SVG_SIZE - 320) / 2, left: (SVG_SIZE - 320) / 2,
      }} pointerEvents="none" />

      {/* Anel extra platinum — borda prateada dupla */}
      {platinum && (
        <View style={{
          position: 'absolute', width: SVG_SIZE + 18, height: SVG_SIZE + 18,
          borderRadius: (SVG_SIZE + 18) / 2,
          borderWidth: 1, borderColor: 'rgba(210,220,228,0.18)',
          top: -9, left: -9,
        }} pointerEvents="none" />
      )}

      <Svg width={SVG_SIZE} height={SVG_SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%"   stopColor={arc1} />
            <Stop offset="50%"  stopColor={arc2} />
            <Stop offset="100%" stopColor={arc3} />
          </SvgGradient>
          <SvgGradient id="plasmaGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%"   stopColor={pCol} stopOpacity="0" />
            <Stop offset="60%"  stopColor={pCol} stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </SvgGradient>
          <RadialGradient id="sparkGrad">
            <Stop offset="0%"   stopColor="#ffffff" stopOpacity="1" />
            <Stop offset="60%"  stopColor={pCol} stopOpacity="0.6" />
            <Stop offset="100%" stopColor={pCol} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="coreHalo" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0%"   stopColor={arc2} stopOpacity={platinum ? '0.2' : '0.3'} />
            <Stop offset="100%" stopColor={arc2} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Halo interno */}
        <Circle cx={CX} cy={CY} r={R + 28} fill="url(#coreHalo)" />

        {/* Trilha */}
        <Circle cx={CX} cy={CY} r={R} stroke="rgba(255,255,255,0.06)" strokeWidth={SW} fill="none" />
        {/* Anel fino externo */}
        <Circle cx={CX} cy={CY} r={R + 8} stroke="rgba(255,255,255,0.05)" strokeWidth="1" fill="none" />

        {/* Arco principal animado */}
        <AnimatedCircle
          cx={CX} cy={CY} r={R}
          stroke="url(#coreGrad)"
          strokeWidth={SW}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          animatedProps={mainArcProps}
        />

        {/* Anel tracejado externo */}
        <Circle
          cx={CX} cy={CY} r={R + 16}
          stroke={ringC}
          strokeOpacity={platinum ? '0.5' : '0.35'}
          strokeWidth={platinum ? '1.5' : '1'}
          fill="none"
          strokeDasharray={platinum ? '3 6' : '2 8'}
        />

        {/* Anel interno pulsante */}
        <AnimatedCircle
          cx={CX} cy={CY} r={R - 14}
          stroke={platinum ? PT.arc2 : PRIMARY}
          strokeWidth={platinum ? '1.5' : '1'}
          fill="none"
          animatedProps={innerAlphaProps}
        />

        {/* Platinum: segundo anel interno */}
        {platinum && (
          <Circle
            cx={CX} cy={CY} r={R - 28}
            stroke="rgba(210,220,228,0.12)" strokeWidth="1" fill="none"
          />
        )}
      </Svg>

      {/* Plasma spark — só quando carregando */}
      {carregando && (
        <Animated.View
          style={[{
            position: 'absolute', width: SVG_SIZE, height: SVG_SIZE,
            alignItems: 'center', justifyContent: 'center',
          }, plasmaRotStyle]}
          pointerEvents="none"
        >
          <Svg width={SVG_SIZE} height={SVG_SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Circle
              cx={CX} cy={CY} r={R}
              stroke="url(#plasmaGrad)" strokeWidth={platinum ? '5' : '4'} fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRC * 0.22} ${CIRC}`}
            />
            <Circle cx={CX + R} cy={CY} r={platinum ? 12 : 10} fill="url(#sparkGrad)" />
            <Circle cx={CX + R} cy={CY} r={3} fill="#ffffff" />
          </Svg>
        </Animated.View>
      )}

      {/* Centro */}
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{
          fontSize: 10, letterSpacing: 4,
          color: carregando ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
        }}>
          {carregando ? 'ATIVIDADE' : 'BATERIA'}
        </Text>
        <Text style={{
          fontSize: 48, fontWeight: '600',
          color: carregando ? textActive : 'rgba(255,255,255,0.7)',
          lineHeight: 52, letterSpacing: -1,
        }}>
          {pct}%
        </Text>
        {!carregando && (
          <Text style={{
            fontSize: 10, letterSpacing: 3,
            color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase',
          }}>
            Em pausa
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Barra de progresso 1 hora ────────────────────────────────────────────────
function ProgressoHora({ segundosRestantes, carregando }) {
  const progresso = (3600 - segundosRestantes) / 3600;
  const barWidth = useSharedValue(progresso);

  useEffect(() => {
    barWidth.value = withTiming(progresso, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [segundosRestantes]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${interpolate(barWidth.value, [0, 1], [0, 100])}%`,
  }));

  const mins = Math.floor(segundosRestantes / 60);
  const secs = segundosRestantes % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const pct = Math.round(progresso * 100);

  return (
    <View style={{ width: '100%' }}>
      {/* Cabeçalho */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          Progresso da hora
        </Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: carregando ? PRIMARY : 'rgba(255,255,255,0.25)' }}>
          {carregando ? `${timeStr} restante` : '--:--'}
        </Text>
      </View>

      {/* Trilha */}
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 99, height: 6, overflow: 'hidden',
      }}>
        <Animated.View style={[{
          height: 6, borderRadius: 99, backgroundColor: PRIMARY,
        }, barStyle]} />
      </View>

      {/* Rodapé */}
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

// ─── Bar chart 10 dias ────────────────────────────────────────────────────────
// Valores de referência Figma — exibidos enquanto dado real não está disponível
const STATIC_BARS = [28, 42, 35, 58, 40, 72, 55, 68, 85, 78];

function BarChart({ heights }) {
  const bars = heights.every(h => h === 0) ? STATIC_BARS : heights;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 56 }}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={{
            width: 6, borderRadius: 3,
            height: (h / 100) * 56,
            backgroundColor: PRIMARY,
            opacity: 0.3 + (h / 100) * 0.7,
          }}
        />
      ))}
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function ChargingScreen({ route, navigation }) {
  const { user, uid, perfil, onAtualizar } = route?.params || {};
  const { carregando, pontosGanhos, segundosRestantes } = useCarregamento(uid, onAtualizar);

  const [bateria, setBateria] = useState(0);
  useEffect(() => {
    Battery.getBatteryLevelAsync()
      .then(l => setBateria(Math.round(l * 100)))
      .catch(() => {});
    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) =>
      setBateria(Math.round(batteryLevel * 100))
    );
    return () => sub?.remove();
  }, []);

  // Animação de entrada
  const entrada  = useSharedValue(0);
  const entradaY = useSharedValue(24);
  useEffect(() => {
    const cfg = { duration: 500, easing: Easing.out(Easing.cubic) };
    entrada.value  = withTiming(1, cfg);
    entradaY.value = withTiming(0, cfg);
  }, []);
  const entradaStyle = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateY: entradaY.value }],
  }));

  const podeSacar  = (perfil?.pontos ?? 0) >= 100000;
  const platinum   = (perfil?.pontos ?? 0) >= 100000;
  const barHeights = calcularAtividadeDiaria(perfil?.atividadeDias);

  // ── Gate de login ──
  if (!user) {
    return (
      <LinearGradient colors={['#000000', '#05100b', '#071a12']} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <Animated.View style={[{
            flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
          }, entradaStyle]}>
            <View style={{
              width: 96, height: 96, borderRadius: 48,
              backgroundColor: 'rgba(198,255,74,0.08)',
              borderWidth: 1.5, borderColor: 'rgba(198,255,74,0.2)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 28,
            }}>
              <Zap size={40} color={PRIMARY} />
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
                backgroundColor: PRIMARY, borderRadius: 14,
                paddingVertical: 14, width: '100%', alignItems: 'center',
              }}
            >
              <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>Entrar / Cadastrar</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#000000', '#05100b', '#071a12']} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Animated.View style={[{ flex: 1 }, entradaStyle]}>

          {/* ── Esfera — ocupa todo espaço acima do card ── */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <AnelSVG pct={bateria} carregando={carregando} platinum={platinum} />
          </View>

          {/* ── Seção inferior fixa ── */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 120, gap: 10 }}>

            {/* Card de recompensa + bar chart */}
            <LinearGradient
              colors={['#14251a', '#0a130e']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: 'rgba(198,255,74,0.20)',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  Recompensa acumulada
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '600', color: PRIMARY, marginTop: 2 }}>
                  +{pontosGanhos.toLocaleString('pt-BR')}
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  pontos · on-chain
                </Text>
              </View>
              <BarChart heights={barHeights} />
            </LinearGradient>

            {/* Progresso da hora */}
            <View style={{ paddingHorizontal: 0 }}>
              <ProgressoHora segundosRestantes={segundosRestantes} carregando={carregando} />
            </View>

            {/* Botão saque */}
            {podeSacar && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Withdraw', { perfil })}
                activeOpacity={0.88}
                style={{
                  backgroundColor: PRIMARY, borderRadius: 12,
                  paddingVertical: 14,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <TrendingUp size={16} color="#000" />
                <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>
                  Saque disponível
                </Text>
              </TouchableOpacity>
            )}

            {/* Badge de estado */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: carregando ? 'rgba(198,255,74,0.08)' : 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: carregando ? 'rgba(198,255,74,0.2)' : 'rgba(255,255,255,0.1)',
              borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7,
            }}>
              {carregando ? (
                <>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PRIMARY }} />
                  <Text style={{ fontSize: 12, color: PRIMARY, fontWeight: '600' }}>
                    Sessão ativa · +{pontosGanhos.toLocaleString('pt-BR')} pts
                  </Text>
                </>
              ) : (
                <>
                  <Plug size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    Conecte o USB para começar
                  </Text>
                </>
              )}
            </View>

            {/* Informativo */}
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              Saque disponível a partir de 100.000 pontos.
            </Text>

          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}
