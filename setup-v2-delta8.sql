-- FLUXA V2 — DELTA 8: vínculo cliente↔orçamento/OS/vistoria por ID (achado da 2ª auditoria)
-- Rode UMA vez no SQL Editor. Seguro: só ADICIONA coluna/índice e faz UPDATE
-- condicional (nunca apaga dado). As RPCs do portal continuam funcionando
-- para registros antigos (fallback por nome) enquanto o app passa a mandar
-- cliente_id nos novos.
--
-- Problema encontrado: orcamentos/ordens_servico/vistorias guardavam só o
-- NOME do cliente (texto solto), não um ID. O portal do cliente
-- (portal_dados/portal_responder_orcamento) filtra por
-- "empresa_id = X AND cliente = <nome do token>" — se uma empresa tiver dois
-- clientes com o mesmo nome, o portal de um mostrava (e permitia
-- aprovar/recusar) os orçamentos do outro.
--
-- Fix: adiciona cliente_id nas 3 tabelas, faz backfill só dos casos
-- INAMBÍGUOS (exatamente 1 cliente com aquele nome na empresa — os
-- ambíguos ficam NULL e continuam servidos pelo fallback de nome, sem piorar
-- nada), e as RPCs do portal passam a preferir cliente_id, com fallback pro
-- nome só quando cliente_id for NULL (registros antigos).

-- ── 1. Colunas + índices ──────────────────────────────────────────────────
ALTER TABLE orcamentos      ADD COLUMN IF NOT EXISTS cliente_id text;
ALTER TABLE ordens_servico  ADD COLUMN IF NOT EXISTS cliente_id text;
ALTER TABLE vistorias       ADD COLUMN IF NOT EXISTS cliente_id text;

CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_id     ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_cliente_id             ON ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_cliente_id      ON vistorias(cliente_id);

-- ── 2. Backfill best-effort (só matches inambíguos) ─────────────────────────
UPDATE orcamentos o SET cliente_id = c.id
FROM clientes c
WHERE o.cliente_id IS NULL
  AND o.empresa_id = c.empresa_id
  AND lower(trim(o.cliente)) = lower(trim(c.nome))
  AND (SELECT count(*) FROM clientes c2 WHERE c2.empresa_id = o.empresa_id AND lower(trim(c2.nome)) = lower(trim(o.cliente))) = 1;

UPDATE ordens_servico o SET cliente_id = c.id
FROM clientes c
WHERE o.cliente_id IS NULL
  AND o.empresa_id = c.empresa_id
  AND lower(trim(o.cliente)) = lower(trim(c.nome))
  AND (SELECT count(*) FROM clientes c2 WHERE c2.empresa_id = o.empresa_id AND lower(trim(c2.nome)) = lower(trim(o.cliente))) = 1;

UPDATE vistorias v SET cliente_id = c.id
FROM clientes c
WHERE v.cliente_id IS NULL
  AND v.empresa_id = c.empresa_id
  AND lower(trim(v.cliente)) = lower(trim(c.nome))
  AND (SELECT count(*) FROM clientes c2 WHERE c2.empresa_id = v.empresa_id AND lower(trim(c2.nome)) = lower(trim(v.cliente))) = 1;

-- ── 3. RPCs do portal: preferem cliente_id, fallback por nome pros antigos ──
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
    'orcamentos', COALESCE((SELECT jsonb_agg(to_jsonb(o) - 'foto_base64')
                  FROM orcamentos o
                  WHERE o.empresa_id = v_cli.empresa_id
                    AND (o.cliente_id = v_cli.id OR (o.cliente_id IS NULL AND o.cliente = v_cli.nome))), '[]'::jsonb),
    'ordens_servico', COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'fotos')
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
      AND (cliente_id = v_cli.id OR (cliente_id IS NULL AND cliente = v_cli.nome))
      AND status = 'pendente';
  RETURN FOUND;
END $$;

NOTIFY pgrst, 'reload schema';

-- NOTA: equipamentos.cliente_id já existe no schema, mas foi criado como
-- `uuid` enquanto clientes.id é `text` — os dois tipos nunca vão bater numa
-- comparação. Não mexi nisso aqui (fora do escopo desta correção: o
-- formulário de equipamentos também nunca populou esse campo). Fica
-- registrado no CLAUDE.md como pendência separada.
