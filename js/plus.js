/* ALLREADY+, CÔTÉ PAGE (2 nov. 2026)

   L'abonnement d'un groupe (voir « Le modèle payant » dans CLAUDE.md).
   Ce fichier montre :
   — le « + » à côté du nom d'un groupe abonné ;
   — dans Le groupe, « AllReady+ actif » ou de quoi le découvrir ;
   — la fenêtre AllReady+ (ouvrirPlus), que chaque fonctionnalité
     réservée ouvre aussi, par son petit « + ».

   Pas de paiement sur le site : LIEN_PREMIUM (commun.js) mène à la page
   d'abonnement (Ko-fi), et l'abonnement est activé à la main dans la
   base (groupes.premium). Tant que LIEN_PREMIUM est vide, la fenêtre
   dit « Bientôt disponible ». */

import { etat, quandCaChange } from './etat.js';
import { LIEN_PREMIUM } from './commun.js';

const dialogue = document.getElementById('dialogue-plus');
const pastille = document.getElementById('pastille-plus');
const etatPlus = document.getElementById('plus-etat');
const boutonDecouvrir = document.getElementById('decouvrir-plus');
const consigne = document.getElementById('plus-consigne');
const abonner = document.getElementById('plus-abonner');

export function ouvrirPlus() {
  /* Le code du groupe dans la consigne : c'est grâce à lui que
     l'abonnement reçu sur Ko-fi est rattaché au bon groupe. */
  if (LIEN_PREMIUM) {
    abonner.href = LIEN_PREMIUM;
    abonner.hidden = false;
    consigne.textContent = `Indique le code du groupe, ${etat.code}, dans ton message : le groupe passe en AllReady+ dans la journée.`;
  } else {
    abonner.hidden = true;
    consigne.textContent = 'Bientôt disponible.';
  }
  dialogue.showModal();
}

quandCaChange(() => {
  const plus = etat.groupe.premium;
  pastille.hidden = !plus;
  etatPlus.textContent = plus
    ? 'Actif pour tout le groupe ✓'
    : "Rôles et liste d'attente, bot Discord, synchro d'agenda, jusqu'à 100 membres, plusieurs organisateurs, présence, thèmes et bannière.";
  boutonDecouvrir.hidden = plus;
});

boutonDecouvrir.addEventListener('click', ouvrirPlus);

// Le petit « + » de chaque fonctionnalité réservée (attribut data-plus).
document.addEventListener('click', (evenement) => {
  if (evenement.target.closest('[data-plus]')) ouvrirPlus();
});
