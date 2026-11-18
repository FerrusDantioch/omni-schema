// =====================================================================
// Interface : barres d'outils, menu, fenêtres (dialogues), réglages,
// liste des schémas et « À propos ».
// =====================================================================

import { APP_VERSION } from './config.js';
import { COULEURS, couleurBloc, couleursToile } from './couleurs.js';
import { FORMES, trouver, creerSchema, migrer, nouvelId } from './modele.js';
import {
  etat, notifier, surChangement, demanderRendu, annuler, retablir, peutAnnuler, peutRetablir,
  ajouterBloc, dupliquerSelection, supprimerSelection, modifierSelection, selectionner,
  recentrer, zoomerCentre, renommer, ouvrirSchema, sauvegarderMaintenant, enregistrerReglages, annoncer,
} from './noyau.js';
import { listerSchemas, chargerSchema, enregistrerSchema, supprimerSchema } from './stockage.js';
import { exporterSchema, exporterTout, importerFichier } from './fichiers.js';

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
export function installerInterface({ editeur }) {
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
  $('btn-recentrer').addEventListener('click', recentrer);
  $('btn-zoom-plus').addEventListener('click', () => zoomerCentre(1.25));
  $('btn-zoom-moins').addEventListener('click', () => zoomerCentre(0.8));

  // --- Barre du bas : bloc choisi ---
  $('btn-texte').addEventListener('click', () => editeur.ouvrir(etat.selection));
  $('btn-forme').addEventListener('click', () => basculerChoix('choix-forme', 'btn-forme'));
  $('btn-couleur').addEventListener('click', () => basculerChoix('choix-couleur', 'btn-couleur'));
  $('btn-dupliquer').addEventListener('click', dupliquerSelection);
  $('btn-supprimer-bloc').addEventListener('click', supprimerSelection);

  // --- Barre du bas : flèche choisie ---
  $('btn-etiquette').addEventListener('click', () => editerEtiquette(etat.selection));
  $('btn-style').addEventListener('click', () => {
    const f = trouver(etat.schema, etat.selection);
    if (f) modifierSelection({ style: f.style === 'angle' ? 'droite' : 'angle' });
  });
  $('btn-inverser').addEventListener('click', () => {
    const f = trouver(etat.schema, etat.selection);
    if (f) modifierSelection({ de: f.vers, vers: f.de });
  });
  $('btn-supprimer-fleche').addEventListener('click', supprimerSelection);
  for (const b of document.querySelectorAll('[data-action="deselectionner"]')) {
    b.addEventListener('click', () => selectionner(null));
  }

  construireChoix();
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

// ---------------------------------------------------------------------
// Petits panneaux « Forme » et « Couleur »
// ---------------------------------------------------------------------
function construireChoix() {
  const panneauForme = $('choix-forme');
  for (const f of FORMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option-choix';
    b.dataset.forme = f.id;
    b.innerHTML = `<svg viewBox="0 0 40 28" class="apercu-forme" aria-hidden="true">${apercuForme(f.id)}</svg><span>${f.nom}</span>`;
    b.addEventListener('click', () => { modifierSelection({ forme: f.id }); fermerChoix(); });
    panneauForme.appendChild(b);
  }
  const panneauCouleur = $('choix-couleur');
  for (const c of COULEURS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option-choix';
    b.dataset.couleur = c.id;
    b.innerHTML = `<span class="pastille" aria-hidden="true"></span><span>${c.nom}</span>`;
    b.addEventListener('click', () => { modifierSelection({ couleur: c.id }); fermerChoix(); });
    panneauCouleur.appendChild(b);
  }
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

function basculerChoix(idPanneau, idBouton) {
  const panneau = $(idPanneau);
  const ouvrir = panneau.hidden;
  fermerChoix();
  if (ouvrir) {
    panneau.hidden = false;
    $(idBouton).setAttribute('aria-expanded', 'true');
    const actif = panneau.querySelector('[aria-pressed="true"]') || panneau.querySelector('button');
    if (actif) actif.focus();
  }
}

export function fermerChoix() {
  for (const [p, b] of [['choix-forme', 'btn-forme'], ['choix-couleur', 'btn-couleur']]) {
    $(p).hidden = true;
    $(b).setAttribute('aria-expanded', 'false');
  }
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

  const sel = trouver(etat.schema, etat.selection);
  const type = sel ? sel.type : 'aucun';
  for (const groupe of document.querySelectorAll('.groupe-outils')) {
    groupe.hidden = groupe.dataset.pour !== type;
  }
  if (type !== 'bloc') fermerChoix();

  if (sel && sel.type === 'bloc') {
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
    $('libelle-style').textContent = sel.style === 'angle' ? 'Droite' : 'Angle droit';
    $('btn-style').setAttribute('aria-label', sel.style === 'angle' ? 'Passer en flèche droite' : 'Passer en flèche à angle droit');
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

async function nouveauSchema() {
  const titre = await demanderTexte('Nom du nouveau schéma', 'Nouveau schéma');
  if (!titre) return;
  await sauvegarderMaintenant();
  const s = creerSchema(titre);
  await enregistrerSchema(s);
  ouvrirSchema(s);
  annoncer('Nouveau schéma créé.');
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
    enregistrerReglages();
    appliquerTheme();
    notifier();
  });
}
