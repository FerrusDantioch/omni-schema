import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function listerFichiers(dirRel) {
  const dir = path.join(ROOT, dirRel);
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => `./${dirRel}/${d.name}`);
}

function parsePngInfo(filePath) {
  const buf = fs.readFileSync(filePath);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buf.subarray(0, 8).equals(sig), `${filePath} n'est pas un PNG valide`);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let hasTrns = false;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data.readUInt8(9);
    } else if (type === 'tRNS') {
      hasTrns = true;
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  const hasAlphaChannel = colorType === 4 || colorType === 6 || hasTrns;
  return { width, height, colorType, hasAlphaChannel };
}

function extraireBlocTryCatch(contenu, index) {
  // Vérifie qu'un appel donné se trouve bien dans un bloc try { ... } catch.
  let profondeur = 0;
  for (let i = index; i >= 0; i--) {
    const ch = contenu[i];
    if (ch === '}') profondeur++;
    else if (ch === '{') {
      if (profondeur === 0) {
        const avant = contenu.slice(Math.max(0, i - 30), i);
        if (/\btry\s*$/.test(avant)) return true;
        // Sinon on remonte au bloc englobant
      } else {
        profondeur--;
      }
    }
  }
  return false;
}

test('R2 — LICENSE intact (taille LF et SHA-256)', () => {
  const raw = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
  const data = Buffer.from(raw.replace(/\r\n/g, '\n'), 'utf8');
  assert.equal(data.length, 43560);
  const sha = crypto.createHash('sha256').update(data).digest('hex');
  assert.equal(sha, 'bc83507d042d2a444ded4f3a9b0f0957a26c6dd8a00e77c56fcab26aeac6fa34');
});

