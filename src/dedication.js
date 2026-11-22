// Dibujos de la pantalla de inicio, dedicada a mamá: su retrato y lo que
// está pensando (un guapo y una copa de vino). Solo es decoración.

export const DEDICATION = 'Para mamá, con todo mi cariño';

/** Retrato de mamá, una señora de 81 años sonriendo (200 × 200). */
export const MOM_SVG = `<svg viewBox="0 0 200 200" role="img" aria-label="Mamá sonriendo">
  <path d="M30 200 C 36 168, 66 156, 100 156 C 134 156, 164 168, 170 200 Z" fill="#7b5ea7"/>
  <path d="M78 158 L100 182 L122 158" fill="#f6eef8"/>
  <g fill="#fbf6ee" stroke="#d9cdb8" stroke-width="0.8">
    <circle cx="72" cy="166" r="4.5"/><circle cx="80" cy="172" r="4.5"/><circle cx="89" cy="176" r="4.5"/><circle cx="100" cy="178" r="4.5"/><circle cx="111" cy="176" r="4.5"/><circle cx="120" cy="172" r="4.5"/><circle cx="128" cy="166" r="4.5"/>
  </g>
  <rect x="86" y="136" width="28" height="24" rx="10" fill="#efc09c"/>
  <g fill="#eceff3"><circle cx="52" cy="92" r="20"/><circle cx="148" cy="92" r="20"/><circle cx="50" cy="116" r="16"/><circle cx="150" cy="116" r="16"/></g>
  <ellipse cx="54" cy="104" rx="9" ry="13" fill="#efc09c"/><ellipse cx="146" cy="104" rx="9" ry="13" fill="#efc09c"/>
  <circle cx="54" cy="118" r="3" fill="#c9953c"/><circle cx="146" cy="118" r="3" fill="#c9953c"/>
  <path d="M100 46 C 132 46, 148 70, 148 100 C 148 130, 128 150, 100 150 C 72 150, 52 130, 52 100 C 52 70, 68 46, 100 46 Z" fill="#f5cfae"/>
  <g fill="#f4f6f8" stroke="#d6dbe1" stroke-width="1.2">
    <circle cx="64" cy="66" r="17"/><circle cx="84" cy="52" r="18"/><circle cx="104" cy="46" r="18"/><circle cx="124" cy="52" r="18"/><circle cx="140" cy="68" r="16"/>
    <circle cx="74" cy="44" r="13"/><circle cx="116" cy="38" r="13"/><circle cx="96" cy="34" r="12"/>
  </g>
  <path d="M68 84 Q 78 79 88 83 M112 83 Q 122 79 132 84" fill="none" stroke="#a9aeb6" stroke-width="3" stroke-linecap="round"/>
  <circle cx="80" cy="98" r="15" fill="rgba(255,255,255,0.18)" stroke="#b08a3e" stroke-width="2.5"/>
  <circle cx="120" cy="98" r="15" fill="rgba(255,255,255,0.18)" stroke="#b08a3e" stroke-width="2.5"/>
  <path d="M95 97 Q 100 94 105 97" fill="none" stroke="#b08a3e" stroke-width="2.5"/>
  <path d="M71 100 Q 80 92 89 100" fill="none" stroke="#5a3b2a" stroke-width="3" stroke-linecap="round"/>
  <path d="M111 100 Q 120 92 129 100" fill="none" stroke="#5a3b2a" stroke-width="3" stroke-linecap="round"/>
  <path d="M62 96 l-6 -3 M62 101 l-7 1 M138 96 l6 -3 M138 101 l7 1" stroke="#d9a586" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="70" cy="118" r="10" fill="#f59aa6" opacity="0.55"/><circle cx="130" cy="118" r="10" fill="#f59aa6" opacity="0.55"/>
  <path d="M100 104 C 97 112, 96 116, 101 118" fill="none" stroke="#d9a586" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M80 124 C 86 140, 114 140, 120 124 C 108 129, 92 129, 80 124 Z" fill="#a8323e"/>
  <path d="M83 125 C 92 129, 108 129, 117 125 L 116 128 C 106 131, 94 131, 84 128 Z" fill="#fff"/>
  <path d="M74 120 Q 76 126 79 128 M126 120 Q 124 126 121 128" fill="none" stroke="#d9a586" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

/** Nube de pensamiento (226 × 150). */
export const CLOUD_SVG = `<svg viewBox="0 0 226 150" aria-hidden="true">
  <path d="M40 120 C 8 120, 4 82, 30 74 C 18 44, 52 24, 76 36 C 86 10, 132 8, 144 32 C 168 14, 206 30, 198 60 C 224 70, 220 112, 192 116 C 188 138, 150 144, 136 128 C 120 146, 82 146, 72 128 C 60 136, 42 132, 40 120 Z" fill="#fff" stroke="#d6eef6" stroke-width="3"/>
