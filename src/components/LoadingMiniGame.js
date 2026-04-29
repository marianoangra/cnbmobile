import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import Svg, { Polygon, Rect, Circle, Ellipse, G } from 'react-native-svg';
import { useAccent } from '../context/AccentContext';
import { creditarPontosMiniGame } from '../services/miniGamePoints';

const PLAYER_W = 28;
const PLAYER_H = 30;
const SHIP_SPRITE_W = 46;
const SHIP_SPRITE_H = 60;
const ENEMY_SIZE = 30;
const ENEMY_COLOR = '#E25555';
const BULLET_W = 3;
const BULLET_H = 10;
const FIRE_INTERVAL_MS = 250;
const FIRST_SPAWN_MS = 1500;
const SPAWN_INTERVAL_MIN_MS = 5000;
const SPAWN_INTERVAL_MAX_MS = 10000;
const SPAWN_FADE_IN_MS = 400;
const pickSpawnInterval = () =>
  SPAWN_INTERVAL_MIN_MS + Math.random() * (SPAWN_INTERVAL_MAX_MS - SPAWN_INTERVAL_MIN_MS);
const ENEMY_BULLET_SPEED = 220;
const PLAYER_BULLET_SPEED = 460;
const ENEMY_SPEED_BASE = 80;
const INVULN_MS = 1500;
const SCORE_TICK_MS = 2000;
const AUTO_SAVE_MS = 10000;
const ENEMY_BULLET_COLOR = '#FF6B3D';
const RESTART_DELAY_MS = 2000;
const TAP_MAX_MS = 300;
const TAP_MAX_DRIFT = 20;
const DOUBLE_TAP_GAP_MS = 400;

const ENEMY_TYPES = {
  COMUM: 'comum',
  MEDIO: 'medio',
  ATIRADOR: 'atirador',
};

let nextId = 1;
const id = () => nextId++;

