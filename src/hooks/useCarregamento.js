import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { iniciarForegroundService, pararForegroundService, servicoRodando, SESSAO_KEY } from '../services/backgroundService';
import { logInicioCarregamento, logFimCarregamento, logSessaoOnChain } from '../services/analytics';

function calcularPontosTotal(minutos) {
  return minutos * 10 + Math.floor(minutos / 60) * 50;
}

function estaCarregando(state) {
  return state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
}

export function useCarregamento(uid, onPontosAdicionados) {
  const [carregando, setCarregando] = useState(false);
  const [pontosGanhos, setPontosGanhos] = useState(0);
  const [segundosRestantes, setSegundosRestantes] = useState(3600);

  const uidRef = useRef(uid);
  const carregandoRef = useRef(false);
  const minutosRef = useRef(0);
  const onAtualizarRef = useRef(onPontosAdicionados);
  const countdownRef = useRef(null);
  const minuteTickRef = useRef(null);
  const montadoRef = useRef(true);

  // Mutex: evita chamadas concorrentes de iniciar/parar sessão
  const iniciandoSessaoRef = useRef(false);
  const parandoSessaoRef = useRef(false);

  // Debounce: aguarda Android estabilizar o estado da bateria antes de agir
  const batteryDebounceRef = useRef(null);

  useEffect(() => { uidRef.current = uid; }, [uid]);
  useEffect(() => { onAtualizarRef.current = onPontosAdicionados; }, [onPontosAdicionados]);
  useEffect(() => { carregandoRef.current = carregando; }, [carregando]);
  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  // ─── Timers visuais ──────────────────────────────────────────────────────────

  const iniciarContador = useCallback(() => {
    if (countdownRef.current) return;
    setSegundosRestantes(3600 - (minutosRef.current % 60) * 60);
    countdownRef.current = setInterval(() => {
      setSegundosRestantes(prev => prev <= 1 ? 3600 : prev - 1);
    }, 1000);
  }, []);

  const pararContador = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (minuteTickRef.current) { clearInterval(minuteTickRef.current); minuteTickRef.current = null; }
  }, []);

  // ─── Sessão ──────────────────────────────────────────────────────────────────

  const iniciarSessao = useCallback(async () => {
    if (!uidRef.current) return;
    // Mutex: impede chamadas concorrentes (Android pode disparar múltiplos eventos de bateria)
    if (iniciandoSessaoRef.current) return;
    iniciandoSessaoRef.current = true;

    try {
      // Restaura minutos acumulados de sessão existente (app voltou ao foreground)
      try {
        const raw = await AsyncStorage.getItem(SESSAO_KEY);
        if (raw) {
          const { uid: savedUid, minutosAcumulados } = JSON.parse(raw);
          if (savedUid === uidRef.current && minutosAcumulados > minutosRef.current) {
            minutosRef.current = minutosAcumulados;
            if (montadoRef.current) setPontosGanhos(calcularPontosTotal(minutosAcumulados));
          }
        }
      } catch {}

      iniciarContador();
      logInicioCarregamento();

      // Tick local a cada minuto — só atualiza UI (Firestore é gravado pelo Foreground Service)
      if (!minuteTickRef.current) {
        minuteTickRef.current = setInterval(() => {
          minutosRef.current += 1;
          if (montadoRef.current) {
            setPontosGanhos(calcularPontosTotal(minutosRef.current));

          }
        }, 60000);
      }

      // Inicia o Foreground Service — roda em background e escreve no Firestore
      try {
        await iniciarForegroundService(uidRef.current);
      } catch (e) {
        console.warn('[Carregar] Erro ao iniciar serviço:', e?.message);
      }
    } finally {
      iniciandoSessaoRef.current = false;
    }
  }, [iniciarContador]);

  const pararSessao = useCallback(async (minutosFinal) => {
    // Mutex: impede chamadas concorrentes
    if (parandoSessaoRef.current) return;
    parandoSessaoRef.current = true;

    try {
      const minutos = minutosFinal ?? minutosRef.current;
      if (minutos > 0) logFimCarregamento(minutos, calcularPontosTotal(minutos));
      pararContador();
      minutosRef.current = 0;
      if (montadoRef.current) {
        setPontosGanhos(0);
        setSegundosRestantes(3600);
      }
      // Limpa AsyncStorage aqui: se o serviço foi morto pelo SO, ele nunca
      // executa removeItem, e a próxima sessão carregaria os minutos antigos.
      await AsyncStorage.removeItem(SESSAO_KEY).catch(() => {});
      try { await pararForegroundService(); } catch {}
      if (minutos > 0) {
        // Registra prova on-chain da sessão (não-bloqueante — falha silenciosa)
        httpsCallable(getFunctions(), 'registrarProvasSessao')({ duracaoMinutos: minutos })
          .then(r => logSessaoOnChain(minutos, calcularPontosTotal(minutos), r?.data?.signature))
          .catch(() => logSessaoOnChain(minutos, calcularPontosTotal(minutos), null));
        onAtualizarRef.current?.();
      }
    } finally {
      parandoSessaoRef.current = false;
    }
  }, [pararContador]);

  // ─── Sincroniza ao retornar ao foreground ────────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;
      if (!carregandoRef.current) return;

      try {
        const raw = await AsyncStorage.getItem(SESSAO_KEY);
        if (raw) {
          const { minutosAcumulados } = JSON.parse(raw);
          if (minutosAcumulados > minutosRef.current) {
            minutosRef.current = minutosAcumulados;
            if (montadoRef.current) setPontosGanhos(calcularPontosTotal(minutosAcumulados));
          }
        }
      } catch {}

      // Detecta serviço morto pelo SO: UI acha que está carregando mas serviço parou.
      // Reinicia se bateria ainda está carregando — o listener de bateria cuida do caso contrário.
      if (!servicoRodando() && uidRef.current) {
        try {
          const state = await Battery.getBatteryStateAsync();
          if (estaCarregando(state)) {
            await iniciarForegroundService(uidRef.current);
          }
        } catch {}
      }

      onAtualizarRef.current?.();
    });
    return () => sub.remove();
  }, []);

  // ─── Inicialização: detecção de bateria ──────────────────────────────────────

  useEffect(() => {
    let sub;
    let ativo = true;

    (async () => {
      try {
        const state = await Battery.getBatteryStateAsync();
        if (!ativo) return;
        const charging = estaCarregando(state);
        if (montadoRef.current) setCarregando(charging);
        if (charging) {
          await iniciarSessao();
        }
        // Não chama pararSessao() no mount quando não está carregando —
        // evita chamar onAtualizar desnecessariamente na abertura da tela

        sub = Battery.addBatteryStateListener(({ batteryState }) => {
          // Debounce: Android pode disparar múltiplos eventos ao conectar/desconectar USB.
          // Aguarda 1500ms para o estado estabilizar antes de agir.
          if (batteryDebounceRef.current) clearTimeout(batteryDebounceRef.current);
          batteryDebounceRef.current = setTimeout(async () => {
            batteryDebounceRef.current = null;
            if (!ativo) return;
            try {
              const c = estaCarregando(batteryState);
              if (montadoRef.current) setCarregando(c);
              if (c) {
                await iniciarSessao();
              } else {
                await pararSessao();
              }
            } catch (e) {
              console.warn('[Carregar] Erro no listener de bateria:', e);
            }
          }, 1500);
        });
      } catch (e) {
        console.warn('[Carregar] Erro ao inicializar bateria:', e);
        if (ativo && montadoRef.current) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
      if (batteryDebounceRef.current) {
        clearTimeout(batteryDebounceRef.current);
        batteryDebounceRef.current = null;
      }
      sub?.remove();
      pararContador();
      pararForegroundService().catch(() => {});
    };
  }, [iniciarSessao, pararSessao, pararContador]);

  return { carregando, pontosGanhos, segundosRestantes };
}
