import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

let server;
let baseUrl;
let browser;
let swVersionOverride = null;

before(async () => {
  server = http.createServer((req, res) => {
    const reqPath = new URL(req.url, 'http://127.0.0.1').pathname;
    if (swVersionOverride && reqPath === '/js/version.js') {
      res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
      res.end(`globalThis.OMNI_SCHEMA_VERSION = '${swVersionOverride}';\n`);
      return;
    }
    const rel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
    const full = path.resolve(ROOT, rel);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

function attacherEspions(page, options = {}) {
  const erreurs = [];
  const externes = [];

  page.on('pageerror', (err) => erreurs.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !options.autoriserConsoleError) {
      erreurs.push(`console.error: ${msg.text()}`);
    }
  });
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(baseUrl) && !url.startsWith('blob:') && !url.startsWith('data:')) {
      externes.push(url);
    }
  });

  return {
    erreurs,
    externes,
    async installerInitScript() {
      await page.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener('securitypolicyviolation', (e) => {
          window.__cspViolations.push(`${e.violatedDirective}:${e.blockedURI}`);
        });
      });
    },
    async verifier() {
      const violations = await page.evaluate(() => window.__cspViolations || []);
      assert.deepEqual(erreurs, [], `Erreurs inattendues : ${erreurs.join(' | ')}`);
      assert.deepEqual(violations, [], `Violations CSP : ${violations.join(' | ')}`);
      assert.deepEqual(externes, [], `Requêtes externes : ${externes.join(' | ')}`);
    },
  };
}

async function attendreAppPrete(page) {
  await page.waitForFunction(() => Boolean(window.omniSchema && window.omniSchema.etat && window.omniSchema.etat.schema));
}

async function attendreServiceWorkerControle(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const controle = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  if (!controle) {
    await page.reload({ waitUntil: 'networkidle' });
    await attendreAppPrete(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
  }
  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true, 'Le SW doit contrôler la page');
}

test('E2E 1 — CSP complète, zéro erreur, version 1.7.2, À propos & <h1> unique', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const espions = attacherEspions(page);
  await espions.installerInitScript();

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await attendreAppPrete(page);

    assert.equal(await page.locator('h1').count(), 1, 'Exactement un <h1> attendu');
    assert.equal(await page.locator('#version-app').textContent(), '1.7.2');

    // Ouvrir Menu -> À propos
    await page.click('#btn-menu');
    await page.click('[data-menu="apropos"]');
    await page.waitForSelector('#dlg-apropos[open]');

    const lienLicences = page.locator('#dlg-apropos a[href="polices/LICENCES.txt"]');
    assert.equal(await lienLicences.count(), 1);
    assert.equal(await lienLicences.getAttribute('target'), '_blank');
    assert.equal(await lienLicences.getAttribute('rel'), 'noopener noreferrer');

    const noteInstall = page.locator('#dlg-apropos .note-installation');
    assert.equal(await noteInstall.isVisible(), true);
    const noteText = await noteInstall.textContent();
    assert.ok(noteText.includes('Chrome') && noteText.includes('Brave') && noteText.includes('raccourci'));

    await page.click('#dlg-apropos [data-fermer]');

    // Ouvrir et fermer quelques dialogues principaux
    await page.click('#btn-menu');
    await page.click('[data-menu="aide"]');
    await page.waitForSelector('#dlg-aide[open]');
    await page.click('#dlg-aide [data-fermer]');

    await espions.verifier();
  } finally {
    await context.close();
  }
});

