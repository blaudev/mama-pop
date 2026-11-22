// Genera los mapas de las temáticas que no están hechos a mano y los escribe
// en src/maps.js. Cada mapa cumple lo que exige test/levels.test.js
// (simétrico, todo enganchado al techo, grupos pequeños, algún racimo que cae
// de un disparo) y el bot lo gana; su límite de disparos sale del bot.
//
//   node tools/generate-maps.js
//
// Es determinista (semillas fijas): volver a ejecutarlo da los mismos mapas.
// La dificultad sube con la temática y con el nivel: más filas, más colores,
// menos grupos de 3 y menos margen de disparos.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGrid, findFloating, findCluster, colorsOnBoard } from '../src/logic.js';
import { BOARD, COLOR_KEYS, parseMap, bubbleCount, addAnchors } from '../src/levels.js';
import { playLevel, mulberry32 } from './bot.js';

const COLS = BOARD.cols;
const SEEDS = 8; // partidas del bot por mapa para fijar el límite

/**
 * Temáticas generadas: `from`/`to` (0…1) dicen cuánto sube la dificultad en
 * toda la temática. `colors` fija cuántos colores lleva algún nivel (por su
 * posición antes de ordenar): niveles de 2 o 3 colores, más sencillos y
 * distintos, para empezar con calma o para respirar a mitad de temática.
 */
const GENERATED_THEMES = [
  { key: 'tortuga', from: 0.0, to: 0.35, seed: 101, colors: { 0: 2, 1: 2, 2: 3, 5: 2 } },
  { key: 'caballito', from: 0.35, to: 0.65, seed: 303, colors: { 4: 2 } },
  { key: 'medusa', from: 0.5, to: 0.82, seed: 404, colors: { 3: 2 } },
  { key: 'ballena', from: 0.65, to: 1.0, seed: 505, colors: { 2: 2 } },
];

const mirrorCol = (r, c) => (r % 2 ? 8 - c : 9 - c);
const width = (r) => (r % 2 ? 9 : 10);

/** Forma del mapa (qué casillas tienen burbuja), simétrica. */
function makeMask(rows, rand, d) {
  const style = ['torres', 'cuevas', 'panal', 'rombos'][Math.floor(rand() * 4)];
  const pillars = new Set([0, 1, 2, 3, 4].filter(() => rand() < 0.5));
  if (pillars.size < 2) pillars.add(1).add(3);
  const barEvery = 6 + Math.floor(rand() * 4);
  const holeRate = 0.12 + 0.12 * rand();
  const mask = [];
  for (let r = 0; r < rows; r++) {
    const row = Array(COLS).fill(false);
    for (let c = 0; c < Math.ceil(width(r) / 2); c++) {
      let on;
      if (r < 2) on = true;
      else if (style === 'torres') on = r % barEvery === 0 || pillars.has(c);
      else if (style === 'panal') on = !(r % 4 === 2 && c % 3 === 1) && !(r % 4 === 0 && c % 3 === 2 && r % 8 === 0);
      else if (style === 'rombos') {
        const k = r % 8;
        const dist = Math.abs(c - 2);
        on = k === 0 || dist <= (k <= 4 ? k / 2 : (8 - k) / 2);
      } else on = rand() > holeRate;
      row[c] = on;
      row[mirrorCol(r, c)] = on;
    }
    if (r % 2) row[9] = false;
    mask.push(row);
  }
  // un poco de ruido simétrico en los mapas más difíciles, para que no sean tan regulares
  for (let r = 2; r < rows; r++) {
    for (let c = 0; c < Math.ceil(width(r) / 2); c++) {
      if (rand() < 0.04 + 0.05 * d) {
        mask[r][c] = !mask[r][c];
        mask[r][mirrorCol(r, c)] = mask[r][c];
      }
    }
  }
  return mask;
}

/** Pinta la forma con colores sin pasar de `maxGroup` por grupo; simétrico. */
function paint(mask, rand, colors, maxGroup, pSame) {
  const rows = mask.length;
  const g = createGrid(COLS, rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < Math.ceil(width(r) / 2); c++) {
      if (!mask[r][c]) continue;
      const m = mirrorCol(r, c);
      const order = [...colors].sort(() => rand() - 0.5);
      // a veces se intenta primero el color de una vecina ya pintada: grupos de 2-3
      if (rand() < pSame) {
        const near = [[r, c - 1], [r - 1, c], [r - 1, c - 1], [r - 1, c + 1]]
          .filter(([nr, nc]) => nr >= 0 && nc >= 0 && nc < COLS && g.cells[nr][nc] != null)
          .map(([nr, nc]) => g.cells[nr][nc]);
        if (near.length) order.unshift(near[Math.floor(rand() * near.length)]);
      }
      let placed = false;
      for (const color of order) {
        g.cells[r][c] = color;
        g.cells[r][m] = color;
        if (findCluster(g, r, c).length <= maxGroup && findCluster(g, r, m).length <= maxGroup) {
          placed = true;
          break;
        }
      }
      if (!placed) {
        g.cells[r][c] = null;
        g.cells[r][m] = null;
      }
    }
  }
  // quita lo que haya quedado sin enganchar al techo
  for (const [r, c] of findFloating(g)) g.cells[r][c] = null;
  const map = g.cells.map((row) => row.map((v) => (v == null ? '.' : COLOR_KEYS[v])).join(''));
  while (map.length && !/[a-z]/.test(map.at(-1))) map.pop();
  return map;
}

