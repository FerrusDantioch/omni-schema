// =====================================================================
// Copier, couper, coller des blocs (avec leurs flèches et leurs images).
//
// Le « presse-papiers » d'omni-schema est rangé sur l'appareil
// (localStorage), ce qui permet de copier dans un schéma et de coller
// dans un autre, même dans un autre onglet ou après avoir rouvert
// l'application. Rien ne sort de l'appareil.
//
// Avec un clavier, Ctrl+C / Ctrl+X / Ctrl+V passent par les événements
// standard du navigateur (« copy », « cut », « paste ») :
//   - copier met aussi le TEXTE des blocs dans le presse-papiers du
//     système, pour le coller dans une autre application ;
//   - coller un texte venu d'ailleurs crée un bloc avec ce texte ;
//   - coller une image (capture d'écran…) crée un bloc avec cette image.
// =====================================================================

import { GRILLE, VERSION_FORMAT } from './config.js';
import { migrer, nouvelId, listeBlocs } from './modele.js';
import { englobant, surGrille } from './geometrie.js';
import {
  etat, valider, blocsSelectionnes, supprimerSelection, ajouterBloc, centreVue, annoncer, notifier, rendreVisible,
} from './noyau.js';
import { preparerImage } from './images.js';

const CLE = 'omni-schema.presse-papiers';
let memoire = null; // copie de secours si le stockage local est plein ou indisponible

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Contenu copié (ou null s'il n'y a rien). */
export function lirePressePapiers() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) {
      const contenu = JSON.parse(brut);
      if (contenu && contenu.format === 'omni-schema-copie' && Array.isArray(contenu.elements)) return contenu;
    }
  } catch { /* stockage indisponible : on se rabat sur la mémoire */ }
  return memoire;
}

// Réponse mémorisée (évite de relire le stockage à chaque mise à jour des boutons).
let rempli = null;
export function pressePapiersRempli() {
  if (rempli === null) rempli = !!lirePressePapiers();
  return rempli;
}

/**
 * Copie les blocs choisis (le bloc seul ou le groupe), les flèches qui
 * les relient entre eux et leurs images. Renvoie le nombre de blocs copiés.
 */
export function copierSelection() {
  const blocs = blocsSelectionnes();
  if (!blocs.length) return 0;
  const ids = new Set(blocs.map((b) => b.id));
  const fleches = etat.schema.elements.filter((e) => e.type === 'fleche' && ids.has(e.de) && ids.has(e.vers));
  const images = {};
  for (const b of blocs) {
    if (b.image && etat.schema.images && etat.schema.images[b.image]) images[b.image] = etat.schema.images[b.image];
  }
  const contenu = {
    format: 'omni-schema-copie',
    version_format: VERSION_FORMAT,
    copie_le: new Date().toISOString(),
    elements: JSON.parse(JSON.stringify([...blocs, ...fleches])),
    images,
    // Texte des blocs, tel qu'il part vers les autres applications.
    texte: blocs.map((b) => b.texte.trim()).filter(Boolean).join('\n\n'),
  };
  memoire = contenu;
  rempli = true;
  try {
    localStorage.setItem(CLE, JSON.stringify(contenu));
  } catch {
    // Trop gros pour le stockage local (grandes images) : la copie reste
    // utilisable dans cet onglet, mais pas dans un autre.
    try { localStorage.removeItem(CLE); } catch { /* rien */ }
  }
  notifier();
  return blocs.length;
}

/**
 * Bouton « Copier » (sans clavier) : copie, et tente aussi de mettre le
 * texte des blocs dans le presse-papiers du système.
 */
export function copierDepuisBouton() {
  const n = copierSelection();
  if (!n) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lirePressePapiers().texte || '').catch(() => {});
  } catch { /* pas grave : la copie interne suffit */ }
  annoncer(`${pluriel(n, 'bloc')} copié${n > 1 ? 's' : ''}. Touche « Coller » dans ce schéma ou dans un autre.`, 3500);
}

/** Copie puis supprime (Ctrl+X). */
export function couperSelection() {
  const n = copierSelection();
  if (!n) return 0;
  supprimerSelection();
  annoncer(`${pluriel(n, 'bloc')} coupé${n > 1 ? 's' : ''} : colle-les où tu veux.`);
  return n;
}

/**
 * Colle le contenu copié au centre de l'écran, avec de nouveaux
 * identifiants, en le décalant s'il recouvrirait des blocs existants.
 * Les blocs collés sont ensuite choisis (seul ou en groupe).
 */
