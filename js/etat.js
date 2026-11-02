/* LA MÉMOIRE DE LA PAGE GROUPE

   Toutes les données affichées vivent dans un seul objet, « etat ».
   Chaque partie de l'écran (agenda, soirées, team) le lit pour se
   dessiner.

   Le principe : quand les données changent, on ne retouche pas
   l'écran morceau par morceau. On met etat à jour, puis on prévient
   tout le monde (redessiner) et chaque partie se redessine entièrement
   à partir de etat. Plus simple à suivre, et impossible d'oublier un
   endroit. */

import { api, lundiDe, versTexte, depuisTexte, ajouterJours, retenirGroupe, HEURE_DEBUT, HEURE_FIN, maintenant, reglerFuseau } from './commun.js';

export const etat = {
  // Le code du groupe, lu dans l'adresse : /groupe?g=ABCD2345
  code: (new URLSearchParams(location.search).get('g') || '').toUpperCase(),
  jeton: null,          // l'ancien secret des profils d'avant les comptes (posé par groupe.js)
  compte: null,         // ton compte Discord { nom, discord }, ou null si tu n'es pas connecté
  groupe: null,         // { code, nom }
  moi: null,            // ton profil complet, ou null si tu n'es pas inscrit
  membres: [],          // [{ id, pseudo, couleur, jeux, bio }, …]
  semaine: lundiDe(new Date()), // le lundi de la semaine affichée
  semaineChargee: null, // la semaine que le serveur a vraiment renvoyée
  dispos: new Map(),    // id du membre → ensemble de cases "jour-heure"
  soirees: [],          // les soirées, avec leurs réponses
  sauvegardeEnAttente: false, // des cases cochées pas encore envoyées
};


/* PRÉVENIR LES PARTIES DE L'ÉCRAN

   Chaque module s'inscrit une fois : quandCaChange(dessiner). Ensuite,
   chaque appel à redessiner() relance toutes les fonctions inscrites. */
const abonnes = [];

export function quandCaChange(fonction) {
  abonnes.push(fonction);
}

export function redessiner() {
  for (const fonction of abonnes) fonction();
}


/* CHARGER LES DONNÉES DU SERVEUR

   Si on clique vite plusieurs fois sur « semaine suivante », plusieurs
   demandes partent et peuvent revenir dans le désordre. Chaque demande
   reçoit donc un numéro ; une réponse qui revient alors qu'une demande
   plus récente est partie est ignorée. Sans ça, l'écran pourrait
   afficher les dispos d'une semaine sous le titre d'une autre. */
let derniereDemande = 0;

export async function charger() {
  const numero = ++derniereDemande;
  const donnees = await api(`/groupes/${etat.code}?semaine=${versTexte(etat.semaine)}`, { jeton: etat.jeton });
  if (numero !== derniereDemande) return;

  /* Tes propres cases : si la semaine n'a pas changé, on garde celles
     de l'écran plutôt que celles du serveur. C'est toi qui les
     modifies, l'écran est donc toujours au moins aussi à jour, même
     quand un enregistrement est encore en route. */
  const garderLesMiennes = etat.moi && etat.semaineChargee === donnees.semaine;
  const miennes = garderLesMiennes ? etat.dispos.get(etat.moi.id) : null;

  etat.groupe = donnees.groupe;
  /* Le fuseau du groupe : maintenant() (commun.js) donne désormais
     l'heure de là-bas. Au tout premier chargement, la semaine affichée
     avait été choisie à l'heure de l'appareil : on la recale si, à
     l'heure du groupe, on est déjà (ou encore) dans une autre semaine. */
  const premierChargement = !etat.semaineChargee;
  reglerFuseau(donnees.groupe.fuseau);
  if (premierChargement && etat.semaine.getTime() !== lundiDe(maintenant()).getTime()) {
    etat.semaine = lundiDe(maintenant());
    return charger();
  }
  etat.compte = donnees.compte;
  etat.semaineType = donnees.semaineType; // ta case « Répéter chaque semaine »
  etat.admin = donnees.admin;             // l'id du premier membre, qui décide
  etat.membres = donnees.membres;
  etat.moi = donnees.membres.find((membre) => membre.id === donnees.moi) || null;
  /* Gérer le groupe (renommer, fuseau, Discord, retirer quelqu'un ; en
     AllReady+, modifier n'importe quelle soirée) : le premier membre, et
     dans un groupe AllReady+ les organisateurs. Même règle que peutGerer()
     côté serveur (functions/_outils.js), qui vérifie de toute façon. */
  etat.peutGerer = Boolean(etat.moi)
    && (etat.moi.id === donnees.admin || (donnees.groupe.premium && etat.moi.organisateur));
  etat.semaineChargee = donnees.semaine;

  /* Le serveur envoie { 3: [[0,21],[0,22]] }. On en fait une Map dont
     chaque valeur est un Set de textes "0-21", "0-22" : un Set répond
     instantanément à « cette case est-elle cochée ? » (has), et ne
     peut pas contenir deux fois la même case. */
  etat.dispos = new Map();
  for (const [id, creneaux] of Object.entries(donnees.dispos)) {
    etat.dispos.set(Number(id), new Set(creneaux.map(([jour, heure]) => `${jour}-${heure}`)));
  }
  if (miennes) etat.dispos.set(etat.moi.id, miennes);

  etat.soirees = donnees.soirees;
  etat.stats = donnees.stats;             // la team en chiffres (stats.js)
  retenirGroupe(etat.code, { nom: donnees.groupe.nom });
  redessiner();
}


