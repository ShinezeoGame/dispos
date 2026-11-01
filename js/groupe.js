/* LE CHEF D'ORCHESTRE DE LA PAGE GROUPE

   Le seul script chargé par groupe.html. Il importe les trois parties
   de l'écran (agenda, soirées, team), qui s'installent toutes seules,
   puis s'occupe de ce qui leur est commun : l'en-tête, les onglets,
   le premier chargement et le rafraîchissement. */

import { etat, charger, quandCaChange, lienGroupe } from './etat.js';
import { lireGroupes, retenirGroupe, oublierGroupe, avatar, copier, creer, animerEntree, annoncer } from './commun.js';
import { ouvrirProfil } from './profil.js';
import { messageConnexion } from './compte.js';
import './agenda.js';
import './soirees.js';
import './team.js';
import './apparence.js'; // le choix de la couleur du site
import { jeuDeMots } from './jeu-de-mots.js';


/* 1. LE CODE DU GROUPE

   Sans code valable dans l'adresse, il n'y a rien à afficher : retour
   à l'accueil. replace() plutôt que href : la page fautive ne reste pas
   dans l'historique, le bouton Retour ne ramène pas dessus. */
const codeValable = /^[A-Z0-9]{8}$/.test(etat.code);
if (!codeValable) location.replace('/');


/* 2. L'ANCIEN JETON

   Depuis les comptes (1er nov. 2026), c'est la connexion Discord qui
   te fait reconnaître : le navigateur n'a rien à faire, son cookie part
   tout seul avec chaque requête. Le jeton ne sert plus qu'aux profils
   créés avant, tant qu'ils ne sont pas reliés à un compte.

   Arrivée par un ancien lien perso (…#moi=jeton) : on range le jeton,
   puis on l'efface de la barre d'adresse pour qu'il ne finisse pas dans
   une capture d'écran ou un lien recopié. La partie après # n'est
   jamais envoyée au serveur, même lors de l'ouverture de la page. */
