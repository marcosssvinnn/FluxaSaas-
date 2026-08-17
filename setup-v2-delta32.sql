-- FLUXA V2 — DELTA 32: ocultar valores unitários no orçamento
-- Rode UMA vez.
--
-- Pedido do Marcos (17/08): opção de ocultar os preços de cada item no
-- PDF/mensagem de WhatsApp, mostrando só o valor total — tem serviço que
-- ele não quer que o cliente veja o detalhamento por item, só o total.
--
-- Booleano simples, default false (comportamento atual não muda pra quem
-- não usar a opção). Salvo no orçamento (não é só um estado de tela) pra
-- reimprimir/reabrir depois manter a mesma escolha.

ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS ocultar_valores boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
