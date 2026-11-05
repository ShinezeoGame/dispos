/* ENREGISTRER SES DISPOS DE LA SEMAINE — PUT /api/groupes/ABCD2345/dispos

   Reçoit : { semaine: "2026-11-02", creneaux: [[0,21],[0,22],[4,20]],
              repeter: true | false (facultatif) }
   (0 = lundi … 6 = dimanche ; l'heure va de HEURE_DEBUT à HEURE_FIN - 1,
   25 = 1 h du matin dans la nuit qui suit ce jour-là)

   La liste envoyée REMPLACE celle de la semaine : décocher une case,
   c'est renvoyer la liste sans elle. Une liste vide efface tout.

   LA SEMAINE TYPE (2 nov. 2026) : la case « Répéter chaque semaine » de
   l'agenda envoie « repeter ».
   — repeter: true  → cette semaine devient le modèle (membres.semaine_type) ;
   — repeter: false → plus de modèle ;
   — sans repeter   → seule la semaine change, comme une exception…
     sauf si c'est la semaine modèle elle-même : le modèle suit alors.
   Les semaines où le membre n'a rien enregistré reprennent le modèle
   (voir le chargement du groupe, [code]/index.js). */

import {
  json, erreur, lireCorps, estLundi, identifier, HEURE_DEBUT, HEURE_FIN,
} from '../../../_outils.js';
import { prevenirDispoCeSoir } from '../../../_evenements.js';

// Une case valide : un tableau de deux nombres entiers, dans l'agenda.
function caseValide(creneau) {
  return Array.isArray(creneau)
    && creneau.length === 2
    && Number.isInteger(creneau[0]) && creneau[0] >= 0 && creneau[0] <= 6
    && Number.isInteger(creneau[1]) && creneau[1] >= HEURE_DEBUT && creneau[1] < HEURE_FIN;
}

export async function onRequestPut(context) {
  const { groupe, moi, refus } = await identifier(context);
  if (refus) return refus;

  const corps = await lireCorps(context.request);
  if (!estLundi(corps.semaine)) return erreur(400, 'Semaine invalide.');

  // Au plus une fois chaque case de la semaine : au-delà, la liste
  // est forcément fausse (ou malveillante).
  const creneaux = corps.creneaux;
  const nombreDeCases = 7 * (HEURE_FIN - HEURE_DEBUT);
  if (!Array.isArray(creneaux) || creneaux.length > nombreDeCases || !creneaux.every(caseValide)) {
    return erreur(400, 'Ces créneaux ne rentrent pas dans l\'agenda.');
  }

  const db = context.env.DB;
  const texte = JSON.stringify(creneaux);

  /* Ce qui était coché AVANT (la semaine enregistrée, sinon la semaine
     type si elle s'applique) : pour savoir, après, s'il vient de se
     dire dispo ce soir (prevenirDispoCeSoir, _evenements.js). */
  const [ligne, membre] = await db.batch([
    db.prepare('SELECT creneaux FROM dispos WHERE membre_id = ? AND semaine = ?').bind(moi.id, corps.semaine),
    db.prepare('SELECT semaine_type FROM membres WHERE id = ?').bind(moi.id),
  ]);
  let avant = ligne.results[0] ? JSON.parse(ligne.results[0].creneaux) : [];
  const typeAvant = membre.results[0]?.semaine_type;
  if (!ligne.results[0] && typeAvant && JSON.parse(typeAvant).depuis <= corps.semaine) avant = JSON.parse(typeAvant).creneaux;
  const modele = JSON.stringify({ depuis: corps.semaine, creneaux });

  /* « INSERT … ON CONFLICT DO UPDATE » : crée la ligne de la semaine
     si elle n'existe pas encore, la remplace sinon. Une seule
     instruction pour les deux cas. excluded.creneaux désigne la
     valeur qu'on essayait d'insérer. */
  const instructions = [
    db.prepare(`INSERT INTO dispos (membre_id, semaine, creneaux) VALUES (?, ?, ?)
                ON CONFLICT (membre_id, semaine) DO UPDATE SET creneaux = excluded.creneaux`)
      .bind(moi.id, corps.semaine, texte),
  ];
  if (corps.repeter === true) {
    instructions.push(db.prepare('UPDATE membres SET semaine_type = ? WHERE id = ?').bind(modele, moi.id));
  } else if (corps.repeter === false) {
    instructions.push(db.prepare('UPDATE membres SET semaine_type = NULL WHERE id = ?').bind(moi.id));
  } else {
    // La semaine modèle elle-même : le modèle suit. (json_extract sur
    // NULL donne NULL : sans modèle, rien ne change.)
    instructions.push(db.prepare(`UPDATE membres SET semaine_type = ?
                                  WHERE id = ? AND json_extract(semaine_type, '$.depuis') = ?`)
      .bind(modele, moi.id, corps.semaine));
  }
  // batch : tout ou rien (une transaction).
  await db.batch(instructions);

  // Après la réponse (waitUntil) : la page n'attend pas les notifications.
  context.waitUntil(prevenirDispoCeSoir(context, groupe, moi, corps.semaine, avant, creneaux)
    .catch((probleme) => console.error('push', probleme)));
  return json(200, { ok: true });
}
