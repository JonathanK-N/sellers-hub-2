// Publish only source/build artifacts selected by the sanitized release manifest.
// Git Credential Manager authentication stays in memory; no database backups.
const cp=require('child_process');
const fs=require('fs');
const path=require('path');
(async()=>{
 const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const credential=cp.execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',timeout:60000});
 const values=Object.fromEntries(credential.trim().split('\n').map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
 if(!values.password)throw Error('GitHub authentication unavailable');
 const headers={Authorization:'Bearer '+values.password,Accept:'application/vnd.github+json'};
 const repo='https://api.github.com/repos/JonathanK-N/sellers-hub-2';
 const response=await fetch(repo+'/releases'+(config.releaseId?'/'+config.releaseId:''),{method:config.releaseId?'PATCH':'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({tag_name:config.tag,target_commitish:config.sha,name:config.name,body:config.body,draft:true,prerelease:true}),signal:AbortSignal.timeout(30000)});
 const release=await response.json();
 if(!response.ok)throw Error('Draft release creation: '+response.status+' '+release.message);
 console.log(JSON.stringify({id:release.id,url:release.html_url,draft:release.draft,tag:release.tag_name}));
 fs.writeFileSync('release-evidence/draft-release-result.json',JSON.stringify({id:release.id,url:release.html_url,draft:release.draft,tag:release.tag_name},null,2));
 const assets=[];
 for(const file of config.files){
  if(!/\.(zip|json)$/.test(file))throw Error('Unexpected artifact extension');
  const upload=release.upload_url.replace(/\{.*$/,'')+'?name='+encodeURIComponent(path.basename(file));
  const r=await fetch(upload,{method:'POST',headers:{...headers,'Content-Type':file.endsWith('.zip')?'application/zip':'application/json'},body:fs.readFileSync(file),signal:AbortSignal.timeout(60000)});
  const asset=await r.json();
  if(!r.ok)throw Error('Artifact upload '+path.basename(file)+': '+r.status+' '+asset.message);
  assets.push({name:asset.name,id:asset.id,url:asset.browser_download_url,size:asset.size});
  console.log(JSON.stringify({uploaded:asset.name,id:asset.id}));
 }
 fs.writeFileSync('release-evidence/draft-release-assets.json',JSON.stringify({release:release.html_url,assets},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
