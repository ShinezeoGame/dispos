/* LES ANNONCES SUR DISCORD (code serveur, partagé) — 2 nov. 2026

   Un groupe peut brancher un salon de son serveur Discord (onglet La
   team → Le groupe, réservé au premier membre). Le site y écrit alors :
   — une nouvelle soirée, dès qu'elle est proposée ;
   — une soirée déplacée (autre jour ou autre heure) ;
   — une soirée annulée ;
   — un rappel moins d'une heure avant, qui mentionne ceux qui ont
     répondu « Chaud » et ont un compte (Discord leur envoie alors une
     notification).

   COMMENT : un « webhook » Discord. C'est une adresse secrète que
   Discord donne pour un salon (paramètres du salon → Intégrations →
   Webhooks) : on lui envoie un message en JSON, il apparaît dans le
   salon. Pas de bot à installer, pas de permission à demander à
   chaque membre. Le revers : qui a l'adresse peut écrire dans le
   salon. Elle reste donc dans la base (groupes.webhook) et n'est
   jamais renvoyée aux navigateurs.

   L'HEURE : les soirées sont en heure « flottante » (21:00, sans
   fuseau), comme l'agenda : c'est l'heure du GROUPE, dont le fuseau est
   rangé dans groupes.fuseau (2 nov. 2026 ; Europe/Paris par défaut).
   heureDuGroupe() dit quelle heure il est là-bas.

   Ce fichier n'exporte aucune fonction onRequest… : Cloudflare n'en
   fait pas une adresse. */


/* 1. L'ADRESSE DU WEBHOOK

   Ce que l'on colle depuis Discord ressemble à :
   https://discord.com/api/webhooks/1234567890123456789/AbC-dEf_…
   (parfois discordapp.com, ou ptb./canary. pour les versions d'essai
   de Discord). On en extrait le numéro et le jeton, puis on reconstruit
   l'adresse nous-mêmes, toujours sur discord.com : le serveur n'enverra
   ainsi jamais de requête ailleurs, quoi qu'on ait collé (sinon, une
   adresse piégée pourrait lui faire appeler n'importe quel site).
   Renvoie l'adresse propre, ou null si ce n'est pas un webhook. */
const FORME_WEBHOOK = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/(\d{5,25})\/([\w-]{20,100})\/?(?:[?#].*)?$/;

export function adresseWebhook(texte) {
  const morceaux = String(texte || '').trim().match(FORME_WEBHOOK);
  return morceaux ? `https://discord.com/api/webhooks/${morceaux[1]}/${morceaux[2]}` : null;
}


/* 2. ENVOYER UN MESSAGE

   username : le message apparaît signé « AllReady », quel que soit le
   nom donné au webhook dans Discord.
   allowed_mentions : { parse: [] } interdit toute mention, sauf les
   personnes listées dans « users ». Sans ça, une soirée intitulée
   « @everyone » ferait sonner tout le serveur.
   Renvoie le code de réponse de Discord (204 = bien reçu), ou 0 si
   Discord n'a pas pu être joint. */
export async function envoyer(adresse, message, mentionner = []) {
  try {
    const reponse = await fetch(adresse, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'AllReady',
        allowed_mentions: { parse: [], users: mentionner },
        ...message,
      }),
    });
    return reponse.status;
  } catch {
    return 0;
  }
}

/* Envoie au salon du groupe. 401 ou 404 : le webhook a été supprimé
   dans Discord. On le débranche alors (« AND webhook = ? » : seulement
   s'il n'a pas été changé entre-temps), pour ne pas réessayer à chaque
   soirée ; le premier membre reverra le champ pour en brancher un. */
export async function envoyerAuGroupe(db, groupe, message, mentionner = []) {
  const statut = await envoyer(groupe.webhook, message, mentionner);
  if (statut === 401 || statut === 404) {
    await db.prepare("UPDATE groupes SET webhook = '' WHERE id = ? AND webhook = ?")
      .bind(groupe.id, groupe.webhook).run();
  }
  return statut;
}


/* 3. LES TEXTES */

// « 21:00 » → « 21h », « 21:30 » → « 21h30 » (comme sur le site).
function joliHoraire(horaire) {
  const [heures, minutes] = horaire.split(':');
  return Number(heures) + 'h' + (minutes === '00' ? '' : minutes);
}

