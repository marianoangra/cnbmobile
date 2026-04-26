// Utilitários de astronomia para Sky AR
// Pipeline: RA/Dec (J2000) → Alt/Az (horizonte local) → vetor ENU → frame do device → tela

// ─── Constantes ───────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;   // graus → radianos
const RAD = 180 / Math.PI;   // radianos → graus
const TWO_PI = 2 * Math.PI;

// ─── Tempo ────────────────────────────────────────────────────────────────────

/** Data Juliana a partir de um objeto Date JS */
export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Greenwich Mean Sidereal Time em graus [0, 360) */
export function greenwichMeanSiderealTime(date) {
  const jd = julianDate(date);
  const T = (jd - 2451545.0) / 36525.0;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0;
  return ((gmst % 360) + 360) % 360;
}

/** Local Sidereal Time em graus [0, 360) */
export function localSiderealTime(date, lonDeg) {
  return ((greenwichMeanSiderealTime(date) + lonDeg) % 360 + 360) % 360;
}

// ─── Coordenadas esféricas ────────────────────────────────────────────────────

/**
 * Converte RA/Dec para Alt/Az no horizonte local.
 * @param {number} raHours  — Ascensão Reta em horas decimais
 * @param {number} decDeg   — Declinação em graus
 * @param {number} latDeg   — Latitude do observador em graus
 * @param {number} lonDeg   — Longitude do observador em graus
 * @param {Date}   date
 * @returns {{ alt: number, az: number }} — altitude e azimute em graus
 */
export function raDecToAltAz(raHours, decDeg, latDeg, lonDeg, date) {
  const lst = localSiderealTime(date, lonDeg);
  const ha  = ((lst - raHours * 15) % 360 + 360) % 360; // Ângulo Horário em graus

  const haR  = ha  * DEG;
  const decR = decDeg * DEG;
  const latR = latDeg * DEG;

  const sinAlt =
    Math.sin(decR) * Math.sin(latR) +
    Math.cos(decR) * Math.cos(latR) * Math.cos(haR);
  const altR = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const cosAz =
    (Math.sin(decR) - Math.sin(latR) * sinAlt) /
    (Math.cos(latR) * Math.cos(altR));
  const azR = Math.acos(Math.max(-1, Math.min(1, cosAz)));

  const az = Math.sin(haR) > 0 ? 360 - azR * RAD : azR * RAD;
  return { alt: altR * RAD, az };
}

// ─── Vetor ENU ────────────────────────────────────────────────────────────────

/**
 * Alt/Az → vetor unitário no frame ENU (East, North, Up).
 * @returns {{ x: number, y: number, z: number }}  x=East, y=North, z=Up
 */
export function altAzToVector(altDeg, azDeg) {
  const altR = altDeg * DEG;
  const azR  = azDeg  * DEG;
  return {
    x: Math.cos(altR) * Math.sin(azR),  // East
    y: Math.cos(altR) * Math.cos(azR),  // North
    z: Math.sin(altR),                  // Up
  };
}

// ─── Matriz de rotação W3C ────────────────────────────────────────────────────
//
// Convenção W3C: R = Rz(α)·Rx(β)·Ry(γ) mapeia Device → Earth.
//   v_earth = R · v_device
//   v_device = R^T · v_earth    ← isso que precisamos
//
// R^T calculado analiticamente (evita alocação de arrays 3×3 por estrela):
//
//   Row 0: [ cα·cγ − sα·sβ·sγ ,  sα·cγ + cα·sβ·sγ ,  −cβ·sγ ]
//   Row 1: [ −sα·cβ             ,  cα·cβ             ,   sβ   ]
//   Row 2: [ cα·sγ + sα·sβ·cγ  ,  sα·sγ − cα·sβ·cγ ,   cβ·cγ ]
//
// Derivação verificada em três cenários:
//   (α=0, β=π/2, γ=0): câmera apontando Norte → estrela Norte vai para centro da tela ✓
//   (α=0, β=3π/4, γ=0): câmera 45° acima do Norte → estrela a 45° vai para centro ✓
//   estrela no Sul (β=π/2): vd.z > 0 → oculta pela câmera ✓

