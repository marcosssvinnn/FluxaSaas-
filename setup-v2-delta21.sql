-- FLUXA V2 — DELTA 21: armazenamento seguro do certificado A1 (Fase 1 fiscal, Marco 1)
-- Rode UMA vez. Requer supabase_vault (já habilitado neste projeto, confirmado
-- via Management API em 2026-07-20).
--
-- Contexto: cada empresa terá seu próprio certificado digital A1 (.pfx + senha)
-- pra assinar notas fiscais (NFS-e Nacional). O certificado NUNCA pode ficar
-- numa tabela legível por authenticated/anon — mesmo com RLS, um segredo desse
-- tipo não deveria estar em texto plano em lugar nenhum acessível via PostgREST.
-- Usa o Supabase Vault (segredo criptografado nativamente, pgsodium por baixo)
-- e funções SECURITY DEFINER acessíveis SÓ pela service_role key (nunca
-- authenticated/anon) — diferente de todo o resto das RPCs deste projeto, que
-- são authenticated-callable. Aqui a regra é "só o microsserviço fiscal, nunca
-- ninguém logado, nem gestor via SQL direto".
--
-- Fluxo de upload (implementado no microsserviço do Marco 2, não aqui):
--   1. Navegador chama iniciar_upload_certificado() (authenticated, checa
--      gestor da empresa) → recebe um token de uso único, expira em 10 min.
--   2. Navegador manda o .pfx + senha + token DIRETO pro microsserviço
--      (nunca passa pelo PostgREST/Postgres) via HTTPS.
--   3. Microsserviço chama consumir_token_upload_certificado(token) — só ele
--      tem a service_role key — valida e marca o token usado.
--   4. Microsserviço chama salvar_certificado_empresa(...) — grava no Vault.
--      A senha e os bytes do .pfx nunca tocam uma tabela comum, só o Vault.

CREATE TABLE IF NOT EXISTS certificados_fiscais (
  empresa_id uuid PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  vault_pfx_id uuid NOT NULL,
  vault_senha_id uuid NOT NULL,
  -- metadados públicos do certificado (não são segredo — só pra exibir na UI,
  -- ex.: "Certificado Fluxa Piscinas — válido até 12/2027")
  cn text,
  valido_ate timestamptz,
  atualizado_em timestamptz DEFAULT now()
);
ALTER TABLE certificados_fiscais ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy pra authenticated/anon de propósito — nem gestor lê esta
-- tabela direto via API; só o microsserviço (service_role, que ignora RLS)
-- acessa. O que a UI mostra (CN/validade) vem de certificado_status_empresa()
-- abaixo, não de um SELECT direto nesta tabela.

CREATE TABLE IF NOT EXISTS certificado_upload_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  criado_por uuid NOT NULL REFERENCES auth.users(id),
  criado_em timestamptz DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  usado boolean DEFAULT false
);
ALTER TABLE certificado_upload_tokens ENABLE ROW LEVEL SECURITY;
-- Idem: sem policy pra authenticated/anon — o token é de uso único e só
-- trafega entre o navegador (que recebe o valor no retorno da função abaixo)
-- e o microsserviço (que o consome via service_role); não precisa nem faz
-- sentido ser lido de volta via SELECT.

