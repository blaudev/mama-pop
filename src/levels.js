// Mapas del juego y progreso del jugador. Sin DOM: se prueba con `node --test`.
//
// Cada mapa es una lista de filas de 10 caracteres (la fila 0 es el techo):
//   r rojo · o naranja · y amarillo · g verde · b azul · p morado · . hueco
//   v ancla · R O Y G B P de dos golpes (tapada, de ese color) · a c d e f h i
//   j k l m n q s t bicolores (ver BICOLOR_KEYS)
// La 2.ª, 4.ª, 6.ª… fila se dibujan desplazadas media burbuja a la
// derecha; por eso suelen dejar libre la última columna, para quedar centradas.

import { createGrid, anchorValue, bicolorValue, shellValue } from './logic.js';
import { GENERATED_MAPS } from './maps.js';

export const BOARD = {
  cols: 10,
  R: 18, // radio de una burbuja
  width: 10 * 36 + 18, // 378
  height: 680,
  shooterY: 586, // punto más alto del lanzador; el aro queda debajo
  deathY: 500, // si una burbuja baja de aquí (en pantalla), se pierde
  frontY: 330, // a esta altura queda el borde inferior del mapa tras cada bajada
  // Las bolas especiales van en una columna a la izquierda del lanzador,
  // centrada aquí (lo usa styles.css: .specials).
  specialsX: 46,
  specialsY: 590,
  blockRows: 3, // el mapa baja de 3 en 3 filas
  extraRows: 12, // filas libres bajo el mapa donde pueden acabar los disparos
  minAngle: 0.13,
};
BOARD.shooterX = BOARD.width / 2;
BOARD.blockPx = BOARD.blockRows * BOARD.R * Math.sqrt(3);

export const COLOR_KEYS = 'roygbp';
/** Letras de las burbujas de dos golpes: la de su color, en mayúscula. */
export const SHELL_KEYS = COLOR_KEYS.toUpperCase();
/**
 * Letras de las bicolores, una por pareja de colores, por orden: rojo-naranja,
 * rojo-amarillo, rojo-verde, rojo-azul, rojo-morado, naranja-amarillo… azul-morado.
 */
export const BICOLOR_KEYS = 'acdefhijklmnqst';
export const BICOLOR_PAIRS = COLOR_KEYS.split('').flatMap((_, a) =>
  COLOR_KEYS.split('').slice(a + 1).map((__, i) => [a, a + 1 + i]),
);
/** Letra de un ancla en los mapas: al tocarla rompe lo que hay hacia donde apunta su flecha. */
export const ANCHOR_KEY = 'v';

/**
 * Pone anclas en un mapa: en la casilla central de una fila desplazada cada
 * `every` filas, empezando por la `start` (solo donde ya hay una burbuja, que
 * pasa a ser el ancla). La casilla central es su propio reflejo, así que el
 * mapa sigue siendo simétrico y nada se queda sin enganchar.
 */
export function addAnchors(map, { start = 5, every = 10 } = {}) {
  const out = map.slice();
  for (let r = start; r < out.length; r += every) {
    const row = r % 2 ? r : r + 1;
    if (row >= out.length) break;
    const line = out[row];
    if (COLOR_KEYS.includes(line[4])) out[row] = line.slice(0, 4) + ANCHOR_KEY + line.slice(5);
  }
  return out;
}

