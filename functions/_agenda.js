/* LA SYNCHRONISATION D'AGENDA (code serveur, partagé) — AllReady+, 2 nov. 2026

   Google Agenda, Apple Calendrier et Outlook donnent chacun une
   « adresse secrète au format iCal » : une adresse qui sert la liste de
   tes rendez-vous, sans connexion ni mot de passe. Tu la colles une
   fois dans AllReady (functions/api/compte/agenda.js) ; ensuite, pour
   la semaine affichée, le serveur lit ce fichier et dit quelles cases
   de l'agenda tombent sur un rendez-vous (functions/api/groupes/[code]/
   occupe.js). La page les hachure en mode « Mes dispos ».

   Le fichier (format iCalendar, RFC 5545) est une suite de lignes
   « NOM;PARAMÈTRES:VALEUR », par blocs BEGIN:VEVENT … END:VEVENT. Ce
   qu'on en lit :
   — DTSTART / DTEND (ou DURATION) : début et fin, en heure UTC (…Z),
     dans un fuseau (TZID=Europe/Paris) ou « flottante » ;
   — RRULE : la répétition, chaque jour ou chaque semaine (les plus
     courantes : cours, travail, entraînement), EXDATE (les dates
     sautées) et RECURRENCE-ID (une seule date déplacée) ;
   — STATUS:CANCELLED (annulé) et TRANSP:TRANSPARENT (« disponible »)
     ne comptent pas ; les événements « toute la journée » non plus
     (anniversaires, jours fériés : ils ne disent pas qu'on est pris).

   L'adresse est un secret (qui l'a lit ton agenda) : elle reste dans la
   base (comptes.agenda_ics) et n'est jamais renvoyée à personne. Seuls
   les créneaux occupés sortent, jamais le titre d'un rendez-vous.

   Ce fichier n'exporte aucune fonction onRequest… : Cloudflare n'en
   fait pas une adresse. */


/* 1. L'ADRESSE

   Seulement chez Google, Apple (iCloud) ou Microsoft, en https :
   sinon, une adresse piégée pourrait faire appeler n'importe quel site
   par le serveur. « webcal:// » (le lien d'abonnement d'Apple) est la
   même adresse en https://. Renvoie l'adresse propre, ou null. */
const HOTES = /(^|\.)(calendar\.google\.com|icloud\.com|outlook\.live\.com|outlook\.office365\.com|outlook\.office\.com)$/;

export function adresseAgendaValable(texte) {
  try {
    const url = new URL(String(texte || '').trim().replace(/^webcal:\/\//i, 'https://'));
    if (url.protocol !== 'https:' || !HOTES.test(url.hostname) || url.href.length > 1000) return null;
    return url.href;
  } catch {
    return null;
  }
}

/* Lire le fichier : 2 Mo au plus (un agenda de plusieurs années tient
   largement), et il doit commencer comme un fichier iCalendar. */
export async function lireAgenda(adresse) {
  const reponse = await fetch(adresse, { headers: { Accept: 'text/calendar' } });
  if (!reponse.ok) throw new Error(`L'agenda a répondu ${reponse.status}.`);
  const texte = (await reponse.text()).slice(0, 2_000_000);
  if (!texte.trimStart().startsWith('BEGIN:VCALENDAR')) throw new Error("Ce n'est pas un agenda iCal.");
  return texte;
}


/* 2. LES FUSEAUX

   Une heure « murale » (celle qu'affiche une horloge à Paris) dans un
   fuseau → l'instant exact (millisecondes UTC). Intl sait dire quelle
   heure il est dans un fuseau à un instant donné : on part de l'heure
   murale comme si c'était de l'UTC, on mesure l'écart, on corrige, et
   on recommence une fois pour les jours de changement d'heure. Un
   fuseau inconnu (Outlook écrit parfois « Romance Standard Time ») :
   celui du groupe. */
function partiesDans(instant, fuseau) {
  const parties = new Intl.DateTimeFormat('en-US', {
    timeZone: fuseau, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(instant);
  return Object.fromEntries(parties.map(({ type, value }) => [type, Number(value)]));
}

function fuseauConnu(fuseau, parDefaut) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: fuseau });
    return fuseau;
  } catch {
    return parDefaut;
  }
}

function versInstant(mur, fuseau) {
  const naif = Date.UTC(mur.an, mur.mois - 1, mur.jour, mur.h, mur.m, mur.s);
  const ecart = (instant) => {
    const p = partiesDans(instant, fuseau);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant;
  };
  const essai = naif - ecart(naif);
  return naif - ecart(essai);
}


