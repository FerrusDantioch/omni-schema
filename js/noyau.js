// =====================================================================
// Le « noyau » : l'état de l'application et toutes les actions qui
// modifient le schéma. Les autres fichiers (gestes, boutons, clavier)
// passent par ici, ce qui garantit que chaque modification :
//   1. est enregistrée dans l'historique (annuler / rétablir),
//   2. déclenche la sauvegarde automatique,
//   3. met à jour l'affichage.
// =====================================================================

import { BLOC_DEFAUT, BLOC_MIN, ZONE_MIN, BANDE_ZONE, CLE_REGLAGES, CLE_DERNIER, GRILLE, ZOOM_MIN, ZOOM_MAX } from './config.js';
import { creerBloc, creerFleche, creerZone, trouver, listeBlocs, listeCadres, nouvelId } from './modele.js';
import { creerHistorique } from './historique.js';
import { enregistrerSchema } from './stockage.js';
import { englobant, surGrille, contenuZone as contenuZoneDe } from './geometrie.js';

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
  presentation: false,   // vrai pendant le mode présentation (ou la vue présentateur)
  presentateur: false,   // vrai pendant la vue présentateur (deux écrans)
  groupe: null,          // sélection multiple : tableau d'ids de blocs (null = inactive)
  rectangle: null,       // rectangle de sélection en cours { x1, y1, x2, y2 }
  recherche: null,       // résultats de la recherche { ids: Set, actuel } (null = pas de recherche)
  pile: [],              // sous-schémas : schémas parents ouverts avant celui-ci [{ id, titre }]
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

export function notifier() {
  selectionConnue = photoSelection(); // sélection « d'avant » pour la prochaine action
  for (const fn of ecouteurs) fn();
}

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

// Sélection (simple ou multiple), retenue avec chaque action de l'historique.
const photoSelection = () => ({ selection: etat.selection, groupe: etat.groupe ? [...etat.groupe] : null });
let selectionConnue = { selection: null, groupe: null };

/**
 * Ouvre un schéma : remet l'historique à zéro et cadre la vue.
 * « pile » : les schémas parents quand on entre dans un sous-schéma
 * (sinon on repart d'une pile vide).
 */
