-- FLUXA V2 — LIMPEZA DE DADOS DE TESTE (QA da sessão 2026-07-18)
-- ⚠️ DESTRUTIVO — sem backup automático no plano free. Rode a PARTE 1 (prévia)
-- primeiro, confira que só aparecem os registros de teste, e só então rode a PARTE 2.
--
-- Estratégia: os dados de teste foram criados dentro de 2 empresas de QA
-- ('Empresa QA App', 'Empresa Teste QA'). Apagar a linha em `empresas` cascateia
-- (ON DELETE CASCADE) e limpa TUDO relacionado a elas em uma tacada só — orçamentos,
-- clientes, produtos, OS, despesas, agendamentos, equipamentos, estoque, membros
-- etc. Isso NÃO toca em nenhuma outra empresa (Forthemp/Fluxa ficam intactas).

-- ═══════════ PARTE 1 — PRÉVIA (só leitura, rode e confira antes) ═══════════
SELECT id, nome, slug, created_at FROM empresas
WHERE nome IN ('Empresa QA App', 'Empresa Teste QA');

-- Quantos registros cada empresa de teste tem em cada tabela (conferência):
SELECT 'orcamentos' AS tabela, count(*) FROM orcamentos WHERE empresa_id IN (SELECT id FROM empresas WHERE nome IN ('Empresa QA App','Empresa Teste QA'))
UNION ALL SELECT 'ordens_servico', count(*) FROM ordens_servico WHERE empresa_id IN (SELECT id FROM empresas WHERE nome IN ('Empresa QA App','Empresa Teste QA'))
UNION ALL SELECT 'clientes', count(*) FROM clientes WHERE empresa_id IN (SELECT id FROM empresas WHERE nome IN ('Empresa QA App','Empresa Teste QA'))
UNION ALL SELECT 'produtos', count(*) FROM produtos WHERE empresa_id IN (SELECT id FROM empresas WHERE nome IN ('Empresa QA App','Empresa Teste QA'))
UNION ALL SELECT 'estoque_movimentos', count(*) FROM estoque_movimentos WHERE empresa_id IN (SELECT id FROM empresas WHERE nome IN ('Empresa QA App','Empresa Teste QA'))
UNION ALL SELECT 'despesas', count(*) FROM despesas WHERE empresa_id IN (SELECT id FROM empresas WHERE nome IN ('Empresa QA App','Empresa Teste QA'))
UNION ALL SELECT 'agendamentos', count(*) FROM agendamentos WHERE empresa_id IN (SELECT id FROM empresas WHERE nome IN ('Empresa QA App','Empresa Teste QA'))
UNION ALL SELECT 'equipamentos', count(*) FROM equipamentos WHERE empresa_id IN (SELECT id FROM empresas WHERE nome IN ('Empresa QA App','Empresa Teste QA'))
UNION ALL SELECT 'usuarios', count(*) FROM usuarios WHERE empresa_id IN (SELECT id FROM empresas WHERE nome IN ('Empresa QA App','Empresa Teste QA'))
UNION ALL SELECT 'membros', count(*) FROM membros WHERE empresa_id IN (SELECT id FROM empresas WHERE nome IN ('Empresa QA App','Empresa Teste QA'));

-- Se quiser checar se algum teste "vazou" para FORA das 2 empresas de QA (ex.: se
-- algum orçamento de teste foi criado sem querer dentro da Forthemp/Fluxa real),
-- rode este SELECT e confira manualmente antes de decidir apagar algo aqui:
SELECT id, cliente, numero, empresa_id, data_criacao FROM orcamentos
WHERE cliente ILIKE ANY (ARRAY['%teste%','%dbg%','%dupe%','%iso_%','%fix dupe%','%pagamento persiste%','%cont chamadas%'])
  AND empresa_id NOT IN (SELECT id FROM empresas WHERE nome IN ('Empresa QA App','Empresa Teste QA'));

-- ═══════════ PARTE 2 — DELETE (só rode depois de conferir a Parte 1) ═══════════
-- Cascateia para orcamentos, ordens_servico, clientes, produtos, estoque_movimentos,
-- despesas, agendamentos, equipamentos, vistorias, locais_vistoria, usuarios,
-- notas_fiscais, fornecedores, ordens_compra, membros, contadores, insights.
DELETE FROM empresas WHERE nome IN ('Empresa QA App', 'Empresa Teste QA');

-- ═══════════ PARTE 3 — usuários de teste no Auth (fazer manualmente) ═══════════
-- O DELETE acima remove o VÍNCULO em `membros`, mas NÃO apaga a conta de login em
-- si (auth.users) — isso exige o painel (não dá para fazer via SQL Editor comum).
-- No Supabase: Authentication → Users → localizar e-mails como
--   *@exemplo.com, qa_app_1@... (e outros de teste que você reconhecer)
-- → selecionar → Delete user.
