import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, useWindowDimensions, FlatList, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';

const slides = [
  {
    id: '1',
    emoji: '⚡',
    title: 'Bem-vindo ao\nCNB Mobile',
    desc: 'Transforme o tempo de carregamento do seu celular em recompensas reais, direto no seu PIX.',
    corFundo: '#0d2a0d',
    corBorda: colors.primary,
  },
  {
    id: '2',
    emoji: '🔌',
    title: 'Conecte e\nganhe pontos',
    desc: '+10 pontos por minuto carregando. A cada hora completa, receba +50 pts de bônus automático!',
    corFundo: '#0a1a2a',
    corBorda: '#3A8DFF',
  },
  {
    id: '3',
    emoji: '💰',
    title: 'Saque via PIX\nsem complicação',
    desc: 'Acumule 100.000 pontos e solicite um saque direto para sua chave PIX em até 72 horas.',
    corFundo: '#2a1000',
    corBorda: '#F5A623',
  },
  {
    id: '4',
    emoji: '👥',
    title: 'Convide amigos\ne ganhe mais',
    desc: 'Compartilhe seu código único e ganhe +100 pontos por cada amigo que se cadastrar!',
    corFundo: '#12082a',
    corBorda: '#A855F7',
  },
];

function Dot({ active, corAtiva }) {
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
  const { width } = useWindowDimensions();
  const [indice, setIndice] = useState(0);
  const listRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

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

  async function concluir() {
    try {
      await AsyncStorage.setItem('onboarding_completo', 'true');
    } catch (e) {
      console.warn('Erro ao salvar onboarding:', e);
    }
    onConcluir();
  }

  function avancar() {
    if (isUltimo) concluir();
    else irPara(indice + 1);
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Pular */}
      <View style={styles.topBar}>
        {!isUltimo && (
          <TouchableOpacity onPress={concluir} activeOpacity={0.7} style={styles.pularBtn}>
            <Text style={styles.pularText}>Pular</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* FlatList oculta (só para manter referência) */}
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

      {/* Conteúdo animado */}
      <Animated.View style={[
        styles.slideContent,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}>
        <View style={[styles.iconCircle, { backgroundColor: slide.corFundo, borderColor: slide.corBorda }]}>
          {slide.id === '1'
            ? <Image source={require('../../assets/icon.png')} style={styles.iconImg} />
            : <Text style={styles.emoji}>{slide.emoji}</Text>}
        </View>
        <Text style={styles.titulo}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>
      </Animated.View>

      {/* Dots */}
      <View style={styles.dotsRow}>
        {slides.map((s, i) => (
          <Dot key={s.id} active={i === indice} corAtiva={slide.corBorda} />
        ))}
      </View>

      {/* Botões */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btnAvancar, {
            backgroundColor: isUltimo ? slide.corBorda : 'transparent',
            borderColor: slide.corBorda,
          }]}
          onPress={avancar}
          activeOpacity={0.85}>
          <Text style={[styles.btnAvancarText, { color: isUltimo ? colors.background : slide.corBorda }]}>
            {isUltimo ? '🚀 Começar agora' : 'Próximo  →'}
          </Text>
        </TouchableOpacity>

        {isUltimo && (
          <TouchableOpacity onPress={concluir} style={styles.jaTemContaBtn} activeOpacity={0.7}>
            <Text style={styles.jaTemContaText}>Já tenho uma conta</Text>
          </TouchableOpacity>
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { height: 52, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 20 },
  pularBtn: { padding: 8 },
  pularText: { fontSize: 14, color: colors.secondary },

  slideContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingBottom: 20,
  },
  iconCircle: {
    width: 150, height: 150, borderRadius: 75,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 40, borderWidth: 2,
  },
  emoji: { fontSize: 68 },
  iconImg: { width: 110, height: 110, borderRadius: 24 },
  titulo: {
    fontSize: 30, fontWeight: 'bold', color: colors.white,
    textAlign: 'center', marginBottom: 16, lineHeight: 38,
  },
  desc: {
    fontSize: 16, color: colors.secondary,
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
  jaTemContaText: { fontSize: 14, color: colors.secondary },
});
