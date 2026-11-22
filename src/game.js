import {
  placeBubble,
  isEmpty,
  colorsOnBoard,
  cellCenter,
  rowHeight,
  simulateShot,
  matchPreview,
  colorsToAvoid,
  chooseColor,
  bottomY,
  initialCamera,
  nextCamera,
  ROCKET,
  ROCKET_REACH,
  rocketPath,
  fireRocket,
  addSpecial,
  useSpecial,
  toggleArmed,
  normalizeSpecials,
  MINE,
  RAINBOW,
  SPECIALS,
  mineTargets,
  placeMine,
  rainbowColor,
  placeRainbow,
  earnedSpecials,
  isAnchor,
  anchorDir,
  anchorsTouching,
  anchorBlast,
  rotateAnchors,
  visibleRows,
} from './logic.js';
import { launcherLayout, launcherPositions, hitsLauncher, inCancelZone, readyToShoot } from './launcher.js';
import { BOARD, LEVELS, THEMES, LEVELS_PER_THEME, themeOf, themeProgress, parseMap, starsFor, shotsForStars, normalizeProgress, recordWin } from './levels.js';
import { THEME_ART, animalSvg } from './animals.js';
import { isDeliberateShot } from './input.js';
import { CAMEO_EVERY, CAMEO_FIRST, makeCameo, cameoPose } from './cameo.js';

// ── Configuración ────────────────────────────────────────────────────────
// Todo lo del mapa se calcula en coordenadas del mapa; `state.cam` dice
// cuántos píxeles del mapa quedan por encima de la pantalla.

const { R, width: W, height: H, deathY: DEATH_Y, frontY: FRONT_Y, blockPx: BLOCK_PX } = BOARD;
const SHOOTER = { x: BOARD.shooterX, y: BOARD.shooterY };
const LAUNCHER = launcherLayout(SHOOTER);
const SWAP_TIME = 0.26; // s que dura el giro
const HOVER_SPEED = 7; // la transición del hover tarda ~1/7 s
const SPEED = 1150; // px/s
const ROCKET_SPEED = 820; // px/s: algo más lento que una perla, para que se vea cómo lo rompe todo
const MIN_ANGLE = BOARD.minAngle;
// v3: niveles por temáticas de animales. El progreso anterior no se aprovecha.
const PROGRESS_KEY = 'progress-v3';
const SCROLL_DELAY = 1; // s entre que empiezan a caer las bolas y el mapa baja
const CAM_SPEED = 420; // px/s al bajar el mapa un bloque
const INTRO_HOLD = 1.2; // s mostrando la parte de arriba antes de bajar
const BUBBLE_GAP = 1; // px que se recorta cada burbuja al dibujarla: 2 px de hueco entre vecinas

const COLORS = [
  { base: '#c8102e', light: '#ff6b7d', dark: '#5e0012' }, // rojo granate: más oscuro para no confundirse con el naranja
  { base: '#ff7417', light: '#ffc49a', dark: '#a83c00' }, // naranja intenso
  { base: '#fff23a', light: '#fffbc4', dark: '#b3a600' }, // amarillo limón
  { base: '#4ee59f', light: '#c4ffe3', dark: '#0e9a5c' }, // verde
  { base: '#4fb8ff', light: '#c7e9ff', dark: '#1468b8' }, // azul
  { base: '#b88cff', light: '#e7dbff', dark: '#6a38c9' }, // morado
];

// ── Almacenamiento (puede fallar en modo privado) ────────────────────────

const store = {
  get(k, fallback) {
    try {
      const v = localStorage.getItem(`bubblepop:${k}`);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`bubblepop:${k}`, JSON.stringify(v));
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  },
};

// ── Sonido (sintetizado, sin archivos) ───────────────────────────────────
// Todo suena en una escala pentatónica (do mayor), así cualquier combinación
// de notas encaja. Una reverberación corta hace que no suene seco.

