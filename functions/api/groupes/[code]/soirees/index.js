/* PROPOSER UNE SOIRÉE — POST /api/groupes/ABCD2345/soirees

   Reçoit : { titre: "Soirée Among Us", jeu: "Among Us",
              jour: "2026-11-07", horaire: "21:00", note: "…" }
   Renvoie : { id: 12 }

   La personne qui propose est inscrite d'office : on ne propose pas
   une soirée pour ne pas y venir. */

import { json, erreur, lireCorps, ligne, bloc, estDate, identifier } from '../../../../_outils.js';

export async function onRequestPost(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const corps = await lireCorps(context.request);
  const jeu = ligne(corps.jeu);
  // Sans titre, le nom du jeu fait l'affaire.
  const titre = ligne(corps.titre) || jeu;
  const note = bloc(corps.note);

  if (jeu.length < 1 || jeu.length > 40) return erreur(400, 'Indique le jeu (40 caractères au plus).');
  if (titre.length > 60) return erreur(400, 'Le titre est trop long (60 caractères au plus).');
  if (!estDate(corps.jour)) return erreur(400, 'Choisis une date.');
  // De 00:00 à 23:59, toujours sur deux chiffres.
  if (typeof corps.horaire !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(corps.horaire)) {
    return erreur(400, 'Choisis une heure.');
  }
  if (note.length > 300) return erreur(400, 'Le petit mot est trop long (300 caractères au plus).');

  const db = context.env.DB;
  const soiree = await db
    .prepare(`INSERT INTO soirees (groupe_id, createur_id, titre, jeu, jour, horaire, note)
              VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(groupe.id, moi.id, titre, jeu, corps.jour, corps.horaire, note)
    .first();

  await db
    .prepare("INSERT INTO reponses (soiree_id, membre_id, reponse) VALUES (?, ?, 'oui')")
    .bind(soiree.id, moi.id)
    .run();

  return json(201, { id: soiree.id });
}
