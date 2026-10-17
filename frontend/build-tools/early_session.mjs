// Author: Jonathan Kakesa. Start only session verification before the application bundle.
function bootstrap(api) {
  try {
    const token = localStorage.getItem('afri_token');
    if (!token) return;
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 15000);
    const entry = {token, expires: Date.now() + 15000};
    entry.promise = fetch(api + '/auth/me', {
      method: 'GET', headers: {Authorization: 'Bearer ' + token},
      credentials: 'omit', cache: 'no-store', signal: controller.signal,
    }).then(async response => ({ok: response.ok, status: response.status,
      data: await response.json().catch(() => null)}))
      .catch(error => ({error})).finally(() => clearTimeout(abortTimer));
    entry.cleanupTimer = setTimeout(() => {
      if (window.__afriInitialSession === entry) delete window.__afriInitialSession;
    }, 15000);
    window.__afriInitialSession = entry;
  } catch { /* Unavailable storage leaves normal session verification in control. */ }
}

export function earlySessionScript(backendUrl) {
  const api = backendUrl ? backendUrl.replace(/\/+$/, '') + '/api' : '/api';
  const argument = JSON.stringify(api).replaceAll('<', '\\u003c');
  return `<script data-afrimarket-session>(${bootstrap.toString()})(${argument});</script>`;
}
