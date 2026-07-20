-- FLUXA V2 — DELTA 15: fecha o gap #2 de estoque (aumentar qty de item já
-- entregue não reservava a diferença) — achado de auditoria 2026-07-19,
-- deixado documentado como pendência porque a 1ª tentativa causava regressão.
-- Rode UMA vez no SQL Editor. Substitui as duas funções do delta11
-- (CREATE OR REPLACE, idempotente). Requer o delta11 já aplicado.
--
-- Por que a 1ª tentativa foi revertida: comparar só a quantidade FISICAMENTE
-- baixada (`baixa:`) contra a quantidade pedida reabria sozinha, a cada
-- reconciliação, itens que o gestor tinha marcado deliberadamente como "não
-- levado" — porque um item dispensado nunca tem `baixa:` (fica com `levado=0`
-- pra sempre), então "pedido - baixado" nunca chegava a zero.
--
-- Fix certo: o `libres:` (liberação de reserva) já registra, no momento em
-- que roda, a quantidade que estava sendo resolvida ali — seja ela levada,
-- dispensada, ou as duas coisas somadas ao longo de várias entregas parciais.
-- Somar os `libres:` (em vez de só checar se existe ALGUM) dá a quantidade
-- "resolvida até agora" de forma correta: item dispensado fica resolvido pra
-- sempre pra aquela quantidade (não reabre sozinho), e só a DIFERENÇA de uma
-- edição que aumenta a quantidade depois entra como pendente de novo.
--
-- Mesma lógica implementada em espelho no app.js (fallback local, offline):
-- _qtdResolvidaProdutoOrc() / _entregueProdutoOrc() / _sincronizarReservaOrcamentoLocal()
-- / _entregarOrcamentoLocal() — ver commit desta sessão.

