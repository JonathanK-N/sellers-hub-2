# Phase 2 — sécurité

Auteur : Jonathan Kakesa (JonathanK-N). Décision globale : FAIL ; production NO-GO.

## Vulnérabilités reproduites puis corrigées

| Contrôle | Avant | Correction et preuve | Résultat |
|---|---|---|---|
| Webhook non configuré | Formulaire accepté, commande marquée payée | 503 avant accès MongoDB ; `payment-webhook-after.json`, tests payment security | PASS |
| Stock avec lignes dupliquées | Stock 1, quantité agrégée 2 acceptée | Agrégation et `$inc` conditionnel ; tests Mongo réels | PASS |
| Lecture par livreur non affecté | Coordonnées et codes visibles | 403 commande et groupe ; `order-read-security-after.json` | PASS |
| Codes vendeur/livreur | Codes utilisables pour la remise visibles | Projections et redaction des lectures/listes/QR ; tests privacy | PASS |
| Confirmation prématurée/dupliquée | Gardes insuffisantes | Paiement, état, rôle et CAS avant crédit | PASS |
| Retraits concurrents | Réservation de solde non atomique | Transaction replica set + révision vendeur ; test 20 requêtes | PASS |
| Standalone Mongo pour retrait | Risque de repli non atomique | 503, solde 186 avant/après ; `withdrawal-staging.json` | PASS |
| Remboursement partiel | Solde/règle de commission indéfinis | Suspension explicite du propriétaire, API 503 et bouton désactivé | PASS |
| Paiement sandbox absent | Paiement simulé pouvait être confondu avec capturé | Refus 503, escrow awaiting_payment | PASS |
| OTP et JWT | Générateur/claims permissifs | Cryptographie, claims requis, accès et utilisateurs suspendus contrôlés | PASS |
| Upload public | Surface fichiers actifs et lectures non bornées | Limite 8 MiB, contrôle image, limite 20 M pixels, SVG/HTML refusés | PASS |

Recherche publique : le caractère `[` produisait une erreur MongoDB/HTTP500. Le texte est désormais échappé et borné à100 caractères ; HTTP200 pour `[`/`.*`, HTTP422 au-delà de100, et test MongoDB réel : PASS.

## Dépendances et CI

Backend : audit initial 119 alertes sur 16 packages ; après correction, pip-audit ne signale aucune vulnérabilité connue. Ruff F821 et compilations passent. Ce résultat ne signifie pas l’absence de toute vulnérabilité inconnue.

Web : audit initial 14 low / 118 moderate / 253 high / 8 critical. Graphe corrigé : 12 low / 88 moderate / 221 high / 0 critical sur le dernier rapport conservé avant la clôture de validation. Ces nombres comptent des chemins de dépendances, pas autant de vulnérabilités distinctes. Les principales dépendances runtime ciblées ont été corrigées. Les chemins restants se concentrent sur CRA, Jest, webpack-dev-server et les outils de compilation ; la distinction ne transforme pas leur audit FAIL en PASS.

Le rapport contient notamment node-forge, braces et sprintf-js sans version corrigée annoncée (`patched_versions: <0.0.0`), ainsi que des corrections qui exigent une évolution de chaîne incompatible avec les contraintes CRA actuelles. Aucun passage à une version majeure n’a été forcé arbitrairement, ni audit ignoré. Le contrôle de CI reste bloquant.

## Risques critiques résiduels

1. Création de commande, confirmation et résolution de litige touchent plusieurs collections. Les compensations et CAS protègent certains échecs/concurrences ordinaires ; ils ne garantissent pas l’atomicité après crash ou résultat réseau ambigu. Prévoir des transactions sur une topologie compatible, ou un journal durable idempotent avec réconciliation, puis tests d’injection d’interruption et reprise.
2. Aucun backup MongoDB de production restauré n’est disponible. Un rollback de code ne remet pas les données financières dans un état antérieur.
3. Webhooks/paiement/remboursement externes ne sont pas certifiés avec un fournisseur sandbox réel. Vérifier signature, références, montant, devise, replay, paiement refusé et statut terminal sur ce fournisseur avant production.
4. Chaîne de build Web héritée : audit FAIL. Migrer ou remplacer les composants vulnérables dans une branche dédiée avec tests de build, rendu, PWA et Android ; conserver un contrôle complet de dépendances.

## Périmètres non certifiés

KYC réel et URLs signées privés : BLOCKED faute de stockage staging configuré. Validation des entrées : PASS, mais aucun scan antivirus n’est annoncé. Rate limits d’authentification existants sont conservés ; résistance globale aux attaques distribuées, limite partagée entre instances et pentest externe ne sont pas certifiés. La notification en base est vérifiée, pas un SMS/push FCM externe.

Seuls `.env.example` sont suivis pour la configuration. Les credentials synthétiques sont gardés dans le dossier privé voisin, exclus des archives publiques. Les licences de tiers et leur attribution sont conservées ; les nouvelles contributions sont attribuées à JonathanK-N.
