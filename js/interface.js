// =====================================================================
// Interface : barres d'outils, menu, fenêtres (dialogues), réglages,
// liste des schémas et « À propos ».
// =====================================================================

import { APP_VERSION } from './config.js';
import { COULEURS, couleurBloc, couleursToile } from './couleurs.js';
import { FORMES, STYLES_FLECHE, TRAITS, POINTES, trouver, creerSchema, migrer, nouvelId } from './modele.js';
import {
  etat, notifier, surChangement, demanderRendu, annuler, retablir, peutAnnuler, peutRetablir,
  ajouterBloc, dupliquerSelection, supprimerSelection, modifierSelection, modifierChaque, blocsSelectionnes, selectionner,
  recentrer, zoomerCentre, renommer, ouvrirSchema, sauvegarderMaintenant, enregistrerReglages, annoncer,
} from './noyau.js';
import { listerSchemas, chargerSchema, enregistrerSchema, supprimerSchema } from './stockage.js';
import { exporterSchema, exporterTout, importerFichier } from './fichiers.js';
import { etapeMax, etapesEffectives } from './etapes.js';
import { MODELES, creerDepuisModele } from './modeles.js';
import { exporterPng, exporterSvg, imprimerEtapes } from './exports.js';
import { exporterHtml } from './export-html.js';
import { themePresentation } from './presentation.js';
import { preparerImage } from './images.js';
import { copierDepuisBouton, coller, pressePapiersRempli } from './presse-papiers.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------
// Fenêtres génériques (remplacent confirm() et prompt(), plus lisibles)
// ---------------------------------------------------------------------

/** Ouvre une fenêtre de dialogue et fait marcher ses boutons « Fermer ». */
function ouvrirFenetre(dialogue) {
  if (!dialogue.open) dialogue.showModal();
}

/** Demande une confirmation. Renvoie une promesse : true si « Confirmer ». */
export function demanderConfirmation(message, libelleOk = 'Confirmer') {
  const d = $('dlg-confirmer');
  $('confirmer-message').textContent = message;
  $('confirmer-ok').textContent = libelleOk;
  d.returnValue = 'non';
  ouvrirFenetre(d);
  return new Promise((resoudre) => {
    d.addEventListener('close', () => resoudre(d.returnValue === 'oui'), { once: true });
  });
}

/** Demande un texte. Renvoie le texte, ou null si on annule. */
export function demanderTexte(question, valeur = '', { videPermis = false } = {}) {
  const d = $('dlg-saisie');
  const champ = $('saisie-champ');
  $('saisie-titre').textContent = question;
  champ.value = valeur;
  d.returnValue = 'non';
  ouvrirFenetre(d);
  champ.focus();
  champ.select();
  return new Promise((resoudre) => {
    d.addEventListener('close', () => {
      const texte = champ.value.trim();
      if (d.returnValue !== 'oui') resoudre(null);
      else if (!texte && !videPermis) resoudre(null);
      else resoudre(texte);
    }, { once: true });
  });
}

// ---------------------------------------------------------------------
// Thème et taille du texte
// ---------------------------------------------------------------------
const requeteClair = window.matchMedia('(prefers-color-scheme: light)');

export function appliquerTheme() {
  const choix = etat.reglages.theme;
  // « Automatique » : clair si l'appareil est en clair, sinon le sombre violet de l'Omni-système.
  const theme = choix === 'auto' ? (requeteClair.matches ? 'clair' : 'violet') : choix;
  etat.themeResolu = theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.fontSize = `${Number(etat.reglages.taille) || 100}%`;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--barre').trim() || couleursToile(theme).fond);
  demanderRendu();
}
requeteClair.addEventListener('change', () => { if (etat.reglages.theme === 'auto') appliquerTheme(); });

// ---------------------------------------------------------------------
// Installation de toute l'interface
// ---------------------------------------------------------------------
const reduireAnimations = window.matchMedia('(prefers-reduced-motion: reduce)');

