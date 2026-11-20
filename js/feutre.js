// =====================================================================
// Feutre de présentation : dessiner à main levée par-dessus le schéma
// (entourer, souligner), pour le public. Rien n'est enregistré dans le
// schéma : les traits s'effacent au changement d'étape, ou avec
// « Effacer ».
//
// Les traits sont tracés DANS le SVG du schéma, en coordonnées du
// schéma : ils restent au bon endroit si la fenêtre change de taille,
// et la vue présentateur peut les envoyer à la fenêtre public.
// =====================================================================

const NS = 'http://www.w3.org/2000/svg';
const COULEUR = '#ff2d6f'; // le même rose vif que le pointeur lumineux

let compteur = 0;

/**
 * Prépare le feutre sur « cadre » (élément qui contient le SVG du schéma).
 * - « surTrait(message) » : prévenu de chaque point dessiné et de chaque
 *   effacement (pour les envoyer à une autre fenêtre) ;
 * - « peutDessiner() » : le feutre ne marche que si cette fonction dit oui.
 */
export function creerFeutre(cadre, { surTrait = () => {}, peutDessiner = () => true } = {}) {
  let actif = false;
  let trait = null; // { id, points, chemin, pointeur }
  const chemins = new Map(); // id → <path> (traits reçus ou dessinés)

  const svg = () => cadre.querySelector('svg');

  /** Groupe des traits, tout en haut du dessin (créé au besoin). */
  function calque() {
    const s = svg();
    if (!s) return null;
    let g = s.querySelector(':scope > g.feutre');
    if (!g) {
      g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'feutre');
      g.setAttribute('fill', 'none');
      g.setAttribute('stroke', COULEUR);
      g.setAttribute('stroke-width', '5');
      g.setAttribute('stroke-linecap', 'round');
      g.setAttribute('stroke-linejoin', 'round');
      g.setAttribute('pointer-events', 'none');
      s.appendChild(g);
    }
    return g;
  }

  function versSchema(clientX, clientY) {
    const s = svg();
    const ctm = s && s.getScreenCTM();
    if (!ctm) return null;
    const p = s.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const r = p.matrixTransform(ctm.inverse());
    return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10 };
  }

  /** Ajoute un point au trait « id » (le crée au besoin). */
  function ajouterPoint(id, x, y) {
    let chemin = chemins.get(id);
    if (!chemin || !chemin.isConnected) {
      const g = calque();
      if (!g) return;
      chemin = document.createElementNS(NS, 'path');
      // Épaisseur constante à l'écran, quel que soit le zoom du dessin.
      chemin.setAttribute('vector-effect', 'non-scaling-stroke');
      chemin.dataset.points = '';
      g.appendChild(chemin);
      chemins.set(id, chemin);
    }
    const points = chemin.dataset.points ? `${chemin.dataset.points} L${x} ${y}` : `M${x} ${y} L${x} ${y}`;
    chemin.dataset.points = points;
    chemin.setAttribute('d', points);
  }

  /** Efface tous les traits (sans prévenir : voir effacer()). */
  function viderTraits() {
    for (const c of chemins.values()) c.remove();
    chemins.clear();
    const g = svg() && svg().querySelector(':scope > g.feutre');
    if (g) g.replaceChildren();
  }

  function effacer() {
    if (!chemins.size) return;
    viderTraits();
    surTrait({ action: 'effacer' });
  }

  cadre.addEventListener('pointerdown', (e) => {
    if (!actif || !peutDessiner()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = versSchema(e.clientX, e.clientY);
    if (!p) return;
    e.preventDefault();
    try { cadre.setPointerCapture(e.pointerId); } catch { /* sans importance */ }
    trait = { id: `t${Date.now().toString(36)}${compteur++}`, pointeur: e.pointerId, dernier: { x: e.clientX, y: e.clientY } };
    ajouterPoint(trait.id, p.x, p.y);
    surTrait({ action: 'point', trait: trait.id, x: p.x, y: p.y });
  });
  cadre.addEventListener('pointermove', (e) => {
    if (!trait || e.pointerId !== trait.pointeur) return;
    // Un point tous les 2 pixels environ suffit pour un trait lisse.
    if (Math.hypot(e.clientX - trait.dernier.x, e.clientY - trait.dernier.y) < 2) return;
    trait.dernier = { x: e.clientX, y: e.clientY };
    const p = versSchema(e.clientX, e.clientY);
    if (!p) return;
    ajouterPoint(trait.id, p.x, p.y);
    surTrait({ action: 'point', trait: trait.id, x: p.x, y: p.y });
  });
  const fin = (e) => { if (trait && e.pointerId === trait.pointeur) trait = null; };
  cadre.addEventListener('pointerup', fin);
  cadre.addEventListener('pointercancel', fin);

  return {
    actif: () => actif,
    /** Active / désactive le feutre. Renvoie le nouvel état. */
    basculer(valeur = !actif) {
      actif = valeur;
      cadre.classList.toggle('avec-feutre', actif);
      if (!actif) trait = null;
      return actif;
    },
    effacer,
    aDesTraits: () => chemins.size > 0,
    /** Applique un message reçu d'une autre fenêtre (fenêtre public). */
    recevoir(m) {
      if (m.action === 'effacer') viderTraits();
      else if (m.action === 'point') ajouterPoint(m.trait, m.x, m.y);
    },
    /** Oublie tout (nouveau dessin du schéma, fermeture). */
    reinitialiser() {
      actif = false;
      trait = null;
      cadre.classList.remove('avec-feutre');
      chemins.clear();
    },
  };
}
