// =====================================================================
// Service worker d'omni-schema : garde l'application sur l'appareil
// pour qu'elle fonctionne hors ligne.
//
// ⚠ À CHAQUE PUBLICATION : change OMNI_SCHEMA_VERSION dans
// js/version.js (source unique partagée avec js/config.js).
// Le navigateur voit alors que la version a changé, télécharge la
// nouvelle version, et le bouton « Mettre à jour » apparaît dans
// l'application.
// =====================================================================

importScripts('./js/version.js');
const VERSION = globalThis.OMNI_SCHEMA_VERSION;
const CACHE = `omni-schema-${VERSION}`;

// Tous les fichiers de l'application (chemins relatifs : fonctionne dans
// un sous-dossier comme /omni-schema/ sur GitHub Pages).
const FICHIERS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/clavier.js',
  './js/config.js',
  './js/couleurs.js',
  './js/editeur-texte.js',
  './js/etapes.js',
  './js/export-html.js',
  './js/exports.js',
  './js/feutre.js',
  './js/fichiers.js',
  './js/images.js',
  './js/geometrie.js',
  './js/historique.js',
  './js/interactions.js',
  './js/interface.js',
  './js/liste.js',
  './js/mise-a-jour.js',
  './js/modele.js',
  './js/modeles.js',
  './js/noyau.js',
  './js/panneau-etapes.js',
  './js/pictogrammes.js',
  './js/pointeur.js',
  './js/polices.js',
  './js/presentateur.js',
  './js/presentation.js',
  './js/presse-papiers.js',
  './js/ranger.js',
  './js/recherche.js',
  './js/rendu.js',
  './js/schema-svg.js',
  './js/stockage.js',
  './js/texte.js',
  './js/theme-init.js',
  './js/version.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './assets/logo-omni-systeme.webp',
  './polices/oxanium.woff2',
  './polices/literata.woff2',
  './polices/literata-italique.woff2',
  './polices/jetbrains-mono.woff2',
  './polices/LICENCES.txt',
];

// Installation : on télécharge tout. « cache: 'reload' » évite de
// récupérer d'anciennes copies gardées par le navigateur.
self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS.map((url) => new Request(url, { cache: 'reload' })))),
  );
  // Pas de skipWaiting() ici : la nouvelle version attend que tu
  // appuies sur « Mettre à jour ».
});

// L'application demande l'activation (bouton « Mettre à jour »).
self.addEventListener('message', (evenement) => {
  if (evenement.data && evenement.data.type === 'ACTIVER') self.skipWaiting();
});

// Activation : on supprime les anciennes versions du cache.
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n.startsWith('omni-schema-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Requêtes : d'abord la copie locale (rapide, hors ligne), sinon le réseau.
self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return; // rien d'extérieur
  if (!url.href.startsWith(self.registration.scope)) return; // hors périmètre

  evenement.respondWith((async () => {
    let cache = null;
    try {
      cache = await caches.open(CACHE);
    } catch { /* stockage indisponible */ }
    // On cherche d'abord la ressource exacte en cache (ex. polices/LICENCES.txt)
    // avant tout repli vers index.html.
    if (cache) {
      const enCache = await cache.match(requete, { ignoreSearch: true });
      if (enCache) return enCache;
    }
    try {
      const reponse = await fetch(requete);
      if (cache && reponse && reponse.ok && reponse.type === 'basic') {
        cache.put(requete, reponse.clone()).catch(() => {});
      }
      return reponse;
    } catch {
      if (cache && requete.mode === 'navigate') {
        const page = await cache.match('./index.html');
        if (page) return page;
      }
      return new Response('Hors ligne', { status: 503, statusText: 'Hors ligne' });
    }
  })());
});
