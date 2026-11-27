// Aspecto de cada temática en las pantallas de animales y niveles: el fondo,
// el color del agua en el mapa de animales (`water`) y el dibujo del animal
// (SVG de 200 × 150). Solo es decoración. `facing` dice
// hacia dónde mira el dibujo, para girarlo cuando nada por el fondo del juego:
// 'left' (de perfil, hacia la izquierda), 'up' (visto desde arriba) o 'front'.

const TORTUGA = `
  <ellipse cx="52" cy="62" rx="26" ry="11" transform="rotate(-35 52 62)" fill="#86d69a"/>
  <ellipse cx="148" cy="62" rx="26" ry="11" transform="rotate(35 148 62)" fill="#86d69a"/>
  <ellipse cx="62" cy="120" rx="18" ry="9" transform="rotate(35 62 120)" fill="#86d69a"/>
  <ellipse cx="138" cy="120" rx="18" ry="9" transform="rotate(-35 138 120)" fill="#86d69a"/>
  <path d="M100 128 L94 142 L106 142 Z" fill="#86d69a"/>
  <ellipse cx="100" cy="30" rx="16" ry="18" fill="#86d69a"/>
  <circle cx="93" cy="25" r="3" fill="#0b2a3a"/><circle cx="107" cy="25" r="3" fill="#0b2a3a"/>
  <ellipse cx="100" cy="86" rx="50" ry="46" fill="#2f9e5e" stroke="#1d6b3f" stroke-width="4"/>
  <polygon points="100,62 118,74 118,98 100,110 82,98 82,74" fill="#4fc07a" stroke="#1d6b3f" stroke-width="3"/>
  <path d="M100 62 L100 41 M118 74 L141 62 M118 98 L141 111 M100 110 L100 131 M82 98 L59 111 M82 74 L59 62" stroke="#1d6b3f" stroke-width="3"/>`;

const PULPO = `
  <g fill="none" stroke="#ff7a5c" stroke-width="12" stroke-linecap="round">
    <path d="M66 86 C 44 100, 34 124, 54 136"/><path d="M80 94 C 70 114, 70 132, 84 142"/>
    <path d="M96 98 C 92 118, 96 134, 104 144"/><path d="M108 98 C 114 118, 112 132, 102 142"/>
    <path d="M122 94 C 134 112, 132 130, 118 140"/><path d="M136 86 C 158 98, 166 122, 148 136"/>
  </g>
  <ellipse cx="100" cy="60" rx="46" ry="44" fill="#ff7a5c"/>
  <circle cx="80" cy="40" r="6" fill="#ffab94"/><circle cx="124" cy="34" r="4" fill="#ffab94"/><circle cx="114" cy="48" r="3" fill="#ffab94"/>
  <circle cx="84" cy="66" r="10" fill="#fff"/><circle cx="116" cy="66" r="10" fill="#fff"/>
  <circle cx="86" cy="68" r="5" fill="#0b2a3a"/><circle cx="118" cy="68" r="5" fill="#0b2a3a"/>
  <path d="M92 84 Q 100 90 108 84" fill="none" stroke="#a83a24" stroke-width="3" stroke-linecap="round"/>`;

const CABALLITO = `
  <path d="M134 70 C 160 74, 160 98, 136 100 Z" fill="#ffe08a"/>
  <path d="M112 22 C 138 18, 144 46, 124 56 C 144 70, 144 100, 120 112 C 100 122, 96 140, 114 142 C 126 143, 128 130, 118 128" fill="none" stroke="#ffc44d" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M112 30 L 74 34 C 68 35, 68 45, 74 46 L 112 48 Z" fill="#ffc44d"/>
  <path d="M108 12 l6 -8 l4 9 l7 -6 l1 10" fill="#ffe08a"/>
  <circle cx="114" cy="32" r="4.5" fill="#0b2a3a"/><circle cx="115.5" cy="30.5" r="1.5" fill="#fff"/>
  <path d="M118 66 h10 M120 80 h12 M118 94 h10" stroke="#e0a23a" stroke-width="3" stroke-linecap="round"/>`;

