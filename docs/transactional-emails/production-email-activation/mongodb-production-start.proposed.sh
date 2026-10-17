#!/bin/bash
# Author: Jonathan Kakesa. Proposed configuration only; not deployed.
set -euo pipefail
umask 077
: "${MONGO_INITDB_ROOT_USERNAME:?Existing administrator required}"
: "${MONGO_INITDB_ROOT_PASSWORD:?Existing administrator password required}"
test -s /data/db/WiredTiger || { echo 'Existing database required' >&2; exit 1; }
for tool in openssl mongosh mongod docker-entrypoint.sh; do
  command -v "$tool" >/dev/null || exit 1
done
key=/data/db/.afrimarket-production-keyfile
if [[ ! -e "$key" ]]; then
  temporary=$(mktemp /data/db/.afrimarket-production-keyfile.XXXXXX)
  openssl rand -base64 756 > "$temporary"
  chmod 400 "$temporary"
  chown mongodb:mongodb "$temporary"
  # Never replace an existing internal authentication key.
  ln "$temporary" "$key"
  rm -- "$temporary"
fi
test -s "$key" || exit 1
chmod 400 "$key"
chown mongodb:mongodb "$key"
init=$(mktemp /tmp/afrimarket-production-init.XXXXXX.js)
cat > "$init" <<'JAVASCRIPT'
try {
  const admin = db.getSiblingDB('admin');
  if (!admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) quit(1);
  const expected = 'afrimarket-production-rs';
  const member = 'mongodb.railway.internal:27017';
  let status;
  try { status = admin.runCommand({replSetGetStatus: 1}); }
  catch (error) { if (error.code !== 94) throw error; status = {code: 94}; }
  if (status.code === 94) {
    const result = admin.runCommand({replSetInitiate: {_id: expected, members: [{_id: 0, host: member}]}});
    if (!result.ok) quit(1);
  } else if (!status.ok) quit(1);
  const config = admin.runCommand({replSetGetConfig: 1});
  if (!config.ok || config.config._id !== expected || config.config.members.length !== 1 || config.config.members[0].host !== member) quit(1);
  const hello = admin.runCommand({hello: 1});
  quit(hello.setName === expected && hello.isWritablePrimary ? 0 : 1);
} catch { quit(1); }
JAVASCRIPT
docker-entrypoint.sh mongod --auth --replSet afrimarket-production-rs --keyFile "$key" --oplogSize 128 --ipv6 --bind_ip ::,0.0.0.0 --setParameter diagnosticDataCollectionEnabled=false &
mongo_pid=$!
cleanup() {
  rm -f -- "$init"
  kill -TERM "$mongo_pid" 2>/dev/null || true
  wait "$mongo_pid" || true
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
ready=0
for ((attempt=0; attempt<90; attempt++)); do
  kill -0 "$mongo_pid" 2>/dev/null || exit 1
  if mongosh 'mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=1000' --quiet --file "$init" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Authenticated replica set unavailable' >&2; exit 1; }
echo 'Authenticated production replica set ready'
wait "$mongo_pid"
