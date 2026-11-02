/* L'AGENDA COMMUN

   Une grille de 7 jours × 18 heures (de 9 h à 3 h du matin), avec deux
   façons de la regarder :

   — « Le groupe » : chaque case est d'autant plus vive que plus de
     monde y est dispo, avec le nombre dedans. Toucher une case montre
     qui exactement, et permet d'y proposer une soirée.

   — « Mes dispos » : tu coches tes cases, d'un clic ou en glissant.
     Chaque modification est enregistrée toute seule, un instant après.

   Au-dessus, les « meilleurs créneaux » : les moments de la semaine où
   le plus de potes sont dispos ensemble. */

import {
  etat, quandCaChange, charger, appeler, trouverMembre, mesCases,
  debutCase, caseDe,
} from './etat.js';
import {
  HEURE_DEBUT, HEURE_FIN, ajouterJours, lundiDe, versTexte, formater,
  libelleHeure, avatar, annoncer, creer, majuscule, animerEntree,
} from './commun.js';
import { proposerSoiree } from './soirees.js';
import { ouvrirProfil } from './profil.js';

const grille = document.getElementById('grille');
const boutonsMode = document.querySelectorAll('.bascule button');
const aide = document.getElementById('aide-agenda');
const statut = document.getElementById('statut-sauvegarde');
const detail = document.getElementById('detail-case');
const meilleurs = document.getElementById('meilleurs-contenu');
const sectionMeilleurs = document.getElementById('meilleurs');

let mode = 'groupe';     // 'groupe' ou 'moi'
let caseChoisie = null;  // la case touchée en mode groupe, ex. "4-21"

// Un écran tactile n'a pas de survol et se fait défiler au doigt :
// l'aide n'est pas formulée pareil.
const tactile = matchMedia('(pointer: coarse)').matches;


/* LE TEMPS */

// Une case est passée quand son heure est finie : 21 h – 22 h est
// passée à 22 h.
function estPassee(jour, heure) {
  return debutCase(jour, heure + 1) <= new Date();
}

// "vendredi 6 novembre, 21h", ou "nuit de vendredi 6 novembre, 1h".
function nomDeCase(jour, heure) {
  const date = formater(ajouterJours(etat.semaine, jour), { weekday: 'long', day: 'numeric', month: 'long' });
  return `${heure >= 24 ? 'nuit de ' : ''}${date}, ${libelleHeure(heure)}`;
}

// Ce qu'il faut au formulaire de soirée pour une case : la vraie date
// et l'heure (vendredi 25 → samedi, 01:00).
function soireeDepuisCase(jour, heure) {
  const debut = debutCase(jour, heure);
  return { jour: versTexte(debut), horaire: String(debut.getHours()).padStart(2, '0') + ':00' };
}


/* QUI EST DISPO OÙ

   Retourne une Map : case → liste des id des membres dispos.
   { "4-21" → [3, 5, 8], "4-22" → [3, 5], … } */
function compterDispos() {
  const parCase = new Map();
  for (const [id, cases] of etat.dispos) {
    for (const cle of cases) {
      if (!parCase.has(cle)) parCase.set(cle, []);
      parCase.get(cle).push(id);
    }
  }
  return parCase;
}

// Les soirées de la semaine affichée, rangées de la même façon.
function soireesParCase() {
  const parCase = new Map();
  for (const soiree of etat.soirees) {
    const cle = caseDe(soiree.jour, soiree.horaire);
    if (!cle) continue;
    if (!parCase.has(cle)) parCase.set(cle, []);
    parCase.get(cle).push(soiree);
  }
  return parCase;
}


/* LA CHANCE DE MONTER UNE SOIRÉE

   La part de la team dispo sur une case : 4 sur 5 = 0,8. C'est elle
   qui fait briller l'agenda. Seul, la chance est nulle : une soirée se
   joue au moins à deux (et un groupe d'une personne n'a personne à
   inviter). Les seuils des mots sont ceux qu'on donnerait à l'oral. */
