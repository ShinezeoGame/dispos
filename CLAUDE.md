# AllReady

## Le projet

Site pour savoir quand ses amis sont dispos et à quoi jouer ensemble.
Ambiance gaming, mais simple à utiliser. Commencé le 31 octobre 2026.
D'autres idées viendront une fois le site en ligne.

**Le site s'appelle AllReady** depuis le 31 octobre 2026 (avant :
« dispos »). « All ready » = tout le monde est prêt, caché dans
« already ». Choisi parmi des noms anglais à double sens, vérifié comme
libre (aucune appli de ce nom trouvée). Le dépôt GitHub, le projet
Cloudflare et l'adresse `dispos.pages.dev` gardent l'ancien nom ; un
nom de domaine à part reste à choisir.

- Un **groupe** = une bande d'amis, rejoint par un lien d'invitation,
  connecté avec son **compte Discord** (voir « Décisions déjà prises »).
- **L'agenda commun** : chacun coche ses heures dispos de la semaine ; la
  vue « Le groupe » colore chaque case selon le nombre de dispos et
  propose les trois **meilleurs créneaux**.
- **Le profil** : pseudo, couleur, jeux, et « dispos habituelles » en
  texte libre (la seconde façon de donner ses dispos, demandée).
- **Les soirées** : « Soirée Among Us », « Aprem Fortnite »… avec les
  réponses Chaud / Peut-être / Pas dispo. Celui qui l'a proposée peut
  la **modifier** (demandé le 1er nov. 2026 : même fenêtre, pré-remplie)
  ou l'annuler. Changer la date ou l'heure remet les réponses des
  autres à zéro (la pastille « sans réponse » les prévient) ; titre,
  jeu ou petit mot les gardent.
- **Les jeux se cherchent dans IGDB** (la base de Twitch), avec leurs
  couvertures, au lieu d'être tapés à la main (demandé le 31 oct. 2026).
  Dans le formulaire de soirée, les jeux des profils de la team sont
  proposés en un clic, les plus partagés en premier.
- **La brillance de l'agenda** (31 oct. 2026) : plus une case réunit de
  monde, plus elle rayonne (« probabilité de monter une soirée »). Seul,
  pas de lueur : une braise discrète. Dès deux, la case saute d'un cran
  et s'entoure d'une lueur visible (2 nov. 2026 : « la différence entre
  1 et 2 est presque invisible »). À partir de 75 % de la team, un reflet
  balaie la case (« soirée très probable »). Toucher une case affiche la
  chance en clair ; la survoler à la souris montre qui est dispo.
- **Tout l'agenda tient dans l'écran sur ordinateur** (2 nov. 2026,
  demandé) : la hauteur des cases s'adapte à la fenêtre (17 à 34 px),
  les meilleurs créneaux et le détail d'une case passent dans une
  colonne à droite de la grille, « Enregistré ✓ » dans la barre de la
  semaine. Échap ferme le détail. Le téléphone garde une seule colonne.
- **La fiche d'un jeu** au survol (au toucher sur téléphone, au focus
  au clavier) : jaquette, année, tags traduits en français (modes, mots-
  clés comme Roguelike, thèmes comme Horreur, genres) et résumé IGDB, en
  anglais (IGDB n'en a pas d'autre ; traduire demanderait un service en
  plus). Demandée à IGDB au moment voulu (`jeu/[id].js`), jamais stockée.