test('E2E 2 — Service Worker omni-schema-1.7.2, updateViaCache: none et mode hors ligne (dont polices/LICENCES.txt)', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const espions = attacherEspions(page, { autoriserConsoleError: false });
  await espions.installerInitScript();

  await page.addInitScript(() => {
    window.__swRegistrations = [];
    const origRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = function (url, opts) {
      window.__swRegistrations.push({ url, opts });
      return origRegister(url, opts);
    };
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await attendreAppPrete(page);
    await attendreServiceWorkerControle(page);

    const regs = await page.evaluate(() => window.__swRegistrations);
    assert.ok(regs.length >= 1);
    assert.equal(regs[0].opts?.updateViaCache, 'none', 'updateViaCache: none requis');

    const cachesNoms = await page.evaluate(() => caches.keys());
    assert.ok(cachesNoms.includes('omni-schema-1.7.2'), `Cache omni-schema-1.7.2 absent : ${cachesNoms.join(', ')}`);

    // Passage hors ligne
    await context.setOffline(true);

    // 1. Racine ./
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await attendreAppPrete(page);
    assert.equal(await page.locator('#version-app').textContent(), '1.7.2');

    // 2. Paramètre ?public= (ignoreSearch: true)
    const resPublic = await page.goto(`${baseUrl}/?public=demo`, { waitUntil: 'domcontentloaded' });
    assert.equal(resPublic.status(), 200);
    const titlePublic = await page.title();
    assert.equal(titlePublic, 'omni-schema');

    // 3. polices/LICENCES.txt en navigation directe hors ligne : ne doit PAS renvoyer index.html
    const resLicences = await page.goto(`${baseUrl}/polices/LICENCES.txt`, { waitUntil: 'domcontentloaded' });
    assert.equal(resLicences.status(), 200);
    const bodyLicences = await resLicences.text();
    assert.ok(bodyLicences.includes('SIL OPEN FONT LICENSE'), 'polices/LICENCES.txt doit contenir le texte SIL OFL');
    assert.equal(bodyLicences.includes('<!doctype html>'), false, 'polices/LICENCES.txt ne doit pas être remplacé par index.html');

    // 4. Navigation inconnue hors ligne -> repli vers index.html
    const resFallback = await page.goto(`${baseUrl}/route-inexistante`, { waitUntil: 'domcontentloaded' });
    assert.equal(resFallback.status(), 200);
    assert.equal(await page.title(), 'omni-schema');

    await espions.verifier();

    // 5. Ressource non-navigation absente hors ligne -> 503
    const statusNonNav = await page.evaluate(async () => {
      const r = await fetch('./inexistant.json');
      return r.status;
    });
    assert.equal(statusNonNav, 503);

    await context.setOffline(false);
  } finally {
    await context.close();
  }
});

test('E2E 3 — Mise à jour multi-onglets : controllerchange masque #btn-maj dans le 2e onglet', async () => {
  const context = await browser.newContext();
  const page1 = await context.newPage();
  const page2 = await context.newPage();

  try {
    await page1.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await attendreAppPrete(page1);
    await attendreServiceWorkerControle(page1);

    await page2.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await attendreAppPrete(page2);
    await attendreServiceWorkerControle(page2);

    assert.equal(await page1.locator('#btn-maj').isHidden(), true);
    assert.equal(await page2.locator('#btn-maj').isHidden(), true);

    // Publie une version temporaire côté serveur de test
    swVersionOverride = '1.7.3-test';
    await page1.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg.update();
    });
    await page2.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg.update();
    });

    await page1.waitForSelector('#btn-maj:not([hidden])', { timeout: 10000 });
    await page2.waitForSelector('#btn-maj:not([hidden])', { timeout: 10000 });

    // L'onglet 1 clique sur Mettre à jour -> l'onglet 1 recharge, l'onglet 2 cache #btn-maj sans recharger
    let page2Reloaded = false;
    page2.on('load', () => { page2Reloaded = true; });

    await Promise.all([
      page1.waitForEvent('load'),
      page1.click('#btn-maj'),
    ]);
    await attendreAppPrete(page1);
    assert.equal(await page1.locator('#version-app').textContent(), '1.7.3-test');
    assert.equal(await page1.locator('#btn-maj').isHidden(), true);

    await page2.waitForFunction(() => document.getElementById('btn-maj').hidden === true);
    assert.equal(await page2.locator('#btn-maj').isDisabled(), false);
    assert.equal(page2Reloaded, false, 'Le 2e onglet ne doit pas être rechargé de force');
  } finally {
    swVersionOverride = null;
    await context.close();
  }
});

