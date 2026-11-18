// =====================================================================
// Annuler / rétablir, par « instantanés ».
//
// Principe : après chaque action terminée (ajout, déplacement, texte
// validé…), on photographie la liste des éléments du schéma sous forme
// de texte JSON. Annuler = revenir à la photo précédente.
// C'est simple et très fiable : impossible d'oublier d'annuler un détail,
// puisque tout l'état est photographié. Pour quelques centaines de
// blocs, chaque photo pèse quelques dizaines de Ko : c'est léger.
// =====================================================================

export function creerHistorique(limite = 150) {
  let passe = [];    // photos des états précédents
  let futur = [];    // photos annulées, que l'on peut rétablir
  let courant = null; // photo de l'état validé actuel

  return {
    /** Repart de zéro (à l'ouverture d'un schéma). */
    reinitialiser(etat) {
      passe = [];
      futur = [];
      courant = etat;
    },
    /** Enregistre un nouvel état validé. Renvoie false s'il n'a pas changé. */
    valider(etat) {
      if (etat === courant) return false;
      passe.push(courant);
      if (passe.length > limite) passe.shift();
      courant = etat;
      futur = [];
      return true;
    },
    /** Renvoie l'état précédent (ou null s'il n'y en a pas). */
    annuler() {
      if (!passe.length) return null;
      futur.push(courant);
      courant = passe.pop();
      return courant;
    },
    /** Renvoie l'état suivant (ou null). */
    retablir() {
      if (!futur.length) return null;
      passe.push(courant);
      courant = futur.pop();
      return courant;
    },
    courant: () => courant,
    peutAnnuler: () => passe.length > 0,
    peutRetablir: () => futur.length > 0,
  };
}
