// Lógica pura del tablero, sin DOM: se puede probar con `node --test`.
//
// El tablero es una rejilla hexagonal: las filas alternas van desplazadas
// medio hueco a la derecha. `parity` dice qué filas están desplazadas.
//
// Coordenadas: todo se calcula en coordenadas del mapa («mundo»), con la
// fila 0 arriba. La cámara (`cam`) es cuántos píxeles del mapa quedan por
// encima del borde superior de la pantalla.

export const MIN_MATCH = 3;

/**
 * Distancia de choque del disparo, como fracción de 2R (dos burbujas tocándose).
 * Más bajo = la burbuja se cuela mejor por los huecos. No puede bajar de
 * 1/√3 ≈ 0.577, o el disparo atravesaría una pared de burbujas sin huecos.
 */
export const HIT_RATIO = 0.7;

export function createGrid(cols, rows, parity = 0) {
  return {
    cols,
    rows,
    parity,
    cells: Array.from({ length: rows }, () => Array(cols).fill(null)),
  };
}

export function isShifted(grid, row) {
  return ((row + grid.parity) & 1) === 1;
}

export function inBounds(grid, r, c) {
  return r >= 0 && r < grid.rows && c >= 0 && c < grid.cols;
}

const EVEN_OFFSETS = [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
const ODD_OFFSETS = [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];

export function neighbors(grid, r, c) {
  const offsets = isShifted(grid, r) ? ODD_OFFSETS : EVEN_OFFSETS;
  const out = [];
  for (const [dr, dc] of offsets) {
    if (inBounds(grid, r + dr, c + dc)) out.push([r + dr, c + dc]);
  }
  return out;
}

const key = (r, c) => r * 1000 + c;

function flood(grid, starts, accept) {
  const seen = new Set(starts.map(([r, c]) => key(r, c)));
  const stack = [...starts];
  const out = [];
  while (stack.length) {
    const [r, c] = stack.pop();
    out.push([r, c]);
    for (const [nr, nc] of neighbors(grid, r, c)) {
      const k = key(nr, nc);
      if (seen.has(k)) continue;
      const v = grid.cells[nr][nc];
      if (v == null || !accept(v)) continue;
      seen.add(k);
      stack.push([nr, nc]);
    }
  }
  return { out, seen };
}

// ── Burbujas bicolor y de dos golpes ─────────────────────────────────────
// Vienen puestas en algunos mapas. Una bicolor (mitad de un color, mitad de
// otro) vale por cualquiera de sus dos colores, pero no une un grupo de un
// color con uno del otro. Una de dos golpes sale tapada, de un color neutro
// que no cuenta para nada; la destapa una bola que se pegue a ella o una
// explosión a su lado, y desde entonces es una perla normal de su color.
//
// En la rejilla, una perla vale su color (0…5); una bicolor, BICOLOR +
// 6 × el color menor + el mayor; una de dos golpes tapada, SHELL + su color.

export const BICOLOR = 20;
export const SHELL = 60;
const NCOLORS = 6;

export const isColor = (v) => Number.isInteger(v) && v >= 0 && v < NCOLORS;
export const bicolorValue = (a, b) => BICOLOR + NCOLORS * Math.min(a, b) + Math.max(a, b);
export const isBicolor = (v) => Number.isInteger(v) && v >= BICOLOR && v < BICOLOR + NCOLORS * NCOLORS;
export const shellValue = (color) => SHELL + color;
export const isShell = (v) => Number.isInteger(v) && v >= SHELL && v < SHELL + NCOLORS;
export const shellColor = (v) => v - SHELL;

/** Colores por los que vale una casilla: el suyo, los dos de una bicolor o ninguno (tapada, ancla). */
export function colorsOf(v) {
  if (isColor(v)) return [v];
  if (isBicolor(v)) return [Math.floor((v - BICOLOR) / NCOLORS), (v - BICOLOR) % NCOLORS];
  return [];
}

const matches = (v, color) => colorsOf(v).includes(color);

/**
 * Burbujas conectadas que valen por `color`, desde (r, c) e incluida ella.
 * Sin `color`, el de la casilla; en una bicolor, el de su grupo más grande;
 * una tapada o un ancla van solas.
 */
export function findCluster(grid, r, c, color) {
  const v = inBounds(grid, r, c) ? grid.cells[r][c] : null;
  if (v == null) return [];
  if (color != null) return flood(grid, [[r, c]], (w) => matches(w, color)).out;
  const groups = colorsOf(v).map((col) => findCluster(grid, r, c, col));
  if (!groups.length) return [[r, c]];
  return groups.reduce((a, b) => (b.length > a.length ? b : a));
}

/** Destapa las burbujas de dos golpes que hay en `cells`: pasan a ser perlas de su color. */
function uncoverShells(grid, cells) {
  const out = [];
  for (const [row, col] of cells) {
    const v = grid.cells[row][col];
    if (!isShell(v)) continue;
    grid.cells[row][col] = shellColor(v);
    out.push({ row, col, color: shellColor(v) });
  }
  return out;
}

/** Burbujas que ya no están unidas al techo (fila 0) por ningún camino. */
export function findFloating(grid) {
  const roots = [];
  for (let c = 0; c < grid.cols; c++) {
    if (grid.cells[0][c] != null) roots.push([0, c]);
  }
  const { seen } = flood(grid, roots, () => true);
  const out = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.cells[r][c] != null && !seen.has(key(r, c))) out.push([r, c]);
    }
  }
  return out;
}

