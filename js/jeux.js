/* LE SÉLECTEUR DE JEUX

   Un champ de recherche relié à IGDB, la base de jeux vidéo de Twitch :
   on tape « among », la liste propose « Among Us » avec sa couverture.
   Servi deux fois par le même code :
   — dans le profil, pour choisir PLUSIEURS jeux ;
   — dans le formulaire de soirée, pour en choisir UN.

   Un jeu est un petit objet, toujours le même :
     { id: 17269, nom: "Among Us", cover: "co1r7f" }
   id et cover viennent d'IGDB. Un jeu absent d'IGDB (ou si la
   recherche est en panne) s'ajoute « tel quel » : id null, cover "".

   Pour l'accessibilité, le champ suit le modèle « combobox » : les
   flèches haut et bas parcourent les propositions, Entrée choisit,
   Échap ferme la liste, et un lecteur d'écran annonce la proposition
   surlignée (aria-activedescendant). Les attributs role, aria-controls
   et aria-expanded sont posés dans groupe.html. */

import { appeler } from './etat.js';
import { creer } from './commun.js';


/* L'IMAGE D'UN JEU

   Toujours servie par notre propre site (functions/api/couverture),
   jamais directement par IGDB. Sans couverture, un cadre de la même
   taille avec l'initiale du jeu. alt="" : le nom du jeu est toujours
   écrit juste à côté, inutile de le faire lire deux fois.

   loading="lazy" : une image hors de l'écran n'est chargée qu'à
   l'approche. width et height donnent les proportions réelles (264 ×
   374) : la place est réservée avant le chargement, rien ne sursaute. */
export function couverture(jeu, classe = '') {
  if (!jeu.cover) {
    const cadre = creer('span', `couverture couverture-vide ${classe}`, Array.from(jeu.nom)[0].toUpperCase());
    cadre.setAttribute('aria-hidden', 'true');
    return cadre;
  }
  const image = creer('img', `couverture ${classe}`);
  image.src = `/api/couverture/${jeu.cover}`;
  image.alt = '';
  image.loading = 'lazy';
  image.width = 264;
  image.height = 374;
  return image;
}

// Deux jeux sont le même s'ils ont le même numéro IGDB, ou à défaut
// (jeux ajoutés tels quels) le même nom, majuscules mises à part.
export function memeJeu(a, b) {
  return a.id && b.id ? a.id === b.id : a.nom.toLowerCase() === b.nom.toLowerCase();
}


/* LE SÉLECTEUR

   racine : l'élément .selecteur-jeux de groupe.html, qui contient la
   zone des jeux choisis, le champ, la liste des propositions et une
   petite note.

   Options :
   — multiple : plusieurs jeux (profil) ou un seul (soirée) ;
   — max : le nombre de jeux au plus ;
   — auChangement : appelé à chaque ajout ou retrait.

   Renvoie un petit objet pour piloter le sélecteur de l'extérieur :
   lire(), remplir(liste), ajouter(jeu), texte(). */
