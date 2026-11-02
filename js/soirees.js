/* LES SOIRÉES

   La liste des soirées à venir, chacune avec qui vient et tes trois
   boutons de réponse, et le formulaire pour en proposer une. */

import { etat, quandCaChange, appeler, charger, trouverMembre, caseDe } from './etat.js';
import { versTexte, depuisTexte, jourRelatif, avatar, annoncer, creer, formater, maintenant, LIEN_PRIX } from './commun.js';
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
  const limite = maintenant().getTime() - 3 * 60 * 60 * 1000; // l'heure du groupe
  return etat.soirees.filter((soiree) => debutSoiree(soiree) > limite);
}

// "21:00" → "21h", "21:30" → "21h30", "00:00" → "0h", "09:15" → "9h15".
// Number() retire le zéro de tête de l'heure.
function joliHoraire(horaire) {
  const [heures, minutes] = horaire.split(':');
  return `${Number(heures)}h${minutes === '00' ? '' : minutes}`;
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

  carte.classList.toggle('aujourdhui', versTexte(debut) === versTexte(maintenant()));
  remplir('.soiree-jour', jourRelatif(debut));
  remplir('.soiree-heure', joliHoraire(soiree.horaire));
  // Une soirée de chaque semaine : « chaque jeudi », sous l'heure.
  if (soiree.hebdo) {
    const jourDeLaSemaine = formater(depuisTexte(soiree.jour), { weekday: 'long' });
    carte.querySelector('.soiree-date').append(creer('span', 'soiree-hebdo', `chaque ${jourDeLaSemaine}`));
  }
  // « jusqu'à 1h », sous l'heure de début, si la soirée a une fin.
  const fin = carte.querySelector('.soiree-fin');
  fin.textContent = soiree.fin ? `jusqu'à ${joliHoraire(soiree.fin)}` : '';
  fin.hidden = !soiree.fin;
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
  const vote = soiree.choix.length > 1; // plusieurs jeux : la team vote (plus bas)
  if (!vote && !soiree.titre.toLowerCase().includes(soiree.jeu.toLowerCase())) infos.push(soiree.jeu);
  if (auteur) infos.push(`proposée par ${auteur.id === moi?.id ? 'toi' : auteur.pseudo}`);
  remplir('.soiree-infos', infos.join(' · '));
  carte.querySelector('.soiree-infos').hidden = infos.length === 0;

  /* « Voir le prix » : seulement si LIEN_PRIX est réglé (commun.js), et
     pour un membre dont le profil n'a pas ce jeu (même id IGDB, ou même
     nom). « lien affilié » est écrit en clair : la loi demande de dire
     quand un lien rapporte quelque chose. rel="sponsored" le dit aussi
     aux moteurs de recherche ; noopener empêche le site ouvert d'agir
     sur cet onglet. */
  const aLeJeu = moi?.jeux.some((sien) => (jeu.id && sien.id === jeu.id)
    || sien.nom.toLowerCase() === soiree.jeu.toLowerCase());
  if (LIEN_PRIX && moi && !aLeJeu) {
    const ligne = creer('p', 'soiree-prix');
    const lien = creer('a', '', 'Voir le prix');
    lien.href = LIEN_PRIX.replace('{jeu}', encodeURIComponent(soiree.jeu));
    lien.target = '_blank';
    lien.rel = 'sponsored noopener';
    ligne.append(lien, ' · lien affilié');
    carte.querySelector('.soiree-infos').after(ligne);
  }

  const note = carte.querySelector('.soiree-note');
  note.textContent = soiree.note;
  note.hidden = !soiree.note;

  /* Qui vient : d'abord les « chaud », puis les « peut-être » (en
     transparence). Les « pas dispo » ne sont pas affichés en avatars,
     seulement comptés. */
  const avecReponse = (reponse) => etat.membres.filter((membre) => soiree.reponses[membre.id] === reponse);
  const nom = (membre) => (membre.id === moi?.id ? 'toi' : membre.pseudo);
  /* Les « Chaud » se partagent en deux en AllReady+ (soiree.inscrits,
     calculé par le serveur) : ceux qui jouent, et ceux qui attendent
     une place (liste d'attente, dans l'ordre d'arrivée). */
  const inscrits = soiree.inscrits || {};
  const tousLesChauds = avecReponse('oui');
  const chauds = tousLesChauds.filter((membre) => !inscrits[membre.id]?.attente);
  const enAttente = tousLesChauds.filter((membre) => inscrits[membre.id]?.attente);
  const peutEtre = avecReponse('peutetre');
  const absents = avecReponse('non');

  const avatars = carte.querySelector('.soiree-avatars');
  for (const membre of chauds) avatars.append(avatar(membre));
  for (const membre of peutEtre) {
    const rond = avatar(membre);
    rond.classList.add('hesitant');
    avatars.append(rond);
  }

  /* Les places, s'il y a une limite : « 3/4 places », puis « Complet ».
     Complet = autant de « Chaud » que de places. */
  const complet = Boolean(soiree.places) && chauds.length >= soiree.places;

  const morceaux = [];
  if (soiree.roles.length) {
    // Avec des rôles, la compo : « Tank 1/1 : Max · Heal 0/1 · DPS 2/2 : Léa, Sam ».
    for (const role of soiree.roles) {
      const joueurs = chauds.filter((membre) => inscrits[membre.id]?.role === role.nom);
      morceaux.push(`${role.nom} ${joueurs.length}/${role.places}${joueurs.length ? ' : ' + joueurs.map(nom).join(', ') : ''}`);
    }
  } else if (chauds.length) morceaux.push(`Chaud${chauds.length > 1 ? 's' : ''} : ${chauds.map(nom).join(', ')}`);
  if (enAttente.length) {
    const avecRole = (membre) => (inscrits[membre.id].role ? `${nom(membre)} (${inscrits[membre.id].role})` : nom(membre));
    morceaux.push(`En attente : ${enAttente.map(avecRole).join(', ')}`);
  }
  if (peutEtre.length) morceaux.push(`Peut-être : ${peutEtre.map(nom).join(', ')}`);
  if (absents.length) morceaux.push(`${absents.length} pas dispo`);
  if (soiree.places && !soiree.roles.length) morceaux.push(complet ? 'Complet' : `${chauds.length}/${soiree.places} places`);
  remplir('.soiree-compte', morceaux.join(' · ') || 'Personne pour l\'instant');

  /* Tes trois boutons : celui de ta réponse actuelle est enfoncé. Une
     soirée complète où tu n'es pas « Chaud » : le bouton devient
     « Complet » et ne répond plus (le serveur refuserait de toute façon). */
  const maReponse = moi ? soiree.reponses[moi.id] : null;
  for (const bouton of carte.querySelectorAll('[data-reponse]')) {
    bouton.setAttribute('aria-pressed', bouton.dataset.reponse === maReponse);
    /* Complète : en AllReady+, « Liste d'attente » (on s'inscrit quand
       même, on jouera si une place se libère) ; sinon « Complet », et le
       bouton ne répond plus (le serveur refuserait de toute façon). */
    if (bouton.dataset.reponse === 'oui' && complet && maReponse !== 'oui') {
      bouton.textContent = etat.groupe.premium ? "Liste d'attente" : 'Complet';
      bouton.disabled = !etat.groupe.premium;
    }
    bouton.addEventListener('click', () => repondre(soiree, bouton.dataset.reponse, carte));
  }
  /* Avec des rôles : un bouton par rôle à la place de « Chaud »
     (« Tank 1/2 »), le tien enfoncé ; un rôle plein mène à la liste
     d'attente (« Tank · attente »). */
  if (soiree.roles.length) {
    const boutonChaud = carte.querySelector('[data-reponse="oui"]');
    boutonChaud.hidden = true;
    const monRole = maReponse === 'oui' ? inscrits[moi.id]?.role : null;
    for (const role of [...soiree.roles].reverse()) {
      const pris = chauds.filter((membre) => inscrits[membre.id]?.role === role.nom).length;
      const bouton = creer('button', 'role-choix');
      bouton.type = 'button';
      bouton.dataset.reponse = 'oui';
      bouton.textContent = pris >= role.places && monRole !== role.nom ? `${role.nom} · attente` : `${role.nom} ${pris}/${role.places}`;
      bouton.setAttribute('aria-pressed', String(monRole === role.nom));
      bouton.addEventListener('click', () => repondre(soiree, 'oui', carte, role.nom));
      boutonChaud.after(bouton);
    }
  }
  // Toi, en liste d'attente : on te le dit clairement.
  if (moi && inscrits[moi.id]?.attente) {
    morceaux.push("tu es en liste d'attente");
    remplir('.soiree-compte', morceaux.join(' · '));
  }

  if (vote) carte.querySelector('.soiree-note').before(blocVote(soiree));

  // La personne qui l'a proposée peut la modifier ou l'annuler ; en
  // AllReady+, les organisateurs du groupe aussi (etat.peutGerer).
  if (moi && (soiree.createur_id === moi.id || (etat.groupe.premium && etat.peutGerer))) {
    carte.querySelector('.soiree-gestion').hidden = false;
    carte.querySelector('.soiree-modifier').addEventListener('click', () => modifierSoiree(soiree));
    carte.querySelector('.soiree-annuler').addEventListener('click', () => annulerSoiree(soiree));
  }
  return carte;
}