function removeCells(grid, cells) {
  return cells.map(([row, col]) => {
    const color = grid.cells[row][col];
    grid.cells[row][col] = null;
    return { row, col, color };
  });
}

/**
 * Coloca una burbuja y resuelve la jugada: si forma un grupo de MIN_MATCH o
 * más del mismo color, lo explota y suelta lo que quede colgando.
 */
export function placeBubble(grid, r, c, color, { visible = null } = {}) {
  if (!inBounds(grid, r, c)) throw new Error(`Casilla fuera del tablero: ${r},${c}`);
  if (grid.cells[r][c] != null) throw new Error(`Casilla ocupada: ${r},${c}`);
  grid.cells[r][c] = color;

  // anclas del mapa que toca la bola: rompen su columna (y en cadena)
  const touched = anchorsTouching(grid, r, c);
  const cluster = findCluster(grid, r, c, color);
  const popped = cluster.length >= MIN_MATCH ? removeCells(grid, cluster) : [];
  const blast = touched.length ? anchorBlast(grid, touched, visible) : { cells: [], anchors: [] };
  popped.push(...removeCells(grid, blast.cells));
  // las de dos golpes que toca la bola o que tienen una explosión al lado se destapan
  const hit = [[r, c], ...popped.map((b) => [b.row, b.col])].flatMap(([hr, hc]) => neighbors(grid, hr, hc));
  const uncovered = uncoverShells(grid, hit);
  const dropped = popped.length ? removeCells(grid, findFloating(grid)) : [];
  return { popped, dropped, anchors: blast.anchors, uncovered };
}

/**
 * Qué pasaría si una burbuja de `color` acabara en (r, c), sin tocar el
 * tablero: el grupo del mismo color al que se uniría y si llegaría a explotar.
 */
export function matchPreview(grid, r, c, color) {
  const starts = neighbors(grid, r, c).filter(([nr, nc]) => matches(grid.cells[nr][nc], color));
  if (!starts.length) return { cells: [], pops: false };
  const { out } = flood(grid, starts, (v) => matches(v, color));
  return { cells: out, pops: out.length + 1 >= MIN_MATCH };
}

export function fillRows(grid, count, makeColor) {
  for (let r = 0; r < Math.min(count, grid.rows); r++) {
    for (let c = 0; c < grid.cols; c++) grid.cells[r][c] = makeColor(r, c);
  }
}

export function lowestOccupiedRow(grid) {
  for (let r = grid.rows - 1; r >= 0; r--) {
    if (grid.cells[r].some((v) => v != null)) return r;
  }
  return -1;
}

/** Burbujas que quedan en el tablero (todo lo que hay que romper para ganar, anclas incluidas). */
export function bubblesLeft(grid) {
  let n = 0;
  for (const row of grid.cells) for (const v of row) if (v != null) n++;
  return n;
}

export function isEmpty(grid) {
  return lowestOccupiedRow(grid) === -1;
}

