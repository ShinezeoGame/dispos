/* LES SOIRÉES DANS TON AGENDA — GET /api/groupes/ABCD2345/calendrier
   (2 nov. 2026)

   Un « flux iCalendar » (.ics), le format que lisent Google Agenda
   (« Autres agendas » → « À partir de l'URL »), Apple Calendrier
   (« Nouvel abonnement ») et Outlook. On s'y abonne une fois : l'agenda
   revient lire cette adresse tout seul, de temps en temps (toutes les
   quelques heures chez Google), et les nouvelles soirées y apparaissent.

   Ouvert à qui a le lien du groupe, comme le groupe lui-même : l'adresse
   contient le code, c'est le même secret.

   Les heures sont « flottantes » (sans fuseau) : 21:00 s'affiche 21:00
   dans l'agenda de chacun. Entre amis du même pays, c'est ce qu'on veut. */

import { identifier } from '../../../_outils.js';

// Le texte d'un champ .ics : \ ; , et retours à la ligne s'échappent.
function texteIcs(texte) {
  return String(texte).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// "2026-11-06" + "21:00" → "20261106T210000" ; avec un jour de plus si demandé.
function dateIcs(jour, horaire, joursEnPlus = 0) {
  const date = new Date(`${jour}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + joursEnPlus);
  return date.toISOString().slice(0, 10).replace(/-/g, '') + 'T' + horaire.replace(':', '') + '00';
}

// La fin : l'heure de fin (le lendemain si plus tôt que le début), sinon
// deux heures après le début.
function finIcs(soiree) {
  if (soiree.fin) return dateIcs(soiree.jour, soiree.fin, soiree.fin <= soiree.horaire ? 1 : 0);
  const [h, m] = soiree.horaire.split(':').map(Number);
  const total = h * 60 + m + 120;
  const horaire = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  return dateIcs(soiree.jour, horaire, total >= 24 * 60 ? 1 : 0);
}

// Le format demande des lignes de 75 caractères au plus : au-delà, on
// coupe, et la suite commence par une espace.
function plier(ligne) {
  const morceaux = [];
  for (let i = 0; i < ligne.length; i += 73) morceaux.push((i ? ' ' : '') + ligne.slice(i, i + 73));
  return morceaux.join('\r\n');
}

export async function onRequestGet(context) {
  const { groupe, refus } = await identifier(context, false);
  if (refus) return refus;

  // Les soirées des 30 derniers jours et toutes celles à venir.
  const { results } = await context.env.DB
    .prepare(`SELECT id, titre, jeu, jour, horaire, fin, note, hebdo FROM soirees
              WHERE groupe_id = ? AND jour >= date('now', '-30 days') ORDER BY jour, horaire`)
    .bind(groupe.id)
    .all();

  const maintenant = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lignes = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AllReady//Soirees//FR', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${texteIcs(`${groupe.nom} · AllReady`)}`,
    // Les heures sont « flottantes » (sans fuseau) : X-WR-TIMEZONE dit
    // à Google Agenda et Apple Calendrier de les lire à l'heure du
    // groupe, même chez un membre qui vit dans un autre fuseau.
    `X-WR-TIMEZONE:${groupe.fuseau}`,
  ];
  for (const s of results) {
    lignes.push(
      'BEGIN:VEVENT',
      `UID:soiree-${s.id}@allready`,
      `DTSTAMP:${maintenant}`,
      `DTSTART:${dateIcs(s.jour, s.horaire)}`,
      `DTEND:${finIcs(s)}`,
      // Une soirée de chaque semaine : l'agenda la répète tout seul.
      ...(s.hebdo ? ['RRULE:FREQ=WEEKLY'] : []),
      `SUMMARY:${texteIcs(s.titre)}`,
      `DESCRIPTION:${texteIcs([s.jeu, s.note].filter(Boolean).join('\n'))}`,
      'END:VEVENT',
    );
  }
  lignes.push('END:VCALENDAR');

  return new Response(lignes.map(plier).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // 15 minutes : assez frais, sans recalculer à chaque visite.
      'Cache-Control': 'private, max-age=900',
    },
  });
}
