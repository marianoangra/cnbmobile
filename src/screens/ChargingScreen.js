import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
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
  RadialGradient, G,
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG      = Animated.createAnimatedComponent(G);

// ─── Anel SVG (fiel ao Figma) ─────────────────────────────────────────────────
function AnelSVG({ pct, carregando }) {
  const dashOffset = useSharedValue(CIRC);
  const plasmaRot  = useSharedValue(0);
  const outerRot   = useSharedValue(0);
  const innerAlpha = useSharedValue(0.15);

  useEffect(() => {
    dashOffset.value = withDelay(300,
      withTiming(CIRC - (pct / 100) * CIRC, { duration: 1600, easing: Easing.bezier(0.22, 1, 0.36, 1) })
    );
  }, [pct]);

  useEffect(() => {
    plasmaRot.value = withRepeat(withTiming(360, { duration: 3600, easing: Easing.linear }), -1, false);
    outerRot.value  = withRepeat(withTiming(-360, { duration: 10000, easing: Easing.linear }), -1, false);
    innerAlpha.value = withRepeat(
      withSequence(withTiming(0.5, { duration: 1200 }), withTiming(0.15, { duration: 1200 })),
      -1, true,
    );
    return () => {
      cancelAnimation(plasmaRot);
      cancelAnimation(outerRot);
      cancelAnimation(innerAlpha);
    };
  }, []);

  const mainArcProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const plasmaRotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${plasmaRot.value}deg` }],
  }));

  const outerRotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRot.value}deg` }],
  }));

  const innerAlphaProps = useAnimatedProps(() => ({
    strokeOpacity: innerAlpha.value,
  }));

  return (
    <View style={{ width: SVG_SIZE, height: SVG_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* Halo de fundo */}
      <View style={{
        position: 'absolute', width: 320, height: 320, borderRadius: 160,
        backgroundColor: 'rgba(198,255,74,0.10)',
        top: (SVG_SIZE - 320) / 2, left: (SVG_SIZE - 320) / 2,
      }} pointerEvents="none" />

      <Svg width={SVG_SIZE} height={SVG_SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%"   stopColor="#E4FF8A" />
            <Stop offset="50%"  stopColor={PRIMARY} />
            <Stop offset="100%" stopColor="#2ecc71" />
          </SvgGradient>
          <SvgGradient id="plasmaGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%"   stopColor={PRIMARY} stopOpacity="0" />
            <Stop offset="60%"  stopColor={PRIMARY} stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </SvgGradient>
          <RadialGradient id="sparkGrad">
            <Stop offset="0%"   stopColor="#ffffff" stopOpacity="1" />
            <Stop offset="60%"  stopColor={PRIMARY} stopOpacity="0.6" />
            <Stop offset="100%" stopColor={PRIMARY} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="coreHalo" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0%"   stopColor={PRIMARY} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={PRIMARY} stopOpacity="0" />
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

        {/* Anel tracejado externo girando ao contrário */}
        <Circle
          cx={CX} cy={CY} r={R + 16}
          stroke={PRIMARY} strokeOpacity="0.35" strokeWidth="1" fill="none"
          strokeDasharray="2 8"
        />

        {/* Anel interno pulsante */}
        <AnimatedCircle
          cx={CX} cy={CY} r={R - 14}
          stroke={PRIMARY} strokeWidth="1" fill="none"
          animatedProps={innerAlphaProps}
        />
      </Svg>

      {/* Plasma spark — só aparece quando carregando */}
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
              stroke="url(#plasmaGrad)" strokeWidth="4" fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRC * 0.22} ${CIRC}`}
            />
            <Circle cx={CX + R} cy={CY} r={10} fill="url(#sparkGrad)" />
            <Circle cx={CX + R} cy={CY} r={3}  fill="#ffffff" />
          </Svg>
        </Animated.View>
      )}

      {/* Centro: sempre mostra % da bateria */}
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
          color: carregando ? PRIMARY : 'rgba(255,255,255,0.7)',
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

// ─── Bar chart 10 dias ────────────────────────────────────────────────────────
const DAYS_EMPTY = Array(10).fill(0);

function BarChart({ heights }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 56 }}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            width: 6, borderRadius: 3,
            height: `${h}%`,
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

  const [bateria, setBateria] = React.useState(68);
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

  const podeSacar = (perfil?.pontos ?? 0) >= 100000;
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
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }, entradaStyle]}>

            {/* Anel SVG centralizado */}
            <View style={{ alignItems: 'center', marginBottom: 84 }}>
              <AnelSVG pct={bateria} carregando={carregando} />
            </View>

            {/* Card de recompensa acumulada + bar chart */}
            <LinearGradient
              colors={['#14251a', '#0a130e']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                marginHorizontal: 20, borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: 'rgba(198,255,74,0.20)',
                width: '100%', maxWidth: 380,
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

            {/* Botão saque disponível */}
            {podeSacar && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Withdraw', {})}
                activeOpacity={0.88}
                style={{
                  marginHorizontal: 20, marginTop: 12,
                  backgroundColor: PRIMARY, borderRadius: 12,
                  paddingVertical: 14,
                  flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  width: '100%', maxWidth: 380,
                }}
              >
                <TrendingUp size={16} color="#000" />
                <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>
                  Saque disponível
                </Text>
              </TouchableOpacity>
            )}

            {/* Estado de conexão */}
            <View style={{
              marginTop: 16, marginHorizontal: 20,
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

            {/* Texto informativo fixo */}
            <Text style={{
              marginTop: 14,
              fontSize: 11, color: 'rgba(255,255,255,0.3)',
              textAlign: 'center',
            }}>
              Saque disponível a partir de 100.000 pontos.
            </Text>

            {/* Botão de saque — visível quando pontos >= 100.000 */}
            {podeSacar && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Withdraw', {})}
                activeOpacity={0.88}
                style={{
                  marginHorizontal: 20, marginTop: 12,
                  borderWidth: 1.5, borderColor: PRIMARY,
                  borderRadius: 12, paddingVertical: 13,
                  flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  width: '100%', maxWidth: 380,
                  backgroundColor: 'rgba(198,255,74,0.08)',
                }}
              >
                <TrendingUp size={15} color={PRIMARY} />
                <Text style={{ color: PRIMARY, fontWeight: '600', fontSize: 14 }}>
                  Solicitar saque
                </Text>
              </TouchableOpacity>
            )}

          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
