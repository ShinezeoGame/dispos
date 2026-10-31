/* LA TEAM

   Une carte par membre : son pseudo, ses jeux, ses dispos habituelles
   écrites dans son profil, et combien d'heures il a cochées dans
   l'agenda de la semaine affichée. La tienne en premier, avec le
   bouton pour la modifier. */

import { etat, quandCaChange } from './etat.js';
import { avatar, creer, formater, lundiDe } from './commun.js';
import { ouvrirProfil } from './profil.js';
import { couverture } from './jeux.js';

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
  carte.querySelector('.membre-toi').hidden = !estMoi;

  // « 12 h cochées cette semaine » ou « … semaine du 9 nov. »
  const heures = etat.dispos.get(membre.id)?.size || 0;
  const quelleSemaine = etat.semaine.getTime() === lundiDe(new Date()).getTime()
    ? 'cette semaine'
    : `semaine du ${formater(etat.semaine, { day: 'numeric', month: 'short' })}`;
  carte.querySelector('.membre-semaine').textContent = heures
    ? `${heures} h cochée${heures > 1 ? 's' : ''} ${quelleSemaine}`
    : `Rien de coché ${quelleSemaine}`;

  // Les jeux : une étiquette par jeu, avec sa petite couverture.
  const listeJeux = carte.querySelector('.membre-jeux');
  listeJeux.replaceChildren(...membre.jeux.map((jeu) => {
    const etiquette = creer('li', 'tag tag-jeu');
    etiquette.append(couverture(jeu, 'mini'), creer('span', 'jeu-nom', jeu.nom));
    return etiquette;
  }));
  listeJeux.hidden = membre.jeux.length === 0;

  const bio = carte.querySelector('.membre-bio');
  bio.textContent = membre.bio || (estMoi
    ? 'Écris ici quand tu es dispo d\'habitude : tes potes le verront.'
    : 'Pas encore renseignées.');
  bio.classList.toggle('vide', !membre.bio);

  if (estMoi) {
    const modifier = carte.querySelector('.membre-modifier');
    modifier.hidden = false;
    modifier.addEventListener('click', ouvrirProfil);
  }
  return carte;
}