- **La personnalisation des profils** : avatar emoji, statut, style de
  jeu, plateformes, Discord (copiable d'un clic), autres pseudos. Cachée
  à l'inscription pour rejoindre vite, modifiable ensuite.
- **La photo de profil** (1er nov. 2026) : la case « + » de « Ton
  avatar » ouvre le choix d'une image, puis la fenêtre « Recadre ta
  photo » (`js/recadrage.js`, demandée) : glisser pour placer, zoom ×1 à
  ×4 au curseur, à la molette ou en pinçant, flèches et +/- au clavier,
  un cercle montre ce qui sera gardé. Validée, elle est découpée à
  160 × 160 par le navigateur (WebP, JPEG sur Safari, ~3 Ko). Elle
  remplace l'emoji partout (`avatar()` dans commun.js). Une photo par
  profil, donc par groupe. Choisir un emoji ou « Aa » la retire à
  l'enregistrement ; Annuler ne change rien.
- **Des animations** (31 oct. 2026) : l'accueil qui s'allume (titre,
  aperçu d'agenda colonne par colonne, bulle), l'agenda en vague à
  l'ouverture et au changement de semaine, les cartes l'une après
  l'autre, les fenêtres qui zooment, les boutons qui s'enfoncent, les
  cartes qui se soulèvent, les ronds du logo qui grossissent un peu au survol, de gauche à droite
  (1,2 fois, 60 ms d'écart, demandé).
- **Un jeu de mots sur le nom du groupe**, en petit à droite des
  onglets, quand le nom s'y prête (« Les potes du jeudi » → « Jeudi, jeu
  dit : on joue. »). Rien sinon. Règles dans `js/jeu-de-mots.js`.

## Décisions déjà prises

- HTML + CSS + JavaScript sans framework, sans étape de construction.
  Modules ES (`<script type="module">`), un fichier par partie d'écran.
- **Les comptes passent par Discord** (1er nov. 2026), aucun mot de
  passe. Un compte est **obligatoire pour rejoindre** un groupe (pas pour
  le regarder, ni pour en créer un), et donne **un profil par groupe**
  (pseudo, couleur, jeux propres à chaque groupe). Le compte sert à être
  reconnu et à retrouver ses groupes sur tous ses appareils. Permission
  Discord `identify` seulement (numéro, pseudo, nom affiché) : ni e-mail
  ni photo ni amis. La session est un **cookie** `session` HttpOnly,
  Secure, SameSite=Lax, 90 jours (le seul cookie du site : strictement
  nécessaire, pas de bandeau) ; la base ne garde que son empreinte
  SHA-256. Le code du groupe (8 caractères) reste le secret du lien
  d'invitation. Pied de page : « Pas de pub, pas de pistage. »
- **Les profils d'avant les comptes** gardent leur ancien jeton (gardé
  dans le `localStorage`, clé `dispos`, envoyé en `Authorization:
  Bearer`), tant qu'ils ne sont pas reliés. Connecté avec ce jeton dans
  le navigateur, le profil est relié au compte automatiquement
  (`identifier()`), puis le jeton ne vaut plus rien. Le « lien perso »
  a disparu de l'interface ; groupe.js lit encore les anciens liens
  `…#moi=jeton` déjà partagés.
- **Hébergement : Cloudflare Pages + Functions + D1** (base SQLite de
  Cloudflare), en ligne sur `dispos.pages.dev` depuis le 31 octobre 2026.
  Chaque push sur `main` déclenche un déploiement. KV écarté : ses
  écritures mettent jusqu'à une minute à se propager, trop lent pour un
  agenda partagé.
- **Si un push ne se déploie pas** : bandeau « This project is
  disconnected from your Git account » dans Cloudflare. L'application
  GitHub *Cloudflare Workers and Pages* a perdu l'accès au dépôt :
  github.com/settings/installations → Configure → donner accès à
  `dispos`. Arrivé le 31 oct. 2026 ; *Retry deployment* ne fait que
  relancer l'ancien commit.
- **Direction artistique : que des couleurs chaudes.** Pas de vert
  (premier essai, refusé), **pas de bleu ni de violet** (deuxième essai,
  jugé « trop médical »), le 31 oct. 2026. Fond anthracite à peine chaud
  `#110f0e`, **orange braise `#ff7a3d`** pour l'action, les dispos et le
  « prêt » (l'agenda devient une carte de chaleur : « Qui est chaud ce
  soir ? » au sens propre), **rose néon `#ff4f8b`** pour tout ce qui
  touche aux soirées. Toutes les couleurs et les lueurs passent par les
  variables de `:root` (les lueurs par `color-mix()`), jamais en dur.
  Contrastes notés en tête de `:root`.
- **Chaque visiteur peut choisir la couleur du site** (demandé le
  31 oct. 2026) : le rond coloré de l'en-tête ouvre une palette de six
  thèmes, Braise (l'orange, par défaut pour tout le monde), Néon,
  Plasma, Glace, Sakura, Or. Un thème = `--accent`, `--accent-vif`,
  `--soiree` dans un bloc `[data-theme="…"]` de style.css. Le choix est
  propre à l'appareil : localStorage, clé `allready-theme`.
  `js/theme.js` l'applique dans `<head>` avant l'affichage (pas de
  flash orange) ; `js/apparence.js` fabrique la palette (attribut
  `popover` : ouverture, fermeture et Échap gérés par le navigateur).
  Ajouter un thème : un bloc CSS + une ligne dans `THEMES`, puis
  mesurer ses contrastes.
- **Le logo** (« exceptionnel », à garder tel quel) : une coche dessinée par quatre ronds (les joueurs de la
  team : la validation, c'est le groupe au complet), reliés par un trait
  plein, puis « All » en
  blanc et « Ready » en orange. Écrit en SVG directement dans les trois
  pages, pour suivre les couleurs du CSS et s'animer (les ronds
  s'allument un par un à l'arrivée). `assets/favicon.svg` en est la
  version icône, couleurs écrites en dur. **Proportions à garder** : ronds
  de rayon 5,5 et trait plein de 4,5 (sur 64). Avec des ronds de 7,5 et un
  trait transparent (première version), la coche disparaissait.
- Police des titres **Chakra Petch**, hébergée dans `fonts/` (OFL,
  2 × 10 Ko). Texte courant : police du système. Jamais de Google Fonts.
- **Jamais d'`innerHTML`** : tout texte écrit par un membre passe par
  `textContent` (`creer()` dans commun.js, `<template>` dans groupe.html).
- **Content-Security-Policy stricte** dans `_headers` : aucun script ni
  style écrit dans le HTML, aucun attribut `style="…"`. Les couleurs
  dynamiques passent par `element.style.setProperty('--variable', …)`,
  que la règle autorise.
- **IGDB, jamais appelé depuis le navigateur.** La recherche passe par
  `functions/api/groupes/[code]/jeux.js` (identifiants Twitch dans les
  variables Cloudflare), réservée à ceux qui ont un lien de groupe. Les
  couvertures passent par `functions/api/couverture/[id].js` : aucun
  visiteur n'est signalé à Twitch (RGPD), et la CSP reste en `'self'`.
  Ne pas « simplifier » en chargeant les images depuis images.igdb.com.
- Un jeu absent d'IGDB s'ajoute « tel quel » (sans image), et le site
  reste utilisable si la recherche est en panne ou pas configurée.
- **Pas de texte inutile** (demandé le 31 oct. 2026) : pas de phrases
  d'aide, d'intro ni de remplissage (« facultatif », « pas encore
  renseigné », titres qui répètent l'onglet…). Une zone sans contenu se
  cache plutôt que d'afficher un message. Seules restent les aides qui
  apprennent un geste (glisser pour cocher) et, pour un profil d'avant
  les comptes, l'invitation à le relier à Discord.
  **Allègement du 2 nov. 2026** (demandé : « ne rien surcharger ») :
  - plus de légende sous l'agenda (les couleurs se comprennent seules,
    toucher une case explique tout) ;
  - les cartes « Meilleurs créneaux » sont des boutons entiers, avec
    une petite ligne « Proposer une soirée » au lieu d'un gros bouton
    chacune, et elles sont cachées en mode « Mes dispos » ;
  - une soirée ne répète pas son jeu sous un titre qui le nomme déjà ;
  - sur téléphone, pas de rond de couleur dans l'en-tête d'un groupe
    (il coupait le nom du groupe) : il reste sur l'accueil.
- **Un seul bouton d'invitation** : « Inviter », dans l'en-tête, en
  orange tant qu'on est seul dans le groupe (groupe.js). Pas d'autre
  bouton « copier le lien » ailleurs dans la page.
- Pas de README avant que le site soit terminé (demandé le 31 oct. 2026).

## Les fichiers

    index.html                 accueil : créer / rejoindre un groupe
    groupe.html                la page d'un groupe (/groupe?g=CODE)
    404.html
    css/style.css              toute la mise en forme, commentée
    js/commun.js               réglages, api(), localStorage, dates, avatar
    js/accueil.js              la page d'accueil
    js/groupe.js               chef d'orchestre : en-tête, onglets, chargement
    js/etat.js                 les données de la page et charger()
    js/agenda.js               la grille, le coloriage, les meilleurs créneaux
    js/soirees.js              la liste des soirées et le formulaire
    js/team.js                 les cartes des membres
    js/profil.js               rejoindre / modifier son profil
    js/jeux.js                 le sélecteur de jeux et les couvertures
    js/theme.js                applique la couleur choisie (dans <head>)
    js/apparence.js            la palette des couleurs du site
    js/jeu-de-mots.js          le jeu de mots sur le nom du groupe
    js/fiche-jeu.js            la fiche d'un jeu au survol
    js/compte.js               liens « Se connecter avec Discord », déconnexion
    js/recadrage.js            la fenêtre « Recadre ta photo » (canvas, glisser, zoom)
    functions/_outils.js       code SERVEUR partagé : schéma, vérifs, sessions, identifier()
    functions/_discord.js      code SERVEUR : la connexion Discord (OAuth2)
    functions/api/compte/      connexion.js (départ vers Discord), retour.js
                               (retour de Discord), index.js (qui est connecté,
                               ses groupes), deconnexion.js
    functions/api/_middleware.js   crée les tables, les met à jour, rattrape les erreurs
    functions/api/groupes/…    une route par fichier (voir leurs en-têtes)
    functions/api/groupes/[code]/jeux.js   la recherche IGDB
    functions/api/groupes/[code]/jeu/[id].js   la fiche d'un jeu (IGDB)
    functions/api/couverture/[id].js       les couvertures, relayées
    functions/api/groupes/[code]/photos/[id].js   la photo de profil (voir, changer, retirer)
    functions/_igdb.js         code SERVEUR : jeton Twitch, requêtes IGDB
    assets/discord.svg         le logo Discord des boutons (en pochoir, voir style.css)
    _headers, robots.txt, assets/favicon.svg, fonts/

## Mise en ligne (à faire une fois)

1. Cloudflare → Workers & Pages → D1 → créer une base `dispos`.
2. Workers & Pages → Créer → Pages → connecter le dépôt GitHub `dispos`.
   Branche de production `main`, aucune commande de build, dossier de
   sortie `/`.
3. Dans le projet Pages : Settings → Bindings → D1 database, nom de
   variable **`DB`**, base `dispos`. Redéployer.
4. Les tables se créent seules à la première visite (_middleware.js).
5. **La recherche de jeux** : sur dev.twitch.tv/console (compte Twitch
   avec double authentification obligatoire), *Register Your
   Application* : un nom, OAuth Redirect URL `http://localhost` (exigée
   mais inutilisée), catégorie *Website Integration*, type
   *Confidential*. Puis *Manage* → copier le Client ID, *New Secret* →
   copier le secret. Dans le projet Pages : Settings → Variables and
   Secrets → `TWITCH_CLIENT_ID` et `TWITCH_CLIENT_SECRET` (type
   *Secret*), puis redéployer. Sans elles, on ajoute les jeux tels quels.
6. **La connexion Discord** : sur discord.com/developers/applications,
   *New Application* (nom : AllReady). Onglet *OAuth2* : copier le
   Client ID, *Reset Secret* → copier le secret, et dans *Redirects*
   ajouter exactement `https://dispos.pages.dev/api/compte/retour`
   (une adresse par domaine : à refaire le jour du vrai nom de domaine).
   Dans le projet Pages : Settings → Variables and Secrets →
   `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET` (type *Secret*), puis
   redéployer. Sans elles, « Se connecter » revient avec « pas encore
   configurée », et personne ne peut rejoindre de groupe.

## Ce qui casse si on n'y fait pas attention

- **Les réglages existent en double** : `HEURE_DEBUT`, `HEURE_FIN` et
  `COULEURS` sont dans `js/commun.js` ET `functions/_outils.js`. Changer
  l'un sans l'autre = le serveur refuse ce que la page envoie.
- **Les heures dépassent 23** : l'agenda va de 9 (9 h) à 26 (2 h – 3 h du
  matin). 25 dans la colonne vendredi = samedi 1 h. `debutCase()` et
  `caseDe()` (etat.js) font la conversion dans les deux sens.
- **Dates toujours à l'heure locale** : `versTexte()`, jamais
  `toISOString()` (qui donne la date de Londres, fausse après minuit).
- **Le schéma est en `CREATE TABLE IF NOT EXISTS`** : modifier `SCHEMA`
  seul ne change rien aux tables déjà en ligne. Pour une nouvelle
  colonne : l'ajouter dans `SCHEMA` (bases neuves) ET un `ALTER TABLE` à
  la fin de `MIGRATIONS` (bases existantes), tous deux dans `_outils.js`.
  _middleware.js les lance au démarrage et ignore « duplicate column ».
  Ne jamais retirer ni modifier une migration déjà en ligne.
- **Les jeux d'un profil sont une liste JSON** dans la colonne texte
  `membres.jeux` : `[{ id, nom, cover }]`. Les profils d'avant le
  31 oct. 2026 y ont un texte « Among Us, Minecraft » : `jeuxStockes()`
  le convertit à la lecture. Garder cette conversion. Une soirée stocke
  `jeu` (le nom) et `jeu_cover`.
- **La clé du localStorage reste `dispos`**, l'ancien nom. La renommer
  ferait perdre à tout le monde son jeton, donc l'accès à son profil.
- **Le logo est écrit trois fois** (index.html, groupe.html, 404.html) :
  le modifier aux trois endroits, et dans `assets/favicon.svg`.
- **« Tes groupes » (accueil) a deux sources** : ceux du compte
  (`GET /api/compte`, depuis la base) puis ceux retenus par le navigateur
  (localStorage), sans doublon. Un groupe supprimé dans D1 disparaît
  aussitôt de la première, mais ne quitte la seconde qu'au moment où on
  l'ouvre : le serveur répond 404 et groupe.js appelle `oublierGroupe()`.
  Seul un 404 efface : une coupure réseau ne doit jamais faire perdre un
  jeton.
- **Qui est qui : `identifier()`** (`_outils.js`), au début de chaque
  route d'un groupe. D'abord le compte (cookie), sinon l'ancien jeton,
  et seulement pour un profil **sans** compte (sinon se déconnecter ne
  déconnecterait pas). Connecté + ancien jeton d'un profil sans compte
  = rattachement automatique. Ne pas changer cet ordre.
- **Un compte, un profil par groupe** : vérifié dans `membres.js` ET
  garanti par l'index unique `membre_par_compte` (dans `MIGRATIONS`, pas
  dans `SCHEMA` : sur une base déjà en ligne, SCHEMA passe avant l'ajout
  de la colonne `compte_id`). Les nouveaux profils reçoivent une
  empreinte de jeton tirée au hasard (la colonne `jeton_hash` l'exige),
  jamais renvoyée.
- **Les boutons de connexion sont des liens** (`<a data-connexion>`),
  jamais des formulaires : la CSP `form-action 'self'` bloquerait la
  redirection vers discord.com. `js/compte.js` complète leur adresse
  avec `?retour=` (la page actuelle) ; le serveur n'accepte qu'un chemin
  de ce site (`cheminDuSite()`), jamais un autre domaine.
- **L'adresse de retour Discord doit être enregistrée à l'identique**
  dans l'application Discord (`…/api/compte/retour`). Changer de domaine
  ou renommer `functions/api/compte/retour.js` = connexion cassée tant
  que *Redirects* n'est pas mis à jour.
- **Les échecs de connexion reviennent par l'adresse** :
  `#connexion-ratee` ou `#connexion-indisponible`, traduits par
  `js/compte.js` (message dans la fenêtre « Rejoins », sinon annonce en
  bas) puis effacés de la barre d'adresse.
- **`js/theme.js` doit rester un script classique dans `<head>`**, avant
  la feuille de style : en module ou en `defer`, la page s'afficherait
  d'abord en orange puis changerait de couleur.
- **Le nom du groupe a la même taille que le nom du site** (1.35rem) :
  c'est ce qui aligne leurs lignes de base dans l'en-tête. Avec une
  taille plus petite, il paraît flotter 2 px trop haut.
- **Les jeux de mots** : l'ordre de `REGLES` est la priorité (la première
  règle qui reconnaît un mot du nom gagne), du plus précis au plus
  général. Les motifs portent sur le nom en minuscules et sans accents.
  La phrase choisie dépend du code du groupe : elle ne change pas d'une
  visite à l'autre.
