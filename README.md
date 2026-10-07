# Sobrevive à Noite

Jogo de arena survivor em pixel art (estilo Brotato), feito para telemóvel. PWA instalável, com contas anónimas, ranking global/semanal e verificação anti-batota no servidor.

## Estrutura

- `public/` — o que o site serve (`index.html` com o jogo todo, service worker, manifesto, ícones, fontes, `_headers`).
- `netlify/functions/api.mjs` — API em `/api/*` (Netlify Functions + Blobs).
- `netlify/functions/cleanup.mjs` — limpeza diária agendada.
- `netlify.toml` — publicação em `public/`, funções e Node 22.

> As funções estão **já compiladas** (bundle de esbuild). O código-fonte original do servidor (`api.mjs`/`http.mjs`, testes) não está neste repositório.

## Deploy

Ligar este repositório ao site Netlify `sobrevive-a-noite`: cada push para `main` faz deploy.
Variável de ambiente necessária no Netlify: `ADMIN_KEY` (segredo; nunca no repositório).

## Atualizar versões

Ao mudar ficheiros estáticos, subir a constante `VERSION` em `public/sw.js` para os telemóveis apanharem a versão nova.
Se mudares regras de ondas ou XP no jogo, a mesma fórmula tem de ser atualizada em `netlify/functions/api.mjs` (`cum`, `waveDur`, spawn).
