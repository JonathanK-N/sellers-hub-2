// Author: Jonathan Kakesa (JonathanK-N). All API writes are intercepted synthetic fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Djibril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const build = path.resolve(process.argv[2]);
  const output = path.resolve(process.argv[3]);
  const server = http.createServer((request, response) => {
    const target = path.resolve(build, '.' + new URL(request.url, 'http://localhost').pathname);
    if (target !== build && !target.startsWith(build + path.sep)) { response.writeHead(403); response.end(); return; }
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(build, 'index.html');
    response.setHeader('Content-Type', {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.woff2':'font/woff2', '.json':'application/json', '.avif':'image/avif', '.png':'image/png'}[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, ...(process.platform === 'win32' ? {executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'} : {})});
  const rows = [], writes = [], errors = [];
  let contact = null;
  const legacy = 'https://wa.me/243810000001?text=commande123456';
  const seller = () => ({id:'WA_SHOP', user_id:'WA_SELLER', shop_name:'Boutique de test', country_code:'CD', currency:'FC', category:'Général', social_links:{whatsapp_business:legacy}, whatsapp_contact:contact});
  const publicContact = () => contact?.verified && contact?.visible ? contact : null;
  const product = () => ({id:'WA_PRODUCT', seller_id:'WA_SHOP', seller_name:'Boutique de test', name:'Produit de test', price:1000, stock:5, photos:[], country_code:'CD', currency:'FC', seller_whatsapp:publicContact()});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844}, serviceWorkers:'block'});
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method();
      let body = {}, status = 200;
      if (method === 'OPTIONS') return route.fulfill({status:204});
      if (method !== 'GET') writes.push({method, path:url.pathname});
      if (url.pathname === '/api/auth/me') body = {id:'WA_SELLER', name:'Synthetic seller', role:'seller', phone:'+243810000001', phone_verified:false, country_code:'CD', currency:'FC'};
      else if (url.pathname === '/api/seller/me') body = seller();
      else if (url.pathname === '/api/seller/dashboard') body = {shop:seller(), revenue:0, orders_total:0, orders_pending:0, products_active:1, rating:0};
      else if (url.pathname === '/api/premium/plan') body = {active:false};
      else if (url.pathname === '/api/seller/whatsapp' && method === 'PUT') {
        const draft = request.postDataJSON();
        contact = {phone:draft.phone, visible:draft.visible, verified:contact?.phone === draft.phone && contact?.verified === true};
        body = contact;
      } else if (url.pathname === '/api/seller/whatsapp/send-code' && method === 'POST') body = {status:'verification_sent'};
      else if (url.pathname === '/api/seller/whatsapp/verify' && method === 'POST') {
        if (request.postDataJSON().code !== '123456') { status = 400; body = {detail:'Code incorrect'}; }
        else { contact.verified = true; body = {verified:true}; }
      } else if (url.pathname === '/api/seller/public/WA_SHOP') body = {seller:{...seller(), whatsapp_contact:publicContact()}, products:[product()], reviews:[]};
      else if (url.pathname === '/api/products/WA_PRODUCT') body = product();
      else if (url.pathname === '/api/products' || url.pathname === '/api/admin/banners/public') body = [];
      else if (url.pathname.endsWith('/unread-count')) body = {count:0};
      else if (url.pathname === '/api/fx/rate') body = {rate:2800};
      else if (method !== 'GET') throw Error('Unexpected synthetic write: ' + method + ' ' + url.pathname);
      await route.fulfill({status, json:body});
    });
    await context.addInitScript(() => {
      localStorage.setItem('afri_token', 'synthetic-session');
      localStorage.setItem('afri_user', JSON.stringify({id:'WA_SELLER',role:'seller',country_code:'CD',currency:'FC'}));
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const check = (name, condition) => { assert.ok(condition, name); rows.push({test:name,status:'PASS'}); };
    await page.goto(origin + '/seller/dashboard');
    await page.getByTestId('configure-whatsapp').click();
    await page.getByTestId('whatsapp-phone').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="whatsapp-phone"]').value === '+243810000001');
    check('Dashboard leads to the unique WhatsApp configuration', new URL(page.url()).hash === '#whatsapp');
    check('Legacy URL prefills only the phone, without publication or writes', !(await page.getByTestId('whatsapp-consent').isChecked()) && writes.length === 0 && await page.getByTestId('whatsapp-seller-btn').count() === 0);
    await page.getByTestId('whatsapp-consent').check();
    await page.getByRole('button',{name:'Enregistrer le contact',exact:true}).click();
    await page.getByRole('button',{name:'Envoyer un code de vérification',exact:true}).waitFor();
    check('Saved but unverified contact has no WhatsApp button', await page.getByTestId('whatsapp-seller-btn').count() === 0);
    await page.getByTestId('whatsapp-phone').fill('+243810000002');
    check('An unsaved changed phone cannot trigger verification of the old phone', await page.getByRole('button',{name:'Envoyer un code de vérification',exact:true}).count() === 0);
    await page.getByRole('button',{name:'Enregistrer le contact',exact:true}).click();
    await page.getByRole('button',{name:'Envoyer un code de vérification',exact:true}).click();
    await page.getByTestId('whatsapp-code').fill('000000');
    await page.getByRole('button',{name:'Valider le numéro',exact:true}).click();
    await page.getByText('Code incorrect',{exact:true}).waitFor();
    check('Rejected verification cannot publish a link', await page.getByTestId('whatsapp-seller-btn').count() === 0);
    await page.getByTestId('whatsapp-code').fill('123456');
    await page.getByRole('button',{name:'Valider le numéro',exact:true}).click();
    await page.getByTestId('whatsapp-seller-btn').waitFor();
    check('Verified opted-in contact exposes the new phone in preview', new URL(await page.getByTestId('whatsapp-seller-btn').getAttribute('href')).pathname === '/243810000002');
    await page.goto(origin + '/explore/shop/WA_SHOP');
    await page.getByTestId('whatsapp-seller-btn').waitFor();
    const link = new URL(await page.getByTestId('whatsapp-seller-btn').getAttribute('href'));
    check('Public shop offers a verified WhatsApp draft independently of internal chat', link.origin === 'https://wa.me' && link.pathname === '/243810000002' && !!link.searchParams.get('text') && await page.getByTestId('contact-seller-btn').count() === 1);
    await page.goto(origin + '/explore/product/WA_PRODUCT');
    await page.getByTestId('whatsapp-seller-btn').waitFor();
    check('Product and shop use the same verified contact', new URL(await page.getByTestId('whatsapp-seller-btn').getAttribute('href')).pathname === '/243810000002');
    contact.visible = false;
    await page.goto(origin + '/explore/shop/WA_SHOP');
    await page.getByText('WhatsApp non disponible pour cette boutique. Utilisez la messagerie AfriMarket.',{exact:true}).waitFor();
    check('Legacy social link cannot bypass revoked publication consent', await page.getByTestId('whatsapp-seller-btn').count() === 0 && await page.locator('a[href*="wa.me"]').count() === 0);
    check('No client rendering errors', errors.length === 0);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify({author:'Jonathan Kakesa (JonathanK-N)',scope:'Compiled artifact against intercepted synthetic API only; no production writes, no real SMS or WhatsApp navigation',rows,syntheticWrites:writes},null,2));
    console.log(JSON.stringify({status:'PASS',checks:rows.length}));
    await context.unrouteAll({behavior:'ignoreErrors'});
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
