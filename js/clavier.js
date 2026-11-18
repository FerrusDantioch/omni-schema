// =====================================================================
// Raccourcis clavier (pensés pour un clavier AZERTY comme QWERTY :
// on lit la lettre produite, pas la position de la touche).
//   Ctrl+Z annuler · Ctrl+Y ou Ctrl+Maj+Z rétablir
//   Suppr / Retour arrière : supprimer · Ctrl+D : dupliquer
//   Entrée ou F2 : écrire dans le bloc / étiquette de la flèche
//   Flèches : déplacer le bloc (Maj : finement) · Alt+flèches : taille
//   N : nouveau bloc · Tab : bloc suivant · Échap : désélectionner
//   + / − : zoom · 0 : recentrer
// =====================================================================

import {
  etat, annuler, retablir, supprimerSelection, dupliquerSelection, selectionner, ajouterBloc,
  decalerSelection, agrandirSelection, valider, zoomerCentre, recentrer, rendreVisible,
} from './noyau.js';
import { trouver, listeBlocs } from './modele.js';
import { GRILLE } from './config.js';

export function installerClavier({ editeur, editerEtiquette, fermerChoix }) {
  let minuterieDeplacement = null;

  document.addEventListener('keydown', (e) => {
    // Pas de raccourci pendant la saisie, la présentation, ou quand une fenêtre est ouverte.
    if (editeur.actif() || etat.presentation) return;
    if (document.querySelector('dialog[open]')) return;
    const cible = e.target;
    if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.isContentEditable)) return;

    const ctrl = e.ctrlKey || e.metaKey;
    const touche = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const sel = trouver(etat.schema, etat.selection);

    // --- Raccourcis avec Ctrl ---
    if (ctrl) {
      if (touche === 'z' && !e.shiftKey) { e.preventDefault(); annuler(); }
      else if (touche === 'y' || (touche === 'z' && e.shiftKey)) { e.preventDefault(); retablir(); }
      else if (touche === 'd' && sel) { e.preventDefault(); dupliquerSelection(); }
      return;
    }

    // Sur un bouton ou un lien, Entrée et Espace gardent leur rôle normal.
    const surBouton = cible && cible.closest && cible.closest('button, a, select');

    switch (touche) {
      case 'Delete':
      case 'Backspace':
        if (sel) { e.preventDefault(); supprimerSelection(); }
        break;
      case 'Enter':
      case 'F2':
        if (surBouton && touche === 'Enter') return;
        if (sel && sel.type === 'bloc') { e.preventDefault(); editeur.ouvrir(sel.id); }
        else if (sel && sel.type === 'fleche') { e.preventDefault(); editerEtiquette(sel.id); }
        break;
      case 'Escape':
        fermerChoix();
        if (sel) { e.preventDefault(); selectionner(null); }
        break;
      case 'Tab': {
        // Passe d'un bloc à l'autre quand le focus est sur la zone de dessin.
        if (cible.id !== 'toile') return;
        const blocs = listeBlocs(etat.schema);
        if (!blocs.length) return;
        e.preventDefault();
        let i = blocs.findIndex((b) => b.id === etat.selection);
        i = e.shiftKey ? (i <= 0 ? blocs.length - 1 : i - 1) : (i + 1) % blocs.length;
        selectionner(blocs[i].id);
        rendreVisible(blocs[i].id);
        break;
      }
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if (!sel || sel.type !== 'bloc' || surBouton) return;
        e.preventDefault();
        const pas = e.shiftKey ? 1 : (etat.reglages.grille ? GRILLE : 10);
        const dx = touche === 'ArrowLeft' ? -pas : touche === 'ArrowRight' ? pas : 0;
        const dy = touche === 'ArrowUp' ? -pas : touche === 'ArrowDown' ? pas : 0;
        if (e.altKey) agrandirSelection(dx, dy);
        else decalerSelection(dx, dy);
        rendreVisible(sel.id);
        // Plusieurs appuis rapprochés = une seule action dans l'historique.
        clearTimeout(minuterieDeplacement);
        minuterieDeplacement = setTimeout(valider, 600);
        break;
      }
      case 'n':
        e.preventDefault();
        editeur.ouvrir(ajouterBloc().id);
        break;
      case '+':
      case '=':
        zoomerCentre(1.25);
        break;
      case '-':
      case '_':
        zoomerCentre(0.8);
        break;
      case '0':
      case 'à': // touche 0 d'un clavier AZERTY sans Maj
        recentrer();
        break;
      default:
        break;
    }
  });
}
