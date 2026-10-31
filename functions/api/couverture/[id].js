/* UNE COUVERTURE DE JEU — GET /api/couverture/co1r7f

   Les images viennent d'IGDB, mais le navigateur les demande à NOTRE
   site : ce fichier va les chercher et les renvoie. Deux raisons :

   — aucun visiteur n'est signalé à IGDB ni à Twitch (RGPD) : c'est le
     serveur de Cloudflare qui fait la demande, pas le navigateur ;
   — la règle de sécurité du site (_headers) peut continuer à
     n'autoriser que les images du site lui-même.

   Une couverture ne change jamais (son code identifie l'image) : le
   navigateur la garde un an, et Cloudflare la garde aussi dans son
   cache, si bien qu'IGDB n'est sollicité qu'une fois par image. */

export async function onRequestGet({ params }) {
  // Le code ne contient que des minuscules et des chiffres : rien
  // d'autre ne peut se glisser dans l'adresse demandée à IGDB.
  if (!/^[a-z0-9]{1,40}$/.test(params.id)) return new Response(null, { status: 404 });

  // t_cover_big : 264 × 374 pixels, assez net même sur écran haute densité
  // pour les petites tailles affichées par le site.
  const source = await fetch(`https://images.igdb.com/igdb/image/upload/t_cover_big/${params.id}.jpg`, {
    // Option propre à Cloudflare : garder la réponse 30 jours dans son cache.
    cf: { cacheEverything: true, cacheTtl: 2592000 },
  });

  /* On ne relaie qu'une vraie photo (JPEG, PNG ou WebP). Un autre type,
     comme une page HTML ou un SVG (qui peut contenir du code), servi
     depuis notre adresse, serait une porte d'entrée pour une attaque. */
  const type = source.headers.get('Content-Type') || '';
  if (!source.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return new Response(null, { status: 404 });

  return new Response(source.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
