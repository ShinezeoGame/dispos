/* LE SERVICE WORKER D'ALLREADY (2 nov. 2026, puis mode appli, 6 nov.)

   Un petit script que le navigateur garde de côté et réveille même
   quand le site est fermé. Trois rôles :
   — « push » : un message arrive du serveur (functions/_push.js), déjà
     déchiffré par le navigateur ; on l'affiche ;
   — « notificationclick » : un toucher sur la notification ouvre la
     bonne page du site (ou y revient si elle est déjà ouverte) ;
   — « fetch » (6 nov. 2026, mode appli) : sans réseau, l'appli montre
     les dernières infos connues au lieu d'une page d'erreur.

   LE RÉSEAU D'ABORD, TOUJOURS. Chaque demande part au serveur, comme
   avant ; la réponse est rendue à la page ET gardée en copie. La copie
   ne sert que si le serveur ne répond pas (pas de réseau). Ainsi le
   site n'est jamais servi « en retard » : avec du réseau, tout est
   frais ; sans réseau, c'est la dernière version vue. (La règle d'avant
   était « aucun cache », par peur des vieilles pages : le réseau
   d'abord l'évite.)

   Ce qui est gardé : les pages, le style, les scripts, les polices et
   images du site ; et, de l'API, seulement de quoi AFFICHER : un
   groupe (avec sa semaine), ton compte et tes groupes, les photos et
   les jaquettes. Rien d'autre (aucune réponse à une action), et jamais
   une demande qui modifie (POST, PUT…) : sans réseau, elle échoue, et
   la page le dit (« Impossible de joindre le serveur »).

   Se déconnecter efface les données gardées (CACHE_DONNEES, même nom
   dans js/commun.js) : un autre compte, sur le même téléphone, ne doit
   pas voir les tiennes.

   À la racine du site (et non dans js/) : un service worker ne
   s'occupe que des pages rangées sous son propre dossier. */

const CACHE_PAGES = 'allready-pages';     // pages, style, scripts, polices, images
const CACHE_DONNEES = 'allready-donnees'; // les réponses de l'API gardées (voir DONNEES)

/* Les adresses de l'API dont on garde une copie : lire un groupe
   (/api/groupes/ABCD2345?semaine=…), ton compte et tes groupes, les
   photos de profil et les jaquettes. */
const DONNEES = [
  /^\/api\/groupes\/[A-Z0-9]{8}$/,
  /^\/api\/compte$/,
  /^\/api\/groupes\/[A-Z0-9]{8}\/photos\/\d+$/,
  /^\/api\/couverture\/[\w-]+$/,
];

/* Gardé dès l'installation : la page « Pas de connexion » et ce qu'il
   lui faut pour s'afficher. Le reste se garde au fil des visites. */
const DES_LE_DEPART = [
  '/hors-ligne', '/css/style.css', '/js/theme.js', '/assets/favicon.svg',
  '/fonts/chakra-petch-600.woff2', '/fonts/chakra-petch-700.woff2',
];

// Une nouvelle version prend la place de l'ancienne sans attendre,
// après avoir gardé la page « Pas de connexion ».
self.addEventListener('install', (evenement) => {
  evenement.waitUntil(caches.open(CACHE_PAGES).then((cache) => cache.addAll(DES_LE_DEPART)).then(() => self.skipWaiting()));
});
// En prenant la main : les caches d'un autre nom (d'une ancienne version) sont effacés.
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom !== CACHE_PAGES && nom !== CACHE_DONNEES) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

/* LES DEMANDES DE LA PAGE. On ne s'occupe que des lectures (GET) du
   site lui-même ; dans l'API, seulement des adresses de DONNEES. Tout
   le reste passe tel quel, sans copie. */
self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('.apk')) return; // l'appli Android (1 Mo) : jamais en double
  const donnee = url.pathname.startsWith('/api/');
  if (donnee && !DONNEES.some((motif) => motif.test(url.pathname))) return;
  evenement.respondWith(reseauDAbord(requete, donnee ? CACHE_DONNEES : CACHE_PAGES));
});

/* Une page se garde sous son adresse SANS ce qui suit le « ? » : le
   même groupe.html sert pour tous les groupes (/groupe?g=…), et
   l'accueil ouvert par l'appli (/?appli=3) est l'accueil. Les données,
   elles, gardent leur adresse complète (un groupe, une semaine). */
function cle(requete) {
  if (requete.mode !== 'navigate') return requete;
  const url = new URL(requete.url);
  return new Request(url.origin + url.pathname);
}

async function reseauDAbord(requete, nomCache) {
  const cache = await caches.open(nomCache);
  try {
    const reponse = await fetch(requete);
    /* Seule une bonne réponse est gardée : pas une erreur (404, 500),
       pas une redirection (le navigateur refuserait de la resservir). */
    if (reponse.ok && !reponse.redirected) cache.put(cle(requete), reponse.clone());
    return reponse;
  } catch (probleme) {
    // Pas de réseau : la dernière copie, sinon la page « Pas de connexion ».
    const copie = await cache.match(cle(requete));
    if (copie) return copie;
    if (requete.mode === 'navigate') {
      const horsLigne = await caches.match('/hors-ligne');
      if (horsLigne) return horsLigne;
    }
    throw probleme; // la page reçoit l'échec : « Impossible de joindre le serveur »
  }
}

self.addEventListener('push', (evenement) => {
  let message = {};
  try {
    message = evenement.data ? evenement.data.json() : {};
  } catch {
    message = { corps: evenement.data.text() };
  }
  // tag : une notification de même tag remplace la précédente au lieu
  // de s'empiler (la même soirée annoncée deux fois, par exemple).
  evenement.waitUntil(self.registration.showNotification(message.titre || 'AllReady', {
    body: message.corps || '',
    icon: '/assets/icone-192.png',
    // La petite icône de la barre d'état d'Android (6 nov. 2026) : le
    // téléphone n'en garde que la forme (les parties transparentes), d'où
    // ce logo blanc sur fond transparent. Sans elle, Chrome y met la sienne.
    badge: '/assets/icone-monochrome.png',
    tag: message.tag,
    lang: 'fr',
    data: { url: message.url || '/' },
  }));
});

self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  const adresse = new URL(evenement.notification.data?.url || '/', self.location.origin).href;
  evenement.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const ouverte = fenetres.find((fenetre) => fenetre.url === adresse);
    if (ouverte) return ouverte.focus();
    return self.clients.openWindow(adresse);
  })());
});