// Formas de los mapas del arrecife (la temática del pulpo), hechas a mano.
// Aquí solo cuenta qué casillas tienen burbuja: tools/generate-maps.js las
// vuelve a pintar con los colores que tocan a cada nivel, les pone el límite de
// disparos con el bot y las guarda en src/maps.js, como las demás temáticas.
const REEF_MAPS = [
  {
    name: 'Torres',
    map: [
      'gggryyrggg',
      'yyrryrryy.',
      'yg..gg..gy',
      'rr.rgr.rr.',
      'ry..bb..yr',
      'br.rrr.rb.',
      'rr..gg..rr',
      'yb..b..by.',
      'yb..bb..by',
      'bg.rrr.gb.',
      'ry..bb..yr',
      'gg.....gg.',
      'bbbgyygbbb',
      'gy.gyg.yg.',
      'gy..bb..yg',
      'bg.yby.gb.',
      'bb..rr..bb',
      'yy..y..yy.',
      'yr..yy..ry',
      'gb.bbb.bg.',
      'gb..yy..bg',
      'bg.....gb.',
      'yg..rr..gy',
      'gy.gyg.yg.',
      'rbbgyygbbr',
      'yr.gbg.ry.',
      'yr..yy..ry',
      'gg.rbr.gg.',
      'gy..bb..yg',
      'yy.grg.yy.',
    ],
  },
  {
    name: 'Rombos',
    map: [
      'bpprbbrppb',
      'oryogoyro.',
      '.ryoyyoyr.',
      'bpprgrppb.',
      '.yygppgyy.',
      '.bg.r.gb..',
      '..b.gg.b..',
      '....p.....',
      '....pp....',
      '...yby....',
      '....oo....',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
    ],
  },
  {
    name: 'Muralla',
    map: [
      'rrrybbyrrr',
      'ggygbgygg.',
      'grrgyygrrg',
      'r..ryr..r.',
      'gb.rggr.bg',
      'g..ryr..g.',
      'gyrgyygryg',
      'y...r...y.',
      'yg..rr..gy',
      'g..bbb..g.',
      'ry..yy..yr',
      'r.......r.',
      'rbygrrgybr',
      'b..gbg..b.',
      'by.gyyg.yb',
      'y...g...y.',
      'yr..gg..ry',
      'g..rrr..g.',
      'brr.yy.rrb',
      'y.......y.',
      'yy.yrry.yy',
      'r..yry..r.',
      'rr.yggy.rr',
      'y..rrr..y.',
      'yyrbggbryy',
      'r..rbr..r.',
      'rr.rbbr.rr',
      'g..ryr..g.',
    ],
  },
  {
    name: 'Embudo',
    map: [
      'ybbgrrgbby',
      'ygygpgygy.',
      'br..yy..rb',
      'rb..p..br.',
      'yb..gg..by',
      'rg..y..gr.',
      '.g..rr..g.',
      'pr..g..rp.',
      '.py.gg.yp.',
      'yg.ryr.gy.',
      '.pp.gg.pp.',
      'yb.....by.',
      '.rr....rr.',
      '.y.....y..',
      '.yg....gy.',
      '.gr...rg..',
      '.pb....bp.',
      '.pr...rp..',
      '..r....r..',
      '.yp...py..',
      '..r....r..',
      '.br...rb..',
      '..y....y..',
      '.y.....y..',
      '..p....p..',
      '..p...p...',
      '..gg..gg..',
      '..p...p...',
      '..pg..gp..',
      '..bp.pb...',
      '..br..rb..',
      '..yy.yy...',
      '...b..b...',
      '..bp.pb...',
      '...p..p...',
      '..yy.yy...',
      '...rggr...',
      '..rp.pr...',
      '...pbbp...',
      '...g.g....',
    ],
  },
  {
    name: 'Zigzag',
    map: [
      'orbryyrbro',
      'rorgrgror.',
      '.bb.yy.bb.',
      '.yo.g.oy..',
      '..bbyybb..',
      '.yr.r.ry..',
      '..goggog..',
      '.gy.r.yg..',
      '..y.rr.y..',
      '.g.yby.g..',
      '.gr.rr.rg.',
      'ro.....or.',
      'bb..oo..bb',
      'ry..b..yr.',
      '.ry.yy.yr.',
      '.gg.r.gg..',
      '..roggor..',
      '.rg.r.gr..',
      '..obggbo..',
      '.gr.r.rg..',
      '..rbyybr..',
      '.by.o.yb..',
      '.yb.bb.by.',
      'yg..y..gy.',
      'ob..oo..bo',
      'by..r..yb.',
      '.yg.gg.gy.',
      '.go.o.og..',
      '..o.oo.o..',
      '.g.ygy.g..',
      '..r.bb.r..',
      '.ro...or..',
      '..oyggyo..',
      '.bb.y.bb..',
      '.rr.rr.rr.',
      'yy..g..yy.',
      'bo..rr..ob',
      'yy..y..yy.',
      '.rr.rr.rr.',
      '.gb.y.bg..',
      '..rbggbr..',
      '.ro.b.or..',
      '..bboobb..',
      '.rr.b.rr..',
      '..boyyob..',
      '.go.g.og..',
      '.rr.bb.rr.',
      'oo..o..oo.',
      'by..yy..yb',
      'oo..o..oo.',
    ],
  },
  {
    name: 'Panal',
    map: [
      'bggybbyggb',
      'rrbygybrr.',
      'y.b.bb.b.y',
      'r.g.r.g.r.',
      'r.g.gg.g.r',
      'gybbybbyg.',
      '.b.grrg.b.',
      '.b..g..b..',
      '.g..gg..g.',
      '.b.yby.b..',
      'bry.gg.yrb',
      'y.y...y.y.',
      'y.g.gg.g.y',
      'r.b.y.b.r.',
      'y.b.rr.b.y',
      'yrrygyrry.',
      '.b.y..y.b.',
      '.y.r.r.y..',
      '.y.g..g.y.',
      '.g.y.y.g..',
      'gbbrbbrbbg',
      'g.r.y.r.g.',
      'y.y.yy.y.y',
      'y..rbr..y.',
      'g.r.yy.r.g',
      'grb...brg.',
      '.y.b..b.y.',
      '.y.y.y.y..',
      '.g.y..y.g.',
      '.g.g.g.g..',
      'bbrbrrbrbb',
      'y.g.y.g.y.',
      'y.g.bb.g.y',
      'r.r.r.r.r.',
      'r.r.yy.r.r',
      'bgbbrbbgb.',
      '.b.g..g.b.',
      '.g.g.g.g..',
      '.r.y..y.r.',
      '.r.g.g.r..',
    ],
  },
  {
    name: 'Raíces',
    map: [
      'oogyooygoo',
      'ygybgbygy.',
      '..rryyrr..',
      '.yo.g.oy..',
      '..ogrrgo..',
      '..gbybg...',
      '.yorooroy.',
      '.or.y.ro..',
      '.rb.yy.br.',
      '.b.bgb.b..',
      '.ry.yy.yr.',
      'ry.....yr.',
      'bo..oo..ob',
      'yy..y..yy.',
      'bb..bb..bb',
      'go.yry.og.',
      'gby.gg.ybg',
      'obooroobo.',
      '.yr.yy.ry.',
      '.og.r.go..',
      '.og.bb.go.',
      '.yo.g.oy..',
      '..gyrryg..',
      '..oygyo...',
      '.gygrrgyg.',
      '.gbbobbg..',
      '.rroyyorr.',
      '.bg.b.gb..',
      '.bg.bb.gb.',
      'rr.ogo.rr.',
      '.oo.yy.oo.',
      'br.....rb.',
      'or..rr..ro',
      'og.gbg.go.',
      'bbr.yy.rbb',
      'gg.grg.gg.',
      '.by.bb.yb.',
      'ob..g..bo.',
      '.yy.oo.yy.',
      '.rr.r.rr..',
      '..obyybo..',
      '.oy.g.yo..',
      '.gyobboyg.',
      '.goygyog..',
      '.rbboobbr.',
      '.og.g.go..',
      '.og.yy.go.',
      '.yy.g.yy..',
      '.gb.oo.bg.',
      'gb..y..bg.',
    ],
  },
  {
    name: 'Cuevas',
    map: [
      'byrbppbryb',
      'ygororogy.',
      'gbrobborbg',
      'grbrorbrg.',
      'pp.bppb.pp',
      'o..rgr..o.',
      'o...pp...o',
      'r...b...r.',
      'p...bb...p',
      'p..oro..p.',
      'oo..bb..oo',
      'gpo...opg.',
      'gbyo..oybg',
      'bobb.bbob.',
      'oporooropo',
      'b.byryb.b.',
      'y..bppb..y',
      '...gbg....',
      'o..gyyg..o',
      'g.prbrp.g.',
      'ryy.yy.yyr',
      'ro..p..or.',
      'pp......pp',
      'yy..r..yy.',
      'rrp.oo.prr',
      'b.pgpgp.b.',
      'b..oyyo..b',
      '...oro....',
      'b..ybby..b',
      'b.y.o.y.b.',
      'ppb.oo.bpp',
      'yg.pyp.gy.',
      'prg.gg.grp',
      'br.....rb.',
      'by......yb',
      'y.......y.',
      'gg......gg',
      'o.......o.',
      'ob......bo',
      'p.......p.',
      'y........y',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
    ],
  },
  {
    name: 'Fortaleza',
    map: [
      'oopyooypoo',
      'rgrgbgrgr.',
      'yy.gppg.yy',
      'r..yby..r.',
      'ry.yrry.yr',
      'y..o.o..y.',
      'op.oyyo.po',
      'p...b...p.',
      '.yp.bb.py.',
      'br.oyo.rb.',
      'r.r.bb.r.r',
      '.gg...gg..',
      'pb.ryyr.bp',
      'p..bob..p.',
      'oo.byyb.oo',
      'b..prp..b.',
      'rr.pggp.rr',
      'y..oyo..y.',
      'gpoprrpopg',
      'prboyobrp.',
      'ryorggroyr',
      'ygbyoybgy.',
      'pp.pggp.pp',
      'y..bpb..y.',
      'rg.boob.gr',
      'r..gbg..r.',
      'yo.gppg.oy',
      'y..ryr..y.',
      'roorggroor',
      'rgg.y.ggr.',
      'pbb.yy.bbp',
      'py.gpg.yp.',
      'yg..rr..gy',
      'g.......g.',
      'yo.gbbg.oy',
      'p..gog..p.',
      'pb.obbo.bp',
      'b..ogo..b.',
      'ooppyyppoo',
      '.ygo.ogy..',
      'bppbppbppb',
      'ggboyobgg.',
      'ro.orro.or',
      'p..gpg..p.',
      'pr.grrg.rp',
      'r..bgb..r.',
      'b..byyb..b',
      'r..ogo..r.',
      'ggyoyyoygg',
      'bbg.o.gbb.',
      'ppgpyypgpp',
      'rbprgrpbr.',
      'go.ryyr.og',
      'y..gbg..y.',
    ],
  },
  {
    name: 'Colmena',
    map: [
      'oogyrrygoo',
      'proyoyorp.',
      'p.roppor.p',
      '.oyy.yyo..',
      'gororrorog',
      'ry.yoy.yr.',
      'roy.pp.yor',
      'ob..r..bo.',
      'brr.rr.rrb',
      '.g.gyg.g..',
      '..p.oo.p..',
      '.pb...bp..',
      'oggobboggo',
      'op.ogo.po.',
      'pbb.rr.bbp',
      'gr.gyg.rg.',
      'pprgppgrpp',
      '.ypy.ypy..',
      '..yprrpy..',
      '.bbg.gbb..',
      'gyypbbpyyg',
      'gr.ryr.rg.',
      'rpp.oo.ppr',
      'rg.grg.gr.',
      'ygrboobrgy',
      '.oob.boo..',
      '..rprrpr..',
      '.bg.o.gb..',
      'ppo.oo.opp',
      'yr.gpg.ry.',
      'yrp.oo.pry',
      'py.....yp.',
      'prooppoorp',
      '.ggr.rgg..',
      '..bpoopb..',
      '.bpb.bpb..',
      'pyooppooyp',
      'by.gog.yb.',
      'goo.yy.oog',
      'yy.pgp.yy.',
      'bbpgyygpbb',
      '.opg.gpo..',
      '..boyyob..',
      '.bog.gob..',
      'brppyypprb',
      'br.ogo.rb.',
      'yyp.bb.pyy',
      'or.ror.ro.',
      'orbrggrbro',
      '.boy.yob..',
    ],
  },
];

