-- delta38 — observação geral por ambiente na vistoria
--
-- A obs por ambiente é o que vale pro espaço todo (casa de máquinas alagando,
-- acesso difícil), separada da observação de cada equipamento. O ambiente de
-- cada equipamento já vai dentro do JSON `equipamentos` (jsonb); esta coluna
-- guarda o mapa {ambiente: observação}. Aditiva e nullable: vistoria antiga
-- segue válida sem o campo.

ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS ambiente_obs jsonb;