CREATE OR REPLACE FUNCTION rpc_sincronizar_reserva_orcamento(p_orc_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orc orcamentos%ROWTYPE;
  v_num text;
  v_usuario text;
  v_pid text;
  v_pedido numeric;
  v_resolvido numeric;
  v_pendente numeric;
  v_ja_reservado numeric;
  v_delta numeric;
BEGIN
  SELECT * INTO v_orc FROM orcamentos WHERE id = p_orc_id FOR UPDATE;
  IF v_orc.id IS NULL THEN RETURN; END IF;
  IF v_orc.empresa_id NOT IN (SELECT minhas_empresas()) THEN
    RAISE EXCEPTION 'sem acesso a este orçamento';
  END IF;

  v_num := lpad(COALESCE(v_orc.numero,0)::text, 3, '0');
  v_usuario := COALESCE((SELECT nome FROM membros WHERE user_id=auth.uid() AND empresa_id=v_orc.empresa_id), '');

  FOR v_pid IN
    SELECT DISTINCT pid FROM (
      SELECT (elem->>'produto_id') AS pid
      FROM jsonb_array_elements(COALESCE(v_orc.servicos,'[]'::jsonb)) elem
      WHERE (elem->>'produto_id') IS NOT NULL AND (elem->>'produto_id') <> ''
      UNION
      SELECT produto_id FROM estoque_movimentos
      WHERE tipo IN ('reserva','liberacao_reserva') AND ref LIKE '%orc:'||p_orc_id::text||'%'
    ) t
  LOOP
    IF v_orc.status <> 'aprovado' THEN
      v_pedido := 0;
    ELSE
      -- quantidade pedida deste produto neste orçamento (soma, caso apareça mais de uma vez)
      SELECT COALESCE(SUM((elem->>'qty')::numeric),0) INTO v_pedido
      FROM jsonb_array_elements(COALESCE(v_orc.servicos,'[]'::jsonb)) elem
      WHERE (elem->>'produto_id') = v_pid;
    END IF;

    -- quanto já foi RESOLVIDO (levado e/ou dispensado) — soma dos `libres:`
    SELECT COALESCE(SUM(abs(quantidade)),0) INTO v_resolvido
    FROM estoque_movimentos
    WHERE produto_id=v_pid AND ref='libres:orc:'||p_orc_id::text||':'||v_pid;

    v_pendente := GREATEST(0, v_pedido - v_resolvido);

    -- reserva líquida já lançada (net de reserva/liberação) pra este orçamento+produto
    SELECT COALESCE(SUM(quantidade),0) INTO v_ja_reservado
    FROM estoque_movimentos
    WHERE tipo IN ('reserva','liberacao_reserva') AND ref LIKE '%orc:'||p_orc_id::text||'%' AND produto_id = v_pid;

    v_delta := v_pendente - v_ja_reservado;
    IF abs(v_delta) < 0.0001 THEN CONTINUE; END IF;

    INSERT INTO estoque_movimentos (id, empresa_id, loja_id, produto_id, tipo, quantidade, custo_unit, motivo, ref, usuario)
    VALUES (
      'mov_'||replace(gen_random_uuid()::text,'-',''),
      v_orc.empresa_id, v_orc.loja_id, v_pid,
      CASE WHEN v_delta>0 THEN 'reserva' ELSE 'liberacao_reserva' END,
      v_delta, NULL,
      CASE WHEN v_delta>0 THEN 'Reserva orçamento #'||v_num ELSE 'Libera reserva #'||v_num END,
      'res:orc:'||p_orc_id::text||':'||v_pid||':'||extract(epoch from clock_timestamp())::text,
      v_usuario
    );
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION rpc_sincronizar_reserva_orcamento(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION rpc_entregar_orcamento(p_orc_id uuid, p_qty_map jsonb DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orc orcamentos%ROWTYPE;
  v_num text;
  v_usuario text;
  elem jsonb;
  v_pid text;
  v_qty_atual numeric;
  v_resolvido numeric;
  v_pendente numeric;
  v_levado numeric;
  v_custo numeric;
  v_baixou boolean := false;
BEGIN
  SELECT * INTO v_orc FROM orcamentos WHERE id = p_orc_id FOR UPDATE;
  IF v_orc.id IS NULL THEN RETURN false; END IF;
  IF v_orc.empresa_id NOT IN (SELECT minhas_empresas()) THEN
    RAISE EXCEPTION 'sem acesso a este orçamento';
  END IF;
  IF v_orc.status <> 'aprovado' THEN RETURN false; END IF;

  v_num := lpad(COALESCE(v_orc.numero,0)::text, 3, '0');
  v_usuario := COALESCE((SELECT nome FROM membros WHERE user_id=auth.uid() AND empresa_id=v_orc.empresa_id), '');

  FOR elem IN SELECT * FROM jsonb_array_elements(COALESCE(v_orc.servicos,'[]'::jsonb))
  LOOP
    v_pid := elem->>'produto_id';
    CONTINUE WHEN v_pid IS NULL OR v_pid = '';

    v_qty_atual := abs(COALESCE((elem->>'qty')::numeric,1));
    SELECT COALESCE(SUM(abs(quantidade)),0) INTO v_resolvido
    FROM estoque_movimentos
    WHERE produto_id=v_pid AND ref='libres:orc:'||p_orc_id::text||':'||v_pid;
    v_pendente := v_qty_atual - v_resolvido;
    CONTINUE WHEN v_pendente <= 0.0001; -- já tratado pra quantidade atual

    -- qtyMap se refere ao que está PENDENTE agora (não à qtd original)
    IF p_qty_map IS NOT NULL AND p_qty_map ? v_pid THEN
      v_levado := LEAST(v_pendente, GREATEST(0, abs(COALESCE((p_qty_map->>v_pid)::numeric,0))));
    ELSE
      v_levado := v_pendente;
    END IF;
    SELECT custo INTO v_custo FROM produtos WHERE id = v_pid;

    IF v_levado > 0 THEN
      INSERT INTO estoque_movimentos (id, empresa_id, loja_id, produto_id, tipo, quantidade, custo_unit, motivo, ref, usuario)
      VALUES ('mov_'||replace(gen_random_uuid()::text,'-',''), v_orc.empresa_id, v_orc.loja_id, v_pid, 'saida', -v_levado, v_custo, 'Entrega orçamento #'||v_num, 'baixa:orc:'||p_orc_id::text||':'||v_pid, v_usuario);
    END IF;
    -- libera SEMPRE a reserva do que estava pendente (item resolvido: levado, dispensado, ou parte)
    INSERT INTO estoque_movimentos (id, empresa_id, loja_id, produto_id, tipo, quantidade, custo_unit, motivo, ref, usuario)
    VALUES ('mov_'||replace(gen_random_uuid()::text,'-',''), v_orc.empresa_id, v_orc.loja_id, v_pid, 'liberacao_reserva', -v_pendente, NULL,
      CASE WHEN v_levado>0 THEN 'Baixa entrega #'||v_num ELSE 'Item não levado #'||v_num END,
      'libres:orc:'||p_orc_id::text||':'||v_pid, v_usuario);
    v_baixou := true;
  END LOOP;
  RETURN v_baixou;
END $$;
GRANT EXECUTE ON FUNCTION rpc_entregar_orcamento(uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
