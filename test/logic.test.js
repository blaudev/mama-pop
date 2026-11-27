import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGrid,
  neighbors,
  findCluster,
  findFloating,
  placeBubble,
  fillRows,
  lowestOccupiedRow,
  isEmpty,
  colorsOnBoard,
  colorsInView,
  cellCenter,
  nearestEmptyCell,
  simulateShot,
  bottomY,
  initialCamera,
  nextCamera,
  matchPreview,
  colorsToAvoid,
  chooseColor,
  reachableColors,
  earnsRocket,
  rocketPath,
  SUPER_ROCKET,
  SUPER_CHARGE,
  SUPER_ROCKET_REACH,
  chargeRocket,
  normalizeCharge,
  armRocket,
  loseSuper,
  SPECIALS_MAX,
  specialMax,
  fireRocket,
  ROCKET,
  addSpecial,
  useSpecial,
  toggleArmed,
  normalizeSpecials,
  MINE,
  RAINBOW,
  cellsWithin,
  placeMine,
  rainbowColor,
  placeRainbow,
  earnedSpecials,
  anchorValue,
  anchorDir,
  isAnchor,
  anchorRay,
  anchorBlast,
  rotateAnchors,
  visibleRows,
  bicolorValue,
  shellValue,
  colorsOf,
  bubblesLeft,
} from '../src/logic.js';

const R = 10;
const sorted = (cells) => cells.map(([r, c]) => `${r},${c}`).sort();

function gridFrom(rows, cols = rows[0].length, totalRows = 8) {
  const g = createGrid(cols, totalRows);
  rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      g.cells[r][c] = ch === '.' ? null : Number(ch);
    });
  });
  return g;
}

test('neighbors: fila sin desplazar mira a la izquierda arriba y abajo', () => {
  const g = createGrid(5, 5);
  assert.deepEqual(sorted(neighbors(g, 2, 2)), sorted([[2, 1], [2, 3], [1, 1], [1, 2], [3, 1], [3, 2]]));
});

test('neighbors: fila desplazada mira a la derecha arriba y abajo', () => {
  const g = createGrid(5, 5);
  assert.deepEqual(sorted(neighbors(g, 1, 2)), sorted([[1, 1], [1, 3], [0, 2], [0, 3], [2, 2], [2, 3]]));
});

test('neighbors: no sale del tablero', () => {
  const g = createGrid(5, 5);
  assert.deepEqual(sorted(neighbors(g, 0, 0)), sorted([[0, 1], [1, 0]]));
});

test('findCluster: solo junta burbujas conectadas del mismo color', () => {
  const g = gridFrom(['1120', '0100']);
  assert.deepEqual(sorted(findCluster(g, 0, 0)), sorted([[0, 0], [0, 1], [1, 1]]));
});

test('findCluster: casilla vacía devuelve lista vacía', () => {
  const g = createGrid(4, 4);
  assert.deepEqual(findCluster(g, 0, 0), []);
});

test('findFloating: detecta burbujas que no cuelgan del techo', () => {
  const g = gridFrom(['1...', '....', '22..']);
  assert.deepEqual(sorted(findFloating(g)), sorted([[2, 0], [2, 1]]));
});

test('placeBubble: con tres del mismo color las explota', () => {
  const g = gridFrom(['11..']);
  const res = placeBubble(g, 0, 2, 1);
  assert.equal(res.popped.length, 3);
  assert.equal(res.dropped.length, 0);
  assert.ok(isEmpty(g));
});

test('placeBubble: con dos del mismo color no explota nada', () => {
  const g = gridFrom(['1...']);
  const res = placeBubble(g, 0, 1, 1);
  assert.equal(res.popped.length, 0);
  assert.equal(g.cells[0][0], 1);
  assert.equal(g.cells[0][1], 1);
});

test('placeBubble: deja caer lo que queda colgando tras explotar', () => {
  // Fila 1 está desplazada: (1,0) cuelga de (0,0) y (0,1); (2,0) cuelga de (1,0).
  const g = gridFrom(['11..', '1...', '3...']);
  const res = placeBubble(g, 0, 2, 1);
  assert.equal(res.popped.length, 4);
  assert.deepEqual(res.dropped, [{ row: 2, col: 0, color: 3 }]);
  assert.ok(isEmpty(g));
});

test('placeBubble: rechaza casillas ocupadas', () => {
  const g = gridFrom(['1...']);
  assert.throws(() => placeBubble(g, 0, 0, 2));
});

test('lowestOccupiedRow, isEmpty y colorsOnBoard', () => {
  const g = gridFrom(['1...', '..2.', '....']);
  assert.equal(lowestOccupiedRow(g), 1);
  assert.deepEqual(colorsOnBoard(g), [1, 2]);
  assert.equal(isEmpty(g), false);
  assert.equal(lowestOccupiedRow(createGrid(3, 3)), -1);
});

test('fillRows rellena el número de filas pedido', () => {
  const g = createGrid(4, 6);
  fillRows(g, 2, (r, c) => r + c);
  assert.equal(lowestOccupiedRow(g), 1);
  assert.equal(g.cells[1][3], 4);
});

