import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Battery from 'expo-battery';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adicionarPontos } from '../services/pontos';

const SESSAO_KEY = 'cnb_sessao_carregamento';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function pedirPermissao() {
  await Notifications.requestPermissionsAsync();
}

async function notificar(titulo, corpo) {
  await Notifications.scheduleNotificationAsync({
    content: { title: titulo, body: corpo },
    trigger: null,
  });
}

// Calcula pontos + bônus horário para N minutos partindo de um acumulado
function calcularPontos(minutosJaAcumulados, novosMinutos) {
  const horasAntes = Math.floor(minutosJaAcumulados / 60);
  const horasDepois = Math.floor((minutosJaAcumulados + novosMinutos) / 60);
  return novosMinutos * 10 + (horasDepois - horasAntes) * 50;
}

function estaCarregando(state) {
  return state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
}

export function useCarregamento(uid, onPontosAdicionados) {
  const [carregando, setCarregando] = useState(false);
  const [pontosGanhos, setPontosGanhos] = useState(0);
  const [segundosRestantes, setSegundosRestantes] = useState(3600);

  // Refs para acesso estável dentro de callbacks/timers
  const uidRef = useRef(uid);
  const carregandoRef = useRef(false);
  const minutosRef = useRef(0);
  const onAtualizarRef = useRef(onPontosAdicionados);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => { uidRef.current = uid; }, [uid]);
  useEffect(() => { onAtualizarRef.current = onPontosAdicionados; }, [onPontosAdicionados]);
  useEffect(() => { carregandoRef.current = carregando; }, [carregando]);

  // ─── AsyncStorage helpers ───────────────────────────────────────────────────

  async function salvarSessao(minutos) {
    if (!uidRef.current) return;
    await AsyncStorage.setItem(SESSAO_KEY, JSON.stringify({
      uid: uidRef.current,
      ultimoRegistro: Date.now(),
      minutosAcumulados: minutos,
    }));
  }

  async function limparSessao() {
    await AsyncStorage.removeItem(SESSAO_KEY);
  }

  // ─── Recuperação de background ──────────────────────────────────────────────

  async function recuperarBackground() {
    try {
      const raw = await AsyncStorage.getItem(SESSAO_KEY);
      if (!raw) return 0;

      const { uid: savedUid, ultimoRegistro, minutosAcumulados } = JSON.parse(raw);
      if (savedUid !== uidRef.current) return 0;

      // Verifica se ainda está carregando
      const state = await Battery.getBatteryStateAsync();
      if (!estaCarregando(state)) {
        await limparSessao();
        return 0;
      }

      const minutosBackground = Math.floor((Date.now() - ultimoRegistro) / 60000);
      if (minutosBackground <= 0) return 0;

      const pontos = calcularPontos(minutosAcumulados, minutosBackground);
      await adicionarPontos(savedUid, pontos, minutosBackground);
      onAtualizarRef.current?.();

      // Atualiza acumulado e salva
      minutosRef.current = minutosAcumulados + minutosBackground;
      await salvarSessao(minutosRef.current);

      return pontos;
    } catch {
      return 0;
    }
  }

  // ─── Contador visual de segundos ────────────────────────────────────────────

  const iniciarContador = useCallback(() => {
    if (countdownRef.current) return;
    setSegundosRestantes(3600 - (minutosRef.current % 60) * 60);
    countdownRef.current = setInterval(() => {
      setSegundosRestantes(prev => prev <= 1 ? 3600 : prev - 1);
    }, 1000);
  }, []);

  const pararContador = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // ─── Sessão de carregamento ─────────────────────────────────────────────────

  const iniciarSessao = useCallback(() => {
    if (intervalRef.current) return;
    pedirPermissao();
    iniciarContador();
    salvarSessao(minutosRef.current);

    intervalRef.current = setInterval(async () => {
      if (!uidRef.current) return;
      minutosRef.current += 1;
      const bonus = minutosRef.current % 60 === 0 ? 50 : 0;
      const total = 10 + bonus;
      try {
        await adicionarPontos(uidRef.current, total, 1);
        setPontosGanhos(prev => prev + total);
        onAtualizarRef.current?.();
        await salvarSessao(minutosRef.current);
        if (bonus > 0) {
          notificar('🎁 Bônus de 1 hora!', `Você ganhou +${total} pontos (10 + 50 de bônus)!`);
        } else if (minutosRef.current % 30 === 0) {
          notificar('⚡ Pontos ganhos!', `+${minutosRef.current * 10} pts acumulados. Continue carregando!`);
        }
      } catch { /* ignora erros de rede */ }
    }, 60000);
  }, [iniciarContador]);

  const pararSessao = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    pararContador();
    minutosRef.current = 0;
    setSegundosRestantes(3600);
    limparSessao();
  }, [pararContador]);

  // ─── AppState: retorno ao foreground ───────────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;
      if (!carregandoRef.current) return;

      const pontosRecuperados = await recuperarBackground();
      if (pontosRecuperados > 0) {
        setPontosGanhos(prev => prev + pontosRecuperados);
        notificar(
          '⚡ Pontos recuperados!',
          `+${pontosRecuperados} pts contabilizados enquanto você estava fora.`,
        );
      }
    });
    return () => sub.remove();
  }, []);

  // ─── Inicialização: bateria ─────────────────────────────────────────────────

  useEffect(() => {
    let sub;
    (async () => {
      try {
        const state = await Battery.getBatteryStateAsync();
        const charging = estaCarregando(state);

        if (charging) {
          const recuperados = await recuperarBackground();
          if (recuperados > 0) setPontosGanhos(recuperados);
        }

        setCarregando(charging);
        if (charging) iniciarSessao();
        else pararSessao();

        sub = Battery.addBatteryStateListener(({ batteryState }) => {
          const c = estaCarregando(batteryState);
          setCarregando(c);
          if (c) iniciarSessao();
          else pararSessao();
        });
      } catch (e) {
        console.warn('Erro ao inicializar bateria:', e);
        setCarregando(false);
      }
    })();
    return () => { sub?.remove(); pararSessao(); };
  }, [iniciarSessao, pararSessao]);

  return { carregando, pontosGanhos, segundosRestantes };
}
