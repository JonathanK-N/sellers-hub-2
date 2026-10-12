// Author: Jonathan Kakesa (JonathanK-N). Real staging HTTPS verification only.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Djibril/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const apiOrigin='https://afrimarket-api-staging-staging.up.railway.app',webOrigin='https://afrimarket-web-staging-staging.up.railway.app';
  const expectedSha=process.argv[4]||'779ec1244bb25077e639ffc4dbe64f17ce344024';
  if(!/^[a-f0-9]{40}$/.test(expectedSha))throw Error('Explicit expected SHA required');
  const privateDir=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
  const privateRoot=path.resolve('../Afrimarket-private-backups');
  if(!process.argv[3]||!privateDir.startsWith(privateRoot+path.sep)||fs.existsSync(privateDir))throw Error('Fresh private staging directory required');
  fs.mkdirSync(privateDir,{recursive:true});
  const owner=cp.execFileSync('whoami',[],{encoding:'utf8'}).trim();cp.execFileSync('icacls',[privateDir,'/inheritance:r','/grant:r',owner+':(OI)(CI)F'],{stdio:'pipe'});
  const vars=JSON.parse(cp.execFileSync(path.join(privateRoot,'railway-cli-5.64.2','railway.exe'),['variable','list','--project','bc40e22f-b963-46fa-a64e-240f3aa954cd','--environment','0fea37a0-e334-4963-952e-d99ca7523ffd','--service','3a11fecf-70e7-4ba3-8744-d0156b9f7e6c','--json'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));
  if(vars.AUTH_MODE!=='sandbox'||vars.CINETPAY_ENABLED!=='false'||vars.COMMERCE_CHECKOUT_MODE!=='direct'||vars.SEED_DEMO!=='false'||vars.AT_API_KEY||vars.AWS_ACCESS_KEY_ID)throw Error('Unsafe staging test configuration');
  const password=crypto.randomBytes(20).toString('hex'),jwtSecret=vars.JWT_SECRET,phoneSeed=crypto.randomInt(100000,899990),fixtureMarker='TEST HTTPS '+crypto.randomBytes(6).toString('hex');
  const metadata={api:apiOrigin,sourceSha:expectedSha,buildSha:'Railway deployed source'},rows=[],contexts=[],browserErrors=[];
  let browser,staticServer;
  const check = (name, condition, detail) => { assert.ok(condition, name); rows.push({test:name,status:'PASS',...(detail?{detail}: {})}); console.log(JSON.stringify({passed:name})); };
  const api = async (method, endpoint, body, token) => {
    const response = await fetch(apiOrigin+'/api'+endpoint,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(method==='POST'&&endpoint==='/orders'?{'Idempotency-Key':crypto.randomUUID()}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data = await response.json();
    if (!response.ok) throw Error(method+' '+endpoint+' HTTP '+response.status+(Array.isArray(data.detail)?' '+JSON.stringify(data.detail.map(row=>({type:row.type,loc:row.loc}))):''));
    return data;
  };
  try {
    const health=await api('GET','/health');if(health.status!=='ok'||health.source_sha!==expectedSha)throw Error('Unexpected staging source or health');
    const identities={};
    for(const [index,role] of ['buyer','seller','deliverer'].entries()){
      const phone='+243899'+String(phoneSeed+index).padStart(6,'0');
      const registered=await api('POST','/auth/register',{name:fixtureMarker+' '+role,phone,role,country_code:'CD',password});
      await api('POST','/auth/verify-otp',{phone,code:registered.otp_dev});
      identities[role]=await api('POST','/auth/login',{phone,password});
    }
    check('Synthetic buyer, seller and courier registered, OTP-verified and authenticated via real HTTP',true);
    identities.admin=await api('POST','/auth/admin/login',{phone:vars.ADMIN_PHONE,password:vars.ADMIN_PASSWORD});
    const seller=await api('POST','/seller/setup',{shop_name:fixtureMarker+' shop',address:'TEST collection point'},identities.seller.access_token);
    await api('PUT','/seller/whatsapp',{phone:identities.seller.user.phone,visible:true},identities.seller.access_token);
    const product=await api('POST','/products',{name:fixtureMarker+' product',price:1200,currency:'FC',stock:8,photos:[],delivery_modes:['collect','delivery']},identities.seller.access_token);
    const origin=webOrigin;
    browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
    const actor=async role=>{
      const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
      context.setDefaultTimeout(20000);
      context.setDefaultNavigationTimeout(30000);
      contexts.push(context);
      const network={down:false,loseMessageResponse:false};
      await context.route('**/*',async route=>{
        const request=route.request();const url=new URL(request.url());
        if(url.origin===apiOrigin){
          if(network.down)return route.abort('internetdisconnected');
          if(network.loseMessageResponse&&request.method()==='POST'&&url.pathname==='/api/messages'){
            network.loseMessageResponse=false;
            try{await route.fetch();}catch{ return route.abort('connectionfailed').catch(()=>{}); }
            network.down=true;return route.abort('internetdisconnected').catch(()=>{});
          }
          return route.continue();
        }
        if(url.origin===origin)return route.continue();
        return route.abort('blockedbyclient');
      });
      const page=await context.newPage();
      page.on('pageerror',error=>browserErrors.push(error.message));
      await page.goto(origin+(role==='admin'?'/admin/login':'/auth/login'));
      await page.getByTestId(role==='admin'?'admin-phone-input':'login-phone-input').fill(role==='admin'?vars.ADMIN_PHONE:identities[role].user.phone.slice(4));
      await page.getByTestId(role==='admin'?'admin-password-input':'login-password-input').fill(role==='admin'?vars.ADMIN_PASSWORD:password);
      await page.getByTestId(role==='admin'?'admin-login-submit':'login-submit-btn').click();
      await page.waitForURL(role==='admin'?'**/admin/overview':role==='seller'?'**/seller/dashboard':role==='deliverer'?'**/livreur':'**/buyer/home');
      await context.storageState({path:path.join(privateDir,role+'-storage.json')});
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
    await buyer.page.getByTestId('chat-input').waitFor();
    check('Uncertain message draft survives reload',await buyer.page.getByTestId('chat-input').inputValue()==='TEST uncertain response');
    buyer.network.down=false;
    await buyer.page.getByTestId('chat-send-btn').click();
    await buyer.page.getByTestId('chat-messages').getByText('TEST uncertain response',{exact:false}).waitFor();
    await merchant.page.goto(origin+'/messages/'+conversation);
    await merchant.page.getByTestId('chat-messages').getByText('TEST uncertain response',{exact:false}).waitFor();
    check('Seller sees persisted buyer messages after reconnect',true);
    const persisted=await api('GET','/messages/conversations/'+conversation+'/history',undefined,identities.buyer.access_token);
    const currentProduct=await api('GET','/products/'+product.id);
    check('HTTPS response-loss retry persists exactly one message',persisted.messages.filter(m=>m.text==='TEST uncertain response').length===1);
    check('HTTPS direct checkout reserves stock once',currentProduct.stock===7);
    for(const width of [390,768,1440]){
      await buyer.page.setViewportSize({width,height:900});
      check('Chat layout has no horizontal overflow at '+width,await buyer.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    const pageOne=await api('GET','/messages/conversations/'+conversation+'/history?limit=1',undefined,identities.buyer.access_token);
    const pageTwo=await api('GET','/messages/conversations/'+conversation+'/history?limit=1&before='+encodeURIComponent(pageOne.next_before),undefined,identities.buyer.access_token);
    check('HTTPS history pages preserve distinct persisted messages',pageOne.messages.length===1&&pageTwo.messages.length===1&&pageOne.messages[0].id!==pageTwo.messages[0].id);
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
    const finalHistory=await api('GET','/messages/conversations/'+conversation+'/history',undefined,identities.seller.access_token);
    const finalProduct=await api('GET','/products/'+product.id);
    const sellerWallet=await api('GET','/seller/wallet',undefined,identities.seller.access_token);
    check('Expired JWT stores no new message in HTTPS history',!finalHistory.messages.some(m=>m.text==='TEST expired blocked'));
    check('HTTPS two-order cycle preserves stock and no payable seller credit',finalProduct.stock===6&&sellerWallet.available===0);
    fs.writeFileSync(path.join(privateDir,'fixture-state.json'),JSON.stringify({marker:fixtureMarker,productId:product.id,sellerId:seller.id,orders:[orderId,deliveryId],identities,password},null,2));
  } catch(error){rows.push({test:'Business browser sequence',status:'FAIL',error:error.message,browserErrors});process.exitCode=1;}
  finally{
    for(const context of contexts)await context.close();
    if(browser)await browser.close();
    if(staticServer)await new Promise(resolve=>staticServer.close(resolve));
    fs.writeFileSync(output,JSON.stringify({sourceSha:metadata.sourceSha,buildSha:metadata.buildSha,scope:'Real deployed Railway staging HTTPS, explicitly authorized SHA 779ec124. Only dedicated TEST fixtures; no production access and no Mongo direct integrity/ledger-count certification. Fixtures retained for review; no collection deletion. WhatsApp links inspected without sending.',rows},null,2));
    console.log(JSON.stringify(rows,null,2));
  }
})();
