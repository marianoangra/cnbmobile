import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Platform, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { DeviceMotion } from 'expo-sensors';
import * as Location from 'expo-location';
import Svg, { Circle, G, Text as SvgText, Line } from 'react-native-svg';

import { BRIGHT_STARS } from '../data/brightStars';
import {
  raDecToAltAz,
  altAzToVector,
  buildRotationMatrix,
  projectWithMatrix,
  starBvToColor,
  getPlanetPositions,
} from '../utils/astronomy';

const { width: SW, height: SH } = Dimensions.get('window');
const NEON   = '#00FF7F';
const TWO_PI = 2 * Math.PI;
const DEG_65 = 65 * Math.PI / 180;

// Distância focal para FOV horizontal de 65° (cobre câmeras wide de smartphone)
const FOCAL = SW / (2 * Math.tan(DEG_65 / 2));

// ─── Raio visual por magnitude ────────────────────────────────────────────────
function starRadius(mag) {
  if (mag < 0)   return 5.0;
  if (mag < 0.5) return 4.0;
  if (mag < 1.0) return 3.2;
  if (mag < 1.5) return 2.5;
  if (mag < 2.0) return 1.9;
  return 1.4;
}

// ─── Metadados dos planetas ───────────────────────────────────────────────────
const PLANET_META = {
  sun:     { label: 'Sol',      color: '#FFE066', r: 8  },
  moon:    { label: 'Lua',      color: '#E8E8D0', r: 6  },
  mercury: { label: 'Mercúrio', color: '#B8A898', r: 3.5 },
  venus:   { label: 'Vênus',   color: '#FFD0A0', r: 4.5 },
  mars:    { label: 'Marte',   color: '#FF6644', r: 4  },
  jupiter: { label: 'Júpiter', color: '#FFD080', r: 5  },
  saturn:  { label: 'Saturno', color: '#E0C870', r: 4.5 },
};

