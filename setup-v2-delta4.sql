-- FLUXA V2 — DELTA 4: nome da pessoa no cadastro + auto-login sem PIN para membros
-- Rode UMA vez no SQL Editor. Idempotente.
--
-- Problema: quem cria a conta (o gestor) tinha que passar por uma 2ª tela de
-- "nome + PIN" depois do e-mail+senha — confuso e redundante (a conta já provou
-- quem é). Agora: o cadastro pede também "Seu nome", guardado em membros.nome;
-- o app usa isso para logar o membro direto na empresa, sem PIN. O PIN interno
-- continua existindo só para perfis criados DEPOIS pelo gestor (vendas/técnico/
-- outros gestores) via tela de Usuários — pensado para dispositivo compartilhado.

ALTER TABLE membros ADD COLUMN IF NOT EXISTS nome text;
UPDATE membros SET nome = 'Gestor' WHERE nome IS NULL;

-- Precisa derrubar a versão antiga (assinatura com 1 parâmetro) antes de criar a
-- nova com 2 parâmetros — senão as duas coexistem como funções sobrecarregadas.
DROP FUNCTION IF EXISTS criar_empresa(text);

CREATE OR REPLACE FUNCTION criar_empresa(p_nome text, p_nome_usuario text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  INSERT INTO empresas (nome, slug, config)
  VALUES (
    p_nome,
    regexp_replace(lower(p_nome), '[^a-z0-9]+', '-', 'g') || '-' || substr(gen_random_uuid()::text, 1, 4),
    jsonb_build_object('nome', p_nome, 'appName', p_nome)
  )
  RETURNING id INTO v_id;
  INSERT INTO membros (user_id, empresa_id, perfil, nome) VALUES (auth.uid(), v_id, 'gestor', COALESCE(p_nome_usuario, 'Gestor'));
  INSERT INTO lojas (empresa_id, nome) VALUES (v_id, p_nome);
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION criar_empresa(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
