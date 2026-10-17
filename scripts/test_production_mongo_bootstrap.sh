#!/bin/bash
# Author: Jonathan Kakesa. Disposable Linux Docker fixtures only.
set -euo pipefail
image=$1
script=$(realpath "$2")
export MONGO_INITDB_ROOT_USERNAME=fixture_owner
export MONGO_INITDB_ROOT_PASSWORD
MONGO_INITDB_ROOT_PASSWORD=$(openssl rand -hex 32)
echo "::add-mask::$MONGO_INITDB_ROOT_PASSWORD"
volume=afrimarket-conversion-fixture
container=afrimarket-conversion-fixture
docker volume inspect "$volume" >/dev/null 2>&1 && exit 1
docker container inspect "$container" >/dev/null 2>&1 && exit 1
docker volume create "$volume" >/dev/null
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT
start() {
  docker run -d --name "$container" --hostname mongodb.railway.internal \
    --env MONGO_INITDB_ROOT_USERNAME --env MONGO_INITDB_ROOT_PASSWORD \
    --mount "source=$volume,target=/data/db" \
    --mount "type=bind,source=$script,target=/proposal.sh,readonly" \
    "$image" "$@" >/dev/null
}
query() {
  docker exec "$container" mongosh 'mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=1000' --quiet --eval \
    'const a=db.getSiblingDB("admin"); if(!a.auth(process.env.MONGO_INITDB_ROOT_USERNAME,process.env.MONGO_INITDB_ROOT_PASSWORD))quit(1);'"$1"
}
ready() {
  for ((n=0;n<90;n++)); do
    if query "$1" >/dev/null 2>&1; then return; fi
    sleep 1
  done
  echo 'Synthetic container readiness failed' >&2
  docker logs "$container" 2>&1 | grep -E 'Authenticated|required|unavailable' || true
  return 1
}
start mongod --auth --bind_ip_all
ready 'if(!a.runCommand({hello:1}).isWritablePrimary)quit(1);'
query 'const b=db.getSiblingDB("afrimarket_test_conversion"); b.items.insertMany([{_id:"fixture-a",amount:12},{_id:"fixture-b",amount:34}]); b.items.createIndex({amount:1},{unique:true});' >/dev/null
before=$(query 'const b=db.getSiblingDB("afrimarket_test_conversion"); print(JSON.stringify({docs:b.items.find().sort({_id:1}).toArray(),indexes:b.items.getIndexes()}));')
docker stop --time 30 "$container" >/dev/null
docker rm "$container" >/dev/null
start bash /proposal.sh
ready 'const h=a.runCommand({hello:1}); if(h.setName!=="afrimarket-production-rs"||!h.isWritablePrimary)quit(1);'
after=$(query 'const b=db.getSiblingDB("afrimarket_test_conversion"); print(JSON.stringify({docs:b.items.find().sort({_id:1}).toArray(),indexes:b.items.getIndexes()}));')
[[ "$before" == "$after" ]]
query 'const s=db.getMongo().startSession(); const b=s.getDatabase("afrimarket_test_conversion"); s.startTransaction(); b.items.insertOne({_id:"fixture-abort",amount:56}); s.abortTransaction(); if(b.items.countDocuments({_id:"fixture-abort"})!==0)quit(1); s.startTransaction(); b.items.insertOne({_id:"fixture-commit",amount:78}); s.commitTransaction(); if(b.items.countDocuments({_id:"fixture-commit"})!==1)quit(1); b.items.deleteOne({_id:"fixture-commit"}); s.endSession();' >/dev/null
keyBefore=$(docker exec "$container" sha256sum /data/db/.afrimarket-production-keyfile | cut -d' ' -f1)
docker restart --time 30 "$container" >/dev/null
ready 'const h=a.runCommand({hello:1}); if(h.setName!=="afrimarket-production-rs"||!h.isWritablePrimary)quit(1);'
keyAfter=$(docker exec "$container" sha256sum /data/db/.afrimarket-production-keyfile | cut -d' ' -f1)
[[ "$keyBefore" == "$keyAfter" ]]
docker stop --time 30 "$container" >/dev/null
docker rm "$container" >/dev/null
start mongod --auth --bind_ip_all
ready 'if(a.runCommand({hello:1}).setName)quit(1);'
rolledBack=$(query 'const b=db.getSiblingDB("afrimarket_test_conversion"); print(JSON.stringify({docs:b.items.find().sort({_id:1}).toArray(),indexes:b.items.getIndexes()}));')
[[ "$before" == "$rolledBack" ]]
printf '%s\n' '{"status":"PASS","scope":"synthetic Linux Docker only","conversion":true,"transactions":true,"persistentRestart":true,"keyUnchanged":true,"standaloneRollback":true,"documentsAndIndexesPreserved":true}' > bootstrap-proof.json