const TRES_PROBABLE = 0.75;

function chanceDeSoiree(nombre, total) {
  if (nombre < 2 || total < 2) return { part: 0, libelle: '' };
  const part = nombre / total;
  let libelle = 'soirée peu probable';
  if (part >= TRES_PROBABLE) libelle = 'soirée très probable';
  else if (part >= 0.5) libelle = 'soirée possible';
  return { part, libelle };
}


/* LA COULEUR ET LA LUEUR D'UNE CASE (2 nov. 2026, demandé : « la
   différence entre 1 et 2 est presque invisible »)

   — niveau (de 0 à 1) : la vivacité de l'orange (--niveau dans le CSS) ;
   — eclat (de 0 à 1) : la lueur autour de la case (--eclat).

   Seul, on ne monte pas de soirée : une case à une personne reste une
   braise discrète (0,25), sans lueur. Dès deux, la soirée devient
   possible : la case saute à 0,45 et s'entoure d'une lueur (0,5), puis
   les deux montent ensemble jusqu'à la team complète (1).
   Avant, tout suivait la seule part de la team : dans un groupe de six,
   une et deux personnes ne différaient que d'un sixième d'orange. */
function intensite(nombre, total) {
  if (nombre <= 0) return { niveau: 0, eclat: 0 };
  if (nombre === 1 || total < 2) return { niveau: 0.25, eclat: 0 };
  // « montee » va de 0 (deux personnes) à 1 (toute la team).
  const montee = total > 2 ? (nombre - 2) / (total - 2) : 1;
  return { niveau: 0.45 + 0.55 * montee, eclat: 0.5 + 0.5 * montee };
}


/* LES MEILLEURS CRÉNEAUX

   On parcourt chaque jour heure par heure, et on regroupe les heures
   qui se suivent avec exactement les mêmes personnes dispos : 21 h,
   22 h et 23 h avec Léa, Max et Sam forment un seul créneau
   « 21h → 0h ». Il faut au moins deux personnes, et un créneau pas
   encore passé.

   Puis on classe : le plus de monde d'abord ; à égalité, le plus long ;
   à égalité encore, le plus tôt dans la semaine. On garde les trois
   premiers. */
function trouverMeilleurs(parCase) {
  const creneaux = [];
  for (let jour = 0; jour < 7; jour++) {
    let enCours = null;
    for (let heure = HEURE_DEBUT; heure < HEURE_FIN; heure++) {
      const ids = (parCase.get(`${jour}-${heure}`) || []).slice().sort((a, b) => a - b);
      const signature = ids.join(',');
      const utile = ids.length >= 2 && !estPassee(jour, heure);

      if (utile && enCours && enCours.signature === signature) {
        enCours.fin = heure + 1; // même équipe : le créneau s'allonge
      } else {
        if (enCours) creneaux.push(enCours);
        enCours = utile ? { jour, debut: heure, fin: heure + 1, ids, signature } : null;
      }
    }
    if (enCours) creneaux.push(enCours);
  }

  return creneaux
    .sort((a, b) => b.ids.length - a.ids.length
      || (b.fin - b.debut) - (a.fin - a.debut)
      || a.jour - b.jour
      || a.debut - b.debut)
    .slice(0, 3);
}


/* LE DESSIN

   Appelé à chaque changement de etat (voir etat.js). La grille entière
   est refaite : 126 boutons, c'est instantané. */
