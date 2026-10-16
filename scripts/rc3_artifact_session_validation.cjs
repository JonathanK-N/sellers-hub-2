// Author: Jonathan Kakesa (JonathanK-N). Owned browser, exact static artifact only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Djibril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const build=path.resolve(process.argv[2]),output=process.argv[3],expected=process.argv[4];
  const metadata=JSON.parse(fs.readFileSync(path.join(build,'release-metadata.json')));
  assert.equal(metadata.sourceSha,expected);
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const target=path.resolve(build,'.'+decodeURIComponent(pathname));
    if(!target.startsWith(build+path.sep)&&target!==build){res.writeHead(403);res.end();return;}
    const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(build,'index.html');
    const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.avif':'image/avif','.png':'image/png'};
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port,rows=[];
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try{
    const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
    await context.addInitScript(()=>{localStorage.setItem('afri_user',JSON.stringify({id:'TEST_STALE_IDENTITY',name:'TEST stale identity',role:'admin'}));localStorage.removeItem('afri_token');});
    const page=await context.newPage(),requests=[];
    page.on('request',r=>requests.push(new URL(r.url()).pathname));
    await page.goto(origin+'/admin/overview');
    await page.waitForURL('**/auth/login');
    rows.push({test:'Stored admin identity without token redirects to login',status:'PASS'});
    assert.ok(!requests.some(p=>p.startsWith('/api/admin/')||p.startsWith('/api/orders')||p.startsWith('/api/messages')));
    rows.push({test:'Preloading screen code triggers no private API request',status:'PASS'});
    assert.ok(!requests.some(p=>p.startsWith('/images/market-hero')));
    rows.push({test:'Private route does not request landing hero',status:'PASS'});
    await context.close();
    const guest=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
    const landing=await guest.newPage(),hero=[];
    landing.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/images/market-hero'))hero.push(r.url());});
    await landing.goto(origin);
    await landing.getByTestId('hero-explore-btn').waitFor();
    assert.ok(hero.length>0);
    rows.push({test:'Guest landing retains its high-priority hero',status:'PASS'});
    await guest.close();
    fs.writeFileSync(output,JSON.stringify({author:'Jonathan Kakesa (JonathanK-N)',sourceSha:expected,scope:'Exact CI artifact, local static host, no API mocked; not an HTTPS performance certificate',rows},null,2)+'\n');
    console.log(JSON.stringify(rows));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(()=>{console.error('Artifact session verification failed; protected details withheld');process.exitCode=1;});
