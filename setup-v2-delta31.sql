-- FLUXA V2 — DELTA 31: CPF do cliente (pessoa física)
-- Rode UMA vez.
--
-- Achado ao ligar a emissão de NFS-e na OS (17/08): não existia coluna de
-- CPF em NENHUMA tabela do schema — só CNPJ. Cliente pessoa física é parte
-- real do negócio da Fluxa piscinas ("casas e residências de veraneio",
-- confirmado pelo Marcos), e a nota de serviço EXIGE documento do tomador
-- (CPF ou CNPJ) — sem isso a emissão ficava travada pra todo cliente PF.
--
-- Espelha exatamente o padrão já usado pro CNPJ: coluna em `clientes`
-- (fonte), copiada pra `orcamentos`/`ordens_servico` no momento em que o
-- orçamento/OS é criado (mesmo motivo do cnpj: cliente pode editar o
-- cadastro depois, mas o documento usado NA nota é o que valia quando ela
-- foi emitida).

ALTER TABLE clientes        ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE orcamentos      ADD COLUMN IF NOT EXISTS cpf_cliente text;
ALTER TABLE ordens_servico  ADD COLUMN IF NOT EXISTS cpf_cliente text;

NOTIFY pgrst, 'reload schema';
