/* RÉPONDRE À UNE SOIRÉE, LA MODIFIER OU L'ANNULER — /api/groupes/ABCD2345/soirees/12

   PUT    { reponse: "oui" | "peutetre" | "non" } → ta réponse
   PATCH  { jeu, titre, jour, horaire, note }      → modifie la soirée
   DELETE                                         → annule la soirée

   Un même fichier peut répondre à plusieurs méthodes : onRequestPut
   pour l'une, onRequestPatch pour l'autre, etc. Modifier et annuler
   sont réservés à la personne qui a proposé la soirée. */

import { json, erreur, lireCorps, identifier, lireSoiree, REPONSES } from '../../../../_outils.js';

/* La soirée doit appartenir AU groupe du lien. Sans ce
   « AND groupe_id = ? », un membre d'un groupe pourrait répondre aux
   soirées d'un autre groupe en changeant le numéro dans l'adresse. */
async function trouverSoiree(db, groupeId, id) {
  return db
    .prepare('SELECT id, createur_id, jour, horaire FROM soirees WHERE id = ? AND groupe_id = ?')
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

/* MODIFIER — PATCH veut dire « modifie ceci ». On envoie la soirée
   complète, comme à la création, et elle est vérifiée de la même façon
   (lireSoiree).

   Changer la date ou l'heure remet les réponses des autres à zéro : un
   « Chaud » pour vendredi 21 h ne vaut pas pour samedi. Chacun revoit
   alors la soirée comme « sans réponse » (la pastille de l'onglet), ce
   qui le prévient du changement. La réponse de la personne qui modifie
   reste. Un nouveau titre, un autre jeu ou un autre petit mot gardent
   toutes les réponses.

   Renvoie : { ok: true, reponsesEffacees: true | false } */
export async function onRequestPatch(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const db = context.env.DB;
  const ancienne = await trouverSoiree(db, groupe.id, context.params.id);
  if (!ancienne) return erreur(404, "Cette soirée n'existe plus.");
  if (ancienne.createur_id !== moi.id) {
    return erreur(403, 'Seule la personne qui a proposé la soirée peut la modifier.');
  }

  const { soiree, probleme } = lireSoiree(await lireCorps(context.request));
  if (probleme) return erreur(400, probleme);

  const autreMoment = soiree.jour !== ancienne.jour || soiree.horaire !== ancienne.horaire;
  const instructions = [
    db.prepare(`UPDATE soirees SET titre = ?, jeu = ?, jeu_cover = ?, jeu_id = ?, jour = ?, horaire = ?, note = ?
                WHERE id = ?`)
      .bind(soiree.titre, soiree.jeu.nom, soiree.jeu.cover, soiree.jeu.id, soiree.jour, soiree.horaire,
        soiree.note, ancienne.id),
  ];
  if (autreMoment) {
    instructions.push(db.prepare('DELETE FROM reponses WHERE soiree_id = ? AND membre_id != ?').bind(ancienne.id, moi.id));
  }
  // batch : les deux ensemble ou aucune (une transaction).
  await db.batch(instructions);

  return json(200, { ok: true, reponsesEffacees: autreMoment });
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
