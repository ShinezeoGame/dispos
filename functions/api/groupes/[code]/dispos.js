/* ENREGISTRER SES DISPOS DE LA SEMAINE — PUT /api/groupes/ABCD2345/dispos

   Reçoit : { semaine: "2026-11-02", creneaux: [[0,21],[0,22],[4,20]] }
   (0 = lundi … 6 = dimanche ; l'heure va de HEURE_DEBUT à HEURE_FIN - 1,
   25 = 1 h du matin dans la nuit qui suit ce jour-là)

   La liste envoyée REMPLACE celle de la semaine : décocher une case,
   c'est renvoyer la liste sans elle. Une liste vide efface tout. */

import {
  json, erreur, lireCorps, estLundi, identifier, HEURE_DEBUT, HEURE_FIN,
} from '../../../_outils.js';

// Une case valide : un tableau de deux nombres entiers, dans l'agenda.
function caseValide(creneau) {
  return Array.isArray(creneau)
    && creneau.length === 2
    && Number.isInteger(creneau[0]) && creneau[0] >= 0 && creneau[0] <= 6
    && Number.isInteger(creneau[1]) && creneau[1] >= HEURE_DEBUT && creneau[1] < HEURE_FIN;
}

export async function onRequestPut(context) {
  const { moi, refus } = await identifier(context);
  if (refus) return refus;

  const corps = await lireCorps(context.request);
  if (!estLundi(corps.semaine)) return erreur(400, 'Semaine invalide.');

  // Au plus une fois chaque case de la semaine : au-delà, la liste
  // est forcément fausse (ou malveillante).
  const creneaux = corps.creneaux;
  const nombreDeCases = 7 * (HEURE_FIN - HEURE_DEBUT);
  if (!Array.isArray(creneaux) || creneaux.length > nombreDeCases || !creneaux.every(caseValide)) {
    return erreur(400, 'Ces créneaux ne rentrent pas dans l\'agenda.');
  }

  /* « INSERT … ON CONFLICT DO UPDATE » : crée la ligne de la semaine
     si elle n'existe pas encore, la remplace sinon. Une seule
     instruction pour les deux cas. excluded.creneaux désigne la
     valeur qu'on essayait d'insérer. */
  await context.env.DB
    .prepare(`INSERT INTO dispos (membre_id, semaine, creneaux) VALUES (?, ?, ?)
              ON CONFLICT (membre_id, semaine) DO UPDATE SET creneaux = excluded.creneaux`)
    .bind(moi.id, corps.semaine, JSON.stringify(creneaux))
    .run();

  return json(200, { ok: true });
}
