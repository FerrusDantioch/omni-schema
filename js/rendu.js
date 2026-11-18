// =====================================================================
// Dessin du schéma en SVG.
//
// Pour rester fluide sur téléphone, on ne redessine pas tout à chaque
// mouvement : chaque élément garde une « signature » (texte, taille,
// couleur…). Si elle n'a pas changé, on se contente de déplacer l'élément.
// =====================================================================

import { couleurBloc, couleursToile } from './couleurs.js';
import { POLICE, POLICE_CHIFFRES, GRAISSE, GRILLE } from './config.js';
import { mettreEnPage, INTERLIGNE } from './texte.js';
import { zoneTexte, traceFleche, milieu, pointe, pointBord, centre } from './geometrie.js';
import { listeBlocs, listeFleches, trouver } from './modele.js';

const NS = 'http://www.w3.org/2000/svg';
const arrondir = (v) => Math.round(v * 10) / 10;

/** Crée un élément SVG avec ses attributs (et l'ajoute à « parent »). */
export function el(nom, attributs = {}, parent = null) {
  const e = document.createElementNS(NS, nom);
  for (const [cle, valeur] of Object.entries(attributs)) {
    if (valeur !== undefined && valeur !== null) e.setAttribute(cle, valeur);
  }
  if (parent) parent.appendChild(e);
  return e;
}

/** Pastille ronde avec le numéro d'étape (visible seulement en édition). */
function pastilleEtape(parent, x, y, numero, theme) {
  const T = couleursToile(theme);
  const g = el('g', { class: 'pastille-etape' }, parent);
  el('circle', { cx: x, cy: y, r: 12, fill: T.selection, stroke: T.fond, 'stroke-width': 2 }, g);
  const t = el('text', {
    x, y: y + 4.5, fill: T.fond, 'font-size': 13, 'font-weight': 700, 'text-anchor': 'middle', 'font-family': POLICE_CHIFFRES,
  }, g);
  t.textContent = String(numero);
}

/** Dessine la forme et le texte d'un bloc dans le groupe « g » (coordonnées locales). */
export function dessinerBloc(g, b, theme, { masquerTexte = false, badge = false } = {}) {
  g.replaceChildren();
  const c = couleurBloc(theme, b.couleur);
  const w = b.largeur;
  const h = b.hauteur;
  const style = { fill: c.fond, stroke: c.bord, 'stroke-width': 2, 'stroke-linejoin': 'round' };
  switch (b.forme) {
    case 'rectangle':
      el('rect', { x: 0, y: 0, width: w, height: h, ...style }, g);
      break;
    case 'ovale':
      el('ellipse', { cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2, ...style }, g);
      break;
    case 'losange':
      el('polygon', { points: `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`, ...style }, g);
      break;
    default: // arrondi
      el('rect', { x: 0, y: 0, width: w, height: h, rx: Math.min(14, h / 3), ...style }, g);
  }
  if (badge && b.etape > 0) pastilleEtape(g, 0, 0, b.etape, theme);
  if (masquerTexte) return;

  const zone = zoneTexte({ ...b, x: 0, y: 0 });
  const mise = mettreEnPage(b.texte, zone.largeur, zone.hauteur);
  if (!mise.lignes.length) return;
  const hauteurLigne = mise.taille * INTERLIGNE;
  const haut = zone.y + (zone.hauteur - mise.lignes.length * hauteurLigne) / 2;
  const texte = el('text', {
    fill: c.texte,
    'font-size': mise.taille,
    'font-family': POLICE,
    'font-weight': GRAISSE,
    'text-anchor': 'middle',
  }, g);
  mise.lignes.forEach((ligne, i) => {
    const t = el('tspan', {
      x: arrondir(zone.x + zone.largeur / 2),
      // ligne de base : milieu de la ligne + ~0,35 × taille
      y: arrondir(haut + i * hauteurLigne + hauteurLigne / 2 + mise.taille * 0.35),
    }, texte);
    t.textContent = ligne || '\u00a0';
  });
  const pastille = g.querySelector('.pastille-etape');
  if (pastille) g.appendChild(pastille); // au premier plan, devant le texte
}