/**
 * Pré-computa R^T como objeto plano. Chame UMA vez por frame, passe para applyMatrix.
 * @param {number} alpha — DeviceMotion.rotation.alpha (rad)
 * @param {number} beta  — DeviceMotion.rotation.beta  (rad)
 * @param {number} gamma — DeviceMotion.rotation.gamma (rad)
 * @returns objeto com campos a00..a22
 */
export function buildRotationMatrix(alpha, beta, gamma) {
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  const cb = Math.cos(beta),  sb = Math.sin(beta);
  const cg = Math.cos(gamma), sg = Math.sin(gamma);
  return {
    // Row 0 de R^T
    a00: ca * cg - sa * sb * sg,
    a01: sa * cg + ca * sb * sg,
    a02: -cb * sg,
    // Row 1 de R^T
    a10: -sa * cb,
    a11:  ca * cb,
    a12:  sb,
    // Row 2 de R^T
    a20: ca * sg + sa * sb * cg,
    a21: sa * sg - ca * sb * cg,
    a22: cb * cg,
  };
}

/**
 * Aplica uma matriz pré-computada a um vetor ENU.
 * Apenas 9 multiplicações + 6 adições — sem alocação de array.
 * @param {ReturnType<buildRotationMatrix>} m
 * @param {{ x, y, z }} v — vetor ENU
 * @returns {{ x, y, z }} vetor no frame do device
 */
export function applyMatrix(m, v) {
  return {
    x: m.a00 * v.x + m.a01 * v.y + m.a02 * v.z,
    y: m.a10 * v.x + m.a11 * v.y + m.a12 * v.z,
    z: m.a20 * v.x + m.a21 * v.y + m.a22 * v.z,
  };
}

/**
 * Projeta um vetor ENU para coordenadas de tela usando matriz pré-computada.
 * A câmera aponta em −z_device → estrela visível quando vd.z < 0.
 * @param {{ x, y, z }} vENU
 * @param {ReturnType<buildRotationMatrix>} m
 * @param {number} SW, SH — dimensões da tela
 * @param {number} focal  — distância focal em px
 * @returns {{ x: number, y: number } | null}
 */
export function projectWithMatrix(vENU, m, SW, SH, focal) {
  const vd = applyMatrix(m, vENU);
  if (vd.z >= 0) return null;  // atrás da câmera

  const px = SW / 2 + (focal * vd.x) / -vd.z;
  const py = SH / 2 - (focal * vd.y) / -vd.z;

  const margin = 60;
  if (px < -margin || px > SW + margin || py < -margin || py > SH + margin) {
    return null;
  }
  return { x: px, y: py };
}

/**
 * Projeta um vetor ENU para tela (API conveniente — constrói a matriz internamente).
 * Para uso em contextos sem loop de frame. Prefira projectWithMatrix no render loop.
 */
export function projectToScreen(vENU, alpha, beta, gamma, SW, SH, focal) {
  const m = buildRotationMatrix(alpha, beta, gamma);
  const f = focal ?? SW / (2 * Math.tan((65 * DEG) / 2));
  return projectWithMatrix(vENU, m, SW, SH, f);
}

/**
 * Aplica rotação W3C a um vetor ENU (API conveniente para uso fora do loop).
 * Prefira buildRotationMatrix + applyMatrix no render loop.
 */
export function applyRotation(alpha, beta, gamma, vENU) {
  return applyMatrix(buildRotationMatrix(alpha, beta, gamma), vENU);
}

// ─── Cor por índice B-V ───────────────────────────────────────────────────────

/**
 * Converte índice B-V em cor CSS aproximada.
 * B-V < 0    → azul (OB: Rigel, Spica)
 * B-V ~ 0    → branco (A: Sírius, Vega)
 * B-V ~ 0.6  → amarelo (G: Sol, Capella)
 * B-V > 1.5  → laranja-vermelho (M: Betelgeuse, Antares)
 */
export function starBvToColor(bv) {
  if (bv === undefined || bv === null) return '#FFFFFF';
  if (bv < -0.3) return '#9BB0FF';   // azul intenso
  if (bv < 0.0)  return '#AABFFF';   // azul claro
  if (bv < 0.3)  return '#CAD7FF';   // branco-azulado
  if (bv < 0.6)  return '#F8F7FF';   // branco puro
  if (bv < 0.8)  return '#FFF4EA';   // amarelo-branco
  if (bv < 1.0)  return '#FFD2A1';   // amarelo
  if (bv < 1.4)  return '#FFAD5B';   // laranja
  return '#FF7070';                   // laranja-vermelho
}

