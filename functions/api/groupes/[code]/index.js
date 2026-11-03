/* TOUT CE QU'IL FAUT POUR AFFICHER UN GROUPE — GET /api/groupes/ABCD2345?semaine=2026-11-02

   [code] entre crochets dans le nom du dossier : cette partie de
   l'adresse est variable. Cloudflare la range dans params.code.

   Une seule requête rapporte tout ce que la page affiche : le groupe,
   ses membres, les dispos de la semaine demandée et les soirées à
   venir. La page n'attend qu'un aller-retour, pas cinq.

   Ouvert aux simples visiteurs du lien (identifier(…, false)) : il
   faut bien voir le groupe avant de choisir son pseudo. « moi » vaut
   alors null, et le navigateur sait qu'il doit proposer l'inscription.
   « compte » dit en plus si le visiteur est connecté avec Discord :
   sinon, l'inscription commence par la connexion. */

import {
  json, erreur, estLundi, identifier, jeuxStockes, persoStockee, adressePhoto,
  lireCorps, ligne, peutGerer, recalerHebdos, lireFuseau, repartir, rolesStockes,
  lireBanniere, banniereStockee, themesDebloques,
} from '../../../_outils.js';
import { heureDuGroupe } from '../../../_annonces.js';
import { botConfigure } from '../../../_discord.js';

/* MODIFIER LE GROUPE — PATCH /api/groupes/ABCD2345
   { nom: "…" } pour le renommer, { fuseau: "America/Montreal" } pour
   changer son fuseau horaire (2 nov. 2026), ou { banniere: … } (AllReady+,
   3 nov. 2026). Réservé aux organisateurs (peutGerer, _outils.js). */
export async function onRequestPatch(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;
  const db = context.env.DB;
  if (!await peutGerer(db, groupe, moi)) {
    return erreur(403, 'Seuls les organisateurs du groupe peuvent le modifier.');
  }
  const corps = await lireCorps(context.request);
  /* La bannière (AllReady+) : { banniere: { fond: "crepuscule",
     emoji: "🐉" } }, ou { banniere: null } pour la retirer. */
  if ('banniere' in corps) {
    if (!groupe.premium) return erreur(403, "La bannière fait partie d'AllReady+.");
    const banniere = lireBanniere(corps.banniere);
    if (banniere === null) return erreur(400, 'Bannière invalide.');
    await db.prepare('UPDATE groupes SET banniere = ? WHERE id = ?').bind(banniere, groupe.id).run();
    return json(200, { banniere: banniereStockee(banniere) });
  }
  if ('fuseau' in corps) {
    const fuseau = lireFuseau(corps.fuseau);
    if (!fuseau) return erreur(400, 'Fuseau horaire inconnu.');
    await db.prepare('UPDATE groupes SET fuseau = ? WHERE id = ?').bind(fuseau, groupe.id).run();
    return json(200, { fuseau });
  }
  const nom = ligne(corps.nom);
  if (nom.length < 1 || nom.length > 40) return erreur(400, 'Donne un nom au groupe (40 caractères au plus).');
  await db.prepare('UPDATE groupes SET nom = ? WHERE id = ?').bind(nom, groupe.id).run();
  return json(200, { nom });
}

