# Matrice des 26 scénarios

Tous les modèles ont une version HTML et une version texte. Les douze fichiers fournis sont conservés ; les quatorze extensions reprennent leur structure visuelle. Les destinataires de compte doivent avoir une adresse vérifiée. Une invitation peut être envoyée à l’adresse explicitement choisie par le vendeur, sans créer de compte ni contourner les contrôles.

| Scénario | Raccordement / limite |
|---|---|
| welcome | Après vérification effective de l’adresse ; une fois par compte/adresse destinataire |
| verify_email | Demande authentifiée, lien 24 h, usage unique |
| password_reset | Réponse générique, adresse vérifiée, lien 30 min ; OTP téléphone conservé |
| password_changed | Après consommation et changement atomiques ; incrément auth_version |
| suspicious_login | Modèle prêt ; pas de moteur fiable de détection existant, donc non émis automatiquement |
| deliverer_invitation | Création/renvoi par vendeur propriétaire, lien 48 h, génération et destinataire liés |
| invitation_accepted | Acceptation authentifiée par le compte acheteur à l’adresse vérifiée correspondante ; notification au vendeur éligible |
| invitation_expired_or_cancelled | Annulation ou expiration persistée ; notification au propriétaire éligible |
| application_received | Soumission finale du dossier KYC existant |
| application_approved_or_rejected | Décision effective du vendeur/admin, motif échappé, destinataire vérifié |
| order_confirmed | Après commande persistée ; idempotence sur identifiant commande/destinataire |
| seller_new_order | Notification vendeur de la commande persistée ; aucune déclaration de paiement direct assimilée à une nouvelle commande |
| order_preparing | Transition effective vers preparing |
| order_cancelled | Annulation directe persistée ; aucun remboursement automatique annoncé |
| cancellation_requested | Modèle prêt ; pas d’événement de demande distinct de l’annulation dans le parcours actuel |
| delivery_assigned | Assignation persistée ; affiliation active réseau ou boutique propriétaire requise |
| delivery_collected | Transition picked_up persistée |
| delivery_in_transit | Notification de transition out_for_delivery |
| delivery_completed | Livraison persistée ; parcours direct et notifications existantes |
| delivery_failed | Modèle prêt ; aucun événement métier dédié et fiable actuellement |
| payment_confirmed | Exclusivement SUCCESS vérifié par le fournisseur, montant/devise/référence contrôlés, dans la transaction existante ; jamais direct/cash |
| payment_failed | FAILED vérifié par le fournisseur ; pas un simple timeout ou résultat incertain |
| refund_initiated | Modèle prêt ; absence de remboursement fournisseur certifié, donc pas d’émission automatique |
| refund_completed | Modèle officiel prêt ; aucun remboursement réel n’est inféré d’un changement comptable ou d’un litige |
| dispute_opened | Dossier persisté, acheteur et propriétaire boutique éligibles |
| dispute_resolved | Décision persistée, y compris close_direct sans mouvement de fonds |

Les événements sans source fiable restent explicitement non raccordés. Le paiement intégré et les remboursements ne sont ni activés ni simulés comme réussis pour rendre cette matrice verte. Les remboursements partiels restent suspendus selon la décision du propriétaire.
