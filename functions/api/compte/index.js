/* QUI EST CONNECTÉ ? — GET /api/compte

   Renvoie : { compte: { nom: "Max", discord: "max92", themes: false },
               groupes: [{ code: "ABCD2345", nom: "Les potes du jeudi" }, …] }
   ou, sans connexion : { compte: null, groupes: [] }

   Utilisé par l'accueil : afficher « Se connecter » ou ton nom, et
   lister tes groupes. Ceux-là viennent de la base, et non plus
   seulement du navigateur : connecté sur un nouvel appareil, tu les
   retrouves tous. */

import {
  json, erreur, lireCorps, compteConnecte, fermerSession, themesDebloques, notifsCoupees, TYPES_NOTIFS,
} from '../../_outils.js';

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

  // themes : les thèmes exclusifs sont-ils débloqués ? (soutien, ou un
  // groupe AllReady+ ; voir themesDebloques et js/apparence.js)
  return json(200, {
    compte: { nom: compte.nom, discord: compte.discord, themes: await themesDebloques(env.DB, compte.id) },
    groupes: results,
  });
}


/* TES NOTIFICATIONS — PATCH /api/compte (5 nov. 2026)

   Reçoit : { coupees: ["dispos", "membres"] } : les sortes de
   notifications que tu ne veux plus (TYPES_NOTIFS, _outils.js). Elles
   valent pour ton compte : tous tes appareils, tous tes groupes. Une
   sorte inconnue est ignorée ; une liste vide remet tout. Renvoie la
   liste rangée : { coupees: […] }. */
export async function onRequestPatch({ request, env }) {
  const compte = await compteConnecte(request, env.DB);
  if (!compte) return erreur(401, "Tu n'es pas connecté.");
  const { coupees } = await lireCorps(request);
  if (!Array.isArray(coupees)) return erreur(400, 'Liste de notifications invalide.');
  // Dans l'ordre de TYPES_NOTIFS, sans doublon ni sorte inconnue.
  const liste = TYPES_NOTIFS.filter((type) => coupees.includes(type));
  await env.DB.prepare('UPDATE comptes SET notifs = ? WHERE id = ?')
    .bind(liste.length ? JSON.stringify(liste) : '', compte.id).run();
  return json(200, { coupees: notifsCoupees(JSON.stringify(liste)) });
}


/* SUPPRIMER SON COMPTE — DELETE /api/compte (2 nov. 2026)

   Efface tout ce que le site sait de toi, en une seule fois :
   1. les groupes dont tu es le SEUL membre (personne d'autre à qui
      les laisser) ; leurs soirées partent avec eux (CASCADE) ;
   2. tes profils dans les autres groupes, avec leurs dispos, réponses
      et photo (CASCADE). Les soirées que tu y avais proposées restent
      pour les autres, sans auteur (ON DELETE SET NULL) ;
   3. le compte lui-même, et donc toutes ses sessions, sur tous tes
      appareils (sessions … ON DELETE CASCADE).

   batch() fait les trois d'un bloc : si l'un échoue, rien n'est
   effacé, on ne reste jamais à moitié supprimé.

   Pourquoi l'ordre 1 puis 2 : une fois tes profils effacés, on ne
   saurait plus quels groupes étaient les tiens. Et on ne peut pas
   simplement effacer « tous les groupes vides » : un groupe tout juste
   créé, que personne n'a encore rejoint, est vide lui aussi.

   fermerSession() renvoie le cookie qui efface celui du navigateur
   (Max-Age=0). Discord, lui, garde le souvenir d'avoir autorisé
   AllReady : ça se retire dans Discord (Paramètres → Applications
   autorisées), pas d'ici.

   Renvoie : { ok: true } */
export async function onRequestDelete({ request, env }) {
  const compte = await compteConnecte(request, env.DB);
  if (!compte) return erreur(401, "Tu n'es pas connecté.");

  await env.DB.batch([
    // 1. Un groupe où tu as un profil, et où il n'y a personne d'autre
    //    (« IS NOT ? » plutôt que « != ? » : un profil d'avant les
    //    comptes a compte_id NULL, et « NULL != 5 » ne vaut pas vrai).
    env.DB.prepare(`DELETE FROM groupes
                    WHERE id IN (SELECT groupe_id FROM membres WHERE compte_id = ?1)
                      AND NOT EXISTS (SELECT 1 FROM membres
                                      WHERE groupe_id = groupes.id AND compte_id IS NOT ?1)`)
      .bind(compte.id),
    // 2. Tes profils restants.
    env.DB.prepare('DELETE FROM membres WHERE compte_id = ?').bind(compte.id),
    // 3. Le compte.
    env.DB.prepare('DELETE FROM comptes WHERE id = ?').bind(compte.id),
  ]);

  return json(200, { ok: true }, { 'Set-Cookie': await fermerSession(request, env.DB) });
}
