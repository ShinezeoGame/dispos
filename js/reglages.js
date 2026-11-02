/* LE GROUPE : RENOMMER, AGENDA, QUITTER (2 nov. 2026)

   La petite section « Le groupe », sous les cartes de l'onglet La team,
   pour les membres seulement :
   — renommer le groupe : le premier membre seulement (etat.admin, voir
     adminDuGroupe dans functions/_outils.js) ;
   — copier le lien d'agenda, pour voir les soirées dans Google Agenda
     ou Apple Calendrier (functions/api/groupes/[code]/calendrier.js) ;
   — brancher un salon Discord : le premier membre seulement (voir
     functions/_annonces.js) ;
   — quitter le groupe. */

import { etat, quandCaChange, appeler, charger } from './etat.js';
import { annoncer, copier, oublierGroupe, nomDuFuseau } from './commun.js';
import {
  quandAppliChange, peutInstaller, installer, iphoneHorsAppli,
  notificationsPossibles, abonnementActuel, activerNotifications, couperNotifications,
} from './appli.js';

const section = document.getElementById('reglages');
const formRenommer = document.getElementById('form-renommer');
const champNom = document.getElementById('nouveau-nom');

const reglageFuseau = document.getElementById('reglage-fuseau');
const choixFuseau = document.getElementById('fuseau');
const formDiscord = document.getElementById('form-discord');
const champWebhook = document.getElementById('webhook');
const discordBranche = document.getElementById('discord-branche');

quandCaChange(() => {
  // Les organisateurs (le premier membre, et ceux qu'il a nommés en AllReady+).
  const admin = etat.peutGerer;
  section.hidden = !etat.moi;
  formRenommer.hidden = !admin;
  // Le nom actuel dans le champ, sauf si on est en train de le taper.
  if (document.activeElement !== champNom) champNom.value = etat.groupe.nom;
  // Discord : le formulaire OU « Branché », jamais les deux.
  formDiscord.hidden = !admin || etat.groupe.discord;
  reglageFuseau.hidden = !admin;
  if (admin) remplirFuseaux();
  discordBranche.hidden = !admin || !etat.groupe.discord;
});

// appeler('') = l'adresse du groupe lui-même ; PATCH = « modifie ceci ».
formRenommer.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  try {
    await appeler('', { methode: 'PATCH', corps: { nom: champNom.value } });
    champNom.blur();
    annoncer('Groupe renommé.');
    await charger();
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
});

document.getElementById('copier-calendrier').addEventListener('click', () => {
  copier(`${location.origin}/api/groupes/${etat.code}/calendrier`, "Lien d'agenda copié !");
});

/* LE FUSEAU HORAIRE (2 nov. 2026) : la liste des fuseaux que connaît
   le navigateur (Intl.supportedValuesOf, environ 400), classés par
   région, « Europe / Paris ». Remplie une seule fois ; seule la valeur
   choisie suit le groupe. Un vieux navigateur sans cette liste ne
   montre que le fuseau actuel. Changer = PATCH, puis tout se recharge
   à la nouvelle heure. */
function remplirFuseaux() {
  if (!choixFuseau.options.length) {
    const liste = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [];
    if (!liste.includes(etat.groupe.fuseau)) liste.unshift(etat.groupe.fuseau);
    choixFuseau.replaceChildren(...liste.map((fuseau) => {
      const option = document.createElement('option');
      option.value = fuseau;
      option.textContent = fuseau.replace(/_/g, ' ').split('/').join(' / ');
      return option;
    }));
  }
  if (document.activeElement !== choixFuseau) choixFuseau.value = etat.groupe.fuseau;
}

choixFuseau.addEventListener('change', async () => {
  try {
    await appeler('', { methode: 'PATCH', corps: { fuseau: choixFuseau.value } });
    annoncer(`Le groupe vit maintenant à l'heure de ${nomDuFuseau(choixFuseau.value)}.`);
    await charger();
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
});

/* Brancher Discord : le serveur essaie d'abord d'écrire dans le salon
   (voir discord.js). Si ça marche, le message est déjà là-bas : on
   invite à aller voir. Pendant l'essai, le bouton est désactivé, pour
   qu'un double clic n'envoie pas deux messages. */
formDiscord.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  const bouton = formDiscord.querySelector('button');
  bouton.disabled = true;
  try {
    await appeler('/discord', { methode: 'PUT', corps: { webhook: champWebhook.value } });
    champWebhook.value = '';
    annoncer('Discord branché : un message vient d\'arriver dans le salon.');
    await charger();
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  } finally {
    bouton.disabled = false;
  }
});

document.getElementById('debrancher-discord').addEventListener('click', async () => {
  try {
    await appeler('/discord', { methode: 'DELETE' });
    annoncer('Discord débranché.');
    await charger();
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
});

/* SUR CET APPAREIL (2 nov. 2026) : ce qui s'affiche dépend de
   l'appareil (voir js/appli.js). Les notifications demandent un compte
   Discord (c'est le compte qui est prévenu, sur tous ses appareils). */
const reglageAppareil = document.getElementById('reglage-appareil');
const aideAppareil = document.getElementById('aide-appareil');
const boutonInstaller = document.getElementById('installer-appli');
const boutonActiver = document.getElementById('activer-notifs');
const boutonCouper = document.getElementById('couper-notifs');

async function dessinerAppareil() {
  if (!etat.groupe) return;
  const abonne = notificationsPossibles && Boolean(await abonnementActuel());
  const possibles = notificationsPossibles && Boolean(etat.compte);
  boutonInstaller.hidden = !peutInstaller();
  boutonActiver.hidden = !possibles || abonne;
  boutonCouper.hidden = !abonne;
  aideAppareil.textContent = abonne
    ? 'Notifications activées : les nouvelles soirées, et un rappel une heure avant celles où tu es chaud.'
    : possibles ? 'Les nouvelles soirées, et un rappel une heure avant celles où tu es chaud.'
    : iphoneHorsAppli ? "Sur iPhone : Partager → « Sur l'écran d'accueil », puis ouvre AllReady depuis son icône pour activer les notifications."
    : '';
  reglageAppareil.hidden = !aideAppareil.textContent && boutonInstaller.hidden;
}
quandCaChange(dessinerAppareil);
quandAppliChange(dessinerAppareil);

boutonInstaller.addEventListener('click', installer);
boutonActiver.addEventListener('click', async () => {
  boutonActiver.disabled = true;
  try {
    await activerNotifications();
    annoncer('Notifications activées.');
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  } finally {
    boutonActiver.disabled = false;
  }
});
boutonCouper.addEventListener('click', async () => {
  try {
    await couperNotifications();
    annoncer('Notifications coupées.');
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
});

/* Quitter : confirm() demande d'abord. Le dernier membre emporte le
   groupe avec lui (voir moi.js) : la question le dit. Ensuite, le
   groupe disparaît de « Tes groupes » et on retourne à l'accueil. */
document.getElementById('quitter-groupe').addEventListener('click', async () => {
  const nom = etat.groupe.nom;
  const question = etat.membres.length === 1
    ? `Tu es le dernier membre : quitter « ${nom} » le supprime. Continuer ?`
    : `Quitter « ${nom} » ? Ton profil, tes dispos et tes réponses seront effacés.`;
  if (!confirm(question)) return;
  try {
    await appeler('/moi', { methode: 'DELETE' });
    oublierGroupe(etat.code);
    location.href = '/';
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
});
