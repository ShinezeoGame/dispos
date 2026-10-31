/* TON PROFIL

   La même fenêtre sert deux fois :
   — pour REJOINDRE le groupe, quand tu n'y es pas encore : pseudo et
     couleur suffisent, le reste peut attendre ;
   — pour MODIFIER ton profil ensuite : jeux, dispos habituelles, et
     ton lien perso pour te retrouver sur un autre appareil. */

import { etat, appeler, charger } from './etat.js';
import { COULEURS, retenirGroupe, annoncer, copier } from './commun.js';
import { selecteurJeux, memeJeu } from './jeux.js';

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

export function ouvrirProfil() {
  const inscription = !etat.moi;
  formulaire.reset();
  formulaire.querySelector('.erreur').textContent = '';

  document.getElementById('titre-dialogue-profil').textContent = inscription
    ? `Rejoins ${etat.groupe.nom}`
    : 'Ton profil';
  document.getElementById('profil-lien-perso').hidden = inscription;
  document.getElementById('profil-valider').textContent = inscription ? 'Rejoindre le groupe' : 'Enregistrer';
  document.getElementById('profil-annuler').textContent = inscription ? 'Juste regarder' : 'Annuler';

  if (inscription) {
    // Une couleur que personne n'a encore prise, si possible.
    const prises = etat.membres.map((membre) => membre.couleur);
    const libres = COULEURS.filter((couleur) => !prises.includes(couleur));
    const choix = libres.length ? libres : COULEURS;
    champs.couleur.value = choix[Math.floor(Math.random() * choix.length)];
    selecteur.remplir([]);
  } else {
    champs.pseudo.value = etat.moi.pseudo;
    champs.couleur.value = etat.moi.couleur;
    selecteur.remplir(etat.moi.jeux);
    champs.bio.value = etat.moi.bio;
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
  };
  try {
    if (etat.moi) {
      await appeler('/moi', { methode: 'PUT', corps: profil });
      annoncer('Profil enregistré.');
    } else {
      // Le serveur renvoie ton jeton, une seule fois : on le range tout de suite.
      const { jeton } = await appeler('/membres', { methode: 'POST', corps: profil });
      etat.jeton = jeton;
      retenirGroupe(etat.code, { jeton });
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

/* Le lien perso : le lien du groupe, plus ton jeton après un #. Ouvert
   ailleurs, groupe.js range le jeton et te reconnaît. */
document.getElementById('copier-lien-perso').addEventListener('click', () => {
  copier(
    `${location.origin}/groupe?g=${etat.code}#moi=${etat.jeton}`,
    'Lien perso copié.',
  );
});