export function ouvrirSchema(schema, { pile = [] } = {}) {
  etat.schema = schema;
  etat.pile = pile;
  etat.selection = null;
  etat.groupe = null;
  etat.rectangle = null;
  etat.editionId = null;
  etat.guides = [];
  etat.liaison = null;
  selectionConnue = photoSelection();
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
  if (historique.valider(photo(), selectionConnue, photoSelection())) {
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

function restaurer({ photo: s, selection }) {
  etat.schema.elements = JSON.parse(s);
  if (selection) {
    etat.selection = selection.selection;
    etat.groupe = selection.groupe ? [...selection.groupe] : null;
  }
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
  if (etat.groupe) {
    etat.groupe = etat.groupe.filter((id) => trouver(etat.schema, id));
    if (!etat.groupe.length) etat.groupe = null;
  }
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
  const boite = etat.schema ? englobant(listeCadres(etat.schema)) : null;
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

/**
 * Centre la vue sur un élément (résultat de recherche). Le zoom est
 * gardé, sauf s'il est si petit que l'élément serait illisible.
 */
export function centrerSur(id) {
  const e = trouver(etat.schema, id);
  if (!e) return;
  let c;
  if (e.type === 'fleche') {
    const A = trouver(etat.schema, e.de);
    const B = trouver(etat.schema, e.vers);
    if (!A || !B) return;
    c = { x: (A.x + A.largeur / 2 + B.x + B.largeur / 2) / 2, y: (A.y + A.hauteur / 2 + B.y + B.hauteur / 2) / 2 };
  } else {
    c = { x: e.x + e.largeur / 2, y: e.y + e.hauteur / 2 };
  }
  const { largeur, hauteur } = tailleZone();
  const k = etat.vue.k < 0.5 ? 1 : etat.vue.k;
  // Un peu plus bas que le milieu : la barre de recherche occupe le haut.
  etat.vue = { k, x: largeur / 2 - c.x * k, y: hauteur / 2 + 24 - c.y * k };
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
  if (etat.selection === id && !etat.groupe) return;
  etat.selection = id;
  etat.groupe = null; // choisir un seul élément quitte la sélection multiple
  demanderRendu();
  notifier();
}

// ---------------------------------------------------------------------
// Sélection multiple (« groupe ») : seulement des blocs
// ---------------------------------------------------------------------

/** Blocs concernés par la sélection : le groupe, ou le bloc choisi seul. */
export function blocsSelectionnes() {
  if (etat.groupe) return etat.groupe.map((id) => trouver(etat.schema, id)).filter(Boolean);
  const e = trouver(etat.schema, etat.selection);
  return e && e.type === 'bloc' ? [e] : [];
}

/** Active la sélection multiple avec ces blocs. */
export function entrerGroupe(ids) {
  etat.groupe = [...new Set(ids)];
  etat.selection = null;
  if (!etat.groupe.length) etat.groupe = null;
  demanderRendu();
  notifier();
}

/** Ajoute un bloc au groupe, ou l'en retire (le groupe démarre au besoin). */
export function basculerDansGroupe(id) {
  if (!etat.groupe) {
    const actuel = trouver(etat.schema, etat.selection);
    etat.groupe = actuel && actuel.type === 'bloc' && actuel.id !== id ? [actuel.id] : [];
  }
  const i = etat.groupe.indexOf(id);
  if (i >= 0) etat.groupe.splice(i, 1);
  else etat.groupe.push(id);
  etat.selection = null;
  if (!etat.groupe.length) etat.groupe = null;
  demanderRendu();
  notifier();
}

export function toutSelectionner() {
  entrerGroupe(listeBlocs(etat.schema).map((b) => b.id));
}

/** Applique une modification à chaque bloc sélectionné (une seule action annulable). */
export function modifierChaque(fonction) {
  const blocs = blocsSelectionnes();
  if (!blocs.length) return;
  for (const b of blocs) fonction(b);
  valider();
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
  if (etat.groupe) {
    // Copie des blocs du groupe ET des flèches qui les relient entre eux.
    const correspondance = new Map();
    for (const b of blocsSelectionnes()) {
      const copie = { ...b, id: nouvelId('b'), x: b.x + GRILLE * 2, y: b.y + GRILLE * 2 };
      correspondance.set(b.id, copie.id);
      etat.schema.elements.push(copie);
    }
    for (const f of etat.schema.elements.filter((e) => e.type === 'fleche')) {
      if (correspondance.has(f.de) && correspondance.has(f.vers)) {
        etat.schema.elements.push({ ...f, id: nouvelId('f'), de: correspondance.get(f.de), vers: correspondance.get(f.vers) });
      }
    }
    etat.groupe = [...correspondance.values()];
    valider();
    annoncer(`${correspondance.size} blocs dupliqués`);
    return;
  }
  const b = trouver(etat.schema, etat.selection);
  if (!b || (b.type !== 'bloc' && b.type !== 'zone')) return;
  const copie = { ...b, id: nouvelId(b.type === 'zone' ? 'z' : 'b'), x: b.x + GRILLE, y: b.y + GRILLE };
  // Une zone copiée reste derrière les autres : on l'insère juste après l'originale.
  if (b.type === 'zone') etat.schema.elements.splice(etat.schema.elements.indexOf(b) + 1, 0, copie);
  else etat.schema.elements.push(copie);
  etat.selection = copie.id;
  valider();
  annoncer(b.type === 'zone' ? 'Zone dupliquée (sans ses blocs)' : 'Bloc dupliqué');
}

export function supprimerSelection() {
  if (etat.groupe) {
    const ids = new Set(etat.groupe);
    etat.schema.elements = etat.schema.elements.filter((x) => !ids.has(x.id) && !ids.has(x.de) && !ids.has(x.vers));
    etat.groupe = null;
    valider();
    annoncer(`${ids.size} bloc${ids.size > 1 ? 's' : ''} supprimé${ids.size > 1 ? 's' : ''} (Annuler pour les récupérer)`);
    return;
  }
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
  annoncer({ bloc: 'Bloc supprimé (Annuler pour le récupérer)', zone: 'Zone supprimée (ses blocs restent)', fleche: 'Flèche supprimée' }[e.type]);
}

/** Modifie une ou plusieurs propriétés de l'élément sélectionné. */
export function modifierSelection(changements) {
  if (etat.groupe) { modifierChaque((b) => Object.assign(b, changements)); return; }
  const e = trouver(etat.schema, etat.selection);
  if (!e) return;
  Object.assign(e, changements);
  valider();
}

/** Déplace le bloc sélectionné (clavier). Pas de validation immédiate. */
export function decalerSelection(dx, dy) {
  if (etat.groupe) {
    for (const b of blocsSelectionnes()) { b.x += dx; b.y += dy; }
    demanderRendu();
    return true;
  }
  const b = trouver(etat.schema, etat.selection);
  if (!b || (b.type !== 'bloc' && b.type !== 'zone')) return false;
  // Une zone emmène les blocs (et les zones) qu'elle contient.
  const emmenes = b.type === 'zone' ? contenuZone(b) : [];
  for (const e of [b, ...emmenes]) { e.x += dx; e.y += dy; }
  demanderRendu();
  return true;
}

/** Redimensionne le bloc sélectionné (clavier). */
export function agrandirSelection(dl, dh) {
  const b = trouver(etat.schema, etat.selection);
  if (!b || (b.type !== 'bloc' && b.type !== 'zone')) return false;
  const min = b.type === 'zone' ? ZONE_MIN : BLOC_MIN;
  b.largeur = Math.max(min.largeur, b.largeur + dl);
  b.hauteur = Math.max(min.hauteur, b.hauteur + dh);
  demanderRendu();
  return true;
}

// ---------------------------------------------------------------------
// Zones de regroupement
// ---------------------------------------------------------------------

/** Ce qu'une zone emmène quand on la déplace (voir geometrie.js). */
export const contenuZone = (z) => contenuZoneDe(z, etat.schema.elements);

/**
 * Après le déplacement de blocs : un bloc posé DANS une zone (son centre
 * y est) mais qui dépasse de son bord agrandit la zone. Ainsi, aucun bloc
 * n'est « à cheval » : il est clairement dedans, ou clairement dehors.
 * Renvoie le nombre de zones agrandies.
 */
export function ajusterZones(ids) {
  const zones = etat.schema.elements.filter((e) => e.type === 'zone');
  if (!zones.length) return 0;
  const marge = 16;
  const agrandies = new Set();
  for (const id of ids) {
    const b = trouver(etat.schema, id);
    if (!b || b.type !== 'bloc') continue;
    const cx = b.x + b.largeur / 2;
    const cy = b.y + b.hauteur / 2;
    for (const z of zones) {
      if (cx < z.x || cx > z.x + z.largeur || cy < z.y || cy > z.y + z.hauteur) continue;
      let x1 = z.x, y1 = z.y, x2 = z.x + z.largeur, y2 = z.y + z.hauteur;
      if (b.x < x1) x1 = b.x - marge;
      if (b.y < y1 + BANDE_ZONE) y1 = b.y - BANDE_ZONE - 4; // le titre reste lisible
      if (b.x + b.largeur > x2) x2 = b.x + b.largeur + marge;
      if (b.y + b.hauteur > y2) y2 = b.y + b.hauteur + marge;
      if (x1 === z.x && y1 === z.y && x2 === z.x + z.largeur && y2 === z.y + z.hauteur) continue;
      if (etat.reglages.grille) {
        x1 = Math.floor(x1 / GRILLE) * GRILLE; y1 = Math.floor(y1 / GRILLE) * GRILLE;
        x2 = Math.ceil(x2 / GRILLE) * GRILLE; y2 = Math.ceil(y2 / GRILLE) * GRILLE;
      }
      Object.assign(z, { x: x1, y: y1, largeur: x2 - x1, hauteur: y2 - y1 });
      agrandies.add(z.id);
    }
  }
  return agrandies.size;
}

/**
 * Ajoute une zone. Si des blocs sont choisis, la zone les entoure ;
 * sinon elle apparaît au centre de l'écran. Les zones sont rangées au
 * début de la liste : elles restent derrière les blocs.
 */
export function ajouterZone() {
  const blocs = blocsSelectionnes();
  let place;
  if (blocs.length) {
    const boite = englobant(blocs);
    const marge = 24;
    place = {
      x: boite.x - marge,
      y: boite.y - marge - BANDE_ZONE,
      largeur: boite.largeur + 2 * marge,
      hauteur: boite.hauteur + 2 * marge + BANDE_ZONE,
    };
    if (etat.reglages.grille) {
      const x2 = surGrille(place.x + place.largeur + GRILLE / 2);
      const y2 = surGrille(place.y + place.hauteur + GRILLE / 2);
      place.x = surGrille(place.x - GRILLE / 2);
      place.y = surGrille(place.y - GRILLE / 2);
      place.largeur = x2 - place.x;
      place.hauteur = y2 - place.y;
    }
  } else {
    const c = centreVue();
    place = { x: c.x - 200, y: c.y - 130, largeur: 400, hauteur: 260 };
    if (etat.reglages.grille) { place.x = surGrille(place.x); place.y = surGrille(place.y); }
  }
  const zone = creerZone(place);
  etat.schema.elements.unshift(zone);
  etat.groupe = null;
  etat.selection = zone.id;
  valider();
  annoncer(blocs.length ? 'Zone créée autour des blocs choisis' : 'Zone créée : place des blocs dedans');
  return zone;
}

// ---------------------------------------------------------------------
// Aligner, répartir, même taille (sélection multiple)
// ---------------------------------------------------------------------

/**
 * Aligne les blocs choisis. « comment » : gauche, centre, droite
 * (horizontalement), haut, milieu, bas (verticalement). On s'aligne sur
 * le rectangle qui entoure tous les blocs choisis.
 */
export function alignerSelection(comment) {
  const blocs = blocsSelectionnes();
  if (blocs.length < 2) return;
  const boite = englobant(blocs);
  for (const b of blocs) {
    switch (comment) {
      case 'gauche': b.x = boite.x; break;
      case 'centre': b.x = boite.x + (boite.largeur - b.largeur) / 2; break;
      case 'droite': b.x = boite.x + boite.largeur - b.largeur; break;
      case 'haut': b.y = boite.y; break;
      case 'milieu': b.y = boite.y + (boite.hauteur - b.hauteur) / 2; break;
      case 'bas': b.y = boite.y + boite.hauteur - b.hauteur; break;
      default: break;
    }
  }
  valider();
}

/**
 * Répartit les blocs à intervalles égaux (le premier et le dernier ne
 * bougent pas ; l'écart entre deux blocs voisins devient le même).
 */
export function repartirSelection(sens) {
  const blocs = blocsSelectionnes();
  if (blocs.length < 3) return;
  const [pos, taille] = sens === 'horizontal' ? ['x', 'largeur'] : ['y', 'hauteur'];
  const tries = blocs.slice().sort((a, b) => (a[pos] + a[taille] / 2) - (b[pos] + b[taille] / 2));
  const premier = tries[0];
  const dernier = tries[tries.length - 1];
  const occupe = tries.reduce((t, b) => t + b[taille], 0);
  const ecart = (dernier[pos] + dernier[taille] - premier[pos] - occupe) / (tries.length - 1);
  let courant = premier[pos] + premier[taille] + ecart;
  for (const b of tries.slice(1, -1)) {
    b[pos] = courant;
    courant += b[taille] + ecart;
  }
  valider();
}

/** Donne à tous les blocs choisis la plus grande largeur (ou hauteur) du groupe. */
export function memeTailleSelection(dimension) {
  const blocs = blocsSelectionnes();
  if (blocs.length < 2) return;
  const max = Math.max(...blocs.map((b) => b[dimension]));
  for (const b of blocs) b[dimension] = max;
  valider();
}
