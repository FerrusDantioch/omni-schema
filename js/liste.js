// =====================================================================
// Schéma depuis une liste, et plan du schéma en texte.
//
// 1) Une liste à retraits devient des blocs reliés, rangés en arbre :
//      Projet
//        - Préparer
//          - Lister les besoins
//        - Réaliser
//    - une ligne = un bloc ; une ligne plus décalée (espaces, tabulation)
//      est la « suite » de la ligne au-dessus : une flèche les relie ;
//    - les puces (-, *, •, 1., a)…) sont retirées ;
//    - les titres façon Markdown (#, ##, ###) marchent aussi ;
//    - une ligne qui commence par « > » devient la note du présentateur
//      du bloc juste au-dessus.
// 2) L'inverse : le plan du schéma (en suivant les flèches) sous forme
//    de liste à retraits, à copier dans un document.
// =====================================================================

import { creerBloc, creerFleche, listeBlocs, listeFleches, listeCadres } from './modele.js';
import { englobant, surGrille } from './geometrie.js';
import { etat, valider, centreVue, recentrer, annoncer } from './noyau.js';
import { etapeMax } from './etapes.js';

export const MAX_ELEMENTS_LISTE = 300;

const PUCE = /^(?:[-*+•–—▪◦]|\d{1,3}[.)]|[a-zA-Z][.)])\s+/;

/**
 * Lit le texte et renvoie { racines, nombre } ; chaque nœud vaut
 * { texte, note, enfants }.
 */