// ─── Tela de permissão ────────────────────────────────────────────────────────
function PermissionScreen({ onRequest, loading }) {
  return (
    <View style={s.permScreen}>
      <Text style={s.permIcon}>🔭</Text>
      <Text style={s.permTitle}>Modo Céu AR</Text>
      <Text style={s.permDesc}>
        Para exibir as estrelas em realidade aumentada, o app precisa de acesso
        à câmera, localização e orientação do dispositivo.
      </Text>
      {loading ? (
        <ActivityIndicator color={NEON} size="large" style={{ marginTop: 24 }} />
      ) : (
        <TouchableOpacity style={s.permBtn} onPress={onRequest} activeOpacity={0.85}>
          <Text style={s.permBtnText}>Permitir e entrar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SkyARView({ onClose, pontosGanhos, segundosRestantes }) {
  const [camPermission, requestCamPerm] = useCameraPermissions();
  const [permStatus, setPermStatus]     = useState('idle');
  const [location, setLocation]         = useState(null);
  const [planetPositions, setPlanetPositions] = useState(null);

  // ── Refs de alta frequência (não disparam re-render) ─────────────────────
  // Rotação raw do sensor
  const rawRotRef = useRef({ alpha: 0, beta: Math.PI / 2, gamma: 0 });
  // Rotação com low-pass filter — sem jitter visual
  const smoothRotRef = useRef({ alpha: 0, beta: Math.PI / 2, gamma: 0 });
  // Vetores ENU pré-computados para cada estrela (atualiza a cada 5s)
  const starVectorsRef = useRef(null);
  // Vetores ENU pré-computados para planetas (atualiza junto com planetPositions)
  const planetVectorsRef = useRef(null);
  // Contador de frames para throttle
  const frameRef = useRef(0);

  // tick: dispara re-render a ~15fps (sensor a 30fps, throttle 2:1)
  const [tick, setTick] = useState(0);

  // ── Permissões ────────────────────────────────────────────────────────────
  const requestPermissions = useCallback(async () => {
    setPermStatus('requesting');

    // Câmera
    let cam = camPermission;
    if (!cam?.granted) cam = await requestCamPerm();
    if (!cam?.granted) { setPermStatus('denied'); return; }

    // Localização
    const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
    if (locStatus !== 'granted') { setPermStatus('denied'); return; }

    // Motion — iOS 13+ requer permissão explícita
    if (Platform.OS === 'ios') {
      const res = await DeviceMotion.requestPermissionsAsync?.();
      if (res && res.status !== 'granted') { setPermStatus('denied'); return; }
    }

    // Localização atual
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
    } catch {
      setLocation({ lat: -23.5505, lon: -46.6333 }); // Fallback: São Paulo
    }

    setPermStatus('granted');
  }, [camPermission, requestCamPerm]);

  // Auto-request se câmera já estava concedida
  useEffect(() => {
    if (camPermission?.granted) requestPermissions();
  }, []); // eslint-disable-line

  // ── Vetores ENU das estrelas — atualiza a cada 5s ─────────────────────────
  // Estrelas se movem ~0.004°/s → em 5s o deslocamento é < 0.1px na tela. Imperceptível.
  useEffect(() => {
    if (permStatus !== 'granted' || !location) return;

    function update() {
      const now = new Date();
      starVectorsRef.current = BRIGHT_STARS.map(([raH, decD]) => {
        const { alt, az } = raDecToAltAz(raH, decD, location.lat, location.lon, now);
        return altAzToVector(alt, az);
      });
    }

    update();
    const timer = setInterval(update, 5000);
    return () => clearInterval(timer);
  }, [permStatus, location]);

  // ── Posições dos planetas — atualiza a cada 60s ───────────────────────────
  useEffect(() => {
    if (permStatus !== 'granted' || !location) return;

    function update() {
      const pos = getPlanetPositions(location.lat, location.lon, new Date());
      setPlanetPositions(pos);
      // Pré-computa vetores ENU dos planetas junto com as posições
      const vectors = {};
      for (const [key, p] of Object.entries(pos)) {
        vectors[key] = altAzToVector(p.alt, p.az);
      }
      planetVectorsRef.current = vectors;
    }

    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [permStatus, location]);

  // ── DeviceMotion — 30fps, low-pass filter, throttle 2:1 para render ───────
  //
  // Low-pass filter: smooth = SMOOTH·prev + (1−SMOOTH)·raw
  //   SMOOTH = 0.72 → time constant ≈ 100ms @ 30fps
  //   Suficiente para eliminar jitter de alta frequência sem lag perceptível.
  //
  // Alpha (bússola) precisa de aritmética circular para evitar saltos em 0/2π.
  //
  useEffect(() => {
    if (permStatus !== 'granted') return;

    const SMOOTH = 0.72;
    DeviceMotion.setUpdateInterval(33); // 30fps

    const sub = DeviceMotion.addListener(({ rotation }) => {
      if (!rotation) return;

      const raw    = rotation;
      const prev   = smoothRotRef.current;

      // Aritmética circular para alpha
      let rawAlpha = raw.alpha ?? 0;
      let dAlpha   = rawAlpha - prev.alpha;
      if (dAlpha >  Math.PI) dAlpha -= TWO_PI;
      if (dAlpha < -Math.PI) dAlpha += TWO_PI;

      let newAlpha = prev.alpha + (1 - SMOOTH) * dAlpha;
      if (newAlpha < 0)       newAlpha += TWO_PI;
      if (newAlpha >= TWO_PI) newAlpha -= TWO_PI;

      rawRotRef.current = {
        alpha: rawAlpha,
        beta:  raw.beta  ?? Math.PI / 2,
        gamma: raw.gamma ?? 0,
      };

      smoothRotRef.current = {
        alpha: newAlpha,
        beta:  SMOOTH * prev.beta  + (1 - SMOOTH) * (raw.beta  ?? Math.PI / 2),
        gamma: SMOOTH * prev.gamma + (1 - SMOOTH) * (raw.gamma ?? 0),
      };

      // Throttle: dispara re-render a cada 2 updates de sensor = ~15fps
      frameRef.current += 1;
      if (frameRef.current % 2 === 0) {
        setTick(t => t + 1);
      }
    });

    return () => {
      sub.remove();
      DeviceMotion.setUpdateInterval(1000);
    };
  }, [permStatus]);

  // ── Render do céu — chamado a ~15fps ─────────────────────────────────────
  //
  // Otimizações:
  //  1. buildRotationMatrix: chama 6 trig + 9 multiplicações → Uma vez por frame
  //  2. projectWithMatrix: 9 mul + 6 add por estrela (sem alocação de array)
  //  3. starVectorsRef: raDecToAltAz pré-computado, não chamado aqui
  //
  function renderSky() {
    if (!starVectorsRef.current) return null;

    const { alpha, beta, gamma } = smoothRotRef.current;

    // Matriz de rotação R^T computada UMA vez para este frame
    const mat = buildRotationMatrix(alpha, beta, gamma);

    const elements = [];

    // ── Estrelas ────────────────────────────────────────────────────────────
    BRIGHT_STARS.forEach(([, , mag, bv, name], idx) => {
      const v = starVectorsRef.current[idx];
      if (!v) return;

      const pt = projectWithMatrix(v, mat, SW, SH, FOCAL);
      if (!pt) return;

      const r     = starRadius(mag);
      const color = starBvToColor(bv);
      const showLabel = mag < 1.5;

      elements.push(
        <G key={`s${idx}`}>
          {/* Halo externo difuso */}
          <Circle cx={pt.x} cy={pt.y} r={r * 5}   fill={color} fillOpacity={0.035} />
          {/* Halo interno */}
          <Circle cx={pt.x} cy={pt.y} r={r * 2.2} fill={color} fillOpacity={0.10}  />
          {/* Núcleo */}
          <Circle cx={pt.x} cy={pt.y} r={r}       fill={color} fillOpacity={0.95}  />
          {showLabel && (
            <SvgText
              x={pt.x + r + 5}
              y={pt.y + 4}
              fontSize={9}
              fill="rgba(255,255,255,0.52)"
              fontWeight="300"
            >
              {name}
            </SvgText>
          )}
        </G>
      );
    });

    // ── Planetas ─────────────────────────────────────────────────────────────
    if (planetVectorsRef.current) {
      for (const [key, meta] of Object.entries(PLANET_META)) {
        const v = planetVectorsRef.current?.[key];
        if (!v) continue;

        const pt = projectWithMatrix(v, mat, SW, SH, FOCAL);
        if (!pt) continue;

        elements.push(
          <G key={`p_${key}`}>
            <Circle cx={pt.x} cy={pt.y} r={meta.r * 4} fill={meta.color} fillOpacity={0.06} />
            <Circle cx={pt.x} cy={pt.y} r={meta.r * 2} fill={meta.color} fillOpacity={0.18} />
            <Circle cx={pt.x} cy={pt.y} r={meta.r}     fill={meta.color} fillOpacity={0.95} />
            <SvgText
              x={pt.x + meta.r + 6}
              y={pt.y + 4}
              fontSize={10}
              fill={meta.color}
              fillOpacity={0.82}
              fontWeight="500"
            >
              {meta.label}
            </SvgText>
          </G>
        );
      }
    }

    return elements;
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  const mins    = Math.floor((segundosRestantes ?? 0) / 60);
  const secs    = (segundosRestantes ?? 0) % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // ── Estados de permissão ─────────────────────────────────────────────────
  if (permStatus === 'idle' || (permStatus === 'requesting' && !camPermission?.granted)) {
    return (
      <View style={s.container}>
        <PermissionScreen
          onRequest={requestPermissions}
          loading={permStatus === 'requesting'}
        />
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (permStatus === 'denied') {
    return (
      <View style={s.container}>
        <View style={s.permScreen}>
          <Text style={s.permIcon}>🚫</Text>
          <Text style={s.permTitle}>Permissão negada</Text>
          <Text style={s.permDesc}>
            Habilite câmera e localização nas configurações do sistema para usar o Modo Céu.
          </Text>
        </View>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Modo AR ───────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>

      {/* Câmera como fundo — fullscreen */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Véu escurecedor — melhora contraste das estrelas na câmera */}
      <View style={s.veil} />

      {/* Overlay SVG — estrelas e planetas — wrapper com pointerEvents="none" */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={SW} height={SH}>
          {renderSky()}
        </Svg>
      </View>

      {/* HUD superior */}
      <View style={s.hud} pointerEvents="none">
        <View style={s.hudLeft}>
          <Text style={s.hudLabel}>PONTOS</Text>
          <Text style={s.hudValue}>{(pontosGanhos ?? 0).toLocaleString('pt-BR')}</Text>
        </View>

        <View style={s.hudCenter}>
          <View style={s.hudPill}>
            <View style={s.hudDot} />
            <Text style={s.hudPillTxt}>Céu AR</Text>
          </View>
        </View>

        <View style={s.hudRight}>
          <Text style={s.hudLabel}>RESTANTE</Text>
          <Text style={s.hudValue}>{timeStr}</Text>
        </View>
      </View>

      {/* Mira central */}
      <View style={s.crosshair} pointerEvents="none">
        <Svg width={24} height={24}>
          <Line x1={12} y1={2}  x2={12} y2={9}  stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
          <Line x1={12} y1={15} x2={12} y2={22} stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
          <Line x1={2}  y1={12} x2={9}  y2={12} stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
          <Line x1={15} y1={12} x2={22} y2={12} stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
          <Circle cx={12} cy={12} r={1.5} fill="rgba(255,255,255,0.32)" />
        </Svg>
      </View>

      {/* Obtendo localização */}
      {!location && (
        <View style={s.loadingBar} pointerEvents="none">
          <ActivityIndicator color={NEON} size="small" />
          <Text style={s.loadingTxt}>Obtendo localização...</Text>
        </View>
      )}

      {/* Botão fechar */}
      <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
        <Text style={s.closeTxt}>✕</Text>
      </TouchableOpacity>

    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },

  // ── HUD ──
  hud: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  hudLeft:  { alignItems: 'flex-start', minWidth: 72 },
  hudRight: { alignItems: 'flex-end',   minWidth: 72 },
  hudCenter: { flex: 1, alignItems: 'center' },
  hudLabel: {
    fontSize: 8, letterSpacing: 2,
    color: 'rgba(255,255,255,0.42)',
    textTransform: 'uppercase',
  },
  hudValue: {
    fontSize: 16, fontWeight: '600',
    color: '#fff', marginTop: 2,
  },
  hudPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,255,127,0.10)',
    borderWidth: 1, borderColor: 'rgba(0,255,127,0.25)',
    borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5,
  },
  hudDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#00FF7F',
  },
  hudPillTxt: {
    fontSize: 11, fontWeight: '600',
    color: '#00FF7F', letterSpacing: 0.5,
  },

  // ── Mira ──
  crosshair: {
    position: 'absolute',
    top:  SH / 2 - 12,
    left: SW / 2 - 12,
  },

  // ── Botão fechar ──
  closeBtn: {
    position: 'absolute',
    top: 52, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // ── Permissão ──
  permScreen: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#010e05',
  },
  permIcon:  { fontSize: 52, marginBottom: 20 },
  permTitle: {
    fontSize: 22, fontWeight: '700',
    color: '#fff', marginBottom: 12, textAlign: 'center',
  },
  permDesc: {
    fontSize: 14, color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', lineHeight: 22,
  },
  permBtn: {
    marginTop: 32, backgroundColor: '#00FF7F',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36,
  },
  permBtnText: { color: '#001508', fontWeight: '700', fontSize: 16 },

  // ── Loading ──
  loadingBar: {
    position: 'absolute', bottom: 48,
    left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  loadingTxt: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
});
