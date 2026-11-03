/* LE BOT DISCORD — POST /api/discord/interactions (AllReady+, 2 nov. 2026)

   L'adresse que Discord appelle quand quelqu'un tape une commande du
   bot ou clique sur un de ses boutons (« Interactions Endpoint URL »,
   à régler une fois dans l'application Discord : voir CLAUDE.md, « Mise
   en ligne »). Discord attend une réponse en moins de 3 secondes ; tout
   ici tient en quelques requêtes.

   Les commandes (enregistrées par _discord.js) :
   — /lier code:ABCD2345 [role:@Raid] : relie ce serveur Discord à un
     groupe AllReady+, et choisit le rôle à mentionner dans les annonces.
     Réservée aux organisateurs du groupe ;
   — /dispo : « je suis chaud ce soir », comme le bouton de l'agenda ;
   — /soirees : les cinq prochaines soirées, avec une rangée de boutons
     par soirée (Chaud, Peut-être, Pas dispo, ou un bouton par rôle).

   Qui est qui : Discord donne le numéro de la personne ; son compte
   AllReady (comptes.discord_id) puis son profil dans le groupe font le
   reste. Pas de profil : on l'invite à rejoindre le groupe sur le site.

   Les réponses du bot (type 4) : « flags: 64 » = visible seulement par
   la personne (message éphémère). allowed_mentions vide : le bot ne
   fait jamais sonner personne. */

import { peutGerer, casesDeCeSoir, REPONSES } from '../../_outils.js';
import { signatureValable } from '../../_discord.js';
import { heureDuGroupe, texteMoment } from '../../_annonces.js';
import { repondreSoiree } from '../../_reponses.js';

// Un message du bot. prive : visible par la seule personne qui a tapé.
function message(contenu, { prive = true, composants } = {}) {
  return Response.json({
    type: 4,
    data: { content: contenu, flags: prive ? 64 : 0, components: composants, allowed_mentions: { parse: [] } },
  });
}

// Le profil, dans ce groupe, de la personne Discord (ou null).
function profilDe(db, groupe, discordId) {
  return db.prepare(`SELECT m.id, m.pseudo, m.organisateur, m.semaine_type FROM membres m
                     JOIN comptes c ON c.id = m.compte_id
                     WHERE m.groupe_id = ? AND c.discord_id = ?`)
    .bind(groupe.id, discordId).first();
}

const CHAMPS_GROUPE = 'id, code, nom, premium, fuseau, guild_id';

export async function onRequestPost(context) {
  const { request, env } = context;
  const corps = await request.text();
  if (!await signatureValable(env, request, corps)) return new Response('Signature invalide.', { status: 401 });
  const interaction = JSON.parse(corps);

  // Type 1 : Discord vérifie que l'adresse répond (« PING »).
  if (interaction.type === 1) return Response.json({ type: 1 });

  const db = env.DB;
  const discordId = String(interaction.member?.user?.id || interaction.user?.id || '');
  const site = new URL(request.url).origin;
  const nomCommande = interaction.type === 2 ? interaction.data.name : null;

  if (nomCommande === 'lier') return lier(db, interaction, discordId, site);

  // Les autres commandes et les boutons : le groupe relié à ce serveur.
  const groupe = interaction.guild_id
    ? await db.prepare(`SELECT ${CHAMPS_GROUPE} FROM groupes WHERE guild_id = ?`).bind(String(interaction.guild_id)).first()
    : null;
  if (!groupe) return message("Ce serveur n'est relié à aucun groupe AllReady. Un organisateur peut le faire avec /lier.");
  const lien = `${site}/groupe?g=${groupe.code}`;
  if (!groupe.premium) return message(`Le bot Discord fait partie d'AllReady+. Ton groupe : ${lien}`);
  const profil = await profilDe(db, groupe, discordId);
  if (!profil) return message(`Rejoins d'abord « ${groupe.nom} » sur AllReady, avec ce compte Discord : ${lien}`);

  if (nomCommande === 'dispo') return dispo(db, groupe, profil);
  if (nomCommande === 'soirees') return soirees(db, groupe, lien);
  if (interaction.type === 3) return bouton(context, db, groupe, profil, String(interaction.data.custom_id));
  return message('Commande inconnue.');
}


/* /lier : le code du groupe (et, en option, un rôle). La personne doit
   organiser ce groupe sur AllReady (peutGerer), et le groupe être
   AllReady+. Un serveur ne sert qu'un groupe : on le délie d'abord de
   tout autre. */
async function lier(db, interaction, discordId, site) {
  const options = Object.fromEntries((interaction.data.options || []).map((option) => [option.name, option.value]));
  const code = String(options.code || '').trim().toUpperCase();
  const groupe = await db.prepare(`SELECT ${CHAMPS_GROUPE} FROM groupes WHERE code = ?`).bind(code).first();
  if (!groupe) return message("Aucun groupe n'a ce code. Il est à la fin du lien du groupe : …/groupe?g=CODE");
  if (!groupe.premium) return message(`Le bot Discord fait partie d'AllReady+. Ton groupe : ${site}/groupe?g=${code}`);
  const profil = await profilDe(db, groupe, discordId);
  if (!profil || !await peutGerer(db, groupe, profil)) {
    return message('Seuls les organisateurs du groupe peuvent le relier à un serveur.');
  }
  const role = options.role ? String(options.role) : '';
  await db.batch([
    db.prepare("UPDATE groupes SET guild_id = '', discord_role = '' WHERE guild_id = ?").bind(String(interaction.guild_id)),
    db.prepare('UPDATE groupes SET guild_id = ?, discord_role = ? WHERE id = ?').bind(String(interaction.guild_id), role, groupe.id),
  ]);
  return message(`Ce serveur est relié à « ${groupe.nom} ». /dispo et /soirees sont prêtes.`
    + (role ? ` Le rôle <@&${role}> sera mentionné à chaque nouvelle soirée.` : ''));
}


