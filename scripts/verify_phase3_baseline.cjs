// Author: Jonathan Kakesa (JonathanK-N).
// Read-only verification; credentials remain in process memory.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
(async () => {
  const credential = cp.execFileSync('git', ['credential', 'fill'], {input:'protocol=https\nhost=github.com\n\n',encoding:'utf8'});
  const token = credential.split('\n').find(x=>x.startsWith('password=')).slice(9).trim();
  const get = async endpoint => {
    const r = await fetch('https://api.github.com/repos/JonathanK-N/sellers-hub-2/'+endpoint, {headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
    if(!r.ok) throw Error('GitHub HTTP '+r.status);
    return r.json();
  };
  const result = {author:'Jonathan Kakesa (JonathanK-N)',checked_at:new Date().toISOString(),pull_requests:[],releases:[]};
  for(const n of [1,2]) {
    const p=await get('pulls/'+n);
    result.pull_requests.push({number:n,base:p.base.ref,base_sha:p.base.sha,head:p.head.ref,head_sha:p.head.sha,draft:p.draft,merged:p.merged});
  }
  const privateRoot=path.resolve('..','Afrimarket-private-backups');
  for(const [id,date] of [[409214759,'20261010'],[409717666,'20261011']]) {
    const r=await get('releases/'+id);
    const dir=path.join(privateRoot,'releases-'+date);
    const assets=r.assets.map(a=>{
      const file=path.join(dir,a.name);
      const local=fs.existsSync(file)?fs.readFileSync(file):null;
      const hash=local?crypto.createHash('sha256').update(local).digest('hex'):null;
      return {name:a.name,size:a.size,digest:a.digest,local_sha256:hash,status:local?(a.digest==='sha256:'+hash&&a.size===local.length?'PASS':'FAIL'):'BLOCKED_LOCAL_NAME'};
    });
    result.releases.push({id,draft:r.draft,tag:r.tag_name,assets});
  }
  fs.mkdirSync('release-evidence/phase3',{recursive:true});
  fs.writeFileSync('release-evidence/phase3/baseline-github.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
