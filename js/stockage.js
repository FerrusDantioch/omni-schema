// =====================================================================
// Rangement des schémas sur l'appareil, dans IndexedDB (une petite base
// de données intégrée au navigateur). Rien ne quitte l'appareil.
// =====================================================================

const NOM_BASE = 'omni-schema';
const VERSION_BASE = 2;         // 2 : ajout des modèles personnels
const MAGASIN = 'schemas';
const MAGASIN_MODELES = 'modeles';

let promesseBase = null;

/** Prévient le reste de l'application (événement « omni-schema:base »). */
function signaler(etat) {
  window.dispatchEvent(new CustomEvent('omni-schema:base', { detail: etat }));
}

/** Ouvre la base (une seule fois) et crée les « magasins » si besoin. */
function ouvrirBase() {
  if (!promesseBase) {
    promesseBase = new Promise((resoudre, rejeter) => {
      const demande = indexedDB.open(NOM_BASE, VERSION_BASE);
      demande.onupgradeneeded = () => {
        const base = demande.result;
        if (!base.objectStoreNames.contains(MAGASIN)) {
          base.createObjectStore(MAGASIN, { keyPath: 'id' });
        }
        if (!base.objectStoreNames.contains(MAGASIN_MODELES)) {
          base.createObjectStore(MAGASIN_MODELES, { keyPath: 'id' });
        }
      };
      let bloquee = false;
      demande.onsuccess = () => {
        const base = demande.result;
        if (bloquee) signaler('debloquee');
        // Une version plus récente de l'app s'ouvre dans un autre onglet :
        // on libère la base pour qu'elle puisse se mettre à jour.
        base.onversionchange = () => {
          base.close();
          promesseBase = null;
          signaler('remplacee');
        };
        resoudre(base);
      };
      demande.onerror = () => rejeter(demande.error);
      // Un autre onglet (ancienne version) garde la base ouverte : la mise à
      // niveau attend qu'il se ferme. On prévient, sans abandonner : dès que
      // l'autre onglet est fermé, tout repart tout seul.
      demande.onblocked = () => { bloquee = true; signaler('bloquee'); };
    });
    // En cas d'échec, on permet un nouvel essai plus tard.
    promesseBase.catch(() => { promesseBase = null; });
  }
  return promesseBase;
}

/** Exécute une opération dans une transaction et attend sa fin. */
async function operation(mode, action, magasin = MAGASIN) {
  const base = await ouvrirBase();
  return new Promise((resoudre, rejeter) => {
    const transaction = base.transaction(magasin, mode);
    const demande = action(transaction.objectStore(magasin));
    transaction.oncomplete = () => resoudre(demande ? demande.result : undefined);
    transaction.onerror = () => rejeter(transaction.error);
    transaction.onabort = () => rejeter(transaction.error || new Error('Opération interrompue.'));
  });
}

/** Tous les schémas, du plus récemment modifié au plus ancien. */
export async function listerSchemas() {
  const tous = (await operation('readonly', (m) => m.getAll())) || [];
  return tous.sort((a, b) => String(b.modifie_le).localeCompare(String(a.modifie_le)));
}

export const chargerSchema = (id) => operation('readonly', (m) => m.get(id));
export const enregistrerSchema = (schema) => operation('readwrite', (m) => m.put(schema));
export const supprimerSchema = (id) => operation('readwrite', (m) => m.delete(id));

// Modèles personnels (« Enregistrer comme modèle »), rangés à part.
export async function listerModeles() {
  const tous = (await operation('readonly', (m) => m.getAll(), MAGASIN_MODELES)) || [];
  return tous.sort((a, b) => String(a.titre).localeCompare(String(b.titre), 'fr'));
}
export const chargerModele = (id) => operation('readonly', (m) => m.get(id), MAGASIN_MODELES);
export const enregistrerModele = (modele) => operation('readwrite', (m) => m.put(modele), MAGASIN_MODELES);
export const supprimerModele = (id) => operation('readwrite', (m) => m.delete(id), MAGASIN_MODELES);

/**
 * Demande au navigateur de ne pas effacer nos données quand l'appareil
 * manque de place. Silencieux : si le navigateur refuse, rien ne change.
 */
export function demanderStockagePersistant() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then((deja) => { if (!deja) navigator.storage.persist(); }).catch(() => {});
  }
}