const sfx = (() => {
  let ctx = null;
  let out = null; // salida principal (con compresor)
  let wet = null; // envío a la reverberación
  let noise = null;
  let muted = store.get('muted', false);

  const PENTA = [0, 2, 4, 7, 9];
  /** n-ésima nota de la pentatónica a partir de do5 (523 Hz). */
  const note = (n) => 523.25 * 2 ** ((12 * Math.floor(n / 5) + PENTA[((n % 5) + 5) % 5]) / 12);

  function build() {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(comp).connect(ctx.destination);

    // reverberación: respuesta al impulso hecha con ruido que se apaga
    const len = Math.floor(ctx.sampleRate * 1.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    wet = ctx.createGain();
    wet.gain.value = 0.22;
    wet.connect(conv).connect(out);

    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      build();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  const ready = () => !muted && ctx;

  function env(g, t, vol, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /** Una nota: oscilador con subida/bajada de tono opcional y filtro paso bajo. */
  function voice(freq, { type = 'sine', vol = 0.15, attack = 0.005, decay = 0.15, to, glide = 0.04, delay = 0, lp, reverb = 1 } = {}) {
    if (!ready()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + glide);
    env(g, t, vol, attack, decay);
    let node = o;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      node = node.connect(f);
    }
    node.connect(g);
    g.connect(out);
    if (reverb) {
      const send = ctx.createGain();
      send.gain.value = reverb;
      g.connect(send).connect(wet);
    }
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  /** Campanita de cristal: un parcial grave y otro inarmónico agudo. */
  function bell(freq, { vol = 0.06, delay = 0, decay = 0.7 } = {}) {
    voice(freq, { vol, delay, decay, reverb: 1.4 });
    voice(freq * 2.76, { vol: vol * 0.35, delay, decay: decay * 0.4, reverb: 1.4 });
  }

  /** Ruido filtrado: soplidos y chasquidos. */
  function hiss({ from = 800, to = 2400, dur = 0.12, vol = 0.06, delay = 0, q = 1.2 } = {}) {
    if (!ready()) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    env(g, t, vol, 0.01, dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  return {
    ensure,
    get muted() {
      return muted;
    },
    toggle() {
      muted = !muted;
      store.set('muted', muted);
      return muted;
    },
    /** «Fiu» suave al disparar. */
    shoot: () => {
      hiss({ from: 700, to: 2600, dur: 0.09, vol: 0.05 });
      voice(330, { to: 660, glide: 0.06, vol: 0.06, decay: 0.08, reverb: 0.3 });
    },
    /** Tic-tac de cristal al girar el lanzador. */
    swap: () => {
      voice(note(7), { type: 'triangle', vol: 0.05, decay: 0.05 });
      voice(note(9), { type: 'triangle', vol: 0.05, decay: 0.06, delay: 0.06 });
    },
    /** «Tuk» apagado cuando la bola se pega sin explotar nada. */
    stick: () => {
      voice(260, { to: 150, glide: 0.06, vol: 0.16, decay: 0.09, lp: 900, reverb: 0.4 });
      hiss({ from: 2000, to: 1200, dur: 0.03, vol: 0.03 });
    },
    /**
     * «Blop» de burbuja. Cada explosión de la cadena sube una nota, y la racha
     * (disparos seguidos explotando algo) empieza la escala más arriba.
     */
    pop: (i, delay, streak = 0) => {
      const n = Math.min(i + Math.min(streak, 6) * 2, 16);
      const f = note(n);
      voice(f * 0.5, { to: f, glide: 0.035, vol: 0.15, decay: 0.12, delay, reverb: 0.6 });
      bell(f * 2, { vol: 0.025, delay: delay + 0.01, decay: 0.3 });
    },
    /** Silbido de cohete y campanita cuando sale una bola en palmera. */
    launch: (delay) => {
      voice(380, { to: 1300, glide: 0.25, vol: 0.035, decay: 0.28, delay, reverb: 0.8 });
      bell(note(10 + Math.floor(Math.random() * 5)), { vol: 0.04, delay: delay + 0.12 });
    },
    /** Lluvia de campanitas para las avalanchas. */
    avalanche: () => [10, 12, 14, 15, 17, 19].forEach((n, i) => bell(note(n), { vol: 0.05, delay: 0.15 + i * 0.07 })),
    /**
     * Rugido del cohete mientras vuela: ruido que sube de tono, un zumbido
     * grave que tiembla y algo de reverberación. Devuelve una función para
     * pararlo (y se para solo a los 3 s por si acaso).
     */
    rocket: () => {
      if (!ready()) return () => {};
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(380, t);
      bp.frequency.exponentialRampToValueAtTime(2200, t + 1.2);
      const g = ctx.createGain();
      env(g, t, 0.09, 0.08, 2.9);
      src.connect(bp).connect(g).connect(out);
      const send = ctx.createGain();
      send.gain.value = 0.6;
      g.connect(send).connect(wet);

      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 1.2);
      const lfo = ctx.createOscillator(); // temblor del motor
      lfo.frequency.value = 22;
      const depth = ctx.createGain();
      depth.gain.value = 18;
      lfo.connect(depth).connect(o.frequency);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 520;
      const og = ctx.createGain();
      env(og, t, 0.07, 0.08, 2.9);
      o.connect(lp).connect(og).connect(out);

      const nodes = [src, o, lfo];
      nodes.forEach((n) => {
        n.start(t);
        n.stop(t + 3.1);
      });
      return () => {
        const e = ctx.currentTime;
        for (const gain of [g, og]) {
          gain.gain.cancelScheduledValues(e);
          gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0002), e);
          gain.gain.exponentialRampToValueAtTime(0.0001, e + 0.3);
        }
        nodes.forEach((n) => {
          try {
            n.stop(e + 0.35);
          } catch {
            /* ya parado */
          }
        });
      };
    },
    /**
     * Motor del cohete cargado, de fondo: retumbar grave con traqueteo.
     * Devuelve { set(nivel 0…1), stop() } o null si no hay sonido.
     */
    engine: () => {
      if (!ready()) return null;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      const ng = ctx.createGain();
      ng.gain.value = 0;
      src.connect(lp).connect(ng).connect(out);

      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 48;
      const olp = ctx.createBiquadFilter();
      olp.type = 'lowpass';
      olp.frequency.value = 180;
      const og = ctx.createGain();
      og.gain.value = 0;
      o.connect(olp).connect(og).connect(out);

      const lfo = ctx.createOscillator(); // traqueteo del motor
      lfo.type = 'square';
      lfo.frequency.value = 13;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.015;
      lfo.connect(lfoDepth).connect(ng.gain);

      const nodes = [src, o, lfo];
      nodes.forEach((n) => n.start(t));
      ng.gain.setTargetAtTime(0.05, t, 0.15);
      og.gain.setTargetAtTime(0.05, t, 0.15);
      return {
        set(level) {
          const e = ctx.currentTime;
          ng.gain.setTargetAtTime(0.05 + 0.1 * level, e, 0.05);
          og.gain.setTargetAtTime(0.05 + 0.05 * level, e, 0.05);
          lp.frequency.setTargetAtTime(260 + 1000 * level, e, 0.05);
          o.frequency.setTargetAtTime(48 + 22 * level, e, 0.05);
        },
        stop() {
          const e = ctx.currentTime;
          for (const g of [ng.gain, og.gain]) {
            g.cancelScheduledValues(e);
            g.setTargetAtTime(0, e, 0.08);
          }
          nodes.forEach((n) => {
            try {
              n.stop(e + 0.5);
            } catch {
              /* ya parado */
            }
          });
        },
      };
    },
    /** Explosión de la mina: golpe grave y estruendo que se apaga. */
    boom: () => {
      voice(120, { to: 38, glide: 0.35, vol: 0.32, decay: 0.5, lp: 420, reverb: 1.2 });
      hiss({ from: 1400, to: 140, dur: 0.6, vol: 0.22, q: 0.5 });
    },
    /** Destello de la perla arcoíris al pegarse. */
    sparkle: () => [12, 14, 16, 19].forEach((n, i) => bell(note(n), { vol: 0.045, delay: i * 0.05, decay: 0.5 })),
    /** Un ancla salta: zumbido que sube y baja, como un rayo de arriba abajo. */
    zap: (delay = 0) => {
      voice(220, { type: 'sawtooth', to: 1400, glide: 0.12, vol: 0.06, decay: 0.18, delay, lp: 2400, reverb: 0.8 });
      hiss({ from: 3000, to: 600, dur: 0.25, vol: 0.06, delay });
    },
    /** El animal de la temática saluda: dos campanitas alegres. */
    hello: () => {
      bell(note(9), { vol: 0.035, decay: 0.4 });
      bell(note(12), { vol: 0.035, delay: 0.14, decay: 0.5 });
    },
    /** «Blub» de burbuja que suelta el cohete al volar. */
    blub: () => voice(700 + Math.random() * 900, { to: 1800 + Math.random() * 900, glide: 0.05, vol: 0.025, decay: 0.06, reverb: 0.8 }),
    /** Clic metálico al cargar o descargar una bola especial. */
    arm: (on) => {
      voice(on ? note(5) : note(7), { type: 'triangle', vol: 0.07, decay: 0.07 });
      voice(on ? note(9) : note(4), { type: 'triangle', vol: 0.06, decay: 0.09, delay: 0.07 });
    },
    /** Campanitas al ganar una bola especial. */
    gain: () => [7, 9, 12].forEach((n, i) => bell(note(n), { vol: 0.05, delay: 0.25 + i * 0.08 })),
    /** Soplido grave cuando el mapa baja un bloque. */
    scroll: () => hiss({ from: 300, to: 900, dur: 0.35, vol: 0.04, q: 0.8 }),
    /** Arpegio de campanas y acorde final. */
    win: () => {
      [0, 2, 3, 5, 7, 8, 10].forEach((n, i) => bell(note(n), { vol: 0.07, delay: i * 0.09, decay: 0.9 }));
      [0, 2, 3].forEach((n) => voice(note(n) / 2, { type: 'triangle', vol: 0.05, attack: 0.05, decay: 1.4, delay: 0.7, lp: 1800 }));
    },
    /** Tres notas que bajan, suaves. */
    lose: () =>
      [3, 1, 0].forEach((n, i) =>
        voice(note(n) / 2, { type: 'triangle', vol: 0.08, attack: 0.02, decay: 0.45, delay: i * 0.22, lp: 1400 }),
      ),
  };
})();

// ── Sprites de burbuja pre-renderizados ──────────────────────────────────

const DPR = Math.min(window.devicePixelRatio || 1, 2);

const sprites = COLORS.map(({ base, light, dark }) => {
  const size = Math.ceil((R * 2 + 4) * DPR);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(DPR, DPR);
  const cx = R + 2;
  const r = R - BUBBLE_GAP;
  // perla: cuerpo con degradado, sombra abajo, halo y punto de brillo arriba a la izquierda
  const body = g.createRadialGradient(cx - r * 0.2, cx - r * 0.25, r * 0.05, cx, cx, r);
  body.addColorStop(0, light);
  body.addColorStop(0.5, base);
  body.addColorStop(1, dark);
  g.save();
  g.beginPath();
  g.arc(cx, cx, r, 0, Math.PI * 2);
  g.fillStyle = body;
  g.fill();
  g.clip();
  const shade = g.createLinearGradient(0, cx - r, 0, cx + r);
  shade.addColorStop(0.55, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = shade;
  g.fillRect(0, 0, cx * 2, cx * 2);
  const hx = cx - r * 0.32;
  const hy = cx - r * 0.4;
  const halo = g.createRadialGradient(hx, hy, 0, hx, hy, r * 0.6);
  halo.addColorStop(0, 'rgba(255,255,255,0.8)');
  halo.addColorStop(0.35, 'rgba(255,255,255,0.3)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, cx * 2, cx * 2);
  const rx = cx + r * 0.3;
  const ry = cx + r * 0.5;
  const back = g.createRadialGradient(rx, ry, 0, rx, ry, r * 0.38);
  back.addColorStop(0, 'rgba(255,255,255,0.35)');
  back.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = back;
  g.fillRect(0, 0, cx * 2, cx * 2);
  g.restore();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(hx, hy, r * 0.17, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.3)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx, cx, r - 0.5, 0, Math.PI * 2);
  g.stroke();
  return c;
});

/** '#rrggbb' → 'rgba(r,g,b,a)' */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

// Tonos del ancla para los efectos (explosión, chispas, estela).
const ANCHOR_TONE = { base: '#9fb4c8', light: '#e6f3ff', dark: '#3c4f63' };
const toneOf = (v) => (isAnchor(v) ? ANCHOR_TONE : COLORS[v]);

/** Ancla del mapa: burbuja de metal; la flecha se dibuja encima, girada hacia donde apunta. */
const anchorSprite = (() => {
  const size = Math.ceil((R * 2 + 4) * DPR);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(DPR, DPR);
  const cx = R + 2;
  const r = R - BUBBLE_GAP;
  const body = g.createRadialGradient(cx - r * 0.3, cx - r * 0.35, r * 0.1, cx, cx, r);
  body.addColorStop(0, '#f2f7fb');
  body.addColorStop(0.5, '#9fb4c8');
  body.addColorStop(1, '#3c4f63');
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cx, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#c9953c';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.ellipse(cx - r * 0.45, cx - r * 0.5, r * 0.18, r * 0.1, -0.6, 0, Math.PI * 2);
  g.fill();
  return c;
})();

/** Flecha dorada de un ancla. Justo después de un disparo gira desde la dirección anterior. */
function drawAnchorArrow(ctx, x, y, dir, scale = 1) {
  let a1 = ANCHOR_ANGLES[dir];
  let a0 = ANCHOR_ANGLES[(dir + 7) % 8];
  if (a1 < a0) a1 += Math.PI * 2;
  const k = Math.min(1, (state.time - (state.anchorTurnAt ?? -9)) / ANCHOR_TURN);
  const ease = 1 - (1 - k) ** 3;
  const r = (R - BUBBLE_GAP) * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a0 + (a1 - a0) * ease);
  ctx.fillStyle = '#ffd27a';
  ctx.strokeStyle = '#7a5418';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(r * 0.85, 0);
  ctx.lineTo(r * 0.2, -r * 0.5);
  ctx.lineTo(r * 0.2, -r * 0.2);
  ctx.lineTo(-r * 0.6, -r * 0.2);
  ctx.lineTo(-r * 0.6, r * 0.2);
  ctx.lineTo(r * 0.2, r * 0.2);
  ctx.lineTo(r * 0.2, r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBubble(ctx, x, y, color, scale = 1, alpha = 1) {
  const s = (R + 2) * scale;
  if (isAnchor(color)) {
    // brilla con un pulso suave para que se vea que es especial
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(255,210,122,0.9)';
    ctx.shadowBlur = 6 + 5 * Math.sin(state.time * 4);
    ctx.drawImage(anchorSprite, x - s, y - s, s * 2, s * 2);
    ctx.shadowBlur = 0;
    drawAnchorArrow(ctx, x, y, anchorDir(color), scale);
    ctx.restore();
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprites[color], x - s, y - s, s * 2, s * 2);
  ctx.globalAlpha = 1;
}

// ── DOM ──────────────────────────────────────────────────────────────────

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
canvas.width = W * DPR;
canvas.height = H * DPR;
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

const ui = {
  score: document.getElementById('score'),
  level: document.getElementById('level'),
  shots: document.getElementById('shots'),
  mute: document.getElementById('mute'),
  maps: document.getElementById('maps'),
  // un botón por bola especial, en la fila de iconos bajo el lanzador
  specials: {
    [ROCKET]: { name: 'Cohete', btn: document.getElementById('special-rocket'), count: document.getElementById('rocket-count') },
    [MINE]: { name: 'Mina', btn: document.getElementById('special-mine'), count: document.getElementById('mine-count') },
    [RAINBOW]: { name: 'Perla arcoíris', btn: document.getElementById('special-rainbow'), count: document.getElementById('rainbow-count') },
  },
  overlay: document.getElementById('overlay'),
  title: document.getElementById('overlay-title'),
  text: document.getElementById('overlay-text'),
  help: document.getElementById('overlay-help'),
  levels: document.getElementById('overlay-levels'),
  actions: document.getElementById('overlay-actions'),
  card: document.querySelector('#overlay .card'),
  screen: document.getElementById('overlay-screen'),
};

// ── Estado ───────────────────────────────────────────────────────────────

const state = {
  mode: 'menu', // menu | intro | playing | flying | scrolling | over | cleared
  grid: parseMap(LEVELS[0].map),
  levelIndex: 0,
  score: 0,
  shots: 0, // disparos usados en el mapa actual
  progress: normalizeProgress(store.get(PROGRESS_KEY, null), LEVELS.length),
  current: 0,
  next: 0,
  angle: Math.PI / 2,
  projectile: null,
  effects: [],
  cam: 0, // cámara que se ve ahora (se anima hacia camTarget)
  camTarget: 0, // cámara de juego
  camStart: 0, // cámara al empezar a jugar (para la barra de progreso)
  intro: null, // { t, from, to, duration } durante el recorrido inicial
  shake: 0,
  streak: 0, // disparos seguidos que explotan algo
  history: [], // últimos disparos { color, popped }, para no repetir colores sin sentido
  specials: normalizeSpecials(store.get('specials', null)), // bolas especiales guardadas: { rocket: 2 }; pasan de un mapa a otro
  armed: null, // especial cargada en el cañón (ROCKET) o null
  hover: false, // ratón (o dedo) sobre el lanzador
  hoverK: 0, // transición del hover, de 0 a 1
  aimCache: null,
  time: 0,
};

const rand = (n) => Math.floor(Math.random() * n);

/** Nueva bola: un color del tablero, sin repetir sin sentido (ver colorsToAvoid). */
function pickColor(queue = []) {
  const onBoard = colorsOnBoard(state.grid);
  if (!onBoard.length) return rand(COLORS.length);
  return chooseColor(onBoard, colorsToAvoid(state.history, queue));
}

/**
 * Tras cada disparo: las bolas que esperan tienen que ser de colores que
 * sigan en el tablero, y si se acaban de fallar dos del mismo color, la del
 * cañón no puede ser otra igual. Si hay que cambiar alguna, se ve un «pop».
 */
function ensureColorsValid() {
  const onBoard = colorsOnBoard(state.grid);
  if (!onBoard.length) return;
  const avoid = colorsToAvoid(state.history);
  const canAvoid = onBoard.some((c) => !avoid.includes(c));
  if (!onBoard.includes(state.current) || (canAvoid && avoid.includes(state.current))) {
    state.current = pickColor();
    state.effects.push({ type: 'refill', slot: 'current', t: 0, life: 0.25 });
  }
  if (!onBoard.includes(state.next) || (canAvoid && avoid.includes(state.next))) {
    state.next = pickColor([state.current]);
    state.effects.push({ type: 'refill', slot: 'next', t: 0, life: 0.25 });
  }
}

function startLevel(index) {
  state.levelIndex = index;
  state.grid = parseMap(LEVELS[index].map);
  state.gridVersion = (state.gridVersion || 0) + 1;
  state.score = 0;
  state.shots = 0;
  state.effects = [];
  state.history = [];
  state.streak = 0;
  state.current = pickColor();
  state.next = pickColor([state.current]);
  stopRocketSound();
  state.projectile = null;
  state.aimCache = null;
  state.armed = null; // las guardadas se conservan: pasan de un mapa a otro
  state.cameo = null;
  state.cameoIn = randIn(CAMEO_FIRST);

  state.pendingCam = null;
  state.lastLandAt = -Infinity;
  state.cancelAim = false;

  // Recorrido inicial: se ve el techo del mapa y baja hasta la zona de juego.
  const play = initialCamera(state.grid, R, FRONT_Y, BLOCK_PX);
  state.camTarget = play;
  state.camStart = play;
  state.cam = 0;
  state.intro = { t: 0, from: 0, to: play, duration: Math.min(5, Math.max(1.8, play / 320)) };
  state.mode = play > 0 ? 'intro' : 'playing';
  if (play > 0) {
    state.effects.push({ type: 'banner', text: LEVELS[index].name, t: 0, life: INTRO_HOLD + state.intro.duration });
  }
  hideOverlay();
  updateHud();
}

function finishIntro() {
  if (state.mode !== 'intro') return;
  state.cam = state.camTarget;
  state.intro = null;
  state.effects = state.effects.filter((e) => e.type !== 'banner');
  state.mode = 'playing';
}

const shotsLeft = () => LEVELS[state.levelIndex].shots - state.shots;

function updateHud() {
  ui.score.textContent = state.score;
  ui.level.textContent = `${LEVELS[state.levelIndex].number}/${LEVELS_PER_THEME}`;
  const left = shotsLeft();
  ui.shots.textContent = left;
  ui.shots.classList.toggle('warn', left <= 5);
  updateSpecials();
  ui.mute.textContent = sfx.muted ? '🔇' : '🔊';
  ui.mute.setAttribute('aria-label', sfx.muted ? 'Activar sonido' : 'Silenciar');
}

/** Fila de bolas especiales: contadores, cuáles se pueden usar y cuál está cargada. `gained` hace saltar ese icono. */
function updateSpecials(gained = null) {
  store.set('specials', state.specials);
  for (const kind of SPECIALS) {
    const { name, btn, count } = ui.specials[kind];
    const n = state.specials[kind] ?? 0;
    const armed = state.armed === kind;
    count.textContent = n;
    btn.disabled = n === 0 && !armed;
    btn.setAttribute('aria-pressed', String(armed));
    btn.setAttribute('aria-label', `${name}: ${n === 1 ? 'queda 1' : `quedan ${n}`}${armed ? ', cargada' : ''}`);
    if (gained === kind) {
      btn.classList.remove('gain');
      void btn.offsetWidth; // reinicia la animación
      btn.classList.add('gain');
    }
  }
}

/** Carga en el cañón la especial `kind` (o la descarga si ya estaba cargada). Solo una a la vez. */
function toggleSpecial(kind) {
  if (!['playing', 'flying', 'scrolling'].includes(state.mode)) return;
  const before = state.armed;
  state.armed = toggleArmed(state.armed, state.specials, kind);
  if (state.armed !== before) sfx.arm(state.armed != null);
  updateSpecials();
}

const AWARD_TEXT = { [ROCKET]: '¡Cohete!', [MINE]: '¡Mina!', [RAINBOW]: '¡Perla arcoíris!' };

/** Suma una especial ganada a la fila de iconos, con su aviso. `i` separa los avisos si se ganan varias a la vez. */
function award(kind, i = 0) {
  state.specials = addSpecial(state.specials, kind);
  state.effects.push({ type: 'text', x: W / 2, y: state.cam + H * (0.6 + 0.07 * i), text: AWARD_TEXT[kind], t: 0, life: 1.2, big: true });
  updateSpecials(kind);
  sfx.gain();
}

function stopRocketSound() {
  state.projectile?.stopSound?.();
}

function addScore(n) {
  state.score += n;
  updateHud();
}

// ── Pantallas ────────────────────────────────────────────────────────────

const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function showOverlay({ title, text = '', help = false, levels = false, actions = [] }) {
  ui.card.hidden = false;
  ui.screen.hidden = true;
  ui.overlay.classList.remove('full');
  ui.overlay.style.background = '';
  ui.title.textContent = title;
  ui.text.innerHTML = text;
  ui.text.style.display = text ? '' : 'none';
  ui.help.style.display = help ? '' : 'none';
  ui.levels.style.display = levels ? '' : 'none';
  ui.actions.replaceChildren(
    ...actions.map((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = i === 0 ? 'btn' : 'btn btn-secondary';
      b.textContent = a.label;
      b.addEventListener('click', () => {
        sfx.ensure();
        a.onClick();
      });
      return b;
    }),
  );
  ui.overlay.classList.remove('hidden');
  const first = ui.overlay.querySelector('.level:not(:disabled), .btn');
  setTimeout(() => first?.focus(), 50);
}

function hideOverlay() {
  ui.overlay.classList.add('hidden');
}

// ── Pantallas de temáticas y niveles ─────────────────────────────────────

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const LOCK = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

/** Enseña una pantalla completa (lista de temáticas o camino de niveles) en el overlay. */
function showScreen(html, background) {
  ui.card.hidden = true;
  ui.screen.hidden = false;
  ui.screen.innerHTML = html;
  ui.overlay.classList.add('full');
  ui.overlay.style.background = background;
  ui.overlay.classList.remove('hidden');
  ui.screen.querySelectorAll('[data-action]').forEach((el) =>
    el.addEventListener('click', () => {
      sfx.ensure();
      const { action, arg } = el.dataset;
      if (action === 'theme') showTheme(Number(arg));
      else if (action === 'level') startLevel(Number(arg));
      else if (action === 'themes') showMenu();
      else if (action === 'help') showIntro();
    }),
  );
  setTimeout(() => ui.screen.querySelector('[data-focus], button:not(:disabled)')?.focus(), 50);
}

/** Temática que toca: la primera sin completar que esté abierta. */
function currentTheme() {
  const t = THEMES.findIndex((_, i) => themeProgress(state.progress, i).next != null);
  return t === -1 ? THEMES.length - 1 : t;
}

/** Lista de las temáticas. */
function showMenu() {
  state.mode = 'menu';
  stopRocketSound();
  state.projectile = null;
  const cur = currentTheme();
  const total = THEMES.reduce((n, _, t) => n + themeProgress(state.progress, t).stars, 0);
  const cards = THEMES.map((theme, t) => {
    const tp = themeProgress(state.progress, t);
    const done = tp.best.filter(Boolean).length;
    const state_ = !tp.unlocked ? 'locked' : tp.completed ? 'done' : 'open';
    const label = `${theme.name}: ${!tp.unlocked ? 'bloqueada' : `${done} de ${LEVELS_PER_THEME} niveles, ${tp.stars} estrellas`}`;
    return `<button type="button" class="theme-card ${state_}${t === cur ? ' current' : ''}" data-action="theme" data-arg="${t}"
        ${tp.unlocked ? '' : 'disabled'} aria-label="${esc(label)}" ${t === cur ? 'data-focus' : ''} style="--accent:${theme.accent}; background:${THEME_ART[theme.key].bg}">
      <span class="animal">${animalSvg(theme.key, theme.name)}</span>
      <span class="info">
        <span class="name">${esc(theme.name)}</span>
        <span class="zone">${esc(theme.zone)}</span>
        <span class="bar"><span style="width:${done * 10}%"></span></span>
      </span>
      <span class="side">${tp.unlocked ? `<span class="stars">★ ${tp.stars}/30</span>` : LOCK}</span>
    </button>`;
  }).join('');
  showScreen(
    `<div class="themes">
      <header class="screen-head"><h1>Temáticas</h1><span class="pill">★ ${total}/${THEMES.length * 30}</span></header>
      <div class="theme-list">${cards}</div>
      <button type="button" class="btn btn-secondary help-btn" data-action="help">Cómo se juega</button>
    </div>`,
    'linear-gradient(180deg, rgba(13,93,134,0.92), rgba(4,23,58,0.96))',
  );
}

// Camino de los 10 niveles: posiciones en coordenadas del tablero (378 × 680).
const PATH = Array.from({ length: LEVELS_PER_THEME }, (_, i) => ({
  x: Math.round(200 + 105 * Math.sin(i * 1.1 + 0.3)),
  y: Math.round(560 - i * 33),
}));

/** Camino de niveles de una temática. */
function showTheme(t) {
  state.mode = 'menu';
  stopRocketSound();
  state.projectile = null;
  const theme = THEMES[t];
  const tp = themeProgress(state.progress, t);
  const first = t * LEVELS_PER_THEME;
  const reached = tp.completed ? LEVELS_PER_THEME : tp.next == null ? 0 : tp.next + 1;
  const pts = (n) => PATH.slice(0, n).map((p) => `${p.x},${p.y}`).join(' ');
  const nodes = PATH.map((p, i) => {
    const level = LEVELS[first + i];
    const isDone = tp.best[i] > 0;
    const isNext = tp.next === i;
    const locked = !isDone && !isNext;
    const boss = i === LEVELS_PER_THEME - 1;
    const cls = ['node', isDone && 'done', isNext && 'next', locked && 'locked', boss && 'boss'].filter(Boolean).join(' ');
    const label = `Nivel ${i + 1}: ${level.name}, ${locked ? 'bloqueado' : isDone ? `${tp.best[i]} de 3 estrellas` : 'siguiente'}`;
    return `<div class="${cls}" style="left:${(p.x / W) * 100}%; top:${(p.y / H) * 100}%">
      <button type="button" data-action="level" data-arg="${first + i}" ${locked ? 'disabled' : ''} ${isNext ? 'data-focus' : ''} aria-label="${esc(label)}">${locked ? LOCK : i + 1}</button>
      ${isDone ? `<span class="node-stars">${starText(tp.best[i])}</span>` : ''}
    </div>`;
  }).join('');

  let foot;
  if (tp.completed && t < THEMES.length - 1) {
    foot = `<button type="button" class="btn" data-action="theme" data-arg="${t + 1}">¡Completada! Siguiente: ${esc(THEMES[t + 1].name)} →</button>`;
  } else if (tp.completed) {
    foot = `<button type="button" class="btn" data-action="themes">¡Todas completadas! Ver temáticas</button>`;
  } else if (tp.next != null) {
    const level = LEVELS[first + tp.next];
    foot = `<button type="button" class="btn" data-action="level" data-arg="${first + tp.next}">Jugar nivel ${tp.next + 1} · ${esc(level.name)}</button>`;
  } else {
    foot = `<div class="locked-foot">${LOCK} Completa ${esc(THEMES[t - 1].name)} para desbloquearla</div>`;
  }

  showScreen(
    `<div class="theme-screen" style="--accent:${theme.accent}">
      <header class="screen-head">
        <button type="button" class="icon-btn back" data-action="themes" aria-label="Volver a las temáticas">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <span class="title"><span class="kicker">TEMÁTICA ${t + 1} DE ${THEMES.length}</span><span class="name">${esc(theme.name)}</span></span>
        <span class="pill">★ ${tp.stars}/30</span>
      </header>
      <div class="hero${tp.unlocked ? '' : ' dim'}">${animalSvg(theme.key, theme.name)}</div>
      <span class="zone-chip">${esc(theme.zone)}</span>
      <div class="difficulty" aria-hidden="true"><span>DIFÍCIL</span><span>FÁCIL</span></div>
      <svg class="path" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${pts(LEVELS_PER_THEME)}" class="path-all"/>
        ${reached > 1 ? `<polyline points="${pts(reached)}" class="path-done"/>` : ''}
      </svg>
      ${nodes}
      <div class="theme-foot">${foot}</div>
    </div>`,
    THEME_ART[theme.key].bg,
  );
}



function showIntro() {
  showOverlay({
    title: 'Bubble Pop',
    text:
      '<span class="tagline">En busca del tesoro hundido</span>' +
      'Apunta y dispara. Junta <strong>3 o más</strong> burbujas del mismo color para explotarlas; lo que se quede colgando, cae.' +
      '<br>Los mapas son más grandes que la pantalla: al romperlos, bajan y enseñan lo que hay arriba. Vacíalo antes de quedarte sin disparos; cuantos más te sobren, más estrellas.',
    help: true,
    actions: [{ label: 'Jugar', onClick: showMenu }],
  });
}

// ── Disparo ──────────────────────────────────────────────────────────────

function aimShot() {
  const key = `${state.angle}|${state.cam}`;
  if (state.aimCache?.key === key && state.aimCache.grid === state.gridVersion) return state.aimCache.shot;
  const shot = simulateShot(state.grid, { x: SHOOTER.x, y: SHOOTER.y + state.cam }, state.angle, R, W);
  state.aimCache = { key, grid: state.gridVersion, shot };
  return shot;
}

/**
 * Recorrido del cohete con el ángulo actual. Solo rompe lo que se ve en
 * pantalla (aunque él siga hasta salir por arriba). Lo usan la mira y el
 * disparo, así que la mira nunca miente.
 */
function rocketShot() {
  const key = `${state.angle}|${state.cam}|${state.gridVersion}`;
  if (state.rocketCache?.key === key) return state.rocketCache.shot;
  const start = { x: SHOOTER.x, y: SHOOTER.y + state.cam };
  const path = rocketPath(state.grid, start, state.angle, R, W, state.cam - 3 * R);
  const shot = { ...path, cells: path.cells.filter((c) => cellCenter(state.grid, c.row, c.col, R).y >= state.cam) };
  state.rocketCache = { key, shot };
  return shot;
}

function shootRocket() {
  const used = useSpecial(state.specials, ROCKET);
  if (!used.ok) return;
  state.specials = used.inv;
  state.armed = null;
  const shot = rocketShot();
  const res = fireRocket(state.grid, shot.cells, { visible: inView() });
  state.gridVersion = (state.gridVersion || 0) + 1;

  // Cada burbuja explota cuando el cohete llega a ella; hasta entonces se sigue dibujando.
  const delays = shot.cells.map((c) => c.dist / ROCKET_SPEED);
  const lastHit = delays.at(-1) ?? 0;
  // lo que rompen las anclas que toca el cohete va después de lo que rompe él
  const delayOf = (i) => delays[i] ?? lastHit + 0.1 + (i - delays.length) * 0.02;
  res.popped.forEach((b, i) => {
    const c = cellCenter(state.grid, b.row, b.col, R);
    state.effects.push({ type: 'pop', x: c.x, y: c.y, color: b.color, t: -delayOf(i), life: 0.22 });
    if (i < 12) sfx.pop(i, delayOf(i), 0);
  });
  anchorBeams(res.anchors ?? [], lastHit);
  // Lo que se queda colgando sale en palmera cuando el cohete ha pasado.
  const after = (res.popped.length ? delayOf(res.popped.length - 1) : 0) + 0.05;
  res.dropped.forEach((b, i) => {
    const c = cellCenter(state.grid, b.row, b.col, R);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
    const speed = 560 + Math.random() * 380;
    state.effects.push({
      type: 'fall',
      x: c.x,
      y: c.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      color: b.color,
      t: -(after + Math.min(i * 0.012, 0.35)),
      trail: [],
    });
    if (i < 6) sfx.launch(after + i * 0.04);
  });

  state.projectile = {
    rocket: true,
    angle: state.angle,
    path: shot.points,
    seg: 0,
    along: 0,
    x: shot.points[0].x,
    y: shot.points[0].y,
    trail: [],
    result: res,
    stopSound: sfx.rocket(),
  };
  // El cohete es un premio: no gasta aire ni cambia las perlas que esperan.
  state.mode = 'flying';
  updateHud();
  sfx.shoot();
}

/** El cohete ha salido de la pantalla: puntúa y sigue la partida. */
function finishRocket(p) {
  p.stopSound?.();
  state.projectile = null;
  const { popped, dropped } = p.result;
  if (popped.length) state.streak++; // cuenta para la racha como cualquier disparo que explota algo
  const gained = popped.length * 10 + (dropped.length ? dropped.length * 20 * Math.ceil(dropped.length / 4) : 0);
  if (gained) {
    addScore(gained);
    state.effects.push({ type: 'text', x: W / 2, y: state.cam + H * 0.4, text: `+${gained}`, t: 0, life: 0.9, big: true });
  }
  if (dropped.length >= 4) {
    state.effects.push({ type: 'text', x: W / 2, y: state.cam + H * 0.48, text: '¡Avalancha!', t: 0, life: 1.1, big: true });
    sfx.avalanche();
  }
  settle();
}

function shoot() {
  if (state.mode !== 'playing' || shotsLeft() <= 0) return;
  if (!readyToShoot(state.time, state.lastLandAt)) return; // pausa corta: evita dobles toques
  if (state.armed === ROCKET) {
    shootRocket();
    return;
  }
  const shot = aimShot();
  if (!shot.cell) return;
  // mina o perla arcoíris cargada: vuela como una perla (rebota igual), pero es un premio
  const special = state.armed;
  if (special) {
    const used = useSpecial(state.specials, special);
    if (!used.ok) return;
    state.specials = used.inv;
    state.armed = null;
  }
  const target = cellCenter(state.grid, shot.cell.row, shot.cell.col, R);
  state.projectile = {
    color: special ? null : state.current,
    special,
    path: [...shot.points, target],
    cell: shot.cell,
    seg: 0,
    along: 0,
    x: SHOOTER.x,
    y: SHOOTER.y + state.cam,
  };
  if (!special) {
    // sin tres seguidas del mismo color: la que sale, la que queda en el cañón y la nueva
    const fired = state.current;
    state.current = state.next;
    state.next = pickColor([fired, state.current]);
    state.shots++; // las especiales no gastan aire
  }
  state.mode = 'flying';
  updateHud();
  sfx.shoot();
}

function swap() {
  if (!['playing', 'flying', 'scrolling'].includes(state.mode)) return;
  if (state.armed) {
    toggleSpecial(state.armed); // con una especial cargada, tocar el lanzador la devuelve a la fila
    return;
  }
  [state.current, state.next] = [state.next, state.current];
  state.effects = state.effects.filter((e) => e.type !== 'swap');
  state.effects.push({ type: 'swap', t: 0, life: SWAP_TIME });
  sfx.swap();
}

function advanceProjectile(p, dist) {
  while (dist > 0 && p.seg < p.path.length - 1) {
    const a = p.path[p.seg];
    const b = p.path[p.seg + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const remain = len - p.along;
    if (dist < remain) {
      p.along += dist;
      dist = 0;
    } else {
      dist -= remain;
      p.seg++;
      p.along = 0;
    }
  }
  if (p.seg >= p.path.length - 1) {
    const last = p.path[p.path.length - 1];
    p.x = last.x;
    p.y = last.y;
    return true;
  }
  const a = p.path[p.seg];
  const b = p.path[p.seg + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  p.x = a.x + ((b.x - a.x) * p.along) / len;
  p.y = a.y + ((b.y - a.y) * p.along) / len;
  return false;
}

/** Filas que se ven ahora en pantalla: las anclas solo rompen ahí. */
const inView = () => visibleRows(state.cam, H, R);

// Ángulo (en pantalla) de cada dirección de ancla, en el sentido del reloj desde
// arriba. Las oblicuas siguen la diagonal de la rejilla hexagonal: sube R√3 por
// cada R de lado, 60° respecto a la horizontal.
const ANCHOR_ANGLES = [-90, -60, 0, 60, 90, 120, 180, 240].map((d) => (d * Math.PI) / 180);
const ANCHOR_TURN = 0.3; // s que tarda la flecha en girar tras cada disparo

/** Haz de luz por cada ancla que salta, hacia donde apunta, uno tras otro si van en cadena. */
function anchorBeams(anchors, delay = 0) {
  anchors.forEach(([r, c, dir], i) => {
    const { x, y } = cellCenter(state.grid, r, c, R);
    state.effects.push({ type: 'beam', x, y, angle: ANCHOR_ANGLES[dir], t: -(delay + i * 0.09), life: 0.5 });
    sfx.zap(delay + i * 0.09);
  });
  if (anchors.length) state.shake = Math.max(state.shake, 0.15);
}

function land(p) {
  const { row, col } = p.cell;
  const at = cellCenter(state.grid, row, col, R);
  let res;
  if (p.special === MINE) {
    res = placeMine(state.grid, row, col, { visible: inView() });
    state.effects.push({ type: 'blast', x: at.x, y: at.y, t: 0, life: 0.45 });
    state.shake = Math.max(state.shake, 0.22);
    sfx.boom();
  } else if (p.special === RAINBOW) {
    res = placeRainbow(state.grid, row, col, pickColor(), { visible: inView() });
    sfx.sparkle();
  } else {
    res = placeBubble(state.grid, row, col, p.color, { visible: inView() });
    state.history = [...state.history.slice(-3), { color: p.color, popped: res.popped.length > 0 }];
  }
  state.gridVersion = (state.gridVersion || 0) + 1;
  state.projectile = null;
  anchorBeams(res.anchors ?? []);

  if (res.popped.length) {
    state.streak++;
    // Explosiones en cadena, de la más cercana a la más lejana.
    const ordered = res.popped
      .map((b) => ({ ...b, ...cellCenter(state.grid, b.row, b.col, R) }))
      .sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
    ordered.forEach((b, i) => {
      const delay = i * 0.04;
      state.effects.push({ type: 'pop', x: b.x, y: b.y, color: b.color, t: -delay, life: 0.22 });
      sfx.pop(i, delay, state.streak);
    });
    // Las que se sueltan salen disparadas hacia arriba en abanico, como una
    // palmera de fuegos artificiales, y caen describiendo un arco.
    res.dropped.forEach((b, i) => {
      const c = cellCenter(state.grid, b.row, b.col, R);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7; // ±49° alrededor de la vertical
      const speed = 560 + Math.random() * 380;
      state.effects.push({
        type: 'fall',
        x: c.x,
        y: c.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        color: b.color,
        t: -Math.min(i * 0.012, 0.35), // salen en cadena, no todas a la vez
        trail: [],
      });
      if (i < 6) sfx.launch(i * 0.04);
    });

    const popPts = res.popped.length * 10;
    const dropPts = res.dropped.length ? res.dropped.length * 20 * Math.ceil(res.dropped.length / 4) : 0;
    const gained = popPts + dropPts;
    addScore(gained);
    state.effects.push({ type: 'text', x: at.x, y: at.y, text: `+${gained}`, t: 0, life: 0.9, big: res.dropped.length > 0 });
    if (res.dropped.length >= 4) {
      state.effects.push({ type: 'text', x: W / 2, y: state.cam + H * 0.45, text: '¡Avalancha!', t: 0, life: 1.1, big: true });
      sfx.avalanche();
    } else if (state.streak >= 3) {
      state.effects.push({ type: 'text', x: W / 2, y: state.cam + H * 0.5, text: `¡Racha ×${state.streak}!`, t: 0, life: 0.9, big: true });
    }
    // Premios (solo con perlas normales, para que una especial no dé otra):
    // cohete por racha, mina por grupo grande, perla arcoíris por avalancha.
    if (!p.special) {
      earnedSpecials(state.streak, res.popped.length, res.dropped.length).forEach((kind, i) => award(kind, i));
    }
  } else {
    sfx.stick();
    state.streak = 0;
  }

  settle();
}

/** Tras cada jugada: ¿mapa completado o perdido? Si no, sigue (y quizá baja el mapa). */
function settle() {
  // después de cada disparo, todas las flechas de las anclas giran un paso
  rotateAnchors(state.grid);
  state.gridVersion = (state.gridVersion || 0) + 1;
  state.anchorTurnAt = state.time;
  if (isEmpty(state.grid)) {
    const index = state.levelIndex;
    const budget = LEVELS[index].shots;
    const stars = starsFor(state.shots, budget);
    state.progress = recordWin(state.progress, index, stars, LEVELS.length);
    store.set(PROGRESS_KEY, state.progress);
    state.mode = 'cleared';
    sfx.win();
    const isLast = index === LEVELS.length - 1;
    const t = themeOf(index);
    const endsTheme = LEVELS[index].number === LEVELS_PER_THEME;
    setTimeout(() => {
      if (state.mode !== 'cleared' || state.levelIndex !== index) return; // ya se ha ido a otra pantalla
      showOverlay({
        title: isLast ? '¡Todas las temáticas completadas!' : endsTheme ? `¡${THEMES[t].name} completada!` : '¡Nivel completado!',
        text:
          `<span class="big-stars" aria-label="${stars} de 3 estrellas">${starText(stars)}</span>` +
          `<strong>${state.shots}</strong> ${state.shots === 1 ? 'disparo' : 'disparos'} · <strong>${state.score}</strong> puntos` +
          `<br><span class="muted">3 estrellas con ${shotsForStars(3, budget)} disparos o menos</span>`,
        actions: [
          ...(isLast
            ? []
            : endsTheme
              ? [{ label: `Siguiente: ${THEMES[t + 1].name}`, onClick: () => showTheme(t + 1) }]
              : [{ label: 'Siguiente nivel', onClick: () => startLevel(index + 1) }]),
          { label: 'Repetir', onClick: () => startLevel(index) },
          { label: 'Niveles', onClick: () => showTheme(t) },
        ],
      });
    }, 600);
    return;
  }

  if (checkLose()) return;

  ensureColorsValid();
  // Si se ha liberado al menos un bloque, el mapa baja para enseñar lo de
  // arriba, pero no enseguida: SCROLL_DELAY después de que empiecen a caer
  // las bolas, caigan o no todavía (ver applyPendingCamera).
  const cam = nextCamera(state.pendingCam ?? state.camTarget, state.grid, R, FRONT_Y, BLOCK_PX);
  if (cam !== state.camTarget) {
    if (state.pendingCam == null) state.pendingCamAt = state.time + SCROLL_DELAY;
    state.pendingCam = cam;
  }
  state.lastLandAt = state.time;
  state.mode = 'playing';
}

/** Baja el mapa que quedó pendiente, un momento después de la jugada (sin esperar a que acaben de caer las bolas). */
function applyPendingCamera() {
  if (state.pendingCam == null || state.mode !== 'playing') return;
  if (state.time < state.pendingCamAt) return;
  state.camTarget = state.pendingCam;
  state.pendingCam = null;
  state.mode = 'scrolling';
  sfx.scroll();
}

function checkLose() {
  const crossed = bottomY(state.grid, R) - state.camTarget > DEATH_Y;
  if (!crossed && shotsLeft() > 0) return false;
  state.mode = 'over';
  state.shake = 0.4;
  sfx.lose();
  const index = state.levelIndex;
  const left = state.grid.cells.flat().filter((v) => v != null).length;
  setTimeout(() => {
    if (state.mode !== 'over' || state.levelIndex !== index) return;
    showOverlay({
      title: crossed ? '¡Casi!' : '¡Sin disparos!',
      text: crossed
        ? `Las burbujas han llegado a la línea en <strong>${LEVELS[index].name}</strong>.`
        : `Te has quedado sin disparos en <strong>${LEVELS[index].name}</strong>. Quedaban <strong>${left}</strong> burbujas.`,
      actions: [
        { label: 'Reintentar', onClick: () => startLevel(index) },
        { label: 'Niveles', onClick: () => showTheme(themeOf(index)) },
      ],
    });
  }, 700);
  return true;
}

// ── Bucle ────────────────────────────────────────────────────────────────

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function updateCamera(dt) {
  if (state.mode === 'intro' && state.intro) {
    const it = state.intro;
    it.t += dt;
    const k = Math.min(1, Math.max(0, (it.t - INTRO_HOLD) / it.duration));
    state.cam = it.from + (it.to - it.from) * easeInOut(k);
    if (k >= 1) finishIntro();
    return;
  }
  const d = state.camTarget - state.cam;
  if (d !== 0) {
    const step = Math.max(CAM_SPEED * dt, Math.abs(d) * 5 * dt);
    state.cam = Math.abs(d) <= step ? state.camTarget : state.cam + Math.sign(d) * step;
  }
  if (state.mode === 'scrolling' && state.cam === state.camTarget) state.mode = 'playing';
}

// Motor de fondo mientras el cohete está cargado; sube con sus ganas de despegar.
let engine = null;
function updateEngine() {
  const want = state.armed === ROCKET && ['playing', 'flying', 'scrolling'].includes(state.mode) && !sfx.muted;
  if (want && !engine) engine = sfx.engine();
  if (!want && engine) {
    engine.stop();
    engine = null;
  }
  engine?.set(Math.max(0.6 * rumbleAt(state.time), hopAt(state.time)));
}

function update(dt) {
  state.time += dt;
  updateCameo(dt);
  updateEngine();
  state.shake = Math.max(0, state.shake - dt);
  const hoverTo = state.hover ? 1 : 0;
  state.hoverK += Math.sign(hoverTo - state.hoverK) * Math.min(Math.abs(hoverTo - state.hoverK), HOVER_SPEED * dt);
  applyPendingCamera();
  updateCamera(dt);

  if (state.mode === 'flying' && state.projectile) {
    const p = state.projectile;
    if (p.rocket) {
      p.trail.unshift({ x: p.x, y: p.y });
      if (p.trail.length > 16) p.trail.pop();
      if (Math.random() < dt * 14) sfx.blub();
      if (advanceProjectile(p, ROCKET_SPEED * dt)) finishRocket(p);
    } else if (advanceProjectile(p, SPEED * dt)) land(p);
  }

  for (const e of state.effects) {
    e.t += dt;
    if (e.type === 'fall' && e.t > 0) {
      e.trail.unshift({ x: e.x, y: e.y });
      if (e.trail.length > 7) e.trail.pop();
      e.vy += 1500 * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      // rebota en las paredes para no salirse del tablero
      if (e.x < R || e.x > W - R) {
        e.x = Math.min(W - R, Math.max(R, e.x));
        e.vx *= -0.6;
      }
    }
  }
  state.effects = state.effects.filter((e) =>
    e.type === 'fall' ? e.vy < 0 || e.y - state.cam < H + R * 2 : e.t < e.life,
  );
}

// ── Fondo: escena submarina ──────────────────────────────────────────────
// La parte fija se pinta una vez en un canvas aparte, en las coordenadas del
// diseño (390 × 844), escalada al tablero. Los rayos de luz y las partículas
// se animan en cada fotograma.

const SCENE_W = 390;
const SCENE_H = 844;
const SX = W / SCENE_W;
const SY = H / SCENE_H;

// Cada temática tiene su escena: el agua (más oscura cuanto más profunda), lo
// que hay en el fondo, cuánta luz entra y el color de las partículas.
const SCENES = {
  tortuga: {
    water: ['#3fd0dc', '#1aa5c2', '#0f7aa6', '#0a5683', '#073e66'],
    sun: 0.65,
    rays: 1.2,
    mote: '#e6fdff',
    decor: (d) => {
      // fondo de arena clara con matas de hierba marina, rocas, una estrella y conchas
      d.fill('M0 700 C 80 680, 160 694, 230 688 S 340 676, 390 690 V844 H0Z', '#d9bd7e');
      d.fill('M0 740 C 100 724, 240 738, 390 728 V844 H0Z', '#c4a466');
      for (const x of [30, 62, 300, 342, 366]) {
        for (let k = -2; k <= 2; k++) d.stroke(`M${x} 712 C ${x + k * 4} 690, ${x + k * 8} 676, ${x + k * 6} 650`, '#3f9e5c', 4);
      }
      d.fill('M110 712 C 110 690, 160 688, 166 712 Z', '#9a8c74');
      d.fill('M250 716 C 252 700, 280 698, 284 716 Z', '#8a7c66');
      d.fill('M200 760 l6 -14 l6 14 l14 2 l-11 9 l4 14 l-13 -8 l-13 8 l4 -14 l-11 -9 Z', '#f08a5d');
      d.fill('M80 770 c 0 -10, 16 -10, 16 0 Z', '#f4e2c8');
      d.fill('M320 780 c 0 -9, 14 -9, 14 0 Z', '#f1d9be');
    },
  },
  pulpo: {
    water: ['#1fa2b8', '#13729a', '#1b5288', '#253a76', '#1c2658'],
    sun: 0.5,
    rays: 1,
    mote: '#ffe3dc',
    decor: (d) => {
      // arrecife: siluetas lejanas, roca y corales de colores
      d.fill('M0 600 C 40 560, 70 590, 100 570 C 130 550, 150 590, 190 600 L190 844 L0 844 Z', '#1f4a80', 0.8);
      d.fill('M220 610 C 260 570, 300 600, 330 580 C 360 565, 380 590, 390 600 L390 844 L220 844 Z', '#1f4a80', 0.8);
      d.fill('M0 700 C 60 676, 130 690, 190 700 C 250 710, 320 684, 390 692 V844 H0Z', '#2a2f62');
      const branch = (x, y, color) => {
        d.stroke(`M${x} ${y} L${x} ${y - 40} M${x} ${y - 20} L${x - 16} ${y - 44} M${x} ${y - 28} L${x + 14} ${y - 52} M${x - 16} ${y - 44} L${x - 22} ${y - 58}`, color, 6);
      };
      branch(40, 720, '#ff8a7a');
      branch(350, 716, '#ffb36b');
      branch(130, 730, '#c86bff');
      d.fill('M250 724 C 250 700, 296 700, 296 724 Z', '#e0679a');
      d.stroke('M256 716 C 266 708, 280 708, 290 716 M258 722 C 268 714, 280 714, 288 722', '#b8487a', 2);
      d.fill('M78 760 C 70 730, 96 726, 100 744 C 104 726, 126 732, 118 760 Z', '#ff9e85', 0.9);
    },
  },
  caballito: {
    water: ['#1c9a8e', '#127076', '#0d5460', '#09394a', '#062634'],
    sun: 0.4,
    rays: 0.8,
    mote: '#d9fff2',
    decor: (d) => {
      // pradera de algas: muchas hojas altas que se mecen (pintadas quietas), lejos más oscuras
      d.fill('M0 690 C 100 676, 260 694, 390 684 V844 H0Z', '#0b3b3a');
      const blade = (x, h, lean, color, w) => d.stroke(`M${x} 760 C ${x + lean} ${760 - h * 0.4}, ${x - lean} ${760 - h * 0.7}, ${x + lean * 1.5} ${760 - h}`, color, w);
      for (let i = 0; i < 26; i++) blade(8 + i * 15, 120 + ((i * 37) % 90), ((i * 13) % 11) - 5, '#11594f', 5);
      for (let i = 0; i < 18; i++) blade(4 + i * 22, 70 + ((i * 29) % 70), ((i * 7) % 9) - 4, '#1f8a62', 6);
      d.fill('M0 770 C 120 756, 270 772, 390 762 V844 H0Z', '#082c2c');
    },
  },
  medusa: {
    water: ['#3550a4', '#2b3384', '#211f63', '#170f44', '#0c0828'],
    sun: 0.2,
    rays: 0.45,
    mote: '#b9f2ff',
    decor: (d) => {
      // mar abierto: casi sin fondo, medusas lejanas y brillos
      const jelly = (x, y, s, a) => {
        d.fill(`M${x - 14 * s} ${y} C ${x - 14 * s} ${y - 18 * s}, ${x + 14 * s} ${y - 18 * s}, ${x + 14 * s} ${y} Z`, '#b48cff', a);
        for (const k of [-8, -3, 3, 8]) d.stroke(`M${x + k * s} ${y} C ${x + (k - 3) * s} ${y + 10 * s}, ${x + (k + 3) * s} ${y + 18 * s}, ${x + k * s} ${y + 28 * s}`, '#b48cff', 1.5, a);
      };
      jelly(70, 420, 1, 0.25);
      jelly(320, 360, 0.8, 0.2);
      jelly(260, 560, 1.2, 0.18);
      jelly(110, 620, 0.7, 0.2);
      d.fill('M0 740 C 120 728, 260 744, 390 734 V844 H0Z', '#100a30');
    },
  },
  ballena: {
    water: ['#17406f', '#0d2a52', '#081c3d', '#050f27', '#020713'],
    sun: 0.1,
    rays: 0.3,
    mote: '#9fd8ff',
    decor: (d) => {
      // gran profundidad: el barco hundido, rocas de la fosa y casi nada de luz
      d.fill('M0 520 C 30 470, 60 480, 80 440 C 96 410, 120 430, 130 470 C 140 500, 160 520, 170 560 L 170 844 L 0 844 Z', '#0a2140', 0.9);
      d.g.save();
      d.g.translate(210, 430);
      d.g.rotate((-14 * Math.PI) / 180);
      const hull = '#071a33';
      d.fill('M0 120 C 20 150, 150 160, 210 128 L 220 80 L 30 70 Z', hull);
      d.fill('M150 80 L 210 70 L 226 40 L 200 36 L 196 74 Z', hull);
      d.fill('M88 -120h7v200h-7Z', hull);
      d.fill('M58 -80h70v5h-70Z', hull);
      d.stroke('M92 -118 L 30 74 M 95 -118 L 190 70', hull, 1.5);
      d.g.restore();
      d.fill('M0 690 C 50 664, 110 676, 160 690 C 220 706, 280 680, 330 672 C 360 668, 380 676, 390 682 L 390 844 L 0 844 Z', '#040e22');
      d.fill('M0 760 C 40 740, 70 750, 96 772 L 96 844 L 0 844 Z', '#02081a');
      d.fill('M390 740 C 350 724, 320 740, 300 770 L 300 844 L 390 844 Z', '#02081a');
    },
  },
};

const sceneCache = {};

/** Escena fija de una temática, pintada una vez en un canvas aparte. */
function sceneFor(key) {
  if (sceneCache[key]) return sceneCache[key];
  const look = SCENES[key];
  const c = document.createElement('canvas');
  c.width = Math.round(W * DPR);
  c.height = Math.round(H * DPR);
  const g = c.getContext('2d');
  g.setTransform(SX * DPR, 0, 0, SY * DPR, 0, 0);
  g.lineCap = 'round';
  const d = {
    g,
    fill(path, style, alpha = 1) {
      g.globalAlpha = alpha;
      g.fillStyle = style;
      g.fill(new Path2D(path));
      g.globalAlpha = 1;
    },
    stroke(path, style, width, alpha = 1) {
      g.globalAlpha = alpha;
      g.strokeStyle = style;
      g.lineWidth = width;
      g.stroke(new Path2D(path));
      g.globalAlpha = 1;
    },
  };
  const radial = (x, y, r, stops) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    return gr;
  };

  const water = g.createLinearGradient(0, 0, 0, SCENE_H);
  look.water.forEach((col, i) => water.addColorStop(i / (look.water.length - 1), col));
  g.fillStyle = water;
  g.fillRect(0, 0, SCENE_W, SCENE_H);
  g.fillStyle = radial(195, 0, 330, [[0, `rgba(191,243,255,${look.sun})`], [1, 'rgba(191,243,255,0)']]);
  g.fillRect(0, 0, SCENE_W, 360);
  d.stroke('M0 14 Q 24 6 48 14 T 96 14 T 144 14 T 192 14 T 240 14 T 288 14 T 336 14 T 384 14 T 432 14', '#d8fbff', 2, look.sun * 0.6);

  look.decor(d);

  // resplandor bajo el lanzador y viñeta, iguales en todas
  const glowY = (BOARD.shooterY + 32) / SY;
  g.save();
  g.translate(195, glowY);
  g.scale(1, 44 / 130);
  g.fillStyle = radial(0, 0, 130, [[0, 'rgba(127,231,255,0.4)'], [1, 'rgba(127,231,255,0)']]);
  g.fillRect(-130, -130, 260, 260);
  g.restore();
  g.fillStyle = radial(195, 380, 560, [[0.55, 'rgba(2,12,34,0)'], [1, 'rgba(2,12,34,0.7)']]);
  g.fillRect(0, 0, SCENE_W, SCENE_H);
  sceneCache[key] = c;
  return c;
}

// Rayos de luz (coordenadas del diseño): [x arriba izq., x arriba der., x abajo der., x abajo izq., largo, opacidad]
const RAYS = [
  [70, 120, 40, -30, 640, 1],
  [170, 196, 176, 120, 600, 0.7],
  [250, 300, 380, 300, 620, 0.8],
  [330, 350, 430, 400, 560, 0.5],
];

// Partículas en suspensión: posición fija pseudoaleatoria, suben muy despacio.
const MOTES = Array.from({ length: 34 }, (_, i) => {
  const r = (n) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
  return { x: r(1) * W, y: r(2) * H, size: 0.6 + r(3) * 1.4, alpha: 0.15 + r(4) * 0.45, speed: 3 + r(5) * 6, phase: r(6) * 6.28 };
});

let rayGradient = null;

function drawBackground() {
  const key = THEMES[LEVELS[state.levelIndex].theme].key;
  const look = SCENES[key];
  ctx.drawImage(sceneFor(key), 0, 0, W, H);

  // rayos que respiran (menos cuanto más profunda es la temática)
  ctx.save();
  ctx.scale(SX, SY);
  if (!rayGradient) {
    rayGradient = ctx.createLinearGradient(0, 0, 0, 640);
    rayGradient.addColorStop(0, 'rgba(200,246,255,0.32)');
    rayGradient.addColorStop(1, 'rgba(200,246,255,0)');
  }
  ctx.fillStyle = rayGradient;
  RAYS.forEach(([a, b, c, d, len, alpha], i) => {
    ctx.globalAlpha = Math.min(1, alpha * look.rays * (0.7 + 0.3 * Math.sin(state.time * 0.5 + i * 1.7)));
    ctx.beginPath();
    ctx.moveTo(a, 0);
    ctx.lineTo(b, 0);
    ctx.lineTo(c, len);
    ctx.lineTo(d, len);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();

  drawCameo(key);

  // partículas
  ctx.fillStyle = look.mote;
  for (const m of MOTES) {
    const y = (((m.y - state.time * m.speed) % H) + H) % H;
    const x = m.x + Math.sin(state.time * 0.6 + m.phase) * 4;
    ctx.globalAlpha = m.alpha;
    ctx.beginPath();
    ctx.arc(x, y, m.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── El animal de la temática ─────────────────────────────────────────────
// De vez en cuando cruza el fondo nadando, por detrás de las perlas, y a
// mitad de camino se para a saludar.

const animalImages = {};
function animalImage(key) {
  if (!animalImages[key]) {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" width="400" height="300">${THEME_ART[key].svg}</svg>`,
    )}`;
    animalImages[key] = img;
  }
  return animalImages[key];
}

const randIn = ([a, b]) => a + Math.random() * (b - a);

function updateCameo(dt) {
  if (state.cameo) {
    state.cameo.t += dt;
    if (cameoPose(state.cameo).done) state.cameo = null;
    return;
  }
  if (!['playing', 'flying', 'scrolling'].includes(state.mode)) return;
  state.cameoIn -= dt;
  if (state.cameoIn <= 0) {
    state.cameo = makeCameo(W, H);
    state.cameo.helloPlayed = false;
    state.cameoIn = randIn(CAMEO_EVERY);
  }
}

function drawCameo(key) {
  const c = state.cameo;
  if (!c) return;
  const img = animalImage(key);
  if (!img.complete || !img.naturalWidth) return;
  const pose = cameoPose(c);
  const facing = THEME_ART[key].facing;
  const w = c.size;
  const h = w * 0.75;
  const t = c.t;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.translate(pose.x, c.y + Math.sin(t * 1.6) * 8);
  if (pose.waving) {
    // saluda: se acerca un poco y se balancea
    const wob = Math.sin(pose.waveK * Math.PI * 6) * 0.16;
    ctx.rotate(wob);
    const grow = 1 + 0.12 * Math.sin(pose.waveK * Math.PI);
    ctx.scale(grow, grow);
  } else if (facing === 'left' && c.dir > 0) {
    ctx.scale(-1, 1); // mira hacia donde nada
  } else if (facing === 'up') {
    ctx.rotate((c.dir > 0 ? 1 : -1) * (Math.PI / 2));
  } else if (facing === 'front') {
    // late como si nadara a impulsos
    const k = Math.sin(t * 4);
    ctx.scale(1 + 0.05 * k, 1 - 0.05 * k);
  }
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

}

/** Bocadillo «¡Hola!» del animal cuando saluda: va por delante de las perlas para que se lea. */
function drawCameoHello() {
  const c = state.cameo;
  if (!c) return;
  const pose = cameoPose(c);
  const w = c.size;
  const h = w * 0.75;
  if (pose.waving) {
    if (!c.helloPlayed) {
      c.helloPlayed = true;
      sfx.hello();
    }
    // bocadillo «¡Hola!» y burbujitas que suben
    const a = Math.min(1, pose.waveK * 4, (1 - pose.waveK) * 4);
    const bx = pose.x;
    const by = c.y - h * 0.62;
    ctx.save();
    ctx.globalAlpha = 0.9 * a;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(bx - 34, by - 15, 68, 28, 14);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx - 6, by + 12);
    ctx.lineTo(bx, by + 21);
    ctx.lineTo(bx + 6, by + 12);
    ctx.fill();
    ctx.fillStyle = '#0b3a5e';
    ctx.font = '800 16px "Baloo 2", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('¡Hola!', bx, by);
    ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = '#d6faff';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const k = (pose.waveK * 2 + i / 3) % 1;
      ctx.globalAlpha = 0.7 * (1 - k) * a;
      ctx.beginPath();
      ctx.arc(bx + w * 0.3 + Math.sin(k * 6 + i) * 4, c.y - k * 50, 3 + k * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawDeathLine() {
  const danger = bottomY(state.grid, R) - state.cam > DEATH_Y - 2 * rowHeight(R);
  const pulse = danger ? 0.45 + 0.35 * Math.sin(state.time * 8) : 0.3;
  ctx.strokeStyle = danger ? `rgba(255,80,110,${pulse})` : `rgba(214,250,255,${pulse})`;
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, DEATH_Y);
  ctx.lineTo(W - 16, DEATH_Y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Dibuja solo las filas que caen dentro de la pantalla (coordenadas del mapa). */
function drawGrid() {
  const { grid } = state;
  const rh = rowHeight(R);
  const first = Math.max(0, Math.floor((state.cam - 2 * R) / rh));
  const last = Math.min(grid.rows - 1, Math.ceil((state.cam + H) / rh));
  for (let r = first; r <= last; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const color = grid.cells[r][c];
      if (color == null) continue;
      const p = cellCenter(grid, r, c, R);
      drawBubble(ctx, p.x, p.y, color);
    }
  }
}

/** Barra a la derecha: cuánto mapa queda por bajar. */
function drawProgress() {
  if (state.camStart <= 0) return;
  const top = 14;
  const bottom = DEATH_Y - 14;
  const done = 1 - state.cam / state.camStart;
  const x = W - 7;
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(201,149,60,0.75)';
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(4,24,52,0.85)';
  ctx.stroke();
  ctx.strokeStyle = '#7fe7ff';
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  ctx.lineTo(x, bottom - (bottom - top) * done);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawBanner() {
  const e = state.effects.find((fx) => fx.type === 'banner');
  if (!e) return;
  const fade = Math.min(1, e.t / 0.3, (e.life - e.t) / 0.4);
  ctx.globalAlpha = Math.max(0, fade);
  ctx.fillStyle = 'rgba(4,24,52,0.78)';
  ctx.fillRect(0, H * 0.42 - 42, W, 96);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd27a';
  ctx.font = '500 14px "Baloo 2", system-ui, sans-serif';
  const lv = LEVELS[state.levelIndex];
  ctx.fillText(`${THEMES[lv.theme].name.toUpperCase()} · NIVEL ${lv.number} · ${lv.shots} DISPAROS`, W / 2, H * 0.42 - 12);
  ctx.fillStyle = '#fff';
  ctx.font = '700 34px "Baloo 2", system-ui, sans-serif';
  ctx.fillText(e.text, W / 2, H * 0.42 + 26);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '500 12px "Baloo 2", system-ui, sans-serif';
  ctx.fillText('Toca para saltar', W / 2, H * 0.42 + 46);
  ctx.globalAlpha = 1;
}

/** Mira del cohete: una franja recta y las burbujas que va a romper, parpadeando en naranja. */
function drawRocketAim() {
  const shot = rocketShot();
  const [a, b] = shot.points;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,179,77,0.16)';
  ctx.lineWidth = 2 * R * ROCKET_REACH; // tan ancha como lo que rompe
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = '#ffd27a';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 18]);
  ctx.lineDashOffset = -state.time * 50;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.lineCap = 'butt';

  drawTargetRings(shot.cells);
}

/** Anillos naranjas que parpadean sobre las burbujas que va a romper una especial. */
function drawTargetRings(cells) {
  const pulse = 0.5 + 0.5 * Math.sin(state.time * 9);
  for (const c of cells) {
    const p = cellCenter(state.grid, c.row, c.col, R);
    ctx.save();
    ctx.shadowColor = '#ff8c28';
    ctx.shadowBlur = 8 + 8 * pulse;
    ctx.strokeStyle = `rgba(255,${180 + 40 * pulse},${80 + 60 * pulse},${0.75 + 0.25 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R + 1 + 1.5 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * La guía (puntos, destino y resaltado de colores) solo se ve mientras se
 * apunta: con el dedo pulsado y arrastrando, con el ratón sobre el tablero,
 * o un momento después de apuntar con las flechas del teclado.
 */
const KEY_AIM_SHOW = 1.5; // s que sigue viéndose la guía tras usar las flechas
function isAiming() {
  return aiming || state.mouseAim || state.time - (state.keyAimAt ?? -Infinity) < KEY_AIM_SHOW;
}

function drawAim() {
  if (state.mode !== 'playing' || state.cancelAim || !isAiming()) return;
  if (state.armed === ROCKET) {
    drawRocketAim();
    return;
  }
  const shot = aimShot();
  const pts = shot.points;
  const spacing = 16;
  const maxDots = 60;
  let drawn = 0;
  let d = R + ((state.time * 40) % spacing); // los puntos avanzan poco a poco
  let segStart = 0;
  // haz de luz que sale del lanzador
  {
    const a = pts[0];
    const b = pts[1] || a;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const k = Math.min(1, 260 / len);
    const end = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    const beam = ctx.createLinearGradient(a.x, a.y, end.x, end.y);
    beam.addColorStop(0, 'rgba(191,243,255,0.4)');
    beam.addColorStop(1, 'rgba(191,243,255,0)');
    ctx.strokeStyle = beam;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ctx.fillStyle = '#fff';
  for (let i = 0; i < pts.length - 1 && drawn < maxDots; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    while (d < segStart + len && drawn < maxDots) {
      const t = (d - segStart) / len;
      ctx.globalAlpha = 0.75 * (1 - drawn / maxDots);
      ctx.beginPath();
      ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 2.6, 0, Math.PI * 2);
      ctx.fill();
      drawn++;
      d += spacing;
    }
    segStart += len;
  }
  ctx.globalAlpha = 1;

  // Qué pasaría: con una perla (o la arcoíris, con el color que tomaría), el grupo al
  // que se uniría brilla con un pulso; con la mina, lo que va a romper.
  let ghost = state.current;
  if (shot.cell) {
    const { row, col } = shot.cell;
    const key = `${row},${col},${state.current},${state.armed},${state.gridVersion}`;
    if (state.previewCache?.key !== key) {
      if (state.armed === MINE) {
        state.previewCache = { key, targets: mineTargets(state.grid, row, col) };
      } else {
        const color = state.armed === RAINBOW ? rainbowColor(state.grid, row, col) : state.current;
        const preview = color == null ? { cells: [], pops: false } : matchPreview(state.grid, row, col, color);
        const touched = anchorsTouching(state.grid, row, col);
        const anchorTargets = touched.length ? anchorBlast(state.grid, touched, inView()).cells : null;
        state.previewCache = { key, color, anchorTargets, ...preview };
      }
    }
    const pc = state.previewCache;
    if (pc.targets) drawTargetRings(pc.targets.map(([r, c]) => ({ row: r, col: c })));
    else drawMatchHighlight(pc, pc.color);
    if (pc.anchorTargets) drawTargetRings(pc.anchorTargets.map(([r, c]) => ({ row: r, col: c })));
    if (state.armed === RAINBOW) ghost = pc.color;
  }

  // fantasma donde se quedará la burbuja
  if (shot.cell) {
    const p = cellCenter(state.grid, shot.cell.row, shot.cell.col, R);
    ctx.strokeStyle = state.armed === MINE ? '#ff8c5a' : ghost == null ? '#ffffff' : COLORS[ghost].base;
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(state.time * 6);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, R - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
}

function drawMatchHighlight({ cells, pops }, colorIndex = state.current) {
  if (!cells.length) return;
  const pulse = 0.5 + 0.5 * Math.sin(state.time * (pops ? 9 : 6));
  const color = COLORS[colorIndex];
  for (const [r, c] of cells) {
    const p = cellCenter(state.grid, r, c, R);
    ctx.save();
    ctx.shadowColor = pops ? '#fff' : color.light;
    ctx.shadowBlur = (pops ? 16 : 9) * (0.5 + pulse);
    drawBubble(ctx, p.x, p.y, colorIndex, 1 + (pops ? 0.08 : 0.04) * pulse);
    ctx.restore();
    ctx.strokeStyle = pops ? `rgba(255,255,255,${0.55 + 0.45 * pulse})` : color.light;
    ctx.globalAlpha = pops ? 1 : 0.35 + 0.4 * pulse;
    ctx.lineWidth = pops ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R + 1 + 2 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ── Mina y perla arcoíris ────────────────────────────────────────────────

function drawMine(x, y, scale = 1) {
  const r = (R - BUBBLE_GAP) * scale * 0.8;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(state.time * 2) * 0.15); // se mece en el agua
  ctx.strokeStyle = '#c9953c';
  ctx.lineWidth = 3.2 * scale;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    ctx.lineTo(Math.cos(a) * r * 1.28, Math.sin(a) * r * 1.28);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#4a6a8c');
  g.addColorStop(1, '#13243a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0b1a2c';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.15);
  ctx.lineTo(r, r * 0.15);
  ctx.stroke();
  // luz roja que parpadea
  const blink = 0.3 + 0.7 * Math.max(0, Math.sin(state.time * 6));
  ctx.shadowColor = '#ff4a4a';
  ctx.shadowBlur = 8 * blink;
  ctx.fillStyle = `rgba(255,74,74,${blink})`;
  ctx.beginPath();
  ctx.arc(0, -r * 0.35, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRainbow(x, y, scale = 1) {
  const r = (R - BUBBLE_GAP) * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = 8 + 6 * Math.sin(state.time * 4);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  if (ctx.createConicGradient) {
    // los colores giran
    const g = ctx.createConicGradient(state.time * 2, 0, 0);
    COLORS.forEach((c, i) => g.addColorStop(i / COLORS.length, c.base));
    g.addColorStop(1, COLORS[0].base);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = COLORS[Math.floor(state.time * 4) % COLORS.length].base;
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  const hx = -r * 0.32;
  const hy = -r * 0.4;
  const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.6);
  halo.addColorStop(0, 'rgba(255,255,255,0.85)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(hx, hy, r * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Mina o perla arcoíris, en el cañón o volando. */
function drawSpecialBall(kind, x, y, scale = 1) {
  if (kind === MINE) drawMine(x, y, scale);
  else if (kind === RAINBOW) drawRainbow(x, y, scale);
}

// ── Cohete ───────────────────────────────────────────────────────────────
// Se dibuja en coordenadas de 40 × 60 (morro arriba) con el centro en (20, 30).

const RK = {
  finL: new Path2D('M9 34 L2 50 L10 47 Z'),
  finR: new Path2D('M31 34 L38 50 L30 47 Z'),
  body: new Path2D('M20 2 C 30 12, 32 26, 31 46 L 9 46 C 8 26, 10 12, 20 2 Z'),
  nose: new Path2D('M20 2 C 25.5 7.5, 28.3 13, 29.4 18 L 10.6 18 C 11.7 13, 14.5 7.5, 20 2 Z'),
  shine: new Path2D('M14 8 C 13 14, 12.5 24, 13 40'),
  keel: new Path2D('M18 40 h4 v12 h-4 Z'),
  nozzle: new Path2D('M13 46 h14 l-2 5 h-10 Z'),
  flame: new Path2D('M1 0 C 1 12, 9 26, 9 34 C 9 26, 17 12, 17 0 Z'),
  core: new Path2D('M5 0 C 5 8, 9 16, 9 22 C 9 16, 13 8, 13 0 Z'),
};
const HOP_PERIOD = 2.6; // s entre «intentos de despegar»

/** Ganas de despegar (0…1): sube justo antes de cada saltito y se mantiene durante él. */
function rumbleAt(t) {
  const k = (t % HOP_PERIOD) / HOP_PERIOD;
  if (k < 0.4) return 0;
  if (k < 0.62) return (k - 0.4) / 0.22;
  if (k < 0.84) return 1;
  if (k < 0.95) return 1 - (k - 0.84) / 0.11;
  return 0;
}

/** Altura del saltito (0…1) en el instante t: quieto, salto, rebote pequeño. */
function hopAt(t) {
  const k = (t % HOP_PERIOD) / HOP_PERIOD;
  if (k < 0.62) return 0;
  if (k < 0.78) return Math.sin(((k - 0.62) / 0.16) * Math.PI);
  if (k < 0.9) return 0.45 * Math.sin(((k - 0.78) / 0.12) * Math.PI);
  return 0;
}

/**
 * mode: 'idle' en el cañón (tiembla, da saltitos y la llama se dispara, como
 * si quisiera despegar), 'calm' esperando como siguiente, 'flight' volando.
 */
function drawRocket(x, y, rot, scale, mode) {
  const t = state.time;
  const k = (scale * R * 3) / 60;
  let ox = 0;
  let oy = 0;
  let wobble = 0;
  let flame;
  let boost = 0;
  if (mode === 'idle') {
    // tembleque: varias frecuencias mezcladas para que no parezca un vaivén regular,
    // y más fuerte cuanto más ganas tiene de despegar
    const hop = hopAt(t);
    const shake = 1 + 1.4 * rumbleAt(t) + 1.2 * hop;
    ox = (Math.sin(t * 57) + 0.6 * Math.sin(t * 91 + 1.3)) * 1.1 * shake;
    oy = (Math.cos(t * 43) + 0.5 * Math.sin(t * 77)) * 0.8 * shake - hop * 9;
    wobble = (Math.sin(t * 38) * 0.045 + Math.sin(t * 67 + 0.7) * 0.03) * shake;
    boost = Math.max(hop, 0.5 * rumbleAt(t));
    flame = 0.55 + 0.18 * Math.sin(t * 45) + 0.1 * Math.sin(t * 71) + 0.35 * rumbleAt(t) + hop * 1.1;
  } else if (mode === 'calm') {
    oy = Math.sin(t * 2.4) * 1.5;
    flame = 0.35 + 0.08 * Math.sin(t * 40);
  } else {
    flame = 1.5 + 0.25 * Math.sin(t * 50);
    boost = 1;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  // halo naranja que late
  if (mode !== 'calm') {
    const gr = R * 2.2 * scale;
    const g = ctx.createRadialGradient(0, 4 * k, 0, 0, 4 * k, gr);
    g.addColorStop(0, `rgba(255,190,90,${0.35 + 0.2 * Math.sin(t * 4.8) + 0.25 * boost})`);
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 4 * k, gr, 0, Math.PI * 2);
    ctx.fill();
  }

  // burbujas que salen del escape
  if (mode !== 'flight') {
    ctx.strokeStyle = '#d6faff';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const ph = (t * (mode === 'idle' ? 1.1 : 0.6) + i / 4) % 1;
      const side = i % 2 ? 1 : -1;
      ctx.globalAlpha = (1 - ph) * 0.8;
      ctx.beginPath();
      ctx.arc(side * (3 + i * 3) * ph * scale, 21 * k + ph * 28 * scale, (1.5 + ph * 2.5) * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.translate(ox, oy);
  ctx.rotate(wobble);
  ctx.scale(k, k);
  ctx.translate(-20, -30);

  // llama
  ctx.save();
  ctx.translate(11, 50);
  ctx.scale(1, flame);
  ctx.fillStyle = '#ff8a1f';
  ctx.fill(RK.flame);
  ctx.fillStyle = '#ffe27a';
  ctx.fill(RK.core);
  ctx.restore();

  ctx.lineJoin = 'round';
  ctx.fillStyle = '#e5484d';
  ctx.strokeStyle = '#7a1f24';
  ctx.lineWidth = 1.2;
  ctx.fill(RK.finL);
  ctx.stroke(RK.finL);
  ctx.fill(RK.finR);
  ctx.stroke(RK.finR);
  ctx.fillStyle = '#f4ecdf';
  ctx.strokeStyle = '#7a5418';
  ctx.lineWidth = 1.5;
  ctx.fill(RK.body);
  ctx.stroke(RK.body);
  ctx.fillStyle = '#e5484d';
  ctx.fill(RK.nose);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke(RK.shine);
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#2a8fc4';
  ctx.strokeStyle = '#c9953c';
  ctx.beginPath();
  ctx.arc(20, 28, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d6f3ff';
  ctx.beginPath();
  ctx.arc(18.3, 26.3, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9953c';
  ctx.fillRect(9.2, 39, 21.6, 3.5);
  ctx.fillStyle = '#b8343a';
  ctx.fill(RK.keel);
  ctx.fillStyle = '#5a6470';
  ctx.fill(RK.nozzle);
  ctx.restore();
}

/** El cohete en vuelo, con su estela de burbujas. */
function drawRocketFlight(p) {
  ctx.strokeStyle = '#d6faff';
  ctx.lineWidth = 1.5;
  p.trail.forEach((q, i) => {
    if (i % 2) return;
    const k = 1 - i / p.trail.length;
    ctx.globalAlpha = 0.7 * k;
    ctx.beginPath();
    ctx.arc(q.x + Math.sin(i * 1.7) * 5, q.y + 10, 2 + (1 - k) * 4, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  drawRocket(p.x, p.y, -p.angle + Math.PI / 2, 1, 'flight');
}

/** Arrastrando hasta el lanzador: el aro se pone rojo con una ✕ y un aviso. */
function drawCancelHint() {
  if (!state.cancelAim || state.mode !== 'playing') return;
  const L = LAUNCHER;
  const pulse = 0.6 + 0.4 * Math.sin(state.time * 10);
  ctx.save();
  ctx.strokeStyle = `rgba(255,90,110,${pulse})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(L.cx, L.cy, L.r + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineCap = 'round';
  const k = 9;
  ctx.beginPath();
  ctx.moveTo(L.cx - k, L.top - 34 - k);
  ctx.lineTo(L.cx + k, L.top - 34 + k);
  ctx.moveTo(L.cx + k, L.top - 34 - k);
  ctx.lineTo(L.cx - k, L.top - 34 + k);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(20,12,50,0.7)';
  ctx.lineWidth = 4;
  ctx.textAlign = 'center';
  ctx.font = '700 15px Fredoka, system-ui, sans-serif';
  ctx.strokeText('Suelta para anular', L.cx, L.top - 56);
  ctx.fillText('Suelta para anular', L.cx, L.top - 56);
  ctx.restore();
}

function drawShooter() {
  const { x, y } = SHOOTER;
  const h = state.hoverK < 1 ? easeOut(state.hoverK) : 1;
  const L = launcherLayout(SHOOTER, h);

  // anillo de luz: siempre brilla un poco, y más con el hover
  ctx.save();
  ctx.shadowColor = 'rgba(150,235,255,0.9)';
  ctx.shadowBlur = 10 + 8 * h;
  ctx.fillStyle = `rgba(150,235,255,${0.08 + 0.06 * h})`;
  ctx.beginPath();
  ctx.arc(L.cx, L.cy, L.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(255,255,255,${0.85 + 0.15 * h})`;
  ctx.stroke();
  // dos lucecitas sobre el anillo
  ctx.fillStyle = '#fff';
  for (const a of [-2.4, 1.95]) {
    ctx.beginPath();
    ctx.arc(L.cx + Math.cos(a) * L.r, L.cy + Math.sin(a) * L.r, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(191,243,255,${0.15 + 0.2 * h})`;
  ctx.beginPath();
  ctx.arc(L.cx, L.cy, L.r + 6, 0, Math.PI * 2);
  ctx.stroke();

  // disparos que quedan, en el centro del aro
  const left = shotsLeft();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${left >= 100 ? 20 : 24}px "Baloo 2", system-ui, sans-serif`;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(4,24,52,0.6)';
  ctx.strokeText(String(left), L.cx, L.cy + 2);
  ctx.fillStyle = left <= 5 ? '#ff6b85' : '#fff';
  ctx.fillText(String(left), L.cx, L.cy + 2);
  ctx.textBaseline = 'alphabetic';

  // cañón
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-state.angle + Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(-7, -R - 6);
  ctx.lineTo(0, -R - 20);
  ctx.lineTo(7, -R - 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (['playing', 'flying', 'scrolling', 'intro'].includes(state.mode)) {
    const swapFx = state.effects.find((e) => e.type === 'swap');
    const { current, next } = launcherPositions(LAUNCHER, swapFx ? swapFx.t / swapFx.life : 1, h);
    // la siguiente debajo, para que la actual quede siempre por encima
    const refill = (slot) => {
      const fx = state.effects.find((e) => e.type === 'refill' && e.slot === slot);
      return fx ? 0.3 + 0.7 * easeOut(fx.t / fx.life) : 1;
    };
    drawBubble(ctx, next.x, next.y, state.next, next.scale * (1 + 0.06 * h) * refill('next'));
    // con el cohete cargado, ocupa el sitio de la perla actual y apunta hacia donde se dispara
    if (state.armed === ROCKET) drawRocket(current.x, current.y - 4, -state.angle + Math.PI / 2, current.scale, 'idle');
    else if (state.armed) drawSpecialBall(state.armed, current.x, current.y, current.scale);
    else drawBubble(ctx, current.x, current.y, state.current, current.scale * refill('current'));
  }
}

const easeOut = (t) => 1 - (1 - t) ** 3;

function drawEffects() {
  for (const e of state.effects) {
    if (e.type === 'pop') {
      if (e.t < 0) {
        drawBubble(ctx, e.x, e.y, e.color); // aún esperando su turno en la cadena
        continue;
      }
      const k = e.t / e.life;
      drawBubble(ctx, e.x, e.y, e.color, 1 + k * 0.5, 1 - k);
      ctx.strokeStyle = toneOf(e.color).light;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 3 * (1 - k);
      ctx.beginPath();
      ctx.arc(e.x, e.y, R * (1 + k * 1.2), 0, Math.PI * 2);
      ctx.stroke();
      // chispas
      ctx.fillStyle = toneOf(e.color).base;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + e.x;
        const d = R * (0.8 + k * 1.8);
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 3 * (1 - k), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (e.type === 'fall') {
      if (e.t < 0) {
        drawBubble(ctx, e.x, e.y, e.color); // aún esperando su turno en la cadena
        continue;
      }
      // estela de chispas del color de la burbuja
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      e.trail.forEach((p, i) => {
        const k = 1 - i / e.trail.length;
        ctx.fillStyle = hexA(toneOf(e.color).light, 0.45 * k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, R * 0.55 * k, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      // se encoge un poco mientras cae
      const scale = e.vy > 0 ? Math.max(0.7, 1 - e.vy / 3000) : 1;
      drawBubble(ctx, e.x, e.y, e.color, scale);
    } else if (e.type === 'beam') {
      // rayo del ancla: sale de ella hacia donde apuntaba, hasta salir de la pantalla
      if (e.t < 0) continue;
      const k = e.t / e.life;
      const len = H + W;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      const g = ctx.createLinearGradient(0, -R * 1.4, 0, R * 1.4);
      g.addColorStop(0, 'rgba(255,230,160,0)');
      g.addColorStop(0.5, `rgba(255,240,200,${0.85 * (1 - k)})`);
      g.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, -R * 1.4, len, R * 2.8);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
      ctx.fillRect(0, -1.5, len, 3);
      ctx.restore();
    } else if (e.type === 'blast') {
      // onda expansiva de la mina: destello y anillo que se abre
      const k = e.t / e.life;
      const flash = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, R * 5);
      flash.addColorStop(0, `rgba(255,230,170,${0.7 * (1 - k)})`);
      flash.addColorStop(1, 'rgba(255,160,80,0)');
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(e.x, e.y, R * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,210,140,${1 - k})`;
      ctx.lineWidth = 6 * (1 - k);
      ctx.beginPath();
      ctx.arc(e.x, e.y, R * (1 + k * 4.5), 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.type === 'text') {
      const k = e.t / e.life;
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(4,24,52,0.8)';
      ctx.lineWidth = 4;
      ctx.font = `700 ${e.big ? 30 : 20}px "Baloo 2", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const y = e.y - k * 40;
      ctx.strokeText(e.text, e.x, y);
      ctx.fillText(e.text, e.x, y);
      ctx.globalAlpha = 1;
    }
  }
}

function render() {
  ctx.save();
  if (state.shake > 0) {
    const m = state.shake * 14;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  drawBackground();

  // Capa del mapa: se desplaza con la cámara.
  ctx.save();
  ctx.translate(0, -state.cam);
  drawGrid();
  drawAim();
  drawEffects();
  if (state.projectile?.rocket) drawRocketFlight(state.projectile);
  else if (state.projectile?.special) drawSpecialBall(state.projectile.special, state.projectile.x, state.projectile.y);
  else if (state.projectile) drawBubble(ctx, state.projectile.x, state.projectile.y, state.projectile.color);
  ctx.restore();

  // Capa fija de la pantalla.
  drawCameoHello();
  drawDeathLine();
  drawProgress();
  drawShooter();
  drawCancelHint();
  drawBanner();
  ctx.restore();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

// ── Controles ────────────────────────────────────────────────────────────

function toBoard(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  };
}

function aimAt(p) {
  let a = Math.atan2(SHOOTER.y - p.y, p.x - SHOOTER.x);
  if (a < 0) a = p.x < SHOOTER.x ? Math.PI - MIN_ANGLE : MIN_ANGLE; // por debajo del cañón
  state.angle = Math.min(Math.PI - MIN_ANGLE, Math.max(MIN_ANGLE, a));
}

// Tocar el lanzador (pulsar y soltar sobre él) gira las burbujas; en
// cualquier otro sitio se apunta y, al soltar, se dispara.
//
// Para anular un tiro mientras se apunta, basta con volver con el dedo al
// lanzador y soltar ahí. Y si hay dos dedos en la pantalla a la vez (un toque
// sin querer), ese gesto no dispara.
const onLauncher = (p) => hitsLauncher(LAUNCHER, p, R);
const TAP_MAX_MS = 400; // más que esto es una pulsación larga y no cambia la bola
let downOnLauncher = false;
let downAt = 0;
let downPos = null; // dónde empezó el gesto, para saber cuánto se ha arrastrado
let movedPx = 0; // lo más lejos que se ha ido el dedo desde downPos (px del tablero)
let aiming = false; // pulsado fuera del lanzador: arrastrando para apuntar
const pointers = new Set(); // dedos (o botones) pulsados ahora mismo
let multiTouch = false; // en este gesto ha habido dos dedos o más

function setHover(on) {
  state.hover = on;
  canvas.style.cursor = on ? 'pointer' : '';
}

canvas.addEventListener('pointermove', (e) => {
  const p = toBoard(e);
  const over = onLauncher(p);
  // con ratón, el hover sigue al cursor; con el dedo, solo mientras se pulsa sobre el lanzador
  if (e.pointerType === 'mouse') {
    setHover(over && !aiming);
    state.mouseAim = !over; // con ratón, la guía se ve mientras el cursor está sobre el tablero
  }
  else if (downOnLauncher && !over) setHover(false);
  if (multiTouch) return;
  if (downPos) movedPx = Math.max(movedPx, Math.hypot(p.x - downPos.x, p.y - downPos.y));
  if (aiming) {
    // arrastrando: cerca del lanzador se anula; lejos, se apunta
    state.cancelAim = inCancelZone(LAUNCHER, p, R);
    if (!state.cancelAim) aimAt(p);
  } else if (!over) {
    aimAt(p);
  }
});

canvas.addEventListener('pointerleave', () => {
  setHover(false);
  state.mouseAim = false;
});

canvas.addEventListener('pointerdown', (e) => {
  sfx.ensure();
  if (e.button === 2) return;
  pointers.add(e.pointerId);
  if (pointers.size > 1) {
    // segundo dedo: se anula todo el gesto, no se dispara ni se cambia de bola
    multiTouch = true;
    aiming = false;
    downOnLauncher = false;
    state.cancelAim = false;
    setHover(false);
    return;
  }
  const p = toBoard(e);
  downOnLauncher = onLauncher(p);
  downAt = performance.now();
  downPos = p;
  movedPx = 0;
  aiming = !downOnLauncher;
  state.cancelAim = false;
  if (downOnLauncher) setHover(true);
  else aimAt(p);
  try {
    canvas.setPointerCapture?.(e.pointerId);
  } catch {
    /* puntero ya liberado: no pasa nada */
  }
});

function endGesture(e) {
  pointers.delete(e.pointerId);
  const wasMulti = multiTouch;
  if (pointers.size === 0) multiTouch = false;
  const cancelled = state.cancelAim;
  state.cancelAim = false;
  const wasAiming = aiming;
  aiming = false;
  const wasOnLauncher = downOnLauncher;
  downOnLauncher = false;
  if (e.pointerType !== 'mouse') setHover(false);
  return { wasMulti, cancelled, wasAiming, wasOnLauncher };
}

canvas.addEventListener('pointerup', (e) => {
  if (e.button === 2) return;
  const g = endGesture(e);
  if (g.wasMulti) return; // hubo dos dedos: no se dispara
  if (state.mode === 'intro') return finishIntro();
  const p = toBoard(e);
  const deliberate = isDeliberateShot({ pointerType: e.pointerType, durationMs: performance.now() - downAt, movedPx });
  downPos = null;
  if (g.wasAiming) {
    if (!g.cancelled && !onLauncher(p)) {
      aimAt(p);
      // un toque rápido y quieto solo apunta: evita disparos al rozar la pantalla sin querer
      if (deliberate) shoot();
    }
  } else if (g.wasOnLauncher && onLauncher(p) && performance.now() - downAt < TAP_MAX_MS) {
    swap();
  } else if (!g.wasOnLauncher && !onLauncher(p) && e.pointerType === 'mouse') {
    // sin pulsación previa registrada (ratón que entra pulsado): disparo normal
    aimAt(p);
    shoot();
  }
});

// Si el sistema corta el gesto (llamada, gesto del navegador…), no se dispara.
canvas.addEventListener('pointercancel', (e) => endGesture(e));

// La pulsación larga (que en móvil lanza el menú contextual) no hace nada.
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (!ui.overlay.classList.contains('hidden')) return;
  if (state.mode === 'intro' && (e.key === ' ' || e.key === 'Enter')) {
    finishIntro();
    e.preventDefault();
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') state.keyAimAt = state.time;
  if (e.key === 'ArrowLeft') state.angle = Math.min(Math.PI - MIN_ANGLE, state.angle + 0.04);
  else if (e.key === 'ArrowRight') state.angle = Math.max(MIN_ANGLE, state.angle - 0.04);
  else if (e.key === ' ' || e.key === 'ArrowUp') shoot();
  else if (e.key === 'c' || e.key === 'C') swap();
  else if (e.key === 'r' || e.key === 'R') toggleSpecial(ROCKET);
  else if (e.key === 'm' || e.key === 'M') toggleSpecial(MINE);
  else if (e.key === 'a' || e.key === 'A') toggleSpecial(RAINBOW);
  else return;
  sfx.ensure();
  e.preventDefault();
});

for (const kind of SPECIALS) {
  ui.specials[kind].btn.addEventListener('click', () => {
    sfx.ensure();
    toggleSpecial(kind);
  });
}

ui.maps.addEventListener('click', () => {
  sfx.ensure();
  showTheme(themeOf(state.levelIndex));
});

ui.mute.addEventListener('click', () => {
  sfx.toggle();
  sfx.ensure();
  updateHud();
});

// Con ?debug en la URL se puede tocar el estado desde la consola del navegador.
if (new URLSearchParams(location.search).has('debug')) window.bubblePop = { state, startLevel, showMenu, giveSpecial: (kind = ROCKET) => {
    state.specials = addSpecial(state.specials, kind);
    updateSpecials(kind);
  } };

// Primera visita: cómo se juega. Si ya ha jugado: directo a los mapas.
updateHud();
if (state.progress.stars.some(Boolean)) showMenu();
else showIntro();
requestAnimationFrame(frame);
