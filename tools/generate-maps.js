// Genera los mapas de todas las temáticas y los escribe en src/maps.js. Cada mapa cumple lo que exige test/levels.test.js
// (simétrico, todo enganchado al techo, grupos pequeños, algún racimo que cae
// de un disparo) y el bot lo gana; su límite de disparos sale del bot.
//
//   node tools/generate-maps.js
//
// Es determinista (semillas fijas): volver a ejecutarlo da los mismos mapas.
// La dificultad sube con la temática y con el nivel: más colores, menos grupos
// de 3 y menos margen de disparos. Casi todas las perlas tienen pareja (ver
// MAX_SINGLES): la dificultad viene de los disparos justos, no de perlas sueltas
// imposibles de juntar. El largo cambia de un nivel a otro (ver LENGTH_PLAN).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGrid, findFloating, findCluster, colorsOnBoard, neighbors, isAnchor, isShell } from '../src/logic.js';
import { BOARD, COLOR_KEYS, SHELL_KEYS, BICOLOR_KEYS, BICOLOR_PAIRS, parseMap, bubbleCount, addAnchors, REEF_SHAPES } from '../src/levels.js';
import { playLevel, mulberry32 } from './bot.js';

const COLS = BOARD.cols;
const SEEDS = 8; // partidas del bot por mapa para fijar el límite

/**
 * Colores de cada nivel de una temática, del 1 al 10: se empieza con 2 y se
 * suma uno por nivel hasta llegar a los 6 en el 5.º. Lo comprueba
 * test/levels.test.js.
 */
export const COLOR_PLAN = [2, 3, 4, 5, 6, 6, 6, 6, 6, 6];

/** Nivel (índice dentro de la temática) desde el que salen bicolores y de dos golpes: del 3.º al 10.º. */
export const SPECIALS_FROM = 2;

/**
 * Largo de cada nivel de una temática, del 1 al 10, como múltiplo del largo
 * normal para su dificultad: unos cortos, otros normales y otros bastante más
 * largos, para que no sean todos iguales.
 */
export const LENGTH_PLAN = [0.8, 1, 0.75, 1.2, 0.85, 1.35, 0.8, 1.1, 1.5, 1.7];

/** Mapa más corto que se genera (filas). */
export const MIN_ROWS = 22;

/**
 * Parte de las perlas que pueden quedar sin pareja (en un grupo de 1), de los
 * mapas fáciles (d = 0) a los difíciles (d = 1). Las sueltas piden dos
 * disparos para explotar y, si hay muchas, frustran.
 */
export const MAX_SINGLES = { from: 0.1, to: 0.22 };
export const maxSingles = (d) => MAX_SINGLES.from + (MAX_SINGLES.to - MAX_SINGLES.from) * Math.min(1, Math.max(0, d));

/**
 * Temáticas: `from`/`to` (0…1) dicen cuánto sube la dificultad en toda la
 * temática. El Pulpo conserva las formas de sus mapas hechos a mano (en
 * src/levels.js) y solo se vuelven a pintar con los colores de COLOR_PLAN; sus
 * dos primeros niveles van sin anclas, para ir poco a poco.
 */
const GENERATED_THEMES = [
  { key: 'tortuga', from: 0.0, to: 0.35, seed: 101 },
  { key: 'pulpo', from: 0.2, to: 0.5, seed: 202, masks: REEF_SHAPES.map(maskOf), anchorsFrom: 2 },
  { key: 'caballito', from: 0.35, to: 0.65, seed: 303 },
  { key: 'medusa', from: 0.5, to: 0.82, seed: 404 },
  { key: 'ballena', from: 0.65, to: 1.0, seed: 505 },
  // Los nuevos siguen subiendo poco a poco, hasta pasar algo del máximo de la Ballena.
  { key: 'payaso', from: 0.55, to: 0.85, seed: 606 },
  { key: 'cangrejo', from: 0.6, to: 0.9, seed: 707 },
  { key: 'globo', from: 0.65, to: 0.95, seed: 808 },
  { key: 'delfin', from: 0.7, to: 1.0, seed: 909 },
  { key: 'manta', from: 0.75, to: 1.05, seed: 1010 },
  { key: 'tiburon', from: 0.8, to: 1.1, seed: 1111 },
  { key: 'rape', from: 0.85, to: 1.15, seed: 1212 },
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
  pairUp(g, rand, maxGroup);
  // quita lo que haya quedado sin enganchar al techo
  for (const [r, c] of findFloating(g)) g.cells[r][c] = null;
  const map = g.cells.map((row) => row.map((v) => (v == null ? '.' : COLOR_KEYS[v])).join(''));
  while (map.length && !/[a-z]/.test(map.at(-1))) map.pop();
  return map;
}

