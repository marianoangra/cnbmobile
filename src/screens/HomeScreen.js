import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, Easing, interpolate,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import * as Battery from 'expo-battery';
import {
  Bell, ArrowUpRight, ArrowDownLeft,
  QrCode, Lock, Wallet, Activity, BarChart3,
} from 'lucide-react-native';
import Avatar from '../components/Avatar';
import KastBanner from '../components/KastBanner';
import SolflareBanner from '../components/SolflareBanner';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIMARY  = '#c6ff4a';
const META     = 100000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useEntrada(delayMs = 0) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(20);
  useEffect(() => {
    const cfg = { duration: 480, easing: Easing.out(Easing.cubic) };
    opacity.value    = withDelay(delayMs, withTiming(1, cfg));
    translateY.value = withDelay(delayMs, withTiming(0, cfg));
  }, []);
  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

function useCarregando() {
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    let sub;
    Battery.getBatteryStateAsync()
      .then(s => setCarregando(
        s === Battery.BatteryState.CHARGING || s === Battery.BatteryState.FULL
      ))
      .catch(() => {});
    sub = Battery.addBatteryStateListener(({ batteryState }) =>
      setCarregando(
        batteryState === Battery.BatteryState.CHARGING ||
        batteryState === Battery.BatteryState.FULL
      )
    );
    return () => sub?.remove();
  }, []);
  return carregando;
}

// ─── Dados estáticos (Figma) ──────────────────────────────────────────────────
const ATALHOS = [
  { Icon: Wallet,    label: 'Wallet', id: 'wallet' },
  { Icon: Activity,  label: 'DePIN',  id: 'depin'  },
  { Icon: QrCode,    label: 'PIX',    id: 'pix'    },
  { Icon: BarChart3, label: 'Dados',  id: 'stats'  },
];

const ATIVIDADES = [
  { Icon: ArrowDownLeft, title: 'Recompensa de caminho', sub: 'DePIN · +1.240 passos', value: '+420 pts', pos: true  },
  { Icon: ArrowUpRight,  title: 'PIX enviado',           sub: 'Ana Costa · Hoje, 09:12', value: '-R$ 32,00', pos: false },
  { Icon: ArrowDownLeft, title: 'Prova ZK resgatada',    sub: 'Cloak · verificada',    value: '+180 pts', pos: true  },
];

// ─── Componentes internos ─────────────────────────────────────────────────────

