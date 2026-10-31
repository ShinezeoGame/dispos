/* LE PASSAGE OBLIGÉ DE TOUTES LES ADRESSES /api/…

   Un fichier nommé _middleware.js est spécial pour Cloudflare : il
   s'exécute AVANT chaque route de son dossier et de ses sous-dossiers.
   Celui-ci fait trois choses une seule fois, au lieu de les répéter
   dans chaque fichier :

   1. vérifier que la base de données est bien branchée ;
   2. créer les tables si elles n'existent pas encore ;
   3. rattraper n'importe quelle erreur imprévue pour renvoyer un
      message lisible plutôt qu'une page d'erreur brute. */

import { SCHEMA, erreur } from '../_outils.js';

/* Cette variable vit tant que le serveur de Cloudflare reste allumé
   (quelques minutes à quelques heures). Les tables ne sont donc
   vérifiées qu'à la première requête de chaque serveur, pas à
   chacune. */
let basePrete = false;

export async function onRequest(context) {
  /* env.DB n'existe que si la base a été reliée au projet dans le
     tableau de bord (Settings → Bindings, nom de variable « DB »). Le
     dire en clair évite de chercher pendant une heure pourquoi rien
     ne marche. */
  const db = context.env.DB;
  if (!db) {
    return erreur(500, "La base de données n'est pas branchée sur Cloudflare (liaison D1 nommée DB).");
  }

  try {
    if (!basePrete) {
      // batch() envoie toutes les lignes d'un coup, en un seul aller-retour.
      await db.batch(SCHEMA.map((instruction) => db.prepare(instruction)));
      basePrete = true;
    }
    // next() passe la main à la route demandée (groupes/index.js, etc.).
    return await context.next();
  } catch (probleme) {
    // Visible dans le tableau de bord Cloudflare, onglet des journaux
    // (logs) du projet, jamais montré au visiteur.
    console.error(probleme);
    return erreur(500, 'Le serveur a eu un souci. Réessaie dans un instant.');
  }
}
