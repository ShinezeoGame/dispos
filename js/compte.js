/* TON COMPTE, CÔTÉ NAVIGATEUR (les deux pages)

   La connexion elle-même se passe entièrement côté serveur (functions/
   api/compte/) : le navigateur ne voit jamais le cookie de session, qui
   est HttpOnly. Ce fichier ne fait que trois petites choses autour :

   1. compléter l'adresse des liens « Se connecter avec Discord » ;
   2. lire le message laissé au retour de Discord en cas d'échec ;
   3. la déconnexion. */

import { api, annoncer, oublierDonneesHorsLigne } from './commun.js';


/* 1. LES LIENS DE CONNEXION

   Dans le HTML, ils portent l'attribut data-connexion et mènent à
   /api/compte/connexion. On y ajoute ?retour=… avec la page actuelle :
   une fois connecté, on revient exactement ici (sur le groupe qu'on
   voulait rejoindre, par exemple), et pas sur l'accueil. */
const retour = location.pathname + location.search;
for (const lien of document.querySelectorAll('[data-connexion]')) {
  lien.href = '/api/compte/connexion?retour=' + encodeURIComponent(retour);
}


/* 2. LE MESSAGE DU RETOUR

   Si la connexion a échoué, le serveur revient sur la page avec
   #connexion-ratee (ou #connexion-indisponible) à la fin de l'adresse.
   On traduit en phrase, puis on efface ce morceau de l'adresse : un
   rechargement de la page ne doit pas afficher le message une seconde
   fois. Chaque page décide où l'afficher (accueil.js, profil.js). */
const MESSAGES = {
  '#connexion-ratee': 'La connexion avec Discord a échoué. Réessaie.',
  '#connexion-indisponible': "La connexion avec Discord n'est pas encore configurée.",
};
export const messageConnexion = MESSAGES[location.hash] || '';
if (messageConnexion) history.replaceState(null, '', retour);


/* 3. SE DÉCONNECTER

   Le serveur efface la session et le cookie. On repart ensuite de
   l'accueil, page neutre : rester sur un groupe rouvrirait aussitôt la
   fenêtre « Rejoins le groupe ». */
export async function deconnecter() {
  try {
    await api('/compte/deconnexion', { methode: 'POST' });
    await oublierDonneesHorsLigne(); // les copies gardées pour le hors-ligne (sw.js)
    location.href = '/';
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
}