/**
 * Busca pareja a las perlas sueltas: si una no tiene ninguna vecina de su
 * color, prueba a pintarla (a ella y a su simétrica) del color de una vecina,
 * sin que ningún grupo pase de `maxGroup`. Cambia `g`.
 */
function pairUp(g, rand, maxGroup) {
  for (let pass = 0; pass < 3; pass++) {
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < Math.ceil(width(r) / 2); c++) {
        const v = g.cells[r][c];
        if (v == null || findCluster(g, r, c).length > 1) continue;
        const m = mirrorCol(r, c);
        const near = neighbors(g, r, c)
          .map(([nr, nc]) => g.cells[nr][nc])
          .filter((w) => w != null && w !== v);
        for (const color of [...new Set(near)].sort(() => rand() - 0.5)) {
          g.cells[r][c] = color;
          g.cells[r][m] = color;
          const ok = [[r, c], [r, m], ...neighbors(g, r, c), ...neighbors(g, r, m)].every(
            ([nr, nc]) => g.cells[nr][nc] == null || findCluster(g, nr, nc).length <= maxGroup,
          );
          if (ok) break;
          g.cells[r][c] = v;
          g.cells[r][m] = v;
        }
      }
    }
  }
}

/** Parte de las perlas de color que no tienen ninguna vecina de su color. */
export function singlesRatio(map) {
  const g = parseMap(map);
  let n = 0;
  let singles = 0;
  g.cells.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v == null || isAnchor(v) || isShell(v)) return;
      n++;
      if (findCluster(g, r, c).length === 1) singles++;
    }),
  );
  return n ? singles / n : 0;
}

/**
 * Pone burbujas de dos golpes y bicolores en un mapa, en parejas simétricas
 * (de la fila 2 para abajo): `pairs` de cada tipo. La de dos golpes tapa la
 * perla que había; la bicolor le suma un segundo color al azar. Devuelve el
 * mapa nuevo (puede salir uno no válido: lo comprueba quien llama).
 */
