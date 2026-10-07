// Store em memória com a mesma interface do Netlify Blobs (o suficiente para os testes).
export function memStore(pageSize = 3){
  const m = new Map();
  return {
    _m: m,
    async get(key, opt){ if (!m.has(key)) return null; const v = m.get(key); return opt?.type === 'json' ? JSON.parse(v) : v; },
    async set(key, v){ m.set(key, String(v)); },
    async setJSON(key, v){ m.set(key, JSON.stringify(v)); },
    async delete(key){ m.delete(key); },
    list(opt = {}){
      const keys = [...m.keys()].filter(k => !opt.prefix || k.startsWith(opt.prefix)).sort();
      const pages = []; for (let i = 0; i < keys.length; i += pageSize) pages.push({ blobs: keys.slice(i, i + pageSize).map(key => ({ key, etag: 'e' })), directories: [] });
      if (!pages.length) pages.push({ blobs: [], directories: [] });
      if (opt.paginate) return (async function*(){ for (const p of pages) yield p; })();
      return Promise.resolve({ blobs: pages.flatMap(p => p.blobs), directories: [] });
    },
  };
}
