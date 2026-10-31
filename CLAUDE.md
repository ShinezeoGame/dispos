# Dispos

## Le projet

Site pour savoir quand ses amis sont dispos et à quoi jouer ensemble.
Ambiance gaming, mais simple à utiliser. Commencé le 31 octobre 2026.
D'autres idées viendront une fois le site en ligne.

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

## Décisions déjà prises

- HTML + CSS + JavaScript sans framework, sans étape de construction.
  Modules ES (`<script type="module">`), un fichier par partie d'écran.
- **Pas de compte, pas de mot de passe.** Le code du groupe (8 caractères)
  est dans le lien ; chaque membre reçoit un jeton secret gardé dans son
  `localStorage` (clé `dispos`). La base ne stocke que l'empreinte SHA-256
  du jeton. Le « lien perso » (`…#moi=jeton`) sert à se retrouver sur un
  autre appareil ; groupe.js l'efface de la barre d'adresse.
- **Hébergement prévu : Cloudflare Pages + Functions + D1** (base SQLite
  de Cloudflare), comme le portfolio pour la partie Pages. Pas encore
  branché. KV écarté : ses écritures mettent jusqu'à une minute à se
  propager, trop lent pour un agenda partagé.
- Thème sombre seulement. Accent vert citron `#b5f23d` (dispo, action),
  rose `#ff5fd2` pour tout ce qui touche aux soirées.
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
