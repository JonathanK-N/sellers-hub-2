const fs=require('fs');
const output=process.argv[2]||'release-evidence/pwa-cart-validation.json';
const {chromium}=require('C:/Users/Djibril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const rows=[];
 try {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const session=JSON.parse(fs.readFileSync(process.argv[3]||'../Afrimarket-private-backups/staging-session.json','utf8'));
  await context.addInitScript(({buyer})=>{localStorage.setItem('afri_token',buyer.access_token);localStorage.setItem('afri_user',JSON.stringify(buyer.user));},{buyer:session.buyer});
  const page=await context.newPage();
  await page.goto('https://afrimarket-web-staging-staging.up.railway.app/buyer/product/'+session.productId,{waitUntil:'domcontentloaded'});
  await page.getByTestId('add-to-cart-btn').click();
  console.log('Added product; checking drawer');
  await page.getByTestId('cart-drawer').waitFor();
  const count=await page.locator('[data-testid^="cart-drawer-item-"]').count();
  rows.push({test:'authenticated add product opens populated cart drawer',status:count===1?'PASS':'FAIL',items:count});
  const totalBefore=await page.getByTestId('cart-drawer-total').textContent();
  await page.getByRole('button',{name:'Augmenter',exact:true}).click();
  const totalAfter=await page.getByTestId('cart-drawer-total').textContent();
  rows.push({test:'cart quantity increase updates total',status:totalBefore!==totalAfter?'PASS':'FAIL'});
  await page.getByRole('button',{name:'Diminuer',exact:true}).click();
  rows.push({test:'cart quantity decrease restores total',status:await page.getByTestId('cart-drawer-total').textContent()===totalBefore?'PASS':'FAIL'});
  await page.getByTestId('cart-drawer-checkout').click();
  await page.waitForURL('**/buyer/cart');
  rows.push({test:'cart drawer checkout route',status:'PASS'});
  console.log('Cart drawer tests passed');
  await page.goto('https://afrimarket-web-staging-staging.up.railway.app/buyer/home',{waitUntil:'networkidle'});
  await page.getByTestId('top-header').waitFor();
  const sw=await page.evaluate(async()=>{const r=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Service worker did not become ready within 15 seconds')),15000))]);return {scope:r.scope,active:r.active?.scriptURL,keys:await caches.keys()};});
  rows.push({test:'real browser service worker active',status:sw.active?.endsWith('/service-worker.js')&&sw.keys.includes('afrimarket-green-rc2-v8')?'PASS':'FAIL',worker:sw});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByTestId('top-header').waitFor();
  const green=await page.getByTestId('top-header').evaluate(el=>getComputedStyle(el).backgroundColor);
  rows.push({test:'offline cached shell renders green header after reload',status:green==='rgb(8, 80, 65)'?'PASS':'FAIL',color:green});
  await context.setOffline(false);
  console.log(JSON.stringify({rows},null,2));
  fs.writeFileSync(output,JSON.stringify({rows},null,2));
 } catch(error) {
  rows.push({test:'remaining PWA/cart validation',status:'FAIL',error:error.message});
  fs.writeFileSync(output,JSON.stringify({rows},null,2));
  throw error;
 } finally {await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
