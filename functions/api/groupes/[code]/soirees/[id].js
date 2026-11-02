/* RÉPONDRE À UNE SOIRÉE, LA MODIFIER OU L'ANNULER — /api/groupes/ABCD2345/soirees/12

   PUT    { reponse: "oui" | "peutetre" | "non" } → ta réponse
   PATCH  { jeu, titre, jour, horaire, note }      → modifie la soirée
   DELETE                                         → annule la soirée

   Un même fichier peut répondre à plusieurs méthodes : onRequestPut
   pour l'une, onRequestPatch pour l'autre, etc. Modifier et annuler
   sont réservés à la personne qui a proposé la soirée. */

import { json, erreur, lireCorps, identifier, lireSoiree, REPONSES } from '../../../../_outils.js';
import { annoncerSoiree, heureDuGroupe } from '../../../../_annonces.js';

/* La soirée doit appartenir AU groupe du lien. Sans ce
   « AND groupe_id = ? », un membre d'un groupe pourrait répondre aux
   soirées d'un autre groupe en changeant le numéro dans l'adresse. */
async function trouverSoiree(db, groupeId, id) {
  return db
    .prepare('SELECT id, createur_id, titre, jour, horaire, places, choix FROM soirees WHERE id = ? AND groupe_id = ?')
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
  const { reponse } = corps;
  if (!REPONSES.includes(reponse)) return erreur(400, 'Réponse inconnue.');

  /* Les places : une soirée complète refuse un « oui » de plus. Les
     autres « oui » sont comptés sans le tien : redire « oui » quand on
     y est déjà reste possible. */
  if (reponse === 'oui' && soiree.places) {
    const { nombre } = await db
      .prepare("SELECT COUNT(*) AS nombre FROM reponses WHERE soiree_id = ? AND reponse = 'oui' AND membre_id != ?")
      .bind(soiree.id, moi.id)
      .first();
    if (nombre >= soiree.places) return erreur(409, "C'est complet.");
  }

  // Même principe que pour les dispos : crée la réponse ou la remplace.
  await db
    .prepare(`INSERT INTO reponses (soiree_id, membre_id, reponse) VALUES (?, ?, ?)
              ON CONFLICT (soiree_id, membre_id) DO UPDATE SET reponse = excluded.reponse`)
    .bind(soiree.id, moi.id, reponse)
    .run();

  return json(200, { ok: true });
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
  if (ancienne.createur_id !== moi.id) {
    return erreur(403, 'Seule la personne qui a proposé la soirée peut la modifier.');
  }

  const { soiree, probleme } = lireSoiree(await lireCorps(context.request));
  if (probleme) return erreur(400, probleme);

  const autreMoment = soiree.jour !== ancienne.jour || soiree.horaire !== ancienne.horaire;
  const choix = soiree.choix.length ? JSON.stringify(soiree.choix) : '';
  const instructions = [
    db.prepare(`UPDATE soirees SET titre = ?, jeu = ?, jeu_cover = ?, jeu_id = ?, jour = ?, horaire = ?,
                fin = ?, places = ?, note = ?, choix = ?, hebdo = ? WHERE id = ?`)
      .bind(soiree.titre, soiree.jeu.nom, soiree.jeu.cover, soiree.jeu.id, soiree.jour, soiree.horaire,
        soiree.fin, soiree.places, soiree.note, choix, soiree.hebdo ? 1 : 0, ancienne.id),
  ];
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
  if (soiree.createur_id !== moi.id) {
    return erreur(403, "Seule la personne qui a proposé la soirée peut l'annuler.");
  }

  // Les réponses partent avec elle (ON DELETE CASCADE).
  await db.prepare('DELETE FROM soirees WHERE id = ?').bind(soiree.id).run();

  // Annoncée sur Discord si elle n'a pas encore commencé : effacer une
  // vieille soirée de la liste n'intéresse personne.
  if (`${soiree.jour} ${soiree.horaire}` > heureDuGroupe(groupe.fuseau)) {
    annoncerSoiree(context, groupe, 'annulee', soiree, moi.pseudo);
  }
  return json(200, { ok: true });
}
