# Fluxa App — Contexto do Projeto

> ## 🟢 ESTE É O FLUXA v2 (SaaS multi-tenant)
> UM deploy + UM banco servindo N empresas, isoladas por RLS (ver **"FLUXA V2 — SaaS MULTI-TENANT"** abaixo). Workspace `~/Documents/fluxa`, repo próprio, **branch `dev`** (main = produção do v2). Schema em `setup-v2.sql`. Credenciais: constantes `SUPABASE_URL`/`SUPABASE_ANON_KEY` no topo de `app.js`.
>
> **⚠️ Seções v1 abaixo são referência de COMPORTAMENTO (módulos), mas as instruções v1 de infraestrutura NÃO valem no v2:** ignore "config.js", o repo/URL `fluxa-app`, o "git push para main do fluxa-app", o protocolo das "duas IAs" e a tabela `empresa_config` — tudo isso é do v1. Deploy v2 = merge `dev`→`main` do repo do v2 (validado antes). O v1 continua em produção separado e **não é tocado**.
>
> **Validação sem banco:** sintaxe via `osascript`/`new Function` (não há Node); runtime via `python3 -m http.server 8778 --directory ~/Documents/fluxa` + `http://localhost:8778` (o preview de `file://` não roda o JS).

---

## 🛡️ PROTOCOLO DE VERIFICAÇÃO — OBRIGATÓRIO ANTES DE ENTREGAR QUALQUER MUDANÇA

> **Regra do Marcos:** *"sempre verificar todos os ângulos e brechas do código para não aparecer bug no futuro."*
> Não basta a funcionalidade "funcionar no caminho feliz". Antes de commitar/deployar QUALQUER feature ou correção, percorra mentalmente TODOS os ângulos abaixo. Esta seção tem precedência — se faltar tempo, corte escopo, não corte verificação.

### Checklist obrigatório (rode item a item, não pule)

1. **Schema do banco** — todo campo novo que o código grava (`insert`/`update`) EXISTE no Supabase? Confirme com `curl ".../rest/v1/TABELA?select=COLUNA&limit=1"`. Coluna ausente = Supabase rejeita a operação INTEIRA e o registro para de sincronizar **em silêncio**. Use SEMPRE `dbInsert`/`dbUpdate` (wrappers resilientes), nunca `db.from().insert()` cru. Ver "REGRA DE OURO" abaixo.
2. **Ciclo de vida completo** — testou os 4 caminhos? **Criar / Editar / Visualizar / Resetar (novo)**. A maioria dos bugs desta base foi estado residual vazando entre eles (ex.: desconto, rascunho, campos de OS). Ao abrir um registro, mostra só os dados dele? Ao criar novo, limpa tudo?
3. **Persistência dupla** — o dado salva no **localStorage E no Supabase**, e os dois batem? Registros presos só no local (`local_*`, `vis_*`) são reenviados no `load*`? App offline → online não perde nada?
4. **Falha silenciosa proibida** — nenhum `catch(e){}` vazio. Todo erro de banco/rede loga (`console.warn`) e, quando afeta o usuário, mostra `toast`. Se algo "não salvou", o usuário PRECISA saber.
5. **Multi-loja** — a feature respeita `filtrarPorLoja()`? Loja específica mostra SÓ os dados daquela loja; "Todas" mostra o grupo. Não vaza dado de uma loja na outra.
6. **Perfis** — gestor / vendas / técnico veem o que devem? Lembre que `go()`/`eGestor()` são guardrails de UI, não de servidor.
7. **Mobile E desktop** — testou nos dois? Nav inferior (mobile) vs sidebar (desktop); PDF não pode sair com a barra de atalhos; foto grande de celular é aceita.
8. **PDF / impressão** — CSS novo de tela NÃO pode estar dentro do `@media print` (e vice-versa). É o bug mais comum aqui.
9. **Auto-update** — mudou algo que o usuário precisa ver na hora? O app se atualiza sozinho via ETag, mas confirme que não quebrou o `index.html` (network-first).
10. **Sintaxe** — validou o JS inteiro antes do commit? (`new Function(script)` via JXA, ou equivalente.)

### Checklist MULTI-TENANT (v2) — obrigatório a cada feature
11. **empresa_id** — todo insert/update leva `empresa_id`? (use os wrappers `dbInsert`/`dbUpdate`/`dbUpsert`, que injetam via `_injetarEmpresa`; nunca insert cru.)
12. **localStorage namespaced** — toda chave passa por `ls`/`lsSet`/`lsDel` (prefixo `fluxa:<EMPRESA_ID>:`)? Nada de `localStorage.setItem` cru para dados de empresa.
13. **RLS** — a feature respeita a RLS? Leituras de lista escopam `.eq('empresa_id', EMPRESA_ID)` (a RLS traz TODAS as empresas do usuário; o `.eq` fixa na ativa).
14. **Portal** — o portal (`#portal/<token>`) continua funcionando só com as RPCs `portal_dados`/`portal_responder_orcamento`? Nenhuma query direta no fluxo do portal.
15. **Sem segredo no cliente** — nenhum token/chave de API (fiscal, IA, service_role) no código do cliente. Só a anon key. Segredos vivem em Edge Function.
16. **Migração aditiva** — a mudança de schema é SÓ aditiva (nova tabela/coluna)? Nunca renomear/apagar/mudar tipo junto com uma feature (rollback tem que rodar com o schema atual).
17. **Feature flag** — feature grande/arriscada está atrás de `flagAtiva('nome')` (empresas.config.flags), ativada 1º na empresa de teste?
18. **Análise via view** — dashboard/análise consulta VIEW agregada (`vw_analise_*`), não baixa tabela inteira pro navegador?

### Quando criar uma feature NOVA, pergunte explicitamente:
- "Que coluna/tabela isso grava? Ela existe?"
- "O que acontece se o banco estiver offline? E se a coluna faltar?"
- "Isso aparece corretamente em TODOS os lugares que leem esse dado (histórico, dashboard, PDF, e-mail, WhatsApp)?"
- "Algum estado fica sujo entre uma operação e outra?"

Se a resposta de qualquer uma for "não sei", **verifique antes de entregar** — não deixe brecha silenciosa.

---

## 🏢 FLUXA V2 — SaaS MULTI-TENANT (pool: 1 banco, N empresas)

**Modelo (v2):** UM deploy + UM banco Supabase servindo **N empresas**, isoladas por **RLS**. Nada de `config.js`, nada de banco por empresa. O v1 (repo `fluxa-app`) continua em produção separado e **não é tocado**. Schema alvo em `setup-v2.sql`.

- **Credenciais:** `SUPABASE_URL` / `SUPABASE_ANON_KEY` são constantes no topo de `app.js` (ponto único). Preencher quando o banco existir. Só a anon key vai no cliente.
- **Isolamento:** toda tabela de dados tem `empresa_id`. A RLS (`empresa_id IN (SELECT minhas_empresas())`) garante que o usuário só acessa linhas das empresas em que é membro (tabela `membros`). `go()`/`eGestor()` continuam sendo guardrails de UI — a segurança real é a RLS.
- **Contexto:** `EMPRESA_ID` (global) é a empresa ativa. `FLUXA_CONFIG` (em memória) e `CFG` vêm de `empresas.config` (jsonb); `LOJAS` vêm da tabela `lojas`. Ver `definirEmpresaAtiva` / `_aplicarContextoEmpresa` / `carregarLojas`. Seletor quando o usuário é membro de >1 empresa.
- **Escrita/leitura:** `dbInsert`/`dbUpdate`/`dbUpsert` injetam `empresa_id` (`_injetarEmpresa`; exceto `empresas`/`membros`/`contadores`). Leituras de lista escopam `.eq('empresa_id', EMPRESA_ID)`.
- **Numeração:** `dbInsertNumerado` usa a RPC `proximo_numero(EMPRESA_ID, tipo)` (contador atômico por empresa). Offline: número provisório local reconciliado no sync.
- **localStorage:** namespaced por empresa via `ls`/`lsSet`/`lsDel` (`fluxa:<EMPRESA_ID>:chave`). Globais: `fluxa_empresa_id`, `sb_*`, prefs de dispositivo.
- **Storage:** uploads em `vistorias-pdf` e `vistorias-fotos` vão para a pasta `${EMPRESA_ID}/…` (a política exige a pasta). Leitura pública mantida.
- **Realtime:** subscriptions com `filter:'empresa_id=eq.'+EMPRESA_ID` (`_rtCfg`); reaplicado ao trocar de empresa. DELETE precisa de `REPLICA IDENTITY FULL` (já no setup).

### Autenticação (Supabase Auth) — 2 camadas
- **Conta (externa):** e-mail/senha (`signInWithPassword`) ou onboarding "Criar minha empresa" (`signUp` + `rpc criar_empresa`). Boot faz `auth.getSession()`; sem sessão mostra a tela de conta.
- **Usuário interno (PIN):** o fluxo antigo de PIN NÃO morreu — vira a etapa seguinte (escolher persona gestor/vendas/técnico dentro da empresa). `authLogout` encerra a conta; `fazerLogout` só troca o usuário interno.

### Arquitetura fiscal (FUTURA — não implementar agora)
Emissão fiscal client-side está **desativada** (`emitirNota` só avisa "em breve"; nenhuma chamada à API fiscal parte do cliente; nenhum `focusnfe_token` no cliente). No multi-tenant a conta fiscal é **única da plataforma** (o token master dá acesso às notas de TODAS as empresas — jamais no cliente). Futuro: emissão via **Edge Function** (token master como secret; valida JWT + membro da empresa; chama a API pelo CNPJ da empresa) + **webhook** de retorno da SEFAZ (outra Edge Function atualiza `notas_fiscais`) + onboarding do **certificado A1** por empresa (enviado direto ao provedor, nunca gravado em tabela legível pelo cliente). Mantidos: tabela `notas_fiscais`, campos fiscais de `lojas` e a UI (só a emissão fica "em breve").

### Versionamento e rollback (deploy único = bug atinge todas as empresas)
- **Branches:** trabalhe sempre em `dev`. `main` é produção (sai o deploy); só recebe merge validado. Rollback = reverter o merge na `main`.
- **Tags:** a cada versão estável, criar tag (`v2.0`, `v2.1`…) para rollback de emergência.
- **Migrações SÓ ADITIVAS:** criar tabela/coluna nova, ok; NUNCA renomear/apagar/mudar tipo junto com uma feature (o código revertido precisa rodar com o schema atual).
- **Feature flags:** `flagAtiva(nome)` lê `empresas.config.flags`. Feature grande nasce atrás de flag: ativa na empresa de teste, depois para todas; bug = desligar a flag no banco, sem deploy.
- **Empresa de teste:** validar toda atualização logado numa empresa "Fluxa Teste" (cadastrada pelo fluxo normal) antes do merge na `main`.