export function colorsOnBoard(grid, rows = null) {
  const set = new Set();
  const from = rows ? Math.max(0, rows.from) : 0;
  const to = rows ? Math.min(grid.rows - 1, rows.to) : grid.rows - 1;
  for (let r = from; r <= to; r++) for (const v of grid.cells[r]) for (const color of colorsOf(v)) set.add(color);
  return [...set].sort((a, b) => a - b);
}

/**
 * Colores de los que pueden salir las bolas del lanzador: los que se ven en
 * pantalla (filas `rows`, ver visibleRows), para no dar uno que solo está en
 * la parte del mapa que aún no se ve. Si en pantalla no queda ninguno, los
 * de todo el tablero.
 */
export function colorsInView(grid, rows) {
  const seen = colorsOnBoard(grid, rows);
  return seen.length ? seen : colorsOnBoard(grid);
}

// ── Anclas del mapa ──────────────────────────────────────────────────────
// Burbujas especiales que vienen puestas en el mapa. No tienen color (no se
// juntan con nada) y llevan una flecha que apunta en una sola dirección:
// arriba, abajo, a un lado o en oblicuo. Al tocarlas una bola, rompen todo lo
// que hay en esa dirección, pero solo en la parte del mapa que se ve. Si
// rompen otra ancla, esa salta también hacia donde apunte ella. Después de
// cada disparo, todas las flechas giran un paso en el sentido del reloj.
//
// En la rejilla, un ancla vale ANCHOR + su dirección (0…7).

export const ANCHOR = 10;
export const ANCHOR_DIRS = 8;
/** Direcciones, en el sentido del reloj empezando por arriba. */
export const DIR_NAMES = ['arriba', 'arriba-derecha', 'derecha', 'abajo-derecha', 'abajo', 'abajo-izquierda', 'izquierda', 'arriba-izquierda'];

export const isAnchor = (v) => Number.isInteger(v) && v >= ANCHOR && v < ANCHOR + ANCHOR_DIRS;
export const anchorDir = (v) => v - ANCHOR;
export const anchorValue = (dir) => ANCHOR + (((dir % ANCHOR_DIRS) + ANCHOR_DIRS) % ANCHOR_DIRS);

/** Posición horizontal de una casilla en medios huecos (sin depender del radio). */
const halfX = (grid, r, c) => 2 * c + (isShifted(grid, r) ? 1 : 0);

/**
 * Casillas desde (r, c) en la dirección `dir`, sin incluirla, hasta el borde
 * del tablero (llenas o vacías). Arriba y abajo siguen la vertical: en las
 * filas desplazadas, las dos casillas que quedan a cada lado de la línea. Las
 * oblicuas siguen la diagonal de la rejilla hexagonal.
 */
export function anchorRay(grid, r, c, dir) {
  const out = [];
  if (dir === 0 || dir === 4) {
    const x = halfX(grid, r, c);
    const step = dir === 0 ? -1 : 1;
    for (let rr = r + step; rr >= 0 && rr < grid.rows; rr += step) {
      for (let cc = 0; cc < grid.cols; cc++) if (Math.abs(halfX(grid, rr, cc) - x) <= 1) out.push([rr, cc]);
    }
  } else if (dir === 2 || dir === 6) {
    const step = dir === 2 ? 1 : -1;
    for (let cc = c + step; cc >= 0 && cc < grid.cols; cc += step) out.push([r, cc]);
  } else {
    const up = dir === 1 || dir === 7;
    const right = dir === 1 || dir === 3;
    let cr = r;
    let cc = c;
    for (;;) {
      const nr = cr + (up ? -1 : 1);
      const nc = isShifted(grid, cr) ? (right ? cc + 1 : cc) : right ? cc : cc - 1;
      if (!inBounds(grid, nr, nc)) break;
      out.push([nr, nc]);
      cr = nr;
      cc = nc;
    }
  }
  return out;
}

/** Filas cuyo centro se ve en pantalla con la cámara en `cam`: { from, to }. */
export function visibleRows(cam, height, R) {
  const rh = rowHeight(R);
  return { from: Math.max(0, Math.ceil((cam - R) / rh)), to: Math.floor((cam + height - R) / rh) };
}

