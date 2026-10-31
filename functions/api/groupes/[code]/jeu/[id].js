/* LA FICHE D'UN JEU — GET /api/groupes/ABCD2345/jeu/17269

   Renvoie : { id: 17269, nom: "Among Us", annee: 2018,
               resume: "Play with 4-15 players…",
               tags: ["Multi", "Déduction sociale", "Party game"] }

   Affichée au survol d'un jeu (js/fiche-jeu.js). Rien n'est stocké dans
   la base : on demande à IGDB au moment voulu, et le navigateur garde la
   réponse une semaine.

   Le résumé est en anglais : IGDB n'en fournit pas d'autre. Les tags,
   eux, sont traduits ici, à partir de quatre informations d'IGDB :
   les modes de jeu (le plus utile entre amis : coop, multi…), les
   genres, les thèmes, et quelques mots-clés choisis (roguelike…). */

import { json, erreur, identifier } from '../../../../_outils.js';
import { igdbConfigure, interrogerIGDB } from '../../../../_igdb.js';

// Les noms d'IGDB → nos tags. Un nom absent de la liste est ignoré :
// mieux vaut moins de tags que des tags en anglais au milieu du français.
const MODES = {
  'Co-operative': 'Coop', 'Multiplayer': 'Multi', 'Split screen': 'Écran partagé',
  'Battle Royale': 'Battle royale', 'Massively Multiplayer Online (MMO)': 'MMO', 'Single player': 'Solo',
};
const GENRES = {
  'Shooter': 'Tir', 'Fighting': 'Combat', 'Platform': 'Plateforme', 'Puzzle': 'Réflexion',
  'Racing': 'Course', 'Role-playing (RPG)': 'RPG', 'Simulator': 'Simulation', 'Sport': 'Sport',
  'Strategy': 'Stratégie', 'Real Time Strategy (RTS)': 'Stratégie temps réel',
  'Turn-based strategy (TBS)': 'Tour par tour', 'Tactical': 'Tactique',
  "Hack and slash/Beat 'em up": "Beat'em all", 'Adventure': 'Aventure', 'Indie': 'Indé',
  'Arcade': 'Arcade', 'Music': 'Musique', 'Card & Board Game': 'Cartes et plateau',
  'MOBA': 'MOBA', 'Quiz/Trivia': 'Quiz', 'Visual Novel': 'Visual novel', 'Point-and-click': 'Point & click',
};
const THEMES = {
  'Horror': 'Horreur', 'Survival': 'Survie', 'Science fiction': 'Science-fiction',
  'Fantasy': 'Fantasy', 'Action': 'Action', 'Thriller': 'Thriller', 'Comedy': 'Comédie',
  'Open world': 'Monde ouvert', 'Sandbox': 'Bac à sable', 'Stealth': 'Infiltration',
  'Warfare': 'Guerre', 'Party': 'Party game', 'Historical': 'Historique', 'Mystery': 'Mystère',
  'Business': 'Gestion', 'Drama': 'Drame', '4X (explore, expand, exploit, and exterminate)': '4X',
};
// Les mots-clés d'IGDB sont très nombreux : seuls ceux-ci deviennent des tags.
const MOTS_CLES = {
  'roguelike': 'Roguelike', 'roguelite': 'Roguelite', 'soulslike': 'Soulslike',
  'metroidvania': 'Metroidvania', 'deckbuilding': 'Deckbuilding', 'deck building': 'Deckbuilding',
  'social deduction': 'Déduction sociale', 'survival horror': 'Survival horror',
  'permadeath': 'Mort permanente', 'crafting': 'Craft', 'pixel art': 'Pixel art',
};

// [{ name: "Horror" }, …] → ["Horreur", …], en ne gardant que les noms connus.
function traduire(liste, table) {
  return (liste || []).map((element) => table[element.name] || table[element.name.toLowerCase()]).filter(Boolean);
}

/* Un résumé de 300 caractères au plus, coupé à la fin d'une phrase si
   possible, sinon à la fin d'un mot, avec « … ». */
function raccourcir(texte) {
  if (!texte || texte.length <= 300) return texte || '';
  const debut = texte.slice(0, 300);
  const finPhrase = debut.lastIndexOf('. ');
  return finPhrase > 150 ? debut.slice(0, finPhrase + 1) : debut.slice(0, debut.lastIndexOf(' ')) + '…';
}

export async function onRequestGet(context) {
  const { refus } = await identifier(context, false);
  if (refus) return refus;
  if (!igdbConfigure(context.env)) return erreur(503, 'Infos du jeu indisponibles.');

  // Le numéro finit dans la requête IGDB : seulement des chiffres.
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return erreur(404, 'Jeu inconnu.');

  let jeu;
  try {
    const reponse = await interrogerIGDB(context.env,
      `fields name, summary, first_release_date, game_modes.name, genres.name, themes.name, keywords.name; where id = ${id};`);
    if (!reponse.ok) throw new Error(`IGDB a répondu ${reponse.status}.`);
    [jeu] = await reponse.json();
  } catch (probleme) {
    console.error(probleme);
    return erreur(502, 'Infos du jeu indisponibles.');
  }
  if (!jeu) return erreur(404, 'Jeu inconnu.');

  /* Les tags, dans l'ordre d'utilité entre amis, six au plus :
     — les modes (peut-on y jouer ensemble ?), sans « Solo » dès qu'il y
       a un mode à plusieurs : entre amis, l'info n'apporte rien ;
     — les mots-clés choisis (Roguelike…), puis les thèmes (Horreur…),
       qui disent l'ambiance ;
     — les genres, avec « Indé » en dernier : c'est le moins parlant.
     new Set retire les doublons (« Battle royale » peut venir des modes
     et des mots-clés). */
  let modes = traduire(jeu.game_modes, MODES);
  if (modes.length > 1) modes = modes.filter((mode) => mode !== 'Solo');
  const genres = traduire(jeu.genres, GENRES);
  const tags = [...new Set([
    ...modes,
    ...traduire(jeu.keywords, MOTS_CLES),
    ...traduire(jeu.themes, THEMES),
    ...genres.filter((genre) => genre !== 'Indé'),
    ...genres.filter((genre) => genre === 'Indé'),
  ])].slice(0, 6);

  return json(200, {
    id,
    nom: jeu.name,
    annee: jeu.first_release_date ? new Date(jeu.first_release_date * 1000).getUTCFullYear() : null,
    resume: raccourcir(jeu.summary),
    tags,
  }, { 'Cache-Control': 'private, max-age=604800' }); // une semaine, en secondes
}
