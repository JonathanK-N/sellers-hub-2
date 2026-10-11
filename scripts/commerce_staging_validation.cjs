// Synthetic staging only. Credentials stay outside the repository and reports.
const fs=require('fs');
const path=require('path');
const base='https://afrimarket-api-staging-staging.up.railway.app/api';
const privateDir=path.resolve('../Afrimarket-private-backups');
const sessions=JSON.parse(fs.readFileSync(path.join(privateDir,'staging-session.json')));
const newer=JSON.parse(fs.readFileSync(path.join(privateDir,'phase2-new-sessions.json')));
const admin=JSON.parse(fs.readFileSync(path.join(privateDir,'staging-admin.json')));
const rows=[];
async function request(route, method='GET', body, token){
  const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  return {http:r.status,data:await r.json()};
}
function check(test, ok, detail={}){rows.push({test,status:ok?'PASS':'FAIL',...detail});if(!ok)throw Error(test);}
(async()=>{
  const seller=sessions.seller.access_token, buyer=newer.buyer.access_token, courier=newer.deliverer.access_token;
  try{
    const auth=await request('/auth/admin/login','POST',admin);
    check('admin synthetic login',auth.http===200,{http:auth.http});
    const adminToken=auth.data.access_token;
    const shop=await request('/seller/me','GET',undefined,seller);
    check('seller configured shop readable',shop.http===200,{http:shop.http});
    const name='TEST-phase2-delivery-'+Date.now();
    const created=await request('/products','POST',{name,description:'Synthetic validation only',price:100,currency:'FC',stock:3,category:'Général',delivery_modes:['delivery','collect']},seller);
    check('seller publishes product',created.http===201,{http:created.http});
    const id=created.data.id;
    const updated=await request('/products/'+id,'PATCH',{price:125,stock:4},seller);
    check('seller edits product price and stock',updated.http===200,{http:updated.http});
    const product=await request('/products/'+id);
    check('buyer reads edited product',product.http===200&&product.data.price===125&&product.data.stock===4,{http:product.http});
    const search=await request('/products?q='+encodeURIComponent(name)+'&country_code=CD');
    check('public search finds synthetic product',search.http===200&&search.data.some(p=>p.id===id),{http:search.http});
    const denied=await request('/products/'+id,'PATCH',{price:1},buyer);
    check('buyer cannot edit seller product',denied.http===403,{http:denied.http});
    const orderResponse=await request('/orders','POST',{items:[{product_id:id,quantity:1}],delivery_mode:'delivery',delivery_address:'TEST isolated staging',delivery_neighborhood:'TEST',payment_method:'cash',checkout_currency:'FC'},buyer);
    check('buyer creates synthetic cash delivery order',orderResponse.http===201,{http:orderResponse.http});
    const order=orderResponse.data.orders[0];
    check('server computes price and commission',order.total_amount===125&&order.commission_amount===8.75,{total:order.total_amount,commission:order.commission_amount});
    const assign=await request('/orders/'+order.id+'/assign','POST',{deliverer_id:newer.deliverer.user.id},seller);
    check('seller assigns verified synthetic courier',assign.http===200,{http:assign.http});
    const deliveries=await request('/deliverer/deliveries','GET',undefined,courier);
    const assigned=deliveries.data.find(p=>p.id===order.id);
    check('courier list includes assignment without handoff secrets',deliveries.http===200&&!!assigned&&!('confirmation_code' in assigned)&&!('qr_code' in assigned),{http:deliveries.http});
    const premature=await request('/deliverer/orders/'+order.id+'/confirm','POST',{code:order.confirmation_code},courier);
    check('premature courier confirmation rejected',premature.http===409,{http:premature.http});
    for(const action of ['picked-up','en-route']){
      const r=await request('/deliverer/orders/'+order.id+'/'+action,'POST',{},courier);
      check('courier '+action,r.http===200,{http:r.http});
    }
    const invalid=await request('/deliverer/orders/'+order.id+'/confirm','POST',{code:'invalid'},courier);
    check('invalid buyer code rejected',invalid.http===400,{http:invalid.http});
    const confirm=await request('/deliverer/orders/'+order.id+'/confirm','POST',{code:order.confirmation_code},courier);
    check('courier confirms synthetic delivery',confirm.http===200,{http:confirm.http});
    const repeat=await request('/deliverer/orders/'+order.id+'/confirm','POST',{code:order.confirmation_code},courier);
    check('duplicate courier confirmation rejected',repeat.http===409,{http:repeat.http});
    const read=await request('/orders/'+order.id,'GET',undefined,buyer);
    check('buyer sees final delivered and released states',read.http===200&&read.data.status==='delivered'&&read.data.escrow_status==='released',{http:read.http});
    const notices=await request('/notifications','GET',undefined,buyer);
    check('buyer receives in-app delivery notification',notices.http===200&&notices.data.some(n=>n.data?.order_id===order.id||n.metadata?.order_id===order.id),{http:notices.http});
    const adminUsers=await request('/admin/users','GET',undefined,adminToken);
    check('admin users permission',adminUsers.http===200,{http:adminUsers.http});
    const nonAdmin=await request('/admin/users','GET',undefined,buyer);
    check('buyer denied admin permission',nonAdmin.http===403,{http:nonAdmin.http});
    fs.writeFileSync(path.join(privateDir,'phase2-delivery-latest.json'),JSON.stringify({productId:id,orderId:order.id},null,2));
  }catch(error){rows.push({test:'remaining HTTP sequence',status:'FAIL',detail:error.message});process.exitCode=1;}
  const evidence={synthetic:true,base,date:new Date().toISOString(),rows};
  fs.writeFileSync(process.argv[2]||'release-evidence/phase2/commerce-http-current.json',JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
})();
