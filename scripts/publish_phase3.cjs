// Author: Jonathan Kakesa (JonathanK-N). Creates only a draft release from reviewed, hashed artifacts.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

(async () => {
  const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (config.tag !== 'v1.0.1-green-rc.3' || !/^[a-f0-9]{40}$/.test(config.sha)) throw Error('Unexpected release candidate');
  const files = config.files.map(entry => {
    if (!/\.(zip|json|apk|txt|md)$/.test(entry.path) || /backup|\.env|keyfile|secret/i.test(path.basename(entry.path))) throw Error('Private or unsupported artifact');
    const bytes = fs.readFileSync(entry.path);
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('Release checksum mismatch');
    return { path: entry.path, bytes };
  });
  const credential = cp.execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', timeout: 60000 });
  const entries = Object.fromEntries(credential.trim().split('\n').map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
  const headers = { Authorization: 'Bearer ' + entries.password, Accept: 'application/vnd.github+json' };
  const root = 'https://api.github.com/repos/JonathanK-N/sellers-hub-2';
  const response = await fetch(root + '/releases', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ tag_name: config.tag, target_commitish: config.sha, name: config.name, body: config.body, draft: true, prerelease: true }), signal: AbortSignal.timeout(60000) });
  const release = await response.json();
  if (!response.ok) throw Error('Draft release creation HTTP ' + response.status);
  const result = { id: release.id, url: release.html_url, draft: release.draft, tag: release.tag_name, sha: config.sha, assets: [] };
  fs.writeFileSync(config.resultPath, JSON.stringify(result, null, 2));
  for (const file of files) {
    const upload = release.upload_url.replace(/\{.*$/, '') + '?name=' + encodeURIComponent(path.basename(file.path));
    const response = await fetch(upload, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: file.bytes, signal: AbortSignal.timeout(120000) });
    const asset = await response.json();
    if (!response.ok) throw Error('Artifact upload HTTP ' + response.status);
    result.assets.push({ id: asset.id, name: asset.name, size: asset.size, sha256: crypto.createHash('sha256').update(file.bytes).digest('hex'), url: asset.browser_download_url });
    fs.writeFileSync(config.resultPath, JSON.stringify(result, null, 2));
    console.log('Uploaded ' + asset.name);
  }
  console.log(JSON.stringify({ id: result.id, url: result.url, draft: true }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
