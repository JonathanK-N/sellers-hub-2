const fs=require('fs');
const {chromium}=require('C:/Users/Djibril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const context=await browser.newContext({serviceWorkers:'block'}); context.on('request',r=>{if(r.url().includes('auth'))console.log('REQUEST',r.method(),r.url());}); context.on('response',r=>{if(r.url().includes('auth'))console.log('RESPONSE',r.status(),r.url());});
  const session=JSON.parse(fs.readFileSync('../Afrimarket-private-backups/staging-session.json','utf8'));
  await context.addInitScript(({buyer})=>{localStorage.setItem('afri_token',buyer.access_token);localStorage.setItem('afri_user',JSON.stringify(buyer.user));},{buyer:session.buyer});
  await context.route('**/api/auth/me',route=>route.fulfill({status:route.request().method()==='OPTIONS'?204:401,headers:{'access-control-allow-origin':'https://afrimarket-web-staging-staging.up.railway.app','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'authorization,content-type'},contentType:'application/json',body:route.request().method()==='OPTIONS'?'':JSON.stringify({detail:'Token expired'})}));
  const page=await context.newPage();
  await page.goto('https://afrimarket-web-staging-staging.up.railway.app/buyer/home',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!localStorage.getItem('afri_token'),{timeout:15000}).catch(e=>console.log('Rejection wait timeout'));
  const sessionState=await page.evaluate(()=>({token:!!localStorage.getItem('afri_token'),user:!!localStorage.getItem('afri_user')}));
  const result={test:'HTTP 401 clears rejected cached session',status:!sessionState.token&&!sessionState.user?'PASS':'FAIL',sessionState,url:page.url()};
  console.log(JSON.stringify(result,null,2));
  fs.writeFileSync(process.argv[2]||'release-evidence/offline-session.json',JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