test('E2E 4 — Réglage Vibrations : activé par défaut, persisté, et respecté (éditeur + présentation)', async () => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const espions = attacherEspions(page);
  await espions.installerInitScript();

  await page.addInitScript(() => {
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });

  async function appuiLong(locator, dureeMs = 520) {
    const box = await locator.boundingBox();
    assert.ok(box, 'Élément sans boundingBox');
    const x = Math.round(box.x + box.width * 0.15);
    const y = Math.round(box.y + box.height * 0.2);
    await page.evaluate(async ({ x, y, dureeMs }) => {
      const el = document.elementFromPoint(x, y);
      el.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch',
        clientX: x, clientY: y, button: 0, isPrimary: true,
      }));
      await new Promise((r) => setTimeout(r, dureeMs));
      el.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch',
        clientX: x, clientY: y, button: 0, isPrimary: true,
      }));
    }, { x, y, dureeMs });
  }

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await attendreAppPrete(page);

    assert.equal(await page.evaluate(() => window.omniSchema.etat.reglages.vibrations), true);

    // 1. Par défaut : appui long sur le fond déclenche vibrate(15)
    await appuiLong(page.locator('#toile'));
    const appelsDefaut = await page.evaluate(() => window.__vibrateCalls);
    assert.ok(appelsDefaut.includes(15), `Vibration attendue par défaut (15ms), reçu : ${JSON.stringify(appelsDefaut)}`);

    // 2. Désactiver Vibrations dans Réglages et recharger
    await page.click('#btn-menu');
    await page.click('[data-menu="reglages"]');
    await page.waitForSelector('#dlg-reglages[open]');
    const caseVib = page.locator('#dlg-reglages input[name="vibrations"]');
    assert.equal(await caseVib.isChecked(), true);
    await caseVib.uncheck();
    await page.click('#dlg-reglages [data-fermer]');

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('omni-schema.reglages')));
    assert.equal(saved.vibrations, false);

    await page.reload({ waitUntil: 'networkidle' });
    await attendreAppPrete(page);
    await page.evaluate(() => { window.__vibrateCalls = []; });

    assert.equal(await page.evaluate(() => window.omniSchema.etat.reglages.vibrations), false);
    await page.click('#btn-menu');
    await page.click('[data-menu="reglages"]');
    assert.equal(await page.locator('#dlg-reglages input[name="vibrations"]').isChecked(), false);
    await page.click('#dlg-reglages [data-fermer]');

    // 3. Appui long sur l'éditeur ne vibre plus
    await appuiLong(page.locator('#toile'));
    assert.deepEqual(await page.evaluate(() => window.__vibrateCalls), [], 'Aucune vibration tolérée dans l\'éditeur quand désactivée');

    // 4. Appui long en présentation (pointeur.js) ne vibre pas non plus
    await page.click('#btn-presenter');
    await page.waitForSelector('#presentation:not([hidden])');
    await appuiLong(page.locator('#pres-scene'), 450);
    assert.deepEqual(await page.evaluate(() => window.__vibrateCalls), [], 'Aucune vibration tolérée en présentation quand désactivée');
    await page.click('#pres-quitter');

    // 5. Réactiver et vérifier que pointeur.js vibre (10ms)
    await page.click('#btn-menu');
    await page.click('[data-menu="reglages"]');
    await page.locator('#dlg-reglages input[name="vibrations"]').check();
    await page.click('#dlg-reglages [data-fermer]');

    await page.click('#btn-presenter');
    await page.waitForSelector('#presentation:not([hidden])');
    await appuiLong(page.locator('#pres-scene'), 450);
    const appelsPres = await page.evaluate(() => window.__vibrateCalls);
    assert.ok(appelsPres.includes(10), `Vibration attendue en présentation (10ms), reçu : ${JSON.stringify(appelsPres)}`);
    await page.click('#pres-quitter');

    await espions.verifier();
  } finally {
    await context.close();
  }
});

