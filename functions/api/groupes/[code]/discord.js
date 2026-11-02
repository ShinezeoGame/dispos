/* LE SALON DISCORD DU GROUPE (2 nov. 2026)

   PUT    /api/groupes/ABCD2345/discord   { webhook: "https://discord.com/api/webhooks/…" }
          brancher : les soirées seront annoncées dans ce salon ;
   DELETE /api/groupes/ABCD2345/discord
          débrancher.

   Réservé au premier membre (adminDuGroupe), comme renommer : c'est
   lui qui décide où parle le groupe. Le fonctionnement des annonces
   est expliqué en tête de functions/_annonces.js. */

import { json, erreur, lireCorps, identifier, peutGerer } from '../../../_outils.js';
import { adresseWebhook, envoyer, sansMarkdown } from '../../../_annonces.js';

// Les deux routes commencent pareil : qui appelle, et a-t-il le droit ?
async function verifierAdmin(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return { refus };
  if (!await peutGerer(context.env.DB, groupe, moi)) {
    return { refus: erreur(403, 'Seuls les organisateurs du groupe peuvent brancher Discord.') };
  }
  return { groupe };
}

/* Brancher. Avant d'enregistrer, on écrit un premier message dans le
   salon : il prouve que l'adresse marche (Discord répond 204), et il
   prévient les membres de ce qui va suivre. Une adresse refusée n'est
   pas enregistrée. */
export async function onRequestPut(context) {
  const { groupe, refus } = await verifierAdmin(context);
  if (refus) return refus;

  const adresse = adresseWebhook((await lireCorps(context.request)).webhook);
  if (!adresse) return erreur(400, "Ce n'est pas une adresse de webhook Discord.");

  const statut = await envoyer(adresse, {
    content: `✅ Ce salon reçoit maintenant les soirées de **${sansMarkdown(groupe.nom)}** `
      + 'sur AllReady, avec un rappel une heure avant.',
  });
  if (statut < 200 || statut >= 300) {
    return erreur(400, "Discord refuse cette adresse. Recopie-la depuis le webhook du salon.");
  }

  await context.env.DB.prepare('UPDATE groupes SET webhook = ? WHERE id = ?').bind(adresse, groupe.id).run();
  return json(200, { ok: true });
}

// Débrancher : on oublie l'adresse. Le webhook reste dans Discord, où
// on peut le supprimer (paramètres du salon → Intégrations).
export async function onRequestDelete(context) {
  const { groupe, refus } = await verifierAdmin(context);
  if (refus) return refus;
  await context.env.DB.prepare("UPDATE groupes SET webhook = '' WHERE id = ?").bind(groupe.id).run();
  return json(200, { ok: true });
}
