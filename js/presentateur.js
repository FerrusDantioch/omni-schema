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
// Rien ne passe par le réseau. Messages (tous portent « id » = le schéma
// principal de la présentation) :
//   arret    { courant, index }  schéma affiché (principal ou sous-schéma) et étape
//   pointeur { pos }             pointeur lumineux (pos = null : caché)
//   feutre   { action, … }       traits du feutre (voir feutre.js)
//   fin                          la présentation est terminée
// =====================================================================

import { etat } from './noyau.js';
import { arrets, nomElement } from './etapes.js';
import { construireSvg, appliquerArret } from './schema-svg.js';
import { couleursToile } from './couleurs.js';
import { listeBlocs, migrer } from './modele.js';
import { chargerSchema, chargerDeCorbeille } from './stockage.js';
import { themePresentation, lireReprise, ecrireReprise, repriseUtile } from './presentation.js';
import { creerPoint, brancherPointeur } from './pointeur.js';
import { creerFeutre } from './feutre.js';

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
const court = (t, n = 28) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** Charge un sous-schéma ; renvoie { schema } ou { erreur } (message en français). */
async function chargerSousSchema(id) {
  let brut = null;
  try { brut = await chargerSchema(id); } catch { brut = null; }
  if (!brut) {
    const corbeille = await chargerDeCorbeille(id).catch(() => null);
    return { erreur: corbeille ? 'Ce sous-schéma est dans la corbeille.' : 'Ce sous-schéma n\'existe plus.' };
  }
  try {
    const schema = migrer(brut);
    if (!listeBlocs(schema).length) return { erreur: `« ${court(schema.titre)} » est vide.` };
    return { schema };
  } catch (erreur) {
    return { erreur: erreur.message };
  }
}

/** Bloc relié (visible) sous un point de l'écran, dans un rendu ; ou null. */
function lienSous(rendu, clientX, clientY) {
  const ctm = rendu && rendu.svg.getScreenCTM();
  if (!ctm) return null;
  const p = rendu.svg.createSVGPoint();
  p.x = clientX;
  p.y = clientY;
  const m = p.matrixTransform(ctm.inverse());
  const item = rendu.elements.slice().reverse().find((e) => e.type === 'bloc' && e.donnees.lien && e.g.style.display !== 'none'
    && m.x >= e.donnees.x && m.x <= e.donnees.x + e.donnees.largeur && m.y >= e.donnees.y && m.y <= e.donnees.y + e.donnees.hauteur);
  return item ? item.donnees.lien : null;
}

