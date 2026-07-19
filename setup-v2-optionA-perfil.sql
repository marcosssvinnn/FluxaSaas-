-- ═══════════════════════════════════════════════════════════════════════════
-- FLUXA V2 — OPÇÃO A: enforcement de PERFIL no banco (RASCUNHO — NÃO RODAR AINDA)
-- ═══════════════════════════════════════════════════════════════════════════
-- Ver CLAUDE.md → "Proteção por perfil no banco — DECIDIDO". Este arquivo é a
-- ATIVAÇÃO da Opção A (identidade real por pessoa + RLS por perfil), mantendo o
-- login por nome+PIN via "e-mail sintético".
--
-- ⛔ NÃO RODAR EM PRODUÇÃO SEM:
--   1) testar TUDO numa empresa de teste (login real, troca de perfil, RLS);
--   2) migrar as personas `usuarios` para contas + linhas em `membros`;
--   3) aval explícito do Marcos.
-- A parte de RLS (trocar a policy "isolamento por empresa" FOR ALL por policies
-- por perfil) é a mais perigosa: errar EXPÕE ou TRANCA dados. Fazer tabela a
-- tabela, validando cada uma, nunca tudo de uma vez.

-- ───────── 1) Helper: perfil do usuário autenticado numa empresa ─────────
CREATE OR REPLACE FUNCTION meu_perfil(p_empresa uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT perfil FROM membros WHERE user_id = auth.uid() AND empresa_id = p_empresa;
$$;
GRANT EXECUTE ON FUNCTION meu_perfil(uuid) TO authenticated;

-- ───────── 2) Convites (provisionamento sem service_role no cliente) ─────────
-- Gestor cria um convite (empresa + perfil + código); o funcionário faz signUp do
-- e-mail sintético no 1º login e redime o convite → vira membro com o perfil certo.
CREATE TABLE IF NOT EXISTS convites (
  codigo text PRIMARY KEY,                    -- código curto que o gestor passa
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  perfil text NOT NULL DEFAULT 'tecnico',
  nome text,                                  -- nome da pessoa (vira membros.nome)
  usado_por uuid,                             -- auth.uid() que redimiu
  expira_em timestamptz DEFAULT now() + interval '7 days',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE convites ENABLE ROW LEVEL SECURITY;
-- só gestor da empresa lê/cria convites da própria empresa
DROP POLICY IF EXISTS "gestor gerencia convites" ON convites;
CREATE POLICY "gestor gerencia convites" ON convites FOR ALL TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM membros WHERE user_id = auth.uid() AND perfil = 'gestor'))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM membros WHERE user_id = auth.uid() AND perfil = 'gestor'));

CREATE OR REPLACE FUNCTION aceitar_convite(p_codigo text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v convites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT * INTO v FROM convites WHERE codigo = p_codigo;
  IF v.codigo IS NULL THEN RAISE EXCEPTION 'convite inválido'; END IF;
  IF v.usado_por IS NOT NULL THEN RAISE EXCEPTION 'convite já usado'; END IF;
  IF v.expira_em < now() THEN RAISE EXCEPTION 'convite expirado'; END IF;
  INSERT INTO membros (user_id, empresa_id, perfil, nome)
    VALUES (auth.uid(), v.empresa_id, v.perfil, v.nome)
    ON CONFLICT (user_id, empresa_id) DO UPDATE SET perfil = EXCLUDED.perfil;
  UPDATE convites SET usado_por = auth.uid() WHERE codigo = p_codigo;
  RETURN v.empresa_id;
END $$;
GRANT EXECUTE ON FUNCTION aceitar_convite(text) TO authenticated;

-- ───────── 3) RLS por perfil — TEMPLATE (rodar tabela a tabela, testando) ─────────
-- Padrão: trocar a policy única "isolamento por empresa" (FOR ALL) por policies
-- separadas por operação/perfil. Exemplo para `orcamentos` (financeiro = gestor;
-- vendas cria/edita; técnico não mexe). AJUSTAR por tabela conforme as regras de
-- negócio antes de rodar. NÃO copiar cego.
--
-- DROP POLICY IF EXISTS "isolamento por empresa" ON orcamentos;
-- CREATE POLICY "orc: membro lê" ON orcamentos FOR SELECT TO authenticated
--   USING (empresa_id IN (SELECT minhas_empresas()));
-- CREATE POLICY "orc: gestor/vendas escreve" ON orcamentos FOR INSERT TO authenticated
--   WITH CHECK (meu_perfil(empresa_id) IN ('gestor','vendas'));
-- CREATE POLICY "orc: gestor/vendas atualiza" ON orcamentos FOR UPDATE TO authenticated
--   USING (meu_perfil(empresa_id) IN ('gestor','vendas'));
-- CREATE POLICY "orc: só gestor apaga" ON orcamentos FOR DELETE TO authenticated
--   USING (meu_perfil(empresa_id) = 'gestor');
--
-- Técnico: nas OS/vistorias, restringir a SELECT/UPDATE das linhas onde
-- `tecnico = (SELECT nome FROM membros WHERE user_id=auth.uid() AND empresa_id=...)`
-- (ou adicionar coluna `responsavel_id uuid` e casar com auth.uid()).
--
-- `empresas` já tem "gestor edita empresa" — manter. Relatórios financeiros: se
-- virarem views/RPC, filtrar por meu_perfil()='gestor'.

NOTIFY pgrst, 'reload schema';