/* 3. LE FICHIER

   Les lignes longues sont « pliées » : une ligne qui commence par une
   espace continue la précédente. On les déplie, puis on range chaque
   VEVENT en { NOM: [{ params, valeur }, …] } (un même nom peut revenir :
   plusieurs EXDATE). */
function lireEvenements(ics) {
  const lignes = ics.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const evenements = [];
  let courant = null;
  for (const ligne of lignes) {
    if (ligne === 'BEGIN:VEVENT') courant = {};
    else if (ligne === 'END:VEVENT') {
      if (courant) evenements.push(courant);
      courant = null;
    } else if (courant) {
      const deuxPoints = ligne.indexOf(':');
      if (deuxPoints < 0) continue;
      const [nom, ...parametres] = ligne.slice(0, deuxPoints).split(';');
      const params = Object.fromEntries(parametres.map((p) => p.split('=')).map(([cle, valeur]) => [cle.toUpperCase(), valeur]));
      (courant[nom.toUpperCase()] ||= []).push({ params, valeur: ligne.slice(deuxPoints + 1) });
    }
  }
  return evenements;
}

/* Une date du fichier → { mur, fuseau, journee } : l'heure murale, le
   fuseau où la lire (UTC pour « …Z », celui du TZID, ou celui du
   groupe pour une heure flottante), et « journée entière ». */
function lireDate(propriete, fuseauGroupe) {
  const valeur = propriete.valeur.trim();
  const trouve = valeur.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!trouve) return null;
  const [, an, mois, jour, h, m, s, utc] = trouve;
  const mur = { an: +an, mois: +mois, jour: +jour, h: +(h || 0), m: +(m || 0), s: +(s || 0) };
  const journee = propriete.params.VALUE === 'DATE' || h === undefined;
  const fuseau = utc ? 'UTC' : fuseauConnu(propriete.params.TZID || fuseauGroupe, fuseauGroupe);
  return { mur, fuseau, journee };
}

// « PT1H30M », « P1D » → des millisecondes.
function lireDuree(texte) {
  const t = String(texte).match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!t) return 3600000;
  const [, sem, j, h, m, s] = t.map((x) => Number(x || 0));
  return ((((sem * 7 + j) * 24 + h) * 60 + m) * 60 + s) * 1000;
}


/* 4. LES RÉPÉTITIONS (RRULE)

   Chaque jour (FREQ=DAILY) ou chaque semaine (FREQ=WEEKLY, avec ses
   jours BYDAY=MO,WE), tous les INTERVAL jours ou semaines, jusqu'à
   UNTIL ou pendant COUNT fois. On avance jour par jour en heure murale,
   dans le fuseau de l'événement : un cours à 18 h reste à 18 h après le
   changement d'heure. Les autres répétitions (chaque mois, chaque
   année) ne gardent que leur première date. On s'arrête après la
   semaine voulue (limite) et au bout de 4 000 jours (onze ans). */
const JOURS_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function* occurrences(debut, regle, limite) {
  if (!regle || !['DAILY', 'WEEKLY'].includes(regle.FREQ)) {
    yield versInstant(debut.mur, debut.fuseau);
    return;
  }
  const intervalle = Math.max(1, Number(regle.INTERVAL || 1));
  const compte = regle.COUNT ? Number(regle.COUNT) : Infinity;
  const jusqua = regle.UNTIL ? (() => {
    const d = lireDate({ params: {}, valeur: regle.UNTIL }, 'UTC');
    return d ? versInstant({ ...d.mur, h: d.journee ? 23 : d.mur.h, m: d.journee ? 59 : d.mur.m }, d.fuseau) : Infinity;
  })() : Infinity;
  const premierJour = Date.UTC(debut.mur.an, debut.mur.mois - 1, debut.mur.jour);
  const jourSemaineDebut = new Date(premierJour).getUTCDay();
  const joursVoulus = regle.BYDAY
    ? regle.BYDAY.split(',').map((j) => JOURS_ICS.indexOf(j.replace(/^[+-]?\d+/, ''))).filter((j) => j >= 0)
    : [jourSemaineDebut];
  // La semaine (du lundi) du premier jour, pour compter les semaines.
  const lundiDebut = premierJour - ((jourSemaineDebut + 6) % 7) * 86400000;
  let faites = 0;
  for (let i = 0; i < 4000 && faites < compte; i++) {
    const jour = premierJour + i * 86400000;
    const date = new Date(jour);
    let retenu;
    if (regle.FREQ === 'DAILY') retenu = i % intervalle === 0;
    else {
      const semaine = Math.floor((jour - lundiDebut) / (7 * 86400000));
      retenu = semaine % intervalle === 0 && joursVoulus.includes(date.getUTCDay());
    }
    if (!retenu) continue;
    const instant = versInstant({ ...debut.mur, an: date.getUTCFullYear(), mois: date.getUTCMonth() + 1, jour: date.getUTCDate() }, debut.fuseau);
    if (instant > jusqua || instant > limite) return;
    faites += 1;
    yield instant;
  }
}


