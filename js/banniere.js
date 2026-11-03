/* LA BANNIÈRE DU GROUPE (AllReady+, 3 nov. 2026)

   En haut de l'onglet La team : un fond en dégradé, le nom du groupe,
   le nombre de membres et un grand emoji penché. Choisie par un
   organisateur dans Le groupe (« Bannière »), elle est la même pour
   toute la team. Le serveur ne l'envoie que pour un groupe abonné
   (etat.groupe.banniere, null sinon) : elle disparaît si l'abonnement
   s'arrête, et revient s'il reprend.

   Rangée dans groupes.banniere, { fond, emoji } en JSON, envoyée par
   PATCH sur l'adresse du groupe (functions/api/groupes/[code]/
   index.js), vérifiée par lireBanniere (functions/_outils.js). */

import { etat, quandCaChange, appeler, charger } from './etat.js';
import { annoncer, creer, EMOJIS } from './commun.js';

/* Les fonds : même liste que FONDS_BANNIERE (functions/_outils.js) ;
   leurs dégradés sont dans style.css (--banniere-…). « theme » prend
   l'accent et la couleur des soirées du thème de chacun. */
const FONDS = [
  { id: 'theme', nom: 'Couleurs du site' },
  { id: 'braise', nom: 'Braise' },
  { id: 'crepuscule', nom: 'Crépuscule' },
  { id: 'lave', nom: 'Lave' },
  { id: 'nuit', nom: 'Nuit' },
  { id: 'aurore', nom: 'Aurore' },
];

const bandeau = document.getElementById('banniere');
const formulaire = document.getElementById('form-banniere');
const zoneFonds = document.getElementById('banniere-fonds');
const zoneEmojis = document.getElementById('banniere-emojis');
const retirer = document.getElementById('retirer-banniere');


/* 1. LA BANNIÈRE ELLE-MÊME */
function dessinerBanniere() {
  const banniere = etat.groupe.banniere;
  bandeau.hidden = !banniere;
  if (!banniere) return;
  bandeau.dataset.fond = banniere.fond;
  document.getElementById('banniere-nom').textContent = etat.groupe.nom;
  const nombre = etat.membres.length;
  document.getElementById('banniere-infos').textContent = `${nombre} membre${nombre > 1 ? 's' : ''}`;
  document.getElementById('banniere-emoji').textContent = banniere.emoji;
}


/* 2. LE RÉGLAGE, dans Le groupe

   Les choix sont fabriqués une seule fois : un bouton radio caché sous
   chaque rectangle de fond (style.css, .choix-fond) et sous chaque
   emoji (.choix-emoji, comme dans le profil). « Aucun » = pas d'emoji. */
function choix(zone, nom, valeur, classe, etiquette, texte = '') {
  const element = creer('label', classe);
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = nom;
  radio.value = valeur;
  radio.setAttribute('aria-label', etiquette);
  element.append(radio, creer('span', '', texte));
  zone.append(element);
  return element;
}
for (const fond of FONDS) choix(zoneFonds, 'fond', fond.id, 'choix-fond', fond.nom).dataset.fond = fond.id;
choix(zoneEmojis, 'emoji', '', 'choix-emoji choix-initiale', 'Aucun emoji', '—');
for (const emoji of EMOJIS) choix(zoneEmojis, 'emoji', emoji, 'choix-emoji', emoji, emoji);

/* Pour les organisateurs (etat.peutGerer). Dans un groupe gratuit :
   le titre, une phrase et le « + » vers AllReady+ (data-plus,
   js/plus.js). Dans un groupe abonné : les choix, cochés sur la
   bannière actuelle (ou « Couleurs du site », sans emoji). Pas
   pendant qu'on est en train de choisir : le rafraîchissement
   régulier de la page effacerait le choix en cours. */
let enCours = false;
function dessinerReglage() {
  formulaire.hidden = !etat.peutGerer;
  if (formulaire.hidden) return;
  const premium = etat.groupe.premium;
  document.getElementById('banniere-plus').hidden = premium;
  document.getElementById('banniere-aide').hidden = premium;
  document.getElementById('banniere-choix').hidden = !premium;
  retirer.hidden = !etat.groupe.banniere;
  if (!premium || enCours) return;
  const banniere = etat.groupe.banniere || { fond: 'theme', emoji: '' };
  formulaire.elements.fond.value = banniere.fond;
  formulaire.elements.emoji.value = banniere.emoji;
}
formulaire.addEventListener('change', () => { enCours = true; });

quandCaChange(() => {
  dessinerBanniere();
  dessinerReglage();
});

async function enregistrer(banniere, message) {
  try {
    await appeler('', { methode: 'PATCH', corps: { banniere } });
    enCours = false;
    annoncer(message);
    await charger();
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
}

formulaire.addEventListener('submit', (evenement) => {
  evenement.preventDefault();
  const { fond, emoji } = formulaire.elements;
  enregistrer({ fond: fond.value, emoji: emoji.value }, 'Bannière enregistrée : elle est en haut de La team.');
});

retirer.addEventListener('click', () => enregistrer(null, 'Bannière retirée.'));
