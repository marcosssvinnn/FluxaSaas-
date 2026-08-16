# Insights de IA no CRM — plano de implementação

> **Para quem for continuar (outra sessão/IA):** este documento é o handoff
> completo. A peça 1 (schema) já está escrita em `setup-v2-delta27.sql`, **ainda
> NÃO aplicada ao banco**. As peças 2, 3 e 4 estão especificadas aqui e ainda
> não foram construídas. Leia a seção "Ordem de execução" antes de começar —
> a ordem importa e existe um ponto de parada deliberado no meio.

## O objetivo (palavras do Marcos)

> *"Que dentro do próprio sistema, na parte de CRM, ele traga insights pro
> vendedor. 'O orçamento tal está ocioso há tanto tempo, você não acha que
> deveria ligar?', ou 'você perguntou se tem assembleia?'. Que fosse um CRM
> interativo e inteligente, que buscasse as nuances dos orçamentos, integrasse
> o histórico de compras do cliente — e que isso retornasse pra tela do
> vendedor, no sistema mesmo, integrado."*

Requisito explícito: **usar API de IA em tier gratuito**, sem plano pago.

---

## O que JÁ existe (levantado no código em 2026-08-06)

Este é o achado que define o tamanho do trabalho: **a maior parte da
infraestrutura já foi construída em sessões anteriores.** Não é projeto novo.

| Peça | Onde | Estado |
|---|---|---|
| Tabela `insights` | `setup-v2.sql` | Existe, com o comentário *"escritos pelo backend futuro via service role; o app só lê"* |
| RLS de `insights` | `setup-v2.sql` | `membro le insights` (SELECT), escrita já bloqueada pro cliente |
| Leitura no app | `app.js` ~l.5131 (`loadAnalises`) | Já busca o último insight da empresa |
| Card na tela | `app.js` ~l.5160 (`renderAnalises`) | Já renderiza "🤖 Análise inteligente"; hoje nunca aparece porque ninguém escreve na tabela |
| Edge Function | `supabase/functions/enviar-push/index.ts` | Padrão pronto: secrets em `Deno.env`, service_role, header interno |
| Feature flag | `app.js` l.742 (`flagAtiva`) + RPC `admin_set_flag_empresa` | Pronto, **nenhuma flag em uso ainda** |
| Regra de segredo | CLAUDE.md, regra 15 | Já antecipa chave de IA: *"nenhum token/chave de API (fiscal, **IA**, service_role) no cliente. Segredos vivem em Edge Function."* |

**E os campos que a IA precisa ler já são capturados** — foram criados no
delta20 (CRM v2) e batem exatamente com o pedido:

| Campo em `orcamentos` | Comentário original no schema | Vira qual gatilho |
|---|---|---|
| `etapa_desde` | *"quando entrou na etapa atual (aging por estágio)"* | "orçamento ocioso há tanto tempo" |
| `crm_decisao_prevista` | *"data prevista da assembleia/reunião que vai decidir"* | "você perguntou se tem assembleia?" |
| `crm_situacao` | `aguardando_aprovacao` \| `concorrencia` \| `negociando_valor` | tom da abordagem |
| `crm_contatos` | *"multi-thread (síndico/conselho/administradora)"* | quem mais engajar |
| `crm_notas`, `motivo_perda`, `proximo_contato` | histórico e desfecho | follow-up e padrão de perda |

**O dado já está lá. Ninguém lê. É isso que falta.**

---

## Arquitetura — duas decisões que definem se funciona

### 1. Pré-cálculo noturno, nunca chamada ao vivo

```
madrugada:  cron → Edge Function → RPC de gatilhos → LLM → grava em `insights`
uso do dia: vendedor abre o cliente → SELECT em `insights` → tela instantânea
```

**Não chamar a API de IA quando o vendedor abre a tela.** Motivos, em ordem de
importância:

1. **Latência** — 2 a 5 s de spinner. No décimo cliente do dia o vendedor
   desiste da feature.
2. **Limite de taxa** — chamada ao vivo estoura o free tier em pico de uso.
3. **Disponibilidade** — a tela passaria a depender da API de terceiro estar no
   ar. Com pré-cálculo, o pior caso é insight de ontem, não tela quebrada.
