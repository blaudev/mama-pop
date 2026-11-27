import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findFloating, colorsOnBoard, findCluster, bicolorValue, shellValue, isBicolor, isShell } from '../src/logic.js';
import { playLevel } from '../tools/bot.js';
import { singlesRatio, MAX_SINGLES, MIN_ROWS } from '../tools/generate-maps.js';
import {
  BOARD,
  COLOR_KEYS,
  BICOLOR_KEYS,
  SHELL_KEYS,
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
  isDevHost,
} from '../src/levels.js';

test('parseMap convierte letras en colores y puntos en huecos', () => {
  const g = parseMap(['ry.', 'b..'], 3, 4);
  assert.deepEqual(g.cells[0], [0, 2, null]);
  assert.deepEqual(g.cells[1], [4, null, null]);
  assert.deepEqual(g.cells[2], [null, null, null]);
});

test('parseMap lee las bicolores (una letra por pareja de colores) y las de dos golpes (en mayúscula)', () => {
  assert.equal(BICOLOR_KEYS.length, 15);
  const g = parseMap([`${BICOLOR_KEYS[0]}${BICOLOR_KEYS[14]}R`, 'P..'], 3, 4);
  assert.deepEqual(g.cells[0], [bicolorValue(0, 1), bicolorValue(4, 5), shellValue(0)]);
  assert.deepEqual(g.cells[1], [shellValue(5), null, null]);
});

test('bicolores y de dos golpes: ninguna en los niveles 1 y 2, y de las dos del 3 al 10, unas cuantas', () => {
  for (const theme of THEMES) {
    theme.maps.forEach((level, i) => {
      const cells = parseMap(level.map).cells.flat();
      const bicolors = cells.filter(isBicolor).length;
      const shells = cells.filter(isShell).length;
      const where = `${theme.name} ${i + 1}`;
      if (i < 2) assert.equal(bicolors + shells, 0, where);
      else {
        assert.ok(bicolors >= 4 && shells >= 4, `${where}: ${bicolors} bicolores, ${shells} de dos golpes`);
        // al menos 5 de cada 100 burbujas, entre las dos
        assert.ok((bicolors + shells) / bubbleCount(level.map) >= 0.05, `${where}: pocas especiales`);
      }
    });
  }
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

test('normalizeProgress: quien lo tenía todo ganado puede seguir con las temáticas nuevas', () => {
  // Así quedó guardado al ganar los 50 niveles cuando solo había 5 temáticas:
  // `unlocked` no podía pasar de 50.
  const saved = { unlocked: 50, stars: Array(50).fill(3) };
  const p = normalizeProgress(saved, 120);
  assert.equal(p.unlocked, 51);
  assert.equal(themeProgress(p, 5).unlocked, true);
  assert.equal(themeProgress(p, 5).next, 0);
  // sin estrellas de más no se abre nada
  assert.equal(normalizeProgress({ unlocked: 3, stars: [3, 2] }, 120).unlocked, 3);
});

test('hay 12 temáticas de 10 niveles, todos con nombre y límite de disparos', () => {
  assert.equal(THEMES.length, 12);
  assert.equal(LEVELS.length, 120);
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

test('hay mapas de largos distintos: en cada temática, el más largo tiene al menos un 50 % más de filas que el más corto', () => {
  for (const theme of THEMES) {
    const rows = theme.maps.map((m) => m.map.length);
    assert.ok(Math.max(...rows) >= 1.5 * Math.min(...rows), `${theme.name}: ${rows.join(' ')}`);
  }
});

test('en cada temática los colores suben: 2, 3, 4 y 5 en los cuatro primeros niveles y los 6 del 5.º al 10.º', () => {
  const colorsIn = (level) => colorsOnBoard(parseMap(level.map)).length;
  for (const theme of THEMES) {
    assert.deepEqual(theme.maps.map(colorsIn), [2, 3, 4, 5, 6, 6, 6, 6, 6, 6], theme.name);
  }
});

test('themeProgress: solo se puede entrar en los niveles ganados y en el que toca', () => {
  const p = recordWin(emptyProgress(), 0, 3, LEVELS.length);
  assert.deepEqual(themeProgress(p, 0).open, [true, true, false, false, false, false, false, false, false, false]);
  assert.equal(themeProgress(p, 1).open.some(Boolean), false);
});

test('themeProgress con allOpen (en desarrollo): todas las temáticas y todos los niveles abiertos', () => {
  for (let t = 0; t < THEMES.length; t++) {
    const tp = themeProgress(emptyProgress(), t, { allOpen: true });
    assert.equal(tp.unlocked, true);
    assert.deepEqual(tp.open, Array(LEVELS_PER_THEME).fill(true));
  }
});

test('isDevHost: el ordenador y la red de casa son desarrollo; lo publicado, no', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]', '192.168.1.131', '10.0.0.5', '172.16.3.4', 'mac-de-dani.local']) {
    assert.equal(isDevHost(host), true, host);
  }
  for (const host of ['blaudev.github.io', 'mamapop.es', '172.32.0.1', '8.8.8.8']) {
    assert.equal(isDevHost(host), false, host);
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
    THEMES.map((_, t) => t === 0),
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
      for (const ch of row) assert.ok(ch === '.' || ch === 'v' || (COLOR_KEYS + BICOLOR_KEYS + SHELL_KEYS).includes(ch), `letra desconocida «${ch}»`);
    }
    assert.ok(level.map.length >= MIN_ROWS, 'el mapa es pequeño');
    // casi todas las perlas tienen pareja: las sueltas frustran
    const singles = singlesRatio(level.map);
    assert.ok(singles <= MAX_SINGLES.to, `${Math.round(singles * 100)} % de perlas sin pareja`);
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
    // justo: no sobran muchos más disparos de los que necesita el bot en una
    // partida normal (la mediana de 3, porque una sola puede salir con suerte)
    const median = [run.shots, playLevel(level, { seed: 2 }).shots, playLevel(level, { seed: 3 }).shots].sort((a, b) => a - b)[1];
    const roomy = Math.max(Math.ceil(median * 1.5), median + 10);
    assert.ok(level.shots <= roomy, `límite ${level.shots} para ${median} disparos del bot: sobran demasiados`);
  });
}
