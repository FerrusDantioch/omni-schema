// =====================================================================
// Raccourcis clavier (pensés pour un clavier AZERTY comme QWERTY :
// on lit la lettre produite, pas la position de la touche).
//   Ctrl+Z annuler · Ctrl+Y ou Ctrl+Maj+Z rétablir
//   Tab / Maj+Tab : élément suivant / précédent (blocs, puis flèches)
//   Entrée ou F2 : écrire dans le bloc / étiquette de la flèche
//   Flèches : déplacer le bloc (Maj : finement) · Alt+flèches : taille
//   N : nouveau bloc · R : bloc relié à droite · Maj+R : relié en dessous
//   L : relier le bloc choisi à un autre (Tab pour viser, Entrée pour valider)
//   E : étape de l'élément · P : présenter · ? : aide
//   Suppr : supprimer · Ctrl+D : dupliquer · Échap : désélectionner
//   Ctrl+C / Ctrl+X / Ctrl+V : copier / couper / coller (voir presse-papiers.js)
//   + / − : zoom · 0 : recentrer
// =====================================================================

import {
  etat, annuler, retablir, supprimerSelection, dupliquerSelection, selectionner, ajouterBloc, relier, toutSelectionner,
  decalerSelection, agrandirSelection, valider, zoomerCentre, recentrer, rendreVisible, demanderRendu,
} from './noyau.js';
import { trouver, listeBlocs, listeFleches } from './modele.js';
import { nomElement } from './etapes.js';
import { GRILLE } from './config.js';

/** Annonce discrète pour les lecteurs d'écran (sans bulle visible). */
export function annoncerLecteur(message) {
  const zone = document.getElementById('annonce-lecteur');
  if (!zone) return;
  zone.textContent = '';
  // Petit délai : garantit que le lecteur d'écran remarque le changement.
  setTimeout(() => { zone.textContent = message; }, 30);
}

/** Description d'un élément pour les lecteurs d'écran. */
function decrire(e) {
  if (!e) return 'Aucun élément choisi.';
  const etape = e.etape > 0 ? `, étape ${e.etape}` : '';
  return `${nomElement(etat.schema, e, 80)}${etape}.`;
}

