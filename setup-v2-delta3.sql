-- FLUXA V2 — DELTA 3: painel ROOT da plataforma (admin do SaaS, cross-tenant)
-- Aditivo e idempotente. NÃO altera nenhuma policy de isolamento por empresa já
-- existente — as 15 tabelas de tenant continuam só acessíveis via minhas_empresas().
-- O acesso cross-tenant destas RPCs é checado DENTRO da função (is_platform_admin()),
-- não por uma policy nova nas tabelas de negócio.

-- Quem é admin da PLATAFORMA (não de uma empresa — é global, poucos usuários).
CREATE TABLE IF NOT EXISTS plataforma_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE plataforma_admins ENABLE ROW LEVEL SECURITY;
-- Sem policy para authenticated: ninguém lê essa tabela direto, só via função abaixo.

CREATE OR REPLACE FUNCTION is_platform_admin(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM plataforma_admins WHERE user_id = p_uid);
$$;
GRANT EXECUTE ON FUNCTION is_platform_admin(uuid) TO authenticated;

-- Checagem barata: o app chama isso 1x após login para decidir se mostra o painel.
CREATE OR REPLACE FUNCTION sou_admin_plataforma()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_platform_admin(auth.uid());
$$;
GRANT EXECUTE ON FUNCTION sou_admin_plataforma() TO authenticated;

-- Lista todas as empresas com métricas básicas de uso (só admin).
CREATE OR REPLACE FUNCTION admin_listar_empresas()
RETURNS TABLE(
  id uuid, nome text, slug text, plano text, ativo boolean, created_at timestamptz,
  membros_count bigint, orcamentos_count bigint, clientes_count bigint,
  produtos_count bigint, ultimo_orcamento timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'sem acesso'; END IF;
  RETURN QUERY
  SELECT e.id, e.nome, e.slug, e.plano, e.ativo, e.created_at,
    (SELECT count(*) FROM membros m WHERE m.empresa_id=e.id),
    (SELECT count(*) FROM orcamentos o WHERE o.empresa_id=e.id),
    (SELECT count(*) FROM clientes c WHERE c.empresa_id=e.id),
    (SELECT count(*) FROM produtos p WHERE p.empresa_id=e.id),
    (SELECT max(o2.data_criacao) FROM orcamentos o2 WHERE o2.empresa_id=e.id)
  FROM empresas e
  ORDER BY e.created_at DESC;
END $$;
GRANT EXECUTE ON FUNCTION admin_listar_empresas() TO authenticated;

-- Uso agregado da plataforma inteira: tamanho do banco, storage por bucket, totais.
CREATE OR REPLACE FUNCTION admin_uso_plataforma()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'sem acesso'; END IF;
  SELECT jsonb_build_object(
    'banco_bytes', pg_database_size(current_database()),
    'total_empresas', (SELECT count(*) FROM empresas),
    'total_empresas_ativas', (SELECT count(*) FROM empresas WHERE ativo),
    'total_orcamentos', (SELECT count(*) FROM orcamentos),
    'total_clientes', (SELECT count(*) FROM clientes),
    'total_produtos', (SELECT count(*) FROM produtos),
    'total_usuarios_auth', (SELECT count(*) FROM auth.users),
    'storage_bytes', COALESCE((SELECT sum((metadata->>'size')::bigint) FROM storage.objects),0),
    'storage_por_bucket', (
      SELECT COALESCE(jsonb_object_agg(bucket_id, total), '{}'::jsonb)
      FROM (SELECT bucket_id, sum((metadata->>'size')::bigint) AS total FROM storage.objects GROUP BY bucket_id) s
    )
  ) INTO v_out;
  RETURN v_out;
END $$;
GRANT EXECUTE ON FUNCTION admin_uso_plataforma() TO authenticated;

-- Suspende/reativa uma empresa (ex.: inadimplência, abuso).
CREATE OR REPLACE FUNCTION admin_set_empresa_ativo(p_empresa uuid, p_ativo boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'sem acesso'; END IF;
  UPDATE empresas SET ativo = p_ativo WHERE id = p_empresa;
  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION admin_set_empresa_ativo(uuid, boolean) TO authenticated;

-- Liga/desliga uma feature flag de uma empresa específica (rollout controlado).
CREATE OR REPLACE FUNCTION admin_set_flag_empresa(p_empresa uuid, p_flag text, p_valor boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg jsonb;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'sem acesso'; END IF;
  UPDATE empresas
  SET config = jsonb_set(
        jsonb_set(coalesce(config,'{}'::jsonb), '{flags}', coalesce(config->'flags','{}'::jsonb), true),
        ARRAY['flags', p_flag], to_jsonb(p_valor), true)
  WHERE id = p_empresa
  RETURNING config INTO v_cfg;
  RETURN v_cfg;
END $$;
GRANT EXECUTE ON FUNCTION admin_set_flag_empresa(uuid, text, boolean) TO authenticated;

-- Torna um usuário admin da plataforma (rodar manualmente pelo SQL Editor/PAT — só
-- quem já tem acesso de dono do projeto Supabase consegue popular esta tabela,
-- nunca pelo próprio app).
-- Exemplo: INSERT INTO plataforma_admins (user_id, nome) VALUES ('<uuid do usuário>', 'Marcos');

NOTIFY pgrst, 'reload schema';