async function repondre(soiree, reponse, carte, role) {
  if (!etat.moi) {
    ouvrirProfil();
    return;
  }
  const boutons = carte.querySelectorAll('[data-reponse]');
  for (const bouton of boutons) bouton.disabled = true;
  try {
    const { attente } = await appeler(`/soirees/${soiree.id}`, { methode: 'PUT', corps: { reponse, role } });
    if (attente) annoncer("C'est complet : tu es en liste d'attente. Tu joueras si une place se libère.");
    await charger(); // redessine tout, boutons compris
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
    for (const bouton of boutons) bouton.disabled = false;
  }
}

/* « À QUOI ON JOUE ? » (2 nov. 2026) : un bouton par jeu en lice, avec
   sa jaquette, son nom et son nombre de votes. Le tien est enfoncé
   (aria-pressed) ; le jeu en tête est mis en avant (classe en-tete) :
   c'est lui que la soirée affiche, le serveur le recalcule à chaque
   vote. Revoter ailleurs déplace ton vote ; recliquer sur le tien le
   retire. Un simple visiteur voit le vote sans pouvoir voter. */
function blocVote(soiree) {
  const bloc = creer('div', 'vote');
  bloc.append(creer('p', 'vote-titre', 'À quoi on joue ?'));
  const comptes = soiree.choix.map((_, place) => Object.values(soiree.votes).filter((v) => v === place).length);
  const record = Math.max(...comptes);
  const enTete = record > 0 ? comptes.indexOf(record) : -1;
  const monVote = etat.moi ? soiree.votes[etat.moi.id] : undefined;
  const liste = creer('div', 'vote-jeux');
  soiree.choix.forEach((jeu, place) => {
    const bouton = creer('button', place === enTete ? 'vote-jeu en-tete' : 'vote-jeu');
    bouton.type = 'button';
    bouton.setAttribute('aria-pressed', String(monVote === place));
    bouton.append(couverture(jeu, 'mini'), creer('span', 'jeu-nom', jeu.nom),
      creer('span', 'vote-nombre', String(comptes[place])));
    bouton.setAttribute('aria-label', `${jeu.nom} : ${comptes[place]} vote${comptes[place] > 1 ? 's' : ''}`);
    bouton.disabled = !etat.moi;
    bouton.addEventListener('click', () => voter(soiree, monVote === place ? null : place));
    liste.append(bouton);
  });
  bloc.append(liste);
  return bloc;
}

