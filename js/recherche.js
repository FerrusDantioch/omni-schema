// =====================================================================
// Rechercher dans le schéma (bouton loupe, ou Ctrl+F).
// Trouve les blocs (texte et note), les zones (titre) et les flèches
// (étiquette) qui contiennent les mots tapés, sans tenir compte des
// majuscules ni des accents (« ecole » trouve « École »).
// Tous les résultats sont entourés ; Entrée passe au suivant, et la vue
// se centre sur lui.
// =====================================================================

import { etat, selectionner, centrerSur, demanderRendu, surChangement } from './noyau.js';
import { trouver } from './modele.js';

const $ = (id) => document.getElementById(id);

/** Minuscules, sans accents, espaces simplifiés. */
const simplifier = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/** Texte dans lequel on cherche, pour chaque sorte d'élément. */
function texteCherche(e) {
  if (e.type === 'bloc') return `${e.texte} ${e.note}`;
  if (e.type === 'zone') return e.titre;
  return e.etiquette;
}

/** Point de repère d'un élément, pour ranger les résultats dans l'ordre de lecture. */
function repere(e) {
  if (e.type !== 'fleche') return { x: e.x, y: e.y };
  const A = trouver(etat.schema, e.de);
  const B = trouver(etat.schema, e.vers);
  if (!A || !B) return { x: 0, y: 0 };
  return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
}

/** Éléments qui contiennent TOUS les mots de la recherche, de haut en bas puis de gauche à droite. */
export function chercher(schema, requete) {
  const mots = simplifier(requete).split(' ').filter(Boolean);
  if (!mots.length || !schema) return [];
  return schema.elements
    .filter((e) => { const t = simplifier(texteCherche(e)); return mots.every((m) => t.includes(m)); })
    .map((e) => ({ e, p: repere(e) }))
    .sort((a, b) => (Math.abs(a.p.y - b.p.y) > 30 ? a.p.y - b.p.y : a.p.x - b.p.x))
    .map(({ e }) => e.id);
}

export function installerRecherche({ avantOuverture = () => {} } = {}) {
  const barre = $('barre-recherche');
  const champ = $('champ-recherche');
  const compte = $('compte-recherche');
  let resultats = [];
  let index = -1;

  function majCompte() {
    if (!champ.value.trim()) compte.textContent = '';
    else if (!resultats.length) compte.textContent = 'Aucun résultat';
    else compte.textContent = `${index + 1} / ${resultats.length}`;
    $('rech-precedent').disabled = resultats.length < 2;
    $('rech-suivant').disabled = resultats.length < 2;
  }

  function appliquer() {
    etat.recherche = resultats.length ? { ids: new Set(resultats), actuel: resultats[index] } : null;
    demanderRendu();
    majCompte();
  }

  /** Va au résultat n° i (choisi et centré à l'écran). */
  function aller(i) {
    if (!resultats.length) return;
    index = (i + resultats.length) % resultats.length;
    const id = resultats[index];
    selectionner(id);
    centrerSur(id);
    appliquer();
  }

  function relancer() {
    const avant = resultats[index];
    resultats = chercher(etat.schema, champ.value);
    const garde = resultats.indexOf(avant);
    index = garde >= 0 ? garde : (resultats.length ? 0 : -1);
  }

  function ouvrir() {
    avantOuverture();
    barre.hidden = false;
    $('btn-rechercher').setAttribute('aria-expanded', 'true');
    champ.focus();
    champ.select();
    if (champ.value.trim()) { relancer(); appliquer(); }
  }

  function fermer() {
    if (barre.hidden) return;
    barre.hidden = true;
    $('btn-rechercher').setAttribute('aria-expanded', 'false');
    etat.recherche = null;
    demanderRendu();
    $('toile').focus({ preventScroll: true });
  }

  champ.addEventListener('input', () => {
    relancer();
    if (resultats.length) aller(index); else appliquer();
  });
  champ.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); aller(e.shiftKey ? index - 1 : index + 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermer(); }
  });
  $('rech-suivant').addEventListener('click', () => aller(index + 1));
  $('rech-precedent').addEventListener('click', () => aller(index - 1));
  $('rech-fermer').addEventListener('click', fermer);
  $('btn-rechercher').addEventListener('click', () => (barre.hidden ? ouvrir() : fermer()));

  // Le schéma change (texte modifié, autre schéma ouvert…) : on met les résultats à jour.
  surChangement(() => {
    if (barre.hidden || !champ.value.trim()) return;
    const avant = resultats.join('|');
    relancer();
    if (resultats.join('|') !== avant) appliquer();
  });

  return { ouvrir, fermer, ouverte: () => !barre.hidden };
}
