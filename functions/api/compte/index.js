/* QUI EST CONNECTÉ ? — GET /api/compte

   Renvoie : { compte: { nom: "Max", discord: "max92" },
               groupes: [{ code: "ABCD2345", nom: "Les potes du jeudi" }, …] }
   ou, sans connexion : { compte: null, groupes: [] }

   Utilisé par l'accueil : afficher « Se connecter » ou ton nom, et
   lister tes groupes. Ceux-là viennent de la base, et non plus
   seulement du navigateur : connecté sur un nouvel appareil, tu les
   retrouves tous. */

import { json, compteConnecte } from '../../_outils.js';

export async function onRequestGet({ request, env }) {
  const compte = await compteConnecte(request, env.DB);
  if (!compte) return json(200, { compte: null, groupes: [] });

  // Les groupes où ce compte a un profil, le plus récemment rejoint en
  // premier (m.id grandit à chaque inscription).
  const { results } = await env.DB
    .prepare(`SELECT g.code, g.nom FROM membres m
              JOIN groupes g ON g.id = m.groupe_id
              WHERE m.compte_id = ?
              ORDER BY m.id DESC LIMIT 100`)
    .bind(compte.id)
    .all();

  return json(200, { compte: { nom: compte.nom, discord: compte.discord }, groupes: results });
}
