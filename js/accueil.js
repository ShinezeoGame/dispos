/* LA PAGE D'ACCUEIL : créer un groupe, en rejoindre un, retrouver
   les siens, se connecter. */

import { api, lireGroupes, retenirGroupe, creer, annoncer } from './commun.js';
import { messageConnexion, deconnecter } from './compte.js';
import './apparence.js'; // le choix de la couleur du site

// Revenu de Discord sur un échec : on le dit.
if (messageConnexion) annoncer(messageConnexion, 'erreur');

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

   Deux sources, dans cet ordre :
   — ceux de ton compte (duCompte), que le serveur envoie quand tu es
     connecté : tu les retrouves sur n'importe quel appareil ;
   — ceux retenus par ce navigateur (le localStorage, voir commun.js) :
     les groupes simplement visités, et ceux d'avant les comptes.
   Une Map, rangée par code : un groupe présent des deux côtés n'est
   listé qu'une fois. Un lien par groupe, le plus récent en haut.

   La liste du navigateur s'affiche tout de suite ; celle du compte
   arrive un instant plus tard, et la liste est alors redessinée. */
function afficherGroupes(duCompte) {
  const groupes = new Map(duCompte.map((groupe) => [groupe.code, groupe.nom]));
  for (const [code, infos] of Object.entries(lireGroupes()).reverse()) {
    if (!groupes.has(code)) groupes.set(code, infos.nom || code);
  }

  const liste = document.getElementById('liste-groupes');
  liste.replaceChildren();
  for (const [code, nom] of groupes) {
    const lien = creer('a', '', nom);
    lien.href = '/groupe?g=' + code;
    lien.append(creer('span', 'code', code));
    const element = creer('li');
    element.append(lien);
    liste.append(element);
  }
  document.getElementById('mes-groupes').hidden = groupes.size === 0;
}
afficherGroupes([]);


/* TON COMPTE

   On demande au serveur qui est connecté (/api/compte), puis on montre
   soit ton nom et « Se déconnecter », soit « Se connecter ». Si le
   serveur ne répond pas, on propose de se connecter : c'est le cas le
   plus courant, et le bouton mène de toute façon au serveur. */
api('/compte')
  .then(({ compte, groupes }) => {
    if (!compte) {
      document.getElementById('bouton-connexion').hidden = false;
      return;
    }
    document.getElementById('compte-nom').textContent = compte.nom;
    document.getElementById('compte').hidden = false;
    afficherGroupes(groupes);
  })
  .catch(() => {
    document.getElementById('bouton-connexion').hidden = false;
  });

document.getElementById('bouton-deconnexion').addEventListener('click', deconnecter);