async function voter(soiree, place) {
  try {
    await appeler(`/soirees/${soiree.id}`, { methode: 'PUT', corps: { vote: place } });
    await charger();
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
}

async function annulerSoiree(soiree) {
  // confirm() : la petite fenêtre « OK / Annuler » du navigateur.
  const question = soiree.hebdo
    ? `Annuler « ${soiree.titre} » ? Elle revient chaque semaine : c'est toute la série qui s'arrête.`
    : `Annuler « ${soiree.titre} » ? Les réponses de chacun seront perdues.`;
  if (!confirm(question)) return;
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
  const aujourdhui = versTexte(maintenant());
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
export function proposerSoiree({ jour, horaire, fin, jeux } = {}) {
  if (!etat.moi) {
    ouvrirProfil();
    return;
  }
  ouvrirFormulaire(null);
  champs.jour.value = jour || versTexte(maintenant());
  champs.horaire.value = horaire || '21:00';
  // La fin : donnée par un meilleur créneau (« 22h → 0h »), sinon vide.
  champs.fin.value = fin || '';
  champs.hebdo.checked = false;
  champs.roles.value = '';
  mettreAJourRoles();
  // Le jeu : donné par « À quoi jouer ce soir » (js/ce-soir.js), sinon aucun.
  selecteur.remplir(jeux || []);
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
  selecteur.remplir(soiree.choix.length ? soiree.choix : [{ id: soiree.jeu_id, nom: soiree.jeu, cover: soiree.jeu_cover }]);
  dessinerJeuxTeam();
  champs.titre.value = soiree.titre === titreParDefaut() ? '' : soiree.titre;
  champs.fin.value = soiree.fin || '';
  champs.places.value = soiree.places || '';
  champs.note.value = soiree.note;
  champs.hebdo.checked = soiree.hebdo;
  champs.roles.value = ecrireRoles(soiree.roles);
  mettreAJourRoles();
  if (soiree.roles.length) champs.places.value = '';
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

/* Le sélecteur de jeux (js/jeux.js). Plusieurs jeux permis (4 au plus,
   MAX_CHOIX dans functions/_outils.js) : un seul = une soirée sur ce
   jeu, plusieurs = la team vote (2 nov. 2026). */
const MAX_CHOIX = 4;
const selecteur = selecteurJeux(document.getElementById('soiree-jeu'), {
  multiple: true,
  max: MAX_CHOIX,
  auChangement: () => {
    mettreAJourTitre();
    dessinerJeuxTeam(); // pour marquer le jeu choisi parmi les raccourcis
  },
});

/* Le jeu de la soirée : celui choisi dans le sélecteur ; à défaut, ce
   qui est tapé dans le champ, pris tel quel (on ne perd pas une saisie
   parce qu'on a oublié de cliquer sur une proposition). */
/* LES RÔLES (AllReady+, 2 nov. 2026) : le champ « Tank 2, Heal 2,
   DPS 6 » devient [{ nom: 'Tank', places: 2 }, …] ; chaque morceau
   entre virgules finit par son nombre de places. null si un morceau
   n'a pas de nombre (le formulaire le dit). Et le chemin inverse, pour
   remplir le champ quand on modifie une soirée. */
function lireRoles(texte) {
  const morceaux = texte.split(',').map((morceau) => morceau.trim()).filter(Boolean);
  const roles = [];
  for (const morceau of morceaux) {
    const trouve = morceau.match(/^(.+?)\s*(\d+)$/);
    if (!trouve) return null;
    roles.push({ nom: trouve[1].trim(), places: Number(trouve[2]) });
  }
  return roles;
}
const ecrireRoles = (roles) => roles.map((role) => `${role.nom} ${role.places}`).join(', ');

/* Avec des rôles, les places sont leur total : le champ Places se grise
   et montre ce total. Sans abonnement, le champ Rôles est grisé et le
   « + » mène à la fenêtre AllReady+. */
function mettreAJourRoles() {
  const plus = etat.groupe?.premium;
  champs.roles.disabled = !plus;
  document.getElementById('roles-plus').hidden = Boolean(plus);
  const roles = plus ? lireRoles(champs.roles.value) : [];
  const avecRoles = Boolean(roles && roles.length);
  champs.places.disabled = avecRoles;
  champs.places.placeholder = avecRoles ? String(roles.reduce((total, role) => total + role.places, 0)) : '∞';
  if (avecRoles) champs.places.value = '';
}
champs.roles.addEventListener('input', mettreAJourRoles);

function jeuxChoisis() {
  const texte = selecteur.texte();
  const choisis = selecteur.lire();
  if (choisis.length) return choisis;
  return texte ? [{ id: null, nom: texte, cover: '' }] : [];
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
  const choisis = selecteur.lire();
  zone.replaceChildren(...jeux.map((jeu) => {
    const bouton = creer('button', 'jeu-team');
    bouton.type = 'button';
    // aria-pressed : enfoncé pour un jeu déjà choisi. Un clic l'ajoute,
    // un second le retire (plusieurs jeux = un vote).
    const choisi = choisis.some((autre) => memeJeu(autre, jeu));
    bouton.setAttribute('aria-pressed', String(choisi));
    bouton.append(couverture(jeu), creer('span', 'jeu-nom', jeu.nom));
    bouton.addEventListener('click', () => {
      if (!choisi) {
        selecteur.ajouter(jeu);
        return;
      }
      selecteur.remplir(selecteur.lire().filter((autre) => !memeJeu(autre, jeu)));
      mettreAJourTitre();
      dessinerJeuxTeam();
    });
    return bouton;
  }));
  zone.hidden = jeux.length === 0;
}

/* Le titre proposé d'office, selon l'heure : « Aprem Fortnite »,
   « Soirée Among Us ». Il s'affiche en gris dans le champ titre
   (placeholder) ; s'il reste vide, c'est lui qui est envoyé. */
function titreParDefaut() {
  const jeux = jeuxChoisis();
  if (!jeux.length) return '';
  const heure = Number((champs.horaire.value || '21').split(':')[0]);
  const moment = heure < 6 ? 'Nuit' : heure < 12 ? 'Matinée' : heure < 18 ? 'Aprem' : 'Soirée';
  // Plusieurs jeux : le jeu n'est pas encore choisi, « Soirée jeux ».
  return `${moment} ${jeux.length > 1 ? 'jeux' : jeux[0].nom}`;
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
  const jeux = jeuxChoisis();
  if (!jeux.length) {
    formulaire.querySelector('.erreur').textContent = 'Choisis un jeu.';
    return;
  }
  const roles = champs.roles.disabled ? [] : lireRoles(champs.roles.value);
  if (!roles) {
    formulaire.querySelector('.erreur').textContent = 'Écris chaque rôle suivi de son nombre de places : Tank 2, Heal 2, DPS 6.';
    return;
  }
  const bouton = formulaire.querySelector('[type="submit"]');
  bouton.disabled = true;
  const corps = {
    jeu: jeux[0],
    choix: jeux.length > 1 ? jeux : [], // plusieurs jeux : la team vote
    titre: champs.titre.value.trim() || titreParDefaut(),
    jour: champs.jour.value,
    horaire: champs.horaire.value,
    fin: champs.fin.value,          // '' = pas d'heure de fin
    places: champs.places.value,    // '' = illimité
    hebdo: champs.hebdo.checked,    // chaque semaine
    roles,                          // [] = pas de rôles (AllReady+)
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
      // Groupe branché sur Discord : on dit que le salon est prévenu.
      annoncer(etat.groupe.discord ? 'Soirée proposée et annoncée sur Discord !' : 'Soirée proposée !');
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
