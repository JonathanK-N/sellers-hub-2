// Author: Jonathan Kakesa. Local browser regression with synthetic sessions only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const dependencies=createRequire(path.resolve(__dirname,'../frontend/package.json'));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {createServer}=await import(require('node:url').pathToFileURL(dependencies.resolve('vite')).href);
 const server=await createServer({root:path.resolve(__dirname,'../frontend'),server:{host:'127.0.0.1',port:4179,strictPort:true}});await server.listen();
 const browser=await chromium.launch({headless:true,channel:process.env.QA_BROWSER_CHANNEL||undefined});const results=[];
 try{for(const scenario of [{name:'server corrects cached admin role',status:200,role:'buyer'},{name:'verified admin allowed',status:200,role:'admin'},{name:'503 fails closed and preserves token',status:503},{name:'network failure fails closed',status:0},{name:'401 clears token',status:401},{name:'403 clears token',status:403}]){
  console.log(JSON.stringify({scenario:scenario.name}));
  let available=scenario.status===200;
  const context=await browser.newContext({serviceWorkers:'block'});let adminRequests=0;
  await context.addInitScript(()=>{localStorage.setItem('afri_token','synthetic-session');localStorage.setItem('afri_user',JSON.stringify({id:'fixture',role:'admin'}));});
  await context.route('**/api/**',async r=>{const p=new URL(r.request().url()).pathname;if(r.request().method()==='OPTIONS')return r.fulfill({status:204});if(p==='/api/auth/me'){if(!available&&!scenario.status)return r.abort();return r.fulfill({status:available?200:scenario.status,json:available?{id:'fixture',role:scenario.role||'buyer',name:'Fixture'}:{detail:'Synthetic failure'}});}if(p==='/api/admin/overview')adminRequests++;return r.fulfill({status:200,json:p.includes('overview')?{users:0,sellers:0,orders:0,revenue:0}:[]});});
  const page=await context.newPage();await page.goto('http://127.0.0.1:4179/admin/overview');
  if(!scenario.role&&![401,403].includes(scenario.status))await page.getByTestId('session-unavailable').waitFor();else if(scenario.role==='admin')await page.waitForFunction(()=>document.body.innerText.includes("Vue d'ensemble"),{timeout:30000});else await page.waitForFunction(()=>location.pathname!=='/admin/overview',{timeout:30000});await page.waitForTimeout(500);
  const state=await page.evaluate(()=>({path:location.pathname,token:!!localStorage.getItem('afri_token'),cached:localStorage.getItem('afri_user')}));
  if(scenario.role==='admin'){assert.equal(state.path,'/admin/overview');assert(adminRequests>0);}else{if(scenario.role||[401,403].includes(scenario.status))assert.notEqual(state.path,'/admin/overview');assert.equal(adminRequests,0);assert.equal(await page.getByRole('heading',{name:"Vue d'ensemble",exact:true}).count(),0);}
  if(scenario.status!==200){assert.equal(state.path,[401,403].includes(scenario.status)?'/auth/login':'/admin/overview');assert.equal(state.cached,null);assert.equal(state.token,![401,403].includes(scenario.status));}
  if(!scenario.role&&![401,403].includes(scenario.status)){available=true;await page.getByTestId('session-retry').click();await page.waitForFunction(()=>location.pathname!=='/admin/overview',{timeout:30000});assert.equal(adminRequests,0);assert.equal(await page.getByTestId('session-unavailable').count(),0);}
  results.push({scenario:scenario.name,status:'PASS',adminRequests,route:state.path});await context.close();
 }}finally{await browser.close();await server.close();}
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({scope:'Local browser, mocked API, synthetic sessions; no provider calls',results},null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
