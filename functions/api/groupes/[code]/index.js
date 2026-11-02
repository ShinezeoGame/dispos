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
  lireCorps, ligne, adminDuGroupe,
} from '../../../_outils.js';

/* RENOMMER LE GROUPE — PATCH /api/groupes/ABCD2345   { nom: "…" }
   Réservé au premier membre (adminDuGroupe, _outils.js). */
export async function onRequestPatch(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;
  const db = context.env.DB;
  if (moi.id !== await adminDuGroupe(db, groupe.id)) {
    return erreur(403, 'Seul le premier membre du groupe peut le renommer.');
  }
  const nom = ligne((await lireCorps(context.request)).nom);
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
  const [membres, dispos, soirees, reponses, chauds] = await db.batch([
    // LEFT JOIN : chaque membre, avec la version de sa photo s'il en a
    // une (NULL sinon). Jamais l'image elle-même : la page la demande à
    // part, par son adresse (voir photos/[id].js).
    // Et, par son compte, s'il soutient AllReady (0 sans compte).
    db.prepare(`SELECT m.id, m.pseudo, m.couleur, m.jeux, m.bio, m.perso, m.semaine_type, p.version AS photo,
                       COALESCE(c.soutien, 0) AS soutien
                FROM membres m LEFT JOIN photos p ON p.membre_id = m.id
                LEFT JOIN comptes c ON c.id = m.compte_id
                WHERE m.groupe_id = ? ORDER BY m.id`)
      .bind(groupe.id),

    db.prepare(`SELECT d.membre_id, d.creneaux FROM dispos d
                JOIN membres m ON m.id = d.membre_id
                WHERE m.groupe_id = ? AND d.semaine = ?`)
      .bind(groupe.id, semaine),

    db.prepare(`SELECT id, createur_id, titre, jeu, jeu_cover, jeu_id, jour, horaire, fin, places, note FROM soirees
                WHERE groupe_id = ? AND jour >= MIN(?, date('now', '-1 day'))
                ORDER BY jour, horaire LIMIT 200`)
      .bind(groupe.id, semaine),

    db.prepare(`SELECT r.soiree_id, r.membre_id, r.reponse FROM reponses r
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
  ]);

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
  for (const rangee of reponses.results) {
    if (!reponsesParSoiree[rangee.soiree_id]) reponsesParSoiree[rangee.soiree_id] = {};
    reponsesParSoiree[rangee.soiree_id][rangee.membre_id] = rangee.reponse;
  }

  return json(200, {
    // discord : un salon est-il branché ? Oui ou non, jamais l'adresse
    // du webhook (qui l'a peut écrire dans le salon).
    groupe: { code: groupe.code, nom: groupe.nom, discord: groupe.webhook !== '' },
    moi: moi ? moi.id : null,
    // Le nom et le pseudo Discord, sans le numéro du compte : la page
    // n'en a pas besoin.
    compte: compte ? { nom: compte.nom, discord: compte.discord } : null,
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
    })),
    dispos: disposParMembre,
    // { chauds: { 3: 8, 5: 2 } } : le nombre de « Chaud » par membre.
    stats: {
      chauds: Object.fromEntries(chauds.results.map((rangee) => [rangee.membre_id, rangee.nombre])),
    },
    soirees: soirees.results.map((soiree) => ({
      ...soiree,
      reponses: reponsesParSoiree[soiree.id] || {},
    })),
  });
}
