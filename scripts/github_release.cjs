// Uses the user's existing Git Credential Manager session; never prints credentials.
const cp = require('child_process');
const fs = require('fs');
(async () => {
  const credential = cp.execFileSync('git', ['credential', 'fill'], {input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', timeout: 30000});
  const entries = Object.fromEntries(credential.trim().split('\n').map(line => {const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
  if (!entries.password) throw Error('GitHub credentials unavailable');
  const task = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const response = await fetch('https://api.github.com/repos/JonathanK-N/sellers-hub-2/'+task.endpoint, {method: task.method || 'POST',headers: {Authorization: 'Bearer '+entries.password, Accept:'application/vnd.github+json','Content-Type':'application/json'},body: task.body ? JSON.stringify(task.body) : undefined, signal: AbortSignal.timeout(30000)});
  const data = await response.json();
  console.log(JSON.stringify({status:response.status,url:data.html_url,id:data.id,number:data.number,message:data.message,upload_url:data.upload_url},null,2));
  if (!response.ok) process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
