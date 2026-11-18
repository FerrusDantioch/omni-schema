// =====================================================================
// Calculs géométriques : centre d'un bloc, point d'accroche d'une flèche
// sur le bord d'une forme, tracé des flèches, alignement et grille.
// Aucune dépendance au dessin : ces fonctions ne font que des calculs.
// =====================================================================

import { GRILLE } from './config.js';

export const centre = (b) => ({ x: b.x + b.largeur / 2, y: b.y + b.hauteur / 2 });

/**
 * Zone réservée au texte à l'intérieur d'un bloc. Pour un ovale ou un
 * losange, la place utile est plus petite que le rectangle englobant.
 */
export function zoneTexte(b) {
  const proportions = {
    rectangle: [1, 1, 10],
    arrondi: [1, 1, 12],
    ovale: [0.72, 0.72, 4],
    losange: [0.52, 0.52, 2],
  }[b.forme] || [1, 1, 10];
  const largeur = Math.max(10, b.largeur * proportions[0] - 2 * proportions[2]);
  const hauteur = Math.max(10, b.hauteur * proportions[1] - 2 * proportions[2]);
  return {
    x: b.x + (b.largeur - largeur) / 2,
    y: b.y + (b.hauteur - hauteur) / 2,
    largeur,
    hauteur,
  };
}

/**
 * Point où la droite partant du centre du bloc vers « cible » croise le
 * bord de la forme (rectangle, ovale ou losange).
 */
export function pointBord(b, cible) {
  const c = centre(b);
  const dx = cible.x - c.x;
  const dy = cible.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const a = b.largeur / 2;
  const h = b.hauteur / 2;
  let t;
  if (b.forme === 'ovale') t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (h * h));
  else if (b.forme === 'losange') t = 1 / (Math.abs(dx) / a + Math.abs(dy) / h);
  else t = Math.min(dx ? a / Math.abs(dx) : Infinity, dy ? h / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/** Retire les points en double et les points alignés inutiles. */
function simplifier(points) {
  const res = [];
  for (const p of points) {
    const d = res[res.length - 1];
    if (d && Math.abs(d.x - p.x) < 0.5 && Math.abs(d.y - p.y) < 0.5) continue;
    res.push(p);
  }
  // Retire un point situé au milieu d'un segment droit.
  for (let i = res.length - 2; i > 0; i--) {
    const a = res[i - 1], b = res[i], c = res[i + 1];
    const alignes = (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5)
      || (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5);
    if (alignes) res.splice(i, 1);
  }
  return res;
}

/**
 * Liste des points du trajet d'une flèche entre deux blocs.
 * - « droite » : segment entre les deux bords, dans l'axe des centres ;
 * - « angle »  : trajet en équerre (horizontal / vertical / horizontal,
 *   ou l'inverse), sans contournement des obstacles.
 */
export function traceFleche(fleche, A, B) {
  const ca = centre(A);
  const cb = centre(B);
  if (fleche.style !== 'angle') {
    return simplifier([pointBord(A, cb), pointBord(B, ca)]);
  }
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Sortie par le côté gauche ou droit.
    const s = Math.sign(dx) || 1;
    const p1 = { x: ca.x + (s * A.largeur) / 2, y: ca.y };
    const p2 = { x: cb.x - (s * B.largeur) / 2, y: cb.y };
    const mx = (p1.x + p2.x) / 2;
    return simplifier([p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2]);
  }
  // Sortie par le haut ou le bas.
  const s = Math.sign(dy) || 1;
  const p1 = { x: ca.x, y: ca.y + (s * A.hauteur) / 2 };
  const p2 = { x: cb.x, y: cb.y - (s * B.hauteur) / 2 };
  const my = (p1.y + p2.y) / 2;
  return simplifier([p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2]);
}

/** Point situé à une fraction de la longueur d'une ligne brisée (0,5 = milieu, pour l'étiquette). */
export function milieu(points, fraction = 0.5) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  let reste = total * fraction;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l >= reste && l > 0) return { x: a.x + ((b.x - a.x) * reste) / l, y: a.y + ((b.y - a.y) * reste) / l };
    reste -= l;
  }
  return points[0] || { x: 0, y: 0 };
}

/**
 * Pointe de flèche : renvoie les 3 sommets du triangle et le trajet
 * raccourci (pour que le trait ne dépasse pas de la pointe).
 */
export function pointe(points, taille = 12) {
  const n = points.length;
  const fin = points[n - 1];
  const avant = points[n - 2] || fin;
  const l = Math.hypot(fin.x - avant.x, fin.y - avant.y) || 1;
  const ux = (fin.x - avant.x) / l;
  const uy = (fin.y - avant.y) / l;
  const base = { x: fin.x - ux * taille, y: fin.y - uy * taille };
  const demi = taille * 0.5;
  const triangle = [fin, { x: base.x - uy * demi, y: base.y + ux * demi }, { x: base.x + uy * demi, y: base.y - ux * demi }];
  const recul = Math.min(taille * 0.8, l);
  const trajet = points.slice(0, -1).concat([{ x: fin.x - ux * recul, y: fin.y - uy * recul }]);
  return { triangle, trajet };
}

/** Arrondit une valeur au multiple de la grille le plus proche. */
export const surGrille = (v) => Math.round(v / GRILLE) * GRILLE;

/**
 * Aimantation pendant le déplacement d'un bloc :
 * 1) les guides d'alignement (bords et centres des autres blocs) ;
 * 2) sinon, la grille si elle est active.
 * Renvoie la position corrigée et les guides à afficher.
 */
export function aimanter(bloc, x, y, autres, { grille, guides, tolerance }) {
  let meilleurX = null;
  let meilleurY = null;
  if (guides) {
    const decalagesX = [0, bloc.largeur / 2, bloc.largeur];
    const decalagesY = [0, bloc.hauteur / 2, bloc.hauteur];
    for (const o of autres) {
      const lignesX = [o.x, o.x + o.largeur / 2, o.x + o.largeur];
      const lignesY = [o.y, o.y + o.hauteur / 2, o.y + o.hauteur];
      for (const d of decalagesX) {
        for (const v of lignesX) {
          const ecart = Math.abs(x + d - v);
          if (ecart <= tolerance && (!meilleurX || ecart < meilleurX.ecart)) meilleurX = { ecart, valeur: v - d, ligne: v };
        }
      }
      for (const d of decalagesY) {
        for (const v of lignesY) {
          const ecart = Math.abs(y + d - v);
          if (ecart <= tolerance && (!meilleurY || ecart < meilleurY.ecart)) meilleurY = { ecart, valeur: v - d, ligne: v };
        }
      }
    }
  }
  const lignes = [];
  if (meilleurX) { x = meilleurX.valeur; lignes.push({ axe: 'x', valeur: meilleurX.ligne }); }
  else if (grille) x = surGrille(x);
  if (meilleurY) { y = meilleurY.valeur; lignes.push({ axe: 'y', valeur: meilleurY.ligne }); }
  else if (grille) y = surGrille(y);
  return { x, y, guides: lignes };
}

/** Rectangle englobant tous les blocs (ou null si aucun). */
export function englobant(blocs) {
  if (!blocs.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of blocs) {
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.largeur);
    y2 = Math.max(y2, b.y + b.hauteur);
  }
  return { x: x1, y: y1, largeur: x2 - x1, hauteur: y2 - y1 };
}
