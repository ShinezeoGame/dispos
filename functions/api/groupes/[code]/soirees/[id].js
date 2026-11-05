/* RÉPONDRE À UNE SOIRÉE, LA MODIFIER OU L'ANNULER — /api/groupes/ABCD2345/soirees/12

   PUT    { reponse: "oui" | "peutetre" | "non" } → ta réponse
   PUT    { vote: 1 }                              → ton vote « À quoi on joue ? »
   PUT    { presents: [3, 5] }                     → « Qui était là ? » (AllReady+)
   PATCH  { jeu, titre, jour, horaire, note }      → modifie la soirée
   DELETE                                         → annule la soirée

   Un même fichier peut répondre à plusieurs méthodes : onRequestPut
   pour l'une, onRequestPatch pour l'autre, etc. Modifier et annuler
   sont réservés à la personne qui a proposé la soirée. */

import { json, erreur, lireCorps, identifier, lireSoiree, peutGerer, repartir, rolesStockes, REPONSES } from '../../../../_outils.js';
import { annoncerSoiree, heureDuGroupe } from '../../../../_annonces.js';
import { repondreSoiree } from '../../../../_reponses.js';
import { prevenirSoireeDeplacee, prevenirSoireeAnnulee } from '../../../../_evenements.js';

/* La soirée doit appartenir AU groupe du lien. Sans ce
   « AND groupe_id = ? », un membre d'un groupe pourrait répondre aux
   soirées d'un autre groupe en changeant le numéro dans l'adresse. */
async function trouverSoiree(db, groupeId, id) {
  return db
    .prepare('SELECT id, createur_id, titre, jour, horaire, fin, places, choix, roles FROM soirees WHERE id = ? AND groupe_id = ?')
    .bind(Number(id), groupeId)
    .first();
}

export async function onRequestPut(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const db = context.env.DB;
  const soiree = await trouverSoiree(db, groupe.id, context.params.id);
  if (!soiree) return erreur(404, "Cette soirée n'existe plus.");

  const corps = await lireCorps(context.request);
  // Un vote « À quoi on joue ? » plutôt qu'une réponse : voir plus bas.
  if ('vote' in corps) return voter(db, soiree, moi, corps.vote);
  // Le pointage « Qui était là ? » : voir pointer(), plus bas.
  if ('presents' in corps) return pointer(db, groupe, moi, soiree, corps.presents);
  const { reponse } = corps;
  if (!REPONSES.includes(reponse)) return erreur(400, 'Réponse inconnue.');

  // Toute la logique (rôle, places, liste d'attente, notification) est
  // dans _reponses.js : le bot Discord s'en sert aussi.
  const resultat = await repondreSoiree(context, groupe, soiree, moi.id, reponse, corps.role);
  if (resultat.refus) return resultat.refus;
  return json(200, { ok: true, attente: resultat.attente });
}

/* LE VOTE « À QUOI ON JOUE ? » (2 nov. 2026) — PUT { vote: 1 }

   vote = la place du jeu dans soirees.choix (0, 1, 2 ou 3) ; null
   retire ton vote. Après chaque vote, le jeu de la soirée devient celui
   qui est en tête : sa jaquette, l'agenda, le flux d'agenda et Discord
   suivent sans rien calculer de leur côté. À égalité, le premier de la
   liste l'emporte (ORDER BY nombre DESC, choix). Sans aucun vote, c'est
   le premier.

   Le tout en un seul batch : le vote, puis la mise à jour du jeu, qui
   relit les votes dans la même transaction (sous-requête). */
async function voter(db, soiree, moi, vote) {
  const choix = soiree.choix ? JSON.parse(soiree.choix) : [];
  if (!choix.length) return erreur(400, "Cette soirée n'a pas de vote.");
  const retirer = vote === null;
  if (!retirer && !(Number.isInteger(vote) && vote >= 0 && vote < choix.length)) {
    return erreur(400, 'Vote inconnu.');
  }
  const enTete = `(SELECT choix FROM votes WHERE soiree_id = ?1
                   GROUP BY choix ORDER BY COUNT(*) DESC, choix LIMIT 1)`;
  // Les trois champs du jeu, pris dans la liste JSON à la place du
  // gagnant (0 si personne n'a voté).
  const champ = (nom) => `json_extract(choix, '$[' || COALESCE(${enTete}, 0) || '].${nom}')`;
  await db.batch([
    retirer
      ? db.prepare('DELETE FROM votes WHERE soiree_id = ? AND membre_id = ?').bind(soiree.id, moi.id)
      : db.prepare(`INSERT INTO votes (soiree_id, membre_id, choix) VALUES (?, ?, ?)
                    ON CONFLICT (soiree_id, membre_id) DO UPDATE SET choix = excluded.choix`)
        .bind(soiree.id, moi.id, vote),
    db.prepare(`UPDATE soirees SET jeu = ${champ('nom')}, jeu_cover = COALESCE(${champ('cover')}, ''),
                jeu_id = ${champ('id')} WHERE id = ?1`).bind(soiree.id),
  ]);
  return json(200, { ok: true });
}

