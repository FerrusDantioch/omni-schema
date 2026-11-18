// =====================================================================
// Images des blocs : lecture d'une photo ou d'une image choisie sur
// l'appareil, réduction et compression, puis conversion en texte
// (« data: ») pour la ranger dans le schéma. Rien n'est envoyé.
//
// Pourquoi réduire ? Une photo de téléphone pèse souvent 3 à 8 Mo ; dans
// un schéma, 1200 pixels de large suffisent largement. Résultat :
// environ 100 à 250 Ko par image, et un schéma qui reste rapide.
// =====================================================================

const COTE_MAX = 1200;      // plus grand côté, en pixels
const QUALITE = 0.82;       // compression (0 à 1)

/** Lit un fichier image et renvoie une adresse « data:image/… » compressée. */
export async function preparerImage(fichier) {
  if (!fichier || !/^image\//.test(fichier.type)) throw new Error('Ce fichier n\'est pas une image.');
  if (fichier.size > 40 * 1024 * 1024) throw new Error('Cette image est trop lourde (plus de 40 Mo).');

  let source;
  try {
    // createImageBitmap respecte l'orientation des photos (portrait / paysage).
    source = await createImageBitmap(fichier);
  } catch {
    throw new Error('Impossible de lire cette image : son format n\'est pas reconnu par ce navigateur (essaie un JPEG ou un PNG).');
  }

  const echelle = Math.min(1, COTE_MAX / Math.max(source.width, source.height));
  const largeur = Math.max(1, Math.round(source.width * echelle));
  const hauteur = Math.max(1, Math.round(source.height * echelle));
  const canevas = document.createElement('canvas');
  canevas.width = largeur;
  canevas.height = hauteur;
  canevas.getContext('2d').drawImage(source, 0, 0, largeur, hauteur);
  if (source.close) source.close();

  // WebP (léger, garde la transparence) ; sinon PNG si le navigateur ne sait pas.
  let blob = await new Promise((ok) => canevas.toBlob(ok, 'image/webp', QUALITE));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((ok) => canevas.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('Impossible de préparer cette image.');

  return new Promise((ok, echec) => {
    const lecteur = new FileReader();
    lecteur.onload = () => ok(lecteur.result);
    lecteur.onerror = () => echec(new Error('Impossible de lire cette image.'));
    lecteur.readAsDataURL(blob);
  });
}
