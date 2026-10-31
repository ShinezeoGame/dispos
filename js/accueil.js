/* LA PAGE D'ACCUEIL : créer un groupe, en rejoindre un, retrouver
   ceux qu'on a déjà ouverts sur cet appareil. */

import { api, lireGroupes, retenirGroupe, creer } from './commun.js';
import './apparence.js'; // le choix de la couleur du site

const formCreer = document.getElementById('form-creer');
const formRejoindre = document.getElementById('form-rejoindre');

function montrerErreur(formulaire, message) {
  formulaire.querySelector('.erreur').textContent = message;
}


/* CRÉER

   preventDefault() empêche l'envoi classique du formulaire, qui
   rechargerait la page : on envoie nous-mêmes, en arrière-plan.
   Le bouton est désactivé pendant l'envoi pour qu'un double clic ne
   crée pas deux groupes. */
formCreer.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  const bouton = formCreer.querySelector('button');
  bouton.disabled = true;
  montrerErreur(formCreer, '');
  try {
    const { code, nom } = await api('/groupes', {
      methode: 'POST',
      corps: { nom: formCreer.elements.nom.value },
    });
    retenirGroupe(code, { nom });
    location.href = '/groupe?g=' + code;
  } catch (probleme) {
    montrerErreur(formCreer, probleme.message);
    bouton.disabled = false;
  }
});


/* REJOINDRE

   On accepte le lien complet comme le code seul : on cherche « g= »
   dans ce qui a été collé, sinon on prend tout. Les minuscules sont
   remises en majuscules, les espaces et tirets enlevés.

   Si c'est un lien perso (avec #moi=…), on garde cette fin : c'est
   elle qui te reconnecte à ton profil sur un nouvel appareil. */
formRejoindre.addEventListener('submit', (evenement) => {
  evenement.preventDefault();
  const saisie = formRejoindre.elements.lien.value.trim();
  const dansUnLien = saisie.match(/[?&]g=([A-Za-z0-9]+)/);
  const code = (dansUnLien ? dansUnLien[1] : saisie).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 8) {
    montrerErreur(formRejoindre, 'Un code fait 8 caractères, comme ABCD2345.');
    return;
  }
  const lienPerso = saisie.match(/#moi=[0-9a-f]{64}/);
  location.href = '/groupe?g=' + code + (lienPerso ? lienPerso[0] : '');
});


/* TES GROUPES

   Les groupes retenus dans le localStorage (voir commun.js). Un lien
   par groupe, le plus récent en haut. */
const groupes = Object.entries(lireGroupes()).reverse();
if (groupes.length > 0) {
  const liste = document.getElementById('liste-groupes');
  for (const [code, infos] of groupes) {
    const lien = creer('a', '', infos.nom || code);
    lien.href = '/groupe?g=' + code;
    lien.append(creer('span', 'code', code));
    const element = creer('li');
    element.append(lien);
    liste.append(element);
  }
  document.getElementById('mes-groupes').hidden = false;
}
