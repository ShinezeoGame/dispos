/* SE DÉCONNECTER — POST /api/compte/deconnexion

   Efface la session de la base et demande au navigateur d'oublier son
   cookie. POST et pas GET : une simple visite (une image piégée, un
   lien) ne doit pas pouvoir te déconnecter à ton insu.

   Renvoie : { ok: true } */

import { json, fermerSession } from '../../_outils.js';

export async function onRequestPost({ request, env }) {
  return json(200, { ok: true }, { 'Set-Cookie': await fermerSession(request, env.DB) });
}
