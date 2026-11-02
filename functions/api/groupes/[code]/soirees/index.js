/* PROPOSER UNE SOIRÉE — POST /api/groupes/ABCD2345/soirees

   Reçoit : { titre: "Soirée Among Us",
              jeu: { id: 17269, nom: "Among Us", cover: "co1r7f" },
              jour: "2026-11-07", horaire: "21:00", note: "…" }
   Renvoie : { id: 12 }

   Les vérifications (jeu, date, heure, longueurs) sont dans
   lireSoiree (_outils.js), partagées avec la modification.

   La personne qui propose est inscrite d'office : on ne propose pas
   une soirée pour ne pas y venir. */

import { json, erreur, lireCorps, identifier, lireSoiree } from '../../../../_outils.js';
import { annoncerSoiree } from '../../../../_annonces.js';

export async function onRequestPost(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const { soiree, probleme } = lireSoiree(await lireCorps(context.request));
  if (probleme) return erreur(400, probleme);

  const db = context.env.DB;
  const { id } = await db
    // choix : les jeux du vote en JSON, ou '' s'il n'y a qu'un jeu.
    .prepare(`INSERT INTO soirees (groupe_id, createur_id, titre, jeu, jeu_cover, jeu_id, jour, horaire, fin, places, note, choix)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(groupe.id, moi.id, soiree.titre, soiree.jeu.nom, soiree.jeu.cover, soiree.jeu.id,
      soiree.jour, soiree.horaire, soiree.fin, soiree.places, soiree.note,
      soiree.choix.length ? JSON.stringify(soiree.choix) : '')
    .first();

  await db
    .prepare("INSERT INTO reponses (soiree_id, membre_id, reponse) VALUES (?, ?, 'oui')")
    .bind(id, moi.id)
    .run();

  // Sur Discord, si le groupe y a branché un salon (_annonces.js).
  annoncerSoiree(context, groupe, 'nouvelle', { ...soiree, jeu: soiree.jeu.nom, jeu_cover: soiree.jeu.cover }, moi.pseudo);

  return json(201, { id });
}
