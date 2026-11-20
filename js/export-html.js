// =====================================================================
// Export en PAGE HTML AUTONOME : un seul fichier .html qui contient
// le schéma et un petit lecteur de présentation (lecture seule).
//
// - Il s'ouvre partout, hors ligne, sans installer l'application.
// - Aucune dépendance externe ; une règle de sécurité (CSP) interdit
//   même tout chargement depuis internet.
// - Le schéma est dessiné À L'AVANCE ici (texte déjà découpé en lignes) :
//   le fichier ne contient donc AUCUN code d'édition, seulement un
//   lecteur d'une centaine de lignes qui montre/cache les étapes.
// - Sans JavaScript, la page affiche quand même le schéma complet.
// - Les sous-schémas (blocs marqués ↗) sont inclus : chacun est une
//   « page » du fichier ; toucher le bloc y entre, et on revient au
//   schéma de départ à la fin (ou avec « Retour »).
// =====================================================================

import { APP_VERSION } from './config.js';
import { couleursToile } from './couleurs.js';
import { listeBlocs, migrer } from './modele.js';
import { chargerSchema } from './stockage.js';
import { arrets, nomElement } from './etapes.js';
import { construireSvg, dessinerSurlignage } from './schema-svg.js';
import { telecharger, nomFichier } from './fichiers.js';
import { cssPolicesIntegrees } from './polices.js';

// Couleurs de l'interface du lecteur, selon le thème choisi.
const INTERFACE = {
  clair: { surface: '#ffffff', filet: '#e2ddec', texte: '#16121f', doux: '#4f4a5e', accent: '#6a3fd6', focus: '#b35c00' },
  sombre: { surface: '#1b1a20', filet: '#2a2831', texte: '#eeedf2', doux: '#b0adba', accent: '#a777ff', focus: '#ffd166' },
  violet: { surface: '#1e1928', filet: '#262435', texte: '#ece8f5', doux: '#aaa6c0', accent: '#a777ff', focus: '#ffd166' },
};

const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Prépare une « page » du fichier : le SVG d'un schéma (avec ses
 * surlignages cachés), ses arrêts et ses notes. « inclus » : les
 * identifiants des schémas présents dans le fichier (un lien vers un
 * schéma absent est ignoré).
 */
function preparerPage(schema, theme, { notes, inclus }) {
  const T = couleursToile(theme);
  // Les liens vers des schémas absents du fichier sont retirés (pas de badge trompeur).
  const copie = { ...schema, elements: schema.elements.map((e) => (e.type === 'bloc' && e.lien && !inclus.has(e.lien) ? { ...e, lien: '' } : e)) };
  const rendu = construireSvg(copie, theme, { liens: true });

  // Surlignages préparés d'avance (cachés), un par élément ayant une étape.
  for (const item of rendu.elements) {
    if (item.type === 'bloc' && item.donnees.lien) item.g.setAttribute('data-lien', item.donnees.lien);
    if (item.etape <= 0) continue;
    const forme = dessinerSurlignage(rendu.calqueSurlignage, item, T.selection);
    forme.setAttribute('data-etape', item.etape);
    forme.setAttribute('class', 'surlignage-element');
    forme.setAttribute('style', 'display: none');
  }
  rendu.svg.setAttribute('width', '100%');
  rendu.svg.setAttribute('height', '100%');
  rendu.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  rendu.svg.setAttribute('aria-label', schema.titre);

  const donneesNotes = {};
  if (notes) {
    for (const item of rendu.elements) {
      if (item.type !== 'bloc' || !item.donnees.note.trim()) continue;
      (donneesNotes[item.etape] = donneesNotes[item.etape] || []).push({ bloc: nomElement(schema, item.donnees, 60), texte: item.donnees.note });
    }
  }
  return {
    svgTexte: new XMLSerializer().serializeToString(rendu.svg),
    donnees: { titre: schema.titre, arrets: arrets(schema), notes: notes ? donneesNotes : null },
  };
}