/** Anclas vecinas de (r, c). */
export function anchorsTouching(grid, r, c) {
  return neighbors(grid, r, c).filter(([nr, nc]) => isAnchor(grid.cells[nr][nc]));
}

/**
 * Lo que rompen unas anclas al saltar: cada una se rompe a sí misma y todo lo
 * que haya en su dirección dentro de `visible` (filas { from, to }; null =
 * todo el tablero). Si cae otra ancla, salta también, en cadena. Devuelve las
 * casillas con burbuja y qué anclas han saltado, por orden, con su dirección.
 */
export function anchorBlast(grid, anchors, visible = null) {
  const inView = (r) => !visible || (r >= visible.from && r <= visible.to);
  const done = new Set();
  const cells = new Map();
  const order = [];
  const queue = [...anchors];
  while (queue.length) {
    const [r, c] = queue.shift();
    const k = key(r, c);
    if (done.has(k)) continue;
    done.add(k);
    const dir = anchorDir(grid.cells[r][c]);
    order.push([r, c, dir]);
    cells.set(k, [r, c]);
    for (const [cr, cc] of anchorRay(grid, r, c, dir)) {
      if (!inView(cr)) continue;
      const v = grid.cells[cr][cc];
      if (v == null) continue;
      cells.set(key(cr, cc), [cr, cc]);
      if (isAnchor(v) && !done.has(key(cr, cc))) queue.push([cr, cc]);
    }
  }
  return { cells: [...cells.values()], anchors: order };
}

/** Todas las flechas giran un paso en el sentido del reloj (después de cada disparo). */
export function rotateAnchors(grid) {
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const v = grid.cells[r][c];
      if (isAnchor(v)) grid.cells[r][c] = anchorValue(anchorDir(v) + 1);
    }
  }
}

/** Si entre lo que va a romperse hay anclas, añade lo que rompen ellas (en cadena). */
function withAnchorChain(grid, cells, visible = null) {
  const anchors = cells.filter(([r, c]) => isAnchor(grid.cells[r][c]));
  if (!anchors.length) return { cells, anchors: [] };
  const blast = anchorBlast(grid, anchors, visible);
  const all = new Map(cells.map(([r, c]) => [key(r, c), [r, c]]));
  for (const [r, c] of blast.cells) all.set(key(r, c), [r, c]);
  return { cells: [...all.values()], anchors: blast.anchors };
}

// ── Geometría ────────────────────────────────────────────────────────────

export const rowHeight = (R) => R * Math.sqrt(3);

export function cellCenter(grid, r, c, R) {
  return {
    x: R + c * 2 * R + (isShifted(grid, r) ? R : 0),
    y: R + r * rowHeight(R),
  };
}

function isAttachable(grid, r, c) {
  return r === 0 || neighbors(grid, r, c).some(([nr, nc]) => grid.cells[nr][nc] != null);
}

/**
 * Casilla vacía más cercana a (x, y) donde la burbuja quedaría enganchada
 * (en el techo o tocando otra). Si no hay ninguna, la vacía más cercana.
 */
export function nearestEmptyCell(grid, x, y, R) {
  const approx = Math.round((y - R) / rowHeight(R));
  let best = null;
  let bestD = Infinity;
  let fallback = null;
  let fallbackD = Infinity;
  for (let r = approx - 1; r <= approx + 1; r++) {
    if (r < 0 || r >= grid.rows) continue;
    for (let c = 0; c < grid.cols; c++) {
      if (grid.cells[r][c] != null) continue;
      const p = cellCenter(grid, r, c, R);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < fallbackD) {
        fallbackD = d;
        fallback = { row: r, col: c };
      }
      if (d < bestD && isAttachable(grid, r, c)) {
        bestD = d;
        best = { row: r, col: c };
      }
    }
  }
  return best ?? fallback;
}

/**
 * Traza el recorrido completo de un disparo: rebota en las paredes y se para
 * al tocar el techo u otra burbuja. Lo usan tanto la guía de puntería como el
 * disparo real, así que la guía nunca miente.
 *
 * @param angle radianes desde el eje X positivo, hacia arriba (π/2 = recto).
 * @returns {{ points: {x:number,y:number}[], cell: {row:number,col:number}|null }}
 */
