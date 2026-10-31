/* PROPOSER UNE SOIRÉE — POST /api/groupes/ABCD2345/soirees

   Reçoit : { titre: "Soirée Among Us",
              jeu: { id: 17269, nom: "Among Us", cover: "co1r7f" },
              jour: "2026-11-07", horaire: "21:00", note: "…" }
   Renvoie : { id: 12 }

   La personne qui propose est inscrite d'office : on ne propose pas
   une soirée pour ne pas y venir. */

import { json, erreur, lireCorps, ligne, bloc, estDate, identifier, lireJeu } from '../../../../_outils.js';

export async function onRequestPost(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const corps = await lireCorps(context.request);
  const jeu = lireJeu(corps.jeu);
  if (!jeu) return erreur(400, 'Choisis un jeu.');
  // Sans titre, le nom du jeu fait l'affaire.
  const titre = ligne(corps.titre) || jeu.nom;
  const note = bloc(corps.note);

  if (titre.length > 80) return erreur(400, 'Le titre est trop long (80 caractères au plus).');
  if (!estDate(corps.jour)) return erreur(400, 'Choisis une date.');
  // De 00:00 à 23:59, toujours sur deux chiffres.
  if (typeof corps.horaire !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(corps.horaire)) {
    return erreur(400, 'Choisis une heure.');
  }
  if (note.length > 300) return erreur(400, 'Le petit mot est trop long (300 caractères au plus).');

  const db = context.env.DB;
  const soiree = await db
    .prepare(`INSERT INTO soirees (groupe_id, createur_id, titre, jeu, jeu_cover, jour, horaire, note)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(groupe.id, moi.id, titre, jeu.nom, jeu.cover, corps.jour, corps.horaire, note)
    .first();

  await db
    .prepare("INSERT INTO reponses (soiree_id, membre_id, reponse) VALUES (?, ?, 'oui')")
    .bind(soiree.id, moi.id)
    .run();

  return json(201, { id: soiree.id });
}
