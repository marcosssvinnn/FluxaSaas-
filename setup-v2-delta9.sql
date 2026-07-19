-- FLUXA V2 — DELTA 9: corrige tipo de equipamentos.cliente_id (achado da 2ª auditoria)
-- Rode UMA vez no SQL Editor. Seguro: a coluna nunca foi populada pelo app
-- (só cliente_nome é escrito hoje), então converter o tipo não perde dado.
--
-- Problema encontrado: equipamentos.cliente_id foi criado como `uuid`, mas
-- clientes.id (a chave que ele deveria referenciar) é `text` — os dois tipos
-- nunca bateriam numa comparação (eq.cliente_id = clientes.id sempre falha).
-- Corrige só o tipo; NÃO liga o campo em nenhum formulário/RPC ainda (fora do
-- escopo desta correção — ver CLAUDE.md).
ALTER TABLE equipamentos ALTER COLUMN cliente_id TYPE text USING cliente_id::text;

NOTIFY pgrst, 'reload schema';