export function simulateShot(grid, start, angle, R, width, { step = R / 3, hitRatio = HIT_RATIO } = {}) {
  let { x, y } = start;
  let dx = Math.cos(angle);
  const dy = -Math.sin(angle);
  const points = [{ x, y }];
  const hitDist2 = (2 * R * hitRatio) ** 2;
  const rh = rowHeight(R);

  for (let i = 0; i < 10000; i++) {
    x += dx * step;
    y += dy * step;

    if (x < R) {
      x = 2 * R - x;
      dx = -dx;
      points.push({ x, y });
    } else if (x > width - R) {
      x = 2 * (width - R) - x;
      dx = -dx;
      points.push({ x, y });
    }

    if (y <= R) {
      y = R;
      break;
    }

    let hit = false;
    const approx = Math.round((y - R) / rh);
    for (let r = approx - 1; r <= approx + 1 && !hit; r++) {
      if (r < 0 || r >= grid.rows) continue;
      for (let c = 0; c < grid.cols; c++) {
        if (grid.cells[r][c] == null) continue;
        const p = cellCenter(grid, r, c, R);
        if ((p.x - x) ** 2 + (p.y - y) ** 2 < hitDist2) {
          hit = true;
          break;
        }
      }
    }
    if (hit) break;
  }

  points.push({ x, y });
  return { points, cell: nearestEmptyCell(grid, x, y, R) };
}

// ── Cámara ───────────────────────────────────────────────────────────────

/** Borde inferior (en el mapa) de la burbuja más baja; -Infinity si no queda ninguna. */
export function bottomY(grid, R) {
  const r = lowestOccupiedRow(grid);
  return r < 0 ? -Infinity : cellCenter(grid, r, 0, R).y + R;
}

/**
 * Cámara al empezar: el borde inferior del mapa queda a `frontY` de la parte
 * de arriba de la pantalla. La cámara siempre vale 0 o al menos un bloque,
 * para que al final no queden filas a medio esconder arriba.
 */
export function initialCamera(grid, R, frontY, blockPx) {
  const cam = Math.max(0, bottomY(grid, R) - frontY);
  return cam < blockPx ? 0 : cam;
}

/**
 * Cámara tras una jugada. El mapa solo baja (la cámara solo decrece), y
 * siempre en bloques enteros de `blockPx`, cuando el frente de burbujas se ha
 * alejado al menos un bloque de `frontY`.
 */
export function nextCamera(cam, grid, R, frontY, blockPx) {
  const bottom = bottomY(grid, R);
  if (bottom === -Infinity) return cam;
  const desired = Math.max(0, bottom - frontY);
  const steps = Math.floor((cam - desired) / blockPx);
  if (steps < 1) return cam;
  const next = cam - steps * blockPx;
  return next < blockPx ? 0 : next;
}

// ── Cola de colores ─────────────────────────────────────────────────────

/**
 * Colores que no deben salir en la próxima bola.
 * - `history`: últimos disparos, del más antiguo al más reciente, como
 *   { color, popped }. Si los dos últimos fueron del mismo color y ninguno
 *   explotó nada, ese color se evita.
 * - `queue`: bolas que ya esperan (por ejemplo [actual, siguiente]). Si son
 *   dos del mismo color, se evita una tercera seguida.
 */
export function colorsToAvoid(history, queue = []) {
  const avoid = new Set();
  const [a, b] = history.slice(-2);
  if (a && b && a.color === b.color && !a.popped && !b.popped) avoid.add(b.color);
  const [q1, q2] = queue.slice(-2);
  if (q1 != null && q1 === q2) avoid.add(q1);
  return [...avoid];
}

/** Probabilidad de que la bola salga de un color que sirve (ver reachableColors), si hay alguno. */
export const PREFER_USEFUL = 0.75;

/**
 * Color al azar de los que hay en el tablero, sin los de `avoid` si queda
 * alguno más. Si hay colores en `useful` (los que pueden explotar algo desde
 * el lanzador), casi siempre sale uno de ellos; a veces, cualquiera.
 */
