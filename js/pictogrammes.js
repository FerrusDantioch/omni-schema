// =====================================================================
// Pictogrammes embarqués : de petits dessins au trait, dessinés pour
// omni-schema (aucun fichier externe, aucune police d'icônes).
// Chaque dessin tient dans un carré de 24 × 24 et se trace avec un
// seul chemin SVG (« d »), sans remplissage, aux couleurs du bloc.
// L'identifiant est rangé dans le bloc (champ « picto ») : ne jamais en
// renommer un, sinon les schémas existants perdraient leur dessin.
// =====================================================================

const cercle = (cx, cy, r) => `M${cx} ${cy + r}a${r} ${r} 0 1 0 0 ${-2 * r} ${r} ${r} 0 0 0 0 ${2 * r}z`;

export const PICTOGRAMMES = [
  // Personnes et échanges
  { id: 'personne', nom: 'Personne', d: `${cercle(12, 8, 4)} M4 21a8 8 0 0 1 16 0` },
  { id: 'groupe', nom: 'Groupe', d: `${cercle(9, 7.5, 3.5)} M2 20a7 7 0 0 1 14 0 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18 13.6a7 7 0 0 1 4 6.4` },
  { id: 'bulle', nom: 'Message', d: 'M4 5h16v11H9l-5 4z' },
  { id: 'enveloppe', nom: 'Courrier', d: 'M3 5h18v14H3z M3 5l9 8 9-8' },
  { id: 'telephone', nom: 'Téléphone', d: 'M7 2h10v20H7z M11 18h2' },
  { id: 'micro', nom: 'Parole', d: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M5 11a7 7 0 0 0 14 0 M12 18v3 M9 21h6' },
  { id: 'sourire', nom: 'Satisfaction', d: `${cercle(12, 12, 9)} M8 14a5 5 0 0 0 8 0 M9 9.5v.01 M15 9.5v.01` },
  { id: 'coeur', nom: 'Cœur', d: 'M12 20s-8-5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15 12 20 12 20z' },
  // Idées et repères
  { id: 'idee', nom: 'Idée', d: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z' },
  { id: 'question', nom: 'Question', d: `${cercle(12, 12, 9)} M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6 M12 17v.01` },
  { id: 'info', nom: 'Information', d: `${cercle(12, 12, 9)} M12 11v6 M12 7.5v.01` },
  { id: 'alerte', nom: 'Attention', d: 'M12 3 2 20h20z M12 9v5 M12 17v.01' },
  { id: 'coche', nom: 'Validé', d: 'M4 12.5 9.5 18 20 7' },
  { id: 'croix', nom: 'Refusé', d: 'M6 6l12 12 M18 6 6 18' },
  { id: 'etoile', nom: 'Étoile', d: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z' },
  { id: 'cible', nom: 'Objectif', d: `${cercle(12, 12, 9)} ${cercle(12, 12, 4)} M12 12v.01` },
  { id: 'drapeau', nom: 'Étape clé', d: 'M5 21V4 M5 4h12l-2 4 2 4H5' },
  { id: 'trophee', nom: 'Réussite', d: 'M8 4h8v5a4 4 0 0 1-8 0z M8 6H5a3 3 0 0 0 3 4 M16 6h3a3 3 0 0 1-3 4 M12 13v4 M8 21h8 M10 17h4v4' },
  { id: 'fleche', nom: 'Suite', d: 'M4 12h15 M13 6l6 6-6 6' },
  { id: 'plus', nom: 'Ajouter', d: 'M12 5v14 M5 12h14' },
  { id: 'cycle', nom: 'Cycle', d: 'M20 12a8 8 0 0 1-14 5.3 M4 12a8 8 0 0 1 14-5.3 M18 3v4h-4 M6 21v-4h4' },
  { id: 'lien', nom: 'Lien', d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' },
  // Temps
  { id: 'horloge', nom: 'Heure', d: `${cercle(12, 12, 9)} M12 7v5l3 2` },
  { id: 'calendrier', nom: 'Date', d: 'M4 6h16v15H4z M4 10h16 M8 3v5 M16 3v5' },
  { id: 'sablier', nom: 'Délai', d: 'M6 3h12 M6 21h12 M7 3c0 5 5 6 5 9s-5 4-5 9 M17 3c0 5-5 6-5 9s5 4 5 9' },
  // Travail et outils
  { id: 'document', nom: 'Document', d: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6' },
  { id: 'dossier', nom: 'Dossier', d: 'M3 6h6l2 2h10v11H3z' },
  { id: 'livre', nom: 'Livre', d: 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z M4 19a2 2 0 0 0 2 2h13v-3' },
  { id: 'diplome', nom: 'Apprendre', d: 'M2 9l10-5 10 5-10 5z M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5 M22 9v6' },
  { id: 'ordinateur', nom: 'Ordinateur', d: 'M3 5h18v11H3z M8 20h8 M12 16v4' },
  { id: 'engrenage', nom: 'Réglage', d: `${cercle(12, 12, 3)} ${cercle(12, 12, 6.5)} M12 2v3.5 M12 18.5V22 M2 12h3.5 M18.5 12H22 M4.9 4.9l2.5 2.5 M16.6 16.6l2.5 2.5 M4.9 19.1l2.5-2.5 M16.6 7.4l2.5-2.5` },
  { id: 'loupe', nom: 'Recherche', d: `${cercle(11, 11, 7)} M20 20l-4-4` },
  { id: 'cadenas', nom: 'Sécurité', d: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4 M12 15v2' },
  { id: 'cle', nom: 'Clé', d: `${cercle(7, 12, 4)} M11 12h10 M17 12v3 M20 12v2` },
  { id: 'eclair', nom: 'Énergie', d: 'M13 2 4 14h7l-1 8 9-12h-7z' },
  // Chiffres et argent
  { id: 'euro', nom: 'Argent', d: 'M18 6.5A7 7 0 1 0 18 17.5 M4 10h10 M4 14h10' },
  { id: 'carte', nom: 'Paiement', d: 'M3 6h18v12H3z M3 10h18 M7 15h3' },
  { id: 'panier', nom: 'Achat', d: 'M3 4h2l2.5 11h10L20 8H6.5 M9 20h.01 M17 20h.01' },
  { id: 'barres', nom: 'Chiffres', d: 'M4 20h16 M7 20v-6 M12 20V8 M17 20V10' },
  { id: 'tendance', nom: 'Progression', d: 'M3 17l6-6 4 4 8-8 M15 7h6v6' },
  // Lieux et monde
  { id: 'maison', nom: 'Maison', d: 'M3 11 12 3l9 8 M5 9.5V21h14V9.5 M10 21v-6h4v6' },
  { id: 'batiment', nom: 'Entreprise', d: 'M4 21V5l8-2v18 M12 8h8v13 M3 21h18 M7 8v.01 M7 12v.01 M7 16v.01 M16 12v.01 M16 16v.01' },
  { id: 'camion', nom: 'Livraison', d: `M2 6h12v10H2z M14 10h4l3 3v3h-7 ${cercle(6, 17.5, 2)} ${cercle(17, 17.5, 2)}` },
  { id: 'globe', nom: 'Monde', d: `${cercle(12, 12, 9)} M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18` },
  { id: 'feuille', nom: 'Nature', d: 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15z M5 19l8-8' },
  { id: 'soleil', nom: 'Soleil', d: `${cercle(12, 12, 4)} M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4` },
  { id: 'nuage', nom: 'Nuage', d: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z' },
];

const PAR_ID = new Map(PICTOGRAMMES.map((p) => [p.id, p]));

/** Le pictogramme de cet identifiant (ou null). */
export const pictogramme = (id) => (id ? PAR_ID.get(id) || null : null);
