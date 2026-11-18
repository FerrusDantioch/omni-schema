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
import { installerInterface, appliquerTheme, editerEtiquette, fermerChoix, demanderConfirmation, ouvrirAide } from './interface.js';
import { creerPresentation } from './presentation.js';
import { creerPanneauEtapes } from './panneau-etapes.js';
import { creerVuePresentateur, demarrerPublic } from './presentateur.js';
import { installerClavier } from './clavier.js';
import { installerMiseAJour } from './mise-a-jour.js';
import { attendrePolices } from './polices.js';
import { viderCacheTexte } from './texte.js';

const svg = document.getElementById('toile');

async function demarrer() {
  appliquerTheme();

  const rendu = creerRendu(svg);
  brancherRendu(rendu);

  const editeur = creerEditeurTexte(document.getElementById('editeur-texte'));
  const presentation = creerPresentation({
    apresFermeture: () => { svg.focus({ preventScroll: true }); demanderRendu(); },
  });
  const vuePresentateur = creerVuePresentateur({
    annoncer,
    apresFermeture: () => { svg.focus({ preventScroll: true }); demanderRendu(); },
  });
  const presenterDeuxEcrans = async () => {
    editeur.terminer();
    fermerChoix();
    await sauvegarderMaintenant(); // la fenêtre public relit le schéma enregistré
    if (!(await vuePresentateur.ouvrir())) annoncer('Ajoute au moins un bloc avant de présenter.');
  };
  const panneauEtapes = creerPanneauEtapes({
    demanderConfirmation,
    presenter: () => document.getElementById('btn-presenter').click(),
    presenterDeuxEcrans,
  });
  installerInterface({ editeur, presentation, panneauEtapes });
  installerGestes(svg, {
    editerTexte: (id) => editeur.ouvrir(id),
    editerEtiquette,
    avantGeste: () => { editeur.terminer(); fermerChoix(); },
  });
  installerClavier({
    editeur, editerEtiquette, fermerChoix, ouvrirAide,
    presenter: () => document.getElementById('btn-presenter').click(),
    presenterDeuxEcrans,
  });
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

  // Le texte des blocs est mesuré avec la police Oxanium : on attend qu'elle soit prête.
  await attendrePolices();
  // Si une police arrive plus tard (appareil lent), on refait la mise en page.
  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', () => { viderCacheTexte(); rendu.vider(); demanderRendu(); });
  }
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

// « ?public=<id> » : fenêtre destinée au public (mode présentateur à deux écrans).
// Elle n'affiche que le schéma et ne modifie jamais rien.
const idPublic = new URLSearchParams(window.location.search).get('public');
const lancement = idPublic
  ? (async () => { appliquerTheme(); await attendrePolices(); await demarrerPublic(idPublic); })()
  : demarrer();
lancement.catch((erreur) => {
  console.error(erreur);
  annoncer(`Erreur au démarrage : ${erreur.message}`, 10000);
});

// Accès pratique pour le débogage dans la console du navigateur.
window.omniSchema = { etat };