/* 5. LES CASES OCCUPÉES D'UNE SEMAINE

   semaine : son lundi (« 2026-11-02 ») ; fuseau : celui du groupe, dans
   lequel l'agenda d'AllReady compte ses heures. Une case (jour j de 0 à
   6, heure h de 9 à 26 : 25 = 1 h du matin la nuit suivante) couvre
   une heure ; elle est occupée si un rendez-vous la touche, même un
   peu. On compte en minutes depuis le lundi 0 h, heure du groupe.
   Renvoie [[jour, heure], …]. */
export function casesOccupees(ics, semaine, fuseauGroupe, heureDebut = 9, heureFin = 27) {
  const [an, mois, jour] = semaine.split('-').map(Number);
  const lundi = Date.UTC(an, mois - 1, jour);
  // Un instant → minutes depuis le lundi 0 h, à l'horloge du groupe.
  const minutes = (instant) => {
    const p = partiesDans(instant, fuseauGroupe);
    return (Date.UTC(p.year, p.month - 1, p.day) - lundi) / 60000 + p.hour * 60 + p.minute;
  };
  const finSemaine = versInstant({ an, mois, jour: jour + 8, h: 0, m: 0, s: 0 }, fuseauGroupe);

  const evenements = lireEvenements(ics);
  // Les dates déplacées (RECURRENCE-ID) : à retirer de la série d'origine.
  const deplacees = new Map(); // UID → Set d'instants
  for (const ev of evenements) {
    if (!ev['RECURRENCE-ID'] || !ev.UID) continue;
    const d = lireDate(ev['RECURRENCE-ID'][0], fuseauGroupe);
    if (!d) continue;
    const uid = ev.UID[0].valeur;
    if (!deplacees.has(uid)) deplacees.set(uid, new Set());
    deplacees.get(uid).add(versInstant(d.mur, d.fuseau));
  }

  const occupees = new Set();
  for (const ev of evenements) {
    if (!ev.DTSTART) continue;
    if (ev.STATUS?.[0].valeur === 'CANCELLED' || ev.TRANSP?.[0].valeur === 'TRANSPARENT') continue;
    const debut = lireDate(ev.DTSTART[0], fuseauGroupe);
    if (!debut || debut.journee) continue;
    const fin = ev.DTEND ? lireDate(ev.DTEND[0], fuseauGroupe) : null;
    const duree = fin
      ? versInstant(fin.mur, fin.fuseau) - versInstant(debut.mur, debut.fuseau)
      : ev.DURATION ? lireDuree(ev.DURATION[0].valeur) : 3600000;
    const regle = ev.RRULE && !ev['RECURRENCE-ID']
      ? Object.fromEntries(ev.RRULE[0].valeur.split(';').map((morceau) => morceau.split('=')))
      : null;
    // Les dates à sauter : celles déplacées ailleurs (RECURRENCE-ID) et les EXDATE.
    const sautees = new Set(regle && ev.UID ? deplacees.get(ev.UID[0].valeur) || [] : []);
    for (const exdate of ev.EXDATE || []) {
      for (const valeur of exdate.valeur.split(',')) {
        const d = lireDate({ params: exdate.params, valeur }, fuseauGroupe);
        if (d) sautees.add(versInstant(d.mur, d.fuseau));
      }
    }
    for (const instant of occurrences(debut, regle, finSemaine)) {
      if (sautees.has(instant)) continue;
      const de = minutes(instant);
      const a = minutes(instant + Math.max(duree, 1));
      for (let j = 0; j < 7; j++) {
        for (let h = heureDebut; h < heureFin; h++) {
          const caseDebut = j * 1440 + h * 60;
          if (caseDebut < a && de < caseDebut + 60) occupees.add(`${j}-${h}`);
        }
      }
    }
  }
  return [...occupees].map((cle) => cle.split('-').map(Number)).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}
