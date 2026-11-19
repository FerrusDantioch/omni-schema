// =====================================================================
// Service worker d'omni-schema : garde l'application sur l'appareil
// pour qu'elle fonctionne hors ligne.
//
// ⚠ À CHAQUE PUBLICATION : change VERSION (et APP_VERSION dans
// js/config.js). Le navigateur voit alors que ce fichier a changé,
// télécharge la nouvelle version, et le bouton « Mettre à jour »
// apparaît dans l'application.
// =====================================================================

const VERSION = '1.3.0';
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
  './js/fichiers.js',
  './js/images.js',
  './js/geometrie.js',
  './js/historique.js',
  './js/interactions.js',
  './js/interface.js',
  './js/mise-a-jour.js',
  './js/modele.js',
  './js/modeles.js',
  './js/noyau.js',
  './js/panneau-etapes.js',
  './js/polices.js',
  './js/presentateur.js',
  './js/presentation.js',
  './js/presse-papiers.js',
  './js/rendu.js',
  './js/schema-svg.js',
  './js/stockage.js',
  './js/texte.js',
  './js/theme-init.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './assets/logo-omni-systeme.webp',
  './polices/oxanium.woff2',
  './polices/literata.woff2',
  './polices/literata-italique.woff2',
  './polices/jetbrains-mono.woff2',
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

  evenement.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Navigation (ouverture de l'app) : toujours la page principale en cache.
    if (requete.mode === 'navigate') {
      const page = await cache.match('./index.html');
      if (page) return page;
    }
    const enCache = await cache.match(requete, { ignoreSearch: true });
    if (enCache) return enCache;
    try {
      return await fetch(requete);
    } catch {
      return new Response('Hors ligne', { status: 503, statusText: 'Hors ligne' });
    }
  })());
});