export function installerInterface({ editeur, presentation, panneauEtapes }) {
  // --- Toutes les fenêtres : bouton « Fermer » et clic sur le fond ---
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-fermer]')) { d.close(); return; }
      if (e.target !== d) return;
      // Toucher le voile AUTOUR de la fenêtre la ferme (pas sa marge intérieure).
      const r = d.getBoundingClientRect();
      const dedans = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!dedans) d.close();
    });
  }

  // Dans la fenêtre de saisie, Entrée = Valider (par défaut, le navigateur
  // déclencherait le premier bouton du formulaire, c'est-à-dire « Annuler »).
  $('saisie-champ').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('dlg-saisie').close('oui'); }
  });

  // --- Barre du haut ---
  $('btn-menu').addEventListener('click', () => ouvrirFenetre($('dlg-menu')));
  $('btn-presenter').addEventListener('click', () => presenter(presentation, editeur));
  $('btn-annuler').addEventListener('click', annuler);
  $('btn-retablir').addEventListener('click', retablir);
  $('btn-titre').addEventListener('click', async () => {
    const titre = await demanderTexte('Nom du schéma', etat.schema.titre);
    if (titre) renommer(titre);
  });

  // --- Barre du bas : aucun élément choisi ---
  $('btn-ajouter').addEventListener('click', () => editeur.ouvrir(ajouterBloc().id));
  $('btn-grille').addEventListener('click', () => {
    etat.reglages.grille = !etat.reglages.grille;
    enregistrerReglages();
    annoncer(etat.reglages.grille ? 'Grille magnétique activée' : 'Grille magnétique désactivée');
    demanderRendu();
    notifier();
  });
  $('btn-etapes').addEventListener('click', () => panneauEtapes.ouvrir());
  $('btn-recentrer').addEventListener('click', recentrer);
  $('btn-coller').addEventListener('click', () => coller());
  $('btn-copier').addEventListener('click', copierDepuisBouton);
  $('btn-copier-groupe').addEventListener('click', copierDepuisBouton);
  $('btn-zoom-plus').addEventListener('click', () => zoomerCentre(1.25));
  $('btn-zoom-moins').addEventListener('click', () => zoomerCentre(0.8));

  // --- Barre du bas : bloc choisi ---
  $('btn-texte').addEventListener('click', () => editeur.ouvrir(etat.selection));
  for (const b of document.querySelectorAll('[data-bouton-style]')) {
    b.addEventListener('click', (e) => basculerChoix('choix-style', e.currentTarget));
  }
  // --- Barre du bas : sélection multiple ---
  $('btn-dupliquer-groupe').addEventListener('click', dupliquerSelection);
  $('btn-supprimer-groupe').addEventListener('click', supprimerSelection);
  $('btn-fermer-groupe').addEventListener('click', () => selectionner(null));
  $('btn-note').addEventListener('click', () => editerNote(etat.selection));
  for (const b of document.querySelectorAll('[data-bouton-etape]')) {
    b.addEventListener('click', (e) => basculerChoix('choix-etape', e.currentTarget));
  }
  $('btn-dupliquer').addEventListener('click', dupliquerSelection);
  $('btn-supprimer-bloc').addEventListener('click', supprimerSelection);

  // --- Barre du bas : flèche choisie ---
  $('btn-etiquette').addEventListener('click', () => editerEtiquette(etat.selection));
  $('btn-trace').addEventListener('click', (e) => basculerChoix('choix-trait', e.currentTarget));
  $('btn-inverser').addEventListener('click', () => {
    const f = trouver(etat.schema, etat.selection);
    if (f) modifierSelection({ de: f.vers, vers: f.de });
  });
  $('btn-supprimer-fleche').addEventListener('click', supprimerSelection);
  // --- Panneau « Étape » de l'élément choisi ---
  // (en sélection multiple, chaque bloc du groupe est modifié, en une seule action)
  const changerEtape = (calcul) => {
    if (etat.groupe) { modifierChaque((b) => { b.etape = Math.max(0, calcul(b.etape)); }); return; }
    const e = trouver(etat.schema, etat.selection);
    if (e) modifierSelection({ etape: Math.max(0, calcul(e.etape)) });
  };
  $('etape-moins').addEventListener('click', () => changerEtape((n) => n - 1));
  $('etape-plus').addEventListener('click', () => changerEtape((n) => n + 1));
  $('etape-zero').addEventListener('click', () => changerEtape(() => 0));
  $('etape-nouvelle').addEventListener('click', () => { const n = etapeMax(etat.schema) + 1; changerEtape(() => n); });

  // --- Image du bloc (panneau Style) ---
  $('btn-image-ajouter').addEventListener('click', () => $('fichier-image').click());
  $('btn-image-retirer').addEventListener('click', () => {
    modifierSelection({ image: '' });
    annoncer('Image retirée (Annuler pour la récupérer)');
  });
  $('fichier-image').addEventListener('change', async () => {
    const fichier = $('fichier-image').files[0];
    $('fichier-image').value = '';
    const b = trouver(etat.schema, etat.selection);
    if (!fichier || !b || b.type !== 'bloc') return;
    try {
      annoncer('Préparation de l\'image…', 10000);
      const donnees = await preparerImage(fichier);
      const id = nouvelId('i');
      etat.schema.images = etat.schema.images || {};
      etat.schema.images[id] = donnees;
      // Un bloc trop petit pour une image est agrandi un peu.
      const taille = b.hauteur < 140 ? { hauteur: 160, largeur: Math.max(b.largeur, 180) } : {};
      etat.selection = b.id;
      modifierSelection({ image: id, ...taille });
      annoncer('Image ajoutée.');
    } catch (erreur) {
      annoncer(erreur.message, 6000);
    }
  });

  // --- Note du présentateur : Entrée = retour à la ligne, Ctrl+Entrée = enregistrer ---
  $('note-champ').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('dlg-note').close('oui'); }
  });

  construireChoix();
  construireChoixTrait();
  installerNouveau();
  installerExport();
  installerMenu();
  installerReglages();
  $('version-app').textContent = APP_VERSION;

  // Logo de l'Omni-système (menu et À propos) : s'il manque, on le cache proprement.
  for (const logo of document.querySelectorAll('img[src$="logo-omni-systeme.webp"]')) {
    logo.addEventListener('error', () => { logo.hidden = true; });
  }

  surChangement(mettreAJourInterface);
  mettreAJourInterface();
}

