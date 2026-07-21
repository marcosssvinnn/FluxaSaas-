-- FLUXA V2 — DELTA 26: preenche iss_aliquota/obs_retencao de municipios_fiscais
-- Rode UMA vez. Só UPDATE de dados — schema já existe (setup-v2-delta23.sql).
--
-- Origem dos valores: pesquisa feita por outra IA (2026-07-21), a pedido do
-- Marcos, usando leis.org (repositório que publica texto integral/consolidado
-- das leis municipais — não é o portal oficial da prefeitura) + cruzamento
-- com os números de lei citados nos sites das Câmaras de Vereadores. Pra
-- Itajaí também foi localizado o PDF no portal oficial (tributos.itajai.
-- sc.gov.br). Para as outras 4 cidades, o texto da lei em si não foi
-- encontrado num domínio .gov.br oficial — confiança razoável, mas NÃO é
-- confirmação de fonte primária oficial.
--
-- ⚠️ NÃO é usado em nenhum cálculo automático hoje (grep confirmado: só a
-- coluna lojas.iss_aliquota, diferente desta, é lida por supabaseAdmin.js —
-- e nem essa entra no XML da DPS, que não tem campo de alíquota). Serve só
-- de referência/exibição futura. Ainda assim, ANTES de religar a emissão de
-- nota fiscal de verdade (Marco 4), confirmar estes valores com a Secretaria
-- de Fazenda de cada prefeitura ou com o contador do Marcos — a própria
-- pesquisa sinalizou Camboriú e Porto Belo como os dois com menor confiança
-- (Camboriú: não achou lei recente 2025/2026 que possa ter mexido no
-- subitem 7.10, mas cidades vizinhas reformularam a tabela de serviços nesse
-- período por causa do padrão nacional da NFS-e; Porto Belo: lei-base de
-- 2014, mais difícil de rastrear online, pode ter atualização não localizada).
--
-- Editável a qualquer momento — é só rodar outro UPDATE nesta tabela, sem
-- precisar mexer em código nenhum.

UPDATE municipios_fiscais SET
  iss_aliquota = 5.00,
  obs_retencao = 'Retenção só obrigatória se o prestador não fornecer nota fiscal/documento autorizado (Lei Ordinária 3.003/2011, art. 10, III) — o subitem 7.10 não está na lista de retenção incondicional (que cobre só 7.02/7.04/7.05/7.19). Sem exigência formal de cadastro tipo CPOM, mas recomenda-se cadastro no Mobiliário municipal pra evitar a retenção.'
WHERE empresa_id = '1b2b5a31-6af9-4a9e-b888-e41091f958f7' AND codigo_ibge = '4208302'; -- Itapema

UPDATE municipios_fiscais SET
  iss_aliquota = 3.00,
  obs_retencao = '⚠️ Confirmar antes de usar de verdade — não achei lei recente (2025/2026) confirmando se o subitem 7.10 mudou. Retenção na fonte É OBRIGATÓRIA por lei pro subitem 7.10 (Lei Complementar 30/2010, art. 264, §2º, II), independente de cadastro do prestador — aqui o cadastro NÃO elimina a retenção. Sem CPOM explícito no CTM.'
WHERE empresa_id = '1b2b5a31-6af9-4a9e-b888-e41091f958f7' AND codigo_ibge = '4203204'; -- Camboriú

UPDATE municipios_fiscais SET
  iss_aliquota = 2.50,
  obs_retencao = 'Retenção OBRIGATÓRIA por lei pro subitem 7.10, inclusive de tomador pessoa física e jurídica (Lei Municipal 4.995/2025, alterada pela Lei 5.152/2025 de 04/12/2025, art. 8º, II, "b"). Cadastro não elimina a retenção aqui.'
WHERE empresa_id = '1b2b5a31-6af9-4a9e-b888-e41091f958f7' AND codigo_ibge = '4202008'; -- Balneário Camboriú

UPDATE municipios_fiscais SET
  iss_aliquota = 2.00,
  obs_retencao = 'Retenção obrigatória pra tomador pessoa jurídica (Lei Complementar 29/2003, art. 8º, II, "b"); retenção também condicional se o prestador não comprovar cadastro no Município (art. 9º, §1º, I) — recomenda-se cadastro pra evitar a retenção condicional (a obrigatória pra PJ continua valendo). LC 485/2025 confirmada como não tendo alterado o subitem 7.10.'
WHERE empresa_id = '1b2b5a31-6af9-4a9e-b888-e41091f958f7' AND codigo_ibge = '4208203'; -- Itajaí

UPDATE municipios_fiscais SET
  iss_aliquota = 5.00,
  obs_retencao = '⚠️ Confirmar antes de usar de verdade — lei-base (Lei Municipal 2.144/2014) é mais difícil de rastrear online, pode ter atualização não localizada nesta pesquisa. Retenção só obrigatória se o prestador não fornecer documento fiscal autorizado (art. 10, III) — subitem 7.10 não está na lista incondicional (só 7.02/7.04/7.05/7.19). Sem CPOM explícito.'
WHERE empresa_id = '1b2b5a31-6af9-4a9e-b888-e41091f958f7' AND codigo_ibge = '4213500'; -- Porto Belo

NOTIFY pgrst, 'reload schema';
