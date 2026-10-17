// Author: Jonathan Kakesa (JonathanK-N). Code hints must never fetch private data.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const pages = {
  "/buyer/home": "src/pages/buyer/Home.jsx",
  "/buyer/cart": "src/pages/buyer/Cart.jsx",
  "/buyer/orders": "src/pages/buyer/Orders.jsx",
  "/messages": "src/pages/Messages.jsx",
  "/seller/dashboard": "src/pages/seller/Dashboard.jsx",
  "/admin/overview": "src/pages/admin/Overview.jsx",
  "/": "src/pages/Landing.jsx",
};
function evaluate(html, pathname) {
  const code = html.match(/<script data-afrimarket-route-hints>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(code, "Early route resource hints must exist in the build");
  const links = [];
  vm.runInNewContext(code, {
    location: { pathname },
    document: { createElement: () => ({}), head: { appendChild: node => links.push(node) } },
    fetch: () => { throw Error("Resource hints must not call an API"); },
    localStorage: { getItem: () => { throw Error("Resource hints must not read a session"); } },
  });
  return links;
}
(async () => {
  const { routeResourceHints } = await import(pathToFileURL(path.join(__dirname, "../frontend/build-tools/route_resource_hints.mjs")).href);
  const bundle = {
    "assets/shared.js": { type: "chunk", fileName: "assets/shared.js", imports: ["assets/index.js"] },
    "assets/index.js": { type: "chunk", fileName: "assets/index.js", imports: ["assets/shared.js"] },
  };
  for (const [index, source] of Object.values(pages).entries()) {
    const fileName = "assets/page-" + index + ".js";
    bundle[fileName] = { type: "chunk", fileName, imports: ["assets/shared.js"], facadeModuleId: "C:\\repo\\" + source.replaceAll("/", "\\") };
  }
  const html = routeResourceHints(bundle, "https://service.invalid/api");
  const selected = evaluate(html, "/buyer/home");
  assert.equal(selected[0].rel, "preconnect");
  assert.equal(selected[0].href, "https://service.invalid");
  assert.deepEqual(selected.filter(link => link.rel === "modulepreload").map(link => link.href), ["/assets/page-0.js", "/assets/shared.js", "/assets/index.js"]);
  assert.deepEqual(evaluate(html, "/").filter(link => link.rel === "modulepreload").map(link => link.href), ["/assets/page-6.js", "/assets/shared.js", "/assets/index.js"]);
  assert.equal(evaluate(routeResourceHints(bundle, ""), "/unknown").length, 0);
  assert.equal(evaluate(routeResourceHints(bundle, "javascript:invalid"), "/unknown").length, 0);
  assert.equal(routeResourceHints(null, ""), "");
  assert.throws(() => routeResourceHints({}, ""), /entry missing/);
  if (process.argv[2]) {
    const build = path.resolve(process.argv[2]);
    const builtHtml = fs.readFileSync(path.join(build, "index.html"), "utf8");
    const heroPreload = builtHtml.indexOf('hero.fetchPriority = "high"');
    assert.ok(heroPreload >= 0 && heroPreload < builtHtml.indexOf('data-afrimarket-route-hints'),
      "High-priority landing image must be discovered before the route module graph");
    for (const route of Object.keys(pages)) {
      const files = evaluate(builtHtml, route).filter(link => link.rel === "modulepreload").map(link => link.href);
      assert.ok(files.length > 0);
      for (const file of files) {
        const target = path.resolve(build, "." + file);
        assert.ok(target.startsWith(build + path.sep));
        assert.ok(fs.statSync(target).isFile());
      }
    }
    const homeFiles = evaluate(builtHtml, "/").filter(link => link.rel === "modulepreload").map(link => link.href);
    assert.ok(homeFiles.some(file => /Landing-/.test(file)));
    assert.ok(!homeFiles.some(file => /(?:Cart|Dashboard|Overview|Messages)-/.test(file)), "Public hints must not include private screens");
    const cartFiles = evaluate(builtHtml, "/buyer/cart").filter(link => link.rel === "modulepreload").map(link => link.href);
    assert.ok(!cartFiles.some(file => /Landing-/.test(file)), "Private routes must not load the public marketplace");
  }
  console.log("PASS: requested route graph only, dependencies deduplicated, no API/session access, public/private screen code isolated, compiled targets exist");
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
