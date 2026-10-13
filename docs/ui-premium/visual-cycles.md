# Cycles visuels

Auteur : Jonathan Kakesa (JonathanK-N).

Cycle 1 : captures CI Chromium/Firefox/WebKit avec données synthétiques explicitement isolées. Les dix largeurs passent les contrôles de débordement. Revue visuelle desktop/mobile : identité et composition conformes à la direction retenue, mais cartes flottantes superposées incorrectement et libellé du sélecteur tronqué. Décision visuelle FAIL conservée malgré tests fonctionnels PASS.

Correction ciblée : spécificité CSS pour garantir position:absolute sur les cartes flottantes, largeur du sélecteur adaptée ; hiérarchie h2 des cartes hero et photographie de la bannière vendeurs. Captures plein écran et viewport séparées pour que la barre fixe mobile ne soit pas interprétée comme un élément au milieu de la page longue. Nouveau cycle requis.

Aucune mesure locale ne constitue une validation HTTPS de ces nouveaux designs.

Cycle 2 : le test géométrique visible révèle à 768 px un dépassement réel de 2,63 px (rotation de la deuxième carte). Les cartes flottantes, prévues pour desktop, sont maintenant masquées jusqu’à 1100 px ; les mêmes produits restent disponibles dans le catalogue. Aucun seuil changé. Le premier essai du contrôle incluait à tort les rectangles nuls des cartes mobiles masquées ; cette erreur de harness est corrigée séparément. Firefox/WebKit absents localement sont UNAVAILABLE, mais les trois moteurs ont passé le premier cycle CI.
