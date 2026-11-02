/* CE QUI SERT AUX DEUX PAGES

   Ce fichier est un « module » : il range ses outils derrière le mot
   export, et les autres fichiers vont les chercher avec import. Le
   HTML le charge avec <script type="module">, ce qui a deux effets :
   le script attend que la page soit construite avant de démarrer, et
   chaque fichier n'est téléchargé qu'une fois même si plusieurs
   l'importent. */


/* LES RÉGLAGES — à garder identiques à ceux de functions/_outils.js,
   qui refuse tout ce qui en sort. */

// L'agenda va de 9 h à 3 h du matin. Au-delà de 23, l'heure appartient
// à la soirée de la veille : 25 = 1 h du matin la nuit qui suit.
export const HEURE_DEBUT = 9;
export const HEURE_FIN = 27; // exclue : la dernière case est 2 h – 3 h

export const COULEURS = [
  '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c',
  '#4dd4e8', '#748ffc', '#b197fc', '#f783ac',
];

// La personnalisation des profils : avatars possibles, plateformes,
// styles de jeu. À garder identiques à functions/_outils.js, qui refuse
// tout ce qui n'est pas dans ces listes.
export const EMOJIS = ['🎮', '🕹️', '👾', '🤖', '👻', '💀', '🐉', '🦊', '🐸', '🐼', '🦄', '🔥', '⚡', '🌙', '🍕', '🎧'];
export const PLATEFORMES = [
  { id: 'pc', nom: 'PC' }, { id: 'playstation', nom: 'PlayStation' }, { id: 'xbox', nom: 'Xbox' },
  { id: 'switch', nom: 'Switch' }, { id: 'mobile', nom: 'Mobile' },
];
export const STYLES = [
  { id: 'chill', nom: 'Chill' }, { id: 'tryhard', nom: 'Tryhard' }, { id: 'les-deux', nom: 'Un peu des deux' },
];

/* LA MONÉTISATION (2 nov. 2026). Vides tant que rien n'est choisi : ce
   qu'elles affichent reste alors caché. Une adresse à coller entre les
   apostrophes, puis commit et push.

   LIEN_SOUTIEN : ta page Ko-fi ou Tipeee, par exemple
     'https://ko-fi.com/allready'. Fait apparaître « Soutenir AllReady »
     en bas de l'accueil.
   LIEN_PRIX : l'adresse de recherche que donne ton programme
     d'affiliation, avec {jeu} à la place du nom du jeu, par exemple
     'https://www.instant-gaming.com/fr/rechercher/?q={jeu}&igr=TONCODE'.
     Fait apparaître « Voir le prix » sur une soirée dont le jeu n'est
     pas dans ton profil. */
export const LIEN_SOUTIEN = '';
export const LIEN_PRIX = '';

/* LIEN_PREMIUM (2 nov. 2026) : la page d'abonnement AllReady+ (un
   abonnement Ko-fi, par exemple 'https://ko-fi.com/allready/tiers').
   Vide : la fenêtre AllReady+ dit « Bientôt disponible ». Rempli : un
   bouton « S'abonner », et la consigne de donner le code du groupe dans
   son message, pour l'activer à la main (groupes.premium). */
export const LIEN_PREMIUM = '';


/* PARLER AU SERVEUR

   Une seule fonction pour toutes les requêtes. Elle ajoute ce qu'il
   faut à chaque fois (le format JSON, le jeton), et transforme toute
   réponse d'erreur en exception portant la phrase du serveur. Le code
   qui l'appelle n'a plus qu'à écrire :

     try { await api(…) } catch (e) { annoncer(e.message) }

   chemin : la fin de l'adresse, après /api (ex. "/groupes")
   corps  : l'objet à envoyer, transformé en texte JSON
   jeton  : le secret du membre, s'il en a un */
export async function api(chemin, { methode = 'GET', corps, jeton } = {}) {
  const entetes = {};
  if (corps !== undefined) entetes['Content-Type'] = 'application/json';
  if (jeton) entetes.Authorization = 'Bearer ' + jeton;

  let reponse;
  try {
    reponse = await fetch('/api' + chemin, {
      method: methode,
      headers: entetes,
      body: corps === undefined ? undefined : JSON.stringify(corps),
      // keepalive : l'envoi va au bout même si la page se ferme juste
      // après (dernières cases cochées avant de quitter l'onglet).
      keepalive: methode !== 'GET',
    });
  } catch {
    // fetch n'échoue de lui-même que si le serveur est injoignable.
    throw new Error('Impossible de joindre le serveur. Vérifie ta connexion.');
  }

  // .catch(() => ({})) : une réponse vide ou qui n'est pas du JSON
  // donne un objet vide au lieu de tout faire planter.
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const probleme = new Error(donnees.erreur || `Le serveur a répondu ${reponse.status}.`);
    probleme.statut = reponse.status;
    throw probleme;
  }
  return donnees;
}


