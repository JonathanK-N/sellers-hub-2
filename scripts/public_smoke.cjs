const fs = require('fs');
const base = process.argv[2] || 'https://sellers-hub-2-production.up.railway.app';
(async () => {
  const rows = [];
  for (const path of ['/api/', '/api/health', '/api/countries', '/api/products?country_code=CD']) {
    try {
      const response = await fetch(base + path, {signal: AbortSignal.timeout(15000)});
      const data = await response.json();
      const passed = response.ok && (path !== '/api/health' || data.status === 'ok');
      rows.push({path, http: response.status, result: passed ? 'PASS' : 'FAIL', ...(path === '/api/health' ? {health: data} : {type: Array.isArray(data) ? 'array' : typeof data})});
    } catch (error) { rows.push({path, result: 'BLOCKED', error: error.message}); }
  }
  console.log(JSON.stringify({base, time: new Date().toISOString(), rows}, null, 2));
})().catch(e => {console.error(e);process.exitCode=1;});
