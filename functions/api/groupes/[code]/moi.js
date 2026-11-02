/* MODIFIER SON PROFIL — PUT /api/groupes/ABCD2345/moi

   « moi » plutôt que « membres/3 » : on ne peut modifier que son
   propre profil, et c'est le jeton qui dit qui on est. Pas de numéro
   dans l'adresse, donc pas de numéro à trafiquer.

   PUT veut dire « remplace par ceci » : on envoie le profil complet,
   pas seulement ce qui change.

   Reçoit : { pseudo, couleur, jeux, bio, perso }
   Renvoie : { membre: {…} } */

import { json, erreur, lireCorps, lireProfil, pseudoPris, identifier } from '../../../_outils.js';

/* QUITTER LE GROUPE — DELETE /api/groupes/ABCD2345/moi (2 nov. 2026)

   Ton profil disparaît, et avec lui (ON DELETE CASCADE) tes dispos, tes
   réponses aux soirées et ta photo. Les soirées que tu as proposées
   restent, sans auteur (ON DELETE SET NULL) : les autres y sont
   peut-être inscrits. Le dernier membre qui s'en va emporte le groupe :
   un groupe vide ne sert plus à personne. */
export async function onRequestDelete(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;
  const db = context.env.DB;
  await db.prepare('DELETE FROM membres WHERE id = ?').bind(moi.id).run();
  const { reste } = await db.prepare('SELECT COUNT(*) AS reste FROM membres WHERE groupe_id = ?').bind(groupe.id).first();
  if (reste === 0) await db.prepare('DELETE FROM groupes WHERE id = ?').bind(groupe.id).run();
  return json(200, { ok: true });
}

export async function onRequestPut(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const { profil, probleme } = lireProfil(await lireCorps(context.request));
  if (probleme) return erreur(400, probleme);

  const db = context.env.DB;
  if (await pseudoPris(db, groupe.id, profil.pseudo, moi.id)) {
    return erreur(409, 'Ce pseudo est déjà pris dans le groupe.');
  }

  await db
    .prepare('UPDATE membres SET pseudo = ?, couleur = ?, jeux = ?, bio = ?, perso = ? WHERE id = ?')
    .bind(profil.pseudo, profil.couleur, JSON.stringify(profil.jeux), profil.bio, JSON.stringify(profil.perso), moi.id)
    .run();

  return json(200, { membre: { id: moi.id, ...profil } });
}