/** Dessine une flèche (trait, pointe, étiquette) dans le groupe « g ». */
export function dessinerFleche(g, f, A, B, theme, { selectionnee = false, zoneClic = true, badge = false } = {}) {
  g.replaceChildren();
  const T = couleursToile(theme);
  const points = traceFleche(f, A, B);
  if (points.length < 2) return;
  const couleur = selectionnee ? T.selection : T.trait;
  const epaisseur = selectionnee ? 3 : 2;
  const { triangle, trajet } = pointe(points, 12);
  const d = `M${trajet.map((p) => `${arrondir(p.x)} ${arrondir(p.y)}`).join(' L')}`;
  if (zoneClic) {
    // Trait invisible et épais : plus facile à toucher au doigt.
    el('path', { d: `M${points.map((p) => `${arrondir(p.x)} ${arrondir(p.y)}`).join(' L')}`, class: 'zone-clic', fill: 'none', stroke: 'transparent', 'stroke-width': 24 }, g);
  }
  el('path', { d, fill: 'none', stroke: couleur, 'stroke-width': epaisseur, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
  el('polygon', { points: triangle.map((p) => `${arrondir(p.x)},${arrondir(p.y)}`).join(' '), fill: couleur }, g);
  if (f.etiquette) {
    const m = milieu(points);
    const t = el('text', {
      x: arrondir(m.x),
      y: arrondir(m.y + 5),
      fill: couleur,
      stroke: T.fond,
      'stroke-width': 6,
      'stroke-linejoin': 'round',
      'paint-order': 'stroke',
      'font-size': 14,
      'font-family': POLICE,
      'font-weight': GRAISSE,
      'text-anchor': 'middle',
    }, g);
    t.textContent = f.etiquette;
  }
  if (badge && f.etape > 0) {
    const p = milieu(points, f.etiquette ? 0.25 : 0.5);
    pastilleEtape(g, arrondir(p.x), arrondir(p.y), f.etape, theme);
  }
}

/**
 * Crée le moteur de rendu attaché au SVG de la page.
 * Renvoie { rendre(etat), tailleZone() }.
 */
export function creerRendu(svg) {
  const monde = svg.querySelector('#monde');
  const calqueFleches = svg.querySelector('#calque-fleches');
  const calqueBlocs = svg.querySelector('#calque-blocs');
  const calqueGuides = svg.querySelector('#calque-guides');
  const calquePoignees = svg.querySelector('#calque-poignees');
  const zone = svg.parentElement;

  const noeuds = new Map(); // id → { g, signature, position }
  let derniereVue = '';
  let dernierFond = '';

  /** Place la « caméra » : déplacement et zoom de tout le dessin. */
  function appliquerVue(vue, theme, grilleVisible) {
    const cle = `${vue.x}|${vue.y}|${vue.k}|${theme}|${grilleVisible}`;
    if (cle === derniereVue) return;
    derniereVue = cle;
    monde.setAttribute('transform', `translate(${arrondir(vue.x)} ${arrondir(vue.y)}) scale(${vue.k})`);
    // La grille est un simple motif CSS en fond de la zone : très léger.
    let pas = GRILLE * vue.k;
    while (pas < 10) pas *= 5; // trop serré quand on dézoome : on espace
    const T = couleursToile(theme);
    const fond = `${T.fond}|${T.grille}|${grilleVisible}`;
    if (fond !== dernierFond) {
      dernierFond = fond;
      zone.style.backgroundColor = T.fond;
      zone.style.backgroundImage = grilleVisible
        ? `linear-gradient(to right, ${T.grille} 1px, transparent 1px), linear-gradient(to bottom, ${T.grille} 1px, transparent 1px)`
        : 'none';
    }
    zone.style.backgroundSize = `${pas}px ${pas}px`;
    zone.style.backgroundPosition = `${arrondir(vue.x)}px ${arrondir(vue.y)}px`;
  }

  /** Crée ou met à jour le nœud SVG d'un élément. */
  function noeudPour(id, classe, parent) {
    let n = noeuds.get(id);
    if (!n) {
      const g = el('g', { class: classe, 'data-id': id }, parent);
      n = { g, signature: '', position: '' };
      noeuds.set(id, n);
    }
    return n;
  }

  /** Redessine tout ce qui a changé. */
  function rendre(etat) {
    const { schema, vue, themeResolu: theme } = etat;
    appliquerVue(vue, theme, etat.reglages.grille);
    if (!schema) return;

    const blocs = listeBlocs(schema);
    const parId = new Map(blocs.map((b) => [b.id, b]));
    const presents = new Set();

    // --- Blocs ---
    for (const b of blocs) {
      presents.add(b.id);
      const n = noeudPour(b.id, 'bloc', calqueBlocs);
      const enEdition = etat.editionId === b.id;
      const badge = etat.reglages.pastilles;
      const signature = `${b.largeur}|${b.hauteur}|${b.forme}|${b.couleur}|${theme}|${enEdition}|${badge}|${b.etape}|${b.texte}`;
      if (signature !== n.signature) {
        dessinerBloc(n.g, b, theme, { masquerTexte: enEdition, badge });
        n.signature = signature;
        n.g.setAttribute('aria-label', b.texte || 'Bloc vide');
      }
      const position = `${b.x}|${b.y}`;
      if (position !== n.position) {
        n.g.setAttribute('transform', `translate(${arrondir(b.x)} ${arrondir(b.y)})`);
        n.position = position;
      }
      n.g.classList.toggle('selectionne', etat.selection === b.id);
      if (n.g.parentNode !== calqueBlocs) calqueBlocs.appendChild(n.g);
    }

    // --- Flèches (recalculées : elles suivent les blocs) ---
    for (const f of listeFleches(schema)) {
      const A = parId.get(f.de);
      const B = parId.get(f.vers);
      if (!A || !B) continue;
      presents.add(f.id);
      const n = noeudPour(f.id, 'fleche', calqueFleches);
      const selectionnee = etat.selection === f.id;
      const signature = [A.x, A.y, A.largeur, A.hauteur, A.forme, B.x, B.y, B.largeur, B.hauteur, B.forme,
        f.style, f.etiquette, theme, selectionnee, f.etape, etat.reglages.pastilles].join('|');
      if (signature !== n.signature) {
        dessinerFleche(n.g, f, A, B, theme, { selectionnee, badge: etat.reglages.pastilles });
        n.signature = signature;
      }
    }

    // --- Nettoyage des éléments supprimés ---
    for (const [id, n] of noeuds) {
      if (!presents.has(id)) { n.g.remove(); noeuds.delete(id); }
    }

    // L'ordre des blocs dans le DOM suit l'ordre du schéma (le dernier est au-dessus).
    let precedent = null;
    for (const b of blocs) {
      const g = noeuds.get(b.id).g;
      if (g.previousSibling !== precedent) calqueBlocs.insertBefore(g, precedent ? precedent.nextSibling : calqueBlocs.firstChild);
      precedent = g;
    }

    dessinerGuides(etat);
    dessinerPoignees(etat, parId);
  }

  /** Lignes d'alignement affichées pendant un déplacement. */
  function dessinerGuides(etat) {
    calqueGuides.replaceChildren();
    if (!etat.guides.length) return;
    const { vue } = etat;
    const T = couleursToile(etat.themeResolu);
    const { largeur, hauteur } = tailleZone();
    const x1 = -vue.x / vue.k, y1 = -vue.y / vue.k;
    const x2 = (largeur - vue.x) / vue.k, y2 = (hauteur - vue.y) / vue.k;
    for (const g of etat.guides) {
      const attrs = g.axe === 'x' ? { x1: g.valeur, x2: g.valeur, y1, y2 } : { x1, x2, y1: g.valeur, y2: g.valeur };
      el('line', { ...attrs, stroke: T.guide, 'stroke-width': 1.5 / vue.k, 'stroke-dasharray': `${6 / vue.k} ${4 / vue.k}` }, calqueGuides);
    }
  }

  /** Contour de sélection, poignées de taille et de liaison, flèche en cours de création. */
  function dessinerPoignees(etat, parId) {
    calquePoignees.replaceChildren();
    const { vue, schema } = etat;
    const k = vue.k;
    const T = couleursToile(etat.themeResolu);
    const sel = trouver(schema, etat.selection);

    if (sel && sel.type === 'bloc' && etat.editionId !== sel.id) {
      const m = 5 / k;
      el('rect', {
        x: sel.x - m, y: sel.y - m, width: sel.largeur + 2 * m, height: sel.hauteur + 2 * m, rx: 4 / k,
        fill: 'none', stroke: T.selection, 'stroke-width': 2 / k, 'stroke-dasharray': `${6 / k} ${4 / k}`, class: 'decor',
      }, calquePoignees);

      // Poignée de redimensionnement (coin bas-droit).
      const coinX = sel.x + sel.largeur + m;
      const coinY = sel.y + sel.hauteur + m;
      el('rect', { x: coinX - 7 / k, y: coinY - 7 / k, width: 14 / k, height: 14 / k, rx: 3 / k, fill: T.selection, stroke: T.fond, 'stroke-width': 2 / k, class: 'decor' }, calquePoignees);
      el('circle', { cx: coinX, cy: coinY, r: 22 / k, fill: 'transparent', 'data-poignee': 'redim', class: 'poignee-redim' }, calquePoignees);

      // Poignée de liaison (rond « + » à droite) : on la tire pour créer une flèche.
      const lx = sel.x + sel.largeur + 30 / k;
      const ly = sel.y + sel.hauteur / 2;
      el('circle', { cx: lx, cy: ly, r: 12 / k, fill: T.selection, stroke: T.fond, 'stroke-width': 2 / k, class: 'decor' }, calquePoignees);
      el('path', { d: `M${lx - 6 / k} ${ly}h${12 / k}M${lx} ${ly - 6 / k}v${12 / k}`, stroke: T.fond, 'stroke-width': 2.5 / k, 'stroke-linecap': 'round', class: 'decor' }, calquePoignees);
      el('circle', { cx: lx, cy: ly, r: 22 / k, fill: 'transparent', 'data-poignee': 'relier', class: 'poignee-relier' }, calquePoignees);
    }

    // Flèche en cours de création (pointillés jusqu'au doigt).
    const liaison = etat.liaison;
    if (liaison) {
      const source = parId.get(liaison.de);
      const cible = liaison.cible ? parId.get(liaison.cible) : null;
      if (source && (cible || liaison.x !== null)) {
        const bout = cible ? pointBord(cible, centre(source)) : { x: liaison.x, y: liaison.y };
        const depart = pointBord(source, bout);
        el('line', { x1: depart.x, y1: depart.y, x2: bout.x, y2: bout.y, stroke: T.selection, 'stroke-width': 2 / k, 'stroke-dasharray': `${6 / k} ${4 / k}`, class: 'decor' }, calquePoignees);
        el('circle', { cx: bout.x, cy: bout.y, r: 5 / k, fill: T.selection, class: 'decor' }, calquePoignees);
        if (cible) {
          const m = 6 / k;
          el('rect', { x: cible.x - m, y: cible.y - m, width: cible.largeur + 2 * m, height: cible.hauteur + 2 * m, rx: 6 / k, fill: 'none', stroke: T.selection, 'stroke-width': 3 / k, class: 'decor' }, calquePoignees);
        }
      }
    }
  }

  /** Taille de la zone de dessin à l'écran, en pixels. */
  function tailleZone() {
    return { largeur: svg.clientWidth || zone.clientWidth, hauteur: svg.clientHeight || zone.clientHeight };
  }

  /** Oublie tout (au changement de schéma). */
  function vider() {
    for (const n of noeuds.values()) n.g.remove();
    noeuds.clear();
    derniereVue = '';
  }

  return { rendre, tailleZone, vider, forcerFond: () => { dernierFond = ''; derniereVue = ''; } };
}
