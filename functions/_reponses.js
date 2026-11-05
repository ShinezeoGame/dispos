/* RÉPONDRE À UNE SOIRÉE (code serveur, partagé) — 2 nov. 2026

   Chaud, Peut-être ou Pas dispo, avec un rôle s'il y en a. Sorti de la
   route soirees/[id].js pour servir aussi au bot Discord (les boutons
   de /soirees, functions/api/discord/interactions.js) : les mêmes
   règles, où qu'on réponde.

   context : celui de la requête (pour envoyer les notifications après
   la réponse, et connaître l'adresse du site). soiree : la ligne de la
   base (id, titre, places, roles…). Renvoie { attente } (true : en
   liste d'attente), ou { refus } : une réponse d'erreur toute prête.

   Ce fichier n'exporte aucune fonction onRequest… : Cloudflare n'en
   fait pas une adresse. */

import { erreur, repartir, rolesStockes } from './_outils.js';
import { notifierComptes } from './_push.js';
import { prevenirChaud } from './_evenements.js';

export async function repondreSoiree(context, groupe, soiree, membreId, reponse, roleDemande) {
  const db = context.env.DB;
  // Avec des rôles (AllReady+), un « Chaud » dit lequel.
  const roles = rolesStockes(soiree.roles);
  const role = reponse === 'oui' && roles.length ? String(roleDemande || '') : '';
  if (reponse === 'oui' && roles.length && !roles.some((r) => r.nom === role)) {
    return { refus: erreur(400, 'Choisis ton rôle.') };
  }

  /* Les places, dans un groupe gratuit : une soirée complète refuse un
     « oui » de plus. Les autres « oui » sont comptés sans le tien :
     redire « oui » quand on y est déjà reste possible. En AllReady+,
     pas de refus : liste d'attente (repartir, _outils.js). */
  if (reponse === 'oui' && soiree.places && !groupe.premium) {
    const { nombre } = await db
      .prepare("SELECT COUNT(*) AS nombre FROM reponses WHERE soiree_id = ? AND reponse = 'oui' AND membre_id != ?")
      .bind(soiree.id, membreId)
      .first();
    if (nombre >= soiree.places) return { refus: erreur(409, "C'est complet.") };
  }

  /* Qui attendait AVANT ce changement : pour savoir, après, à qui une
     place vient de se libérer (et le prévenir). */
  const limitee = groupe.premium && (roles.length || soiree.places);
  const lireOui = async () => (await db
    .prepare("SELECT membre_id, role, inscrit_le FROM reponses WHERE soiree_id = ? AND reponse = 'oui'")
    .bind(soiree.id).all()).results;
  const avant = limitee ? repartir({ roles, places: soiree.places }, await lireOui(), true) : new Set();

  /* Était-il déjà « Chaud » ? Pour ne prévenir la personne qui a
     proposé la soirée que d'un nouveau « Chaud » (prevenirChaud,
     _evenements.js), pas d'un « Chaud » redit. */
  const dejaChaud = reponse === 'oui' && await db
    .prepare("SELECT 1 FROM reponses WHERE soiree_id = ? AND membre_id = ? AND reponse = 'oui'")
    .bind(soiree.id, membreId).first();

  /* Même principe que pour les dispos : crée la réponse ou la remplace.
     inscrit_le : l'heure d'arrivée, qui décide de la place dans la file.
     Redire la même chose (même réponse, même rôle) garde l'ancienne
     heure : on ne perd pas sa place pour un double clic. Dans un UPDATE,
     « reponses.… » désigne la ligne telle qu'elle était. */
  await db
    .prepare(`INSERT INTO reponses (soiree_id, membre_id, reponse, role, inscrit_le) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT (soiree_id, membre_id) DO UPDATE SET
                inscrit_le = CASE WHEN reponses.reponse = excluded.reponse AND reponses.role = excluded.role
                                  THEN reponses.inscrit_le ELSE excluded.inscrit_le END,
                reponse = excluded.reponse, role = excluded.role`)
    .bind(soiree.id, membreId, reponse, role, new Date().toISOString())
    .run();

  if (reponse === 'oui' && !dejaChaud) prevenirChaud(context, groupe, soiree, membreId);

  if (!limitee) return { attente: false };
  const apres = repartir({ roles, places: soiree.places }, await lireOui(), true);
  /* Ceux qui attendaient et qui jouent maintenant : une notification. */
  const promus = [...avant].filter((id) => !apres.has(id) && id !== membreId);
  if (promus.length) {
    const { results } = await db
      .prepare('SELECT compte_id FROM membres WHERE id IN (SELECT value FROM json_each(?)) AND compte_id IS NOT NULL')
      .bind(JSON.stringify(promus)).all();
    context.waitUntil(notifierComptes(db, new URL(context.request.url).origin, results.map((r) => r.compte_id), {
      titre: 'Une place s\'est libérée',
      corps: `Tu joues : ${soiree.titre}.`,
      url: `/groupe?g=${groupe.code}`,
      tag: `place-${soiree.id}`,
    }, 'rappels').catch(() => {}));
  }
  return { attente: apres.has(membreId) };
}
