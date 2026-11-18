// =====================================================================
// Script exécuté tout de suite, avant l'affichage de la page.
// Il applique le thème et la taille du texte enregistrés, pour éviter
// que l'écran clignote avec les mauvaises couleurs au démarrage.
// (Script classique, pas un module : il doit s'exécuter immédiatement.)
// =====================================================================
(function () {
  var reglages = {};
  try {
    reglages = JSON.parse(localStorage.getItem('omni-schema.reglages') || '{}') || {};
  } catch (e) { /* réglages illisibles : on garde les valeurs par défaut */ }

  var theme = reglages.theme || 'auto';
  if (theme === 'auto') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'clair' : 'violet';
  }
  document.documentElement.setAttribute('data-theme', theme);

  var taille = Number(reglages.taille) || 100;
  document.documentElement.style.fontSize = taille + '%';
})();
