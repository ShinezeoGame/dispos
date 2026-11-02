/* LA TEAM EN CHIFFRES (2 nov. 2026)

   Une petite rangée au-dessus des cartes de l'onglet La team, deux
   repères au plus :
   — « Le plus chaud » : qui a dit « Chaud » le plus souvent ;
   — « Le jeu de la team » : le jeu qui revient dans le plus de profils.
   (Le nombre de soirées proposées a été retiré le 2 nov. 2026 : seule
   dans son cadre, la tuile passait pour un bouton.)

   Chacun n'apparaît que s'il veut dire quelque chose (pas de champion
   à égalité avec toute la team), et la rangée entière se cache s'il ne
   reste rien. Les « Chaud » sont comptés par le serveur (etat.stats,
   voir le chargement du groupe) ; le jeu, ici, à partir des profils. */

import { etat, quandCaChange } from './etat.js';
import { creer } from './commun.js';
import { couverture } from './jeux.js';
import { brancherFiche } from './fiche-jeu.js';

const rangee = document.getElementById('stats-team');

// Une tuile : une étiquette, la valeur en grand, un détail en petit.
function tuile(etiquette, valeur, detail = '') {
  const element = creer('li', 'stat');
  element.append(creer('span', 'stat-etiquette', etiquette), valeur);
  if (detail) element.append(creer('span', 'stat-detail', detail));
  return element;
}

/* LE PLUS CHAUD : le ou les membres au plus grand nombre de « Chaud ».
   Affiché à partir de 2 « Chaud » (un seul, c'est souvent la soirée
   qu'on a soi-même proposée), et seulement s'ils ne sont pas plus de
   deux ex æquo : au-delà, il n'y a pas vraiment de champion. */
function lePlusChaud() {
  const comptes = etat.membres
    .map((membre) => ({ membre, nombre: etat.stats.chauds[membre.id] || 0 }));
  const record = Math.max(0, ...comptes.map((compte) => compte.nombre));
  const champions = comptes.filter((compte) => compte.nombre === record).map((compte) => compte.membre);
  if (record < 2 || champions.length > 2) return null;
  const noms = champions.map((membre) => membre.pseudo).join(' et ');
  return tuile(
    champions.length > 1 ? 'Les plus chauds' : 'Le plus chaud',
    creer('strong', 'stat-valeur stat-chaud', noms),
    `${record} fois « Chaud »`,
  );
}

/* LE JEU DE LA TEAM : on compte chaque jeu sur l'ensemble des profils.
   La clé est l'id IGDB s'il existe, sinon le nom en minuscules (un jeu
   ajouté « tel quel »). Il faut au moins deux profils pour en parler.
   À égalité, le premier rencontré l'emporte. */
function leJeu() {
  const compteur = new Map();
  for (const membre of etat.membres) {
    for (const jeu of membre.jeux) {
      const cle = jeu.id ?? jeu.nom.toLowerCase();
      const deja = compteur.get(cle);
      compteur.set(cle, { jeu: deja?.jeu || jeu, nombre: (deja?.nombre || 0) + 1 });
    }
  }
  let meilleur = null;
  for (const entree of compteur.values()) {
    if (!meilleur || entree.nombre > meilleur.nombre) meilleur = entree;
  }
  if (!meilleur || meilleur.nombre < 2) return null;

  // Comme sur les cartes : un jeu trouvé dans IGDB ouvre sa fiche.
  const { jeu } = meilleur;
  const valeur = creer(jeu.id ? 'button' : 'span', 'stat-valeur stat-jeu');
  valeur.append(couverture(jeu, 'mini'), creer('span', 'jeu-nom', jeu.nom));
  if (jeu.id) {
    valeur.type = 'button';
    brancherFiche(valeur, jeu);
  }
  return tuile('Le jeu de la team', valeur, `dans ${meilleur.nombre} profils`);
}

quandCaChange(() => {
  if (!etat.stats) return;
  const tuiles = [];
  const chaud = lePlusChaud();
  if (chaud) tuiles.push(chaud);
  const jeu = leJeu();
  if (jeu) tuiles.push(jeu);
  rangee.replaceChildren(...tuiles);
  rangee.hidden = tuiles.length === 0;
});
