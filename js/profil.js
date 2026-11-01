/* TON PROFIL

   La même fenêtre sert trois fois :
   — pour SE CONNECTER, quand tu n'es ni membre ni connecté : rejoindre
     demande un compte Discord, la fenêtre ne montre que ce bouton ;
   — pour REJOINDRE le groupe, une fois connecté : pseudo et couleur
     suffisent (ton nom Discord est proposé), le reste peut attendre ;
   — pour MODIFIER ton profil ensuite : jeux, dispos habituelles,
     personnalisation, et ton compte (se déconnecter). */

import { etat, appeler, charger } from './etat.js';
import { COULEURS, EMOJIS, PLATEFORMES, STYLES, annoncer, creer } from './commun.js';
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
  return etiquette;
}

/* L'avatar, dans cet ordre :
   — ta photo (valeur « photo »), cachée tant que tu n'en as pas ;
   — « + », un vrai bouton (pas un choix) qui ouvre le choix d'une photo ;
   — « Aa » (valeur vide) = l'initiale du pseudo, puis les emojis. */
const zoneEmojis = document.getElementById('profil-emojis');
const casePhoto = creerChoix(zoneEmojis, 'radio', 'emoji', 'photo', '', 'choix-emoji choix-photo', 'Ta photo');
const apercuPhoto = creer('img');
apercuPhoto.alt = '';
casePhoto.querySelector('span').replaceChildren(apercuPhoto);
const boutonPhoto = creer('button', 'choix-emoji choix-ajout', '+');
boutonPhoto.type = 'button';
boutonPhoto.setAttribute('aria-label', 'Choisir une photo');
zoneEmojis.append(boutonPhoto);
creerChoix(zoneEmojis, 'radio', 'emoji', '', 'Aa', 'choix-emoji choix-initiale', 'Initiale du pseudo');
for (const emoji of EMOJIS) creerChoix(zoneEmojis, 'radio', 'emoji', emoji, emoji, 'choix-emoji');


/* TA PHOTO DE PROFIL

   Rien ne part au serveur tant que tu n'as pas cliqué sur Enregistrer
   (ou Rejoindre) : Annuler ne change rien. En attendant, deux mémoires :
   — photoActuelle : l'adresse de ta photo déjà enregistrée, ou null ;
   — photoNouvelle : celle que tu viens de choisir, déjà préparée, sous
     forme de « data URL » (data:image/webp;base64,…), un texte qui
     contient toute l'image. La règle de sécurité du site autorise ces
     adresses data: dans les <img> : c'est ce qui permet l'aperçu. */
const TAILLE_PHOTO = 160; // en pixels : deux fois le plus grand avatar affiché, pour les écrans fins
const fichierPhoto = document.getElementById('profil-photo-fichier');
let photoActuelle = null;
let photoNouvelle = null;

// La case photo : visible avec son aperçu, ou cachée s'il n'y a rien à montrer.
function montrerPhoto(adresse) {
  casePhoto.hidden = !adresse;
  if (adresse) apercuPhoto.src = adresse;
}

/* Prépare la photo choisie, entièrement dans le navigateur :
   1. createImageBitmap lit le fichier (JPEG, PNG, WebP, HEIC sur
      iPhone…) et le tourne dans le bon sens ;
   2. on garde le plus grand carré possible au centre (cote × cote) ;
   3. on le dessine réduit à 160 × 160 sur un canvas (une zone de dessin
      invisible), sur un fond de ta couleur, pour les images
      transparentes ;
   4. toDataURL en tire une image WebP. Safari ne sait pas en faire : il
      renvoie alors du PNG, bien plus lourd, et on demande du JPEG. */
async function preparerPhoto(fichier) {
  const image = await createImageBitmap(fichier);
  const cote = Math.min(image.width, image.height);
  const toile = document.createElement('canvas');
  toile.width = TAILLE_PHOTO;
  toile.height = TAILLE_PHOTO;
  const pinceau = toile.getContext('2d');
  pinceau.imageSmoothingQuality = 'high'; // une réduction plus douce
  pinceau.fillStyle = champs.couleur.value;
  pinceau.fillRect(0, 0, TAILLE_PHOTO, TAILLE_PHOTO);
  pinceau.drawImage(image, (image.width - cote) / 2, (image.height - cote) / 2, cote, cote, 0, 0, TAILLE_PHOTO, TAILLE_PHOTO);
  image.close(); // libère la mémoire de la grande image
  const webp = toile.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : toile.toDataURL('image/jpeg', 0.85);
}

