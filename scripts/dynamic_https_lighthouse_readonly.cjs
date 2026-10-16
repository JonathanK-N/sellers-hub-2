// Author: Jonathan Kakesa (JonathanK-N). Actual staging pages with protected test sessions.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createRequire}=require('node:module');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Djibril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const origin='https://afrimarket-web-staging-staging.up.railway.app';
  const fixtures=path.resolve(process.argv[2]),privateOutput=path.resolve(process.argv[3]),summaryOutput=path.resolve(process.argv[4]);
  const privateRoot=path.resolve(process.env.QA_PRIVATE_ROOT||'../Afrimarket-private-backups');
  const expectedSha=process.env.STAGING_QA_SOURCE_SHA;
  if(!/^[a-f0-9]{40}$/.test(expectedSha))throw Error('Expected SHA required');
  const health=await(await fetch('https://afrimarket-api-staging-staging.up.railway.app/api/health',{signal:AbortSignal.timeout(20000)})).json();
  if(health.status!=='ok'||health.source_sha!==expectedSha)throw Error('Live staging source does not match expected SHA');
  if(!process.argv[4]||![fixtures,privateOutput].every(p=>p.startsWith(privateRoot+path.sep)))throw Error('Private staging paths required');
  console.log('Preflight health passed');
  fs.mkdirSync(privateOutput,{recursive:true});
  const dependency=createRequire(fs.realpathSync(process.env.LIGHTHOUSE_PACKAGE||path.join(privateRoot,'launch-lighthouse-13.5.0','node_modules','lighthouse','package.json')));
  console.log('Loading Lighthouse');
  const lighthouse=(await import(pathToFileURL(dependency.resolve('lighthouse')).href)).default;
  console.log('Loading launcher');
  const launcher=await import(pathToFileURL(dependency.resolve('chrome-launcher')).href);
  console.log('Loading CPU model');
  const {CpuProfileModel}=await import(pathToFileURL(path.join(path.dirname(dependency.resolve('lighthouse')),'lib','tracehouse','cpu-profile-model.js')).href);
  const pages=[{name:'accueil',route:'/',role:null},{name:'produits',route:'/buyer/home',role:'buyer'},
    {name:'panier',route:'/buyer/cart',role:'buyer'},{name:'commandes',route:'/buyer/orders',role:'buyer'},
    {name:'messagerie',route:'/messages',role:'buyer'},{name:'vendeur',route:'/seller/dashboard',role:'seller'},
    {name:'administrateur',route:'/admin/overview',role:'admin'}];
  const pageFilter=process.env.STAGING_QA_PAGE_FILTER||'';
  if(pageFilter&&pageFilter!=='accueil')throw Error('Unsupported diagnostic filter');
  const sourceHtml=await(await fetch(origin)).text();
  const mainPath=sourceHtml.match(/src="(\/assets\/index-[^"]+\.js)"/)[1];
  if(mainPath!=="/assets/index-DAc0oo52.js")throw Error('Unexpected Web bundle');
  const bundleHash=require('node:crypto').createHash('sha256').update(Buffer.from(await(await fetch(origin+mainPath)).arrayBuffer())).digest('hex');
  if(bundleHash!=="f45aaa1d7ca8981ae27fa2d6e50ba500262e1c1ab833f4fe5d867eb7e38368e5")throw Error('Web bundle changed');
  const rows=[];
  const blocked=[];
  for(const target of pages){ console.log('Audit start '+target.name);
    if(pageFilter&&target.name!==pageFilter)continue;
    let chrome,browser;
    try{
      chrome=await launcher.launch({...(process.platform==='win32'?{chromePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{}),chromeFlags:['--headless','--disable-gpu','--no-first-run',...(process.platform==='win32'?[]:['--no-sandbox'])],logLevel:'silent'});
      console.log('Chrome launched');
      browser=await chromium.connectOverCDP('http://127.0.0.1:'+chrome.port);
      const context=browser.contexts()[0];
      await context.route('**/*',async route=>{const req=route.request();if(!['GET','HEAD','OPTIONS'].includes(req.method())){blocked.push({method:req.method(),path:new URL(req.url()).pathname});return route.abort('blockedbyclient');}return route.continue();});
      if(target.role){
        const state=JSON.parse(fs.readFileSync(path.join(fixtures,target.role+'-storage.json')));
        const stored=state.origins.find(o=>o.origin===origin);
        if(!stored)throw Error('Authorized test session unavailable');
        const page=await context.newPage();
        // Establish the origin without loading or warming the application bundle.
        await page.goto(origin+'/robots.txt',{waitUntil:'domcontentloaded'});
        await page.evaluate(entries=>{for(const item of entries)localStorage.setItem(item.name,item.value);},stored.localStorage);
        await page.close();
      }
      console.log('Lighthouse measuring '+target.name);
      const result=await lighthouse(origin+target.route,{port:chrome.port,logLevel:'silent',output:'json',disableStorageReset:true,onlyCategories:['performance','accessibility','best-practices','seo'],...(pageFilter?{additionalTraceCategories:['disabled-by-default-v8.cpu_profiler']}:{})});
      const lhr=result.lhr;
      fs.writeFileSync(path.join(privateOutput,target.name+'.json'),JSON.stringify(lhr));
      const finalPath=new URL(lhr.finalDisplayedUrl||lhr.finalUrl).pathname;
      const metrics={performance:Math.round(lhr.categories.performance.score*100),accessibility:Math.round(lhr.categories.accessibility.score*100),bestPractices:Math.round(lhr.categories['best-practices'].score*100),seo:Math.round(lhr.categories.seo.score*100),lcpMs:lhr.audits['largest-contentful-paint'].numericValue,tbtMs:lhr.audits['total-blocking-time'].numericValue,cls:lhr.audits['cumulative-layout-shift'].numericValue};
      const pageVerified=finalPath===target.route&&!lhr.runtimeError;
      const passed=pageVerified&&metrics.performance>=90&&metrics.accessibility>=95&&metrics.bestPractices>=95&&(target.role?lhr.audits['is-crawlable'].score===0:metrics.seo>=95)&&metrics.lcpMs<=2500&&metrics.tbtMs<200&&metrics.cls<0.1;
      const privateSeoRequired=Boolean(target.role);
      const failures=Object.entries(lhr.audits).filter(([,a])=>a.score!==null&&a.score<1&&a.scoreDisplayMode!=='informative').map(([id,a])=>({id,title:a.title,score:a.score}));
      const safeResource=item=>{
        try { const url=new URL(item.url); if(url.origin!==origin||!/^\/(assets|fonts|images)\//.test(url.pathname))return null;
          return {path:url.pathname,type:item.resourceType,transferBytes:item.transferSize,startMs:item.networkRequestTime,endMs:item.networkEndTime};
        } catch {return null;}
      };
      const diagnostics={
        benchmarkIndex:lhr.environment?.benchmarkIndex,
        mainThread:(lhr.audits['mainthread-work-breakdown']?.details?.items||[]).map(x=>({group:x.group,durationMs:x.duration})),
        lcpSubparts:(lhr.audits['lcp-breakdown-insight']?.details?.items||[]).filter(x=>x.type==='table').flatMap(x=>x.items.map(y=>({part:y.subpart,durationMs:y.duration}))),
        lcpElementTag:(lhr.audits['lcp-breakdown-insight']?.details?.items||[]).find(x=>x.type==='node')?.snippet?.match(/^<([a-z0-9]+)/i)?.[1]||null,
        staticResources:(lhr.audits['network-requests']?.details?.items||[]).map(safeResource).filter(Boolean),
      };
      const cpuFrames=[];
      for(const profile of CpuProfileModel.collectProfileEvents(result.artifacts?.Trace?.traceEvents||[])){
        const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map(),self=new Map(),inclusive=new Map();
        for(const node of profile.nodes){if(typeof node.parent==='number')parent.set(node.id,node.parent);for(const child of node.children||[])parent.set(child,node.id);}
        for(let i=0;i<profile.samples.length;i++){
          const id=profile.samples[i],duration=profile.timeDeltas[i]||0;
          self.set(id,(self.get(id)||0)+duration);
          const visited=new Set();let current=id;
          while(current&&!visited.has(current)){visited.add(current);inclusive.set(current,(inclusive.get(current)||0)+duration);current=parent.get(current);}
        }
        for(const [id,node] of nodes){
          const frame=node.callFrame;
          if(!frame?.url?.startsWith(origin+'/assets/'))continue;
          cpuFrames.push({function:frame.functionName,path:new URL(frame.url).pathname,line:frame.lineNumber,column:frame.columnNumber,selfMs:(self.get(id)||0)/1000,inclusiveMs:(inclusive.get(id)||0)/1000});
        }
      }
      diagnostics.cpuFrames=cpuFrames.sort((a,b)=>b.inclusiveMs-a.inclusiveMs).slice(0,20);
      rows.push({page:target.name,route:target.route,finalPath,pageVerified,seoPolicy:privateSeoRequired?'private page must remain non-indexable':'public SEO >=95',status:passed?'PASS':'FAIL',metrics,failures,diagnostics});
      console.log(JSON.stringify({page:target.name,status:passed?'PASS':'FAIL',metrics}));
    }catch{rows.push({page:target.name,route:target.route,status:'FAIL',diagnostic:'Measurement unavailable; protected details withheld'});process.exitCode=1;}
    finally{if(browser)await browser.close().catch(()=>{});if(chrome){try{await chrome.kill();}catch{}}}
    fs.writeFileSync(summaryOutput,JSON.stringify({author:'Jonathan Kakesa (JonathanK-N)',sourceSha:expectedSha,webSourceSha:'584f0c463ee53e65be790526cb38819eb8d6dd83',blockedMutations:blocked,partialDiagnostic:Boolean(pageFilter),scope:'Actual Railway staging HTTPS, Lighthouse 13.5 default mobile simulated throttling; fresh isolated browser per page, authentication initialized on robots.txt without warming application resources; raw authenticated reports private outside Git',rows},null,2));
  }
  if(rows.some(r=>r.status!=='PASS'))process.exitCode=1;
})().catch(()=>{console.error('Staging performance runner failed; details withheld');process.exitCode=1;});
