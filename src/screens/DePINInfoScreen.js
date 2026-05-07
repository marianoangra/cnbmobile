import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, Image, ScrollView, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Zap, Shield, Activity, ArrowLeft, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PRIMARY = '#c6ff4a';

export default function DePINInfoScreen({ navigation }) {
  const { t } = useTranslation();
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(32)).current;
  const [faqAberto, setFaqAberto] = useState(null);

  const FAQ = useMemo(() => [
    { q: t('dePINInfo.faqQ1'), a: t('dePINInfo.faqA1') },
    { q: t('dePINInfo.faqQ2'), a: t('dePINInfo.faqA2') },
    { q: t('dePINInfo.faqQ3'), a: t('dePINInfo.faqA3') },
    { q: t('dePINInfo.faqQ4'), a: t('dePINInfo.faqA4') },
    { q: t('dePINInfo.faqQ5'), a: t('dePINInfo.faqA5') },
    { q: t('dePINInfo.faqQ6'), a: t('dePINInfo.faqA6') },
    { q: t('dePINInfo.faqQ7'), a: t('dePINInfo.faqA7') },
    { q: t('dePINInfo.faqQ8'), a: t('dePINInfo.faqA8') },
  ], [t]);

  const PILARES = useMemo(() => [
    { Icon: Activity, titulo: t('dePINInfo.pillarRealActivityTitle'), desc: t('dePINInfo.pillarRealActivityDesc') },
    { Icon: Shield,   titulo: t('dePINInfo.pillarZKTitle'),           desc: t('dePINInfo.pillarZKDesc') },
    { Icon: Zap,      titulo: t('dePINInfo.pillarPrivateTitle'),      desc: t('dePINInfo.pillarPrivateDesc') },
  ], [t]);

  function alternarFaq(index) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFaqAberto(faqAberto === index ? null : index);
  }

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={['#000000', '#05100b', '#071a12']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Back button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
          }}
        >
          <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t('dePINInfo.back')}</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity, transform: [{ translateY }] }}>

            {/* Logo + nome */}
            <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 32 }}>
              {/* Halo */}
              <Svg
                style={{ position: 'absolute', top: -60 }}
                width={220}
                height={220}
                pointerEvents="none"
              >
                <Defs>
                  <RadialGradient id="haloDepin" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
                    <Stop offset="0%"  stopColor={PRIMARY} stopOpacity="0.14" />
                    <Stop offset="60%" stopColor={PRIMARY} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="220" height="220" fill="url(#haloDepin)" />
              </Svg>
              <Image
                source={require('../../assets/icon.png')}
                style={{
                  width: 100, height: 100, borderRadius: 24,
                  borderWidth: 2, borderColor: 'rgba(198,255,74,0.3)',
                }}
                resizeMode="cover"
              />
              <Text style={{
                marginTop: 16, fontSize: 26, fontWeight: '700',
                color: '#fff', letterSpacing: -0.5,
              }}>
                JUICE Mobile
              </Text>
              <View style={{
                marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: 'rgba(198,255,74,0.1)',
                borderWidth: 1, borderColor: 'rgba(198,255,74,0.3)',
                borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5,
              }}>
                <Zap size={12} color={PRIMARY} fill={PRIMARY} />
                <Text style={{ fontSize: 11, color: PRIMARY, fontWeight: '700', letterSpacing: 1 }}>
                  SOLANA DePIN
                </Text>
              </View>
            </View>

            {/* Headline */}
            <View style={{
              backgroundColor: 'rgba(198,255,74,0.05)',
              borderWidth: 1, borderColor: 'rgba(198,255,74,0.2)',
              borderRadius: 20, padding: 20, marginBottom: 28,
            }}>
              <Text style={{
                fontSize: 18, fontWeight: '700', color: '#fff',
                lineHeight: 26, marginBottom: 10,
              }}>
                {t('dePINInfo.headline')}
              </Text>
              <Text style={{
                fontSize: 14, color: 'rgba(255,255,255,0.7)',
                lineHeight: 22,
              }}>
                {t('dePINInfo.headlineDesc')}
              </Text>
            </View>

            {/* Pilares */}
            <Text style={{
              fontSize: 10, letterSpacing: 2,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase', marginBottom: 14,
            }}>
              {t('dePINInfo.howItWorks')}
            </Text>

            <View style={{ gap: 10, marginBottom: 32 }}>
              {PILARES.map(({ Icon, titulo, desc }, i) => (
                <View key={i} style={{
                  flexDirection: 'row', gap: 14,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                  borderRadius: 16, padding: 16,
                }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: 'rgba(198,255,74,0.1)',
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={18} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 4 }}>
                      {titulo}
                    </Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 18 }}>
                      {desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* FAQ */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <HelpCircle size={14} color={PRIMARY} />
              <Text style={{
                fontSize: 10, letterSpacing: 2,
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
              }}>
                {t('dePINInfo.faqTitle')}
              </Text>
            </View>

            <View style={{ gap: 8, marginBottom: 32 }}>
              {FAQ.map(({ q, a }, i) => {
                const aberto = faqAberto === i;
                return (
                  <View key={i} style={{
                    backgroundColor: aberto ? 'rgba(198,255,74,0.04)' : 'rgba(255,255,255,0.03)',
                    borderWidth: 1,
                    borderColor: aberto ? 'rgba(198,255,74,0.18)' : 'rgba(255,255,255,0.07)',
                    borderRadius: 14,
                    overflow: 'hidden',
                  }}>
                    <TouchableOpacity
                      onPress={() => alternarFaq(i)}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        padding: 14,
                      }}
                    >
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' }}>
                        {q}
                      </Text>
                      {aberto
                        ? <ChevronUp size={18} color={PRIMARY} />
                        : <ChevronDown size={18} color="rgba(255,255,255,0.4)" />
                      }
                    </TouchableOpacity>
                    {aberto && (
                      <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 19 }}>
                          {a}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Rodapé */}
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                Powered by Solana · Cloak Protocol · ZK Privacy
              </Text>
            </View>

          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
