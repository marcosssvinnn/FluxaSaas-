-- FLUXA V2 — DELTA 22: código IBGE do município por loja (Fase 1 fiscal)
-- Rode UMA vez.
--
-- Gap encontrado no Marco 2/3 do plano fiscal: a DPS (NFS-e Nacional) exige o
-- código IBGE do município (cLocEmi/cLocPrestacao), mas `lojas.cidade` só
-- guarda o NOME da cidade ("Itapema"), não o código numérico. O código morto
-- do v1 (emitirNota() em app.js) tinha um código HARDCODED errado pra Itapema
-- (4208450 — na verdade é o código de Itapoá, cidade diferente!). Confirmado
-- o código certo via API oficial do IBGE (servicodados.ibge.gov.br) em
-- 2026-07-20: Itapema = 4208302.
--
-- Fix: coluna nova (aditiva) + preenchida pra Fluxa piscinas com o valor
-- correto verificado na fonte oficial, não copiado do código morto antigo.
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS codigo_ibge text;

UPDATE lojas SET codigo_ibge = '4208302'
WHERE id = '4a1c4d4e-a6a8-4777-9ebe-87d2224a25b0' AND cidade = 'Itapema';

NOTIFY pgrst, 'reload schema';