- **La couleur des cases se mélange `in srgb-linear`** (1er nov. 2026,
  « trop foncé ») : `color-mix(in srgb-linear, accent niveau%, case)`.
  Le mélange ordinaire (`in srgb`) donnait un brun terne aux cases à une
  ou deux personnes. Garder le même espace dans `.apercu .n1…n3`
  (l'aperçu de l'accueil). Le chiffre passe en sombre (`forte`) au-delà de
  0,5 (agenda.js), lisible sur ces couleurs plus claires. Un créneau
  passé est à 0,55 d'opacité (0,35 rendait la semaine illisible le
  dimanche).
- **La couleur et la lueur d'une case viennent de `intensite()`**
  (agenda.js) : `--niveau` 0,25 et pas de lueur pour une personne,
  puis de 0,45 / `--eclat` 0,5 (deux personnes) à 1 / 1 (toute la team).
  `--decalage` règle le départ du reflet, en vague par jour. Le seuil du
  reflet est `TRES_PROBABLE` (0,75, sur la part de la team, `chance.part`)
  dans agenda.js. La lueur est rangée dans `--lueur` : tout autre
  `box-shadow` sur `.case` doit la reprendre (`…, var(--lueur)`), sinon
  il l'efface. Une case qui luit a la classe `lumineuse` (z-index 1, le
  reflet `brille` 2) : sans ça, les cases suivantes recouvraient sa
  lueur, visible d'un seul côté.