/** Modifier l'étiquette d'une flèche. */
export async function editerEtiquette(id) {
  const f = trouver(etat.schema, id);
  if (!f || f.type !== 'fleche') return;
  const texte = await demanderTexte('Étiquette de la flèche (laisse vide pour aucune)', f.etiquette, { videPermis: true });
  if (texte === null) return;
  etat.selection = id;
  modifierSelection({ etiquette: texte.slice(0, 200) });
}

/** Fenêtre « Aide et raccourcis ». */
export function ouvrirAide() {
  ouvrirFenetre($('dlg-aide'));
}

/** Modifier la note du présentateur d'un bloc. */
export function editerNote(id) {
  const b = trouver(etat.schema, id);
  if (!b || b.type !== 'bloc') return;
  const d = $('dlg-note');
  const champ = $('note-champ');
  $('note-bloc').textContent = `Bloc : ${(b.texte || 'sans texte').replace(/\s+/g, ' ').slice(0, 60)}`;
  champ.value = b.note;
  d.returnValue = 'non';
  ouvrirFenetre(d);
  champ.focus();
  d.addEventListener('close', () => {
    if (d.returnValue !== 'oui') return;
    etat.selection = id;
    modifierSelection({ note: champ.value.replace(/\s+$/, '').slice(0, 5000) });
    annoncer(champ.value.trim() ? 'Note enregistrée' : 'Note effacée');
  }, { once: true });
}

/** Lance la présentation (après avoir terminé une éventuelle saisie). */
async function presenter(presentation, editeur) {
  editeur.terminer();
  fermerChoix();
  await sauvegarderMaintenant();
  const ok = await presentation.ouvrir();
  if (!ok) annoncer('Ajoute au moins un bloc avant de présenter.');
}

