/* LA PHOTO DE PROFIL D'UN MEMBRE — /api/groupes/ABCD2345/photos/12

   GET    : l'image elle-même, pour les balises <img> de la page. Ouvert
            à qui a le lien du groupe, comme la liste des membres.
   PUT    : remplace TA photo. Reçoit { image: "base64…", type: "image/webp" }.
   DELETE : retire TA photo (l'avatar redevient l'emoji ou l'initiale).

   Le navigateur a déjà recadré et réduit la photo (160 × 160 px, voir
   js/profil.js) : elle pèse une dizaine de Ko. Le serveur ne lui fait
   pas confiance pour autant : il vérifie que c'est vraiment une image
   (ses premiers octets) et qu'elle n'est pas trop lourde. */

import { json, erreur, lireCorps, identifier, genererJeton, adressePhoto } from '../../../../_outils.js';

// 50 Ko au plus : vingt fois la taille d'une photo préparée par la page.
const TAILLE_MAX = 50000;

/* Chaque format d'image commence par une « signature », toujours les
   mêmes octets. On vérifie qu'elle correspond au type annoncé : un
   fichier HTML ou un script rebaptisé « image » serait refusé. Pas de
   SVG : c'est du code, il pourrait contenir un script. */
const SIGNATURES = {
  'image/jpeg': (o) => o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff,
  'image/png': (o) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((octet, i) => o[i] === octet),
  // « RIFF », 4 octets de taille, puis « WEBP » (codes des lettres).
  'image/webp': (o) => String.fromCharCode(...o.slice(0, 4)) === 'RIFF' && String.fromCharCode(...o.slice(8, 12)) === 'WEBP',
};

// Le texte base64 → les octets de l'image, ou null s'il est illisible.
// atob décode le base64 en une chaîne dont chaque caractère est un octet.
function octetsDe(base64) {
  try {
    return Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0));
  } catch {
    return null;
  }
}


export async function onRequestGet(context) {
  const { groupe, refus } = await identifier(context, false);
  if (refus) return refus;

  // La photo, seulement si ce membre est bien dans CE groupe : le code
  // d'un groupe ne doit pas ouvrir les photos d'un autre.
  const photo = await context.env.DB
    .prepare(`SELECT p.type, p.image FROM photos p
              JOIN membres m ON m.id = p.membre_id
              WHERE p.membre_id = ? AND m.groupe_id = ?`)
    .bind(Number(context.params.id), groupe.id)
    .first();
  if (!photo) return erreur(404, 'Pas de photo.');

  /* L'adresse change à chaque nouvelle photo (?v=, voir adressePhoto) :
     le navigateur peut donc garder celle-ci un an sans redemander
     (immutable). « private » : gardée par le navigateur seulement,
     jamais par un relais partagé, la photo n'est pas publique.
     nosniff : le navigateur croit le type annoncé, sans le deviner. */
  return new Response(octetsDe(photo.image), {
    headers: {
      'Content-Type': photo.type,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}


// PUT et DELETE : seulement sur ta propre photo. Renvoie { moi } ou { refus }.
async function moiSeulement(context) {
  const { moi, refus } = await identifier(context);
  if (refus) return { refus };
  if (Number(context.params.id) !== moi.id) return { refus: erreur(403, 'Tu ne peux changer que ta propre photo.') };
  return { moi };
}


export async function onRequestPut(context) {
  const { moi, refus } = await moiSeulement(context);
  if (refus) return refus;

  const corps = await lireCorps(context.request);
  const type = corps.type;
  const image = typeof corps.image === 'string' ? corps.image : '';
  if (!SIGNATURES[type]) return erreur(400, 'Format accepté : JPEG, PNG ou WebP.');

  // Le base64 grossit les données d'un tiers : au-delà, inutile de décoder.
  if (image.length > TAILLE_MAX * 1.4) return erreur(413, 'Cette image est trop lourde.');
  const octets = octetsDe(image);
  if (!octets || octets.length > TAILLE_MAX || !SIGNATURES[type](octets)) {
    return erreur(400, "Ce fichier n'est pas une image valable.");
  }

  /* Enregistre, ou remplace l'ancienne photo (ON CONFLICT : ce membre
     en a déjà une). Une version neuve, 8 caractères au hasard, change
     l'adresse de l'image partout. */
  const version = genererJeton().slice(0, 8);
  await context.env.DB
    .prepare(`INSERT INTO photos (membre_id, type, image, version) VALUES (?, ?, ?, ?)
              ON CONFLICT (membre_id) DO UPDATE SET type = excluded.type, image = excluded.image, version = excluded.version`)
    .bind(moi.id, type, image, version)
    .run();

  return json(200, { photo: adressePhoto(context.params.code.toUpperCase(), moi.id, version) });
}


export async function onRequestDelete(context) {
  const { moi, refus } = await moiSeulement(context);
  if (refus) return refus;
  await context.env.DB.prepare('DELETE FROM photos WHERE membre_id = ?').bind(moi.id).run();
  return json(200, { photo: null });
}