export function installerClavier({ editeur, editerEtiquette, fermerChoix, ouvrirAide, presenter, presenterDeuxEcrans }) {
  let minuterieDeplacement = null;
  let liaison = null; // { de } pendant « L » : on choisit le bloc d'arrivée

  const toile = document.getElementById('toile');

  function choisir(id) {
    selectionner(id);
    const e = trouver(etat.schema, id);
    if (e && e.type === 'bloc') rendreVisible(id);
    if (liaison) {
      etat.liaison = { de: liaison.de, x: null, y: null, cible: id && id !== liaison.de ? id : null };
      demanderRendu();
      annoncerLecteur(`Relier vers : ${decrire(e)} Entrée pour valider, Échap pour annuler.`);
    } else {
      annoncerLecteur(decrire(e));
    }
  }

  function terminerLiaison(valide) {
    if (!liaison) return;
    const de = liaison.de;
    const cible = etat.liaison && etat.liaison.cible;
    liaison = null;
    etat.liaison = null;
    if (valide && cible && relier(de, cible)) {
      valider();
      annoncerLecteur('Flèche créée.');
    } else {
      demanderRendu();
      annoncerLecteur('Liaison annulée.');
    }
    selectionner(de);
  }

  /** Crée un bloc relié au bloc choisi, à droite ou en dessous, et l'ouvre en écriture. */
  function blocRelie(enDessous) {
    const source = trouver(etat.schema, etat.selection);
    if (!source || source.type !== 'bloc') return;
    const ecart = 80;
    const point = enDessous
      ? { x: source.x + source.largeur / 2, y: source.y + source.hauteur + ecart + source.hauteur / 2 }
      : { x: source.x + source.largeur + ecart + source.largeur / 2, y: source.y + source.hauteur / 2 };
    // Si la place est prise, on glisse vers le bas (à droite) ou vers la droite (en dessous).
    const decalage = enDessous ? { x: GRILLE, y: 0 } : { x: 0, y: GRILLE };
    const nouveau = ajouterBloc(point, { forme: source.forme, couleur: source.couleur, largeur: source.largeur, hauteur: source.hauteur }, { sansValider: true, decalage });
    relier(source.id, nouveau.id);
    valider();
    rendreVisible(nouveau.id);
    editeur.ouvrir(nouveau.id);
  }

  // Un toucher ou un clic pendant une liaison au clavier l'annule.
  document.addEventListener('pointerdown', () => { if (liaison) terminerLiaison(false); }, true);

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
      else if (touche === 'd' && (sel || etat.groupe)) { e.preventDefault(); dupliquerSelection(); }
      else if (touche === 'a') {
        e.preventDefault();
        toutSelectionner();
        annoncerLecteur(`${(etat.groupe || []).length} blocs sélectionnés.`);
      }
      return;
    }

    // Un panneau (Style, Étape) est ouvert : Échap le ferme et rend le focus à son bouton.
    const panneauOuvert = document.querySelector('.choix:not([hidden])');
    if (panneauOuvert && touche === 'Escape') {
      e.preventDefault();
      const bouton = document.querySelector(`[aria-controls="${panneauOuvert.id}"][aria-expanded="true"]`);
      fermerChoix();
      if (bouton) bouton.focus();
      return;
    }

    // Mode « relier au clavier ».
    if (liaison) {
      if (touche === 'Enter') { e.preventDefault(); terminerLiaison(true); return; }
      if (touche === 'Escape') { e.preventDefault(); terminerLiaison(false); return; }
    }

    // Sur un bouton ou un lien, Entrée et Espace gardent leur rôle normal.
    const surBouton = cible && cible.closest && cible.closest('button, a, select');
    const surToile = cible === toile || cible === document.body;

    switch (touche) {
      case 'Delete':
      case 'Backspace':
        if (etat.groupe && !surBouton) { e.preventDefault(); supprimerSelection(); annoncerLecteur('Blocs supprimés. Ctrl+Z pour annuler.'); break; }
        if (sel && !surBouton) { e.preventDefault(); supprimerSelection(); annoncerLecteur('Élément supprimé. Ctrl+Z pour annuler.'); }
        break;
      case 'Enter':
      case 'F2':
        if (surBouton && touche === 'Enter') return;
        if (sel && sel.type === 'bloc') { e.preventDefault(); editeur.ouvrir(sel.id); }
        else if (sel && sel.type === 'fleche') { e.preventDefault(); editerEtiquette(sel.id); }
        break;
      case 'Escape':
        fermerChoix();
        if (etat.groupe) { e.preventDefault(); selectionner(null); annoncerLecteur('Sélection multiple terminée.'); break; }
        if (sel) { e.preventDefault(); selectionner(null); annoncerLecteur('Sélection retirée.'); }
        break;
      case 'Tab': {
        // Parcourt les éléments quand le focus est sur la zone de dessin.
        if (!surToile) return;
        const blocs = listeBlocs(etat.schema);
        // Pendant une liaison, seuls les blocs comptent ; sinon blocs puis flèches.
        const ordre = liaison ? blocs.filter((b) => b.id !== liaison.de) : blocs.concat(listeFleches(etat.schema));
        if (!ordre.length) return;
        e.preventDefault();
        const actuel = liaison ? (etat.liaison && etat.liaison.cible) : etat.selection;
        let i = ordre.findIndex((x) => x.id === actuel);
        i = e.shiftKey ? (i <= 0 ? ordre.length - 1 : i - 1) : (i + 1) % ordre.length;
        if (liaison) {
          etat.liaison = { de: liaison.de, x: null, y: null, cible: ordre[i].id };
          rendreVisible(ordre[i].id);
          demanderRendu();
          annoncerLecteur(`Relier vers : ${decrire(ordre[i])} Entrée pour valider, Échap pour annuler.`);
        } else {
          choisir(ordre[i].id);
        }
        break;
      }
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if ((!etat.groupe && (!sel || sel.type !== 'bloc')) || surBouton) return;
        e.preventDefault();
        const pas = e.shiftKey ? 1 : (etat.reglages.grille ? GRILLE : 10);
        const dx = touche === 'ArrowLeft' ? -pas : touche === 'ArrowRight' ? pas : 0;
        const dy = touche === 'ArrowUp' ? -pas : touche === 'ArrowDown' ? pas : 0;
        if (e.altKey && !etat.groupe) agrandirSelection(dx, dy);
        else decalerSelection(dx, dy);
        if (sel) rendreVisible(sel.id);
        // Plusieurs appuis rapprochés = une seule action dans l'historique.
        clearTimeout(minuterieDeplacement);
        minuterieDeplacement = setTimeout(valider, 600);
        break;
      }
      case 'n':
        e.preventDefault();
        editeur.ouvrir(ajouterBloc().id);
        break;
      case 'r':
        if (!sel || sel.type !== 'bloc') return;
        e.preventDefault();
        blocRelie(e.shiftKey);
        break;
      case 'l':
        if (!sel || sel.type !== 'bloc' || listeBlocs(etat.schema).length < 2) return;
        e.preventDefault();
        liaison = { de: sel.id };
        etat.liaison = { de: sel.id, x: null, y: null, cible: null };
        toile.focus({ preventScroll: true });
        annoncerLecteur('Relier : appuie sur Tab pour choisir le bloc d\'arrivée, puis Entrée. Échap pour annuler.');
        break;
      case 'e': {
        if (!sel && !etat.groupe) return;
        const bouton = document.querySelector(`.groupe-outils[data-pour="${etat.groupe ? 'groupe' : sel.type}"] [data-bouton-etape]`);
        if (bouton) { e.preventDefault(); bouton.click(); }
        break;
      }
      case 'p':
        e.preventDefault();
        if (e.shiftKey) presenterDeuxEcrans(); else presenter();
        break;
      case '?':
        e.preventDefault();
        ouvrirAide();
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