/* CE QUE LE NAVIGATEUR RETIENT

   Tout tient dans une seule clé du localStorage, « dispos » :

     { "ABCD2345": { nom: "Les potes", jeton: "…" }, … }

   Le nom sert à la liste « Tes groupes » de l'accueil ; le jeton
   prouve au serveur qui tu es dans ce groupe. Ni cookie, ni compte.

   Les try/catch : en navigation privée, ou si le visiteur a bloqué le
   stockage, localStorage peut refuser de lire ou d'écrire. Le site
   marche alors quand même, il oubliera juste tout à la fermeture. */
// « dispos » : l'ancien nom du site. NE PAS le remplacer par « allready » :
// tous ceux qui ont déjà rejoint un groupe perdraient leur jeton, donc
// l'accès à leur profil.
const CLE = 'dispos';

export function lireGroupes() {
  try {
    return JSON.parse(localStorage.getItem(CLE)) || {};
  } catch {
    return {};
  }
}

function ecrireGroupes(groupes) {
  try {
    localStorage.setItem(CLE, JSON.stringify(groupes));
  } catch {
    // Rien à faire : voir plus haut.
  }
}

// Fusionne : retenirGroupe(code, { jeton }) garde le nom déjà connu.
export function retenirGroupe(code, infos) {
  const groupes = lireGroupes();
  groupes[code] = { ...groupes[code], ...infos };
  ecrireGroupes(groupes);
}

/* Retire un groupe de la mémoire du navigateur. Appelé quand le serveur
   répond qu'il n'existe plus (supprimé dans la base) : sans ça, il
   resterait affiché pour toujours dans « Tes groupes » de l'accueil,
   cette liste ne venant pas du serveur mais du navigateur. */
export function oublierGroupe(code) {
  const groupes = lireGroupes();
  delete groupes[code];
  ecrireGroupes(groupes);
}


/* LES DATES

   Piège classique : date.toISOString() donne la date à Londres (UTC).
   À 0 h 30 à Paris, il est encore 23 h 30 la veille à Londres, et
   toISOString() renverrait la mauvaise date. D'où ces petites
   fonctions qui travaillent toujours à l'heure locale. */

