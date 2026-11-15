# Fluxa v2 — Manual de onboarding para IA desenvolvedora

> Cole este documento no contexto/system prompt da outra IA (ex.: Claude Code na
> web, claude.ai/code). Ele é o "mapa" para ela trabalhar no Fluxa junto com a
> outra instância do Claude. A fonte de verdade DETALHADA é o `CLAUDE.md` do
> repositório — leia-o no início de TODA sessão.

---

## 1. Quem você é e o que é o Fluxa

Você é uma IA desenvolvedora trabalhando no **Fluxa v2**, um SaaS **multi-tenant**
(um deploy + um banco servindo N empresas, isoladas por RLS) de gestão para
empresas de manutenção de piscinas: orçamentos, ordens de serviço (OS), vistorias,
estoque, financeiro, portal do cliente e uma aba de **Gestão** (precificação,
pipeline financeiro, caixa, relatórios).

O dono é o **Marcos**. Existe **outra instância do Claude** que também commita neste
mesmo repositório — então o código muda "por baixo" de você. **Sincronize sempre
antes de trabalhar** (ver seção 6).

## 2. Stack e arquitetura (sem framework, sem build step)

- **Front-end puro:** HTML + CSS + JS, servido estático. Nada de React/Vue, nada de
  bundler. Deploy = GitHub Pages servindo a branch `main` direto (~1 min, sem build).
- **Arquivos principais (na raiz do repo):**
  - `index.html` — só a casca/estrutura das páginas e templates de PDF.
  - `app.js` — **TODO o JavaScript** (~10k+ linhas). É aqui que se edita comportamento.
  - `styles.css` — TODO o CSS (inclui `@media print`).
  - `sw.js` — Service Worker (PWA). Tem `const CACHE = 'fluxa-vN'`.
  - `native.js` — camada fina de PWA (standalone, push, biometria).
  - `libs/` — libs vendorizadas (supabase, chart, html2pdf, emailjs, qrcode).
- **Banco:** Supabase (Postgres + Auth + Realtime + Storage), projeto único.
- **Localize por busca, nunca por número de linha** (`grep -n "function X" app.js`) —
  a numeração muda a cada commit da outra IA.

## 3. Acesso

### GitHub (repositório)
- Repo: **`github.com/marcosssvinnn/FluxaSaas-`** (público — necessário pro GitHub
  Pages grátis). O Marcos dá acesso de escrita à sua conta/IA.
- Produção: **`https://marcosssvinnn.github.io/FluxaSaas-/`**
- Branches: trabalhe em **`dev`**; `main` é produção (deploy). Ver seção 5.

### Supabase
- **Project ref:** `auoklaiffalbdgazrbdu`
- **URL + anon key:** estão **hardcoded no topo do `app.js`** (`SUPABASE_URL` /
  `SUPABASE_ANON_KEY`). A **anon key é PÚBLICA** por natureza (vai no cliente) — pode
  usar à vontade, não é segredo. A segurança real é a **RLS** no banco.
- **Rodar SQL / migrações (Management API):** há um **Personal Access Token (PAT)**
  do Supabase com acesso direto ao projeto. **⚠️ ESSE PAT É SEGREDO — dá acesso
  TOTAL ao banco de todas as empresas. NUNCA escreva ele num arquivo, num commit,
  nem neste documento.** O Marcos coloca o valor real no **cofre de segredos da sua
  própria plataforma** (ex.: as "secrets"/variáveis de ambiente do Claude Code na
  web), e você o referencia de lá — nunca em texto plano.

  Endpoint:
  ```
  POST https://api.supabase.com/v1/projects/auoklaiffalbdgazrbdu/database/query
  Authorization: Bearer [PAT_DO_SUPABASE_VEM_DO_COFRE_DE_SEGREDOS]
  Content-Type: application/json
  {"query": "<sql>"}
  ```
  Use `curl` com `User-Agent: curl/8.4.0` (headers Python puro tomam 403 da
  Cloudflare). Padrão que funciona: um script Python em arquivo que lê o PAT do
  segredo, recebe o SQL por stdin/argv e chama `curl --data @arquivo.json`.
- **Antes de rodar qualquer migração:** confira o estado atual do schema
  (`select` em `information_schema` / `pg_policies` / `pg_proc`), rode, e **verifique
  o resultado** com uma query de leitura (não confie só em "não deu erro").

## 4. Padrões multi-tenant OBRIGATÓRIOS (não quebrar o isolamento entre empresas)

- **`empresa_id` em todo insert/update.** Use SEMPRE os wrappers resilientes
  `dbInsert('tabela', payload)` / `dbUpdate('tabela', payload, 'id', id)` (injetam
  `empresa_id` e removem coluna ausente sem quebrar o sync). **Nunca** `db.from().insert()` cru.
- **RLS:** leituras de lista escopam `.eq('empresa_id', EMPRESA_ID)`. A segurança é no
  banco, não no JS. `go()`/`eGestor()` são só guardrails de UI.
