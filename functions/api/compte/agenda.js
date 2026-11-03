/* SYNCHRONISER SON AGENDA — /api/compte/agenda (AllReady+, 2 nov. 2026)

   PUT    { adresse: "https://calendar.google.com/…/basic.ics" } : range
          l'adresse secrète iCal de ton agenda, après avoir vérifié
          qu'elle sert bien un agenda (functions/_agenda.js) ;
   DELETE : l'oublie.

   L'adresse appartient au compte (pas à un groupe) : elle sert dans
   tous tes groupes AllReady+. Elle n'est jamais renvoyée, ni à toi ni
   aux autres : seuls les créneaux occupés sortent (groupes/[code]/
   occupe.js). */

import { json, erreur, lireCorps, compteConnecte } from '../../_outils.js';
import { adresseAgendaValable, lireAgenda } from '../../_agenda.js';

export async function onRequestPut({ request, env }) {
  const compte = await compteConnecte(request, env.DB);
  if (!compte) return erreur(401, "Tu n'es pas connecté.");
  const adresse = adresseAgendaValable((await lireCorps(request)).adresse);
  if (!adresse) return erreur(400, "Colle l'adresse secrète iCal de Google Agenda, d'Apple ou d'Outlook.");
  try {
    await lireAgenda(adresse);
  } catch {
    return erreur(400, "Cette adresse ne donne pas d'agenda. Recopie l'adresse secrète au format iCal.");
  }
  await env.DB.prepare('UPDATE comptes SET agenda_ics = ? WHERE id = ?').bind(adresse, compte.id).run();
  return json(200, { ok: true });
}

export async function onRequestDelete({ request, env }) {
  const compte = await compteConnecte(request, env.DB);
  if (!compte) return erreur(401, "Tu n'es pas connecté.");
  await env.DB.prepare("UPDATE comptes SET agenda_ics = '' WHERE id = ?").bind(compte.id).run();
  return json(200, { ok: true });
}
