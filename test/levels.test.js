import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findFloating, colorsOnBoard, findCluster } from '../src/logic.js';
import { playLevel } from '../tools/bot.js';
import {
  BOARD,
  COLOR_KEYS,
  LEVELS,
  parseMap,
  bubbleCount,
  starsFor,
  shotsForStars,
  emptyProgress,
  normalizeProgress,
  recordWin,
  THEMES,
  LEVELS_PER_THEME,
  themeOf,
  themeProgress,
} from '../src/levels.js';

test('parseMap convierte letras en colores y puntos en huecos', () => {
  const g = parseMap(['ry.', 'b..'], 3, 4);
  assert.deepEqual(g.cells[0], [0, 2, null]);
  assert.deepEqual(g.cells[1], [4, null, null]);
  assert.deepEqual(g.cells[2], [null, null, null]);
});

test('parseMap deja filas libres debajo del mapa para los disparos', () => {
  const g = parseMap(['rrr', 'bbb'], 3);
  assert.equal(g.rows, 2 + BOARD.extraRows);
});

test('parseMap rechaza filas de otro ancho y letras desconocidas', () => {
  assert.throws(() => parseMap(['rr'], 3, 4));
  assert.throws(() => parseMap(['rxr'], 3, 4));
});

test('bubbleCount cuenta las burbujas de un mapa', () => {
  assert.equal(bubbleCount(['rr.', '.b.']), 3);
});

test('starsFor: 3 estrellas si sobra el 30 %, 2 si sobra el 10 %, si no 1', () => {
  assert.equal(starsFor(70, 100), 3);
  assert.equal(starsFor(71, 100), 2);
  assert.equal(starsFor(90, 100), 2);
  assert.equal(starsFor(91, 100), 1);
  assert.equal(starsFor(100, 100), 1);
});

test('shotsForStars coincide con starsFor', () => {
  for (const budget of [37, 100, 230]) {
    for (const stars of [1, 2, 3]) {
      const max = shotsForStars(stars, budget);
      assert.equal(starsFor(max, budget) >= stars, true);
      if (stars > 1) assert.ok(starsFor(max + 1, budget) < stars);
    }
  }
});

test('recordWin desbloquea el siguiente mapa y guarda la mejor marca', () => {
  let p = emptyProgress();
  assert.equal(p.unlocked, 1);
  p = recordWin(p, 0, 2, 10);
  assert.equal(p.unlocked, 2);
  assert.equal(p.stars[0], 2);
  p = recordWin(p, 0, 1, 10);
  assert.equal(p.stars[0], 2, 'una peor partida no baja las estrellas');
  assert.equal(p.unlocked, 2, 'repetir un mapa no desbloquea de más');
  p = recordWin(p, 9, 3, 10);
  assert.equal(p.unlocked, 10, 'no pasa del número de mapas');
});

test('normalizeProgress arregla datos guardados rotos', () => {
  assert.deepEqual(normalizeProgress(null, 10), emptyProgress());
  assert.deepEqual(normalizeProgress({ unlocked: 99, stars: [3, 'x', 7] }, 10), {
    unlocked: 10,
    stars: [3, 0, 3],
  });
  assert.equal(normalizeProgress({ unlocked: -3 }, 10).unlocked, 1);
});

test('hay 5 temáticas de 10 niveles, todos con nombre y límite de disparos', () => {
  assert.equal(THEMES.length, 5);
  assert.equal(LEVELS.length, 50);
  for (const theme of THEMES) {
    assert.ok(theme.name && theme.zone && theme.accent);
    assert.equal(theme.maps.length, LEVELS_PER_THEME);
    assert.equal(new Set(theme.names).size, LEVELS_PER_THEME, `${theme.name}: nombres repetidos`);
  }
  for (const level of LEVELS) {
    assert.ok(level.name);
    assert.ok(Number.isInteger(level.shots) && level.shots > 0);
  }
});

test('en cada temática la dificultad sube: los 3 últimos niveles piden más disparos que los 3 primeros', () => {
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const theme of THEMES) {
    const shots = theme.maps.map((m) => m.shots);
    assert.ok(avg(shots.slice(-3)) > avg(shots.slice(0, 3)), `${theme.name}: ${shots.join(' ')}`);
  }
});

