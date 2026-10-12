// Author: Jonathan Kakesa (JonathanK-N). Downloads verified CI artifacts without exporting credentials.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

(async () => {
  const runId = Number(process.argv[2]);
  const output = path.resolve(process.argv[3]);
  const expectedBranch = process.argv[4] || 'stabilization/afrimarket-phase-3';
  if (!['stabilization/afrimarket-phase-3', 'release/afrimarket-production-launch', 'codex/afrimarket-staging-validation', 'codex/afrimarket-rc2-lcp'].includes(expectedBranch)) throw Error('Unsupported evidence branch');
  if (!runId || !process.argv[3]) throw Error('Run ID and private output directory required');
  const credential = cp.execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', timeout: 60000 });
  const entries = Object.fromEntries(credential.trim().split('\n').map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
  const headers = { Authorization: 'Bearer ' + entries.password, Accept: 'application/vnd.github+json' };
  const root = 'https://api.github.com/repos/JonathanK-N/sellers-hub-2';
  const get = async endpoint => {
    const response = await fetch(root + endpoint, { headers, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw Error('GitHub HTTP ' + response.status);
    return response.json();
  };
  const [run, jobs, inventory] = await Promise.all([get('/actions/runs/' + runId), get('/actions/runs/' + runId + '/jobs'), get('/actions/runs/' + runId + '/artifacts')]);
  if (run.head_branch !== expectedBranch) throw Error('Unexpected branch');
  if (expectedBranch !== 'stabilization/afrimarket-phase-3' && (!jobs.jobs.some(job => job.name === 'frontend-business-e2e') || jobs.jobs.length !== 11)) throw Error('Launch requires all eleven validation jobs');
  if (run.status !== 'completed' || run.conclusion !== 'success' || jobs.jobs.some(job => job.conclusion !== 'success')) throw Error('CI is not fully green');
  fs.mkdirSync(output, { recursive: true });
  const manifest = { sourceSha: run.head_sha, runId, url: run.html_url, status: 'PASS', jobs: jobs.jobs.map(job => ({ name: job.name, status: job.conclusion, id: job.id })), artifacts: [] };
  for (const artifact of inventory.artifacts) {
    if (artifact.expired || !/^sha256:[0-9a-f]{64}$/.test(artifact.digest)) throw Error('Missing immutable artifact digest');
    const response = await fetch(root + '/actions/artifacts/' + artifact.id + '/zip', { headers, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw Error('Artifact download HTTP ' + response.status);
    const data = Buffer.from(await response.arrayBuffer());
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    if ('sha256:' + hash !== artifact.digest || data.length !== artifact.size_in_bytes) throw Error('Artifact integrity failed');
    const name = artifact.name.replace(/-[a-f0-9]{40}$/, '');
    if (!/^[a-z0-9-]+$/.test(name)) throw Error('Unexpected artifact filename');
    const archive = path.join(output, name + '.zip');
    const destination = path.join(output, name);
    fs.writeFileSync(archive, data);
    fs.mkdirSync(destination, { recursive: true });
    const names = cp.execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
    if (names.some(entry => entry.startsWith('/') || entry.includes('..') || entry.includes('\\'))) throw Error('Unsafe archive entry');
    cp.execFileSync('tar', ['-xf', archive, '-C', destination]);
    const checksums = path.join(destination, 'SHA256SUMS');
    if (fs.existsSync(checksums)) {
      for (const line of fs.readFileSync(checksums, 'utf8').trim().split('\n')) {
        const match = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/);
        if (!match) throw Error('Malformed content hash');
        const relative = match[2].trim().replace(/^\.\//, '');
        const target = path.resolve(destination, relative);
        if (!target.startsWith(destination + path.sep)) throw Error('Unsafe checksum path');
        if (crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== match[1]) throw Error('Content integrity failed: ' + relative);
      }
    }
    const metadata = path.join(destination, 'release-metadata.json');
    if (fs.existsSync(metadata) && JSON.parse(fs.readFileSync(metadata)).sourceSha !== run.head_sha) throw Error('Source provenance mismatch');
    manifest.artifacts.push({ name, id: artifact.id, size: data.length, sha256: hash });
    console.log('PASS ' + name);
  }
  fs.writeFileSync(path.join(output, 'ci-manifest.json'), JSON.stringify(manifest, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
