// =====================================================================
// Dessin du schéma en SVG.
//
// Pour rester fluide sur téléphone, on ne redessine pas tout à chaque
// mouvement : chaque élément garde une « signature » (texte, taille,
// couleur…). Si elle n'a pas changé, on se contente de déplacer l'élément.
// =====================================================================

import { couleurBloc, couleursToile } from './couleurs.js';
import { POLICE, POLICE_CHIFFRES, GRAISSE, GRILLE, BANDE_ZONE } from './config.js';
import { mettreEnPage, INTERLIGNE, lignesEtiquette, TAILLE_ETIQUETTE, LARGEUR_ETIQUETTE, ligneCoupee } from './texte.js';
import { zoneTexte, zoneImage, traceFleche, milieu, pointe, pointBord, centre } from './geometrie.js';
import { listeBlocs, listeFleches, listeZones, trouver, tailleTexte } from './modele.js';

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

/**
 * Dessine la forme et le texte d'un bloc dans le groupe « g » (coordonnées locales).
 * « fantome » : pour un bloc sans cadre, un contour très discret dans
 * l'éditeur seulement (pour le retrouver), jamais dans les exports.
 */
export function dessinerBloc(g, b, theme, { masquerTexte = false, badge = false, images = null, fantome = false } = {}) {
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
    case 'texte': {
      // Sans cadre : surface invisible (pour pouvoir le toucher), contour fantôme en édition.
      const T = couleursToile(theme);
      el('rect', {
        x: 0, y: 0, width: w, height: h, rx: 6, fill: 'transparent',
        stroke: fantome ? T.grille : 'none', 'stroke-width': fantome ? 1.5 : null, 'stroke-dasharray': fantome ? '4 4' : null,
      }, g);
      break;
    }
    default: // arrondi
      el('rect', { x: 0, y: 0, width: w, height: h, rx: Math.min(14, h / 3), ...style }, g);
  }
  // Image du bloc (rangée dans schema.images), ajustée sans déformation.
  const source = b.image && images ? images[b.image] : null;
  if (source) {
    const zi = zoneImage({ ...b, x: 0, y: 0 });
    el('image', {
      href: source, x: arrondir(zi.x), y: arrondir(zi.y), width: arrondir(zi.largeur), height: arrondir(zi.hauteur),
      preserveAspectRatio: 'xMidYMid meet', 'pointer-events': 'none',
    }, g);
  }
  if (badge && b.etape > 0) pastilleEtape(g, 0, 0, b.etape, theme);
  if (masquerTexte) return;

  const zone = zoneTexte({ ...b, x: 0, y: 0 });
  const mise = mettreEnPage(b.texte, zone.largeur, zone.hauteur, tailleTexte(b));
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

/**
 * Dessine une zone de regroupement dans « g » (coordonnées locales) :
 * grand cadre en pointillés, fond léger, titre en haut à gauche.
 * Seuls la bande de titre et le bord réagissent au doigt : l'intérieur
 * laisse passer les gestes (déplacer la vue, toucher deux fois…).
 */
export function dessinerZone(g, z, theme, { badge = false, interactive = true } = {}) {
  g.replaceChildren();
  const c = couleurBloc(theme, z.couleur);
  const w = z.largeur;
  const h = z.hauteur;
  el('rect', {
    x: 0, y: 0, width: w, height: h, rx: 18, fill: c.fond, 'fill-opacity': 0.55,
    stroke: c.bord, 'stroke-width': 2, 'stroke-dasharray': '10 6', 'pointer-events': 'none',
  }, g);
  if (interactive) {
    el('rect', { x: 0, y: 0, width: w, height: h, rx: 18, fill: 'none', stroke: 'transparent', 'stroke-width': 16, 'pointer-events': 'stroke', class: 'zone-prise' }, g);
    el('rect', { x: 0, y: 0, width: w, height: BANDE_ZONE, rx: 18, fill: 'transparent', class: 'zone-prise' }, g);
  }
  const titre = ligneCoupee(z.titre, w - 32, 16, 700);
  if (titre) {
    const t = el('text', {
      x: 16, y: 24, fill: c.texte, 'font-size': 16, 'font-family': POLICE, 'font-weight': 700, 'pointer-events': 'none',
    }, g);
    t.textContent = titre;
  }
  if (badge && z.etape > 0) pastilleEtape(g, 0, 0, z.etape, theme);
}

