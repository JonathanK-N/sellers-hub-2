# Blocages

Auteur : Jonathan Kakesa (JonathanK-N).

- PASS : session CLI authentifiée, inventaire et backup chiffré/restauration production vérifiés. Documents, IDs et index des 23 collections identiques. Preuves mongo-production-inventory.json et production-backup-proof.json ; archive et clé privées hors Git.
- PASS : alternative aux variables scellées explicitement autorisée pour le staging synthétique ; deux mots de passe distincts de 48 caractères configurés en variables standard sans déploiement. Aucun secret de production modifié. Détail : staging-secret-options.md.
- BLOCKED : application Railway précédemment refusée par contrôle d’approbation. Ne pas contourner par connect live, CLI ou API alternative.
- BLOCKED : déploiement production jusqu’au staging réel, compatibilité transactionnelle du Mongo actuellement standalone et approbation finale concrète. Backup/restauration et migrations additives sur copie protégée sont PASS.
- CinetPay non certifié reste désactivé et ne bloque pas le parcours direct autorisé.
