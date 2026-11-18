// =====================================================================
// Panneau « Étapes » : voir d'un coup d'œil ce qui apparaît à quelle
// étape, déplacer un élément d'une étape à l'autre, réordonner les
// étapes, numéroter automatiquement, choisir le thème de présentation.
// Chaque changement passe par valider() : il est donc annulable.
// =====================================================================

import { etat, valider, selectionner, rendreVisible, programmerSauvegarde, notifier } from './noyau.js';
import {
  compacter, echangerEtapes, numeroterAutomatiquement, retirerEtapes, nomElement, etapeMax,
} from './etapes.js';

const $ = (id) => document.getElementById(id);

export function creerPanneauEtapes({ demanderConfirmation, presenter }) {
  const dialogue = $('dlg-etapes');
  const liste = $('liste-etapes');

  function ouvrir() {
    remplir();
    if (!dialogue.open) dialogue.showModal();
  }

  /** Applique un changement, renumérote sans trou, enregistre et redessine la liste. */
  function changer(action) {
    action();
    compacter(etat.schema);
    valider();
    remplir();
  }

  function remplir() {
    const schema = etat.schema;
    const max = etapeMax(schema);
    liste.replaceChildren();

    // Une flèche suit ses blocs : on ne la liste que si on l'a volontairement
    // fait apparaître PLUS TARD que ses deux blocs (sinon la liste serait encombrée).
    const parId = new Map(schema.elements.filter((e) => e.type === 'bloc').map((b) => [b.id, b]));
    const flecheRetardee = (f) => {
      const A = parId.get(f.de), B = parId.get(f.vers);
      return (f.etape || 0) > Math.max(A ? A.etape : 0, B ? B.etape : 0);
    };
    const listee = (e) => e.type === 'bloc' || flecheRetardee(e);

    // Groupes : 0 (toujours visible), puis 1…max.
    for (let n = 0; n <= max; n++) {
      const membres = schema.elements.filter((e) => (e.etape || 0) === n && listee(e));
      if (n > 0 && !membres.length) continue;
      const section = document.createElement('section');
      section.className = 'groupe-etape';

      const entete = document.createElement('div');
      entete.className = 'entete-etape';
      const titre = document.createElement('h3');
      titre.className = 'etiquette-section';
      titre.textContent = n === 0 ? 'Toujours visible' : `Étape ${n}`;
      entete.appendChild(titre);
      if (n > 0) {
        entete.append(
          bouton('↑', `Placer l'étape ${n} avant`, n === 1, () => changer(() => echangerEtapes(schema, n, n - 1))),
          bouton('↓', `Placer l'étape ${n} après`, n === max, () => changer(() => echangerEtapes(schema, n, n + 1))),
        );
      }
      section.appendChild(entete);

      const ul = document.createElement('ul');
      ul.className = 'elements-etape';
      if (!membres.length) {
        const vide = document.createElement('li');
        vide.className = 'etape-vide';
        vide.textContent = 'Aucun élément.';
        ul.appendChild(vide);
      }
      for (const e of membres) {
        const li = document.createElement('li');
        const nom = document.createElement('button');
        nom.type = 'button';
        nom.className = 'nom-element';
        nom.textContent = nomElement(schema, e, 34);
        nom.title = 'Choisir cet élément sur le schéma';
        nom.addEventListener('click', () => {
          dialogue.close();
          selectionner(e.id);
          if (e.type === 'bloc') rendreVisible(e.id);
        });
        li.append(
          nom,
          bouton('−', 'Faire apparaître plus tôt', n === 0, () => changer(() => { e.etape = Math.max(0, n - 1); })),
          bouton('+', 'Faire apparaître plus tard', false, () => changer(() => { e.etape = n + 1; })),
        );
        ul.appendChild(li);
      }
      section.appendChild(ul);
      liste.appendChild(section);
    }

    // Thème de présentation de ce schéma.
    for (const r of dialogue.querySelectorAll('input[name="theme-presentation"]')) r.checked = r.value === (schema.theme || 'auto');
  }

  function bouton(symbole, libelle, desactive, action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bouton-icone petit-bouton';
    b.textContent = symbole;
    b.setAttribute('aria-label', libelle);
    b.title = libelle;
    b.disabled = desactive;
    b.addEventListener('click', action);
    return b;
  }

  $('btn-numeroter').addEventListener('click', async () => {
    const ok = await demanderConfirmation('Numéroter automatiquement ? Chaque bloc aura sa propre étape, dans l\'ordre de lecture (de haut en bas, puis de gauche à droite). Les étapes actuelles seront remplacées.', 'Numéroter');
    if (ok) changer(() => numeroterAutomatiquement(etat.schema));
    if (!dialogue.open) ouvrir();
  });
  $('btn-retirer-etapes').addEventListener('click', async () => {
    const ok = await demanderConfirmation('Retirer toutes les étapes ? Tout le schéma s\'affichera d\'un coup en présentation.', 'Retirer');
    if (ok) changer(() => retirerEtapes(etat.schema));
    if (!dialogue.open) ouvrir();
  });
  $('btn-presenter-etapes').addEventListener('click', () => { dialogue.close(); presenter(); });

  dialogue.addEventListener('change', (e) => {
    if (e.target.name !== 'theme-presentation') return;
    etat.schema.theme = e.target.value;
    etat.schema.modifie_le = new Date().toISOString();
    programmerSauvegarde();
    notifier();
  });

  return { ouvrir, remplir };
}