</svg>`;

/** El guapo en el que piensa (92 × 98). */
export const HANDSOME_SVG = `<svg viewBox="0 0 92 98" role="img" aria-label="Un hombre guapo sonriendo">
  <path d="M18 98 C 20 80, 34 74, 46 74 C 58 74, 72 80, 74 98 Z" fill="#2f6fae"/>
  <path d="M36 76 L46 88 L56 76" fill="#fff"/>
  <rect x="38" y="62" width="16" height="16" rx="6" fill="#5a3826"/>
  <ellipse cx="18" cy="44" rx="5" ry="8" fill="#5a3826"/><ellipse cx="74" cy="44" rx="5" ry="8" fill="#5a3826"/>
  <path d="M46 12 C 66 12, 74 26, 74 44 C 74 62, 62 74, 46 74 C 30 74, 18 62, 18 44 C 18 26, 26 12, 46 12 Z" fill="#6b4430"/>
  <path d="M19 38 C 18 20, 30 8, 46 8 C 62 8, 74 20, 73 38 C 70 28, 64 22, 46 22 C 28 22, 22 28, 19 38 Z" fill="#1a1110"/>
  <path d="M22 50 C 24 66, 34 76, 46 76 C 58 76, 68 66, 70 50 C 66 60, 60 64, 46 64 C 32 64, 26 60, 22 50 Z" fill="#1a1110" opacity="0.85"/>
  <path d="M30 34 Q 36 30 41 33 M51 33 Q 56 30 62 34" fill="none" stroke="#1a1110" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="36" cy="41" rx="3.6" ry="4" fill="#fff"/><circle cx="36.6" cy="41.4" r="2.2" fill="#24140c"/><circle cx="37.4" cy="40.4" r="0.8" fill="#fff"/>
  <path d="M51 41 Q 56 37 61 41" fill="none" stroke="#24140c" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M46 44 C 44 50, 43 52, 46 53" fill="none" stroke="#4a2c1e" stroke-width="2" stroke-linecap="round"/>
  <path d="M35 57 Q 46 66 57 57 Q 46 61 35 57 Z" fill="#fff" stroke="#3a2016" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** Copa de vino tinto (44 × 74). */
export const WINE_SVG = `<svg viewBox="0 0 44 74" role="img" aria-label="Una copa de vino tinto">
  <path d="M6 4 L38 4 C 40 26, 34 40, 22 42 C 10 40, 4 26, 6 4 Z" fill="#eaf6fb" stroke="#9cc9d8" stroke-width="2"/>
  <path d="M7 18 L37 18 C 37 30, 32 39, 22 40 C 12 39, 7 30, 7 18 Z" fill="#9b1b3a"/>
  <path d="M9 18 L35 18" stroke="#c43a5c" stroke-width="2"/>
  <path d="M11 8 C 10 18, 12 28, 16 34" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>
  <rect x="20.5" y="42" width="3" height="22" fill="#cfe6ef"/>
  <ellipse cx="22" cy="66" rx="13" ry="4" fill="#cfe6ef" stroke="#9cc9d8" stroke-width="1.5"/>
</svg>`;