test('E2E 5 — Accessibilité : cibles >= 44×44 px, zéro débordement et zéro rognage (1280×800, 390×844, 320×640, bloc, groupe, taille 130%)', async () => {
  const viewports = [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 320, height: 640 },
  ];

  async function verifierControlesVisibles(page, contexteLabel) {
    const anomalies = await page.evaluate((label) => {
      const probleme = [];
      const vw = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > vw) {
        probleme.push(`${label}: débordement horizontal (${document.documentElement.scrollWidth} > ${vw})`);
      }
      const dialogueOuvert = document.querySelector('dialog[open]');
      if (dialogueOuvert && dialogueOuvert.scrollWidth > dialogueOuvert.clientWidth) {
        probleme.push(`${label}: débordement horizontal dans #${dialogueOuvert.id} (${dialogueOuvert.scrollWidth} > ${dialogueOuvert.clientWidth})`);
      }
      const racine = dialogueOuvert || document.body;
      const selecteur = 'button, a[href], input:not([type="checkbox"]):not([type="radio"]), select, textarea, .cases label, .pilules label, .carte-modele';
      for (const el of racine.querySelectorAll(selecteur)) {
        if (!dialogueOuvert && el.closest('dialog')) continue;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (el.closest('[hidden]')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.width < 44 || rect.height < 44) {
          probleme.push(`${label}: cible trop petite ${el.tagName.toLowerCase()}#${el.id || ''}.${el.className || ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" -> ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}`);
        }
        if (rect.left < -0.5 || rect.right > vw + 0.5) {
          probleme.push(`${label}: contrôle rogné hors écran (${rect.left.toFixed(1)}..${rect.right.toFixed(1)} vs vw=${vw}) ${el.tagName.toLowerCase()}#${el.id || ''}.${el.className || ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`);
        }
      }
      return probleme;
    }, contexteLabel);
    assert.deepEqual(anomalies, [], anomalies.join('\n'));
  }

  async function verifierControlesPresentation(page, contexteLabel) {
    const anomalies = await page.evaluate((label) => {
      const probleme = [];
      const vw = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > vw) {
        probleme.push(`${label}: débordement horizontal (${document.documentElement.scrollWidth} > ${vw})`);
      }
      const pres = document.getElementById('presentation');
      const boutons = [];
      for (const el of pres.querySelectorAll('button')) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (el.closest('[hidden]')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.width < 44 || rect.height < 44) {
          probleme.push(`${label}: cible trop petite #${el.id} -> ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}`);
        }
        if (rect.left < -0.5 || rect.right > vw + 0.5) {
          probleme.push(`${label}: contrôle rogné hors écran (${rect.left.toFixed(1)}..${rect.right.toFixed(1)} vs vw=${vw}) #${el.id}`);
        }
        boutons.push({ id: el.id || el.className, rect });
      }
      for (let i = 0; i < boutons.length; i++) {
        for (let j = i + 1; j < boutons.length; j++) {
          const a = boutons[i];
          const b = boutons[j];
          const ox = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
          const oy = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
          if (ox > 0 && oy > 0) {
            probleme.push(`${label}: chevauchement #${a.id} (${a.rect.left.toFixed(1)}..${a.rect.right.toFixed(1)}) et #${b.id} (${b.rect.left.toFixed(1)}..${b.rect.right.toFixed(1)}) de ${ox.toFixed(1)}×${oy.toFixed(1)} px`);
          }
        }
      }
      return probleme;
    }, contexteLabel);
    assert.deepEqual(anomalies, [], anomalies.join('\n'));
  }

  async function verifierPresentationMobile(page, label) {
    await page.click('#btn-presenter');
    await page.waitForSelector('#presentation:not([hidden])');
    await verifierControlesPresentation(page, `${label} defaut`);
    await page.click('#pres-notes');
    await page.waitForSelector('#pres-panneau-notes:not([hidden])');
    await verifierControlesPresentation(page, `${label} + notes`);
    await page.click('#pres-feutre');
    await page.waitForSelector('#pres-effacer:not([hidden])');
    await verifierControlesPresentation(page, `${label} + feutre`);
    await page.click('#pres-quitter');
    await page.waitForFunction(() => document.getElementById('presentation').hidden === true);
  }

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();
    const espions = attacherEspions(page);
    await espions.installerInitScript();

    try {
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
      await attendreAppPrete(page);

      const tag = `${vp.width}×${vp.height}`;
      await verifierControlesVisibles(page, `${tag} accueil`);

      // Simule #btn-maj visible (pire cas de largeur dans .barre-haut)
      await page.evaluate(() => { document.getElementById('btn-maj').hidden = false; });
      await verifierControlesVisibles(page, `${tag} accueil + btn-maj`);

      // Sélection d'un bloc (7 outils dans .groupe-outils[data-pour="bloc"]) + #btn-maj visible
      await page.click('#btn-ajouter');
      await page.keyboard.press('Escape');
      await page.waitForSelector('.groupe-outils[data-pour="bloc"]:not([hidden])');
      await verifierControlesVisibles(page, `${tag} bloc + btn-maj`);

      // Note du présentateur (#dlg-note)
      await page.click('#btn-note');
      await page.waitForSelector('#dlg-note[open]');
      await verifierControlesVisibles(page, `${tag} note`);
      await page.click('#dlg-note [data-fermer]');

      // Sélection d'un groupe (7 outils dans .groupe-outils[data-pour="groupe"]) + #btn-maj visible
      await page.locator('#toile').focus();
      await page.keyboard.press('Escape');
      await page.click('#btn-ajouter');
      await page.keyboard.press('Escape');
      await page.locator('#toile').focus();
      await page.keyboard.press('Control+a');
      await page.waitForSelector('.groupe-outils[data-pour="groupe"]:not([hidden])');
      await verifierControlesVisibles(page, `${tag} groupe + btn-maj`);

      // Sur 320×640, vérifier aussi taille 130 % avec bloc + groupe + #btn-maj
      if (vp.width === 320) {
        await page.click('#btn-menu');
        await page.click('[data-menu="reglages"]');
        await page.waitForSelector('#dlg-reglages[open]');
        await page.click('#dlg-reglages label:has(input[name="taille"][value="130"])');
        await verifierControlesVisibles(page, `${tag} reglages 130%`);
        await page.click('#dlg-reglages [data-fermer]');

        await verifierControlesVisibles(page, `${tag} groupe 130% + btn-maj`);
        await page.click('#btn-fermer-groupe');
        await page.locator('#toile').focus();
        await page.keyboard.press('Tab');
        await page.waitForSelector('.groupe-outils[data-pour="bloc"]:not([hidden])');
        await verifierControlesVisibles(page, `${tag} bloc 130% + btn-maj`);

        await page.click('#btn-menu');
        await page.click('[data-menu="nouveau"]');
        await page.waitForSelector('#dlg-nouveau[open]');
        await verifierControlesVisibles(page, `${tag} nouveau 130%`);
        await page.click('#dlg-nouveau [data-fermer]');

        // Modèle personnalisé avec nom long sans espace (cas de débordement #section-mes-modeles)
        await page.click('#btn-menu');
        await page.click('[data-menu="modele"]');
        await page.waitForSelector('#dlg-saisie[open]');
        await page.fill('#saisie-champ', 'Modele_Tres_Long_Sans_Espace_Pour_Tester_Debordement_1234567890');
        await page.click('#dlg-saisie button[value="oui"]');
        await page.waitForFunction(() => document.getElementById('annonce').textContent.includes('Modele_Tres_Long_Sans_Espace_Pour_Tester_Debordement_1234567890'));

        await page.click('#btn-menu');
        await page.click('[data-menu="nouveau"]');
        await page.waitForSelector('#dlg-nouveau[open]');
        await page.waitForSelector('#section-mes-modeles:not([hidden])');
        await page.waitForSelector('#liste-mes-modeles .carte-modele');
        await verifierControlesVisibles(page, `${tag} nouveau 130% modele long`);
        const dlgNouveauDebordement = await page.evaluate(() => {
          const dlg = document.getElementById('dlg-nouveau');
          return { scrollWidth: dlg.scrollWidth, clientWidth: dlg.clientWidth };
        });
        assert.ok(
          dlgNouveauDebordement.scrollWidth <= dlgNouveauDebordement.clientWidth,
          `#dlg-nouveau déborde avec un nom de modèle long (${dlgNouveauDebordement.scrollWidth} > ${dlgNouveauDebordement.clientWidth})`,
        );
        await page.click('#dlg-nouveau [data-fermer]');

        await verifierPresentationMobile(page, `${tag} presentation 130%`);

        await page.click('#btn-menu');
        await page.click('[data-menu="reglages"]');
        await page.click('#dlg-reglages label:has(input[name="taille"][value="100"])');
        await page.click('#dlg-reglages [data-fermer]');

        await verifierPresentationMobile(page, `${tag} presentation 100%`);
      }

      await page.evaluate(() => { document.getElementById('btn-maj').hidden = true; });

      // Fenêtre de saisie (#dlg-saisie)
      await page.click('#btn-titre');
      await page.waitForSelector('#dlg-saisie[open]');
      await verifierControlesVisibles(page, `${tag} saisie`);
      await page.click('#dlg-saisie button[value="non"]');

      await page.click('#btn-menu');
      await page.waitForSelector('#dlg-menu[open]');
      await verifierControlesVisibles(page, `${tag} menu`);
      await page.click('[data-menu="reglages"]');
      await page.waitForSelector('#dlg-reglages[open]');
      await verifierControlesVisibles(page, `${tag} reglages`);
      await page.click('#dlg-reglages [data-fermer]');

      await page.click('#btn-menu');
      await page.click('[data-menu="apropos"]');
      await page.waitForSelector('#dlg-apropos[open]');
      await verifierControlesVisibles(page, `${tag} apropos`);
      await page.click('#dlg-apropos [data-fermer]');

      // Mes schémas -> Confirmation (#dlg-confirmer) -> Corbeille (#dlg-corbeille)
      await page.click('#btn-menu');
      await page.click('[data-menu="schemas"]');
      await page.waitForSelector('#dlg-schemas[open]');
      await verifierControlesVisibles(page, `${tag} schemas`);
      await page.click('#liste-schemas button[aria-label^="Supprimer « "]');
      await page.waitForSelector('#dlg-confirmer[open]');
      await verifierControlesVisibles(page, `${tag} confirmer`);
      await page.click('#confirmer-ok');
      await page.waitForSelector('#btn-corbeille:not([hidden])');
      await page.click('#btn-corbeille');
      await page.waitForSelector('#dlg-corbeille[open]');
      await verifierControlesVisibles(page, `${tag} corbeille`);
      await page.click('#dlg-corbeille [data-fermer]');
      await page.click('#dlg-schemas [data-fermer]');

      await espions.verifier();
    } finally {
      await context.close();
    }
  }
});

