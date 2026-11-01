/* TON PROFIL

   La même fenêtre sert trois fois :
   — pour SE CONNECTER, quand tu n'es ni membre ni connecté : rejoindre
     demande un compte Discord, la fenêtre ne montre que ce bouton ;
   — pour REJOINDRE le groupe, une fois connecté : pseudo et couleur
     suffisent (ton nom Discord est proposé), le reste peut attendre ;
   — pour MODIFIER ton profil ensuite : jeux, dispos habituelles,
     personnalisation, et ton compte (se déconnecter). */

import { etat, appeler, charger } from './etat.js';
import { COULEURS, EMOJIS, PLATEFORMES, STYLES, annoncer } from './commun.js';
import { selecteurJeux, memeJeu } from './jeux.js';
import { messageConnexion, deconnecter } from './compte.js';

const dialogue = document.getElementById('dialogue-profil');
const formulaire = document.getElementById('form-profil');
const champs = formulaire.elements;

// Tes jeux : le sélecteur de js/jeux.js, en mode « plusieurs jeux ».
// 12 au plus, comme le vérifie le serveur (MAX_JEUX dans _outils.js).
const selecteur = selecteurJeux(document.getElementById('profil-jeux'), { multiple: true, max: 12 });

/* LES PASTILLES DE COULEUR

   Fabriquées une fois pour toutes : un bouton radio par couleur,
   caché, dans un <label> rond qui affiche la couleur. Cliquer sur le
   rond coche le radio. Le nom de la couleur, invisible, est lu par
   les lecteurs d'écran. */
const NOMS = ['Corail', 'Orange', 'Jaune', 'Vert', 'Turquoise', 'Bleu', 'Violet', 'Rose'];
const zoneCouleurs = document.getElementById('profil-couleurs');
COULEURS.forEach((couleur, numero) => {
  const pastille = document.createElement('label');
  pastille.className = 'pastille-couleur';
  pastille.style.setProperty('--couleur', couleur);
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'couleur';
  radio.value = couleur;
  const nom = document.createElement('span');
  nom.className = 'visuellement-cache';
  nom.textContent = NOMS[numero];
  pastille.append(radio, nom);
  zoneCouleurs.append(pastille);
});

/* LA PERSONNALISATION : avatar, style de jeu, plateformes.

   Même principe que les pastilles de couleur : de vrais boutons radio
   (un seul choix) ou cases à cocher (plusieurs), cachés sous une
   étiquette dessinée. Le clavier et les lecteurs d'écran s'en servent
   normalement. creerChoix fabrique l'un ou l'autre. */
function creerChoix(zone, type, nom, valeur, texte, classe, aria) {
  const etiquette = document.createElement('label');
  etiquette.className = classe;
  const entree = document.createElement('input');
  entree.type = type;
  entree.name = nom;
  entree.value = valeur;
  const visible = document.createElement('span');
  visible.textContent = texte;
  if (aria) entree.setAttribute('aria-label', aria);
  etiquette.append(entree, visible);
  zone.append(etiquette);
}

// L'avatar : « Aa » (valeur vide) = l'initiale du pseudo, puis les emojis.
const zoneEmojis = document.getElementById('profil-emojis');
creerChoix(zoneEmojis, 'radio', 'emoji', '', 'Aa', 'choix-emoji choix-initiale', 'Initiale du pseudo');
for (const emoji of EMOJIS) creerChoix(zoneEmojis, 'radio', 'emoji', emoji, emoji, 'choix-emoji');

// Le style de jeu (un seul) et les plateformes (plusieurs).
const zoneStyles = document.getElementById('profil-styles');
for (const style of STYLES) creerChoix(zoneStyles, 'radio', 'style', style.id, style.nom, 'puce-choix');
const zonePlateformes = document.getElementById('profil-plateformes');
for (const plateforme of PLATEFORMES) creerChoix(zonePlateformes, 'checkbox', 'plateformes', plateforme.id, plateforme.nom, 'puce-choix');

/* Un clic sur le style déjà choisi le décoche : sans ça, un bouton radio
   ne se décoche jamais, et on ne pourrait plus revenir à « aucun style ».
   Le clic coche toujours ; on regarde donc l'état d'avant le clic,
   noté au moment où le pointeur (ou la touche) s'enfonce. */
let styleAvant = '';
zoneStyles.addEventListener('pointerdown', () => { styleAvant = champs.style.value; });
zoneStyles.addEventListener('keydown', () => { styleAvant = champs.style.value; });
zoneStyles.addEventListener('click', (evenement) => {
  if (evenement.target.name === 'style' && evenement.target.value === styleAvant) {
    evenement.target.checked = false;
    styleAvant = '';
  }
});

