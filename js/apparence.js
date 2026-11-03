/* LE CHOIX DE LA COULEUR DU SITE

   Le rond coloré de l'en-tête ouvre une palette : six thèmes pour tout
   le monde, puis trois thèmes exclusifs (AllReady+, 3 nov. 2026). Le
   choix vaut pour cet appareil seulement (rangé dans le localStorage,
   clé « allready-theme ») et ne change rien pour les autres membres.

   L'ouverture et la fermeture de la palette sont gérées par le
   navigateur lui-même (attribut popover dans le HTML). Ce fichier se
   contente de fabriquer les options et de retenir le choix. Il est
   importé par accueil.js et groupe.js, et s'installe tout seul. */

import { creer, annoncer } from './commun.js';

const CLE = 'allready-theme';

/* Les thèmes proposés, du plus chaud au plus froid. Leurs couleurs sont
   dans style.css (« Les thèmes ») : un id ici = un bloc là-bas.
   Le thème « or » a disparu le 2 nov. 2026 (le jaune virait au moutarde
   sur l'agenda) : qui l'avait choisi retombe sur Braise, puisqu'aucun
   bloc du CSS ne correspond plus à « or ». */
const THEMES = [
  { id: 'braise', nom: 'Braise' },
  { id: 'lave', nom: 'Lave' },
  { id: 'sakura', nom: 'Sakura' },
  { id: 'neon', nom: 'Néon' },
  { id: 'plasma', nom: 'Plasma' },
  { id: 'glace', nom: 'Glace' },
];

/* LES THÈMES EXCLUSIFS (AllReady+, 3 nov. 2026) : ils teintent aussi le
   fond du site. Débloqués pour qui soutient AllReady ou fait partie
   d'un groupe AllReady+ : c'est le serveur qui le dit (compte.themes,
   themesDebloques dans functions/_outils.js), puis la page appelle
   debloquerThemes(). Tant qu'on ne sait pas, ils sont verrouillés : un
   bouton avec un « + » à la place du choix. */
const EXCLUSIFS = [
  { id: 'rubis', nom: 'Rubis' },
  { id: 'corail', nom: 'Corail' },
  { id: 'nebuleuse', nom: 'Nébuleuse' },
];
let debloques = false;

const palette = document.getElementById('choix-theme');

/* La palette, fabriquée de zéro à chaque fois (au chargement, puis
   quand on apprend si les thèmes exclusifs sont débloqués). */
function dessinerPalette() {
  if (!palette) return; // la page 404 n'a pas de palette
  // Le thème en cours : celui posé par theme.js, ou Braise par défaut.
  const pose = document.documentElement.dataset.theme;
  const tous = [...THEMES, ...EXCLUSIFS];
  const actuel = tous.some((theme) => theme.id === pose) ? pose : 'braise';

  const liste = creer('div', 'choix-theme-liste');
  // role="radiogroup" + aria-labelledby : un lecteur d'écran annonce
  // « Couleur du site, groupe de boutons radio ».
  liste.setAttribute('role', 'radiogroup');
  liste.setAttribute('aria-labelledby', 'titre-choix-theme');
  for (const theme of THEMES) liste.append(option(theme, actuel));
  // Le petit titre des exclusifs, sur toute la largeur de la grille.
  liste.append(creer('p', 'choix-theme-titre choix-theme-exclusifs', 'AllReady+'));
  for (const theme of EXCLUSIFS) {
    // Le thème déjà choisi reste un vrai choix, même verrouillé.
    liste.append(debloques || theme.id === actuel ? option(theme, actuel, true) : verrou(theme));
  }
  palette.querySelector('.choix-theme-liste')?.remove();
  palette.append(liste);
}

// L'échantillon porte lui-même data-theme : il prend les couleurs de
// SON thème, quel que soit celui du site. Un exclusif : en dégradé.
function echantillon(theme, exclusif) {
  const rond = creer('span', exclusif ? 'echantillon exclusif' : 'echantillon');
  rond.dataset.theme = theme.id;
  rond.setAttribute('aria-hidden', 'true');
  return rond;
}

