-- FLUXA V2 — DELTA 5: corrige portal_responder_orcamento desatualizada no banco
-- JÁ APLICADO ao banco em 2026-07-18 (via PAT). Este arquivo é só o registro —
-- não precisa rodar de novo, é idempotente se precisar.
--
-- Achado durante bateria de testes de regressão: o banco tinha a versão ANTIGA
-- de portal_responder_orcamento (3 parâmetros, sem p_assinatura), embora o
-- código (app.js, desde a T11) e o setup-v2.sql já chamassem/definissem a versão
-- de 4 parâmetros. Resultado: aprovar um orçamento COM assinatura pelo portal
-- retornava erro 404 PGRST202 ("function ... does not exist"). Reproduzido e
-- confirmado via curl antes do fix.

CREATE OR REPLACE FUNCTION portal_responder_orcamento(p_token uuid, p_orc_id uuid, p_aprovar boolean, p_assinatura jsonb DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cli clientes%ROWTYPE;
BEGIN
  SELECT * INTO v_cli FROM clientes
    WHERE portal_token = p_token AND portal_ativo = true
    LIMIT 1;
  IF v_cli.id IS NULL THEN RETURN false; END IF;
  UPDATE orcamentos
    SET status = CASE WHEN p_aprovar THEN 'aprovado' ELSE 'recusado' END,
        assinatura_base64 = COALESCE(p_assinatura->>'base64', assinatura_base64),
        assinatura_data   = CASE WHEN p_assinatura IS NOT NULL THEN now() ELSE assinatura_data END,
        assinatura_hash   = COALESCE(p_assinatura->>'hash', assinatura_hash),
        assinatura_meta   = COALESCE(p_assinatura->>'meta', assinatura_meta)
    WHERE id = p_orc_id
      AND empresa_id = v_cli.empresa_id
      AND cliente = v_cli.nome
      AND status = 'pendente';
  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION portal_responder_orcamento(uuid, uuid, boolean, jsonb) TO anon;

NOTIFY pgrst, 'reload schema';
