// =====================================================================
// Mode présentation : plein écran, interface masquée, le schéma se
// dévoile étape par étape.
//   - toucher la partie droite de l'écran (ou glisser vers la gauche),
//     flèche droite, Espace, Entrée, Page suivante → étape suivante ;
//   - toucher la partie gauche (ou glisser vers la droite), flèche
//     gauche, Retour arrière, Page précédente → étape précédente ;
//   - Début / Fin : première / dernière étape ; N : notes ; Échap : quitter ;
//   - appui long sur le schéma : pointeur lumineux ; L : pointeur qui suit la souris ;
//   - D : feutre (dessiner sur le schéma ; toucher ne change plus d'étape) ;
//     E : effacer les traits (ils s'effacent aussi au changement d'étape) ;
//   - toucher un bloc marqué ↗ (ou touche O) : entrer dans son sous-schéma ;
//     à la fin du sous-schéma (ou avec « Retour »), on revient où on était.
// Les télécommandes de présentation envoient Page suivante / précédente :
// elles fonctionnent donc aussi.
// =====================================================================

import { etat } from './noyau.js';
import { arrets, nomElement } from './etapes.js';
import { construireSvg, appliquerArret } from './schema-svg.js';
import { couleursToile } from './couleurs.js';
import { listeBlocs, migrer } from './modele.js';
import { chargerSchema, chargerDeCorbeille } from './stockage.js';
import { creerPoint, brancherPointeur } from './pointeur.js';
import { creerFeutre } from './feutre.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------
// Reprise : on retient, pour chaque schéma, l'étape atteinte (sur cet
// appareil seulement), pour proposer de reprendre là où on s'était arrêté.
// ---------------------------------------------------------------------
const CLE_REPRISE = 'omni-schema.reprise';

export function lireReprise(idSchema) {
  try {
    const table = JSON.parse(localStorage.getItem(CLE_REPRISE) || '{}') || {};
    return Number.isInteger(table[idSchema]) ? table[idSchema] : 0;
  } catch { return 0; }
}

export function ecrireReprise(idSchema, index) {
  try {
    const table = JSON.parse(localStorage.getItem(CLE_REPRISE) || '{}') || {};
    table[idSchema] = index;
    localStorage.setItem(CLE_REPRISE, JSON.stringify(table));
  } catch { /* stockage indisponible : tant pis pour la reprise */ }
}

/** Faut-il proposer de reprendre ? (pas au début, pas si on avait fini) */
export const repriseUtile = (index, nombre) => index > 0 && index < nombre - 1;

/** Thème utilisé pour présenter ce schéma (« auto » = celui de l'application). */
export function themePresentation(schema) {
  return schema.theme && schema.theme !== 'auto' ? schema.theme : etat.themeResolu;
}

