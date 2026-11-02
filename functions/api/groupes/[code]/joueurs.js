/* À COMBIEN SE JOUENT CES JEUX ? — GET /api/groupes/ABCD2345/joueurs?ids=17269,1905
   (2 nov. 2026)

   Pour « À quoi jouer ce soir » (js/ce-soir.js) : le nombre de joueurs
   maximum de chaque jeu, d'après IGDB, en UNE question pour tous les
   jeux. Renvoie : { joueurs: { 17269: 15, 1905: 100, 4321: null } }
   (null = IGDB ne le dit pas).

   IGDB range ces nombres dans « multiplayer_modes » : en ligne
   (onlinemax), sur le même écran (offlinemax), en coopération
   (onlinecoopmax, offlinecoopmax). On garde le plus grand. Un jeu sans
   ces chiffres mais dont le seul mode est « Single player » se joue
   à 1.

   Comme la fiche d'un jeu (jeu/[id].js) : jamais appelé depuis le
   navigateur directement, réservé à qui a le lien du groupe. En cas de
   panne ou sans identifiants Twitch, on renvoie une liste vide : la
   page affiche les jeux sans le nombre de joueurs, rien de plus. */

import { json, identifier } from '../../../_outils.js';
import { igdbConfigure, interrogerIGDB } from '../../../_igdb.js';

export async function onRequestGet(context) {
  const { refus } = await identifier(context, false);
  if (refus) return refus;

  /* Les numéros finissent dans la requête IGDB : seulement des nombres
     entiers positifs, sans doublon (new Set), 30 au plus. */
  const brut = new URL(context.request.url).searchParams.get('ids') || '';
  const ids = [...new Set(brut.split(',').map(Number))]
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 30);
  if (!ids.length || !igdbConfigure(context.env)) return json(200, { joueurs: {} });

  let jeux;
  try {
    const reponse = await interrogerIGDB(context.env,
      `fields multiplayer_modes.onlinemax, multiplayer_modes.offlinemax, multiplayer_modes.onlinecoopmax,
       multiplayer_modes.offlinecoopmax, game_modes.name; where id = (${ids.join(',')}); limit ${ids.length};`);
    if (!reponse.ok) throw new Error(`IGDB a répondu ${reponse.status}.`);
    jeux = await reponse.json();
  } catch (probleme) {
    console.error(probleme);
    return json(200, { joueurs: {} });
  }

  const joueurs = {};
  for (const jeu of jeux) {
    const nombres = (jeu.multiplayer_modes || [])
      .flatMap((mode) => [mode.onlinemax, mode.offlinemax, mode.onlinecoopmax, mode.offlinecoopmax])
      .filter((nombre) => Number.isInteger(nombre) && nombre > 0);
    let maximum = nombres.length ? Math.max(...nombres) : null;
    const modes = (jeu.game_modes || []).map((mode) => mode.name);
    if (!maximum && modes.length && modes.every((mode) => mode === 'Single player')) maximum = 1;
    joueurs[jeu.id] = maximum;
  }
  // Ces nombres ne bougent pas : le navigateur les garde une semaine.
  return json(200, { joueurs }, { 'Cache-Control': 'private, max-age=604800' });
}