boutonPhoto.addEventListener('click', () => fichierPhoto.click());

fichierPhoto.addEventListener('change', async () => {
  const fichier = fichierPhoto.files[0];
  if (!fichier) return; // fenêtre de choix fermée sans rien prendre
  const zoneErreur = formulaire.querySelector('.erreur');
  try {
    photoNouvelle = await preparerPhoto(fichier);
    montrerPhoto(photoNouvelle);
    champs.emoji.value = 'photo'; // la nouvelle photo devient l'avatar choisi
    zoneErreur.textContent = '';
  } catch {
    zoneErreur.textContent = "Cette image n'a pas pu être lue. Essaie une photo JPEG ou PNG.";
  } finally {
    // Vidé : choisir à nouveau le même fichier redéclenchera « change ».
    fichierPhoto.value = '';
  }
});

/* Envoie la photo, une fois le profil enregistré (à l'inscription, il
   faut d'abord exister pour avoir une photo) :
   — case photo choisie et nouvelle photo : on l'envoie (PUT) ;
   — autre avatar choisi alors qu'une photo existait : on la retire.
   Un échec ici ne doit pas faire perdre le profil, déjà enregistré :
   on le signale, et la fenêtre se ferme quand même. */
async function enregistrerPhoto(id, avecPhoto) {
  try {
    if (avecPhoto && photoNouvelle) {
      // "data:image/webp;base64,UklGR…" → le type et l'image en base64.
      const [entete, image] = photoNouvelle.split(',');
      await appeler(`/photos/${id}`, { methode: 'PUT', corps: { image, type: entete.slice(5, entete.indexOf(';')) } });
    } else if (!avecPhoto && photoActuelle) {
      await appeler(`/photos/${id}`, { methode: 'DELETE' });
    }
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
}

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

  // Ta photo enregistrée (aucune à l'inscription) ; rien de nouveau choisi.
  photoActuelle = inscription ? null : etat.moi.photo;
  photoNouvelle = null;
  montrerPhoto(photoActuelle);

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
    // Avec une photo, c'est elle qui est cochée ; sinon l'emoji (ou « Aa »).
    champs.emoji.value = photoActuelle ? 'photo' : perso.emoji;
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

  // La case photo cochée : l'avatar est la photo, pas d'emoji à retenir.
  const avecPhoto = champs.emoji.value === 'photo';
  const profil = {
    pseudo: champs.pseudo.value,
    couleur: champs.couleur.value,
    jeux,
    bio: champs.bio.value,
    perso: {
      emoji: avecPhoto ? '' : champs.emoji.value,
      statut: champs.statut.value,
      style: champs.style.value,
      // Les cases cochées, dans l'ordre de la liste.
      plateformes: [...zonePlateformes.querySelectorAll('input:checked')].map((caseCochee) => caseCochee.value),
      discord: champs.discord.value,
      pseudos: champs.pseudos.value,
    },
  };
  try {
    let id; // ton numéro de membre, pour l'adresse de ta photo
    if (etat.moi) {
      await appeler('/moi', { methode: 'PUT', corps: profil });
      id = etat.moi.id;
      annoncer('Profil enregistré.');
    } else {
      // Le serveur relie le profil à ton compte : rien à retenir ici,
      // sauf ton numéro de membre, tout neuf.
      const reponse = await appeler('/membres', { methode: 'POST', corps: profil });
      id = reponse.membre.id;
      annoncer(`Bienvenue dans ${etat.groupe.nom} !`);
    }
    await enregistrerPhoto(id, avecPhoto);
    dialogue.close();
    await charger();
  } catch (probleme) {
    formulaire.querySelector('.erreur').textContent = probleme.message;
  } finally {
    bouton.disabled = false;
  }
});

document.getElementById('bouton-deconnexion').addEventListener('click', deconnecter);
