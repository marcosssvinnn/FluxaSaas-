# Opção A — Enforcement de perfil no banco (handoff Fase 2)

> Status em 2026-07-19. Ver também `setup-v2-optionA-perfil.sql` (Fase 1) e a seção
> "Proteção por perfil no banco — DECIDIDO" no `CLAUDE.md`.

## Onde está

- **Fase 1 (SQL de enforcement) — PRONTA, commitada (`a581537`), NÃO aplicada ainda.**
  Arquivo: `setup-v2-optionA-perfil.sql`. Cria `meu_perfil()`, `meu_nome()`,
  `usuarios_para_login()`, `vincular_funcionario()` e troca a RLS "isolamento por
  empresa" por **RLS por perfil** nas 16 tabelas. Segura de aplicar: como hoje o dono
  é sempre `gestor` e todas as personas usam a sessão dele, o app atual **não quebra**
  (gestor tem acesso total). O enforcement só "liga de verdade" com a Fase 2.
  - **AÇÃO DO MARCOS:** rodar esse arquivo no SQL Editor do Supabase.
  - **Cuidado:** depois de aplicar, NÃO re-rodar o bloco de policy blanket do
    `setup-v2.sql` (linhas ~329-344) — ele recria "isolamento por empresa" (FOR ALL),
    que, sendo permissiva, anula o enforcement por perfil. Idealmente remover/guardar
    esse bloco no `setup-v2.sql` quando a Fase 2 for para produção.
  - **Conferir:** a outra IA criou `setup-v2-delta8.sql` — checar se mexe em RLS/policies
    antes de aplicar a Fase 1 (evitar conflito de policy).

- **Fase 2 (app.js) — IMPLEMENTADA (atrás de `flagAtiva('auth_perfil')`, flag OFF).**
  Feito: helpers `_emailSintetico`/`_senhaDePin`, `_loginRealFuncionario` (signIn/signUp
  sintético + `vincular_funcionario` + re-init de contexto), bifurcação em `fazerLogin`
  e `signOut` real em `fazerLogout`. Boot limpo, flag OFF = comportamento atual intacto.
  - **Fluxo (flag ON):** dono loga (conta) → "Trocar usuário" encerra a sessão dele →
    funcionário digita nome+PIN → autentica na conta própria → RLS por perfil vale.
    Reload: `_autoLoginMembroDaConta` reaplica a persona por `membros.perfil`.
  - **Follow-ups NÃO feitos (não bloqueiam o piloto):**
    1. **Bootstrapping de aparelho novo** (funcionário sem o dono ter logado antes ali):
       mostrar nome+PIN direto no boot via `usuarios_para_login` (RPC anon). Hoje o
       funcionário loga a partir do "Trocar usuário" depois do dono estabelecer contexto.
    2. **Voltar a ser dono/gestor:** usar "Sair da conta" (`authLogout`) → tela de conta
       (e-mail+senha). Decisão de UX (a) confirmada.
    3. **Reset de PIN:** como PIN=senha derivada, trocar o PIN não muda a senha de auth.
       V1: desativar o usuário e recriar com novo id (novo e-mail sintético).
  - **TESTE REAL (Marcos):** ligar a flag numa empresa de teste
    (`empresas.config.flags = {"auth_perfil": true}`), cadastrar um técnico com PIN,
    logar como ele e confirmar que não acessa financeiro. Claude não digita senha/PIN
    em campo; o enforcement no banco já está provado (teste RLS 9/9).

## Modelo de sessão (decidido)

- **Dono** = conta real (e-mail+senha), como hoje.
- **Funcionário** = conta real própria via **e-mail sintético**:
  `email = `${usuario.id}@${empresa.slug}.fluxa.local`` e **PIN = senha**.
  Cada pessoa ganha JWT próprio → a RLS por perfil passa a valer de verdade, SEM o
  funcionário precisar de e-mail real. UX continua: nome + PIN.