test('cellCenter desplaza medio hueco las filas impares', () => {
  const g = createGrid(4, 4);
  assert.deepEqual(cellCenter(g, 0, 0, R), { x: R, y: R });
  assert.equal(cellCenter(g, 1, 0, R).x, 2 * R);
});

test('nearestEmptyCell solo elige casillas pegadas a algo', () => {
  const g = gridFrom(['1...', '....', '....']);
  const below = cellCenter(g, 1, 0, R);
  assert.deepEqual(nearestEmptyCell(g, below.x, below.y, R), { row: 1, col: 0 });
  const far = cellCenter(g, 2, 3, R);
  const cell = nearestEmptyCell(g, far.x, far.y, R);
  assert.notDeepEqual(cell, { row: 2, col: 3 });
});

test('simulateShot: tiro recto choca con la burbuja de encima', () => {
  const g = createGrid(5, 10);
  g.cells[0][2] = 1;
  const width = 5 * 2 * R + R;
  const start = { x: cellCenter(g, 0, 2, R).x, y: 200 };
  const shot = simulateShot(g, start, Math.PI / 2, R, width);
  assert.equal(shot.cell.row, 1);
  assert.ok([1, 2].includes(shot.cell.col), `columna inesperada ${shot.cell.col}`);
  assert.equal(shot.points.length, 2);
});

test('simulateShot: se cuela por el hueco entre dos burbujas aunque no vaya centrado', () => {
  // Hueco de dos filas de fondo: (2,2) y (1,2) vacías. Para llegar a (1,2)
  // hay que pasar entre (2,1) x=30 y (2,3) x=70, y luego entre (1,1) x=40 y
  // (1,3) x=80. Disparamos 5 px a la derecha del centro de la entrada (x=50).
  const g = createGrid(5, 10);
  fillRows(g, 2, () => 0);
  g.cells[1][2] = null;
  g.cells[2][1] = 1;
  g.cells[2][3] = 1;
  const width = 5 * 2 * R + R;
  const shot = simulateShot(g, { x: 55, y: 200 }, Math.PI / 2, R, width);
  assert.deepEqual(shot.cell, { row: 1, col: 2 });
});

test('simulateShot: nunca atraviesa una pared de burbujas', () => {
  const g = createGrid(5, 12);
  fillRows(g, 4, () => 0);
  const width = 5 * 2 * R + R;
  for (let x = R; x <= width - R; x += 1) {
    const shot = simulateShot(g, { x, y: 300 }, Math.PI / 2, R, width);
    assert.equal(shot.cell.row, 4, `el tiro desde x=${x} se ha colado`);
  }
});

test('simulateShot: rebota en la pared', () => {
  const g = createGrid(5, 10);
  const width = 5 * 2 * R + R;
  const shot = simulateShot(g, { x: width / 2, y: 200 }, Math.PI / 6, R, width);
  assert.ok(shot.points.length >= 3, 'debería haber al menos un rebote');
  assert.equal(shot.cell.row, 0);
  for (const p of shot.points) {
    assert.ok(p.x >= R - 0.001 && p.x <= width - R + 0.001);
  }
});

// ── Cámara ───────────────────────────────────────────────────────────────
// Con R = 10 cada fila mide 17,32 px; el borde inferior de la fila n está en 20 + 17,32·n.

function gridWithRows(n, total = 60) {
  const g = createGrid(4, total);
  fillRows(g, n, () => 0);
  return g;
}

test('bottomY: borde inferior de la burbuja más baja', () => {
  assert.equal(bottomY(createGrid(4, 4), R), -Infinity);
  const g = gridWithRows(1);
  assert.equal(bottomY(g, R), 2 * R);
});

test('initialCamera deja el borde inferior del mapa en la línea de frente', () => {
  const g = gridWithRows(40);
  const cam = initialCamera(g, R, 300, 50);
  assert.ok(Math.abs(bottomY(g, R) - cam - 300) < 1e-9);
});

test('initialCamera: un mapa corto se ve entero desde arriba', () => {
  assert.equal(initialCamera(gridWithRows(3), R, 300, 50), 0);
  // Si sobraría menos de un bloque, también arranca arriba del todo.
  const g = gridWithRows(18); // borde a ~314 px, 14 px por debajo del frente
  assert.equal(initialCamera(g, R, 300, 50), 0);
});

test('nextCamera no se mueve hasta que se libera al menos un bloque', () => {
  const g = gridWithRows(40);
  const cam = initialCamera(g, R, 300, 50);
  for (let c = 0; c < 4; c++) g.cells[39][c] = null; // sube 17 px: menos de un bloque
  assert.equal(nextCamera(cam, g, R, 300, 50), cam);
});

test('nextCamera baja el mapa en bloques enteros', () => {
  const g = gridWithRows(40);
  const cam = initialCamera(g, R, 300, 50);
  for (let r = 34; r < 40; r++) g.cells[r].fill(null); // sube 6 filas = 104 px
  assert.equal(nextCamera(cam, g, R, 300, 50), cam - 100); // 2 bloques de 50
});

test('nextCamera nunca vuelve a subir aunque las burbujas bajen', () => {
  const g = gridWithRows(40);
  const cam = initialCamera(g, R, 300, 50);
  fillRows(g, 45, () => 0);
  assert.equal(nextCamera(cam, g, R, 300, 50), cam);
});