// ---------------------------------------------------------------------
// Vue présentateur (fenêtre principale)
// ---------------------------------------------------------------------
export function creerVuePresentateur({ apresFermeture, annoncer }) {
  const racine = $('presentateur');
  let canal = null;
  let fenetrePublic = null;
  let principal = null; // schéma de départ (son id identifie la présentation)
  let schema = null;    // schéma affiché : le principal ou un sous-schéma
  let pile = [];        // sous-schémas : [{ schema, index }] des parents
  let liste = [];
  let index = 0;
  let actuel = null;
  let suivantRendu = null;
  let debut = 0;
  let minuterie = null;
  let verrouEcran = null;

  const poster = (message) => { if (canal && principal) canal.postMessage({ ...message, id: principal.id }); };

  // Pointeur lumineux et feutre : on les utilise sur l'aperçu « Ce que voit
  // le public » ; ils apparaissent au même endroit sur la fenêtre public.
  const cadreActuel = $('pt-scene-actuelle');
  const point = creerPoint(cadreActuel);
  const feutre = creerFeutre(cadreActuel, {
    peutDessiner: () => etat.presentateur,
    surTrait: (m) => { poster({ type: 'feutre', ...m }); majFeutre(); },
  });
  let positionAEnvoyer;
  let envoiPrevu = false;
  const envoyerPointeur = (pos) => {
    positionAEnvoyer = pos;
    if (envoiPrevu) return;
    envoiPrevu = true;
    requestAnimationFrame(() => { // au plus un message par image
      envoiPrevu = false;
      poster({ type: 'pointeur', pos: positionAEnvoyer });
    });
  };
  const pointeur = brancherPointeur(cadreActuel, point, {
    surPosition: envoyerPointeur,
    actif: () => etat.presentateur && !feutre.actif(),
  });

  function majFeutre() {
    $('pt-feutre').setAttribute('aria-pressed', String(feutre.actif()));
    $('pt-effacer').hidden = !feutre.actif() && !feutre.aDesTraits();
  }
  function basculerFeutre() {
    annoncer(feutre.basculer() ? 'Feutre : dessine sur « Ce que voit le public » (D pour le ranger, E pour effacer).' : 'Feutre rangé.', 3500);
    majFeutre();
  }
  function effacerFeutre() { feutre.effacer(); majFeutre(); }

  const envoyer = () => poster({ type: 'arret', courant: schema.id, index });

  /** Ouvre (ou rouvre) la fenêtre destinée au public. */
  function ouvrirFenetrePublic() {
    fenetrePublic = window.open(`./?public=${encodeURIComponent(principal.id)}`, 'omni-schema-public', 'popup=yes,width=1024,height=640');
    majEtatFenetre();
    if (!fenetrePublic) annoncer('Le navigateur a bloqué la fenêtre public : autorise les fenêtres surgissantes, puis touche « Ouvrir la fenêtre public ».', 7000);
  }

  function majEtatFenetre() {
    const ouverte = fenetrePublic && !fenetrePublic.closed;
    $('pt-etat').textContent = ouverte ? 'Fenêtre public ouverte' : 'Fenêtre public fermée';
    $('pt-public').textContent = ouverte ? 'Ramener la fenêtre public' : 'Ouvrir la fenêtre public';
  }

  /** Affiche un schéma (principal ou sous-schéma) à l'arrêt n° i. */
  function charger(s, i) {
    schema = s;
    const theme = themePresentation(s);
    liste = arrets(s);
    index = Math.max(0, Math.min(liste.length - 1, i));
    actuel = construireSvg(s, theme, { liens: true });
    suivantRendu = construireSvg(s, theme, { liens: true });
    cadreActuel.replaceChildren(svgAjuste(actuel), point.element);
    $('pt-scene-suivante').replaceChildren(svgAjuste(suivantRendu));
    const T = couleursToile(theme);
    cadreActuel.style.background = T.fond;
    $('pt-scene-suivante').style.background = T.fond;
    const parent = pile[pile.length - 1];
    $('pt-retour').hidden = !parent;
    if (parent) $('pt-retour-texte').textContent = `Retour : ${court(parent.schema.titre, 24)}`;
    afficher();
  }

  async function entrer(id) {
    const { schema: sous, erreur } = await chargerSousSchema(id);
    if (erreur) { annoncer(erreur, 4000); return; }
    pile.push({ schema, index });
    $('pt-reprise').hidden = true;
    charger(sous, 0);
  }

  function revenir() {
    const parent = pile.pop();
    if (parent) charger(parent.schema, parent.index);
  }

  /** Les blocs reliés visibles à cette étape (celui qui vient d'apparaître en premier). */
  function liensVisibles() {
    const visibles = actuel.elements.filter((e) => e.type === 'bloc' && e.donnees.lien && e.g.style.display !== 'none');
    const deCetteEtape = visibles.filter((e) => e.etape === liste[index]);
    return [...deCetteEtape, ...visibles.filter((e) => !deCetteEtape.includes(e))];
  }

  async function ouvrir() {
    principal = etat.schema;
    if (!principal || !listeBlocs(principal).length) return false;
    pile = [];
    const reprise = lireReprise(principal.id); // à lire avant d'afficher

    canal = new BroadcastChannel(CANAL);
    canal.onmessage = (m) => {
      // La fenêtre public vient de s'ouvrir : on lui dit où on en est.
      if (m.data && m.data.type === 'bonjour' && m.data.id === principal.id) { envoyer(); majEtatFenetre(); }
    };

    etat.presentation = true; // bloque les raccourcis d'édition
    etat.presentateur = true;
    racine.hidden = false;
    charger(principal, 0);
    $('pt-reprise').hidden = !repriseUtile(reprise, liste.length);
    $('pt-reprise').textContent = `Reprendre à l'étape ${reprise + 1}`;
    $('pt-reprise').onclick = () => { $('pt-reprise').hidden = true; allerA(reprise); };
    debut = Date.now();
    minuterie = setInterval(majChrono, 1000);
    majChrono();
    racine.focus({ preventScroll: true });
    ouvrirFenetrePublic();
    try { if ('wakeLock' in navigator) verrouEcran = await navigator.wakeLock.request('screen'); } catch { verrouEcran = null; }
    return true;
  }

  function fermer() {
    if (!etat.presentateur) return;
    poster({ type: 'fin' });
    if (canal) { canal.close(); canal = null; }
    if (fenetrePublic && !fenetrePublic.closed) fenetrePublic.close();
    fenetrePublic = null;
    clearInterval(minuterie);
    if (verrouEcran) { verrouEcran.release().catch(() => {}); verrouEcran = null; }
    etat.presentation = false;
    etat.presentateur = false;
    racine.hidden = true;
    pointeur.reinitialiser();
    feutre.reinitialiser();
    majFeutre();
    pile = [];
    cadreActuel.replaceChildren(point.element);
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
    feutre.effacer(); // nouvelle étape : page blanche pour le feutre
    majFeutre();
    appliquerArret(actuel, arret, { surligner: true });
    const dernier = index >= liste.length - 1;
    appliquerArret(suivantRendu, dernier ? arret : liste[index + 1], { surligner: !dernier });
    const parent = pile[pile.length - 1];
    $('pt-fin').hidden = !dernier;
    $('pt-fin').textContent = parent
      ? `Fin du sous-schéma : « Suivant » ramène à « ${court(parent.schema.titre)} ».`
      : 'C\'est la dernière étape.';
    $('pt-compteur').textContent = `${index + 1} / ${liste.length}${parent ? ` · ${court(schema.titre, 20)}` : ''}`;
    $('pt-precedent').disabled = index === 0 && !parent;
    $('pt-suivant').disabled = dernier && !parent;
    // Bouton « Entrer » : s'il y a un sous-schéma visible à cette étape.
    const liens = liensVisibles();
    $('pt-entrer').hidden = !liens.length;
    if (liens.length) $('pt-entrer-texte').textContent = `Entrer : ${court(liens[0].donnees.texte.replace(/\s+/g, ' ').trim() || 'sous-schéma', 22)}`;
    remplirNotes(arret);
    if (!parent) ecrireReprise(principal.id, index); // la reprise vaut pour le schéma principal
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

  // Dans un sous-schéma, « précédent » au début et « suivant » à la fin ramènent au parent.
  const suivant = () => {
    $('pt-reprise').hidden = true;
    if (index < liste.length - 1) { index++; afficher(); } else if (pile.length) revenir();
  };
  const precedent = () => {
    $('pt-reprise').hidden = true;
    if (index > 0) { index--; afficher(); } else if (pile.length) revenir();
  };
  const allerA = (i) => { index = Math.max(0, Math.min(liste.length - 1, i)); afficher(); };
  const entrerAuClavier = () => {
    const liens = liensVisibles();
    if (liens.length) entrer(liens[0].donnees.lien);
    else annoncer('Pas de sous-schéma à cette étape.');
  };

  // Clic (court) sur un bloc ↗ de l'aperçu : on entre dans son sous-schéma.
  let depart = null;
  cadreActuel.addEventListener('pointerdown', (e) => { depart = feutre.actif() ? null : { x: e.clientX, y: e.clientY }; });
  cadreActuel.addEventListener('pointerup', (e) => {
    if (!depart || pointeur.consomme()) { depart = null; return; }
    const bouge = Math.hypot(e.clientX - depart.x, e.clientY - depart.y);
    depart = null;
    if (bouge > 10) return;
    const lien = lienSous(actuel, e.clientX, e.clientY);
    if (lien) entrer(lien);
  });

  $('pt-suivant').addEventListener('click', suivant);
  $('pt-precedent').addEventListener('click', precedent);
  $('pt-quitter').addEventListener('click', fermer);
  $('pt-entrer').addEventListener('click', entrerAuClavier);
  $('pt-retour').addEventListener('click', revenir);
  $('pt-feutre').addEventListener('click', basculerFeutre);
  $('pt-effacer').addEventListener('click', effacerFeutre);
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
      case 'l': case 'L':
        annoncer(pointeur.basculerSouris() ? 'Pointeur : promène la souris sur l\'étape en cours (L pour l\'enlever).' : 'Pointeur retiré.');
        break;
      case 'd': case 'D': basculerFeutre(); break;
      case 'e': case 'E': effacerFeutre(); break;
      case 'o': case 'O': entrerAuClavier(); break;
      default: geree = false;
    }
    if (geree) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // Si on ferme la fenêtre principale, la fenêtre public se ferme aussi.
  window.addEventListener('pagehide', () => { if (etat.presentateur) poster({ type: 'fin' }); });

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

  let principal = null;
  try { principal = migrer(await chargerSchema(idSchema)); } catch { principal = null; }
  if (!principal) { aide.textContent = 'Schéma introuvable : relance la présentation depuis la vue présentateur.'; return; }
  document.title = `${principal.titre} — présentation`;

  const point = creerPoint(scene); // pointeur envoyé par la vue présentateur
  const feutre = creerFeutre(scene, { peutDessiner: () => false }); // traits reçus seulement
  const reduire = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Schéma affiché : le principal, ou un sous-schéma où le présentateur est entré.
  let affiche = null; // { id, rendu, liste, arret }
  const enCache = new Map([[principal.id, principal]]);

  function afficherSchema(s) {
    const theme = themePresentation(s);
    const T = couleursToile(theme);
    document.documentElement.dataset.theme = theme;
    document.body.style.background = T.fond;
    scene.style.background = T.fond;
    const rendu = construireSvg(s, theme, { liens: true });
    scene.replaceChildren(svgAjuste(rendu), point.element);
    feutre.reinitialiser();
    affiche = { id: s.id, rendu, liste: arrets(s), arret: null };
  }

  const montrer = (index) => {
    const { rendu, liste } = affiche;
    const arret = liste[Math.max(0, Math.min(liste.length - 1, index))];
    const nouveaux = appliquerArret(rendu, arret, { surligner: true, precedent: affiche.arret });
    if (etat.reglages.fondu && !reduire && affiche.arret !== null && arret > affiche.arret) {
      for (const g of nouveaux) { g.classList.remove('apparait'); g.getBoundingClientRect(); g.classList.add('apparait'); }
    }
    affiche.arret = arret;
  };

  afficherSchema(principal);
  montrer(0);

  // Les messages arrivent dans l'ordre ; un sous-schéma se charge de façon
  // asynchrone : on enchaîne les changements pour ne pas les mélanger.
  let file = Promise.resolve();
  async function allerA(courant, index) {
    if (!affiche || affiche.id !== (courant || principal.id)) {
      const id = courant || principal.id;
      let s = enCache.get(id);
      if (!s) {
        const { schema, erreur } = await chargerSousSchema(id);
        if (erreur) return;
        s = schema;
        enCache.set(id, s);
      }
      afficherSchema(s);
    }
    montrer(index);
  }

  const canal = new BroadcastChannel(CANAL);
  canal.onmessage = (m) => {
    const d = m.data || {};
    if (d.id !== principal.id) return;
    if (d.type === 'arret') file = file.then(() => allerA(d.courant, d.index)).catch(() => {});
    if (d.type === 'pointeur') { if (d.pos) point.montrerSchema(d.pos.x, d.pos.y); else point.cacher(); }
    if (d.type === 'feutre') file = file.then(() => feutre.recevoir(d)).catch(() => {});
    if (d.type === 'fin') {
      aide.hidden = false;
      aide.textContent = 'Présentation terminée. Tu peux fermer cette fenêtre.';
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setTimeout(() => window.close(), 400);
    }
  };
  canal.postMessage({ type: 'bonjour', id: principal.id });

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
