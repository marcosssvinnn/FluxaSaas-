# Fluxa Mobile — Plano de Desenvolvimento (Android + iOS)

> Plano apresentado a pedido do Marcos (2026-07-20), antes de qualquer código.
> Cobre: reaproveitamento, tecnologia, integração com a API, estrutura do
> projeto, recursos nativos, telas a redesenhar e cronograma por sprints
> (cada sprint termina em app funcional testável).
>
> **Atualizado no mesmo dia — pivô pra versão sem custo.** O Marcos pediu
> pra tirar completamente Apple Developer Program e Google Play Developer
> do escopo: uso interno (dele + das empresas), sem burocracia de loja,
> "aquele app que você baixa e instala sem passar pela loja". O time é
> **majoritariamente iPhone**. Isso muda a recomendação de tecnologia — ver
> seção seguinte — e o resto do documento foi ajustado por cima dela.

## Recomendação revisada: PWA reforçada, não Capacitor "de cara"

**A assimetria que muda tudo:** no Android, sideload de graça é trivial e
permanente (assina o `.apk` com uma chave própria, distribui o arquivo,
funciona pra sempre). No **iOS não existe isso** — a Apple só permite
instalar um app fora da App Store por mais de 7 dias com Apple Developer
Program pago (US$ 99/ano). O único caminho 100% grátis (Xcode + Apple ID
pessoal) expira toda semana e exige replugar no Mac — inviável pro time
usar em campo todo dia, e o time é majoritariamente iPhone.

**A saída:** desde o iOS 16.4, uma PWA "Adicionada à Tela de Início" deixa
de ser só um atalho de navegador e vira quase um app nativo: tela cheia sem
barra do Safari, ícone próprio, **notificação push de verdade** (protocolo
Web Push padrão + VAPID — não depende de certificado da Apple nem de conta
paga), e desbloqueio por Face ID/Touch ID via WebAuthn. O mesmo mecanismo de
Web Push funciona no Android também (Chrome suporta há anos).

**Decisão revisada:** construir isso **uma vez só, como PWA**, sem nenhum
shell nativo (Capacitor/Xcode/Android Studio) — ela já serve iPhone E
Android ao mesmo tempo, com um único código-fonte, sem loja, sem conta
paga, sem build nativo. Capacitor + APK sideloaded no Android vira um
**upgrade opcional posterior** (Sprint 5, ver cronograma) — só vale a pena
se algum dia quiser um app Android "de verdade" (ícone fora do fluxo de
"Adicionar à Tela de Início", câmera com mais controle) — e nessa hora
reaproveita quase tudo que a PWA já construiu.

### Por que não Capacitor desde o início

<details><summary>Comparação original (Capacitor vs React Native vs Flutter) — ainda vale se algum dia migrar pra loja de verdade</summary>

O Fluxa hoje é **100% HTML/CSS/JS puro, sem framework, sem build step**
(`index.html` 2.538 linhas, `app.js` 11.511 linhas, `styles.css` 1.170
linhas), já com PWA parcial (`sw.js` registrado, mas **sem `manifest.json`
nem ícones** — a "instalabilidade" de hoje é incompleta). Toda a lógica de
negócio (multi-tenant/RLS, local-first, wrappers `dbInsert`/`dbUpdate`, CRM,
estoque, etc.) já está pronta e testada em produção.

**Capacitor** empacota esse HTML/CSS/JS existente dentro de um shell nativo
real (WKWebView no iOS, Chromium WebView no Android) e expõe plugins JS pra
recursos nativos (câmera, biometria, push, arquivos, compartilhamento). Ele
NÃO exige reescrever a UI.

