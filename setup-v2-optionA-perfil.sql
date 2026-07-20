-- ═══════════════════════════════════════════════════════════════════════════
-- FLUXA V2 — OPÇÃO A: enforcement de PERFIL no banco (ATIVAÇÃO — greenfield)
-- ═══════════════════════════════════════════════════════════════════════════
-- Ver CLAUDE.md → "Proteção por perfil no banco". Dá a cada pessoa uma identidade
-- de auth própria (dono = conta real; funcionário = conta sintética nome+PIN) e
-- troca a RLS "isolamento por empresa" (FOR ALL) por policies POR PERFIL.
--
-- SEGURO rodar agora: SaaS ainda NÃO operante (sem dados/clientes reais).
-- Idempotente. Rodar no SQL Editor do Supabase. Depois: testar RLS (Claude, via
-- sessões de teste) + login real ponta a ponta (Marcos).
--
-- Matriz de acesso (gestor / vendas / técnico):
--   empresas ...... SELECT membro | UPDATE gestor
--   lojas ......... SELECT membro | write gestor
--   usuarios ...... SELECT membro | write gestor
--   clientes ...... SELECT/INSERT/UPDATE todos | DELETE gestor
--   orcamentos .... gestor+vendas (INSERT/UPDATE) | SELECT gestor+vendas | DELETE gestor | técnico SEM acesso (financeiro)
--   ordens_servico  SELECT gestor+vendas=tudo, técnico=as suas | INSERT gestor+vendas | UPDATE gestor+vendas=tudo, técnico=as suas | DELETE gestor
--   agendamentos .. SELECT todos | INSERT/UPDATE gestor+vendas | DELETE gestor
--   vistorias ..... SELECT gestor+vendas=tudo, técnico=as suas | INSERT/UPDATE gestor+técnico | DELETE gestor
--   locais_vistoria SELECT todos | INSERT/UPDATE gestor+vendas | DELETE gestor
--   equipamentos .. SELECT todos | INSERT/UPDATE gestor+vendas | DELETE gestor
--   despesas ...... SELECT gestor=tudo, técnico=as suas | INSERT gestor+técnico | UPDATE/DELETE gestor | vendas SEM acesso
--   produtos ...... SELECT todos | write gestor
--   estoque_movimentos  SELECT todos | INSERT todos (ledger append-only) | sem UPDATE/DELETE
--   fornecedores / ordens_compra / notas_fiscais ... gestor only
--   auditoria ..... INSERT todos (logAcao) | SELECT gestor
--   contadores .... sem acesso direto (só via RPC proximo_numero, SECURITY DEFINER)

