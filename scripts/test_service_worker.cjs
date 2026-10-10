const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const handlers = {};
const deleted = [];
let networkCalls = 0;
const sandbox = {
  self: { addEventListener: (name, handler) => handlers[name] = handler, skipWaiting() {}, clients: { claim() {} }, location: { origin: 'https://staging.example' } },
  caches: { keys: async () => ['afrimarket-v6', 'afrimarket-green-v7', 'another-app'], delete: async key => deleted.push(key), open: async () => ({ addAll: async () => {}, put: async () => {} }), match: async () => undefined },
  fetch: async () => { networkCalls++; return new Response('{}', {status: 200}); },
  URL, Response, Promise, setTimeout,
};
vm.runInNewContext(fs.readFileSync('frontend/public/service-worker.js', 'utf8'), sandbox);
(async () => {
  let pending;
  handlers.activate({waitUntil: p => pending = p});
  await pending;
  assert.deepEqual(deleted, ['afrimarket-v6']);
  let response;
  handlers.fetch({request: {method: 'GET', url: 'https://api.example/api/orders'}, respondWith: p => response = p});
  assert.equal((await response).status, 200);
  assert.equal(networkCalls, 1);
  sandbox.fetch = async () => { throw Error('offline'); };
  handlers.fetch({request: {method: 'GET', url: 'https://api.example/api/orders'}, respondWith: p => response = p});
  assert.equal((await response).status, 503);
  console.log('PASS: old AfriMarket cache removed, unrelated cache preserved, cross-origin API network-only, offline API returns 503');
})().catch(e => {console.error(e); process.exitCode = 1;});
