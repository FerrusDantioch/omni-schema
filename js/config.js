// =====================================================================
// Constantes partagées par toute l'application.
// =====================================================================

export const APP_NOM = 'omni-schema';

// ⚠ Quand tu publies une nouvelle version, change ce numéro ET celui de
// VERSION dans sw.js (les deux doivent être identiques).
export const APP_VERSION = '1.4.0';

// Version du format des fichiers de schéma. On l'augmente seulement si la
// structure des données change ; modele.js sait alors convertir les anciens.
export const VERSION_FORMAT = 4; // 2 : images ; 3 : trait et pointes des flèches ; 4 : zones, taille du texte

// Taille d'une case de la grille, en unités du schéma.
export const GRILLE = 20;

// Limites du zoom (1 = taille réelle).
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 4;

// Taille minimale d'un bloc.
export const BLOC_MIN = { largeur: 60, hauteur: 40 };
// Taille d'un nouveau bloc.
export const BLOC_DEFAUT = { largeur: 160, hauteur: 80 };
// Taille minimale d'une zone de regroupement.
export const ZONE_MIN = { largeur: 120, hauteur: 80 };
// Hauteur de la bande de titre d'une zone (c'est par elle qu'on la saisit).
export const BANDE_ZONE = 36;

// Clés de rangement des réglages dans le navigateur (localStorage).
export const CLE_REGLAGES = 'omni-schema.reglages';
export const CLE_DERNIER = 'omni-schema.dernier-schema';

// Police du texte des blocs : Oxanium, la police de l'Omni-système,
// embarquée dans l'application (dossier polices/, rien n'est téléchargé).
export const POLICE = '"Oxanium", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';
export const GRAISSE = 500;
export const POLICE_CHIFFRES = '"JetBrains Mono", ui-monospace, "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace';

// Fichiers des polices (pour les intégrer aux exports SVG, PNG et HTML).
export const FICHIERS_POLICES = {
  oxanium: { famille: 'Oxanium', fichier: 'polices/oxanium.woff2', graisse: '200 800', style: 'normal' },
  literata: { famille: 'Literata', fichier: 'polices/literata.woff2', graisse: '400', style: 'normal' },
};