/** Racimos de 2-3 del mismo color que, al explotar, sueltan 5 o más (como en el test). */
function oneShotBunches(map) {
  const g = parseMap(map);
  const seen = new Set();
  let count = 0;
  g.cells.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v == null || seen.has(`${r},${c}`)) return;
      const group = findCluster(g, r, c);
      group.forEach(([gr, gc]) => seen.add(`${gr},${gc}`));
      if (group.length < 2) return;
      const copy = { ...g, cells: g.cells.map((x) => x.slice()) };
      group.forEach(([gr, gc]) => (copy.cells[gr][gc] = null));
      if (findFloating(copy).length >= 5) count++;
    }),
  );
  return count;
}

function valid(map, maxGroup) {
  if (map.length < 28) return false;
  const g = parseMap(map);
  if (findFloating(g).length) return false;
  if (colorsOnBoard(g).length < 2) return false;
  if (oneShotBunches(map) < 1) return false;
  let ofThree = 0;
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (g.cells[r][c] == null) continue;
      const size = findCluster(g, r, c).length;
      if (size > 3) return false;
      if (size === 3) ofThree++;
    }
  }
  if (maxGroup < 3 && ofThree / bubbleCount(map) >= 0.05) return false;
  return true;
}

/**
 * Un mapa de dificultad `d` (0…1); `forceColors` fija cuántos colores lleva.
 * Devuelve { map, maxGroup, shots, median }.
 */
export function generateMap(d, seed, forceColors) {
  const rand = mulberry32(seed);
  const rows = Math.round(28 + 24 * d + rand() * 4);
  const nColors = forceColors ?? Math.min(6, 3 + Math.round(3.2 * d));
  const colors = [0, 1, 2, 3, 4, 5].sort(() => rand() - 0.5).slice(0, nColors);
  // con pocos colores no hay forma de que todos los grupos sean de 1 o 2: se permiten los de 3
  const maxGroup = d < 0.3 || nColors <= 3 ? 3 : 2;
  const pSame = 0.55 - 0.45 * d;
  for (let attempt = 0; attempt < 400; attempt++) {
    let map = paint(makeMask(rows, rand, d), rand, colors, maxGroup, pSame);
    if (!valid(map, maxGroup)) continue;
    // a partir de los primeros niveles, anclas que rompen su columna al tocarlas
    if (d >= 0.1) {
      const anchored = addAnchors(map);
      if (valid(anchored, maxGroup)) map = anchored;
    }
    const runs = Array.from({ length: SEEDS }, (_, i) => playLevel({ map }, { seed: i + 1 }));
    if (!runs.every((r) => r.won)) continue;
    const used = runs.map((r) => r.shots).sort((a, b) => a - b);
    const margin = 1.5 - 0.35 * d; // más margen en los fáciles
    const shots = Math.ceil((used.at(-1) * margin) / 5) * 5;
    return { map, maxGroup, shots, median: used[Math.floor(used.length / 2)] };
  }
  throw new Error(`No sale un mapa válido con dificultad ${d} y semilla ${seed}`);
}

/** Los 10 niveles de una temática, de menos a más difícil. */
export function generateTheme({ from, to, seed, colors = {} }) {
  const maps = Array.from({ length: 10 }, (_, k) => generateMap(from + ((to - from) * k) / 9, seed * 100 + k, colors[k]));
  // El orden final lo marca lo que le cuesta al bot, para que la dificultad suba de verdad.
  // Los niveles de pocos colores se quedan en su sitio: son el respiro de la temática.
  const fixed = new Set(Object.keys(colors).map(Number));
  const sorted = maps.filter((_, k) => !fixed.has(k)).sort((a, b) => a.median - b.median || a.shots - b.shots);
  return maps.map((m, k) => (fixed.has(k) ? m : sorted.shift()));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = {};
  for (const theme of GENERATED_THEMES) {
    out[theme.key] = generateTheme(theme).map(({ map, maxGroup, shots }) => ({ shots, maxGroup, map }));
    console.log(theme.key, out[theme.key].map((m) => `${m.map.length}f/${m.shots}`).join(' '));
  }
  const body = Object.entries(out)
    .map(([key, maps]) => {
      const items = maps
        .map((m) => `    { shots: ${m.shots}, maxGroup: ${m.maxGroup}, map: [\n${m.map.map((l) => `      '${l}',`).join('\n')}\n    ] },`)
        .join('\n');
      return `  ${key}: [\n${items}\n  ],`;
    })
    .join('\n');
  const file = `// Generado con tools/generate-maps.js: no editar a mano, volver a generar.
// Mapas de las temáticas generadas, de menos a más difíciles. \`shots\` sale del bot.

export const GENERATED_MAPS = {
${body}
};
`;
  writeFileSync(new URL('../src/maps.js', import.meta.url), file);
  console.log('Escrito src/maps.js');
}