export function analyserListe(brut) {
  const racines = [];
  const pile = []; // { rang, noeud }
  let titreCourant = null; // niveau du dernier titre « # » (ou null)
  let dernier = null;
  let nombre = 0;
  for (const ligneBrute of String(brut || '').replace(/\r\n?/g, '\n').split('\n')) {
    const ligne = ligneBrute.replace(/\t/g, '    ');
    const contenu = ligne.trim();
    if (!contenu) continue;
    // Note du présentateur pour le bloc précédent.
    if (contenu.startsWith('>')) {
      if (dernier) dernier.note = `${dernier.note ? `${dernier.note}\n` : ''}${contenu.replace(/^>\s?/, '')}`.slice(0, 5000);
      continue;
    }
    let texte = contenu;
    let rang;
    const titre = /^(#{1,6})\s+(.*)$/.exec(contenu);
    if (titre) {
      // Les titres priment : « ## » est toujours sous « # ».
      titreCourant = titre[1].length;
      rang = (titreCourant - 1) * 1000;
      texte = titre[2];
    } else {
      const retrait = ligne.length - ligne.trimStart().length;
      rang = titreCourant === null ? retrait : (titreCourant - 1) * 1000 + 500 + retrait;
      texte = contenu.replace(PUCE, '');
    }
    texte = texte.trim().slice(0, 2000);
    if (!texte) continue;
    if (nombre >= MAX_ELEMENTS_LISTE) break;
    const noeud = { texte, note: '', enfants: [] };
    while (pile.length && pile[pile.length - 1].rang >= rang) pile.pop();
    if (pile.length) pile[pile.length - 1].noeud.enfants.push(noeud);
    else racines.push(noeud);
    pile.push({ rang, noeud });
    dernier = noeud;
    nombre++;
  }
  return { racines, nombre };
}

/** Ce texte ressemble-t-il à une liste (au moins deux lignes à puce ou décalées) ? */
export function ressembleAUneListe(texte) {
  const lignes = String(texte || '').split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length < 2) return false;
  const marquees = lignes.filter((l) => PUCE.test(l.trim()) || /^\s+\S/.test(l) || /^#{1,6}\s/.test(l.trim()));
  return marquees.length >= 2;
}

// Dimensions de l'arbre (multiples de la grille de 20).
const L = 180;          // largeur d'un bloc
const H = 80;           // hauteur d'un bloc
const PAS_NIVEAU = { droite: L + 100, bas: H + 60 };
const PAS_FRERE = { droite: H + 20, bas: L + 20 };
const COULEURS_NIVEAU = ['violet', 'bleu', 'vert', 'jaune'];

/**
 * Calcule la place de chaque nœud : chaque feuille prend une « case »,
 * un parent se centre sur ses enfants. Renvoie [{ noeud, niveau, case }].
 */
function disposer(racines) {
  const places = [];
  let prochaine = 0;
  const placer = (noeud, niveau) => {
    let c;
    if (!noeud.enfants.length) c = prochaine++;
    else {
      const cases = noeud.enfants.map((e) => placer(e, niveau + 1));
      c = (cases[0] + cases[cases.length - 1]) / 2;
    }
    places.push({ noeud, niveau, case: c });
    return c;
  };
  for (const r of racines) { placer(r, 0); prochaine += 0.5; } // un peu d'air entre deux arbres
  return places;
}

/**
 * Ajoute au schéma ouvert les blocs et flèches décrits par la liste.
 * - sens : « droite » (l'arbre pousse vers la droite) ou « bas » ;
 * - etapes : chaque bloc apparaît à son tour en présentation.
 * Une seule action (un seul « Annuler »). Renvoie le nombre de blocs créés.
 */
export function creerDepuisListe(texte, { sens = 'droite', etapes = false } = {}) {
  const { racines, nombre } = analyserListe(texte);
  if (!nombre) return 0;
  const places = disposer(racines);
  const pasNiveau = PAS_NIVEAU[sens] || PAS_NIVEAU.droite;
  const pasFrere = PAS_FRERE[sens] || PAS_FRERE.droite;
  const position = (p) => (sens === 'bas'
    ? { x: p.case * pasFrere, y: p.niveau * pasNiveau }
    : { x: p.niveau * pasNiveau, y: p.case * pasFrere });

  // Où poser l'arbre : à droite de ce qui existe déjà, sinon au centre de l'écran.
  const existant = englobant(listeCadres(etat.schema));
  const taille = englobant(places.map((p) => ({ ...position(p), largeur: L, hauteur: H })));
  let origine;
  if (existant) origine = { x: surGrille(existant.x + existant.largeur + 120), y: surGrille(existant.y) };
  else {
    const c = centreVue();
    origine = { x: surGrille(c.x - taille.largeur / 2), y: surGrille(c.y - taille.hauteur / 2) };
  }

  // Blocs, puis flèches parent → enfant (dans l'ordre de lecture du texte).
  const blocDe = new Map();
  for (const p of places) {
    const pos = position(p);
    blocDe.set(p.noeud, creerBloc({
      x: origine.x + pos.x, y: origine.y + pos.y, largeur: L, hauteur: H,
      texte: p.noeud.texte, note: p.noeud.note,
      couleur: COULEURS_NIVEAU[p.niveau] || 'neutre',
    }));
  }
  const ordre = [];
  const parcourir = (noeud) => { ordre.push(noeud); noeud.enfants.forEach(parcourir); };
  racines.forEach(parcourir);
  let etape = etapeMax(etat.schema);
  for (const noeud of ordre) {
    const b = blocDe.get(noeud);
    if (etapes) b.etape = ++etape;
    etat.schema.elements.push(b);
  }
  for (const noeud of ordre) {
    for (const enfant of noeud.enfants) {
      etat.schema.elements.push(creerFleche(blocDe.get(noeud).id, blocDe.get(enfant).id));
    }
  }
  etat.selection = null;
  etat.groupe = ordre.map((n) => blocDe.get(n).id);
  valider();
  recentrer();
  annoncer(`${nombre} bloc${nombre > 1 ? 's' : ''} créé${nombre > 1 ? 's' : ''} depuis la liste`);
  return nombre;
}

/**
 * Plan du schéma en texte : on part des blocs où n'arrive aucune flèche
 * (dans l'ordre de lecture), on suit les flèches ; chaque bloc n'apparaît
 * qu'une fois. Les blocs isolés sont ajoutés à la fin.
 */
export function planEnTexte(schema) {
  const blocs = listeBlocs(schema);
  const fleches = listeFleches(schema);
  const parId = new Map(blocs.map((b) => [b.id, b]));
  const lecture = (a, b) => (Math.abs(a.y - b.y) > 30 ? a.y - b.y : a.x - b.x);
  const enfants = new Map(blocs.map((b) => [b.id, []]));
  const arrivees = new Set();
  for (const f of fleches) {
    if (!parId.has(f.de) || !parId.has(f.vers)) continue;
    enfants.get(f.de).push(parId.get(f.vers));
    arrivees.add(f.vers);
  }
  for (const liste of enfants.values()) liste.sort(lecture);
  const vus = new Set();
  const lignes = [];
  const une = (b) => (b.texte || '').replace(/\s+/g, ' ').trim() || '(bloc sans texte)';
  const ecrire = (b, niveau) => {
    if (vus.has(b.id)) return;
    vus.add(b.id);
    lignes.push(`${'  '.repeat(niveau)}- ${une(b)}`);
    if (b.note && b.note.trim()) for (const l of b.note.trim().split('\n')) lignes.push(`${'  '.repeat(niveau + 1)}> ${l}`);
    for (const e of enfants.get(b.id)) ecrire(e, niveau + 1);
  };
  const departs = blocs.filter((b) => !arrivees.has(b.id)).sort(lecture);
  for (const b of departs) ecrire(b, 0);
  for (const b of blocs.slice().sort(lecture)) ecrire(b, 0); // boucles et blocs restants
  return lignes.join('\n');
}
