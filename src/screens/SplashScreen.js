import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, RadialGradient, Stop, Rect, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import CnbLogo from '../components/CnbLogo';

const { width: W, height: H } = Dimensions.get('window');
const PRIMARY = '#c6ff4a';

// Estrelas com posições determinísticas (sem Math.random no render)
function generateStars(count) {
  const out = [];
  let s = 42;
  const r = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  for (let i = 0; i < count; i++) {
    out.push({ x: r() * 100, y: r() * 62, sz: r() * 1.6 + 0.6, g: i % 3 });
  }
  return out;
}
const STARS = generateStars(50);

export default function SplashScreen() {
  const logoScale   = useRef(new Animated.Value(0.82)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity  = useRef(new Animated.Value(0)).current;
  const barX        = useRef(new Animated.Value(0)).current;

  // 3 grupos de estrelas com animação alternada
  const sg0 = useRef(new Animated.Value(0.4)).current;
  const sg1 = useRef(new Animated.Value(0.8)).current;
  const sg2 = useRef(new Animated.Value(0.6)).current;
  const starGroups = [sg0, sg1, sg2];

  useEffect(() => {
    // Entrada do logo
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();

    // Tagline — aparece depois
    Animated.timing(tagOpacity, { toValue: 1, duration: 600, delay: 650, useNativeDriver: true }).start();

    // Shimmer bar
    Animated.loop(
      Animated.timing(barX, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ).start();

    // Estrelas — cada grupo pisca em fases diferentes
    const twinkle = (anim, duration) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1.0, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.15, duration, useNativeDriver: true }),
        ])
      ).start();
    twinkle(sg0, 1800);
    twinkle(sg1, 2400);
    twinkle(sg2, 2100);
  }, []);

  const barTranslate = barX.interpolate({
    inputRange: [0, 1],
    outputRange: [-128, 128],
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#03070a' }}>

      {/* Fundo radial côsmico + névoas (tudo em SVG para fade suave sem bordas) */}
      <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={W} height={H}>
        <Defs>
          <RadialGradient id="bgGrad" cx="0.5" cy="0.35" r="0.85" gradientUnits="objectBoundingBox">
            <Stop offset="0%"   stopColor="#0d3a2e" />
            <Stop offset="30%"  stopColor="#062017" />
            <Stop offset="62%"  stopColor="#030a08" />
            <Stop offset="100%" stopColor="#000000" />
          </RadialGradient>
          {/* Névoa 1 — verde-lima, topo centro */}
          <RadialGradient id="neb1" cx={W / 2} cy={110} r={200} gradientUnits="userSpaceOnUse">
            <Stop offset="0%"  stopColor="#c6ff4a" stopOpacity="0.18" />
            <Stop offset="60%" stopColor="#c6ff4a" stopOpacity="0" />
          </RadialGradient>
          {/* Névoa 2 — verde, lateral esquerda */}
          <RadialGradient id="neb2" cx={40} cy={H * 0.12 + 120} r={150} gradientUnits="userSpaceOnUse">
            <Stop offset="0%"  stopColor="#2ecc71" stopOpacity="0.16" />
            <Stop offset="60%" stopColor="#2ecc71" stopOpacity="0" />
          </RadialGradient>
          {/* Névoa 3 — azul, lateral direita */}
          <RadialGradient id="neb3" cx={W - 45} cy={H * 0.07 + 105} r={130} gradientUnits="userSpaceOnUse">
            <Stop offset="0%"  stopColor="#38bdf8" stopOpacity="0.12" />
            <Stop offset="60%" stopColor="#38bdf8" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill="url(#bgGrad)" />
        <Rect x="0" y="0" width={W} height={H} fill="url(#neb1)" />
        <Rect x="0" y="0" width={W} height={H} fill="url(#neb2)" />
        <Rect x="0" y="0" width={W} height={H} fill="url(#neb3)" />
      </Svg>

      {/* Estrelas */}
      {STARS.map((st, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.sz,
            height: st.sz,
            borderRadius: st.sz / 2,
            backgroundColor: '#ffffff',
            opacity: starGroups[st.g],
          }}
        />
      ))}

      {/* Colina do horizonte */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.34 }}>
        {/* Brilho verde acima da colina */}
        <Svg style={{ position: 'absolute', bottom: H * 0.14, left: 0 }} width={W} height={H * 0.22}>
          <Defs>
            <RadialGradient id="hillGlow" cx="0.5" cy="1" r="0.75" gradientUnits="objectBoundingBox">
              <Stop offset="0%"   stopColor="#c6ff4a" stopOpacity="0.22" />
              <Stop offset="45%"  stopColor="#2ecc71" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={W} height={H * 0.22} fill="url(#hillGlow)" />
        </Svg>

        {/* Silhueta da colina */}
        <Svg
          style={{ position: 'absolute', bottom: 0 }}
          width={W}
          height={H * 0.34}
          viewBox="0 0 300 120"
          preserveAspectRatio="none"
        >
          <Defs>
            <SvgGradient id="hillGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor="#0a1f17" />
              <Stop offset="100%" stopColor="#000000" />
            </SvgGradient>
          </Defs>
          <Path
            d="M0,120 L0,70 Q75,30 150,55 Q225,80 300,45 L300,120 Z"
            fill="url(#hillGrad)"
          />
        </Svg>
      </View>

      {/* Logo + texto centralizados */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -(H * 0.06) }}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {/* Glow ao redor do logo */}
          <View style={{
            shadowColor: PRIMARY,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 28,
            elevation: 16,
          }}>
            <CnbLogo size={64} />
          </View>

          <Text style={{ fontSize: 30, fontWeight: '600', color: '#ffffff', letterSpacing: -0.5 }}>
            CNB
          </Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.Text
          style={{
            opacity: tagOpacity,
            marginTop: 14,
            fontSize: 11,
            letterSpacing: 5,
            color: `${PRIMARY}cc`,
            textTransform: 'uppercase',
          }}
        >
          Human Activity DePIN
        </Animated.Text>
      </View>

      {/* Barra de carregamento (shimmer) */}
      <View style={{
        position: 'absolute',
        bottom: 44,
        alignSelf: 'center',
        width: 128,
        height: 3,
        borderRadius: 99,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.10)',
      }}>
        <Animated.View style={{ transform: [{ translateX: barTranslate }] }}>
          <LinearGradient
            colors={['transparent', PRIMARY, '#2ecc71', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: 128, height: 3 }}
          />
        </Animated.View>
      </View>

    </View>
  );
}
