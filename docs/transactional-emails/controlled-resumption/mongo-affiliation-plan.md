# Transactions et affiliations — procédure préparée

Auteur : Jonathan Kakesa. 17 octobre 2026, Toronto.

## État observé sans écriture

Mongo production authentifié, standalone, trois profils livreurs actifs sans affiliation ; zéro doublon, zéro boutique orpheline, zéro compte livreur sans profil. Aucun nom, numéro, adresse ou identifiant personnel dans les preuves. Les comptes existants ne sont pas à recréer. Le nom du rôle ne détermine jamais une affiliation.

## Préparation de la conversion

1. Inventorier en lecture seule version exacte du serveur/FCV, commande de démarrage, authentification, volume et dbPath, capacité disque/oplog, limites mémoire, hostname privé stable et URI des consommateurs. Conserver la même version du binaire et le même volume pour cette opération. Ne pas transformer le bootstrap staging avec seed en bootstrap production.
2. Faire approuver une fenêtre de maintenance et un arrêt effectif de tous les producteurs d’écritures, pas seulement du Web. Ne pas compter EMAIL_MODE comme verrou sur le backend ancien. Aucun arrêt production autorisé dans la présente mission.
3. Sauvegarde fraîche cohérente après pause des écritures et drainage. Utiliser le plan de backup déjà testé avec fsyncLock et watchdog seulement après autorisation distincte ; archive chiffrée avant disque, clé hors Git, permissions privées. Déverrouiller et contrôler chaque propriétaire de verrou. Conserver version, options, index, comptages et empreintes de documents. La preuve historique du 12 octobre ne remplace pas cette nouvelle sauvegarde.
4. Restaurer la nouvelle archive sur une cible authentifiée isolée ; comparer documents, identifiants et index. Refuser la suite si une empreinte diffère. Conserver une copie récupérable indépendante du volume actif.
5. Préparer un keyfile aléatoire base64 standard persistant, permissions minimales, jamais dans Git/logs. La répétition locale confirme que base64url n’est pas accepté. Aucun secret existant n’est réécrit automatiquement. Faire approuver séparément topologie/stockage/secrets/URI et budget.
6. Arrêter proprement Mongo ; redémarrer sur le même dbPath/volume avec authentification conservée, keyfile et replSetName convenu. Initialiser une seule fois en utilisant le hostname privé stable et les identifiants administratifs existants. Le premier accès à un replica set non initialisé doit être direct. Ne pas supprimer le contenu du volume ni admin/local pour forcer une réussite.
7. Attendre PRIMARY, vérifier authentification et droits minimaux applicatifs, limites d’accès anonymes, stockage persistant, comptages/empreintes/index. Tester commit ET abort avec une collection QA dédiée et approuvée ; ne pas utiliser de commandes clients pour le test. Les transactions nécessitent un replica set ou mongos ; une seule instance permet les transactions mais n’offre pas de haute disponibilité.
8. Mettre à jour uniquement les consommateurs autorisés vers l’URI du replica set, vérifier découverte privée/majority/sessions. Ne réouvrir les écritures qu’après tests approuvés et décision explicite. Pour la résilience production, proposer trois membres ou un service managé ; l’infrastructure et son coût nécessitent un choix distinct, aucun nouveau service créé ici.

## Retour arrière

Avant réouverture des écritures : arrêter proprement, restaurer la commande standalone précédente sur le même volume si le scénario a été répété pour cette version, contrôler comptes/index/données et rétablir l’URI correspondante. Ne jamais supprimer local ou écraser le volume actif pour revenir en arrière.

Après réouverture : une restauration de la sauvegarde antérieure perdrait les écritures suivantes. Arrêter/drainer de nouveau, sauvegarder l’état courant, comparer/réconcilier les écritures avec une procédure approuvée. La répétition synthétique teste le retour au standalone en conservant un commit post-conversion ; cette preuve locale n’autorise pas à généraliser à une future topologie multi-membre ou à une autre version. Ne pas assimiler rollback de topologie et rollback applicatif : l’application qui exige les transactions reste NO-GO sur standalone.

Restaurer une archive seulement dans un volume neuf isolé ; validation avant bascule et conservation de la source. Aucune option --drop sur la source. Documenter RPO/RTO mesurés de la répétition et fenêtre réelle prévue ; pas de promesse de durée avant mesure sur la sauvegarde fraîche.

## Attribution des trois affiliations

1. Le propriétaire examine les trois profils dans une session privée authentifiée. Une liste de décision externe au dépôt associe chaque identifiant existant à afrimarket OU shop avec l’identifiant d’une boutique existante, l’approbateur et la date. Un profil non décidé reste non affilié et non assignable. Aucune valeur par défaut afrimarket.
2. Précontrôles en lecture : profil unique et actif, compte de rôle deliverer, pays compatible, boutique existante/propriétaire confirmé pour shop, absence de décision concurrente et compatibilité des affectations en cours. Si incohérence, refuser et demander une décision métier ; ne pas la réparer par déduction.
3. Après autorisation de données distincte ET transactions disponibles, sauvegarder les états avant, puis transaction atomique avec filtre sur identifiant ET état préobservé (affiliation absente, révision si présente). Exiger exactement un profil modifié par décision. Journal d’audit protégé, sans PII publique. Un conflit ou une erreur annule tout le lot ; réexécuter à partir d’un nouvel audit, pas avec un filtre élargi.
4. Vérifier comptages, rôle, affiliation et autorisation d’assignation. Aucun changement de mot de passe ni compte créé. Pour le réseau, ne pas conserver un seller_id contradictoire ; pour shop, seller_id obligatoire et exact. Ne pas inventer un lien si la décision manque.
5. Retour des affiliations uniquement par opération approuvée avec contrôle d’état/version et revue des nouvelles livraisons. Si des livraisons ont été assignées après migration, réconcilier avant retour ; ne pas supprimer les livraisons ni remettre aveuglément un ancien document.

## Répétition synthétique

scripts/rehearse_email_mongo_topology.py accepte uniquement des chemins d’outils et un répertoire privé. Il construit lui-même des URI loopback et des bases afrimarket_test ; aucune URI production acceptée. Données fraîches, sauvegarde Fernet chiffrée avant disque, restauration dans un autre répertoire, conversion authentifiée en place et conservation des empreintes/index. Les résultats et les deux premiers échecs sont conservés séparément. Les répertoires précédents ne sont ni écrasés ni supprimés.

Le test backend test_delivery_assignments_after_explicit_synthetic_affiliation_migration appelle la vraie fonction d’assignation : absence d’affiliation refusée sans changement de commande ; réseau et boutique exacte autorisés ; autre boutique et profil inactif refusés. Les notifications y sont simulées ; aucun message réel.

Référence : https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/
