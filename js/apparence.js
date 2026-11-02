/* LE CHOIX DE LA COULEUR DU SITE

   Le rond coloré de l'en-tête ouvre une palette de six thèmes. Le
   choix vaut pour cet appareil seulement (rangé dans le localStorage,
   clé « allready-theme ») et ne change rien pour les autres membres.

   L'ouverture et la fermeture de la palette sont gérées par le
   navigateur lui-même (attribut popover dans le HTML). Ce fichier se
   contente de fabriquer les options et de retenir le choix. Il est
   importé par accueil.js et groupe.js, et s'installe tout seul. */

import { creer } from './commun.js';

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

const palette = document.getElementById('choix-theme');

if (palette) {
  // Le thème en cours : celui posé par theme.js, ou Braise par défaut.
  const pose = document.documentElement.dataset.theme;
  const actuel = THEMES.some((theme) => theme.id === pose) ? pose : 'braise';

  const liste = creer('div', 'choix-theme-liste');
  // role="radiogroup" + aria-labelledby : un lecteur d'écran annonce
  // « Couleur du site, groupe de boutons radio ».
  liste.setAttribute('role', 'radiogroup');
  liste.setAttribute('aria-labelledby', 'titre-choix-theme');

  for (const theme of THEMES) {
    const option = creer('label', 'theme-option');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'theme';
    radio.value = theme.id;
    radio.checked = theme.id === actuel;
    radio.addEventListener('change', () => choisir(theme.id));

    // L'échantillon porte lui-même data-theme : il prend les couleurs
    // de SON thème, quel que soit celui du site.
    const echantillon = creer('span', 'echantillon');
    echantillon.dataset.theme = theme.id;
    echantillon.setAttribute('aria-hidden', 'true');

    option.append(radio, echantillon, creer('span', '', theme.nom));
    liste.append(option);
  }
  palette.append(liste);
}

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
