import './src/i18n'; // inicializa i18n antes de tudo
import React, { useState, useEffect, useRef } from 'react';
import { View, Alert, Platform, Modal, Text, TouchableOpacity, StyleSheet, Linking, AppState } from 'react-native';
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
import { registrarTokenPush } from './src/services/notificacoes';

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

import OnboardingScreen from './src/screens/OnboardingScreen';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChargingScreen from './src/screens/ChargingScreen';
import RankingScreen from './src/screens/RankingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WithdrawScreen from './src/screens/WithdrawScreen';
import RankingDetailScreen from './src/screens/RankingDetailScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import WalletScreen from './src/screens/WalletScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }) {
  return (
    <Text style={{ fontSize: focused ? 24 : 22, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>
  );
}

function MainTabs({ user, perfil, onAtualizar, atualizarPerfil }) {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tab.Screen name="Home" options={{ tabBarLabel: 'Início', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}>
        {(props) => <HomeScreen {...props} route={{ ...props.route, params: { user, perfil, onAtualizar } }} />}
      </Tab.Screen>
      <Tab.Screen name="Carregar" options={{ tabBarLabel: 'Carregar', tabBarIcon: ({ focused }) => <TabIcon emoji="⚡" focused={focused} /> }}>
        {(props) => <ChargingScreen {...props} route={{ ...props.route, params: { user, uid: perfil?.uid, onAtualizar } }} />}
      </Tab.Screen>
      <Tab.Screen name="Ranking" options={{ tabBarLabel: 'Ranking', tabBarIcon: ({ focused }) => <TabIcon emoji="🏆" focused={focused} /> }}>
        {(props) => <RankingScreen {...props} route={{ ...props.route, params: { uid: perfil?.uid, perfil } }} />}
      </Tab.Screen>
      <Tab.Screen name="Perfil" options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }}>
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
        options={{ headerShown: true, title: 'Solicitar Saque', headerStyle, headerTintColor }}
      />
      <Stack.Screen
        name="RankingDetail" component={RankingDetailScreen}
        options={{ headerShown: true, title: 'Detalhes', headerStyle, headerTintColor }}
      />
      <Stack.Screen
        name="EditProfile" component={EditProfileScreen}
        options={{ headerShown: true, title: 'Editar Perfil', headerStyle, headerTintColor, headerBackTitle: 'Retornar' }}
      />
      <Stack.Screen
        name="Wallet" component={WalletScreen}
        options={{ headerShown: true, title: 'Minha Carteira', headerStyle, headerTintColor, headerBackTitle: 'Voltar' }}
      />
    </Stack.Navigator>
  );
}

const ONBOARDING_KEY = '@cnb_onboarding_done';
const VERSAO_ATUAL = '1.2.35';

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
  const [onboardingFeito, setOnboardingFeito] = useState(null);
  const [updateObrigatorio, setUpdateObrigatorio] = useState(false);
  const sessaoUnsubRef = useRef(null);
  const userRef = useRef(null);

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

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(val => setOnboardingFeito(val === 'true'))
      .catch(() => setOnboardingFeito(true));
  }, []);

  async function concluirOnboarding() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setOnboardingFeito(true);
  }

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

  if (!splashDone || !pronto || onboardingFeito === null) {
    return <SplashScreen />;
  }

  if (!onboardingFeito) {
    return (
      <SafeAreaProvider>
        <OnboardingScreen onConcluir={concluirOnboarding} />
      </SafeAreaProvider>
    );
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

      <NavigationContainer>
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
