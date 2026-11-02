/* LES NOTIFICATIONS PUSH (code serveur, partagé) — 2 nov. 2026

   Une notification « push » arrive sur le téléphone ou l'ordinateur
   même quand le site est fermé. Le chemin :
   1. le navigateur, avec ton accord, ouvre une « boîte aux lettres »
      chez son service de notifications (Google pour Chrome, Mozilla
      pour Firefox, Apple pour Safari) et nous en donne l'adresse
      (endpoint) et deux clés (p256dh, auth). On les range dans la table
      abonnements, rattachés à ton compte (functions/api/push.js) ;
   2. pour te prévenir, le serveur chiffre le message avec ces clés et
      le dépose dans la boîte aux lettres (deposer) ;
   3. le service le livre à ton appareil, où sw.js (le service worker)
      l'affiche.

   Deux sécurités, prévues par la norme :
   — le message est CHIFFRÉ (RFC 8291) : le service de Google ou
     d'Apple le transporte sans pouvoir le lire ;
   — le serveur SIGNE chaque dépôt avec sa clé (VAPID, RFC 8292) : une
     boîte aux lettres n'accepte que les messages du site qui l'a
     ouverte.

   Tout est fait avec crypto.subtle, la cryptographie déjà présente
   dans Cloudflare (et dans les navigateurs) : aucune bibliothèque.

   Ce fichier n'exporte aucune fonction onRequest… : Cloudflare n'en
   fait pas une adresse. */

const texteEnOctets = new TextEncoder();


/* 1. PETITS OUTILS

   Le « base64url » : des octets écrits en lettres, chiffres, - et _
   (sans + / =, qui gêneraient dans une adresse). C'est la forme des
   clés que donne le navigateur. */
