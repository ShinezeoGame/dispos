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
  jeu ou petit mot les gardent. **Une tranche horaire** (2 nov. 2026,
  demandé) : « De » et « À » (fin facultative, plus tôt que le début =
  le lendemain), pré-remplis par un meilleur créneau ; sur l'agenda, le
  cadre rose couvre toute la tranche (`dureeEnHeures()`). **Des
  places** facultatives (2 à 50) : « 3/4 places », puis « Complet » (le
  bouton Chaud se bloque, le serveur refuse le « oui » de trop).
  Colonnes `soirees.fin` ('' = pas de fin) et `soirees.places` (NULL =
  illimité).
- **Le fuseau horaire du groupe** (2 nov. 2026, `groupes.fuseau`,
  Europe/Paris par défaut) : pris dans le navigateur de celui qui crée
  le groupe, modifiable par le premier membre (« Fuseau horaire » dans
  Le groupe, la liste de `Intl.supportedValuesOf`). Toutes les heures
  (agenda, soirées, rappels, « Chaud ce soir », soirées de chaque
  semaine) sont celles du groupe : côté page, `maintenant()`
  (commun.js) remplace `new Date()` ; côté serveur, `heureDuGroupe()`
  (_annonces.js). Un appareil dans un autre fuseau lit « heures de
  Montreal » sous les dates de la semaine. Le flux .ics le dit
  (`X-WR-TIMEZONE`).
- **Les soirées de chaque semaine** (2 nov. 2026) : case « Chaque
  semaine » dans le formulaire (`soirees.hebdo`). La carte dit « chaque
  jeudi ». Le surlendemain de son jour (le lendemain reste pour
  pointer qui était là, AllReady+), la soirée avance d'autant de
  semaines qu'il faut (`recalerHebdos()`, _outils.js, lancé au
  chargement du groupe ET par le réveil des rappels, pour les groupes
  que personne n'ouvre) : réponses et votes remis à zéro, sauf la
  réponse de l'auteur, rappel réarmé. Le flux .ics la répète
  (`RRULE:FREQ=WEEKLY`), Discord dit « chaque semaine ». Annuler arrête
  toute la série (la question le dit) ; décocher aussi.
- **« À quoi on joue ? »** (2 nov. 2026) : dans le formulaire, choisir
  2 à 4 jeux au lieu d'un (aide : « Choisis-en plusieurs pour faire
  voter la team »). La carte montre alors un bouton par jeu avec son
  nombre de votes ; un clic vote, revoter ailleurs déplace le vote,
  recliquer le retire. Le serveur remet à chaque vote le jeu en tête
  dans `jeu`, `jeu_cover`, `jeu_id` (égalité : le premier de la liste) :
  jaquette, agenda, flux .ics et Discord suivent sans rien calculer.
  `soirees.choix` (JSON, '' sans vote), table `votes`, PUT `{ vote }`
  sur `soirees/[id]` (null = retirer). Changer les jeux du vote efface
  les votes. 4 jeux au plus : `MAX_CHOIX` dans `_outils.js` ET
  `js/soirees.js`.
- **« À quoi jouer ce soir »** (2 nov. 2026, `js/ce-soir.js`) : en haut
  de l'onglet Soirées, « Ce soir, 5 dispos · à quoi on joue ? » puis
  les jeux que ces dispos ont en commun (au moins deux d'entre eux),
  avec « 4/5 l'ont » et le nombre de joueurs maximum d'après IGDB
  (« 15 max », en rose quand on est plus nombreux). Un clic ouvre
  « Proposer une soirée » rempli : ce jeu, ce soir, la meilleure heure.
  Dispo ce soir = une heure cochée dans `ceSoir()` (etat.js, partagé
  avec « Chaud ce soir »). Caché à moins de deux dispos, sans jeu
  partagé, ou si l'agenda montre une autre semaine. Pas dans la colonne
  de l'agenda : elle aurait fait dépasser la page de l'écran. Les
  nombres viennent de `[code]/joueurs?ids=…` (une question IGDB pour
  tous les jeux, `multiplayer_modes`).
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
- **Le repère « maintenant » et le clavier** (2 nov. 2026) : la case de
  l'heure en cours est cerclée d'un liseré clair et son heure s'allume
  dans la marge ; tout se met à jour chaque heure. Une seule case de la
  grille est dans l'ordre du Tab, les flèches vont de case en case (les
  cases grisées sont sautées), Entrée ou Espace font comme un clic.
- **« Chaud ce soir » en un clic** (2 nov. 2026, `dessinerChaud()` et
  `ceSoir()` dans agenda.js) : un bouton dans la barre de l'agenda,
  membres seulement. Il coche d'un coup tes heures de ce soir, de 19 h
  (ou de l'heure en cours) jusqu'à 3 h ; un second clic les décoche.
  Avant 3 h du matin, « ce soir » est encore la soirée de la veille.
  Si l'agenda montre une autre semaine, il ramène d'abord à la bonne.
  À côté : « 2 autres aussi » (les membres qui ont au moins une heure
  ce soir).
- **La semaine type** (2 nov. 2026) : en mode « Mes dispos », la case
  « Répéter chaque semaine » fait de la semaine affichée ton modèle ;
  les semaines suivantes où tu n'as rien coché le reprennent. Modifier
  une autre semaine = une exception pour elle seule ; modifier la
  semaine modèle met le modèle à jour ; décocher arrête. Rangée dans
  `membres.semaine_type` (`{ depuis, creneaux }` ou NULL), envoyée avec
  `PUT /dispos` (champ `repeter`), fondue dans « dispos » au chargement
  du groupe (jamais renvoyée telle quelle).
- **Le groupe, sous les cartes de « La team »** (2 nov. 2026,
  `js/reglages.js`) : renommer (le premier membre seulement), copier le
  lien d'agenda, quitter. Le premier membre (plus petit id,
  `adminDuGroupe()`) peut aussi « Retirer du groupe » les autres ; s'il
  part, le suivant prend le relais. Le dernier qui quitte supprime le
  groupe. Routes : PATCH `[code]` (renommer), DELETE `[code]/moi`
  (quitter), DELETE `[code]/membres/[id]` (retirer). Un membre retiré
  peut revenir avec le lien : il n'y a pas de bannissement.
