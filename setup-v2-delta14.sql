-- FLUXA V2 — DELTA 14: preenche tecnico_user_id sozinho (trigger), fecha o
-- gap deixado aberto no delta13 (schema pronto, mas nada populava a coluna).
-- Rode UMA vez no SQL Editor. Aditivo/idempotente (CREATE OR REPLACE FUNCTION,
-- DROP TRIGGER IF EXISTS antes de recriar). Requer o delta13 já aplicado
-- (usa as colunas tecnico_user_id que ele criou).
--
-- Por que trigger e não o app.js: o campo "tecnico" em ordens_servico/
-- vistorias/despesas é um nome de texto solto (lista de técnicos da loja,
-- não um usuário logado) — quem PREENCHE o formulário pode ser o gestor
-- despachando serviço pra outra pessoa, não o próprio técnico. Se o app.js
-- só carimbasse auth.uid() de quem está logado no momento de salvar, ia
-- atribuir o registro errado sempre que um gestor lança serviço em nome de
-- um técnico. Resolver isso no client exigiria o app.js consultar `membros`
-- e cruzar por nome a cada salvamento — mesma lógica, só que duplicada e
-- sujeita a ficar dessincronizada da versão no banco. Um trigger no servidor
-- faz a mesma verificação (só resolve quando o nome bate com EXATAMENTE 1
-- membro da empresa; ambíguo ou não encontrado fica NULL, sem adivinhar) de
-- forma centralizada, e recalcula sozinho toda vez que o campo `tecnico`
-- muda — inclusive em reatribuição (edição trocando o técnico responsável).
CREATE OR REPLACE FUNCTION _preencher_tecnico_user_id()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
  v_uid uuid;
BEGIN
  IF NEW.tecnico IS NULL OR trim(NEW.tecnico) = '' THEN
    RETURN NEW;
  END IF;
  -- só recalcula se o nome mudou (insert, ou update que reatribui o técnico)
  IF TG_OP = 'UPDATE' AND NEW.tecnico IS NOT DISTINCT FROM OLD.tecnico THEN
    RETURN NEW;
  END IF;
  SELECT count(*), max(user_id) INTO v_count, v_uid
  FROM membros
  WHERE empresa_id = NEW.empresa_id AND lower(trim(nome)) = lower(trim(NEW.tecnico));
  IF v_count = 1 THEN
    NEW.tecnico_user_id := v_uid;
  ELSE
    NEW.tecnico_user_id := NULL; -- ambíguo (2+ pessoas com o mesmo nome) ou não achou: não adivinha, cai no fallback por nome já existente na policy
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tecnico_user_id_os   ON ordens_servico;
DROP TRIGGER IF EXISTS trg_tecnico_user_id_vis  ON vistorias;
DROP TRIGGER IF EXISTS trg_tecnico_user_id_desp ON despesas;

CREATE TRIGGER trg_tecnico_user_id_os   BEFORE INSERT OR UPDATE ON ordens_servico FOR EACH ROW EXECUTE FUNCTION _preencher_tecnico_user_id();
CREATE TRIGGER trg_tecnico_user_id_vis  BEFORE INSERT OR UPDATE ON vistorias      FOR EACH ROW EXECUTE FUNCTION _preencher_tecnico_user_id();
CREATE TRIGGER trg_tecnico_user_id_desp BEFORE INSERT OR UPDATE ON despesas      FOR EACH ROW EXECUTE FUNCTION _preencher_tecnico_user_id();

NOTIFY pgrst, 'reload schema';
