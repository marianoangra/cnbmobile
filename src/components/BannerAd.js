import React, { useRef, useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const BANNERS = [
  {
    id: 'carregar',
    icon: '⚡',
    iconBg: '#0d2a0d',
    bg: '#071507',
    border: '#39FF6A',
    titulo: 'Coloque para carregar!',
    sub: '+10 pts por minuto. Bônus de +50 pts a cada hora.',
    cor: '#39FF6A',
  },
  {
    id: 'pix',
    icon: '💰',
    iconBg: '#2a1500',
    bg: '#140a00',
    border: '#F5A623',
    titulo: 'Saque via PIX',
    sub: 'Acumule 100.000 pts e receba direto na sua conta.',
    cor: '#F5A623',
  },
  {
    id: 'ranking',
    icon: '🏆',
    iconBg: '#1c1c08',
    bg: '#0e0e04',
    border: '#EAB308',
    titulo: 'Você está no ranking?',
    sub: 'Veja sua posição entre os maiores acumuladores.',
    cor: '#EAB308',
  },
];

const INTERVALO = 8000;

export default function BannerAd({ onPress, active = true }) {
  const { colors } = useTheme();
  const [indice, setIndice] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    let cancelado = false;
    const timer = setInterval(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -12, duration: 250, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished || cancelado) return;
        setIndice(prev => (prev + 1) % BANNERS.length);
        slideAnim.setValue(12);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      });
    }, INTERVALO);

    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, [active]);

  const banner = BANNERS[indice];

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: banner.bg, borderColor: banner.border }]}
        onPress={() => onPress?.(banner.id)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}>

        <Animated.View style={[styles.row, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: banner.iconBg }]}>
            <Text style={styles.icon}>{banner.icon}</Text>
          </View>
          <View style={styles.textArea}>
            <Text style={[styles.titulo, { color: banner.cor }]}>{banner.titulo}</Text>
            <Text style={[styles.sub, { color: colors.secondary }]}>{banner.sub}</Text>
          </View>
        </Animated.View>

        {/* Dots */}
        <View style={styles.dots}>
          {BANNERS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === indice && { backgroundColor: banner.cor, width: 14 }]}
            />
          ))}
        </View>

      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconCircle: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 22 },
  textArea: { flex: 1 },
  titulo: { fontWeight: 'bold', fontSize: 15 },
  sub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  dots: {
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#2a3a4a',
  },
});
