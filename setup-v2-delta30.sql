-- FLUXA V2 — DELTA 30: vendas_balcao (Venda Rápida / POS tela cheia)
-- Rode UMA vez.
--
-- Portado do fluxa-app (v1) — Tarefa 3e.3 de lá. Venda avulsa de balcão (N
-- itens, 1 transação, cliente opcional) hoje não tem lugar nenhum pra ir no
-- v2 — some do caixa e não alimenta o histórico do cliente nem o CRM.
--
-- ⚠️ Achado ao portar (mesmo padrão de setup-v2-delta29.sql): a versão do v1
-- (`migracao-vendas-balcao.sql`) usa `CREATE POLICY "anon full access" ...
-- FOR ALL TO anon USING (true)` — certo lá (single-tenant), seria um buraco
-- de segurança real aqui (v2 é multi-tenant). Uso o mesmo padrão de RLS por
-- perfil que `equipamentos`/`piscinas` já usam. Diferença: INSERT aqui
-- também libera `tecnico` — no v1, venda balcão é acessível a
-- gestor/vendas/tecnico (pagesTecnico inclui 'venda-balcao': um técnico na
-- casa do cliente pode vender um produto avulso), então a policy segue o
-- mesmo desenho.
--
-- cliente_id é text (mesmo tipo de clientes.id) — não repetir o mismatch
-- uuid/text já visto e corrigido em outra tabela.

CREATE TABLE IF NOT EXISTS vendas_balcao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id text,
  cliente_id text,
  cliente_nome text,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{produto_id, nome, qtd, preco_unit, custo_unit}]
  valor_total numeric(10,2) NOT NULL DEFAULT 0,  -- já líquido do desconto
  custo_total numeric(10,2) NOT NULL DEFAULT 0,
  forma_pagamento text,
  vendedor text,
  observacao text,
  data_criacao timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendas_balcao_empresa ON vendas_balcao(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_balcao_cliente ON vendas_balcao(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_balcao_data ON vendas_balcao(data_criacao DESC);

ALTER TABLE vendas_balcao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vb sel" ON vendas_balcao; DROP POLICY IF EXISTS "vb ins" ON vendas_balcao;
DROP POLICY IF EXISTS "vb upd" ON vendas_balcao; DROP POLICY IF EXISTS "vb del" ON vendas_balcao;
CREATE POLICY "vb sel" ON vendas_balcao FOR SELECT TO authenticated USING (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "vb ins" ON vendas_balcao FOR INSERT TO authenticated WITH CHECK (meu_perfil(empresa_id) IN ('gestor','vendas','tecnico'));
CREATE POLICY "vb upd" ON vendas_balcao FOR UPDATE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');
CREATE POLICY "vb del" ON vendas_balcao FOR DELETE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE vendas_balcao;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
