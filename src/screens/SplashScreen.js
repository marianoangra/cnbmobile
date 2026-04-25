import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function SplashScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const subY = useRef(new Animated.Value(16)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(subOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(subY, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.glowCircle, { opacity: glowOpacity }]} />

      <Animated.View style={{ transform: [{ scale: logoScale }], opacity: logoOpacity, alignItems: 'center' }}>
        <View style={styles.logoBox}>
          <Text style={styles.logoBolt}>⚡</Text>
          <Text style={styles.logo}>CNB</Text>
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: subOpacity, transform: [{ translateY: subY }], alignItems: 'center' }}>
        <Text style={styles.sub}>M O B I L E</Text>
        <Text style={styles.tagline}>Carregue e ganhe</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', gap: 16 },
    glowCircle: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: colors.primary,
      opacity: 0.06,
    },
    logoBox: {
      width: 120,
      height: 120,
      borderRadius: 32,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      gap: 2,
    },
    logoBolt: { fontSize: 32, lineHeight: 38 },
    logo: { fontSize: 28, fontWeight: 'bold', color: colors.primary, letterSpacing: 3 },
    sub: { fontSize: 16, color: colors.secondary, letterSpacing: 10, marginBottom: 8 },
    tagline: { fontSize: 13, color: colors.primary, opacity: 0.7, letterSpacing: 2 },
  });
}
