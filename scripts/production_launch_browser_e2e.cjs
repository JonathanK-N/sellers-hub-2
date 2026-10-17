// Author: Jonathan Kakesa (JonathanK-N). Synthetic loopback business verification.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Djibril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const build = path.resolve(process.argv[2]);
  const python = path.resolve(process.argv[3]);
  const privateDir = path.resolve(process.argv[4]);
  const output = path.resolve(process.argv[5]);
  if (!process.argv[5] || !fs.existsSync(path.join(build, 'release-metadata.json'))) throw Error('Exact Web artifact and explicit output paths required');
  const metadata = JSON.parse(fs.readFileSync(path.join(build, 'release-metadata.json')));
  const database = 'afrimarket_test_launch_browser_' + crypto.randomBytes(10).toString('hex');
  const password = crypto.randomBytes(20).toString('hex');
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const rows = [];
  const contexts = [];
  const browserErrors = [];
  fs.mkdirSync(privateDir, {recursive:true});
  fs.writeFileSync(path.join(privateDir, 'fixture-state.json'), JSON.stringify({database}));
  fs.mkdirSync(path.dirname(output), {recursive:true});
  const bootstrap = path.join(privateDir, 'launch_qa_api.py');
  fs.writeFileSync(bootstrap, 'import scheduler\nscheduler.start_scheduler = lambda: None\nfrom server import app\n');
  const freePort = async () => {
    const probe = http.createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    return port;
  };
  const apiPort = await freePort();
  const apiOrigin = 'http://127.0.0.1:' + apiPort;
  const log = fs.openSync(path.join(privateDir, 'synthetic-api.log'), 'w');
  const apiProcess = cp.spawn(python, ['-m','uvicorn','launch_qa_api:app','--app-dir',privateDir,'--host','127.0.0.1','--port',String(apiPort)], {
    cwd:process.cwd(), windowsHide:true, stdio:['ignore',log,log], env:{...process.env,
      PYTHONPATH:path.resolve('backend'), MONGO_URL:'mongodb://127.0.0.1:27018/?replicaSet=phase3-test', DB_NAME:database,
      AUTH_MODE:'sandbox', SEED_DEMO:'false', COMMERCE_CHECKOUT_MODE:'direct', CINETPAY_ENABLED:'false', LEGACY_FINANCIAL_ACTIONS_ENABLED:'false',
      JWT_SECRET:jwtSecret, ADMIN_PHONE:'+243000000099', ADMIN_PASSWORD:password, ADMIN_NAME:'TEST administrator',
      AT_USERNAME:'',AT_API_KEY:'',AWS_ACCESS_KEY_ID:'',AWS_SECRET_ACCESS_KEY:'',FOREXRATEAPI_KEY:'',RESEND_API_KEY:'',
      CINETPAY_API_KEY:'',CINETPAY_SITE_ID:'',CINETPAY_SIGNATURE_SECRET:'',REDIS_URL:'memory://',CORS_ORIGINS:'*'}
  });
  let browser;
  let staticServer;
  const check = (name, condition, detail) => { assert.ok(condition, name); rows.push({test:name,status:'PASS',...(detail?{detail}: {})}); console.log(JSON.stringify({passed:name})); };
  const api = async (method, endpoint, body, token) => {
    const response = await fetch(apiOrigin+'/api'+endpoint,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(method==='POST'&&endpoint==='/orders'?{'Idempotency-Key':crypto.randomUUID()}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data = await response.json();
    if (!response.ok) throw Error(method+' '+endpoint+' HTTP '+response.status+(Array.isArray(data.detail)?' '+JSON.stringify(data.detail.map(row=>({type:row.type,loc:row.loc}))):''));
    return data;
  };
  const fixturePython = (code, settings) => {
    const result=cp.spawnSync(python,['-c',code],{input:JSON.stringify(settings),encoding:'utf8',timeout:30000});
    if(result.status!==0)throw Error('Synthetic database fixture/check failed');
    return result.stdout.trim()?JSON.parse(result.stdout):null;
  };
  try {
    const deadline=Date.now()+60000;
    while(true){
      try { const response=await fetch(apiOrigin+'/api/health'); if(response.ok)break; } catch {}
      if(Date.now()>deadline||apiProcess.exitCode!==null)throw Error('Synthetic API did not start');
      await new Promise(resolve=>setTimeout(resolve,300));
    }
    const identities={};
    for(const [index,role] of ['buyer','seller','deliverer'].entries()){
      const phone='+24389900001'+index;
      const registered=await api('POST','/auth/register',{name:'TEST '+role,phone,role,country_code:'CD',password});
      await api('POST','/auth/verify-otp',{phone,code:registered.otp_dev});
      identities[role]=await api('POST','/auth/login',{phone,password});
    }
    check('Synthetic buyer, seller and courier registered, OTP-verified and authenticated via real HTTP',true);
    identities.admin=await api('POST','/auth/admin/login',{phone:'+243000000099',password});
    const seller=await api('POST','/seller/setup',{shop_name:'TEST browser shop',address:'TEST collection point'},identities.seller.access_token);
    const beforeApproval=await api('GET','/deliverers/available',undefined,identities.seller.access_token);
    check('Unapproved courier cannot be assigned',!beforeApproval.some(row=>row.id===identities.deliverer.user.id));
    fixturePython("import sys,json\nfrom pymongo import MongoClient\ns=json.load(sys.stdin); assert s['database'].startswith('afrimarket_test_launch_browser_'); c=MongoClient('mongodb://127.0.0.1:27018/?replicaSet=phase3-test'); d=c[s['database']]; d.deliverers.update_one({'user_id':s['courier']},{'$set':{'id':'TEST-approved-'+s['courier'],'is_active':True,'affiliation':'shop','seller_id':s['shop'],'country_code':'CD','vehicle':'moto'}},upsert=True); c.close()",{database,courier:identities.deliverer.user.id,shop:seller.id});
    const approvedCouriers=await api('GET','/deliverers/available',undefined,identities.seller.access_token);
    check('Synthetic approved shop courier is available to the owning shop',approvedCouriers.some(row=>row.id===identities.deliverer.user.id));
    await api('PUT','/seller/whatsapp',{phone:identities.seller.user.phone,visible:true},identities.seller.access_token);
    const product=await api('POST','/products',{name:'TEST browser product',price:1200,currency:'FC',stock:8,photos:[],delivery_modes:['collect','delivery']},identities.seller.access_token);
    staticServer=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const target=path.resolve(build,'.'+pathname);
      if(target!==build&&!target.startsWith(build+path.sep)){res.writeHead(403);return res.end();}
      const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(build,'index.html');
      const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif'};
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
    });
    await new Promise(resolve=>staticServer.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+staticServer.address().port;
    browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
    const actor=async role=>{
      const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
      context.setDefaultTimeout(20000);
      context.setDefaultNavigationTimeout(30000);
      contexts.push(context);
      const network={down:false,loseMessageResponse:false};
      // route.fetch buffers the body; an SSE response intentionally never ends.
      // Send this transport directly to the isolated API so it remains streaming.
      await context.addInitScript(({apiOrigin})=>{
        const nativeFetch=window.fetch.bind(window);
        window.fetch=(input,init)=>{
          const url=new URL(typeof input==='string'?input:input.url,location.href);
          return nativeFetch(url.pathname==='/api/notifications/stream'?apiOrigin+url.pathname:input,init);
        };
      },{apiOrigin});
      await context.route('**/*',async route=>{
        const request=route.request();const url=new URL(request.url());
        if(url.origin===apiOrigin&&url.pathname==='/api/notifications/stream'){
          return network.down?route.abort('internetdisconnected'):route.continue();
        }
        if(url.origin===new URL(metadata.api).origin){
          if(network.down)return route.abort('internetdisconnected');
          let response;
          try { response=await route.fetch({url:apiOrigin+url.pathname+url.search}); }
          catch { return route.abort('connectionfailed').catch(()=>{}); }
          if(network.loseMessageResponse&&request.method()==='POST'&&url.pathname==='/api/messages'){
            network.loseMessageResponse=false;network.down=true;return route.abort('internetdisconnected');
          }
          return route.fulfill({response}).catch(()=>{});
        }
        if(url.origin===origin)return route.continue();
        return route.abort('blockedbyclient');
      });
      const page=await context.newPage();
      page.on('pageerror',error=>browserErrors.push(error.message));
      await page.goto(origin+(role==='admin'?'/admin/login':'/auth/login'));
      await page.getByTestId(role==='admin'?'admin-phone-input':'login-phone-input').fill(role==='admin'?identities[role].user.phone:identities[role].user.phone.slice(4));
      await page.getByTestId(role==='admin'?'admin-password-input':'login-password-input').fill(password);
      await page.getByTestId(role==='admin'?'admin-login-submit':'login-submit-btn').click();
      await page.waitForURL(role==='admin'?'**/admin/overview':role==='seller'?'**/seller/dashboard':role==='deliverer'?'**/livreur':'**/buyer/home');
      return {context,page,network};
    };
    const buyer=await actor('buyer');
    const merchant=await actor('seller');
    check('Buyer and seller login through actual browser forms',true);
    await buyer.page.goto(origin+'/buyer/product/'+product.id);
    const productWhatsApp=await buyer.page.getByTestId('whatsapp-seller-btn').getAttribute('href');
    check('Product WhatsApp link uses verified opted-in business phone',new URL(productWhatsApp).hostname==='wa.me'&&new URL(productWhatsApp).pathname.slice(1)===identities.seller.user.phone.slice(1));
    await buyer.page.getByTestId('add-to-cart-btn').click();
    await buyer.page.goto(origin+'/buyer/cart');
    await buyer.page.getByTestId('cart-checkout-btn').click();
    await buyer.page.getByTestId('mode-collect').click();
    await buyer.page.getByTestId('checkout-pay-btn').click();
    await buyer.page.waitForURL('**/buyer/orders/*');
    const orderId=new URL(buyer.page.url()).pathname.split('/').pop();
    let order=await api('GET','/orders/'+orderId,undefined,identities.buyer.access_token);
    check('Browser product/cart/checkout creates persisted direct order with native amount',order.payment_method==='direct'&&order.amount_due===1200&&order.escrow_status==='not_applicable'&&!order.payment_confirmed);
    const orderWhatsApp=new URL(await buyer.page.getByTestId('whatsapp-seller-btn').getAttribute('href'));
    const waText=orderWhatsApp.searchParams.get('text');
    check('Order WhatsApp message has public reference and no buyer phone or handoff secret',waText.includes(order.public_reference)&&!waText.includes(identities.buyer.user.phone)&&!waText.includes(order.confirmation_code));
    await buyer.page.getByTestId('direct-buyer-declare').click();
    await buyer.page.getByTestId('direct-buyer-declare').waitFor({state:'hidden'});
    await merchant.page.goto(origin+'/buyer/orders/'+orderId);
    await merchant.page.getByTestId('direct-seller-receive').waitFor();
    check('Seller receipt requires explicit checkbox',await merchant.page.getByTestId('direct-seller-receive').isDisabled());
    check('Seller cannot prepare before declaring receipt',await merchant.page.getByTestId('advance-order-btn').isDisabled());
    await merchant.page.getByRole('checkbox').check();
    await merchant.page.getByTestId('direct-seller-receive').click();
    await merchant.page.getByTestId('direct-seller-receive').waitFor({state:'hidden'});
    await merchant.page.getByTestId('advance-order-btn').click();
    await merchant.page.getByTestId('advance-order-btn').getByText('Prêt pour retrait',{exact:true}).waitFor();
    await merchant.page.getByTestId('advance-order-btn').click();
    await merchant.page.getByTestId('advance-order-btn').waitFor({state:'hidden'});
    await merchant.page.getByTestId('confirm-collect-btn').click();
    await merchant.page.getByTestId('collect-confirmed-banner').waitFor();
    order=await api('GET','/orders/'+orderId,undefined,identities.buyer.access_token);
    check('Seller browser preparation and handoff persist without verified funds',order.status==='collected'&&order.payment_status==='seller_declared_received'&&!order.payment_confirmed&&order.escrow_status==='not_applicable');
    await buyer.page.reload();
    await buyer.page.getByTestId('chat-with-seller-btn').click();
    await buyer.page.getByTestId('chat-input').waitFor();
    const conversation=identities.buyer.user.id+'__'+seller.id;
    const xss='<img src=x onerror=window.afriE2EInjected=1>';
    await buyer.page.getByTestId('chat-input').fill(xss);
    await buyer.page.getByTestId('chat-send-btn').click();
    await buyer.page.getByTestId('chat-messages').getByText(xss,{exact:false}).waitFor();
    check('Message XSS renders as text without executing',await buyer.page.evaluate(()=>window.afriE2EInjected===undefined)&&await buyer.page.getByTestId('chat-messages').locator('img').count()===0);
    buyer.network.loseMessageResponse=true;
    await buyer.page.getByTestId('chat-input').fill('TEST uncertain response');
    await buyer.page.getByTestId('chat-send-btn').click();
    await buyer.page.getByRole('alert').waitFor();
    await buyer.page.reload();
    await buyer.page.getByTestId('session-unavailable').waitFor();
    check('Offline reload gates the private conversation and preserves its pending draft',await buyer.page.getByTestId('chat-input').count()===0&&await buyer.page.evaluate(()=>!!localStorage.getItem('afri_token')&&Object.keys(sessionStorage).some(key=>key.startsWith('afri_chat_pending:')&&JSON.parse(sessionStorage.getItem(key))?.text==='TEST uncertain response')));
    buyer.network.down=false;
    await buyer.page.getByTestId('session-retry').click();
    await buyer.page.getByTestId('chat-input').waitFor();
    await buyer.page.getByTestId('chat-messages').getByText('TEST uncertain response',{exact:false}).waitFor();
    await buyer.page.waitForFunction(()=>document.querySelector('[data-testid="chat-input"]')?.value==='');
    check('Recovered history acknowledges the already accepted message without a duplicate send',true);
    buyer.network.down=true;
    await buyer.page.getByTestId('chat-input').fill('TEST offline before acceptance');
    await buyer.page.getByTestId('chat-send-btn').click();
    await buyer.page.getByRole('alert').waitFor();
    await buyer.page.reload();
    await buyer.page.getByTestId('session-unavailable').waitFor();
    buyer.network.down=false;
    await buyer.page.getByTestId('session-retry').click();
    await buyer.page.getByTestId('chat-input').waitFor();
    check('Unaccepted message draft survives verification and remains available for explicit retry',await buyer.page.getByTestId('chat-input').inputValue()==='TEST offline before acceptance');
    await buyer.page.getByTestId('chat-send-btn').click();
    await buyer.page.getByTestId('chat-messages').getByText('TEST offline before acceptance',{exact:false}).waitFor();
    await merchant.page.goto(origin+'/messages/'+conversation);
    await merchant.page.getByTestId('chat-messages').getByText('TEST uncertain response',{exact:false}).waitFor();
    check('Seller sees persisted buyer messages after reconnect',true);
    const proof=fixturePython("import sys,json\nfrom pymongo import MongoClient\ns=json.load(sys.stdin); assert s['database'].startswith('afrimarket_test_launch_browser_'); c=MongoClient('mongodb://127.0.0.1:27018/?replicaSet=phase3-test'); d=c[s['database']]; print(json.dumps({'uncertain_messages':d.messages.count_documents({'text':'TEST uncertain response'}),'offline_messages':d.messages.count_documents({'text':'TEST offline before acceptance'}),'messages':d.messages.count_documents({}),'financial_records':sum(d[n].count_documents({}) for n in ['transactions','financial_ledger','withdrawals','deliverer_wallets','deliverer_wallet_transactions']),'stock':d.products.find_one({'id':s['product']})['stock']})); c.close()",{database,product:product.id});
    check('Response-loss reconciliation and offline retry each persist exactly one message',proof.uncertain_messages===1&&proof.offline_messages===1);
    check('Completed direct browser checkout creates no ledger/wallet/transaction and reserves stock once',proof.financial_records===0&&proof.stock===7,proof);
    for(const width of [390,768,1440]){
      await buyer.page.setViewportSize({width,height:900});
      check('Chat layout has no horizontal overflow at '+width,await buyer.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    fixturePython("import sys,json\nfrom datetime import datetime,timezone,timedelta\nfrom pymongo import MongoClient\ns=json.load(sys.stdin); assert s['database'].startswith('afrimarket_test_launch_browser_'); c=MongoClient('mongodb://127.0.0.1:27018/?replicaSet=phase3-test'); d=c[s['database']]; start=datetime(2000,1,1,tzinfo=timezone.utc); d.messages.insert_many([{'_id':'TEST-history-'+str(i),'id':'TEST-history-'+str(i),'conversation_id':s['conversation'],'buyer_id':s['buyer'],'seller_id':s['seller'],'from_user_id':s['buyer'],'to_user_id':s['seller_user'],'text':'TEST history '+str(i),'created_at':(start+timedelta(seconds=i)).isoformat(),'read':True} for i in range(125)]); c.close()",{database,conversation,buyer:identities.buyer.user.id,seller:seller.id,seller_user:identities.seller.user.id});
    await buyer.page.reload();
    await buyer.page.getByRole('button',{name:'Messages précédents',exact:true}).waitFor();
    await buyer.page.getByRole('button',{name:'Messages précédents',exact:true}).click();
    await buyer.page.waitForFunction(()=>document.querySelectorAll('[data-testid="chat-messages"] time').length===100);
    await buyer.page.getByRole('button',{name:'Messages précédents',exact:true}).click();
    const expectedHistoryRows=125+proof.messages;
    await buyer.page.waitForFunction(expected=>document.querySelectorAll('[data-testid="chat-messages"] time').length===expected,expectedHistoryRows);
    check('125 historical fixtures paginate without loss or duplicate alongside every real sent fixture message',await buyer.page.getByTestId('chat-messages').locator('time').count()===expectedHistoryRows);
    await buyer.page.getByTestId('chat-messages').evaluate(element=>{element.scrollTop=0;});
    const readingPosition=await buyer.page.getByTestId('chat-messages').evaluate(element=>element.scrollTop);
    await merchant.page.getByTestId('chat-input').fill('TEST tail while reading');
    await merchant.page.getByTestId('chat-send-btn').click();
    await merchant.page.waitForFunction(()=>document.querySelector('[data-testid="chat-input"]')?.value==='');
    await buyer.page.bringToFront();
    await buyer.page.getByTestId('chat-messages').getByText('TEST tail while reading',{exact:false}).waitFor();
    check('Polling a new message preserves position while reading older history',Math.abs(await buyer.page.getByTestId('chat-messages').evaluate(element=>element.scrollTop)-readingPosition)<=3);

    const deliveryCreated=await api('POST','/orders',{items:[{product_id:product.id,quantity:1}],delivery_mode:'delivery',delivery_neighborhood:'TEST district',delivery_landmark:'TEST landmark',payment_method:'direct'},identities.buyer.access_token);
    const deliveryId=deliveryCreated.orders[0].id;
    await merchant.page.goto(origin+'/buyer/orders/'+deliveryId);
    await merchant.page.getByTestId('direct-seller-receive').waitFor();
    check('New order requires a fresh receipt consent',!await merchant.page.getByRole('checkbox').isChecked());
    await merchant.page.getByRole('checkbox').check();
    await merchant.page.getByTestId('direct-seller-receive').click();
    await merchant.page.getByTestId('direct-seller-receive').waitFor({state:'hidden'});
    await merchant.page.getByTestId('load-deliverers-btn').click();
    await merchant.page.getByTestId('assign-deliverer-'+identities.deliverer.user.id).click();
    const courier=await actor('deliverer');
    const deliveryCard=courier.page.getByTestId('delivery-'+deliveryId);
    await deliveryCard.waitFor();
    const courierOrders=await api('GET','/deliverer/deliveries',undefined,identities.deliverer.access_token);
    check('Courier dashboard login and assignment exclude buyer handoff codes',courierOrders.every(row=>!Object.hasOwn(row,'confirmation_code')&&!Object.hasOwn(row,'qr_code')));
    await courier.page.getByTestId('advance-'+deliveryId).click();
    await courier.page.getByTestId('advance-'+deliveryId).getByText('Je suis en route',{exact:false}).waitFor();
    await courier.page.getByTestId('advance-'+deliveryId).click();
    await courier.page.getByTestId('advance-'+deliveryId).getByText('Confirmer livraison',{exact:false}).waitFor();
    await courier.page.getByTestId('advance-'+deliveryId).click();
    const buyerDelivery=await api('GET','/orders/'+deliveryId,undefined,identities.buyer.access_token);
    await courier.page.getByTestId('confirm-code-'+deliveryId).fill(buyerDelivery.confirmation_code);
    await courier.page.getByTestId('submit-code-'+deliveryId).click();
    await courier.page.getByTestId('submit-code-'+deliveryId).waitFor({state:'hidden'});
    const delivered=await api('GET','/orders/'+deliveryId,undefined,identities.buyer.access_token);
    const courierEarnings=await api('GET','/deliverer/earnings',undefined,identities.deliverer.access_token);
    check('Courier browser pickup, route and confirmation deliver without financial credit',delivered.status==='delivered'&&delivered.escrow_status==='not_applicable'&&!delivered.payment_confirmed&&courierEarnings.completed_today===1&&courierEarnings.earnings_today===0);

    await buyer.page.goto(origin+'/buyer/orders/'+orderId);
    await buyer.page.locator('#direct-dispute-reason').fill('TEST mediation without funds');
    await buyer.page.getByTestId('direct-payment-panel').getByRole('button',{name:'Ouvrir un litige',exact:true}).click();
    await buyer.page.getByText('Un litige est ouvert ; le traitement est suspendu.',{exact:true}).waitFor();
    const administrator=await actor('admin');
    await administrator.page.goto(origin+'/admin/disputes');
    const adminDisputes=await api('GET','/admin/disputes',undefined,identities.admin.access_token);
    const dispute=adminDisputes.find(row=>row.order_id===orderId);
    const disputeCard=administrator.page.getByTestId('dispute-card-'+dispute.id);
    await disputeCard.waitFor();
    check('Admin direct dispute offers no refund or seller release buttons',await disputeCard.getByTestId('refund-buyer-'+dispute.id).count()===0&&await disputeCard.getByTestId('release-seller-'+dispute.id).count()===0);
    await disputeCard.locator('textarea').fill('TEST agreed mediation');
    await disputeCard.getByRole('button',{name:'Clôturer avec une note, sans mouvement de fonds',exact:true}).click();
    await disputeCard.getByRole('button',{name:'Clôturer avec une note, sans mouvement de fonds',exact:true}).waitFor({state:'hidden'});
    const resolved=await api('GET','/orders/'+orderId,undefined,identities.buyer.access_token);
    check('Admin browser closes direct dispute without modifying received-payment declaration',resolved.dispute_status==='resolved'&&resolved.payment_status==='seller_declared_received'&&resolved.escrow_status==='not_applicable');

    await buyer.page.goto(origin+'/messages/'+conversation);
    await buyer.page.getByTestId('chat-input').waitFor();
    const unsigned=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:identities.buyer.user.id,role:'buyer',type:'access',exp:1})).toString('base64url');
    const expiredToken=unsigned+'.'+crypto.createHmac('sha256',jwtSecret).update(unsigned).digest('base64url');
    await buyer.page.getByTestId('chat-input').fill('TEST expired blocked');
    await buyer.page.evaluate(token=>{
      localStorage.setItem('afri_token',token);
      document.querySelector('[data-testid="chat-send-btn"]').click();
    },expiredToken);
    await buyer.page.waitForURL('**/auth/login');
    const finalProof=fixturePython("import sys,json\nfrom pymongo import MongoClient\ns=json.load(sys.stdin); assert s['database'].startswith('afrimarket_test_launch_browser_'); c=MongoClient('mongodb://127.0.0.1:27018/?replicaSet=phase3-test'); d=c[s['database']]; print(json.dumps({'expired_messages':d.messages.count_documents({'text':'TEST expired blocked'}),'financial_records':sum(d[n].count_documents({}) for n in ['transactions','financial_ledger','withdrawals','deliverer_wallets','deliverer_wallet_transactions']),'orders':d.orders.count_documents({}),'stock':d.products.find_one({'id':s['product']})['stock']})); c.close()",{database,product:product.id});
    check('Expired JWT redirects an open conversation to login and stores no new message',finalProof.expired_messages===0);
    check('Buyer/seller/courier/admin browser cycle preserves stock and zero financial movement',finalProof.financial_records===0&&finalProof.orders===2&&finalProof.stock===6,finalProof);
  } catch(error){rows.push({test:'Business browser sequence',status:'FAIL',error:error.message,browserErrors});process.exitCode=1;}
  finally{
    for(const context of contexts)await context.close();
    if(browser)await browser.close();
    if(staticServer)await new Promise(resolve=>staticServer.close(resolve));
    apiProcess.kill();fs.closeSync(log);
    fixturePython("import json,sys\nfrom pymongo import MongoClient\ns=json.load(sys.stdin); assert s['database'].startswith('afrimarket_test_launch_browser_'); c=MongoClient('mongodb://127.0.0.1:27018/?replicaSet=phase3-test'); c.drop_database(s['database']); c.close()",{database});
    fs.writeFileSync(output,JSON.stringify({sourceSha:metadata.sourceSha,buildSha:metadata.buildSha,scope:'Exact compiled artifact against synthetic real loopback API/Mongo. No staging HTTPS or production business certification; scheduler disabled to prohibit outbound background calls; service workers blocked for deterministic API routing; WhatsApp links inspected without sending messages.',rows},null,2));
    console.log(JSON.stringify(rows,null,2));
  }
})();
