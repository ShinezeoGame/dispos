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

   Sept tables. « IF NOT EXISTS » permet de lancer ces lignes à chaque
   démarrage sans rien abîmer : une table déjà là est laissée telle
   quelle. C'est _middleware.js qui s'en charge, une fois par serveur
   allumé. Tu n'as donc jamais à taper de SQL dans le tableau de bord.

   Attention : ajouter une colonne à une table qui existe déjà ne se
   fait PAS seulement en modifiant ces lignes (la table existe, elles
   sont ignorées). Il faut aussi un ALTER TABLE dans MIGRATIONS, plus
   bas.

   REFERENCES … ON DELETE CASCADE : quand un groupe disparaît, ses
   membres disparaissent avec lui, et ainsi de suite. Rien ne reste
   orphelin. */
export const SCHEMA = [
  // Un groupe d'amis. Le code est la partie secrète du lien d'invitation.
  // webhook : l'adresse du salon Discord où annoncer les soirées
  // ('' = pas branché, voir functions/_annonces.js). Jamais renvoyée
  // aux navigateurs : qui l'a peut écrire dans le salon.
  `CREATE TABLE IF NOT EXISTS groupes (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    nom TEXT NOT NULL,
    webhook TEXT NOT NULL DEFAULT '',
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Un compte = une personne connectée avec Discord. discord_id est le
  // numéro que Discord donne à chaque utilisateur et qui ne change
  // jamais (contrairement au pseudo) : c'est lui qui la reconnaît.
  // « nom » est son nom affiché sur Discord, « discord » son pseudo
  // Discord (celui qu'on tape pour l'ajouter en ami). Rien d'autre :
  // ni e-mail, ni photo, ni liste d'amis.
  `CREATE TABLE IF NOT EXISTS comptes (
    id INTEGER PRIMARY KEY,
    discord_id TEXT NOT NULL UNIQUE,
    nom TEXT NOT NULL,
    discord TEXT NOT NULL DEFAULT '',
    soutien INTEGER NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Une session = un navigateur connecté à un compte (voir « Les
  // comptes » plus bas). Comme pour les jetons des membres, la base ne
  // garde que l'empreinte du secret, jamais le secret lui-même.
  // « expire » : la date après laquelle il faut se reconnecter.
  `CREATE TABLE IF NOT EXISTS sessions (
    jeton_hash TEXT PRIMARY KEY,
    compte_id INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
    expire TEXT NOT NULL
  )`,

  // Une personne dans un groupe. « jeux » et « bio » forment son
  // profil : ses jeux préférés (une liste en JSON, voir lireJeu plus
  // bas) et ses dispos habituelles en texte libre.
  // compte_id : le compte Discord à qui appartient ce profil. Vide pour
  // les profils créés avant les comptes, tant que leur propriétaire ne
  // s'est pas connecté (voir identifier() tout en bas).
  // jeton_hash : l'ancienne façon de se faire reconnaître, voir
  // genererJeton() plus bas.
  `CREATE TABLE IF NOT EXISTS membres (
    id INTEGER PRIMARY KEY,
    groupe_id INTEGER NOT NULL REFERENCES groupes(id) ON DELETE CASCADE,
    compte_id INTEGER REFERENCES comptes(id) ON DELETE SET NULL,
    pseudo TEXT NOT NULL,
    couleur TEXT NOT NULL,
    jeux TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    perso TEXT NOT NULL DEFAULT '{}',
    semaine_type TEXT,
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
    fin TEXT NOT NULL DEFAULT '',
    places INTEGER,
    note TEXT NOT NULL DEFAULT '',
    rappel INTEGER NOT NULL DEFAULT 0,
    choix TEXT NOT NULL DEFAULT '',
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Qui vient à quelle soirée : « oui », « peutetre » ou « non ».
  `CREATE TABLE IF NOT EXISTS reponses (
    soiree_id INTEGER NOT NULL REFERENCES soirees(id) ON DELETE CASCADE,
    membre_id INTEGER NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
    reponse TEXT NOT NULL,
    PRIMARY KEY (soiree_id, membre_id)
  )`,

  // La photo de profil d'un membre (1er nov. 2026), une au plus. Petite
  // (160 × 160 px, réduite par le navigateur avant l'envoi), rangée en
  // base64 : du texte, que la base stocke sans surprise. « version »
  // change à chaque nouvelle photo : elle finit dans l'adresse de
  // l'image (voir adressePhoto), ce qui force les navigateurs à
  // recharger la nouvelle au lieu de garder l'ancienne en mémoire.
  // Une table neuve : le CREATE TABLE suffit, pas de MIGRATIONS.
  `CREATE TABLE IF NOT EXISTS photos (
    membre_id INTEGER PRIMARY KEY REFERENCES membres(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    image TEXT NOT NULL,
    version TEXT NOT NULL
  )`,

  // Le vote « À quoi on joue ? » (2 nov. 2026) : une ligne par membre
  // et par soirée. « choix » est la place du jeu dans soirees.choix
  // (0 pour le premier). Voter à nouveau remplace le vote.
  // Une table neuve : le CREATE TABLE suffit, pas de MIGRATIONS.
  `CREATE TABLE IF NOT EXISTS votes (
    soiree_id INTEGER NOT NULL REFERENCES soirees(id) ON DELETE CASCADE,
    membre_id INTEGER NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
    choix INTEGER NOT NULL,
    PRIMARY KEY (soiree_id, membre_id)
  )`,
  // LES NOTIFICATIONS PUSH (2 nov. 2026, functions/_push.js).
  // reglages : les réglages du site lui-même, une ligne par réglage ;
  // pour l'instant la paire de clés VAPID (clé « vapid »), créée seule.
  `CREATE TABLE IF NOT EXISTS reglages (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL
  )`,
  // abonnements : une « boîte aux lettres » de notifications par
  // appareil (endpoint, chez Google, Mozilla ou Apple) et ses deux
  // clés, rattachée à un compte. Supprimer le compte les emporte.
  `CREATE TABLE IF NOT EXISTS abonnements (
    id INTEGER PRIMARY KEY,
    compte_id INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
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
  // 1er novembre 2026 : les comptes. Chaque profil sait à quel compte
  // il appartient (les tables comptes et sessions, elles, sont toutes
  // neuves : le CREATE TABLE de SCHEMA suffit).
  'ALTER TABLE membres ADD COLUMN compte_id INTEGER REFERENCES comptes(id) ON DELETE SET NULL',
  /* Un compte n'a qu'un profil par groupe : la base refuse le second.
     « WHERE compte_id IS NOT NULL » : la règle ne vise que les profils
     reliés à un compte ; les anciens, sans compte, ne se gênent pas
     entre eux. Rangé ici et non dans SCHEMA : sur une base déjà en
     ligne, SCHEMA passe AVANT l'ajout de la colonne, et l'index
     échouerait faute de colonne. IF NOT EXISTS : ne fait rien la
     seconde fois, sans erreur. */
  'CREATE UNIQUE INDEX IF NOT EXISTS membre_par_compte ON membres (groupe_id, compte_id) WHERE compte_id IS NOT NULL',
  // 2 nov. 2026 : l'heure de fin d'une soirée ('' = pas de fin donnée,
  // au format 01:30 ; plus tôt que le début = le lendemain) et son
  // nombre de places (NULL = illimité).
  "ALTER TABLE soirees ADD COLUMN fin TEXT NOT NULL DEFAULT ''",
  'ALTER TABLE soirees ADD COLUMN places INTEGER',
  /* 2 nov. 2026 : la semaine type d'un membre, en JSON :
     { "depuis": "2026-11-02", "creneaux": [[0,21],[4,22]] }. NULL = pas
     de semaine type. Les semaines à partir de « depuis » où le membre
     n'a rien enregistré reprennent ces créneaux (voir dispos.js et le
     chargement du groupe). */
  'ALTER TABLE membres ADD COLUMN semaine_type TEXT',
  /* 2 nov. 2026 : les annonces Discord (functions/_annonces.js).
     groupes.webhook : l'adresse du salon ('' = pas branché) ;
     soirees.rappel : 1 une fois le rappel « dans moins d'une heure »
     envoyé, pour ne jamais l'envoyer deux fois. */
  "ALTER TABLE groupes ADD COLUMN webhook TEXT NOT NULL DEFAULT ''",
  'ALTER TABLE soirees ADD COLUMN rappel INTEGER NOT NULL DEFAULT 0',
  /* 2 nov. 2026 : comptes.soutien, 1 pour quelqu'un qui soutient
     AllReady (Ko-fi, Tipeee). Posé à la main dans la console D1 (voir
     CLAUDE.md) ; donne un petit cœur sur ses cartes de membre. */
  'ALTER TABLE comptes ADD COLUMN soutien INTEGER NOT NULL DEFAULT 0',
  /* 2 nov. 2026 : soirees.choix, les jeux soumis au vote « À quoi on
     joue ? », en JSON : [{ id, nom, cover }, …], de 2 à 4. '' = pas de
     vote, un seul jeu. Le jeu de la soirée (jeu, jeu_cover, jeu_id)
     suit alors celui qui est en tête (voir soirees/[id].js). */
  "ALTER TABLE soirees ADD COLUMN choix TEXT NOT NULL DEFAULT ''",
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

/* L'adresse de la photo d'un membre, que la page met dans ses <img>
   (voir api/groupes/[code]/photos/[id].js). ?v= : la version de la
   photo. Une nouvelle photo = une nouvelle adresse, donc jamais
   l'ancienne image ressortie de la mémoire du navigateur. */
export function adressePhoto(code, membreId, version) {
  return `/api/groupes/${code}/photos/${membreId}?v=${version}`;
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

/* Une soirée, vérifiée au même endroit pour la création
   (soirees/index.js) et la modification (soirees/[id].js) : les deux
   ne peuvent pas diverger. Renvoie soit { soiree }, soit { probleme }
   avec la phrase à afficher. */
export function lireSoiree(corps) {
  /* Plusieurs jeux (2 nov. 2026) : de 2 à 4 dans « choix », et la team
     vote. Chacun est vérifié comme un jeu seul, les doublons (même id
     IGDB, ou même nom) sont écartés. Il en reste un ? Pas de vote. Le
     premier sert de jeu de la soirée en attendant les votes. */
  let choix = [];
  if (Array.isArray(corps.choix)) {
    for (const brut of corps.choix.slice(0, 8)) {
      const candidat = lireJeu(brut);
      const doublon = candidat && choix.some((deja) => (candidat.id && deja.id === candidat.id)
        || deja.nom.toLowerCase() === candidat.nom.toLowerCase());
      if (candidat && !doublon) choix.push(candidat);
    }
    if (choix.length > MAX_CHOIX) return { probleme: `${MAX_CHOIX} jeux au plus pour un vote.` };
    if (choix.length < 2) choix = [];
  }
  const jeu = choix[0] || lireJeu(corps.jeu);
  if (!jeu) return { probleme: 'Choisis un jeu.' };
  // Sans titre, le nom du jeu fait l'affaire.
  const titre = ligne(corps.titre) || jeu.nom;
  const note = bloc(corps.note);
  if (titre.length > 80) return { probleme: 'Le titre est trop long (80 caractères au plus).' };
  if (!estDate(corps.jour)) return { probleme: 'Choisis une date.' };
  // De 00:00 à 23:59, toujours sur deux chiffres.
  const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (typeof corps.horaire !== 'string' || !HEURE.test(corps.horaire)) {
    return { probleme: 'Choisis une heure.' };
  }
  /* La fin, facultative ('' = pas de fin). Plus tôt que le début, elle
     tombe le lendemain (22:00 → 01:00) : c'est permis. Égale au début,
     la soirée ne durerait rien : refusé. */
  const fin = typeof corps.fin === 'string' ? corps.fin : '';
  if (fin && (!HEURE.test(fin) || fin === corps.horaire)) {
    return { probleme: 'Choisis une heure de fin différente du début.' };
  }
  // Les places, facultatives (vide = illimité), de 2 à 50.
  let places = null;
  if (corps.places !== undefined && corps.places !== null && corps.places !== '') {
    places = Number(corps.places);
    if (!Number.isInteger(places) || places < 2 || places > 50) {
      return { probleme: 'Le nombre de places va de 2 à 50.' };
    }
  }
  if (note.length > 300) return { probleme: 'Le petit mot est trop long (300 caractères au plus).' };
  return { soiree: { jeu, titre, jour: corps.jour, horaire: corps.horaire, fin, places, note, choix } };
}

// Le vote « À quoi on joue ? » : 4 jeux au plus. Même nombre dans
// js/soirees.js (le sélecteur de jeux).
export const MAX_CHOIX = 4;

/* QUI DÉCIDE DANS LE GROUPE (2 nov. 2026) : le premier membre, celui
   qui l'a rejoint en premier (le plus petit id), en général celui qui
   l'a créé. Lui seul renomme le groupe et retire quelqu'un. S'il s'en
   va, le suivant prend le relais tout seul : rien à transmettre. */
export async function adminDuGroupe(db, groupeId) {
  const premier = await db.prepare('SELECT MIN(id) AS id FROM membres WHERE groupe_id = ?').bind(groupeId).first();
  return premier ? premier.id : null;
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

   Pas de mot de passe sur ce site. Des secrets tirés au hasard :

   — le CODE du groupe, dans le lien d'invitation : qui l'a peut voir
     le groupe, et s'y inscrire s'il a un compte. 8 caractères parmi
     31, soit plus de 850 milliards de combinaisons : impossible à
     deviner au hasard.

   — le JETON de SESSION, posé dans le navigateur à la connexion avec
     Discord (voir « Les comptes » plus bas) : c'est lui qui prouve
     « je suis Léa » et permet de modifier SES dispos et rien d'autre.

   — l'ancien JETON de MEMBRE, gardé dans le localStorage : avant les
     comptes (1er nov. 2026), c'était la seule preuve. Il sert encore
     aux profils de cette époque, jusqu'à ce que leur propriétaire se
     connecte (voir identifier()). Les nouveaux profils en reçoivent un
     aussi, parce que la colonne l'exige, mais personne ne le voit. */

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


/* LES COMPTES

   On se connecte avec Discord (voir functions/api/compte/). Une fois
   Discord d'accord, le serveur ouvre une SESSION : il tire un jeton au
   hasard, en range l'empreinte dans la table sessions, et confie le
   jeton au navigateur dans un COOKIE. Le navigateur renvoie ensuite ce
   cookie tout seul, à chaque requête vers le site.

   Pourquoi un cookie, et pas le localStorage comme les anciens jetons ?
   — HttpOnly : le JavaScript de la page ne peut pas le lire. Même si
     quelqu'un réussissait à glisser du code dans la page, il ne
     pourrait pas voler la session.
   — Le retour de Discord est une page que le SERVEUR renvoie : il ne
     peut rien écrire dans le localStorage, seulement poser un cookie.

   Ce cookie sert uniquement à rester connecté : c'est un cookie
   « strictement nécessaire » au sens du RGPD, qui ne demande pas de
   bandeau de consentement. Aucun cookie de pistage ni de pub. */

const NOM_COOKIE = 'session';
const DUREE_SESSION = 90 * 24 * 3600; // 90 jours, en secondes

/* Le texte d'un en-tête Set-Cookie, qui demande au navigateur de
   retenir (ou d'oublier, avec duree = 0) un cookie :
   — Path=/ : renvoyé pour tout le site (chemin plus court au besoin) ;
   — Max-Age : sa durée de vie en secondes ;
   — HttpOnly : invisible pour le JavaScript de la page ;
   — Secure : envoyé seulement en https, jamais en clair ;
   — SameSite=Lax : jamais joint aux envois (POST, PUT…) lancés depuis
     un AUTRE site. Un site piégé ne peut donc pas modifier tes dispos
     à ta place en profitant de ta connexion. */
export function cookie(nom, valeur, duree, chemin = '/') {
  return `${nom}=${valeur}; Path=${chemin}; Max-Age=${duree}; HttpOnly; Secure; SameSite=Lax`;
}

// La valeur d'un cookie reçu, ou '' s'il n'y est pas. Le navigateur
// les envoie tous sur une ligne : « session=ab12…; oauth=cd34… ».
export function lireCookie(request, nom) {
  for (const morceau of (request.headers.get('Cookie') || '').split(';')) {
    const [cle, ...valeur] = morceau.trim().split('=');
    if (cle === nom) return valeur.join('=');
  }
  return '';
}

/* Ouvre une session pour un compte. Renvoie le Set-Cookie à joindre à
   la réponse. Au passage, les sessions expirées sont effacées : la
   table ne grossit pas indéfiniment. */
export async function ouvrirSession(db, compteId) {
  const jeton = genererJeton();
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expire < datetime('now')"),
    db.prepare(`INSERT INTO sessions (jeton_hash, compte_id, expire)
                VALUES (?, ?, datetime('now', '+${DUREE_SESSION} seconds'))`)
      .bind(await hacher(jeton), compteId),
  ]);
  return cookie(NOM_COOKIE, jeton, DUREE_SESSION);
}

/* Ferme la session du navigateur qui appelle (déconnexion). Renvoie le
   Set-Cookie qui lui fait oublier son cookie. */
export async function fermerSession(request, db) {
  const jeton = lireCookie(request, NOM_COOKIE);
  if (/^[0-9a-f]{64}$/.test(jeton)) {
    await db.prepare('DELETE FROM sessions WHERE jeton_hash = ?').bind(await hacher(jeton)).run();
  }
  return cookie(NOM_COOKIE, '', 0);
}

/* Une redirection : « va plutôt à cette adresse » (statut 302). Le
   navigateur y file aussitôt, en retenant au passage les cookies joints. */
export function rediriger(adresse, cookies = []) {
  const entetes = new Headers({ Location: adresse, 'Cache-Control': 'no-store' });
  for (const texte of cookies) entetes.append('Set-Cookie', texte);
  return new Response(null, { status: 302, headers: entetes });
}

/* Où revenir après la connexion : une page de CE site, et rien
   d'autre. Sans cette vérification, un lien piégé pourrait faire
   revenir sur un faux AllReady (« …?retour=https://site-pirate »)
   qui imiterait le vrai. new URL résout l'adresse comme le ferait le
   navigateur : « //pirate.com » ou « /\pirate.com » y sont reconnus
   pour ce qu'ils sont, un autre site. Les adresses /api/ sont refusées
   aussi : revenir sur la connexion elle-même tournerait en rond. */
export function cheminDuSite(texte, request) {
  try {
    const origine = new URL(request.url).origin;
    const cible = new URL(texte || '/', origine);
    if (cible.origin === origine && !cible.pathname.startsWith('/api/')) return cible.pathname + cible.search;
  } catch {
    // Adresse illisible : on rentre à l'accueil.
  }
  return '/';
}

/* Le compte connecté dans ce navigateur : { id, nom, discord }, ou
   null si personne n'est connecté (pas de cookie, cookie inconnu ou
   session expirée). */
export async function compteConnecte(request, db) {
  const jeton = lireCookie(request, NOM_COOKIE);
  if (!/^[0-9a-f]{64}$/.test(jeton)) return null;
  return db
    .prepare(`SELECT c.id, c.nom, c.discord FROM sessions s
              JOIN comptes c ON c.id = s.compte_id
              WHERE s.jeton_hash = ? AND s.expire > datetime('now')`)
    .bind(await hacher(jeton))
    .first();
}


/* QUI APPELLE ?

   Utilisé au début de chaque route d'un groupe. Retrouve le groupe à
   partir du code dans l'adresse, puis ton profil dans ce groupe :

   1. par ton COMPTE, si tu es connecté : le profil relié à ton compte ;
   2. sinon par l'ancien JETON de membre, envoyé dans l'en-tête
      Authorization (« Bearer » suivi du jeton), pour les profils créés
      avant les comptes. Seulement s'il n'est relié à AUCUN compte :
      une fois relié, c'est le compte qui fait foi, et se déconnecter
      déconnecte vraiment.

   Le RATTACHEMENT : connecté, sans profil dans ce groupe, mais avec
   l'ancien jeton d'un profil sans compte ? Ce profil est le tien (le
   jeton le prouve) : on le relie à ton compte, une fois pour toutes.
   Tu le retrouveras ensuite sur tous tes appareils.

   Renvoie { groupe, moi, compte } si tout va bien, ou { refus } : une
   réponse d'erreur toute prête, que la route n'a plus qu'à renvoyer.

   membreObligatoire = false pour les routes ouvertes aux simples
   visiteurs du lien : voir le groupe, s'y inscrire. */
export async function identifier({ request, env, params }, membreObligatoire = true) {
  const db = env.DB;
  const code = String(params.code || '').toUpperCase();
  const groupe = await db
    .prepare('SELECT id, code, nom, webhook FROM groupes WHERE code = ?')
    .bind(code)
    .first();
  if (!groupe) {
    return { refus: erreur(404, "Ce groupe n'existe pas. Vérifie le lien qu'on t'a envoyé.") };
  }

  const compte = await compteConnecte(request, db);
  let moi = null;
  if (compte) {
    moi = await db
      .prepare('SELECT id, pseudo FROM membres WHERE groupe_id = ? AND compte_id = ?')
      .bind(groupe.id, compte.id)
      .first();
  }

  const jeton = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!moi && /^[0-9a-f]{64}$/.test(jeton)) {
    moi = await db
      .prepare('SELECT id, pseudo FROM membres WHERE groupe_id = ? AND jeton_hash = ? AND compte_id IS NULL')
      .bind(groupe.id, await hacher(jeton))
      .first();
    if (moi && compte) {
      await db.prepare('UPDATE membres SET compte_id = ? WHERE id = ?').bind(compte.id, moi.id).run();
    }
  }

  if (!moi && membreObligatoire) {
    return { refus: erreur(401, "Tu n'es pas reconnu dans ce groupe. Recharge la page pour t'inscrire.") };
  }
  return { groupe, moi, compte };
}
