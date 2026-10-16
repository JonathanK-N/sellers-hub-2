# Contact WhatsApp — reproduction réelle et correctif

Auteur : Jonathan Kakesa (JonathanK-N). Date : 16 octobre 2026.

## Incident confirmé sur le site réel

https://afri-market.app/ exécute le Web 642e368591199f6f2f3e4bf904d3de8f340fbcea. L’API et MongoDB répondent normalement. La correction CORS précédente est appliquée : Access-Control-Allow-Origin correspond exactement à https://afri-market.app. L’API a redéployé avec succès (017c9150-fc27-4601-935f-3bf55cd15747) ; Web et Mongo conservent leurs déploiements.

Les quatre articles reviennent dans le navigateur client réel. Les quatre fiches détaillées n’ont aucun seller_whatsapp public ; les deux fiches boutiques n’ont aucun whatsapp_contact public. Le navigateur confirme l’absence du bouton et le message WhatsApp non disponible. Aucun compte production impersonné, message envoyé, SMS déclenché, commande créée ou donnée modifiée. Les quatre endpoints privés testés sans session répondent 401. Preuve : whatsapp-live-observation.json.

## Diagnostic

L’absence de contact public ne permet pas d’affirmer que les anciens numéros ont été supprimés : aucun inventaire privé des vendeurs n’a été effectué. L’API publie seulement les contacts explicitement visibles, vérifiés et au format international. Les anciens liens sociaux ne sont volontairement pas un contournement de cette règle.

Les écrans de création et modification proposent encore un champ social WhatsApp Business qui n’active pas ce nouveau contact. La modification de profil propose aussi, tout en bas, une section WhatsApp professionnel fonctionnelle : le décalage est un parcours concurrent trompeur, pas une absence totale de configuration. La fiche boutique utilise un traitement séparé de la fiche produit.

## Correctif Web, API et données inchangées

Branche fix/whatsapp-contact-configuration, PR14 indépendante non fusionnée. Suppression du champ social concurrent ; réutilisation de la configuration professionnelle existante. Le tableau vendeur mène directement à cette section ; la création de boutique peut proposer d’y continuer. L’ancien numéro social est prérempli uniquement dans l’espace propriétaire, sans publication ni vérification automatiques ; les chiffres d’une URL ou d’un texte prérempli ne contaminent pas le numéro.

Boutique et produit utilisent le même bouton avec un brouillon de message WhatsApp, uniquement si visible et vérifié. Le bouton de messagerie interne reste séparé. Une modification non enregistrée masque les contrôles de vérification de l’ancien numéro. La révocation de publication masque le lien, même si un ancien lien social subsiste.

Les vendeurs existants doivent confirmer la publication et vérifier leur numéro dans Profil boutique → WhatsApp professionnel. Même après déploiement du correctif, leurs contacts resteront masqués tant que cette étape n’est pas faite. Aucun numéro personnel ni ancien numéro non validé n’est publié automatiquement.

## Validation

Le test unitaire local de normalisation, consentement strict et message encodé passe. La CI complète, avec un nouveau parcours navigateur entièrement synthétique et intercepté, est en cours au SHA 643e9bee76f658ad74d389c7c9678f1b3f80f878. Les résultats réels HTTPS et les résultats synthétiques ne sont pas confondus. Aucun SMS ni message WhatsApp réel n’est utilisé. Les seuils Lighthouse existants restent inchangés ; leurs échecs éventuels ne seront pas masqués.

## Déploiement

Aucun changement Railway, fusion ou déploiement exécuté pour ce correctif. Après vérification du candidat, toute proposition de déploiement exige une approbation distincte. Les commandes, paiements et messages authentifiés de production ne sont pas certifiés par les tests publics anonymes.

## Résultats du candidat figé

39c8f6404204efa2dc17e17dda0b8e3ccefde895, branche fix/whatsapp-contact-configuration. [CI 38856560972](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38856560972). Onze scénarios WhatsApp PASS, dont acheteur connecté, ancien numéro sans consentement, code refusé, changement non enregistré, publication vérifiée et révocation ; 28 contrôles UI PASS, Chromium/Firefox/WebKit disponibles. Les artefacts ZIP Web et UI sont vérifiés, les 174 empreintes du Web et sourceSha exact sont confirmés.

Les trois audits froids de prévisualisation restent FAIL : performance 87 / 95 / 95, LCP 2834,4 / 2716,4 / 2715,4 ms, TBT 250,0 / 18 / 36 ms. Accessibilité, bonnes pratiques et SEO 100 ; CLS <0,001. Le job UI/performance est donc FAIL malgré le succès des scénarios fonctionnels. Aucune modification de seuil ni certification de performance production.

Premier échec conservé : run 38856129354, fixture tableau vendeur sans recent_orders ; délai dépassé en attendant le lien de configuration. Correction de fixture dans le commit suivant, sans affaiblissement du test. Les 11 scénarios ont aussi affiché PASS dans le navigateur local sur un artefact applicatif identique, mais le processus de test Windows a attendu lors du nettoyage ; cette limitation locale ne remplace pas la preuve CI terminée.

Preuves : whatsapp-candidate-ci.json. Les documents sont publiés séparément sur docs/whatsapp-contact-validation afin de garder le candidat figé. Aucune fusion de la PR14 ni modification Railway effectuée pour ce correctif.
