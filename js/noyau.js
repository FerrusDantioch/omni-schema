// =====================================================================
// Le « noyau » : l'état de l'application et toutes les actions qui
// modifient le schéma. Les autres fichiers (gestes, boutons, clavier)
// passent par ici, ce qui garantit que chaque modification :
//   1. est enregistrée dans l'historique (annuler / rétablir),
//   2. déclenche la sauvegarde automatique,
//   3. met à jour l'affichage.
// =====================================================================

import { BLOC_DEFAUT, BLOC_MIN, CLE_REGLAGES, CLE_DERNIER, GRILLE, ZOOM_MIN, ZOOM_MAX } from './config.js';
import { creerBloc, creerFleche, trouver, listeBlocs, nouvelId } from './modele.js';
import { creerHistorique } from './historique.js';
import { enregistrerSchema } from './stockage.js';
import { englobant, surGrille } from './geometrie.js';

// ---------------------------------------------------------------------
// État partagé
// ---------------------------------------------------------------------
export const etat = {
  schema: null,          // le schéma ouvert
  selection: null,       // id de l'élément sélectionné (bloc ou flèche)
  vue: { x: 0, y: 0, k: 1 }, // déplacement (x, y) et zoom (k) de la vue
  reglages: lireReglages(),
  themeResolu: 'violet', // thème réellement affiché (« auto » résolu)
  editionId: null,       // bloc dont on modifie le texte
  guides: [],            // lignes d'alignement affichées pendant un déplacement
  liaison: null,         // flèche en cours de création { de, x, y, cible }
  gesteEnCours: false,   // vrai pendant qu'un doigt / la souris agit
  presentation: false,   // vrai pendant le mode présentation
};

const historique = creerHistorique();
let rendu = null;
let renduPrevu = false;
const ecouteurs = new Set();
const apresRendu = new Set();

function lireReglages() {
  const defaut = { theme: 'auto', taille: 100, grille: true, guides: true, pastilles: true, fondu: false };
  try {
    return { ...defaut, ...(JSON.parse(localStorage.getItem(CLE_REGLAGES) || '{}') || {}) };
  } catch {
    return defaut;
  }
}

export function enregistrerReglages() {
  try { localStorage.setItem(CLE_REGLAGES, JSON.stringify(etat.reglages)); } catch { /* stockage indisponible */ }
}

/** Branche le moteur de rendu. */
export function brancherRendu(r) { rendu = r; }

/** Être prévenu quand l'interface doit se mettre à jour (boutons, titre…). */
export function surChangement(fn) { ecouteurs.add(fn); }
/** Être prévenu après chaque dessin (ex. replacer le champ de texte). */
export function surRendu(fn) { apresRendu.add(fn); }

export function notifier() { for (const fn of ecouteurs) fn(); }

/** Demande un dessin au prochain rafraîchissement d'écran (au plus 1 par image). */
export function demanderRendu() {
  if (renduPrevu || !rendu) return;
  renduPrevu = true;
  requestAnimationFrame(() => {
    renduPrevu = false;
    rendu.rendre(etat);
    for (const fn of apresRendu) fn();
  });
}

export const tailleZone = () => (rendu ? rendu.tailleZone() : { largeur: 800, hauteur: 600 });

// ---------------------------------------------------------------------
// Historique et sauvegarde automatique
// ---------------------------------------------------------------------
const photo = () => JSON.stringify(etat.schema.elements);

/** Ouvre un schéma : remet l'historique à zéro et cadre la vue. */
export function ouvrirSchema(schema) {
  etat.schema = schema;
  etat.selection = null;
  etat.editionId = null;
  etat.guides = [];
  etat.liaison = null;
  historique.reinitialiser(photo());
  if (rendu) rendu.vider();
  try { localStorage.setItem(CLE_DERNIER, schema.id); } catch { /* rien */ }
  recentrer();
  notifier();
}

/**
 * À appeler à la FIN de chaque action de l'utilisateur. Si le schéma a
 * changé, on l'ajoute à l'historique et on programme une sauvegarde.
 */
export function valider() {
  if (!etat.schema) return;
  if (historique.valider(photo())) {
    etat.schema.modifie_le = new Date().toISOString();
    programmerSauvegarde();
  }
  verifierSelection();
  demanderRendu();
  notifier();
}

/** Abandonne les modifications en cours non validées (geste interrompu). */
export function abandonner() {
  if (!etat.schema) return;
  etat.schema.elements = JSON.parse(historique.courant());
  etat.guides = [];
  etat.liaison = null;
  verifierSelection();
  demanderRendu();
  notifier();
}

export function annuler() {
  if (etat.gesteEnCours || etat.editionId) return;
  const s = historique.annuler();
  if (s === null) return;
  restaurer(s);
  annoncer('Action annulée');
}