export function chooseColor(onBoard, avoid = [], rand = Math.random, useful = []) {
  const pool = onBoard.filter((c) => !avoid.includes(c));
  const from = pool.length ? pool : onBoard;
  const good = from.filter((c) => useful.includes(c));
  if (good.length && rand() < PREFER_USEFUL) return good[Math.floor(rand() * good.length)];
  return from[Math.floor(rand() * from.length)];
}

/**
 * Colores que explotarían algo disparados desde `start`: prueba `angles`
 * ángulos (los mismos límites que el lanzador) y mira, en cada casilla a la
 * que se llega, qué colores harían grupo de 3. Así no cuenta los grupos
 * escondidos detrás de burbujas de otros colores.
 */
export function reachableColors(grid, start, R, width, { angles = 60, minAngle = 0.13 } = {}) {
  const onBoard = colorsOnBoard(grid);
  const cells = new Map();
  for (let i = 0; i < angles; i++) {
    const angle = minAngle + ((Math.PI - 2 * minAngle) * i) / (angles - 1);
    const { cell } = simulateShot(grid, start, angle, R, width);
    if (cell) cells.set(`${cell.row},${cell.col}`, cell);
  }
  return onBoard.filter((color) =>
    [...cells.values()].some(({ row, col }) => matchPreview(grid, row, col, color).pops),
  );
}

// ── Cohete ───────────────────────────────────────────────────────────────
// Bola especial: sale recta hacia donde se apunta, sin rebotar, y rompe
// todas las burbujas que atraviesa hasta salir de la pantalla.

export const ROCKET = 'rocket';
/** Cada cuántos disparos seguidos explotando algo se gana un cohete. */
export const ROCKET_STREAK = 6;
/**
 * Alcance del cohete a cada lado de su recta, como múltiplo de R: rompe las
 * burbujas cuyo centro queda más cerca que esto. Con 2.1 abre una franja de
 * unas 3 burbujas de ancho (3 en las filas alineadas con él, 2 en las otras).
 */
export const ROCKET_REACH = 2.1;

// ── Supercohete ──────────────────────────────────────────────────────────
// Una mejora del cohete: mientras se tiene, cada cohete que se lanza sale como
// supercohete, más ancho. Se gana llenando la carga del icono del cohete
// (SUPER_CHARGE disparos seguidos que explotan algo, sin fallar ninguno). No
// se gasta al lanzar; solo se pierde si no se termina el nivel. En el
// inventario es `superRocket: 1`.

export const SUPER_ROCKET = 'superRocket';
/** Disparos seguidos explotando algo que llenan la carga del supercohete. */
export const SUPER_CHARGE = 20;
/** Alcance del supercohete (ver ROCKET_REACH): el doble de ancho, unas 5 burbujas (5 en las filas alineadas con él, 4 en las otras). */
export const SUPER_ROCKET_REACH = 4.2;

/**
 * Carga del supercohete tras un disparo normal: sube uno si explota algo y
 * vuelve a cero si falla. Al llegar a SUPER_CHARGE da un supercohete y empieza
 * de nuevo. Mientras se tiene un supercohete guardado (`holding`) la carga no
 * se mueve: ya está conseguido, no hace falta rellenarla y un fallo no lo quita.
 *
 * @returns {{ charge: number, full: boolean }}
 */
export function chargeRocket(charge, popped, { holding = false } = {}) {
  if (holding) return { charge: charge || 0, full: false };
  if (!popped) return { charge: 0, full: false };
  const next = (charge || 0) + 1;
  return next >= SUPER_CHARGE ? { charge: 0, full: true } : { charge: next, full: false };
}

/** Carga leída del almacenamiento: un entero entre 0 y SUPER_CHARGE - 1. */
export function normalizeCharge(raw) {
  return Number.isInteger(raw) && raw > 0 && raw < SUPER_CHARGE ? raw : 0;
}

/**
 * Qué queda cargado al tocar el botón del cohete: si ya había un cohete
 * cargado, se descarga; si no quedan cohetes, nada cambia; si quedan, se carga
 * como supercohete si se tiene la mejora, o como cohete normal.
 */
export function armRocket(armed, inv) {
  if (armed === ROCKET || armed === SUPER_ROCKET) return null;
  if (!(inv[ROCKET] > 0)) return armed;
  return inv[SUPER_ROCKET] > 0 ? SUPER_ROCKET : ROCKET;
}

