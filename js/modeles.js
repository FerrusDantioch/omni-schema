// =====================================================================
// Modèles de départ. Chacun est un schéma prêt à présenter : blocs,
// flèches, étapes et notes du présentateur déjà remplies. Il suffit de
// remplacer les textes.
// =====================================================================

import { creerSchema, creerBloc, creerFleche } from './modele.js';

export const MODELES = [
  {
    id: 'vide',
    nom: 'Schéma vide',
    description: 'Une page blanche.',
  },
  {
    id: 'probleme',
    nom: 'Résolution de problème',
    description: 'Problème, causes, pistes, choix, action, bilan.',
  },
  {
    id: 'chronologie',
    nom: 'Chronologie',
    description: 'Cinq moments clés, de gauche à droite.',
  },
  {
    id: 'decision',
    nom: 'Arbre de décision',
    description: 'Des questions oui / non qui mènent à une conclusion.',
  },
];

/** Crée un nouveau schéma à partir d'un modèle. */
export function creerDepuisModele(idModele, titre) {
  const s = creerSchema(titre);
  const fabrique = { probleme, chronologie, decision }[idModele];
  if (fabrique) fabrique(s);
  return s;
}

// Raccourci : ajoute un bloc au schéma et le renvoie.
function bloc(s, proprietes) {
  const b = creerBloc(proprietes);
  s.elements.push(b);
  return b;
}
function fleche(s, de, vers, proprietes = {}) {
  s.elements.push(creerFleche(de.id, vers.id, proprietes));
}

/** Démarche de résolution de problème (en « Z » : 3 en haut, 3 en bas). */
function probleme(s) {
  const L = 220, H = 100;
  const p = bloc(s, { x: 0, y: 0, largeur: L, hauteur: H, couleur: 'rouge', etape: 1,
    texte: 'Le problème',
    note: 'Énonce le problème en une phrase simple. Vérifie que tout le monde le comprend de la même façon.' });
  const c = bloc(s, { x: 320, y: 0, largeur: L, hauteur: H, couleur: 'violet', etape: 2,
    texte: 'Les causes',
    note: 'Demande « pourquoi ? » plusieurs fois. Garde deux ou trois causes principales.' });
  const pi = bloc(s, { x: 640, y: 0, largeur: L, hauteur: H, couleur: 'bleu', etape: 3,
    texte: 'Les pistes de solution',
    note: 'Note toutes les idées sans les juger. Le tri vient juste après.' });
  const ch = bloc(s, { x: 640, y: 180, largeur: L, hauteur: 140, forme: 'losange', couleur: 'jaune', etape: 4,
    texte: 'Quelle piste choisir ?',
    note: 'Compare les pistes : effort, coût, effet attendu. Choisis-en une.' });
  const a = bloc(s, { x: 320, y: 200, largeur: L, hauteur: H, couleur: 'vert', etape: 5,
    texte: 'Agir',
    note: 'Qui fait quoi, et pour quand ? Commence petit.' });
  const b = bloc(s, { x: 0, y: 200, largeur: L, hauteur: H, forme: 'ovale', couleur: 'neutre', etape: 6,
    texte: 'Faire le bilan',
    note: 'Ça a marché ? Si oui, bravo. Sinon, on repart du problème avec ce qu\'on a appris.' });
  fleche(s, p, c);
  fleche(s, c, pi);
  fleche(s, pi, ch);
  fleche(s, ch, a, { etiquette: 'retenue' });
  fleche(s, a, b);
  fleche(s, b, p, { etiquette: 'si besoin' });
}

/** Chronologie : un titre et cinq moments reliés de gauche à droite. */
function chronologie(s) {
  bloc(s, { x: 360, y: 0, largeur: 480, hauteur: 70, forme: 'rectangle', couleur: 'neutre', etape: 0,
    texte: 'Titre de la chronologie',
    note: 'Présente le sujet et la période couverte.' });
  const couleurs = ['violet', 'bleu', 'violet', 'bleu', 'violet'];
  let precedent = null;
  for (let i = 0; i < 5; i++) {
    const b = bloc(s, {
      x: i * 240, y: 140, largeur: 200, hauteur: 100, couleur: couleurs[i], etape: i + 1,
      texte: `Date ${i + 1}\nCe qui s'est passé`,
      note: i === 0 ? 'Commence par le point de départ : où en était-on ?' : i === 4 ? 'Termine par où on en est aujourd\'hui, ou la suite prévue.' : '',
    });
    if (precedent) fleche(s, precedent, b);
    precedent = b;
  }
}

/** Arbre de décision : deux questions, trois conclusions. */
function decision(s) {
  const q1 = bloc(s, { x: 330, y: 0, largeur: 240, hauteur: 120, forme: 'losange', couleur: 'jaune', etape: 1,
    texte: 'Première question ?',
    note: 'Pose la question à voix haute et laisse le public répondre avant d\'avancer.' });
  const q2 = bloc(s, { x: 120, y: 240, largeur: 240, hauteur: 120, forme: 'losange', couleur: 'jaune', etape: 3,
    texte: 'Deuxième question ?',
    note: 'On ne pose cette question que si la réponse à la première est « oui ».' });
  const c3 = bloc(s, { x: 560, y: 240, largeur: 200, hauteur: 100, forme: 'ovale', couleur: 'vert', etape: 2,
    texte: 'Conclusion C',
    note: 'Cas le plus simple : on s\'arrête là.' });
  const c1 = bloc(s, { x: 0, y: 450, largeur: 200, hauteur: 90, forme: 'ovale', couleur: 'vert', etape: 4,
    texte: 'Conclusion A' });
  const c2 = bloc(s, { x: 260, y: 450, largeur: 200, hauteur: 90, forme: 'ovale', couleur: 'vert', etape: 5,
    texte: 'Conclusion B' });
  fleche(s, q1, q2, { style: 'angle', etiquette: 'Oui' });
  fleche(s, q1, c3, { style: 'angle', etiquette: 'Non' });
  fleche(s, q2, c1, { style: 'angle', etiquette: 'Oui' });
  fleche(s, q2, c2, { style: 'angle', etiquette: 'Non' });
}