function dessiner() {
  if (!etat.groupe) return;
  // Un visiteur pas encore inscrit n'a pas de dispos à cocher.
  if (!etat.moi && mode === 'moi') mode = 'groupe';

  dessinerSemaine();
  for (const bouton of boutonsMode) {
    bouton.setAttribute('aria-pressed', bouton.dataset.mode === mode);
  }
  /* Une seule aide, en mode « Mes dispos » : le geste (glisser pour
     cocher plusieurs cases) ne se devine pas. Sur écran tactile, elle dit
     aussi comment faire défiler. En mode groupe, rien : les couleurs se
     comprennent seules, et toucher une case affiche son détail. */
  aide.textContent = mode !== 'moi' ? ''
    : tactile ? 'Touche ou glisse sur tes heures dispos. Pour faire défiler, glisse sur les heures.'
    : 'Clique ou glisse sur tes heures dispos.';
  aide.hidden = mode !== 'moi';

  dessinerGrille();
  dessinerMeilleurs();
  dessinerDetail();
  ajusterHauteur();
}
quandCaChange(dessiner);


/* TOUT L'AGENDA D'UN COUP D'ŒIL (ordinateur, 2 nov. 2026, demandé :
   « voir tout l'agenda sans avoir à scroller »)

   Sur un écran d'au moins 64rem (1024 px) de large, la hauteur des
   cases est calculée pour que toute la grille, de 9 h à 3 h, tienne
   dans la fenêtre :
   1. où commence la grille dans la page (hautDansLaPage) ;
   2. ce qu'elle a de fixe : la ligne des jours, les espaces entre les
      lignes, la coupure de minuit (sa hauteur totale moins ses cases) ;
   3. le reste de la fenêtre, partagé entre les 18 lignes.
   Entre 17 px (encore lisible) et 34 px (au-delà, les cases
   deviendraient des pavés). Sur un écran vraiment bas, la page défile
   un peu, voilà tout. Sur téléphone, la hauteur reste celle du CSS. */
const ordinateur = matchMedia('(min-width: 64rem)');
const LIGNES = HEURE_FIN - HEURE_DEBUT; // 18 heures

/* La distance entre le haut de la page et l'élément. offsetTop plutôt
   que getBoundingClientRect : il ignore les animations d'arrivée
   (translate), qui fausseraient la mesure pendant une fraction de
   seconde. */
function hautDansLaPage(element) {
  let haut = 0;
  for (let e = element; e; e = e.offsetParent) haut += e.offsetTop;
  return haut;
}

function ajusterHauteur() {
  const premiere = grille.querySelector('.case');
  if (!ordinateur.matches) {
    grille.style.removeProperty('--hauteur-case');
    return;
  }
  // Onglet Agenda caché (offsetParent vaut null) : rien à mesurer.
  if (!premiere || !grille.offsetParent) return;
  const actuelle = premiere.offsetHeight;
  const fixe = grille.offsetHeight - LIGNES * actuelle;
  const place = window.innerHeight - hautDansLaPage(grille) - fixe - 16; // 16 px d'air en bas
  const hauteur = Math.max(17, Math.min(34, Math.floor(place / LIGNES)));
  if (hauteur !== actuelle) grille.style.setProperty('--hauteur-case', `${hauteur}px`);
}

/* On recalcule quand la fenêtre change de taille, quand la police des
   titres finit d'arriver (elle change la hauteur de l'en-tête), et quand
   l'onglet Agenda réapparaît (ResizeObserver : prévenu dès que la taille
   de la section change, y compris de « caché » à « visible »). */
window.addEventListener('resize', ajusterHauteur);
ordinateur.addEventListener('change', ajusterHauteur);
document.fonts.ready.then(ajusterHauteur);
new ResizeObserver(ajusterHauteur).observe(document.getElementById('vue-agenda'));

function dessinerSemaine() {
  const ecart = Math.round((etat.semaine - lundiDe(new Date())) / (7 * 86400000));
  const noms = { '-1': 'Semaine dernière', 0: 'Cette semaine', 1: 'Semaine prochaine' };
  document.getElementById('semaine-titre').textContent = noms[ecart]
    || `Semaine du ${formater(etat.semaine, { day: 'numeric', month: 'long' })}`;
  const court = { day: 'numeric', month: 'short' };
  document.getElementById('semaine-dates').textContent =
    `${formater(etat.semaine, court)} – ${formater(ajouterJours(etat.semaine, 6), court)}`;
  document.getElementById('semaine-retour').hidden = ecart === 0;
}