function AvatarHeader({ user, perfil }) {
  const inicial = (perfil?.nome ?? 'U').charAt(0).toUpperCase();
  return (
    <LinearGradient
      colors={['#a6ff3d', '#2ecc71']}
      start={{ x: 0.13, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
    >
      {user && perfil?.avatarURL ? (
        <Avatar uri={perfil.avatarURL} nome={perfil.nome} size={40} />
      ) : (
        <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>{inicial}</Text>
      )}
    </LinearGradient>
  );
}

function CardPontos({ pontos, progresso, faltam, user, estaCarregando, onSaque, onPix, barStyle }) {
  const pct = Math.round(progresso * 100);
  return (
    <LinearGradient
      colors={['#182418', '#0c1410', '#070a07']}
      locations={[0, 0.6, 1]}
      start={{ x: 0.05, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(198,255,74,0.25)',
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {/* Glows radiais — fiel ao Figma */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%">
          <Defs>
            <RadialGradient id="gTR" cx="1" cy="0" r="1" gradientUnits="objectBoundingBox">
              <Stop offset="0%"   stopColor="#c6ff4a" stopOpacity="0.18" />
              <Stop offset="70%"  stopColor="#c6ff4a" stopOpacity="0" />
              <Stop offset="100%" stopColor="#c6ff4a" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="gBL" cx="0" cy="1" r="0.9" gradientUnits="objectBoundingBox">
              <Stop offset="0%"   stopColor="#2ecc71" stopOpacity="0.12" />
              <Stop offset="70%"  stopColor="#2ecc71" stopOpacity="0" />
              <Stop offset="100%" stopColor="#2ecc71" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gTR)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gBL)" />
        </Svg>
      </View>

      {/* Topo: label + badge */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Seus pontos</Text>
        {user && estaCarregando ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: 'rgba(198,255,74,0.1)',
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
          }}>
            <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '600' }}>⚡ Ativo</Text>
          </View>
        ) : (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 3,
            backgroundColor: 'rgba(198,255,74,0.1)',
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
          }}>
            <ArrowUpRight size={11} color={PRIMARY} />
            <Text style={{ fontSize: 10, color: PRIMARY }}>+2,4%</Text>
          </View>
        )}
      </View>

      {/* Valor de pontos */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8 }}>
        <Text style={{
          fontSize: 40, fontWeight: '600', color: PRIMARY,
          lineHeight: 44, letterSpacing: -1,
        }}>
          {pontos.toLocaleString('pt-BR')}
        </Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '500', marginBottom: 6 }}>pts</Text>
      </View>

      {/* Barra de progresso */}
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderRadius: 99, height: 8, marginTop: 16,
        overflow: 'hidden',
      }}>
        <Animated.View style={[{
          backgroundColor: PRIMARY, height: 8, borderRadius: 99,
        }, barStyle]} />
      </View>

      {/* Texto de progresso */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', flex: 1 }}>
          {!user
            ? 'Entre para acumular pontos'
            : faltam > 0
              ? `Faltam ${faltam.toLocaleString('pt-BR')} pts para saque`
              : '🎉 Você pode sacar agora!'}
        </Text>
        {user && (
          <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '600' }}>{pct}%</Text>
        )}
      </View>

      {/* Botões CTA */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <TouchableOpacity
          onPress={onSaque}
          activeOpacity={0.85}
          style={{
            flex: 1, backgroundColor: PRIMARY,
            borderRadius: 12, paddingVertical: 10,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <ArrowUpRight size={14} color="#000" />
          <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' }}>Saque</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPix}
          activeOpacity={0.85}
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
            borderRadius: 12, paddingVertical: 10,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Lock size={14} color="rgba(255,255,255,0.8)" />
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>Privado</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

function Atalhos({ onPress }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
      {ATALHOS.map(({ Icon, label, id }) => (
        <TouchableOpacity
          key={id}
          onPress={() => onPress(id)}
          activeOpacity={0.75}
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
            borderRadius: 14, paddingVertical: 17,
            alignItems: 'center', gap: 7,
          }}
        >
          <Icon size={22} color={PRIMARY} />
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Atividades({ onVerTudo }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Atividades</Text>
        <TouchableOpacity onPress={onVerTudo} activeOpacity={0.7}>
          <Text style={{ fontSize: 10, color: PRIMARY }}>Ver tudo</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 8 }}>
        {ATIVIDADES.map((t, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              padding: 12, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: t.pos ? 'rgba(198,255,74,0.15)' : 'rgba(255,255,255,0.10)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <t.Icon size={16} color={t.pos ? PRIMARY : 'rgba(255,255,255,0.8)'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '500', color: '#fff' }} numberOfLines={1}>{t.title}</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }} numberOfLines={1}>{t.sub}</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: t.pos ? PRIMARY : 'rgba(255,255,255,0.8)' }}>
              {t.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function HomeScreen({ route, navigation }) {
  const { user, perfil, onAtualizar } = route?.params || {};
  const onAtualizarRef = useRef(onAtualizar);
  useEffect(() => { onAtualizarRef.current = onAtualizar; }, [onAtualizar]);

  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    if (user) onAtualizarRef.current?.();
    return () => setFocused(false);
  }, [user]));

  const pontos    = perfil?.pontos ?? 0;
  const progresso = Math.min(pontos / META, 1);
  const faltam    = Math.max(META - pontos, 0);
  const podeSacar = pontos >= META;
  const nome      = perfil?.nome?.split(' ')[0] ?? (user ? 'Usuário' : 'Visitante');
  const estaCarregando = useCarregando();

  // Barra de progresso animada
  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withDelay(300, withTiming(progresso, { duration: 900 }));
  }, [pontos]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${interpolate(barWidth.value, [0, 1], [0, 100])}%`,
  }));

  // Carousel de banners (RN Animated — callback no JS thread, sem problemas de serialização)
  const [bannerIdx, setBannerIdx] = useState(0);
  const bannerFade = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    const timer = setInterval(() => {
      RNAnimated.timing(bannerFade, { toValue: 0, duration: 400, useNativeDriver: true }).start(({ finished }) => {
        if (finished) {
          setBannerIdx(prev => (prev === 0 ? 1 : 0));
          RNAnimated.timing(bannerFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        }
      });
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Animações de entrada escalonadas
  const a0 = useEntrada(0);
  const a1 = useEntrada(60);
  const a2 = useEntrada(120);
  const a3 = useEntrada(180);
  const a4 = useEntrada(240);

  // Handlers de navegação
  function handleSaque() {
    if (!user) return navigation.navigate('Login');
    if (!podeSacar) return Alert.alert('Pontos insuficientes', 'Você precisa de 100.000 pts para sacar.');
    navigation.navigate('Withdraw', { perfil });
  }

  function handlePrivado() {
    if (!user) return navigation.navigate('Login');
    navigation.navigate('Withdraw', { perfil, initialAba: 'privado' });
  }

  function handleAtalho(id) {
    if (id === 'pix')    return navigation.navigate('BuyTokens');
    if (id === 'stats')  return navigation.navigate('Ranking', { uid: perfil?.uid, perfil });
    if (id === 'depin')  return navigation.navigate('DePINInfo');
    if (id === 'wallet') return navigation.navigate('Wallet', { user: perfil });
  }

  return (
    <LinearGradient
      colors={['#0b1310', '#0a0f0d', '#000000']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ── */}
          <Animated.View style={[
            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
            a0,
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AvatarHeader user={user} perfil={perfil} />
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                  {saudacao()}, {nome}!
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                  Vamos somar pontos hoje?
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Bell size={16} color="rgba(255,255,255,0.8)" />
              {/* Dot indicador */}
              <View style={{
                position: 'absolute', top: 7, right: 7,
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: PRIMARY,
              }} />
            </TouchableOpacity>
          </Animated.View>

          {/* ── Card de Pontos ── */}
          <Animated.View style={a1}>
            <CardPontos
              pontos={pontos}
              progresso={progresso}
              faltam={faltam}
              user={user}
              estaCarregando={estaCarregando}
              onSaque={handleSaque}
              onPix={handlePrivado}
              barStyle={barStyle}
            />
          </Animated.View>

          {/* ── Atalhos rápidos ── */}
          <Animated.View style={a2}>
            <Atalhos onPress={handleAtalho} />
          </Animated.View>

          {/* ── Banners (carousel 6s) ── */}
          <Animated.View style={[{ marginBottom: 20 }, a3]}>
            <Text style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 8 }}>
              Anúncios
            </Text>
            <RNAnimated.View style={{ opacity: bannerFade }}>
              {bannerIdx === 0
                ? <KastBanner uid={perfil?.uid} />
                : <SolflareBanner />}
            </RNAnimated.View>
          </Animated.View>

          {/* ── Atividades ── */}
          <Animated.View style={a4}>
            <Atividades onVerTudo={() => navigation.navigate('Ranking', { uid: perfil?.uid, perfil })} />
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
