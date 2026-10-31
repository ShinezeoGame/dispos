/* OUTILS PARTAGÉS PAR LE CODE SERVEUR

   Comme tout ce qui est rangé dans functions/, ce fichier s'exécute sur
   les serveurs de Cloudflare, jamais dans le navigateur.

   Il ne répond à aucune adresse : Cloudflare ne crée une route qu'à
   partir des fonctions nommées onRequest…, et il n'en contient aucune.
   Les autres fichiers viennent simplement y piocher ce qu'ils ont en
   commun : la structure de la base, le nettoyage des données reçues,
   l'identification des membres. */


/* LES RÉGLAGES

   À garder identiques à ceux de js/commun.js. Le navigateur a sa
   propre copie : il en a besoin pour dessiner l'agenda, et il ne peut
   pas lire ce fichier. Celle-ci sert à refuser tout ce qui sortirait
   des clous, parce qu'on ne fait jamais confiance à ce qui arrive du
   navigateur : n'importe qui peut envoyer une requête à la main. */

// Les heures de l'agenda vont de 9 h à 3 h du matin. Une heure au-delà
// de 23 appartient à la soirée de la veille : pour le vendredi, 25
// veut dire « 1 h du matin, dans la nuit de vendredi à samedi ». C'est
// comme ça qu'on parle d'une soirée de jeu, et ça évite de couper une
// partie de minuit en deux jours.
export const HEURE_DEBUT = 9;
export const HEURE_FIN = 27; // exclue : la dernière case est 26, soit 2 h – 3 h

// Les couleurs qu'un membre peut choisir pour son avatar.
export const COULEURS = [
  '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c',
  '#4dd4e8', '#748ffc', '#b197fc', '#f783ac',
];

// Les trois réponses possibles à une soirée proposée.
export const REPONSES = ['oui', 'peutetre', 'non'];

export const MAX_MEMBRES = 50;
export const MAX_JEUX = 12; // par profil

// La personnalisation des profils (voir lirePerso plus bas). À garder
// identique aux listes de js/commun.js, qui les affiche.
export const EMOJIS = ['🎮', '🕹️', '👾', '🤖', '👻', '💀', '🐉', '🦊', '🐸', '🐼', '🦄', '🔥', '⚡', '🌙', '🍕', '🎧'];
export const PLATEFORMES = ['pc', 'playstation', 'xbox', 'switch', 'mobile'];
export const STYLES = ['chill', 'tryhard', 'les-deux'];


/* LA STRUCTURE DE LA BASE

   Cinq tables. « IF NOT EXISTS » permet de lancer ces lignes à chaque
   démarrage sans rien abîmer : une table déjà là est laissée telle
   quelle. C'est _middleware.js qui s'en charge, une fois par serveur
   allumé. Tu n'as donc jamais à taper de SQL dans le tableau de bord.

   Attention : ajouter une colonne à une table qui existe déjà ne se
   fait PAS en modifiant ces lignes (la table existe, elles sont
   ignorées). Il faut un ALTER TABLE, à taper une fois dans la console
   de la base sur Cloudflare.

   REFERENCES … ON DELETE CASCADE : quand un groupe disparaît, ses
   membres disparaissent avec lui, et ainsi de suite. Rien ne reste
   orphelin. */