/** Liste de points → attribut « d » d'un tracé SVG. */
const chemin = (points) => `M${points.map((p) => `${arrondir(p.x)} ${arrondir(p.y)}`).join(' L')}`;
const triangleSvg = (triangle) => triangle.map((p) => `${arrondir(p.x)},${arrondir(p.y)}`).join(' ');

/**
 * Dessine une flèche (trait, pointes, étiquette) dans le groupe « g ».
 * Options de la flèche : trait « plein » ou « pointille », pointes
 * « fin » (une, au bout), « deux » (aux deux bouts) ou « aucune ».
 */
export function dessinerFleche(g, f, A, B, theme, { selectionnee = false, zoneClic = true, badge = false } = {}) {
  g.replaceChildren();
  const T = couleursToile(theme);
  const points = traceFleche(f, A, B);
  if (points.length < 2) return;
  const couleur = selectionnee ? T.selection : T.trait;
  const epaisseur = selectionnee ? 3 : 2;

  // Pointes : on raccourcit le trait à chaque bout qui porte une pointe,
  // pour qu'il ne dépasse pas du triangle.
  let trajet = points;
  const triangles = [];
  if (f.pointes !== 'aucune') {
    const fin = pointe(trajet, 12);
    trajet = fin.trajet;
    triangles.push(fin.triangle);
    if (f.pointes === 'deux') {
      const debut = pointe([...trajet].reverse(), 12);
      trajet = debut.trajet.reverse();
      triangles.push(debut.triangle);
    }
  }
  if (zoneClic) {
    // Trait invisible et épais : plus facile à toucher au doigt.
    el('path', { d: chemin(points), class: 'zone-clic', fill: 'none', stroke: 'transparent', 'stroke-width': 24 }, g);
  }
  el('path', {
    d: chemin(trajet), fill: 'none', stroke: couleur, 'stroke-width': epaisseur,
    'stroke-linejoin': 'round', 'stroke-linecap': f.trait === 'pointille' ? 'butt' : 'round',
    'stroke-dasharray': f.trait === 'pointille' ? '9 7' : null,
  }, g);
  for (const triangle of triangles) el('polygon', { points: triangleSvg(triangle), fill: couleur }, g);

  // Étiquette : centrée sur le milieu du trajet, sur une à trois lignes,
  // avec un contour de la couleur du fond pour rester lisible sur le trait.
  // Flèche plutôt horizontale : l'étiquette ne doit pas être plus large
  // que l'espace entre les deux blocs (sinon elle passerait dessous).
  const debut = points[0];
  const bout = points[points.length - 1];
  let place = LARGEUR_ETIQUETTE;
  if (Math.abs(bout.x - debut.x) > Math.abs(bout.y - debut.y)) {
    place = Math.max(90, Math.min(LARGEUR_ETIQUETTE, Math.abs(bout.x - debut.x) - 24));
  }
  const lignes = lignesEtiquette(f.etiquette, place);
  if (lignes.length) {
    const m = milieu(points);
    const hauteurLigne = TAILLE_ETIQUETTE * INTERLIGNE;
    const haut = m.y - ((lignes.length - 1) * hauteurLigne) / 2 + TAILLE_ETIQUETTE * 0.35;
    const t = el('text', {
      fill: couleur,
      stroke: T.fond,
      'stroke-width': 6,
      'stroke-linejoin': 'round',
      'paint-order': 'stroke',
      'font-size': TAILLE_ETIQUETTE,
      'font-family': POLICE,
      'font-weight': GRAISSE,
      'text-anchor': 'middle',
    }, g);
    lignes.forEach((ligne, i) => {
      const ts = el('tspan', { x: arrondir(m.x), y: arrondir(haut + i * hauteurLigne) }, t);
      ts.textContent = ligne;
    });
  }
  if (badge && f.etape > 0) {
    const p = milieu(points, lignes.length ? 0.25 : 0.5);
    pastilleEtape(g, arrondir(p.x), arrondir(p.y), f.etape, theme);
  }
}

/**
 * Crée le moteur de rendu attaché au SVG de la page.
 * Renvoie { rendre(etat), tailleZone() }.
 */