// ── Temáticas ────────────────────────────────────────────────────────────
// Los mapas van en temáticas de animales de 10 niveles, de menos a más
// difíciles, y cada temática es más profunda (y difícil) que la anterior. Se
// juegan en orden: al acabar una temática empieza la siguiente.

export const LEVELS_PER_THEME = 10;

// Orden de las formas del arrecife, de las más sencillas a las más difíciles.
const REEF_ORDER = ['Torres', 'Embudo', 'Muralla', 'Rombos', 'Zigzag', 'Panal', 'Raíces', 'Cuevas', 'Colmena', 'Fortaleza'];
const reef = Object.fromEntries(REEF_MAPS.map((level) => [level.name, level]));
/** Formas del Pulpo, en el orden de sus niveles (las usa tools/generate-maps.js). */
export const REEF_SHAPES = REEF_ORDER.map((name) => reef[name].map);

/** `accent` colorea la interfaz de la temática; su escena de fondo está en game.js (SCENES). */
export const THEMES = [
  {
    key: 'tortuga',
    name: 'Tortuga',
    zone: 'Aguas poco profundas · 0–10 m',
    accent: '#7ff0b0',
    names: ['Nido', 'Arena', 'Primera ola', 'Caparazón', 'Algas', 'Corriente', 'Arrecife', 'Gaviotas', 'Mar abierto', 'Gran tortuga'],
    maps: GENERATED_MAPS.tortuga,
  },
  {
    key: 'pulpo',
    name: 'Pulpo',
    zone: 'Arrecife de coral · 10–30 m',
    accent: '#ff9e85',
    names: ['Coral', 'Cueva', 'Tinta', 'Ventosas', 'Camuflaje', 'Laberinto', 'Rocas', 'Anémonas', 'Ocho brazos', 'Gran pulpo'],
    maps: GENERATED_MAPS.pulpo,
  },
  {
    key: 'caballito',
    name: 'Caballito de mar',
    zone: 'Pradera de algas · 30–60 m',
    accent: '#ffd27a',
    names: ['Burbujas', 'Cola', 'Pradera', 'Remolino', 'Pareja', 'Corriente', 'Espesura', 'Marea', 'Bosque de algas', 'Gran caballito'],
    maps: GENERATED_MAPS.caballito,
  },
  {
    key: 'medusa',
    name: 'Medusa',
    zone: 'Mar abierto · 60–200 m',
    accent: '#d2b6ff',
    names: ['Destello', 'Deriva', 'Velo', 'Brillo', 'Picadura', 'Enjambre', 'Luna', 'Tormenta', 'Abismo azul', 'Gran medusa'],
    maps: GENERATED_MAPS.medusa,
  },
  {
    key: 'ballena',
    name: 'Ballena',
    zone: 'Gran profundidad · 200–1000 m',
    accent: '#8fd0ff',
    names: ['Canto', 'Krill', 'Chorro', 'Inmersión', 'Oscuridad', 'Sónar', 'Gigantes', 'Fosa', 'Silencio', 'Gran ballena'],
    maps: GENERATED_MAPS.ballena,
  },
  {
    key: 'payaso',
    name: 'Pez payaso',
    zone: 'Jardín de anémonas · mar tropical',
    accent: '#ffb070',
    names: ['Anémona', 'Naranja', 'Rayas', 'Escondite', 'Pececitos', 'Arrecife', 'Corales', 'Agua tibia', 'Jardín', 'Gran pez payaso'],
    maps: GENERATED_MAPS.payaso,
  },
  {
    key: 'cangrejo',
    name: 'Cangrejo',
    zone: 'Rocas de la orilla · mar tropical',
    accent: '#ff8a7e',
    names: ['Arena', 'Pinzas', 'De lado', 'Charco', 'Rocas', 'Marea baja', 'Concha', 'Espuma', 'Acantilado', 'Gran cangrejo'],
    maps: GENERATED_MAPS.cangrejo,
  },
  {
    key: 'globo',
    name: 'Pez globo',
    zone: 'Laguna de coral · mar tropical',
    accent: '#ffe07a',
    names: ['Hinchado', 'Pinchitos', 'Laguna', 'Lunares', 'Burbujón', 'Coral', 'Escondrijo', 'Remolino', 'Globo gigante', 'Gran pez globo'],
    maps: GENERATED_MAPS.globo,
  },
  {
    key: 'delfin',
    name: 'Delfín',
    zone: 'Olas de alta mar · mar abierto',
    accent: '#9fd0ff',
    names: ['Salto', 'Silbido', 'Ola', 'Manada', 'Estela', 'Piruetas', 'Juego', 'Alta mar', 'Horizonte', 'Gran delfín'],
    maps: GENERATED_MAPS.delfin,
  },
  {
    key: 'manta',
    name: 'Manta raya',
    zone: 'Canal de las mantas · mar abierto',
    accent: '#a9c4ff',
    names: ['Vuelo', 'Aletas', 'Deslizar', 'Canal', 'Sombra', 'Plancton', 'Planeo', 'Agua fría', 'Alas de mar', 'Gran manta'],
    maps: GENERATED_MAPS.manta,
  },
  {
    key: 'tiburon',
    name: 'Tiburón',
    zone: 'Barco hundido · mar abierto',
    accent: '#c4dced',
    names: ['Aleta', 'Casco', 'Proa', 'Dientes', 'Tesoro', 'Bodega', 'Mástil', 'Patrulla', 'Naufragio', 'Gran tiburón'],
    maps: GENERATED_MAPS.tiburon,
  },
  {
    key: 'rape',
    name: 'Pez abisal',
    zone: 'La fosa oscura · 1000–4000 m',
    accent: '#fff6a8',
    names: ['Farolillo', 'Penumbra', 'Destellos', 'Fosa', 'Chimenea', 'Presión', 'Luz propia', 'Negrura', 'Fondo del mar', 'Gran pez abisal'],
    maps: GENERATED_MAPS.rape,
  },
];

