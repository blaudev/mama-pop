// Fondo animado del mapa de animales (pantalla «Inmersión»): el mar en un
// canvas detrás del camino. El agua toma el color del animal que hay en el
// centro de la pantalla y se oscurece al bajar; arriba se ve la superficie y
// los rayos de sol, en medio algas, peces y burbujas, y en lo hondo lucecitas.
// Solo es decoración: se para sola cuando el canvas sale de la página.

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mezcla dos colores #rrggbb (t = 0 → a, t = 1 → b). */
export function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}

/** Posición de cada parada del camino: x en fracción del ancho, y en px. */
export function divePos(i, { top, gap }) {
  return { x: 0.5 + Math.sin(i * 1.15 + 0.4) * 0.24, y: top + i * gap };
}

/** Trazo del camino por las `n` primeras paradas, en curvas suaves. */
export function divePath(n, width, layout) {
  const p = Array.from({ length: n }, (_, i) => divePos(i, layout));
  let d = `M${p[0].x * width},${p[0].y}`;
  for (let i = 1; i < n; i++) {
    const a = p[i - 1];
    const b = p[i];
    d += ` C${a.x * width},${a.y + layout.gap * 0.5} ${b.x * width},${b.y - layout.gap * 0.5} ${b.x * width},${b.y}`;
  }
  return d;
}

function newBubble(anywhere) {
  const z = rnd(0.35, 1);
  return { x: Math.random(), y: anywhere ? Math.random() : 1.05 + Math.random() * 0.2, z, r: rnd(2, 6) * z, v: rnd(0.035, 0.07) * (0.6 + z * 0.6), ph: rnd(0, TAU), wob: rnd(1, 2.2) };
}

function newSchool(anywhere) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const z = rnd(0.4, 1);
  const colors = ['rgba(6,28,58,0.32)', 'rgba(255,190,120,0.35)', 'rgba(190,240,255,0.25)'];
  return {
    dir,
    z,
    x: anywhere ? Math.random() : dir > 0 ? -0.3 : 1.3,
    y: rnd(0.03, 0.97),
    v: rnd(0.02, 0.045) * (0.5 + z * 0.7),
    ph: rnd(0, TAU),
    color: colors[Math.floor(Math.random() * colors.length)],
    members: Array.from({ length: Math.round(rnd(5, 11)) }, () => ({ dx: rnd(-34, 34), dy: rnd(-14, 14), ph: rnd(0, TAU) })),
  };
}