const MEDUSA = `
  <g fill="none" stroke="#d9c2ff" stroke-width="4" stroke-linecap="round" opacity="0.9">
    <path d="M66 80 C 58 98, 74 110, 66 128 C 60 140, 68 144, 66 148"/>
    <path d="M134 80 C 142 98, 126 110, 134 128 C 140 140, 132 144, 134 148"/>
    <path d="M82 84 C 76 104, 90 116, 82 136"/><path d="M118 84 C 124 104, 110 116, 118 136"/>
  </g>
  <path d="M94 82 C 86 100, 104 112, 94 132 C 90 140, 98 146, 100 146 C 102 146, 110 140, 106 132 C 96 112, 114 100, 106 82 Z" fill="#b48cff" opacity="0.85"/>
  <path d="M48 82 C 46 22, 154 22, 152 82 C 136 74, 120 88, 100 80 C 80 88, 64 74, 48 82 Z" fill="#c59bff"/>
  <path d="M62 66 C 64 36, 136 36, 138 66" fill="none" stroke="#e8dcff" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
  <circle cx="86" cy="58" r="4" fill="#2a1450"/><circle cx="114" cy="58" r="4" fill="#2a1450"/>
  <path d="M94 66 Q 100 71 106 66" fill="none" stroke="#2a1450" stroke-width="2.5" stroke-linecap="round"/>`;

const BALLENA = `
  <path d="M66 40 C 62 26, 54 20, 46 16 M66 40 C 68 24, 76 18, 86 14 M66 40 L66 12" fill="none" stroke="#bff3ff" stroke-width="4" stroke-linecap="round"/>
  <circle cx="44" cy="12" r="3" fill="#bff3ff"/><circle cx="88" cy="10" r="3" fill="#bff3ff"/>
  <path d="M14 84 C 14 44, 104 34, 146 62 C 160 72, 168 66, 180 52 C 186 66, 184 82, 176 88 C 186 94, 190 106, 186 118 C 176 106, 166 100, 152 102 C 118 126, 14 124, 14 84 Z" fill="#4f86cf"/>
  <path d="M24 100 C 56 120, 118 118, 148 102 C 118 110, 58 112, 24 100 Z" fill="#cfe6ff"/>
  <path d="M40 106 C 60 114, 100 114, 124 108" fill="none" stroke="#9cc3ee" stroke-width="2"/>
  <path d="M80 92 C 92 104, 108 104, 116 96" fill="#3b6fb3"/>
  <circle cx="46" cy="82" r="5" fill="#0b2a3a"/><circle cx="47.5" cy="80.5" r="1.6" fill="#fff"/>`;

// Animales nuevos (del 6.º al 12.º)

const EYE = (x, y, r = 6) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#0b2a3a"/><circle cx="${x + r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.35}" fill="#fff"/>`;

const PAYASO = `
  <defs><clipPath id="clip-payaso"><ellipse cx="96" cy="75" rx="62" ry="40"/></clipPath></defs>
  <path d="M146 75 L186 46 C 178 64, 178 86, 186 104 Z" fill="#ff8a2a" stroke="#1d1d1d" stroke-width="3" stroke-linejoin="round"/>
  <path d="M84 38 C 92 14, 128 16, 134 44 Z" fill="#ff8a2a" stroke="#1d1d1d" stroke-width="3" stroke-linejoin="round"/>
  <path d="M86 112 C 90 132, 116 134, 122 110 Z" fill="#ff8a2a" stroke="#1d1d1d" stroke-width="3" stroke-linejoin="round"/>
  <ellipse cx="96" cy="75" rx="62" ry="40" fill="#ff8a2a"/>
  <g clip-path="url(#clip-payaso)" stroke="#1d1d1d" stroke-width="3" fill="#fff">
    <path d="M64 20 C 56 50, 56 100, 64 130 L 82 130 C 74 100, 74 50, 82 20 Z"/>
    <path d="M110 20 C 102 50, 102 100, 110 130 L 126 130 C 118 100, 118 50, 126 20 Z"/>
    <path d="M150 20 C 144 50, 144 100, 150 130 L 170 130 L 170 20 Z"/>
  </g>
  <ellipse cx="96" cy="75" rx="62" ry="40" fill="none" stroke="#1d1d1d" stroke-width="3"/>
  ${EYE(52, 66, 7)}
  <path d="M38 86 Q 46 92 54 88" fill="none" stroke="#1d1d1d" stroke-width="3" stroke-linecap="round"/>
  <path d="M92 82 C 102 92, 104 104, 96 108" fill="#ffb066" stroke="#1d1d1d" stroke-width="2.5"/>`;

