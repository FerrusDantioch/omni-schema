// =====================================================================
// Gestes au doigt, à la souris et au stylet (« pointer events »).
//
// Règles choisies pour éviter les conflits :
// - 1 doigt sur un bloc       → déplace le bloc ;
// - 1 doigt sur le fond       → déplace la vue ;
// - 2 doigts n'importe où     → zoom + déplacement de la vue
//                               (un déplacement de bloc en cours est annulé) ;
// - molette de la souris      → zoom autour du pointeur ;
// - clic molette (bouton du milieu) → déplace la vue.
// Un geste ne démarre qu'après un petit mouvement (seuil), ce qui
// distingue un simple « toucher » d'un glissement.
// =====================================================================

import {
  etat, demanderRendu, valider, abandonner, selectionner, ajouterBloc, relier,
  borneZoom, zoomerAutour,
} from './noyau.js';
import { trouver, listeBlocs } from './modele.js';
import { aimanter, surGrille } from './geometrie.js';
import { BLOC_MIN } from './config.js';

export function installerGestes(svg, { editerTexte, editerEtiquette, avantGeste }) {
  const pointeurs = new Map(); // id du pointeur → position à l'écran
  let geste = null;
  let rectZone = null;
  let dernierToucherVide = null; // pour détecter le double toucher sur le fond

  const position = (e) => ({ x: e.clientX - rectZone.left, y: e.clientY - rectZone.top });
  const versSchema = (p) => ({ x: (p.x - etat.vue.x) / etat.vue.k, y: (p.y - etat.vue.y) / etat.vue.k });

  // ------------------------------------------------------------------
  svg.addEventListener('pointerdown', (e) => {
    // Clic droit : ignoré.
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    avantGeste(); // termine l'édition de texte, ferme les menus
    rectZone = svg.getBoundingClientRect();
    try { svg.setPointerCapture(e.pointerId); } catch { /* sans importance */ }
    const p = position(e);
    pointeurs.set(e.pointerId, p);
    etat.gesteEnCours = true;

    if (pointeurs.size === 2) { demarrerPincement(); return; }
    if (pointeurs.size > 2) return;

    const base = {
      id: e.pointerId,
      depart: p,
      seuil: e.pointerType === 'mouse' ? 3 : 8,
      bouge: false,
    };

    // Clic molette : déplacement de la vue, quelle que soit la cible.
    if (e.button === 1) {
      e.preventDefault();
      geste = { ...base, mode: 'vue', vue0: { ...etat.vue } };
      return;
    }

    const cible = e.target.closest ? e.target.closest('[data-poignee], [data-id]') : null;
    const poignee = cible && cible.dataset.poignee;
    const id = cible && cible.dataset.id;
    const element = id ? trouver(etat.schema, id) : null;

    if (poignee === 'redim') {
      const b = trouver(etat.schema, etat.selection);
      if (!b) return;
      geste = { ...base, mode: 'redim', idBloc: b.id, l0: b.largeur, h0: b.hauteur };
    } else if (poignee === 'relier') {
      geste = { ...base, mode: 'relier', idBloc: etat.selection, seuil: 2 };
    } else if (element && element.type === 'bloc') {
      const dejaChoisi = etat.selection === element.id;
      selectionner(element.id);
      geste = { ...base, mode: 'bloc', idBloc: element.id, x0: element.x, y0: element.y, dejaChoisi };
    } else if (element && element.type === 'fleche') {
      const dejaChoisi = etat.selection === element.id;
      selectionner(element.id);
      geste = { ...base, mode: 'fleche', idFleche: element.id, dejaChoisi };
    } else {
      geste = { ...base, mode: 'vue', vue0: { ...etat.vue }, surFond: true };
    }
  });

  // ------------------------------------------------------------------
  svg.addEventListener('pointermove', (e) => {
    if (!pointeurs.has(e.pointerId)) return;
    const p = position(e);
    pointeurs.set(e.pointerId, p);
    if (!geste) return;
    if (geste.mode === 'pincement') { suivrePincement(); return; }
    if (e.pointerId !== geste.id) return;

    const dx = p.x - geste.depart.x;
    const dy = p.y - geste.depart.y;
    if (!geste.bouge) {
      if (Math.hypot(dx, dy) < geste.seuil) return;
      geste.bouge = true;
    }
    const k = etat.vue.k;

    switch (geste.mode) {
      case 'vue':
        etat.vue = { ...etat.vue, x: geste.vue0.x + dx, y: geste.vue0.y + dy };
        demanderRendu();
        break;

      case 'bloc': {
        const b = trouver(etat.schema, geste.idBloc);
        if (!b) return;
        const autres = etat.reglages.guides ? listeBlocs(etat.schema).filter((o) => o.id !== b.id) : [];
        const r = aimanter(b, geste.x0 + dx / k, geste.y0 + dy / k, autres, {
          grille: etat.reglages.grille,
          guides: etat.reglages.guides,
          tolerance: 8 / k,
        });
        b.x = r.x;
        b.y = r.y;
        etat.guides = r.guides;
        demanderRendu();
        break;
      }

      case 'redim': {
        const b = trouver(etat.schema, geste.idBloc);
        if (!b) return;
        let largeur = Math.max(BLOC_MIN.largeur, geste.l0 + dx / k);
        let hauteur = Math.max(BLOC_MIN.hauteur, geste.h0 + dy / k);
        if (etat.reglages.grille) {
          largeur = Math.max(BLOC_MIN.largeur, surGrille(b.x + largeur) - b.x);
          hauteur = Math.max(BLOC_MIN.hauteur, surGrille(b.y + hauteur) - b.y);
        }
        b.largeur = largeur;
        b.hauteur = hauteur;
        demanderRendu();
        break;
      }

      case 'relier': {
        const m = versSchema(p);
        // Quel bloc se trouve sous le doigt ?
        const sous = document.elementFromPoint(e.clientX, e.clientY);
        const blocSous = sous && sous.closest ? sous.closest('.bloc') : null;
        const cible = blocSous && blocSous.dataset.id !== geste.idBloc ? blocSous.dataset.id : null;
        etat.liaison = { de: geste.idBloc, x: m.x, y: m.y, cible };
        demanderRendu();
        break;
      }

      default:
        break;
    }
  });

  // ------------------------------------------------------------------
  const finPointeur = (e) => {
    if (!pointeurs.has(e.pointerId)) return;
    const p = pointeurs.get(e.pointerId);
    pointeurs.delete(e.pointerId);
    const annule = e.type === 'pointercancel';

    if (!geste) {
      if (!pointeurs.size) etat.gesteEnCours = false;
      return;
    }
    if (geste.mode === 'pincement') {
      // On attend que tous les doigts soient levés avant un nouveau geste.
      if (!pointeurs.size) terminer();
      return;
    }
    if (e.pointerId !== geste.id) return;

    switch (geste.mode) {
      case 'bloc':
        if (geste.bouge) { if (annule) abandonner(); else valider(); }
        else if (!annule && geste.dejaChoisi) editerTexte(geste.idBloc); // 2e toucher : écrire
        break;

      case 'fleche':
        if (!annule && !geste.bouge && geste.dejaChoisi) editerEtiquette(geste.idFleche);
        break;

      case 'redim':
        if (annule) abandonner(); else valider();
        break;

      case 'relier':
        if (!annule && geste.bouge) finirLiaison(p);
        break;

      case 'vue':
        if (!annule && !geste.bouge && geste.surFond) toucherFond(p);
        break;

      default:
        break;
    }
    terminer();
  };

  svg.addEventListener('pointerup', finPointeur);
  svg.addEventListener('pointercancel', finPointeur);
  svg.addEventListener('lostpointercapture', (e) => { if (pointeurs.has(e.pointerId)) finPointeur(e); });

  function terminer() {
    geste = null;
    etat.guides = [];
    etat.liaison = null;
    if (!pointeurs.size) etat.gesteEnCours = false;
    demanderRendu();
  }

  /** Fin d'une liaison : sur un bloc → flèche ; dans le vide → nouveau bloc relié. */
  function finirLiaison(p) {
    const liaison = etat.liaison;
    const source = trouver(etat.schema, geste.idBloc);
    if (!liaison || !source) return;
    if (liaison.cible) {
      if (relier(source.id, liaison.cible)) valider();
      return;
    }
    const m = versSchema(p);
    const distance = Math.hypot(m.x - (source.x + source.largeur / 2), m.y - (source.y + source.hauteur / 2));
    if (distance < Math.max(source.largeur, source.hauteur) * 0.6) return; // trop près : on ignore
    // Bloc et flèche sont créés ensemble : un seul « Annuler » les retire.
    const nouveau = ajouterBloc(m, { forme: source.forme, couleur: source.couleur }, { sansValider: true });
    relier(source.id, nouveau.id);
    valider();
    editerTexte(nouveau.id); // on écrit tout de suite dans le nouveau bloc
  }

  /** Toucher le fond : désélectionne ; double toucher : crée un bloc. */
  function toucherFond(p) {
    const maintenant = performance.now();
    const d = dernierToucherVide;
    const double = d && maintenant - d.t < 400 && Math.hypot(p.x - d.p.x, p.y - d.p.y) < 30;
    dernierToucherVide = double ? null : { t: maintenant, p };
    if (double) editerTexte(ajouterBloc(versSchema(p)).id);
    else selectionner(null);
  }

  // ------------------------------------------------------------------
  // Pincement à deux doigts
  // ------------------------------------------------------------------
  function demarrerPincement() {
    // Un geste à un doigt était en cours : on l'annule proprement.
    if (geste && geste.bouge && (geste.mode === 'bloc' || geste.mode === 'redim')) abandonner();
    etat.liaison = null;
    etat.guides = [];
    const [a, b] = [...pointeurs.values()];
    geste = {
      mode: 'pincement',
      d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)),
      m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      vue0: { ...etat.vue },
    };
  }

  function suivrePincement() {
    const valeurs = [...pointeurs.values()];
    if (valeurs.length < 2) return;
    const [a, b] = valeurs;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const v0 = geste.vue0;
    const k = borneZoom((v0.k * d) / geste.d0);
    // Le point du schéma qui était sous le milieu des doigts y reste.
    const sx = (geste.m0.x - v0.x) / v0.k;
    const sy = (geste.m0.y - v0.y) / v0.k;
    etat.vue = { k, x: m.x - sx * k, y: m.y - sy * k };
    demanderRendu();
  }

  // ------------------------------------------------------------------
  // Molette : zoom autour du pointeur
  // ------------------------------------------------------------------
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    avantGeste();
    const r = svg.getBoundingClientRect();
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;       // en lignes
    else if (e.deltaMode === 2) delta *= 400; // en pages
    delta = Math.max(-200, Math.min(200, delta));
    zoomerAutour(Math.exp(-delta * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  // Pas de menu contextuel (appui long) sur la zone de dessin.
  svg.addEventListener('contextmenu', (e) => e.preventDefault());
}
