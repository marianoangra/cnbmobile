import './global.css'; // NativeWind
import './src/i18n'; // inicializa i18n antes de tudo
import React, { useState, useEffect, useRef } from 'react';
import { View, Alert, Platform, Modal, Text, TouchableOpacity, StyleSheet, Linking, AppState, StatusBar, Animated } from 'react-native';
import * as Battery from 'expo-battery';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/services/firebase';
import { registrarSessao, limparSessao, escutarSessao } from './src/services/session';
import * as Notifications from 'expo-notifications';
import { registrarTokenPush, agendarLembreteCarregamento } from './src/services/notificacoes';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
import { getPerfil, criarPerfil, registrarLoginDiario } from './src/services/pontos';
import { getConfiguracaoApp } from './src/services/config';
import { setUsuarioId, resetUsuarioId, logLoginDiario } from './src/services/analytics';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import { Home, Zap, Trophy, User, Target } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MissoesScreen from './src/screens/MissoesScreen';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChargingScreen from './src/screens/ChargingScreen';
import RankingScreen from './src/screens/RankingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WithdrawScreen from './src/screens/WithdrawScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import WalletScreen from './src/screens/WalletScreen';
import DePINInfoScreen from './src/screens/DePINInfoScreen';
import BuyTokensScreen from './src/screens/BuyTokensScreen';
import DadosScreen from './src/screens/DadosScreen';
import RelatorioContaScreen from './src/screens/RelatorioContaScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const PRIMARY = '#c6ff4a';

const TAB_ICONS = {
  Home: Home,
  Missoes: Target,
  Carregar: Zap,
  Ranking: Trophy,
  Perfil: User,
};

function FloatingTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  // ── Estado de carregamento para animação do botão central ──
  const [charging, setCharging] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim  = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let sub;
    Battery.getBatteryStateAsync()
      .then(s => setCharging(s === Battery.BatteryState.CHARGING || s === Battery.BatteryState.FULL))
      .catch(() => {});
    sub = Battery.addBatteryStateListener(({ batteryState }) =>
      setCharging(batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL)
    );
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    pulseAnim.stopAnimation();
    glowAnim.stopAnimation();
    if (charging) {
      // Pulso rápido quando carregando
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.09, duration: 650, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 650, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1,   duration: 650, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.2, duration: 650, useNativeDriver: true }),
        ])
      ).start();
    } else {
      // Respiração suave quando parado
      glowAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.94, duration: 2200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 2200, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [charging]);

  return (
    <>
      {/* Bloco sólido abaixo da pill — impede conteúdo de aparecer sob o menu */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: insets.bottom + 14,
          backgroundColor: '#000',
        }}
      />

      <View style={{
        position: 'absolute',
        bottom: insets.bottom + 14,
        left: 16,
        right: 16,
        alignItems: 'center',
        pointerEvents: 'box-none',
      }}>
        <View style={{
          flexDirection: 'row',
          backgroundColor: 'rgba(14,19,14,0.97)',
          borderRadius: 50,
          height: 66,
          alignItems: 'center',
          paddingHorizontal: 6,
          width: '100%',
          // Shadow ajustada por plataforma
          shadowColor: '#000',
          shadowOffset: { width: 0, height: Platform.OS === 'ios' ? 4 : 10 },
          shadowOpacity: Platform.OS === 'ios' ? 0.22 : 0.45,
          shadowRadius: Platform.OS === 'ios' ? 10 : 20,
          elevation: 14,
          borderWidth: 1,
          borderColor: 'rgba(198,255,74,0.10)',
        }}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel ?? route.name;
            const focused = state.index === index;
            const isCenter = index === 2;
            const Icon = TAB_ICONS[route.name] ?? Zap;

            function onPress() {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }

            if (isCenter) {
              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  activeOpacity={0.85}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}>

                  {/* Container que sobe acima da pill */}
                  <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: -28, marginBottom: 2 }}>
                    {/* Halo — visível quando carregando */}
                    <Animated.View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        width: 70, height: 70, borderRadius: 35,
                        backgroundColor: PRIMARY,
                        opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] }),
                      }}
                    />
                    {/* Botão principal animado */}
                    <Animated.View style={{
                      width: 54, height: 54, borderRadius: 27,
                      backgroundColor: PRIMARY,
                      alignItems: 'center', justifyContent: 'center',
                      shadowColor: PRIMARY,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.6,
                      shadowRadius: 14,
                      elevation: 10,
                      transform: [{ scale: pulseAnim }],
                    }}>
                      <Icon size={22} color="#0A0F1E" strokeWidth={2.5} />
                    </Animated.View>
                  </View>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.8}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
                <Icon
                  size={20}
                  color={focused ? PRIMARY : 'rgba(255,255,255,0.40)'}
                  strokeWidth={focused ? 2.4 : 2.0}
                />
                <Text style={{
                  fontSize: 9,
                  fontWeight: focused ? '700' : '500',
                  color: focused ? PRIMARY : 'rgba(255,255,255,0.40)',
                  marginTop: 4,
                  letterSpacing: 0.2,
                }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

function MainTabs({ user, perfil, onAtualizar, atualizarPerfil }) {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      sceneContainerStyle={{ backgroundColor: 'transparent' }}
      screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" options={{ tabBarLabel: 'Início' }}>
        {(props) => <HomeScreen {...props} route={{ ...props.route, params: { user, perfil, onAtualizar } }} />}
      </Tab.Screen>
      <Tab.Screen name="Missoes" options={{ tabBarLabel: 'Missões' }}>
        {(props) => <MissoesScreen {...props} route={{ ...props.route, params: { user, perfil, onAtualizar } }} />}
      </Tab.Screen>
      <Tab.Screen name="Carregar" options={{ tabBarLabel: 'Carregar' }}>
        {(props) => <ChargingScreen {...props} route={{ ...props.route, params: { user, uid: perfil?.uid, perfil, onAtualizar } }} />}
      </Tab.Screen>
      <Tab.Screen name="Ranking" options={{ tabBarLabel: 'Ranking' }}>
        {(props) => <RankingScreen {...props} route={{ ...props.route, params: { uid: perfil?.uid, perfil } }} />}
      </Tab.Screen>
      <Tab.Screen name="Perfil" options={{ tabBarLabel: 'Perfil' }}>
        {(props) => <ProfileScreen {...props} route={{ ...props.route, params: { user, perfil, onAtualizar, atualizarPerfil } }} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function AppNavigator({ user, perfil, onAtualizar, atualizarPerfil }) {
  const { colors } = useTheme();
  const headerStyle = { backgroundColor: colors.card };
  const headerTintColor = colors.white;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {() => <MainTabs user={user} perfil={perfil} onAtualizar={onAtualizar} atualizarPerfil={atualizarPerfil} />}
      </Stack.Screen>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Withdraw" component={WithdrawScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile" component={EditProfileScreen}
        options={{ headerShown: true, title: 'Editar Perfil', headerStyle, headerTintColor, headerBackTitle: 'Retornar' }}
      />
      <Stack.Screen
        name="Wallet" component={WalletScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DePINInfo" component={DePINInfoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BuyTokens" component={BuyTokensScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Dados" component={DadosScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RelatorioConta" component={RelatorioContaScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

const VERSAO_ATUAL = '1.2.37';

const STORE_URL = Platform.OS === 'ios'
  ? 'https://apps.apple.com/app/id6741577961'
  : 'https://play.google.com/store/apps/details?id=com.cnb.cnbappv2';

function precisaAtualizar(atual, minima) {
  const parse = v => (v ?? '0.0.0').split('.').map(Number);
  const [ma, mi, pa] = parse(atual);
  const [mb, mib, pb] = parse(minima);
  if (ma !== mb) return ma < mb;
  if (mi !== mib) return mi < mib;
  return pa < pb;
}

function AppContent() {
  const { colors } = useTheme();
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [pronto, setPronto] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [updateObrigatorio, setUpdateObrigatorio] = useState(false);
  const sessaoUnsubRef = useRef(null);
  const userRef = useRef(null);
  const navigationRef = useRef(null);

  // Garante mínimo de 2s na splash — independente da velocidade do Firebase
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    getConfiguracaoApp().then(config => {
      if (config?.versao_minima && precisaAtualizar(VERSAO_ATUAL, config.versao_minima)) {
        setUpdateObrigatorio(true);
      }
    });
  }, []);

  async function carregarPerfil(u) {
    try {
      const timeout = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), 20000)
      );
      let p = await Promise.race([getPerfil(u.uid), timeout]);
      if (!p) p = await criarPerfil(u.uid, u.displayName ?? u.email ?? 'Usuário', u.email ?? '');
      setPerfil(p);

      registrarLoginDiario(u.uid).then(async (foiNovoDia) => {
        if (foiNovoDia) {
          logLoginDiario();
          const atualizado = await getPerfil(u.uid);
          if (atualizado) setPerfil(atualizado);
        }
      }).catch(() => {});
    } catch (e) {
      console.warn('Erro ao carregar perfil:', e);
      setPerfil({ uid: u.uid, nome: u.displayName ?? u.email ?? 'Usuário', email: u.email ?? '', pontos: 0 });
    }
  }

  useEffect(() => { userRef.current = user; }, [user]);

  // Listener: usuário tocou numa notificação → navega para a tela indicada em data.tela
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const tela = response.notification.request.content.data?.tela;
      if (tela && navigationRef.current) {
        navigationRef.current.navigate(tela);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;
      const u = userRef.current;
      if (!u) return;
      try {
        const foiNovoDia = await registrarLoginDiario(u.uid);
        if (foiNovoDia) {
          logLoginDiario();
          const atualizado = await getPerfil(u.uid);
          if (atualizado) setPerfil(atualizado);
        }
      } catch { /* silencia */ }
    });
    return () => sub.remove();
  }, []);

  async function onAtualizar() {
    if (!user) return;
    try {
      const p = await getPerfil(user.uid);
      if (p) setPerfil(p);
    } catch { /* ignora */ }
  }

  function atualizarPerfilDireto(updates) {
    setPerfil(prev => prev ? { ...prev, ...updates } : prev);
  }

  function iniciarEscutaSessao(uid, token) {
    sessaoUnsubRef.current?.();
    sessaoUnsubRef.current = escutarSessao(uid, token, () => {
      Alert.alert(
        'Sessão encerrada',
        'Sua conta foi acessada em outro dispositivo.',
        [{ text: 'OK' }]
      );
    });
  }

  useEffect(() => {
    let mounted = true;

    const timeout = setTimeout(() => {
      if (mounted && !pronto) {
        setPronto(true);
      }
    }, 10000);

    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        clearTimeout(timeout);
        if (!mounted) return;

        if (u) {
          const registrarComTimeout = Promise.race([
            registrarSessao(u.uid),
            new Promise((_, rej) => setTimeout(() => rej(new Error('sessao_timeout')), 8000)),
          ]);
          let novoToken;
          try {
            novoToken = await registrarComTimeout;
          } catch (e) {
            console.warn('[Sessão] registrarSessao falhou, continuando sem token:', e.message);
            novoToken = null;
          }
          if (novoToken) iniciarEscutaSessao(u.uid, novoToken);
          setUser(u);
          setUsuarioId(u.uid);
          await carregarPerfil(u);
          registrarTokenPush(u.uid).catch(() => {});
        } else {
          sessaoUnsubRef.current?.();
          sessaoUnsubRef.current = null;
          setUser(null);
          setPerfil(null);
          resetUsuarioId();
        }

        if (mounted) setPronto(true);
      } catch (e) {
        console.warn('Erro no onAuthStateChanged:', e);
        if (mounted) {
          sessaoUnsubRef.current?.();
          sessaoUnsubRef.current = null;
          setUser(null);
          setPerfil(null);
          setPronto(true);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      unsub();
      sessaoUnsubRef.current?.();
    };
  }, []);

  if (!splashDone || !pronto) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaProvider>
      <Modal visible={updateObrigatorio} transparent animationType="fade" statusBarTranslucent>
        <View style={updateStyles.overlay}>
          <View style={updateStyles.card}>
            <Text style={updateStyles.emoji}>🚀</Text>
            <Text style={updateStyles.titulo}>Atualização necessária</Text>
            <Text style={updateStyles.mensagem}>
              Uma nova versão do CNB Mobile está disponível com melhorias importantes.
              Atualize agora para continuar usando o app.
            </Text>
            <TouchableOpacity
              style={updateStyles.btn}
              activeOpacity={0.85}
              onPress={() => Linking.openURL(STORE_URL)}>
              <Text style={updateStyles.btnText}>Atualizar agora</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <NavigationContainer ref={navigationRef}>
        <AppNavigator
          user={user}
          perfil={perfil}
          onAtualizar={onAtualizar}
          atualizarPerfil={atualizarPerfilDireto}
        />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const updateStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#0d1f0d',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00FF7F',
    width: '100%',
  },
  emoji: { fontSize: 52, marginBottom: 16 },
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  mensagem: {
    fontSize: 15,
    color: '#8a9a8a',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  btn: {
    backgroundColor: '#00FF7F',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  btnText: {
    color: '#0A0F1E',
    fontWeight: 'bold',
    fontSize: 17,
  },
});