export function retablir() {
  if (etat.gesteEnCours || etat.editionId) return;
  const s = historique.retablir();
  if (s === null) return;
  restaurer(s);
  annoncer('Action rétablie');
}

function restaurer(s) {
  etat.schema.elements = JSON.parse(s);
  etat.schema.modifie_le = new Date().toISOString();
  verifierSelection();
  programmerSauvegarde();
  demanderRendu();
  notifier();
}

export const peutAnnuler = () => historique.peutAnnuler();
export const peutRetablir = () => historique.peutRetablir();

function verifierSelection() {
  if (etat.selection && !trouver(etat.schema, etat.selection)) etat.selection = null;
}

let minuterieSauvegarde = null;
/** Sauvegarde un peu plus tard (regroupe les modifications rapprochées). */
export function programmerSauvegarde() {
  clearTimeout(minuterieSauvegarde);
  minuterieSauvegarde = setTimeout(sauvegarderMaintenant, 500);
}

/**
 * Sauvegarde immédiate. On enregistre le dernier état VALIDÉ (pas un
 * déplacement à moitié fait).
 */
export async function sauvegarderMaintenant() {
  clearTimeout(minuterieSauvegarde);
  minuterieSauvegarde = null;
  if (!etat.schema) return;
  const copie = { ...etat.schema, elements: JSON.parse(historique.courant()) };
  try {
    await enregistrerSchema(copie);
  } catch (erreur) {
    console.error(erreur);
    annoncer('Attention : la sauvegarde a échoué. Exporte ton schéma en .json par sécurité.', 8000);
  }
}

export function renommer(titre) {
  const propre = String(titre || '').trim().slice(0, 200);
  if (!propre || !etat.schema) return;
  etat.schema.titre = propre;
  etat.schema.modifie_le = new Date().toISOString();
  sauvegarderMaintenant();
  notifier();
}

// ---------------------------------------------------------------------
// Messages courts (zone « annonce », lue aussi par les lecteurs d'écran)
// ---------------------------------------------------------------------
let minuterieAnnonce = null;
export function annoncer(message, duree = 2500) {
  const zone = document.getElementById('annonce');
  if (!zone) return;
  zone.textContent = message;
  zone.classList.add('visible');
  clearTimeout(minuterieAnnonce);
  minuterieAnnonce = setTimeout(() => zone.classList.remove('visible'), duree);
}

// ---------------------------------------------------------------------
// Vue : déplacement et zoom
// ---------------------------------------------------------------------
export const borneZoom = (k) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));

/** Zoome d'un facteur en gardant fixe le point (sx, sy) de l'écran. */
export function zoomerAutour(facteur, sx, sy) {
  const v = etat.vue;
  const k = borneZoom(v.k * facteur);
  const mx = (sx - v.x) / v.k;
  const my = (sy - v.y) / v.k;
  etat.vue = { k, x: sx - mx * k, y: sy - my * k };
  demanderRendu();
}

/** Zoom depuis le centre de l'écran (boutons + et −). */
export function zoomerCentre(facteur) {
  const { largeur, hauteur } = tailleZone();
  zoomerAutour(facteur, largeur / 2, hauteur / 2);
}

/** Cadre la vue pour voir tout le schéma. */
export function recentrer() {
  const { largeur, hauteur } = tailleZone();
  const boite = etat.schema ? englobant(listeBlocs(etat.schema)) : null;
  if (!boite || !largeur || !hauteur) {
    etat.vue = { x: largeur / 2, y: hauteur / 3, k: 1 };
  } else {
    const marge = 40;
    const k = borneZoom(Math.min((largeur - 2 * marge) / boite.largeur, (hauteur - 2 * marge) / boite.hauteur, 1.5));
    etat.vue = {
      k,
      x: largeur / 2 - (boite.x + boite.largeur / 2) * k,
      y: hauteur / 2 - (boite.y + boite.hauteur / 2) * k,
    };
  }
  demanderRendu();
}

/** Point du schéma situé au centre de l'écran. */
export function centreVue() {
  const { largeur, hauteur } = tailleZone();
  const v = etat.vue;
  return { x: (largeur / 2 - v.x) / v.k, y: (hauteur / 2 - v.y) / v.k };
}

/** Déplace la vue (si besoin) pour qu'un bloc soit bien visible. */
export function rendreVisible(id) {
  const b = trouver(etat.schema, id);
  if (!b) return;
  const { largeur, hauteur } = tailleZone();
  const v = etat.vue;
  const gauche = b.x * v.k + v.x;
  const haut = b.y * v.k + v.y;
  const droite = gauche + b.largeur * v.k;
  const bas = haut + b.hauteur * v.k;
  const marge = 16;
  let dx = 0, dy = 0;
  if (droite > largeur - marge) dx = largeur - marge - droite;
  if (gauche + dx < marge) dx = marge - gauche;
  if (bas > hauteur - marge) dy = hauteur - marge - bas;
  if (haut + dy < marge) dy = marge - haut;
  if (dx || dy) {
    etat.vue = { ...v, x: v.x + dx, y: v.y + dy };
    demanderRendu();
  }
}