function dessinerGrille() {
  const parCase = compterDispos();
  const soirees = soireesParCase();
  const total = etat.membres.length;
  const miennes = etat.moi ? mesCases() : new Set();
  const aujourdhui = versTexte(new Date());

  grille.classList.toggle('edition', mode === 'moi');

  // Un DocumentFragment est un brouillon hors de la page : on y range
  // les 150 éléments, puis on les pose tous d'un coup.
  const brouillon = document.createDocumentFragment();

  // Première ligne : un coin vide, puis le nom et le numéro des jours.
  brouillon.append(creer('span', 'grille-coin'));
  for (let jour = 0; jour < 7; jour++) {
    const date = ajouterJours(etat.semaine, jour);
    const tete = creer('span', 'grille-jour');
    tete.classList.toggle('aujourdhui', versTexte(date) === aujourdhui);
    tete.append(
      creer('span', 'grille-jour-nom', formater(date, { weekday: 'short' }).replace('.', '')),
      creer('span', 'grille-jour-num', date.getDate()),
    );
    brouillon.append(tete);
  }

  // Puis une ligne par heure : l'heure, et les sept cases.
  for (let heure = HEURE_DEBUT; heure < HEURE_FIN; heure++) {
    const etiquette = creer('span', 'grille-heure', libelleHeure(heure));
    // Minuit ouvre la partie « nuit » de l'agenda : un petit espace la
    // sépare du reste de la soirée.
    etiquette.classList.toggle('minuit', heure === 24);
    brouillon.append(etiquette);

    for (let jour = 0; jour < 7; jour++) {
      const cle = `${jour}-${heure}`;
      const bouton = creer('button', 'case');
      bouton.type = 'button';
      bouton.dataset.cle = cle;
      // Sa colonne et sa ligne : elles règlent le départ de chaque case
      // dans la vague d'apparition (« Les animations », style.css).
      bouton.style.setProperty('--j', jour);
      bouton.style.setProperty('--rang', heure - HEURE_DEBUT);
      bouton.classList.toggle('minuit', heure === 24);
      const passee = estPassee(jour, heure);
      bouton.classList.toggle('passee', passee);

      if (mode === 'moi') {
        const cochee = miennes.has(cle);
        bouton.classList.toggle('cochee', cochee);
        // aria-pressed : un lecteur d'écran annonce « bouton bascule,
        // enfoncé » pour une case cochée.
        bouton.setAttribute('aria-pressed', cochee);
        bouton.setAttribute('aria-label', nomDeCase(jour, heure));
        bouton.disabled = passee;
      } else {
        const ids = parCase.get(cle) || [];
        const lesSoirees = soirees.get(cle) || [];
        // La vivacité et la lueur de la case : voir intensite() plus haut.
        const { niveau, eclat } = intensite(ids.length, total);
        if (ids.length > 0) {
          bouton.style.setProperty('--niveau', niveau);
          bouton.textContent = ids.length;
          /* Sur une case vive, le chiffre passe en sombre. Le seuil de
             0,5 suit les couleurs claires de style.css (« in
             srgb-linear ») : au-delà, le chiffre sombre se lit mieux
             que le blanc (contraste mesuré à 4,4 contre 4,1). */
          bouton.classList.toggle('forte', niveau > 0.5);
          // Au survol de la souris, une bulle dit qui : « Toi, Léa, Sam ».
          bouton.title = ids.map((id) => (id === etat.moi?.id ? 'Toi' : trouverMembre(id)?.pseudo)).join(', ');
        }
        /* LA BRILLANCE : --eclat (de 0 à 1) règle la lueur autour de la
           case dans le CSS. « brille » ajoute un reflet qui la balaie, à
           partir de « très probable » (la part de la team, chance.part).
           --decalage fait partir le reflet un peu plus tard à chaque
           jour : une vague de gauche à droite plutôt que des éclairs
           simultanés. */
        const chance = chanceDeSoiree(ids.length, total);
        bouton.style.setProperty('--eclat', eclat);
        // « lumineuse » : la case passe au-dessus de ses voisines, pour que
        // sa lueur se voie tout autour (voir style.css).
        bouton.classList.toggle('lumineuse', eclat > 0);
        bouton.style.setProperty('--decalage', `${jour * 0.18}s`);
        bouton.classList.toggle('brille', chance.part >= TRES_PROBABLE);
        bouton.classList.toggle('moi', miennes.has(cle));
        bouton.classList.toggle('avec-soiree', lesSoirees.length > 0);
        bouton.classList.toggle('choisie', cle === caseChoisie);
        bouton.setAttribute('aria-label', `${nomDeCase(jour, heure)} : ${ids.length ? `${ids.length} sur ${total}` : 'personne'}`
          + (chance.part ? `, ${chance.libelle}` : '')
          + (lesSoirees.length ? `, soirée ${lesSoirees.map((s) => s.titre).join(', ')}` : ''));
      }
      brouillon.append(bouton);
    }
  }

  grille.replaceChildren(brouillon);
}