// ---------------------------------------------------------------------
// Panneau « Style » : forme et couleur
// ---------------------------------------------------------------------
function construireChoix() {
  const panneauForme = $('options-forme');
  for (const f of FORMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option-choix';
    b.dataset.forme = f.id;
    b.innerHTML = `<svg viewBox="0 0 40 28" class="apercu-forme" aria-hidden="true">${apercuForme(f.id)}</svg><span>${f.nom}</span>`;
    b.addEventListener('click', () => modifierSelection({ forme: f.id }));
    panneauForme.appendChild(b);
  }
  const panneauCouleur = $('options-couleur');
  for (const c of COULEURS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option-choix';
    b.dataset.couleur = c.id;
    b.innerHTML = `<span class="pastille" aria-hidden="true"></span><span>${c.nom}</span>`;
    b.addEventListener('click', () => modifierSelection({ couleur: c.id }));
    panneauCouleur.appendChild(b);
  }
}

// ---------------------------------------------------------------------
// Panneau « Trait » d'une flèche : tracé, trait et pointes
// ---------------------------------------------------------------------
function construireChoixTrait() {
  const options = [
    ['options-trace', 'style', STYLES_FLECHE],
    ['options-ligne', 'trait', TRAITS],
    ['options-pointes', 'pointes', POINTES],
  ];
  for (const [idPanneau, cle, liste] of options) {
    const panneau = $(idPanneau);
    for (const o of liste) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'option-choix';
      b.dataset.cle = cle;
      b.dataset.valeur = o.id;
      b.innerHTML = `<svg viewBox="0 0 40 28" class="apercu-forme" aria-hidden="true">${apercuFleche(cle, o.id)}</svg><span>${o.nom}</span>`;
      b.addEventListener('click', () => modifierSelection({ [cle]: o.id }));
      panneau.appendChild(b);
    }
  }
}

/** Petit dessin d'aperçu pour chaque option du panneau « Trait ». */
function apercuFleche(cle, valeur) {
  const trait = 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
  const pointeDroite = '<polygon points="38,14 30,9.5 30,18.5" fill="currentColor"/>';
  const pointeGauche = '<polygon points="2,14 10,9.5 10,18.5" fill="currentColor"/>';
  if (cle === 'style') {
    if (valeur === 'angle') return `<path d="M3 5 H18 V23 H30" ${trait}/><polygon points="38,23 30,18.5 30,27.5" fill="currentColor"/>`;
    if (valeur === 'courbe') return `<path d="M3 5 C20 5 14 23 30 23" ${trait}/><polygon points="38,23 30,18.5 30,27.5" fill="currentColor"/>`;
    return `<path d="M3 14 H30" ${trait}/>${pointeDroite}`;
  }
  if (cle === 'trait') {
    if (valeur === 'pointille') return `<path d="M3 14 H30" ${trait} stroke-linecap="butt" stroke-dasharray="5 4"/>${pointeDroite}`;
    return `<path d="M3 14 H30" ${trait}/>${pointeDroite}`;
  }
  if (valeur === 'deux') return `<path d="M10 14 H30" ${trait}/>${pointeGauche}${pointeDroite}`;
  if (valeur === 'aucune') return `<path d="M3 14 H37" ${trait}/>`;
  return `<path d="M3 14 H30" ${trait}/>${pointeDroite}`;
}

function apercuForme(forme) {
  const style = 'fill="none" stroke="currentColor" stroke-width="2.5"';
  switch (forme) {
    case 'rectangle': return `<rect x="3" y="3" width="34" height="22" ${style}/>`;
    case 'ovale': return `<ellipse cx="20" cy="14" rx="17" ry="11" ${style}/>`;
    case 'losange': return `<polygon points="20,2 38,14 20,26 2,14" ${style}/>`;
    default: return `<rect x="3" y="3" width="34" height="22" rx="7" ${style}/>`;
  }
}

function basculerChoix(idPanneau, bouton) {
  const panneau = $(idPanneau);
  const ouvrir = panneau.hidden;
  fermerChoix();
  if (ouvrir) {
    panneau.hidden = false;
    bouton.setAttribute('aria-expanded', 'true');
    const actif = panneau.querySelector('[aria-pressed="true"]') || panneau.querySelector('button:not(:disabled)');
    if (actif) actif.focus();
  }
}

