/* LA CONNEXION À IGDB (code serveur, partagé)

   IGDB est la base de jeux vidéo de Twitch. Deux routes l'interrogent :
   la recherche (api/groupes/[code]/jeux.js) et la fiche d'un jeu
   (api/groupes/[code]/jeu/[id].js). Ce qu'elles ont en commun vit ici :
   le jeton d'accès Twitch et l'envoi d'une question à IGDB.

   Les identifiants sont rangés dans le tableau de bord Cloudflare
   (Settings → Variables and Secrets), jamais dans un fichier du site :

     TWITCH_CLIENT_ID      l'identifiant de l'application Twitch
     TWITCH_CLIENT_SECRET  son secret

   Ce fichier n'exporte aucune fonction onRequest… : Cloudflare n'en
   fait pas une adresse. */

// Les deux identifiants sont-ils posés ? Sans eux, les routes répondent
// 503 et le site propose d'ajouter les jeux tels quels.
export function igdbConfigure(env) {
  return Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET);
}


/* LE JETON TWITCH

   Pour interroger IGDB, il faut un jeton d'accès, que Twitch délivre
   en échange de l'identifiant et du secret. Il vaut environ deux mois :
   on le garde en mémoire tant que le serveur reste allumé, au lieu
   d'en redemander un à chaque question. */
let jetonTwitch = null; // { valeur, expire } — expire en millisecondes

async function obtenirJeton(env) {
  if (jetonTwitch && jetonTwitch.expire > Date.now()) return jetonTwitch.valeur;

  const parametres = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const reponse = await fetch('https://id.twitch.tv/oauth2/token?' + parametres, { method: 'POST' });
  if (!reponse.ok) throw new Error(`Twitch refuse les identifiants (${reponse.status}).`);

  const { access_token, expires_in } = await reponse.json();
  // expires_in est en secondes ; une minute de marge pour ne jamais
  // envoyer un jeton qui expire en chemin.
  jetonTwitch = { valeur: access_token, expire: Date.now() + (expires_in - 60) * 1000 };
  return access_token;
}


/* UNE QUESTION À IGDB

   requete est écrite dans le petit langage d'IGDB (« Apicalypse »),
   par exemple : fields name, summary; where id = 17269;
   Si IGDB répond 401 (« jeton refusé »), le jeton a été révoqué
   entre-temps : on l'oublie et on réessaie une fois avec un neuf.
   Renvoie la réponse brute : à la route de vérifier reponse.ok. */
export async function interrogerIGDB(env, requete) {
  const envoyer = async () => fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      Authorization: 'Bearer ' + await obtenirJeton(env),
      Accept: 'application/json',
    },
    body: requete,
  });
  let reponse = await envoyer();
  if (reponse.status === 401) {
    jetonTwitch = null;
    reponse = await envoyer();
  }
  return reponse;
}
