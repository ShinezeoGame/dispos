/* MODIFIER SON PROFIL — PUT /api/groupes/ABCD2345/moi

   « moi » plutôt que « membres/3 » : on ne peut modifier que son
   propre profil, et c'est le jeton qui dit qui on est. Pas de numéro
   dans l'adresse, donc pas de numéro à trafiquer.

   PUT veut dire « remplace par ceci » : on envoie le profil complet,
   pas seulement ce qui change.

   Reçoit : { pseudo, couleur, jeux, bio, perso }
   Renvoie : { membre: {…} } */

import { json, erreur, lireCorps, lireProfil, pseudoPris, identifier } from '../../../_outils.js';

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
