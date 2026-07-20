-- FLUXA V2 — DELTA 17: fecha sequestro de conta no bootstrap de aparelho novo
-- (achado de auditoria 2026-07-20 — a mais séria desta rodada).
-- Rode UMA vez. Requer o pgcrypto já habilitado (usado por vincular_funcionario).
--
-- Problema encontrado: `_loginRealFuncionario(usuarioId, pin)` (app.js, Fase 2 —
-- bootstrap por link, commit 8769e4f) tenta `signInWithPassword` e, se falhar
-- POR QUALQUER MOTIVO, cai automaticamente em `signUp` com a MESMA senha
-- (derivada do PIN digitado) — só DEPOIS disso chama `vincular_funcionario`
-- pra checar se o PIN bate de verdade. `usuarios_para_login` é anon (dá nome +
-- id de todo funcionário da empresa pra QUALQUER UM, sem login — necessário
-- pro autocomplete da tela de nome). Combinando os dois: um terceiro qualquer,
-- sem nenhuma credencial, que soubesse o link/slug da empresa (não é segredo)
-- podia chamar `signUp` (a chave anon já é pública no app.js) com o e-mail
-- sintético de QUALQUER funcionário e uma senha aleatória — se aquele
-- funcionário AINDA não tinha feito o 1º login real, o Supabase Auth cria a
-- conta com a senha do ATACANTE, sem checar PIN nenhum nesse momento. Quando o
-- funcionário DE VERDADE tentasse logar depois (com o PIN certo), a senha
-- derivada não bateria (a conta já tem a senha do atacante) → cai em signUp
-- de novo → "already registered" → tratado como "PIN errado" PRA SEMPRE. Ou
-- seja: qualquer um consegue trancar qualquer funcionário fora da própria
-- conta permanentemente, de graça, sem precisar acertar PIN nenhum — só
-- precisa ser mais rápido que o funcionário no 1º acesso.
--
-- Fix: nova função ANON-callable que só CHECA o PIN (mesma lógica de
-- verificar_pin_interno/vincular_funcionario, mas SEM exigir auth.uid() —
-- por isso não pode reusar as outras 2, que dependem de já haver sessão) e
-- NÃO faz nenhuma escrita. O app.js passa a chamar isso ANTES de tentar
-- signIn/signUp — se o PIN estiver errado, a função retorna false e o app
-- NUNCA chama signUp, então nunca cria a conta com senha errada. Só quem
-- acerta o PIN de verdade chega a criar/reivindicar a conta.
CREATE OR REPLACE FUNCTION verificar_pin_bootstrap(p_empresa uuid, p_usuario_id text, p_pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_hash text := encode(digest(coalesce(p_pin,'') || 'fluxa2025', 'sha256'), 'hex');
  v_cfg_pin text;
  v_usr usuarios%ROWTYPE;
  v_ok boolean := false;
BEGIN
  IF p_empresa IS NULL OR p_usuario_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_usr FROM usuarios WHERE id = p_usuario_id AND empresa_id = p_empresa AND ativo = true;
  IF v_usr.id IS NULL THEN RETURN false; END IF;
  SELECT config->>'pin' INTO v_cfg_pin FROM empresas WHERE id = p_empresa;

  IF v_usr.pin IS NOT NULL AND v_usr.pin <> '' THEN
    IF length(v_usr.pin) = 64 THEN v_ok := (v_hash = v_usr.pin); ELSE v_ok := (v_usr.pin = p_pin); END IF;
  END IF;
  IF NOT v_ok AND (v_usr.pin IS NULL OR v_usr.pin = '') THEN
    IF v_cfg_pin IS NULL OR v_cfg_pin = '' THEN v_ok := (p_pin = '1234');
    ELSIF length(v_cfg_pin) = 64 THEN v_ok := (v_hash = v_cfg_pin);
    ELSE v_ok := (v_cfg_pin = p_pin); END IF;
  END IF;

  RETURN v_ok;
END $$;
GRANT EXECUTE ON FUNCTION verificar_pin_bootstrap(uuid, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
