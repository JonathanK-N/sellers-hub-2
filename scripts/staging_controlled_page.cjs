// Author: Jonathan Kakesa. Read-only HTTPS audits; authenticated raw reports stay private.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
let stage='configuration';
(async()=>{
 const origin='https://afrimarket-web-staging-staging.up.railway.app',api='https://afrimarket-api-staging-staging.up.railway.app';
 const routes={accueil:'/',produits:'/buyer/home',panier:'/buyer/cart',commandes:'/buyer/orders',messagerie:'/messages',vendeur:'/seller/dashboard',administrateur:'/admin/overview'};
 const name=process.env.QA_PAGE,route=routes[name],expected=process.env.STAGING_QA_SOURCE_SHA,token=process.env.QA_TOKEN;
 if(!route||expected!=='6e83f69f95abc0f72d5fb24c70f171155ef3f53f'||(name!=='accueil'&&!token))throw Error('Missing exact provenance or authorized session');
 stage='API provenance';const health=await(await fetch(api+'/api/health')).json();if(health.source_sha!==expected||health.status!=='ok')throw Error('API provenance changed');
 stage='Web provenance';const html=await(await fetch(origin)).text();const entry=html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
 if(entry!=='/assets/index-DvLEhIRo.js')throw Error('Web entry changed');
 if(crypto.createHash('sha256').update(Buffer.from(await(await fetch(origin+entry)).arrayBuffer())).digest('hex')!=='d218f57dbd667f327567bbaada673125014d4b692e0ffa2ede46e8fa9a982b52')throw Error('Web artifact changed');
 stage='Lighthouse loading';const dependency=createRequire(fs.realpathSync(process.env.LIGHTHOUSE_PACKAGE));
 const lighthouse=(await import(pathToFileURL(dependency.resolve('lighthouse')).href)).default,launcher=await import(pathToFileURL(dependency.resolve('chrome-launcher')).href);
 stage='Browser driver loading';const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const report={sourceSha:expected,page:name,route,scope:'Actual HTTPS, three fresh cold browser processes, Lighthouse 13.5 default mobile simulated throttling; read-only; raw authenticated data not uploaded',rows:[]};
 fs.mkdirSync('controlled-https',{recursive:true});
 try{for(let iteration=1;iteration<=3;iteration++){
  let chrome,browser;try{
   chrome=await launcher.launch({chromeFlags:['--headless','--no-sandbox','--disable-gpu','--no-first-run'],logLevel:'silent'});browser=await chromium.connectOverCDP('http://127.0.0.1:'+chrome.port);const context=browser.contexts()[0];
   await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort('blockedbyclient'));
   if(token){const user=await(await fetch(api+'/api/auth/me',{headers:{Authorization:'Bearer '+token}})).json();if(!user.id||!user.role)throw Error('Authorized session expired');const page=await context.newPage();await page.goto(origin+'/robots.txt');await page.evaluate(({token,user})=>{localStorage.setItem('afri_token',token);localStorage.setItem('afri_user',JSON.stringify(user));},{token,user});await page.close();}
   const result=await lighthouse(origin+route,{port:chrome.port,logLevel:'silent',output:'json',disableStorageReset:true,onlyCategories:['performance','accessibility','best-practices','seo']});const lhr=result.lhr;
   const m={performance:100*lhr.categories.performance.score,accessibility:100*lhr.categories.accessibility.score,bestPractices:100*lhr.categories['best-practices'].score,seo:100*lhr.categories.seo.score,lcpMs:lhr.audits['largest-contentful-paint'].numericValue,tbtMs:lhr.audits['total-blocking-time'].numericValue,fcpMs:lhr.audits['first-contentful-paint'].numericValue,mainThreadMs:lhr.audits['mainthread-work-breakdown'].numericValue,cls:lhr.audits['cumulative-layout-shift'].numericValue};
   const actualPath=new URL(lhr.finalDisplayedUrl||lhr.finalUrl).pathname;const passed=!lhr.runtimeError&&actualPath===route&&m.performance>=90&&m.accessibility>=95&&m.bestPractices>=95&&(token?lhr.audits['is-crawlable'].score===0:m.seo>=95)&&m.lcpMs<=2500&&m.tbtMs<200&&m.cls<0.1;
   const safeUrl=url=>{try{const u=new URL(url);return u.origin===origin&&/^\/(assets|fonts|images)\//.test(u.pathname)?u.pathname:'[unattributed]';}catch{return '[unattributed]';}};
   report.rows.push({iteration,status:passed?'PASS':'FAIL',routeVerified:actualPath===route,metrics:m,benchmarkIndex:lhr.environment.benchmarkIndex,longTasks:(lhr.audits['long-tasks']?.details?.items||[]).map(t=>({path:safeUrl(t.url),durationMs:t.duration,startMs:t.startTime})),scripts:(lhr.audits['bootup-time']?.details?.items||[]).map(t=>({path:safeUrl(t.url),totalMs:t.total,scriptingMs:t.scripting,parseMs:t.scriptParseCompile})),lcpSubparts:(lhr.audits['lcp-breakdown-insight']?.details?.items||[]).filter(x=>x.type==='table').flatMap(x=>x.items.map(y=>({part:y.subpart,durationMs:y.duration}))) });
   console.log(JSON.stringify({page:name,iteration,status:passed?'PASS':'FAIL',metrics:m}));
  }catch{report.rows.push({iteration,status:'FAIL',reason:'Measurement or authentication unavailable; private details withheld'});}finally{if(browser)await browser.close().catch(()=>{});if(chrome)await chrome.kill().catch(()=>{});}
  fs.writeFileSync(path.join('controlled-https',name+'.json'),JSON.stringify(report,null,2));
 }}finally{if(report.rows.length!==3||report.rows.some(r=>r.status!=='PASS'))process.exitCode=1;}
})().catch(error=>{fs.mkdirSync('controlled-https',{recursive:true});const failure={page:process.env.QA_PAGE,status:'FAIL',stage,errorType:error.name,errorCode:error.code||null,knownReason:['API provenance changed','Web entry changed','Web artifact changed','Missing exact provenance or authorized session'].includes(error.message)?error.message:null,rows:[]};fs.writeFileSync(path.join('controlled-https',process.env.QA_PAGE+'-preflight.json'),JSON.stringify(failure,null,2));console.error(JSON.stringify(failure));process.exitCode=1;});
