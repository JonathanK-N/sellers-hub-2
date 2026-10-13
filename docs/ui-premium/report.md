# AfriMarket — bilan UI premium

Auteur : Jonathan Kakesa (JonathanK-N). Date : 13 octobre 2026.

Les deux interfaces React sont implémentées sur la même base rc.4 2806d719bf0edbdc31ebd32ab0887e1fb4dc40cb. La proposition dynamique est prioritaire. Aucune fusion, opération Railway, écriture Mongo staging ou action production dans cette mission UI.

## Candidats et provenance

| Variante | SHA applicatif testé | CI | Résultat |
|---|---|---|---|
| Dynamique | 0118ebdcd4bdcc0cb2be3932520e55c957182c5a | 38333842365 | 12/12 jobs PASS |
| Élégante | 25e1656e67f62391c12184fac34805704f8fbd96 | 38333872770 | 12/12 jobs PASS |

PR8 : https://github.com/JonathanK-N/sellers-hub-2/pull/8 ; PR9 : https://github.com/JonathanK-N/sellers-hub-2/pull/9. Les PR restent en brouillon et ciblent la base rc.4. Les noms des artefacts portent le SHA de fusion technique PR ; leur sourceSha identifie le candidat applicatif. latest-ci.json conserve les empreintes SHA-256 vérifiées des ZIP téléchargés.

## Mesures à froid

Lighthouse 13.5, simulation mobile standard, trois navigateurs neufs, seuils inchangés ; serveur de prévisualisation local dans le runner CI avec lectures API publiques seulement. Il ne s’agit pas de mesures HTTPS du nouveau site.

| Variante / passage | Performance | LCP ms | TBT ms | CLS | A11y / bonnes pratiques / SEO |
|---|---:|---:|---:|---:|---|
| Dynamique 1 | 96 | 2257,49 | 166 | 0,000223 | 100 / 100 / 100 |
| Dynamique 2 | 98 | 2268,36 | 35,5 | 0 | 100 / 100 / 100 |
| Dynamique 3 | 97 | 2258,67 | 30 | 0,000223 | 100 / 100 / 100 |
| Élégante 1 | 96 | 2255,28 | 8 | 0,075536 | 100 / 100 / 100 |
| Élégante 2 | 96 | 2254,72 | 9,5 | 0,075536 | 100 / 100 / 100 |
| Élégante 3 | 96 | 2254,45 | 3,5 | 0,075536 | 100 / 100 / 100 |

Tous les passages respectent Performance ≥90, LCP ≤2500 ms, TBT <200 ms, CLS <0,1, A11y/BP/SEO ≥95. Les échecs antérieurs restent dans visual-cycles.md et les preuves cycle4. Au cycle6, les premiers passages ont encore échoué : dynamique TBT252 ms, élégante TBT230 ms. Aucun passage n’a été supprimé du calcul.

## Causes et corrections

Le formatage initial Intl.fr-FR coûtait 183,2 ms sur la machine locale avant que les prix situés sous le premier écran soient visibles. Le catalogue se monte désormais à son entrée dans le viewport ou au focus clavier ; les données sont demandées normalement. Les cartes de premier écran desktop restent immédiates. Le bootstrap anonyme importait aussi le client Axios privé : les GET publics utilisent maintenant un client natif sans credentials, et Axios reste chargé pour la vérification des sessions authentifiées. Aucun délai artificiel ni détection de Lighthouse. Les débordements des cartes flottantes, le menu clavier et les contrastes ont été corrigés.

## Couverture réelle

26 contrôles UI PASS pour chacune des variantes : dix largeurs Chromium de 320 à 2560 px ; Firefox et WebKit 390/1440 ; navigation clavier, favoris persistants limités aux IDs publics, recherche et pays, catégorie, panier invité, inscription vendeur, chargement lent, erreur/retry, état vide, données échappées, badges réels et sessions expirées. Les captures final-ci utilisent des fixtures explicitement synthétiques interceptées dans le navigateur ; elles ne représentent pas le stock réel. Aucun POST backend dans ces contrôles.

Les jobs de régression backend et frontend-business-e2e passent : règles métier existantes, permissions, commandes/paiement direct, messagerie et contrôles WhatsApp en environnement de test. Cela ne certifie pas des parcours HTTPS privés nouvellement déployés ; aucun message WhatsApp réel n’a été envoyé. Les scans secrets/backend/web, builds Web/Android, émulateur Android et tests Mongo isolés passent.

## Architecture et limites

MarketplaceLanding et marketplace-premium.css portent les deux variantes ; Landing sélectionne la variante. Les espaces privés conservent leurs écrans et règles existants. Les prix utilisent toujours les helpers financiers existants. Les photos absentes, avis et badges ne sont pas inventés ; les favoris locaux ne prétendent pas être synchronisés au serveur.

Une extension en lecture seule de products_router ajoute la recherche littérale par shop_name, limitée à 500 IDs vendeurs, en conservant les filtres. Aucune migration, index ou écriture de données. Son test Mongo passe dans la base éphémère propre à la CI ; il est SKIP localement sans URL de transaction. Cette extension n’est pas présente sur l’API staging rc.4 tant qu’un déploiement distinct n’est pas approuvé.

Les caches sont distincts : afrimarket-green-ui-dynamic-v14 et afrimarket-green-ui-elegant-v14. La politique d’exclusion des API et sessions privées est conservée. pwa-v13-v14.json contient la validation locale de migration depuis le cache rc.4 v13, conservation du cache tiers et comportement hors connexion.

## Prévisualisations et suite

Prévisualisation dynamique : http://127.0.0.1:4352 ; élégante : http://127.0.0.1:4351, pendant que leurs processus locaux restent ouverts. scripts/ui_premium_preview.cjs sert le build et un proxy GET/HEAD strict vers l’API staging ; les autres méthodes sont rejetées. Aucun secret n’est nécessaire pour le catalogue anonyme.

Décision : PASS pour ces critères de prévisualisation ; NO-GO production. Les deux nouvelles interfaces ne sont pas déployées sur un hôte HTTPS autorisé. Les sept pages HTTPS, les sessions privées et les parcours métier réels doivent être mesurés sur un candidat effectivement déployé, avec SHA vérifié et approbation Railway distincte. Le staging partagé rc.4, Mongo/volume/secrets et la production restent conservés.
