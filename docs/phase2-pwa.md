# Phase 2 — PWA

Auteur : Jonathan Kakesa (JonathanK-N). Domaine global : BLOCKED pour certification d’installation mobile/OS ; tests navigateur ci-dessous exécutés.

| Contrôle | Résultat | Preuve |
|---|---|---|
| Manifest, icônes, dimensions, scope, HTTPS Capacitor | PASS | `scripts/validate_release.py` |
| Purge limitée aux caches AfriMarket | PASS | `scripts/test_service_worker.cjs` |
| API et Authorization hors cache | PASS | Test worker, API hors ligne 503 |
| Mise à jour réelle worker navigateur phase 1 v7→rc2 v8 | PASS | `pwa-upgrade-final.json` |
| Ancien cache orange et vert supprimés | PASS | Même preuve ; cache d’une autre application préservé |
| Accueil visité rendu hors ligne | PASS | Même preuve |
| Route lazy non visitée, fallback lisible puis reconnexion | PASS | Même preuve ; Réessayer récupère la route/login |
| Session authentifiée temporairement déconnectée | PASS | `offline-session-current.json` |
| Session rejetée 401 | PASS | `session-rejection-current.json` |
| Panier authentifié et shell visité hors ligne | PASS | `pwa-cart-current.json`, cache v8 et header vert |
| Installation/désinstallation/réinstallation OS PWA | BLOCKED | Aucun test de l’interface d’installation du système réalisé |
| Android physique/iOS installé, permissions/caméra | BLOCKED | Aucun appareil physique/session iOS accessible dans cette validation |

Le test de mise à jour sert le build Web exact dans un serveur local, installe le worker de phase 1, crée un cache orange, déclenche `registration.update()`, attend explicitement la migration des caches, puis coupe/reprend le réseau. Le premier essai du script comportait un défaut d’attente de migration, corrigé avant le PASS ; un timeout n’a pas été présenté comme un succès.

Les fichiers de routes sont différés : la preuve du shell « visité » attend le chargement complet avant la déconnexion. Une route non visitée peut nécessiter le réseau et affiche le fallback dédié. Aucun stockage hors ligne des commandes privées ou des réponses API n’est annoncé.

L’application Capacitor embarque déjà les fichiers et ne doit pas utiliser le cache navigateur pour les lancer. La candidate exclut l’enregistrement du worker PWA en natif et retire les anciens workers/caches AfriMarket natifs. Ce comportement est couvert séparément par les tests APK, pas par le PASS PWA navigateur.