export function creerRendu(svg) {
  const monde = svg.querySelector('#monde');
  const calqueZones = svg.querySelector('#calque-zones');
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

    // --- Zones (derrière tout le reste ; les grandes sous les petites) ---
    const zones = listeZones(schema);
    for (const z of zones) {
      presents.add(z.id);
      const n = noeudPour(z.id, 'zone', calqueZones);
      const badge = etat.reglages.pastilles;
      const signature = `${z.largeur}|${z.hauteur}|${z.couleur}|${z.titre}|${theme}|${badge}|${z.etape}`;
      if (signature !== n.signature) {
        dessinerZone(n.g, z, theme, { badge });
        n.signature = signature;
        n.g.setAttribute('aria-label', `Zone ${z.titre || 'sans titre'}`);
      }
      const position = `${z.x}|${z.y}`;
      if (position !== n.position) {
        n.g.setAttribute('transform', `translate(${arrondir(z.x)} ${arrondir(z.y)})`);
        n.position = position;
      }
    }

    // --- Blocs ---
    for (const b of blocs) {
      presents.add(b.id);
      const n = noeudPour(b.id, 'bloc', calqueBlocs);
      const enEdition = etat.editionId === b.id;
      const badge = etat.reglages.pastilles;
      const signature = `${b.largeur}|${b.hauteur}|${b.forme}|${b.couleur}|${b.taille}|${theme}|${enEdition}|${badge}|${b.etape}|${b.image}|${b.texte}`;
      if (signature !== n.signature) {
        dessinerBloc(n.g, b, theme, { masquerTexte: enEdition, badge, images: schema.images, fantome: true });
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
        f.style, f.trait, f.pointes, f.etiquette, theme, selectionnee, f.etape, etat.reglages.pastilles].join('|');
      if (signature !== n.signature) {
        dessinerFleche(n.g, f, A, B, theme, { selectionnee, badge: etat.reglages.pastilles });
        n.signature = signature;
      }
    }

    // --- Nettoyage des éléments supprimés ---
    for (const [id, n] of noeuds) {
      if (!presents.has(id)) { n.g.remove(); noeuds.delete(id); }
    }

    // Ordre des zones dans le DOM : celui de listeZones (les grandes d'abord).
    let precedenteZone = null;
    for (const z of zones) {
      const g = noeuds.get(z.id).g;
      if (g.previousSibling !== precedenteZone) calqueZones.insertBefore(g, precedenteZone ? precedenteZone.nextSibling : calqueZones.firstChild);
      precedenteZone = g;
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

    // Zone choisie : contour et poignée de taille (pas de liaison).
    if (sel && sel.type === 'zone') {
      const m = 5 / k;
      el('rect', {
        x: sel.x - m, y: sel.y - m, width: sel.largeur + 2 * m, height: sel.hauteur + 2 * m, rx: 18 + m,
        fill: 'none', stroke: T.selection, 'stroke-width': 2.5 / k, class: 'decor',
      }, calquePoignees);
      const coinX = sel.x + sel.largeur + m;
      const coinY = sel.y + sel.hauteur + m;
      el('rect', { x: coinX - 7 / k, y: coinY - 7 / k, width: 14 / k, height: 14 / k, rx: 3 / k, fill: T.selection, stroke: T.fond, 'stroke-width': 2 / k, class: 'decor' }, calquePoignees);
      el('circle', { cx: coinX, cy: coinY, r: 22 / k, fill: 'transparent', 'data-poignee': 'redim', class: 'poignee-redim' }, calquePoignees);
    }

    // Sélection multiple : un contour par bloc, sans poignées.
    if (etat.groupe) {
      const m = 5 / k;
      for (const gid of etat.groupe) {
        const b = parId.get(gid);
        if (!b) continue;
        el('rect', {
          x: b.x - m, y: b.y - m, width: b.largeur + 2 * m, height: b.hauteur + 2 * m, rx: 4 / k,
          fill: T.selection, 'fill-opacity': 0.08, stroke: T.selection, 'stroke-width': 2.5 / k, 'stroke-dasharray': `${6 / k} ${4 / k}`, class: 'decor',
        }, calquePoignees);
      }
    }

    // Rectangle de sélection en cours.
    if (etat.rectangle) {
      const r = etat.rectangle;
      el('rect', {
        x: Math.min(r.x1, r.x2), y: Math.min(r.y1, r.y2), width: Math.abs(r.x2 - r.x1), height: Math.abs(r.y2 - r.y1),
        fill: T.selection, 'fill-opacity': 0.1, stroke: T.selection, 'stroke-width': 1.5 / k, 'stroke-dasharray': `${5 / k} ${4 / k}`, class: 'decor',
      }, calquePoignees);
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
