/* TES CRÉNEAUX OCCUPÉS — GET /api/groupes/ABCD2345/occupe?semaine=2026-11-02
   (AllReady+, 2 nov. 2026)

   Pour la semaine demandée : les cases de l'agenda que ton agenda
   personnel (synchronisé, voir compte/agenda.js) marque occupées, à
   l'heure du groupe. Renvoie { occupe: [[jour, heure], …] }. Seulement
   pour toi, dans un groupe AllReady+ ; rien n'est rangé, l'agenda est
   relu à chaque fois (il change souvent). Le navigateur garde la
   réponse cinq minutes. */

import { json, erreur, identifier, estLundi } from '../../../_outils.js';
import { lireAgenda, casesOccupees } from '../../../_agenda.js';

export async function onRequestGet(context) {
  const { groupe, compte, refus } = await identifier(context);
  if (refus) return refus;
  if (!groupe.premium) return erreur(403, "La synchronisation d'agenda fait partie d'AllReady+.");
  const semaine = new URL(context.request.url).searchParams.get('semaine');
  if (!estLundi(semaine)) return erreur(400, 'Semaine invalide.');
  if (!compte?.agenda_ics) return json(200, { occupe: [] });
  let ics;
  try {
    ics = await lireAgenda(compte.agenda_ics);
  } catch (probleme) {
    console.error(probleme);
    return erreur(502, 'Ton agenda ne répond pas pour le moment.');
  }
  return json(200, { occupe: casesOccupees(ics, semaine, groupe.fuseau) }, { 'Cache-Control': 'private, max-age=300' });
}
