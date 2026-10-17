// Author: Jonathan Kakesa. Synthetic local regression; no provider or database writes.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE);
const {createPreviewHandler} = require('./ui_premium_preview.cjs');
(async () => {
  const server = http.createServer(createPreviewHandler(path.resolve(process.argv[2])));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, ...(process.platform === 'win32' ? {executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'} : {})});
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({viewport:{width, height:900}, serviceWorkers:'block'});
      await context.addInitScript(() => { localStorage.setItem('afri_token', 'synthetic-local-session'); localStorage.setItem('afri_user', JSON.stringify({id:'synthetic-admin', role:'admin', name:'Test'})); });
      await context.route('**/api/**', route => {
        const pathname = new URL(route.request().url()).pathname;
        assert.equal(route.request().method(), 'GET');
        if (pathname === '/api/auth/me') return route.fulfill({json:{id:'synthetic-admin', role:'admin', name:'Test'}});
        if (pathname === '/api/communications/admin/templates') return route.fulfill({json:Array.from({length:26}, (_, i) => ({id:'template-'+i, subject:'Votre commande et les informations de livraison AfriMarket '+i}))});
        if (pathname === '/api/communications/admin/templates/template-25') return route.fulfill({contentType:'text/html', body:'<html><body>Prévisualisation synthétique</body></html>'});
        return route.fulfill({json:[]});
      });
      const page = await context.newPage();
      await page.goto(origin + '/admin/email-templates');
      await page.locator('select option').nth(26).waitFor({state:'attached'});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow at ' + width);
      await page.getByLabel('Modèle').selectOption('template-25');
      await page.getByTitle('Aperçu synthétique de l’e-mail').waitFor();
      assert.equal(await page.locator('iframe').getAttribute('sandbox'), '');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Preview overflow at ' + width);
      console.log(JSON.stringify({width, status:'PASS', options:27, sandboxedPreview:true}));
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
