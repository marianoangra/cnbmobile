import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withRepeat, withSequence,
  Easing, cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import * as Battery from 'expo-battery';
import { Zap, Plug, TrendingUp } from 'lucide-react-native';
import { useCarregamento } from '../hooks/useCarregamento';
import { calcularAtividadeDiaria } from '../services/pontos';
import { useAccent } from '../context/AccentContext';
import { useScreenTrace } from '../hooks/useScreenTrace';

// ── Constantes ────────────────────────────────────────────────────────────────
const NEON         = '#00FF7F';
const NEON_TRIGGER = '#39FF14';
const PRIMARY      = '#c6ff4a';

const { width: SW } = Dimensions.get('window');
const OFFSET   = 90;               // canvas se extende além dos limites para o parallax
const CANVAS_W = SW + OFFSET * 2;
const CANVAS_H = 720;

// ── Gerador pseudo-aleatório (seeded) ─────────────────────────────────────────
function seededRand(seed) {
  let s = (Math.abs(seed) * 9301 + 49297) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// Paleta de cores estelares reais — tipo espectral O/B (azul-branca), F/G (amarela), K (laranja), M (vermelha)
const STAR_PALETTE = [
  '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', // brancas — maioria
  '#c8d8ff',  // azul-branca  (tipo O/B — Rigel, Spica)
  '#c8d8ff',
  '#e8f0ff',  // azul leve    (tipo A — Sirius, Vega)
  '#fff8e0',  // amarelo suave (tipo F/G — como o Sol)
  '#ffe5b0',  // laranja tênue (tipo K — Arcturus)
  '#ffe0e0',  // vermelho leve (tipo M — Betelgeuse)
  '#f0f8ff',  // branco-azulado tênue
];

function genStars(count, seed, rMin, rMax, opMin, opMax, clusterOpts) {
  const rand = seededRand(seed);
  return Array.from({ length: count }, () => {
    let x = rand() * CANVAS_W;
    let y = rand() * CANVAS_H;
    // Bias para faixa diagonal — simula concentração da Via Láctea
    if (clusterOpts && rand() < clusterOpts.bias) {
      const t = rand();
      x = CANVAS_W * (0.12 + t * 0.76) + (rand() - 0.5) * clusterOpts.spreadX;
      y = CANVAS_H * (0.04 + t * 0.60) + (rand() - 0.5) * clusterOpts.spreadY;
    }
    return {
      x:  Math.max(0, Math.min(CANVAS_W, x)),
      y:  Math.max(0, Math.min(CANVAS_H, y)),
      r:  rMin + rand() * (rMax - rMin),
      // Curva de potência: mais estrelas tênues do que brilhantes (como no céu real)
      op: opMin + Math.pow(rand(), 2.0) * (opMax - opMin),
      c:  STAR_PALETTE[Math.floor(rand() * STAR_PALETTE.length)],
      tw: Math.floor(rand() * 3), // grupo de cintilação independente: 0, 1 ou 2
    };
  });
}

// Camadas — computadas uma vez no carregamento do módulo
const MW = { bias: 0.52, spreadX: 300, spreadY: 110 }; // faixa Via Láctea
const STARS_DEEP   = genStars(110, 9999, 0.18, 0.55, 0.02, 0.14, MW);   // fundíssimo — quase invisível
const STARS_FAR    = genStars(65,  1,    0.30, 0.85, 0.06, 0.28, { bias: 0.22, spreadX: 200, spreadY: 90 });
const STARS_MID    = genStars(42,  500,  0.55, 1.40, 0.14, 0.52);
const STARS_NEAR   = genStars(24,  1200, 0.85, 1.90, 0.26, 0.70);
const STARS_BRIGHT = genStars(10,  2000, 2.00, 3.40, 0.88, 1.00);
const STARS_NEON   = genStars(14,  3000, 0.65, 1.30, 0.38, 0.68);

// ── Estrela cadente ───────────────────────────────────────────────────────────
function ShootingStar({ triggerKey }) {
  const progress = useSharedValue(0);
  const opacity  = useSharedValue(0);

  // Trajetória fixa mas com variação por triggerKey
  const seed  = (triggerKey * 7919) % 1;
  const rand  = seededRand(triggerKey + 1);
  const startX = rand() * SW * 0.6;           // origem no terço esquerdo/central
  const startY = rand() * 120 + 30;           // origem no topo
  const len    = 90 + rand() * 60;            // comprimento do risco
  const angle  = 28 + rand() * 20;            // ângulo diagonal (28–48°)
  const rad    = (angle * Math.PI) / 180;
  const dx     = Math.cos(rad) * len;
  const dy     = Math.sin(rad) * len;

  useEffect(() => {
    if (triggerKey === 0) return;
    progress.value = 0;
    opacity.value  = 0;

    // Fade in → viagem → fade out
    opacity.value = withSequence(
      withTiming(1,   { duration: 80  }),
      withTiming(1,   { duration: 340 }),
      withTiming(0,   { duration: 180 }),
    );
    progress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });

    return () => { cancelAnimation(progress); cancelAnimation(opacity); };
  }, [triggerKey]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: progress.value * dx }, { translateY: progress.value * dy }],
  }));

  if (triggerKey === 0) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={SW} height={300} style={{ position: 'absolute', left: 0, top: 0 }}>
        {/* Cauda difusa */}
        <Line
          x1={startX} y1={startY}
          x2={startX - dx * 0.5} y2={startY - dy * 0.5}
          stroke="white" strokeWidth={1.5} strokeOpacity={0.18}
          strokeLinecap="round"
        />
        {/* Risco principal */}
        <Line
          x1={startX} y1={startY}
          x2={startX - dx * 0.25} y2={startY - dy * 0.25}
          stroke="white" strokeWidth={1.8} strokeOpacity={0.7}
          strokeLinecap="round"
        />
        {/* Ponta brilhante */}
        <Circle cx={startX} cy={startY} r={1.8} fill="white" fillOpacity={0.95} />
        <Circle cx={startX} cy={startY} r={3.5} fill="white" fillOpacity={0.18} />
      </Svg>
    </Animated.View>
  );
}

