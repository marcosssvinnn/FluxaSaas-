-- FLUXA V2 — DELTA 23: multi-município fiscal (Fase 1 — NFS-e)
-- Rode UMA vez.
--
-- Achado importante (confirmado pelo Marcos, com base na LC 116/2003, art. 3º
-- VII + subitem 7.10 da lista de serviços): manutenção/limpeza de piscina se
-- enquadra numa EXCEÇÃO em que o ISS é devido no MUNICÍPIO ONDE O SERVIÇO É
-- EXECUTADO (onde fica a piscina do cliente), não no município onde a
-- empresa está sediada. Como a Fluxa piscinas atende Itapema, Camboriú,
-- Balneário Camboriú, Itajaí e Porto Belo (variável por cliente), o campo
-- `lojas.codigo_ibge` (sede da empresa) NÃO é suficiente — cada ORÇAMENTO
-- precisa registrar em qual município o serviço foi prestado, pra declarar a
-- nota fiscal na cidade certa.
--
-- Alíquota de ISS varia por município (2% a 5%, conforme o Marcos) — NÃO
-- inventei nenhum valor aqui (pesquisa de legislação municipal específica
-- não é confiável o bastante pra apostar em compliance fiscal real). A tabela
-- nasce com os municípios + código IBGE (verificados na API oficial do IBGE),
-- mas `iss_aliquota` fica NULL até o Marcos/contador confirmar e preencher.

CREATE TABLE IF NOT EXISTS municipios_fiscais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo_ibge text NOT NULL,
  nome text NOT NULL,
  iss_aliquota numeric(5,2), -- NULL até confirmar com o contador — nunca adivinhado
  obs_retencao text, -- ex.: "exige retenção do tomador" / "exige cadastro CPOM" — preencher depois de checar a legislação de cada município
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now(),
  UNIQUE (empresa_id, codigo_ibge)
);
ALTER TABLE municipios_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "municipios_fiscais sel" ON municipios_fiscais FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT minhas_empresas()));
CREATE POLICY "municipios_fiscais wr" ON municipios_fiscais FOR ALL TO authenticated
  USING (meu_perfil(empresa_id) = 'gestor') WITH CHECK (meu_perfil(empresa_id) = 'gestor');

-- Cidade onde o SERVIÇO deste orçamento específico foi/será prestado — pode
-- ser diferente da cidade da loja (sede). Aditivo, nullable (não quebra nada
-- existente; fica vazio até o gestor escolher no formulário).
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS municipio_servico_ibge text;

-- Seed pra Fluxa piscinas: os 5 municípios que o Marcos confirmou que atendem,
-- códigos IBGE verificados na API oficial (servicodados.ibge.gov.br) em
-- 2026-07-20 — alíquota fica NULL de propósito.
INSERT INTO municipios_fiscais (empresa_id, codigo_ibge, nome) VALUES
  ('1b2b5a31-6af9-4a9e-b888-e41091f958f7', '4208302', 'Itapema'),
  ('1b2b5a31-6af9-4a9e-b888-e41091f958f7', '4203204', 'Camboriú'),
  ('1b2b5a31-6af9-4a9e-b888-e41091f958f7', '4202008', 'Balneário Camboriú'),
  ('1b2b5a31-6af9-4a9e-b888-e41091f958f7', '4208203', 'Itajaí'),
  ('1b2b5a31-6af9-4a9e-b888-e41091f958f7', '4213500', 'Porto Belo')
ON CONFLICT (empresa_id, codigo_ibge) DO NOTHING;

NOTIFY pgrst, 'reload schema';
