-- FLUXA V2 — DELTA 29: piscinas (ficha técnica) + fatores de consumo teórico
-- Rode UMA vez.
--
-- Portado do fluxa-app (v1) — Etapa 5 do roadmap de CRM lá. Volume da
-- piscina não é capturado em lugar nenhum hoje — é o número que destrava
-- dosagem/consumo teórico de químicos. Entidade própria (não campo achatado
-- em clientes) porque um condomínio pode ter mais de uma piscina, com
-- volumes/tratamentos diferentes (adulto/infantil, torres com piscina
-- própria).
--
-- ⚠️ Achado ao portar: a versão do v1 (`migracao-piscinas.sql`) usa
-- `CREATE POLICY "anon full access" ON piscinas FOR ALL TO anon USING
-- (true)` — está certo LÁ porque o v1 é single-tenant (1 deploy por
-- empresa, sem isolamento entre empresas pra fazer). Copiar isso pro v2
-- SERIA um buraco de segurança real (qualquer anon leria/escreveria
-- piscina de QUALQUER empresa). Aqui uso o mesmo padrão de RLS por perfil
-- que `equipamentos` já usa (setup-v2-optionA-perfil.sql) — SELECT pra
-- qualquer membro autenticado, INSERT/UPDATE gestor+vendas, DELETE só
-- gestor. Ajustar depois se técnico precisar escrever direto (hoje
-- equipamentos também não deixa, segui o mesmo precedente).

CREATE TABLE IF NOT EXISTS piscinas (
  id text PRIMARY KEY,  -- app gera id texto (ex.: 'psc_...'), mesmo padrão de clientes/equipamentos
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id text,      -- clientes.id é text, não uuid — não repetir o mismatch já visto em outra tabela
  local_id text,        -- opcional: liga a locais_vistoria quando existe plano de vistoria
  nome text,             -- ex: "Piscina Adulto" — opcional, "Piscina principal" por padrão na UI
  volume_m3 numeric(10,2),
  tipo_tratamento text,  -- 'cloro_liquido_10'|'dicloro_granulado'|'hipoclorito_calcio'|'pastilha_tricloro'|'sal_salino'|'bromo'|'peroxido'
  loja_id text,
  -- Fatores de consumo (extensão do v1, mesma ordem de prioridade preditiva
  -- da referência técnica deles):
  capa_termica boolean DEFAULT false,
  exposicao_solar text DEFAULT 'pleno',   -- 'pleno' | 'parcial'
  aquecida boolean DEFAULT false,
  tipo_uso text DEFAULT 'residencial',    -- 'residencial' | 'condominio'
  banhistas_dia integer,                  -- só relevante se tipo_uso='condominio'
  estabilizante boolean DEFAULT true,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_piscinas_cliente ON piscinas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_piscinas_empresa ON piscinas(empresa_id);

ALTER TABLE piscinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "psc sel" ON piscinas; DROP POLICY IF EXISTS "psc ins" ON piscinas;
DROP POLICY IF EXISTS "psc upd" ON piscinas; DROP POLICY IF EXISTS "psc del" ON piscinas;
CREATE POLICY "psc sel" ON piscinas FOR SELECT TO authenticated USING (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "psc ins" ON piscinas FOR INSERT TO authenticated WITH CHECK (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "psc upd" ON piscinas FOR UPDATE TO authenticated USING (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "psc del" ON piscinas FOR DELETE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');

-- equipamentos ganha vínculo opcional com a piscina específica dentro do
-- condomínio/casa do cliente (equipamentos.cliente_id já existe, este é o
-- nível abaixo — "qual piscina", não só "qual cliente").
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS piscina_id text;
CREATE INDEX IF NOT EXISTS idx_equipamentos_piscina ON equipamentos(piscina_id);

-- Realtime, mesmo padrão das outras tabelas de cadastro
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE piscinas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