### Portal do cliente (público, sem login) — só RPCs
O portal (`#portal/<token>`) usa **apenas** `rpc('portal_dados',{p_token})` (devolve cliente + orçamentos + OS + vistorias + equipamentos) e `rpc('portal_responder_orcamento',{p_token,p_orc_id,p_aprovar,p_assinatura})`. **Nenhuma query direta** no fluxo do portal (a RLS `authenticated` retornaria vazio). A **reserva de estoque** na aprovação NÃO roda no portal (anon): roda no app do **gestor** ao receber o UPDATE por realtime (`sincronizarReservaOrcamento`, idempotente).

### Camada de inteligência (Analytics + IA futura)
- **Agregação no SQL, nunca no cliente:** views `vw_analise_produtos` (margem/giro/ABC/parados), `vw_analise_financeiro_mensal` (receita×despesa), `vw_analise_orcamentos` (taxa de aprovação/ticket médio/inadimplência), com `security_invoker=true`. Aba **Análises** (só gestor) consulta as views + tabela `insights`. Regra permanente: dashboard consulta view agregada, não baixa tabela inteira.
- **IA generativa (FUTURA):** chave da API de IA (Anthropic) é segredo da PLATAFORMA — jamais no cliente. Edge Function `gerar-insights` (secret; valida JWT + empresa; lê as views; chama o LLM; grava em `insights`), agendada 1x/dia por empresa e/ou sob demanda, com quota por empresa. O app só LÊ `insights`.

### 🤖 Roadmap de IA (documentar; implementar depois — o código de hoje já deixa os dados prontos)
1. **Copiloto de dados (fase 1):** chat onde o gestor pergunta em linguagem natural e um agente LLM responde usando as views/RPCs de analytics como ferramentas (tool use). Edge Function `copiloto` (chave da plataforma como secret; quota mensal por empresa).
2. **Orçamento gerado por IA (fase 2):** vendedor descreve o serviço (voz/texto/foto) e a IA monta o orçamento a partir do histórico da própria empresa. Requisito de dados: `orcamentos.servicos` bem estruturado, itens vinculados a `produto_id` — manter esse padrão.
3. **Manutenção preditiva (fase 3):** cruza `equipamentos` × `vistorias` × OS para prever falha e sugerir OS preventiva. Requisito: vistoria sempre vinculando o equipamento; OS vinculando `agendamento_id`/equipamento — não degradar esses vínculos.
4. **Atendente IA no WhatsApp (fase 4):** agente que responde o cliente final via WhatsApp Business API + Edge Function, usando as RPCs do portal como ferramentas.

Regras permanentes: chave de IA NUNCA no cliente; agente acessa dados SÓ via views/RPCs; custo por uso com quota por empresa; features de IA nascem atrás de flag e viram plano premium. Estratégia: API da Anthropic (créditos pré-pagos), modelo **Haiku** para o rotineiro, prompt caching, insights salvos 1x/dia (não recalculados a cada leitura), spend limit no console. Piloto: flag de IA só na empresa **Fluxa**.

### Empresas piloto do v2 (dados, não código — nada chumbado)
Fluxa (principal, piloto de IA), Fortemp (2 lojas/unidades no mesmo tenant), Aquamotor. No v1 dividiam o mesmo banco (filtro por loja no cliente); no v2 são empresas independentes de verdade. Migração dos dados do v1 → v2 (com `empresa_id` atribuído) é etapa futura, fora do escopo atual.

---

## 📦 ESTOQUE (controle inteligente)

Tabelas: `produtos` e `estoque_movimentos` (id texto `prod_*`/`mov_*`). **Saldo = soma dos movimentos** (ledger), nunca um contador editável. Só gestor edita; carregado no login (`loadEstoque`). `registrarMovimento(...)` é local-first + sync resiliente — **NUNCA** decremente um número, sempre crie um movimento.

**3 números por produto, no contexto da loja ativa:**
- `fisicaProduto(id)` — no depósito (tipos: entrada/saida/ajuste/transf_entrada/transf_saida)
- `reservadoProduto(id)` — comprometido (tipos: reserva/liberacao_reserva)
- `disponivelProduto(id)` = física − reservada. **Negativo = encomenda** (`listaEncomendas()`).
- `saldoProduto(id)` = física (compat).

**Ciclo orçamento → estoque:**
- Aprovar → **reserva** via `sincronizarReservaOrcamento(orc)` (reconciliação idempotente, prefixo `ref='res:orc:<id>'`; cobre reverter/editar/excluir). Chamado em `mudarSt`, `aprovarOrcPortal`, `_recusarOrcPortalConfirmado`, `_excluirOrcConfirmado`, e ao salvar orçamento aprovado. (`sincronizarBaixaOrcamento` é alias.)
- Entregar → **baixa física** via `entregarOrcamento(orc, origem)`: saída + libera reserva (refs `baixa:orc:id:pid` / `libres:...`). Dispara em **OS concluída** (`_entregarPelaOS` no check-out e na vistoria rápida) E no botão manual **"📦 Entregar"** do histórico.
- Item do orçamento vincula produto via `produto_id` (picker `abrirPickerProduto`). Só item com `produto_id` mexe no estoque.

**Multi-loja:** `produtosVisiveis()` = produtos da loja ativa + os com movimento nela (recebidos por transferência). `transferirProduto()` gera 2 movimentos ligados carregando o custo. **CMP:** `recomputarCMP()` recalcula o custo a cada entrada. Ajuste exige motivo.

Campos fiscais no produto (`ncm,cest,cfop_padrao,origem,gtin_ean`) prontos para a futura NF-e.

---

## ⚠️ PROTOCOLO OBRIGATÓRIO — LEIA ANTES DE QUALQUER COISA

Este arquivo é o **canal de comunicação entre todos os devs e instâncias do Claude** que trabalham neste projeto. **O Marcos usa DUAS IAs diferentes que commitam direto na `main`** — então o repositório muda "por baixo" da sua sessão. Para que todos falem a mesma língua, siga estas regras:

### 🔄 SINCRONIZE COM O `origin/main` ANTES DE TUDO (crítico)
Outra IA pode ter commitado desde a última vez. **Nunca trabalhe sobre um estado velho.**
1. **No início da sessão:** `git fetch origin && git log --oneline -5 origin/main`. Se seu working tree divergiu, sincronize: `git reset --hard origin/main` (o trabalho antigo já está no remoto). Confirme os arquivos reais: `index.html` (casca), `app.js` (todo o JS), `styles.css` (todo o CSS).
2. **Antes de cada `push`:** `git push` ou, se rejeitado, `git pull --rebase origin main` e empurre de novo. Nunca force-push.
3. **Se algo parecer "desatualizado" (função/tela que você não reconhece):** provavelmente a outra IA mudou — confie no `origin/main`, não no seu cache. Este mês (jul/2026) o app foi refatorado de single-file para **multi-arquivo**; código single-file antigo NÃO deve voltar.

### Toda sessão de trabalho deve:
1. **Começar sincronizando com o `origin/main`** (acima) e **lendo este arquivo**
2. **Terminar atualizando este arquivo** com tudo que foi feito ou decidido na sessão

### O que sempre atualizar ao final de cada sessão:
- Módulos ou funcionalidades implementadas → mover para a lista de "já implementados"
- Decisões tomadas com o Marcos → registrar em "Decisões" e remover das "Perguntas em aberto"
- SQL novo rodado no Supabase → atualizar a lista de tabelas/colunas
- Bugs corrigidos ou comportamentos alterados → atualizar "Observações importantes"
- Perguntas que surgiram → adicionar em "Perguntas em aberto"

### Como rodar SQL no Supabase direto (sem abrir o painel)

O Claude consegue executar SQL diretamente via Management API **ou via browser com Chrome Extension**:

**Via curl (com Personal Access Token):**
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/lbxwclwzeqqtnwvlxsxs/database/query" \
  -H "Authorization: Bearer [SEU_PAT_AQUI]" \
  -H "Content-Type: application/json" \
  -d '{"query": "SEU SQL AQUI"}'
```
# ⛔ Verificar: o token acima deve ser [SEU_PAT_AQUI], nunca um valor real (sbp_...).
# Se por engano aparecer um token real, não commitar — revogue em:
# https://app.supabase.com/account/tokens
> ⚠️ **NUNCA commitar o PAT aqui.** Gere um novo token em https://app.supabase.com/account/tokens, use na sessão e **não salve no arquivo**.

**Via Chrome Extension (quando o token não funcionar via curl):**
```js
// No javascript_tool com tabId do supabase.com logado:
(async () => {
  const token = JSON.parse(localStorage.getItem('supabase.dashboard.auth.token')).access_token;
  const res = await fetch('https://api.supabase.com/v1/projects/lbxwclwzeqqtnwvlxsxs/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'SEU SQL AQUI' })
  });
  window._r = JSON.stringify(await res.json());
})();
// Depois: window._r
```
> Resposta `[]` = sucesso para DDL. Erros aparecem como objeto JSON com `message`.

> ⚠️ **NUNCA commitar o PAT no CLAUDE.md** — o repositório é público. Use sempre `[SEU_PAT_AQUI]` como placeholder e substitua só localmente na sessão.

#### 🔒 Segredos que NUNCA devem aparecer neste arquivo

| Segredo | Padrão a bloquear |
|---|---|
| Supabase PAT | qualquer token começando com `sbp_` |
| Supabase anon key | JWT começando com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9` |
| EmailJS keys | valores reais de `emailjs_pubkey`, `emailjs_service`, `emailjs_template` |

Use sempre `[PLACEHOLDER]` no arquivo. Substitua localmente na sessão e **não commite**.
Um hook pré-commit bloqueia estes padrões automaticamente (ver `docs/segurança.md`).

### Como deployar
```bash
git fetch origin && git reset --hard origin/main   # sincroniza ANTES (outra IA pode ter commitado)
# ...faça as mudanças em app.js / styles.css / index.html...
git add app.js styles.css index.html sw.js CLAUDE.md
git commit -m "descrição da mudança"
git push                                            # se rejeitado: git pull --rebase origin main && git push
```
> GitHub Pages serve a branch `main` diretamente. Não há build step. Deploy em ~1 min.
> Ao mudar `app.js`/`styles.css` que o usuário precisa ver na hora, **suba `CACHE` em `sw.js`** (`fluxa-vN`).

---

