/* RÉPONDRE À UNE SOIRÉE OU L'ANNULER — /api/groupes/ABCD2345/soirees/12

   PUT    { reponse: "oui" | "peutetre" | "non" } → ta réponse
   DELETE                                         → annule la soirée

   Un même fichier peut répondre à plusieurs méthodes : onRequestPut
   pour l'une, onRequestDelete pour l'autre. */

import { json, erreur, lireCorps, identifier, REPONSES } from '../../../../_outils.js';

/* La soirée doit appartenir AU groupe du lien. Sans ce
   « AND groupe_id = ? », un membre d'un groupe pourrait répondre aux
   soirées d'un autre groupe en changeant le numéro dans l'adresse. */
async function trouverSoiree(db, groupeId, id) {
  return db
    .prepare('SELECT id, createur_id FROM soirees WHERE id = ? AND groupe_id = ?')
    .bind(Number(id), groupeId)
    .first();
}

export async function onRequestPut(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const db = context.env.DB;
  const soiree = await trouverSoiree(db, groupe.id, context.params.id);
  if (!soiree) return erreur(404, "Cette soirée n'existe plus.");

  const { reponse } = await lireCorps(context.request);
  if (!REPONSES.includes(reponse)) return erreur(400, 'Réponse inconnue.');

  // Même principe que pour les dispos : crée la réponse ou la remplace.
  await db
    .prepare(`INSERT INTO reponses (soiree_id, membre_id, reponse) VALUES (?, ?, ?)
              ON CONFLICT (soiree_id, membre_id) DO UPDATE SET reponse = excluded.reponse`)
    .bind(soiree.id, moi.id, reponse)
    .run();

  return json(200, { ok: true });
}

export async function onRequestDelete(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const db = context.env.DB;
  const soiree = await trouverSoiree(db, groupe.id, context.params.id);
  if (!soiree) return erreur(404, "Cette soirée n'existe plus.");

  // 403 = « interdit » : on sait qui tu es, mais ce n'est pas à toi.
  if (soiree.createur_id !== moi.id) {
    return erreur(403, "Seule la personne qui a proposé la soirée peut l'annuler.");
  }

  // Les réponses partent avec elle (ON DELETE CASCADE).
  await db.prepare('DELETE FROM soirees WHERE id = ?').bind(soiree.id).run();
  return json(200, { ok: true });
}
