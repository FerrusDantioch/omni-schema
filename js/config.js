// =====================================================================
// Constantes partagées par toute l'application.
// =====================================================================

export const APP_NOM = 'omni-schema';

// ⚠ Quand tu publies une nouvelle version, change ce numéro ET celui de
// VERSION dans sw.js (les deux doivent être identiques).
export const APP_VERSION = '0.1.1';

// Version du format des fichiers de schéma. On l'augmente seulement si la
// structure des données change ; modele.js sait alors convertir les anciens.
export const VERSION_FORMAT = 1;

// Taille d'une case de la grille, en unités du schéma.
export const GRILLE = 20;

// Limites du zoom (1 = taille réelle).
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 4;

// Taille minimale d'un bloc.
export const BLOC_MIN = { largeur: 60, hauteur: 40 };
// Taille d'un nouveau bloc.
export const BLOC_DEFAUT = { largeur: 160, hauteur: 80 };

// Clés de rangement des réglages dans le navigateur (localStorage).
export const CLE_REGLAGES = 'omni-schema.reglages';
export const CLE_DERNIER = 'omni-schema.dernier-schema';

// Police utilisée pour le texte des blocs (polices déjà présentes sur
// l'appareil : rien n'est téléchargé).
export const POLICE = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Ubuntu, Cantarell, sans-serif';
export const GRAISSE = 500;
