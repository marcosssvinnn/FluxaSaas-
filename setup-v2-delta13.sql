-- FLUXA V2 — DELTA 13: prepara tecnico_user_id (achado de auditoria, prep — não muda comportamento)
-- Rode UMA vez no SQL Editor. Aditivo: só adiciona coluna/índice, faz backfill
-- condicional e ACRESCENTA uma condição "OR" nas policies (nunca remove acesso
-- que já existe hoje). Zero mudança de comportamento até o app.js popular a
-- coluna — o que NÃO foi feito aqui de propósito (ver nota abaixo).
--
-- Problema encontrado (revisão do SQL de perfil da Opção A): as policies de
-- ordens_servico/vistorias/despesas usam `tecnico = meu_nome(empresa_id)` —
-- comparação por NOME de texto, o mesmo padrão frágil já corrigido pra
-- cliente↔orçamento no delta8. Se dois funcionários da mesma empresa tiverem
-- o mesmo nome (ou a grafia salva em `tecnico` não bater exatamente com
-- `membros.nome` — maiúsculas, acentos), um técnico pode ver o trabalho do
-- outro, ou não ver o próprio.
--
-- Fix (só a metade segura): adiciona `tecnico_user_id uuid` nas 3 tabelas,
-- faz backfill best-effort (só quando o nome bate com EXATAMENTE 1 membro da
-- empresa) e acrescenta `OR tecnico_user_id = auth.uid()` nas policies —
-- sempre falso enquanto a coluna estiver NULL, então não muda nada até ser
-- preenchida.
--
-- NÃO fiz a outra metade (o app.js popular tecnico_user_id ao salvar OS/
-- vistoria/despesa): isso exige entender a fundo o modelo de sessão da Fase 2
-- (login real por pessoa, e-mail sintético) que está em desenvolvimento ativo
-- por outra sessão/IA — popular esse campo errado misturaria a autoria do
-- trabalho entre funcionários. Fica como follow-up, coordenado com quem
-- desenvolveu a Fase 2.

ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS tecnico_user_id uuid;
ALTER TABLE vistorias      ADD COLUMN IF NOT EXISTS tecnico_user_id uuid;
ALTER TABLE despesas       ADD COLUMN IF NOT EXISTS tecnico_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_os_tecnico_user_id       ON ordens_servico(tecnico_user_id);
CREATE INDEX IF NOT EXISTS idx_vis_tecnico_user_id      ON vistorias(tecnico_user_id);
CREATE INDEX IF NOT EXISTS idx_desp_tecnico_user_id     ON despesas(tecnico_user_id);

-- Backfill best-effort: só quando o texto em `tecnico` bate com EXATAMENTE 1
-- membro (por nome) da mesma empresa. Ambíguos ficam NULL (fallback por nome
-- continua servindo, sem piorar nada).
UPDATE ordens_servico o SET tecnico_user_id = m.user_id
FROM membros m
WHERE o.tecnico_user_id IS NULL
  AND o.empresa_id = m.empresa_id
  AND lower(trim(o.tecnico)) = lower(trim(m.nome))
  AND (SELECT count(*) FROM membros m2 WHERE m2.empresa_id = o.empresa_id AND lower(trim(m2.nome)) = lower(trim(o.tecnico))) = 1;

UPDATE vistorias v SET tecnico_user_id = m.user_id
FROM membros m
WHERE v.tecnico_user_id IS NULL
  AND v.empresa_id = m.empresa_id
  AND lower(trim(v.tecnico)) = lower(trim(m.nome))
  AND (SELECT count(*) FROM membros m2 WHERE m2.empresa_id = v.empresa_id AND lower(trim(m2.nome)) = lower(trim(v.tecnico))) = 1;

UPDATE despesas d SET tecnico_user_id = m.user_id
FROM membros m
WHERE d.tecnico_user_id IS NULL
  AND d.empresa_id = m.empresa_id
  AND lower(trim(d.tecnico)) = lower(trim(m.nome))
  AND (SELECT count(*) FROM membros m2 WHERE m2.empresa_id = d.empresa_id AND lower(trim(m2.nome)) = lower(trim(d.tecnico))) = 1;

-- Policies: acrescenta "OR tecnico_user_id = auth.uid()" (só roda se a Opção A
-- Fase 1 já foi aplicada — as policies precisam existir antes de recriar).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ordens_servico' AND policyname='os sel') THEN
    DROP POLICY "os sel" ON ordens_servico;
    CREATE POLICY "os sel" ON ordens_servico FOR SELECT TO authenticated USING (
      empresa_id IN (SELECT minhas_empresas()) AND
      (meu_perfil(empresa_id) IN ('gestor','vendas') OR tecnico = meu_nome(empresa_id) OR tecnico_user_id = auth.uid()));
    DROP POLICY IF EXISTS "os upd" ON ordens_servico;
    CREATE POLICY "os upd" ON ordens_servico FOR UPDATE TO authenticated USING (
      empresa_id IN (SELECT minhas_empresas()) AND
      (meu_perfil(empresa_id) IN ('gestor','vendas') OR tecnico = meu_nome(empresa_id) OR tecnico_user_id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vistorias' AND policyname='vis sel') THEN
    DROP POLICY "vis sel" ON vistorias;
    CREATE POLICY "vis sel" ON vistorias FOR SELECT TO authenticated USING (
      empresa_id IN (SELECT minhas_empresas()) AND
      (meu_perfil(empresa_id) IN ('gestor','vendas') OR tecnico = meu_nome(empresa_id) OR tecnico_user_id = auth.uid()));
    DROP POLICY IF EXISTS "vis upd" ON vistorias;
    CREATE POLICY "vis upd" ON vistorias FOR UPDATE TO authenticated USING (
      empresa_id IN (SELECT minhas_empresas()) AND
      (meu_perfil(empresa_id) = 'gestor' OR tecnico = meu_nome(empresa_id) OR tecnico_user_id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='despesas' AND policyname='desp sel') THEN
    DROP POLICY "desp sel" ON despesas;
    CREATE POLICY "desp sel" ON despesas FOR SELECT TO authenticated USING (
      empresa_id IN (SELECT minhas_empresas()) AND
      (meu_perfil(empresa_id) = 'gestor' OR tecnico = meu_nome(empresa_id) OR tecnico_user_id = auth.uid()));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
