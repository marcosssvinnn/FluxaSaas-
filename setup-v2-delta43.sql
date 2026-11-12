-- delta43 — Aba GESTÃO (financeiro do dia a dia da Fluxa piscinas)
-- 100% aditivo. Aplicado via Management API em 2026-11-12.
--
-- (1) Tabela de preços: NÃO precisa de tabela/coluna nova — fica em
--     empresas.config.precificacao (jsonb), gravado pelos wrappers de config.
-- (2) Relatórios (bloco 4): a tela lê a tabela `insights` e mostra data+título+
--     texto (markdown). `tipo`/`titulo`/`conteudo`/`created_at` já existiam; só
--     faltava um corpo de texto simples pras rotinas agendadas gravarem.
alter table insights add column if not exists texto text;

-- (3) Flag da feature — ligada SÓ na Fluxa piscinas (feature flag, não schema).
--     Rollback = setar 'false' (sem deploy). Demais empresas não veem a aba.
update empresas
  set config = jsonb_set(coalesce(config,'{}'::jsonb), '{flags,gestao}', 'true'::jsonb, true)
  where id = '1b2b5a31-6af9-4a9e-b888-e41091f958f7';

-- Convenção pras rotinas agendadas gravarem em `insights` (bloco Relatórios):
--   empresa_id  uuid  NOT NULL  (obrigatório — RLS por empresa)
--   tipo        text            ex.: 'resumo_semana' | 'caixa_sexta' | 'radar_tributario'
--   titulo      text            título curto exibido na lista
--   texto       text            corpo em markdown simples (o que a tela mostra)
--   created_at  timestamptz     default now() — usado como data e ordenação (desc)
-- (conteudo jsonb/prioridade/status etc. continuam existindo; a aba de GESTÃO
--  usa só os campos acima e ignora o resto.)