export function coller(contenu = lirePressePapiers()) {
  if (!contenu || !etat.schema) return 0;
  // On passe par migrer() : même contrôle que pour un fichier importé
  // (anciens formats convertis, valeurs abîmées corrigées).
  let propre;
  try {
    propre = migrer({ format: 'omni-schema', titre: 'copie', version_format: contenu.version_format, elements: contenu.elements, images: contenu.images });
  } catch (erreur) {
    annoncer(erreur.message, 6000);
    return 0;
  }
  const blocs = listeBlocs(propre);
  if (!blocs.length) return 0;

  // Images : on garde l'identifiant s'il est libre ou identique, sinon on en crée un.
  etat.schema.images = etat.schema.images || {};
  const imagesRenommees = new Map();
  for (const [id, donnees] of Object.entries(propre.images)) {
    let nouvel = id;
    if (etat.schema.images[id] && etat.schema.images[id] !== donnees) nouvel = nouvelId('i');
    etat.schema.images[nouvel] = donnees;
    imagesRenommees.set(id, nouvel);
  }

  // Position : centré sur l'écran, puis décalé tant qu'il y a chevauchement.
  const boite = englobant(blocs);
  const c = centreVue();
  let dx = c.x - (boite.x + boite.largeur / 2);
  let dy = c.y - (boite.y + boite.hauteur / 2);
  if (etat.reglages.grille) { dx = surGrille(boite.x + dx) - boite.x; dy = surGrille(boite.y + dy) - boite.y; }
  const existants = listeBlocs(etat.schema);
  const marge = 12;
  const chevauche = () => blocs.some((b) => existants.some((o) => b.x + dx < o.x + o.largeur + marge && b.x + dx + b.largeur + marge > o.x
    && b.y + dy < o.y + o.hauteur + marge && b.y + dy + b.hauteur + marge > o.y));
  for (let essai = 0; essai < 40 && chevauche(); essai++) { dx += GRILLE * 2; dy += GRILLE * 2; }

  // Nouveaux identifiants, flèches rebranchées sur les copies.
  const correspondance = new Map();
  for (const b of blocs) {
    const copie = { ...b, id: nouvelId('b'), x: b.x + dx, y: b.y + dy, image: b.image ? imagesRenommees.get(b.image) || '' : '' };
    correspondance.set(b.id, copie.id);
    etat.schema.elements.push(copie);
  }
  for (const f of propre.elements.filter((e) => e.type === 'fleche')) {
    etat.schema.elements.push({ ...f, id: nouvelId('f'), de: correspondance.get(f.de), vers: correspondance.get(f.vers) });
  }

  const nouveaux = [...correspondance.values()];
  if (nouveaux.length === 1) { etat.selection = nouveaux[0]; etat.groupe = null; }
  else { etat.selection = null; etat.groupe = nouveaux; }
  valider();
  if (nouveaux.length === 1) rendreVisible(nouveaux[0]);
  annoncer(`${pluriel(nouveaux.length, 'bloc')} collé${nouveaux.length > 1 ? 's' : ''}`);
  return nouveaux.length;
}

/** Crée un bloc à partir d'un texte venu d'une autre application. */
function collerTexte(texte) {
  const propre = texte.replace(/\r\n?/g, '\n').trim().slice(0, 2000);
  if (!propre) return;
  ajouterBloc(centreVue(), { texte: propre });
  annoncer('Texte collé dans un nouveau bloc');
}

/** Crée un bloc avec une image collée (capture d'écran, image copiée…). */
async function collerImage(fichier) {
  try {
    annoncer('Préparation de l\'image…', 10000);
    const donnees = await preparerImage(fichier);
    const id = nouvelId('i');
    etat.schema.images = etat.schema.images || {};
    etat.schema.images[id] = donnees;
    ajouterBloc(centreVue(), { image: id, largeur: 200, hauteur: 160 });
    annoncer('Image collée dans un nouveau bloc');
  } catch (erreur) {
    annoncer(erreur.message, 6000);
  }
}

/**
 * Branche Ctrl+C / Ctrl+X / Ctrl+V. « actif » dit si les raccourcis de
 * la toile sont permis en ce moment (pas de saisie, de fenêtre ouverte…).
 */
export function installerPressePapiers({ actif }) {
  const champ = (e) => {
    const c = e.target;
    return c && (c.tagName === 'INPUT' || c.tagName === 'TEXTAREA' || c.isContentEditable);
  };
  // Du texte sélectionné dans la page (À propos, aide…) : copie normale.
  const texteChoisi = () => { const s = window.getSelection(); return s && !s.isCollapsed && String(s).trim(); };

  document.addEventListener('copy', (e) => {
    if (champ(e) || !actif() || texteChoisi()) return;
    const n = copierSelection();
    if (!n) return;
    e.preventDefault();
    if (e.clipboardData) e.clipboardData.setData('text/plain', lirePressePapiers().texte || '');
    annoncer(`${pluriel(n, 'bloc')} copié${n > 1 ? 's' : ''}`);
  });

  document.addEventListener('cut', (e) => {
    if (champ(e) || !actif() || texteChoisi()) return;
    if (!blocsSelectionnes().length) return;
    e.preventDefault();
    couperSelection();
    if (e.clipboardData) e.clipboardData.setData('text/plain', lirePressePapiers().texte || '');
  });

  document.addEventListener('paste', (e) => {
    if (champ(e) || !actif()) return;
    const donnees = e.clipboardData;
    const fichier = donnees && [...donnees.files].find((f) => f.type.startsWith('image/'));
    const texte = donnees ? donnees.getData('text/plain') : '';
    const interne = lirePressePapiers();
    e.preventDefault();
    if (fichier) { collerImage(fichier); return; }
    // Le texte du système est celui de notre dernière copie (ou vide) :
    // on colle les blocs. Sinon, c'est un texte venu d'ailleurs.
    if (interne && (!texte.trim() || texte.trim() === (interne.texte || '').trim())) { coller(interne); return; }
    if (texte.trim()) { collerTexte(texte); return; }
    if (interne) coller(interne);
  });

  // Une copie faite dans un autre onglet : le bouton « Coller » se met à jour.
  window.addEventListener('storage', (e) => { if (e.key === CLE) { rempli = null; notifier(); } });
}
