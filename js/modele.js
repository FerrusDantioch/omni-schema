// =====================================================================
// Modèle de données : à quoi ressemble un schéma, comment on le crée,
// comment on le vérifie et comment on convertit les anciennes versions.
//
// Un schéma est un simple objet JSON :
// {
//   format: 'omni-schema',      // pour reconnaître nos fichiers
//   version_format: 6,          // version de la structure (voir migrer)
//   id, titre, cree_le, modifie_le,
//   theme: 'auto',              // thème de présentation (auto = celui de l'app)
//   elements: [ blocs et flèches ],
//   images: { id: 'data:image/…' } // images des blocs (format 2)
// }
// Bloc   : { type:'bloc', id, x, y, largeur, hauteur, texte, forme, couleur, taille, etape, note, image, picto, lien }
//          (image = identifiant dans « images », ou '' s'il n'y en a pas ;
//           forme « texte » = sans cadre ; taille du texte : petit / normal / grand ;
//           picto = pictogramme embarqué (format 5) ; lien = id d'un sous-schéma (format 5))
// Flèche : { type:'fleche', id, de, vers, style, trait, pointes, etiquette, etape }
//          style : droite / angle / courbe ; trait : plein / pointille ;
//          pointes : fin (une, au bout) / deux / aucune (format 3)
// Zone   : { type:'zone', id, x, y, largeur, hauteur, titre, couleur, etape } (format 4)
//          grand cadre derrière des blocs, pour montrer qu'ils vont ensemble
// etape = 0 : toujours visible ; sinon numéro d'apparition en présentation.
// =====================================================================

import { VERSION_FORMAT, BLOC_DEFAUT, BLOC_MIN, ZONE_MIN } from './config.js';
import { COULEURS } from './couleurs.js';
import { pictogramme } from './pictogrammes.js';

export const FORMES = [
  { id: 'rectangle', nom: 'Rectangle' },
  { id: 'arrondi', nom: 'Arrondi' },
  { id: 'ovale', nom: 'Ovale' },
  { id: 'losange', nom: 'Losange' },
  { id: 'cercle', nom: 'Cercle' },
  { id: 'hexagone', nom: 'Hexagone' },
  { id: 'parallelogramme', nom: 'Parallélogramme' },
  { id: 'cylindre', nom: 'Base de données' },
  { id: 'document', nom: 'Document' },
  { id: 'nuage', nom: 'Nuage' },
  { id: 'texte', nom: 'Sans cadre' },
];

// Taille du texte d'un bloc : taille de départ et taille minimale (en unités du schéma).
export const TAILLES = [
  { id: 'petit', nom: 'Petit', max: 14, min: 10 },
  { id: 'normal', nom: 'Normal', max: 18, min: 11 },
  { id: 'grand', nom: 'Grand', max: 30, min: 14 },
];
export const tailleTexte = (b) => TAILLES.find((t) => t.id === b.taille) || TAILLES[1];

export const STYLES_FLECHE = [
  { id: 'droite', nom: 'Droite' },
  { id: 'angle', nom: 'Angle droit' },
  { id: 'courbe', nom: 'Courbe' },
];

export const TRAITS = [
  { id: 'plein', nom: 'Plein' },
  { id: 'pointille', nom: 'Pointillés' },
];

export const POINTES = [
  { id: 'fin', nom: 'Une pointe' },
  { id: 'deux', nom: 'Deux pointes' },
  { id: 'aucune', nom: 'Sans pointe' },
];

// Longueurs maximales des textes (garde-fou contre les fichiers abîmés).
const MAX_TEXTE = 2000;
const MAX_NOTE = 5000;
const MAX_ETIQUETTE = 200;
const MAX_TITRE = 200;

/** Fabrique un identifiant unique, par exemple « b-lq3k2x-8f3a1c9d0e ». */
export function nouvelId(prefixe = 'e') {
  let alea;
  if (window.crypto && crypto.randomUUID) alea = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  else alea = Math.random().toString(36).slice(2, 12);
  return `${prefixe}-${Date.now().toString(36)}-${alea}`;
}

const maintenant = () => new Date().toISOString();

/** Crée un schéma vide. */
export function creerSchema(titre = 'Nouveau schéma') {
  const date = maintenant();
  return {
    format: 'omni-schema',
    version_format: VERSION_FORMAT,
    id: nouvelId('s'),
    titre,
    cree_le: date,
    modifie_le: date,
    theme: 'auto',
    elements: [],
    images: {},
  };
}

/** Crée un bloc (les propriétés passées remplacent les valeurs par défaut). */
export function creerBloc(proprietes = {}) {
  return {
    type: 'bloc',
    id: nouvelId('b'),
    x: 0,
    y: 0,
    largeur: BLOC_DEFAUT.largeur,
    hauteur: BLOC_DEFAUT.hauteur,
    texte: '',
    forme: 'arrondi',
    couleur: 'neutre',
    taille: 'normal',
    etape: 0,
    note: '',
    image: '',
    picto: '',
    lien: '',
    ...proprietes,
  };
}