// ── Satélite em órbita ────────────────────────────────────────────────────────
function Satellite({ triggerKey }) {
  const progress = useSharedValue(0);
  const opacity  = useSharedValue(0);
  const blinkAmt = useSharedValue(1);

  const rand = seededRand(triggerKey * 3571 + 17);

  // Trajetória: maioria entra pela esquerda, alguns pelo topo
  const fromLeft   = rand() > 0.28;
  const angle      = (8 + rand() * 28) * (Math.PI / 180); // 8–36° de inclinação
  const duration   = 14000 + rand() * 8000;                // 14–22 s para cruzar
  const brightness = 0.32 + rand() * 0.30;                 // 0.32–0.62 (varia como satélites reais)
  const blinkPd    = 2800 + rand() * 3400;                 // período de rotação 2.8–6.2 s

  const pad = 30;
  let x0, y0, x1, y1;
  if (fromLeft) {
    x0 = -pad;
    y0 = rand() * CANVAS_H * 0.62 + 50;
    x1 = CANVAS_W + pad;
    y1 = y0 + (CANVAS_W + pad * 2) * Math.tan(angle);
  } else {
    x0 = rand() * SW * 0.65 + SW * 0.12;
    y0 = -pad;
    x1 = x0 + CANVAS_H * Math.sin(angle + 0.5);
    y1 = CANVAS_H + pad;
  }

  useEffect(() => {
    if (triggerKey === 0) return;
    progress.value = 0;
    opacity.value  = 0;

    opacity.value = withSequence(
      withTiming(brightness, { duration: 2400, easing: Easing.in(Easing.quad) }),
      withTiming(brightness, { duration: duration - 4200 }),
      withTiming(0,          { duration: 1800, easing: Easing.out(Easing.quad) }),
    );
    progress.value = withTiming(1, { duration, easing: Easing.linear });

    // Pulso suave — reflexo solar ao girar
    blinkAmt.value = withRepeat(withSequence(
      withTiming(0.68, { duration: blinkPd / 2, easing: Easing.inOut(Easing.sin) }),
      withTiming(1.00, { duration: blinkPd / 2, easing: Easing.inOut(Easing.sin) }),
    ), -1, true);

    return () => {
      cancelAnimation(progress);
      cancelAnimation(opacity);
      cancelAnimation(blinkAmt);
    };
  }, [triggerKey]);

  const satStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * blinkAmt.value,
    transform: [
      { translateX: x0 + progress.value * (x1 - x0) },
      { translateY: y0 + progress.value * (y1 - y0) },
    ],
  }));

  if (triggerKey === 0) return null;

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0 }, satStyle]}>
      <Svg width={10} height={10}>
        <Circle cx={5} cy={5} r={2.6} fill="white" fillOpacity={0.08} />
        <Circle cx={5} cy={5} r={1.1} fill="white" fillOpacity={0.96} />
      </Svg>
    </Animated.View>
  );
}

