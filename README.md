# omni-schema

Construis des schémas de blocs reliés par des flèches, puis présente-les étape par étape.
Pensé pour expliquer quelque chose à quelqu'un (enseigner, accompagner) ou présenter ton propre travail.

Application de l'**Omni-système**, par Ferrus Dantioch.

- Fonctionne **hors ligne** une fois ouverte une première fois (PWA installable).
- **Aucun compte, aucun serveur, aucune donnée envoyée** : tes schémas restent sur ton appareil (IndexedDB).
- Aucune bibliothèque externe, aucun CDN : HTML, CSS et JavaScript natifs, sans étape de construction.

Adresse prévue : <https://ferrusdantioch.github.io/omni-schema/>

## État d'avancement

| Jalon | Contenu | État |
|---|---|---|
| 1 — Édition de base | PWA hors ligne, thèmes, À propos, bouton « Mettre à jour », blocs, flèches, zoom/déplacement, grille, annuler/rétablir, plusieurs schémas, export/import JSON | ✅ livré |
| 2 — Présentation | étapes, navigation, surlignage, notes, modèles de départ, export PNG/SVG/PDF | ✅ livré |
| 3 — HTML autonome et finitions | lecteur HTML en un seul fichier, accessibilité clavier, petits écrans | ✅ livré |

**Version 1.0.0** : les trois jalons sont livrés et validés sur appareils réels (téléphone, tablette,
ordinateur), avec les polices et le logo de l'Omni-système.

**Version 1.1.0** (jalon 4) : sélection multiple, images dans les blocs, reprise de la présentation
là où on s'était arrêté, vue présentateur sur deux écrans.

**Version 1.2.0** : copier-coller (aussi d'un schéma à l'autre), flèches courbes, en pointillés,
à deux pointes ou sans pointe, étiquettes de flèche sur plusieurs lignes, « Annuler » qui remet
la sélection en place, polices complétées (Ÿ, espace fine insécable).

**Version 1.3.0** : zones de regroupement, aligner et répartir plusieurs blocs, blocs de texte
sans cadre et taille du texte, modèles personnels (« Enregistrer comme modèle »). Le zoom, le
recadrage et la grille sont réunis dans le bouton **Vue**.

**Version 1.4.0** : créer des blocs depuis une liste à retraits (rangés en arbre), plan du schéma
en texte, recherche (loupe ou Ctrl+F), pointeur lumineux en présentation (aussi sur la fenêtre
public en mode deux écrans).

**Version 1.5.0** : sous-schémas (un bloc ouvre un autre schéma, aussi en présentation),
47 pictogrammes embarqués, corbeille (un schéma supprimé reste récupérable 30 jours).

## Utilisation rapide

