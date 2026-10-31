/* CHERCHER UN JEU — GET /api/groupes/ABCD2345/jeux?q=among

   Renvoie : { jeux: [{ id: 17269, nom: "Among Us", cover: "co1r7f", annee: 2018 }, …] }

   La recherche passe par IGDB, la base de jeux vidéo de Twitch : c'est
   la référence, avec les couvertures officielles. Le navigateur ne lui
   parle jamais directement : c'est ce fichier qui pose la question,
   avec les identifiants Twitch rangés dans le tableau de bord
   Cloudflare (Settings → Variables and Secrets) :

     TWITCH_CLIENT_ID      l'identifiant de l'application Twitch
     TWITCH_CLIENT_SECRET  son secret

   Comme la clé d'API du portfolio, le secret ne doit JAMAIS apparaître
   dans un fichier du site : functions/ n'est jamais envoyé au
   navigateur, c'est toute la différence.

   La route est rangée sous /groupes/[code]/ : seuls ceux qui ont un
   lien de groupe peuvent chercher. Un inconnu ne peut pas vider le
   quota de requêtes accordé par Twitch. */

import { json, erreur, identifier } from '../../../_outils.js';


/* LE JETON TWITCH

   Pour interroger IGDB, il faut un jeton d'accès, que Twitch délivre
   en échange de l'identifiant et du secret. Il vaut environ deux mois :
   on le garde en mémoire tant que le serveur reste allumé, au lieu
   d'en redemander un à chaque recherche. */
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

/* Une question à IGDB. Si IGDB répond 401 (« jeton refusé »), le jeton
   a été révoqué entre-temps : on l'oublie et on réessaie une fois avec
   un neuf. */
async function interrogerIGDB(env, requete) {
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


export async function onRequestGet(context) {
  const { refus } = await identifier(context, false);
  if (refus) return refus;

  const { env } = context;
  // 503 = « service indisponible ». La page propose alors d'ajouter le
  // jeu tel quel : le site reste utilisable sans IGDB.
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return erreur(503, "La recherche de jeux n'est pas encore configurée. Ajoute le jeu tel quel.");
  }

  /* Ce qu'on cherche. Les guillemets et les barres obliques casseraient
     la requête IGDB (le texte est placé entre guillemets) : on les
     retire, ainsi que tout ce qui dépasse 60 caractères. */
  const recherche = (new URL(context.request.url).searchParams.get('q') || '')
    .replace(/["\\]/g, '')
    .trim()
    .slice(0, 60);
  if (recherche.length < 2) return json(200, { jeux: [] });

  /* La requête, dans le petit langage d'IGDB (« Apicalypse ») :
     — search : la recherche par nom ;
     — fields : les seules informations voulues (cover.image_id = le
       code de l'image de couverture) ;
     — where version_parent = null : écarte les éditions spéciales
       (« Game of the Year Edition »…) qui doubleraient chaque jeu ;
     — limit 20 : on en demande 20 pour en garder 8 après tri. */
  const requete = `search "${recherche}"; fields name, cover.image_id, first_release_date, total_rating_count; where version_parent = null; limit 20;`;

  let resultats;
  try {
    const reponse = await interrogerIGDB(env, requete);
    if (!reponse.ok) throw new Error(`IGDB a répondu ${reponse.status}.`);
    resultats = await reponse.json();
  } catch (probleme) {
    console.error(probleme); // visible dans les journaux Cloudflare
    return erreur(502, 'La recherche de jeux ne répond pas. Réessaie, ou ajoute le jeu tel quel.');
  }

  /* Le tri : d'abord le jeu dont le nom est exactement celui tapé, puis
     les plus connus (total_rating_count = nombre de notes reçues). Sans
     ça, « fortnite » remonterait des saisons obscures avant le jeu. */
  const cherche = recherche.toLowerCase();
  const exact = (jeu) => (jeu.name.toLowerCase() === cherche ? 1 : 0);
  const jeux = resultats
    .sort((a, b) => exact(b) - exact(a) || (b.total_rating_count || 0) - (a.total_rating_count || 0))
    .slice(0, 8)
    .map((jeu) => ({
      id: jeu.id,
      nom: jeu.name.slice(0, 60),
      cover: jeu.cover ? jeu.cover.image_id : '',
      // first_release_date est en secondes depuis 1970.
      annee: jeu.first_release_date ? new Date(jeu.first_release_date * 1000).getUTCFullYear() : null,
    }));

  // Une même recherche donne le même résultat pendant des jours : le
  // navigateur peut la garder 24 h (86 400 s) sans redemander.
  return json(200, { jeux }, { 'Cache-Control': 'private, max-age=86400' });
}