- **La hauteur des cases sur ordinateur est calculée par
  `ajusterHauteur()`** (agenda.js) et posée dans `--hauteur-case` : la
  fenêtre, moins la position de la grille, moins ce qu'elle a de fixe
  (ligne des jours, espaces, coupure de minuit), partagé en 18 lignes.
  Recalculée au redessin, au redimensionnement, à l'arrivée de la police
  et quand l'onglet réapparaît (ResizeObserver). Ne pas fixer de hauteur
  en dur sur `.case` : seulement le repli `var(--hauteur-case, 1,9rem)`.
- **L'onglet Agenda a deux colonnes sur ordinateur** (`.agenda-corps` :
  `.agenda-principal` avec la grille, `.agenda-cote` avec le détail puis
  les meilleurs créneaux). Sur téléphone, `.agenda-cote` est en
  `display: contents` et `order` replace les créneaux au-dessus de la
  grille et le détail en dessous. La colonne n'existe que si elle a
  quelque chose à montrer (`:has()`).
- **Les animations d'arrivée passent par la classe `entree`**, posée par
  `animerEntree()` (commun.js) puis retirée après 1,2 s. Ne jamais mettre
  une animation d'arrivée directement sur une carte ou une case : la page
  redessine ses listes à chaque modification, elle se rejouerait sans
  cesse. N'animer que `transform` et `opacity`. « Moins d'animations »
  (prefers-reduced-motion) coupe tout d'un coup, en fin de style.css.