test('E2E 6 — Résilience localStorage plein / bloqué (SecurityError / QuotaExceededError)', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const espions = attacherEspions(page);
  await espions.installerInitScript();

  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
    Storage.prototype.removeItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await attendreAppPrete(page);

    // L'app démarre avec le schéma d'accueil
    const nbBlocs = await page.evaluate(() => window.omniSchema.etat.schema.elements.filter((e) => e.type === 'bloc').length);
    assert.ok(nbBlocs >= 1);

    // Changement de réglage -> message utilisateur gracieux via #annonce
    await page.click('#btn-menu');
    await page.click('[data-menu="reglages"]');
    await page.locator('#dlg-reglages input[name="vibrations"]').uncheck();
    await page.click('#dlg-reglages [data-fermer]');
    const annonceReglage = await page.locator('#annonce').textContent();
    assert.ok(annonceReglage.includes('Impossible d\'enregistrer les réglages'));

    // Ajouter et copier un bloc -> repli mémoire dans l'onglet + message clair
    await page.click('#btn-ajouter');
    await page.click('#btn-copier');
    const annonceCopie = await page.locator('#annonce').textContent();
    assert.ok(annonceCopie.includes('cet onglet seulement'));

    // Désélectionner puis coller fonctionne depuis le tampon mémoire
    await page.locator('#toile').focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#btn-coller').isDisabled(), false);
    await page.click('#btn-coller');
    const nbBlocsApres = await page.evaluate(() => window.omniSchema.etat.schema.elements.filter((e) => e.type === 'bloc').length);
    assert.equal(nbBlocsApres, nbBlocs + 2);

    // Présentation avec étapes numérotées + navigation ne plantent pas malgré localStorage bloqué
    await page.keyboard.press('Escape');
    await page.click('#btn-etapes');
    await page.waitForSelector('#dlg-etapes[open]');
    await page.click('#btn-numeroter');
    if (await page.locator('#dlg-confirmer[open]').count()) await page.click('#confirmer-ok');
    await page.click('#btn-presenter-etapes');
    await page.waitForSelector('#presentation:not([hidden])');
    await page.click('#pres-suivant');
    await page.click('#pres-quitter');

    await espions.verifier();
  } finally {
    await context.close();
  }
});

