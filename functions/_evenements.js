/* CE QUI SE PASSE DANS UN GROUPE, EN NOTIFICATIONS (code serveur) — 5 nov. 2026

   Demandé : « notifier les gens de tout ce qu'il se passe dans leur
   groupe ». Les notifications existaient déjà pour une nouvelle soirée
   (soirees/index.js), le rappel une heure avant (api/rappels.js) et
   « une place s'est libérée » (_reponses.js). Ce fichier ajoute le
   reste, avec tous les textes au même endroit :
   — une soirée déplacée ou annulée          (sorte « soirees ») ;
   — un « Chaud » à une soirée que tu as proposée (« reponses ») ;
   — qui est dispo ce soir                   (« dispos ») ;
   — quelqu'un qui rejoint le groupe         (« membres »).

   Chaque envoi part APRÈS la réponse à la page (waitUntil, dans
   notifierGroupe et ici) : celui qui agit n'attend pas les services de
   notifications. Celui qui agit n'est jamais prévenu de son propre
   geste. Chacun peut couper une sorte de notification (comptes.notifs,
   le tri se fait dans abonnementsDe, _push.js).

   tag : une notification qui porte le même tag qu'une autre encore
   affichée la remplace au lieu de s'empiler. On s'en sert pour tenir
   UNE notification à jour (« Léa, Sam et Tom sont dispo ce soir »)
   plutôt que d'en envoyer une par personne.

   Ce fichier n'exporte aucune fonction onRequest… : Cloudflare n'en
   fait pas une adresse. */

import { casesDeCeSoir } from './_outils.js';
import { heureDuGroupe, texteMoment } from './_annonces.js';
import { notifierGroupe, notifierComptes } from './_push.js';

const adresse = (groupe) => `/groupe?g=${groupe.code}`;

/* « Léa », « Léa et Sam », « Léa, Sam et Tom », puis « Léa, Sam, Tom
   et 2 autres » : au-delà de trois noms, la notification serait coupée. */
function listeDeNoms(noms) {
  if (noms.length <= 1) return noms.join('');
  if (noms.length <= 3) return `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}`;
  return `${noms.slice(0, 3).join(', ')} et ${noms.length - 3} autre${noms.length > 4 ? 's' : ''}`;
}


/* 1. QUELQU'UN REJOINT LE GROUPE (membres.js) */
export function prevenirNouveauMembre(context, groupe, membre) {
  notifierGroupe(context, groupe, membre.id, {
    titre: groupe.nom,
    corps: `${membre.pseudo} a rejoint la team.`,
    url: adresse(groupe),
    tag: `membres-${groupe.code}`,
  }, 'membres');
}


/* 2. UNE SOIRÉE DÉPLACÉE OU ANNULÉE (soirees/[id].js). Même tag que
   l'annonce de la soirée (« soiree-12 ») : le nouveau message remplace
   l'ancien, qui n'est plus vrai. */
export function prevenirSoireeDeplacee(context, groupe, soiree, auteur) {
  notifierGroupe(context, groupe, auteur.id, {
    titre: `Soirée déplacée · ${groupe.nom}`,
    corps: `${soiree.titre} · ${texteMoment(soiree)} · par ${auteur.pseudo}`,
    url: adresse(groupe),
    tag: `soiree-${soiree.id}`,
  }, 'soirees');
}

export function prevenirSoireeAnnulee(context, groupe, soiree, auteur) {
  notifierGroupe(context, groupe, auteur.id, {
    titre: `Soirée annulée · ${groupe.nom}`,
    corps: `${soiree.titre} · ${texteMoment(soiree)} · annulée par ${auteur.pseudo}`,
    url: adresse(groupe),
    tag: `soiree-${soiree.id}`,
  }, 'soirees');
}


/* 3. UN « CHAUD » À TA SOIRÉE (_reponses.js, donc aussi depuis le bot
   Discord). Seule la personne qui a proposé la soirée est prévenue, et
   seulement quand quelqu'un d'autre PASSE à « Chaud » (redire « Chaud »
   ne compte pas). Le message donne toute la liste à jour, et le nombre
   de places s'il y en a : « Chaud : Léa, Sam et Tom · 4/5 places ». */
