/* RECADRER SA PHOTO DE PROFIL

   Après le choix d'une image (case « + » du profil), une fenêtre
   s'ouvre : la photo dans un carré, et un cercle qui montre ce qui
   sera gardé (l'avatar est rond). On la fait glisser pour la placer ;
   on zoome avec le curseur, la molette, ou en pinçant sur téléphone.
   « Valider » découpe la partie visible et la réduit à 160 × 160.

   Tout se passe dans le navigateur, sans bibliothèque : un <canvas>
   (une zone de dessin) où la photo est redessinée à chaque mouvement.

   recadrerPhoto(fichier, fond) renvoie une promesse qui donne :
   — la photo recadrée, en « data URL » (data:image/webp;base64,…) ;
   — null si on a annulé (Annuler, la croix, Échap, clic à côté) ;
   — une erreur si le fichier n'est pas une image lisible. */

const TAILLE_PHOTO = 160; // la photo finale, en pixels (deux fois le plus grand avatar, pour les écrans fins)
const COTE_MAX = 1600;    // la photo de travail : assez pour zoomer ×4 et garder 400 px de détail
const ZOOM_MAX = 4;

const dialogue = document.getElementById('dialogue-recadrage');
const zone = document.getElementById('recadrage-zone');
const toile = document.getElementById('recadrage-toile');
const curseurZoom = document.getElementById('recadrage-zoom');
const pinceau = toile.getContext('2d');

/* L'état du recadrage, en pixels de la zone à l'écran :
   — cote : la taille de la zone carrée ;
   — echelle0 : l'échelle où la photo couvre tout juste la zone (zoom 1) ;
   — zoom : de 1 à 4 ;
   — x, y : la position du coin haut gauche de la photo dans la zone.
     Négatifs : la photo déborde à gauche et en haut, c'est normal. */
let image = null;
let fond = '';
let cote = 0;
let echelle0 = 1;
let zoom = 1;
let x = 0;
let y = 0;
let terminer = null; // la fonction qui donne sa réponse à la promesse en cours

const echelle = () => echelle0 * zoom;

// La photo couvre toujours toute la zone : jamais de bord vide dans le cercle.
function borner() {
  x = Math.min(0, Math.max(cote - image.width * echelle(), x));
  y = Math.min(0, Math.max(cote - image.height * echelle(), y));
}

/* Redessine la photo à sa place. devicePixelRatio : sur un écran fin,
   un pixel CSS en vaut 2 ou 3 vrais ; le canvas est dessiné à cette
   densité pour rester net. */
function dessiner() {
  const densite = window.devicePixelRatio || 1;
  pinceau.setTransform(densite, 0, 0, densite, 0, 0);
  pinceau.clearRect(0, 0, cote, cote);
  pinceau.drawImage(image, x, y, image.width * echelle(), image.height * echelle());
}

/* Zoome en gardant immobile le point (cx, cy) de la zone : le centre
   pour le curseur, le pointeur pour la molette, le milieu des deux
   doigts pour le pincement. Le point de la photo qui était sous
   (cx, cy) y reste : sa distance au coin grandit dans la même
   proportion que l'échelle. */
function zoomer(nouveau, cx = cote / 2, cy = cote / 2) {
  const avant = echelle();
  zoom = Math.min(ZOOM_MAX, Math.max(1, nouveau));
  x = cx - (cx - x) * (echelle() / avant);
  y = cy - (cy - y) * (echelle() / avant);
  borner();
  curseurZoom.value = zoom;
  dessiner();
}

function deplacer(dx, dy) {
  x += dx;
  y += dy;
  borner();
  dessiner();
}


/* GLISSER ET PINCER

   Les « pointer events » traitent pareil la souris, le doigt et le
   stylet. On retient chaque pointeur posé sur la zone : un seul, on
   déplace ; deux (deux doigts), on zoome selon l'écart entre eux.
   setPointerCapture : la zone continue de suivre le pointeur même s'il
   sort du cadre en cours de geste. touch-action: none (style.css)
   empêche le téléphone de faire défiler la page à la place. */
const pointeurs = new Map(); // numéro du pointeur → sa position { x, y }
let ecartPince = 0;

function position(evenement) {
  const cadre = zone.getBoundingClientRect();
  return { x: evenement.clientX - cadre.left, y: evenement.clientY - cadre.top };
}

