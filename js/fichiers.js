// =====================================================================
// Export et import de fichiers .json.
// - « Exporter ce schéma » : un fichier pour un seul schéma
//   (pour l'envoyer à quelqu'un ou le passer sur un autre appareil).
// - « Sauvegarder tous mes schémas » : un seul fichier avec tout.
// L'import accepte les deux. Un schéma importé ne remplace JAMAIS un
// schéma existant : en cas de doublon, on crée une copie.
// Un schéma exporté emporte ses sous-schémas (champ « sous_schemas ») :
// à l'import, ils sont recréés et les liens des blocs restent justes.
// =====================================================================

import { APP_VERSION, VERSION_FORMAT } from './config.js';
import { migrer, nouvelId, listeBlocs } from './modele.js';
import { listerSchemas, enregistrerSchema, chargerSchema, listerModeles, enregistrerModele, chargerModele } from './stockage.js';

/** Fabrique un nom de fichier sûr à partir d'un titre. */
export function nomFichier(titre, extension) {
  const propre = String(titre || 'schema')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // retire les accents
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .toLowerCase().slice(0, 60) || 'schema';
  const date = new Date().toISOString().slice(0, 10);
  return `${propre}-${date}.${extension}`;
}

/** Propose le téléchargement d'un fichier créé dans la page (rien n'est envoyé). */
export function telecharger(nom, contenu, type) {
  const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Copie du schéma sans les images qui ne servent plus (retirées ou remplacées). */
export function sansImagesInutiles(schema) {
  const utilisees = new Set(schema.elements.filter((e) => e.type === 'bloc' && e.image).map((e) => e.image));
  const images = {};
  for (const [id, donnees] of Object.entries(schema.images || {})) if (utilisees.has(id)) images[id] = donnees;
  return { ...schema, images };
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

/**
 * Exporte un schéma en .json, avec ses sous-schémas (sur plusieurs
 * niveaux). Renvoie le nombre de sous-schémas emportés.
 */
export async function exporterSchema(schema) {
  const sous = await chargerSousSchemas(schema);
  const contenu = { ...sansImagesInutiles(schema) };
  if (sous.length) contenu.sous_schemas = sous.map(sansImagesInutiles);
  telecharger(nomFichier(schema.titre, 'json'), JSON.stringify(contenu, null, 2), 'application/json');
  return sous.length;
}

export async function exporterTout() {
  const schemas = await listerSchemas();
  const modeles = await listerModeles();
  const sauvegarde = {
    format: 'omni-schema-sauvegarde',
    version_format: VERSION_FORMAT,
    version_app: APP_VERSION,
    date: new Date().toISOString(),
    schemas,
    modeles, // modèles personnels (depuis la version 1.3.0)
  };
  telecharger(nomFichier('omni-schema-sauvegarde', 'json'), JSON.stringify(sauvegarde, null, 2), 'application/json');
  return schemas.length;
}

/**
 * Lit un fichier choisi par l'utilisateur et enregistre son ou ses
 * schémas. Renvoie la liste des schémas importés.
 */
export async function importerFichier(fichier) {
  if (fichier.size > 20 * 1024 * 1024) throw new Error('Ce fichier est trop gros (plus de 20 Mo).');
  let donnees;
  try {
    donnees = JSON.parse(await fichier.text());
  } catch {
    throw new Error('Ce fichier n\'est pas un fichier .json valide.');
  }

  let bruts;
  let sousSchemas = [];
  if (donnees && donnees.format === 'omni-schema-sauvegarde' && Array.isArray(donnees.schemas)) bruts = donnees.schemas;
  else if (donnees && Array.isArray(donnees.elements)) {
    bruts = [donnees];
    // Schéma partagé avec ses sous-schémas (depuis la version 1.7.0).
    if (Array.isArray(donnees.sous_schemas)) sousSchemas = donnees.sous_schemas.slice(0, 100);
  } else throw new Error('Ce fichier ne vient pas d\'omni-schema.');

  const importes = [];
  const erreurs = [];
  // Modèles personnels d'une sauvegarde : ajoutés sans rien remplacer.
  let modelesImportes = 0;
  if (donnees.format === 'omni-schema-sauvegarde' && Array.isArray(donnees.modeles)) {
    for (const brut of donnees.modeles) {
      try {
        const modele = migrer(brut);
        const existant = await chargerModele(modele.id);
        if (existant && JSON.stringify(existant.elements) === JSON.stringify(modele.elements)) continue; // déjà là
        if (existant) modele.id = nouvelId('m');
        await enregistrerModele(modele);
        modelesImportes++;
      } catch (erreur) {
        erreurs.push(erreur.message);
      }
    }
  }
  // Les schémas du fichier, convertis ; ceux dont l'identifiant existe
  // déjà ici reçoivent un nouvel identifiant (jamais d'écrasement), et les
  // liens des blocs vers eux sont rebranchés.
  const lus = [];
  for (const [i, brut] of [...bruts, ...sousSchemas].entries()) {
    try {
      lus.push({ schema: migrer(brut), principal: i < bruts.length });
    } catch (erreur) {
      erreurs.push(erreur.message);
    }
  }
  const nouveauxIds = new Map();
  for (const { schema, principal } of lus) {
    if (await chargerSchema(schema.id) || nouveauxIds.has(schema.id)) {
      const ancien = schema.id;
      schema.id = nouvelId('s');
      nouveauxIds.set(ancien, schema.id);
      if (principal) schema.titre = `${schema.titre} (importé)`;
    }
  }
  let sousImportes = 0;
  for (const { schema, principal } of lus) {
    for (const b of listeBlocs(schema)) if (b.lien && nouveauxIds.has(b.lien)) b.lien = nouveauxIds.get(b.lien);
    schema.modifie_le = new Date().toISOString();
    try {
      await enregistrerSchema(schema);
      if (principal) importes.push(schema); else sousImportes++;
    } catch (erreur) {
      erreurs.push(erreur.message);
    }
  }
  if (!importes.length && !modelesImportes) throw new Error(erreurs[0] || 'Aucun schéma n\'a pu être importé.');
  return { importes, erreurs, modelesImportes, sousImportes };
}