/* La section entière (titre compris) n'apparaît que s'il y a au moins
   un créneau à proposer. Seul dans le groupe, ou sans créneau commun, il
   n'y a rien à montrer : pas de message pour le dire. Pour inviter, le
   bouton « Inviter » de l'en-tête suffit (il passe en orange tant qu'on
   est seul, voir groupe.js). En mode « Mes dispos » non plus : on y
   coche ses heures, les cartes ne feraient que repousser la grille. */
function dessinerMeilleurs() {
  meilleurs.replaceChildren();
  const creneaux = etat.membres.length < 2 || mode === 'moi' ? [] : trouverMeilleurs(compterDispos());
  sectionMeilleurs.hidden = creneaux.length === 0;

  for (const creneau of creneaux) {
    /* La carte entière est le bouton : un clic propose une soirée à ce
       moment-là. Plus léger que trois gros boutons « Proposer une
       soirée » identiques, un par carte. Les div et span sont permis
       dans un bouton (pas les p ni les titres). */
    const carte = creer('button', 'creneau');
    carte.type = 'button';
    const tousLa = creneau.ids.length === etat.membres.length;
    carte.classList.toggle('complet', tousLa);

    const jour = ajouterJours(etat.semaine, creneau.jour);
    const quand = creer('span', 'creneau-quand');
    quand.append(
      creer('strong', '', majuscule(formater(jour, { weekday: 'short', day: 'numeric', month: 'short' }))),
      ` ${libelleHeure(creneau.debut)} → ${libelleHeure(creneau.fin)}`,
    );

    // Les avatars et « 4 potes sur 5 » sur une même ligne.
    const equipe = creer('span', 'creneau-equipe');
    const avatars = creer('span', 'avatars');
    for (const id of creneau.ids) avatars.append(avatar(trouverMembre(id)));
    equipe.append(avatars, creer('span', 'creneau-combien',
      tousLa ? 'Tout le monde !' : `${creneau.ids.length} sur ${etat.membres.length}`));

    carte.append(quand, equipe, creer('span', 'creneau-action', 'Proposer une soirée'));
    // Ce qu'un lecteur d'écran annonce, au lieu des initiales des avatars une à une.
    carte.setAttribute('aria-label', `Proposer une soirée : ${quand.textContent}, ${equipe.lastChild.textContent}`);
    carte.addEventListener('click', () => proposerSoiree(soireeDepuisCase(creneau.jour, creneau.debut)));
    meilleurs.append(carte);
  }
}

