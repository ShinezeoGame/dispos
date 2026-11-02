/* LES NOTIFICATIONS D'UN APPAREIL — /api/push (2 nov. 2026)

   GET    → { cle } : la clé publique du site (VAPID), dont le navigateur
            a besoin pour ouvrir sa « boîte aux lettres » ;
   POST   { endpoint, keys: { p256dh, auth } } → range la boîte aux
            lettres de cet appareil, rattachée à ton compte ;
   DELETE { endpoint } → l'oublie (notifications coupées).

   Il faut être connecté (sauf pour GET) : c'est le compte qui est
   prévenu, sur tous ses appareils abonnés. Le fonctionnement complet
   est expliqué en tête de functions/_push.js. */

import { json, erreur, lireCorps, compteConnecte } from '../_outils.js';
import { clesVapid, adressePushValable } from '../_push.js';

export async function onRequestGet({ env }) {
  return json(200, { cle: (await clesVapid(env.DB)).publique });
}

/* Les deux clés du navigateur, en base64url : p256dh fait 65 octets
   (87 lettres), auth 16 octets (22 lettres). Rien d'autre n'est
   accepté : ce sont elles qui serviront à chiffrer. */
const P256DH = /^[A-Za-z0-9_-]{87}$/;
const AUTH = /^[A-Za-z0-9_-]{22}$/;

export async function onRequestPost({ request, env }) {
  const compte = await compteConnecte(request, env.DB);
  if (!compte) return erreur(401, 'Connecte-toi avec Discord pour activer les notifications.');
  const { endpoint, keys } = await lireCorps(request);
  if (!adressePushValable(endpoint) || !P256DH.test(keys?.p256dh) || !AUTH.test(keys?.auth)) {
    return erreur(400, 'Ce navigateur a donné un abonnement inconnu.');
  }
  // Le même appareil qui se réabonne (ou change de compte) : on met à jour.
  await env.DB
    .prepare(`INSERT INTO abonnements (compte_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
              ON CONFLICT (endpoint) DO UPDATE SET compte_id = excluded.compte_id,
                p256dh = excluded.p256dh, auth = excluded.auth`)
    .bind(compte.id, endpoint, keys.p256dh, keys.auth)
    .run();
  return json(200, { ok: true });
}

export async function onRequestDelete({ request, env }) {
  const compte = await compteConnecte(request, env.DB);
  if (!compte) return erreur(401, "Tu n'es pas connecté.");
  const { endpoint } = await lireCorps(request);
  await env.DB.prepare('DELETE FROM abonnements WHERE endpoint = ? AND compte_id = ?').bind(String(endpoint), compte.id).run();
  return json(200, { ok: true });
}
