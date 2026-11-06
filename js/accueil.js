/* LA PAGE D'ACCUEIL : créer un groupe, en rejoindre un, retrouver
   les siens, se connecter. */

import { api, lireGroupes, retenirGroupe, oublierGroupe, creer, annoncer, fuseauDeLAppareil, oublierDonneesHorsLigne, LIEN_SOUTIEN } from './commun.js';
import { messageConnexion, deconnecter } from './compte.js';
import { debloquerThemes } from './apparence.js'; // le choix de la couleur du site
import { tirerPourRafraichir } from './tirer.js'; // mode appli : tirer vers le bas pour rafraîchir

// Dans l'appli, tirer vers le bas recharge la page : la liste de tes
// groupes est redemandée au serveur.
tirerPourRafraichir(() => location.reload());
import { quandAppliChange, peutInstaller, installer, androidHorsAppli } from './appli.js'; // le site comme une appli

// « Installer l'appli », en bas, dès que le navigateur le propose.
const boutonInstaller = document.getElementById('installer-appli');
quandAppliChange(() => { boutonInstaller.hidden = !peutInstaller(); });
boutonInstaller.addEventListener('click', installer);
// « Télécharger l'appli Android » : sur un téléphone Android, hors de l'appli.
document.getElementById('telecharger-apk').hidden = !androidHorsAppli;

// Revenu de Discord sur un échec : on le dit.
if (messageConnexion) annoncer(messageConnexion, 'erreur');

// « Soutenir AllReady », en bas, dès qu'une adresse est réglée.
if (LIEN_SOUTIEN) {
  const lienSoutien = document.getElementById('lien-soutien');
  lienSoutien.href = LIEN_SOUTIEN;
  lienSoutien.hidden = false;
}

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
      // Le fuseau de cet appareil devient celui du groupe (modifiable ensuite).
      corps: { nom: formCreer.elements.nom.value, fuseau: fuseauDeLAppareil },
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
    // Le nom puis, dessous, le code (la flèche est dessinée par le CSS).
    const lien = creer('a');
    lien.href = '/groupe?g=' + code;
    lien.append(creer('span', 'groupe-nom', nom), creer('span', 'code', code));
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
const boutonSupprimer = document.getElementById('supprimer-compte');
let groupesDuCompte = []; // retenus pour la question de la suppression

api('/compte')
  .then(({ compte, groupes }) => {
    // Les thèmes exclusifs (AllReady+) : voir debloquerThemes, apparence.js.
    debloquerThemes(Boolean(compte?.themes), Boolean(compte));
    if (!compte) {
      document.getElementById('bouton-connexion').hidden = false;
      return;
    }
    document.getElementById('compte-nom').textContent = compte.nom;
    document.getElementById('compte').hidden = false;
    boutonSupprimer.hidden = false;
    groupesDuCompte = groupes;
    afficherGroupes(groupes);
  })
  .catch(() => {
    document.getElementById('bouton-connexion').hidden = false;
  });

document.getElementById('bouton-deconnexion').addEventListener('click', deconnecter);


/* SUPPRIMER SON COMPTE (2 nov. 2026)

   confirm() pose la question, en disant ce qui disparaît : c'est
   définitif, il n'y a pas de corbeille. Le serveur efface tout (voir
   functions/api/compte/index.js). Ensuite, plutôt que de recharger la
   page, on la remet dans l'état « personne n'est connecté » : le
   message « Compte supprimé. » reste ainsi visible. Les groupes du
   compte sont aussi oubliés par ce navigateur : tu n'y as plus de
   profil, ils n'ont plus de raison d'être dans « Tes groupes ». */
boutonSupprimer.addEventListener('click', async () => {
  const nombre = groupesDuCompte.length;
  const tesGroupes = nombre === 1 ? 'ton groupe' : `tes ${nombre} groupes`;
  const question = nombre === 0
    ? 'Supprimer ton compte ? C\'est définitif.'
    : `Supprimer ton compte ? Ton profil disparaît de ${tesGroupes} (dispos, réponses, photo), `
      + 'et un groupe dont tu es le seul membre disparaît avec. C\'est définitif.';
  if (!confirm(question)) return;
  try {
    await api('/compte', { methode: 'DELETE' });
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
    return;
  }
  for (const { code } of groupesDuCompte) oublierGroupe(code);
  await oublierDonneesHorsLigne(); // les copies gardées pour le hors-ligne (sw.js)
  groupesDuCompte = [];
  document.getElementById('compte').hidden = true;
  boutonSupprimer.hidden = true;
  document.getElementById('bouton-connexion').hidden = false;
  afficherGroupes([]);
  annoncer('Compte supprimé.');
});
