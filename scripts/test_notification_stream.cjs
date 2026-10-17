const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../frontend/src/lib/notification_stream.js'), 'utf8')
  .replace('import { API_BASE } from "./api_config";', 'const API_BASE = "https://fixture.invalid/api";');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const { startNotificationStream } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  global.window = new EventTarget(); global.document = new EventTarget(); document.hidden = false;
  let changes = 0, expired = 0, calls = 0, signal;
  window.addEventListener('afri-notifications-changed', () => changes++);
  window.addEventListener('afri-session-expired', () => expired++);
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://fixture.invalid/api/notifications/stream');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-session');
    assert.equal(options.cache, 'no-store'); signal = options.signal; calls++;
    return new Response(new ReadableStream({ start(controller) {
      for (const text of ['event: chan', 'ged\ndata: {}\n', '\nevent: changed\ndata: {}\n\n']) controller.enqueue(new TextEncoder().encode(text));
      options.signal.addEventListener('abort', () => controller.close());
    }}), { headers: {'Content-Type':'text/event-stream'} });
  };
  const stop = startNotificationStream('synthetic-session');
  await sleep(30); assert.equal(changes, 2); assert.equal(calls, 1);
  document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); await sleep(30);
  assert(signal.aborted); assert.equal(calls, 1);
  document.hidden = false; document.dispatchEvent(new Event('visibilitychange')); await sleep(30);
  assert.equal(calls, 2); assert.equal(changes, 5);
  stop(); await sleep(30); assert(signal.aborted);
  global.fetch = async () => new Response('', {status:401});
  const stopExpired = startNotificationStream('expired-session'); await sleep(30);
  assert.equal(expired, 1); stopExpired();
  let reconnects = 0;
  global.fetch = async () => {
    reconnects++;
    return new Response('event: changed\ndata: {}\n\n', {headers:{'Content-Type':'text/event-stream'}});
  };
  const stopReconnect = startNotificationStream('synthetic-session');
  await sleep(1200); assert.equal(reconnects, 2); stopReconnect();
  await sleep(1100); assert.equal(reconnects, 2);
  console.log('PASS: authenticated fragmented events, visibility cleanup, 401, reconnect resync and unsubscribe');
})().catch(error => { console.error(error); process.exitCode = 1; });
