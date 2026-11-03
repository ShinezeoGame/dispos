/* PRÉSENCE ET ASSIDUITÉ (AllReady+, 2 nov. 2026)

   En bas de l'onglet Soirées, « Passées » : les cinq dernières soirées
   déjà commencées (30 jours au plus). Le serveur les envoie avec le
   groupe, dans etat.presence (presencesDuGroupe, functions/api/
   groupes/[code]/index.js) ; null dans un groupe gratuit, et la
   section reste cachée.

   Celle ou celui qui a proposé la soirée, et les organisateurs, ont un
   bouton « Qui était là ? » : une fenêtre avec une case par membre. La
   première fois, ceux qui avaient dit « Chaud » (et jouaient : pas la
   liste d'attente) sont cochés d'avance ; il ne reste qu'à décocher
   les absents. Une soirée pointée dit « 4 là · absent : Max » pour
   toute la team. Les autres membres ne voient que les soirées pointées.

   Ces pointages font la fiabilité de chacun, sur sa carte de La team
   (« Fiable à 80 % », js/team.js). */

import { etat, quandCaChange, appeler, charger, trouverMembre } from './etat.js';
import { avatar, annoncer, creer, depuisTexte, jourRelatif } from './commun.js';

const section = document.getElementById('passees');
const liste = document.getElementById('liste-passees');
const dialogue = document.getElementById('dialogue-presence');
const formulaire = document.getElementById('form-presence');
const zoneMembres = document.getElementById('presence-membres');
let enCours = null; // la soirée ouverte dans la fenêtre

// Peux-tu pointer cette soirée ? Même règle que le serveur (pointer(),
// soirees/[id].js), qui vérifie de toute façon.
function peutPointer(soiree) {
  return Boolean(etat.moi) && (soiree.createur_id === etat.moi.id || etat.peutGerer);
}

// « Sam. 31 oct. · 21h » : le jour (jourRelatif, commun.js) et l'heure.
function quand(soiree) {
  const date = depuisTexte(soiree.jour);
  const [heures, minutes] = soiree.horaire.split(':').map(Number);
  date.setHours(heures, minutes);
  return `${jourRelatif(date)} · ${heures}h${minutes ? String(minutes).padStart(2, '0') : ''}`;
}

/* Le résultat d'une soirée pointée : « 4 là », puis les absents (ceux
   qui avaient dit « Chaud » et ne sont pas venus), par leur pseudo. Un
   membre parti du groupe n'est plus nommé. */
function resultat(soiree) {
  const absents = soiree.chauds
    .filter((id) => !soiree.presents.includes(id))
    .map((id) => trouverMembre(id)?.pseudo)
    .filter(Boolean);
  let texte = `${soiree.presents.length} là`;
  if (absents.length) texte += ` · ${absents.length > 1 ? 'absents' : 'absent'} : ${absents.join(', ')}`;
  return texte;
}

function dessiner() {
  if (!etat.groupe) return;
  const passees = (etat.presence?.passees || []).filter((soiree) => soiree.pointee || peutPointer(soiree));
  section.hidden = passees.length === 0;
  liste.replaceChildren(...passees.map((soiree) => {
    const ligne = creer('li', 'finie');
    const texte = creer('div', 'finie-texte');
    texte.append(creer('p', 'finie-titre', soiree.titre), creer('p', 'finie-quand', quand(soiree)));
    ligne.append(texte);
    if (soiree.pointee) ligne.append(creer('p', 'finie-resultat', resultat(soiree)));
    if (peutPointer(soiree)) {
      // Pas encore pointée : un vrai bouton ; déjà pointée : un lien discret pour corriger.
      const bouton = creer('button', soiree.pointee ? 'lien-discret' : 'bouton bouton-second bouton-petit',
        soiree.pointee ? 'Corriger' : 'Qui était là ?');
      bouton.type = 'button';
      bouton.addEventListener('click', () => ouvrir(soiree));
      ligne.append(bouton);
    }
    return ligne;
  }));
}
quandCaChange(dessiner);

/* LA FENÊTRE : ceux qui avaient dit « Chaud » d'abord (avec la mention
   « chaud »), puis les autres membres, dans l'ordre d'arrivée. Cochés :
   les présents si la soirée est déjà pointée, sinon les « Chaud ». */
function ouvrir(soiree) {
  enCours = soiree;
  document.getElementById('presence-soiree').textContent = `${soiree.titre} · ${quand(soiree)}`;
  formulaire.querySelector('.erreur').textContent = '';
  const coches = soiree.pointee ? soiree.presents : soiree.chauds;
  const estChaud = (membre) => soiree.chauds.includes(membre.id);
  const membres = [...etat.membres].sort((a, b) => estChaud(b) - estChaud(a));
  zoneMembres.replaceChildren(...membres.map((membre) => {
    const element = creer('li');
    const etiquette = creer('label', 'presence-membre');
    const caseACocher = creer('input');
    caseACocher.type = 'checkbox';
    caseACocher.value = membre.id;
    caseACocher.checked = coches.includes(membre.id);
    etiquette.append(caseACocher, avatar(membre), creer('span', 'presence-pseudo', membre.pseudo));
    if (estChaud(membre)) etiquette.append(creer('span', 'presence-chaud', 'chaud'));
    element.append(etiquette);
    return element;
  }));
  dialogue.showModal();
}

formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  const presents = [...zoneMembres.querySelectorAll('input:checked')].map((caseACocher) => Number(caseACocher.value));
  const valider = formulaire.querySelector('[type="submit"]');
  valider.disabled = true;
  try {
    await appeler(`/soirees/${enCours.id}`, { methode: 'PUT', corps: { presents } });
    dialogue.close();
    annoncer('Présences enregistrées.');
    await charger();
  } catch (probleme) {
    formulaire.querySelector('.erreur').textContent = probleme.message;
  } finally {
    valider.disabled = false;
  }
});