| Je veux… | Au doigt | À la souris / au clavier |
|---|---|---|
| Ajouter un bloc | bouton **Bloc**, ou toucher deux fois le fond | double-clic sur le fond, ou touche **N** |
| Choisir un bloc | le toucher une fois | clic, ou **Tab** pour passer au suivant |
| Écrire dans un bloc | le toucher une deuxième fois (ou bouton **Texte**) | **Entrée** ou **F2** ; valider avec **Échap** ou en cliquant ailleurs |
| Déplacer un bloc | le faire glisser | glisser, ou **flèches** (Maj : finement) |
| Changer sa taille | tirer le petit carré en bas à droite | tirer le carré, ou **Alt + flèches** |
| Relier deux blocs | tirer le rond **+** vers l'autre bloc | idem |
| Créer un bloc relié | tirer le rond **+** vers le vide | idem |
| Étiquette d'une flèche | toucher la flèche, puis **Étiquette** | **Entrée** sur la flèche choisie |
| Se déplacer dans le schéma | glisser le fond | glisser le fond ou clic molette |
| Zoomer | pincer à deux doigts, ou bouton **Vue** | molette, ou **+** / **−** ; **0** pour recentrer |
| Voir tout le schéma, grille magnétique | bouton **Vue** | **0** |
| Annuler / rétablir | flèches en haut à droite | **Ctrl+Z** / **Ctrl+Y** (ou Ctrl+Maj+Z) |
| Dupliquer / supprimer | barre du bas | **Ctrl+D** / **Suppr** |
| Copier / coller des blocs | **Copier** (bloc ou groupe choisi), puis **Coller** (rien de choisi), ici ou dans un autre schéma | **Ctrl+C** / **Ctrl+V** (et **Ctrl+X** pour couper) |
| Coller un texte ou une image venus d'ailleurs | — | **Ctrl+V** : un nouveau bloc est créé |
| Regrouper des blocs dans une zone | bouton **Zone** (ou **Aligner** → *Entourer d'une zone* avec plusieurs blocs choisis) ; on déplace la zone par son titre, ses blocs suivent (ils sont entourés de pointillés quand la zone est choisie ; un bloc posé à cheval sur le bord agrandit la zone) ; toucher encore le titre pour le changer | **Z** ; **Entrée** pour le titre |
| Aligner, répartir, même taille | plusieurs blocs choisis → **Aligner** | idem |
| Écrire un titre ou une légende libre | **Style** → forme *Sans cadre*, et *Taille du texte* | idem |
| Créer des blocs depuis une liste | Menu → *Créer des blocs depuis une liste* (une ligne par bloc, les lignes décalées deviennent la suite) | idem, ou **Ctrl+V** d'une liste à puces |
| Avoir le plan du schéma en texte | Menu → *Plan du schéma en texte* → *Copier le plan* | idem |
| Rechercher un mot | loupe en haut | **Ctrl+F**, **Entrée** / **Maj+Entrée** pour suivant / précédent |
| Mettre un pictogramme dans un bloc | **Style** → *Pictogramme* (47 dessins embarqués) | idem |
| Relier un bloc à un sous-schéma | **Style** → *Relier à un schéma* (ou *Créer un nouveau sous-schéma*) ; *Ouvrir*, puis **Retour** en haut à gauche | **O** pour ouvrir |
| Récupérer un schéma supprimé | *Mes schémas* → **Corbeille** (30 jours) | idem |
| Repartir d'un de mes schémas | Menu → *Enregistrer comme modèle*, puis *Nouveau schéma* → *Mes modèles* | idem |
| Changer le trait d'une flèche | toucher la flèche, puis **Trait** : droite, angle droit ou courbe ; plein ou pointillés ; une, deux ou aucune pointe | idem |
| Créer un bloc relié | tirer le rond **+** vers le vide | **R** (à droite) / **Maj+R** (en dessous) |
| Relier deux blocs existants | tirer le rond **+** vers l'autre bloc | **L**, puis **Tab** pour viser, **Entrée** |
| Voir tous les raccourcis | Menu → Aide et raccourcis | **?** |
| Choisir plusieurs blocs | **appui long** sur un bloc, puis toucher les autres | **Maj+clic**, **Ctrl+A** |
| Entourer plusieurs blocs | **appui long** sur le fond, puis glisser | **Maj+glisser** sur le fond |
| Mettre une image dans un bloc | bouton **Style** → *Ajouter une image* | idem |
| Choisir l'étape d'un élément | bouton **Étape** de la barre du bas | idem |
| Voir / réordonner toutes les étapes | bouton **Étapes** (rien de sélectionné) | idem |
| Écrire une note de présentateur | bouton **Note** sur un bloc | idem |

### En présentation (bouton ▶ Présenter)

| Je veux… | Au doigt | Au clavier / télécommande |
|---|---|---|
| Étape suivante | toucher la partie droite, ou glisser vers la gauche | **→**, **Espace**, **Entrée**, **Page suivante** |
| Étape précédente | toucher le tiers gauche, ou glisser vers la droite | **←**, **Retour arrière**, **Page précédente** |
| Début / fin | — | **Début** / **Fin** |
| Notes du présentateur | bouton **Notes** en bas à gauche | **N** |
| Entrer dans un sous-schéma | toucher le bloc marqué ↗ ; à la fin (ou bouton **Retour**), on revient où on en était | **O** |
| Pointeur lumineux | **appui long** sur le schéma, puis glisser | appui long à la souris, ou **L** (le point suit la souris) |
| Quitter | croix en haut à droite, ou geste « retour » | **Échap** |

À l'ouverture, si tu t'étais arrêté en cours de route, l'app propose **« Reprendre là »**
(l'étape atteinte est retenue sur l'appareil, pour chaque schéma).

### Vue présentateur sur deux écrans (Étapes → *Vue présentateur*, ou **Maj+P**)

Pensée pour un ordinateur relié à un vidéoprojecteur ou à un second écran :

1. une deuxième fenêtre s'ouvre : elle ne montre que le schéma. Place-la sur le vidéoprojecteur,
   puis clique dessus pour le plein écran ;
2. ta fenêtre montre ce que voit le public, l'étape suivante, tes notes et un chronomètre ;
3. tu avances depuis ta fenêtre (boutons, flèches, télécommande) : la fenêtre public suit ;
4. pour montrer un détail : appui long (ou touche **L**) sur l'aperçu « étape en cours » :
   le pointeur lumineux apparaît au même endroit sur la fenêtre public.

Les deux fenêtres se parlent à l'intérieur du navigateur (BroadcastChannel), sans réseau.
Si le navigateur bloque la deuxième fenêtre, autorise les fenêtres surgissantes pour l'app.

Une flèche n'apparaît jamais avant ses deux blocs : elle se montre automatiquement
à l'étape du dernier de ses blocs (sauf si tu lui donnes une étape plus tardive).

## Identité visuelle

Alignée sur le portfolio de l'Omni-système : fond nuit `#14121e`, cartes `#1e1928`,
filets `#262435`, violet `#a777ff` avec texte sombre sur les boutons, petites étiquettes
en MAJUSCULES espacées, chiffres en police à chasse fixe, texte de lecture à empattements,
choix en « pilules ».

Polices : les mêmes que le portfolio, **embarquées** dans le dossier `polices/` (environ 130 Ko,
rien n'est téléchargé depuis internet). Elles couvrent le français complet (dont Œ, Ÿ et
l'espace fine insécable), les langues latines d'Europe, les flèches et quelques symboles :

| Police | Usage |
|---|---|
| **Oxanium** | interface, titres, boutons, texte des blocs |
| **Literata** | texte de lecture (explications, notes, À propos) |
| **JetBrains Mono** | chiffres (version, étapes, compteur) |

Elles sont sous licence libre SIL Open Font License 1.1 (voir `polices/LICENCES.txt`).
Les exports SVG, PNG et HTML contiennent la police Oxanium : ils s'affichent à l'identique
sur tous les appareils.
En thème clair, le violet est assombri (`#6a3fd6`) pour rester lisible.

## Page HTML autonome

Menu → *Exporter* → *Page HTML autonome* crée **un seul fichier .html** (souvent moins de 50 Ko)
que tu peux envoyer par e-mail ou mettre sur une clé USB :

- il s'ouvre dans n'importe quel navigateur récent, **hors ligne**, sans installer l'application ;
- il présente le schéma étape par étape (mêmes gestes et touches que l'application, plus **F** pour le plein écran) ;
- il garde les couleurs du thème choisi et affiche discrètement « Fait avec omni-schema — Ferrus Dantioch » ;
- il ne contient **aucun code d'édition** : le schéma y est déjà dessiné, seul un petit lecteur l'accompagne ;
- une règle de sécurité intégrée lui interdit tout accès à internet ;
- les notes du présentateur n'y sont incluses que si tu le demandes ;
- sans JavaScript, il affiche quand même le schéma complet.

La police Oxanium est incluse dans le fichier : le texte s'affiche exactement comme dans l'application,
sur tous les appareils (environ 20 Ko de plus ; 50 Ko avec les notes, qui utilisent Literata).

## Accessibilité

- Tout se fait aussi au clavier (voir *Aide et raccourcis*, touche **?**).
- Les lecteurs d'écran annoncent l'élément choisi, les liaisons créées et l'étape en cours.
- Cibles tactiles d'au moins 44 px, contrastes vérifiés (texte ≥ 4,5:1), aucune animation par défaut,
  réglage de la taille du texte, respect de « réduire les animations ».

## Structure des fichiers

```
index.html             page unique de l'application
manifest.webmanifest   fiche d'installation (nom, icônes, couleurs)
sw.js                  service worker : copie locale pour le hors-ligne
css/style.css          apparence, trois thèmes
js/
  app.js               point d'entrée : assemble tout
  noyau.js             état, actions, historique, sauvegarde automatique
  modele.js            format des données, création, migration, nettoyage
  rendu.js             dessin SVG
  interactions.js      gestes (doigt, souris, stylet)
  editeur-texte.js     écriture directement dans le bloc
  etapes.js            logique des étapes (sans affichage)
  panneau-etapes.js    panneau « Étapes »
  presentation.js      mode présentation plein écran (et reprise)
  presentateur.js      vue présentateur et fenêtre public (deux écrans)
  images.js            images des blocs (réduction, compression)
  schema-svg.js        SVG autonome du schéma (présentation, exports)
  exports.js           exports PNG, SVG et PDF (une page par étape)
  export-html.js       page HTML autonome (avec son petit lecteur)
  polices.js           chargement des polices et intégration aux exports
  modeles.js           modèles de départ
  geometrie.js         calculs : bords, flèches, aimantation
  texte.js             retour à la ligne et taille du texte
  historique.js        annuler / rétablir (avec la sélection)
  presse-papiers.js    copier, couper, coller
  liste.js             blocs depuis une liste à retraits, plan en texte
  recherche.js         rechercher dans le schéma
  pointeur.js          pointeur lumineux en présentation
  pictogrammes.js      les 47 pictogrammes (dessins au trait, embarqués)
  stockage.js          IndexedDB
  fichiers.js          export / import .json
  interface.js         menus, fenêtres, réglages, liste des schémas
  clavier.js           raccourcis clavier
  mise-a-jour.js       bouton « Mettre à jour »
  couleurs.js          palettes de couleurs par thème
  config.js            version et constantes
  theme-init.js        applique le thème avant l'affichage
icons/                 icônes de l'application
polices/               polices embarquées (Oxanium, Literata, JetBrains Mono) et leurs licences
assets/logo-omni-systeme.webp   logo de l'Omni-système (le même que sur le portfolio)
```

## Format des données

Un schéma est un fichier JSON simple et lisible :

```json
{
  "format": "omni-schema",
  "version_format": 5,
  "id": "s-…", "titre": "Mon schéma",
  "cree_le": "2026-11-18T09:00:00.000Z", "modifie_le": "…",
  "theme": "auto",
  "elements": [
    { "type": "bloc", "id": "b-…", "x": 0, "y": 0, "largeur": 160, "hauteur": 80,
      "texte": "…", "forme": "arrondi", "couleur": "violet", "taille": "normal", "etape": 0, "note": "", "image": "",
      "picto": "", "lien": "" },
    { "type": "zone", "id": "z-…", "x": -40, "y": -60, "largeur": 480, "hauteur": 260,
      "titre": "Phase 1", "couleur": "vert", "etape": 0 },
    { "type": "fleche", "id": "f-…", "de": "b-…", "vers": "b-…",
      "style": "droite", "trait": "plein", "pointes": "fin", "etiquette": "", "etape": 0 }
  ]
}
```

- `forme` : `rectangle`, `arrondi`, `ovale`, `losange`, `texte` (sans cadre).
- `taille` (format 4) : taille du texte d'un bloc, `petit`, `normal` ou `grand`.
- `picto` (format 5) : identifiant d'un pictogramme de `js/pictogrammes.js` (ou `""`).
- `lien` (format 5) : identifiant du schéma que le bloc ouvre (sous-schéma), ou `""`.
- `zone` (format 4) : grand cadre titré dessiné derrière les blocs ; en présentation, il
  apparaît à son étape comme un bloc.
- `couleur` : `neutre`, `violet`, `bleu`, `vert`, `jaune`, `rouge`.
- `style` d'une flèche : `droite`, `angle` (angle droit) ou `courbe`.
- `trait` (format 3) : `plein` ou `pointille` ; `pointes` : `fin` (une, au bout), `deux` ou `aucune`.
- `etape` : `0` = toujours visible ; sinon numéro d'apparition en présentation.
- `images` (format 2) : les images des blocs, `{ "i-…": "data:image/webp;base64,…" }` ; un bloc
  y fait référence par son champ `image`. Elles sont réduites à 1200 pixels et compressées à l'import.
- La sauvegarde de tous les schémas a la forme `{ "format": "omni-schema-sauvegarde", "schemas": [ … ], "modeles": [ … ] }`
  (`modeles` : les modèles personnels, rangés à part dans la base de l'appareil).

Si la structure change un jour, `version_format` augmente et `js/modele.js` convertit automatiquement les anciens fichiers (tableau `MIGRATIONS`).

## Publier une nouvelle version

1. Change le numéro de version **à deux endroits identiques** :
   `APP_VERSION` dans `js/config.js` et `VERSION` dans `sw.js`.
2. Si tu as ajouté un fichier, ajoute-le à la liste `FICHIERS` de `sw.js`.
3. Publie. À la prochaine ouverture, l'application télécharge la nouvelle
   version en arrière-plan et affiche le bouton **« Mettre à jour »**.
   Rien ne change tant que tu n'appuies pas dessus.

## Publication sur GitHub Pages

Tous les chemins sont relatifs : l'application fonctionne dans n'importe quel sous-dossier.
L'adresse `…github.io/omni-schema/` correspond à un dépôt nommé **omni-schema**.
Dans les réglages du dépôt : *Settings → Pages → Deploy from a branch*, branche principale, dossier racine.

Pour essayer en local : `python3 -m http.server` dans le dossier, puis <http://localhost:8000>
(un service worker exige `https` ou `localhost`).

## Licence

© 2026 Ferrus Dantioch — [Creative Commons BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr) :
partage autorisé en citant l'auteur, sans usage commercial ni modification.
La licence couvre le code de l'application ; tes schémas t'appartiennent.
Voir le fichier [LICENSE](LICENSE).

Une idée, une remarque, un souci ? Écris à omni-systeme.choking513@passmail.net
