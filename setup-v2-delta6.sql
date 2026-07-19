-- FLUXA V2 — DELTA 6: verificação de PIN movida pro servidor (achado da auditoria)
-- Rode UMA vez no SQL Editor. Idempotente.
--
-- Problema encontrado: a verificação de PIN interno (gestor/vendas/técnico) rodava
-- no CLIENTE — o app baixava o hash de TODOS os usuários da empresa (usuarios.pin)
-- pra comparar localmente. Como o salt é FIXO ('fluxa2025') pra todo o sistema, um
-- hash SHA-256 de um PIN de 4 dígitos é revertido instantaneamente com uma tabela
-- pré-computada (10.000 combinações). Qualquer pessoa autenticada na empresa podia
-- extrair e reverter o PIN de qualquer colega (inclusive gestor) e se passar por ele.
--
-- Fix: a comparação agora roda DENTRO desta função (SECURITY DEFINER) — o hash
-- nunca sai do banco. O app manda só o PIN digitado e recebe true/false.

CREATE OR REPLACE FUNCTION verificar_pin_interno(p_empresa uuid, p_usuario_id text, p_pin_tentado text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_hash_tentado text := encode(digest(coalesce(p_pin_tentado,'') || 'fluxa2025', 'sha256'), 'hex');
  v_cfg_pin text;
  v_usr usuarios%ROWTYPE;
  v_ok boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF p_empresa IS NULL OR p_empresa NOT IN (SELECT minhas_empresas()) THEN
    RAISE EXCEPTION 'sem acesso a esta empresa';
  END IF;

  SELECT config->>'pin' INTO v_cfg_pin FROM empresas WHERE id = p_empresa;

  -- "__gestor__" (ou nulo) = fallback do gestor principal, compara com empresas.config.pin
  IF p_usuario_id IS NULL OR p_usuario_id = '__gestor__' THEN
    IF v_cfg_pin IS NULL OR v_cfg_pin = '' THEN v_ok := (p_pin_tentado = '1234');
    ELSIF length(v_cfg_pin) = 64 THEN v_ok := (v_hash_tentado = v_cfg_pin);
    ELSE v_ok := (v_cfg_pin = p_pin_tentado); END IF; -- legado texto plano
    RETURN v_ok;
  END IF;

  SELECT * INTO v_usr FROM usuarios WHERE id = p_usuario_id AND empresa_id = p_empresa;
  IF v_usr.id IS NULL THEN RETURN false; END IF;

  IF v_usr.pin IS NOT NULL AND v_usr.pin <> '' THEN
    IF length(v_usr.pin) = 64 THEN v_ok := (v_hash_tentado = v_usr.pin);
    ELSE v_ok := (v_usr.pin = p_pin_tentado); END IF; -- legado texto plano
  END IF;

  -- usuário sem PIN próprio -> cai no PIN do gestor (mesmo comportamento de antes)
  IF NOT v_ok AND (v_usr.pin IS NULL OR v_usr.pin = '') THEN
    IF v_cfg_pin IS NULL OR v_cfg_pin = '' THEN v_ok := (p_pin_tentado = '1234');
    ELSIF length(v_cfg_pin) = 64 THEN v_ok := (v_hash_tentado = v_cfg_pin);
    ELSE v_ok := (v_cfg_pin = p_pin_tentado); END IF;
  END IF;

  RETURN v_ok;
END $$;
GRANT EXECUTE ON FUNCTION verificar_pin_interno(uuid, text, text) TO authenticated;

-- View sem o hash cru — a lista de usuários (nomes pro seletor de login, indicador
-- "PIN definido?") passa a usar isto em vez da tabela usuarios direto.
CREATE OR REPLACE VIEW usuarios_lista WITH (security_invoker = true) AS
SELECT id, empresa_id, nome, perfil, loja_id, loja_nome, ativo, data_criacao,
       (pin IS NOT NULL AND pin <> '') AS tem_pin
FROM usuarios;
GRANT SELECT ON usuarios_lista TO authenticated;

NOTIFY pgrst, 'reload schema';
