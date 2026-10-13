# Cycles visuels

Auteur : Jonathan Kakesa (JonathanK-N).

Cycle 1 : captures CI Chromium/Firefox/WebKit avec données synthétiques explicitement isolées. Les dix largeurs passent les contrôles de débordement. Revue visuelle desktop/mobile : identité et composition conformes à la direction retenue, mais cartes flottantes superposées incorrectement et libellé du sélecteur tronqué. Décision visuelle FAIL conservée malgré tests fonctionnels PASS.

Correction ciblée : spécificité CSS pour garantir position:absolute sur les cartes flottantes, largeur du sélecteur adaptée ; hiérarchie h2 des cartes hero et photographie de la bannière vendeurs. Captures plein écran et viewport séparées pour que la barre fixe mobile ne soit pas interprétée comme un élément au milieu de la page longue. Nouveau cycle requis.

Aucune mesure locale ne constitue une validation HTTPS de ces nouveaux designs.