// ─── Planetas (posições simplificadas) ───────────────────────────────────────
// Elementos keplerianos J2000.0. Precisão: ~1–2°.
// Fonte: Meeus "Astronomical Algorithms" cap. 33.

const J2000 = 2451545.0;

// L1 = longitude média em graus/século (convertida de arcsec/século)
const PLANETS = {
  mercury: { a: 0.387098, e0: 0.205630, e1:  5.59e-10,  i0: 7.00487,  i1: -23.51e-6,  O0:  48.33167, O1:  -446.30e-6, w0:  77.45645, w1:   573.57e-6, L0: 252.25084, L1: 538101628.29 / 3600000 },
  venus:   { a: 0.723332, e0: 0.006773, e1: -1.302e-9,  i0: 3.39471,  i1:  -2.86e-6,  O0:  76.68069, O1:  -996.89e-6, w0: 131.53298, w1:  -108.80e-6, L0: 181.97973, L1: 210664136.06 / 3600000 },
  mars:    { a: 1.523688, e0: 0.093405, e1:  2.516e-9,  i0: 1.84969,  i1: -25.47e-6,  O0:  49.57854, O1: -1020.19e-6, w0: 336.04084, w1:  1560.78e-6, L0: 355.45332, L1:  19141019.90 / 3600000 },
  jupiter: { a: 5.202561, e0: 0.048498, e1:  4.469e-9,  i0: 1.30530,  i1: -19.65e-6,  O0: 100.55615, O1:  1217.17e-6, w0:  14.75385, w1:   839.93e-6, L0:  34.40438, L1:   3034866.28 / 3600000 },
  saturn:  { a: 9.537070, e0: 0.055546, e1: -9.499e-9,  i0: 2.48446,  i1:   6.39e-6,  O0: 113.71504, O1: -1591.05e-6, w0:  92.43194, w1: -1948.89e-6, L0:  49.94432, L1:   1221852.40 / 3600000 },
};

function solveKepler(M, e, tol = 1e-6) {
  let E = M;
  for (let i = 0; i < 50; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

function planetHelioEcl(p, T) {
  const e = p.e0 + p.e1 * T;
  const i = (p.i0 + p.i1 * T) * DEG;                        // inclinação (rad)
  const O = (p.O0 + p.O1 * T) * DEG;                        // longitude do nó asc. (rad)
  const wLongDeg = p.w0 + p.w1 * T;                         // longitude do periélio (graus)
  const wLong = wLongDeg * DEG;                              // (rad)
  const w = wLong - O;                                       // argumento do periélio (rad)

  // Longitude média (graus, depois para rad)
  const LDeg = ((p.L0 + p.L1 * T) % 360 + 360) % 360;
  const L = LDeg * DEG;                                      // (rad)

  // Anomalia média — ambos em radianos (corrige bug de unidade da versão anterior)
  const M = ((L - wLong) % TWO_PI + TWO_PI) % TWO_PI;

  const E  = solveKepler(M, e);
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );
  const r = p.a * (1 - e * Math.cos(E));

  const xOrb = r * Math.cos(nu);
  const yOrb = r * Math.sin(nu);

  const cosO = Math.cos(O), sinO = Math.sin(O);
  const cosW = Math.cos(w), sinW = Math.sin(w);
  const cosI = Math.cos(i), sinI = Math.sin(i);

  return {
    x: (cosO * cosW - sinO * sinW * cosI) * xOrb + (-cosO * sinW - sinO * cosW * cosI) * yOrb,
    y: (sinO * cosW + cosO * sinW * cosI) * xOrb + (-sinO * sinW + cosO * cosW * cosI) * yOrb,
    z: (sinW * sinI) * xOrb + (cosW * sinI) * yOrb,
  };
}

function sunGeoEcl(T) {
  // Posição geocêntrica do Sol (eclíptica)
  const L0 = 280.46646 + 36000.76983 * T;           // graus
  const M  = (357.52911 + 35999.05029 * T) * DEG;   // rad
  const C  =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);                      // graus
  const sunLon = (L0 + C) * DEG;                    // rad
  const R = 1.000001018 * (1 - 0.016708634 * 0.016708634) /
            (1 + 0.016708634 * Math.cos(M + C * DEG));
  return { x: R * Math.cos(sunLon), y: R * Math.sin(sunLon), z: 0 };
}

