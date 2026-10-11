# Validations fonctionnelles et financières

Auteur : Jonathan Kakesa (JonathanK-N).

PASS : création de commandes sur Mongo replica set réel, stock concurrent, annulation et reprise aux frontières d'écriture, idempotence après interruption, conflits de payload, remise cash, litiges, journal équilibré, retraits concurrents et réservation idempotente. Les routes décorées sont réellement exécutées par les tests transactionnels ; les tests unitaires séparés vérifient seulement leurs règles métier.

Deux erreurs serveur sont injectées avec configureFailPoint sur le Mongo de test isolé : erreur 112 TransientTransactionError pendant une mise à jour et erreur 91 UnknownTransactionCommitResult au commit. L'injection est consommée, puis les tests contrôlent une seule commande, un seul débit stock et une réponse rejouable. Un processus backend est aussi arrêté brutalement avec os._exit ; un nouveau contexte confirme le rollback et la reprise.

La première boucle de commit ambigu a échoué : le contexte start_transaction de Motor commettait avant la boucle de reprise attendue. La correction explicite sépare reprise du callback et reprise du commit. Le test est conservé, sans raccourci ni suppression.

PASS : un portefeuille livreur en USD ou de devise inconnue bloque le crédit CDF avant tout commit. Un barème fixe CDF ne s'applique pas à une commande USD. FC est traité comme l'alias monétaire CDF, sans conversion.

BLOCKED : parcours financiers complets sur Railway avec candidat API, paiement réel fournisseur, achat réel, remboursement fournisseur et comparaison bancaire. Le staging servi avant application contient encore l'API de phase 2 ; ses résultats ne certifient pas le backend rc.3.

NOT IMPLEMENTED : remboursement fournisseur et activation premium certifiée. Les routes concernées restent bloquées plutôt que d'afficher une réussite. Les remboursements partiels restent suspendus selon la décision du propriétaire. Les notifications après commit utilisent une outbox avec reprise ; leur livraison est au moins une fois, pas exactement une fois.

Les historiques financiers antérieurs ne sont pas reconstruits automatiquement. Leur réconciliation reste un préalable de production, notamment les commissions, frais, devises et crédits déjà libérés.

Preuve principale : backend-test-results.xml accompagné du SHA/run dans ci-manifest.json. Les anciens XML locaux ne remplacent pas la suite finale en CI.

Une exécution locale Windows ciblée avait affiché 22 tests réussis puis une erreur fatale de nettoyage 0x8007000e ; elle n’est pas utilisée comme preuve d’un processus local entièrement sain. La preuve de référence est la suite Linux CI finale de 88 tests, sans échec ni ignoré.