## O que é
Sistema de gestão para empresas de manutenção de piscinas. **Multi-arquivo** (refatorado de single-file em jul/2026), sem framework nem build step:
- **`index.html`** — só a casca HTML (~2.4k linhas): estrutura das páginas + templates de PDF (`pdoc-*`). Carrega `styles.css` e `app.js`.
- **`app.js`** — TODO o JavaScript (~10k linhas). É aqui que se edita comportamento/lógica.
- **`styles.css`** — TODO o CSS (~1.1k linhas), incluindo `@media print` e os estilos `.pd-*` do relatório.
- **`config.js`** — config por empresa (`window.FLUXA_CONFIG`).
Deployed no GitHub Pages (serve a `main` direto, ~1 min).

## URLs
- **Produção:** https://marcosssvinnn.github.io/fluxa-app/
- **Repositório:** https://github.com/marcosssvinnn/fluxa-app (**público** — necessário para GitHub Pages gratuito)
- **Banco de dados:** Supabase — project ref `lbxwclwzeqqtnwvlxsxs` — URL e anon key hardcoded no index.html

> ⚠️ O repositório é **público**. Não commitar dados sensíveis além da anon key do Supabase (que é necessária para o app funcionar).

## Stack
- HTML/CSS/JS puro — sem framework, sem build step. **Multi-arquivo:** `index.html` (casca) + `app.js` (JS) + `styles.css` (CSS)
- Supabase como banco de dados + Realtime sync entre dispositivos
- localStorage como cache offline / fallback (app funciona sem internet)
- EmailJS (`@emailjs/browser@4`) — envio de e-mails automáticos de relatório de vistoria
- Chart.js (`chart.js@4.4.0`) — gráfico de faturamento no dashboard
- PWA com Service Worker (`sw.js`) — instalável no celular. `index.html`/`app.js`/`styles.css` são **network-first**; **suba o número de `CACHE` (`fluxa-vN`) a cada deploy** para forçar todos os aparelhos a atualizarem
- Deploy: `git push` → GitHub Pages auto-deploya em ~1 min

---

## Arquitetura (multi-arquivo)

```
index.html  (~2.4k linhas) — só HTML: <link styles.css> + páginas + templates PDF
  - pdoc-orc, pdoc-os, pdoc-visita (templates de PDF — .pdoc{display:none})
  - page-form (orçamentos), page-os, page-os-history, page-minhas-os,
    page-clientes, page-visitas, page-agendamentos, page-estoque, …
  - <script src="app.js"> no fim
styles.css  (~1.1k linhas) — TODO o CSS
  - @media print: mostra .pdoc.print-active e esconde a UI do app
  - ⚠️ os estilos do relatório (.pd-*) ficam FORA do @media print (globais),
    senão o PDF/nova-aba sai sem formatação. Escondidos por .pdoc{display:none}.
app.js      (~10k linhas) — TODO o JS: boot IIFE, connect Supabase + sync,
             e todas as funções. **É AQUI que se edita comportamento.**
```

> ⚠️ A numeração de linhas muda a cada commit da outra IA — sempre localize por
> `grep -n "function X" app.js`, nunca por número de linha fixo.

**Regra crítica de CSS:** O bloco `@media print` começa em ~linha 275. CSS colocado **dentro** dele só funciona na impressão/PDF. CSS de tela DEVE ficar **antes** dessa linha. Erros de "estilo sumiu" quase sempre são CSS no lugar errado.

---

## As 3 empresas (DECISÃO FINAL — não mudar sem consultar Marcos)

| ID (loja_id) | Nome | Grupo | Técnicos |
|---|---|---|---|
| `fortemp-camboriu` | Fortemp Camboriú | `forthemp` | Marcos, Josimar, Eldecir, Bruno |
| `fortemp-itapema` | Fortemp Itapema | `forthemp` | Marcos, Josimar, Eldecir, Bruno |
| `aquamotor` | Aquamotor | `aquamotor` | Marcos, Bruno |

**Regras:**
- Fortemp Camboriú e Itapema compartilham o mesmo CNPJ (gestão separada, CNPJ único)
- Josimar e Eldecir **não aparecem** em OS/agendamentos da Aquamotor
- Técnico vê **todas as suas OS** consolidadas (sem filtro de empresa)
- **Vistorias são separadas por empresa** (desde 2026-06-23): técnico escolhe a
  empresa no login; gestor/master pela tela de empresa no login + seletor do header.
  Filtro central: `escopoEmpresaMatch()`. Aquamotor não mistura com Forthemp.

```js
const LOJAS = [
  { id:'fortemp-camboriu', nome:'Fortemp Camboriú',  cor:'loja-0', grupo:'forthemp', tecs:['Marcos','Josimar','Eldecir','Bruno'] },
  { id:'fortemp-itapema',  nome:'Fortemp Itapema',   cor:'loja-1', grupo:'forthemp', tecs:['Marcos','Josimar','Eldecir','Bruno'] },
  { id:'aquamotor',        nome:'Aquamotor',          cor:'loja-2', grupo:'aquamotor', tecs:['Marcos','Bruno'] }
];
const GRUPO_FORTHEMP = ['fortemp-camboriu','fortemp-itapema'];
```

---

## Perfis de usuário (4 tipos — atualizado 2026-06-21)

| Perfil | Acesso | Páginas permitidas |
|--------|--------|--------------------|
| `master` | Total + Auditoria + Usuários — acima de gestor | Todas (inclui `auditoria`) |
| `gestor` | Completo — vê tudo da sua empresa/grupo | Todas |
| `vendas` | Vendedor — cria ORC/OS, sem dados financeiros | `form`, `history`, `clientes`, `agendamentos`, `os` |
| `tecnico` | Técnico de campo — executa OS e vistorias | `minhas-os`, `visitas`, `os` |

**Contas individuais criadas no banco (PINs hasheados, não no código):**
- Marcos → `master` (sem loja — acesso total a todas)
- Tamara, Elis → `gestor` (sem loja — todas as lojas do grupo)
- Josimar, Eldecir, Bruno → `tecnico` (loja: `fortemp-camboriu`)
- Seeds antigos `tec_*` desativados no banco.

### Funções de verificação de perfil:
```js
eMaster()   // true se perfil === 'master'
eGestor()   // true se perfil === 'gestor' OU 'master' (master herda acesso de gestor)
eVendas()   // true se perfil === 'vendas'
eTecnico()  // true se perfil === 'tecnico'
isMainGestor() // true se (gestor|master) e sem loja_id na sessão
```

### Controle de acesso em `go(p)`:
```js
const pagesVendas  = ['form','history','clientes','agendamentos','os'];
const pagesTecnico = ['minhas-os','visitas','os'];
if(_vendas  && !pagesVendas.includes(p))  { toast('Acesso não permitido.'); return; }
if(_tecnico && !pagesTecnico.includes(p)) { toast('Acesso não permitido.'); return; }
// master/gestor passam direto
```

### Login — formulário único (atualizado 2026-06-21):
1. **`login-step-users`** — campo "Seu nome" + autocomplete de sugestões + campo "Senha (4 dígitos)"
   - Digitar nome mostra sugestões dos usuários ativos; clicar foca no campo de senha
   - Ao completar 4 dígitos o login é tentado automaticamente
   - Nenhum nome é exibido na tela antes do usuário digitar (privacidade)
2. **`login-step-loja`** — escolha de empresa no login (atualizado 2026-06-23):
   - **master/gestor sem loja_id** (Marcos, Tamara, Elis) → `mostrarSelecaoLojaGestor()`:
     "Todas as unidades" (Forthemp) / cada unidade / **Outras empresas → Aquamotor**.
     `confirmarLojaGestor()` preserva perfil/nome reais (não rebaixa master).
   - **técnico sem loja_id** → `mostrarSelecaoEmpresaTecnico()`: escolhe **Fortemp** ou
     **Aquamotor** (uma empresa por sessão, p/ não misturar vistorias). Guardado em
     `sessao.empresa_tec` + `sessionStorage('fluxa_vis_empresa_tec')`, restaurado em F5.
   - gestor/técnico com loja_id fixa entram direto na sua empresa.

```js
// Cache interno de usuários para autocomplete
let _loginUsersCache = []; // preenchido por renderLoginUsers()
function loginNomeInput(val)       // mostra sugestões ao digitar
function loginEscolherSugestao(id) // seleciona usuário e foca no PIN
```

### Sessão (sessionStorage):
```js
{ perfil: 'master'|'gestor'|'vendas'|'tecnico', loja_id: null|'string-id', nome: 'Marcos',
  empresa_tec?: 'forthemp'|'aquamotor' /* só técnico — empresa da sessão */ }
```

**Persistência de usuários locais:** Usuários criados localmente recebem `id` com prefixo `usr_`. Na próxima conexão com Supabase, `carregarUsuarios()` tenta sincronizá-los. Se falhar, mantém o registro local em `todosUsuarios` — nunca descarta.

**Edição de usuários:** botão ✏️ na lista de Usuários permite editar nome, perfil (promoção/rebaixamento), PIN e empresa. PIN vazio = mantém o atual. Mudança de perfil atualiza acesso imediatamente.

---

## Filtro multi-empresa — `filtrarPorLoja()`

```js
let lojaAtiva = ''; // '' = todas as empresas do grupo ativo

function filtrarPorLoja(lista, campo='loja_id'){
  if(lojaAtiva){
    const loja = getLoja(lojaAtiva);
    if(loja?.grupo === 'forthemp'){
      return lista.filter(o => (o[campo]||'') === lojaAtiva || !o[campo]);
    }
    return lista.filter(o => (o[campo]||'') === lojaAtiva);
  }
  if(isMainGestor())
    return lista.filter(o => GRUPO_FORTHEMP.includes(o[campo]) || !o[campo]);
  return lista;
}
```

**Módulos que já usam `filtrarPorLoja`:**
`renderTabela`, `renderOSTabela`, `renderClientes`, `renderDespesas`, `renderAgLista`, `renderEqGrid`, `osNoPeriodo`, `despNoPeriodo`, `atualizarDash`, `renderProdutividade`

---

## Banco de dados — tabelas no Supabase

| Tabela | O que armazena |
|--------|----------------|
| `orcamentos` | Orçamentos com status, serviços, pagamento, cnpj, nota_interna, loja_id, assinatura_base64 |
| `ordens_servico` | OS com check-in/check-out, fotos, técnico, cnpj, agendamento_id, loja_id, checklist |
| `empresa_config` | Config da empresa: cores, nome, PIN, templates WhatsApp, credenciais EmailJS |
| `clientes` | Clientes com portal_token, cnpj, portal_ativo, loja_id, **email_responsavel** |
| `agendamentos` | Agendamentos recorrentes com periodicidade, loja_id |
| `equipamentos` | Equipamentos com QR Code, garantia, foto, loja_id |
| `despesas` | Despesas de campo dos técnicos com comprovante, loja_id |
| `lojas` | Config por empresa: focusnfe_token, focusnfe_ambiente, iss_aliquota, etc. |
| `usuarios` | Técnicos, vendas, gestores e masters com PIN (SHA-256), perfil, loja_id |
| `notas_fiscais` | NF-e/NFS-e emitidas via Focus NFe |
| `vistorias` | Relatórios de vistoria de manutenção preventiva de piscinas |
| `locais_vistoria` | Planos recorrentes de vistoria (1 linha por local) — **dedicada** desde 2026-06-23; antes ficava em `empresa_config.dados` |
| `auditoria` | Log de ações: login, status ORC, movimentos estoque, OS concluídas, usuários |
| `produtos` | Cadastro de produtos com código, unidade, preço, custo, estoque mínimo, CMP |
| `estoque_movimentos` | Ledger de movimentos: entrada/saida/ajuste/transf/reserva/liberacao_reserva |

