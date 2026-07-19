-- FLUXA V2 — DELTA 10: buckets de Storage para fotos de orçamento/OS (PREPARO)
-- Rode UMA vez no SQL Editor. Puramente ADITIVO — cria buckets novos e amplia
-- as policies existentes pra incluí-los. NÃO muda nenhum comportamento do app
-- hoje: o app.js ainda não sobe foto de orçamento/OS pro Storage (continua
-- gravando base64 na linha, como sempre) — isso é só a infraestrutura pronta
-- pra quando essa migração for feita com calma e testada de verdade com
-- Supabase real (ver CLAUDE.md, pendência "Selects sem paginação").
--
-- Mesmo padrão já usado em vistorias-pdf/vistorias-fotos: bucket público pra
-- leitura, escrita só na pasta da própria empresa.

INSERT INTO storage.buckets (id, name, public) VALUES ('orcamentos-fotos', 'orcamentos-fotos', true)
ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('os-fotos', 'os-fotos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "upload na pasta da empresa" ON storage.objects;
CREATE POLICY "upload na pasta da empresa" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('vistorias-pdf','vistorias-fotos','orcamentos-fotos','os-fotos')
    AND (storage.foldername(name))[1] IN (SELECT minhas_empresas()::text));

DROP POLICY IF EXISTS "update na pasta da empresa" ON storage.objects;
CREATE POLICY "update na pasta da empresa" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('vistorias-pdf','vistorias-fotos','orcamentos-fotos','os-fotos')
    AND (storage.foldername(name))[1] IN (SELECT minhas_empresas()::text));

DROP POLICY IF EXISTS "leitura publica pdf" ON storage.objects;
CREATE POLICY "leitura publica pdf" ON storage.objects
  FOR SELECT TO public USING (bucket_id IN ('vistorias-pdf','vistorias-fotos','orcamentos-fotos','os-fotos'));

NOTIFY pgrst, 'reload schema';
