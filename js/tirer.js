/* TIRER POUR RAFRAÎCHIR (mode appli, 6 nov. 2026)

   Dans l'appli, comme dans la plupart des applis : en haut de la page,
   tirer vers le bas fait descendre un petit rond qui tourne ; au-delà
   d'un seuil, le lâcher recharge les données. En dessous du seuil, il
   remonte sans rien faire.

   Seulement dans l'appli (classe « appli » posée par js/theme.js) :
   dans un navigateur, Chrome a déjà le sien. Dans l'appli, il n'y en a
   pas : on le fabrique. overscroll-behavior (style.css) empêche le
   navigateur d'ajouter son propre effet de rebond par-dessus.

   Ce qui ne déclenche rien :
   — un geste qui ne commence pas tout en haut de la page ;
   — un geste dans l'agenda en mode « Mes dispos » (glisser y coche des
     cases), dans une fenêtre ouverte, une palette ou un champ de texte.

   tirerPourRafraichir(rafraichir) : rafraichir est la fonction qui
   recharge (charger() pour un groupe, recharger la page pour
   l'accueil). Elle peut être asynchrone : le rond tourne jusqu'à ce
   qu'elle ait fini. */

import { vibrer } from './commun.js';

const SEUIL = 70;     // en pixels : au-delà, lâcher recharge
const MAXIMUM = 110;  // le rond ne descend jamais plus bas
const RESISTANCE = 0.5; // le rond descend moitié moins vite que le doigt : ça « résiste »

export function tirerPourRafraichir(rafraichir) {
  if (!document.documentElement.classList.contains('appli')) return;

  // Le rond, fabriqué une fois, caché au-dessus de l'écran (style.css, .tirer).
  const indicateur = document.createElement('div');
  indicateur.className = 'tirer';
  indicateur.setAttribute('aria-hidden', 'true');
  document.body.append(indicateur);

  let depart = null;    // la hauteur du doigt au début du geste, ou null
  let distance = 0;     // de combien le rond est descendu
  let enCours = false;  // un rechargement est déjà en route

  function placer(valeur) {
    distance = valeur;
    // Il descend avec le doigt et tourne d'autant (3 degrés par pixel).
    indicateur.style.setProperty('--distance', `${valeur}px`);
    indicateur.style.setProperty('--tour', `${valeur * 3}deg`);
    indicateur.classList.toggle('pret', valeur >= SEUIL);
  }

  document.addEventListener('touchstart', (evenement) => {
    if (enCours || window.scrollY > 0 || evenement.touches.length !== 1) return;
    const cible = evenement.target;
    if (cible.closest('.grille.edition, dialog, [popover], input, textarea, select')) return;
    if (document.querySelector('dialog[open]')) return;
    depart = evenement.touches[0].clientY;
    indicateur.classList.remove('retour');
  }, { passive: true });

  document.addEventListener('touchmove', (evenement) => {
    if (depart === null) return;
    const descente = evenement.touches[0].clientY - depart;
    // Le doigt remonte, ou la page a défilé entre-temps : on abandonne.
    if (descente <= 0 || window.scrollY > 0) {
      placer(0);
      return;
    }
    const avant = distance;
    placer(Math.min(MAXIMUM, descente * RESISTANCE));
    // Un petit « tic » au moment où le seuil est franchi.
    if (avant < SEUIL && distance >= SEUIL) vibrer();
  }, { passive: true });

  async function lacher() {
    if (depart === null) return;
    depart = null;
    indicateur.classList.add('retour'); // la remontée est animée (style.css)
    if (distance < SEUIL) {
      placer(0);
      return;
    }
    enCours = true;
    placer(SEUIL);
    indicateur.classList.add('charge'); // il tourne tout seul pendant le rechargement
    try {
      await rafraichir();
    } finally {
      indicateur.classList.remove('charge');
      placer(0);
      enCours = false;
    }
  }
  document.addEventListener('touchend', lacher);
  document.addEventListener('touchcancel', lacher);
}
