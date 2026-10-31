/* UN JEU DE MOTS SUR LE NOM DU GROUPE

   Cherche dans le nom du groupe un mot qu'on sait détourner (« jeudi »,
   « potes », « team », « gaming »…) et renvoie la phrase qui va avec.
   Elle s'affiche en petit à droite des onglets (groupe.js).

   « Si possible » : quand aucun mot du nom ne s'y prête, la fonction
   renvoie null et rien ne s'affiche. Mieux vaut pas de blague qu'une
   blague forcée.

   POUR EN AJOUTER : une ligne dans REGLES. Le motif est une expression
   régulière cherchée dans le nom écrit en minuscules et SANS accents
   (« Soirée » devient « soiree ») ; \b veut dire « début ou fin de
   mot », pour que « pro » ne se déclenche pas dans « propre ». Une
   règle peut avoir plusieurs phrases : chaque groupe en tire une.
   L'ordre compte : la première règle qui convient l'emporte. */

const REGLES = [
  // Du plus précis au plus général : la première règle qui convient
  // l'emporte. D'abord les noms de jeux, les plus drôles à détourner.
  { motif: /\bamong\b/, phrases: ['Among nous, il y a un imposteur.'] },
  { motif: /\bfortnite\b/, phrases: ['Fort-nuit en perspective.'] },
  { motif: /\bminecraft\b/, phrases: ['Mine de rien, on joue ce soir.'] },

  // « Jeudi, jeu dit » : trop beau pour passer après « potes ».
  { motif: /\bjeudi/, phrases: ['Jeudi, jeu dit : on joue.'] },

  // Les mots de bande
  { motif: /\bpotes?\b/, phrases: ['Mieux vaut pote que jamais.', 'Un vrai pote-pourri de talents.'] },
  { motif: /\bteams?\b/, phrases: ['Pas de « je » dans team… mais plein dans « jeux ».'] },
  { motif: /\bclans?\b/, phrases: ['Un clan d\'œil, et on lance la partie.'] },
  { motif: /\bcrews?\b/, phrases: ['Crew-cial : il faut que tout le monde soit là.'] },
  { motif: /\bbandes?\b/, phrases: ['Bande-annonce : une soirée se prépare.'] },
  { motif: /\bgangs?\b/, phrases: ['Gang-nam style, version manette.'] },
  { motif: /\bsquads?\b/, phrases: ['Squad goals : tous dispos le même soir.'] },
  { motif: /\b(fam|famille)\b/, phrases: ['On ne choisit pas sa famille, mais on choisit son jeu.'] },
  { motif: /\b(bros?|freres?)\b/, phrases: ['Une sacrée bro-chette de joueurs.'] },
  { motif: /\b(girls?|filles?|meufs?)\b/, phrases: ['Girl power-up.'] },
  { motif: /\b(amis?|amies?|copains?|copines?)\b/, phrases: ['Les amis de mes amis sont mes coéquipiers.'] },
  { motif: /\b(boulot|taf|bureau|collegues?|travail)\b/, phrases: ['Après le taf, le tryhard.'] },
  { motif: /\b(darons?|daronnes?|papas?|mamans?|parents?)\b/, phrases: ['Les darons du respawn.'] },

  // Le jeu
  { motif: /\bgam(e|es|er|ers|ing)\b/, phrases: ['Je game, donc je suis.'] },
  { motif: /\blan\b/, phrases: ['LAN-cez la partie !'] },
  { motif: /\braids?\b/, phrases: ['Raid-y or not, here we come.'] },
  { motif: /\bgeeks?\b/, phrases: ['Le geek-end commence quand vous voulez.'] },
  { motif: /\bnoobs?\b/, phrases: ['Noob un jour, noob toujours. Sauf ce soir.'] },
  { motif: /\bpros?\b/, phrases: ['Pros de la procrastination.'] },
  { motif: /\bboss\b/, phrases: ['Boss final : trouver un soir où tout le monde est dispo.'] },
  { motif: /\bjeux?\b/, phrases: ['Faites vos jeux, rien ne va plus.'] },

  // Les bêtes et les titres
  { motif: /\bchats?\b/, phrases: ['Chat alors, tout le monde est dispo !'] },
  { motif: /\b(loups?|wolf|wolves)\b/, phrases: ['Loup-garou ce soir ? On vote.'] },
  { motif: /\b(rois?|reines?|kings?|queens?)\b/, phrases: ['Rois du lobby, princes du respawn.'] },
  { motif: /\bpirates?\b/, phrases: ['À l\'abordage… du lobby !'] },
  { motif: /\blegend(e|es|s)?\b/, phrases: ['Légendaires, mais toujours en retard.'] },

  // Les moments, en dernier : ce sont les mots les plus courants.
  { motif: /\bvendredi/, phrases: ['Vendredi, tout est permis. Même le tryhard.'] },
  { motif: /\bweek-?ends?\b/, phrases: ['Le week-end, c\'est respawn obligatoire.'] },
  { motif: /\b(nuits?|nights?)\b/, phrases: ['Les nuits blanches sont plus belles en vocal.'] },
  { motif: /\b(soirs?|soirees?)\b/, phrases: ['Qui est chaud ce soir ? Vous, apparemment.'] },
];

/* « Soirée Fortnite » → « soiree fortnite ». normalize('NFD') sépare
   chaque lettre de son accent (é = e + ´) ; la plage ̀-ͯ
   regroupe tous ces accents détachés, qu'on retire. */
function simplifier(texte) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* Un nombre tiré du code du groupe, toujours le même pour un même
   code. Il choisit la phrase quand plusieurs conviennent : chaque
   groupe garde SA blague d'une visite à l'autre, et deux groupes au nom
   proche n'ont pas forcément la même. */
function empreinte(texte) {
  let total = 0;
  for (const lettre of texte) total = (total * 31 + lettre.charCodeAt(0)) % 1000003;
  return total;
}

/* La première règle de la liste qui reconnaît un mot du nom l'emporte :
   l'ordre de REGLES est la priorité. « Les potes du jeudi » contient
   « potes » et « jeudi » ; « jeudi » est plus haut, c'est lui qui gagne. */
export function jeuDeMots(nom, code) {
  const cherche = simplifier(nom);
  const regle = REGLES.find((candidate) => candidate.motif.test(cherche));
  if (!regle) return null;
  return regle.phrases[empreinte(code) % regle.phrases.length];
}