export function ouvrirProfil() {
  const inscription = !etat.moi;
  // Ni membre ni connecté : rejoindre commence par la connexion Discord.
  const connexionDabord = inscription && !etat.compte;
  formulaire.reset();
  // Revenu de Discord sur un échec : le message s'affiche ici, juste
  // au-dessus du bouton pour réessayer (messageConnexion, compte.js).
  formulaire.querySelector('.erreur').textContent = connexionDabord ? messageConnexion : '';

  document.getElementById('titre-dialogue-profil').textContent = inscription
    ? `Rejoins ${etat.groupe.nom}`
    : 'Ton profil';
  document.getElementById('profil-connexion').hidden = !connexionDabord;
  document.getElementById('profil-champs').hidden = connexionDabord;
  document.getElementById('profil-valider').hidden = connexionDabord;
  // La personnalisation, une fois inscrit : rejoindre doit aller vite.
  document.getElementById('profil-plus').hidden = inscription;
  document.getElementById('profil-valider').textContent = inscription ? 'Rejoindre le groupe' : 'Enregistrer';
  document.getElementById('profil-annuler').textContent = inscription ? 'Juste regarder' : 'Annuler';

  /* Ton compte, une fois inscrit. Connecté : ton pseudo Discord et
     « Se déconnecter ». Profil d'avant les comptes, reconnu par son
     ancien jeton : de quoi le relier à Discord (le serveur s'en charge
     tout seul au retour, voir identifier() dans functions/_outils.js). */
  document.getElementById('profil-compte').hidden = inscription;
  document.getElementById('profil-compte-texte').textContent = etat.compte
    ? `Connecté avec Discord : ${etat.compte.discord}`
    : 'Relie ce profil à Discord pour le retrouver sur tous tes appareils.';
  document.getElementById('bouton-deconnexion').hidden = !etat.compte;
  document.getElementById('profil-relier').hidden = Boolean(etat.compte);

  if (inscription) {
    // Une couleur que personne n'a encore prise, si possible.
    const prises = etat.membres.map((membre) => membre.couleur);
    const libres = COULEURS.filter((couleur) => !prises.includes(couleur));
    const choix = libres.length ? libres : COULEURS;
    champs.couleur.value = choix[Math.floor(Math.random() * choix.length)];
    champs.emoji.value = '';
    selecteur.remplir([]);
    // Ton nom Discord comme pseudo de départ, à garder ou à changer.
    // 24 caractères au plus, comme le demande le serveur.
    if (etat.compte) champs.pseudo.value = Array.from(etat.compte.nom).slice(0, 24).join('');
  } else {
    champs.pseudo.value = etat.moi.pseudo;
    champs.couleur.value = etat.moi.couleur;
    selecteur.remplir(etat.moi.jeux);
    champs.bio.value = etat.moi.bio;
    const perso = etat.moi.perso;
    champs.emoji.value = perso.emoji;
    champs.statut.value = perso.statut;
    champs.style.value = perso.style;
    champs.discord.value = perso.discord;
    champs.pseudos.value = perso.pseudos;
    for (const caseACocher of zonePlateformes.querySelectorAll('input')) {
      caseACocher.checked = perso.plateformes.includes(caseACocher.value);
    }
  }
  dialogue.showModal();
}

formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  const bouton = document.getElementById('profil-valider');
  bouton.disabled = true;
  /* Les jeux choisis, plus ce qui serait resté tapé dans le champ sans
     être ajouté : on ne perd pas une saisie pour un clic oublié. */
  const jeux = [...selecteur.lire()];
  const texte = selecteur.texte();
  const enPlus = { id: null, nom: texte, cover: '' };
  if (texte && jeux.length < 12 && !jeux.some((jeu) => memeJeu(jeu, enPlus))) jeux.push(enPlus);

  const profil = {
    pseudo: champs.pseudo.value,
    couleur: champs.couleur.value,
    jeux,
    bio: champs.bio.value,
    perso: {
      emoji: champs.emoji.value,
      statut: champs.statut.value,
      style: champs.style.value,
      // Les cases cochées, dans l'ordre de la liste.
      plateformes: [...zonePlateformes.querySelectorAll('input:checked')].map((caseCochee) => caseCochee.value),
      discord: champs.discord.value,
      pseudos: champs.pseudos.value,
    },
  };
  try {
    if (etat.moi) {
      await appeler('/moi', { methode: 'PUT', corps: profil });
      annoncer('Profil enregistré.');
    } else {
      // Le serveur relie le profil à ton compte : rien à retenir ici.
      await appeler('/membres', { methode: 'POST', corps: profil });
      annoncer(`Bienvenue dans ${etat.groupe.nom} !`);
    }
    dialogue.close();
    await charger();
  } catch (probleme) {
    formulaire.querySelector('.erreur').textContent = probleme.message;
  } finally {
    bouton.disabled = false;
  }
});

document.getElementById('bouton-deconnexion').addEventListener('click', deconnecter);
