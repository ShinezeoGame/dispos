/* LA FICHE D'UN JEU, AU SURVOL

   Passer la souris sur un jeu (cartes de la team, soirées) affiche une
   petite fiche : jaquette, année, tags (« Coop », « Horreur »…) et
   résumé. Sur écran tactile, on touche le jeu ; au clavier, la fiche
   s'ouvre quand le jeu reçoit le focus (touche Tab). Échap la ferme.

   Une seule fiche pour toute la page (#fiche-jeu dans groupe.html),
   déplacée à côté du jeu visé. Les infos viennent du serveur
   (functions/api/groupes/[code]/jeu/[id].js) et sont gardées en mémoire :
   repasser sur un jeu ne redemande rien. */

import { appeler, quandCaChange } from './etat.js';
import { creer } from './commun.js';
import { couverture } from './jeux.js';

const fiche = document.getElementById('fiche-jeu');
const memoire = new Map(); // id IGDB → promesse des infos
let cible = null;          // le bouton dont la fiche est affichée
let minuterie = null;

function infos(id) {
  // On garde la PROMESSE : deux survols rapprochés ne lancent qu'une demande.
  if (!memoire.has(id)) memoire.set(id, appeler(`/jeu/${id}`).catch(() => null));
  return memoire.get(id);
}

/* Place la fiche sous le jeu, ou au-dessus s'il n'y a pas la place en
   bas de l'écran, sans jamais dépasser à gauche ni à droite. */
function placer() {
  const zone = cible.getBoundingClientRect();
  const largeur = fiche.offsetWidth;
  const hauteur = fiche.offsetHeight;
  const gauche = Math.min(Math.max(8, zone.left), innerWidth - largeur - 8);
  const dessous = zone.bottom + 8 + hauteur < innerHeight;
  fiche.style.left = `${gauche}px`;
  fiche.style.top = `${dessous ? zone.bottom + 8 : zone.top - hauteur - 8}px`;
}

function remplir(jeu, details) {
  const texte = creer('div', 'fiche-texte');
  const titre = creer('p', 'fiche-titre', jeu.nom);
  if (details && details.annee) titre.append(creer('span', 'fiche-annee', ` ${details.annee}`));
  texte.append(titre);
  if (details === undefined) texte.append(creer('p', 'fiche-resume', '…'));
  if (details && details.tags.length) {
    const tags = creer('ul', 'fiche-tags');
    tags.append(...details.tags.map((tag) => creer('li', 'tag', tag)));
    texte.append(tags);
  }
  if (details && details.resume) {
    // lang="en" : le résumé d'IGDB est en anglais ; un lecteur d'écran
    // le prononce alors avec l'accent anglais.
    const resume = creer('p', 'fiche-resume', details.resume);
    resume.lang = 'en';
    texte.append(resume);
  }
  fiche.replaceChildren(couverture(jeu, 'moyenne'), texte);
}

async function montrer(bouton, jeu) {
  clearTimeout(minuterie);
  cible = bouton;
  remplir(jeu, undefined); // d'abord le nom et « … »
  fiche.hidden = false;
  bouton.setAttribute('aria-describedby', 'fiche-jeu');
  placer();
  const details = await infos(jeu.id);
  if (cible !== bouton) return; // entre-temps, on est passé à un autre jeu
  remplir(jeu, details);
  placer(); // la fiche a grandi : on la replace
}

function cacher() {
  clearTimeout(minuterie);
  if (cible) cible.removeAttribute('aria-describedby');
  cible = null;
  fiche.hidden = true;
}

/* Branche la fiche sur un bouton de jeu.
   — Souris : la fiche s'ouvre après 0,3 s de survol (pas au simple
     passage), se ferme quand la souris s'en va.
   — Doigt : un toucher ouvre, un second toucher ferme.
   — Clavier : la fiche suit le focus. :focus-visible ne vaut que pour
     le clavier ; sans ce test, un toucher (qui donne aussi le focus)
     ouvrirait la fiche, que le clic refermerait aussitôt. */
export function brancherFiche(bouton, jeu) {
  bouton.addEventListener('pointerenter', (evenement) => {
    if (evenement.pointerType !== 'mouse') return;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => montrer(bouton, jeu), 300);
  });
  bouton.addEventListener('pointerleave', (evenement) => {
    if (evenement.pointerType === 'mouse') cacher();
  });
  bouton.addEventListener('click', (evenement) => {
    if (evenement.pointerType === 'mouse') return; // déjà ouverte au survol
    if (cible === bouton) cacher();
    else montrer(bouton, jeu);
  });
  bouton.addEventListener('focus', () => {
    if (bouton.matches(':focus-visible')) montrer(bouton, jeu);
  });
  bouton.addEventListener('blur', cacher);
}

// Échap ferme ; faire défiler ou redessiner la page aussi (la fiche
// resterait accrochée à une position qui n'est plus la bonne).
document.addEventListener('keydown', (evenement) => {
  if (evenement.key === 'Escape' && cible) cacher();
});
window.addEventListener('scroll', () => { if (cible) cacher(); }, { passive: true });
quandCaChange(cacher);
