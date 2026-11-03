/* LE BOT DISCORD D'UN GROUPE (AllReady+, 2 nov. 2026)

   POST   /api/groupes/ABCD2345/bot  → { invitation } : enregistre les
          commandes du bot chez Discord (sans danger à refaire) et donne
          le lien pour l'ajouter à un serveur. Ensuite, dans un salon de
          ce serveur : /lier code:ABCD2345 (voir discord/interactions.js) ;
   DELETE /api/groupes/ABCD2345/bot  → délie le serveur Discord.

   Pour les organisateurs (peutGerer) d'un groupe AllReady+. Le bot doit
   être configuré sur le site (botConfigure : identifiants Discord et
   clé publique, voir CLAUDE.md « Mise en ligne »). */

import { json, erreur, identifier, peutGerer } from '../../../_outils.js';
import { botConfigure, enregistrerCommandes, invitationBot } from '../../../_discord.js';

async function verifier(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return { refus };
  if (!groupe.premium) return { refus: erreur(403, "Le bot Discord fait partie d'AllReady+.") };
  if (!await peutGerer(context.env.DB, groupe, moi)) {
    return { refus: erreur(403, 'Seuls les organisateurs du groupe peuvent ajouter le bot.') };
  }
  return { groupe };
}

export async function onRequestPost(context) {
  const { refus } = await verifier(context);
  if (refus) return refus;
  if (!botConfigure(context.env)) return erreur(503, "Le bot n'est pas encore configuré sur ce site.");
  try {
    await enregistrerCommandes(context.env);
  } catch (probleme) {
    console.error(probleme);
    return erreur(502, 'Discord ne répond pas. Réessaie dans un instant.');
  }
  return json(200, { invitation: invitationBot(context.env) });
}

export async function onRequestDelete(context) {
  const { groupe, refus } = await verifier(context);
  if (refus) return refus;
  await context.env.DB.prepare("UPDATE groupes SET guild_id = '', discord_role = '' WHERE id = ?").bind(groupe.id).run();
  return json(200, { ok: true });
}
