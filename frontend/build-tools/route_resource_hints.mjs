// Author: Jonathan Kakesa (JonathanK-N). Hints fetch code, never private data.
const screens = {
  "/": "src/pages/Landing.jsx",
  "/buyer/home": "src/pages/buyer/Home.jsx",
  "/buyer/cart": "src/pages/buyer/Cart.jsx",
  "/buyer/orders": "src/pages/buyer/Orders.jsx",
  "/messages": "src/pages/Messages.jsx",
  "/seller/dashboard": "src/pages/seller/Dashboard.jsx",
  "/admin/overview": "src/pages/admin/Overview.jsx",
};

export function routeResourceHints(bundle, backendUrl) {
  if (!bundle) return "";
  const routes = {};
  for (const [route, source] of Object.entries(screens)) {
    const entry = Object.values(bundle).find(chunk =>
      chunk.type === "chunk" && chunk.facadeModuleId?.replaceAll("\\", "/").endsWith("/" + source),
    );
    if (!entry) throw new Error("Private route entry missing: " + source);
    const seen = new Set();
    const collect = file => {
      if (seen.has(file)) return;
      const chunk = bundle[file];
      if (chunk?.type !== "chunk") return;
      seen.add(file);
      for (const dependency of chunk.imports) collect(dependency);
    };
    collect(entry.fileName);
    routes[route] = [...seen].map(file => "/" + file);
  }
  let apiOrigin = null;
  try {
    const url = new URL(backendUrl);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) apiOrigin = url.origin;
  } catch {}
  const settings = JSON.stringify({ routes, apiOrigin }).replaceAll("<", "\\u003c");
  return `<script data-afrimarket-route-hints>(function(){
    var settings=${settings};
    if(settings.apiOrigin){var connection=document.createElement("link");connection.rel="preconnect";connection.href=settings.apiOrigin;connection.crossOrigin="anonymous";document.head.appendChild(connection);}
    (settings.routes[location.pathname]||[]).forEach(function(href){var link=document.createElement("link");link.rel="modulepreload";link.href=href;link.crossOrigin="anonymous";document.head.appendChild(link);});
  })();</script>`;
}
