const fs=require('fs');
const cp=require('child_process');
const crypto=require('crypto');
const path=require('path');
const out=path.resolve('../Afrimarket-private-backups/releases-20261010');
fs.mkdirSync(out,{recursive:true});
const current=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const refs=[['A-original','6722492d85e0f8646ebe03c9b841c4a0e3611449'],['B-uiux-tip','83be26533e8bca3aa4ca1b1fa84c93f686aabec0'],['B-uiux-deployed','0e24300a3fa0cba3dcf8896e4617d9dec5fd3e84'],['C-green',current]];
const artifacts=[];
for(const [version,sha]of refs){
 const file=path.join(out,version+'-'+sha.slice(0,12)+'-source.zip');
 cp.execFileSync('git',['archive','--format=zip','--output='+file,sha]);
 artifacts.push({version,sha,date:new Date().toISOString(),type:'source archive',file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),tools:{node:process.version,git:cp.execFileSync('git',['--version'],{encoding:'utf8'}).trim()},tests:version==='C-green'?'Railway backend 9 unit tests passed; staging web built; see evidence for remaining blockers':'Reference preserved; historical build not locally reproduced',restore:'Extract into a new checkout; restore exact Git tag; supply private environment variables separately. No database backup is included.'});
}
fs.writeFileSync(path.join(out,'artifact-manifest.json'),JSON.stringify({artifacts},null,2));
fs.writeFileSync('release-evidence/artifact-manifest.json',JSON.stringify({artifacts},null,2));
console.log(JSON.stringify(artifacts.map(a=>({version:a.version,file:a.file,sha256:a.sha256})),null,2));