4. **Offline** — o Fluxa é local-first/PWA. Insight gravado no banco entra no
   fluxo normal de cache; chamada ao vivo simplesmente não funciona sem rede.

### 2. Regra determinística dispara, IA só escreve

```
SQL apura os FATOS  →  LLM veste os fatos em linguagem de vendedor
(sempre verdade)        (nunca afirma nada que o SQL não provou)
```

O gatilho ("parado há 23 dias", "assembleia foi dia 12/06", "cliente tem 3
compras") sai de `crm_candidatos_insight`, em SQL puro. O modelo recebe esses
fatos prontos e produz só o texto. Ele **nunca** fica na posição de inferir se o
cliente tem histórico — isso já vem decidido.

Consequência prática: dá pra rodar um `SELECT` e conferir a lista **antes** de
existir qualquer código de IA. Se os gatilhos não fizerem sentido com os dados
reais da Fluxa, nenhum texto bonito por cima resolve.

A coluna `insights.fatos` guarda exatamente o que foi entregue ao modelo — é o
que torna a camada auditável depois (dá pra conferir se o texto bate com os
fatos ou se o modelo inventou).

---

## As 4 peças

### Peça 1 — `setup-v2-delta27.sql` ✍️ ESCRITO, NÃO APLICADO

Já está no repo. Conteúdo:

- **10 colunas novas em `insights`**: `orcamento_id`, `cliente_id` (text — o
  `clientes.id` deste schema é text, não uuid), `titulo`, `gatilho`, `fatos`,
  `prioridade`, `status`, `feedback`, `feedback_em`, `expira_em`.
- **3 índices em `orcamentos`**: `(empresa_id, status, etapa_desde)`,
  `(empresa_id, crm_decisao_prevista)`, `(empresa_id, proximo_contato)`. Sem
  eles a varredura noturna faz sequential scan na tabela que mais cresce.
- **2 índices em `insights`** + **1 índice único parcial** (`empresa_id,
  orcamento_id, gatilho` enquanto `status IN ('novo','lido')`) — é o que impede
  a rotina noturna de duplicar tudo na tela se rodar duas vezes (retry, timeout,
  execução manual).
- **RPC `insight_marcar(id, status, feedback)`** — o vendedor marca lido/útil
  sem UPDATE direto, então nunca consegue alterar o texto do insight, só o
  próprio parecer. Escopado por `minhas_empresas()`.
- **RPC `crm_candidatos_insight(empresa, dias_parado)`** — os gatilhos (peça 2,
  abaixo).

**Conformidade com a checklist do CLAUDE.md** (verificado por script):

- Regra 16 (migração aditiva): 10 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`,
  **zero** `DROP COLUMN`/`RENAME`/`ALTER TYPE`, **zero** `DROP POLICY`. O código
  atual roda com este schema sem alteração nenhuma — requisito de rollback.
- Regra 11 (empresa_id): toda coluna, índice e RPC é escopada por `empresa_id`.
- Regra 13 (RLS): a policy `membro le insights` **não é tocada**. Escrita
  continua bloqueada pro `authenticated`; quem grava é a Edge Function via
  service_role, que ignora RLS por natureza.
- Regra 1 (schema real): todas as colunas referenciadas foram conferidas contra
  `setup-v2.sql` — `orcamentos` e `clientes` OK, nenhuma coluna de `insights`
  em conflito com as existentes.

### Peça 2 — `crm_candidatos_insight` ✍️ ESCRITO (dentro do delta27)

SQL puro, sem IA, sem chamada externa. Responde: *quais orçamentos merecem
atenção hoje, e que fatos justificam isso?*

| Gatilho | Regra | Prioridade |
|---|---|---|
| `followup_atrasado` | `proximo_contato` já venceu | 70–95 (a mais alta — o vendedor **já tinha decidido** ligar; é compromisso vencido, não sugestão nova) |
| `assembleia` | `crm_decisao_prevista` passou (janela de 1 a 45 dias) e segue pendente | 65–90 |
| `parado` | pendente, `dias_parado >= N`, sem follow-up e sem assembleia marcada | 30–80 |
| `valor_atipico` | pendente ≥ 1,8× o ticket que a empresa costuma aprovar | 60 |
| `recorrente_sumido` | cliente com 2+ compras e 120+ dias sem receber orçamento (sem `orcamento_id`) | 55 |

Pontos de implementação que **não podem ser perdidos numa reescrita**:

- `etapa_desde` é **NULL** em todo registro anterior ao delta20. Todo uso passa
  por `COALESCE(etapa_desde, data_criacao)`. Sem isso os orçamentos mais antigos
  — justamente os mais parados — ficariam invisíveis pro gatilho `parado`.
- `valor_atipico` só dispara com `qtd_aprovados >= 5`. Com 2 aprovados na
  história, "acima da média" não significa nada.
- A CTE `hist` traz compras/total gasto/perdidos por cliente. É o que separa
  "cliente novo pechinchando" de "cliente fiel que nunca reclamou de preço" —
  mesma situação no funil, abordagem oposta.
- Chamável por service_role (a Edge Function) **ou** por gestor da própria
  empresa (pra conferir a lista pelo app).

### Peça 3 — Edge Function `gerar-insights` ⬜ NÃO CONSTRUÍDA

Copiar a estrutura de `supabase/functions/enviar-push/index.ts` (mesma
autorização: JWT do usuário **ou** header secreto interno; nunca anônima).

Fluxo:

1. Para cada empresa com `flagAtiva('insights_ia')`:
2. `rpc('crm_candidatos_insight', { p_empresa })`
3. Expirar/limpar insights vencidos (`expira_em < now()` → `status='dispensado'`)
4. Para cada candidato **que ainda não tem insight ativo do mesmo gatilho**,
   montar o prompt com os `fatos` e chamar o LLM
5. Gravar em `insights` com `titulo`, `conteudo.resumo`, `gatilho`, `fatos`,
   `prioridade`, `expira_em`, `modelo`

**Provider:** Groq (`llama-3.3-70b-versatile`) — free tier sem cartão, 30
req/min, **1.000 req/dia**, 100K tokens/dia. Volume real da Fluxa: ~150
orçamentos abertos = ~150 requisições/noite. Cabe com folga e ainda serve os
outros tenants. Fallback: Google Gemini 2.5 Flash (~1.500 req/dia).

Secret: `GROQ_API_KEY` via `supabase secrets set`. **Nunca no `app.js`** —
regra 15.

Diretrizes do prompt (importam mais que o modelo escolhido):

- Entregar os fatos em JSON e pedir **2 a 3 frases**, tom de colega de trabalho,
  em português do Brasil.
- Proibir explicitamente inventar qualquer dado que não esteja nos fatos.
- Pedir uma **ação concreta** ("ligar perguntando se a assembleia decidiu"), não
  conselho genérico ("é importante manter contato").
- Não citar valor em R$ quando o gatilho não for sobre preço.
- Rejeitar e não gravar a resposta se vier vazia, com mais de ~400 caracteres,
  ou se mencionar número que não está em `fatos` (validação barata, vale a pena).

Robustez: `try/catch` por candidato (um erro não derruba a leva), respeitar
`retry-after` em 429, e **falhar em silêncio é proibido** (regra 4) — logar.

**Agendamento:** `pg_cron` **não aparece no schema atual** — precisa habilitar a
extensão, ou usar o Supabase Cron chamando a função. Sugestão: 1×/dia,
madrugada. Reprocessar só o que mudou.

### Peça 4 — Painel na tela do vendedor ⬜ NÃO CONSTRUÍDA

Alvos naturais em `app.js`:

- **`renderCRM` / `_crmComputarStats`** — o funil já existe (`page-crm`), já tem
  card por orçamento e painel "📞 Follow-ups do dia". O insight entra como faixa
  no card e como bloco no modal do orçamento.
- **`renderPainelCRM`** (Painel/landing do gestor) — bloco "🤖 Prioridades de
  hoje", ordenado por `prioridade DESC`.

Comportamento:

- Ler `insights` filtrado por `status IN ('novo','lido')` e
  `expira_em > now()`, escopado por `empresa_id` (regra 13).
- **Botão útil / não útil** chamando `insight_marcar`. Isto não é enfeite: em
  três meses é o que diz qual gatilho o vendedor realmente usa e qual só faz
  barulho. Sem feedback não há como podar.
- `esc()` em todo texto vindo do modelo antes de ir pro `innerHTML` — é conteúdo
  gerado, tratar como entrada não confiável.
- Deixar visível que é sugestão de IA (o card já usa "🤖"), pra não virar
  ordem.
- Mobile **e** desktop (regra 7).
- Ao mexer em `app.js`/`styles.css`, **subir o `CACHE` em `sw.js`** (`fluxa-vN`).

---

## Ordem de execução (a ordem importa)

1. **Revisar `setup-v2-delta27.sql`** e aplicar via Management API.
2. **Rodar o SELECT de conferência** com o `empresa_id` da Fluxa piscinas
   (`1b2b5a31-6af9-4a9e-b888-e41091f958f7`):

   ```sql
   SELECT gatilho, cliente, prioridade, fatos
   FROM crm_candidatos_insight('1b2b5a31-6af9-4a9e-b888-e41091f958f7')
   ORDER BY prioridade DESC;
   ```

3. 🛑 **PONTO DE PARADA — mostrar a lista pro Marcos.** Este passo não é
   burocracia. Se os gatilhos não produzirem uma lista que um vendedor olharia e
   diria "é, eu ligaria pra esses", o problema está nos gatilhos ou nos dados, e
   construir Edge Function + tela em cima só vai encarecer a descoberta. Ajustar
   os limiares (`p_dias_parado`, janela da assembleia, múltiplo do ticket) aqui
   é barato; depois de pronto, não é.
4. Peça 3 (Edge Function), atrás de `flagAtiva('insights_ia')`, ligada **só na
   Fluxa piscinas** primeiro (regra 17 + a empresa já é a piloto de IA
   designada no CLAUDE.md).
5. Peça 4 (tela), lendo o que a peça 3 gravou.
6. Rodar a checklist de verificação do CLAUDE.md antes do merge `dev`→`main`.

> ⚠️ **A `main` está travada de propósito** (ver "Nota de coordenação" no
> CLAUDE.md): há trabalho fiscal não testado em Node real entre os Sprints
> mobile e a `main`. Confirmar com o Marcos antes de promover qualquer coisa.

---

## Custo

| Item | Custo |
|---|---|
| Groq free tier | R$ 0 (1.000 req/dia; uso previsto ~150/noite) |
| Supabase Edge Functions | dentro do free tier atual |
| Colunas/índices novos | desprezível |
| **Total** | **R$ 0** até um volume bem maior que o de hoje |

---

## O que NÃO fazer

- ❌ Chamar a API de IA na abertura da tela (latência, quota, dependência).
- ❌ Colocar a chave da IA no `app.js` — regra 15. Só Edge Function.
- ❌ Deixar a IA inferir fatos. Ela veste fatos que o SQL já provou; ponto.
- ❌ Insight sem `expira_em`. "Parado há 20 dias" vira mentira no minuto em que
  o vendedor liga, e conselho velho na tela mata a confiança na feature inteira.
- ❌ Pular o passo 3 (conferir a lista antes de construir por cima).
- ❌ Reutilizar a `insights` só como estava (por período): sem `orcamento_id` não
  há como pendurar o insight no card do cliente, que é o pedido.

---

## Nota sobre LGPD (decisão do Marcos, 2026-08-06)

Perguntado sobre anonimizar os dados antes de enviar ao provedor de IA, o Marcos
decidiu **não fazer por enquanto** — *"é um software interno pequeno"*. Decisão
registrada e respeitada.

Vale reter o gatilho de reavaliação: o Fluxa é multi-tenant e já prevê Fortemp e
Aquamotor como tenants separados. Enquanto o uso for interno, tanto faz. **No
momento em que houver empresa pagante que não seja do Marcos**, isso muda de
figura — dado pessoal de terceiro indo pra API de terceiro. A mitigação é barata
(substituir nome/telefone por código no payload e remontar na leitura; o modelo
não precisa saber que é o "João da Silva" pra entender que a objeção foi preço),
então não é dívida técnica grande — só não está feita.

---

*Levantamento feito em 2026-08-06 lendo `setup-v2.sql`, os deltas 1–26,
`app.js` e `supabase/functions/enviar-push/index.ts`. Peça 1 escrita e
verificada estaticamente contra o schema; **não aplicada ao banco**.*