### SQL já executado no Supabase (✅ confirmado via API):

```sql
-- ─── Colunas adicionadas ───────────────────────────────────────────────────
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS assinatura_base64 text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checklist text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS fotos jsonb DEFAULT '[]';
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS video_link text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS agendamento_id uuid;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checkin_at timestamptz;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checkout_at timestamptz;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS duracao_min integer;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS email_responsavel text;  -- ✅ NOVO
ALTER TABLE agendamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE equipamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE despesas       ADD COLUMN IF NOT EXISTS loja_id text;

-- ─── Tabelas novas criadas ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lojas (
  id text PRIMARY KEY,
  nome text, cnpj text, razao_social text,
  focusnfe_token text, focusnfe_ambiente text,
  iss_aliquota numeric(5,2), codigo_servico_municipal text,
  cor_primaria text, logo_base64 text,
  ativo boolean DEFAULT true, data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id text PRIMARY KEY,
  nome text, pin text, perfil text DEFAULT 'tecnico',
  loja_id text, loja_nome text,
  ativo boolean DEFAULT true, data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notas_fiscais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id text, orcamento_id uuid,
  tipo text, referencia text,
  numero integer, serie text, chave_acesso text,
  status text DEFAULT 'pendente',
  xml_autorizado text, pdf_danfe_base64 text,
  protocolo text, motivo_rejeicao text,
  data_emissao timestamptz DEFAULT now(),
  data_criacao timestamptz DEFAULT now()
);

-- ─── NOVA: tabela de vistorias ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vistorias (
  id text PRIMARY KEY,
  loja_id text,
  cliente text,
  local text,
  data text,
  hora text,
  tecnico text,
  mes_ref text,
  hora_checkin text,
  hora_checkout text,
  obs_geral text,
  email_responsavel text,
  equipamentos jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- ─── NOVA: tabela dedicada de locais de vistoria (✅ executada 2026-06-23) ────
-- Antes os planos ficavam num array em empresa_config.dados → salvar reescrevia
-- o blob inteiro e dois gestores simultâneos sobrescreviam um ao outro. Agora
-- cada local é sua própria linha. Script: migracao-locais-vistoria.sql.
-- O app detecta a tabela e migra sozinho (loadLocaisRemoto). Fallback legado
-- (empresa_config com read-merge-write) enquanto a tabela não existir.
CREATE TABLE IF NOT EXISTS locais_vistoria (
  id text PRIMARY KEY,
  loja_id text, cliente text, local text,
  email_responsavel text, tecnico text,
  dia_pref text, hora_pref text,
  equipamentos jsonb DEFAULT '[]',
  agendamento_id text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── RLS (já aplicado) ──────────────────────────────────────────────────────
-- Todas as tabelas têm RLS ativo com policy "anon full access" (FOR ALL TO anon)
-- ⚠️ ATENÇÃO: esta policy concede leitura e escrita a QUALQUER pessoa com a anon
-- key (que está no código-fonte público). O controle de acesso acontece APENAS no
-- JS do cliente. Antes de adicionar tabela com dados sensíveis, registrar em
-- "Perguntas em aberto" a necessidade de policy RLS mais restritiva.
-- Tabelas com Realtime: orcamentos, equipamentos, despesas, agendamentos, vistorias, locais_vistoria
```

---

## Módulos já implementados e funcionando

1. **Orçamentos** — criação, edição, duplicar, histórico, filtros, PDF, status, campo Empresa
2. **Ordens de Serviço** — criação, histórico, PDF, fotos (3), vídeo, campo Empresa
3. **Agendamento Recorrente** — visitas recorrentes, check-in/check-out, calendário
4. **Equipamentos + QR Code** — ficha do equipamento, QR abre via hash `#eq/ID`
5. **Despesas de Campo** — técnico registra no celular com foto, gestor aprova
6. **Produtividade** — dashboard por técnico, faturamento, taxa de conclusão, filtro por loja
7. **Portal do Cliente** — link único `#portal/TOKEN`, sem login, cliente aprova orçamentos
8. **Notificações WhatsApp** — templates editáveis com variáveis, botão copiar mensagem
9. **Cadastro de Clientes** — busca por nome/CNPJ, auto-save, edição inline, **campo email_responsavel** e **tipo de local**
10. **Gestão de Usuários** — gestor cria/desativa técnicos, vendas e gestores por empresa
11. **Multi-empresa (3 lojas)** — separação total Forthemp vs Acquamotor; filtro no header; badges coloridos
12. **Login por usuário (3 perfis)** — seleção de avatar + PIN (SHA-256 + salt `fluxa2025`), fluxo 3 passos, lockout 3 tentativas/30s
13. **Perfil Vendas** — acesso restrito a ORC/OS/Clientes/Agenda; sem dados financeiros; criação de OS permitida
14. **Vista do Técnico (Minhas OS)** — OS consolidadas de todas as lojas; botão "Nova Vistoria" integrado
15. **Focus NFe** — modal de emissão NF-e/NFS-e via Focus NFe API (estrutura pronta, aguardando CNPJs)
16. **Busca de clientes** — modal 🔍 no form de ORC, OS e Vistorias; importação batch de clientes de orçamentos
17. **Opções de pagamento avançadas** — boleto parcelado, entrada + boleto, entrada + Pix, cartão parcelado
18. **Quantidade de produto** — campo `qty`; exibe subtotal; **PDF mostra coluna "Qtd × Unit." quando qty > 1**
19. **Fotos no orçamento (até 6)** — grid de 6 slots; cada foto base64; aparece apenas quando há fotos; serve para laudos de equipamentos
20. **Dashboard filtrado por empresa** — `atualizarDash()` usa `filtrarPorLoja()`
21. **Gráfico de faturamento** — Chart.js (últimos 6 meses, responsivo)
22. **Histórico completo do cliente** — modal com orçamentos, OS e total faturado
23. **Checklist de vistoria na OS** — 8 itens padrão, editável, salvo como JSON no Supabase
24. **Assinatura do cliente no portal** — canvas de assinatura, salvo como base64
25. **Relatório Financeiro** — tabela Receita vs Despesas vs Resultado por mês (Produtividade)
26. **Vistorias de Manutenção** — sistema completo (ver seção detalhada abaixo)
27. **E-mail automático de relatório** — EmailJS integrado (ver seção detalhada abaixo)
28. **🆕 Controle de Estoque** — ledger de movimentos, curva ABC, ruptura, CMP, transferência, lista de compras, integração com orçamentos (reserva → baixa → entrega)
29. **🆕 Perfil master + edição de usuários** — 4 perfis (master/gestor/vendas/técnico), edição inline, promoção/rebaixamento, PINs individuais
30. **🆕 Auditoria de acessos** — tabela `auditoria`, `logAcao()` nos pontos-chave, tela de visualização com filtros (⚙️ → 🔐 Auditoria)
31. **🆕 Login por nome + PIN** — formulário com autocomplete substitui grade de avatares; nenhum nome exposto antes do login

---

## 🔍 Módulo de Vistorias de Manutenção (NOVO)

### Acesso
- Visível para **gestor** e **técnico** (não para vendas)
- Nav desktop: botão "🔍 Vistorias"
- Nav mobile: botão "🔍 Vistorias"
- Gear menu: "🔍 Vistorias"
- Tela "Minhas OS" do técnico: botão "Nova Vistoria"
- Página de Agendamentos → botão "🔍 Vistoria" em cada contrato (pré-preenche cliente/local/técnico)

### Página `page-visitas` — abas:
1. **Nova Vistoria** — formulário completo
2. **Histórico** — lista + dashboard + ranking

### Formulário de Nova Vistoria:
- Cliente (autocomplete + modal de busca), local, data, técnico (select), mês de referência
- **E-mail do responsável/síndico** — auto-preenchido do cadastro do cliente, editável por vistoria
- **Check-in com timer** — registra hora de entrada, calcula duração ao fazer check-out
- **Chips de seleção de equipamentos** — escolhe quais existem no local
- **Vistoria por equipamento** — painel colapsável por equipamento com:
  - Botões de status: ✅ Bom / ⚠️ Atenção / 🔴 Crítico / — N/A
  - Campo de observações
  - 3 slots de foto — o celular oferece **Câmera OU Galeria** (sem `capture=`, desde 2026-06-23)
- Campo de observações gerais
- **Salvar** (persiste local + Supabase) + **Gerar PDF** (download via html2pdf)

### Equipamentos disponíveis (configurados em `VIS_EQUIPAMENTOS_DEFAULT`):
```js
{ id:'motobomba',  nome:'Motobomba Principal',    emoji:'⚙️' }
{ id:'mot-aux',    nome:'Motobomba Auxiliar',      emoji:'⚙️' }
{ id:'trocador',   nome:'Trocador de Calor',       emoji:'🌡️' }
{ id:'filtro',     nome:'Filtro',                  emoji:'🔵' }
{ id:'skimmer',    nome:'Skimmer',                 emoji:'💧' }
{ id:'iluminacao', nome:'Iluminação Subaquática',  emoji:'💡' }
{ id:'automacao',  nome:'Automação / Dosador',     emoji:'🤖' }
{ id:'spa',        nome:'Spa',                     emoji:'🛁' }
{ id:'sauna',      nome:'Sauna',                   emoji:'🧖' }
```

### Histórico:
- Cards de resumo: total, qtd c/ Atenção, qtd c/ Crítico
- 🏆 Ranking de técnicos por vistorias no mês filtrado
- Filtro: busca por texto + mês + técnico
- Linha de histórico mostra: data, cliente, local, técnico, nº equipamentos, e-mail, badges de status
- Botões por item: 📧 Reenviar e-mail | 💬 WhatsApp | **✏️ Editar/refazer** | 📥 PDF | ✕ Excluir
- **Filtrado por empresa** (escopoEmpresaMatch) — lista, stats, ranking e alertas só da empresa em foco

