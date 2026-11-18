// =====================================================================
// Exports en image et en PDF. Tout est fabriqué dans la page : rien
// n'est envoyé nulle part.
// - SVG : le dessin vectoriel (net à toutes les tailles).
// - PNG : le même dessin transformé en image (2 × la taille, pour la netteté).
// - PDF : une page par étape, via l'impression du navigateur
//   (« Enregistrer en PDF ») et une feuille de style dédiée.
// =====================================================================

import { construireSvg, appliquerArret, svgEnTexte } from './schema-svg.js';
import { arrets } from './etapes.js';
import { listeBlocs, trouver } from './modele.js';
import { couleursToile } from './couleurs.js';
import { telecharger, nomFichier } from './fichiers.js';

const verifier = (schema) => {
  if (!listeBlocs(schema).length) throw new Error('Ce schéma est vide : ajoute au moins un bloc.');
};

export function exporterSvg(schema, theme) {
  verifier(schema);
  const { svg } = construireSvg(schema, theme);
  telecharger(nomFichier(schema.titre, 'svg'), svgEnTexte(svg), 'image/svg+xml');
}

export async function exporterPng(schema, theme) {
  verifier(schema);
  const { svg, cadre } = construireSvg(schema, theme);
  const url = URL.createObjectURL(new Blob([svgEnTexte(svg)], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'sync';
    await new Promise((ok, echec) => {
      image.onload = ok;
      image.onerror = () => echec(new Error('Impossible de préparer l\'image.'));
      image.src = url;
    });
    // 2 × la taille pour un rendu net, sans dépasser ce que les téléphones acceptent.
    const echelle = Math.min(2, 8000 / cadre.largeur, 8000 / cadre.hauteur, Math.sqrt(32e6 / (cadre.largeur * cadre.hauteur)));
    const canevas = document.createElement('canvas');
    canevas.width = Math.round(cadre.largeur * echelle);
    canevas.height = Math.round(cadre.hauteur * echelle);
    canevas.getContext('2d').drawImage(image, 0, 0, canevas.width, canevas.height);
    const blob = await new Promise((ok) => canevas.toBlob(ok, 'image/png'));
    if (!blob) throw new Error('Impossible de créer l\'image PNG (schéma trop grand ?).');
    telecharger(nomFichier(schema.titre, 'png'), blob, 'image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Prépare une page imprimable par étape, puis ouvre l'impression du
 * navigateur. Chaque page montre le schéma tel qu'il est à cette étape,
 * avec la nouveauté surlignée (option) et les notes (option).
 */
export function imprimerEtapes(schema, theme, { surligner = true, notes = false } = {}) {
  verifier(schema);
  const zone = document.getElementById('impression');
  zone.replaceChildren();
  const T = couleursToile(theme);
  const liste = arrets(schema);

  liste.forEach((arret, i) => {
    const page = document.createElement('section');
    page.className = 'page-impression';
    page.style.background = T.fond;
    page.style.color = T.trait;

    const entete = document.createElement('p');
    entete.className = 'entete-impression';
    entete.textContent = liste.length > 1 ? `${schema.titre} — étape ${i + 1} / ${liste.length}` : schema.titre;
    page.appendChild(entete);

    const rendu = construireSvg(schema, theme);
    appliquerArret(rendu, arret, { surligner });
    rendu.svg.setAttribute('width', '100%');
    rendu.svg.setAttribute('height', '100%');
    rendu.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const cadre = document.createElement('div');
    cadre.className = 'dessin-impression';
    cadre.appendChild(rendu.svg);
    page.appendChild(cadre);

    if (notes) {
      const lignes = rendu.elements
        .filter((e) => e.type === 'bloc' && e.etape === arret && e.donnees.note.trim())
        .map((e) => e.donnees);
      if (lignes.length) {
        const bloc = document.createElement('div');
        bloc.className = 'notes-impression';
        for (const b of lignes) {
          const p = document.createElement('p');
          const nom = document.createElement('strong');
          nom.textContent = `${(trouver(schema, b.id).texte || 'Bloc').replace(/\s+/g, ' ').slice(0, 60)} : `;
          p.append(nom, document.createTextNode(b.note));
          bloc.appendChild(p);
        }
        page.appendChild(bloc);
      }
    }
    zone.appendChild(page);
  });

  const nettoyer = () => { zone.replaceChildren(); window.removeEventListener('afterprint', nettoyer); };
  window.addEventListener('afterprint', nettoyer);
  // Laisse le temps au navigateur de mettre les pages en forme avant d'imprimer.
  requestAnimationFrame(() => setTimeout(() => window.print(), 50));
  return liste.length;
}
