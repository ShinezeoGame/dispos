/* CHERCHER UN JEU — GET /api/groupes/ABCD2345/jeux?q=among

   Renvoie : { jeux: [{ id: 17269, nom: "Among Us", cover: "co1r7f", annee: 2018 }, …] }

   Les jeux arrivent triés par popularité, sans doublon de nom, et sans
   DLC, packs ni saisons.

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
     — game_type != (…) : écarte ce qui n'est pas un jeu à proprement
       parler. Les numéros sont ceux d'IGDB : 1 DLC, 2 extension,
       3 compilation, 5 mod, 6 épisode, 7 saison, 13 pack, 14 mise à
       jour. Sans ça, « fortnite » remonte « Fortnite: Season 4 » ;
     — limit 30 : on en demande 30 pour en garder 8 après tri. */
  const debut = `search "${recherche}"; fields name, cover.image_id, first_release_date, total_rating_count;`;
  const filtre = 'where version_parent = null & game_type != (1,2,3,5,6,7,13,14);';
  const filtreSimple = 'where version_parent = null;';

  let resultats;
  try {
    let reponse = await interrogerIGDB(env, `${debut} ${filtre} limit 30;`);
    /* 400 = « requête mal formée ». Si un jour IGDB renomme ou retire
       game_type, la recherche ne tombe pas en panne : on repose la
       question sans ce filtre (au prix de quelques packs en plus). */
    if (reponse.status === 400) reponse = await interrogerIGDB(env, `${debut} ${filtreSimple} limit 30;`);
    if (!reponse.ok) throw new Error(`IGDB a répondu ${reponse.status}.`);
    resultats = await reponse.json();
  } catch (probleme) {
    console.error(probleme); // visible dans les journaux Cloudflare
    return erreur(502, 'La recherche de jeux ne répond pas. Réessaie, ou ajoute le jeu tel quel.');
  }

  /* Le tri, par popularité : total_rating_count est le nombre de notes
     reçues sur IGDB, un bon reflet du nombre de joueurs. Le jeu dont
     le nom est exactement celui tapé compte triple : « valorant »
     donne Valorant avant Arena of Valor, mais « zelda » ne met pas un
     obscur « Zelda » de 1989 devant Breath of the Wild. */
  const cherche = recherche.toLowerCase();
  const score = (jeu) => (jeu.total_rating_count || 0) * (jeu.name.toLowerCase() === cherche ? 3 : 1);
  resultats.sort((a, b) => score(b) - score(a));

  /* Plusieurs fiches IGDB portent parfois exactement le même nom (trois
     « Among Us » : le vrai, un jeu de 2010, une version de 2021). Comme
     la liste est triée, la première rencontrée est la plus connue : on
     garde celle-là et on saute les suivantes. */
  const dejaVus = new Set();
  const uniques = resultats.filter((jeu) => {
    const nom = jeu.name.toLowerCase();
    if (dejaVus.has(nom)) return false;
    dejaVus.add(nom);
    return true;
  });

  const jeux = uniques
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
