-- FLUXA V2 — DELTA 7: índice único no token do portal (achado da 2ª auditoria)
-- Rode UMA vez no SQL Editor. Idempotente e sem risco: só falha se já existir
-- token duplicado (praticamente impossível, já que é gen_random_uuid()).
--
-- Problema encontrado: clientes.portal_token não tinha índice nem constraint
-- de unicidade, apesar de ser usado como identidade única em portal_dados() e
-- portal_responder_orcamento() (RPCs públicas, chamadas pelo cliente final a
-- cada acesso ao portal). Sem índice, cada acesso ao portal faz table scan em
-- clientes — cresce linearmente com o número de clientes da empresa. Sem
-- UNIQUE, nada no banco impede duas linhas com o mesmo token (só a
-- probabilidade de colisão de um uuid random, hoje; mas um bug futuro que
-- gerasse token sem gen_random_uuid() passaria batido).
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_portal_token ON clientes(portal_token);

NOTIFY pgrst, 'reload schema';