test('E2E 7 — Parcours fonctionnel : création, sauvegarde IndexedDB, rechargement et présentation', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const espions = attacherEspions(page);
  await espions.installerInitScript();

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await attendreAppPrete(page);

    // Créer un nouveau schéma
    await page.click('#btn-menu');
    await page.click('[data-menu="nouveau"]');
    await page.fill('#nouveau-titre', 'Schéma E2E');
    await page.click('#dlg-nouveau button[value="oui"]');
    await page.waitForFunction(() => window.omniSchema.etat.schema.titre === 'Schéma E2E');

    // Ajouter un bloc et vérifier la persistance après rechargement
    const avant = await page.evaluate(() => window.omniSchema.etat.schema.elements.filter((e) => e.type === 'bloc').length);
    await page.click('#btn-ajouter');
    const apres = await page.evaluate(() => window.omniSchema.etat.schema.elements.filter((e) => e.type === 'bloc').length);
    assert.equal(apres, avant + 1);

    // Attendre le debounce de sauvegarde (500ms) + marge
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: 'networkidle' });
    await attendreAppPrete(page);

    assert.equal(await page.evaluate(() => window.omniSchema.etat.schema.titre), 'Schéma E2E');
    assert.equal(await page.evaluate(() => window.omniSchema.etat.schema.elements.filter((e) => e.type === 'bloc').length), apres);

    // Lancer puis quitter la présentation
    await page.click('#btn-presenter');
    await page.waitForSelector('#presentation:not([hidden])');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('presentation').hidden === true);

    await espions.verifier();
  } finally {
    await context.close();
  }
});