### PDF "Relatório de Vistoria":
- Header com branding da empresa (logo, cores)
- Cartão do cliente + endereço
- Grid: técnico, data completa, entrada → saída
- Tabela resumo de todos os equipamentos (status + obs resumida)
- Seções detalhadas por equipamento (só os que não são N/A): status colorido + observações + até 3 fotos
- Observações gerais + espaços de assinatura (responsável / síndico + técnico)

### Persistência:
```js
// localStorage
const LS_VIS = 'fluxa_visitas';          // vistorias feitas
const LS_LOCAIS_VIS = 'fluxa_locais_vistoria'; // planos/locais recorrentes
lsVisLer() / lsVisSalvar(lista)          // vistorias no localStorage

// Vistorias: tabela 'vistorias' (id = 'vis_' + Date.now())
//   loadVistoriasRemoto() faz merge Supabase + local ao conectar
// Locais: tabela dedicada 'locais_vistoria' (1 linha por local) desde 2026-06-23
//   loadLocaisRemoto() = fonte de verdade + auto-migração; saveLocais() upsert
//   por linha; fallback legado (_saveLocaisLegado) = read-merge-write no
//   empresa_config enquanto a tabela não existir. _locaisTabelaOk detecta.
```

### Separação por empresa + idempotência (refatorado 2026-06-23):
- **`escopoEmpresaMatch(loja_id)`** — fonte única de verdade do filtro de empresa,
  usado por `renderLocaisTab` E `renderVisHistorico` (não divergem). Técnico → grupo
  do login; gestor "Todas" → grupo forthemp (Aquamotor não mistura); gestor em loja
  específica → aquela loja. Helpers: `_normLojaId`, `_grupoDaLoja`, `_empresaEmFoco`.
- **`_lojaDaVistoria(loc)`** — etiquetagem única: a vistoria herda a empresa do
  LOCAL/plano (não da sessão do técnico). Era a causa do vazamento Aquamotor→Fortemp.
- **`_vistoriaExistente(local, mês)`** — idempotência: reusa o mesmo registro do
  local no mês em vez de duplicar (nos 3 fluxos: form, modal rápido, detalhada).
- **PDF unificado** — `_gerarPDFVistoria(vis)` (download html2pdf) usado por
  `baixarPDFVistoria`, `abrirVisRelatorio` e `gerarRelatorioVistoria`; `window.print`
  só como fallback de desktop (evita PDF em branco no mobile).
- **`editarVistoria(id)`** — reabre a vistoria no form preservando status/obs/fotos,
  grava no mesmo `visEditId` (preserva a empresa original). Botão ✏️ no histórico.

---

## 📧 E-mail Automático de Relatório (NOVO)

### Tecnologia: EmailJS (`@emailjs/browser@4`)
- CDN carregado no `<head>`: `https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js`
- 200 e-mails/mês grátis
- Configuração em **Empresa → E-mail Automático de Vistoria**

### Campos de configuração (salvos em `CFG`):
```js
CFG.emailjs_pubkey   // Public Key (User ID) do EmailJS
CFG.emailjs_service  // Service ID (ex: 'service_xxxxxxx')
CFG.emailjs_template // Template ID (ex: 'template_xxxxxxx')
```

### Variáveis disponíveis no template EmailJS:
```
{{to_email}}     — e-mail do responsável
{{to_name}}      — nome do cliente
{{empresa}}      — nome da empresa
{{tecnico}}      — técnico responsável
{{mes_ref}}      — mês de referência (ex: "maio de 2026")
{{data_visita}}  — data da vistoria (ex: "06/05/2026")
{{hora_checkin}} — horário de entrada
{{hora_checkout}} — horário de saída
{{resumo}}       — lista de equipamentos com status e observação
{{obs_geral}}    — observações gerais
{{status_geral}} — "✅ Tudo em ordem" | "⚠️ Verificar pontos" | "🔴 Ação necessária"
{{tel_empresa}}  — telefone da empresa
```

### Fluxo automático:
1. Técnico salva a vistoria com e-mail preenchido
2. Se EmailJS configurado → envia automaticamente
3. Feedback: "📨 Enviando…" → "✅ E-mail enviado para sindico@..." ou erro
4. Botão **📧** no histórico → reenvio manual de qualquer vistoria

### Funções:
```js
emailJSConfigurado()         // true se os 3 campos estão preenchidos no CFG
initEmailJS()                // inicializa com CFG.emailjs_pubkey (chamado no boot e ao salvar CFG)
enviarEmailVistoria(vis)     // envia e-mail com dados da vistoria; retorna Promise<boolean>
reenviarEmailVistoria(id)    // busca vistoria no localStorage e reenvia
testarEmailJS()              // envio de teste com prompt para e-mail destino
```

### E-mail do responsável no cadastro de clientes:
- Campo `email_responsavel` no formulário de cliente
- Campo `tipo` (Residência / Condomínio / Hotel / Clube / Comercial)
- Ao selecionar cliente na vistoria → e-mail auto-preenchido do cadastro
- Editável por vistoria individualmente

---

## Orçamentos — recursos especiais

### Fotos (até 6) para laudos:
```js
let fotosB64 = []; // array de até 6 base64 strings

renderFotosOrcSlots()     // renderiza grid 3x2 de slots na tela
carregarFotoOrc(inp, idx) // carrega foto no índice
removerFotoOrc(idx)       // remove foto do índice
```
- Grid aparece na seção "Fotos" do formulário de orçamento
- No PDF: aparece APENAS quando há fotos (seção condicional)
- Colunas no grid PDF ajustadas automaticamente: 1 foto → 1 col, 2-4 → 2 col, 5-6 → 3 col
- Backward compat: registros antigos com `foto_base64` (string) são convertidos para array

### Preço unitário no PDF:
```js
// Quando algum serviço tem qty > 1, o cabeçalho muda:
// Coluna normal: "#  |  Descrição  |  Valor"
// Com qty:       "#  |  Descrição  |  Qtd × Unit.  |  Total"
const temMulti = d.svcs.some(s=>(parseInt(s.qty)||1)>1);
```

---

## Padrões de código

### Variáveis globais principais
```js
let db, dbOk=false;          // conexão Supabase
let CFG = {...CFG_DEF};      // configurações da empresa
let todosOrc = [];           // orçamentos em memória
let todosOS = [];            // OS em memória
let todosEq = [];            // equipamentos em memória
let todasDesp = [];          // despesas em memória
let lojaAtiva = '';          // empresa ativa no filtro ('' = todas do grupo)
let visEquipSelecionados = [];// ids de equipamentos ativos na vistoria em edição
let visEquipDados = {};      // { id: { status, obs, fotos[] } } da vistoria em edição
```

### Funções utilitárias
```js
gV('id')          // pega valor de input por id
setV('id', val)   // define valor de input
ls('key')         // localStorage.getItem
lsSet('key', val) // localStorage.setItem
toast('msg')      // notificação temporária
go('pagina')      // navegação entre páginas (com controle de acesso por perfil)
brl(valor)        // formata em R$ (ex: brl(150) → "R$ 150,00")
esc(str)          // escapa HTML (SEMPRE usar ao renderizar dados do usuário)
getLoja(id)       // retorna objeto da LOJAS por id
getLojaNome(id)   // retorna nome legível da loja
filtrarPorLoja(lista) // filtra por empresa ativa — USAR SEMPRE
isMainGestor()    // true se gestor principal (sem loja_id na sessão)
getSessao()       // { perfil, loja_id, nome } ou null
eMaster()         // true se perfil === 'master'
eGestor()         // true se perfil === 'gestor' OU 'master'
eVendas()         // true se perfil === 'vendas'
eTecnico()        // true se perfil === 'tecnico'
logAcao(acao, detalhe) // registra no log de auditoria (local + Supabase async)
```

### Navegação entre páginas
```js
go('form')          // novo orçamento
go('history')       // histórico orçamentos
go('os')            // nova OS
go('os-history')    // histórico OS
go('minhas-os')     // OS consolidada do técnico (só técnico)
go('clientes')      // cadastro clientes
go('equipamentos')  // equipamentos + QR
go('agendamentos')  // agendamentos recorrentes
go('visitas')       // vistorias de manutenção (gestor + técnico)
go('despesas')      // despesas de campo
go('produtividade') // relatório de produtividade
go('empresa')       // configurações da empresa
go('usuarios')      // gestão de usuários (só gestor/master)
go('auditoria')     // log de auditoria (só gestor/master)
go('estoque')       // controle de estoque (só gestor)
```

### localStorage keys
- `fluxa_orcamentos` / `fluxa_orc_data` — cache de orçamentos
- `fluxa_clientes_full` — cache de clientes
- `fluxa_eq` — cache de equipamentos
- `fluxa_desp` — cache de despesas
- `fluxa_usuarios` — cache de usuários/técnicos
- `fluxa_visitas` — cache de vistorias de manutenção
- `fluxa_produtos` — cache de produtos do estoque
- `fluxa_mov_estoque` — cache de movimentos de estoque (ledger)
- `fluxa_auditoria` — cache local do log de auditoria (últimos 500 registros)
- `empresa_cfg` — configurações da empresa (inclui emailjs_pubkey/service/template)
- `sb_url`, `sb_key` — credenciais Supabase

### Autenticação — PIN
```js
// Hash: SHA-256 com salt 'fluxa2025'
// Armazenado: hash hex em usuario.pin
// Retrocompatível: PINs antigos sem hash funcionam (comparação direta)
// Lockout: 3 tentativas erradas → 30s bloqueado
```

> **⚠️ Candidata a remoção:** a linha de retrocompatibilidade com PIN em texto plano em `pinValido()` deve ser removida assim que confirmado que nenhum usuário ainda usa PIN legado. Verificar com Marcos antes de remover. Registrado como pendência em "Perguntas em aberto".

### Salvamento de dados — padrão local-first
```js
lsOrcUpsert(rec);        // 1. salva local imediatamente
todosOrc.unshift(rec);   // 2. atualiza memória
db.from('tabela')...     // 3. sincroniza com BD em background sem bloquear UI
```

### Loja_id em novos registros — OBRIGATÓRIO
```js
loja_id: gV('orc-loja') || lojaAtiva || 'fortemp-camboriu'
// Nunca gravar loja_id: null em registros novos
```

### Fotos — limite e formato
```js
const FOTO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB por foto (compressImage reduz antes de salvar)
// Armazenadas como base64 diretamente no banco (sem Supabase Storage)
// OS: array osFotos[3] (slots 0,1,2)
// Orçamento: array fotosB64[] (até 6 slots)
// Vistoria: por equipamento, até 3 fotos each (visEquipDados[id].fotos[])
```

---

