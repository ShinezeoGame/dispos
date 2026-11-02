/* UN MEMBRE DU GROUPE, VU PAR CEUX QUI LE GÈRENT — /api/groupes/ABCD2345/membres/12

   DELETE                       retirer quelqu'un du groupe (2 nov. 2026) ;
   PATCH { organisateur: true } le nommer organisateur, false pour le
                                retirer (AllReady+, 2 nov. 2026).

   Retirer : le premier membre, ou un organisateur (peutGerer, dans
   _outils.js). Pas soi-même : pour partir, c'est « Quitter le groupe »
   (DELETE /moi). Un organisateur ne retire ni le premier membre ni un
   autre organisateur : seul le premier membre le peut. Le profil retiré
   emporte ses dispos, ses réponses et sa photo (ON DELETE CASCADE).
   Attention : avec le lien du groupe, la personne peut rejoindre à
   nouveau ; pour l'empêcher, il faudrait un nouveau lien.

   Nommer un organisateur : le premier membre seulement, et seulement
   dans un groupe AllReady+. */

import { json, erreur, lireCorps, identifier, adminDuGroupe, peutGerer } from '../../../../_outils.js';

// Le membre visé, s'il est bien dans CE groupe (sinon null).
async function membreVise(db, groupe, context) {
  return db.prepare('SELECT id, organisateur FROM membres WHERE id = ? AND groupe_id = ?')
    .bind(Number(context.params.id), groupe.id)
    .first();
}

export async function onRequestDelete(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;
  const db = context.env.DB;
  if (!await peutGerer(db, groupe, moi)) {
    return erreur(403, "Seuls les organisateurs du groupe peuvent retirer quelqu'un.");
  }
  const vise = await membreVise(db, groupe, context);
  if (!vise) return erreur(404, "Ce membre n'est plus dans le groupe.");
  if (vise.id === moi.id) return erreur(400, 'Pour partir, utilise « Quitter le groupe ».');
  const admin = await adminDuGroupe(db, groupe.id);
  if (moi.id !== admin && (vise.id === admin || vise.organisateur)) {
    return erreur(403, 'Seul le premier membre peut retirer un organisateur.');
  }
  await db.prepare('DELETE FROM membres WHERE id = ?').bind(vise.id).run();
  return json(200, { ok: true });
}

export async function onRequestPatch(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;
  const db = context.env.DB;
  if (!groupe.premium) return erreur(403, 'Plusieurs organisateurs : réservé aux groupes AllReady+.');
  const admin = await adminDuGroupe(db, groupe.id);
  if (moi.id !== admin) return erreur(403, 'Seul le premier membre nomme les organisateurs.');
  const vise = await membreVise(db, groupe, context);
  if (!vise) return erreur(404, "Ce membre n'est plus dans le groupe.");
  if (vise.id === admin) return erreur(400, 'Le premier membre organise déjà le groupe.');
  const { organisateur } = await lireCorps(context.request);
  await db.prepare('UPDATE membres SET organisateur = ? WHERE id = ?').bind(organisateur === true ? 1 : 0, vise.id).run();
  return json(200, { ok: true });
}
