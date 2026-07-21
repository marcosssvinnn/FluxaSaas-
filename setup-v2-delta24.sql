-- ============================================================================
-- DELTA 24 — Push Subscriptions (Sprint 1 do plano mobile, Web Push/VAPID)
-- Aplicado ao banco em 2026-07-21 via Management API. Arquivo é o histórico.
-- ============================================================================
-- Cada linha = uma inscrição de push de um dispositivo/navegador específico
-- (endpoint do PushManager do navegador + chaves de criptografia p256dh/auth,
-- geradas pelo próprio navegador na hora do pushManager.subscribe()). A Edge
-- Function `enviar-push` lê esta tabela com a service_role key (contorna RLS
-- de propósito — é contexto de backend confiável, mesmo padrão já usado nas
-- funções do certificado fiscal) pra montar e assinar as mensagens Web Push.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id text PRIMARY KEY,  -- app gera id texto (ex.: 'push_...'); NÃO usar uuid
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario_nome text,             -- nome de exibição (sessão interna), só pra depuração
  endpoint text NOT NULL UNIQUE, -- URL do push service (FCM/APNs por baixo, via padrão Web Push)
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_empresa ON push_subscriptions(empresa_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push sel" ON push_subscriptions;
CREATE POLICY "push sel" ON push_subscriptions FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT minhas_empresas()) AND (user_id = auth.uid() OR meu_perfil(empresa_id) = 'gestor'));

DROP POLICY IF EXISTS "push ins" ON push_subscriptions;
CREATE POLICY "push ins" ON push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (SELECT minhas_empresas()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "push upd" ON push_subscriptions;
CREATE POLICY "push upd" ON push_subscriptions FOR UPDATE TO authenticated
  USING (empresa_id IN (SELECT minhas_empresas()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "push del" ON push_subscriptions;
CREATE POLICY "push del" ON push_subscriptions FOR DELETE TO authenticated
  USING (empresa_id IN (SELECT minhas_empresas()) AND user_id = auth.uid());