test('hay niveles de solo 2 colores: uno en cada temática generada y dos al empezar la Tortuga', () => {
  const colorsIn = (level) => colorsOnBoard(parseMap(level.map)).length;
  const twoColor = LEVELS.filter((level) => colorsIn(level) === 2);
  assert.ok(twoColor.length >= 5, `solo ${twoColor.length} niveles de 2 colores`);
  assert.equal(colorsIn(LEVELS[0]), 2, 'el primer nivel es de 2 colores');
  for (const key of ['caballito', 'medusa', 'ballena']) {
    assert.ok(twoColor.some((level) => THEMES[level.theme].key === key), `${key} no tiene ningún nivel de 2 colores`);
  }
});

test('themeOf: 10 niveles por temática', () => {
  assert.deepEqual([0, 9, 10, 19, 49].map(themeOf), [0, 0, 1, 1, 4]);
  assert.equal(LEVELS[23].theme, 2);
  assert.equal(LEVELS[23].number, 4);
});

test('themeProgress: abierta, nivel que toca, estrellas y completada', () => {
  // ganados los 10 de la primera y 3 de la segunda
  let p = emptyProgress();
  for (let i = 0; i < 13; i++) p = recordWin(p, i, i % 3 === 0 ? 3 : 2, 50);
  const first = themeProgress(p, 0);
  assert.equal(first.completed, true);
  assert.equal(first.next, null);
  assert.equal(first.stars, 24);
  const second = themeProgress(p, 1);
  assert.equal(second.unlocked, true);
  assert.equal(second.completed, false);
  assert.equal(second.next, 3);
  assert.deepEqual(second.best.slice(0, 4), [2, 2, 3, 0]);
  const third = themeProgress(p, 2);
  assert.equal(third.unlocked, false);
  assert.equal(third.next, null);
  assert.equal(third.stars, 0);
});

test('themeProgress: al empezar solo está abierta la primera, en su nivel 1', () => {
  const p = emptyProgress();
  assert.deepEqual(
    THEMES.map((_, t) => themeProgress(p, t).unlocked),
    [true, false, false, false, false],
  );
  assert.equal(themeProgress(p, 0).next, 0);
});

/**
 * Racimos que caen con una sola bola: grupos de 2 o 3 del mismo color (que
 * explotan con una bola más) cuya desaparición suelta al menos 5 burbujas.
 */
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

for (const [i, level] of LEVELS.entries()) {
  test(`${THEMES[level.theme].name} ${level.number} (${level.name}) es grande, válido y se puede ganar`, () => {
    for (const row of level.map) {
      assert.equal(row.length, BOARD.cols, `fila «${row}» no mide ${BOARD.cols}`);
      for (const ch of row) assert.ok(ch === '.' || ch === 'v' || COLOR_KEYS.includes(ch), `letra desconocida «${ch}»`);
    }
    assert.ok(level.map.length >= 28, 'el mapa es pequeño');
    // Simétrico de izquierda a derecha, forma y colores. Las filas desplazadas
    // (2.ª, 4.ª…) tienen una bola menos para que el eje caiga en el centro.
    level.map.forEach((row, r) => {
      const used = r % 2 ? row.slice(0, -1) : row;
      if (r % 2) assert.equal(row.at(-1), '.', `fila ${r}: la última casilla de una fila desplazada va vacía`);
      assert.equal(used, [...used].reverse().join(''), `fila ${r} no es simétrica: «${row}»`);
    });
    const g = parseMap(level.map);
    assert.deepEqual(findFloating(g), [], 'hay burbujas sin enganchar al techo');
    assert.ok(colorsOnBoard(g).length >= 2, 'menos de 2 colores');
    assert.ok(oneShotBunches(level.map) >= 1, 'no hay ningún racimo que caiga con una sola bola');

    // Complejo: ningún grupo del mismo color pasa de 3 burbujas y, salvo en los
    // mapas marcados como más suaves, casi todos son de 1 o 2.
    let ofThree = 0;
    g.cells.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v == null) return;
        const size = findCluster(g, r, c).length;
        assert.ok(size <= 3, `grupo de ${size} en la fila ${r}`);
        if (size === 3) ofThree++;
      }),
    );
    if ((level.maxGroup ?? 2) < 3) assert.ok(ofThree / bubbleCount(level.map) < 0.05, 'demasiados grupos de 3');

    const run = playLevel(level, { seed: 1 });
    assert.ok(run.won, `el bot pierde (${run.reason})`);
    assert.ok(run.shots <= level.shots, `el bot necesita ${run.shots} disparos de ${level.shots}`);
  });
}
