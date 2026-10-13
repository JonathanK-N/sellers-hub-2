# Cycles visuels

Auteur : Jonathan Kakesa (JonathanK-N).

Cycle 1 : captures CI Chromium/Firefox/WebKit avec données synthétiques explicitement isolées. Les dix largeurs passent les contrôles de débordement. Revue visuelle desktop/mobile : identité et composition conformes à la direction retenue, mais cartes flottantes superposées incorrectement et libellé du sélecteur tronqué. Décision visuelle FAIL conservée malgré tests fonctionnels PASS.

Correction ciblée : spécificité CSS pour garantir position:absolute sur les cartes flottantes, largeur du sélecteur adaptée ; hiérarchie h2 des cartes hero et photographie de la bannière vendeurs. Captures plein écran et viewport séparées pour que la barre fixe mobile ne soit pas interprétée comme un élément au milieu de la page longue. Nouveau cycle requis.

Aucune mesure locale ne constitue une validation HTTPS de ces nouveaux designs.

Cycle 2 : le test géométrique visible révèle à 768 px un dépassement réel de 2,63 px (rotation de la deuxième carte). Les cartes flottantes, prévues pour desktop, sont maintenant masquées jusqu’à 1100 px ; les mêmes produits restent disponibles dans le catalogue. Aucun seuil changé. Le premier essai du contrôle incluait à tort les rectangles nuls des cartes mobiles masquées ; cette erreur de harness est corrigée séparément. Firefox/WebKit absents localement sont UNAVAILABLE, mais les trois moteurs ont passé le premier cycle CI.

Cycle 4 : le premier audit local avec catalogue réel échoue en performance. Le profil du poste a un benchmark CPU 252–354,5 ; ces échecs restent conservés et ne sont pas imputés exclusivement au matériel. Accessibilité 96, BP et SEO 100. Deux anomalies exactes corrigées : contraste des mentions Photo à venir (4,14 au lieu de 4,5) et nom accessible des liens qui omettait ce texte visible. Audits froids supplémentaires en CI, mêmes seuils et même Lighthouse 13.5, sur configuration de proxy local en lecture seule. Aucun résultat local ne certifie HTTPS.

Cycle 5 : diagnostic tactile réel, premier Intl.NumberFormat fr-FR = 183,2 ms, début 2091,9 ms ; LCP observé ensuite à 2596 ms. Grille à 915,4 px, premier prix à 1085,8 px, viewport 823 px. Rendu du catalogue différé par IntersectionObserver jusqu’à visibilité, ou immédiatement à interaction clavier dans la section. Une fois révélé, il reste monté. Pas de condition spécifique au scanner ni délai artificiel. Le chargement des profils boutiques suit la révélation du catalogue. Les cartes hero desktop restent immédiates ; leur DOM ne se crée plus sur mobile. Les tests défilent normalement jusqu’au catalogue pour contrôler les vrais produits, puis remontent pour les captures.

Intégration de recherche : audit révèle que q recherchait seulement les noms/descriptions de produits, alors que la barre annonce aussi les boutiques. Les deux branches ajoutent une recherche littérale du shop_name avec projection des seuls IDs, sans écritures ni changement de schéma. Tests Mongo dédiés, exclusivement dans une base jetable loopback : filtres pays/catégorie/vérification et documents inchangés. Le pays choisi suit les liens de recherche publics ; le pays du compte authentifié garde sa priorité. Cette amélioration API n’est pas exécutée par le staging actuel tant qu’un déploiement distinct n’est pas approuvé.

Titres complets : suppression du clamp des noms de produits ; cartes flottantes desktop en grille dans le flux, pour adapter le hero aux titres réels sans les couper. Les photos absentes sont nommées Photo non disponible, sans promesse d’ajout. Les squelettes réservent la hauteur des informations et n’animent leurs lignes que lorsque la grille est visible.
