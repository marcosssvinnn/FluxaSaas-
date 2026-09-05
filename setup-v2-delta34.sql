-- delta34 — backup do rascunho de vistoria na nuvem
--
-- O rascunho local (localStorage) resolve o caso mais comum: a tela apaga, o
-- app vai pra segundo plano, o navegador do celular descarta a página. Não
-- resolve o celular quebrar, ser perdido ou ter os dados limpos — e nessas
-- horas a equipe já saiu do local e a vistoria não tem como ser refeita.
--
-- 1 rascunho ativo por usuário (id = draft_<nome normalizado>), sobrescrito a
-- cada mudança. Não é histórico: é só o que está em andamento AGORA. Apagado
-- quando a vistoria é finalizada ou descartada.

CREATE TABLE IF NOT EXISTS vistoria_rascunhos (
  id text PRIMARY KEY,
  empresa_id uuid,
  usuario text,
  dados jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vistoria_rascunhos ENABLE ROW LEVEL SECURITY;

-- Mesmo escopo multi-tenant do resto: cada empresa só enxerga o próprio.
DROP POLICY IF EXISTS "rascunho por empresa" ON vistoria_rascunhos;
CREATE POLICY "rascunho por empresa" ON vistoria_rascunhos
  FOR ALL TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM minhas_empresas()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM minhas_empresas()));