-- ───────── 1) Helpers ─────────
CREATE OR REPLACE FUNCTION meu_perfil(p_empresa uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT perfil FROM membros WHERE user_id = auth.uid() AND empresa_id = p_empresa;
$$;
CREATE OR REPLACE FUNCTION meu_nome(p_empresa uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT nome FROM membros WHERE user_id = auth.uid() AND empresa_id = p_empresa;
$$;
GRANT EXECUTE ON FUNCTION meu_perfil(uuid), meu_nome(uuid) TO authenticated;

-- ───────── 2) Login: lista de nomes (sem PIN) para a tela, pré-vínculo ─────────
-- O funcionário na sua conta própria ainda não é membro quando abre o app; precisa
-- ver os nomes para escolher o seu. Só nomes/ids/perfil — nunca o PIN.
CREATE OR REPLACE FUNCTION usuarios_para_login(p_empresa uuid)
RETURNS TABLE(id text, nome text, perfil text, loja_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, nome, perfil, loja_id FROM usuarios WHERE empresa_id = p_empresa AND ativo = true;
$$;
GRANT EXECUTE ON FUNCTION usuarios_para_login(uuid) TO anon, authenticated;

-- ───────── 3) Provisionamento: funcionário prova o PIN e vira membro ─────────
-- Roda como o PRÓPRIO funcionário (auth.uid() = conta sintética recém-criada).
-- Valida o PIN contra usuarios (mesma lógica de verificar_pin_interno, mas SEM
-- exigir que já seja membro — é o passo de entrada). Cria/atualiza membros com o
-- perfil definido pelo gestor. O PIN é a barreira (igual ao modelo atual).
CREATE OR REPLACE FUNCTION vincular_funcionario(p_empresa uuid, p_usuario_id text, p_pin text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_usr usuarios%ROWTYPE;
  v_cfg_pin text;
  v_hash text := encode(digest(coalesce(p_pin,'') || 'fluxa2025', 'sha256'), 'hex');
  v_ok boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT * INTO v_usr FROM usuarios WHERE id = p_usuario_id AND empresa_id = p_empresa AND ativo = true;
  IF v_usr.id IS NULL THEN RAISE EXCEPTION 'usuário não encontrado'; END IF;
  SELECT config->>'pin' INTO v_cfg_pin FROM empresas WHERE id = p_empresa;

  IF v_usr.pin IS NOT NULL AND v_usr.pin <> '' THEN
    IF length(v_usr.pin) = 64 THEN v_ok := (v_hash = v_usr.pin); ELSE v_ok := (v_usr.pin = p_pin); END IF;
  END IF;
  IF NOT v_ok AND (v_usr.pin IS NULL OR v_usr.pin = '') THEN
    IF v_cfg_pin IS NULL OR v_cfg_pin = '' THEN v_ok := (p_pin = '1234');
    ELSIF length(v_cfg_pin) = 64 THEN v_ok := (v_hash = v_cfg_pin);
    ELSE v_ok := (v_cfg_pin = p_pin); END IF;
  END IF;

  IF NOT v_ok THEN RAISE EXCEPTION 'PIN incorreto'; END IF;

  INSERT INTO membros (user_id, empresa_id, perfil, nome)
    VALUES (auth.uid(), p_empresa, v_usr.perfil, v_usr.nome)
    ON CONFLICT (user_id, empresa_id) DO UPDATE SET perfil = EXCLUDED.perfil, nome = EXCLUDED.nome;
  RETURN v_usr.perfil;
END $$;
GRANT EXECUTE ON FUNCTION vincular_funcionario(uuid, text, text) TO authenticated;

-- ───────── 4) RLS POR PERFIL (substitui "isolamento por empresa" nas sensíveis) ─────────
-- Helper interno: é membro da empresa? (para SELECTs abertos a todos os perfis)
-- (usa minhas_empresas() que já existe)

-- ===== TODOS OS PERFIS (leitura+escrita p/ membro; delete gestor) =====
-- clientes, agendamentos(w gestor+vendas), locais_vistoria(w g+v), equipamentos(w g+v)
DROP POLICY IF EXISTS "isolamento por empresa" ON clientes;
DROP POLICY IF EXISTS "cli sel" ON clientes; DROP POLICY IF EXISTS "cli ins" ON clientes;
DROP POLICY IF EXISTS "cli upd" ON clientes; DROP POLICY IF EXISTS "cli del" ON clientes;
CREATE POLICY "cli sel" ON clientes FOR SELECT TO authenticated USING (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "cli ins" ON clientes FOR INSERT TO authenticated WITH CHECK (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "cli upd" ON clientes FOR UPDATE TO authenticated USING (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "cli del" ON clientes FOR DELETE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');

-- ===== GESTOR + VENDAS (técnico sem acesso): orcamentos =====
DROP POLICY IF EXISTS "isolamento por empresa" ON orcamentos;
DROP POLICY IF EXISTS "orc sel" ON orcamentos; DROP POLICY IF EXISTS "orc ins" ON orcamentos;
DROP POLICY IF EXISTS "orc upd" ON orcamentos; DROP POLICY IF EXISTS "orc del" ON orcamentos;
CREATE POLICY "orc sel" ON orcamentos FOR SELECT TO authenticated USING (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "orc ins" ON orcamentos FOR INSERT TO authenticated WITH CHECK (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "orc upd" ON orcamentos FOR UPDATE TO authenticated USING (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "orc del" ON orcamentos FOR DELETE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');

-- ===== OS: gestor/vendas = tudo; técnico = só as suas =====
DROP POLICY IF EXISTS "isolamento por empresa" ON ordens_servico;
DROP POLICY IF EXISTS "os sel" ON ordens_servico; DROP POLICY IF EXISTS "os ins" ON ordens_servico;
DROP POLICY IF EXISTS "os upd" ON ordens_servico; DROP POLICY IF EXISTS "os del" ON ordens_servico;
CREATE POLICY "os sel" ON ordens_servico FOR SELECT TO authenticated USING (
  empresa_id IN (SELECT minhas_empresas()) AND
  (meu_perfil(empresa_id) IN ('gestor','vendas') OR tecnico = meu_nome(empresa_id)));
CREATE POLICY "os ins" ON ordens_servico FOR INSERT TO authenticated WITH CHECK (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "os upd" ON ordens_servico FOR UPDATE TO authenticated USING (
  empresa_id IN (SELECT minhas_empresas()) AND
  (meu_perfil(empresa_id) IN ('gestor','vendas') OR tecnico = meu_nome(empresa_id)));
CREATE POLICY "os del" ON ordens_servico FOR DELETE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');

-- ===== agendamentos =====
DROP POLICY IF EXISTS "isolamento por empresa" ON agendamentos;
DROP POLICY IF EXISTS "ag sel" ON agendamentos; DROP POLICY IF EXISTS "ag ins" ON agendamentos;
DROP POLICY IF EXISTS "ag upd" ON agendamentos; DROP POLICY IF EXISTS "ag del" ON agendamentos;
CREATE POLICY "ag sel" ON agendamentos FOR SELECT TO authenticated USING (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "ag ins" ON agendamentos FOR INSERT TO authenticated WITH CHECK (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "ag upd" ON agendamentos FOR UPDATE TO authenticated USING (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "ag del" ON agendamentos FOR DELETE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');

-- ===== vistorias: gestor/vendas=tudo, técnico=as suas; escreve gestor+técnico =====
DROP POLICY IF EXISTS "isolamento por empresa" ON vistorias;
DROP POLICY IF EXISTS "vis sel" ON vistorias; DROP POLICY IF EXISTS "vis ins" ON vistorias;
DROP POLICY IF EXISTS "vis upd" ON vistorias; DROP POLICY IF EXISTS "vis del" ON vistorias;
CREATE POLICY "vis sel" ON vistorias FOR SELECT TO authenticated USING (
  empresa_id IN (SELECT minhas_empresas()) AND
  (meu_perfil(empresa_id) IN ('gestor','vendas') OR tecnico = meu_nome(empresa_id)));
CREATE POLICY "vis ins" ON vistorias FOR INSERT TO authenticated WITH CHECK (meu_perfil(empresa_id) IN ('gestor','tecnico'));
CREATE POLICY "vis upd" ON vistorias FOR UPDATE TO authenticated USING (
  empresa_id IN (SELECT minhas_empresas()) AND
  (meu_perfil(empresa_id) = 'gestor' OR tecnico = meu_nome(empresa_id)));
CREATE POLICY "vis del" ON vistorias FOR DELETE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');

-- ===== locais_vistoria =====
DROP POLICY IF EXISTS "isolamento por empresa" ON locais_vistoria;
DROP POLICY IF EXISTS "loc sel" ON locais_vistoria; DROP POLICY IF EXISTS "loc ins" ON locais_vistoria;
DROP POLICY IF EXISTS "loc upd" ON locais_vistoria; DROP POLICY IF EXISTS "loc del" ON locais_vistoria;
CREATE POLICY "loc sel" ON locais_vistoria FOR SELECT TO authenticated USING (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "loc ins" ON locais_vistoria FOR INSERT TO authenticated WITH CHECK (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "loc upd" ON locais_vistoria FOR UPDATE TO authenticated USING (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "loc del" ON locais_vistoria FOR DELETE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');

-- ===== equipamentos =====
DROP POLICY IF EXISTS "isolamento por empresa" ON equipamentos;
DROP POLICY IF EXISTS "eq sel" ON equipamentos; DROP POLICY IF EXISTS "eq ins" ON equipamentos;
DROP POLICY IF EXISTS "eq upd" ON equipamentos; DROP POLICY IF EXISTS "eq del" ON equipamentos;
CREATE POLICY "eq sel" ON equipamentos FOR SELECT TO authenticated USING (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "eq ins" ON equipamentos FOR INSERT TO authenticated WITH CHECK (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "eq upd" ON equipamentos FOR UPDATE TO authenticated USING (meu_perfil(empresa_id) IN ('gestor','vendas'));
CREATE POLICY "eq del" ON equipamentos FOR DELETE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');

-- ===== despesas: gestor=tudo, técnico=as suas; vendas sem acesso =====
DROP POLICY IF EXISTS "isolamento por empresa" ON despesas;
DROP POLICY IF EXISTS "desp sel" ON despesas; DROP POLICY IF EXISTS "desp ins" ON despesas;
DROP POLICY IF EXISTS "desp upd" ON despesas; DROP POLICY IF EXISTS "desp del" ON despesas;
CREATE POLICY "desp sel" ON despesas FOR SELECT TO authenticated USING (
  empresa_id IN (SELECT minhas_empresas()) AND
  (meu_perfil(empresa_id) = 'gestor' OR tecnico = meu_nome(empresa_id)));
CREATE POLICY "desp ins" ON despesas FOR INSERT TO authenticated WITH CHECK (meu_perfil(empresa_id) IN ('gestor','tecnico'));
CREATE POLICY "desp upd" ON despesas FOR UPDATE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');
CREATE POLICY "desp del" ON despesas FOR DELETE TO authenticated USING (meu_perfil(empresa_id) = 'gestor');

-- ===== lojas / usuarios: leitura membro; escrita gestor =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lojas','usuarios'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "isolamento por empresa" ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s sel" ON %I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s wr" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "%s sel" ON %I FOR SELECT TO authenticated USING (empresa_id IN (SELECT minhas_empresas()));', t, t);
    EXECUTE format('CREATE POLICY "%s wr" ON %I FOR ALL TO authenticated USING (meu_perfil(empresa_id) = ''gestor'') WITH CHECK (meu_perfil(empresa_id) = ''gestor'');', t, t);
  END LOOP;
END $$;

-- ===== produtos: leitura membro; escrita gestor =====
DROP POLICY IF EXISTS "isolamento por empresa" ON produtos;
DROP POLICY IF EXISTS "prod sel" ON produtos; DROP POLICY IF EXISTS "prod wr" ON produtos;
CREATE POLICY "prod sel" ON produtos FOR SELECT TO authenticated USING (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "prod wr" ON produtos FOR ALL TO authenticated USING (meu_perfil(empresa_id) = 'gestor') WITH CHECK (meu_perfil(empresa_id) = 'gestor');

-- ===== estoque_movimentos: ledger append-only; leitura+insert p/ membro =====
DROP POLICY IF EXISTS "isolamento por empresa" ON estoque_movimentos;
DROP POLICY IF EXISTS "mov sel" ON estoque_movimentos; DROP POLICY IF EXISTS "mov ins" ON estoque_movimentos;
CREATE POLICY "mov sel" ON estoque_movimentos FOR SELECT TO authenticated USING (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "mov ins" ON estoque_movimentos FOR INSERT TO authenticated WITH CHECK (empresa_id IN (SELECT minhas_empresas()));

-- ===== gestor-only: fornecedores, ordens_compra, notas_fiscais =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fornecedores','ordens_compra','notas_fiscais'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "isolamento por empresa" ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s gestor" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "%s gestor" ON %I FOR ALL TO authenticated USING (meu_perfil(empresa_id) = ''gestor'') WITH CHECK (meu_perfil(empresa_id) = ''gestor'');', t, t);
  END LOOP;
END $$;

-- ===== auditoria: insert p/ todos (logAcao); leitura gestor =====
DROP POLICY IF EXISTS "isolamento por empresa" ON auditoria;
DROP POLICY IF EXISTS "aud sel" ON auditoria; DROP POLICY IF EXISTS "aud ins" ON auditoria;
CREATE POLICY "aud ins" ON auditoria FOR INSERT TO authenticated WITH CHECK (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "aud sel" ON auditoria FOR SELECT TO authenticated USING (meu_perfil(empresa_id) = 'gestor');

-- ───────── 5) GERENCIAMENTO DE FUNCIONÁRIO + login no próprio aparelho ─────────
-- (itens 1 e 3 do pós-Opção A: bootstrap por link, desativar, reset de PIN)

-- versão do login: reset de PIN incrementa → e-mail sintético novo → conta nova.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS auth_ver integer DEFAULT 0;

-- empresa por slug (anon) — bootstrap do técnico via link #e/<slug>. Só marca (sem PIN/segredos).
CREATE OR REPLACE FUNCTION empresa_por_slug(p_slug text)
RETURNS TABLE(id uuid, nome text, branding jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.nome,
    jsonb_build_object('nome',e.config->>'nome','appName',e.config->>'appName','sub',e.config->>'sub',
      'cor',e.config->>'cor','cor2',e.config->>'cor2','tagline',e.config->>'tagline','logoB64',e.config->>'logoB64')
  FROM empresas e WHERE e.slug = p_slug AND e.ativo = true;
$$;
GRANT EXECUTE ON FUNCTION empresa_por_slug(text) TO anon, authenticated;

-- lista de nomes p/ login (SUPERSEDE a versão anterior: agora inclui auth_ver)
DROP FUNCTION IF EXISTS usuarios_para_login(uuid);
CREATE FUNCTION usuarios_para_login(p_empresa uuid)
RETURNS TABLE(id text, nome text, perfil text, loja_id uuid, auth_ver integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, nome, perfil, loja_id, COALESCE(auth_ver,0) FROM usuarios WHERE empresa_id = p_empresa AND ativo = true;
$$;
GRANT EXECUTE ON FUNCTION usuarios_para_login(uuid) TO anon, authenticated;

-- view de usuários (sem PIN) — agora com auth_ver
CREATE OR REPLACE VIEW usuarios_lista WITH (security_invoker=true) AS
SELECT id, empresa_id, nome, perfil, loja_id, loja_nome, ativo, data_criacao,
       (pin IS NOT NULL AND pin <> '') AS tem_pin, COALESCE(auth_ver,0) AS auth_ver
FROM usuarios;

-- desativar funcionário: ativo=false + REMOVE o membros (corta a RLS na hora, mesmo com sessão ativa)
CREATE OR REPLACE FUNCTION desativar_funcionario(p_empresa uuid, p_usuario_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slug text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM membros WHERE user_id=auth.uid() AND empresa_id=p_empresa AND perfil IN ('gestor','master')) THEN
    RAISE EXCEPTION 'apenas o gestor pode desativar funcionarios'; END IF;
  UPDATE usuarios SET ativo=false WHERE id=p_usuario_id AND empresa_id=p_empresa;
  SELECT slug INTO v_slug FROM empresas WHERE id=p_empresa;
  DELETE FROM membros m USING auth.users u WHERE m.user_id=u.id AND m.empresa_id=p_empresa
    AND (u.email = p_usuario_id||'@'||v_slug||'.fluxa.local' OR u.email LIKE p_usuario_id||'.v%@'||v_slug||'.fluxa.local');
END $$;
GRANT EXECUTE ON FUNCTION desativar_funcionario(uuid, text) TO authenticated;

-- reset de PIN: remove membros da conta atual + bumpa auth_ver + grava PIN novo
-- (próximo login = conta nova com o PIN novo; a antiga perde acesso).
CREATE OR REPLACE FUNCTION resetar_pin_funcionario(p_empresa uuid, p_usuario_id text, p_pin_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slug text; v_ver integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM membros WHERE user_id=auth.uid() AND empresa_id=p_empresa AND perfil IN ('gestor','master')) THEN
    RAISE EXCEPTION 'apenas o gestor pode resetar PIN'; END IF;
  SELECT slug INTO v_slug FROM empresas WHERE id=p_empresa;
  SELECT COALESCE(auth_ver,0) INTO v_ver FROM usuarios WHERE id=p_usuario_id AND empresa_id=p_empresa;
  DELETE FROM membros m USING auth.users u WHERE m.user_id=u.id AND m.empresa_id=p_empresa
    AND u.email = (CASE WHEN v_ver=0 THEN p_usuario_id ELSE p_usuario_id||'.v'||v_ver END)||'@'||v_slug||'.fluxa.local';
  UPDATE usuarios SET pin=p_pin_hash, auth_ver=v_ver+1 WHERE id=p_usuario_id AND empresa_id=p_empresa;
END $$;
GRANT EXECUTE ON FUNCTION resetar_pin_funcionario(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
