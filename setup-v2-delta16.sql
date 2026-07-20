-- FLUXA V2 — DELTA 16: trava no servidor pra ajuste manual/transferência de estoque
-- (achado de auditoria 2026-07-20 — varredura de RLS via Management API).
-- Rode UMA vez. Idempotente (DROP POLICY IF EXISTS + CREATE).
--
-- Problema encontrado: a policy de INSERT de `estoque_movimentos` só verifica
-- `empresa_id IN minhas_empresas()` — QUALQUER papel autenticado (inclusive
-- técnico) pode inserir um movimento de estoque de QUALQUER tipo, com
-- quantidade e custo arbitrários, direto pela API REST — sem passar pela UI
-- nem pela lógica de reserva/entrega. Na UI, a tela de Estoque inteira já é
-- restrita a gestor (`snb-estoque: gestor`, ver aplicarPermissoesPerfil() em
-- app.js) — ou seja, "ajuste" manual (correção de saldo/balanço de
-- inventário) e transferência entre lojas (`transferirProduto`) só têm UM
-- caminho de disparo no app inteiro, e esse caminho já é gestor-only. Mas
-- isso hoje é só um guardrail de TELA (esconder o botão) — exatamente o
-- padrão que o próprio CLAUDE.md já alerta ("go()/eGestor() são guardrails
-- de UI, não de servidor"): um técnico com acesso a devtools/Postman e o
-- próprio JWT válido podia inserir um "ajuste" arbitrário (ex.: encobrir
-- furto reduzindo o saldo, ou inflar estoque disponível) sem nenhuma
-- barreira real.
--
-- Fix: trava só os tipos que NÃO têm nenhum disparo legítimo de
-- técnico/vendas em lugar nenhum do código (`ajuste`, `transf_entrada`,
-- `transf_saida` — confirmado por busca no app.js, únicos 2 pontos de
-- disparo de cada, ambos dentro da tela de Estoque). NÃO mexe em
-- `entrada`/`saida`/`reserva`/`liberacao_reserva`, que têm fluxos legítimos
-- de técnico (conclusão de OS baixa estoque) e vendas (entrega de
-- orçamento aprovado) — restringir esses quebraria comportamento real.
CREATE OR REPLACE FUNCTION _mov_insert_permitido(p_empresa uuid, p_tipo text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_empresa IN (SELECT minhas_empresas())
    AND (p_tipo NOT IN ('ajuste','transf_entrada','transf_saida') OR meu_perfil(p_empresa) = 'gestor');
$$;

DROP POLICY IF EXISTS "mov ins" ON estoque_movimentos;
CREATE POLICY "mov ins" ON estoque_movimentos FOR INSERT TO authenticated
  WITH CHECK (_mov_insert_permitido(empresa_id, tipo));

NOTIFY pgrst, 'reload schema';
