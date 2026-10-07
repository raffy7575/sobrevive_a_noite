# Sobrevive à Noite (PWA)

Jogo arena survivor em pixel art. Instala-se no ecrã principal, funciona sem internet e tem contas, ranking global/semanal e verificação anti-batota.

```
public/                 o jogo (index.html), manifest, service worker, ícones, fontes (tudo local)
netlify/functions/      api.mts (API em /api/*) e cleanup.mts (limpeza diária)
netlify/lib/            api.mjs (regras, contas, rankings, anti-batota) e http.mjs (ponte HTTP)
test/                   run.mjs (servidor, 37 testes) e e2e.mjs (jogo real <-> API real)
netlify.toml            publicação, funções e cabeçalhos de segurança
```

## Deploy (Netlify)
Na pasta do projeto: `npx -y @netlify/mcp@latest --site-id <ID> --proxy-path "<URL>"` (o comando é gerado pelo assistente), ou ligar o repositório ao Netlify.
Variável de ambiente necessária: `ADMIN_KEY` (segredo para moderar o ranking).

## Moderação (curl)
```
curl -s -X POST https://SEU-SITE/api/admin -H "x-admin-key: $ADMIN_KEY" -H "content-type: application/json" -d '{"action":"list"}'
curl -s -X POST https://SEU-SITE/api/admin -H "x-admin-key: $ADMIN_KEY" -H "content-type: application/json" -d '{"action":"ban","name":"Nome"}'
```
Ações: `list`, `remove` (tira do ranking), `ban` (tira e bloqueia), `unban`. `list` mostra "flags": partidas que o servidor rejeitou.

## Como funciona o anti-batota
O cliente não envia pontuações: envia ondas e mortes, assinadas (HMAC) com uma chave que o servidor dá no início de cada partida.
O servidor guarda o tempo real e rejeita resultados que as regras do jogo não permitem:
- tempo: cada onda dura pelo menos `waveDur(n)` segundos (acelerar o relógio não ajuda);
- mortes: no máximo o que as regras de spawn deixam existir em cada onda;
- nível coerente com as mortes; vitória só com 30 ondas; cada partida conta uma vez;
- a pontuação é calculada no servidor; só o melhor resultado de cada jogador entra no ranking.
Limites de pedidos por IP e por jogador, nomes filtrados, códigos de sincronização com 60 bits e bloqueio de tentativas.
Limite honesto: um batoteiro paciente, que espere o tempo real e envie números plausíveis, ainda passa. O passo seguinte seria verificar um registo determinista da partida no servidor.

## Testes
`npm install && npm test` (servidor) e `node test/e2e.mjs cheat` / `node test/e2e.mjs natural` (jogo real contra a API).

## Testes

```
npm install
npm test                      # 37 testes do servidor (regras, contas, anti-batota, rankings, moderação)
node test/e2e.mjs cheat       # jogo real <-> API real (stores em memória)
node test/e2e.mjs natural     # idem, a morrer de forma natural
```

## Regras partilhadas cliente/servidor

A fórmula de XP (`cum` em `public/index.html`, `cumKills` em `netlify/lib/api.mjs`) e as de duração/spawn das ondas têm de ser iguais nos dois sítios.
