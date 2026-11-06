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


/* LE MODE APPLI (6 nov. 2026, demandé : « je veux une vraie
   application »)

   Ouvert depuis l'appli Android (ou le site installé par le
   navigateur), AllReady prend une allure d'appli : la classe « appli »
   posée sur <html> change la mise en page (style.css, « Le mode
   appli »). « standalone » : affiché sans barre d'adresse, comme une
   appli. navigator.standalone : l'équivalent sur iPhone.

   Ici, avant l'affichage, pour trois raisons : la page s'affiche
   directement dans sa forme d'appli (pas de vitrine entrevue une
   fraction de seconde) ; l'appli Android donne sa version dans
   l'adresse (/?appli=3), qu'il faut lire avant de partir ailleurs ; et
   l'ouverture saute directement au dernier groupe (plus bas). */
(function () {
  try {
    /* La version de l'appli Android (voir « La mise à jour de l'appli »
       dans js/appli.js) : retenue pour toute la visite (sessionStorage),
       puis effacée de l'adresse. Les versions 1 et 2 ne la donnaient pas :
       on les reconnaît à leur « referrer », l'adresse android-app://…
       que l'appli donne à la première page qu'elle ouvre. */
    const parametres = new URLSearchParams(location.search);
    if (parametres.has('appli')) {
      sessionStorage.setItem('allready-appli', parametres.get('appli'));
      parametres.delete('appli');
      const reste = parametres.toString();
      history.replaceState(null, '', location.pathname + (reste ? '?' + reste : '') + location.hash);
    } else if (document.referrer.indexOf('android-app://fr.allready.app') === 0 && !sessionStorage.getItem('allready-appli')) {
      sessionStorage.setItem('allready-appli', '2');
    }

    /* Le mode appli : affiché sans barre d'adresse, ou ouvert par
       l'appli Android pendant cette visite (la version notée juste au-
       dessus le prouve, même si le navigateur ne dit pas « standalone »). */
    const appli = matchMedia('(display-mode: standalone)').matches
      || navigator.standalone === true
      || Boolean(sessionStorage.getItem('allready-appli'));
    if (!appli) return;
    document.documentElement.classList.add('appli');

    /* L'OUVERTURE : la première page de la visite, si c'est l'accueil,
       saute au dernier groupe ouvert (retenu par groupe.js). Seulement
       la première : ensuite, le logo ramène bien à l'accueil, qui devient
       la liste de tes groupes. replace() : l'accueil ne reste pas dans
       l'historique, le bouton Retour ne ramène pas dessus pour repartir. */
    const premiere = !sessionStorage.getItem('allready-visite');
    sessionStorage.setItem('allready-visite', '1');
    const dernier = localStorage.getItem('allready-dernier-groupe');
    if (premiere && location.pathname === '/' && dernier && /^[A-Z0-9]{8}$/.test(dernier)) {
      location.replace('/groupe?g=' + dernier);
    }
  } catch {
    // Stockage bloqué ou très vieux navigateur : le site normal.
  }
})();
