/* LA TEAM

   Une carte par membre : son pseudo, ses jeux, ses dispos habituelles
   écrites dans son profil, et combien d'heures il a cochées dans
   l'agenda de la semaine affichée. La tienne en premier, avec le
   bouton pour la modifier. */

import { etat, quandCaChange, appeler, charger } from './etat.js';
import { avatar, creer, formater, lundiDe, copier, annoncer, maintenant, PLATEFORMES, STYLES } from './commun.js';
import { ouvrirProfil } from './profil.js';
import { couverture } from './jeux.js';
import { brancherFiche } from './fiche-jeu.js';

const liste = document.getElementById('liste-membres');
const modele = document.getElementById('modele-membre');

function dessiner() {
  if (!etat.groupe) return;
  const estMoi = (membre) => membre.id === etat.moi?.id;
  /* sort compare deux membres : un nombre négatif place a avant b.
     estMoi(b) - estMoi(a) vaut -1 quand a est toi : tu passes devant.
     Les autres gardent leur ordre d'arrivée. */
  const membres = [...etat.membres].sort((a, b) => estMoi(b) - estMoi(a));
  liste.replaceChildren(...membres.map((membre) => fabriquerCarte(membre, estMoi(membre))));
}
quandCaChange(dessiner);

function fabriquerCarte(membre, estMoi) {
  const carte = modele.content.firstElementChild.cloneNode(true);
  // Le liseré en haut de la carte prend la couleur du membre.
  carte.style.setProperty('--couleur', membre.couleur);
  carte.querySelector('.membre-tete').prepend(avatar(membre));
  carte.querySelector('.membre-pseudo').textContent = membre.pseudo;
  /* Un soutien d'AllReady : un petit cœur après le pseudo et une lueur
     autour de l'avatar (style.css, .membre.soutien). Le cœur est caché
     aux lecteurs d'écran, qui lisent « soutient AllReady » à la place. */
  if (membre.soutien) {
    carte.classList.add('soutien');
    const coeur = creer('span', 'membre-coeur', '♥');
    coeur.title = 'Soutient AllReady';
    coeur.setAttribute('aria-hidden', 'true');
    carte.querySelector('.membre-pseudo').append(coeur, creer('span', 'visuellement-cache', ', soutient AllReady'));
  }
  carte.querySelector('.membre-toi').hidden = !estMoi;
  const perso = membre.perso;

  // Le statut, sous le pseudo (caché s'il est vide, comme tout le reste).
  const statut = carte.querySelector('.membre-statut');
  statut.textContent = perso.statut;
  statut.hidden = !perso.statut;

  // Le style de jeu puis les plateformes, en petites étiquettes.
  const badges = [];
  const style = STYLES.find((s) => s.id === perso.style);
  if (style) badges.push(creer('li', 'tag tag-style', style.nom));
  for (const plateforme of PLATEFORMES.filter((p) => perso.plateformes.includes(p.id))) {
    badges.push(creer('li', 'tag tag-plateforme', plateforme.nom));
  }
  const zoneBadges = carte.querySelector('.membre-badges');
  zoneBadges.replaceChildren(...badges);
  zoneBadges.hidden = badges.length === 0;

  // « 12 h cochées cette semaine » ou « … semaine du 9 nov. »
  const heures = etat.dispos.get(membre.id)?.size || 0;
  const quelleSemaine = etat.semaine.getTime() === lundiDe(maintenant()).getTime()
    ? 'cette semaine'
    : `semaine du ${formater(etat.semaine, { day: 'numeric', month: 'short' })}`;
  // Rien n'est écrit quand rien n'est coché : pas de texte pour rien.
  carte.querySelector('.membre-semaine').textContent = heures
    ? `${heures} h cochée${heures > 1 ? 's' : ''} ${quelleSemaine}`
    : '';

  /* LA FIABILITÉ (AllReady+, js/presence.js) : sur les soirées
     pointées où il avait dit « Chaud », combien de fois il est venu.
     À partir de trois seulement : après une seule soirée manquée,
     « Fiable à 0 % » serait injuste. Rien dans un groupe gratuit
     (etat.presence vaut null). */
  const fiabilite = etat.presence?.fiabilite[membre.id];
  const ligneFiabilite = carte.querySelector('.membre-fiabilite');
  if (fiabilite && fiabilite.attendus >= 3) {
    const part = Math.round((100 * fiabilite.venus) / fiabilite.attendus);
    ligneFiabilite.textContent = `Fiable à ${part} % (${fiabilite.venus} soirée${fiabilite.venus > 1 ? 's' : ''} sur ${fiabilite.attendus})`;
    ligneFiabilite.hidden = false;
  }

  /* Les jeux : une étiquette par jeu, avec sa petite couverture. Un jeu
     trouvé dans IGDB (il a un id) devient un bouton : survolé, touché ou
     atteint au clavier, il ouvre sa fiche (fiche-jeu.js). */
  const listeJeux = carte.querySelector('.membre-jeux');
  listeJeux.replaceChildren(...membre.jeux.map((jeu) => {
    const element = creer('li');
    const etiquette = creer(jeu.id ? 'button' : 'span', 'tag tag-jeu');
    etiquette.append(couverture(jeu, 'mini'), creer('span', 'jeu-nom', jeu.nom));
    if (jeu.id) {
      etiquette.type = 'button';
      brancherFiche(etiquette, jeu);
    }
    element.append(etiquette);
    return element;
  }));
  listeJeux.hidden = membre.jeux.length === 0;

  // Les dispos habituelles, titre compris, seulement si elles sont remplies.
  carte.querySelector('.membre-bio').textContent = membre.bio;
  carte.querySelector('.membre-sous-titre').hidden = !membre.bio;
  carte.querySelector('.membre-bio').hidden = !membre.bio;

  /* Les pseudos pour se retrouver en jeu. Discord est un bouton : un
     clic copie le pseudo, prêt à coller dans « Ajouter un ami ». */
  const contacts = carte.querySelector('.membre-contacts');
  contacts.replaceChildren();
  if (perso.discord) {
    const discord = creer('button', 'contact-discord', perso.discord);
    discord.type = 'button';
    discord.prepend(creer('span', 'contact-label', 'Discord '));
    discord.setAttribute('aria-label', `Copier le pseudo Discord ${perso.discord}`);
    discord.addEventListener('click', () => copier(perso.discord, 'Pseudo Discord copié !'));
    contacts.append(discord);
  }
  if (perso.pseudos) contacts.append(creer('p', 'contact-pseudos', perso.pseudos));
  contacts.hidden = !perso.discord && !perso.pseudos;

  if (estMoi) {
    const modifier = carte.querySelector('.membre-modifier');
    modifier.hidden = false;
    modifier.addEventListener('click', ouvrirProfil);
  } else {
    /* Retirer quelqu'un : les organisateurs (etat.peutGerer). Mais un
       organisateur ne retire ni le premier membre ni un autre
       organisateur : seul le premier membre le peut (même règle côté
       serveur, membres/[id].js). */
    const jeSuisPremier = etat.moi?.id === etat.admin;
    const protege = membre.id === etat.admin || membre.organisateur;
    if (etat.peutGerer && (jeSuisPremier || !protege)) {
      const retirer = carte.querySelector('.membre-retirer');
      retirer.hidden = false;
      retirer.addEventListener('click', () => retirerMembre(membre));
    }
    // AllReady+ : le premier membre nomme ou retire les organisateurs.
    if (etat.groupe.premium && jeSuisPremier) {
      const nommer = carte.querySelector('.membre-nommer');
      nommer.hidden = false;
      nommer.textContent = membre.organisateur ? 'Retirer organisateur' : 'Nommer organisateur';
      nommer.addEventListener('click', () => nommerOrganisateur(membre, !membre.organisateur));
    }
  }
  // Le badge « orga » : en AllReady+, le premier membre et les organisateurs.
  carte.querySelector('.membre-orga').hidden = !(etat.groupe.premium && (membre.id === etat.admin || membre.organisateur));
  return carte;
}

/* NOMMER UN ORGANISATEUR (AllReady+, 2 nov. 2026) : il pourra gérer
   le groupe comme le premier membre (voir peutGerer, _outils.js). */
async function nommerOrganisateur(membre, organisateur) {
  try {
    await appeler(`/membres/${membre.id}`, { methode: 'PATCH', corps: { organisateur } });
    annoncer(organisateur ? `${membre.pseudo} organise le groupe avec toi.` : `${membre.pseudo} n'est plus organisateur.`);
    await charger();
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
}

/* RETIRER QUELQU'UN (2 nov. 2026) : confirm() demande d'abord, la
   suppression efface tout ce que la personne a mis dans le groupe. */
async function retirerMembre(membre) {
  if (!confirm(`Retirer ${membre.pseudo} du groupe ? Son profil, ses dispos et ses réponses seront effacés.`)) return;
  try {
    await appeler(`/membres/${membre.id}`, { methode: 'DELETE' });
    annoncer(`${membre.pseudo} ne fait plus partie du groupe.`);
    await charger();
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
}
