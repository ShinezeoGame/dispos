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

- Un **groupe** = une bande d'amis, rejoint par un lien d'invitation.
- **L'agenda commun** : chacun coche ses heures dispos de la semaine ; la
  vue « Le groupe » colore chaque case selon le nombre de dispos et
  propose les trois **meilleurs créneaux**.
- **Le profil** : pseudo, couleur, jeux, et « dispos habituelles » en
  texte libre (la seconde façon de donner ses dispos, demandée).
- **Les soirées** : « Soirée Among Us », « Aprem Fortnite »… avec les
  réponses Chaud / Peut-être / Pas dispo.
- **Les jeux se cherchent dans IGDB** (la base de Twitch), avec leurs
  couvertures, au lieu d'être tapés à la main (demandé le 31 oct. 2026).
  Dans le formulaire de soirée, les jeux des profils de la team sont
  proposés en un clic, les plus partagés en premier.
- **La brillance de l'agenda** (31 oct. 2026) : plus une case réunit de
  monde, plus elle rayonne (« probabilité de monter une soirée »). Seul,
  pas de lueur. À partir de 75 % de la team, un reflet balaie la case
  (« soirée très probable »). Toucher une case affiche la chance en clair.
- **Des animations** (31 oct. 2026) : l'accueil qui s'allume (titre,
  aperçu d'agenda colonne par colonne, bulle), l'agenda en vague à
  l'ouverture et au changement de semaine, les cartes l'une après
  l'autre, les fenêtres qui zooment, les boutons qui s'enfoncent, les
  cartes qui se soulèvent, les ronds du logo qui grossissent un peu au survol (1,2 fois, demandé).
- **Un jeu de mots sur le nom du groupe**, en petit à droite des
  onglets, quand le nom s'y prête (« Les potes du jeudi » → « Jeudi, jeu
  dit : on joue. »). Rien sinon. Règles dans `js/jeu-de-mots.js`.

## Décisions déjà prises

- HTML + CSS + JavaScript sans framework, sans étape de construction.
  Modules ES (`<script type="module">`), un fichier par partie d'écran.
- **Pas de compte, pas de mot de passe.** Le code du groupe (8 caractères)
  est dans le lien ; chaque membre reçoit un jeton secret gardé dans son
  `localStorage` (clé `dispos`). La base ne stocke que l'empreinte SHA-256
  du jeton. Le « lien perso » (`…#moi=jeton`) sert à se retrouver sur un
  autre appareil ; groupe.js l'efface de la barre d'adresse.
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
    functions/_outils.js       code SERVEUR partagé : schéma, vérifs, jetons
    functions/api/_middleware.js   crée les tables, les met à jour, rattrape les erreurs
    functions/api/groupes/…    une route par fichier (voir leurs en-têtes)
    functions/api/groupes/[code]/jeux.js   la recherche IGDB
    functions/api/couverture/[id].js       les couvertures, relayées
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
- **« Tes groupes » (accueil) vient du navigateur, pas de la base.**
  Supprimer un groupe dans D1 ne l'enlève de cette liste qu'au moment où
  on l'ouvre : le serveur répond 404 et groupe.js appelle
  `oublierGroupe()`. Seul un 404 efface : une coupure réseau ne doit
  jamais faire perdre un jeton.
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
- **La brillance** passe par deux variables posées par agenda.js sur
  chaque case : `--eclat` (0 à 1, part de la team dispo, 0 si seul) et
  `--decalage` (le départ du reflet, en vague par jour). Le seuil du
  reflet est `TRES_PROBABLE` (0,75) dans agenda.js. La lueur est rangée
  dans `--lueur` : tout autre `box-shadow` sur `.case` doit la reprendre
  (`…, var(--lueur)`), sinon il l'efface.
- **Les animations d'arrivée passent par la classe `entree`**, posée par
  `animerEntree()` (commun.js) puis retirée après 1,2 s. Ne jamais mettre
  une animation d'arrivée directement sur une carte ou une case : la page
  redessine ses listes à chaque modification, elle se rejouerait sans
  cesse. N'animer que `transform` et `opacity`. « Moins d'animations »
  (prefers-reduced-motion) coupe tout d'un coup, en fin de style.css.
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
- Une « semaine type » qui se recopie toute seule d'une semaine à l'autre.
- Rappel ou notification avant une soirée (Discord, e-mail).
- Nombre de places par soirée (ex. 4 pour un jeu en équipe).