const lienPerso = location.hash.match(/^#moi=([0-9a-f]{64})$/);
if (lienPerso) {
  retenirGroupe(etat.code, { jeton: lienPerso[1] });
  history.replaceState(null, '', location.pathname + location.search);
}
etat.jeton = (lireGroupes()[etat.code] || {}).jeton || null;


/* 3. LES ONGLETS */
const onglets = [...document.querySelectorAll('[role="tab"]')];

function afficherOnglet(choisi) {
  for (const onglet of onglets) {
    const actif = onglet === choisi;
    onglet.setAttribute('aria-selected', actif);
    // Seul l'onglet actif est atteignable avec Tab ; les flèches
    // servent à passer aux autres (convention des onglets).
    onglet.tabIndex = actif ? 0 : -1;
    const panneau = document.getElementById(onglet.getAttribute('aria-controls'));
    panneau.hidden = !actif;
    // Le panneau qui apparaît joue son animation d'arrivée (commun.js).
    if (actif) animerEntree(panneau);
  }
}

for (const onglet of onglets) {
  onglet.addEventListener('click', () => afficherOnglet(onglet));
  onglet.addEventListener('keydown', (evenement) => {
    const sens = { ArrowRight: 1, ArrowLeft: -1 }[evenement.key];
    if (!sens) return;
    // % onglets.length : après le dernier, on revient au premier.
    const suivant = onglets[(onglets.indexOf(onglet) + sens + onglets.length) % onglets.length];
    suivant.focus();
    afficherOnglet(suivant);
  });
}


/* 4. L'EN-TÊTE ET LES FENÊTRES */
const boutonProfil = document.getElementById('bouton-profil');

function inviter() {
  copier(lienGroupe(), 'Lien copié !');
}
document.getElementById('bouton-inviter').addEventListener('click', inviter);
boutonProfil.addEventListener('click', ouvrirProfil);

// Redessiné à chaque changement, comme le reste de la page.
quandCaChange(() => {
  document.getElementById('titre-groupe').textContent = etat.groupe.nom;
  document.title = `${etat.groupe.nom} · AllReady`;

  // Le petit jeu de mots à droite des onglets, s'il y en a un.
  const blague = jeuDeMots(etat.groupe.nom, etat.code);
  const zoneBlague = document.getElementById('jeu-de-mots');
  zoneBlague.textContent = blague || '';
  zoneBlague.hidden = !blague;
  /* « Inviter » est le seul bouton d'invitation du groupe. Tant qu'on est
     seul, il passe en orange (bouton principal) pour attirer l'œil ;
     dès qu'un pote a rejoint, il redevient discret. */
  const boutonInviter = document.getElementById('bouton-inviter');
  boutonInviter.hidden = false;
  boutonInviter.classList.toggle('bouton-second', etat.membres.length >= 2);

  // Inscrit : ton avatar et ton pseudo. Simple visiteur : « Rejoindre ».
  boutonProfil.hidden = false;
  boutonProfil.classList.toggle('bouton', !etat.moi);
  boutonProfil.classList.toggle('bouton-petit', !etat.moi);
  if (etat.moi) {
    boutonProfil.replaceChildren(avatar(etat.moi), creer('span', 'bouton-profil-nom', etat.moi.pseudo));
    boutonProfil.setAttribute('aria-label', `Ton profil (${etat.moi.pseudo})`);
  } else {
    boutonProfil.replaceChildren('Rejoindre');
    boutonProfil.removeAttribute('aria-label');
  }
});

/* Tout bouton marqué data-fermer ferme la fenêtre qui le contient. Et
   un clic à côté de la fenêtre (sur le fond assombri) la ferme aussi :
   le formulaire remplit toute la fenêtre, donc un clic dont la cible
   est la fenêtre elle-même ne peut venir que du fond.

   Piège : enfoncer la souris dans un champ pour sélectionner du texte
   et la relâcher sur le fond compte aussi comme un clic sur le fond.
   On retient donc où l'appui a commencé, et on ne ferme que s'il a
   commencé sur le fond lui aussi. Sinon, la saisie serait perdue. */
let appuiSurLeFond = false;
document.addEventListener('pointerdown', (evenement) => {
  appuiSurLeFond = evenement.target.tagName === 'DIALOG';
});
document.addEventListener('click', (evenement) => {
  const fermer = evenement.target.closest('[data-fermer]');
  if (fermer) fermer.closest('dialog').close();
  if (evenement.target.tagName === 'DIALOG' && appuiSurLeFond) evenement.target.close();
});


/* 5. LE PREMIER CHARGEMENT */
async function demarrer() {
  try {
    await charger();
  } catch (probleme) {
    document.getElementById('chargement').hidden = true;
    document.getElementById('erreur-groupe-texte').textContent = probleme.message;
    document.getElementById('erreur-groupe').hidden = false;
    /* 404 : le groupe n'existe plus (ou le lien est faux). On l'efface
       de la liste « Tes groupes » de l'accueil. Une autre erreur (pas de
       connexion, serveur en panne) ne prouve pas qu'il a disparu : on le
       garde, sinon on perdrait son jeton pour une simple coupure réseau. */
    if (probleme.statut === 404) oublierGroupe(etat.code);
    return;
  }
  document.getElementById('chargement').hidden = true;
  document.querySelector('.onglets').hidden = false;
  afficherOnglet(onglets[0]);
  /* Pas encore membre : la fenêtre pour rejoindre s'ouvre tout de suite
     (et affiche elle-même l'éventuel échec de connexion Discord). Déjà
     membre et revenu d'un échec (« Relier à Discord ») : on le dit en
     bas de l'écran. */
  if (!etat.moi) ouvrirProfil();
  else if (messageConnexion) annoncer(messageConnexion, 'erreur');
}
if (codeValable) demarrer();


/* 6. LE RAFRAÎCHISSEMENT

   Quand tu reviens sur l'onglet (après être passé sur Discord, par
   exemple), on recharge : un pote a peut-être coché des cases ou
   proposé une soirée entre-temps. Pas de rechargement toutes les X
   secondes : ça ferait travailler le serveur pour rien pendant que
   personne ne regarde. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && etat.groupe) {
    charger().catch(() => {});
  }
});
