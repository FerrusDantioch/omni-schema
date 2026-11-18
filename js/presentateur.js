// =====================================================================
// Mode présentateur sur deux écrans (surtout sur ordinateur avec un
// vidéoprojecteur ou un second écran).
//
// - Fenêtre « public » : une deuxième fenêtre de l'application, ouverte
//   avec l'adresse « ?public=<id du schéma> ». Elle n'affiche que le
//   schéma, en grand ; on la place sur le vidéoprojecteur.
// - Vue présentateur : dans la fenêtre principale, l'étape en cours,
//   l'aperçu de la suivante, les notes et un chronomètre.
//
// Les deux fenêtres se parlent avec un BroadcastChannel : une messagerie
// interne au navigateur, entre fenêtres de la même application.
// Rien ne passe par le réseau.
// =====================================================================

import { etat } from './noyau.js';
import { arrets, nomElement } from './etapes.js';
import { construireSvg, appliquerArret } from './schema-svg.js';
import { couleursToile } from './couleurs.js';
import { listeBlocs, migrer } from './modele.js';
import { chargerSchema } from './stockage.js';
import { themePresentation, lireReprise, ecrireReprise, repriseUtile } from './presentation.js';

const CANAL = 'omni-schema-presentation';
const $ = (id) => document.getElementById(id);

/** Prépare un SVG qui remplit son cadre. */
function svgAjuste(rendu) {
  rendu.svg.setAttribute('width', '100%');
  rendu.svg.setAttribute('height', '100%');
  rendu.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  return rendu.svg;
}

