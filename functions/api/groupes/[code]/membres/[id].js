/* RETIRER QUELQU'UN DU GROUPE — DELETE /api/groupes/ABCD2345/membres/12
   (2 nov. 2026)

   Réservé au premier membre du groupe (adminDuGroupe, _outils.js). Pas
   soi-même : pour partir, c'est « Quitter le groupe » (DELETE /moi).
   Le profil retiré emporte ses dispos, ses réponses et sa photo (ON
   DELETE CASCADE). Attention : avec le lien du groupe, la personne peut
   rejoindre à nouveau ; pour l'empêcher, il faudrait un nouveau lien. */

import { json, erreur, identifier, adminDuGroupe } from '../../../../_outils.js';

export async function onRequestDelete(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;
  const db = context.env.DB;
  if (moi.id !== await adminDuGroupe(db, groupe.id)) {
    return erreur(403, 'Seul le premier membre du groupe peut retirer quelqu\'un.');
  }
  const id = Number(context.params.id);
  if (id === moi.id) return erreur(400, 'Pour partir, utilise « Quitter le groupe ».');
  // « AND groupe_id = ? » : seulement un membre de CE groupe.
  const { meta } = await db.prepare('DELETE FROM membres WHERE id = ? AND groupe_id = ?').bind(id, groupe.id).run();
  if (!meta.changes) return erreur(404, "Ce membre n'est plus dans le groupe.");
  return json(200, { ok: true });
}
