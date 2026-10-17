# Configuration Resend — diff préparé, non appliqué

Auteur : Jonathan Kakesa. 17 octobre 2026, Toronto.

Projet AFRIMARKET, environnement production, backend sellers-hub-2. Les cinq variables restent mal formatées lors de la nouvelle lecture. production-config-diff.json contient leur diff exact, sans secret :

| Variable | Valeur attendue |
|---|---|
| EMAIL_FROM | AfriMarket <notifications@afri-market.app> |
| EMAIL_REPLY_TO | support@afri-market.app |
| FRONTEND_URL | https://afri-market.app |
| EMAIL_LOGO_URL | https://afri-market.app/assets/email/afrimarket-official.png |
| EMAIL_MODE | disabled |

Saisir chaque valeur brute, sans guillemets englobants ni virgule finale. Ne pas remplacer les trois secrets valides pour cette correction de syntaxe. Le propriétaire a choisi ces adresses ; leur réception n’est pas prouvée.

## Ordre obligatoire avant toute application

1. Autorisation production distincte, précisant le verrou effectif du transport et le redéploiement associé. Le backend actuel 34096b1 ignore EMAIL_MODE ; cette variable n’est pas un verrou pour cet ancien code.
2. Garantir l’absence d’envoi par une version qui respecte disabled, ou par un arrêt du transport explicitement approuvé. Ne pas corriger d’abord l’expéditeur du code existant avec une clé valide.
3. Relever l’état actuel, présenter le diff limité et vérifier les autres changements en attente. Ne pas réappliquer d’anciennes valeurs JSON comme retour arrière de sécurité.
4. Appliquer seulement après approbation Railway, vérifier les variables sans secrets, le SHA, le mode effectif et les logs statiques. Aucun envoi de contrôle à un client.

## Domaine, logo, clé

afri-market.app est partially_verified : SPF/DKIM verified, MX de réception pending. Capacité sending enabled ; receiving enabled décrit une option activée et ne prouve pas un MX fonctionnel. Aucun DNS modifié. Vérifier la boîte support auprès de son fournisseur de réception avant activation.

Le logo officiel existe dans frontend/public/assets/email/afrimarket-official.png. Son futur hébergement est le même chemin sur le Web déployé ; vérifier image/png et égalité SHA-256 avec le fichier officiel après déploiement autorisé. À présent l’URL production renvoie le fallback HTML. Pas de substitution par une URL inventée.

La clé actuelle fonctionne pour les lectures Resend. Une seule clé est listée dans le compte connecté ; cela ne prouve pas la révocation d’une ancienne clé inconnue ni celle d’un autre compte. L’identifiant/nom de l’ancienne clé et le périmètre de compte restent nécessaires, jamais sa valeur. Aucun essai d’une ancienne clé ou envoi fournisseur effectué.

## Staging préparé

Réutiliser uniquement API/Web existants du staging. Présenter un nouveau diff épinglé au SHA dont la CI aura été vérifiée. AUTH_MODE=production évite le seed ; EMAIL_MODE=disabled exact ; BACKGROUND_JOBS_ENABLED=false arrête le scheduler, son refresh FX immédiat et les jobs qui écrivent (dont expiration des invitations). Ce verrou de scheduler ne bloque pas les routes HTTP : les contrôles de cette phase restent strictement en lecture seule. Conserver connexion, volume et données Mongo. FRONTEND_URL et EMAIL_LOGO_URL utiliseront le domaine Web staging existant ; secrets de chiffrement/webhook propres au staging et clé Resend dédiée, sans copie des secrets production. Aucun changement Railway n’a été appliqué.

Les essais réels Resend sont une seconde autorisation : mode test, adresses delivered@resend.dev / bounced@resend.dev / complained@resend.dev seulement, nouvelles fixtures synthétiques autorisées. Préserver la distinction accepted/delivered ; vérifier signature, rejeu, suppression et reprises. Le plan détaillé précédent reste dans ../final-readiness/staging-approval-plan.md.