/* « QUI ÉTAIT LÀ ? » (AllReady+, 2 nov. 2026) — PUT { presents: [3, 5] }

   Une fois la soirée commencée, la personne qui l'a proposée (ou un
   organisateur, peutGerer) coche qui est vraiment venu. presents : les
   numéros des membres venus.

   Chaque membre pointé devient une ligne de la table presences :
   — attendu = 1 s'il avait dit « Chaud » et jouait (pas en liste
     d'attente : repartir, _outils.js). C'est sur eux que se calcule la
     fiabilité de chacun (« Fiable à 80 % », js/team.js) ;
   — venu = 1 s'il était là. Un membre venu sans avoir dit « Chaud » a
     aussi sa ligne (attendu = 0) : il ne compte pas contre lui.

   Les attendus sont figés au PREMIER pointage : le corriger ensuite ne
   change que les « venu ». Sans ça, quelqu'un qui n'est pas venu
   pourrait passer en « Pas dispo » après coup et effacer son absence.

   La date de la soirée (jour) fait partie de la ligne : une soirée de
   chaque semaine garde le même numéro d'une semaine à l'autre, et ses
   réponses sont effacées quand elle avance (recalerHebdos). Les
   présences, elles, restent : c'est l'historique.

   Le tout en un batch : on efface le pointage précédent de ce jour-là,
   puis on écrit le nouveau d'une seule requête (json_each déplie la
   liste envoyée en texte JSON : une ligne par membre, sans dépasser
   les 100 paramètres par requête de D1). */
async function pointer(db, groupe, moi, soiree, presents) {
  if (!groupe.premium) return erreur(403, "Les présences font partie d'AllReady+.");
  if (soiree.createur_id !== moi.id && !await peutGerer(db, groupe, moi)) {
    return erreur(403, 'Seule la personne qui a proposé la soirée peut dire qui était là.');
  }
  if (`${soiree.jour} ${soiree.horaire}` > heureDuGroupe(groupe.fuseau)) {
    return erreur(400, "La soirée n'a pas encore commencé.");
  }
  if (!Array.isArray(presents) || presents.length > 200 || !presents.every(Number.isInteger)) {
    return erreur(400, 'Liste de présents invalide.');
  }

  const [membres, oui, deja] = await db.batch([
    db.prepare('SELECT id FROM membres WHERE groupe_id = ?').bind(groupe.id),
    db.prepare("SELECT membre_id, role, inscrit_le FROM reponses WHERE soiree_id = ? AND reponse = 'oui'").bind(soiree.id),
    db.prepare('SELECT membre_id FROM presences WHERE soiree_id = ? AND jour = ? AND attendu = 1').bind(soiree.id, soiree.jour),
  ]);
  // Seuls les membres du groupe : un numéro inventé est ignoré.
  const duGroupe = new Set(membres.results.map((membre) => membre.id));
  const venus = new Set(presents.filter((id) => duGroupe.has(id)));
  let attendus;
  if (deja.results.length) {
    attendus = new Set(deja.results.map((ligne) => ligne.membre_id)); // figés au premier pointage
  } else {
    const enAttente = repartir({ roles: rolesStockes(soiree.roles), places: soiree.places }, oui.results, true);
    attendus = new Set(oui.results.map((r) => r.membre_id).filter((id) => !enAttente.has(id)));
  }
  // Une ligne par membre attendu ou venu : { m: membre, a: attendu, v: venu }.
  const lignes = [...new Set([...attendus, ...venus])]
    .map((id) => ({ m: id, a: attendus.has(id) ? 1 : 0, v: venus.has(id) ? 1 : 0 }));
  await db.batch([
    db.prepare('DELETE FROM presences WHERE soiree_id = ? AND jour = ?').bind(soiree.id, soiree.jour),
    db.prepare(`INSERT INTO presences (soiree_id, jour, membre_id, attendu, venu)
                SELECT ?1, ?2, json_extract(value, '$.m'), json_extract(value, '$.a'), json_extract(value, '$.v')
                FROM json_each(?3)`)
      .bind(soiree.id, soiree.jour, JSON.stringify(lignes)),
  ]);
  return json(200, { ok: true });
}

/* MODIFIER — PATCH veut dire « modifie ceci ». On envoie la soirée
   complète, comme à la création, et elle est vérifiée de la même façon
   (lireSoiree).

   Changer la date ou l'heure remet les réponses des autres à zéro : un
   « Chaud » pour vendredi 21 h ne vaut pas pour samedi. Chacun revoit
   alors la soirée comme « sans réponse » (la pastille de l'onglet), ce
   qui le prévient du changement. La réponse de la personne qui modifie
   reste. Un nouveau titre, un autre jeu ou un autre petit mot gardent
   toutes les réponses.

   Renvoie : { ok: true, reponsesEffacees: true | false } */
