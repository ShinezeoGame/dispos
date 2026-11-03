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


/* LE BOT DISCORD (AllReady+, 2 nov. 2026)

   Le bot n'est pas un programme allumé en permanence : c'est la même
   application Discord que la connexion, à qui l'on donne des
   « commandes » (/lier, /dispo, /soirees). Quand quelqu'un en tape une,
   ou clique sur un bouton du bot, Discord envoie la demande à notre
   adresse functions/api/discord/interactions.js, qui répond aussitôt.

   Il lui faut, en plus des identifiants de la connexion, la clé
   PUBLIQUE de l'application (DISCORD_PUBLIC_KEY, dans les variables
   Cloudflare) : Discord signe chaque demande avec sa clé privée, et on
   vérifie la signature avec la publique. Une demande mal signée est
   refusée : sans ça, n'importe qui pourrait se faire passer pour
   Discord et répondre aux soirées à la place des autres. */

// Le bot est-il prêt sur ce site ? (identifiants + clé publique)
export function botConfigure(env) {
  return discordConfigure(env) && Boolean(env.DISCORD_PUBLIC_KEY);
}

// « a1b2… » (des octets écrits en hexadécimal) → les octets.
function depuisHex(texte) {
  return Uint8Array.from(String(texte).match(/../g) || [], (paire) => parseInt(paire, 16));
}

/* La signature : Discord signe l'heure d'envoi suivie du texte reçu
   (en-têtes X-Signature-Timestamp et X-Signature-Ed25519). Ed25519 est
   une méthode de signature que crypto.subtle connaît. Renvoie vrai ou
   faux, sans jamais lever d'erreur. */
export async function signatureValable(env, request, corps) {
  const signature = request.headers.get('X-Signature-Ed25519');
  const horodatage = request.headers.get('X-Signature-Timestamp');
  if (!signature || !horodatage || !env.DISCORD_PUBLIC_KEY) return false;
  try {
    const cle = await crypto.subtle.importKey('raw', depuisHex(env.DISCORD_PUBLIC_KEY), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', cle, depuisHex(signature), new TextEncoder().encode(horodatage + corps));
  } catch {
    return false;
  }
}

/* Les trois commandes, telles que Discord les affiche quand on tape
   « / ». contexts: [0] : sur un serveur seulement (pas en message
   privé). /lier est réservée à ceux qui peuvent gérer le serveur
   (default_member_permissions 32 = « Gérer le serveur »). Types
   d'options : 3 = texte, 8 = rôle. */
const COMMANDES = [
  {
    name: 'lier',
    description: 'Relier ce serveur à ton groupe AllReady',
    contexts: [0],
    default_member_permissions: '32',
    options: [
      { type: 3, name: 'code', description: 'Le code du groupe (dans son lien : …/groupe?g=CODE)', required: true },
      { type: 8, name: 'role', description: 'Un rôle à mentionner à chaque nouvelle soirée', required: false },
    ],
  },
  { name: 'dispo', description: 'Je suis chaud ce soir (de 19 h, ou maintenant, jusqu’à 3 h)', contexts: [0] },
  { name: 'soirees', description: 'Les prochaines soirées, avec des boutons pour répondre', contexts: [0] },
];

/* Enregistrer les commandes chez Discord. Il faut un jeton de
   l'application elle-même (« client credentials » : ses identifiants,
   sans personne de connecté), avec la permission de mettre à jour ses
   commandes. PUT remplace toute la liste : le refaire ne crée pas de
   doublons. Lancé quand un organisateur clique « Ajouter le bot ». */
export async function enregistrerCommandes(env) {
  const reponseJeton = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': AGENT },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'applications.commands.update',
    }),
  });
  if (!reponseJeton.ok) throw new Error(`Discord refuse les identifiants (${reponseJeton.status}).`);
  const { access_token } = await reponseJeton.json();
  const reponse = await fetch(`https://discord.com/api/v10/applications/${env.DISCORD_CLIENT_ID}/commands`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json', 'User-Agent': AGENT },
    body: JSON.stringify(COMMANDES),
  });
  if (!reponse.ok) throw new Error(`Discord refuse les commandes (${reponse.status}).`);
}

/* Le lien pour ajouter le bot à un serveur : la page de Discord où l'on
   choisit le serveur. scope=applications.commands : seulement les
   commandes, aucune autre permission (le bot ne lit pas les messages). */
export function invitationBot(env) {
  return `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&scope=applications.commands`;
}
