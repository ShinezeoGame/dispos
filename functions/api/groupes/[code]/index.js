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

import { json, erreur, estLundi, identifier, jeuxStockes, persoStockee, adressePhoto } from '../../../_outils.js';

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
  const [membres, dispos, soirees, reponses] = await db.batch([
    // LEFT JOIN : chaque membre, avec la version de sa photo s'il en a
    // une (NULL sinon). Jamais l'image elle-même : la page la demande à
    // part, par son adresse (voir photos/[id].js).
    db.prepare(`SELECT m.id, m.pseudo, m.couleur, m.jeux, m.bio, m.perso, p.version AS photo
                FROM membres m LEFT JOIN photos p ON p.membre_id = m.id
                WHERE m.groupe_id = ? ORDER BY m.id`)
      .bind(groupe.id),

    db.prepare(`SELECT d.membre_id, d.creneaux FROM dispos d
                JOIN membres m ON m.id = d.membre_id
                WHERE m.groupe_id = ? AND d.semaine = ?`)
      .bind(groupe.id, semaine),

    db.prepare(`SELECT id, createur_id, titre, jeu, jeu_cover, jeu_id, jour, horaire, note FROM soirees
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
    // Le nom et le pseudo Discord, sans le numéro du compte : la page
    // n'en a pas besoin.
    compte: compte ? { nom: compte.nom, discord: compte.discord } : null,
    semaine,
    // Les jeux et la personnalisation sont stockés en texte JSON : on
    // les rend sous forme de vraies listes et de vrais objets.
    // La photo : son adresse, prête à mettre dans un <img>, ou null.
    membres: membres.results.map((membre) => ({
      ...membre,
      jeux: jeuxStockes(membre.jeux),
      perso: persoStockee(membre.perso),
      photo: membre.photo ? adressePhoto(groupe.code, membre.id, membre.photo) : null,
    })),
    dispos: disposParMembre,
    soirees: soirees.results.map((soiree) => ({
      ...soiree,
      reponses: reponsesParSoiree[soiree.id] || {},
    })),
  });
}