| Critério | **Capacitor** | React Native | Flutter | PWA pura |
|---|---|---|---|---|
| Reaproveita `app.js`/`index.html`/`styles.css` atuais | ✅ quase 100% | ❌ reescreve tudo em JSX | ❌ reescreve tudo em Dart | ✅ 100% |
| App na App Store / Play Store | ✅ | ✅ | ✅ | ⚠️ só Play Store (TWA), iOS não aceita |
| Câmera, biometria, push nativo | ✅ via plugins | ✅ nativo | ✅ nativo | ⚠️ push limitado no iOS, sem biometria real |
| Curva de aprendizado / retrabalho | Baixa (mesmo JS de hoje) | Alta (framework novo) | Altíssima (linguagem nova) | Nenhuma |
| Risco de rejeição na Apple (guideline 4.2 "minimum functionality") | Médio — mitigado usando recursos nativos de verdade (câmera, push, biometria, share) | Baixo | Baixo | Alto (é só um site) |

Essa comparação vale se um dia a decisão de "sem custo" mudar e fizer
sentido ir pra loja de verdade — nesse cenário Capacitor continua sendo a
recomendação certa pelos mesmos motivos. Por ora, nem PWA pura "básica"
nem Capacitor "de cara" são a resposta certa: **PWA reforçada** (a seção
acima) é o meio-termo que estava faltando nessa tabela.
</details>

---

## O que é reaproveitado (praticamente sem mudança)

- **Todo o backend**: projeto Supabase (`auoklaiffalbdgazrbdu`), RLS
  multi-tenant, RPCs (`criar_empresa`, `verificar_pin_bootstrap`,
  `portal_dados`, etc.), Realtime, Storage — zero mudança.
- **Toda a lógica de negócio em `app.js`**: orçamentos, OS, CRM/Funil,
  estoque (ledger), vistorias, agendamentos, auditoria, os wrappers
  `dbInsert`/`dbUpdate`/`dbUpsert`, `ls`/`lsSet` namespaced por empresa.
- **Toda a UI existente** (`index.html` + `styles.css`) — sidebar, páginas,
  modais, o Painel novo, os dois temas de login. Roda dentro da WebView tal
  como roda no navegador hoje.
- **Autenticação**: as duas camadas já implementadas (Supabase Auth
  e-mail/senha para a conta do gestor + PIN interno via conta sintética com
  `auth_ver`) continuam válidas — só muda ONDE a sessão fica guardada (ver
  seção de armazenamento local).
- **Portal do cliente** (`#portal/<token>`) continua público, fora do app —
  não faz sentido nem é pedido pra virar tela nativa.

## O que precisa ser criado especificamente para o app

1. **`manifest.json` + ícones** (todas as resoluções, incl. `apple-touch-
   icon`) — não existe hoje. `index.html` já tem `apple-mobile-web-app-
   capable`/`status-bar-style`, mas falta `apple-mobile-web-app-title` e o
   link pro manifest.
2. **`native.js`** — camada fina que detecta o modo de execução (`display-
   mode: standalone` = instalado; senão, aba normal de navegador) e adapta
   comportamento (ex.: só pedir permissão de push depois de instalado) —
   mesmo princípio que o projeto já usa pra `dbOk`/offline: **um único
   código-fonte** pra web e "app".
3. **Ajustes de CSS pra área segura** (notch/home-indicator) — `viewport-
   fit=cover` já está no `index.html`; falta aplicar `env(safe-area-inset-
   *)` no header fixo e na nav inferior.
4. **Push via Web Push/VAPID** — Service Worker (`sw.js`) ganha handler de
   `push`/`notificationclick`; gerar par de chaves VAPID (grátis, local,
   sem conta de nenhuma loja); nova Edge Function pra enviar.
5. **Desbloqueio biométrico via WebAuthn** — registro de credencial de
   plataforma (Face ID/Touch ID/impressão digital) após o primeiro PIN;
   tela de "desbloquear" ao reabrir o app.
6. **Onboarding de instalação** — banner/tela que detecta "está no Safari/
   Chrome mas ainda não instalado" e explica o passo a passo (iOS não tem
   um prompt automático de instalar como o Android tem via
   `beforeinstallprompt` — precisa ser ensinado).
7. **Tela de Central de Notificações** — não existe hoje.
8. **Unificar os pontos de captura de foto** — vistoria já oferece
   "Câmera ou Galeria" num menu próprio (desde 2026-06-23); estender esse
   mesmo padrão pros outros 4 pontos (OS, equipamento, despesa, orçamento).

