// Ponte entre um Request/Response web e o núcleo da API (testável com stores em memória).
import { createApi } from './api.mjs';

const reply = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export function createHandler(deps){
  const handle = createApi(deps);
  return async (req, ctx = {}) => {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const headers = Object.fromEntries(req.headers);
    let body = {};
    if (req.method === 'POST') {
      const txt = await req.text();
      if (txt.length > 16000) return reply(413, { error: 'too_big' });
      try { body = txt ? JSON.parse(txt) : {}; } catch { return reply(400, { error: 'bad_json' }); }
      if (typeof body !== 'object' || body === null || Array.isArray(body)) body = {};
    }
    const ip = ctx.ip || headers['x-nf-client-connection-ip'] || (headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
    try {
      const [status, data] = await handle({ method: req.method, path, query: url.searchParams, headers, body, ip });
      return reply(status, data);
    } catch (e) {
      console.error('api error', req.method, path, e && e.stack || e);
      return reply(500, { error: 'server' });
    }
  };
}
