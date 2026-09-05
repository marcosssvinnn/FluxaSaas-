-- delta36 — despesas: natureza, recorrência e competência
--
-- Hoje toda despesa é "de campo": exige técnico e só oferece tipos de campo
-- (combustível, pedágio, material). Custo fixo da empresa — aluguel, salário,
-- energia, contador — não tem onde ser lançado, e é justamente ele que define
-- se o mês fechou no azul. Sem isso o DRE mostra metade da conta.
--
-- natureza    : 'campo' (técnico gastou em serviço) | 'empresa' (custo da operação)
-- recorrente  : despesa que se repete todo mês — vira sugestão de lançamento
-- competencia : YYYY-MM a que a despesa pertence. Separado de `data` de
--               propósito: a conta de energia de janeiro pode ser paga em
--               fevereiro, e o resultado de janeiro tem que contá-la em janeiro.

ALTER TABLE despesas ADD COLUMN IF NOT EXISTS natureza text DEFAULT 'campo';
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente boolean DEFAULT false;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS competencia text;

-- Consulta do dia a dia é sempre "despesas da empresa X numa competência".
CREATE INDEX IF NOT EXISTS idx_desp_competencia ON despesas(empresa_id, competencia);
