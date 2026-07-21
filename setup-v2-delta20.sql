-- ============================================================================
-- DELTA 20 — CRM v2: situação do negócio, multi-contato (condomínio), aging por etapa
-- Aplicado ao banco em 2026-07-20 via Management API. Arquivo é o histórico.
-- ============================================================================
-- Motivado por: ciclo de decisão de condomínio (síndico → conselho → assembleia)
-- é mais lento e envolve mais gente do que uma venda residencial simples; e
-- orçamentos de manutenção frequentemente competem com outros prestadores.
--
--   crm_situacao         — por que está demorando: 'aguardando_aprovacao'
--                           (síndico/conselho/assembleia) | 'concorrencia'
--                           (comparando orçamentos) | 'negociando_valor' | null
--   crm_decisao_prevista — data prevista da assembleia/reunião que vai decidir
--   crm_contatos         — multi-thread: [{nome,papel,tel}] — síndico,
--                           síndico profissional, conselho/administradora, etc.
--                           (pesquisa de mercado: negócios com 3+ contatos
--                           engajados fecham a taxas muito maiores que
--                           negócios com 1 único contato)
--   etapa_desde           — timestamp de quando o orçamento entrou na etapa
--                           atual do funil — permite medir "dias parado nesta
--                           etapa" (sinal de gargalo), diferente de "dias sem
--                           contato" (sinal de negligência do vendedor)
--
-- Migração 100% aditiva. Nenhuma policy/RLS alterada (herda de orcamentos).

ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS crm_situacao text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS crm_decisao_prevista date;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS crm_contatos jsonb DEFAULT '[]';
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS etapa_desde timestamptz;
