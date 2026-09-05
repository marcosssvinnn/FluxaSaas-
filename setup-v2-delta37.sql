-- delta37 — vínculo opcional OS → equipamento (Fases 10-11 do plano mestre)
--
-- Aditivo e nullable, de propósito. Hoje OS/orçamento referenciam só o CLIENTE
-- (cliente_id); não existe FK evento→aparelho, então o prontuário do equipamento
-- casa vistoria por tipo e mostra OS/orçamento como "do cliente".
--
-- Em vez de FORÇAR a escolha do aparelho em toda OS (atrito no campo — o plano
-- pede o contrário, ver Fases 16-17), esta coluna deixa o técnico MARCAR o
-- equipamento quando fizer sentido. A precisão do prontuário cresce com o uso,
-- sem mudar o fluxo à força. OS antiga continua válida com o campo vazio.
--
-- equipamento_id: referência solta ao id do equipamento (equipamentos.id é text).
--   Sem FK rígida porque o registro pode ter sido criado offline/local antes de
--   sincronizar — mesmo motivo pelo qual o resto do schema evita FK dura aqui.

ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS equipamento_id text;
CREATE INDEX IF NOT EXISTS idx_os_equipamento ON ordens_servico(equipamento_id) WHERE equipamento_id IS NOT NULL;