/** Todos los niveles seguidos (temática 1 nivel 1, …, temática 12 nivel 10), con su nombre y temática. */
export const LEVELS = THEMES.flatMap((theme, t) =>
  theme.maps.map((level, i) => ({ ...level, name: theme.names[i], theme: t, number: i + 1 })),
);

/** Temática (0…) a la que pertenece el nivel `index` de LEVELS. */
export function themeOf(index) {
  return Math.floor(index / LEVELS_PER_THEME);
}

/**
 * Cómo va una temática: si está abierta, si está completada, sus estrellas,
 * el nivel que toca (índice dentro de la temática, o null si ya está acabada)
 * y en qué niveles se puede entrar (`open`: los ganados y el que toca). Con
 * `allOpen` (en desarrollo, ver isDevHost) todo está abierto, sin tocar el
 * progreso guardado.
 */
export function themeProgress(progress, t, { allOpen = false } = {}) {
  const first = t * LEVELS_PER_THEME;
  const best = Array.from({ length: LEVELS_PER_THEME }, (_, i) => progress.stars[first + i] ?? 0);
  const completed = best[LEVELS_PER_THEME - 1] > 0;
  const reached = progress.unlocked > first;
  const next = !reached || completed ? null : Math.min(progress.unlocked - 1 - first, LEVELS_PER_THEME - 1);
  const open = best.map((stars, i) => allOpen || stars > 0 || next === i);
  return { unlocked: allOpen || reached, completed, best, stars: best.reduce((a, b) => a + b, 0), next, open };
}

