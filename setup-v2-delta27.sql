-- ============================================================================
-- DELTA 27 — Insights de CRM por orçamento (base para a camada de IA)
-- NÃO APLICADO AINDA. Rodar uma vez, via Management API, após revisão.
-- ============================================================================
-- Contexto: a tabela `insights` já existia desde o setup-v2.sql original, com o
-- comentário "escritos pelo backend futuro via service role; o app só lê", e o
-- app.js já a consome (loadAnalises, ~l.5131 → card "🤖 Análise inteligente",
-- ~l.5160). O que faltava era poder pendurar um insight num ORÇAMENTO
-- específico: do jeito que estava, `insights` só sabia falar de um período
-- inteiro (tipo='vendas', periodo='2026-07'), o que serve pro dashboard mas
-- não pro que o vendedor precisa ver no card daquele cliente.
--
-- Este delta é 100% ADITIVO (regra 16 do CLAUDE.md): só acrescenta colunas
-- NULLABLE, índices e funções novas. Nenhuma coluna renomeada/removida,
-- nenhum tipo alterado, nenhuma policy existente enfraquecida. O uso atual da
-- tabela (insight agregado por período, com orcamento_id/cliente_id NULL)
-- continua funcionando exatamente igual — o código revertido roda com este
-- schema, que é o requisito de rollback do projeto.
--
-- Colunas novas em `insights`:
--   orcamento_id  — a que orçamento se refere (NULL = insight agregado, como hoje)
--   cliente_id    — TEXT, não uuid: clientes.id é text ('cli_...') neste schema
--   titulo        — linha curta pro card (o `conteudo.resumo` continua sendo o corpo)
--   gatilho       — QUAL regra determinística gerou este insight. É o que permite,
--                   daqui a 3 meses, medir qual gatilho o vendedor realmente usa
--                   e desligar os que só fazem barulho.
--   fatos         — os fatos que o SQL apurou e entregou ao modelo. Guardar isto
--                   é o que torna a camada de IA AUDITÁVEL: dá pra conferir, linha
--                   a linha, se o texto gerado bate com o que foi informado, ou se
--                   o modelo inventou. Sem esta coluna não há como saber.
--   prioridade    — 0..100, ordenação da lista do vendedor
--   status        — 'novo' | 'lido' | 'dispensado' | 'agido'
--   feedback      — 'util' | 'inutil' (alimenta a decisão de manter o gatilho)
--   expira_em     — insight envelhece e MENTE ("parado há 20 dias" deixa de ser
--                   verdade no minuto em que o vendedor liga). Sem expiração, a
--                   tela acumula conselho velho e o vendedor para de confiar.
-- ============================================================================

-- ───────── 1. Colunas novas em insights (aditivo) ─────────
ALTER TABLE insights ADD COLUMN IF NOT EXISTS orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS cliente_id   text;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS titulo       text;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS gatilho      text;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS fatos        jsonb DEFAULT '{}';
ALTER TABLE insights ADD COLUMN IF NOT EXISTS prioridade   smallint DEFAULT 50;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS status       text DEFAULT 'novo';
ALTER TABLE insights ADD COLUMN IF NOT EXISTS feedback     text;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS feedback_em  timestamptz;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS expira_em    timestamptz;

-- ───────── 2. Índices ─────────
-- A varredura noturna e a tela do vendedor batem nestes caminhos. Sem os dois
-- primeiros índices, a busca por "parado há N dias" e "assembleia vencendo"
-- faz sequential scan em orcamentos — tolerável hoje, ruim quando a base
-- crescer (é a tabela que mais cresce no sistema: ~1 linha por serviço).
CREATE INDEX IF NOT EXISTS idx_orc_empresa_status_etapa
  ON orcamentos (empresa_id, status, etapa_desde);
CREATE INDEX IF NOT EXISTS idx_orc_empresa_decisao
  ON orcamentos (empresa_id, crm_decisao_prevista)
  WHERE crm_decisao_prevista IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orc_empresa_proxcontato
  ON orcamentos (empresa_id, proximo_contato)
  WHERE proximo_contato IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insights_orcamento
  ON insights (empresa_id, orcamento_id);
CREATE INDEX IF NOT EXISTS idx_insights_fila
  ON insights (empresa_id, status, prioridade DESC);