test('nextCamera: cerca del techo salta a 0 para no dejar filas escondidas', () => {
  const g = gridWithRows(40);
  const cam = 120; // a 2,4 bloques del techo
  for (let r = 2; r < 40; r++) g.cells[r].fill(null);
  assert.equal(nextCamera(cam, g, R, 300, 50), 0);
});

// ── Vista previa del disparo ────────────────────────────────────────────

test('matchPreview: las bolas del mismo color que se unirían, y si explotarían', () => {
  // (1,0) está desplazada: toca (0,0) y (0,1). Rojo en (0,0) y (0,1), azul en (0,2).
  const g = gridFrom(['112.', '....']);
  const red = matchPreview(g, 1, 0, 1);
  assert.deepEqual(sorted(red.cells), sorted([[0, 0], [0, 1]]));
  assert.equal(red.pops, true);
  const blue = matchPreview(g, 1, 1, 2);
  assert.deepEqual(sorted(blue.cells), sorted([[0, 2]]));
  assert.equal(blue.pops, false);
});

test('matchPreview: sin vecinas del mismo color no resalta nada y no toca el tablero', () => {
  const g = gridFrom(['11..', '....']);
  const before = JSON.stringify(g.cells);
  assert.deepEqual(matchPreview(g, 1, 0, 3), { cells: [], pops: false });
  assert.equal(JSON.stringify(g.cells), before);
});

test('matchPreview incluye todo el grupo, no solo las vecinas directas', () => {
  const g = gridFrom(['1111', '....']);
  assert.equal(matchPreview(g, 1, 3, 1).cells.length, 4);
});

// ── Cola de colores ─────────────────────────────────────────────────────

test('colorsToAvoid: tras fallar dos seguidas del mismo color, ese color no sale', () => {
  const miss = (color) => ({ color, popped: false });
  const hit = (color) => ({ color, popped: true });
  assert.deepEqual(colorsToAvoid([miss(2), miss(2)]), [2]);
  assert.deepEqual(colorsToAvoid([miss(1), miss(2), miss(2)]), [2]);
  assert.deepEqual(colorsToAvoid([hit(2), miss(2)]), [], 'una de las dos explotó');
  assert.deepEqual(colorsToAvoid([miss(1), miss(2)]), [], 'colores distintos');
  assert.deepEqual(colorsToAvoid([miss(2)]), []);
});

test('reachableColors: un color cuya pareja se alcanza desde el lanzador sirve', () => {
  const g = createGrid(5, 10);
  g.cells[0][2] = 1;
  g.cells[0][3] = 1;
  g.cells[0][0] = 2; // sola: un disparo de este color no explota nada
  const width = 5 * 2 * R + R;
  const start = { x: width / 2, y: 300 };
  assert.deepEqual(reachableColors(g, start, R, width), [1]);
});

test('reachableColors: no cuenta un color que solo explotaría detrás de una pared de otros', () => {
  // Fila 0: verdes (3) detrás; fila 1: pared de rojos (1) y amarillos (2)
  // alternos, sin parejas. La esquina de la fila 0 es amarilla para que no
  // quede ningún hueco por el que llegar a los verdes.
  const g = createGrid(10, 14);
  for (let c = 0; c < 9; c++) g.cells[0][c] = 3;
  g.cells[0][9] = 2;
  for (let c = 0; c < 9; c++) g.cells[1][c] = c % 2 ? 2 : 1;
  const width = 10 * 2 * R + R;
  const start = { x: width / 2, y: 500 };
  assert.deepEqual(reachableColors(g, start, R, width), []);
});

test('chooseColor prefiere los colores que sirven, pero los demás también salen', () => {
  // con el primer número bajo se elige entre los que sirven; si no, entre todos
  const seq = (...xs) => () => xs.shift();
  assert.equal(chooseColor([1, 2, 3], [], seq(0.1, 0.0), [3]), 3);
  assert.equal(chooseColor([1, 2, 3], [], seq(0.1, 0.99), [3]), 3);
  assert.equal(chooseColor([1, 2, 3], [], seq(0.9, 0.0), [3]), 1, 'a veces sale uno que no sirve');
  assert.equal(chooseColor([1, 2, 3], [3], seq(0.1, 0.0), [3]), 1, 'lo que hay que evitar se sigue evitando');
});

test('colorsToAvoid: nunca tres bolas seguidas del mismo color en la cola', () => {
  assert.deepEqual(colorsToAvoid([], [3, 3]), [3]);
  assert.deepEqual(colorsToAvoid([], [3, 4]), []);
  const miss = { color: 2, popped: false };
  assert.deepEqual(colorsToAvoid([miss, miss], [3, 3]).sort(), [2, 3]);
});

test('chooseColor evita los colores pedidos si hay otros en el tablero', () => {
  const seq = [0, 0.5, 0.99];
  for (const r of seq) assert.notEqual(chooseColor([1, 2], [2], () => r), 2);
  assert.equal(chooseColor([2], [2], () => 0.3), 2, 'si solo queda ese color, sale ese');
  assert.equal(chooseColor([1, 2, 3], [], () => 0.5), 2);
});

// ── Cohete ───────────────────────────────────────────────────────────────

