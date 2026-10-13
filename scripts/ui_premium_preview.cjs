// Author: Jonathan Kakesa (JonathanK-N). Local read-only preview, existing staging data only.
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  { gzipSync } = require("node:zlib");
function createPreviewHandler(build) {
  build = path.resolve(build);
  return async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              detail:
                "Aperçu en lecture seule : aucune écriture dans le staging.",
            }),
          );
          return;
        }
        if (
          !/^\/api\/(products(?:\/[^/]+)?|files\/[^/]+|seller\/public\/[^/]+|categories|countries|fx\/rate|auth\/me|health|payments\/features)$/.test(
            url.pathname,
          )
        ) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              detail: "Route hors du périmètre de lecture de cet aperçu.",
            }),
          );
          return;
        }
        const upstream = await fetch(
          "https://afrimarket-api-staging-staging.up.railway.app" +
            url.pathname +
            url.search,
          {
            method: req.method,
            headers: req.headers.authorization
              ? { Authorization: req.headers.authorization }
              : {},
            signal: AbortSignal.timeout(15000),
          },
        );
        res.statusCode = upstream.status;
        res.setHeader(
          "Content-Type",
          upstream.headers.get("content-type") || "application/json",
        );
        res.setHeader("Cache-Control", "no-store");
        res.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end();
        return;
      }
      let file = path.resolve(build, "." + decodeURIComponent(url.pathname));
      if (file !== build && !file.startsWith(build + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile())
        file = path.join(build, "index.html");
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".avif": "image/avif",
          ".woff2": "font/woff2",
          ".json": "application/json",
          ".png": "image/png",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon",
        }[path.extname(file)] || "application/octet-stream",
      );
      let body = fs.readFileSync(file);
      if (
        /\.(html|js|css|json)$/.test(file) &&
        String(req.headers["accept-encoding"]).includes("gzip")
      ) {
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Vary", "Accept-Encoding");
        body = gzipSync(body);
      }
      res.end(body);
    } catch {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ detail: "Lecture staging indisponible, réessayez." }),
      );
    }
  };
}
module.exports = { createPreviewHandler };
if (require.main === module) {
  const server = http.createServer(createPreviewHandler(process.argv[2]));
  server.listen(Number(process.argv[3] || 0), "127.0.0.1", () =>
    console.log("Read-only preview: http://127.0.0.1:" + server.address().port),
  );
  server.on("error", (e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