export function selecteurJeux(racine, { multiple = false, max = 12, auChangement = () => {} } = {}) {
  const zoneChoisis = racine.querySelector('.jeux-choisis');
  const champ = racine.querySelector('input');
  const liste = racine.querySelector('.resultats-jeux');
  const note = racine.querySelector('.jeux-note');
  const noteParDefaut = note.textContent; // le crédit IGDB écrit dans le HTML

  let choisis = [];      // les jeux retenus
  let propositions = []; // ce que la liste affiche
  let surligne = -1;     // la proposition sélectionnée au clavier
  let minuterie = null;
  let derniereRecherche = 0;

  function dessinerChoisis() {
    zoneChoisis.replaceChildren(...choisis.map((jeu) => {
      const puce = creer('span', 'jeu-choisi');
      const retirer = creer('button', 'jeu-retirer', '×');
      retirer.type = 'button';
      retirer.setAttribute('aria-label', `Retirer ${jeu.nom}`);
      retirer.addEventListener('click', () => {
        choisis = choisis.filter((autre) => autre !== jeu);
        dessinerChoisis();
        auChangement();
        champ.focus();
      });
      puce.append(couverture(jeu, 'mini'), creer('span', 'jeu-nom', jeu.nom), retirer);
      return puce;
    }));
    zoneChoisis.hidden = choisis.length === 0;
  }

  function ajouter(jeu) {
    // On ne garde que les trois champs utiles (pas l'année, etc.).
    const propre = { id: jeu.id || null, nom: jeu.nom, cover: jeu.cover || '' };
    if (!multiple) {
      choisis = [propre];
    } else if (!choisis.some((autre) => memeJeu(autre, propre))) {
      if (choisis.length >= max) {
        note.textContent = `${max} jeux au plus. Retires-en un pour en ajouter un autre.`;
        return;
      }
      choisis = [...choisis, propre];
    }
    champ.value = '';
    fermer();
    dessinerChoisis();
    auChangement();
  }

  function fermer() {
    liste.hidden = true;
    liste.replaceChildren();
    propositions = [];
    surligne = -1;
    champ.setAttribute('aria-expanded', 'false');
    champ.removeAttribute('aria-activedescendant');
  }

  /* La liste des propositions : les jeux trouvés, puis, en dernier,
     « Ajouter … tel quel », sauf si un jeu trouvé porte exactement ce
     nom. Chaque proposition a un id (soiree-jeu-resultats-0, -1…) pour
     que aria-activedescendant puisse la désigner. */
  function proposer(trouves) {
    const texte = champ.value.trim().slice(0, 60);
    propositions = [...trouves];
    if (texte && !trouves.some((jeu) => jeu.nom.toLowerCase() === texte.toLowerCase())) {
      propositions.push({ id: null, nom: texte, cover: '', telQuel: true });
    }

    liste.replaceChildren(...propositions.map((jeu, numero) => {
      const option = creer('li', 'resultat-jeu');
      option.id = `${liste.id}-${numero}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      if (jeu.telQuel) {
        option.classList.add('tel-quel');
        option.append(couverture(jeu, 'mini'), creer('span', 'jeu-nom', `Ajouter « ${jeu.nom} » tel quel`));
      } else {
        option.append(couverture(jeu, 'mini'), creer('span', 'jeu-nom', jeu.nom), creer('span', 'jeu-annee', jeu.annee || ''));
      }
      option.addEventListener('click', () => ajouter(jeu));
      return option;
    }));

    surligne = -1;
    liste.hidden = propositions.length === 0;
    champ.setAttribute('aria-expanded', String(!liste.hidden));
  }

  function surligner(numero) {
    surligne = numero;
    liste.querySelectorAll('[role="option"]').forEach((option, rang) => {
      option.setAttribute('aria-selected', String(rang === numero));
    });
    champ.setAttribute('aria-activedescendant', `${liste.id}-${numero}`);
    // Fait défiler la liste si la proposition est hors de vue.
    document.getElementById(`${liste.id}-${numero}`).scrollIntoView({ block: 'nearest' });
  }

  /* LA RECHERCHE

     On attend 0,3 s sans nouvelle frappe avant d'interroger le
     serveur : taper « fortnite » envoie une requête, pas huit. Chaque
     recherche reçoit un numéro, et une réponse qui arrive après une
     recherche plus récente est ignorée (même principe que charger()
     dans etat.js). */
  async function chercher(texte) {
    const numero = ++derniereRecherche;
    let trouves = [];
    note.textContent = 'Recherche…';
    try {
      trouves = (await appeler(`/jeux?q=${encodeURIComponent(texte)}`)).jeux;
      note.textContent = noteParDefaut;
    } catch (probleme) {
      // Recherche en panne ou pas configurée : on le dit, et la liste
      // propose quand même d'ajouter le jeu tel quel.
      note.textContent = probleme.message;
    }
    if (numero !== derniereRecherche || champ.value.trim() !== texte) return;
    proposer(trouves);
  }

  champ.addEventListener('input', () => {
    clearTimeout(minuterie);
    const texte = champ.value.trim();
    if (texte.length < 2) {
      fermer();
      return;
    }
    minuterie = setTimeout(() => chercher(texte), 300);
  });

  champ.addEventListener('keydown', (evenement) => {
    if (liste.hidden) return;
    const nombre = propositions.length;
    if (evenement.key === 'ArrowDown' || evenement.key === 'ArrowUp') {
      evenement.preventDefault(); // sinon le curseur saute en début ou fin de champ
      const pas = evenement.key === 'ArrowDown' ? 1 : -1;
      surligner((surligne + pas + nombre) % nombre);
    } else if (evenement.key === 'Enter') {
      // Entrée choisit (la proposition surlignée, sinon la première) au
      // lieu d'envoyer le formulaire.
      evenement.preventDefault();
      ajouter(propositions[Math.max(surligne, 0)]);
    } else if (evenement.key === 'Escape') {
      // Échap ferme la liste, mais pas la fenêtre autour.
      evenement.preventDefault();
      fermer();
    }
  });

  // Un clic ailleurs que dans le sélecteur ferme la liste.
  document.addEventListener('pointerdown', (evenement) => {
    if (!racine.contains(evenement.target)) fermer();
  });

  return {
    lire: () => choisis,
    remplir(jeux) {
      choisis = [...jeux];
      champ.value = '';
      note.textContent = noteParDefaut;
      fermer();
      dessinerChoisis();
    },
    ajouter,
    // Ce qui est tapé mais pas encore choisi.
    texte: () => champ.value.trim().slice(0, 60),
  };
}