export function fermerChoix() {
  for (const p of document.querySelectorAll('.choix')) p.hidden = true;
  for (const b of document.querySelectorAll('[aria-controls^="choix-"]')) b.setAttribute('aria-expanded', 'false');
}

// ---------------------------------------------------------------------
// Mise à jour de l'interface selon l'état
// ---------------------------------------------------------------------
function mettreAJourInterface() {
  if (!etat.schema) return;
  $('titre-schema').textContent = etat.schema.titre;
  document.title = `${etat.schema.titre} — omni-schema`;
  $('btn-annuler').disabled = !peutAnnuler();
  $('btn-retablir').disabled = !peutRetablir();
  $('btn-grille').setAttribute('aria-pressed', String(!!etat.reglages.grille));
  $('btn-coller').disabled = !pressePapiersRempli();

  const sel = trouver(etat.schema, etat.selection);
  const type = etat.groupe ? 'groupe' : (sel ? sel.type : 'aucun');
  for (const groupe of document.querySelectorAll('.groupe-outils')) {
    groupe.hidden = groupe.dataset.pour !== type;
  }
  if (type === 'aucun') fermerChoix();
  else if (type === 'fleche') $('choix-style').hidden = true;
  else $('choix-trait').hidden = true;

  if (etat.groupe) {
    const blocs = blocsSelectionnes();
    $('compte-groupe').textContent = `${blocs.length} bloc${blocs.length > 1 ? 's' : ''}`;
    $('section-image').hidden = true; // une image se met bloc par bloc
    const commun = (cle) => (blocs.length && blocs.every((b) => b[cle] === blocs[0][cle]) ? blocs[0][cle] : null);
    for (const b of document.querySelectorAll('[data-forme]')) b.setAttribute('aria-pressed', String(b.dataset.forme === commun('forme')));
    for (const b of document.querySelectorAll('[data-couleur]')) {
      b.setAttribute('aria-pressed', String(b.dataset.couleur === commun('couleur')));
      const c = couleurBloc(etat.themeResolu, b.dataset.couleur);
      b.querySelector('.pastille').style.background = c.fond;
      b.querySelector('.pastille').style.borderColor = c.bord;
    }
    const etape = commun('etape');
    $('etape-valeur').textContent = etape === null ? 'Étapes variées' : etape > 0 ? `Étape ${etape}` : 'Toujours visible';
    $('etape-moins').disabled = blocs.every((b) => b.etape <= 0);
    $('etape-zero').disabled = blocs.every((b) => b.etape <= 0);
    $('etape-info').textContent = 'Le réglage s\'applique à tous les blocs choisis. « Nouvelle étape » les fait apparaître ensemble.';
  } else {
    $('section-image').hidden = false;
  }
  if (sel && sel.type === 'bloc') {
    $('libelle-image-ajouter').textContent = sel.image ? 'Remplacer l\'image' : 'Ajouter une image';
    $('btn-image-retirer').hidden = !sel.image;
    for (const b of document.querySelectorAll('[data-forme]')) b.setAttribute('aria-pressed', String(b.dataset.forme === sel.forme));
    for (const b of document.querySelectorAll('[data-couleur]')) {
      b.setAttribute('aria-pressed', String(b.dataset.couleur === sel.couleur));
      const c = couleurBloc(etat.themeResolu, b.dataset.couleur);
      const pastille = b.querySelector('.pastille');
      pastille.style.background = c.fond;
      pastille.style.borderColor = c.bord;
    }
  }
  if (sel && sel.type === 'fleche') {
    for (const b of document.querySelectorAll('#choix-trait [data-cle]')) {
      b.setAttribute('aria-pressed', String(sel[b.dataset.cle] === b.dataset.valeur));
    }
  }
  if (sel) {
    // Panneau « Étape » : valeur actuelle et explications.
    $('etape-valeur').textContent = sel.etape > 0 ? `Étape ${sel.etape}` : 'Toujours visible';
    $('etape-moins').disabled = sel.etape <= 0;
    $('etape-zero').disabled = sel.etape <= 0;
    const effective = etapesEffectives(etat.schema).get(sel.id);
    const max = etapeMax(etat.schema);
    let info = max > 0 ? `Le schéma compte ${max} étape${max > 1 ? 's' : ''}.` : 'Aucune étape pour l\'instant : tout s\'affiche d\'un coup.';
    if (sel.type === 'fleche' && effective > sel.etape) info = `Cette flèche apparaîtra à l'étape ${effective}, en même temps que ses blocs.`;
    $('etape-info').textContent = info;
  }

  $('aide-vide').hidden = etat.schema.elements.length > 0;
}