## Integração com a API existente

Nenhuma mudança no backend é necessária. A PWA faz as mesmas chamadas que o
navegador já faz hoje — não tem shell nativo no meio, então não tem
CORS/scheme novo pra validar. Dois pontos de atenção:

- **`site_url`/redirect URLs do Supabase Auth**: hoje apontam só pra URL do
  GitHub Pages (corrigido nesta mesma sessão). Como a PWA roda no MESMO
  domínio (só em modo standalone), o fluxo de "Esqueci minha senha" já
  funciona sem mudança nenhuma — outra vantagem de não ter shell nativo.
- **Nova Edge Function** só pro envio de push (protocolo Web Push padrão,
  biblioteca `web-push` ou equivalente) — o único pedaço de backend
  genuinamente novo neste plano.

## Estrutura do projeto proposta

```
fluxa/                        (repo atual — nenhuma mudança de filosofia)
├── index.html                 (compartilhado web + "app")
├── app.js
├── styles.css
├── sw.js                      ← ganha handler de push/notificationclick
├── native.js                   ← NOVO — detecção de modo standalone + WebAuthn
├── manifest.json                ← NOVO
├── icons/                       ← NOVO — ícones (todas resoluções) + apple-touch-icon
├── supabase/functions/
│   └── enviar-push/                ← NOVA Edge Function (Web Push/VAPID)
└── docs/
    └── mobile-app-plano.md         este arquivo
```

Sem `ios/`, `android/`, `capacitor.config.ts`, `package.json` nem `www/` —
é literalmente o mesmo repositório de hoje, só com esses arquivos a mais.
Zero build step novo, exatamente como o projeto já é.

## Recursos nativos — o que muda em cada um

| Recurso | Hoje | Na PWA instalada |
|---|---|---|
| **Login/sessão** | Conta persiste; sessão interna do PIN fica em `sessionStorage` e **some ao fechar a aba** | Mantém-se: iOS **isenta apps instalados na Tela de Início** da limpeza de dados de 7 dias que aplica a abas comuns — mas a sessão do PIN passa a viver atrás de um desbloqueio por Face ID/Touch ID (WebAuthn), não mais em texto puro. |
| **Armazenamento local** | `localStorage` namespaced, limite prático de poucos MB | Mesmo `localStorage` — a instalação como PWA já resolve o principal risco (eviction). Fotos/PDFs grandes continuam migrando pro Supabase Storage (já em andamento). |
| **Notificações** | Nenhuma (só e-mail via EmailJS) | **Web Push** (funciona em iOS 16.4+ E Android) pra: follow-up do dia (CRM), nova OS atribuída, orçamento aprovado no portal. |
| **Câmera** | `<input capture=environment>` em 4 pontos + menu próprio na vistoria | Mesmo mecanismo (já funciona em PWA instalada) — só unifica o menu "Câmera ou Galeria" nos 4 pontos que ainda não têm. |
| **Biometria** | Não existe | **WebAuthn** (`navigator.credentials`) — gatilho de Face ID/Touch ID pra liberar a sessão já guardada localmente. Vale a ressalva honesta: é um *gate* de UX sobre um token que continua no armazenamento do navegador, não uma chave protegida por hardware como um app nativo teria — suficiente pra uso interno da equipe, não é nível banco. |
| **Compartilhar PDF** | `window.print()`/html2pdf | **Web Share API** (`navigator.share()`) — já suportada no Safari iOS pra compartilhar arquivo gerado, sem precisar de plugin nenhum. |
| **Botão físico "voltar" (Android)** | Comportamento padrão do navegador | Em PWA instalada, o Android já trata o "voltar" como navegação dentro do app (fecha só quando a pilha some) — comportamento correto de fábrica, sem código extra. |

## Telas que precisam de adaptação real (não é só responsivo)

A maior parte das telas já é mobile-friendly (nav inferior, formulários já
testados em 375px). As que precisam de **redesenho de fluxo**, não só CSS:

