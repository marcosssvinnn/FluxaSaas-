-- delta45 — Login simples (uma tela só: e-mail+senha) na Fluxa piscinas
-- Aplicado via Management API em 2026-11-14. Só dado (feature flag), sem schema.
--
-- Problema: o dono-operador (trabalha sozinho) via DUAS telas de login confusas —
-- e-mail+senha da conta (Supabase Auth) e, em alguns boots/logouts, a etapa interna
-- nome + PIN de 4 dígitos (personas internas, feita pra aparelho compartilhado/
-- técnico). Ele quer UMA tela só: e-mail + senha (a senha maior, da conta).
--
-- O código novo (app.js) lê a flag `login_simples` e, quando ligada, força a tela
-- de conta (e-mail+senha) em TODOS os caminhos que antes mostravam nome+PIN:
--   _bootstrapTecnico (boot após a conta expirar), fazerLogout ("sair"),
--   e os fallbacks de boot/authSubmit. Default off = nenhuma mudança nas outras
--   empresas (a etapa interna nome+PIN continua existindo pra quem usa personas).
update empresas
  set config = jsonb_set(coalesce(config,'{}'::jsonb), '{flags,login_simples}', 'true'::jsonb, true)
  where id = '1b2b5a31-6af9-4a9e-b888-e41091f958f7';  -- só a Fluxa piscinas

-- Rollback = setar 'false' (sem deploy). `auth_perfil` NÃO foi alterado (independente).
