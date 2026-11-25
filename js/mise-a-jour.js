// =====================================================================
// Service worker et bouton « Mettre à jour ».
//
// Le service worker garde une copie de l'application sur l'appareil
// (fonctionnement hors ligne). Quand une nouvelle version est publiée,
// le navigateur la télécharge en arrière-plan, mais on ne l'active PAS
// d'office : le bouton « Mettre à jour » apparaît et c'est toi qui
// décides quand recharger (ton travail est sauvegardé juste avant).
// =====================================================================

export function installerMiseAJour({ bouton, avantRechargement }) {
  if (!('serviceWorker' in navigator)) return;

  let rechargementDemande = false;

  const proposer = (travailleur) => {
    bouton.disabled = false;
    bouton.hidden = false;
    bouton.onclick = async () => {
      bouton.disabled = true;
      rechargementDemande = true;
      await avantRechargement();
      travailleur.postMessage({ type: 'ACTIVER' });
    };
  };

  // La nouvelle version a pris la main : on cache le bouton partout et on
  // recharge uniquement l'onglet qui a demandé la mise à jour.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    bouton.hidden = true;
    bouton.disabled = false;
    if (rechargementDemande) window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const inscription = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });

      // Une version attend déjà (téléchargée lors d'une visite précédente).
      if (inscription.waiting && navigator.serviceWorker.controller) proposer(inscription.waiting);

      inscription.addEventListener('updatefound', () => {
        const nouveau = inscription.installing;
        if (!nouveau) return;
        nouveau.addEventListener('statechange', () => {
          // « installed » + un contrôleur existant = c'est une mise à jour (pas la 1re installation).
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) proposer(nouveau);
        });
      });

      // Vérifie s'il existe une nouvelle version quand on revient sur l'app.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') inscription.update().catch(() => {});
      });
    } catch (erreur) {
      console.warn('Service worker non installé :', erreur);
    }
  });
}
