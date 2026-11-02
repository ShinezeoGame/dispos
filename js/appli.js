/* LE SITE COMME UNE APPLI (2 nov. 2026)

   Chargé par l'accueil et la page d'un groupe. Trois choses :
   1. enregistrer le service worker (sw.js), sans lequel ni
      l'installation ni les notifications ne marchent ;
   2. « Installer l'appli » : Chrome, Edge et Android préviennent
      (beforeinstallprompt) qu'on peut installer le site ; on garde
      cette invitation pour la montrer au bon moment, sur un bouton. Sur
      iPhone, pas d'invitation : on ajoute le site à la main (Partager →
      « Sur l'écran d'accueil ») ;
   3. les notifications : demander l'accord, ouvrir la « boîte aux
      lettres » chez le service du navigateur et la donner au serveur
      (functions/api/push.js), ou tout couper. Sur iPhone, elles
      n'existent qu'une fois le site ajouté à l'écran d'accueil. */

import { api } from './commun.js';

// 1. Le service worker. Sans navigateur compatible : null, et le reste se cache.
const travailleur = 'serviceWorker' in navigator
  ? navigator.serviceWorker.register('/sw.js').catch(() => null)
  : Promise.resolve(null);

/* Les parties de la page qui affichent ces boutons s'abonnent ici
   (quandAppliChange) : elles se redessinent quand l'invitation arrive
   ou quand les notifications changent. */
const abonnes = new Set();
export function quandAppliChange(fonction) {
  abonnes.add(fonction);
}
const prevenir = () => abonnes.forEach((fonction) => fonction());

// 2. L'installation.
let invitation = null;
window.addEventListener('beforeinstallprompt', (evenement) => {
  evenement.preventDefault(); // pas de bandeau du navigateur : notre bouton
  invitation = evenement;
  prevenir();
});
window.addEventListener('appinstalled', () => {
  invitation = null;
  prevenir();
});
export const peutInstaller = () => invitation !== null;
export async function installer() {
  const invitationGardee = invitation;
  invitation = null; // une invitation ne sert qu'une fois
  if (invitationGardee) await invitationGardee.prompt();
  prevenir();
}

// Un iPhone ou un iPad où le site n'est pas encore ajouté à l'écran d'accueil.
export const iphoneHorsAppli = /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone;

// 3. Les notifications.
export const notificationsPossibles = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function abonnementActuel() {
  const enregistrement = await travailleur;
  return enregistrement ? enregistrement.pushManager.getSubscription() : null;
}

// La clé du serveur arrive en base64url ; le navigateur la veut en octets.
function enOctets(base64url) {
  const brut = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64url.length + 3) % 4));
  return Uint8Array.from(brut, (lettre) => lettre.charCodeAt(0));
}

/* userVisibleOnly : on promet au navigateur que chaque message reçu
   s'affichera (il l'exige). toJSON() donne { endpoint, keys: { p256dh,
   auth } }, exactement ce que le serveur range. */
export async function activerNotifications() {
  if (await Notification.requestPermission() !== 'granted') {
    throw new Error('Notifications refusées. Autorise-les pour ce site dans les réglages du navigateur.');
  }
  const enregistrement = await navigator.serviceWorker.ready;
  const { cle } = await api('/push');
  const abonnement = await enregistrement.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: enOctets(cle) });
  await api('/push', { methode: 'POST', corps: abonnement.toJSON() });
  prevenir();
}

export async function couperNotifications() {
  const abonnement = await abonnementActuel();
  if (abonnement) {
    await api('/push', { methode: 'DELETE', corps: { endpoint: abonnement.endpoint } });
    await abonnement.unsubscribe();
  }
  prevenir();
}