// Le panneau sous la grille quand on touche une case en mode groupe.
function dessinerDetail() {
  if (mode !== 'groupe' || !caseChoisie) {
    detail.hidden = true;
    return;
  }
  const [jour, heure] = caseChoisie.split('-').map(Number);
  const ids = compterDispos().get(caseChoisie) || [];
  const soirees = soireesParCase().get(caseChoisie) || [];

  /* « Ven. 6 nov. · 21h → 22h », « Nuit de ven. 6 nov. · 1h → 2h ».
     La date courte tient sur une ligne, même dans la colonne étroite de
     l'ordinateur. */
  const date = formater(ajouterJours(etat.semaine, jour), { weekday: 'short', day: 'numeric', month: 'short' });
  detail.replaceChildren(creer('h3', 'detail-titre',
    majuscule(`${heure >= 24 ? 'nuit de ' : ''}${date} · ${libelleHeure(heure)} → ${libelleHeure(heure + 1)}`)));

  // La chance de monter une soirée, en clair : « 80 % de la team · soirée très probable ».
  const chance = chanceDeSoiree(ids.length, etat.membres.length);
  if (chance.part) {
    const ligne = creer('p', 'detail-chance', `${Math.round(chance.part * 100)} % de la team · ${chance.libelle}`);
    ligne.classList.toggle('tres-probable', chance.part >= TRES_PROBABLE);
    detail.append(ligne);
  }

  if (ids.length > 0) {
    const liste = creer('ul', 'detail-membres');
    for (const id of ids) {
      const membre = trouverMembre(id);
      const element = creer('li');
      element.append(avatar(membre), membre.id === etat.moi?.id ? 'Toi' : membre.pseudo);
      liste.append(element);
    }
    detail.append(liste);
  } else {
    detail.append(creer('p', 'vide', "Personne n'a coché ce créneau."));
  }

  for (const soiree of soirees) {
    detail.append(creer('p', 'detail-soiree', `${soiree.titre} à ${soiree.horaire.replace(':', 'h')}`));
  }

  if (!estPassee(jour, heure)) {
    const bouton = creer('button', 'bouton bouton-petit', `Proposer une soirée à ${libelleHeure(heure)}`);
    bouton.type = 'button';
    bouton.addEventListener('click', () => proposerSoiree(soireeDepuisCase(jour, heure)));
    detail.append(bouton);
  }
  detail.hidden = false;
}


/* COCHER SES CASES

   « peinture » retient ce qu'on fait pendant un glissement : true si
   la première case touchée était vide (on coche tout ce qu'on
   survole), false si elle était cochée (on décoche), null quand on ne
   glisse pas. Sans ça, glisser sur des cases mélangées les
   inverserait une par une, en damier.

   Les « pointer events » couvrent d'un coup souris, doigt et stylet. */
let peinture = null;

function peindre(bouton) {
  if (!bouton || bouton.disabled || !bouton.classList.contains('case')) return;
  if (peinture) mesCases().add(bouton.dataset.cle);
  else mesCases().delete(bouton.dataset.cle);
  bouton.classList.toggle('cochee', peinture);
  bouton.setAttribute('aria-pressed', peinture);
}

grille.addEventListener('pointerdown', (evenement) => {
  if (mode !== 'moi' || evenement.button !== 0) return;
  const bouton = evenement.target.closest('.case');
  if (!bouton || bouton.disabled) return;
  // Empêche le navigateur de sélectionner du texte pendant le glissement.
  evenement.preventDefault();
  peinture = !bouton.classList.contains('cochee');
  peindre(bouton);
});

/* Pendant le glissement, le doigt « appartient » à la case de départ :
   evenement.target resterait celle-là. elementFromPoint demande quel
   élément se trouve réellement sous le doigt. */
grille.addEventListener('pointermove', (evenement) => {
  if (peinture === null) return;
  const sousLeDoigt = document.elementFromPoint(evenement.clientX, evenement.clientY);
  peindre(sousLeDoigt && sousLeDoigt.closest('.case'));
});

// Sur window et non sur la grille : le glissement peut se terminer
// en dehors.
function finirPeinture() {
  if (peinture === null) return;
  peinture = null;
  programmerSauvegarde();
  dessinerMeilleurs();
}
window.addEventListener('pointerup', finirPeinture);
window.addEventListener('pointercancel', finirPeinture);

