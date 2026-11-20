// =====================================================================
// Pointeur lumineux pendant la présentation : un point de couleur vive
// qui suit le doigt ou la souris, pour montrer un détail au public.
//
// - Appui long (doigt ou souris) sur le schéma : le point apparaît et
//   suit le geste ; il disparaît quand on relâche (sans changer d'étape).
// - Touche L : le point suit la souris sans cliquer (L encore : il part).
//
// La position est exprimée en COORDONNÉES DU SCHÉMA (celles du SVG) :
// la vue présentateur peut ainsi l'envoyer à la fenêtre public, dont
// l'écran n'a pas la même taille.
// =====================================================================

const DELAI_APPUI_LONG = 350; // millisecondes
const TOLERANCE = 12;         // pixels de mouvement tolérés avant l'appui long

/**
 * Crée le point lumineux dans « cadre » (élément positionné qui contient
 * le SVG du schéma). Renvoie de quoi le montrer, le cacher et convertir
 * les positions.
 */
export function creerPoint(cadre) {
  const point = document.createElement('div');
  point.className = 'pointeur-laser';
  point.hidden = true;
  point.setAttribute('aria-hidden', 'true');
  cadre.appendChild(point);

  const svg = () => cadre.querySelector('svg');

  /** Position écran → coordonnées du schéma (ou null). */
  function versSchema(clientX, clientY) {
    const s = svg();
    const ctm = s && s.getScreenCTM();
    if (!ctm) return null;
    const p = s.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const r = p.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  }

  /** Place le point sur une position du schéma. */
  function montrerSchema(x, y) {
    const s = svg();
    const ctm = s && s.getScreenCTM();
    if (!ctm) return;
    const p = s.createSVGPoint();
    p.x = x;
    p.y = y;
    const e = p.matrixTransform(ctm);
    const r = cadre.getBoundingClientRect();
    point.style.left = `${e.x - r.left}px`;
    point.style.top = `${e.y - r.top}px`;
    point.hidden = false;
  }

  /** Place le point sous le doigt / la souris ; renvoie la position dans le schéma. */
  function montrerEcran(clientX, clientY) {
    const r = cadre.getBoundingClientRect();
    point.style.left = `${clientX - r.left}px`;
    point.style.top = `${clientY - r.top}px`;
    point.hidden = false;
    return versSchema(clientX, clientY);
  }

  const cacher = () => { point.hidden = true; };

  return { element: point, montrerEcran, montrerSchema, cacher, visible: () => !point.hidden };
}

/**
 * Branche l'appui long et la touche L sur « cadre ».
 * - « point » : résultat de creerPoint ;
 * - « surPosition(pos) » : appelé à chaque mouvement (pos = {x, y} dans le
 *   schéma) et avec null quand le point disparaît ;
 * - « actif() » : le pointeur ne fonctionne que si cette fonction dit oui.
 * Renvoie { consomme(e) } : vrai si le dernier geste a servi au pointeur
 * (le relâcher ne doit alors pas changer d'étape).
 */
export function brancherPointeur(cadre, point, { surPosition = () => {}, actif = () => true } = {}) {
  let appui = null;        // { id, x, y, minuterie }
  let enCours = false;     // le point suit un appui
  let suitSouris = false;  // touche L
  let consomme = false;

  const montrer = (e) => surPosition(point.montrerEcran(e.clientX, e.clientY));
  const arreter = () => {
    enCours = false;
    if (!suitSouris) { point.cacher(); surPosition(null); }
  };

  cadre.addEventListener('pointerdown', (e) => {
    if (!actif()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    consomme = false;
    clearTimeout(appui && appui.minuterie);
    appui = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
    appui.minuterie = setTimeout(() => {
      if (!appui || appui.id !== e.pointerId) return;
      enCours = true;
      consomme = true;
      try { cadre.setPointerCapture(e.pointerId); } catch { /* sans importance */ }
      if (navigator.vibrate) navigator.vibrate(10);
      surPosition(point.montrerEcran(appui.x, appui.y));
    }, DELAI_APPUI_LONG);
  });

  cadre.addEventListener('pointermove', (e) => {
    if (!actif()) return;
    if (enCours && appui && e.pointerId === appui.id) { appui.x = e.clientX; appui.y = e.clientY; montrer(e); return; }
    if (appui && e.pointerId === appui.id) {
      appui.x = e.clientX;
      appui.y = e.clientY;
      // Le doigt bouge avant l'appui long : c'est un glissement, pas le pointeur.
      if (Math.hypot(e.clientX - appui.x0, e.clientY - appui.y0) > TOLERANCE) clearTimeout(appui.minuterie);
    }
    if (suitSouris && e.pointerType === 'mouse') montrer(e);
  });

  const fin = (e) => {
    if (!appui || e.pointerId !== appui.id) return;
    clearTimeout(appui.minuterie);
    appui = null;
    if (enCours) arreter();
  };
  cadre.addEventListener('pointerup', fin);
  cadre.addEventListener('pointercancel', fin);
  cadre.addEventListener('pointerleave', (e) => {
    if (suitSouris && e.pointerType === 'mouse') { point.cacher(); surPosition(null); }
  });

  return {
    /** Le dernier toucher a servi au pointeur (ne pas changer d'étape). */
    consomme: () => consomme,
    /** Touche L : le point suit la souris (ou s'en va). Renvoie le nouvel état. */
    basculerSouris() {
      suitSouris = !suitSouris;
      cadre.classList.toggle('avec-pointeur', suitSouris);
      if (!suitSouris) { point.cacher(); surPosition(null); }
      return suitSouris;
    },
    /** Remet tout à zéro (fermeture de la présentation). */
    reinitialiser() {
      clearTimeout(appui && appui.minuterie);
      appui = null;
      enCours = false;
      suitSouris = false;
      consomme = false;
      cadre.classList.remove('avec-pointeur');
      point.cacher();
    },
  };
}