function fish(ctx, x, y, s, dir, t, color) {
  const wag = Math.sin(t * 9) * 0.35;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 4.6, 0, 0, TAU);
  ctx.moveTo(-8, 0);
  ctx.lineTo(-16, -5 + wag * 6);
  ctx.lineTo(-16, 5 + wag * 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function kelp(ctx, x, y, height, t, color, phase) {
  const n = 9;
  const width = 8;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    pts.push([x + Math.sin(t * 0.9 + phase + k * 2.4) * 16 * k * k + Math.sin(t * 2.1 + phase + k * 5) * 2 * k, y - height * k]);
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
  }
  ctx.stroke();
  for (let i = 2; i < n; i += 2) {
    const [px, py] = pts[i];
    const side = i % 4 === 0 ? 1 : -1;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(side * (0.9 + Math.sin(t * 1.4 + phase + i) * 0.3));
    ctx.beginPath();
    ctx.ellipse(0, -width * 1.3, width * 0.55, width * 1.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function surface(ctx, w, y, t) {
  if (y < -40) return;
  const wave = (x) => y + Math.sin(x * 0.035 + t * 1.6) * 4 + Math.sin(x * 0.013 - t) * 5;
  const g = ctx.createLinearGradient(0, y - 30, 0, y + 40);
  g.addColorStop(0, 'rgba(210,250,255,0.55)');
  g.addColorStop(0.5, 'rgba(160,235,250,0.25)');
  g.addColorStop(1, 'rgba(160,235,250,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, wave(x));
  ctx.lineTo(w, -10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(240,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, wave(x));
  ctx.stroke();
}

function rays(ctx, w, h, t, alpha) {
  if (alpha <= 0.005) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const count = 6;
  for (let i = 0; i < count; i++) {
    const base = ((i + 0.5) / count) * w * 1.3 - w * 0.15 + Math.sin(t * 0.17 + i * 2.1) * w * 0.06;
    const top = 26 + (i % 3) * 14;
    const bottom = 110 + (i % 2) * 70;
    const len = h * 1.1 * (0.7 + (i % 3) * 0.15);
    const skew = len * 0.22;
    const a = alpha * (0.55 + 0.45 * Math.sin(t * 0.6 + i * 1.7));
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, `rgba(220,250,255,${a})`);
    g.addColorStop(1, 'rgba(220,250,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(base - top / 2, -10);
    ctx.lineTo(base + top / 2, -10);
    ctx.lineTo(base + bottom / 2 + skew, len);
    ctx.lineTo(base - bottom / 2 + skew, len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Arranca el fondo en `canvas`, siguiendo el scroll de `scroller`.
 * `waters`: color del agua de cada parada; `layout`: { top, gap, height }.
 */
export function startDiveSea(canvas, scroller, waters, layout) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const n = waters.length;
  const bubbles = Array.from({ length: 26 }, () => newBubble(true));
  const specks = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: rnd(0.2, 1), ph: rnd(0, TAU), hue: [175, 175, 95, 290][Math.floor(Math.random() * 4)] }));
  const schools = Array.from({ length: 5 }, () => newSchool(true));
  const kelps = Array.from({ length: 2 * Math.ceil(n * 0.75) }, (_, i) => ({
    left: i % 2 === 0,
    y: layout.top + 40 + Math.floor(i / 2) * layout.gap * 1.05 + (i % 3) * 30,
    h: 120 + (i % 4) * 40,
    ph: i * 1.7,
    color: ['#2d8a58', '#3c9c5f', '#246f4b', '#4aa36a'][i % 4],
  }));
  let w = 0;
  let h = 0;
  let last = performance.now();

  const frame = (now) => {
    if (!canvas.isConnected) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.clientWidth !== w || canvas.clientHeight !== h) {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dt = reduce ? 0 : Math.min(0.05, (now - last) / 1000);
    const t = reduce ? 0 : now / 1000;
    last = now;
    const cy = scroller.scrollTop;

    // Agua: el color de la parada del centro, mezclado con la siguiente
    const f = Math.max(0, Math.min(n - 1, (cy + h * 0.5 - layout.top) / layout.gap));
    const i0 = Math.floor(f);
    const i1 = Math.min(n - 1, i0 + 1);
    const k = f - i0;
    const deep = f / (n - 1);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, mix(waters[i0], '#bff4ff', Math.max(0, 0.35 - deep * 0.5)));
    g.addColorStop(0.5, mix(waters[i0], waters[i1], k));
    g.addColorStop(1, mix(waters[i1], '#020818', 0.45));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    surface(ctx, w, 60 - cy, t);
    rays(ctx, w, h, t, 0.16 * Math.max(0, 1 - deep * 1.25) + 0.03);

    // Algas a los lados, ancladas al camino (se mueven con el scroll); no en la fosa
    ctx.globalAlpha = 0.75;
    for (const kp of kelps) {
      if (kp.y / layout.height > 0.7) continue;
      const y = kp.y + kp.h - cy;
      if (y < -20 || y - kp.h > h + 20) continue;
      const x = kp.left ? 10 + (kp.ph % 3) * 6 : w - 10 - (kp.ph % 3) * 6;
      kelp(ctx, x, y, kp.h, t, kp.color, kp.ph);
    }
    ctx.globalAlpha = 1;

    // Bancos de peces, con algo de paralaje
    for (let s = 0; s < schools.length; s++) {
      const sc = schools[s];
      sc.x += sc.v * sc.dir * dt;
      if (sc.x > 1.4 || sc.x < -0.4) schools[s] = newSchool(false);
      const bx = sc.x * w;
      const by = sc.y * h * 1.6 - cy * 0.4 * sc.z + Math.sin(t * 0.5 + sc.ph) * 14;
      if (by < -60 || by > h + 60) continue;
      for (const m of sc.members) {
        fish(ctx, bx + m.dx * sc.z + Math.sin(t * 1.3 + m.ph) * 3, by + m.dy * sc.z + Math.cos(t * 1.1 + m.ph) * 3, 0.55 + sc.z * 0.6, sc.dir, t + m.ph, sc.color);
      }
    }

    // Nieve marina y, en lo hondo, lucecitas que parpadean
    const snow = 0.3 + deep * 0.5;
    const glow = Math.max(0, deep - 0.6) * 2.5;
    for (const p of specks) {
      p.y += 0.004 * dt * p.z;
      p.x += Math.sin(t * 0.3 + p.ph) * 0.0006 * dt;
      const px = (((p.x * w) % w) + w) % w;
      const py = (((p.y * h - cy * p.z * 0.4) % h) + h) % h;
      ctx.fillStyle = `rgba(220,245,255,${snow * (0.25 + 0.35 * p.z)})`;
      ctx.fillRect(px, py, 1.4 * p.z + 0.4, 1.4 * p.z + 0.4);
      if (glow > 0 && p.z > 0.55) {
        const a = glow * Math.max(0, Math.sin(t * (0.6 + p.z) + p.ph)) ** 3;
        if (a < 0.02) continue;
        const r = 7 * p.z;
        const lg = ctx.createRadialGradient(px, py, 0, px, py, r);
        lg.addColorStop(0, `hsla(${p.hue},100%,80%,${Math.min(1, a)})`);
        lg.addColorStop(1, `hsla(${p.hue},100%,60%,0)`);
        ctx.fillStyle = lg;
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      }
    }

    // Burbujas que suben haciendo eses
    for (let b = 0; b < bubbles.length; b++) {
      const bb = bubbles[b];
      bb.y -= bb.v * dt;
      if (bb.y < -0.05) bubbles[b] = newBubble(false);
      const px = bb.x * w + Math.sin(t * bb.wob + bb.ph) * 6 * bb.z;
      const py = bb.y * h;
      ctx.globalAlpha = (0.9 - deep * 0.5) * (0.35 + 0.5 * bb.z);
      ctx.strokeStyle = 'rgba(230,252,255,0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px, py, bb.r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(px - bb.r * 0.35, py - bb.r * 0.35, bb.r * 0.28, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // El fondo del mar, al final del todo
    const floorY = layout.height - 110 - cy;
    if (floorY < h) {
      ctx.fillStyle = '#1a1e3a';
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 10) ctx.lineTo(x, floorY + Math.sin(x * 0.02) * 14 + Math.sin(x * 0.07) * 4);
      ctx.lineTo(w, h);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
