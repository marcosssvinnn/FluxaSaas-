-- delta35 — A Receber por parcela
--
-- Hoje o saldo a receber é UM número por orçamento (orcamentos.valor_recebido).
-- Isso responde "quanto falta", mas não responde "quando vence", "está
-- atrasado há quanto tempo" nem "quanto do que venci já entrou" — que é o que
-- faz alguém correr atrás da cobrança.
--
-- ⚠️ ADITIVO E SÓ PRA FRENTE: nenhum orçamento existente é migrado. Enquanto
-- um orçamento não tiver NENHUMA parcela lançada, o app continua usando
-- valor_recebido exatamente como hoje (fallback em _orcSaldoAReceber). Migrar
-- os antigos exigiria inventar data de vencimento pra dívida que nunca teve
-- uma — é decisão de negócio, não de engenharia, e fica pra depois.

CREATE TABLE IF NOT EXISTS recebimentos (
  id text PRIMARY KEY,
  empresa_id uuid,
  orcamento_id uuid,
  loja_id text,
  parcela_n integer DEFAULT 1,
  parcelas_total integer DEFAULT 1,
  vencimento date,
  valor numeric(12,2),
  data_pagamento date,
  forma text,
  obs text,
  origem text,                       -- 'aprovacao' | 'manual'
  data_criacao timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receb_empresa ON recebimentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_receb_orc ON recebimentos(orcamento_id);
-- Aberto e vencido é a consulta do dia a dia — vale o índice parcial.
CREATE INDEX IF NOT EXISTS idx_receb_aberto ON recebimentos(empresa_id, vencimento) WHERE data_pagamento IS NULL;

ALTER TABLE recebimentos ENABLE ROW LEVEL SECURITY;

-- Dado financeiro: gestor lê e escreve; vendas e técnico não enxergam.
-- Mesmo critério que a tela de A Receber já usa na UI, agora valendo no banco.
DROP POLICY IF EXISTS "receb sel" ON recebimentos;
CREATE POLICY "receb sel" ON recebimentos FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM minhas_empresas()) AND meu_perfil(empresa_id) IN ('gestor','master'));

DROP POLICY IF EXISTS "receb ins" ON recebimentos;
CREATE POLICY "receb ins" ON recebimentos FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM minhas_empresas()) AND meu_perfil(empresa_id) IN ('gestor','master'));

DROP POLICY IF EXISTS "receb upd" ON recebimentos;
CREATE POLICY "receb upd" ON recebimentos FOR UPDATE TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM minhas_empresas()) AND meu_perfil(empresa_id) IN ('gestor','master'));

DROP POLICY IF EXISTS "receb del" ON recebimentos;
CREATE POLICY "receb del" ON recebimentos FOR DELETE TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM minhas_empresas()) AND meu_perfil(empresa_id) IN ('gestor','master'));
