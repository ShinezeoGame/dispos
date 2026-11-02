/* LES SOIRÉES

   La liste des soirées à venir, chacune avec qui vient et tes trois
   boutons de réponse, et le formulaire pour en proposer une. */

import { etat, quandCaChange, appeler, charger, trouverMembre, caseDe } from './etat.js';
import { versTexte, depuisTexte, jourRelatif, avatar, annoncer, creer } from './commun.js';
import { ouvrirProfil } from './profil.js';
import { selecteurJeux, couverture, memeJeu } from './jeux.js';
import { brancherFiche } from './fiche-jeu.js';

const liste = document.getElementById('liste-soirees');
const aucune = document.getElementById('aucune-soiree');
const modele = document.getElementById('modele-soiree');
const pastille = document.getElementById('pastille-soirees');
const dialogue = document.getElementById('dialogue-soiree');
const formulaire = document.getElementById('form-soiree');
// formulaire.elements.jour = le champ name="jour", et ainsi de suite.
// (Le jeu, lui, passe par le sélecteur de jeux, plus bas.)
const champs = formulaire.elements;


/* LE TEMPS D'UNE SOIRÉE */

// "2026-11-07" + "21:30" → la vraie date, à l'heure locale.
function debutSoiree(soiree) {
  const date = depuisTexte(soiree.jour);
  const [heures, minutes] = soiree.horaire.split(':').map(Number);
  date.setHours(heures, minutes);
  return date;
}

// Une soirée reste affichée trois heures après son début : elle est
// peut-être encore en cours.
function soireesAVenir() {
  const limite = Date.now() - 3 * 60 * 60 * 1000;
  return etat.soirees.filter((soiree) => debutSoiree(soiree) > limite);
}

// "21:00" → "21h", "21:30" → "21h30".
function joliHoraire(horaire) {
  return horaire.replace(':00', 'h').replace(':', 'h');
}


/* LA LISTE */
function dessiner() {
  if (!etat.groupe) return;
  const soirees = soireesAVenir();
  liste.replaceChildren(...soirees.map(fabriquerCarte));
  aucune.hidden = soirees.length > 0;

  // La pastille sur l'onglet : les soirées auxquelles tu n'as pas
  // encore répondu. Elle disparaît quand tu as tout traité.
  const sansReponse = etat.moi ? soirees.filter((soiree) => !soiree.reponses[etat.moi.id]).length : 0;
  pastille.hidden = sansReponse === 0;
  pastille.textContent = sansReponse;
  pastille.title = `${sansReponse} sans réponse de ta part`;
}
quandCaChange(dessiner);