- **Les soirées dans son agenda** : `[code]/calendrier` sert un flux
  iCalendar (.ics), lu par Google Agenda (« À partir de l'URL ») et
  Apple Calendrier (« Nouvel abonnement »), qui le relisent tout seuls.
  Heures « flottantes » (sans fuseau) ; sans heure de fin, deux heures.
- **Les soirées sur Discord** (2 nov. 2026, `functions/_annonces.js`) :
  le premier membre colle l'adresse d'un webhook de salon (« Salon
  Discord », dans Le groupe). Le site y annonce chaque nouvelle soirée
  (encadré rose avec jaquette), une soirée déplacée (jour ou heure
  changés, pas un simple titre), une soirée à venir annulée, et un
  **rappel moins d'une heure avant** qui mentionne les « Chaud » ayant
  un compte (notification Discord). Pas de bot, pas d'e-mail (on n'a
  pas les adresses). Le rappel a besoin d'un réveil : voir « Mise en
  ligne », étape 7. Routes : PUT/DELETE `[code]/discord` (brancher,
  débrancher), POST `/api/rappels` (le réveil).
- **La team en chiffres** (2 nov. 2026, `js/stats.js`) : au-dessus
  des cartes de La team, deux repères au plus, en simple texte (sans
  cadre : encadrés, ils passaient pour des boutons) : « Le plus chaud »
  (le plus de « Chaud », à partir de 2 ; deux ex æquo au plus, sinon
  caché) et « Le jeu de la team » (dans le plus de profils, à partir de
  2, fiche au survol). Chacun se cache s'il ne veut rien dire, la
  rangée aussi. Le serveur envoie `stats: { chauds }` avec le groupe ;
  le jeu se calcule dans la page. « Soirées proposées » retiré le même
  jour (demandé : seule, la tuile avait l'air d'un bouton bizarre).