1. **Onboarding de instalação** — tela/banner nova; não existe hoje e é
   pré-requisito de tudo (push e a isenção de eviction só valem depois de
   instalado).
2. **Login/PIN** — passo novo de "ativar desbloqueio biométrico?" logo após
   o primeiro PIN.
3. **Captura de foto** (OS, Equipamento, Despesa, Orçamento) — replicar o
   menu "Câmera ou Galeria" que a vistoria já tem.
4. **Central de Notificações** — tela nova, não existe hoje.
5. **Funil de Vendas (kanban)** — confirmar que "Mover para" no modal
   (já existe) é o caminho principal em touch, não só um fallback.

## Riscos, custos e pré-requisitos (versão sem custo)

- **Custo de loja: R$ 0.** Sem Apple Developer Program, sem Google Play
  Developer — decisão explícita do Marcos, uso interno.
- **Chaves VAPID pro push**: geradas localmente, grátis, sem cadastro em
  nenhuma loja.
- **Sem revisão de terceiros**: como não passa por App Store/Play Store,
  não tem prazo de aprovação nem risco de rejeição — atualização é
  instantânea (o próprio mecanismo de ETag que o `sw.js` já tem hoje).
- **Trade-off honesto**: instalação é manual (Compartilhar → Adicionar à
  Tela de Início no iPhone; banner de instalar no Android) — não tem link
  de loja pra mandar pro time, precisa de um tutorial curto uma vez por
  pessoa. E a permissão de notificação, no iPhone, só pode ser pedida
  depois de já estar instalado (limitação da Apple, não do projeto).
- **Se um dia quiser ir pra loja de verdade**: o Capacitor (comparação no
  início do documento) reaproveita quase tudo construído aqui — a PWA
  reforçada não é trabalho perdido, é a base.

## Cronograma — cada sprint termina em app funcional

Priorizado pro time majoritariamente iPhone. Android via Capacitor vira
item opcional no fim, não bloqueia nada antes dele.

| Sprint | Duração estimada | Entrega | Resultado no fim |
|---|---|---|---|
| **0 — Fundação PWA** | 3–5 dias | `manifest.json`, ícones/`apple-touch-icon`, área segura (notch), banner de "Adicionar à Tela de Início" | App instala no iPhone e no Android, tela cheia, com tudo que o Fluxa já faz hoje — de graça |
| **1 — Notificações push** | ~1 semana | Chaves VAPID, handler de push no `sw.js`, Edge Function de envio, permissão pedida só após instalado | App avisa o usuário (follow-up, OS atribuída, orçamento aprovado) mesmo fechado, em ambos os sistemas |
| **2 — Desbloqueio biométrico** | ~3–5 dias | Registro WebAuthn após o 1º PIN, tela de desbloqueio por Face ID/Touch ID/digital, fallback pro PIN | Reabrir o app é tão rápido quanto olhar pro celular |
| **3 — Câmera unificada + compartilhamento** | ~3–5 dias | Menu "Câmera ou Galeria" replicado nos 4 pontos que faltam, PDF via `navigator.share()` | Fluxo de campo (vistoria/OS/despesa/orçamento) consistente ponta a ponta |
| **4 — Central de Notificações + polish** | ~3–5 dias | Tela de histórico de notificações, revisão final de toque/acessibilidade em dispositivo real | Experiência redonda pro uso diário do time |
| **5 — Android via Capacitor (opcional)** | ~1–1,5 semana | `.apk` assinado localmente, sideload direto, recursos nativos equivalentes reaproveitando o que os Sprints 0–4 já resolveram | Quem usa Android ganha um app "de verdade" instalável fora de loja — só se fizer sentido nessa hora |

**Total ativo estimado (Sprints 0–4, sem loja nenhuma):** ~3–4 semanas.
Sprint 5 (Android nativo) é independente e pode entrar antes, depois, ou
nunca — não é pré-requisito de nada. Cada sprint entrega algo instalável
e testável no seu próprio iPhone desde o primeiro dia.
