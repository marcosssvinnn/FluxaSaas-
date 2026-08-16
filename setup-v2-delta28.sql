-- FLUXA V2 — DELTA 28: fecha vazamento de dados internos no portal do cliente
-- Rode UMA vez. Só CREATE OR REPLACE — sem mudança de schema.
--
-- 🔴 Achado (2026-08-15), comparando com uma auditoria de segurança feita no
-- v1 (fluxa-app) que encontrou o MESMO tipo de bug: portal_dados() (v2,
-- setup-v2-delta8.sql) devolvia `to_jsonb(o) - 'foto_base64'` pra cada
-- orçamento e `to_jsonb(s) - 'fotos'` pra cada OS — ou seja, a LINHA INTEIRA
-- da tabela, menos um campo. Isso manda pro navegador de QUALQUER CLIENTE com
-- link de portal válido colunas que nunca deveriam sair da tela do gestor:
--
--   orcamentos: nota_interna, crm_notas (histórico de conversas internas),
--     motivo_perda, crm_situacao, crm_decisao_prevista, crm_contatos (nome/
--     papel/telefone de síndico e conselho — dado de TERCEIROS, não só do
--     cliente do portal), etapa_desde, origem_cliente, valor_recebido,
--     pag_cod/pag_parcelas/pag_entrada, assinatura_hash/meta/data.
--   ordens_servico: materiais, obs_tecnica, valor_recebido, checklist.
--
-- Diferente do v1 (app single-tenant, sem backend — o fix lá foi trocar
-- select('*') por select() com lista explícita no cliente), aqui o filtro
-- já é feito dentro de uma função SECURITY DEFINER (portal_dados), então o
-- fix é o mesmo princípio (lista explícita em vez de "tudo menos X"), só que
-- dentro do SQL: jsonb_build_object() coluna a coluna, cobrindo exatamente o
-- que app.js:renderPortal()/_hashDocumentoOrc() de fato leem (conferido no
-- código antes de escrever isto — nenhuma tela do portal usa os campos
-- removidos). Nada em vistorias/equipamentos mudou — já auditado como sem
-- campo interno claro (mesma conclusão a que o v1 chegou pro caso deles).

CREATE OR REPLACE FUNCTION portal_dados(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cli clientes%ROWTYPE; v_out jsonb;
BEGIN
  SELECT * INTO v_cli FROM clientes
    WHERE portal_token = p_token AND portal_ativo = true
    LIMIT 1;
  IF v_cli.id IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'cliente', jsonb_build_object(
      'id', v_cli.id, 'nome', v_cli.nome, 'telefone', v_cli.telefone,
      'endereco', v_cli.endereco, 'cnpj', v_cli.cnpj),
    'empresa', (SELECT jsonb_build_object('nome', e.nome, 'config', e.config)
                  FROM empresas e WHERE e.id = v_cli.empresa_id),
    'orcamentos', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'id', o.id, 'numero', o.numero, 'cliente', o.cliente,
                    'cnpj', o.cnpj, 'servicos', o.servicos,
                    'desconto', o.desconto, 'total', o.total,
                    'validade_data', o.validade_data, 'validade_dias', o.validade_dias,
                    'status', o.status))
                  FROM orcamentos o
                  WHERE o.empresa_id = v_cli.empresa_id
                    AND (o.cliente_id = v_cli.id OR (o.cliente_id IS NULL AND o.cliente = v_cli.nome))), '[]'::jsonb),
    'ordens_servico', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'id', s.id, 'status', s.status, 'data_servico', s.data_servico,
                    'servicos', s.servicos, 'tecnico', s.tecnico, 'hora', s.hora,
                    'data_criacao', s.data_criacao))
                  FROM ordens_servico s
                  WHERE s.empresa_id = v_cli.empresa_id
                    AND (s.cliente_id = v_cli.id OR (s.cliente_id IS NULL AND s.cliente = v_cli.nome))), '[]'::jsonb),
    'vistorias', COALESCE((SELECT jsonb_agg(to_jsonb(v))
                  FROM vistorias v
                  WHERE v.empresa_id = v_cli.empresa_id
                    AND (v.cliente_id = v_cli.id OR (v.cliente_id IS NULL AND v.cliente = v_cli.nome))), '[]'::jsonb),
    'equipamentos', COALESCE((SELECT jsonb_agg(to_jsonb(eq) - 'foto_base64')
                  FROM equipamentos eq
                  WHERE eq.empresa_id = v_cli.empresa_id AND eq.cliente_nome = v_cli.nome AND eq.ativo = true), '[]'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END $$;

NOTIFY pgrst, 'reload schema';
