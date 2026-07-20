-- FLUXA V2 — DELTA 12: reduz exposição de usuarios_para_login pra anon (achado de auditoria)
--
-- ⚠️ NÃO APLICADO (conflito descoberto em 2026-07-20) — NÃO RODAR sem falar com
-- o Marcos antes. Quando este delta foi escrito, usuarios_para_login não era
-- chamada por nenhum lugar do app.js. Depois disso, outra sessão/IA implementou
-- o bootstrap de aparelho novo (_bootstrapTecnico, commit 8769e4f) que USA
-- `perfil` de verdade — alimenta o ícone de cargo (👑🛡️💼🔧) na tela de login
-- por nome, antes de qualquer autenticação, e uma checagem de lógica
-- (renderLoginUsers). Rodar isto como está QUEBRA essa feature. Ver nota
-- completa em CLAUDE.md ("Revisão independente do setup-v2-optionA-perfil.sql").
--
-- Problema encontrado (achado original, ainda válido): usuarios_para_login(p_empresa)
-- está liberada pra `anon` (necessário — é usada pra montar a tela de nome+PIN
-- num aparelho novo, antes do funcionário ter qualquer sessão). Mas devolve
-- `perfil` junto — qualquer pessoa na internet, sem login nenhum, que soubesse
-- o empresa_id/slug de uma empresa consegue listar não só os nomes dos
-- funcionários mas também o CARGO de cada um (gestor/vendas/técnico).
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
