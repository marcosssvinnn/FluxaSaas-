# Modelo de Segurança — Fluxa App
**Última revisão:** 2026-05-06  
**Baseado na auditoria de engenharia de 2026-05-06**

## Modelo de ameaça atual

O Fluxa App é uma SPA com repositório **público** no GitHub. Isso significa:

| Componente | Exposição | Risco |
|---|---|---|
| Supabase anon key | Pública (no código-fonte) | Qualquer pessoa pode fazer queries com ela |
| Supabase URL | Pública | Qualquer pessoa sabe o endpoint |
| Políticas RLS | `FOR ALL TO anon USING (true)` | Sem controle no servidor |
| EmailJS keys | Hardcoded no `CFG_DEF` | Qualquer pessoa pode enviar e-mails pela conta |
| Controle de acesso | Apenas client-side (JS) | Bypassável via DevTools |

**Resumo:** o único obstáculo real entre um atacante e todos os dados é a obscuridade — não existe autenticação server-side efetiva atualmente.

## O que a anon key permite (e o que não permite)

Com a anon key pública, qualquer pessoa **pode**:
- Ler todas as linhas de todas as tabelas (orcamentos, os, clientes, equipamentos, despesas, vistorias)
- Inserir registros em qualquer tabela
- Atualizar e deletar registros por ID

Com a anon key pública, qualquer pessoa **não pode** (limitações do Supabase):
- Acessar o painel de administração do Supabase
- Modificar estrutura de tabelas
- Executar SQL DDL diretamente

## Segredos — o que nunca commitar

| Segredo | Padrão | Onde fica |
|---|---|---|
| Supabase PAT | `sbp_[40 chars hex]` | Apenas local, nunca no repo |
| Anon key | JWT `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Hardcoded no app (inevitável) — mitigar com RLS |
| EmailJS pubkey | String alfanumérica | `CFG_DEF` no código |

### Se um segredo for comprometido

1. **Supabase PAT:** Revogar imediatamente em https://app.supabase.com/account/tokens
2. **Anon key:** Não pode ser rotacionada sem impactar todos os usuários — corrigir as RLS policies é mais efetivo
3. **EmailJS:** Regenerar Public Key em https://dashboard.emailjs.com/admin/account e adicionar restrição de domínio

## Hook pré-commit anti-segredos

Instalar em `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Bloqueia commit de tokens Supabase e JWTs
if git diff --cached | grep -qE 'sbp_[a-f0-9]{38}'; then
  echo "❌ Token Supabase PAT detectado no commit. Use [SEU_PAT_AQUI] como placeholder."
  exit 1
fi
echo "✅ Nenhum segredo detectado."
exit 0
```

> Nota: a anon key JWT não é bloqueada pelo hook pois é necessária no código do app. O controle é via RLS.

## Roteiro de hardening futuro (backlog)

Estas melhorias aumentariam significativamente a segurança mas requerem decisão arquitetural:

### Fase 1 — Sem breaking changes (prioridade alta)
- [ ] Adicionar restrição de domínio no EmailJS (permitir apenas `marcosssvinnn.github.io`)
- [ ] Auditar logs de acesso no painel Supabase em busca de uso suspeito
- [ ] Habilitar MFA no painel Supabase (admin)

### Fase 2 — Melhorias de RLS (média complexidade)
- [ ] Adicionar coluna `criado_por_hash` nas tabelas e filtrar por loja_id via RLS, sem exigir Supabase Auth
- [ ] Remover policy `FOR ALL TO anon` das tabelas mais sensíveis e substituir por policies específicas por operação (SELECT vs INSERT vs DELETE)

### Fase 3 — Autenticação real (alta complexidade, breaking change)
- [ ] Migrar para Supabase Auth (email/password ou magic link)
- [ ] Reescrever RLS usando `auth.uid()` para controle por usuário
- [ ] Deprecar autenticação por PIN client-side

## Auditoria de segurança — achados e status

| Achado | Severidade | Status |
|---|---|---|
| CRIT-01: PAT no CLAUDE.md | CRÍTICO | ✅ Resolvido 2026-05-06 |
| CRIT-02: Anon key pública | CRÍTICO | ⚠️ Estrutural — mitigar com RLS |
| CRIT-03: EmailJS hardcoded | CRÍTICO | ⚠️ Adicionar restrição de domínio |
| CRIT-04: RLS permissivo | CRÍTICO | ⚠️ Backlog Fase 2 |
| CRIT-05: Auth client-side | CRÍTICO | ⚠️ Backlog Fase 3 |
| ALTO-01: PIN texto plano | ALTO | ⚠️ Candidato a remoção (confirmar com Marcos) |
| ALTO-02: Lockout em memória | ALTO | ✅ Resolvido 2026-05-06 (localStorage) |
| ALTO-03: Portal token sem expiração | ALTO | ⚠️ Backlog |
| MEDIO-01: SRI nas dependências CDN | MÉDIO | ✅ Resolvido 2026-05-06 |
| MEDIO-02: catch silenciosos | MÉDIO | ✅ Resolvido 2026-05-06 |
| MEDIO-03: verFotoDesp sem validação | MÉDIO | ✅ Resolvido 2026-05-06 |
