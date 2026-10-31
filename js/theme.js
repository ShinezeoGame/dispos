/* LA COULEUR CHOISIE, APPLIQUÉE AVANT L'AFFICHAGE

   Le visiteur peut choisir la couleur du site (voir js/apparence.js) ;
   son choix est rangé dans le localStorage, clé « allready-theme ».

   Ce petit script le relit et pose data-theme sur <html> (par exemple
   data-theme="neon"), ce qui suffit à recolorer tout le site (voir
   « Les thèmes » dans style.css).

   Il est chargé tout en haut de chaque page, dans <head>, et à
   l'ancienne : ni module ni defer, qui attendraient que la page soit
   construite. Sans ça, la page s'afficherait une fraction de seconde
   en orange avant de changer de couleur, un « flash » visible.

   Un thème inconnu ne correspond à aucun bloc du CSS : la page garde
   simplement l'orange par défaut. */
try {
  const theme = localStorage.getItem('allready-theme');
  if (theme) document.documentElement.dataset.theme = theme;
} catch {
  // Stockage bloqué (navigation privée stricte) : l'orange par défaut.
}
