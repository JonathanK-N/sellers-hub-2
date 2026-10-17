// Author: Jonathan Kakesa. Additional profiler run, excluded from acceptance measurements.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const {createRequire} = require('node:module');
const {pathToFileURL} = require('node:url');
(async () => {
  const origin = 'https://afrimarket-web-staging-staging.up.railway.app';
  const output = process.argv[2];
  const dependency = createRequire(fs.realpathSync(process.env.LIGHTHOUSE_PACKAGE));
  const lighthouse = (await import(pathToFileURL(dependency.resolve('lighthouse')).href)).default;
  const launcher = await import(pathToFileURL(dependency.resolve('chrome-launcher')).href);
  const {CpuProfileModel} = await import(pathToFileURL(path.join(path.dirname(dependency.resolve('lighthouse')), 'lib/tracehouse/cpu-profile-model.js')).href);
  const health = await (await fetch('https://afrimarket-api-staging-staging.up.railway.app/api/health')).json();
  if (health.status !== 'ok' || health.source_sha !== 'c38a75d81470c62fbb878f979752ff0a85af2649') throw Error('Unexpected deployed API');
  const html = await (await fetch(origin)).text();
  if (!html.includes('/assets/index-DtniLwOj.js')) throw Error('Unexpected deployed Web');
  const entryBytes = Buffer.from(await (await fetch(origin + '/assets/index-DtniLwOj.js')).arrayBuffer());
  if (crypto.createHash('sha256').update(entryBytes).digest('hex') !== '7933184a0af85631036863b956823b85c2a96fefd6058636a25a23a724734096') throw Error('Unexpected deployed Web artifact');
  const chrome = await launcher.launch({chromeFlags:['--headless','--no-sandbox'], logLevel:'silent'});
  try {
    const result = await lighthouse(origin, {port:chrome.port, logLevel:'silent', output:'json', onlyCategories:['performance'], additionalTraceCategories:['disabled-by-default-v8.cpu_profiler']});
    const frames = [];
    for (const profile of CpuProfileModel.collectProfileEvents(result.artifacts.Trace.traceEvents)) {
      const totals = new Map();
      for (let i = 0; i < profile.samples.length; i++) totals.set(profile.samples[i], (totals.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0));
      for (const node of profile.nodes) {
        const frame = node.callFrame;
        if (frame?.url?.startsWith(origin + '/assets/')) frames.push({function:frame.functionName, path:new URL(frame.url).pathname, line:frame.lineNumber, column:frame.columnNumber, selfMs:(totals.get(node.id)||0)/1000});
      }
    }
    fs.writeFileSync(output, JSON.stringify({sourceSha:health.source_sha, scope:'Additional public HTTPS CPU profile; profiling overhead; not an acceptance measurement', frames:frames.sort((a,b)=>b.selfMs-a.selfMs).slice(0,50), longTasks:result.lhr.audits['long-tasks']?.details?.items || []}, null, 2));
  } finally { await chrome.kill(); }
})().catch(error => {console.error(error.message); process.exitCode=1;});
