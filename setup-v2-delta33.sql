-- delta33 — vistoria: assinatura do técnico + recomendações
--
-- Aditivo e nullable: toda vistoria já existente continua válida, só fica com
-- os campos vazios. A assinatura passa a ser obrigatória pra FINALIZAR uma
-- vistoria nova (regra no cliente), mas registro antigo não é invalidado —
-- reabrir um deles pede assinar de novo, como qualquer vistoria.
--
-- assinatura_tecnico_base64 : imagem PNG da assinatura (data URL)
-- assinatura_tecnico_data   : quando foi assinada (ISO)
-- assinatura_tecnico_meta   : user agent do aparelho que assinou
-- recomendacoes             : o que precisa ser feito — separado de obs_geral
--                             de propósito; é a parte que vira orçamento.

ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS assinatura_tecnico_base64 text;
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS assinatura_tecnico_data timestamptz;
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS assinatura_tecnico_meta text;
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS recomendacoes text;