export const SCHEMA = [
  // Un groupe d'amis. Le code est la partie secrète du lien d'invitation.
  `CREATE TABLE IF NOT EXISTS groupes (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    nom TEXT NOT NULL,
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Une personne dans un groupe. « jeux » et « bio » forment son
  // profil : ses jeux préférés (une liste en JSON, voir lireJeu plus
  // bas) et ses dispos habituelles en texte libre. jeton_hash : voir
  // genererJeton() plus bas.
  `CREATE TABLE IF NOT EXISTS membres (
    id INTEGER PRIMARY KEY,
    groupe_id INTEGER NOT NULL REFERENCES groupes(id) ON DELETE CASCADE,
    pseudo TEXT NOT NULL,
    couleur TEXT NOT NULL,
    jeux TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    perso TEXT NOT NULL DEFAULT '{}',
    jeton_hash TEXT NOT NULL UNIQUE,
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Les cases cochées dans l'agenda : une ligne par membre et par
  // semaine. « semaine » est la date du lundi (2026-11-02) ;
  // « creneaux » la liste des cases, écrite en JSON :
  // [[0,21],[0,22],[4,20]] = lundi 21 h, lundi 22 h, vendredi 20 h
  // (0 = lundi, 6 = dimanche). Une seule ligne à réécrire à chaque
  // modification, au lieu d'une ligne par case.
  `CREATE TABLE IF NOT EXISTS dispos (
    membre_id INTEGER NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
    semaine TEXT NOT NULL,
    creneaux TEXT NOT NULL,
    PRIMARY KEY (membre_id, semaine)
  )`,

  // Une soirée proposée. « jeu » est le nom du jeu, « jeu_cover »
  // le code de sa couverture chez IGDB (vide pour un jeu ajouté tel
  // quel). « jour » au format 2026-11-07, « horaire » au format 21:00.
  // Si la personne qui l'a proposée s'en va, la soirée reste
  // (ON DELETE SET NULL) : les autres y sont peut-être inscrits.
  `CREATE TABLE IF NOT EXISTS soirees (
    id INTEGER PRIMARY KEY,
    groupe_id INTEGER NOT NULL REFERENCES groupes(id) ON DELETE CASCADE,
    createur_id INTEGER REFERENCES membres(id) ON DELETE SET NULL,
    titre TEXT NOT NULL,
    jeu TEXT NOT NULL,
    jeu_cover TEXT NOT NULL DEFAULT '',
    jeu_id INTEGER,
    jour TEXT NOT NULL,
    horaire TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Qui vient à quelle soirée : « oui », « peutetre » ou « non ».
  `CREATE TABLE IF NOT EXISTS reponses (
    soiree_id INTEGER NOT NULL REFERENCES soirees(id) ON DELETE CASCADE,
    membre_id INTEGER NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
    reponse TEXT NOT NULL,
    PRIMARY KEY (soiree_id, membre_id)
  )`,

  // Les index sont des tables des matières : ils évitent de relire
  // toute la table pour trouver les membres ou les soirées d'un groupe.
  `CREATE INDEX IF NOT EXISTS membres_par_groupe ON membres (groupe_id)`,
  `CREATE INDEX IF NOT EXISTS soirees_par_groupe ON soirees (groupe_id, jour)`,
];


/* LES MISES À JOUR DE LA BASE

   Une base déjà en ligne garde ses anciennes tables : les lignes
   ci-dessus ne les modifient pas. Chaque changement de structure
   s'ajoute donc ici, à la fin de la liste, sous forme d'ALTER TABLE.

   _middleware.js les lance toutes à chaque démarrage. Une colonne
   déjà ajoutée fait échouer son ALTER TABLE avec « duplicate column » :
   c'est le signe qu'elle est déjà là, et l'erreur est ignorée. Sur une
   base toute neuve, la colonne existe dès le CREATE TABLE, même chose.

   Ne jamais retirer ni modifier une ligne déjà en ligne : seulement en
   ajouter. */
export const MIGRATIONS = [
  // 31 octobre 2026 : la couverture du jeu d'une soirée.
  "ALTER TABLE soirees ADD COLUMN jeu_cover TEXT NOT NULL DEFAULT ''",
  // 31 octobre 2026 : la personnalisation des profils (avatar, statut,
  // style, plateformes, pseudos), rangée en JSON dans une seule colonne.
  "ALTER TABLE membres ADD COLUMN perso TEXT NOT NULL DEFAULT '{}'",
  // 31 octobre 2026 : le numéro IGDB du jeu d'une soirée, pour sa fiche.
  "ALTER TABLE soirees ADD COLUMN jeu_id INTEGER",
];


/* LES RÉPONSES DU SERVEUR

   Toujours du JSON, que le navigateur lit avec reponse.json().
   no-store par défaut : une réponse qui change à chaque modification
   ne doit être gardée en mémoire par personne, ni le navigateur ni un
   relais. « entetes » permet de remplacer ce réglage au besoin (la
   recherche de jeux, elle, peut être gardée un jour). */
export function json(statut, donnees, entetes = {}) {
  return new Response(JSON.stringify(donnees), {
    status: statut,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...entetes,
    },
  });
}

// Une erreur se présente toujours pareil : { erreur: "phrase lisible" }.
// js/commun.js affiche cette phrase telle quelle : elle s'adresse donc
// à la personne devant l'écran, pas à un développeur.
export function erreur(statut, message) {
  return json(statut, { erreur: message });
}

// Lit le corps JSON d'une requête. Un corps illisible donne un objet
// vide plutôt qu'un plantage : les vérifications qui suivent le
// refuseront avec un message clair.
export async function lireCorps(request) {
  try {
    const corps = await request.json();
    return corps && typeof corps === 'object' ? corps : {};
  } catch {
    return {};
  }
}


/* LE NETTOYAGE DES TEXTES REÇUS */

// Pour un champ d'une ligne (pseudo, nom, jeu) : les espaces en trop
// et les retours à la ligne deviennent un espace simple.
export function ligne(valeur) {
  return typeof valeur === 'string' ? valeur.replace(/\s+/g, ' ').trim() : '';
}

// Pour un texte libre (bio, note) : on garde les retours à la ligne,
// mais jamais plus d'une ligne vide d'affilée.
export function bloc(valeur) {
  if (typeof valeur !== 'string') return '';
  return valeur.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Une vraie date au format AAAA-MM-JJ. Le test de forme seul
// laisserait passer un 2026-02-31 ; le passage par Date le refuse.
export function estDate(texte) {
  if (typeof texte !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false;
  const date = new Date(texte + 'T00:00:00Z');
  return !isNaN(date) && date.toISOString().startsWith(texte);
}

// Une semaine se désigne toujours par son lundi : getUTCDay() vaut 1.
export function estLundi(texte) {
  return estDate(texte) && new Date(texte + 'T00:00:00Z').getUTCDay() === 1;
}

/* UN JEU

   Un jeu voyage toujours sous la même forme :
     { id: 1234, nom: "Among Us", cover: "co1r7f" }
   id et cover viennent d'IGDB (la base de jeux de Twitch, voir
   api/groupes/[code]/jeux.js). Un jeu ajouté « tel quel », absent
   d'IGDB, a id: null et cover: "".

   lireJeu vérifie un jeu reçu du navigateur et renvoie sa version
   propre, ou null s'il est mal formé. Le code de couverture ne peut
   contenir que des lettres minuscules et des chiffres : il finit dans
   une adresse, rien d'autre ne doit pouvoir s'y glisser. */
export function lireJeu(jeu) {
  if (!jeu || typeof jeu !== 'object') return null;
  const nom = ligne(jeu.nom);
  if (nom.length < 1 || nom.length > 60) return null;
  return {
    id: Number.isInteger(jeu.id) && jeu.id > 0 ? jeu.id : null,
    nom,
    cover: typeof jeu.cover === 'string' && /^[a-z0-9]{1,40}$/.test(jeu.cover) ? jeu.cover : '',
  };
}

/* Les jeux d'un membre tels que la base les rend. Jusqu'au 31 octobre
   2026, c'était un simple texte « Among Us, Minecraft » : on le
   convertit à la volée en jeux sans image, pour que les profils déjà
   remplis restent valables sans rien retaper. */
export function jeuxStockes(texte) {
  if (texte.startsWith('[')) return JSON.parse(texte);
  return texte.split(',')
    .map((nom) => nom.trim())
    .filter(Boolean)
    .map((nom) => ({ id: null, nom, cover: '' }));
}

/* LA PERSONNALISATION D'UN PROFIL

   Rangée en JSON dans la seule colonne membres.perso :
     { emoji: "🐉", statut: "Chaud pour un Among", style: "tryhard",
       plateformes: ["pc", "switch"], discord: "max#1234",
       pseudos: "Steam : max92" }
   Une seule colonne : ajouter une option plus tard ne demandera pas de
   nouvel ALTER TABLE, juste une ligne ici.

   lirePerso nettoie ce qui arrive du navigateur, champ par champ : un
   emoji, un style ou une plateforme hors des listes est ignoré, un
   texte trop long est coupé. Jamais d'erreur : au pire, le champ reste
   vide. */
export function lirePerso(valeur) {
  const v = valeur && typeof valeur === 'object' ? valeur : {};
  return {
    emoji: EMOJIS.includes(v.emoji) ? v.emoji : '',
    statut: ligne(v.statut).slice(0, 60),
    style: STYLES.includes(v.style) ? v.style : '',
    // filter sur NOTRE liste : garde l'ordre officiel et écarte l'inconnu.
    plateformes: Array.isArray(v.plateformes) ? PLATEFORMES.filter((p) => v.plateformes.includes(p)) : [],
    discord: ligne(v.discord).slice(0, 40),
    pseudos: ligne(v.pseudos).slice(0, 100),
  };
}

// La personnalisation telle que la base la rend (texte JSON), nettoyée
// au passage. Un texte illisible donne une personnalisation vide.
export function persoStockee(texte) {
  try {
    return lirePerso(JSON.parse(texte));
  } catch {
    return lirePerso({});
  }
}

/* Le profil d'un membre, vérifié au même endroit pour l'inscription
   (membres.js) et pour la modification (moi.js). Renvoie soit
   { profil }, soit { probleme } avec la phrase à afficher. */
export function lireProfil(corps) {
  const jeux = Array.isArray(corps.jeux) ? corps.jeux.map(lireJeu) : [];
  const profil = {
    pseudo: ligne(corps.pseudo),
    couleur: COULEURS.includes(corps.couleur) ? corps.couleur : COULEURS[0],
    jeux,
    bio: bloc(corps.bio),
    perso: lirePerso(corps.perso),
  };
  if (profil.pseudo.length < 1 || profil.pseudo.length > 24) {
    return { probleme: 'Choisis un pseudo de 1 à 24 caractères.' };
  }
  if (jeux.length > MAX_JEUX) return { probleme: `${MAX_JEUX} jeux au plus dans un profil.` };
  if (jeux.includes(null)) return { probleme: 'Un des jeux est mal formé.' };
  if (profil.bio.length > 500) return { probleme: 'Tes dispos habituelles sont trop longues (500 caractères au plus).' };
  return { profil };
}

// Deux membres d'un même groupe ne peuvent pas porter le même pseudo :
// on ne saurait plus qui est qui. COLLATE NOCASE : « Max » et « max »
// comptent comme le même. saufId : soi-même, quand on modifie son
// profil sans changer de pseudo.
export async function pseudoPris(db, groupeId, pseudo, saufId = 0) {
  const ligneTrouvee = await db
    .prepare('SELECT 1 FROM membres WHERE groupe_id = ? AND pseudo = ? COLLATE NOCASE AND id != ?')
    .bind(groupeId, pseudo, saufId)
    .first();
  return ligneTrouvee !== null;
}


/* LES CODES ET LES JETONS

   Il n'y a pas de compte ni de mot de passe. Deux secrets suffisent :

   — le CODE du groupe, dans le lien d'invitation : qui l'a peut voir
     le groupe et s'y inscrire. 8 caractères parmi 31, soit plus de
     850 milliards de combinaisons : impossible à deviner au hasard.

   — le JETON de chaque membre, gardé dans son navigateur : c'est lui
     qui prouve « je suis Léa » et permet de modifier SES dispos et
     rien d'autre. */

// Sans I, L, O, 0 ni 1, qu'on confond facilement en recopiant un code.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/* crypto.getRandomValues donne du vrai hasard, contrairement à
   Math.random qui est prévisible. Un octet va de 0 à 255 ; on jette
   ceux de 248 et plus pour que 248 = 8 × 31 tombe juste et que chaque
   lettre ait exactement la même chance de sortir. */
export function genererCode() {
  let code = '';
  while (code.length < 8) {
    for (const octet of crypto.getRandomValues(new Uint8Array(16))) {
      if (octet < 248 && code.length < 8) code += ALPHABET[octet % 31];
    }
  }
  return code;
}

// 32 octets au hasard écrits en hexadécimal : 64 caractères.
export function genererJeton() {
  return enHexa(crypto.getRandomValues(new Uint8Array(32)));
}

/* La base ne garde jamais le jeton lui-même, seulement son empreinte
   SHA-256 : un calcul facile dans un sens, impossible à défaire. Si
   quelqu'un mettait la main sur la base, il n'en tirerait aucun jeton
   utilisable. Pas besoin de « sel » comme pour un mot de passe : un
   jeton de 64 caractères tirés au hasard ne se devine pas par essais. */
export async function hacher(jeton) {
  const empreinte = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jeton));
  return enHexa(new Uint8Array(empreinte));
}

function enHexa(octets) {
  return [...octets].map((octet) => octet.toString(16).padStart(2, '0')).join('');
}


/* QUI APPELLE ?

   Utilisé au début de chaque route d'un groupe. Retrouve le groupe à
   partir du code dans l'adresse, puis le membre à partir du jeton
   envoyé dans l'en-tête Authorization (« Bearer » suivi du jeton).

   Renvoie { groupe, moi } si tout va bien, ou { refus } : une réponse
   d'erreur toute prête, que la route n'a plus qu'à renvoyer.

   membreObligatoire = false pour les routes ouvertes aux simples
   visiteurs du lien : voir le groupe, s'y inscrire. */
export async function identifier({ request, env, params }, membreObligatoire = true) {
  const code = String(params.code || '').toUpperCase();
  const groupe = await env.DB
    .prepare('SELECT id, code, nom FROM groupes WHERE code = ?')
    .bind(code)
    .first();
  if (!groupe) {
    return { refus: erreur(404, "Ce groupe n'existe pas. Vérifie le lien qu'on t'a envoyé.") };
  }

  const jeton = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  let moi = null;
  if (/^[0-9a-f]{64}$/.test(jeton)) {
    moi = await env.DB
      .prepare('SELECT id, pseudo FROM membres WHERE groupe_id = ? AND jeton_hash = ?')
      .bind(groupe.id, await hacher(jeton))
      .first();
  }
  if (!moi && membreObligatoire) {
    return { refus: erreur(401, "Tu n'es pas reconnu dans ce groupe. Recharge la page pour t'inscrire.") };
  }
  return { groupe, moi };
}
