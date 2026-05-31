# Déploiement d'AfriMarket sur Railway

Ce guide explique comment déployer AfriMarket (backend FastAPI + frontend React + MongoDB)
sur [Railway](https://railway.app) à partir de ce dépôt GitHub.

L'architecture se compose de **3 services** dans un même projet Railway :

1. **MongoDB** — base de données
2. **Backend** — API FastAPI (dossier `backend/`)
3. **Frontend** — application React (dossier `frontend/`)

---

## 1. Créer le projet et la base de données

1. Sur Railway, clique sur **New Project** → **Deploy from GitHub repo** → choisis `sellers-hub-2`.
2. Dans le projet, clique sur **New** → **Database** → **Add MongoDB**.
   Railway crée un service MongoDB et expose une variable `MONGO_URL`.

## 2. Service Backend

1. **New** → **GitHub Repo** → sélectionne ce dépôt.
2. Dans les réglages du service (**Settings**) :
   - **Root Directory** : `backend`
   - **Start Command** : `uvicorn server:app --host 0.0.0.0 --port $PORT`
     (déjà défini dans `backend/railway.json`)
3. Dans **Variables**, ajoute :

   | Variable | Valeur |
   |----------|--------|
   | `MONGO_URL` | `${{ MongoDB.MONGO_URL }}` (référence le service Mongo) |
   | `DB_NAME` | `afrimarket` |
   | `JWT_SECRET` | une longue chaîne aléatoire (`openssl rand -hex 32`) |
   | `CORS_ORIGINS` | l'URL publique du frontend (voir étape 3) |
   | `PAYMENT_MODE` | `sandbox` (puis `production` quand prêt) |

   Variables optionnelles (production) : `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`,
   `CINETPAY_NOTIFY_URL`, `CINETPAY_RETURN_URL`, `CINETPAY_TRANSFER_TOKEN`,
   `FIREBASE_PROJECT_ID`, `FIREBASE_SA_JSON`, `EMERGENT_LLM_KEY`.

4. Dans **Settings → Networking**, clique **Generate Domain** pour obtenir l'URL publique
   du backend (ex : `https://afrimarket-backend.up.railway.app`).

## 3. Service Frontend

1. **New** → **GitHub Repo** → sélectionne ce dépôt à nouveau.
2. Dans **Settings** :
   - **Root Directory** : `frontend`
   - Build et start sont déjà définis dans `frontend/railway.json`
     (`yarn install && yarn build`, puis `yarn serve`).
3. Dans **Variables**, ajoute **avant le premier build** :

   | Variable | Valeur |
   |----------|--------|
   | `REACT_APP_BACKEND_URL` | l'URL publique du backend (étape 2.4), sans slash final |

   > ⚠️ `REACT_APP_BACKEND_URL` est injectée pendant le build. Si tu la modifies,
   > il faut **relancer un build** (Redeploy) pour qu'elle soit prise en compte.

   Variables optionnelles (push) : `REACT_APP_FIREBASE_CONFIG`, `REACT_APP_FCM_VAPID_KEY`.

4. **Generate Domain** pour obtenir l'URL publique du frontend.

## 4. Boucler la configuration CORS

Retourne dans le service **Backend** → **Variables** et mets `CORS_ORIGINS`
à l'URL exacte du frontend (ex : `https://afrimarket.up.railway.app`).
Redeploy le backend.

## 5. Vérifier

- Backend : ouvre `https://<backend>/api/health` → doit répondre OK.
- Frontend : ouvre l'URL du frontend → l'app AfriMarket s'affiche.
- Crée un compte vendeur, ajoute un produit, teste une commande en mode sandbox.

---

## Notes

- **Données de démo** : au démarrage, le backend exécute un *seed* (voir `backend/seed_data.py`).
- **Paiements** : en `sandbox`, les paiements sont simulés. Passe `PAYMENT_MODE=production`
  + clés CinetPay pour les vrais paiements Mobile Money.
- **Tâches planifiées** : le scheduler (retraits, expiration Premium) démarre automatiquement
  avec le backend.
- **Stockage des photos** : nécessite `EMERGENT_LLM_KEY`. Sans cette clé, l'upload d'images
  est désactivé mais le reste de l'app fonctionne.
