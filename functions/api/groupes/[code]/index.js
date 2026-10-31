/* TOUT CE QU'IL FAUT POUR AFFICHER UN GROUPE — GET /api/groupes/ABCD2345?semaine=2026-11-02

   [code] entre crochets dans le nom du dossier : cette partie de
   l'adresse est variable. Cloudflare la range dans params.code.

   Une seule requête rapporte tout ce que la page affiche : le groupe,
   ses membres, les dispos de la semaine demandée et les soirées à
   venir. La page n'attend qu'un aller-retour, pas cinq.

   Ouvert aux simples visiteurs du lien (identifier(…, false)) : il
   faut bien voir le groupe avant de choisir son pseudo. « moi » vaut
   alors null, et le navigateur sait qu'il doit proposer l'inscription. */

import { json, erreur, estLundi, identifier } from '../../../_outils.js';

export async function onRequestGet(context) {
  const { groupe, moi, refus } = await identifier(context, false);
  if (refus) return refus;

  const semaine = new URL(context.request.url).searchParams.get('semaine');
  if (!estLundi(semaine)) return erreur(400, 'Semaine invalide.');

  /* Les soirées gardées : à partir du lundi affiché, ou d'hier si on
     regarde une semaine à venir. « Hier » plutôt qu'aujourd'hui parce
     que date('now') est l'heure de Londres (UTC), pas la tienne : le
     navigateur fait ensuite le tri exact, à son heure. */
  const db = context.env.DB;
  const [membres, dispos, soirees, reponses] = await db.batch([
    db.prepare('SELECT id, pseudo, couleur, jeux, bio FROM membres WHERE groupe_id = ? ORDER BY id')
      .bind(groupe.id),

    db.prepare(`SELECT d.membre_id, d.creneaux FROM dispos d
                JOIN membres m ON m.id = d.membre_id
                WHERE m.groupe_id = ? AND d.semaine = ?`)
      .bind(groupe.id, semaine),

    db.prepare(`SELECT id, createur_id, titre, jeu, jour, horaire, note FROM soirees
                WHERE groupe_id = ? AND jour >= MIN(?, date('now', '-1 day'))
                ORDER BY jour, horaire LIMIT 200`)
      .bind(groupe.id, semaine),

    db.prepare(`SELECT r.soiree_id, r.membre_id, r.reponse FROM reponses r
                JOIN soirees s ON s.id = r.soiree_id
                WHERE s.groupe_id = ? AND s.jour >= MIN(?, date('now', '-1 day'))`)
      .bind(groupe.id, semaine),
  ]);

  // Les dispos rangées par membre : { 3: [[0,21],[0,22]], 5: [[4,20]] }.
  // JSON.parse retransforme le texte stocké en vrai tableau.
  const disposParMembre = {};
  for (const rangee of dispos.results) {
    disposParMembre[rangee.membre_id] = JSON.parse(rangee.creneaux);
  }

  // Les réponses rangées par soirée : { 12: { 3: "oui", 5: "peutetre" } }.
  const reponsesParSoiree = {};
  for (const rangee of reponses.results) {
    if (!reponsesParSoiree[rangee.soiree_id]) reponsesParSoiree[rangee.soiree_id] = {};
    reponsesParSoiree[rangee.soiree_id][rangee.membre_id] = rangee.reponse;
  }

  return json(200, {
    groupe: { code: groupe.code, nom: groupe.nom },
    moi: moi ? moi.id : null,
    semaine,
    membres: membres.results,
    dispos: disposParMembre,
    soirees: soirees.results.map((soiree) => ({
      ...soiree,
      reponses: reponsesParSoiree[soiree.id] || {},
    })),
  });
}