- **Le site installable, avec notifications** (2 nov. 2026) :
  `manifest.webmanifest` (nom, couleurs, icônes `assets/icone-*.png`
  tirées de `assets/icone.svg`) et `sw.js` (le service worker, qui ne
  fait qu'afficher les notifications : aucun cache). « Sur cet
  appareil », dans Le groupe : « Installer l'appli » quand le navigateur
  le propose (aussi en bas de l'accueil), « Activer les notifications »
  (compte Discord requis), puis « Couper ». Sur iPhone, une aide :
  Partager → « Sur l'écran d'accueil » (pas de notifications avant).
  `js/appli.js` côté page, `functions/_push.js` côté serveur
  (chiffrement RFC 8291 et signature VAPID faits à la main avec
  crypto.subtle, vérifiés sur l'exemple de la RFC), route `/api/push`
  (clé, abonner, désabonner).
- **Tout ce qui se passe dans le groupe, en notifications** (5 nov.
  2026, demandé : « notifier les gens de tout ce qu'il se passe dans
  leur groupe »). Cinq sortes (`TYPES_NOTIFS`) :
  - `soirees` : une soirée proposée, déplacée ou annulée ;
  - `reponses` : un « Chaud » à une soirée que tu as proposée
    (« Chaud : Léa et Sam · 3/4 places ») ;
  - `dispos` : qui est dispo ce soir (« Léa, Sam et Tom sont dispo ce
    soir »), dès qu'un membre coche sa première heure de ce soir, une
    fois par membre et par soir (`membres.dispo_annoncee`), sur le site
    comme avec `/dispo` ;
  - `membres` : quelqu'un rejoint le groupe ;
  - `rappels` : moins d'une heure avant (par le réveil, étape 7), et
    « une place s'est libérée ».

  Celui qui agit n'est jamais prévenu de son propre geste. Les textes
  sont dans `functions/_evenements.js`, sauf ceux d'avant (nouvelle
  soirée dans `soirees/index.js`, rappel dans `rappels.js`, place
  libérée dans `_reponses.js`). Un même `tag` remplace la notification
  précédente au lieu d'empiler : une seule « dispo ce soir » par groupe
  et par soir, une seule liste de « Chaud » par soirée.

  Chacun coupe les sortes qu'il ne veut pas : « Me prévenir », dans Le
  groupe → Sur cet appareil, une fois activées. Le choix vaut pour le
  compte, donc tous ses appareils et tous ses groupes
  (`comptes.notifs`, liste JSON des sortes coupées, '' = tout ;
  `PATCH /api/compte { coupees }`). Le tri se fait à l'envoi
  (`abonnementsDe(…, type)`, _push.js).

  **L'invitation** (`js/notifications.js`) : un bandeau 🔔 en haut de la
  page d'un groupe, sous les onglets, « Activer les notifications »,
  pour un membre connecté pas encore abonné sur cet appareil. La croix
  le fait partir pour de bon (localStorage, clé
  `allready-invitation-notifs`). Caché si le navigateur a refusé les
  notifications. Sur iPhone hors écran d'accueil, il dit comment l'y
  mettre.
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
- **Supprimer son compte** (2 nov. 2026) : lien « Supprimer mon
  compte » dans le pied de page de l'accueil, connecté seulement, après
  un `confirm()` qui dit ce qui disparaît. `DELETE /api/compte` efface
  d'un bloc (`batch`) les groupes dont il est le seul membre, ses
  profils (dispos, réponses, photo suivent par CASCADE ; ses soirées
  restent, sans auteur), puis le compte et ses sessions. Jamais « tous
  les groupes vides » : un groupe tout juste créé l'est aussi.
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
  thèmes, du plus chaud au plus froid : Braise (l'orange, par défaut
  pour tout le monde), Lave (rouge), Sakura (rose), Néon (magenta,
  soirées cyan), Plasma (violet), Glace (cyan). Revus le 2 nov. 2026
  (« le jaune est moche sur l'agenda ») : **jamais de jaune ni de vert
  citron en accent**, l'agenda les assombrit en moutarde et en olive.
  Or a disparu (qui l'avait choisi retombe sur Braise), Néon est passé
  du vert citron au magenta. Le rond du thème n'a qu'une couleur,
  l'accent. Un thème = `--accent`, `--accent-vif`,
  `--soiree` dans un bloc `[data-theme="…"]` de style.css. Le choix est
  propre à l'appareil : localStorage, clé `allready-theme`.
  `js/theme.js` l'applique dans `<head>` avant l'affichage (pas de
  flash orange) ; `js/apparence.js` fabrique la palette (attribut
  `popover` : ouverture, fermeture et Échap gérés par le navigateur).
  Ajouter un thème : un bloc CSS + une ligne dans `THEMES`, puis
  mesurer ses contrastes et regarder l'agenda (cases à 1 ou 2 personnes).
  Trois **thèmes exclusifs** en plus (AllReady+, 3 nov. 2026) : voir
  « Thèmes exclusifs et bannière » plus bas.
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
- **La monétisation, préparée mais éteinte** (2 nov. 2026). Rien ne se
  voit tant que rien n'est réglé :
  - **Soutenir** : `LIEN_SOUTIEN` dans `js/commun.js` (page Ko-fi ou
    Tipeee). Rempli, « ♥ Soutenir AllReady » apparaît en bas de
    l'accueil.
  - **Les soutiens** : `comptes.soutien` = 1 donne un cœur rose après
    le pseudo et un anneau rose autour de l'avatar, dans tous ses
    groupes. Posé à la main : Cloudflare → D1 → `dispos` → Console,
    `UPDATE comptes SET soutien = 1 WHERE discord = 'son_pseudo';`.
  - **Voir le prix** : `LIEN_PRIX` dans `js/commun.js`, l'adresse de
    recherche du programme d'affiliation avec `{jeu}` à la place du nom
    (ex. Instant Gaming, `…/rechercher/?q={jeu}&igr=CODE`). Rempli, une
    soirée dont le jeu n'est pas dans ton profil montre « Voir le prix ·
    lien affilié » (mention obligatoire, `rel="sponsored"`). Pas dans la
    fiche du jeu : c'est une bulle de survol, on ne peut pas y cliquer.
  - **Cloudflare Web Analytics** (visites comptées sans cookie, donc
    sans bandeau) : la CSP l'autorise déjà. L'activer dans le projet
    Pages (onglet Metrics → Web Analytics → Enable) ; Cloudflare ajoute
    son script tout seul au déploiement suivant.

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
    js/stats.js                la team en chiffres (au-dessus des cartes)
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
    functions/_annonces.js     code SERVEUR : les messages envoyés au salon Discord
    functions/api/rappels.js   les rappels « dans moins d'une heure » (appelé par le réveil)
    functions/api/groupes/[code]/discord.js   brancher / débrancher le salon Discord
    functions/api/groupes/[code]/calendrier.js   le flux .ics des soirées
    functions/api/groupes/[code]/joueurs.js   le nombre de joueurs max (IGDB)
    js/ce-soir.js              « À quoi jouer ce soir » (onglet Soirées)
    js/appli.js                le site comme une appli : service worker, installer, notifications
    sw.js                      le service worker (affiche les notifications), à la racine
    manifest.webmanifest       nom, couleurs et icônes de l'appli installée
    assets/icone.svg           l'icône de l'appli ; icone-192/512/180.png en sont tirées
    functions/_push.js         code SERVEUR : clés VAPID, chiffrement, envoi des notifications
    functions/_evenements.js   code SERVEUR : ce qui se passe dans un groupe, en notifications
    functions/api/push.js      /api/push : la clé du site, s'abonner, se désabonner
    js/reglages.js             la section « Le groupe » (onglet La team)
    js/plus.js                 AllReady+ : la fenêtre de l'offre, le « + »
    functions/_reponses.js     code SERVEUR : répondre à une soirée (site et bot Discord)
    functions/api/discord/interactions.js   le bot Discord : /lier, /dispo, /soirees, boutons
    functions/api/groupes/[code]/bot.js     ajouter le bot à un serveur, le délier
    js/agenda-perso.js         ton agenda Google / Apple / Outlook : la fenêtre, les cases hachurées
    js/presence.js             AllReady+ : les soirées passées, « Qui était là ? »
    js/banniere.js             AllReady+ : la bannière en haut de La team, et son réglage
    js/notifications.js        l'invitation aux notifications, et « Me prévenir »
    allready.apk               l'appli Android à télécharger (voir « L'appli Android »)
    android/twa-manifest.json  sa configuration, pour la refabriquer
    android/icone/             son icône (trois couches), qui remplace celle de Bubblewrap
    assets/icone-monochrome.png   le logo blanc sur transparent (notifications)
    .well-known/assetlinks.json   la preuve que l'appli et le site vont ensemble
    .gitignore                 garde la clé de signature hors du dépôt
    functions/_agenda.js       code SERVEUR : lire un agenda iCal, trouver les créneaux occupés
    functions/api/compte/agenda.js          ranger ou oublier l'adresse de son agenda
    functions/api/groupes/[code]/occupe.js  tes créneaux occupés d'une semaine
    assets/discord.svg         le logo Discord des boutons (en pochoir, voir style.css)
    _headers, robots.txt, assets/favicon.svg, fonts/

## L'appli Android (APK, 6 nov. 2026, demandé)

`allready.apk`, à la racine du site : « Télécharger l'appli Android »,
en bas de l'accueil et dans Le groupe → Sur cet appareil, **sur un
téléphone Android seulement**, et jamais depuis l'appli elle-même
(`androidHorsAppli`, js/appli.js : la page y est en
`display-mode: standalone`). Adresse directe à partager :
`https://dispos.pages.dev/allready.apk`.

- **Ce que c'est** : une « Trusted Web Activity », fabriquée avec
  Bubblewrap (l'outil de Google). L'appli ouvre le site dans Chrome, en
  plein écran, avec l'icône et le nom d'AllReady. Elle ne contient pas
  le site : **une modification du site n'a jamais besoin d'un nouvel
  APK**. Les notifications passent par l'appli (délégation : la
  permission Android « Notifications » de l'appli remplace celle du
  site). Sans Chrome, elle s'ouvre dans un onglet personnalisé.
- **Identité** : `fr.allready.app`, Android 7 (API 24) au minimum (la
  bibliothèque de Google l'exige). Versions : 1.0.0 (code 1, 6 nov.
  2026), puis 1.0.1 (code 2, même jour : l'icône), puis 1.0.2 (code 3,
  même jour : l'appli annonce sa version).
- **Les mises à jour** (1.0.2, demandé : « que je n'aie pas à la
  retélécharger à chaque fois ») : un changement du SITE apparaît
  dans l'appli tout seul, sans rien télécharger. Seul l'emballage
  (icône, nom, couleurs, adresse du site) demande un nouvel APK. Ce
  jour-là, l'appli le dit : elle s'ouvre sur `/?appli=3` (son numéro,
  `startUrl`), la page le retient pour la visite (sessionStorage), et
  s'il est plus petit que `VERSION_APK` (js/appli.js), le bandeau
  « Une nouvelle version de l'appli est prête · Mettre à jour »
  (`#maj-appli`, accueil et page d'un groupe) télécharge l'APK.
  Android l'installe par-dessus (même clé), rien n'est perdu. Les
  versions 1 et 2 ne donnaient pas leur numéro : reconnues à leur
  referrer `android-app://fr.allready.app`. Sans Play Store, Android
  ne laisse aucune appli se mettre à jour toute seule : il faut ce
  clic, puis « Mettre à jour ».
- **L'icône** (1.0.1, demandé : « elle n'a pas de logo ») : une icône
  Android a trois couches, le fond, le logo par-dessus, et une version
  d'une seule couleur pour les icônes « à thème » (Android 13, thèmes
  Samsung). Le modèle de Bubblewrap mettait tout le dessin dans le fond
  et laissait le logo vide : un thème qui remplace le fond par le sien
  (les bulles de verre d'un Samsung) montrait une bulle vide. Nos trois
  couches sont dans `android/icone/` (dessins vectoriels du logo, avec
  les coordonnées de `assets/icone.svg`). La petite icône des
  notifications vient de `assets/icone-monochrome.png`
  (`monochromeIconUrl`), qui sert aussi de `badge` aux notifications du
  site (sw.js) : Android n'en garde que la forme, une image pleine y
  devenait un carré blanc.
- **La clé de signature** (`allready.keystore`, alias `allready`, et
  son mot de passe) : envoyée au propriétaire le 6 nov. 2026, **jamais
  dans le dépôt** (`.gitignore`). Une mise à jour de l'APK doit être
  signée avec la même clé, sinon Android refuse de l'installer
  par-dessus. Clé perdue = nouvelle clé, nouvelle empreinte dans
  assetlinks.json, et chacun désinstalle puis réinstalle.
- **`.well-known/assetlinks.json`** contient le nom de l'appli et
  l'empreinte SHA-256 de cette clé. Android le lit sur le site : s'il
  manque ou ne correspond pas, l'appli marche quand même mais affiche
  une barre d'adresse en haut.
- **Le jour du vrai nom de domaine** : changer `host` (et les adresses)
  dans `android/twa-manifest.json`, mettre assetlinks.json sur le
  nouveau domaine, puis refabriquer l'APK (version suivante).
- **Refabriquer** (nouveau nom, icône, couleurs ou domaine) :
  1. outils (hors du dépôt) : Java 17 (Bubblewrap refuse les autres),
     le kit Android (`platforms;android-36`, `build-tools;36.1.0`, par
     `sdkmanager`, depuis dl.google.com), Bubblewrap
     (`npm install @bubblewrap/cli`), puis `~/.bubblewrap/config.json`
     avec `jdkPath` et `androidSdkPath` ;
  2. copier `android/twa-manifest.json` et la clé dans un dossier de
     travail, augmenter `appVersionCode` de 1 et `appVersion`, mettre
     le même numéro dans `startUrl` (`/?appli=4`) **et dans
     `VERSION_APK` (js/appli.js)**, puis
     `bubblewrap update --skipVersionUpgrade`, **puis recopier
     `android/icone/` dans `app/src/main/res/`** (update remet l'icône
     de Bubblewrap, celle sans logo) ;
  3. un premier `./gradlew assembleRelease` à la main (au premier
     lancement, Gradle télécharge tant de choses que Bubblewrap
     s'étrangle sur son texte : « maxBuffer length exceeded ») ;
  4. `bubblewrap build --skipPwaValidation`, avec les mots de passe
     dans `BUBBLEWRAP_KEYSTORE_PASSWORD` et `BUBBLEWRAP_KEY_PASSWORD` ;
  5. copier `app-release-signed.apk` en `allready.apk`, rapporter le
     nouveau `twa-manifest.json` dans android/, commit et push.

  Dans les sessions cloud de Claude : l'environnement « ShinezeoGame
  (outils Android) » autorise dl.google.com. Le Node de Bubblewrap n'y
  passe pas par le proxy : lui servir l'icône et le manifeste depuis le
  dépôt (`python3 -m http.server`) et pointer `iconUrl`,
  `maskableIconUrl`, `monochromeIconUrl` et `webManifestUrl` vers
  127.0.0.1 le temps de la fabrication.

### Le mode appli (6 nov. 2026, demandé : « je veux une vraie application »)

Le même code, mais ouvert depuis l'appli (Android, ou le site installé
par le navigateur), AllReady prend une allure d'appli. `js/theme.js`,
avant l'affichage, pose la classe `appli` sur `<html>` : affichage
« standalone », ou version de l'appli notée pendant la visite
(`?appli=N` ou referrer `android-app://`, sessionStorage
`allready-appli`). Toutes les règles du mode appli sont dans
style.css, « 14. Le mode appli », et ne valent que sous `.appli` : le
site dans un navigateur ne change pas.

- **Bloc 1, l'ouverture** : la première page de la visite
  (sessionStorage `allready-visite`), si c'est l'accueil, saute au
  dernier groupe ouvert (localStorage `allready-dernier-groupe`, posé
  par groupe.js, effacé par `oublierGroupe()`). Ensuite le logo ramène
  à l'accueil, qui devient la liste de tes groupes : sans la vitrine
  (`.hero`) dès qu'il y a un groupe, sans la phrase du pied de page
  (« Supprimer mon compte » reste : le Play Store exige qu'on puisse
  supprimer son compte depuis l'appli).

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
7. **Le réveil des rappels Discord** : un site Pages ne fait que
   répondre, il ne se réveille jamais seul. Un petit Worker le fait à
   sa place (offre gratuite). Workers & Pages → bouton bleu *Create
   application* (en haut à droite) → *Start with Hello World!*, nom
   `allready-reveil`, *Deploy*. Puis *Edit code*, tout remplacer par ce
   qui suit, *Deploy* :

       // Le réveil d'AllReady : tous les quarts d'heure, demande au
       // site d'envoyer les rappels de soirée (functions/api/rappels.js).
       export default {
         async scheduled(evenement, env, ctx) {
           ctx.waitUntil(fetch('https://dispos.pages.dev/api/rappels', { method: 'POST' }));
         },
       };

   Enfin, dans ce Worker : *Settings* → *Trigger Events* → *Add* →
   *Cron Triggers*,
   `*/15 * * * *` (tous les quarts d'heure). Pas de secret : appeler
   `/api/rappels` en trop n'envoie rien deux fois. Sans ce réveil, les
   annonces marchent, seuls les rappels manquent. Adresse à changer le
   jour du vrai nom de domaine.

8. **Le bot Discord** (AllReady+) : sur discord.com/developers/
   applications, l'application AllReady → *General Information* :
   copier la *Public Key*, la mettre dans le projet Pages (Settings →
   Variables and Secrets) sous le nom `DISCORD_PUBLIC_KEY` (elle n'est
   pas secrète, type *Text* suffit), redéployer. Puis, même page,
   *Interactions Endpoint URL* :
   `https://dispos.pages.dev/api/discord/interactions`, *Save Changes*
   (Discord vérifie aussitôt que l'adresse répond : il faut que le
   redéploiement soit fini). Sans la clé, le réglage « Bot Discord »
   reste caché.

## Ce qui casse si on n'y fait pas attention

- **Le bot refuse toute demande mal signée** (`signatureValable()`,
  Ed25519 avec `DISCORD_PUBLIC_KEY`) : c'est ce qui empêche n'importe
  qui de répondre aux soirées à la place des autres. Ne jamais
  l'enlever, même pour un essai. Discord attend une réponse en moins de
  3 secondes : pas de travail lent dans `interactions.js`.
- **L'adresse iCal d'un agenda est un secret** (qui l'a lit l'agenda) :
  jamais renvoyée, et seulement chez Google, Apple ou Microsoft en https
  (`adresseAgendaValable()`) : jamais une adresse collée telle quelle.
- **Répondre à une soirée passe par `repondreSoiree()`**
  (`functions/_reponses.js`), sur le site comme dans Discord. Une
  nouvelle règle de réponse va là, pas dans une route.

- **La CSP n'a que deux exceptions**, pour Web Analytics :
  `static.cloudflareinsights.com` (script) et `cloudflareinsights.com`
  (envoi des mesures). N'en ajouter aucune autre sans raison : chaque
  domaine autorisé est un domaine qui peut faire tourner du code sur le
  site.

- **L'adresse du webhook Discord est un secret** (qui l'a écrit dans
  le salon) : `groupes.webhook` n'est jamais renvoyé, le chargement du
  groupe ne dit que `groupe.discord` (vrai / faux). `adresseWebhook()`
  reconstruit toujours l'adresse sur `discord.com` : le serveur ne doit
  jamais envoyer de requête vers une adresse collée telle quelle. Tout
  message passe par `envoyer()`, qui interdit les mentions
  (`allowed_mentions`) : sans ça, une soirée « @everyone » ferait
  sonner tout le serveur. Un webhook supprimé dans Discord (401/404)
  débranche le groupe tout seul.
- **Les clés VAPID du site** (table `reglages`, clé `vapid`) sont
  créées toutes seules au premier besoin. **Ne jamais les effacer** :
  chaque abonnement est lié à elles, de nouvelles clés rendraient
  muettes toutes les notifications jusqu'à ce que chacun réactive les
  siennes. Une boîte aux lettres ne peut être que chez Google, Mozilla,
  Apple ou Microsoft (`adressePushValable()`) : jamais une adresse
  collée telle quelle. 404 ou 410 au dépôt = abonnement oublié.
- **`sw.js` reste à la racine du site** : un service worker ne
  s'occupe que des pages rangées sous son dossier. Il ne met rien en
  cache exprès : un cache oublié servirait de vieilles pages.
- **Le numéro de l'appli Android est écrit trois fois** :
  `appVersionCode` et `startUrl` (`/?appli=N`) dans
  `android/twa-manifest.json`, et `VERSION_APK` dans js/appli.js. Les
  changer ensemble, au moment où le nouvel `allready.apk` est poussé :
  `VERSION_APK` plus grand que l'APK publié ferait réclamer sans fin
  une mise à jour introuvable ; plus petit, personne ne serait prévenu.
  Le bandeau `#maj-appli` est au-dessus de l'agenda : il est surveillé
  par le ResizeObserver d'agenda.js, comme l'invitation.
- **Ne jamais toucher à `.well-known/assetlinks.json` sans
  refabriquer l'APK** (et inversement) : l'empreinte doit être celle de
  la clé qui signe l'APK, sinon l'appli Android affiche une barre
  d'adresse. Le dossier commence par un point : le garder tel quel.
- **Les icônes PNG de l'appli sont tirées de `assets/icone.svg`** (le
  logo dans le cercle central, la seule zone qu'un téléphone ne rogne
  jamais) : changer le dessin = refaire les trois PNG, et aussi
  `assets/icone-monochrome.png`, `android/icone/` et l'APK.
- **L'heure, c'est celle du groupe** : jamais `new Date()` ni
  `Date.now()` dans les scripts de la page pour dire « maintenant »,
  toujours `maintenant()` (commun.js) ; côté serveur, toujours
  `heureDuGroupe(groupe.fuseau)`. Le réveil des rappels trie ses
  candidates groupe par groupe, à l'heure de chacun, et recale les
  soirées de chaque semaine fuseau par fuseau (8 fuseaux au plus par
  réveil ; les autres groupes se recalent quand on les ouvre). `recalerHebdos()` efface les réponses et les votes AVANT de
  déplacer la date : dans l'autre ordre, il ne retrouverait plus les
  soirées concernées.
- **Les rappels comptent à l'heure du groupe** (`heureDuGroupe()`) :
  les soirées sont en heure « flottante ». `soirees.rappel` passe à 1 AVANT l'envoi
  (jamais deux fois) et revient à 0 quand la soirée change de jour ou
  d'heure.

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
- **L'icône de l'onglet suit le thème** (2 nov. 2026, demandé) :
  `colorerIcone()` (js/apparence.js) relit `assets/favicon.svg`, y
  remplace l'orange `#ff7a3d` par l'accent du thème et la donne à
  l'onglet en adresse `data:`. Le dessin de favicon.svg doit donc rester
  en `#ff7a3d` exactement (`ORANGE_DU_DESSIN`), sinon le recoloriage ne
  trouve plus rien. Les trois pages chargent apparence.js (404.html
  aussi, rien que pour ça).
- **« Tes groupes » passe avant le reste de l'accueil** (2 nov. 2026,
  demandé : « la première chose qu'on veut faire, c'est y accéder »),
  et **en colonne à droite sur ordinateur** (même jour, demandé : « la
  lecture du site en colonnes », comme les meilleurs créneaux à côté
  de l'agenda). Sur téléphone, en tête de page. Caché sans groupe : un
  nouveau venu garde l'accueil d'avant, pleine largeur. Le titre et les
  cartes Créer / Rejoindre sont dans `.accueil-principal` ; la mise en
  colonnes passe par `.accueil:has(> .mes-groupes:not([hidden]))`.
  Garder la section des groupes en premier dans le HTML : c'est elle
  que le clavier atteint d'abord.
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
  d'abord en orange puis changerait de couleur. Il pose aussi la classe
  `appli` et fait le saut vers le dernier groupe (le mode appli) : pour
  la même raison, rien ne doit s'afficher avant.
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
  (ligne des jours, espaces, coupure de minuit), moins la marge du bas
  de `main` (lue dans le CSS : 1rem sur l'onglet Agenda, au lieu des
  4rem des autres onglets), partagé en 18 lignes. Oublier cette marge
  laissait un petit défilement inutile sur les portables (2 nov. 2026).
  Recalculée au redessin, au redimensionnement, à l'arrivée de la police
  et quand l'onglet réapparaît (ResizeObserver, qui surveille aussi
  l'invitation aux notifications : tout nouvel élément posé au-dessus de
  la grille doit y être ajouté, sinon l'agenda dépasse de l'écran quand
  il apparaît). Ne pas fixer de hauteur
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
  double (commun.js et _outils.js) : les changer ensemble. Les sortes de
  notifications aussi : `TYPES_NOTIFS` (_outils.js) et `NOTIFS`
  (js/notifications.js). `EMOJIS`
  sert aussi à la bannière du groupe. Les fonds de la bannière aussi
  sont en double : `FONDS_BANNIERE` (_outils.js) et `FONDS`
  (js/banniere.js), plus leurs dégradés `--banniere-…` dans style.css.
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
au retour. La vraie connexion ne se teste qu'en ligne. Les webhooks
Discord aussi sont imités (2 nov. 2026) : l'émulateur garde chaque
message reçu et les montre à l'adresse `/__webhooks`. Le service de
notifications de Chrome aussi (`fcm.googleapis.com`, montré à
`/__pushs`) : le test déchiffre chaque dépôt avec sa propre clé.

## Comment travailler avec moi

- Je veux comprendre chaque ligne pour pouvoir modifier ce site seul.
- Un bloc à la fois. Explique en français ce que fait chaque partie et
  pourquoi. Commente le code en français.
- Préviens-moi avant d'installer un outil ou d'ajouter une dépendance.
- À la fin de chaque bloc : capture d'écran du rendu envoyée, puis
  commit et push. **`main` est la branche de référence** (choisi le
  31 octobre 2026) : c'est elle que Cloudflare mettra en ligne.

## Le modèle payant : AllReady+ (décidé le 2 nov. 2026)

L'usage entre amis reste **gratuit et généreux** : une bande de potes
paie rarement pour s'organiser. Le payant vise les groupes plus gros et
plus organisés : guildes de MMO, équipes e-sport, communautés Discord,
streamers qui jouent avec leurs viewers.

- **Un abonnement par groupe**, « AllReady+ », payé par l'organisateur
  pour toute la bande : environ 3 € par mois ou 25 € par an. Un groupe
  se convertit bien mieux qu'un abonnement par personne.
- **Pas de système de paiement au départ** : un abonnement Ko-fi, puis
  l'activation à la main dans la base (`groupes.premium`, comme
  `comptes.soutien`). Stripe seulement si ça prend.
- **Avant de vendre** : un statut (micro-entreprise), des mentions
  légales et des CGV. Ko-fi encaisse, mais les revenus se déclarent.

**Le socle d'AllReady+ (en place)** :
- `groupes.premium` = 1 pour un groupe abonné. **Activer** : Cloudflare
  → D1 → `dispos` → Console,
  `UPDATE groupes SET premium = 1 WHERE code = 'ABCD2345';` (0 pour
  arrêter). Le code est celui que l'abonné donne dans son message Ko-fi.
- `LIEN_PREMIUM` (js/commun.js) : la page d'abonnement. Vide, la
  fenêtre AllReady+ dit « Bientôt disponible » ; remplie, un bouton
  « S'abonner » et la consigne de donner le code du groupe.
- La fenêtre AllReady+ (`js/plus.js`, `ouvrirPlus()`) : les six
  avantages et le prix. Ouverte depuis « Découvrir AllReady+ » dans Le
  groupe ; chaque fonctionnalité réservée l'ouvrira par son « + ».
  Un groupe abonné a un « + » à côté de son nom.
- **15 membres pour un groupe gratuit, 100 en AllReady+**
  (`MAX_MEMBRES` dans _outils.js) ; un groupe déjà plus grand garde
  tout le monde mais n'accueille plus personne.
- **Les organisateurs** (`membres.organisateur`) : en AllReady+, le
  premier membre nomme ou retire des organisateurs (« Nommer
  organisateur » sur leur carte, badge « orga »). Ils gèrent le groupe
  comme lui (`peutGerer()` : renommer, fuseau, Discord, retirer
  quelqu'un) et peuvent modifier ou annuler n'importe quelle soirée.
  Un organisateur ne retire ni le premier membre ni un autre
  organisateur. Sans abonnement, plus aucun droit d'organisateur ; le
  premier membre garde les siens, et seul l'auteur d'une soirée la
  modifie, comme avant.

**Rôles et liste d'attente (en place)** :
- Champ « Rôles » du formulaire (« Tank 2, Heal 2, DPS 6 »,
  `soirees.roles`), grisé avec un « + » dans un groupe gratuit (les
  routes ignorent aussi les rôles envoyés par un groupe gratuit). Les
  places deviennent leur total. Sur la carte, un bouton par rôle à la
  place de « Chaud » (« Tank 1/2 », « Tank · attente » quand il est
  plein), et la compo dans la ligne des réponses. L'auteur n'est pas
  inscrit d'office : il choisit son rôle.
- Liste d'attente (AllReady+, avec ou sans rôles) : une soirée complète
  ne refuse plus, « Liste d'attente ». **Rien n'est rangé** :
  `repartir()` (_outils.js) recalcule à chaque lecture, dans l'ordre
  d'arrivée (`reponses.inscrit_le`), qui joue et qui attend. Un
  désistement ou un départ du groupe fait jouer le suivant tout seul ;
  quand c'est un désistement, il reçoit « Une place s'est libérée ».
  Redire la même chose garde l'heure d'arrivée. Les rappels ne
  préviennent que ceux qui jouent. Renommer ou retirer un rôle remet
  en « Peut-être » ceux qui l'avaient ; retirer tous les rôles garde
  les « Chaud ». Dans un groupe gratuit, une soirée complète refuse
  toujours (« Complet »).

**Le bot Discord (en place)** :
- La même application Discord que la connexion. Dans Le groupe, un
  organisateur clique « Ajouter le bot à ton serveur » (POST
  `[code]/bot` : enregistre les commandes chez Discord, puis ouvre la
  page d'ajout), puis tape dans un salon `/lier code:ABCD2345`, en
  option `role:@Raid`. « Délier » le détache.
- Commandes (`functions/api/discord/interactions.js`) : `/lier`
  (organisateurs du groupe, « Gérer le serveur » côté Discord),
  `/dispo` (comme « Chaud ce soir », `casesDeCeSoir()`), `/soirees`
  (les cinq prochaines, une rangée de boutons chacune ; un bouton par
  rôle s'il y en a). Les boutons passent par `repondreSoiree()`
  (`functions/_reponses.js`), le même code que le site : rôles, liste
  d'attente, place libérée. Le bot ne répond qu'aux membres reliés à
  un compte AllReady ; sinon il les invite à rejoindre le groupe.
- Le rôle choisi avec `/lier` est mentionné dans l'annonce de chaque
  nouvelle soirée (`groupes.discord_role`, et seulement lui).
- `groupes.guild_id` : le serveur relié ('' = aucun). Un serveur ne
  sert qu'un groupe.

**La synchronisation d'agenda (en place)** :
- En mode « Mes dispos », « Synchroniser mon agenda » (avec un « + »
  dans un groupe gratuit) ouvre une fenêtre où coller l'**adresse
  secrète iCal** de Google Agenda, d'Apple (iCloud) ou d'Outlook ; les
  aides disent où la trouver. Pas de connexion Google ni d'autorisation
  à demander. L'adresse appartient au compte (`comptes.agenda_ics`),
  sert dans tous ses groupes AllReady+, et n'est **jamais renvoyée** :
  le groupe ne dit que `compte.agenda` (vrai / faux).
- Les cases où l'agenda a un rendez-vous sont **hachurées**, en mode
  « Mes dispos » seulement, pour soi seul (`js/agenda-perso.js`,
  route `[code]/occupe?semaine=…`, relue à chaque semaine affichée,
  gardée 5 minutes par le navigateur). Seuls les créneaux sortent,
  jamais les titres.
- La lecture (`functions/_agenda.js`) : heures UTC, fuseaux (TZID),
  heures flottantes, répétitions chaque jour ou chaque semaine (BYDAY,
  INTERVAL, COUNT, UNTIL), dates sautées (EXDATE) ou déplacées
  (RECURRENCE-ID), lignes pliées ; les annulés, les « disponible » et
  les journées entières ne comptent pas. Testée sur un faux agenda qui
  a tous ces cas (dans les tests hors dépôt).

**Présence et assiduité (en place)** :
- En bas de l'onglet Soirées, « Passées » (`js/presence.js`) : les
  cinq dernières soirées déjà commencées, 30 jours au plus. Celui qui
  l'a proposée et les organisateurs ont « Qui était là ? » : une case
  par membre, les « Chaud » en tête et cochés d'avance (sans la liste
  d'attente). Une soirée pointée dit « 4 là · absent : Max » pour toute
  la team, avec « Corriger ». Les autres ne voient que les soirées
  pointées ; rien dans un groupe gratuit (`presence: null`).
- Table `presences` (`soiree_id`, `jour`, `membre_id`, `attendu`,
  `venu`) : `jour` dans la clé, parce qu'une soirée de chaque semaine
  garde son numéro et perd ses réponses chaque semaine ; l'historique,
  lui, reste. PUT `soirees/[id]` `{ presents: [ids] }` (`pointer()`).
  **Les attendus sont figés au premier pointage** : passer en « Pas
  dispo » après coup n'efface pas une absence.
- Sur la carte de chacun (La team) : « Fiable à 80 % (8 soirées sur
  10) », venues parmi les soirées pointées où il avait dit « Chaud »,
  à partir de trois seulement.
- Les lignes s'appellent `.finie` : `.passee` est déjà la classe des
  cases passées de l'agenda.

**Thèmes exclusifs et bannière (en place)** :
- Trois thèmes de plus dans la palette, sous « AllReady+ » : Rubis,
  Corail, Nébuleuse. Ils teintent aussi le fond, les cartes et les
  bordures (vin, prune, nuit) ; contrastes notés au-dessus de leurs
  blocs dans style.css. Débloqués pour un **soutien** ou un membre d'**au
  moins un groupe AllReady+** : le serveur le dit (`compte.themes`,
  `themesDebloques()` dans _outils.js, renvoyé par `GET /api/compte` et
  par le chargement du groupe), puis la page appelle
  `debloquerThemes()` (js/apparence.js). Verrouillés, ils montrent un
  « + » : la fenêtre AllReady+ sur la page d'un groupe, un message sur
  l'accueil. Un compte connecté qui n'y a plus droit retombe sur
  Braise ; sans compte, rien n'est retiré (la page ne sait pas qui est
  là).
- **La bannière** : un organisateur choisit un fond (six dégradés, dont
  « Couleurs du site », qui suit le thème de chacun) et un emoji dans Le
  groupe. Elle s'affiche en haut de La team : nom du groupe, nombre de
  membres, grand emoji penché. `groupes.banniere` (`{ fond, emoji }` en
  JSON, '' = aucune), PATCH `[code]` `{ banniere }` (null = retirer),
  vérifiée par `lireBanniere()`. Le serveur ne la renvoie que tant que
  le groupe est abonné : elle revient s'il se réabonne.

**Payant (AllReady+)** :
1. Inscriptions avec rôles (tank / heal / DPS…), liste d'attente et
   composition affichée.
2. Un vrai bot Discord : `/dispo`, `/soirees`, réponses par boutons,
   mention d'un rôle dans les annonces.
3. Synchronisation d'agenda : les créneaux occupés se grisent tout seuls.
4. Grands groupes (gratuit jusqu'à 15 membres) et plusieurs organisateurs.
5. Présence et assiduité : qui vient vraiment, taux de présence.
6. Cosmétique : thèmes exclusifs, bannière de groupe.

**Gratuit, décidé le même jour** : « Chaud ce soir » en un clic, vote
« À quoi on joue ? », jeux possibles ce soir (jeux en commun et nombre
de joueurs), site installable avec notifications, soirées récurrentes,
fuseau horaire par groupe.

## Idées pour la suite (rien de décidé)

- Rappels par e-mail : il faudrait demander l'adresse (permission
  Discord `email`), écarté pour l'instant.
