// =====================================================================
// Rangement des schémas sur l'appareil, dans IndexedDB (une petite base
// de données intégrée au navigateur). Rien ne quitte l'appareil.
// =====================================================================

const NOM_BASE = 'omni-schema';
const VERSION_BASE = 1;
const MAGASIN = 'schemas';

let promesseBase = null;

/** Ouvre la base (une seule fois) et crée le « magasin » si besoin. */
function ouvrirBase() {
  if (!promesseBase) {
    promesseBase = new Promise((resoudre, rejeter) => {
      const demande = indexedDB.open(NOM_BASE, VERSION_BASE);
      demande.onupgradeneeded = () => {
        const base = demande.result;
        if (!base.objectStoreNames.contains(MAGASIN)) {
          base.createObjectStore(MAGASIN, { keyPath: 'id' });
        }
      };
      demande.onsuccess = () => resoudre(demande.result);
      demande.onerror = () => rejeter(demande.error);
      demande.onblocked = () => rejeter(new Error('La base est bloquée par un autre onglet. Ferme les autres onglets d\'omni-schema.'));
    });
    // En cas d'échec, on permet un nouvel essai plus tard.
    promesseBase.catch(() => { promesseBase = null; });
  }
  return promesseBase;
}

/** Exécute une opération dans une transaction et attend sa fin. */
async function operation(mode, action) {
  const base = await ouvrirBase();
  return new Promise((resoudre, rejeter) => {
    const transaction = base.transaction(MAGASIN, mode);
    const demande = action(transaction.objectStore(MAGASIN));
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

/**
 * Demande au navigateur de ne pas effacer nos données quand l'appareil
 * manque de place. Silencieux : si le navigateur refuse, rien ne change.
 */
export function demanderStockagePersistant() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then((deja) => { if (!deja) navigator.storage.persist(); }).catch(() => {});
  }
}
