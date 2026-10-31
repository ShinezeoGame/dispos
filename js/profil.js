/* TON PROFIL

   La même fenêtre sert deux fois :
   — pour REJOINDRE le groupe, quand tu n'y es pas encore : pseudo et
     couleur suffisent, le reste peut attendre ;
   — pour MODIFIER ton profil ensuite : jeux, dispos habituelles, et
     ton lien perso pour te retrouver sur un autre appareil. */

import { etat, appeler, charger } from './etat.js';
import { COULEURS, retenirGroupe, annoncer, copier } from './commun.js';

const dialogue = document.getElementById('dialogue-profil');
const formulaire = document.getElementById('form-profil');
const champs = formulaire.elements;

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
  document.getElementById('profil-intro').textContent = inscription
    ? 'Choisis un pseudo et une couleur : c\'est comme ça que la team te verra. Le reste peut attendre.'
    : '';
  document.getElementById('profil-lien-perso').hidden = inscription;
  document.getElementById('profil-valider').textContent = inscription ? 'Rejoindre le groupe' : 'Enregistrer';
  document.getElementById('profil-annuler').textContent = inscription ? 'Juste regarder' : 'Annuler';

  if (inscription) {
    // Une couleur que personne n'a encore prise, si possible.
    const prises = etat.membres.map((membre) => membre.couleur);
    const libres = COULEURS.filter((couleur) => !prises.includes(couleur));
    const choix = libres.length ? libres : COULEURS;
    champs.couleur.value = choix[Math.floor(Math.random() * choix.length)];
  } else {
    champs.pseudo.value = etat.moi.pseudo;
    champs.couleur.value = etat.moi.couleur;
    champs.jeux.value = etat.moi.jeux;
    champs.bio.value = etat.moi.bio;
  }
  dialogue.showModal();
}

formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  const bouton = document.getElementById('profil-valider');
  bouton.disabled = true;
  const profil = {
    pseudo: champs.pseudo.value,
    couleur: champs.couleur.value,
    jeux: champs.jeux.value,
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
      annoncer(`Bienvenue dans ${etat.groupe.nom} ! Coche tes dispos dans l'agenda.`);
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
    'Lien perso copié. Ouvre-le sur ton autre appareil, et ne le partage pas.',
  );
});
