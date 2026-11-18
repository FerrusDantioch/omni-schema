// =====================================================================
// Export et import de fichiers .json.
// - « Exporter ce schéma » : un fichier pour un seul schéma
//   (pour l'envoyer à quelqu'un ou le passer sur un autre appareil).
// - « Sauvegarder tous mes schémas » : un seul fichier avec tout.
// L'import accepte les deux. Un schéma importé ne remplace JAMAIS un
// schéma existant : en cas de doublon, on crée une copie.
// =====================================================================

import { APP_VERSION, VERSION_FORMAT } from './config.js';
import { migrer, nouvelId } from './modele.js';
import { listerSchemas, enregistrerSchema, chargerSchema } from './stockage.js';

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

export function exporterSchema(schema) {
  const contenu = JSON.stringify(schema, null, 2);
  telecharger(nomFichier(schema.titre, 'json'), contenu, 'application/json');
}

export async function exporterTout() {
  const schemas = await listerSchemas();
  const sauvegarde = {
    format: 'omni-schema-sauvegarde',
    version_format: VERSION_FORMAT,
    version_app: APP_VERSION,
    date: new Date().toISOString(),
    schemas,
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
  if (donnees && donnees.format === 'omni-schema-sauvegarde' && Array.isArray(donnees.schemas)) bruts = donnees.schemas;
  else if (donnees && Array.isArray(donnees.elements)) bruts = [donnees];
  else throw new Error('Ce fichier ne vient pas d\'omni-schema.');

  const importes = [];
  const erreurs = [];
  for (const brut of bruts) {
    try {
      const schema = migrer(brut);
      // Ne jamais écraser : si l'identifiant existe déjà, on fait une copie.
      if (await chargerSchema(schema.id)) {
        schema.id = nouvelId('s');
        schema.titre = `${schema.titre} (importé)`;
      }
      schema.modifie_le = new Date().toISOString();
      await enregistrerSchema(schema);
      importes.push(schema);
    } catch (erreur) {
      erreurs.push(erreur.message);
    }
  }
  if (!importes.length) throw new Error(erreurs[0] || 'Aucun schéma n\'a pu être importé.');
  return { importes, erreurs };
}
