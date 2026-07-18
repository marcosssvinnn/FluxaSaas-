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
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_membros_empresa ON membros(empresa_id);

CREATE OR REPLACE FUNCTION minhas_empresas()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM membros WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION criar_empresa(p_nome text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  INSERT INTO empresas (nome, slug)
  VALUES (p_nome, regexp_replace(lower(p_nome), '[^a-z0-9]+', '-', 'g') || '-' || substr(gen_random_uuid()::text, 1, 4))
  RETURNING id INTO v_id;
  INSERT INTO membros (user_id, empresa_id, perfil) VALUES (auth.uid(), v_id, 'gestor');
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
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL, pin text, perfil text DEFAULT 'tecnico',
  loja_id uuid, loja_nome text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text, telefone text, endereco text,
  portal_token uuid DEFAULT gen_random_uuid(), portal_ativo boolean DEFAULT true,
  cnpj text, email_responsavel text, loja_id text,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orcamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero integer, cliente text, local_servico text,
  tel_cliente text, servicos jsonb,
  subtotal numeric(10,2), desconto numeric(10,2),
  total numeric(10,2), pagamento text,
  validade_dias integer, validade_data text,
  data_servico text, escopo text, obs text,
  foto_base64 text, assinatura_base64 text,
  valor_recebido numeric(10,2) DEFAULT 0,
  status text DEFAULT 'pendente',
  nota_interna text, cnpj text, loja_id text, origem_cliente text,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordens_servico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero integer, orcamento_id uuid,
  cliente text, local_servico text,
  data_servico text, hora text,
  tecnico text, servicos jsonb,
  materiais text, obs_tecnica text,
  total numeric(10,2) DEFAULT 0,
  valor_recebido numeric(10,2) DEFAULT 0,
  status text DEFAULT 'agendado',
  fotos jsonb DEFAULT '[]', video_link text, agendamento_id uuid,
  checkin_time timestamptz, checkout_time timestamptz, duracao_min integer,
  cnpj text, loja_id text, checklist text,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
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
  loja_id text, cliente text, local text,
  data text, hora text, tecnico text, mes_ref text,
  hora_checkin text, hora_checkout text,
  obs_geral text, email_responsavel text,
  equipamentos jsonb DEFAULT '[]', local_id text,
  created_at timestamptz DEFAULT now()
);

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
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id uuid, cliente_nome text,
  tipo text, marca text, modelo text, potencia text,
  numero_serie text, data_instalacao text,
  garantia_meses integer DEFAULT 12, garantia_vencimento text,
  obs text, foto_base64 text, loja_id text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS despesas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
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
    EXECUTE format(
      'CREATE POLICY "isolamento por empresa" ON %I FOR ALL TO authenticated
         USING (empresa_id IN (SELECT minhas_empresas()))
         WITH CHECK (empresa_id IN (SELECT minhas_empresas()));', t);
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

-- ───────── STORAGE (PDFs por empresa) ─────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('vistorias-pdf', 'vistorias-pdf', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "upload na pasta da empresa" ON storage.objects;
CREATE POLICY "upload na pasta da empresa" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vistorias-pdf'
    AND (storage.foldername(name))[1] IN (SELECT minhas_empresas()::text));

DROP POLICY IF EXISTS "update na pasta da empresa" ON storage.objects;
CREATE POLICY "update na pasta da empresa" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'vistorias-pdf'
    AND (storage.foldername(name))[1] IN (SELECT minhas_empresas()::text));

DROP POLICY IF EXISTS "leitura publica pdf" ON storage.objects;
CREATE POLICY "leitura publica pdf" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'vistorias-pdf');

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
                  WHERE o.empresa_id = v_cli.empresa_id AND o.cliente = v_cli.nome), '[]'::jsonb),
    'ordens_servico', COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'fotos')
                  FROM ordens_servico s
                  WHERE s.empresa_id = v_cli.empresa_id AND s.cliente = v_cli.nome), '[]'::jsonb),
    'vistorias', COALESCE((SELECT jsonb_agg(to_jsonb(v))
                  FROM vistorias v
                  WHERE v.empresa_id = v_cli.empresa_id AND v.cliente = v_cli.nome), '[]'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END $$;

CREATE OR REPLACE FUNCTION portal_responder_orcamento(p_token uuid, p_orc_id uuid, p_aprovar boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cli clientes%ROWTYPE;
BEGIN
  SELECT * INTO v_cli FROM clientes
    WHERE portal_token = p_token AND portal_ativo = true
    LIMIT 1;
  IF v_cli.id IS NULL THEN RETURN false; END IF;
  UPDATE orcamentos
    SET status = CASE WHEN p_aprovar THEN 'aprovado' ELSE 'recusado' END
    WHERE id = p_orc_id
      AND empresa_id = v_cli.empresa_id
      AND cliente = v_cli.nome
      AND status = 'pendente';
  RETURN FOUND;
END $$;

GRANT EXECUTE ON FUNCTION portal_dados(uuid) TO anon;
GRANT EXECUTE ON FUNCTION portal_responder_orcamento(uuid, uuid, boolean) TO anon;