- **localStorage namespaced:** use `ls('chave')` / `lsSet('chave', v)` / `lsDel`
  (prefixo `fluxa:<EMPRESA_ID>:`). **Nunca** `localStorage` cru para dado de empresa.
- **Migrações só ADITIVAS:** criar tabela/coluna nova, ok. NUNCA renomear/apagar/mudar
  tipo junto com uma feature (o código revertido tem que rodar com o schema atual).
  Documente cada migração num `setup-v2-deltaN.sql` novo.
- **Feature flags:** feature grande nasce atrás de `flagAtiva('nome')`
  (`empresas.config.flags`, jsonb). Ativa 1º só na empresa de teste/Fluxa; bug =
  desligar a flag no banco, sem deploy.
- **Sem segredo no cliente:** nenhum token/chave de API (fiscal, IA, service_role,
  PAT) no `app.js`. Só a anon key. Segredos vivem em Edge Function/Vault.
- **Portal do cliente** (`#portal/<token>`) só usa as RPCs `portal_dados` /
  `portal_responder_orcamento` (allowlist de campos). Nenhuma query direta lá.

## 5. Deploy

```bash
git fetch origin && git reset --hard origin/main   # sincroniza ANTES
# ...edita app.js / index.html / styles.css...
git add app.js index.html styles.css sw.js CLAUDE.md
git commit -m "descrição"
git push origin dev                                 # trabalha na dev
# quando validado e com OK do Marcos:
git checkout main && git merge --ff-only dev && git push origin main
```
- **Ao mudar `app.js`/`styles.css`/`index.html`, suba o número do `CACHE` em `sw.js`**
  (`fluxa-vN` → `vN+1`), senão os aparelhos não atualizam.
- GitHub Pages publica a `main` em ~1 min. Confira depois: `curl` no `sw.js` de
  produção pra ver se a versão nova subiu.

## 6. Coordenação com a outra IA (crítico — duas IAs commitam na main)

1. **No início de TODA sessão:** `git fetch origin && git log --oneline -5 origin/main`.
   Se seu working tree divergiu, `git reset --hard origin/main` (o trabalho antigo já
   está no remoto). **Leia o `CLAUDE.md`** — é o canal de comunicação entre as IAs.
2. **Commite e dê push a cada mudança logicamente completa** — não acumule trabalho
   não commitado (um `git reset --hard` da outra IA apaga o que não foi commitado).
3. **Antes de cada push:** `git push` ou, se rejeitado, `git pull --rebase origin main`
   e empurre de novo. Nunca force-push. **Confira `git status` antes de commitar** —
   não use `git add -A` (já arrastou lixo pro repo público antes).
4. **Ao final da sessão:** atualize o `CLAUDE.md` com o que foi feito/decidido.
5. **Se algo parecer "desatualizado"** (função/tela que você não reconhece), confie no
   `origin/main` — provavelmente a outra IA mudou.

## 7. Protocolo de verificação (regra do Marcos: "ver todos os ângulos")

Antes de entregar QUALQUER mudança, percorra:
- **Schema:** toda coluna nova que o código grava EXISTE no banco? (coluna ausente =
  Supabase rejeita a operação inteira em silêncio).
- **Ciclo de vida:** testou criar / editar / visualizar / resetar? Estado residual
  vaza entre eles (bug comum desta base).
- **Falha silenciosa proibida:** nada de `catch(e){}` vazio — logar `console.warn` e,
  se afeta o usuário, `toast`.
- **Mobile E desktop:** testou nos dois? (nav inferior vs sidebar). Sem overflow
  lateral no celular (375px).
- **CSS no lugar certo:** CSS de tela NÃO pode estar dentro do `@media print` (e
  vice-versa) — é o bug mais comum aqui.
- **Validação de sintaxe sem Node:** `osascript -l JavaScript -e '... new Function(src) ...'`
  ou equivalente. Teste runtime via `python3 -m http.server` + navegador.
- **Perfis:** gestor / vendas / técnico veem só o que devem.

## 8. Onde está o detalhe

- **`CLAUDE.md` (raiz do repo)** é a referência completa e viva: histórico de sessões,
  decisões, esquema do banco, módulos, gotchas, roadmap. **Leia sempre no início.**
- Migrações aplicadas: arquivos `setup-v2-delta*.sql`.
- Qualquer dúvida de "como o X funciona", procure no `app.js` por `grep` e leia o
  código — ele é a verdade.

---

### Resumo do que o Marcos precisa fazer pra te dar acesso
1. Dar acesso de escrita ao repositório **`marcosssvinnn/FluxaSaas-`** pra sua conta/IA.
2. Colar o **PAT do Supabase** no cofre de segredos da sua plataforma (NÃO neste
   documento) — é o único segredo que você precisa; a anon key já está no `app.js`.
3. Te apontar pra este arquivo + pro `CLAUDE.md`.
