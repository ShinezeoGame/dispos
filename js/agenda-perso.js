/* TON AGENDA À TOI (AllReady+, 2 nov. 2026)

   En mode « Mes dispos », le bouton « Synchroniser mon agenda » (à côté
   de « Répéter chaque semaine ») ouvre une petite fenêtre où coller
   l'adresse secrète iCal de Google Agenda, d'Apple ou d'Outlook (voir
   functions/_agenda.js). Ensuite, les cases où ton agenda a un
   rendez-vous sont hachurées : tu vois d'un coup d'œil où tu n'es pas
   libre, avant de cocher. Personne d'autre ne les voit.

   Dans un groupe gratuit, le bouton porte un « + » et ouvre la fenêtre
   AllReady+ (data-plus, voir js/plus.js). Sans compte Discord (profil
   d'avant les comptes), pas de bouton : l'agenda appartient au compte.

   occupees(semaine) donne, pour l'agenda (js/agenda.js), l'ensemble des
   cases occupées d'une semaine (« 2-18 », …), demandé au serveur une
   fois par semaine affichée. */

import { etat, appeler, charger, redessiner } from './etat.js';
import { api, annoncer, versTexte } from './commun.js';

const bouton = document.getElementById('mon-agenda');
const dialogue = document.getElementById('dialogue-agenda');
const formulaire = document.getElementById('form-agenda');
const champ = document.getElementById('adresse-agenda');
const debrancher = document.getElementById('debrancher-agenda');

const parSemaine = new Map(); // « 2026-11-02 » → Set des cases occupées
const enRoute = new Set();    // les semaines déjà demandées, réponse pas encore arrivée

// Les cases occupées de la semaine affichée (vide tant que rien n'est arrivé).
export function occupees() {
  return parSemaine.get(versTexte(etat.semaine)) || new Set();
}

/* Appelé par l'agenda à chaque dessin en mode « Mes dispos » : le
   bouton, puis, si l'agenda est synchronisé, les cases de la semaine
   (une seule demande par semaine ; la réponse redessine la page). */
export function preparerAgendaPerso() {
  const plus = etat.groupe.premium;
  const branche = Boolean(etat.compte?.agenda);
  bouton.hidden = !etat.compte;
  bouton.textContent = branche && plus ? 'Agenda synchronisé ✓' : 'Synchroniser mon agenda';
  bouton.toggleAttribute('data-plus', !plus);
  bouton.classList.toggle('avec-plus', !plus);
  if (!plus || !branche) return;
  const semaine = versTexte(etat.semaine);
  if (parSemaine.has(semaine) || enRoute.has(semaine)) return;
  enRoute.add(semaine);
  appeler(`/occupe?semaine=${semaine}`)
    .then(({ occupe }) => {
      parSemaine.set(semaine, new Set(occupe.map(([jour, heure]) => `${jour}-${heure}`)));
      redessiner();
    })
    .catch((probleme) => annoncer(probleme.message, 'erreur'))
    .finally(() => enRoute.delete(semaine));
}

// La fenêtre : seulement dans un groupe AllReady+ (sinon c'est data-plus qui agit).
bouton.addEventListener('click', () => {
  if (!etat.groupe.premium) return;
  formulaire.reset();
  formulaire.querySelector('.erreur').textContent = '';
  debrancher.hidden = !etat.compte?.agenda;
  dialogue.showModal();
});

// Après un changement, on oublie ce qu'on savait et on recharge.
async function apres(message) {
  parSemaine.clear();
  dialogue.close();
  annoncer(message);
  await charger();
}

formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  const valider = formulaire.querySelector('[type="submit"]');
  valider.disabled = true;
  try {
    await api('/compte/agenda', { methode: 'PUT', corps: { adresse: champ.value } });
    await apres('Agenda synchronisé : tes créneaux occupés sont hachurés.');
  } catch (probleme) {
    formulaire.querySelector('.erreur').textContent = probleme.message;
  } finally {
    valider.disabled = false;
  }
});

debrancher.addEventListener('click', async () => {
  try {
    await api('/compte/agenda', { methode: 'DELETE' });
    await apres('Agenda débranché.');
  } catch (probleme) {
    annoncer(probleme.message, 'erreur');
  }
});
