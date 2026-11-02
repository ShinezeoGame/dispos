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
// sous les yeux) et le retient pour les prochaines visites.
function choisir(id) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(CLE, id);
  } catch {
    // Stockage bloqué : le choix vaut pour cette page seulement.
  }
}
