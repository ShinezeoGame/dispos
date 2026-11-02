/* PROPOSER UNE SOIRÉE — POST /api/groupes/ABCD2345/soirees

   Reçoit : { titre: "Soirée Among Us",
              jeu: { id: 17269, nom: "Among Us", cover: "co1r7f" },
              jour: "2026-11-07", horaire: "21:00", note: "…" }
   Renvoie : { id: 12 }

   Les vérifications (jeu, date, heure, longueurs) sont dans
   lireSoiree (_outils.js), partagées avec la modification.

   La personne qui propose est inscrite d'office : on ne propose pas
   une soirée pour ne pas y venir. */

import { json, erreur, lireCorps, identifier, lireSoiree } from '../../../../_outils.js';
import { annoncerSoiree, texteMoment } from '../../../../_annonces.js';
import { notifierGroupe } from '../../../../_push.js';

export async function onRequestPost(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const { soiree, probleme } = lireSoiree(await lireCorps(context.request));
  if (probleme) return erreur(400, probleme);

  const db = context.env.DB;
  // Les rôles sont réservés à AllReady+ : ignorés dans un groupe gratuit.
  if (!groupe.premium && soiree.roles.length) {
    soiree.roles = [];
    soiree.places = null;
  }
  const { id } = await db
    // choix : les jeux du vote en JSON, ou '' s'il n'y a qu'un jeu.
    .prepare(`INSERT INTO soirees (groupe_id, createur_id, titre, jeu, jeu_cover, jeu_id, jour, horaire, fin, places, note, choix, hebdo, roles)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(groupe.id, moi.id, soiree.titre, soiree.jeu.nom, soiree.jeu.cover, soiree.jeu.id,
      soiree.jour, soiree.horaire, soiree.fin, soiree.places, soiree.note,
      soiree.choix.length ? JSON.stringify(soiree.choix) : '', soiree.hebdo ? 1 : 0,
      soiree.roles.length ? JSON.stringify(soiree.roles) : '')
    .first();

  /* Celui qui propose est « Chaud » d'office, arrivé le premier. Sauf
     avec des rôles : il choisit le sien sur la carte, comme les autres. */
  if (!soiree.roles.length) {
    await db
      .prepare("INSERT INTO reponses (soiree_id, membre_id, reponse, inscrit_le) VALUES (?, ?, 'oui', ?)")
      .bind(id, moi.id, new Date().toISOString())
      .run();
  }

  // Sur Discord, si le groupe y a branché un salon (_annonces.js).
  annoncerSoiree(context, groupe, 'nouvelle', { ...soiree, jeu: soiree.jeu.nom, jeu_cover: soiree.jeu.cover }, moi.pseudo);
  // Et en notification, aux autres membres qui l'ont activée (_push.js).
  // tag : une seconde notification de la même soirée remplace la première.
  notifierGroupe(context, groupe, moi.id, {
    titre: `Nouvelle soirée · ${groupe.nom}`,
    corps: `${soiree.titre} · ${texteMoment(soiree)} · proposée par ${moi.pseudo}`,
    url: `/groupe?g=${groupe.code}`,
    tag: `soiree-${id}`,
  });

  return json(201, { id });
}
