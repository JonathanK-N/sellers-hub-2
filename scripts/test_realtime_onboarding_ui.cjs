const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const build = path.resolve(__dirname, '../frontend/build');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file = path.resolve(build, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(build + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
    const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.avif':'image/avif','.svg':'image/svg+xml'};
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(4179,'127.0.0.1',resolve));
  let browser;
  const results = [];
  try {
    browser = await chromium.launch({headless:true,channel:process.env.QA_BROWSER_CHANNEL || undefined,
      executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
    console.log('Browser ready: synthetic onboarding scenarios');
    const context = await browser.newContext({serviceWorkers:'block'});
    let user = {id:'fixture',name:'Fixture',role:'buyer',phone:'+243000000001',phone_verified:true,country_code:'CD'};
    let items = [], activation = 0, switches = 0, verified = 0;
    await context.addInitScript(() => {
      localStorage.setItem('afri_token','synthetic-session');
      const original = window.fetch;
      window.fetch = (url, options) => {
        if (!String(url).endsWith('/notifications/stream')) return original(url, options);
        return Promise.resolve(new Response(new ReadableStream({start(controller) {
          window.fixtureNotification = () => controller.enqueue(new TextEncoder().encode('event: changed\ndata: {}\n\n'));
          window.fixtureNotification();
          options.signal.addEventListener('abort', () => controller.close());
        }}), {headers:{'Content-Type':'text/event-stream'}}));
      };
    });
    await context.route('**/api/**', async route => {
      const p = new URL(route.request().url()).pathname;
      let data = [];
      if (p === '/api/auth/me') data = user;
      else if (p === '/api/auth/become-seller') {
        activation++; user = {...user,role:'seller',seller_enabled:true,account_role:'buyer'};
        data = {token:'synthetic-seller-session',user};
      } else if (p === '/api/auth/switch-role') {
        switches++; user = {...user,role:route.request().postDataJSON().role};
        data = {token:'synthetic-buyer-session',user};
      } else if (p === '/api/seller/me') data = null;
      else if (p === '/api/notifications') data = items;
      else if (p === '/api/notifications/unread-count') data = {count:items.filter(n => !n.read).length};
      else if (p === '/api/messages/unread-count') data = {count:0};
      else if (p === '/api/notifications/read-all') {items = items.map(n => ({...n,read:true})); data = {ok:true};}
      else if (p === '/api/communications/email/verify') {
        verified++; assert.equal(route.request().postDataJSON().token, 'synthetic-verification-link');
        user = {...user,email:'fixture@resend.dev',email_verified:true};
        data = {ok:true,message:'Votre adresse e-mail est vérifiée.'};
      }
      await route.fulfill({status:200,json:data});
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4179/buyer/profile');
    await page.getByRole('link',{name:'Devenir vendeur',exact:true}).click();
    await page.getByRole('button',{name:'Activer mon espace vendeur'}).click();
    await page.waitForURL('**/seller/setup'); assert.equal(activation,1);
    await page.goto('http://127.0.0.1:4179/buyer/profile');
    await page.getByRole('link',{name:'Revenir à mon espace acheteur'}).click();
    await page.getByRole('button',{name:'Ouvrir mon espace acheteur'}).click();
    await page.waitForURL('**/buyer/home'); assert.equal(switches,1);
    results.push('buyer activates seller then returns to buying with same identity');
    console.log('PASS: seller workspace round trip');
    await page.goto('http://127.0.0.1:4179/email/verify#token=synthetic-verification-link');
    await page.getByRole('heading',{name:'Confirmer votre adresse e-mail'}).waitFor();
    assert.equal(new URL(page.url()).hash,'');
    await page.reload();
    await page.getByRole('button',{name:'Confirmer',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Votre adresse e-mail est vérifiée.'}).waitFor();
    assert.equal(verified,1);
    await page.goto('http://127.0.0.1:4179/buyer/profile');
    await page.getByRole('link',{name:'Adresse e-mail vérifiée · Gérer'}).waitFor();
    results.push('verification survives reload, consumes once and refreshes profile');
    console.log('PASS: verification and profile refresh');
    await page.goto('http://127.0.0.1:4179/notifications');
    await page.getByRole('heading',{name:'Notifications',exact:true}).waitFor();
    items = [{id:'new-fixture',type:'order_confirmed',title:'Nouvelle notification fixture',body:'Contenu synthétique',read:false,created_at:new Date().toISOString()}];
    await page.waitForFunction(() => typeof window.fixtureNotification === 'function');
    await page.evaluate(() => window.fixtureNotification());
    await page.getByText('Nouvelle notification fixture',{exact:true}).waitFor();
    await page.getByTestId('mark-all-read').click();
    await page.goto('http://127.0.0.1:4179/buyer/profile');
    await page.getByTestId('notifications-btn').waitFor();
    assert.equal(await page.getByTestId('notifications-btn').getAttribute('aria-label'),'Notifications');
    results.push('live notification updates feed and mark-all-read clears badge');
    await context.close();
  } finally {await browser?.close(); await new Promise(resolve => server.close(resolve));}
  const proof = {scope:'Local browser, synthetic API fixtures and SSE transport; no external sends',status:'PASS',results};
  if (process.argv[2]) fs.writeFileSync(process.argv[2],JSON.stringify(proof,null,2));
  console.log(JSON.stringify(proof));
})().catch(error => {console.error(error);process.exitCode=1;});
