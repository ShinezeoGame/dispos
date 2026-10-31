/* REJOINDRE UN GROUPE — POST /api/groupes/ABCD2345/membres

   Reçoit : { pseudo, couleur, jeux, bio } (jeux et bio facultatifs ;
   jeux = liste de jeux, voir lireJeu dans _outils.js)
   Renvoie : { membre: {…}, jeton: "64 caractères" }

   Le jeton n'est envoyé qu'UNE fois, ici. Le navigateur le range dans
   son localStorage et le joint à chaque modification ; la base n'en
   garde que l'empreinte (voir hacher() dans _outils.js). */

import {
  json, erreur, lireCorps, lireProfil, pseudoPris,
  genererJeton, hacher, identifier, MAX_MEMBRES,
} from '../../../_outils.js';

export async function onRequestPost(context) {
  const { groupe, refus } = await identifier(context, false);
  if (refus) return refus;

  const { profil, probleme } = lireProfil(await lireCorps(context.request));
  if (probleme) return erreur(400, probleme);

  const db = context.env.DB;
  const { nombre } = await db
    .prepare('SELECT COUNT(*) AS nombre FROM membres WHERE groupe_id = ?')
    .bind(groupe.id)
    .first();
  if (nombre >= MAX_MEMBRES) return erreur(403, `Ce groupe est complet (${MAX_MEMBRES} membres).`);

  // 409 = « conflit » : la demande est correcte, mais heurte l'existant.
  if (await pseudoPris(db, groupe.id, profil.pseudo)) {
    return erreur(409, 'Ce pseudo est déjà pris dans le groupe.');
  }

  const jeton = genererJeton();
  // RETURNING renvoie le numéro (id) que la base vient d'attribuer.
  // Les jeux sont rangés en texte JSON : la base ne sait pas stocker
  // une liste telle quelle.
  const { id } = await db
    .prepare(`INSERT INTO membres (groupe_id, pseudo, couleur, jeux, bio, jeton_hash)
              VALUES (?, ?, ?, ?, ?, ?)
              RETURNING id`)
    .bind(groupe.id, profil.pseudo, profil.couleur, JSON.stringify(profil.jeux), profil.bio, await hacher(jeton))
    .first();

  return json(201, { membre: { id, ...profil }, jeton });
}