## CSS — variáveis e classes principais
```css
--c1: #F07820    /* laranja — cor primária */
--c2: #2B3244    /* azul escuro — cor secundária */
--r: 12px        /* border-radius padrão */

/* Layout */
.wrap            /* container: max-width 1200px, padding 22px 14px 80px */
.card            /* card branco com sombra */
.ct              /* título de seção (laranja, uppercase) */
.row / .row.f1/f3/f4  /* grids de 2/1/3/4 colunas */
.fl              /* field wrapper com label */
.btn-primary     /* botão laranja */
.tb              /* botão de ação na tabela */
.mob-nav         /* bottom nav mobile (<680px) */

/* Vistorias (NOVO) */
.vis-equip-block      /* bloco colapsável por equipamento */
.vis-equip-block.status-bom/atencao/critico  /* borda colorida por status */
.vis-equip-hdr        /* cabeçalho clicável do bloco */
.vis-equip-body       /* corpo colapsável (.open = visível) */
.vis-status-btn       /* botões Bom/Atenção/Crítico/N/A */
.vis-status-btn.sel-bom/atencao/critico/na  /* estado selecionado */
.vis-foto-slot        /* slot de foto 3x por equipamento */
.vis-chip             /* chip de seleção de equipamento (.on = selecionado) */
.vis-history-item     /* linha no histórico de vistorias */

/* Multi-loja */
.loja-badge      /* badge colorido de empresa */
.loja-0/1/2      /* laranja/azul/verde */
.loja-select     /* dropdown de empresa no header */

/* Checklist OS */
.chk-list / .chk-item / .chk-item.ok
.chk-obs-inp     /* visível só quando checked */

/* Fotos orçamento */
.fotos-orc-grid  /* grid 3 colunas de slots */
.fotos-orc-slot / .fotos-orc-slot.filled
.fotos-orc-rm    /* botão ✕ remover (display:none → flex quando filled) */
```

---

## Realtime Sync
```js
// Tabelas com sync automático:
orcamentos, equipamentos, despesas, agendamentos

// Carregadas ao conectar:
clientes           → carregarClientesRemoto()
empresa_config     → carregarCFGremoto()
usuarios           → carregarUsuarios()
vistorias          → loadVistoriasRemoto()   ← NOVA
```

---

## Padrões obrigatórios de código

### ⚠️ Controle de acesso — o que `go()` e `eGestor()` NÃO fazem

As funções `go()`, `eGestor()`, `eVendas()`, `eTecnico()` e `aplicarPermissoesPerfil()` são **guardrails de UI** — escondem botões e bloqueiam navegação, mas **não protegem dados no servidor**.

Toda query ao Supabase usa a anon key pública com policy `FOR ALL TO anon`. Qualquer pessoa com a anon key pode ler/escrever qualquer tabela via REST, independentemente do JS.

**Consequências práticas:**
- Não confie em `eGestor()` para proteger dados financeiros — use-a só para UI
- Não exponha dados sensíveis em variáveis JS globais acessíveis pelo console
- Nova feature que exige isolamento real de dados precisa de RLS server-side → registrar em "Perguntas em aberto"
- **Bug conhecido corrigido em 2026-05-06:** `eGestor()` retornava `true` quando sessão era nula

### Tratamento de erros — proibido silenciar

`catch(e){}` vazio é **proibido** em qualquer função que acesse Supabase, localStorage ou envie e-mail. Use no mínimo:

```js
catch(e){ console.warn('[nomeDAFunção]', e?.message||e); }
```

Para operações com feedback ao usuário (salvar OS, enviar e-mail):
```js
catch(e){
  console.warn('[salvarOS]', e?.message||e);
  toast('Erro ao salvar. Tente novamente.');
}
```

Nunca exibir `e.message` diretamente ao usuário — pode vazar stack trace ou schema interno.

### Diálogos nativos — proibidos

`window.confirm()`, `window.alert()` e `window.prompt()` são **proibidos** em produção:
- Bloqueados silenciosamente em PWA/WebView Android
- Não podem ser estilizados
- Bloqueiam a thread JS

**Substitutos:**
- Confirmações destrutivas → função `confirmar(titulo, desc, callback)` já existente no app
- Inputs simples → campo no modal da feature
- Notificações → `toast('msg')`

### Auto-save de rascunho em formulários longos

Formulários com mais de 3 campos editáveis devem salvar estado em `localStorage` durante o preenchimento, **antes do submit**:

```js
// Escuta mudanças com debounce
formEl.addEventListener('input', () => { salvarRascunho('os'); });
// Ao abrir o formulário
restaurarRascunho('os');
// Ao salvar com sucesso
limparRascunho('os');
```

Funções `salvarRascunho(tipo)`, `restaurarRascunho(tipo)` e `limparRascunho(tipo)` já existem no app.
Chaves usadas: `fluxa_draft_orc`, `fluxa_draft_os`, `fluxa_draft_vis`.

Adicionar `beforeunload` como fallback:
```js
window.addEventListener('beforeunload', e => { if(formDirty){ e.preventDefault(); } });
```

### Consistência entre formulários

Todo formulário novo deve:

1. **Pré-preencher data com hoje** em `go('[modulo]')` ou `initForm()`:
   ```js
   setV('modulo-data', new Date().toISOString().slice(0,10));
   ```
2. **Campo técnico como `<select>`** — nunca `<input type="text">` livre. Usar `populaTecSelects()` ou equivalente. Inconsistências de nome fragmentam relatórios.
3. **Campos obrigatórios marcados** com `required` no HTML e classe `req` no label (`.req::after { content: ' *'; color: var(--red); }`).

### Versão das dependências CDN — sempre exata

CDN URLs devem usar versão exata, nunca range de versão maior:
```html
<!-- ✅ -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.3/dist/umd/supabase.min.js">

<!-- ❌ proibido — pode receber atualização automática -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">
```

Versões atuais (última verificação 2026-05-06):
- `@supabase/supabase-js`: `2.105.3` (com SRI sha384)
- `@emailjs/browser`: `4.x` — fixar sub-versão na próxima atualização
- `chart.js`: `4.4.0` ✓

---

## Observações importantes de UX/comportamento
- Header `position:fixed` height 56px → `body { padding-top: 56px }`
- **CSS no lugar errado** é o bug mais comum — nunca colocar CSS de tela dentro do `@media print`
- iOS: inputs precisam de `font-size:16px` para não dar zoom automático
- Fotos armazenadas como base64 diretamente no banco (sem Supabase Storage)
- QR Code gerado via `api.qrserver.com` — sem biblioteca local
- Hash routing: `#portal/TOKEN` abre portal do cliente, `#eq/ID` abre ficha do equipamento
- Service Worker cacheia o app shell (cache `fluxa-v2`) para funcionar offline
- Técnico ao fazer login → vai direto para `minhas-os`
- Gestor ao fazer login → vai para `history`
- Vendas ao fazer login → vai para `form`
- `lojaAtiva` é volátil (não persiste entre sessões) — gestor sempre começa com "Todas"
- Inputs de valor monetário: `type="text"` com `inputmode="decimal"`
- **Usuários locais** (prefixo `usr_`) são sincronizados no próximo boot com BD; se sync falhar, são preservados

#### Requisitos mínimos de acessibilidade (não regredir)

A cada nova tela ou componente, verificar:

- **Foco visível:** nunca usar `outline: none` sem substituto. Padrão aprovado: `:focus-visible { outline: 2px solid var(--c1); outline-offset: 2px; }`
- **Toast:** manter `role="alert" aria-live="assertive"` no elemento `#toast`
- **Botões de fechar modal:** sempre com `aria-label="Fechar"`
- **Alvos de toque:** min. 44×44px em qualquer botão visível em mobile (`min-width:44px; min-height:44px`)
- **Página ativa na nav:** atualizar `aria-current="page"` em `go(p)`
- **Navegação bloqueada:** se `go()` retornar por falta de permissão, chamar `toast('Acesso não permitido.')` antes do `return`

Checklist completo WCAG: `docs/acessibilidade.md`

---

## Próxima fase — ainda pendente

### Focus NFe — Módulo 7 (estrutura pronta, aguardando dados)
- Modal de emissão já existe no HTML/JS
- Municípios: Camboriú-SC (IBGE 4203204) e Itapema-SC (IBGE 4208450)
- **Pendente:** CNPJs reais das 3 empresas + tokens Focus NFe

### Melhorias futuras mapeadas (não implementadas)
- Configuração de equipamentos por cliente (quais equipamentos tem no local, salvo no cadastro do cliente)
- Notificação automática de vistoria por WhatsApp (além do e-mail)
- Relatório mensal consolidado de vistorias por cliente (PDF multi-visita)

---

## ⚠️ REGRA DE OURO — gravar coluna nova no Supabase

**Antes de adicionar QUALQUER campo novo a um `INSERT`/`UPDATE`, confirme que a coluna existe no banco.** O Supabase rejeita a operação INTEIRA se uma coluna não existir (erro `42703` ou `PGRST204`) — e, se o erro for ignorado, o registro **para de sincronizar sem avisar** (fica só no localStorage). Isso já derrubou orçamentos (`origem_cliente`), OS (`checkin_at`) e vistorias/agendamentos (`local_id`).

**Sempre use os wrappers resilientes (nunca `db.from().insert()` cru para gravar):**
```js
await dbInsert('tabela', payload);              // insert resiliente
await dbUpdate('tabela', payload, 'id', idVal); // update resiliente
```
Eles detectam a coluna ausente, removem do payload e reenviam, logando aviso. `orcSyncInsert/orcSyncUpdate` delegam a eles.

**Conferir schema real (anon key, leitura):**
```bash
curl "https://lbxwclwzeqqtnwvlxsxs.supabase.co/rest/v1/TABELA?select=COLUNA&limit=1" \
  -H "apikey: <anon>" -H "Authorization: Bearer <anon>"
# "...does not exist" = coluna falta → rodar ALTER TABLE e atualizar o SQL de setup
```

### Colunas REAIS confirmadas (auditoria 2026-06-13)
- `ordens_servico`: check-in/out são **`checkin_time` / `checkout_time`** (timestamptz), NÃO checkin_at/checkout_at.
- `vistorias.local_id` e `agendamentos.local_id`: **ainda NÃO existem** no banco de produção (código grava via wrapper resiliente; rodar ALTER para persistir).
- `orcamentos.origem_cliente`: criada em 2026-06-13. ✅

### SQL pendente de rodar no Supabase (produção)
```sql
ALTER TABLE vistorias    ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS local_id text;
```
Sem isso, vistorias/planos sincronizam SEM o vínculo local_id (degradado, mas não perdem o registro).

---

## Sessão 2026-07-18 — banco v2 conectado + pré-login neutro (fim da TDZ)

