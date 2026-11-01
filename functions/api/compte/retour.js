/* LE RETOUR DE DISCORD — GET /api/compte/retour?code=…&state=…

   Discord renvoie ici le visiteur qui vient d'accepter (ou de refuser).
   Cette adresse doit être enregistrée dans l'application Discord
   (onglet OAuth2, « Redirects ») : https://dispos.pages.dev/api/compte/retour

   Dans l'ordre :
   1. vérifier que le state renvoyé par Discord est bien celui noté
      dans le cookie « oauth » au départ (voir connexion.js) ;
   2. échanger le code contre l'identité Discord (_discord.js) ;
   3. créer le compte s'il n'existe pas, ou mettre à jour son nom ;
   4. ouvrir une session et revenir sur la page de départ.

   Toute erreur ramène aussi sur la page de départ, avec
   #connexion-ratee à la fin de l'adresse : js/compte.js affiche alors
   « La connexion avec Discord a échoué ». Le visiteur n'est jamais
   laissé sur une page d'erreur brute. */

import { rediriger, cookie, lireCookie, cheminDuSite, ouvrirSession } from '../../_outils.js';
import { identiteDiscord } from '../../_discord.js';

export async function onRequestGet({ request, env }) {
  const adresse = new URL(request.url);

  // Le cookie « oauth » : « state.retour » (voir connexion.js).
  const [stateAttendu, retourCode] = lireCookie(request, 'oauth').split('.');
  let retour = '/';
  try {
    retour = cheminDuSite(decodeURIComponent(retourCode || ''), request);
  } catch {
    // Chemin illisible : on rentre à l'accueil.
  }
  // Le cookie « oauth » a servi : on demande au navigateur de l'oublier.
  const oublierOauth = cookie('oauth', '', 0, '/api/compte');

  // 1. Pas de cookie, ou un state différent : cette connexion n'a pas
  // été lancée depuis ce navigateur (ou il y a plus de 10 minutes).
  if (!stateAttendu || adresse.searchParams.get('state') !== stateAttendu) {
    return rediriger(retour + '#connexion-ratee', [oublierOauth]);
  }

  // Pas de code : le visiteur a cliqué sur « Annuler » chez Discord.
  // Ce n'est pas une erreur, on le ramène simplement d'où il vient.
  const code = adresse.searchParams.get('code');
  if (!code) return rediriger(retour, [oublierOauth]);

  try {
    // 2.
    const identite = await identiteDiscord(env, request, code);

    /* 3. INSERT … ON CONFLICT DO UPDATE : « crée le compte ; s'il
       existe déjà (même numéro Discord), mets juste à jour son nom et
       son pseudo », au cas où il les aurait changés sur Discord depuis.
       excluded.nom = le nom qu'on essayait d'insérer. RETURNING id
       renvoie le numéro du compte, nouveau ou ancien. */
    const { id } = await env.DB
      .prepare(`INSERT INTO comptes (discord_id, nom, discord) VALUES (?, ?, ?)
                ON CONFLICT (discord_id) DO UPDATE SET nom = excluded.nom, discord = excluded.discord
                RETURNING id`)
      .bind(identite.discord_id, identite.nom, identite.discord)
      .first();

    // 4.
    return rediriger(retour, [oublierOauth, await ouvrirSession(env.DB, id)]);
  } catch (probleme) {
    console.error(probleme); // visible dans les journaux Cloudflare
    return rediriger(retour + '#connexion-ratee', [oublierOauth]);
  }
}