/**
 * Si el juego se está probando en desarrollo: en el ordenador (localhost) o
 * desde otro aparato de la red de casa (192.168.x.x, 10.x.x.x, 172.16–31.x.x,
 * nombre.local). Lo publicado no lo es.
 */
export function isDevHost(hostname) {
  if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname) || hostname.endsWith('.local')) return true;
  const ip = hostname.split('.').map(Number);
  if (ip.length !== 4 || ip.some((n) => !Number.isInteger(n))) return false;
  return ip[0] === 10 || (ip[0] === 192 && ip[1] === 168) || (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31);
}

export function parseMap(map, cols = BOARD.cols, rows = map.length + BOARD.extraRows) {
  const grid = createGrid(cols, rows);
  map.forEach((line, r) => {
    if (line.length !== cols) throw new Error(`Fila ${r} mide ${line.length}, no ${cols}: «${line}»`);
    [...line].forEach((ch, c) => {
      if (ch === '.') return;
      if (ch === ANCHOR_KEY) {
        // cada ancla empieza apuntando a un sitio distinto según dónde esté
        grid.cells[r][c] = anchorValue(r + c);
        return;
      }
      if (SHELL_KEYS.includes(ch)) {
        grid.cells[r][c] = shellValue(SHELL_KEYS.indexOf(ch));
        return;
      }
      if (BICOLOR_KEYS.includes(ch)) {
        grid.cells[r][c] = bicolorValue(...BICOLOR_PAIRS[BICOLOR_KEYS.indexOf(ch)]);
        return;
      }
      const color = COLOR_KEYS.indexOf(ch);
      if (color === -1) throw new Error(`Letra desconocida «${ch}» en la fila ${r}`);
      grid.cells[r][c] = color;
    });
  });
  return grid;
}

