// Author: Jonathan Kakesa (JonathanK-N). Protected, short-lived staging test sessions only.
const fs=require('node:fs'),path=require('node:path');
(async()=>{
  const api='https://afrimarket-api-staging-staging.up.railway.app',origin='https://afrimarket-web-staging-staging.up.railway.app';
  const output=path.resolve(process.argv[2]),root=path.resolve(process.env.QA_PRIVATE_ROOT||'../Afrimarket-private-backups');
  const expected=process.env.STAGING_QA_SOURCE_SHA;
  if(!process.argv[2]||!output.startsWith(root+path.sep)||!/^[a-f0-9]{40}$/.test(expected||''))throw Error('Scoped private directory and source SHA required');
  const healthResponse=await fetch(api+'/api/health',{signal:AbortSignal.timeout(20000)});
  const health=await healthResponse.json();
  if(!healthResponse.ok||health.status!=='ok'||health.source_sha!==expected)throw Error('Staging source or health does not match');
  fs.mkdirSync(output,{recursive:true,mode:0o700});
  for(const role of ['buyer','seller','admin']){
    const token=process.env['STAGING_QA_TOKEN_'+role.toUpperCase()];
    if(!token)throw Error('Required staging session unavailable');
    const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
    const now=Math.floor(Date.now()/1000);
    if(claims.role!==role||claims.exp<=now||claims.exp>now+3600)throw Error('Staging session must be valid and short-lived');
    const response=await fetch(api+'/api/auth/me',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
    const user=await response.json();
    if(!response.ok||user.role!==role)throw Error('Staging role verification failed');
    if(role!=='admin'&&!String(user.name||'').startsWith('TEST HTTPS '))throw Error('Only dedicated test identities allowed');
    const state={cookies:[],origins:[{origin,localStorage:[{name:'afri_token',value:token},{name:'afri_user',value:JSON.stringify(user)}]}]};
    fs.writeFileSync(path.join(output,role+'-storage.json'),JSON.stringify(state),{mode:0o600});
  }
  console.log('PASS: protected staging sessions prepared; no credentials emitted');
})().catch(()=>{console.error('Staging test sessions unavailable; details withheld');process.exitCode=1;});
