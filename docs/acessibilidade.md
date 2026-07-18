# Checklist de Acessibilidade — Fluxa App
**Padrão:** WCAG 2.2 AA  
**Última revisão:** 2026-05-06

## Cores e contraste

| Token CSS | Valor atual | Contraste sobre #FFF | Status WCAG AA |
|---|---|---|---|
| `--c1` (primária) | `#C45E0A` | 4,6:1 | ✅ Aprovado |
| `--c2` (texto) | `#2B3244` | 12,5:1 | ✅ Aprovado |
| `--red` | `#ef4444` | 3,9:1 | ⚠️ Apenas texto grande |
| `--green` | `#16a34a` | 4,7:1 | ✅ Aprovado |
| `--yellow` | `#d97706` | 3,1:1 | ❌ Não usar como texto |
| `--gray` | `#6b7280` | 4,6:1 | ✅ Aprovado |

> ⚠️ `--yellow` (`#d97706`) falha em contraste. Não usar como cor de texto. Usar apenas com ícone + texto explicativo para badges de status.

## Componentes — checklist por tipo

### Formulários
- [ ] Todo `<input>` tem `<label>` associado (ou `aria-label` / `aria-labelledby`)
- [ ] Campos obrigatórios têm `required` + asterisco visual + `class="req"` no label
- [ ] Campos de e-mail: `type="email"` | Telefone: `type="tel"` | Numérico: `inputmode="numeric"`
- [ ] Validação inline ao sair do campo (`blur`), não só no submit
- [ ] Mensagens de erro próximas ao campo, com `role="alert"` ou `aria-live="polite"`
- [ ] Formulários longos (>3 campos) têm auto-save via `salvarRascunho(tipo)`

### Botões e interações
- [ ] Todo botão é `<button>` — não `<div onclick>` nem `<span onclick>`
- [ ] Botões de fechar modal têm `aria-label="Fechar"`
- [ ] Ícones decorativos têm `aria-hidden="true"`
- [ ] Alvos de toque ≥ 44×44 CSS px
- [ ] Foco visível em todos os elementos interativos (não usar `outline:none` sem substituto)
- [ ] Regra global: `:focus-visible { outline: 2px solid var(--c1); outline-offset: 2px; }`

### Navegação
- [ ] `aria-current="page"` na página ativa (atualizado em `go(p)`)
- [ ] Skip link no topo: `<a href="#main-content" class="skip-link">Ir para o conteúdo principal</a>`
- [ ] `<main id="main-content" role="main">` envolvendo o conteúdo principal
- [ ] Header com `<header>`, nav com `<nav>` ou `role="navigation"`

### Feedback e status
- [ ] Toast com `role="alert" aria-live="assertive" aria-atomic="true"`
- [ ] Operações assíncronas: botão com `disabled` + texto "Salvando…" durante execução
- [ ] Estados de erro com ação de recuperação (retry, voltar)
- [ ] Empty states com mensagem contextual + botão CTA

### Mobile
- [ ] Layout sem scroll horizontal em 375px de largura
- [ ] Calendário: `min-width` reduzido em `@media (max-width:680px)`
- [ ] Feedback háptico em ações de checklist: `navigator.vibrate && navigator.vibrate(30)`

## Atributos ARIA usados no projeto

| Atributo | Onde usar | Exemplo |
|---|---|---|
| `aria-label` | Botões sem texto visível | `<button aria-label="Fechar">×</button>` |
| `aria-current="page"` | Nav item ativo | Atualizado em `go(p)` |
| `aria-live="assertive"` | Toast de feedback | `<div id="toast" aria-live="assertive">` |
| `aria-hidden="true"` | Ícones decorativos | `<span aria-hidden="true">📋</span>` |
| `role="alert"` | Mensagens de erro/sucesso | `<div role="alert" class="field-error">` |
| `role="main"` | Área de conteúdo principal | `<main id="main-content" role="main">` |

## Testes recomendados

1. **Teclado apenas:** navegar pela aplicação usando apenas Tab, Shift+Tab, Enter e Space
2. **VoiceOver (iOS):** testar login, criar OS, ver histórico
3. **Zoom 200%:** verificar que layout não quebra
4. **Modo escuro do sistema:** verificar se variáveis CSS adaptam bem
5. **Ferramenta:** [axe DevTools](https://www.deque.com/axe/) extensão Chrome para varredura automatizada

## Histórico de correções

| Data | Correção | Auditoria |
|---|---|---|
| 2026-05-06 | `--c1` #F07820 → #C45E0A (contraste 3.1→4.6:1) | UX C-02 |
| 2026-05-06 | Foco visível restaurado com `:focus-visible` | UX C-01 |
| 2026-05-06 | Toast com `role=alert aria-live=assertive` | UX A-01 |
| 2026-05-06 | `aria-current="page"` na navegação ativa | UX A-09 |
| 2026-05-06 | Skip link + `<main role="main">` | UX M-10 |
| 2026-05-06 | `aria-label` nos botões de fechar modal | UX M-03 |
| 2026-05-06 | Alvos de toque ≥ 44×44px | UX C-06 |
| 2026-05-06 | `aria-label` no input de PIN | UX C-05 |
