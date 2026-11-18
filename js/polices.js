// =====================================================================
// Polices : attendre qu'elles soient prêtes, et les intégrer aux exports.
//
// - Le texte des blocs est MESURÉ pour le retour à la ligne : il faut
//   donc attendre que la police Oxanium soit chargée avant de dessiner,
//   sinon les coupures seraient calculées avec une autre police.
// - Une image SVG ou PNG, ou une page HTML exportée, n'a pas accès aux
//   fichiers de l'application : on y glisse la police elle-même (encodée
//   en texte « base64 »), pour un rendu identique sur tous les appareils.
// =====================================================================

import { FICHIERS_POLICES } from './config.js';

/** Attend le chargement des polices (au plus « delaiMax » millisecondes). */
export async function attendrePolices(delaiMax = 2500) {
  if (!document.fonts || !document.fonts.load) return;
  const chargements = [
    '500 16px "Oxanium"',
    '700 16px "Oxanium"',
    '400 16px "Literata"',
    '700 13px "JetBrains Mono"',
  ].map((police) => document.fonts.load(police).catch(() => {}));
  await Promise.race([Promise.all(chargements), new Promise((ok) => setTimeout(ok, delaiMax))]);
}

const memoire = new Map();

/** Lit un fichier de l'application et le renvoie encodé en base64. */
async function enBase64(url) {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`Police introuvable : ${url}`);
  const octets = new Uint8Array(await reponse.arrayBuffer());
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

/**
 * Règles CSS @font-face avec les polices intégrées (data:…).
 * « noms » : clés de FICHIERS_POLICES, par ex. ['oxanium', 'literata'].
 * En cas de problème, renvoie une chaîne vide : l'export reste possible,
 * avec la police de l'appareil.
 */
export async function cssPolicesIntegrees(noms = ['oxanium']) {
  const regles = [];
  for (const nom of noms) {
    const p = FICHIERS_POLICES[nom];
    if (!p) continue;
    try {
      if (!memoire.has(nom)) memoire.set(nom, await enBase64(p.fichier));
      regles.push(`@font-face{font-family:"${p.famille}";src:url(data:font/woff2;base64,${memoire.get(nom)}) format("woff2");font-weight:${p.graisse};font-style:${p.style}}`);
    } catch (erreur) {
      console.warn(erreur);
    }
  }
  return regles.join('\n');
}
