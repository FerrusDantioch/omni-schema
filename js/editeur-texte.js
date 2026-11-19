// =====================================================================
// Édition du texte « dans le bloc ».
// Un champ de saisie (textarea) est posé exactement par-dessus le bloc,
// aux mêmes couleurs. Le texte du bloc se met à jour à chaque lettre.
// On valide en touchant ailleurs, avec Échap ou Ctrl+Entrée.
// (Entrée seule ajoute un retour à la ligne.)
// =====================================================================

import { etat, demanderRendu, valider, rendreVisible, surRendu } from './noyau.js';
import { trouver, tailleTexte } from './modele.js';
import { zoneTexte } from './geometrie.js';
import { couleurBloc, couleursToile } from './couleurs.js';
import { mettreEnPage, INTERLIGNE } from './texte.js';
import { POLICE, GRAISSE } from './config.js';

export function creerEditeurTexte(champ) {
  let idBloc = null;

  function ouvrir(id) {
    const b = trouver(etat.schema, id);
    if (!b || b.type !== 'bloc') return;
    if (idBloc) terminer();
    idBloc = id;
    etat.editionId = id;
    etat.selection = id;
    champ.value = b.texte;
    champ.hidden = false;
    rendreVisible(id);
    placer();
    demanderRendu();
    champ.focus({ preventScroll: true });
    // Curseur à la fin du texte.
    champ.setSelectionRange(champ.value.length, champ.value.length);
  }

  /** Aligne le champ sur la zone de texte du bloc (suit le zoom). */
  function placer() {
    if (!idBloc) return;
    const b = trouver(etat.schema, idBloc);
    if (!b) { terminer(); return; }
    const { x, y, k } = etat.vue;
    const zone = zoneTexte(b);
    const c = couleurBloc(etat.themeResolu, b.couleur);
    // Même taille de texte et même centrage vertical que dans le bloc :
    // ce que tu tapes est exactement ce que tu verras.
    const mise = mettreEnPage(b.texte || 'a', zone.largeur, zone.hauteur, tailleTexte(b));
    const nbLignes = Math.max(1, mise.lignes.length);
    const vide = Math.max(0, (zone.hauteur - nbLignes * mise.taille * INTERLIGNE) / 2);
    const s = champ.style;
    s.left = `${zone.x * k + x}px`;
    s.top = `${zone.y * k + y}px`;
    s.width = `${Math.max(40, zone.largeur * k)}px`;
    s.height = `${Math.max(32, zone.hauteur * k)}px`;
    s.paddingTop = `${vide * k}px`;
    s.fontSize = `${Math.max(9, mise.taille * k)}px`;
    s.fontFamily = POLICE;
    s.fontWeight = GRAISSE;
    s.color = c.texte;
    // Bloc sans cadre : le champ prend la couleur du fond de la toile.
    s.background = b.forme === 'texte' ? couleursToile(etat.themeResolu).fond : c.fond;
    s.caretColor = c.bord;
  }

  function terminer() {
    if (!idBloc) return;
    const b = trouver(etat.schema, idBloc);
    if (b) b.texte = champ.value.replace(/\s+$/, '');
    idBloc = null;
    etat.editionId = null;
    champ.hidden = true;
    valider(); // une seule entrée d'historique pour toute la saisie
  }

  champ.addEventListener('input', () => {
    const b = trouver(etat.schema, idBloc);
    if (!b) return;
    b.texte = champ.value;
    demanderRendu();
  });
  champ.addEventListener('blur', terminer);
  champ.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      e.stopPropagation();
      const id = idBloc;
      champ.blur(); // déclenche terminer()
      if (id) document.getElementById('toile').focus({ preventScroll: true });
    }
  });

  // Après chaque dessin (zoom, déplacement…), on replace le champ.
  surRendu(placer);
  // Quand le clavier du téléphone apparaît, la zone rétrécit : on garde le bloc visible.
  window.addEventListener('resize', () => { if (idBloc) { rendreVisible(idBloc); placer(); } });

  return { ouvrir, terminer, actif: () => idBloc !== null };
}
