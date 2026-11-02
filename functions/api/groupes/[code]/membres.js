/* REJOINDRE UN GROUPE — POST /api/groupes/ABCD2345/membres

   Reçoit : { pseudo, couleur, jeux, bio, perso } (seul le pseudo est
   obligatoire ; jeux = liste de jeux, voir lireJeu dans _outils.js)
   Renvoie : { membre: {…} }

   Il faut être connecté avec Discord (voir « Les comptes » dans
   _outils.js) : le profil est relié au compte, et un compte n'a qu'un
   profil par groupe. C'est ce qui permet de retrouver ses groupes sur
   n'importe quel appareil. */

import {
  json, erreur, lireCorps, lireProfil, pseudoPris,
  genererJeton, hacher, identifier, MAX_MEMBRES,
} from '../../../_outils.js';

export async function onRequestPost(context) {
  const { groupe, moi, compte, refus } = await identifier(context, false);
  if (refus) return refus;

  // 401 = « il faut d'abord dire qui tu es ».
  if (!compte) return erreur(401, 'Connecte-toi avec Discord pour rejoindre le groupe.');
  // 409 = « conflit » : la demande est correcte, mais heurte l'existant.
  if (moi) return erreur(409, 'Tu fais déjà partie de ce groupe.');

  const { profil, probleme } = lireProfil(await lireCorps(context.request));
  if (probleme) return erreur(400, probleme);

  const db = context.env.DB;
  const { nombre } = await db
    .prepare('SELECT COUNT(*) AS nombre FROM membres WHERE groupe_id = ?')
    .bind(groupe.id)
    .first();
  // 15 membres pour un groupe gratuit, 100 en AllReady+ (MAX_MEMBRES).
  const maximum = groupe.premium ? MAX_MEMBRES.plus : MAX_MEMBRES.gratuit;
  if (nombre >= maximum) {
    return erreur(403, groupe.premium
      ? `Ce groupe est complet (${maximum} membres).`
      : `Ce groupe est complet (${maximum} membres). En AllReady+, il peut accueillir jusqu'à ${MAX_MEMBRES.plus} membres.`);
  }

  if (await pseudoPris(db, groupe.id, profil.pseudo)) {
    return erreur(409, 'Ce pseudo est déjà pris dans le groupe.');
  }

  /* RETURNING renvoie le numéro (id) que la base vient d'attribuer.
     Les jeux et la personnalisation sont rangés en texte JSON : la base
     ne sait pas stocker une liste telle quelle.
     jeton_hash : la colonne l'exige (elle date d'avant les comptes). On
     y range l'empreinte d'un jeton tiré au hasard et aussitôt oublié :
     personne ne pourra jamais s'en servir. C'est le compte qui fait foi. */
  const { id } = await db
    .prepare(`INSERT INTO membres (groupe_id, compte_id, pseudo, couleur, jeux, bio, perso, jeton_hash)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              RETURNING id`)
    .bind(groupe.id, compte.id, profil.pseudo, profil.couleur, JSON.stringify(profil.jeux), profil.bio,
      JSON.stringify(profil.perso), await hacher(genererJeton()))
    .first();

  return json(201, { membre: { id, ...profil } });
}