export function base64url(octets) {
  let texte = '';
  for (const octet of new Uint8Array(octets)) texte += String.fromCharCode(octet);
  return btoa(texte).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function depuisBase64url(texte) {
  // On remet les = de fin qu'il faut à atob (la longueur doit être un multiple de 4).
  const brut = atob(texte.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((texte.length + 3) % 4));
  return Uint8Array.from(brut, (lettre) => lettre.charCodeAt(0));
}

// Colle plusieurs suites d'octets bout à bout.
function coller(...morceaux) {
  const resultat = new Uint8Array(morceaux.reduce((total, morceau) => total + morceau.length, 0));
  let position = 0;
  for (const morceau of morceaux) {
    resultat.set(morceau, position);
    position += morceau.length;
  }
  return resultat;
}


/* 2. LES CLÉS DU SITE (VAPID)

   Une paire de clés propre au site : la publique est donnée aux
   navigateurs (GET /api/push), la privée signe nos dépôts. Créée toute
   seule au premier besoin et rangée dans la table reglages : rien à
   régler dans Cloudflare. INSERT OR IGNORE puis relecture : si deux
   requêtes la créent en même temps, une seule paire est gardée, et
   tout le monde utilise celle-là. Gardée en mémoire ensuite. */
let clesEnMemoire = null;

export async function clesVapid(db) {
  if (clesEnMemoire) return clesEnMemoire;
  const lire = () => db.prepare("SELECT valeur FROM reglages WHERE cle = 'vapid'").first();
  let ligne = await lire();
  if (!ligne) {
    const paire = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const valeur = JSON.stringify({
      prive: await crypto.subtle.exportKey('jwk', paire.privateKey),
      publique: base64url(await crypto.subtle.exportKey('raw', paire.publicKey)),
    });
    await db.prepare("INSERT OR IGNORE INTO reglages (cle, valeur) VALUES ('vapid', ?)").bind(valeur).run();
    ligne = await lire();
  }
  const { prive, publique } = JSON.parse(ligne.valeur);
  clesEnMemoire = {
    publique,
    prive: await crypto.subtle.importKey('jwk', prive, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']),
  };
  return clesEnMemoire;
}

/* La signature d'un dépôt : un petit jeton (JWT) qui dit « pour ce
   service de notifications (aud), valable 12 heures (exp), de la part
   de ce site (sub) », signé avec la clé privée. */
export async function jetonVapid(cles, adresse, site) {
  const encoder = (objet) => base64url(texteEnOctets.encode(JSON.stringify(objet)));
  const debut = `${encoder({ typ: 'JWT', alg: 'ES256' })}.${encoder({
    aud: new URL(adresse).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: site,
  })}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cles.prive, texteEnOctets.encode(debut));
  return `${debut}.${base64url(signature)}`;
}


/* 3. LE CHIFFREMENT (RFC 8291, « aes128gcm »)

   1. une paire de clés jetable, juste pour ce message ;
   2. avec la clé publique du navigateur (p256dh), elle donne un secret
      partagé (ECDH) : seul ce navigateur pourra refaire le calcul ;
   3. ce secret, mêlé au secret d'authentification (auth) et à un « sel »
      tiré au hasard (HKDF), donne la clé de chiffrement et le nonce ;
   4. on chiffre (AES-GCM) le message suivi de l'octet 2 (« dernier
      morceau ») ;
   5. on envoie : le sel, la taille des morceaux (4096), la clé
      publique jetable, puis le message chiffré.

   « essai » sert seulement aux tests : il impose le sel et la paire
   jetable, pour retrouver à l'octet près l'exemple de la RFC. */
export async function chiffrer(texte, p256dh, auth, essai = {}) {
  const cleNavigateur = depuisBase64url(p256dh); // 65 octets
  const secretAuth = depuisBase64url(auth);       // 16 octets
  const sel = essai.sel || crypto.getRandomValues(new Uint8Array(16));
  const jetable = essai.paire
    || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publiqueJetable = new Uint8Array(await crypto.subtle.exportKey('raw', jetable.publicKey));

  const publiqueNavigateur = await crypto.subtle.importKey('raw', cleNavigateur, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const partage = await crypto.subtle.deriveBits({ name: 'ECDH', public: publiqueNavigateur }, jetable.privateKey, 256);

  // HKDF : à partir d'un matériau secret et d'un sel, fabrique « octets »
  // octets pour un usage donné (info), toujours les mêmes pour les mêmes entrées.
  const hkdf = async (selHkdf, materiau, info, octets) => {
    const cle = await crypto.subtle.importKey('raw', materiau, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: selHkdf, info }, cle, octets * 8));
  };
  const melange = await hkdf(secretAuth, partage,
    coller(texteEnOctets.encode('WebPush: info\0'), cleNavigateur, publiqueJetable), 32);
  const cleContenu = await hkdf(sel, melange, texteEnOctets.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sel, melange, texteEnOctets.encode('Content-Encoding: nonce\0'), 12);

  const cleAes = await crypto.subtle.importKey('raw', cleContenu, 'AES-GCM', false, ['encrypt']);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cleAes,
    coller(texteEnOctets.encode(texte), new Uint8Array([2]))));

  const entete = new Uint8Array(16 + 4 + 1 + publiqueJetable.length);
  entete.set(sel, 0);
  new DataView(entete.buffer).setUint32(16, 4096); // taille des morceaux
  entete[20] = publiqueJetable.length;
  entete.set(publiqueJetable, 21);
  return coller(entete, chiffre);
}


/* 4. DÉPOSER UN MESSAGE

   message = { titre, corps, url, tag } : ce que sw.js affichera. TTL :
   le service garde le message un jour si l'appareil est éteint. 404 ou
   410 : la boîte aux lettres n'existe plus (notifications coupées,
   navigateur désinstallé) ; on l'oublie.

   Les boîtes aux lettres acceptées : https, chez un service connu. Sans
   cette liste, une fausse « boîte » pourrait faire envoyer au serveur
   des requêtes vers n'importe quelle adresse. */
const SERVICES = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;

export function adressePushValable(adresse) {
  try {
    const url = new URL(adresse);
    return url.protocol === 'https:' && SERVICES.test(url.hostname);
  } catch {
    return false;
  }
}

async function deposer(db, cles, site, abonnement, message) {
  if (!adressePushValable(abonnement.endpoint)) return 0;
  try {
    const reponse = await fetch(abonnement.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${await jetonVapid(cles, abonnement.endpoint, site)}, k=${cles.publique}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
      },
      body: await chiffrer(JSON.stringify(message), abonnement.p256dh, abonnement.auth),
    });
    if (reponse.status === 404 || reponse.status === 410) {
      await db.prepare('DELETE FROM abonnements WHERE endpoint = ?').bind(abonnement.endpoint).run();
    }
    return reponse.status;
  } catch (probleme) {
    console.error('push', probleme);
    return 0;
  }
}

/* Les appareils abonnés de ces comptes (leurs id), en une requête
   (json_each : toute la liste dans un seul paramètre). */
export async function abonnementsDe(db, compteIds) {
  if (!compteIds.length) return [];
  const { results } = await db
    .prepare('SELECT compte_id, endpoint, p256dh, auth FROM abonnements WHERE compte_id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(compteIds))
    .all();
  return results;
}

/* Déposer le même message dans plusieurs boîtes aux lettres. site :
   l'adresse du site (https://dispos.pages.dev), la signature VAPID la
   demande. Renvoie le nombre de messages bien déposés. */
export async function envoyerA(db, site, abonnements, message) {
  if (!abonnements.length) return 0;
  const cles = await clesVapid(db);
  const statuts = await Promise.all(abonnements.map((abonnement) => deposer(db, cles, site, abonnement, message)));
  return statuts.filter((statut) => statut >= 200 && statut < 300).length;
}

// Prévenir des comptes sur tous leurs appareils abonnés.
export async function notifierComptes(db, site, compteIds, message) {
  return envoyerA(db, site, await abonnementsDe(db, compteIds), message);
}

/* Prévenir tout le groupe sauf une personne (celle qui vient d'agir),
   après la réponse (waitUntil), comme les annonces Discord. */
export function notifierGroupe(context, groupe, saufMembreId, message) {
  const db = context.env.DB;
  const site = new URL(context.request.url).origin;
  context.waitUntil((async () => {
    const { results } = await db
      .prepare('SELECT DISTINCT compte_id FROM membres WHERE groupe_id = ? AND id != ? AND compte_id IS NOT NULL')
      .bind(groupe.id, saufMembreId)
      .all();
    await notifierComptes(db, site, results.map((rangee) => rangee.compte_id), message);
  })().catch((probleme) => console.error('push', probleme)));
}