function ecartDesDoigts() {
  const [a, b] = [...pointeurs.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

zone.addEventListener('pointerdown', (evenement) => {
  zone.setPointerCapture(evenement.pointerId);
  pointeurs.set(evenement.pointerId, position(evenement));
  if (pointeurs.size === 2) ecartPince = ecartDesDoigts();
});

zone.addEventListener('pointermove', (evenement) => {
  if (!pointeurs.has(evenement.pointerId)) return;
  const avant = pointeurs.get(evenement.pointerId);
  const apres = position(evenement);
  pointeurs.set(evenement.pointerId, apres);
  if (pointeurs.size === 1) {
    deplacer(apres.x - avant.x, apres.y - avant.y);
  } else if (pointeurs.size === 2) {
    const ecart = ecartDesDoigts();
    const [a, b] = [...pointeurs.values()];
    zoomer(zoom * (ecart / ecartPince), (a.x + b.x) / 2, (a.y + b.y) / 2);
    ecartPince = ecart;
  }
});

function lever(evenement) {
  pointeurs.delete(evenement.pointerId);
  if (pointeurs.size === 2) ecartPince = ecartDesDoigts();
}
zone.addEventListener('pointerup', lever);
zone.addEventListener('pointercancel', lever);

/* La molette zoome autour du pointeur. Math.exp : chaque cran
   multiplie le zoom par le même facteur, la sensation reste régulière.
   passive: false et preventDefault : sinon la molette ferait aussi
   défiler la page derrière. */
zone.addEventListener('wheel', (evenement) => {
  evenement.preventDefault();
  const point = position(evenement);
  zoomer(zoom * Math.exp(-evenement.deltaY * 0.002), point.x, point.y);
}, { passive: false });

curseurZoom.addEventListener('input', () => zoomer(Number(curseurZoom.value)));

// Au clavier, la zone ayant le focus : les flèches déplacent la photo,
// + et - zooment.
zone.addEventListener('keydown', (evenement) => {
  const pas = 10;
  const fleches = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] };
  if (fleches[evenement.key]) deplacer(...fleches[evenement.key]);
  else if (evenement.key === '+' || evenement.key === '=') zoomer(zoom * 1.1);
  else if (evenement.key === '-') zoomer(zoom / 1.1);
  else return;
  evenement.preventDefault(); // pas de défilement de la page
});


/* DÉCOUPER

   La partie visible de la zone, ramenée en pixels de la photo :
   elle commence en (-x, -y) divisés par l'échelle, et mesure
   cote / échelle de côté. On la dessine réduite à 160 × 160, sur un
   fond de ta couleur pour les images transparentes. toDataURL en tire
   une image WebP ; Safari ne sait pas en faire (il rendrait du PNG,
   bien plus lourd) : on demande alors du JPEG. */
function decouper() {
  const sortie = document.createElement('canvas');
  sortie.width = TAILLE_PHOTO;
  sortie.height = TAILLE_PHOTO;
  const crayon = sortie.getContext('2d');
  crayon.imageSmoothingQuality = 'high'; // une réduction plus douce
  crayon.fillStyle = fond;
  crayon.fillRect(0, 0, TAILLE_PHOTO, TAILLE_PHOTO);
  const s = echelle();
  crayon.drawImage(image, -x / s, -y / s, cote / s, cote / s, 0, 0, TAILLE_PHOTO, TAILLE_PHOTO);
  const webp = sortie.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : sortie.toDataURL('image/jpeg', 0.85);
}


/* LIRE LE FICHIER

   createImageBitmap lit l'image (JPEG, PNG, WebP, HEIC sur iPhone…) et
   la tourne dans le bon sens. Une photo de téléphone fait souvent
   4000 px : on la réduit d'abord à 1600 px au plus, pour que la
   glisser reste fluide. Si le navigateur ne sait pas réduire ainsi
   (vieux Safari), on garde la grande : plus lent, mais ça marche. */
async function lireImage(fichier) {
  const lue = await createImageBitmap(fichier);
  const plusGrand = Math.max(lue.width, lue.height);
  if (plusGrand <= COTE_MAX) return lue;
  try {
    const rapport = COTE_MAX / plusGrand;
    const reduite = await createImageBitmap(lue, {
      resizeWidth: Math.round(lue.width * rapport),
      resizeHeight: Math.round(lue.height * rapport),
      resizeQuality: 'high',
    });
    lue.close();
    return reduite;
  } catch {
    return lue;
  }
}


/* OUVRIR LA FENÊTRE

   La photo part centrée, au plus petit zoom (elle couvre tout juste
   le carré). La taille de la zone ne se mesure qu'une fois la fenêtre
   ouverte : avant, elle est cachée et mesure 0. */
export async function recadrerPhoto(fichier, couleurDeFond) {
  image = await lireImage(fichier); // une erreur ici remonte à profil.js
  fond = couleurDeFond;
  dialogue.returnValue = ''; // oublie le « ok » de la fois précédente
  dialogue.showModal();

  cote = zone.clientWidth;
  const densite = window.devicePixelRatio || 1;
  toile.width = Math.round(cote * densite);
  toile.height = Math.round(cote * densite);
  echelle0 = cote / Math.min(image.width, image.height);
  zoom = 1;
  curseurZoom.value = 1;
  x = (cote - image.width * echelle0) / 2;
  y = (cote - image.height * echelle0) / 2;
  dessiner();

  return new Promise((resoudre) => {
    terminer = (resultat) => {
      terminer = null;
      image.close(); // libère la mémoire de la photo de travail
      image = null;
      pointeurs.clear();
      resoudre(resultat);
    };
  });
}

/* La fenêtre se ferme, de n'importe quelle façon. Seul « Valider »
   (bouton value="ok" d'un formulaire method="dialog") laisse « ok »
   dans returnValue : on découpe. Tout le reste annule. */
dialogue.addEventListener('close', () => {
  if (terminer) terminer(dialogue.returnValue === 'ok' ? decouper() : null);
});
