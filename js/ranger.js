// =====================================================================
// Ranger automatiquement des blocs (les blocs choisis, ou tout le schéma).
//
// - « droite » : en arbre qui pousse vers la droite, en suivant les flèches ;
// - « bas »    : en arbre qui pousse vers le bas ;
// - « grille » : en lignes et colonnes régulières, dans l'ordre de lecture.
//
// Les blocs gardent leur taille ; l'ensemble reste à peu près à sa place
// (même coin haut gauche). Une seule action : un « Annuler » remet tout.
// =====================================================================

import { GRILLE } from './config.js';
import { listeBlocs } from './modele.js';
import { englobant, surGrille } from './geometrie.js';
import { etat, valider, annoncer } from './noyau.js';

const ECART_NIVEAU = 80; // entre deux niveaux de l'arbre
const ECART_FRERE = 24;  // entre deux blocs voisins

/** Ordre de lecture : de haut en bas, puis de gauche à droite. */
const lecture = (a, b) => (Math.abs(a.y - b.y) > 30 ? a.y - b.y : a.x - b.x);

/**
 * Forêt couvrante : chaque bloc n'a qu'un parent (le premier qui le
 * rencontre en suivant les flèches). Renvoie la liste des racines,
 * chaque nœud valant { bloc, enfants }.
 */
function foret(blocs) {
  const ids = new Set(blocs.map((b) => b.id));
  const parId = new Map(blocs.map((b) => [b.id, b]));
  const sortants = new Map(blocs.map((b) => [b.id, []]));
  const entrants = new Set();
  for (const f of etat.schema.elements) {
    if (f.type !== 'fleche' || !ids.has(f.de) || !ids.has(f.vers) || f.de === f.vers) continue;
    sortants.get(f.de).push(parId.get(f.vers));
    entrants.add(f.vers);
  }
  for (const liste of sortants.values()) liste.sort(lecture);
  const vus = new Set();
  const construire = (b) => {
    vus.add(b.id);
    const noeud = { bloc: b, enfants: [] };
    for (const e of sortants.get(b.id)) if (!vus.has(e.id)) noeud.enfants.push(construire(e));
    return noeud;
  };
  const racines = [];
  // D'abord les blocs où n'arrive aucune flèche, puis ce qui reste (boucles, blocs isolés).
  for (const b of blocs.filter((x) => !entrants.has(x.id)).sort(lecture)) if (!vus.has(b.id)) racines.push(construire(b));
  for (const b of blocs.slice().sort(lecture)) if (!vus.has(b.id)) racines.push(construire(b));
  return racines;
}

/** Positions en arbre (coordonnées relatives au coin haut gauche). */
function positionsArbre(racines, sens) {
  const enLargeur = sens === 'droite'; // les niveaux s'empilent vers la droite
  // Taille « le long des niveaux » et « entre frères » d'un bloc.
  const long = (b) => (enLargeur ? b.largeur : b.hauteur);
  const travers = (b) => (enLargeur ? b.hauteur : b.largeur);
  // Épaisseur de chaque niveau = le plus grand bloc de ce niveau.
  const epaisseur = [];
  const mesurer = (n, niveau) => {
    epaisseur[niveau] = Math.max(epaisseur[niveau] || 0, long(n.bloc));
    n.enfants.forEach((e) => mesurer(e, niveau + 1));
  };
  racines.forEach((r) => mesurer(r, 0));
  const debutNiveau = [0];
  for (let i = 1; i < epaisseur.length; i++) debutNiveau[i] = debutNiveau[i - 1] + epaisseur[i - 1] + ECART_NIVEAU;

  const positions = new Map();
  let curseur = 0; // position « entre frères » de la prochaine feuille
  const placer = (n, niveau) => {
    let centre;
    if (!n.enfants.length) {
      centre = curseur + travers(n.bloc) / 2;
      curseur += travers(n.bloc) + ECART_FRERE;
    } else {
      const centres = n.enfants.map((e) => placer(e, niveau + 1));
      centre = (centres[0] + centres[centres.length - 1]) / 2;
      // Un parent plus large que ses enfants ne doit pas mordre sur le voisin suivant.
      curseur = Math.max(curseur, centre + travers(n.bloc) / 2 + ECART_FRERE);
    }
    // Centré dans l'épaisseur de son niveau.
    const le = debutNiveau[niveau] + (epaisseur[niveau] - long(n.bloc)) / 2;
    const tr = centre - travers(n.bloc) / 2;
    positions.set(n.bloc.id, enLargeur ? { x: le, y: tr } : { x: tr, y: le });
    return centre;
  };
  for (const r of racines) { placer(r, 0); curseur += ECART_FRERE; }
  return positions;
}

/** Positions en grille, dans l'ordre de lecture. */
function positionsGrille(blocs) {
  const tries = blocs.slice().sort(lecture);
  const colonnes = Math.ceil(Math.sqrt(tries.length));
  const l = Math.max(...tries.map((b) => b.largeur));
  const h = Math.max(...tries.map((b) => b.hauteur));
  const positions = new Map();
  tries.forEach((b, i) => {
    const c = i % colonnes;
    const r = Math.floor(i / colonnes);
    // Chaque bloc est centré dans sa case.
    positions.set(b.id, { x: c * (l + 40) + (l - b.largeur) / 2, y: r * (h + 40) + (h - b.hauteur) / 2 });
  });
  return positions;
}

/**
 * Range les blocs « ids » (ou tous les blocs du schéma si ids est vide).
 * Renvoie le nombre de blocs rangés.
 */
export function ranger(sens, ids = null) {
  const tous = listeBlocs(etat.schema);
  const blocs = ids && ids.length ? tous.filter((b) => ids.includes(b.id)) : tous;
  if (blocs.length < 2) { annoncer('Il faut au moins deux blocs à ranger.'); return 0; }
  const origine = englobant(blocs);
  const positions = sens === 'grille' ? positionsGrille(blocs) : positionsArbre(foret(blocs), sens);
  let x0 = origine.x;
  let y0 = origine.y;
  if (etat.reglages.grille) { x0 = surGrille(x0); y0 = surGrille(y0); }
  for (const b of blocs) {
    const p = positions.get(b.id);
    let x = x0 + p.x;
    let y = y0 + p.y;
    if (etat.reglages.grille) { x = Math.round(x / (GRILLE / 2)) * (GRILLE / 2); y = Math.round(y / (GRILLE / 2)) * (GRILLE / 2); }
    b.x = x;
    b.y = y;
  }
  valider();
  const quoi = { droite: 'en arbre vers la droite', bas: 'en arbre vers le bas', grille: 'en grille' }[sens];
  annoncer(`${blocs.length} blocs rangés ${quoi} (Annuler pour revenir)`);
  return blocs.length;
}