-- Chamada pelo navegador (authenticated) — só gestor da empresa pode iniciar.
CREATE OR REPLACE FUNCTION iniciar_upload_certificado(p_empresa uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF meu_perfil(p_empresa) IS DISTINCT FROM 'gestor' THEN
    RAISE EXCEPTION 'só o gestor da empresa pode enviar certificado fiscal';
  END IF;
  INSERT INTO certificado_upload_tokens (empresa_id, criado_por)
  VALUES (p_empresa, auth.uid())
  RETURNING token INTO v_token;
  RETURN v_token;
END $$;
GRANT EXECUTE ON FUNCTION iniciar_upload_certificado(uuid) TO authenticated;

-- Chamada SÓ pelo microsserviço (service_role) — nunca pelo app/navegador.
CREATE OR REPLACE FUNCTION consumir_token_upload_certificado(p_token uuid)
RETURNS uuid -- empresa_id se o token for válido e ainda não usado; NULL senão
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_empresa uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'acesso negado — função exclusiva do microsserviço fiscal';
  END IF;
  UPDATE certificado_upload_tokens
    SET usado = true
    WHERE token = p_token AND usado = false AND expira_em > now()
    RETURNING empresa_id INTO v_empresa;
  RETURN v_empresa;
END $$;
-- REVOKE explícito de anon/authenticated (não só PUBLIC!) — achado ao testar:
-- este projeto tem privilégio padrão que concede EXECUTE em toda função nova
-- pra anon/authenticated automaticamente na criação. "FROM PUBLIC" sozinho
-- NÃO revoga esses grants específicos (são grants próprios dos roles, feitos
-- via default privileges, não herdados de PUBLIC) — testado e confirmado via
-- information_schema.routine_privileges antes/depois desta correção.
REVOKE ALL ON FUNCTION consumir_token_upload_certificado(uuid) FROM PUBLIC, anon, authenticated;

-- Chamada SÓ pelo microsserviço (service_role). Grava .pfx (base64) + senha no
-- Vault; a tabela certificados_fiscais só guarda os IDs dos segredos + metadados
-- públicos (CN/validade), nunca o conteúdo em si.
CREATE OR REPLACE FUNCTION salvar_certificado_empresa(
  p_empresa uuid, p_pfx_base64 text, p_senha text, p_cn text, p_valido_ate timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_pfx_id uuid; v_senha_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'acesso negado — função exclusiva do microsserviço fiscal';
  END IF;
  v_pfx_id := vault.create_secret(p_pfx_base64, 'cert_pfx_'||p_empresa::text, 'certificado A1 (.pfx base64) — empresa '||p_empresa::text);
  v_senha_id := vault.create_secret(p_senha, 'cert_senha_'||p_empresa::text, 'senha do certificado A1 — empresa '||p_empresa::text);
  INSERT INTO certificados_fiscais (empresa_id, vault_pfx_id, vault_senha_id, cn, valido_ate)
  VALUES (p_empresa, v_pfx_id, v_senha_id, p_cn, p_valido_ate)
  ON CONFLICT (empresa_id) DO UPDATE SET
    vault_pfx_id = EXCLUDED.vault_pfx_id,
    vault_senha_id = EXCLUDED.vault_senha_id,
    cn = EXCLUDED.cn,
    valido_ate = EXCLUDED.valido_ate,
    atualizado_em = now();
END $$;
REVOKE ALL ON FUNCTION salvar_certificado_empresa(uuid,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;

-- Chamada SÓ pelo microsserviço (service_role), no momento de assinar uma nota.
CREATE OR REPLACE FUNCTION obter_certificado_empresa(p_empresa uuid)
RETURNS TABLE(pfx_base64 text, senha text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'acesso negado — função exclusiva do microsserviço fiscal';
  END IF;
  RETURN QUERY
    SELECT ds1.decrypted_secret, ds2.decrypted_secret
    FROM certificados_fiscais c
    JOIN vault.decrypted_secrets ds1 ON ds1.id = c.vault_pfx_id
    JOIN vault.decrypted_secrets ds2 ON ds2.id = c.vault_senha_id
    WHERE c.empresa_id = p_empresa;
END $$;
REVOKE ALL ON FUNCTION obter_certificado_empresa(uuid) FROM PUBLIC, anon, authenticated;

-- Metadados públicos (CN/validade) — pra UI mostrar "certificado configurado,
-- válido até X" sem precisar chamar o microsserviço a cada carregamento de tela.
-- Por isso é uma FUNCTION que retorna só os 2 campos públicos, não um SELECT
-- direto na tabela (que não tem policy nenhuma, de propósito).
CREATE OR REPLACE FUNCTION certificado_status_empresa(p_empresa uuid)
RETURNS TABLE(cn text, valido_ate timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF meu_perfil(p_empresa) IS DISTINCT FROM 'gestor' THEN
    RAISE EXCEPTION 'sem acesso';
  END IF;
  RETURN QUERY SELECT c.cn, c.valido_ate FROM certificados_fiscais c WHERE c.empresa_id = p_empresa;
END $$;
GRANT EXECUTE ON FUNCTION certificado_status_empresa(uuid) TO authenticated;

-- Prepara a coluna que vai deixar a porta aberta pra emitir a partir da OS no
-- futuro (ver "ponto em aberto" no plano — decisão fica com o contador do Marcos,
-- não é ligada nesta fase; só evita ter que migrar o schema de novo depois).
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS os_id uuid;

NOTIFY pgrst, 'reload schema';
