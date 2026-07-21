-- ============================================================================
-- DELTA 19 — CRM / Funil de Vendas (v1)
-- Aplicado ao banco em 2026-07-20 via Management API. Arquivo é o histórico.
-- ============================================================================
-- Colunas ADITIVAS em orcamentos para o módulo CRM (page-crm):
--   proximo_contato — data do próximo follow-up agendado pelo vendedor/gestor
--   crm_notas       — histórico de interações [{data,texto,usuario}] (jsonb)
--   motivo_perda    — motivo registrado ao mover para "Perdido" (recusado/vencido)
-- Nenhuma policy/RLS alterada: as colunas herdam as policies existentes de
-- orcamentos (gestor+vendas). Migração 100% aditiva (protocolo v2).

ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS proximo_contato date;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS crm_notas jsonb DEFAULT '[]';
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS motivo_perda text;
