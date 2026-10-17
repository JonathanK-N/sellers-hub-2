// Author: Jonathan Kakesa. Local compiled UI, synthetic responses only.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const build = path.resolve(process.argv[2]);
  const output = path.resolve(process.argv[3]);
  const notificationAssets = new Set(fs.readdirSync(path.join(build, 'assets'))
    .filter(name => name.endsWith('.js') && fs.readFileSync(path.join(build, 'assets', name), 'utf8').includes('data-sonner-toaster'))
    .map(name => '/assets/' + name));
  assert.equal(notificationAssets.size, 1, 'Notification renderer has a separate compiled chunk');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file = path.resolve(build, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(build + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
    const types = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.avif':'image/avif', '.png':'image/png', '.woff2':'font/woff2'};
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const checks = [];
  try {
    browser = await chromium.launch({headless:true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {})});
    const context = await browser.newContext({serviceWorkers:'block', viewport:{width:1280,height:900}});
    const requested = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (notificationAssets.has(url.pathname)) requested.push(url.pathname);
      if (url.pathname.includes('/api/')) {
        const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
        if (route.request().method() === 'OPTIONS') return route.fulfill({status:204,headers});
        if (url.pathname.endsWith('/auth/login')) return route.fulfill({status:401,headers,json:{detail:'Identifiants de test invalides'}});
        if (url.pathname.endsWith('/countries')) return route.fulfill({headers,json:[{code:'CD',name:'Congo',dial_code:'+243',currency:'FC',flag:'CD'}]});
        return route.fulfill({headers,json:[]});
      }
      if (url.hostname === '127.0.0.1') return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    await page.getByRole('heading', {level:1}).waitFor();
    assert.equal(requested.length, 0, 'Untouched landing does not fetch notification renderer');
    checks.push({name:'No notification renderer on public landing',status:'PASS'});
    await page.getByRole('button', {name:'Se connecter',exact:true}).first().click();
    await page.getByTestId('login-phone-input').waitFor();
    assert.equal(requested.length, 1);
    checks.push({name:'Authentication loads notification renderer',status:'PASS'});
    await page.getByTestId('login-phone-input').fill('899000111');
    await page.getByTestId('login-password-input').fill('synthetic-password');
    await page.getByTestId('login-submit-btn').click();
    await page.locator('[data-sonner-toaster]').waitFor({state:'attached'});
    await page.getByText('Identifiants de test invalides', {exact:true}).waitFor();
    checks.push({name:'Authentication error notification remains visible',status:'PASS'});
    fs.mkdirSync(path.dirname(output), {recursive:true});
    fs.writeFileSync(output, JSON.stringify({syntheticOnly:true,externalRequests:0,checks},null,2));
    console.log('PASS: notification chunk absent before interaction; auth and error notification remain functional');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
