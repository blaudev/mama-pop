// Reglas de los gestos del tablero, sin DOM: se prueban con `node --test`.

/** Un toque más corto que esto y casi sin moverse no dispara (ms). */
export const MIN_SHOT_MS = 180;
/** Arrastrar al menos esto (px del tablero) ya cuenta como apuntar a propósito. */
export const MIN_SHOT_MOVE = 14;

/**
 * ¿El gesto que acaba de soltarse es un disparo hecho a propósito? Con el
 * dedo (o lápiz), un toque rápido y quieto no dispara, solo apunta: así no se
 * escapan disparos al rozar la pantalla, por ejemplo mientras se apaga el
 * móvil. Hay que mantener pulsado un momento o arrastrar para apuntar. Con
 * ratón, un clic dispara como siempre.
 */
export function isDeliberateShot({ pointerType, durationMs, movedPx }) {
  if (pointerType === 'mouse') return true;
  return durationMs >= MIN_SHOT_MS || movedPx >= MIN_SHOT_MOVE;
}