test('earnsRocket: se gana cada 6 disparos seguidos explotando algo', () => {
  assert.deepEqual([0, 1, 3, 5, 6, 7, 9, 12].map(earnsRocket), [false, false, false, false, true, false, false, true]);
});

test('rocketPath: recto hacia arriba abre una franja de unas 3 burbujas de ancho', () => {
  // 5 columnas, filas sin desplazar en las pares; la columna 2 de las filas pares queda en x = 50
  const g = gridFrom(['11111', '2222.', '33333', '4444.', '55555']);
  const start = { x: 50, y: 200 };
  const { cells, points } = rocketPath(g, start, Math.PI / 2, R, 100, -20);
  // filas alineadas con la recta: la del centro y sus dos vecinas; filas desplazadas: las dos que la rozan
  assert.deepEqual(
    sorted(cells.map(({ row, col }) => [row, col])),
    sorted([[4, 1], [4, 2], [4, 3], [3, 1], [3, 2], [2, 1], [2, 2], [2, 3], [1, 1], [1, 2], [0, 1], [0, 2], [0, 3]]),
  );
  assert.ok(cells.every((c, i) => i === 0 || cells[i - 1].dist <= c.dist), 'de la más cercana a la más lejana');
  assert.deepEqual(cells.map((c) => c.row), [4, 4, 4, 3, 3, 2, 2, 2, 1, 1, 0, 0, 0]);
  assert.equal(Math.round(points[1].x), 50);
  assert.equal(points[1].y, -20);
});

test('rocketPath: el supercohete abre una franja más ancha que el cohete', () => {
  const g = gridFrom(['1111111', '222222.', '3333333']);
  const start = { x: 70, y: 200 }; // columna 3 de las filas pares
  const normal = rocketPath(g, start, Math.PI / 2, R, 140, -20);
  const big = rocketPath(g, start, Math.PI / 2, R, 140, -20, SUPER_ROCKET_REACH * R);
  const cols = (shot, row) => shot.cells.filter((c) => c.row === row).map((c) => c.col).sort();
  assert.deepEqual(cols(normal, 2), [2, 3, 4]);
  assert.deepEqual(cols(big, 2), [1, 2, 3, 4, 5]);
  assert.ok(big.cells.length > normal.cells.length);
});

test('rocketPath: no rebota, sale por el lado', () => {
  const g = gridFrom(['11111', '2222.', '33333']);
  // muy inclinado a la derecha: sale por el lado antes de llegar a las burbujas
  const { cells, points } = rocketPath(g, { x: 50, y: 200 }, 0.2, R, 100, -20);
  assert.equal(cells.length, 0);
  assert.equal(Math.round(points[1].x), 110);
});

test('rocketPath: no rompe nada por encima de topY', () => {
  const g = gridFrom(['11111', '2222.', '33333', '4444.', '55555']);
  // topY por debajo de la fila 0 (y = 10) y por encima de la 2 (y ≈ 44.6)
  const { cells } = rocketPath(g, { x: 50, y: 200 }, Math.PI / 2, R, 100, 30);
  assert.deepEqual([...new Set(cells.map((c) => c.row))], [4, 3, 2]);
});

test('fireRocket: rompe su recorrido y suelta lo que queda colgando', () => {
  // una columna colgando de la fila 0: al romper la (0,0) cae todo lo de debajo
  const g = gridFrom(['1....', '2....', '3....']);
  const { popped, dropped } = fireRocket(g, [{ row: 0, col: 0, dist: 0 }]);
  assert.deepEqual(popped.map((b) => `${b.row},${b.col}`), ['0,0']);
  assert.deepEqual(sorted(dropped.map((b) => [b.row, b.col])), sorted([[1, 0], [2, 0]]));
  assert.ok(isEmpty(g));
});

// ── Bolas especiales guardadas ───────────────────────────────────────────

test('addSpecial: suma una al contador sin tocar el inventario original', () => {
  const inv = {};
  assert.deepEqual(addSpecial(inv, ROCKET), { rocket: 1 });
  assert.deepEqual(addSpecial({ rocket: 2 }, ROCKET), { rocket: 3 });
  assert.deepEqual(inv, {});
});

test('addSpecial: no pasa de SPECIALS_MAX', () => {
  assert.equal(SPECIALS_MAX, 5);
  assert.deepEqual(addSpecial({ mine: 4 }, MINE), { mine: 5 });
  assert.deepEqual(addSpecial({ mine: 5 }, MINE), { mine: 5 });
});

test('useSpecial: gasta una si queda y no deja bajar de 0', () => {
  assert.deepEqual(useSpecial({ rocket: 2 }, ROCKET), { inv: { rocket: 1 }, ok: true });
  assert.deepEqual(useSpecial({ rocket: 0 }, ROCKET), { inv: { rocket: 0 }, ok: false });
  assert.deepEqual(useSpecial({}, ROCKET), { inv: {}, ok: false });
});

test('toggleArmed: arma si queda alguna, desarma si ya estaba armada', () => {
  assert.equal(toggleArmed(null, { rocket: 1 }, ROCKET), ROCKET);
  assert.equal(toggleArmed(ROCKET, { rocket: 1 }, ROCKET), null);
  assert.equal(toggleArmed(null, { rocket: 0 }, ROCKET), null);
  assert.equal(toggleArmed(null, {}, ROCKET), null);
});