-- Idempotência do gerador: um insight ATIVO por (orçamento, gatilho). Sem isto,
-- rodar a rotina noturna duas vezes (retry, timeout, execução manual) duplica
-- todo mundo na tela do vendedor. O índice é parcial — só vale enquanto o
-- insight está vivo; depois de dispensado/expirado, o mesmo gatilho pode voltar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_insights_ativo_unico
  ON insights (empresa_id, orcamento_id, gatilho)
  WHERE orcamento_id IS NOT NULL AND status IN ('novo','lido');

-- ───────── 3. RLS ─────────
-- A policy de SELECT ("membro le insights") já existe e NÃO é tocada aqui.
-- Escrita continua bloqueada para authenticated (não há policy de INSERT/UPDATE):
-- quem escreve é a Edge Function via service_role, que ignora RLS por natureza.
-- O vendedor marca lido/feedback pela RPC abaixo, não por UPDATE direto — assim
-- ele nunca consegue alterar o TEXTO do insight, só o próprio parecer sobre ele.

CREATE OR REPLACE FUNCTION insight_marcar(
  p_id uuid,
  p_status text DEFAULT NULL,
  p_feedback text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('novo','lido','dispensado','agido') THEN
    RAISE EXCEPTION 'status inválido';
  END IF;
  IF p_feedback IS NOT NULL AND p_feedback NOT IN ('util','inutil') THEN
    RAISE EXCEPTION 'feedback inválido';
  END IF;

  UPDATE insights SET
    status      = COALESCE(p_status, status),
    feedback    = COALESCE(p_feedback, feedback),
    feedback_em = CASE WHEN p_feedback IS NOT NULL THEN now() ELSE feedback_em END
  WHERE id = p_id
    AND empresa_id IN (SELECT minhas_empresas());  -- isolamento multi-tenant

  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION insight_marcar(uuid, text, text) TO authenticated;


-- ============================================================================
-- 4. crm_candidatos_insight — os GATILHOS, 100% determinísticos
-- ============================================================================
-- Esta função não usa IA e não fala com nada externo. Ela responde, só com SQL:
-- "quais orçamentos merecem a atenção do vendedor hoje, e QUE FATOS justificam
-- isso?". A camada de IA (Edge Function, peça separada) recebe esta saída e só
-- transforma fato em linguagem de vendedor.
--
-- A separação é deliberada: o gatilho vem do banco, então é sempre verdade. O
-- modelo nunca fica na posição de afirmar que o cliente tem histórico que não
-- tem. E, porque é SQL puro, dá pra rodar um SELECT e conferir a lista ANTES de
-- gastar uma linha de código de IA — se os gatilhos não fizerem sentido com os
-- dados reais, nenhum texto bonito por cima resolve.
--
-- Gatilhos:
--   parado              — pendente, sem contato agendado, envelhecendo na etapa
--   followup_atrasado   — proximo_contato já venceu
--   assembleia          — a reunião/assembleia que ia decidir já aconteceu e o
--                         orçamento continua pendente (hora de perguntar o resultado)
--   valor_atipico       — pendente bem acima do ticket que a empresa costuma aprovar
--   recorrente_sumido   — cliente que já comprou várias vezes e sumiu (sem orcamento_id)
--
-- ⚠️ etapa_desde é NULL nos registros anteriores ao delta20 — todo uso abaixo
-- passa por COALESCE(etapa_desde, data_criacao). Sem isso, todo orçamento antigo
-- ficaria invisível pro gatilho "parado", justamente os mais parados de todos.
-- ============================================================================

DROP FUNCTION IF EXISTS crm_candidatos_insight(uuid, integer);

CREATE OR REPLACE FUNCTION crm_candidatos_insight(
  p_empresa uuid,
  p_dias_parado integer DEFAULT 10
)
RETURNS TABLE (
  gatilho      text,
  orcamento_id uuid,
  cliente_id   text,
  cliente      text,
  prioridade   smallint,
  fatos        jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Chamável pela Edge Function (service_role) OU por um gestor da própria
  -- empresa (útil pra conferir a lista pelo app antes de ligar a IA).
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR p_empresa NOT IN (SELECT minhas_empresas())) THEN
    RAISE EXCEPTION 'sem acesso a esta empresa';
  END IF;

  RETURN QUERY
  WITH
  -- Referência da empresa: o que ela costuma aprovar. Usado pra dizer se um
  -- orçamento é "grande" PRA ELA, em vez de um número arbitrário chumbado.
  ref AS (
    SELECT
      COALESCE(AVG(total) FILTER (WHERE status = 'aprovado'), 0)::numeric AS ticket_aprovado,
      COUNT(*) FILTER (WHERE status = 'aprovado')                         AS qtd_aprovados,
      COUNT(*) FILTER (WHERE status IN ('aprovado','recusado','vencido')) AS qtd_decididos
    FROM orcamentos WHERE empresa_id = p_empresa
  ),
  -- Histórico por cliente: quantas vezes já fechou e quanto já gastou. É o que
  -- separa "cliente novo pechinchando" de "cliente fiel que nunca reclamou de
  -- preço" — mesma situação no funil, abordagem completamente diferente.
  hist AS (
    SELECT
      cliente_id,
      COUNT(*) FILTER (WHERE status = 'aprovado')                    AS compras,
      COALESCE(SUM(total) FILTER (WHERE status = 'aprovado'), 0)     AS total_gasto,
      COUNT(*) FILTER (WHERE status IN ('recusado','vencido'))       AS perdidos,
      MAX(data_criacao)                                              AS ultimo_orcamento
    FROM orcamentos
    WHERE empresa_id = p_empresa AND cliente_id IS NOT NULL
    GROUP BY cliente_id
  ),
  -- Orçamentos vivos, com o aging já calculado.
  abertos AS (
    SELECT
      o.*,
      (CURRENT_DATE - COALESCE(o.etapa_desde, o.data_criacao)::date) AS dias_parado,
      jsonb_array_length(COALESCE(o.crm_notas, '[]'::jsonb))         AS qtd_notas,
      jsonb_array_length(COALESCE(o.crm_contatos, '[]'::jsonb))      AS qtd_contatos
    FROM orcamentos o
    WHERE o.empresa_id = p_empresa AND o.status = 'pendente'
  )

  -- ── Gatilho 1: follow-up combinado e não cumprido ─────────────────────────
  -- Prioridade mais alta do conjunto: aqui o vendedor JÁ tinha decidido ligar.
  -- Não é sugestão nova, é compromisso vencido.
  SELECT
    'followup_atrasado'::text,
    a.id, a.cliente_id, a.cliente,
    LEAST(95, 70 + (CURRENT_DATE - a.proximo_contato))::smallint,
    jsonb_build_object(
      'dias_atraso',   CURRENT_DATE - a.proximo_contato,
      'valor',         a.total,
      'dias_parado',   a.dias_parado,
      'situacao',      a.crm_situacao,
      'qtd_notas',     a.qtd_notas,
      'compras_cliente', COALESCE(h.compras, 0),
      'total_gasto_cliente', COALESCE(h.total_gasto, 0)
    )
  FROM abertos a LEFT JOIN hist h ON h.cliente_id = a.cliente_id
  WHERE a.proximo_contato IS NOT NULL AND a.proximo_contato < CURRENT_DATE

  UNION ALL

  -- ── Gatilho 2: a assembleia já aconteceu ──────────────────────────────────
  -- O cliente disse que decidiria numa reunião; a data passou e o orçamento
  -- continua pendente. Janela de 1 a 45 dias: antes disso não faz sentido
  -- cobrar, depois disso vira o gatilho "parado" e não este.
  SELECT
    'assembleia'::text,
    a.id, a.cliente_id, a.cliente,
    LEAST(90, 65 + (CURRENT_DATE - a.crm_decisao_prevista))::smallint,
    jsonb_build_object(
      'decisao_prevista',  a.crm_decisao_prevista,
      'dias_desde_decisao', CURRENT_DATE - a.crm_decisao_prevista,
      'valor',             a.total,
      'situacao',          a.crm_situacao,
      'qtd_contatos',      a.qtd_contatos,
      'contatos',          a.crm_contatos,
      'compras_cliente',   COALESCE(h.compras, 0)
    )
  FROM abertos a LEFT JOIN hist h ON h.cliente_id = a.cliente_id
  WHERE a.crm_decisao_prevista IS NOT NULL
    AND a.crm_decisao_prevista < CURRENT_DATE
    AND (CURRENT_DATE - a.crm_decisao_prevista) <= 45

  UNION ALL

  -- ── Gatilho 3: parado, sem nada agendado ──────────────────────────────────
  -- Exclui quem já tem follow-up marcado no futuro (não está abandonado, está
  -- em espera deliberada) e quem já caiu nos gatilhos acima.
  SELECT
    'parado'::text,
    a.id, a.cliente_id, a.cliente,
    LEAST(80, 30 + a.dias_parado * 2)::smallint,
    jsonb_build_object(
      'dias_parado',   a.dias_parado,
      'valor',         a.total,
      'situacao',      a.crm_situacao,
      'qtd_notas',     a.qtd_notas,
      'origem',        a.origem_cliente,
      'compras_cliente',     COALESCE(h.compras, 0),
      'total_gasto_cliente', COALESCE(h.total_gasto, 0),
      'perdidos_cliente',    COALESCE(h.perdidos, 0)
    )
  FROM abertos a LEFT JOIN hist h ON h.cliente_id = a.cliente_id
  WHERE a.dias_parado >= p_dias_parado
    AND a.proximo_contato IS NULL      -- com follow-up marcado → gatilho 1 ou espera deliberada
    AND a.crm_decisao_prevista IS NULL -- aguardando assembleia → gatilho 2

  UNION ALL

  -- ── Gatilho 4: valor atípico pra empresa ──────────────────────────────────
  -- Só dispara se houver base de comparação (>= 5 aprovados). Com 2 orçamentos
  -- aprovados na história, "acima da média" não significa nada.
  SELECT
    'valor_atipico'::text,
    a.id, a.cliente_id, a.cliente,
    60::smallint,
    jsonb_build_object(
      'valor',            a.total,
      'ticket_aprovado',  round(r.ticket_aprovado, 2),
      'vezes_o_ticket',   round(a.total / NULLIF(r.ticket_aprovado, 0), 1),
      'dias_parado',      a.dias_parado,
      'situacao',         a.crm_situacao,
      'compras_cliente',  COALESCE(h.compras, 0)
    )
  FROM abertos a
  CROSS JOIN ref r
  LEFT JOIN hist h ON h.cliente_id = a.cliente_id
  WHERE r.qtd_aprovados >= 5
    AND r.ticket_aprovado > 0
    AND a.total >= r.ticket_aprovado * 1.8
    AND a.dias_parado >= 5

  UNION ALL

  -- ── Gatilho 5: cliente recorrente que sumiu ───────────────────────────────
  -- Não tem orcamento_id: é sobre o CLIENTE, não sobre um orçamento aberto.
  -- Alguém que comprou 2+ vezes e há 4 meses não recebe nem orçamento é receita
  -- recorrente escorrendo em silêncio — ninguém percebe porque não há nada na
  -- tela pra perceber.
  SELECT
    'recorrente_sumido'::text,
    NULL::uuid, h.cliente_id, c.nome,
    55::smallint,
    jsonb_build_object(
      'compras',            h.compras,
      'total_gasto',        h.total_gasto,
      'ultimo_orcamento',   h.ultimo_orcamento,
      'dias_sem_orcamento', CURRENT_DATE - h.ultimo_orcamento::date,
      'ticket_medio_cliente', round(h.total_gasto / NULLIF(h.compras, 0), 2)
    )
  FROM hist h
  JOIN clientes c ON c.id = h.cliente_id AND c.empresa_id = p_empresa
  WHERE h.compras >= 2
    AND h.ultimo_orcamento < now() - interval '120 days'
    -- não repetir pra quem já tem orçamento aberto (já aparece nos gatilhos acima)
    AND NOT EXISTS (
      SELECT 1 FROM abertos a2 WHERE a2.cliente_id = h.cliente_id
    );
END $$;

GRANT EXECUTE ON FUNCTION crm_candidatos_insight(uuid, integer) TO authenticated;

-- ============================================================================
-- COMO CONFERIR (rodar isto ANTES de construir a camada de IA):
--
--   SELECT gatilho, cliente, prioridade, fatos
--   FROM crm_candidatos_insight('<empresa_id>')
--   ORDER BY prioridade DESC;
--
-- Se a lista fizer sentido pro vendedor, a IA em cima vai fazer sentido também.
-- Se não fizer, o problema está nos gatilhos ou nos dados — e nenhum texto
-- gerado por modelo nenhum conserta isso.
-- ============================================================================
