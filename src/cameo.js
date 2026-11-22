// El animal de la temática que, de vez en cuando, cruza el fondo nadando y a
// mitad de camino se para a saludar. Solo es decoración; sin DOM, se prueba
// con `node --test`.

/** Segundos entre una aparición y la siguiente (al azar dentro de este margen). */
export const CAMEO_EVERY = [22, 38];
/** Primera aparición de cada nivel, contada desde que empieza a jugarse. */
export const CAMEO_FIRST = [6, 10];

/**
 * Nueva aparición: cruza la pantalla de un lado al otro (`dir` 1 = hacia la
 * derecha) y saluda durante `waveLen` segundos a partir de `waveStart`.
 * `rand` permite fijarla en los tests.
 */
export function makeCameo(width, height, rand = Math.random) {
  return {
    t: 0,
    dur: 11,
    waveStart: 4.5,
    waveLen: 2,
    dir: rand() < 0.5 ? 1 : -1,
    size: Math.round(width * 0.34),
    y: Math.round(height * (0.3 + rand() * 0.32)),
    width,
  };
}

/**
 * Dónde está el animal en el segundo `t` de su aparición: nada a velocidad
 * constante desde fuera de la pantalla hasta el otro lado y, mientras
 * saluda, se queda quieto. `waveK` (0…1) es cuánto lleva saludando.
 */
export function cameoPose(c, t = c.t) {
  const swim = c.dur - c.waveLen;
  let s;
  let waving = false;
  let waveK = 0;
  if (t < c.waveStart) s = t / swim;
  else if (t < c.waveStart + c.waveLen) {
    s = c.waveStart / swim;
    waving = true;
    waveK = (t - c.waveStart) / c.waveLen;
  } else s = (t - c.waveLen) / swim;
  s = Math.min(1, Math.max(0, s));
  const from = -c.size;
  const to = c.width + c.size;
  const x = c.dir > 0 ? from + (to - from) * s : to - (to - from) * s;
  return { x, waving, waveK, done: t >= c.dur };
}