const CANGREJO = `
  <g stroke="#d8443a" stroke-width="8" stroke-linecap="round" fill="none">
    <path d="M62 92 L32 104 L24 124"/><path d="M64 104 L40 124 L36 142"/>
    <path d="M138 92 L168 104 L176 124"/><path d="M136 104 L160 124 L164 142"/>
    <path d="M70 80 L48 58"/><path d="M130 80 L152 58"/>
  </g>
  <path d="M46 60 C 18 62, 12 26, 36 16 L 44 34 L 54 22 C 66 34, 64 58, 46 60 Z" fill="#ff5a4e" stroke="#c33a30" stroke-width="3"/>
  <path d="M154 60 C 182 62, 188 26, 164 16 L 156 34 L 146 22 C 134 34, 136 58, 154 60 Z" fill="#ff5a4e" stroke="#c33a30" stroke-width="3"/>
  <path d="M88 70 L84 46 M112 70 L116 46" stroke="#ff5a4e" stroke-width="6" stroke-linecap="round"/>
  <ellipse cx="100" cy="94" rx="50" ry="33" fill="#ff5a4e"/>
  <ellipse cx="100" cy="86" rx="34" ry="14" fill="#ff8a7e" opacity="0.7"/>
  <circle cx="84" cy="42" r="10" fill="#fff"/><circle cx="116" cy="42" r="10" fill="#fff"/>
  ${EYE(85, 43, 5)}${EYE(117, 43, 5)}
  <circle cx="74" cy="102" r="6" fill="#ff9e94"/><circle cx="126" cy="102" r="6" fill="#ff9e94"/>
  <path d="M90 104 Q 100 112 110 104" fill="none" stroke="#8e2a22" stroke-width="3" stroke-linecap="round"/>`;

const spikes = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  const p = (r, da) => `${(100 + Math.cos(a + da) * r).toFixed(1)},${(78 + Math.sin(a + da) * r).toFixed(1)}`;
  return `<polygon points="${p(46, -0.12)} ${p(62, 0)} ${p(46, 0.12)}"/>`;
}).join('');

const GLOBO = `
  <path d="M146 78 L174 60 C 168 72, 168 84, 174 96 Z" fill="#f0b43a"/>
  <g fill="#e8a52c">${spikes}</g>
  <circle cx="100" cy="78" r="50" fill="#ffd35a"/>
  <path d="M56 92 C 70 124, 130 124, 144 92 C 130 108, 70 108, 56 92 Z" fill="#fff4c4"/>
  <circle cx="74" cy="60" r="7" fill="#e8a52c"/><circle cx="124" cy="52" r="5" fill="#e8a52c"/><circle cx="132" cy="74" r="6" fill="#e8a52c"/>
  <circle cx="82" cy="70" r="13" fill="#fff"/><circle cx="114" cy="70" r="13" fill="#fff"/>
  ${EYE(84, 72, 7)}${EYE(116, 72, 7)}
  <ellipse cx="100" cy="94" rx="7" ry="6" fill="#c9572e"/>
  <path d="M52 70 C 40 62, 40 88, 52 82 Z" fill="#f0b43a"/>`;