function eclToEqu(x, y, z, T) {
  const eps = (23.439291111 - 0.013004167 * T) * DEG;
  const ce = Math.cos(eps), se = Math.sin(eps);
  return { x, y: y * ce - z * se, z: y * se + z * ce };
}

function xyzToRaDec(x, y, z) {
  const ra  = ((Math.atan2(y, x) * RAD) % 360 + 360) % 360;
  const dec = Math.asin(z / Math.sqrt(x * x + y * y + z * z)) * RAD;
  return { ra: ra / 15, dec }; // ra em horas
}

function moonPosition(T) {
  // Teoria analítica simplificada (Meeus cap. 47, termos principais)
  const D  = (297.85036 + 445267.111480 * T) * DEG;
  const M  = (357.52772 +  35999.050340 * T) * DEG;
  const Mp = (134.96298 + 477198.867398 * T) * DEG;
  const F  = ( 93.27191 + 483202.017538 * T) * DEG;

  const lon =
    218.3165 + 481267.8813 * T +
    6.289 * Math.sin(Mp) -
    1.274 * Math.sin(Mp - 2 * D) +
    0.658 * Math.sin(2 * D) -
    0.214 * Math.sin(2 * Mp) -
    0.186 * Math.sin(M) -
    0.114 * Math.sin(2 * F);

  const lat =
    5.128 * Math.sin(F) +
    0.281 * Math.sin(Mp + F) -
    0.277 * Math.sin(Mp - F) -
    0.173 * Math.sin(F - 2 * D) -
    0.055 * Math.sin(2 * D + F);

  const eps  = (23.439291111 - 0.013004167 * T) * DEG;
  const lonR = lon * DEG;
  const latR = lat * DEG;

  const x = Math.cos(latR) * Math.cos(lonR);
  const y = Math.cos(latR) * Math.sin(lonR) * Math.cos(eps) - Math.sin(latR) * Math.sin(eps);
  const z = Math.cos(latR) * Math.sin(lonR) * Math.sin(eps) + Math.sin(latR) * Math.cos(eps);
  return xyzToRaDec(x, y, z);
}

/**
 * Calcula posições do Sol, Lua e 5 planetas para um observador.
 * @param {number} latDeg
 * @param {number} lonDeg
 * @param {Date}   date
 * @returns {{ sun, moon, mercury, venus, mars, jupiter, saturn }}
 *   cada um com { alt, az } em graus
 */
export function getPlanetPositions(latDeg, lonDeg, date) {
  const jd = julianDate(date);
  const T  = (jd - J2000) / 36525.0;

  const result = {};

  // Sol
  const sunE = sunGeoEcl(T);
  const sunEq = eclToEqu(sunE.x, sunE.y, sunE.z, T);
  const sunRD = xyzToRaDec(sunEq.x, sunEq.y, sunEq.z);
  result.sun = raDecToAltAz(sunRD.ra, sunRD.dec, latDeg, lonDeg, date);

  // Lua
  const moonRD = moonPosition(T);
  result.moon = raDecToAltAz(moonRD.ra, moonRD.dec, latDeg, lonDeg, date);

  // Planetas — posição heliocêntrica → geocêntrica
  // Terra: heliocêntrica = oposto ao Sol geocêntrico
  const earthH = sunGeoEcl(T);
  const earthPos = { x: -earthH.x, y: -earthH.y, z: -earthH.z };

  for (const [name, params] of Object.entries(PLANETS)) {
    const pH  = planetHelioEcl(params, T);
    const geo = { x: pH.x - earthPos.x, y: pH.y - earthPos.y, z: pH.z - earthPos.z };
    const eq  = eclToEqu(geo.x, geo.y, geo.z, T);
    const rd  = xyzToRaDec(eq.x, eq.y, eq.z);
    result[name] = raDecToAltAz(rd.ra, rd.dec, latDeg, lonDeg, date);
  }

  return result;
}