test('normalizeSpecials: guarda solo contadores válidos de especiales conocidas', () => {
  assert.deepEqual(normalizeSpecials({ rocket: 3 }), { rocket: 3 });
  assert.deepEqual(normalizeSpecials({ rocket: 0 }), {});
  assert.deepEqual(normalizeSpecials({ rocket: -2, laser: 5 }), {});
  assert.deepEqual(normalizeSpecials({ rocket: 1.5 }), {});
  assert.deepEqual(normalizeSpecials(null), {});
  assert.deepEqual(normalizeSpecials('rocket'), {});
});

test('normalizeSpecials: recorta los inventarios guardados antes del máximo', () => {
  assert.deepEqual(normalizeSpecials({ rocket: 312, mine: 140, rainbow: 2 }), { rocket: 5, mine: 5, rainbow: 2 });
});

// ── Supercohete ──────────────────────────────────────────────────────────

test('chargeRocket: sube con cada disparo que explota, vuelve a 0 al fallar', () => {
  assert.deepEqual(chargeRocket(0, 3), { charge: 1, full: false });
  assert.deepEqual(chargeRocket(4, 5), { charge: 5, full: false });
  assert.deepEqual(chargeRocket(7, 0), { charge: 0, full: false }, 'un fallo la vacía');
});

test('chargeRocket: al llenarse da un supercohete y empieza de nuevo', () => {
  assert.equal(SUPER_CHARGE, 20);
  let charge = 0;
  const fulls = [];
  for (let i = 1; i <= 40; i++) {
    const res = chargeRocket(charge, 3);
    charge = res.charge;
    if (res.full) fulls.push(i);
  }
  assert.deepEqual(fulls, [20, 40]);
  assert.equal(charge, 0);
});

test('chargeRocket: con un supercohete guardado la carga no se mueve, ni al acertar ni al fallar', () => {
  assert.deepEqual(chargeRocket(0, 4, { holding: true }), { charge: 0, full: false });
  assert.deepEqual(chargeRocket(0, 0, { holding: true }), { charge: 0, full: false });
  assert.deepEqual(chargeRocket(9, 4, { holding: true }), { charge: 9, full: false }, 'no da otro');
});

test('addSpecial: del supercohete solo se guarda uno', () => {
  assert.equal(specialMax(SUPER_ROCKET), 1);
  assert.deepEqual(addSpecial({}, SUPER_ROCKET), { superRocket: 1 });
  assert.deepEqual(addSpecial({ superRocket: 1 }, SUPER_ROCKET), { superRocket: 1 });
  assert.deepEqual(normalizeSpecials({ superRocket: 4 }), { superRocket: 1 });
});

test('normalizeCharge: solo enteros entre 0 y SUPER_CHARGE - 1', () => {
  assert.equal(normalizeCharge(7), 7);
  assert.equal(normalizeCharge(0), 0);
  assert.equal(normalizeCharge(19), 19);
  assert.equal(normalizeCharge(20), 0);
  assert.equal(normalizeCharge(-1), 0);
  assert.equal(normalizeCharge('3'), 0);
  assert.equal(normalizeCharge(null), 0);
});

test('armRocket: con la mejora, el cohete sale como supercohete', () => {
  assert.equal(armRocket(null, { rocket: 2 }), ROCKET);
  assert.equal(armRocket(null, { rocket: 2, superRocket: 1 }), SUPER_ROCKET);
  assert.equal(armRocket(MINE, { rocket: 1, superRocket: 1 }), SUPER_ROCKET, 'cambia la mina por el cohete');
});

test('armRocket: sin cohetes no carga nada, aunque se tenga la mejora', () => {
  assert.equal(armRocket(null, { superRocket: 1 }), null);
  assert.equal(armRocket(MINE, { superRocket: 1 }), MINE);
});

test('armRocket: si ya hay un cohete cargado, lo descarga', () => {
  assert.equal(armRocket(ROCKET, { rocket: 1 }), null);
  assert.equal(armRocket(SUPER_ROCKET, { rocket: 1, superRocket: 1 }), null);
});

test('loseSuper: quita la mejora y deja lo demás', () => {
  const inv = { rocket: 2, mine: 1, superRocket: 1 };
  assert.deepEqual(loseSuper(inv), { rocket: 2, mine: 1 });
  assert.deepEqual(inv, { rocket: 2, mine: 1, superRocket: 1 }, 'sin tocar el original');
  assert.deepEqual(loseSuper({ rocket: 1 }), { rocket: 1 });
});

test('normalizeSpecials: también guarda supercohetes', () => {
  assert.deepEqual(normalizeSpecials({ superRocket: 1 }), { superRocket: 1 });
});

// ── Mina ─────────────────────────────────────────────────────────────────

test('cellsWithin: radio 0 es la casilla, radio 1 sus vecinas, radio 2 una corona más', () => {
  const g = createGrid(9, 9);
  assert.equal(cellsWithin(g, 4, 4, 0).length, 1);
  assert.equal(cellsWithin(g, 4, 4, 1).length, 7);
  assert.equal(cellsWithin(g, 4, 4, 2).length, 19);
  // en una esquina no se sale del tablero
  assert.ok(cellsWithin(g, 0, 0, 2).every(([r, c]) => r >= 0 && c >= 0));
});

