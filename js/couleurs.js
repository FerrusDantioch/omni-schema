// =====================================================================
// Couleurs du schéma, pour chaque thème.
// Elles sont définies ici (et pas seulement dans le CSS) pour que les
// futurs exports (PNG, SVG, HTML autonome) aient exactement les mêmes.
// Chaque couleur de bloc a : fond, bord et texte, choisis pour garder un
// contraste fort (texte/fond au-dessus de 7:1).
// =====================================================================

// Couleurs proposées pour les blocs (palette volontairement limitée).
export const COULEURS = [
  { id: 'neutre', nom: 'Neutre' },
  { id: 'violet', nom: 'Violet' },
  { id: 'bleu', nom: 'Bleu' },
  { id: 'vert', nom: 'Vert' },
  { id: 'jaune', nom: 'Jaune' },
  { id: 'rouge', nom: 'Rouge' },
];

export const PALETTES = {
  clair: {
    neutre: { fond: '#ffffff', bord: '#4a4458', texte: '#1d1928' },
    violet: { fond: '#ece6fb', bord: '#5b3fa8', texte: '#26174f' },
    bleu: { fond: '#e2edfa', bord: '#1f5fa8', texte: '#0d2a4f' },
    vert: { fond: '#e0f2e6', bord: '#2b7543', texte: '#103a1f' },
    jaune: { fond: '#fcf1cc', bord: '#8f6200', texte: '#3f2c00' },
    rouge: { fond: '#fbe3e2', bord: '#b3261e', texte: '#561310' },
  },
  sombre: {
    neutre: { fond: '#25222e', bord: '#b8b2c8', texte: '#f2eff7' },
    violet: { fond: '#2f2549', bord: '#b49cf5', texte: '#f1ebff' },
    bleu: { fond: '#1a2a3f', bord: '#80b3ef', texte: '#e7f0fc' },
    vert: { fond: '#193223', bord: '#80cf99', texte: '#e6f6eb' },
    jaune: { fond: '#382e12', bord: '#e5c25c', texte: '#fcf2d6' },
    rouge: { fond: '#3c1d1d', bord: '#f0928c', texte: '#fde9e7' },
  },
  violet: {
    neutre: { fond: '#2a2142', bord: '#c9bde6', texte: '#f4f0ff' },
    violet: { fond: '#3b2b66', bord: '#c9b4ff', texte: '#f6f1ff' },
    bleu: { fond: '#1f2a52', bord: '#8fb5f5', texte: '#e9f0ff' },
    vert: { fond: '#1d3436', bord: '#86d1a5', texte: '#e7f7ee' },
    jaune: { fond: '#3d2f2a', bord: '#ecc767', texte: '#fdf3d8' },
    rouge: { fond: '#41203a', bord: '#f39ab0', texte: '#ffeaf0' },
  },
};

// Couleurs de la zone de dessin (fond, grille, flèches, sélection).
export const TOILE = {
  clair: { fond: '#f7f5fb', grille: '#e3ddef', trait: '#3a3350', selection: '#6a4bd0', guide: '#d4407a' },
  sombre: { fond: '#16141c', grille: '#272430', trait: '#d3cde0', selection: '#b49cf5', guide: '#ff7fae' },
  violet: { fond: '#1b1430', grille: '#2b2147', trait: '#dcd0f7', selection: '#c9b4ff', guide: '#ff8fbd' },
};

/** Renvoie {fond, bord, texte} pour une couleur de bloc dans un thème. */
export function couleurBloc(theme, idCouleur) {
  const palette = PALETTES[theme] || PALETTES.clair;
  return palette[idCouleur] || palette.neutre;
}

/** Renvoie les couleurs de la zone de dessin pour un thème. */
export function couleursToile(theme) {
  return TOILE[theme] || TOILE.clair;
}
