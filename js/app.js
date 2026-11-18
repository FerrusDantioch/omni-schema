// =====================================================================
// Point d'entrée de l'application : assemble les morceaux et ouvre le
// dernier schéma utilisé (ou crée le schéma d'accueil au 1er lancement).
// =====================================================================

import { CLE_DERNIER } from './config.js';
import { creerRendu } from './rendu.js';
import { etat, brancherRendu, ouvrirSchema, sauvegarderMaintenant, demanderRendu, annoncer } from './noyau.js';
import { creerSchemaAccueil, migrer } from './modele.js';
import { listerSchemas, chargerSchema, enregistrerSchema, demanderStockagePersistant } from './stockage.js';
import { installerGestes } from './interactions.js';
import { creerEditeurTexte } from './editeur-texte.js';
import { installerInterface, appliquerTheme, editerEtiquette, fermerChoix, demanderConfirmation } from './interface.js';
import { creerPresentation } from './presentation.js';
import { creerPanneauEtapes } from './panneau-etapes.js';
import { installerClavier } from './clavier.js';
import { installerMiseAJour } from './mise-a-jour.js';

const svg = document.getElementById('toile');

async function demarrer() {
  appliquerTheme();

  const rendu = creerRendu(svg);
  brancherRendu(rendu);

  const editeur = creerEditeurTexte(document.getElementById('editeur-texte'));
  const presentation = creerPresentation({
    apresFermeture: () => { svg.focus({ preventScroll: true }); demanderRendu(); },
  });
  const panneauEtapes = creerPanneauEtapes({
    demanderConfirmation,
    presenter: () => document.getElementById('btn-presenter').click(),
  });
  installerInterface({ editeur, presentation, panneauEtapes });
  installerGestes(svg, {
    editerTexte: (id) => editeur.ouvrir(id),
    editerEtiquette,
    avantGeste: () => { editeur.terminer(); fermerChoix(); },
  });
  installerClavier({ editeur, editerEtiquette, fermerChoix });
  installerMiseAJour({
    bouton: document.getElementById('btn-maj'),
    avantRechargement: async () => { editeur.terminer(); await sauvegarderMaintenant(); },
  });

  // Quand la taille de l'écran change (rotation, clavier…), on redessine.
  new ResizeObserver(() => demanderRendu()).observe(svg);

  // Sauvegarde immédiate quand on quitte ou qu'on change d'application.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { editeur.terminer(); sauvegarderMaintenant(); }
  });
  window.addEventListener('pagehide', () => { sauvegarderMaintenant(); });

  await ouvrirPremierSchema();
  demanderStockagePersistant();
}

/** Ouvre le dernier schéma utilisé, sinon le plus récent, sinon le schéma d'accueil. */
async function ouvrirPremierSchema() {
  let schema = null;
  try {
    const dernier = localStorage.getItem(CLE_DERNIER);
    if (dernier) schema = await chargerSchema(dernier);
    if (!schema) schema = (await listerSchemas())[0] || null;
    if (schema) schema = migrer(schema);
  } catch (erreur) {
    console.error(erreur);
    annoncer('Impossible de lire tes schémas enregistrés sur cet appareil.', 6000);
  }
  if (!schema) {
    schema = creerSchemaAccueil();
    try { await enregistrerSchema(schema); } catch (erreur) { console.error(erreur); }
  }
  ouvrirSchema(schema);
}

demarrer().catch((erreur) => {
  console.error(erreur);
  annoncer(`Erreur au démarrage : ${erreur.message}`, 10000);
});

// Accès pratique pour le débogage dans la console du navigateur.
window.omniSchema = { etat };