test('placeMine: rompe todo a 2 casillas, sea del color que sea, y suelta lo colgado', () => {
  const g = gridFrom(['1234512345', '543215432.', '1234512345', '5........'], 10, 8);
  // la mina acaba en (3, 4), vacía; a 2 casillas llega hasta la fila 1
  const { popped, dropped } = placeMine(g, 3, 4);
  const near = sorted(cellsWithin(createGrid(10, 8), 3, 4, 2).filter(([r, c]) => r <= 2 || (r === 3 && c === 0)));
  assert.ok(popped.length > 0);
  for (const b of popped) assert.ok(near.includes(`${b.row},${b.col}`), `${b.row},${b.col} está a más de 2`);
  assert.equal(g.cells[2][4], null);
  assert.equal(g.cells[1][4], null);
  assert.notEqual(g.cells[0][0], null, 'lo lejano sigue');
  assert.ok(Array.isArray(dropped));
});

test('placeMine: lo que deja sin techo, cae', () => {
  // columna colgando: la mina rompe el enganche y cae lo de debajo, fuera de su alcance
  const g = gridFrom(['1.........', '2.........', '3.........', '4.........', '5.........', '6.........'], 10, 8);
  const { popped, dropped } = placeMine(g, 0, 1);
  // (0, 0) y (1, 0) están a 1 paso; (2, 0), a 2
  assert.deepEqual(sorted(popped.map((b) => [b.row, b.col])), sorted([[0, 0], [1, 0], [2, 0]]));
  assert.deepEqual(sorted(dropped.map((b) => [b.row, b.col])), sorted([[3, 0], [4, 0], [5, 0]]));
  assert.ok(isEmpty(g));
});

// ── Perla arcoíris ───────────────────────────────────────────────────────

test('rainbowColor: toma el color del grupo más grande que toca', () => {
  // en (1, 1) toca un 2 suelto y un grupo de tres 3
  const g = gridFrom(['2333.', '.....']);
  assert.equal(rainbowColor(g, 1, 1), 3);
  assert.equal(rainbowColor(createGrid(5, 5), 2, 2), null);
});

test('rainbowColor: si empatan, el de menor número', () => {
  const g = gridFrom(['44.11', '.....']);
  // (0, 2) toca un grupo de dos 4 y otro de dos 1
  assert.equal(rainbowColor(g, 0, 2), 1);
});

test('placeRainbow: se une al grupo y lo explota', () => {
  // (1, 0) está en fila desplazada: toca (0, 0) y (0, 1), los dos 2
  const g = gridFrom(['2233.', '.....']);
  const res = placeRainbow(g, 1, 0, 0);
  assert.equal(res.color, 2);
  assert.equal(res.popped.length, 3);
});

test('placeRainbow: sin vecinas usa el color de reserva', () => {
  const g = createGrid(5, 5);
  const res = placeRainbow(g, 0, 2, 4);
  assert.equal(res.color, 4);
  assert.equal(g.cells[0][2], 4);
});

// ── Premios ──────────────────────────────────────────────────────────────

test('earnedSpecials: cohete por racha de 6, mina al explotar 5 o más, arcoíris si caen 10 o más', () => {
  assert.deepEqual(earnedSpecials(0, 0, 0), [], 'un disparo que no explota nada no da nada');
  assert.deepEqual(earnedSpecials(1, 3, 0), [], 'un grupo de 3 ya no da mina');
  assert.deepEqual(earnedSpecials(3, 3, 0), [], 'una racha de 3 ya no da cohete');
  assert.deepEqual(earnedSpecials(1, 5, 0), [MINE], 'explotar 5 de golpe da una mina');
  assert.deepEqual(earnedSpecials(1, 3, 9), [], 'que caigan 9 no basta');
  assert.deepEqual(earnedSpecials(1, 3, 10), [RAINBOW]);
  assert.deepEqual(earnedSpecials(6, 3, 0), [ROCKET]);
  assert.deepEqual(earnedSpecials(12, 7, 12), [ROCKET, MINE, RAINBOW]);
});

test('earnedSpecials: con la carga llena, el cohete es un supercohete', () => {
  assert.deepEqual(earnedSpecials(4, 3, 0, true), [SUPER_ROCKET], 'sin racha de cohete, también');
  assert.deepEqual(earnedSpecials(12, 5, 0, true), [SUPER_ROCKET, MINE], 'no da además un cohete normal');
});

test('normalizeSpecials: también guarda minas y perlas arcoíris', () => {
  assert.deepEqual(normalizeSpecials({ rocket: 1, mine: 2, rainbow: 3, laser: 1 }), { rocket: 1, mine: 2, rainbow: 3 });
});

// ── Anclas del mapa ──────────────────────────────────────────────────────

/** Como gridFrom, pero las letras A…H son anclas que apuntan en la dirección 0…7 (A arriba, C derecha, E abajo, G izquierda). */
function gridWithAnchors(rows, cols = rows[0].length, totalRows = 10) {
  const g = createGrid(cols, totalRows);
  rows.forEach((line, r) => [...line].forEach((ch, c) => {
    if (ch === '.') g.cells[r][c] = null;
    else if (ch >= 'A' && ch <= 'H') g.cells[r][c] = anchorValue(ch.charCodeAt(0) - 65);
    else g.cells[r][c] = Number(ch);
  }));
  return g;
}

