const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const handlers = {};
const deleted = [];
let networkCalls = 0;
const sandbox = {
  self: { addEventListener: (name, handler) => handlers[name] = handler, skipWaiting() {}, clients: { claim() {} }, location: { origin: 'https://staging.example' } },
  caches: { keys: async () => ['afrimarket-v6', 'afrimarket-green-v7', 'afrimarket-green-rc3-v9', 'afrimarket-green-direct-rc1-v10', 'afrimarket-green-direct-rc2-v11', 'another-app'], delete: async key => deleted.push(key), open: async () => ({ addAll: async () => {}, put: async () => {} }), match: async () => undefined },
  fetch: async () => { networkCalls++; return new Response('{}', {status: 200}); },
  URL, Request, Response, Promise, setTimeout,
};
vm.runInNewContext(fs.readFileSync('frontend/public/service-worker.js', 'utf8'), sandbox);
(async () => {
  let pending;
  handlers.activate({waitUntil: p => pending = p});
  await pending;
  assert.deepEqual(deleted, ['afrimarket-v6', 'afrimarket-green-v7', 'afrimarket-green-rc3-v9', 'afrimarket-green-direct-rc1-v10']);
  let response;
  handlers.fetch({request: {method: 'GET', url: 'https://api.example/api/orders'}, respondWith: p => response = p});
  assert.equal((await response).status, 200);
  assert.equal(networkCalls, 1);
  sandbox.fetch = async () => { throw Error('offline'); };
  handlers.fetch({request: {method: 'GET', url: 'https://api.example/api/orders'}, respondWith: p => response = p});
  assert.equal((await response).status, 503);
  response = undefined;
  handlers.fetch({request: new Request('https://private.example/documents/customer.pdf'), respondWith: p => response = p});
  assert.equal(response, undefined, 'unknown external origins bypass the public cache');
  handlers.fetch({request: new Request('https://staging.example/private.json', {headers:{Authorization:'Bearer synthetic-test'}}), respondWith: p => response = p});
  assert.equal((await response).status, 503, 'authorized requests remain network only');
  console.log('PASS: old AfriMarket cache removed, unrelated cache preserved, cross-origin API network-only, offline API returns 503');
})().catch(e => {console.error(e); process.exitCode = 1;});