// ---------------------------------------------------------------------
// Menu principal
// ---------------------------------------------------------------------
function installerMenu() {
  const menu = $('dlg-menu');
  const champFichier = $('fichier-import');

  menu.addEventListener('click', async (e) => {
    const bouton = e.target.closest('[data-menu]');
    if (!bouton) return;
    const action = bouton.dataset.menu;
    if (action !== 'importer') menu.close();
    switch (action) {
      case 'schemas': await afficherListe(); break;
      case 'nouveau': await nouveauSchema(); break;
      case 'exporter-image': afficherExport(); break;
      case 'exporter':
        await sauvegarderMaintenant();
        exporterSchema(etat.schema);
        annoncer('Fichier .json créé : regarde dans tes téléchargements.');
        break;
      case 'sauvegarder-tout': {
        await sauvegarderMaintenant();
        const n = await exporterTout();
        annoncer(`${n} schéma${n > 1 ? 's' : ''} sauvegardé${n > 1 ? 's' : ''} dans un fichier .json.`);
        break;
      }
      case 'importer': champFichier.click(); break;
      case 'reglages': afficherReglages(); break;
      case 'apropos': ouvrirFenetre($('dlg-apropos')); break;
      case 'aide': ouvrirAide(); break;
      default: break;
    }
  });

  champFichier.addEventListener('change', async () => {
    const fichier = champFichier.files[0];
    champFichier.value = '';
    menu.close();
    if (!fichier) return;
    try {
      await sauvegarderMaintenant();
      const { importes, erreurs } = await importerFichier(fichier);
      ouvrirSchema(importes[0]);
      let message = importes.length === 1
        ? `« ${importes[0].titre} » importé et ouvert.`
        : `${importes.length} schémas importés. Retrouve-les dans « Mes schémas ».`;
      if (erreurs.length) message += ` (${erreurs.length} n'ont pas pu être lus.)`;
      annoncer(message, 4500);
    } catch (erreur) {
      annoncer(erreur.message, 6000);
    }
  });

  $('btn-nouveau-liste').addEventListener('click', async () => {
    $('dlg-schemas').close();
    await nouveauSchema();
  });
}

// ---------------------------------------------------------------------
// Nouveau schéma, avec choix du modèle de départ
// ---------------------------------------------------------------------
function installerNouveau() {
  const liste = $('liste-modeles');
  for (const m of MODELES) {
    const label = document.createElement('label');
    label.className = 'carte-modele';
    label.innerHTML = `<input type="radio" name="modele" value="${m.id}"><span class="nom-modele"></span><span class="desc-modele"></span>`;
    label.querySelector('.nom-modele').textContent = m.nom;
    label.querySelector('.desc-modele').textContent = m.description;
    liste.appendChild(label);
  }
  $('nouveau-titre').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('dlg-nouveau').close('oui'); }
  });
  // Choisir un modèle propose son nom comme titre (si on n'en a pas tapé d'autre).
  liste.addEventListener('change', (e) => {
    const champ = $('nouveau-titre');
    const noms = MODELES.map((m) => m.nom).concat('Nouveau schéma');
    if (noms.includes(champ.value.trim())) {
      const m = MODELES.find((x) => x.id === e.target.value);
      champ.value = m.id === 'vide' ? 'Nouveau schéma' : m.nom;
    }
  });
}