/* /dispo : les cases de ce soir, à l'heure du groupe (casesDeCeSoir),
   ajoutées à celles déjà cochées cette semaine. Une semaine pas encore
   enregistrée part de la semaine type, si elle s'applique : sinon,
   enregistrer la semaine effacerait le modèle pour elle. */
async function dispo(db, groupe, profil) {
  const { semaine, cases } = casesDeCeSoir(heureDuGroupe(groupe.fuseau));
  const ligne = await db.prepare('SELECT creneaux FROM dispos WHERE membre_id = ? AND semaine = ?').bind(profil.id, semaine).first();
  let deja = ligne ? JSON.parse(ligne.creneaux) : [];
  if (!ligne && profil.semaine_type) {
    const modele = JSON.parse(profil.semaine_type);
    if (modele.depuis <= semaine) deja = modele.creneaux;
  }
  const toutes = new Map([...deja, ...cases].map(([jour, heure]) => [`${jour}-${heure}`, [jour, heure]]));
  await db.prepare(`INSERT INTO dispos (membre_id, semaine, creneaux) VALUES (?, ?, ?)
                    ON CONFLICT (membre_id, semaine) DO UPDATE SET creneaux = excluded.creneaux`)
    .bind(profil.id, semaine, JSON.stringify([...toutes.values()]))
    .run();
  return message(`C'est noté, ${profil.pseudo} : chaud ce soir de ${cases[0][1] % 24}h à 3h. Ça se voit sur l'agenda.`);
}


/* /soirees : les cinq prochaines, une ligne de texte et une rangée de
   boutons chacune (Discord : 5 rangées de 5 boutons au plus). Le
   message est public : toute la team voit la liste, et chacun répond
   pour lui-même avec les boutons. custom_id : « r|soirée|réponse|rôle ». */
async function soirees(db, groupe, lien) {
  const aujourdhui = heureDuGroupe(groupe.fuseau).slice(0, 10);
  const { results } = await db
    .prepare(`SELECT s.id, s.titre, s.jour, s.horaire, s.fin, s.roles,
                (SELECT COUNT(*) FROM reponses r WHERE r.soiree_id = s.id AND r.reponse = 'oui') AS chauds
              FROM soirees s WHERE s.groupe_id = ? AND s.jour >= ? ORDER BY s.jour, s.horaire LIMIT 5`)
    .bind(groupe.id, aujourdhui)
    .all();
  if (!results.length) return message(`Aucune soirée prévue. Propose-en une : ${lien}`);
  const lignes = results.map((soiree, i) => `**${i + 1}. ${soiree.titre}** · ${texteMoment(soiree)} · ${soiree.chauds} chaud${soiree.chauds > 1 ? 's' : ''}`);
  const rangees = results.map((soiree, i) => {
    const roles = soiree.roles ? JSON.parse(soiree.roles).slice(0, 3) : [];
    const chaud = roles.length
      ? roles.map((role) => ({ type: 2, style: 1, label: `${i + 1} · ${role.nom}`, custom_id: `r|${soiree.id}|oui|${role.nom}` }))
      : [{ type: 2, style: 1, label: `${i + 1} · Chaud`, custom_id: `r|${soiree.id}|oui|` }];
    return {
      type: 1,
      components: [
        ...chaud,
        { type: 2, style: 2, label: 'Peut-être', custom_id: `r|${soiree.id}|peutetre|` },
        { type: 2, style: 2, label: 'Pas dispo', custom_id: `r|${soiree.id}|non|` },
      ],
    };
  });
  return message([...lignes, `<${lien}>`].join('\n'), { prive: false, composants: rangees });
}


/* Un bouton de /soirees : la réponse passe par repondreSoiree
   (_reponses.js), exactement comme sur le site (rôles, liste
   d'attente, place libérée). La réponse du bot n'est visible que par
   la personne qui a cliqué. */
async function bouton(context, db, groupe, profil, identifiant) {
  const [prefixe, idSoiree, reponse, role] = identifiant.split('|');
  if (prefixe !== 'r' || !REPONSES.includes(reponse)) return message('Bouton inconnu.');
  const soiree = await db
    .prepare('SELECT id, createur_id, titre, jour, horaire, places, choix, roles FROM soirees WHERE id = ? AND groupe_id = ?')
    .bind(Number(idSoiree), groupe.id)
    .first();
  if (!soiree) return message("Cette soirée n'existe plus.");
  const resultat = await repondreSoiree(context, groupe, soiree, profil.id, reponse, role);
  if (resultat.refus) return message((await resultat.refus.json()).erreur || 'Impossible pour le moment.');
  const textes = {
    oui: resultat.attente
      ? `C'est complet : tu es en liste d'attente pour « ${soiree.titre} ».`
      : `C'est noté : chaud pour « ${soiree.titre} »${role ? ` (${role})` : ''}.`,
    peutetre: `C'est noté : peut-être pour « ${soiree.titre} ».`,
    non: `C'est noté : pas dispo pour « ${soiree.titre} ».`,
  };
  return message(textes[reponse]);
}
