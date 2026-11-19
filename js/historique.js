// =====================================================================
// Annuler / rétablir, par « instantanés ».
//
// Principe : après chaque action terminée (ajout, déplacement, texte
// validé…), on photographie la liste des éléments du schéma sous forme
// de texte JSON. Annuler = revenir à la photo précédente.
// C'est simple et très fiable : impossible d'oublier d'annuler un détail,
// puisque tout l'état est photographié. Pour quelques centaines de
// blocs, chaque photo pèse quelques dizaines de Ko : c'est léger.
//
// Chaque action retient aussi la sélection AVANT et APRÈS elle : annuler
// remet la sélection d'avant (ex. annuler la duplication d'un groupe
// re-sélectionne le groupe d'origine), rétablir remet celle d'après.
// =====================================================================

export function creerHistorique(limite = 150) {
  let passe = [];    // actions passées : { photo (état d'avant), avant, apres }
  let futur = [];    // actions annulées, que l'on peut rétablir : { photo (état d'après), avant, apres }
  let courant = null; // photo de l'état validé actuel

  return {
    /** Repart de zéro (à l'ouverture d'un schéma). */
    reinitialiser(etat) {
      passe = [];
      futur = [];
      courant = etat;
    },
    /**
     * Enregistre un nouvel état validé. « avant » et « apres » décrivent
     * la sélection autour de l'action. Renvoie false si rien n'a changé.
     */
    valider(etat, avant = null, apres = null) {
      if (etat === courant) return false;
      passe.push({ photo: courant, avant, apres });
      if (passe.length > limite) passe.shift();
      courant = etat;
      futur = [];
      return true;
    },
    /** Revient à l'état précédent. Renvoie { photo, selection } ou null. */
    annuler() {
      if (!passe.length) return null;
      const action = passe.pop();
      futur.push({ photo: courant, avant: action.avant, apres: action.apres });
      courant = action.photo;
      return { photo: courant, selection: action.avant };
    },
    /** Refait l'action annulée. Renvoie { photo, selection } ou null. */
    retablir() {
      if (!futur.length) return null;
      const action = futur.pop();
      passe.push({ photo: courant, avant: action.avant, apres: action.apres });
      courant = action.photo;
      return { photo: courant, selection: action.apres };
    },
    courant: () => courant,
    peutAnnuler: () => passe.length > 0,
    peutRetablir: () => futur.length > 0,
  };
}