- **Credenciais Supabase v2 preenchidas** (projeto `auoklaiffalbdgazrbdu`) em `app.js` (`SUPABASE_URL`/`SUPABASE_ANON_KEY`) — commit `9ccd7aa` (feito pela outra guia). Repo v2 = `github.com/marcosssvinnn/FluxaSaas-`.
- **Pré-login neutro — parte 2 (bug de cor residual).** A outra guia já tinha corrigido a *lógica* (`_estaPreLogin()` passou a depender só de `authUser`, não do `EMPRESA_ID` restaurado do cache) — commit `b039d8f`. Mas a **cor de destaque da empresa (`--c1`) ainda vazava** na tela de conta.
  - **Causa:** `resetMarcaSaaS()`/`aplicarCFG()` rodam cedo no boot e acessavam `const SAAS_C1` antes da sua declaração (~l.1562) → **Temporal Dead Zone**. O erro caía no `catch` (`Cannot access 'SAAS_C1' before initialization`) e abortava o reset ANTES de setar a cor neutra; o `--c1` ficava com a cor da empresa vinda do cache.
  - **Fix:** `const SAAS_C1/SAAS_C2` movidas para o topo do arquivo (junto de `SUPABASE_*`), antes de qualquer uso no boot. Commit `2ebc3b4`. `sw.js` v13 → **v14**.
  - **Validado ao vivo** (localhost:8778, `EMPRESA_ID` em cache + sem sessão de conta): `--c1 #F07820`, título/marca "Fluxa", logo escondida, **sem warning de TDZ no console**.
- **Lição p/ o protocolo de verificação:** validar branding testando o **boot real** (recarregar a página), não só chamando as funções manualmente pós-boot — a TDZ só aparece na ordem de execução do boot, e some se a função for chamada depois que os `const` já inicializaram.

---

## Sessão 2026-06-13 — auditoria de schema + correções de sync

- **Auditoria completa** das colunas gravadas vs reais (todas as tabelas). 4 brechas da mesma classe encontradas e corrigidas:
  - `orcamentos.origem_cliente` (coluna criada + wrapper)
  - `ordens_servico` check-in/out: código corrigido para `checkin_time/checkout_time`
  - `vistorias.local_id` e `agendamentos.local_id`: wrapper resiliente + SQL pendente
- **Wrappers `dbInsert`/`dbUpdate`** com detector `_colunaFaltante` (testado contra 42703 e PGRST204).
- **Recuperação automática**: `loadHist` reenvia orçamentos `local_*` presos; `loadVistoriasRemoto` reenvia vistorias presas.
- **Auto-update por ETag** (não depende mais de bumpar sw.js); separação estrita por loja em `filtrarPorLoja`; origem no histórico (badge) e placar de leads por categoria no dashboard.

## Sessão 2026-06-11 — mudanças desta sessão

1. **Vistorias** — fluxo plano→vistoria: botão "🔍 Fazer Vistoria" abre form completo pré-preenchido (`iniciarVistoriaPlena`); check-out automático ao salvar/gerar PDF (`autoCheckoutSeNecessario`); relatório PDF redesenhado (stats row, duração, fotos 2 colunas com legenda); botão 📥 baixa PDF via html2pdf.js (`baixarPDFVistoria`); e-mail enviado direto sem geração de PDF inline (era a causa de falha de envio).
2. **Origem do cliente (NOVO, obrigatório)** — select `origem-cli` no form de orçamento com 7 opções + "Outro" texto livre; validação bloqueia salvar/gerar PDF; coluna `origem_cliente` em `orcamentos`; card "📣 Origem dos Clientes" no dashboard (`renderOrigemDash`); autocomplete de cliente da base pré-sugere "Já é cliente".
3. **Mobile** — botão "🔓 Trocar usuário" no fim da sidebar (acessível pelo ☰ Mais).
4. **Bugs corrigidos na revisão geral:**
   - `novoOrc()` usava ids errados `desc`/`disc-tp` → desconto nunca era limpo ao criar novo orçamento (ids corretos: `disc-v`/`disc-t`)
   - `abrirOrc()` não carregava o desconto salvo → editar e salvar apagava o desconto
   - `novaOS()` não limpava campos de texto nem `osSvcs` → dados da OS anterior vazavam
   - Rascunho de OS nunca era limpo após salvar (agora `limparRascunho('os')` no `gerarOSPDF`)
   - `gerarPDF()` de orçamento não limpava rascunho
   - Rascunho do form: `gV('tel')` → `tel-cli`; chave `nota_interna` → `nota-interna` (campos nunca restaurados)
   - Botão "＋ Cadastrar Cliente" do estado vazio chamava `abrirFormCliente()` (inexistente) → `mostrarFormCliente()`
   - Falha ao salvar OS no banco agora mostra toast (antes só "#???" silencioso)

### ⚠️ SQL PENDENTE de rodar no Supabase:
```sql
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS origem_cliente text;
```
Sem essa coluna, o INSERT em background falha e o orçamento fica salvo apenas localmente.

### Storage pendente (para link de PDF no e-mail, opcional):
Bucket `vistorias-pdf` público + policies (instruções na tela Empresa → E-mail Automático).

---

---

## 📦 Controle de Estoque (implementado 2026-06-14 / 2026-06-21)

### Modelo de saldo (ledger):
- **Física** = `fisicaProduto(id)` — tipos físicos: `entrada/saida/ajuste/transf_entrada/transf_saida`
- **Reservada** = `reservadoProduto(id)` — tipos: `reserva/liberacao_reserva`
- **Disponível** = física − reservada. Negativo = encomenda/backorder (nunca bloqueia venda)
- `saldoProduto(id)` = física (compat). `disponivelProduto(id)` = disponível.

### Ciclo orçamento → estoque:
1. **Aprovar orçamento** → `sincronizarReservaOrcamento(orc)` reserva produtos (idempotente, ref `res:orc:<id>`)
2. **Concluir OS / botão Entregar** → `entregarOrcamento(orc, origem)` baixa física + libera reserva (refs `baixa:orc:id:pid` / `libres:orc:id:pid`)
3. **Reverter/excluir** → cancela reserva automaticamente

### Funções-chave:
```js
registrarMovimento({produto_id, tipo, quantidade, custo_unit, motivo, ref, lojaId})
sincronizarReservaOrcamento(orc)  // reconciliação idempotente de reserva
entregarOrcamento(orc, origem, qtyMap) // baixa física na entrega
transferirProduto(pid, deLoja, paraLoja, qty, custo, motivo) // transf entre unidades
recomputarCMP()           // recalcula custo médio ponderado a cada entrada
curvaABC()                // classifica produtos A/B/C por saída
listaEncomendas()         // produtos com disponível < 0
diasParaRuptura(pid)      // previsão de ruptura baseada em giro
```

### Regras importantes:
- **NUNCA** decremente um número de saldo — sempre crie um movimento
- `registrarMovimento` é local-first + sync assíncrono em background
- Auditoria: só movimentos físicos são logados (reserva/liberação são internos)
- Produtos filtrados por `produtosVisiveis()` — loja ativa ou que tem movimentos dela

---

## 🔐 Auditoria de Acessos (implementado 2026-06-21)

### Pontos monitorados:
| Ação | Onde é disparado |
|------|-----------------|
| `login` | `fazerLogin()` ao autenticar com sucesso |
| `orcamento_criado` | `gerarPDF()` ao criar novo orçamento |
| `orcamento_status` | `mudarSt()` ao alterar status |
| `orcamento_excluido` | `_excluirOrcConfirmado()` |
| `estoque_mov` | `registrarMovimento()` (só físicos) |
| `os_concluida` | `_fazerCheckoutConfirmado()` |
| `usuario_criado` | `salvarUsuario()` — novo usuário |
| `usuario_editado` | `salvarUsuario()` — edição |
| `usuario_removido` | `_excluirUsuarioConfirmado()` |

### Funções:
```js
logAcao(acao, detalhe)  // registra local + async no Supabase
lsAuditLer()            // lê localStorage ('fluxa_auditoria')
lsAuditSalvar(lista)    // salva (máx 500 registros)
loadAuditoria()         // carrega + merge Supabase; preenche filtro de usuários
renderAuditoria()       // renderiza a tabela com filtros
```

### Schema da tabela `auditoria`:
```sql
CREATE TABLE IF NOT EXISTS auditoria (
  id text PRIMARY KEY,
  usuario text, perfil text,
  acao text,    -- 'login' | 'orcamento_status' | 'estoque_mov' | 'os_concluida' | etc.
  detalhe text,
  loja_id text,
  data timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aud_data ON auditoria(data DESC);
```
RLS: `anon full access` (igual às demais tabelas).

---

## Sessão 2026-06-21 — Gestão de usuários, auditoria, novo login

### O que foi implementado:
1. **Perfil `master`** — novo nível acima de gestor. `eGestor()` agora retorna `true` para master também. `isMainGestor()` aceita master sem loja. Botão de auditoria visível só para gestor/master.
2. **Edição de usuários** — botão ✏️ na lista; campo PIN vazio = mantém PIN atual; mudança de perfil atualiza acesso imediatamente. `_usrEditId` controla se é create ou update.
3. **Auditoria** — tabela `auditoria` + `logAcao()` + página `/auditoria` com filtros por ação e usuário. Local-first (localStorage, max 500) + sync async.
4. **Contas individuais criadas via API** (PINs hasheados SHA-256+`fluxa2025`, não no código):
   - Marcos (master), Tamara/Elis (gestor), Josimar/Eldecir/Bruno (técnico, loja: fortemp-camboriu)
   - Seeds antigos (`tec_marcos` etc.) desativados no banco.
5. **Login por nome + PIN** — substituiu grade de avatares. Campo de nome com autocomplete; 4 dígitos → login automático. Nenhum nome exposto antes do usuário digitar.
6. **setup.sql atualizado** com tabela `auditoria`, índice e RLS.

### SQL rodado no Supabase nesta sessão:
```sql
-- Tabela de auditoria (adicionada ao setup.sql e rodada via API Python)
-- (inserida via INSERT da API — tabela criada na próxima empresa nova via setup.sql)
-- Para banco existente (Forthemp), rodar manualmente:
CREATE TABLE IF NOT EXISTS auditoria (
  id text PRIMARY KEY,
  usuario text, perfil text,
  acao text, detalhe text, loja_id text,
  data timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aud_data ON auditoria(data DESC);
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access" ON auditoria;
CREATE POLICY "anon full access" ON auditoria FOR ALL TO anon USING (true) WITH CHECK (true);
```

---

## Sessão 2026-06-21 — Usabilidade, estabilidade e estorno de estoque

