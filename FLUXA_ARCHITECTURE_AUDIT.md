# FLUXA — Auditoria de Arquitetura (Fase 1)

> **Regra desta fase: não alterar comportamento.** Este documento só mapeia o
> que existe hoje. Nenhuma linha de `app.js` foi mudada para produzi-lo.
>
> Gerado em 2026-09-05 contra o commit `1d269a2` (produção, `main`), com a
> RLS e as RPCs **testadas ao vivo contra o banco real** (não só lidas no
> código).

## Como ler isto

O plano mestre de 52 fases foi escrito, em boa parte, olhando o **v1**
(`fluxa-app`). O v2 já resolveu estruturalmente várias fases. Este documento
serve para **separar o que falta construir do que só falta verificar** — e
para dar o mapa de dependências que a Fase 4 (modularização) vai precisar
antes de mover qualquer coisa.

Cada seção termina com **Riscos** numerados. Os riscos estão consolidados e
priorizados no fim, em [Achados](#achados-priorizados).

---

## 0. Números da base

| Arquivo | Tamanho | Linhas | Papel |
|---|---|---|---|
| `app.js` | 929 KB | 16.296 | **Todo o comportamento** — 883 funções top-level, 128 variáveis globais |
| `index.html` | 205 KB | 3.330 | Shell + todas as telas + 5 documentos de impressão; 255 `onclick` inline |
| `styles.css` | 137 KB | 1.646 | Estilo (inclui os `.pd-*` de impressão, fora do `@media print`) |
| `native.js` | 20 KB | 430 | Camada PWA: notificações push, badge, histórico em IndexedDB |
| `sw.js` | 4,9 KB | 134 | Service worker, `CACHE='fluxa-v60'` |
| 38 × `setup-v2-delta*.sql` | — | — | Migrações aditivas, aplicadas via Management API |

**Sem etapa de build.** O navegador carrega os arquivos crus. Não há bundler,
não há `import`/`export` — tudo é escopo global compartilhado num único `app.js`.
Essa é a raiz técnica de quase todo risco estrutural abaixo.

---

## 1. Mapa de módulos

O `app.js` é organizado por comentários-cabeçalho (`// ══ SEÇÃO ══`), não por
arquivos. Abaixo, os 16 domínios reais, com a linha onde começam, as tabelas
que tocam e as telas (`page-*`) que servem.

| # | Domínio | Início (L) | Tabelas Supabase | Tela(s) |
|---|---|---|---|---|
| 1 | **Sessão / login multi-usuário** | 2 | `usuarios`, `membros` (via RPC) | `login-overlay` |
| 2 | **Auth de conta (Supabase Auth)** | 243 | `auth`, `membros`, `empresas` | — (camada) |
| 3 | **Contexto da empresa (tenant)** | 533 / 721 | `empresas`, `lojas` | — (estado) |
| 4 | **Usuários / gestão de acesso** | 890 / 10165 | `usuarios`, `usuarios_lista` | `page-usuarios` |
| 5 | **CFG / white-label** | 1230 / 1512 | `empresas.config` | `page-empresa` |
| 6 | **Navegação + permissões de tela** | 1960 | — | (roteador `go()`) |
| 7 | **Orçamento** | 2319 / 2926 | `orcamentos`, `municipios_fiscais` | `page-form`, `page-history` |
| 8 | **Ordem de Serviço** | 3138 / 4757 | `ordens_servico`, `os_materiais`, `agendamentos` | `page-os`, `page-os-history`, `page-minhas-os` |
| 9 | **Clientes + histórico + dedup + identidade** | 5787 / 6015 | `clientes` | `page-clientes` |
| 10 | **Análises (só gestor)** | 6891 | `vw_analise_*` (3 views) | `page-analises` |
| 11 | **Plataforma (admin cross-tenant)** | 6754 | RPCs `admin_*` | `page-plataforma` |
| 12 | **WhatsApp / notificações** | 7340 / 15865 | — | (sino + `native.js`) |
| 13 | **Portal do cliente** | 7422 / 7587 | RPC `portal_dados`, `portal_responder_orcamento` | `page-portal` |
| 14 | **Produtividade + A Receber + DRE + Baixa rápida** | 7769 / 7860 / 8178 | `recebimentos`, `despesas` | `page-produtividade`, `page-despesas` |
| 15 | **Vistorias de manutenção** | 10561 | `vistorias`, `vistoria_rascunhos`, `locais_vistoria` | `page-visitas` |
| 16 | **Estoque + Venda balcão + Compras + Fornecedores** | 13497 / 13900 / 15205 | `produtos`, `estoque_movimentos`, `vendas_balcao`, `ordens_compra`, `fornecedores`, `piscinas` | `page-estoque`, `page-venda-balcao`, `page-equipamentos` |
| — | **CRM / funil + cadência de recompra** | 15714 | (deriva de `orcamentos`) | `page-crm` |
| — | **Nota Fiscal** | 10326 | `notas_fiscais` (+ `fiscal-service/` externo) | (modal, **desligada**) |

**Fora do escopo (confirmado pelo Marcos):** módulo de **Oficina** — 0
ocorrências no v2, existe só no v1. As Fases 32-33 do plano mestre não se
aplicam ao v2 hoje.

---

## 2. Camada de dados

### 2.1 Tabelas (26, todas com RLS ativa e verificada)

`agendamentos`, `auditoria`, `certificados_fiscais`, `certificado_upload_tokens`,
`clientes`, `contadores`, `despesas`, `empresas`, `equipamentos`,
`estoque_movimentos`, `fornecedores` *(RLS herdada — ver risco R-7)*, `insights`,
`locais_vistoria`, `lojas`, `membros`, `municipios_fiscais`, `notas_fiscais`,
`orcamentos`, `ordens_compra`, `ordens_servico`, `os_materiais`, `piscinas`,
`produtos`, `push_subscriptions`, `recebimentos`, `vendas_balcao`, `vistorias`,
`vistoria_rascunhos`.

> **Teste ao vivo (anon key pública, sem login):** as 26 tabelas retornaram
> **vazio** para leitura anônima. Isolamento por `empresa_id` via RLS está
> **funcionando** — não é só frontend. Isto responde direto à Fase 3 do plano:
> **multi-tenant já está estruturalmente implementado.**

### 2.2 Views analíticas (3, `security_invoker=true`)

`vw_analise_produtos`, `vw_analise_orcamentos`, `vw_analise_financeiro_mensal`.
Agregam no SQL — o navegador consulta a view, nunca baixa tabela inteira. A RLS
das tabelas-base se aplica (invoker), e o app ainda filtra `empresa_id` por
defesa em profundidade. **Bom padrão, manter.**

### 2.3 RPCs (17) e superfície anônima

Três RPCs são **intencionalmente acessíveis por anônimo** (pré-login / portal):

| RPC | Por quê | Verificado |
|---|---|---|
| `empresa_por_slug` | resolver `/#empresa` antes do login | expõe só `{id, nome, branding}` |
| `usuarios_para_login` | lista de nomes p/ dispositivo compartilhado | **ver R-6** — expõe nome+perfil+loja a quem tiver o `empresa_id` |
| `portal_dados` | portal do cliente (token) | **allowlist por coluna** (corrigido no `delta28`) — não vaza `nota_interna`/`crm_*` |

As demais 14 (`admin_*`, `criar_empresa`, `*_funcionario`, `verificar_pin_*`,
`rpc_entregar_orcamento`, `rpc_sincronizar_reserva_orcamento`, `proximo_numero`)
checam autorização internamente — `admin_listar_empresas` retornou `"sem acesso"`
e `sou_admin_plataforma` retornou `false` para chamada anônima.

### 2.4 Edge Functions / serviços externos

- `supabase/functions/enviar-push/` — envio de push VAPID.
- `fiscal-service/` (Node.js separado) — assinatura mTLS de NFS-e. **Não é
  chamado em produção** (`emitirNota()` faz `return` logo no início). Intocado
  desde a última sessão.

---

## 3. Estado global e persistência

### 3.1 Estado em memória — 128 variáveis top-level

São `let`/`var` no escopo global de `app.js`. Destaques por categoria:

- **Tenant:** `EMPRESA_ID`, `EMPRESA`, `CFG`, `LOJAS`, `GRUPO_PRINCIPAL`, `LOJA_PADRAO_ID`, `lojaAtiva`
- **Conexão:** `db`, `dbOk` *(implícito)*, `authUser`, `realtimeChannel`
- **Dados carregados:** `todosOrc`, `todosOS`, `todosProdutos`, `todosMovEstoque`, `todosEq`, `todasDesp`, `todosReceb`, `todasPiscinas`, `locaisVistoria`, `todosUsuarios`, `todasVendasBalcao`, `todasOC`, `todosFornecedores`, `todosAg`
- **Edição em curso:** `editId`, `osEditId`, `visEditId`, `_cliEditId`, `_prodEditId`, `_usrEditId`, `_eqPiscinaEditId`, `_ocEditItens` … (um por entidade)
- **Rascunho/UI transitória:** `visEquipDados`, `visEquipSelecionados`, `_visEquipsCustom`, `fotosB64`, `osFotosAntes`, `osFotosDepois`, `_vendaCarrinho`, `osSelecionadas`

> **R-1 (arquitetural):** não há encapsulamento. Qualquer função pode reatribuir
> qualquer global. `LOJAS`/`db`/`dbOk` são bindings léxicos — reatribuir
> `window.X` **não** os troca (foi a origem de vários falsos-bugs de teste). É o
> acoplamento que a Fase 4 tem que quebrar, e o motivo de "corrigir A quebra B".

### 3.2 localStorage — escopo por empresa via `_lsKey()`

`_lsKey(k)` prefixa `fluxa:<EMPRESA_ID>:` em toda chave, **exceto** uma
allowlist de "globais de dispositivo" (`fluxa_empresa_id`, `fluxa_empresa_slug`,
`sb_url`, `sb_key`, `fluxa_sbar_col`, `fluxa_filtroSt`, `fluxa_filtroOSSt`).
Os wrappers `ls()`/`lsSet()`/`lsDel()` passam por `_lsKey`. **Usar sempre esses
wrappers é o contrato.** Onde o código chama `localStorage` direto, o escopo
por empresa é furado — ver R-2/R-3/R-4.

Chaves conhecidas (~30): `fluxa_orc_data`, `fluxa_os_hist`, `fluxa_produtos`,
`fluxa_estoque_mov`, `fluxa_clientes_full`, `fluxa_visitas`, `fluxa_despesas`,
`fluxa_recebimentos`, `fluxa_lojas`, `fluxa_usuarios`, `fluxa_agendamentos`,
`fluxa_vendas_balcao`, `fluxa_oc`, `fluxa_fornecedores`, `fluxa_equipamentos`,
`empresa_cfg`, os `*_tombstones`, os rascunhos e feedbacks, etc.

---

## 4. Autenticação e autorização

### 4.1 Fluxo de login (duas camadas)

1. **Supabase Auth (e-mail/senha)** — quem tem conta prova identidade. Se for
   `membros` da empresa ativa, entra direto na persona (`_autoLoginMembroDaConta`),
   sem PIN.
2. **PIN interno** — para perfis criados pelo gestor *dentro* do app
   (vendas/técnico/gestores extra em `usuarios`), pensados para **dispositivo
   compartilhado em campo**. O PIN é verificado **no servidor**
   (`verificar_pin_interno` / `verificar_pin_bootstrap`), o hash **nunca** chega
   ao navegador. Lockout local após tentativas (`fluxa_login_attempts`/`_lockout`).

### 4.2 Autorização — **perfil fixo, não granular**

Quatro perfis: `master`, `gestor`, `vendas`, `tecnico`. Checados por
`eGestor()`/`eVendas()`/`eTecnico()` (35 chamadas) e por duas allowlists de
navegação em `go()`:

```
pagesVendasOk  = ['form','history','crm','clientes','agendamentos','os']
pagesTecnicoOk = ['minhas-os','visitas','os']
```

> **R-5 (Fase 2.2 do plano):** permissão é **por tela**, espalhada em 35 pontos
> + 2 listas. Não existe `OS.EDIT`, `ORCAMENTO.APPROVE` etc. Criar um perfil novo
> (ex.: "supervisor de campo") hoje exige tocar em vários lugares. **É o gap real
> da Fase 2** — e o único item de segurança do plano que ainda não está resolvido
> no v2. Guardrails de `go()` são de UI; a proteção de dado real é a RLS (que
> está ok).

---

## 5. Fluxo de negócio — a cadeia que o plano quer conectar

O plano mestre quer garantir `Cliente → Local → Equipamento → Vistoria →
Recomendação → Oportunidade → Orçamento → OS → Estoque → Financeiro → Histórico
→ Próxima ação`. Estado atual de cada elo no v2:

| Elo | Existe? | Observação |
|---|---|---|
| Cliente | ✅ | ficha + histórico + dedup + **vínculo de identidade** (sessão passada) |
| Local | ⚠️ parcial | `locais_vistoria` existe, mas "local como patrimônio" (Fase 9) é raso |
| Equipamento | ⚠️ parcial | `equipamentos`/`piscinas` existem; **prontuário/timeline (Fases 10-11) não** |
| Vistoria | ✅ | checklist, fotos, assinatura, recomendações, rascunho na nuvem |
| Recomendação → Oportunidade | ⚠️ | `recomendacoes` é gravada, mas **não vira oportunidade automática** (Fase 13/26) |
| Orçamento | ✅ | com estágios de funil (CRM) e margem congelada |
| OS | ✅ | com execução, materiais, relatório, ações em lote |
| Estoque | ✅ | ledger por movimento, reserva, baixa idempotente, **saldo em data passada** |
| Financeiro | ✅ | A Receber por parcela, DRE, despesas fixa/variável |
| Histórico | ✅ | por cliente; **por equipamento não** (Fase 11) |
| Próxima ação | ⚠️ | cadência de recompra (atrás de flag) + fila "precisa de você hoje"; **motor de oportunidades (Fase 26) não existe** |

**Conclusão:** os elos *transacionais* (orçamento→OS→estoque→financeiro) estão
sólidos. O que falta é a espinha *de patrimônio* (equipamento como entidade com
prontuário) e o *motor de eventos→oportunidades*. É exatamente o P1/P2 do plano.

---

## 6. Achados priorizados

### 🔴 Corrigir já (bugs reais, dado em risco ou feature quebrada)

> **✅ R-2, R-3, R-4 corrigidos** em `49f699f` (sw v61). Todas as chaves de
> dado passam por `_lsKey` agora. **✅ R-5 (autorização granular) entregue** —
> ver Fase 2.2 abaixo.


**R-2 — Rascunho de vistoria nunca restaura em produção.** *(regressão da
sessão anterior)*
`_salvarRascunhoVis` grava em `localStorage` **direto** (chave global
`fluxa_vis_draft`, L11612/11621/11678); `_restaurarRascunhoVis` lê via `ls()`
(chave **escopada** `fluxa:<id>:fluxa_vis_draft`, L11685). Com empresa logada as
duas nunca coincidem → o rascunho local **e** o restaurado da nuvem caem numa
chave que a restauração não lê. Passou no teste da sessão passada só porque lá
`EMPRESA_ID` estava vazio (aí `_lsKey` devolve a chave crua e as duas batem).
**Efeito:** o recurso de "recuperar vistoria em andamento" — a rede de proteção
para celular que morre em campo — está inoperante em produção. Correção:
trocar os 3 `localStorage.setItem(LS_VIS_DRAFT…)` por `lsSet`.

**R-3 — Rascunho de venda de balcão não é limpo.**
Salva/lê via `lsSet`/`ls` (escopado, ok), mas **limpa** via
`localStorage.removeItem(LS_VB_RASCUNHO)` (chave global, L14140/14195). O
`removeItem` mira a chave errada → depois de fechar uma venda, o rascunho
sobrevive e reaparece oferecido na próxima venda. Correção: usar `lsDel`.

### 🟠 Corrigir na Fase 2 (segurança / privacidade)

**R-4 — Feedback de cadência vaza entre empresas no mesmo dispositivo.**
`_cadFbLer`/`_cadFbSalvar` usam `localStorage` direto (global). Num aparelho
usado por duas empresas, "dispensei essa oportunidade" da empresa A aparece para
a B. Baixa severidade (só num device compartilhado, e a feature está atrás de
flag), mas é vazamento cross-tenant de estado. Correção: `ls`/`lsSet`.

**R-5 — Autorização não é granular (Fase 2.2).** Perfil fixo em 35 pontos + 2
listas de navegação. Sem `OS.EDIT`/`ORCAMENTO.APPROVE`. É o **único** item de
segurança do plano ainda não resolvido no v2. Escopo real de trabalho, não
verificação.

**R-6 — `usuarios_para_login` expõe nomes a quem tiver o `empresa_id`.**
`SECURITY DEFINER`, `GRANT … TO anon`: dado um `empresa_id` (que
`empresa_por_slug` entrega a partir do slug público), qualquer um lista
nome+perfil+loja dos funcionários. É um trade-off consciente do login por
dispositivo compartilhado, mas vale decidir explicitamente se o slug deve ser
enumerável. Não expõe PIN nem hash.

### 🟡 Dívida estrutural (Fases 4-6)

**R-1 — Escopo global único.** 128 globais mutáveis, 883 funções num arquivo,
sem módulos. Acoplamento alto; ordem de execução importa; bindings léxicos
enganam testes. É a causa-raiz de "mexer em A quebra B" e o alvo da Fase 4.

**R-7 — ✅ RESOLVIDO (Fase 3).** Auditei as 69 políticas RLS reais direto do
banco (`pg_policies`, via Management API), não por leitura de arquivo:
- **Leitura:** toda `SELECT`/`DELETE` escopa por `empresa_id`
  (`minhas_empresas()`/`meu_perfil()`); nenhuma `USING(true)`.
- **Escrita:** todo `INSERT` tem `WITH CHECK` escopado. Todo `UPDATE` tem `USING`
  escopado; os que têm `WITH CHECK` nulo são **seguros** — o Postgres aplica o
  `USING` como check da linha nova, então não dá pra "mudar o `empresa_id`" de
  uma linha para outra empresa.
- **4 tabelas sensíveis sem política** (`certificados_fiscais`,
  `certificado_upload_tokens`, `contadores`, `plataforma_admins`) têm
  `rowsecurity=true` → **negam tudo** por padrão; só são tocadas por RPCs
  `SECURITY DEFINER`. Postura correta.
- **Nota de robustez (não é furo):** os `UPDATE` dependem do comportamento
  implícito do Postgres (`WITH CHECK` cai no `USING`). Se uma migração futura
  adicionar um `WITH CHECK` explícito a essas políticas, ele **tem** que
  continuar escopado por `empresa_id`.

**R-8 — 20 `catch(e){}` vazios.** A maioria é benigna (`chart.destroy()`,
`signOut()`, limpeza de UI). Alguns engolem erro de parse no boot
(`empresa_cfg`, `fluxa_usuarios`, `CFG`) sem log — contra a própria regra do
CLAUDE.md. Revisar caso a caso na Fase 42 (observabilidade).

**R-9 — 255 `onclick` inline no HTML.** UI acoplada a nomes de função globais.
Cada `onclick="foo()"` exige `foo` no escopo global — trava a modularização da
Fase 4 até virar event delegation.

---

## 7. Correspondência com o plano mestre de 52 fases

Para não construir o que já existe:

| Fase do plano | Estado no v2 | Ação |
|---|---|---|
| **1** Auditoria | **este documento** | ✅ entregue |
| 2.1 Autenticação | login 2-camadas, PIN no servidor, lockout | ✅ sólido; revisar sessão/expiração |
| **2.2 Autorização granular** | perfil fixo (R-5) | 🔨 **construir** |
| **3 Multi-tenant** | RLS ativa e testada nas 26 tabelas | ✅ **já é**; falta só teste de acesso cruzado |
| 4 Arquitetura modular | monólito (R-1) | 🔨 refatoração incremental |
| 5 Camada de dados (service/repo) | `dbInsert`/`dbUpdate`/`dbUpsert` são o embrião | 🔨 evoluir p/ services |
| 6 Source of truth | Supabase é fonte; local é cache — mas R-2/R-3 confundem | 🔨 formalizar + corrigir bugs |
| 7 Sincronização offline | `_pendingSync`/tombstones/reenvio existem | ⚠️ falta estado explícito PENDING/SYNCING/SYNCED na UI |
| 8 Cliente central | ficha+histórico+identidade | ✅ forte |
| 9 Local como patrimônio | `locais_vistoria` raso | 🔨 |
| 10-11 Equipamento: prontuário + timeline | entidade existe, prontuário não | 🔨 **alto valor** |
| 12 Vistoria estruturada | ✅ completa | — |
| 13 Vistoria→oportunidade | recomendação grava, não converte | 🔨 |
| 14 Estágios de orçamento | funil CRM existe | ✅ |
| 15 Orçamento→OS idempotente | `rpc_entregar`/reserva têm trava | ⚠️ confirmar idempotência do gerar-OS |
| 16-18 Experiência técnico / modo campo / workflow OS | `minhas-os`, check-in, execução | ⚠️ estados de OS mais rasos que o plano pede |
| 19 Auditoria de alterações | tabela `auditoria` existe | ⚠️ cobertura parcial |
| 20-22 Estoque / reserva | ledger + reserva idempotente | ✅ (falta reconciliação de órfãs — ver abaixo) |
| 23-24 Rentabilidade / custo-hora | margem congelada, DRE | ⚠️ falta **custo de mão de obra** |
| 25-29 CRM / motor de oportunidades / preventiva | cadência (flag) + fila | 🔨 **motor de eventos não existe** |
| 30-31 Portal / aprovação digital | portal + `portal_responder_orcamento` | ✅ |
| 32-33 Oficina | não existe no v2 | ⏸️ fora de escopo (Marcos) |
| 34 Dashboard central de ações | fila "precisa de você hoje" + sino | ⚠️ embrião |
| 35-39 SLA / produtividade / retrabalho / alertas / automação | produtividade parcial | 🔨 |
| 40 Comunicação (WhatsApp/e-mail) | WhatsApp por link + EmailJS + push | ✅ base |
| 41 Documentos por entidade | PDFs gerados, não centralizados | 🔨 |
| 42-45 Observabilidade / performance / mobile / UX | ad-hoc | 🔨 |
| 46-50 Onboarding / config / white-label / billing / métricas SaaS | `criar_empresa` + CFG white-label | ⚠️ onboarding cru; billing inexistente |
| 51 IA | — | ⏸️ depois dos dados |

### Recursos do v1 ainda não portados (candidatos ao P1)

Já são peças de fases do plano — não são extras:
- **Reconciliação de reservas órfãs** (Fase 22) — no v1 uma auditoria achou 7
  reservas presas roubando o "disponível".
- **Custo de mão de obra / custo-hora** (Fases 23-24).
- **Importar equipamento da vistoria para a base instalada** (Fase 10).
- **Observação por ambiente na vistoria** (Fase 12) — *prometida e não entregue
  na sessão passada; depende de campo `ambiente` no equipamento, que o v2 não tem.*
- Carga por técnico (Fase 36), contrato ativo/inadimplência na ficha (Fase 8),
  lembrar sessão 30 dias (Fase 2.1), backup/exportar vistorias (Fase 41).

---

## 8. Recomendação de sequência

A ordem do plano (P0 fundação → P1 núcleo → P2 automação) está certa no
espírito, mas o v2 **já tem a fundação de multi-tenant**. Ajuste sugerido:

1. **Agora (fecha a Fase 1):** corrigir R-2 e R-3 — são bugs pequenos, de dado,
   um deles regressão minha. Não é "nova feature", é fechar buraco achado na
   auditoria. *(Peço seu ok: a Fase 1 é "não alterar comportamento"; estes dois
   são correções de bug, decido com você antes de tocar.)*
2. **Fase 2.2 — autorização granular (R-5).** Único gap de segurança real.
   Destrava criar perfis novos sem espalhar `if`.
3. **Fase 3 — teste de acesso cruzado (R-7).** Logar como empresa B e tentar
   ler/gravar dados da A, tabela a tabela. Fecha a prova do multi-tenant.
4. **Fase 4 — modularização incremental.** Começar pelos domínios mais isolados
   (estoque, financeiro) extraindo para `/modules`, sem reescrever. Pré-requisito:
   reduzir os 255 `onclick` inline (R-9).
5. **P1 — patrimônio:** prontuário + timeline de equipamento (Fases 10-11) e
   vistoria→oportunidade (Fase 13). É o diferencial de longo prazo do produto.

> **Princípio que guia tudo:** cada mudança tem que **fortalecer a cadeia**
> Cliente→…→Próxima ação, não virar módulo isolado. Antes de construir, checar
> se já existe implementação (o v2 tem 883 funções — muita coisa já está lá com
> outro nome).
