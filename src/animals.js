// Aspecto de cada temática en las pantallas de temáticas y niveles: el fondo
// y el dibujo del animal (SVG de 200 × 150). Solo es decoración. `facing` dice
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

export const THEME_ART = {
  tortuga: { facing: 'up', svg: TORTUGA, bg: 'linear-gradient(180deg, #2cc3d1 0%, #1592b0 40%, #0c6690 75%, #08476e 100%)' },
  pulpo: { facing: 'front', svg: PULPO, bg: 'linear-gradient(180deg, #1b9bb3 0%, #156f97 40%, #2b4a86 75%, #2a2a62 100%)' },
  caballito: { facing: 'left', svg: CABALLITO, bg: 'linear-gradient(180deg, #189086 0%, #0f6670 40%, #0b4a5c 75%, #073345 100%)' },
  medusa: { facing: 'front', svg: MEDUSA, bg: 'linear-gradient(180deg, #3550a4 0%, #2b3384 40%, #1f1e5c 75%, #120e36 100%)' },
  ballena: { facing: 'left', svg: BALLENA, bg: 'linear-gradient(180deg, #17406f 0%, #0d2a52 40%, #071a38 75%, #030b1f 100%)' },
};

/** SVG del animal de una temática, listo para meter en la página. */
export function animalSvg(key, label) {
  return `<svg viewBox="0 0 200 150" role="img" aria-label="${label}">${THEME_ART[key].svg}</svg>`;
}