/** Crée une zone de regroupement. */
export function creerZone(proprietes = {}) {
  return {
    type: 'zone',
    id: nouvelId('z'),
    x: 0,
    y: 0,
    largeur: 400,
    hauteur: 260,
    titre: 'Zone',
    couleur: 'violet',
    etape: 0,
    ...proprietes,
  };
}

/** Crée une flèche du bloc « de » vers le bloc « vers ». */
export function creerFleche(de, vers, proprietes = {}) {
  return {
    type: 'fleche',
    id: nouvelId('f'),
    de,
    vers,
    style: 'droite',
    trait: 'plein',
    pointes: 'fin',
    etiquette: '',
    etape: 0,
    ...proprietes,
  };
}

// Petits raccourcis de lecture.
export const listeBlocs = (schema) => schema.elements.filter((e) => e.type === 'bloc');
export const listeFleches = (schema) => schema.elements.filter((e) => e.type === 'fleche');
/** Zones, de la plus grande à la plus petite (une petite zone se dessine par-dessus une grande). */
export const listeZones = (schema) => schema.elements.filter((e) => e.type === 'zone')
  .sort((a, b) => b.largeur * b.hauteur - a.largeur * a.hauteur);
/** Tout ce qui occupe de la place (blocs et zones) : pour cadrer la vue et les exports. */
export const listeCadres = (schema) => schema.elements.filter((e) => e.type === 'bloc' || e.type === 'zone');
export const trouver = (schema, id) => (id ? schema.elements.find((e) => e.id === id) || null : null);

/** Schéma d'accueil créé au tout premier lancement. */
export function creerSchemaAccueil() {
  const s = creerSchema('Mon premier schéma');
  const a = creerBloc({ x: 40, y: 60, largeur: 200, hauteur: 100, couleur: 'violet',
    texte: 'Bienvenue ! Touche ce bloc une fois pour le choisir, une deuxième fois pour écrire.' });
  const b = creerBloc({ x: 340, y: 60, largeur: 200, hauteur: 100, couleur: 'bleu',
    texte: 'Tire le rond + d\'un bloc vers un autre pour les relier.' });
  const c = creerBloc({ x: 340, y: 240, largeur: 200, hauteur: 100, forme: 'losange', couleur: 'jaune',
    texte: 'Ou vers le vide pour créer un bloc relié.' });
  s.elements.push(a, b, c, creerFleche(a.id, b.id), creerFleche(b.id, c.id, { style: 'angle' }));
  return s;
}

// ---------------------------------------------------------------------
// Migration des anciennes versions du format.
// MIGRATIONS[n] reçoit un schéma en version n et renvoie la version n+1.
// Exemple pour plus tard :
//   1: (doc) => { doc.elements.forEach(...); doc.version_format = 2; return doc; },
// ---------------------------------------------------------------------
const MIGRATIONS = {
  // 1 → 2 : les blocs peuvent porter une image (rangée dans schema.images).
  1: (doc) => {
    doc.images = {};
    for (const e of doc.elements) if (e && e.type === 'bloc') e.image = '';
    doc.version_format = 2;
    return doc;
  },
  // 2 → 3 : les flèches ont un trait (plein / pointillés) et des pointes.
  2: (doc) => {
    for (const e of doc.elements) {
      if (e && e.type === 'fleche') { e.trait = 'plein'; e.pointes = 'fin'; }
    }
    doc.version_format = 3;
    return doc;
  },
  // 3 → 4 : taille du texte des blocs (et, désormais, zones et blocs sans cadre).
  3: (doc) => {
    for (const e of doc.elements) if (e && e.type === 'bloc') e.taille = 'normal';
    doc.version_format = 4;
    return doc;
  },
  // 4 → 5 : pictogramme et lien vers un sous-schéma dans les blocs.
  4: (doc) => {
    for (const e of doc.elements) if (e && e.type === 'bloc') { e.picto = ''; e.lien = ''; }
    doc.version_format = 5;
    return doc;
  },
  // 5 → 6 : nouvelles formes (cercle, hexagone…) ; rien à convertir, mais
  // une ancienne version de l'app refusera ces fichiers au lieu de perdre les formes.
  5: (doc) => { doc.version_format = 6; return doc; },
};

// Une image valide : une adresse « data: » d'image, de taille raisonnable.
const MAX_IMAGE = 6 * 1024 * 1024;
const imageValide = (v) => typeof v === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < MAX_IMAGE;

/**
 * Prend un objet lu depuis un fichier ou la base, le convertit à la
 * version actuelle du format et le nettoie. Lance une erreur (avec un
 * message en français) si ce n'est pas un schéma utilisable.
 */