// « vendredi 6 novembre · 21h → 23h ». timeZone UTC : la date est
// fabriquée à minuit UTC, il faut la relire dans le même fuseau, sinon
// elle pourrait reculer d'un jour.
export function texteMoment({ jour, horaire, fin }) {
  const [annee, mois, date] = jour.split('-').map(Number);
  const nomDuJour = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  }).format(Date.UTC(annee, mois - 1, date));
  return `${nomDuJour} · ${joliHoraire(horaire)}${fin ? ' → ' + joliHoraire(fin) : ''}`;
}

/* Le texte écrit par un membre (titre, petit mot) passe dans du
   Markdown Discord : une étoile y met en gras, des crochets font un
   lien… Un antislash devant chaque caractère spécial les affiche tels
   quels. */
export function sansMarkdown(texte) {
  return String(texte).replace(/([\\*_~`|<>[\]()#-])/g, '\\$1');
}

// Le lien vers le groupe : même adresse que le site qui répond.
export function lienDuGroupe(request, code) {
  return `${new URL(request.url).origin}/groupe?g=${code}`;
}

/* Une soirée nouvelle ou déplacée : un « embed », le petit encadré
   coloré de Discord. Rose : la couleur des soirées sur le site. La
   jaquette passe par notre relais (api/couverture) : c'est Discord qui
   la télécharge, pas les membres. */
const ROSE_SOIREE = 0xff4f8b;

function encadreSoiree(request, groupe, soiree) {
  // Un vote : les jeux en lice plutôt qu'un seul.
  const details = soiree.choix?.length > 1
    ? [`Au vote : ${soiree.choix.map((jeu) => jeu.nom).join(', ')}`]
    : [soiree.jeu];
  // Avec des rôles : « Tank 2 · Heal 2 · DPS 6 » plutôt que « 10 places ».
  if (soiree.roles?.length) details.push(...soiree.roles.map((role) => `${role.nom} ${role.places}`));
  else if (soiree.places) details.push(`${soiree.places} places`);
  if (soiree.hebdo) details.push('chaque semaine');
  const lignes = [`**${texteMoment(soiree)}**`, sansMarkdown(details.join(' · '))];
  if (soiree.note) lignes.push('', '> ' + sansMarkdown(soiree.note).replace(/\n/g, '\n> '));
  const encadre = {
    title: soiree.titre,
    url: lienDuGroupe(request, groupe.code),
    description: lignes.join('\n'),
    color: ROSE_SOIREE,
  };
  if (soiree.jeu_cover) {
    encadre.thumbnail = { url: `${new URL(request.url).origin}/api/couverture/${soiree.jeu_cover}` };
  }
  return encadre;
}


/* 4. ANNONCER UNE SOIRÉE

   genre : 'nouvelle', 'deplacee' ou 'annulee'. Appelé par les routes
   des soirées, juste avant de répondre. context.waitUntil() laisse
   l'envoi se finir APRÈS la réponse : la personne qui propose la
   soirée n'attend pas Discord, et une panne de Discord ne l'empêche
   pas de proposer. */
export function annoncerSoiree(context, groupe, genre, soiree, auteur) {
  if (!groupe.webhook) return;
  const { request } = context;
  let message;
  if (genre === 'annulee') {
    message = {
      content: `❌ **${sansMarkdown(soiree.titre)}** (${texteMoment({ ...soiree, fin: '' })}) est annulée.`,
    };
  } else {
    const enTete = genre === 'nouvelle'
      ? `🎮 Nouvelle soirée proposée par **${sansMarkdown(auteur)}**`
      : `📅 **${sansMarkdown(auteur)}** a déplacé la soirée : les réponses repartent de zéro.`;
    message = { content: enTete, embeds: [encadreSoiree(request, groupe, soiree)] };
  }
  context.waitUntil(envoyerAuGroupe(context.env.DB, groupe, message));
}


/* 5. L'HEURE DU GROUPE

   « 2026-11-06 21:00 » : l'heure qu'il est (ou qu'il sera dans
   dansMinutes minutes) dans le fuseau du groupe (« Europe/Paris »,
   « America/Montreal »…). Même forme que jour + ' ' + horaire dans la
   base : deux textes de cette forme se comparent comme des dates
   (« 2026-11-06 21:00 » < « 2026-11-06 22:00 »). Intl connaît les
   fuseaux du monde entier et les changements d'heure été / hiver. */
export function heureDuGroupe(fuseau = 'Europe/Paris', dansMinutes = 0) {
  const parties = new Intl.DateTimeFormat('fr-FR', {
    timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(Date.now() + dansMinutes * 60000);
  const p = Object.fromEntries(parties.map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