/** Inventario sin la mejora del supercohete (al no terminar un nivel). */
export function loseSuper(inv) {
  const { [SUPER_ROCKET]: _, ...rest } = inv;
  return rest;
}

/** ¿Esta racha (disparos seguidos explotando algo) da un cohete? */
export function earnsRocket(streak) {
  return streak > 0 && streak % ROCKET_STREAK === 0;
}

/**
 * Recorrido recto del cohete desde `start` con ángulo `angle` (como en
 * simulateShot) hasta que sale por arriba (`topY`) o por un lado. Devuelve
 * los dos extremos y las casillas que rompe, de la más cercana a la más
 * lejana, cada una con la distancia recorrida al llegar a ella. `reach` es
 * el ancho a cada lado de la recta, en px (el del supercohete es mayor).
 *
 * @returns {{ points: {x:number,y:number}[], cells: {row:number,col:number,dist:number}[] }}
 */
export function rocketPath(grid, start, angle, R, width, topY, reach = ROCKET_REACH * R) {
  const dx = Math.cos(angle);
  const dy = -Math.sin(angle);
  // distancia hasta salir por arriba o por un lado (el cohete sale entero de la pantalla)
  let len = dy < 0 ? (start.y - topY) / -dy : Infinity;
  if (dx < 0) len = Math.min(len, (start.x + R) / -dx);
  if (dx > 0) len = Math.min(len, (width + R - start.x) / dx);
  if (!Number.isFinite(len) || len < 0) len = 0;
  const end = { x: start.x + dx * len, y: start.y + dy * len };

  const cells = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.cells[r][c] == null) continue;
      const p = cellCenter(grid, r, c, R);
      const along = (p.x - start.x) * dx + (p.y - start.y) * dy;
      if (along < 0 || along > len) continue;
      const off = Math.abs((p.x - start.x) * dy - (p.y - start.y) * dx);
      if (off < reach) cells.push({ row: r, col: c, dist: along });
    }
  }
  cells.sort((a, b) => a.dist - b.dist);
  return { points: [{ ...start }, end], cells };
}

/** Rompe las casillas del cohete y suelta lo que quede colgando. */
export function fireRocket(grid, cells, { visible = null } = {}) {
  const chain = withAnchorChain(grid, cells.map(({ row, col }) => [row, col]), visible);
  const popped = removeCells(grid, chain.cells);
  const dropped = removeCells(grid, findFloating(grid));
  return { popped, dropped, anchors: chain.anchors };
}

// ── Bolas especiales guardadas ───────────────────────────────────────────
// Se ganan jugando, se guardan en un inventario ({ rocket: 2 }) y se usan
// cuando se quiere: primero se «arman» (se cargan en el cañón) y se gastan
// al disparar.

/**
 * Máximo de cada especial que se puede guardar. Así no se acumulan cientos
 * y siguen siendo un premio que se usa, no una reserva infinita.
 */
export const SPECIALS_MAX = 5;

/** Máximo que se puede guardar de `kind`: del supercohete, uno (se usa y se vuelve a cargar). */
export function specialMax(kind) {
  return kind === SUPER_ROCKET ? 1 : SPECIALS_MAX;
}

/** Inventario con una más de `kind` (si no está ya en el máximo). */
export function addSpecial(inv, kind) {
  return { ...inv, [kind]: Math.min((inv[kind] ?? 0) + 1, specialMax(kind)) };
}

/** Gasta una de `kind` si queda alguna: { inv, ok }. */
export function useSpecial(inv, kind) {
  if (!(inv[kind] > 0)) return { inv, ok: false };
  return { inv: { ...inv, [kind]: inv[kind] - 1 }, ok: true };
}

/**
 * Qué queda armado al tocar el botón de `kind`: si ya estaba armada, se
 * desarma; si no y queda alguna, se arma; si no queda ninguna, nada cambia.
 */
export function toggleArmed(armed, inv, kind) {
  if (armed === kind) return null;
  return inv[kind] > 0 ? kind : armed;
}