/**
 * Fabrique le texte complet du fichier HTML.
 * « sousSchemas » : les sous-schémas à inclure (déjà chargés).
 */
export function construireHtml(schema, theme, { notes = false, fondu = false, css = '', sousSchemas = [] } = {}) {
  if (!listeBlocs(schema).length) throw new Error('Ce schéma est vide : ajoute au moins un bloc.');
  const T = couleursToile(theme);
  const I = INTERFACE[theme] || INTERFACE.clair;
  const tous = [schema, ...sousSchemas.filter((s) => s.id !== schema.id)];
  const inclus = new Set(tous.map((s) => s.id));
  const pages = tous.map((s) => ({ id: s.id, ...preparerPage(s, theme, { notes, inclus }) }));
  // Chaque page est un bloc HTML ; seule la première est visible au départ (et sans JavaScript).
  const svgTexte = pages.map((p, i) => `<div class="page" data-schema="${echapper(p.id)}"${i ? ' hidden' : ''}>${p.svgTexte}</div>`).join('');
  const liste = pages[0].donnees.arrets;

  // Données pour le lecteur : pour chaque page, les arrêts et (option) les notes.
  const donnees = JSON.stringify({
    principal: schema.id,
    pages: Object.fromEntries(pages.map((p) => [p.id, p.donnees])),
    notes: !!notes,
    fondu,
  }).replace(/</g, '\\u003c'); // empêche de fermer la balise <script> par accident

  const icone = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:">
<meta name="generator" content="omni-schema ${APP_VERSION}">
<title>${echapper(schema.titre)}</title>
<style>
${css}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:${T.fond};color:${I.texte};font-family:"Oxanium",system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif;overflow:hidden;overscroll-behavior:none;-webkit-tap-highlight-color:transparent}
#scene{position:fixed;inset:0;padding:max(1rem,env(safe-area-inset-top)) max(1rem,env(safe-area-inset-right)) max(4.5rem,env(safe-area-inset-bottom)) max(1rem,env(safe-area-inset-left));cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation}
#scene .page,#scene svg{display:block;width:100%;height:100%}
#scene svg{pointer-events:none}
#retour{position:fixed;top:max(.5rem,env(safe-area-inset-top));left:max(.5rem,env(safe-area-inset-left));max-width:calc(100% - 1rem);opacity:.85;background:${I.surface}}
#retour span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
button{font:inherit;color:inherit;display:inline-flex;align-items:center;justify-content:center;gap:.35rem;min-width:48px;min-height:48px;padding:.4rem .6rem;border:0;border-radius:12px;background:transparent;opacity:.6;cursor:pointer;touch-action:manipulation;font-weight:650}
button:hover,button:focus-visible,button[aria-expanded="true"]{opacity:1;background:${I.surface}}
button:disabled{opacity:.2;cursor:default}
button svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
:focus-visible{outline:3px solid ${I.focus};outline-offset:2px}
.bas{position:fixed;bottom:max(.5rem,env(safe-area-inset-bottom));display:flex;align-items:center;gap:.15rem}
#navigation{right:max(.5rem,env(safe-area-inset-right))}
#outils{left:max(.5rem,env(safe-area-inset-left))}
#compteur{min-width:4.5rem;text-align:center;font-family:ui-monospace,"Cascadia Mono","Roboto Mono",Menlo,Consolas,monospace;color:${I.doux}}
#signature{position:fixed;left:50%;bottom:max(1rem,env(safe-area-inset-bottom));transform:translateX(-50%);margin:0;font-size:.8rem;color:${I.doux};opacity:.8;white-space:nowrap;pointer-events:none}
@media (max-width:640px){#signature{bottom:auto;top:max(.6rem,env(safe-area-inset-top));left:max(.75rem,env(safe-area-inset-left));transform:none}}
#notes{position:fixed;left:max(.5rem,env(safe-area-inset-left));bottom:calc(max(.5rem,env(safe-area-inset-bottom)) + 56px);width:min(34rem,calc(100% - 1rem));max-height:45vh;overflow-y:auto;padding:.75rem 1rem;border:1px solid ${I.filet};border-radius:18px;background:${I.surface};box-shadow:0 10px 30px rgb(0 0 0 / .3)}
#notes h2{margin:0 0 .5rem;font-size:.75rem;letter-spacing:.16em;text-transform:uppercase;color:${I.doux}}
.note+.note{margin-top:.75rem;padding-top:.75rem;border-top:1px solid ${I.filet}}
.note p{margin:0}.note-bloc{font-weight:700;color:${I.accent}}
.note-texte{font-family:"Literata","Iowan Old Style","Palatino Linotype",Charter,"Noto Serif",Georgia,serif;font-size:1.08rem;line-height:1.55;white-space:pre-wrap}
.sans-note{margin:0;font-style:italic;color:${I.doux}}
[hidden]{display:none!important}
@keyframes apparition{from{opacity:0}to{opacity:1}}
.apparait{animation:apparition 280ms ease-out both}
@media (prefers-reduced-motion:reduce){.apparait{animation:none}}
</style>
<noscript><style>#outils,#navigation{display:none}#signature{bottom:max(1rem,env(safe-area-inset-bottom))!important;top:auto!important}</style></noscript>
</head>
<body>
<main id="scene" aria-label="Schéma : ${echapper(schema.titre)}. Touche à droite pour avancer, à gauche pour revenir.">${svgTexte}</main>
<div class="bas" id="outils">
${notes ? `<button type="button" id="bouton-notes" aria-expanded="false" aria-controls="notes" title="Notes du présentateur (N)">${icone('M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6')}<span>Notes</span></button>` : ''}
<button type="button" id="bouton-plein-ecran" aria-label="Plein écran" title="Plein écran (F)">${icone('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')}</button>
</div>
<nav class="bas" id="navigation" aria-label="Étapes">
<button type="button" id="precedent" aria-label="Étape précédente">${icone('m15 5-7 7 7 7')}</button>
<span id="compteur" role="status">1 / ${liste.length}</span>
<button type="button" id="suivant" aria-label="Étape suivante">${icone('m9 5 7 7-7 7')}</button>
</nav>
<p id="signature">Fait avec omni-schema — Ferrus Dantioch</p>
<button type="button" id="retour" hidden>${icone('M10 6l-6 6 6 6M4 12h16')}<span id="retour-texte">Retour</span></button>
${notes ? '<section id="notes" hidden aria-labelledby="titre-notes"><h2 id="titre-notes">Notes</h2><div id="contenu-notes"></div></section>' : ''}
<script type="application/json" id="donnees">${donnees}</script>
<script>(${lecteurAutonome.toString()})();</script>
</body>
</html>
`;
}

/**
 * Les sous-schémas atteignables depuis « schema » (en suivant les liens
 * des blocs, sur plusieurs niveaux), au plus « max ». Les schémas
 * introuvables ou vides sont ignorés.
 */
export async function chargerSousSchemas(schema, max = 30) {
  const trouves = new Map();
  const aVisiter = [schema];
  const vus = new Set([schema.id]);
  while (aVisiter.length && trouves.size < max) {
    const s = aVisiter.shift();
    for (const b of listeBlocs(s)) {
      if (!b.lien || vus.has(b.lien) || trouves.size >= max) continue;
      vus.add(b.lien);
      try {
        const brut = await chargerSchema(b.lien);
        if (!brut) continue;
        const sous = migrer(brut);
        if (!listeBlocs(sous).length) continue;
        trouves.set(sous.id, sous);
        aVisiter.push(sous);
      } catch { /* sous-schéma illisible : ignoré */ }
    }
  }
  return [...trouves.values()];
}

/** Crée le fichier .html (polices comprises, sous-schémas inclus) et propose de le télécharger. */
export async function exporterHtml(schema, theme, options = {}) {
  // Oxanium pour le schéma et les boutons ; Literata seulement si les notes sont incluses.
  const css = await cssPolicesIntegrees(options.notes ? ['oxanium', 'literata'] : ['oxanium']);
  const sousSchemas = await chargerSousSchemas(schema);
  const html = construireHtml(schema, theme, { ...options, css, sousSchemas });
  telecharger(nomFichier(schema.titre, 'html'), html, 'text/html');
}

// ---------------------------------------------------------------------
// Le lecteur : ce code est COPIÉ tel quel dans le fichier exporté.
// Il ne doit donc utiliser que ce qui existe dans la page exportée
// (aucun import, aucune variable extérieure).
// ---------------------------------------------------------------------
function lecteurAutonome() {
  const donnees = JSON.parse(document.getElementById('donnees').textContent);
  const scene = document.getElementById('scene');
  const compteur = document.getElementById('compteur');
  const precedentBouton = document.getElementById('precedent');
  const suivantBouton = document.getElementById('suivant');
  const boutonNotes = document.getElementById('bouton-notes');
  const panneauNotes = document.getElementById('notes');
  const retour = document.getElementById('retour');
  // Page affichée (schéma principal ou sous-schéma) et pile des pages parentes.
  let courant = donnees.principal;
  let pile = [];
  let index = 0;
  let page = null;
  let elements = [];
  let arrets = [];

  /** Montre la page « id » (et cache les autres) à l'arrêt « i ». */
  function ouvrirPage(id, i) {
    courant = id;
    for (const p of scene.querySelectorAll('.page')) p.hidden = p.getAttribute('data-schema') !== id;
    page = scene.querySelector('.page:not([hidden])');
    elements = Array.from(page.querySelectorAll('[data-etape]'));
    arrets = donnees.pages[id].arrets;
    index = Math.max(0, Math.min(arrets.length - 1, i));
    const parent = pile[pile.length - 1];
    retour.hidden = !parent;
    if (parent) document.getElementById('retour-texte').textContent = 'Retour : ' + donnees.pages[parent.id].titre;
    afficher(null);
  }

  function afficher(arretPrecedent) {
    const arret = arrets[index];
    for (const el of elements) {
      const etape = Number(el.getAttribute('data-etape'));
      if (el.getAttribute('class') === 'surlignage-element') {
        el.style.display = arret > 0 && etape === arret ? '' : 'none';
        continue;
      }
      const visible = etape <= arret;
      el.style.display = visible ? '' : 'none';
      if (donnees.fondu && visible && arretPrecedent !== null && etape > arretPrecedent) {
        el.classList.remove('apparait');
        el.getBoundingClientRect();
        el.classList.add('apparait');
      }
    }
    compteur.textContent = (index + 1) + ' / ' + arrets.length;
    compteur.setAttribute('aria-label', 'Étape ' + (index + 1) + ' sur ' + arrets.length);
    // Dans un sous-schéma, « précédent » au début et « suivant » à la fin ramènent au parent.
    precedentBouton.disabled = index === 0 && !pile.length;
    suivantBouton.disabled = index === arrets.length - 1 && !pile.length;
    if (panneauNotes) remplirNotes(arret);
  }

  function remplirNotes(arret) {
    document.getElementById('titre-notes').textContent = arret === 0 ? 'Notes — début' : 'Notes — étape ' + (index + 1);
    const contenu = document.getElementById('contenu-notes');
    contenu.replaceChildren();
    const notes = donnees.pages[courant].notes;
    const liste = (notes && notes[arret]) || [];
    if (!liste.length) {
      const p = document.createElement('p');
      p.className = 'sans-note';
      p.textContent = 'Pas de note pour cette étape.';
      contenu.appendChild(p);
    }
    for (const n of liste) {
      const div = document.createElement('div');
      div.className = 'note';
      const nom = document.createElement('p');
      nom.className = 'note-bloc';
      nom.textContent = n.bloc;
      const texte = document.createElement('p');
      texte.className = 'note-texte';
      texte.textContent = n.texte;
      div.append(nom, texte);
      contenu.appendChild(div);
    }
  }

  const entrer = (id) => { if (!donnees.pages[id]) return; pile.push({ id: courant, index: index }); ouvrirPage(id, 0); };
  const revenir = () => { const parent = pile.pop(); if (parent) ouvrirPage(parent.id, parent.index); };
  const suivant = () => {
    if (index < arrets.length - 1) { const avant = arrets[index]; index++; afficher(avant); } else if (pile.length) revenir();
  };
  const precedent = () => { if (index > 0) { index--; afficher(null); } else if (pile.length) revenir(); };
  const allerA = (i) => { index = Math.max(0, Math.min(arrets.length - 1, i)); afficher(null); };
  /** Bloc relié (visible) sous le doigt, ou null. */
  const lienSous = (x, y) => {
    const blocs = Array.from(page.querySelectorAll('[data-lien]')).reverse();
    for (const g of blocs) {
      if (g.style.display === 'none') continue;
      const r = g.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return g.getAttribute('data-lien');
    }
    return null;
  };
  /** Touche O : le sous-schéma de l'étape (celui qui vient d'apparaître, sinon le premier visible). */
  const entrerAuClavier = () => {
    const visibles = Array.from(page.querySelectorAll('[data-lien]')).filter((g) => g.style.display !== 'none');
    const deCetteEtape = visibles.filter((g) => Number(g.getAttribute('data-etape')) === arrets[index]);
    const choix = deCetteEtape[0] || visibles[0];
    if (choix) entrer(choix.getAttribute('data-lien'));
  };
  const basculerNotes = () => {
    if (!panneauNotes) return;
    panneauNotes.hidden = !panneauNotes.hidden;
    boutonNotes.setAttribute('aria-expanded', String(!panneauNotes.hidden));
  };
  const basculerPleinEcran = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  };

  // Toucher / clic : un bloc ↗ = entrer dans son sous-schéma ; tiers gauche = retour,
  // reste = suivant ; glisser = changer de page.
  let depart = null;
  scene.addEventListener('pointerdown', (e) => { if (e.button === 0) depart = { x: e.clientX, y: e.clientY }; });
  scene.addEventListener('pointerup', (e) => {
    if (!depart) return;
    const dx = e.clientX - depart.x;
    const dy = e.clientY - depart.y;
    depart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) suivant(); else precedent(); return; }
    if (Math.hypot(dx, dy) > 20) return;
    const lien = lienSous(e.clientX, e.clientY);
    if (lien) { entrer(lien); return; }
    if (e.clientX < scene.clientWidth / 3) precedent(); else suivant();
  });
  scene.addEventListener('pointercancel', () => { depart = null; });

  precedentBouton.addEventListener('click', precedent);
  suivantBouton.addEventListener('click', suivant);
  retour.addEventListener('click', revenir);
  if (boutonNotes) boutonNotes.addEventListener('click', basculerNotes);
  document.getElementById('bouton-plein-ecran').addEventListener('click', basculerPleinEcran);

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const surBouton = e.target.closest && e.target.closest('button');
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': suivant(); break;
      case ' ': case 'Enter': if (surBouton) return; suivant(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': precedent(); break;
      case 'Home': allerA(0); break;
      case 'End': allerA(arrets.length - 1); break;
      case 'n': case 'N': basculerNotes(); break;
      case 'f': case 'F': basculerPleinEcran(); break;
      case 'o': case 'O': entrerAuClavier(); break;
      default: return;
    }
    e.preventDefault();
  });

  ouvrirPage(courant, 0);
}
