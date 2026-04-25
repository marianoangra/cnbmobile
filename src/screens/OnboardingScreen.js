import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, useWindowDimensions, FlatList, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { Plug, Coins, Users } from 'lucide-react-native';

const SLIDE_META = [
  { id: '1', Icon: null,  corFundo: '#0d2a0d', corBorda: '#39FF6A' },
  { id: '2', Icon: Plug,  corFundo: '#0a1a2a', corBorda: '#3A8DFF' },
  { id: '3', Icon: Coins, corFundo: '#2a1000', corBorda: '#F5A623' },
  { id: '4', Icon: Users, corFundo: '#12082a', corBorda: '#A855F7' },
];

function Dot({ active, corAtiva, colors }) {
  const animWidth = useRef(new Animated.Value(active ? 24 : 8)).current;
  const animOpacity = useRef(new Animated.Value(active ? 1 : 0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animWidth, { toValue: active ? 24 : 8, useNativeDriver: false, speed: 20 }),
      Animated.timing(animOpacity, { toValue: active ? 1 : 0.4, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [active]);

  return (
    <Animated.View style={[
      styles.dot,
      { width: animWidth, opacity: animOpacity, backgroundColor: active ? corAtiva : colors.border },
    ]} />
  );
}

export default function OnboardingScreen({ onConcluir }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [indice, setIndice] = useState(0);
  const listRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const slides = [
    { ...SLIDE_META[0], title: t('onboarding.slide1Title'), desc: t('onboarding.slide1Desc') },
    { ...SLIDE_META[1], title: t('onboarding.slide2Title'), desc: t('onboarding.slide2Desc') },
    { ...SLIDE_META[2], title: t('onboarding.slide3Title'), desc: t('onboarding.slide3Desc') },
    { ...SLIDE_META[3], title: t('onboarding.slide4Title'), desc: t('onboarding.slide4Desc') },
  ];

  const slide = slides[indice];
  const isUltimo = indice === slides.length - 1;

  const irPara = useCallback((novoIndice) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      listRef.current?.scrollToIndex({ index: novoIndice, animated: false });
      setIndice(novoIndice);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  function avancar() {
    if (isUltimo) onConcluir();
    else irPara(indice + 1);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>

      <View style={styles.topBar}>
        {!isUltimo && (
          <TouchableOpacity onPress={onConcluir} activeOpacity={0.7} style={styles.pularBtn}>
            <Text style={[styles.pularText, { color: colors.secondary }]}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={s => s.id}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ position: 'absolute', opacity: 0, height: 0 }}
        renderItem={() => <View style={{ width }} />}
      />

      <Animated.View style={[
        styles.slideContent,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}>
        <View style={[styles.iconCircle, { backgroundColor: slide.corFundo, borderColor: slide.corBorda }]}>
          {slide.id === '1'
            ? <Image source={require('../../assets/icon.png')} style={styles.iconImg} />
            : <slide.Icon size={68} color={slide.corBorda} strokeWidth={1.5} />}
        </View>
        <Text style={[styles.titulo, { color: colors.white }]}>{slide.title}</Text>
        <Text style={[styles.desc, { color: colors.secondary }]}>{slide.desc}</Text>
      </Animated.View>

      <View style={styles.dotsRow}>
        {slides.map((s, i) => (
          <Dot key={s.id} active={i === indice} corAtiva={slide.corBorda} colors={colors} />
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btnAvancar, {
            backgroundColor: isUltimo ? slide.corBorda : 'transparent',
            borderColor: slide.corBorda,
          }]}
          onPress={avancar}
          activeOpacity={0.85}>
          <Text style={[styles.btnAvancarText, { color: isUltimo ? colors.background : slide.corBorda }]}>
            {isUltimo ? t('onboarding.start') : t('onboarding.next')}
          </Text>
        </TouchableOpacity>

        {isUltimo && (
          <TouchableOpacity onPress={onConcluir} style={styles.jaTemContaBtn} activeOpacity={0.7}>
            <Text style={[styles.jaTemContaText, { color: colors.secondary }]}>{t('onboarding.hasAccount')}</Text>
          </TouchableOpacity>
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { height: 52, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 20 },
  pularBtn: { padding: 8 },
  pularText: { fontSize: 14 },

  slideContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingBottom: 20,
  },
  iconCircle: {
    width: 150, height: 150, borderRadius: 75,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 40, borderWidth: 2,
  },
  iconImg: { width: 110, height: 110, borderRadius: 24 },
  titulo: {
    fontSize: 30, fontWeight: 'bold',
    textAlign: 'center', marginBottom: 16, lineHeight: 38,
  },
  desc: {
    fontSize: 16,
    textAlign: 'center', lineHeight: 24,
  },

  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 28 },
  dot: { height: 8, borderRadius: 4 },

  footer: { paddingHorizontal: 24, paddingBottom: 12, alignItems: 'center' },
  btnAvancar: {
    width: '100%', borderRadius: 16, padding: 18,
    alignItems: 'center', borderWidth: 2, marginBottom: 4,
  },
  btnAvancarText: { fontSize: 17, fontWeight: 'bold' },
  jaTemContaBtn: { padding: 14 },
  jaTemContaText: { fontSize: 14 },
});