function fabriquerCarte(soiree) {
  // Une copie du moule <template id="modele-soiree"> de groupe.html.
  const carte = modele.content.firstElementChild.cloneNode(true);
  const remplir = (classe, texte) => { carte.querySelector(classe).textContent = texte; };
  const debut = debutSoiree(soiree);
  const moi = etat.moi;

  carte.classList.toggle('aujourdhui', versTexte(debut) === versTexte(new Date()));
  remplir('.soiree-jour', jourRelatif(debut));
  remplir('.soiree-heure', joliHoraire(soiree.horaire));
  remplir('.soiree-titre', soiree.titre);
  /* La couverture du jeu, devant le titre. Si le jeu vient d'IGDB (les
     soirées créées depuis le 31 oct. 2026 retiennent son numéro), elle
     devient un bouton qui ouvre la fiche du jeu au survol. */
  const jeu = { id: soiree.jeu_id, nom: soiree.jeu, cover: soiree.jeu_cover };
  let visuel = couverture(jeu, 'moyenne');
  if (jeu.id) {
    const bouton = creer('button', 'jeu-fiche');
    bouton.type = 'button';
    bouton.setAttribute('aria-label', `Infos sur ${jeu.nom}`);
    bouton.append(visuel);
    brancherFiche(bouton, jeu);
    visuel = bouton;
  }
  carte.querySelector('.soiree-tete').prepend(visuel);

  /* « Among Us · proposée par Max ». Le jeu n'est rappelé que si le
     titre ne le dit pas déjà : sous « Soirée Among Us », la ligne dit
     seulement « proposée par Max » (la jaquette le montre aussi). Rien
     si l'auteur est parti et que le titre nomme le jeu. */
  const auteur = trouverMembre(soiree.createur_id);
  const infos = [];
  if (!soiree.titre.toLowerCase().includes(soiree.jeu.toLowerCase())) infos.push(soiree.jeu);
  if (auteur) infos.push(`proposée par ${auteur.id === moi?.id ? 'toi' : auteur.pseudo}`);
  remplir('.soiree-infos', infos.join(' · '));
  carte.querySelector('.soiree-infos').hidden = infos.length === 0;

  const note = carte.querySelector('.soiree-note');
  note.textContent = soiree.note;
  note.hidden = !soiree.note;

  /* Qui vient : d'abord les « chaud », puis les « peut-être » (en
     transparence). Les « pas dispo » ne sont pas affichés en avatars,
     seulement comptés. */
  const avecReponse = (reponse) => etat.membres.filter((membre) => soiree.reponses[membre.id] === reponse);
  const nom = (membre) => (membre.id === moi?.id ? 'toi' : membre.pseudo);
  const chauds = avecReponse('oui');
  const peutEtre = avecReponse('peutetre');
  const absents = avecReponse('non');

  const avatars = carte.querySelector('.soiree-avatars');
  for (const membre of chauds) avatars.append(avatar(membre));
  for (const membre of peutEtre) {
    const rond = avatar(membre);
    rond.classList.add('hesitant');
    avatars.append(rond);
  }

  const morceaux = [];
  if (chauds.length) morceaux.push(`Chaud${chauds.length > 1 ? 's' : ''} : ${chauds.map(nom).join(', ')}`);
  if (peutEtre.length) morceaux.push(`Peut-être : ${peutEtre.map(nom).join(', ')}`);
  if (absents.length) morceaux.push(`${absents.length} pas dispo`);
  remplir('.soiree-compte', morceaux.join(' · ') || 'Personne pour l\'instant');

  // Tes trois boutons : celui de ta réponse actuelle est enfoncé.
  const maReponse = moi ? soiree.reponses[moi.id] : null;
  for (const bouton of carte.querySelectorAll('[data-reponse]')) {
    bouton.setAttribute('aria-pressed', bouton.dataset.reponse === maReponse);
    bouton.addEventListener('click', () => repondre(soiree, bouton.dataset.reponse, carte));
  }

  // Seule la personne qui a proposé peut modifier ou annuler.
  if (moi && soiree.createur_id === moi.id) {
    carte.querySelector('.soiree-gestion').hidden = false;
    carte.querySelector('.soiree-modifier').addEventListener('click', () => modifierSoiree(soiree));
    carte.querySelector('.soiree-annuler').addEventListener('click', () => annulerSoiree(soiree));
  }
  return carte;
}

async function repondre(soiree, reponse, carte) {
  if (!etat.moi) {
    ouvrirProfil();
    return;
  }
  const boutons = carte.querySelectorAll('[data-reponse]');
  for (const bouton of boutons) bouton.disabled = true;
  try {
    await appeler(`/soirees/${soiree.id}`, { methode: 'PUT', corps: { reponse } });
    await charger(); // redessine tout, boutons compris
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
    for (const bouton of boutons) bouton.disabled = false;
  }
}