- **Flag:** tudo atrás de `flagAtiva('auth_perfil')` (empresas.config.flags). Flag OFF
  = fluxo atual (verificar_pin_interno, persona client-side). Flag ON = login real por
  pessoa. Ativar 1º na empresa de teste.

## Mudanças no app.js (function-level)

### 1. Helper novo (perto de `criarClienteSupabase`, ~l.235)
```js
function _emailSintetico(usuarioId){
  const slug = (EMPRESA?.slug) || (EMPRESA_ID||'').slice(0,8) || 'x';
  return String(usuarioId)+'@'+slug+'.fluxa.local';
}
// CRÍTICO: Supabase Auth exige senha >= 6 chars, mas o PIN tem 4. A senha de auth
// é DERIVADA do PIN de forma determinística (padding). O PIN continua sendo a única
// entropia; o prefixo fixo só satisfaz o mínimo de 6. Validado no teste da RLS.
function _senhaDePin(pin){ return 'fluxa_' + String(pin||''); }
```
(Precisa de `EMPRESA.slug` — já existe na tabela empresas; garantir que
`definirEmpresaAtiva`/`_ativarEmpresa` guardem `slug` no objeto EMPRESA.)

### 2. `fazerLogin` (~l.826) — bifurcar no ponto da verificação de PIN
Hoje (l.853-862) chama `verificar_pin_interno` e segue com persona client-side.
Com a flag ON e usuário real (id !== '__gestor__'):
```js
if(flagAtiva('auth_perfil') && loginUserSelecionado.id !== '__gestor__'){
  pinCorreto = await _loginRealFuncionario(loginUserSelecionado.id, pin); // abaixo
} else {
  // ...caminho atual (verificar_pin_interno)...
}
```
`_loginRealFuncionario`:
```js
async function _loginRealFuncionario(usuarioId, pin){
  const email = _emailSintetico(usuarioId);
  const senha = _senhaDePin(pin); // senha de auth >= 6 (o PIN cru vai só p/ a RPC)
  // 1) tenta entrar
  let { error } = await db.auth.signInWithPassword({ email, password: senha });
  if(error){
    // 2) conta não existe → cria e vincula (prova o PIN no servidor)
    const { error: e2 } = await db.auth.signUp({ email, password: senha });
    if(e2){
      if(/already registered/i.test(e2.message||'')) return false; // conta existe, PIN errado
      throw e2;
    }
    // signUp já deixa logado como o funcionário
  }
  // 3) garante o vínculo membros com o perfil (idempotente; valida o PIN)
  const { error: e3 } = await db.rpc('vincular_funcionario',
    { p_empresa: EMPRESA_ID, p_usuario_id: usuarioId, p_pin: pin });
  if(e3){ console.warn('[vincular_funcionario]', e3.message); return false; }
  // 4) re-inicializa contexto sob a NOVA sessão (agora é o funcionário)
  authUser = (await db.auth.getUser()).data?.user || authUser;
  await definirEmpresaAtiva();   // recarrega CFG/LOJAS sob o JWT do funcionário
  await conectarDB();            // re-assina realtime com a nova sessão
  return true;
}
```
> Cuidado: `signInWithPassword`/`signUp` **trocam a sessão** (do dono → funcionário).
> Por isso o re-init em (4). O `pinCorreto=true` segue no fluxo normal de `fazerLogin`
> (setSessao + navegação), que continua valendo para a UI.

### 3. Bootstrapping em aparelho novo (sem sessão) — boot (~l.1111)
Hoje: sem sessão → `mostrarTelaAuth()` (tela de conta e-mail/senha). Com a flag ON e
um contexto de empresa salvo no device (`ls('fluxa_empresa_id')` + slug), mostrar
direto a etapa **nome+PIN**, carregando os nomes via RPC pública:
```js
// pseudo: se flag ON e há empresa salva mas sem sessão de conta:
const nomes = await db.rpc('usuarios_para_login', { p_empresa: EMPRESA_ID });
// popular _loginUsersCache com nomes (sem PIN) e mostrar login-step-users
```
Assim o funcionário entra pelo nome+PIN mesmo sem o dono estar logado ali. (O 1º
setup do device — definir qual empresa — pode vir de um "código da empresa" = slug,
ou do primeiro login do dono no aparelho.)

