// Browser validation of the exact Web artifact; no production or native installation.
const fs = require('fs');
const path = require('path');
const http = require('http');
const cp = require('child_process');
const {chromium} = require('C:/Users/Djibril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const build = path.resolve(process.argv[2]);
  const output = process.argv[3] || 'release-evidence/phase2/pwa-upgrade.json';
  const oldWorker = cp.execFileSync('git', ['show', 'release/afrimarket-phase1-final-20261010:frontend/public/service-worker.js']);
  let upgraded = false;
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/service-worker.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'no-store');
      res.end(upgraded ? fs.readFileSync(path.join(build, 'service-worker.js')) : oldWorker);
      return;
    }
    const target = path.resolve(build, '.' + pathname);
    if (target !== build && !target.startsWith(build + path.sep)) {res.writeHead(403); res.end(); return;}
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(build, 'index.html');
    const types = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.woff2':'font/woff2', '.png':'image/png'};
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  const rows = [];
  try {
    const context = await browser.newContext({serviceWorkers:'allow', viewport:{width:390,height:844}});
    const page = await context.newPage();
    await page.goto(origin, {waitUntil:'networkidle'});
    await page.evaluate(async () => {await navigator.serviceWorker.register('/service-worker.js'); await navigator.serviceWorker.ready;});
    await page.reload({waitUntil:'networkidle'});
    await page.evaluate(async () => {
      await caches.open('unrelated-application-v1');
      const legacy = await caches.open('afrimarket-orange-v6');
      await legacy.put('/legacy-orange', new Response('old'));
    });
    const oldCaches = await page.evaluate(() => caches.keys());
    rows.push({test:'Phase 1 worker controls browser',status:oldCaches.includes('afrimarket-green-v7')?'PASS':'FAIL',cacheNames:oldCaches});
    upgraded = true;
    await page.evaluate(async () => {const registration=await navigator.serviceWorker.getRegistration(); await registration.update();});
    let names=[];
    for (let attempt=0;attempt<80;attempt++) {
      names=await page.evaluate(() => caches.keys());
      if(names.includes('afrimarket-green-rc2-v8')&&!names.includes('afrimarket-green-v7')&&!names.includes('afrimarket-orange-v6')) break;
      await page.waitForTimeout(250);
    }
    const migrated=names.includes('afrimarket-green-rc2-v8')&&!names.includes('afrimarket-green-v7')&&!names.includes('afrimarket-orange-v6')&&names.includes('unrelated-application-v1');
    rows.push({test:'Old caches purged and unrelated cache preserved',status:migrated?'PASS':'FAIL',cacheNames:names});
    if(!migrated) throw Error('Worker activation did not migrate caches');
    await page.reload({waitUntil:'networkidle'});
    await page.getByTestId('guest-top-header').waitFor();
    await page.waitForTimeout(1000);
    await context.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByTestId('guest-top-header').waitFor();
    rows.push({test:'Visited landing renders offline',status:'PASS'});
    const api=await page.evaluate(async () => {const response=await fetch('/api/health');return {http:response.status,body:await response.json()};});
    rows.push({test:'Offline API does not return cached success',status:api.http===503?'PASS':'FAIL',http:api.http});
    await page.goto(origin+'/buyer/home', {waitUntil:'domcontentloaded'});
    await page.getByText('Cette page est momentanément indisponible').waitFor({timeout:15000});
    rows.push({test:'Uncached lazy route has readable offline fallback',status:'PASS'});
    await context.setOffline(false);
    await page.getByRole('button',{name:'Réessayer',exact:true}).click();
    await page.waitForURL('**/auth/login',{timeout:20000});
    rows.push({test:'Reconnect recovers lazy route and login redirect',status:'PASS'});
  } catch (error) {
    rows.push({test:'Browser upgrade sequence',status:'FAIL',error:error.message});
    process.exitCode=1;
  } finally {
    await browser.close(); await new Promise(resolve=>server.close(resolve));
    fs.writeFileSync(output,JSON.stringify({scope:'Desktop browser service worker upgrade, not an OS-installed PWA or physical device test',rows},null,2));
    console.log(JSON.stringify(rows,null,2));
  }
})();