### Ajustes de usabilidade (verificados visualmente no preview):
1. **Toast mobile** — toast sobrepunha a barra de navegação inferior. Corrigido com `@media(max-width:680px){ .toast{ bottom:72px } }`.
2. **Campo de busca** — largura aumentada de `180px` → `240px`.
3. **Menu engrenagem** — 8 itens duplicados removidos; mantidos apenas: Dados da Empresa, Usuários, Auditoria, Sair.
4. **Card Técnicos (setup)** — substituído por card informativo com botão "Gerenciar Usuários →"; `<textarea id="cfg-tecnicos">` mantido oculto para compatibilidade JS.
5. **Rascunho (form)** — indicador visual "💾 Rascunho salvo às HH:MM" aparece quando há cliente preenchido.
6. **Autocomplete de nome no login** — mínimo 2 caracteres antes de mostrar sugestões (era 1).
7. **Ícone "Minhas OS"** na nav mobile: `📋` → `🗂️` (diferencia de OS avulsa).

### Estabilidade (ponto 5 e 6 da análise de sustentabilidade):
8. **Libs vendorizadas (`libs/`)** — 4 bibliotecas externas agora hospedadas localmente no repositório, eliminando dependência de CDN:
   - `libs/supabase.min.js` (193 KB, v2.105.3)
   - `libs/emailjs.min.js` (3.8 KB, v4)
   - `libs/html2pdf.bundle.min.js` (885 KB, v0.10.1)
   - `libs/chart.umd.min.js` (200 KB, v4.4.0)
   - SW atualizado de `fluxa-v4` → `fluxa-v5`; URLS pré-cache atualizadas para `libs/`.
9. **Error boundary global** — `window.onerror` captura erros de JS em `index.html` e exibe tela amigável "Algo deu errado" com detalhe do erro + botão "🔄 Recarregar o app" + "Seus dados estão salvos — nada foi perdido." em vez de página em branco. Não captura erros de rede/Supabase (filtro por `src`).

### Estoque — estorno ao excluir orçamento:
10. **`excluirOrc` agora pergunta sobre estorno** quando o orçamento teve saída física de estoque registrada:
    - **Sem saída** → exclui diretamente (sem pergunta adicional).
    - **Com saída** → abre 2º modal "Estornar estoque?" listando os produtos:
      - "Confirmar" → `_estornarSaidasOrc()` registra `entrada` para cada produto com motivo "Estorno — cancelamento orçamento #XXX" (rastreável no histórico de estoque).
      - "Não estornar" → exclui sem alterar o estoque.
    - Comportamento correto: apenas **reservas** são sempre liberadas na exclusão; saídas físicas exigem decisão explícita do usuário.

### Ciclo completo testado e validado:
Criar orçamento → Aprovar → Reservar estoque → Gerar OS → Entregar (baixa física) → Excluir com estorno → estoque volta ao valor correto.

---

## Sessão 2026-06-22 — Performance e robustez do módulo de estoque

### O que foi feito:

#### Limpeza de dados fictícios
- Produtos de simulação (`gerado de cloro 500`, `Motobomba Syllent 1 cv`) e as 18 movimentações de teste foram removidos do localStorage via `preview_eval`. Estoque limpo para uso real.

#### Análise de confiabilidade (resultado: processo está correto)
- Modelo ledger imutável ✅ — nenhum movimento é editado, só acrescentado
- `sincronizarReservaOrcamento` é idempotente ✅ — pode chamar várias vezes sem duplicar reservas
- Refs rastreáveis por orçamento (`baixa:orc:ID:prodID`) ✅ — auditoria e estorno funcionam
- Ciclo completo aprovado → reserva → baixa → estorno testado e validado

#### Performance — cache de saldo (`_getSaldoCache`)
- **Problema:** `fisicaProduto()` e `reservadoProduto()` varriam TODO `todosMovEstoque` a cada produto durante `renderEstoque()`. Com 50 produtos e 500 movimentos = 100 varreduras do array.
- **Solução:** cache `_getSaldoCache()` — uma única varredura que computa físico e reservado de TODOS os produtos de uma vez. Invalidado automaticamente por `_invalidarSaldoCache()` em:
  - `registrarMovimento()` — a cada novo movimento
  - Merge pós-sync com Supabase em `loadEstoque()`

#### Histórico de movimentos global — paginação e filtros
- De 15 linhas fixas para **30 por página** com navegação ←→
- Filtros por tipo: Todos / ＋ Entradas / − Saídas / ⚖ Ajustes
- Exibe contagem: "1–30 de 847"
- Estados: `_movFiltroTipo`, `_movPagina`, constante `_MOV_POR_PAG=30`

#### Histórico individual de produto — paginação e filtros
- **Novo:** paginação de 25 por página com navegação ←→
- Filtros por tipo: Todos / Ent. / Saída / Ajuste / 🔒 Reserva
- Exibe contagem total de movimentos do produto
- Estados: `_histProdId`, `_histProdPag`, `_histProdFiltro`, constante `_HIST_POR_PAG=25`
- `abrirHistProduto()` agora delega para `_renderHistProduto()` (função interna paginável)

#### Limite de segurança no localStorage
- `lsMovSalvar()` agora salva apenas os **2000 movimentos mais recentes** localmente
- Histórico completo continua disponível no Supabase (query `limit(5000)` no `loadEstoque`)
- Evita estouro da cota de 5MB do localStorage com alto volume diário

### Commits desta sessão:
- `33ae75f` — `perf(estoque): cache de saldo, paginação e filtros no histórico de movimentos`

---

## Sessão 2026-06-22 (continuação) — Fluxo de OS e Vistorias do Técnico

### Clarificação do modelo de negócio (decisão final):

**OS (Ordens de Serviço):**
- Criadas pelo **gestor** no calendário/agenda
- Técnico vê em **"Minhas OS"** (filtro padrão: ⏳ Agendadas)
- Técnico abre, preenche check-in, executa, preenche obs/materiais/fotos/checklist, faz checkout
- Campos do gestor são **somente-leitura** para o técnico

**Vistorias mensais:**
- Gestor cadastra **planos recorrentes** (Locais) em "Vistorias → Meus Locais"
- Cada mês, o técnico vê quais locais precisam de vistoria (status ✅ Realizada / ⏳ Pendente)
- Técnico clica "🔍 Fazer Vistoria" → preenche relatório completo de equipamentos
- Fluxo **completamente separado** das OS — não se misturam

### O que foi implementado / corrigido:

#### 1. Formulário de OS — modo técnico (read-only)
- `_abrirOSForm(o)` corrigido com 4 bugs em cadeia:
  - Checklist nunca renderizava ao editar OS existente (faltava `renderOsChecklist()`)
  - Campo "Responsável Técnico" ficava vazio → auto-preenche com nome da sessão
  - Select de check-in ficava em "Selecione…" → pré-seleciona o técnico logado
  - Campos do gestor agora ficam **read-only** quando técnico abre a OS:
    - `os-cli`, `os-loc`, `os-data`, `os-hora`, `os-cnpj` → `readonly` + fundo cinza
    - `os-loja` → `disabled`
    - Botão "+ Adicionar serviço" → oculto para técnico
- `restaurarRascunho('os')` ignorado quando `osEditId` está preenchido (evitava draft sobrescrever valores da OS carregada)
- `confirmar()` estendida para aceitar `cbNao`, `labelNao`, `labelSim` (modal com dois caminhos)
- `editarOS()` simplificada — apenas chama `_abrirOSForm(o)` sem modal de redirecionamento

#### 2. Minhas OS — separação e deduplicação
- OS com `agendamento_id` excluídas de "Minhas OS" (pertencem exclusivamente à aba Vistorias)
- Deduplicação por `id` (evita merge local+remoto)
- Deduplicação por `orcamento_id + data_servico` (OS gerada duas vezes do mesmo orçamento na mesma data)
- Botão "🔍 Nova Vistoria" removido do header (técnico não cria vistoria por lá)

#### 3. Vistorias — filtros e visibilidade corrigidos
- Campo `tecnico` no local é preferência de agenda, **não restrição de acesso** → técnico vê todos os locais ativos da loja
- `loja_id: "default"` agora tratado como equivalente à loja padrão (`LOJA_PADRAO_ID`) — locais antigos apareciam em branco por esse motivo
- Deduplicação por `cliente+local` adicionada em `loadLocais()` (executa a cada carregamento)
- Campo de busca "🔍 Filtrar por nome do local ou cliente…" adicionado na aba Meus Locais (filtra em tempo real)
- `go('visitas')` abre sempre na aba "Meus Locais" (aba "Nova Vistoria" oculta para técnicos)

#### 4. Calendário — distinção visual de tipos de OS
```js
// Cores dos eventos no calendário
tipo === 'vistoria'  → fundo roxo   🟣 (agendamento_id)
tipo === 'orcamento' → fundo laranja 🟠 (orcamento_id)
status === 'concluido' → fundo verde 🟢
status === 'cancelado' → fundo cinza
// padrão (serviço avulso) → azul padrão 🔵
```
Legenda de cores adicionada abaixo do calendário.

#### 5. `_gerarProximaOSdoAg(agId, dataConcluidaStr)` — nova função
Chamada automaticamente ao concluir uma OS com `agendamento_id` (check-out ou "Concluir" do gestor).
Gera a próxima ocorrência do agendamento quando a última OS do lote é concluída.

### Limpeza de dados (Supabase):
- **24 OS duplicadas deletadas**: 3 por `orcamento_id+data_servico` + 21 por `cliente+data_servico` do mesmo agendamento
- **Locais de vistoria deduplicados**: de 5 → 3 registros únicos salvos no `empresa_config` do Supabase
- Banco ficou com 60 OS únicas (53 de agendamentos, 7 normais) e 3 locais ativos

### Commits desta sessão:
- `bdc0474` — docs(claude): atualiza CLAUDE.md com sessão 2026-06-22
- `3cd989c` — fix(os): corrige 4 bugs no fluxo de execução do técnico
- `0054ff2` — fix(os,vistoria): separar fluxos técnico e vistoria corretamente
- `27dc827` — fix(minhas-os): remover botão "Nova Vistoria" da tela do técnico
- `a7ba7e6` — fix(minhas-os): separar vistorias e remover OS duplicadas
- `5308f7f` — fix(vistorias): corrigir filtro de loja em renderLocaisTab
- `3871a01` — fix(vistorias): técnico vê todos os locais ativos + dedup no load

---

## Perguntas em aberto (aguardando Marcos responder)

1. **CNPJs reais** das 3 empresas — para preencher tabela `lojas` e emissão de NF
2. **Tokens Focus NFe** — um por CNPJ (homologação e produção)
3. **Template EmailJS** — adicionar novas variáveis `{{duracao}}`, `{{status_geral}}`, `{{link_pdf}}` ao template
4. **Tabela `auditoria` no banco de produção** — rodar o SQL acima se ainda não foi rodado (o app funciona sem ela, só não sincroniza o log).
- [ ] **PIN legado:** com contas individuais criadas, o fallback de PIN legado em `pinValido()` pode ser removido. Confirmar com Marcos se há algum usuário legado antes de remover.