### 4. Trocar de usuário — `fazerLogout` (~l.201)
Com a flag ON, "trocar usuário" precisa **encerrar a sessão real**:
```js
if(flagAtiva('auth_perfil')){ try{ await db.auth.signOut(); }catch(e){} authUser=null; }
```
e voltar à etapa nome+PIN (bootstrapping acima). **DECISÃO DE UX PENDENTE (Marcos):**
voltar a ser *gestor/dono* num aparelho compartilhado vira **re-login com e-mail+senha**
do dono (não é mais PIN instantâneo). Alternativas a decidir:
  - (a) aceitar: gestor loga com e-mail+senha quando precisa (mais seguro, recomendado);
  - (b) dar ao dono também um "atalho PIN" (conta sintética gestor) — mais cômodo,
    porém o dono passa a ter 2 identidades. **Recomendo (a).**

### 5. `salvarUsuario` (~l.6681) — sem mudança obrigatória
Continua gravando a linha em `usuarios` (nome/perfil/PIN) = a "pré-declaração". A conta
sintética é criada no 1º login do funcionário (lazy, item 2). Reset de PIN: como PIN=senha,
trocar o PIN NÃO muda a senha de auth automaticamente. V1 do reset: desativar o usuário e
recriar com novo id (novo e-mail sintético) — a conta antiga fica órfã (inofensiva).
Documentar isso na UI de "editar usuário".

## Teste da RLS (rodar DEPOIS que o Marcos aplicar a Fase 1) — via API, sem UI

Objetivo: provar que a RLS por perfil vale no banco. Rodar no `javascript_tool` do
browser (anon key). Cria 1 empresa de teste + 3 contas (gestor/vendas/técnico) e checa
a matriz. Pseudo-passos:

1. `signUp` conta dona → `rpc criar_empresa` → vira gestor. Guardar EMPRESA_ID + slug.
2. Como gestor: inserir 1 orçamento, 1 OS (tecnico='Fulano'), 1 despesa; criar 2 linhas
   em `usuarios`: "Vendedor"(vendas, pin 1111) e "Fulano"(tecnico, pin 2222).
3. `signUp` conta sintética do vendas → `rpc vincular_funcionario(empresa,'usr_vendas','1111')`.
   Com a sessão do VENDAS: `select orcamentos` deve **retornar linhas** (vendas vê ORC);
   `select despesas` deve **retornar vazio** (vendas sem despesas); `update empresas`
   deve **falhar** (só gestor).
4. `signUp` conta sintética do técnico → `vincular_funcionario(...,'2222')`.
   Com a sessão do TÉCNICO: `select orcamentos` deve **retornar vazio** (financeiro);
   `select ordens_servico` deve retornar **só as OS onde tecnico='Fulano'**; `insert
   despesas` deve **funcionar**; `select despesas` só as dele.
5. Confirmar isolamento entre-empresas ainda intacto (técnico não lê dados de outra empresa).

Cada checagem = uma chamada REST com o `access_token` da sessão correspondente
(guardar os 3 tokens). Sucesso = a matriz do cabeçalho de `setup-v2-optionA-perfil.sql`
bate 1:1. Limpar os dados de teste no fim.

## Resumo do que precisa do Marcos
1. Rodar `setup-v2-optionA-perfil.sql` no SQL Editor. (E conferir `setup-v2-delta8.sql`
   da outra IA por conflito de policy.)
2. Decidir a UX do item 4 (voltar a gestor = e-mail+senha; recomendo aceitar).
3. Fazer o teste de login real ponta a ponta depois da Fase 2 codada.