test('anchorRay: una sola dirección, sin incluir la contraria', () => {
  const g = createGrid(5, 5);
  // arriba desde (4, 2): la vertical, con las dos casillas de cada lado en las filas desplazadas
  assert.deepEqual(sorted(anchorRay(g, 4, 2, 0)), sorted([[3, 1], [3, 2], [2, 2], [1, 1], [1, 2], [0, 2]]));
  // abajo desde (0, 2): lo mismo hacia abajo, nada de arriba
  assert.ok(anchorRay(g, 0, 2, 4).every(([r]) => r > 0));
  // derecha desde (2, 1)
  assert.deepEqual(anchorRay(g, 2, 1, 2), [[2, 2], [2, 3], [2, 4]]);
  // izquierda desde (2, 3)
  assert.deepEqual(anchorRay(g, 2, 3, 6), [[2, 2], [2, 1], [2, 0]]);
  // oblicua arriba-derecha desde (4, 2), siguiendo la diagonal hexagonal
  assert.deepEqual(anchorRay(g, 4, 2, 1), [[3, 2], [2, 3], [1, 3], [0, 4]]);
  // oblicua abajo-izquierda desde (0, 2)
  assert.deepEqual(anchorRay(g, 0, 2, 5), [[1, 1], [2, 1], [3, 0], [4, 0]]);
});

test('placeBubble: tocar un ancla rompe solo hacia donde apunta', () => {
  // ancla en (2, 2) apuntando a la derecha (C); la bola acaba en (3, 1), vecina del ancla
  const g = gridWithAnchors(['12345', '5432.', '13C24', '.....']);
  const res = placeBubble(g, 3, 1, 0);
  assert.deepEqual(sorted(res.popped.map((b) => [b.row, b.col])), sorted([[2, 2], [2, 3], [2, 4]]));
  assert.deepEqual(res.anchors, [[2, 2, 2]]);
  assert.equal(g.cells[2][1], 3, 'lo de detrás de la flecha sigue');
  assert.equal(g.cells[0][2], 3, 'lo de arriba sigue');
});

test('placeBubble: sin tocar ningún ancla, todo como siempre', () => {
  const g = gridWithAnchors(['12345', '5432.', '13C24', '.....']);
  const res = placeBubble(g, 3, 3, 0);
  assert.deepEqual(res.popped, []);
  assert.ok(isAnchor(g.cells[2][2]));
});

test('anclas: solo rompen la parte que se ve', () => {
  // ancla en (4, 2) apuntando arriba (A); solo se ven las filas 2 a 5
  const g = gridWithAnchors(['11111', '2222.', '33333', '4444.', '55A55', '.....']);
  const res = placeBubble(g, 5, 1, 0, { visible: { from: 2, to: 5 } });
  const rows = res.popped.map((b) => b.row);
  assert.ok(rows.includes(2) && rows.includes(3), 'rompe lo que se ve');
  assert.ok(!rows.includes(0) && !rows.includes(1), 'no rompe lo que está por encima de la pantalla');
});

test('anchorBlast: un ancla rompe a otra y salta hacia donde apunta la segunda', () => {
  // (2, 0) apunta a la derecha y alcanza (2, 3), que apunta arriba
  const g = gridWithAnchors(['12345', '5432.', 'C21A1', '.....']);
  const { cells, anchors } = anchorBlast(g, [[2, 0]]);
  assert.deepEqual(anchors.map(([r, c]) => [r, c]), [[2, 0], [2, 3]]);
  assert.ok(cells.some(([r, c]) => r === 0 && c === 3), 'la segunda rompe hacia arriba');
});

test('rotateAnchors: cada flecha gira un paso en el sentido del reloj', () => {
  const g = gridWithAnchors(['AH1..', '.....']);
  rotateAnchors(g);
  assert.equal(anchorDir(g.cells[0][0]), 1);
  assert.equal(anchorDir(g.cells[0][1]), 0, 'después de arriba-izquierda vuelve a arriba');
  assert.equal(g.cells[0][2], 1, 'las perlas no cambian');
});

test('visibleRows: filas cuyo centro está en pantalla', () => {
  // R = 10: la fila r está en y = 10 + 17.3·r
  assert.deepEqual(visibleRows(0, 100, R), { from: 0, to: 5 });
  assert.deepEqual(visibleRows(40, 100, R), { from: 2, to: 7 });
});

test('anclas: no cuentan como color ni para la arcoíris', () => {
  const g = gridWithAnchors(['AB1..', '.....']);
  assert.deepEqual(colorsOnBoard(g), [1]);
  assert.equal(rainbowColor(g, 1, 0), null, 'en (1, 0) solo toca anclas');
});

test('fireRocket y placeMine: si rompen un ancla, salta hacia donde apunta', () => {
  const g = gridWithAnchors(['12345', '5432.', '13A24', '.....']);
  const res = fireRocket(g, [{ row: 2, col: 2, dist: 0 }]);
  assert.deepEqual(res.anchors, [[2, 2, 0]]);
  assert.equal(g.cells[0][2], null, 'el ancla apuntaba arriba');
  const m = gridWithAnchors(['12345', '5432.', '13A24', '.....']);
  const mine = placeMine(m, 3, 2); // (2, 2) está a un paso
  assert.ok(mine.anchors.length === 1 && m.cells[0][2] === null);
});

