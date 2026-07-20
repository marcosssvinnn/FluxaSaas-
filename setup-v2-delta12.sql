-- FLUXA V2 — DELTA 12: reduz exposição de usuarios_para_login pra anon (achado de auditoria)
-- Rode UMA vez no SQL Editor. Idempotente (CREATE OR REPLACE).
--
-- Problema encontrado: usuarios_para_login(p_empresa) está liberada pra `anon`
-- (necessário — é usada pra montar a tela de nome+PIN num aparelho novo, antes
-- do funcionário ter qualquer sessão). Mas devolvia `perfil` junto — qualquer
-- pessoa na internet, sem login nenhum, que soubesse o empresa_id de uma
-- empresa conseguia listar não só os nomes dos funcionários mas também o
-- CARGO de cada um (gestor/vendas/técnico). Não é usada pelo app.js ainda
-- (função preparada pra Fase 2, wiring do bootstrapping de aparelho novo
-- ainda não implementado) — seguro reduzir o retorno agora, antes de ligar.
--
-- Fix: remove `perfil` do retorno. Mantém id/nome/loja_id (necessários pra
-- identificar a pessoa e a loja preferida na tela de login).
CREATE OR REPLACE FUNCTION usuarios_para_login(p_empresa uuid)
RETURNS TABLE(id text, nome text, loja_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, nome, loja_id FROM usuarios WHERE empresa_id = p_empresa AND ativo = true;
$$;
GRANT EXECUTE ON FUNCTION usuarios_para_login(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