export function migrer(brut) {
  if (!brut || typeof brut !== 'object' || !Array.isArray(brut.elements)) {
    throw new Error('Ce fichier ne contient pas de schéma lisible.');
  }
  let doc = JSON.parse(JSON.stringify(brut));
  let version = Number(doc.version_format);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('La version de ce schéma est inconnue.');
  }
  if (version > VERSION_FORMAT) {
    throw new Error('Ce schéma vient d\'une version plus récente d\'omni-schema. Mets l\'application à jour pour l\'ouvrir.');
  }
  while (version < VERSION_FORMAT) {
    const etapeMigration = MIGRATIONS[version];
    if (!etapeMigration) throw new Error(`Impossible de convertir un schéma de version ${version}.`);
    doc = etapeMigration(doc);
    version = doc.version_format;
  }
  return normaliser(doc);
}

// Fonctions de nettoyage des valeurs.
const nombre = (v, defaut) => (Number.isFinite(Number(v)) ? Number(v) : defaut);
const texte = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const parmi = (v, liste, defaut) => (liste.some((o) => o.id === v) ? v : defaut);
const entierPositif = (v) => Math.max(0, Math.floor(nombre(v, 0)));
const dateValide = (v) => (typeof v === 'string' && !Number.isNaN(new Date(v).getTime()) ? v : maintenant());

/**
 * Vérifie et corrige chaque champ : valeurs manquantes, types faux,
 * flèches qui pointent vers un bloc disparu, identifiants en double…
 */
export function normaliser(doc) {
  const propre = {
    format: 'omni-schema',
    version_format: VERSION_FORMAT,
    id: typeof doc.id === 'string' && doc.id ? doc.id : nouvelId('s'),
    titre: texte(doc.titre, MAX_TITRE).trim() || 'Schéma sans titre',
    cree_le: dateValide(doc.cree_le),
    modifie_le: dateValide(doc.modifie_le),
    theme: ['auto', 'clair', 'sombre', 'violet'].includes(doc.theme) ? doc.theme : 'auto',
    elements: [],
    images: {},
  };
  const imagesSource = doc.images && typeof doc.images === 'object' ? doc.images : {};

  const vus = new Set();
  const idUnique = (id, prefixe) => {
    let resultat = typeof id === 'string' && id ? id : nouvelId(prefixe);
    while (vus.has(resultat)) resultat = nouvelId(prefixe);
    vus.add(resultat);
    return resultat;
  };

  // D'abord les blocs…
  const correspondance = new Map(); // ancien id → id retenu
  for (const e of doc.elements) {
    if (!e || e.type !== 'bloc') continue;
    const id = idUnique(e.id, 'b');
    if (typeof e.id === 'string' && !correspondance.has(e.id)) correspondance.set(e.id, id);
    propre.elements.push({
      type: 'bloc',
      id,
      x: nombre(e.x, 0),
      y: nombre(e.y, 0),
      largeur: Math.max(BLOC_MIN.largeur, nombre(e.largeur, BLOC_DEFAUT.largeur)),
      hauteur: Math.max(BLOC_MIN.hauteur, nombre(e.hauteur, BLOC_DEFAUT.hauteur)),
      texte: texte(e.texte, MAX_TEXTE),
      forme: parmi(e.forme, FORMES, 'arrondi'),
      couleur: parmi(e.couleur, COULEURS, 'neutre'),
      taille: parmi(e.taille, TAILLES, 'normal'),
      etape: entierPositif(e.etape),
      note: texte(e.note, MAX_NOTE),
      image: '',
      picto: pictogramme(e.picto) ? e.picto : '',
      lien: typeof e.lien === 'string' && /^[\w-]{1,80}$/.test(e.lien) ? e.lien : '',
    });
    // Image : gardée seulement si elle existe et qu'elle est valide.
    const idImage = typeof e.image === 'string' ? e.image : '';
    if (idImage && imageValide(imagesSource[idImage])) {
      propre.images[idImage] = imagesSource[idImage];
      propre.elements[propre.elements.length - 1].image = idImage;
    }
  }
  // …les zones…
  for (const e of doc.elements) {
    if (!e || e.type !== 'zone') continue;
    propre.elements.push({
      type: 'zone',
      id: idUnique(e.id, 'z'),
      x: nombre(e.x, 0),
      y: nombre(e.y, 0),
      largeur: Math.max(ZONE_MIN.largeur, nombre(e.largeur, 400)),
      hauteur: Math.max(ZONE_MIN.hauteur, nombre(e.hauteur, 260)),
      titre: texte(e.titre, MAX_ETIQUETTE),
      couleur: parmi(e.couleur, COULEURS, 'violet'),
      etape: entierPositif(e.etape),
    });
  }
  // …puis les flèches, seulement si leurs deux blocs existent.
  for (const e of doc.elements) {
    if (!e || e.type !== 'fleche') continue;
    const de = correspondance.get(e.de);
    const vers = correspondance.get(e.vers);
    if (!de || !vers || de === vers) continue;
    propre.elements.push({
      type: 'fleche',
      id: idUnique(e.id, 'f'),
      de,
      vers,
      style: parmi(e.style, STYLES_FLECHE, 'droite'),
      trait: parmi(e.trait, TRAITS, 'plein'),
      pointes: parmi(e.pointes, POINTES, 'fin'),
      etiquette: texte(e.etiquette, MAX_ETIQUETTE),
      etape: entierPositif(e.etape),
    });
  }
  return propre;
}
