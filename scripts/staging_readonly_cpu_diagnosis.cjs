// Author: Jonathan Kakesa. Read-only diagnostic; no performance certification.
const fs=require('node:fs'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
(async()=>{
 const web='https://afrimarket-web-staging-staging.up.railway.app',api='https://afrimarket-api-staging-staging.up.railway.app';
 const sha='c38a75d81470c62fbb878f979752ff0a85af2649',token=process.env.QA_TOKEN;
 if(!token)throw Error('Authorized temporary fixture session required');
 const health=await(await fetch(api+'/api/health')).json();if(health.source_sha!==sha||health.status!=='ok')throw Error('API provenance changed');
 const html=await(await fetch(web)).text();if(!html.includes('/assets/index-DtniLwOj.js'))throw Error('Web provenance changed');
 const hash=crypto.createHash('sha256').update(Buffer.from(await(await fetch(web+'/assets/index-DtniLwOj.js')).arrayBuffer())).digest('hex');if(hash!=='7933184a0af85631036863b956823b85c2a96fefd6058636a25a23a724734096')throw Error('Web artifact changed');
 const me=await fetch(api+'/api/auth/me',{headers:{Authorization:'Bearer '+token}});if(me.status!==200)throw Error('Fixture session unavailable');const user=await me.json();if(user.role!=='buyer')throw Error('Buyer fixture required');
 const rows=[];for(let iteration=1;iteration<=2;iteration++){
  const browser=await chromium.launch({headless:true});try{const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
   const setup=await context.newPage();await setup.goto(web+'/robots.txt');await setup.evaluate(({token,user})=>{localStorage.setItem('afri_token',token);localStorage.setItem('afri_user',JSON.stringify(user));},{token,user});await setup.close();
   await context.addInitScript(()=>{window.__qaLcp=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.__qaLcp.push({startMs:e.startTime,tag:e.element?.tagName,testid:e.element?.getAttribute('data-testid')||null,classes:typeof e.element?.className==='string'?e.element.className:null});}).observe({type:'largest-contentful-paint',buffered:true});});
   const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
   await page.goto(web+'/buyer/home',{waitUntil:'networkidle'});await page.getByTestId('home-search-btn').waitFor();await page.waitForTimeout(1000);
   const {profile}=await cdp.send('Profiler.stop');const nodes=new Map(profile.nodes.map(n=>[n.id,n])),totals=new Map();for(let i=0;i<(profile.samples||[]).length;i++){const id=profile.samples[i];totals.set(id,(totals.get(id)||0)+(profile.timeDeltas?.[i]||0)/1000);}
   const safeFrame=n=>{const f=n.callFrame;let p='[browser]';try{const u=new URL(f.url);if(u.origin===web&&u.pathname.startsWith('/assets/'))p=u.pathname;}catch{}return{function:f.functionName||'[anonymous]',path:p,line:f.lineNumber+1,column:f.columnNumber+1};};
   const top=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,40).map(([id,selfMs])=>({...safeFrame(nodes.get(id)),selfMs}));
   const timing=await page.evaluate(()=>({lcp:window.__qaLcp,network:performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/')||e.name.includes('/assets/index-')).map(e=>{const p=new URL(e.name).pathname;return{path:p.startsWith('/assets/')?p:['/api/auth/me','/api/products','/api/cart','/api/admin/config/promo-banner/public','/api/admin/banners/public'].includes(p)?p:'[other-api]',startMs:e.startTime,endMs:e.responseEnd,durationMs:e.duration};})}));
   rows.push({iteration,route:new URL(page.url()).pathname,...timing,cpuTop:top});
  }finally{await browser.close();}
 }
 fs.mkdirSync('diagnosis',{recursive:true});fs.writeFileSync('diagnosis/c38-network-and-cpu.json',JSON.stringify({sourceSha:sha,scope:'Actual staging read-only; two fresh browsers, unthrottled diagnostic with CPU profiler; no Lighthouse certification and no changed thresholds; no private response bodies, headers or tokens retained',rows},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