export async function onRequestGet(context) {
  const { groupe, moi, compte, refus } = await identifier(context, false);
  if (refus) return refus;

  const semaine = new URL(context.request.url).searchParams.get('semaine');
  if (!estLundi(semaine)) return erreur(400, 'Semaine invalide.');

  /* Les soirées gardées : à partir du lundi affiché, ou d'hier si on
     regarde une semaine à venir. « Hier » plutôt qu'aujourd'hui parce
     que date('now') est l'heure de Londres (UTC), pas la tienne : le
     navigateur fait ensuite le tri exact, à son heure. */
  const db = context.env.DB;
  // D'abord, les soirées de chaque semaine dont le jour est passé
  // avancent à la semaine suivante (recalerHebdos, _outils.js).
  await db.batch(recalerHebdos(db, heureDuGroupe(groupe.fuseau).slice(0, 10), groupe.id));
  const [membres, dispos, soirees, reponses, chauds, votes] = await db.batch([
    // LEFT JOIN : chaque membre, avec la version de sa photo s'il en a
    // une (NULL sinon). Jamais l'image elle-même : la page la demande à
    // part, par son adresse (voir photos/[id].js).
    // Et, par son compte, s'il soutient AllReady (0 sans compte).
    db.prepare(`SELECT m.id, m.pseudo, m.couleur, m.jeux, m.bio, m.perso, m.semaine_type, m.organisateur, p.version AS photo,
                       COALESCE(c.soutien, 0) AS soutien
                FROM membres m LEFT JOIN photos p ON p.membre_id = m.id
                LEFT JOIN comptes c ON c.id = m.compte_id
                WHERE m.groupe_id = ? ORDER BY m.id`)
      .bind(groupe.id),

    db.prepare(`SELECT d.membre_id, d.creneaux FROM dispos d
                JOIN membres m ON m.id = d.membre_id
                WHERE m.groupe_id = ? AND d.semaine = ?`)
      .bind(groupe.id, semaine),

    db.prepare(`SELECT id, createur_id, titre, jeu, jeu_cover, jeu_id, jour, horaire, fin, places, note, choix, hebdo, roles FROM soirees
                WHERE groupe_id = ? AND jour >= MIN(?, date('now', '-1 day'))
                ORDER BY jour, horaire LIMIT 200`)
      .bind(groupe.id, semaine),

    db.prepare(`SELECT r.soiree_id, r.membre_id, r.reponse, r.role, r.inscrit_le FROM reponses r
                JOIN soirees s ON s.id = r.soiree_id
                WHERE s.groupe_id = ? AND s.jour >= MIN(?, date('now', '-1 day'))`)
      .bind(groupe.id, semaine),

    // LA TEAM EN CHIFFRES (js/stats.js) : combien de « Chaud » chacun a
    // donnés, toutes soirées du groupe confondues, passées comprises.
    db.prepare(`SELECT r.membre_id, COUNT(*) AS nombre FROM reponses r
                JOIN soirees s ON s.id = r.soiree_id
                WHERE s.groupe_id = ? AND r.reponse = 'oui'
                GROUP BY r.membre_id`)
      .bind(groupe.id),

    // Les votes « À quoi on joue ? » des mêmes soirées.
    db.prepare(`SELECT v.soiree_id, v.membre_id, v.choix FROM votes v
                JOIN soirees s ON s.id = v.soiree_id
                WHERE s.groupe_id = ? AND s.jour >= MIN(?, date('now', '-1 day'))`)
      .bind(groupe.id, semaine),
  ]);

  // Les votes rangés par soirée : { 12: { 3: 0, 5: 1 } } (membre → place du jeu).
  const votesParSoiree = {};
  for (const rangee of votes.results) {
    if (!votesParSoiree[rangee.soiree_id]) votesParSoiree[rangee.soiree_id] = {};
    votesParSoiree[rangee.soiree_id][rangee.membre_id] = rangee.choix;
  }

  // Les dispos rangées par membre : { 3: [[0,21],[0,22]], 5: [[4,20]] }.
  // JSON.parse retransforme le texte stocké en vrai tableau.
  const disposParMembre = {};
  for (const rangee of dispos.results) {
    disposParMembre[rangee.membre_id] = JSON.parse(rangee.creneaux);
  }

  /* LA SEMAINE TYPE (voir dispos.js) : un membre qui n'a rien
     enregistré pour cette semaine, et qui a un modèle commencé cette
     semaine-là ou avant (« depuis », comparé comme du texte : les dates
     AAAA-MM-JJ se rangent dans le bon ordre), reprend ses créneaux. */
  let maSemaineType = false;
  for (const membre of membres.results) {
    if (!membre.semaine_type) continue;
    if (moi && membre.id === moi.id) maSemaineType = true;
    const modele = JSON.parse(membre.semaine_type);
    if (!(membre.id in disposParMembre) && modele.depuis <= semaine) {
      disposParMembre[membre.id] = modele.creneaux;
    }
  }

  // Les réponses rangées par soirée : { 12: { 3: "oui", 5: "peutetre" } }.
  const reponsesParSoiree = {};
  const ouiParSoiree = {}; // les « Chaud », avec leur rôle et leur heure d'arrivée
  for (const rangee of reponses.results) {
    if (!reponsesParSoiree[rangee.soiree_id]) reponsesParSoiree[rangee.soiree_id] = {};
    reponsesParSoiree[rangee.soiree_id][rangee.membre_id] = rangee.reponse;
    if (rangee.reponse === 'oui') (ouiParSoiree[rangee.soiree_id] ||= []).push(rangee);
  }

  /* Les inscrits (rôles et liste d'attente, AllReady+) :
     { 3: { role: "Tank", attente: false } } pour chaque « Chaud ». */
  function inscrits(soiree, roles) {
    const oui = ouiParSoiree[soiree.id] || [];
    const enAttente = repartir({ roles, places: soiree.places }, oui, groupe.premium === 1);
    return Object.fromEntries(oui.map((r) => [r.membre_id, { role: r.role, attente: enAttente.has(r.membre_id) }]));
  }

  const presence = groupe.premium ? await presencesDuGroupe(db, groupe) : null;

  return json(200, {
    // discord : un salon est-il branché ? Oui ou non, jamais l'adresse
    // du webhook (qui l'a peut écrire dans le salon).
    // premium : le groupe est-il abonné à AllReady+ ?
    // bot : le bot Discord est-il prêt sur ce site, et relié à un serveur ?
    groupe: {
      code: groupe.code, nom: groupe.nom, discord: groupe.webhook !== '', fuseau: groupe.fuseau,
      premium: groupe.premium === 1,
      bot: { possible: botConfigure(context.env), lie: groupe.guild_id !== '' },
      // La bannière { fond, emoji } : seulement tant que le groupe est
      // abonné (null sinon, elle revient s'il se réabonne).
      banniere: groupe.premium === 1 ? banniereStockee(groupe.banniere) : null,
    },
    moi: moi ? moi.id : null,
    // Le nom et le pseudo Discord, sans le numéro du compte : la page
    // n'en a pas besoin.
    // agenda : une synchronisation d'agenda est-elle branchée ? (oui ou
    // non : jamais l'adresse, qui donne accès à l'agenda)
    // themes : les thèmes exclusifs débloqués (soutien ou groupe AllReady+).
    compte: compte
      ? { nom: compte.nom, discord: compte.discord, agenda: compte.agenda_ics !== '', themes: await themesDebloques(db, compte.id) }
      : null,
    semaine,
    // As-tu une semaine type ? (coche « Répéter chaque semaine »)
    semaineType: maSemaineType,
    // Qui décide (renommer, retirer quelqu'un) : le premier membre, le
    // plus petit id (les membres arrivent rangés par id). Voir adminDuGroupe.
    admin: membres.results.length ? membres.results[0].id : null,
    // Les jeux et la personnalisation sont stockés en texte JSON : on
    // les rend sous forme de vraies listes et de vrais objets.
    // La photo : son adresse, prête à mettre dans un <img>, ou null.
    // ({ semaine_type, ...membre }) : la semaine type reste au serveur ;
    // elle est déjà fondue dans « dispos ».
    membres: membres.results.map(({ semaine_type, ...membre }) => ({
      ...membre,
      jeux: jeuxStockes(membre.jeux),
      perso: persoStockee(membre.perso),
      photo: membre.photo ? adressePhoto(groupe.code, membre.id, membre.photo) : null,
      soutien: membre.soutien === 1,
      organisateur: membre.organisateur === 1,
    })),
    dispos: disposParMembre,
    // { chauds: { 3: 8, 5: 2 } } : le nombre de « Chaud » par membre.
    stats: {
      chauds: Object.fromEntries(chauds.results.map((rangee) => [rangee.membre_id, rangee.nombre])),
    },
    // choix : la liste des jeux du vote ([] sans vote), votes : qui a
    // voté pour quelle place.
    soirees: soirees.results.map((soiree) => ({
      ...soiree,
      roles: rolesStockes(soiree.roles),
      inscrits: inscrits(soiree, rolesStockes(soiree.roles)),
      choix: soiree.choix ? JSON.parse(soiree.choix) : [],
      hebdo: soiree.hebdo === 1,
      votes: votesParSoiree[soiree.id] || {},
      reponses: reponsesParSoiree[soiree.id] || {},
    })),
    // Présence et assiduité (AllReady+) : voir presencesDuGroupe, plus
    // bas. null dans un groupe gratuit.
    presence,
  });
}