const DELFIN = `
  <path d="M96 48 C 100 28, 112 20, 126 18 C 118 32, 118 44, 120 54 Z" fill="#4f8cc9"/>
  <path d="M22 80 C 32 50, 112 40, 152 60 C 166 66, 172 60, 182 46 C 186 62, 184 74, 176 80 C 186 86, 190 98, 186 110 C 176 98, 166 92, 152 94 C 120 114, 42 112, 30 94 L 6 90 C 8 84, 14 81, 22 80 Z" fill="#6fa8dc"/>
  <path d="M30 94 C 50 108, 110 110, 150 94 C 110 102, 54 102, 30 94 Z" fill="#dcefff"/>
  <path d="M86 98 C 88 116, 100 126, 110 124 C 106 112, 102 104, 104 96 Z" fill="#4f8cc9"/>
  ${EYE(46, 76, 5)}
  <path d="M10 89 Q 22 94 36 90" fill="none" stroke="#2f5f94" stroke-width="2.5" stroke-linecap="round"/>`;

const MANTA = `
  <path d="M100 116 C 102 128, 98 140, 104 150" fill="none" stroke="#2b4466" stroke-width="4" stroke-linecap="round"/>
  <path d="M100 36 C 130 38, 160 58, 196 72 C 162 88, 130 108, 100 118 C 70 108, 38 88, 4 72 C 40 58, 70 38, 100 36 Z" fill="#3d5f8f"/>
  <path d="M100 52 C 116 56, 128 70, 126 88 C 118 100, 82 100, 74 88 C 72 70, 84 56, 100 52 Z" fill="#5c80b3"/>
  <path d="M84 40 C 76 26, 86 18, 92 32 Z M116 40 C 124 26, 114 18, 108 32 Z" fill="#2b4466"/>
  <circle cx="40" cy="74" r="4" fill="#8fb3e0"/><circle cx="58" cy="66" r="3" fill="#8fb3e0"/><circle cx="160" cy="74" r="4" fill="#8fb3e0"/><circle cx="142" cy="66" r="3" fill="#8fb3e0"/>
  ${EYE(86, 54, 5)}${EYE(114, 54, 5)}
  <path d="M92 66 Q 100 72 108 66" fill="none" stroke="#1d3150" stroke-width="2.5" stroke-linecap="round"/>`;

const TIBURON = `
  <path d="M92 50 C 102 26, 112 18, 122 14 C 120 30, 122 42, 128 54 Z" fill="#6f8ea6"/>
  <path d="M8 84 C 30 56, 112 46, 152 62 C 166 68, 172 60, 184 40 C 186 60, 184 74, 178 82 C 186 90, 190 104, 186 118 C 176 104, 166 96, 152 98 C 116 118, 34 114, 8 84 Z" fill="#8aa9c1"/>
  <path d="M18 92 C 40 110, 110 112, 150 98 C 110 104, 50 104, 18 92 Z" fill="#eef5fb"/>
  <path d="M84 100 C 82 118, 90 130, 102 132 C 100 118, 104 108, 110 100 Z" fill="#6f8ea6"/>
  <path d="M72 70 v16 M80 68 v18 M88 68 v18" stroke="#5d7a91" stroke-width="2.5" stroke-linecap="round"/>
  ${EYE(40, 74, 5)}
  <path d="M16 90 Q 30 98 46 92" fill="#fff" stroke="#3d556a" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M22 92 l3 4 l3 -3 l3 4 l3 -3 l3 4 l3 -4" fill="none" stroke="#3d556a" stroke-width="1.5"/>`;

