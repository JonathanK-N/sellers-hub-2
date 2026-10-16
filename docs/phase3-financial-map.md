# Cartographie financière et garanties

Auteur : Jonathan Kakesa (JonathanK-N).

| Opération | Collections liées | Risque phase 2 | Traitement phase 3 |
|---|---|---|---|
| Checkout | products, orders, transactions, order_groups | stock réservé sans commande après crash | snapshot/majority, rollback, clé de requête et réponse enregistrée dans checkout_requests |
| Paiement cash | order_groups, orders | statuts partiellement appliqués ; COD assimilé à capture | transaction, COD distinct d'une réception cash |
| Initialisation fournisseur | order_groups, payment_intents et API externe | doublon après timeout | intention durable avant HTTP, référence stable ; résultat ambigu réservé pour réconciliation |
| Webhook | payment_events, order_groups, orders, transactions, financial_ledger, products si refus | capture partielle, rejet non authentifié, événement désordonné | HMAC/site + vérification API montant/devise/référence, transaction et états monotones |
| Remise/livraison | orders, transactions, financial_ledger, deliverer_wallets, deliverer_wallet_transactions | escrow libéré sans crédit ou crédit sans registre | transaction unique ; acheteur et livreur utilisent la même allocation comptable |
| Litige | disputes, orders | litige et gel désynchronisés | transaction ; refus de gel après libération/remboursement sans mécanisme de reprise comptable certifié |
| Résolution | disputes, orders, transactions | débit vendeur après retrait déjà effectué | transaction ; remboursement mobile externe indisponible donc refusé ; partiel suspendu |
| Retrait | sellers, withdrawals, financial_ledger | débit sans registre ; pending assimilé à completed | réservation transactionnelle, journal et réponse dans withdrawal_requests ; idempotence après perte de réponse ; calcul en centièmes, devise historique vérifiée ; pending/manual_review/reconciliation restent déduits du disponible |
| Worker retrait | withdrawals et API externe | double émission après crash/retry ou deux workers | claim CAS ; processing expiré→reconciliation_required ; aucune réémission automatique ni faux completed |
| Notifications/fraude | notifications, notification_outbox, fraud_outbox | effets externes dupliqués pendant retry | effets persistés dans la transaction, worker après commit ; push au moins une fois, pas exactement une fois |
| Premium | sellers, premium_subscriptions et API | activation gratuite simulée / replay prolonge l'abonnement | abonnement et webhook Premium suspendus jusqu'à certification, aucune fausse activation |

Chaque route critique exige hello confirmant replica set ou mongos. Aucun repli standalone n'exécute une écriture financière. La frontière transactionnelle utilise les primitives du driver et une boucle explicite bornée : transaction complète réessayée uniquement sur TransientTransactionError ; commit seul réessayé sur UnknownTransactionCommitResult. Le test réel a révélé que Motor 3.7.1 entre dans son context manager et committe avant sa boucle de reprise ; le premier essai de commit ambigu a donc échoué. Le cycle explicite corrige ce chemin sans supprimer le test. Callbacks exclusivement MongoDB. Les lectures, curseurs et écritures utilisent la même session via contexte par requête. Les erreurs MongoDB deviennent 503 sans exposer l'URI ni prétendre qu'un commit ambigu a été annulé.

Montants : calculs Decimal et registre en unités entières de centième ; précision supérieure à deux décimales rejetée. Les paniers multi-devises sont refusés tant qu'une conversion métier validée n'existe pas. Les montants du frontend ne déterminent pas le total. L'allocation livraison non attribuée est enregistrée comme telle et ne devient pas un revenu vendeur fictif. Le registre nouveau ne prétend pas reconstituer les écritures historiques : rapprochement et migration historiques restent nécessaires avant production.

Les tests réels MongoDB sont distincts des tests unitaires de règles métier et des certifications fournisseur. Les tests unitaires peuvent invoquer la règle sans sa frontière transactionnelle pour isoler les validations ; la nouvelle suite MongoDB invoque toujours les routes décorées. Une transaction réussie ne prouve pas qu'un opérateur a encaissé un paiement.

Limites à vérifier : réconciliation fournisseur automatique, remboursement externe, récupération historique, disponibilité multi-nœuds et commits ambigus sous coupure réelle. Les injections déterministes et l'arrêt du processus sont enregistrés séparément dans le rapport final.