async function nouveauSchema() {
  const d = $('dlg-nouveau');
  $('nouveau-titre').value = 'Nouveau schéma';
  d.querySelector('input[name="modele"][value="vide"]').checked = true;
  d.returnValue = 'non';
  ouvrirFenetre(d);
  $('nouveau-titre').focus();
  $('nouveau-titre').select();
  const ok = await new Promise((resoudre) => d.addEventListener('close', () => resoudre(d.returnValue === 'oui'), { once: true }));
  if (!ok) return;
  const titre = $('nouveau-titre').value.trim() || 'Nouveau schéma';
  const modele = (d.querySelector('input[name="modele"]:checked') || {}).value || 'vide';
  await sauvegarderMaintenant();
  const s = modele === 'vide' ? creerSchema(titre) : creerDepuisModele(modele, titre);
  await enregistrerSchema(s);
  ouvrirSchema(s);
  annoncer(modele === 'vide' ? 'Nouveau schéma créé.' : 'Modèle prêt : remplace les textes, puis présente !', 3500);
}

// ---------------------------------------------------------------------
// Export en image ou PDF
// ---------------------------------------------------------------------
function themeExport() {
  const choisi = $('dlg-export').querySelector('input[name="theme-export"]:checked');
  return choisi ? choisi.value : 'clair';
}

function afficherExport() {
  const d = $('dlg-export');
  const theme = themePresentation(etat.schema);
  for (const r of d.querySelectorAll('input[name="theme-export"]')) r.checked = r.value === theme;
  ouvrirFenetre(d);
}

function installerExport() {
  const lancer = async (action) => {
    try {
      await sauvegarderMaintenant();
      await action();
    } catch (erreur) {
      console.error(erreur);
      annoncer(erreur.message || 'L\'export a échoué.', 5000);
    }
  };
  $('btn-export-png').addEventListener('click', () => lancer(async () => {
    await exporterPng(etat.schema, themeExport());
    annoncer('Image PNG créée : regarde dans tes téléchargements.');
  }));
  $('btn-export-svg').addEventListener('click', () => lancer(async () => {
    await exporterSvg(etat.schema, themeExport());
    annoncer('Image SVG créée : regarde dans tes téléchargements.');
  }));
  $('btn-export-html').addEventListener('click', () => lancer(async () => {
    const fondu = !!etat.reglages.fondu && !reduireAnimations.matches;
    await exporterHtml(etat.schema, themeExport(), { notes: $('export-html-notes').checked, fondu });
    annoncer('Page HTML créée : regarde dans tes téléchargements.');
  }));
  $('btn-export-pdf').addEventListener('click', () => lancer(async () => {
    const theme = themeExport();
    $('dlg-export').close();
    imprimerEtapes(etat.schema, theme, { surligner: $('export-surligner').checked, notes: $('export-notes').checked });
  }));
}

// ---------------------------------------------------------------------
// Liste « Mes schémas »
// ---------------------------------------------------------------------
const formatDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

async function afficherListe() {
  await sauvegarderMaintenant();
  await remplirListe();
  ouvrirFenetre($('dlg-schemas'));
}

async function remplirListe() {
  const liste = $('liste-schemas');
  const schemas = await listerSchemas();
  liste.replaceChildren();
  for (const s of schemas) {
    const li = document.createElement('li');
    li.className = 'carte-schema';
    if (s.id === etat.schema.id) li.classList.add('courant');
    const nbBlocs = (s.elements || []).filter((e) => e.type === 'bloc').length;

    const ouvrir = document.createElement('button');
    ouvrir.type = 'button';
    ouvrir.className = 'ouvrir-schema';
    const titre = document.createElement('span');
    titre.className = 'titre-carte';
    titre.textContent = s.titre;
    const details = document.createElement('span');
    details.className = 'details-carte';
    const date = new Date(s.modifie_le);
    const quand = Number.isNaN(date.getTime()) ? '' : ` · modifié le ${formatDate.format(date)}`;
    details.textContent = `${nbBlocs} bloc${nbBlocs > 1 ? 's' : ''}${quand}`
      + (s.id === etat.schema.id ? ' · ouvert' : '');
    ouvrir.append(titre, details);
    ouvrir.addEventListener('click', async () => {
      $('dlg-schemas').close();
      if (s.id === etat.schema.id) return;
      const charge = await chargerSchema(s.id);
      try { ouvrirSchema(migrer(charge)); } catch (erreur) { annoncer(erreur.message, 5000); }
    });

    const actions = document.createElement('div');
    actions.className = 'actions-carte';
    actions.append(
      boutonIcone('i-crayon', `Renommer « ${s.titre} »`, () => renommerDepuisListe(s)),
      boutonIcone('i-dupliquer', `Dupliquer « ${s.titre} »`, () => dupliquerDepuisListe(s)),
      boutonIcone('i-supprimer', `Supprimer « ${s.titre} »`, () => supprimerDepuisListe(s), 'danger'),
    );
    li.append(ouvrir, actions);
    liste.appendChild(li);
  }
}

