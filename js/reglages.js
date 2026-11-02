/* LE GROUPE : RENOMMER, AGENDA, QUITTER (2 nov. 2026)

   La petite section « Le groupe », sous les cartes de l'onglet La team,
   pour les membres seulement :
   — renommer le groupe : le premier membre seulement (etat.admin, voir
     adminDuGroupe dans functions/_outils.js) ;
   — copier le lien d'agenda, pour voir les soirées dans Google Agenda
     ou Apple Calendrier (functions/api/groupes/[code]/calendrier.js) ;
   — quitter le groupe. */

import { etat, quandCaChange, appeler, charger } from './etat.js';
import { annoncer, copier, oublierGroupe } from './commun.js';

const section = document.getElementById('reglages');
const formRenommer = document.getElementById('form-renommer');
const champNom = document.getElementById('nouveau-nom');

quandCaChange(() => {
  section.hidden = !etat.moi;
  formRenommer.hidden = !etat.moi || etat.moi.id !== etat.admin;
  // Le nom actuel dans le champ, sauf si on est en train de le taper.
  if (document.activeElement !== champNom) champNom.value = etat.groupe.nom;
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
