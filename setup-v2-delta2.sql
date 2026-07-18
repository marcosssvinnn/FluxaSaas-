-- FLUXA V2 — DELTA 2: corrige criar_empresa para semear config.nome/appName
-- Rode UMA vez no SQL Editor do Supabase. Idempotente (CREATE OR REPLACE).
--
-- Problema: a empresa criada pelo onboarding ("Criar minha empresa") nascia com
-- config = '{}' — o CFG.nome do app ficava vazio e o cabeçalho/tela de login
-- mostravam "Minha Empresa" até o gestor preencher manualmente em Dados da Empresa.
--
-- Nota sobre "usuário gestor inicial": NÃO foi criado um registro em `usuarios`
-- automaticamente. Não é necessário — o primeiro login já funciona via o
-- fallback "Gestor" (PIN 1234 ou CFG.pin, comparação em texto plano no app) sem
-- precisar de nenhuma linha extra no banco. Além disso, o formulário de onboarding
-- não pede o nome da PESSOA (só nome da empresa + e-mail + senha), então não há
-- um nome real para semear num usuário "bonito" — o fallback genérico já resolve.

CREATE OR REPLACE FUNCTION criar_empresa(p_nome text)
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
  INSERT INTO membros (user_id, empresa_id, perfil) VALUES (auth.uid(), v_id, 'gestor');
  INSERT INTO lojas (empresa_id, nome) VALUES (v_id, p_nome);
  RETURN v_id;
END $$;

-- ───────── Empresas já existentes SEM config.nome (criadas antes deste fix) ─────────
-- Preenche o config das empresas que já existem e ainda não têm nome no config
-- (não sobrescreve config de quem já configurou algo em Dados da Empresa).
UPDATE empresas
SET config = config || jsonb_build_object('nome', nome, 'appName', nome)
WHERE (config->>'nome') IS NULL;

NOTIFY pgrst, 'reload schema';
