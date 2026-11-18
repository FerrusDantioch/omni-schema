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
    violet: { fond: '#ece6fb', bord: '#6a3fd6', texte: '#26174f' },
    bleu: { fond: '#e2edfa', bord: '#1f5fa8', texte: '#0d2a4f' },
    vert: { fond: '#e0f2e6', bord: '#2b7543', texte: '#103a1f' },
    jaune: { fond: '#fcf1cc', bord: '#8f6200', texte: '#3f2c00' },
    rouge: { fond: '#fbe3e2', bord: '#b3261e', texte: '#561310' },
  },
  sombre: {
    neutre: { fond: '#25222e', bord: '#b8b2c8', texte: '#f2eff7' },
    violet: { fond: '#2a1f45', bord: '#a777ff', texte: '#f1ebff' },
    bleu: { fond: '#1a2a3f', bord: '#80b3ef', texte: '#e7f0fc' },
    vert: { fond: '#193223', bord: '#80cf99', texte: '#e6f6eb' },
    jaune: { fond: '#382e12', bord: '#e5c25c', texte: '#fcf2d6' },
    rouge: { fond: '#3c1d1d', bord: '#f0928c', texte: '#fde9e7' },
  },
  // Sombre violet = identité du portfolio de l'Omni-système (fond nuit #14121e, violet #a777ff).
  violet: {
    neutre: { fond: '#1e1928', bord: '#aaa6c0', texte: '#f2eef9' },
    violet: { fond: '#2a1d47', bord: '#a777ff', texte: '#f4edff' },
    bleu: { fond: '#172338', bord: '#7fb0f0', texte: '#e8f0fd' },
    vert: { fond: '#142c27', bord: '#6fcf9c', texte: '#e6f7ee' },
    jaune: { fond: '#2f2610', bord: '#e9c55e', texte: '#fcf3d8' },
    rouge: { fond: '#361824', bord: '#f2939f', texte: '#ffe9ec' },
  },
};

// Couleurs de la zone de dessin (fond, grille, flèches, sélection).
export const TOILE = {
  clair: { fond: '#f5f3fa', grille: '#e2ddec', trait: '#39324d', selection: '#6a3fd6', guide: '#c2366f' },
  sombre: { fond: '#111014', grille: '#1f1e25', trait: '#d3d0dc', selection: '#a777ff', guide: '#ff8fc4' },
  violet: { fond: '#14121e', grille: '#221f30', trait: '#d8d0ea', selection: '#a777ff', guide: '#ff8fc4' },
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
