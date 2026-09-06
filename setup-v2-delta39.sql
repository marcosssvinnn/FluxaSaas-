-- delta39 — auditoria com valor anterior→novo (Fase 19)
-- Aditivo. logAcao passa a registrar mudança de status de orçamento (antes→
-- depois), exclusão de OS, etc. dbInsert é resiliente a coluna ausente, então
-- sem estas colunas o registro ia pro banco sem o antes/depois; com elas,
-- persiste completo.
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS antes text;
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS depois text;
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS ref text;
