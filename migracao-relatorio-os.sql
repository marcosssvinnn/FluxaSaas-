-- ══════════════════════════════════════════════════════════════════════════════
--  Tarefa 3i.8 (19/08) — O relatório de serviço executado
--
--  Única mudança de schema da Tarefa 3i inteira que o plano previa (tabela
--  os_materiais) + uma coluna adicional que se mostrou necessária na prática:
--  sem relatorio_enviado_em não existe como distinguir "executado, aguardando
--  relatório" de "relatório enviado" — a trilha de estados (3i.5/3i.6) já
--  lê esse campo desde que foi escrita, só faltava ele existir de verdade.
--
--  os_materiais (os_id, produto_id, qtd, custo_unit) — hoje
--  ordens_servico.materiais é texto; reabrir uma OS salva mostra a string,
--  não os chips (limitação de 13/08). Migrar o texto existente NÃO é
--  necessário — OS antiga mostra o texto como está, o relatório de uma OS
--  sem os_materiais cai pro texto livre.
--
--  100% aditivo.
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS os_materiais (
  id          text PRIMARY KEY,
  os_id       uuid NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  produto_id  text,
  descricao   text,
  qtd         numeric(10,2) DEFAULT 1,
  custo_unit  numeric(10,2) DEFAULT 0,
  empresa_id  uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  data_criacao timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_os_materiais_os ON os_materiais(os_id);
ALTER TABLE os_materiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "isolamento por empresa" ON os_materiais;
CREATE POLICY "isolamento por empresa" ON os_materiais FOR ALL TO authenticated
  USING (empresa_id IN (SELECT minhas_empresas())) WITH CHECK (empresa_id IN (SELECT minhas_empresas()));

ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS relatorio_enviado_em timestamptz;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS relatorio_servicos_pendentes jsonb;
-- relatorio_servicos_pendentes: [{desc, motivo, decisao:'reagendar'|'abater'}]
-- pros itens marcados "Não fiz" na 3i.7 — decisão sempre perguntada (sem
-- padrão pré-selecionado, confirmado com o Marcos em 19/08). Registrado
-- aqui pra não desaparecer, per o achado do DIAGNOSTICO-OS.md — sem
-- automatizar reagendamento/abatimento de fato (fora do escopo desta
-- tarefa: criar OS nova ou alterar valor de orçamento é decisão maior).

-- ── portal_dados(): estende o bloco ordens_servico com o necessário pro
-- relatório (Registro fotográfico/Material aplicado/Condições encontradas/
-- O que foi executado) — SEM regredir o allowlist que corrigiu o vazamento
-- de 15/08 (setup-v2-delta28). O conteúdo detalhado (checklist/materiais/
-- obs_tecnica/fotos/horários) só é revelado quando relatorio_enviado_em
-- NÃO é nulo — antes da revisão manual (3i.8), o técnico pode ter escrito
-- observação/foto que ainda não foi lida por um gestor; expor isso direto
-- no RPC público (que não passa pela UI, um cliente esperto poderia
-- consultar a RPC direto) furaria a garantia de "nada sai sem revisão".
-- relatorio_enviado_em em si SEMPRE aparece (é só a flag, indica se há
-- relatório disponível) — o resto vem condicionado a ela.
CREATE OR REPLACE FUNCTION public.portal_dados(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'ordens_servico', COALESCE(
      (SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id, 'status', s.status, 'data_servico', s.data_servico,
            'servicos', s.servicos, 'tecnico', s.tecnico, 'hora', s.hora,
            'data_criacao', s.data_criacao, 'numero', s.numero,
            'relatorio_enviado_em', s.relatorio_enviado_em
          ) || CASE WHEN s.relatorio_enviado_em IS NOT NULL THEN
            jsonb_build_object(
              'local_servico', s.local_servico, 'checklist', s.checklist,
              'materiais', s.materiais, 'obs_tecnica', s.obs_tecnica,
              'fotos', s.fotos, 'checkin_time', s.checkin_time,
              'checkout_time', s.checkout_time, 'duracao_min', s.duracao_min,
              'loja_id', s.loja_id, 'orcamento_id', s.orcamento_id
            )
          ELSE '{}'::jsonb END
        )
       FROM ordens_servico s
       WHERE s.empresa_id = v_cli.empresa_id
         AND (s.cliente_id = v_cli.id OR (s.cliente_id IS NULL AND s.cliente = v_cli.nome))
      ), '[]'::jsonb),
    'vistorias', COALESCE((SELECT jsonb_agg(to_jsonb(v))
                  FROM vistorias v
                  WHERE v.empresa_id = v_cli.empresa_id
                    AND (v.cliente_id = v_cli.id OR (v.cliente_id IS NULL AND v.cliente = v_cli.nome))), '[]'::jsonb),
    'equipamentos', COALESCE((SELECT jsonb_agg(to_jsonb(eq) - 'foto_base64')
                  FROM equipamentos eq
                  WHERE eq.empresa_id = v_cli.empresa_id AND eq.cliente_nome = v_cli.nome AND eq.ativo = true), '[]'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END $function$;