grille.addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('.case');
  if (!bouton) return;

  if (mode === 'moi') {
    /* La souris et le doigt sont déjà passés par pointerdown. Reste le
       clavier (Entrée ou Espace sur une case) : il produit un clic
       dont evenement.detail vaut 0, alors qu'un vrai clic compte 1. */
    if (evenement.detail !== 0) return;
    peinture = !bouton.classList.contains('cochee');
    peindre(bouton);
    finirPeinture();
    return;
  }

  // Mode groupe : toucher une case affiche le détail, la retoucher le ferme.
  caseChoisie = caseChoisie === bouton.dataset.cle ? null : bouton.dataset.cle;
  for (const autre of grille.querySelectorAll('.choisie')) autre.classList.remove('choisie');
  if (caseChoisie) bouton.classList.add('choisie');
  dessinerDetail();
});

// Échap ferme aussi le détail (sauf si une fenêtre est ouverte : c'est
// alors elle qu'Échap ferme).
document.addEventListener('keydown', (evenement) => {
  if (evenement.key !== 'Escape' || !caseChoisie || document.querySelector('dialog[open]')) return;
  caseChoisie = null;
  for (const autre of grille.querySelectorAll('.choisie')) autre.classList.remove('choisie');
  dessinerDetail();
});


/* L'ENREGISTREMENT

   On n'envoie pas une requête par case : on attend 0,8 s sans
   nouvelle modification, puis on envoie toute la semaine d'un coup.
   Glisser sur dix cases = un seul envoi. */
let minuterie = null;

function programmerSauvegarde() {
  etat.sauvegardeEnAttente = true;
  statut.textContent = 'Modifications en attente…';
  clearTimeout(minuterie);
  minuterie = setTimeout(sauvegarder, 800);
}

async function sauvegarder() {
  clearTimeout(minuterie);
  if (!etat.sauvegardeEnAttente) return;
  etat.sauvegardeEnAttente = false;
  statut.textContent = 'Enregistrement…';
  // "4-21" → [4, 21], le format attendu par le serveur.
  const creneaux = [...mesCases()].map((cle) => cle.split('-').map(Number));
  try {
    await appeler('/dispos', { methode: 'PUT', corps: { semaine: versTexte(etat.semaine), creneaux } });
    statut.textContent = 'Enregistré ✓';
  } catch (probleme) {
    statut.textContent = '';
    annoncer(probleme.message, 'erreur');
  }
}

// Si tu quittes l'onglet juste après avoir coché, on envoie sans attendre.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sauvegarder();
});


/* LES BOUTONS AUTOUR DE LA GRILLE */

async function changerSemaine(nouvelle) {
  await sauvegarder(); // d'abord finir d'enregistrer la semaine qu'on quitte
  const ancienne = etat.semaine;
  etat.semaine = nouvelle;
  caseChoisie = null;
  statut.textContent = '';
  try {
    await charger();
    // La nouvelle semaine s'allume en vague, colonne après colonne.
    animerEntree(grille);
  } catch (probleme) {
    etat.semaine = ancienne;
    annoncer(probleme.message, 'erreur');
  }
}

document.getElementById('semaine-avant').addEventListener('click', () => changerSemaine(ajouterJours(etat.semaine, -7)));
document.getElementById('semaine-apres').addEventListener('click', () => changerSemaine(ajouterJours(etat.semaine, 7)));
document.getElementById('semaine-retour').addEventListener('click', () => changerSemaine(lundiDe(new Date())));

for (const bouton of boutonsMode) {
  bouton.addEventListener('click', () => {
    if (bouton.dataset.mode === 'moi' && !etat.moi) {
      ouvrirProfil(); // il faut un pseudo pour cocher ses dispos
      return;
    }
    if (mode === 'moi') sauvegarder();
    mode = bouton.dataset.mode;
    caseChoisie = null;
    dessiner();
  });
}