/* LES RACCOURCIS */

// appeler('/dispos', …) = api('/groupes/ABCD2345/dispos', …) avec ton jeton.
export function appeler(chemin, options = {}) {
  return api(`/groupes/${etat.code}${chemin}`, { ...options, jeton: etat.jeton });
}

export function trouverMembre(id) {
  return etat.membres.find((membre) => membre.id === id);
}

// Tes cases cochées pour la semaine affichée (créées vides au besoin).
export function mesCases() {
  if (!etat.dispos.has(etat.moi.id)) etat.dispos.set(etat.moi.id, new Set());
  return etat.dispos.get(etat.moi.id);
}

/* « CE SOIR » (2 nov. 2026), pour le bouton « Chaud ce soir » de
   l'agenda et « À quoi jouer ce soir » (js/ce-soir.js) : de 19 h (ou
   de l'heure en cours) jusqu'à 3 h du matin. */
const DEBUT_DU_SOIR = 19;

/* Les cases de « ce soir » : leur semaine (un lundi) et leurs clés
   ("2-19", "2-20"…). Avant 3 h du matin, on est encore dans la soirée
   de la veille : à 1 h dans la nuit de mardi à mercredi, ce soir =
   mardi, heures 25 et 26 (voir « Les heures dépassent 23 »). */
export function ceSoir() {
  const ceMoment = maintenant(); // l'heure du groupe (commun.js)
  let jour = new Date(ceMoment.getFullYear(), ceMoment.getMonth(), ceMoment.getDate());
  let depart = Math.max(ceMoment.getHours(), DEBUT_DU_SOIR);
  if (ceMoment.getHours() < HEURE_FIN - 24) {
    jour = ajouterJours(jour, -1);
    depart = ceMoment.getHours() + 24;
  }
  const semaine = lundiDe(jour);
  const numero = Math.round((jour - semaine) / 86400000);
  const cles = [];
  for (let heure = depart; heure < HEURE_FIN; heure++) cles.push(`${numero}-${heure}`);
  return { semaine, cles };
}

// Le lien d'invitation, à coller sur Discord ou ailleurs.
export function lienGroupe() {
  return `${location.origin}/groupe?g=${etat.code}`;
}

/* Le début réel d'une case : jour 4 (vendredi), heure 25 →
   samedi 1 h du matin. setHours(25) fait le calcul tout seul : il
   déborde sur le lendemain. */
export function debutCase(jour, heure) {
  const date = ajouterJours(etat.semaine, jour);
  date.setHours(heure);
  return date;
}

/* Le chemin inverse : une date et un horaire de soirée ("2026-11-07",
   "01:30") → la case de l'agenda où elle tombe ("4-25" : vendredi,
   1 h du matin), ou null si elle tombe hors de la semaine affichée ou
   entre 3 h et 9 h, où l'agenda n'a pas de case. */
export function caseDe(jour, horaire) {
  let colonne = depuisTexte(jour);
  let heure = Number(horaire.split(':')[0]);
  // Avant 9 h, c'est la nuit de la veille : 1 h → 25 la veille.
  if (heure < HEURE_DEBUT) {
    colonne = ajouterJours(colonne, -1);
    heure += 24;
  }
  if (heure >= HEURE_FIN) return null;
  // Math.round et non Math.floor : un jour de changement d'heure dure
  // 23 ou 25 heures, et la division ne tombe pas juste.
  const numeroDuJour = Math.round((colonne - etat.semaine) / 86400000);
  if (numeroDuJour < 0 || numeroDuJour > 6) return null;
  return `${numeroDuJour}-${heure}`;
}