- **La personnalisation est en JSON dans `membres.perso`** (une seule
  colonne) : `{ emoji, statut, style, plateformes, discord, pseudos }`.
  Ajouter une option = un champ dans `lirePerso()` (_outils.js), pas de
  migration. Les listes `EMOJIS`, `PLATEFORMES`, `STYLES` existent en
  double (commun.js et _outils.js) : les changer ensemble.
- **La connexion IGDB vit dans `functions/_igdb.js`** (jeton Twitch,
  envoi des requêtes), partagée par la recherche et la fiche. Les tags :
  tables de traduction en tête de `jeu/[id].js` ; un nom absent des
  tables est ignoré plutôt qu'affiché en anglais. Les soirées retiennent
  `jeu_id` depuis le 31 oct. 2026 (les plus anciennes n'ont pas de fiche).
- **Les photos de profil vivent dans la table `photos`** (base64,
  50 Ko au plus, signature JPEG/PNG/WebP vérifiée, jamais de SVG), pas
  dans `membres`. Le chargement du groupe ne renvoie que leur adresse,
  avec `?v=version` (`adressePhoto()`) : une nouvelle photo = une
  nouvelle adresse, sinon le navigateur (cache d'un an) garderait
  l'ancienne. L'aperçu avant envoi est une adresse `data:` : ne pas
  retirer `data:` de `img-src` dans la CSP. Seul son propriétaire peut
  changer ou retirer une photo, et le code d'un groupe n'ouvre que les
  photos de ses membres.
- **Une soirée se vérifie dans `lireSoiree()`** (_outils.js), pour la
  création (POST `soirees/index.js`) comme pour la modification (PATCH
  `soirees/[id].js`). Une nouvelle règle (longueur, format) va là, et
  vaut pour les deux. Dans `[id].js`, PUT = répondre, PATCH = modifier,
  DELETE = annuler.
- **12 jeux par profil au plus** : écrit dans `functions/_outils.js`
  (`MAX_JEUX`) ET dans `js/profil.js`. Changer les deux ensemble.
- **Limites de D1 (offre gratuite)** : 50 requêtes SQL par appel, 100
  paramètres par requête. C'est pour ça que les dispos d'une semaine
  tiennent en UNE ligne JSON (`[[jour, heure], …]`) et non une ligne par case.
- **Les dispos de la semaine affichée remplacent tout** (`PUT /dispos`) :
  envoyer une liste partielle effacerait le reste.
- Dans `charger()`, tes propres cases de la semaine en cours ne sont pas
  écrasées par celles du serveur : l'écran fait foi tant qu'on ne change
  pas de semaine.

## Tester en local

Pas de wrangler installé (demander avant). Les tests de la première
session utilisaient un petit serveur Node hors dépôt qui imitait Pages,
Functions et D1 (`node:sqlite`), et Playwright pour les captures. IGDB y
était imité (fausse liste de jeux, fausses jaquettes) : la vraie
recherche ne se teste qu'en ligne, une fois les identifiants Twitch posés.
Discord aussi (1er nov. 2026) : faux échange de code, faux
utilisateurs. Dans Playwright, la page discord.com atteinte par
redirection ne s'intercepte pas : intercepter `/api/compte/connexion`,
garder sa vraie réponse (cookie `oauth`, `state`) et sauter directement
au retour. La vraie connexion ne se teste qu'en ligne.

## Comment travailler avec moi

- Je veux comprendre chaque ligne pour pouvoir modifier ce site seul.
- Un bloc à la fois. Explique en français ce que fait chaque partie et
  pourquoi. Commente le code en français.
- Préviens-moi avant d'installer un outil ou d'ajouter une dépendance.
- À la fin de chaque bloc : capture d'écran du rendu envoyée, puis
  commit et push. **`main` est la branche de référence** (choisi le
  31 octobre 2026) : c'est elle que Cloudflare mettra en ligne.

## Idées pour la suite (rien de décidé)

- Quitter un groupe, retirer un membre, renommer le groupe.
- Supprimer son compte (et ses profils) soi-même.
- Une « semaine type » qui se recopie toute seule d'une semaine à l'autre.
- Rappel ou notification avant une soirée (Discord, e-mail).
- Nombre de places par soirée (ex. 4 pour un jeu en équipe).
