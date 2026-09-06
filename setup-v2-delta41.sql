-- delta41 — push pro técnico quando uma OS é atribuída/agendada pra ele
--
-- Mesmo padrão server-side dos deltas 25/40: empresa derivada da própria OS,
-- segredo do Vault, à prova de falha. Resolve o técnico (nome na OS) → user_id
-- via membros (perfil tecnico), e manda push SÓ pra ele (user_ids na edge fn).
-- Técnico que nunca logou (sem membros/subscription) simplesmente não recebe.

ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS push_tec_em timestamptz;

CREATE OR REPLACE FUNCTION public.notificar_os_tecnico(p_os_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_os ordens_servico%ROWTYPE;
  v_uid uuid;
  v_secret text;
  v_data text;
BEGIN
  SELECT * INTO v_os FROM ordens_servico WHERE id = p_os_id LIMIT 1;
  IF v_os.id IS NULL THEN RETURN false; END IF;

  -- Chamador tem que ser membro da empresa da OS (anti-spoofing cross-tenant).
  IF NOT EXISTS (SELECT 1 FROM membros WHERE empresa_id = v_os.empresa_id AND user_id = auth.uid()) THEN
    RETURN false;
  END IF;

  IF v_os.push_tec_em IS NOT NULL THEN RETURN false; END IF;               -- já avisou
  IF COALESCE(v_os.tecnico,'') = '' OR v_os.status <> 'agendado' THEN RETURN false; END IF;

  -- Técnico (nome na OS) → user_id do membro técnico da mesma empresa.
  SELECT user_id INTO v_uid FROM membros
    WHERE empresa_id = v_os.empresa_id AND perfil = 'tecnico'
      AND lower(trim(nome)) = lower(trim(v_os.tecnico))
    LIMIT 1;
  IF v_uid IS NULL THEN RETURN false; END IF;                              -- técnico sem conta/inscrição

  UPDATE ordens_servico SET push_tec_em = now() WHERE id = p_os_id;

  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_internal_secret';
    v_data := COALESCE(to_char(v_os.data_servico, 'DD/MM'), '');
    IF v_secret IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://auoklaiffalbdgazrbdu.supabase.co/functions/v1/enviar-push',
        body := jsonb_build_object(
          'empresa_id', v_os.empresa_id,
          'titulo', '📋 Nova OS pra você',
          'corpo', COALESCE(v_os.cliente,'Cliente') || CASE WHEN v_data <> '' THEN ' · ' || v_data ELSE '' END || CASE WHEN v_os.local_servico IS NOT NULL AND v_os.local_servico <> '' THEN ' · ' || v_os.local_servico ELSE '' END,
          'url', '/#minhas-os',
          'user_ids', jsonb_build_array(v_uid)
        ),
        headers := jsonb_build_object('Content-Type','application/json','x-push-secret', v_secret),
        timeout_milliseconds := 5000
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN true;
END $function$;

REVOKE ALL ON FUNCTION public.notificar_os_tecnico(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.notificar_os_tecnico(text) TO authenticated;
NOTIFY pgrst, 'reload schema';