// Un thème qu'on peut choisir : un bouton radio caché sous l'option.
function option(theme, actuel, exclusif = false) {
  const etiquette = creer('label', 'theme-option');
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'theme';
  radio.value = theme.id;
  radio.checked = theme.id === actuel;
  radio.addEventListener('change', () => choisir(theme.id));
  etiquette.append(radio, echantillon(theme, exclusif), creer('span', '', theme.nom));
  return etiquette;
}

/* Un thème verrouillé : un bouton qui explique. Sur la page d'un
   groupe, data-plus ouvre la fenêtre AllReady+ (js/plus.js) ; sur
   l'accueil, qui n'a pas cette fenêtre, un message en bas de l'écran. */
function verrou(theme) {
  const bouton = creer('button', 'theme-option verrouille');
  bouton.type = 'button';
  bouton.setAttribute('aria-label', `${theme.nom} : réservé à AllReady+ et aux soutiens, en savoir plus`);
  bouton.append(echantillon(theme, true), creer('span', '', theme.nom), creer('span', 'theme-plus', '+'));
  if (document.getElementById('dialogue-plus')) {
    bouton.dataset.plus = '';
  } else {
    bouton.addEventListener('click', () => {
      annoncer('Thème réservé aux membres d\'un groupe AllReady+ et aux soutiens d\'AllReady.');
    });
  }
  return bouton;
}

/* Appelée par la page quand le serveur a répondu (accueil.js,
   groupe.js). droit : les exclusifs sont-ils débloqués ? certain : la
   page le sait-elle vraiment (un compte connecté) ? Sans droit, et
   seulement si c'est certain, un thème exclusif déjà choisi sur cet
   appareil retombe sur Braise. Sans compte, on ne retire rien : la
   page ne sait pas qui est là. */
export function debloquerThemes(droit, certain) {
  const pose = document.documentElement.dataset.theme;
  const retire = !droit && certain && EXCLUSIFS.some((theme) => theme.id === pose);
  if (retire) choisir('braise');
  if (droit === debloques && !retire) return; // rien de neuf : la palette est déjà juste
  debloques = droit;
  dessinerPalette();
}

dessinerPalette();

// Applique le thème tout de suite (tout le site change de couleur
// sous les yeux, l'icône de l'onglet aussi) et le retient pour les
// prochaines visites.
function choisir(id) {
  document.documentElement.dataset.theme = id;
  colorerIcone();
  try {
    localStorage.setItem(CLE, id);
  } catch {
    // Stockage bloqué : le choix vaut pour cette page seulement.
  }
}


/* L'ICÔNE DE L'ONGLET AUX COULEURS DU THÈME (2 nov. 2026, demandé)

   assets/favicon.svg est dessinée en orange Braise (#ff7a3d). Pour un
   autre thème :
   1. on relit ce fichier (le navigateur l'a déjà en mémoire) ;
   2. on remplace l'orange par l'accent du thème (--accent, lu dans le
      CSS : getComputedStyle donne la valeur en vigueur) ;
   3. on donne le résultat à l'onglet en adresse « data: », qui contient
      toute l'image dans son texte. encodeURIComponent protège les
      caractères qui casseraient une adresse (#, <, espaces…).
   Pas un fichier par thème : le dessin n'existe qu'une fois. En Braise,
   on remet simplement le fichier d'origine. */
const lienIcone = document.querySelector('link[rel="icon"]');
const ORANGE_DU_DESSIN = '#ff7a3d';
let dessinIcone = null; // le texte de favicon.svg, lu une seule fois

async function colorerIcone() {
  if (!lienIcone) return;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase();
  if (!accent || accent === ORANGE_DU_DESSIN) {
    lienIcone.href = '/assets/favicon.svg';
    return;
  }
  try {
    if (!dessinIcone) dessinIcone = await (await fetch('/assets/favicon.svg')).text();
    lienIcone.href = 'data:image/svg+xml,' + encodeURIComponent(dessinIcone.replaceAll(ORANGE_DU_DESSIN, accent));
  } catch {
    // Hors ligne : l'icône orange reste, rien de grave.
  }
}

// Dès l'ouverture de la page, pour le thème retenu par theme.js.
colorerIcone();