const deuxChiffres = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------
// Vue présentateur (fenêtre principale)
// ---------------------------------------------------------------------
export function creerVuePresentateur({ apresFermeture, annoncer }) {
  const racine = $('presentateur');
  let canal = null;
  let fenetrePublic = null;
  let schema = null;
  let liste = [];
  let index = 0;
  let actuel = null;
  let suivantRendu = null;
  let debut = 0;
  let minuterie = null;
  let verrouEcran = null;

  function envoyer() {
    if (canal) canal.postMessage({ type: 'arret', id: schema.id, index });
  }

  /** Ouvre (ou rouvre) la fenêtre destinée au public. */
  function ouvrirFenetrePublic() {
    fenetrePublic = window.open(`./?public=${encodeURIComponent(schema.id)}`, 'omni-schema-public', 'popup=yes,width=1024,height=640');
    majEtatFenetre();
    if (!fenetrePublic) annoncer('Le navigateur a bloqué la fenêtre public : autorise les fenêtres surgissantes, puis touche « Ouvrir la fenêtre public ».', 7000);
  }

  function majEtatFenetre() {
    const ouverte = fenetrePublic && !fenetrePublic.closed;
    $('pt-etat').textContent = ouverte ? 'Fenêtre public ouverte' : 'Fenêtre public fermée';
    $('pt-public').textContent = ouverte ? 'Ramener la fenêtre public' : 'Ouvrir la fenêtre public';
  }

  async function ouvrir() {
    schema = etat.schema;
    if (!schema || !listeBlocs(schema).length) return false;
    const theme = themePresentation(schema);
    liste = arrets(schema);
    index = 0;

    actuel = construireSvg(schema, theme);
    suivantRendu = construireSvg(schema, theme);
    $('pt-scene-actuelle').replaceChildren(svgAjuste(actuel));
    $('pt-scene-suivante').replaceChildren(svgAjuste(suivantRendu));
    const T = couleursToile(theme);
    $('pt-scene-actuelle').style.background = T.fond;
    $('pt-scene-suivante').style.background = T.fond;

    // Reprise éventuelle.
    const reprise = lireReprise(schema.id);
    $('pt-reprise').hidden = !repriseUtile(reprise, liste.length);
    $('pt-reprise').textContent = `Reprendre à l'étape ${reprise + 1}`;
    $('pt-reprise').onclick = () => { $('pt-reprise').hidden = true; allerA(reprise); };

    canal = new BroadcastChannel(CANAL);
    canal.onmessage = (m) => {
      // La fenêtre public vient de s'ouvrir : on lui dit où on en est.
      if (m.data && m.data.type === 'bonjour' && m.data.id === schema.id) { envoyer(); majEtatFenetre(); }
    };

    etat.presentation = true; // bloque les raccourcis d'édition
    etat.presentateur = true;
    racine.hidden = false;
    debut = Date.now();
    minuterie = setInterval(majChrono, 1000);
    majChrono();
    afficher();
    racine.focus({ preventScroll: true });
    ouvrirFenetrePublic();
    try { if ('wakeLock' in navigator) verrouEcran = await navigator.wakeLock.request('screen'); } catch { verrouEcran = null; }
    return true;
  }

  function fermer() {
    if (!etat.presentateur) return;
    if (canal) { canal.postMessage({ type: 'fin', id: schema.id }); canal.close(); canal = null; }
    if (fenetrePublic && !fenetrePublic.closed) fenetrePublic.close();
    fenetrePublic = null;
    clearInterval(minuterie);
    if (verrouEcran) { verrouEcran.release().catch(() => {}); verrouEcran = null; }
    etat.presentation = false;
    etat.presentateur = false;
    racine.hidden = true;
    $('pt-scene-actuelle').replaceChildren();
    $('pt-scene-suivante').replaceChildren();
    apresFermeture();
  }

  function majChrono() {
    const s = Math.floor((Date.now() - debut) / 1000);
    $('pt-chrono').textContent = `${deuxChiffres(Math.floor(s / 60))}:${deuxChiffres(s % 60)}`;
    majEtatFenetre();
  }

  function afficher() {
    const arret = liste[index];
    appliquerArret(actuel, arret, { surligner: true });
    const dernier = index >= liste.length - 1;
    appliquerArret(suivantRendu, dernier ? arret : liste[index + 1], { surligner: !dernier });
    $('pt-fin').hidden = !dernier;
    $('pt-compteur').textContent = `${index + 1} / ${liste.length}`;
    $('pt-precedent').disabled = index === 0;
    $('pt-suivant').disabled = dernier;
    remplirNotes(arret);
    ecrireReprise(schema.id, index);
    envoyer();
  }

  function remplirNotes(arret) {
    $('pt-notes-titre').textContent = arret === 0 ? 'Notes — début' : `Notes — étape ${index + 1}`;
    const contenu = $('pt-notes');
    contenu.replaceChildren();
    const blocs = actuel.elements.filter((e) => e.type === 'bloc' && e.etape === arret && e.donnees.note.trim());
    if (!blocs.length) {
      const p = document.createElement('p');
      p.className = 'pres-sans-note';
      p.textContent = 'Pas de note pour cette étape.';
      contenu.appendChild(p);
    }
    for (const e of blocs) {
      const div = document.createElement('div');
      div.className = 'pres-note';
      const nom = document.createElement('p');
      nom.className = 'pres-note-bloc';
      nom.textContent = nomElement(schema, e.donnees, 60);
      const texte = document.createElement('p');
      texte.className = 'pres-note-texte';
      texte.textContent = e.donnees.note;
      div.append(nom, texte);
      contenu.appendChild(div);
    }
  }

  const suivant = () => { $('pt-reprise').hidden = true; if (index < liste.length - 1) { index++; afficher(); } };
  const precedent = () => { $('pt-reprise').hidden = true; if (index > 0) { index--; afficher(); } };
  const allerA = (i) => { index = Math.max(0, Math.min(liste.length - 1, i)); afficher(); };

  $('pt-suivant').addEventListener('click', suivant);
  $('pt-precedent').addEventListener('click', precedent);
  $('pt-quitter').addEventListener('click', fermer);
  $('pt-public').addEventListener('click', () => {
    if (fenetrePublic && !fenetrePublic.closed) fenetrePublic.focus();
    else ouvrirFenetrePublic();
  });
  $('pt-zero').addEventListener('click', () => { debut = Date.now(); majChrono(); });

  document.addEventListener('keydown', (e) => {
    if (!etat.presentateur) return;
    const surBouton = e.target.closest && e.target.closest('button');
    let geree = true;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': suivant(); break;
      case ' ': case 'Enter': if (surBouton) { geree = false; break; } suivant(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': precedent(); break;
      case 'Home': allerA(0); break;
      case 'End': allerA(liste.length - 1); break;
      case 'Escape': fermer(); break;
      default: geree = false;
    }
    if (geree) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // Si on ferme la fenêtre principale, la fenêtre public se ferme aussi.
  window.addEventListener('pagehide', () => { if (etat.presentateur && canal) canal.postMessage({ type: 'fin', id: schema.id }); });

  return { ouvrir, fermer };
}

// ---------------------------------------------------------------------
// Fenêtre « public » (ouverte par la vue présentateur)
// ---------------------------------------------------------------------
export async function demarrerPublic(idSchema) {
  document.body.classList.add('mode-public');
  const scene = document.createElement('main');
  scene.className = 'public-scene';
  scene.setAttribute('aria-label', 'Présentation');
  const aide = document.createElement('p');
  aide.className = 'public-aide';
  aide.textContent = 'Place cette fenêtre sur le vidéoprojecteur, puis touche-la ou clique dessus pour passer en plein écran.';
  document.body.append(scene, aide);

  let schema = null;
  try { schema = migrer(await chargerSchema(idSchema)); } catch { schema = null; }
  if (!schema) { aide.textContent = 'Schéma introuvable : relance la présentation depuis la vue présentateur.'; return; }

  document.title = `${schema.titre} — présentation`;
  const theme = themePresentation(schema);
  const T = couleursToile(theme);
  document.documentElement.dataset.theme = theme;
  document.body.style.background = T.fond;
  scene.style.background = T.fond;

  const rendu = construireSvg(schema, theme);
  scene.appendChild(svgAjuste(rendu));
  const liste = arrets(schema);
  let actuel = null;
  const reduire = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const montrer = (index) => {
    const arret = liste[Math.max(0, Math.min(liste.length - 1, index))];
    const nouveaux = appliquerArret(rendu, arret, { surligner: true, precedent: actuel });
    if (etat.reglages.fondu && !reduire && actuel !== null && arret > actuel) {
      for (const g of nouveaux) { g.classList.remove('apparait'); g.getBoundingClientRect(); g.classList.add('apparait'); }
    }
    actuel = arret;
  };
  montrer(0);

  const canal = new BroadcastChannel(CANAL);
  canal.onmessage = (m) => {
    const d = m.data || {};
    if (d.id !== schema.id) return;
    if (d.type === 'arret') montrer(d.index);
    if (d.type === 'fin') {
      aide.hidden = false;
      aide.textContent = 'Présentation terminée. Tu peux fermer cette fenêtre.';
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setTimeout(() => window.close(), 400);
    }
  };
  canal.postMessage({ type: 'bonjour', id: schema.id });

  // Plein écran au premier toucher / clic (les navigateurs exigent un geste).
  const pleinEcran = () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().then(() => { aide.hidden = true; }).catch(() => {});
    }
  };
  document.addEventListener('pointerup', pleinEcran);
  document.addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F' || e.key === 'Enter') pleinEcran(); });
  document.addEventListener('fullscreenchange', () => { aide.hidden = !!document.fullscreenElement; });
}
