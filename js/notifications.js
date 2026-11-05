/* TOUT CE QUI SE PASSE DANS LE GROUPE, EN NOTIFICATIONS (5 nov. 2026)

   Demandé : « notifier les gens de tout ce qu'il se passe dans leur
   groupe », sur le PC ou le téléphone. Le site sait déjà le faire (il
   s'installe comme une appli et envoie des notifications : js/appli.js),
   mais le bouton était caché tout en bas de La team. Ce fichier ajoute :

   1. L'INVITATION, en haut de la page, sous les onglets : « Reçois une notification… »
      et « Activer les notifications ». Elle disparaît une fois
      activées, ou pour de bon avec la croix (retenu sur cet appareil,
      localStorage, clé « allready-invitation-notifs »). Sur un iPhone
      où le site n'est pas encore sur l'écran d'accueil, elle dit
      comment l'y mettre (Apple n'envoie de notifications qu'aux sites
      ajoutés).

   2. « ME PRÉVENIR », dans Le groupe → Sur cet appareil, une fois
      activées : une case par sorte de notification. Les envois sont
      triés par le serveur (comptes.notifs, functions/_push.js) ; le
      choix vaut pour le compte, donc pour tous ses appareils et tous
      ses groupes. Ce que chaque sorte contient : functions/_evenements.js. */

import { etat, quandCaChange } from './etat.js';
import { api, annoncer, creer } from './commun.js';
import { quandAppliChange, notificationsPossibles, iphoneHorsAppli, abonnementActuel, activerNotifications } from './appli.js';

/* Même liste que TYPES_NOTIFS (functions/_outils.js), avec leur nom. */
const NOTIFS = [
  { id: 'soirees', nom: 'Les soirées proposées, déplacées ou annulées' },
  { id: 'reponses', nom: 'Les «\u00a0Chaud\u00a0» à tes soirées' },
  { id: 'dispos', nom: 'Qui est dispo ce soir' },
  { id: 'membres', nom: 'Les nouveaux membres' },
  { id: 'rappels', nom: 'Le rappel une heure avant, et les places libérées' },
];
const CLE = 'allready-invitation-notifs';

const invitation = document.getElementById('invitation-notifs');
const texte = document.getElementById('invitation-texte');
const boutonActiver = document.getElementById('invitation-activer');
const sortes = document.getElementById('notifs-sortes');
const liste = document.getElementById('notifs-liste');

// La croix touchée une fois : l'invitation ne revient plus sur cet
// appareil. Stockage bloqué : elle revient à chaque visite, rien de grave.
function masquee() {
  try {
    return localStorage.getItem(CLE) === '1';
  } catch {
    return false;
  }
}

/* Les cases de « Me prévenir », fabriquées une fois. Un clic envoie
   aussitôt la liste des sortes décochées (PATCH /api/compte). */
for (const sorte of NOTIFS) {
  const etiquette = creer('label', 'repeter');
  const caseACocher = creer('input');
  caseACocher.type = 'checkbox';
  caseACocher.value = sorte.id;
  etiquette.append(caseACocher, creer('span', '', sorte.nom));
  liste.append(etiquette);
}
liste.addEventListener('change', async () => {
  const coupees = [...liste.querySelectorAll('input:not(:checked)')].map((caseACocher) => caseACocher.value);
  try {
    const reponse = await api('/compte', { methode: 'PATCH', corps: { coupees } });
    etat.compte.notifs = reponse.coupees;
    annoncer("C'est noté.");
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
});

async function dessiner() {
  if (!etat.groupe) return;
  const abonne = notificationsPossibles && Boolean(await abonnementActuel());
  const refusees = 'Notification' in window && Notification.permission === 'denied';

  // 1. L'invitation : pour un membre connecté, pas encore abonné ici.
  const activable = notificationsPossibles && !refusees;
  invitation.hidden = !etat.moi || !etat.compte || abonne || masquee() || !(activable || iphoneHorsAppli);
  boutonActiver.hidden = !activable;
  texte.textContent = activable
    // \u00a0 : une espace insécable, pour que les guillemets ne se
    // retrouvent jamais seuls en bout de ligne.
    ? 'Reçois une notification à chaque soirée, «\u00a0Chaud\u00a0» ou dispo du groupe, sur ton téléphone ou ton PC.'
    : "Pour recevoir les notifications sur iPhone : Partager → « Sur l'écran d'accueil », puis ouvre AllReady depuis son icône.";

  // 2. Ce qu'on veut recevoir, une fois abonné.
  sortes.hidden = !abonne || !etat.compte;
  if (!sortes.hidden) {
    for (const caseACocher of liste.querySelectorAll('input')) {
      caseACocher.checked = !(etat.compte.notifs || []).includes(caseACocher.value);
    }
  }
}
quandCaChange(dessiner);
quandAppliChange(dessiner);

boutonActiver.addEventListener('click', async () => {
  boutonActiver.disabled = true;
  try {
    await activerNotifications(); // prévient appli.js, qui redessine
    annoncer('Notifications activées sur cet appareil.');
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  } finally {
    boutonActiver.disabled = false;
  }
});

document.getElementById('invitation-fermer').addEventListener('click', () => {
  try {
    localStorage.setItem(CLE, '1');
  } catch {
    // Stockage bloqué : cachée pour cette visite seulement.
  }
  invitation.hidden = true;
});