/* PRÉSENCE ET ASSIDUITÉ (AllReady+, 2 nov. 2026)

   Deux choses pour la page :
   — passees : les cinq dernières soirées déjà commencées (30 jours au
     plus), pour « Qui était là ? » (js/presence.js). Pour chacune :
     pointee (le pointage est-il fait ?), presents (qui était là, s'il
     est fait) et chauds (ceux qui jouaient : cochés d'avance la
     première fois, puis ceux que le pointage a retenus) ;
   — fiabilite : { 3: { attendus: 10, venus: 8 } } pour chaque membre,
     toutes soirées pointées du groupe confondues (js/team.js).

   « Déjà commencée » se compare en texte, « 2026-11-06 21:00 » contre
   l'heure du groupe (heureDuGroupe) : les dates et heures écrites
   ainsi se rangent dans le bon ordre. Une seconde série de requêtes,
   seulement pour un groupe abonné. */
async function presencesDuGroupe(db, groupe) {
  const maintenant = heureDuGroupe(groupe.fuseau);
  const [passees, oui, pointages, fiabilite] = await db.batch([
    db.prepare(`SELECT id, titre, jeu, jeu_cover, jour, horaire, createur_id, places, roles FROM soirees
                WHERE groupe_id = ? AND jour >= date(?, '-30 days') AND jour || ' ' || horaire <= ?
                ORDER BY jour DESC, horaire DESC LIMIT 5`)
      .bind(groupe.id, maintenant.slice(0, 10), maintenant),
    db.prepare(`SELECT r.soiree_id, r.membre_id, r.role, r.inscrit_le FROM reponses r
                JOIN soirees s ON s.id = r.soiree_id
                WHERE s.groupe_id = ? AND s.jour >= date(?, '-30 days') AND r.reponse = 'oui'`)
      .bind(groupe.id, maintenant.slice(0, 10)),
    // Le pointage de la date actuelle de chaque soirée (p.jour = s.jour).
    db.prepare(`SELECT p.soiree_id, p.membre_id, p.attendu, p.venu FROM presences p
                JOIN soirees s ON s.id = p.soiree_id AND s.jour = p.jour
                WHERE s.groupe_id = ? AND s.jour >= date(?, '-30 days')`)
      .bind(groupe.id, maintenant.slice(0, 10)),
    // SUM(attendu * venu) : venu ET attendu (1 × 1), les seules
    // présences qui comptent pour la fiabilité.
    db.prepare(`SELECT p.membre_id, SUM(p.attendu) AS attendus, SUM(p.attendu * p.venu) AS venus
                FROM presences p JOIN soirees s ON s.id = p.soiree_id
                WHERE s.groupe_id = ? GROUP BY p.membre_id`)
      .bind(groupe.id),
  ]);
  return {
    passees: passees.results.map((soiree) => {
      const pointage = pointages.results.filter((p) => p.soiree_id === soiree.id);
      // Les « Chaud » qui jouaient : ceux figés par le pointage s'il est
      // fait (attendu), sinon ceux des réponses actuelles.
      let chauds;
      if (pointage.length) {
        chauds = pointage.filter((p) => p.attendu === 1).map((p) => p.membre_id);
      } else {
        const lesOui = oui.results.filter((r) => r.soiree_id === soiree.id);
        const enAttente = repartir({ roles: rolesStockes(soiree.roles), places: soiree.places }, lesOui, true);
        chauds = lesOui.map((r) => r.membre_id).filter((id) => !enAttente.has(id));
      }
      return {
        id: soiree.id, titre: soiree.titre, jeu: soiree.jeu, jeu_cover: soiree.jeu_cover,
        jour: soiree.jour, horaire: soiree.horaire, createur_id: soiree.createur_id,
        pointee: pointage.length > 0,
        presents: pointage.filter((p) => p.venu === 1).map((p) => p.membre_id),
        chauds,
      };
    }),
    fiabilite: Object.fromEntries(fiabilite.results.map((rangee) => [
      rangee.membre_id, { attendus: rangee.attendus, venus: rangee.venus },
    ])),
  };
}
