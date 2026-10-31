/* LES SOIRÉES

   La liste des soirées à venir, chacune avec qui vient et tes trois
   boutons de réponse, et le formulaire pour en proposer une. */

import { etat, quandCaChange, appeler, charger, trouverMembre, caseDe } from './etat.js';
import { JEUX_CONNUS, versTexte, depuisTexte, jourRelatif, avatar, annoncer, creer } from './commun.js';
import { ouvrirProfil } from './profil.js';

const liste = document.getElementById('liste-soirees');
const aucune = document.getElementById('aucune-soiree');
const modele = document.getElementById('modele-soiree');
const pastille = document.getElementById('pastille-soirees');
const dialogue = document.getElementById('dialogue-soiree');
const formulaire = document.getElementById('form-soiree');
// formulaire.elements.jeu = le champ name="jeu", et ainsi de suite.
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
  remplir('.soiree-jeu', soiree.jeu);

  const auteur = trouverMembre(soiree.createur_id);
  remplir('.soiree-auteur', auteur ? `proposée par ${auteur.id === moi?.id ? 'toi' : auteur.pseudo}` : '');

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

  // Seule la personne qui a proposé peut annuler.
  if (moi && soiree.createur_id === moi.id) {
    const annuler = carte.querySelector('.soiree-annuler');
    annuler.hidden = false;
    annuler.addEventListener('click', () => annulerSoiree(soiree));
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

   Ouvert par le bouton « Proposer une soirée », ou depuis l'agenda
   (meilleur créneau, case touchée) avec la date et l'heure déjà
   remplies. export : agenda.js s'en sert. */
export function proposerSoiree({ jour, horaire } = {}) {
  if (!etat.moi) {
    ouvrirProfil();
    return;
  }
  formulaire.reset();
  formulaire.querySelector('.erreur').textContent = '';
  champs.jour.min = versTexte(new Date()); // pas de soirée dans le passé
  champs.jour.value = jour || versTexte(new Date());
  champs.horaire.value = horaire || '21:00';
  remplirJeux();
  mettreAJourTitre();
  mettreAJourDispos();
  dialogue.showModal();
}

document.getElementById('bouton-proposer').addEventListener('click', () => proposerSoiree());

/* Les suggestions du champ « Jeu » (<datalist>) : d'abord les jeux que
   les membres ont mis dans leur profil, puis la liste de base. new Set
   enlève les doublons ; on peut toujours taper autre chose. */
function remplirJeux() {
  const deLaTeam = etat.membres
    .flatMap((membre) => membre.jeux.split(','))
    .map((jeu) => jeu.trim())
    .filter(Boolean);
  const options = [...new Set([...deLaTeam, ...JEUX_CONNUS])].map((jeu) => {
    const option = document.createElement('option');
    option.value = jeu;
    return option;
  });
  document.getElementById('liste-jeux').replaceChildren(...options);
}

/* Le titre proposé d'office, selon l'heure : « Aprem Fortnite »,
   « Soirée Among Us ». Il s'affiche en gris dans le champ titre
   (placeholder) ; s'il reste vide, c'est lui qui est envoyé. */
function titreParDefaut() {
  const jeu = champs.jeu.value.trim();
  if (!jeu) return '';
  const heure = Number((champs.horaire.value || '21').split(':')[0]);
  const moment = heure < 6 ? 'Nuit' : heure < 12 ? 'Matinée' : heure < 18 ? 'Aprem' : 'Soirée';
  return `${moment} ${jeu}`;
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
    ? `D'après l'agenda, dispo${dispos.length > 1 ? 's' : ''} à cette heure : ${dispos.map((m) => (m.id === etat.moi?.id ? 'toi' : m.pseudo)).join(', ')}.`
    : "Personne n'a coché cette heure dans l'agenda.";
}

champs.jeu.addEventListener('input', mettreAJourTitre);
champs.horaire.addEventListener('input', () => {
  mettreAJourTitre();
  mettreAJourDispos();
});
champs.jour.addEventListener('input', mettreAJourDispos);

formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  const bouton = formulaire.querySelector('[type="submit"]');
  bouton.disabled = true;
  try {
    await appeler('/soirees', {
      methode: 'POST',
      corps: {
        jeu: champs.jeu.value,
        titre: champs.titre.value.trim() || titreParDefaut(),
        jour: champs.jour.value,
        horaire: champs.horaire.value,
        note: champs.note.value,
      },
    });
    dialogue.close();
    annoncer('Soirée proposée ! Préviens la team.');
    // On bascule sur l'onglet Soirées pour voir la nouvelle venue.
    document.getElementById('onglet-soirees').click();
    await charger();
  } catch (probleme) {
    formulaire.querySelector('.erreur').textContent = probleme.message;
  } finally {
    bouton.disabled = false;
  }
});