// ---------------------------------------------------------------------
// Actions sur les éléments
// ---------------------------------------------------------------------
export function selectionner(id) {
  if (etat.selection === id) return;
  etat.selection = id;
  demanderRendu();
  notifier();
}

/** Trouve une place libre près de (x, y) pour ne pas empiler les blocs. */
function placeLibre(x, y, largeur, hauteur, decalage) {
  const blocs = listeBlocs(etat.schema);
  const marge = 12; // espace minimal entre deux blocs
  const chevauche = (px, py) => blocs.some((b) => px < b.x + b.largeur + marge && px + largeur + marge > b.x
    && py < b.y + b.hauteur + marge && py + hauteur + marge > b.y);
  // Pas de déplacement : par défaut en diagonale ; sinon la direction demandée.
  const pas = decalage || { x: GRILLE * 2, y: GRILLE * 2 };
  for (let essai = 0; essai < 60 && chevauche(x, y); essai++) {
    x += pas.x;
    y += pas.y;
  }
  return { x, y, largeur, hauteur };
}

/** Ajoute un bloc centré sur le point (x, y) du schéma (par défaut : centre de l'écran). */
export function ajouterBloc(point = centreVue(), proprietes = {}, { sansValider = false, decalage = null } = {}) {
  const largeur = proprietes.largeur || BLOC_DEFAUT.largeur;
  const hauteur = proprietes.hauteur || BLOC_DEFAUT.hauteur;
  let x = point.x - largeur / 2;
  let y = point.y - hauteur / 2;
  if (etat.reglages.grille) { x = surGrille(x); y = surGrille(y); }
  const place = placeLibre(x, y, largeur, hauteur, decalage);
  const bloc = creerBloc({ ...proprietes, ...place });
  etat.schema.elements.push(bloc);
  etat.selection = bloc.id;
  if (!sansValider) valider();
  return bloc;
}

/** Crée une flèche entre deux blocs (sauf si elle existe déjà). */
export function relier(de, vers) {
  if (!de || !vers || de === vers) return null;
  const existe = etat.schema.elements.some((e) => e.type === 'fleche' && e.de === de && e.vers === vers);
  if (existe) { annoncer('Ces deux blocs sont déjà reliés.'); return null; }
  const fleche = creerFleche(de, vers);
  etat.schema.elements.push(fleche);
  return fleche;
}

export function dupliquerSelection() {
  const b = trouver(etat.schema, etat.selection);
  if (!b || b.type !== 'bloc') return;
  const copie = { ...b, id: nouvelId('b'), x: b.x + GRILLE, y: b.y + GRILLE };
  etat.schema.elements.push(copie);
  etat.selection = copie.id;
  valider();
  annoncer('Bloc dupliqué');
}

export function supprimerSelection() {
  const e = trouver(etat.schema, etat.selection);
  if (!e) return;
  if (e.type === 'bloc') {
    // Supprime aussi les flèches attachées à ce bloc.
    etat.schema.elements = etat.schema.elements.filter((x) => x.id !== e.id && x.de !== e.id && x.vers !== e.id);
  } else {
    etat.schema.elements = etat.schema.elements.filter((x) => x.id !== e.id);
  }
  etat.selection = null;
  valider();
  annoncer(e.type === 'bloc' ? 'Bloc supprimé (Annuler pour le récupérer)' : 'Flèche supprimée');
}

/** Modifie une ou plusieurs propriétés de l'élément sélectionné. */
export function modifierSelection(changements) {
  const e = trouver(etat.schema, etat.selection);
  if (!e) return;
  Object.assign(e, changements);
  valider();
}

/** Déplace le bloc sélectionné (clavier). Pas de validation immédiate. */
export function decalerSelection(dx, dy) {
  const b = trouver(etat.schema, etat.selection);
  if (!b || b.type !== 'bloc') return false;
  b.x += dx;
  b.y += dy;
  demanderRendu();
  return true;
}

/** Redimensionne le bloc sélectionné (clavier). */
export function agrandirSelection(dl, dh) {
  const b = trouver(etat.schema, etat.selection);
  if (!b || b.type !== 'bloc') return false;
  b.largeur = Math.max(BLOC_MIN.largeur, b.largeur + dl);
  b.hauteur = Math.max(BLOC_MIN.hauteur, b.hauteur + dh);
  demanderRendu();
  return true;
}
