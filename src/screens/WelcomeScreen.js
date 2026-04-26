import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Zap } from 'lucide-react-native';

const PRIMARY = '#c6ff4a';
const { width: W, height: H } = Dimensions.get('window');

export default function WelcomeScreen({ nome }) {
  const scale   = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const textY   = useRef(new Animated.Value(16)).current;
  const textOp  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOp, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(textY,  { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const primeiroNome = nome?.split(' ')[0] ?? null;

  return (
    <LinearGradient
      colors={['#000000', '#05100b', '#071a12']}
      locations={[0, 0.55, 1]}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Halo de fundo — SVG RadialGradient para fade suave sem borda */}
      <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={W} height={H} pointerEvents="none">
        <Defs>
          <RadialGradient id="halo" cx={W / 2} cy={H / 2} r={160} gradientUnits="userSpaceOnUse">
            <Stop offset="0%"  stopColor={PRIMARY} stopOpacity="0.13" />
            <Stop offset="60%" stopColor={PRIMARY} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill="url(#halo)" />
      </Svg>

      {/* Logo */}
      <Animated.View style={{ transform: [{ scale }], opacity, alignItems: 'center' }}>
        <View style={{
          width: 110, height: 110, borderRadius: 28,
          backgroundColor: 'rgba(198,255,74,0.06)',
          borderWidth: 1.5, borderColor: 'rgba(198,255,74,0.3)',
          alignItems: 'center', justifyContent: 'center',
          gap: 2,
        }}>
          <Zap size={30} color={PRIMARY} strokeWidth={2.5} />
          <Text style={{ fontSize: 22, fontWeight: '800', color: PRIMARY, letterSpacing: 4 }}>CNB</Text>
        </View>
      </Animated.View>

      {/* Texto de saudação */}
      <Animated.View style={{
        marginTop: 28,
        opacity: textOp,
        transform: [{ translateY: textY }],
        alignItems: 'center',
      }}>
        {primeiroNome ? (
          <Text style={{ fontSize: 22, fontWeight: '600', color: '#fff', letterSpacing: -0.3 }}>
            Bem-vindo, {primeiroNome}!
          </Text>
        ) : (
          <Text style={{ fontSize: 22, fontWeight: '600', color: '#fff', letterSpacing: -0.3 }}>
            CNB Mobile
          </Text>
        )}
        <Text style={{
          fontSize: 13, color: 'rgba(255,255,255,0.45)',
          marginTop: 6, letterSpacing: 0.3,
        }}>
          Carregue e ganhe pontos reais
        </Text>

        {/* Indicador de carregamento */}
        <View style={{
          flexDirection: 'row', gap: 5, marginTop: 28,
        }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{
              width: 5, height: 5, borderRadius: 3,
              backgroundColor: i === 0 ? PRIMARY : 'rgba(255,255,255,0.2)',
            }} />
          ))}
        </View>
      </Animated.View>
    </LinearGradient>
  );
}
