/* LA CONNEXION AVEC DISCORD (code serveur, partagé)

   Se connecter avec Discord suit un protocole standard, OAuth2, en
   trois temps :

   1. le site envoie le visiteur sur une page de Discord (api/compte/
      connexion.js) : « AllReady veut connaître ton pseudo Discord.
      Autoriser ? » ;
   2. le visiteur accepte. Discord le renvoie sur le site
      (api/compte/retour.js) avec un CODE à usage unique dans l'adresse ;
   3. le serveur échange ce code contre un jeton d'accès, et demande à
      Discord qui est ce visiteur. Le site n'a jamais vu son mot de
      passe Discord : seul Discord l'a eu entre les mains.

   On ne demande que la permission « identify » : le numéro, le pseudo
   et le nom affiché. Ni l'e-mail, ni les serveurs, ni les amis.

   Les identifiants de l'application Discord sont rangés dans le tableau
   de bord Cloudflare (Settings → Variables and Secrets), jamais dans un
   fichier du site :

     DISCORD_CLIENT_ID      l'identifiant de l'application Discord
     DISCORD_CLIENT_SECRET  son secret

   Ce fichier n'exporte aucune fonction onRequest… : Cloudflare n'en
   fait pas une adresse. */

// Les deux identifiants sont-ils posés ? Sans eux, la connexion
// renvoie vers le site avec un message « pas encore configurée ».
export function discordConfigure(env) {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
}

/* L'adresse où Discord renvoie le visiteur, calculée à partir de celle
   du site (https://dispos.pages.dev/api/compte/retour). Elle doit être
   enregistrée À L'IDENTIQUE dans l'application Discord (onglet OAuth2,
   « Redirects ») : Discord refuse de renvoyer ailleurs, pour qu'un
   site pirate ne puisse pas récupérer le code à notre place. */
export function adresseRetour(request) {
  return new URL(request.url).origin + '/api/compte/retour';
}

/* Étape 1 : la page d'autorisation de Discord.
   state : un secret tiré au hasard, que Discord renvoie tel quel à
   l'étape 2. Le serveur vérifie que c'est bien le même : la preuve que
   c'est TOI qui as lancé cette connexion, et pas un site piégé qui
   t'enverrait sur le retour avec son propre code.
   prompt=none : si tu as déjà autorisé AllReady une fois, Discord ne
   repose pas la question et renvoie directement sur le site. */
export function pageAutorisation(env, request, state) {
  const parametres = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: adresseRetour(request),
    scope: 'identify',
    state,
    prompt: 'none',
  });
  return 'https://discord.com/oauth2/authorize?' + parametres;
}

// Discord demande que chaque appel dise qui l'envoie.
const AGENT = 'AllReady (https://dispos.pages.dev, 1.0)';

/* Étapes 2 et 3 : le code contre un jeton d'accès, puis le jeton
   contre l'identité. Renvoie { discord_id, nom, discord }.
   Le jeton d'accès n'est pas gardé : on n'a plus rien à demander à
   Discord ensuite. */
export async function identiteDiscord(env, request, code) {
  const reponseJeton = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': AGENT },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: adresseRetour(request),
    }),
  });
  if (!reponseJeton.ok) throw new Error(`Discord refuse le code (${reponseJeton.status}).`);
  const { access_token } = await reponseJeton.json();

  const reponseMoi = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: 'Bearer ' + access_token, 'User-Agent': AGENT },
  });
  if (!reponseMoi.ok) throw new Error(`Discord ne dit pas qui c'est (${reponseMoi.status}).`);
  const utilisateur = await reponseMoi.json();

  /* id : le numéro Discord, qui ne change jamais.
     username : le pseudo unique (« max92 »), qu'on tape pour ajouter
     quelqu'un en ami. global_name : le nom affiché (« Max »), que
     certains n'ont pas choisi : on prend alors le pseudo. */
  return {
    discord_id: String(utilisateur.id),
    nom: String(utilisateur.global_name || utilisateur.username).slice(0, 40),
    discord: String(utilisateur.username || '').slice(0, 40),
  };
}
