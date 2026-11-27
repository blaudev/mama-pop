// Bot que juega un mapa con las mismas reglas que el juego (cámara incluida).
// Sirve para comprobar que los mapas se pueden ganar y para ajustar `shots`:
//
//   node tools/bot.js            → disparos que necesita el bot en cada mapa
//
// El bot es codicioso: en cada turno prueba muchos ángulos con la burbuja
// actual y con la siguiente, y elige la jugada que más burbujas quita.

import {
  placeBubble,
  simulateShot,
  colorsInView,
  colorsOf,
  isEmpty,
  neighbors,
  lowestOccupiedRow,
  bottomY,
  initialCamera,
  nextCamera,
  colorsToAvoid,
  chooseColor,
  reachableColors,
  visibleRows,
  rotateAnchors,
} from '../src/logic.js';
import { fileURLToPath } from 'node:url';
import { BOARD, LEVELS, parseMap } from '../src/levels.js';

export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cloneGrid = (g) => ({ ...g, cells: g.cells.map((row) => row.slice()) });

function evaluate(grid, cell, color, lowest, visible) {
  const g = cloneGrid(grid);
  const res = placeBubble(g, cell.row, cell.col, color, { visible });
  if (res.popped.length) return 100 + res.popped.length + res.dropped.length * 1.5;
  const same = neighbors(grid, cell.row, cell.col).filter(([r, c]) => colorsOf(grid.cells[r][c]).includes(color)).length;
  return same * 5 - Math.max(0, cell.row - lowest) * 4 - cell.row * 0.01;
}

export function playLevel(level, { seed = 1, angles = 80, maxShots = 2000 } = {}) {
  const { R } = BOARD;
  const grid = parseMap(level.map);
  const rand = mulberry32(seed);
  // Misma cola de colores que el juego (ver colorsToAvoid).
  let history = [];
  let cam = initialCamera(grid, R, BOARD.frontY, BOARD.blockPx);
  // y, como en el juego, casi siempre de un color que pueda explotar algo desde el lanzador
  const pick = (queue = []) => {
    const start = { x: BOARD.shooterX, y: BOARD.shooterY + cam };
    const useful = reachableColors(grid, start, R, BOARD.width, { minAngle: BOARD.minAngle });
    return chooseColor(colorsInView(grid, visibleRows(cam, BOARD.height, R)), colorsToAvoid(history, queue), rand, useful);
  };
  let current = pick();
  let next = pick([current]);
  let shots = 0;

  while (!isEmpty(grid)) {
    if (shots >= maxShots) return { won: false, shots, reason: 'demasiados disparos' };
    const start = { x: BOARD.shooterX, y: BOARD.shooterY + cam };
    const lowest = lowestOccupiedRow(grid);
    // las anclas solo rompen lo que se ve, como en el juego
    const visible = visibleRows(cam, BOARD.height, R);
    let best = null;
    for (const swapped of [false, true]) {
      const color = swapped ? next : current;
      for (let i = 0; i < angles; i++) {
        const angle = BOARD.minAngle + ((Math.PI - 2 * BOARD.minAngle) * i) / (angles - 1);
        const shot = simulateShot(grid, start, angle, R, BOARD.width);
        if (!shot.cell) continue;
        const score = evaluate(grid, shot.cell, color, lowest, visible);
        if (!best || score > best.score) best = { score, cell: shot.cell, swapped };
      }
    }
    if (best.swapped) [current, next] = [next, current];
    const res = placeBubble(grid, best.cell.row, best.cell.col, current, { visible });
    rotateAnchors(grid); // tras cada disparo las flechas giran, como en el juego
    history = [...history.slice(-3), { color: current, popped: res.popped.length > 0 }];
    shots++;
    if (isEmpty(grid)) break;
    if (bottomY(grid, R) - cam > BOARD.deathY) return { won: false, shots, reason: 'línea' };
    cam = nextCamera(cam, grid, R, BOARD.frontY, BOARD.blockPx);
    const cs = colorsInView(grid, visibleRows(cam, BOARD.height, R));
    const fired = current;
    const avoid = colorsToAvoid(history);
    const canAvoid = cs.some((c) => !avoid.includes(c));
    current = cs.includes(next) && !(canAvoid && avoid.includes(next)) ? next : pick();
    next = pick([fired, current]);
  }
  return { won: true, shots };
}

// Ejecutado directamente: estadísticas por mapa.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const seeds = Number(process.argv[2] || 8);
  for (const level of LEVELS) {
    const runs = Array.from({ length: seeds }, (_, i) => playLevel(level, { seed: i + 1 }));
    const won = runs.filter((r) => r.won).map((r) => r.shots).sort((a, b) => a - b);
    const median = won[Math.floor(won.length / 2)];
    console.log(
      `${level.name.padEnd(10)} ganadas ${won.length}/${seeds}  disparos min ${won[0]} mediana ${median} max ${won.at(-1)}  límite ${level.shots}`,
    );
  }
}
