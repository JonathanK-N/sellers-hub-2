// Author: Jonathan Kakesa (JonathanK-N). Actual staging pages with protected test sessions.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createRequire}=require('node:module');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Djibril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const origin='https://afrimarket-web-staging-staging.up.railway.app';
  const fixtures=path.resolve(process.argv[2]),privateOutput=path.resolve(process.argv[3]),summaryOutput=path.resolve(process.argv[4]);
  const privateRoot=path.resolve(process.env.QA_PRIVATE_ROOT||'../Afrimarket-private-backups');
  const expectedSha=process.env.STAGING_QA_SOURCE_SHA||'779ec1244bb25077e639ffc4dbe64f17ce344024';
  if(!/^[a-f0-9]{40}$/.test(expectedSha))throw Error('Expected SHA required');
  if(!process.argv[4]||![fixtures,privateOutput].every(p=>p.startsWith(privateRoot+path.sep)))throw Error('Private staging paths required');
  fs.mkdirSync(privateOutput,{recursive:true});
  const dependency=createRequire(fs.realpathSync(process.env.LIGHTHOUSE_PACKAGE||path.join(privateRoot,'launch-lighthouse-13.5.0','node_modules','lighthouse','package.json')));
  const lighthouse=(await import(pathToFileURL(dependency.resolve('lighthouse')).href)).default;
  const launcher=await import(pathToFileURL(dependency.resolve('chrome-launcher')).href);
  const pages=[{name:'accueil',route:'/',role:null},{name:'produits',route:'/buyer/home',role:'buyer'},
    {name:'panier',route:'/buyer/cart',role:'buyer'},{name:'commandes',route:'/buyer/orders',role:'buyer'},
    {name:'messagerie',route:'/messages',role:'buyer'},{name:'vendeur',route:'/seller/dashboard',role:'seller'},
    {name:'administrateur',route:'/admin/overview',role:'admin'}];
  const rows=[];
  for(const target of pages){
    let chrome,browser;
    try{
      chrome=await launcher.launch({...(process.platform==='win32'?{chromePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{}),chromeFlags:['--headless','--disable-gpu','--no-first-run',...(process.platform==='win32'?[]:['--no-sandbox'])],logLevel:'silent'});
      browser=await chromium.connectOverCDP('http://127.0.0.1:'+chrome.port);
      const context=browser.contexts()[0];
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
      const result=await lighthouse(origin+target.route,{port:chrome.port,logLevel:'silent',output:'json',disableStorageReset:true,onlyCategories:['performance','accessibility','best-practices','seo']});
      const lhr=result.lhr;
      fs.writeFileSync(path.join(privateOutput,target.name+'.json'),JSON.stringify(lhr));
      const finalPath=new URL(lhr.finalDisplayedUrl||lhr.finalUrl).pathname;
      const metrics={performance:Math.round(lhr.categories.performance.score*100),accessibility:Math.round(lhr.categories.accessibility.score*100),bestPractices:Math.round(lhr.categories['best-practices'].score*100),seo:Math.round(lhr.categories.seo.score*100),lcpMs:lhr.audits['largest-contentful-paint'].numericValue,tbtMs:lhr.audits['total-blocking-time'].numericValue,cls:lhr.audits['cumulative-layout-shift'].numericValue};
      const pageVerified=finalPath===target.route&&!lhr.runtimeError;
      const passed=pageVerified&&metrics.performance>=90&&metrics.accessibility>=95&&metrics.bestPractices>=95&&(target.role?lhr.audits['is-crawlable'].score===0:metrics.seo>=95)&&metrics.lcpMs<=2500&&metrics.tbtMs<200&&metrics.cls<0.1;
      const privateSeoRequired=Boolean(target.role);
      const failures=Object.entries(lhr.audits).filter(([,a])=>a.score!==null&&a.score<1&&a.scoreDisplayMode!=='informative').map(([id,a])=>({id,title:a.title,score:a.score}));
      rows.push({page:target.name,route:target.route,finalPath,pageVerified,seoPolicy:privateSeoRequired?'private page must remain non-indexable':'public SEO >=95',status:passed?'PASS':'FAIL',metrics,failures});
      console.log(JSON.stringify({page:target.name,status:passed?'PASS':'FAIL',metrics}));
    }catch{rows.push({page:target.name,route:target.route,status:'FAIL',diagnostic:'Measurement unavailable; protected details withheld'});process.exitCode=1;}
    finally{if(browser)await browser.close().catch(()=>{});if(chrome){try{await chrome.kill();}catch{}}}
    fs.writeFileSync(summaryOutput,JSON.stringify({author:'Jonathan Kakesa (JonathanK-N)',sourceSha:expectedSha,scope:'Actual Railway staging HTTPS, Lighthouse 13.5 default mobile simulated throttling; fresh isolated browser per page, authentication initialized on robots.txt without warming application resources; raw authenticated reports private outside Git',rows},null,2));
  }
  if(rows.some(r=>r.status!=='PASS'))process.exitCode=1;
})().catch(()=>{console.error('Staging performance runner failed; details withheld');process.exitCode=1;});
