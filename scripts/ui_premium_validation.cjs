// Author: Jonathan Kakesa (JonathanK-N). Local artifact UI tests; fixtures never written to a database.
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { chromium, firefox, webkit } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/Djibril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
(async () => {
  const build = path.resolve(process.argv[2]),
    output = path.resolve(process.argv[3]);
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    let target = path.resolve(build, "." + decodeURIComponent(pathname));
    if (target !== build && !target.startsWith(build + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile())
      target = path.join(build, "index.html");
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".avif": "image/avif",
        ".woff2": "font/woff2",
        ".json": "application/json",
      }[path.extname(target)] || "application/octet-stream",
    );
    res.end(fs.readFileSync(target));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port,
    rows = [],
    unavailable = [];
  const products = [
    {
      id: "UI_FIXTURE_A",
      name: "Panier de produits frais",
      price: 1200,
      currency: "FC",
      seller_id: "UI_SHOP_A",
      seller_name: "Boutique de test",
      category: "Alimentation",
      photos: ["/images/market-hero-400.avif"],
      stock: 8,
      seller_verified: false,
      seller_rating: 0,
    },
    {
      id: "UI_FIXTURE_B",
      name: "Article <script>sans exécution</script>",
      price: 25,
      currency: "USD",
      seller_id: "UI_SHOP_B",
      seller_name: "Deuxième boutique",
      category: "Électronique",
      photos: [],
      stock: 2,
      seller_verified: true,
      seller_rating: 4.2,
    },
  ];
  for (const [engine, type] of [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit],
  ]) {
    let browser;
    try {
      browser = await type.launch({
        headless: true,
        ...(engine === "chromium" && process.platform === "win32"
          ? {
              executablePath:
                "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
            }
          : {}),
      });
    } catch (e) {
      if (engine === "chromium") throw e;
      unavailable.push({
        engine,
        status: "UNAVAILABLE",
        reason: "Browser runtime unavailable locally; not counted as PASS",
      });
      continue;
    }
    try {
      for (const width of engine === "chromium"
        ? [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920, 2560]
        : [390, 1440]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          isMobile: engine === "chromium" && width < 768,
          hasTouch: width < 768,
          serviceWorkers: "block",
        });
        let networkMode = "success",
          requests = [];
        await context.route("**/api/**", async (route) => {
          const url = new URL(route.request().url());
          requests.push({
            method: route.request().method(),
            path: url.pathname,
          });
          if (route.request().method() !== "GET")
            throw Error("Unexpected database write");
          let body = {};
          if (url.pathname.endsWith("/products")) {
            if (networkMode === "slow")
              await new Promise((r) => setTimeout(r, 1500));
            if (networkMode === "error") {
              await route.fulfill({
                status: 503,
                json: { detail: "fixture offline" },
              });
              return;
            }
            const category = url.searchParams.get("category");
            body =
              networkMode === "empty"
                ? []
                : products.filter((p) => !category || p.category === category);
          } else if (url.pathname.includes("/seller/public/")) {
            const id = url.pathname.split("/").at(-1);
            body = {
              seller: {
                id,
                shop_name:
                  id === "UI_SHOP_A" ? "Boutique de test" : "Deuxième boutique",
                category: "Commerce local",
                badge_verified: id === "UI_SHOP_B",
              },
              products: [],
            };
          } else if (url.pathname.endsWith("/fx/rate")) body = { rate: 2800 };
          else if (url.pathname.endsWith("/countries"))
            body = [{ code: "CD", dial_code: "+243", name: "RD Congo" }];
          else if (url.pathname.endsWith("/auth/me")) {
            await route.fulfill({
              status: 401,
              json: { detail: "fixture expired" },
            });
            return;
          }
          await route.fulfill({ status: 200, json: body });
        });
        const page = await context.newPage(),
          errors = [];
        const revealCatalog = async () => {
          await page.locator(".premium-product-grid").scrollIntoViewIfNeeded();
        };
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(origin, { waitUntil: "domcontentloaded" });
        await revealCatalog();
        await page
          .locator('.premium-catalog [data-testid="product-card-UI_FIXTURE_A"]')
          .waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          `${engine} ${width}: overflow`,
        );
        assert.equal(await page.locator("h1").count(), 1);
        assert.equal(
          await page.evaluate(() => {
            const hero = document
              .querySelector(".premium-hero")
              .getBoundingClientRect();
            return [...document.querySelectorAll(".premium-floating")]
              .filter((el) => el.getClientRects().length > 0)
              .every((el) => {
                const r = el.getBoundingClientRect();
                return (
                  r.top >= hero.top &&
                  r.bottom <= hero.bottom &&
                  r.left >= hero.left &&
                  r.right <= hero.right
                );
              });
          }),
          true,
          "Floating product content remains within hero",
        );
        assert.equal(await page.locator("main").count(), 1);
        assert.equal(
          await page
            .locator('.premium-catalog [aria-label="Vendeur vérifié"]')
            .count(),
          1,
          "Only actual verified fixture gets badge",
        );
        assert.equal(
          await page
            .locator(
              '.premium-catalog [data-testid="product-card-UI_FIXTURE_A"] .premium-product-body strong',
            )
            .innerText(),
          "1 200 FC",
        );
        assert.equal(await page.locator(".premium-catalog script").count(), 0);
        assert.equal(errors.length, 0);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: path.join(output, `${engine}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
        await page.screenshot({
          path: path.join(output, `${engine}-${width}-viewport.png`),
          fullPage: false,
          animations: "disabled",
        });
        rows.push({
          test: `${engine} ${width}px responsive, prices, escaped data, badges`,
          status: "PASS",
        });
        if (engine === "chromium" && width === 390) {
          const card = page.locator(
            '.premium-catalog [data-testid="product-card-UI_FIXTURE_A"]',
          );
          await card
            .getByRole("button", { name: /Ajouter aux favoris/ })
            .click();
          assert.equal(
            await card
              .getByRole("button", { name: /Retirer des favoris/ })
              .getAttribute("aria-pressed"),
            "true",
          );
          await page.reload();
          await revealCatalog();
          await page
            .locator(
              '.premium-catalog [data-testid="product-card-UI_FIXTURE_A"] [aria-pressed="true"]',
            )
            .waitFor();
          rows.push({
            test: "Favorites survive reload as public IDs only",
            status: "PASS",
          });
          await page.getByRole("button", { name: "Ouvrir le menu" }).click();
          await page.getByRole("button", { name: "Fermer le menu" }).focus();
          await page.keyboard.press("Shift+Tab");
          assert.equal(
            await page
              .locator("[role=dialog] button")
              .last()
              .evaluate((e) => e === document.activeElement),
            true,
          );
          await page.keyboard.press("Tab");
          assert.equal(
            await page
              .getByRole("button", { name: "Fermer le menu" })
              .evaluate((e) => e === document.activeElement),
            true,
          );
          rows.push({
            test: "Menu traps forward and reverse keyboard focus",
            status: "PASS",
          });
          await page.keyboard.press("Escape");
          await page.locator('[role="dialog"]').waitFor({ state: "hidden" });
          assert.equal(
            await page
              .getByRole("button", { name: "Ouvrir le menu" })
              .evaluate((e) => e === document.activeElement),
            true,
          );
          rows.push({
            test: "Keyboard menu Escape restores focus",
            status: "PASS",
          });
          await page.getByTestId("guest-category-Alimentation").click();
          await page
            .locator(
              '.premium-catalog [data-testid="product-card-UI_FIXTURE_B"]',
            )
            .waitFor({ state: "hidden" });
          await card.waitFor();
          rows.push({
            test: "Category controls request real API category parameter",
            status: "PASS",
          });
          await page
            .getByRole("textbox", { name: "Rechercher un produit" })
            .fill("panier local");
          await page
            .getByRole("button", { name: "Rechercher", exact: true })
            .click();
          await page.waitForURL(
            (url) =>
              url.pathname === "/explore/search" &&
              url.searchParams.get("q") === "panier local" &&
              url.searchParams.get("country_code") === "CD",
          );
          rows.push({
            test: "Search navigates to existing search route",
            status: "PASS",
          });
          await page.goto(origin);
          await revealCatalog();
          await page
            .locator(
              '.premium-catalog [data-testid="product-card-UI_FIXTURE_A"]',
            )
            .waitFor();
          await page
            .locator(
              '.premium-catalog [data-testid="product-card-UI_FIXTURE_A"]',
            )
            .getByRole("button", { name: /Ajouter au panier/ })
            .click();
          await page.locator('[data-testid="login-phone-input"]').waitFor();
          rows.push({
            test: "Guest cart action requests authentication",
            status: "PASS",
          });
          networkMode = "slow";
          await page.goto(origin, { waitUntil: "domcontentloaded" });
          await page.locator(".premium-product-grid[aria-busy=true]").waitFor();
          assert.equal(await page.locator(".premium-skeleton").count(), 5);
          await revealCatalog();
          await page
            .locator(
              '.premium-catalog [data-testid="product-card-UI_FIXTURE_A"]',
            )
            .waitFor();
          rows.push({
            test: "Slow connection exposes loading skeleton before actual products",
            status: "PASS",
          });
          networkMode = "error";
          await page.goto(origin);
          await page
            .getByRole("alert")
            .filter({ hasText: "catalogue" })
            .waitFor();
          networkMode = "success";
          await page.getByRole("button", { name: "Réessayer" }).click();
          await page
            .locator(
              '.premium-catalog [data-testid="product-card-UI_FIXTURE_A"]',
            )
            .waitFor();
          rows.push({
            test: "Network failure visible and retry recovers",
            status: "PASS",
          });
          networkMode = "empty";
          await page.reload();
          await page.getByRole("heading", { name: /Aucun produit/ }).waitFor();
          rows.push({
            test: "Empty catalog gives useful state without fabricated products",
            status: "PASS",
          });
          await page.goto(origin + "/auth/register?role=seller");
          await page.locator('[data-testid="register-phone-input"]').waitFor();
          rows.push({
            test: "Become seller route loads existing registration",
            status: "PASS",
          });
          await page.evaluate(() => {
            localStorage.setItem(
              "afri_user",
              JSON.stringify({ role: "admin", id: "UI_STALE" }),
            );
            localStorage.removeItem("afri_token");
          });
          await page.goto(origin + "/admin/overview");
          await page.waitForURL("**/auth/login");
          rows.push({
            test: "Stale stored admin identity cannot enter private route",
            status: "PASS",
          });
          await page.evaluate(() => {
            localStorage.setItem("afri_token", "expired-fixture");
            localStorage.setItem(
              "afri_user",
              JSON.stringify({ role: "admin", id: "UI_EXPIRED" }),
            );
          });
          await page.goto(origin + "/admin/overview");
          await page.waitForURL("**/auth/login");
          assert.equal(
            await page.evaluate(() => localStorage.getItem("afri_token")),
            null,
          );
          assert.ok(!requests.some((r) => r.path.startsWith("/api/admin/")));
          rows.push({
            test: "Expired private session cleared before private API access",
            status: "PASS",
          });
          let releasePrivateClient;
          const privateClientGate = new Promise(resolve => { releasePrivateClient = resolve; });
          let privateClientRequested = false;
          await context.route("**/assets/api-*.js", async route => {
            privateClientRequested = true;
            await privateClientGate;
            await route.continue();
          });
          await context.route("**/api/auth/me", route => route.fulfill({
            status: 200, contentType: "application/json",
            body: JSON.stringify({id: "UI_VERIFIED", role: "buyer", name: "Verified buyer fixture", country_code: "CD", currency: "FC"}),
          }));
          await page.evaluate(() => {
            localStorage.setItem("afri_token", "valid-ui-fixture");
            localStorage.setItem("afri_user", JSON.stringify({id: "UI_VERIFIED", role: "buyer", name: "Pending fixture"}));
          });
          try {
            await page.goto(origin + "/buyer/home", {waitUntil: "domcontentloaded"});
            await page.waitForFunction(() => JSON.parse(localStorage.getItem("afri_user") || "{}").name === "Verified buyer fixture", undefined, {timeout: 10000});
            assert.equal(privateClientRequested, true);
            rows.push({test: "Session verified while private Axios chunk remains blocked", status: "PASS"});
          } finally {
            releasePrivateClient();
          }
        }
        assert.ok(requests.every((r) => r.method === "GET"));
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
  fs.writeFileSync(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        author: "Jonathan Kakesa (JonathanK-N)",
        scope:
          "Local built artifact; clearly synthetic UI fixtures via browser interception, zero backend writes; no HTTPS certificate",
        rows,
        unavailable,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ status: "PASS", checks: rows.length, unavailable }),
  );
  await new Promise((r) => server.close(r));
})().catch((e) => {
  console.error(e.stack);
  process.exit(1);
});