function boutonIcone(icone, libelle, action, classe = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `bouton-icone ${classe}`;
  b.setAttribute('aria-label', libelle);
  b.title = libelle;
  b.innerHTML = `<svg class="icone" aria-hidden="true"><use href="#${icone}"/></svg>`;
  b.addEventListener('click', action);
  return b;
}

async function renommerDepuisListe(s) {
  const titre = await demanderTexte('Nouveau nom', s.titre);
  if (!titre) return;
  if (s.id === etat.schema.id) renommer(titre);
  else {
    const charge = await chargerSchema(s.id);
    charge.titre = titre;
    charge.modifie_le = new Date().toISOString();
    await enregistrerSchema(charge);
  }
  await remplirListe();
}

async function dupliquerDepuisListe(s) {
  if (s.id === etat.schema.id) await sauvegarderMaintenant();
  const charge = await chargerSchema(s.id);
  const copie = migrer(charge);
  copie.id = nouvelId('s');
  copie.titre = `${charge.titre} (copie)`;
  copie.cree_le = copie.modifie_le = new Date().toISOString();
  await enregistrerSchema(copie);
  annoncer('Schéma dupliqué.');
  await remplirListe();
}

async function supprimerDepuisListe(s) {
  const ok = await demanderConfirmation(`Supprimer définitivement « ${s.titre} » ? Cette action ne peut pas être annulée.`, 'Supprimer');
  if (!ok) return;
  await supprimerSchema(s.id);
  if (s.id === etat.schema.id) {
    // On a supprimé le schéma ouvert : on en ouvre un autre (ou un nouveau).
    const restants = await listerSchemas();
    let suivant;
    if (restants.length) suivant = migrer(restants[0]);
    else { suivant = creerSchema('Nouveau schéma'); await enregistrerSchema(suivant); }
    ouvrirSchema(suivant);
  }
  annoncer('Schéma supprimé.');
  await remplirListe();
}

// ---------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------
function afficherReglages() {
  const d = $('dlg-reglages');
  for (const r of d.querySelectorAll('input[name="theme"]')) r.checked = r.value === etat.reglages.theme;
  for (const r of d.querySelectorAll('input[name="taille"]')) r.checked = Number(r.value) === Number(etat.reglages.taille);
  d.querySelector('input[name="grille"]').checked = !!etat.reglages.grille;
  d.querySelector('input[name="guides"]').checked = !!etat.reglages.guides;
  d.querySelector('input[name="pastilles"]').checked = !!etat.reglages.pastilles;
  const fondu = d.querySelector('input[name="fondu"]');
  fondu.checked = !!etat.reglages.fondu && !reduireAnimations.matches;
  fondu.disabled = reduireAnimations.matches;
  $('aide-fondu').hidden = !reduireAnimations.matches;
  ouvrirFenetre(d);
}

function installerReglages() {
  const d = $('dlg-reglages');
  d.addEventListener('change', (e) => {
    const champ = e.target;
    if (champ.name === 'theme') etat.reglages.theme = champ.value;
    else if (champ.name === 'taille') etat.reglages.taille = Number(champ.value);
    else if (champ.name === 'grille') etat.reglages.grille = champ.checked;
    else if (champ.name === 'guides') etat.reglages.guides = champ.checked;
    else if (champ.name === 'pastilles') etat.reglages.pastilles = champ.checked;
    else if (champ.name === 'fondu') etat.reglages.fondu = champ.checked;
    enregistrerReglages();
    appliquerTheme();
    notifier();
  });
}
