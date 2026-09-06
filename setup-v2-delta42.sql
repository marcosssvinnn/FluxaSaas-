-- delta42 — métricas de saúde do SaaS pro painel da plataforma (Fase 50)
-- Só o admin da plataforma (is_platform_admin). Cross-tenant de propósito:
-- é a visão do DONO do SaaS, não de um tenant.
CREATE OR REPLACE FUNCTION public.admin_metricas_saas()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_out jsonb;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'sem acesso'; END IF;
  SELECT jsonb_build_object(
    -- novas empresas por mês (últimos 6 meses), pra ver crescimento
    'novas_por_mes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('mes', mes, 'n', n) ORDER BY mes), '[]'::jsonb)
      FROM (
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes, count(*) AS n
        FROM empresas
        WHERE created_at >= (now() - interval '6 months')
        GROUP BY 1
      ) s
    ),
    -- ativas de verdade: criaram orçamento OU OS nos últimos 30 dias
    'ativas_30d', (
      SELECT count(DISTINCT empresa_id) FROM (
        SELECT empresa_id FROM orcamentos WHERE data_criacao >= (now() - interval '30 days')
        UNION
        SELECT empresa_id FROM ordens_servico WHERE data_criacao >= (now() - interval '30 days')
      ) a
    ),
    -- paradas: criadas há mais de 30 dias e sem atividade nos últimos 30
    'paradas', (
      SELECT count(*) FROM empresas e
      WHERE e.created_at < (now() - interval '30 days')
        AND NOT EXISTS (SELECT 1 FROM orcamentos o WHERE o.empresa_id=e.id AND o.data_criacao >= (now() - interval '30 days'))
        AND NOT EXISTS (SELECT 1 FROM ordens_servico s WHERE s.empresa_id=e.id AND s.data_criacao >= (now() - interval '30 days'))
    ),
    -- ativação: % das empresas que já fizeram ao menos 1 orçamento
    'ativacao_pct', (
      SELECT CASE WHEN count(*)=0 THEN 0
        ELSE round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM orcamentos o WHERE o.empresa_id=e.id)) / count(*), 0)
      END FROM empresas e
    ),
    -- volume total (uso do produto)
    'total_os', (SELECT count(*) FROM ordens_servico),
    'total_vistorias', (SELECT count(*) FROM vistorias)
  ) INTO v_out;
  RETURN v_out;
END $function$;

REVOKE ALL ON FUNCTION public.admin_metricas_saas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_metricas_saas() TO authenticated;
NOTIFY pgrst, 'reload schema';