// ── Burbujas bicolor y de dos golpes ─────────────────────────────────────

test('colorsOf: una perla vale por su color, una bicolor por los dos y las demás por ninguno', () => {
  assert.deepEqual(colorsOf(2), [2]);
  assert.deepEqual(colorsOf(bicolorValue(3, 1)), [1, 3]);
  assert.deepEqual(colorsOf(shellValue(4)), [], 'tapada no se ve su color');
  assert.deepEqual(colorsOf(anchorValue(0)), []);
});

test('bicolor: explota con una bola de cualquiera de sus dos colores', () => {
  for (const color of [1, 3]) {
    const g = createGrid(5, 8);
    g.cells[0][0] = bicolorValue(1, 3);
    g.cells[0][1] = color;
    const res = placeBubble(g, 1, 0, color);
    assert.equal(res.popped.length, 3, `con el color ${color}`);
  }
});

test('bicolor: no une un grupo de un color con uno del otro', () => {
  const g = createGrid(5, 8);
  g.cells[0][0] = 1;
  g.cells[0][1] = bicolorValue(1, 3);
  g.cells[0][2] = 3;
  g.cells[0][3] = 3;
  const res = placeBubble(g, 1, 0, 1);
  assert.deepEqual(sorted(res.popped.map((b) => [b.row, b.col])), sorted([[0, 0], [0, 1], [1, 0]]));
  assert.equal(g.cells[0][2], 3);
  assert.equal(g.cells[0][3], 3);
  assert.equal(matchPreview(g, 1, 3, 1).cells.length, 0, 'los verdes no cuentan para el rojo');
});

test('colorsOnBoard con filas: solo cuenta los colores de esas filas', () => {
  const g = gridFrom(['11...', '2....', '3....', '4....']);
  assert.deepEqual(colorsOnBoard(g, { from: 2, to: 3 }), [3, 4]);
  assert.deepEqual(colorsOnBoard(g, { from: 3, to: 99 }), [4], 'no se sale del tablero');
});

test('colorsInView: los colores de la pantalla, no los de la parte del mapa que no se ve', () => {
  // arriba hay rojas (1) que no se ven; en pantalla, filas 2 y 3, solo 3 y 4
  const g = gridFrom(['11...', '2....', '3....', '4....']);
  assert.deepEqual(colorsInView(g, { from: 2, to: 3 }), [3, 4]);
});

test('colorsInView: si en pantalla no queda ningún color, los de todo el tablero', () => {
  const g = gridFrom(['11...', '2....', '.....', '.....']);
  assert.deepEqual(colorsInView(g, { from: 2, to: 3 }), [1, 2]);
});

test('colorsOnBoard cuenta los dos colores de una bicolor y no el de una tapada', () => {
  const g = createGrid(5, 8);
  g.cells[0][0] = bicolorValue(0, 5);
  g.cells[0][1] = shellValue(2);
  assert.deepEqual(colorsOnBoard(g), [0, 5]);
});

test('de dos golpes: tapada no cuenta para el grupo y una bola pegada la destapa', () => {
  const g = createGrid(5, 8);
  g.cells[0][0] = shellValue(2);
  g.cells[0][1] = 2;
  const res = placeBubble(g, 1, 0, 2);
  assert.equal(res.popped.length, 0, 'la tapada no completa el grupo de 3');
  assert.deepEqual(res.uncovered, [{ row: 0, col: 0, color: 2 }]);
  assert.equal(g.cells[0][0], 2, 'ya muestra su color');
  // ahora sí cuenta: el siguiente rojo junto a las tres explota
  assert.equal(placeBubble(g, 1, 1, 2).popped.length, 4);
});

test('de dos golpes: una bola de cualquier color también la destapa', () => {
  const g = createGrid(5, 8);
  g.cells[0][0] = shellValue(2);
  const res = placeBubble(g, 1, 0, 5);
  assert.deepEqual(res.uncovered, [{ row: 0, col: 0, color: 2 }]);
});

test('de dos golpes: la destapa una explosión a su lado', () => {
  const g = createGrid(5, 8);
  g.cells[0][0] = shellValue(4);
  g.cells[0][1] = 2;
  g.cells[0][2] = 2;
  const res = placeBubble(g, 1, 2, 2); // no la toca: solo explota el grupo de al lado
  assert.equal(res.popped.length, 3);
  assert.deepEqual(res.uncovered, [{ row: 0, col: 0, color: 4 }]);
  assert.equal(g.cells[0][0], 4);
});

test('bubblesLeft cuenta todo lo que queda por romper: perlas, bicolores, tapadas y anclas', () => {
  const g = createGrid(5, 8);
  assert.equal(bubblesLeft(g), 0);
  g.cells[0][0] = 1;
  g.cells[0][1] = bicolorValue(0, 2);
  g.cells[0][2] = shellValue(3);
  g.cells[0][3] = anchorValue(2);
  assert.equal(bubblesLeft(g), 4);
});