// ── Campo estelar ─────────────────────────────────────────────────────────────
function StarField({ carregando, phase, offsetX, offsetY, bateria, pontosGanhos }) {
  const twinkleA    = useSharedValue(0.8);
  const twinkleB    = useSharedValue(0.5);
  const twinkleC    = useSharedValue(1.0);
  const nebulaAlpha = useSharedValue(0);
  const centerGlow  = useSharedValue(0.0);

  // Deriva idle — movimento sutil e autônomo das camadas
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);

  // Estrela cadente — incrementa a cada sucesso
  const [shootKey, setShootKey] = useState(0);

  // Satélite — aparece a cada 45–90 s aleatoriamente
  const [satKey, setSatKey] = useState(0);
  useEffect(() => {
    let timer;
    function schedule() {
      timer = setTimeout(() => {
        setSatKey(k => k + 1);
        schedule();
      }, 45000 + Math.random() * 45000);
    }
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // ── Três ritmos de cintilação independentes ───────────────────────────────
  useEffect(() => {
    twinkleA.value = withRepeat(withSequence(
      withTiming(1.0,  { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      withTiming(0.42, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
    ), -1, true);
    twinkleB.value = withRepeat(withSequence(
      withTiming(0.38, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      withTiming(1.0,  { duration: 3000, easing: Easing.inOut(Easing.sin) }),
    ), -1, true);
    twinkleC.value = withRepeat(withSequence(
      withTiming(0.58, { duration: 3800, easing: Easing.inOut(Easing.sin) }),
      withTiming(1.0,  { duration: 2200, easing: Easing.inOut(Easing.sin) }),
    ), -1, true);
    return () => { cancelAnimation(twinkleA); cancelAnimation(twinkleB); cancelAnimation(twinkleC); };
  }, []);

  // ── Deriva idle — o céu "respira" quando não há interação ────────────────
  useEffect(() => {
    driftX.value = withRepeat(withSequence(
      withTiming( 8, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
      withTiming(-8, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
    ), -1, true);
    driftY.value = withRepeat(withSequence(
      withTiming( 5, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      withTiming(-5, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
    ), -1, true);
    return () => { cancelAnimation(driftX); cancelAnimation(driftY); };
  }, []);

  // ── Animações de carregamento ─────────────────────────────────────────────
  useEffect(() => {
    if (carregando) {
      nebulaAlpha.value = withRepeat(withSequence(
        withTiming(1.0,  { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.42, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ), -1, true);
      centerGlow.value = withRepeat(withSequence(
        withTiming(1.0, { duration: 1400 }),
        withTiming(0.4, { duration: 1400 }),
      ), -1, true);
    } else {
      cancelAnimation(nebulaAlpha);
      cancelAnimation(centerGlow);
      nebulaAlpha.value = withTiming(0, { duration: 1200 }); // some completamente
      centerGlow.value  = withTiming(0, { duration: 800  });
    }
  }, [carregando]);

  // ── Estrela cadente ao soltar o pull-to-refresh ───────────────────────────
  useEffect(() => {
    if (phase === 'success') {
      setShootKey(k => k + 1);
    }
  }, [phase]);

  const isTriggered = phase === 'triggered' || phase === 'refreshing' || phase === 'success';
  const neon        = isTriggered ? NEON_TRIGGER : NEON;

  // ── Estilos da camada profunda — 3 grupos de cintilação independente ────────
  const deepStyleA = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value * 0.025 + driftX.value * 0.02 },
      { translateY: offsetY.value * 0.025 + driftY.value * 0.02 },
    ],
    opacity: twinkleA.value * 0.62 + centerGlow.value * 0.10,
  }));
  const deepStyleB = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value * 0.025 + driftX.value * 0.02 },
      { translateY: offsetY.value * 0.025 + driftY.value * 0.02 },
    ],
    opacity: twinkleB.value * 0.62 + centerGlow.value * 0.10,
  }));
  const deepStyleC = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value * 0.025 + driftX.value * 0.02 },
      { translateY: offsetY.value * 0.025 + driftY.value * 0.02 },
    ],
    opacity: twinkleC.value * 0.62 + centerGlow.value * 0.10,
  }));

  // ── Estilos de parallax + deriva idle + boost de brilho ao carregar ───────
  const layer1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value * 0.07 + driftX.value * 0.06 },
      { translateY: offsetY.value * 0.07 + driftY.value * 0.06 },
    ],
    opacity: twinkleA.value * 0.72 + centerGlow.value * 0.18,
  }));
  const layer2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value * 0.22 + driftX.value * 0.18 },
      { translateY: offsetY.value * 0.22 + driftY.value * 0.18 },
    ],
    opacity: twinkleB.value * 0.88 + centerGlow.value * 0.12,
  }));
  const layer3Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value * 0.46 + driftX.value * 0.38 },
      { translateY: offsetY.value * 0.46 + driftY.value * 0.38 },
    ],
    opacity: Math.min(1, twinkleC.value + centerGlow.value * 0.22),
  }));
  const brightStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value * 0.65 + driftX.value * 0.55 },
      { translateY: offsetY.value * 0.65 + driftY.value * 0.55 },
    ],
    opacity: Math.min(1, twinkleA.value * 0.55 + twinkleC.value * 0.45 + centerGlow.value * 0.30),
  }));
  const neonStarStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value * 0.38 + driftX.value * 0.30 },
      { translateY: offsetY.value * 0.38 + driftY.value * 0.30 },
    ],
    opacity: Math.min(1, twinkleB.value * 0.42 + nebulaAlpha.value * 0.58 + centerGlow.value * 0.12),
  }));

  const glowStyle  = useAnimatedStyle(() => ({ opacity: centerGlow.value * 0.38 }));
  const dustStyle  = useAnimatedStyle(() => ({ opacity: nebulaAlpha.value * 0.22 }));

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>

      {/* Fundo — gradiente escuro verde-espaço */}
      <LinearGradient
        colors={['#010e05', '#000902', '#000000']}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Poeira cósmica — dispersa pelo céu ao carregar ── */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, dustStyle]}>
        <LinearGradient
          colors={['rgba(0,255,127,0.09)', 'rgba(0,180,80,0.04)', 'rgba(0,0,0,0)']}
          start={{ x: 0.0, y: 0.0 }} end={{ x: 0.7, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,120,55,0.03)', 'rgba(0,220,100,0.06)']}
          start={{ x: 0.6, y: 0.2 }} end={{ x: 1.0, y: 1.0 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,200,80,0.04)', 'rgba(0,0,0,0)']}
          start={{ x: 0.3, y: 1.0 }} end={{ x: 0.8, y: 0.0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Camada profunda — Via Láctea (3 grupos cintilam independente) ── */}
      {[deepStyleA, deepStyleB, deepStyleC].map((style, tw) => (
        <Animated.View key={`deep${tw}`} style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
          <Svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', left: -OFFSET, top: -OFFSET }}>
            {STARS_DEEP.filter(s => s.tw === tw).map((s, i) => (
              <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} fillOpacity={s.op} />
            ))}
          </Svg>
        </Animated.View>
      ))}

      {/* ── Camada 1 — estrelas distantes ── */}
      <Animated.View style={[StyleSheet.absoluteFill, layer1Style]} pointerEvents="none">
        <Svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', left: -OFFSET, top: -OFFSET }}>
          {STARS_FAR.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} fillOpacity={s.op} />
          ))}
        </Svg>
      </Animated.View>

      {/* ── Camada 2 — plano médio ── */}
      <Animated.View style={[StyleSheet.absoluteFill, layer2Style]} pointerEvents="none">
        <Svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', left: -OFFSET, top: -OFFSET }}>
          {STARS_MID.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} fillOpacity={s.op} />
          ))}
        </Svg>
      </Animated.View>

      {/* ── Camada 3 — plano próximo, mais visível ── */}
      <Animated.View style={[StyleSheet.absoluteFill, layer3Style]} pointerEvents="none">
        <Svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', left: -OFFSET, top: -OFFSET }}>
          {STARS_NEAR.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} fillOpacity={s.op} />
          ))}
        </Svg>
      </Animated.View>

      {/* ── Estrelas verdes — acento da identidade visual ── */}
      <Animated.View style={[StyleSheet.absoluteFill, neonStarStyle]} pointerEvents="none">
        <Svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', left: -OFFSET, top: -OFFSET }}>
          {STARS_NEON.map((s, i) => (
            <G key={i}>
              <Circle cx={s.x} cy={s.y} r={s.r * 4}   fill={neon} fillOpacity={0.05} />
              <Circle cx={s.x} cy={s.y} r={s.r * 1.8} fill={neon} fillOpacity={0.14} />
              <Circle cx={s.x} cy={s.y} r={s.r}       fill={neon} fillOpacity={s.op} />
            </G>
          ))}
        </Svg>
      </Animated.View>

      {/* ── Estrelas brilhantes — primeiro plano, com halo cromático ── */}
      <Animated.View style={[StyleSheet.absoluteFill, brightStyle]} pointerEvents="none">
        <Svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', left: -OFFSET, top: -OFFSET }}>
          {STARS_BRIGHT.map((s, i) => (
            <G key={i}>
              <Circle cx={s.x} cy={s.y} r={s.r * 7}   fill={s.c}   fillOpacity={0.028} />
              <Circle cx={s.x} cy={s.y} r={s.r * 3.5} fill={s.c}   fillOpacity={0.08}  />
              <Circle cx={s.x} cy={s.y} r={s.r * 1.5} fill="white" fillOpacity={0.22}  />
              <Circle cx={s.x} cy={s.y} r={s.r}       fill="white" fillOpacity={s.op}  />
            </G>
          ))}
        </Svg>
      </Animated.View>

      {/* ── Véu estelar — brilho verde difuso ao carregar ── */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glowStyle]}>
        <LinearGradient
          colors={['rgba(0,255,127,0.05)', 'rgba(0,140,60,0.025)', 'rgba(0,0,0,0)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0.0 }} end={{ x: 0.5, y: 1.0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Estrela cadente — disparada ao soltar o pull-to-refresh ── */}
      <ShootingStar triggerKey={shootKey} />

      {/* ── Satélite — passa a cada 45–90 s ── */}
      <Satellite triggerKey={satKey} />

    </View>
  );
}


