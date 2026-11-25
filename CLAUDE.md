# omni-schema — notes pour Claude

PWA de création et de présentation de schémas étape par étape, en **HTML, CSS et JavaScript natifs, sans dépendance ni étape de construction**. Application de l'**Omni-système**, réalisée par Ferrus Dantioch. L'utilisatrice ou l'utilisateur est novice en programmation : garder les commentaires en français simple et éviter le jargon.

## Identité, licence et contact (charte Omni-système)

- **Auteur** : Ferrus Dantioch
- **Licence** : Creative Commons Attribution - Pas d'Utilisation Commerciale - Pas de Modification 4.0 International (`CC BY-NC-ND 4.0`) — partage autorisé en citant l'auteur, sans usage commercial ni modification (les schémas créés appartiennent à la personne utilisatrice ; les polices embarquées sont sous `SIL Open Font License 1.1`, voir `polices/LICENCES.txt`).
- **Contact** : `omni-systeme.choking513@passmail.net`
- **Identité visuelle** : fond nuit `#14121e`, surfaces `#1e1928`, filets `#262435`, accent lavande/violet `#a777ff` avec texte sombre contrasté `#16052b` (assombri à `#6a3fd6` en thème clair), polices embarquées `Oxanium` (interface et blocs), `Literata` (lecture, notes, À propos), `JetBrains Mono` (chiffres).
- **Tutoiement** : toute l'interface, les explications et les messages tutoient la personne.

## Architecture des fichiers

- `index.html` : page unique (`<main class="zone">` avec un `<h1>` unique `.lecteur-seul`, barres haute/basse, dialogues modaux `<dialog>`, mode présentation, vue présentateur).
- `css/style.css` : trois thèmes (`violet`, `sombre`, `clair`), mise en page responsive (bureau et téléphone jusqu'à 320 px), note d'installation masquée hors `display-mode: browser`.
- `js/theme-init.js` : script classique exécuté avant le rendu pour appliquer thème et taille sans flash.
- `js/version.js` : **source unique du numéro de version** (`globalThis.OMNI_SCHEMA_VERSION`), compatible script classique (`importScripts` dans `sw.js`) et module ES (`import` dans `js/config.js`).
- `js/` : 34 modules ES applicatifs (`app.js`, `noyau.js`, `modele.js`, `rendu.js`, `interactions.js`, `interface.js`, `presentation.js`, `presentateur.js`, `pointeur.js`, `presse-papiers.js`, `mise-a-jour.js`, `stockage.js`, `export-html.js`, `exports.js`, `config.js`, etc.).
- `sw.js` et `manifest.webmanifest` : cache hors ligne (`omni-schema-<VERSION>`) et fiche PWA (`"id": "/omni-schema/"`).
- `polices/` et `icons/` et `assets/` : polices `.woff2` + `LICENCES.txt`, icônes SVG/PNG (dont `icon-maskable-192.png` et `apple-touch-icon.png` 180×180 opaques), logo WebP.

## Règles impératives à préserver

1. **Ne jamais modifier `LICENSE`** : le fichier `LICENSE` d'omni-schema (43 560 octets en LF, SHA-256 `bc83507d042d2a444ded4f3a9b0f0957a26c6dd8a00e77c56fcab26aeac6fa34`) contient intentionnellement l'en-tête bilingue (propriété des schémas + `polices/LICENCES.txt`) suivi du texte officiel CC BY-NC-ND 4.0.
2. **Source unique de version (`js/version.js`)** : pour publier une version, modifier uniquement `OMNI_SCHEMA_VERSION` dans `js/version.js` (et mettre à jour `FICHIERS` dans `sw.js` si un fichier est ajouté ou retiré). `sw.js` et `js/config.js` lisent automatiquement cette valeur.
3. **Service Worker et mise à jour douce** :
   - Pas de `skipWaiting()` dans `install` : la mise à jour attend le clic sur `#btn-maj` (`{ type: 'ACTIVER' }`).
   - Enregistrement avec `{ updateViaCache: 'none' }` dans `js/mise-a-jour.js`.
   - Sur `controllerchange`, masquer et réactiver `#btn-maj` dans tous les onglets, et ne recharger que l'onglet qui a demandé la mise à jour (`rechargementDemande`).
   - Dans `fetch` (`sw.js`) : vérifier `GET`, même origine **et** `url.href.startsWith(self.registration.scope)` ; chercher d'abord `cache.match(requete, { ignoreSearch: true })` (afin que `./polices/LICENCES.txt` et `./?public=...` soient servis directement depuis le cache sans être remplacés par `./index.html`) ; protéger `caches.open` par `try/catch` et `cache.put` par `.catch(() => {})` ; en cas d'échec réseau hors ligne, replier uniquement `requete.mode === 'navigate'` vers `./index.html`, sinon `503`.
4. **Accessibilité et cibles tactiles ≥ 44×44 px** :
   - Un seul `<h1>` dans le document (`index.html`).
   - Tous les contrôles interactifs visibles (y compris `#btn-titre` sur 320 px quand `#btn-maj` est affiché, les liens de `#dlg-apropos`, et les `<label>` de cases à cocher `.cases label` à ≥ 48 px) doivent mesurer au moins `44×44 px` sans débordement horizontal.
5. **Vibrations réglables** :
   - Option `vibrations` dans `omni-schema.reglages` (activée par défaut : `true`), modifiable dans `#dlg-reglages`.
   - Tout appel à `navigator.vibrate` (`js/interactions.js`, `js/pointeur.js`) doit vérifier `etat.reglages.vibrations !== false`.
6. **Sécurité CSP et robustesse `localStorage`** :
   - CSP dans `index.html` : `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; manifest-src 'self'; worker-src 'self'`.
   - Tout appel `localStorage.getItem` / `setItem` / `removeItem` doit être isolé dans un `try/catch`, sans jamais bloquer IndexedDB (`ouvrirPremierSchema` dans `js/app.js`) ni masquer un échec d'enregistrement (`enregistrerReglages` et `copierDepuisBouton` informent l'utilisateur).

## Tests et CI

- `npm run test:static` (`tests/static.test.mjs`) : contrôle `LICENSE`, version unique `js/version.js`, complétude de `sw.js` (`FICHIERS` et existence des fichiers), CSP, `localStorage` et `navigator.vibrate`, manifeste, en-têtes PNG et absence d'alpha sur les icônes maskable / Apple.
- `npm run test:e2e` (`tests/e2e.test.mjs`) : tests Playwright sous Chromium (zéro erreur console/CSP, hors ligne incluant `./polices/LICENCES.txt` et `./?public=...`, `controllerchange` multi-onglets, case « Vibrations », `<h1>` unique et cibles ≥ 44×44 px en `1280×800`, `390×844` et `320×640` avec `#btn-maj` visible, résilience `localStorage` bloqué/plein, création/persistance de schéma et présentation).
- `npm test` : exécute les deux suites.
- `.github/workflows/ci.yml` : exécute `npm run test:static` et `npm run test:e2e` sur `ubuntu-latest` (Node 22).
