# Validation et décision d’activation

Auteur : Jonathan Kakesa (JonathanK-N). Mission du 16 octobre 2026.

## Résultat

Intégration préparée sur feature/afrimarket-transactional-emails, sans fusion, déploiement, envoi réel ni modification de configuration, DNS ou données de production. Resend reste le fournisseur exclusif. EMAIL_MODE est disabled par défaut.

**NO-GO pour l’activation production.** Le code et les modèles sont vérifiés localement ; la configuration du domaine, l’accès HTTPS depuis le backend déployé, les webhooks réels et la livraison effective restent à valider après les approbations appropriées.

## Preuves locales

- Suite backend équivalente à celle de la CI : **169 PASS, zéro échec, zéro test ignoré**, avec deux MongoDB locaux isolés (replica set et standalone), failpoints activés. Preuve : final-backend-results.xml. Elle couvre notamment les transactions, interruptions et reprises, commandes, paiement direct, messagerie, WhatsApp, permissions et sécurité.
- La suite e-mail vérifie les 26 rendus HTML/texte, variables requises, échappement, URL HTTPS, refus d’envois hors destinataires Resend de test, chiffrement, doublons, leases concurrentes, Retry-After, contenu immuable, expiration des liens et de la fenêtre d’idempotence, signatures et rejeux de webhook, plaintes, révocation des sessions, invitations et concurrence d’approbation. Un contrôle supplémentaire du reset OTP téléphone est exécuté après le dernier raccordement de notification ; preuve : final-email-results.xml.
- **104 contrôles responsive PASS** (26 modèles × 320/390/768/1200 pixels) : aucun débordement, logo chargé et boutons d’au moins 40 pixels. Preuve : visual-results.json, captures previews/. Le logo est servi localement pendant ces mesures ; aucun hébergement production n’est supposé.
- **7 parcours navigateur PASS** sur la compilation locale avec API simulée : retrait du fragment secret, POST du jeton, demande de reset, réglages authentifiés, refus d’accès administrateur pour l’acheteur, invitation vendeur, catalogue administrateur. Preuve : browser-results.json. Les tests de transport PWA restent séparés du simulateur.
- Compilation Web PASS ; journal frontend-build.log. Les modules e-mail restent chargés à la demande.
- Contrôles service worker, transport de session, contact WhatsApp et graphe de ressources des routes : PASS. API et requêtes authentifiées restent hors cache public.
- Compilation Python et vérification des espaces Git : PASS. Scanner Gitleaks des changements indexés : aucune fuite détectée, aucune nouvelle exclusion.

Ces contrôles ne prouvent pas un envoi réel, une livraison en boîte, un rendu Gmail/Outlook, des performances HTTPS déployées ou une validation production.

## Première exécution GitHub

[Exécution 38995619500](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38995619500), candidat fe2a827ccb91e96749d2f8c571ab5b8b57ed6f11 : backend et audits de sécurité réussis. Le job frontend-business-e2e échoue sur l’assignation d’un livreur synthétique sans affiliation approuvée. Sa fixture est corrigée sans assouplir l’application : vérifier le refus avant approbation, préparer un profil boutique approuvé dans la seule base de test isolée, puis vérifier sa disponibilité et reprendre le parcours complet.

Le contrôle ui-premium-preview conserve trois échecs LCP : **2752,68 / 2558,03 / 2555,97 ms**, seuil 2500 ms inchangé. Performances : **94 / 95 / 95** ; accessibilité, bonnes pratiques et SEO : **100**. Il s’agit d’une prévisualisation publique utilisant les lectures staging, pas d’un déploiement HTTPS de cette branche. Ces mesures interdisent de déclarer la CI entière verte ou GO production. Le comparatif avec main doit être lu séparément ; l’origine préexistante ou régressive de ces dépassements ne doit pas être supposée.

Le contrôle d’affiliation s’applique même lorsque les e-mails sont désactivés. Avant tout déploiement futur, inventorier en lecture seule les profils existants sans affiliation approuvée et vérifier la topologie Mongo requise par les approbations transactionnelles. Aucun profil n’est migré automatiquement.

## Échecs et corrections conservés

1. Premier appel pytest depuis la racine sans PYTHONPATH : collecte impossible du paquet communications. Correction de la commande pour utiliser le même PYTHONPATH que la CI.
2. Lancement global de tous les anciens tests : trois échecs de connexion à localhost:8001 (test_health, test_countries, test_register_buyer) en l’absence du serveur requis ; backend-results.xml est conservé localement. La suite CI explicite est distincte de ces anciens tests de serveur démarré.
3. Deux essais de régression ont été interrompus après l’arrêt du Mongo local lancé par le moteur de prévisualisation. Reprise avec deux processus indépendants et bornes de connexion courtes. Aucun Mongo distant concerné.
4. Contrôle visuel initial trop long pour le moteur : reprise par séries bornées ; 104 résultats finaux conservés.
5. Deux essais d’interface authentifiée ont échoué parce que le service worker local contournait les réponses simulées et recevait la page HTML du serveur statique comme réponse d’API. Cause identifiée ; contexte sans service worker pour ces mocks, puis sept contrôles réussis. Le service worker lui-même reste soumis à son test de non-cache API, sans modification de sa politique.
6. Première suite CI équivalente : **167 PASS et un échec** sur un scénario qui assignait un livreur sans affiliation approuvée. Le refus de sécurité est conservé. Le scénario vérifie maintenant explicitement les refus pour absence d’affiliation et autre boutique, puis le succès avec une affiliation valide. Nouvelle suite complète : 169 PASS. L’affiliation ne peut pas être remplacée par deux approbations concurrentes.

Les avertissements de dépréciation FastAPI on_event et Starlette/httpx sont conservés. Aucun seuil de performance, règle de sécurité ou test métier n’est désactivé pour obtenir ces résultats.

## Connexion et éléments manquants

connection-audit.json contient uniquement des observations non sensibles : accès Resend en lecture HTTP 200 ; seul cognito-inc.ca est vérifié dans ce compte ; afri-market.app n’y est pas enregistré. DKIM et SPF ont des TXT publics existants mais leur correspondance au compte connecté n’est pas prouvée. DMARC n’est pas trouvé.

Le propriétaire a choisi afri-market.app. Les adresses exactes EMAIL_FROM et EMAIL_REPLY_TO restent à choisir ; aucune adresse n’est inventée. Les URL, clé de chiffrement, signature de webhook et mode d’envoi restent à configurer après autorisation. La clé API existante reste secrète et côté serveur.

La dernière lecture du health production annonce ok au SHA 34096b1e9eba13681b84e8d1f44d3264571bb6e8. Ce contrôle ne prétend pas vérifier le SHA du Web ou l’état de tous les services Railway. Aucune action de production n’a été exécutée.

Les nouveaux parcours sensibles exigent des transactions Mongo. Vérifier la topologie actuelle avant activation ; aucune conversion ou migration de production n’est effectuée. Prévoir une sauvegarde fraîche et sa restauration avant toute future modification autorisée.

Consulter configuration.md pour les étapes Railway/Resend et event-matrix.md pour les scénarios sans source métier fiable : connexion suspecte, demande distincte d’annulation, échec de livraison et remboursements fournisseur. Ces événements ne sont pas annoncés comme opérationnels. Les paiements directs ne déclenchent jamais de confirmation fournisseur ni de remboursement automatique.