// ── Bateria em modo espera (não carregando) ───────────────────────────────────
const IDLE_IMG = require('../../assets/battery-idle.png');

function IdleBattery({ carregando }) {
  const fade   = useSharedValue(0);
  const scale  = useSharedValue(1);
  const floatY = useSharedValue(0);

  useEffect(() => {
    if (!carregando) {
      // fade-in suave quando entra em idle
      fade.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });

      // respiração — escala 1.0 ↔ 1.045
      scale.value = withRepeat(withSequence(
        withTiming(1.045, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.000, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ), -1, true);

      // flutuar — sobe/desce 6px
      floatY.value = withRepeat(withSequence(
        withTiming(-6, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming( 6, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ), -1, true);
    } else {
      fade.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) });
      cancelAnimation(scale);
      cancelAnimation(floatY);
    }
    return () => {
      cancelAnimation(fade);
      cancelAnimation(scale);
      cancelAnimation(floatY);
    };
  }, [carregando]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { translateY: floatY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View pointerEvents="none" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={wrapStyle}>
        <Image
          source={IDLE_IMG}
          style={{ width: 220, height: 320 }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

// ── Anel girando ao redor do raio ─────────────────────────────────────────────
const RING_SIZE = 200;
const RING_C    = RING_SIZE / 2;
const RING_R    = RING_C - 6;
const RING_CIRC = 2 * Math.PI * RING_R;

function RotatingRing({ carregando, color }) {
  const rot  = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (carregando) {
      fade.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
      rot.value = withRepeat(
        withTiming(360, { duration: 4500, easing: Easing.linear }),
        -1, false,
      );
    } else {
      fade.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) });
      cancelAnimation(rot);
    }
    return () => {
      cancelAnimation(rot);
      cancelAnimation(fade);
    };
  }, [carregando]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ width: RING_SIZE, height: RING_SIZE }, wrapStyle]}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_C} cy={RING_C} r={RING_R}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeOpacity={0.65}
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRC * 0.42} ${RING_CIRC * 0.58}`}
        />
      </Svg>
    </Animated.View>
  );
}

// ── Halo girando enquanto carrega ─────────────────────────────────────────────
const GLOW_SIZE = 300;
const GLOW_C    = GLOW_SIZE / 2;

function ChargingGlow({ carregando, color }) {
  const fade = useSharedValue(0);

  useEffect(() => {
    if (carregando) {
      fade.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    } else {
      fade.value = withTiming(0, { duration: 600, easing: Easing.in(Easing.cubic) });
    }
    return () => {
      cancelAnimation(fade);
    };
  }, [carregando]);

  const wrapStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const r1 = GLOW_C - 14;
  const r2 = GLOW_C - 38;

  return (
    <Animated.View pointerEvents="none" style={[{
      width: GLOW_SIZE, height: GLOW_SIZE,
      alignItems: 'center', justifyContent: 'center',
    }, wrapStyle]}>

      {/* Halo difuso estático — feito com strokes empilhados de larguras crescentes */}
      <Svg width={GLOW_SIZE} height={GLOW_SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={GLOW_C} cy={GLOW_C} r={r1} fill="none" stroke={color} strokeOpacity={0.04} strokeWidth={28} />
        <Circle cx={GLOW_C} cy={GLOW_C} r={r1} fill="none" stroke={color} strokeOpacity={0.08} strokeWidth={14} />
        <Circle cx={GLOW_C} cy={GLOW_C} r={r2} fill="none" stroke={color} strokeOpacity={0.05} strokeWidth={22} />
        <Circle cx={GLOW_C} cy={GLOW_C} r={r2} fill="none" stroke={color} strokeOpacity={0.10} strokeWidth={10} />
      </Svg>

    </Animated.View>
  );
}

// ── Barra de progresso 1 hora ─────────────────────────────────────────────────
function ProgressoHora({ segundosRestantes, carregando }) {
  const PRIMARY = useAccent();
  const { t } = useTranslation();
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
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{t('charging.hourProgress')}</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: carregando ? PRIMARY : 'rgba(255,255,255,0.25)' }}>
          {carregando ? `${timeStr} restante` : '--:--'}
        </Text>
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 6, borderRadius: 99, backgroundColor: PRIMARY }, barStyle]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
          {carregando ? t('charging.bonusOnComplete') : t('charging.connectCharger')}
        </Text>
        {carregando && (
          <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '600' }}>{pct}%</Text>
        )}
      </View>
    </View>
  );
}

// ── Bar chart 10 dias ─────────────────────────────────────────────────────────
const STATIC_BARS = [28, 42, 35, 58, 40, 72, 55, 68, 85, 78];
function BarChart({ heights }) {
  const PRIMARY = useAccent();
  const bars = heights.every(h => h === 0) ? STATIC_BARS : heights;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 52 }}>
      {bars.map((h, i) => (
        <View key={i} style={{
          width: 6, borderRadius: 3,
          height: (h / 100) * 52,
          backgroundColor: PRIMARY,
          opacity: 0.3 + (h / 100) * 0.7,
        }} />
      ))}
    </View>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function ChargingScreen({ route, navigation }) {
  useScreenTrace('charging_screen');
  const PRIMARY = useAccent();
  const { t } = useTranslation();
  const { user, uid, perfil, onAtualizar } = route?.params || {};
  const { carregando, pontosGanhos, segundosRestantes, limiteBotAtingido } = useCarregamento(uid, onAtualizar);

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

  // Entrada
  const entrada  = useSharedValue(0);
  const entradaY = useSharedValue(20);
  useEffect(() => {
    const cfg = { duration: 500, easing: Easing.out(Easing.cubic) };
    entrada.value  = withTiming(1, cfg);
    entradaY.value = withTiming(0, cfg);
  }, []);
  const entradaStyle = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateY: entradaY.value }],
  }));

  // ── Offsets do StarField — sutil deriva idle dentro do componente ──
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  const podeSacar  = (perfil?.pontos ?? 0) >= 100000;
  const barHeights = calcularAtividadeDiaria(perfil?.atividadeDias);

  // Gate de login
  if (!user) {
    return (
      <LinearGradient colors={['#010e05', '#000902', '#000000']} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
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
              {t('charging.earnPointsTitle')}
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 21, marginBottom: 36 }}>
              {t('charging.loginToEarn')}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
              style={{
                backgroundColor: NEON, borderRadius: 14,
                paddingVertical: 14, width: '100%', alignItems: 'center',
              }}
            >
              <Text style={{ color: '#001508', fontWeight: '700', fontSize: 16 }}>{t('common.loginRegister')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#010e05', '#000902', '#000000']} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Animated.View style={[{ flex: 1 }, entradaStyle]}>

          {/* ── Campo estelar + porcentagem de bateria centralizada ── */}
          <View style={{ flex: 1 }}>
            <StarField
              carregando={carregando}
              phase="idle"
              offsetX={offsetX}
              offsetY={offsetY}
              bateria={bateria}
              pontosGanhos={pontosGanhos}
            />
            {/* Modo espera — bateria animada quando NÃO carregando */}
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
            >
              <IdleBattery carregando={carregando} />
            </View>

            {/* Halo girando — atrás do número da bateria, só quando carregando */}
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
            >
              <ChargingGlow carregando={carregando} color={PRIMARY} />
            </View>

            {/* Anel girando ao redor do raio */}
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
            >
              <RotatingRing carregando={carregando} color={PRIMARY} />
            </View>

            {carregando && (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
              >
                {/* Raio centralizado — eixo vertical, centroide em (12,12) */}
                <Svg width={140} height={180} viewBox="0 0 24 24">
                  <Path
                    d="M 12 2 L 6 13 L 11 13 L 12 22 L 18 11 L 13 11 Z"
                    fill={PRIMARY}
                    stroke={PRIMARY}
                    strokeWidth={0.5}
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            )}
          </View>

          {/* ── Seção inferior ── */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 120, gap: 10 }}>

            {/* Card recompensa + bar chart */}
            <LinearGradient
              colors={['#0a1a0c', '#060f08']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: 'rgba(0,255,127,0.10)',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{t('charging.accumulatedReward')}</Text>
                <Text style={{ fontSize: 24, fontWeight: '600', color: PRIMARY, marginTop: 2 }}>
                  +{pontosGanhos.toLocaleString('pt-BR')}
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{t('charging.onChain')}</Text>
              </View>
              <BarChart heights={barHeights} />
            </LinearGradient>

            {/* Progresso da hora */}
            <ProgressoHora segundosRestantes={segundosRestantes} carregando={carregando && !limiteBotAtingido} />

            {/* Aviso anti-bot: limite de 8h atingido */}
            {limiteBotAtingido && (
              <View style={{
                backgroundColor: 'rgba(255,160,0,0.08)',
                borderWidth: 1, borderColor: 'rgba(255,160,0,0.25)',
                borderRadius: 14, padding: 14,
                flexDirection: 'row', alignItems: 'flex-start', gap: 10,
              }}>
                <Plug size={16} color="#FFA500" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFA500', marginBottom: 3 }}>
                    {t('charging.botLimitTitle')}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 }}>
                    {t('charging.botLimitMsg')}
                  </Text>
                </View>
              </View>
            )}

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
                <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>{t('charging.withdrawAvailable')}</Text>
              </TouchableOpacity>
            )}

            {/* Badge de estado */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: carregando ? 'rgba(0,255,127,0.06)' : 'rgba(255,255,255,0.03)',
              borderWidth: 1,
              borderColor: carregando ? 'rgba(0,255,127,0.14)' : 'rgba(255,255,255,0.06)',
              borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7,
            }}>
              {carregando ? (
                <>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: NEON }} />
                  <Text style={{ fontSize: 12, color: NEON, fontWeight: '600' }}>
                    {t('charging.sessionActive')} · +{pontosGanhos.toLocaleString('pt-BR')} pts
                  </Text>
                </>
              ) : (
                <>
                  <Plug size={12} color="rgba(255,255,255,0.3)" />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                    {t('charging.connectUsb')}
                  </Text>
                </>
              )}
            </View>

            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', textAlign: 'center' }}>
              {t('charging.withdrawFrom')}
            </Text>
          </View>

        </Animated.View>
      </SafeAreaView>

    </LinearGradient>
  );
}
