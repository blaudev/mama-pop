// Lanzador giratorio: un aro con la burbuja actual arriba (en el cañón), la
// siguiente a la derecha y el contador de disparos en el centro. Al tocarlo,
// las dos giran por el aro en el sentido de las agujas del reloj y se
// intercambian. Al pasar por encima (hover), el aro crece un poco y las
// burbujas avanzan un pelín, insinuando el giro. Sin DOM: se prueba con
// `node --test`.

export const RING_R = 32;
export const HOVER_GROW = 4; // px que crece el aro con el hover
const HOVER_NUDGE = 0.22; // rad que avanzan las burbujas con el hover (~13°)
export const NEXT_SCALE = 0.78; // la siguiente se ve un poco más pequeña
const TOP = -Math.PI / 2; // sitio de la burbuja actual
const NEXT = 0.3; // sitio de la siguiente: a la derecha, un poco por debajo de la horizontal

const easeOutBack = (t) => {
  const c = 1.4;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

/** Aro cuyo punto más alto es el cañón. `hover` (0…1) lo hace crecer hacia abajo. */
export function launcherLayout(shooter, hover = 0) {
  const r = RING_R + HOVER_GROW * hover;
  return { cx: shooter.x, top: shooter.y, cy: shooter.y + r, r };
}

const ringFor = (L, hover) => launcherLayout({ x: L.cx, y: L.top }, hover);
const onRing = (L, a) => ({ x: L.cx + Math.cos(a) * L.r, y: L.cy + Math.sin(a) * L.r });

/**
 * Dónde dibujar cada burbuja. `k` es el avance del giro: 0 justo tras
 * intercambiarlas (cada una aún en el sitio de la otra), 1 en reposo.
 * La que pasa a ser actual da la vuelta larga y la otra la corta: así giran
 * a la vez en el mismo sentido sin chocar. `hover` (0…1) aplica el empujón.
 */
export function launcherPositions(L, k = 1, hover = 0) {
  const t = Math.min(1, Math.max(0, k));
  const e = t >= 1 ? 1 : t <= 0 ? 0 : easeOutBack(t);
  const nudge = HOVER_NUDGE * hover;
  const curAngle = NEXT + (TOP + 2 * Math.PI - NEXT) * e + nudge;
  const nextAngle = TOP + (NEXT - TOP) * e + nudge;
  L = ringFor(L, hover);
  const mix = Math.min(1, Math.max(0, e));
  return {
    current: { ...onRing(L, curAngle), scale: NEXT_SCALE + (1 - NEXT_SCALE) * mix },
    next: { ...onRing(L, nextAngle), scale: 1 - (1 - NEXT_SCALE) * mix },
  };
}

/** ¿El punto toca el lanzador: el aro (con el contador) o alguna de sus burbujas? */
export function hitsLauncher(L, p, R) {
  const { current, next } = launcherPositions(L, 1);
  return (
    Math.hypot(p.x - L.cx, p.y - L.cy) < L.r + 6 ||
    Math.hypot(p.x - current.x, p.y - current.y) < R + 10 ||
    Math.hypot(p.x - next.x, p.y - next.y) < R * NEXT_SCALE + 12
  );
}

/** Margen alrededor del lanzador donde, arrastrando para apuntar, el tiro se anula. */
export const CANCEL_MARGIN = 26;

/** Mientras se arrastra para apuntar: ¿está el dedo tan cerca del lanzador que, al soltar, no se dispara? */
export function inCancelZone(L, p, R) {
  return Math.hypot(p.x - L.cx, p.y - L.cy) < L.r + R + CANCEL_MARGIN;
}

/** Segundos de pausa entre que se pega una bola y el siguiente disparo (evita dobles toques). */
export const SHOT_COOLDOWN = 0.35;

export function readyToShoot(time, lastLandTime) {
  return time - lastLandTime >= SHOT_COOLDOWN - 1e-9;
}