export function creerPresentation({ apresFermeture }) {
  const racine = $('presentation');
  const scene = $('pres-scene');
  const compteur = $('pres-compteur');
  const boutonPrecedent = $('pres-precedent');
  const boutonSuivant = $('pres-suivant');
  const boutonNotes = $('pres-notes');
  const panneauNotes = $('pres-panneau-notes');
  const aide = $('pres-aide');
  const bandeauReprise = $('pres-reprise');

  let rendu = null;
  let liste = [];
  let index = 0;
  let schemaCourant = null; // schéma affiché (le principal, ou un sous-schéma)
  let pile = [];            // sous-schémas : [{ schema, index }] des schémas parents
  let minuterieMessage = null;
  let pleinEcranActif = false;
  let verrouEcran = null;
  let depart = null;

  // Pointeur lumineux (appui long, ou touche L).
  const point = creerPoint(scene);
  const enCours = () => etat.presentation && !racine.hidden;
  // Feutre : quand il est actif, toucher le schéma dessine (au lieu de changer d'étape).
  const feutre = creerFeutre(scene, { peutDessiner: enCours, surTrait: () => majFeutre() });
  const pointeur = brancherPointeur(scene, point, { actif: () => enCours() && !feutre.actif() });

  function majFeutre() {
    $('pres-feutre').setAttribute('aria-pressed', String(feutre.actif()));
    $('pres-effacer').hidden = !feutre.actif() && !feutre.aDesTraits();
  }
  function basculerFeutre() {
    const actif = feutre.basculer();
    majFeutre();
    montrerMessage(actif ? 'Feutre : dessine sur le schéma. Les flèches en bas (ou le clavier) changent d\'étape.' : 'Feutre rangé.');
  }

  // ------------------------------------------------------------------
  /** Affiche un schéma (le principal ou un sous-schéma) à l'arrêt n° i. */
  function charger(schema, i) {
    schemaCourant = schema;
    const theme = themePresentation(schema);
    rendu = construireSvg(schema, theme, { liens: true });
    rendu.svg.setAttribute('width', '100%');
    rendu.svg.setAttribute('height', '100%');
    rendu.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    scene.replaceChildren(rendu.svg, point.element);
    racine.dataset.theme = theme; // les couleurs des boutons suivent le thème de présentation
    racine.style.background = couleursToile(theme).fond;
    liste = arrets(schema);
    index = Math.max(0, Math.min(liste.length - 1, i));
    const parent = pile[pile.length - 1];
    $('pres-retour').hidden = !parent;
    if (parent) $('pres-retour-texte').textContent = `Retour : ${courtTitre(parent.schema.titre)}`;
    afficher(null);
  }

  const courtTitre = (t) => (t.length > 28 ? `${t.slice(0, 27)}…` : t);

  /** Petit message sur l'écran de présentation (quelques secondes). */
  function montrerMessage(texte) {
    const m = $('pres-message');
    m.textContent = texte;
    m.hidden = false;
    clearTimeout(minuterieMessage);
    minuterieMessage = setTimeout(() => { m.hidden = true; }, 4000);
  }

  /** Entre dans le sous-schéma d'un bloc. */
  async function entrer(id) {
    let brut = null;
    try { brut = await chargerSchema(id); } catch { brut = null; }
    if (!brut) {
      let dansCorbeille = false;
      try { dansCorbeille = !!(await chargerDeCorbeille(id)); } catch { /* rien */ }
      montrerMessage(dansCorbeille ? 'Ce sous-schéma est dans la corbeille.' : 'Ce sous-schéma n\'existe plus.');
      return;
    }
    let sous;
    try { sous = migrer(brut); } catch (erreur) { montrerMessage(erreur.message); return; }
    if (!listeBlocs(sous).length) { montrerMessage(`« ${courtTitre(sous.titre)} » est vide.`); return; }
    pile.push({ schema: schemaCourant, index });
    bandeauReprise.hidden = true;
    aide.hidden = true;
    charger(sous, 0);
    montrerMessage(`Sous-schéma « ${courtTitre(sous.titre)} »`);
  }

  /** Revient au schéma parent, à l'étape où on l'avait quitté. */
  function revenir() {
    const parent = pile.pop();
    if (!parent) return;
    charger(parent.schema, parent.index);
  }

  /** Bloc relié à un sous-schéma, visible, sous ce point de l'écran (ou null). */
  function lienSous(clientX, clientY) {
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

  /** Touche O : le sous-schéma de l'étape (celui qui vient d'apparaître, sinon le seul visible). */
  function lienAuClavier() {
    const visibles = rendu.elements.filter((e) => e.type === 'bloc' && e.donnees.lien && e.g.style.display !== 'none');
    const deCetteEtape = visibles.filter((e) => e.etape === liste[index]);
    const choix = deCetteEtape[0] || (visibles.length === 1 ? visibles[0] : null);
    if (choix) entrer(choix.donnees.lien);
    else montrerMessage(visibles.length ? 'Touche le bloc marqué ↗ pour entrer dans son sous-schéma.' : 'Pas de sous-schéma à cette étape.');
  }

  // ------------------------------------------------------------------
  async function ouvrir() {
    const schema = etat.schema;
    if (!schema || !listeBlocs(schema).length) return false;
    pile = [];
    racine.classList.toggle('avec-fondu', !!etat.reglages.fondu);
    // Reprise proposée si on s'était arrêté en cours de route
    // (à lire AVANT d'afficher, car l'affichage note l'étape atteinte).
    const reprise = lireReprise(schema.id);
    charger(schema, 0);
    bandeauReprise.hidden = !repriseUtile(reprise, liste.length);
    $('pres-reprise-texte').textContent = `La dernière fois, tu en étais à l'étape ${reprise + 1} sur ${liste.length}.`;
    $('pres-reprendre').onclick = () => { bandeauReprise.hidden = true; aide.hidden = true; allerA(reprise); racine.focus({ preventScroll: true }); };
    $('pres-debut').onclick = () => { bandeauReprise.hidden = true; racine.focus({ preventScroll: true }); };
    panneauNotes.hidden = true;
    boutonNotes.setAttribute('aria-expanded', 'false');
    aide.hidden = liste.length <= 1;

    etat.presentation = true;
    racine.hidden = false;
    racine.focus({ preventScroll: true });

    // Plein écran (si le navigateur le permet).
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        pleinEcranActif = true;
      }
    } catch { pleinEcranActif = false; }
    garderEcranAllume();
    return true;
  }

  function fermer() {
    if (!etat.presentation || racine.hidden) return;
    etat.presentation = false;
    racine.hidden = true;
    pointeur.reinitialiser();
    scene.replaceChildren(point.element);
    rendu = null;
    pile = [];
    schemaCourant = null;
    $('pres-message').hidden = true;
    feutre.reinitialiser();
    majFeutre();
    if (pleinEcranActif && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    pleinEcranActif = false;
    if (verrouEcran) { verrouEcran.release().catch(() => {}); verrouEcran = null; }
    apresFermeture();
  }

  /** Empêche l'écran de se mettre en veille pendant la démonstration. */
  async function garderEcranAllume() {
    try {
      if ('wakeLock' in navigator && etat.presentation) verrouEcran = await navigator.wakeLock.request('screen');
    } catch { verrouEcran = null; }
  }

  // ------------------------------------------------------------------
  function afficher(arretPrecedent) {
    const arret = liste[index];
    feutre.effacer(); // nouvelle étape : page blanche pour le feutre
    majFeutre();
    const nouveaux = appliquerArret(rendu, arret, { surligner: true, precedent: arretPrecedent });
    // Fondu très léger (option), seulement en avançant.
    if (etat.reglages.fondu && arretPrecedent !== null) {
      for (const g of nouveaux) {
        g.classList.remove('apparait');
        g.getBoundingClientRect(); // relance l'effet
        g.classList.add('apparait');
      }
    }
    compteur.textContent = `${index + 1} / ${liste.length}`;
    compteur.setAttribute('aria-label', `Étape ${index + 1} sur ${liste.length}`);
    // Dans un sous-schéma, « précédent » au début et « suivant » à la fin ramènent au parent.
    boutonPrecedent.disabled = index === 0 && !pile.length;
    boutonSuivant.disabled = index === liste.length - 1 && !pile.length;
    remplirNotes(arret);
    if (!pile.length) ecrireReprise(schemaCourant.id, index); // la reprise vaut pour le schéma principal
  }

  function suivant() {
    bandeauReprise.hidden = true;
    if (index >= liste.length - 1) { if (pile.length) revenir(); return; }
    const avant = liste[index];
    index++;
    aide.hidden = true;
    afficher(avant);
  }

  function precedent() {
    bandeauReprise.hidden = true;
    if (index <= 0) { if (pile.length) revenir(); return; }
    index--;
    aide.hidden = true;
    afficher(null);
  }

  function allerA(i) {
    index = Math.max(0, Math.min(liste.length - 1, i));
    afficher(null);
  }

  // ------------------------------------------------------------------
  // Notes du présentateur : celles des blocs qui apparaissent à cette étape.
  function remplirNotes(arret) {
    const titre = $('pres-notes-titre');
    const contenu = $('pres-notes-contenu');
    titre.textContent = arret === 0 ? 'Notes — début' : `Notes — étape ${index + 1}`;
    contenu.replaceChildren();
    const concernes = rendu.elements.filter((e) => e.type === 'bloc' && e.etape === arret && e.donnees.note.trim());
    if (!concernes.length) {
      const p = document.createElement('p');
      p.className = 'pres-sans-note';
      p.textContent = 'Pas de note pour cette étape.';
      contenu.appendChild(p);
      return;
    }
    for (const e of concernes) {
      const bloc = document.createElement('div');
      bloc.className = 'pres-note';
      const nom = document.createElement('p');
      nom.className = 'pres-note-bloc';
      nom.textContent = nomElement(schemaCourant, e.donnees, 60);
      const texte = document.createElement('p');
      texte.className = 'pres-note-texte';
      texte.textContent = e.donnees.note;
      bloc.append(nom, texte);
      contenu.appendChild(bloc);
    }
  }

  function basculerNotes() {
    panneauNotes.hidden = !panneauNotes.hidden;
    boutonNotes.setAttribute('aria-expanded', String(!panneauNotes.hidden));
  }

  // ------------------------------------------------------------------
  // Toucher / clic sur la scène : droite = suivant, gauche = précédent.
  scene.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    depart = feutre.actif() ? null : { x: e.clientX, y: e.clientY }; // le feutre dessine, il ne navigue pas
  });
  scene.addEventListener('pointerup', (e) => {
    if (!depart) return;
    if (pointeur.consomme()) { depart = null; return; } // c'était le pointeur, pas un changement d'étape
    const dx = e.clientX - depart.x;
    const dy = e.clientY - depart.y;
    depart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) suivant(); else precedent(); // glissement façon « pages »
      return;
    }
    if (Math.hypot(dx, dy) > 20) return; // ni toucher ni glissement net
    // Toucher un bloc relié (marqué ↗) : on entre dans son sous-schéma.
    const lien = lienSous(e.clientX, e.clientY);
    if (lien) { entrer(lien); return; }
    const largeur = scene.clientWidth || window.innerWidth;
    if (e.clientX - scene.getBoundingClientRect().left < largeur / 3) precedent();
    else suivant();
  });
  scene.addEventListener('pointercancel', () => { depart = null; });
  scene.addEventListener('contextmenu', (e) => e.preventDefault());

  boutonPrecedent.addEventListener('click', precedent);
  boutonSuivant.addEventListener('click', suivant);
  boutonNotes.addEventListener('click', basculerNotes);
  $('pres-quitter').addEventListener('click', fermer);
  $('pres-retour').addEventListener('click', revenir);
  $('pres-feutre').addEventListener('click', basculerFeutre);
  $('pres-effacer').addEventListener('click', () => { feutre.effacer(); majFeutre(); });

  // Clavier (prioritaire pendant la présentation).
  document.addEventListener('keydown', (e) => {
    if (!etat.presentation || racine.hidden) return; // (la vue présentateur a ses propres touches)
    const surBouton = e.target.closest && e.target.closest('button');
    let geree = true;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
        if (e.key === ' ' && surBouton) { geree = false; break; }
        suivant(); break;
      case 'Enter':
        if (surBouton) { geree = false; break; }
        suivant(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        precedent(); break;
      case 'Home': allerA(0); break;
      case 'End': allerA(liste.length - 1); break;
      case 'Escape': fermer(); break;
      case 'n': case 'N': basculerNotes(); break;
      case 'l': case 'L': pointeur.basculerSouris(); break;
      case 'o': case 'O': lienAuClavier(); break;
      case 'd': case 'D': basculerFeutre(); break;
      case 'e': case 'E': feutre.effacer(); majFeutre(); break;
      case 'Tab': geree = false; break;
      default: geree = false;
    }
    if (geree) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // Quitter le plein écran (Échap, geste « retour »…) = quitter la présentation.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && pleinEcranActif && etat.presentation) {
      pleinEcranActif = false;
      fermer();
    }
  });
  // Le verrou « écran allumé » saute quand on change d'application : on le reprend au retour.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && etat.presentation) garderEcranAllume();
  });

  return { ouvrir, fermer };
}
