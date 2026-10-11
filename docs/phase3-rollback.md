# Procédure de retour arrière phase 3

Auteur : Jonathan Kakesa (JonathanK-N).

Aucun rollback de production n'est exécuté dans cette phase. Les releases, tags et 29 artefacts historiques phase 1/2 sont préservés et leurs téléchargements ont été vérifiés. Une sauvegarde Git complète de 45 références a été vérifiée avant travaux ; elle est privée et ne remplace pas une sauvegarde MongoDB.

Pour le Web staging, sélectionner le déploiement phase 2 déjà réussi, vérifier son SHA cd08cc50a8378db4c15d5d42c74c386982d58cc9, puis tester accueil, authentification et navigation. Le retour de code ne nécessite pas de suppression de données. La réactivation d'un ancien worker PWA doit invalider explicitement le cache rc.3 ; ne pas attendre qu'une ancienne version réutilise aveuglément les caches.

Pour l'API staging, ne pas revenir au code financier antérieur tout en autorisant de nouvelles opérations : suspendre les routes financières et conserver les réservations incertaines pour réconciliation. Le journal et les clés d'idempotence ne doivent pas être supprimés. Ne pas désactiver les transactions pour contourner un défaut Mongo.

La conversion staging autorisée utilise une nouvelle persistance. Avant toute modification, le propriétaire a autorisé la régénération des seules données synthétiques lorsque leur export n'est pas possible. Après une conversion réellement appliquée, ne pas réinitialiser le volume ni retirer le replica set pour un simple rollback applicatif. Préserver keyfile, credentials et données.

Pour une migration de production future : sauvegarde cohérente, contrôle de restauration isolée, fenêtre d'arrêt et méthode de réconciliation sont requis avant approbation. Le contrôle de restauration actuel porte sur une petite fixture synthétique quiescente ; aucun RPO/RTO de production n'est attesté.

PASS : procédure préparée, références historiques et sauvegarde Git vérifiées. BLOCKED : exercice effectif de rollback Railway candidat, tant que son déploiement reste refusé par le contrôle d'approbation.