const RAPE = `
  <circle cx="132" cy="22" r="20" fill="#fff6a8" opacity="0.25"/>
  <path d="M74 46 C 80 14, 120 4, 132 20" fill="none" stroke="#8a6fb8" stroke-width="4" stroke-linecap="round"/>
  <circle cx="132" cy="22" r="9" fill="#fff6a8"/>
  <path d="M146 88 L186 62 C 178 82, 178 96, 186 116 Z" fill="#6b5494"/>
  <ellipse cx="96" cy="88" rx="60" ry="46" fill="#5b4a82"/>
  <path d="M84 130 C 90 146, 112 146, 118 128 Z" fill="#6b5494"/>
  <path d="M40 92 C 56 120, 100 124, 124 104 L 120 96 C 98 110, 60 108, 44 86 Z" fill="#1a0f30"/>
  <path d="M46 90 l6 9 l4 -7 l6 10 l5 -8 l6 10 l6 -9 l6 9 l6 -10 l6 8 l6 -9 l6 7" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="76" cy="66" r="16" fill="#fff"/>${EYE(78, 67, 8)}
  <circle cx="110" cy="58" r="4" fill="#7e68ab"/><circle cx="124" cy="74" r="3" fill="#7e68ab"/>`;

export const THEME_ART = {
  tortuga: { facing: 'up', svg: TORTUGA, water: '#1592b0', bg: 'linear-gradient(180deg, #2cc3d1 0%, #1592b0 40%, #0c6690 75%, #08476e 100%)' },
  pulpo: { facing: 'front', svg: PULPO, water: '#156f97', bg: 'linear-gradient(180deg, #1b9bb3 0%, #156f97 40%, #2b4a86 75%, #2a2a62 100%)' },
  caballito: { facing: 'left', svg: CABALLITO, water: '#0f6670', bg: 'linear-gradient(180deg, #189086 0%, #0f6670 40%, #0b4a5c 75%, #073345 100%)' },
  medusa: { facing: 'front', svg: MEDUSA, water: '#2b3384', bg: 'linear-gradient(180deg, #3550a4 0%, #2b3384 40%, #1f1e5c 75%, #120e36 100%)' },
  ballena: { facing: 'left', svg: BALLENA, water: '#0d2a52', bg: 'linear-gradient(180deg, #17406f 0%, #0d2a52 40%, #071a38 75%, #030b1f 100%)' },
  payaso: { facing: 'left', svg: PAYASO, water: '#1a8fa6', bg: 'linear-gradient(180deg, #35c8d0 0%, #1a9fb6 40%, #127a9c 75%, #0b5878 100%)' },
  cangrejo: { facing: 'front', svg: CANGREJO, water: '#1f8a9a', bg: 'linear-gradient(180deg, #3cbcc4 0%, #1f8f9e 40%, #166c80 75%, #0e4c60 100%)' },
  globo: { facing: 'left', svg: GLOBO, water: '#16849c', bg: 'linear-gradient(180deg, #2fb4c6 0%, #16849c 40%, #10627e 75%, #0a4560 100%)' },
  delfin: { facing: 'left', svg: DELFIN, water: '#1767a0', bg: 'linear-gradient(180deg, #2a8fd0 0%, #1767a0 40%, #114c80 75%, #0a3560 100%)' },
  manta: { facing: 'up', svg: MANTA, water: '#174d8a', bg: 'linear-gradient(180deg, #2a6cb0 0%, #174d8a 40%, #10386a 75%, #0a254c 100%)' },
  tiburon: { facing: 'left', svg: TIBURON, water: '#123a6a', bg: 'linear-gradient(180deg, #1f5590 0%, #123a6a 40%, #0b2850 75%, #061834 100%)' },
  rape: { facing: 'left', svg: RAPE, water: '#090f2c', bg: 'linear-gradient(180deg, #141c4a 0%, #0c1236 40%, #070a24 75%, #030412 100%)' },
};

/** SVG del animal de una temática, listo para meter en la página. */
export function animalSvg(key, label) {
  return `<svg viewBox="0 0 200 150" role="img" aria-label="${label}">${THEME_ART[key].svg}</svg>`;
}
