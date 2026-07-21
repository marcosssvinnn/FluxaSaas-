-- FLUXA V2 — SETUP MULTI-TENANT (1 banco, N empresas)

-- ───────── NÚCLEO MULTI-TENANT ─────────
CREATE TABLE IF NOT EXISTS empresas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  slug text UNIQUE,
  config jsonb DEFAULT '{}',
  plano text DEFAULT 'free',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS membros (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  perfil text DEFAULT 'gestor',
  nome text, -- nome da pessoa (capturado no onboarding) — usado no auto-login sem PIN
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_membros_empresa ON membros(empresa_id);

CREATE OR REPLACE FUNCTION minhas_empresas()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM membros WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION criar_empresa(p_nome text, p_nome_usuario text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  -- config semeado com o nome informado no onboarding (nome/appName): sem isso
  -- o CFG.nome ficava vazio e o header/tela de login mostravam "Minha Empresa"
  -- até o gestor preencher manualmente em Dados da Empresa.
  INSERT INTO empresas (nome, slug, config)
  VALUES (
    p_nome,
    regexp_replace(lower(p_nome), '[^a-z0-9]+', '-', 'g') || '-' || substr(gen_random_uuid()::text, 1, 4),
    jsonb_build_object('nome', p_nome, 'appName', p_nome)
  )
  RETURNING id INTO v_id;
  -- p_nome_usuario fica em membros.nome — quem cria a conta já provou quem é
  -- (e-mail+senha), então entra direto como esse nome, sem tela de PIN interno.
  INSERT INTO membros (user_id, empresa_id, perfil, nome) VALUES (auth.uid(), v_id, 'gestor', COALESCE(p_nome_usuario,'Gestor'));
  INSERT INTO lojas (empresa_id, nome) VALUES (v_id, p_nome);
  RETURN v_id;
END $$;

CREATE TABLE IF NOT EXISTS contadores (
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  valor integer DEFAULT 0,
  PRIMARY KEY (empresa_id, tipo)
);

CREATE OR REPLACE FUNCTION proximo_numero(p_empresa uuid, p_tipo text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM membros WHERE user_id = auth.uid() AND empresa_id = p_empresa) THEN
    RAISE EXCEPTION 'sem acesso a esta empresa';
  END IF;
  INSERT INTO contadores (empresa_id, tipo, valor) VALUES (p_empresa, p_tipo, 1)
  ON CONFLICT (empresa_id, tipo) DO UPDATE SET valor = contadores.valor + 1
  RETURNING valor INTO v;
  RETURN v;
END $$;

-- ───────── TABELAS DE DADOS (v1 + empresa_id) ─────────
CREATE TABLE IF NOT EXISTS lojas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text, cnpj text, razao_social text,
  inscricao_estadual text, inscricao_municipal text,
  regime_tributario text, endereco text, tel text, cidade text,
  logo_base64 text, cor_primaria text, cor text, grupo text,
  tecs jsonb DEFAULT '[]',
  -- fiscal: SEM focusnfe_token aqui (token fiscal é da plataforma, vive só em Edge Function)
  focusnfe_ambiente text DEFAULT 'homologacao',
  iss_aliquota numeric(5,2) DEFAULT 2.0,
  codigo_servico_municipal text DEFAULT '7.10',
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id text PRIMARY KEY,  -- app gera id texto (ex.: 'usr_...'); NÃO usar uuid
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL, pin text, perfil text DEFAULT 'tecnico',
  loja_id uuid, loja_nome text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id text PRIMARY KEY,  -- app gera id texto (ex.: 'cli_...'); NÃO usar uuid
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text, telefone text, endereco text,
  portal_token uuid DEFAULT gen_random_uuid(), portal_ativo boolean DEFAULT true,
  cnpj text, email_responsavel text, loja_id text,
  data_criacao timestamptz DEFAULT now()
);
-- Índice único: portal_token é a identidade do cliente no portal público (RPCs
-- portal_dados/portal_responder_orcamento) — sem isto, todo acesso ao portal
-- faz table scan e nada garante unicidade do token.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_portal_token ON clientes(portal_token);

CREATE TABLE IF NOT EXISTS orcamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero integer, cliente text, cliente_id text, local_servico text,
  tel_cliente text, servicos jsonb,
  subtotal numeric(10,2), desconto numeric(10,2),
  total numeric(10,2), pagamento text,
  pag_cod text, pag_parcelas integer, pag_entrada numeric(10,2),
  validade_dias integer, validade_data text,
  data_servico text, escopo text, obs text,
  foto_base64 text, assinatura_base64 text,
  valor_recebido numeric(10,2) DEFAULT 0,
  status text DEFAULT 'pendente', data_aprovacao timestamptz,
  nota_interna text, cnpj text, loja_id text, origem_cliente text,
  proximo_contato date,            -- CRM: data do próximo follow-up
  crm_notas jsonb DEFAULT '[]',    -- CRM: histórico de contatos [{data,texto,usuario}]
  motivo_perda text,               -- CRM: por que perdeu (recusado/vencido)
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordens_servico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero integer, orcamento_id uuid,
  cliente text, cliente_id text, local_servico text,
  data_servico text, hora text,
  tecnico text, servicos jsonb,
  materiais text, obs_tecnica text,
  total numeric(10,2) DEFAULT 0,
  valor_recebido numeric(10,2) DEFAULT 0,
  status text DEFAULT 'agendado',
  fotos jsonb DEFAULT '[]', video_link text, agendamento_id text,
  checkin_time timestamptz, checkout_time timestamptz, duracao_min integer,
  cnpj text, loja_id text, checklist text,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id text PRIMARY KEY,  -- app gera id texto (ex.: 'ag_...'); NÃO usar uuid
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente text, local_servico text, tecnico text,
  tipo_servico text, periodicidade text,
  dia_semana integer, horario text,
  data_inicio text, data_fim text, obs text,
  local_id text, loja_id text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vistorias (
  id text PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id text, cliente text, cliente_id text, local text,
  data text, hora text, tecnico text, mes_ref text,
  hora_checkin text, hora_checkout text,
  obs_geral text, email_responsavel text,
  equipamentos jsonb DEFAULT '[]', local_id text,
  created_at timestamptz DEFAULT now()
);
-- cliente_id: vínculo por ID (não só nome) usado pelo portal do cliente —
-- evita misturar dados de dois clientes com o mesmo nome na mesma empresa.
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_id ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_cliente_id ON ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_cliente_id ON vistorias(cliente_id);

CREATE TABLE IF NOT EXISTS locais_vistoria (
  id text PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id text, cliente text, local text,
  email_responsavel text, tecnico text,
  dia_pref text, hora_pref text,
  equipamentos jsonb DEFAULT '[]',
  agendamento_id text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipamentos (
  id text PRIMARY KEY,  -- app gera id texto (ex.: 'eq_...'); NÃO usar uuid
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id text, cliente_nome text,
  tipo text, marca text, modelo text, potencia text,
  numero_serie text, data_instalacao text,
  garantia_meses integer DEFAULT 12, garantia_vencimento text,
  obs text, foto_base64 text, loja_id text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS despesas (
  id text PRIMARY KEY,  -- app gera id texto (ex.: 'desp_...'); NÃO usar uuid
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  os_id uuid, os_numero integer, tecnico text,
  data text, tipo text, valor numeric(10,2),
  descricao text, foto_base64 text, loja_id text,
  status text DEFAULT 'pendente',
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notas_fiscais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id uuid, orcamento_id uuid,
  tipo text, referencia text,
  numero integer, serie text, chave_acesso text,
  status text DEFAULT 'pendente',
  xml_autorizado text, pdf_danfe_url text,
  protocolo text, motivo_rejeicao text, dados_envio jsonb,
  data_emissao timestamptz DEFAULT now(),
  data_criacao timestamptz DEFAULT now(),
  UNIQUE (empresa_id, referencia)
);

CREATE TABLE IF NOT EXISTS produtos (
  id text PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id text,
  nome text, codigo text, unidade text DEFAULT 'un',
  preco_venda numeric(10,2) DEFAULT 0,
  custo numeric(10,2) DEFAULT 0,
  estoque_minimo numeric(10,2) DEFAULT 0,
  categoria text,
  fornecedor_id text, lead_time_dias integer,
  estoque_seguranca numeric(10,2) DEFAULT 0,
  lote_minimo numeric(10,2) DEFAULT 1,
  lote text, validade text,
  ncm text, cest text, cfop_padrao text, origem text, gtin_ean text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id text PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id text, produto_id text,
  tipo text, quantidade numeric(10,2),
  custo_unit numeric(10,2), motivo text,
  ref text, usuario text,
  data timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mov_produto ON estoque_movimentos(produto_id);
CREATE INDEX IF NOT EXISTS idx_mov_ref ON estoque_movimentos(ref);

-- Compras: fornecedores + ordens de compra (reabastecimento do estoque)
CREATE TABLE IF NOT EXISTS fornecedores (
  id text PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id text,
  nome text, contato text, whatsapp text, email text, obs text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordens_compra (
  id text PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id text,
  numero integer,
  fornecedor_id text,
  data text,
  status text DEFAULT 'rascunho',   -- 'rascunho' | 'enviada' | 'recebida'
  itens jsonb DEFAULT '[]',
  total numeric(10,2) DEFAULT 0,
  obs text,
  data_recebimento timestamptz,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditoria (
  id text PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario text, perfil text,
  acao text, detalhe text, loja_id text,
  data timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aud_data ON auditoria(data DESC);

-- Insights de IA (escritos pelo backend futuro via service role; o app só lê)
CREATE TABLE IF NOT EXISTS insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo text,                  -- 'estoque' | 'financeiro' | 'vendas' | ...
  periodo text,               -- ex: '2026-07'
  conteudo jsonb,             -- { resumo, destaques[], sugestoes[] }
  modelo text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insights_empresa ON insights(empresa_id, created_at DESC);
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "membro le insights" ON insights;
CREATE POLICY "membro le insights" ON insights
  FOR SELECT TO authenticated USING (empresa_id IN (SELECT minhas_empresas()));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lojas','usuarios','clientes','orcamentos','ordens_servico','agendamentos',
    'vistorias','locais_vistoria','equipamentos','despesas','notas_fiscais',
    'produtos','estoque_movimentos','auditoria','fornecedores','ordens_compra'
  ] LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_empresa ON %I(empresa_id);', t, t);
  END LOOP;
END $$;

-- ───────── RLS (isolamento por empresa) ─────────
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "membro le empresa" ON empresas;
CREATE POLICY "membro le empresa" ON empresas
  FOR SELECT TO authenticated USING (id IN (SELECT minhas_empresas()));
DROP POLICY IF EXISTS "gestor edita empresa" ON empresas;
CREATE POLICY "gestor edita empresa" ON empresas
  FOR UPDATE TO authenticated
  USING (id IN (SELECT empresa_id FROM membros WHERE user_id = auth.uid() AND perfil = 'gestor'))
  WITH CHECK (id IN (SELECT empresa_id FROM membros WHERE user_id = auth.uid() AND perfil = 'gestor'));

ALTER TABLE membros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ve proprios vinculos" ON membros;
CREATE POLICY "ve proprios vinculos" ON membros
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR empresa_id IN (SELECT minhas_empresas()));

ALTER TABLE contadores ENABLE ROW LEVEL SECURITY;

-- RLS: habilita nas tabelas de dados. As POLICIES (por PERFIL: gestor/vendas/
-- técnico) vêm de setup-v2-optionA-perfil.sql → RODAR AQUELE ARQUIVO logo após este.
-- ⚠️ NÃO recriar aqui a policy blanket "isolamento por empresa" (FOR ALL): sendo
-- permissiva, ela é OR'd com as por perfil e ANULA o enforcement por perfil. Este
-- bloco só HABILITA a RLS e apaga a blanket antiga (idempotência p/ bancos legados).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lojas','usuarios','clientes','orcamentos','ordens_servico','agendamentos',
    'vistorias','locais_vistoria','equipamentos','despesas','notas_fiscais',
    'produtos','estoque_movimentos','auditoria','fornecedores','ordens_compra'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "isolamento por empresa" ON %I;', t);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION minhas_empresas() TO authenticated;
GRANT EXECUTE ON FUNCTION criar_empresa(text) TO authenticated;
GRANT EXECUTE ON FUNCTION proximo_numero(uuid, text) TO authenticated;

-- ───────── REALTIME ─────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orcamentos','clientes','agendamentos','equipamentos','despesas','vistorias','produtos','estoque_movimentos','locais_vistoria','fornecedores','ordens_compra'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Filtro de realtime por empresa_id em eventos DELETE precisa da linha antiga
-- completa (o padrão só traz a PK). REPLICA IDENTITY FULL garante que o filtro
-- empresa_id=eq.<id> funcione também no DELETE, nas tabelas com sub de exclusão.
ALTER TABLE orcamentos   REPLICA IDENTITY FULL;
ALTER TABLE equipamentos REPLICA IDENTITY FULL;
ALTER TABLE despesas     REPLICA IDENTITY FULL;

-- ───────── STORAGE (PDFs e fotos de vistoria, por empresa) ─────────
-- Dois buckets públicos p/ leitura; escrita só na PASTA da empresa (1º segmento
-- do caminho = empresa_id do usuário). Ex.: <empresa_id>/<vistoria>.pdf.
INSERT INTO storage.buckets (id, name, public) VALUES ('vistorias-pdf', 'vistorias-pdf', true)
ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('vistorias-fotos', 'vistorias-fotos', true)
ON CONFLICT (id) DO UPDATE SET public = true;
-- orcamentos-fotos/os-fotos: infraestrutura pronta pra quando a migração de
-- foto embutida (base64) pra Storage for feita nesses 2 módulos (ver CLAUDE.md).
-- O app.js ainda não usa esses 2 buckets.
INSERT INTO storage.buckets (id, name, public) VALUES ('orcamentos-fotos', 'orcamentos-fotos', true)
ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('os-fotos', 'os-fotos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "upload na pasta da empresa" ON storage.objects;
CREATE POLICY "upload na pasta da empresa" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('vistorias-pdf','vistorias-fotos','orcamentos-fotos','os-fotos')
    AND (storage.foldername(name))[1] IN (SELECT minhas_empresas()::text));

DROP POLICY IF EXISTS "update na pasta da empresa" ON storage.objects;
CREATE POLICY "update na pasta da empresa" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('vistorias-pdf','vistorias-fotos','orcamentos-fotos','os-fotos')
    AND (storage.foldername(name))[1] IN (SELECT minhas_empresas()::text));

DROP POLICY IF EXISTS "leitura publica pdf" ON storage.objects;
CREATE POLICY "leitura publica pdf" ON storage.objects
  FOR SELECT TO public USING (bucket_id IN ('vistorias-pdf','vistorias-fotos','orcamentos-fotos','os-fotos'));

-- ───────── PORTAL DO CLIENTE (acesso público por token, sem login) ─────────
-- O portal (#portal/<token>) é usado pelo cliente FINAL, sem conta. Com a RLS
-- acima, queries diretas do portal retornam vazio — por isso estas RPCs
-- SECURITY DEFINER: validam o token e devolvem SÓ os dados daquele cliente.
-- Vínculo cliente↔orçamento/OS: por nome do cliente + empresa_id (comportamento
-- do v1). Se o app usar outro vínculo, ajustar aqui.

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

-- Aprova/recusa um orçamento pelo token (cliente sem login). p_assinatura (opcional)
-- carrega {base64, hash, meta} da assinatura do cliente na aprovação. A RESERVA de
-- estoque NÃO acontece aqui (o portal é anon, sem acesso ao estoque): ela roda no
-- app do gestor ao receber a atualização por realtime. Ver T11 no CLAUDE.md.
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

GRANT EXECUTE ON FUNCTION portal_dados(uuid) TO anon;
GRANT EXECUTE ON FUNCTION portal_responder_orcamento(uuid, uuid, boolean, jsonb) TO anon;

-- ═════════════════════════════════════════════════════════════════════
--  ANALYTICS — agregações no SQL (a análise consulta a VIEW, nunca baixa
--  tabelas inteiras pro navegador). security_invoker = true → a RLS das
--  tabelas-base se aplica: cada empresa só vê os próprios números.
--  O app ainda adiciona .eq('empresa_id', EMPRESA_ID) por defesa em profundidade.
-- ═════════════════════════════════════════════════════════════════════

-- Por produto: margem, giro (saídas), entradas, saldo físico, dias sem saída, ABC.
CREATE OR REPLACE VIEW vw_analise_produtos WITH (security_invoker = true) AS
WITH mov AS (
  SELECT produto_id,
         SUM(CASE WHEN tipo IN ('saida') THEN abs(quantidade) ELSE 0 END)          AS saida_qtd,
         SUM(CASE WHEN tipo IN ('entrada','transf_entrada') THEN quantidade ELSE 0 END) AS entrada_qtd,
         SUM(CASE WHEN tipo IN ('entrada','saida','ajuste','transf_entrada','transf_saida') THEN quantidade ELSE 0 END) AS saldo_fisico,
         MAX(CASE WHEN tipo='saida' THEN data END)                                  AS ultima_saida
  FROM estoque_movimentos GROUP BY produto_id
)
SELECT p.empresa_id, p.id AS produto_id, p.nome, p.loja_id,
       p.custo, p.preco_venda,
       (p.preco_venda - p.custo)                                                    AS margem_unit,
       CASE WHEN p.preco_venda > 0 THEN round((p.preco_venda - p.custo)/p.preco_venda*100, 1) ELSE 0 END AS margem_pct,
       COALESCE(m.saida_qtd,0)    AS giro_saida_qtd,
       COALESCE(m.entrada_qtd,0)  AS entrada_qtd,
       COALESCE(m.saldo_fisico,0) AS saldo_fisico,
       COALESCE(m.saida_qtd,0) * p.preco_venda                                       AS receita_saida,
       m.ultima_saida,
       CASE WHEN m.ultima_saida IS NULL THEN NULL
            ELSE (CURRENT_DATE - m.ultima_saida::date) END                          AS dias_sem_saida,
       -- Curva ABC por receita de saída (A = top ~80% acumulado, B ~15%, C resto)
       CASE
         WHEN sum(COALESCE(m.saida_qtd,0)*p.preco_venda) OVER (PARTITION BY p.empresa_id) = 0 THEN 'C'
         WHEN sum(COALESCE(m.saida_qtd,0)*p.preco_venda) OVER (
                PARTITION BY p.empresa_id ORDER BY COALESCE(m.saida_qtd,0)*p.preco_venda DESC
                ROWS UNBOUNDED PRECEDING)
              / NULLIF(sum(COALESCE(m.saida_qtd,0)*p.preco_venda) OVER (PARTITION BY p.empresa_id),0) <= 0.80 THEN 'A'
         WHEN sum(COALESCE(m.saida_qtd,0)*p.preco_venda) OVER (
                PARTITION BY p.empresa_id ORDER BY COALESCE(m.saida_qtd,0)*p.preco_venda DESC
                ROWS UNBOUNDED PRECEDING)
              / NULLIF(sum(COALESCE(m.saida_qtd,0)*p.preco_venda) OVER (PARTITION BY p.empresa_id),0) <= 0.95 THEN 'B'
         ELSE 'C'
       END AS abc
FROM produtos p
LEFT JOIN mov m ON m.produto_id = p.id
WHERE p.ativo = true;

-- Financeiro mensal: receita (recebido) x despesas x resultado, por mês.
CREATE OR REPLACE VIEW vw_analise_financeiro_mensal WITH (security_invoker = true) AS
WITH rec AS (
  SELECT empresa_id, to_char(data_criacao,'YYYY-MM') AS mes,
         SUM(COALESCE(valor_recebido,0)) AS receita,
         SUM(COALESCE(total,0))          AS faturado
  FROM orcamentos WHERE status IN ('aprovado','pago','concluido') GROUP BY 1,2
),
desp AS (
  SELECT empresa_id, to_char(COALESCE(data::timestamptz, data_criacao),'YYYY-MM') AS mes,
         SUM(COALESCE(valor,0)) AS despesas
  FROM despesas GROUP BY 1,2
)
SELECT COALESCE(r.empresa_id,d.empresa_id) AS empresa_id,
       COALESCE(r.mes,d.mes)               AS mes,
       COALESCE(r.receita,0)               AS receita,
       COALESCE(r.faturado,0)              AS faturado,
       COALESCE(d.despesas,0)              AS despesas,
       COALESCE(r.receita,0) - COALESCE(d.despesas,0) AS resultado
FROM rec r FULL OUTER JOIN desp d ON r.empresa_id=d.empresa_id AND r.mes=d.mes;

-- Orçamentos: taxa de aprovação, ticket médio, faturado x recebido (inadimplência).
CREATE OR REPLACE VIEW vw_analise_orcamentos WITH (security_invoker = true) AS
SELECT empresa_id,
       COUNT(*)                                                        AS total,
       COUNT(*) FILTER (WHERE status='aprovado')                       AS aprovados,
       COUNT(*) FILTER (WHERE status='pendente')                       AS pendentes,
       COUNT(*) FILTER (WHERE status='recusado')                       AS recusados,
       CASE WHEN COUNT(*) FILTER (WHERE status IN ('aprovado','recusado')) > 0
            THEN round(COUNT(*) FILTER (WHERE status='aprovado')::numeric
                       / COUNT(*) FILTER (WHERE status IN ('aprovado','recusado')) * 100, 1)
            ELSE 0 END                                                 AS taxa_aprovacao_pct,
       COALESCE(round(AVG(total) FILTER (WHERE status='aprovado'), 2),0) AS ticket_medio,
       COALESCE(SUM(total) FILTER (WHERE status='aprovado'),0)         AS total_faturado,
       COALESCE(SUM(valor_recebido) FILTER (WHERE status='aprovado'),0) AS total_recebido,
       COALESCE(SUM(total) FILTER (WHERE status='aprovado'),0)
         - COALESCE(SUM(valor_recebido) FILTER (WHERE status='aprovado'),0) AS inadimplencia
FROM orcamentos GROUP BY empresa_id;

GRANT SELECT ON vw_analise_produtos, vw_analise_financeiro_mensal, vw_analise_orcamentos TO authenticated;

-- ═════════════════════════════════════════════════════════════════════
--  PAINEL ROOT DA PLATAFORMA (admin do SaaS, cross-tenant)
--  Aditivo — NÃO altera nenhuma policy de isolamento por empresa já existente.
--  O acesso cross-tenant destas RPCs é checado DENTRO da função
--  (is_platform_admin()), não por uma policy nova nas tabelas de negócio.
-- ═════════════════════════════════════════════════════════════════════

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

CREATE OR REPLACE FUNCTION sou_admin_plataforma()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_platform_admin(auth.uid());
$$;
GRANT EXECUTE ON FUNCTION sou_admin_plataforma() TO authenticated;

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

CREATE OR REPLACE FUNCTION admin_set_empresa_ativo(p_empresa uuid, p_ativo boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'sem acesso'; END IF;
  UPDATE empresas SET ativo = p_ativo WHERE id = p_empresa;
  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION admin_set_empresa_ativo(uuid, boolean) TO authenticated;

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

-- ═════════════════════════════════════════════════════════════════════
--  SEGURANÇA: verificação de PIN interno movida pro servidor
--  (achado de auditoria de segurança — ver setup-v2-delta6.sql)
-- ═════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION verificar_pin_interno(p_empresa uuid, p_usuario_id text, p_pin_tentado text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_hash_tentado text := encode(digest(coalesce(p_pin_tentado,'') || 'fluxa2025', 'sha256'), 'hex');
  v_cfg_pin text;
  v_usr usuarios%ROWTYPE;
  v_ok boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF p_empresa IS NULL OR p_empresa NOT IN (SELECT minhas_empresas()) THEN
    RAISE EXCEPTION 'sem acesso a esta empresa';
  END IF;

  SELECT config->>'pin' INTO v_cfg_pin FROM empresas WHERE id = p_empresa;

  IF p_usuario_id IS NULL OR p_usuario_id = '__gestor__' THEN
    IF v_cfg_pin IS NULL OR v_cfg_pin = '' THEN v_ok := (p_pin_tentado = '1234');
    ELSIF length(v_cfg_pin) = 64 THEN v_ok := (v_hash_tentado = v_cfg_pin);
    ELSE v_ok := (v_cfg_pin = p_pin_tentado); END IF;
    RETURN v_ok;
  END IF;

  SELECT * INTO v_usr FROM usuarios WHERE id = p_usuario_id AND empresa_id = p_empresa;
  IF v_usr.id IS NULL THEN RETURN false; END IF;

  IF v_usr.pin IS NOT NULL AND v_usr.pin <> '' THEN
    IF length(v_usr.pin) = 64 THEN v_ok := (v_hash_tentado = v_usr.pin);
    ELSE v_ok := (v_usr.pin = p_pin_tentado); END IF;
  END IF;

  IF NOT v_ok AND (v_usr.pin IS NULL OR v_usr.pin = '') THEN
    IF v_cfg_pin IS NULL OR v_cfg_pin = '' THEN v_ok := (p_pin_tentado = '1234');
    ELSIF length(v_cfg_pin) = 64 THEN v_ok := (v_hash_tentado = v_cfg_pin);
    ELSE v_ok := (v_cfg_pin = p_pin_tentado); END IF;
  END IF;

  RETURN v_ok;
END $$;
GRANT EXECUTE ON FUNCTION verificar_pin_interno(uuid, text, text) TO authenticated;

CREATE OR REPLACE VIEW usuarios_lista WITH (security_invoker = true) AS
SELECT id, empresa_id, nome, perfil, loja_id, loja_nome, ativo, data_criacao,
       (pin IS NOT NULL AND pin <> '') AS tem_pin
FROM usuarios;
GRANT SELECT ON usuarios_lista TO authenticated;
