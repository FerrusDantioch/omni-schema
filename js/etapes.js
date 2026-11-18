// =====================================================================
// Logique des étapes (aucun affichage ici : ces fonctions servent à
// l'éditeur, à la présentation, aux exports et au futur lecteur HTML).
//
// Règles :
// - etape = 0 : l'élément est toujours visible ;
// - etape = n : l'élément apparaît à l'étape n ;
// - une flèche n'apparaît jamais avant ses deux blocs : son étape
//   « effective » est la plus grande des trois (la sienne, celle du bloc
//   de départ, celle du bloc d'arrivée). Ainsi, aucune flèche ne pointe
//   vers un bloc encore caché.
// =====================================================================

import { listeBlocs, trouver } from './modele.js';

/** Étape à laquelle l'élément devient réellement visible. */
export function etapeEffective(schema, e, parId = null) {
  if (e.type !== 'fleche') return e.etape || 0;
  const A = parId ? parId.get(e.de) : trouver(schema, e.de);
  const B = parId ? parId.get(e.vers) : trouver(schema, e.vers);
  return Math.max(e.etape || 0, A ? A.etape || 0 : 0, B ? B.etape || 0 : 0);
}

/** Carte id → étape effective, pour tous les éléments. */
export function etapesEffectives(schema) {
  const parId = new Map(listeBlocs(schema).map((b) => [b.id, b]));
  const resultat = new Map();
  for (const e of schema.elements) resultat.set(e.id, etapeEffective(schema, e, parId));
  return resultat;
}

/** Plus grand numéro d'étape utilisé (0 s'il n'y a pas d'étape). */
export const etapeMax = (schema) => schema.elements.reduce((m, e) => Math.max(m, e.etape || 0), 0);

/**
 * Les « arrêts » de la présentation, dans l'ordre. Exemple : [0, 1, 2, 3].
 * L'arrêt 0 (éléments toujours visibles) n'existe que s'il y a de tels
 * éléments, ou s'il n'y a aucune étape (alors tout s'affiche d'un coup).
 */
export function arrets(schema) {
  const eff = etapesEffectives(schema);
  const valeurs = [...new Set([...eff.values()].filter((v) => v > 0))].sort((a, b) => a - b);
  const aDesToujoursVisibles = [...eff.values()].some((v) => v === 0);
  return aDesToujoursVisibles || !valeurs.length ? [0, ...valeurs] : valeurs;
}

/**
 * Renumérote les étapes sans trou : 1, 3, 7 deviennent 1, 2, 3.
 * (Modifie le schéma ; à faire après chaque réorganisation.)
 */
export function compacter(schema) {
  const valeurs = [...new Set(schema.elements.map((e) => e.etape || 0).filter((v) => v > 0))].sort((a, b) => a - b);
  const nouveau = new Map(valeurs.map((v, i) => [v, i + 1]));
  for (const e of schema.elements) e.etape = e.etape > 0 ? nouveau.get(e.etape) : 0;
}

/** Échange deux étapes (pour réordonner) : tout ce qui était en a passe en b et inversement. */
export function echangerEtapes(schema, a, b) {
  if (a <= 0 || b <= 0) return;
  for (const e of schema.elements) {
    if (e.etape === a) e.etape = b;
    else if (e.etape === b) e.etape = a;
  }
}

/**
 * Numérotation automatique, dans l'ordre de lecture : de haut en bas,
 * puis de gauche à droite (les blocs à peu près sur la même ligne sont
 * lus de gauche à droite). Les flèches suivent leurs blocs.
 */
export function numeroterAutomatiquement(schema) {
  const blocs = listeBlocs(schema).slice().sort((a, b) => (a.y + a.hauteur / 2) - (b.y + b.hauteur / 2));
  // Regroupe en « lignes » les blocs dont les centres sont proches en hauteur.
  const lignes = [];
  for (const b of blocs) {
    const cy = b.y + b.hauteur / 2;
    const ligne = lignes.find((l) => Math.abs(l.cy - cy) < 40);
    if (ligne) ligne.blocs.push(b);
    else lignes.push({ cy, blocs: [b] });
  }
  let n = 1;
  for (const ligne of lignes) {
    ligne.blocs.sort((a, b) => a.x - b.x);
    for (const b of ligne.blocs) b.etape = n++;
  }
  for (const e of schema.elements) if (e.type === 'fleche') e.etape = 0;
}

/** Retire toutes les étapes : tout devient toujours visible. */
export function retirerEtapes(schema) {
  for (const e of schema.elements) e.etape = 0;
}

/** Nom lisible d'un élément (pour les listes et les notes). */
export function nomElement(schema, e, longueur = 40) {
  const couper = (t) => {
    const propre = String(t || '').replace(/\s+/g, ' ').trim();
    return propre.length > longueur ? `${propre.slice(0, longueur - 1)}…` : propre;
  };
  if (e.type === 'bloc') return couper(e.texte) || 'Bloc sans texte';
  const A = trouver(schema, e.de);
  const B = trouver(schema, e.vers);
  const nom = `${couper(A && A.texte) || 'bloc'} → ${couper(B && B.texte) || 'bloc'}`;
  return e.etiquette ? `Flèche « ${couper(e.etiquette)} » (${nom})` : `Flèche ${nom}`;
}
