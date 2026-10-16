#!/bin/bash
# Author: Jonathan Kakesa (JonathanK-N). Staging only; no public initialization endpoint.
set -euo pipefail
umask 077
: "${MONGO_INITDB_ROOT_USERNAME:?Root username required}"
: "${MONGO_INITDB_ROOT_PASSWORD:?Root password required}"
: "${MONGO_APP_PASSWORD:?Application password required}"
: "${RAILWAY_PRIVATE_DOMAIN:?Private replica-set hostname required}"
if [[ ${MONGO_INITDB_ROOT_PASSWORD} == '${{'* || ${MONGO_APP_PASSWORD} == '${{'* ]]; then
  echo 'Unresolved credential reference; startup refused' >&2
  exit 1
fi
mkdir -p /data/db
if [[ ! -s /data/db/.afrimarket-keyfile ]]; then
  openssl rand -base64 756 > /data/db/.afrimarket-keyfile
fi
chmod 400 /data/db/.afrimarket-keyfile
chown mongodb:mongodb /data/db/.afrimarket-keyfile
docker-entrypoint.sh mongod --replSet afrimarket-staging-rs --keyFile /data/db/.afrimarket-keyfile --ipv6 --bind_ip ::,0.0.0.0 --oplogSize 128 --wiredTigerCacheSizeGB 0.25 --setParameter diagnosticDataCollectionEnabled=false &
mongo_pid=$!
trap 'kill -TERM "$mongo_pid" 2>/dev/null || true; wait "$mongo_pid" || true' TERM INT
ready=0
for attempt in $(seq 1 90); do
  if mongosh --quiet --host 127.0.0.1 --file /usr/local/bin/afrimarket-mongo-init.js; then
    ready=1
    break
  fi
  kill -0 "$mongo_pid" 2>/dev/null || exit 1
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  echo 'Authenticated staging replica set did not become ready' >&2
  kill -TERM "$mongo_pid" 2>/dev/null || true
  wait "$mongo_pid" || true
  exit 1
fi
echo 'Authenticated staging replica set ready'
wait "$mongo_pid"