async function annulerSoiree(soiree) {
  // confirm() : la petite fenêtre « OK / Annuler » du navigateur.
  if (!confirm(`Annuler « ${soiree.titre} » ? Les réponses de chacun seront perdues.`)) return;
  try {
    await appeler(`/soirees/${soiree.id}`, { methode: 'DELETE' });
    annoncer('Soirée annulée.');
    await charger();
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
}


/* LE FORMULAIRE

   Une seule fenêtre pour proposer une soirée et pour la modifier.
   enModification : la soirée qu'on modifie, ou null pour une nouvelle.
   Le titre de la fenêtre et le bouton changent en conséquence. */
let enModification = null;

function ouvrirFormulaire(soiree) {
  enModification = soiree;
  formulaire.reset();
  formulaire.querySelector('.erreur').textContent = '';
  document.getElementById('titre-dialogue-soiree').textContent = soiree ? 'Modifier la soirée' : 'Proposer une soirée';
  document.getElementById('soiree-valider').textContent = soiree ? 'Enregistrer' : 'Proposer';
  /* Pas de soirée dans le passé. Une soirée encore affichée mais
     commencée hier soir (elle reste visible trois heures) doit pouvoir
     garder sa date : la limite descend alors jusqu'à elle. */
  const aujourdhui = versTexte(new Date());
  champs.jour.min = soiree && soiree.jour < aujourdhui ? soiree.jour : aujourdhui;
}

// Les derniers réglages, communs aux deux cas, puis la fenêtre s'ouvre.
function afficherFormulaire() {
  dessinerJeuxTeam();
  mettreAJourTitre();
  mettreAJourDispos();
  mettreAJourAvertissement();
  dialogue.showModal();
}

/* PROPOSER : ouvert par le bouton « Proposer une soirée », ou depuis
   l'agenda (meilleur créneau, case touchée) avec la date et l'heure
   déjà remplies. export : agenda.js s'en sert. */
export function proposerSoiree({ jour, horaire } = {}) {
  if (!etat.moi) {
    ouvrirProfil();
    return;
  }
  ouvrirFormulaire(null);
  champs.jour.value = jour || versTexte(new Date());
  champs.horaire.value = horaire || '21:00';
  selecteur.remplir([]);
  afficherFormulaire();
}

/* MODIFIER : le bouton « Modifier » d'une carte (seulement pour qui l'a
   proposée). La fenêtre se remplit avec la soirée telle qu'elle est.
   Un titre resté celui proposé d'office (« Soirée Among Us ») laisse le
   champ vide : il suivra le jeu et l'heure si on les change, au lieu de
   rester « Soirée Among Us » sur une soirée Fortnite. */
function modifierSoiree(soiree) {
  ouvrirFormulaire(soiree);
  champs.jour.value = soiree.jour;
  champs.horaire.value = soiree.horaire;
  selecteur.remplir([{ id: soiree.jeu_id, nom: soiree.jeu, cover: soiree.jeu_cover }]);
  champs.titre.value = soiree.titre === titreParDefaut() ? '' : soiree.titre;
  champs.note.value = soiree.note;
  afficherFormulaire();
}

/* L'avertissement « chacun devra répondre à nouveau » : seulement en
   modification, si la date ou l'heure a changé, et si quelqu'un
   d'autre que toi avait déjà répondu (sinon il n'y a rien à perdre).
   Le serveur fait la même règle (soirees/[id].js). */
function mettreAJourAvertissement() {
  const s = enModification;
  const autresReponses = s && Object.keys(s.reponses).some((id) => Number(id) !== etat.moi.id);
  const autreMoment = s && (champs.jour.value !== s.jour || champs.horaire.value !== s.horaire);
  document.getElementById('soiree-avertissement').hidden = !(autresReponses && autreMoment);
}

document.getElementById('bouton-proposer').addEventListener('click', () => proposerSoiree());

// Le sélecteur de jeux (js/jeux.js), en mode « un seul jeu ».
const selecteur = selecteurJeux(document.getElementById('soiree-jeu'), {
  auChangement: () => {
    mettreAJourTitre();
    dessinerJeuxTeam(); // pour marquer le jeu choisi parmi les raccourcis
  },
});

/* Le jeu de la soirée : celui choisi dans le sélecteur ; à défaut, ce
   qui est tapé dans le champ, pris tel quel (on ne perd pas une saisie
   parce qu'on a oublié de cliquer sur une proposition). */
function jeuChoisi() {
  const texte = selecteur.texte();
  return selecteur.lire()[0] || (texte ? { id: null, nom: texte, cover: '' } : null);
}

/* LES JEUX DE LA TEAM

   La plupart des soirées se font sur un jeu que la team connaît déjà.
   On rassemble donc les jeux de tous les profils, les plus partagés en
   premier (« 4 potes ont Among Us »), et on en montre huit en
   raccourcis : un clic, et c'est choisi. */
function jeuxDeLaTeam() {
  const compte = []; // [{ jeu, nombre }, …]
  for (const membre of etat.membres) {
    for (const jeu of membre.jeux) {
      const deja = compte.find((entree) => memeJeu(entree.jeu, jeu));
      if (deja) deja.nombre += 1;
      else compte.push({ jeu, nombre: 1 });
    }
  }
  return compte.sort((a, b) => b.nombre - a.nombre).slice(0, 8).map((entree) => entree.jeu);
}

function dessinerJeuxTeam() {
  const zone = document.getElementById('soiree-jeux-team');
  const jeux = jeuxDeLaTeam();
  const choisi = selecteur.lire()[0];
  zone.replaceChildren(...jeux.map((jeu) => {
    const bouton = creer('button', 'jeu-team');
    bouton.type = 'button';
    // aria-pressed : enfoncé pour le jeu actuellement choisi.
    bouton.setAttribute('aria-pressed', String(Boolean(choisi && memeJeu(choisi, jeu))));
    bouton.append(couverture(jeu), creer('span', 'jeu-nom', jeu.nom));
    bouton.addEventListener('click', () => selecteur.ajouter(jeu));
    return bouton;
  }));
  zone.hidden = jeux.length === 0;
}

/* Le titre proposé d'office, selon l'heure : « Aprem Fortnite »,
   « Soirée Among Us ». Il s'affiche en gris dans le champ titre
   (placeholder) ; s'il reste vide, c'est lui qui est envoyé. */
function titreParDefaut() {
  const jeu = jeuChoisi();
  if (!jeu) return '';
  const heure = Number((champs.horaire.value || '21').split(':')[0]);
  const moment = heure < 6 ? 'Nuit' : heure < 12 ? 'Matinée' : heure < 18 ? 'Aprem' : 'Soirée';
  return `${moment} ${jeu.nom}`;
}

function mettreAJourTitre() {
  champs.titre.placeholder = titreParDefaut() || 'Soirée Among Us';
}

/* Sous la date et l'heure, qui est dispo à ce moment d'après
   l'agenda. Seulement si la date tombe dans la semaine affichée :
   c'est la seule que la page a chargée. */
function mettreAJourDispos() {
  const zone = document.getElementById('soiree-dispos');
  zone.textContent = '';
  if (!champs.jour.value || !champs.horaire.value) return;
  const cle = caseDe(champs.jour.value, champs.horaire.value);
  if (!cle) return;
  const dispos = etat.membres.filter((membre) => etat.dispos.get(membre.id)?.has(cle));
  zone.textContent = dispos.length
    ? `Dispo${dispos.length > 1 ? 's' : ''} : ${dispos.map((m) => (m.id === etat.moi?.id ? 'toi' : m.pseudo)).join(', ')}`
    : 'Personne de dispo à cette heure.';
}

// Le titre suit aussi ce qu'on tape, avant même de choisir un jeu.
document.getElementById('soiree-jeu-recherche').addEventListener('input', mettreAJourTitre);
champs.horaire.addEventListener('input', () => {
  mettreAJourTitre();
  mettreAJourDispos();
  mettreAJourAvertissement();
});
champs.jour.addEventListener('input', () => {
  mettreAJourDispos();
  mettreAJourAvertissement();
});

formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  const jeu = jeuChoisi();
  if (!jeu) {
    formulaire.querySelector('.erreur').textContent = 'Choisis un jeu.';
    return;
  }
  const bouton = formulaire.querySelector('[type="submit"]');
  bouton.disabled = true;
  const corps = {
    jeu,
    titre: champs.titre.value.trim() || titreParDefaut(),
    jour: champs.jour.value,
    horaire: champs.horaire.value,
    note: champs.note.value,
  };
  try {
    if (enModification) {
      // PATCH : « modifie cette soirée » (voir soirees/[id].js).
      await appeler(`/soirees/${enModification.id}`, { methode: 'PATCH', corps });
      dialogue.close();
      annoncer('Soirée modifiée.');
    } else {
      await appeler('/soirees', { methode: 'POST', corps });
      dialogue.close();
      annoncer('Soirée proposée !');
      // On bascule sur l'onglet Soirées pour voir la nouvelle venue.
      document.getElementById('onglet-soirees').click();
    }
    await charger();
  } catch (probleme) {
    formulaire.querySelector('.erreur').textContent = probleme.message;
  } finally {
    bouton.disabled = false;
  }
});
