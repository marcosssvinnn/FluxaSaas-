-- delta40 — push ao finalizar vistoria com item crítico (app fechado)
--
-- Espelha o padrão do delta25 (push ao aprovar orçamento pelo portal): a
-- empresa é derivada da PRÓPRIA linha da vistoria (não vem do cliente), o
-- segredo interno sai do Vault, e a falha de push nunca derruba a operação.
--
-- O cliente chama esta RPC UMA vez ao finalizar a vistoria. push_critico_em
-- é a trava: só envia se ainda não enviou pra este ciclo de finalização.

ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS push_critico_em timestamptz;

CREATE OR REPLACE FUNCTION public.notificar_vistoria_critica(p_vis_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vis vistorias%ROWTYPE;
  v_criticos int;
  v_secret text;
BEGIN
  SELECT * INTO v_vis FROM vistorias WHERE id = p_vis_id LIMIT 1;
  IF v_vis.id IS NULL THEN RETURN false; END IF;

  -- Chamador tem que ser membro da MESMA empresa da vistoria (anti-spoofing).
  IF NOT EXISTS (SELECT 1 FROM membros WHERE empresa_id = v_vis.empresa_id AND user_id = auth.uid()) THEN
    RETURN false;
  END IF;

  -- Já notificado neste ciclo? não repete.
  IF v_vis.push_critico_em IS NOT NULL THEN RETURN false; END IF;

  -- Conta itens críticos no jsonb equipamentos.
  SELECT count(*) INTO v_criticos
  FROM jsonb_array_elements(COALESCE(v_vis.equipamentos, '[]'::jsonb)) e
  WHERE e->>'status' = 'critico';

  IF v_criticos < 1 THEN RETURN false; END IF;

  UPDATE vistorias SET push_critico_em = now() WHERE id = p_vis_id;

  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_internal_secret';
    IF v_secret IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://auoklaiffalbdgazrbdu.supabase.co/functions/v1/enviar-push',
        body := jsonb_build_object(
          'empresa_id', v_vis.empresa_id,
          'titulo', '🔴 Vistoria com item crítico',
          'corpo', COALESCE(v_vis.cliente,'Cliente') || ' — ' || v_criticos || ' item(ns) crítico(s) apontado(s) na vistoria',
          'url', '/#visitas',
          'perfis_alvo', jsonb_build_array('gestor','master')
        ),
        headers := jsonb_build_object('Content-Type','application/json','x-push-secret', v_secret),
        timeout_milliseconds := 5000
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- push nunca derruba a finalização
  END;

  RETURN true;
END $function$;

REVOKE ALL ON FUNCTION public.notificar_vistoria_critica(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.notificar_vistoria_critica(text) TO authenticated;
NOTIFY pgrst, 'reload schema';