export function prevenirChaud(context, groupe, soiree, membreId) {
  if (!soiree.createur_id || soiree.createur_id === membreId) return;
  const db = context.env.DB;
  const site = new URL(context.request.url).origin;
  context.waitUntil((async () => {
    const [auteur, chauds] = await db.batch([
      db.prepare('SELECT compte_id FROM membres WHERE id = ?').bind(soiree.createur_id),
      db.prepare(`SELECT m.id, m.pseudo FROM reponses r JOIN membres m ON m.id = r.membre_id
                  WHERE r.soiree_id = ? AND r.reponse = 'oui' ORDER BY r.inscrit_le, m.id`)
        .bind(soiree.id),
    ]);
    const compteId = auteur.results[0]?.compte_id;
    if (!compteId) return; // un profil d'avant les comptes : pas d'appareil abonné
    const noms = chauds.results.filter((m) => m.id !== soiree.createur_id).map((m) => m.pseudo);
    // « 4/5 places », et la liste d'attente s'il y en a une (AllReady+).
    const nombre = chauds.results.length;
    const places = !soiree.places ? ''
      : ` · ${Math.min(nombre, soiree.places)}/${soiree.places} places${nombre > soiree.places ? ` · ${nombre - soiree.places} en attente` : ''}`;
    await notifierComptes(db, site, [compteId], {
      titre: soiree.titre,
      corps: `Chaud : ${listeDeNoms(noms)}${places}`,
      url: adresse(groupe),
      tag: `chauds-${soiree.id}`,
    }, 'reponses');
  })().catch((probleme) => console.error('push', probleme)));
}


/* 4. QUI EST DISPO CE SOIR (dispos.js, et /dispo du bot Discord)

   Quand un membre coche sa première heure de ce soir (de 19 h, ou de
   l'heure en cours, jusqu'à 3 h : casesDeCeSoir, à l'heure du groupe),
   le reste du groupe reçoit « Léa, Sam et Tom sont dispo ce soir ».

   Une seule fois par membre et par soirée : membres.dispo_annoncee
   retient le soir déjà annoncé. L'UPDATE … RETURNING fait la
   vérification et l'écriture d'un coup : deux enregistrements très
   rapprochés ne peuvent pas prévenir deux fois.

   Une seule notification par groupe et par soir (tag) : chaque nouveau
   dispo la remplace par la liste à jour.

   avant, apres : les cases de la semaine (« [[0,21],[0,22]] »), avant et
   après l'enregistrement ; semaine : leur lundi (« 2026-11-02 »). */
export async function prevenirDispoCeSoir(context, groupe, membre, semaine, avant, apres) {
  const { semaine: semaineDuSoir, cases } = casesDeCeSoir(heureDuGroupe(groupe.fuseau));
  if (semaine !== semaineDuSoir || !cases.length) return;
  const ceSoir = new Set(cases.map(([jour, heure]) => `${jour}-${heure}`));
  const aCeSoir = (liste) => liste.some(([jour, heure]) => ceSoir.has(`${jour}-${heure}`));
  // Seulement s'il vient de cocher ce soir (il n'avait rien ce soir avant).
  if (!aCeSoir(apres) || aCeSoir(avant)) return;

  // La date de ce soir : le lundi + le numéro du jour.
  const date = new Date(`${semaine}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + cases[0][0]);
  const soir = date.toISOString().slice(0, 10);

  const db = context.env.DB;
  const premiereFois = await db
    .prepare('UPDATE membres SET dispo_annoncee = ?1 WHERE id = ?2 AND dispo_annoncee != ?1 RETURNING id')
    .bind(soir, membre.id)
    .first();
  if (!premiereFois) return;

  /* Tous les dispos de ce soir dans le groupe, celui qui vient de
     cocher en premier. Un membre sans rien d'enregistré cette semaine
     reprend sa semaine type, comme sur l'agenda. */
  const { results } = await db
    .prepare(`SELECT m.id, m.pseudo, m.semaine_type, d.creneaux FROM membres m
              LEFT JOIN dispos d ON d.membre_id = m.id AND d.semaine = ?
              WHERE m.groupe_id = ? ORDER BY m.id`)
    .bind(semaine, groupe.id)
    .all();
  const dispos = results.filter((m) => {
    let creneaux = m.creneaux ? JSON.parse(m.creneaux) : [];
    if (!m.creneaux && m.semaine_type) {
      const modele = JSON.parse(m.semaine_type);
      if (modele.depuis <= semaine) creneaux = modele.creneaux;
    }
    return m.id === membre.id || aCeSoir(creneaux);
  });
  const noms = [membre.pseudo, ...dispos.filter((m) => m.id !== membre.id).map((m) => m.pseudo)];
  notifierGroupe(context, groupe, membre.id, {
    titre: groupe.nom,
    corps: `${listeDeNoms(noms)} ${noms.length > 1 ? 'sont' : 'est'} dispo ce soir.`,
    url: adresse(groupe),
    tag: `dispos-${groupe.code}-${soir}`,
  }, 'dispos');
}
