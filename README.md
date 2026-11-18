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
| 3 — HTML autonome et finitions | lecteur HTML en un seul fichier, accessibilité clavier, petits écrans | ✅ livré, en test |

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
| Zoomer | pincer à deux doigts | molette, ou **+** / **−** ; **0** pour recentrer |
| Annuler / rétablir | flèches en haut à droite | **Ctrl+Z** / **Ctrl+Y** (ou Ctrl+Maj+Z) |
| Dupliquer / supprimer | barre du bas | **Ctrl+D** / **Suppr** |
| Créer un bloc relié | tirer le rond **+** vers le vide | **R** (à droite) / **Maj+R** (en dessous) |
| Relier deux blocs existants | tirer le rond **+** vers l'autre bloc | **L**, puis **Tab** pour viser, **Entrée** |
| Voir tous les raccourcis | Menu → Aide et raccourcis | **?** |
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
| Quitter | croix en haut à droite, ou geste « retour » | **Échap** |

Une flèche n'apparaît jamais avant ses deux blocs : elle se montre automatiquement
à l'étape du dernier de ses blocs (sauf si tu lui donnes une étape plus tardive).

## Identité visuelle

Alignée sur le portfolio de l'Omni-système : fond nuit `#14121e`, cartes `#1e1928`,
filets `#262435`, violet `#a777ff` avec texte sombre sur les boutons, petites étiquettes
en MAJUSCULES espacées, chiffres en police à chasse fixe, texte de lecture à empattements,
choix en « pilules ». Polices déjà présentes sur l'appareil : rien n'est téléchargé.
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

Comme le texte est mis en page au moment de l'export, un appareil qui n'a pas la même police système
peut afficher un texte très légèrement plus large ou plus étroit.

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
  presentation.js      mode présentation plein écran
  schema-svg.js        SVG autonome du schéma (présentation, exports)
  exports.js           exports PNG, SVG et PDF (une page par étape)
  export-html.js       page HTML autonome (avec son petit lecteur)
  modeles.js           modèles de départ
  geometrie.js         calculs : bords, flèches, aimantation
  texte.js             retour à la ligne et taille du texte
  historique.js        annuler / rétablir
  stockage.js          IndexedDB
  fichiers.js          export / import .json
  interface.js         menus, fenêtres, réglages, liste des schémas
  clavier.js           raccourcis clavier
  mise-a-jour.js       bouton « Mettre à jour »
  couleurs.js          palettes de couleurs par thème
  config.js            version et constantes
  theme-init.js        applique le thème avant l'affichage
icons/                 icônes de l'application
assets/logo-omni-systeme.webp   logo de l'Omni-système (espace réservé à remplacer)
```

## Format des données

Un schéma est un fichier JSON simple et lisible :

```json
{
  "format": "omni-schema",
  "version_format": 1,
  "id": "s-…", "titre": "Mon schéma",
  "cree_le": "2026-11-18T09:00:00.000Z", "modifie_le": "…",
  "theme": "auto",
  "elements": [
    { "type": "bloc", "id": "b-…", "x": 0, "y": 0, "largeur": 160, "hauteur": 80,
      "texte": "…", "forme": "arrondi", "couleur": "violet", "etape": 0, "note": "" },
    { "type": "fleche", "id": "f-…", "de": "b-…", "vers": "b-…",
      "style": "droite", "etiquette": "", "etape": 0 }
  ]
}
```

- `forme` : `rectangle`, `arrondi`, `ovale`, `losange`.
- `couleur` : `neutre`, `violet`, `bleu`, `vert`, `jaune`, `rouge`.
- `style` d'une flèche : `droite` ou `angle` (angle droit).
- `etape` : `0` = toujours visible ; sinon numéro d'apparition en présentation.
- La sauvegarde de tous les schémas a la forme `{ "format": "omni-schema-sauvegarde", "schemas": [ … ] }`.

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
