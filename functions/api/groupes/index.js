/* CRÉER UN GROUPE — POST /api/groupes

   L'emplacement du fichier fait l'adresse : functions/api/groupes/
   index.js répond à /api/groupes. onRequestPost : seulement aux envois
   (POST), jamais à une simple visite.

   Reçoit : { nom: "Les potes du jeudi" }
   Renvoie : { code: "ABCD2345", nom: "Les potes du jeudi" }

   Créer un groupe ne fait pas encore de toi un membre : la page du
   groupe te demande ensuite ton pseudo, comme à tous ceux qui
   arrivent par le lien. */

import { json, erreur, lireCorps, ligne, genererCode, lireFuseau } from '../../_outils.js';

export async function onRequestPost({ request, env }) {
  const corps = await lireCorps(request);
  const nom = ligne(corps.nom);
  if (nom.length < 1 || nom.length > 40) {
    return erreur(400, 'Donne un nom au groupe (40 caractères au plus).');
  }

  /* Deux groupes tirant le même code, c'est une chance sur des
     centaines de milliards. Si ça arrivait quand même, la base
     refuserait le doublon (code est UNIQUE) et _middleware.js
     afficherait « réessaie » : le second essai tirerait un autre code. */
  const code = genererCode();
  // Le fuseau du navigateur qui crée le groupe (Paris s'il n'en dit rien).
  const fuseau = lireFuseau(corps.fuseau) || 'Europe/Paris';
  await env.DB.prepare('INSERT INTO groupes (code, nom, fuseau) VALUES (?, ?, ?)').bind(code, nom, fuseau).run();

  // 201 = « créé ». Le navigateur s'en sert comme d'un 200.
  return json(201, { code, nom });
}