export function addSpecialBubbles(map, rand, pairs) {
  const rows = map.map((line) => [...line]);
  const spots = [];
  rows.forEach((row, r) => {
    if (r < 2) return;
    for (let c = 0; c < Math.floor(width(r) / 2); c++) if (COLOR_KEYS.includes(row[c])) spots.push([r, c]);
  });
  spots.sort(() => rand() - 0.5);
  const put = (r, c, ch) => {
    rows[r][c] = ch;
    rows[r][mirrorCol(r, c)] = ch;
  };
  for (const [r, c] of spots.splice(0, pairs)) put(r, c, SHELL_KEYS[COLOR_KEYS.indexOf(rows[r][c])]);
  // la bicolor solo junta colores que ya hay en el mapa, para no meter uno nuevo
  const present = new Set(map.join('').split('').map((ch) => COLOR_KEYS.indexOf(ch)).filter((i) => i >= 0));
  for (const [r, c] of spots.splice(0, pairs)) {
    const a = COLOR_KEYS.indexOf(rows[r][c]);
    const options = BICOLOR_PAIRS.map((pair, i) => [pair, i]).filter(([pair]) => pair.includes(a) && pair.every((x) => present.has(x)));
    if (options.length) put(r, c, BICOLOR_KEYS[options[Math.floor(rand() * options.length)][1]]);
  }
  return rows.map((row) => row.join(''));
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
  if (map.length < MIN_ROWS) return false;
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

/** Forma de un mapa ya hecho (qué casillas tienen burbuja, anclas incluidas). */
export function maskOf(map) {
  return map.map((row) => [...row].map((ch) => ch !== '.'));
}

/**
 * Un mapa de dificultad `d` (0…1) con `nColors` colores exactos. `mask` usa
 * esa forma en vez de inventar una; `anchors` dice si lleva anclas (por
 * defecto, a partir de los primeros niveles). Devuelve { map, maxGroup, shots, median }.
 */
export function generateMap(d, seed, nColors, { mask = null, anchors = d >= 0.1, specials = false, length = 1 } = {}) {
  const rand = mulberry32(seed);
  const rows = Math.max(MIN_ROWS, Math.round((28 + 24 * d + rand() * 4) * length));
  // con pocos colores no hay forma de que todos los grupos sean de 1 o 2: se permiten los de 3
  const maxGroup = d < 0.3 || nColors <= 3 ? 3 : 2;
  const pSame = Math.max(0.35, 0.7 - 0.3 * d);
  for (let attempt = 0; attempt < 400; attempt++) {
    const colors = [0, 1, 2, 3, 4, 5].sort(() => rand() - 0.5).slice(0, nColors);
    let map = paint(mask ?? makeMask(rows, rand, d), rand, colors, maxGroup, pSame);
    // una forma hecha a mano conserva sus filas vacías del final (alguna es corta y se rellena así)
    while (mask && map.length < mask.length) map.push('.'.repeat(COLS));
    if (!valid(map, maxGroup) || colorsOnBoard(parseMap(map)).length !== nColors) continue;
    // las formas hechas a mano son pequeñas y cada pareja suelta pesa mucho: se les da el margen de las difíciles
    if (singlesRatio(map) > (mask ? MAX_SINGLES.to : maxSingles(d))) continue;
    // anclas que rompen su columna al tocarlas
    if (anchors) {
      const anchored = addAnchors(map);
      if (valid(anchored, maxGroup)) map = anchored;
    }
    // en los niveles difíciles, bicolores y de dos golpes (más cuanto más difícil)
    if (specials) {
      // unas 3-6 de cada 100 perlas de cada tipo, según la dificultad
      map = addSpecialBubbles(map, rand, Math.max(2, Math.round((bubbleCount(map) * (0.03 + 0.03 * d)) / 2)));
      if (!valid(map, maxGroup)) continue;
      // las conchas tapan colores y pueden dejar perlas sin pareja: se vuelve a mirar
      if (singlesRatio(map) > MAX_SINGLES.to) continue;
    }
    const runs = Array.from({ length: SEEDS }, (_, i) => playLevel({ map }, { seed: i + 1 }));
    if (!runs.every((r) => r.won)) continue;
    const used = runs.map((r) => r.shots).sort((a, b) => a - b);
    const median = used[Math.floor(used.length / 2)];
    // Límite justo: lo que necesita el bot en una partida normal (la mediana)
    // más un margen, del 20 % en los fáciles al 5 % en los más difíciles. Quien
    // juega falla más que el bot, pero tiene cohetes, minas y perlas arcoíris,
    // que no gastan disparos. Nunca menos de lo que necesita con la semilla 1,
    // que es la partida que comprueba test/levels.test.js.
    // (nunca menos del 5 %, ni en los nuevos que pasan de 1)
    const margin = Math.max(1.05, 1.2 - 0.15 * d);
    const shots = Math.max(Math.ceil(median * margin), runs[0].shots);
    return { map, maxGroup, shots, median };
  }
  throw new Error(`No sale un mapa válido con dificultad ${d}, ${nColors} colores y semilla ${seed}`);
}

/**
 * Los 10 niveles de una temática, de menos a más difícil. `masks` (opcional)
 * da la forma de cada nivel y `anchorsFrom`, desde qué nivel llevan anclas.
 */
export function generateTheme({ from, to, seed, masks = null, anchorsFrom = null }) {
  const maps = Array.from({ length: 10 }, (_, k) => {
    const d = from + ((to - from) * k) / 9;
    const anchors = anchorsFrom == null ? d >= 0.1 : k >= anchorsFrom;
    return generateMap(d, seed * 100 + k, COLOR_PLAN[k], { mask: masks?.[k], anchors, specials: k >= SPECIALS_FROM, length: LENGTH_PLAN[k] });
  });
  // Entre los niveles con los mismos colores, el orden lo marca lo que le
  // cuesta al bot, para que la dificultad suba de verdad.
  const out = maps.slice();
  for (let k = 0; k < out.length; ) {
    let end = k;
    while (end < out.length && COLOR_PLAN[end] === COLOR_PLAN[k]) end++;
    // por disparos por burbuja, no en total: así un mapa largo no va siempre al final
    const cost = (m) => m.median / bubbleCount(m.map);
    const run = out.slice(k, end).sort((a, b) => cost(a) - cost(b) || a.shots - b.shots);
    out.splice(k, run.length, ...run);
    k = end;
  }
  return out;
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
