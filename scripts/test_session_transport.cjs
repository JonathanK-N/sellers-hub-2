// Author: Jonathan Kakesa (JonathanK-N). No network or database access.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const code = fs.readFileSync(path.join(__dirname, "../frontend/src/lib/session_api.js"), "utf8")
    .replace('import { API_BASE } from "./api_config";', 'const API_BASE = "https://session.invalid/api";');
  const { verifySession } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
  const original = global.fetch;
  let calls = 0;
  try {
    global.fetch = async (url, options) => {
      calls++;
      assert.equal(url, "https://session.invalid/api/auth/me");
      assert.equal(options.method, "GET");
      assert.equal(options.credentials, "omit");
      assert.equal(options.cache, "no-store");
      assert.equal(options.headers.Authorization, "Bearer session-fixture");
      assert.equal(options.body, undefined);
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(JSON.stringify({id: "existing-user", role: "buyer"}), {status: 200});
    };
    assert.equal((await verifySession("session-fixture")).role, "buyer");
    for (const status of [401, 403]) {
      global.fetch = async () => new Response("not-json", {status});
      await assert.rejects(verifySession("session-fixture"), error => error.response?.status === status);
    }
    global.fetch = async () => { throw new TypeError("Network unavailable"); };
    await assert.rejects(verifySession("session-fixture"), TypeError);
    assert.equal(calls, 1);
    console.log("PASS: session GET, no cookies/cache/body, HTTP 401/403 without JSON, network errors");
  } finally { global.fetch = original; }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
