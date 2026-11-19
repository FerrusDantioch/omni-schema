// =====================================================================
// Fabrique un SVG AUTONOME du schéma : couleurs écrites en dur, fond
// compris, cadré sur l'ensemble des blocs. Il sert :
// - à la présentation (on y montre/cache les éléments étape par étape),
// - aux exports PNG, SVG et PDF,
// - (au jalon 3) au lecteur HTML autonome.
// =====================================================================

import { couleursToile } from './couleurs.js';
import { POLICE } from './config.js';
import { listeBlocs, listeFleches, listeZones, listeCadres } from './modele.js';
import { englobant, traceFleche } from './geometrie.js';
import { etapesEffectives } from './etapes.js';
import { el, dessinerBloc, dessinerFleche, dessinerZone } from './rendu.js';

const NS = 'http://www.w3.org/2000/svg';
const MARGE = 48;

/**
 * Construit le SVG complet (tous les éléments, toutes les étapes).
 * Renvoie { svg, elements, calqueSurlignage, theme } ; « elements » liste
 * chaque élément avec son groupe SVG et son étape effective.
 */
export function construireSvg(schema, theme, { css = '' } = {}) {
  const T = couleursToile(theme);
  const blocs = listeBlocs(schema);
  const parId = new Map(blocs.map((b) => [b.id, b]));
  const effectives = etapesEffectives(schema);
  const boite = englobant(listeCadres(schema)) || { x: 0, y: 0, largeur: 320, hauteur: 200 };
  const vb = {
    x: Math.floor(boite.x - MARGE),
    y: Math.floor(boite.y - MARGE),
    largeur: Math.ceil(boite.largeur + 2 * MARGE),
    hauteur: Math.ceil(boite.hauteur + 2 * MARGE),
  };

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.largeur} ${vb.hauteur}`);
  svg.setAttribute('width', vb.largeur);
  svg.setAttribute('height', vb.hauteur);
  svg.setAttribute('font-family', POLICE);
  svg.setAttribute('role', 'img');
  const titre = el('title', {}, svg);
  titre.textContent = schema.titre;
  // Polices intégrées (exports) : le dessin s'affiche pareil partout.
  if (css) el('style', {}, svg).textContent = css;

  el('rect', { x: vb.x, y: vb.y, width: vb.largeur, height: vb.hauteur, fill: T.fond, class: 'fond-schema' }, svg);
  const calqueZones = el('g', {}, svg);
  const calqueSurlignage = el('g', { class: 'surlignage' }, svg);
  const calqueFleches = el('g', {}, svg);
  const calqueBlocs = el('g', {}, svg);

  const elements = [];
  for (const z of listeZones(schema)) {
    const g = el('g', { 'data-id': z.id, 'data-etape': effectives.get(z.id), transform: `translate(${z.x} ${z.y})` }, calqueZones);
    dessinerZone(g, z, theme, { interactive: false });
    elements.push({ id: z.id, type: 'zone', donnees: z, g, etape: effectives.get(z.id) });
  }
  for (const f of listeFleches(schema)) {
    const A = parId.get(f.de);
    const B = parId.get(f.vers);
    if (!A || !B) continue;
    const g = el('g', { 'data-id': f.id, 'data-etape': effectives.get(f.id) }, calqueFleches);
    dessinerFleche(g, f, A, B, theme, { zoneClic: false });
    elements.push({ id: f.id, type: 'fleche', donnees: f, A, B, g, etape: effectives.get(f.id) });
  }
  for (const b of blocs) {
    const g = el('g', { 'data-id': b.id, 'data-etape': effectives.get(b.id), transform: `translate(${b.x} ${b.y})` }, calqueBlocs);
    dessinerBloc(g, b, theme, { images: schema.images });
    elements.push({ id: b.id, type: 'bloc', donnees: b, g, etape: effectives.get(b.id) });
  }
  return { svg, elements, calqueSurlignage, theme, cadre: vb };
}

/** Contour doux autour d'un bloc (même forme, un peu plus grand). */
function contourBloc(parent, b, couleur) {
  const d = 8; // écart entre le bloc et le contour
  const style = { fill: 'none', stroke: couleur, 'stroke-width': 4, 'stroke-opacity': 0.9, 'stroke-linejoin': 'round' };
  const x = b.x - d, y = b.y - d, w = b.largeur + 2 * d, h = b.hauteur + 2 * d;
  switch (b.forme) {
    case 'ovale':
      return el('ellipse', { cx: b.x + b.largeur / 2, cy: b.y + b.hauteur / 2, rx: w / 2, ry: h / 2, ...style }, parent);
    case 'losange': {
      // Losange agrandi : on écarte chaque sommet d'environ d × 1,5.
      const cx = b.x + b.largeur / 2, cy = b.y + b.hauteur / 2;
      const a = b.largeur / 2 + d * 1.5, c = b.hauteur / 2 + d * 1.5;
      return el('polygon', { points: `${cx},${cy - c} ${cx + a},${cy} ${cx},${cy + c} ${cx - a},${cy}`, ...style }, parent);
    }
    case 'rectangle':
      return el('rect', { x, y, width: w, height: h, rx: 4, ...style }, parent);
    case 'zone':
      return el('rect', { x, y, width: w, height: h, rx: 18 + d, ...style }, parent);
    default:
      return el('rect', { x, y, width: w, height: h, rx: Math.min(14, b.hauteur / 3) + d, ...style }, parent);
  }
}

/** Halo doux sous une flèche. */
function haloFleche(parent, item, couleur) {
  const points = traceFleche(item.donnees, item.A, item.B);
  const r = (v) => Math.round(v * 10) / 10;
  const d = `M${points.map((p) => `${r(p.x)} ${r(p.y)}`).join(' L')}`;
  return el('path', { d, fill: 'none', stroke: couleur, 'stroke-width': 12, 'stroke-opacity': 0.35, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
}

/** Dessine le surlignage doux d'un élément (contour d'un bloc, halo d'une flèche). */
export function dessinerSurlignage(parent, item, couleur) {
  if (item.type === 'fleche') return haloFleche(parent, item, couleur);
  // Bloc ou zone : contour doux (une zone a des coins bien arrondis).
  return contourBloc(parent, item.type === 'zone' ? { ...item.donnees, forme: 'zone' } : item.donnees, couleur);
}

/**
 * Affiche l'état du schéma à un « arrêt » de la présentation :
 * - les éléments dont l'étape est ≤ arrêt sont visibles, les autres cachés ;
 * - si « surligner », les éléments qui apparaissent à cet arrêt reçoivent
 *   un contour doux.
 * Renvoie la liste des groupes qui viennent d'apparaître (pour le fondu).
 */
export function appliquerArret(rendu, arret, { surligner = true, precedent = null } = {}) {
  const T = couleursToile(rendu.theme);
  rendu.calqueSurlignage.replaceChildren();
  const nouveaux = [];
  for (const item of rendu.elements) {
    const visible = item.etape <= arret;
    item.g.style.display = visible ? '' : 'none';
    if (visible && precedent !== null && item.etape > precedent) nouveaux.push(item.g);
    if (surligner && arret > 0 && item.etape === arret) dessinerSurlignage(rendu.calqueSurlignage, item, T.selection);
  }
  return nouveaux;
}

/** Version texte d'un SVG (pour l'enregistrer en fichier .svg). */
export function svgEnTexte(svg) {
  const copie = svg.cloneNode(true);
  // Retire les éléments cachés : le fichier ne contient que ce qui se voit.
  for (const g of copie.querySelectorAll('[style*="display: none"]')) g.remove();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copie)}`;
}
