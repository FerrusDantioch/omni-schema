// =====================================================================
// Mise en page du texte dans les blocs : retour à la ligne automatique,
// taille de police adaptée, et « … » si le texte ne tient vraiment pas.
// On mesure le texte avec un canevas invisible (rapide), avec la même
// police que celle du dessin SVG.
// =====================================================================

import { POLICE, GRAISSE } from './config.js';

export const INTERLIGNE = 1.25;   // hauteur d'une ligne = taille × 1,25
export const TAILLE_MAX = 18;     // taille de départ
export const TAILLE_MIN = 11;     // en dessous, on coupe avec « … »

const contexte = document.createElement('canvas').getContext('2d');
const cache = new Map();

function choisirTaille(taille, graisse = GRAISSE) {
  contexte.font = `${graisse} ${taille}px ${POLICE}`;
}
const largeur = (t) => contexte.measureText(t).width;

/** Coupe un mot trop long pour la ligne en morceaux qui tiennent. */
function couperMot(mot, largeurMax) {
  const morceaux = [];
  let caracteres = Array.from(mot); // Array.from respecte les émojis
  while (caracteres.length > 1 && largeur(caracteres.join('')) > largeurMax) {
    let n = caracteres.length - 1;
    while (n > 1 && largeur(caracteres.slice(0, n).join('')) > largeurMax) n--;
    morceaux.push(caracteres.slice(0, n).join(''));
    caracteres = caracteres.slice(n);
  }
  morceaux.push(caracteres.join(''));
  return morceaux;
}

/**
 * Sépare un paragraphe en « mots » pour le retour à la ligne, en
 * respectant la typographie française : « ? ! : ; » restent collés au
 * mot voisin, et les espaces insécables ne sont jamais coupées.
 */
function motsInsecables(paragraphe) {
  // On coupe seulement sur les espaces ordinaires (pas les insécables \u00a0 et \u202f).
  const bruts = paragraphe.split(/[ \t\r]+/).filter(Boolean);
  const mots = [];
  for (const mot of bruts) {
    const precedent = mots[mots.length - 1];
    if (precedent !== undefined && (/^[?!:;»]/.test(mot) || /«$/.test(precedent))) {
      mots[mots.length - 1] = `${precedent}\u00a0${mot}`;
    } else {
      mots.push(mot);
    }
  }
  return mots;
}

/** Découpe le texte en lignes qui tiennent dans largeurMax. */
function decouper(texte, largeurMax) {
  const lignes = [];
  for (const paragraphe of texte.split('\n')) {
    const mots = motsInsecables(paragraphe);
    if (!mots.length) { lignes.push(''); continue; }
    let ligne = '';
    for (const mot of mots) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (largeur(essai) <= largeurMax) { ligne = essai; continue; }
      if (ligne) lignes.push(ligne);
      const morceaux = largeur(mot) > largeurMax ? couperMot(mot, largeurMax) : [mot];
      lignes.push(...morceaux.slice(0, -1));
      ligne = morceaux[morceaux.length - 1];
    }
    lignes.push(ligne);
  }
  return lignes;
}

/** Oublie les mises en page mémorisées (à faire quand une police vient d'arriver). */
export function viderCacheTexte() {
  cache.clear();
}

/**
 * Renvoie { lignes, taille, tronque } : la plus grande taille (entre
 * « max » et « min », par défaut 18 et 11) pour laquelle le texte tient
 * dans la zone donnée.
 */
export function mettreEnPage(texteBrut, largeurMax, hauteurMax, { max = TAILLE_MAX, min = TAILLE_MIN } = {}) {
  const texte = String(texteBrut || '').replace(/\s+$/, '');
  const cle = `${Math.round(largeurMax)}|${Math.round(hauteurMax)}|${max}|${min}|${texte}`;
  const memorise = cache.get(cle);
  if (memorise) return memorise;

  let resultat = null;
  if (!texte) resultat = { lignes: [], taille: max, tronque: false };

  for (let taille = max; !resultat && taille >= min; taille--) {
    choisirTaille(taille);
    const lignes = decouper(texte, largeurMax);
    if (lignes.length * taille * INTERLIGNE <= hauteurMax) resultat = { lignes, taille, tronque: false };
  }

  if (!resultat) {
    // Même en petit, ça ne tient pas : on garde ce qui rentre et on ajoute « … ».
    choisirTaille(min);
    const nbLignes = Math.max(1, Math.floor(hauteurMax / (min * INTERLIGNE)));
    const lignes = decouper(texte, largeurMax).slice(0, nbLignes);
    let derniere = lignes[nbLignes - 1] || '';
    while (derniere && largeur(`${derniere}…`) > largeurMax) derniere = Array.from(derniere).slice(0, -1).join('');
    lignes[nbLignes - 1] = `${derniere.trimEnd()}…`;
    resultat = { lignes, taille: min, tronque: true };
  }

  if (cache.size > 800) cache.clear(); // évite que la mémoire grossisse sans fin
  cache.set(cle, resultat);
  return resultat;
}

// ---------------------------------------------------------------------
// Étiquettes des flèches : taille fixe, retour à la ligne au-delà d'une
// largeur raisonnable, et « … » au-delà de 3 lignes.
// ---------------------------------------------------------------------
export const TAILLE_ETIQUETTE = 14;
export const LARGEUR_ETIQUETTE = 200;
const LIGNES_ETIQUETTE = 3;

/**
 * Renvoie les lignes à afficher pour une étiquette de flèche.
 * « largeurMax » : place disponible (plus étroite sur une flèche courte
 * et horizontale, pour que l'étiquette ne passe pas sous les blocs).
 */
export function lignesEtiquette(texteBrut, largeurMax = LARGEUR_ETIQUETTE) {
  const texte = String(texteBrut || '').trim();
  if (!texte) return [];
  const cle = `etiquette|${Math.round(largeurMax)}|${texte}`;
  const memorise = cache.get(cle);
  if (memorise) return memorise;
  choisirTaille(TAILLE_ETIQUETTE);
  let lignes = decouper(texte, largeurMax);
  if (lignes.length > LIGNES_ETIQUETTE) {
    lignes = lignes.slice(0, LIGNES_ETIQUETTE);
    let derniere = lignes[LIGNES_ETIQUETTE - 1];
    while (derniere && largeur(`${derniere}…`) > largeurMax) derniere = Array.from(derniere).slice(0, -1).join('');
    lignes[LIGNES_ETIQUETTE - 1] = `${derniere.trimEnd()}…`;
  }
  if (cache.size > 800) cache.clear();
  cache.set(cle, lignes);
  return lignes;
}

/** Texte sur une seule ligne, coupé par « … » s'il dépasse (titre d'une zone). */
export function ligneCoupee(texteBrut, largeurMax, taille, graisse = GRAISSE) {
  let texte = String(texteBrut || '').replace(/\s+/g, ' ').trim();
  if (!texte) return '';
  choisirTaille(taille, graisse);
  if (largeur(texte) <= largeurMax) return texte;
  while (texte && largeur(`${texte}…`) > largeurMax) texte = Array.from(texte).slice(0, -1).join('');
  return texte ? `${texte.trimEnd()}…` : '';
}
