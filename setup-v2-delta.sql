-- FLUXA V2 — DELTA (objetos que faltaram no banco auoklaiffalbdgazrbdu)
-- Rode UMA vez no SQL Editor do Supabase. É idempotente (seguro re-rodar).
-- Cria: tabelas fornecedores e ordens_compra + as 3 views de analytics.
-- (O resto do setup-v2.sql já está no banco.)

-- ───────── COMPRAS: fornecedores + ordens de compra ─────────
CREATE TABLE IF NOT EXISTS fornecedores (
  id text PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id text,
  nome text, contato text, whatsapp text, email text, obs text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordens_compra (
  id text PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id text,
  numero integer,
  fornecedor_id text,
  data text,
  status text DEFAULT 'rascunho',
  itens jsonb DEFAULT '[]',
  total numeric(10,2) DEFAULT 0,
  obs text,
  data_recebimento timestamptz,
  data_criacao timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa  ON fornecedores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_empresa ON ordens_compra(empresa_id);

-- RLS: isolamento por empresa (igual às demais tabelas)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fornecedores','ordens_compra'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "isolamento por empresa" ON %I;', t);
    EXECUTE format(
      'CREATE POLICY "isolamento por empresa" ON %I FOR ALL TO authenticated
         USING (empresa_id IN (SELECT minhas_empresas()))
         WITH CHECK (empresa_id IN (SELECT minhas_empresas()));', t);
  END LOOP;
END $$;

-- Realtime
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fornecedores','ordens_compra'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ───────── ANALYTICS: 3 views agregadas (security_invoker) ─────────
CREATE OR REPLACE VIEW vw_analise_produtos WITH (security_invoker = true) AS
WITH mov AS (
  SELECT produto_id,
         SUM(CASE WHEN tipo IN ('saida') THEN abs(quantidade) ELSE 0 END)          AS saida_qtd,
         SUM(CASE WHEN tipo IN ('entrada','transf_entrada') THEN quantidade ELSE 0 END) AS entrada_qtd,
         SUM(CASE WHEN tipo IN ('entrada','saida','ajuste','transf_entrada','transf_saida') THEN quantidade ELSE 0 END) AS saldo_fisico,
         MAX(CASE WHEN tipo='saida' THEN data END)                                  AS ultima_saida
  FROM estoque_movimentos GROUP BY produto_id
)
SELECT p.empresa_id, p.id AS produto_id, p.nome, p.loja_id,
       p.custo, p.preco_venda,
       (p.preco_venda - p.custo)                                                    AS margem_unit,
       CASE WHEN p.preco_venda > 0 THEN round((p.preco_venda - p.custo)/p.preco_venda*100, 1) ELSE 0 END AS margem_pct,
       COALESCE(m.saida_qtd,0)    AS giro_saida_qtd,
       COALESCE(m.entrada_qtd,0)  AS entrada_qtd,
       COALESCE(m.saldo_fisico,0) AS saldo_fisico,
       COALESCE(m.saida_qtd,0) * p.preco_venda                                       AS receita_saida,
       m.ultima_saida,
       CASE WHEN m.ultima_saida IS NULL THEN NULL
            ELSE (CURRENT_DATE - m.ultima_saida::date) END                          AS dias_sem_saida,
       CASE
         WHEN sum(COALESCE(m.saida_qtd,0)*p.preco_venda) OVER (PARTITION BY p.empresa_id) = 0 THEN 'C'
         WHEN sum(COALESCE(m.saida_qtd,0)*p.preco_venda) OVER (
                PARTITION BY p.empresa_id ORDER BY COALESCE(m.saida_qtd,0)*p.preco_venda DESC
                ROWS UNBOUNDED PRECEDING)
              / NULLIF(sum(COALESCE(m.saida_qtd,0)*p.preco_venda) OVER (PARTITION BY p.empresa_id),0) <= 0.80 THEN 'A'
         WHEN sum(COALESCE(m.saida_qtd,0)*p.preco_venda) OVER (
                PARTITION BY p.empresa_id ORDER BY COALESCE(m.saida_qtd,0)*p.preco_venda DESC
                ROWS UNBOUNDED PRECEDING)
              / NULLIF(sum(COALESCE(m.saida_qtd,0)*p.preco_venda) OVER (PARTITION BY p.empresa_id),0) <= 0.95 THEN 'B'
         ELSE 'C'
       END AS abc
FROM produtos p
LEFT JOIN mov m ON m.produto_id = p.id
WHERE p.ativo = true;

CREATE OR REPLACE VIEW vw_analise_financeiro_mensal WITH (security_invoker = true) AS
WITH rec AS (
  SELECT empresa_id, to_char(data_criacao,'YYYY-MM') AS mes,
         SUM(COALESCE(valor_recebido,0)) AS receita,
         SUM(COALESCE(total,0))          AS faturado
  FROM orcamentos WHERE status IN ('aprovado','pago','concluido') GROUP BY 1,2
),
desp AS (
  SELECT empresa_id, to_char(COALESCE(data::timestamptz, data_criacao),'YYYY-MM') AS mes,
         SUM(COALESCE(valor,0)) AS despesas
  FROM despesas GROUP BY 1,2
)
SELECT COALESCE(r.empresa_id,d.empresa_id) AS empresa_id,
       COALESCE(r.mes,d.mes)               AS mes,
       COALESCE(r.receita,0)               AS receita,
       COALESCE(r.faturado,0)              AS faturado,
       COALESCE(d.despesas,0)              AS despesas,
       COALESCE(r.receita,0) - COALESCE(d.despesas,0) AS resultado
FROM rec r FULL OUTER JOIN desp d ON r.empresa_id=d.empresa_id AND r.mes=d.mes;

CREATE OR REPLACE VIEW vw_analise_orcamentos WITH (security_invoker = true) AS
SELECT empresa_id,
       COUNT(*)                                                        AS total,
       COUNT(*) FILTER (WHERE status='aprovado')                       AS aprovados,
       COUNT(*) FILTER (WHERE status='pendente')                       AS pendentes,
       COUNT(*) FILTER (WHERE status='recusado')                       AS recusados,
       CASE WHEN COUNT(*) FILTER (WHERE status IN ('aprovado','recusado')) > 0
            THEN round(COUNT(*) FILTER (WHERE status='aprovado')::numeric
                       / COUNT(*) FILTER (WHERE status IN ('aprovado','recusado')) * 100, 1)
            ELSE 0 END                                                 AS taxa_aprovacao_pct,
       COALESCE(round(AVG(total) FILTER (WHERE status='aprovado'), 2),0) AS ticket_medio,
       COALESCE(SUM(total) FILTER (WHERE status='aprovado'),0)         AS total_faturado,
       COALESCE(SUM(valor_recebido) FILTER (WHERE status='aprovado'),0) AS total_recebido,
       COALESCE(SUM(total) FILTER (WHERE status='aprovado'),0)
         - COALESCE(SUM(valor_recebido) FILTER (WHERE status='aprovado'),0) AS inadimplencia
FROM orcamentos GROUP BY empresa_id;

GRANT SELECT ON vw_analise_produtos, vw_analise_financeiro_mensal, vw_analise_orcamentos TO authenticated;

-- ───────── ORCAMENTOS: colunas de pagamento + data_aprovacao (faltavam) ─────────
-- O app (salvarApenas) grava pag_cod/pag_parcelas/pag_entrada e o fluxo de
-- aprovação grava data_aprovacao. Sem estas colunas o dbInsert resiliente as
-- REMOVE silenciosamente → os detalhes de pagamento e a data de aprovação não
-- persistiam no Supabase (ficavam só no localStorage). Aditivo e idempotente.
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS pag_cod text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS pag_parcelas integer;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS pag_entrada numeric(10,2);
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS data_aprovacao timestamptz;

-- Recarrega o schema cache do PostgREST (para as novas tabelas/views aparecerem no REST)
NOTIFY pgrst, 'reload schema';