// Date → "2026-11-02"
export function versTexte(date) {
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mois}-${jour}`;
}

// "2026-11-02" → Date, à minuit heure locale.
export function depuisTexte(texte) {
  const [annee, mois, jour] = texte.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

// Le navigateur gère tout seul les fins de mois : le 31 + 1 donne le 1er.
export function ajouterJours(date, nombre) {
  const resultat = new Date(date);
  resultat.setDate(resultat.getDate() + nombre);
  return resultat;
}

/* L'HEURE DU GROUPE (2 nov. 2026)

   Les heures de l'agenda et des soirées sont celles du fuseau du groupe
   (groupes.fuseau : « Europe/Paris », « America/Montreal »…), pas
   forcément celles de l'appareil : un membre en vacances à Montréal
   voit toujours les soirées à l'heure de Paris si le groupe y est.
   maintenant() donne donc l'heure qu'il est DANS LE FUSEAU DU GROUPE,
   sous la forme d'une date ordinaire dont l'heure affichée est la
   bonne : partout où le site demandait new Date(), il demande
   maintenant(). Tant qu'aucun groupe n'est chargé (l'accueil),
   c'est l'heure de l'appareil. */
let fuseauDuGroupe = null;
export function reglerFuseau(fuseau) {
  fuseauDuGroupe = fuseau;
}
export function maintenant() {
  const ici = new Date();
  if (!fuseauDuGroupe) return ici;
  try {
    const parties = new Intl.DateTimeFormat('en-US', {
      timeZone: fuseauDuGroupe, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(ici);
    const p = Object.fromEntries(parties.map(({ type, value }) => [type, Number(value)]));
    return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  } catch {
    return ici; // un fuseau inconnu de ce navigateur : l'heure de l'appareil
  }
}
// Le fuseau de cet appareil, envoyé à la création d'un groupe.
export const fuseauDeLAppareil = Intl.DateTimeFormat().resolvedOptions().timeZone;
// « America/New_York » → « New York » : la ville, pour « heures de New York ».
export const nomDuFuseau = (fuseau) => fuseau.split('/').pop().replace(/_/g, ' ');

// Le lundi de la semaine d'une date. getDay() compte à partir du
// dimanche (0) ; (getDay() + 6) % 7 compte à partir du lundi.
export function lundiDe(date) {
  const minuit = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return ajouterJours(minuit, -((minuit.getDay() + 6) % 7));
}

// 21 → "21h", 25 → "1h"
export function libelleHeure(heure) {
  return (heure % 24) + 'h';
}

// Intl.DateTimeFormat écrit les dates à la française tout seul :
// formater(date, { weekday: 'long' }) → "samedi".
export function formater(date, options) {
  return new Intl.DateTimeFormat('fr-FR', options).format(date);
}

// "ven. 6 nov." → "Ven. 6 nov." (la première lettre seulement ; la
// règle CSS text-transform: capitalize mettrait aussi « Nov. »).
export function majuscule(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// "Ce soir" / "Demain" / "Sam. 8 nov." pour une date donnée.
export function jourRelatif(date) {
  const aujourdhui = versTexte(maintenant());
  if (versTexte(date) === aujourdhui) return date.getHours() >= 18 ? 'Ce soir' : "Aujourd'hui";
  if (versTexte(date) === versTexte(ajouterJours(maintenant(), 1))) return 'Demain';
  return majuscule(formater(date, { weekday: 'short', day: 'numeric', month: 'short' }));
}


/* LES PETITS MORCEAUX D'INTERFACE */

/* Fabrique un élément HTML : creer('p', 'aide', 'Bonjour') donne
   <p class="aide">Bonjour</p>. Le texte passe par textContent : tout
   ce qu'un membre a écrit s'affiche tel quel, sans jamais être
   interprété comme du code. Un pseudo comme <img onerror=…> reste donc
   du texte inoffensif. C'est la raison pour laquelle ce site n'utilise
   jamais innerHTML. */
export function creer(balise, classe, texte) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (texte !== undefined) element.textContent = texte;
  return element;
}

/* Un avatar : un rond de la couleur du membre, avec l'initiale de son
   pseudo. Array.from découpe par caractère réel : un pseudo qui
   commence par un émoji garde son émoji entier, alors que pseudo[0]
   n'en prendrait que la moitié. */
export function avatar(membre) {
  // L'emoji choisi dans le profil, sinon l'initiale du pseudo.
  const emoji = membre.perso && membre.perso.emoji;
  const rond = creer('span', emoji ? 'avatar avatar-emoji' : 'avatar', emoji || Array.from(membre.pseudo)[0].toUpperCase());
  rond.title = membre.pseudo;
  // La couleur passe par une variable CSS : la feuille de style
  // décide de l'usage (fond du rond, bordure…).
  rond.style.setProperty('--couleur', membre.couleur);

  /* La photo de profil, si le membre en a une : elle prend la place de
     l'emoji ou de l'initiale. membre.photo est son adresse, fournie
     par le serveur. alt vide : le pseudo est déjà écrit à côté, un
     lecteur d'écran n'a pas à annoncer « image ». Si elle ne se charge
     pas (supprimée entre-temps…), on remet ce qu'il y avait avant,
     plutôt qu'une icône d'image cassée. */
  if (membre.photo) {
    const avant = [...rond.childNodes];
    const classeAvant = rond.className;
    const image = creer('img');
    image.alt = '';
    image.src = membre.photo;
    image.addEventListener('error', () => {
      rond.className = classeAvant;
      rond.replaceChildren(...avant);
    });
    rond.className = 'avatar avatar-photo';
    rond.replaceChildren(image);
  }
  return rond;
}

/* Le message qui apparaît quelques secondes en bas de l'écran. La zone
   a role="status" dans le HTML : un lecteur d'écran lit chaque
   nouveau message à voix haute. */
let minuterieAnnonce;
export function annoncer(message, type = 'info') {
  const zone = document.getElementById('annonce');
  zone.textContent = message;
  zone.dataset.type = type;
  zone.classList.add('visible');
  clearTimeout(minuterieAnnonce);
  minuterieAnnonce = setTimeout(() => zone.classList.remove('visible'), 4000);
}

/* LES ANIMATIONS D'ARRIVÉE

   La page redessine ses listes à chaque modification (une réponse, une
   case cochée…). Si les animations d'entrée étaient posées directement
   sur les cartes et les cases, elles se rejoueraient à chaque fois et
   tout clignoterait.

   Elles sont donc attachées à une classe, « entree », qu'on ne pose
   qu'aux vrais moments d'arrivée (ouverture d'un onglet, changement de
   semaine) puis qu'on retire 1,2 seconde plus tard, une fois les
   animations finies (voir « Les animations » dans style.css).

   Retirer puis remettre la classe, avec une lecture d'offsetWidth entre
   les deux, oblige le navigateur à repartir de zéro si on rappelle la
   fonction alors qu'une animation est encore en cours. */
const minuteriesEntree = new WeakMap();

export function animerEntree(element) {
  clearTimeout(minuteriesEntree.get(element));
  element.classList.remove('entree');
  void element.offsetWidth; // force le navigateur à prendre en compte le retrait
  element.classList.add('entree');
  minuteriesEntree.set(element, setTimeout(() => element.classList.remove('entree'), 1200));
}

// Copie un texte dans le presse-papiers. Si le navigateur refuse, on
// affiche le texte dans une petite fenêtre pour le copier à la main.
export async function copier(texte, message) {
  try {
    await navigator.clipboard.writeText(texte);
    annoncer(message);
  } catch {
    window.prompt('Copie ce lien :', texte);
  }
}
