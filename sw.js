/* LE SERVICE WORKER D'ALLREADY (2 nov. 2026)

   Un petit script que le navigateur garde de côté et réveille même
   quand le site est fermé. Il ne sert qu'aux notifications :
   — « push » : un message arrive du serveur (functions/_push.js), déjà
     déchiffré par le navigateur ; on l'affiche ;
   — « notificationclick » : un toucher sur la notification ouvre la
     bonne page du site (ou y revient si elle est déjà ouverte).

   Il ne met rien en cache : le site reste toujours à jour, et sans
   connexion il ne s'ouvre pas, comme avant. Sa présence suffit, avec
   manifest.webmanifest, pour que le navigateur propose d'installer le
   site comme une appli.

   À la racine du site (et non dans js/) : un service worker ne
   s'occupe que des pages rangées sous son propre dossier. */

// Une nouvelle version prend la place de l'ancienne sans attendre.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evenement) => evenement.waitUntil(self.clients.claim()));

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
