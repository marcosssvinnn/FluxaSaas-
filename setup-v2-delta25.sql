-- ============================================================================
-- DELTA 25 — Push no aprovar orçamento pelo portal (Sprint 1, plano mobile)
-- Aplicado ao banco em 2026-07-21 via Management API. Arquivo é o histórico.
-- ============================================================================
-- portal_responder_orcamento (versão com assinatura, 4 params — a "real";
-- existe uma sobrecarga de 3 params mais antiga no banco que NÃO foi tocada
-- aqui, achado incidental, registrar em Perguntas em aberto) passa a disparar
-- uma chamada assíncrona (pg_net, não bloqueia a resposta ao cliente) pra
-- Edge Function `enviar-push` quando o cliente APROVA um orçamento pelo
-- portal — avisa gestor/master na hora, mesmo com o app fechado.
--
-- Autenticação da chamada: header x-push-secret com o segredo guardado no
-- Vault (nunca no código, nunca no cliente) — a Edge Function só aceita
-- chamadas com esse header OU um JWT de usuário autenticado.
--
-- 🔴 BUG PRÉ-EXISTENTE ENCONTRADO E CORRIGIDO NO CAMINHO: a versão anterior
-- desta função (4 params, com assinatura) fazia UPDATE referenciando as
-- colunas assinatura_data/assinatura_hash/assinatura_meta — que NUNCA
-- existiram em orcamentos (só assinatura_base64 existe). Como a referência
-- está no próprio SET (não só no valor condicional), o UPDATE falhava com
-- "column does not exist" em TODA chamada — aprovar OU recusar, com ou sem
-- assinatura. Ou seja: o fluxo de aprovação pelo portal estava
-- silenciosamente quebrado pra QUALQUER cliente que tentasse responder um
-- orçamento, desde que essa versão da função foi publicada. Achado ao testar
-- esta mudança (não é causado por ela) — corrigido junto, removendo as
-- colunas fantasma e mantendo só assinatura_base64 (que já é usada pelo
-- resto do app).

-- Idempotência: a própria condição "AND status = 'pendente'" do UPDATE abaixo
-- já garante que uma segunda chamada pro mesmo orçamento não encontra linha
-- (RETURNING vazio) e portanto não reenvia push — sem precisar de coluna nova.

CREATE OR REPLACE FUNCTION public.portal_responder_orcamento(p_token uuid, p_orc_id uuid, p_aprovar boolean, p_assinatura jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cli clientes%ROWTYPE;
  v_orc orcamentos%ROWTYPE;
  v_secret text;
BEGIN
  SELECT * INTO v_cli FROM clientes
    WHERE portal_token = p_token AND portal_ativo = true
    LIMIT 1;
  IF v_cli.id IS NULL THEN RETURN false; END IF;

  UPDATE orcamentos
    SET status = CASE WHEN p_aprovar THEN 'aprovado' ELSE 'recusado' END,
        assinatura_base64 = COALESCE(p_assinatura->>'base64', assinatura_base64)
    WHERE id = p_orc_id
      AND empresa_id = v_cli.empresa_id
      AND (cliente_id = v_cli.id OR (cliente_id IS NULL AND cliente = v_cli.nome))
      AND status = 'pendente'
    RETURNING * INTO v_orc;

  IF v_orc.id IS NOT NULL AND p_aprovar THEN
    BEGIN
      SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_internal_secret';
      IF v_secret IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://auoklaiffalbdgazrbdu.supabase.co/functions/v1/enviar-push',
          body := jsonb_build_object(
            'empresa_id', v_orc.empresa_id,
            'titulo', '✅ Orçamento aprovado!',
            'corpo', v_cli.nome || ' aprovou o orçamento #' || lpad(v_orc.numero::text, 3, '0') || ' (' || to_char(v_orc.total, 'FM999G999G990D00') || ')',
            'url', '/#history',
            'perfis_alvo', jsonb_build_array('gestor', 'master')
          ),
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
          timeout_milliseconds := 5000
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Falha ao notificar NUNCA pode derrubar a aprovação do orçamento em si.
      NULL;
    END;
  END IF;

  RETURN v_orc.id IS NOT NULL;
END $function$;