test('Version unique (js/version.js) partagée entre sw.js, js/config.js et package.json', async () => {
  const versionJs = lire('js/version.js');
  const m = versionJs.match(/globalThis\.OMNI_SCHEMA_VERSION\s*=\s*'([^']+)'/);
  assert.ok(m, 'OMNI_SCHEMA_VERSION manquante dans js/version.js');
  const version = m[1];
  assert.equal(version, '1.7.2');

  const configModule = await import(pathToFileURL(path.join(ROOT, 'js/config.js')).href);
  assert.equal(configModule.APP_VERSION, version);

  const pkg = JSON.parse(lire('package.json'));
  assert.equal(pkg.version, version);

  const sw = lire('sw.js');
  assert.ok(sw.includes("importScripts('./js/version.js')"), 'sw.js doit charger js/version.js via importScripts');
  assert.ok(sw.includes('globalThis.OMNI_SCHEMA_VERSION'), 'sw.js doit lire globalThis.OMNI_SCHEMA_VERSION');
  assert.equal(/const\s+VERSION\s*=\s*['"]/.test(sw), false, 'sw.js ne doit plus dupliquer la version en dur');
});

test('Service Worker — FICHIERS complet, garde de périmètre, cache avant navigate fallback', () => {
  const sw = lire('sw.js');
  const fichiersMatch = sw.match(/const\s+FICHIERS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(fichiersMatch, 'Liste FICHIERS manquante dans sw.js');
  const fichiers = [...fichiersMatch[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);

  // Tous les chemins de FICHIERS existent sur disque.
  for (const rel of fichiers) {
    const cible = rel === './' ? 'index.html' : rel.replace(/^\.\//, '');
    assert.ok(fs.existsSync(path.join(ROOT, cible)), `Fichier manquant pour FICHIERS : ${rel}`);
  }

  // Tous les assets attendus sont bien dans FICHIERS.
  const attendus = new Set([
    './',
    './index.html',
    './manifest.webmanifest',
    './css/style.css',
    './assets/logo-omni-systeme.webp',
    './polices/LICENCES.txt',
    ...listerFichiers('js'),
    ...listerFichiers('icons'),
    ...listerFichiers('polices'),
  ]);
  for (const req of attendus) {
    assert.ok(fichiers.includes(req), `${req} doit être présent dans sw.js FICHIERS`);
  }

  // Règles du handler fetch et mise à jour douce.
  assert.ok(sw.includes('url.origin !== self.location.origin'), 'Garde même origine manquante');
  assert.ok(sw.includes('!url.href.startsWith(self.registration.scope)'), 'Garde de périmètre scope manquante');
  assert.ok(sw.includes('.catch(() => {})'), 'cache.put doit gérer les rejets silencieusement');
  assert.ok(/try\s*\{\s*cache\s*=\s*await\s+caches\.open\(CACHE\)/.test(sw), 'caches.open doit être protégé par try/catch');

  const idxCacheMatch = sw.indexOf('cache.match(requete, { ignoreSearch: true })');
  const idxNavigate = sw.indexOf("requete.mode === 'navigate'");
  assert.ok(idxCacheMatch > 0 && idxNavigate > 0, 'cache.match et mode navigate requis');
  assert.ok(idxCacheMatch < idxNavigate, 'cache.match(requete, { ignoreSearch: true }) doit passer AVANT le repli navigate');

  const installBlock = sw.match(/addEventListener\('install'[\s\S]*?\r?\n\}\);/);
  assert.ok(installBlock, 'Listener install introuvable');
  const installSansCommentaires = installBlock[0].replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/skipWaiting\s*\(/.test(installSansCommentaires), false, 'install ne doit pas appeler skipWaiting()');

  const maj = lire('js/mise-a-jour.js');
  assert.ok(maj.includes("updateViaCache: 'none'"), 'register doit utiliser updateViaCache: none');
  const ctrlBlock = maj.match(/addEventListener\('controllerchange'[\s\S]*?\r?\n  \}\);/);
  assert.ok(ctrlBlock && ctrlBlock[0].includes('bouton.hidden = true'), 'controllerchange doit masquer #btn-maj');
});

test('Sécurité, CSP, <h1>, À propos, Vibrations et try/catch localStorage', () => {
  const html = lire('index.html');
  const cspMatch = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  assert.ok(cspMatch, 'Balise meta CSP manquante');
  const csp = cspMatch[1];
  for (const directive of [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "manifest-src 'self'",
    "worker-src 'self'",
  ]) {
    assert.ok(csp.includes(directive), `Directive CSP manquante : ${directive}`);
  }

  assert.equal(/<style[\s>]/i.test(html), false, 'Aucune balise <style> autorisée dans index.html');
  assert.equal(/\sstyle="/i.test(html), false, 'Aucun attribut style="" autorisé dans index.html');
  assert.equal(/\son[a-z]+\s*=/i.test(html), false, 'Aucun attribut on*= autorisé dans index.html');

  const h1s = html.match(/<h1\b/gi) || [];
  assert.equal(h1s.length, 1, 'index.html doit contenir exactement un <h1>');

  assert.ok(html.includes('href="icons/apple-touch-icon.png" sizes="180x180"'), 'sizes="180x180" manquant sur apple-touch-icon');
  assert.ok(html.includes('href="polices/LICENCES.txt"'), 'Lien vers polices/LICENCES.txt manquant dans À propos');
  assert.ok(html.includes('class="note-installation"'), 'Note d\'installation Chrome Android / Brave manquante');
  assert.ok(html.includes('name="vibrations"'), 'Case à cocher name="vibrations" manquante dans #dlg-reglages');

  // Charte Omni-système (auteur, licence + explication FR, contact)
  const readme = lire('README.md');
  for (const doc of [html, readme]) {
    assert.ok(doc.includes('Ferrus Dantioch'));
    assert.ok(doc.includes('CC BY-NC-ND 4.0') || doc.includes('Creative Commons BY-NC-ND 4.0'));
    assert.ok(doc.includes('omni-systeme.choking513@passmail.net'));
  }

  // Tous les appels localStorage sont dans un try/catch et tous les navigator.vibrate sont gardés.
  let totalLocalStorage = 0;
  let totalVibrate = 0;
  for (const rel of listerFichiers('js')) {
    const src = lire(rel.slice(2));
    for (const m of src.matchAll(/\blocalStorage\.(getItem|setItem|removeItem)\b/g)) {
      totalLocalStorage++;
      assert.ok(extraireBlocTryCatch(src, m.index), `${rel}: appel localStorage.${m[1]} hors try/catch`);
    }
    for (const m of src.matchAll(/\bnavigator\.vibrate\s*\(/g)) {
      totalVibrate++;
      const ligneDebut = src.lastIndexOf('\n', m.index) + 1;
      const ligne = src.slice(ligneDebut, src.indexOf('\n', m.index));
      assert.ok(ligne.includes('etat.reglages.vibrations !== false'), `${rel}: navigator.vibrate sans garde etat.reglages.vibrations`);
    }
  }
  assert.ok(totalLocalStorage >= 11, 'Appels localStorage attendus introuvables');
  assert.equal(totalVibrate, 2, 'Exactement 2 appels navigator.vibrate attendus (interactions.js + pointeur.js)');

  const noyau = lire('js/noyau.js');
  assert.ok(/const\s+defaut\s*=\s*\{[^}]*vibrations:\s*true/.test(noyau), 'vibrations: true doit être dans defaut de lireReglages()');
});

test('Manifeste, icônes PNG et fichiers de dépôt (.nojekyll, .gitattributes, CLAUDE.md, CI)', () => {
  const manifest = JSON.parse(lire('manifest.webmanifest'));
  assert.equal(manifest.id, '/omni-schema/');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');

  const srcs = manifest.icons.map((i) => `${i.src}:${i.sizes}:${i.purpose}`);
  assert.ok(srcs.includes('icons/icon-192.png:192x192:any'));
  assert.ok(srcs.includes('icons/icon-512.png:512x512:any'));
  assert.ok(srcs.includes('icons/icon-maskable-192.png:192x192:maskable'));
  assert.ok(srcs.includes('icons/icon-maskable-512.png:512x512:maskable'));
  assert.ok(srcs.includes('icons/icon.svg:any:any'));

  const icon192 = parsePngInfo(path.join(ROOT, 'icons/icon-192.png'));
  assert.equal(icon192.width, 192);
  assert.equal(icon192.height, 192);

  const icon512 = parsePngInfo(path.join(ROOT, 'icons/icon-512.png'));
  assert.equal(icon512.width, 512);
  assert.equal(icon512.height, 512);

  const mask192 = parsePngInfo(path.join(ROOT, 'icons/icon-maskable-192.png'));
  assert.equal(mask192.width, 192);
  assert.equal(mask192.height, 192);
  assert.equal(mask192.hasAlphaChannel, false, 'icon-maskable-192.png doit être opaque sans canal alpha');

  const mask512 = parsePngInfo(path.join(ROOT, 'icons/icon-maskable-512.png'));
  assert.equal(mask512.width, 512);
  assert.equal(mask512.height, 512);
  assert.equal(mask512.hasAlphaChannel, false, 'icon-maskable-512.png doit être opaque sans canal alpha');

  const apple = parsePngInfo(path.join(ROOT, 'icons/apple-touch-icon.png'));
  assert.equal(apple.width, 180);
  assert.equal(apple.height, 180);
  assert.equal(apple.hasAlphaChannel, false, 'apple-touch-icon.png doit être opaque sans canal alpha');

  assert.ok(fs.existsSync(path.join(ROOT, '.nojekyll')), '.nojekyll manquant');
  assert.ok(fs.existsSync(path.join(ROOT, '.gitignore')), '.gitignore manquant');
  assert.ok(fs.existsSync(path.join(ROOT, 'CLAUDE.md')), 'CLAUDE.md manquant');
  assert.ok(fs.existsSync(path.join(ROOT, '.github/workflows/ci.yml')), 'ci.yml manquant');

  const gitattr = lire('.gitattributes');
  assert.ok(gitattr.includes('* text=auto eol=lf'), '.gitattributes doit forcer LF');
  assert.ok(gitattr.includes('*.png binary'), '.gitattributes doit marquer *.png binary');

  const css = lire('css/style.css');
  assert.ok(css.includes('@media not all and (display-mode: browser)'), 'Règle masquant .note-installation hors navigateur manquante');
});
