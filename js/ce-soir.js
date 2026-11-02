/* À QUOI JOUER CE SOIR (2 nov. 2026)

   En haut de l'onglet Soirées : « Ce soir, 4 dispos · à quoi on
   joue ? », puis les jeux que ces dispos ont en commun dans leur
   profil, du plus partagé au moins partagé, avec le nombre de joueurs
   maximum d'après IGDB (« 15 max »). Un clic sur un jeu ouvre « Proposer
   une soirée », déjà rempli : ce jeu, ce soir, à l'heure où le plus de
   monde est dispo.

   « Dispo ce soir » = au moins une heure cochée ce soir, de 19 h (ou
   de l'heure en cours) jusqu'à 3 h (ceSoir(), dans etat.js, le même
   calcul que le bouton « Chaud ce soir »). La section se cache à moins
   de deux dispos, sans jeu partagé par deux d'entre eux, ou quand
   l'agenda montre une autre semaine (la page n'a alors pas les dispos
   de ce soir). */

import { etat, quandCaChange, appeler, ceSoir, debutCase } from './etat.js';
import { creer, versTexte, libelleHeure } from './commun.js';
import { couverture, memeJeu } from './jeux.js';
import { proposerSoiree } from './soirees.js';

const section = document.getElementById('ce-soir');
const titre = document.getElementById('titre-ce-soir');
const zoneJeux = document.getElementById('ce-soir-jeux');
const MONTRES = 4; // au plus quatre jeux : au-delà, on ne choisit plus

/* Les nombres de joueurs, demandés au serveur (api/groupes/[code]/
   joueurs.js) une seule fois par jeu : la Map garde les réponses,
   le Set les jeux déjà demandés (même si la réponse n'est pas arrivée,
   pour ne pas redemander pendant l'attente). */
const joueurs = new Map(); // id IGDB → nombre maximum, ou null
const demandes = new Set();

function demanderJoueurs(jeux) {
  const ids = jeux.filter((jeu) => jeu.id && !demandes.has(jeu.id)).map((jeu) => jeu.id);
  if (!ids.length) return;
  for (const id of ids) demandes.add(id);
  appeler(`/joueurs?ids=${ids.join(',')}`)
    .then((reponse) => {
      for (const [id, nombre] of Object.entries(reponse.joueurs)) joueurs.set(Number(id), nombre);
      dessiner(); // les nombres arrivent après : on redessine avec
    })
    .catch(() => {}); // sans les nombres, la section reste utile
}

/* Les jeux que les dispos ont en commun : on compte chaque jeu sur
   leurs profils (memeJeu reconnaît le même jeu, même ajouté « tel
   quel »), on garde ceux d'au moins deux, du plus partagé au moins. */
function jeuxEnCommun(presents) {
  const compte = []; // [{ jeu, nombre }, …]
  for (const membre of presents) {
    for (const jeu of membre.jeux) {
      const deja = compte.find((entree) => memeJeu(entree.jeu, jeu));
      if (deja) deja.nombre += 1;
      else compte.push({ jeu, nombre: 1 });
    }
  }
  return compte.filter((entree) => entree.nombre >= 2).sort((a, b) => b.nombre - a.nombre);
}

// L'heure de ce soir où le plus de monde est dispo (la première, à égalité).
function meilleureCase(cles) {
  let meilleure = cles[0];
  let record = -1;
  for (const cle of cles) {
    const nombre = etat.membres.filter((membre) => etat.dispos.get(membre.id)?.has(cle)).length;
    if (nombre > record) {
      record = nombre;
      meilleure = cle;
    }
  }
  return meilleure;
}

function dessiner() {
  if (!etat.groupe) return;
  const { semaine, cles } = ceSoir();
  const bonneSemaine = etat.semaine.getTime() === semaine.getTime();
  const presents = bonneSemaine
    ? etat.membres.filter((membre) => cles.some((cle) => etat.dispos.get(membre.id)?.has(cle)))
    : [];
  const enCommun = presents.length >= 2 ? jeuxEnCommun(presents) : [];
  section.hidden = enCommun.length === 0;
  if (!enCommun.length) return;
  demanderJoueurs(enCommun.map((entree) => entree.jeu));

  /* Le tri : d'abord le jeu que le plus de dispos ont ; à égalité,
     celui qui se joue à autant qu'eux (ou dont on ne sait pas) passe
     devant celui qui est trop petit pour tout le monde. */
  const nombre = presents.length;
  const tient = (jeu) => {
    const maximum = jeu.id ? joueurs.get(jeu.id) : null;
    return maximum == null || maximum >= nombre;
  };
  enCommun.sort((a, b) => b.nombre - a.nombre || tient(b.jeu) - tient(a.jeu));

  titre.replaceChildren('Ce soir, ', creer('span', 'accent', `${nombre} dispos`), ' · à quoi on joue ?');

  // Le moment proposé : la meilleure heure de ce soir. debutCase
  // transforme « lundi, 25 » en mardi 1 h : la bonne date et la bonne heure.
  const [jour, heure] = meilleureCase(cles).split('-').map(Number);
  const debut = debutCase(jour, heure);
  const horaire = `${String(debut.getHours()).padStart(2, '0')}:00`;

  zoneJeux.replaceChildren(...enCommun.slice(0, MONTRES).map(({ jeu, nombre: ontLeJeu }) => {
    const bouton = creer('button', 'ce-soir-jeu');
    bouton.type = 'button';
    const detail = creer('span', 'ce-soir-detail', ontLeJeu === nombre ? "Tout le monde l'a" : `${ontLeJeu}/${nombre} l'ont`);
    const maximum = jeu.id ? joueurs.get(jeu.id) : null;
    if (maximum) {
      detail.append(' · ');
      detail.append(creer('span', maximum < nombre ? 'trop' : '', `${maximum} max`));
    }
    const texte = creer('span');
    texte.append(creer('span', 'ce-soir-nom', jeu.nom), detail);
    bouton.append(couverture(jeu, 'mini'), texte);
    bouton.setAttribute('aria-label', `Proposer une soirée ${jeu.nom} ce soir à ${libelleHeure(heure)}`);
    bouton.addEventListener('click', () => proposerSoiree({ jour: versTexte(debut), horaire, jeux: [jeu] }));
    return bouton;
  }));
}
quandCaChange(dessiner);