/**
 * Inventario leído del almacenamiento: solo contadores enteros y positivos de
 * especiales conocidas, como mucho specialMax de cada una (las que se
 * guardaron antes del máximo se recortan). Cualquier otra cosa (datos viejos
 * o rotos) se ignora.
 */
export function normalizeSpecials(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const kind of [...SPECIALS, SUPER_ROCKET]) {
      const n = raw[kind];
      if (Number.isInteger(n) && n > 0) out[kind] = Math.min(n, specialMax(kind));
    }
  }
  return out;
}

// ── Mina ─────────────────────────────────────────────────────────────────
// Se pega donde cae y explota: rompe todo lo que haya a MINE_RADIUS casillas
// o menos, sea del color que sea.

export const MINE = 'mine';
export const MINE_RADIUS = 2;

/** Casillas del tablero a `dist` pasos o menos de (r, c), estén llenas o vacías, incluida ella. */
export function cellsWithin(grid, r, c, dist) {
  const seen = new Set([key(r, c)]);
  let ring = [[r, c]];
  const out = [[r, c]];
  for (let d = 0; d < dist; d++) {
    const next = [];
    for (const [cr, cc] of ring) {
      for (const [nr, nc] of neighbors(grid, cr, cc)) {
        const k = key(nr, nc);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push([nr, nc]);
        out.push([nr, nc]);
      }
    }
    ring = next;
  }
  return out;
}

/** Burbujas que rompería una mina que acabe en (r, c). */
export function mineTargets(grid, r, c) {
  return cellsWithin(grid, r, c, MINE_RADIUS).filter(([nr, nc]) => grid.cells[nr][nc] != null);
}

/** La mina acaba en (r, c), que está vacía: rompe lo que alcanza y suelta lo que quede colgando. */
export function placeMine(grid, r, c, { visible = null } = {}) {
  const chain = withAnchorChain(grid, mineTargets(grid, r, c), visible);
  const popped = removeCells(grid, chain.cells);
  const dropped = removeCells(grid, findFloating(grid));
  return { popped, dropped, anchors: chain.anchors };
}

// ── Perla arcoíris ───────────────────────────────────────────────────────
// Vale por cualquier color: toma el del grupo más grande que toque.

export const RAINBOW = 'rainbow';

/**
 * Color que tomaría una perla arcoíris en (r, c): el del grupo más grande de
 * los que toca (si empatan, el de menor número). null si no toca ninguno.
 */
export function rainbowColor(grid, r, c) {
  let best = null;
  let bestSize = 0;
  for (const [nr, nc] of neighbors(grid, r, c)) {
    for (const color of colorsOf(grid.cells[nr][nc])) {
      const size = findCluster(grid, nr, nc, color).length;
      if (size > bestSize || (size === bestSize && color < best)) {
        best = color;
        bestSize = size;
      }
    }
  }
  return best;
}

/** Coloca una perla arcoíris: toma el color de rainbowColor (o `fallback`) y se resuelve como una perla normal. */
export function placeRainbow(grid, r, c, fallback, opts = {}) {
  const color = rainbowColor(grid, r, c) ?? fallback;
  return { color, ...placeBubble(grid, r, c, color, opts) };
}

// ── Premios ──────────────────────────────────────────────────────────────

export const SPECIALS = [ROCKET, MINE, RAINBOW];
/** Grupo que hay que romper de un disparo para ganar una mina. */
export const MINE_GROUP = 5;
/** Burbujas que tienen que caer a la vez para ganar una perla arcoíris. */
export const RAINBOW_DROP = 10;

/**
 * Especiales que gana un disparo normal: un cohete cada ROCKET_STREAK de
 * racha, una mina si rompe un grupo de MINE_GROUP o más y una perla arcoíris
 * si hace caer RAINBOW_DROP o más. Si además ha llenado la carga
 * (`charged`, ver chargeRocket), el cohete es un supercohete.
 */
export function earnedSpecials(streak, popped, dropped, charged = false) {
  const out = [];
  if (charged) out.push(SUPER_ROCKET);
  else if (earnsRocket(streak)) out.push(ROCKET);
  if (popped >= MINE_GROUP) out.push(MINE);
  if (dropped >= RAINBOW_DROP) out.push(RAINBOW);
  return out;
}
