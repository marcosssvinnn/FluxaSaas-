-- FLUXA V2 — DELTA 11: reconciliação de estoque atômica no servidor (achado da auditoria)
-- Rode UMA vez no SQL Editor. Idempotente (CREATE OR REPLACE).
--
-- Problema encontrado: sincronizarReservaOrcamento/entregarOrcamento calculavam o
-- delta de reserva/baixa a partir do array `todosMovEstoque` EM MEMÓRIA no
-- navegador — não é uma soma feita atomicamente no banco. Se duas sessões
-- (2 abas, 2 dispositivos) reconciliam o MESMO orçamento quase ao mesmo tempo,
-- cada uma pode calcular o delta a partir de um estado desatualizado e escrever
-- reserva/baixa duplicada — na entrega, isso significa baixar estoque físico 2x.
--
-- Fix: move o cálculo pra dentro de uma função SECURITY DEFINER que trava a
-- linha do orçamento (`FOR UPDATE`) antes de ler/escrever — uma segunda chamada
-- concorrente para o MESMO orçamento espera a primeira terminar e commitar, e aí
-- lê o estado JÁ ATUALIZADO. Isso elimina a corrida por construção (travamento
-- de linha do Postgres), não por sorte de timing.
--
-- NÃO tenta corrigir aqui o 2º achado da auditoria (editar orçamento aprovado
-- pra aumentar a qtd de um produto já entregue não reserva a diferença). Uma
-- 1ª versão desta RPC tentou isso (reserva = max(0, pedido - entregue)), mas
-- o ledger atual não distingue "entregue parcialmente" de "marcado como não
-- levado" (ambos deixam só um `libres:` de liberação, sem guardar a
-- quantidade real entregue) — trocar a checagem de existência por quantidade
-- teria REABERTO a reserva de itens que o gestor marcou deliberadamente como
-- "não levado". Fix de verdade exige guardar a quantidade entregue de forma
-- explícita no schema — fica documentado como pendência separada no
-- CLAUDE.md, não é seguro fazer isso sem mudar o schema. Esta RPC replica
-- EXATAMENTE a semântica de `_entregueProdutoOrc` original (existência de
-- QUALQUER movimento baixa/libres = produto resolvido, nunca mais reserva).
--
-- O app.js (ver commit desta sessão) passa a chamar estas RPCs quando online,
-- com fallback pro cálculo local antigo quando offline ou se a RPC falhar.

CREATE OR REPLACE FUNCTION rpc_sincronizar_reserva_orcamento(p_orc_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orc orcamentos%ROWTYPE;
  v_num text;
  v_usuario text;
  v_pid text;
  v_pedido numeric;
  v_ja_entregue boolean;
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
    -- já foi tratado na entrega (baixado ou marcado "não levado")? mesma semântica de
    -- _entregueProdutoOrc: qualquer movimento baixa/libres = resolvido, nunca mais reserva
    -- (o ledger não distingue "entregue parcial" de "não levado", então não dá pra ser
    -- mais fino que isso sem mudar o schema — ver nota no cabeçalho do arquivo)
    SELECT EXISTS(
      SELECT 1 FROM estoque_movimentos
      WHERE produto_id=v_pid
        AND (ref='baixa:orc:'||p_orc_id::text||':'||v_pid OR ref='libres:orc:'||p_orc_id::text||':'||v_pid)
    ) INTO v_ja_entregue;

    IF v_ja_entregue OR v_orc.status <> 'aprovado' THEN
      v_pedido := 0;
    ELSE
      -- quantidade pedida deste produto neste orçamento (soma, caso apareça mais de uma vez)
      SELECT COALESCE(SUM((elem->>'qty')::numeric),0) INTO v_pedido
      FROM jsonb_array_elements(COALESCE(v_orc.servicos,'[]'::jsonb)) elem
      WHERE (elem->>'produto_id') = v_pid;
    END IF;

    -- reserva líquida já lançada (net de reserva/liberação) pra este orçamento+produto
    SELECT COALESCE(SUM(quantidade),0) INTO v_ja_reservado
    FROM estoque_movimentos
    WHERE tipo IN ('reserva','liberacao_reserva') AND ref LIKE '%orc:'||p_orc_id::text||'%' AND produto_id = v_pid;

    v_delta := v_pedido - v_ja_reservado;
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
  v_reservado numeric;
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
    IF EXISTS (
      SELECT 1 FROM estoque_movimentos
      WHERE produto_id=v_pid
        AND (ref='baixa:orc:'||p_orc_id::text||':'||v_pid OR ref='libres:orc:'||p_orc_id::text||':'||v_pid)
    ) THEN
      CONTINUE; -- já tratado
    END IF;

    v_reservado := abs(COALESCE((elem->>'qty')::numeric,1));
    IF p_qty_map IS NOT NULL AND p_qty_map ? v_pid THEN
      v_levado := GREATEST(0, abs(COALESCE((p_qty_map->>v_pid)::numeric,0)));
    ELSE
      v_levado := v_reservado;
    END IF;
    SELECT custo INTO v_custo FROM produtos WHERE id = v_pid;

    IF v_levado > 0 THEN
      INSERT INTO estoque_movimentos (id, empresa_id, loja_id, produto_id, tipo, quantidade, custo_unit, motivo, ref, usuario)
      VALUES ('mov_'||replace(gen_random_uuid()::text,'-',''), v_orc.empresa_id, v_orc.loja_id, v_pid, 'saida', -v_levado, v_custo, 'Entrega orçamento #'||v_num, 'baixa:orc:'||p_orc_id::text||':'||v_pid, v_usuario);
    END IF;
    INSERT INTO estoque_movimentos (id, empresa_id, loja_id, produto_id, tipo, quantidade, custo_unit, motivo, ref, usuario)
    VALUES ('mov_'||replace(gen_random_uuid()::text,'-',''), v_orc.empresa_id, v_orc.loja_id, v_pid, 'liberacao_reserva', -v_reservado, NULL,
      CASE WHEN v_levado>0 THEN 'Baixa entrega #'||v_num ELSE 'Item não levado #'||v_num END,
      'libres:orc:'||p_orc_id::text||':'||v_pid, v_usuario);
    v_baixou := true;
  END LOOP;
  RETURN v_baixou;
END $$;
GRANT EXECUTE ON FUNCTION rpc_entregar_orcamento(uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