function spawnEnemy(width, _height, elapsedSec, now, forceX) {
  const rand = Math.random();
  let type;
  if (elapsedSec < 15) type = ENEMY_TYPES.COMUM;
  else if (rand < 0.55) type = ENEMY_TYPES.COMUM;
  else if (rand < 0.85) type = ENEMY_TYPES.MEDIO;
  else type = ENEMY_TYPES.ATIRADOR;

  const x = forceX != null ? forceX : ENEMY_SIZE + Math.random() * (width - ENEMY_SIZE * 2);
  const speed = ENEMY_SPEED_BASE + Math.min(elapsedSec, 60) * 1.2;

  if (type === ENEMY_TYPES.COMUM) {
    return { id: id(), type, x, y: -ENEMY_SIZE, hp: 1, vx: 0, vy: speed, phase: Math.random() * Math.PI * 2, lastShot: 0, spawnedAt: now };
  }
  if (type === ENEMY_TYPES.MEDIO) {
    return { id: id(), type, x, y: -ENEMY_SIZE, hp: 2, vx: 0, vy: speed * 0.85, phase: Math.random() * Math.PI * 2, lastShot: 0, spawnedAt: now };
  }
  return { id: id(), type, x, y: -ENEMY_SIZE, hp: 2, vx: 0, vy: speed * 0.65, phase: 0, lastShot: 0, spawnedAt: now };
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export default function LoadingMiniGame({
  userEmail,
  uid,
  isLoadingComplete = false,
  playAreaBounds,
  onScoreSaved,
}) {
  const PRIMARY = useAccent();

  const width = playAreaBounds?.width ?? 0;
  const height = playAreaBounds?.height ?? 0;

  const playerRef = useRef({ x: width / 2, y: height - PLAYER_H - 4 });
  const enemiesRef = useRef([]);
  const bulletsRef = useRef([]);
  const enemyBulletsRef = useRef([]);
  const particlesRef = useRef([]);
  const livesRef = useRef(3);
  const invulnRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const lastFireRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const spawnIntervalRef = useRef(FIRST_SPAWN_MS);
  const lastFrameRef = useRef(0);
  const restartingAtRef = useRef(0);
  const sizeRef = useRef({ width, height });

  const visualPendingRef = useRef(0);
  const scoreRealRef = useRef(0);
  const pendingSaveRef = useRef(0);
  const capReachedRef = useRef(false);
  const savingRef = useRef(false);

  const pausedRef = useRef(false);
  const tapStartRef = useRef({ t: 0, x: 0, y: 0 });
  const lastTapEndRef = useRef(0);

  const [hudScore, setHudScore] = useState(0);
  const [hudLives, setHudLives] = useState(3);
  const [hudPaused, setHudPaused] = useState(false);
  const [, setFrame] = useState(0);

  const rafRef = useRef(null);
  const fireIntervalRef = useRef(null);
  const scoreIntervalRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const finalSavingRef = useRef(false);

  useEffect(() => {
    sizeRef.current = { width, height };
    if (width > 0 && height > 0) {
      playerRef.current.x = Math.max(PLAYER_W / 2, Math.min(width - PLAYER_W / 2, playerRef.current.x || width / 2));
      playerRef.current.y = height - PLAYER_H - 4;
    }
  }, [width, height]);

  const flushSave = useCallback(async (final = false) => {
    if (!uid) return;
    if (savingRef.current && !final) return;
    const qtd = pendingSaveRef.current;
    if (qtd <= 0) return;
    savingRef.current = true;
    pendingSaveRef.current = 0;
    try {
      const res = await creditarPontosMiniGame(uid, qtd);
      if (res.capAtingido) capReachedRef.current = true;
      if (mountedRef.current && typeof onScoreSaved === 'function') {
        try { onScoreSaved(res.creditados); } catch {}
      }
    } catch (e) {
      pendingSaveRef.current += qtd;
      if (__DEV__) console.warn('[MiniGame] Falha no save:', e?.message);
    } finally {
      savingRef.current = false;
    }
  }, [uid, onScoreSaved]);

  const resetGame = useCallback(() => {
    enemiesRef.current = [];
    bulletsRef.current = [];
    enemyBulletsRef.current = [];
    particlesRef.current = [];
    livesRef.current = 3;
    invulnRef.current = 0;
    visualPendingRef.current = 0;
    startedAtRef.current = Date.now();
    lastSpawnRef.current = 0;
    spawnIntervalRef.current = FIRST_SPAWN_MS;
    pausedRef.current = false;
    lastTapEndRef.current = 0;
    setHudLives(3);
    setHudPaused(false);
    const { width: w, height: h } = sizeRef.current;
    playerRef.current = { x: w / 2, y: h - PLAYER_H - 4 };
  }, []);

  const tick = useCallback(() => {
    if (!mountedRef.current) return;
    const now = Date.now();
    if (lastFrameRef.current === 0) lastFrameRef.current = now;
    const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05);
    lastFrameRef.current = now;

    const { width: w, height: h } = sizeRef.current;

    if (restartingAtRef.current === 0 && w > 0 && h > 0 && !pausedRef.current) {
      const elapsedSec = (now - startedAtRef.current) / 1000;
      if (lastSpawnRef.current === 0) lastSpawnRef.current = now;

      if (now - lastSpawnRef.current > spawnIntervalRef.current) {
        const waveSize = 4 + Math.floor(Math.random() * 3); // 4-6 enemies
        const slotW = (w - ENEMY_SIZE * 2) / waveSize;
        for (let i = 0; i < waveSize; i++) {
          const jitter = (Math.random() - 0.5) * slotW * 0.4;
          const slotX = ENEMY_SIZE + (i + 0.5) * slotW + jitter;
          enemiesRef.current.push(spawnEnemy(w, h, elapsedSec, now, slotX));
        }
        lastSpawnRef.current = now;
        spawnIntervalRef.current = pickSpawnInterval();
      }

      if (invulnRef.current > 0) invulnRef.current = Math.max(0, invulnRef.current - dt * 1000);

      const player = playerRef.current;

      bulletsRef.current.forEach((b) => { b.y -= PLAYER_BULLET_SPEED * dt; });
      bulletsRef.current = bulletsRef.current.filter((b) => b.y + BULLET_H > 0);

      enemyBulletsRef.current.forEach((b) => { b.y += ENEMY_BULLET_SPEED * dt; });
      enemyBulletsRef.current = enemyBulletsRef.current.filter((b) => b.y < h);

      enemiesRef.current.forEach((e) => {
        if (e.type === ENEMY_TYPES.MEDIO) {
          e.phase += dt * 3;
          e.x += Math.sin(e.phase) * 60 * dt;
        } else if (e.type === ENEMY_TYPES.ATIRADOR) {
          if (now - e.lastShot > 1400) {
            e.lastShot = now;
            enemyBulletsRef.current.push({ id: id(), x: e.x, y: e.y + ENEMY_SIZE / 2 });
          }
        }
        e.y += e.vy * dt;
        if (e.x < ENEMY_SIZE / 2) e.x = ENEMY_SIZE / 2;
        if (e.x > w - ENEMY_SIZE / 2) e.x = w - ENEMY_SIZE / 2;
      });
      enemiesRef.current = enemiesRef.current.filter((e) => e.y - ENEMY_SIZE < h);

      const survivingBullets = [];
      for (const b of bulletsRef.current) {
        let hit = false;
        for (const e of enemiesRef.current) {
          if (e.hp <= 0) continue;
          const ex = e.x - ENEMY_SIZE / 2;
          const ey = e.y - ENEMY_SIZE / 2;
          if (rectsOverlap(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H, ex, ey, ENEMY_SIZE, ENEMY_SIZE)) {
            e.hp -= 1;
            hit = true;
            if (e.hp <= 0) {
              const pts = e.type === ENEMY_TYPES.COMUM ? 1 : e.type === ENEMY_TYPES.MEDIO ? 2 : 3;
              visualPendingRef.current += pts;
              for (let i = 0; i < 6; i++) {
                particlesRef.current.push({
                  id: id(),
                  x: e.x, y: e.y,
                  vx: (Math.random() - 0.5) * 180,
                  vy: (Math.random() - 0.5) * 180,
                  life: 0.3,
                });
              }
            }
            break;
          }
        }
        if (!hit) survivingBullets.push(b);
      }
      bulletsRef.current = survivingBullets;
      enemiesRef.current = enemiesRef.current.filter((e) => e.hp > 0);

      const px = player.x - PLAYER_W / 2;
      const py = player.y - PLAYER_H / 2;
      if (invulnRef.current === 0 && livesRef.current > 0) {
        for (const e of enemiesRef.current) {
          const ex = e.x - ENEMY_SIZE / 2;
          const ey = e.y - ENEMY_SIZE / 2;
          if (rectsOverlap(px, py, PLAYER_W, PLAYER_H, ex, ey, ENEMY_SIZE, ENEMY_SIZE)) {
            livesRef.current -= 1;
            invulnRef.current = INVULN_MS;
            setHudLives(livesRef.current);
            break;
          }
        }
      }
      if (invulnRef.current === 0 && livesRef.current > 0) {
        const remaining = [];
        for (const b of enemyBulletsRef.current) {
          if (rectsOverlap(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H, px, py, PLAYER_W, PLAYER_H)) {
            livesRef.current -= 1;
            invulnRef.current = INVULN_MS;
            setHudLives(livesRef.current);
            break;
          } else {
            remaining.push(b);
          }
        }
        enemyBulletsRef.current = remaining;
      }

      particlesRef.current.forEach((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      if (livesRef.current <= 0 && restartingAtRef.current === 0) {
        restartingAtRef.current = now;
        restartTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            resetGame();
            restartingAtRef.current = 0;
          }
        }, RESTART_DELAY_MS);
      }
    }

    setFrame((f) => (f + 1) % 1000000);
    rafRef.current = requestAnimationFrame(tick);
  }, [resetGame]);

  useEffect(() => {
    mountedRef.current = true;
    lastFrameRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);

    fireIntervalRef.current = setInterval(() => {
      if (restartingAtRef.current !== 0) return;
      if (pausedRef.current) return;
      const p = playerRef.current;
      if (!p) return;
      bulletsRef.current.push({ id: id(), x: p.x, y: p.y - PLAYER_H / 2 });
    }, FIRE_INTERVAL_MS);

    scoreIntervalRef.current = setInterval(() => {
      if (visualPendingRef.current <= 0) return;
      visualPendingRef.current -= 1;
      if (!capReachedRef.current) {
        scoreRealRef.current += 1;
        pendingSaveRef.current += 1;
        if (mountedRef.current) setHudScore(scoreRealRef.current);
      }
    }, SCORE_TICK_MS);

    saveIntervalRef.current = setInterval(() => { flushSave(false); }, AUTO_SAVE_MS);

    return () => {
      mountedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (fireIntervalRef.current) clearInterval(fireIntervalRef.current);
      if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (!finalSavingRef.current) {
        finalSavingRef.current = true;
        flushSave(true);
      }
    };
  }, [tick, flushSave]);

  useEffect(() => {
    if (isLoadingComplete && !finalSavingRef.current) {
      finalSavingRef.current = true;
      flushSave(true);
    }
  }, [isLoadingComplete, flushSave]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const { width: w, height: h } = sizeRef.current;
        tapStartRef.current = { t: Date.now() };
        if (w > 0 && h > 0) {
          playerRef.current.x = Math.max(PLAYER_W / 2, Math.min(w - PLAYER_W / 2, locationX));
          playerRef.current.y = Math.max(PLAYER_H / 2, Math.min(h - PLAYER_H / 2, locationY));
        }
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const { width: w, height: h } = sizeRef.current;
        if (w > 0 && h > 0) {
          playerRef.current.x = Math.max(PLAYER_W / 2, Math.min(w - PLAYER_W / 2, locationX));
          playerRef.current.y = Math.max(PLAYER_H / 2, Math.min(h - PLAYER_H / 2, locationY));
        }
      },
      onPanResponderRelease: (_e, g) => {
        const now = Date.now();
        const start = tapStartRef.current;
        const dist = Math.sqrt(g.dx * g.dx + g.dy * g.dy);
        const duration = now - (start.t || now);
        const isTap = duration <= TAP_MAX_MS && dist <= TAP_MAX_DRIFT;
        if (!isTap) {
          lastTapEndRef.current = 0;
          return;
        }
        if (lastTapEndRef.current && now - lastTapEndRef.current <= DOUBLE_TAP_GAP_MS) {
          const wasPaused = pausedRef.current;
          pausedRef.current = !wasPaused;
          setHudPaused(pausedRef.current);
          if (wasPaused) {
            const t = Date.now();
            if (lastSpawnRef.current) lastSpawnRef.current = t;
            enemiesRef.current.forEach((en) => { en.lastShot = t; });
          }
          lastTapEndRef.current = 0;
        } else {
          lastTapEndRef.current = now;
        }
      },
      onPanResponderTerminate: () => {
        lastTapEndRef.current = 0;
      },
    }),
  ).current;

  if (width <= 0 || height <= 0) return null;

  const player = playerRef.current;
  const visible = !(livesRef.current <= 0 && restartingAtRef.current !== 0);
  const blink = invulnRef.current > 0 && Math.floor(invulnRef.current / 100) % 2 === 0;
  const playerOpacity = !visible ? 0 : blink ? 0.3 : 1;

  return (
    <View
      pointerEvents="box-only"
      style={[StyleSheet.absoluteFill, { width, height }]}
      {...panResponder.panHandlers}
    >
      <Svg width={width} height={height} pointerEvents="none">
        {bulletsRef.current.map((b) => (
          <Rect
            key={`pb-${b.id}`}
            x={b.x - BULLET_W / 2}
            y={b.y}
            width={BULLET_W}
            height={BULLET_H}
            fill={PRIMARY}
            rx={1}
          />
        ))}
        {enemyBulletsRef.current.map((b) => (
          <Rect
            key={`eb-${b.id}`}
            x={b.x - BULLET_W / 2}
            y={b.y}
            width={BULLET_W}
            height={BULLET_H}
            fill={ENEMY_BULLET_COLOR}
            rx={1}
          />
        ))}
        {enemiesRef.current.map((e) => {
          const age = Date.now() - (e.spawnedAt || 0);
          const fade = age >= SPAWN_FADE_IN_MS ? 1 : Math.max(0, age / SPAWN_FADE_IN_MS);
          const cx = e.x;
          const cy = e.y;
          if (e.type === ENEMY_TYPES.COMUM) {
            return (
              <G key={`en-${e.id}`} opacity={fade}>
                <Polygon
                  points={`${cx - 13},${cy - 4} ${cx - 9},${cy - 9} ${cx - 9},${cy + 3}`}
                  fill="#8a1f1f"
                />
                <Polygon
                  points={`${cx + 13},${cy - 4} ${cx + 9},${cy - 9} ${cx + 9},${cy + 3}`}
                  fill="#8a1f1f"
                />
                <Polygon
                  points={`${cx},${cy + 13} ${cx - 9},${cy - 9} ${cx + 9},${cy - 9}`}
                  fill="#E25555"
                />
                <Polygon
                  points={`${cx},${cy + 6} ${cx - 5},${cy - 6} ${cx + 5},${cy - 6}`}
                  fill="#FF8A8A"
                  opacity={0.7}
                />
                <Ellipse cx={cx} cy={cy - 3} rx={3} ry={2.5} fill="#FFE5E5" opacity={0.85} />
              </G>
            );
          }
          if (e.type === ENEMY_TYPES.MEDIO) {
            return (
              <G key={`en-${e.id}`} opacity={fade}>
                <Polygon
                  points={`${cx - 14},${cy - 3} ${cx - 6},${cy - 7} ${cx - 5},${cy + 2} ${cx - 12},${cy + 5}`}
                  fill="#A36b14"
                />
                <Polygon
                  points={`${cx + 14},${cy - 3} ${cx + 6},${cy - 7} ${cx + 5},${cy + 2} ${cx + 12},${cy + 5}`}
                  fill="#A36b14"
                />
                <Polygon
                  points={`${cx},${cy + 14} ${cx - 11},${cy} ${cx},${cy - 12} ${cx + 11},${cy}`}
                  fill="#E89D2C"
                />
                <Polygon
                  points={`${cx},${cy + 7} ${cx - 5},${cy} ${cx},${cy - 6} ${cx + 5},${cy}`}
                  fill="#FFC76A"
                  opacity={0.75}
                />
                <Circle cx={cx} cy={cy - 1} r={3} fill="#FFE6B0" opacity={0.9} />
                <Rect x={cx - 13.5} y={cy - 3.5} width={2} height={2} fill="#FF6B3D" />
                <Rect x={cx + 11.5} y={cy - 3.5} width={2} height={2} fill="#FF6B3D" />
              </G>
            );
          }
          return (
            <G key={`en-${e.id}`} opacity={fade}>
              <Polygon
                points={`${cx - 14},${cy - 1} ${cx - 11},${cy + 4} ${cx - 11},${cy - 5}`}
                fill="#3a0e2c"
              />
              <Polygon
                points={`${cx + 14},${cy - 1} ${cx + 11},${cy + 4} ${cx + 11},${cy - 5}`}
                fill="#3a0e2c"
              />
              <Polygon
                points={`${cx},${cy + 13} ${cx - 12},${cy + 5} ${cx - 12},${cy - 7} ${cx},${cy - 12} ${cx + 12},${cy - 7} ${cx + 12},${cy + 5}`}
                fill="#7E1F60"
              />
              <Polygon
                points={`${cx},${cy + 9} ${cx - 8},${cy + 3} ${cx - 8},${cy - 4} ${cx},${cy - 9} ${cx + 8},${cy - 4} ${cx + 8},${cy + 3}`}
                fill="#A050E8"
              />
              <Circle cx={cx} cy={cy} r={3.5} fill="#FFD0FF" opacity={0.95} />
              <Rect x={cx - 1} y={cy + 5} width={2} height={6} fill="#FF6B3D" opacity={0.8} />
            </G>
          );
        })}
        {particlesRef.current.map((p) => (
          <Rect
            key={`pa-${p.id}`}
            x={p.x - 2}
            y={p.y - 2}
            width={4}
            height={4}
            fill={PRIMARY}
            opacity={Math.max(0, p.life / 0.3)}
          />
        ))}
        {visible && (() => {
          const cx = player.x;
          const cy = player.y;
          const hw = SHIP_SPRITE_W / 2;
          const hh = SHIP_SPRITE_H / 2;
          const flamePulse = 0.7 + 0.3 * Math.sin(Date.now() / 70);
          const flameH = hh * 0.65 * flamePulse;
          const flameTopY = cy + hh * 0.78;
          const flameW = hw * 0.32;
          const flameOuterW = hw * 0.5;
          const flamesOn = !pausedRef.current;
          // ship anchor reference
          const noseY = cy - hh * 0.95;
          const tailY = cy + hh * 0.78;
          const bodyTopY = cy - hh * 0.55;
          const bodyBotY = cy + hh * 0.55;
          const wingY = cy + hh * 0.35;
          const wingTipY = cy + hh * 0.78;
          return (
            <>
              {/* halo */}
              <Ellipse
                cx={cx}
                cy={cy}
                rx={hw * 1.15}
                ry={hh * 0.85}
                fill={PRIMARY}
                opacity={0.12 * playerOpacity}
              />
              {/* engine flames */}
              {flamesOn && (
                <>
                  <Polygon
                    points={`${cx - flameOuterW / 2},${flameTopY} ${cx + flameOuterW / 2},${flameTopY} ${cx},${flameTopY + flameH * 1.2}`}
                    fill="#FF8A1E"
                    opacity={0.55 * playerOpacity}
                  />
                  <Polygon
                    points={`${cx - flameW / 2},${flameTopY} ${cx + flameW / 2},${flameTopY} ${cx},${flameTopY + flameH}`}
                    fill="#FFD24A"
                    opacity={0.95 * playerOpacity}
                  />
                </>
              )}
              {/* back wing shadow (depth) */}
              <Polygon
                points={`${cx - hw},${wingY} ${cx},${wingY - hh * 0.05} ${cx + hw},${wingY} ${cx + hw * 0.5},${wingTipY} ${cx - hw * 0.5},${wingTipY}`}
                fill="#1f3a25"
                opacity={playerOpacity}
              />
              {/* wings (primary accent) */}
              <Polygon
                points={`${cx - hw * 0.92},${wingY + 1} ${cx},${wingY + hh * 0.05} ${cx + hw * 0.92},${wingY + 1} ${cx + hw * 0.42},${wingTipY - 2} ${cx - hw * 0.42},${wingTipY - 2}`}
                fill={PRIMARY}
                opacity={playerOpacity}
              />
              {/* wing tip lights */}
              <Circle cx={cx - hw * 0.85} cy={wingY + 1} r={1.6} fill="#FFFFFF" opacity={playerOpacity} />
              <Circle cx={cx + hw * 0.85} cy={wingY + 1} r={1.6} fill="#FFFFFF" opacity={playerOpacity} />
              {/* main fuselage */}
              <Polygon
                points={`${cx},${noseY} ${cx + hw * 0.32},${bodyTopY} ${cx + hw * 0.32},${bodyBotY} ${cx + hw * 0.18},${tailY} ${cx - hw * 0.18},${tailY} ${cx - hw * 0.32},${bodyBotY} ${cx - hw * 0.32},${bodyTopY}`}
                fill="#F2F2F2"
                opacity={playerOpacity}
              />
              {/* fuselage shadow on left side */}
              <Polygon
                points={`${cx},${noseY} ${cx - hw * 0.32},${bodyTopY} ${cx - hw * 0.32},${bodyBotY} ${cx - hw * 0.18},${tailY} ${cx},${tailY} ${cx},${noseY}`}
                fill="#C8C8C8"
                opacity={playerOpacity}
              />
              {/* center stripe (accent) */}
              <Rect
                x={cx - 1}
                y={cy - hh * 0.4}
                width={2}
                height={hh * 0.85}
                fill={PRIMARY}
                opacity={0.55 * playerOpacity}
              />
              {/* cockpit canopy */}
              <Ellipse
                cx={cx}
                cy={cy - hh * 0.35}
                rx={hw * 0.18}
                ry={hh * 0.18}
                fill="#0a1f12"
                opacity={playerOpacity}
              />
              <Ellipse
                cx={cx - hw * 0.05}
                cy={cy - hh * 0.42}
                rx={hw * 0.08}
                ry={hh * 0.06}
                fill={PRIMARY}
                opacity={0.7 * playerOpacity}
              />
              {/* nose tip highlight */}
              <Polygon
                points={`${cx},${noseY} ${cx - hw * 0.14},${noseY + hh * 0.18} ${cx + hw * 0.14},${noseY + hh * 0.18}`}
                fill={PRIMARY}
                opacity={playerOpacity}
              />
              {/* tail fins */}
              <Polygon
                points={`${cx - hw * 0.32},${bodyBotY} ${cx - hw * 0.5},${tailY} ${cx - hw * 0.18},${tailY}`}
                fill="#9aa8a0"
                opacity={playerOpacity}
              />
              <Polygon
                points={`${cx + hw * 0.32},${bodyBotY} ${cx + hw * 0.5},${tailY} ${cx + hw * 0.18},${tailY}`}
                fill="#9aa8a0"
                opacity={playerOpacity}
              />
            </>
          );
        })()}
      </Svg>

      <View style={styles.hudLeft} pointerEvents="none">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.lifeIcon,
              { backgroundColor: i < hudLives ? PRIMARY : 'transparent', borderColor: PRIMARY },
            ]}
          />
        ))}
      </View>
      <View style={styles.hudRight} pointerEvents="none">
        <Text style={[styles.hudText, { color: PRIMARY }]}>Pontos: {hudScore}</Text>
      </View>
      {hudPaused && (
        <View style={styles.pauseBadge} pointerEvents="none">
          <Text style={[styles.pauseText, { color: PRIMARY, borderColor: PRIMARY }]}>PAUSADO</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hudLeft: {
    position: 'absolute',
    top: 8,
    left: 12,
    flexDirection: 'row',
    gap: 6,
  },
  lifeIcon: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 1.5,
  },
  hudRight: {
    position: 'absolute',
    top: 6,
    right: 12,
  },
  hudText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pauseBadge: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    transform: [{ translateY: -12 }],
  },
  pauseText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 4,
  },
});