export function bubbleCount(map) {
  return map.reduce((n, line) => n + [...line].filter((ch) => ch !== '.').length, 0);
}

/**
 * Estrellas al completar un mapa: 3 si sobra al menos el 30 % de los
 * disparos, 2 si sobra al menos el 10 %, si no 1.
 */
export function starsFor(used, budget) {
  const left = budget - used;
  if (left >= Math.ceil(budget * 0.3)) return 3;
  if (left >= Math.ceil(budget * 0.1)) return 2;
  return 1;
}

/** Disparos máximos con los que aún se consiguen `stars` estrellas. */
export function shotsForStars(stars, budget) {
  if (stars >= 3) return budget - Math.ceil(budget * 0.3);
  if (stars === 2) return budget - Math.ceil(budget * 0.1);
  return budget;
}

// ── Progreso ─────────────────────────────────────────────────────────────

export function emptyProgress() {
  return { unlocked: 1, stars: [] };
}

/** Limpia lo que venga del almacenamiento, que puede estar roto o ser antiguo. */
export function normalizeProgress(raw, total) {
  if (!raw || typeof raw !== 'object') return emptyProgress();
  const stars = Array.isArray(raw.stars)
    ? raw.stars.slice(0, total).map((s) => (Number.isInteger(s) ? Math.min(Math.max(s, 0), 3) : 0))
    : [];
  // Siempre abierto el nivel que va después del último ganado: al añadir
  // temáticas, quien lo tenía todo ganado (con `unlocked` en el tope de antes)
  // sigue por la primera nueva.
  const lastWon = stars.findLastIndex((s) => s > 0);
  const saved = Number.isInteger(raw.unlocked) ? raw.unlocked : 1;
  const unlocked = Math.min(Math.max(saved, lastWon + 2, 1), total);
  return { unlocked, stars };
}

/** Devuelve el progreso tras ganar el mapa `index` con `stars` estrellas. */
export function recordWin(progress, index, stars, total) {
  const next = [...progress.stars];
  next[index] = Math.max(next[index] ?? 0, stars);
  for (let i = 0; i < next.length; i++) next[i] ??= 0;
  return {
    unlocked: Math.min(total, Math.max(progress.unlocked, index + 2)),
    stars: next,
  };
}