export async function onRequestPatch(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const db = context.env.DB;
  const ancienne = await trouverSoiree(db, groupe.id, context.params.id);
  if (!ancienne) return erreur(404, "Cette soirée n'existe plus.");
  // Celle ou celui qui l'a proposée ; en AllReady+, les organisateurs aussi.
  if (ancienne.createur_id !== moi.id && !(groupe.premium && await peutGerer(db, groupe, moi))) {
    return erreur(403, 'Seule la personne qui a proposé la soirée peut la modifier.');
  }

  const { soiree, probleme } = lireSoiree(await lireCorps(context.request));
  if (probleme) return erreur(400, probleme);

  const autreMoment = soiree.jour !== ancienne.jour || soiree.horaire !== ancienne.horaire;
  const choix = soiree.choix.length ? JSON.stringify(soiree.choix) : '';
  // Les rôles : AllReady+ seulement (sinon ignorés, comme à la création).
  if (!groupe.premium && soiree.roles.length) {
    soiree.roles = [];
    soiree.places = null;
  }
  const roles = soiree.roles.length ? JSON.stringify(soiree.roles) : '';
  const instructions = [
    db.prepare(`UPDATE soirees SET titre = ?, jeu = ?, jeu_cover = ?, jeu_id = ?, jour = ?, horaire = ?,
                fin = ?, places = ?, note = ?, choix = ?, hebdo = ?, roles = ? WHERE id = ?`)
      .bind(soiree.titre, soiree.jeu.nom, soiree.jeu.cover, soiree.jeu.id, soiree.jour, soiree.horaire,
        soiree.fin, soiree.places, soiree.note, choix, soiree.hebdo ? 1 : 0, roles, ancienne.id),
  ];
  /* Un rôle supprimé ou renommé : ceux qui l'avaient choisi repassent
     en « Peut-être » (ils voient la soirée « sans réponse » et
     choisissent un nouveau rôle). Les autres gardent leur place. */
  if (roles !== ancienne.roles && roles) {
    instructions.push(db.prepare(`UPDATE reponses SET reponse = 'peutetre', role = ''
                                  WHERE soiree_id = ? AND reponse = 'oui'
                                  AND role NOT IN (SELECT json_extract(value, '$.nom') FROM json_each(?))`)
      .bind(ancienne.id, roles));
  } else if (roles !== ancienne.roles) {
    // Plus de rôles du tout : chacun garde son « Chaud », sans rôle.
    instructions.push(db.prepare("UPDATE reponses SET role = '' WHERE soiree_id = ?").bind(ancienne.id));
  }
  // Les jeux du vote ont changé : les votes déjà donnés ne veulent plus
  // rien dire (la place 1 n'est peut-être plus le même jeu).
  if (choix !== ancienne.choix) {
    instructions.push(db.prepare('DELETE FROM votes WHERE soiree_id = ?').bind(ancienne.id));
  }
  if (autreMoment) {
    instructions.push(db.prepare('DELETE FROM reponses WHERE soiree_id = ? AND membre_id != ?').bind(ancienne.id, moi.id));
    // Le rappel Discord « dans moins d'une heure » vaudra pour la
    // nouvelle heure, même s'il était déjà parti pour l'ancienne.
    instructions.push(db.prepare('UPDATE soirees SET rappel = 0 WHERE id = ?').bind(ancienne.id));
  }
  // batch : tout ensemble ou rien (une transaction).
  await db.batch(instructions);

  // Seul un changement de moment est annoncé sur Discord : un titre
  // corrigé ne mérite pas un message de plus dans le salon.
  if (autreMoment) {
    annoncerSoiree(context, groupe, 'deplacee', { ...soiree, jeu: soiree.jeu.nom, jeu_cover: soiree.jeu.cover }, moi.pseudo);
    // Et en notification, au reste du groupe (_evenements.js).
    prevenirSoireeDeplacee(context, groupe, { ...soiree, id: ancienne.id }, moi);
  }

  return json(200, { ok: true, reponsesEffacees: autreMoment });
}

export async function onRequestDelete(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const db = context.env.DB;
  const soiree = await trouverSoiree(db, groupe.id, context.params.id);
  if (!soiree) return erreur(404, "Cette soirée n'existe plus.");

  // 403 = « interdit » : on sait qui tu es, mais ce n'est pas à toi.
  if (soiree.createur_id !== moi.id && !(groupe.premium && await peutGerer(db, groupe, moi))) {
    return erreur(403, "Seule la personne qui a proposé la soirée peut l'annuler.");
  }

  // Les réponses partent avec elle (ON DELETE CASCADE).
  await db.prepare('DELETE FROM soirees WHERE id = ?').bind(soiree.id).run();

  // Annoncée sur Discord si elle n'a pas encore commencé : effacer une
  // vieille soirée de la liste n'intéresse personne.
  if (`${soiree.jour} ${soiree.horaire}` > heureDuGroupe(groupe.fuseau)) {
    annoncerSoiree(context, groupe, 'annulee', soiree, moi.pseudo);
    prevenirSoireeAnnulee(context, groupe, soiree, moi);
  }
  return json(200, { ok: true });
}
