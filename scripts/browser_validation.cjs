const fs=require('fs');
const {chromium}=require('C:/Users/Djibril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const rows=[];
 const context=await browser.newContext();
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto('https://afrimarket-web-staging-staging.up.railway.app',{waitUntil:'networkidle',timeout:30000});
  const header=page.getByTestId('guest-top-header');
  const color=await header.evaluate(el=>getComputedStyle(el).backgroundColor);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  rows.push({test:'viewport '+width,status:color==='rgb(8, 80, 65)'&&!overflow?'PASS':'FAIL',color,overflow});
  await page.screenshot({path:'release-evidence/staging-'+width+'.png',fullPage:true});
  await page.getByTestId('guest-login-btn').click();
  await page.getByTestId('auth-modal').waitFor();
  await page.keyboard.press('Escape');
  await page.getByTestId('auth-modal').waitFor({state:'hidden'});
  rows.push({test:'auth modal open/escape '+width,status:'PASS'});
 }
 rows.push({test:'browser JS errors',status:errors.length?'FAIL':'PASS',errors});
 fs.writeFileSync('release-evidence/browser-validation.json',JSON.stringify({rows},null,2));
 console.log(JSON.stringify(rows,null,2));await browser.close();
})().catch(e=>{console.error(e.message);process.exitCode=1;});
