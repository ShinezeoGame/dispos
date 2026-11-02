/* LES RAPPELS « DANS MOINS D'UNE HEURE » — POST /api/rappels
   (2 nov. 2026)

   Deux façons de prévenir, chacune si elle est en place : un message
   dans le salon Discord du groupe, et une notification sur les
   appareils de ceux qui ont dit « Chaud » et activé les notifications
   (functions/_push.js).

   Un site Pages ne sait pas se réveiller tout seul à heure fixe : il ne
   fait que répondre. C'est donc un petit Worker Cloudflare à part, avec
   un « Cron Trigger » (un réveil), qui appelle cette adresse tous les
   quarts d'heure (son code est dans CLAUDE.md, « Mise en ligne »).

   À chaque appel : les soirées qui commencent dans l'heure, et dont le
   rappel n'est pas encore parti, sont rappelées à ceux qui ont dit
   « Chaud ». Le rappel arrive donc entre 45 et 60 minutes avant.

   Pas de secret à donner au Worker : appeler cette adresse plus souvent
   ne change rien, chaque rappel ne part qu'une fois (soirees.rappel).
   POST et pas GET : un robot qui visite les liens ne la déclenche pas.

   Quatre requêtes en tout, quel que soit le nombre de soirées (D1 en
   permet 50 par appel ; 20 soirées au plus par réveil) :
   1. les soirées à rappeler ;
   2. les marquer « rappel parti » AVANT d'envoyer : deux appels
      rapprochés ne peuvent pas envoyer deux fois le même rappel ;
   3. ceux qui ont dit « Chaud », pour toutes ces soirées d'un coup ;
   4. leurs appareils abonnés aux notifications.

   Renvoie : { rappels: 2, notifications: 3 } (messages Discord envoyés,
   notifications déposées) */

import { json } from '../_outils.js';
import { envoyerAuGroupe, heureDeParis, sansMarkdown, lienDuGroupe } from '../_annonces.js';
import { abonnementsDe, envoyerA } from '../_push.js';

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  const maintenant = heureDeParis();
  const dansUneHeure = heureDeParis(60);

  /* jour || ' ' || horaire : « 2026-11-06 21:00 », comparable à
     l'heure de Paris (voir heureDeParis). Les deux conditions sur
     « jour » seul écartent d'abord, à peu de frais, toutes les soirées
     qui ne tombent ni aujourd'hui ni demain. */
  const { results: soirees } = await db
    .prepare(`SELECT s.id, s.titre, s.horaire, g.id AS groupe_id, g.code, g.webhook
              FROM soirees s JOIN groupes g ON g.id = s.groupe_id
              WHERE s.rappel = 0
                AND s.jour >= ? AND s.jour <= ?
                AND s.jour || ' ' || s.horaire >= ?
                AND s.jour || ' ' || s.horaire <= ?
              LIMIT 20`)
    .bind(maintenant.slice(0, 10), dansUneHeure.slice(0, 10), maintenant, dansUneHeure)
    .all();
  if (!soirees.length) return json(200, { rappels: 0, notifications: 0 });

  // json_each : la liste des numéros, passée en un seul paramètre (D1
  // limite à 100 paramètres par requête).
  const numeros = JSON.stringify(soirees.map((soiree) => soiree.id));
  const [, chauds] = await db.batch([
    db.prepare('UPDATE soirees SET rappel = 1 WHERE id IN (SELECT value FROM json_each(?))').bind(numeros),
    db.prepare(`SELECT r.soiree_id, m.pseudo, c.discord_id, c.id AS compte_id
                FROM reponses r
                JOIN membres m ON m.id = r.membre_id
                LEFT JOIN comptes c ON c.id = m.compte_id
                WHERE r.reponse = 'oui' AND r.soiree_id IN (SELECT value FROM json_each(?))
                ORDER BY m.id`).bind(numeros),
  ]);

  // Les appareils abonnés de tous les « Chaud », en une seule requête.
  const appareils = await abonnementsDe(db,
    [...new Set(chauds.results.map((rangee) => rangee.compte_id).filter(Boolean))]);
  const site = new URL(request.url).origin;

  /* Pour chaque soirée : un message Discord si le groupe a branché un
     salon (ceux qui ont un compte y sont mentionnés, <@numéro
     Discord>, les profils d'avant les comptes apparaissent par leur
     pseudo), et une notification sur les appareils des « Chaud ». */
  let envoyes = 0;
  let notifications = 0;
  await Promise.all(soirees.map(async (soiree) => {
    const venus = chauds.results.filter((rangee) => rangee.soiree_id === soiree.id);
    const [h, m] = soiree.horaire.split(':');
    const heureLisible = `${Number(h)}h${m === '00' ? '' : m}`;
    const leurs = appareils.filter((appareil) => venus.some((venu) => venu.compte_id === appareil.compte_id));
    notifications += await envoyerA(db, site, leurs, {
      titre: "Dans moins d'une heure",
      corps: `${soiree.titre} commence à ${heureLisible}.`,
      url: `/groupe?g=${soiree.code}`,
      tag: `rappel-${soiree.id}`,
    });
    if (!soiree.webhook) return;
    const mentions = venus.filter((rangee) => rangee.discord_id).map((rangee) => rangee.discord_id);
    const noms = venus.map((rangee) => (rangee.discord_id ? `<@${rangee.discord_id}>` : sansMarkdown(rangee.pseudo)));
    const lignes = [`⏰ **${sansMarkdown(soiree.titre)}** commence à ${heureLisible}.`];
    if (noms.length) lignes.push(`Chaud : ${noms.join(', ')}`);
    // Entre < et > : Discord n'affiche pas d'aperçu du lien.
    lignes.push(`<${lienDuGroupe(request, soiree.code)}>`);
    const groupe = { id: soiree.groupe_id, webhook: soiree.webhook };
    const statut = await envoyerAuGroupe(db, groupe, { content: lignes.join('\n') }, mentions);
    if (statut >= 200 && statut < 300) envoyes++;
  }));

  return json(200, { rappels: envoyes, notifications });
}
