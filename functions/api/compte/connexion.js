/* SE CONNECTER — GET /api/compte/connexion?retour=/groupe?g=ABCD2345

   Le bouton « Se connecter avec Discord » est un simple lien vers
   cette adresse. Elle ne renvoie pas de page : elle redirige aussitôt
   vers Discord (étape 1 dans functions/_discord.js).

   Un lien et pas un formulaire : la règle de sécurité du site
   (form-action 'self' dans _headers) interdit à un formulaire de
   mener vers un autre site, même par redirection. Un lien, si.

   « retour » : la page où revenir une fois connecté, celle d'où l'on
   vient. Elle est notée dans un petit cookie, avec le secret « state »,
   le temps de l'aller-retour chez Discord. */

import { rediriger, cookie, cheminDuSite, genererJeton } from '../../_outils.js';
import { discordConfigure, pageAutorisation } from '../../_discord.js';

export function onRequestGet({ request, env }) {
  const retour = cheminDuSite(new URL(request.url).searchParams.get('retour'), request);

  // Les identifiants Discord pas encore posés : retour à la page de
  // départ, qui affiche « pas encore configurée » (js/compte.js).
  if (!discordConfigure(env)) return rediriger(retour + '#connexion-indisponible');

  /* Le secret state : 32 caractères au hasard. Le cookie « oauth »
     garde « state.retour » pendant 10 minutes (600 s), seulement pour
     les adresses /api/compte : le reste du site ne le reçoit jamais.
     encodeURIComponent : le chemin de retour contient « ? » et « = »,
     qu'un cookie supporte mal. */
  const state = genererJeton().slice(0, 32);
  return rediriger(pageAutorisation(env, request, state), [
    cookie('oauth', `${state}.${encodeURIComponent(retour)}`, 600, '/api/compte'),
  ]);
}
