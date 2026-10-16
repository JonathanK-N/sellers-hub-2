# Web, PWA et Android

Auteur : Jonathan Kakesa (JonathanK-N).

Les builds Web et Android utilisent le lockfile figé, Node 22 et la même source de candidat. Le paquet Android est cd.cognito.afrimarket.staging, version code 4, version 1.0.1-green-rc.3-debug. L'APK est de test, sans signature de distribution ni publication en boutique. Il embarque le Web local ; il ne charge pas le site de production à la place de l'interface corrigée.

PASS en émulateur : installation, affichage AfriMarket et vert historique, page d'accueil embarquée sans Wi-Fi/données, bouton Retour depuis la racine, réinstallation du même APK avec conservation des fichiers, désinstallation et réinstallation propres. Dix contrôles passent. Cette mise à jour teste le même APK ; elle ne certifie pas une migration rc.2 vers rc.3 avec signatures différentes.

BLOCKED : appareil physique, iOS, parcours authentifiés complets en WebView, Retour avec historique et modal ouvert, synchronisation financière hors ligne. Les limitations figurent explicitement dans le résultat de l'émulateur.

Le cache PWA rc.3 est afrimarket-green-rc3-v9. Le protocole local remplace réellement le worker rc.2/v8, conserve les caches étrangers, retire les caches obsolètes, vérifie l'accueil visité hors ligne, le refus de cacher une réussite API fictive, le message d'indisponibilité d'une route lazy non visitée et la reconnexion. Six contrôles passent sur le candidat exact 058b6a5, après le gel applicatif. Aucun paiement ou retrait n'est envoyé automatiquement hors ligne.

L'identité reste fondée sur les couleurs et fontes existantes. Les contrôles visuels locaux à 390, 768 et 1440 pixels vérifient le vert rgb(8,80,65), l'absence de débordement horizontal et le modal clavier. Les produits du rendu local ne valident pas une API inaccessible depuis localhost. La migration Tailwind 4 demande Safari 16.4+, Chrome/WebView 111+ ou Firefox 128+ ; les versions antérieures ne sont pas certifiées.

Preuves : pwa-upgrade-final.json, android-emulator-results.json, visual-final.json, métadonnées de build et manifeste des artefacts.
