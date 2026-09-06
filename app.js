// ══════════════════════════════════════════════════
//  SESSÃO — login multi-usuário
// ══════════════════════════════════════════════════
function getSessao(){ try{ return JSON.parse(sessionStorage.getItem('fluxa_user')||'null'); }catch(e){ return null; } }
function setSessao(u){ sessionStorage.setItem('fluxa_user',JSON.stringify(u)); }
function clearSessao(){ sessionStorage.removeItem('fluxa_user'); }
function eGestor(){ const s=getSessao(); return s?.perfil==='gestor'||s?.perfil==='master'; } // master herda acesso de gestor

// ── Log de auditoria (quem fez o quê) ──
let _auditoria = [];
function lsAuditLer(){ try{ return JSON.parse(ls('fluxa_auditoria')||'[]'); }catch(e){ return []; } }
function lsAuditSalvar(l){ lsSet('fluxa_auditoria', JSON.stringify(l.slice(0,500))); }
function logAcao(acao, detalhe){
  const s=getSessao();
  const reg={
    id:'aud_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
    usuario: s?.nome||'(não logado)', perfil: s?.perfil||'',
    acao, detalhe: detalhe||'',
    loja_id: s?.loja_id||lojaAtiva||null,
    data: new Date().toISOString()
  };
  if(!_auditoria.length) _auditoria=lsAuditLer();
  _auditoria.unshift(reg);
  lsAuditSalvar(_auditoria);
  if(dbOk&&db){ (async()=>{ try{ await _comTimeout(dbInsert('auditoria',reg),15000,'audit'); }catch(e){ /* tabela pode não existir ainda */ } })(); }
  if(document.getElementById('page-auditoria')?.classList.contains('on')) renderAuditoria();
}
async function loadAuditoria(){
  _auditoria = lsAuditLer();
  renderAuditoria();
  if(dbOk&&db){
    try{
      const {data}=await db.from('auditoria').select('*').eq('empresa_id',EMPRESA_ID).order('data',{ascending:false}).limit(500);
      if(data){
        const ids=new Set(data.map(x=>x.id));
        const soLocal=_auditoria.filter(x=>!ids.has(x.id));
        _auditoria=[...data,...soLocal].sort((a,b)=>new Date(b.data)-new Date(a.data));
        lsAuditSalvar(_auditoria);
      }
    }catch(e){ console.warn('[loadAuditoria]', e?.message||e); }
  }
  const sel=document.getElementById('audit-filtro-user');
  if(sel){ const v=sel.value; const us=[...new Set(_auditoria.map(a=>a.usuario).filter(Boolean))].sort(); sel.innerHTML='<option value="">Todos os usuários</option>'+us.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join(''); sel.value=v; }
  renderAuditoria();
}
function renderAuditoria(){
  const body=document.getElementById('audit-body'); if(!body) return;
  const fA=document.getElementById('audit-filtro-acao')?.value||'';
  const fU=document.getElementById('audit-filtro-user')?.value||'';
  let lista=filtrarPorLoja(_auditoria.length?_auditoria:lsAuditLer());
  if(fA) lista=lista.filter(a=>(a.acao||'').startsWith(fA));
  if(fU) lista=lista.filter(a=>a.usuario===fU);
  lista=lista.slice(0,300);
  if(!lista.length){ body.innerHTML='<div style="padding:18px;text-align:center;color:var(--gray);font-size:13px">Nenhum registro ainda.</div>'; return; }
  const acaoTxt={login:'🔑 Login',orcamento_criado:'📝 Orçamento criado',orcamento_status:'🔄 Status do orçamento',orcamento_excluido:'🗑 Orçamento excluído',estoque_mov:'📦 Movimento de estoque',estoque_entrega:'📦 Baixa/entrega',os_concluida:'✅ OS concluída',usuario_criado:'👤 Usuário criado',usuario_editado:'✏️ Usuário editado',usuario_removido:'🗑 Usuário removido'};
  body.innerHTML=lista.map(a=>{
    const d=new Date(a.data);
    return `<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-light)">
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--c2)">${acaoTxt[a.acao]||esc(a.acao)}${a.detalhe?' <span style="font-weight:400;color:var(--gray)">— '+esc(a.detalhe)+'</span>':''}</div>
        <div style="font-size:11px;color:var(--gray)">👤 ${esc(a.usuario||'—')}${a.perfil?' ('+esc(a.perfil)+')':''}${a.loja_id?' · '+esc(getLojaNome(a.loja_id)):''}</div>
      </div>
      <div style="font-size:11px;color:var(--gray);white-space:nowrap;text-align:right">${d.toLocaleDateString('pt-BR')}<br>${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
    </div>`;
  }).join('');
}
function eVendas(){ const s=getSessao(); return s?.perfil==='vendas'; }

// ── EVENT DELEGATION (Fase 4, R-9) ──────────────────────────────────────
// Remove o acoplamento HTML→nome-global que o onclick inline cria: o elemento
// declara data-act="funcao" (+ data-a="arg1|arg2") e UM listener no document
// despacha. closest() resolve aninhamento (o mais interno vence), então botão
// dentro de linha clicável dispensa stopPropagation. Migração incremental —
// convive com onclick inline ainda não convertido; a nav é a 1ª área migrada.
document.addEventListener('click', e=>{
  const el=e.target.closest('[data-act]');
  if(el){
    const fn=window[el.getAttribute('data-act')];
    if(typeof fn==='function'){
      if(el.tagName==='A') e.preventDefault(); // link agindo como botão (era return false)
      const raw=el.getAttribute('data-a'); fn(...(raw!=null && raw!=='' ? raw.split('|') : []));
    }
  }
  // Fecha-modal por clique no FUNDO: só quando o alvo é o próprio backdrop
  // (não um filho). Substitui o onclick="if(event.target===this)fecharX()".
  if(e.target.matches && e.target.matches('[data-close]')){
    const cf=window[e.target.getAttribute('data-close')];
    if(typeof cf==='function') cf();
  }
});
// Intenção nomeada pro que era `novaOS();go('os')` no menu (o resto dos
// compostos da nav colapsou: go() já fecha a sidebar; fazerLogout() também).
function irNovaOS(){ novaOS(); go('os'); }
function irNovoOrc(){ novoOrc(); go('form'); }
// Itens do menu de engrenagem: fecham o dropdown e então agem.
function _gearGo(p){ closeGear(); go(p); }
function _gearLogout(){ closeGear(); fazerLogout(); }
function _gearAuthLogout(){ closeGear(); authLogout(); }
// "Nova vistoria do zero" — limpa todo o estado da vistoria em edição.
function _visNovaDoZero(){
  visTab('nova'); window._visLocalId=null; visEditId=null; _visDraftId=null;
  _visAssinaturaTecnico=null; renderVisAssinaturaStatus(); _resetCheckinVis();
  const b=document.getElementById('vis-plano-banner'); if(b) b.style.display='none';
}
function eTecnico(){ const s=getSessao(); return s?.perfil==='tecnico'; }
function getLojaFiltro(){ const s=getSessao(); return s?.loja_id||null; }

// ══════════════════════════════════════════════════
//  AUTORIZAÇÃO GRANULAR (Fase 2.2) — matriz de capacidades
// ══════════════════════════════════════════════════
// can() é guardrail de UI/UX, NÃO segurança. A barreira REAL de dados é a RLS
// no Supabase (cada empresa só enxerga o próprio empresa_id, testado ao vivo na
// auditoria da Fase 1). Igual aos guards de go(): impedem cliques inválidos e
// escondem botões, não protegem o banco. Nunca troque uma checagem de servidor
// por um can().
//
// FONTE ÚNICA da verdade. Antes, quem-vê-o-quê estava em 3 lugares (go(),
// aplicarPermissoesPerfil e as regras de nav) e JÁ divergia: vendas/técnico
// eram expulsos de venda-balcao ao recarregar a página, mesmo podendo navegar
// para lá pelo menu. Consolidar aqui corrige isso.
//
// Adicionar um perfil novo (ex.: "supervisor de campo") = uma linha nova neste
// objeto, sem espalhar if pelo app inteiro.
//
// Convenção dos nomes: 'PAGE.<id>' = pode abrir a página <id>; os demais são
// ações de domínio (OS.EXECUTE, ORCAMENTO.APPROVE, ...) para o código novo
// consultar em vez de checar perfil na mão. gestor/master = '*' (podem tudo
// hoje; quando existir um gestor restrito, vira um perfil próprio).
const PERMISSOES = {
  gestor: ['*'],
  vendas: [
    'PAGE.form','PAGE.history','PAGE.crm','PAGE.clientes','PAGE.agendamentos',
    'PAGE.os','PAGE.venda-balcao',
    'ORCAMENTO.CREATE','ORCAMENTO.EDIT','ORCAMENTO.APPROVE',
    'OS.CREATE','OS.EDIT','CRM.EDIT','ESTOQUE.VIEW',
  ],
  tecnico: [
    'PAGE.minhas-os','PAGE.visitas','PAGE.os','PAGE.venda-balcao',
    'OS.EXECUTE','OS.FINISH',
    'VISTORIA.CREATE','VISTORIA.EDIT','VISTORIA.FINISH','ESTOQUE.VIEW',
  ],
};
function _permsDoPerfil(perfil){
  if(perfil==='master') return PERMISSOES.gestor; // master herda gestor
  return PERMISSOES[perfil] || [];
}
// Tem a capacidade? gestor/master ('*') têm tudo. Perfil desconhecido = nada.
function can(perm, sess){
  const s = sess || getSessao();
  if(!s || !s.perfil) return false;
  const perms = _permsDoPerfil(s.perfil);
  return perms.includes('*') || perms.includes(perm);
}
// Pode ABRIR a página? gestor/master sempre; demais pela matriz.
// (Sessão sem perfil reconhecido cai no tratamento legado de go(), não aqui.)
function podeVerPagina(pid, sess){
  const s = sess || getSessao();
  if(!s) return false;
  if(s.perfil==='gestor' || s.perfil==='master') return true;
  return can('PAGE.'+pid, s);
}

// Oculta/exibe nav conforme perfil
function aplicarPermissoesPerfil(){
  const gestor  = eGestor();
  const vendas  = eVendas();
  const tecnico = eTecnico();

  // ── Desktop nav ──
  // Mapa: id do botão → quem pode ver
  const navRules = {
    'nb-form'         : gestor||vendas,
    'nb-history'      : gestor||vendas,
    'nb-clientes'     : gestor||vendas,
    'nb-agendamentos' : gestor||vendas,
    'nb-os'           : gestor||vendas,
    'nb-os-history'   : gestor,
    'nb-equipamentos' : gestor,
    'nb-visitas'      : gestor||tecnico,
    'nb-despesas'     : gestor,
    'nb-produtividade': gestor,
  };
  Object.entries(navRules).forEach(([id,pode])=>{
    const el=document.getElementById(id); if(el) el.style.display=pode?'':'none';
  });

  // ── Sidebar nav ──
  const snbRules = {
    'snb-painel'       : gestor,
    'snav-primary-wrap': gestor||vendas, // era 'snb-form' — botão virou CTA fixo (redesign 15/08)
    'snb-history'      : gestor||vendas,
    'snb-crm'          : (gestor||vendas)&&_crmAtivo(),
    'snb-clientes'     : gestor||vendas,
    'snb-agendamentos' : gestor||vendas,
    'snb-os'           : gestor||vendas,
    'snb-venda-balcao' : gestor||vendas||tecnico,
    'snb-os-history'   : gestor,
    'snb-minhas-os'    : tecnico,
    'snb-equipamentos' : gestor,
    'snb-visitas'      : gestor||tecnico,
    'snb-despesas'     : gestor,
    'snb-estoque'      : gestor,
    'snb-produtividade': gestor,
  };
  Object.entries(snbRules).forEach(([id,pode])=>{
    const el=document.getElementById(id); if(el) el.style.display=pode?'':'none';
  });
  // Botão "← Minhas OS" no topo da página de Vistorias (só técnico precisa)
  const visBack=document.getElementById('vis-back-os'); if(visBack) visBack.style.display=tecnico?'':'none';
  // Reveal sidebar now that user is logged in
  const _sb=document.getElementById('sidebar');
  if(_sb){ _sb.classList.remove('s-hidden'); }
  document.body.classList.remove('no-sbar');
  initSidebar();

  // ── Seletor de loja no header — só gestor principal ──
  const lojaSelEl=document.getElementById('hdr-loja-select');
  if(lojaSelEl){
    const mostrarSelect=isMainGestor();
    lojaSelEl.style.display=mostrarSelect?'':'none';
    if(mostrarSelect) populaLojaSelect();
  }
  // Preenche os selects de empresa dos formulários a partir da config das lojas
  popularSelectsLojaForm();
  // Carrega estoque/vendas balcão em background — necessário p/ baixa automática e
  // reservado. setTimeout(...,0) é proposital: isto roda dentro do prefixo síncrono
  // do IIFE de boot (antes do primeiro await, linha ~1322), quando o resto do
  // arquivo — que declara todosFornecedores/todasOC/todosProdutos/todasVendasBalcao
  // com `let` bem mais abaixo (seção Estoque, linha 10000+) — ainda não rodou.
  // Chamar direto aqui derruba com TDZ ("Cannot access ... before initialization").
  // setTimeout empurra pro fim da fila de tarefas, depois que o script inteiro (e
  // todos os `let` tardios) já executou.
  setTimeout(()=>{ if(eGestor()){ try{ loadEstoque(); }catch(e){ console.warn('[boot loadEstoque]', e?.message||e); } } }, 0);
  setTimeout(()=>{ if(typeof loadVendasBalcao==='function') Promise.resolve(loadVendasBalcao()).catch(e=>console.warn('[boot loadVendasBalcao]', e?.message||e)); }, 0);

  // ── Gear menu ──
  // Regras por id
  const gearRules = {
    'gear-btn-empresa' : gestor,
    'gear-btn-usuarios': gestor,
    'gear-btn-auditoria': gestor,
    'gear-btn-prod'    : gestor,
    'gear-btn-estoque' : gestor,
    'gear-btn-visitas' : gestor||tecnico,
  };
  Object.entries(gearRules).forEach(([id,pode])=>{
    const el=document.getElementById(id); if(el) el.style.display=pode?'':'none';
  });
  // Regras por conteúdo do onclick
  const gearHideVendas = ['despesas','equipamentos','os-history'];
  document.querySelectorAll('#gear-menu button').forEach(btn=>{
    const oc=btn.getAttribute('onclick')||'';
    if(gearHideVendas.some(k=>oc.includes(k)))
      btn.style.display=(vendas||tecnico)?'none':'';
  });

  // ── Mobile nav — prioridade por perfil ──
  // Técnico:       Vistorias | Minhas OS | Mais
  // Gestor/Master: Vistorias | Orçam. | OS | Histórico | Mais
  // Vendas:        Orçam. | OS | Histórico | Mais
  const mnbRules = {
    'mnb-visitas'  : gestor||tecnico,
    'mnb-minhas-os': tecnico,
    'mnb-form'     : gestor||vendas,
    'mnb-os'       : gestor||vendas,
    'mnb-history'  : gestor||vendas,
  };
  Object.entries(mnbRules).forEach(([id,pode])=>{
    const el=document.getElementById(id); if(el) el.style.display=pode?'':'none';
  });

  // ── Cards financeiros e gráfico: ocultos para vendas ──
  const dashEl   =document.querySelector('.dash');
  const chartCard=document.querySelector('.dash-chart-card');
  if(dashEl)    dashEl.style.display   =vendas?'none':'';
  if(chartCard) chartCard.style.display=vendas?'none':'';

  // ── Abas de Vistorias: técnico vê só "Meus Locais" e "Histórico" ──
  const visTabNova=document.getElementById('vis-tab-nova');
  if(visTabNova) visTabNova.style.display=tecnico?'none':'';

  // ── Redirecionamentos ──
  const pAtiva=document.querySelector('.page.on');
  const pid=pAtiva?pAtiva.id.replace('page-',''):'';
  // Mesma matriz PERMISSOES do go() — antes esta lista OMITIA venda-balcao e
  // expulsava vendas/técnico de lá ao recarregar, divergindo do go(). (R-audit)
  const _sessAP=getSessao();
  if(tecnico && !podeVerPagina(pid, _sessAP)) go('minhas-os');
  if(vendas  && !podeVerPagina(pid, _sessAP)) go('form');

  // ── Banner de instalar como app (PWA) — só faz sentido com sessão ativa ──
  if(typeof _fluxaAvaliarBannerInstalar==='function'){
    try{ _fluxaAvaliarBannerInstalar(); }catch(e){ console.warn('[pwa-install]', e?.message||e); }
  }
  // ── Badge de notificações não lidas ──
  if(typeof _fluxaAtualizarBadgeNotif==='function'){
    try{ _fluxaAtualizarBadgeNotif(); }catch(e){ console.warn('[notif-badge]', e?.message||e); }
  }
}

// Atualiza badge de usuário no header
function atualizarBadgeUsuario(){
  const s=getSessao();
  const nome=s?.nome||'Gestor';
  const inicial=nome.charAt(0).toUpperCase();
  const el=document.getElementById('hdr-user-avatar');
  const elNome=document.getElementById('hdr-user-nome');
  const avatarExtra = s?.perfil==='gestor'?' gestor': s?.perfil==='vendas'?' vendas':'';
  if(el){ el.textContent=s?.perfil==='vendas'?'💼':inicial; el.className='hdr-user-avatar'+avatarExtra; }
  // v2: uma empresa por tenant — sem sufixo de empresa no nome do técnico.
  if(elNome) elNome.textContent=nome;
}

function fazerLogout(){
  const _sbLogout=document.getElementById('sidebar');
  if(_sbLogout){ _sbLogout.classList.add('s-hidden'); }
  closeSidebar();
  document.body.classList.add('no-sbar');
  clearSessao();
  // Opção A (flag on): a persona é uma SESSÃO real → trocar de usuário encerra a
  // sessão do funcionário. (Voltar a ser o dono/gestor = login pela conta, e-mail+senha.)
  if(_authPerfilAtivo() && db){ try{ db.auth.signOut(); authUser=null; }catch(e){ console.warn('[fazerLogout:signOut]', e?.message||e); } }
  loginUserSelecionado=null;
  // Resetar passos
  const su=document.getElementById('login-step-users');
  const sp=document.getElementById('login-step-pin');
  const sl=document.getElementById('login-step-loja');
  if(su) su.style.display='';
  if(sp) sp.classList.remove('show');
  if(sl) sl.classList.remove('show');
  document.getElementById('login-overlay').style.display='flex';
  renderLoginUsers();
}

// ══════════════════════════════════════════════════
//  AUTENTICAÇÃO DE CONTA (Supabase Auth) — camada externa do multi-tenant
// ══════════════════════════════════════════════════
// A conta (e-mail/senha) identifica o usuário e, via tabela `membros` + RLS, dá
// acesso à(s) empresa(s) dele. Depois de autenticado, o PIN interno escolhe a
// persona (gestor/vendas/técnico) — o fluxo antigo NÃO morre, vira a etapa seguinte.
let authUser = null;      // usuário do Supabase Auth (session.user) ou null
let authModo = 'login';   // 'login' | 'criar'

// Cria o cliente Supabase uma única vez (reusado por conectarDB e pelo Auth).
// Sem credenciais preenchidas (PREENCHER_DEPOIS) → retorna null (modo local/dev).
function criarClienteSupabase(){
  if(db) return db;
  if(!SUPABASE_URL || SUPABASE_URL==='PREENCHER_DEPOIS' || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY==='PREENCHER_DEPOIS') return null;
  try{ const {createClient}=supabase; db=createClient(SUPABASE_URL, SUPABASE_ANON_KEY); return db; }
  catch(e){ console.warn('[criarClienteSupabase]', e?.message||e); return null; }
}

// ── Opção A (PADRÃO em toda empresa; desligável via config.flags.auth_perfil=false):
//    login REAL por pessoa — cada funcionário na conta própria, RLS por perfil vale ──
// Cada funcionário tem conta própria (e-mail sintético + PIN), então a RLS por
// perfil vale de verdade. Ver docs/opcao-a-fase2.md. Com a flag OFF, nada disso roda.
// authVer: versão do login (reset de PIN incrementa → e-mail novo → conta nova com
// o PIN novo). v0 = sem sufixo (compat com contas já criadas). Ver resetar_pin_funcionario.
function _emailSintetico(usuarioId, authVer){
  const slug = (EMPRESA && EMPRESA.slug) || ls('fluxa_empresa_slug') || String(EMPRESA_ID||'').slice(0,8) || 'x';
  const v = parseInt(authVer)||0;
  const uid = v>0 ? (String(usuarioId)+'.v'+v) : String(usuarioId);
  return uid+'@'+slug+'.fluxa.local';
}
// Supabase Auth exige senha >= 6; o PIN tem 4 → deriva determinística (o PIN segue
// sendo a única entropia). O PIN CRU vai só para a RPC vincular_funcionario.
function _senhaDePin(pin){ return 'fluxa_'+String(pin||''); }

// Login real por perfil é PADRÃO em toda empresa. Interruptor de emergência por
// empresa: setar config.flags.auth_perfil = false desliga (volta ao PIN sob a
// sessão do dono) sem novo deploy. Ausente/true = ligado.
function _authPerfilAtivo(){
  try{ return (FLUXA_CONFIG.flags && FLUXA_CONFIG.flags.auth_perfil) !== false; }
  catch(e){ return true; }
}

// Entra como o funcionário: signIn (ou signUp no 1º acesso) + vincula pelo PIN, e
// re-inicializa o contexto sob a NOVA sessão. Retorna true se autenticou.
async function _loginRealFuncionario(usuarioId, pin, authVer){
  if(!db || !EMPRESA_ID) return false;
  // Checa o PIN ANTES de tentar signIn/signUp — achado de auditoria 2026-07-20:
  // sem isso, um terceiro que soubesse o usuario_id (usuarios_para_login é anon)
  // podia chamar signUp direto com a senha que quisesse pro e-mail sintético de
  // QUALQUER funcionário que ainda não tivesse feito o 1º login — o Supabase Auth
  // cria a conta ali mesmo, sem checar PIN. O funcionário de verdade, tentando
  // depois com o PIN certo, nunca mais conseguia entrar (senha já é outra,
  // signUp bate "already registered", tratado como PIN errado pra sempre).
  // verificar_pin_bootstrap roda ANTES, sem exigir sessão (por isso não dá pra
  // reusar verificar_pin_interno/vincular_funcionario, que exigem auth.uid()) —
  // se o PIN estiver errado, retorna aqui e NUNCA chega a chamar signUp.
  try{
    const { data: pinOk, error: ePin } = await db.rpc('verificar_pin_bootstrap',
      { p_empresa: EMPRESA_ID, p_usuario_id: usuarioId, p_pin: pin });
    if(ePin || !pinOk) return false;
  }catch(e){ console.warn('[verificar_pin_bootstrap]', e?.message||e); return false; }
  const email = _emailSintetico(usuarioId, authVer);
  const senha = _senhaDePin(pin);
  try{
    let { error } = await db.auth.signInWithPassword({ email, password: senha });
    if(error){
      const { error: e2 } = await db.auth.signUp({ email, password: senha });
      if(e2){
        if(/already registered|already exists/i.test(e2.message||'')) return false; // conta existe → PIN errado
        console.warn('[loginReal:signUp]', e2.message); return false;
      }
      // signUp já deixa a sessão logada como o funcionário
    }
    // vínculo membros (idempotente; valida o PIN no servidor)
    const { error: e3 } = await db.rpc('vincular_funcionario',
      { p_empresa: EMPRESA_ID, p_usuario_id: usuarioId, p_pin: pin });
    if(e3){ console.warn('[vincular_funcionario]', e3.message); return false; }
    // re-init do contexto sob o JWT do funcionário
    try{ authUser = (await db.auth.getUser()).data?.user || authUser; }catch(e){}
    try{ await definirEmpresaAtiva(); }catch(e){ console.warn('[loginReal:definirEmpresa]', e?.message||e); }
    // Bootstrap (técnico no próprio aparelho): o boot tinha retornado cedo (sem
    // conectar). Agora que há sessão real, recarrega p/ o boot autenticado completo
    // (_autoLoginMembroDaConta reaplica a persona + carrega os dados). dbOk=true = já
    // conectado (troca de usuário em aparelho compartilhado) → segue sem recarregar.
    if(!dbOk){ setTimeout(()=>location.reload(), 60); return true; }
    return true;
  }catch(e){ console.warn('[_loginRealFuncionario]', e?.message||e); return false; }
}

// Bootstrapping do técnico no PRÓPRIO aparelho (sem sessão de conta): identifica a
// empresa por link (#e/<slug>) ou por cache de um login anterior, e mostra a etapa
// nome+PIN direto (em vez da tela de conta e-mail/senha). Retorna true se conseguiu.
// Só nomes vêm do servidor (usuarios_para_login, sem PIN). Ver docs/opcao-a-fase2.md.
async function _bootstrapTecnico(){
  if(!_authPerfilAtivo() || !db) return false;
  try{
    let empId=null, empSlug=null, empNome=null, branding=null;
    const m = (location.hash||'').match(/^#e\/([a-z0-9-]+)/i);
    if(m){
      const { data, error } = await db.rpc('empresa_por_slug', { p_slug: m[1] });
      if(error || !data || !data.length) return false;
      empId=data[0].id; empSlug=m[1]; empNome=data[0].nome; branding=data[0].branding||{};
      try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){ location.hash=''; }
    } else if(ls('fluxa_empresa_id') && ls('fluxa_empresa_slug')){
      empId=ls('fluxa_empresa_id'); empSlug=ls('fluxa_empresa_slug');
      try{ const c=JSON.parse(ls('empresa_cfg')||'{}'); empNome=c.nome; branding={nome:c.nome,appName:c.appName,cor:c.cor,cor2:c.cor2,tagline:c.tagline,logoB64:c.logoB64,sub:c.sub}; }catch(e){}
    } else return false;

    // contexto mínimo p/ o login por perfil (EMPRESA.slug → e-mail sintético correto)
    EMPRESA_ID=empId;
    EMPRESA={ id:empId, slug:empSlug, nome:empNome, config:(branding||{}) };
    lsSet('fluxa_empresa_id',empId); lsSet('fluxa_empresa_slug',empSlug);
    try{
      CFG={ ...CFG_DEF, ...(branding||{}) }; if(!CFG.nome) CFG.nome=empNome; FLUXA_CONFIG.flags={}; aplicarCFG();
      // marca da EMPRESA na tela de login (o link #e/<slug> já confirma a empresa certa,
      // então aqui é ok mostrar nome/logo — diferente da tela de conta genérica)
      const ln=document.getElementById('login-brand-name'); if(ln) ln.textContent=empNome||'Fluxa';
      const lt=document.getElementById('login-brand-tagline'); if(lt&&branding&&branding.tagline) lt.textContent=branding.tagline;
      if(branding&&branding.logoB64){ const li=document.getElementById('login-brand-initials'); const lg=document.getElementById('login-logo-img'); if(lg){ lg.src=branding.logoB64; lg.style.display=''; } if(li) li.style.display='none'; }
      if(branding&&branding.cor){ document.documentElement.style.setProperty('--c1', branding.cor); }
    }catch(e){ console.warn('[bootstrap:cfg]',e?.message||e); }

    const { data:us, error:eu } = await db.rpc('usuarios_para_login', { p_empresa:empId });
    if(eu){ console.warn('[bootstrap:usuarios]',eu.message); return false; }
    todosUsuarios=(us||[]).map(u=>({ id:u.id, nome:u.nome, perfil:u.perfil, loja_id:u.loja_id, loja_nome:'', ativo:true, auth_ver:u.auth_ver }));

    // mostra a etapa nome+PIN (não a tela de conta) + escape "sou o dono"
    const a=document.getElementById('login-step-auth'); if(a) a.style.display='none';
    const su=document.getElementById('login-step-users'); if(su) su.style.display='';
    const sl=document.getElementById('login-step-loja'); if(sl) sl.classList.remove('show');
    if(su && !document.getElementById('bootstrap-dono-link')){
      const lk=document.createElement('div');
      lk.id='bootstrap-dono-link'; lk.style.cssText='text-align:center;margin-top:14px;font-size:13px';
      lk.innerHTML='<a href="#" onclick="event.preventDefault();mostrarTelaAuth();" style="color:var(--gray)">Sou o dono / entrar com e-mail</a>';
      su.appendChild(lk);
    }
    document.getElementById('login-overlay').style.display='flex';
    renderLoginUsers();
    return true;
  }catch(e){ console.warn('[_bootstrapTecnico]',e?.message||e); return false; }
}

function mostrarTelaAuth(){
  resetMarcaSaaS(); // pré-login = marca neutra do produto (não herda tema de empresa)
  const a=document.getElementById('login-step-auth'); if(a) a.style.display='';
  const u=document.getElementById('login-step-users'); if(u) u.style.display='none';
  const sl=document.getElementById('login-step-loja'); if(sl) sl.classList.remove('show');
  const r=document.getElementById('login-step-recuperar'); if(r) r.style.display='none';
  document.getElementById('login-overlay').style.display='flex';
}
// Esconde a tela de conta e revela a etapa interna (usuário + PIN).
function esconderTelaAuth(){
  const a=document.getElementById('login-step-auth'); if(a) a.style.display='none';
  const u=document.getElementById('login-step-users'); if(u) u.style.display='';
}

function authToggleModo(){
  authModo = (authModo==='login') ? 'criar' : 'login';
  const criar = authModo==='criar';
  document.getElementById('auth-empresa-wrap').style.display = criar ? '' : 'none';
  document.getElementById('auth-seu-nome-wrap').style.display = criar ? '' : 'none';
  document.getElementById('auth-title').textContent = criar ? 'Criar minha empresa' : 'Entrar na sua conta';
  document.getElementById('auth-sub').textContent   = criar ? 'Comece grátis — leva 1 minuto' : 'Acesse com seu e-mail e senha';
  document.getElementById('auth-btn').textContent   = criar ? 'Criar empresa →' : 'Entrar →';
  document.getElementById('auth-toggle-txt').textContent  = criar ? 'Já tem conta?' : 'Ainda não tem conta?';
  document.getElementById('auth-toggle-link').textContent = criar ? 'Fazer login' : 'Criar minha empresa';
  const esq=document.getElementById('auth-esqueci-wrap'); if(esq) esq.style.display = criar ? 'none' : ''; // só no login
  const cons=document.getElementById('auth-consent-wrap'); if(cons) cons.style.display = criar ? '' : 'none'; // só no cadastro
  const ae=document.getElementById('auth-err'); if(ae){ ae.textContent=''; ae.style.color=''; }
}

function _msgAuthErro(e){
  const m=(e?.message||'').toLowerCase();
  if(m.includes('invalid login')||m.includes('credentials')) return 'E-mail ou senha incorretos.';
  if(m.includes('already registered')||m.includes('already exists')) return 'Este e-mail já tem conta. Faça login.';
  if(m.includes('confirm')) return 'Conta criada. Confirme o e-mail e faça login.';
  if(m.includes('password')&&m.includes('6')) return 'A senha precisa de ao menos 6 caracteres.';
  return 'Não foi possível concluir. Tente novamente.';
}

async function authLogin(email, senha){
  const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
  if(error) throw error;
  authUser = data.user;
  return data;
}

async function authCriarEmpresa(nome, nomeUsuario, email, senha){
  const { data:su, error:e1 } = await db.auth.signUp({ email, password: senha });
  if(e1) throw e1;
  // Se a confirmação de e-mail estiver ligada, signUp não devolve sessão → tenta login.
  if(!su.session){
    const { error:e2 } = await db.auth.signInWithPassword({ email, password: senha });
    if(e2) throw new Error('confirm'); // cai em _msgAuthErro → "confirme o e-mail"
  }
  authUser = (await db.auth.getUser()).data?.user || su.user;
  // p_nome_usuario fica em membros.nome — usado no auto-login (sem tela de PIN
  // pra quem já provou quem é via e-mail+senha da conta).
  const { data:empId, error:e3 } = await db.rpc('criar_empresa', { p_nome: nome, p_nome_usuario: nomeUsuario||null });
  if(e3) throw e3;
  return empId;
}

async function authSubmit(){
  const email=(gV('auth-email')||'').trim(), senha=gV('auth-senha')||'';
  const err=document.getElementById('auth-err'); err.textContent='';
  const btn=document.getElementById('auth-btn'); const _t=btn.textContent;
  if(!db){ err.textContent='Banco ainda não configurado (preencha as credenciais).'; return; }
  if(!email||!senha){ err.textContent='Preencha e-mail e senha.'; return; }
  btn.disabled=true; btn.textContent='…';
  try{
    if(authModo==='criar'){
      const nome=(gV('auth-empresa')||'').trim();
      const nomeUsuario=(gV('auth-seu-nome')||'').trim();
      if(!nome){ err.textContent='Informe o nome da empresa.'; return; }
      if(!nomeUsuario){ err.textContent='Informe o seu nome.'; return; }
      await authCriarEmpresa(nome, nomeUsuario, email, senha);
    } else {
      await authLogin(email, senha);
    }
    await conectarDB();          // conecta/realtime já autenticado
    await checarAdminPlataforma();
    if(isPlataformaAdmin){ entrarModoPlataforma(); return; }
    await definirEmpresaAtiva(); // contexto da empresa (T3)
    esconderTelaAuth();
    // Quem autenticou com e-mail+senha já provou quem é — entra direto como
    // gestor da empresa, sem passar pela tela de PIN interno (essa é só para
    // perfis criados DEPOIS pelo gestor: vendas/técnico/gestores adicionais).
    if(await _autoLoginMembroDaConta()) return;
    try{ todosUsuarios=JSON.parse(ls('fluxa_usuarios')||'[]'); }catch(e){ todosUsuarios=[]; }
    renderLoginUsers();
  }catch(e){
    console.warn('[authSubmit]', e?.message||e);
    err.textContent=_msgAuthErro(e);
  }finally{ btn.disabled=false; btn.textContent=_t; }
}

// ── Recuperação de senha da CONTA (dono/gestor) ──
// "Esqueci minha senha" → e-mail com link → #recuperar (type=recovery) → nova senha.
// Funciona com o e-mail padrão do Supabase (raro no piloto); SMTP próprio só escala volume.
async function authEsqueciSenha(){
  const email=(gV('auth-email')||'').trim();
  const err=document.getElementById('auth-err'); if(err){ err.style.color=''; }
  if(!email){ if(err) err.textContent='Digite seu e-mail acima primeiro.'; document.getElementById('auth-email')?.focus(); return; }
  if(!db){ if(err) err.textContent='Banco não configurado.'; return; }
  if(err) err.textContent='';
  const link=document.getElementById('auth-esqueci-link'); const _t=link?link.textContent:'';
  if(link) link.textContent='Enviando…';
  try{
    const redirectTo = location.origin+location.pathname+'#recuperar';
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
    if(error) throw error;
    if(err){ err.style.color='#16a34a'; err.textContent='📧 Link de recuperação enviado para '+email+'. Veja seu e-mail (e o spam).'; }
  }catch(e){ console.warn('[esqueciSenha]',e?.message||e); if(err){ err.style.color=''; err.textContent='Não foi possível enviar agora. Tente de novo.'; } }
  finally{ if(link) link.textContent=_t; }
}
function mostrarTelaRecuperar(){
  const ov=document.getElementById('login-overlay'); if(ov) ov.style.display='flex';
  ['login-step-auth','login-step-users','login-step-loja'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.style.display='none'; el.classList&&el.classList.remove('show'); } });
  const r=document.getElementById('login-step-recuperar'); if(r) r.style.display='';
  try{ resetMarcaSaaS(); }catch(e){}
}
async function authNovaSenha(){
  const s1=gV('rec-senha')||'', s2=gV('rec-senha2')||'';
  const err=document.getElementById('rec-err'); if(err) err.textContent='';
  if(s1.length<6){ if(err) err.textContent='A senha precisa de ao menos 6 caracteres.'; return; }
  if(s1!==s2){ if(err) err.textContent='As senhas não conferem.'; return; }
  const btn=document.getElementById('rec-btn'); const _t=btn?btn.textContent:''; if(btn){ btn.disabled=true; btn.textContent='Salvando…'; }
  try{
    const { error } = await db.auth.updateUser({ password: s1 });
    if(error) throw error;
    toast('✅ Senha alterada! Entre com a nova senha.');
    try{ await db.auth.signOut(); }catch(e){}
    try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){ location.hash=''; }
    setTimeout(()=>location.reload(), 400);
  }catch(e){ console.warn('[novaSenha]',e?.message||e); if(err) err.textContent='Não foi possível salvar — o link pode ter expirado. Peça outro.'; }
  finally{ if(btn){ btn.disabled=false; btn.textContent=_t; } }
}

// Logout de CONTA (encerra a sessão Auth) + limpa estado. Diferente de fazerLogout
// (troca de usuário interno dentro da mesma conta/empresa).
async function authLogout(){
  try{ if(db && db.auth) await db.auth.signOut(); }catch(e){ console.warn('[authLogout]', e?.message||e); }
  authUser=null; EMPRESA_ID=null; EMPRESA=null;
  clearSessao();
  try{ closeSidebar(); closeGear(); }catch(e){}
  // Recarrega para garantir estado limpo em memória (sem vazar dados entre contas).
  location.reload();
}

// ══════════════════════════════════════════════════
//  CONTEXTO DA EMPRESA (tenant ativo) — T3
// ══════════════════════════════════════════════════
// Após autenticar, a RLS devolve só as empresas do usuário (via tabela membros).
// Definimos EMPRESA_ID e populamos CFG (de empresas.config) e LOJAS (tabela lojas).
let _empresasDisponiveis = [];

// Restaura o contexto da empresa a partir do cache local (para funcionar offline
// depois de já ter logado uma vez). Não acessa o banco.
function restaurarContextoCache(){
  const eid=ls('fluxa_empresa_id'); if(eid) EMPRESA_ID=eid;
  try{ const l=JSON.parse(ls('fluxa_lojas')||'[]'); if(l&&l.length){ LOJAS=l; } }catch(e){ console.warn('[restaurarContextoCache:lojas]', e?.message||e); }
  FLUXA_CONFIG.lojas          = LOJAS;
  FLUXA_CONFIG.appName        = CFG.appName || CFG.nome || 'Fluxa';
  FLUXA_CONFIG.todasLabel     = CFG.todasLabel || 'Todas';
  FLUXA_CONFIG.grupoPrincipal = Array.isArray(CFG.grupoPrincipal) && CFG.grupoPrincipal.length
                                  ? CFG.grupoPrincipal
                                  : [...new Set(LOJAS.map(l=>l.grupo).filter(Boolean))];
  FLUXA_CONFIG.flags          = CFG.flags || {};
  FLUXA_CONFIG.lojaPadrao     = CFG.lojaPadrao || (LOJAS[0]?.id || '');
  LOJA_PADRAO_ID  = FLUXA_CONFIG.lojaPadrao;
  GRUPO_PRINCIPAL = FLUXA_CONFIG.grupoPrincipal;
}

async function definirEmpresaAtiva(){
  if(!db){ return; }
  try{
    const { data, error } = await db.from('empresas').select('*').eq('ativo',true).order('created_at',{ascending:true});
    if(error) throw error;
    _empresasDisponiveis = data || [];
    if(!_empresasDisponiveis.length){ console.warn('[definirEmpresaAtiva] usuário sem empresa vinculada'); return; }
    const salva = ls('fluxa_empresa_id');
    const escolhida = _empresasDisponiveis.find(e=>e.id===salva) || _empresasDisponiveis[0];
    // Mais de uma empresa e nenhuma escolha salva → deixa o seletor decidir.
    if(_empresasDisponiveis.length>1 && !_empresasDisponiveis.find(e=>e.id===salva)){
      mostrarSeletorEmpresa();
      // aplica a primeira provisoriamente para a UI não ficar sem contexto
    }
    await _ativarEmpresa(escolhida);
  }catch(e){ console.warn('[definirEmpresaAtiva]', e?.message||e); }
}

async function _ativarEmpresa(emp){
  if(!emp) return;
  EMPRESA = emp; EMPRESA_ID = emp.id;
  lsSet('fluxa_empresa_id', EMPRESA_ID);
  if(emp.slug) lsSet('fluxa_empresa_slug', emp.slug); // p/ e-mail sintético no bootstrap sem sessão
  await _aplicarContextoEmpresa();
}

// Aplica config + lojas da empresa ativa em toda a UI/estado.
async function _aplicarContextoEmpresa(){
  // 1) CFG = defaults + empresas.config (jsonb) — substitui a antiga tabela empresa_config
  const cfg = (EMPRESA && EMPRESA.config) || {};
  CFG = { ...CFG_DEF, ...cfg };
  if(!CFG.nome && EMPRESA?.nome) CFG.nome = EMPRESA.nome;
  lsSet('empresa_cfg', JSON.stringify(CFG));
  // 2) Identidade (FLUXA_CONFIG) a partir do config
  FLUXA_CONFIG.appName        = CFG.appName || EMPRESA?.nome || 'Fluxa';
  FLUXA_CONFIG.todasLabel     = CFG.todasLabel || 'Todas';
  FLUXA_CONFIG.grupoPrincipal = Array.isArray(CFG.grupoPrincipal) ? CFG.grupoPrincipal : [];
  FLUXA_CONFIG.flags          = CFG.flags || {};
  // 3) LOJAS da tabela lojas (RLS já filtra por empresa; .eq é defesa em profundidade)
  await carregarLojas();
  // 4) derivados de config/lojas
  FLUXA_CONFIG.lojaPadrao = CFG.lojaPadrao || (LOJAS[0]?.id || '');
  LOJA_PADRAO_ID = FLUXA_CONFIG.lojaPadrao;
  // GRUPO_PRINCIPAL = ids das lojas vistas juntas em "Todas". filtrarPorLoja e
  // populaLojaSelect comparam GRUPO_PRINCIPAL contra loja_id / l.id (IDS de loja),
  // então aqui precisa ser l.id — não l.grupo. (Com l.grupo, numa empresa nova o
  // grupo default 'principal' nunca batia com o loja_id UUID e TODOS os registros
  // com loja_id sumiam do histórico/dashboard.)
  if(!FLUXA_CONFIG.grupoPrincipal.length){
    FLUXA_CONFIG.grupoPrincipal = [...new Set(LOJAS.map(l=>l.id).filter(Boolean))];
  }
  GRUPO_PRINCIPAL = FLUXA_CONFIG.grupoPrincipal;
  // 5) aplica na UI
  try{ document.title = FLUXA_CONFIG.appName; }catch(e){ console.warn('[title]', e?.message||e); }
  loadLojasExtraConfig();
  aplicarCFG();
  initEmailJS();
  if(typeof populaLojaSelect==='function') populaLojaSelect();
  if(typeof popularSelectsLojaForm==='function') popularSelectsLojaForm();
  if(typeof atualizarHeaderLoja==='function') atualizarHeaderLoja();
  // Re-filtra o realtime para a empresa ativa (ao trocar de empresa no mesmo login)
  if(dbOk && db && typeof iniciarRealtimeSync==='function') iniciarRealtimeSync();
}

// Carrega as unidades (lojas) da empresa ativa. Campos cor/grupo/tecs vêm da tabela.
async function carregarLojas(){
  if(!dbOk || !db || !EMPRESA_ID){
    try{ LOJAS = JSON.parse(ls('fluxa_lojas')||'[]'); }catch(e){ LOJAS=[]; }
    FLUXA_CONFIG.lojas = LOJAS; return;
  }
  try{
    const { data, error } = await db.from('lojas').select('*')
      .eq('empresa_id', EMPRESA_ID).eq('ativo', true)
      .order('data_criacao', {ascending:true});
    if(error) throw error;
    LOJAS = (data||[]).map((l,i)=>({
      ...l,
      id: l.id,
      nome: l.nome || 'Unidade',
      cor: l.cor || ('loja-'+(i%3)),
      grupo: l.grupo || 'principal',
      tecs: Array.isArray(l.tecs) ? l.tecs : []
    }));
    FLUXA_CONFIG.lojas = LOJAS;
    lsSet('fluxa_lojas', JSON.stringify(LOJAS));
  }catch(e){
    console.warn('[carregarLojas]', e?.message||e);
    try{ LOJAS = JSON.parse(ls('fluxa_lojas')||'[]'); }catch(_){ LOJAS=[]; }
    FLUXA_CONFIG.lojas = LOJAS;
  }
}

// Carrega os municípios atendidos (fins de ISS — setup-v2-delta23.sql) e
// popula o <select id="municipio-servico"> do formulário de orçamento.
// Lazy-load (chamado de novoOrc()/abrirOrc(), não no boot) — mesmo padrão de
// outros selects populados sob demanda neste app (ex.: fornecedor da OC).
async function carregarMunicipiosFiscais(){
  if(dbOk && db && EMPRESA_ID){
    try{
      const { data, error } = await db.from('municipios_fiscais').select('*')
        .eq('empresa_id', EMPRESA_ID).eq('ativo', true).order('nome',{ascending:true});
      if(error) throw error;
      MUNICIPIOS_FISCAIS = data || [];
    }catch(e){ console.warn('[carregarMunicipiosFiscais]', e?.message||e); MUNICIPIOS_FISCAIS=[]; }
  }
  const sel = document.getElementById('municipio-servico'); if(!sel) return;
  const atual = sel.value;
  sel.innerHTML = '<option value="">— Selecione (opcional por enquanto) —</option>' +
    MUNICIPIOS_FISCAIS.map(m=>`<option value="${m.codigo_ibge}">${esc(m.nome)}</option>`).join('');
  if(MUNICIPIOS_FISCAIS.some(m=>m.codigo_ibge===atual)) sel.value = atual;
}

// Persiste o CFG na coluna config da empresa ativa (substitui upsert em empresa_config).
async function _persistirConfigEmpresa(){
  if(!dbOk || !db || !EMPRESA_ID) return false;
  try{
    await dbUpdate('empresas', { config: CFG }, 'id', EMPRESA_ID);
    if(EMPRESA) EMPRESA.config = CFG;
    return true;
  }catch(e){ console.warn('[_persistirConfigEmpresa]', e?.message||e); return false; }
}

// ── Seletor de empresa (quando o usuário é membro de mais de uma) ──
function mostrarSeletorEmpresa(){
  const list=document.getElementById('login-loja-list'); if(!list) return;
  list.innerHTML = _empresasDisponiveis.map(e=>{
    const ini=(e.nome||'?').trim().charAt(0).toUpperCase();
    return `<button class="login-loja-btn" onclick="escolherEmpresa('${e.id}')">
      <div class="login-loja-circle" style="background:var(--c1)">${esc(ini)}</div>
      <div><div class="login-loja-info-nome">${esc(e.nome||'Empresa')}</div>
      <div class="login-loja-info-sub">${esc(e.plano||'')}</div></div>
    </button>`;
  }).join('');
  const su=document.getElementById('login-step-users'); if(su) su.style.display='none';
  const sa=document.getElementById('login-step-auth'); if(sa) sa.style.display='none';
  const sl=document.getElementById('login-step-loja'); if(sl) sl.classList.add('show');
  document.getElementById('login-overlay').style.display='flex';
}

async function escolherEmpresa(id){
  const emp=_empresasDisponiveis.find(e=>e.id===id); if(!emp) return;
  await _ativarEmpresa(emp);
  const sl=document.getElementById('login-step-loja'); if(sl) sl.classList.remove('show');
  esconderTelaAuth();
  try{ todosUsuarios=JSON.parse(ls('fluxa_usuarios')||'[]'); }catch(e){ todosUsuarios=[]; }
  renderLoginUsers();
}

// ══════════════════════════════════════════════════
//  CONEXÃO SUPABASE (multi-tenant) — ÚNICO ponto de credenciais
// ══════════════════════════════════════════════════
// Fluxa v2 é um SaaS pool: UM deploy + UM banco servindo N empresas, isoladas por
// RLS. Preencher as duas constantes quando o projeto Supabase existir (o banco é
// criado depois do código pronto). Ativar o app = só preencher aqui.
const SUPABASE_URL      = 'https://auoklaiffalbdgazrbdu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1b2tsYWlmZmFsYmRnYXpyYmR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNDU5OTMsImV4cCI6MjA5OTkyMTk5M30.VvEhdTy0wsV0VkRM_rY6sYBSaVTRx9_Xb9WGfFMp-WY';

// Marca neutra do PRODUTO (SaaS Fluxa) — cores da tela de CONTA, ANTES do login.
// Declaradas AQUI (topo) e não mais tarde: resetMarcaSaaS()/aplicarCFG() rodam no
// boot antes da posição original (~l.1562) e um `const` em TDZ estourava
// ("Cannot access 'SAAS_C1' before initialization"), abortando o reset da cor —
// então o --c1 da empresa (cache) vazava no pré-login. Ver resetMarcaSaaS/aplicarCFG.
const SAAS_C1 = '#F07820', SAAS_C2 = '#2B3244';

// ══════════════════════════════════════════════════
//  CONTEXTO DA EMPRESA (tenant ativo) — populado APÓS o login
// ══════════════════════════════════════════════════
// NADA de empresa fica chumbado no código. Depois de autenticar (Supabase Auth),
// carregamos a(s) empresa(s) do usuário (a RLS devolve só as dele) e preenchemos:
//   • EMPRESA_ID  — uuid da empresa ativa (vai em todo insert/update e no namespace)
//   • FLUXA_CONFIG — espelho de empresas.config (jsonb): appName, lojaPadrao,
//                    todasLabel, grupoPrincipal, flags, emailjs…
//   • LOJAS        — unidades da empresa (tabela lojas): {id,nome,cor,grupo,tecs}
// Ver "contexto da empresa" (definirEmpresaAtiva) mais abaixo.
let EMPRESA_ID = null;     // uuid da empresa ativa
let EMPRESA    = null;     // linha da tabela empresas (nome, slug, config, plano…)
let FLUXA_CONFIG = {
  appName: 'Fluxa',
  lojaPadrao: '',
  todasLabel: 'Todas',
  grupoPrincipal: [],
  flags: {},
  lojas: []
};

let LOJAS = FLUXA_CONFIG.lojas;          // unidades da empresa (preenchido no contexto da empresa)
let GRUPO_PRINCIPAL = FLUXA_CONFIG.grupoPrincipal; // ids das unidades vistas juntas em "Todas"
let LOJA_PADRAO_ID = FLUXA_CONFIG.lojaPadrao;      // unidade padrão — fallback em todo o app
let MUNICIPIOS_FISCAIS = []; // municípios atendidos p/ fins de ISS (setup-v2-delta23.sql) — lazy-load ao abrir o form de orçamento
try{ document.title = FLUXA_CONFIG.appName || 'Fluxa'; }catch(e){ console.warn('[appName]', e?.message||e); }

// ── FEATURE FLAGS por empresa (rollout gradual / kill switch sem deploy) ──
// Lê empresas.config.flags (ex.: {"flags":{"beta_estoque":true}}). Features grandes/
// arriscadas nascem atrás de flag: ativa 1º na empresa de teste, depois para todas;
// bug = desligar a flag no banco (empresas.config.flags), sem novo deploy.
function flagAtiva(nome){
  try{ return !!(FLUXA_CONFIG.flags && FLUXA_CONFIG.flags[nome]); }
  catch(e){ console.warn('[flagAtiva]', e?.message||e); return false; }
}

let lojaAtiva = ''; // '' = todas do grupo; string = empresa específica
// Empresa escolhida pelo técnico no login ('forthemp' | 'aquamotor').
// Técnico atende as duas empresas, mas escolhe uma por sessão p/ não misturar vistorias.
let visEmpresaTecnico = '';

// Retorna true só para o gestor principal da Forthemp (sem loja fixa na sessão)
function isMainGestor(){ const s=getSessao(); return (s?.perfil==='gestor'||s?.perfil==='master')&&!s?.loja_id; }

// ── ACESSO POR GRUPO (empresas separadas) ──
// Grupos não listados em FLUXA_CONFIG.acessoGrupo são abertos a todos. A Aquamotor
// é restrita aos nomes da lista (ex.: Marcos e Tamara).
function _normNome(s){ return (s||'').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function _nomeUsuarioAtual(){ return getSessao()?.nome || (typeof loginUserSelecionado!=='undefined' && loginUserSelecionado?.nome) || ''; }
function podeAcessarGrupo(grupo, nome){
  const lista=(FLUXA_CONFIG.acessoGrupo||{})[grupo];
  if(!lista||!lista.length) return true; // grupo aberto a todos
  const n=_normNome(nome!==undefined?nome:_nomeUsuarioAtual());
  return lista.map(_normNome).includes(n);
}

// Filtra lista pelo contexto de loja/grupo ativo
function filtrarPorLoja(lista, campo='loja_id'){
  if(lojaAtiva){
    // Loja específica selecionada → mostra SOMENTE os registros daquela loja.
    // Registros sem loja_id (legados/órfãos) NÃO entram aqui — apareciam nas duas
    // lojas Forthemp ao mesmo tempo e bagunçavam os totais. Eles só aparecem na
    // visão "Todas". Registros novos sempre recebem loja_id, então isto só afeta
    // dados antigos.
    return lista.filter(o=>(o[campo]||'')===lojaAtiva);
  }
  if(isMainGestor()) return lista.filter(o=>GRUPO_PRINCIPAL.includes(o[campo])||!o[campo]);
  // company gestor ou técnico — lojaAtiva já está definido na sua empresa
  return lista;
}

function getLoja(id){ return LOJAS.find(l=>l.id===id)||null; }
function getLojaNome(id){ return getLoja(id)?.nome || id || '—'; }
function getLojaBadge(id){
  const l=getLoja(id); if(!l) return '';
  return `<span class="loja-badge ${l.cor}">${l.nome}</span>`;
}
// Emoji por origem do lead (captação)
const ORIGEM_EMOJI={'Já é cliente':'✅','Indicação':'🗣️','Anúncio Google':'🔎','Instagram / Facebook':'📱','WhatsApp direto':'💬','Passou na loja / Fachada':'🏪','Parceiro / Construtora':'🤝'};
function getOrigemBadge(origem){
  if(!origem) return '';
  const emoji=ORIGEM_EMOJI[origem]||'✏️';
  return `<span class="origem-badge" title="Origem do cliente">${emoji} ${esc(origem)}</span>`;
}

// Preenche o <select> do header com todas as lojas (gestor principal vê tudo)
function populaLojaSelect(){
  const sel=document.getElementById('hdr-loja-select'); if(!sel) return;
  const principais=LOJAS.filter(l=>GRUPO_PRINCIPAL.includes(l.id));
  // Empresas separadas (ex.: Aquamotor) só entram se o usuário tiver acesso ao grupo
  const outros=LOJAS.filter(l=>!GRUPO_PRINCIPAL.includes(l.id) && podeAcessarGrupo(l.grupo));
  sel.innerHTML=
    `<option value="">${esc(FLUXA_CONFIG.todasLabel||'Todas')}</option>`+
    principais.map(l=>`<option value="${l.id}">${esc(l.nome)}</option>`).join('')+
    (outros.length?'<option disabled>──────────</option>'+outros.map(l=>`<option value="${l.id}">${esc(l.nome)}</option>`).join(''):'');
  sel.value=lojaAtiva;
}
// Preenche os <select> de empresa dos formulários (orçamento, OS, usuários) a
// partir das lojas configuradas — antes eram options chumbadas no HTML.
function popularSelectsLojaForm(){
  const opts=LOJAS.map(l=>`<option value="${l.id}">${esc(l.nome)}</option>`).join('');
  const orc=document.getElementById('orc-loja'); if(orc){ const v=orc.value; orc.innerHTML=opts; orc.value=v||LOJA_PADRAO_ID; }
  const os=document.getElementById('os-loja');  if(os){ const v=os.value;  os.innerHTML=opts;  os.value=v||LOJA_PADRAO_ID; }
  const usr=document.getElementById('usr-loja-id'); if(usr){ const v=usr.value; usr.innerHTML='<option value="">— Selecione —</option>'+opts; usr.value=v; }
}

function trocarLojaAtiva(id){
  // Defesa: não deixa entrar em empresa separada sem acesso (ex.: Aquamotor)
  const _lojaAlvo=getLoja(id);
  if(_lojaAlvo && !podeAcessarGrupo(_lojaAlvo.grupo)){ toast('⚠️ Você não tem acesso a esta empresa'); return; }
  lojaAtiva=id;
  sessionStorage.setItem('fluxa_loja_ativa', id||'');
  _invalidarSaldoCache(); // cache de saldos depende de lojaAtiva — deve ser limpo a cada troca
  atualizarHeaderLoja();
  // Re-renderiza a página atual
  const paginaAtiva=document.querySelector('.page.on');
  if(!paginaAtiva) return;
  const pid=paginaAtiva.id.replace('page-','');
  if(pid==='history') { initOrcMes(); atualizarDash(); renderTabela(); renderGraficoDash(); }
  else if(pid==='os-history') renderOSTabela();
  else if(pid==='clientes') renderClientes();
  else if(pid==='despesas') renderDespesas();
  else if(pid==='produtividade') loadProdutividade();
  else if(pid==='agendamentos'){ renderAgLista(); renderCal(); }
  else if(pid==='estoque') renderEstoque();
  else if(pid==='auditoria') renderAuditoria();
  else if(pid==='visitas'){ renderLocaisTab(); renderVisHistorico(); } // faltava — trocar empresa não atualizava as Vistorias
}

function atualizarHeaderLoja(){
  if(_estaPreLogin()){ resetMarcaSaaS(); return; } // pré-login = marca neutra do produto
  const LC = getLojaConfig(lojaAtiva);
  document.documentElement.style.setProperty('--c1', LC.cor||CFG.cor);
  document.documentElement.style.setProperty('--c1-light', hexA(LC.cor||CFG.cor, .1));
  document.documentElement.style.setProperty('--c1-mid',  hexA(LC.cor||CFG.cor, .2));
  document.documentElement.style.setProperty('--c2', LC.cor2||CFG.cor2);
  const hNome=document.getElementById('hdr-nome');
  const hSub =document.getElementById('hdr-sub');
  if(hNome) hNome.textContent = LC.nome||CFG.nome||'';
  if(hSub)  hSub.textContent  = LC.sub ||CFG.sub ||'Serviços';
  const img=document.getElementById('hdr-logo-img');
  if(img){
    img.alt = LC.nome||CFG.nome||'Logo';
    if(LC.logoB64){ img.src=LC.logoB64; img.classList.add('has-logo'); }
    else { img.classList.remove('has-logo'); }
  }
  // Sidebar (redesign 15/08) — mesmo nome/sub do header; logo só iniciais
  // (sidebar não tem espaço pra imagem de logo, diferente do header).
  const snNome=document.getElementById('snav-brand-nome');
  const snSub =document.getElementById('snav-brand-sub');
  const snLogo=document.getElementById('snav-logo');
  if(snNome) snNome.textContent = LC.nome||CFG.nome||'';
  if(snSub)  snSub.textContent  = LC.sub ||CFG.sub ||'Serviços';
  if(snLogo) snLogo.textContent = (LC.nome||CFG.nome||'F').charAt(0).toUpperCase();
  document.title=(LC.nome||CFG.nome||'Fluxa')+' — Orçamentos';
}

// Atualiza o select de técnicos de acordo com a loja selecionada no form
function atualizarTecsPorLoja(lojaId, selectId){
  const sel=document.getElementById(selectId); if(!sel) return;
  const loja=getLoja(lojaId);
  const tecs=(loja?loja.tecs:getTecnicos())||[];
  const atual=sel.value;
  const opts=tecs.map(t=>`<option value="${t}"${t===atual?' selected':''}>${t}</option>`).join('');
  // mantém opção vazia se não houver seleção
  sel.innerHTML='<option value="">Selecione…</option>'+opts;
  if(tecs.includes(atual)) sel.value=atual;
}

// ══════════════════════════════════════════════════
//  USUÁRIOS — tabela `usuarios` no Supabase
// ══════════════════════════════════════════════════
let todosUsuarios = [];

// Pré-cadastra os 4 técnicos na primeira vez que o app abre
function seedTecnicosIniciais(){
  // v2 multi-tenant: sem técnicos padrão chumbados. Cada empresa cria os seus na
  // tela Usuários; o gestor entra pela conta (Auth) + vínculo membros. Apenas
  // carrega o que já houver em cache.
  try{ todosUsuarios=JSON.parse(ls('fluxa_usuarios')||'[]'); }catch(e){ todosUsuarios=[]; }
}

async function sincronizarSeedUsuarios(){
  // v2: não há seed de técnicos padrão para sincronizar (ver seedTecnicosIniciais).
  return;
}

async function carregarUsuarios(){
  // Carrega do localStorage primeiro
  let local=[];
  try{ local=JSON.parse(ls('fluxa_usuarios')||'[]'); }catch(e){}
  // Tenta carregar do Supabase e faz merge
  try{
    if(dbOk&&db){
      // usuarios_lista (view): nunca traz o hash de PIN pro navegador (achado de
      // segurança — ver verificar_pin_interno). Expõe tem_pin em vez do valor.
      const {data}=await db.from('usuarios_lista').select('*').eq('empresa_id',EMPRESA_ID).eq('ativo',true).order('nome');
      if(data){
        // Registros locais temporários (usr_xxx) não presentes no Supabase
        const locaisNaoSincronizados=local.filter(u=>
          String(u.id).startsWith('usr_') &&
          !data.find(d=>d.nome===u.nome && d.perfil===u.perfil)
        );
        for(const u of locaisNaoSincronizados){
          try{
            const payload={id:u.id,nome:u.nome,perfil:u.perfil,loja_id:u.loja_id||null,loja_nome:u.loja_nome||null,pin:u.pin||null,ativo:true};
            // id EXPLÍCITO (usuarios.id é text sem default) + select sem 'pin' (o insert
            // grava o hash, mas não traz de volta pro navegador — achado de segurança).
            const {data:ins}=await dbInsert('usuarios', payload, 'id,empresa_id,nome,perfil,loja_id,loja_nome,ativo,data_criacao');
            if(ins) data.push(ins);   // sincronizado → usa registro do banco
            else    data.push(u);     // insert sem retorno → mantém local
          }catch(e2){
            data.push(u);             // insert falhou → mantém local
          }
        }
        todosUsuarios=data;
        lsSet('fluxa_usuarios',JSON.stringify(data));
        return;
      }
    }
  }catch(e){}
  todosUsuarios=local;
}

// ── Renderiza botão de usuário no login (layout horizontal) ──
// slim=true → sem badge e sem seta (usado nos técnicos)

function atualizarDotsPIN(val){
  // No novo formulário não há dots visuais — apenas foco automático ao completar 4 dígitos
  if(val && val.length === 4) setTimeout(fazerLogin, 80);
}


// Lista interna para autocomplete; preenchida por renderLoginUsers
let _loginUsersCache = [];

function renderLoginUsers(){
  // Reconstrói cache de usuários para o autocomplete do formulário de login
  _loginUsersCache = todosUsuarios.filter(u=>u.ativo!==false);
  // Adiciona gestor legado se não houver master/gestor individual
  const temIndividual = _loginUsersCache.some(u=>u.perfil==='master'||u.perfil==='gestor');
  if(!temIndividual) _loginUsersCache.push({id:'__gestor__',nome:'Gestor',perfil:'gestor',loja_id:null,loja_nome:null,pin:null});
  // Atualiza sugestões se o input já tem texto
  const inp = document.getElementById('login-nome-input');
  if(inp && inp.value.trim()) loginNomeInput(inp.value);
}

function loginNomeInput(val){
  const box = document.getElementById('login-nome-sugestoes'); if(!box) return;
  loginUserSelecionado = null; // reset ao digitar
  const q = val.trim().toLowerCase();
  if(q.length < 2){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = _loginUsersCache.filter(u=>u.nome.toLowerCase().includes(q)).slice(0,6);
  if(!matches.length){ box.style.display='none'; box.innerHTML=''; return; }
  const perfilEmoji={master:'👑',gestor:'🛡️',vendas:'💼',tecnico:'🔧'};
  box.innerHTML = matches.map(u=>`
    <button type="button" onclick="loginEscolherSugestao('${u.id}')"
      style="display:flex;align-items:center;gap:10px;width:100%;padding:9px 14px;border:none;background:none;cursor:pointer;text-align:left;transition:background .1s"
      onmouseenter="this.style.background='var(--c1-bg)'" onmouseleave="this.style.background='none'">
      <span style="font-size:16px">${perfilEmoji[u.perfil]||'🔧'}</span>
      <span style="font-size:14px;font-weight:600;color:var(--c2)">${esc(u.nome)}</span>
      <span style="font-size:12px;color:var(--gray);margin-left:auto">${u.loja_nome||''}</span>
    </button>`).join('');
  box.style.display='block';
}

function loginEscolherSugestao(id){
  const u = _loginUsersCache.find(x=>x.id===id); if(!u) return;
  loginUserSelecionado = {id:u.id, perfil:u.perfil, nome:u.nome, loja_id:u.loja_id, auth_ver:u.auth_ver};
  const inp = document.getElementById('login-nome-input');
  if(inp) inp.value = u.nome;
  const box = document.getElementById('login-nome-sugestoes');
  if(box){ box.style.display='none'; box.innerHTML=''; }
  document.getElementById('login-err').textContent='';
  setTimeout(()=>document.getElementById('pin-input').focus(), 80);
}

let loginUserSelecionado = null; // {id, perfil, nome, loja_id}

function selecionarUserLogin(btn, id, perfil, nome, lojaId){
  // Mantido para compatibilidade — novo fluxo usa loginEscolherSugestao
  loginUserSelecionado={id,perfil,nome,loja_id:lojaId};
  const inp=document.getElementById('login-nome-input');
  if(inp) inp.value=nome;
  const box=document.getElementById('login-nome-sugestoes');
  if(box){ box.style.display='none'; box.innerHTML=''; }
  document.getElementById('login-err').textContent='';
  setTimeout(()=>document.getElementById('pin-input').focus(),80);
}

// ── Segurança: hash + lockout ──────────────────────
const PIN_SALT = 'fluxa2025';
// Cache de objetos para botões de notificação (evita JSON no DOM)
const _nc = {};
function getNC(id){ return _nc[id]||{}; }
const LS_LOCKOUT_KEY = 'fluxa_login_lockout';
const LS_ATTEMPTS_KEY = 'fluxa_login_attempts';
// Lê do localStorage para persistir entre recarregamentos (anti-brute-force)
let loginAttempts = parseInt(localStorage.getItem(LS_ATTEMPTS_KEY)||'0', 10);
let loginLockedUntil = parseInt(localStorage.getItem(LS_LOCKOUT_KEY)||'0', 10);
let lockoutTimer = null;

async function hashPIN(pin){
  if(!pin) return null;
  try{
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin + PIN_SALT));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){ return pin; }
}

// v2: pinValido() (comparação local de hash) foi removida — achado de segurança.
// A verificação agora roda inteiramente no servidor via rpc('verificar_pin_interno'),
// que nunca expõe o hash pro navegador. Ver fazerLogin().

function iniciarCountdownLockout(){
  if(lockoutTimer) clearInterval(lockoutTimer);
  lockoutTimer = setInterval(()=>{
    const resto = loginLockedUntil - Date.now();
    if(resto <= 0){
      clearInterval(lockoutTimer); lockoutTimer = null;
      const e = document.getElementById('login-err'); if(e) e.textContent='';
    } else {
      const e = document.getElementById('login-err');
      if(e) e.textContent = `Muitas tentativas. Aguarde ${Math.ceil(resto/1000)}s.`;
    }
  }, 500);
}

async function fazerLogin(){
  const err = document.getElementById('login-err');
  if(Date.now() < loginLockedUntil){ return; }

  // Resolve usuário: sugestão clicada OU busca pelo nome digitado
  if(!loginUserSelecionado){
    const nomeDigitado = (document.getElementById('login-nome-input')?.value||'').trim().toLowerCase();
    if(!nomeDigitado){ err.textContent='Digite seu nome.'; return; }
    const encontrados = _loginUsersCache.filter(u=>u.nome.toLowerCase()===nomeDigitado);
    if(!encontrados.length){ err.textContent='Nome não encontrado. Verifique ou selecione da lista.'; return; }
    if(encontrados.length > 1){ err.textContent='Nome ambíguo — selecione da lista.'; return; }
    const u = encontrados[0];
    loginUserSelecionado = {id:u.id, perfil:u.perfil, nome:u.nome, loja_id:u.loja_id, auth_ver:u.auth_ver};
  }

  const pin = document.getElementById('pin-input').value;
  if(!pin || pin.length < 4){ err.textContent='Digite os 4 dígitos da senha.'; return; }

  // Verificação de PIN roda no SERVIDOR (verificar_pin_interno) — o hash nunca é
  // baixado pro navegador (achado de segurança: salt fixo tornava qualquer PIN do
  // sistema reversível instantaneamente a partir do hash, se ele estivesse aqui).
  // Efeito colateral aceito: trocar de perfil por PIN passa a exigir conexão.
  let pinCorreto = false;
  if(!db || !EMPRESA_ID){
    err.textContent='Sem conexão — tente novamente com internet.';
    return;
  }
  try{
    if(_authPerfilAtivo() && loginUserSelecionado.id !== '__gestor__'){
      // Opção A: autentica o funcionário na conta PRÓPRIA (RLS por perfil vale de verdade)
      pinCorreto = await _loginRealFuncionario(loginUserSelecionado.id, pin, loginUserSelecionado.auth_ver);
    } else {
      // Fluxo atual: valida o PIN no servidor sob a sessão do dono (persona só na UI)
      const usuarioIdParaCheck = loginUserSelecionado.id==='__gestor__' ? null : loginUserSelecionado.id;
      const { data, error } = await db.rpc('verificar_pin_interno', { p_empresa: EMPRESA_ID, p_usuario_id: usuarioIdParaCheck, p_pin_tentado: pin });
      if(error) throw error;
      pinCorreto = !!data;
    }
  }catch(e){
    console.warn('[fazerLogin]', e?.message||e);
    err.textContent='Não foi possível verificar agora. Tente novamente.';
    return;
  }

  if(pinCorreto){
    loginAttempts = 0; loginLockedUntil = 0;
    localStorage.removeItem(LS_LOCKOUT_KEY); localStorage.removeItem(LS_ATTEMPTS_KEY);
    err.textContent = '';
    if(loginUserSelecionado.id === '__gestor__'){
      // Gestor principal da Forthemp → escolhe qual unidade gerenciar
      document.getElementById('login-step-pin').classList.remove('show');
      mostrarSelecaoLojaGestor();
    } else if((loginUserSelecionado.perfil==='master'||loginUserSelecionado.perfil==='gestor') && !loginUserSelecionado.loja_id){
      // Master/gestor geral → escolhe a empresa (Forthemp todas/unidade ou Aquamotor)
      // Era aqui que o Marcos caía direto em "Todas" sem ver a opção da Aquamotor.
      document.getElementById('login-step-pin').classList.remove('show');
      mostrarSelecaoLojaGestor();
    } else if(loginUserSelecionado.perfil === 'gestor' && loginUserSelecionado.loja_id){
      // Gestor de empresa específica (ex: Acquamotor) → entra direto na sua empresa
      lojaAtiva = loginUserSelecionado.loja_id;
      sessionStorage.setItem('fluxa_loja_ativa', lojaAtiva);
      const sessao = {perfil:'gestor', loja_id:loginUserSelecionado.loja_id, nome:loginUserSelecionado.nome};
      setSessao(sessao);
      document.getElementById('login-overlay').style.display = 'none';
      atualizarBadgeUsuario();
      aplicarPermissoesPerfil();
      atualizarHeaderLoja();
      logAcao('login', loginUserSelecionado.nome+' (gestor '+(getLojaNome(loginUserSelecionado.loja_id))+')');
      go('painel');
    } else if(loginUserSelecionado.perfil==='tecnico' && !loginUserSelecionado.loja_id){
      // Técnico que atende mais de uma empresa → escolhe a empresa da sessão
      document.getElementById('login-step-pin').classList.remove('show');
      mostrarSelecaoEmpresaTecnico();
    } else {
      // Técnico de empresa fixa / Vendas → lojaAtiva = sua empresa
      lojaAtiva = loginUserSelecionado.loja_id || '';
      const sessao = {perfil:loginUserSelecionado.perfil, loja_id:loginUserSelecionado.loja_id, nome:loginUserSelecionado.nome};
      setSessao(sessao);
      document.getElementById('login-overlay').style.display = 'none';
      atualizarBadgeUsuario();
      aplicarPermissoesPerfil();
      atualizarHeaderLoja();
      logAcao('login', loginUserSelecionado.nome+' ('+sessao.perfil+')');
      // Destino inicial explícito por perfil
      if(sessao.perfil==='tecnico') go('minhas-os');
      else if(sessao.perfil==='vendas') go('form');
    }
  } else {
    loginAttempts++;
    localStorage.setItem(LS_ATTEMPTS_KEY, loginAttempts);
    if(loginAttempts >= 3){
      loginLockedUntil = Date.now() + 30000;
      loginAttempts = 0;
      localStorage.setItem(LS_LOCKOUT_KEY, loginLockedUntil);
      localStorage.removeItem(LS_ATTEMPTS_KEY);
      iniciarCountdownLockout();
    } else {
      err.textContent = `PIN incorreto. ${3 - loginAttempts} tentativa(s) restante(s).`;
    }
    document.getElementById('pin-input').value = '';
    atualizarDotsPIN('');
    document.getElementById('pin-input').focus();
  }
}

// v2: gestor sem loja fixa escolhe a unidade a gerenciar (ou "Todas"). As unidades
// vêm da tabela lojas da empresa ativa — nada de empresa chumbada. Com <=1 unidade,
// entra direto em "Todas".
function mostrarSelecaoLojaGestor(){
  const list=document.getElementById('login-loja-list');
  if((LOJAS||[]).length<=1){ confirmarLojaGestor(''); return; }
  function lojaBtn(id, cor, icon, nome, sub){
    return `<button class="login-loja-btn" onclick="confirmarLojaGestor('${id}')">
      <div class="login-loja-circle" style="background:${cor}">${icon}</div>
      <div>
        <div class="login-loja-info-nome">${nome}</div>
        <div class="login-loja-info-sub">${sub}</div>
      </div>
    </button>`;
  }
  let html = lojaBtn('','var(--c1)','📊','Todas as unidades', esc(FLUXA_CONFIG.todasLabel||'Consolidado'));
  LOJAS.forEach(l=>{
    html += lojaBtn(l.id,'var(--c2)',(l.nome||'?').charAt(0),esc(l.nome||'Unidade'),'Gerenciar esta unidade');
  });
  list.innerHTML = html;
  document.getElementById('login-step-users').style.display='none';
  document.getElementById('login-step-loja').classList.add('show');
}

function confirmarLojaGestor(lojaId){
  lojaAtiva=lojaId;
  sessionStorage.setItem('fluxa_loja_ativa', lojaId||'');
  const loja=getLoja(lojaId);
  // Preserva perfil/nome reais do usuário (ex.: Marcos master); só o PIN genérico
  // "__gestor__" vira "Gestor <unidade>".
  const u=loginUserSelecionado;
  const ehReal=u&&u.id&&u.id!=='__gestor__';
  const perfil=ehReal&&u.perfil?u.perfil:'gestor';
  const nome=ehReal&&u.nome?u.nome:(loja?'Gestor '+loja.nome:'Gestor');
  const sessao={perfil,loja_id:null,nome};
  setSessao(sessao);
  document.getElementById('login-overlay').style.display='none';
  document.getElementById('login-step-loja').classList.remove('show');
  atualizarBadgeUsuario();
  aplicarPermissoesPerfil();
  atualizarHeaderLoja();
  go('painel');
}

// v2: o técnico pertence a UMA empresa (tenant) — não há escolha de empresa no login
// (o modelo forthemp/aquamotor era do v1, quando 3 empresas dividiam o banco). Segue
// direto para o app.
function mostrarSelecaoEmpresaTecnico(){
  confirmarEmpresaTecnico('');
}

function confirmarEmpresaTecnico(grupo){
  visEmpresaTecnico = grupo||'';
  lojaAtiva = '';
  sessionStorage.setItem('fluxa_loja_ativa', '');
  sessionStorage.setItem('fluxa_vis_empresa_tec', visEmpresaTecnico);
  const sessao={perfil:'tecnico', loja_id:loginUserSelecionado.loja_id||null, nome:loginUserSelecionado.nome, empresa_tec:visEmpresaTecnico};
  setSessao(sessao);
  document.getElementById('login-overlay').style.display='none';
  document.getElementById('login-step-loja').classList.remove('show');
  atualizarBadgeUsuario();
  aplicarPermissoesPerfil();
  atualizarHeaderLoja();
  logAcao('login', loginUserSelecionado.nome+' (técnico)');
  go('minhas-os');
}

function voltarParaPin(){
  document.getElementById('login-step-loja').classList.remove('show');
  document.getElementById('login-step-users').style.display='';
  const inp=document.getElementById('pin-input'); if(inp){ inp.value=''; }
  document.getElementById('login-err').textContent='';
  setTimeout(()=>{ const ni=document.getElementById('login-nome-input'); if(ni) ni.focus(); },100);
}


// ══════════════════════════════════════════════════
//  CFG — configurações da empresa (white-label)
// ══════════════════════════════════════════════════
const CFG_DEF = {
  nome:'Minha Empresa', sub:'Serviços', tel:'', whatsapp:'', cidades:'',
  tagline:'', cor:'#C45E0A', cor2:'#2B3244', logoB64:'', segmento:'geral',
  svcs:['Serviço 1','Serviço 2','Serviço 3'], pin:'1234',
  // v2 multi-tenant: SEM técnicos padrão chumbados (ver seedTecnicosIniciais) —
  // cada empresa cadastra os seus na tela Usuários. Esses 4 nomes eram da
  // Fluxa (piloto) e vazavam pra QUALQUER empresa nova criada no sistema até
  // o gestor perceber e trocar — achado de auditoria 2026-07-20.
  tecnicos:[],
  notif_visita: 'Olá, {nome}! 👋\n\nLembramos que amanhã teremos nossa visita técnica agendada.\n\n⏰ Horário: {hora}\n👤 Técnico: {tecnico}\n🔧 Serviço: {servico}\n\nQualquer dúvida estamos à disposição!\n\n*{empresa}*\n📞 {tel_empresa}',
  notif_concluida: 'Olá, {nome}! ✅\n\nO serviço foi concluído com sucesso!\n\n🔧 Serviço: {servico}\n👤 Técnico: {tecnico}\n\nAcesse seu portal para ver o histórico completo:\n{link_portal}\n\n*{empresa}*\n📞 {tel_empresa}',
  notif_orcamento: 'Olá, {nome}! 📋\n\nPreparamos um orçamento especial para você:\n\n🔧 Serviços: {servico}\n💰 Valor Total: {valor}\n\nAcesse seu portal para aprovar ou recusar:\n{link_portal}\n\nO orçamento é válido por 5 dias. Qualquer dúvida é só falar!\n\n*{empresa}*\n📞 {tel_empresa}',
  notif_garantia: 'Olá, {nome}! ⚠️\n\nA garantia do seu equipamento está vencendo em breve.\n\n🔧 Equipamento: {servico}\n\nEntre em contato para verificarmos a situação!\n\n*{empresa}*\n📞 {tel_empresa}',
  // v2: SEM chaves EmailJS chumbadas. Cada empresa configura as suas em Empresa →
  // E-mail Automático; ficam em empresas.config.emailjs = {pubkey, service, template}.
  emailjs: {}
};
let CFG = { ...CFG_DEF };
// Lê a config EmailJS da empresa (nested empresas.config.emailjs), com fallback às
// chaves planas legadas. Nunca há default no código.
function _ejsCfg(){
  const e = CFG.emailjs || {};
  return {
    pubkey:   e.pubkey   || CFG.emailjs_pubkey   || '',
    service:  e.service  || CFG.emailjs_service  || '',
    template: e.template || CFG.emailjs_template || '',
    reply_to: e.reply_to || CFG.emailjs_reply_to || ''
  };
}
let lojasExtraConfig = {}; // { lojaId: { nome, sub, logoB64, tel, cidades, cor, cor2, tagline } }
let db = null, dbOk = false;
let svcs = [], editId = null;
let osSvcs = [], modalOrcId = null, osOrcId = null; // osOrcId = ID do orçamento vinculado à OS
let todosOrc = [], filtroSt = localStorage.getItem('fluxa_filtroSt')||'todos', busca = '';
let _orcPagina = 1; // paginação client-side da lista já carregada (16/08, portado do v1) — 25/página
let todosOS = [], filtroOSSt = localStorage.getItem('fluxa_filtroOSSt')||'todos', buscaOS = '', filtroOSTec = '';
// Paginação do histórico (achado de auditoria 2026-07-20): loadHist()/loadOSHist()
// baixavam a tabela INTEIRA do banco toda vez que a tela abria — ok pra empresa
// nova, mas cresce sem limite pra sempre com o tempo. _PAGE define o tamanho do
// lote inicial/de cada "carregar mais"; _servidorOffset conta só as linhas vindas
// do SERVIDOR carregadas até agora (registros locais/pendentes não contam, pra
// não bagunçar o cálculo do próximo lote); _temMais indica se o último lote veio
// cheio (heurística: lote cheio = pode ter mais; sem fazer um COUNT(*) à parte).
const _ORC_PAGE = 300, _OS_PAGE = 300;
let _orcServidorOffset = 0, _orcTemMais = false;
let _osServidorOffset = 0, _osTemMais = false;
let osEditId = null; // id da OS sendo editada (null = nova) — evita duplicar ao salvar
let filtroPeriodo = ''; // legado — não mais usado na tabela principal
let orcMesRef = ''; // YYYY-MM ou '' = todos os períodos
// Dois grids independentes: o relatório pro cliente destaca antes/depois, e
// isso só funciona se a captura já separar na hora — exigir que o técnico
// etiquete cada foto depois não sobrevive ao uso em campo.
let osFotosAntes = [];
let osFotosDepois = [];
let printMode = ''; // 'orc' | 'os' | 'both'

// ── Checklist OS ──
const OS_CHECKLIST_DEFAULT = [
  {id:1, nome:'Serviço executado conforme solicitado',    checked:false, obs:''},
  {id:2, nome:'Equipamentos testados após o serviço',     checked:false, obs:''},
  {id:3, nome:'Materiais e ferramentas recolhidos',       checked:false, obs:''},
  {id:4, nome:'Local limpo e organizado ao término',      checked:false, obs:''},
  {id:5, nome:'Cliente informado sobre o que foi feito',  checked:false, obs:''},
];
let osChecklist = OS_CHECKLIST_DEFAULT.map(x=>({...x}));

// ── Gráfico dashboard ──
let _dashChart = null;

// ── Assinatura ──
let _sigDrawing = false, _sigHasMark = false;

// ══════════════════════════════════════════════════
//  PERSISTÊNCIA LOCAL — localStorage é fonte primária
// ══════════════════════════════════════════════════
const LS_ORC = 'fluxa_orc_data';
function lsOrcLer(){ try{ return JSON.parse(ls(LS_ORC)||'[]'); }catch(e){ return []; } }
function lsOrcSalvar(lista){ lsSet(LS_ORC, JSON.stringify(lista)); }
function lsOrcUpsert(rec){
  const lista=lsOrcLer(), idx=lista.findIndex(x=>x.id===rec.id);
  if(idx>=0) lista[idx]={...lista[idx],...rec}; else lista.unshift(rec);
  lsOrcSalvar(lista);
}
function lsOrcAtualizar(id, changes){
  const lista=lsOrcLer(), idx=lista.findIndex(x=>x.id===id);
  if(idx>=0){ lista[idx]={...lista[idx],...changes}; lsOrcSalvar(lista); }
}
function lsOrcRemover(id){ lsOrcSalvar(lsOrcLer().filter(x=>x.id!==id)); }
function lsOrcProxNum(){ return lsOrcLer().reduce((a,o)=>Math.max(a,o.numero||0),0)+1; }

// ──────────────────────────────────────────────────
//  BOOT
// ──────────────────────────────────────────────────
;(async () => {
  // Define EMPRESA_ID cedo (chave global, sem prefixo) para que o cache lido a
  // seguir (empresa_cfg, lojas, orçamentos…) use o namespace da empresa certa.
  EMPRESA_ID = localStorage.getItem('fluxa_empresa_id') || null;
  carregarCFGlocal();
  aplicarCFG();
  initEmailJS(); // inicializa EmailJS com chave local se configurada

  const isPortal = await checkPortalHash();
  if(isPortal) return;

  injetarPWA();
  initForm();
  todosOrc = lsOrcLer();
  // CFG local já foi carregado por carregarCFGlocal() — inicializa lojas_extra a partir dele
  loadLojasExtraConfig();

  // ── Seed técnicos iniciais (roda 1x se não houver usuários) ──
  seedTecnicosIniciais();

  // ── Restaura o contexto da empresa do cache (offline após login) ──
  // Online, definirEmpresaAtiva() sobrescreve com dados frescos do banco.
  restaurarContextoCache();

  // ── Cliente Supabase (uma vez) + gate de sessão de CONTA (Auth) ──
  criarClienteSupabase();
  const temCreds = !!db;
  let authSession = null;
  if(temCreds){
    try{ const { data } = await db.auth.getSession(); authSession = data?.session || null; }
    catch(e){ console.warn('[getSession]', e?.message||e); }
    authUser = authSession?.user || null;
    // Reage a login/logout (inclusive em outra aba) + recuperação de senha
    try{ db.auth.onAuthStateChange((_ev, s)=>{ authUser = s?.user || null; if(_ev==='PASSWORD_RECOVERY') mostrarTelaRecuperar(); }); }catch(e){ console.warn('[onAuthStateChange]', e?.message||e); }
  }

  // Recuperação de senha: o link do e-mail traz o token de recovery no hash. Mostra o
  // form de NOVA SENHA antes de qualquer auto-login (a sessão de recovery é temporária).
  if(temCreds && /type=recovery|recuperar/i.test(location.hash||'')){
    mostrarTelaRecuperar();
    return;
  }

  // Páginas legais (públicas): mostra o overlay POR CIMA e deixa o boot seguir
  // (ao fechar, cai na tela normal). Sem early return.
  if(/^#(termos|privacidade)$/.test(location.hash||'')){ try{ abrirLegal(location.hash.replace('#','')); }catch(e){} }

  // Bloqueio biométrico (Sprint 2, opt-in) — só entra em cena se este aparelho
  // já tem uma credencial WebAuthn registrada pra esse authUser E ainda não
  // passamos pelo desbloqueio nesta aba (sessionStorage — some ao fechar,
  // então todo cold-start pede de novo, mas um F5 no meio da sessão não).
  // Sem credencial registrada = zero mudança de comportamento (segue direto).
  if(authUser && !getSessao() && !sessionStorage.getItem('fluxa_webauthn_ok')
     && typeof fluxaTemCredencialBiometrica==='function' && fluxaTemCredencialBiometrica(authUser.id)){
    if(typeof mostrarTelaBloqueioBiometrico==='function'){ mostrarTelaBloqueioBiometrico(); return; }
  }

  let modoAdminPlataforma = false;
  let semSessaoDeConta = false;
  if(temCreds && !authSession){
    // Sem sessão de conta → tela de autenticação (login / criar empresa). Nada
    // de tenant deve rodar aqui (sem empresa, sem conectar/sincronizar banco) —
    // era isso que gerava "acesso restrito" e avisos de UUID nulo na tela de login.
    semSessaoDeConta = true;
    // Técnico no próprio aparelho (link #e/<slug> ou cache): mostra nome+PIN direto.
    // Senão, tela de conta (e-mail/senha) normal.
    if(!(await _bootstrapTecnico())) mostrarTelaAuth();
  } else {
    esconderTelaAuth();
    if(authUser){
      // Checa admin da plataforma ANTES de qualquer coisa de tenant. Uma conta
      // admin não é gestor de nenhuma empresa (por desenho) — se for admin, entra
      // numa tela TOTALMENTE separada e pula todo o boot de tenant abaixo.
      try{ await checarAdminPlataforma(); }catch(e){ console.warn('[checarAdminPlataforma]', e?.message||e); }
      if(isPlataformaAdmin){
        modoAdminPlataforma = true;
        entrarModoPlataforma();
      } else {
        try{ await definirEmpresaAtiva(); }catch(e){ console.warn('[definirEmpresaAtiva]', e?.message||e); }
      }
    }

    if(!modoAdminPlataforma){
      const sessaoExistente = getSessao();
      if(sessaoExistente){
        // Restaura unidade ativa: usuário de unidade específica usa loja_id da sessão;
        // gestor principal usa o valor salvo no sessionStorage (persiste em F5)
        if(sessaoExistente.loja_id) lojaAtiva = sessaoExistente.loja_id;
        else { const sal=sessionStorage.getItem('fluxa_loja_ativa'); if(sal) lojaAtiva=sal; }
        visEmpresaTecnico = sessaoExistente.empresa_tec || sessionStorage.getItem('fluxa_vis_empresa_tec') || '';
        document.getElementById('login-overlay').style.display='none';
        atualizarBadgeUsuario();
        aplicarPermissoesPerfil();
      } else if(authUser && await _autoLoginMembroDaConta()){
        // Sessão interna (sessionStorage) não sobrevive a fechar a aba, mas a
        // conta (Supabase Auth) sim — quem já provou quem é por e-mail+senha
        // entra direto como membro da empresa, sem PIN.
      } else {
        try{ todosUsuarios=JSON.parse(ls('fluxa_usuarios')||'[]'); }catch(e){ todosUsuarios=[]; }
        renderLoginUsers();
        document.getElementById('login-overlay').style.display='flex';
      }
    }
  }

  if(modoAdminPlataforma){ return; } // admin da plataforma: nada de tenant abaixo
  if(semSessaoDeConta){ return; } // sem sessão de conta: fica só na tela de login/cadastro

  // ── Credenciais do Supabase (ponto único: constantes SUPABASE_URL/ANON_KEY) ──
  const sbUrl = SUPABASE_URL;
  const sbKey = SUPABASE_ANON_KEY;
  // Destino inicial: gestor/master cai no Painel (visão geral do mês); vendas em
  // Orçamento; técnico já foi redirecionado pra Minhas OS por aplicarPermissoesPerfil
  // acima (e bloqueado aqui pelo próprio go(), que só aceita p in pagesTecnico).
  go(eGestor()?'painel':'form');

  async function tentarConectar(tentativa){
    try {
      const ok = await conectarDB(sbUrl, sbKey, false);
      if(ok){
        await carregarCFGremoto(); aplicarCFG(); initEmailJS();
        loadLojasExtraConfig();
        atualizarHeaderLoja(); // re-aplica após lojas_extra carregado do Supabase
        // Sincroniza select de loja no form de orçamento (pode estar desatualizado do boot)
        if(lojaAtiva && !editId) setV('orc-loja', lojaAtiva);
        loadLocais(); // carrega locais_vistoria que vieram no CFG (modo legado)
        loadLocaisRemoto(); // tabela dedicada (se existir) — fonte de verdade + auto-migração
        await carregarClientesRemoto();
        await sincronizarSeedUsuarios();
        await carregarUsuarios();
        loadVistoriasRemoto();
        renderLoginUsers(); // sempre atualiza lista de usuários após carregar do banco
        // Atualiza aba Locais se estiver aberta
        if(document.getElementById('vis-view-locais')?.style.display!=='none') renderLocaisTab();
      }
      else if(tentativa < 3) setTimeout(()=>tentarConectar(tentativa+1), tentativa===1?3000:15000);
    } catch(e) {
      console.warn('BD offline (tentativa '+tentativa+'):', e.message);
      if(tentativa < 3) setTimeout(()=>tentarConectar(tentativa+1), tentativa===1?3000:15000);
    }
  }
  tentarConectar(1);
  checkQRHash();
})();

// ──────────────────────────────────────────────────
//  M-09 — ATALHOS DE TECLADO (Ctrl+S, /)
// ──────────────────────────────────────────────────
document.addEventListener('keydown', function(e){
  // Ctrl+S / Cmd+S — salva o formulário ativo
  if((e.ctrlKey || e.metaKey) && e.key === 's'){
    e.preventDefault();
    const activePage = document.querySelector('.page.on');
    if(!activePage) return;
    const pid = activePage.id;
    if(pid === 'page-form') salvarApenas();
    else if(pid === 'page-os') { const btn=document.getElementById('btn-os-pdf'); if(btn) btn.click(); }
    else if(pid === 'page-empresa') salvarEmpresa();
    else if(pid === 'page-visitas') salvarVistoria();
  }
  // '/' — foca no campo de busca da página ativa
  if(e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'SELECT'){
    e.preventDefault();
    const activePage = document.querySelector('.page.on');
    if(!activePage) return;
    const srch = activePage.querySelector('.hsrch, input[type="search"]');
    if(srch) srch.focus();
  }
});

// ──────────────────────────────────────────────────
//  PWA
// ──────────────────────────────────────────────────
function injetarPWA() {
  const m = { name: CFG.nome, short_name: CFG.nome, start_url:'.', display:'standalone',
    background_color:'#f0f2f5', theme_color: CFG.cor,
    icons:[{src:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="'+encodeURIComponent(CFG.cor)+'"/><text y=".9em" font-size="80" x="10">🔧</text></svg>',sizes:'192x192',type:'image/svg+xml'}]
  };
  const b = new Blob([JSON.stringify(m)],{type:'application/manifest+json'});
  let l = document.querySelector('link[rel=manifest]');
  if (!l){ l=document.createElement('link'); l.rel='manifest'; document.head.appendChild(l); }
  l.href = URL.createObjectURL(b);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', CFG.cor);
}


// ──────────────────────────────────────────────────
//  CFG — carregar / salvar
// ──────────────────────────────────────────────────
function carregarCFGlocal(){
  try { const s=ls('empresa_cfg'); if(s) CFG={...CFG_DEF,...JSON.parse(s)}; } catch(e){}
  // Carrega lojasExtraConfig do cache dedicado (mais confiável que depender do CFG.lojas_extra)
  try {
    const cached=ls('fluxa_lojas_extra_cfg');
    if(cached){ const ex=JSON.parse(cached); if(ex&&Object.keys(ex).length) lojasExtraConfig=ex; }
  } catch(e){ console.warn('[carregarCFGlocal:extra]',e?.message||e); }
  // Merge com CFG.lojas_extra caso tenha dados mais recentes
  if(CFG.lojas_extra && Object.keys(CFG.lojas_extra).length){
    lojasExtraConfig={...lojasExtraConfig,...CFG.lojas_extra};
  }
}
// v2: a config vive em empresas.config (jsonb). Recarrega a linha da empresa ativa
// e reaplica o contexto. (Antes lia a tabela empresa_config, que não existe mais.)
async function carregarCFGremoto(){
  if(!dbOk||!db||!EMPRESA_ID) return;
  try{
    const {data,error} = await db.from('empresas').select('*').eq('id',EMPRESA_ID).single();
    if(error) throw error;
    if(data){ EMPRESA=data; await _aplicarContextoEmpresa(); }
  }catch(e){ console.warn('[carregarCFGremoto]', e?.message||e); }
}

// loadLojasExtraConfig: lê de CFG.lojas_extra (já carregado junto com CFG global)
function loadLojasExtraConfig(){
  lojasExtraConfig = CFG.lojas_extra || {};
  lsSet('fluxa_lojas_extra_cfg', JSON.stringify(lojasExtraConfig));
}

function getLojaConfig(lojaId){
  if(!lojaId) return CFG;
  // Se lojasExtraConfig estiver vazio, tenta carregar do cache localStorage
  if(!Object.keys(lojasExtraConfig).length){
    try{
      const cached=ls('fluxa_lojas_extra_cfg');
      if(cached){ const ex=JSON.parse(cached); if(ex&&Object.keys(ex).length) lojasExtraConfig=ex; }
    }catch(e){ console.warn('[getLojaConfig:lazy]',e?.message||e); }
  }
  const extra = lojasExtraConfig[lojaId];
  if(!extra) return CFG;
  return {
    ...CFG,
    nome:    extra.nome    || CFG.nome,
    sub:     extra.sub     || CFG.sub,
    logoB64: extra.logoB64 || CFG.logoB64,
    cor:     extra.cor     || CFG.cor,
    cor2:    extra.cor2    || CFG.cor2,
    tel:     extra.tel     || CFG.tel,
    cidades: extra.cidades || CFG.cidades,
    tagline: extra.tagline !== undefined ? extra.tagline : CFG.tagline
  };
}

async function salvarLojaConfig(lojaId){
  if(!lojaId) return;
  const dados = {
    nome:    gV('loja-cfg-nome-'+lojaId)||'',
    sub:     gV('loja-cfg-sub-'+lojaId)||'',
    tagline: gV('loja-cfg-tagline-'+lojaId)||'',
    tel:     gV('loja-cfg-tel-'+lojaId)||'',
    cidades: gV('loja-cfg-cidades-'+lojaId)||'',
    cor:     (document.getElementById('loja-cfg-cor-'+lojaId)?.value)||'',
    cor2:    (document.getElementById('loja-cfg-cor2-'+lojaId)?.value)||'',
    logoB64: lojasExtraConfig[lojaId]?.logoB64||''
  };
  // campos vazios → fallback para CFG global (não sobrescreve com vazio)
  Object.keys(dados).forEach(k=>{ if(!dados[k]) delete dados[k]; });
  // guarda dentro do CFG, na chave lojas_extra
  if(!CFG.lojas_extra) CFG.lojas_extra={};
  CFG.lojas_extra[lojaId] = dados;
  lojasExtraConfig[lojaId] = dados;
  lsSet('empresa_cfg', JSON.stringify(CFG)); // persiste local
  lsSet('fluxa_lojas_extra_cfg', JSON.stringify(lojasExtraConfig));
  if(dbOk && db){
    try{
      // salva tudo junto no registro global id=1 — mesma estratégia do salvarEmpresa
      await _persistirConfigEmpresa();
      toast('✅ Branding da '+getLojaNome(lojaId)+' salvo!');
    }catch(e){
      console.warn('[salvarLojaConfig]', e?.message||e);
      toast('✅ Salvo localmente (sync falhou)');
    }
  } else {
    toast('✅ Branding salvo localmente');
  }
}

function uploadLojaLogo(input, lojaId){
  const file = input.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = e => {
    if(!lojasExtraConfig[lojaId]) lojasExtraConfig[lojaId]={};
    lojasExtraConfig[lojaId].logoB64 = e.target.result;
    // sincroniza com CFG.lojas_extra para persistência posterior
    if(!CFG.lojas_extra) CFG.lojas_extra={};
    if(!CFG.lojas_extra[lojaId]) CFG.lojas_extra[lojaId]={};
    CFG.lojas_extra[lojaId].logoB64 = e.target.result;
    const prev = document.getElementById('loja-logo-preview-'+lojaId);
    if(prev){ prev.src=e.target.result; prev.style.display='block'; }
  };
  r.readAsDataURL(file);
}

// Atualização manual: re-sincroniza os dados da tela atual com o banco.
async function atualizarDados(btn){
  if(btn){ btn.disabled=true; btn.classList.add('girando'); }
  toast('🔄 Atualizando…');
  try{
    if(typeof _reenviarPendentes==='function') await _reenviarPendentes(true);
    const pid=document.querySelector('.page.on')?.id.replace('page-','')||'';
    if(pid==='visitas'){ if(typeof loadLocaisRemoto==='function') await loadLocaisRemoto(); if(typeof loadVistoriasRemoto==='function') await loadVistoriasRemoto(); if(typeof renderLocaisTab==='function') renderLocaisTab(); if(typeof renderVisHistorico==='function') renderVisHistorico(); }
    else if(pid==='agendamentos'){ if(typeof loadAgendamentos==='function') await loadAgendamentos(); }
    else if(pid==='estoque'){ if(typeof loadEstoque==='function') await loadEstoque(); }
    else if(pid==='history'){ if(typeof loadHist==='function') await loadHist(); }
    else if(pid==='crm'){ if(typeof loadHist==='function') await loadHist(); if(typeof renderCRM==='function') renderCRM(); }
    else if(pid==='minhas-os'){ if(typeof loadMinhasOS==='function') await loadMinhasOS(); }
    else if(typeof carregarClientesRemoto==='function'){ await carregarClientesRemoto(); }
    toast('✅ Dados atualizados');
  }catch(e){ console.warn('[atualizarDados]', e?.message||e); toast('⚠️ Não foi possível atualizar agora'); }
  if(btn){ btn.disabled=false; btn.classList.remove('girando'); }
}
async function carregarClientesRemoto(){
  if(!dbOk||!db) return;
  try{
    // Sempre busca TODOS os clientes — nunca filtra no banco.
    // A separação Aquamotor/Fortemp é feita em renderClientes().
    // Filtrar no banco causava sobrescrita do localStorage com só um grupo,
    // apagando os clientes do outro grupo ao trocar de contexto.
    const {data,error}=await db.from('clientes').select('*').eq('empresa_id',EMPRESA_ID).order('nome',{ascending:true});
    if(error) throw error;
    const local=lsCliLer();
    // Respeita tombstones: ficha apagada não volta. Se ainda estiver no banco,
    // o delete anterior falhou — tenta de novo em vez de ressuscitar na tela.
    let remoto=data||[];
    const tomb=new Set(_cliTombLer());
    if(tomb.size){
      remoto.filter(r=>tomb.has(r.id)).forEach(r=>{
        try{ db.from('clientes').delete().eq('id',r.id).then(()=>{}).catch(()=>{}); }catch(e){ console.warn('[cliTomb]',e?.message||e); }
      });
      remoto=remoto.filter(r=>!tomb.has(r.id));
    }
    const dbIds=new Set(remoto.map(x=>x.id));
    // Merge: BD é fonte de verdade + preserva clientes criados offline
    const merged=[...remoto];
    const soLocal=local.filter(l=>!dbIds.has(l.id) && !tomb.has(l.id));
    soLocal.forEach(l=>merged.push(l));
    lsCliSalvar(merged);
    if(document.getElementById('page-clientes').classList.contains('on')) renderClientes();
    // Sobe ao Supabase clientes criados offline
    soLocal.forEach(c=>{
      dbInsert('clientes',{id:c.id,nome:c.nome,telefone:c.tel||null,endereco:c.end||null,cnpj:c.cnpj||null,email_responsavel:c.email_responsavel||null,loja_id:c.loja_id||null,portal_token:c.portal_token||undefined}).catch(()=>{});
    });
  }catch(e){ console.warn('[carregarClientesRemoto]', e?.message||e); }
}
// Marca neutra do PRODUTO (SaaS Fluxa) — usada na tela de CONTA, ANTES do login.
// Depois de autenticar + carregar a empresa, aplicarCFG aplica o tema da empresa.
// Assim o pré-login nunca herda cor/nome/logo de uma empresa (ou do cache).
// (SAAS_C1/SAAS_C2 são declaradas no topo do arquivo — junto das constantes
//  SUPABASE_* — para evitar TDZ, pois resetMarcaSaaS roda cedo no boot.)
// true quando o SaaS tem credenciais mas NÃO há sessão de conta autenticada (tela
// de conta). Baseado só em authUser — o EMPRESA_ID pode estar no cache (offline)
// de um login anterior e NÃO pode "vazar" o tema da empresa antes de re-autenticar.
function _estaPreLogin(){ return !authUser && SUPABASE_URL!=='PREENCHER_DEPOIS'; }
function resetMarcaSaaS(){
  try{
    document.documentElement.style.setProperty('--c1', SAAS_C1);
    document.documentElement.style.setProperty('--c1-light', hexA(SAAS_C1,.1));
    document.documentElement.style.setProperty('--c1-mid', hexA(SAAS_C1,.2));
    document.documentElement.style.setProperty('--c2', SAAS_C2);
    const ln=document.getElementById('login-brand-name'); if(ln) ln.textContent='Fluxa';
    const li=document.getElementById('login-brand-initials'); if(li){ li.textContent='F'; li.style.display='flex'; }
    const llogo=document.getElementById('login-logo-img'); if(llogo) llogo.style.display='none';
    const lt=document.getElementById('login-brand-tagline'); if(lt) lt.textContent='Gestão para empresas de serviços';
    document.title='Fluxa';
  }catch(e){ console.warn('[resetMarcaSaaS]', e?.message||e); }
}

function aplicarCFG(){
  // Pré-login (SaaS com credenciais, sem conta/empresa) → marca NEUTRA do produto.
  // Só depois de autenticar + carregar a empresa é que o tema da empresa é aplicado.
  const preLogin = _estaPreLogin();
  if(preLogin){ resetMarcaSaaS(); }
  const cor  = preLogin ? SAAS_C1 : CFG.cor;
  const cor2 = preLogin ? SAAS_C2 : CFG.cor2;
  document.documentElement.style.setProperty('--c1', cor);
  document.documentElement.style.setProperty('--c1-light', hexA(cor,.1));
  document.documentElement.style.setProperty('--c1-mid', hexA(cor,.2));
  document.documentElement.style.setProperty('--c2', cor2);
  document.getElementById('hdr-nome').textContent = CFG.nome;
  document.getElementById('hdr-sub').textContent  = CFG.sub || 'Serviços';
  const img = document.getElementById('hdr-logo-img');
  img.alt = CFG.nome || 'Logo';
  if(CFG.logoB64){ img.src=CFG.logoB64; img.classList.add('has-logo'); }
  else { img.classList.remove('has-logo'); }
  // Sidebar (redesign 15/08) — mesmo texto do header
  const snNomeB=document.getElementById('snav-brand-nome');
  const snSubB =document.getElementById('snav-brand-sub');
  const snLogoB=document.getElementById('snav-logo');
  if(snNomeB) snNomeB.textContent = CFG.nome || '';
  if(snSubB)  snSubB.textContent  = CFG.sub || 'Serviços';
  if(snLogoB) snLogoB.textContent = (CFG.nome||'F').charAt(0).toUpperCase();
  // Brand da tela de login: pré-login fica neutro (resetMarcaSaaS acima); pós-login
  // (conta autenticada) mostra a marca da empresa.
  if(!preLogin){
    const loginLogoImg = document.getElementById('login-logo-img');
    const loginInitials = document.getElementById('login-brand-initials');
    const loginName = document.getElementById('login-brand-name');
    if(loginName) loginName.textContent = CFG.nome || 'Fluxa';
    if(loginLogoImg && loginInitials){
      if(CFG.logoB64){ loginLogoImg.src=CFG.logoB64; loginLogoImg.style.display='block'; loginInitials.style.display='none'; }
      else { loginLogoImg.style.display='none'; loginInitials.style.display='flex'; loginInitials.textContent=(CFG.nome||'F').charAt(0).toUpperCase(); }
    }
    // Achado numa revisão: sem fallback, isto apagava o headline do painel
    // esquerdo (redesign 15/08) assim que a conta autenticava — a maioria
    // das empresas nunca configurou CFG.tagline, então a tela de PIN (que
    // usa o mesmo painel esquerdo) ficava com o espaço em branco onde devia
    // ter o headline. Mesmo texto padrão do HTML, não um texto novo.
    const loginTagline=document.getElementById('login-brand-tagline');
    if(loginTagline) loginTagline.textContent=CFG.tagline||'Orçamento, ordem de serviço e vistoria no mesmo lugar.';
    document.title = CFG.nome + ' — Orçamentos';
  }
  renderPresets();
  preencherFormEmpresa();
  injetarPWA();
  populaTecSelects(); populaTecCheckIn();
  atualizarBadgeUsuario();
  aplicarPermissoesPerfil();
  atualizarHeaderLoja(); // sobrescreve header/cores com config da loja ativa
}

function preencherFormEmpresa(){
  // Para gestores de empresa específica, exibe os dados da sua loja
  const LC = (lojaAtiva && !isMainGestor()) ? getLojaConfig(lojaAtiva) : CFG;
  setV('cfg-nome',LC.nome||CFG.nome); setV('cfg-sub',LC.sub||CFG.sub);
  setV('cfg-tagline',LC.tagline!==undefined?LC.tagline:(CFG.tagline||''));
  setV('cfg-tel',LC.tel||CFG.tel); setV('cfg-cidades',LC.cidades||CFG.cidades);
  setV('cfg-cor',LC.cor||CFG.cor); setV('cfg-cor-txt',LC.cor||CFG.cor);
  setV('cfg-cor2',LC.cor2||CFG.cor2); setV('cfg-cor2-txt',LC.cor2||CFG.cor2);
  setV('cfg-servicos', (CFG.svcs||[]).join('\n'));
  setV('cfg-pin', ''); // não exibir hash; usuário digita novo PIN para alterar
  setV('cfg-notif-visita', CFG.notif_visita || CFG_DEF.notif_visita);
  setV('cfg-notif-concluida', CFG.notif_concluida || CFG_DEF.notif_concluida);
  setV('cfg-notif-orcamento', CFG.notif_orcamento || CFG_DEF.notif_orcamento);
  setV('cfg-notif-garantia', CFG.notif_garantia || CFG_DEF.notif_garantia);
  // Nota Fiscal (v2: sem token no cliente — só dados fiscais não-secretos)
  setV('cfg-nfe-cnpj', CFG.nfe_cnpj||'');
  setV('cfg-nfe-iss', CFG.nfe_iss||'2.0');
  setV('cfg-nfe-cod-svc', CFG.nfe_cod_svc||'7.10');
  { const e=_ejsCfg(); setV('cfg-ejs-pubkey', e.pubkey); setV('cfg-ejs-service', e.service); setV('cfg-ejs-template', e.template); }
  const ejsSt=document.getElementById('ejs-status');
  if(ejsSt) ejsSt.textContent=emailJSConfigurado()?'✅ EmailJS configurado':'';
  const lp = document.getElementById('logo-preview');
  const logoAtivo = LC.logoB64||CFG.logoB64;
  if(logoAtivo){ lp.src=logoAtivo; lp.style.display='block'; } else { lp.style.display='none'; }
  // Per-loja branding — só para gestor principal
  const brandCard=document.getElementById('lojas-branding-card');
  if(brandCard) brandCard.style.display=isMainGestor()?'block':'none';
  if(isMainGestor()) renderLojasBrandingUI();
}

function renderLojasBrandingUI(){
  const body=document.getElementById('lojas-branding-body'); if(!body) return;
  body.innerHTML=LOJAS.map(loja=>{
    const ec=lojasExtraConfig[loja.id]||{};
    const idN=loja.id.replace(/[^a-z0-9]/g,'-');
    return `
    <div class="loja-cfg-block">
      <div class="loja-cfg-hdr">
        <img id="loja-logo-preview-${loja.id}" src="${esc(ec.logoB64||'')}" class="loja-logo-sm" style="display:${ec.logoB64?'block':'none'}">
        <div>
          <div class="loja-cfg-title">${esc(loja.nome)}</div>
          <div class="loja-cfg-badge">${loja.id}</div>
        </div>
      </div>
      <div class="row">
        <div class="fl"><label>Nome nos documentos</label><input type="text" id="loja-cfg-nome-${loja.id}" value="${esc(ec.nome||'')}" placeholder="${esc(loja.nome)}"></div>
        <div class="fl"><label>Subtítulo / Segmento</label><input type="text" id="loja-cfg-sub-${loja.id}" value="${esc(ec.sub||'')}" placeholder="${esc(CFG.sub||'Manutenção de Piscinas')}"></div>
      </div>
      <div class="row f1">
        <div class="fl"><label>Slogan / Tagline <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--gray)">(opcional)</span></label><input type="text" id="loja-cfg-tagline-${loja.id}" value="${esc(ec.tagline||'')}" placeholder="${esc(CFG.tagline||'')}"></div>
      </div>
      <div class="row">
        <div class="fl"><label>Telefone / WhatsApp</label><input type="text" id="loja-cfg-tel-${loja.id}" value="${esc(ec.tel||'')}" placeholder="${esc(CFG.tel||'')}"></div>
        <div class="fl"><label>Cidades / Regiões</label><input type="text" id="loja-cfg-cidades-${loja.id}" value="${esc(ec.cidades||'')}" placeholder="${esc(CFG.cidades||'')}"></div>
      </div>
      <div class="row">
        <div class="fl"><label>Cor principal</label>
          <div class="color-row">
            <input type="color" id="loja-cfg-cor-${loja.id}" value="${ec.cor||CFG.cor||'#C45E0A'}">
            <input type="text" value="${ec.cor||CFG.cor||'#C45E0A'}" oninput="document.getElementById('loja-cfg-cor-${loja.id}').value=this.value" placeholder="#C45E0A">
          </div>
        </div>
        <div class="fl"><label>Cor secundária</label>
          <div class="color-row">
            <input type="color" id="loja-cfg-cor2-${loja.id}" value="${ec.cor2||CFG.cor2||'#2B3244'}">
            <input type="text" value="${ec.cor2||CFG.cor2||'#2B3244'}" oninput="document.getElementById('loja-cfg-cor2-${loja.id}').value=this.value" placeholder="#2B3244">
          </div>
        </div>
      </div>
      <div class="fl" style="margin-bottom:10px">
        <label>Logo exclusiva</label>
        <div class="loja-logo-upload-sm">
          <input type="file" accept="image/*" onchange="uploadLojaLogo(this,'${loja.id}')">
          🖼️ Clique para enviar logo (PNG ou JPG)
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn-primary" style="padding:8px 18px;font-size:13px" onclick="salvarLojaConfig('${loja.id}')">💾 Salvar ${esc(loja.nome)}</button>
        ${ec.logoB64?`<button class="btn-sec" style="padding:8px 14px;font-size:12px;color:var(--red);border-color:var(--red)" onclick="removerLojaLogo('${loja.id}')">🗑 Remover logo</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function removerLojaLogo(lojaId){
  if(!lojasExtraConfig[lojaId]) lojasExtraConfig[lojaId]={};
  lojasExtraConfig[lojaId].logoB64='';
  if(CFG.lojas_extra?.[lojaId]) CFG.lojas_extra[lojaId].logoB64='';
  const prev=document.getElementById('loja-logo-preview-'+lojaId);
  if(prev){ prev.src=''; prev.style.display='none'; }
  renderLojasBrandingUI();
}

function syncCor(v){ if(/^#[0-9a-fA-F]{6}$/.test(v)) document.getElementById('cfg-cor').value=v; previewCfg(); }
function syncCor2(v){ if(/^#[0-9a-fA-F]{6}$/.test(v)) document.getElementById('cfg-cor2').value=v; previewCfg(); }
function previewCfg(){
  const c=gV('cfg-cor'); const c2=gV('cfg-cor2');
  document.documentElement.style.setProperty('--c1',c);
  document.documentElement.style.setProperty('--c2',c2);
  setV('cfg-cor-txt',c); setV('cfg-cor2-txt',c2);
}

function uploadLogo(input){
  const f=input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=async e=>{
    const raw=e.target.result;
    const dataUrl=await compressImage(raw,1200,0.75);
    if(lojaAtiva && !isMainGestor()){
      // Gestor de empresa específica → salva logo na sua loja
      if(!lojasExtraConfig[lojaAtiva]) lojasExtraConfig[lojaAtiva]={};
      lojasExtraConfig[lojaAtiva].logoB64=dataUrl;
      if(!CFG.lojas_extra) CFG.lojas_extra={};
      if(!CFG.lojas_extra[lojaAtiva]) CFG.lojas_extra[lojaAtiva]={};
      CFG.lojas_extra[lojaAtiva].logoB64=dataUrl;
    } else {
      CFG.logoB64=dataUrl;
    }
    const lp=document.getElementById('logo-preview'); lp.src=dataUrl; lp.style.display='block';
  };
  r.readAsDataURL(f);
}

async function salvarEmpresa(){
  // Gestor de empresa específica → salva branding somente da sua loja
  if(lojaAtiva && !isMainGestor()){
    if(!CFG.lojas_extra) CFG.lojas_extra={};
    if(!lojasExtraConfig[lojaAtiva]) lojasExtraConfig[lojaAtiva]={};
    const dadosLoja={
      nome:    gV('cfg-nome')||'',
      sub:     gV('cfg-sub')||'',
      tagline: gV('cfg-tagline')||'',
      tel:     gV('cfg-tel')||'',
      cidades: gV('cfg-cidades')||'',
      cor:     gV('cfg-cor')||CFG.cor,
      cor2:    gV('cfg-cor2')||CFG.cor2,
      logoB64: lojasExtraConfig[lojaAtiva]?.logoB64||''
    };
    Object.keys(dadosLoja).forEach(k=>{ if(k!=='logoB64'&&!dadosLoja[k]) delete dadosLoja[k]; });
    CFG.lojas_extra[lojaAtiva]=dadosLoja;
    lojasExtraConfig[lojaAtiva]=dadosLoja;
    lsSet('empresa_cfg',JSON.stringify(CFG));
    lsSet('fluxa_lojas_extra_cfg',JSON.stringify(lojasExtraConfig));
    if(dbOk&&db){
      try{ await _persistirConfigEmpresa(); }
      catch(e){ console.warn('[salvarEmpresa:loja]',e?.message||e); toast('✅ Configurações salvas localmente (sync falhou)'); atualizarHeaderLoja(); return; }
    }
    atualizarHeaderLoja();
    toast('✅ Configurações salvas!');
    return;
  }
  // Gestor principal → salva no CFG global
  CFG.nome = gV('cfg-nome')||CFG_DEF.nome;
  CFG.sub  = gV('cfg-sub');
  CFG.tagline = gV('cfg-tagline')||'';
  CFG.tel  = gV('cfg-tel');
  CFG.cidades = gV('cfg-cidades');
  CFG.cor  = gV('cfg-cor');
  CFG.cor2 = gV('cfg-cor2');
  CFG.svcs = gV('cfg-servicos').split('\n').map(s=>s.trim()).filter(Boolean);
  const novoPin = gV('cfg-pin').trim();
  if(novoPin.length===4 && /^\d{4}$/.test(novoPin)){
    hashPIN(novoPin).then(h=>{ CFG.pin=h; lsSet('empresa_cfg',JSON.stringify(CFG)); });
  }
  CFG.notif_visita = gV('cfg-notif-visita') || CFG_DEF.notif_visita;
  CFG.notif_concluida = gV('cfg-notif-concluida') || CFG_DEF.notif_concluida;
  CFG.notif_orcamento = gV('cfg-notif-orcamento') || CFG_DEF.notif_orcamento;
  CFG.notif_garantia = gV('cfg-notif-garantia') || CFG_DEF.notif_garantia;
  // Nota Fiscal
  // v2: NÃO guardar token fiscal no cliente (era CFG.nfe_token_prod/hom).
  CFG.nfe_cnpj       = gV('cfg-nfe-cnpj').trim();
  CFG.nfe_iss        = gV('cfg-nfe-iss')||'2.0';
  CFG.nfe_cod_svc    = gV('cfg-nfe-cod-svc')||'7.10';
  // EmailJS
  // v2: EmailJS por empresa em CFG.emailjs (empresas.config.emailjs)
  CFG.emailjs = {
    pubkey:   gV('cfg-ejs-pubkey').trim(),
    service:  gV('cfg-ejs-service').trim(),
    template: gV('cfg-ejs-template').trim(),
    reply_to: (CFG.emailjs&&CFG.emailjs.reply_to)||CFG.emailjs_reply_to||''
  };
  delete CFG.emailjs_pubkey; delete CFG.emailjs_service; delete CFG.emailjs_template;
  lsSet('empresa_cfg',JSON.stringify(CFG));
  if(_ejsCfg().pubkey) initEmailJS();
  if(dbOk&&db){
    try{ await _persistirConfigEmpresa(); }catch(e){ console.warn('cfg sync:',e.message); toast('✅ Configurações salvas localmente (sync falhou)'); aplicarCFG(); return; }
  }
  aplicarCFG();
  toast('✅ Configurações salvas!');
}

// ──────────────────────────────────────────────────
//  SUPABASE
// ──────────────────────────────────────────────────
function setDbSt(ok, txt){
  dbOk=ok;
  const cls='db-dot '+(ok?'ok':'err');
  document.getElementById('db-dot').className=cls;
  const d2=document.getElementById('db-dot2'); if(d2) d2.className=cls;
  const t2=document.getElementById('db-txt2'); if(t2) t2.textContent=(ok?'✅ Banco conectado':'⚠️ Banco offline — salvando local');
}
async function conectarDB(url, key, mostrarErro=true){
  try{
    // Reusa o cliente já criado (o mesmo que guarda a sessão do Auth). Só cria um
    // novo se ainda não existir — nunca recriar, para não perder a sessão.
    if(!db){
      const {createClient}=supabase;
      db=createClient(url||SUPABASE_URL, key||SUPABASE_ANON_KEY);
    }
    const {error}=await db.from('orcamentos').select('id').limit(1);
    if(error) throw error;
    dbOk=true; setDbSt(true,'conectado'); iniciarRealtimeSync(); return true;
  }catch(e){ if(mostrarErro) console.error(e); setDbSt(false,'erro'); return false; }
}

// ──────────────────────────────────────────────────
//  NAVEGAÇÃO
// ──────────────────────────────────────────────────
/* ── SIDEBAR ── */
function initSidebar(){
  const col=localStorage.getItem('fluxa_sbar_col')==='1';
  const sb=document.getElementById('sidebar');
  if(!sb) return;
  if(col){ sb.classList.add('collapsed'); document.body.classList.add('sbar-col'); }
  else   { sb.classList.remove('collapsed'); document.body.classList.remove('sbar-col'); }
}
function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  if(!sb) return;
  const isMob=window.innerWidth<=680;
  if(isMob){
    sb.classList.contains('mob-open') ? closeSidebar() : openSidebar();
  } else {
    const col=sb.classList.toggle('collapsed');
    document.body.classList.toggle('sbar-col',col);
    localStorage.setItem('fluxa_sbar_col',col?'1':'0');
  }
}
function openSidebar(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('sidebar-overlay');
  if(sb) sb.classList.add('mob-open');
  if(ov) ov.classList.add('on');
}
function closeSidebar(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('sidebar-overlay');
  if(sb) sb.classList.remove('mob-open');
  if(ov) ov.classList.remove('on');
}

function go(p){
  // ── Controle de acesso por perfil ──
  const _sess    = getSessao();
  const _vendas  = eVendas();
  const _tecnico = eTecnico();
  const _gestor  = eGestor();
  // Páginas permitidas por perfil vêm da matriz PERMISSOES (fonte única).
  if((_vendas || _tecnico) && !podeVerPagina(p, _sess)){ toast('Você não tem acesso a essa área.'); return; }
  // Sessão sem perfil reconhecido (estado legado): só barra as áreas de gestor.
  if(!_gestor && !_vendas && !_tecnico &&
     ['form','history','empresa','usuarios','produtividade'].includes(p)){
    toast('⚠️ Acesso restrito ao Gestor'); return;
  }
  // Histórico de navegação (para o botão "← Voltar")
  const _atual = document.querySelector('.page.on')?.id?.replace('page-','');
  if(window._skipNavHist){ window._skipNavHist=false; }
  else if(_atual && _atual!==p){ window._navHist=(window._navHist||[]); window._navHist.push(_atual); if(window._navHist.length>25) window._navHist.shift(); }
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));
  document.getElementById('page-'+p).classList.add('on');
  document.querySelectorAll('.nb').forEach(x=>{ x.classList.remove('on'); x.removeAttribute('aria-current'); });
  const nb=document.getElementById('nb-'+p); if(nb){ nb.classList.add('on'); nb.setAttribute('aria-current','page'); }
  document.querySelectorAll('.mob-nb').forEach(x=>{ x.classList.remove('on'); x.removeAttribute('aria-current'); });
  const mnb=document.getElementById('mnb-'+p); if(mnb){ mnb.classList.add('on'); mnb.setAttribute('aria-current','page'); }
  document.querySelectorAll('.snb').forEach(x=>{ x.classList.remove('on'); x.removeAttribute('aria-current'); });
  const snb=document.getElementById('snb-'+p); if(snb){ snb.classList.add('on'); snb.setAttribute('aria-current','page'); }
  closeSidebar();
  // Tela cheia do balcão (16/08, portado do fluxa-app v1) — sem sidebar/
  // header/nav inferior, "cliente esperando no balcão" não tem espaço pra
  // cromo do app admin. Roda em TODO go(), não só ao entrar em
  // 'venda-balcao': é o que garante que sair da tela (pra qualquer destino)
  // devolve sidebar/header sozinho, sem precisar de um "fecharTelaCheia()"
  // espalhado em cada botão de saída.
  const _telaCheia = p==='venda-balcao';
  const _hdrEl=document.getElementById('app-hdr'); if(_hdrEl) _hdrEl.style.display=_telaCheia?'none':'';
  const _mobNavEl=document.getElementById('mob-nav'); if(_mobNavEl) _mobNavEl.style.display=_telaCheia?'none':'';
  const _sbEl=document.getElementById('sidebar'); if(_sbEl) _sbEl.classList.toggle('s-hidden', _telaCheia);
  document.body.classList.toggle('no-sbar', _telaCheia);
  if(p==='venda-balcao') _vbAbrir();
  if(p==='portal') { /* página gerenciada por checkPortalHash */ }
  if(p==='painel'){
    initOrcMes(); loadHist(); loadOSHist(); _recebGarantirCarregado();
    document.getElementById('painel-nome').textContent=getSessao()?.nome||'';
    document.getElementById('painel-mes-label').textContent='Como está '+_renderOrcMesLabelStr();
    setTimeout(renderGraficoDash,200);
    setTimeout(renderPainelCRM,250);
    setTimeout(renderPainelFilaHoje,250); // task #45 — junta funil+estoque; roda de novo abaixo se a cadência ligar depois
    setTimeout(_notifAtualizarBadge,300); // sino reflete os mesmos alertas, alcançáveis de qualquer tela
    // Cadência de recompra — atrás de flag (ver comentário em renderPainelCadencia).
    // Só carrega piscinas se a flag estiver ligada, pra não gastar query à toa.
    if(flagAtiva('crm_cadencia')){
      Promise.resolve(loadPiscinas()).then(()=>{ renderPainelCadencia(); renderPainelFilaHoje(); }).catch(e=>console.warn('[painel-cadencia]', e?.message||e));
    }
  }
  if(p==='history'){ initOrcMes(); loadHist(); _recebGarantirCarregado(); }
  if(p==='crm'){ if(!_crmAtivo()){ toast('Funil desativado para esta empresa.'); go('painel'); return; } loadOSHist(); renderCRM(); }
  if(p==='form'){
    // Restaura rascunho APENAS quando se navega direto para a tela (nav/menu).
    // Nunca ao editar (abrirOrc), criar novo (novoOrc) ou duplicar — esses fluxos
    // já preencheram os campos e o rascunho antigo sobrescrevia com dados de outro orçamento.
    if(!editId && !window._skipDraftForm) restaurarRascunho('form');
    window._skipDraftForm=false;
    // Garante que o select de empresa reflete a loja ativa ao entrar na tela
    if(!editId && lojaAtiva) setV('orc-loja', lojaAtiva);
    // Garante base de clientes atualizada para o autocomplete
    carregarClientesRemoto();
    // Wizard mobile (17/08) — sempre começa no passo 1, seja novo, editando
    // ou duplicando (mesmo comportamento do fluxa-app v1).
    _orcMobileStep=1;
    if(typeof _orcApplyMobileStep==='function') _orcApplyMobileStep();
  }
  if(p==='os-history') loadOSHist();
  if(p==='clientes'){ renderClientes(); carregarClientesRemoto(); }
  if(p==='empresa') preencherFormEmpresa();
  if(p==='equipamentos'){
    loadEquipamentos();
    if(typeof loadPiscinas==='function') Promise.resolve(loadPiscinas()).then(()=>{ if(typeof _eqRenderPiscinas==='function') _eqRenderPiscinas(); }).catch(e=>console.warn('[go equipamentos loadPiscinas]', e?.message||e));
  }
  if(p==='agendamentos'){ loadAgendamentos(); populaTecSelects(); initCal(); renderCal(); }
  if(p==='despesas') loadDespesas();
  if(p==='estoque') loadEstoque();
  if(p==='produtividade'){ loadProdutividade(); Promise.resolve(loadRecebimentos()).then(renderContasReceber).catch(e=>console.warn('[go receb]',e?.message||e)); if(typeof loadDespesas==='function') Promise.resolve(loadDespesas()).then(()=>renderDRE()).catch(e=>console.warn('[go dre]',e?.message||e)); setTimeout(()=>{ renderRelatorioFinanceiro(); renderDRE(); },300); }
  if(p==='analises') loadAnalises();
  if(p==='plataforma') loadPlataforma();
  if(p==='usuarios') loadUsuarios();
  if(p==='auditoria') loadAuditoria();
  if(p==='minhas-os') loadMinhasOS();
  if(p==='visitas'){
    initVisitas();
    if(typeof loadPiscinas==='function') Promise.resolve(loadPiscinas()).then(()=>{ if(typeof _visRenderPiscinas==='function') _visRenderPiscinas(); }).catch(e=>console.warn('[go visitas loadPiscinas]', e?.message||e));
    // Todos os perfis caem direto na aba Locais (acompanhamento mensal)
    // "Nova Vistoria" fica acessível pela aba, mas não é a tela inicial
    visTab('locais');
    // Vistoria interrompida no meio (tela apagou, app fechou) volta de onde
    // parou. Local primeiro; se a nuvem tiver algo mais novo — outro
    // aparelho — ela vence.
    if(!_restaurarRascunhoVis()) _restaurarRascunhoNuvem();
  }
  // Atualiza técnicos disponíveis quando abre form de OS
  if(p==='os'){
    if(!osEditId) restaurarRascunho('os'); // não restaura draft quando editando OS existente
    // Idempotente e barato: garante os slots desenhados mesmo chegando aqui
    // por um caminho que não passou por novaOS()/_abrirOSForm().
    renderOSFotosSlots();
    // A-04: pré-preenche data de hoje se vazio
    const osDataEl=document.getElementById('os-data');
    if(osDataEl && !osDataEl.value) osDataEl.value=_hojeLocal();
    const l=gV('os-loja')||LOJA_PADRAO_ID;
    atualizarTecsPorLoja(l,'os-tec');
    atualizarTecsPorLoja(l,'os-tec-checkin');
    // Técnico: oculta o valor financeiro (não precisa ver preço)
    const totalWrap = document.getElementById('os-total')?.closest('.fl');
    if(totalWrap) totalWrap.style.display = eTecnico() ? 'none' : '';
    // Painel de itens a validar/baixar (se a OS vier de um orçamento com produtos)
    if(typeof atualizarPainelItensOS==='function') atualizarPainelItensOS();
    // Vendas: oculta seções técnicas (check-in, checklist, fotos, detalhes)
    const soVendas = eVendas();
    ['os-checkin-card'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.display=soVendas?'none':'';
    });
    // Checklist e fotos (cards filhos do wrap da OS)
    document.querySelectorAll('#page-os .card').forEach(c=>{
      const titulo=c.querySelector('.ct');
      if(!titulo) return;
      const txt=titulo.textContent||'';
      if(soVendas && (txt.includes('Checklist')||txt.includes('Fotos')||txt.includes('Detalhes Técnicos'))){
        c.style.display='none';
      } else {
        c.style.display='';
      }
    });
  }
}

// Voltar para a página anterior (histórico de navegação); fallback por perfil
function voltar(){
  const atual=document.querySelector('.page.on')?.id?.replace('page-','');
  const hist=window._navHist||[];
  let dest=hist.pop();
  while(dest && dest===atual) dest=hist.pop(); // não volta pra própria página
  window._navHist=hist;
  if(!dest) dest = eTecnico()?'minhas-os':eVendas()?'form':'history';
  window._skipNavHist=true; // não re-empilha ao voltar
  go(dest);
}

// Gear dropdown
function toggleGear(){
  const m=document.getElementById('gear-menu');
  const abrir=m.style.display==='none';
  if(abrir && typeof closeNotificacoes==='function') closeNotificacoes();
  m.style.display=abrir?'block':'none';
}
function closeGear(){ document.getElementById('gear-menu').style.display='none'; }
// Fechar gear ao clicar fora
document.addEventListener('click',e=>{ if(!e.target.closest('.gear-wrap')) closeGear(); });

function toggleOsCard(){
  const on=document.getElementById('toggle-os')?.checked;
  const fields=document.getElementById('os-inline-fields');
  if(fields) fields.style.display=on?'block':'none';
}

async function criarOSjunto(dados, orcNum){
  const data=document.getElementById('os-inline-data')?.value||dados.dataSvc||'';
  const hora=document.getElementById('os-inline-hora')?.value||'08:00';
  const tec=document.getElementById('os-inline-tec')?.value||CFG.nome;
  // Preserva produto_id para que a entrega de estoque via OS funcione corretamente
  const osSvcsData=dados.svcs.map(s=>({desc:s.desc||s.d||'',produto_id:s.produto_id||null,qty:s.qty||1,precoUnit:parseFloat(s.p||s.preco||0)||0}));
  const camposBase={
    orcamento_id:editId||null, cliente:dados.cli, cliente_id:dados.cliId||null,
    local_servico:dados.loc, data_servico:data, hora, tecnico:tec,
    servicos:osSvcsData, materiais:'', obs_tecnica:'', total:dados.tot, status:'agendado',
    loja_id:dados.loja_id||LOJA_PADRAO_ID // faltava — OS ficava sem loja (as outras 2 rotas de criação de OS já mandam isso)
  };
  let numStr='???';
  let osSalvouOffline=false;
  try{
    if(dbOk&&db){
      // Achado (17/08): o código antigo ignorava `error` e, quando o insert falhava,
      // seguia em frente com numOS=1 por padrão — imprimia "OS #001" pro cliente como
      // se tivesse dado certo, mas NADA tinha sido gravado no banco (perda silenciosa,
      // mesma classe de bug do gerarOSPDF/criarOSdeAprovacao, que já tratam isso certo).
      const {data:insOS,error}=await dbInsertNumerado('ordens_servico',camposBase);
      if(error) throw error;
      const num=insOS?.numero||1;
      numStr=String(num).padStart(3,'0');
      if(insOS) todosOS.unshift(insOS); // faltava — OS não aparecia no Histórico até um reload
    }else{
      const n=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',String(n));
      _salvarOSLocal(camposBase, 'local_'+Date.now(), n);
      numStr=String(n).padStart(3,'0'); osSalvouOffline=true;
    }
  }catch(e){
    console.warn('[criarOSjunto] falha ao salvar OS no banco — salvando local:', e?.message||e);
    const n=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',String(n));
    _salvarOSLocal(camposBase, 'local_'+Date.now(), n);
    numStr=String(n).padStart(3,'0'); osSalvouOffline=true;
  }
  // O orçamento já foi salvo pelo chamador antes de chegar aqui — a impressão não
  // pode ficar refém de uma falha só na parte da OS.
  try{
    const numOrcStr=String(orcNum||0).padStart(3,'0');
    preencherDocOrc(dados, numOrcStr);
    const osDados={ cli:dados.cli, loc:dados.loc, data, hora, tec, tot:dados.tot, mat:'', obs:'', svcs:osSvcsData, loja_id:dados.loja_id||LOJA_PADRAO_ID };
    preencherDocOS(osDados, numStr);
    imprimirDoc('both');
    if(osSalvouOffline) toast('⚠️ OS #'+numStr+' salva só neste aparelho — sincroniza quando reconectar');
  }catch(e){ console.error('criarOSjunto:',e); toast('⚠️ Erro ao gerar o documento: '+e.message); }
}

// ── Modal: Criar OS a partir da aprovação do orçamento ──
function _perguntarCriarOS(orc){
  document.getElementById('aprov-os-orc-id').value=orc.id;
  document.getElementById('aprov-os-titulo').textContent=`Orçamento #${String(orc.numero||'?').padStart(3,'0')} aprovado!`;
  const dataEl=document.getElementById('aprov-os-data');
  dataEl.value=orc.data_servico||_hojeLocal();
  document.getElementById('aprov-os-hora').value='08:00';
  const sel=document.getElementById('aprov-os-tec');
  const tecs=getTecnicos();
  sel.innerHTML='<option value="">Selecione…</option>'+tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  document.getElementById('aprov-os-bg').classList.add('on');
}
function fecharAprovOS(){
  document.getElementById('aprov-os-bg').classList.remove('on');
  // Aprovar é o único momento em que alguém sabe COMO o cliente vai pagar —
  // perguntar depois vira "decidir depois" pra sempre. Só pra gestor (dado
  // financeiro) e só se ainda não houver parcela.
  const orcId=document.getElementById('aprov-os-orc-id')?.value;
  if(orcId && !eVendas() && !_recebDoOrc(orcId).length) setTimeout(()=>abrirModalReceb(orcId), 350);
}

// Núcleo de criação de OS a partir de um orçamento — extraído de
// criarOSdeAprovacao() (Tarefa 3i.2, 19/08) pra ser reaproveitado pela ação
// em lote "Agendar as N aprovadas sem OS" (_orcAgendarLoteExecutar). Mesma
// lógica de sempre (insert numerado, fallback local se offline/falhar), só
// parametrizada em vez de ler de inputs fixos do modal de aprovação.
async function _criarOSDeOrcamento(orc, data, hora, tec){
  const osSvcs=(orc.servicos||[]).map(s=>({desc:s.desc||s.d||'',produto_id:s.produto_id||null,qty:s.qty||1,precoUnit:parseFloat(s.p||s.preco||0)||0}));
  const camposBase={
    orcamento_id:String(orc.id).startsWith('local_')?null:orc.id,
    cliente:orc.cliente, cliente_id:orc.cliente_id||null, local_servico:orc.local_servico,
    data_servico:data, hora:hora||'08:00', tecnico:tec||'',
    servicos:osSvcs, materiais:'', obs_tecnica:'',
    total:orc.total, status:'agendado', loja_id:orc.loja_id||LOJA_PADRAO_ID
  };
  let numStr='???', offline=false;
  if(dbOk&&db){
    try{
      const {data:insOS,error}=await dbInsertNumerado('ordens_servico',camposBase);
      if(error) throw error;
      const num=insOS?.numero||1;
      numStr=String(num).padStart(3,'0');
      if(insOS) todosOS.unshift(insOS);
    }catch(e){
      console.warn('[_criarOSDeOrcamento] falha ao salvar no banco:', e?.message||e);
      const n=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',String(n));
      _salvarOSLocal(camposBase, 'local_'+Date.now(), n);
      numStr=String(n).padStart(3,'0'); offline=true;
    }
  }else{
    const n=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',String(n));
    _salvarOSLocal(camposBase, 'local_'+Date.now(), n);
    numStr=String(n).padStart(3,'0'); offline=true;
  }
  logAcao('os_criada',`#${numStr} via aprovação do orçamento #${String(orc.numero||'?').padStart(3,'0')}`);
  return {numStr, offline};
}

async function criarOSdeAprovacao(){
  const orcId=document.getElementById('aprov-os-orc-id').value;
  const data=document.getElementById('aprov-os-data').value;
  const hora=document.getElementById('aprov-os-hora').value||'08:00';
  const tec=document.getElementById('aprov-os-tec').value;
  // data e tec são opcionais — podem ser preenchidos depois via "Editar OS"
  const orc=todosOrc.find(x=>x.id===orcId);
  if(!orc){ toast('⚠️ Orçamento não encontrado'); fecharAprovOS(); return; }
  const btn=document.getElementById('aprov-os-btn');
  if(btn){ btn.disabled=true; btn.textContent='Criando…'; }
  try{
    const {numStr, offline}=await _criarOSDeOrcamento(orc, data, hora, tec);
    fecharAprovOS();
    const dataFmt=new Date(data+'T12:00:00').toLocaleDateString('pt-BR');
    toast(offline
      ? `📴 OS #${numStr} salva neste aparelho — sincroniza quando reconectar`
      : `✅ OS #${numStr} criada — agendada para ${dataFmt} às ${hora} · Técnico: ${tec}`);
    await loadOSHist();
  }catch(e){
    console.error('criarOSdeAprovacao:',e); toast('⚠️ Erro ao criar OS: '+e.message);
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='📋 Criar OS agendada'; }
  }
}

// Limpar formulário para novo orçamento
// Limpa TODOS os campos do formulário de orçamento (sem navegar). Usado ao
// iniciar um novo orçamento e ao terminar de salvar/gerar um — assim o form
// nunca fica com dados do orçamento anterior (que causava duplicatas).
function _limparCamposOrc(){
  editId=null; fotosB64=[];
  svcs=[{id:Date.now(),d:'',p:''}];
  ['cli','cli-id','loc','tel-cli','cpf-cli','cnpj-cli','obs','escopo','data-svc','data-orc','nota-interna','origem-cli','origem-cli-outro','pag-parcelas','pag-entrada'].forEach(id=>setV(id,''));
  updOrigemCli();
  setV('pag','A combinar'); setV('val','5'); setV('disc-v',''); setV('disc-t','R$');
  setV('orc-loja', lojaAtiva||LOJA_PADRAO_ID);
  renderSvcs(); upd();
  renderFotosOrcSlots();
  // Reset OS toggle
  const tog=document.getElementById('toggle-os'); if(tog) tog.checked=false;
  const osf=document.getElementById('os-inline-fields'); if(osf) osf.style.display='none';
  ['os-inline-data','os-inline-hora','os-inline-tec'].forEach(id=>{const el=document.getElementById(id);if(el){el.value=id==='os-inline-hora'?'08:00':'';}});
  const tov=document.getElementById('toggle-ocultar-valores'); if(tov) tov.checked=false;
  const bb=document.getElementById('form-back-bar'); if(bb) bb.style.display='none';
  const trilhaW=document.getElementById('orc-trilha-wrap'); if(trilhaW) trilhaW.style.display='none';
  const cardOS=document.getElementById('orc-cartao-os'); if(cardOS) cardOS.style.display='none';
}
function novoOrc(){
  limparRascunho('form'); window._skipDraftForm=true; // novo orçamento = começar do zero, sem rascunho antigo
  _limparCamposOrc();
  go('form');
  carregarMunicipiosFiscais();
}

// ──────────────────────────────────────────────────
//  FORM — INIT
// ──────────────────────────────────────────────────
let fotosB64 = []; // array de até 6 base64 strings
function initForm(){
  document.getElementById('data-orc').value=_hojeLocal();
  svcs=[]; editId=null; fotosB64=[];
  addSvc('',''); renderPresets(); upd(); renderChips(); renderFotosOrcSlots();
}

// ──────────────────────────────────────────────────
//  PRESETS
// ──────────────────────────────────────────────────
function getPresets(){ const s=JSON.parse(ls('fluxa_presets')||'{}'); return (CFG.svcs||[]).map(d=>({d,p:s[d]||''})); }
function salvarPrecoPreset(d,p){ const s=JSON.parse(ls('fluxa_presets')||'{}'); s[d]=p; lsSet('fluxa_presets',JSON.stringify(s)); }

function renderPresets(){
  const el=document.getElementById('presets'); if(!el) return;
  el.innerHTML='';
  getPresets().forEach(({d,p})=>{
    const k=safeKey(d), pn=parseFloat(p)||0;
    const pl=pn>0?brl(pn):'Definir preço', ec=pn>0?'':' empty';
    const it=document.createElement('div'); it.className='pi';
    it.innerHTML=`<button class="pi-add" onclick="addPreset('${esc(d)}')">＋ ${esc(d)}</button>
      <div class="pi-pw">
        <span class="pi-pd${ec}" id="pd-${k}" onclick="editPP('${esc(d)}')">${pl}</span>
        <input class="pi-pi" id="pi-${k}" onblur="savePP('${esc(d)}',this)" onkeydown="if(event.key==='Enter')this.blur()">
        <button class="pi-eb" onclick="editPP('${esc(d)}')">✎</button>
      </div>`;
    el.appendChild(it);
  });
}
function addPreset(d){ const p=getPresets().find(x=>x.d===d); addSvc(d,p?p.p:''); }
function editPP(d){
  const k=safeKey(d), disp=document.getElementById('pd-'+k), inp=document.getElementById('pi-'+k);
  if(!disp||!inp) return;
  const v=parseFloat(JSON.parse(ls('fluxa_presets')||'{}')[d])||0;
  disp.style.display='none'; inp.style.display='block';
  inp.value=v>0?v.toFixed(2).replace('.',','):''; inp.focus(); inp.select();
}
function savePP(d,inp){
  const k=safeKey(d), disp=document.getElementById('pd-'+k);
  const v=parseFloat(inp.value.replace(',','.'))||0;
  salvarPrecoPreset(d,v>0?String(v):'');
  inp.style.display='none';
  if(disp){ disp.style.display=''; if(v>0){disp.textContent=brl(v);disp.classList.remove('empty');}else{disp.textContent='Definir preço';disp.classList.add('empty');} }
}

// ──────────────────────────────────────────────────
//  SERVIÇOS (form)
// ──────────────────────────────────────────────────
function addSvc(d,p,qty){ svcs.push({id:Date.now()+Math.random(),d:d||'',p:p||'',qty:qty||1}); renderSvcs(); upd(); }
function rmSvc(id){ if(svcs.length===1){toast('⚠️ Mín. 1 serviço');return;} svcs=svcs.filter(s=>s.id!==id); renderSvcs(); upd(); }
function renderSvcs(){
  const el=document.getElementById('slist'); el.innerHTML='';
  svcs.forEach(s=>{
    const v=parseFloat(s.p)||0;
    const qty=parseInt(s.qty)||1;
    const r=document.createElement('div'); r.className='srow';
    const prod = s.produto_id ? produtoById(s.produto_id) : null;
    const prodBadge = s.produto_id
      ? `<span title="Vinculado ao estoque — dá baixa quando aprovado" style="display:inline-flex;align-items:center;gap:4px;background:var(--c1-light);color:var(--c1);border:1px solid var(--c1);border-radius:50px;padding:2px 8px;font-size:11px;font-weight:600">📦 ${esc(prod?prod.nome:'produto')}<span onclick="desvincularProdutoSvc(${s.id})" style="cursor:pointer;font-weight:700" title="Desvincular">✕</span></span>`
      : `<button type="button" onclick="abrirPickerProduto(${s.id})" style="background:none;border:1px dashed var(--gray-mid);border-radius:50px;padding:3px 10px;font-size:11px;color:var(--gray);cursor:pointer;font-family:'Inter',sans-serif">📦 Vincular produto do estoque</button>`;
    r.innerHTML=`<div class="srow-t">
      <input type="number" class="qty-f" placeholder="1" min="1" value="${qty}" data-id="${s.id}" data-f="qty" oninput="updSvcQty(this)" title="Quantidade">
      <input type="text" placeholder="Descrição do serviço ou produto" value="${esc(s.d)}" data-id="${s.id}" data-f="d" oninput="updSvc(this)" style="flex:1">
      <button class="btn-rm" onclick="rmSvc(${s.id})">✕</button>
    </div>
    <div class="srow-b">
      <span class="plabel">Valor unit. (R$):</span>
      <input type="text" inputmode="decimal" class="pf" placeholder="0,00" value="${v>0?v.toFixed(2).replace('.',','):''}" data-id="${s.id}" oninput="updSvcP(this)" onblur="fmtP(this)">
      ${qty>1?`<span class="plabel" style="margin-left:8px">= ${brl(v*qty)}</span>`:''}
      <span style="margin-left:auto">${prodBadge}</span>
    </div>`;
    el.appendChild(r);
  });
}
function updSvc(inp){ const s=svcs.find(x=>x.id===parseFloat(inp.dataset.id)); if(s) s[inp.dataset.f]=inp.value; upd(); }
function updSvcQty(inp){ const s=svcs.find(x=>x.id===parseFloat(inp.dataset.id)); if(s){ s.qty=parseInt(inp.value)||1; renderSvcs(); upd(); } }
function updSvcP(inp){
  const raw=inp.value.replace(',','.').replace(/[^\d.]/g,'');
  const s=svcs.find(x=>x.id===parseFloat(inp.dataset.id));
  if(s) s.p=raw||'';
  upd();
}
function fmtP(inp){
  const raw=inp.value.replace(',','.').replace(/[^\d.]/g,'');
  const v=parseFloat(raw)||0;
  const s=svcs.find(x=>x.id===parseFloat(inp.dataset.id));
  if(s) s.p=v>0?String(v):'';
  inp.value=v>0?v.toFixed(2).replace('.',','):'';
  renderSvcs(); upd();
}
function gP(s){ return (parseFloat(s.p)||0)*(parseInt(s.qty)||1); }

// ── Vincular item do orçamento a um produto do estoque ──
let _pickerSvcId=null;
function abrirPickerProduto(svcId){
  _pickerSvcId=svcId;
  if(!todosProdutos.length) loadEstoque(); // garante catálogo carregado
  setV('prodpicker-busca','');
  renderPickerProduto('');
  document.getElementById('prodpicker-modal').style.display='flex';
  setTimeout(()=>document.getElementById('prodpicker-busca')?.focus(),80);
}
function fecharPickerProduto(){ document.getElementById('prodpicker-modal').style.display='none'; }
function renderPickerProduto(q){
  const body=document.getElementById('prodpicker-body'); if(!body) return;
  q=(q||'').toLowerCase();
  const lista=produtosVisiveis()
    .filter(p=>!q||(p.nome||'').toLowerCase().includes(q)||(p.codigo||'').toLowerCase().includes(q))
    .sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).slice(0,50);
  if(!lista.length){
    body.innerHTML=`<div style="padding:18px;text-align:center;color:var(--gray);font-size:13px">Nenhum produto.${todosProdutos.length?'':' Cadastre em Estoque primeiro.'}</div>`;
    return;
  }
  body.innerHTML=lista.map(p=>{
    const saldo=saldoProduto(p.id);
    return `<div class="modal-cli-item" onmousedown="vincularProdutoSvc('${p.id}')">
      <div class="mcn">${esc(p.nome)} <span style="font-weight:400;color:var(--gray);font-size:12px">${brl(p.preco_venda||0)}</span></div>
      <div class="mcd">${[p.codigo,'saldo: '+fmtQtd(saldo)+' '+(p.unidade||'')].filter(Boolean).map(esc).join(' · ')}</div>
    </div>`;
  }).join('');
}
function vincularProdutoSvc(produtoId){
  const p=produtoById(produtoId); if(!p) return;
  const s=svcs.find(x=>x.id===_pickerSvcId);
  if(s){
    s.produto_id=produtoId;
    if(!s.d || !s.d.trim()) s.d=p.nome;       // preenche descrição se vazia
    if(!s.p || parseFloat(s.p)===0) s.p=String(p.preco_venda||0); // preenche preço se vazio
  }
  fecharPickerProduto();
  renderSvcs(); upd();
  toast('📦 Produto vinculado — dá baixa ao aprovar');
}
function desvincularProdutoSvc(svcId){
  const s=svcs.find(x=>x.id===svcId); if(s) s.produto_id=null;
  renderSvcs(); upd();
}

// ──────────────────────────────────────────────────
//  FOTO
// ──────────────────────────────────────────────────
const FOTO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB — compressImage reduz antes de salvar

// fix #5: comprime imagem antes de armazenar como base64 (evita payloads gigantes no banco)
// maxW: largura máxima em px; quality: 0–1 JPEG
function compressImage(dataUrl, maxW=1200, quality=0.75){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const scale=Math.min(1, maxW/img.width);
      const w=Math.round(img.width*scale);
      const h=Math.round(img.height*scale);
      const canvas=document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>resolve(dataUrl); // fallback: retorna original se falhar
    img.src=dataUrl;
  });
}
function renderFotosOrcSlots(){
  const grid=document.getElementById('fotos-orc-grid'); if(!grid) return;
  grid.innerHTML='';
  for(let i=0;i<6;i++){
    const slot=document.createElement('div');
    slot.className='fotos-orc-slot'+(fotosB64[i]?' filled':'');
    slot.innerHTML=`
      <input type="file" id="forc-inp-${i}" accept="image/*" style="display:none" onchange="carregarFotoOrc(this,${i})">
      ${fotosB64[i]?`<img src="${fotosB64[i]}" alt="foto ${i+1}">`:'' }
      <div class="fotos-orc-slot-icon">📷</div>
      <div class="fotos-orc-slot-lbl">Foto ${i+1}</div>
      <button class="fotos-orc-rm" onclick="event.stopPropagation();removerFotoOrc(${i})" title="Remover">✕</button>`;
    slot.addEventListener('click',()=>document.getElementById(`forc-inp-${i}`).click());
    grid.appendChild(slot);
  }
}
function carregarFotoOrc(inp, idx){
  const f=inp.files[0]; if(!f) return;
  if(f.size > FOTO_MAX_BYTES){ toast('⚠️ Foto muito grande (máx 20 MB).'); inp.value=''; return; }
  const r=new FileReader();
  r.onload=async e=>{ fotosB64[idx]=await compressImage(e.target.result); renderFotosOrcSlots(); }; // fix #5: comprime antes de armazenar
  r.readAsDataURL(f);
}
function removerFotoOrc(idx){
  fotosB64[idx]=null;
  // compact: remove trailing nulls
  while(fotosB64.length && !fotosB64[fotosB64.length-1]) fotosB64.pop();
  renderFotosOrcSlots();
}

// ──────────────────────────────────────────────────
//  CÁLCULOS
// ──────────────────────────────────────────────────
function sub(){ return svcs.reduce((a,s)=>a+gP(s),0); }
function disc(st){ const v=parseFloat(gV('disc-v'))||0,t=gV('disc-t'); if(v<=0) return 0; return t==='%'?st*v/100:Math.min(v,st); }
function tot(){ const s=sub(); return Math.max(0,s-disc(s)); }
function brl(v){ return 'R$ '+v.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }

// ──────────────────────────────────────────────────
//  ATUALIZAR UI
// ──────────────────────────────────────────────────
function updPag(){
  const v=gV('pag');
  const temExtra=['boleto-parc','entrada-boleto','entrada-pix','cartao-parc'].includes(v);
  const temEntrada=['entrada-boleto','entrada-pix'].includes(v);
  const temParc=['boleto-parc','entrada-boleto','cartao-parc'].includes(v);
  const extraEl=document.getElementById('pag-extra');
  if(extraEl) extraEl.style.display=temExtra?'flex':'none';
  const fEnt=document.getElementById('pag-f-entrada');
  if(fEnt) fEnt.style.display=temEntrada?'block':'none';
  const fParc=document.getElementById('pag-f-parcelas');
  if(fParc) fParc.style.display=temParc?'block':'none';
}
function formatPagamento(pag, total){
  const entrada=parseFloat((gV('pag-entrada')||'0').replace(',','.'))||0;
  const parcelas=parseInt(gV('pag-parcelas'))||2;
  if(pag==='boleto-parc'){
    const vParc=total/parcelas;
    return `Boleto parcelado — ${parcelas}x de ${brl(vParc)}`;
  }
  if(pag==='entrada-boleto'){
    const resto=Math.max(0,total-entrada);
    const vParc=parcelas>1?resto/parcelas:resto;
    const parcStr=parcelas>1?`${parcelas}x de ${brl(vParc)} no Boleto`:`${brl(resto)} no Boleto`;
    return `Entrada de ${brl(entrada)} + ${parcStr}`;
  }
  if(pag==='entrada-pix'){
    const resto=Math.max(0,total-entrada);
    return `Entrada de ${brl(entrada)} + ${brl(resto)} no Pix/Dinheiro`;
  }
  if(pag==='cartao-parc'){
    const vParc=total/parcelas;
    return `Cartão parcelado — ${parcelas}x de ${brl(vParc)}`;
  }
  return pag;
}
function upd(){
  const s=sub(),d=disc(s),t=Math.max(0,s-d);
  setV_el('d-tot',brl(t),'textContent');
  if(d>0){ show('row-sub'); show('row-disc'); setV_el('d-sub',brl(s),'textContent'); setV_el('d-disc','− '+brl(d),'textContent'); }
  else { hide('row-sub'); hide('row-disc'); }
  // validade
  const dias=parseInt(gV('val'))||5, base=gV('data-orc');
  if(base){ const dv=new Date(base+'T12:00:00'); dv.setDate(dv.getDate()+dias); document.getElementById('vdate').textContent='Válido até '+dv.toLocaleDateString('pt-BR'); }
  gerarPrev();
}

// ──────────────────────────────────────────────────
//  WHATSAPP
// ──────────────────────────────────────────────────
function txtWA(){
  const cli=gV('cli')||'Cliente', loc=gV('loc'), pag=gV('pag'), dias=parseInt(gV('val'))||5, obs=gV('obs'), escopo=gV('escopo'), base=gV('data-orc');
  const s=sub(), d=disc(s), t=Math.max(0,s-d);
  let vData='', vStr=`${dias} dias`;
  if(base){
    const dv=new Date(base+'T12:00:00'); dv.setDate(dv.getDate()+dias);
    vData=dv.toLocaleDateString('pt-BR'); vStr=`${dias} dias — até *${vData}*`;
  }
  const nome1=cli.split(' ')[0]; // primeiro nome
  const vals=svcs.filter(s=>s.d.trim());
  const ocultarValores=document.getElementById('toggle-ocultar-valores')?.checked;
  let tx=`Olá, *${nome1}*! 👋\n\n`;
  tx+=`Preparei o orçamento que você solicitou. Segue abaixo:\n\n`;
  tx+=`━━━━━━━━━━━━━━━━━━━━━━━\n`;
  tx+=`🏢 *${CFG.nome}*\n`;
  if(loc) tx+=`📍 ${loc}\n`;
  tx+=`━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  if(escopo) tx+=`📝 _${escopo}_\n\n`;
  if(vals.length){
    tx+=`🔧 *Serviços:*\n`;
    const temMultiWA=vals.some(sv=>(parseInt(sv.qty)||1)>1);
    vals.forEach((sv,i)=>{
      const qty=parseInt(sv.qty)||1;
      const pUnit=parseFloat(sv.p)||0;
      const pTotal=gP(sv);
      let detalhe='';
      if(!ocultarValores&&pTotal>0){
        if(temMultiWA&&qty>1) detalhe=` — ${qty}× ${brl(pUnit)} = *${brl(pTotal)}*`;
        else detalhe=` — *${brl(pTotal)}*`;
      }
      tx+=`  ${i+1}. ${sv.d.trim()}${detalhe}\n`;
    });
    tx+=`\n`;
  }
  if(!ocultarValores&&d>0){
    tx+=`Subtotal: ${brl(s)}\n`;
    tx+=`🎁 Desconto especial: *− ${brl(d)}*\n\n`;
  }
  tx+=`💰 *Valor total: ${brl(t)}*\n`;
  tx+=`💳 Pagamento: ${pag}\n`;
  tx+=`⏳ Válido por ${vStr}\n\n`;
  if(obs) tx+=`📋 _${obs}_\n\n`;
  tx+=`━━━━━━━━━━━━━━━━━━━━━━━\n`;
  tx+=`✅ *Para confirmar, é só responder aqui!*\n`;
  tx+=`_Assim que aprovado, agendamos tudo com prioridade._ 🗓️\n\n`;
  tx+=`_Qualquer dúvida estou à disposição. 😊_\n\n`;
  tx+=`*${CFG.nome}*`;
  if(CFG.tel) tx+=`\n📞 ${CFG.tel}`;
  return tx;
}
function gerarPrev(){ document.getElementById('prev-wa').textContent=txtWA(); }

// ══════════════════════════════════════════════════════════════════════
//  WIZARD MOBILE — NOVO ORÇAMENTO (17/08, portado do fluxa-app v1)
//  Abaixo de 900px, só um dos 3 cards fica visível por vez. Os campos
//  NUNCA saem do DOM (só style.display), então tudo que lê .value direto
//  — rascunho automático, prévia de WhatsApp — continua funcionando igual
//  em qualquer passo.
// ══════════════════════════════════════════════════════════════════════
let _orcMobileStep=1;
function _orcIsMobileWizard(){ return window.innerWidth<=900 && !!document.getElementById('novo-orc-steps'); }
const _ORC_STEP_GRUPOS={
  1:['orc-step-cliente'],
  2:['orc-step-servicos-card'],
  3:['orc-step-final']
};
function _orcApplyMobileStep(){
  const mobile=_orcIsMobileWizard();
  Object.keys(_ORC_STEP_GRUPOS).forEach(k=>{
    const show=!mobile||Number(k)===_orcMobileStep;
    _ORC_STEP_GRUPOS[k].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display=show?'':'none'; });
  });
  const botoes=document.querySelectorAll('#novo-orc-steps button');
  botoes.forEach((btn,i)=>{
    btn.classList.toggle('on', (i+1)===_orcMobileStep);
    btn.classList.toggle('done', (i+1)<_orcMobileStep);
  });
  const nav=document.getElementById('novo-orc-nav'); if(!nav) return;
  const voltar=_orcMobileStep>1?`<button type="button" class="orc-nav-voltar" onclick="_orcIrParaPasso(${_orcMobileStep-1})">← Voltar</button>`:'';
  const proximo=_orcMobileStep<3
    ?`<button type="button" class="orc-nav-prox" onclick="_orcIrParaPasso(${_orcMobileStep+1})">Próximo →</button>`
    :`<button type="button" class="orc-nav-prox" onclick="_orcMobileFinalizar()">Gerar PDF →</button>`;
  nav.innerHTML=voltar+proximo;
}
function _orcIrParaPasso(n){
  _orcMobileStep=Math.min(3,Math.max(1,n));
  _orcApplyMobileStep();
  window.scrollTo({top:document.getElementById('novo-orc-steps')?.offsetTop-8||0, behavior:'smooth'});
}
// Confirma os campos obrigatórios do passo 1 (cliente/local/origem — os
// mesmos que salvarApenas()/gerarPDF() já validam) ANTES de chamar a
// função real: se faltar algo, volta pro passo 1 primeiro, senão o toast
// de erro apontaria pra um campo escondido nos passos 2/3.
function _orcMobileFinalizar(){
  if(!gV('cli')||!gV('loc')||!gV('origem-cli')){
    _orcIrParaPasso(1);
    toast('⚠️ Complete os dados do cliente antes de gerar o PDF');
    return;
  }
  gerarPDF();
}
window.addEventListener('resize', ()=>{ if(document.getElementById('page-form')?.classList.contains('on')) _orcApplyMobileStep(); });
function copiarWA(){ navigator.clipboard.writeText(txtWA()).then(()=>toast('✅ Copiado!')).catch(()=>toast('✅ Copiado!')); }
function enviarWA(){
  let tel=(gV('tel-cli')||'').replace(/\D/g,'');
  if(!tel){ toast('⚠️ Informe o telefone do cliente'); return; }
  if(!tel.startsWith('55')) tel='55'+tel;
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(txtWA())}`, '_blank');
  salvarChip();
}

// ──────────────────────────────────────────────────
//  SALVAR ORÇAMENTO (sem PDF)
// ──────────────────────────────────────────────────

// ════════════════════════════════════════════════════════════════════
//  SINCRONIZAÇÃO RESILIENTE COM SUPABASE (proteção contra coluna ausente)
// ────────────────────────────────────────────────────────────────────
//  Se o código gravar uma coluna que ainda não existe no banco, o Supabase
//  rejeita a operação INTEIRA — e, se ignorarmos o erro, o registro deixa de
//  sincronizar SEM avisar ninguém (foi o que aconteceu com origem_cliente e
//  derrubou todos os orçamentos). Estes wrappers detectam a coluna que falta,
//  removem do payload e reenviam — registrando um aviso claro no console.
//  Use SEMPRE dbInsert/dbUpdate para gravar em tabelas, nunca db.from().insert direto.
function _colunaFaltante(err){
  if(!err) return null;
  const msg=((err.message||'')+' '+(err.details||'')+' '+(err.hint||''));
  // formatos comuns:
  //  PostgREST select: column "x" of relation "t" does not exist  /  column t.x does not exist
  //  PostgREST insert (schema cache): Could not find the 'x' column of 't' in the schema cache
  let m=msg.match(/column "?([a-z_][a-z0-9_]*)"? of relation/i)
       || msg.match(/find the '([a-z_][a-z0-9_]*)' column/i)
       || msg.match(/column ["']?[a-z_]+\.([a-z_][a-z0-9_]*)["']? does not exist/i)
       || msg.match(/column ["']?([a-z_][a-z0-9_]*)["']? does not exist/i);
  return m?m[1]:null;
}
// ── MULTI-TENANT: injeta empresa_id em TODA escrita (ponto único) ──
// A RLS no banco já isola por empresa, mas gravar empresa_id garante que o registro
// nasça vinculado à empresa ativa. Tabelas sem a coluna empresa_id ficam de fora.
const _TABELAS_SEM_EMPRESA = new Set(['empresas','membros','contadores']);
function _injetarEmpresa(table, payload){
  if(!EMPRESA_ID || _TABELAS_SEM_EMPRESA.has(table)) return {...payload};
  if(payload && payload.empresa_id) return {...payload};
  return { ...payload, empresa_id: EMPRESA_ID };
}
// Envolve uma query do Supabase num timeout — evita que o app fique preso
// em "Salvando…" para sempre quando a rede falha sem responder.
function _dbRace(promise, ms=12000){
  return Promise.race([
    Promise.resolve(promise),
    new Promise(res=>setTimeout(()=>res({ data:null, error:{ message:'timeout: banco não respondeu em '+(ms/1000)+'s', _timeout:true } }), ms))
  ]);
}
async function dbInsert(table, payload, select){
  let p=_injetarEmpresa(table, payload);
  for(let i=0;i<8;i++){
    let q=db.from(table).insert([p]);
    if(select) q=q.select(select).single(); else q=q.select('*').single();
    const r=await _dbRace(q);
    if(!r.error) return r;
    const col=_colunaFaltante(r.error);
    if(col && (col in p)){ delete p[col]; console.warn(`[dbInsert ${table}] coluna "${col}" não existe no banco — reenviando sem ela. Crie a coluna no Supabase.`); continue; }
    return r; // outro erro: devolve para o chamador tratar
  }
  return { data:null, error:{ message:'dbInsert: colunas faltantes demais em '+table } };
}
async function dbUpdate(table, payload, idCol, idVal){
  let p=_injetarEmpresa(table, payload);
  for(let i=0;i<8;i++){
    const r=await _dbRace(db.from(table).update(p).eq(idCol,idVal));
    if(!r.error) return r;
    const col=_colunaFaltante(r.error);
    if(col && (col in p)){ delete p[col]; console.warn(`[dbUpdate ${table}] coluna "${col}" não existe no banco — reenviando sem ela.`); continue; }
    return r;
  }
  return { error:{ message:'dbUpdate: colunas faltantes demais em '+table } };
}
// Upsert resiliente — insere ou atualiza pela PK; ideal p/ tabelas com id texto (vistorias).
// Remove coluna ausente e reenvia, como dbInsert/dbUpdate.
async function dbUpsert(table, payload){
  let p=_injetarEmpresa(table, payload);
  for(let i=0;i<8;i++){
    const r=await _dbRace(db.from(table).upsert([p]).select('*').single());
    if(!r.error) return r;
    const col=_colunaFaltante(r.error);
    if(col && (col in p)){ delete p[col]; console.warn(`[dbUpsert ${table}] coluna "${col}" não existe no banco — reenviando sem ela.`); continue; }
    return r;
  }
  return { data:null, error:{ message:'dbUpsert: colunas faltantes demais em '+table } };
}
// v2: numeração POR EMPRESA via RPC atômica proximo_numero (tabela contadores).
// A RPC incrementa o contador da empresa num passo atômico — sem corrida entre
// usuários e sem depender de índice único. Offline, o chamador já usou um número
// provisório local; ao reconciliar no sync o registro passa por aqui e recebe o
// número definitivo do servidor.
const _TIPO_NUMERO = { orcamentos:'orcamento', ordens_servico:'os' };
async function dbInsertNumerado(table, payload, tentativas=6){
  const tipo=_TIPO_NUMERO[table]||table;
  // 1) número autoritativo via RPC (caminho normal, online)
  if(EMPRESA_ID){
    try{
      const {data:num, error}=await _dbRace(db.rpc('proximo_numero',{p_empresa:EMPRESA_ID, p_tipo:tipo}));
      if(!error && num!=null){
        const r=await dbInsert(table, {...payload, numero:num});
        if(!r.error) return r; // sucesso
        // colisão improvável (dados legados) → cai no fallback max+1
      } else if(error){ console.warn('[proximo_numero]', error.message||error); }
    }catch(e){ console.warn('[proximo_numero]', e?.message||e); }
  }
  // 2) fallback: max+1 escopado por empresa, com retry por conflito de UNIQUE
  for(let t=0;t<tentativas;t++){
    const {data:rows}=await _dbRace(db.from(table).select('numero').eq('empresa_id',EMPRESA_ID).order('numero',{ascending:false}).limit(1));
    const num=(rows&&rows.length?(rows[0].numero||0):0)+1+t; // +t evita reusar o mesmo nº em colisões seguidas
    const r=await dbInsert(table, {...payload, numero:num});
    if(!r.error) return r;
    const msg=(r.error.message||'').toLowerCase();
    const conflito = r.error.code==='23505' || /duplicate key|unique|already exists|violates unique/.test(msg);
    if(conflito) continue; // outro usuário pegou esse número — tenta o próximo
    return r; // erro diferente: devolve ao chamador
  }
  return { data:null, error:{ message:'dbInsertNumerado: não conseguiu número único em '+table } };
}
// Compat: helpers de orçamento agora delegam ao wrapper genérico
async function orcSyncInsert(payload){ return dbInsert('orcamentos', payload); }
async function orcSyncUpdate(id, payload){ return dbUpdate('orcamentos', payload, 'id', id); }
// tempIds (local_*) cujo insert em background está EM VOO. loadHist/_reenviarOrcamentos
// Locais pulam esses — senão o go('history') do próprio salvarApenas reenviava o
// registro antes do insert de background terminar de removê-lo, gerando DUPLICATA
// (2 linhas com o mesmo numero). Ver salvarApenas (novo) e loadHist.
const _orcSyncInFlight = new Set();
// Reenvia ao banco orçamentos que ficaram presos só no aparelho (id local_*),
// ex.: criados enquanto o insert falhava pela coluna origem_cliente ausente.
async function _reenviarOrcamentosLocais(soLocal){
  if(!dbOk||!db||!soLocal||!soLocal.length) return false;
  // Guard central: nunca reenvia um tempId cujo insert já está EM VOO (salvarApenas).
  // Protege TODOS os chamadores (loadHist, sync periódico de 90s, visibilitychange)
  // contra a duplicata — o insert de background já vai gravar esse registro.
  soLocal=soLocal.filter(r=>!_orcSyncInFlight.has(r.id));
  if(!soLocal.length) return false;
  let mudou=false;
  for(const rec of soLocal){
    try{
      const payload={...rec}; delete payload.id; // banco gera o id definitivo
      const {data:ins,error}=await orcSyncInsert(payload);
      if(error){ console.warn('[reenvioLocal] falhou #'+(rec.numero||'?')+':', error.message); continue; }
      if(ins){
        lsOrcRemover(rec.id); lsOrcUpsert(ins);
        todosOrc=todosOrc.filter(x=>x.id!==rec.id);
        todosOrc.unshift(ins);
        mudou=true;
      }
    }catch(e){ console.warn('[reenvioLocal] erro:', e?.message||e); }
  }
  return mudou;
}

async function salvarApenas(){
  const btn=document.getElementById('btn-salvar');
  const dados=coletarForm();
  if(!dados.cli||dados.cli==='—'){ toast('⚠️ Informe o nome do cliente'); return; }
  if(!dados.origem){ toast('⚠️ Informe de onde veio o cliente'); document.getElementById('origem-cli')?.focus(); document.getElementById('origem-cli')?.scrollIntoView({behavior:'smooth',block:'center'}); return; }
  btn.disabled=true; btn.textContent='Salvando…';
  let savedNum=null;
  try{
    const now=new Date().toISOString();
    const camposBase={
      cliente:dados.cli, cliente_id:dados.cliId||await _autoSalvarCliente(dados.cli,dados.tel,dados.loc,dados.cnpj,dados.loja_id,dados.cpf)||null, local_servico:dados.loc, tel_cliente:dados.tel, cnpj:dados.cnpj||null, cpf_cliente:dados.cpf||null,
      loja_id:dados.loja_id||LOJA_PADRAO_ID,
      origem_cliente:dados.origem||null,
      servicos:dados.svcs, subtotal:dados.sub, desconto:dados.desc, total:dados.tot,
      pagamento:dados.pagFormatado, pag_cod:dados.pag, pag_parcelas:dados.pagParcelas, pag_entrada:dados.pagEntrada,
      validade_dias:dados.dias, validade_data:dados.vData,
      data_servico:dados.dataSvc, escopo:dados.escopo, obs:dados.obs,
    municipio_servico_ibge:dados.municipioServico||null,
    ocultar_valores:dados.ocultarValores||false,
      foto_base64:fotosB64.filter(Boolean).length?JSON.stringify(fotosB64.filter(Boolean)):null, nota_interna:gV('nota-interna')||null
    };

    if(editId){
      // ── EDITAR ──
      const existing=todosOrc.find(x=>x.id===editId)||{};
      savedNum=existing.numero||lsOrcProxNum();
      const updated={...existing,...camposBase,id:editId,numero:savedNum};
      // 1. Salva local
      lsOrcUpsert(updated);
      const idx=todosOrc.findIndex(x=>x.id===editId);
      if(idx>=0) todosOrc[idx]=updated; else todosOrc.unshift(updated);
      // 2. Tenta sincronizar com BD (sem bloquear)
      if(dbOk&&db&&!String(editId).startsWith('local_')){
        (async()=>{
          try{
            // Sobe fotos pro Storage antes de gravar — a linha no banco fica leve
            // (URL, não base64). Se o upload falhar, a foto continua local (base64).
            const fotosUp = await _fotosParaStorage(camposBase.foto_base64, editId, 'orcamentos-fotos');
            const payload = {...camposBase, foto_base64: fotosUp&&fotosUp.length?JSON.stringify(fotosUp):null};
            const r = await orcSyncUpdate(editId, payload);
            if(r.error) console.warn('[salvarApenas] update falhou:', r.error.message);
          }catch(e){ console.warn('[salvarApenas] update erro:', e?.message||e); }
        })();
      }
      await _autoSalvarCliente(dados.cli, dados.tel, dados.loc, dados.cnpj, dados.loja_id, dados.cpf);
      toast('✅ Orçamento atualizado!');
    } else {
      // ── NOVO ──
      const tempId='local_'+Date.now();
      const num=lsOrcProxNum(); savedNum=num;
      const rec={...camposBase, id:tempId, numero:num, status:'pendente', data_criacao:now};
      await _autoSalvarCliente(dados.cli, dados.tel, dados.loc, dados.cnpj, dados.loja_id, dados.cpf);
      // 1. Salva local IMEDIATAMENTE
      lsOrcUpsert(rec);
      todosOrc.unshift(rec);
      editId=tempId;
      toast('✅ Orçamento #'+String(num).padStart(3,'0')+' salvo!');
      // 2. Tenta sincronizar com BD em background
      if(dbOk&&db){
        _orcSyncInFlight.add(tempId); // trava reenvio concorrente (loadHist) até terminar
        (async()=>{
          try{
            const fotosUp = await _fotosParaStorage(camposBase.foto_base64, tempId, 'orcamentos-fotos');
            const payloadDB = {...camposBase, foto_base64: fotosUp&&fotosUp.length?JSON.stringify(fotosUp):null, status:'pendente', data_criacao:now};
            const {data:ins,error:insErr}=await dbInsertNumerado('orcamentos',payloadDB);
            if(insErr){ console.warn('Sync BD falhou — orçamento permanece local:', insErr.message); return; }
            if(ins){
              lsOrcRemover(tempId);
              lsOrcUpsert(ins);
              todosOrc=todosOrc.filter(x=>x.id!==tempId);
              todosOrc.unshift(ins);
              if(editId===tempId) editId=ins.id; // só atualiza se AINDA estiver neste orçamento
              savedNum=ins.numero;
              atualizarDash(); renderTabela();
            }
          }catch(e){ console.warn('Sync BD falhou — salvo local:', e?.message||e); }
          finally{ _orcSyncInFlight.delete(tempId); }
        })();
      }
    }
    salvarChip();
    autoSalvarClienteDoOrc(dados);
    // Se o orçamento editado já está aprovado, reconcilia o estoque (qtd/produtos podem ter mudado)
    { const _o=todosOrc.find(x=>x.id===editId); if(_o&&_o.status==='aprovado') sincronizarBaixaOrcamento(_o); }
    atualizarDash(); renderTabela();
    if(document.getElementById('toggle-os')?.checked) await criarOSjunto(dados, savedNum);
    limparRascunho('form');
    toast(`✅ Orçamento #${String(savedNum).padStart(3,'0')} salvo!`);
    // Após salvar (edição OU novo): limpa o form (evita dados/duplicata do
    // orçamento anterior) e volta ao histórico.
    _limparCamposOrc();
    go('history');
  }catch(e){ console.error(e); toast('⚠️ Erro ao salvar: '+e.message); }
  btn.disabled=false; btn.textContent='Salvar Orçamento';
}


// ──────────────────────────────────────────────────
//  GERAR PDF ORÇAMENTO
// ──────────────────────────────────────────────────
async function gerarPDF(){
  const btn=document.getElementById('btn-pdf');
  const dadosPre=coletarForm();
  if(!dadosPre.origem){ toast('⚠️ Informe de onde veio o cliente'); document.getElementById('origem-cli')?.focus(); document.getElementById('origem-cli')?.scrollIntoView({behavior:'smooth',block:'center'}); return; }
  btn.disabled=true; btn.textContent='Gerando…';
  const dados=dadosPre;
  const now=new Date().toISOString();
  const camposBase={
    cliente:dados.cli, cliente_id:dados.cliId||await _autoSalvarCliente(dados.cli,dados.tel,dados.loc,dados.cnpj,dados.loja_id,dados.cpf)||null, local_servico:dados.loc, tel_cliente:dados.tel, cnpj:dados.cnpj||null, cpf_cliente:dados.cpf||null,
    loja_id:dados.loja_id||LOJA_PADRAO_ID,
    origem_cliente:dados.origem||null,
    servicos:dados.svcs, subtotal:dados.sub, desconto:dados.desc, total:dados.tot,
    pagamento:dados.pagFormatado, pag_cod:dados.pag, pag_parcelas:dados.pagParcelas, pag_entrada:dados.pagEntrada,
    validade_dias:dados.dias, validade_data:dados.vData,
    data_servico:dados.dataSvc, escopo:dados.escopo, obs:dados.obs,
    municipio_servico_ibge:dados.municipioServico||null,
    ocultar_valores:dados.ocultarValores||false,
    foto_base64:fotosB64.filter(Boolean).length?JSON.stringify(fotosB64.filter(Boolean)):null, nota_interna:gV('nota-interna')||null
  };
  let num=null;
  await _autoSalvarCliente(dados.cli, dados.tel, dados.loc, dados.cnpj, dados.loja_id, dados.cpf);

  if(editId){
    // Editando: mantém número existente
    const existing=todosOrc.find(x=>x.id===editId)||{};
    num=existing.numero||lsOrcProxNum();
    const updated={...existing,...camposBase,id:editId,numero:num};
    lsOrcUpsert(updated);
    const idx=todosOrc.findIndex(x=>x.id===editId);
    if(idx>=0) todosOrc[idx]=updated;
    if(dbOk&&db&&!String(editId).startsWith('local_')){
      (async()=>{
        try{
          const fotosUp = await _fotosParaStorage(camposBase.foto_base64, editId, 'orcamentos-fotos');
          const payload = {...camposBase, foto_base64: fotosUp&&fotosUp.length?JSON.stringify(fotosUp):null};
          const r = await orcSyncUpdate(editId, payload);
          if(r.error) console.warn('[gerarPDF] update falhou:', r.error.message);
        }catch(e){ console.warn('[gerarPDF] update erro:', e?.message||e); }
      })();
    }
  } else {
    // Novo: salva local primeiro, depois sincroniza BD
    num=lsOrcProxNum();
    const tempId='local_'+Date.now();
    const rec={...camposBase,id:tempId,numero:num,status:'pendente',data_criacao:now};
    lsOrcUpsert(rec);
    todosOrc.unshift(rec);
    editId=tempId;
    logAcao('orcamento_criado', `#${num} ${camposBase.cliente||''} · R$ ${(camposBase.total||0).toFixed(2)}`);
    if(dbOk&&db){
      _orcSyncInFlight.add(tempId); // trava reenvio concorrente (loadHist) até terminar — mesma trava do salvarApenas, faltava aqui (causava duplicata)
      (async()=>{
        try{
          const fotosUp = await _fotosParaStorage(camposBase.foto_base64, tempId, 'orcamentos-fotos');
          const payloadDB = {...camposBase, foto_base64: fotosUp&&fotosUp.length?JSON.stringify(fotosUp):null, status:'pendente', data_criacao:now};
          const {data:ins,error:insErr}=await dbInsertNumerado('orcamentos',payloadDB);
          if(insErr){ console.warn('gerarPDF: sync BD falhou — orçamento permanece local:', insErr.message); return; }
          if(ins){
            lsOrcRemover(tempId);
            lsOrcUpsert(ins);
            todosOrc=todosOrc.filter(x=>x.id!==tempId&&x.id!==ins.id); // remove tempId + eventual cópia já trazida pelo Realtime, antes de reinserir
            todosOrc.unshift(ins);
            if(editId===tempId) editId=ins.id; // só atualiza se AINDA estiver neste orçamento
            num=ins.numero;
            atualizarDash(); renderTabela();
          }
        }catch(e){ console.warn('gerarPDF: sync BD falhou:', e?.message||e); }
        finally{ _orcSyncInFlight.delete(tempId); }
      })();
    }
  }

  const numStr=String(num).padStart(3,'0');
  preencherDocOrc(dados, numStr);
  salvarChip();
  { const _o=todosOrc.find(x=>x.id===editId); if(_o&&_o.status==='aprovado') sincronizarBaixaOrcamento(_o); }
  limparRascunho('form'); // orçamento salvo → rascunho não deve vazar para o próximo
  btn.disabled=false; btn.textContent='Gerar PDF';
  if(document.getElementById('toggle-os')?.checked){
    await criarOSjunto(dados, num);
  } else {
    imprimirDoc('orc');
  }
  // Após gerar PDF: limpa o form (evita dados/duplicata do anterior) e volta ao histórico
  _limparCamposOrc();
  go('history');
}

function updOrigemCli(){
  const sel=gV('origem-cli');
  const wrap=document.getElementById('origem-cli-outro-wrap');
  if(wrap) wrap.style.display=(sel==='outro')?'':'none';
}
function setOrigemCli(valor){
  const sel=document.getElementById('origem-cli');
  if(!sel) return;
  if(!valor){ sel.value=''; setV('origem-cli-outro',''); updOrigemCli(); return; }
  const opcao=[...sel.options].find(o=>o.value===valor);
  if(opcao){ sel.value=valor; setV('origem-cli-outro',''); }
  else { sel.value='outro'; setV('origem-cli-outro',valor); }
  updOrigemCli();
}
function getOrigemCli(){
  const sel=gV('origem-cli');
  if(sel==='outro') return (gV('origem-cli-outro')||'').trim();
  return sel||'';
}

function coletarForm(){
  const base=gV('data-orc'), dias=parseInt(gV('val'))||5;
  let dataStr=new Date().toLocaleDateString('pt-BR'), vData='';
  if(base){ dataStr=new Date(base+'T12:00:00').toLocaleDateString('pt-BR'); const dv=new Date(base+'T12:00:00'); dv.setDate(dv.getDate()+dias); vData=dv.toLocaleDateString('pt-BR'); }
  return { cli:gV('cli')||'—', cliId:gV('cli-id')||null, loc:gV('loc'), tel:gV('tel-cli'), cnpj:gV('cnpj-cli'), cpf:gV('cpf-cli'),
    loja_id:gV('orc-loja')||LOJA_PADRAO_ID,
    origem:getOrigemCli(),
    ocultarValores:document.getElementById('toggle-ocultar-valores')?.checked||false,
    pag:gV('pag'), pagFormatado:formatPagamento(gV('pag'),tot()),
    pagParcelas:parseInt(gV('pag-parcelas'))||null,
    pagEntrada:parseFloat((gV('pag-entrada')||'').replace(',','.'))||null,
    dias, obs:gV('obs'),
    escopo:gV('escopo'), dataSvc:gV('data-svc'), dataStr, vData, sub:sub(), desc:disc(sub()), tot:tot(),
    municipioServico:gV('municipio-servico')||null,
    svcs:svcs.filter(s=>s.d.trim()).map(s=>({desc:s.d.trim(),preco:gP(s),precoUnit:parseFloat(s.p)||0,qty:parseInt(s.qty)||1,produto_id:s.produto_id||null})) };
}

function preencherDocOrc(d, num){
  const LC=getLojaConfig(d.loja_id||lojaAtiva); // fix #4: fallback para loja ativa se registro antigo sem loja_id
  const c1=LC.cor, c2=LC.cor2;
  // header
  document.getElementById('pd-header-orc').style.background=c1;
  document.getElementById('pd-thead-orc').style.background=c2;
  document.getElementById('pd-foot-orc').style.background=c2;
  document.getElementById('pd-cli-bar-orc').style.background=c1;
  // logo or initials
  const logoEl=document.getElementById('pd-hdr-logo-orc'), initEl=document.getElementById('pd-hdr-init-orc');
  if(LC.logoB64){ logoEl.src=LC.logoB64; logoEl.className='pd-hdr-logo-img has-logo'; initEl.className='pd-hdr-logo-initials'; }
  else { logoEl.className='pd-hdr-logo-img'; initEl.textContent=LC.nome.charAt(0).toUpperCase(); initEl.className='pd-hdr-logo-initials show-init'; }
  // names + tagline
  setV_el('pd-nm-orc',LC.nome,'textContent');
  setV_el('pd-sb-orc',LC.sub,'textContent');
  const tagOrc=document.getElementById('pd-tag-orc'); if(tagOrc){ tagOrc.textContent=LC.tagline||''; tagOrc.style.display=LC.tagline?'block':'none'; }
  const contato=[LC.tel,LC.cidades].filter(Boolean).join('  ·  ');
  setV_el('pd-cont-orc',contato||LC.nome,'textContent');
  setV_el('pd-num-orc','#'+num,'textContent');
  const validStr=d.vData?`Válido até ${d.vData}`:`${d.dias} dias de validade`;
  document.getElementById('pd-meta-orc').innerHTML=`Data de emissão: <strong>${d.dataStr}</strong><br>${validStr}`;
  setV_el('pd-cli-nm-orc',d.cli,'textContent');
  setV_el('pd-cli-loc-orc',d.loc||'','textContent');
  setV_el('pd-pag-orc',d.pagFormatado||d.pag,'textContent');
  setV_el('pd-val-orc',d.dias+' dias'+(d.vData?' · até '+d.vData:''),'textContent');
  setV_el('pd-sign-resp-orc',LC.nome+' — Responsável Técnico','textContent');
  setV_el('pd-foot-orc',LC.nome+(LC.tel?'   ·   '+LC.tel:'')+(LC.cidades?'   ·   '+LC.cidades:''),'textContent');
  // table body
  const tb=document.getElementById('pd-tbody-orc'); tb.innerHTML='';
  const ocultarValores=!!d.ocultarValores;
  const temMulti=!ocultarValores&&d.svcs.some(s=>(parseInt(s.qty)||1)>1);
  document.getElementById('pd-thead-orc').innerHTML=ocultarValores
    ?'<th>#</th><th>Descrição</th>'
    :temMulti
      ?'<th>#</th><th>Descrição</th><th>Qtd × Unit.</th><th>Total</th>'
      :'<th>#</th><th>Descrição</th><th>Valor</th>';
  d.svcs.forEach((s,i)=>{
    const tr=document.createElement('tr');
    const qty=parseInt(s.qty)||1;
    if(ocultarValores){
      tr.innerHTML=`<td>${i+1}</td><td>${esc(s.desc)}</td>`;
    } else if(temMulti){
      const qtyUnit=s.preco>0?`${qty} × ${brl(s.precoUnit||0)}`:'—';
      const total=s.preco>0?brl(s.preco):'—';
      tr.innerHTML=`<td>${i+1}</td><td>${esc(s.desc)}</td><td>${qtyUnit}</td><td>${total}</td>`;
    } else {
      tr.innerHTML=`<td>${i+1}</td><td>${esc(s.desc)}</td><td>${s.preco>0?brl(s.preco):'—'}</td>`;
    }
    tb.appendChild(tr);
  });
  // totals block (below table, outside table element)
  const tw=document.getElementById('pd-totals-orc');
  let th='';
  if(!ocultarValores&&d.desc>0){
    th+=`<div class="pd-tot-row"><span>Subtotal</span><span>${brl(d.sub)}</span></div>`;
    th+=`<div class="pd-tot-row is-dis"><span>Desconto aplicado</span><span>− ${brl(d.desc)}</span></div>`;
  }
  th+=`<div class="pd-tot-final" style="background:${c1}"><span class="pd-tot-final-lbl">Total</span><span class="pd-tot-final-val">${brl(d.tot)}</span></div>`;
  tw.innerHTML=th;
  // fotos
  const fotosSec=document.getElementById('pd-fotos-orc-section');
  const fotosGrid=document.getElementById('pd-fotos-orc-grid');
  const fotosArr=(Array.isArray(fotosB64)?fotosB64:[]).filter(Boolean);
  if(fotosSec && fotosGrid && fotosArr.length){
    const cols=fotosArr.length===1?1:fotosArr.length<=4?2:3;
    fotosGrid.style.gridTemplateColumns=`repeat(${cols},1fr)`;
    const maxH=fotosArr.length===1?'280px':fotosArr.length<=2?'220px':'160px';
    fotosGrid.innerHTML=fotosArr.map(b=>`<img src="${b}" style="max-height:${maxH}">`).join('');
    fotosSec.style.display='block';
  } else if(fotosSec){
    fotosSec.style.display='none';
  }
  // escopo
  const escopoEl=document.getElementById('pd-escopo-orc');
  if(escopoEl){ if(d.escopo){ document.getElementById('pd-escopo-txt-orc').textContent=d.escopo; escopoEl.style.display='block'; } else escopoEl.style.display='none'; }
  // obs
  const ob=document.getElementById('pd-obs-orc');
  if(d.obs){
    document.getElementById('pd-obs-txt-orc').textContent=d.obs;
    document.getElementById('pd-obs-bar-orc').style.background=c1;
    ob.style.display='flex';
  } else ob.style.display='none';
}

// ──────────────────────────────────────────────────
//  ORDEM DE SERVIÇO
// ──────────────────────────────────────────────────
function initOS(){
  osSvcs=[];
  addOSSvc();
  renderOSSvcs();
}

function addOSSvc(d=''){
  osSvcs.push({id:Date.now()+Math.random(),d});
  renderOSSvcs();
}

// ──────────────────────────────────────────────────
//  CHECKLIST DE EXECUÇÃO (OS)
// ──────────────────────────────────────────────────
function renderOsChecklist(){
  const el=document.getElementById('os-chklist'); if(!el) return;
  if(!osChecklist.length){
    el.innerHTML='<div style="font-size:13px;color:var(--gray);padding:6px 0">Nenhum item. Adicione abaixo ou clique em ↺ Resetar.</div>';
    return;
  }
  el.innerHTML=osChecklist.map((item,i)=>`
    <div class="chk-item ${item.checked?'ok':''}" id="chk-item-${i}">
      <input type="checkbox" class="chk-cb" ${item.checked?'checked':''} onchange="toggleChk(${i},this.checked)">
      <div class="chk-body">
        <div class="chk-nome">${esc(item.nome)}</div>
        <input type="text" class="chk-obs-inp" placeholder="Observação (opcional)" value="${esc(item.obs||'')}" oninput="updChkObs(${i},this.value)">
      </div>
      <button class="chk-rm" onclick="rmChkItem(${i})" title="Remover item">✕</button>
    </div>`).join('');
}
function toggleChk(i, checked){
  if(!osChecklist[i]) return;
  osChecklist[i].checked=checked;
  const el=document.getElementById('chk-item-'+i);
  if(el){ el.className='chk-item'+(checked?' ok':''); }
  if(navigator.vibrate) navigator.vibrate(30);
}
function updChkObs(i, val){ if(osChecklist[i]) osChecklist[i].obs=val; }
function rmChkItem(i){ osChecklist.splice(i,1); renderOsChecklist(); }
function addChkItem(){
  const inp=document.getElementById('chk-add-inp'); if(!inp) return;
  const nome=inp.value.trim(); if(!nome){ toast('⚠️ Digite o nome do item'); return; }
  osChecklist.push({id:Date.now(), nome, checked:false, obs:''});
  inp.value=''; renderOsChecklist();
  // scroll para o último item
  const el=document.getElementById('os-chklist');
  if(el) el.lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function renderOSSvcs(){
  const el=document.getElementById('os-slist'); el.innerHTML='';
  osSvcs.forEach(s=>{
    const r=document.createElement('div'); r.className='srow';
    r.innerHTML=`<div class="srow-t">
      <input type="text" placeholder="Descrição do serviço" value="${esc(s.d)}" data-id="${s.id}" oninput="updOSSvc(this)">
      <button class="btn-rm" onclick="rmOSSvc(${s.id})">✕</button>
    </div>`;
    el.appendChild(r);
  });
}
function updOSSvc(inp){ const s=osSvcs.find(x=>x.id===parseFloat(inp.dataset.id)); if(s) s.d=inp.value; }
function rmOSSvc(id){ if(osSvcs.length===1){toast('⚠️ Mín. 1');return;} osSvcs=osSvcs.filter(s=>s.id!==id); renderOSSvcs(); }

// Salva/atualiza uma OS só no aparelho (localStorage + todosOS em memória) — usado
// como rede de segurança quando não há conexão ou o insert/update no banco falha.
// Achado de auditoria: antes disso, criar/editar OS sem internet (ou com a conexão
// caindo no meio do salvamento) gerava um toast de sucesso mas NÃO salvava a OS em
// lugar nenhum — perda silenciosa de dado. Espelha o padrão já usado (e testado) em
// salvarApenas/gerarPDF pra orçamento.
function _salvarOSLocal(camposBase, tempId, numero){
  const rec={...camposBase, id:tempId, numero, status:camposBase.status||'agendado', data_criacao:new Date().toISOString()};
  const listaLocal=JSON.parse(ls('fluxa_os_hist')||'[]');
  const ix=listaLocal.findIndex(x=>x.id===tempId);
  if(ix>=0) listaLocal[ix]=rec; else listaLocal.unshift(rec);
  lsSet('fluxa_os_hist', JSON.stringify(listaLocal.slice(0,600)));
  const ixMem=todosOS.findIndex(x=>x.id===tempId);
  if(ixMem>=0) todosOS[ixMem]=rec; else todosOS.unshift(rec);
  return rec;
}

async function gerarOSPDF(modo='os'){
  const dados={
    cli:gV('os-cli')||'—', loc:gV('os-loc'), cnpj:gV('os-cnpj')||null, cpf:gV('os-cpf')||null, data:gV('os-data'), hora:gV('os-hora'),
    tec:gV('os-tec'), tot:parseFloat(gV('os-total'))||0,
    mat:_osMatTextoFinal(), obs:gV('os-obs'),
    svcs:osSvcs.filter(s=>s.d.trim()).map(s=>s.d.trim()),
    fotos:{antes:osFotosAntes.filter(Boolean), depois:osFotosDepois.filter(Boolean)}, videoLink:gV('os-video-link'),
    checklist: osChecklist.filter(x=>x.checked),
    loja_id: gV('os-loja')||LOJA_PADRAO_ID
  };
  let numStr='???';
  const orcId=osOrcId||null;
  const lojaIdOS=gV('os-loja')||LOJA_PADRAO_ID;
  const camposBase={orcamento_id:orcId,loja_id:lojaIdOS,cliente:dados.cli,cliente_id:gV('os-cli-id')||await _autoSalvarCliente(dados.cli,null,dados.loc,dados.cnpj,lojaIdOS,dados.cpf)||null,local_servico:dados.loc,cnpj:dados.cnpj||null,cpf_cliente:dados.cpf||null,data_servico:dados.data,hora:dados.hora,tecnico:dados.tec,servicos:dados.svcs,materiais:dados.mat,obs_tecnica:dados.obs,total:dados.tot,fotos:dados.fotos,video_link:dados.videoLink||null,checklist:dados.checklist.length?JSON.stringify(dados.checklist):null,equipamento_id:gV('os-equip-id')||null};
  if(dbOk&&db){
    try{
      // Sobe fotos pro Storage antes de gravar — a linha no banco fica leve (URL, não
      // base64). Se o upload falhar, a foto fica de fora (não perde no PDF gerado agora,
      // só não fica sincronizada no banco até um próximo salvamento bem-sucedido).
      const storageId = (osEditId && !String(osEditId).startsWith('local_')) ? osEditId : ('os_'+Date.now());
      const fotosUp = await _osFotosParaStorage(dados.fotos, storageId);
      const payload={...camposBase, fotos:fotosUp};
      if(osEditId && !String(osEditId).startsWith('local_')){
        // EDIÇÃO: atualiza a OS existente (mantém número e status)
        const existente=todosOS.find(x=>x.id===osEditId);
        const {error}=await db.from('ordens_servico').update(payload).eq('id',osEditId);
        if(error) throw error;
        numStr=String(existente?.numero||'').padStart(3,'0')||'???';
        _salvarOSLocal({...existente,...payload}, osEditId, existente?.numero);
        await _osSyncMateriais(osEditId);
        toast('✅ OS atualizada');
      } else {
        const {data:insOS,error}=await dbInsertNumerado('ordens_servico',{...payload,status:'agendado'});
        if(error) throw error;
        numStr=String(insOS?.numero||'').padStart(3,'0')||'???';
        if(insOS){
          // remove um eventual rascunho local (mesma sessão) e grava a versão definitiva do banco
          if(osEditId && String(osEditId).startsWith('local_')){
            const listaLocal=JSON.parse(ls('fluxa_os_hist')||'[]').filter(x=>x.id!==osEditId);
            lsSet('fluxa_os_hist', JSON.stringify(listaLocal));
            todosOS=todosOS.filter(x=>x.id!==osEditId);
          }
          todosOS.unshift(insOS);
          osEditId=insOS.id;
          // Só agora existe id real — gravar antes deixaria os materiais
          // órfãos, presos ao id local que acabou de deixar de existir.
          await _osSyncMateriais(insOS.id);
        }
      }
    }catch(e){
      console.warn('[gerarOSPDF] falha ao salvar OS no banco:', e?.message||e);
      toast('⚠️ Sem conexão com o banco — OS salva só neste aparelho');
      const n=osEditId&&String(osEditId).startsWith('local_') ? (todosOS.find(x=>x.id===osEditId)?.numero||((parseInt(ls('fluxa_os_num')||'0'))+1)) : ((parseInt(ls('fluxa_os_num')||'0'))+1);
      if(!(osEditId&&String(osEditId).startsWith('local_'))) lsSet('fluxa_os_num',String(n));
      const tempId = (osEditId && String(osEditId).startsWith('local_')) ? osEditId : ('local_'+Date.now());
      _salvarOSLocal(camposBase, tempId, n);
      osEditId=tempId;
      numStr=String(n).padStart(3,'0');
    }
  } else {
    // Offline: mesma rede de segurança — salva local em vez de só gerar um número.
    const n=osEditId&&String(osEditId).startsWith('local_') ? (todosOS.find(x=>x.id===osEditId)?.numero||((parseInt(ls('fluxa_os_num')||'0'))+1)) : ((parseInt(ls('fluxa_os_num')||'0'))+1);
    if(!(osEditId&&String(osEditId).startsWith('local_'))) lsSet('fluxa_os_num',String(n));
    const tempId = (osEditId && String(osEditId).startsWith('local_')) ? osEditId : ('local_'+Date.now());
    _salvarOSLocal(camposBase, tempId, n);
    osEditId=tempId;
    numStr=String(n).padStart(3,'0');
    toast('📴 Sem conexão — OS salva neste aparelho, sincroniza quando reconectar');
  }

  // Se modo 'both', preenche também o orçamento vinculado
  if(modo==='both' && osOrcId){
    const o=todosOrc.find(x=>x.id===osOrcId);
    if(o){
      const numOrc=String(o.numero||0).padStart(3,'0');
      const base=o.validade_data?null:null; // já temos os dados
      const dadosOrc={
        cli:o.cliente||'—', loc:o.local_servico||'', pag:o.pagamento||'—',
        dias:o.validade_dias||5, obs:o.obs||'', dataSvc:o.data_servico||'',
        dataStr:new Date(o.data_criacao||Date.now()).toLocaleDateString('pt-BR'),
        vData:o.validade_data||'', sub:o.subtotal||0, desc:o.desconto||0, tot:o.total||0,
        svcs:o.servicos||[], loja_id:o.loja_id||LOJA_PADRAO_ID
      };
      const savedFotos=[...fotosB64];
      try{ const raw=o.foto_base64||''; fotosB64=raw.startsWith('[')?JSON.parse(raw):(raw?[raw]:[]); }catch(e){ fotosB64=[]; }
      preencherDocOrc(dadosOrc, numOrc);
      fotosB64=savedFotos;
    }
  }

  autoSalvarClienteDoOrc({cli:dados.cli, loc:dados.loc, tel:dados.tel||'', cnpj:dados.cnpj||'', cpf:dados.cpf||''});
  const _orcRef=osOrcId?todosOrc.find(x=>x.id===osOrcId):null;
  const _orcNumStr=_orcRef?String(_orcRef.numero||'').padStart(3,'0'):null;
  preencherDocOS({...dados, fotos:dados.fotos, videoLink:dados.videoLink, orcNum:_orcNumStr}, numStr);
  imprimirDoc(modo);
  // OS salva → limpa o rascunho para não vazar dados na próxima OS
  if(numStr!=='???') limparRascunho('os');
}

function preencherDocOS(d, num){
  const LC=getLojaConfig(d.loja_id||lojaAtiva); // fix #4: fallback para loja ativa se registro antigo sem loja_id
  const c1=LC.cor, c2=LC.cor2;
  document.getElementById('pd-header-os').style.background=c2;
  document.getElementById('pd-thead-os').style.background=c2;
  document.getElementById('pd-foot-os').style.background=c2;
  document.getElementById('pd-cli-bar-os').style.background=c1;
  // logo or initials
  const logoEl=document.getElementById('pd-hdr-logo-os'), initEl=document.getElementById('pd-hdr-init-os');
  if(LC.logoB64){ logoEl.src=LC.logoB64; logoEl.className='pd-hdr-logo-img has-logo'; initEl.className='pd-hdr-logo-initials'; }
  else { logoEl.className='pd-hdr-logo-img'; initEl.textContent=LC.nome.charAt(0).toUpperCase(); initEl.className='pd-hdr-logo-initials show-init'; }
  setV_el('pd-nm-os',LC.nome,'textContent');
  setV_el('pd-sb-os',LC.sub,'textContent');
  const tagOs=document.getElementById('pd-tag-os'); if(tagOs){ tagOs.textContent=LC.tagline||''; tagOs.style.display=LC.tagline?'block':'none'; }
  const contato=[LC.tel,LC.cidades].filter(Boolean).join('  ·  ');
  setV_el('pd-cont-os',contato||LC.nome,'textContent');
  setV_el('pd-num-os','#'+num,'textContent');
  const _orcRef=d.orcNum?` · Referente ao Orçamento <strong>#${d.orcNum}</strong>`:'';
  document.getElementById('pd-meta-os').innerHTML=`Emitida em: <strong>${new Date().toLocaleDateString('pt-BR')}</strong>${_orcRef}`;
  setV_el('pd-cli-nm-os',d.cli,'textContent');
  setV_el('pd-cli-loc-os',d.loc||'','textContent');
  setV_el('pd-data-os',d.data?new Date(d.data+'T12:00:00').toLocaleDateString('pt-BR'):'—','textContent');
  setV_el('pd-hora-os',d.hora||'—','textContent');
  setV_el('pd-tec-os',d.tec||LC.nome,'textContent');
  setV_el('pd-tot-os',d.tot>0?brl(d.tot):'A definir','textContent');
  setV_el('pd-sign-resp-os',LC.nome+' — Responsável Técnico','textContent');
  setV_el('pd-foot-os',LC.nome+(LC.tel?'   ·   '+LC.tel:'')+(LC.cidades?'   ·   '+LC.cidades:''),'textContent');
  const tb=document.getElementById('pd-tbody-os'); tb.innerHTML='';
  d.svcs.forEach((s,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${esc(s)}</td>`; tb.appendChild(tr); });
  const mb=document.getElementById('pd-mat-os');
  if(d.mat){ document.getElementById('pd-mat-txt-os').textContent=d.mat; mb.style.display='flex'; } else mb.style.display='none';
  const ob=document.getElementById('pd-obs-os');
  if(d.obs){
    document.getElementById('pd-obs-txt-os').textContent=d.obs;
    document.getElementById('pd-obs-bar-os').style.background=c1;
    ob.style.display='flex';
  } else ob.style.display='none';
  // checklist OS no PDF (itens verificados/feitos — dá profundidade ao relatório)
  const chkEl=document.getElementById('pd-checklist-os');
  if(chkEl){
    let chk=[];
    try{ chk=d.checklist?(typeof d.checklist==='string'?JSON.parse(d.checklist):d.checklist):[]; }catch(e){ chk=[]; }
    const ok=(chk||[]).filter(x=>x&&x.checked);
    if(ok.length){
      chkEl.style.display='block';
      chkEl.innerHTML='<div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:8px">Checklist do Serviço</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px">'+
        ok.map(x=>`<div style="display:flex;align-items:flex-start;gap:6px;font-size:11.5px;color:#374151"><span style="color:#16a34a;font-weight:700">✓</span><span>${esc(x.nome)}${x.obs?` <span style="color:#6b7280">— ${esc(x.obs)}</span>`:''}</span></div>`).join('')+
        '</div>';
    } else { chkEl.style.display='none'; chkEl.innerHTML=''; }
  }
  // fotos OS no PDF — mesmo esquema adaptativo do orçamento (preencherDocOrc):
  // colunas/altura variam com a quantidade em vez de grid fixo 2 col/140px, que
  // deixava 1 foto minúscula-e-sozinha e 3 fotos com a 3ª cortada mais agressivo
  // que precisava (achado do Marcos, 04/09).
  const fotosEl=document.getElementById('pd-fotos-os');
  // Ordem de serviço é o documento que vai ANTES do serviço — aqui a
  // narrativa antes/depois não existe ainda, só a lista combinada importa.
  const _fotOS=_osFotosNormalizar(d.fotos);
  const fotosArr=[..._fotOS.antes, ..._fotOS.depois];
  if(fotosEl){
    if(fotosArr.length){
      fotosEl.style.display='block';
      const cols=fotosArr.length===1?1:2;
      const maxH=fotosArr.length===1?'320px':fotosArr.length===2?'240px':'190px';
      fotosEl.innerHTML='<div class="pd-fotos-lbl">Fotos do Serviço</div>'+
        `<div class="pd-fotos-grid" style="grid-template-columns:repeat(${cols},1fr)">`+
        fotosArr.map(f=>`<img src="${f}" style="max-height:${maxH};border:1px solid #e9ecef">`).join('')+'</div>';
      if(d.videoLink) fotosEl.innerHTML+=`<div style="margin-top:8px;font-size:11px;color:#6b7280">📹 Vídeo: <a href="${esc(d.videoLink)}">${esc(d.videoLink)}</a></div>`;
    } else { fotosEl.style.display='none'; fotosEl.innerHTML=''; }
  }
}

// ══ ORDEM DE ENTREGA ══════════════════════════════
// Venda de produto avulso (químico, peça) não vira OS: o material só sai e
// alguém no local — em geral zelador ou porteiro — recebe. Faltava o papel que
// essa pessoa confere e assina.
//
// É derivada do orçamento e NÃO cria registro no banco: reimprimir quantas
// vezes quiser não duplica nada e não precisou de schema novo.
// Sem preços, de propósito: o que se confere é O QUE chegou, e quem recebe
// costuma não ter nada a ver com o valor negociado.
function preencherDocEntrega(o){
  const LC=getLojaConfig(o.loja_id||lojaAtiva);
  const c1=LC.cor, c2=LC.cor2;
  document.getElementById('pd-header-ent').style.background=c2;
  document.getElementById('pd-foot-ent').style.background=c2;
  document.getElementById('pd-cli-bar-ent').style.background=c1;
  document.getElementById('pd-obs-bar-ent').style.background=c1;
  const logoEl=document.getElementById('pd-hdr-logo-ent'), initEl=document.getElementById('pd-hdr-init-ent');
  if(LC.logoB64){ logoEl.src=LC.logoB64; logoEl.className='pd-hdr-logo-img has-logo'; initEl.className='pd-hdr-logo-initials'; }
  else { logoEl.className='pd-hdr-logo-img'; initEl.textContent=(LC.nome||'?').charAt(0).toUpperCase(); initEl.className='pd-hdr-logo-initials show-init'; }
  setV_el('pd-nm-ent',LC.nome,'textContent');
  setV_el('pd-sb-ent',LC.sub,'textContent');
  const tagEl=document.getElementById('pd-tag-ent');
  if(tagEl){ tagEl.textContent=LC.tagline||''; tagEl.style.display=LC.tagline?'block':'none'; }
  setV_el('pd-cont-ent',[LC.tel,LC.cidades].filter(Boolean).join('  ·  ')||LC.nome,'textContent');
  const num=String(o.numero||'').padStart(3,'0');
  setV_el('pd-num-ent','#'+num,'textContent');
  // Data da entrega fica em BRANCO: a entrega acontece dias depois da
  // aprovação, e quem preenche é quem recebe, no dia.
  document.getElementById('pd-meta-ent').innerHTML=
    `Referente ao Orçamento <strong>#${num}</strong><br>Data da entrega: ____ / ____ / ______`;
  setV_el('pd-cli-nm-ent',o.cliente||'—','textContent');
  setV_el('pd-cli-loc-ent',o.local_servico||'','textContent');
  setV_el('pd-sign-resp-ent','Entregue por — '+(LC.nome||''),'textContent');
  setV_el('pd-foot-ent',(LC.nome||'')+(LC.tel?'   ·   '+LC.tel:'')+(LC.cidades?'   ·   '+LC.cidades:''),'textContent');
  // TODOS os itens, não só os com produto_id: químico digitado à mão não tem
  // vínculo de produto e mesmo assim precisa ser conferido.
  const tb=document.getElementById('pd-tbody-ent'); tb.innerHTML='';
  (o.servicos||[]).forEach((s,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td style="text-align:center;font-size:15px;color:#9aa6bd">☐</td><td>${i+1}</td><td>${esc(s.desc||'')}</td><td style="text-align:center">${parseInt(s.qty)||1}</td>`;
    tb.appendChild(tr);
  });
}
function gerarOrdemEntrega(id){
  const o=todosOrc.find(x=>x.id===id);
  if(!o){ toast('Orçamento não encontrado'); return; }
  if(!(o.servicos||[]).length){ toast('Este orçamento não tem itens a entregar'); return; }
  preencherDocEntrega(o);
  imprimirDoc('ent');
}

// ──────────────────────────────────────────────────
//  HISTÓRICO
// ──────────────────────────────────────────────────
async function loadHist(){
  initOrcMes(); // garante que o mês de referência esteja definido
  // 1. SEMPRE mostra dados locais primeiro — sem depender do banco
  const local=lsOrcLer();
  if(local.length>0) todosOrc=local;
  verificarVencidos();
  atualizarDash(); renderTabela();

  // 2. Se BD disponível: sincroniza em background e atualiza a view
  if(dbOk&&db){
    try{
      const {data,error}=await db.from('orcamentos').select('*').eq('empresa_id',EMPRESA_ID).order('data_criacao',{ascending:false}).range(0,_ORC_PAGE-1);
      if(error) throw error;
      _orcServidorOffset=data.length; _orcTemMais=data.length===_ORC_PAGE;
      // Merge: BD é fonte de verdade + mantém registros local-only ainda não sincronizados
      const dbIds=new Set(data.map(x=>x.id));
      // exclui tempIds cujo insert já está EM VOO (salvarApenas) — senão duplica
      const soLocal=todosOrc.filter(x=>String(x.id).startsWith('local_')&&!dbIds.has(x.id)&&!_orcSyncInFlight.has(x.id));
      todosOrc=[...data,...soLocal];
      lsOrcSalvar(todosOrc);
      verificarVencidos();
      atualizarDash(); renderTabela();
      // Recupera orçamentos presos só no aparelho (não sincronizados) → reenvia ao banco
      if(soLocal.length){
        const mudou=await _reenviarOrcamentosLocais(soLocal);
        if(mudou){ lsOrcSalvar(todosOrc); verificarVencidos(); atualizarDash(); renderTabela(); }
      }
      // Migração única: aprovados sem data_aprovacao recebem data_criacao como referência
      await _migrarDataAprovacao();
      _migrarClientesDeOrcamentos();
    }catch(e){ console.warn('Sync do histórico falhou:', e?.message||e); }
  }
}

// Busca o próximo lote de orçamentos mais antigos (offline/sem banco: não tem
// mais o que buscar, tudo que existe local já está carregado). Chamado pelo
// botão "Carregar mais" — ver renderTabela().
async function _carregarMaisOrcamentos(){
  if(!dbOk||!db||!_orcTemMais) return;
  const btn=document.getElementById('orc-carregar-mais'); if(btn) btn.textContent='Carregando…';
  try{
    const {data,error}=await db.from('orcamentos').select('*').eq('empresa_id',EMPRESA_ID).order('data_criacao',{ascending:false}).range(_orcServidorOffset,_orcServidorOffset+_ORC_PAGE-1);
    if(error) throw error;
    _orcServidorOffset+=data.length; _orcTemMais=data.length===_ORC_PAGE;
    const idsJa=new Set(todosOrc.map(x=>x.id));
    const novos=data.filter(x=>!idsJa.has(x.id));
    todosOrc=[...todosOrc,...novos];
    lsOrcSalvar(todosOrc);
    renderTabela();
  }catch(e){ console.warn('[carregarMaisOrcamentos]', e?.message||e); toast('⚠️ Falha ao carregar mais orçamentos'); }
}

// Migração única: aprovados sem data_aprovacao → usa data_criacao como referência contábil
// Importa clientes de orçamentos/OS históricos para a base (roda uma vez após sync)
// v2: a base já é escopada por empresa (RLS + empresa_id), então dedup é por nome.
function _migrarClientesDeOrcamentos(){
  const todos=[...todosOrc,...todosOS];
  let lista=lsCliLer();
  let mudou=false;
  todos.forEach(o=>{
    const nome=(o.cliente||'').trim(); if(!nome||nome==='—') return;
    const lojaId=o.loja_id||null;
    const jaExiste=lista.some(c=>(c.nome||'').toLowerCase()===nome.toLowerCase());
    if(jaExiste) return;
    const novo={id:'cli_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),nome,tel:o.tel_cliente||'',end:o.local_servico||'',cnpj:o.cnpj||'',cpf:o.cpf_cliente||'',email_responsavel:'',tipo:'',portal_token:crypto.randomUUID(),loja_id:lojaId};
    lista.unshift(novo); mudou=true;
    if(dbOk&&db) dbInsert('clientes',{id:novo.id,nome,telefone:novo.tel||null,endereco:novo.end||null,cnpj:novo.cnpj||null,cpf:novo.cpf||null,loja_id:lojaId,portal_token:novo.portal_token}).catch(()=>{});
  });
  if(mudou){ lsCliSalvar(lista); console.log('[migração] base de clientes atualizada'); }
}

async function _migrarDataAprovacao(){
  const semData=todosOrc.filter(o=>o.status==='aprovado'&&!o.data_aprovacao&&(o.data_criacao||o.data_orc||o.data));
  if(!semData.length) return;
  semData.forEach(o=>{
    const ref=o.data_criacao||o.data_orc||o.data;
    o.data_aprovacao=ref;
    lsOrcAtualizar(o.id,{data_aprovacao:ref});
  });
  // Sincroniza cada um com o Supabase em background
  if(dbOk&&db){
    for(const o of semData){
      orcSyncUpdate(o.id,{data_aprovacao:o.data_aprovacao}).catch(e=>console.warn('[migrarDataAprovacao]',e?.message||e));
    }
  }
  console.log(`[migração] data_aprovacao preenchida em ${semData.length} orçamento(s) aprovado(s)`);
}

function verificarVencidos(){
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  let mudou=false;
  todosOrc.forEach(o=>{
    if(o.status==='pendente'&&o.validade_data){
      const partes=o.validade_data.split('/');
      let dv;
      if(partes.length===3) dv=new Date(partes[2]+'-'+partes[1]+'-'+partes[0]+'T00:00:00');
      else dv=new Date(o.validade_data+'T00:00:00');
      if(!isNaN(dv)&&dv<hoje){
        o.status='vencido'; mudou=true;
        lsOrcAtualizar(o.id,{status:'vencido'});
        if(dbOk&&db&&!String(o.id).startsWith('local_'))
          db.from('orcamentos').update({status:'vencido'}).eq('id',o.id).then(()=>{}).catch(()=>{});
      }
    }
  });
  return mudou;
}

function atualizarDash(){
  // KPIs sempre refletem o período do mês selecionado (ou todos)
  const orcFiltrado=_orcListaMes();
  const tot=orcFiltrado.length, soma=orcFiltrado.reduce((a,o)=>a+(o.total||0),0);
  const aprov=orcFiltrado.filter(o=>o.status==='aprovado');
  const somaA=aprov.reduce((a,o)=>a+(o.total||0),0);
  // Mesma fonte que a tela de A Receber (parcela quando existe, valor_recebido
  // como fallback) — dois números diferentes pro mesmo dinheiro é pior que um.
  const aRec=aprov.reduce((a,o)=>a+_orcSaldoAReceber(o),0);
  const tick=tot>0?soma/tot:0;
  // Sub-label mostra o período
  const periodoSub=orcMesRef?_renderOrcMesLabelStr():'Todos os períodos';
  const taxaConv = tot>0 ? Math.round(aprov.length/tot*100) : 0;
  setV_el('d-emit',brl(soma),'textContent'); setV_el('d-emit-q',tot+' orç. · '+periodoSub,'textContent');
  setV_el('d-aprov',brl(somaA),'textContent'); setV_el('d-aprov-q',aprov.length+' aprov. · '+(tot>0?taxaConv+'% conversão':'—'),'textContent');
  setV_el('d-rec',brl(Math.max(0,aRec)),'textContent');
  setV_el('d-tick',tick>0?brl(tick):'—','textContent');
  renderOrigemDash();
  renderEstoqueDash();
}

function dispensarAlertaEstoque(){
  // Salva timestamp de dismiss — oculta reposição por 7 dias.
  // Encomendas urgentes (estoque negativo) sempre aparecem, ignoram o dismiss.
  lsSet('fluxa_estoque_dismiss', String(Date.now()));
  const card=document.getElementById('dash-estoque-card');
  if(card) card.style.display='none';
  toast('🔕 Alertas de reposição ocultados por 7 dias');
}
function _estoqueDismissAtivo(){
  const t=parseInt(ls('fluxa_estoque_dismiss')||'0');
  return t>0 && (Date.now()-t) < 7*24*60*60*1000; // 7 dias em ms
}

// Card de estoque no dashboard: produtos abaixo do mínimo (lista de reposição)
function renderEstoqueDash(){
  const card=document.getElementById('dash-estoque-card');
  const body=document.getElementById('dash-estoque-body');
  if(!card||!body) return;
  if(!eGestor()){ card.style.display='none'; return; }
  const prods=produtosVisiveis();
  // Encomendas (disponível negativo = vendido/comprometido sem estoque) — sempre visíveis
  const enc=listaEncomendas();
  // Reposição (disponível no/abaixo do mínimo, mas ainda positivo)
  const baixo=prods.filter(p=>{ const m=parseFloat(p.estoque_minimo)||0; const d=disponivelProduto(p.id); return m>0 && d>=0 && d<=m; })
    .sort((a,b)=>disponivelProduto(a.id)-disponivelProduto(b.id));
  // Se dismiss ativo: mostra só encomendas urgentes (negativo), oculta reposição
  const baixoVis = _estoqueDismissAtivo() ? [] : baixo;
  if(!enc.length && !baixoVis.length){ card.style.display='none'; return; }
  card.style.display='';
  let html='';
  if(enc.length){
    html+=`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#b91c1c;margin-bottom:4px">📥 Comprar para entregar (encomendas)</div>`;
    html+=enc.slice(0,6).map(x=>{
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
        <div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.p.nome)}</div>
          <div style="font-size:11px;color:var(--gray)">faltam <span style="color:var(--red);font-weight:700">${fmtQtd(x.falta)}</span> para entregar</div></div>
        <button class="tb g" style="flex-shrink:0;font-size:11px" onclick="go('estoque');setTimeout(()=>abrirMovModal('${x.p.id}','entrada'),250)">＋ Comprar ${fmtQtd(Math.ceil(x.falta))}</button>
      </div>`;
    }).join('')+(enc.length>6?`<div style="font-size:11px;color:var(--gray);padding:6px 0;text-align:right">+${enc.length-6} outros</div>`:'');
  }
  if(baixoVis.length){
    html+=`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#b45309;margin:${enc.length?'10px':'0'} 0 4px">🔄 Repor (estoque mínimo)</div>`;
    html+=baixoVis.slice(0,6).map(p=>{
      const disp=disponivelProduto(p.id), min=parseFloat(p.estoque_minimo)||0;
      const sugestao=Math.max(1, Math.ceil(min*2 - disp));
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
        <div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.nome)}</div>
          <div style="font-size:11px;color:var(--gray)">disponível <span style="color:var(--yellow);font-weight:700">${fmtQtd(disp)}</span> · mín ${fmtQtd(min)}</div></div>
        <button class="tb g" style="flex-shrink:0;font-size:11px" onclick="go('estoque');setTimeout(()=>abrirMovModal('${p.id}','entrada'),250)">＋ Repor ${fmtQtd(sugestao)}</button>
      </div>`;
    }).join('')+(baixoVis.length>6?`<div style="font-size:11px;color:var(--gray);padding-top:6px;text-align:right">+${baixoVis.length-6} outros</div>`:'');
  }
  // Rodapé: aviso de dismiss ativo
  if(_estoqueDismissAtivo()&&baixo.length){
    const dias=Math.ceil((7*86400000-(Date.now()-parseInt(ls('fluxa_estoque_dismiss'))))/86400000);
    html+=`<div style="font-size:11px;color:var(--gray);margin-top:8px;padding-top:8px;border-top:1px solid var(--gray-light)">🔕 ${baixo.length} produto(s) com reposição pendente · oculto por mais ${dias} dia(s) <button class="ba" style="font-size:10px;padding:2px 8px;margin-left:6px" onclick="lsDel('fluxa_estoque_dismiss');renderEstoqueDash()">Mostrar</button></div>`;
  }
  body.innerHTML=html;
}

// ── Origem dos clientes (métricas de captação) ──
function renderOrigemDash(){
  const card=document.getElementById('dash-origem-card');
  const body=document.getElementById('dash-origem-body');
  if(!card||!body) return;
  const periodo=(document.getElementById('dash-origem-periodo')||{value:'mes'}).value;
  const hoje=new Date();
  const comOrigem=filtrarPorLoja(todosOrc).filter(o=>o.origem_cliente);
  // Sem nenhum histórico de origem em toda a base → esconde o card por completo
  if(!comOrigem.length){ card.style.display='none'; return; }
  let lista=comOrigem;
  if(periodo==='mes'){
    lista=lista.filter(o=>{ const d=_orcData(o); return d&&d.getFullYear()===hoje.getFullYear()&&d.getMonth()===hoje.getMonth(); });
  } else if(periodo!=='tudo'){
    const lim=new Date(hoje.getFullYear(),hoje.getMonth()-parseInt(periodo)+1,1);
    lista=lista.filter(o=>{ const d=_orcData(o); return d&&d>=lim; });
  }
  card.style.display='';
  // Agrupa por origem
  const counts={}, valores={}, aprovados={};
  lista.forEach(o=>{
    const k=o.origem_cliente;
    counts[k]=(counts[k]||0)+1;
    valores[k]=(valores[k]||0)+(o.total||0);
    if(o.status==='aprovado') aprovados[k]=(aprovados[k]||0)+1;
  });
  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const max=sorted[0]?.[1]||1;
  const emojis=ORIGEM_EMOJI;
  // ── Placar de contadores: categorias padrão (sempre) + personalizadas presentes ──
  const padrao=Object.keys(ORIGEM_EMOJI);
  const custom=Object.keys(counts).filter(k=>!padrao.includes(k));
  const ordemCounter=[...padrao,...custom];
  const periodoLbl={mes:'este mês','3':'últimos 3 meses','12':'últimos 12 meses',tudo:'todo o período'}[periodo]||'';
  const counterHtml=`
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Leads por categoria</span>
      <span style="font-size:11px;color:var(--gray)">${esc(periodoLbl)}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-bottom:16px">
      ${ordemCounter.map(cat=>{
        const n=counts[cat]||0;
        const ativo=n>0;
        return `<div style="border:1.5px solid ${ativo?'var(--c1)':'var(--gray-light)'};border-radius:12px;padding:10px 8px;text-align:center;background:${ativo?'var(--c1-light)':'var(--white)'};opacity:${ativo?'1':'.55'}">
          <div style="font-size:20px;line-height:1">${emojis[cat]||'✏️'}</div>
          <div style="font-size:24px;font-weight:800;line-height:1.1;margin-top:4px;color:${ativo?'var(--c1)':'var(--gray)'}">${n}</div>
          <div style="font-size:10px;font-weight:600;color:var(--c2);margin-top:3px;line-height:1.2">${esc(cat)}</div>
        </div>`;
      }).join('')}
    </div>`;
  // Mês/período sem nenhum lead → mostra só o placar zerado + aviso amigável
  if(!lista.length){
    body.innerHTML=counterHtml+`<div style="text-align:center;color:var(--gray);font-size:12px;padding:6px 0">Nenhum lead com origem registrada ${periodo==='mes'?'neste mês':'neste período'} ainda.</div>`;
    return;
  }
  const detalheHtml=`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin-bottom:6px">Detalhamento</div>`;
  body.innerHTML=counterHtml+detalheHtml+sorted.map(([orig,cnt])=>{
    const pct=Math.round(cnt/lista.length*100);
    const apr=aprovados[orig]||0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
      <div style="font-size:16px;flex-shrink:0;width:24px;text-align:center">${emojis[orig]||'✏️'}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;color:var(--c2);margin-bottom:3px">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(orig)}</span>
          <span style="flex-shrink:0;margin-left:8px">${cnt} <span style="color:var(--gray);font-weight:400">(${pct}%)</span></span>
        </div>
        <div style="height:6px;background:var(--gray-light);border-radius:50px;overflow:hidden">
          <div style="height:100%;background:var(--c1);border-radius:50px;width:${Math.round(cnt/max*100)}%"></div>
        </div>
      </div>
      <div style="flex-shrink:0;text-align:right;min-width:90px">
        <div style="font-size:12px;font-weight:700;color:var(--c2)">${brl(valores[orig]||0)}</div>
        <div style="font-size:10px;color:var(--gray)">${apr} aprovado${apr!==1?'s':''}</div>
      </div>
    </div>`;
  }).join('')+`<div style="font-size:11px;color:var(--gray);padding-top:8px;text-align:right">${lista.length} orçamento${lista.length!==1?'s':''} com origem informada</div>`;
}

function filt(btn){
  document.querySelectorAll('.hf .fb[data-s]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); filtroSt=btn.dataset.s;
  localStorage.setItem('fluxa_filtroSt', filtroSt);
  _orcPagina=1;
  renderTabela();
}
function buscar(v){ busca=v.toLowerCase(); _orcPagina=1; renderTabela(); }
function _orcMudarPagina(delta){ _orcPagina=Math.max(1,_orcPagina+delta); renderTabela(); }

// ──────────────────────────────────────────────────
//  GRÁFICO DE FATURAMENTO
// ──────────────────────────────────────────────────
function _orcData(o){
  // campo correto de data: data_criacao (ISO) é o mais confiável
  const raw = o.data_criacao || o.data_orc || o.data || '';
  return raw ? new Date(raw) : null;
}

function renderGraficoDash(){
  const canvas=document.getElementById('dash-chart'); if(!canvas) return;
  if(typeof Chart==='undefined') return;
  const tipo=(document.getElementById('dash-chart-tipo')||{value:'aprovado'}).value;
  const periodo=(document.getElementById('dash-chart-periodo')||{value:'6'}).value;
  const hoje=new Date();
  const orcFilt=filtrarPorLoja(todosOrc);
  let meses=[];

  if(periodo==='tudo'){
    // Descobre o mês mais antigo com dados
    const datas=orcFilt.map(o=>_orcData(o)).filter(Boolean);
    const minData=datas.length?new Date(Math.min(...datas)):hoje;
    const diffMeses=(hoje.getFullYear()-minData.getFullYear())*12+(hoje.getMonth()-minData.getMonth());
    const total=Math.max(diffMeses+1, 1);
    for(let i=total-1;i>=0;i--){
      const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);
      meses.push({label:d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),y:d.getFullYear(),m:d.getMonth()});
    }
  } else if(periodo==='ano'){
    for(let m=0;m<=hoje.getMonth();m++){
      const d=new Date(hoje.getFullYear(),m,1);
      meses.push({label:d.toLocaleDateString('pt-BR',{month:'short'}),y:d.getFullYear(),m:d.getMonth()});
    }
  } else {
    const qtd=parseInt(periodo)||6;
    for(let i=qtd-1;i>=0;i--){
      const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);
      meses.push({label:d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),y:d.getFullYear(),m:d.getMonth()});
    }
  }

  // Atualiza o título dinamicamente
  const titulos={'3':'3 meses','6':'6 meses','12':'12 meses','24':'24 meses','ano':'Este ano','tudo':'Todo o período'};
  const tituloEl=document.getElementById('dash-chart-titulo');
  if(tituloEl) tituloEl.textContent='📊 Faturamento — '+titulos[periodo];

  const valores=meses.map(({y,m})=>{
    return orcFilt.filter(o=>{
      const d=_orcData(o); if(!d||isNaN(d)) return false;
      return d.getFullYear()===y && d.getMonth()===m && (tipo==='aprovado'?o.status==='aprovado':true);
    }).reduce((a,o)=>a+(o.total||0),0);
  });

  if(_dashChart){ try{_dashChart.destroy();}catch(e){} _dashChart=null; }
  const cor=getComputedStyle(document.documentElement).getPropertyValue('--c1').trim()||'#C45E0A';
  // Barras mais finas quando há muitos meses
  const muitosMeses=meses.length>12;

  _dashChart=new Chart(canvas,{
    type:'bar',
    data:{
      labels:meses.map(m=>m.label),
      datasets:[{
        label:tipo==='aprovado'?'Aprovados':'Total emitido',
        data:valores,
        backgroundColor:cor+'26',
        borderColor:cor,
        borderWidth:2,
        borderRadius:muitosMeses?3:6,
        borderSkipped:false,
        maxBarThickness:muitosMeses?24:48,
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:ctx=>'R$ '+ctx.raw.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}}
      },
      scales:{
        x:{grid:{display:false},ticks:{font:{size:muitosMeses?9:11,family:'Inter'},color:'#6b7280',maxRotation:muitosMeses?45:0}},
        y:{grid:{color:'rgba(0,0,0,.04)'},border:{display:false},ticks:{font:{size:11,family:'Inter'},color:'#6b7280',callback:v=>v===0?'R$0':v>=1000?'R$'+Math.round(v/1000)+'k':'R$'+v}}
      }
    }
  });
}


// ── NAVEGAÇÃO DE MÊS (orçamentos) ──────────────────────────────────────────
const _MESES_ORC=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function initOrcMes(){
  if(!orcMesRef){
    const n=new Date();
    orcMesRef=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');
  }
  _renderOrcMesLabel();
}

function orcNavMes(delta){
  if(!orcMesRef){ initOrcMes(); return; }
  const [y,m]=orcMesRef.split('-').map(Number);
  const d=new Date(y,m-1+delta,1);
  orcMesRef=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  _renderOrcMesLabel();
  _orcPagina=1;
  atualizarDash(); renderTabela();
}

function orcVerTodos(){
  orcMesRef='';
  _renderOrcMesLabel();
  _orcPagina=1;
  atualizarDash(); renderTabela();
}

function _renderOrcMesLabel(){
  const lbl=document.getElementById('orc-mes-label');
  const btn=document.getElementById('btn-orc-todos');
  if(!orcMesRef){
    if(lbl) lbl.textContent='Todos os períodos';
    if(btn){ btn.classList.add('on'); }
  } else {
    const [y,m]=orcMesRef.split('-').map(Number);
    if(lbl) lbl.textContent=_MESES_ORC[m-1]+' '+y;
    if(btn){ btn.classList.remove('on'); }
  }
}

function _renderOrcMesLabelStr(){
  if(!orcMesRef) return 'todos os períodos';
  const [y,m]=orcMesRef.split('-').map(Number);
  return _MESES_ORC[m-1]+' '+y;
}

function _orcListaMes(){
  let lista=filtrarPorLoja(todosOrc);
  if(orcMesRef){
    lista=lista.filter(o=>{
      // Aprovados: referência contábil = data_aprovacao (mês em que a venda foi fechada)
      // Demais status: data_criacao (mês em que foi proposto)
      const ref = (o.status==='aprovado' && o.data_aprovacao)
        ? new Date(o.data_aprovacao)
        : _orcData(o);
      if(!ref||isNaN(ref)) return true; // sem data → inclui para não sumir
      return ref.getFullYear()+'-'+String(ref.getMonth()+1).padStart(2,'0')===orcMesRef;
    });
  }
  return lista;
}

// ══════════════════════════════════════════════════════════════════════════
//  Componentes compartilhados — trilha de estados + cartão de estado
//  (Tarefa 3i.1, 19/08). Usados no orçamento aberto (3i.5) e na OS (3i.6);
//  mesma referência visual da ficha de Oficina (3h.2, fora desta rodada).
//  Construídos uma vez aqui pra não duplicar o markup em cada tela — ver
//  DIAGNOSTICO-OS.md/DIAGNOSTICO-ORCAMENTOS.md pro porquê.
// ══════════════════════════════════════════════════════════════════════════

// nos: [{label, data, tracejado, estourado}]
//   - data: texto pequeno abaixo do label (data/hora), opcional
//   - tracejado: etapa que ainda não existe de verdade no sistema (ex.:
//     "Relatório enviado" antes da 3i.8) — fica sempre pontilhada, nunca
//     "atual" nem "concluída", mesmo que atualIdx aponte pra ela ou além
//   - estourado: o CONECTOR que sai deste nó fica em âmbar (atraso/SLA
//     estourado entre esta etapa e a próxima)
// atualIdx: índice (0-based) do nó atual. -1 = nenhum nó atingido ainda
// (todos "futuro") — usado quando a entidade nem começou o ciclo.
function _renderTrilhaEstados(nos, atualIdx){
  let h='<div class="rd-trilha">';
  nos.forEach((n,i)=>{
    const tipo = n.tracejado ? 'tracejado' : i<atualIdx ? 'done' : i===atualIdx ? 'atual' : 'futuro';
    const icone = tipo==='done'
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>'
      : '';
    h+=`<div class="rd-trilha-item rd-trilha-item-${tipo}">
      <div class="rd-trilha-dot rd-trilha-dot-${tipo}">${icone}</div>
      <span class="rd-trilha-label">${esc(n.label)}</span>
      ${n.data?`<span class="rd-trilha-data">${esc(n.data)}</span>`:''}
    </div>`;
    if(i<nos.length-1){
      const conDone = !n.tracejado && i<atualIdx;
      h+=`<div class="rd-trilha-conector${n.estourado?' rd-trilha-conector-estourado':conDone?' rd-trilha-conector-done':''}"></div>`;
    }
  });
  h+='</div>';
  return h;
}

// cfg: {
//   eyebrow: texto pequeno em maiúsculas no topo (obrigatório em espírito,
//     mas nada quebra se faltar),
//   timer: canto superior direito (ex. "00:42"), opcional,
//   titulo: linha grande (número/estado em destaque), opcional,
//   tituloSub: linha pequena logo abaixo do título, opcional,
//   progresso: 0–100, desenha a barra fina, opcional,
//   listaTitulo + lista: [{ok:bool, texto}] — caixa "o que falta"/checklist
//     dentro do cartão, opcional (sem lista, a caixa nem aparece),
//   acao: {label, onclick} — pílula azul clicável; passar só {label} (sem
//     onclick) desenha a pílula cinza não-clicável (ex. "Ligar para o
//     técnico" quando não há telefone cadastrado),
//   nota: texto pequeno de rodapé explicando a trava do estado, opcional
// }
function _renderCartaoEstado(cfg){
  const timerHtml = cfg.timer ? `<span class="rd-cestado-timer">${esc(cfg.timer)}</span>` : '';
  const corpoHtml = cfg.titulo ? `<div class="rd-cestado-corpo">
      <span class="rd-cestado-titulo">${esc(cfg.titulo)}</span>
      ${cfg.tituloSub?`<span class="rd-cestado-titulosub">${esc(cfg.tituloSub)}</span>`:''}
    </div>` : '';
  const progressoHtml = cfg.progresso!=null ? `<div class="rd-cestado-barra"><div class="rd-cestado-barra-fill" style="width:${Math.max(0,Math.min(100,cfg.progresso))}%"></div></div>` : '';
  const listaHtml = (cfg.lista&&cfg.lista.length) ? `<div class="rd-cestado-caixa">
      ${cfg.listaTitulo?`<span class="rd-cestado-caixa-tit">${esc(cfg.listaTitulo)}</span>`:''}
      ${cfg.lista.map(it=>`<div class="rd-cestado-item"><span class="rd-cestado-item-dot ${it.ok?'ok':'pend'}"></span><span class="rd-cestado-item-tx">${esc(it.texto)}</span></div>`).join('')}
    </div>` : '';
  const acaoHtml = cfg.acao ? (cfg.acao.onclick
      ? `<button type="button" class="rd-cestado-acao" onclick="${cfg.acao.onclick}">${esc(cfg.acao.label)}</button>`
      : `<span class="rd-cestado-acao rd-cestado-acao-off">${esc(cfg.acao.label)}</span>`) : '';
  return `<div class="rd-cestado">
    <div class="rd-cestado-topo">
      <span class="rd-cestado-eyebrow">${esc(cfg.eyebrow||'')}</span>
      ${timerHtml}
    </div>
    ${corpoHtml}
    ${progressoHtml}
    ${listaHtml}
    ${acaoHtml}
    ${cfg.nota?`<span class="rd-cestado-nota">${esc(cfg.nota)}</span>`:''}
  </div>`;
}

// Tarefa 3i.3 (19/08) — troca os 4 KPIs antigos (Total emitido/Aprovados/
// Pendentes/Recusados-Vencidos) pelos 4 do DIAGNOSTICO-ORCAMENTOS.md.
// "Ticket médio" saiu de vez: não gera ação nenhuma, ninguém muda de
// comportamento por causa dele — o card "Aprovado sem OS" no lugar dele é
// acionável (mesmo cálculo de _orcExecucaoInfo que já move o chip/rodapé
// da 3i.2, não duplica lógica).
function renderOrcMiniKpis(lista){
  const el=document.getElementById('orc-mini-kpis'); if(!el) return;
  const ocultarFin=eVendas();
  const pendentes=lista.filter(o=>o.status==='pendente');
  const pipelineAberto=pendentes.reduce((a,o)=>a+(o.total||0),0);
  const aprov=lista.filter(o=>o.status==='aprovado');
  const somaA=aprov.reduce((a,o)=>a+(o.total||0),0);
  const rec=lista.filter(o=>o.status==='recusado').length;
  const venc=lista.filter(o=>o.status==='vencido').length;
  const decididos=aprov.length+rec+venc;
  const taxaFechamento=decididos>0?Math.round(aprov.length/decididos*100):null;
  const semOS=aprov.filter(o=>_orcExecucaoInfo(o).tipo==='sem_os');
  const somaSemOS=semOS.reduce((a,o)=>a+(o.total||0),0);
  el.innerHTML=`
    <div class="rd-card rd-card-dense rd-card-dark">
      <div class="rd-kpi-lbl">Pipeline aberto</div>
      <div class="rd-kpi-num rd-kpi-num-sm">${ocultarFin?pendentes.length+' orç.':brl(pipelineAberto)}</div>
      <div class="rd-kpi-apoio">${pendentes.length} pendente${pendentes.length!==1?'s':''}</div>
    </div>
    <div class="rd-card rd-card-dense">
      <div class="rd-kpi-lbl"><span class="rd-badge rd-badge-ok">Aprovados no mês</span></div>
      <div class="rd-kpi-num rd-kpi-num-sm" style="color:var(--ok)">${ocultarFin?aprov.length:brl(somaA)}</div>
      <div class="rd-kpi-apoio">${aprov.length} aprovado${aprov.length!==1?'s':''}</div>
    </div>
    <div class="rd-card rd-card-dense" style="border-color:var(--warn-border)">
      <div class="rd-kpi-lbl"><span class="rd-badge rd-badge-warn">Aprovado sem OS</span></div>
      <div class="rd-kpi-num rd-kpi-num-sm" style="color:var(--warn)">${ocultarFin?semOS.length:brl(somaSemOS)}</div>
      <div class="rd-kpi-apoio">${semOS.length} vendido${semOS.length!==1?'s':''} e não entregue${semOS.length!==1?'s':''}</div>
    </div>
    <div class="rd-card rd-card-dense">
      <div class="rd-kpi-lbl"><span class="rd-badge rd-badge-info">Taxa de fechamento</span></div>
      <div class="rd-kpi-num rd-kpi-num-sm" style="color:var(--info)">${taxaFechamento!=null?taxaFechamento+'%':'—'}</div>
      <div class="rd-kpi-apoio">${decididos} decidido${decididos!==1?'s':''} no período</div>
    </div>`;
}

// ── Coluna "Execução" do histórico (Tarefa 3i.2, 19/08) ── Deriva de
// orcamento_id em ordens_servico — sem tabela nova. Cinco valores possíveis
// (DIAGNOSTICO-ORCAMENTOS.md); "OS agendada" (com OS vinculada mas ainda no
// futuro) não está nas 5 categorias do diagnóstico — decisão: mesmo ponto
// azul de "em campo", já que ambos significam "sob controle, tem próximo
// passo definido" (a trilha da 3i.5 também trata "OS #NNN" como um nó só).
// "em campo" propriamente dito depende de status:'em_andamento' em
// ordens_servico, que HOJE NUNCA é gravado — fazerCheckin() só marca isso
// em memória local (checkinAt), persistido no banco só no checkout junto
// com 'concluido' (achado ao investigar antes de codar). Fica correto do
// jeito que está: essa categoria simplesmente não aparece até a 3i.6
// persistir o check-in de verdade — não é um bug desta função.
function _orcExecucaoInfo(o){
  if(o.status!=='aprovado') return {tipo:'-', texto:'—', cor:'var(--tx4)'};
  const osVinc=(todosOS||[]).find(x=>x.orcamento_id===o.id);
  if(!osVinc){
    const ref=o.data_aprovacao?new Date(o.data_aprovacao):_orcData(o);
    const dias=ref&&!isNaN(ref)?Math.max(0,Math.floor((new Date()-ref)/86400000)):0;
    return {tipo:'sem_os', texto:`sem OS há ${dias}d`, cor:'var(--warn)', linha:true};
  }
  const num='OS #'+String(osVinc.numero||'').padStart(3,'0');
  if(osVinc.status==='concluido'){
    // relatorio_enviado_em ainda não existe no schema — chega com a 3i.8.
    // Até lá este ramo nunca dispara; deixado pronto de propósito.
    if(osVinc.relatorio_enviado_em){
      return {tipo:'relatorio', texto:'relatório enviado '+_dataBR(osVinc.relatorio_enviado_em), cor:'var(--ok)'};
    }
    const dt=osVinc.data_servico?_dataBR(osVinc.data_servico):'';
    return {tipo:'sem_relatorio', texto:`executado${dt?' '+dt:''} · sem relatório`, cor:'var(--warn-dot)', linha:true};
  }
  if(osVinc.status==='em_andamento'){
    return {tipo:'em_campo', texto:num+' em campo', cor:'#0B62CE'};
  }
  const dt=osVinc.data_servico?_dataBR(osVinc.data_servico):'';
  return {tipo:'agendada', texto:num+' agendada'+(dt?' '+dt:''), cor:'#0B62CE'};
}
// DD/MM a partir de string ISO ou 'YYYY-MM-DD' — vários pontos do app já
// fazem isso inline; centralizado aqui pra não repetir o parsing.
function _dataBR(iso){
  if(!iso) return '';
  const d=new Date(iso.length<=10?iso+'T12:00:00':iso);
  if(isNaN(d)) return '';
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
}

// Ação em lote "Agendar as N aprovadas sem OS" (3i.2, 19/08) — modal com
// uma linha por orçamento (data + técnico, editáveis por linha; sem
// técnico não agenda, não force um padrão que pode estar errado). Executa
// em série via _criarOSDeOrcamento e mostra resultado por item — não um
// toast genérico, cada linha vira ✅/⚠️/— ao terminar.
function _orcAgendarLoteAbrir(){
  const lista=(todosOrc||[]).filter(o=>_orcExecucaoInfo(o).tipo==='sem_os');
  if(!lista.length){ toast('Nenhum orçamento aprovado sem OS'); return; }
  const tecs=getTecnicos();
  const hoje=_hojeLocal();
  const m=document.createElement('div');
  m.id='lote-os-modal';
  m.style.cssText='position:fixed;inset:0;background:rgba(16,23,32,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  m.innerHTML=`<div style="background:#fff;border-radius:14px;padding:20px 22px;width:100%;max-width:520px;max-height:82vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.18)">
    <div style="font-size:15px;font-weight:700;color:var(--c2);margin-bottom:2px">Agendar ${lista.length} aprovado${lista.length!==1?'s':''} sem OS</div>
    <div style="font-size:12px;color:var(--tx3);margin-bottom:14px">Confirme data e técnico de cada um. Quem ficar sem técnico não é agendado agora.</div>
    <div id="lote-os-linhas" style="display:flex;flex-direction:column;gap:10px"></div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button onclick="document.getElementById('lote-os-modal').remove()" style="flex:1;padding:10px;border:1.5px solid var(--gray-mid);border-radius:8px;background:#fff;cursor:pointer;font-size:13px">Fechar</button>
      <button id="lote-os-btn" onclick="_orcAgendarLoteExecutar()" style="flex:2;padding:10px;border:none;border-radius:8px;background:#0B62CE;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Agendar todos</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  const linhasEl=document.getElementById('lote-os-linhas');
  linhasEl.innerHTML=lista.map(o=>{
    const num=String(o.numero||'').padStart(3,'0');
    return `<div class="lote-os-linha" data-orc-id="${esc(o.id)}" style="display:flex;gap:8px;align-items:center;padding:9px;border:1px solid var(--line,#e5e7eb);border-radius:9px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--c2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">#${num} · ${esc(o.cliente||'—')}</div>
        <div id="lote-os-status-${esc(o.id)}" style="font-size:11px;color:var(--tx3)">aguardando</div>
      </div>
      <input type="date" class="lote-os-data" value="${hoje}" style="padding:7px;border:1.5px solid var(--gray-mid);border-radius:7px;font-size:12px;width:128px">
      <select class="lote-os-tec" style="padding:7px;border:1.5px solid var(--gray-mid);border-radius:7px;font-size:12px;max-width:120px">
        <option value="">Técnico…</option>
        ${tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}
      </select>
    </div>`;
  }).join('');
  m.addEventListener('click',e=>{ if(e.target===m) m.remove(); });
}
async function _orcAgendarLoteExecutar(){
  const m=document.getElementById('lote-os-modal'); if(!m) return;
  const btn=document.getElementById('lote-os-btn');
  if(btn){ btn.disabled=true; btn.textContent='Agendando…'; }
  const linhas=[...m.querySelectorAll('.lote-os-linha')];
  let ok=0, semTec=0, falhas=0;
  for(const linha of linhas){
    const orcId=linha.dataset.orcId;
    const orc=todosOrc.find(x=>x.id===orcId);
    const statusEl=document.getElementById('lote-os-status-'+orcId);
    const tec=linha.querySelector('.lote-os-tec').value;
    const data=linha.querySelector('.lote-os-data').value;
    if(!orc){ if(statusEl){statusEl.textContent='⚠️ orçamento sumiu da lista';statusEl.style.color='var(--warn)';} falhas++; continue; }
    if(!tec){ if(statusEl){statusEl.textContent='— sem técnico, pulado';statusEl.style.color='var(--tx3)';} semTec++; continue; }
    try{
      const {numStr,offline}=await _criarOSDeOrcamento(orc, data, '08:00', tec);
      if(statusEl){ statusEl.textContent=(offline?'📴 OS #'+numStr+' (offline)':'✅ OS #'+numStr+' criada'); statusEl.style.color=offline?'var(--warn)':'var(--ok)'; }
      ok++;
    }catch(e){
      if(statusEl){ statusEl.textContent='⚠️ falhou: '+(e?.message||'erro'); statusEl.style.color='var(--bad)'; }
      falhas++;
    }
  }
  if(btn){ btn.disabled=false; btn.textContent='Fechar'; btn.onclick=()=>m.remove(); }
  toast(`✅ ${ok} agendada${ok!==1?'s':''}${semTec?' · '+semTec+' sem técnico':''}${falhas?' · '+falhas+' com erro':''}`);
  await loadOSHist();
  renderTabela();
}

// Resumo de "o que fazer" pra cada linha do histórico — portado do v1
// (renderTabela/Fase 5), mas reaproveitando os cálculos que o Funil já
// tinha (_crmFuStatus/_crmEsfriando/_crmSituacaoCfg), em vez de duplicar
// lógica nova. Retorna null quando não há ação pendente (não polui a
// linha à toa).
function _orcProximaAcaoTxt(o){
  const st=o.status||'pendente';
  if(st==='aprovado'){
    const temOS=(todosOS||[]).some(x=>x.orcamento_id===o.id);
    return temOS ? null : {txt:'Agendar OS', urgente:true};
  }
  if(st==='recusado') return null;
  if(st==='vencido') return {txt:'Revalidar preço', urgente:true};
  const fu=_crmFuStatus(o);
  if(fu==='atrasado') return {txt:'📞 Atrasado', urgente:true};
  if(fu==='hoje') return {txt:'📞 Ligar hoje', urgente:true};
  if(fu==='futuro') return {txt:'Follow-up '+_crmDataBr(o.proximo_contato), urgente:false};
  if(_crmEsfriando(o)) return {txt:'🧊 Esfriando', urgente:false};
  return null;
}

// Exporta a lista FILTRADA (mesma que está na tela — status/busca/mês) em
// CSV. Portado do v1 (Fase 5), adaptado pra chamar _orcListaFiltradaAtual()
// em vez de recalcular filtro — evita divergir do que a tela mostra.
function _orcExportarCSV(){
  const lista=_orcListaFiltradaAtual();
  const linhas=[['Nº','Cliente','Valor','Status','Próxima ação','Origem']];
  lista.forEach(o=>{
    const acao=_orcProximaAcaoTxt(o);
    linhas.push([
      String(o.numero||'').padStart(3,'0'), o.cliente||'',
      String(o.total||0).replace('.',','), o.status||'pendente',
      acao?acao.txt:'', o.origem_cliente||''
    ]);
  });
  const csv=linhas.map(l=>l.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='orcamentos_'+_hojeLocal()+'.csv'; a.click();
  URL.revokeObjectURL(a.href);
}

const _ORC_POR_PAGINA=25;
// Filtro (mês/status/busca) isolado do render — reaproveitado pelo CSV
// (_orcExportarCSV) pra nunca divergir do que a tela mostra.
function _orcListaFiltradaAtual(){
  let listaMes=_orcListaMes();
  let lista=listaMes;
  if(filtroSt!=='todos') lista=lista.filter(o=>o.status===filtroSt);
  if(busca) lista=lista.filter(o=>
    (o.cliente||'').toLowerCase().includes(busca)||
    (o.local_servico||'').toLowerCase().includes(busca)||
    String(o.numero||'').includes(busca.replace('#',''))
  );
  return lista;
}
function renderTabela(){
  // auto-vence orçamentos pendentes com prazo expirado
  autoVencerOrc(todosOrc);
  // Renderiza mini KPIs para o período selecionado (antes dos filtros de status/busca)
  renderOrcMiniKpis(_orcListaMes());
  const listaTotal=_orcListaFiltradaAtual();
  if(!listaTotal.length){
    const msgBusca=busca?`Nenhum resultado para "<strong>${esc(busca)}</strong>"`:
      orcMesRef?`Nenhum orçamento em ${_renderOrcMesLabelStr()}.`:'Nenhum orçamento encontrado.';
    document.getElementById('hist-body').innerHTML=`<div class="empty-st"><div class="ei">📭</div><p>${msgBusca}</p><button class="btn-primary" style="margin-top:12px" onclick="novoOrc();go('form')">＋ Criar Orçamento</button></div>`; return;
  }
  // Paginação client-side (16/08, portado do v1) — 25/página, sobre a lista
  // já filtrada/carregada; "Carregar mais" (abaixo) continua sendo o que
  // busca MAIS dados do servidor quando o lote baixado acaba.
  const totalPaginas=Math.max(1,Math.ceil(listaTotal.length/_ORC_POR_PAGINA));
  if(_orcPagina>totalPaginas) _orcPagina=totalPaginas;
  const ini=(_orcPagina-1)*_ORC_POR_PAGINA;
  const lista=listaTotal.slice(ini, ini+_ORC_POR_PAGINA);
  const sopts=s=>['pendente','aprovado','recusado','vencido'].map(x=>`<option value="${x}" ${x===s?'selected':''}>${x.charAt(0).toUpperCase()+x.slice(1)}</option>`).join('');
  const ocultarFinanceiro=eVendas();
  // Chip "Sem OS N" (3i.2, 19/08) — só aparece com >0, não mostra zero à
  // toa. Conta sobre a lista FILTRADA do mês (mesma lógica de "revelar o
  // problema" do diagnóstico), não a base inteira.
  const semOSCount=listaTotal.filter(o=>_orcExecucaoInfo(o).tipo==='sem_os').length;
  const chipSemOS=semOSCount>0?`<button type="button" class="rd-chip rd-chip-alert" onclick="_orcAgendarLoteAbrir()">Sem OS ${semOSCount}</button>`:'<span></span>';
  let h=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px">
    ${chipSemOS}
    <button type="button" class="rd-btn rd-btn-secondary" style="font-size:12px;padding:6px 12px" onclick="_orcExportarCSV()">⬇ Exportar CSV</button>
  </div>`;
  h+=`<div class="htw"><table class="ht"><thead><tr><th>#</th><th>Cliente</th>${ocultarFinanceiro?'':'<th>Total / Recebido</th>'}<th>Data</th><th>Status</th><th>Execução</th><th>Ações</th></tr></thead><tbody>`;
  lista.forEach(o=>{
    _nc[o.id]=o;
    const num=String(o.numero||'—').padStart(3,'0');
    const svs=(o.servicos||[]).map(s=>s.desc).join(', ')||'—';
    const dt=o.data_criacao?new Date(o.data_criacao).toLocaleDateString('pt-BR'):'—';
    const rec=o.valor_recebido||0, ttl=o.total||0;
    const recCl=rec>=ttl&&ttl>0?'opaid':rec>0?'opaid partial':'opaid none';
    const recTxt=rec>0?brl(rec):'—';
    const notaIcon=o.nota_interna?` <span title="${esc(o.nota_interna)}" style="cursor:help">📝</span>`:'';
    const pendSync=String(o.id).startsWith('local_');
    // Próxima ação (16/08, portado do v1) — só aparece quando há algo
    // pendente de verdade, reaproveitando o mesmo cálculo do Funil.
    const acao=_orcProximaAcaoTxt(o);
    const acaoHtml=acao?`<div style="margin-top:3px"><span class="rd-badge ${acao.urgente?'rd-badge-warn':'rd-badge-neutral'}" style="font-size:10px">${esc(acao.txt)}</span></div>`:'';
    // Execução (3i.2) — substitui a trilha de 4 pontos que ficava aqui: a
    // coluna dedicada já diz o mesmo (e mais: dias parado, data, etc.) sem
    // duplicar a informação duas vezes na mesma linha.
    const exec=_orcExecucaoInfo(o);
    const linhaDestaque=exec.linha?' style="background:var(--warn-row)"':'';
    h+=`<tr${linhaDestaque}>
      <td><span class="on">#${num}</span>${pendSync?'<div title="Não sincronizado com o banco — aguardando conexão" style="font-size:9px;font-weight:700;color:#dc2626;background:#fee2e2;border-radius:4px;padding:1px 5px;margin-top:2px;text-align:center">⚠ PEND.</div>':''}</td>
      <td><div class="ocl">${esc(o.cliente||'—')}${notaIcon}</div><div class="oloc">${esc(o.local_servico||'')}</div><div class="osvc" title="${esc(svs)}">${esc(svs)}</div><div style="margin-top:3px;display:flex;gap:5px;flex-wrap:wrap;align-items:center">${getLojaBadge(o.loja_id)}${getOrigemBadge(o.origem_cliente)}</div>${acaoHtml}</td>
      ${ocultarFinanceiro?'':'<td><span class="otot">'+brl(ttl)+'</span><br><span class="'+recCl+'" style="font-size:11px">'+recTxt+'</span></td>'}
      <td><span class="odt">${dt}</span></td>
      <td><select class="ss ${o.status||'pendente'}" onchange="mudarSt('${o.id}',this)">${sopts(o.status||'pendente')}</select></td>
      <td><span style="font-size:12px;font-weight:600;color:${exec.cor};font-variant-numeric:tabular-nums">${esc(exec.texto)}</span></td>
      <td><div class="ta">
        <button class="tb" title="Ver PDF" onclick="verOrcPDF('${o.id}')">👁</button>
        <button class="tb" title="Editar" onclick="abrirOrc('${o.id}')">✎</button>
        <button class="tb" title="Duplicar" onclick="duplicarOrc('${o.id}')">⧉</button>
        ${(()=>{ const osVinc=(todosOS||[]).find(x=>x.orcamento_id===o.id); if(osVinc){ const stOS=osVinc.status||'agendado'; const stLabel={agendado:'agendada',em_andamento:'em andamento',concluido:'concluída'}[stOS]||stOS; return `<button class="tb" title="OS #${String(osVinc.numero||'').padStart(3,'0')} — ${stLabel}" onclick="verDetalhesOS('${osVinc.id}')" style="background:#16a34a;color:white;border-color:#16a34a;font-weight:700">✅ OS#${String(osVinc.numero||'').padStart(3,'0')}</button>`; } if(o.status==='aprovado') return `<button class="tb" title="Gerar Ordem de Serviço" onclick="gerarOS_deOrc('${o.id}')" style="background:#C45E0A;color:white;border-color:#C45E0A;font-weight:700">📋 Gerar OS</button>`; return `<button class="tb" title="Gerar OS" onclick="gerarOS_deOrc('${o.id}')">📋</button>`; })()}
        ${orcTemEntregaPendente(o)?`<button class="tb g" title="Marcar como entregue (baixa do estoque)" onclick="entregarOrcamento(getNC('${o.id}'),'manual')">📦 Entregar</button>`:''}
        ${o.status==='aprovado'&&(o.servicos||[]).length?`<button class="tb" title="Ordem de Entrega — papel que vai junto com o material, pra quem recebe conferir e assinar" onclick="gerarOrdemEntrega('${o.id}')">🧾 Entrega</button>`:''}
        ${ocultarFinanceiro?'':(_recebDoOrc(o.id).length
            ? `<button class="tb g" title="Cobrança lançada em parcelas — acompanhe em A Receber" onclick="go('produtividade')">💰</button>`
            : (o.status==='aprovado'
               ? `<button class="tb g" title="Lançar cobrança (parcelas e vencimento)" onclick="abrirModalReceb('${o.id}')">💰</button>`
               : '<button class="tb g" title="Registrar pagamento" onclick="abrirModalPg(\''+o.id+'\','+ttl+')">💰</button>'))}
        ${o.status==='aprovado'?`<button class="tb" title="Corrigir mês de aprovação no faturamento" onclick="corrigirDataAprovacao('${o.id}')" style="font-size:10px;font-weight:700;color:#b45309;border-color:#fbbf24;background:#fef9c3">MÊS</button>`:''}
        ${!ocultarFinanceiro&&o.status==='aprovado'?`<button class="tb" title="Emitir Nota Fiscal" onclick="abrirModalNFe('${o.id}')" style="background:#7c3aed;color:white;border-radius:6px;padding:4px 7px;font-size:11px;font-weight:700;border:none;cursor:pointer">NF</button>`:''}
        <button class="tb" title="Enviar no WhatsApp" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifOrcamento(getNC('${o.id}')), '${o.tel_cliente||''}')">💬 WA</button>
        ${ocultarFinanceiro?'':'<button class="tb d" title="Excluir" onclick="excluirOrc(\''+o.id+'\')">🗑</button>'}
      </div></td>
    </tr>`;
  });
  h+='</tbody></table></div>'+_rzBotaoReset('orc');
  // Paginação (16/08) — só aparece com mais de 1 página do que já está
  // carregado; independente do "Carregar mais" abaixo (esse busca MAIS do
  // servidor, isto pagina o que já está na memória).
  if(totalPaginas>1){
    h+=`<div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:14px 0">
      <button type="button" class="rd-btn rd-btn-secondary" style="padding:6px 12px" ${_orcPagina<=1?'disabled':''} onclick="_orcMudarPagina(-1)">← Anterior</button>
      <span style="font-size:12px;color:var(--tx2)">Página ${_orcPagina} de ${totalPaginas} · ${listaTotal.length} orçamento${listaTotal.length!==1?'s':''}</span>
      <button type="button" class="rd-btn rd-btn-secondary" style="padding:6px 12px" ${_orcPagina>=totalPaginas?'disabled':''} onclick="_orcMudarPagina(1)">Próxima →</button>
    </div>`;
  }
  // "Carregar mais" — só quando o servidor pode ter mais orçamentos além do lote
  // já baixado (ver _ORC_PAGE em loadHist/_carregarMaisOrcamentos). Sem isso o
  // histórico baixava a tabela inteira sempre, crescendo sem limite com o tempo.
  if(_orcTemMais) h+=`<div style="text-align:center;padding:14px 0"><button id="orc-carregar-mais" class="fb" onclick="_carregarMaisOrcamentos()">Carregar mais antigos…</button></div>`;
  // Ação em lote (3i.2) — no rodapé, separada do chip (que é só o
  // indicador). Cobrar/agendar N coisas uma por uma não acontece.
  if(semOSCount>0) h+=`<div style="text-align:center;padding:6px 0 14px"><button type="button" class="rd-btn rd-btn-primary" onclick="_orcAgendarLoteAbrir()">Agendar as ${semOSCount} aprovada${semOSCount!==1?'s':''} sem OS</button></div>`;
  document.getElementById('hist-body').innerHTML=h;
  _rzInit(document.querySelector('#hist-body table.ht'), 'orc');
  _iniciarScrollHint(document.querySelector('#hist-body .htw'));
}

// Mostra uma pista visual (seta com sombra na borda direita) enquanto a
// tabela de histórico (orçamentos/OS) tiver conteúdo fora da tela pra rolar —
// some sozinha quando o usuário já rolou até o fim. Sem isso, no mobile a
// coluna "Ações" fica invisível sem nenhuma indicação de que dá pra arrastar.
function _iniciarScrollHint(el){
  if(!el) return;
  const atualizar=()=>{
    const podeRolar = el.scrollWidth > el.clientWidth + 2;
    const noFim = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    el.classList.toggle('tem-scroll-h', podeRolar && !noFim);
  };
  el.addEventListener('scroll', atualizar, {passive:true});
  window.addEventListener('resize', atualizar);
  requestAnimationFrame(atualizar);
}

function corrigirDataAprovacao(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const atual=o.data_aprovacao?o.data_aprovacao.slice(0,10):'';
  const m=document.createElement('div');
  m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
  m.innerHTML=`<div style="background:var(--white);border-radius:14px;padding:22px 24px;width:320px;box-shadow:0 8px 32px rgba(0,0,0,.18)">
    <div style="font-size:15px;font-weight:800;color:var(--c2);margin-bottom:4px">📅 Data de aprovação</div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:14px">Orçamento #${String(o.numero||'').padStart(3,'0')} — ${esc(o.cliente||'')}</div>
    <input type="date" id="_fix-aprov-inp" value="${atual}" style="width:100%;padding:10px;border:1.5px solid var(--gray-mid);border-radius:8px;font-size:14px;box-sizing:border-box">
    <div style="display:flex;gap:10px;margin-top:16px">
      <button onclick="this.closest('div[style]').remove()" style="flex:1;padding:10px;border:1.5px solid var(--gray-mid);border-radius:8px;background:var(--white);cursor:pointer;font-size:13px">Cancelar</button>
      <button onclick="_salvarDataAprovacao('${id}')" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--c1);color:white;cursor:pointer;font-size:13px;font-weight:700">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{ if(e.target===m) m.remove(); });
}

function _salvarDataAprovacao(id){
  const inp=document.getElementById('_fix-aprov-inp'); if(!inp) return;
  const val=inp.value; if(!val){ toast('Informe a data'); return; }
  const iso=val+'T12:00:00.000Z';
  const o=todosOrc.find(x=>x.id===id); if(o) o.data_aprovacao=iso;
  lsOrcAtualizar(id,{data_aprovacao:iso});
  if(dbOk&&db&&!String(id).startsWith('local_'))
    orcSyncUpdate(id,{data_aprovacao:iso}).catch(e=>console.warn('[fixDataAprov]',e?.message||e));
  document.querySelector('div[style*="z-index:9999"]')?.remove();
  atualizarDash(); renderTabela();
  toast('✅ Data de aprovação corrigida');
}

async function mudarSt(id, sel){
  const st=sel.value; sel.className='ss '+st;
  await _setStatusOrc(id, st);
}
// Núcleo compartilhado de mudança de status (select do histórico + funil CRM).
// extras = campos adicionais a gravar junto (ex.: motivo_perda no CRM).
// Congela o custo do item NO MOMENTO DA APROVAÇÃO. Sem isso, a margem de um
// orçamento antigo seria recalculada com o CMP de hoje — e a resposta muda
// sozinha toda vez que o preço de compra do produto muda, o que é o oposto do
// que "quanto ganhamos nesta venda" significa. Só grava uma vez: item já
// congelado nunca é reescrito, nem se o custo do produto mudar depois.
function _congelarCustoOrc(orc){
  if(!orc || !Array.isArray(orc.servicos)) return false;
  let mudou=false;
  orc.servicos.forEach(s=>{
    if(!s || !s.produto_id) return;
    if(s.custo_unit!=null) return;
    const p=produtoById(s.produto_id);
    if(!p || p.custo==null || p.custo==='') return;
    const cu=parseFloat(p.custo)||0;
    if(!cu) return;
    s.custo_unit=cu;
    s.custo_total=cu*Math.abs(parseInt(s.qty)||1);
    s.custo_em=_hojeLocal();
    mudou=true;
  });
  return mudou;
}
// Margem a partir do custo congelado. `cobertura` = quanto do valor tem custo
// conhecido — sem esse número a margem parece precisa quando na verdade é
// parcial (item sem produto vinculado, ou produto sem custo cadastrado, não
// entra na conta e inflaria o resultado em silêncio).
function _margemOrc(orc){
  const svcs=(orc?.servicos)||[];
  let receita=0, custo=0, receitaComCusto=0;
  svcs.forEach(s=>{
    if(!s) return;
    const qty=Math.abs(parseInt(s.qty)||1);
    const val=(parseFloat(s.p)||0)*qty;
    receita+=val;
    if(s.custo_unit!=null){ custo+=(parseFloat(s.custo_unit)||0)*qty; receitaComCusto+=val; }
  });
  const cobertura = receita>0 ? receitaComCusto/receita : 0;
  return {receita, custo, lucro:receita-custo, margemPct: receita>0?((receita-custo)/receita*100):0, cobertura};
}

async function _setStatusOrc(id, st, extras){
  const changes={status:st, etapa_desde:new Date().toISOString(), ...(extras||{})};
  if(st==='aprovado') changes.data_aprovacao=new Date().toISOString();
  // Sair de "pendente" limpa a situação/decisão prevista — não fazem mais sentido fora da negociação
  if(st!=='pendente' && extras?.crm_situacao===undefined){ changes.crm_situacao=null; changes.crm_decisao_prevista=null; }
  const o=todosOrc.find(x=>x.id===id); if(o) Object.assign(o, changes);
  // Congela ANTES de gravar, pra que servicos[] já saia com custo_unit
  // preenchido no mesmo update — não numa escrita separada que pode falhar.
  if(st==='aprovado' && o && _congelarCustoOrc(o)) changes.servicos=o.servicos;
  lsOrcAtualizar(id, changes);
  if(o) sincronizarBaixaOrcamento(o);
  atualizarDash();
  if(dbOk&&db&&!String(id).startsWith('local_'))
    orcSyncUpdate(id, changes).catch(e=>console.warn('[mudarSt]', e?.message||e));
  logAcao('orcamento_status', `#${o?.numero||'?'} ${o?.cliente||''} → ${st}`);
  // Feedback de reserva de estoque ao aprovar + modal para criar OS
  if(st==='aprovado' && o){
    const prods=(o.servicos||[]).filter(s=>s.produto_id);
    if(prods.length){
      const resumo=prods.map(s=>{
        const p=produtoById(s.produto_id);
        return `${Math.abs(parseInt(s.qty)||1)}× ${p?.nome||s.desc||s.produto_id}`;
      }).join(', ');
      toast(`✅ Aprovado · 📦 Reservado: ${resumo}`);
    } else { toast('✅ Orçamento aprovado!'); }
    setTimeout(()=>_perguntarCriarOS(o), 700);
  } else { toast('✅ Status atualizado'); }
}

function excluirOrc(id){
  confirmar('Excluir este orçamento?', ()=>_excluirOrcVerificarEstoque(id), 'Excluir Orçamento');
}
function _excluirOrcVerificarEstoque(id){
  // Verificar se houve saídas físicas vinculadas a este orçamento
  const saidasVinculadas = todosMovEstoque.filter(m =>
    m.tipo === 'saida' && m.ref && m.ref.includes('baixa:orc:' + id)
  );
  if(saidasVinculadas.length === 0){
    _excluirOrcConfirmado(id);
    return;
  }
  // Montar resumo dos produtos que saíram
  const resumo = saidasVinculadas.map(m => {
    const p = produtoById(m.produto_id);
    return `• ${p?.nome || m.produto_id}: ${Math.abs(m.quantidade)} ${p?.unidade||'un'}`;
  }).join('\n');
  confirmar(
    `Este orçamento teve saída de estoque registrada:\n\n${resumo}\n\nDeseja estornar essas saídas e devolver os itens ao estoque?`,
    () => { _estornarSaidasOrc(id, saidasVinculadas); _excluirOrcConfirmado(id); },
    'Estornar estoque?'
  );
  // Adicionar botão "Não estornar" customizado após abrir o modal
  setTimeout(()=>{
    const naoBtn = document.getElementById('confirmar-nao');
    if(naoBtn){
      const semEstorno = naoBtn.cloneNode(true);
      semEstorno.textContent = 'Não estornar';
      semEstorno.onclick = () => {
        document.getElementById('confirmar-modal-bg')?.classList.remove('on');
        _excluirOrcConfirmado(id);
      };
      naoBtn.parentNode.insertBefore(semEstorno, naoBtn);
      naoBtn.style.display = 'none';
    }
  }, 0);
}
function _estornarSaidasOrc(orcId, saidas){
  const orc = todosOrc.find(x => x.id === orcId);
  const numStr = String(orc?.numero || '').padStart(3, '0');
  saidas.forEach(m => {
    const qtdEstorno = Math.abs(parseFloat(m.quantidade) || 0);
    if(qtdEstorno <= 0) return;
    registrarMovimento({
      produto_id: m.produto_id,
      tipo: 'entrada',
      quantidade: qtdEstorno,
      custo_unit: null,
      motivo: `Estorno — cancelamento orçamento #${numStr}`,
      ref: `estorno:orc:${orcId}:${m.produto_id}:${Date.now()}`,
      lojaId: orc?.loja_id || m.loja_id
    });
  });
  toast('↩ Estoque estornado');
  if(document.getElementById('page-estoque')?.classList.contains('on')) renderEstoque();
}
async function _excluirOrcConfirmado(id){
  // Restaurar botão "Não" do modal caso tenha sido customizado
  const naoBtn = document.getElementById('confirmar-nao');
  if(naoBtn) naoBtn.style.display = '';
  const o=todosOrc.find(x=>x.id===id);
  if(o) sincronizarBaixaOrcamento({...o, status:'excluido'});
  lsOrcRemover(id);
  if(dbOk&&db&&!String(id).startsWith('local_'))
    db.from('orcamentos').delete().eq('id',id).then(()=>{}).catch(()=>{});
  todosOrc=todosOrc.filter(x=>x.id!==id); atualizarDash(); renderTabela();
  logAcao('orcamento_excluido', `#${o?.numero||'?'} ${o?.cliente||''}`);
  toast('🗑 Excluído');
}

// Tarefa 3i.4 (19/08) — topbar única do orçamento aberto, substitui o par
// form-back-bar + a extensão que seria form-acoes-edit (o v2 nunca teve
// essa 2ª barra como o diagnóstico descrevia — as ações NF/Mês/Excluir
// já viviam só na linha do histórico; aqui elas ganham um lugar dentro do
// form também, sem duplicar a lógica, só chamando as mesmas funções).
const STATUS_BADGE_CLS={pendente:'rd-badge-neutral',aprovado:'rd-badge-ok',recusado:'rd-badge-bad',vencido:'rd-badge-warn'};
const STATUS_BADGE_LBL={pendente:'Pendente',aprovado:'Aprovado',recusado:'Recusado',vencido:'Vencido'};
function _orcMontarTopbar(o){
  const tituloEl=document.getElementById('form-topbar-titulo');
  const subEl=document.getElementById('form-topbar-sub');
  const badgeEl=document.getElementById('form-topbar-badge');
  if(tituloEl) tituloEl.textContent='Orçamento #'+String(o.numero||'').padStart(3,'0')+' · '+(o.cliente||'—');
  if(subEl){
    const dtRef=o.status==='aprovado'&&o.data_aprovacao?'aprovado em '+_dataBR(o.data_aprovacao):'criado em '+_dataBR(o.data_criacao);
    // Margem só pra gestor, e só quando o custo já foi congelado (aprovado).
    // A cobertura vai junto SEMPRE que for parcial: uma margem calculada sobre
    // metade do valor parece precisa e não é — sem esse aviso, o número
    // engana mais do que informa.
    let margemTx='';
    if(!eVendas() && o.status==='aprovado'){
      const m=_margemOrc(o);
      if(m.cobertura>0){
        const cobTx = m.cobertura<0.999 ? ` (custo de ${Math.round(m.cobertura*100)}% do valor)` : '';
        margemTx=` · margem ${m.margemPct.toFixed(0)}%${cobTx}`;
      }
    }
    subEl.textContent=(eVendas()?'':brl(o.total||0)+' · ')+dtRef+margemTx;
  }
  if(badgeEl){
    const st=o.status||'pendente';
    badgeEl.innerHTML=`<span class="rd-badge ${STATUS_BADGE_CLS[st]||'rd-badge-neutral'}">${esc(STATUS_BADGE_LBL[st]||st)}</span>`;
  }
  const maisEl=document.getElementById('form-topbar-mais');
  if(maisEl){
    const item=(label,onclick)=>`<button type="button" onclick="${onclick}" style="display:block;width:100%;text-align:left;padding:10px 14px;border:none;background:none;cursor:pointer;font-size:13px;color:var(--c2);font-family:inherit" onmouseover="this.style.background='var(--bg-app,#F7F9FC)'" onmouseout="this.style.background='none'">${esc(label)}</button>`;
    maisEl.innerHTML=[
      !eVendas()?item('Emitir NF', `abrirModalNFe('${o.id}');_orcTopbarToggleMais()`):'',
      o.status==='aprovado'?item('Corrigir mês de aprovação', `corrigirDataAprovacao('${o.id}');_orcTopbarToggleMais()`):'',
      item('Duplicar', `_orcTopbarToggleMais();duplicarOrc('${o.id}')`),
      !eVendas()?item('Excluir', `_orcTopbarToggleMais();excluirOrc('${o.id}')`):''
    ].join('');
  }
}
function _orcTopbarToggleMais(){
  const el=document.getElementById('form-topbar-mais'); if(!el) return;
  el.style.display = el.style.display==='none'||!el.style.display ? 'block' : 'none';
}
document.addEventListener('click', e=>{
  const maisEl=document.getElementById('form-topbar-mais');
  if(maisEl && maisEl.style.display==='block' && !e.target.closest('#form-topbar-mais') && e.target.getAttribute('onclick')!=='_orcTopbarToggleMais()'){
    maisEl.style.display='none';
  }
});

// Tarefa 3i.5 (19/08) — a OS como estado, não como botão. Substitui o que
// hoje é um botão binário só na TABELA do histórico ("Gerar OS"/"OS#NNN")
// por um cartão de estado rico dentro do próprio orçamento aberto, com a
// trilha do ciclo completo.
//
// A trilha do diagnóstico tinha 6 nós (Enviado → Negociado → Aprovado →
// OS → Relatório → Recebido) — "Negociado" não virou nó aqui porque não
// existe like um status distinto no schema (só pendente/aprovado/recusado/
// vencido); inventar um nó sem dado real por trás seria pior que omiti-lo.
// Trilha real de 5 nós: Enviado → Aprovado → OS #NNN → Relatório →
// Recebido. "Relatório" fica sempre tracejado (3i.8 não existe ainda).
function _orcMontarCartaoOS(o){
  const trilhaWrap=document.getElementById('orc-trilha-wrap');
  const cardWrap=document.getElementById('orc-cartao-os');
  if(!trilhaWrap||!cardWrap) return;
  // Pendente/recusado/vencido: o negócio ainda pode nem virar OS — a
  // trilha linear de 5 nós não representa bem uma saída lateral. Cartão
  // simples, sem forçar uma trilha que não é fiel ao que aconteceu.
  if(o.status!=='aprovado'){
    trilhaWrap.style.display='none';
    const msgs={
      pendente:{tit:'Aguardando decisão',sub:'enviado, ainda sem resposta do cliente',acaoLbl:'Cobrar resposta'},
      recusado:{tit:'Recusado',sub:'o cliente não aprovou este orçamento'},
      vencido:{tit:'Vencido',sub:'prazo de validade expirado sem resposta',acaoLbl:'Revalidar preço'}
    };
    const m=msgs[o.status]||msgs.pendente;
    cardWrap.innerHTML=_renderCartaoEstado({
      eyebrow:'Situação do negócio', titulo:m.tit, tituloSub:m.sub,
      acao:m.acaoLbl?{label:m.acaoLbl}:null
    });
    cardWrap.style.display='block';
    return;
  }
  const osVinc=(todosOS||[]).find(x=>x.orcamento_id===o.id);
  const recebidoTotal=(parseFloat(o.total)||0)>0 && o.status==='aprovado' && _orcSaldoAReceber(o)<=0.005;
  const nos=[
    {label:'Enviado', data:_dataBR(o.data_criacao)},
    {label:'Aprovado', data:_dataBR(o.data_aprovacao)},
    {label:osVinc?'OS #'+String(osVinc.numero||'').padStart(3,'0'):'OS', data:osVinc?.data_servico?_dataBR(osVinc.data_servico):undefined},
    {label:'Relatório', tracejado:true},
    {label:'Recebido'}
  ];
  let atualIdx;
  if(recebidoTotal) atualIdx=nos.length;
  else if(osVinc && osVinc.status==='concluido') atualIdx=3;
  else atualIdx=2;
  trilhaWrap.innerHTML=_renderTrilhaEstados(nos, atualIdx);
  trilhaWrap.style.display='block';

  let cfg;
  if(!osVinc){
    const dias=o.data_aprovacao?Math.max(0,Math.floor((new Date()-new Date(o.data_aprovacao))/86400000)):0;
    cfg={eyebrow:'A execução deste orçamento', titulo:'Nada agendado ainda',
      tituloSub:`aprovado há ${dias} dia${dias!==1?'s':''}`,
      acao:{label:'Agendar a execução', onclick:`gerarOS_deOrc('${o.id}')`}};
  }else if(osVinc.status==='concluido'){
    cfg={eyebrow:'A execução deste orçamento', titulo:'Executado',
      tituloSub:osVinc.data_servico?'em '+_dataBR(osVinc.data_servico)+' · aguardando relatório':'aguardando relatório',
      acao:{label:'Abrir OS #'+String(osVinc.numero||'').padStart(3,'0'), onclick:`verDetalhesOS('${osVinc.id}')`}};
  }else if(osVinc.status==='em_andamento'){
    // Real desde a persistência de check-in (achado ao planejar a 3i.6) —
    // antes deste fix "em campo" nunca aparecia aqui, mesmo com o técnico
    // trabalhando naquele momento.
    cfg={eyebrow:'A execução deste orçamento', timer:'em campo',
      titulo:'OS #'+String(osVinc.numero||'').padStart(3,'0')+' em campo',
      tituloSub:osVinc.tecnico?osVinc.tecnico+' está no local agora':'acontecendo agora',
      acao:{label:'Abrir OS #'+String(osVinc.numero||'').padStart(3,'0'), onclick:`verDetalhesOS('${osVinc.id}')`}};
  }else{
    cfg={eyebrow:'A execução deste orçamento', titulo:'OS #'+String(osVinc.numero||'').padStart(3,'0'),
      tituloSub:osVinc.data_servico?'agendada para '+_dataBR(osVinc.data_servico):'agendada, sem data definida',
      acao:{label:'Abrir OS #'+String(osVinc.numero||'').padStart(3,'0'), onclick:`verDetalhesOS('${osVinc.id}')`}};
  }
  if(recebidoTotal) cfg.nota='Pagamento recebido integralmente.';
  cardWrap.innerHTML=_renderCartaoEstado(cfg);
  cardWrap.style.display='block';
}

function abrirOrc(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  editId=id;
  setV('cli',o.cliente||''); setV('loc',o.local_servico||''); setV('tel-cli',o.tel_cliente||''); setV('cnpj-cli',o.cnpj||''); setV('cpf-cli',o.cpf_cliente||'');
  setV('cli-id',o.cliente_id||'');
  setV('orc-loja',o.loja_id||lojaAtiva||LOJA_PADRAO_ID); // fix #4: lojaAtiva como fallback para registros antigos
  // Restaura condição de pagamento: pag_cod=código do select; pag_parcelas/pag_entrada=detalhes
  const _PAG_CODIGOS=['boleto-parc','entrada-boleto','entrada-pix','cartao-parc'];
  const _pagCod=o.pag_cod||(_PAG_CODIGOS.includes(o.pagamento)?o.pagamento:'A combinar');
  setV('pag',_pagCod); updPag();
  if(o.pag_parcelas) setV('pag-parcelas',String(o.pag_parcelas));
  if(o.pag_entrada!=null&&o.pag_entrada!==0) setV('pag-entrada',String(o.pag_entrada).replace('.',','));
  setV('val',String(o.validade_dias||5));
  setV('obs',o.obs||''); setV('escopo',o.escopo||''); setV('data-svc',o.data_servico||'');
  setV('nota-interna',o.nota_interna||'');
  setOrigemCli(o.origem_cliente||'');
  // Restaura desconto salvo (bug: antes o desconto sumia ao editar e salvar)
  setV('disc-v',o.desconto>0?String(o.desconto):''); setV('disc-t','R$');
  { const tov=document.getElementById('toggle-ocultar-valores'); if(tov) tov.checked=!!o.ocultar_valores; }
  svcs=(o.servicos||[]).map(s=>({id:Date.now()+Math.random(),d:s.desc,p:String(s.precoUnit||s.preco||''),qty:s.qty||1,produto_id:s.produto_id||null}));
  if(!svcs.length) svcs=[{id:Date.now(),d:'',p:''}];
  // Compatibilidade: antigo=string, novo=JSON array
  try{
    const raw=o.foto_base64||'';
    fotosB64=raw.startsWith('[')?JSON.parse(raw):(raw?[raw]:[]);
  }catch(e){ fotosB64=[]; }
  renderFotosOrcSlots();
  renderSvcs(); upd(); go('form');
  carregarMunicipiosFiscais().then(()=>setV('municipio-servico', o.municipio_servico_ibge||''));
  const bb=document.getElementById('form-back-bar');
  const bl=document.getElementById('form-back-label');
  if(bb){ bb.style.display='flex'; }
  if(bl){ bl.textContent='Editando ORC #'+String(o.numero).padStart(3,'0'); }
  _orcMontarTopbar(o);
  _orcMontarCartaoOS(o);
  toast('✏️ Editando Orçamento #'+String(o.numero).padStart(3,'0'));
}

function verOrcPDF(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const numStr=String(o.numero||'').padStart(3,'0');
  const dadosOrc={
    cli:o.cliente||'—', loc:o.local_servico||'', tel:o.tel_cliente||'', cnpj:o.cnpj||'', cpf:o.cpf_cliente||'',
    pag:o.pag_cod||o.pagamento||'A combinar', pagFormatado:o.pagamento||'A combinar',
    dias:o.validade_dias||5, obs:o.obs||'', escopo:o.escopo||'',
    dataSvc:o.data_servico||'', vData:o.validade_data||'',
    dataStr:new Date(o.data_criacao||Date.now()).toLocaleDateString('pt-BR'),
    sub:o.subtotal||0, desc:o.desconto||0, tot:o.total||0,
    svcs:o.servicos||[], loja_id:o.loja_id||LOJA_PADRAO_ID,
    ocultarValores:!!o.ocultar_valores
  };
  const savedFotos=[...fotosB64];
  try{ const raw=o.foto_base64||''; fotosB64=raw.startsWith('[')?JSON.parse(raw):(raw?[raw]:[]); }catch(e){ fotosB64=[]; }
  preencherDocOrc(dadosOrc, numStr);
  fotosB64=savedFotos;
  imprimirDoc('orc');
}

function duplicarOrc(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  editId=null; fotosB64=[];
  // Achado no caminho (3i.4): sem isso, duplicar a partir de dentro de um
  // orçamento já aberto deixava a topbar de edição visível (com o número
  // do orçamento ANTERIOR) por cima do formulário do novo — confuso, já
  // que este é um orçamento novo, não uma edição.
  const bbDup=document.getElementById('form-back-bar'); if(bbDup) bbDup.style.display='none';
  const trilhaWDup=document.getElementById('orc-trilha-wrap'); if(trilhaWDup) trilhaWDup.style.display='none';
  const cardOSDup=document.getElementById('orc-cartao-os'); if(cardOSDup) cardOSDup.style.display='none';
  setV('cli',o.cliente||''); setV('cli-id',o.cliente_id||''); setV('loc',o.local_servico||''); setV('tel-cli',o.tel_cliente||''); setV('cnpj-cli',o.cnpj||''); setV('cpf-cli',o.cpf_cliente||'');
  const _PAG_COD2=['boleto-parc','entrada-boleto','entrada-pix','cartao-parc'];
  setV('pag',o.pag_cod||(_PAG_COD2.includes(o.pagamento)?o.pagamento:'A combinar')); updPag();
  if(o.pag_parcelas) setV('pag-parcelas',String(o.pag_parcelas));
  if(o.pag_entrada!=null&&o.pag_entrada!==0) setV('pag-entrada',String(o.pag_entrada).replace('.',','));
  setV('val',String(o.validade_dias||5));
  setV('obs',o.obs||''); setV('escopo',o.escopo||'');
  setV('nota-interna',''); // não copia nota interna
  setV('data-svc','');
  setOrigemCli(o.origem_cliente||'');
  setV('orc-loja',o.loja_id||LOJA_PADRAO_ID);
  document.getElementById('data-orc').value=_hojeLocal();
  setV('disc-v',String(o.desconto||0)); setV('disc-t','R$');
  svcs=(o.servicos||[]).map(s=>({id:Date.now()+Math.random(),d:s.desc,p:String(s.precoUnit||s.preco||''),qty:s.qty||1,produto_id:s.produto_id||null}));
  if(!svcs.length) svcs=[{id:Date.now(),d:'',p:''}];
  renderFotosOrcSlots();
  const tog=document.getElementById('toggle-os'); if(tog) tog.checked=false;
  const osf=document.getElementById('os-inline-fields'); if(osf) osf.style.display='none';
  { const tov=document.getElementById('toggle-ocultar-valores'); if(tov) tov.checked=!!o.ocultar_valores; }
  limparRascunho('form'); window._skipDraftForm=true; // não deixar rascunho antigo sobrescrever os dados duplicados
  renderSvcs(); upd(); go('form');
  toast('📋 Orçamento duplicado — edite e salve como novo');
}

function gerarOS_deOrc(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  osEditId = null;
  osOrcId = id;
  setV('os-cli',o.cliente||''); setV('os-cli-id',o.cliente_id||''); setV('os-loc',o.local_servico||''); setV('os-cnpj',o.cnpj||''); setV('os-cpf',o.cpf_cliente||'');
  _osPopularEquipamentos(o.equipamento_id||'');
  setV('os-loja',o.loja_id||lojaAtiva||LOJA_PADRAO_ID);
  setV('os-data',o.data_servico||''); setV('os-total',String(o.total||0));
  osSvcs=(o.servicos||[]).map(s=>({id:Date.now()+Math.random(),d:s.desc}));
  if(!osSvcs.length) osSvcs=[{id:Date.now(),d:''}];
  renderOSSvcs();
  document.getElementById('os-src-badge').textContent='· do Orçamento #'+String(o.numero).padStart(3,'0');
  document.getElementById('btn-os-both').style.display='flex';
  document.getElementById('btn-os-pdf').style.gridColumn='';
  // Lista de materiais do estoque para o técnico separar
  const matEl=document.getElementById('os-mat');
  const prodsSvc=(o.servicos||[]).filter(s=>s.produto_id);
  if(matEl && prodsSvc.length){
    const linhas=prodsSvc.map(s=>{
      const p=produtoById(s.produto_id);
      return `• ${Math.abs(parseInt(s.qty)||1)}× ${p?.nome||s.desc} (${p?.unidade||'un'})`;
    });
    matEl.value='📦 Materiais a separar:\n'+linhas.join('\n');
  }
  go('os');
  atualizarPainelItensOS();
}

function novaOS(){
  osEditId=null; // OS nova
  checkinAt=null; if(checkinTimer){clearInterval(checkinTimer);checkinTimer=null;}
  const checkinBarEl=document.getElementById('checkin-bar'); if(checkinBarEl) checkinBarEl.style.display='none';
  const checkinFormEl=document.getElementById('checkin-form'); if(checkinFormEl) checkinFormEl.style.display='flex';
  const checkinInfoEl=document.getElementById('checkin-info'); if(checkinInfoEl) checkinInfoEl.textContent='';
  populaTecCheckIn();
  osOrcId = null;
  osFotosAntes=[]; osFotosDepois=[]; renderOSFotosSlots();
  osMateriais=[]; _osMatRenderLista(); setV('os-mat-busca','');
  const _sugMat=document.getElementById('os-mat-sugestoes'); if(_sugMat) _sugMat.innerHTML='';
  setV('os-video-link',''); setV('os-cli-id','');
  { const _er=document.getElementById('os-equip-row'); if(_er) _er.style.display='none'; const _es=document.getElementById('os-equip-id'); if(_es) _es.innerHTML='<option value="">— nenhum —</option>'; }
  setV('os-loja', lojaAtiva||LOJA_PADRAO_ID);
  document.getElementById('os-src-badge').textContent='';
  document.getElementById('btn-os-both').style.display='none';
  document.getElementById('btn-os-pdf').style.gridColumn='1/-1';
  const tituloEl=document.getElementById('os-form-titulo');
  if(tituloEl) tituloEl.textContent='Nova Ordem de Serviço';
  // Reseta checklist
  osChecklist = OS_CHECKLIST_DEFAULT.map(x=>({...x}));
  renderOsChecklist();
  // Limpa campos de texto (bug: dados da OS anterior ficavam no formulário)
  ['os-cli','os-loc','os-cnpj','os-cpf','os-obs','os-mat','os-total','os-tec'].forEach(id=>setV(id,''));
  setV('os-data', _hojeLocal());
  setV('os-hora','08:00');
  osSvcs=[{id:Date.now(),d:''}]; renderOSSvcs();
  // OS nova não tem estado nenhum ainda (Tarefa 3i.6) — esconde topbar/
  // trilha/cartão da OS anterior que possa ter ficado visível.
  const osTopoEl=document.getElementById('os-topo-estado'); if(osTopoEl) osTopoEl.style.display='none';
  const osTrilhaEl=document.getElementById('os-trilha-wrap'); if(osTrilhaEl) osTrilhaEl.style.display='none';
  const osCardEl=document.getElementById('os-cartao-estado'); if(osCardEl) osCardEl.style.display='none';
  const totEl=document.getElementById('os-total'); if(totEl){ totEl.removeAttribute('readonly'); totEl.style.background=''; }
  const lockEl=document.getElementById('os-total-lock'); if(lockEl) lockEl.style.display='none';
  _osAplicarModoLeitura(true); // form novo: sempre editável, ninguém "leu a execução de outro" ainda
}

// ── MODAL PAGAMENTO ──
function abrirModalPg(id, tot){ modalOrcId=id; setV('mg-tot',brl(tot)); setV('mg-val',''); document.getElementById('modal-pg').classList.add('on'); }
function fecharModal(){ document.getElementById('modal-pg').classList.remove('on'); modalOrcId=null; }
async function salvarPagamento(){
  const v=parseFloat(gV('mg-val'))||0;
  const o=todosOrc.find(x=>x.id===modalOrcId); if(o){ o.valor_recebido=v; }
  lsOrcAtualizar(modalOrcId,{valor_recebido:v}); // persiste local
  if(dbOk&&db&&!String(modalOrcId||'').startsWith('local_'))
    db.from('orcamentos').update({valor_recebido:v}).eq('id',modalOrcId).then(()=>{}).catch(()=>{});
  fecharModal(); atualizarDash(); renderTabela();
  if(document.getElementById('page-produtividade')?.classList.contains('on')) renderContasReceber();
  toast('💰 Pagamento registrado: '+brl(v));
}

// ──────────────────────────────────────────────────
//  OS HISTORY
// ──────────────────────────────────────────────────
// Reenvia ao banco OS que ficaram presas só no aparelho (id local_*) — mesma lógica
// de _reenviarOrcamentosLocais (achado de auditoria: OS não tinha esse reenvio,
// diferente de orçamento/vistoria/agendamento — ficava presa pra sempre no aparelho).
async function _reenviarOSLocais(soLocal){
  if(!dbOk||!db||!soLocal||!soLocal.length) return false;
  let mudou=false;
  for(const rec of soLocal){
    try{
      const payload={...rec}; delete payload.id; // banco gera o id definitivo
      const {data:ins,error}=await dbInsertNumerado('ordens_servico',payload);
      if(error){ console.warn('[reenvioOSLocal] falhou #'+(rec.numero||'?')+':', error.message); continue; }
      if(ins){
        const lista=JSON.parse(ls('fluxa_os_hist')||'[]').filter(x=>x.id!==rec.id);
        lista.unshift(ins);
        lsSet('fluxa_os_hist', JSON.stringify(lista.slice(0,600)));
        todosOS=todosOS.filter(x=>x.id!==rec.id);
        todosOS.unshift(ins);
        mudou=true;
      }
    }catch(e){ console.warn('[reenvioOSLocal] erro:', e?.message||e); }
  }
  return mudou;
}

async function loadOSHist(){
  document.getElementById('osh-body').innerHTML='<div class="load"><div class="spin"></div> Carregando…</div>';
  // 1. SEMPRE mostra dados locais primeiro — sem depender do banco (mesmo padrão de loadHist).
  // Achado de auditoria: antes disso, offline zerava todosOS incondicionalmente e a
  // tela de Histórico de OS aparecia vazia mesmo com OS salvas no aparelho.
  const local=JSON.parse(ls('fluxa_os_hist')||'[]');
  if(local.length>0) todosOS=local;
  renderOSTabela();
  // 2. Se BD disponível: sincroniza em background e atualiza a view
  if(dbOk&&db){
    try{
      const {data,error}=await db.from('ordens_servico').select('*').eq('empresa_id',EMPRESA_ID).order('data_criacao',{ascending:false}).range(0,_OS_PAGE-1);
      if(error) throw error;
      _osServidorOffset=data.length; _osTemMais=data.length===_OS_PAGE;
      const dbIds=new Set((data||[]).map(x=>x.id));
      const soLocal=todosOS.filter(x=>String(x.id).startsWith('local_')&&!dbIds.has(x.id));
      todosOS=[...(data||[]),...soLocal];
      lsSet('fluxa_os_hist', JSON.stringify(todosOS.slice(0,600)));
      renderOSTabela();
      // Recupera OS presas só no aparelho (não sincronizadas) → reenvia ao banco
      if(soLocal.length){
        const mudou=await _reenviarOSLocais(soLocal);
        if(mudou) renderOSTabela();
      }
    }catch(e){ console.warn('loadOSHist erro:',e.message); }
  }
}

// Busca o próximo lote de OS mais antigas — mesmo padrão de _carregarMaisOrcamentos().
async function _carregarMaisOS(){
  if(!dbOk||!db||!_osTemMais) return;
  const btn=document.getElementById('os-carregar-mais'); if(btn) btn.textContent='Carregando…';
  try{
    const {data,error}=await db.from('ordens_servico').select('*').eq('empresa_id',EMPRESA_ID).order('data_criacao',{ascending:false}).range(_osServidorOffset,_osServidorOffset+_OS_PAGE-1);
    if(error) throw error;
    _osServidorOffset+=data.length; _osTemMais=data.length===_OS_PAGE;
    const idsJa=new Set(todosOS.map(x=>x.id));
    const novos=data.filter(x=>!idsJa.has(x.id));
    todosOS=[...todosOS,...novos];
    lsSet('fluxa_os_hist', JSON.stringify(todosOS.slice(0,600)));
    renderOSTabela();
  }catch(e){ console.warn('[carregarMaisOS]', e?.message||e); toast('⚠️ Falha ao carregar mais OS'); }
}

function filtOS(btn){
  document.querySelectorAll('#page-os-history .fb[data-oss]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); filtroOSSt=btn.dataset.oss;
  localStorage.setItem('fluxa_filtroOSSt', filtroOSSt);
  renderOSTabela();
}
function buscarOS(v){ buscaOS=v.toLowerCase(); renderOSTabela(); }
function filtTecOSSelect(val){ filtroOSTec=val; renderOSTabela(); }

function populaFiltTecOS(){
  const sel=document.getElementById('os-filt-tec'); if(!sel) return;
  const lojaObj=lojaAtiva?getLoja(lojaAtiva):null;
  let tecs;
  if(lojaObj){ tecs=lojaObj.tecs||[]; }
  else { tecs=[...new Set(LOJAS.flatMap(l=>l.tecs||[]))]; }
  sel.innerHTML='<option value="">👤 Todos técnicos</option>'+tecs.map(t=>`<option value="${t}" ${t===filtroOSTec?'selected':''}>${t}</option>`).join('');
}

// Auto-vence orçamentos pendentes cujo prazo de validade já expirou
function autoVencerOrc(lista){
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  let mudou=false;
  lista.forEach(o=>{
    if(o.status!=='pendente') return;
    const dt=_orcData(o); if(!dt) return;
    const val=parseInt(o.validade_dias)||5;
    const expira=new Date(dt); expira.setDate(expira.getDate()+val); expira.setHours(23,59,59,999);
    if(expira<hoje){
      o.status='vencido'; mudou=true;
      lsOrcAtualizar(o.id,{status:'vencido'});
      if(dbOk&&db&&!String(o.id).startsWith('local_'))
        db.from('orcamentos').update({status:'vencido'}).eq('id',o.id).then(()=>{}).catch(()=>{});
    }
  });
  if(mudou) atualizarDash();
  return lista;
}

// ══════════════════════════════════════════════════
//  OS EM LOTE
// ══════════════════════════════════════════════════
// Com várias OS atrasadas, abrir uma por uma pra atribuir técnico ou
// remarcar é o que faz a fila não andar. Aqui a ação vale pra seleção
// inteira. Cada laço pula OS já concluída/cancelada — um clique errado
// não pode reabrir OS fechada.
let osSelecionadas = new Set();

function _osToggleSelecao(id){
  if(osSelecionadas.has(id)) osSelecionadas.delete(id); else osSelecionadas.add(id);
  _osRenderBarraLote();
}
function _osToggleTodos(){
  const boxes=document.querySelectorAll('[data-os-check]');
  const todosMarcados = boxes.length>0 && [...boxes].every(b=>osSelecionadas.has(b.dataset.osCheck));
  boxes.forEach(b=>{
    const id=b.dataset.osCheck;
    if(todosMarcados) osSelecionadas.delete(id); else osSelecionadas.add(id);
    b.checked=!todosMarcados;
  });
  _osRenderBarraLote();
}
function _osLimparSelecao(){
  osSelecionadas.clear();
  document.querySelectorAll('[data-os-check]').forEach(b=>{ b.checked=false; });
  const t=document.getElementById('os-check-todos'); if(t) t.checked=false;
  _osRenderBarraLote();
}
function _osRenderBarraLote(){
  const el=document.getElementById('os-lote-barra'); if(!el) return;
  if(!osSelecionadas.size){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='flex';
  el.innerHTML=`
    <span style="font-weight:700;color:var(--c2);font-size:13px">${osSelecionadas.size} selecionada${osSelecionadas.size!==1?'s':''}</span>
    <button type="button" class="tb g" onclick="_osLoteAtribuirTecnico()">Atribuir técnico</button>
    <button type="button" class="tb" onclick="_osLoteRemarcar()">Remarcar</button>
    <button type="button" class="tb" onclick="_osLoteConcluir()">Concluir</button>
    <button type="button" class="tb d" onclick="_osLoteCancelar()">Cancelar OS</button>
    <button type="button" class="tb" style="margin-left:auto" onclick="_osLimparSelecao()">Limpar seleção</button>`;
}
// Persiste o estado local depois de um lote — sem isto, recarregar a tela
// mostraria o estado antigo até o próximo sync.
function _osLoteSalvarLocal(){
  try{ lsSet('fluxa_os_hist', JSON.stringify(todosOS.slice(0,200))); }
  catch(e){ console.warn('[osLote local]', e?.message||e); }
}
function _osLoteAtivas(){
  return [...osSelecionadas]
    .map(id=>todosOS.find(x=>x.id===id))
    .filter(o=>o && o.status!=='concluido' && o.status!=='cancelado');
}

function _osLoteAtribuirTecnico(){
  if(!osSelecionadas.size) return;
  const tecs=(typeof getTecnicos==='function')?getTecnicos():[];
  abrirModal({id:'os-lote-modal', corpo:`
    <h3>Atribuir técnico</h3>
    <p class="rd-modal-sub">${osSelecionadas.size} OS selecionada${osSelecionadas.size!==1?'s':''}</p>
    <div class="rd-field"><label class="rd-field-lbl">Técnico</label>
      <div class="rd-field-box"><select id="os-lote-tec-select" style="width:100%">
        <option value="">Selecione…</option>${tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}
      </select></div></div>
    <div class="rd-modal-acts">
      <button class="rd-modal-btn rd-modal-btn-nao" onclick="fecharModalGenerico('os-lote-modal')">Cancelar</button>
      <button class="rd-modal-btn rd-modal-btn-sim" onclick="_osLoteAtribuirConfirmar()">Atribuir</button>
    </div>`});
}
async function _osLoteAtribuirConfirmar(){
  const tec=gV('os-lote-tec-select');
  if(!tec){ toast('⚠️ Selecione um técnico'); return; }
  fecharModalGenerico('os-lote-modal');
  const alvos=_osLoteAtivas();
  let ok=0, falhou=0;
  for(const o of alvos){
    if(dbOk&&db&&!String(o.id).startsWith('local_')){
      try{
        const r=await dbUpdate('ordens_servico', {tecnico:tec}, 'id', o.id);
        // dbUpdate NÃO rejeita em erro de query — só resolve com {error}.
        // Contar sucesso sem checar isto marcaria como feito o que não foi.
        if(r?.error){ console.warn('[osLoteAtribuir]', r.error.message); falhou++; continue; }
      }catch(e){ console.warn('[osLoteAtribuir]', e?.message||e); falhou++; continue; }
    }
    o.tecnico=tec; ok++;
  }
  _osLoteSalvarLocal();
  if(typeof logAcao==='function') logAcao('os_lote_atribuir', `${ok} OS atribuídas a ${tec}`);
  osSelecionadas.clear(); renderOSTabela();
  toast(falhou?`${ok} atribuída${ok!==1?'s':''} · ${falhou} não sincronizou — verifique a conexão`
              :`✅ ${ok} OS atribuída${ok!==1?'s':''} a ${tec}`);
}

function _osLoteRemarcar(){
  if(!osSelecionadas.size) return;
  abrirModal({id:'os-lote-modal', corpo:`
    <h3>Remarcar</h3>
    <p class="rd-modal-sub">${osSelecionadas.size} OS selecionada${osSelecionadas.size!==1?'s':''} — nova data</p>
    <div class="rd-field"><label class="rd-field-lbl">Data</label>
      <div class="rd-field-box"><input type="date" id="os-lote-data-input" value="${_hojeLocal()}" style="width:100%"></div></div>
    <div class="rd-modal-acts">
      <button class="rd-modal-btn rd-modal-btn-nao" onclick="fecharModalGenerico('os-lote-modal')">Cancelar</button>
      <button class="rd-modal-btn rd-modal-btn-sim" onclick="_osLoteRemarcarConfirmar()">Remarcar</button>
    </div>`});
}
async function _osLoteRemarcarConfirmar(){
  const novaData=gV('os-lote-data-input');
  if(!novaData){ toast('⚠️ Escolha uma data'); return; }
  fecharModalGenerico('os-lote-modal');
  const alvos=_osLoteAtivas();
  let ok=0, falhou=0;
  for(const o of alvos){
    if(dbOk&&db&&!String(o.id).startsWith('local_')){
      try{
        const r=await dbUpdate('ordens_servico', {data_servico:novaData, status:'agendado'}, 'id', o.id);
        if(r?.error){ console.warn('[osLoteRemarcar]', r.error.message); falhou++; continue; }
      }catch(e){ console.warn('[osLoteRemarcar]', e?.message||e); falhou++; continue; }
    }
    o.data_servico=novaData; o.status='agendado'; ok++;
  }
  _osLoteSalvarLocal();
  if(typeof logAcao==='function') logAcao('os_lote_remarcar', `${ok} OS remarcadas para ${novaData}`);
  osSelecionadas.clear(); renderOSTabela();
  toast(falhou?`${ok} remarcada${ok!==1?'s':''} · ${falhou} não sincronizou — verifique a conexão`
              :`✅ ${ok} OS remarcada${ok!==1?'s':''}`);
}

function _osLoteConcluir(){
  if(!osSelecionadas.size) return;
  const n=osSelecionadas.size;
  confirmar({
    titulo:'Concluir OS em lote',
    msg:`${n} ordem${n!==1?'s':''} de serviço será${n!==1?'ão':''} marcada${n!==1?'s':''} como concluída${n!==1?'s':''} — sem check-in/check-out, sem observação, material ou foto. Pra registrar o que foi feito em alguma delas, abra a OS individualmente. Dá baixa automática no estoque quando há orçamento vinculado.`,
    labelSim:'Concluir as '+n, labelNao:'Cancelar',
    onSim: async ()=>{
      const alvos=_osLoteAtivas();
      let ok=0, falhou=0;
      for(const o of alvos){
        if(dbOk&&db&&!String(o.id).startsWith('local_')){
          try{
            const r=await dbUpdate('ordens_servico', {status:'concluido'}, 'id', o.id);
            if(r?.error){ console.warn('[osLoteConcluir]', r.error.message); falhou++; continue; }
          }catch(e){ console.warn('[osLoteConcluir]', e?.message||e); falhou++; continue; }
        }
        // Só marca local DEPOIS de confirmar o servidor — senão a tela diria
        // "concluída" e o próximo sync traria de volta como pendente.
        o.status='concluido'; ok++;
        try{ if(typeof _entregarPelaOS==='function') _entregarPelaOS(o.id); }catch(e){ console.warn('[osLote entrega]', e?.message||e); }
        if(o.agendamento_id && typeof _gerarProximaOSdoAg==='function'){
          Promise.resolve(_gerarProximaOSdoAg(o.agendamento_id, o.data_servico)).catch(e=>console.warn('[osLote proxOS]', e?.message||e));
        }
      }
      _osLoteSalvarLocal();
      if(typeof logAcao==='function') logAcao('os_lote_concluir', `${ok} OS concluídas em lote`);
      osSelecionadas.clear(); renderOSTabela(); atualizarDash();
      toast(falhou?`${ok} concluída${ok!==1?'s':''} · ${falhou} não sincronizou — verifique a conexão`
                  :`✅ ${ok} OS concluída${ok!==1?'s':''}`);
    }
  });
}

function _osLoteCancelar(){
  if(!osSelecionadas.size) return;
  const n=osSelecionadas.size;
  confirmar({
    titulo:'Cancelar OS em lote', destrutivo:true,
    msg:`${n} ordem${n!==1?'s':''} de serviço será${n!==1?'ão':''} marcada${n!==1?'s':''} como cancelada${n!==1?'s':''}. Não dá para desfazer em lote.`,
    labelSim:'Cancelar as '+n, labelNao:'Manter',
    onSim: async ()=>{
      const alvos=_osLoteAtivas();
      let ok=0, falhou=0;
      for(const o of alvos){
        if(dbOk&&db&&!String(o.id).startsWith('local_')){
          try{
            const r=await dbUpdate('ordens_servico', {status:'cancelado'}, 'id', o.id);
            if(r?.error){ console.warn('[osLoteCancelar]', r.error.message); falhou++; continue; }
          }catch(e){ console.warn('[osLoteCancelar]', e?.message||e); falhou++; continue; }
        }
        o.status='cancelado'; ok++;
      }
      _osLoteSalvarLocal();
      if(typeof logAcao==='function') logAcao('os_lote_cancelar', `${ok} OS canceladas em lote`);
      osSelecionadas.clear(); renderOSTabela(); atualizarDash();
      toast(falhou?`${ok} cancelada${ok!==1?'s':''} · ${falhou} não sincronizou — verifique a conexão`
                  :`✅ ${ok} OS cancelada${ok!==1?'s':''}`);
    }
  });
}

// ══════════════════════════════════════════════════
//  COLUNAS REDIMENSIONÁVEIS
// ══════════════════════════════════════════════════
// Nome de produto e "cliente + serviço" têm tamanho muito variável: qualquer
// largura fixa corta alguém. Em vez de escolher um número melhor, deixa a
// pessoa arrastar — e lembra a escolha por navegador.
//
// Funciona em <table> comum (o Fluxa não usa grid nas tabelas): a largura vai
// no <th> e só vale com table-layout:fixed, senão o navegador trata como
// sugestão e recalcula pelo conteúdo.
function _rzChave(tid){ return 'fluxa_col_w_'+tid; }
function _rzLer(tid){
  try{ const a=JSON.parse(ls(_rzChave(tid))||'null');
    return Array.isArray(a)&&a.every(n=>typeof n==='number'&&n>20)?a:null;
  }catch(e){ return null; }
}
function _rzSalvar(tid,ws){ try{ lsSet(_rzChave(tid), JSON.stringify(ws)); }catch(e){ console.warn('[colRz]',e?.message||e); } }
function _rzResetar(tid){
  try{ lsDel(_rzChave(tid)); }catch(e){ console.warn('[colRz reset]',e?.message||e); }
  const tbl=document.querySelector(`table[data-rz="${tid}"]`);
  if(tbl){ tbl.classList.remove('col-rz-tbl'); tbl.style.width='';
    [...tbl.querySelectorAll('th')].forEach(th=>{ th.style.width=''; }); _rzInit(tbl, tid); }
  toast('Larguras restauradas');
}
// A tabela é width:100%. Sob table-layout:fixed isso faz o navegador
// redistribuir a sobra por todas as colunas sempre que a soma das larguras
// fica abaixo do container — encolher UMA coluna inchava todas as outras. Com
// a largura total escrita à mão, cada coluna fica exatamente onde foi posta.
function _rzLargura(tbl, ths){
  const soma=ths.reduce((a,t)=>a+(parseFloat(t.style.width)||t.getBoundingClientRect().width),0);
  tbl.style.width=Math.round(soma)+'px';
}
// Chamar DEPOIS de escrever o innerHTML da tabela. A última coluna não ganha
// alça (não há borda à direita dela pra arrastar), mas tem largura fixada
// junto com as outras — ver comentário em congelar().
function _rzInit(tbl, tid){
  if(!tbl) return;
  tbl.dataset.rz=tid;
  const ths=[...tbl.querySelectorAll('thead th')];
  if(ths.length<2) return;
  const arrastaveis=ths.slice(0,-1);
  // Congela TODAS as colunas, inclusive a última. Deixar a última em "auto"
  // parecia elegante (absorveria a sobra), mas sob table-layout:fixed ela é
  // espremida até 0px assim que a soma das outras passa da largura do
  // container — a coluna de Ações sumia da tela no primeiro arraste largo.
  const congelar=()=>{
    if(tbl.classList.contains('col-rz-tbl')) return;
    const atuais=ths.map(t=>Math.round(t.getBoundingClientRect().width));
    tbl.classList.add('col-rz-tbl');
    ths.forEach((t,j)=>{ t.style.width=atuais[j]+'px'; });
    _rzLargura(tbl, ths);
  };
  const salvar=()=>_rzSalvar(tid, ths.map(t=>Math.round(parseFloat(t.style.width)||t.getBoundingClientRect().width)));
  const salvas=_rzLer(tid);
  if(salvas && salvas.length===ths.length){
    tbl.classList.add('col-rz-tbl');
    ths.forEach((th,i)=>{ th.style.width=salvas[i]+'px'; });
    _rzLargura(tbl, ths);
  }
  arrastaveis.forEach(th=>{
    if(th.querySelector('.col-rz')) return;
    th.classList.add('col-rz-host');
    const h=document.createElement('span');
    h.className='col-rz'; h.setAttribute('aria-hidden','true'); h.title='Arraste para redimensionar';
    th.appendChild(h);
    let x0=0, w0=0;
    // w0 sai do style.width já aplicado, não de uma nova medição: medir de
    // novo depois de congelar devolvia um número diferente do que estava
    // escrito no elemento, e a coluna andava mais que o dedo/mouse.
    const mover=cx=>{ th.style.width=Math.max(50, w0+(cx-x0))+'px'; _rzLargura(tbl, ths); };
    const soltar=()=>{
      h.classList.remove('rz-on');
      document.removeEventListener('mousemove',mm); document.removeEventListener('mouseup',soltar);
      document.removeEventListener('touchmove',tm); document.removeEventListener('touchend',soltar);
      salvar();
    };
    const mm=e=>mover(e.clientX);
    const tm=e=>{ if(e.touches[0]) mover(e.touches[0].clientX); };
    const pegar=cx=>{
      congelar();
      x0=cx; w0=parseFloat(th.style.width)||th.getBoundingClientRect().width;
      h.classList.add('rz-on');
    };
    h.addEventListener('mousedown', e=>{ e.preventDefault(); e.stopPropagation(); pegar(e.clientX);
      document.addEventListener('mousemove',mm); document.addEventListener('mouseup',soltar); });
    h.addEventListener('touchstart', e=>{ if(!e.touches[0]) return; e.stopPropagation(); pegar(e.touches[0].clientX);
      document.addEventListener('touchmove',tm,{passive:true}); document.addEventListener('touchend',soltar); }, {passive:true});
  });
}
// Link de restaurar, só quando a pessoa já mexeu em alguma largura.
function _rzBotaoReset(tid){
  return _rzLer(tid) ? `<div style="text-align:right"><button type="button" class="col-rz-reset" onclick="_rzResetar('${tid}')">↺ Restaurar larguras</button></div>` : '';
}

function renderOSTabela(){
  populaFiltTecOS();
  let lista=todosOS;
  lista=filtrarPorLoja(lista);
  if(filtroOSSt!=='todos') lista=lista.filter(o=>o.status===filtroOSSt);
  if(filtroOSTec) lista=lista.filter(o=>(o.tecnico||'')===filtroOSTec);
  if(buscaOS) lista=lista.filter(o=>
    (o.cliente||'').toLowerCase().includes(buscaOS)||
    String(o.numero||'').includes(buscaOS.replace('#',''))
  );
  if(!lista.length){
    // Limpa ANTES do return: sem isto a barra continuava dizendo "N
    // selecionadas" sobre uma lista vazia, prometendo uma ação sobre OS que
    // a pessoa não está mais vendo.
    osSelecionadas.clear(); _osRenderBarraLote();
    document.getElementById('osh-body').innerHTML=`<div class="empty-st"><div class="ei">📋</div><p>Nenhuma OS encontrada.</p><button class="btn-primary" style="margin-top:12px" onclick="novaOS();go('os')">＋ Nova OS</button></div>`; return;
  }
  // Ordena: pendentes/atrasadas por data crescente primeiro; concluídas/canceladas no final
  const _hoje=_hojeLocal();
  lista=lista.slice().sort((a,b)=>{
    const ac=a.status==='concluido'||a.status==='cancelado';
    const bc=b.status==='concluido'||b.status==='cancelado';
    if(ac&&!bc) return 1; if(!ac&&bc) return -1;
    const da=a.data_servico||'9999'; const db2=b.data_servico||'9999';
    return da<db2?-1:da>db2?1:0;
  });
  // Só faz sentido selecionar em lote quem pode agir em lote.
  const podeLote = !eVendas() && !eTecnico();
  let h=`<div class="htw"><table class="ht"><thead><tr>${podeLote?'<th style="width:28px"><input type="checkbox" id="os-check-todos" onchange="_osToggleTodos()" title="Selecionar todos" style="cursor:pointer"></th>':''}<th>#</th><th>Cliente</th><th>Local</th><th>Data</th><th>Técnico</th><th>Status</th><th>Ações</th></tr></thead><tbody>`;
  lista.forEach(o=>{
    _nc[o.id]=o;
    const num=String(o.numero||'—').padStart(3,'0');
    const dt=o.data_servico?new Date(o.data_servico+'T12:00:00').toLocaleDateString('pt-BR'):(o.data_criacao?new Date(o.data_criacao).toLocaleDateString('pt-BR'):'—');
    const atrasado=o.status==='agendado'&&o.data_servico&&o.data_servico<_hoje;
    const stCl=o.status==='concluido'?'os-concluido':o.status==='cancelado'?'os-cancelado':atrasado?'os-atrasado':'os-agendado';
    const stTx=o.status==='concluido'?'✅ Concluído':o.status==='cancelado'?'Cancelado':atrasado?'⚠️ Atrasado':'📅 Agendado';
    // stopPropagation: a linha inteira não é clicável aqui, mas o clique no
    // checkbox não pode disparar nenhum handler de célula vizinha.
    h+=`<tr>
      ${podeLote?`<td><input type="checkbox" data-os-check="${o.id}"${osSelecionadas.has(o.id)?' checked':''} onclick="event.stopPropagation()" onchange="_osToggleSelecao('${o.id}')" style="cursor:pointer"></td>`:''}
      <td><span class="on">#${num}</span></td>
      <td><div class="ocl">${esc(o.cliente||'—')}</div>
        <div style="margin-top:3px">${getLojaBadge(o.loja_id)}</div></td>
      <td><div class="oloc">${esc(o.local_servico||'')}</div></td>
      <td><span class="odt">${dt}</span></td>
      <td><span style="font-size:12px">${esc(o.tecnico||'—')}</span></td>
      <td><span class="os-badge ${stCl}">${stTx}</span></td>
      <td><div class="ta">
        <button class="tb" onclick="editarOS('${o.id}')">✎ Editar</button>
        <button class="tb" title="Gerar PDF desta OS" onclick="_gerarPDFdaOS('${o.id}')">📄 PDF</button>
        ${o.status!=='concluido'&&o.status!=='cancelado'?`<button class="tb" title="Marcar como concluída (baixa de estoque automática)" onclick="concluirOSHistorico('${o.id}')" style="background:#16a34a;color:white;border-color:#16a34a;font-weight:700">✅ Concluir</button>`:''}
        ${o.status==='concluido'?`<button class="tb" title="Notif. OS concluída" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifConcluida(getNC('${o.id}')), '${o.tel_cliente||''}')">✅💬</button>`:''}
        ${o.status==='concluido'?(o.relatorio_enviado_em
          ?`<button class="tb" title="Relatório já enviado — ver de novo" onclick="gerarRelatorioOS('${o.id}','cliente')">📄 Relatório</button>`
          :`<button class="tb" title="Revisar e enviar relatório de serviço" onclick="enviarRelatorioOS('${o.id}')" style="background:#7c3aed;color:white;border-color:#7c3aed;font-weight:700">📄 Enviar relatório</button>`):''}
        ${o.status==='concluido'&&!eVendas()?`<button class="tb" title="Versão interna — custo, valor vendido, margem" onclick="gerarRelatorioOS('${o.id}','interna')">📄 Interno</button>`:''}
        ${o.status==='agendado'||atrasado?`<button class="tb" title="Lembrete de visita" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifVisita(getNC('${o.id}')), '${o.tel_cliente||''}')">📅💬</button>`:''}
        <button class="tb d" onclick="excluirOS('${o.id}')">🗑</button>
      </div></td>
    </tr>`;
  });
  h+='</tbody></table></div>'+_rzBotaoReset('os');
  if(_osTemMais) h+=`<div style="text-align:center;padding:14px 0"><button id="os-carregar-mais" class="fb" onclick="_carregarMaisOS()">Carregar mais antigas…</button></div>`;
  document.getElementById('osh-body').innerHTML=h;
  _rzInit(document.querySelector('#osh-body table.ht'), 'os');
  // A seleção some sozinha se a OS saiu da lista (filtro/busca mudou) — manter
  // um id selecionado que não está mais visível faria a barra prometer uma
  // ação sobre algo que a pessoa não vê.
  if(podeLote){
    const visiveis=new Set(lista.map(o=>o.id));
    [...osSelecionadas].forEach(id=>{ if(!visiveis.has(id)) osSelecionadas.delete(id); });
    _osRenderBarraLote();
  } else { osSelecionadas.clear(); _osRenderBarraLote(); }
  _iniciarScrollHint(document.querySelector('#osh-body .htw'));
}

// Tipo da OS: vistoria mensal (agendamento), do orçamento, ou serviço avulso
function _osTipo(o){ return o?.agendamento_id?'vistoria':o?.orcamento_id?'orcamento':'servico'; }
function _acharOS(id){
  return todosOS.find(x=>x.id===id)
    || (window._minhasOSAll||[]).find(x=>x.id===id)
    || (()=>{ try{ return (JSON.parse(ls('fluxa_os_hist')||'[]')||[]).find(x=>x.id===id); }catch(e){ return null; } })()
    || (getNC(id)?.id?getNC(id):null);
}
function editarOS(id){
  const o=_acharOS(id); if(!o||!o.id){ toast('OS não encontrada'); return; }
  _abrirOSForm(o);
}
const OS_STATUS_BADGE_CLS={agendado:'rd-badge-neutral',em_andamento:'rd-badge-info',concluido:'rd-badge-ok',cancelado:'rd-badge-bad'};
const OS_STATUS_BADGE_LBL={agendado:'Agendada',em_andamento:'Em campo',concluido:'Concluída',cancelado:'Cancelada'};
// Tarefa 3i.6 (19/08) — topbar/trilha/cartão de estado da própria OS, mesmo
// padrão do orçamento (3i.4/3i.5). Trilha de 5 nós do DIAGNOSTICO-OS.md:
// Orçamento aprovado → Agendada → Em campo → Concluída → Relatório
// enviado (sempre tracejado, 3i.8 não existe ainda).
function _osMontarTopoEstado(o){
  const topoEl=document.getElementById('os-topo-estado');
  const tituloEl=document.getElementById('os-topo-titulo');
  const subEl=document.getElementById('os-topo-sub');
  const badgeEl=document.getElementById('os-topo-badge');
  const trilhaWrap=document.getElementById('os-trilha-wrap');
  const cardWrap=document.getElementById('os-cartao-estado');
  if(!topoEl||!trilhaWrap||!cardWrap) return;
  const numStr='#'+String(o.numero||'').padStart(3,'0');
  if(tituloEl) tituloEl.textContent='OS '+numStr+' · '+(o.cliente||'—');
  const orc=osOrcId?todosOrc.find(x=>x.id===osOrcId):null;
  if(subEl) subEl.textContent=o.data_servico?_dataBR(o.data_servico)+(o.hora?' às '+o.hora:''):'sem data definida';
  if(badgeEl){
    const st=o.status||'agendado';
    badgeEl.innerHTML=`<span class="rd-badge ${OS_STATUS_BADGE_CLS[st]||'rd-badge-neutral'}">${esc(OS_STATUS_BADGE_LBL[st]||st)}</span>`;
  }
  topoEl.style.display='flex';

  if(o.status==='cancelado'){
    trilhaWrap.style.display='none';
    cardWrap.innerHTML=_renderCartaoEstado({eyebrow:'Estado da OS', titulo:'Cancelada'});
    cardWrap.style.display='block';
    return;
  }
  const nos=[
    {label:orc?'Orçamento aprovado':'Criada', data:orc?.data_aprovacao?_dataBR(orc.data_aprovacao):_dataBR(o.data_criacao)},
    {label:'Agendada', data:o.data_servico?_dataBR(o.data_servico):undefined},
    {label:'Em campo', data:o.checkin_time?_dataBR(o.checkin_time):undefined},
    {label:'Concluída', data:o.checkout_time?_dataBR(o.checkout_time):undefined},
    {label:'Relatório enviado', tracejado:true}
  ];
  let atualIdx;
  if(o.status==='concluido') atualIdx=4;
  else atualIdx=2; // agendado ou em_andamento — trilha não distingue os dois, o cartão sim
  trilhaWrap.innerHTML=_renderTrilhaEstados(nos, atualIdx);
  trilhaWrap.style.display='block';

  let cfg;
  if(o.status==='em_andamento'){
    // Trava do plano: quem finaliza é quem está no local. Se quem está
    // vendo AGORA é o próprio técnico que fez check-in neste aparelho, o
    // check-out já está logo abaixo no card de Check-in/Check-out — o
    // cartão só reforça o estado. Senão (gestor, ou outro dispositivo),
    // a ação é "contatar", nunca "Concluir" por ele — foi exatamente
    // fechar pelo desktop que produzia OS concluída e vazia.
    const souEuNoLocal = eTecnico() && osCheckinId===o.id;
    cfg={eyebrow:'Estado da OS', timer:o.checkin_time?'em campo':undefined,
      titulo:(o.tecnico||'Técnico')+' está em campo',
      tituloSub:souEuNoLocal?'faça o check-out quando terminar':'acompanhe — quem finaliza é quem está no local',
      acao:souEuNoLocal?null:{label:o.tecnico?'Contatar '+o.tecnico:'Contatar o técnico'},
      nota:souEuNoLocal?null:'Fechar pelo desktop é o que produzia OS concluída e vazia — evite concluir por quem está em campo.'};
  }else if(o.status==='concluido'){
    cfg={eyebrow:'Estado da OS', titulo:'Executada',
      tituloSub:o.duracao_min?`${o.duracao_min} min · aguardando relatório`:'aguardando relatório'};
  }else{
    cfg={eyebrow:'Estado da OS', titulo:'Agendada',
      tituloSub:o.data_servico?'para '+_dataBR(o.data_servico)+(o.hora?' às '+o.hora:''):'sem data definida'};
  }
  cardWrap.innerHTML=_renderCartaoEstado(cfg);
  cardWrap.style.display='block';
}
// Registro de campo em modo leitura pro gestor (Tarefa 3i.6) — o gestor
// não digita a execução de outro. Mesmos campos de sempre, só ganham
// readonly quando quem abriu não é técnico (_tecMode já existe e trava os
// campos administrativos no sentido contrário — este é o complemento).
function _osAplicarModoLeitura(_tecMode){
  ['os-mat','os-obs'].forEach(fid=>{
    const el=document.getElementById(fid);
    if(!el) return;
    if(!_tecMode){ el.setAttribute('readonly',''); el.style.background='var(--gray-light)'; }
    else{ el.removeAttribute('readonly'); el.style.background=''; }
  });
}

function _abrirOSForm(o){
  osEditId=o.id;
  osOrcId=o.orcamento_id||null;
  setV('os-cli',o.cliente||''); setV('os-cli-id',o.cliente_id||''); setV('os-loc',o.local_servico||'');
  _osPopularEquipamentos(o.equipamento_id||'');
  setV('os-data',o.data_servico||''); setV('os-hora',o.hora||'08:00');
  // Técnico: auto-preencher com o usuário logado se o campo estiver vazio
  const nomeSessao=getSessao()?.nome||'';
  setV('os-tec',o.tecnico||nomeSessao); setV('os-total',String(o.total||0));
  setV('os-mat',o.materiais||''); setV('os-obs',o.obs_tecnica||'');
  setV('os-video-link',o.video_link||'');
  setV('os-loja',o.loja_id||lojaAtiva||LOJA_PADRAO_ID);
  // Check-in: pré-selecionar o técnico logado
  populaTecCheckIn();
  const checkinSel=document.getElementById('os-tec-checkin');
  if(checkinSel && nomeSessao){
    checkinSel.value=nomeSessao;
    if(!checkinSel.value){ // nome não está nas opções → adicionar
      const opt=document.createElement('option'); opt.value=nomeSessao; opt.textContent=nomeSessao; checkinSel.add(opt); checkinSel.value=nomeSessao;
    }
  }
  osSvcs=(o.servicos||[]).map(s=>({id:Date.now()+Math.random(),d:typeof s==='string'?s:s.desc||''}));
  if(!osSvcs.length) osSvcs=[{id:Date.now(),d:''}];
  const _fot=_osFotosNormalizar(o.fotos);
  osFotosAntes=_fot.antes.slice(0,6); osFotosDepois=_fot.depois.slice(0,6);
  renderOSFotosSlots();
  // Materiais estruturados: limpa na hora e busca do banco em background
  // (a guarda de osEditId dentro de _osLoadMateriais evita popular a OS
  // errada se a pessoa trocar de OS enquanto a promise resolve).
  osMateriais=[]; _osMatRenderLista();
  _osLoadMateriais(o.id);
  // Checklist: carrega da OS salva ou usa o padrão
  try{
    osChecklist=o.checklist?(typeof o.checklist==='string'?JSON.parse(o.checklist):o.checklist):OS_CHECKLIST_DEFAULT.map(x=>({...x}));
    if(!Array.isArray(osChecklist)||!osChecklist.length) osChecklist=OS_CHECKLIST_DEFAULT.map(x=>({...x}));
  }catch(e){ osChecklist=OS_CHECKLIST_DEFAULT.map(x=>({...x})); }
  renderOSSvcs();
  renderOsChecklist();
  document.getElementById('os-src-badge').textContent=osOrcId?'· vinculada a ORC':'';
  document.getElementById('btn-os-both').style.display=osOrcId?'flex':'none';
  document.getElementById('btn-os-pdf').style.gridColumn=osOrcId?'':'1/-1';
  const numStr='#'+String(o.numero||o.id||'').toString().padStart(3,'0');
  const tituloEl=document.getElementById('os-form-titulo');
  if(tituloEl) tituloEl.textContent='Editar OS '+numStr;
  go('os');
  // Após go() — aplicar modo técnico (campos do gestor read-only)
  const _tecMode = eTecnico();
  ['os-cli','os-loc','os-data','os-hora','os-cnpj','os-cpf'].forEach(fid=>{
    const el=document.getElementById(fid);
    if(!el) return;
    if(_tecMode){ el.setAttribute('readonly',''); el.style.background='var(--gray-light)'; el.style.color='var(--gray)'; }
    else{ el.removeAttribute('readonly'); el.style.background=''; el.style.color=''; }
  });
  // Empresa (select): desabilitar para técnico
  const lojaEl=document.getElementById('os-loja');
  if(lojaEl){ if(_tecMode) lojaEl.setAttribute('disabled',''); else lojaEl.removeAttribute('disabled'); }
  const btnAddSvc=document.querySelector('#page-os .btn-add');
  if(btnAddSvc) btnAddSvc.style.display=_tecMode?'none':'';
  _osAplicarModoLeitura(_tecMode);
  _osMontarTopoEstado(o);
  // Valor Total travado quando vem de orçamento aprovado (Tarefa 3i.6) — o
  // valor já foi fechado na aprovação; deixar editável aqui é o que
  // permitia o número divergir do orçamento (relatório errado, cobrança
  // errada). Sem orçamento vinculado (serviço avulso) continua editável.
  { const totEl=document.getElementById('os-total'); const lockEl=document.getElementById('os-total-lock');
    if(totEl){
      if(osOrcId){ totEl.setAttribute('readonly',''); totEl.style.background='var(--gray-light)'; if(lockEl) lockEl.style.display='inline'; }
      else{ totEl.removeAttribute('readonly'); totEl.style.background=''; if(lockEl) lockEl.style.display='none'; }
    }
  }
  atualizarPainelItensOS();
}

// ── Painel de itens (produtos do orçamento) para validar/baixar na OS ──
function atualizarPainelItensOS(){
  const card=document.getElementById('os-itens-card'); if(!card) return;
  const orc = osOrcId ? todosOrc.find(o=>o.id===osOrcId) : null;
  const itens = orc ? (orc.servicos||[]).filter(s=>s.produto_id) : [];
  if(!orc || !itens.length){ card.style.display='none'; return; }
  card.style.display='';
  const lista=document.getElementById('os-itens-lista');
  const btn=document.getElementById('os-itens-btn');
  const okMsg=document.getElementById('os-itens-ok');
  const tudoTratado = itens.every(s=>_entregueProdutoOrc(orc.id,s.produto_id,parseInt(s.qty)||1));
  const podeBaixar = orc.status==='aprovado' && !tudoTratado;
  lista.innerHTML=itens.map(s=>{
    const p=produtoById(s.produto_id);
    const qty=parseInt(s.qty)||1;
    const resolvido=_qtdResolvidaProdutoOrc(orc.id,s.produto_id);
    const pendente=Math.max(0, qty-resolvido);
    const tratado=pendente<=0;
    // "pendente" pode ser menor que o total pedido se o item já teve uma
    // entrega/dispensa parcial antes (ex.: qty aumentada depois de resolvido)
    const rotulo = tratado ? '✅ já confirmado'
      : resolvido>0 ? `pendente: ${fmtQtd(pendente)} de ${fmtQtd(qty)} (${fmtQtd(resolvido)} já confirmado)`
      : `pedido: ${fmtQtd(qty)} ${p?.unidade||''}`;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-light)">
      <input type="checkbox" class="os-item-chk" data-pid="${s.produto_id}" ${tratado?'disabled':'checked'} style="width:18px;height:18px;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(p?p.nome:(s.desc||'produto'))}</div>
        <div style="font-size:11px;color:var(--gray)">${rotulo}</div>
      </div>
      ${tratado?'':`<input type="number" class="os-item-qty" data-pid="${s.produto_id}" value="${pendente}" min="0" max="${pendente}" step="1" title="Qtd levada agora" style="width:64px;padding:6px;border:1.5px solid var(--gray-mid);border-radius:8px;font-size:13px;text-align:center">`}
    </div>`;
  }).join('');
  if(btn) btn.style.display=podeBaixar?'':'none';
  if(okMsg) okMsg.style.display=(tudoTratado)?'block':'none';
  if(btn && orc.status!=='aprovado' && !tudoTratado){
    btn.style.display='none';
    lista.innerHTML+=`<div style="font-size:12px;color:var(--yellow);padding-top:8px">⚠️ Aprove o orçamento para dar baixa dos itens.</div>`;
  }
}
function confirmarItensOS(){
  const orc = osOrcId ? todosOrc.find(o=>o.id===osOrcId) : null;
  if(!orc){ toast('OS sem orçamento vinculado'); return; }
  const qtyMap={};
  document.querySelectorAll('#os-itens-lista .os-item-chk').forEach(chk=>{
    if(chk.disabled) return;
    const pid=chk.dataset.pid;
    if(!chk.checked){ qtyMap[pid]=0; return; }
    const qi=document.querySelector('.os-item-qty[data-pid="'+pid+'"]');
    qtyMap[pid]=qi?parseFloat(qi.value)||0:0;
  });
  entregarOrcamento(orc, 'validar', qtyMap);
  atualizarPainelItensOS();
}

// ── Materiais utilizados na OS — seletor de produto ──────────────────────
// O campo era texto livre e ficava vazio na maioria das OS. O problema não é
// onde o campo está: é que "escrever o que usei" não é um lançamento — alguém
// depois precisaria ler a frase e dar baixa à mão, e ninguém faz isso.
// Escolher da lista dá baixa no estoque NA HORA: o momento "usei isso" JÁ é o
// lançamento. Reversível — remover devolve o estoque com um estorno.
let osMateriais=[];

// Produto que já é item do orçamento vinculado a esta OS já teve (ou vai ter)
// baixa por aquele caminho ("aprovar = sai do estoque"), com um ref diferente
// ('baixa:orc:...'). Adicionar o mesmo produto aqui usa 'os_mat:...' e sairia
// DUAS vezes do estoque. Não bloqueia — pode ser consumo real além do
// previsto — mas avisa antes.
function _osMatProdutoNoOrcamento(pid){
  if(!osOrcId) return false;
  const orc=(todosOrc||[]).find(o=>o.id===osOrcId);
  if(!orc) return false;
  return (orc.servicos||[]).some(s=>s&&s.produto_id===pid);
}
function osMatBuscarProduto(termo){
  const el=document.getElementById('os-mat-sugestoes'); if(!el) return;
  const t=(termo||'').trim().toLowerCase();
  if(t.length<2){ el.innerHTML=''; return; }
  const achados=produtosVisiveis().filter(p=>
    (p.nome||'').toLowerCase().includes(t) || (p.codigo||'').toLowerCase().includes(t)
  ).slice(0,8);
  if(!achados.length){ el.innerHTML='<div style="font-size:12px;color:var(--gray);padding:8px">Nenhum produto encontrado.</div>'; return; }
  el.innerHTML=achados.map(p=>{
    const disp=disponivelProduto(p.id);
    const jaNoOrc=_osMatProdutoNoOrcamento(p.id);
    return `<button type="button" class="tb" style="display:block;width:100%;text-align:left;margin-bottom:5px;padding:9px 11px" onclick="osMatAddItem('${p.id}')">
      <div style="font-weight:700;color:var(--c2);font-size:12.5px">${esc(p.nome)}</div>
      <div style="font-size:11px;color:var(--gray)">${p.codigo?esc(p.codigo)+' · ':''}tem ${fmtQtd(disp)} ${esc(p.unidade||'un')}${jaNoOrc?' · <span style="color:var(--warn)">já é item do orçamento</span>':''}</div>
    </button>`;
  }).join('');
}
function osMatAddItem(pid){
  if(_osMatProdutoNoOrcamento(pid)){
    confirmar({
      titulo:'Produto já contabilizado no orçamento',
      msg:'Este produto já é item do orçamento vinculado a esta OS — o estoque dele já foi (ou vai ser) baixado por esse caminho. Adicionar aqui soma OUTRA baixa, além dessa. Só confirme se for consumo real a mais do que o orçamento previa.',
      labelSim:'Adicionar mesmo assim',
      onSim:()=>_osMatAddItemConfirmado(pid)
    });
    return;
  }
  _osMatAddItemConfirmado(pid);
}
function _osMatAddItemConfirmado(pid){
  const p=produtoById(pid); if(!p) return;
  const loja=gV('os-loja')||lojaAtiva||LOJA_PADRAO_ID;
  const ja=osMateriais.find(i=>i.produto_id===pid);
  if(ja){ ja.qtd=(parseFloat(ja.qtd)||0)+1; }
  else{ osMateriais.push({produto_id:pid, nome:p.nome, unidade:p.unidade||'un', qtd:1, custo_unit:parseFloat(p.custo)||0}); }
  const numOS=(todosOS.find(x=>x.id===osEditId)||{}).numero;
  registrarMovimento({
    produto_id:pid, tipo:'saida', quantidade:-1, custo_unit:parseFloat(p.custo)||0,
    motivo:'Material usado em OS'+(numOS?' #'+numOS:''),
    ref:'os_mat:'+(osEditId||'nova')+':'+pid+':'+Date.now(), lojaId:loja
  });
  setV('os-mat-busca',''); const sug=document.getElementById('os-mat-sugestoes'); if(sug) sug.innerHTML='';
  _osMatRenderLista();
  document.getElementById('os-mat-busca')?.focus();
}
function osMatRemoverItem(idx){
  const it=osMateriais[idx]; if(!it) return;
  const loja=gV('os-loja')||lojaAtiva||LOJA_PADRAO_ID;
  registrarMovimento({
    produto_id:it.produto_id, tipo:'entrada', quantidade:Math.abs(parseFloat(it.qtd)||0), custo_unit:it.custo_unit,
    motivo:'Estorno — item removido da OS', ref:'os_mat_estorno:'+(osEditId||'nova')+':'+it.produto_id+':'+Date.now(), lojaId:loja
  });
  osMateriais.splice(idx,1);
  _osMatRenderLista();
}
function _osMatRenderLista(){
  const el=document.getElementById('os-mat-lista'); if(!el) return;
  if(!osMateriais.length){ el.innerHTML=''; return; }
  el.innerHTML=osMateriais.map((i,idx)=>`
    <div style="display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--gray-light)">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:var(--c2);font-size:12.5px">${esc(i.nome)}</div>
        <div style="font-size:11px;color:var(--gray)">${fmtQtd(i.qtd)} ${esc(i.unidade)} · baixado do estoque</div>
      </div>
      <button type="button" onclick="osMatRemoverItem(${idx})" aria-label="Remover e devolver ao estoque" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:16px;font-weight:700;padding:0 4px">×</button>
    </div>`).join('');
}
// ordens_servico.materiais continua sendo UMA STRING — PDF e histórico não
// mudam de formato. Aqui só junta o estruturado (já baixado) com o texto livre.
function _osMatTextoFinal(){
  const partes=[];
  if(osMateriais.length) partes.push(osMateriais.map(i=>`${fmtQtd(i.qtd)}x ${i.nome}`).join(', '));
  const livre=(gV('os-mat')||'').trim();
  if(livre) partes.push(livre);
  return partes.join(' · ');
}
// Isola a parte de TEXTO LIVRE dentro da string acima, pro relatório mostrar
// a nota separada da tabela estruturada. Reconstrói o prefixo do MESMO jeito
// que _osMatTextoFinal monta; registro sem estruturado nenhum → a string
// inteira É texto livre. Se há estruturado mas o prefixo não bate (edição
// manual antiga), não mostra nada — melhor omitir que duplicar.
function _osMatObsLivre(os){
  const raw=(os.materiais||'').trim();
  if(!raw) return '';
  const estruturados=(os._materiaisRelatorio||[]).map(m=>`${fmtQtd(m.qtd)}x ${m.nome}`).join(', ');
  if(!estruturados) return raw;
  if(raw.startsWith(estruturados)) return raw.slice(estruturados.length).replace(/^\s*·\s*/,'').trim();
  return '';
}
// A baixa de estoque já aconteceu na hora (registrarMovimento). Isto só guarda
// A LISTA, pra reabrir a OS (ou montar o relatório) mostrar os chips de volta
// em vez do texto corrido. Delete-then-insert: listas pequenas, mais simples e
// seguro que reconciliar delta.
// Só com id real: uma OS local ganha id NOVO ao sincronizar, e gravar
// materiais antes disso os deixaria órfãos, presos ao id que deixa de existir.
async function _osSyncMateriais(osId){
  if(!(dbOk&&db&&osId&&!String(osId).startsWith('local_'))) return;
  try{
    await db.from('os_materiais').delete().eq('os_id',osId);
    if(osMateriais.length){
      const rows=osMateriais.map((m,i)=>({
        id:'osm_'+osId+'_'+i+'_'+Date.now(), os_id:osId, produto_id:m.produto_id,
        descricao:m.nome||'', qtd:parseFloat(m.qtd)||0, custo_unit:parseFloat(m.custo_unit)||0
      }));
      for(const r of rows) await dbInsert('os_materiais', r);
    }
  }catch(e){ console.warn('[_osSyncMateriais]', e?.message||e); }
}
async function _osLoadMateriais(osId){
  if(!(dbOk&&db&&osId&&!String(osId).startsWith('local_'))) return;
  try{
    const {data}=await db.from('os_materiais').select('*').eq('os_id',osId).eq('empresa_id',EMPRESA_ID);
    if(data&&data.length && osEditId===osId){ // ainda é a mesma OS aberta
      osMateriais=data.map(r=>{
        const p=produtoById(r.produto_id);
        return {produto_id:r.produto_id, nome:p?.nome||r.descricao||'Produto', unidade:p?.unidade||'un',
                qtd:parseFloat(r.qtd)||0, custo_unit:parseFloat(r.custo_unit)||0};
      });
      _osMatRenderLista();
    }
  }catch(e){ console.warn('[_osLoadMateriais]', e?.message||e); }
}
// Materiais já gravados desta OS, pro relatório (a lista em tela é osMateriais).
async function _osMateriaisParaRelatorio(osId){
  if(!(dbOk&&db&&osId&&!String(osId).startsWith('local_'))) return [];
  try{
    const {data}=await db.from('os_materiais').select('*').eq('os_id',osId).eq('empresa_id',EMPRESA_ID);
    return (data||[]).map(r=>{
      const p=produtoById(r.produto_id);
      return {nome:p?.nome||r.descricao||'Produto', unidade:p?.unidade||'un',
              qtd:parseFloat(r.qtd)||0, custo_unit:parseFloat(r.custo_unit)||0};
    });
  }catch(e){ console.warn('[_osMateriaisParaRelatorio]', e?.message||e); return []; }
}

function excluirOS(id){
  confirmar('Excluir esta OS?', ()=>_excluirOSConfirmado(id), 'Excluir OS');
}
async function _excluirOSConfirmado(id){
  todosOS=todosOS.filter(x=>x.id!==id);
  if(dbOk&&db) db.from('ordens_servico').delete().eq('id',id).then(()=>{}).catch(()=>{});
  renderOSTabela(); toast('🗑 OS excluída');
}

// ──────────────────────────────────────────────────
//  MINHAS OS — vista consolidada do técnico
// ──────────────────────────────────────────────────
let tecOSFiltro = 'pendente';
// Ponto ÚNICO de "para onde este perfil vai". Antes a regra estava espalhada
// pelos pontos de login; quem quiser mudar o destino, mude AQUI.
function _telaInicialPerfil(sess){
  const p=(sess||getSessao())?.perfil;
  if(p==='tecnico') return 'minhas-os';
  if(p==='vendas')  return 'form';
  if(p==='gestor'||p==='master') return 'painel';
  return 'form';
}
async function loadMinhasOS(){
  const sess = getSessao();
  // 'home' não existe como página — go('home') lançava TypeError em
  // getElementById(...).classList e interrompia a função no meio, deixando
  // TODAS as páginas sem a classe .on: tela em branco, sem nenhum aviso.
  // Não é alcançado pelo fluxo normal (nenhum botão leva gestor/vendas a
  // "Minhas OS"), mas é caminho morto perigoso — link direto, teste ou uma
  // mudança futura de sidebar quebrariam a navegação em silêncio.
  if(!sess || sess.perfil !== 'tecnico'){ go(_telaInicialPerfil(sess)); return; }
  let lista = [];
  if(dbOk && db){
    try{
      // Carrega TODAS e filtra no cliente (casar por nome exato no banco era frágil)
      let q = db.from('ordens_servico').select('*').eq('empresa_id',EMPRESA_ID).order('data_servico', {ascending:true});
      if(lojaAtiva) q=q.eq('loja_id', lojaAtiva);
      const {data} = await q;
      if(data) lista = data;
    }catch(e){ console.warn('[loadMinhasOS]', e?.message||e); }
  }
  if(!lista.length) lista = todosOS;
  const meu = (sess.nome||'').toLowerCase().trim();
  // nomes de técnicos REAIS (config das lojas) — p/ tratar nomes fantasmas como "sem técnico"
  const nomesReais = new Set(LOJAS.flatMap(l=>l.tecs||[]).map(t=>(t||'').toLowerCase().trim()));
  // Deduplicar por id (evita duplicatas de merge local+remoto)
  const vistos = new Set();
  // Deduplicar por orcamento_id+data_servico (OS gerada duas vezes do mesmo orc na mesma data)
  const orcDatas = new Set();
  lista = lista.filter(o=>{
    if(vistos.has(o.id)) return false;
    vistos.add(o.id);
    const t = (o.tecnico||'').toLowerCase().trim();
    // Excluir vistorias mensais (agendamento_id) — aparecem só em "Vistorias"
    if(o.agendamento_id) return false;
    if(!(t===meu || t==='' || !nomesReais.has(t))) return false;
    // Remover duplicata de mesmo orçamento na mesma data (mantém o de menor número)
    if(o.orcamento_id){
      const chave = o.orcamento_id + '|' + (o.data_servico||'');
      if(orcDatas.has(chave)) return false;
      orcDatas.add(chave);
    }
    return true;
  });
  window._minhasOSAll = lista;
  renderMinhasOS();
}
function renderMinhasOS(){
  let lista = (window._minhasOSAll || []).filter(o => {
    if(tecOSFiltro === 'pendente') return o.status !== 'concluido' && o.status !== 'cancelado';
    if(tecOSFiltro === 'concluido') return o.status === 'concluido';
    return true;
  });
  const el = document.getElementById('tec-os-lista');
  if(!el) return;
  if(!lista.length){
    el.innerHTML = `<div class="empty-st"><div class="ei">📋</div><p>Nenhuma OS encontrada.</p></div>`;
    return;
  }
  const _hj=_hojeLocal();
  // Ordena: pendentes por data crescente; concluídas/canceladas no final
  lista=lista.slice().sort((a,b)=>{
    const ac=a.status==='concluido'||a.status==='cancelado';
    const bc=b.status==='concluido'||b.status==='cancelado';
    if(ac&&!bc) return 1; if(!ac&&bc) return -1;
    const da=a.data_servico||'9999'; const db2=b.data_servico||'9999';
    return da<db2?-1:da>db2?1:0;
  });
  el.innerHTML = lista.map(o => {
    const num = String(o.numero||'?').padStart(3,'0');
    const dt = o.data_servico ? new Date(o.data_servico+'T12:00:00').toLocaleDateString('pt-BR') : '—';
    const atrasado=o.status==='agendado'&&o.data_servico&&o.data_servico<_hj;
    const stCl = o.status==='concluido'?'os-concluido':o.status==='cancelado'?'os-cancelado':atrasado?'os-atrasado':'os-agendado';
    const stTx = o.status==='concluido'?'✅ Concluído':o.status==='cancelado'?'Cancelado':atrasado?'⚠️ Atrasado':'📅 Agendado';
    const svcs = (o.servicos||[]).map(s=>typeof s==='string'?s:(s.desc||s.d||'')).filter(Boolean).join(', ');
    const tipo=_osTipo(o);
    const tipoBadge = tipo==='vistoria'
      ? '<span style="font-size:10px;font-weight:700;background:#f3e8ff;color:#7c3aed;padding:2px 8px;border-radius:50px">🔍 Vistoria</span>'
      : tipo==='orcamento'
      ? '<span style="font-size:10px;font-weight:700;background:var(--c1-light);color:var(--c1);padding:2px 8px;border-radius:50px">📄 Orçamento</span>'
      : '<span style="font-size:10px;font-weight:700;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:50px">🔧 Serviço</span>';
    const telCli=(o.tel_cliente||'').replace(/\D/g,'');
    const btnWA=o.status==='concluido'&&telCli
      ?`<button class="tb" style="background:var(--wa);color:white;border-color:var(--wa);font-size:11px;padding:5px 8px" title="Enviar relatório ao cliente via WhatsApp" onclick="event.stopPropagation();_enviarRelatorioOSWhats('${o.id}','${telCli}')">💬 WA</button>`:'';
    const btnPDF=`<button class="tb" style="font-size:11px;padding:5px 8px" title="Gerar PDF desta OS" onclick="event.stopPropagation();_gerarPDFdaOS('${o.id}')">📄 PDF</button>`;
    const naoConcluida=o.status!=='concluido'&&o.status!=='cancelado';
    // Botão grande de conclusão em 1 toque — para uso em campo, sem abrir o formulário longo
    const btnConcluir=naoConcluida
      ?`<button class="tb" style="background:#16a34a;color:white;border-color:#16a34a;font-weight:700;font-size:13px;padding:8px 14px" title="Concluir esta OS (baixa de estoque automática)" onclick="event.stopPropagation();concluirOSHistorico('${o.id}')">✅ Concluir</button>`:'';
    return `<div class="tec-os-card" onclick="editarOS('${o.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:8px">
        <span class="on">#${num}</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">${tipoBadge}<span class="os-badge ${stCl}">${stTx}</span></div>
      </div>
      <div class="tec-os-cli">${esc(o.cliente||'—')}</div>
      <div class="tec-os-det">${esc(o.local_servico||'')}${o.local_servico&&dt!=='—'?' · ':''}${dt!=='—'?`<strong>${dt}</strong>`:''}</div>
      ${svcs?`<div class="tec-os-det" style="margin-top:2px;color:var(--gray)">${esc(svcs)}</div>`:''}
      <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div>${getLojaBadge(o.loja_id)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${btnWA}${btnPDF}${btnConcluir}</div>
      </div>
    </div>`;
  }).join('');
}
function filtTecOS(btn){
  document.querySelectorAll('[data-tec-st]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  tecOSFiltro = btn.dataset.tecSt;
  renderMinhasOS();
}

// Abre a OS no formulário e dispara geração de PDF
async function _gerarPDFdaOS(id){
  const o=_acharOS(id); if(!o){ toast('OS não encontrada'); return; }
  _abrirOSForm(o); go('os');
  await new Promise(r=>setTimeout(r,350));
  gerarOSPDF('os');
}

// Envia mensagem de relatório da OS finalizada para o cliente via WhatsApp
function _enviarRelatorioOSWhats(id, tel){
  const o=_acharOS(id)||{}; const msg=notifConcluida(o);
  enviarNotifWA(msg, tel||o.tel_cliente||'');
}

// ──────────────────────────────────────────────────
//  OS FOTOS
// ──────────────────────────────────────────────────
// ordens_servico.fotos guarda {antes:[],depois:[]} desde a separação dos dois
// grids. Registro anterior a isso é um array simples e vale como 100%
// "depois" — é o que essas fotos sempre representaram (resultado do serviço).
// Ponto ÚNICO de leitura: nada lê o.fotos direto, senão um registro antigo
// quebra ao voltar como array.
function _osFotosNormalizar(fotosRaw){
  if(Array.isArray(fotosRaw)) return {antes:[], depois:fotosRaw.filter(Boolean)};
  if(fotosRaw && typeof fotosRaw==='object') return {antes:(fotosRaw.antes||[]).filter(Boolean), depois:(fotosRaw.depois||[]).filter(Boolean)};
  return {antes:[], depois:[]};
}
function _osFotosArr(tipo){ return tipo==='antes' ? osFotosAntes : osFotosDepois; }
function renderOSFotosSlots(tipo){
  if(!tipo){ renderOSFotosSlots('antes'); renderOSFotosSlots('depois'); return; }
  const grid=document.getElementById('os-fotos-'+tipo+'-grid'); if(!grid) return;
  const arr=_osFotosArr(tipo);
  grid.innerHTML='';
  for(let i=0;i<6;i++){
    const slot=document.createElement('div');
    slot.className='fotos-orc-slot'+(arr[i]?' filled':'');
    slot.innerHTML=`
      <input type="file" id="os-finp-${tipo}-${i}" accept="image/*" style="display:none" onchange="carregarFotoOS(this,${i},'${tipo}')">
      ${arr[i]?`<img src="${arr[i]}" alt="foto ${i+1}">`:''}
      <div class="fotos-orc-slot-icon">📷</div>
      <div class="fotos-orc-slot-lbl">Foto ${i+1}</div>
      <button class="fotos-orc-rm" onclick="event.stopPropagation();removerFotoOS(${i},'${tipo}')" title="Remover">✕</button>`;
    slot.addEventListener('click',()=>document.getElementById(`os-finp-${tipo}-${i}`).click());
    grid.appendChild(slot);
  }
}
function carregarFotoOS(inp, idx, tipo){
  const f=inp.files[0]; if(!f) return;
  if(f.size > FOTO_MAX_BYTES){ toast('⚠️ Foto muito grande (máx 20 MB).'); inp.value=''; return; }
  const r=new FileReader();
  r.onload=async e=>{ _osFotosArr(tipo)[idx]=await compressImage(e.target.result); renderOSFotosSlots(tipo); };
  r.readAsDataURL(f);
}
function removerFotoOS(idx, tipo){
  const arr=_osFotosArr(tipo);
  arr[idx]=null;
  while(arr.length && !arr[arr.length-1]) arr.pop();
  renderOSFotosSlots(tipo);
}

// ──────────────────────────────────────────────────
//  CLIENTES
// ──────────────────────────────────────────────────
const LS_CLI_FULL='fluxa_clientes_full';
function lsCliLer(){ try{ return JSON.parse(ls(LS_CLI_FULL)||'[]'); }catch(e){ return []; } }
function lsCliSalvar(l){ lsSet(LS_CLI_FULL,JSON.stringify(l)); }


function renderClientes(){
  // v2: filtro genérico por unidade/grupo ativo (sem nome de empresa chumbado)
  const todos=filtrarPorLoja(lsCliLer());
  let lista=todos;
  const el=document.getElementById('clientes-lista');
  const busca=(document.getElementById('cli-busca')?.value||'').toLowerCase().trim();
  if(busca){
    const q=busca.replace(/\D/g,'');
    lista=lista.filter(c=>(c.nome||'').toLowerCase().includes(busca)
      || (q && (c.tel||'').replace(/\D/g,'').includes(q))
      || (q && (c.cnpj||'').replace(/\D/g,'').includes(q))
      || (c.end||'').toLowerCase().includes(busca));
  }
  // Faturamento por cliente (todos os orçamentos aprovados, todas as lojas)
  const fatPorNome={};
  filtrarPorLoja(todosOrc).filter(o=>o.status==='aprovado').forEach(o=>{ const n=(o.cliente||'').toLowerCase(); fatPorNome[n]=(fatPorNome[n]||0)+(o.total||0); });
  lista.sort((a,b)=>(fatPorNome[(b.nome||'').toLowerCase()]||0)-(fatPorNome[(a.nome||'').toLowerCase()]||0) || (a.nome||'').localeCompare(b.nome||''));
  // Dashboard (16/08, redesign task #37) — sempre sobre a base TOTAL, não o
  // resultado filtrado pela busca (KPI de conjunto, não de resultado de tela).
  // Sem coluna data_criacao no cadastro de cliente — deriva do timestamp
  // embutido no id local ('cli_'+Date.now()); clientes vindos de dedup no
  // servidor (id não é 'cli_...') não contam, o que é aceitável (subconta,
  // não erra pra mais).
  const _ts30=Date.now()-30*86400000;
  const novos30=todos.filter(c=>{
    if(!(c.id||'').startsWith('cli_')) return false;
    const t=parseInt((c.id||'').slice(4),10);
    return !isNaN(t) && t>=_ts30;
  }).length;
  const fatTotal=Object.values(fatPorNome).reduce((a,v)=>a+v,0);
  let topNome='—', topFat=0;
  todos.forEach(c=>{ const f=fatPorNome[(c.nome||'').toLowerCase()]||0; if(f>topFat){ topFat=f; topNome=c.nome; } });
  setV_el('cli-d-total', String(todos.length), 'textContent');
  setV_el('cli-d-novos', novos30>0?`+${novos30} nos últimos 30 dias`:'nenhum novo em 30 dias', 'textContent');
  setV_el('cli-d-fat', brl(fatTotal), 'textContent');
  setV_el('cli-d-top-fat', topFat>0?brl(topFat):'—', 'textContent');
  setV_el('cli-d-top-nome', topFat>0?topNome:'nenhum cliente com orçamento aprovado', 'textContent');
  if(!lista.length){ el.innerHTML=`<div class="empty-st"><div class="ei">👥</div><p>${busca?'Nenhum cliente encontrado.':'Nenhum cliente cadastrado.'}</p>${busca?'':'<button class="btn-primary" style="margin-top:12px" onclick="mostrarFormCliente()">＋ Cadastrar Cliente</button>'}</div>`; return; }
  el.innerHTML=lista.map(c=>{
    const fat=fatPorNome[(c.nome||'').toLowerCase()]||0;
    const lojas=(c.lojas||[c.loja_id]).filter(Boolean);
    const lojasBadges=lojas.map(lid=>getLojaBadge(lid)).filter(Boolean).join('');
    return `
    <div class="cli-card">
      <div class="cli-card-info">
        <div class="cli-card-nome">${esc(c.nome)}${fat>0?` <span style="font-size:10px;background:var(--green-bg);color:var(--green);padding:1px 7px;border-radius:50px;font-weight:700">${brl(fat)}</span>`:''}</div>
        <div class="cli-card-det">${[c.tel||c.telefone,c.cnpj||c.cpf,c.end||c.endereco].filter(Boolean).map(x=>esc(x)).join(' · ')||'—'}${c.email_responsavel?' · ✉️ '+esc(c.email_responsavel):''}</div>
        ${lojasBadges?`<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${lojasBadges}</div>`:''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap">
        <button class="tb" onclick="verHistoricoCliente('${c.id}')">📋 Hist.</button>
        <button class="tb" onclick="editarCliente('${c.id}')">✏️ Editar</button>
        <button class="tb" onclick="novoOrcParaCliente('${c.id}')">＋ Orç.</button>
        <button class="tb" onclick="novaOSParaCliente('${c.id}')">🔧 OS</button>
        <button class="tb d" onclick="excluirCliente('${c.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
  renderAvisoDuplicatas();
  renderAvisoIdentidade();
}

function novoOrcParaCliente(id){
  const c=lsCliLer().find(x=>x.id===id); if(!c) return;
  novoOrc();
  // Mantém _skipDraftForm=true até depois de preencher os campos do cliente,
  // evitando que o rascunho antigo sobrescreva os dados ao chamar go('form')
  window._skipDraftForm=true;
  setTimeout(()=>{
    setV('cli', c.nome);
    if(c.end)  setV('loc', c.end);
    if(c.tel)  setV('tel-cli', c.tel);
    if(c.cnpj) setV('cnpj-cli', c.cnpj);
    if(c.cpf)  setV('cpf-cli', c.cpf);
    setOrigemCli('Já é cliente');
    upd();
  }, 50);
}

function novaOSParaCliente(id){
  const c=lsCliLer().find(x=>x.id===id); if(!c) return;
  novaOS();
  setTimeout(()=>{
    if(document.getElementById('os-cli'))  setV('os-cli',  c.nome);
    if(document.getElementById('os-loc'))  setV('os-loc',  c.end||'');
    if(document.getElementById('os-cnpj')) setV('os-cnpj', c.cnpj||'');
    if(document.getElementById('os-cpf'))  setV('os-cpf', c.cpf||'');
    go('os');
  }, 50);
}

// ──────────────────────────────────────────────────
//  HISTÓRICO COMPLETO DO CLIENTE
// ──────────────────────────────────────────────────
function verHistoricoCliente(cliId){
  const lista=lsCliLer();
  const cli=lista.find(x=>x.id===cliId); if(!cli){ toast('Cliente não encontrado'); return; }
  const nomeL=cli.nome.toLowerCase();
  const orcCli=filtrarPorLoja(todosOrc).filter(o=>(o.cliente||'').toLowerCase()===nomeL||o.cliente_id===cliId);
  const osCli=filtrarPorLoja(todosOS).filter(o=>(o.cliente||'').toLowerCase()===nomeL||o.cliente_id===cliId);
  const visCli=filtrarPorLoja(lsVisLer(),'loja_id').filter(v=>(v.cliente||'').toLowerCase()===nomeL);
  const agCli=filtrarPorLoja(todosAg).filter(a=>(a.cliente||'').toLowerCase()===nomeL);
  const totalFat=orcCli.filter(o=>o.status==='aprovado').reduce((a,o)=>a+(o.total||0),0);
  const totalOS=osCli.filter(o=>o.status==='concluido').reduce((a,o)=>a+(o.total||0),0);
  const stC={aprovado:'var(--green)',pendente:'var(--yellow)',recusado:'var(--red)',vencido:'var(--gray)',agendado:'var(--blue)',concluido:'var(--green)',cancelado:'var(--red)'};
  const stBg={aprovado:'var(--green-bg)',pendente:'var(--yellow-bg)',recusado:'var(--red-bg)',vencido:'var(--gray-light)',agendado:'var(--blue-bg)',concluido:'var(--green-bg)',cancelado:'var(--red-bg)'};
  const _dt=(d,safe)=>{ if(!d) return '—'; try{ return new Date(safe?d+'T12:00:00':d).toLocaleDateString('pt-BR'); }catch(e){ return '—'; } };
  const existing=document.getElementById('modal-hist-cli'); if(existing) existing.remove();
  const m=document.createElement('div'); m.id='modal-hist-cli'; m.className='cli-hist-overlay';
  const orcHTML=orcCli.length?[...orcCli].sort((a,b)=>(b.numero||0)-(a.numero||0)).map(o=>`
    <div class="chi">
      <div>
        <div class="chi-desc">Orçamento #${String(o.numero||'').padStart(3,'0')}</div>
        <div class="chi-sub">${esc((o.servicos||[]).map(s=>s.desc||s).slice(0,2).join(', '))||'—'} · ${_dt(o.data_criacao)}</div>
      </div>
      <div class="chi-right">
        <div class="chi-val">${brl(o.total||0)}</div>
        <span class="chi-badge" style="background:${stBg[o.status]||'var(--gray-light)'};color:${stC[o.status]||'var(--gray)'}">${o.status||'—'}</span>
      </div>
    </div>`).join('')
    :'<div style="padding:10px 0;font-size:13px;color:var(--gray)">Nenhum orçamento encontrado</div>';
  const osHTML=osCli.length?[...osCli].sort((a,b)=>(b.numero||0)-(a.numero||0)).map(o=>`
    <div class="chi">
      <div>
        <div class="chi-desc">OS #${String(o.numero||'').padStart(3,'0')} · ${esc(o.tecnico||'—')}</div>
        <div class="chi-sub">${esc(Array.isArray(o.servicos)?o.servicos.map(s=>typeof s==='string'?s:(s.desc||s)).slice(0,2).join(', '):'')||'—'} · ${_dt(o.data_servico, true)}</div>
      </div>
      <div class="chi-right">
        <div class="chi-val">${o.total?brl(o.total):'—'}</div>
        <span class="chi-badge" style="background:${stBg[o.status]||'var(--blue-bg)'};color:${stC[o.status]||'var(--blue)'}">${o.status||'agendado'}</span>
        ${o.status==='concluido'?(o.relatorio_enviado_em
          ?`<button class="tb" style="font-size:10px;margin-top:3px" onclick="gerarRelatorioOS('${o.id}','cliente')">📄 Relatório</button>`
          :`<button class="tb" style="font-size:10px;margin-top:3px;background:#7c3aed;color:white;border-color:#7c3aed" onclick="enviarRelatorioOS('${o.id}')">📄 Enviar</button>`):''}
      </div>
    </div>`).join('')
    :'<div style="padding:10px 0;font-size:13px;color:var(--gray)">Nenhuma OS encontrada</div>';
  const visHTML=visCli.length?[...visCli].sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(v=>`
    <div class="chi">
      <div>
        <div class="chi-desc">Vistoria · ${esc(v.local||v.local_servico||'—')}</div>
        <div class="chi-sub">${esc(v.tecnico||'—')} · ${_dt(v.data, true)}</div>
      </div>
      <div class="chi-right">
        <span class="chi-badge" style="background:${v.status==='concluido'?'var(--green-bg)':'var(--blue-bg)'};color:${v.status==='concluido'?'var(--green)':'var(--blue)'}">${v.status||'realizada'}</span>
      </div>
    </div>`).join('')
    :'<div style="padding:10px 0;font-size:13px;color:var(--gray)">Nenhuma vistoria encontrada</div>';
  const agHTML=agCli.length?[...agCli].sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(a=>`
    <div class="chi">
      <div>
        <div class="chi-desc">${esc(a.tipo_servico||'Agendamento')} · ${esc(a.local_servico||'—')}</div>
        <div class="chi-sub">${esc(a.tecnico||'—')} · ${_dt(a.data, true)}${a.hora?' às '+a.hora:''}</div>
      </div>
      <div class="chi-right">
        <span class="chi-badge" style="background:${stBg[a.status]||'var(--blue-bg)'};color:${stC[a.status]||'var(--blue)'}">${a.status||'agendado'}</span>
      </div>
    </div>`).join('')
    :'<div style="padding:10px 0;font-size:13px;color:var(--gray)">Nenhum agendamento encontrado</div>';
  const totalGeral=totalFat+totalOS;
  m.innerHTML=`<div class="cli-hist-box">
    <div class="cli-hist-hdr">
      <div class="cli-hist-titulo">📋 ${esc(cli.nome)}</div>
      <button class="cli-hist-close" onclick="document.getElementById('modal-hist-cli').remove()">×</button>
    </div>
    <div class="cli-hist-body">
      ${cli.tel||cli.email_responsavel||cli.cnpj||cli.cpf?`<div class="chi-contato">
        ${cli.tel?`<span>📞 ${esc(cli.tel)}</span>`:''}
        ${cli.email_responsavel?`<span>✉ ${esc(cli.email_responsavel)}</span>`:''}
        ${cli.cnpj?`<span>🏢 ${esc(cli.cnpj)}</span>`:''}
        ${cli.cpf?`<span>🪪 ${esc(cli.cpf)}</span>`:''}
      </div>`:''}
      <div class="cli-hist-resumo">
        <div class="chr-item"><span class="chr-val">${orcCli.length}</span><div class="chr-label">Orçamentos</div></div>
        <div class="chr-item"><span class="chr-val">${osCli.length}</span><div class="chr-label">OS</div></div>
        <div class="chr-item"><span class="chr-val">${visCli.length}</span><div class="chr-label">Vistorias</div></div>
        <div class="chr-item"><span class="chr-val">${brl(totalGeral)}</span><div class="chr-label">Faturado</div></div>
      </div>
      <div class="cli-hist-secao">
        <div class="cli-hist-sec-titulo">Orçamentos</div>${orcHTML}
      </div>
      <div class="cli-hist-secao">
        <div class="cli-hist-sec-titulo">Ordens de Serviço</div>${osHTML}
      </div>
      <div class="cli-hist-secao">
        <div class="cli-hist-sec-titulo">Vistorias</div>${visHTML}
      </div>
      <div class="cli-hist-secao">
        <div class="cli-hist-sec-titulo">Agendamentos</div>${agHTML}
      </div>
    </div>
  </div>`;
  m.addEventListener('click',e=>{ if(e.target===m) m.remove(); });
  document.body.appendChild(m);
}

// ⚠️ carregarClientesRemoto trata o banco como fonte de verdade, então apagar
// só do localStorage NÃO resolve: o cliente volta no próximo sync, sempre.
// Precisa do delete remoto de verdade + tombstone pro caso do delete falhar
// (senão a ficha some da tela e continua viva no banco, ressuscitando depois).
function _cliTombLer(){ try{ return JSON.parse(ls('fluxa_cli_tombstones')||'[]'); }catch(e){ return []; } }
function _cliTombAdd(id){ const t=_cliTombLer(); if(!t.includes(id)){ t.push(id); lsSet('fluxa_cli_tombstones', JSON.stringify(t.slice(-500))); } }

function excluirCliente(id){
  confirmar({
    titulo:'Excluir cliente',
    msg:'A ficha sai do cadastro. Orçamentos, OS e vistorias já vinculados a ela continuam existindo, mas perdem o vínculo com o cliente.',
    destrutivo:true, labelSim:'Excluir',
    onSim:async()=>{
      _cliTombAdd(id);
      lsCliSalvar(lsCliLer().filter(x=>x.id!==id));
      renderClientes(); renderAvisoDuplicatas();
      if(dbOk&&db&&!String(id).startsWith('cli_')){
        try{ const {error}=await db.from('clientes').delete().eq('id',id); if(error) throw error; }
        catch(e){ console.warn('[excluirCliente]',e?.message||e); }
      }
      toast('🗑 Cliente removido');
    }
  });
}

// ──────────────────────────────────────────────────
//  FICHAS DUPLICADAS — auditoria e limpeza segura
// ──────────────────────────────────────────────────
// Ficha clonada por engano: o auto-cadastro cria ficha nova sempre que o nome
// não bate no cache local DAQUELE aparelho, sem checar o servidor primeiro —
// cada aparelho que salva um orçamento pro mesmo cliente pela primeira vez
// gera sua própria cópia, quase sempre com telefone/endereço em branco.
// Aqui só entra clone que é seguro apagar; qualquer ambiguidade real fica de
// fora de propósito (é decisão de gente, não de código).
function _cliCampo(c,a,b){ return (c?.[a]||c?.[b]||'').toString(); }
function _dupGrupos(){
  // lsCliLer() já vem escopado por empresa (carregarClientesRemoto filtra por
  // EMPRESA_ID), então não há risco de agrupar cliente de outro tenant.
  const cli=lsCliLer()||[];
  const orcs=todosOrc||[], osArr=todosOS||[];
  const vis=(typeof lsVisLer==='function')?lsVisLer():[];
  const eqs=(typeof todosEq!=='undefined'&&todosEq)?todosEq:[];
  const locs=(typeof locaisVistoria!=='undefined'&&locaisVistoria)?locaisVistoria:[];
  // clientes.id é referenciado por 5 tabelas — checar só orçamento/OS/vistoria
  // deixaria passar ficha em uso por equipamento (base instalada) ou por
  // local de vistoria recorrente.
  const usado=id => orcs.some(o=>String(o.cliente_id)===String(id))
    || osArr.some(o=>String(o.cliente_id)===String(id))
    || vis.some(v=>String(v.cliente_id)===String(id))
    || eqs.some(e=>String(e.cliente_id)===String(id))
    || locs.some(l=>String(l.cliente_id)===String(id));
  const grupos=[];
  const processados=new Set();
  const nm=s=>_normNome(s);

  // PASSADA 1 — mesmo nome, exatamente 1 cópia em uso. Divergência de
  // endereço/telefone nas OUTRAS é irrelevante: ficha com zero uso não
  // carrega histórico de ninguém pra proteger. 0 ou 2+ em uso cai adiante.
  const porNome={};
  cli.forEach(c=>{ const k=nm(c.nome); (porNome[k]=porNome[k]||[]).push(c); });
  Object.keys(porNome).forEach(k=>{
    const fichas=porNome[k]; if(fichas.length<2) return;
    const comUso=fichas.filter(f=>usado(f.id));
    if(comUso.length!==1) return;
    const remover=fichas.filter(f=>f.id!==comUso[0].id);
    if(!remover.length) return;
    fichas.forEach(f=>processados.add(f.id));
    grupos.push({nome:fichas[0].nome, manterId:comUso[0].id, removerIds:remover.map(f=>f.id), qtd:remover.length,
      endereco:_cliCampo(comUso[0],'end','endereco'), telefone:_cliCampo(comUso[0],'tel','telefone')});
  });

  // PASSADA 2 — mesmo nome, NENHUMA cópia em uso. Endereço/telefone podem
  // divergir (o caso mais comum é justamente um preenchido e outro em
  // branco). CNPJ divergente bloqueia: são pessoas jurídicas diferentes.
  // Mantém a ficha mais COMPLETA, não a mais antiga — a cópia mais nova às
  // vezes é a única com tipo/e-mail preenchido.
  const completude=f=>(_cliCampo(f,'tel','telefone')?1:0)+(_cliCampo(f,'end','endereco')?1:0)+(f.cnpj?1:0)+(f.cpf?1:0)+(f.tipo?1:0)+(f.email_responsavel?1:0);
  const porNome0={};
  cli.forEach(c=>{ if(processados.has(c.id)) return; const k=nm(c.nome); (porNome0[k]=porNome0[k]||[]).push(c); });
  Object.keys(porNome0).forEach(k=>{
    const fichas=porNome0[k]; if(fichas.length<2) return;
    if(fichas.some(f=>usado(f.id))) return;
    const cnpjs=new Set(fichas.map(f=>(f.cnpj||'').trim()).filter(Boolean));
    if(cnpjs.size>1) return;
    const manter=fichas.slice().sort((a,b)=>completude(b)-completude(a) || String(a.id).localeCompare(String(b.id)))[0];
    const remover=fichas.filter(f=>f.id!==manter.id);
    if(!remover.length) return;
    fichas.forEach(f=>processados.add(f.id));
    grupos.push({nome:fichas[0].nome, manterId:manter.id, removerIds:remover.map(f=>f.id), qtd:remover.length,
      endereco:_cliCampo(manter,'end','endereco'), telefone:_cliCampo(manter,'tel','telefone')});
  });

  // PASSADA 3 — tripla exata (nome+endereço+telefone). Cobre o que sobrou:
  // 2+ cópias em uso do mesmo nome, mas com alguma tripla idêntica entre
  // elas. Duas fichas em uso com a tripla igual continuam ambíguas e não
  // são tocadas.
  const porTripla={};
  cli.forEach(c=>{
    if(processados.has(c.id)) return;
    const k=nm(c.nome)+'|'+nm(_cliCampo(c,'end','endereco'))+'|'+nm(_cliCampo(c,'tel','telefone'));
    (porTripla[k]=porTripla[k]||[]).push(c);
  });
  Object.keys(porTripla).forEach(k=>{
    const fichas=porTripla[k]; if(fichas.length<2) return;
    const cnpjs=new Set(fichas.map(f=>(f.cnpj||'').trim()).filter(Boolean));
    if(cnpjs.size>1) return;
    const comUso=fichas.filter(f=>usado(f.id));
    if(comUso.length>1) return; // ambíguo — não mexe
    const manter=comUso[0] || fichas.slice().sort((a,b)=>completude(b)-completude(a) || String(a.id).localeCompare(String(b.id)))[0];
    const remover=fichas.filter(f=>f.id!==manter.id);
    if(!remover.length) return;
    grupos.push({nome:fichas[0].nome, manterId:manter.id, removerIds:remover.map(f=>f.id), qtd:remover.length,
      endereco:_cliCampo(manter,'end','endereco'), telefone:_cliCampo(manter,'tel','telefone')});
  });

  return grupos.sort((a,b)=>b.qtd-a.qtd);
}

function renderAvisoDuplicatas(){
  const el=document.getElementById('cli-dup-aviso'); if(!el) return;
  const grupos=_dupGrupos();
  if(!grupos.length){ el.style.display='none'; el.innerHTML=''; return; }
  const totalFichas=grupos.reduce((a,g)=>a+g.qtd,0);
  el.style.display='';
  el.innerHTML=`<div class="rd-card rd-card-warn" style="margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;color:var(--warn);margin-bottom:4px">
      ${totalFichas} ficha${totalFichas!==1?'s':''} duplicada${totalFichas!==1?'s':''}</div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:9px">
      ${grupos.length} cliente${grupos.length!==1?'s':''} com cópia repetida no cadastro. Nenhuma das cópias a remover tem orçamento, OS, vistoria, equipamento ou plano vinculado — o histórico fica intacto na ficha que sobra.</div>
    <button class="rd-btn rd-btn-secondary" onclick="abrirRevisaoDuplicatas()">Revisar e limpar</button>
  </div>`;
}

// ══ IDENTIDADE DO CLIENTE ═════════════════════════
// Orçamento, OS e vistoria guardam DUAS coisas: `cliente` (o nome digitado) e
// `cliente_id` (o vínculo com a ficha). O nome sempre existe; o vínculo só
// existe se quem preencheu escolheu uma sugestão em vez de digitar direto.
//
// O estrago não é cosmético. analiseClientes() agrupa por
// `cliente_id ? 'id:'+id : 'nome:'+nome` — então o MESMO cliente, ora com
// vínculo ora sem, vira dois grupos: o histórico de compra se parte no meio,
// "recompra" vira "primeira compra" e o ritmo de consumo sai errado. A ficha do
// cliente também não mostra o que está solto.
//
// Só liga o que é seguro ligar: nome normalizado IDÊNTICO a exatamente UMA
// ficha cadastrada. Parecido não conta — vincular ao cliente errado é pior que
// deixar solto, porque some da lista e ninguém mais revisa.
const _IDENT_FONTES=[
  {chave:'orc', label:'orçamento', tabela:'orcamentos'},
  {chave:'os',  label:'OS',        tabela:'ordens_servico'},
  {chave:'vis', label:'vistoria',  tabela:'vistorias'},
];
function _identOrfaos(){
  const cli=lsCliLer()||[];
  // Nome que aparece em 2+ fichas é ambíguo: não dá pra saber a qual vincular.
  const porNome={};
  cli.forEach(c=>{ const k=_normNome(c.nome); if(k) (porNome[k]=porNome[k]||[]).push(c); });
  const registros=[
    ...filtrarPorLoja(todosOrc||[]).map(o=>({...o, _fonte:'orc'})),
    ...filtrarPorLoja(todosOS||[]).map(o=>({...o, _fonte:'os'})),
    ...((typeof lsVisLer==='function'?lsVisLer():[])||[]).map(v=>({...v, _fonte:'vis', cliente:v.cliente})),
  ];
  const grupos={};
  registros.forEach(r=>{
    if(r.cliente_id) return;
    const nome=(r.cliente||'').trim(); if(!nome) return;
    const k=_normNome(nome);
    const fichas=porNome[k]||[];
    if(fichas.length!==1) return; // 0 = ficha não existe; 2+ = ambíguo
    if(!grupos[k]) grupos[k]={chave:k, nome, clienteId:fichas[0].id, registros:[], valor:0};
    const g=grupos[k];
    g.registros.push({id:r.id, fonte:r._fonte});
    if(r._fonte==='orc' && r.status==='aprovado') g.valor+=parseFloat(r.total)||0;
  });
  return Object.values(grupos).sort((a,b)=>b.registros.length-a.registros.length);
}
function _identResumo(g){
  return _IDENT_FONTES.map(f=>{
    const n=g.registros.filter(r=>r.fonte===f.chave).length;
    return n?`${n} ${f.label}${n!==1?(f.chave==='os'?'':'s'):''}`:null;
  }).filter(Boolean).join(' · ');
}
function renderAvisoIdentidade(){
  const el=document.getElementById('cli-ident-aviso'); if(!el) return;
  const grupos=_identOrfaos();
  if(!grupos.length){ el.style.display='none'; el.innerHTML=''; return; }
  const total=grupos.reduce((a,g)=>a+g.registros.length,0);
  el.style.display='';
  el.innerHTML=`<div class="rd-card rd-card-warn" style="margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;color:var(--warn);margin-bottom:4px">
      ${total} registro${total!==1?'s':''} sem vínculo de cliente</div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:9px">
      ${grupos.length} nome${grupos.length!==1?'s':''} digitado${grupos.length!==1?'s':''} à mão que bate${grupos.length!==1?'m':''} exatamente com uma ficha já cadastrada. Sem o vínculo, o histórico do cliente fica partido: a mesma pessoa aparece como dois clientes diferentes nas análises.</div>
    <button class="rd-btn rd-btn-secondary" onclick="abrirRevisaoIdentidade()">Revisar e vincular</button>
  </div>`;
}
let _identGruposAtual=[];
async function abrirRevisaoIdentidade(){
  toast('Atualizando antes de montar a lista…');
  await carregarClientesRemoto();
  if(typeof loadHist==='function') await loadHist();
  if(typeof loadOSHist==='function') await loadOSHist();
  _identGruposAtual=_identOrfaos();
  renderAvisoIdentidade();
  if(!_identGruposAtual.length){ toast('Nada solto pra vincular'); return; }
  const total=_identGruposAtual.reduce((a,g)=>a+g.registros.length,0);
  const linhas=_identGruposAtual.map((g,i)=>`
    <label style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line);cursor:pointer">
      <input type="checkbox" data-ident="${i}" checked style="margin-top:3px;cursor:pointer">
      <span style="flex:1;min-width:0">
        <span style="display:block;font-size:13px;font-weight:700;color:var(--c2)">${esc(g.nome)}</span>
        <span style="display:block;font-size:11.5px;color:var(--tx3)">${esc(_identResumo(g))}${g.valor>0?' · '+brl(g.valor)+' aprovado':''}</span>
      </span>
    </label>`).join('');
  abrirModal({id:'ident-modal-bg', largura:'wide', corpo:`
    <h3>Vincular registros à ficha do cliente</h3>
    <p class="rd-modal-sub">${total} registro${total!==1?'s':''} em ${_identGruposAtual.length} nome${_identGruposAtual.length!==1?'s':''}. Cada um bate exatamente com UMA ficha cadastrada — nomes parecidos e nomes repetidos no cadastro ficam de fora, porque vincular ao cliente errado é pior que deixar solto. Nada é apagado: só se preenche o vínculo que faltava.</p>
    ${linhas}
    <div class="rd-modal-acts">
      <button class="rd-modal-btn rd-modal-btn-nao" onclick="fecharModalGenerico('ident-modal-bg')">Cancelar</button>
      <button class="rd-modal-btn rd-modal-btn-sim" onclick="confirmarVinculoIdentidade()">Vincular</button>
    </div>`});
}
async function confirmarVinculoIdentidade(){
  const marcados=[...document.querySelectorAll('#ident-modal-bg input[data-ident]')]
    .filter(c=>c.checked).map(c=>_identGruposAtual[parseInt(c.dataset.ident)]).filter(Boolean);
  if(!marcados.length){ toast('Nenhum nome marcado'); return; }
  const total=marcados.reduce((a,g)=>a+g.registros.length,0);
  atualizarModal(`
    <h3>Vinculando…</h3>
    <div id="ident-progresso-txt" style="font-size:13px;color:var(--tx3);margin-bottom:8px">0 de ${total}</div>
    <div style="height:8px;background:var(--line);border-radius:50px;overflow:hidden">
      <div id="ident-progresso-barra" style="height:100%;width:0%;background:var(--c1);transition:width .2s"></div>
    </div>
    <div style="font-size:11.5px;color:var(--tx3);margin-top:8px">Não feche esta aba até terminar.</div>`, 'ident-modal-bg');

  const tarefas=marcados.flatMap(g=>g.registros.map(r=>({...r, clienteId:g.clienteId})));
  let ok=0, falhas=0;
  const LOTE=15;
  for(let i=0;i<tarefas.length;i+=LOTE){
    await Promise.all(tarefas.slice(i,i+LOTE).map(async t=>{
      const f=_IDENT_FONTES.find(x=>x.chave===t.fonte); if(!f){ falhas++; return; }
      // dbUpdate resolve com {error} em vez de rejeitar — checar explicitamente,
      // senão uma falha do banco contaria como sucesso e o aviso sumiria da
      // tela sem o vínculo ter sido gravado.
      try{
        const r=await dbUpdate(f.tabela, {cliente_id:t.clienteId}, 'id', t.id);
        if(r&&r.error){ falhas++; console.warn('[ident]', f.tabela, r.error.message); return; }
        _identAplicarLocal(t.fonte, t.id, t.clienteId);
        ok++;
      }catch(e){ falhas++; console.warn('[ident]', e?.message||e); }
    }));
    const feitos=Math.min(i+LOTE, tarefas.length);
    setV_el('ident-progresso-txt', feitos+' de '+tarefas.length, 'textContent');
    const barra=document.getElementById('ident-progresso-barra');
    if(barra) barra.style.width=Math.round(feitos/tarefas.length*100)+'%';
  }
  fecharModalGenerico('ident-modal-bg');
  _identGruposAtual=[];
  renderAvisoIdentidade();
  if(document.getElementById('page-clientes')?.classList.contains('on')) renderClientes();
  toast(falhas ? `${ok} vinculado${ok!==1?'s':''}, ${falhas} falhou (tente de novo)` : `✅ ${ok} registro${ok!==1?'s':''} vinculado${ok!==1?'s':''}`);
}
// Espelha no cache local o que acabou de ser gravado no banco. Sem isto o
// aviso continuaria mostrando os mesmos registros até o próximo load remoto.
function _identAplicarLocal(fonte, id, clienteId){
  if(fonte==='orc'){
    const o=(todosOrc||[]).find(x=>x.id===id); if(o) o.cliente_id=clienteId;
    if(typeof lsOrcSalvar==='function') lsOrcSalvar(todosOrc);
  } else if(fonte==='os'){
    const o=(todosOS||[]).find(x=>x.id===id); if(o) o.cliente_id=clienteId;
    try{ lsSet('fluxa_os_hist', JSON.stringify((todosOS||[]).slice(0,600))); }catch(e){ console.warn('[ident:os]', e?.message||e); }
  } else if(fonte==='vis'){
    const lista=(typeof lsVisLer==='function'?lsVisLer():[])||[];
    const v=lista.find(x=>x.id===id); if(v){ v.cliente_id=clienteId; if(typeof lsVisSalvar==='function') lsVisSalvar(lista); }
  }
}

let _dupGruposAtual=[];
async function abrirRevisaoDuplicatas(){
  // Este é o instante mais crítico (logo antes de uma exclusão em massa) —
  // não dá pra confiar no cache que a aba tinha de uma visita anterior.
  toast('Atualizando antes de montar a lista…');
  await carregarClientesRemoto();
  if(typeof loadHist==='function') await loadHist();
  if(typeof loadOSHist==='function') await loadOSHist();
  if(typeof loadEquipamentos==='function') await loadEquipamentos();
  if(typeof loadLocaisRemoto==='function') await loadLocaisRemoto();
  _dupGruposAtual=_dupGrupos();
  renderAvisoDuplicatas();
  if(!_dupGruposAtual.length){ toast('Nada duplicado pra limpar'); return; }
  const totalFichas=_dupGruposAtual.reduce((a,g)=>a+g.qtd,0);
  const linhas=_dupGruposAtual.map(g=>`
    <div style="padding:9px 0;border-bottom:1px solid var(--line)">
      <div style="font-size:13px;font-weight:700;color:var(--c2)">${esc(g.nome||'(sem nome)')}</div>
      <div style="font-size:11.5px;color:var(--tx3)">${[g.endereco,g.telefone].filter(Boolean).map(x=>esc(x)).join(' · ')||'sem endereço/telefone cadastrado'}</div>
      <div style="font-size:11.5px;color:var(--warn)">mantém 1 ficha · remove ${g.qtd} cópia${g.qtd!==1?'s':''}</div>
    </div>`).join('');
  abrirModal({id:'dup-modal-bg', largura:'wide', corpo:`
    <h3>Limpar fichas duplicadas</h3>
    <p class="rd-modal-sub">${_dupGruposAtual.length} cliente${_dupGruposAtual.length!==1?'s':''}, ${totalFichas} ficha${totalFichas!==1?'s':''} a remover. Nenhuma delas tem histórico vinculado — o que já existe continua ligado à ficha mantida.</p>
    ${linhas}
    <div class="rd-modal-acts">
      <button class="rd-modal-btn rd-modal-btn-nao" onclick="fecharModalGenerico('dup-modal-bg')">Cancelar</button>
      <button class="rd-modal-btn rd-modal-btn-sim destrutivo" onclick="confirmarLimpezaDuplicatas()">Remover ${totalFichas} ficha${totalFichas!==1?'s':''}</button>
    </div>`});
}

async function confirmarLimpezaDuplicatas(){
  const grupos=_dupGruposAtual;
  const totalFichas=grupos.reduce((a,g)=>a+g.qtd,0);
  // O modal fica aberto com progresso real: fechar no clique fazia a limpeza
  // parecer travada (ou "sumida") enquanto centenas de deletes rodavam.
  atualizarModal(`
    <h3>Removendo fichas duplicadas…</h3>
    <div id="dup-progresso-txt" style="font-size:13px;color:var(--tx3);margin-bottom:8px">0 de ${totalFichas}</div>
    <div style="height:8px;background:var(--line);border-radius:50px;overflow:hidden">
      <div id="dup-progresso-barra" style="height:100%;width:0%;background:var(--c1);transition:width .2s"></div>
    </div>
    <div style="font-size:11.5px;color:var(--tx3);margin-top:8px">Não feche esta aba até terminar.</div>`, 'dup-modal-bg');

  const todos=grupos.flatMap(g=>g.removerIds);
  let cli=lsCliLer();
  let removidas=0, falhas=0;
  const LOTE=15;
  for(let i=0;i<todos.length;i+=LOTE){
    const lote=todos.slice(i,i+LOTE);
    await Promise.all(lote.map(async id=>{
      // Tombstone só DEPOIS de confirmar o delete no banco — tombar antes
      // esconderia localmente uma ficha que na real continua no banco.
      if(String(id).startsWith('cli_')){ cli=cli.filter(c=>c.id!==id); removidas++; return; }
      if(!(dbOk&&db)){ falhas++; return; }
      try{
        const {error}=await db.from('clientes').delete().eq('id',id);
        if(error) throw error;
        _cliTombAdd(id);
        cli=cli.filter(c=>c.id!==id);
        removidas++;
      }catch(e){ console.warn('[limpezaDup]',e?.message||e); falhas++; }
    }));
    lsCliSalvar(cli); // grava a cada lote — aba fechada no meio não perde o já feito
    const txt=document.getElementById('dup-progresso-txt'); if(txt) txt.textContent=`${removidas+falhas} de ${totalFichas}`;
    const barra=document.getElementById('dup-progresso-barra'); if(barra) barra.style.width=((removidas+falhas)/totalFichas*100)+'%';
  }

  if(typeof logAcao==='function') logAcao('limpeza_duplicatas', `${removidas} fichas duplicadas removidas em ${grupos.length} clientes${falhas?` · ${falhas} falharam`:''}`);
  renderClientes(); renderAvisoDuplicatas();
  atualizarModal(`
    <div style="text-align:center">
      <div style="font-size:32px;margin-bottom:8px">${falhas?'⚠️':'✅'}</div>
      <div style="font-size:15px;font-weight:800;color:var(--c2);margin-bottom:14px">${removidas} ficha${removidas!==1?'s':''} duplicada${removidas!==1?'s':''} removida${removidas!==1?'s':''}${falhas?`<br><span style="color:var(--bad);font-size:13px">${falhas} falharam — continuam no banco, tente de novo</span>`:''}</div>
      <button class="rd-modal-btn rd-modal-btn-sim" style="width:100%" onclick="fecharModalGenerico('dup-modal-bg')">Fechar</button>
    </div>`, 'dup-modal-bg');
  toast(falhas?`⚠️ ${removidas} removidas, ${falhas} falharam`:`✅ ${removidas} fichas duplicadas removidas`);
}

let _cliEditId = null;
function editarCliente(id){
  const lista=lsCliLer();
  const c=lista.find(x=>x.id===id); if(!c) return;
  _cliEditId=id;
  setV('cli-new-nome',c.nome||'');
  setV('cli-new-tel',c.tel||'');
  setV('cli-new-end',c.end||'');
  setV('cli-new-cnpj',c.cnpj||'');
  setV('cli-new-cpf',c.cpf||'');
  setV('cli-new-email',c.email_responsavel||'');
  const tipoEl=document.getElementById('cli-new-tipo'); if(tipoEl) tipoEl.value=c.tipo||'';
  const wrap=document.getElementById('cli-form-wrap');
  wrap.style.display='block';
  // muda o título do form
  const btn=wrap.querySelector('button[onclick="salvarNovoCliente()"]');
  if(btn) btn.textContent='💾 Salvar alterações';
  const titulo=wrap.querySelector('.ct');
  if(titulo) titulo.textContent='Editar Cliente';
}

// Auto-cadastra cliente ao gerar orçamento/OS/vistoria.
// v2: a base já é escopada por empresa (RLS + empresa_id), então dedup é
// por nome (não precisa do agrupamento aquamotor/fortemp que o v1 tinha —
// aqui cada empresa já não vê a base da outra).
//
// Checa o SERVIDOR antes de criar (adaptado do v1, 16/08) — antes só olhava
// o cache local do aparelho (lsCliLer()): cada aparelho que "descobria" o
// mesmo cliente pela primeira vez criava sua própria cópia (achado real do
// v1, 16 grupos/19 fichas duplicadas em produção lá por causa disso). Agora,
// quando não acha localmente, consulta o servidor pelo nome antes de
// decidir criar. Achou lá -> usa o id real, só atualiza o cache local. Não
// achou ou deu erro de rede -> cai no fluxo de sempre (cria local-first),
// sem travar o salvamento.
//
// Virou ASYNC (era síncrona) — revisão de código confirmou que os 3
// chamadores (salvarApenas/gerarPDF/gerarOSPDF) já eram async, e
// _montarRecVistoria() (só chamadora que não era) também virou async por
// causa disso — seus 2 chamadores (salvarVistoria/gerarRelatorioVistoria)
// já eram async também. Todo o caminho já suportava await sem precisar
// tocar em mais nada.
// `cpf` é o último parâmetro (não no meio) de propósito — quem já chamava
// esta função sem ele continua funcionando igual (undefined, campo
// opcional), só os 2 call sites que realmente têm CPF em mãos
// (salvarApenas/gerarPDF do orçamento) precisaram passar o 6º argumento.
async function _autoSalvarCliente(nome, tel, end, cnpj, lojaId, cpf){
  if(!nome||nome==='—') return null;
  const nomeL=nome.toLowerCase();
  const lista=lsCliLer();
  const idx=lista.findIndex(c=>(c.nome||'').toLowerCase()===nomeL);
  if(idx>=0) return lista[idx].id; // já existe no cache deste aparelho

  if(dbOk&&db&&EMPRESA_ID){
    try{
      // ilike sem % é match exato case-insensitive (mesmo critério do
      // check local acima, só perguntando ao servidor em vez do cache).
      const {data:remoto,error}=await db.from('clientes')
        .select('id,nome').eq('empresa_id',EMPRESA_ID).ilike('nome', nome.trim()).limit(20);
      if(error) throw error;
      const achou=(remoto||[]).find(c=>(c.nome||'').toLowerCase()===nomeL);
      if(achou){
        // Existe no servidor — só não estava no cache deste aparelho ainda.
        const listaAgora=lsCliLer();
        if(!listaAgora.some(c=>c.id===achou.id)){
          listaAgora.unshift({id:achou.id, nome:achou.nome, tel:tel||'', end:end||'', cnpj:cnpj||'', cpf:cpf||'', email_responsavel:'', tipo:'', loja_id:lojaId||null});
          lsCliSalvar(listaAgora);
        }
        return achou.id;
      }
    }catch(e){
      // Rede/erro na checagem: segue pro fallback local-first abaixo —
      // melhor arriscar 1 duplicata rara do que travar o salvamento.
      console.warn('[_autoSalvarCliente check]', e?.message||e);
    }
  }

  const novo={id:'cli_'+Date.now(),nome,tel:tel||'',end:end||'',cnpj:cnpj||'',cpf:cpf||'',email_responsavel:'',tipo:'',portal_token:crypto.randomUUID(),loja_id:lojaId||null};
  lista.unshift(novo); lsCliSalvar(lista);
  if(dbOk&&db) dbInsert('clientes',{id:novo.id,nome,telefone:tel||null,endereco:end||null,cnpj:cnpj||null,cpf:cpf||null,loja_id:novo.loja_id,portal_token:novo.portal_token}).catch(()=>{});
  return novo.id;
}

async function salvarNovoCliente(){
  const nome=gV('cli-new-nome').trim();
  if(!nome){ toast('⚠️ Informe o nome do cliente'); return; }
  if(_cliEditId){
    // modo edição
    const lista=lsCliLer();
    const idx=lista.findIndex(x=>x.id===_cliEditId);
    if(idx>=0){
      lista[idx]={...lista[idx], nome, tel:gV('cli-new-tel').trim(), end:gV('cli-new-end').trim(), cnpj:gV('cli-new-cnpj').trim(), cpf:gV('cli-new-cpf').trim(), email_responsavel:gV('cli-new-email').trim(), tipo:document.getElementById('cli-new-tipo')?.value||''};
      lsCliSalvar(lista);
      if(dbOk&&db&&!String(_cliEditId).startsWith('cli_')){ dbUpdate('clientes',{nome,telefone:lista[idx].tel,endereco:lista[idx].end,cnpj:lista[idx].cnpj||null,cpf:lista[idx].cpf||null,email_responsavel:lista[idx].email_responsavel||null,tipo:lista[idx].tipo||null},'id',_cliEditId).catch(e=>console.warn('cli update sync:',e?.message||e)); }
    }
    _cliEditId=null;
    document.getElementById('cli-form-wrap').style.display='none';
    renderClientes(); toast('✅ Cliente atualizado!'); return;
  }
  // modo novo
  const novo={id:'cli_'+Date.now(), nome, tel:gV('cli-new-tel').trim(), end:gV('cli-new-end').trim(), cnpj:gV('cli-new-cnpj').trim(), cpf:gV('cli-new-cpf').trim(), email_responsavel:gV('cli-new-email').trim(), tipo:document.getElementById('cli-new-tipo')?.value||'', portal_token:crypto.randomUUID(), loja_id:lojaAtiva||LOJA_PADRAO_ID};
  const lista=lsCliLer(); lista.unshift(novo); lsCliSalvar(lista);
  if(dbOk&&db){
    dbInsert('clientes',{id:novo.id,nome:novo.nome,telefone:novo.tel,endereco:novo.end,cnpj:novo.cnpj||null,cpf:novo.cpf||null,email_responsavel:novo.email_responsavel||null,tipo:novo.tipo||null,loja_id:novo.loja_id,portal_token:novo.portal_token}).catch(e=>console.warn('cli sync:',e?.message||e));
  }
  document.getElementById('cli-form-wrap').style.display='none';
  renderClientes(); toast('✅ Cliente salvo!');
}

function mostrarFormCliente(){
  _cliEditId=null;
  const wrap=document.getElementById('cli-form-wrap');
  ['cli-new-nome','cli-new-tel','cli-new-end','cli-new-cnpj','cli-new-cpf'].forEach(id=>setV(id,''));
  const btn=wrap.querySelector('button[onclick="salvarNovoCliente()"]');
  if(btn) btn.textContent='💾 Salvar Cliente';
  const titulo=wrap.querySelector('.ct');
  if(titulo) titulo.textContent='Novo Cliente';
  wrap.style.display='block';
}

// Une cadastro de clientes + nomes vistos em orçamentos/OS (mesmo sem cadastro formal)
function _baseClientesUnificada(){
  const cadastrados=lsCliLer();
  const vistos=new Map(); // nome lowercase → {nome, end, tel, cnpj, _cadastrado}
  // Supabase retorna telefone/endereco; registros locais usam tel/end — aceita ambos
  cadastrados.forEach(c=>{ if(c.nome) vistos.set(c.nome.toLowerCase(),{id:c.id,nome:c.nome,end:c.end||c.endereco||'',tel:c.tel||c.telefone||'',cnpj:c.cnpj||'',_cadastrado:true}); });
  (todosOrc||[]).forEach(o=>{
    const n=(o.cliente||'').trim(); if(!n) return;
    const k=n.toLowerCase();
    if(!vistos.has(k)) vistos.set(k,{nome:n,end:o.local_servico||'',tel:o.tel_cliente||'',cnpj:o.cnpj||'',_cadastrado:false});
  });
  (todosOS||[]).forEach(o=>{
    const n=(o.cliente||'').trim(); if(!n) return;
    const k=n.toLowerCase();
    if(!vistos.has(k)) vistos.set(k,{nome:n,end:o.local_servico||'',tel:'',cnpj:o.cnpj||'',_cadastrado:false});
  });
  return [...vistos.values()];
}

function mostrarSugestoesCli(val){
  const box=document.getElementById('cli-suggestions'); if(!box) return;
  setV('cli-id',''); // digitou de novo → invalida vínculo de uma sugestão anterior
  if(!val||val.length<2){ box.style.display='none'; return; }
  const q=val.toLowerCase(); const qd=q.replace(/\D/g,'');
  const lista=_baseClientesUnificada().filter(c=>
    (c.nome||'').toLowerCase().includes(q)||(qd&&(c.cnpj||'').replace(/\D/g,'').includes(qd))
  ).sort((a,b)=>(b._cadastrado-a._cadastrado)).slice(0,6);
  if(!lista.length){ box.style.display='none'; return; }
  box.innerHTML=lista.map(c=>`<div class="cli-suggestion-item" onmousedown="selecionarSugestaoCli('${esc(c.id||'')}','${esc(c.nome)}','${esc(c.end||'')}','${esc(c.tel||'')}','${esc(c.cnpj||'')}')"><div class="cli-sug-name">${esc(c.nome)}${c._cadastrado?'':' <span style=\'font-size:10px;color:var(--gray);font-weight:400\'>(sem cadastro)</span>'}</div><div class="cli-sug-tel">${[c.tel,c.cnpj].filter(Boolean).map(x=>esc(x)).join(' · ')}</div></div>`).join('');
  box.style.display='block';
}
function selecionarSugestaoCli(id,nome,end,tel,cnpj){
  setV('cli',nome); setV('cli-id',id||''); if(end) setV('loc',end); if(tel) setV('tel-cli',tel); if(cnpj) setV('cnpj-cli',cnpj);
  // Cliente da base → pré-sugere origem "Já é cliente" (editável)
  if(!gV('origem-cli')) setOrigemCli('Já é cliente');
  document.getElementById('cli-suggestions').style.display='none'; upd();
}
function hideSugCli(){ const b=document.getElementById('cli-suggestions'); if(b) b.style.display='none'; }

function mostrarSugestoesCliOS(val){
  const box=document.getElementById('os-cli-suggestions'); if(!box) return;
  setV('os-cli-id',''); // digitou de novo → invalida vínculo de uma sugestão anterior
  if(!val||val.length<2){ box.style.display='none'; return; }
  const q=val.toLowerCase(); const qd=q.replace(/\D/g,'');
  const lista=_baseClientesUnificada().filter(c=>
    (c.nome||'').toLowerCase().includes(q)||(qd&&(c.cnpj||'').replace(/\D/g,'').includes(qd))
  ).sort((a,b)=>(b._cadastrado-a._cadastrado)).slice(0,6);
  if(!lista.length){ box.style.display='none'; return; }
  box.innerHTML=lista.map(c=>`<div class="cli-suggestion-item" onmousedown="selecionarSugestaoCliOS('${esc(c.id||'')}','${esc(c.nome)}','${esc(c.end||'')}','${esc(c.cnpj||'')}')"><div class="cli-sug-name">${esc(c.nome)}${c._cadastrado?'':' <span style=\'font-size:10px;color:var(--gray);font-weight:400\'>(sem cadastro)</span>'}</div><div class="cli-sug-tel">${[c.tel,c.cnpj].filter(Boolean).map(x=>esc(x)).join(' · ')}</div></div>`).join('');
  box.style.display='block';
}
function selecionarSugestaoCliOS(id,nome,end,cnpj){
  setV('os-cli',nome); setV('os-cli-id',id||''); if(end) setV('os-loc',end); if(cnpj) setV('os-cnpj',cnpj);
  document.getElementById('os-cli-suggestions').style.display='none';
  _osPopularEquipamentos();
}
function hideSugCliOS(){ const b=document.getElementById('os-cli-suggestions'); if(b) b.style.display='none'; }

// Popula o select de equipamento da OS com os aparelhos do cliente atual.
// Mostra a linha só quando há o que escolher — campo vazio não ajuda ninguém.
// (Fase 10-11: vínculo opcional OS→equipamento.)
function _osPopularEquipamentos(selecionadoId){
  const sel=document.getElementById('os-equip-id');
  const row=document.getElementById('os-equip-row');
  if(!sel||!row) return;
  const cid=gV('os-cli-id')||'';
  const nomeCli=_normNome(gV('os-cli')||'');
  const lista=(todosEq||[]).filter(e=>{
    if(cid && e.cliente_id===cid) return true;
    if(!cid && nomeCli && _normNome(e.cliente_nome||'')===nomeCli) return true;
    return false;
  });
  if(!lista.length){ row.style.display='none'; sel.innerHTML='<option value="">— nenhum —</option>'; return; }
  row.style.display='';
  sel.innerHTML='<option value="">— nenhum —</option>'+lista.map(e=>{
    const lbl=[e.tipo,e.marca,e.modelo].filter(Boolean).join(' ')||'Equipamento';
    return `<option value="${esc(e.id)}">${esc(lbl)}${e.numero_serie?' · '+esc(e.numero_serie):''}</option>`;
  }).join('');
  if(selecionadoId) sel.value=selecionadoId;
}

// ──────────────────────────────────────────────────
//  MODAL BUSCA CLIENTE
// ──────────────────────────────────────────────────
let _buscaCliCtx = 'orc';
function abrirBuscaCli(ctx){
  _buscaCliCtx = ctx || 'orc';
  document.getElementById('modal-cli-inp').value = '';
  filtrarListaCli('');
  document.getElementById('modal-busca-cli').style.display = 'flex';
  setTimeout(()=>document.getElementById('modal-cli-inp').focus(), 80);
}
function fecharBuscaCli(){ document.getElementById('modal-busca-cli').style.display='none'; }
function filtrarListaCli(val){
  const q = (val||'').toLowerCase().trim();
  let lista = lsCliLer();
  if(q){
    const qd=q.replace(/\D/g,'');
    lista = lista.filter(c=>
      (c.nome||'').toLowerCase().includes(q) ||
      (qd && (c.tel||c.telefone||'').replace(/\D/g,'').includes(qd)) ||
      (qd && (c.cnpj||'').replace(/\D/g,'').includes(qd)) ||
      (c.end||c.endereco||'').toLowerCase().includes(q)
    );
  }
  const el = document.getElementById('modal-cli-lista');
  if(!lista.length){
    el.innerHTML=`<div style="padding:20px;text-align:center;color:var(--gray);font-size:13px">Nenhum cliente encontrado</div>`;
    return;
  }
  el.innerHTML = lista.slice(0,60).map(c=>`
    <div class="modal-cli-item" onmousedown="selecionarCliModal('${esc(c.id||'')}','${esc(c.nome)}','${esc(c.end||'')}','${esc(c.tel||'')}','${esc(c.cnpj||'')}','${esc(c.cpf||'')}')">
      <div class="mcn">${esc(c.nome)}</div>
      <div class="mcd">${[c.end,c.tel,c.cnpj].filter(Boolean).map(x=>esc(x)).join('  ·  ')}</div>
    </div>`).join('');
}
function selecionarCliModal(id, nome, end, tel, cnpj, cpf){
  if(_buscaCliCtx === 'venda'){
    setV('venda-cli', nome);
    _vendaClienteSelecionado = id ? {id, nome} : null;
    _vendaAnonimo = false;
  } else if(_buscaCliCtx === 'os'){
    setV('os-cli', nome); setV('os-cli-id', id||'');
    if(end) setV('os-loc', end);
    if(cnpj) setV('os-cnpj', cnpj);
    if(cpf) setV('os-cpf', cpf);
  } else if(_buscaCliCtx === 'eq'){
    setV('eq-cli-nome', nome); setV('eq-cli-id', id||'');
    _eqClienteSelecionado = id ? {id, nome} : null;
    _eqPiscinaSelecionadaId = null;
    const _eqNovoForm=document.getElementById('eq-piscina-novo'); if(_eqNovoForm) _eqNovoForm.style.display='none';
    if(typeof _eqRenderPiscinas==='function') _eqRenderPiscinas();
  } else if(_buscaCliCtx === 'vis'){
    setV('vis-cli', nome); setV('vis-cli-id', id||'');
    if(end) setV('vis-loc', end);
    _visPiscinaSelecionadaId = null;
    if(typeof _visRenderPiscinas==='function') _visRenderPiscinas();
    // auto-fill email from client record
    const clis=JSON.parse(ls('fluxa_clientes_full')||'[]');
    const cliVis=clis.find(c=>(c.nome||'')=== nome);
    if(cliVis?.email_responsavel){
      setV('vis-email-resp', cliVis.email_responsavel);
      const st=document.getElementById('vis-email-status'); if(st) st.textContent=`📧 ${cliVis.email_responsavel} (do cadastro)`;
    }
  } else {
    setV('cli', nome); setV('cli-id', id||'');
    if(end) setV('loc', end);
    if(tel) setV('tel-cli', tel);
    if(cnpj) setV('cnpj-cli', cnpj);
    if(cpf) setV('cpf-cli', cpf);
    // Cliente da base → pré-sugere origem "Já é cliente" (editável)
    if(!gV('origem-cli')) setOrigemCli('Já é cliente');
    upd();
  }
  fecharBuscaCli();
}

async function importarClientesDeOrcamentos(){
  const orcs = todosOrc.length ? todosOrc : lsOrcLer();
  if(!orcs.length){ toast('Nenhum orçamento encontrado.'); return; }
  let novos=0, atualizados=0;
  for(const o of orcs){
    if(!o.cliente||o.cliente==='—') continue;
    const lista=lsCliLer();
    const existe=lista.find(c=>(c.nome||'').toLowerCase()===o.cliente.toLowerCase());
    if(existe){
      let mudou=false;
      if(!existe.tel&&o.tel_cliente){ existe.tel=o.tel_cliente; mudou=true; }
      if(!existe.end&&o.local_servico){ existe.end=o.local_servico; mudou=true; }
      if(!existe.cnpj&&o.cnpj){ existe.cnpj=o.cnpj; mudou=true; }
      if(!existe.cpf&&o.cpf_cliente){ existe.cpf=o.cpf_cliente; mudou=true; }
      if(mudou){ lsCliSalvar(lista); atualizados++; }
    } else {
      const novo={id:'cli_'+Date.now()+Math.random(),nome:o.cliente,tel:o.tel_cliente||'',end:o.local_servico||'',cnpj:o.cnpj||'',cpf:o.cpf_cliente||'',portal_token:crypto.randomUUID()};
      lista.unshift(novo); lsCliSalvar(lista);
      if(dbOk&&db){ dbInsert('clientes',{id:novo.id,nome:novo.nome,telefone:novo.tel,endereco:novo.end,cnpj:novo.cnpj||null,cpf:novo.cpf||null,loja_id:lojaAtiva||LOJA_PADRAO_ID,portal_token:novo.portal_token}).catch(e=>console.warn('[cli:insert]',e?.message||e)); }
      novos++;
    }
  }
  renderClientes();
  toast(`✅ Importação concluída: ${novos} novo(s), ${atualizados} atualizado(s)`);
}

async function autoSalvarClienteDoOrc(dados){
  if(!dados.cli||dados.cli==='—') return;
  const lista=lsCliLer();
  const existe=lista.find(c=>(c.nome||'').toLowerCase()===dados.cli.toLowerCase());
  if(existe){
    // atualiza campos em branco se o orçamento tem mais info
    let mudou=false;
    if(!existe.tel&&dados.tel){ existe.tel=dados.tel; mudou=true; }
    if(!existe.end&&dados.loc){ existe.end=dados.loc; mudou=true; }
    if(!existe.cnpj&&dados.cnpj){ existe.cnpj=dados.cnpj; mudou=true; }
    if(!existe.cpf&&dados.cpf){ existe.cpf=dados.cpf; mudou=true; }
    if(mudou){ lsCliSalvar(lista); if(dbOk&&db&&!String(existe.id).startsWith('cli_')) { try{ await db.from('clientes').update({telefone:existe.tel,endereco:existe.end,cnpj:existe.cnpj||null,cpf:existe.cpf||null}).eq('id',existe.id); }catch(e){ console.warn('[cli:update]', e?.message||e); } } }
    return;
  }
  const novo={id:'cli_'+Date.now(),nome:dados.cli,tel:dados.tel||'',end:dados.loc||'',cnpj:dados.cnpj||'',cpf:dados.cpf||'',portal_token:crypto.randomUUID()};
  lista.unshift(novo); lsCliSalvar(lista);
  if(dbOk&&db){ dbInsert('clientes',{id:novo.id,nome:novo.nome,telefone:novo.tel,endereco:novo.end,cnpj:novo.cnpj||null,cpf:novo.cpf||null,loja_id:novo.loja_id||LOJA_PADRAO_ID,portal_token:novo.portal_token}).catch(e=>console.warn('[cli:auto-insert]',e?.message||e)); }
}

// ──────────────────────────────────────────────────
//  CHIPS CLIENTES
// ──────────────────────────────────────────────────
function salvarChip(){ const nm=gV('cli').trim(),lo=gV('loc').trim(); if(!nm) return; let l=JSON.parse(ls('fluxa_clientes')||'[]'); l=l.filter(c=>c.n!==nm); l.unshift({n:nm,l:lo}); if(l.length>8) l=l.slice(0,8); lsSet('fluxa_clientes',JSON.stringify(l)); renderChips(); }
function renderChips(){ const w=document.getElementById('chips-wrap'),c=document.getElementById('chips'); if(!w||!c) return; /* seção "Recentes" removida — sugestão/pesquisa substitui */ const l=JSON.parse(ls('fluxa_clientes')||'[]'); if(!l.length){w.style.display='none';return;} w.style.display='block'; c.innerHTML=''; l.forEach(x=>{ const ch=document.createElement('div'); ch.className='chip'; ch.innerHTML=`<span onclick="fillChip('${esc(x.n)}','${esc(x.l)}')">${esc(x.n)}</span><span class="chip-x" onclick="rmChip('${esc(x.n)}')">✕</span>`; c.appendChild(ch); }); }
function fillChip(n,l){ setV('cli',n); setV('loc',l); upd(); }
function rmChip(n){ let l=JSON.parse(ls('fluxa_clientes')||'[]'); l=l.filter(c=>c.n!==n); lsSet('fluxa_clientes',JSON.stringify(l)); renderChips(); }

// ──────────────────────────────────────────────────
//  PRINT — seleciona qual documento mostrar
// ──────────────────────────────────────────────────
let _printTitleBackup='';
// Calcula o nome sugerido do PDF (NomeCliente_ORC001 / _OS001 / Vistoria_Nome_dd-mm-aaaa)
// a partir do que j\u00E1 est\u00E1 preenchido no documento na tela. Extra\u00EDdo do listener de
// beforeprint pra poder ser chamado tamb\u00E9m de dentro de imprimirDoc() \u2014 no Android
// Chrome o evento beforeprint N\u00C3O dispara (mesmo motivo pelo qual imprimirDoc() j\u00E1
// aplica .print-active manualmente, ver coment\u00E1rio logo abaixo), ent\u00E3o depender s\u00F3
// do listener deixava o PDF salvo com nome gen\u00E9rico no celular.
function _nomeArquivoImpressao(modo){
  try{
    if(modo==='vis'){
      const cliEl = document.getElementById('pd-cli-nm-vis');
      const numEl = document.getElementById('pd-num-vis');
      const cli = (cliEl?.textContent||'').replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g,'').trim().replace(/\s+/g,'_');
      const dt  = (numEl?.textContent||'').replace(/\//g,'-');
      return cli ? `Vistoria_${cli}_${dt}` : `Vistoria_${dt||'relatorio'}`;
    }
    if(modo==='ros'){
      const cliEl = document.getElementById('pd-cli-nm-ros');
      const numEl = document.getElementById('pd-num-ros');
      const cli = (cliEl?.textContent||'').replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g,'').trim().replace(/\s+/g,'_');
      const dt  = (numEl?.textContent||'').replace(/\//g,'-');
      return cli ? `Relatorio_${cli}_${dt}` : `Relatorio_${dt||'servico'}`;
    }
    if(modo==='ent'){
      const cli=(document.getElementById('pd-cli-nm-ent')?.textContent||'').replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g,'').trim().replace(/\s+/g,'_');
      const num=(document.getElementById('pd-num-ent')?.textContent||'').replace(/[^0-9]/g,'');
      return cli&&num ? `Entrega_${cli}_${num}` : (num?`Entrega_${num}`:'Entrega');
    }
    const refMode = modo==='os' ? 'os' : 'orc';
    const numEl = document.getElementById('pd-num-'+refMode);
    const cliEl = document.getElementById('pd-cli-nm-'+refMode);
    const num = (numEl?.textContent||'').replace(/[^0-9]/g,'').padStart(3,'0');
    const cli = (cliEl?.textContent||'').replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g,'').trim().replace(/\s+/g,'_');
    const prefix = modo==='os'?'OS':modo==='both'?'ORC+OS':'ORC';
    if(cli && num) return `${cli}_${prefix}${num}`;
    if(num) return `${prefix}${num}`;
    return null;
  }catch(e){ return null; }
}
window.addEventListener('beforeprint',()=>{
  const showOrc = printMode==='orc' || printMode==='both';
  const showOs  = printMode==='os'  || printMode==='both';
  const showVis = printMode==='vis';
  document.getElementById('pdoc-orc').classList.toggle('print-active', showOrc);
  document.getElementById('pdoc-os').classList.toggle('print-active',  showOs);
  // pdoc-visita: se n\u00E3o for modo vis, garante que n\u00E3o aparece
  const pdocVis = document.getElementById('pdoc-visita');
  if(pdocVis && !showVis) pdocVis.classList.remove('print-active');
  const pdocEnt = document.getElementById('pdoc-entrega');
  if(pdocEnt && printMode!=='ent') pdocEnt.classList.remove('print-active');
  // O nome do arquivo (document.title) j\u00E1 foi setado por imprimirDoc() antes de
  // window.print() \u2014 n\u00E3o repete o backup aqui (sen\u00E3o capturaria o t\u00EDtulo J\u00C1
  // renomeado como "original" e o afterprint restauraria o nome errado). S\u00F3
  // refor\u00E7a a troca, idempotente, pra quem eventualmente chamar window.print()
  // direto (fora de imprimirDoc()).
  const nome = _nomeArquivoImpressao(printMode);
  if(nome) document.title = nome;
});
window.addEventListener('afterprint',()=>{
  document.getElementById('pdoc-orc').classList.remove('print-active');
  document.getElementById('pdoc-os').classList.remove('print-active');
  document.getElementById('pdoc-visita')?.classList.remove('print-active');
  document.getElementById('pdoc-relatorio-os')?.classList.remove('print-active');
  document.getElementById('pdoc-entrega')?.classList.remove('print-active');
  document.title = _printTitleBackup || 'Sistema de Orçamentos';
  printMode = '';
});

// Impressão mobile-safe: o Android Chrome NÃO dispara o evento `beforeprint`,
// então o `.pdoc` ficava display:none e o PDF saía EM BRANCO no celular.
// imprimirDoc() aplica a classe print-active MANUALMENTE antes de window.print(),
// sem depender do evento. Use SEMPRE isto no lugar de `printMode=x; window.print()`.
function imprimirDoc(modo){
  printMode = modo;
  const showOrc = modo==='orc' || modo==='both';
  const showOs  = modo==='os'  || modo==='both';
  const showVis = modo==='vis';
  const showRos = modo==='ros';
  document.getElementById('pdoc-orc')?.classList.toggle('print-active', showOrc);
  document.getElementById('pdoc-os')?.classList.toggle('print-active',  showOs);
  document.getElementById('pdoc-visita')?.classList.toggle('print-active', showVis);
  document.getElementById('pdoc-relatorio-os')?.classList.toggle('print-active', showRos);
  document.getElementById('pdoc-entrega')?.classList.toggle('print-active', modo==='ent');
  // Nome do arquivo sugerido no "Salvar como PDF": mesma lógica do print-active
  // acima — setado aqui, síncrono, ANTES de window.print(), e não dentro do
  // listener de beforeprint, porque esse evento não dispara no Android Chrome
  // (é exatamente o motivo do .print-active já estar manual acima). Sem isto,
  // no celular o PDF salvava com o título genérico da página em vez de
  // "NomeCliente_ORC001" — difícil de achar depois entre vários baixados.
  _printTitleBackup = document.title;
  const nome = _nomeArquivoImpressao(modo);
  if(nome) document.title = nome;
  window.print();
}

// ──────────────────────────────────────────────────
//  REALTIME SYNC (Supabase)
// ──────────────────────────────────────────────────
let realtimeChannel = null;

// ══════════════════════════════════════════════════
//  PAINEL ROOT DA PLATAFORMA (admin do SaaS, cross-tenant)
// ══════════════════════════════════════════════════
// Camada separada de "gestor" — gestor só enxerga a própria empresa (via RLS);
// admin da plataforma enxerga métricas de TODAS as empresas, mas só através das
// RPCs admin_* (SECURITY DEFINER, checam is_platform_admin() internamente — a
// RLS de isolamento por empresa nas tabelas de negócio não é alterada).
let isPlataformaAdmin = false;

// Quem autenticou por e-mail+senha (Supabase Auth) já provou quem é — se for
// membro da empresa ativa (membros.user_id), entra direto nessa persona, sem a
// tela de PIN interno. O PIN continua existindo só para perfis que o gestor
// cria DEPOIS pelo app (vendas/técnico/gestores adicionais em usuarios), que não
// têm conta de e-mail própria — pensados para dispositivo compartilhado em campo.
async function _autoLoginMembroDaConta(){
  if(!db || !authUser || !EMPRESA_ID) return false;
  try{
    const { data, error } = await db.from('membros').select('perfil,nome')
      .eq('user_id', authUser.id).eq('empresa_id', EMPRESA_ID).maybeSingle();
    if(error) throw error;
    if(!data) return false;
    setSessao({ perfil: data.perfil||'gestor', loja_id: null, nome: data.nome||'Gestor' });
    document.getElementById('login-overlay').style.display='none';
    atualizarBadgeUsuario();
    aplicarPermissoesPerfil();
    return true;
  }catch(e){ console.warn('[_autoLoginMembroDaConta]', e?.message||e); return false; }
}

async function checarAdminPlataforma(){
  isPlataformaAdmin = false;
  // Só precisa do cliente existir — é uma chamada de rede própria (db.rpc), não
  // depende de dbOk (que só vira true depois do fluxo de conexão do tenant, o
  // qual a conta admin PULA por completo). Exigir dbOk aqui fazia essa checagem
  // nunca rodar de verdade para uma conta admin.
  if(!db) return;
  try{
    const { data, error } = await db.rpc('sou_admin_plataforma');
    if(error) throw error;
    isPlataformaAdmin = !!data;
  }catch(e){ console.warn('[checarAdminPlataforma]', e?.message||e); }
}

// Modo ADMIN DA PLATAFORMA — tela TOTALMENTE separada do app de qualquer empresa.
// Uma conta admin não é gestor de nenhum tenant (por desenho): nunca deve ver
// sidebar/orçamentos/OS/PIN interno — só as métricas cross-tenant do SaaS.
function entrarModoPlataforma(){
  document.querySelector('.hdr:not(#admin-topbar)').style.display='none';
  const mobNav=document.getElementById('mob-nav'); if(mobNav) mobNav.style.display='none';
  const sidebar=document.getElementById('sidebar'); if(sidebar) sidebar.style.display='none';
  document.body.classList.add('no-sbar');
  document.body.style.paddingTop='56px';
  const overlay=document.getElementById('login-overlay'); if(overlay) overlay.style.display='none';
  const topbar=document.getElementById('admin-topbar'); if(topbar) topbar.style.display='flex';
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));
  const pg=document.getElementById('page-plataforma'); if(pg) pg.classList.add('on');
  document.title='Fluxa — Administração';
  loadPlataforma();
}

function _fmtBytes(n){
  n=Number(n)||0;
  if(n<1024) return n+' B';
  if(n<1024*1024) return (n/1024).toFixed(1)+' KB';
  if(n<1024*1024*1024) return (n/1024/1024).toFixed(1)+' MB';
  return (n/1024/1024/1024).toFixed(2)+' GB';
}

async function loadPlataforma(){
  if(!isPlataformaAdmin){ toast('⚠️ Acesso restrito'); go('form'); return; }
  const tbody=document.getElementById('plat-empresas-tbody');
  if(tbody) tbody.innerHTML='<tr><td colspan="7" style="color:var(--gray);padding:10px">Carregando…</td></tr>';
  try{
    const [{data:empresasData,error:e1}, {data:uso,error:e2}] = await Promise.all([
      db.rpc('admin_listar_empresas'),
      db.rpc('admin_uso_plataforma')
    ]);
    if(e1) throw e1; if(e2) throw e2;
    renderPlataforma(empresasData||[], uso||{});
  }catch(e){ console.warn('[loadPlataforma]', e?.message||e); toast('Erro ao carregar painel'); }
}

function renderPlataforma(empresas, uso){
  const kpis=document.getElementById('plat-kpis');
  if(kpis) kpis.innerHTML =
    _kpiTile('Empresas ativas', (uso.total_empresas_ativas??0)+' / '+(uso.total_empresas??0))+
    _kpiTile('Banco de dados', _fmtBytes(uso.banco_bytes))+
    _kpiTile('Storage (arquivos)', _fmtBytes(uso.storage_bytes))+
    _kpiTile('Contas (Auth)', String(uso.total_usuarios_auth??0));

  const sb=document.getElementById('plat-storage-buckets');
  if(sb){
    const bks=uso.storage_por_bucket||{};
    const keys=Object.keys(bks);
    sb.innerHTML = keys.length
      ? keys.map(k=>`<div style="display:flex;justify-content:space-between;padding:4px 0"><span>${esc(k)}</span><span style="color:var(--gray)">${_fmtBytes(bks[k])}</span></div>`).join('')
      : '<div style="color:var(--gray)">Nenhum arquivo enviado ainda</div>';
  }

  const tbody=document.getElementById('plat-empresas-tbody');
  if(!tbody) return;
  if(!empresas.length){ tbody.innerHTML='<tr><td colspan="7" style="color:var(--gray);padding:10px">Nenhuma empresa cadastrada</td></tr>'; return; }
  tbody.innerHTML = empresas.map(e=>{
    const criado = e.created_at ? new Date(e.created_at).toLocaleDateString('pt-BR') : '—';
    const statusBadge = e.ativo
      ? '<span style="color:var(--green);font-weight:600">● Ativa</span>'
      : '<span style="color:var(--red);font-weight:600">● Suspensa</span>';
    return `<tr>
      <td>${esc(e.nome||'—')}</td>
      <td>${esc(e.plano||'free')}</td>
      <td>${statusBadge}</td>
      <td style="text-align:center">${e.membros_count??0}</td>
      <td style="text-align:center">${e.orcamentos_count??0}</td>
      <td style="text-align:center">${e.clientes_count??0}</td>
      <td style="text-align:center">${e.produtos_count??0}</td>
      <td>${criado}</td>
      <td><button class="tb" onclick="_platToggleAtivo('${e.id}', ${!e.ativo})">${e.ativo?'Suspender':'Reativar'}</button></td>
    </tr>`;
  }).join('');
}

async function _platToggleAtivo(empresaId, novoValor){
  confirmar(
    novoValor ? 'Reativar esta empresa?' : 'Suspender esta empresa? Os usuários dela perdem acesso ao app.',
    async ()=>{
      try{
        const { data, error } = await db.rpc('admin_set_empresa_ativo', {p_empresa:empresaId, p_ativo:novoValor});
        if(error) throw error;
        if(!data){ toast('⚠️ Empresa não encontrada'); return; }
        toast(novoValor?'✅ Empresa reativada':'✅ Empresa suspensa');
        loadPlataforma();
      }catch(e){ console.warn('[_platToggleAtivo]', e?.message||e); toast('Erro ao atualizar'); }
    },
    novoValor?'Reativar':'Suspender'
  );
}

// ══════════════════════════════════════════════════
//  ANÁLISES (só gestor) — consulta VIEWS agregadas (não baixa tabelas)
// ══════════════════════════════════════════════════
let _analiseCharts = { fin:null, abc:null };
async function loadAnalises(){
  const kpis=document.getElementById('analises-kpis');
  if(kpis) kpis.innerHTML='<div style="color:var(--gray);font-size:13px;padding:8px">Carregando…</div>';
  if(!dbOk||!db||!EMPRESA_ID){ _renderAnaliseVazio(); return; }
  try{
    const [orc, fin, prod, ins] = await Promise.all([
      db.from('vw_analise_orcamentos').select('*').eq('empresa_id',EMPRESA_ID).maybeSingle(),
      db.from('vw_analise_financeiro_mensal').select('*').eq('empresa_id',EMPRESA_ID).order('mes',{ascending:true}),
      db.from('vw_analise_produtos').select('*').eq('empresa_id',EMPRESA_ID),
      db.from('insights').select('*').eq('empresa_id',EMPRESA_ID).order('created_at',{ascending:false}).limit(1)
    ]);
    renderAnalises({
      orc: orc.data||null,
      fin: fin.data||[],
      prod: prod.data||[],
      insight: (ins.data&&ins.data[0])||null
    });
  }catch(e){ console.warn('[loadAnalises]', e?.message||e); _renderAnaliseVazio(); }
}
function _renderAnaliseVazio(){
  const kpis=document.getElementById('analises-kpis'); if(kpis) kpis.innerHTML='';
  const empty=document.getElementById('analises-empty'); if(empty) empty.style.display='block';
}
function _kpiTile(label, valor, cor){
  return `<div class="card" style="text-align:center;padding:12px 8px">
    <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.03em">${esc(label)}</div>
    <div style="font-size:20px;font-weight:800;color:${cor||'var(--c2)'};margin-top:4px">${valor}</div></div>`;
}
function renderAnalises(d){
  const empty=document.getElementById('analises-empty');
  const temDados = (d.orc && d.orc.total) || (d.fin&&d.fin.length) || (d.prod&&d.prod.length);
  if(empty) empty.style.display = temDados ? 'none' : 'block';
  // Card de insight de IA (lido da tabela insights; escrito pelo backend futuro)
  const ic=document.getElementById('analises-insight');
  if(ic){
    if(d.insight && d.insight.conteudo){
      const c=d.insight.conteudo;
      ic.style.display='block';
      ic.innerHTML=`<div style="font-weight:700;margin-bottom:6px">🤖 Análise inteligente</div>
        <div style="font-size:13px;color:var(--c2)">${esc(c.resumo||'')}</div>`;
    } else ic.style.display='none';
  }
  // KPIs
  const o=d.orc||{};
  const kpis=document.getElementById('analises-kpis');
  if(kpis) kpis.innerHTML =
    _kpiTile('Taxa de aprovação', (o.taxa_aprovacao_pct||0)+'%', 'var(--green)')+
    _kpiTile('Ticket médio', brl(o.ticket_medio||0))+
    _kpiTile('Faturado', brl(o.total_faturado||0))+
    _kpiTile('Inadimplência', brl(o.inadimplencia||0), 'var(--red)');
  // Chart receita x despesa mensal
  const fin=d.fin||[];
  if(_analiseCharts.fin){ try{_analiseCharts.fin.destroy();}catch(e){} _analiseCharts.fin=null; }
  const cf=document.getElementById('analises-chart-fin');
  if(cf && fin.length){
    _analiseCharts.fin=new Chart(cf,{ type:'bar', data:{
      labels:fin.map(x=>x.mes),
      datasets:[
        {label:'Receita', data:fin.map(x=>+x.receita||0), backgroundColor:'#16a34a'},
        {label:'Despesas', data:fin.map(x=>+x.despesas||0), backgroundColor:'#ef4444'}
      ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}} });
  }
  // Chart ABC — top 10 produtos por receita de saída
  const prod=(d.prod||[]).slice().sort((a,b)=>(+b.receita_saida||0)-(+a.receita_saida||0)).slice(0,10);
  if(_analiseCharts.abc){ try{_analiseCharts.abc.destroy();}catch(e){} _analiseCharts.abc=null; }
  const ca=document.getElementById('analises-chart-abc');
  if(ca && prod.length){
    const corABC={A:'#16a34a',B:'#f59e0b',C:'#9ca3af'};
    _analiseCharts.abc=new Chart(ca,{ type:'bar', data:{
      labels:prod.map(x=>x.nome||'—'),
      datasets:[{label:'Receita de saída', data:prod.map(x=>+x.receita_saida||0), backgroundColor:prod.map(x=>corABC[x.abc]||'#9ca3af')}]
    }, options:{indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}} });
  }
  // Produtos parados (sem saída há 30+ dias)
  const parados=(d.prod||[]).filter(x=>x.dias_sem_saida!=null && x.dias_sem_saida>=30).sort((a,b)=>b.dias_sem_saida-a.dias_sem_saida).slice(0,15);
  const pd=document.getElementById('analises-parados');
  if(pd) pd.innerHTML = parados.length ? parados.map(x=>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-light)">
        <span>${esc(x.nome||'—')}</span><span style="color:var(--gray)">${x.dias_sem_saida} dias</span></div>`).join('')
      : '<div style="color:var(--gray)">Nenhum produto parado 🎉</div>';
}

// Config de uma subscription realtime, filtrada pela empresa ativa. Sem EMPRESA_ID
// (contexto ainda não carregado) cai só na RLS (que já escopa às empresas do usuário).
function _rtCfg(event, table){
  const c = { event, schema:'public', table };
  if(EMPRESA_ID) c.filter = 'empresa_id=eq.'+EMPRESA_ID;
  return c;
}
function iniciarRealtimeSync(){
  if(realtimeChannel){ try{ db.removeChannel(realtimeChannel); }catch(e){} }
  realtimeChannel = db.channel('fluxa-sync')
    .on('postgres_changes',_rtCfg('INSERT','orcamentos'), p=>{
      const novo=p.new;
      if(todosOrc.find(x=>x.id===novo.id)) return;
      todosOrc.unshift(novo);
      lsOrcUpsert(novo);
      atualizarDash();
      if(document.getElementById('page-history').classList.contains('on')) renderTabela();
      if(document.getElementById('page-crm')?.classList.contains('on')) renderCRM();
      toast('🔔 Novo orçamento #'+String(novo.numero||'').padStart(3,'0')+' (outro dispositivo)');
    })
    .on('postgres_changes',_rtCfg('UPDATE','orcamentos'), p=>{
      const novo=p.new;
      lsOrcUpsert(novo);
      const idx=todosOrc.findIndex(x=>x.id===novo.id);
      if(idx>=0) todosOrc[idx]={...todosOrc[idx],...novo}; else todosOrc.unshift(novo);
      atualizarDash();
      if(document.getElementById('page-history').classList.contains('on')) renderTabela();
      if(document.getElementById('page-crm')?.classList.contains('on')) renderCRM();
      // Reconcilia a reserva de estoque quando o status muda (ex.: cliente aprovou
      // pelo portal → este app, logado como gestor, faz a reserva). É idempotente.
      try{ if(typeof sincronizarReservaOrcamento==='function' && !eVendas()) sincronizarReservaOrcamento(novo); }catch(e){ console.warn('[rt orc reserva]', e?.message||e); }
      // Aprovação pelo PORTAL não passa por _setStatusOrc (roda como anon, via
      // RPC) — o custo é congelado aqui, no app do gestor, pelo mesmo motivo
      // que a reserva de estoque é. Idempotente: item já congelado é ignorado.
      try{
        if(novo.status==='aprovado' && !eVendas()){
          const alvo=todosOrc.find(x=>x.id===novo.id);
          if(alvo && _congelarCustoOrc(alvo)){
            lsOrcAtualizar(alvo.id,{servicos:alvo.servicos});
            if(dbOk&&db) orcSyncUpdate(alvo.id,{servicos:alvo.servicos}).catch(e=>console.warn('[rt custo]', e?.message||e));
          }
        }
      }catch(e){ console.warn('[rt orc custo]', e?.message||e); }
    })
    .on('postgres_changes',_rtCfg('DELETE','orcamentos'), p=>{
      const id=p.old.id;
      todosOrc=todosOrc.filter(x=>x.id!==id);
      lsOrcRemover(id);
      atualizarDash();
      if(document.getElementById('page-history').classList.contains('on')) renderTabela();
      if(document.getElementById('page-crm')?.classList.contains('on')) renderCRM();
    })
    .on('postgres_changes',_rtCfg('INSERT','equipamentos'), p=>{
      if(todosEq.find(x=>x.id===p.new.id)) return;
      todosEq.unshift(p.new); lsEqSalvar(todosEq);
      if(document.getElementById('page-equipamentos').classList.contains('on')) renderEqGrid();
    })
    .on('postgres_changes',_rtCfg('UPDATE','equipamentos'), p=>{
      const idx=todosEq.findIndex(x=>x.id===p.new.id);
      if(idx>=0) todosEq[idx]={...todosEq[idx],...p.new}; else todosEq.unshift(p.new);
      lsEqSalvar(todosEq);
      if(document.getElementById('page-equipamentos').classList.contains('on')) renderEqGrid();
    })
    .on('postgres_changes',_rtCfg('DELETE','equipamentos'), p=>{
      todosEq=todosEq.filter(x=>x.id!==p.old.id); lsEqSalvar(todosEq);
      if(document.getElementById('page-equipamentos').classList.contains('on')) renderEqGrid();
    })
    .on('postgres_changes',_rtCfg('INSERT','despesas'), p=>{
      if(todasDesp.find(x=>x.id===p.new.id)) return;
      todasDesp.unshift(p.new); lsDespSalvar(todasDesp);
      if(document.getElementById('page-despesas').classList.contains('on')) renderDespesas();
    })
    .on('postgres_changes',_rtCfg('UPDATE','despesas'), p=>{
      const idx=todasDesp.findIndex(x=>x.id===p.new.id);
      if(idx>=0) todasDesp[idx]={...todasDesp[idx],...p.new}; else todasDesp.unshift(p.new);
      lsDespSalvar(todasDesp);
      if(document.getElementById('page-despesas').classList.contains('on')) renderDespesas();
    })
    .on('postgres_changes',_rtCfg('DELETE','despesas'), p=>{
      todasDesp=todasDesp.filter(x=>x.id!==p.old.id); lsDespSalvar(todasDesp);
      if(document.getElementById('page-despesas').classList.contains('on')) renderDespesas();
    })
    // ordens_servico — achado de auditoria 2026-07-20: só orçamentos/equipamentos/
    // despesas tinham realtime; OS dependia só de reload manual entre dispositivos
    // (o histórico offline/reconciliação já era robusto, só faltava o "ao vivo").
    .on('postgres_changes',_rtCfg('INSERT','ordens_servico'), p=>{
      const novo=p.new;
      if(todosOS.find(x=>x.id===novo.id)) return;
      todosOS.unshift(novo);
      const lista=JSON.parse(ls('fluxa_os_hist')||'[]').filter(x=>x.id!==novo.id);
      lista.unshift(novo); lsSet('fluxa_os_hist', JSON.stringify(lista.slice(0,600)));
      if(document.getElementById('page-os-history').classList.contains('on')) renderOSTabela();
      toast('🔔 Nova OS #'+String(novo.numero||'').padStart(3,'0')+' (outro dispositivo)');
    })
    .on('postgres_changes',_rtCfg('UPDATE','ordens_servico'), p=>{
      const novo=p.new;
      const idx=todosOS.findIndex(x=>x.id===novo.id);
      if(idx>=0) todosOS[idx]={...todosOS[idx],...novo}; else todosOS.unshift(novo);
      const lista=JSON.parse(ls('fluxa_os_hist')||'[]').filter(x=>x.id!==novo.id);
      lista.unshift(novo); lsSet('fluxa_os_hist', JSON.stringify(lista.slice(0,600)));
      if(document.getElementById('page-os-history').classList.contains('on')) renderOSTabela();
    })
    .on('postgres_changes',_rtCfg('DELETE','ordens_servico'), p=>{
      const id=p.old.id;
      todosOS=todosOS.filter(x=>x.id!==id);
      const lista=JSON.parse(ls('fluxa_os_hist')||'[]').filter(x=>x.id!==id);
      lsSet('fluxa_os_hist', JSON.stringify(lista));
      if(document.getElementById('page-os-history').classList.contains('on')) renderOSTabela();
    })
    .subscribe(status=>{
      if(status==='SUBSCRIBED') console.log('Realtime sync ativo');
    });
}

// ──────────────────────────────────────────────────
//  UTILS
// ──────────────────────────────────────────────────
function gV(id){ return (document.getElementById(id)||{}).value||''; }
function setV(id,v){ const el=document.getElementById(id); if(el) el.value=v; }
// Retorna a data de hoje no formato YYYY-MM-DD em horário local (não UTC)
function _hojeLocal(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function setV_el(id,v,prop){ const el=document.getElementById(id); if(el) el[prop]=v; }
function show(id){ const el=document.getElementById(id); if(el) el.style.display='flex'; }
function hide(id){ const el=document.getElementById(id); if(el) el.style.display='none'; }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function safeKey(s){ return btoa(unescape(encodeURIComponent(s))).replace(/[^a-zA-Z0-9]/g,''); }
// v2 multi-tenant: o cache do localStorage é NAMESPACED por empresa
// (fluxa:<EMPRESA_ID>:chave), para que duas empresas no mesmo aparelho não
// misturem dados. Chaves globais (identidade do tenant + prefs de dispositivo)
// ficam sem prefixo. Sem EMPRESA_ID (antes do login) usa a chave crua.
// _lsKey é function declaration (hoisted) — pode ser chamada no boot antes daqui.
function _lsKey(k){
  if(!EMPRESA_ID) return k;
  if(k==='fluxa_empresa_id'||k==='fluxa_empresa_slug'||k==='sb_url'||k==='sb_key'||k==='fluxa_sbar_col'
     ||k==='fluxa_filtroSt'||k==='fluxa_filtroOSSt') return k; // globais de dispositivo
  return 'fluxa:'+EMPRESA_ID+':'+k;
}
function ls(k){ try{return localStorage.getItem(_lsKey(k));}catch(e){return null;} }
function lsSet(k,v){ try{localStorage.setItem(_lsKey(k),v);}catch(e){ console.warn('[lsSet]',e?.message||e); } }
function lsDel(k){ try{localStorage.removeItem(_lsKey(k));}catch(e){ console.warn('[lsDel]',e?.message||e); } }
let _toastTimer=null;
function toast(msg){
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg; t.classList.add('on');
  // Erros/avisos ficam mais tempo na tela para dar tempo de ler.
  const dur=/⚠️|❌|erro|falh|inválid|cheio/i.test(msg)?8500:4000;
  if(_toastTimer) clearTimeout(_toastTimer); // não deixa um toast anterior cortar o atual
  _toastTimer=setTimeout(()=>t.classList.remove('on'),dur);
}
function hexA(hex,a){ try{ const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; }catch(e){ return hex; } }

// C-03 — Draft auto-save (rascunho automático de formulários)
const DRAFT_KEYS = {
  form: 'fluxa_draft_form',
  os:   'fluxa_draft_os',
};
function salvarRascunho(pagina){
  try{
    if(pagina === 'form'){
      const dados = {
        cli: gV('cli'), loc: gV('loc'), 'tel-cli': gV('tel-cli'), obs: gV('obs'),
        escopo: gV('escopo'), 'nota-interna': gV('nota-interna'),
        'origem-cli': gV('origem-cli'), 'origem-cli-outro': gV('origem-cli-outro'),
      };
      lsSet(DRAFT_KEYS.form, JSON.stringify(dados));
      const ind = document.getElementById('draft-indicator');
      const tm = document.getElementById('draft-time');
      if(ind && gV('cli')){
        const h = new Date(); tm.textContent = h.getHours().toString().padStart(2,'0')+':'+h.getMinutes().toString().padStart(2,'0');
        ind.style.display = 'block';
      }
    } else if(pagina === 'os'){
      const dados = {
        'os-cli': gV('os-cli'), 'os-loc': gV('os-loc'), 'os-data': gV('os-data'),
        'os-obs': gV('os-obs'), 'os-mat': gV('os-mat'),
      };
      lsSet(DRAFT_KEYS.os, JSON.stringify(dados));
    }
  }catch(e){}
}
function restaurarRascunho(pagina){
  try{
    const raw = ls(DRAFT_KEYS[pagina]); if(!raw) return;
    const dados = JSON.parse(raw);
    Object.entries(dados).forEach(([k,v])=>setV(k,v));
    if(pagina==='form') updOrigemCli();
  }catch(e){}
}
function limparRascunho(pagina){
  try{
    lsDel(DRAFT_KEYS[pagina]);
    if(pagina === 'form'){ const ind = document.getElementById('draft-indicator'); if(ind) ind.style.display='none'; }
  }catch(e){ console.warn('[limparRascunho]', e?.message||e); }
}
// Auto-save ao digitar
document.addEventListener('input', function(e){
  const activePage = document.querySelector('.page.on');
  if(!activePage) return;
  const pid = activePage.id;
  if(pid === 'page-form') salvarRascunho('form');
  else if(pid === 'page-os') salvarRascunho('os');
});
// Aviso antes de sair
window.addEventListener('beforeunload', function(e){
  const activePage = document.querySelector('.page.on');
  if(!activePage) return;
  const pid = activePage.id;
  if((pid === 'page-form' || pid === 'page-os') && gV(pid==='page-form'?'cli':'os-cli')){
    e.preventDefault(); e.returnValue = ''; return;
  }
  // Avisa se há orçamentos não sincronizados com o banco
  const pendentes=lsOrcLer().filter(x=>String(x.id).startsWith('local_'));
  if(pendentes.length){
    e.preventDefault();
    e.returnValue=`Atenção: ${pendentes.length} orçamento(s) ainda não foram sincronizados com o banco. Feche somente após ver o indicador ✅ na tabela.`;
  }
});

// Sync automático em background: tenta reenviar local_* a cada 90 segundos
(function _iniciarSyncPeriodico(){
  async function _tentarSync(){
    if(!dbOk||!db) return;
    const pendentes=lsOrcLer().filter(x=>String(x.id).startsWith('local_'));
    if(!pendentes.length) return;
    console.log(`[sync-auto] ${pendentes.length} orçamento(s) pendente(s), reenviando…`);
    const mudou=await _reenviarOrcamentosLocais(pendentes).catch(()=>false);
    if(mudou){
      lsOrcSalvar(todosOrc);
      atualizarDash(); renderTabela();
      toast('✅ Orçamentos pendentes sincronizados!');
    }
  }
  setInterval(_tentarSync, 90000);
  // Também tenta ao voltar para a aba (ex.: usuário estava offline e voltou)
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') setTimeout(_tentarSync,2000); });
})();

// Escape fecha o confirm() aberto no momento — UM listener persistente
// (adicionado uma vez só, abaixo) em vez de um novo por chamada de
// confirmar(). Achado numa revisão: _excluirOrcVerificarEstoque() (l.3829)
// clona #confirmar-nao e fecha o modal na mão (classList.remove direto),
// sem passar pelo fechar() de baixo — com um listener por chamada, esse
// caminho vazava um keydown no document a cada uso. Com listener único e
// _confirmarEscHandler trocando de dono a cada abertura, não tem o que
// vazar: o pior caso é um handler velho ser chamado uma vez à toa.
let _confirmarEscHandler = null;
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape' && _confirmarEscHandler){ const fn=_confirmarEscHandler; _confirmarEscHandler=null; fn(); }
});

// M-01 — Diálogo de confirmação acessível (substitui window.confirm)
// Portado do v1 (15/08): shell .rd-modal + variante destrutiva. Aceita
// objeto (novo) OU os argumentos posicionais de sempre — todas as chamadas
// existentes continuam funcionando sem mudança:
//   confirmar({titulo, msg, detalhe:[{k,v}], destrutivo, labelSim, labelNao, onSim, onNao})
//   confirmar(msg, cbSim, titulo, cbNao, labelNao, labelSim)  ← forma antiga
// Sem `destrutivo`, comportamento idêntico ao de antes (foco no confirmar).
// Com `destrutivo:true`: ícone/botão de confirmar em vermelho, foco inicial
// no CANCELAR (Enter não confirma uma ação destrutiva sem querer). Escape e
// clique no fundo cancelam; foco volta pra quem abriu o diálogo.
function confirmar(a, cbSim, titulo, cbNao, labelNao, labelSim){
  const o = (a && typeof a==='object') ? a : {msg:a, onSim:cbSim, titulo, onNao:cbNao, labelNao, labelSim};
  const bg=document.getElementById('confirmar-modal-bg');
  if(!bg){ o.onSim&&o.onSim(); return; } // fallback sem modal: confirma direto (PWA nunca cai aqui)
  const titEl=document.getElementById('confirmar-titulo');
  const msgEl=document.getElementById('confirmar-msg');
  const icoEl=document.getElementById('confirmar-ico');
  const detEl=document.getElementById('confirmar-detalhe');
  const hintEl=document.getElementById('confirmar-hint');
  const simBtn=document.getElementById('confirmar-sim');
  const naoBtn=document.getElementById('confirmar-nao');
  const destrutivo=!!o.destrutivo;
  titEl.textContent = o.titulo || 'Confirmar';
  msgEl.textContent = o.msg || '';
  naoBtn.textContent = o.labelNao || (destrutivo?'Manter':'Cancelar');
  simBtn.textContent = o.labelSim || (destrutivo?'Excluir':'Confirmar');
  simBtn.classList.toggle('destrutivo', destrutivo);
  naoBtn.classList.toggle('destrutivo', destrutivo);
  icoEl.textContent = destrutivo?'!':'?';
  icoEl.style.background = destrutivo?'var(--bad-bg)':'var(--info-bg)';
  icoEl.style.color = destrutivo?'var(--bad)':'var(--info)';
  if(o.detalhe&&o.detalhe.length){
    detEl.style.display='';
    detEl.classList.toggle('destrutivo', destrutivo);
    detEl.innerHTML=o.detalhe.map(d=>`<div class="rd-modal-detail-row"><span>${esc(d.k)}</span><span>${esc(d.v)}</span></div>`).join('');
  } else { detEl.style.display='none'; detEl.innerHTML=''; }
  if(destrutivo){
    hintEl.style.display='';
    hintEl.textContent=`O foco começa em "${naoBtn.textContent}" — Enter não confirma.`;
  } else { hintEl.style.display='none'; }
  bg.classList.add('on');
  const focoAnterior=document.activeElement;
  const fechar=(cb)=>{
    bg.classList.remove('on');
    simBtn.onclick=null; naoBtn.onclick=null;
    _confirmarEscHandler=null;
    if(focoAnterior&&focoAnterior.focus) setTimeout(()=>focoAnterior.focus(),0);
    cb&&cb();
  };
  _confirmarEscHandler=()=>fechar(o.onNao);
  naoBtn.onclick=()=>fechar(o.onNao);
  simBtn.onclick=()=>fechar(o.onSim);
  setTimeout(()=>(destrutivo?naoBtn:simBtn).focus(), 50);
}

// Modal genérico pra conteúdo montado em JS (portado do v1, 15/08) — usa o
// mesmo shell .rd-modal-bg/.rd-modal do resto do app, em vez de cada modal
// ad-hoc montar sua própria moldura na mão. `corpo` é o HTML de dentro do
// card (título, texto, ações — quem chama decide, isto só monta a moldura).
// Nome com sufixo "Generico" de propósito — já existia um fecharModal()
// (sem argumento, fecha #modal-pg de pagamento, ~l.4041) muito antes desta
// migração. Um nome igual aqui sobrescreveria silenciosamente aquela função
// (JS mantém só a última declaração de mesmo nome) e quebraria o fluxo de
// registrar pagamento inteiro — achado numa revisão, corrigido antes de
// virar bug em produção.
function abrirModal({corpo, largura, id}){
  const modalId = id || 'rd-modal-dinamico';
  fecharModalGenerico(modalId);
  const bg=document.createElement('div');
  bg.className='rd-modal-bg on';
  bg.id=modalId;
  bg.onclick=(e)=>{ if(e.target===bg) fecharModalGenerico(modalId); };
  bg.innerHTML=`<div class="rd-modal${largura?' rd-modal-'+largura:''}"><div class="rd-modal-grip"></div>${corpo}</div>`;
  document.body.appendChild(bg);
  return bg;
}
// Troca o conteúdo de um modal já aberto (ex.: lista → progresso → resultado
// no mesmo card, sem fechar/reabrir) — mantém o grip do topo.
function atualizarModal(corpo, id){
  const bg=document.getElementById(id||'rd-modal-dinamico'); if(!bg) return;
  const card=bg.querySelector('.rd-modal'); if(!card) return;
  const grip=card.querySelector('.rd-modal-grip');
  card.innerHTML=(grip?grip.outerHTML:'<div class="rd-modal-grip"></div>')+corpo;
}
function fecharModalGenerico(id){
  const bg=document.getElementById(id||'rd-modal-dinamico'); if(bg) bg.remove();
}

// Prompt de texto no shell do app. Existe porque o prompt() nativo é bloqueado
// em PWA instalado no Android e aparece como um diálogo do navegador (com o
// domínio) no iOS — no meio de uma vistoria isso parece golpe, não o app.
// onOk só é chamado com texto; cancelar não chama nada.
function _promptTexto(titulo, valorInicial, onOk, opts){
  const o=opts||{};
  const id='rd-modal-prompt';
  abrirModal({id, corpo:`
    <div class="rd-modal-title">${esc(titulo||'')}</div>
    ${o.msg?`<div style="font-size:13px;color:var(--gray);margin-bottom:10px">${esc(o.msg)}</div>`:''}
    <input id="rd-prompt-inp" type="text" maxlength="${o.max||120}" value="${esc(valorInicial||'')}"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--gray-mid);border-radius:8px;font-size:14px;font-family:inherit;outline:none">
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button type="button" class="rd-btn rd-btn-secondary" onclick="fecharModalGenerico('${id}')">Cancelar</button>
      <button type="button" class="rd-btn rd-btn-primary" id="rd-prompt-ok">${esc(o.labelOk||'Salvar')}</button>
    </div>`});
  const inp=document.getElementById('rd-prompt-inp');
  const ok=()=>{ const v=(inp?.value||'').trim(); fecharModalGenerico(id); if(v) onOk&&onOk(v); };
  document.getElementById('rd-prompt-ok').onclick=ok;
  if(inp){
    inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); ok(); } };
    setTimeout(()=>{ inp.focus(); inp.select(); }, 60);
  }
}

// ══════════════════════════════════════════════════
//  MÓDULO 6 — NOTIFICAÇÕES WHATSAPP
// ══════════════════════════════════════════════════
function getPortalLinkCliente(nomeCliente){
  const clientes=JSON.parse(ls('fluxa_clientes_full')||'[]');
  const cli=clientes.find(c=>(c.nome||'').toLowerCase()===nomeCliente.toLowerCase());
  if(!cli||!cli.portal_token) return '';
  return window.location.origin+window.location.pathname+'#portal/'+cli.portal_token;
}

function aplicarVars(template, vars, lojaId){
  // Usa o branding da loja específica quando informado (multi-loja), senão o global
  const LC = lojaId ? getLojaConfig(lojaId) : null;
  const empresa = (LC&&LC.nome) || CFG.nome || '';
  const tel = (LC&&LC.tel) || CFG.tel || '';
  return template
    .replace(/\{nome\}/g, vars.nome||'')
    .replace(/\{hora\}/g, vars.hora||'')
    .replace(/\{tecnico\}/g, vars.tecnico||'')
    .replace(/\{servico\}/g, vars.servico||'')
    .replace(/\{valor\}/g, vars.valor||'')
    .replace(/\{link_portal\}/g, vars.link_portal||'')
    .replace(/\{empresa\}/g, empresa)
    .replace(/\{tel_empresa\}/g, tel);
}

function notifVisita(os){
  const template=CFG.notif_visita||CFG_DEF.notif_visita;
  const vars={
    nome:(os.cliente||'').split(' ')[0],
    hora:os.hora||'',
    tecnico:os.tecnico||'',
    servico:(os.servicos||[]).join(', '),
    link_portal:getPortalLinkCliente(os.cliente||'')
  };
  return aplicarVars(template, vars, os.loja_id);
}

function notifConcluida(os){
  const template=CFG.notif_concluida||CFG_DEF.notif_concluida;
  const vars={
    nome:(os.cliente||'').split(' ')[0],
    tecnico:os.tecnico||'',
    servico:(os.servicos||[]).join(', '),
    link_portal:getPortalLinkCliente(os.cliente||'')
  };
  return aplicarVars(template, vars, os.loja_id);
}

function notifOrcamento(orc){
  const template=CFG.notif_orcamento||CFG_DEF.notif_orcamento;
  const svcs=(orc.servicos||[]).map(s=>s.desc||s).join(', ');
  const vars={
    nome:(orc.cliente||'').split(' ')[0],
    servico:svcs,
    valor:brl(orc.total||0),
    link_portal:getPortalLinkCliente(orc.cliente||'')
  };
  return aplicarVars(template, vars, orc.loja_id);
}

function notifGarantia(eq){
  const template=CFG.notif_garantia||CFG_DEF.notif_garantia;
  const vars={
    nome:(eq.cliente_nome||'').split(' ')[0],
    servico:(eq.marca||'')+' '+(eq.modelo||'')+' ('+eq.tipo+')'
  };
  return aplicarVars(template, vars, eq.loja_id);
}

function copiarNotif(msg){
  navigator.clipboard.writeText(msg).then(()=>toast('✅ Mensagem copiada!')).catch(()=>toast('✅ Copiado!'));
}

function enviarNotifWA(msg, telCliente){
  let tel=(telCliente||'').replace(/\D/g,'');
  if(!tel){ toast('⚠️ Cliente sem telefone cadastrado'); return; }
  if(!tel.startsWith('55')) tel='55'+tel;
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}


// ══════════════════════════════════════════════════
//  MÓDULO 5 — PORTAL DO CLIENTE
// ══════════════════════════════════════════════════
let portalCliente = null;
let portalDados = null;   // pacote da RPC portal_dados (cliente + orçamentos + OS + …)
let portalToken = null;   // token do portal em uso (para portal_responder_orcamento)

async function checkPortalHash(){
  const hash=window.location.hash;
  if(!hash.startsWith('#portal/')) return false;
  const token=hash.replace('#portal/','').trim();
  if(!token) return false;

  // Esconde tudo menos o portal
  document.getElementById('login-overlay').style.display='none';
  document.querySelector('.hdr').style.display='none';
  const mobNav=document.getElementById('mob-nav'); if(mobNav) mobNav.style.display='none';
  document.body.style.background='#f0f2f5';
  document.body.style.paddingTop='0';

  go('portal');

  // Conecta ao banco se não conectado (portal usa RPCs públicas — ver T11)
  if(!dbOk||!db){
    if(SUPABASE_URL!=='PREENCHER_DEPOIS') await conectarDB(SUPABASE_URL,SUPABASE_ANON_KEY,false);
  }

  // v2: o portal é público (anon). A RLS bloqueia queries diretas, então usamos a
  // RPC portal_dados(token) — que valida o token e devolve o pacote do cliente
  // (cliente + orçamentos + OS + vistorias + equipamentos). Nenhuma query direta aqui.
  portalToken = token;
  try{
    let bundle=null;
    if(dbOk&&db){
      const {data,error}=await db.rpc('portal_dados',{p_token:token});
      if(error) throw error;
      bundle=data;
    }
    if(!bundle || !bundle.cliente){ mostrarErroPortal(); return true; }
    portalCliente=bundle.cliente;
    portalDados=bundle;
    await renderPortal(bundle);
  }catch(e){ console.warn('[portal]', e?.message||e); mostrarErroPortal(); }
  return true;
}

function mostrarErroPortal(){
  document.getElementById('portal-loading').style.display='none';
  document.getElementById('portal-erro').style.display='block';
}

// Relatório de serviço no portal (Tarefa 3i.8, 19/08) — o portal não passa
// pelo boot normal que popula CFG (usa b.empresa.config direto, ver
// renderPortal abaixo), então preencherRelatorioOS()/getLojaConfig()
// precisam de CFG setado na hora só pra montar o branding do documento —
// sem isso o relatório sairia sem cor/logo/nome da empresa certos.
function verRelatorioPortalOS(osId){
  const os=(portalDados?.ordens_servico||[]).find(x=>x.id===osId);
  if(!os){ toast('Relatório não encontrado'); return; }
  const econf=(portalDados?.empresa?.config)||{};
  CFG={...CFG_DEF, ...econf};
  preencherRelatorioOS(os, 'cliente');
  imprimirDoc('ros');
}

async function renderPortal(bundle){
  // Aceita o pacote da RPC (portal_dados) ou, por compat, só o cliente.
  const b = (bundle && bundle.cliente) ? bundle : (portalDados || {cliente:bundle});
  const cli = b.cliente || {};
  document.getElementById('portal-loading').style.display='none';
  document.getElementById('portal-content').style.display='block';

  // v2: branding vem da empresa do pacote (portal é público, sem CFG carregado).
  const econf = (b.empresa && b.empresa.config) || {};
  document.getElementById('portal-empresa-nome').textContent = econf.appName || econf.nome || (b.empresa&&b.empresa.nome) || '';
  document.getElementById('portal-empresa-sub').textContent = econf.sub || '';
  const logo=document.getElementById('portal-logo');
  if(econf.logoB64){ logo.src=econf.logoB64; logo.classList.add('has-logo'); }
  document.getElementById('portal-cli-nome').textContent='Olá, '+(cli.nome||'')+' 👋';

  // Próxima visita — OS do pacote (sem query direta)
  let osCliente = Array.isArray(b.ordens_servico) ? b.ordens_servico : [];
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const futuras=osCliente.filter(o=>o.status==='agendado'&&o.data_servico&&new Date(o.data_servico+'T12:00:00')>=hoje).sort((a,b)=>new Date(a.data_servico)-new Date(b.data_servico));
  const secVisita=document.getElementById('portal-sec-visita');
  if(futuras.length){
    secVisita.style.display='block';
    const prox=futuras[0];
    const d=new Date(prox.data_servico+'T12:00:00');
    document.getElementById('portal-proxima-visita').innerHTML=`
      <div class="portal-visita">
        <div class="portal-visita-data">${d.getDate()}<div style="font-size:11px">${d.toLocaleDateString('pt-BR',{month:'short'})}</div></div>
        <div class="portal-visita-info">
          <div class="portal-visita-tipo">${esc((prox.servicos||[]).join(', ')||'Visita técnica')}</div>
          <div class="portal-visita-tec">👤 ${esc(prox.tecnico||'')} ${prox.hora?' · ⏰ '+prox.hora:''}</div>
        </div>
      </div>`;
  }

  // Histórico de OS
  const concluidas=osCliente.filter(o=>o.status==='concluido').sort((a,b)=>new Date(b.data_criacao)-new Date(a.data_criacao)).slice(0,5);
  const secOS=document.getElementById('portal-sec-os');
  if(concluidas.length){
    secOS.style.display='block';
    // Botão "Ver relatório" (Tarefa 3i.8, 19/08) — só quando
    // relatorio_enviado_em existe: portal_dados() só revela o CONTEÚDO do
    // relatório (checklist/materiais/obs/fotos) depois da revisão manual;
    // antes disso o portal não tem com o que montar o documento mesmo que
    // quisesse (allowlist condicional na própria RPC, não só aqui na UI).
    document.getElementById('portal-os-lista').innerHTML=concluidas.map(o=>`
      <div class="portal-os-item">
        <div class="portal-os-data">${o.data_servico?new Date(o.data_servico+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</div>
        <div class="portal-os-desc">${esc((o.servicos||[]).join(', ')||'Serviço')}</div>
        ${o.relatorio_enviado_em
          ?`<button class="tb" style="font-size:11px" onclick="verRelatorioPortalOS('${o.id}')">📄 Relatório</button>`
          :`<span class="os-badge os-concluido">✅</span>`}
      </div>`).join('');
  }

  // Orçamentos pendentes — do pacote (sem query direta)
  const orcsCliente=(Array.isArray(b.orcamentos)?b.orcamentos:[]).filter(o=>o.status==='pendente');
  const secOrc=document.getElementById('portal-sec-orc');
  if(orcsCliente.length){
    secOrc.style.display='block';
    document.getElementById('portal-orcs').innerHTML=orcsCliente.map(o=>`
      <div class="portal-orc-item">
        <div class="portal-orc-num">Orçamento #${String(o.numero||'').padStart(3,'0')}</div>
        <div class="portal-orc-svcs">${esc((o.servicos||[]).map(s=>s.desc).join(', '))}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:8px">
          <div class="portal-orc-total">${brl(o.total||0)}</div>
          <div style="display:flex;gap:6px">
            <button class="ba" style="background:var(--green);color:white;padding:7px 14px;font-size:12px" onclick="abrirModalAssinatura('${o.id}')">✅ Aprovar</button>
            <button class="ba" style="background:var(--red);color:white;padding:7px 14px;font-size:12px" onclick="recusarOrcPortal('${o.id}')">❌ Recusar</button>
          </div>
        </div>
      </div>`).join('');
  }

  // Equipamentos — do pacote (sem query direta)
  const eqCliente = Array.isArray(b.equipamentos) ? b.equipamentos : [];
  const secEq=document.getElementById('portal-sec-eq');
  if(eqCliente.length){
    secEq.style.display='block';
    const hoje2=new Date(); hoje2.setHours(0,0,0,0);
    const icons={Motobomba:'⚙️',Filtro:'🔵',Trocador:'🌡️','Gerador de Cloro':'🧪',Sauna:'♨️','Spa / Hidro':'🛁',Outro:'🔧'};
    document.getElementById('portal-eq-lista').innerHTML=eqCliente.map(eq=>{
      let gTxt='', gColor='var(--green)';
      if(eq.garantia_vencimento){
        const venc=new Date(eq.garantia_vencimento+'T12:00:00');
        const diff=Math.ceil((venc-hoje2)/(1000*60*60*24));
        if(diff<0){ gTxt='Garantia vencida'; gColor='var(--red)'; }
        else if(diff<=30){ gTxt=`Garantia vence em ${diff} dias`; gColor='var(--yellow)'; }
        else { gTxt=`Garantia até ${venc.toLocaleDateString('pt-BR')}`; }
      }
      return `<div class="portal-eq-item">
        <div class="portal-eq-tipo">${icons[eq.tipo]||'🔧'}</div>
        <div class="portal-eq-info">
          <div class="portal-eq-nome">${esc(eq.marca||'')} ${esc(eq.modelo||'')} <span style="font-size:11px;color:var(--gray)">${esc(eq.tipo||'')}</span></div>
          ${gTxt?`<div class="portal-eq-garantia" style="color:${gColor}">${gTxt}</div>`:''}
        </div>
      </div>`;
    }).join('');
  }
}

// ──────────────────────────────────────────────────
//  ASSINATURA DO CLIENTE (PORTAL)
// ──────────────────────────────────────────────────
function abrirModalAssinatura(orcId){
  const existing=document.getElementById('modal-assinatura'); if(existing) existing.remove();
  const m=document.createElement('div'); m.id='modal-assinatura'; m.className='cli-hist-overlay'; m.style.zIndex='1100';
  m.innerHTML=`<div class="cli-hist-box" style="max-height:none">
    <div class="cli-hist-hdr">
      <div class="cli-hist-titulo">✍️ Assinar Aprovação</div>
      <button class="cli-hist-close" onclick="document.getElementById('modal-assinatura').remove()">×</button>
    </div>
    <div style="padding:16px 20px 24px">
      <p style="font-size:13px;color:var(--gray);margin-bottom:12px">Assine abaixo para confirmar a aprovação deste orçamento. Sua assinatura será registrada.</p>
      <div class="sig-wrap">
        <canvas id="sig-canvas" class="sig-canvas"></canvas>
        <div class="sig-placeholder" id="sig-placeholder">✍️ Assine aqui com o dedo ou mouse</div>
      </div>
      <div class="sig-btns">
        <button class="sig-btn" onclick="limparAssinatura()">↺ Limpar</button>
        <button class="sig-btn ok" onclick="confirmarAssinatura('${orcId}')">✅ Confirmar Aprovação</button>
      </div>
    </div>
  </div>`;
  m.addEventListener('click',e=>{ if(e.target===m) m.remove(); });
  document.body.appendChild(m);
  setTimeout(initSigCanvas, 80);
}
function initSigCanvas(){
  const canvas=document.getElementById('sig-canvas'); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect();
  const dpr=window.devicePixelRatio||1;
  canvas.width=rect.width*dpr; canvas.height=130*dpr;
  canvas.style.height='130px';
  ctx.scale(dpr,dpr);
  ctx.strokeStyle='#1a1a2e'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.lineJoin='round';
  _sigDrawing=false; _sigHasMark=false;
  function pos(e){ const r=canvas.getBoundingClientRect(); const t=e.touches?e.touches[0]:e; return [(t.clientX-r.left),(t.clientY-r.top)]; }
  canvas.onmousedown=e=>{ _sigDrawing=true; const [x,y]=pos(e); ctx.beginPath(); ctx.moveTo(x,y); };
  canvas.onmousemove=e=>{ if(!_sigDrawing) return; const [x,y]=pos(e); ctx.lineTo(x,y); ctx.stroke(); _sigHasMark=true; const ph=document.getElementById('sig-placeholder'); if(ph) ph.style.opacity='0'; };
  canvas.onmouseup=()=>{ _sigDrawing=false; };
  canvas.onmouseleave=()=>{ _sigDrawing=false; };
  canvas.ontouchstart=e=>{ e.preventDefault(); _sigDrawing=true; const [x,y]=pos(e); ctx.beginPath(); ctx.moveTo(x,y); };
  canvas.ontouchmove=e=>{ e.preventDefault(); if(!_sigDrawing) return; const [x,y]=pos(e); ctx.lineTo(x,y); ctx.stroke(); _sigHasMark=true; const ph=document.getElementById('sig-placeholder'); if(ph) ph.style.opacity='0'; };
  canvas.ontouchend=()=>{ _sigDrawing=false; };
}
function limparAssinatura(){
  const canvas=document.getElementById('sig-canvas'); if(!canvas) return;
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height);
  _sigHasMark=false;
  const ph=document.getElementById('sig-placeholder'); if(ph) ph.style.opacity='1';
}
async function confirmarAssinatura(orcId){
  if(!_sigHasMark){ toast('⚠️ Por favor, assine antes de confirmar'); return; }
  const canvas=document.getElementById('sig-canvas'); if(!canvas) return;
  const sigB64=canvas.toDataURL('image/png');
  document.getElementById('modal-assinatura').remove();
  await aprovarOrcPortal(orcId, sigB64);
}

// ── Assinatura do técnico na vistoria ──────────────────────────────────
// Reusa o canvas genérico acima (initSigCanvas/limparAssinatura) sem tocar
// nele: o modal usa os MESMOS ids de canvas/placeholder, então só a
// confirmação precisa ser própria (a original é acoplada a aprovarOrcPortal).
let _visAssinaturaTecnico = null; // {base64,data,meta,nome}
function abrirModalAssinaturaVis(){
  document.getElementById('modal-assinatura')?.remove();
  const s=getSessao();
  const nomeTec=(document.getElementById('vis-tec')?.value||'')||(s?.nome||'técnico');
  const m=document.createElement('div');
  m.id='modal-assinatura'; m.className='cli-hist-overlay'; m.style.zIndex='1200';
  m.innerHTML=`<div class="cli-hist-box" style="max-height:none">
    <div class="cli-hist-hdr">
      <div class="cli-hist-titulo">✍️ Assinatura do Técnico</div>
      <button class="cli-hist-close" onclick="document.getElementById('modal-assinatura').remove()">×</button>
    </div>
    <div style="padding:16px 20px 24px">
      <p style="font-size:13px;color:var(--gray);margin-bottom:12px">Assine para confirmar que ${esc(nomeTec)} realizou esta vistoria no local.</p>
      <div class="sig-wrap">
        <canvas id="sig-canvas" class="sig-canvas"></canvas>
        <div class="sig-placeholder" id="sig-placeholder">✍️ Assine aqui com o dedo ou mouse</div>
      </div>
      <div class="sig-btns">
        <button class="sig-btn" onclick="limparAssinatura()">↺ Limpar</button>
        <button class="sig-btn ok" onclick="confirmarAssinaturaVis()">✅ Confirmar</button>
      </div>
    </div>
  </div>`;
  m.addEventListener('click',e=>{ if(e.target===m) m.remove(); });
  document.body.appendChild(m);
  setTimeout(initSigCanvas, 80);
}
function confirmarAssinaturaVis(){
  if(!_sigHasMark){ toast('⚠️ Por favor, assine antes de confirmar'); return; }
  const canvas=document.getElementById('sig-canvas'); if(!canvas) return;
  const sigB64=canvas.toDataURL('image/png');
  document.getElementById('modal-assinatura')?.remove();
  const s=getSessao();
  _visAssinaturaTecnico={
    base64: sigB64,
    data: new Date().toISOString(),
    meta: (navigator.userAgent||'').slice(0,180),
    nome: (document.getElementById('vis-tec')?.value||'')||(s?.nome||'')
  };
  renderVisAssinaturaStatus();
  _salvarRascunhoVisDeb();
  toast('✅ Assinatura registrada');
}
function renderVisAssinaturaStatus(){
  const el=document.getElementById('vis-assinatura-status'); if(!el) return;
  if(_visAssinaturaTecnico){
    let horaTxt='';
    try{ horaTxt=new Date(_visAssinaturaTecnico.data).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }catch(e){}
    el.innerHTML=`<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <img src="${_visAssinaturaTecnico.base64}" alt="Assinatura" style="height:44px;border:1px solid var(--gray-mid);border-radius:8px;background:#fff;padding:2px">
      <div style="flex:1;min-width:140px;font-size:12px;color:var(--green);font-weight:700">✍️ Assinado por ${esc(_visAssinaturaTecnico.nome||'')}${horaTxt?(' às '+horaTxt):''}</div>
      <button type="button" class="tb" onclick="abrirModalAssinaturaVis()" style="font-size:12px">Refazer</button>
    </div>`;
  } else {
    el.innerHTML=`<button type="button" class="btn-primary" style="padding:10px 18px;font-size:13px" onclick="abrirModalAssinaturaVis()">✍️ Assinar</button>`;
  }
}

// Hash SHA-256 do conteúdo essencial do orçamento — "impressão digital" do
// documento assinado. Recalcular depois e comparar prova se algo foi alterado.
async function _hashDocumentoOrc(o){
  const canonical=JSON.stringify({
    numero:o.numero, cliente:o.cliente||'', cnpj:o.cnpj||'', total:o.total||0,
    servicos:(o.servicos||[]).map(s=>({d:s.desc||s.d||'',q:s.qty||1,p:s.precoUnit||s.preco||0})),
    desconto:o.desconto||0, validade:o.validade_data||o.validade_dias||''
  });
  try{
    const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){ return null; }
}
// Verifica se o conteúdo atual do orçamento ainda bate com o hash assinado.
// Retorna: 'ok' | 'alterado' | 'sem_hash'
// v2: o portal é anon — usa a RPC portal_responder_orcamento (não pode dar update
// direto nem mexer no estoque). A RESERVA de estoque é disparada no app do GESTOR
// ao receber a atualização por realtime (ver iniciarRealtimeSync / T11 no CLAUDE.md).
async function aprovarOrcPortal(id, sigB64){
  if(!dbOk||!db||!portalToken){ toast('⚠️ Sem conexão com o servidor'); return; }
  const oAtual=(portalDados&&portalDados.orcamentos||[]).find(x=>x.id===id)||{};
  let assinatura=null;
  if(sigB64){
    assinatura={ base64:sigB64, hash:await _hashDocumentoOrc(oAtual), meta:(navigator.userAgent||'').slice(0,180) };
  }
  try{
    const {data:ok,error}=await db.rpc('portal_responder_orcamento',{p_token:portalToken, p_orc_id:id, p_aprovar:true, p_assinatura:assinatura});
    if(error) throw error;
    if(!ok){ toast('⚠️ Não foi possível aprovar (orçamento já respondido?).'); return; }
    if(portalDados&&portalDados.orcamentos) portalDados.orcamentos=portalDados.orcamentos.map(o=>o.id===id?{...o,status:'aprovado'}:o);
    await renderPortal(portalDados);
    toast('✅ Orçamento aprovado e assinado!');
  }catch(e){ console.warn('[aprovarOrcPortal]', e?.message||e); toast('Erro ao aprovar. Tente novamente.'); }
}

function recusarOrcPortal(id){
  confirmar('Recusar este orçamento?', ()=>_recusarOrcPortalConfirmado(id), 'Recusar Orçamento');
}
async function _recusarOrcPortalConfirmado(id){
  if(!dbOk||!db||!portalToken){ toast('⚠️ Sem conexão com o servidor'); return; }
  try{
    const {data:ok,error}=await db.rpc('portal_responder_orcamento',{p_token:portalToken, p_orc_id:id, p_aprovar:false});
    if(error) throw error;
    if(!ok){ toast('⚠️ Não foi possível recusar.'); return; }
    if(portalDados&&portalDados.orcamentos) portalDados.orcamentos=portalDados.orcamentos.map(o=>o.id===id?{...o,status:'recusado'}:o);
    await renderPortal(portalDados);
    toast('❌ Orçamento recusado');
  }catch(e){ console.warn('[recusarOrcPortal]', e?.message||e); toast('Erro ao recusar. Tente novamente.'); }
}

function abrirWAPortal(){
  let tel=(CFG.tel||'').replace(/\D/g,'');
  if(!tel){ toast('⚠️ Configure o telefone da empresa nas configurações'); return; }
  if(!tel.startsWith('55')) tel='55'+tel;
  const nome=portalCliente?portalCliente.nome:'Cliente';
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent('Olá! Sou '+nome+' e gostaria de falar com vocês.')}`, '_blank');
}


// ══════════════════════════════════════════════════
//  MÓDULO 4 — PRODUTIVIDADE POR TÉCNICO
// ══════════════════════════════════════════════════
function getPeriodoProd(){
  const p=gV('prod-periodo'), hoje=new Date(); hoje.setHours(23,59,59,999);
  let inicio=new Date();
  if(p==='mes'){ inicio=new Date(hoje.getFullYear(),hoje.getMonth(),1); }
  else if(p==='mes-ant'){ inicio=new Date(hoje.getFullYear(),hoje.getMonth()-1,1); hoje.setDate(0); }
  else if(p==='30d'){ inicio=new Date(); inicio.setDate(inicio.getDate()-30); }
  else if(p==='90d'){ inicio=new Date(); inicio.setDate(inicio.getDate()-90); }
  else if(p==='ano'){ inicio=new Date(hoje.getFullYear(),0,1); }
  inicio.setHours(0,0,0,0);
  return {inicio, fim:hoje};
}

function getPeriodoAntProd(){
  const p=gV('prod-periodo'), hoje=new Date();
  let inicio=new Date(), fim=new Date();
  if(p==='mes'){ inicio=new Date(hoje.getFullYear(),hoje.getMonth()-1,1); fim=new Date(hoje.getFullYear(),hoje.getMonth(),0); }
  else if(p==='30d'){ inicio=new Date(); inicio.setDate(inicio.getDate()-60); fim=new Date(); fim.setDate(fim.getDate()-30); }
  else if(p==='90d'){ inicio=new Date(); inicio.setDate(inicio.getDate()-180); fim=new Date(); fim.setDate(fim.getDate()-90); }
  else { return null; }
  inicio.setHours(0,0,0,0); fim.setHours(23,59,59,999);
  return {inicio, fim};
}

function osNoPeriodo(tec, ini, fim){
  const osLocal=filtrarPorLoja(JSON.parse(ls('fluxa_os_hist')||'[]'));
  return osLocal.filter(o=>{
    if(tec&&o.tecnico!==tec) return false;
    if(!o.data_criacao) return false;
    const d=new Date(o.data_criacao);
    return d>=ini&&d<=fim;
  });
}

function despNoPeriodo(tec, ini, fim){
  return filtrarPorLoja(todasDesp).filter(d=>{
    if(tec&&d.tecnico!==tec) return false;
    if(!d.data) return false;
    const dd=new Date(d.data+'T12:00:00');
    return dd>=ini&&dd<=fim;
  });
}

function metricasTec(tec, ini, fim){
  const os=osNoPeriodo(tec, ini, fim);
  const conc=os.filter(o=>o.status==='concluido');
  const canc=os.filter(o=>o.status==='cancelado');
  const taxa=os.length>0?Math.round(conc.length/os.length*100):0;
  const comTempo=conc.filter(o=>o.duracao_min>0);
  const tempoMed=comTempo.length>0?Math.round(comTempo.reduce((a,o)=>a+(o.duracao_min||0),0)/comTempo.length):0;
  const desp=despNoPeriodo(tec, ini, fim).reduce((a,d)=>a+(d.valor||0),0);
  const clientes=new Set(os.map(o=>o.cliente).filter(Boolean)).size;
  const faturamento=conc.reduce((a,o)=>a+(o.total||0),0); // fatura das OS concluídas do técnico
  // Mão de obra e margem estimada (Fase 24). Horas do duracao_min das OS
  // concluídas; margem = faturamento − mão de obra − despesas. Material NÃO
  // entra aqui (custo por OS exige os_materiais, caro de agregar) — por isso
  // "estimada"; a rentabilidade cheia por OS está no relatório Interno.
  const horas=conc.reduce((a,o)=>a+(parseFloat(o.duracao_min)||0),0)/60;
  const custoHora=getCustoHora();
  const custoMO=custoHora*horas;
  const margemEst = faturamento - custoMO - desp;
  return { total:os.length, conc:conc.length, canc:canc.length, taxa, tempoMed, desp, clientes, faturamento, horas, custoMO, margemEst, custoHoraDef:custoHora>0 };
}
// Config de comissão/metas (global, editável na tela de Produtividade)
function getComissaoPct(){ return parseFloat(ls('fluxa_comissao_pct')||'0')||0; }
function getMetaTec(){ return parseFloat(ls('fluxa_meta_tec')||'0')||0; }
function setComissaoPct(v){ lsSet('fluxa_comissao_pct', String(parseFloat(v)||0)); renderProd(); }
function setMetaTec(v){ lsSet('fluxa_meta_tec', String(parseFloat(v)||0)); renderProd(); }

// ── RENTABILIDADE / CUSTO-HORA (Fases 23-24) ────────────────────────────
// Faturamento não é lucro. O gestor precisa ver, por OS e por técnico, o que
// sobra depois de material, mão de obra e despesas — senão uma OS de R$2.000
// que consumiu R$1.700 parece ótima.
//
// Custo-hora é um número que o gestor configura (remuneração + encargos +
// veículo, rateados sobre a hora produtiva — a conta é dele; aqui é o valor
// final por hora). Guardado como config da empresa, igual à comissão.
function getCustoHora(){ return parseFloat(ls('fluxa_custo_hora')||'0')||0; }
function setCustoHora(v){ lsSet('fluxa_custo_hora', String(parseFloat(v)||0)); if(typeof renderProd==='function') renderProd(); }

// Custo de material de uma OS. Usa os_materiais já carregado no relatório
// (_materiaisRelatorio: qtd × custo_unit); sem isso, cai no custo congelado do
// orçamento vinculado (servicos[].custo_total). Retorna null quando não há
// NENHUM sinal de custo — pra não fingir margem cheia sobre custo desconhecido.
function _osCustoMaterial(os, orc){
  const mats=os && Array.isArray(os._materiaisRelatorio) ? os._materiaisRelatorio : null;
  if(mats && mats.length) return {valor: mats.reduce((a,m)=>a+(m.qtd||0)*(m.custo_unit||0),0), fonte:'materiais'};
  if(orc && Array.isArray(orc.servicos)){
    const c=orc.servicos.reduce((a,x)=>a+(parseFloat(x.custo_total)||0),0);
    if(c>0) return {valor:c, fonte:'orcamento'};
  }
  return null;
}
// Rentabilidade de UMA OS. horas do duracao_min; mão de obra = custo_hora×horas.
function _osRentabilidade(os, orc){
  const receita = parseFloat(os?.total)||0;
  const mat=_osCustoMaterial(os, orc);
  const material = mat?mat.valor:0;
  const horas = (parseFloat(os?.duracao_min)||0)/60;
  const custoHora=getCustoHora();
  const maoObra = custoHora>0 ? custoHora*horas : 0;
  const lucro = receita - material - maoObra;
  return {
    receita, material, materialFonte: mat?mat.fonte:null, materialConhecido: !!mat,
    horas, custoHora, maoObra,
    lucro, margemPct: receita>0 ? lucro/receita*100 : null
  };
}

async function loadProdutividade(){
  // Popula select de técnicos
  const el=document.getElementById('prod-filtro-tec'); if(!el) return;
  const tecs=getTecnicos();
  el.innerHTML='<option value="">Todos os técnicos</option>'+tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  // Carrega OS do Supabase se disponível
  // fix #E: não sobrescrever o cache inteiro — fazer merge para preservar OS de outras lojas no cache local
  if(dbOk&&db){
    try{
      let qProd=db.from('ordens_servico').select('*').eq('empresa_id',EMPRESA_ID).order('data_criacao',{ascending:false}).limit(500);
      if(lojaAtiva) qProd=qProd.eq('loja_id',lojaAtiva);
      const {data}=await qProd;
      if(data&&data.length){
        const local=JSON.parse(ls('fluxa_os_hist')||'[]');
        // Merge: remotas prevalecem, locais de outras lojas são preservadas
        const merged=[...data];
        local.forEach(l=>{ if(!merged.find(r=>r.id===l.id)) merged.push(l); });
        lsSet('fluxa_os_hist',JSON.stringify(merged.slice(0,600)));
      }
    }catch(e){ console.warn('[loadProdutividade]', e?.message||e); }
  }
  renderProd();
  renderRelatorioFinanceiro();
  renderContasReceber();
}

// ── CONTAS A RECEBER ──
// Consolida os orçamentos aprovados com saldo em aberto (total − recebido).
// ══════════════════════════════════════════════════
//  A RECEBER — por parcela
// ══════════════════════════════════════════════════
// Um número só ("valor_recebido") responde "quanto falta", mas não responde
// "quando vence" nem "está atrasado há quanto tempo" — que é o que faz alguém
// correr atrás da cobrança. Cada parcela é uma linha própria.
//
// ⚠️ SÓ PRA FRENTE: orçamento sem NENHUMA parcela lançada continua usando
// valor_recebido exatamente como antes (o fallback em _orcSaldoAReceber).
// Nada existente muda de comportamento; migrar os antigos exigiria inventar
// vencimento pra dívida que nunca teve um.
let todosReceb = [];
const LS_RECEB = 'fluxa_recebimentos';
function lsRecebLer(){ try{ return JSON.parse(ls(LS_RECEB)||'[]'); }catch(e){ return []; } }
function lsRecebSalvar(l){ try{ lsSet(LS_RECEB, JSON.stringify(l)); }catch(e){ console.warn('[lsReceb]', e?.message||e); } }

// Carrega uma vez por sessão quando alguma tela financeira precisa do número.
// Sem isso o dashboard cairia no modelo antigo e mostraria um total diferente
// do da tela de A Receber — dois números pro mesmo dinheiro.
let _recebCarregado=false;
function _recebGarantirCarregado(){
  if(_recebCarregado || eVendas() || eTecnico()) return;
  _recebCarregado=true;
  Promise.resolve(loadRecebimentos()).then(()=>{ atualizarDash(); }).catch(e=>{ _recebCarregado=false; console.warn('[receb load]', e?.message||e); });
}
async function loadRecebimentos(){
  todosReceb = lsRecebLer();
  if(!(dbOk&&db&&EMPRESA_ID)) return todosReceb;
  try{
    const {data,error}=await db.from('recebimentos').select('*').eq('empresa_id',EMPRESA_ID);
    if(error) throw error;
    const remotoIds=new Set((data||[]).map(r=>r.id));
    // Preserva parcela criada offline que ainda não subiu (mesmo padrão das
    // outras tabelas) e reenvia.
    const soLocal=todosReceb.filter(r=>!remotoIds.has(r.id) && String(r.id).startsWith('rec_'));
    todosReceb=[...(data||[]), ...soLocal];
    lsRecebSalvar(todosReceb);
    soLocal.forEach(r=>{ dbInsert('recebimentos', r).catch(e=>console.warn('[receb reenvio]', e?.message||e)); });
  }catch(e){ console.warn('[loadRecebimentos]', e?.message||e); }
  return todosReceb;
}

function _recebDoOrc(orcId){ return (todosReceb||[]).filter(r=>String(r.orcamento_id)===String(orcId)); }

// Saldo a receber DE UM ORÇAMENTO. Nunca soma as duas fontes pro mesmo
// orçamento: se há parcela lançada, ela é a verdade (valor_recebido para de
// ser atualizado a partir daí); se não há nenhuma, cai no modelo antigo.
function _orcSaldoAReceber(o){
  if(!o || o.status!=='aprovado') return 0;
  const parcelas=_recebDoOrc(o.id);
  if(parcelas.length) return parcelas.filter(r=>!r.data_pagamento).reduce((a,r)=>a+(parseFloat(r.valor)||0),0);
  return Math.max(0,(parseFloat(o.total)||0)-(parseFloat(o.valor_recebido)||0));
}
// Aprovado que ainda não teve NENHUMA cobrança formalizada. É o buraco que o
// modelo antigo escondia: sem parcela e sem recebimento, o dinheiro some do
// radar sem nunca aparecer como atrasado.
function _orcAprovadosSemReceb(){
  return filtrarPorLoja(todosOrc)
    .filter(o=>o.status==='aprovado' && !_recebDoOrc(o.id).length && _orcSaldoAReceber(o)>0.005);
}

// Prazo médio de recebimento: quantos dias, em média, o dinheiro leva pra
// entrar depois de vencer. Só conta parcela PAGA (sem data de pagamento não há
// prazo a medir) e devolve null quando não há nenhuma — mostrar "0 dias" com
// zero parcela paga faria parecer que a empresa recebe à vista.
function _recebPMR(parcelas){
  const pagas=(parcelas||[]).filter(r=>r.data_pagamento && r.vencimento);
  if(!pagas.length) return null;
  const soma=pagas.reduce((a,r)=>{
    const v=new Date(r.vencimento+'T12:00:00'), p=new Date(r.data_pagamento+'T12:00:00');
    return a+Math.round((p-v)/86400000);
  },0);
  return {dias: soma/pagas.length, n: pagas.length};
}
function _recebDiasAtraso(r){
  if(r.data_pagamento || !r.vencimento) return 0;
  const hoje=new Date(_hojeLocal()+'T12:00:00');
  const venc=new Date(r.vencimento+'T12:00:00');
  return Math.floor((hoje-venc)/86400000);
}
function _recebFaixaAging(r){
  const d=_recebDiasAtraso(r);
  if(d<=0) return 'avencer';
  if(d<=15) return 'd1';
  if(d<=30) return 'd16';
  return 'd30';
}
const _RECEB_FAIXAS=[
  {id:'avencer', lbl:'A vencer',  cor:'var(--ok)'},
  {id:'d1',      lbl:'1 a 15d',   cor:'var(--warn)'},
  {id:'d16',     lbl:'16 a 30d',  cor:'var(--warn)'},
  {id:'d30',     lbl:'+30d',      cor:'var(--bad)'}
];

// Cria as parcelas de um orçamento aprovado. Idempotente por orçamento —
// nunca duplica se chamado de novo (ex.: aprovar → reverter → aprovar).
async function _recebCriarParcelas(orcId, {n=1, primeiroVenc, intervaloDias=30, forma='', origem='aprovacao'}={}){
  const o=todosOrc.find(x=>x.id===orcId); if(!o) return 0;
  if(_recebDoOrc(orcId).length) return 0;
  const total=parseFloat(o.total)||0;
  if(total<=0) return 0;
  const qtd=Math.max(1,parseInt(n)||1);
  // Centavos por parcela sem perder o resto: a diferença de arredondamento vai
  // toda pra ÚLTIMA parcela, senão a soma das parcelas não bate com o total.
  const base=Math.floor((total/qtd)*100)/100;
  const base0=new Date((primeiroVenc||_hojeLocal())+'T12:00:00');
  const novas=[];
  for(let i=0;i<qtd;i++){
    const venc=new Date(base0); venc.setDate(venc.getDate()+i*intervaloDias);
    const valor = i===qtd-1 ? +(total-base*(qtd-1)).toFixed(2) : base;
    novas.push({
      id:'rec_'+Date.now()+'_'+i, orcamento_id:orcId, loja_id:o.loja_id||lojaAtiva||LOJA_PADRAO_ID,
      parcela_n:i+1, parcelas_total:qtd,
      vencimento: venc.toISOString().slice(0,10),
      valor, data_pagamento:null, forma:forma||null, obs:null, origem
    });
  }
  todosReceb=[...todosReceb, ...novas]; lsRecebSalvar(todosReceb);
  if(dbOk&&db){
    for(const r of novas){ try{ await dbInsert('recebimentos', r); }catch(e){ console.warn('[recebCriar]', e?.message||e); } }
  }
  return novas.length;
}

async function _recebMarcarPago(id, pago){
  const r=todosReceb.find(x=>x.id===id); if(!r) return;
  const data = pago ? _hojeLocal() : null;
  r.data_pagamento=data; lsRecebSalvar(todosReceb);
  renderContasReceber();
  if(dbOk&&db){
    try{ const res=await dbUpdate('recebimentos', {data_pagamento:data}, 'id', id);
      if(res?.error) throw res.error;
    }catch(e){ console.warn('[recebPago]', e?.message||e); toast('⚠️ Não sincronizou — verifique a conexão'); }
  }
  toast(pago?'✅ Recebimento registrado':'↩ Recebimento desfeito');
}

// Modal "Como vai receber?" — aparece na aprovação. "Decidir depois" é opção
// legítima: melhor não lançar nada do que lançar vencimento inventado (o
// orçamento aparece no card de "sem cobrança lançada" até alguém decidir).
function abrirModalReceb(orcId){
  const o=todosOrc.find(x=>x.id===orcId); if(!o) return;
  if(_recebDoOrc(orcId).length){ toast('Este orçamento já tem cobrança lançada'); return; }
  abrirModal({id:'receb-modal-bg', corpo:`
    <h3>Como vai receber?</h3>
    <p class="rd-modal-sub">${esc(o.cliente||'—')} · ${brl(o.total||0)}</p>
    <div class="rd-field"><label class="rd-field-lbl">Parcelas</label>
      <div class="rd-field-box"><input type="number" id="receb-n" min="1" max="24" value="1" style="width:100%"></div></div>
    <div class="rd-field"><label class="rd-field-lbl">Primeiro vencimento</label>
      <div class="rd-field-box"><input type="date" id="receb-venc" value="${_hojeLocal()}" style="width:100%"></div></div>
    <div class="rd-field"><label class="rd-field-lbl">Forma</label>
      <div class="rd-field-box"><select id="receb-forma" style="width:100%">
        <option value="">—</option><option>Pix</option><option>Cartão</option><option>Dinheiro</option><option>Boleto</option><option>Transferência</option>
      </select></div></div>
    <div class="rd-modal-acts">
      <button class="rd-modal-btn rd-modal-btn-nao" onclick="fecharModalGenerico('receb-modal-bg')">Decidir depois</button>
      <button class="rd-modal-btn rd-modal-btn-sim" onclick="_recebConfirmarModal('${orcId}')">Lançar cobrança</button>
    </div>`});
}
async function _recebConfirmarModal(orcId){
  const n=parseInt(gV('receb-n'))||1;
  const venc=gV('receb-venc')||_hojeLocal();
  const forma=gV('receb-forma')||'';
  fecharModalGenerico('receb-modal-bg');
  const criadas=await _recebCriarParcelas(orcId,{n, primeiroVenc:venc, forma});
  if(criadas) toast(`✅ ${criadas} parcela${criadas!==1?'s':''} lançada${criadas!==1?'s':''}`);
  renderContasReceber();
}

// ══════════════════════════════════════════════════
//  BAIXA RÁPIDA DE MATERIAL
// ══════════════════════════════════════════════════
// O estoque só registra bem o que ENTRA. Material consumido em serviço sai
// pela OS (quando alguém lembra de lançar) e o resto — venda de balcão avulsa,
// quebra, uso interno — não tinha caminho nenhum. Aqui sai em 3 toques, de
// qualquer tela, sem depender de orçamento nem de OS.
//
// O MOTIVO é obrigatório porque as saídas não são todas iguais: sem ele,
// "saiu 3 cloros" não diz se a empresa ganhou (venda) ou perdeu (quebra) —
// e o ref grava isso de forma consultável depois.
const BAIXA_MOTIVOS=[
  {id:'venda',       nome:'💰 Venda',          cor:'var(--ok)',   pedeValor:true,  desc:'Vendido ao cliente — gera receita e entra na lista de compras'},
  {id:'uso_servico', nome:'🔧 Uso em serviço', cor:'var(--c1)',   pedeValor:false, desc:'Consumido numa manutenção/OS'},
  {id:'perda',       nome:'🗑️ Perda / avaria', cor:'var(--bad)',  pedeValor:false, desc:'Quebra, vencimento ou extravio'},
  {id:'uso_interno', nome:'🏠 Uso interno',    cor:'var(--gray)', pedeValor:false, desc:'Consumo da própria empresa'}
];
let _baixaProdId=null, _baixaMotivo='venda';

// De qual unidade o material sai. Com uma unidade ativa, é ela; com "Todas"
// selecionado, é a unidade DO PRÓPRIO PRODUTO — que é a resposta certa, não um
// palpite (registrarMovimento já usa esse mesmo fallback). Bloquear aqui, como
// o v1 faz, travaria a baixa pra sempre num tenant que ainda não cadastrou
// nenhuma unidade.
function _baixaLoja(){
  return lojaAtiva || produtoById(_baixaProdId)?.loja_id || LOJA_PADRAO_ID || '';
}
// Só avisa quando a unidade não veio da seleção do topo E existe mais de uma —
// aí vale mostrar de onde o material vai sair antes de confirmar.
function _baixaLojaAmbigua(){
  const lojas=(typeof LOJAS!=='undefined'&&LOJAS)?LOJAS:[];
  return !lojaAtiva && lojas.length>1;
}

function abrirBaixaRapida(produtoId){
  _baixaProdId=produtoId||null; _baixaMotivo='venda';
  setV('baixa-busca',''); setV('baixa-qtd',''); setV('baixa-valor',''); setV('baixa-ref','');
  const sug=document.getElementById('baixa-sugestoes'); if(sug) sug.innerHTML='';
  const form=document.getElementById('baixa-form'); if(form) form.style.display=_baixaProdId?'':'none';
  const res=document.getElementById('baixa-resumo'); if(res) res.innerHTML='';
  _baixaRenderMotivos();
  if(_baixaProdId) _baixaSelecionar(_baixaProdId);
  document.getElementById('baixa-modal-bg')?.classList.add('on');
  if(!_baixaProdId) setTimeout(()=>document.getElementById('baixa-busca')?.focus(), 80);
}
function fecharBaixaRapida(){ document.getElementById('baixa-modal-bg')?.classList.remove('on'); }

function baixaBuscar(termo){
  const el=document.getElementById('baixa-sugestoes'); if(!el) return;
  const t=(termo||'').trim().toLowerCase();
  if(t.length<2){ el.innerHTML=''; return; }
  const achados=produtosVisiveis().filter(p=>
    (p.nome||'').toLowerCase().includes(t) || (p.codigo||'').toLowerCase().includes(t)
  ).slice(0,8);
  if(!achados.length){ el.innerHTML='<div style="font-size:12px;color:var(--gray);padding:8px">Nenhum produto encontrado.</div>'; return; }
  el.innerHTML=achados.map(p=>{
    const disp=disponivelProduto(p.id);
    return `<button type="button" class="tb" style="display:block;width:100%;text-align:left;margin-bottom:5px;padding:9px 11px" onclick="_baixaSelecionar('${p.id}')">
      <div style="font-weight:700;color:var(--c2);font-size:12.5px">${esc(p.nome)}</div>
      <div style="font-size:11px;color:var(--gray)">${p.codigo?esc(p.codigo)+' · ':''}tem ${fmtQtd(disp)} ${esc(p.unidade||'un')}</div>
    </button>`;
  }).join('');
}
function _baixaSelecionar(pid){
  const p=produtoById(pid); if(!p) return;
  _baixaProdId=pid;
  const disp=disponivelProduto(pid);
  const el=document.getElementById('baixa-selecionado');
  if(el) el.innerHTML=`<strong style="color:var(--c2)">${esc(p.nome)}</strong><br>
     <span style="color:var(--gray)">Disponível agora: <strong>${fmtQtd(disp)} ${esc(p.unidade||'un')}</strong>${parseFloat(p.custo)>0?` · custo ${brl(parseFloat(p.custo))}`:''}</span>`;
  const sug=document.getElementById('baixa-sugestoes'); if(sug) sug.innerHTML='';
  setV('baixa-busca', p.nome);
  const form=document.getElementById('baixa-form'); if(form) form.style.display='';
  _baixaAplicarMotivo();
  baixaAtualizarResumo();
  setTimeout(()=>document.getElementById('baixa-qtd')?.focus(), 60);
}
function _baixaRenderMotivos(){
  const el=document.getElementById('baixa-motivos'); if(!el) return;
  el.innerHTML=BAIXA_MOTIVOS.map(m=>{
    const on=_baixaMotivo===m.id;
    return `<button type="button" class="tb" title="${esc(m.desc)}" onclick="baixaSetMotivo('${m.id}')"
      style="font-size:11.5px;padding:8px 10px;${on?`background:${m.cor};color:#fff;border-color:${m.cor};font-weight:700`:''}">${m.nome}</button>`;
  }).join('');
}
// Extraída porque precisa rodar TAMBÉM ao abrir: o motivo inicial é "venda"
// (que pede valor) e, sem isto, o campo só aparecia se a pessoa trocasse de
// motivo e voltasse.
function _baixaAplicarMotivo(){
  const cfg=BAIXA_MOTIVOS.find(m=>m.id===_baixaMotivo);
  const wrap=document.getElementById('baixa-valor-wrap');
  if(wrap) wrap.style.display=cfg?.pedeValor?'':'none';
  if(cfg?.pedeValor && !gV('baixa-valor')){
    const p=produtoById(_baixaProdId);
    if(p && parseFloat(p.preco_venda)>0) setV('baixa-valor', String(parseFloat(p.preco_venda)).replace('.',','));
  }
}
function baixaSetMotivo(id){ _baixaMotivo=id; _baixaRenderMotivos(); _baixaAplicarMotivo(); baixaAtualizarResumo(); }
function baixaAtualizarResumo(){
  const el=document.getElementById('baixa-resumo'); if(!el) return;
  const p=produtoById(_baixaProdId); if(!p){ el.innerHTML=''; return; }
  const qtd=parseFloat((gV('baixa-qtd')||'').replace(',','.'))||0;
  const disp=disponivelProduto(_baixaProdId);
  const cfg=BAIXA_MOTIVOS.find(m=>m.id===_baixaMotivo);
  let txt='';
  if(qtd>0){
    txt=`Vai sair <strong>${fmtQtd(qtd)} ${esc(p.unidade||'un')}</strong> · saldo depois: <strong>${fmtQtd(disp-qtd)}</strong>`;
    // Negativo NÃO bloqueia: no modelo "vende e depois compra" é justamente o
    // que joga o item na lista de compras. Mas avisa, pra não passar batido.
    if(disp-qtd<0) txt+=` <span style="color:var(--warn);font-weight:700">— fica negativo e entra na lista de compras</span>`;
    if(_baixaLojaAmbigua()){
      const nomeLoja=(typeof getLojaNome==='function')?getLojaNome(_baixaLoja()):_baixaLoja();
      if(nomeLoja) txt+=`<br><span style="color:var(--gray)">Sai da unidade <strong>${esc(nomeLoja)}</strong> (a do produto)</span>`;
    }
    if(cfg?.pedeValor){
      const v=parseFloat((gV('baixa-valor')||'').replace(',','.'))||0;
      if(v>0){
        const total=v*qtd, custo=(parseFloat(p.custo)||0)*qtd;
        txt+=`<br>Venda: <strong>${brl(total)}</strong>`+(custo>0?` · margem: <strong style="color:${total-custo>=0?'var(--ok)':'var(--bad)'}">${brl(total-custo)}</strong>`:'');
      }
    }
  }
  el.innerHTML=txt;
}
function confirmarBaixaRapida(){
  const p=produtoById(_baixaProdId);
  if(!p){ toast('⚠️ Escolha o produto'); return; }
  const qtd=parseFloat((gV('baixa-qtd')||'').replace(',','.'))||0;
  if(qtd<=0){ toast('⚠️ Informe a quantidade'); document.getElementById('baixa-qtd')?.focus(); return; }
  const loja=_baixaLoja();
  const cfg=BAIXA_MOTIVOS.find(m=>m.id===_baixaMotivo)||BAIXA_MOTIVOS[0];
  const ref=(gV('baixa-ref')||'').trim();
  const valor=cfg.pedeValor?(parseFloat((gV('baixa-valor')||'').replace(',','.'))||0):0;
  const motivoTxt=[cfg.nome.replace(/^\S+\s/,''), ref?('— '+ref):'', valor>0?`(${brl(valor*qtd)})`:''].filter(Boolean).join(' ');
  const btn=document.getElementById('baixa-btn');
  if(btn){ btn.disabled=true; btn.textContent='Registrando…'; }
  registrarMovimento({
    produto_id:_baixaProdId, tipo:'saida', quantidade:-Math.abs(qtd),
    custo_unit:parseFloat(p.custo)||0,
    motivo:motivoTxt,
    ref:'baixa:'+cfg.id,   // permite filtrar por tipo de saída depois
    lojaId:loja
  });
  if(btn){ btn.disabled=false; btn.textContent='Confirmar baixa'; }
  fecharBaixaRapida();
  if(typeof renderEstoque==='function' && document.getElementById('page-estoque')?.classList.contains('on')) renderEstoque();
  toast(`✅ Baixa de ${fmtQtd(qtd)} ${p.unidade||'un'} — ${cfg.nome.replace(/^\S+\s/,'')}`);
}

// ══════════════════════════════════════════════════
//  DRE POR UNIDADE
// ══════════════════════════════════════════════════
// "Receita − despesa" responde SE o mês fechou no azul. O DRE responde POR
// QUÊ: separa o custo do que foi vendido (varia com a venda) das despesas de
// operar (não variam), e expõe a margem de contribuição — quanto sobra de
// cada venda antes do custo fixo. É o número que distingue "vendi barato" de
// "minha estrutura é cara demais".
//
// Não tem linha de mão de obra: o Fluxa não registra custo/hora de técnico
// em lugar nenhum. Inventar um número aqui daria um resultado bonito e falso.
function _dreMesesDisponiveis(){
  const set=new Set();
  (todosOrc||[]).forEach(o=>{
    if(o.status!=='aprovado') return;
    const d=o.data_aprovacao||o.data_criacao; if(!d) return;
    set.add(String(d).slice(0,7));
  });
  (todasDesp||[]).forEach(x=>{ const m=_despCompetencia(x); if(m) set.add(m); });
  set.add(_hojeLocal().slice(0,7));
  return [...set].filter(Boolean).sort().reverse().slice(0,24);
}
function _dreCalcular(mes, lojas){
  const dentro = lj => lojas.includes(lj||'') || (!lj && lojas.length>0);
  // Receita reconhecida no mês da APROVAÇÃO — é quando a venda aconteceu.
  // Orçamento feito em julho e fechado em agosto é receita de agosto.
  const receita=(todosOrc||[]).filter(o=>{
    if(o.status!=='aprovado' || !dentro(o.loja_id)) return false;
    const d=o.data_aprovacao||o.data_criacao;
    return d && String(d).slice(0,7)===mes;
  }).reduce((a,o)=>a+(parseFloat(o.total)||0),0);

  // Custo do que saiu por venda, com o custo congelado no dia — não o custo
  // médio de hoje (senão o resultado de um mês fechado mudaria sozinho toda
  // vez que o preço de compra mudasse).
  const custoDireto=(todosMovEstoque||[]).filter(m=>
    m.tipo==='saida' && String(m.ref||'').startsWith('baixa:orc:') &&
    dentro(m.loja_id) && String(m.data||'').slice(0,7)===mes
  ).reduce((a,m)=>a+Math.abs(parseFloat(m.quantidade)||0)*(parseFloat(m.custo_unit)||0),0);

  // Baixa avulsa marcada como VENDA também é custo de venda — sai da mesma
  // lógica, só não passou por orçamento.
  const custoBalcao=(todosMovEstoque||[]).filter(m=>
    m.tipo==='saida' && String(m.ref||'')==='baixa:venda' &&
    dentro(m.loja_id) && String(m.data||'').slice(0,7)===mes
  ).reduce((a,m)=>a+Math.abs(parseFloat(m.quantidade)||0)*(parseFloat(m.custo_unit)||0),0);

  // Despesa pela COMPETÊNCIA, não pela data de pagamento.
  const desp=(todasDesp||[]).filter(x=>dentro(x.loja_id) && _despCompetencia(x)===mes);
  const soma=l=>l.reduce((a,x)=>a+(parseFloat(x.valor)||0),0);
  const campo    = soma(desp.filter(x=>(x.natureza||'campo')==='campo'));
  const empresa  = desp.filter(x=>(x.natureza||'campo')==='empresa');
  const variavel = soma(empresa.filter(x=>_despFixaOuVariavel(x.tipo)!=='fixa'));
  const fixo     = soma(empresa.filter(x=>_despFixaOuVariavel(x.tipo)==='fixa'));

  const cpv = custoDireto+custoBalcao;
  const margemContrib = receita - cpv - campo - variavel;
  const resultado = margemContrib - fixo;
  return {receita, cpv, campo, variavel, fixo, margemContrib, resultado,
    margemPct: receita? (margemContrib/receita*100) : null,
    resultadoPct: receita? (resultado/receita*100) : null};
}
function renderDRE(){
  const sel=document.getElementById('dre-mes'); if(!sel) return;
  const meses=_dreMesesDisponiveis();
  if(!sel.options.length || sel.dataset.n!==String(meses.length)){
    const atual=sel.value;
    sel.innerHTML=meses.map(m=>{
      const [y,mm]=m.split('-');
      const rot=new Date(parseInt(y),parseInt(mm)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
      return `<option value="${m}">${rot}</option>`;
    }).join('');
    sel.dataset.n=String(meses.length);
    if(atual && meses.includes(atual)) sel.value=atual;
  }
  const mes=sel.value||meses[0];

  // Só as unidades que o usuário enxerga agora (respeita o seletor do topo).
  const visiveis=((typeof LOJAS!=='undefined'?LOJAS:[])||[]).filter(l=>
    lojaAtiva ? l.id===lojaAtiva : filtrarPorLoja([{loja_id:l.id}]).length>0);
  const cols=visiveis.map(l=>({id:l.id, nome:l.nome, d:_dreCalcular(mes,[l.id])}));
  const total={nome:'Total', d:_dreCalcular(mes, visiveis.map(l=>l.id))};
  const mostrarTotal=cols.length>1;

  const linha=(rot, campo, o={})=>{
    const cel=d=>{
      const v=d[campo];
      if(v===null||v===undefined) return '<td style="text-align:right;color:var(--gray)">—</td>';
      const cor=o.neg?'var(--bad)':(o.destaque?(v>=0?'var(--ok)':'var(--bad)'):'var(--c2)');
      const txt=o.pct?(v.toFixed(1).replace('.',',')+'%'):((o.neg&&v>0?'− ':'')+brl(Math.abs(v)));
      return `<td style="text-align:right;color:${cor};${o.destaque?'font-weight:800;':''}font-variant-numeric:tabular-nums">${txt}</td>`;
    };
    return `<tr${o.borda?' style="border-top:2px solid var(--gray-mid)"':''}>
      <td style="${o.destaque?'font-weight:800':'font-weight:600'};${o.recuo?'padding-left:16px;font-weight:400;color:var(--gray)':''}">${esc(rot)}</td>
      ${cols.map(c=>cel(c.d)).join('')}${mostrarTotal?cel(total.d):''}</tr>`;
  };

  const el=document.getElementById('dre-corpo'); if(!el) return;
  if(!cols.length){ el.innerHTML='<div style="padding:18px;text-align:center;color:var(--gray);font-size:13px">Nenhuma unidade cadastrada.</div>'; return; }
  el.innerHTML=`
  <div style="overflow-x:auto">
   <table class="fin-tabela" style="width:100%;min-width:${260+cols.length*110}px">
    <thead><tr>
      <th style="text-align:left">Conta</th>
      ${cols.map(c=>`<th style="text-align:right">${esc(c.nome)}</th>`).join('')}
      ${mostrarTotal?'<th style="text-align:right">Total</th>':''}
    </tr></thead>
    <tbody>
      ${linha('Receita reconhecida','receita')}
      ${linha('Custo do que foi vendido','cpv',{neg:true,recuo:true})}
      ${linha('Despesa de campo','campo',{neg:true,recuo:true})}
      ${linha('Despesa variável','variavel',{neg:true,recuo:true})}
      ${linha('Margem de contribuição','margemContrib',{destaque:true,borda:true})}
      ${linha('% sobre a receita','margemPct',{pct:true,recuo:true})}
      ${linha('Despesa fixa','fixo',{neg:true,recuo:true})}
      ${linha('Resultado','resultado',{destaque:true,borda:true})}
      ${linha('% sobre a receita','resultadoPct',{pct:true,recuo:true})}
    </tbody>
   </table>
  </div>
  <div style="font-size:11px;color:var(--gray);margin-top:10px;line-height:1.5">
    Receita pelo mês da aprovação · despesa pela competência · custo do produto
    congelado no dia da venda. <strong>Não inclui mão de obra</strong> — o
    sistema não registra custo/hora de técnico.
  </div>`;
}

function renderContasReceber(){
  const tbody=document.getElementById('cr-tabela-body'); if(!tbody) return;
  const resumo=document.getElementById('cr-resumo');
  const agingEl=document.getElementById('cr-aging');
  const gapEl=document.getElementById('cr-gap');

  const aprov=filtrarPorLoja(todosOrc).filter(o=>o.status==='aprovado');
  const orcIds=new Set(aprov.map(o=>o.id));
  const parcelas=(todosReceb||[]).filter(r=>orcIds.has(r.orcamento_id));
  const abertas=parcelas.filter(r=>!r.data_pagamento);
  const pagas=parcelas.filter(r=>r.data_pagamento);

  // Soma os dois modelos, mas nunca o mesmo orçamento duas vezes:
  // _orcSaldoAReceber decide, por orçamento, qual fonte vale.
  const totalReceber=aprov.reduce((a,o)=>a+_orcSaldoAReceber(o),0);
  const vencido=abertas.filter(r=>_recebDiasAtraso(r)>0).reduce((a,r)=>a+(parseFloat(r.valor)||0),0);
  const totalRecebido=pagas.reduce((a,r)=>a+(parseFloat(r.valor)||0),0)
    + aprov.filter(o=>!_recebDoOrc(o.id).length).reduce((a,o)=>a+(parseFloat(o.valor_recebido)||0),0);

  if(resumo){
    resumo.innerHTML=`
      <div class="rd-card rd-card-dense">
        <div class="rd-kpi-lbl"><span class="rd-badge rd-badge-bad">A receber</span></div>
        <div class="rd-kpi-num rd-kpi-num-sm" style="color:var(--bad)">${brl(totalReceber)}</div>
        <div class="rd-kpi-apoio">${vencido>0?brl(vencido)+' vencido':'nada vencido'}</div>
      </div>
      <div class="rd-card rd-card-dense">
        <div class="rd-kpi-lbl"><span class="rd-badge rd-badge-ok">Já recebido</span></div>
        <div class="rd-kpi-num rd-kpi-num-sm" style="color:var(--ok)">${brl(totalRecebido)}</div>
      </div>
      <div class="rd-card rd-card-dense rd-card-dark">
        <div class="rd-kpi-lbl">Total aprovado</div>
        <div class="rd-kpi-num rd-kpi-num-sm">${brl(aprov.reduce((a,o)=>a+(parseFloat(o.total)||0),0))}</div>
      </div>`;
  }

  // Aging — só faz sentido com parcela lançada (é o vencimento que dá a idade)
  if(agingEl){
    if(!abertas.length){ agingEl.innerHTML=''; }
    else{
      const porFaixa={};
      abertas.forEach(r=>{ const f=_recebFaixaAging(r); porFaixa[f]=(porFaixa[f]||0)+(parseFloat(r.valor)||0); });
      const maior=Math.max(...Object.values(porFaixa),1);
      const pmr=_recebPMR(parcelas);
      // Negativo é bom (pagam antes) — dizer "-5d após o vencimento" faria
      // parecer erro. Cada sentido tem sua frase.
      const pmrTx = pmr
        ? ` · na média, pagam ${Math.abs(pmr.dias)<0.5?'no dia do vencimento':Math.abs(pmr.dias).toFixed(0)+'d '+(pmr.dias>0?'depois':'antes')+' do vencimento'} (${pmr.n} parcela${pmr.n!==1?'s':''} paga${pmr.n!==1?'s':''})`
        : '';
      agingEl.innerHTML=`<div class="rd-card">
        <div class="rd-card-title">Idade do saldo em aberto<span style="font-weight:400;color:var(--gray);font-size:11.5px">${pmrTx}</span></div>
        <div style="display:flex;gap:10px;align-items:flex-end;height:110px;margin-top:10px">
          ${_RECEB_FAIXAS.map(f=>{
            const v=porFaixa[f.id]||0;
            const h=Math.max(4, Math.round(v/maior*80));
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <div style="font-size:10.5px;font-weight:700;color:${f.cor}">${v?brl(v):''}</div>
              <div style="width:100%;height:${h}px;background:${f.cor};border-radius:6px 6px 0 0;opacity:${v?1:.25}"></div>
              <div style="font-size:10.5px;color:var(--gray);text-align:center">${f.lbl}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }
  }

  // Aprovado sem NENHUMA cobrança lançada — o buraco que o modelo antigo
  // escondia: sem parcela e sem vencimento, esse dinheiro nunca aparece
  // como atrasado em lugar nenhum.
  if(gapEl){
    const gap=_orcAprovadosSemReceb();
    if(!gap.length){ gapEl.innerHTML=''; }
    else{
      const soma=gap.reduce((a,o)=>a+_orcSaldoAReceber(o),0);
      gapEl.innerHTML=`<div class="rd-card rd-card-warn">
        <div style="font-size:13px;font-weight:700;color:var(--warn);margin-bottom:4px">
          ${gap.length} aprovado${gap.length!==1?'s':''} sem cobrança lançada · ${brl(soma)}</div>
        <div style="font-size:12px;color:var(--gray);margin-bottom:9px">
          Sem parcela e sem vencimento, esse valor nunca aparece como atrasado. Lance a cobrança pra ele entrar no acompanhamento.</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${gap.slice(0,6).map(o=>`<button class="rd-btn rd-btn-secondary" style="font-size:11.5px" onclick="abrirModalReceb('${o.id}')">#${String(o.numero||'').padStart(3,'0')} ${esc((o.cliente||'').slice(0,18))} · ${brl(_orcSaldoAReceber(o))}</button>`).join('')}
          ${gap.length>6?`<span style="font-size:11.5px;color:var(--gray);align-self:center">+${gap.length-6}</span>`:''}
        </div>
      </div>`;
    }
  }

  // Lista: parcela a parcela, mais atrasada primeiro (é a ordem de cobrança).
  // Parcela paga sai da lista — o total dela já aparece em "Já recebido".
  const linhas=abertas.slice().sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||''));
  if(!linhas.length){
    tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:18px">${
      parcelas.length?'✅ Nenhuma parcela em aberto':'Nenhuma cobrança lançada ainda — aprove um orçamento ou use o card acima.'
    }</td></tr>`;
    return;
  }
  tbody.innerHTML=linhas.map(r=>{
    const o=todosOrc.find(x=>x.id===r.orcamento_id)||{};
    const dias=_recebDiasAtraso(r);
    const atraso = dias>0
      ? `<span style="font-size:10px;background:var(--red-bg);color:var(--red);padding:1px 6px;border-radius:50px;font-weight:700">${dias}d</span>`
      : '';
    return `<tr>
      <td><strong>#${String(o.numero||'—').padStart(3,'0')}</strong></td>
      <td>${esc(o.cliente||'—')} ${atraso}</td>
      <td>${r.parcelas_total>1?`${r.parcela_n}/${r.parcelas_total}`:'única'}</td>
      <td${dias>0?' style="color:var(--red);font-weight:700"':''}>${r.vencimento?_dataBR(r.vencimento):'—'}</td>
      <td><strong>${brl(r.valor||0)}</strong></td>
      <td><button class="tb g" style="font-size:11px" onclick="_recebMarcarPago('${r.id}',true)">✓ Recebi</button></td>
    </tr>`;
  }).join('');
}

// ──────────────────────────────────────────────────
//  RELATÓRIO FINANCEIRO
// ──────────────────────────────────────────────────
function renderRelatorioFinanceiro(){
  const tbody=document.getElementById('fin-tabela-body'); if(!tbody) return;
  const periodo=(document.getElementById('fin-periodo')||{value:'6m'}).value;
  const hoje=new Date();
  const meses=[];
  if(periodo==='6m'){for(let i=5;i>=0;i--){const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);meses.push({y:d.getFullYear(),m:d.getMonth()});}}
  else if(periodo==='12m'){for(let i=11;i>=0;i--){const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);meses.push({y:d.getFullYear(),m:d.getMonth()});}}
  else{for(let i=0;i<=hoje.getMonth();i++) meses.push({y:hoje.getFullYear(),m:i});}
  const orcFilt=filtrarPorLoja(todosOrc);
  const despFilt=filtrarPorLoja(todasDesp);
  let totRec=0,totDesp=0;
  const linhas=meses.map(({y,m})=>{
    const label=new Date(y,m,1).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});
    const rec=orcFilt.filter(o=>{const d=_orcData(o);return d&&!isNaN(d)&&d.getFullYear()===y&&d.getMonth()===m&&o.status==='aprovado';}).reduce((a,o)=>a+(o.total||0),0);
    const desp=despFilt.filter(d=>{const raw=(d.data||'').split('T')[0];if(!raw)return false;const dt=new Date(raw+'T12:00:00');return dt.getFullYear()===y&&dt.getMonth()===m;}).reduce((a,d)=>a+(d.valor||0),0);
    const res=rec-desp;
    totRec+=rec; totDesp+=desp;
    return `<tr>
      <td style="font-weight:600">${label}</td>
      <td class="${rec>0?'fin-pos':'fin-zero'}">${brl(rec)}</td>
      <td class="${desp>0?'fin-neg':'fin-zero'}">${brl(desp)}</td>
      <td class="${res>0?'fin-pos':res<0?'fin-neg':'fin-zero'}">${brl(res)}</td>
    </tr>`;
  });
  const totRes=totRec-totDesp;
  linhas.push(`<tr class="fin-total">
    <td>Total do período</td>
    <td class="${totRec>0?'fin-pos':'fin-zero'}">${brl(totRec)}</td>
    <td class="${totDesp>0?'fin-neg':'fin-zero'}">${brl(totDesp)}</td>
    <td class="${totRes>0?'fin-pos':totRes<0?'fin-neg':'fin-zero'}">${brl(totRes)}</td>
  </tr>`);
  tbody.innerHTML=linhas.join('');
}

function renderProd(){
  const {inicio, fim}=getPeriodoProd();
  const ant=getPeriodoAntProd();
  const filtTec=gV('prod-filtro-tec');
  const tecs=filtTec?[filtTec]:getTecnicos();

  // Cards
  const cardsEl=document.getElementById('prod-cards');
  if(!tecs.length){ cardsEl.innerHTML='<div class="empty-st"><div class="ei">👥</div><p>Nenhum técnico configurado em Dados da Empresa.</p></div>'; return; }

  const maxConc=Math.max(...tecs.map(t=>metricasTec(t,inicio,fim).conc),1);
  const comPct=getComissaoPct(), meta=getMetaTec();
  // Preenche os inputs de config com os valores salvos
  const _ip=document.getElementById('prod-comissao-pct'); if(_ip&&document.activeElement!==_ip) _ip.value=comPct||'';
  const _ch=document.getElementById('prod-custo-hora'); if(_ch&&document.activeElement!==_ch) _ch.value=getCustoHora()||'';
  const _im=document.getElementById('prod-meta-tec'); if(_im&&document.activeElement!==_im) _im.value=meta||'';

  cardsEl.innerHTML=tecs.map(tec=>{
    const m=metricasTec(tec,inicio,fim);
    const mAnt=ant?metricasTec(tec,ant.inicio,ant.fim):null;
    let vs=''; if(mAnt){
      const diff=m.conc-mAnt.conc;
      if(diff>0) vs=`<div class="prod-vs prod-up">▲ ${diff} vs período ant.</div>`;
      else if(diff<0) vs=`<div class="prod-vs prod-down">▼ ${Math.abs(diff)} vs período ant.</div>`;
      else vs=`<div class="prod-vs prod-eq">= igual ao período ant.</div>`;
    }
    const pct=maxConc>0?Math.round(m.conc/maxConc*100):0;
    const comissao=m.faturamento*comPct/100;
    // Progresso da meta (faturamento vs meta mensal)
    let metaHtml='';
    if(meta>0){
      const mp=Math.min(100,Math.round(m.faturamento/meta*100));
      const cor=mp>=100?'var(--green)':mp>=60?'var(--yellow)':'var(--red)';
      metaHtml=`<div style="margin-top:8px;font-size:11px;color:var(--gray)">Meta: <strong style="color:${cor}">${mp}%</strong> de ${brl(meta)}</div>
        <div class="prod-bar-bg"><div class="prod-bar" style="width:${mp}%;background:${cor}"></div></div>`;
    }
    return `<div class="prod-card">
      <div class="prod-tec-nome">👤 ${esc(tec)}</div>
      <div class="prod-num">${m.conc}</div>
      <div class="prod-label">OS Concluídas</div>
      <div class="prod-bar-bg"><div class="prod-bar" style="width:${pct}%"></div></div>
      ${vs}
      <div style="margin-top:10px;font-size:12px;color:var(--gray)">Taxa: <strong style="color:${m.taxa>=70?'var(--green)':m.taxa>=40?'var(--yellow)':'var(--red)'}">${m.taxa}%</strong></div>
      <div style="font-size:12px;color:var(--gray)">Faturamento: <strong>${brl(m.faturamento)}</strong></div>
      ${comPct>0?`<div style="font-size:12px;color:var(--green);font-weight:700">Comissão: ${brl(comissao)}</div>`:''}
      <div style="font-size:12px;color:var(--gray)">Despesas: <strong>${brl(m.desp)}</strong></div>
      ${m.custoHoraDef?`<div style="font-size:12px;color:var(--gray)">Mão de obra: <strong>${brl(m.custoMO)}</strong> <span style="font-size:10.5px">(${m.horas.toFixed(1)}h)</span></div>
      <div style="font-size:12px;font-weight:700;color:${m.margemEst>=0?'var(--green)':'var(--red)'}">Margem est.: ${brl(m.margemEst)}</div>`:''}
      ${metaHtml}
    </div>`;
  }).join('');

  // Tabela
  const tbody=document.getElementById('prod-tabela-body');
  tbody.innerHTML=tecs.map(tec=>{
    const m=metricasTec(tec,inicio,fim);
    const tempoStr=m.tempoMed>0?(m.tempoMed>=60?Math.floor(m.tempoMed/60)+'h '+(m.tempoMed%60)+'min':m.tempoMed+' min'):'—';
    const comissao=m.faturamento*comPct/100;
    return `<tr>
      <td><strong>${esc(tec)}</strong></td>
      <td><span style="color:var(--green);font-weight:700">${m.conc}</span></td>
      <td><span style="color:var(--red)">${m.canc}</span></td>
      <td><span style="font-weight:700;color:${m.taxa>=70?'var(--green)':m.taxa>=40?'var(--yellow)':'var(--red)'}">${m.taxa}%</span></td>
      <td>${tempoStr}</td>
      <td><strong>${brl(m.faturamento)}</strong></td>
      <td>${comPct>0?`<span style="color:var(--green);font-weight:700">${brl(comissao)}</span>`:'—'}</td>
      <td>${brl(m.desp)}</td>
      <td>${m.clientes}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════
//  MÓDULO 3 — DESPESAS DE CAMPO
// ══════════════════════════════════════════════════
let todasDesp = [], despFotoB64 = '';

function abrirFormDesp(){
  document.getElementById('desp-form-card').style.display='block';
  document.getElementById('desp-data').value=_hojeLocal();
  setV('desp-natureza','campo');
  setV('desp-competencia', _hojeLocal().slice(0,7));
  _despAplicarNatureza();
  populaDespTecSelect();
  filtrarOSDesp('');
  document.getElementById('desp-form-card').scrollIntoView({behavior:'smooth'});
}
function fecharFormDesp(){
  document.getElementById('desp-form-card').style.display='none';
  despFotoB64='';
}

function populaDespTecSelect(){
  const tecs=getTecnicos();
  ['desp-tec','desp-filtro-tec'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const val=el.value;
    const extra=id==='desp-filtro-tec'?'<option value="">Todos os técnicos</option>':'<option value="">Selecione…</option>';
    el.innerHTML=extra+tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
    el.value=val;
  });
  const ult=ls('fluxa_ultimo_tec');
  if(ult){ const el=document.getElementById('desp-tec'); if(el) el.value=ult; }
}

function filtrarOSDesp(v){
  const dl=document.getElementById('desp-os-list'); if(!dl) return;
  dl.innerHTML='';
  todosOrc.filter(o=>(String(o.numero||'')).includes(v.replace('#',''))||(o.cliente||'').toLowerCase().includes(v.toLowerCase())).slice(0,8).forEach(o=>{
    const opt=document.createElement('option');
    opt.value='#'+String(o.numero||'').padStart(3,'0')+' — '+o.cliente;
    dl.appendChild(opt);
  });
}

function carregarFotoDesp(inp){
  const f=inp.files[0]; if(!f) return;
  if(f.size > FOTO_MAX_BYTES){ toast('⚠️ Foto muito grande (máx 20 MB).'); inp.value=''; return; }
  const r=new FileReader();
  r.onload=e=>{ despFotoB64=e.target.result;
    const prev=document.getElementById('desp-foto-prev'); prev.src=e.target.result; prev.style.display='block';
    document.getElementById('desp-foto-lbl').textContent=f.name;
    document.getElementById('desp-btn-rm-foto').style.display='block';
  };
  r.readAsDataURL(f);
}
function removerFotoDesp(){ despFotoB64=''; document.getElementById('desp-foto-prev').style.display='none'; document.getElementById('desp-foto-lbl').textContent='Fotografar comprovante'; document.getElementById('desp-btn-rm-foto').style.display='none'; document.getElementById('desp-foto-input').value=''; }

// ══════════════════════════════════════════════════
//  DESPESAS — natureza, fixa × variável, recorrência
// ══════════════════════════════════════════════════
// Custo fixo (aluguel, salário, energia, contador) não tinha onde ser lançado:
// o formulário só oferecia tipos de campo e exigia um técnico. É justamente
// esse custo que define se o mês fechou no azul — sem ele, qualquer resultado
// mostra metade da conta.
const DESP_TIPOS_CAMPO=['Combustível','Pedágio','Material','Alimentação','Manutenção de veículo','Outro'];
const DESP_TIPOS_EMPRESA=['Aluguel','Salário / pró-labore','Energia / água','Internet / telefone','Software / sistema','Contador','Imposto / taxa','Marketing','Outro'];
// Fixo = não varia com o volume de serviço no mês. Classificar por TIPO (e não
// perguntar) evita mais um campo obrigatório num formulário que já é longo.
const _DESP_TIPOS_FIXOS=new Set(['Aluguel','Salário / pró-labore','Energia / água','Internet / telefone','Software / sistema','Contador','Imposto / taxa']);
function _despFixaOuVariavel(tipo){ return _DESP_TIPOS_FIXOS.has(tipo)?'fixa':'variavel'; }
// Competência é o mês a que a despesa PERTENCE, não o dia em que foi paga:
// a energia de janeiro paga em fevereiro é resultado de janeiro.
function _despCompetencia(d){ return d?.competencia || String(d?.data||'').slice(0,7) || ''; }

function _despAplicarNatureza(){
  const nat=gV('desp-natureza')||'campo';
  const tipos = nat==='empresa'?DESP_TIPOS_EMPRESA:DESP_TIPOS_CAMPO;
  const sel=document.getElementById('desp-tipo');
  if(sel){
    const atual=sel.value;
    sel.innerHTML='<option value="">Selecione…</option>'+tipos.map(t=>`<option>${esc(t)}</option>`).join('');
    if(tipos.includes(atual)) sel.value=atual;
  }
  // Técnico só faz sentido em despesa de campo — em custo da empresa ele fica
  // oculto e vazio, senão viraria um obrigatório sem resposta certa.
  const tecWrap=document.getElementById('desp-tec-wrap');
  if(tecWrap) tecWrap.style.display = nat==='empresa'?'none':'';
  if(nat==='empresa') setV('desp-tec','');
  const recWrap=document.getElementById('desp-recorrente-wrap');
  if(recWrap) recWrap.style.display = nat==='empresa'?'':'none';
  if(nat!=='empresa'){ const c=document.getElementById('desp-recorrente'); if(c) c.checked=false; }
}

// Recorrente do mês PASSADO que ainda não foi lançada neste mês. Compara por
// tipo+descrição (não por id) — a despesa deste mês é um registro novo.
function _despRecorrentesPendentes(){
  const mesAtual=_hojeLocal().slice(0,7);
  const d=new Date(parseInt(mesAtual.slice(0,4)), parseInt(mesAtual.slice(5,7))-1, 1);
  d.setMonth(d.getMonth()-1);
  const mesAnt=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  const lista=filtrarPorLoja(todasDesp||[]);
  const doMes=m=>lista.filter(x=>x.recorrente && _despCompetencia(x)===m);
  const chave=x=>((x.tipo||'')+'|'+(x.descricao||'')).toLowerCase();
  const jaNoAtual=new Set(doMes(mesAtual).map(chave));
  return doMes(mesAnt).filter(x=>!jaNoAtual.has(chave(x)));
}
function renderAvisoRecorrentes(){
  const el=document.getElementById('desp-recorrentes-aviso'); if(!el) return;
  const p=_despRecorrentesPendentes();
  if(!p.length){ el.style.display='none'; el.innerHTML=''; return; }
  const tot=p.reduce((a,x)=>a+(parseFloat(x.valor)||0),0);
  el.style.display='';
  el.innerHTML=`<div class="rd-card rd-card-warn" style="margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;color:var(--warn);margin-bottom:4px">
      ${p.length} despesa${p.length!==1?'s':''} recorrente${p.length!==1?'s':''} ainda não lançada${p.length!==1?'s':''} neste mês · ${brl(tot)}</div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:9px">
      ${p.slice(0,4).map(x=>esc(x.tipo||'')+(x.descricao?' ('+esc(x.descricao)+')':'')).join(' · ')}${p.length>4?` e mais ${p.length-4}`:''}</div>
    <button class="rd-btn rd-btn-secondary" onclick="repetirRecorrentes()">Lançar as ${p.length} deste mês</button>
  </div>`;
}
async function repetirRecorrentes(){
  const p=_despRecorrentesPendentes();
  if(!p.length) return;
  const mes=_hojeLocal().slice(0,7);
  let ok=0;
  for(const x of p){
    // Sem o id do registro antigo: o banco gera o novo. E sem o comprovante —
    // a foto é do mês passado, não vale como comprovante deste.
    const {id:_ig, data_criacao:_ig2, foto_base64:_ig3, ...base}=x;
    const dados={...base, competencia:mes, data:_hojeLocal(), status:'pendente', foto_base64:null};
    const tempId='desp_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    todasDesp.unshift({...dados, id:tempId, data_criacao:new Date().toISOString()});
    ok++;
    if(dbOk&&db){
      try{
        const {data:ins,error}=await dbInsert('despesas', dados);
        if(error){ console.warn('[repetirRecorrentes]', error.message); continue; }
        if(ins){ todasDesp=todasDesp.filter(y=>y.id!==tempId); todasDesp.unshift(ins); }
      }catch(e){ console.warn('[repetirRecorrentes]', e?.message||e); }
    }
  }
  lsDespSalvar(todasDesp);
  renderDespesas(); renderAvisoRecorrentes();
  toast(`✅ ${ok} despesa${ok!==1?'s':''} lançada${ok!==1?'s':''} neste mês`);
}

async function salvarDespesa(){
  const natureza=gV('desp-natureza')||'campo';
  const tec=gV('desp-tec'), tipo=gV('desp-tipo'), valor=parseFloat(gV('desp-valor'))||0;
  if(!tipo||!valor){ toast('⚠️ Informe tipo e valor'); return; }
  // Técnico só é obrigatório em despesa de campo — custo da empresa não tem um.
  if(natureza==='campo' && !tec){ toast('⚠️ Informe o técnico'); return; }
  if(tec) lsSet('fluxa_ultimo_tec',tec);
  const osInput=gV('desp-os-num');
  let osNum=null; const m=osInput.match(/\d+/); if(m) osNum=parseInt(m[0]);
  const dataDesp=gV('desp-data')||_hojeLocal();
  const dados={ tecnico:tec||null, data:dataDesp, tipo, valor, descricao:gV('desp-desc'),
    os_numero:osNum||null, foto_base64:despFotoB64||null, status:'pendente',
    loja_id:lojaAtiva||LOJA_PADRAO_ID,
    natureza, recorrente: natureza==='empresa' && !!document.getElementById('desp-recorrente')?.checked,
    competencia: gV('desp-competencia')||dataDesp.slice(0,7) };
  const rec={...dados, id:'desp_'+Date.now(), data_criacao:new Date().toISOString()};
  todasDesp.unshift(rec); lsDespSalvar(todasDesp);
  if(dbOk&&db){
    _despSyncInFlight.add(rec.id); // trava reenvio concorrente (sync periódico) até terminar
    (async()=>{
      try{ const {data:ins}=await dbInsert('despesas', dados);
        if(ins){ todasDesp=todasDesp.filter(x=>x.id!==rec.id); todasDesp.unshift(ins); lsDespSalvar(todasDesp); }
      }catch(e){ console.warn('desp sync:',e.message); }
      finally{ _despSyncInFlight.delete(rec.id); }
    })();
  }
  fecharFormDesp(); renderDespesas(); renderAvisoRecorrentes(); toast('✅ Despesa registrada!');
}

// Reenvia despesas presas só no aparelho (insert em background falhou uma vez e
// nunca mais tentou de novo — achado numa varredura por bugs, 17/08: só orçamento/OS
// tinham esse reenvio). Mesmo padrão de _reenviarOSLocais.
const _despSyncInFlight = new Set();
async function _reenviarDespesasLocais(soLocal){
  if(!dbOk||!db||!soLocal||!soLocal.length) return false;
  let mudou=false;
  for(const rec of soLocal){
    if(_despSyncInFlight.has(rec.id)) continue;
    try{
      const payload={...rec}; delete payload.id; // banco gera o id definitivo
      const {data:ins,error}=await dbInsert('despesas', payload);
      if(error){ console.warn('[reenvioDespLocal] falhou:', error.message); continue; }
      if(ins){ todasDesp=todasDesp.filter(x=>x.id!==rec.id); todasDesp.unshift(ins); mudou=true; }
    }catch(e){ console.warn('[reenvioDespLocal] erro:', e?.message||e); }
  }
  if(mudou) lsDespSalvar(todasDesp);
  return mudou;
}

async function reembolsarDesp(id){
  todasDesp=todasDesp.map(d=>d.id===id?{...d,status:'reembolsado'}:d);
  lsDespSalvar(todasDesp);
  if(dbOk&&db) db.from('despesas').update({status:'reembolsado'}).eq('id',id).then(()=>{}).catch(()=>{});
  renderDespesas(); toast('✅ Marcado como reembolsado');
}

function excluirDesp(id){
  confirmar('Excluir esta despesa?', ()=>{ todasDesp=todasDesp.filter(x=>x.id!==id); lsDespSalvar(todasDesp); if(dbOk&&db) db.from('despesas').delete().eq('id',id).then(()=>{}).catch(()=>{}); renderDespesas(); toast('🗑 Despesa excluída'); }, 'Excluir Despesa');
}

function lsDespLer(){ try{ return JSON.parse(ls('fluxa_despesas')||'[]'); }catch(e){ return []; } }
function lsDespSalvar(lista){ lsSet('fluxa_despesas', JSON.stringify(lista)); }

async function loadDespesas(){
  todasDesp=lsDespLer(); renderDespesas(); populaDespTecSelect();
  if(dbOk&&db){
    try{
      let q=db.from('despesas').select('*').eq('empresa_id',EMPRESA_ID).order('data_criacao',{ascending:false});
      if(lojaAtiva) q=q.eq('loja_id',lojaAtiva);
      const {data}=await q;
      if(data){
        // MERGE (não sobrescreve) — achado numa varredura por bugs (17/08): antes,
        // esta linha trocava a lista inteira pelo retorno do banco, apagando em
        // silêncio qualquer despesa salva local ("desp_...") cujo insert em
        // background ainda não tivesse voltado (ou tivesse falhado uma vez).
        // Mesmo padrão que loadAgendamentos/loadHist/loadOSHist já usam.
        const idsDb=new Set(data.map(x=>x.id));
        const soLocal=todasDesp.filter(x=>String(x.id).startsWith('desp_')&&!idsDb.has(x.id)&&!_despSyncInFlight.has(x.id));
        todasDesp=[...data,...soLocal];
        lsDespSalvar(todasDesp); renderDespesas();
        if(soLocal.length) await _reenviarDespesasLocais(soLocal);
        renderDespesas();
      }
    }catch(e){ console.warn('[loadDespesas]', e?.message||e); }
  }
}

function renderDespesas(){
  renderAvisoRecorrentes();
  const filtTec=gV('desp-filtro-tec'), filtSt=gV('desp-filtro-st');
  let lista=[...todasDesp];
  lista=filtrarPorLoja(lista);
  if(filtTec) lista=lista.filter(d=>d.tecnico===filtTec);
  if(filtSt) lista=lista.filter(d=>d.status===filtSt);
  const agora=new Date(), mesAtual=agora.getMonth(), anoAtual=agora.getFullYear();
  const doMes=filtrarPorLoja(todasDesp).filter(d=>{ if(!d.data) return false; const dd=new Date(d.data+'T12:00:00'); return dd.getMonth()===mesAtual&&dd.getFullYear()===anoAtual; });
  const pend=doMes.filter(d=>d.status==='pendente');
  const reimb=doMes.filter(d=>d.status==='reembolsado');
  setV_el('desp-d-pend',brl(pend.reduce((a,d)=>a+(d.valor||0),0)),'textContent');
  setV_el('desp-d-pend-q',pend.length+' item'+(pend.length!==1?'s':''),'textContent');
  setV_el('desp-d-reimb',brl(reimb.reduce((a,d)=>a+(d.valor||0),0)),'textContent');
  setV_el('desp-d-reimb-q',reimb.length+' item'+(reimb.length!==1?'s':''),'textContent');
  setV_el('desp-d-total',brl(doMes.reduce((a,d)=>a+(d.valor||0),0)),'textContent');
  // Fixo × variável é a leitura que interessa: o fixo é o que a empresa paga
  // mesmo num mês sem serviço nenhum.
  const _fixa=doMes.filter(d=>_despFixaOuVariavel(d.tipo)==='fixa').reduce((a,d)=>a+(parseFloat(d.valor)||0),0);
  const _var =doMes.filter(d=>_despFixaOuVariavel(d.tipo)!=='fixa').reduce((a,d)=>a+(parseFloat(d.valor)||0),0);
  setV_el('desp-d-fixvar', _fixa>0?`fixa ${brl(_fixa)} · variável ${brl(_var)}`:'este mês','textContent');
  // Breakdown por categoria (onde vai o dinheiro)
  const catCard=document.getElementById('desp-cat-card'), catBody=document.getElementById('desp-cat-body');
  if(catCard&&catBody){
    const porCat={}; doMes.forEach(d=>{ const k=d.tipo||'Outro'; porCat[k]=(porCat[k]||0)+(d.valor||0); });
    const totMes=doMes.reduce((a,d)=>a+(d.valor||0),0);
    const rank=Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
    if(!rank.length||totMes<=0){ catCard.style.display='none'; }
    else {
      catCard.style.display='';
      const max=rank[0][1]||1;
      const catIcons={Combustível:'⛽',Pedágio:'🛣️',Material:'🔩',Alimentação:'🍽️',Outro:'📎'};
      catBody.innerHTML=rank.map(([cat,v])=>`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
        <div style="font-size:16px;width:24px;text-align:center">${catIcons[cat]||'📎'}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;color:var(--c2);margin-bottom:3px"><span>${esc(cat)}</span><span>${brl(v)} <span style="color:var(--gray);font-weight:400">(${Math.round(v/totMes*100)}%)</span></span></div>
          <div style="height:6px;background:var(--gray-light);border-radius:50px;overflow:hidden"><div style="height:100%;background:var(--c1);border-radius:50px;width:${Math.round(v/max*100)}%"></div></div>
        </div>
      </div>`).join('');
    }
  }
  const el=document.getElementById('desp-lista');
  if(!lista.length){ el.innerHTML='<div class="empty-st"><div class="ei">💸</div><p>Nenhuma despesa registrada.</p><button class="btn-primary" style="margin-top:12px" onclick="abrirFormDesp()">＋ Registrar despesa</button></div>'; return; }
  const icons={Combustível:'⛽',Pedágio:'🛣️',Material:'🔩',Alimentação:'🍽️',Outro:'📎'};
  el.innerHTML=lista.map(d=>`
    <div class="desp-card ${d.status||'pendente'}">
      <div class="desp-icon">${icons[d.tipo]||'📎'}</div>
      <div class="desp-info">
        <div class="desp-tipo">${esc(d.tipo||'')}${d.os_numero?' · OS #'+String(d.os_numero).padStart(3,'0'):''}</div>
        <div class="desp-desc">${esc(d.descricao||'—')}</div>
        <div class="desp-meta">👤 ${esc(d.tecnico||'—')} · 📅 ${d.data?new Date(d.data+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
        <div class="desp-valor">${brl(d.valor||0)}</div>
        <span class="desp-st ${d.status||'pendente'}">${d.status==='reembolsado'?'✅ Reembolsado':'⏳ Pendente'}</span>
        <div style="display:flex;gap:4px">
          ${d.status==='pendente'?`<button class="tb g" onclick="reembolsarDesp('${d.id}')">✅</button>`:''}
          ${d.foto_base64?`<button class="tb" onclick="verFotoDesp('${d.id}')">🧾</button>`:''}
          <button class="tb d" onclick="excluirDesp('${d.id}')">🗑</button>
        </div>
      </div>
    </div>
  `).join('');
}

function verFotoDesp(id){
  const d=todasDesp.find(x=>x.id===id); if(!d||!d.foto_base64) return;
  // Valida formato antes de exibir — previne XSS via data: URI não-imagem
  if(!/^data:image\/(jpeg|png|gif|webp);base64,/.test(d.foto_base64)){
    console.warn('[verFotoDesp] formato inválido ignorado'); return;
  }
  const w=window.open('','_blank');
  if(!w) return;
  const img=w.document.createElement('img');
  img.src=d.foto_base64;
  img.style.cssText='max-width:100%;max-height:100vh;object-fit:contain';
  w.document.body.style.cssText='margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh';
  w.document.body.appendChild(img);
}

// ══════════════════════════════════════════════════
//  MÓDULO 1 — AGENDAMENTO RECORRENTE + CHECK-IN/OUT
// ══════════════════════════════════════════════════
let todosAg = [], calAno, calMes, checkinAt = null, checkinTimer = null;

// 🔴 CFG.tecnicos era um campo MORTO (textarea display:none que nenhuma tela
// mostra ou edita) e, por vir antes do ||, sempre vencia — mas array vazio é
// TRUTHY em JS, então `[] || LOJAS...` devolve `[]`. Resultado: TODO seletor de
// técnico do app ficava vazio em qualquer empresa que não tivesse esse campo
// preenchido à mão, que é o padrão. A fonte real é LOJAS[].tecs, editável na
// tela de Empresa.
function getTecnicos(){ return LOJAS.flatMap(l=>l.tecs||[]).filter(v=>v).filter((v,i,a)=>a.indexOf(v)===i); }

function populaTecSelects(){
  const tecs=getTecnicos();
  ['ag-tec','os-tec-checkin','cal-filtro-tec'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const val=el.value;
    const extra=id==='cal-filtro-tec'?'<option value="">Todos os técnicos</option>':'<option value="">Selecione…</option>';
    el.innerHTML=extra+tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
    el.value=val;
  });
}

function updAgForm(){
  const p=gV('ag-periodo'), sel=document.getElementById('ag-dia'); if(!sel) return;
  sel.innerHTML='';
  if(p==='mensal'){
    for(let i=1;i<=28;i++){ const o=document.createElement('option'); o.value=i; o.textContent='Dia '+i; sel.appendChild(o); }
  } else {
    ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].forEach((d,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=d; sel.appendChild(o); });
  }
}

function filtrarCliAg(v){
  const dl=document.getElementById('ag-cli-list'); dl.innerHTML='';
  const clientes=JSON.parse(ls('fluxa_clientes_full')||'[]');
  clientes.filter(c=>(c.nome||'').toLowerCase().includes(v.toLowerCase())).slice(0,8).forEach(c=>{
    const opt=document.createElement('option'); opt.value=c.nome; dl.appendChild(opt);
  });
}

function abrirFormAg(){
  document.getElementById('ag-form-card').style.display='block';
  document.getElementById('ag-inicio').value=_hojeLocal();
  populaTecSelects(); updAgForm();
  document.getElementById('ag-form-card').scrollIntoView({behavior:'smooth'});
}
function fecharFormAg(){ document.getElementById('ag-form-card').style.display='none'; }

async function salvarAgendamento(){
  const cli=gV('ag-cli').trim(), tipo=gV('ag-tipo').trim();
  if(!cli||!tipo){ toast('⚠️ Informe o cliente e o tipo de serviço'); return; }
  const dados={
    cliente:cli, local_servico:gV('ag-loc'), tecnico:gV('ag-tec'),
    tipo_servico:tipo, periodicidade:gV('ag-periodo'),
    dia_semana:parseInt(gV('ag-dia'))||1, horario:gV('ag-hora'),
    data_inicio:gV('ag-inicio'), data_fim:gV('ag-fim')||null,
    obs:gV('ag-obs'), ativo:true,
    loja_id:lojaAtiva||LOJA_PADRAO_ID
  };
  const rec={...dados, id:'ag_'+Date.now(), data_criacao:new Date().toISOString()};
  todosAg.unshift(rec);
  lsAgSalvar(todosAg);
  // Gera as OS futuras (próximas 6 ocorrências)
  await gerarOSdoAgendamento(rec, rec.id);
  if(dbOk&&db){
    _agSyncInFlight.add(rec.id); // trava reenvio concorrente (sync periódico) até terminar
    (async()=>{
      try{
        const {data:ins}=await dbInsert('agendamentos', dados);
        if(ins){ todosAg=todosAg.filter(x=>x.id!==rec.id); todosAg.unshift(ins); lsAgSalvar(todosAg); }
      }catch(e){ console.warn('ag sync:',e.message); }
      finally{ _agSyncInFlight.delete(rec.id); }
    })();
  }
  fecharFormAg(); renderAgLista(); renderCal();
  toast('✅ Agendamento salvo! OS geradas automaticamente.');
}

// loadAgendamentos() (mais abaixo) já faz merge + reenvio dos "ag_*" presos só no
// aparelho — travamos aqui só pra ele não correr concorrente com o insert em
// background acima e reenviar 2x o mesmo agendamento (achado numa varredura por
// bugs, 17/08 — mesma classe do que já tinha acontecido com orçamento).
const _agSyncInFlight = new Set();

function proximasOcorrencias(ag, qtd=6){
  const datas=[];
  const inicio=new Date(ag.data_inicio+'T12:00:00');
  const fim=ag.data_fim?new Date(ag.data_fim+'T12:00:00'):null;
  const diaMes=(ag.dia_semana>=1&&ag.dia_semana<=31)?ag.dia_semana:0; // dia_semana armazena dia-do-mês para planos mensais
  let cur;
  if(ag.periodicidade==='mensal'&&diaMes){
    // Pinamos no dia preferido do mês — evita derivar para o dia da criação
    cur=new Date(inicio.getFullYear(),inicio.getMonth(),1,12,0,0);
    const maxD1=new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate();
    cur.setDate(Math.min(diaMes,maxD1));
    if(cur<inicio){ // se o dia deste mês já passou, vai pro próximo
      cur.setMonth(cur.getMonth()+1);
      const maxD2=new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate();
      cur.setDate(Math.min(diaMes,maxD2));
    }
  } else if(ag.periodicidade==='mensal'){
    // Plano mensal SEM dia escolhido → não agenda nada no calendário.
    // A visita fica pendente em "Meus Locais" e só aparece no calendário
    // quando a vistoria for feita (ou quando um dia for definido no plano).
    return [];
  } else {
    cur=new Date(inicio);
  }
  while(datas.length<qtd){
    if(fim&&cur>fim) break;
    datas.push(new Date(cur));
    if(ag.periodicidade==='semanal') cur.setDate(cur.getDate()+7);
    else if(ag.periodicidade==='quinzenal') cur.setDate(cur.getDate()+14);
    else {
      cur.setMonth(cur.getMonth()+1);
      if(diaMes){ // re-pina no dia preferido após avançar o mês
        const maxD=new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate();
        cur.setDate(Math.min(diaMes,maxD));
      }
    }
    if(datas.length>100) break;
  }
  return datas;
}

async function gerarOSdoAgendamento(ag, agId){
  const datas=proximasOcorrencias(ag, 6);
  for(const d of datas){
    const dataStr=d.toISOString().split('T')[0];
    // Idempotência: não cria de novo se já existe OS deste agendamento nesta data
    let jaExiste=false;
    try{ jaExiste=(JSON.parse(ls('fluxa_os_hist')||'[]')||[]).some(o=>o.agendamento_id===agId && o.data_servico===dataStr); }catch(e){ console.warn('[gerarOSag local]',e?.message||e); }
    if(!jaExiste && (todosOS||[]).some(o=>o.agendamento_id===agId && o.data_servico===dataStr)) jaExiste=true;
    if(!jaExiste && dbOk&&db){
      try{ const {data:ex}=await db.from('ordens_servico').select('id').eq('agendamento_id',agId).eq('data_servico',dataStr).limit(1); if(ex&&ex.length) jaExiste=true; }
      catch(e){ console.warn('[gerarOSag check]',e?.message||e); }
    }
    if(jaExiste) continue;
    const osDados={
      cliente:ag.cliente, local_servico:ag.local_servico,
      data_servico:dataStr, hora:ag.horario, tecnico:ag.tecnico,
      servicos:[ag.tipo_servico], materiais:'', obs_tecnica:ag.obs||'',
      total:0, status:'agendado', agendamento_id:agId,
      loja_id:ag.loja_id||lojaAtiva||LOJA_PADRAO_ID // fix #A: OS do plano herda loja_id do agendamento
    };
    const num=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',num);
    const rec={...osDados, id:'os_ag_'+Date.now()+Math.random(), numero:num, data_criacao:new Date().toISOString()};
    const localOS=JSON.parse(ls('fluxa_os_hist')||'[]'); localOS.unshift(rec); lsSet('fluxa_os_hist',JSON.stringify(localOS.slice(0,200)));
    if(dbOk&&db){
      try{
        await dbInsertNumerado('ordens_servico',{...osDados});
      }catch(e){ console.warn('OS ag sync:',e.message); }
    }
  }
}

// Reagenda as OS de um plano após editar o dia: cancela as futuras agendadas
// e regera conforme o dia atual (se o plano ficou sem dia, não regera nada).
async function _reagendarOSdoPlano(ag, agId){
  const hoje=_hojeLocal();
  try{
    const l=JSON.parse(ls('fluxa_os_hist')||'[]'); let mud=false;
    l.forEach(o=>{ if(o.agendamento_id===agId && o.status==='agendado' && (o.data_servico||'')>=hoje){ o.status='cancelado'; mud=true; } });
    if(mud) lsSet('fluxa_os_hist', JSON.stringify(l.slice(0,200)));
  }catch(e){ console.warn('[reagendarOS local]', e?.message||e); }
  try{ (todosOS||[]).forEach(o=>{ if(o.agendamento_id===agId && o.status==='agendado' && (o.data_servico||'')>=hoje) o.status='cancelado'; }); }catch(e){ console.warn('[reagendarOS mem]', e?.message||e); }
  if(dbOk&&db){ try{ await db.from('ordens_servico').update({status:'cancelado'}).eq('agendamento_id',agId).eq('status','agendado').gte('data_servico',hoje); }catch(e){ console.warn('[reagendarOS db]', e?.message||e); } }
  await gerarOSdoAgendamento(ag, agId);
}
// Reorganiza o calendário: passa por todos os planos da empresa e recria as
// visitas conforme o dia escolhido em cada um. Limpa visitas antigas empilhadas
// (ex.: as que caíam todas no dia 1 pelo bug do dia padrão).
function reorganizarCalendarioPlanos(btn){
  confirmar('Reorganizar o calendário conforme o dia de cada plano?\n\nVisitas antigas empilhadas serão removidas e recriadas no dia certo. Planos sem dia definido saem do calendário (continuam em Meus Locais).', ()=>_reorganizarCalConfirmado(btn), 'Reorganizar calendário');
}
async function _reorganizarCalConfirmado(btn){
  if(btn){ btn.disabled=true; btn.textContent='Reorganizando…'; }
  toast('🔧 Reorganizando calendário…');
  try{
    if(typeof loadLocaisRemoto==='function') await loadLocaisRemoto();
    const planos=(locaisVistoria||[]).filter(l=>l.ativo!==false && l.agendamento_id && escopoEmpresaMatch(l.loja_id));
    for(const l of planos){
      const base=todosAg.find(a=>a.id===l.agendamento_id)||{};
      const ag={
        cliente:l.cliente, local_servico:l.local, tecnico:l.tecnico||'',
        tipo_servico:'Vistoria de Manutenção', periodicidade:'mensal',
        dia_semana:parseInt(l.dia_pref)||null, horario:l.hora_pref||'08:00',
        data_inicio: base.data_inicio||_hojeLocal(), data_fim: base.data_fim||null,
        obs:'Plano de acompanhamento mensal', loja_id:l.loja_id, id:l.agendamento_id
      };
      await _reagendarOSdoPlano(ag, l.agendamento_id);
    }
    renderCal();
    toast('✅ Calendário reorganizado');
  }catch(e){ console.warn('[reorganizar]', e?.message||e); toast('⚠️ Falha ao reorganizar'); }
  if(btn){ btn.disabled=false; btn.textContent='🔧 Reorganizar'; }
}
// Ao concluir uma OS de agendamento recorrente, gera a ocorrência seguinte.
// dataConcluidaStr = data_servico da OS recém concluída (YYYY-MM-DD).
async function _gerarProximaOSdoAg(agId, dataConcluidaStr){
  const ag=todosAg.find(a=>a.id===agId);
  if(!ag||ag.ativo===false) return; // contrato encerrado
  // Calcula todas as ocorrências futuras a partir do dia seguinte à concluída
  const base=new Date((dataConcluidaStr||new Date().toISOString().split('T')[0])+'T12:00:00');
  const fakeAg={...ag, data_inicio: new Date(base.getTime()+86400000).toISOString().split('T')[0]};
  const proximas=proximasOcorrencias(fakeAg, 1);
  if(!proximas.length) return;
  await gerarOSdoAgendamento({...ag, data_inicio: fakeAg.data_inicio}, agId);
  renderCal();
}

function cancelarSerie(agId){
  confirmar('Cancelar TODAS as OS futuras deste agendamento?', ()=>_cancelarSerieConfirmado(agId), 'Cancelar Série');
}
async function _cancelarSerieConfirmado(agId){
  todosAg=todosAg.map(a=>a.id===agId?{...a,ativo:false}:a); lsAgSalvar(todosAg);
  if(dbOk&&db){
    db.from('agendamentos').update({ativo:false}).eq('id',agId).then(()=>{}).catch(()=>{});
    db.from('ordens_servico').update({status:'cancelado'}).eq('agendamento_id',agId).eq('status','agendado').then(()=>{}).catch(()=>{});
  }
  renderAgLista(); renderCal(); toast('🚫 Série cancelada');
}

function lsAgLer(){ try{ return JSON.parse(ls('fluxa_agendamentos')||'[]'); }catch(e){ return []; } }
function lsAgSalvar(lista){ lsSet('fluxa_agendamentos', JSON.stringify(lista)); }

async function loadAgendamentos(){
  todosAg=lsAgLer(); renderAgLista(); renderCal();
  if(dbOk&&db){
    try{
      let qAg=db.from('agendamentos').select('*').eq('empresa_id',EMPRESA_ID).eq('ativo',true).order('data_criacao',{ascending:false});
      if(lojaAtiva) qAg=qAg.eq('loja_id',lojaAtiva);
      const {data}=await qAg;
      if(data){
        // MERGE (não sobrescreve): preserva agendamentos salvos offline que ainda
        // não subiram ao banco (id 'ag_...' ausente no retorno). Antes, esta linha
        // trocava a lista inteira e podia apagar um agendamento feito sem conexão.
        const idAg=new Set(data.map(x=>x.id));
        const soLocalAg=todosAg.filter(x=>String(x.id).startsWith('ag_')&&!idAg.has(x.id)&&!_agSyncInFlight.has(x.id));
        todosAg=[...data,...soLocalAg];
        lsAgSalvar(todosAg);
        // Reenvia ao banco os que ficaram presos só no aparelho
        for(const a of soLocalAg){
          try{
            const {id,data_criacao,..._dados}=a;
            const {data:ins}=await dbInsert('agendamentos', _dados);
            if(ins){ todosAg=todosAg.filter(x=>x.id!==a.id); todosAg.unshift(ins); lsAgSalvar(todosAg); }
          }catch(e){ console.warn('[reenvioAg]', e?.message||e); }
        }
        renderAgLista(); renderCal();
      }
    }catch(e){ console.warn('[loadAgendamentos]', e?.message||e); }
  }
  // Verifica visitas de amanhã para lembrete
  const amanha=new Date(); amanha.setDate(amanha.getDate()+1);
  const amanhaStr=amanha.toISOString().split('T')[0];
  const osLocal=JSON.parse(ls('fluxa_os_hist')||'[]');
  const visitasAmanha=osLocal.filter(o=>o.data_servico===amanhaStr&&o.status==='agendado');
  if(visitasAmanha.length){
    const el=document.getElementById('ag-alertas-amanha');
    if(el){
      el.innerHTML=`<div style="background:var(--blue-bg);border:1px solid var(--blue);border-radius:10px;padding:12px 16px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">📅 ${visitasAmanha.length} visita(s) amanhã — envie o lembrete:</div>
        ${visitasAmanha.map(o=>{ _nc[o.id]=o; return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
          <span style="font-size:13px;flex:1">${esc(o.cliente||'')} · ${o.hora||''} · ${esc(o.tecnico||'')}</span>
          <button class="tb" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifVisita(getNC('${o.id}')), getNC('${o.id}').tel_cliente||'')">💬 WA</button>
        </div>`; }).join('')}
      </div>`;
    }
  } else {
    const el=document.getElementById('ag-alertas-amanha');
    if(el) el.innerHTML='';
  }
}

function agTab(t){
  document.getElementById('ag-view-cal').style.display=t==='cal'?'block':'none';
  document.getElementById('ag-view-lista').style.display=t==='lista'?'block':'none';
  document.getElementById('ag-tab-cal').classList.toggle('on',t==='cal');
  document.getElementById('ag-tab-lista').classList.toggle('on',t==='lista');
}

// ── CALENDÁRIO ──
function initCal(){ const n=new Date(); calAno=n.getFullYear(); calMes=n.getMonth(); }
function navCal(d){ calMes+=d; if(calMes>11){calMes=0;calAno++;} if(calMes<0){calMes=11;calAno--;} renderCal(); }

function renderAgDashboard(){
  // Dashboard (16/08, redesign task #37) — contratos ativos + visitas
  // hoje/semana, calculado sobre os mesmos dados que o calendário usa
  // (todosOS com data_servico), pra não divergir do que a tela mostra.
  const ativos=filtrarPorLoja(todosAg.filter(a=>a.ativo!==false));
  const _osById={};
  try{ (JSON.parse(ls('fluxa_os_hist')||'[]')||[]).forEach(o=>{ if(o&&o.id) _osById[o.id]=o; }); }catch(e){ console.warn('[renderAgDashboard]',e?.message||e); }
  (todosOS||[]).forEach(o=>{ if(o&&o.id) _osById[o.id]=o; });
  let osLocal=filtrarPorLoja(Object.values(_osById)).filter(o=>o.status!=='cancelado');
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const hojeStr=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  const em7=new Date(hoje); em7.setDate(em7.getDate()+6);
  const visitasHoje=osLocal.filter(o=>o.data_servico===hojeStr).length;
  const visitasSemana=osLocal.filter(o=>{
    if(!o.data_servico) return false;
    const d=new Date(o.data_servico+'T12:00:00'); d.setHours(0,0,0,0);
    return d>=hoje && d<=em7;
  }).length;
  setV_el('ag-d-contratos', String(ativos.length), 'textContent');
  setV_el('ag-d-hoje', String(visitasHoje), 'textContent');
  setV_el('ag-d-semana', String(visitasSemana), 'textContent');
}

function renderCal(){
  const el=document.getElementById('cal-tabela'); if(!el) return;
  renderAgDashboard();
  const filtTec=gV('cal-filtro-tec');
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('cal-titulo').textContent=meses[calMes]+' '+calAno;
  const dias=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let h=`<thead><tr>${dias.map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody>`;
  const primeiro=new Date(calAno,calMes,1);
  const ultimo=new Date(calAno,calMes+1,0).getDate();
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  let dia=1, inicioDia=primeiro.getDay();
  // OS do mês: mescla cache local (fluxa_os_hist) + as carregadas do banco (todosOS)
  const _osById={};
  try{ (JSON.parse(ls('fluxa_os_hist')||'[]')||[]).forEach(o=>{ if(o&&o.id) _osById[o.id]=o; }); }catch(e){ console.warn('[renderCal]',e?.message||e); }
  (todosOS||[]).forEach(o=>{ if(o&&o.id) _osById[o.id]=o; });
  // Filtro de empresa: o calendário da Aquamotor não pode mostrar OS da Fortemp
  // (e vice-versa). Era a causa de aparecerem clientes de outra empresa.
  let osLocal=filtrarPorLoja(Object.values(_osById));
  // Não polui o calendário com visitas canceladas (viravam lixo cinza).
  osLocal=osLocal.filter(o=>o.status!=='cancelado');
  // Dedup defensivo: OS do mesmo plano na mesma data (gerações repetidas).
  // Mantém a mais relevante: concluído > em andamento > agendado > cancelado.
  const _rank=s=>({concluido:3,em_andamento:2,agendado:1,cancelado:0}[s]??1);
  const _dedupOS=new Map();
  osLocal.forEach(o=>{
    const k=o.agendamento_id?('ag:'+o.agendamento_id+'|'+(o.data_servico||'')):('id:'+o.id);
    const prev=_dedupOS.get(k);
    if(!prev||_rank(o.status)>_rank(prev.status)) _dedupOS.set(k,o);
  });
  osLocal=[..._dedupOS.values()];
  while(dia<=ultimo){
    h+='<tr>';
    for(let col=0;col<7;col++){
      if((dia===1&&col<inicioDia)||dia>ultimo){ h+='<td class="outro-mes"></td>'; continue; }
      const d=new Date(calAno,calMes,dia); d.setHours(0,0,0,0);
      const isHoje=d.getTime()===hoje.getTime();
      const dStr=`${calAno}-${String(calMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
      const osNoDia=osLocal.filter(o=>o.data_servico===dStr&&(!filtTec||o.tecnico===filtTec))
        .sort((a,b)=>(a.hora||'').localeCompare(b.hora||'')||(a.cliente||'').localeCompare(b.cliente||''));
      h+=`<td class="${isHoje?'hoje':''}"><div style="font-size:10px;color:var(--gray);margin-bottom:2px">${dia}</div>`;
      osNoDia.slice(0,3).forEach(o=>{
        _nc[o.id]=o;
        const tipo=_osTipo(o);
        let extraStyle='', emoji='🔧 ';
        if(o.status==='concluido'){ extraStyle='background:#16a34a;'; emoji='✅ '; }
        else if(o.status==='cancelado'){ extraStyle='background:#9ca3af;'; emoji='🚫 '; }
        else if(tipo==='vistoria'){ extraStyle='background:#7c3aed;'; emoji='🔍 '; }
        else if(tipo==='orcamento'){ extraStyle='background:#c45e0a;'; emoji='📄 '; }
        // avulso fica com a classe cal-ev padrão (azul)
        const evLabel=emoji+esc((o.cliente||'').split(' ')[0]);
        const title=`${esc(o.cliente||'')} — ${esc(o.tecnico||'')}${tipo==='vistoria'?' [Vistoria]':tipo==='orcamento'?' [Do orçamento]':' [Avulsa]'}`;
        h+=`<div class="cal-ev ${o.status||'agendado'}" title="${title}" onclick="verDetalhesOS('${o.id}')" style="cursor:pointer;${extraStyle}">${evLabel}</div>`;
      });
      if(osNoDia.length>3) h+=`<div style="font-size:9px;color:var(--gray)">+${osNoDia.length-3}</div>`;
      h+='</td>';
      if(dia>ultimo&&col<6) h+='<td class="outro-mes"></td>';
      dia++;
    }
    h+='</tr>';
  }
  h+='</tbody>';
  el.innerHTML=h;
}

function verDetalhesOS(id){
  // Achado na 3i.5 (19/08): getNC(id) SEMPRE retorna um objeto (nunca
  // null — é {} quando não achado), então "getNC(id)||fallback" nunca caía
  // no fallback: {} é truthy. Só não estourava antes porque essa função só
  // era chamada a partir de botões dentro da própria renderOSTabela/
  // Minhas OS, que já tinham acabado de popular _nc[id] de verdade. Agora
  // que o cartão de estado do orçamento (3i.5) chama isto direto — sem
  // passar primeiro pela tabela de OS — o cache podia estar vazio e o
  // modal mostrava "OS #000"/tudo em branco. Corrigido checando se o
  // cache tem conteúdo de verdade antes de confiar nele.
  const nc=getNC(id);
  const o=(nc&&nc.id)?nc:todosOS.find(x=>x.id===id)||(()=>{ try{ return JSON.parse(ls('fluxa_os_hist')||'[]').find(x=>x.id===id); }catch(e){ return null; } })();
  if(!o){ toast('OS não encontrada'); return; }
  const tipo=_osTipo(o);
  const statusLabel={agendado:'📋 Agendado',concluido:'✅ Concluído',cancelado:'🚫 Cancelado',em_andamento:'🔧 Em andamento'};
  const tipoBg={vistoria:'#f3e8ff',orcamento:'#fff7ed',servico:'#eff6ff'};
  const tipoCor={vistoria:'#7c3aed',orcamento:'#c45e0a',servico:'#1d4ed8'};
  const tipoLabel={vistoria:'🔍 Vistoria mensal',orcamento:'📄 Do orçamento',servico:'🔧 Serviço avulso'};
  const dataFmt=o.data_servico?new Date(o.data_servico+'T12:00:00').toLocaleDateString('pt-BR'):'—';
  const svcs=Array.isArray(o.servicos)?o.servicos.map(s=>typeof s==='string'?s:(s.desc||s)).filter(Boolean).join(', '):'—';
  const existing=document.getElementById('modal-detalhes-os');
  if(existing) existing.remove();
  const m=document.createElement('div');
  m.id='modal-detalhes-os';
  m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px';
  const podeExecutar=o.status!=='concluido'&&o.status!=='cancelado';
  m.innerHTML=`<div style="background:#fff;border-radius:16px;padding:24px;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Inter,sans-serif">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-size:16px;font-weight:800;color:#111">OS #${String(o.numero||'').padStart(3,'0')}</div>
        <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:50px;font-size:11px;font-weight:700;background:${tipoBg[tipo]};color:${tipoCor[tipo]}">${tipoLabel[tipo]}</span>
      </div>
      <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${o.status==='concluido'?'#dcfce7':o.status==='cancelado'?'#fee2e2':'#dbeafe'};color:${o.status==='concluido'?'#16a34a':o.status==='cancelado'?'#dc2626':'#2563eb'}">${statusLabel[o.status]||o.status}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:9px;font-size:13px;color:#374151">
      <div><span style="font-weight:700">👤 Cliente:</span> ${esc(o.cliente||'—')}</div>
      <div><span style="font-weight:700">📍 Local:</span> ${esc(o.local_servico||'—')}</div>
      <div><span style="font-weight:700">📅 Data:</span> ${dataFmt}${o.hora?' às '+esc(o.hora):''}</div>
      <div><span style="font-weight:700">🔧 Técnico:</span> ${esc(o.tecnico||'—')}</div>
      <div><span style="font-weight:700">🛠 Serviços:</span> ${esc(svcs)}</div>
      ${o.obs_tecnica?`<div><span style="font-weight:700">📝 Obs:</span> ${esc(o.obs_tecnica)}</div>`:''}
      ${o.duracao_min?`<div><span style="font-weight:700">⏱ Duração:</span> ${o.duracao_min} min</div>`:''}
      ${(()=>{ try{ const chk=o.checklist?(typeof o.checklist==='string'?JSON.parse(o.checklist):o.checklist):[]; const ok=chk.filter(x=>x.checked); if(!ok.length) return ''; return `<div><span style="font-weight:700">✅ Checklist:</span><div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">${ok.map(x=>`<div style="display:flex;align-items:flex-start;gap:6px;font-size:12px"><span style="color:var(--green);font-weight:700">✓</span><span>${esc(x.nome)}${x.obs?` <span style="color:#6b7280">— ${esc(x.obs)}</span>`:''}</span></div>`).join('')}</div></div>`; }catch(e){ return ''; } })()}
    </div>
    <div style="display:flex;gap:8px;margin-top:18px">
      <button onclick="this.closest('[id=modal-detalhes-os]').remove()" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #e5e7eb;background:#fff;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer">Fechar</button>
      ${podeExecutar?`<button onclick="this.closest('[id=modal-detalhes-os]').remove();editarOS('${o.id}');go('os')" style="flex:2;padding:10px;border-radius:8px;border:none;background:var(--c1);color:#fff;font-family:Inter,sans-serif;font-size:13px;font-weight:700;cursor:pointer">🔧 Abrir e executar</button>`:''}
    </div>
  </div>`;
  m.addEventListener('click',e=>{ if(e.target===m) m.remove(); });
  document.body.appendChild(m);
}

function renderAgLista(){
  const el=document.getElementById('ag-lista-body'); if(!el) return;
  let ativos=todosAg.filter(a=>a.ativo!==false);
  ativos=filtrarPorLoja(ativos);
  if(!ativos.length){ el.innerHTML='<div class="empty-st"><div class="ei">📅</div><p>Nenhum agendamento recorrente.</p></div>'; return; }
  const periodos={semanal:'Semanal',quinzenal:'Quinzenal',mensal:'Mensal'};
  el.innerHTML=ativos.map(a=>{
    const isPlano=!!(a.local_id||(a.id&&a.id.startsWith('ag_plano_')));
    const badge=isPlano?`<span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;background:#ede9fe;color:#7c3aed;margin-left:6px">📍 Plano</span>`:'';
    return `
    <div class="agenda-card" style="${isPlano?'border-left:3px solid #7c3aed;':''}" >
      <div class="agenda-info">
        <div class="agenda-titulo">${esc(a.cliente||'—')}${badge} <span style="font-size:12px;font-weight:400;color:var(--gray)">— ${esc(a.tipo_servico||'')}</span></div>
        <div class="agenda-sub">📍 ${esc(a.local_servico||'—')} &nbsp;·&nbsp; 👤 ${esc(a.tecnico||'—')} &nbsp;·&nbsp; ⏰ ${esc(a.horario||'')}</div>
        <div class="agenda-sub" style="margin-top:2px">🔁 ${periodos[a.periodicidade]||a.periodicidade} &nbsp;·&nbsp; Início: ${a.data_inicio?new Date(a.data_inicio+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap">
        ${isPlano?`<button class="tb" style="background:#ede9fe;color:#7c3aed;border-color:#ddd6fe" onclick="go('visitas')">📍 Ver Plano</button>`:`<button class="tb" style="background:var(--c1-light);color:var(--c1);border-color:var(--c1-mid)" onclick="novaVistoria('${esc(a.cliente||'')}','${esc(a.local_servico||'')}','${esc(a.tecnico||'')}')">🔍 Vistoria</button>`}
        <button class="tb d" onclick="cancelarSerie('${a.id}')">🚫 Cancelar</button>
      </div>
    </div>`;
  }).join('');
}

// ── CHECK-IN / CHECK-OUT ──
function populaTecCheckIn(){
  const sel=document.getElementById('os-tec-checkin'); if(!sel) return;
  const tecs=getTecnicos();
  sel.innerHTML='<option value="">Selecione o técnico…</option>'+tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  // Pré-seleciona o último técnico usado
  const ult=ls('fluxa_ultimo_tec'); if(ult) sel.value=ult;
}

let osCheckinId=null;
function fazerCheckin(){
  const tec=gV('os-tec-checkin'); if(!tec){ toast('⚠️ Selecione o técnico'); return; }
  checkinAt=new Date(); lsSet('fluxa_ultimo_tec',tec);
  osCheckinId=osEditId; // id da OS aberta (antes usava editId do orçamento — registro errado)
  document.getElementById('checkin-form').style.display='none';
  document.getElementById('checkin-bar').style.display='flex';
  document.getElementById('checkin-info').textContent='Check-in: '+checkinAt.toLocaleTimeString('pt-BR');
  if(checkinTimer) clearInterval(checkinTimer);
  checkinTimer=setInterval(()=>{
    const diff=Math.floor((new Date()-checkinAt)/1000);
    const h=String(Math.floor(diff/3600)).padStart(2,'0');
    const m=String(Math.floor((diff%3600)/60)).padStart(2,'0');
    const s=String(diff%60).padStart(2,'0');
    const el=document.getElementById('checkin-timer'); if(el) el.textContent=h+':'+m+':'+s;
  },1000);
  // Persiste "em campo" de verdade (achado ao planejar a 3i.6, 19/08) —
  // antes o check-in só existia em memória local (checkinAt), sem refletir
  // no banco até o checkout. Sem isso "em campo" nunca era visível de
  // outro aparelho — um gestor olhando o orçamento/histórico de outro
  // computador nunca via a OS realmente em campo, só depois de concluída.
  // É o dado real que a coluna Execução (3i.2), o cartão de estado do
  // orçamento (3i.5) e o cartão de estado da própria OS (3i.6) precisam.
  if(osCheckinId){
    const j=(todosOS||[]).findIndex(x=>x.id===osCheckinId);
    if(j>=0) todosOS[j]={...todosOS[j], status:'em_andamento', checkin_time:checkinAt.toISOString(), tecnico:tec};
    try{
      const lista=JSON.parse(ls('fluxa_os_hist')||'[]');
      const i=lista.findIndex(x=>x.id===osCheckinId);
      if(i>=0){ lista[i]={...lista[i], status:'em_andamento', checkin_time:checkinAt.toISOString(), tecnico:tec}; lsSet('fluxa_os_hist',JSON.stringify(lista.slice(0,200))); }
    }catch(e){ console.warn('[checkin OS local]', e?.message||e); }
    if(dbOk&&db&&!String(osCheckinId).startsWith('local_')){
      dbUpdate('ordens_servico', {status:'em_andamento', checkin_time:checkinAt.toISOString(), tecnico:tec}, 'id', osCheckinId)
        .then(r=>{ if(r.error) console.warn('[checkin OS] sync falhou:', r.error.message); })
        .catch(e=>console.warn('[checkin OS]', e?.message||e));
    }
    // Reflete "em campo" na trilha/cartão na hora, sem precisar reabrir a OS.
    const osAtual=todosOS[j]; if(osAtual) _osMontarTopoEstado(osAtual);
  }
  toast('📍 Check-in realizado!');
}

// ── Finalizar serviço (Tarefa 3i.7, 19/08) — passo terminal único.
// Substitui Concluir + Check-out + Salvar dentro do form (page-minhas-os
// mantém o atalho de 1 toque pra OS sem nada a registrar — "não mexer" do
// plano). Reaproveita _fazerCheckoutConfirmado() como motor de
// persistência (mesma lógica de sempre: materiais/obs/fotos/checklist,
// duração, baixa de estoque, próxima ocorrência recorrente) — chamado
// DIRETO (não via fazerCheckout()/confirmar(), que abriria um SEGUNDO
// modal de confirmação por cima do meu; este modal já É a confirmação).
// A confirmação por serviço vira itens do checklist ANTES de chamar —
// mesma estrutura que já existe e já persiste, sem coluna nova.
let _finalizarOSConf={}; // {idx: {feito:bool, motivo:string}}
function abrirFinalizarOS(){
  if(!checkinAt){ toast('⚠️ Faça o check-in primeiro'); return; }
  _finalizarOSConf={};
  (osSvcs||[]).forEach((s,i)=>{ _finalizarOSConf[i]={feito:true, motivo:''}; });
  _finalizarOSRender();
  document.getElementById('finalizar-os-modal-bg').classList.add('on');
}
function fecharFinalizarOS(){ document.getElementById('finalizar-os-modal-bg').classList.remove('on'); }
function _finalizarOSSetStatus(idx, feito){
  _finalizarOSConf[idx]=_finalizarOSConf[idx]||{};
  _finalizarOSConf[idx].feito=feito;
  if(feito){ _finalizarOSConf[idx].motivo=''; _finalizarOSConf[idx].decisao=''; }
  _finalizarOSRender();
}
function _finalizarOSSetMotivo(idx, val){ if(_finalizarOSConf[idx]) _finalizarOSConf[idx].motivo=val; }
// Reagendar ou abater — decisão sempre perguntada, sem padrão pré-
// selecionado (confirmado com o Marcos em 19/08, Tarefa 3i.8).
function _finalizarOSSetDecisao(idx, val){ if(_finalizarOSConf[idx]) _finalizarOSConf[idx].decisao=val; }
function _finalizarOSRender(){
  const el=document.getElementById('finalizar-os-conteudo'); if(!el) return;
  const diffSeg=Math.max(0,Math.floor((new Date()-checkinAt)/1000));
  const durMin=Math.round(diffSeg/60);
  // Materiais é texto livre (ordens_servico.materiais) — sem estrutura de
  // chips real hoje (limitação já registrada), contagem aproximada por
  // linha/vírgula não vazia.
  const qtdMat=(gV('os-mat')||'').split(/\n|,/).map(x=>x.trim()).filter(Boolean).length;
  const qtdFotos=(osFotosAntes||[]).filter(Boolean).length+(osFotosDepois||[]).filter(Boolean).length;
  const pendentes=(osSvcs||[]).filter((s,i)=>!_finalizarOSConf[i]?.feito).length;
  const semDecisao=(osSvcs||[]).filter((s,i)=>{ const c=_finalizarOSConf[i]; return c&&!c.feito&&!c.decisao; }).length;
  const isContratoMensal=!!(todosOS||[]).find(x=>x.id===osCheckinId)?.agendamento_id;
  el.innerHTML=`
    <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:4px">
      <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--c2)">Finalizar serviço</h3>
      <p style="margin:0;font-size:12px;color:var(--tx3,#6B7686)">Confirme o que foi feito antes de encerrar.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0">
      <div style="text-align:center;padding:10px;background:var(--bg-app,#F7F9FC);border-radius:10px">
        <div style="font-size:20px;font-weight:600;color:var(--c2);font-variant-numeric:tabular-nums">${durMin}min</div>
        <div style="font-size:10px;color:var(--tx3,#6B7686);text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Duração</div>
      </div>
      <div style="text-align:center;padding:10px;background:var(--bg-app,#F7F9FC);border-radius:10px">
        <div style="font-size:20px;font-weight:600;color:var(--c2);font-variant-numeric:tabular-nums">${qtdMat}</div>
        <div style="font-size:10px;color:var(--tx3,#6B7686);text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Materiais</div>
      </div>
      <div style="text-align:center;padding:10px;background:var(--bg-app,#F7F9FC);border-radius:10px">
        <div style="font-size:20px;font-weight:600;color:var(--c2);font-variant-numeric:tabular-nums">${qtdFotos}</div>
        <div style="font-size:10px;color:var(--tx3,#6B7686);text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Fotos</div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--tx3,#6B7686);margin-bottom:8px">Serviço vendido — o que foi feito?</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
      ${(osSvcs||[]).map((s,i)=>{
        const conf=_finalizarOSConf[i]||{feito:true,motivo:''};
        return `<div style="border:1px solid var(--line,#DFE5EE);border-radius:10px;padding:10px 12px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="flex:1;font-size:13px;color:var(--c2)">${esc(s.d||'—')}</span>
            <button type="button" onclick="_finalizarOSSetStatus(${i},true)" style="padding:6px 12px;border-radius:7px;border:1.5px solid ${conf.feito?'var(--ok)':'var(--gray-mid,#e5e7eb)'};background:${conf.feito?'var(--ok-bg,#E9F3EB)':'#fff'};color:${conf.feito?'var(--ok)':'var(--tx3,#6B7686)'};font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Fiz</button>
            <button type="button" onclick="_finalizarOSSetStatus(${i},false)" style="padding:6px 12px;border-radius:7px;border:1.5px solid ${!conf.feito?'var(--bad)':'var(--gray-mid,#e5e7eb)'};background:${!conf.feito?'var(--bad-bg,#FBEAE7)':'#fff'};color:${!conf.feito?'var(--bad)':'var(--tx3,#6B7686)'};font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Não fiz</button>
          </div>
          ${!conf.feito?`<input type="text" value="${esc(conf.motivo||'')}" oninput="_finalizarOSSetMotivo(${i},this.value)" placeholder="Motivo — por que não foi feito?" style="width:100%;margin-top:8px;padding:8px 10px;border:1.5px solid var(--bad,#9C3A2E);border-radius:7px;font-size:12px;box-sizing:border-box;font-family:inherit">
          <select onchange="_finalizarOSSetDecisao(${i},this.value)" style="width:100%;margin-top:6px;padding:8px 10px;border:1.5px solid ${conf.decisao?'var(--gray-mid,#e5e7eb)':'var(--bad,#9C3A2E)'};border-radius:7px;font-size:12px;box-sizing:border-box;font-family:inherit;background:#fff">
            <option value="" ${!conf.decisao?'selected':''}>O que fazer com este item?</option>
            <option value="reagendar" ${conf.decisao==='reagendar'?'selected':''}>Reagendar (ainda vai ser feito)</option>
            <option value="abater" ${conf.decisao==='abater'?'selected':''}>Abater da cobrança</option>
          </select>`:''}
        </div>`;
      }).join('')||'<div style="font-size:12px;color:var(--tx3,#6B7686)">Nenhum serviço vendido nesta OS.</div>'}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;padding:12px;background:var(--bg-app,#F7F9FC);border-radius:10px">
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--c2)" title="${isContratoMensal?'Contrato mensal — enviado direto ao cliente':'Fica pendente de revisão antes de enviar'}">
        <input type="checkbox" checked disabled style="width:16px;height:16px">Gerar relatório de serviço${isContratoMensal?' — envio automático (contrato mensal)':' — fica pendente de revisão'}
      </label>
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--c2);cursor:pointer">
        <input type="checkbox" id="finalizar-os-wa" style="width:16px;height:16px">Mandar no WhatsApp do cliente
      </label>
    </div>
    <div style="font-size:11px;color:var(--tx3,#6B7686);line-height:1.4;margin-bottom:14px">O faturamento não muda aqui — ele já aconteceu na aprovação do orçamento.</div>
    <div style="display:flex;gap:10px">
      <button type="button" onclick="fecharFinalizarOS()" style="flex:1;padding:11px;border:1.5px solid var(--gray-mid,#e5e7eb);border-radius:9px;background:#fff;color:var(--c2);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancelar</button>
      <button type="button" onclick="confirmarFinalizarOS()" style="flex:2;padding:11px;border:none;border-radius:9px;background:#0B62CE;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Finalizar${pendentes?' ('+pendentes+' sem confirmar)':''}</button>
    </div>
  `;
}
function confirmarFinalizarOS(){
  const semDecisaoCount=(osSvcs||[]).filter((s,i)=>{ const c=_finalizarOSConf[i]; return c&&!c.feito&&!c.decisao; }).length;
  if(semDecisaoCount){ toast('⚠️ Escolha "reagendar" ou "abater" pra cada item não executado'); return; }
  const itensServico=(osSvcs||[]).map((s,i)=>{
    const conf=_finalizarOSConf[i]||{feito:true,motivo:''};
    return {label:s.d||'Serviço', checked:conf.feito, servico:true, obs:conf.feito?'':('Não executado — '+(conf.motivo||'sem motivo informado'))};
  });
  osChecklist=[...(osChecklist||[]), ...itensServico];
  // Serviços não executados, com a decisão (reagendar/abater) — nunca some,
  // per o achado do diagnóstico ("hoje esse caso simplesmente desaparece").
  // Não automatiza o reagendamento/abatimento em si (criar OS nova ou
  // mexer em valor de orçamento é decisão maior, fora desta tarefa) — só
  // garante que o registro fica visível no relatório.
  const pendentesRelatorio=(osSvcs||[]).map((s,i)=>{
    const conf=_finalizarOSConf[i];
    if(!conf||conf.feito) return null;
    return {desc:s.d||'Serviço', motivo:conf.motivo||'', decisao:conf.decisao};
  }).filter(Boolean);
  const mandarWA=document.getElementById('finalizar-os-wa')?.checked;
  const osIdAtual=osCheckinId;
  const isContratoMensal=!!(todosOS||[]).find(x=>x.id===osIdAtual)?.agendamento_id;
  fecharFinalizarOS();
  _fazerCheckoutConfirmado();
  // Relatório (3i.8) — update separado do checkout, mesmo id. Contrato
  // mensal (agendamento_id) marca enviado na hora; o resto fica pendente
  // de revisão — decisão do Marcos (19/08): nenhum relatório de valor alto
  // ou com serviço não executado sai sem alguém olhar antes. A revisão
  // manual acontece pelo botão "Enviar relatório" no Histórico de OS
  // (enviarRelatorioOS), que gera o mesmo documento e só então marca.
  if(osIdAtual){
    const extras={relatorio_servicos_pendentes: pendentesRelatorio.length?pendentesRelatorio:null};
    if(isContratoMensal) extras.relatorio_enviado_em=new Date().toISOString();
    const j=(todosOS||[]).findIndex(x=>x.id===osIdAtual);
    if(j>=0) todosOS[j]={...todosOS[j], ...extras};
    if(dbOk&&db&&!String(osIdAtual).startsWith('local_')){
      dbUpdate('ordens_servico', extras, 'id', osIdAtual).catch(e=>console.warn('[relatorio OS]', e?.message||e));
    }
  }
  if(mandarWA && osIdAtual){
    // todosOS direto, não getNC() — mesmo cuidado do fix em verDetalhesOS
    // (3i.5): o cache só é populado por quem renderiza a tabela de OS, e
    // aqui acabamos de concluir sem passar por ela.
    const o=(todosOS||[]).find(x=>x.id===osIdAtual);
    if(o) enviarNotifWA(notifConcluida(o), o.tel_cliente||'');
  }
  toast(isContratoMensal
    ? '✅ Serviço finalizado — relatório enviado automaticamente (contrato mensal)'
    : '✅ Serviço finalizado — relatório pendente de revisão antes de enviar');
}
// Revisão manual do relatório (3i.8) — botão no Histórico de OS pra quem
// não é contrato mensal (fica pendente até alguém olhar e confirmar o
// envio). Abre o PDF (o técnico/gestor pode ler antes de mandar) e só
// então marca relatorio_enviado_em — o clique NELE já É a revisão.
function enviarRelatorioOS(id){
  const o=(todosOS||[]).find(x=>x.id===id); if(!o){ toast('OS não encontrada'); return; }
  gerarRelatorioOS(id,'cliente');
  if(!o.relatorio_enviado_em){
    const agora=new Date().toISOString();
    o.relatorio_enviado_em=agora;
    if(dbOk&&db&&!String(id).startsWith('local_')) dbUpdate('ordens_servico',{relatorio_enviado_em:agora},'id',id).catch(e=>console.warn('[relatorio enviar]',e?.message||e));
    toast('✅ Relatório marcado como enviado');
  }
}

function fazerCheckout(){
  if(!checkinAt){ toast('⚠️ Faça o check-in primeiro'); return; }
  confirmar('Confirmar check-out e marcar OS como concluída?', _fazerCheckoutConfirmado, 'Check-out');
}
let _checkoutEmAndamento=false;
function _fazerCheckoutConfirmado(){
  if(_checkoutEmAndamento) return;
  _checkoutEmAndamento=true;
  const checkout=new Date();
  const duracaoMin=Math.round((checkout-checkinAt)/60000);
  if(checkinTimer){ clearInterval(checkinTimer); checkinTimer=null; }
  document.getElementById('checkin-bar').style.display='none';
  document.getElementById('checkin-form').style.display='flex';
  document.getElementById('checkin-info').textContent=`✅ Duração: ${duracaoMin} min (${checkinAt.toLocaleTimeString('pt-BR')} → ${checkout.toLocaleTimeString('pt-BR')})`;
  // Captura o que o técnico preencheu na OS para salvar JUNTO com o check-out.
  // x.servico (Tarefa 3i.7, achado ao testar): itens de confirmação por
  // serviço vendido (Fiz/Não fiz) precisam ser salvos SEMPRE, feito ou
  // não — o filtro original (só x.checked) existia pro checklist
  // operacional, onde "não marcado" = "não relevante". Pra serviço vendido
  // é o oposto: "não fiz" é justamente o dado que evita cobrar por
  // trabalho não executado, e esse filtro estava descartando exatamente
  // essa informação antes de chegar no banco.
  const chkOk = (osChecklist||[]).filter(x=>x.checked || x.servico);
  const dadosPreenchidos = {
    obs_tecnica: gV('os-obs')||'',
    materiais: _osMatTextoFinal(),
    fotos: {antes:(osFotosAntes||[]).filter(Boolean), depois:(osFotosDepois||[]).filter(Boolean)},
    video_link: gV('os-video-link')||null,
    checklist: chkOk.length?JSON.stringify(chkOk):null,
    tecnico: gV('os-tec-checkin')||gV('os-tec')||''
  };
  if(dbOk&&db&&osCheckinId&&!String(osCheckinId).startsWith('local_')){
    // Lista estruturada de material vai pra tabela própria; a string em
    // ordens_servico.materiais continua sendo a versão legível de sempre.
    _osSyncMateriais(osCheckinId);
    // checkin_time/checkout_time são os nomes reais das colunas no banco
    dbUpdate('ordens_servico', {
      checkin_time:checkinAt.toISOString(),
      checkout_time:checkout.toISOString(),
      duracao_min:duracaoMin,
      status:'concluido',
      ...dadosPreenchidos
    }, 'id', osCheckinId).then(r=>{ if(r.error) console.warn('[checkout OS] sync falhou:', r.error.message); }).catch(e=>console.warn('[checkout OS]', e?.message||e));
  }
  // Atualiza o cache local (calendário/Minhas OS refletem na hora)
  if(osCheckinId){
    try{
      const lista=JSON.parse(ls('fluxa_os_hist')||'[]');
      const i=lista.findIndex(x=>x.id===osCheckinId);
      if(i>=0){ lista[i]={...lista[i],...dadosPreenchidos,status:'concluido',duracao_min:duracaoMin}; lsSet('fluxa_os_hist',JSON.stringify(lista.slice(0,200))); }
      const j=(todosOS||[]).findIndex(x=>x.id===osCheckinId);
      if(j>=0) todosOS[j]={...todosOS[j],...dadosPreenchidos,status:'concluido',duracao_min:duracaoMin};
    }catch(e){ console.warn('[checkout OS local]', e?.message||e); }
  }
  _entregarPelaOS(osCheckinId); // baixa do estoque do orçamento vinculado, se houver
  const _osConcl=(todosOS||[]).find(x=>x.id===osCheckinId);
  logAcao('os_concluida', `OS #${_osConcl?.numero||'?'} ${_osConcl?.cliente||''} · ${duracaoMin} min · ${dadosPreenchidos.tecnico||''}`);
  // Se era OS de agendamento recorrente, gera a próxima ocorrência automaticamente
  if(_osConcl?.agendamento_id) _gerarProximaOSdoAg(_osConcl.agendamento_id, _osConcl.data_servico).catch(e=>console.warn('[nextOS]',e?.message||e));
  checkinAt=null; osCheckinId=null; _checkoutEmAndamento=false;
  toast(`✅ Check-out! OS concluída · ${duracaoMin} min`);
}

// ══════════════════════════════════════════════════
//  MÓDULO 1b — PISCINAS (ficha técnica + consumo teórico de químicos)
//  Portado do fluxa-app v1 (16/08 e 17/08) — setup-v2-delta29.sql cria a
//  tabela. Cálculo puro entra logo abaixo; a UI de cadastrar/selecionar
//  piscina em Equipamentos (cadastro, inline) e Vistoria (seleção, só
//  leitura — cadastro fica em Equipamentos, igual v1) está mais abaixo,
//  perto de cada módulo (_eqRenderPiscinas/_visRenderPiscinas).
// ══════════════════════════════════════════════════

// Estação do ano no Brasil (hemisfério sul).
function _estacaoAtual(){
  const mes=new Date().getMonth()+1;
  if([12,1,2,3].includes(mes)) return 'verao';
  if([6,7,8].includes(mes)) return 'inverno';
  return 'meia_estacao';
}

const D_REF_CLORO=2.0; // g Cl2/m3/dia — referência verão/externa/moderado/estabilizada

// Demanda diária de cloro ajustada pelos fatores da piscina. Coeficientes
// multiplicam (ponto médio de cada faixa da referência técnica); banhistas
// de condomínio SOMA, não multiplica. Só entram os fatores que a ficha da
// piscina já captura (setup-v2-delta29.sql) — a referência lista mais
// (chuva, ozônio/UV, filtragem ruim) que exigiriam campos que não existem
// no cadastro ainda.
function demandaDiaria(piscina){
  let d=D_REF_CLORO;
  const estacao=_estacaoAtual();
  d *= estacao==='verao' ? 1.0 : estacao==='meia_estacao' ? 0.70 : 0.45;
  if(piscina.capa_termica) d *= 0.50;
  if(piscina.exposicao_solar==='parcial') d *= 0.70;
  if(piscina.aquecida) d *= 1.30;
  if(piscina.estabilizante===false) d *= 2.15;
  if(piscina.tipo_uso==='condominio' && piscina.banhistas_dia && piscina.volume_m3){
    d += (piscina.banhistas_dia*4)/piscina.volume_m3;
  }
  return d;
}

// A = teor ativo (fração). Embalagem de referência = a mais comum pra esse
// tipo — não tenta casar com a embalagem exata que o cliente comprou (isso
// exigiria rastrear produto_id por venda, fora do escopo desta 1ª versão).
const CONSUMO_QUIMICO_REF={
  dicloro_granulado:  {A:0.58, embalagemG:10000, embalagemLabel:'um balde de 10kg'},
  hipoclorito_calcio: {A:0.65, embalagemG:10000, embalagemLabel:'um balde de 10kg'},
  pastilha_tricloro:  {A:0.90, embalagemG:5000,  embalagemLabel:'um balde de 5kg (25 pastilhas)'}
};
// `d` já vem calculado (demandaDiaria(piscina)) — quem chama decide os
// fatores. Retorna {dias, embalagemLabel} ou null se não tiver cálculo pro
// tipo, ou faltar volume.
function consumoTeoricoDias(tipoTratamento, volumeM3, d, exposicaoSolar){
  if(!volumeM3 || volumeM3<=0) return null;
  d = d==null ? D_REF_CLORO : d;
  if(tipoTratamento==='cloro_liquido_10'){
    // A = 100 g Cl2 por litro de produto (concentração 10%)
    const qLm3dia=d/100;
    const dias=20000/(qLm3dia*1000*volumeM3); // bombona 20L = 20.000mL
    return {dias:Math.round(dias), embalagemLabel:'uma bombona de 20L'};
  }
  if(tipoTratamento==='sal_salino'){
    // Sal não segue a demanda de cloro — usa a taxa de perda de água (r),
    // não `d`.
    const r=0.0035; // perda residencial default (0,2–0,5%/dia)
    const dias=25/(3.2*volumeM3*r);
    return {dias:Math.round(dias), embalagemLabel:'um saco de 25kg de sal'};
  }
  if(tipoTratamento==='bromo'){
    // d_Br NÃO deriva do `d` do cloro (que mistura estação/capa/aquecida —
    // usar isso aqui confundiria uma piscina exposta no inverno com uma
    // protegida no verão). 2 pontos de referência fixos por contexto, usa
    // exposicao_solar da piscina diretamente.
    const dBr = exposicaoSolar==='parcial' ? 2.5 : 7.0;
    const dias=3050/(dBr*volumeM3); // balde 5kg, 250un, 3.050g halogênio
    return {dias:Math.round(dias), embalagemLabel:'um balde de 5kg de pastilhas (250 un)'};
  }
  if(tipoTratamento==='peroxido'){
    // Dose fixa de rótulo, não deriva da demanda de cloro.
    const dias=20000/(7.5*volumeM3); // bombona 20L
    return {dias:Math.round(dias), embalagemLabel:'uma bombona de 20L'};
  }
  const ref=CONSUMO_QUIMICO_REF[tipoTratamento]; if(!ref) return null;
  const q=d/ref.A; // g de produto por m3 por dia
  const dias=ref.embalagemG/(q*volumeM3);
  return {dias:Math.round(dias), embalagemLabel:ref.embalagemLabel};
}

// Carregamento simples (sem cache local ainda — piscina é cadastro leve,
// não crítico offline como estoque/orçamento). Usada pela ficha em
// Equipamentos, pelo seletor em Vistoria e pela análise de cadência.
let todasPiscinas = [];
async function loadPiscinas(){
  if(!(dbOk&&db&&EMPRESA_ID)) return;
  try{
    const {data,error}=await db.from('piscinas').select('*').eq('empresa_id',EMPRESA_ID).eq('ativo',true);
    if(error) throw error;
    todasPiscinas=data||[];
  }catch(e){ console.warn('[loadPiscinas]', e?.message||e); }
}

// ── Ficha de piscina em Equipamentos (17/08, portado do fluxa-app v1) ──
// Cadastro/edição vive aqui; Vistoria só SELECIONA (ver _visRenderPiscinas,
// perto do módulo de Vistoria). Só lista/permite cadastrar quando o
// cliente foi ESCOLHIDO (lupa ou sugestão), não só digitado — precisa do
// cliente_id real pra vincular a piscina a ele.
let _eqClienteSelecionado = null; // {id, nome} — null se digitado à mão
let _eqPiscinaSelecionadaId = null;
let _eqPiscinaEditId = null;

function mostrarSugestoesCliEq(val){
  const sug = document.getElementById('eq-cli-suggestions'); if(!sug) return;
  setV('eq-cli-id',''); _eqClienteSelecionado=null; _eqPiscinaSelecionadaId=null;
  const _npF=document.getElementById('eq-piscina-novo'); if(_npF) _npF.style.display='none';
  _eqRenderPiscinas();
  if(!val||val.length<2){ sug.style.display='none'; return; }
  const clientes = JSON.parse(ls('fluxa_clientes_full')||'[]');
  const hits = clientes.filter(c=>(c.nome||'').toLowerCase().includes(val.toLowerCase())).slice(0,5);
  if(!hits.length){ sug.style.display='none'; return; }
  sug.innerHTML = hits.map(c=>`<div class="cli-suggestion-item" onmousedown="selecionarCliEq('${esc(c.id||'')}','${esc(c.nome||'')}')"><div class="cli-sug-name">${esc(c.nome)}</div></div>`).join('');
  sug.style.display='block';
}
function hideSugCliEq(){ const el=document.getElementById('eq-cli-suggestions'); if(el) el.style.display='none'; }
function selecionarCliEq(id, nome){
  const inp=document.getElementById('eq-cli-nome'); if(inp) inp.value=nome;
  setV('eq-cli-id', id||'');
  _eqClienteSelecionado = id ? {id, nome} : null;
  hideSugCliEq();
  _eqPiscinaSelecionadaId=null;
  const _npF2=document.getElementById('eq-piscina-novo'); if(_npF2) _npF2.style.display='none';
  _eqRenderPiscinas();
}

// Não mexe em eq-piscina-novo aqui — quem decide se o form inline de
// cadastro fica aberto ou fechado é quem CHAMA esta função (achado ao
// testar: _eqPiscinaSelect('__nova__') abria o form e, na sequência, essa
// própria função fechava de novo, deixando "+ Cadastrar nova piscina…"
// sem efeito nenhum na tela).
function _eqRenderPiscinas(){
  const sel=document.getElementById('eq-piscina'); if(!sel) return;
  const btnEd=document.getElementById('eq-piscina-editar-btn');
  if(!_eqClienteSelecionado?.id){
    sel.innerHTML='<option value="">Selecione o cliente primeiro</option>';
    sel.disabled=true;
    if(btnEd) btnEd.style.display='none';
    return;
  }
  sel.disabled=false;
  const doCliente=(todasPiscinas||[]).filter(p=>p.cliente_id===_eqClienteSelecionado.id && p.ativo!==false);
  sel.innerHTML = '<option value="">Nenhuma / não informado</option>'
    + doCliente.map(p=>`<option value="${esc(p.id)}"${p.id===_eqPiscinaSelecionadaId?' selected':''}>${esc(p.nome||'Piscina')}${p.volume_m3?' — '+p.volume_m3+'m³':''}</option>`).join('')
    + '<option value="__nova__">+ Cadastrar nova piscina…</option>';
  if(_eqPiscinaSelecionadaId && doCliente.some(p=>p.id===_eqPiscinaSelecionadaId)) sel.value=_eqPiscinaSelecionadaId;
  // Editar só faz sentido com uma piscina real escolhida (não '' nem '__nova__').
  if(btnEd) btnEd.style.display = _eqPiscinaSelecionadaId ? '' : 'none';
}
function _eqPiscinaLimparForm(){
  setV('eq-piscina-nome',''); setV('eq-piscina-vol',''); setV('eq-piscina-trat','');
  ['eq-piscina-capa','eq-piscina-aquecida'].forEach(id=>{ const el=document.getElementById(id); if(el) el.checked=false; });
  const est=document.getElementById('eq-piscina-estabilizante'); if(est) est.checked=true;
  setV('eq-piscina-exposicao','pleno'); setV('eq-piscina-uso','residencial'); setV('eq-piscina-banhistas','');
  _eqPiscinaAtualizarUso();
}
// Campo de banhistas só aparece pra condomínio — divulgação progressiva,
// residência não precisa decidir um número que não existe.
function _eqPiscinaAtualizarUso(){
  const uso=gV('eq-piscina-uso');
  const wrap=document.getElementById('eq-piscina-banhistas-wrap');
  if(wrap) wrap.style.display = uso==='condominio' ? '' : 'none';
}
function _eqPiscinaSelect(val){
  const novoForm=document.getElementById('eq-piscina-novo');
  if(val==='__nova__'){
    _eqPiscinaEditId=null;
    novoForm.style.display='block';
    _eqPiscinaLimparForm();
    _eqPiscinaSelecionadaId=null;
  } else {
    novoForm.style.display='none';
    _eqPiscinaSelecionadaId = val||null;
  }
  _eqRenderPiscinas();
}
// Reabre o form inline pré-preenchido com a piscina já escolhida no select
// — sem isto não existia jeito nenhum de completar depois os campos que o
// cadastro rápido não pergunta (capa, exposição, banhistas, etc.).
function _eqPiscinaEditar(){
  if(!_eqPiscinaSelecionadaId) return;
  const p=(todasPiscinas||[]).find(x=>x.id===_eqPiscinaSelecionadaId); if(!p) return;
  _eqPiscinaEditId=p.id;
  document.getElementById('eq-piscina-novo').style.display='block';
  setV('eq-piscina-nome',p.nome||''); setV('eq-piscina-vol',p.volume_m3!=null?String(p.volume_m3):'');
  setV('eq-piscina-trat',p.tipo_tratamento||'');
  const capa=document.getElementById('eq-piscina-capa'); if(capa) capa.checked=!!p.capa_termica;
  const aquec=document.getElementById('eq-piscina-aquecida'); if(aquec) aquec.checked=!!p.aquecida;
  const est=document.getElementById('eq-piscina-estabilizante'); if(est) est.checked=p.estabilizante!==false;
  setV('eq-piscina-exposicao',p.exposicao_solar||'pleno');
  setV('eq-piscina-uso',p.tipo_uso||'residencial');
  setV('eq-piscina-banhistas',p.banhistas_dia!=null?String(p.banhistas_dia):'');
  _eqPiscinaAtualizarUso();
}
async function _eqPiscinaCriar(){
  if(!_eqClienteSelecionado?.id){ toast('⚠️ Selecione o cliente pela lupa 🔍 antes de cadastrar a piscina'); return; }
  const nome=(gV('eq-piscina-nome')||'').trim()||'Piscina principal';
  const vol=parseFloat((gV('eq-piscina-vol')||'').replace(',','.'))||null;
  const trat=(gV('eq-piscina-trat')||'').trim()||null;
  const uso=gV('eq-piscina-uso')||'residencial';
  const dados={
    cliente_id:_eqClienteSelecionado.id, local_id:null, nome, volume_m3:vol, tipo_tratamento:trat,
    capa_termica:!!document.getElementById('eq-piscina-capa')?.checked,
    exposicao_solar:gV('eq-piscina-exposicao')||'pleno',
    aquecida:!!document.getElementById('eq-piscina-aquecida')?.checked,
    tipo_uso:uso,
    banhistas_dia: uso==='condominio' ? (parseInt(gV('eq-piscina-banhistas'))||null) : null,
    estabilizante: document.getElementById('eq-piscina-estabilizante')?.checked!==false,
    loja_id:lojaAtiva||null, ativo:true
  };
  if(_eqPiscinaEditId){
    const idEd=_eqPiscinaEditId;
    const idx=todasPiscinas.findIndex(x=>x.id===idEd);
    if(idx>=0) todasPiscinas[idx]={...todasPiscinas[idx], ...dados};
    _eqPiscinaSelecionadaId=idEd; _eqPiscinaEditId=null;
    document.getElementById('eq-piscina-novo').style.display='none';
    _eqRenderPiscinas();
    toast('✅ Piscina atualizada');
    if(dbOk&&db) dbUpdate('piscinas', dados, 'id', idEd).catch(e=>console.warn('[_eqPiscinaCriar update]', e?.message||e));
    return;
  }
  const tempId='pisc_'+Date.now();
  todasPiscinas.unshift({...dados, id:tempId});
  _eqPiscinaSelecionadaId=tempId;
  document.getElementById('eq-piscina-novo').style.display='none';
  _eqRenderPiscinas();
  toast('✅ Piscina cadastrada');
  if(dbOk&&db){
    try{
      const {data:ins}=await dbInsert('piscinas', dados);
      if(ins){
        todasPiscinas=todasPiscinas.filter(x=>x.id!==tempId); todasPiscinas.unshift(ins);
        if(_eqPiscinaSelecionadaId===tempId){ _eqPiscinaSelecionadaId=ins.id; _eqRenderPiscinas(); }
      }
    }catch(e){ console.warn('[_eqPiscinaCriar]', e?.message||e); }
  }
}

// ══════════════════════════════════════════════════
//  MÓDULO 2 — EQUIPAMENTOS + QR CODE
// ══════════════════════════════════════════════════
let todosEq = [], eqFotoB64 = '', eqEditId = null;
let eqBusca = '', eqFiltroTipo = '';

function abrirFormEq(id){
  eqEditId = id || null;
  const card = document.getElementById('eq-form-card');
  card.style.display = 'block';
  if(id){
    const eq = todosEq.find(x=>x.id===id); if(!eq) return;
    setV('eq-cli-nome', eq.cliente_nome||'');
    setV('eq-cli-id', eq.cliente_id||'');
    setV('eq-tipo', eq.tipo||'');
    setV('eq-marca', eq.marca||'');
    setV('eq-modelo', eq.modelo||'');
    setV('eq-potencia', eq.potencia||'');
    setV('eq-serie', eq.numero_serie||'');
    setV('eq-instalacao', eq.data_instalacao||'');
    setV('eq-garantia', eq.garantia_meses||12);
    setV('eq-garantia-venc', eq.garantia_vencimento||'');
    setV('eq-obs', eq.obs||'');
    eqFotoB64 = eq.foto_base64||'';
    const prev = document.getElementById('eq-foto-prev');
    if(eqFotoB64){ prev.src=eqFotoB64; prev.style.display='block'; document.getElementById('eq-btn-rm-foto').style.display='block'; }
    _eqClienteSelecionado = eq.cliente_id ? {id:eq.cliente_id, nome:eq.cliente_nome} : null;
    _eqPiscinaSelecionadaId = eq.piscina_id || null;
  } else {
    ['eq-cli-nome','eq-cli-id','eq-tipo','eq-marca','eq-modelo','eq-potencia','eq-serie','eq-instalacao','eq-obs'].forEach(id=>setV(id,''));
    setV('eq-garantia','12'); setV('eq-garantia-venc','');
    eqFotoB64='';
    const prev=document.getElementById('eq-foto-prev'); prev.style.display='none';
    document.getElementById('eq-btn-rm-foto').style.display='none';
    document.getElementById('eq-foto-lbl').textContent='Tirar foto ou selecionar imagem';
    _eqClienteSelecionado = null;
    _eqPiscinaSelecionadaId = null;
  }
  document.getElementById('eq-piscina-novo').style.display='none';
  _eqRenderPiscinas();
  card.scrollIntoView({behavior:'smooth'});
}
function fecharFormEq(){ document.getElementById('eq-form-card').style.display='none'; eqEditId=null; eqFotoB64=''; }

function calcVencGarantia(){
  const inst=gV('eq-instalacao'), meses=parseInt(gV('eq-garantia'))||12;
  if(!inst) return '';
  const d=new Date(inst+'T12:00:00'); d.setMonth(d.getMonth()+meses);
  return d.toISOString().split('T')[0];
}

// Atualiza vencimento ao mudar instalação ou meses
document.addEventListener('input', e=>{
  if(e.target.id==='eq-instalacao'||e.target.id==='eq-garantia'){
    setV('eq-garantia-venc', calcVencGarantia());
  }
});

function carregarFotoEq(inp){
  const f=inp.files[0]; if(!f) return;
  if(f.size > FOTO_MAX_BYTES){ toast('⚠️ Foto muito grande (máx 20 MB).'); inp.value=''; return; }
  const r=new FileReader();
  r.onload=e=>{ eqFotoB64=e.target.result;
    const prev=document.getElementById('eq-foto-prev'); prev.src=e.target.result; prev.style.display='block';
    document.getElementById('eq-foto-lbl').textContent=f.name;
    document.getElementById('eq-btn-rm-foto').style.display='block';
  };
  r.readAsDataURL(f);
}
function removerFotoEq(){ eqFotoB64=''; document.getElementById('eq-foto-prev').style.display='none'; document.getElementById('eq-foto-lbl').textContent='Tirar foto ou selecionar imagem'; document.getElementById('eq-btn-rm-foto').style.display='none'; document.getElementById('eq-foto-input').value=''; }

async function salvarEquipamento(){
  const nome=gV('eq-cli-nome').trim(), tipo=gV('eq-tipo');
  if(!nome||!tipo){ toast('⚠️ Informe o cliente e o tipo'); return; }
  const _btnEq=document.querySelector('button[onclick="salvarEquipamento()"]');
  if(_btnEq){ _btnEq.disabled=true; _btnEq.textContent='Salvando…'; }
  const venc=calcVencGarantia();
  const dados={
    cliente_nome:nome, cliente_id:_eqClienteSelecionado?.id||null, piscina_id:_eqPiscinaSelecionadaId||null,
    tipo, marca:gV('eq-marca'), modelo:gV('eq-modelo'),
    potencia:gV('eq-potencia'), numero_serie:gV('eq-serie'),
    data_instalacao:gV('eq-instalacao'), garantia_meses:parseInt(gV('eq-garantia'))||12,
    garantia_vencimento:venc, obs:gV('eq-obs'), foto_base64:eqFotoB64||null, ativo:true,
    loja_id:lojaAtiva||LOJA_PADRAO_ID
  };
  if(eqEditId){
    const idx=todosEq.findIndex(x=>x.id===eqEditId);
    if(idx>=0) todosEq[idx]={...todosEq[idx],...dados};
    lsEqSalvar(todosEq);
    if(dbOk&&db) db.from('equipamentos').update(dados).eq('id',eqEditId).then(()=>{}).catch(()=>{});
    toast('✅ Equipamento atualizado!');
  } else {
    const tempId='eq_'+Date.now();
    const rec={...dados, id:tempId, data_criacao:new Date().toISOString()};
    todosEq.unshift(rec);
    lsEqSalvar(todosEq);
    if(dbOk&&db){
      _eqSyncInFlight.add(tempId); // trava reenvio concorrente (sync periódico) até terminar
      (async()=>{
        try{
          const {data:ins}=await dbInsert('equipamentos', dados);
          if(ins){ todosEq=todosEq.filter(x=>x.id!==tempId); todosEq.unshift(ins); lsEqSalvar(todosEq); renderEqGrid(); }
        }catch(e){ console.warn('eq sync falhou:',e.message); }
        finally{ _eqSyncInFlight.delete(tempId); }
      })();
    }
    toast('✅ Equipamento salvo!');
  }
  if(_btnEq){ _btnEq.disabled=false; _btnEq.textContent='💾 Salvar Equipamento'; }
  fecharFormEq(); renderEqGrid(); verificarAlertasGarantia();
}

// Reenvia equipamentos presos só no aparelho — mesmo padrão de _reenviarDespesasLocais.
const _eqSyncInFlight = new Set();
async function _reenviarEquipamentosLocais(soLocal){
  if(!dbOk||!db||!soLocal||!soLocal.length) return false;
  let mudou=false;
  for(const rec of soLocal){
    if(_eqSyncInFlight.has(rec.id)) continue;
    try{
      const payload={...rec}; delete payload.id;
      const {data:ins,error}=await dbInsert('equipamentos', payload);
      if(error){ console.warn('[reenvioEqLocal] falhou:', error.message); continue; }
      if(ins){ todosEq=todosEq.filter(x=>x.id!==rec.id); todosEq.unshift(ins); mudou=true; }
    }catch(e){ console.warn('[reenvioEqLocal] erro:', e?.message||e); }
  }
  if(mudou){ lsEqSalvar(todosEq); renderEqGrid(); }
  return mudou;
}

function excluirEq(id){
  confirmar('Excluir este equipamento?', ()=>{ todosEq=todosEq.filter(x=>x.id!==id); lsEqSalvar(todosEq); if(dbOk&&db) db.from('equipamentos').delete().eq('id',id).then(()=>{}).catch(()=>{}); renderEqGrid(); toast('🗑 Equipamento excluído'); }, 'Excluir Equipamento');
}

// localStorage para equipamentos
function lsEqLer(){ try{ return JSON.parse(ls('fluxa_equipamentos')||'[]'); }catch(e){ return []; } }
function lsEqSalvar(lista){ lsSet('fluxa_equipamentos', JSON.stringify(lista)); }

async function loadEquipamentos(){
  todosEq = lsEqLer();
  renderEqGrid(); verificarAlertasGarantia();
  if(dbOk&&db){
    try{
      let qEq=db.from('equipamentos').select('*').eq('empresa_id',EMPRESA_ID).eq('ativo',true).order('data_criacao',{ascending:false});
      if(lojaAtiva) qEq=qEq.eq('loja_id',lojaAtiva);
      const {data,error}=await qEq;
      if(error) throw error;
      // MERGE (não sobrescreve) — mesmo achado do loadDespesas (17/08): a troca
      // direta apagava em silêncio qualquer equipamento salvo local ("eq_...")
      // ainda não sincronizado.
      const idsDb=new Set((data||[]).map(x=>x.id));
      const soLocal=todosEq.filter(x=>String(x.id).startsWith('eq_')&&!idsDb.has(x.id)&&!_eqSyncInFlight.has(x.id));
      todosEq=[...(data||[]),...soLocal];
      lsEqSalvar(todosEq); renderEqGrid(); verificarAlertasGarantia();
      if(soLocal.length) await _reenviarEquipamentosLocais(soLocal);
    }catch(e){ console.warn('loadEquipamentos falhou:',e.message); }
  }
}

function buscarEq(v){ eqBusca=v.toLowerCase(); renderEqGrid(); }
function filtrarTipoEq(v){ eqFiltroTipo=v; renderEqGrid(); }

function renderEqGrid(){
  let lista=[...todosEq];
  lista=filtrarPorLoja(lista);
  if(eqFiltroTipo) lista=lista.filter(x=>x.tipo===eqFiltroTipo);
  if(eqBusca) lista=lista.filter(x=>(x.cliente_nome||'').toLowerCase().includes(eqBusca)||(x.marca||'').toLowerCase().includes(eqBusca)||(x.modelo||'').toLowerCase().includes(eqBusca)||(x.tipo||'').toLowerCase().includes(eqBusca));
  const el=document.getElementById('eq-grid');
  const count=document.getElementById('eq-count');
  if(count) count.textContent=lista.length+' equipamento'+(lista.length!==1?'s':'');
  // Dashboard (16/08, redesign task #37) — sempre sobre a base TOTAL da
  // loja ativa, não o resultado filtrado por busca/tipo.
  const _todosLoja=filtrarPorLoja(todosEq);
  const _porTipo={}; _todosLoja.forEach(e=>{ const t=e.tipo||'Outro'; _porTipo[t]=(_porTipo[t]||0)+1; });
  const _tipoTop=Object.entries(_porTipo).sort((a,b)=>b[1]-a[1])[0];
  const _hojeK=new Date(); _hojeK.setHours(0,0,0,0);
  const _garVenc=_todosLoja.filter(e=>{
    if(!e.garantia_vencimento) return false;
    const venc=new Date(e.garantia_vencimento+'T12:00:00');
    return Math.ceil((venc-_hojeK)/86400000)<=30;
  }).length;
  const _clientesDist=new Set(_todosLoja.map(e=>(e.cliente_nome||'').trim().toLowerCase()).filter(Boolean)).size;
  setV_el('eq-d-total', String(_todosLoja.length), 'textContent');
  setV_el('eq-d-tipo', _tipoTop?`mais comum: ${_tipoTop[0]}`:'—', 'textContent');
  setV_el('eq-d-garantia', String(_garVenc), 'textContent');
  setV_el('eq-d-clientes', String(_clientesDist), 'textContent');
  if(!lista.length){ el.innerHTML='<div class="empty-st"><div class="ei">🔧</div><p>Nenhum equipamento encontrado.</p><button class="btn-primary" style="margin-top:12px" onclick="abrirFormEq()">＋ Cadastrar Equipamento</button></div>'; return; }
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  el.innerHTML='';
  lista.forEach(eq=>{
    let gClass='garantia-ok', gTxt='';
    if(eq.garantia_vencimento){
      const venc=new Date(eq.garantia_vencimento+'T12:00:00');
      const diff=Math.ceil((venc-hoje)/(1000*60*60*24));
      if(diff<0){ gClass='garantia-vencida'; gTxt='<span class="eq-alerta vencida">⚠️ Garantia vencida</span>'; }
      else if(diff<=30){ gClass='garantia-alerta'; gTxt=`<span class="eq-alerta">⚠️ Garantia vence em ${diff} dias</span>`; }
    }
    const card=document.createElement('div');
    card.className='eq-card '+gClass;
    card.innerHTML=`
      <div class="eq-tipo">${esc(eq.tipo||'')}</div>
      <div class="eq-nome">${esc(eq.marca||'')} ${esc(eq.modelo||'')}</div>
      <div class="eq-cli">👤 ${esc(eq.cliente_nome||'—')}</div>
      ${gTxt}
      <div class="eq-info">
        ${eq.potencia?`<div class="eq-inf"><span>Potência</span><strong>${esc(eq.potencia)}</strong></div>`:''}
        ${eq.numero_serie?`<div class="eq-inf"><span>Série</span><strong>${esc(eq.numero_serie)}</strong></div>`:''}
        ${eq.data_instalacao?`<div class="eq-inf"><span>Instalação</span><strong>${new Date(eq.data_instalacao+'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>`:''}
        ${eq.garantia_vencimento?`<div class="eq-inf"><span>Garantia até</span><strong>${new Date(eq.garantia_vencimento+'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>`:''}
      </div>
      <div class="eq-acts">
        <button class="tb" title="Prontuário: tudo que já passou por este equipamento" onclick="abrirProntuarioEq('${eq.id}')">📋 Prontuário</button>
        <button class="tb" onclick="verQR('${eq.id}')">🔳 QR Code</button>
        <button class="tb" onclick="abrirFormEq('${eq.id}')">✎ Editar</button>
        <button class="tb" title="Notif. garantia" onclick='copiarNotif(notifGarantia(${JSON.stringify(eq)}))'>⚠️💬</button>
        <button class="tb d" onclick="excluirEq('${eq.id}')">🗑</button>
      </div>`;
    el.appendChild(card);
  });
}

// ══════════════════════════════════════════════════
//  PRONTUÁRIO DO EQUIPAMENTO (Fase 10-11) — timeline
// ══════════════════════════════════════════════════
// Junta, num só lugar, tudo que já passou por um equipamento: vistorias, OS e
// orçamentos. É o "valor acumulativo" que o plano mestre pede — o técnico
// entende o passado antes de decidir o que fazer agora.
//
// LIMITE HONESTO do vínculo atual: OS e orçamento no v2 referenciam o CLIENTE
// (cliente_id), não o aparelho — não existe FK evento→equipamento ainda. Então:
//   • vistoria: casada por TIPO do equipamento (a vistoria lista os itens por
//     nome); mostra o status daquele item naquela visita — precisão de aparelho
//     onde o cliente tem 1 só daquele tipo.
//   • OS/orçamento: são do CLIENTE (rotulado como tal na tela). Precisão real de
//     aparelho aqui é a decisão de schema das Fases 10-11 (ver report).
function _eqEventos(eq){
  if(!eq) return [];
  const cid=eq.cliente_id||null;
  const nomeCli=_normNome(eq.cliente_nome||'');
  const tipoNorm=_normNome(eq.tipo||'');
  const doCliente=(reg)=> (cid && reg.cliente_id===cid) ||
    (!reg.cliente_id && nomeCli && _normNome(reg.cliente||reg.cliente_nome||'')===nomeCli);
  const eventos=[];

  // Vistorias — casa o item pelo tipo do equipamento
  try{
    (lsVisLer()||[]).filter(doCliente).forEach(v=>{
      const equips=(typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
      const item=equips.find(e=>_normNome(e.nome||'')===tipoNorm || _normNome(e.nome||'').includes(tipoNorm) || (tipoNorm && tipoNorm.includes(_normNome(e.nome||''))));
      eventos.push({
        tipo:'vistoria', data:v.data||v.data_criacao||v.created_at||'',
        titulo:'Vistoria', ref:v.id,
        detalhe: item ? `${_VIS_STATUS_LBL[item.status]||item.status||'—'}${item.obs?' — '+item.obs:''}` : 'Este equipamento não estava na lista desta vistoria',
        casado: !!item, status:item?item.status:null
      });
    });
  }catch(e){ console.warn('[prontuario:vis]', e?.message||e); }

  // OS — precisa se marcada a este equipamento (equipamento_id), senão do cliente.
  // OS com equipamento_id de OUTRO aparelho do mesmo cliente NÃO entram: se o
  // técnico já disse qual era, respeitar isso é o ponto do vínculo.
  (todosOS||[]).filter(doCliente).forEach(o=>{
    const desteEquip = o.equipamento_id && o.equipamento_id===eq.id;
    const deOutroEquip = o.equipamento_id && o.equipamento_id!==eq.id;
    if(deOutroEquip) return;
    eventos.push({ tipo:'os', data:o.data_servico||o.data_criacao||'', titulo:`OS #${String(o.numero||'').padStart(3,'0')}`,
      ref:o.id, detalhe:(o.servicos||[]).map(x=>typeof x==='string'?x:x.desc).filter(Boolean).slice(0,2).join(' · ')||'—',
      status:o.status, cliente:!desteEquip });
  });

  // Orçamentos do cliente
  (todosOrc||[]).filter(doCliente).forEach(o=>{
    eventos.push({ tipo:'orc', data:o.data_servico||o.data_criacao||'', titulo:`Orçamento #${String(o.numero||'').padStart(3,'0')}`,
      ref:o.id, detalhe:(o.total>0?brl(o.total):'') , status:o.status, cliente:true });
  });

  // Instalação e garantia do próprio equipamento entram na linha do tempo
  if(eq.data_instalacao) eventos.push({tipo:'inst', data:eq.data_instalacao, titulo:'Instalação', detalhe:`${eq.marca||''} ${eq.modelo||''}`.trim(), status:null});

  return eventos
    .map(e=>({...e, _d: e.data ? new Date(String(e.data).length<=10?e.data+'T12:00:00':e.data) : null}))
    .filter(e=>e._d && !isNaN(e._d))
    .sort((a,b)=>b._d-a._d);
}
const _VIS_STATUS_LBL={bom:'✅ Bom',atencao:'⚠️ Atenção',critico:'🔴 Crítico',na:'— N/A'};
const _PRONT_ICONE={vistoria:'🔍',os:'🔧',orc:'📄',inst:'📦'};
function abrirProntuarioEq(id){
  const eq=(todosEq||[]).find(x=>x.id===id);
  if(!eq){ toast('Equipamento não encontrado'); return; }
  const evs=_eqEventos(eq);
  const ident=[
    eq.numero_serie?`Série ${esc(eq.numero_serie)}`:'',
    eq.potencia?esc(eq.potencia):'',
    eq.data_instalacao?`instalado em ${new Date(eq.data_instalacao+'T12:00:00').toLocaleDateString('pt-BR')}`:'',
    eq.garantia_vencimento?`garantia até ${new Date(eq.garantia_vencimento+'T12:00:00').toLocaleDateString('pt-BR')}`:'',
  ].filter(Boolean).join(' · ');
  const linhas = evs.length ? evs.map(e=>{
    const dt=e._d.toLocaleDateString('pt-BR');
    const escopo = e.cliente ? ' <span style="font-size:10px;color:var(--gray)">(do cliente)</span>' : '';
    const clk = e.tipo==='os'||e.tipo==='orc';
    const oncl = clk ? ` style="cursor:pointer" onclick="fecharModalGenerico('pront-eq-bg'); ${e.tipo==='os'?`verDetalhesOS('${e.ref}')`:`verOrcPDF('${e.ref}')`}"` : '';
    return `<div class="pront-ev"${oncl}>
      <div class="pront-ev-ico">${_PRONT_ICONE[e.tipo]||'•'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(e.titulo)}${escopo}</div>
        <div style="font-size:11.5px;color:var(--gray);overflow:hidden;text-overflow:ellipsis">${esc(e.detalhe||'')}</div>
      </div>
      <div style="font-size:11px;color:var(--gray);white-space:nowrap">${dt}</div>
    </div>`;
  }).join('') : '<div style="padding:24px;text-align:center;color:var(--gray);font-size:13px">Nenhum evento registrado para este equipamento ainda.</div>';
  abrirModal({id:'pront-eq-bg', largura:'wide', corpo:`
    <div class="rd-modal-title">📋 ${esc(eq.tipo||'Equipamento')} — ${esc(eq.marca||'')} ${esc(eq.modelo||'')}</div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:4px">👤 ${esc(eq.cliente_nome||'—')}</div>
    ${ident?`<div style="font-size:11.5px;color:var(--tx3);margin-bottom:12px">${ident}</div>`:''}
    <div style="font-size:11px;color:var(--gray);background:var(--gray-light);border-radius:8px;padding:8px 10px;margin-bottom:12px">
      Vistorias são casadas pelo tipo do equipamento; OS e orçamentos são do cliente (o vínculo por aparelho vem depois).
    </div>
    <div style="max-height:52vh;overflow:auto">${linhas}</div>
    <div class="rd-modal-acts"><button class="rd-modal-btn rd-modal-btn-nao" onclick="fecharModalGenerico('pront-eq-bg')">Fechar</button></div>`});
}

function verificarAlertasGarantia(){
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const alertas=todosEq.filter(eq=>{
    if(!eq.garantia_vencimento) return false;
    const venc=new Date(eq.garantia_vencimento+'T12:00:00');
    return Math.ceil((venc-hoje)/(1000*60*60*24))<=30;
  });
  const el=document.getElementById('eq-alertas'); if(!el) return;
  if(!alertas.length){ el.innerHTML=''; return; }
  el.innerHTML=`<div class="rd-card rd-card-dense rd-card-warn" style="font-size:13px;color:var(--warn);font-weight:600">
    ⚠️ ${alertas.length} equipamento${alertas.length!==1?'s':''} com garantia vencendo em breve: ${alertas.map(e=>esc(e.marca+' '+e.modelo)).join(', ')}
  </div>`;
}

// QR Code
let qrEqAtual = null;
function verQR(id){
  const eq=todosEq.find(x=>x.id===id); if(!eq) return;
  qrEqAtual=eq;
  const url=window.location.origin+window.location.pathname+'#eq/'+id;
  document.getElementById('qr-eq-nome').textContent=(eq.marca||'')+' '+(eq.modelo||'');
  document.getElementById('qr-eq-info').textContent=(eq.cliente_nome||'')+(eq.tipo?' — '+eq.tipo:'');
  document.getElementById('qr-img').src='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='+encodeURIComponent(url);
  document.getElementById('qr-modal-bg').classList.add('on');
}
function fecharQR(){ document.getElementById('qr-modal-bg').classList.remove('on'); qrEqAtual=null; }
function imprimirQR(){
  if(!qrEqAtual) return;
  const eq=qrEqAtual;
  const url=window.location.origin+window.location.pathname+'#eq/'+eq.id;
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>QR Code — ${esc(eq.marca||'')} ${esc(eq.modelo||'')}</title>
  <style>body{font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f2f5}
  .box{background:white;border-radius:16px;padding:32px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:300px}
  h2{font-size:18px;margin:0 0 4px}p{font-size:13px;color:#6b7280;margin:0 0 16px}
  img{width:200px;height:200px;border:1px solid #e5e7eb;border-radius:8px}
  small{display:block;font-size:10px;color:#9ca3af;margin-top:12px;word-break:break-all}</style></head>
  <body><div class="box"><h2>${esc(eq.marca||'')} ${esc(eq.modelo||'')}</h2><p>${esc(eq.cliente_nome||'')} — ${esc(eq.tipo||'')}</p>
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}">
  <small>${url}</small></div><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script></body></html>`);
  w.document.close();
}

// Leitura de QR Code ao abrir o app — redireciona para ficha do equipamento
// ══════════════════════════════════════════════════
//  PÁGINAS LEGAIS — Termos de Uso e Política de Privacidade (LGPD)
//  ⚠️ RASCUNHO gerado por IA. REVISAR com advogado antes de valer juridicamente,
//  e confirmar razão social/CNPJ/e-mail de contato abaixo.
// ══════════════════════════════════════════════════
const _LEGAL_EMPRESA = '61.941.275 MARCOS VINICIUS ALVES DA SILVA (Fluxa)';
const _LEGAL_CNPJ    = '61.941.275/0001-14';
const _LEGAL_CIDADE  = 'Itapema/SC';
const _LEGAL_CONTATO = 'forthempsc@gmail.com';
const _LEGAL_ATUAL   = 'julho de 2026';

function _legalDoc(tipo){
  const h = `<div style="background:#fff3cd;border:1px solid #ffe08a;border-radius:10px;padding:12px 14px;font-size:13px;color:#7a5c00;margin-bottom:20px">
    ⚠️ <b>Rascunho.</b> Este documento deve ser revisado por um advogado antes de ter validade jurídica.
  </div>`;
  const rodape = `<p style="margin-top:26px;color:var(--gray);font-size:13px">
    ${_LEGAL_EMPRESA} · CNPJ ${_LEGAL_CNPJ} · ${_LEGAL_CIDADE}<br>Contato: ${_LEGAL_CONTATO} · Última atualização: ${_LEGAL_ATUAL}</p>`;
  const S = t => `<h2 style="font-size:17px;color:var(--c1);margin:22px 0 6px">${t}</h2>`;
  const P = t => `<p style="margin:0 0 10px">${t}</p>`;
  if(tipo==='privacidade'){
    return h + `<h1 style="font-size:24px;margin:0 0 4px">Política de Privacidade</h1>`
      + P('<span style="color:var(--gray)">Como o Fluxa trata seus dados, em conformidade com a LGPD (Lei nº 13.709/2018).</span>')
      + S('1. Quem trata seus dados')
      + P(`O controlador é <b>${_LEGAL_EMPRESA}</b>, CNPJ ${_LEGAL_CNPJ}, ${_LEGAL_CIDADE} ("Fluxa"). Dúvidas ou pedidos sobre dados: <b>${_LEGAL_CONTATO}</b>.`)
      + S('2. Dados que coletamos')
      + P('• <b>Dados de conta:</b> nome, e-mail e senha (armazenada de forma criptografada, nunca em texto puro).<br>• <b>Dados operacionais que a empresa insere:</b> clientes, orçamentos, ordens de serviço, vistorias, produtos, despesas e afins — inclusive dados de terceiros (ex.: clientes finais da empresa), pelos quais a empresa usuária é responsável.<br>• <b>Dados técnicos:</b> registros de acesso (auditoria) e informações do dispositivo/navegador para funcionamento e segurança.')
      + S('3. Para que usamos')
      + P('Para fornecer e operar o sistema, autenticar usuários, isolar os dados de cada empresa, gerar documentos (orçamentos/OS/relatórios), enviar comunicações operacionais (ex.: e-mail de vistoria, recuperação de senha) e cumprir obrigações legais.')
      + S('4. Base legal')
      + P('Execução de contrato (art. 7º, V da LGPD) para prestar o serviço; cumprimento de obrigação legal; e legítimo interesse para segurança e melhoria, sempre respeitando seus direitos.')
      + S('5. Com quem compartilhamos')
      + P('Não vendemos seus dados. Usamos fornecedores que atuam como <b>operadores</b> apenas para viabilizar o serviço — em especial a <b>Supabase</b> (banco de dados e autenticação, hospedagem em nuvem) e provedores de e-mail. Podemos divulgar dados se exigido por lei ou ordem judicial.')
      + S('6. Armazenamento e segurança')
      + P('Os dados ficam em servidores da Supabase. Aplicamos isolamento por empresa (Row Level Security), controle de acesso por perfil e senhas criptografadas. Nenhum sistema é 100% infalível, mas adotamos medidas técnicas e organizacionais razoáveis.')
      + S('7. Seus direitos (LGPD)')
      + P('Você pode solicitar: confirmação e acesso aos seus dados, correção, anonimização/eliminação, portabilidade, informação sobre compartilhamento e revogação de consentimento. Basta escrever para ' + _LEGAL_CONTATO + '.')
      + S('8. Retenção')
      + P('Guardamos os dados enquanto a conta estiver ativa e pelo prazo necessário para obrigações legais. Encerrada a conta, os dados podem ser eliminados ou anonimizados, salvo obrigação de guarda.')
      + S('9. Cookies e armazenamento local')
      + P('Usamos armazenamento local do navegador (localStorage) para manter sua sessão, preferências e um cache que permite o app funcionar offline. Não usamos cookies de rastreamento de terceiros.')
      + S('10. Alterações')
      + P('Podemos atualizar esta política. Mudanças relevantes serão comunicadas no app. O uso contínuo após a atualização significa concordância.')
      + rodape;
  }
  return h + `<h1 style="font-size:24px;margin:0 0 4px">Termos de Uso</h1>`
    + P('<span style="color:var(--gray)">Condições para uso do sistema Fluxa.</span>')
    + S('1. Aceitação')
    + P(`Ao criar uma conta ou usar o Fluxa, você concorda com estes Termos e com a Política de Privacidade. Se não concordar, não use o serviço.`)
    + S('2. O que é o Fluxa')
    + P('O Fluxa é um sistema de gestão para empresas de serviços (orçamentos, ordens de serviço, agenda, estoque, vistorias, clientes e afins), oferecido pela internet, no modelo de assinatura.')
    + S('3. Conta e acesso')
    + P('Você é responsável pela veracidade dos dados e por manter a confidencialidade da sua senha e dos PINs dos funcionários. Perfis (gestor/vendas/técnico) definem o que cada pessoa acessa. Avise-nos sobre qualquer uso não autorizado.')
    + S('4. Uso permitido')
    + P('Você se compromete a usar o Fluxa de forma lícita, sem violar direitos de terceiros, sem tentar burlar a segurança, sobrecarregar o sistema, ou inserir conteúdo ilegal. A empresa usuária é responsável pelos dados que cadastra, inclusive dados de seus próprios clientes.')
    + S('5. Disponibilidade')
    + P('Buscamos alta disponibilidade, mas o serviço é fornecido "no estado em que se encontra", sem garantia de funcionamento ininterrupto. Podemos fazer manutenções e atualizações. Recomendamos que você mantenha seus próprios registros de dados críticos.')
    + S('6. Limitação de responsabilidade')
    + P('Na máxima extensão permitida pela lei, o Fluxa não se responsabiliza por lucros cessantes, perdas indiretas, ou por decisões tomadas com base nos dados. Você é responsável pela correção dos dados que insere e pelo uso que faz do sistema.')
    + S('7. Assinatura e cancelamento')
    + P('Planos e valores, quando aplicáveis, são informados no momento da contratação. Você pode encerrar o uso a qualquer momento; obrigações vencidas permanecem devidas. Podemos suspender contas que violem estes Termos.')
    + S('8. Alterações')
    + P('Podemos alterar estes Termos e o funcionamento do sistema. Mudanças relevantes serão comunicadas no app. O uso contínuo significa concordância.')
    + S('9. Lei e foro')
    + P(`Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro da comarca de ${_LEGAL_CIDADE}, salvo disposição legal em contrário (ex.: foro do consumidor).`)
    + rodape;
}
function abrirLegal(tipo){
  const body=document.getElementById('legal-body'); if(body) body.innerHTML=_legalDoc(tipo);
  const ov=document.getElementById('legal-overlay'); if(ov) ov.style.display='block';
  window.scrollTo(0,0); try{ document.getElementById('legal-overlay').scrollTop=0; }catch(e){}
  if(location.hash!=='#'+tipo){ try{ history.pushState(null,'','#'+tipo); }catch(e){} }
}
function fecharLegal(){
  const ov=document.getElementById('legal-overlay'); if(ov) ov.style.display='none';
  if(/^#(termos|privacidade)$/.test(location.hash)){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){ location.hash=''; } }
}
window.addEventListener('hashchange', ()=>{
  const hp=(location.hash||'').replace('#','');
  if(hp==='termos'||hp==='privacidade') abrirLegal(hp);
  else { const ov=document.getElementById('legal-overlay'); if(ov&&ov.style.display!=='none') fecharLegal(); }
});

function checkQRHash(){
  const hash=window.location.hash;
  if(hash==='#termos'||hash==='#privacidade'){ abrirLegal(hash.replace('#','')); return; }
  if(hash.startsWith('#eq/')){
    const id=hash.replace('#eq/','');
    window.location.hash='';
    go('equipamentos');
    setTimeout(()=>{
      const eq=todosEq.find(x=>x.id===id);
      if(eq) abrirFormEq(id);
      else toast('⚠️ Equipamento não encontrado');
    },500);
  }
}

// ══════════════════════════════════════════════════
//  GESTÃO DE USUÁRIOS
// ══════════════════════════════════════════════════
async function loadUsuarios(){
  await carregarUsuarios();
  renderUsuarios();
}

function renderUsuarios(){
  const el=document.getElementById('usr-lista'); if(!el) return;
  // Aviso de PIN gestor legado só se não houver usuário master individual
  const temMaster=todosUsuarios.some(u=>u.perfil==='master'&&u.ativo!==false);
  const gestorHtml=temMaster?'':
    `<div class="usr-card" style="border:1.5px dashed var(--gray-mid);opacity:.7">
      <div class="usr-avatar gestor">G</div>
      <div class="usr-info">
        <div class="usr-nome">Gestor (legado)</div>
        <div class="usr-det">Compartilhado · PIN em Segurança</div>
      </div>
      <span class="usr-badge gestor">Gestor</span>
    </div>`;

  const perfilLabel={master:'Master',gestor:'Gestor',vendas:'Vendas',tecnico:'Técnico'};
  const perfilCor={master:'gestor',gestor:'gestor',vendas:'vendas',tecnico:'tecnico'};
  const perfilEmoji={master:'👑',gestor:'🛡️',vendas:'💼',tecnico:'🔧'};
  const tecsHtml=todosUsuarios.filter(u=>u.ativo!==false).map(u=>`
    <div class="usr-card">
      <div class="usr-avatar" style="${u.perfil==='vendas'?'background:#f59e0b':u.perfil==='master'?'background:#7c3aed':''}">${u.perfil==='master'?'👑':u.perfil==='vendas'?'💼':u.nome.charAt(0).toUpperCase()}</div>
      <div class="usr-info">
        <div class="usr-nome">${esc(u.nome)}</div>
        <div class="usr-det">${u.loja_nome?'Loja: '+esc(u.loja_nome)+' · ':''}PIN: ${u.tem_pin?'✅ definido':'⚠️ não definido'}</div>
      </div>
      <span class="usr-badge ${perfilCor[u.perfil]||'tecnico'}">${perfilEmoji[u.perfil]||'🔧'} ${perfilLabel[u.perfil]||'Técnico'}</span>
      <div style="display:flex;gap:4px;margin-left:8px;flex-shrink:0">
        <button class="tb" onclick="editarUsuario('${u.id}')">✏️</button>
        <button class="tb d" onclick="excluirUsuario('${u.id}')">🗑</button>
      </div>
    </div>`).join('');

  const vazio=todosUsuarios.filter(u=>u.ativo!==false).length===0
    ?'<div class="empty-st" style="padding:20px 0"><div class="ei">👤</div><p>Nenhum técnico cadastrado.<br>Clique em "+ Novo Usuário" para adicionar.</p></div>':'';

  el.innerHTML=gestorHtml+tecsHtml+vazio;
}

let _usrEditId=null;
function abrirFormUsuario(){
  _usrEditId=null;
  document.getElementById('usr-form-card').style.display='block';
  ['usr-nome','usr-pin'].forEach(id=>setV(id,''));
  setV('usr-perfil','tecnico');
  setV('usr-loja-id','');
  document.getElementById('usr-form-titulo').textContent='Novo Usuário';
  document.getElementById('usr-pin-label').textContent='PIN (4 dígitos)';
  document.getElementById('usr-form-card').scrollIntoView({behavior:'smooth'});
}
function editarUsuario(id){
  const u=todosUsuarios.find(x=>x.id===id); if(!u){ toast('Usuário não encontrado'); return; }
  _usrEditId=id;
  document.getElementById('usr-form-card').style.display='block';
  setV('usr-nome',u.nome||'');
  setV('usr-perfil',u.perfil||'tecnico');
  setV('usr-loja-id',u.loja_id||'');
  setV('usr-pin','');
  document.getElementById('usr-form-titulo').textContent='Editar — '+(u.nome||'');
  document.getElementById('usr-pin-label').textContent='PIN (vazio = manter atual)';
  document.getElementById('usr-form-card').scrollIntoView({behavior:'smooth'});
}
function fecharFormUsuario(){ document.getElementById('usr-form-card').style.display='none'; _usrEditId=null; }
function updUsrForm(){}

async function salvarUsuario(){
  const nome=gV('usr-nome').trim();
  if(!nome){ toast('⚠️ Informe o nome'); return; }
  const lojaId=gV('usr-loja-id')||null;
  const loja=getLoja(lojaId);
  const pinRaw=gV('usr-pin').trim();
  if(pinRaw&&(pinRaw.length!==4||!/^\d{4}$/.test(pinRaw))){ toast('⚠️ PIN deve ter exatamente 4 dígitos'); return; }
  const perfil=gV('usr-perfil')||'tecnico';
  if(!lojaId && perfil==='gestor'){ toast('⚠️ Gestor de empresa precisa de uma empresa (deixe vazio só p/ master/gestor geral)'); return; }
  const pinHash = pinRaw ? await hashPIN(pinRaw) : null;

  if(_usrEditId){
    // ── EDITAR (promover/rebaixar, renomear, trocar PIN) ──
    const i=todosUsuarios.findIndex(x=>x.id===_usrEditId); if(i<0){ toast('Usuário não encontrado'); return; }
    const antigo=todosUsuarios[i];
    const upd={ nome, perfil, loja_id:lojaId, loja_nome:loja?.nome||null };
    if(pinHash) upd.pin=pinHash; // só troca o PIN se foi informado
    todosUsuarios[i]={...antigo,...upd};
    lsSet('fluxa_usuarios',JSON.stringify(todosUsuarios));
    if(dbOk&&db){
      // dados (nome/perfil/loja) — sem o PIN, que tem fluxo próprio de reset
      const updSemPin={ nome, perfil, loja_id:lojaId, loja_nome:loja?.nome||null };
      try{ await dbUpdate('usuarios', updSemPin, 'id', _usrEditId); }catch(e){ console.warn('[editUsr]',e?.message||e); }
      if(pinHash){
        // Reset de PIN seguro: como o PIN é a senha da conta sintética, a RPC bumpa
        // auth_ver (próximo login = conta NOVA com o PIN novo) e remove o membros da
        // conta antiga (perde acesso). Sem isto, trocar o PIN não mudava a senha de auth.
        try{
          const { error } = await db.rpc('resetar_pin_funcionario', { p_empresa: EMPRESA_ID, p_usuario_id: _usrEditId, p_pin_hash: pinHash });
          if(error) throw error;
          todosUsuarios[i].auth_ver = (parseInt(antigo.auth_ver)||0) + 1;
          lsSet('fluxa_usuarios', JSON.stringify(todosUsuarios));
        }catch(e){ console.warn('[resetPin]', e?.message||e); toast('⚠️ PIN salvo local, mas o reset no servidor falhou — tente de novo'); }
      }
    }
    logAcao('usuario_editado', `${nome} → ${perfil}${antigo.perfil!==perfil?' (era '+antigo.perfil+')':''}`);
    fecharFormUsuario(); renderUsuarios(); renderLoginUsers();
    toast('✅ Usuário atualizado!'); return;
  }

  // ── NOVO ──
  const dados={ nome, perfil, loja_id:lojaId, loja_nome:loja?.nome||null, pin:pinHash, ativo:true };
  const tempId='usr_'+Date.now();
  const rec={...dados,id:tempId,data_criacao:new Date().toISOString()};
  todosUsuarios.push(rec);
  lsSet('fluxa_usuarios',JSON.stringify(todosUsuarios));
  if(dbOk&&db){
    try{
      // select explícito sem 'pin' — grava o hash, mas não traz de volta pro
      // navegador nem pro cache local (achado de segurança).
      // id EXPLÍCITO: usuarios.id é text sem default → sem isto o insert falha
      // (NOT NULL) e o usuário ficava só no localStorage (técnico não conseguia logar).
      const {data:ins}=await dbInsert('usuarios', {...dados, id:tempId}, 'id,empresa_id,nome,perfil,loja_id,loja_nome,ativo,data_criacao');
      if(ins){
        todosUsuarios=todosUsuarios.filter(x=>x.id!==tempId);
        todosUsuarios.push(ins);
        lsSet('fluxa_usuarios',JSON.stringify(todosUsuarios));
      }
    }catch(e){ console.warn('salvarUsuario BD falhou:',e.message); }
  }
  logAcao('usuario_criado', `${nome} (${perfil})`);
  fecharFormUsuario();
  renderUsuarios(); renderLoginUsers();
  toast('✅ Usuário salvo!');
}

function excluirUsuario(id){
  confirmar('Desativar este usuário?', ()=>_excluirUsuarioConfirmado(id), 'Desativar Usuário');
}
async function _excluirUsuarioConfirmado(id){
  const alvo=todosUsuarios.find(x=>x.id===id);
  todosUsuarios=todosUsuarios.filter(x=>x.id!==id);
  lsSet('fluxa_usuarios',JSON.stringify(todosUsuarios));
  if(dbOk&&db){
    // desativar_funcionario: marca ativo=false E remove o membros do funcionário
    // (corta a RLS na hora — sem isto ele manteria acesso pela sessão dele). Só
    // gestor. Fallback pro update simples se a RPC não existir (banco antigo).
    try{
      const { error } = await db.rpc('desativar_funcionario', { p_empresa: EMPRESA_ID, p_usuario_id: id });
      if(error) throw error;
    }catch(e){
      console.warn('[desativarFuncionario]', e?.message||e);
      try{ await db.from('usuarios').update({ativo:false}).eq('id',id); }catch(e2){ console.warn('usr delete sync:',e2.message); }
    }
  }
  logAcao('usuario_removido', alvo?.nome||id);
  renderUsuarios(); renderLoginUsers();
  toast('🗑 Usuário removido');
}

// ══════════════════════════════════════════════════
//  MÓDULO 7 — NOTA FISCAL (Focus NFe)
// ══════════════════════════════════════════════════
let nfeOrcAtual = null; // orçamento sendo emitido
let nfeTipoAtual = 'nfse'; // 'nfse' | 'nfe'
let nfePollingTimer = null;

function abrirModalNFe(orcId){
  const o=todosOrc.find(x=>x.id===orcId); if(!o) return;
  nfeOrcAtual=o; nfeTipoAtual='nfse';

  // Preenche dados do orçamento
  document.getElementById('nfe-modal-sub').textContent=`Orçamento #${String(o.numero||0).padStart(3,'0')} — ${o.cliente||'—'}`;
  document.getElementById('nfe-cli').textContent=o.cliente||'—';
  document.getElementById('nfe-cnpj').textContent=o.cnpj||'Não informado';
  document.getElementById('nfe-total').textContent=brl(o.total||0);
  const svcsTexto=(o.servicos||[]).map(s=>s.desc).join(', ')||'—';
  document.getElementById('nfe-svcs').textContent=svcsTexto;

  // Preenche campos com configurações salvas
  const refAuto='ORC-'+new Date().getFullYear()+'-'+String(o.numero||0).padStart(4,'0')+'-'+Date.now().toString().slice(-4);
  setV('nfe-ref', refAuto);
  // v2: sem token fiscal no cliente (a emissão será por Edge Function). Mantém só
  // os campos fiscais não-secretos (ambiente/alíquota/código de serviço).
  setV('nfe-ambiente', CFG.nfe_ambiente||'homologacao');
  setV('nfe-iss-aliq', CFG.nfe_iss||'2.0');
  setV('nfe-cod-servico', CFG.nfe_cod_svc||'7.10');
  setV('nfe-desc-servico', svcsTexto);

  // Verifica se já tem nota emitida
  document.getElementById('nfe-status-wrap').style.display='none';
  document.getElementById('nfe-btn-emitir').disabled=false;
  document.getElementById('nfe-btn-emitir').textContent='⚡ Emitir Nota Fiscal';
  verificarNFExistente(orcId);

  selecionarTipoNF('nfse');
  document.getElementById('nfe-modal-bg').classList.add('on');
}

function fecharModalNFe(){
  document.getElementById('nfe-modal-bg').classList.remove('on');
  if(nfePollingTimer){ clearInterval(nfePollingTimer); nfePollingTimer=null; }
  nfeOrcAtual=null;
}

function selecionarTipoNF(tipo){
  nfeTipoAtual=tipo;
  document.getElementById('nfe-tab-nfse').className='nfe-tab'+(tipo==='nfse'?' on':'');
  document.getElementById('nfe-tab-nfe').className='nfe-tab'+(tipo==='nfe'?' on':'');
  document.getElementById('nfe-nfse-fields').style.display=tipo==='nfse'?'block':'none';
  document.getElementById('nfe-nfe-fields').style.display=tipo==='nfe'?'block':'none';
}

async function verificarNFExistente(orcId){
  if(!dbOk||!db) return;
  try{
    const {data}=await db.from('notas_fiscais').select('*').eq('orcamento_id',orcId).order('data_criacao',{ascending:false}).limit(1);
    if(data&&data.length){
      const nf=data[0];
      mostrarStatusNF(nf.status, nf);
    }
  }catch(e){}
}

function mostrarStatusNF(status, nf){
  const wrap=document.getElementById('nfe-status-wrap');
  const badge=document.getElementById('nfe-status-badge');
  const msg=document.getElementById('nfe-status-msg');
  wrap.style.display='block';
  const mapa={autorizada:'✅ Nota Autorizada',pendente:'⏳ Processando…',rejeitada:'❌ Rejeitada',cancelada:'🚫 Cancelada',processando:'⏳ Processando…'};
  badge.className='nfe-status-badge '+(status||'pendente');
  badge.textContent=mapa[status]||status;
  if(nf?.numero) msg.textContent=`Número: ${nf.numero} · Série: ${nf.serie||'1'} · Ref: ${nf.referencia||'—'}`;
  if(nf?.motivo_rejeicao) msg.textContent+=' · '+nf.motivo_rejeicao;

  // Botões de download se autorizada
  const dlWrap=document.getElementById('nfe-download-wrap');
  if(dlWrap){
    if(status==='autorizada'&&nf){
      dlWrap.style.display='flex';
      dlWrap.innerHTML='';
      if(nf.pdf_danfe_url) dlWrap.innerHTML+=`<a href="${esc(nf.pdf_danfe_url)}" target="_blank" class="btn-primary" style="text-decoration:none;font-size:12px;padding:8px 14px">📄 PDF DANFE</a>`;
      if(nf.xml_autorizado) {
        const blob=new Blob([nf.xml_autorizado],{type:'text/xml'});
        const url=URL.createObjectURL(blob);
        dlWrap.innerHTML+=`<a href="${url}" download="nota_${nf.numero||'nf'}.xml" class="btn-sec" style="text-decoration:none;font-size:12px;padding:8px 14px">📋 XML</a>`;
      }
    } else { dlWrap.style.display='none'; }
  }

  if(status==='autorizada'||status==='rejeitada'||status==='cancelada'){
    document.getElementById('nfe-btn-emitir').disabled=true;
    document.getElementById('nfe-btn-emitir').textContent=status==='autorizada'?'✅ Já emitida':'Nota '+status;
  }
}

async function emitirNota(){
  // v2 (multi-tenant): emissão fiscal client-side DESATIVADA. A conta fiscal é ÚNICA
  // da plataforma — o token master dá acesso às notas de TODAS as empresas e NUNCA
  // pode existir no cliente. A emissão virá por Edge Function (valida JWT + membro da
  // empresa e chama a API pelo CNPJ da empresa). Ver "Arquitetura fiscal" no CLAUDE.md.
  toast('🧾 Emissão de nota fiscal — em breve.');
  return;
  /* ───── fluxo antigo (FocusNFe direto do navegador) — DESATIVADO no v2 ───── */
  const token='';
  if(!nfeOrcAtual){ return; }
  const ref=gV('nfe-ref');
  const ambiente=gV('nfe-ambiente');
  const btn=document.getElementById('nfe-btn-emitir');
  btn.disabled=true; btn.textContent='⏳ Emitindo…';
  document.getElementById('nfe-status-wrap').style.display='block';
  mostrarStatusNF('processando',null);

  const o=nfeOrcAtual;
  const baseUrl=ambiente==='producao'
    ?'https://api.focusnfe.com.br'
    :'https://homologacao.focusnfe.com.br';
  const auth='Basic '+btoa(token+':');

  try{
    let payload, endpoint;
    if(nfeTipoAtual==='nfse'){
      endpoint='/v2/nfsen?ref='+encodeURIComponent(ref);
      payload={
        data_emissao: new Date().toISOString().split('T')[0],
        prestador_codigo_municipio:'4208450', // Itapema padrão; muda via loja futuramente
        tomador_cpf_cnpj: (o.cnpj||'').replace(/\D/g,'') || '00000000000',
        tomador_razao_social: o.cliente||'Cliente',
        tomador_email:'',
        servico_valor_servicos: o.total||0,
        servico_iss_retido: false,
        servico_aliquota: parseFloat(gV('nfe-iss-aliq'))||2.0,
        servico_discriminacao: gV('nfe-desc-servico')||'Serviços de manutenção',
        servico_codigo_cnae:'4322302',
        servico_item_lista_servico: gV('nfe-cod-servico')||'7.10'
      };
    } else {
      endpoint='/v2/nfe?ref='+encodeURIComponent(ref);
      payload={
        natureza_operacao:'Venda de mercadoria',
        data_emissao: new Date().toISOString(),
        tipo_documento:'1',
        finalidade_emissao:'1',
        consumidor_final:'1',
        presenca_comprador:'1',
        cliente:{
          cpf_cnpj:(o.cnpj||'').replace(/\D/g,'')||'00000000000',
          nome:o.cliente||'Consumidor',
          logradouro:o.local_servico||'',
          numero:'S/N', municipio:'Itapema', uf:'SC', cep:'88220000', pais:'1058'
        },
        itens:[{
          numero:'1', codigo:'001', descricao:(o.servicos||[]).map(s=>s.desc).join(', ')||'Serviço',
          ncm:gV('nfe-ncm')||'84218900', cfop:gV('nfe-cfop')||'5102',
          unidade_comercial:'SV', quantidade_comercial:'1',
          valor_unitario_comercial:o.total||0, valor_total_bruto:o.total||0,
          inclui_no_total:'1', icms_situacao_tributaria:'400', pis_situacao_tributaria:'07',
          cofins_situacao_tributaria:'07'
        }],
        forma_pagamento:[{forma_pagamento:'01',valor:o.total||0}]
      };
    }

    // Salva no banco antes de enviar (status processando)
    let nfId=null;
    if(dbOk&&db){
      try{
        const {data:nfRec}=await dbInsert('notas_fiscais', {
          orcamento_id:o.id, tipo:nfeTipoAtual, referencia:ref,
          status:'pendente', dados_envio:payload
        });
        if(nfRec) nfId=nfRec.id;
      }catch(e){ console.warn('[nf insert]', e?.message||e); }
    }

    // Chama a API Focus NFe
    const resp=await fetch(baseUrl+endpoint,{
      method:'POST',
      headers:{'Authorization':auth,'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const result=await resp.json();

    if(resp.status===201||resp.status===200){
      // Síncrono: nota já autorizada
      const nfAtualizada={status:'autorizada',numero:result.numero,serie:result.serie,chave_acesso:result.chave_acesso,pdf_danfe_url:result.caminho_danfe,xml_autorizado:result.caminho_xml_nota_fiscal,protocolo:result.protocolo_autorizacao};
      if(dbOk&&db&&nfId) db.from('notas_fiscais').update(nfAtualizada).eq('id',nfId).then(()=>{}).catch(()=>{});
      mostrarStatusNF('autorizada',{...nfAtualizada,referencia:ref});
      toast('✅ Nota Fiscal emitida com sucesso!');
    } else if(resp.status===202){
      // Assíncrono: aguardando processamento, iniciar polling
      toast('⏳ Nota em processamento, aguardando autorização…');
      iniciarPollingNF(baseUrl, auth, ref, nfId);
    } else {
      const erroMsg=result.mensagem||result.erros?.[0]?.mensagem||JSON.stringify(result);
      if(dbOk&&db&&nfId) db.from('notas_fiscais').update({status:'rejeitada',motivo_rejeicao:erroMsg}).eq('id',nfId).then(()=>{}).catch(()=>{});
      mostrarStatusNF('rejeitada',{motivo_rejeicao:erroMsg,referencia:ref});
      btn.disabled=false; btn.textContent='⚡ Tentar novamente';
      toast('❌ Nota rejeitada: '+erroMsg);
    }
  }catch(e){
    console.error('emitirNota erro:',e);
    toast('❌ Erro ao emitir: '+e.message);
    document.getElementById('nfe-status-badge').textContent='❌ Erro de conexão';
    btn.disabled=false; btn.textContent='⚡ Tentar novamente';
  }
}

function iniciarPollingNF(baseUrl, auth, ref, nfId){
  let tentativas=0;
  nfePollingTimer=setInterval(async()=>{
    tentativas++;
    if(tentativas>20){ clearInterval(nfePollingTimer); nfePollingTimer=null; return; }
    try{
      const endpointConsulta=nfeTipoAtual==='nfse'?'/v2/nfse/':'/v2/nfe/';
      const resp=await fetch(baseUrl+endpointConsulta+encodeURIComponent(ref),{headers:{'Authorization':auth}});
      const r=await resp.json();
      if(r.status==='autorizada'){
        clearInterval(nfePollingTimer); nfePollingTimer=null;
        const nfAtualizada={status:'autorizada',numero:r.numero,serie:r.serie,chave_acesso:r.chave_acesso,pdf_danfe_url:r.caminho_danfe,xml_autorizado:r.caminho_xml_nota_fiscal,protocolo:r.protocolo_autorizacao};
        if(dbOk&&db&&nfId) db.from('notas_fiscais').update(nfAtualizada).eq('id',nfId).then(()=>{}).catch(()=>{});
        mostrarStatusNF('autorizada',{...nfAtualizada,referencia:ref});
        toast('✅ Nota Fiscal autorizada!');
      } else if(r.status==='rejeitada'||r.status==='cancelada'){
        clearInterval(nfePollingTimer); nfePollingTimer=null;
        const erroMsg=r.mensagem_sefaz||r.status;
        if(dbOk&&db&&nfId) db.from('notas_fiscais').update({status:r.status,motivo_rejeicao:erroMsg}).eq('id',nfId).then(()=>{}).catch(()=>{});
        mostrarStatusNF(r.status,{motivo_rejeicao:erroMsg,referencia:ref});
        toast('❌ Nota '+r.status+': '+erroMsg);
        const btn=document.getElementById('nfe-btn-emitir'); if(btn){btn.disabled=false;btn.textContent='⚡ Tentar novamente';}
      }
    }catch(e){ console.warn('polling NF erro:',e.message); }
  },5000); // verifica a cada 5s
}

// ══════════════════════════════════════════════════
//  VISTORIAS DE MANUTENÇÃO
// ══════════════════════════════════════════════════

const VIS_EQUIPAMENTOS_DEFAULT = [
  { id:'motobomba',     nome:'Motobomba Principal',      emoji:'⚙️'  },
  { id:'mot-aux',       nome:'Motobomba Auxiliar',        emoji:'⚙️'  },
  { id:'filtro',        nome:'Filtro',                    emoji:'🔵'  },
  { id:'bomba-calor',   nome:'Bomba de Calor',            emoji:'🌡️'  },
  { id:'ger-cloro',     nome:'Gerador de Cloro',          emoji:'⚗️'  },
  { id:'ger-ozonio',    nome:'Gerador de Ozônio',         emoji:'🫧'  },
  { id:'iluminacao',    nome:'Iluminação Subaquática',    emoji:'💡'  },
  { id:'spa',           nome:'Spa',                       emoji:'🛁'  },
  { id:'sauna',         nome:'Sauna',                     emoji:'🧖'  },
];

// Estado atual da vistoria em edição
let visEquipSelecionados = []; // ids dos equipamentos ativos
let visEquipDados = {};        // { id: { status, obs, fotos:[] } }
let visCheckinTime = null;
let visCheckoutTime = null;
let visCheckinInterval = null;
let visEditId = null;          // id da vistoria sendo editada (null = nova)
let _visDraftId = null;        // id da vistoria atual em edição no form (compartilhado entre Salvar e Gerar PDF, evita duplicata)
let visHistStatusFilt = '';    // filtro de status no histórico: ''|'critico'|'atencao'

// Promise com timeout — evita que uma chamada de rede travada (Supabase/EmailJS)
// deixe a UI pendurada para sempre. Rejeita após `ms` se não resolver.
function _comTimeout(promise, ms, rotulo){
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout '+(rotulo||'')+' ('+ms+'ms)')), ms))
  ]);
}

const LS_VIS = 'fluxa_visitas';
const LS_LOCAIS_VIS = 'fluxa_locais_vistoria';
let locaisVistoria = [];
let locaisVisMesRef = '';  // currently viewed month in locais tab, e.g. '2026-05'
// Cache em memória: evita re-parsear o JSON (que pode ter dezenas de vistorias
// com fotos) a cada render. Invalidado sempre que lsVisSalvar grava.
let _visCache=null;
function lsVisLer(){
  if(_visCache) return _visCache;
  try{ _visCache=JSON.parse(ls(LS_VIS)||'[]'); }catch(e){ _visCache=[]; }
  return _visCache;
}
function lsVisSalvar(lista){
  _visCache=Array.isArray(lista)?lista:null; // mantém o cache coerente com o que foi gravado
  try{
    lsSet(LS_VIS, JSON.stringify(lista));
  }catch(e){
    if(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||(e.message||'').includes('quota')){
      // tenta salvar sem fotos para não perder os dados da vistoria
      try{
        const semFotos = lista.map(v=>({
          ...v,
          equipamentos:(v.equipamentos||[]).map(eq=>({...eq,fotos:[]}))
        }));
        lsSet(LS_VIS, JSON.stringify(semFotos));
        toast('⚠️ Armazenamento cheio — vistoria salva sem fotos. As fotos ficam na nuvem.');
      }catch(e2){
        console.warn('[lsVisSalvar] localStorage cheio mesmo sem fotos:', e2?.message||e2);
        toast('⚠️ Armazenamento do celular cheio. Libere espaço e tente novamente.');
      }
    }else{ throw e; }
  }
}

// ══ ESCOPO DE EMPRESA (vistorias/locais) ══
// Fonte única de verdade para "este local/vistoria pertence à empresa em foco?".
// Usado por renderLocaisTab E renderVisHistorico para nunca divergirem.
function _normLojaId(lid){ return (!lid||lid==='default')?LOJA_PADRAO_ID:lid; }
// Grupo padrão da empresa ativa (unidade padrão ou a primeira) — sem nome chumbado.
function _grupoPadrao(){ const L=getLoja(LOJA_PADRAO_ID)||LOJAS[0]; return L?L.grupo:''; }
function _grupoDaLoja(lid){ const L=LOJAS.find(x=>x.id===_normLojaId(lid)); return L?L.grupo:_grupoPadrao(); }
// Empresa atualmente em foco: técnico → grupo escolhido no login; gestor sem
// loja → grupo forthemp (Aquamotor não mistura); gestor em loja específica → aquela loja.
function _empresaEmFoco(){
  const s=getSessao();
  if(s?.perfil==='tecnico'){
    const emp=visEmpresaTecnico||s?.empresa_tec||sessionStorage.getItem('fluxa_vis_empresa_tec')||_grupoPadrao();
    return {tipo:'grupo', valor:emp};
  }
  if(!lojaAtiva) return {tipo:'grupo', valor:_grupoPadrao()};
  return {tipo:'loja', valor:lojaAtiva};
}
// true se a loja_id (de um local ou vistoria) está dentro da empresa em foco
function escopoEmpresaMatch(lojaId){
  const lid=_normLojaId(lojaId);
  const f=_empresaEmFoco();
  return f.tipo==='grupo' ? _grupoDaLoja(lid)===f.valor : lid===f.valor;
}

/* ══ LOCAIS RECORRENTES ══ */
function loadLocais(){
  // Lê localStorage
  let local=[];
  try{ local=JSON.parse(ls(LS_LOCAIS_VIS)||'[]'); }catch(e){ console.warn('[loadLocais]',e); }
  // Merge com dados do Supabase (vindos via CFG.locais_vistoria)
  const remoto=CFG?.locais_vistoria||[];
  if(remoto.length){
    const merged=[...remoto];
    local.forEach(l=>{ if(!merged.find(r=>r.id===l.id)) merged.push(l); });
    locaisVistoria=merged;
  } else {
    locaisVistoria=local;
  }
  // Deduplicar por ID E por cliente+local (ambas as chaves devem ser únicas).
  // Mantém o primeiro registro encontrado para cada combinação.
  const _vistosId=new Set(); const _vistosNome=new Set();
  locaisVistoria=locaisVistoria.filter(l=>{
    const kId=l.id||''; const kNome=((l.cliente||'').trim()+'|'+(l.local||'').trim()).toLowerCase();
    if(kId && _vistosId.has(kId)) return false;
    if(kNome && _vistosNome.has(kNome)) return false;
    if(kId) _vistosId.add(kId);
    if(kNome) _vistosNome.add(kNome);
    return true;
  });
  lsSet(LS_LOCAIS_VIS, JSON.stringify(locaisVistoria));
}
// null = ainda não sabemos se a tabela dedicada existe; true/false após 1ª tentativa.
let _locaisTabelaOk=null;
function _tabelaAusente(msg){ return /relation .* does not exist|could not find the table|schema cache|does not exist/i.test(msg||''); }

async function saveLocais(){
  lsSet(LS_LOCAIS_VIS, JSON.stringify(locaisVistoria));
  CFG.locais_vistoria=locaisVistoria;
  lsSet('empresa_cfg', JSON.stringify(CFG));
  if(!dbOk||!db) return;
  // ── Caminho primário: tabela dedicada locais_vistoria (1 linha por local) ──
  // Sem clobber entre empresas — Tamara e Elisa salvam linhas independentes.
  if(_locaisTabelaOk!==false){
    try{
      let okTabela=true;
      for(const l of locaisVistoria){
        const r=await dbUpsert('locais_vistoria', {...l, updated_at:new Date().toISOString()});
        if(r&&r.error){
          if(_tabelaAusente(r.error.message)){ _locaisTabelaOk=false; okTabela=false; break; }
          console.warn('[saveLocais:tabela]', r.error.message);
        } else { delete l._pendingSync; } // sincronizou com sucesso
      }
      if(okTabela){ _locaisTabelaOk=true; return; }
    }catch(e){ console.warn('[saveLocais:tabela]', e?.message||e); }
  }
  // ── Fallback legado: empresa_config com READ-MERGE-WRITE (corrige concorrência) ──
  await _saveLocaisLegado();
}

// v2: a tabela dedicada locais_vistoria sempre existe (setup-v2.sql) e é a fonte de
// verdade. O fallback legado (empresa_config) foi removido — essa tabela não existe
// mais no schema v2. Mantido como no-op para não quebrar chamadas antigas.
async function _saveLocaisLegado(){ /* sem fallback no v2 — locais_vistoria é a fonte */ }

// Carrega locais da tabela dedicada (fonte de verdade quando existe). Reenvia ao
// banco os locais presos só no aparelho (migra automaticamente do modo legado).
async function loadLocaisRemoto(){
  if(!dbOk||!db) return;
  try{
    const {data,error}=await db.from('locais_vistoria').select('*').eq('empresa_id',EMPRESA_ID);
    if(error){
      if(_tabelaAusente(error.message)) _locaisTabelaOk=false;
      console.warn('[loadLocaisRemoto]', error.message); return;
    }
    _locaisTabelaOk=true;
    let remoto=(data||[]).map(r=>({...r, equipamentos: typeof r.equipamentos==='string'?JSON.parse(r.equipamentos||'[]'):(r.equipamentos||[])}));
    // Respeita tombstones: planos apagados não voltam. Se ainda estiverem na
    // tabela (delete anterior falhou), tenta apagar de novo.
    const _tomb=new Set(_locTombLer());
    if(_tomb.size){
      remoto.filter(r=>_tomb.has(r.id)).forEach(r=>{ try{ db.from('locais_vistoria').delete().eq('id',r.id).then(()=>{}).catch(()=>{}); }catch(e){ console.warn('[locTomb]',e?.message||e); } });
      remoto=remoto.filter(r=>!_tomb.has(r.id));
    }
    let local=[]; try{ local=JSON.parse(ls(LS_LOCAIS_VIS)||'[]'); }catch(e){ console.warn('[loadLocaisRemoto:ls]', e?.message||e); }
    const remotoIds=new Set(remoto.map(r=>r.id));
    // A TABELA é a fonte da verdade. Um plano que está só no aparelho e NÃO está
    // no banco só é mantido/reenviado se foi criado offline e ainda não sincronizou
    // (_pendingSync). Planos locais que sumiram do banco (apagados em qualquer
    // dispositivo) são DESCARTADOS — é isso que impede planos apagados de "voltarem".
    const soLocalPend=local.filter(l=>!remotoIds.has(l.id) && !_tomb.has(l.id) && l._pendingSync===true);
    for(const l of soLocalPend){
      try{ const r=await dbUpsert('locais_vistoria', {...l, updated_at:new Date().toISOString()}); if(r&&r.error){ if(_tabelaAusente(r.error.message)){ _locaisTabelaOk=false; return; } } else { delete l._pendingSync; } }
      catch(e){ console.warn('[loadLocaisRemoto:migra]', e?.message||e); }
    }
    locaisVistoria=[...remoto, ...soLocalPend];
    lsSet(LS_LOCAIS_VIS, JSON.stringify(locaisVistoria));
    CFG.locais_vistoria=locaisVistoria;
    if(document.getElementById('vis-view-locais')?.style.display!=='none') renderLocaisTab();
  }catch(e){ console.warn('[loadLocaisRemoto]', e?.message||e); }
}

// ── LOCAIS: formulário de plano ──────────────────────────────────────────────
function abrirLocForm(id){
  const f=document.getElementById('loc-add-form');
  f.style.display='';
  // técnico select
  const sel=document.getElementById('loc-tec');
  sel.innerHTML='<option value="">Qualquer técnico</option>';
  const tecList=(typeof getTecnicos==='function')?getTecnicos():[];
  tecList.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; sel.appendChild(o); });
  // seletor de unidade — visível quando gestor está em "Todas" e há múltiplas unidades no grupo
  const lojaRow=document.getElementById('loc-loja-row');
  const lojaSel=document.getElementById('loc-loja');
  const _unidades=LOJAS.filter(l=>l.grupo===(_grupoDaLoja(lojaAtiva)||_grupoPadrao()));
  if(lojaRow&&lojaSel&&!lojaAtiva&&_unidades.length>1){
    lojaSel.innerHTML=_unidades.map(l=>`<option value="${l.id}">${l.nome}</option>`).join('');
    lojaRow.style.display='';
  } else if(lojaRow){ lojaRow.style.display='none'; }
  // dia de preferência select (1-28)
  const diaSel=document.getElementById('loc-dia-pref');
  if(diaSel){ diaSel.innerHTML='<option value="">Qualquer dia</option>'; for(let i=1;i<=28;i++){ const o=document.createElement('option'); o.value=i; o.textContent='Dia '+i; diaSel.appendChild(o); } }
  // reset campos
  document.getElementById('loc-edit-id').value='';
  document.getElementById('loc-cli').value='';
  document.getElementById('loc-end').value='';
  document.getElementById('loc-email').value='';
  sel.value='';
  if(diaSel) diaSel.value='';
  const horaPref=document.getElementById('loc-hora-pref'); if(horaPref) horaPref.value='08:00';
  _locEquipCustom=[];
  renderLocEquipList();
  if(id){
    const loc=locaisVistoria.find(x=>x.id===id);
    if(loc){
      document.getElementById('loc-edit-id').value=id;
      document.getElementById('loc-cli').value=loc.cliente||'';
      document.getElementById('loc-end').value=loc.local||'';
      document.getElementById('loc-email').value=loc.email_responsavel||'';
      sel.value=loc.tecnico||'';
      if(diaSel) diaSel.value=loc.dia_pref||'';
      if(horaPref) horaPref.value=loc.hora_pref||'08:00';
      if(lojaSel&&loc.loja_id) lojaSel.value=loc.loja_id;
      _locEquipCustom=normalizeLocEquips(loc.equipamentos||[]);
      renderLocEquipList();
    }
  }
  f.scrollIntoView({behavior:'smooth',block:'start'});
}
function fecharLocForm(){
  document.getElementById('loc-add-form').style.display='none';
  _locEquipCustom=[];
}

// Converte formato antigo (array de IDs string) para novo formato (array de objetos)
function normalizeLocEquips(equips){
  if(!equips||!equips.length) return [];
  if(typeof equips[0]==='string'){
    return equips.map(id=>{ const def=VIS_EQUIPAMENTOS_DEFAULT.find(e=>e.id===id)||{nome:id,emoji:'⚙️'}; return {id:'eq_'+Date.now()+Math.random(),nome:def.nome,modelo:'',potencia:'',serie:''}; });
  }
  return equips.map(e=>({id:e.id||'eq_'+Date.now()+Math.random(),nome:e.nome||'',modelo:e.modelo||'',potencia:e.potencia||'',serie:e.serie||''}));
}

let _locEquipCustom=[]; // [{id, nome, modelo, potencia, serie}]

function adicionarLocEquip(){
  _locEquipCustom.push({id:'eq_'+Date.now(),nome:'',modelo:'',potencia:'',serie:''});
  renderLocEquipList();
  // foco no primeiro campo do novo item
  setTimeout(()=>{
    const rows=document.querySelectorAll('.loc-eq-row');
    if(rows.length){ const inp=rows[rows.length-1].querySelector('input'); if(inp) inp.focus(); }
  },60);
}

function removerLocEquip(idx){
  _locEquipCustom.splice(idx,1);
  renderLocEquipList();
}

function renderLocEquipList(){
  const c=document.getElementById('loc-equip-list'); if(!c) return;
  if(!_locEquipCustom.length){
    c.innerHTML=`<div style="font-size:12px;color:var(--gray);padding:8px 0">Nenhum equipamento cadastrado. Clique em "＋ Adicionar" para cadastrar.</div>`;
    return;
  }
  c.innerHTML=_locEquipCustom.map((eq,i)=>`
    <div class="loc-eq-row">
      <div><label>Tipo / Nome *</label><input type="text" value="${esc(eq.nome)}" oninput="_locEquipCustom[${i}].nome=this.value" placeholder="Ex: Motobomba, Filtro, Aquecedor…"></div>
      <div><label>Modelo</label><input type="text" value="${esc(eq.modelo)}" oninput="_locEquipCustom[${i}].modelo=this.value" placeholder="Ex: Komeco KOM 15"></div>
      <div><label>Potência / Cap.</label><input type="text" value="${esc(eq.potencia)}" oninput="_locEquipCustom[${i}].potencia=this.value" placeholder="Ex: 1.5 CV"></div>
      <button class="loc-eq-del" onclick="removerLocEquip(${i})" title="Remover">🗑</button>
    </div>
  `).join('');
}


// Cria ou atualiza o agendamento mensal vinculado ao plano de acompanhamento
async function criarOuAtualizarAgendamentoPlano(rec, isEdit){
  const hoje=new Date().toISOString().split('T')[0];
  const agDados={
    cliente: rec.cliente,
    local_servico: rec.local,
    tecnico: rec.tecnico||'',
    tipo_servico: 'Vistoria de Manutenção',
    periodicidade: 'mensal',
    dia_semana: parseInt(rec.dia_pref)||null, // sem dia escolhido → não agenda no calendário
    horario: rec.hora_pref||'08:00',
    data_inicio: hoje,
    data_fim: null,
    obs: 'Plano de acompanhamento mensal',
    ativo: true,
    loja_id: rec.loja_id||lojaAtiva||LOJA_PADRAO_ID,
    local_id: rec.id
  };
  if(isEdit && rec.agendamento_id){
    // Atualiza agendamento existente
    const agIdx=todosAg.findIndex(a=>a.id===rec.agendamento_id);
    if(agIdx>=0){ todosAg[agIdx]={...todosAg[agIdx],...agDados}; lsAgSalvar(todosAg); }
    if(dbOk&&db){
      try{ const r=await dbUpdate('agendamentos', agDados, 'id', rec.agendamento_id); if(r.error) console.warn('[atualizarAgPlano]', r.error.message); }
      catch(e){ console.warn('[atualizarAgPlano]',e?.message||e); }
    }
    // Reagenda o calendário conforme o dia escolhido (ou remove se ficou sem dia)
    await _reagendarOSdoPlano({...agDados,id:rec.agendamento_id}, rec.agendamento_id);
    return rec.agendamento_id;
  } else {
    // Cria novo agendamento
    const agId='ag_plano_'+Date.now();
    const agRec={...agDados,id:agId,data_criacao:new Date().toISOString()};
    todosAg.unshift(agRec);
    lsAgSalvar(todosAg);
    // Gera OS dos próximos 6 meses no calendário
    await gerarOSdoAgendamento(agRec,agId);
    if(dbOk&&db){
      (async()=>{
        try{
          const {data:ins,error:agErr}=await dbInsert('agendamentos', agDados);
          if(agErr){ console.warn('[criarAgPlano] sync falhou:', agErr.message); return; }
          if(ins){
            todosAg=todosAg.filter(a=>a.id!==agId); todosAg.unshift(ins); lsAgSalvar(todosAg);
            // Atualiza referência no local com ID real do banco
            const locIdx=locaisVistoria.findIndex(l=>l.id===rec.id);
            if(locIdx>=0){ locaisVistoria[locIdx].agendamento_id=ins.id; await saveLocais(); }
          }
        }catch(e){ console.warn('[criarAgPlano]',e.message); }
      })();
    }
    return agId;
  }
}

let _salvandoLocal=false;
async function salvarLocal(){
  const cli=(document.getElementById('loc-cli').value||'').trim();
  const end=(document.getElementById('loc-end').value||'').trim();
  if(!cli||!end){ toast('⚠️ Preencha cliente e endereço'); return; }
  if(_salvandoLocal) return; // trava contra clique duplo (causava planos duplicados)
  const editId=document.getElementById('loc-edit-id').value;
  // Anti-duplicata: bloqueia cadastrar o mesmo cliente+local já existente na empresa
  if(!editId){
    const _n=s=>(s||'').trim().toLowerCase();
    const jaExiste=locaisVistoria.some(l=>l.ativo!==false && escopoEmpresaMatch(l.loja_id) && _n(l.cliente)===_n(cli) && _n(l.local)===_n(end));
    if(jaExiste){ toast('⚠️ Já existe um plano para esse cliente neste local'); return; }
  }
  _salvandoLocal=true;
  const _btnSalvarLoc=document.querySelector('#loc-add-form button.btn-primary[onclick="salvarLocal()"]');
  if(_btnSalvarLoc){ _btnSalvarLoc.disabled=true; _btnSalvarLoc.textContent='Salvando…'; }
  try{
  const s=getSessao();
  const existingLocal=editId?locaisVistoria.find(x=>x.id===editId):null;
  // Na edição preserva a empresa original do local; só define pela view ao criar.
  const _lojaPrev=existingLocal&&existingLocal.loja_id&&existingLocal.loja_id!=='default'?existingLocal.loja_id:null;
  const _lojaSelVal=(document.getElementById('loc-loja-row')?.style.display!=='none'&&document.getElementById('loc-loja')?.value)||'';
  const lojaId=_lojaPrev||_lojaSelVal||s?.loja_id||lojaAtiva||LOJA_PADRAO_ID;
  // valida ao menos nome de cada equipamento
  const equipsValidos=_locEquipCustom.filter(e=>e.nome.trim());
  const rec={
    id: editId||('loc_'+Date.now()),
    loja_id: lojaId,
    cliente: cli,
    local: end,
    email_responsavel: (document.getElementById('loc-email').value||'').trim(),
    tecnico: document.getElementById('loc-tec').value||'',
    dia_pref: document.getElementById('loc-dia-pref')?.value||'',
    hora_pref: document.getElementById('loc-hora-pref')?.value||'08:00',
    equipamentos: equipsValidos,
    ativo: true,
    agendamento_id: existingLocal?.agendamento_id||'',
    created_at: editId ? (existingLocal||{}).created_at||new Date().toISOString() : new Date().toISOString(),
    _pendingSync: true // limpo pelo saveLocais/loadLocaisRemoto quando sincronizar
  };
  if(editId){
    const idx=locaisVistoria.findIndex(x=>x.id===editId);
    if(idx>=0) locaisVistoria[idx]=rec; else locaisVistoria.push(rec);
  } else {
    locaisVistoria.push(rec);
  }
  // Vincula ao calendário: cria ou atualiza agendamento mensal
  const agId=await criarOuAtualizarAgendamentoPlano(rec, !!editId && !!existingLocal?.agendamento_id);
  if(agId && !rec.agendamento_id){
    const idx=locaisVistoria.findIndex(x=>x.id===rec.id);
    if(idx>=0) locaisVistoria[idx].agendamento_id=agId;
  }
  await saveLocais();
  fecharLocForm();
  renderLocaisTab();
  toast('✅ Local salvo! Visita mensal adicionada ao calendário 📅');
  }finally{
    _salvandoLocal=false;
    if(_btnSalvarLoc){ _btnSalvarLoc.disabled=false; _btnSalvarLoc.textContent='💾 Salvar plano'; }
  }
}

// Tombstones de planos apagados — impede que o loadLocaisRemoto os re-envie
// para a tabela (o que fazia planos excluídos "voltarem" na sincronização).
function _locTombLer(){ try{ return JSON.parse(ls('fluxa_loc_tombstones')||'[]'); }catch(e){ return []; } }
function _locTombAdd(id){ const t=_locTombLer(); if(!t.includes(id)){ t.push(id); lsSet('fluxa_loc_tombstones', JSON.stringify(t.slice(-500))); } }
function excluirLocal(id){
  confirmar('Remover este local da lista de recorrentes?',async ()=>{
    _locTombAdd(id);
    const loc=locaisVistoria.find(x=>x.id===id);
    // Desativa o agendamento vinculado
    if(loc?.agendamento_id){
      const agIdx=todosAg.findIndex(a=>a.id===loc.agendamento_id);
      if(agIdx>=0){ todosAg[agIdx].ativo=false; lsAgSalvar(todosAg); }
      if(dbOk&&db){
        db.from('agendamentos').update({ativo:false}).eq('id',loc.agendamento_id).then(()=>{}).catch(()=>{});
        db.from('ordens_servico').update({status:'cancelado'}).eq('agendamento_id',loc.agendamento_id).eq('status','agendado').then(()=>{}).catch(()=>{});
      }
    }
    locaisVistoria=locaisVistoria.filter(x=>x.id!==id);
    // Remove a linha na tabela dedicada (upsert não apaga). Ignora erro se tabela ausente.
    if(dbOk&&db&&_locaisTabelaOk!==false){
      try{ await db.from('locais_vistoria').delete().eq('id',id); }catch(e){ console.warn('[excluirLocal:tabela]',e?.message||e); }
    }
    await saveLocais();
    renderLocaisTab();
    toast('Local removido');
  });
}

async function toggleLocalAtivo(id){
  const loc=locaisVistoria.find(x=>x.id===id);
  if(!loc) return;
  loc.ativo=!loc.ativo;
  // Sincroniza estado do agendamento vinculado
  if(loc.agendamento_id){
    const agIdx=todosAg.findIndex(a=>a.id===loc.agendamento_id);
    if(agIdx>=0){ todosAg[agIdx].ativo=loc.ativo; lsAgSalvar(todosAg); }
    if(dbOk&&db){
      db.from('agendamentos').update({ativo:loc.ativo}).eq('id',loc.agendamento_id).then(()=>{}).catch(()=>{});
      if(!loc.ativo){
        db.from('ordens_servico').update({status:'cancelado'}).eq('agendamento_id',loc.agendamento_id).eq('status','agendado').then(()=>{}).catch(()=>{});
      }
    }
  }
  await saveLocais();
  renderLocaisTab();
}

function locVisMesAnterior(){
  if(!locaisVisMesRef) return;
  const [y,m]=locaisVisMesRef.split('-').map(Number);
  const d=new Date(y,m-2,1);
  locaisVisMesRef=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  renderLocaisTab();
}
function locVisMesProximo(){
  if(!locaisVisMesRef) return;
  const [y,m]=locaisVisMesRef.split('-').map(Number);
  const d=new Date(y,m,1);
  locaisVisMesRef=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  renderLocaisTab();
}


// Abre o formulário COMPLETO de vistoria pré-preenchido com os dados do plano
function iniciarVistoriaPlena(locId){
  const loc=locaisVistoria.find(x=>x.id===locId);
  if(!loc) return;

  // Reset estado
  visEquipSelecionados=[];
  visEquipDados={};
  _visEquipsCustom=[];
  visCheckinTime=null;
  visCheckoutTime=null;
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval=null; }
  visEditId=null;
  _visDraftId=null;
  window._visLocalId=locId;
  // Sem isto o card de assinatura nasce vazio (o HTML é preenchido só por JS)
  // e o técnico fica sem botão nenhum pra cumprir a exigência de finalizar.
  _visAssinaturaTecnico=null; renderVisAssinaturaStatus();

  // Navega para a aba Nova Vistoria
  visTab('nova');

  // Esconde o banner de pré-carga (não faz sentido junto com o banner do plano)
  const precarga=document.getElementById('vis-precarga-banner');
  if(precarga) precarga.style.display='none';

  // Mostra banner do plano
  const planoBanner=document.getElementById('vis-plano-banner');
  const planoNome=document.getElementById('vis-plano-nome');
  const planoSub=document.getElementById('vis-plano-sub');
  if(planoBanner){ planoBanner.style.display='flex'; }
  if(planoNome) planoNome.textContent=loc.cliente||'';
  if(planoSub){
    const equips=normalizeLocEquips(loc.equipamentos||[]);
    planoSub.textContent=`📍 ${loc.local||''}${equips.length?' · 🔧 '+equips.length+' equipamentos':''}`;
  }

  // Preenche data e mês de referência usando hora LOCAL (não UTC)
  const hoje=new Date();
  const localDate=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  const localMes=localDate.slice(0,7);
  const ddEl=document.getElementById('vis-data'); if(ddEl) ddEl.value=localDate;
  const mmEl=document.getElementById('vis-mes-ref'); if(mmEl) mmEl.value=localMes;

  // Preenche cliente e local
  const cliInp=document.getElementById('vis-cli'); if(cliInp) cliInp.value=loc.cliente||'';
  const locInp=document.getElementById('vis-loc'); if(locInp) locInp.value=loc.local||'';

  // Preenche e-mail do responsável
  if(loc.email_responsavel){
    const emEl=document.getElementById('vis-email-resp'); if(emEl) emEl.value=loc.email_responsavel;
    const stEl=document.getElementById('vis-email-status');
    if(stEl) stEl.textContent=`📧 ${loc.email_responsavel} (do plano)`;
  }

  // Preenche horário preferencial
  if(loc.hora_pref){ const hEl=document.getElementById('vis-hora'); if(hEl) hEl.value=loc.hora_pref; }

  // Preenche técnico
  const tecSel=document.getElementById('vis-tec');
  if(tecSel){
    const tNome=loc.tecnico||(getSessao()?.nome||'');
    if(tNome){ for(const o of tecSel.options){ if(o.text===tNome||o.value===tNome){ o.selected=true; break; } } }
  }

  // Carrega equipamentos do plano como _visEquipsCustom (com modelo/potência)
  const equips=normalizeLocEquips(loc.equipamentos||[]);
  if(equips.length){
    _visEquipsCustom=equips.map(e=>({id:e.id,nome:e.nome,emoji:e.emoji||'⚙️',modelo:e.modelo||'',potencia:e.potencia||''}));
    equips.forEach(e=>{ visEquipDados[e.id]={status:'na',obs:'',fotos:[]}; });
  }

  renderVisChips();
  renderVisEquipGrid();
  const card=document.getElementById('vis-equip-card');
  if(card) card.style.display=equips.length?'':'none';

  // Vindo do plano, os dados já estão preenchidos → recolhe o bloco "Dados da
  // Visita" para o técnico ir direto aos equipamentos (menos scroll no campo).
  const _dadosBody=document.getElementById('vis-dados-body');
  const _dadosToggle=document.getElementById('vis-dados-toggle');
  if(_dadosBody) _dadosBody.style.display='none';
  if(_dadosToggle) _dadosToggle.textContent='▼ expandir';

  // Inicia check-in automaticamente
  visCheckin();

  // Scroll para o topo
  window.scrollTo({top:0,behavior:'smooth'});
}

let _tecVerTodos=false;
function toggleTecVerTodos(){ _tecVerTodos=!_tecVerTodos; renderLocaisTab(); }
function renderLocaisTab(){
  loadLocais();
  const s=getSessao();
  // usa a variável global lojaAtiva (controlada pelo header dropdown)
  // NÃO cria shadow local — era o bug que fazia todos os locais aparecerem para qualquer gestor
  const isTecnico=s?.perfil==='tecnico';
  const nomeLogado=s?.nome||'';
  const mesNomes=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  // Mês de referência padrão
  if(!locaisVisMesRef){
    const now=new Date();
    locaisVisMesRef=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  }
  const [y,m]=locaisVisMesRef.split('-').map(Number);
  const labelEl=document.getElementById('loc-mes-label');
  if(labelEl) labelEl.textContent=mesNomes[m-1].slice(0,3)+' '+y;

  // Visibilidade do botão "Novo plano" (só gestor)
  const btnNovo=document.getElementById('loc-btn-novo');
  if(btnNovo) btnNovo.style.display=isTecnico?'none':'';

  // Header (só gestor vê o bloco de cabeçalho completo; técnico vê versão simplificada)
  const pgHdr=document.getElementById('loc-page-header');
  if(pgHdr){
    const tecTitle=pgHdr.querySelector('.loc-page-title-row div div:first-child');
    if(isTecnico && tecTitle){ tecTitle.textContent='📍 Minhas visitas do mês'; }
  }

  // Filtro de busca por nome/local
  const buscaTxt=(document.getElementById('loc-busca')?.value||'').toLowerCase().trim();
  const _matchBusca=l=>!buscaTxt||(l.cliente||'').toLowerCase().includes(buscaTxt)||(l.local||'').toLowerCase().includes(buscaTxt);

  // Filtro de empresa unificado (ver escopoEmpresaMatch) — técnico/gestor/loja
  const _lojaMatch=l=>escopoEmpresaMatch(l.loja_id);
  // Técnico vê só os planos atribuídos a ele (+ os "sem técnico"), a menos que
  // ative "ver todos". Deixa a tela dele focada nas visitas que são dele.
  const _nomeTec=nomeLogado.trim().toLowerCase();
  const _tecMatch=l=>!isTecnico || _tecVerTodos || !((l.tecnico||'').trim()) || (l.tecnico||'').trim().toLowerCase()===_nomeTec;
  // Filtra locais ativos da empresa atual
  const locaisFiltrados=locaisVistoria.filter(l=>
    _lojaMatch(l) && l.ativo!==false && _matchBusca(l) && _tecMatch(l)
  );
  // Gestor vê também os inativos
  const todosLoja=isTecnico ? locaisFiltrados : locaisVistoria.filter(l=>_lojaMatch(l) && _matchBusca(l));

  // Vistorias deste mês com o mesmo filtro de empresa
  const vis=lsVisLer().filter(v=> v.mes_ref===locaisVisMesRef && _lojaMatch(v));

  // Build tracking somente dos ativos para stats
  const trackingAtivos=locaisFiltrados.map(loc=>{
    const vistoria=vis.find(v=>(v.local_id&&v.local_id===loc.id)||(v.cliente===loc.cliente&&v.local===loc.local));
    return {loc, vistoria, feita:!!vistoria};
  });
  const nFeitas=trackingAtivos.filter(x=>x.feita).length;
  const nPend=trackingAtivos.filter(x=>!x.feita).length;

  // Stats
  const statsEl=document.getElementById('loc-stats-row');
  if(statsEl) statsEl.innerHTML=`
    <div class="loc-stat"><span class="loc-stat-icon">✅</span><div class="loc-stat-info"><div class="loc-stat-val">${nFeitas}</div><div class="loc-stat-lbl">Realizadas</div></div></div>
    <div class="loc-stat"><span class="loc-stat-icon">⏳</span><div class="loc-stat-info"><div class="loc-stat-val">${nPend}</div><div class="loc-stat-lbl">Pendentes</div></div></div>
    <div class="loc-stat"><span class="loc-stat-icon">📍</span><div class="loc-stat-info"><div class="loc-stat-val">${locaisFiltrados.length}</div><div class="loc-stat-lbl">Ativos</div></div></div>
  `;

  // ── Lista unificada ──
  const listaEl=document.getElementById('loc-lista-unificada');
  if(!listaEl) return;

  if(todosLoja.length===0){
    listaEl.innerHTML=`<div class="loc-empty">
      <div class="loc-empty-icon">📋</div>
      <div class="loc-empty-txt">${isTecnico?'Nenhum local atribuído a você ainda.':'Nenhum plano cadastrado ainda.<br>Clique em <strong>＋ Novo plano</strong> para começar.'}</div>
      ${!isTecnico?`<button class="btn-primary" onclick="abrirLocForm()">＋ Adicionar primeiro plano</button>`:''}
    </div>`;
    return;
  }

  // Ordena: ativos pendentes primeiro, ativos feitos depois, inativos por último
  const sorted=[...todosLoja].sort((a,b)=>{
    const aAtivo=a.ativo!==false, bAtivo=b.ativo!==false;
    if(aAtivo!==bAtivo) return bAtivo-aAtivo; // ativos antes
    const aVis=vis.find(v=>(v.local_id&&v.local_id===a.id)||(v.cliente===a.cliente&&v.local===a.local));
    const bVis=vis.find(v=>(v.local_id&&v.local_id===b.id)||(v.cliente===b.cliente&&v.local===b.local));
    return (!!aVis)-(!!bVis); // pendentes antes dos feitos
  });

  listaEl.innerHTML=sorted.map(loc=>{
    const ativo=loc.ativo!==false;
    const vistoria=vis.find(v=>(v.local_id&&v.local_id===loc.id)||(v.cliente===loc.cliente&&v.local===loc.local));
    const feita=!!vistoria;
    const cls=!ativo?'inativo':feita?'feita':'pendente';
    const icon=!ativo?'⏸':feita?'✅':'⏳';

    // Status do mês
    let statusHtml='';
    if(!ativo){
      statusHtml=`<div class="loc-ucard-status" style="color:var(--gray)">⏸ Inativo</div>`;
    } else if(feita){
      const dataFmt=vistoria.data?vistoria.data.split('-').reverse().join('/'):'?';
      statusHtml=`<div class="loc-ucard-status ok">✅ Realizada em ${dataFmt}${vistoria.tecnico?' — '+vistoria.tecnico:''}</div>`;
    } else {
      statusHtml=`<div class="loc-ucard-status pend">⏳ Pendente — ${mesNomes[m-1]} ${y}</div>`;
    }

    // Ações do mês (coluna direita)
    let acoesHtml='';
    if(ativo && feita){
      acoesHtml=`
        <button class="tb" onclick="abrirVisRelatorio('${vistoria.id}')" title="Ver relatório PDF" style="font-size:12px;padding:5px 10px">📄 Relatório</button>
        <button class="tb" onclick="reenviarEmailVistoria('${vistoria.id}')" title="Reenviar e-mail">✉️</button>
        ${!isTecnico?`<button class="tb" onclick="desfazerVistoriaLocal('${vistoria.id}')" title="Apagar esta visita do mês (volta a pendente)" style="font-size:12px;padding:5px 10px;color:var(--red)">🗑️ Desfazer</button>`:''}`;
    } else if(ativo){
      acoesHtml=`<button class="btn-primary" style="padding:7px 14px;font-size:13px;white-space:nowrap" onclick="iniciarVistoriaPlena('${loc.id}')">🔍 Fazer Vistoria</button>`;
    }
    // Botão Google Maps sempre visível quando há endereço
    const mapsUrl='https://maps.google.com/?q='+encodeURIComponent((loc.local||'')+' '+(loc.cliente||''));
    const mapsBtn=loc.local?`<a href="${mapsUrl}" target="_blank" rel="noopener" class="tb" style="font-size:12px;padding:5px 10px;text-decoration:none;display:inline-flex;align-items:center;gap:3px" title="Abrir no Google Maps">📍 Maps</a>`:'';
    if(mapsBtn) acoesHtml = mapsBtn + ' ' + acoesHtml;

    // Rodapé com ações de gestão (só gestor)
    const rodape=!isTecnico?`
      <div class="loc-ucard-footer">
        <button class="tb" onclick="abrirLocForm('${loc.id}')" title="Editar plano" style="font-size:12px">✏️ Editar</button>
        <button class="tb" onclick="toggleLocalAtivo('${loc.id}')" title="${ativo?'Pausar':'Reativar'}" style="font-size:12px">${ativo?'⏸ Pausar':'▶ Reativar'}</button>
        <button class="tb" onclick="excluirLocal('${loc.id}')" title="Excluir" style="font-size:12px;color:var(--red)">🗑️ Excluir</button>
      </div>`:'';

    return `<div class="loc-ucard ${cls}">
      <div class="loc-ucard-top">
        <span class="loc-ucard-icon">${icon}</span>
        <div class="loc-ucard-info">
          <div class="loc-ucard-nome">${esc(loc.cliente)}${(()=>{ if(!lojaAtiva&&loc.loja_id&&loc.loja_id!=='default'){ const _l=getLoja(loc.loja_id); return _l?` <span class="loja-badge ${_l.cor}" style="font-size:9px;vertical-align:middle">${_l.nome.replace('Fortemp ','')}</span>`:'' } return ''; })()}</div>
          <div class="loc-ucard-det">📍 ${esc(loc.local)}${loc.tecnico?' · 👤 '+esc(loc.tecnico):''}${loc.hora_pref?' · 🕐 '+esc(loc.hora_pref):''}${(()=>{const eq=normalizeLocEquips(loc.equipamentos||[]);return eq.length?' · 🔧 '+eq.length+' equip.':'';})()} </div>
          ${statusHtml}
        </div>
        <div class="loc-ucard-acts">${acoesHtml}</div>
      </div>
      ${rodape}
    </div>`;
  }).join('');
  // Toggle "só os meus / todos" — só para técnico
  if(isTecnico){
    const _lbl=_tecVerTodos?'👁 Vendo todos os locais':'👤 Vendo só os meus';
    const _alt=_tecVerTodos?'ver só os meus':'ver todos';
    listaEl.insertAdjacentHTML('afterbegin',
      `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;padding:8px 12px;background:var(--gray-light);border-radius:10px;font-size:12px">
         <span style="font-weight:700;color:var(--c2)">${_lbl}</span>
         <button class="tb" style="font-size:11px" onclick="toggleTecVerTodos()">${_alt}</button>
       </div>`);
  }
}
/* ══ /LOCAIS RECORRENTES ══ */

function initVisitas(){
  // Preenche técnicos no select
  atualizarTecsPorLoja(null,'vis-tec');
  // Data e mês ref padrão = hoje
  const hoje = new Date();
  const dd = document.getElementById('vis-data');
  const mm = document.getElementById('vis-mes-ref');
  if(dd && !dd.value) dd.value = _hojeLocal();
  if(mm && !mm.value) mm.value = _hojeLocal().slice(0,7);
  // Chips de equipamentos
  renderVisChips();
  // Histórico — default = mês atual
  const hmEl = document.getElementById('vis-hist-mes');
  if(hmEl && !hmEl.value) hmEl.value = _hojeLocal().slice(0,7);
  renderVisHistorico();
  // Popula autocomplete técnico no select
  const sel = document.getElementById('vis-tec');
  if(sel){
    const sess = getSessao();
    if(sess?.perfil==='tecnico' && sess.nome){
      // auto-seleciona técnico logado
      for(let o of sel.options){ if(o.text===sess.nome){ o.selected=true; break; } }
    }
  }
  loadLocais();
}

function visTab(tab){
  ['nova','hist','locais'].forEach(t=>{
    const v=document.getElementById('vis-view-'+t);
    const b=document.getElementById('vis-tab-'+t);
    if(v) v.style.display = t===tab ? '' : 'none';
    if(b){ b.classList.toggle('on', t===tab); }
  });
  if(tab==='nova'){
    // técnico não precisa ver campo de e-mail
    const emailRow=document.getElementById('vis-email-row');
    if(emailRow) emailRow.style.display = eTecnico() ? 'none' : '';
  }
  if(tab!=='nova') window._visPreCargaRec = null;
  if(tab==='nova') _visAtualizarBtnDescartar();
  if(tab==='hist') renderVisHistorico();
  if(tab==='locais') renderLocaisTab();
}

// ── Chips de seleção de equipamentos ──
function renderVisChips(){
  const el = document.getElementById('vis-equip-chips'); if(!el) return;
  el.innerHTML = VIS_EQUIPAMENTOS_DEFAULT.map(eq=>`
    <div class="vis-chip${visEquipSelecionados.includes(eq.id)?' on':''}"
         onclick="toggleVisEquip('${eq.id}')" data-visid="${eq.id}">
      ${eq.emoji} ${eq.nome}
    </div>`).join('');
}

function toggleVisEquip(id){
  if(visEquipSelecionados.includes(id)){
    visEquipSelecionados = visEquipSelecionados.filter(x=>x!==id);
    delete visEquipDados[id];
  } else {
    visEquipSelecionados.push(id);
    if(!visEquipDados[id]) visEquipDados[id] = { status:'na', obs:'', fotos:[] };
  }
  renderVisChips();
  renderVisEquipGrid();
  const card = document.getElementById('vis-equip-card');
  if(card) card.style.display = visEquipSelecionados.length?'':'none';
}

let _visEquipsCustom=[]; // equipamentos fora da lista padrão: do plano ou avulsos

// Origem de um equipamento lido de um registro gravado. Vistorias salvas antes
// deste campo existir não têm `origem`; nelas o prefixo do id é o único sinal,
// e na dúvida cai em "do plano" — que era o único caso possível na época.
function _visOrigemEquip(e){
  return e.origem || (String(e.id||'').startsWith('adhoc_') ? 'avulso' : 'plano');
}

// ── Equipamento avulso (fora dos 9 chips padrão) ──────────────────────────
// Mesma estrutura dos equipamentos que vêm do plano — muda só a `origem`, que
// existe pra não rotular como "do plano" algo que o técnico digitou na hora.
// Tudo o mais (grid, rascunho, gravação, PDF, pré-carga) já era genérico e
// funciona sem alteração.
function visAdhocAbrir(){
  const f=document.getElementById('vis-adhoc-form'), b=document.getElementById('vis-adhoc-abrir');
  if(!f) return;
  f.style.display='flex'; if(b) b.style.display='none';
  document.getElementById('vis-adhoc-nome')?.focus();
}
function visAdhocFechar(){
  const f=document.getElementById('vis-adhoc-form'), b=document.getElementById('vis-adhoc-abrir');
  if(f) f.style.display='none'; if(b) b.style.display='';
  const i=document.getElementById('vis-adhoc-nome'); if(i) i.value='';
}
function visAdhocConfirmar(){
  const i=document.getElementById('vis-adhoc-nome');
  const nome=(i?.value||'').trim();
  if(!nome){ toast('Dê um nome ao equipamento'); i?.focus(); return; }
  _visAddEquipAvulso(nome);
  visAdhocFechar();
  toast('⚙️ '+nome+' adicionado');
}
function _visAddEquipAvulso(nome, dados){
  const id='adhoc_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  _visEquipsCustom.push({id, nome, emoji:'⚙️', modelo:'', potencia:'', origem:'avulso'});
  visEquipDados[id]=dados||{status:'na',obs:'',fotos:[]};
  renderVisEquipGrid();
  const card=document.getElementById('vis-equip-card'); if(card) card.style.display='';
  _salvarRascunhoVisDeb();
  return id;
}
// Renomear serve pro caso real de "Motobomba Principal" ser, naquele local, a
// "Bomba da cascata". Um equipamento PADRÃO renomeado vira avulso e sai dos
// chips: manter o id padrão com outro nome faria a pré-carga da próxima
// vistoria devolver o nome de fábrica e apagar a correção silenciosamente.
function visRenomearEquip(id){
  const custom=(_visEquipsCustom||[]).find(e=>e.id===id);
  const def=VIS_EQUIPAMENTOS_DEFAULT.find(e=>e.id===id);
  const atual=custom?custom.nome:(def?def.nome:'');
  if(!atual) return;
  _promptTexto('Renomear equipamento', atual, novo=>{
    const n=(novo||'').trim(); if(!n||n===atual) return;
    if(custom){ custom.nome=n; renderVisEquipGrid(); _salvarRascunhoVisDeb(); toast('Renomeado'); return; }
    // padrão → avulso, levando junto status/obs/fotos já preenchidos
    const d=visEquipDados[id]||{status:'na',obs:'',fotos:[]};
    visEquipSelecionados=visEquipSelecionados.filter(x=>x!==id);
    delete visEquipDados[id];
    _visAddEquipAvulso(n, d);
    renderVisChips();
    toast('Renomeado');
  });
}
function visRemoverEquipAvulso(id){
  const eq=(_visEquipsCustom||[]).find(e=>e.id===id); if(!eq) return;
  confirmar('Remover "'+eq.nome+'" desta vistoria? O que já foi preenchido nele será perdido.', ()=>{
    _visEquipsCustom=_visEquipsCustom.filter(e=>e.id!==id);
    delete visEquipDados[id];
    renderVisEquipGrid();
    const card=document.getElementById('vis-equip-card');
    if(card) card.style.display=(visEquipSelecionados.length||_visEquipsCustom.length)?'':'none';
    _salvarRascunhoVisDeb();
    toast('Removido');
  }, 'Remover equipamento');
}

// ── Grid de vistoria por equipamento ──
function renderVisEquipGrid(){
  const el = document.getElementById('vis-equip-grid'); if(!el) return;
  el.innerHTML = '';
  // Esconde/mostra o bloco de equipamentos
  const card = document.getElementById('vis-equip-card');
  const hasEquips=visEquipSelecionados.length>0||_visEquipsCustom.length>0;
  if(card) card.style.display=hasEquips?'':'none';

  // Equipamentos fora dos chips padrão, em dois grupos: o que veio do plano do
  // local e o que o técnico acrescentou na hora. Misturar os dois numa seção
  // só chamada "do plano" faria o relatório afirmar algo que não é verdade.
  const customIds=_visEquipsCustom.map(e=>e.id);
  const secao=(titulo,lista)=>{
    if(!lista.length) return;
    const t=document.createElement('div');
    t.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin:12px 0 8px';
    t.textContent=titulo;
    el.appendChild(t);
    lista.forEach(ceq=>{
      const id=ceq.id;
      if(!visEquipDados[id]) visEquipDados[id]={status:'na',obs:'',fotos:[]};
      el.appendChild(buildEquipBlock(id,ceq.emoji||'⚙️',ceq.nome,visEquipDados[id],ceq.modelo,ceq.potencia,{remover:true}));
    });
  };
  secao('Equipamentos do plano', _visEquipsCustom.filter(e=>e.origem!=='avulso'));
  secao('Acrescentados nesta vistoria', _visEquipsCustom.filter(e=>e.origem==='avulso'));

  // Renderiza equipamentos padrão selecionados pelos chips
  const stdIds=visEquipSelecionados.filter(id=>!customIds.includes(id));
  if(stdIds.length){
    const secTit2=document.createElement('div');
    secTit2.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin:12px 0 8px';
    secTit2.textContent='Outros equipamentos';
    el.appendChild(secTit2);
    stdIds.forEach(id=>{
      const def=VIS_EQUIPAMENTOS_DEFAULT.find(x=>x.id===id);
      if(!def) return;
      const d=visEquipDados[id]||{status:'na',obs:'',fotos:[]};
      el.appendChild(buildEquipBlock(id,def.emoji,def.nome,d,'','',{remover:false}));
    });
  }

  // Barra de progresso mobile (17/08, portado do fluxa-app v1) — conta
  // quem já tem status marcado (bom/atenção/crítico/N-A contam como
  // "vistoriado", só pendente é quem ainda não recebeu toque nenhum nos
  // botões de status). "na" é o valor padrão gravado assim que o
  // equipamento é ADICIONADO, antes de qualquer avaliação real — não dá
  // pra diferenciar "nunca tocado" de "usuário confirmou N/A" sem mudar o
  // dado, então conta só bom/atenção/crítico: mais conservador (um N/A
  // real fica "pendente" pra sempre), mas não finge progresso que não
  // existe — 100% de cara em tudo seria pior.
  (function(){
    const prog=document.getElementById('vis-progresso-mobile'); if(!prog) return;
    const ordem=[...customIds, ...stdIds];
    if(!ordem.length){ prog.style.display='none'; return; }
    prog.style.display=''; // deixa a media query decidir (bloco no mobile, oculto no desktop)
    const feitos=ordem.filter(id=>{ const st=visEquipDados[id]?.status; return st&&st!=='na'; }).length;
    setV_el('vis-progresso-txt', feitos+' de '+ordem.length+' vistoriados','textContent');
    const fill=document.getElementById('vis-progresso-fill');
    if(fill) fill.style.width=Math.round(feitos/ordem.length*100)+'%';
  })();
}

function buildEquipBlock(id,emoji,nome,d,modelo,potencia,opts){
  const badgeMap={bom:'badge-bom',atencao:'badge-atencao',critico:'badge-critico',na:'badge-na'};
  const badgeTxt={bom:'✅ Bom',atencao:'⚠️ Atenção',critico:'🔴 Crítico',na:'— N/A'};
  const stClass='status-'+(d.status||'na');
  const block=document.createElement('div');
  block.className=`vis-equip-block ${stClass}`;
  block.id=`vis-block-${id}`;
  const fotosHtml=[0,1,2].map(i=>{
    const f=(d.fotos||[])[i];
    return `<div class="vis-foto-slot${f?' filled':''}" onclick="visClickFotoSlot('${id}',${i})">
      <input type="file" id="vis-f-${id}-${i}" accept="image/*" style="display:none" onchange="visCarregarFoto(this,'${id}',${i})">
      ${f?`<img src="${f}" alt="">`:''}
      <div class="vis-foto-slot-icon">📷</div>
      <button class="vis-foto-rm" onclick="event.stopPropagation();visRemoverFoto('${id}',${i})" title="Remover">✕</button>
    </div>`;
  }).join('');
  const subInfo=modelo||potencia?`<div style="font-size:11px;color:var(--gray);margin-top:1px">${[modelo,potencia].filter(Boolean).join(' · ')}</div>`:'';
  block.innerHTML=`
    <div class="vis-equip-hdr" onclick="toggleVisEquipBody('${id}')">
      <div class="vis-equip-emoji">${emoji}</div>
      <div style="flex:1;min-width:0"><div class="vis-equip-nome">${esc(nome)}</div>${subInfo}</div>
      <button class="vis-equip-acao" title="Renomear" onclick="event.stopPropagation();visRenomearEquip('${id}')">✎</button>
      ${opts&&opts.remover?`<button class="vis-equip-acao" title="Remover desta vistoria" onclick="event.stopPropagation();visRemoverEquipAvulso('${id}')">✕</button>`:''}
      <div class="vis-equip-badge ${badgeMap[d.status||'na']}">${badgeTxt[d.status||'na']}</div>
      <div class="vis-equip-toggle" id="vis-arr-${id}">▼</div>
    </div>
    <div class="vis-equip-body open" id="vis-body-${id}">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Status</div>
      <div class="vis-status-row">
        <button class="vis-status-btn${d.status==='bom'?' sel-bom':''}" onclick="setVisEquipStatus('${id}','bom')">✅ Bom</button>
        <button class="vis-status-btn${d.status==='atencao'?' sel-atencao':''}" onclick="setVisEquipStatus('${id}','atencao')">⚠️ Atenção</button>
        <button class="vis-status-btn${d.status==='critico'?' sel-critico':''}" onclick="setVisEquipStatus('${id}','critico')">🔴 Crítico</button>
        <button class="vis-status-btn${d.status==='na'?' sel-na':''}" onclick="setVisEquipStatus('${id}','na')">— N/A</button>
      </div>
      <div class="fl" style="margin-bottom:8px">
        <label>Observações</label>
        <div class="vis-obs-chips">
          ${['OK – funcionando','Limpeza realizada','Vazando','Barulho anormal','Pressão baixa','Necessita troca de peça','Filtro sujo'].map(t=>`<span class="vis-obs-chip" onclick="visAddObs('${id}','${t.replace(/'/g,'\\x27')}',this)">${t}</span>`).join('')}
        </div>
        <textarea id="vis-obs-${id}" rows="2" placeholder="Condições encontradas, medições, pendências…" oninput="visUpdObs('${id}',this.value)"
          style="width:100%;padding:8px 10px;border:1.5px solid var(--gray-mid);border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;resize:vertical;outline:none">${esc(d.obs||'')}</textarea>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Fotos</div>
      <div class="vis-fotos-row">${fotosHtml}</div>
    </div>`;
  return block;
}

function toggleVisEquipBody(id){
  const b = document.getElementById('vis-body-'+id);
  const a = document.getElementById('vis-arr-'+id);
  if(!b) return;
  const open = b.classList.contains('open');
  b.classList.toggle('open',!open);
  if(a) a.textContent = open?'▶':'▼';
}

function setVisEquipStatus(id, status){
  if(!visEquipDados[id]) visEquipDados[id]={ status:'na', obs:'', fotos:[] };
  visEquipDados[id].status = status;
  renderVisEquipGrid();
  _salvarRascunhoVisDeb();
}

function visUpdObs(id, val){
  if(!visEquipDados[id]) visEquipDados[id]={ status:'na', obs:'', fotos:[] };
  visEquipDados[id].obs = val;
  _salvarRascunhoVisDeb();
}

function visAddObs(id, txt, chipEl){
  if(!visEquipDados[id]) visEquipDados[id]={ status:'na', obs:'', fotos:[] };
  const ta = document.getElementById('vis-obs-'+id);
  const cur = (ta ? ta.value : visEquipDados[id].obs||'').trim();
  const novo = cur ? cur+'. '+txt : txt;
  visEquipDados[id].obs = novo;
  if(ta) ta.value = novo;
  // Visual feedback: highlight chip briefly
  if(chipEl){ chipEl.style.background='var(--c1-light)'; chipEl.style.borderColor='var(--c1)'; setTimeout(()=>{ chipEl.style.background=''; chipEl.style.borderColor=''; },600); }
}

function visClickFotoSlot(id, idx){
  document.getElementById(`vis-f-${id}-${idx}`)?.click();
}
function visCarregarFoto(inp, id, idx){
  const f = inp.files[0]; if(!f) return;
  if(f.size > FOTO_MAX_BYTES){ toast('⚠️ Foto muito grande (máx 20 MB).'); inp.value=''; return; }
  const r = new FileReader();
  r.onload = async e => {
    const compressed=await compressImage(e.target.result, 800, 0.55);
    if(!visEquipDados[id]) visEquipDados[id]={ status:'na', obs:'', fotos:[] };
    if(!visEquipDados[id].fotos) visEquipDados[id].fotos=[];
    visEquipDados[id].fotos[idx] = compressed;
    renderVisEquipGrid();
    _salvarRascunhoVisDeb();
  };
  r.readAsDataURL(f);
}
function visRemoverFoto(id, idx){
  if(visEquipDados[id]?.fotos) visEquipDados[id].fotos[idx]=null;
  renderVisEquipGrid();
  _salvarRascunhoVisDeb();
}

// ══ RASCUNHO AUTOMÁTICO DA VISTORIA ══════════════════════════════════════
// O navegador do celular DESCARTA a página quando a tela apaga ou o app vai
// pra segundo plano — e uma vistoria de condomínio leva a manhã inteira.
// Sem isto, o técnico perde tudo no meio da visita e ninguém sabe por quê.
const LS_VIS_DRAFT='fluxa_vis_draft';
let _visDraftTimer=null, _visDraftCloudTimer=null, _visDraftRestaurado=false;
let _ultimoAvisoRascunhoCheio=0;
const _VIS_DRAFT_CAMPOS=['vis-cli','vis-cli-id','vis-loc','vis-data','vis-mes-ref','vis-hora','vis-obs','vis-recom','vis-email-resp','vis-tec'];
const _VIS_DRAFT_MAX_MS=12*60*60*1000; // >12h não é "vistoria em andamento"

function _salvarRascunhoVis(){
  try{
    const cli=document.getElementById('vis-cli')?.value||'';
    // só salva se há algo em andamento — senão sobrescreve rascunho bom com vazio
    if(!cli && !visEquipSelecionados.length && !(_visEquipsCustom||[]).length && !visCheckinTime) return;
    const d={ t:Date.now(), campos:{},
      sel:visEquipSelecionados, custom:_visEquipsCustom, dados:visEquipDados,
      checkin:visCheckinTime?visCheckinTime.getTime():null,
      checkout:visCheckoutTime?visCheckoutTime.getTime():null,
      localId:window._visLocalId||null, editId:visEditId||null, draftId:_visDraftId||null,
      piscinaId:_visPiscinaSelecionadaId||null,
      assinatura:_visAssinaturaTecnico||null };
    _VIS_DRAFT_CAMPOS.forEach(fid=>{ const el=document.getElementById(fid); if(el) d.campos[fid]=el.value; });
    // setItem DIRETO, não lsSet: o lsSet tem catch próprio e engoliria o
    // QuotaExceededError — o fallback sem-fotos abaixo nunca rodaria, e a
    // perda seria silenciosa. Mas a CHAVE tem que ser a escopada por empresa
    // (_lsKey), senão grava numa chave que _restaurarRascunhoVis (que lê via
    // ls()) nunca lê — o rascunho não restaurava em produção (R-2).
    try{ localStorage.setItem(_lsKey(LS_VIS_DRAFT), JSON.stringify(d)); }
    catch(eq){
      // Cota estourada (fotos pesam). Salvar sem as fotos ainda não enviadas
      // é melhor que perder o rascunho inteiro — mas o técnico precisa saber.
      const semFotos=JSON.parse(JSON.stringify(d));
      let tinhaFotoPendente=false;
      Object.values(semFotos.dados||{}).forEach(x=>{
        if(x&&x.fotos) x.fotos=x.fotos.map(f=>{ if(f&&String(f).startsWith('http')) return f; if(f) tinhaFotoPendente=true; return null; });
      });
      try{ localStorage.setItem(_lsKey(LS_VIS_DRAFT), JSON.stringify(semFotos)); }catch(e2){ console.warn('[rascunhoVis:quota]', e2?.message||e2); }
      if(tinhaFotoPendente && Date.now()-_ultimoAvisoRascunhoCheio > 60000){
        _ultimoAvisoRascunhoCheio=Date.now();
        toast('⚠️ Muitas fotos no rascunho local — as que ainda não subiram podem se perder se o app fechar. Mantenha a internet ligada até finalizar.');
      }
    }
    _syncRascunhoNuvemDeb();
  }catch(e){ console.warn('[rascunhoVis]', e?.message||e); }
}
function _salvarRascunhoVisDeb(){
  clearTimeout(_visDraftTimer);
  _visDraftTimer=setTimeout(_salvarRascunhoVis, 700);
  // Fora do debounce: o link de descartar tem que aparecer/sumir junto com a
  // ação da pessoa, não 700ms depois dela.
  _visAtualizarBtnDescartar();
}
function _limparRascunhoVis(){
  try{ lsSet(LS_VIS_DRAFT,''); }catch(e){ console.warn('[limparRascunhoVis]',e?.message||e); }
  _visDraftRestaurado=false;
  _apagarRascunhoNuvem();
}

// ── Backup na nuvem (tabela vistoria_rascunhos) ──
// O rascunho local não sobrevive se o celular morrer, for perdido ou tiver os
// dados limpos — e a equipe já saiu do local. 1 rascunho ativo por usuário.
function _draftCloudId(){
  const n=_normNome(getSessao()?.nome||'');
  return n?('draft_'+n.replace(/[^a-z0-9]/g,'_')):null;
}
function _syncRascunhoNuvemDeb(){ clearTimeout(_visDraftCloudTimer); _visDraftCloudTimer=setTimeout(_syncRascunhoNuvem, 4000); }
async function _syncRascunhoNuvem(){
  try{
    if(!dbOk||!db) return;
    const id=_draftCloudId(); if(!id) return;
    const raw=ls(LS_VIS_DRAFT); if(!raw) return;
    const r=await dbUpsert('vistoria_rascunhos', {id, empresa_id:EMPRESA_ID, usuario:getSessao()?.nome||'', dados:JSON.parse(raw), updated_at:new Date().toISOString()});
    if(r&&r.error) console.warn('[rascunhoNuvem]', r.error.message);
  }catch(e){ console.warn('[rascunhoNuvem]', e?.message||e); }
}
function _apagarRascunhoNuvem(){
  try{
    const id=_draftCloudId();
    if(dbOk&&db&&id) db.from('vistoria_rascunhos').delete().eq('id',id).then(()=>{}).catch(e=>console.warn('[rascunhoNuvem:del]',e?.message||e));
  }catch(e){ console.warn('[rascunhoNuvem:del]', e?.message||e); }
}
// Restaura da nuvem quando ela é MAIS NOVA que o local (ou o local nem existe)
// — o caso real é o celular ter quebrado e o técnico logar em outro aparelho.
async function _restaurarRascunhoNuvem(){
  try{
    if(!dbOk||!db) return false;
    const id=_draftCloudId(); if(!id) return false;
    const {data,error}=await db.from('vistoria_rascunhos').select('dados').eq('id',id).limit(1);
    if(error||!data||!data.length||!data[0].dados) return false;
    const nuvem=data[0].dados;
    if(Date.now()-(nuvem.t||0) > _VIS_DRAFT_MAX_MS) return false;
    let local=null; try{ local=JSON.parse(ls(LS_VIS_DRAFT)||'null'); }catch(e){ console.warn('[rascunhoNuvem:parse]',e?.message||e); }
    if(local && (local.t||0) >= (nuvem.t||0)) return false; // local já é igual ou mais novo
    localStorage.setItem(_lsKey(LS_VIS_DRAFT), JSON.stringify(nuvem));
    _visDraftRestaurado=false;
    return _restaurarRascunhoVis();
  }catch(e){ console.warn('[rascunhoNuvem:rest]', e?.message||e); return false; }
}
function _restaurarRascunhoVis(){
  if(_visDraftRestaurado) return false;
  let d=null; try{ d=JSON.parse(ls(LS_VIS_DRAFT)||'null'); }catch(e){ return false; }
  if(!d||!d.t) return false;
  if(Date.now()-d.t > _VIS_DRAFT_MAX_MS){ _limparRascunhoVis(); return false; }
  _visDraftRestaurado=true;
  visEquipSelecionados=d.sel||[];
  _visEquipsCustom=d.custom||[];
  visEquipDados=d.dados||{};
  window._visLocalId=d.localId||null; visEditId=d.editId||null; _visDraftId=d.draftId||null;
  _visPiscinaSelecionadaId=d.piscinaId||null;
  visCheckinTime=d.checkin?new Date(d.checkin):null;
  visCheckoutTime=d.checkout?new Date(d.checkout):null;
  _visAssinaturaTecnico=d.assinatura||null;
  renderVisAssinaturaStatus();
  Object.entries(d.campos||{}).forEach(([fid,v])=>{ const el=document.getElementById(fid); if(el&&v!==undefined&&v!==null) el.value=v; });
  renderVisChips(); renderVisEquipGrid();
  if(typeof _visRenderPiscinas==='function') _visRenderPiscinas();
  const card=document.getElementById('vis-equip-card');
  if(card) card.style.display=(visEquipSelecionados.length||(_visEquipsCustom||[]).length)?'':'none';
  // Retoma o cronômetro do ponto certo — zerar o tempo no local seria pior
  // que não ter cronômetro nenhum (o relatório mostra duração da visita).
  if(visCheckinTime && !visCheckoutTime){
    const bar=document.getElementById('vis-checkin-bar');
    const form=document.getElementById('vis-checkin-form');
    const info=document.getElementById('vis-checkin-info');
    if(bar) bar.style.display='flex';
    if(form) form.style.display='none';
    if(info) info.textContent='📍 Check-in: '+visCheckinTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const timerEl=document.getElementById('vis-checkin-timer');
    if(visCheckinInterval) clearInterval(visCheckinInterval);
    visCheckinInterval=setInterval(()=>{
      const diff=Math.floor((Date.now()-visCheckinTime)/1000);
      const h=Math.floor(diff/3600), m=Math.floor((diff%3600)/60), s=diff%60;
      if(timerEl) timerEl.textContent=(h?h+':':'')+(m<10&&h?'0':'')+m+':'+(s<10?'0':'')+s;
    },1000);
  }
  visTab('nova');
  toast('🔄 Vistoria em andamento restaurada — pode continuar de onde parou');
  return true;
}
// A tela apagando / app indo pra segundo plano é EXATAMENTE o momento de
// salvar: é quando o navegador do celular descarta a página.
document.addEventListener('visibilitychange',()=>{ if(document.hidden){ _salvarRascunhoVis(); _syncRascunhoNuvem(); } });
window.addEventListener('pagehide',()=>{ _salvarRascunhoVis(); _syncRascunhoNuvem(); });

// Faz upload de uma foto (base64) para o Supabase Storage e retorna a URL pública.
// Retorna null se falhar (a foto base64 original fica preservada localmente).
async function _uploadFotoStorage(base64, path, bucket){
  bucket = bucket || 'vistorias-fotos';
  if(!base64 || base64.startsWith('http')) return base64; // já é URL ou vazio
  if(!db || !EMPRESA_ID) return null; // precisa da sessão autenticada + empresa
  try{
    const [meta, data] = base64.split(',');
    const mime = (meta.match(/:(.*?);/)||[])[1]||'image/jpeg';
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
    const blob = new Blob([arr], {type:mime});
    // v2: upload autenticado (SDK) na PASTA DA EMPRESA — a política exige a pasta.
    const fullPath = `${EMPRESA_ID}/${path}`;
    const { error } = await db.storage.from(bucket).upload(fullPath, blob, { contentType:mime, upsert:true });
    if(error){ console.warn('[uploadFoto]', error.message); return null; }
    const { data:pub } = db.storage.from(bucket).getPublicUrl(fullPath);
    return pub?.publicUrl || null;
  }catch(e){ console.warn('[uploadFoto]', e?.message||e); return null; }
}
// Sobe as fotos de um orçamento/OS (array em JSON, foto_base64/fotos) pro Storage
// antes de mandar pro banco — troca base64 por URL pública (linha fica leve).
// Fotos que falharem no upload são OMITIDAS do resultado (não manda base64 gigante
// pro banco); o app local continua com o base64 original até o próximo envio
// bem-sucedido — a foto não se perde, só não fica sincronizada por enquanto.
async function _fotosParaStorage(fotosOrigem, recId, bucket){
  if(!fotosOrigem) return null;
  let arr;
  if(Array.isArray(fotosOrigem)) arr = fotosOrigem;
  else { try{ arr = fotosOrigem.startsWith('[') ? JSON.parse(fotosOrigem) : [fotosOrigem]; }catch(e){ return null; } }
  const urls=[];
  for(let i=0;i<arr.length;i++){
    const foto=arr[i];
    if(!foto) continue;
    const url = foto.startsWith('http') ? foto : await _uploadFotoStorage(foto, recId+'/'+i+'.jpg', bucket);
    if(url) urls.push(url);
  }
  return urls;
}

// Sobe os dois lados da OS preservando a forma {antes,depois} — caminhos
// separados no bucket pra uma foto de "antes" nunca sobrescrever a de mesmo
// índice do "depois".
async function _osFotosParaStorage(fotosObj, recId){
  const {antes,depois}=_osFotosNormalizar(fotosObj);
  return {
    antes: (await _fotosParaStorage(antes, recId+'/antes', 'os-fotos'))||[],
    depois:(await _fotosParaStorage(depois, recId+'/depois','os-fotos'))||[]
  };
}

// Faz upload de todas as fotos base64 de uma vistoria para o Storage.
// Retorna novo objeto rec com URLs no lugar de base64.
// Fotos que falhar no upload ficam como base64 (sem perder a foto).
async function _uploadFotosVistoria(rec){
  const equipamentos = (rec.equipamentos||[]).map(eq=>({...eq, fotos:[...(eq.fotos||[])]}));
  for(const eq of equipamentos){
    for(let i=0;i<(eq.fotos||[]).length;i++){
      const foto = eq.fotos[i];
      if(!foto || foto.startsWith('http')) continue; // null ou já é URL
      const path = `${rec.id}/${eq.id}/${i}.jpg`;
      const url = await _uploadFotoStorage(foto, path);
      if(url) eq.fotos[i] = url; // substitui base64 por URL
      // se falhar, mantém base64 para não perder a foto
    }
  }
  return {...rec, equipamentos};
}

// ── Check-in / Check-out ──
function autoCheckoutSeNecessario(){
  if(visCheckoutTime) return; // já foi feito manualmente
  visCheckoutTime = new Date();
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval=null; }
  const bar  = document.getElementById('vis-checkin-bar');
  const info = document.getElementById('vis-checkin-info');
  if(bar) bar.style.display='none';
  if(info && visCheckinTime){
    const entradaTxt = visCheckinTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const saidaTxt   = visCheckoutTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const diff = Math.floor((visCheckoutTime-visCheckinTime)/60000);
    info.textContent = `✅ Check-in: ${entradaTxt}  ·  Check-out: ${saidaTxt}${diff>0?' · '+diff+' min':''}`;
  }
}

function visCheckin(){
  visCheckinTime = new Date();
  const info = document.getElementById('vis-checkin-info');
  const bar  = document.getElementById('vis-checkin-bar');
  const form = document.getElementById('vis-checkin-form');
  if(bar)  bar.style.display='flex';
  if(form) form.style.display='none';
  if(info) info.textContent = '📍 Check-in: '+visCheckinTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  // Auto-preenche hora no campo
  const hEl = document.getElementById('vis-hora');
  if(hEl) hEl.value = visCheckinTime.toTimeString().slice(0,5);
  // Timer
  const timerEl = document.getElementById('vis-checkin-timer');
  visCheckinInterval = setInterval(()=>{
    const diff = Math.floor((Date.now()-visCheckinTime)/1000);
    const h=Math.floor(diff/3600), m=Math.floor((diff%3600)/60), s=diff%60;
    if(timerEl) timerEl.textContent=(h?h+':':'')+(m<10&&h?'0':'')+m+':'+(s<10?'0':'')+s;
  },1000);
}
function visCheckout(){
  if(visCheckoutTime) return; // já registrado
  visCheckoutTime = new Date();
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval=null; }
  const bar  = document.getElementById('vis-checkin-bar');
  const info = document.getElementById('vis-checkin-info');
  if(bar)  bar.style.display='none';
  const entradaTxt = visCheckinTime?visCheckinTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';
  const saidaTxt   = visCheckoutTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const diff = visCheckinTime ? Math.floor((visCheckoutTime-visCheckinTime)/60000) : null;
  if(info) info.textContent = `✅ Check-in: ${entradaTxt}  ·  Check-out: ${saidaTxt}${diff!==null?' · '+diff+' min':''}`;
  toast('✅ Check-out registrado');
}

// ── Piscina em Vistoria (17/08, portado do fluxa-app v1) — só SELECIONA
// uma piscina já cadastrada (cadastro fica em Equipamentos); filtra pelo
// plano/local quando a vistoria veio de um local cadastrado (window.
// _visLocalId), senão cai pro cliente — mesma prioridade de local_id do v1.
let _visPiscinaSelecionadaId = null;
function _visRenderPiscinas(){
  const sel=document.getElementById('vis-piscina'); if(!sel) return;
  const cliId=document.getElementById('vis-cli-id')?.value||'';
  const localId=window._visLocalId||'';
  const porLocal=localId ? (todasPiscinas||[]).filter(p=>p.local_id===localId && p.ativo!==false) : [];
  const lista = porLocal.length ? porLocal : (cliId?(todasPiscinas||[]).filter(p=>p.cliente_id===cliId && p.ativo!==false):[]);
  if(!cliId && !localId){
    sel.innerHTML='<option value="">Selecione o cliente primeiro</option>';
    sel.disabled=true;
    return;
  }
  sel.disabled=false;
  if(!lista.length){
    sel.innerHTML='<option value="">Nenhuma piscina cadastrada pra este cliente</option>';
    _visPiscinaSelecionadaId=null;
    return;
  }
  sel.innerHTML='<option value="">Não informado</option>'
    + lista.map(p=>`<option value="${esc(p.id)}"${p.id===_visPiscinaSelecionadaId?' selected':''}>${esc(p.nome||'Piscina')}${p.volume_m3?' — '+p.volume_m3+'m³':''}</option>`).join('');
  if(_visPiscinaSelecionadaId && !lista.some(p=>p.id===_visPiscinaSelecionadaId)) _visPiscinaSelecionadaId=null;
  sel.value=_visPiscinaSelecionadaId||'';
}
function _visPiscinaSelect(val){ _visPiscinaSelecionadaId=val||null; }

// ── Autocomplete cliente no campo vis-cli ──
function mostrarSugestoesCliVis(val){
  const sug = document.getElementById('vis-cli-suggestions'); if(!sug) return;
  // O rascunho só era gravado ao mexer em equipamento. Quem digitava o cliente
  // e o app ia pra segundo plano perdia até esse nome.
  _salvarRascunhoVisDeb();
  setV('vis-cli-id',''); // digitou de novo → invalida vínculo de uma sugestão anterior
  _visPiscinaSelecionadaId=null; _visRenderPiscinas();
  if(!val||val.length<2){ sug.style.display='none'; return; }
  const clientes = JSON.parse(ls('fluxa_clientes_full')||'[]');
  const hits = clientes.filter(c=>(c.nome||'').toLowerCase().includes(val.toLowerCase())).slice(0,5);
  if(!hits.length){ sug.style.display='none'; return; }
  sug.innerHTML = hits.map(c=>`<div class="cli-suggestion-item" onmousedown="selecionarCliVis('${esc(c.id||'')}','${esc(c.nome||'')}','${esc(c.local||c.endereco||'')}')"><div class="cli-sug-name">${esc(c.nome)}</div><div class="cli-sug-tel">${esc(c.local||c.endereco||c.tel||'')}</div></div>`).join('');
  sug.style.display='block';
}
function hideSugCliVis(){ const el=document.getElementById('vis-cli-suggestions'); if(el) el.style.display='none'; }
function selecionarCliVis(id, nome, local){
  const inp=document.getElementById('vis-cli'); if(inp) inp.value=nome;
  setV('vis-cli-id', id||'');
  _visPiscinaSelecionadaId=null; _visRenderPiscinas();
  const loc=document.getElementById('vis-loc'); if(loc&&local&&!loc.value) loc.value=local;
  // Auto-fill email from client record
  const clientes=JSON.parse(ls('fluxa_clientes_full')||'[]');
  const cli=clientes.find(c=>(c.nome||'')=== nome);
  if(cli?.email_responsavel){
    const emailInp=document.getElementById('vis-email-resp');
    if(emailInp&&!emailInp.value) emailInp.value=cli.email_responsavel;
    const st=document.getElementById('vis-email-status');
    if(st) st.textContent=`📧 ${cli.email_responsavel} (do cadastro)`;
  }
  hideSugCliVis();
  // ── Pré-carga: checar se há vistoria anterior para este cliente ──
  if(!visEditId && !window._visLocalId){ // não mostrar se veio de um plano
    const todasVis = lsVisLer().filter(v=>(v.cliente||'').toLowerCase()===nome.toLowerCase() && v.equipamentos);
    if(todasVis.length){
      todasVis.sort((a,b)=>(b.data||'').localeCompare(a.data||''));
      const ultima = todasVis[0];
      window._visPreCargaRec = ultima;
      const dataFmt = ultima.data ? new Date(ultima.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) : '';
      const equips=(typeof ultima.equipamentos==='string'?JSON.parse(ultima.equipamentos||'[]'):ultima.equipamentos)||[];
      const txtEl=document.getElementById('vis-precarga-txt');
      const subEl=document.getElementById('vis-precarga-sub');
      if(txtEl) txtEl.textContent=`Vistoria de ${dataFmt} encontrada (${equips.length} equipamentos)`;
      if(subEl) subEl.textContent='Carregar lista de equipamentos desta visita?';
      const banner=document.getElementById('vis-precarga-banner');
      if(banner) banner.style.display='flex';
    } else {
      dispensarPreCarga();
    }
  }
}

function confirmarPreCarga(){
  const vis = window._visPreCargaRec;
  if(!vis){ dispensarPreCarga(); return; }
  const equips=(typeof vis.equipamentos==='string'?JSON.parse(vis.equipamentos||'[]'):vis.equipamentos)||[];
  // Separa custom (não está no VIS_EQUIPAMENTOS_DEFAULT) de padrão
  const stdDefs = VIS_EQUIPAMENTOS_DEFAULT.map(x=>x.id);
  const stdEquips = equips.filter(e=>stdDefs.includes(e.id));
  const customEquips = equips.filter(e=>!stdDefs.includes(e.id));
  // Reset estado
  visEquipSelecionados = stdEquips.map(e=>e.id);
  _visEquipsCustom = customEquips.map(e=>({id:e.id, nome:e.nome, emoji:e.emoji||'⚙️', modelo:e.modelo||'', potencia:e.potencia||'', origem:_visOrigemEquip(e)}));
  // Status todos reset para 'na' — técnico preenche de novo
  visEquipDados = {};
  equips.forEach(e=>{ visEquipDados[e.id]={status:'na',obs:'',fotos:[]}; });
  renderVisChips();
  renderVisEquipGrid();
  const card=document.getElementById('vis-equip-card');
  if(card) card.style.display=(visEquipSelecionados.length||_visEquipsCustom.length)?'':'none';
  dispensarPreCarga();
  toast('✅ Equipamentos carregados da última vistoria');
}

function dispensarPreCarga(){
  const banner=document.getElementById('vis-precarga-banner');
  if(banner) banner.style.display='none';
  window._visPreCargaRec = null;
}

// Monta a lista de equipamentos do form (planos custom + chips padrão)
function _montarEquipamentosVistoria(){
  const customIds=(_visEquipsCustom||[]).map(e=>e.id);
  return [
    ...(_visEquipsCustom||[]).map(ceq=>{
      const d=visEquipDados[ceq.id]||{status:'na',obs:'',fotos:[]};
      return {id:ceq.id,nome:ceq.nome,emoji:ceq.emoji||'⚙️',modelo:ceq.modelo||'',potencia:ceq.potencia||'',origem:ceq.origem||'plano',status:d.status,obs:d.obs||'',fotos:(d.fotos||[]).filter(Boolean)};
    }),
    ...visEquipSelecionados.filter(id=>!customIds.includes(id)).map(id=>{
      const def=VIS_EQUIPAMENTOS_DEFAULT.find(x=>x.id===id)||{id,nome:id,emoji:''};
      const d=visEquipDados[id]||{status:'na',obs:'',fotos:[]};
      return {id,nome:def.nome,emoji:def.emoji,modelo:'',potencia:'',status:d.status,obs:d.obs||'',fotos:(d.fotos||[]).filter(Boolean)};
    })
  ];
}
// Monta o registro da vistoria a partir do formulário. Reusa o mesmo id durante
// toda a edição (visEditId ou _visDraftId) — Salvar e Gerar PDF gravam o MESMO
// registro, sem criar duplicata.
// Idempotência: acha vistoria já existente do mesmo local no mesmo mês, para
// reaproveitar o id em vez de criar duplicata. Usado pelos 3 fluxos de vistoria.
function _vistoriaExistente(localId, mesRef){
  if(!localId||!mesRef) return null;
  return lsVisLer().find(v=> v.local_id===localId && ((v.mes_ref||'')===mesRef || (v.data||'').startsWith(mesRef))) || null;
}
// Empresa de uma vistoria/local: herda do LOCAL/plano; fallback à sessão/loja ativa.
function _lojaDaVistoria(loc){
  const s=getSessao();
  if(loc && loc.loja_id && loc.loja_id!=='default') return loc.loja_id;
  return s?.loja_id||lojaAtiva||LOJA_PADRAO_ID;
}
async function _montarRecVistoria(){
  const s=getSessao();
  const _nw=new Date(); const _nm=`${_nw.getFullYear()}-${String(_nw.getMonth()+1).padStart(2,'0')}`;
  const mesRef=document.getElementById('vis-mes-ref')?.value||_nm;
  // Reusa o MESMO registro durante a edição; e, vindo de um plano, reusa a
  // vistoria já existente do local naquele mês (não duplica).
  let id=visEditId||_visDraftId;
  if(!id){
    const exist=window._visLocalId ? _vistoriaExistente(window._visLocalId, mesRef) : null;
    id=exist?exist.id:('vis_'+Date.now());
  }
  const hora=document.getElementById('vis-hora')?.value||'';
  // A vistoria herda a empresa do LOCAL/plano — não da sessão do técnico.
  // Ao EDITAR uma vistoria existente, preserva a empresa original (não recalcula).
  const _loc=window._visLocalId ? (locaisVistoria||[]).find(x=>x.id===window._visLocalId) : null;
  const _editExist=visEditId ? lsVisLer().find(v=>v.id===visEditId) : null;
  const _lojaRec=(_editExist&&_editExist.loja_id&&_editExist.loja_id!=='default') ? _editExist.loja_id : _lojaDaVistoria(_loc);
  const _clienteVis=(document.getElementById('vis-cli')?.value||'').trim();
  const _localVis=(document.getElementById('vis-loc')?.value||'').trim();
  return {
    id,
    loja_id: _lojaRec,
    local_id: window._visLocalId||'',
    cliente:_clienteVis,
    cliente_id:(document.getElementById('vis-cli-id')?.value||null)||await _autoSalvarCliente(_clienteVis,null,_localVis,null,_lojaRec)||null,
    piscina_id: _visPiscinaSelecionadaId||null,
    local:_localVis,
    data: document.getElementById('vis-data')?.value||_hojeLocal(),
    hora,
    tecnico: (document.getElementById('vis-tec')?.value||'')||(s?.nome||''),
    mes_ref: mesRef,
    hora_checkin: visCheckinTime?visCheckinTime.toTimeString().slice(0,5):hora,
    hora_checkout: visCheckoutTime?visCheckoutTime.toTimeString().slice(0,5):null,
    obs_geral: document.getElementById('vis-obs')?.value||'',
    recomendacoes: (document.getElementById('vis-recom')?.value||'').trim()||null,
    assinatura_tecnico_base64: _visAssinaturaTecnico?.base64||null,
    assinatura_tecnico_data: _visAssinaturaTecnico?.data||null,
    assinatura_tecnico_meta: _visAssinaturaTecnico?.meta||null,
    email_responsavel: (document.getElementById('vis-email-resp')?.value||'').trim()||null,
    equipamentos: _montarEquipamentosVistoria(),
    created_at: new Date().toISOString()
  };
}
// Salva a vistoria: LOCAL na hora (rápido), nuvem em BACKGROUND com timeout.
// A UI nunca trava esperando rede. Usado por Salvar e por Gerar PDF.
function _persistVistoria(rec){
  const lista=lsVisLer();
  const idx=lista.findIndex(x=>x.id===rec.id);
  rec._pendingSync = true; // marcada para reenvio; limpa após sync com sucesso
  if(idx>=0){ rec.created_at = lista[idx].created_at || rec.created_at; lista[idx]=rec; }
  else lista.unshift(rec);
  lsVisSalvar(lista);
  _visDraftId = rec.id; // marca: este form já tem registro → próximas gravações atualizam o mesmo
  if(dbOk&&db){
    (async()=>{
      try{
        // Faz upload das fotos base64 para o Storage e substitui por URLs públicas.
        // Fotos com upload bem-sucedido ficam acessíveis de qualquer dispositivo.
        // Fotos que falharem ficam como base64 localmente (sem perder a foto);
        // o campo no Supabase fica vazio para esse slot (null).
        const recComUrls = await _uploadFotosVistoria(rec);
        // Atualiza localStorage com as URLs (substitui base64 pelas URLs que subiram)
        const listaAtual = lsVisLer();
        const idxAtual = listaAtual.findIndex(x=>x.id===rec.id);
        if(idxAtual>=0) listaAtual[idxAtual]=recComUrls;
        else listaAtual.unshift(recComUrls);
        lsVisSalvar(listaAtual);
        // Envia ao Supabase com as fotos como URLs (ou null onde falhou)
        const recParaSupabase = {
          ...recComUrls,
          equipamentos: (recComUrls.equipamentos||[]).map(eq=>({
            ...eq,
            fotos: (eq.fotos||[]).map(f=>f&&f.startsWith('http')?f:null)
          }))
        };
        const r=await _comTimeout(dbUpsert('vistorias', recParaSupabase), 20000, 'sync vistoria');
        if(r&&r.error){ console.warn('Visita Supabase err:', r.error.message); toast('⚠️ Vistoria salva localmente mas não sincronizou: '+r.error.message); }
        else{
          // Sync bem-sucedido — remove flag _pendingSync do localStorage
          const _ls=lsVisLer(); const _i=_ls.findIndex(x=>x.id===rec.id);
          if(_i>=0){ delete _ls[_i]._pendingSync; lsVisSalvar(_ls); }
        }
      }catch(e){ console.warn('Visita Supabase sync (bg):', e?.message||e); toast('⚠️ Vistoria salva localmente mas não sincronizou com a nuvem. Será reenviada na próxima conexão.'); }
    })();
  }
}

// ── Salvar vistoria (não-bloqueante: local imediato, rede em background) ──
// Retorna true se salvou com sucesso (para finalizarVistoria poder navegar).
async function salvarVistoria(){
  autoCheckoutSeNecessario();
  const cli  = (document.getElementById('vis-cli')?.value||'').trim();
  const emailResp = (document.getElementById('vis-email-resp')?.value||'').trim();
  if(!cli){ toast('⚠️ Informe o cliente'); return false; }
  if(emailResp && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailResp)){ toast('⚠️ E-mail inválido — corrija ou deixe em branco'); return false; }
  const _btnVis=document.querySelector('button[onclick="finalizarVistoria()"]');
  if(_btnVis){ _btnVis.disabled=true; _btnVis.textContent='Salvando…'; }

  try{
    const veioDoPlano = !!(window._visLocalId); // lido ANTES de zerar
    const rec = await _montarRecVistoria();
    _persistVistoria(rec);          // local imediato + nuvem em background
    window._visLocalId = null;

    // Feedback IMEDIATO — não espera a rede.
    toast('✅ Vistoria salva!');
    visEditId = null;
    renderVisHistorico();
    const planoBanner = document.getElementById('vis-plano-banner');
    if(planoBanner) planoBanner.style.display='none';
    if(veioDoPlano){ setTimeout(()=>visTab('locais'), 600); }

    // ── Auto-envio de e-mail em BACKGROUND ──
    const stEl = document.getElementById('vis-email-status');
    if(emailResp && emailJSConfigurado()){
      if(stEl) stEl.textContent = '📨 Enviando e-mail…';
      (async()=>{
        try{
          const ok = await _comTimeout(enviarEmailVistoria(rec), 60000, 'email vistoria');
          if(stEl) stEl.textContent = ok ? `✅ E-mail enviado para ${emailResp}` : '❌ Falha no envio do e-mail (ver console)';
          toast(ok ? `📧 Relatório enviado para ${emailResp}` : '⚠️ E-mail não enviado (confira Empresa → E-mail)');
        }catch(e){
          console.warn('[email vistoria]', e?.message||e);
          if(stEl) stEl.textContent = '❌ E-mail demorou demais ou falhou';
          toast('⚠️ E-mail não enviado — verifique a conexão');
        }
      })();
    } else if(emailResp && !emailJSConfigurado()){
      if(stEl) stEl.textContent = '⚠️ Configure o EmailJS em Empresa → E-mail Automático para enviar';
      toast('⚠️ EmailJS não configurado — e-mail não enviado');
    }
    return true;
  }catch(e){
    console.error('[salvarVistoria]', e);
    toast('❌ Erro: '+(e?.message||String(e)));
    return false;
  }finally{
    if(_btnVis){ _btnVis.disabled=false; _btnVis.textContent='✅ Finalizar Vistoria'; }
  }
}

// ── Limpa o estado e os campos do formulário de vistoria (sem mudar de aba) ──
// Restaura a seção de check-in ao estado inicial (botão visível, barra oculta).
// Sem isto, depois de um check-out a próxima vistoria ficava sem o botão de
// check-in (form e barra ambos ocultos) até recarregar a página.
function _resetCheckinVis(){
  const form=document.getElementById('vis-checkin-form');
  const bar =document.getElementById('vis-checkin-bar');
  const info=document.getElementById('vis-checkin-info');
  const timer=document.getElementById('vis-checkin-timer');
  if(form) form.style.display='flex';
  if(bar)  bar.style.display='none';
  if(info) info.textContent='';
  if(timer) timer.textContent='00:00';
}
function _limparFormVistoria(){
  visEquipDados = {};
  _visEquipsCustom = [];
  visCheckinTime = null;
  visCheckoutTime = null;
  visEditId = null;
  _visDraftId = null;
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval = null; }
  _resetCheckinVis();
  window._visLocalId = null;
  _visAssinaturaTecnico = null;
  renderVisAssinaturaStatus();
  _limparRascunhoVis(); // vistoria finalizada/descartada não é mais "em andamento"
  // Limpa campos do form
  ['vis-cli','vis-loc','vis-hora','vis-obs','vis-recom','vis-email-resp'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const hoje = new Date();
  const _ld=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  const dd = document.getElementById('vis-data'); if(dd) dd.value = _ld;
  const mm = document.getElementById('vis-mes-ref'); if(mm) mm.value = _ld.slice(0,7);
  const st = document.getElementById('vis-email-status'); if(st) st.textContent='';
  // Os chips ficavam marcados depois de limpar o form. Como cliente e local
  // são zerados aqui, a vistoria seguinte começava com os equipamentos do
  // local ANTERIOR já selecionados — pronta pra registrar equipamento que não
  // existe no lugar onde o técnico está.
  visEquipSelecionados = [];
  renderVisChips();
  renderVisEquipGrid();
  _visAtualizarBtnDescartar();
}

// ── Descartar vistoria em andamento ──
// Só aparece quando há algo pra descartar: o link permanente convidaria a
// apagar uma tela que já está vazia.
function _visEmAndamento(){
  return !!(
    (document.getElementById('vis-cli')?.value||'').trim() ||
    (document.getElementById('vis-loc')?.value||'').trim() ||
    visEquipSelecionados.length || (_visEquipsCustom||[]).length ||
    visCheckinTime || _visAssinaturaTecnico
  );
}
function _visAtualizarBtnDescartar(){
  const b=document.getElementById('vis-descartar-btn');
  if(b) b.style.display=_visEmAndamento()?'':'none';
}
function descartarVistoria(){
  if(!_visEmAndamento()){ toast('Não há vistoria em andamento'); return; }
  const cli=(document.getElementById('vis-cli')?.value||'').trim();
  const nEq=visEquipSelecionados.length+(_visEquipsCustom||[]).length;
  confirmar({
    titulo:'Descartar vistoria',
    msg:'Tudo que foi preenchido nesta vistoria — status, observações e fotos — será perdido. Isso não afeta vistorias já finalizadas.',
    detalhe:[
      {k:'Cliente', v:cli||'(em branco)'},
      {k:'Equipamentos', v:String(nEq)},
    ],
    destrutivo:true, labelSim:'Descartar', labelNao:'Continuar preenchendo',
    onSim:()=>{ _limparFormVistoria(); toast('Vistoria descartada'); }
  });
}

// Item marcado 🔴 crítico sem nenhuma foto: a foto é a prova visual que
// sustenta o orçamento de conserto depois. Sem ela, quem aprova decide só
// pelo texto do técnico.
function _visCriticosSemFoto(){
  return Object.keys(visEquipDados||{}).filter(id=>{
    const d=visEquipDados[id]||{};
    return d.status==='critico' && !((d.fotos||[]).some(Boolean));
  }).map(id=>_visNomeEquip(id));
}
function _visNomeEquip(id){
  const custom=(_visEquipsCustom||[]).find(e=>e.id===id);
  if(custom) return custom.nome||id;
  const def=(typeof VIS_EQUIPAMENTOS_DEFAULT!=='undefined'?VIS_EQUIPAMENTOS_DEFAULT:[]).find(e=>e.id===id);
  return def?def.nome:id;
}

// ── Finalizar vistoria: salva, limpa o form e navega para o histórico ──
async function finalizarVistoria(){
  // Assinatura é BLOQUEIO: confirma que o técnico esteve no local. Mesma
  // regra da entrega de reparo — não é um "seria bom ter".
  if(!_visAssinaturaTecnico){
    toast('⚠️ Assine antes de finalizar a vistoria');
    const card=document.getElementById('vis-assinatura-status');
    if(card) card.scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }
  // Foto em item crítico é AVISO, nunca bloqueio — quem decide é quem está
  // no local (mesmo princípio do limite de desconto e do item sem estoque).
  const semFoto=_visCriticosSemFoto();
  if(semFoto.length){
    const lista=semFoto.slice(0,4).join(', ')+(semFoto.length>4?` e mais ${semFoto.length-4}`:'');
    confirmar({
      titulo:'Item crítico sem foto',
      msg:`${semFoto.length===1?'Este item foi marcado':'Estes itens foram marcados'} como crítico sem nenhuma foto: ${lista}. A foto é o que sustenta o orçamento de conserto depois.`,
      labelNao:'Voltar e adicionar foto', labelSim:'Finalizar mesmo assim',
      onSim:()=>_finalizarVistoriaProsseguir()
    });
    return;
  }
  _finalizarVistoriaProsseguir();
}
async function _finalizarVistoriaProsseguir(){
  // veioDoPlano é lido ANTES: salvarVistoria() zera window._visLocalId por
  // dentro e já agenda visTab('locais') nesse caso. Agendar 'hist' por cima
  // fazia dois setTimeout de navegação concorrentes — a tela ia pro
  // Histórico e 300ms depois pulava pra Meus Locais, redesenhando duas
  // listas grandes em sequência.
  const veioDoPlano = !!window._visLocalId;
  const ok = await salvarVistoria();
  if(ok){
    _limparFormVistoria(); // previne re-submit acidental ao voltar para "Nova Vistoria"
    if(!veioDoPlano) setTimeout(()=>visTab('hist'), 300);
  }
}

// ── Histórico ──
function renderVisHistorico(){
  const el = document.getElementById('vis-hist-body'); if(!el) return;
  const busca = (document.getElementById('vis-hist-busca')?.value||'').toLowerCase();
  const mes   = document.getElementById('vis-hist-mes')?.value||'';
  const tecFilt = document.getElementById('vis-hist-tec')?.value||'';
  // Escopo de empresa: histórico, stats, ranking e alertas só da empresa em foco
  let listaTotal = lsVisLer().filter(v=>escopoEmpresaMatch(v.loja_id));
  let lista = listaTotal;
  // Filtros textuais + mês + técnico
  if(busca) lista = lista.filter(v=>(v.cliente||'').toLowerCase().includes(busca)||(v.local||'').toLowerCase().includes(busca));
  if(mes)   lista = lista.filter(v=>(v.mes_ref||v.data||'').startsWith(mes));
  if(tecFilt) lista = lista.filter(v=>(v.tecnico||'')=== tecFilt);
  // Filtro por status
  if(visHistStatusFilt){
    lista = lista.filter(v=>{
      const equips=(typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
      return equips.some(e=>e.status===visHistStatusFilt);
    });
  }
  // Sort desc
  lista.sort((a,b)=>(b.data||'').localeCompare(a.data||''));

  // ── Stats cards ──
  const statsEl = document.getElementById('vis-stats-row');
  if(statsEl){
    const scope = mes ? listaTotal.filter(v=>(v.mes_ref||v.data||'').startsWith(mes)) : listaTotal;
    const total = scope.length;
    // Conta críticos e atenções
    let comCritico=0, comAtencao=0;
    scope.forEach(v=>{
      const equips=(typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
      if(equips.some(e=>e.status==='critico')) comCritico++;
      else if(equips.some(e=>e.status==='atencao')) comAtencao++;
    });
    // Cards .rd-* (redesign task #37, 16/08) — mesmo padrão de Despesas/
    // Equipamentos/Clientes/Agenda.
    statsEl.innerHTML=`
      <div class="rd-card rd-card-dense rd-card-dark">
        <div class="rd-kpi-lbl">Vistorias${mes?' no mês':''}</div>
        <div class="rd-kpi-num rd-kpi-num-sm">${total}</div>
        <div class="rd-kpi-apoio">${mes?'no período filtrado':'histórico completo'}</div>
      </div>
      <div class="rd-card rd-card-dense">
        <div class="rd-kpi-lbl"><span class="rd-badge rd-badge-warn">Com atenção</span></div>
        <div class="rd-kpi-num rd-kpi-num-sm" style="color:var(--warn)">${comAtencao}</div>
        <div class="rd-kpi-apoio">equipamento pede olhar</div>
      </div>
      <div class="rd-card rd-card-dense">
        <div class="rd-kpi-lbl"><span class="rd-badge rd-badge-bad">Com crítico</span></div>
        <div class="rd-kpi-num rd-kpi-num-sm" style="color:var(--bad)">${comCritico}</div>
        <div class="rd-kpi-apoio">precisa de ação</div>
      </div>`;
  }

  // ── Painel de alertas críticos (clientes com ≥1 item crítico, mês atual se sem filtro) ──
  const alertPanel = document.getElementById('vis-alerta-criticos-panel');
  if(alertPanel){
    const mesAlerta = mes || _hojeLocal().slice(0,7);
    const scopeAlerta = listaTotal.filter(v=>(v.mes_ref||v.data||'').startsWith(mesAlerta));
    const criticos = scopeAlerta.filter(v=>{
      const equips=(typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
      return equips.some(e=>e.status==='critico');
    });
    if(criticos.length){
      alertPanel.style.display='block';
      const mesNome = new Date(mesAlerta+'-02').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
      alertPanel.innerHTML=`<div class="vis-alerta-criticos"><div class="vis-alerta-hdr">🔴 ${criticos.length} cliente${criticos.length>1?'s':''} com itens críticos em ${mesNome}</div>${criticos.map(v=>{
        const equips=(typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
        const criticoItems=equips.filter(e=>e.status==='critico').map(e=>e.nome||e.id);
        return `<div class="vis-alerta-item" onclick="abrirVisRelatorio('${v.id}')">
          <div><div style="font-weight:700;color:var(--c2);font-size:13px">${esc(v.cliente||'')}</div><div style="font-size:11px;color:var(--red);margin-top:2px">${criticoItems.map(esc).join(', ')}</div></div>
          <div style="font-size:11px;color:var(--gray)">${v.data?new Date(v.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):''} →</div>
        </div>`;
      }).join('')}</div>`;
    } else {
      alertPanel.style.display='none';
    }
  }

  // ── Popula select de técnicos ──
  const tecSel = document.getElementById('vis-hist-tec');
  if(tecSel && tecSel.options.length === 1){
    const tecs=[...new Set(listaTotal.map(v=>v.tecnico).filter(Boolean))].sort();
    tecs.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; tecSel.appendChild(o); });
  }

  // ── Ranking ──
  const rankCard = document.getElementById('vis-ranking-card');
  const rankBody = document.getElementById('vis-ranking-body');
  const rankScope = mes ? listaTotal.filter(v=>(v.mes_ref||v.data||'').startsWith(mes)) : listaTotal;
  if(rankCard && rankBody && rankScope.length){
    const counts={};
    rankScope.forEach(v=>{ if(v.tecnico) counts[v.tecnico]=(counts[v.tecnico]||0)+1; });
    const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const max=sorted[0]?.[1]||1;
    rankCard.style.display='';
    rankBody.innerHTML=sorted.map(([tec,cnt],i)=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i<sorted.length-1?'border-bottom:1px solid var(--gray-light)':''}">
        <div style="font-size:13px;font-weight:700;color:var(--gray);min-width:22px;text-align:center">${i+1}º</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--c2);margin-bottom:4px">${esc(tec)}</div>
          <div style="height:6px;background:var(--gray-light);border-radius:50px;overflow:hidden">
            <div style="height:100%;background:var(--c1);border-radius:50px;width:${Math.round(cnt/max*100)}%"></div>
          </div>
        </div>
        <div style="font-size:18px;font-weight:800;color:var(--c1);min-width:28px;text-align:right">${cnt}</div>
      </div>`).join('');
  } else if(rankCard) rankCard.style.display='none';
  if(!lista.length){
    el.innerHTML='<div style="padding:28px;text-align:center;color:var(--gray);font-size:13px">Nenhuma vistoria encontrada.<br><button class="btn-primary" style="margin-top:12px" onclick="visTab(\'nova\')">＋ Nova Vistoria</button></div>';
    return;
  }
  const statusIcon = { bom:'✅', atencao:'⚠️', critico:'🔴', na:'—' };
  const statusBg   = { bom:'var(--green-bg)', atencao:'var(--yellow-bg)', critico:'var(--red-bg)', na:'var(--gray-light)' };
  const statusClr  = { bom:'var(--green)', atencao:'var(--yellow)', critico:'var(--red)', na:'var(--gray)' };
  el.innerHTML = lista.map(v=>{
    const equips = (typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
    const mRef = v.mes_ref?new Date(+v.mes_ref.split('-')[0],+v.mes_ref.split('-')[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):'';
    // Conta status
    const cnt = { bom:0, atencao:0, critico:0 };
    equips.filter(e=>e.status!=='na').forEach(e=>{ if(cnt[e.status]!==undefined) cnt[e.status]++; });
    const dataFmt = v.data?new Date(v.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}):'';
    return `<div class="vis-history-item" onclick="abrirVisRelatorio('${v.id}')">
      <div style="flex:1;min-width:0">
        <div class="vis-hist-data">${dataFmt}${mRef?' · '+mRef:''}</div>
        <div class="vis-hist-cli">${esc(v.cliente||'')}${v.local?' · '+esc(v.local):''}${(()=>{ if(!lojaAtiva&&v.loja_id&&v.loja_id!=='default'){ const _lv=getLoja(v.loja_id); return _lv?` <span class="loja-badge ${_lv.cor}" style="font-size:9px;vertical-align:middle">${_lv.nome.replace('Fortemp ','')}</span>`:'' } return ''; })()}</div>
        <div class="vis-hist-cli" style="margin-top:2px">👤 ${esc(v.tecnico||'')} · ${equips.length} equip.${v.email_responsavel?' · 📧 '+esc(v.email_responsavel):''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        <div class="vis-hist-badges">
          ${cnt.critico?`<span class="vis-hist-badge" style="background:var(--red-bg);color:var(--red)">🔴 ${cnt.critico}</span>`:''}
          ${cnt.atencao?`<span class="vis-hist-badge" style="background:var(--yellow-bg);color:var(--yellow)">⚠️ ${cnt.atencao}</span>`:''}
          ${cnt.bom?`<span class="vis-hist-badge" style="background:var(--green-bg);color:var(--green)">✅ ${cnt.bom}</span>`:''}
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">
          ${v.email_responsavel?`<button class="tb" title="Reenviar e-mail" onclick="event.stopPropagation();reenviarEmailVistoria('${v.id}')" style="font-size:11px;background:var(--blue-bg);color:var(--blue);border-color:var(--blue-bg)">📧</button>`:''}
          <button class="tb" title="Enviar resumo via WhatsApp" onclick="event.stopPropagation();enviarWAResumoVistoria('${v.id}')" style="font-size:11px;background:var(--wa-light,#dcfce7);color:var(--wa);border-color:var(--wa-light,#dcfce7)">💬</button>
          ${(!eTecnico() && (cnt.critico||cnt.atencao))?`<button class="tb" title="Gerar orçamento com os itens críticos e de atenção desta vistoria" onclick="event.stopPropagation();orcarDaVistoria('${v.id}')" style="font-size:11px;background:var(--c1);color:white;border-color:var(--c1);font-weight:700">💰 Orçar ${cnt.critico+cnt.atencao}</button>`:''}
          ${(!eTecnico() && cnt.critico)?`<button class="tb" title="Laudo para o síndico apresentar na assembleia" onclick="event.stopPropagation();gerarDossieAssembleia('${v.id}')" style="font-size:11px;background:var(--c2);color:white;border-color:var(--c2);font-weight:700">🗳️ Dossiê</button>`:''}
          ${(!eTecnico() && _visEquipParaCadastrar(v).length)?`<button class="tb" title="Cadastrar os equipamentos desta vistoria no patrimônio do cliente" onclick="event.stopPropagation();importarEquipamentosVistoria('${v.id}')" style="font-size:11px;background:var(--green-bg);color:var(--green);border-color:var(--green-bg)">＋🔧 Patrimônio</button>`:''}
          <button class="tb" title="Editar / refazer vistoria" onclick="event.stopPropagation();editarVistoria('${v.id}')" style="font-size:11px;background:var(--blue-bg);color:var(--blue);border-color:var(--blue-bg)">✏️</button>
          <button class="tb" title="Ver relatório" onclick="event.stopPropagation();abrirVisRelatorio('${v.id}')" style="font-size:11px;background:var(--blue-bg);color:var(--blue);border-color:var(--blue-bg)">👁 Ver</button>
          <button class="tb" title="Baixar PDF" onclick="event.stopPropagation();baixarPDFVistoria('${v.id}',this)" style="font-size:11px;background:var(--c1-light);color:var(--c1);border-color:var(--c1-light)">📥 PDF</button>
          <button class="tb" title="Excluir" onclick="event.stopPropagation();excluirVistoria('${v.id}')" style="background:var(--red-bg);color:var(--red);border-color:var(--red-bg);font-size:11px">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Tombstones: ids de vistorias apagadas, para NUNCA ressuscitarem via sync ──
// Antes, o delete no banco era "fire-and-forget": se a rede do celular falhasse,
// o registro sobrevivia no Supabase e voltava na próxima sincronização. Agora,
// o id apagado fica numa lista local que o sync respeita, e o delete no banco é
// tentado de novo até confirmar que sumiu.
function _visTombLer(){ try{ return JSON.parse(ls('fluxa_vis_tombstones')||'[]'); }catch(e){ return []; } }
function _visTombAdd(id){ const t=_visTombLer(); if(!t.includes(id)){ t.push(id); lsSet('fluxa_vis_tombstones', JSON.stringify(t.slice(-500))); } }
async function _excluirVistoriaBanco(id){
  if(!dbOk||!db) return;
  try{
    const r=await _comTimeout(db.from('vistorias').delete().eq('id',id), 15000, 'delete vistoria');
    if(r&&r.error) console.warn('[excluirVistoria banco]', r.error.message);
  }catch(e){ console.warn('[excluirVistoria banco]', e?.message||e); }
}
function excluirVistoria(id){
  confirmar('Excluir esta vistoria?', ()=>{ _visTombAdd(id); lsVisSalvar(lsVisLer().filter(x=>x.id!==id)); _excluirVistoriaBanco(id); renderVisHistorico(); toast('Vistoria excluída'); }, 'Excluir Vistoria');
}

// Desfaz a visita do mês de um plano: apaga a vistoria (aparelho + banco) e o
// card volta a "Pendente". Útil p/ remover relatório de teste sem apagar o plano.
function desfazerVistoriaLocal(vistoriaId){
  confirmar('Desfazer esta visita do mês?\n\nO relatório será apagado e o plano volta a ficar pendente. O cadastro do plano é mantido.', ()=>{
    _visTombAdd(vistoriaId);
    lsVisSalvar(lsVisLer().filter(x=>x.id!==vistoriaId));
    _excluirVistoriaBanco(vistoriaId);
    renderLocaisTab();
    renderVisHistorico();
    toast('🗑️ Visita desfeita — plano voltou a pendente');
  }, 'Desfazer visita', null, 'Cancelar', 'Desfazer');
}

// Núcleo único de geração de PDF de vistoria (download via html2pdf).
// Usado por baixarPDFVistoria (📥), abrirVisRelatorio (📄 / tap na linha) e
// gerarRelatorioVistoria — todos com o MESMO comportamento (sem branco no mobile).
// Abre o relatório de vistoria em nova aba (modo ver) ou imprime (modo pdf).
// html2pdf foi descartado — gerava PDF em branco de forma consistente.
// Mesma abordagem confiável dos orçamentos e OS: window.print().
async function _gerarPDFVistoria(vis, opts={}){
  if(!vis.loja_id || vis.loja_id==='default') vis.loja_id = lojaAtiva || LOJA_PADRAO_ID;
  preencherRelatorioVistoria(vis);

  if(opts.output === 'bloburl'){
    // Abre em nova aba: monta HTML completo com todos os estilos da página e o template preenchido
    const stylesTxt = [...document.querySelectorAll('style')].map(s=>s.innerHTML).join('\n');
    const el = document.getElementById('pdoc-visita');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>${stylesTxt}</style>
      <style>body{margin:0;padding:0;background:white}.pdoc{display:block!important}</style>
      </head><body>${el?el.outerHTML:''}</body></html>`;
    const blob = new Blob([html], {type:'text/html'});
    return URL.createObjectURL(blob);
  }

  // Download: usa window.print() (igual orçamentos/OS) — mobile-safe via imprimirDoc
  imprimirDoc('vis');
}

async function baixarPDFVistoria(id, btn){
  const vis = lsVisLer().find(x=>x.id===id);
  if(!vis){ toast('Vistoria não encontrada'); return; }
  const origTxt = btn ? btn.textContent : '';
  if(btn){ btn.disabled=true; btn.textContent='⏳'; }
  try{
    await _gerarPDFVistoria(vis); // usa window.print()
  }finally{
    if(btn){ btn.disabled=false; btn.textContent=origTxt; }
  }
}

function filtVisStatus(st){
  visHistStatusFilt = st;
  ['todos','critico','atencao'].forEach(s=>{
    const btn=document.getElementById('vis-fst-'+s);
    if(btn) btn.classList.toggle('on', s===(st||'todos'));
  });
  renderVisHistorico();
}

function enviarWAResumoVistoria(id){
  const vis = lsVisLer().find(x=>x.id===id);
  if(!vis){ toast('⚠️ Vistoria não encontrada'); return; }
  const equips=(typeof vis.equipamentos==='string'?JSON.parse(vis.equipamentos||'[]'):vis.equipamentos)||[];
  const dataFmt = vis.data?new Date(vis.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
  const statusTxt={bom:'✅ Bom',atencao:'⚠️ Atenção',critico:'🔴 Crítico'};
  const linhas = equips.filter(e=>e.status&&e.status!=='na').map(e=>`  • ${e.nome}: ${statusTxt[e.status]||e.status}${e.obs?' – '+e.obs:''}`);
  const temCritico = equips.some(e=>e.status==='critico');
  const temAtencao = equips.some(e=>e.status==='atencao');
  const statusGeral = temCritico ? '🔴 Ação necessária' : temAtencao ? '⚠️ Requer atenção' : '✅ Tudo em ordem';
  const LC = getLojaConfig(vis.loja_id||lojaAtiva);
  const msg = `*Relatório de Vistoria – ${LC.nome||''}*\n📅 ${dataFmt}\n👤 Técnico: ${vis.tecnico||''}\n📍 ${vis.cliente||''}${vis.local?' – '+vis.local:''}\n\n*Status geral: ${statusGeral}*\n\n${linhas.join('\n')||'Nenhum equipamento avaliado'}${vis.obs_geral?'\n\n📝 Obs: '+vis.obs_geral:''}\n\n_${LC.nome||''} · ${LC.tel||''}_`;
  // Tenta abrir WhatsApp com telefone do cliente, senão abre sem destino
  const clientes=JSON.parse(ls('fluxa_clientes_full')||'[]');
  const cli=clientes.find(c=>(c.nome||'').toLowerCase()===(vis.cliente||'').toLowerCase());
  const tel=(cli?.tel||'').replace(/\D/g,'');
  const url=`https://wa.me/${tel?'55'+tel:''}?text=${encodeURIComponent(msg)}`;
  window.open(url,'_blank');
}

// ── Ver relatório em nova aba (sem download) ──
function abrirVisRelatorio(id){
  const vis = lsVisLer().find(x=>x.id===id);
  if(!vis){ toast('⚠️ Vistoria não encontrada'); return; }
  if(!vis.loja_id || vis.loja_id==='default') vis.loja_id = lojaAtiva || LOJA_PADRAO_ID;
  preencherRelatorioVistoria(vis);

  const el = document.getElementById('pdoc-visita');
  if(!el){ toast('⚠️ Template não encontrado'); return; }

  // Coleta todos os estilos do documento — inclui as regras .pdoc, .pd-*, etc.
  const stylesTxt = [...document.querySelectorAll('style')].map(s=>s.innerHTML).join('\n');
  const nomeArq = `Vistoria-${(vis.cliente||'relatorio').replace(/\s+/g,'-')}-${vis.data||''}.pdf`;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${nomeArq}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>${stylesTxt}</style>
    <style>
      body{margin:0;padding:80px 24px 24px;background:#f3f4f6}
      .pdoc{display:block!important;max-width:794px;margin:0 auto;
            box-shadow:0 4px 24px rgba(0,0,0,.15);border-radius:8px;overflow:hidden}
      #btn-baixar-pdf{position:fixed;top:16px;left:50%;transform:translateX(-50%);
        background:#F07820;color:#fff;border:none;border-radius:10px;
        padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;
        box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:9999;font-family:Inter,sans-serif;
        display:flex;align-items:center;gap:8px;white-space:nowrap}
      #btn-baixar-pdf:hover{background:#d96010}
      @media print{#btn-baixar-pdf{display:none!important}body{padding:0;background:white}}
    </style>
    </head><body>
    <button id="btn-baixar-pdf" onclick="window.print()">📥 Baixar / Imprimir PDF</button>
    ${el.outerHTML}
    </body></html>`;

  // Usa Blob URL para evitar limites do document.write com HTML grande (base64/imagens)
  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const blobUrl = URL.createObjectURL(blob);
  const newWin = window.open(blobUrl, '_blank');
  if(newWin){
    toast('✅ Relatório aberto em nova aba!');
    // Revoga o blob URL após 60s (tempo suficiente para o browser carregá-lo)
    setTimeout(()=>URL.revokeObjectURL(blobUrl), 60000);
  } else {
    URL.revokeObjectURL(blobUrl);
    toast('⚠️ Pop-up bloqueado — permita pop-ups para este site e tente novamente');
  }
}

async function gerarRelatorioVistoria(){
  autoCheckoutSeNecessario();
  const cli=(document.getElementById('vis-cli')?.value||'').trim();
  if(!cli){ toast('⚠️ Informe o cliente antes de gerar o relatório'); return; }

  const veioDoPlano=!!(window._visLocalId);
  const rec=await _montarRecVistoria();
  _persistVistoria(rec);
  window._visLocalId=null;
  const planoBanner=document.getElementById('vis-plano-banner');
  if(planoBanner) planoBanner.style.display='none';

  // Prefere html2pdf (download direto, sem diálogo de impressão que fica na tela)
  if(typeof html2pdf!=='undefined'){
    toast('⏳ Gerando PDF…');
    try{ await _gerarPDFVistoria(rec); toast('✅ Vistoria salva — PDF baixado!'); }
    catch(e){ console.warn('[gerarRelatorioVistoria]',e?.message||e); toast('⚠️ Falha no PDF — vistoria salva. Tente pelo histórico.'); }
  } else {
    // Fallback: diálogo de impressão do sistema
    preencherRelatorioVistoria(rec);
    imprimirDoc('vis');
    toast('✅ Vistoria salva!');
  }

  renderVisHistorico();
  if(veioDoPlano) setTimeout(()=>visTab('locais'), 900);
}

function calcDuracao(cin, cout){
  if(!cin||!cout) return null;
  const p=t=>{ const [h,m]=(t||'').split(':').map(Number); return isNaN(h)||isNaN(m)?null:h*60+m; };
  const t1=p(cin),t2=p(cout); if(t1===null||t2===null) return null;
  let d=t2-t1; if(d<0) d+=24*60; if(d===0||d>600) return null;
  const h=Math.floor(d/60),m=d%60;
  return h>0?(m>0?`${h}h ${m}min`:`${h}h`):`${m}min`;
}

function preencherRelatorioVistoria(vis){
  document.querySelectorAll('.pdoc').forEach(d=>d.classList.remove('print-active'));
  const pdoc = document.getElementById('pdoc-visita');
  if(!pdoc) return;
  pdoc.classList.add('print-active');

  const LC = getLojaConfig(vis.loja_id);
  const cor  = LC.cor  || getComputedStyle(document.documentElement).getPropertyValue('--c1').trim()||'#C45E0A';
  const cor2 = LC.cor2 || getComputedStyle(document.documentElement).getPropertyValue('--c2').trim()||'#2B3244';

  // Header branding
  const hdr = document.getElementById('pd-header-vis');
  if(hdr) hdr.style.background=`linear-gradient(135deg,${cor2},${cor2}ee)`;
  const footEl = document.getElementById('pd-foot-vis');

  // Logo / initials
  const logoEl = document.getElementById('pd-hdr-logo-vis');
  const initEl = document.getElementById('pd-hdr-init-vis');
  const nomePDF = LC.nome||'Empresa';
  if(logoEl && initEl){
    if(LC.logoB64){
      logoEl.src=LC.logoB64; logoEl.className='pd-hdr-logo-img has-logo';
      initEl.className='pd-hdr-logo-initials';
    } else {
      logoEl.className='pd-hdr-logo-img';
      initEl.textContent=nomePDF.charAt(0).toUpperCase();
      initEl.className='pd-hdr-logo-initials show-init';
    }
  }

  // Nome empresa
  const nm=document.getElementById('pd-nm-vis'); if(nm) nm.textContent=nomePDF;
  const sb=document.getElementById('pd-sb-vis'); if(sb) sb.textContent=LC.sub||'Serviços';
  const tag=document.getElementById('pd-tag-vis'); if(tag){ tag.textContent=LC.tagline||''; tag.style.display=LC.tagline?'block':'none'; }

  // Doc number = data
  const numEl=document.getElementById('pd-num-vis');
  if(numEl){ const d=vis.data?new Date(vis.data+'T12:00:00'):new Date(); numEl.textContent=d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}); }

  // Meta strip
  const cont=document.getElementById('pd-cont-vis');
  if(cont){ const mRef=vis.mes_ref?new Date(+vis.mes_ref.split('-')[0],+vis.mes_ref.split('-')[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):''; cont.textContent=`Referência: ${mRef}`; }
  const meta=document.getElementById('pd-meta-vis');
  if(meta){ const tel=LC.tel||''; meta.innerHTML=`${LC.nome||''}<br>${tel}`; }

  // Client card
  const cliBar=document.getElementById('pd-cli-bar-vis'); if(cliBar) cliBar.style.background=cor;
  const cliNm=document.getElementById('pd-cli-nm-vis'); if(cliNm) cliNm.textContent=vis.cliente||'—';
  const cliLoc=document.getElementById('pd-cli-loc-vis'); if(cliLoc) cliLoc.textContent=vis.local||'';

  // Equipamentos
  const equips = (typeof vis.equipamentos==='string'?JSON.parse(vis.equipamentos||'[]'):vis.equipamentos)||[];
  const statusTxt = { bom:'Bom', atencao:'Atenção', critico:'Crítico', na:'N/A' };
  const statusCls = { bom:'st-bom', atencao:'st-atencao', critico:'st-critico', na:'st-na' };
  const bdCls     = { bom:'bd-bom', atencao:'bd-atencao', critico:'bd-critico', na:'bd-na' };
  const dotCls    = { bom:'bom', atencao:'atencao', critico:'critico', na:'na' };

  // Stats summary row
  const statsRow=document.getElementById('pd-vis-stats-row');
  if(statsRow){
    const nBom    = equips.filter(e=>e.status==='bom').length;
    const nAtencao= equips.filter(e=>e.status==='atencao').length;
    const nCritico= equips.filter(e=>e.status==='critico').length;
    const nTotal  = equips.filter(e=>e.status!=='na').length;
    statsRow.innerHTML=`
      <div class="pd-vis-stat s-total"><div class="pd-vis-stat-n">${nTotal}</div><div class="pd-vis-stat-l">Vistoriados</div></div>
      <div class="pd-vis-stat s-bom"><div class="pd-vis-stat-n">${nBom}</div><div class="pd-vis-stat-l">✅ Bom estado</div></div>
      <div class="pd-vis-stat s-atencao"><div class="pd-vis-stat-n">${nAtencao}</div><div class="pd-vis-stat-l">⚠️ Atenção</div></div>
      <div class="pd-vis-stat s-critico"><div class="pd-vis-stat-n">${nCritico}</div><div class="pd-vis-stat-l">🔴 Crítico</div></div>`;
  }

  // Visit info grid — 4 cells: técnico, data, horário, duração
  const infoGrid=document.getElementById('pd-vis-info-grid');
  if(infoGrid){
    const cin  = vis.hora_checkin||vis.hora||'';
    const cout = vis.hora_checkout||'';
    const dur  = calcDuracao(cin, cout);
    const dataFmt=vis.data?new Date(vis.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}):'—';
    const horaTxt = cin?(cin+(cout?' → '+cout:'')):'—';
    infoGrid.innerHTML=`
      <div class="pd-g2card"><div class="pd-g2lbl">Técnico Responsável</div><div class="pd-g2val">👤 ${esc(vis.tecnico||'—')}</div></div>
      <div class="pd-g2card"><div class="pd-g2lbl">Data da Vistoria</div><div class="pd-g2val">📅 ${dataFmt}</div></div>
      <div class="pd-g2card"><div class="pd-g2lbl">Entrada → Saída</div><div class="pd-g2val">⏰ ${esc(horaTxt)}</div></div>
      <div class="pd-g2card"><div class="pd-g2lbl">Duração da Visita</div><div class="pd-g2val">⏱ ${esc(dur||'—')}</div></div>`;
  }

  // Summary table
  const sumTable=document.getElementById('pd-vis-sumtable');
  if(sumTable){
    const equipsVistoriados = equips.filter(e=>e.status && e.status!=='na');
    sumTable.innerHTML=`<thead><tr><th>Equipamento</th><th>Modelo / Pot.</th><th>Status</th><th>Observação</th></tr></thead>
      <tbody>${equipsVistoriados.map(e=>`<tr>
        <td><strong>${esc(e.nome||e.id)}</strong></td>
        <td style="font-size:11px;color:#6b7280">${[e.modelo,e.potencia].filter(Boolean).map(esc).join(' · ')||'—'}</td>
        <td><span class="st-dot ${dotCls[e.status]||'na'}"></span>${statusTxt[e.status]||'—'}</td>
        <td style="color:#6b7280;font-size:11px">${esc((e.obs||'').slice(0,90))}</td>
      </tr>`).join('')}</tbody>`;
  }

  // Detailed list — equipamentos com status definido OU com fotos
  const detList=document.getElementById('pd-vis-equip-list');
  if(detList){
    detList.innerHTML=equips.filter(e=>e.status!=='na'||(e.fotos||[]).some(Boolean)).map(e=>{
      const fotosArr=(e.fotos||[]).filter(Boolean);
      // Adaptativo (achado do Marcos, 04/09): 1 foto sozinha num grid fixo de
      // 2 colunas/210px ficava pequena, desperdiçando metade do espaço.
      const colsFoto=fotosArr.length===1?1:2;
      const hFoto=fotosArr.length===1?300:210;
      const fotosHtml=fotosArr.length
        ?`<div class="pd-vis-equip-fotos" style="grid-template-columns:repeat(${colsFoto},1fr)">${fotosArr.map((f,i)=>`
            <div class="pd-vis-foto-item">
              <img src="${f}" alt="Foto ${i+1}" style="height:${hFoto}px">
              <div class="pd-vis-foto-lbl">Foto ${i+1}${e.nome?' — '+e.nome:''}</div>
            </div>`).join('')}</div>`
        :'';
      const obsCls=e.status==='critico'?'obs-critico':e.status==='atencao'?'obs-atencao':e.status==='bom'?'obs-bom':'';
      const obsHtml=e.obs?`<div class="pd-vis-equip-obs ${obsCls}">${esc(e.obs)}</div>`:'';
      const subInfo=[e.modelo,e.potencia].filter(Boolean).map(esc).join(' · ');
      return `<div class="pd-vis-equip-item ${statusCls[e.status]||''}">
        <div class="pd-vis-equip-hdr ${statusCls[e.status]||'st-na'}">
          <div style="flex:1;min-width:0">
            <div class="pd-vis-equip-nm">${e.emoji||'⚙️'} ${esc(e.nome||e.id)}</div>
            ${subInfo?`<div class="pd-vis-equip-sub">${subInfo}${fotosArr.length?' · 📷 '+fotosArr.length+' foto'+(fotosArr.length>1?'s':''):''}</div>`
                     :fotosArr.length?`<div class="pd-vis-equip-sub">📷 ${fotosArr.length} foto${fotosArr.length>1?'s':''}</div>`:''}
          </div>
          <div class="pd-vis-equip-bd ${bdCls[e.status]||'bd-na'}">${statusTxt[e.status]||'N/A'}</div>
        </div>
        ${(obsHtml||fotosHtml)?`<div class="pd-vis-equip-body">${obsHtml}${fotosHtml}</div>`:''}
      </div>`;
    }).join('');
  }

  // Recomendações — vem ANTES das observações: é a parte acionável.
  const recWrap=document.getElementById('pd-vis-recom-wrap');
  const recBar=document.getElementById('pd-vis-recom-bar');
  const recTxt=document.getElementById('pd-vis-recom-txt');
  if(recWrap){ recWrap.style.display=vis.recomendacoes?'block':'none'; }
  if(recBar)  recBar.style.background=cor;
  if(recTxt)  recTxt.textContent=vis.recomendacoes||'';

  // General obs
  const obsWrap=document.getElementById('pd-vis-obs-wrap');
  const obsBar=document.getElementById('pd-vis-obs-bar');
  const obsTxt=document.getElementById('pd-vis-obs-txt');
  if(obsWrap){ obsWrap.style.display=vis.obs_geral?'block':'none'; }
  if(obsBar)  obsBar.style.background=cor;
  if(obsTxt)  obsTxt.textContent=vis.obs_geral||'';

  // Technician signature label — nome + empresa
  const signTec=document.getElementById('pd-vis-sign-tec');
  if(signTec){
    const nomeTec = vis.tecnico||'Técnico Responsável';
    const empresaTec = LC.nome||'';
    signTec.innerHTML=`${esc(nomeTec)}<br><span style="font-size:10px;font-weight:400;color:#6b7280">${esc(empresaTec)}</span>`;
  }
  // Assinatura digital, quando existe. Registro antigo (antes da assinatura
  // ser obrigatória) mantém a linha em branco pra assinar no papel — sem
  // regressão pro histórico.
  const sigLine=document.getElementById('pd-vis-sig-tec-line');
  if(sigLine){
    sigLine.innerHTML = vis.assinatura_tecnico_base64
      ? `<img src="${vis.assinatura_tecnico_base64}" alt="Assinatura" style="max-height:46px;max-width:100%;display:block;margin:0 auto 2px">`
      : '';
  }

  // Footer
  const tel=LC.tel||''; const email=LC.email||'';
  if(footEl){ footEl.style.background=cor2; footEl.textContent=`${LC.nome||''}${tel?' · '+tel:''}${email?' · '+email:''}`; }
  const metaEl=document.getElementById('pd-meta-vis');
  if(metaEl) metaEl.innerHTML=`${LC.nome||''}${tel?'<br>'+tel:''}`;
}

// ══════════════════════════════════════════════════════════════════════════
//  Relatório de serviço executado (Tarefa 3i.8, 19/08) — a peça que não
//  existia: gerado da OS preenchida, sem ninguém redigir nada. Mesma
//  família de #pdoc-visita (classes .pd-*), motor de PDF reaproveitado
//  (imprimirDoc/_nomeArquivoImpressao já ganharam o caso 'ros').
// ══════════════════════════════════════════════════════════════════════════
// versao: 'cliente' (padrão) | 'interna' — a interna acrescenta custo,
// valor vendido, não executado e margem, usando a MESMA chave de ocultar
// valores que orçamentos já tem (o.ocultar_valores do orçamento vinculado,
// se houver — não uma chave nova).
function preencherRelatorioOS(os, versao){
  document.querySelectorAll('.pdoc').forEach(d=>d.classList.remove('print-active'));
  const pdoc=document.getElementById('pdoc-relatorio-os');
  if(!pdoc) return;
  pdoc.classList.add('print-active');

  const LC=getLojaConfig(os.loja_id);
  const cor=LC.cor||getComputedStyle(document.documentElement).getPropertyValue('--c1').trim()||'#C45E0A';
  const cor2=LC.cor2||getComputedStyle(document.documentElement).getPropertyValue('--c2').trim()||'#2B3244';

  const hdr=document.getElementById('pd-header-ros');
  if(hdr) hdr.style.background=`linear-gradient(135deg,${cor2},${cor2}ee)`;
  const footEl=document.getElementById('pd-foot-ros');

  const logoEl=document.getElementById('pd-hdr-logo-ros');
  const initEl=document.getElementById('pd-hdr-init-ros');
  const nomePDF=LC.nome||'Empresa';
  if(logoEl && initEl){
    if(LC.logoB64){ logoEl.src=LC.logoB64; logoEl.className='pd-hdr-logo-img has-logo'; initEl.className='pd-hdr-logo-initials'; }
    else{ logoEl.className='pd-hdr-logo-img'; initEl.textContent=nomePDF.charAt(0).toUpperCase(); initEl.className='pd-hdr-logo-initials show-init'; }
  }
  const nm=document.getElementById('pd-nm-ros'); if(nm) nm.textContent=nomePDF;
  const sb=document.getElementById('pd-sb-ros'); if(sb) sb.textContent=LC.sub||'Serviços';
  const tag=document.getElementById('pd-tag-ros'); if(tag){ tag.textContent=LC.tagline||''; tag.style.display=LC.tagline?'block':'none'; }

  const docTypeEl=document.getElementById('pd-doctype-ros');
  if(docTypeEl) docTypeEl.textContent=versao==='interna'?'Relatório de Serviço — Interno':'Relatório de Serviço';
  const numEl=document.getElementById('pd-num-ros');
  const numStr='#'+String(os.numero||'').padStart(3,'0');
  if(numEl) numEl.textContent=numStr;

  const cont=document.getElementById('pd-cont-ros');
  if(cont) cont.textContent=os.data_servico?_dataBR(os.data_servico):'';
  const meta=document.getElementById('pd-meta-ros');
  if(meta) meta.innerHTML=`${LC.nome||''}${LC.tel?'<br>'+LC.tel:''}`;

  const cliBar=document.getElementById('pd-cli-bar-ros'); if(cliBar) cliBar.style.background=cor;
  const cliNm=document.getElementById('pd-cli-nm-ros'); if(cliNm) cliNm.textContent=os.cliente||'—';
  const cliLoc=document.getElementById('pd-cli-loc-ros'); if(cliLoc) cliLoc.textContent=os.local_servico||'';

  // 4 dados de visita: técnico, chegada, saída, permanência
  const infoGrid=document.getElementById('pd-ros-info-grid');
  if(infoGrid){
    const cin=os.checkin_time?new Date(os.checkin_time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';
    const cout=os.checkout_time?new Date(os.checkout_time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';
    const dur=os.duracao_min?os.duracao_min+' min':'—';
    infoGrid.innerHTML=`
      <div class="pd-g2card"><div class="pd-g2lbl">Técnico Responsável</div><div class="pd-g2val">👤 ${esc(os.tecnico||'—')}</div></div>
      <div class="pd-g2card"><div class="pd-g2lbl">Data do Serviço</div><div class="pd-g2val">📅 ${os.data_servico?_dataBR(os.data_servico):'—'}</div></div>
      <div class="pd-g2card"><div class="pd-g2lbl">Chegada → Saída</div><div class="pd-g2val">⏰ ${cin} → ${cout}</div></div>
      <div class="pd-g2card"><div class="pd-g2lbl">Permanência</div><div class="pd-g2val">⏱ ${dur}</div></div>`;
  }

  // O que foi executado — itens de confirmação por serviço (checklist com
  // servico:true, gravados pelo modal Finalizar da 3i.7). Não executado em
  // âmbar, com o motivo — "hoje esse caso simplesmente desaparece" era
  // exatamente o problema que este relatório resolve.
  let chk=os.checklist;
  if(typeof chk==='string'){ try{ chk=JSON.parse(chk||'[]'); }catch(e){ chk=[]; } }
  chk=Array.isArray(chk)?chk:[];
  const itensServico=chk.filter(x=>x.servico);
  const orc=os.orcamento_id?(todosOrc||[]).find(x=>x.id===os.orcamento_id):null;
  const servicosOrc=orc?.servicos||[];
  const servEl=document.getElementById('pd-ros-servicos');
  if(servEl){
    const linhas=(itensServico.length?itensServico:(os.servicos||[]).map(s=>({label:typeof s==='string'?s:s.desc,checked:true,obs:''})));
    servEl.innerHTML=linhas.map(it=>{
      const feito=!!it.checked;
      const svcOrc=servicosOrc.find(s=>(s.desc||s.d)===it.label);
      const valorLinha=(versao==='interna'&&svcOrc)?`<span style="float:right;font-variant-numeric:tabular-nums;color:#6b7280">${brl(parseFloat(svcOrc.precoUnit||svcOrc.preco||0)*(parseInt(svcOrc.qty)||1))}</span>`:'';
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #f1f3f5">
        <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;background:${feito?'#16a34a':'#d97706'}">${feito?'✓':'!'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:#111;font-weight:600">${esc(it.label||'Serviço')}${valorLinha}</div>
          ${!feito?`<div style="font-size:11.5px;color:#b45309;margin-top:2px">${esc(it.obs||'Não executado')}</div>`:''}
        </div>
      </div>`;
    }).join('')||'<div style="font-size:12px;color:#6b7280">Nenhum serviço registrado.</div>';
  }

  // Material aplicado — tabela estruturada (os_materiais) + a nota de texto
  // livre isolada. O texto livre precisa aparecer separado: antes, material
  // digitado só na observação NUNCA saía no PDF, mesmo já salvo no banco.
  const matWrap=document.getElementById('pd-ros-mat-wrap');
  const matEl=document.getElementById('pd-ros-mat');
  const matObsEl=document.getElementById('pd-ros-mat-obs');
  const matsEstrut=os._materiaisRelatorio||[];
  const matObs=_osMatObsLivre(os);
  if(matWrap) matWrap.style.display=(matsEstrut.length||matObs)?'block':'none';
  if(matEl){
    matEl.innerHTML = matsEstrut.length
      ? `<table class="pd-vis-sumtable"><tbody>${matsEstrut.map(m=>`
          <tr><td style="padding:4px 0">${esc(m.nome)}</td>
          <td style="padding:4px 0;text-align:right;white-space:nowrap">${fmtQtd(m.qtd)} ${esc(m.unidade||'un')}</td></tr>`).join('')}</tbody></table>`
      : '';
  }
  if(matObsEl) matObsEl.textContent=matObs||'';

  // Condições encontradas — a observação técnica, texto que o síndico
  // realmente lê (per o diagnóstico)
  const obsWrap=document.getElementById('pd-ros-obs-wrap');
  const obsBar=document.getElementById('pd-ros-obs-bar');
  const obsTxt=document.getElementById('pd-ros-obs-txt');
  if(obsWrap) obsWrap.style.display=os.obs_tecnica?'block':'none';
  if(obsBar) obsBar.style.background=cor;
  if(obsTxt) obsTxt.textContent=os.obs_tecnica||'';

  // Versão interna — custo/valor vendido/não executado/margem
  const internaWrap=document.getElementById('pd-ros-interna-wrap');
  const internaEl=document.getElementById('pd-ros-interna');
  const ocultarValores=!!orc?.ocultar_valores;
  if(internaWrap) internaWrap.style.display=(versao==='interna'&&!ocultarValores)?'block':'none';
  if(internaEl && versao==='interna' && !ocultarValores){
    const naoExecCount=itensServico.filter(x=>!x.checked).length;
    // Rentabilidade (Fases 23-24): receita − material − mão de obra = lucro.
    const rent=_osRentabilidade(os, orc);
    const linha=(lbl,val,cor)=>`<div style="display:flex;justify-content:space-between;padding:2px 0"><span>${lbl}</span><b style="color:${cor||'inherit'};font-variant-numeric:tabular-nums">${val}</b></div>`;
    const moTxt = rent.custoHora>0
      ? `− ${brl(rent.maoObra)} <span style="font-weight:400;color:#6b7280">(${rent.horas.toFixed(1)}h × ${brl(rent.custoHora)})</span>`
      : `<span style="font-weight:400;color:#9ca3af">custo-hora não configurado</span>`;
    const matTxt = rent.materialConhecido ? `− ${brl(rent.material)}` : `<span style="font-weight:400;color:#9ca3af">material sem custo registrado</span>`;
    const parcial = !rent.materialConhecido || rent.custoHora===0;
    internaEl.innerHTML=`
      ${linha('Receita (valor vendido)', brl(rent.receita))}
      ${linha('Material', matTxt)}
      ${linha('Mão de obra', moTxt)}
      <div style="border-top:1px solid #e5e7eb;margin-top:5px;padding-top:5px">
        ${linha('Lucro', brl(rent.lucro), rent.lucro>=0?'#16a34a':'#dc2626')}
        ${linha('Margem', rent.margemPct==null?'—':rent.margemPct.toFixed(0)+'%', rent.lucro>=0?'#16a34a':'#dc2626')}
      </div>
      ${parcial?`<div style="font-size:10.5px;color:#9ca3af;margin-top:4px">${!rent.materialConhecido?'Material não lançado nesta OS. ':''}${rent.custoHora===0?'Configure o custo-hora em Produtividade para incluir a mão de obra.':''}</div>`:''}
      <div style="margin-top:6px;color:#6b7280">Serviços não executados: <b>${naoExecCount}</b></div>`;
  }

  // Registro fotográfico — colunas/altura adaptam à quantidade (achado do
  // Marcos, 04/09): grid fixo de 2 col/210px deixava 1-2 fotos pequenas e
  // 5+ cortando mais do que precisava.
  // Quando os dois lados existem, a comparação lado a lado vira o centro da
  // seção — o resto (sobra de um lado só) cai numa grade simples embaixo.
  const fotosWrap=document.getElementById('pd-ros-fotos-wrap');
  const fotosTitulo=document.getElementById('pd-ros-fotos-titulo');
  const fotosEl=document.getElementById('pd-ros-fotos');
  const {antes:fAntes, depois:fDepois}=_osFotosNormalizar(os.fotos);
  const temAntes=fAntes.length, temDepois=fDepois.length;
  if(fotosWrap) fotosWrap.style.display=(temAntes||temDepois)?'block':'none';
  if(fotosTitulo) fotosTitulo.textContent=(temAntes&&temDepois)?'Antes e Depois':temDepois?'Fotos do Serviço':'Fotos da Chegada';
  if(fotosEl){
    const nPares=Math.min(temAntes,temDepois);
    const pares=[];
    for(let i=0;i<nPares;i++){
      pares.push(`<div class="pd-osr-ad-pair">
        <div class="pd-osr-ad-col"><img src="${fAntes[i]}" alt="Antes ${i+1}" loading="lazy" decoding="async"><div class="pd-osr-ad-lbl antes">Antes</div></div>
        <div class="pd-osr-ad-col"><img src="${fDepois[i]}" alt="Depois ${i+1}" loading="lazy" decoding="async"><div class="pd-osr-ad-lbl depois">Depois</div></div>
      </div>`);
    }
    // "Sobra" cobre tanto o resto de quem tem mais fotos que o outro lado
    // quanto o caso comum de só um lado ter fotos (nPares fica 0, a sobra é
    // o array inteiro) — não precisa de um 3º caminho pra isso.
    const sobraAntes=fAntes.slice(nPares), sobraDepois=fDepois.slice(nPares);
    const nSobra=sobraAntes.length+sobraDepois.length;
    const colsSobra=nSobra===1?1:nSobra<=4?2:3;
    const hSobra=nSobra===1?320:nSobra<=2?260:190;
    const grade=(arr,lbl,classe)=>arr.map((f,i)=>`
      <div class="pd-vis-foto-item"><img src="${f}" alt="${lbl} ${i+1}" loading="lazy" decoding="async" style="height:${hSobra}px">
      <div class="pd-vis-foto-lbl ${classe}">${lbl}</div></div>`).join('');
    const sobraHtml = nSobra
      ? `<div class="pd-vis-equip-fotos" style="margin-top:${nPares?'14px':'0'};grid-template-columns:repeat(${colsSobra},1fr)">${grade(sobraAntes,'Antes','antes')}${grade(sobraDepois,'Depois','depois')}</div>`
      : '';
    fotosEl.innerHTML=(pares.length?`<div class="pd-osr-ad-grid">${pares.join('')}</div>`:'')+sobraHtml;
  }

  const signTec=document.getElementById('pd-ros-sign-tec');
  if(signTec) signTec.innerHTML=`${esc(os.tecnico||'Técnico Responsável')}<br><span style="font-size:10px;font-weight:400;color:#6b7280">${esc(LC.nome||'')}</span>`;

  const tel=LC.tel||''; const email=LC.email||'';
  if(footEl){ footEl.style.background=cor2; footEl.textContent=`${LC.nome||''}${tel?' · '+tel:''}${email?' · '+email:''}`; }
}

// Gera o relatório (window.print(), mesmo padrão de vistoria/orçamento/OS)
async function gerarRelatorioOS(osId, versao){
  const os=(todosOS||[]).find(x=>x.id===osId); if(!os){ toast('OS não encontrada'); return; }
  os._materiaisRelatorio = await _osMateriaisParaRelatorio(osId);
  preencherRelatorioOS(os, versao||'cliente');
  imprimirDoc('ros');
}

// ── Abrir a aba de visitas já preenchida com agendamento ──
function novaVistoria(cliNome, cliLocal, tecNome){
  visEquipSelecionados=[];
  visEquipDados={};
  _visEquipsCustom=[];
  visCheckinTime=null;
  visCheckoutTime=null;
  visEditId=null;
  _visDraftId=null;
  setV('vis-cli-id','');
  _visAssinaturaTecnico=null; renderVisAssinaturaStatus();
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval=null; }
  go('visitas');
  visTab('nova');
  const hoje=new Date();
  const _hd=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  const dd=document.getElementById('vis-data'); if(dd) dd.value=_hd;
  const mm=document.getElementById('vis-mes-ref'); if(mm) mm.value=_hd.slice(0,7);
  if(cliNome){ const inp=document.getElementById('vis-cli'); if(inp) inp.value=cliNome; }
  if(cliLocal){ const inp=document.getElementById('vis-loc'); if(inp) inp.value=cliLocal; }
  // Auto-seleciona o técnico: prioridade → tecNome passado → nome do usuário logado
  // Se o nome não está na lista (ex: master), adiciona como opção e seleciona
  const _nomeTec = tecNome || getSessao()?.nome || '';
  if(_nomeTec){
    const sel=document.getElementById('vis-tec');
    if(sel){
      let found=false;
      for(let o of sel.options){ if(o.text===_nomeTec||o.value===_nomeTec){ o.selected=true; found=true; break; } }
      if(!found){ const op=new Option(_nomeTec,_nomeTec,true,true); sel.appendChild(op); }
    }
  }
  // Oculta "Dados da Visita" quando vem de um plano (campos já preenchidos)
  // O técnico pode expandir clicando no título se precisar corrigir algo
  const _vdb = document.getElementById('vis-dados-body');
  const _vdt = document.getElementById('vis-dados-toggle');
  if(window._visLocalId && _vdb){ _vdb.style.display='none'; if(_vdt) _vdt.textContent='▼ expandir'; }
  else if(_vdb){ _vdb.style.display=''; if(_vdt) _vdt.textContent='▲ recolher'; }
  _visPiscinaSelecionadaId=null;
  _visRenderPiscinas();
  renderVisChips();
  renderVisEquipGrid();
}

function toggleVisDados(){
  const body=document.getElementById('vis-dados-body');
  const lbl=document.getElementById('vis-dados-toggle');
  if(!body) return;
  const open = body.style.display!=='none';
  body.style.display = open?'none':'';
  if(lbl) lbl.textContent = open?'▼ expandir':'▲ recolher';
}

// Reabre uma vistoria já feita para EDITAR / REFAZER — mantém status, obs e fotos.
// Grava no MESMO registro (visEditId), então não duplica.
// ── Vistoria → Orçamento ────────────────────────────────────────────────
// Fecha o ciclo do negócio: a vistoria aponta o problema, o orçamento
// cobra o conserto. Sem isto, o técnico anota o defeito e alguém redigita
// tudo depois — e boa parte simplesmente não vira proposta nenhuma.
function _visItensOrcaveis(v){
  const eq = typeof v.equipamentos==='string' ? JSON.parse(v.equipamentos||'[]') : (v.equipamentos||[]);
  return eq.filter(e=>e.status==='critico'||e.status==='atencao');
}
function _visDataBR(d){
  if(!d) return '—';
  try{ return new Date(d+'T12:00:00').toLocaleDateString('pt-BR'); }catch(e){ return d; }
}
// ── IMPORTAR EQUIPAMENTO DA VISTORIA → PATRIMÔNIO (Fase 10) ──────────────
// A vistoria coleta em campo os equipamentos reais do local (nome, modelo,
// potência), mas eles não entram no cadastro (tabela equipamentos). Sem isso o
// prontuário e o vínculo OS→equipamento ficam vazios pra quem nunca cadastrou à
// mão. Este importador popula o patrimônio a partir do que o técnico já viu.
// Casa por cliente + tipo (nome do equipamento) pra não duplicar o que já existe.
function _visEquipParaCadastrar(v){
  const equips=(typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
  const cid=v.cliente_id||null, nomeCli=_normNome(v.cliente||'');
  const jaTem=new Set((todosEq||[]).filter(e=>
    (cid && e.cliente_id===cid) || (!cid && nomeCli && _normNome(e.cliente_nome||'')===nomeCli)
  ).map(e=>_normNome(e.tipo||'')));
  // Só equipamentos com nome real, ainda não cadastrados pra este cliente.
  const vistos=new Set();
  return equips.filter(e=>{
    const t=_normNome(e.nome||''); if(!t) return false;
    if(jaTem.has(t) || vistos.has(t)) return false; // não duplica nem repete dentro da própria vistoria
    vistos.add(t); return true;
  });
}
function importarEquipamentosVistoria(id){
  const v=lsVisLer().find(x=>String(x.id)===String(id));
  if(!v){ toast('Vistoria não encontrada'); return; }
  const novos=_visEquipParaCadastrar(v);
  if(!novos.length){ toast('Todos os equipamentos desta vistoria já estão no patrimônio'); return; }
  confirmar({
    titulo:'Cadastrar no patrimônio?',
    msg:`Vou criar ${novos.length} equipamento(s) no cadastro de ${v.cliente||'este cliente'}, a partir do que a vistoria registrou: ${novos.map(e=>e.nome).slice(0,4).join(', ')}${novos.length>4?'…':''}. Depois você completa marca/série se quiser.`,
    labelSim:'Cadastrar',
    onSim:()=>_importarEquipamentosVistoriaConfirmado(v, novos)
  });
}
function _importarEquipamentosVistoriaConfirmado(v, novos){
  const agora=new Date().toISOString();
  const criados=novos.map(e=>({
    id:'eq_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    cliente_nome:v.cliente||'', cliente_id:v.cliente_id||null, piscina_id:null,
    tipo:e.nome||'Equipamento', marca:'', modelo:e.modelo||'', potencia:e.potencia||'',
    numero_serie:'', data_instalacao:'', garantia_meses:null, garantia_vencimento:null,
    obs:`Cadastrado da vistoria de ${_visDataBR(v.data)}`, foto_base64:null, ativo:true,
    loja_id:v.loja_id||lojaAtiva||LOJA_PADRAO_ID, data_criacao:agora
  }));
  todosEq=[...criados, ...(todosEq||[])];
  lsEqSalvar(todosEq);
  // Sobe pro banco em background (mesmo padrão de salvarEquipamento).
  if(dbOk&&db){
    criados.forEach(rec=>{
      const payload={...rec}; delete payload.id;
      dbInsert('equipamentos', payload).then(({data:ins})=>{
        if(ins){ todosEq=todosEq.filter(x=>x.id!==rec.id); todosEq.unshift(ins); lsEqSalvar(todosEq); if(document.getElementById('page-equipamentos')?.classList.contains('on')) renderEqGrid(); }
      }).catch(err=>console.warn('[importEqVis]', err?.message||err));
    });
  }
  if(typeof renderEqGrid==='function') renderEqGrid();
  if(typeof logAcao==='function') logAcao('equipamentos_da_vistoria', `${v.cliente||''} — ${criados.length}`);
  toast(`✅ ${criados.length} equipamento(s) no patrimônio`);
}

function orcarDaVistoria(id){
  const v=lsVisLer().find(x=>String(x.id)===String(id));
  if(!v){ toast('Vistoria não encontrada'); return; }
  const itens=_visItensOrcaveis(v);
  if(!itens.length){ toast('Nenhum item crítico ou de atenção nesta vistoria'); return; }
  const criticos=itens.filter(e=>e.status==='critico').length;
  confirmar({
    titulo:'Gerar orçamento da vistoria?',
    msg:`Vou criar um orçamento para ${v.cliente||'este cliente'} com ${itens.length} item(ns) apontado(s) na vistoria de ${_visDataBR(v.data)}${criticos?` — ${criticos} crítico(s)`:''}. Você revisa os preços antes de salvar.`,
    labelSim:'Gerar orçamento',
    onSim:()=>_orcarDaVistoriaConfirmado(v, itens)
  });
}
function _orcarDaVistoriaConfirmado(v, itens){
  novoOrc();
  window._skipDraftForm=true; // rascunho antigo não pode sobrescrever isto
  setTimeout(()=>{
    setV('cli', v.cliente||'');
    setV('cli-id', v.cliente_id||'');
    setV('loc', v.local||'');
    // Quem já tem vistoria é cliente da casa, não lead novo.
    if(typeof setOrigemCli==='function') setOrigemCli('Já é cliente');
    // Crítico primeiro: é a ordem em que o síndico precisa ler.
    const ordenados=[...itens].sort((a,b)=>(a.status==='critico'?0:1)-(b.status==='critico'?0:1));
    svcs=[];
    ordenados.forEach(e=>{
      const marca=[e.marca,e.modelo].filter(Boolean).join(' ');
      const prob=(e.obs||'').trim();
      // A descrição carrega o laudo do técnico — é o argumento de venda,
      // e ninguém vai reescrever isso melhor do que quem viu o problema.
      const cabeca=[
        e.status==='critico'?'[URGENTE]':'[Preventivo]',
        (e.ambiente||'').trim()?((e.ambiente||'').trim()+' —'):'',
        e.nome||e.id,
        marca?`(${marca})`:''
      ].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
      const d = cabeca + (prob?`: ${prob}`:'');
      addSvc(d, '', 1); // preço em branco de propósito — quem precifica revisa
    });
    const escopoEl=document.getElementById('escopo');
    if(escopoEl) escopoEl.value=`Serviços apontados na vistoria de ${_visDataBR(v.data)}${v.tecnico?` (técnico: ${v.tecnico})`:''}.`
      +(v.recomendacoes?`\n\nRecomendações do técnico: ${v.recomendacoes}`:'');
    setV('nota-interna', `Gerado da vistoria ${v.id}`);
    renderSvcs(); upd();
    toast(`📋 ${itens.length} item(ns) importado(s) — revise os preços`);
    if(typeof logAcao==='function') logAcao('orcamento_da_vistoria', `${v.cliente||''} — ${itens.length} itens`);
  }, 60);
}

// ── VISTORIA → OPORTUNIDADE (Fase 13) ───────────────────────────────────
// O caminho vistoria→orçamento já existe (orcarDaVistoria). O que faltava: a
// recomendação MORRE no relatório se ninguém orçar na hora. Uma vistoria com
// item crítico/atenção que ainda não virou orçamento é uma OPORTUNIDADE aberta
// — dinheiro apontado pelo técnico esperando alguém agir. Estas funções a
// tornam visível na fila "Precisa de você hoje" até ser orçada ou dispensada.
const LS_VIS_OPORT_DISMISS='fluxa_vis_oport_dismiss';
function _visOportDismissLer(){ try{ return JSON.parse(ls(LS_VIS_OPORT_DISMISS)||'{}'); }catch(e){ return {}; } }
function _visOportDismiss(id){ try{ const m=_visOportDismissLer(); m[id]=Date.now(); lsSet(LS_VIS_OPORT_DISMISS, JSON.stringify(m)); }catch(e){ console.warn('[visOportDismiss]',e?.message||e); } if(typeof renderPainelFilaHoje==='function') renderPainelFilaHoje(); }
// Vistoria já virou orçamento? O fluxo grava nota_interna 'Gerado da vistoria <id>'.
function _visJaOrcada(vid){
  return (todosOrc||[]).some(o=>String(o.nota_interna||'').includes('vistoria '+vid));
}
function _visOportunidades(){
  // Vendas/gestor agem sobre isto; técnico não orça.
  if(eTecnico()) return [];
  const dismiss=_visOportDismissLer();
  const vistorias=filtrarPorLoja(lsVisLer()||[]);
  return vistorias
    .map(v=>({v, itens:_visItensOrcaveis(v)}))
    .filter(x=>x.itens.length && !dismiss[x.v.id] && !_visJaOrcada(x.v.id))
    .map(x=>({
      id:x.v.id, cliente:x.v.cliente||'—', data:x.v.data,
      criticos:x.itens.filter(e=>e.status==='critico').length,
      total:x.itens.length,
      _d: x.v.data ? new Date(String(x.v.data).length<=10?x.v.data+'T12:00:00':x.v.data) : null
    }))
    .sort((a,b)=>(b.criticos-a.criticos) || ((b._d||0)-(a._d||0)));
}

// ── MANUTENÇÃO PREVENTIVA (Fase 29) ─────────────────────────────────────
// Fecha o último elo da cadeia: Histórico → Próxima manutenção. Um plano de
// acompanhamento (agendamento recorrente) tem periodicidade conhecida
// (semanal/quinzenal/mensal). Se a ÚLTIMA vistoria feita para aquele local já
// passou do intervalo, a manutenção está vencida — e o cliente pode ficar sem
// atendimento sem ninguém perceber.
//
// Base real, não chute: periodicidade vem do próprio plano (agendamentos.
// periodicidade), última visita vem das vistorias daquele local. Sem plano
// recorrente não há preventiva a cobrar (uma visita avulsa não promete a
// próxima).
const _PERIODO_DIAS={semanal:7, quinzenal:14, mensal:30};
const LS_MANUT_DISMISS='fluxa_manut_dismiss';
function _manutDismissLer(){ try{ return JSON.parse(ls(LS_MANUT_DISMISS)||'{}'); }catch(e){ return {}; } }
// Chave inclui a data-base: ao fazer uma vistoria nova, a base muda, a chave
// muda e o aviso pode reaparecer no ciclo seguinte. Dispensar não é pra sempre.
function _manutDismiss(chave){ try{ const m=_manutDismissLer(); m[chave]=Date.now(); lsSet(LS_MANUT_DISMISS, JSON.stringify(m)); }catch(e){ console.warn('[manutDismiss]',e?.message||e); } if(typeof renderPainelFilaHoje==='function') renderPainelFilaHoje(); }
function _manutencoesPreventivas(){
  if(eTecnico()) return [];
  const hoje=new Date(_hojeLocal()+'T12:00:00');
  const dismiss=_manutDismissLer();
  const vistorias=lsVisLer()||[];
  const planos=filtrarPorLoja(todosAg||[]).filter(a=>a.ativo!==false && _PERIODO_DIAS[a.periodicidade]);
  const out=[];
  planos.forEach(ag=>{
    const periodo=_PERIODO_DIAS[ag.periodicidade];
    // Vistorias deste plano: por local_id quando existe, senão casa cliente+local.
    const nomeCli=_normNome(ag.cliente||''), nomeLoc=_normNome(ag.local_servico||'');
    const doPlano=vistorias.filter(v=>{
      if(ag.local_id && v.local_id) return v.local_id===ag.local_id;
      return nomeCli && _normNome(v.cliente||'')===nomeCli && (!nomeLoc || _normNome(v.local||'')===nomeLoc);
    });
    const datas=doPlano.map(v=>v.data).filter(Boolean).sort();
    const ultima=datas[datas.length-1] || ag.data_inicio || null;
    if(!ultima) return; // sem base, não há "próxima" a prometer
    if(ag.data_fim && ag.data_fim<_hojeLocal()) return; // plano encerrado
    const base=new Date(ultima+'T12:00:00');
    const proxima=new Date(base); proxima.setDate(proxima.getDate()+periodo);
    const diasAte=Math.round((proxima-hoje)/86400000); // <0 vencida, >0 a vencer
    // Mostra vencida OU vencendo nos próximos 3 dias — antes disso é ruído.
    if(diasAte>3) return;
    const chave=`${ag.id}:${ultima}`;
    if(dismiss[chave]) return;
    out.push({
      chave, cliente:ag.cliente||'—', local:ag.local_servico||'',
      periodicidade:ag.periodicidade, ultima, diasAte,
      nuncaVistoriado: !datas.length
    });
  });
  return out.sort((a,b)=>a.diasAte-b.diasAte);
}

// ── DOSSIÊ DE ASSEMBLEIA ────────────────────────────────────────────────
// Condomínio não decide um gasto grande no balcão: decide em assembleia. E o
// síndico não consegue defender o valor com um PDF de itens e preço — ele
// precisa mostrar o problema, a CONSEQUÊNCIA de não fazer, e a urgência.
// Este documento é feito pra ser APRESENTADO por ele, não lido por ele.
//
// O texto é determinístico (regra por tipo de equipamento × status), não
// gerado por IA: funciona offline, sem chave de API, sem custo por uso e sem
// risco de inventar uma consequência que o técnico não constatou.
const _DOSSIE_CONSEQ = [
  { rx:/trocador|aquecedor|bomba de calor/i,
    critico:'Piscina sem aquecimento — em plena temporada de uso, o condomínio perde a área de lazer aquecida, e o equipamento parado tende a agravar o dano.',
    atencao:'Perda de eficiência no aquecimento: mais consumo de energia para entregar a mesma temperatura, com risco de parada no meio da temporada.' },
  { rx:/motobomba|bomba/i,
    critico:'Sem circulação, a piscina fica imprópria para banho em poucos dias: a água não passa pelo filtro nem recebe tratamento.',
    atencao:'Circulação abaixo do ideal: filtragem menos eficiente e desgaste acelerado do conjunto motor.' },
  { rx:/filtro/i,
    critico:'Sem filtragem, a água perde transparência e a qualidade sanitária cai — risco direto ao banhista.',
    atencao:'Filtragem comprometida: mais consumo de químicos para manter a água dentro do padrão.' },
  { rx:/sauna/i,
    critico:'Sauna fora de operação — área de lazer indisponível aos condôminos.',
    atencao:'Aquecimento irregular da sauna, com risco de parada total.' },
  { rx:/ilumina|led/i,
    critico:'Iluminação submersa inoperante representa risco de segurança no uso noturno.',
    atencao:'Iluminação parcial: conforto e segurança reduzidos no período noturno.' },
  { rx:/automa|dosador|cloro|ozon/i,
    critico:'Sem dosagem automática, o controle químico passa a depender de ajuste manual, com risco de água fora do padrão.',
    atencao:'Dosagem irregular: variação na qualidade da água e mais consumo de produto.' },
  { rx:/spa|hidro/i,
    critico:'Spa fora de operação — área de lazer indisponível aos condôminos.',
    atencao:'Funcionamento irregular do spa, com risco de parada.' },
  { rx:/skimmer/i,
    critico:'Sem skimmer operante, a sujeira de superfície deixa de ser recolhida e sobrecarrega o filtro.',
    atencao:'Recolhimento de superfície comprometido: mais carga no filtro e água menos limpa.' }
];
function _dossieConsequencia(nome, status){
  const r=_DOSSIE_CONSEQ.find(x=>x.rx.test(nome||''));
  if(r) return status==='critico' ? r.critico : r.atencao;
  return status==='critico'
    ? 'Equipamento fora de operação, comprometendo o funcionamento normal da área de lazer.'
    : 'Desgaste identificado: sem correção, tende a evoluir para parada do equipamento.';
}
function gerarDossieAssembleia(id){
  const v=lsVisLer().find(x=>String(x.id)===String(id));
  if(!v){ toast('Vistoria não encontrada'); return; }
  const itens=_visItensOrcaveis(v);
  if(!itens.length){ toast('Esta vistoria não tem itens críticos ou de atenção'); return; }

  // window.open SÍNCRONO, antes de qualquer trabalho pesado: aberto depois de
  // um await, o navegador não conta como gesto do usuário e o bloqueador de
  // pop-up mata a aba em silêncio (num PWA instalado nem há prompt pra
  // permitir). A janela abre em branco e recebe o conteúdo logo abaixo.
  const w=window.open('', '_blank');

  const LC=getLojaConfig(v.loja_id||lojaAtiva);
  const cor=LC.cor||'#0B62CE';
  const criticos=itens.filter(e=>e.status==='critico');
  const atencao=itens.filter(e=>e.status==='atencao');
  const _fotoDe=e=>((e.fotos||[]).filter(Boolean)[0])||null;

  const blocoCritico=criticos.map((e,i)=>{
    const foto=_fotoDe(e);
    return `<div class="ds-item ds-crit">
      <div class="ds-item-hd"><span class="ds-num">${i+1}</span>
        <div><div class="ds-item-nm">${esc(e.nome||e.id)}</div>
        ${e.ambiente?`<div class="ds-item-amb">📍 ${esc(e.ambiente)}</div>`:''}</div>
        <span class="ds-tag ds-tag-crit">AÇÃO IMEDIATA</span></div>
      ${e.obs?`<div class="ds-lb">O que foi encontrado</div><div class="ds-tx">${esc(e.obs)}</div>`:''}
      <div class="ds-lb">Se não for feito</div><div class="ds-tx ds-conseq">${esc(_dossieConsequencia(e.nome,'critico'))}</div>
      ${foto?`<img class="ds-foto" src="${esc(foto)}" alt="Registro fotográfico">`:''}
    </div>`;
  }).join('');

  const blocoAtencao=atencao.length?`<div class="ds-sec-t">Itens para programar</div>
    <table class="ds-tb"><thead><tr><th>Equipamento</th><th>Local</th><th>Situação</th></tr></thead><tbody>
    ${atencao.map(e=>`<tr><td><strong>${esc(e.nome||e.id)}</strong></td><td>${esc(e.ambiente||'—')}</td><td>${esc(e.obs||_dossieConsequencia(e.nome,'atencao'))}</td></tr>`).join('')}
    </tbody></table>`:'';

  const css=`
    body{margin:0;padding:80px 20px 40px;background:#f3f4f6;font-family:'Instrument Sans',Inter,-apple-system,sans-serif;color:#111827}
    .ds{max-width:794px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.15);overflow:hidden}
    .ds-hd{background:${cor};color:#fff;padding:26px 32px}
    .ds-hd h1{margin:0 0 4px;font-size:21px;font-weight:800}
    .ds-hd .ds-sub{font-size:13px;opacity:.9}
    .ds-bd{padding:28px 32px}
    .ds-cli{font-size:19px;font-weight:800;margin-bottom:2px}
    .ds-meta{font-size:12px;color:#6b7280;margin-bottom:20px}
    .ds-resumo{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
    .ds-kpi{flex:1;min-width:130px;border-radius:10px;padding:14px 16px;border:1.5px solid #e5e7eb}
    .ds-kpi.c{background:#fee2e2;border-color:#fecaca}
    .ds-kpi.a{background:#fef3c7;border-color:#fde68a}
    .ds-kpi-v{font-size:26px;font-weight:800;line-height:1}
    .ds-kpi.c .ds-kpi-v{color:#b91c1c}.ds-kpi.a .ds-kpi-v{color:#b45309}
    .ds-kpi-l{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#4b5563;margin-top:5px}
    .ds-sec-t{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${cor};border-bottom:2px solid #f3f4f6;padding-bottom:7px;margin:26px 0 14px}
    .ds-item{border:1.5px solid #e5e7eb;border-radius:10px;padding:16px 18px;margin-bottom:14px;page-break-inside:avoid}
    .ds-crit{border-left:4px solid #ef4444}
    .ds-item-hd{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
    .ds-num{background:#ef4444;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}
    .ds-item-nm{font-size:15px;font-weight:700}
    .ds-item-amb{font-size:11px;color:#6b7280;margin-top:1px}
    .ds-tag{margin-left:auto;font-size:9px;font-weight:800;padding:4px 8px;border-radius:5px;white-space:nowrap}
    .ds-tag-crit{background:#fee2e2;color:#b91c1c}
    .ds-lb{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#6b7280;margin-top:9px}
    .ds-tx{font-size:13px;line-height:1.5;margin-top:3px}
    .ds-conseq{background:#fef2f2;border-left:3px solid #fca5a5;padding:8px 11px;border-radius:0 6px 6px 0}
    .ds-foto{width:100%;max-height:230px;object-fit:cover;border-radius:7px;margin-top:11px}
    .ds-tb{width:100%;border-collapse:collapse;font-size:12px}
    .ds-tb th{background:#f9fafb;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;border-bottom:1.5px solid #e5e7eb}
    .ds-tb td{padding:8px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top}
    .ds-ft{background:#f9fafb;padding:18px 32px;font-size:11px;color:#6b7280;border-top:1.5px solid #e5e7eb}
    #dl{position:fixed;top:16px;left:50%;transform:translateX(-50%);background:${cor};color:#fff;border:none;border-radius:10px;padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:99;font-family:inherit}
    @media print{#dl{display:none!important}body{padding:0;background:#fff}.ds{box-shadow:none;border-radius:0;max-width:none}}`;

  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Dossie-${(v.cliente||'assembleia').replace(/\s+/g,'-')}</title>
    <style>${css}</style></head><body>
    <button id="dl" onclick="window.print()">📥 Baixar / Imprimir</button>
    <div class="ds">
      <div class="ds-hd">
        <h1>Laudo Técnico para Assembleia</h1>
        <div class="ds-sub">${esc(LC.nome||'')}${LC.tel?' · '+esc(LC.tel):''}</div>
      </div>
      <div class="ds-bd">
        <div class="ds-cli">${esc(v.cliente||'')}</div>
        <div class="ds-meta">${v.local?esc(v.local)+' · ':''}Vistoria realizada em ${_visDataBR(v.data)}${v.tecnico?' por '+esc(v.tecnico):''}</div>
        <div class="ds-resumo">
          <div class="ds-kpi c"><div class="ds-kpi-v">${criticos.length}</div><div class="ds-kpi-l">Exigem ação imediata</div></div>
          <div class="ds-kpi a"><div class="ds-kpi-v">${atencao.length}</div><div class="ds-kpi-l">Para programar</div></div>
          <div class="ds-kpi"><div class="ds-kpi-v">${itens.length}</div><div class="ds-kpi-l">Total apontado</div></div>
        </div>
        ${criticos.length?`<div class="ds-sec-t">Itens que exigem ação imediata</div>${blocoCritico}`:''}
        ${blocoAtencao}
        ${v.recomendacoes?`<div class="ds-sec-t">Recomendação técnica</div><div class="ds-tx">${esc(v.recomendacoes)}</div>`:''}
      </div>
      <div class="ds-ft">
        Documento gerado a partir da vistoria técnica de ${_visDataBR(v.data)}. As condições descritas
        refletem o estado dos equipamentos na data da visita.
        ${LC.nome?esc(LC.nome):''}${LC.tel?' · '+esc(LC.tel):''}
      </div>
    </div></body></html>`;

  if(!w){ toast('⚠️ Permita pop-ups para abrir o dossiê'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  toast('📄 Dossiê aberto — toque em "Baixar / Imprimir"');
  if(typeof logAcao==='function') logAcao('dossie_assembleia', v.cliente||'');
}

function editarVistoria(id){
  const vis=lsVisLer().find(x=>x.id===id);
  if(!vis){ toast('⚠️ Vistoria não encontrada'); return; }
  const equips=(typeof vis.equipamentos==='string'?JSON.parse(vis.equipamentos||'[]'):vis.equipamentos)||[];
  // Reset de estado
  visEquipSelecionados=[]; visEquipDados={}; _visEquipsCustom=[];
  visCheckinTime=null; visCheckoutTime=null;
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval=null; }
  visEditId=id; _visDraftId=id;            // edita o mesmo registro
  window._visLocalId=vis.local_id||null;   // mantém vínculo com o plano (e a empresa)
  go('visitas'); visTab('nova');
  // Esconde banners de plano/pré-carga (estamos editando algo existente)
  const pb=document.getElementById('vis-plano-banner'); if(pb) pb.style.display='none';
  const pc=document.getElementById('vis-precarga-banner'); if(pc) pc.style.display='none';
  const set=(elId,val)=>{ const e=document.getElementById(elId); if(e) e.value=val||''; };
  set('vis-cli',vis.cliente); set('vis-cli-id',vis.cliente_id); set('vis-loc',vis.local);
  _visPiscinaSelecionadaId = vis.piscina_id||null;
  _visRenderPiscinas();
  const _en=new Date(); const _ed=`${_en.getFullYear()}-${String(_en.getMonth()+1).padStart(2,'0')}-${String(_en.getDate()).padStart(2,'0')}`;
  set('vis-data',vis.data||_ed);
  set('vis-mes-ref',vis.mes_ref||_ed.slice(0,7));
  set('vis-hora',vis.hora||vis.hora_checkin||'');
  set('vis-obs',vis.obs_geral);
  set('vis-recom',vis.recomendacoes);
  set('vis-email-resp',vis.email_responsavel);
  // Registro anterior à assinatura obrigatória volta SEM assinatura — e vai
  // exigir assinar de novo pra finalizar, mesma regra de qualquer vistoria.
  _visAssinaturaTecnico = vis.assinatura_tecnico_base64
    ? {base64:vis.assinatura_tecnico_base64, data:vis.assinatura_tecnico_data||new Date().toISOString(),
       meta:vis.assinatura_tecnico_meta||'', nome:vis.tecnico||''}
    : null;
  renderVisAssinaturaStatus();
  const tecSel=document.getElementById('vis-tec');
  if(tecSel&&vis.tecnico){ for(const o of tecSel.options){ if(o.text===vis.tecnico||o.value===vis.tecnico){ o.selected=true; break; } } }
  // Equipamentos: separa padrão de custom e PRESERVA status/obs/fotos
  const stdDefs=VIS_EQUIPAMENTOS_DEFAULT.map(x=>x.id);
  visEquipSelecionados=equips.filter(e=>stdDefs.includes(e.id)).map(e=>e.id);
  _visEquipsCustom=equips.filter(e=>!stdDefs.includes(e.id)).map(e=>({id:e.id,nome:e.nome,emoji:e.emoji||'⚙️',modelo:e.modelo||'',potencia:e.potencia||'',origem:_visOrigemEquip(e)}));
  equips.forEach(e=>{ visEquipDados[e.id]={status:e.status||'na',obs:e.obs||'',fotos:(e.fotos||[]).filter(Boolean)}; });
  renderVisChips();
  renderVisEquipGrid();
  const card=document.getElementById('vis-equip-card');
  if(card) card.style.display=(visEquipSelecionados.length||_visEquipsCustom.length)?'':'none';
  window.scrollTo({top:0,behavior:'smooth'});
  toast('✏️ Editando vistoria — ajuste e salve/gere o PDF');
}

// ══════════════════════════════════════════════════
//  EMAILJS — envio de relatório de vistoria
// ══════════════════════════════════════════════════

function emailJSConfigurado(){
  const e=_ejsCfg(); return !!(e.pubkey && e.service && e.template);
}

function initEmailJS(){
  const _e=_ejsCfg(); if(_e.pubkey){
    try{ emailjs.init({ publicKey: _e.pubkey }); }catch(e){ console.warn('[initEmailJS]', e?.message||e); }
  }
}

// Gera o PDF da vistoria e sobe no Storage; retorna a URL pública (ou null em falha).
// Resiliente: qualquer erro (bucket/policy faltando, html2pdf, rede) → null, e o
// e-mail segue só com o texto. Nunca lança.
let _pdfStorageOk = null; // null=desconhecido, true=bucket ok, false=bucket/policy faltando (não gerar PDF à toa)
async function gerarEUploadPDFVistoria(vis){
  if(typeof html2pdf === 'undefined' || !db) return null;
  if(_pdfStorageOk === false) return null; // já sabemos que o Storage não está pronto — evita gerar PDF em vão
  const element = document.getElementById('pdoc-visita');
  if(!element) return null;
  const prevStyle = element.getAttribute('style') || '';
  try{
    preencherRelatorioVistoria(vis);
    // Torna visível fora da tela — html2canvas não captura display:none (PDF sairia em branco)
    element.setAttribute('style', 'display:block!important;position:absolute;top:0;left:0;width:794px;background:#fff;z-index:-1');
    await new Promise(r=>setTimeout(r,350));
    const blob = await html2pdf()
      .set({
        margin: 0,
        filename: `vistoria-${(vis.cliente||'').replace(/[^a-z0-9]/gi,'-')}-${vis.data||''}.pdf`,
        image: { type:'jpeg', quality:0.85 },
        html2canvas: { scale:2, useCORS:true, allowTaint:true, logging:false, width:794 },
        jsPDF: { unit:'mm', format:'a4', orientation:'portrait' }
      })
      .from(element)
      .output('blob');
    element.setAttribute('style', prevStyle || 'display:none');

    // v2: pasta = EMPRESA_ID (a política do bucket exige a pasta da empresa).
    const filename = `${EMPRESA_ID}/${vis.id||Date.now()}.pdf`;
    const { error } = await db.storage.from('vistorias-pdf').upload(filename, blob, {
      contentType:'application/pdf', upsert:true
    });
    if(error){
      console.warn('[PDF vistoria] upload falhou (bucket/policy?):', error.message);
      if(/not found|bucket|policy|row-level|denied|unauthor/i.test(error.message||'')) _pdfStorageOk=false;
      return null;
    }
    _pdfStorageOk=true;
    const { data } = db.storage.from('vistorias-pdf').getPublicUrl(filename);
    return data?.publicUrl || null;
  }catch(e){
    console.warn('[PDF vistoria] erro ao gerar/subir:', e?.message||e);
    element.setAttribute('style', prevStyle || 'display:none');
    return null;
  }
}

async function enviarEmailVistoria(vis){
  if(!emailJSConfigurado()){
    console.log('EmailJS não configurado, pulando envio automático');
    return false;
  }
  const emailDest = vis.email_responsavel;
  if(!emailDest){ return false; }

  // Monta resumo dos equipamentos em texto
  const equips=(typeof vis.equipamentos==='string'?JSON.parse(vis.equipamentos||'[]'):vis.equipamentos)||[];
  const statusTxt={bom:'✅ Bom',atencao:'⚠️ Atenção',critico:'🔴 Crítico',na:'N/A'};
  const resumoLinhas = equips.filter(e=>e.status!=='na').map(e=>`• ${e.nome}: ${statusTxt[e.status]||e.status}${e.obs?' — '+e.obs:''}`);
  const resumo = resumoLinhas.join('\n') || 'Nenhum equipamento vistoriado com problemas.';
  const mesRef = vis.mes_ref ? new Date(+vis.mes_ref.split('-')[0],+vis.mes_ref.split('-')[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) : '';
  const dataVisita = vis.data ? new Date(vis.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';

  // Conta críticos e atenções para assunto dinâmico
  const temCritico = equips.some(e=>e.status==='critico');
  const temAtencao = equips.some(e=>e.status==='atencao');
  const statusGeral = temCritico ? '🔴 Ação necessária' : temAtencao ? '⚠️ Verificar pontos' : '✅ Tudo em ordem';
  const duracao = calcDuracao(vis.hora_checkin||vis.hora, vis.hora_checkout);

  // Gera o PDF e sobe no Storage para anexar o link no e-mail.
  // Se o bucket/policy ainda não estiver pronto, retorna null e o e-mail vai só com o texto.
  let pdfUrl = '';
  try{ pdfUrl = (await gerarEUploadPDFVistoria(vis)) || ''; }
  catch(e){ console.warn('[email vistoria] PDF não anexado:', e?.message||e); }

  const params = {
    to_email    : emailDest,
    to_name     : vis.cliente || 'Responsável',
    empresa     : CFG.nome || 'Empresa',
    tecnico     : vis.tecnico || '',
    mes_ref     : mesRef,
    data_visita : dataVisita,
    hora_checkin: vis.hora_checkin || vis.hora || '',
    hora_checkout: vis.hora_checkout || '',
    duracao     : duracao || '',
    resumo      : resumo,
    obs_geral   : vis.obs_geral || '',
    status_geral: statusGeral,
    tel_empresa : CFG.tel || '',
    reply_to    : _ejsCfg().reply_to || '',
    link_relatorio: pdfUrl,
    link_pdf    : pdfUrl ? `📄 Baixar o relatório completo em PDF: ${pdfUrl}` : '',
  };

  try{
    initEmailJS();
    const _e=_ejsCfg(); await emailjs.send(_e.service, _e.template, params);
    return true;
  }catch(e){
    console.error('EmailJS send error:', e);
    return false;
  }
}

async function testarEmailJS(){
  const st = document.getElementById('ejs-status');
  const _e=_ejsCfg(); if(!_e.pubkey || !_e.service || !_e.template){
    if(st) st.textContent='⚠️ Preencha e salve os 3 campos antes de testar.';
    return;
  }
  if(st) st.textContent='📨 Enviando…';
  const s=getSessao();
  const testVis={
    cliente:'TESTE VISTORIA', local:'Endereço de teste', data:_hojeLocal(),
    hora:'09:00', tecnico: s?.nome||'Técnico', mes_ref:_hojeLocal().slice(0,7),
    hora_checkin:'09:00', hora_checkout:'10:30', obs_geral:'E-mail de teste do sistema Fluxa.',
    email_responsavel: (document.getElementById('ejs-test-email')?.value||'').trim(),
    equipamentos:[
      {id:'motobomba',nome:'Motobomba Principal',emoji:'⚙️',status:'bom',obs:'Funcionando normalmente',fotos:[]},
      {id:'filtro',nome:'Filtro',emoji:'🔵',status:'atencao',obs:'Pressão acima do ideal — verificar na próxima visita',fotos:[]},
    ]
  };
  if(!testVis.email_responsavel){ if(st) st.textContent='Cancelado.'; return; }
  const ok = await enviarEmailVistoria(testVis);
  if(st) st.textContent = ok ? '✅ E-mail enviado com sucesso!' : '❌ Falha no envio — verifique o console e as credenciais.';
}

async function reenviarEmailVistoria(id){
  const lista = lsVisLer();
  const vis = lista.find(x=>x.id===id);
  if(!vis){ toast('⚠️ Vistoria não encontrada'); return; }
  if(!vis.email_responsavel){ toast('⚠️ Nenhum e-mail cadastrado nesta vistoria'); return; }
  if(!emailJSConfigurado()){ toast('⚠️ Configure o EmailJS em Empresa → E-mail Automático'); return; }
  toast('📨 Reenviando e-mail…');
  const ok = await enviarEmailVistoria(vis);
  if(ok) toast(`✅ E-mail reenviado para ${vis.email_responsavel}`);
  else   toast('❌ Falha no envio — verifique o console');
}

// ── Carrega vistorias do Supabase e faz merge com local ──
async function loadVistoriasRemoto(){
  if(!dbOk||!db) return;
  try{
    let q = db.from('vistorias').select('*').eq('empresa_id',EMPRESA_ID).order('created_at',{ascending:false}).limit(200);
    const lojaFiltro = getLojaFiltro();
    if(lojaFiltro) q = q.eq('loja_id', lojaFiltro);
    const {data} = await q;
    // Filtra em memória pelo escopo da empresa ativa para não contaminar
    // o localStorage com vistorias de outros grupos (ex: gestor "Todas" receberia Aquamotor)
    let remoto = (data||[]).filter(r=>escopoEmpresaMatch(r.loja_id));
    // Respeita os tombstones: vistorias apagadas não voltam. Se ainda estiverem
    // no banco (delete anterior falhou), tenta apagar de novo.
    const _tomb = new Set(_visTombLer());
    if(_tomb.size){
      remoto.filter(r=>_tomb.has(r.id)).forEach(r=>_excluirVistoriaBanco(r.id));
      remoto = remoto.filter(r=>!_tomb.has(r.id));
    }
    const local = lsVisLer();
    // Reenvia ao banco vistorias presas no aparelho (nunca sincronizadas).
    // Só reenvia se _pendingSync=true — evita ressuscitar vistorias deletadas remotamente.
    const remotoIds = new Set(remoto.map(r=>r.id));
    const soLocal = local.filter(l=>!remotoIds.has(l.id) && l._pendingSync===true);
    if(soLocal.length){
      for(const v of soLocal){
        try{
          // Faz upload das fotos e sincroniza com URLs
          const vComUrls = await _uploadFotosVistoria(v);
          // Atualiza localStorage com as URLs obtidas
          const _ls = lsVisLer();
          const _i = _ls.findIndex(x=>x.id===v.id);
          if(_i>=0){ _ls[_i]=vComUrls; lsVisSalvar(_ls); }
          const vParaSupabase = {
            ...vComUrls,
            equipamentos:(vComUrls.equipamentos||[]).map(eq=>({
              ...eq, fotos:(eq.fotos||[]).map(f=>f&&f.startsWith('http')?f:null)
            }))
          };
          const r=await _comTimeout(dbUpsert('vistorias', vParaSupabase), 20000, 'reenvio vistoria');
          if(r&&r.error) console.warn('[reenvioVistoria] '+v.id+':', r.error.message);
          else{ const _ls2=lsVisLer(); const _i2=_ls2.findIndex(x=>x.id===v.id); if(_i2>=0){ delete _ls2[_i2]._pendingSync; lsVisSalvar(_ls2); } }
        }catch(e){ console.warn('[reenvioVistoria]', e?.message||e); }
      }
    }
    if(!remoto.length && !soLocal.length) return;
    // Merge: remoto prevalece nos campos de texto.
    // Para fotos: URLs do Storage têm prioridade; base64 local é usado quando
    // o slot remoto está vazio (ex: upload falhou ou vistoria antiga).
    const merged = remoto.map(r=>{
      const eq = typeof r.equipamentos==='string'?JSON.parse(r.equipamentos||'[]'):r.equipamentos||[];
      const localVer = local.find(l=>l.id===r.id);
      const eqMerged = eq.map((e,i)=>{
        const lEq=(localVer?.equipamentos||[])[i];
        const fotosRemoto = e.fotos||[];
        const fotosLocal  = lEq?.fotos||[];
        const fotosMerged = fotosRemoto.map((fR,fi)=>{
          if(fR && fR.startsWith('http')) return fR; // URL do Storage — usa sempre
          if(fotosLocal[fi] && fotosLocal[fi].startsWith('http')) return fotosLocal[fi];
          if(fotosLocal[fi] && fotosLocal[fi].startsWith('data:')) return fotosLocal[fi]; // base64 local como fallback
          return null;
        });
        // slots locais além do tamanho do remoto (raro, mas garante)
        for(let fi=fotosRemoto.length;fi<fotosLocal.length;fi++){
          if(fotosLocal[fi]) fotosMerged.push(fotosLocal[fi]);
        }
        return {...e, fotos:fotosMerged};
      });
      return {...r, equipamentos:eqMerged};
    });
    // Vistorias só-locais: mantém apenas as pendentes de sync (_pendingSync=true).
    // Sem a flag = foram deletadas remotamente → não ressuscitar.
    local.forEach(l=>{ if(!merged.find(r=>r.id===l.id) && l._pendingSync===true) merged.push(l); });
    lsVisSalvar(merged);
    // Atualiza view se estiver visível
    if(document.getElementById('page-visitas')?.classList.contains('on')) renderVisHistorico();
  }catch(e){ console.warn('loadVistoriasRemoto err:',e.message); }
}

// Init OS page
initOS();

// ══════════════════════════════════════════════════════════════════
//  ESTOQUE — produtos + razão de movimentos (entrada/saída/ajuste)
//  Saldo = soma dos movimentos. Baixa idempotente por 'ref'. Multi-loja.
// ══════════════════════════════════════════════════════════════════
let todosProdutos = [];
let todosMovEstoque = [];
let estoqueBusca = '';

function lsProdLer(){ try{ return JSON.parse(ls('fluxa_produtos')||'[]'); }catch(e){ return []; } }
function lsProdSalvar(l){ lsSet('fluxa_produtos', JSON.stringify(l)); }
function lsMovLer(){ try{ return JSON.parse(ls('fluxa_estoque_mov')||'[]'); }catch(e){ return []; } }
function lsMovSalvar(l){ lsSet('fluxa_estoque_mov', JSON.stringify(l.slice(0,2000))); }

// Carrega produtos e movimentos: local primeiro, depois funde com o banco.
async function loadEstoque(){
  todosFornecedores = lsFornecLer();
  todasOC = lsOCLer();
  todosProdutos = lsProdLer();
  todosMovEstoque = lsMovLer();
  // Migração: remove movimentos do modelo antigo (baixa imediata, ref '...:sync:')
  // para não re-subirem ao banco e bagunçarem a física no modelo reserva/entrega.
  const _antes=todosMovEstoque.length;
  todosMovEstoque=todosMovEstoque.filter(m=>!(m.ref&&m.ref.indexOf(':sync:')>=0));
  if(todosMovEstoque.length!==_antes) lsMovSalvar(todosMovEstoque);
  renderEstoque();
  if(dbOk&&db){
    try{
      const [{data:prods,error:e1},{data:movs,error:e2},{data:fornecs},{data:ocs}] = await Promise.all([
        db.from('produtos').select('*').eq('empresa_id',EMPRESA_ID).order('nome',{ascending:true}),
        db.from('estoque_movimentos').select('*').eq('empresa_id',EMPRESA_ID).order('data',{ascending:false}).limit(5000),
        db.from('fornecedores').select('*').eq('empresa_id',EMPRESA_ID).order('nome',{ascending:true}),
        db.from('ordens_compra').select('*').eq('empresa_id',EMPRESA_ID).order('data_criacao',{ascending:false}).limit(200)
      ]);
      if(fornecs){ todosFornecedores=fornecs; lsFornecSalvar(fornecs); }
      if(ocs){ todasOC=ocs.map(o=>({...o,itens:typeof o.itens==='string'?JSON.parse(o.itens||'[]'):o.itens||[]})); lsOCSalvar(todasOC); }
      if(e1) throw e1; if(e2) throw e2;
      // Se o banco está vazio, limpa o cache local (dados de teste/simulação)
      if(prods&&prods.length===0){ todosProdutos=[]; lsProdSalvar([]); }
      if(movs&&movs.length===0){ todosMovEstoque=[]; lsMovSalvar([]); }
      // merge: banco prevalece, mantém locais ainda não sincronizados
      const idP=new Set((prods||[]).map(x=>x.id));
      const soLocalP=todosProdutos.filter(x=>String(x.id).startsWith('prod_')&&!idP.has(x.id));
      todosProdutos=[...(prods||[]),...soLocalP];
      lsProdSalvar(todosProdutos);
      const idM=new Set((movs||[]).map(x=>x.id));
      const soLocalM=todosMovEstoque.filter(x=>String(x.id).startsWith('mov_')&&!idM.has(x.id));
      todosMovEstoque=[...(movs||[]),...soLocalM];
      _invalidarSaldoCache();
      lsMovSalvar(todosMovEstoque);
      // reenvia ao banco o que ficou preso só no aparelho
      for(const p of soLocalP){ try{ await _comTimeout(dbUpsert('produtos',p),20000,'prod'); }catch(e){ console.warn('[reenvioProd]',e?.message||e); } }
      for(const m of soLocalM){ try{ await _comTimeout(dbUpsert('estoque_movimentos',m),20000,'mov'); }catch(e){ console.warn('[reenvioMov]',e?.message||e); } }
      renderEstoque();
    }catch(e){ console.warn('[loadEstoque]', e?.message||e); }
  }
}

// 3 números por produto (na loja ativa):
//   FÍSICA   = o que está no depósito (entrada/saída/ajuste/transferências)
//   RESERVADA= comprometida em orçamentos aprovados ainda não entregues
//   DISPONÍVEL = física − reservada  (negativo = encomenda, precisa comprar)
const _TIPOS_FISICOS=['entrada','saida','ajuste','transf_entrada','transf_saida'];
const _TIPOS_RESERVA=['reserva','liberacao_reserva'];
// Cache de saldo — recalculado uma vez por renderEstoque(), evita O(n*p) varreduras
let _saldoCache = null; // { produtoId: { fisico, reservado } }
function _invalidarSaldoCache(){ _saldoCache = null; }
function _getSaldoCache(){
  if(_saldoCache) return _saldoCache;
  const cache = {};
  filtrarPorLoja(todosMovEstoque).forEach(m=>{
    if(!cache[m.produto_id]) cache[m.produto_id]={fisico:0,reservado:0};
    const q=parseFloat(m.quantidade)||0;
    if(_TIPOS_FISICOS.includes(m.tipo)) cache[m.produto_id].fisico+=q;
    else if(_TIPOS_RESERVA.includes(m.tipo)) cache[m.produto_id].reservado+=q;
  });
  _saldoCache=cache;
  return cache;
}
function fisicaProduto(produtoId){ return (_getSaldoCache()[produtoId]||{fisico:0}).fisico; }

function _saldoPorLoja(produtoId){
  const r={};
  (todosMovEstoque||[]).filter(m=>m.produto_id===produtoId&&GRUPO_PRINCIPAL&&GRUPO_PRINCIPAL.includes(m.loja_id||'')).forEach(m=>{
    const lid=m.loja_id||''; if(!r[lid]) r[lid]={fisico:0,reservado:0};
    const q=parseFloat(m.quantidade)||0;
    if(_TIPOS_FISICOS.includes(m.tipo)) r[lid].fisico+=q;
    else if(_TIPOS_RESERVA.includes(m.tipo)) r[lid].reservado+=q;
  });
  return r;
}
function reservadoProduto(produtoId){ return (_getSaldoCache()[produtoId]||{reservado:0}).reservado; }
function disponivelProduto(produtoId){ const s=_getSaldoCache()[produtoId]||{}; return (s.fisico||0)-(s.reservado||0); }
function saldoProduto(produtoId){ return fisicaProduto(produtoId); } // compat
function produtoById(id){ return todosProdutos.find(p=>p.id===id)||null; }

// Registra um movimento (local imediato + sync em background, resiliente).
function registrarMovimento({produto_id, tipo, quantidade, custo_unit, motivo, ref, lojaId}){
  if(!produto_id){ console.warn('[mov] produto_id ausente — movimento ignorado', {tipo,ref}); return null; }
  const _TIPOS_VALIDOS=[..._TIPOS_FISICOS,..._TIPOS_RESERVA];
  if(!_TIPOS_VALIDOS.includes(tipo)){ console.warn('[mov] tipo inválido:', tipo, '— esperado:', _TIPOS_VALIDOS.join('|')); return null; }
  const s=getSessao();
  const mov={
    id:'mov_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
    loja_id: lojaId || lojaAtiva || produtoById(produto_id)?.loja_id || LOJA_PADRAO_ID,
    produto_id, tipo,
    quantidade: parseFloat(quantidade)||0,
    custo_unit: custo_unit!=null?parseFloat(custo_unit)||0:null,
    motivo: motivo||'', ref: ref||null,
    usuario: s?.nome||'', data: new Date().toISOString()
  };
  todosMovEstoque.unshift(mov);
  _invalidarSaldoCache();
  lsMovSalvar(todosMovEstoque);
  if(dbOk&&db){
    (async()=>{ try{ const r=await _comTimeout(dbInsert('estoque_movimentos',mov),20000,'mov'); if(r&&r.error) console.warn('[mov sync]', r.error.message); }catch(e){ console.warn('[mov sync bg]', e?.message||e); } })();
  }
  // Auditoria: só movimentos físicos relevantes (reserva/liberação são internos, não loga)
  if(['entrada','saida','ajuste','transf_entrada','transf_saida'].includes(tipo)){
    const p=produtoById(produto_id);
    logAcao('estoque_mov', `${tipo} ${Math.abs(mov.quantidade)} ${p?.unidade||'un'} · ${p?.nome||produto_id}${motivo?' ('+motivo+')':''}`);
  }
  return mov;
}

// Quanto de um produto, num orçamento, já foi RESOLVIDO (levado e/ou dispensado)?
// Cada `libres:` fecha, no momento em que roda, a quantidade então pendente —
// seja ela levada (com `baixa:` junto) ou explicitamente dispensada (só o
// `libres:`, sozinho). Somar as quantidades (em vez de só checar se existe
// ALGUM `libres:`) é o que permite reabrir a DIFERENÇA quando o gestor
// aumenta a quantidade de um item depois de uma entrega anterior, sem reabrir
// o que já foi deliberadamente marcado como "não levado" (achado de auditoria
// 2026-07-19 — a 1ª tentativa comparava só a `baixa:` física, que fica em 0
// pra item dispensado e reabria a reserva sozinha a cada reconciliação).
function _qtdResolvidaProdutoOrc(orcId, pid){
  return todosMovEstoque.filter(m=>m.ref==='libres:orc:'+orcId+':'+pid)
    .reduce((a,m)=>a+Math.abs(parseFloat(m.quantidade)||0),0);
}
// Um produto de um orçamento já foi TOTALMENTE tratado pra quantidade ATUAL do
// item? (levado + dispensado >= quantidade pedida agora). Editar a quantidade
// pra cima depois de uma entrega reabre só a diferença — ver _qtdResolvidaProdutoOrc.
function _entregueProdutoOrc(orcId, pid, qtyAtual){
  const qty = qtyAtual!=null ? Math.abs(parseFloat(qtyAtual)||0) : 0;
  return _qtdResolvidaProdutoOrc(orcId,pid) >= qty - 0.0001;
}
// Orçamento aprovado com produtos ainda não entregues (ou com quantidade extra
// pendente após um aumento posterior à entrega)?
function orcTemEntregaPendente(orc){
  if(!orc||orc.status!=='aprovado') return false;
  return (orc.servicos||[]).some(s=>s.produto_id && !_entregueProdutoOrc(orc.id,s.produto_id,parseInt(s.qty)||1));
}

// ── Reconciliação da RESERVA de um orçamento (aprovar/reverter/editar/excluir) ──
// Aprovado e não entregue → reserva os produtos. Reverteu/excluiu/entregou → libera.
// v2 (achado de auditoria): quando online, roda no SERVIDOR via RPC — evita a
// corrida de 2 sessões reconciliando o MESMO orçamento ao mesmo tempo (a versão
// local calcula o delta a partir do array em memória, sem trava nenhuma). A RPC
// trava a linha do orçamento (FOR UPDATE), então uma 2ª chamada concorrente
// espera a 1ª terminar e lê o estado já atualizado. Offline (ou se a RPC
// falhar) cai no cálculo local antigo, como fallback.
async function sincronizarReservaOrcamento(orc){
  if(!orc||!orc.id) return;
  if(dbOk && db && !String(orc.id).startsWith('local_')){
    try{
      const {error} = await db.rpc('rpc_sincronizar_reserva_orcamento', {p_orc_id: orc.id});
      if(error) throw error;
      await loadEstoque();
      return;
    }catch(e){ console.warn('[sincronizarReservaOrcamento RPC]', e?.message||e); }
  }
  _sincronizarReservaOrcamentoLocal(orc);
}
// Fallback local (offline, ou RPC indisponível) — idempotente: lança só a diferença
// entre o que deveria estar reservado e o que já está, calculado no array local.
function _sincronizarReservaOrcamentoLocal(orc){
  const aprovado = orc.status==='aprovado';
  const desejado={};
  if(aprovado){
    // soma a qtd pedida por produto primeiro (pode aparecer em mais de uma
    // linha de serviço) — só depois desconta o que já foi resolvido, pra não
    // subtrair o valor resolvido mais de uma vez por engano
    const pedidoPorPid={};
    (orc.servicos||[]).filter(s=>s.produto_id).forEach(s=>{
      pedidoPorPid[s.produto_id]=(pedidoPorPid[s.produto_id]||0)+(parseInt(s.qty)||1);
    });
    Object.keys(pedidoPorPid).forEach(pid=>{
      const pendente=Math.max(0, pedidoPorPid[pid]-_qtdResolvidaProdutoOrc(orc.id,pid));
      if(pendente>0) desejado[pid]=pendente;
    });
  }
  // já reservado por este orçamento (net dos movimentos de reserva/liberação deste orc)
  const jaReservado={};
  todosMovEstoque.filter(m=>_TIPOS_RESERVA.includes(m.tipo) && m.ref && m.ref.indexOf('orc:'+orc.id)>=0).forEach(m=>{
    jaReservado[m.produto_id]=(jaReservado[m.produto_id]||0)+(parseFloat(m.quantidade)||0);
  });
  const ids=new Set([...Object.keys(desejado),...Object.keys(jaReservado)]);
  let mudou=false;
  ids.forEach(pid=>{
    const delta=(desejado[pid]||0)-(jaReservado[pid]||0);
    if(Math.abs(delta)<0.0001) return;
    const numStr=String(orc.numero||'').padStart(3,'0');
    registrarMovimento({
      produto_id:pid, tipo: delta>0?'reserva':'liberacao_reserva', quantidade:delta,
      custo_unit:null,
      motivo:(delta>0?'Reserva orçamento #':'Libera reserva #')+numStr,
      ref:'res:orc:'+orc.id+':'+pid+':'+Date.now()+Math.random().toString(36).slice(2,5),
      lojaId:orc.loja_id
    });
    mudou=true;
  });
  if(mudou && document.getElementById('page-estoque')?.classList.contains('on')) renderEstoque();
}

// ── Entrega: converte reserva em baixa física (OS concluída, botão manual ou validação de itens) ──
// qtyMap (opcional): { produto_id: quantidade realmente levada }. Item ausente = leva a qtd do
// orçamento; item com 0 = não foi levado (não baixa física, mas libera a reserva).
// v2 (achado de auditoria): roda no servidor via RPC quando online, mesmo motivo
// da reserva acima — evita baixar o mesmo produto 2x se 2 sessões clicarem
// "Entregar" quase ao mesmo tempo. Fallback local se offline ou a RPC falhar.
async function entregarOrcamento(orc, origem, qtyMap){
  if(!orc||!orc.id) return;
  if(orc.status!=='aprovado'){ if(origem==='manual'||origem==='validar') toast('⚠️ Só dá baixa de orçamento aprovado'); return; }
  if(dbOk && db && !String(orc.id).startsWith('local_')){
    try{
      const {data:baixou, error} = await db.rpc('rpc_entregar_orcamento', {p_orc_id: orc.id, p_qty_map: qtyMap||null});
      if(error) throw error;
      await loadEstoque();
      if(typeof renderTabela==='function') renderTabela();
      atualizarDash&&atualizarDash();
      if(baixou){ if(origem==='manual'||origem==='validar') toast('✅ Itens confirmados e baixa realizada'); }
      else if(origem==='manual'||origem==='validar'){ toast('Nada a baixar (sem produtos ou já confirmado)'); }
      return;
    }catch(e){ console.warn('[entregarOrcamento RPC]', e?.message||e); }
  }
  _entregarOrcamentoLocal(orc, origem, qtyMap);
}
function _entregarOrcamentoLocal(orc, origem, qtyMap){
  let baixou=false;
  (orc.servicos||[]).filter(s=>s.produto_id).forEach(s=>{
    const pid=s.produto_id;
    const qtyAtual=Math.abs(parseInt(s.qty)||1);
    const pendente=qtyAtual-_qtdResolvidaProdutoOrc(orc.id,pid);
    if(pendente<=0.0001) return; // já tratado pra quantidade atual
    // qtyMap se refere ao que está PENDENTE agora (não à qtd original — se o
    // item já teve uma entrega parcial antes, isto é só a diferença em aberto)
    const levado = qtyMap && (pid in qtyMap) ? Math.min(pendente,Math.max(0,Math.abs(parseFloat(qtyMap[pid])||0))) : pendente;
    const p=produtoById(pid);
    const numStr=String(orc.numero||'').padStart(3,'0');
    if(levado>0){
      registrarMovimento({produto_id:pid, tipo:'saida', quantidade:-levado, custo_unit:p?p.custo:null, motivo:'Entrega orçamento #'+numStr, ref:'baixa:orc:'+orc.id+':'+pid, lojaId:orc.loja_id});
    }
    // libera SEMPRE a reserva do que estava pendente (item resolvido na entrega, levando tudo, parte ou nada)
    registrarMovimento({produto_id:pid, tipo:'liberacao_reserva', quantidade:-pendente, custo_unit:null, motivo:(levado>0?'Baixa entrega #':'Item não levado #')+numStr, ref:'libres:orc:'+orc.id+':'+pid, lojaId:orc.loja_id});
    baixou=true;
  });
  if(baixou){
    if(typeof renderTabela==='function') renderTabela();
    if(document.getElementById('page-estoque')?.classList.contains('on')) renderEstoque();
    atualizarDash&&atualizarDash();
    if(origem==='manual'||origem==='validar') toast('✅ Itens confirmados e baixa realizada');
  } else if(origem==='manual'||origem==='validar'){ toast('Nada a baixar (sem produtos ou já confirmado)'); }
}
// Compat: chamadas antigas de baixa agora gerenciam a RESERVA
function sincronizarBaixaOrcamento(orc){ sincronizarReservaOrcamento(orc); }
// Quando uma OS é concluída, dá baixa do orçamento vinculado (se houver)
function _entregarPelaOS(osId){
  if(!osId) return;
  let os=(todosOS||[]).find(x=>String(x.id)===String(osId));
  if(!os){ try{ os=(JSON.parse(ls('fluxa_os_hist')||'[]')||[]).find(x=>String(x.id)===String(osId)); }catch(e){ console.warn('[entregarPelaOS]',e?.message||e); } }
  const orcId=os?.orcamento_id;
  if(!orcId) return;
  const orc=todosOrc.find(o=>String(o.id)===String(orcId));
  if(orc && orc.status==='aprovado') entregarOrcamento(orc,'os');
}
function concluirOSHistorico(osId){
  confirmar('Marcar OS como concluída?\n\nIsso registrará a baixa de estoque automaticamente se houver orçamento vinculado.', ()=>{
    // Atualiza status local
    const idx=todosOS.findIndex(x=>x.id===osId);
    if(idx>=0) todosOS[idx].status='concluido';
    try{
      const lista=JSON.parse(ls('fluxa_os_hist')||'[]');
      const i=lista.findIndex(x=>x.id===osId);
      if(i>=0){ lista[i].status='concluido'; lsSet('fluxa_os_hist',JSON.stringify(lista.slice(0,200))); }
    }catch(e){ console.warn('[concluirOSHistorico local]',e?.message||e); }
    // Sync banco
    if(dbOk&&db&&!String(osId).startsWith('local_'))
      dbUpdate('ordens_servico',{status:'concluido'},'id',osId).catch(e=>console.warn('[concluirOS sync]',e?.message||e));
    // Baixa de estoque automática
    _entregarPelaOS(osId);
    const os=_acharOS(osId);
    logAcao('os_concluida',`OS #${String(os?.numero||'').padStart(3,'0')} ${os?.cliente||''}`);
    // Se era OS de agendamento recorrente, gera a próxima ocorrência
    if(os?.agendamento_id) _gerarProximaOSdoAg(os.agendamento_id, os.data_servico).catch(e=>console.warn('[nextOS]',e?.message||e));
    renderOSTabela();
    // Atualiza também a lista do técnico (Minhas OS) quando concluído pelo campo
    if(document.getElementById('page-minhas-os')?.classList.contains('on')) loadMinhasOS();
    toast('✅ OS concluída · estoque baixado automaticamente');
  }, 'Concluir OS');
}
// Física total do produto (todas as lojas) — base para o custo médio ponderado
function fisicaProdutoTotal(produtoId){
  return todosMovEstoque
    .filter(m=>m.produto_id===produtoId && _TIPOS_FISICOS.includes(m.tipo))
    .reduce((a,m)=>a+(parseFloat(m.quantidade)||0),0);
}
// Produtos visíveis no contexto de loja atual.
// Lojas do grupo Forthemp compartilham o mesmo catálogo de produtos;
// o estoque (movimentos) é individualizado por loja_id no movimento.
// Lojas fora do grupo (ex: Acquamotor) têm catálogo próprio.
function produtosVisiveis(){
  const ativos=todosProdutos.filter(p=>p.ativo!==false);
  if(!lojaAtiva) return filtrarPorLoja(ativos); // "Todas" → grupo
  const comMov=new Set(todosMovEstoque.filter(m=>(m.loja_id||'')===lojaAtiva).map(m=>m.produto_id));
  if(GRUPO_PRINCIPAL&&GRUPO_PRINCIPAL.includes(lojaAtiva)){
    // Catálogo compartilhado: mostra produtos de qualquer loja do grupo Forthemp
    return ativos.filter(p=>GRUPO_PRINCIPAL.includes(p.loja_id||'')||comMov.has(p.id));
  }
  // Loja isolada (Acquamotor etc.): só produtos próprios
  return ativos.filter(p=>(p.loja_id||'')===lojaAtiva||comMov.has(p.id));
}
// Produtos com disponível negativo = encomendas (vendido/comprometido sem estoque)
function listaEncomendas(){
  return produtosVisiveis()
    .map(p=>({p, falta: -disponivelProduto(p.id)}))
    .filter(x=>x.falta>0.0001)
    .sort((a,b)=>b.falta-a.falta);
}

// ── Custo médio ponderado (CMP): recalcula o custo do produto a cada entrada ──
function recomputarCMP(produtoId, qtdEntrada, custoEntrada, fisAntes){
  if(!(parseFloat(custoEntrada)>0)) return; // sem custo informado → mantém
  const p=produtoById(produtoId); if(!p) return;
  const qe=Math.abs(parseFloat(qtdEntrada)||0);
  const base=Math.max(0,fisAntes); // estoque negativo não entra no rateio
  const custoAtual=parseFloat(p.custo)||0;
  const novo=(base+qe)>0 ? (base*custoAtual + qe*parseFloat(custoEntrada))/(base+qe) : parseFloat(custoEntrada);
  p.custo=Math.round(novo*100)/100;
  const idx=todosProdutos.findIndex(x=>x.id===produtoId);
  if(idx>=0) todosProdutos[idx]=p;
  lsProdSalvar(todosProdutos);
  if(dbOk&&db){ (async()=>{ try{ const r=await _comTimeout(dbUpsert('produtos',p),20000,'cmp'); if(r&&r.error) console.warn('[cmp sync]',r.error.message); }catch(e){ console.warn('[cmp bg]',e?.message||e); } })(); }
}

// ── Transferência entre unidades (dois movimentos ligados, carregando o custo) ──
function transferirProduto(produtoId, qtd, lojaDestino, motivo){
  const p=produtoById(produtoId); if(!p) return false;
  const q=Math.abs(parseFloat(qtd)||0);
  if(q<=0) return false;
  const origem=lojaAtiva||p.loja_id||LOJA_PADRAO_ID;
  if(lojaDestino===origem) return false;
  const ref='transf:'+produtoId+':'+Date.now();
  registrarMovimento({produto_id:produtoId, tipo:'transf_saida', quantidade:-q, custo_unit:p.custo, motivo:'Transferência → '+getLojaNome(lojaDestino)+(motivo?' · '+motivo:''), ref:ref+':out', lojaId:origem});
  registrarMovimento({produto_id:produtoId, tipo:'transf_entrada', quantidade:q, custo_unit:p.custo, motivo:'Transferência ← '+getLojaNome(origem)+(motivo?' · '+motivo:''), ref:ref+':in', lojaId:lojaDestino});
  renderEstoque();
  return true;
}

// ── UI do estoque ──
function buscaEstoque(v){ estoqueBusca=(v||'').toLowerCase(); renderEstoque(); }
let estoqueFiltro='todos';
let estoqueCategoria='';
function filtEstoque(f){ estoqueFiltro=f; renderEstoque(); }
function filtCategoria(v){ estoqueCategoria=v; renderEstoque(); }
function toggleCategOutro(){
  const v=gV('prod-categoria');
  const wrap=document.getElementById('prod-catoutra-wrap');
  if(wrap) wrap.style.display=(v==='Outro')?'':'none';
}

// ── Analíticos de estoque ──
function giroProduto(pid, dias){ // total de SAÍDA (consumo) nos últimos N dias
  const lim=Date.now()-(dias||90)*86400000;
  return filtrarPorLoja(todosMovEstoque)
    .filter(m=>m.produto_id===pid && m.tipo==='saida' && new Date(m.data).getTime()>=lim)
    .reduce((a,m)=>a+Math.abs(parseFloat(m.quantidade)||0),0);
}
function consumoDia(pid){ return giroProduto(pid,90)/90; }
function diasParaRuptura(pid){ const c=consumoDia(pid); if(c<=0) return Infinity; const d=disponivelProduto(pid); return d<=0?0:d/c; }
function produtoParado(pid){
  if(fisicaProduto(pid)<=0) return false;
  if(giroProduto(pid,90)>0) return false;
  // Não marca como parado se o produto foi cadastrado/movimentado há menos de 90 dias
  const lim90=Date.now()-90*86400000;
  const movs=filtrarPorLoja(todosMovEstoque).filter(m=>m.produto_id===pid);
  if(!movs.length) return false; // sem nenhuma movimentação ainda
  const primeiraMov=Math.min(...movs.map(m=>new Date(m.data).getTime()));
  return primeiraMov<lim90; // só é "parado" se existe há mais de 90 dias sem girar
}
function ultimaMovData(pid){
  const ms=filtrarPorLoja(todosMovEstoque).filter(m=>m.produto_id===pid).map(m=>new Date(m.data).getTime());
  return ms.length?Math.max(...ms):0;
}
// Curva ABC por valor de consumo (saída × custo) nos últimos 180 dias
function curvaABC(){
  const prods=produtosVisiveis();
  const valor={};
  prods.forEach(p=>{ valor[p.id]=giroProduto(p.id,180)*(parseFloat(p.custo)||0); });
  const ordenados=prods.slice().sort((a,b)=>(valor[b.id]||0)-(valor[a.id]||0));
  const total=ordenados.reduce((a,p)=>a+(valor[p.id]||0),0)||1;
  let acc=0; const classe={};
  ordenados.forEach(p=>{ acc+=(valor[p.id]||0); const pct=acc/total; classe[p.id]= (valor[p.id]||0)<=0 ? 'C' : pct<=0.8?'A':pct<=0.95?'B':'C'; });
  return {valor, classe, ordenados, total};
}

// ══════════════════════════════════════════════════════════════════════════
//  VENDA RÁPIDA / BALCÃO (16/08) — portado do fluxa-app (v1), Tarefa 3e.3 lá.
//  Diferente de "Dar baixa" (1 produto, 1 motivo, sem cliente), isto é um
//  carrinho: N itens, vira UMA transação em `vendas_balcao` com cliente
//  (opcional) e alimenta o histórico do cliente. Tela cheia (sem sidebar/
//  header — ver toggle em go()), não modal — v1 já tinha migrado de modal
//  pra tela cheia antes de eu portar, então porto direto nesse formato.
//
//  ⚠️ Achado ao portar (setup-v2-delta30.sql): `registrarMovimento()` já
//  resolve loja_id sozinho (lojaId||lojaAtiva||produto.loja_id||padrão) —
//  não precisei trazer o `_lojaParaMovimento()` do v1, que só existia pra
//  achar a loja ANTES de chamar registrarMovimento. Aqui basta lojaAtiva
//  (ou null — o próprio registrarMovimento cobre a ausência).
// ══════════════════════════════════════════════════════════════════════════
let _vendaCarrinho=[];          // [{produto_id, nome, unidade, qtd, preco_unit, custo_unit}] — produto_id null = item livre (sem baixa de estoque)
let _vendaClienteSelecionado=null; // {id, nome} quando veio da busca — null se digitado à mão ou anônimo
let _vendaAnonimo=false;
let _vendaFormaPgto='';
let _vendaDesconto=0;
let _vbCategoriaAtiva='__maisvendidos__';

function abrirVendaBalcao(){ go('venda-balcao'); }
function _vbAbrir(){
  _vendaCarrinho=[]; _vendaClienteSelecionado=null; _vendaAnonimo=false;
  _vendaFormaPgto=''; _vendaDesconto=0; _vbCategoriaAtiva='__maisvendidos__';
  setV('venda-cli',''); setV('venda-busca','');
  document.querySelectorAll('.vb-pgto-btn').forEach(b=>b.classList.remove('on'));
  const sug=document.getElementById('venda-sugestoes'); if(sug) sug.innerHTML='';
  if(!todosProdutos.length) loadEstoque(); // garante catálogo carregado (vendas/técnico não passam por Estoque, que é gestor-only)
  _vbRenderGrade();
  _vendaRenderCarrinho();
  const s=getSessao();
  const lojaEl=document.getElementById('vb-topbar-loja');
  if(lojaEl) lojaEl.textContent = lojaAtiva ? getLojaNome(lojaAtiva) : (CFG.todasLabel||'Todas as unidades');
  const avEl=document.getElementById('vb-topbar-avatar');
  if(avEl) avEl.textContent = (s?.nome||'').trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase()||'—';
  setTimeout(()=>document.getElementById('venda-busca')?.focus(), 80);
  _vbRestaurarRascunho();
}
function fecharVendaBalcao(){ voltar(); }

function _vendaClienteEditado(){ _vendaClienteSelecionado=null; _vendaAnonimo=false; }
function _vendaSemCliente(){
  setV('venda-cli','Balcão (sem cliente identificado)');
  _vendaClienteSelecionado=null; _vendaAnonimo=true;
}

function _vbCategorias(){ return [...new Set(produtosVisiveis().map(p=>(p.categoria||'').trim()).filter(Boolean))].sort(); }
function _vbSetCategoria(cat){ _vbCategoriaAtiva=cat; _vbRenderGrade(); }
function _vbRenderGrade(){
  const tabsEl=document.getElementById('vb-tabs');
  if(tabsEl){
    const tabs=[['__maisvendidos__','Mais vendidos'], ...(_vbCategorias().map(c=>[c,c]))];
    tabsEl.innerHTML=tabs.map(([id,rot])=>`<button type="button" class="vb-tab${_vbCategoriaAtiva===id?' on':''}" onclick="_vbSetCategoria('${esc(id).replace(/'/g,"\\'")}')">${esc(rot)}</button>`).join('');
  }
  const el=document.getElementById('vb-grade'); if(!el) return;
  const lista = _vbCategoriaAtiva==='__maisvendidos__'
    ? curvaABC().ordenados.slice(0,16)
    : produtosVisiveis().filter(p=>(p.categoria||'').trim()===_vbCategoriaAtiva);
  if(!lista.length){ el.innerHTML='<div class="rd-empty" style="grid-column:1/-1;padding:24px"><div class="rd-empty-title">Nenhum produto aqui</div></div>'; return; }
  el.innerHTML=lista.map(p=>{
    const disp=disponivelProduto(p.id);
    const noCarrinho=_vendaCarrinho.find(i=>i.produto_id===p.id);
    const baixo = disp>0 && disp<=(parseFloat(p.estoque_minimo)||0);
    return `<button type="button" class="vb-card${noCarrinho?' on':''}${baixo?' vb-card-baixo':''}" onclick="_vendaAddItem('${p.id}')">
      <div class="vb-card-top"><span class="vb-card-nome">${esc(p.nome)}</span>${noCarrinho?`<span class="vb-card-badge">${fmtQtd(noCarrinho.qtd)}</span>`:''}</div>
      <span class="vb-card-sub${baixo?' vb-card-sub-baixo':''}">${p.codigo?esc(p.codigo)+' · ':''}${baixo?'só '+fmtQtd(disp)+' restam':fmtQtd(disp)+' em estoque'}</span>
      <span class="vb-card-preco">${brl(parseFloat(p.preco_venda)||0)}</span>
    </button>`;
  }).join('');
}

function vendaBuscarProduto(termo){
  const el=document.getElementById('venda-sugestoes'); if(!el) return;
  const t=(termo||'').trim();
  if(!t){ el.innerHTML=''; return; }
  // Código de barras: casa exato com o SKU e soma na hora, sem esperar Enter
  // — um leitor de código dispara oninput rápido demais pra confiar em
  // keydown, e "sem Enter" é o comportamento esperado de leitor de balcão.
  const exato=produtosVisiveis().find(p=>(p.codigo||'').toLowerCase()===t.toLowerCase());
  if(exato){ _vendaAddItem(exato.id); return; }
  if(t.length<2){ el.innerHTML=''; return; }
  const tl=t.toLowerCase();
  const achados=produtosVisiveis().filter(p=>
    (p.nome||'').toLowerCase().includes(tl) || (p.codigo||'').toLowerCase().includes(tl)
  ).slice(0,8);
  if(!achados.length){ el.innerHTML='<div style="font-size:12px;color:var(--tx3);padding:8px">Nenhum produto encontrado.</div>'; return; }
  el.innerHTML=achados.map(p=>{
    const disp=disponivelProduto(p.id);
    return `<button class="tb" style="display:block;width:100%;text-align:left;margin-bottom:5px;padding:9px 11px" onclick="_vendaAddItem('${p.id}')">
      <div style="font-weight:700;color:var(--c2);font-size:12.5px">${esc(p.nome)}</div>
      <div style="font-size:11px;color:var(--gray)">${p.codigo?esc(p.codigo)+' · ':''}tem ${fmtQtd(disp)} ${esc(p.unidade||'un')}${p.preco_venda?' · '+brl(p.preco_venda):''}</div>
    </button>`;
  }).join('');
}
function _vendaAddItem(pid){
  const p=produtoById(pid); if(!p) return;
  const ja=_vendaCarrinho.find(i=>i.produto_id===pid);
  if(ja){ ja.qtd=(parseFloat(ja.qtd)||0)+1; }
  else{
    _vendaCarrinho.push({
      produto_id:pid, nome:p.nome, unidade:p.unidade||'un',
      qtd:1, preco_unit:parseFloat(p.preco_venda)||0, custo_unit:parseFloat(p.custo)||0
    });
  }
  setV('venda-busca',''); const sug=document.getElementById('venda-sugestoes'); if(sug) sug.innerHTML='';
  _vendaRenderCarrinho();
  _vbRenderGrade(); // o card do produto ganha o contador de qtd no carrinho
  document.getElementById('venda-busca')?.focus();
}
function vendaRemoverItem(idx){ _vendaCarrinho.splice(idx,1); _vendaRenderCarrinho(); _vbRenderGrade(); }
function vendaAtualizarItem(idx, campo, val){
  const it=_vendaCarrinho[idx]; if(!it) return;
  it[campo]=parseFloat(String(val).replace(',','.'))||0;
  _vendaRenderCarrinho(true); // true: não perde o foco do campo que está sendo digitado
}
// Stepper +/- — alvo de 30px, pensado pro dedo, não pro mouse.
function _vendaMudarQtd(idx, delta){
  const it=_vendaCarrinho[idx]; if(!it) return;
  const novaQtd=(parseFloat(it.qtd)||0)+delta;
  if(novaQtd<=0){ _vendaCarrinho.splice(idx,1); } else { it.qtd=novaQtd; }
  _vendaRenderCarrinho();
  _vbRenderGrade();
}
function _vendaTotais(){
  const {total:subtotal, custo}=_vendaCarrinho.reduce((a,i)=>({
    total: a.total+(i.qtd*i.preco_unit),
    custo: a.custo+(i.qtd*i.custo_unit)
  }), {total:0, custo:0});
  const desconto=Math.min(_vendaDesconto||0, subtotal);
  return {subtotal, desconto, total:subtotal-desconto, custo};
}
function _vendaSetFormaPgto(f){
  _vendaFormaPgto = _vendaFormaPgto===f ? '' : f;
  document.querySelectorAll('.vb-pgto-btn').forEach(b=>b.classList.toggle('on', b.dataset.f===_vendaFormaPgto));
}
function _vendaAbrirDesconto(){
  abrirModal({id:'vb-desc-modal', corpo:`
    <h3>Desconto</h3>
    <div class="fl" style="margin:14px 0 4px"><label>Valor do desconto (R$)</label><input type="text" inputmode="decimal" id="vb-desc-valor" value="${_vendaDesconto?String(_vendaDesconto).replace('.',','):''}"></div>
    <div class="rd-modal-acts">
      <button class="rd-modal-btn rd-modal-btn-nao" onclick="fecharModalGenerico('vb-desc-modal')">Cancelar</button>
      <button class="rd-modal-btn rd-modal-btn-sim" onclick="_vendaConfirmarDesconto()">Aplicar</button>
    </div>`});
}
function _vendaConfirmarDesconto(){
  _vendaDesconto=Math.max(0, parseFloat((gV('vb-desc-valor')||'').replace(',','.'))||0);
  fecharModalGenerico('vb-desc-modal');
  _vendaRenderCarrinho();
}
// Item fora do catálogo — entra na venda, nunca dá baixa de estoque
// (produto_id fica null; confirmarVendaBalcao() pula esses no laço de
// registrarMovimento).
function _vendaAbrirItemLivre(){
  abrirModal({id:'vb-livre-modal', corpo:`
    <h3>Item que não está no catálogo</h3>
    <p class="rd-modal-sub">Entra na venda sem baixa de estoque.</p>
    <div class="fl" style="margin:14px 0 10px"><label>Descrição</label><input type="text" id="vb-livre-desc" placeholder="Ex: Serviço avulso"></div>
    <div class="fl" style="margin-bottom:4px"><label>Valor (R$)</label><input type="text" inputmode="decimal" id="vb-livre-valor" placeholder="0,00"></div>
    <div class="rd-modal-acts">
      <button class="rd-modal-btn rd-modal-btn-nao" onclick="fecharModalGenerico('vb-livre-modal')">Cancelar</button>
      <button class="rd-modal-btn rd-modal-btn-sim" onclick="_vendaConfirmarItemLivre()">Adicionar</button>
    </div>`});
}
function _vendaConfirmarItemLivre(){
  const desc=(gV('vb-livre-desc')||'').trim();
  const valor=parseFloat((gV('vb-livre-valor')||'').replace(',','.'))||0;
  if(!desc||valor<=0){ toast('Preencha descrição e valor'); return; }
  fecharModalGenerico('vb-livre-modal');
  _vendaCarrinho.push({produto_id:null, nome:desc, unidade:'un', qtd:1, preco_unit:valor, custo_unit:0});
  _vendaRenderCarrinho();
}
function _vendaRenderCarrinho(soTotais){
  const {subtotal, desconto, total}=_vendaTotais();
  const contEl=document.getElementById('venda-cont');
  if(contEl) contEl.textContent = _vendaCarrinho.length ? `${_vendaCarrinho.length} ${_vendaCarrinho.length!==1?'itens':'item'} · ${fmtQtd(_vendaCarrinho.reduce((a,i)=>a+(parseFloat(i.qtd)||0),0))} unidades` : 'carrinho vazio';
  const subEl=document.getElementById('venda-subtotal'); if(subEl) subEl.textContent=brl(subtotal);
  const descLinha=document.getElementById('venda-desconto-linha');
  if(descLinha) descLinha.style.display = desconto>0 ? 'flex' : 'none';
  const descEl=document.getElementById('venda-desconto-val'); if(descEl) descEl.textContent='− '+brl(desconto);
  const totEl=document.getElementById('venda-total'); if(totEl) totEl.textContent=brl(total);
  if(soTotais) return; // evita re-renderizar as linhas e perder o foco do input enquanto digita
  const el=document.getElementById('venda-carrinho'); if(!el) return;
  if(!_vendaCarrinho.length){ el.innerHTML='<div class="rd-empty" style="padding:24px 12px"><div class="rd-empty-title" style="font-size:13px">Carrinho vazio</div><div class="rd-empty-sub">Toque num produto à esquerda ou leia o código de barras.</div></div>'; return; }
  el.innerHTML = _vendaCarrinho.map((i,idx)=>`
    <div class="vb-item">
      <div class="vb-item-tx">
        <span class="vb-item-nome">${esc(i.nome)}</span>
        <span class="vb-item-sub">${fmtQtd(i.qtd)} × ${brl(i.preco_unit)}</span>
      </div>
      <div class="vb-item-stepper">
        <button type="button" class="vb-step" onclick="_vendaMudarQtd(${idx},-1)" aria-label="Diminuir">−</button>
        <span class="vb-step-qtd">${fmtQtd(i.qtd)}</span>
        <button type="button" class="vb-step" onclick="_vendaMudarQtd(${idx},1)" aria-label="Aumentar">+</button>
      </div>
      <div class="vb-item-val">${brl(i.qtd*i.preco_unit)}</div>
    </div>`).join('');
}

async function confirmarVendaBalcao(){
  if(!_vendaCarrinho.length){ toast('Adicione ao menos um produto'); return; }
  const {total, custo}=_vendaTotais();
  const clienteNome=(gV('venda-cli')||'').trim();
  const s=getSessao();
  // dados SEM id: vendas_balcao.id é uuid gerado pelo banco (mesmo padrão
  // de despesas/equipamentos — mandar id texto local derruba o insert
  // inteiro em silêncio). valor_total já é líquido do desconto — não existe
  // coluna própria de desconto no schema.
  const dados={
    loja_id:lojaAtiva||null,
    cliente_id:_vendaClienteSelecionado?.id||null,
    cliente_nome:clienteNome||(_vendaAnonimo?'Balcão (sem cliente identificado)':null),
    itens:_vendaCarrinho.map(i=>({produto_id:i.produto_id,nome:i.nome,qtd:i.qtd,preco_unit:i.preco_unit,custo_unit:i.custo_unit})),
    valor_total:total, custo_total:custo,
    forma_pagamento:_vendaFormaPgto||null,
    vendedor:s?.nome||'',
    observacao:null,
    data_criacao:new Date().toISOString()
  };
  const btn=document.getElementById('venda-btn');
  if(btn){ btn.disabled=true; btn.textContent='Registrando…'; }
  const vendaIdRef='venda_'+Date.now(); // só pra referenciar nos movimentos de estoque — não é o id real da venda
  _vendaCarrinho.forEach(i=>{
    if(!i.produto_id) return; // item livre — sem baixa de estoque
    registrarMovimento({
      produto_id:i.produto_id, tipo:'saida', quantidade:-Math.abs(i.qtd),
      custo_unit:i.custo_unit,
      motivo:'Venda balcão'+(clienteNome?' — '+clienteNome:''),
      ref:'venda:'+vendaIdRef+':'+i.produto_id,
      lojaId:lojaAtiva||null
    });
  });
  todasVendasBalcao.unshift({...dados, id:vendaIdRef});
  lsVendaSalvar(todasVendasBalcao);
  if(dbOk&&db){
    try{
      const {data:ins}=await dbInsert('vendas_balcao', dados);
      if(ins){ todasVendasBalcao=todasVendasBalcao.filter(x=>x.id!==vendaIdRef); todasVendasBalcao.unshift(ins); lsVendaSalvar(todasVendasBalcao); }
    }catch(e){ console.warn('[confirmarVendaBalcao]', e?.message||e); toast('Venda registrada aqui, mas não sincronizou ainda', {tipo:'warn'}); }
  }
  if(btn){ btn.disabled=false; btn.textContent='Finalizar venda'; }
  lsDel(LS_VB_RASCUNHO); // R-3: escopado por empresa, igual ao lsSet que grava
  toast(`Venda de ${brl(total)} registrada${clienteNome&&!_vendaAnonimo?' — '+clienteNome:''}`, {tipo:'ok'});
  if(typeof renderEstoque==='function' && document.getElementById('page-estoque')?.classList.contains('on')) renderEstoque();
  _vbAbrir(); // limpa o carrinho e mantém na tela — o próximo cliente já está esperando
}

// Reenvia vendas de balcão presas só no aparelho — mesmo padrão de
// _reenviarDespesasLocais. Sem trava de "em voo": confirmarVendaBalcao() já faz
// o insert com await direto (não é fire-and-forget).
async function _reenviarVendasBalcaoLocais(soLocal){
  if(!dbOk||!db||!soLocal||!soLocal.length) return false;
  let mudou=false;
  for(const rec of soLocal){
    try{
      const payload={...rec}; delete payload.id;
      const {data:ins,error}=await dbInsert('vendas_balcao', payload);
      if(error){ console.warn('[reenvioVendaLocal] falhou:', error.message); continue; }
      if(ins){ todasVendasBalcao=todasVendasBalcao.filter(x=>x.id!==rec.id); todasVendasBalcao.unshift(ins); mudou=true; }
    }catch(e){ console.warn('[reenvioVendaLocal] erro:', e?.message||e); }
  }
  if(mudou) lsVendaSalvar(todasVendasBalcao);
  return mudou;
}
// "Salvar" NÃO é sinônimo de "Finalizar venda". Não existe no schema um
// conceito de venda pendente/rascunho, então "Salvar" não pode gravar em
// `vendas_balcao` nem dar baixa de estoque — isso é o que "Finalizar venda"
// faz, e os dois fariam a mesma coisa duas vezes se clicados em sequência.
// Em vez disso, guarda o carrinho em localStorage — sobrevive a um F5/queda
// de conexão no meio do atendimento, sem tocar em banco nem estoque.
const LS_VB_RASCUNHO='fluxa_venda_balcao_rascunho';
function vendaSalvarRascunho(){
  if(!_vendaCarrinho.length){ toast('Carrinho vazio — nada para salvar'); return; }
  try{
    lsSet(LS_VB_RASCUNHO, JSON.stringify({
      carrinho:_vendaCarrinho, clienteNome:gV('venda-cli')||'',
      clienteSelecionado:_vendaClienteSelecionado, anonimo:_vendaAnonimo,
      formaPgto:_vendaFormaPgto, desconto:_vendaDesconto, salvoEm:new Date().toISOString()
    }));
    toast('Rascunho salvo neste aparelho', {tipo:'ok'});
  }catch(e){ console.warn('[vendaSalvarRascunho]', e?.message||e); }
}
function _vbRestaurarRascunho(){
  let r; try{ r=JSON.parse(ls(LS_VB_RASCUNHO)||'null'); }catch(e){ r=null; }
  if(!r || !r.carrinho?.length) return;
  confirmar({
    titulo:'Retomar venda em aberto?',
    msg:`Tem um carrinho salvo neste aparelho (${r.carrinho.length} ite${r.carrinho.length!==1?'ns':'m'}) que ainda não foi finalizado.`,
    labelSim:'Retomar', labelNao:'Começar do zero',
    onSim:()=>{
      _vendaCarrinho=r.carrinho; _vendaClienteSelecionado=r.clienteSelecionado||null; _vendaAnonimo=!!r.anonimo;
      _vendaFormaPgto=r.formaPgto||''; _vendaDesconto=r.desconto||0;
      setV('venda-cli', r.clienteNome||'');
      document.querySelectorAll('.vb-pgto-btn').forEach(b=>b.classList.toggle('on', b.dataset.f===_vendaFormaPgto));
      _vendaRenderCarrinho(); _vbRenderGrade();
    },
    onNao:()=>{ lsDel(LS_VB_RASCUNHO); }
  });
}

let todasVendasBalcao=[];
function lsVendaLer(){ try{ return JSON.parse(ls('fluxa_vendas_balcao')||'[]'); }catch(e){ return []; } }
function lsVendaSalvar(lista){ lsSet('fluxa_vendas_balcao', JSON.stringify(lista)); }
async function loadVendasBalcao(){
  todasVendasBalcao=lsVendaLer();
  if(!dbOk||!db) return;
  try{
    const {data}=await db.from('vendas_balcao').select('*').order('data_criacao',{ascending:false}).limit(3000);
    if(data){
      // MERGE (não sobrescreve) — mesmo achado do loadDespesas/loadEquipamentos
      // (17/08): a troca direta apagava em silêncio qualquer venda salva local
      // ("venda_...") ainda não sincronizada.
      const idsDb=new Set(data.map(x=>x.id));
      const soLocal=todasVendasBalcao.filter(x=>String(x.id).startsWith('venda_')&&!idsDb.has(x.id));
      todasVendasBalcao=[...data,...soLocal];
      lsVendaSalvar(todasVendasBalcao);
      if(soLocal.length) await _reenviarVendasBalcaoLocais(soLocal);
    }
  }catch(e){ console.warn('[loadVendasBalcao]', e?.message||e); }
}

// Status de validade de um produto (para químicos como cloro).
// Retorna null se não tem validade; senão {txt, cor, bg, vencido, dias}.
function _validadeInfo(dateStr){
  if(!dateStr) return null;
  const val=new Date(dateStr+'T00:00:00'); if(isNaN(val)) return null;
  const hoje=new Date((typeof _hojeLocal==='function'?_hojeLocal():new Date().toISOString().slice(0,10))+'T00:00:00');
  const dias=Math.round((val-hoje)/86400000);
  if(dias<0)  return {txt:'⛔ Vencido', cor:'#b91c1c', bg:'#fee2e2', vencido:true, dias};
  if(dias<=30) return {txt:`⏳ Vence em ${dias}d`, cor:'#92400e', bg:'#fef3c7', vencido:false, dias};
  return {txt:`📅 Val ${val.toLocaleDateString('pt-BR')}`, cor:'#475569', bg:'#f1f5f9', vencido:false, dias};
}
// Produto com validade vencida ou vencendo em ≤30 dias
function produtoVencendo(p){ const i=_validadeInfo(p&&p.validade); return !!i && i.dias<=30; }

function renderEstoque(){
  const body=document.getElementById('estoque-body'); if(!body) return;
  const todos=produtosVisiveis(); // ativos da loja
  const inativos=produtosVisiveisInativos();
  const enc=listaEncomendas();
  const repor=todos.filter(p=>{ const m=parseFloat(p.estoque_minimo)||0; const d=disponivelProduto(p.id); return m>0 && d>=0 && d<=m; });
  const parados=todos.filter(p=>produtoParado(p.id));
  const vencendo=todos.filter(produtoVencendo);
  const abc=curvaABC();

  // ── KPIs ──
  const valorEstoque=todos.reduce((a,p)=>a+(Math.max(0,fisicaProduto(p.id))*(parseFloat(p.custo)||0)),0);
  const valorReservado=todos.reduce((a,p)=>a+(Math.max(0,reservadoProduto(p.id))*(parseFloat(p.custo)||0)),0);
  const valorEncomenda=enc.reduce((a,x)=>a+(x.falta*(parseFloat(x.p.custo)||0)),0);
  const valorParado=parados.reduce((a,p)=>a+(Math.max(0,fisicaProduto(p.id))*(parseFloat(p.custo)||0)),0);
  // Padrão .rd-card/.rd-kpi-* (portado do v1, 16/08) — mesmos cálculos,
  // só o container mudou.
  const kpis=document.getElementById('estoque-kpis');
  if(kpis) kpis.innerHTML=`
    <div class="rd-card rd-card-dense rd-card-dark">
      <div class="rd-kpi-lbl">Valor em estoque</div>
      <div class="rd-kpi-num rd-kpi-num-sm">${brl(valorEstoque)}</div>
      <div class="rd-kpi-apoio">${todos.length} produto${todos.length!==1?'s':''}</div>
    </div>
    <div class="rd-card rd-card-dense" style="cursor:pointer" onclick="filtEstoque('comprar')">
      <div class="rd-kpi-lbl"><span class="rd-badge ${enc.length?'rd-badge-bad':'rd-badge-ok'}">A comprar</span></div>
      <div class="rd-kpi-num rd-kpi-num-sm" style="color:${enc.length?'var(--bad)':'var(--ok)'}">${enc.length}</div>
      <div class="rd-kpi-apoio">${brl(valorEncomenda)}</div>
    </div>
    <div class="rd-card rd-card-dense" style="cursor:pointer" onclick="filtEstoque('repor')">
      <div class="rd-kpi-lbl"><span class="rd-badge rd-badge-warn">Repor (mínimo)</span></div>
      <div class="rd-kpi-num rd-kpi-num-sm" style="color:var(--warn)">${repor.length}</div>
      <div class="rd-kpi-apoio">abaixo do mínimo</div>
    </div>
    <div class="rd-card rd-card-dense" style="cursor:pointer" onclick="filtEstoque('parados')">
      <div class="rd-kpi-lbl"><span class="rd-badge rd-badge-info">Capital parado</span></div>
      <div class="rd-kpi-num rd-kpi-num-sm" style="color:var(--info)">${brl(valorParado)}</div>
      <div class="rd-kpi-apoio">${parados.length} sem giro (90d)</div>
    </div>
    ${vencendo.length?`<div class="rd-card rd-card-dense" style="cursor:pointer" onclick="filtEstoque('validade')">
      <div class="rd-kpi-lbl"><span class="rd-badge rd-badge-bad">Validade</span></div>
      <div class="rd-kpi-num rd-kpi-num-sm" style="color:var(--bad)">${vencendo.length}</div>
      <div class="rd-kpi-apoio">vencendo/vencido</div>
    </div>`:''}`;

  // ── Abas de filtro ──
  const tabs=[
    ['todos','Todos',todos.length],
    ['comprar','📥 A comprar',enc.length],
    ['repor','🔄 Repor',repor.length],
    ['parados','💤 Parados',parados.length],
    ['validade','⏳ Validade',vencendo.length],
    ['inativos','🚫 Inativos',inativos.length],
  ];
  const tabsEl=document.getElementById('estoque-tabs');
  if(tabsEl) tabsEl.innerHTML=tabs.map(([k,lbl,n])=>`<button class="fb ${estoqueFiltro===k?'on':''}" onclick="filtEstoque('${k}')">${lbl}${n?` <span style="opacity:.7">${n}</span>`:''}</button>`).join('');

  // ── Lista filtrada + ordenada ──
  let lista = estoqueFiltro==='inativos' ? inativos.slice()
    : estoqueFiltro==='comprar' ? enc.map(x=>x.p)
    : estoqueFiltro==='repor' ? repor.slice()
    : estoqueFiltro==='parados' ? parados.slice()
    : estoqueFiltro==='validade' ? vencendo.slice()
    : todos.slice();
  if(estoqueBusca) lista=lista.filter(p=>(p.nome||'').toLowerCase().includes(estoqueBusca)||(p.codigo||'').toLowerCase().includes(estoqueBusca));
  if(estoqueCategoria) lista=lista.filter(p=>(p.categoria||'')===estoqueCategoria);
  const sort=document.getElementById('estoque-sort')?.value||'nome';
  lista.sort((a,b)=>{
    if(sort==='valor') return (Math.max(0,fisicaProduto(b.id))*(parseFloat(b.custo)||0))-(Math.max(0,fisicaProduto(a.id))*(parseFloat(a.custo)||0));
    if(sort==='disp') return disponivelProduto(a.id)-disponivelProduto(b.id);
    if(sort==='giro') return giroProduto(b.id,90)-giroProduto(a.id,90);
    return (a.nome||'').localeCompare(b.nome||'');
  });

  if(!lista.length){
    body.innerHTML=`<div class="empty-st"><div class="ei">📦</div><p>${estoqueBusca?'Nenhum produto encontrado.':estoqueFiltro==='todos'?'Nenhum produto cadastrado ainda.':'Nada neste filtro. 🎉'}</p>${estoqueFiltro==='todos'?'<button class="btn-primary" style="margin-top:12px" onclick="abrirProdutoModal()">＋ Cadastrar produto</button>':''}</div>`;
  } else {
    const ehInativo=estoqueFiltro==='inativos';
    let h=`<div class="est-list">`;
    lista.forEach(p=>{
      const fis=fisicaProduto(p.id), res=reservadoProduto(p.id), disp=disponivelProduto(p.id);
      const min=parseFloat(p.estoque_minimo)||0;
      const preco=parseFloat(p.preco_venda)||0, custo=parseFloat(p.custo)||0;
      const encomenda=disp<0;
      const baixo=!encomenda && min>0 && disp<=min;
      const forn=todosFornecedores.find(f=>f.id===p.fornecedor_id);
      const pp=pontoDePedido(p.id);
      const precisaRepor=!encomenda && pp>0 && disp<=pp;

      // Ponto colorido + badge status
      let dotCor='#22c55e', badge='';
      if(!ehInativo){
        if(encomenda){         dotCor='#ef4444'; badge=`<span class="est-badge" style="background:#fee2e2;color:#b91c1c">📥 Pedir</span>`; }
        else if(baixo){        dotCor='#f59e0b'; badge=`<span class="est-badge" style="background:#fef3c7;color:#92400e">⚠️ Baixo</span>`; }
        else if(precisaRepor){ dotCor='#eab308'; badge=`<span class="est-badge" style="background:#fef9c3;color:#713f12">🔄 Repor</span>`; }
        else if(produtoParado(p.id)){ dotCor='#94a3b8'; badge=`<span class="est-badge" style="background:#f1f5f9;color:#475569">💤 Parado</span>`; }
        else { badge=`<span class="est-badge" style="background:#dcfce7;color:#15803d">✅ OK</span>`; }
      }

      // Meta: código, fornecedor, badge
      const categBadge=p.categoria?`<span style="background:#e0f2fe;color:#0369a1;padding:1px 7px;border-radius:50px;font-size:10px;font-weight:700;white-space:nowrap">${esc(p.categoria)}</span>`:'';
      const valInfo=_validadeInfo(p.validade);
      const validadeBadge=valInfo?`<span class="est-badge" style="background:${valInfo.bg};color:${valInfo.cor}"${p.lote?` title="Lote: ${esc(p.lote)}"`:''}>${valInfo.txt}${p.lote?' · '+esc(p.lote):''}</span>`:'';
      const metaParts=[
        p.codigo?`<span>Cód: ${esc(p.codigo)}</span>`:'',
        forn?`<span>🏭 ${esc(forn.nome)}</span>`:'',
        categBadge,
        badge,
        validadeBadge,
      ].filter(Boolean).join('');

      // Insight de valores
      const capitalEstoque=Math.max(0,fis)*custo;
      const priceParts=[];
      if(preco>0) priceParts.push(`Venda: <strong>${brl(preco)}</strong>`);
      if(custo>0) priceParts.push(`Custo: <strong>${brl(custo)}</strong>`);
      if(capitalEstoque>0) priceParts.push(`Capital: <strong>${brl(capitalEstoque)}</strong>`);
      const pricesHtml=priceParts.length?`<div class="est-prices">${priceParts.join(' · ')}</div>`:'';

      // Por loja — sempre visível para lojas do grupo Forthemp
      let porLoja='';
      if(GRUPO_PRINCIPAL&&GRUPO_PRINCIPAL.length>1&&(!lojaAtiva||GRUPO_PRINCIPAL.includes(lojaAtiva))){
        const spl=_saldoPorLoja(p.id);
        porLoja=`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">`+LOJAS.filter(l=>GRUPO_PRINCIPAL.includes(l.id)).map(l=>{
          const s=spl[l.id]||{fisico:0,reservado:0}; const d=s.fisico-s.reservado;
          const isAtiva=l.id===lojaAtiva;
          return `<span class="loja-badge ${l.cor}" style="font-size:10px${isAtiva?';outline:2px solid currentColor;outline-offset:1px':''}">${esc(l.nome)}: <strong style="color:${d<0?'#b91c1c':d===0?'var(--gray)':'inherit'}">${fmtQtd(d)}</strong></span>`;
        }).join('')+`</div>`;
      }

      // Qtd
      const qtdCor=encomenda?'#ef4444':baixo?'#d97706':'var(--c2)';
      const detQtd=res>0?`<div class="est-qty-d">Fís:${fmtQtd(fis)} Res:${fmtQtd(res)}</div>`:'';

      // Botões — todos visíveis, sem menu ⋮
      const btns=ehInativo
        ? `<div class="est-acts-row"><button class="eb ein" onclick="reativarProduto('${p.id}')">↺ Reativar</button></div>`
        : `<div class="est-acts-row">
             <button class="eb ein" onclick="abrirMovModal('${p.id}','entrada')" title="Registrar entrada de mercadoria">＋ Entrada</button>
             <button class="eb eout" onclick="abrirMovModal('${p.id}','saida')" title="Registrar saída">− Saída</button>
           </div>
           <div class="est-acts-row">
             <button class="eb eico edit" onclick="abrirProdutoModal('${p.id}')" title="Editar produto">✏️ Editar</button>
             <button class="eb eico fix" onclick="abrirMovModal('${p.id}','ajuste')" title="Corrigir saldo / Inventário">⚖️ Corrigir</button>
             ${LOJAS.length>1?`<button class="eb eico trf" onclick="abrirTransfModal('${p.id}')" title="Transferir para outra unidade">🔄 Transf.</button>`:''}
             <button class="eb ehist" onclick="abrirHistProduto('${p.id}')" title="Ver histórico de movimentos">📜</button>
           </div>`;

      h+=`<div class="est-item"${ehInativo?' style="opacity:.5"':''}>
        <div class="est-dot" style="background:${dotCor}"></div>
        <div class="est-main">
          <div class="est-nome">${esc(p.nome)}</div>
          <div class="est-meta">${metaParts}</div>
          ${pricesHtml}${porLoja}
        </div>
        <div class="est-qty-col">
          <div class="est-qty-n" style="color:${qtdCor}">${fmtQtd(disp)}</div>
          <div class="est-qty-u">${esc(p.unidade||'un')}</div>
          ${detQtd}
        </div>
        <div class="est-acts">${btns}</div>
      </div>`;
    });
    h+=`</div>`;
    body.innerHTML=h;
  }

  // ── Alerta resumido (encomendas + repor) ──
  const al=document.getElementById('estoque-alerta');
  if(al){
    let aviso='';
    if(enc.length) aviso+=`<div style="color:#b91c1c"><strong>📥 ${enc.length} para comprar:</strong> `+enc.slice(0,5).map(x=>`${esc(x.p.nome)} (faltam ${fmtQtd(x.falta)})`).join(' · ')+(enc.length>5?' …':'')+`</div>`;
    if(repor.length) aviso+=`<div style="margin-top:${enc.length?'6px':'0'}"><strong>🔄 ${repor.length} para repor:</strong> `+repor.slice(0,5).map(p=>`${esc(p.nome)} (${fmtQtd(disponivelProduto(p.id))})`).join(' · ')+(repor.length>5?' …':'')+`</div>`;
    al.style.display=aviso?'':'none'; al.innerHTML=aviso;
  }
  renderInsightsEstoque(abc, parados);
  renderGiroEstoque();
  renderMovEstoque();
}
function fmtQtd(n){ const v=parseFloat(n)||0; return Number.isInteger(v)?String(v):v.toFixed(2).replace('.',','); }

// Giro: produtos que mais SAÍRAM nos últimos 90 dias (curva ABC simplificada)
function renderGiroEstoque(){
  const card=document.getElementById('estoque-giro-card');
  const body=document.getElementById('estoque-giro-body');
  if(!card||!body) return;
  const lim=Date.now()-90*24*3600*1000;
  const saidas={};
  filtrarPorLoja(todosMovEstoque).forEach(m=>{
    if(m.tipo!=='saida') return;
    if(new Date(m.data).getTime()<lim) return;
    saidas[m.produto_id]=(saidas[m.produto_id]||0)+Math.abs(parseFloat(m.quantidade)||0);
  });
  const rank=Object.entries(saidas).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(!rank.length){ card.style.display='none'; return; }
  card.style.display='';
  const max=rank[0][1]||1;
  body.innerHTML=rank.map(([pid,q])=>{
    const p=produtoById(pid);
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600;color:var(--c2);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p?p.nome:'(produto removido)')}</div>
        <div style="height:6px;background:var(--gray-light);border-radius:50px;overflow:hidden"><div style="height:100%;background:var(--c1);border-radius:50px;width:${Math.round(q/max*100)}%"></div></div>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--c2);min-width:48px;text-align:right">${fmtQtd(q)} ${esc(p?.unidade||'')}</div>
    </div>`;
  }).join('');
}

// Produtos inativos visíveis na loja
function produtosVisiveisInativos(){
  const inativos=todosProdutos.filter(p=>p.ativo===false);
  if(!lojaAtiva) return filtrarPorLoja(inativos);
  const comMov=new Set(todosMovEstoque.filter(m=>(m.loja_id||'')===lojaAtiva).map(m=>m.produto_id));
  return inativos.filter(p=>(p.loja_id||'')===lojaAtiva || comMov.has(p.id));
}

// Insights: curva ABC, previsão de ruptura e capital parado
function _metricsLoja(lojaId){
  const ativos=(todosProdutos||[]).filter(p=>p.ativo!==false);
  // Forthemp: catálogo compartilhado entre as lojas do grupo
  const ehGrupo=GRUPO_PRINCIPAL&&GRUPO_PRINCIPAL.includes(lojaId);
  const prods=ehGrupo
    ? ativos.filter(p=>GRUPO_PRINCIPAL.includes(p.loja_id||''))
    : ativos.filter(p=>(p.loja_id||'')===lojaId);
  const movs=(todosMovEstoque||[]).filter(m=>(m.loja_id||'')===lojaId);
  const lim90=Date.now()-90*86400000;
  let encomendar=0,repor=0,parad=0,valorTotal=0;
  prods.forEach(p=>{
    const mvProd=movs.filter(m=>m.produto_id===p.id);
    const fis=mvProd.reduce((a,m)=>a+parseFloat(m.quantidade||0),0);
    const disp=fis; // simplificado (sem reservas neste resumo)
    const min=parseFloat(p.estoque_minimo)||0;
    valorTotal+=Math.max(0,fis)*(parseFloat(p.custo)||0);
    if(disp<0) encomendar++;
    else if(min>0&&disp<=min) repor++;
    const saidas90=mvProd.filter(m=>m.tipo==='saida'&&new Date(m.data).getTime()>=lim90).length;
    const prim=mvProd.length?Math.min(...mvProd.map(m=>new Date(m.data).getTime())):Infinity;
    if(fis>0&&saidas90===0&&prim<lim90) parad++;
  });
  return {count:prods.length,valor:valorTotal,encomendar,repor,parad};
}

function renderInsightsEstoque(abc, parados){
  const el=document.getElementById('estoque-insights'); if(!el) return;
  const prods=produtosVisiveis();
  const cnt={A:0,B:0,C:0}; prods.forEach(p=>{ cnt[abc.classe[p.id]||'C']++; });
  const ruptura=prods.filter(p=>{ const d=diasParaRuptura(p.id); return d!==Infinity && d<=14; })
    .map(p=>({p,d:diasParaRuptura(p.id)})).sort((a,b)=>a.d-b.d).slice(0,6);
  let h='';

  // ── Comparativo entre lojas (só quando gestor vê todas as lojas) ──
  if(isMainGestor()&&!lojaAtiva&&GRUPO_PRINCIPAL&&GRUPO_PRINCIPAL.length>1){
    const lojasGrupo=LOJAS.filter(l=>GRUPO_PRINCIPAL.includes(l.id));
    if(lojasGrupo.length>1){
      const dados=lojasGrupo.map(l=>({l,m:_metricsLoja(l.id)}));
      const row=(label,vals,fn)=>`<tr><td style="font-size:12px;color:var(--gray);padding:6px 0 6px 0;border-bottom:1px solid var(--gray-light);white-space:nowrap">${label}</td>${vals.map(({l,m})=>`<td style="text-align:right;font-size:13px;font-weight:600;padding:6px 0 6px 12px;border-bottom:1px solid var(--gray-light)">${fn(m,l)}</td>`).join('')}</tr>`;
      h+=`<div class="card" style="border:2px solid var(--c1-light)">
        <div class="ct">🏪 Comparativo entre lojas</div>
        <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;font-size:11px;color:var(--gray);font-weight:600;padding-bottom:8px;border-bottom:2px solid var(--c1-light)">Indicador</th>
            ${dados.map(({l})=>`<th style="text-align:right;font-size:12px;font-weight:700;color:var(--c1);padding-bottom:8px;border-bottom:2px solid var(--c1-light);padding-left:12px">${esc(l.nome)}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${row('Produtos ativos',dados,m=>m.count)}
            ${row('Capital em estoque',dados,m=>brl(m.valor))}
            ${row('📥 Precisam ser comprados',dados,m=>m.encomendar>0?`<span style="color:var(--red);font-weight:700">${m.encomendar}</span>`:'<span style="color:var(--green)">0</span>')}
            ${row('🔄 Abaixo do mínimo',dados,m=>m.repor>0?`<span style="color:#92400e;font-weight:700">${m.repor}</span>`:'<span style="color:var(--green)">0</span>')}
            ${row('💤 Sem giro (90d)',dados,m=>m.parad>0?`<span style="color:#1d4ed8">${m.parad}</span>`:'<span style="color:var(--green)">0</span>')}
          </tbody>
        </table>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          ${dados.map(({l})=>`<button onclick="trocarLojaAtiva('${l.id}')" class="btn-sec" style="font-size:12px;padding:6px 14px;flex:1">Ver estoque: ${esc(l.nome)} →</button>`).join('')}
        </div>
      </div>`;
    }
  }
  h+=`<div class="card"><div class="ct">📈 Curva ABC (por consumo)</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${[['A','#16a34a','vital — não deixe faltar'],['B','#d97706','intermediário'],['C','#6b7280','baixo giro']].map(([c,cor,desc])=>`<div style="flex:1;min-width:130px;border:1.5px solid ${cor}55;border-radius:10px;padding:10px 12px"><div style="font-size:13px;font-weight:800;color:${cor}">Classe ${c}<span style="float:right">${cnt[c]}</span></div><div style="font-size:11px;color:var(--gray);margin-top:2px">${desc}</div></div>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--gray);margin-top:8px">A classe A concentra ~80% do consumo — priorize compra e nunca deixe faltar.</div>
  </div>`;
  h+=_insightsPontoDePedido(prods);
  h+=_insightsMargem(prods);
  if(ruptura.length){
    h+=`<div class="card"><div class="ct">⏳ Vão acabar em breve</div>${ruptura.map(x=>{
      const d=x.d, dtxt=d<=0?'esgotado':Math.round(d)+' dias';
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)"><div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(x.p.nome)}</div><div style="font-size:11px;color:var(--gray)">disp. ${fmtQtd(disponivelProduto(x.p.id))} · consumo ~${fmtQtd(Math.round(consumoDia(x.p.id)*30))}/mês</div></div><div style="font-size:12px;font-weight:700;color:${d<7?'var(--red)':'var(--yellow)'};white-space:nowrap;text-align:right">${dtxt}<br><button class="tb g" style="font-size:10px;margin-top:2px" onclick="abrirMovModal('${x.p.id}','entrada')">comprar</button></div></div>`;
    }).join('')}</div>`;
  }
  if(parados.length){
    const ord=parados.slice().sort((a,b)=>(Math.max(0,fisicaProduto(b.id))*(parseFloat(b.custo)||0))-(Math.max(0,fisicaProduto(a.id))*(parseFloat(a.custo)||0))).slice(0,6);
    h+=`<div class="card"><div class="ct">💤 Capital parado (sem giro 90d)</div>${ord.map(p=>{
      const ult=ultimaMovData(p.id); const dias=ult?Math.round((Date.now()-ult)/86400000):null;
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)"><div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(p.nome)}</div><div style="font-size:11px;color:var(--gray)">${fmtQtd(fisicaProduto(p.id))} em estoque${dias!=null?' · última mov. há '+dias+'d':''}</div></div><div style="font-size:12px;font-weight:700;color:var(--c2);white-space:nowrap">${brl(Math.max(0,fisicaProduto(p.id))*(parseFloat(p.custo)||0))}</div></div>`;
    }).join('')}<div style="font-size:11px;color:var(--gray);padding-top:8px">Dinheiro parado — avalie promoção, uso interno ou não recomprar.</div></div>`;
  }
  el.innerHTML=h;
}

// Feed de movimentações recentes (toda a loja)
let _movFiltroTipo='todos';
let _movPagina=0;
const _MOV_POR_PAG=30;
function renderMovEstoque(){
  const card=document.getElementById('estoque-mov-card'), body=document.getElementById('estoque-mov-body');
  if(!card||!body) return;
  const tT={entrada:'＋ Entrada',saida:'− Saída',ajuste:'⚖ Ajuste',reserva:'🔒 Reserva',liberacao_reserva:'🔓 Libera',transf_entrada:'🔄 Transf.+',transf_saida:'🔄 Transf.−'};
  const tC={entrada:'var(--green)',saida:'#b45309',ajuste:'var(--gray)',reserva:'#7c3aed',liberacao_reserva:'#7c3aed',transf_entrada:'#0369a1',transf_saida:'#0369a1'};
  let todos=filtrarPorLoja(todosMovEstoque).slice().sort((a,b)=>new Date(b.data)-new Date(a.data));
  if(_movFiltroTipo!=='todos') todos=todos.filter(m=>m.tipo===_movFiltroTipo);
  if(!todos.length){ card.style.display='none'; return; }
  card.style.display='';
  const inicio=_movPagina*_MOV_POR_PAG;
  const pagina=todos.slice(inicio, inicio+_MOV_POR_PAG);
  const temAntes=inicio>0, temDepois=inicio+_MOV_POR_PAG<todos.length;
  // Filtro de tipo
  const filtros=[['todos','Todos'],['entrada','＋ Entradas'],['saida','− Saídas'],['ajuste','⚖ Ajustes']];
  const filtrosHTML=filtros.map(([k,l])=>`<button onclick="_movFiltroTipo='${k}';_movPagina=0;renderMovEstoque()" style="font-size:11px;padding:3px 8px;border-radius:50px;border:1px solid ${_movFiltroTipo===k?'var(--c1)':'var(--gray-light)'};background:${_movFiltroTipo===k?'var(--c1)':'transparent'};color:${_movFiltroTipo===k?'white':'var(--gray)'};cursor:pointer">${l}</button>`).join('');
  const navHTML=`<div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;font-size:12px;color:var(--gray)"><span>${inicio+1}–${Math.min(inicio+_MOV_POR_PAG,todos.length)} de ${todos.length}</span><div style="display:flex;gap:6px">${temAntes?`<button onclick="_movPagina--;renderMovEstoque()" style="padding:2px 8px;border:1px solid var(--gray-light);border-radius:4px;cursor:pointer;background:none">←</button>`:''} ${temDepois?`<button onclick="_movPagina++;renderMovEstoque()" style="padding:2px 8px;border:1px solid var(--gray-light);border-radius:4px;cursor:pointer;background:none">→</button>`:''}</div></div>`;
  body.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--gray-light);margin-bottom:4px">${filtrosHTML}</div>`
    +pagina.map(m=>{
      const p=produtoById(m.produto_id), d=new Date(m.data), q=parseFloat(m.quantidade)||0;
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)"><div style="min-width:0"><div style="font-size:12.5px;font-weight:600;color:${tC[m.tipo]||'var(--c2)'}">${tT[m.tipo]||m.tipo} ${fmtQtd(q)} · ${esc(p?p.nome:'—')}</div><div style="font-size:11px;color:var(--gray);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.motivo||'')}${m.usuario?' · '+esc(m.usuario):''}</div></div><div style="font-size:11px;color:var(--gray);white-space:nowrap;text-align:right">${d.toLocaleDateString('pt-BR')}<br>${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div></div>`;
    }).join('')+navHTML;
}

// Ativar/desativar produto
function _setProdutoAtivo(id, ativo){
  const i=todosProdutos.findIndex(p=>p.id===id); if(i<0) return;
  todosProdutos[i]={...todosProdutos[i],ativo};
  lsProdSalvar(todosProdutos);
  if(dbOk&&db){ (async()=>{ try{ const r=await _comTimeout(dbUpsert('produtos',todosProdutos[i]),20000,'prodAtivo'); if(r&&r.error) console.warn('[prodAtivo]',r.error.message); }catch(e){ console.warn('[prodAtivo bg]',e?.message||e); } })(); }
  renderEstoque();
}
function reativarProduto(id){ _setProdutoAtivo(id,true); toast('↺ Produto reativado'); }
function desativarProduto(id){ confirmar('Desativar este produto? Some da lista ativa (o histórico é mantido e pode reativar depois).', ()=>{ _setProdutoAtivo(id,false); fecharProdutoModal(); toast('🚫 Produto desativado'); }, 'Desativar produto'); }

// ── Lista de compras consolidada ──
function _calcListaCompras(){
  const itens=[];
  produtosVisiveis().forEach(p=>{
    const disp=disponivelProduto(p.id), min=parseFloat(p.estoque_minimo)||0;
    const lote=parseFloat(p.lote_minimo)||1;
    if(disp<0){
      const base=Math.ceil(-disp); const qtd=Math.ceil(base/lote)*lote;
      itens.push({p, qtd, motivo:'encomenda'});
    } else if(min>0 && disp<=min){
      const base=Math.max(1,Math.ceil(min*2-disp)); const qtd=Math.ceil(base/lote)*lote;
      itens.push({p, qtd, motivo:'repor'});
    } else {
      // verificar ponto de pedido
      const pp=pontoDePedido(p.id);
      if(pp>0 && disp<=pp){
        const base=Math.max(1,Math.ceil(pp*2-disp)); const qtd=Math.ceil(base/lote)*lote;
        itens.push({p, qtd, motivo:'ponto de pedido'});
      }
    }
  });
  return itens.sort((a,b)=>{
    const ordem={encomenda:0,'ponto de pedido':1,repor:2};
    return (ordem[a.motivo]??3)-(ordem[b.motivo]??3);
  });
}
function abrirListaCompras(){
  const itens=_calcListaCompras();
  const body=document.getElementById('compras-body');
  if(!itens.length){ body.innerHTML='<div style="padding:18px;text-align:center;color:var(--gray);font-size:13px">Nada para comprar agora. 🎉</div>'; document.getElementById('compras-modal').style.display='flex'; return; }
  // Agrupar por fornecedor
  const grupos={};
  itens.forEach(x=>{
    const fid=x.p.fornecedor_id||'__sem_fornecedor__';
    if(!grupos[fid]) grupos[fid]=[];
    grupos[fid].push(x);
  });
  let html='', totalGeral=0;
  Object.entries(grupos).forEach(([fid,grp])=>{
    const forn=todosFornecedores.find(f=>f.id===fid);
    const nomeGrupo=forn?forn.nome:'Sem fornecedor definido';
    const totalGrupo=grp.reduce((a,x)=>a+(parseFloat(x.p.custo)||0)*x.qtd,0);
    totalGeral+=totalGrupo;
    const wpp=forn?.whatsapp?`<button onclick="enviarListaComprasWhatsApp('${fid}')" style="font-size:11px;background:var(--green);color:white;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:'Inter',sans-serif">📲 WhatsApp</button>`:'';
    const ocBtn=`<button onclick="criarOCDoGrupo('${fid}')" style="font-size:11px;background:var(--c1);color:white;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:'Inter',sans-serif">📄 Criar OC</button>`;
    html+=`<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px"><div style="font-size:12px;font-weight:700;color:var(--c1)">${esc(nomeGrupo)}</div><div style="display:flex;gap:6px">${wpp}${ocBtn}</div></div>`;
    grp.forEach(x=>{ const custo=(parseFloat(x.p.custo)||0)*x.qtd;
      html+=`<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--gray-light)"><div style="min-width:0"><div style="font-size:12.5px;font-weight:600;color:var(--c2)">${esc(x.p.nome)} <span style="font-size:10px;background:${x.motivo==='encomenda'?'var(--red-bg)':'var(--yellow-bg)'};color:${x.motivo==='encomenda'?'var(--red)':'var(--yellow)'};padding:1px 5px;border-radius:50px;font-weight:700">${x.motivo}</span></div><div style="font-size:11px;color:var(--gray)">${esc(x.p.codigo||'')}</div></div><div style="text-align:right;white-space:nowrap"><div style="font-size:13px;font-weight:700;color:var(--c2)">${fmtQtd(x.qtd)} ${esc(x.p.unidade||'')}</div><div style="font-size:11px;color:var(--gray)">~${brl(custo)}</div></div></div>`;
    });
    html+=`<div style="text-align:right;font-size:12px;color:var(--gray);padding-top:4px">Subtotal: ${brl(totalGrupo)}</div></div>`;
  });
  html+=`<div style="text-align:right;font-size:13px;font-weight:800;color:var(--c2);padding-top:8px;border-top:2px solid var(--gray-light)">Total geral estimado: ${brl(totalGeral)}</div>`;
  body.innerHTML=html;
  document.getElementById('compras-modal').style.display='flex';
}
function fecharListaCompras(){ document.getElementById('compras-modal').style.display='none'; }
function copiarListaCompras(){
  const itens=_calcListaCompras();
  if(!itens.length){ toast('Nada para comprar'); return; }
  const LC=getLojaConfig(lojaAtiva);
  let txt='🛒 *Lista de compras* — '+(LC.nome||'Estoque')+'\n'+new Date().toLocaleDateString('pt-BR')+'\n\n';
  txt+=itens.map(x=>`• ${x.p.nome}: ${fmtQtd(x.qtd)} ${x.p.unidade||''}${x.motivo==='encomenda'?' (encomenda)':''}`).join('\n');
  const total=itens.reduce((a,x)=>a+(parseFloat(x.p.custo)||0)*x.qtd,0);
  txt+=`\n\n💰 Total estimado: ${brl(total)}`;
  navigator.clipboard.writeText(txt).then(()=>toast('📋 Lista copiada!')).catch(()=>toast('📋 Copiado'));
}

// ══════════════════════════════════════════
//  IMPORTADOR DE PRODUTOS (planilha Excel/CSV)
// ══════════════════════════════════════════
let _impLinhas=[], _impCabecalho=[];

// Mapa de detecção automática de colunas
const _IMP_MAP={
  nome:   ['descri','nome','produto','product','item','name'],
  codigo: ['codigo','cód','cod ','cod.','sku','ref','code'],
  gtin_ean:['ean','gtin','barras','barra','bar code'],
  ncm:    ['ncm'],
  preco_venda:['preco venda','preço venda','venda','unitario','unit','price','valor vend'],
  custo:  ['custo','cost','compra','entrada'],
  unidade:['unidade','unit','un'],
};

function _impDetectarCol(header){
  const h=(header||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  for(const [campo, pads] of Object.entries(_IMP_MAP)){
    if(pads.some(p=>h.includes(p))) return campo;
  }
  return '';
}

async function _loadSheetJS(){
  if(window.XLSX) return;
  await new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=res; s.onerror=()=>rej(new Error('Falha ao carregar biblioteca Excel'));
    document.head.appendChild(s);
  });
}

function abrirImportProdutos(){
  _impLinhas=[]; _impCabecalho=[];
  document.getElementById('imp-step-upload').style.display='';
  document.getElementById('imp-step-map').style.display='none';
  document.getElementById('imp-step-result').style.display='none';
  document.getElementById('imp-file-input').value='';
  document.getElementById('import-prod-modal').style.display='flex';
}
function fecharImportProdutos(){
  document.getElementById('import-prod-modal').style.display='none';
}

function _impDrop(ev){
  ev.preventDefault();
  document.getElementById('imp-drop-zone').style.borderColor='var(--gray-mid)';
  const f=ev.dataTransfer.files[0]; if(f) _impProcessarArquivo(f);
}
function _impArquivoSelecionado(inp){
  const f=inp.files[0]; if(f) _impProcessarArquivo(f);
}

async function _impProcessarArquivo(file){
  const zone=document.getElementById('imp-drop-zone');
  zone.innerHTML='<span style="font-size:24px">⏳</span><span style="font-size:13px;color:var(--gray)">Lendo arquivo…</span>';
  try{
    await _loadSheetJS();
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    if(!rows.length) throw new Error('Planilha vazia');
    // Primeira linha não vazia = cabeçalho
    let hiCab=0;
    while(hiCab<rows.length && rows[hiCab].every(c=>!String(c).trim())) hiCab++;
    _impCabecalho=rows[hiCab].map(c=>String(c).trim());
    _impLinhas=rows.slice(hiCab+1).filter(r=>r.some(c=>String(c).trim()));
    _impMostrarMapa();
  }catch(e){
    zone.innerHTML=`<span style="font-size:24px">❌</span><span style="font-size:13px;color:var(--red)">${esc(e.message||'Erro ao ler arquivo')}</span><label style="margin-top:8px;cursor:pointer;font-size:12px;color:var(--c1)">Tentar novamente<input type="file" accept=".xlsx,.csv,.xls" style="display:none" onchange="_impArquivoSelecionado(this)"></label>`;
  }
}

function _impMostrarMapa(){
  document.getElementById('imp-step-upload').style.display='none';
  document.getElementById('imp-step-map').style.display='';

  // Campos do sistema que o usuário pode mapear
  const campos=[
    {k:'nome',      lbl:'Nome do produto',      req:true},
    {k:'codigo',    lbl:'Código / SKU',          req:false},
    {k:'gtin_ean',  lbl:'Código EAN / GTIN',     req:false},
    {k:'ncm',       lbl:'Código NCM',            req:false},
    {k:'preco_venda',lbl:'Preço de venda (R$)',  req:false},
    {k:'custo',     lbl:'Custo (R$)',            req:false},
    {k:'unidade',   lbl:'Unidade (un, kg, L…)',  req:false},
  ];

  const optsBase='<option value="">— não usar —</option>'+_impCabecalho.map((c,i)=>`<option value="${i}">${esc(c)}</option>`).join('');
  let html='';
  campos.forEach(({k,lbl,req})=>{
    const auto=_impCabecalho.findIndex(c=>_impDetectarCol(c)===k);
    html+=`<div><label style="font-size:11px;font-weight:700;color:var(--gray);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px">${esc(lbl)}${req?' <span style="color:var(--red)">*</span>':''}</label>
      <select id="imp-col-${k}" style="width:100%;padding:8px 10px;border:1.5px solid var(--gray-mid);border-radius:8px;font-size:13px;font-family:inherit">
        ${optsBase.replace(`value="${auto}"`,`value="${auto}" selected`)}
      </select></div>`;
  });
  document.getElementById('imp-map-fields').innerHTML=html;

  // Preview
  const thead='<thead><tr style="background:var(--gray-light)">'+_impCabecalho.map(c=>`<th style="padding:6px 10px;text-align:left;font-size:11px;white-space:nowrap">${esc(c)}</th>`).join('')+'</tr></thead>';
  const tbody='<tbody>'+_impLinhas.slice(0,5).map(r=>'<tr>'+_impCabecalho.map((_,i)=>`<td style="padding:5px 10px;border-top:1px solid var(--gray-light);font-size:12px;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">${esc(String(r[i]||''))}</td>`).join('')+'</tr>').join('')+'</tbody>';
  document.getElementById('imp-preview-table').innerHTML=thead+tbody;
  document.getElementById('imp-btn-confirmar').textContent=`📥 Importar ${_impLinhas.length} produto${_impLinhas.length!==1?'s':''}`;
}

function _impValorNum(v){ return parseFloat(String(v||'').replace(/[^\d,.-]/g,'').replace(',','.'))||0; }
function _impNorm(v){ return String(v||'').trim(); }

async function _impConfirmar(){
  const getCol=k=>{ const s=document.getElementById('imp-col-'+k); return s&&s.value!==''?parseInt(s.value):-1; };
  const iNome=getCol('nome');
  if(iNome<0){ toast('⚠️ Selecione a coluna do nome do produto'); return; }

  const btn=document.getElementById('imp-btn-confirmar');
  btn.disabled=true; btn.textContent='Importando…';

  const s=getSessao();
  let ok=0, skip=0, erros=[];
  const lojaId=s?.loja_id||lojaAtiva||LOJA_PADRAO_ID;

  for(const row of _impLinhas){
    const nome=_impNorm(row[iNome]);
    if(!nome){ skip++; continue; }

    const iCod=getCol('codigo'), iGtin=getCol('gtin_ean'), iNcm=getCol('ncm');
    const iPreco=getCol('preco_venda'), iCusto=getCol('custo'), iUn=getCol('unidade');

    const id='prod_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    const rec={
      id, nome,
      loja_id: lojaId,
      codigo:  iCod>=0  ? _impNorm(row[iCod])   : '',
      gtin_ean:iGtin>=0 ? _impNorm(row[iGtin])  : '',
      ncm:     iNcm>=0  ? _impNorm(row[iNcm])   : '',
      preco_venda: iPreco>=0 ? _impValorNum(row[iPreco]) : 0,
      custo:   iCusto>=0 ? _impValorNum(row[iCusto]) : 0,
      unidade: iUn>=0   ? (_impNorm(row[iUn])||'un') : 'un',
      estoque_minimo:0, ativo:true,
      data_criacao: new Date().toISOString()
    };

    // Checa duplicata por nome (mesmo nome + mesma loja)
    const existe=todosProdutos.find(p=>(p.nome||'').toLowerCase()===nome.toLowerCase()&&(p.loja_id||'')===(lojaId||''));
    if(existe){ skip++; continue; }

    todosProdutos.unshift(rec);
    lsProdSalvar(todosProdutos);
    try{
      await dbUpsert('produtos',rec);
      ok++;
    }catch(e){
      erros.push(nome);
      console.warn('[imp-prod]',e?.message||e);
    }
  }

  // Resultado
  document.getElementById('imp-step-map').style.display='none';
  document.getElementById('imp-step-result').style.display='';
  document.getElementById('imp-result-icon').textContent= erros.length?'⚠️':'✅';
  document.getElementById('imp-result-text').textContent= `${ok} produto${ok!==1?'s':''} importado${ok!==1?'s':''}`;
  document.getElementById('imp-result-sub').innerHTML=
    (skip?`<span style="color:var(--gray)">${skip} ignorado${skip!==1?'s':''} (duplicata ou sem nome)</span><br>`:'') +
    (erros.length?`<span style="color:var(--red)">${erros.length} com erro de sync: ${erros.slice(0,3).map(n=>esc(n)).join(', ')}${erros.length>3?'…':''}</span>`:'');

  logAcao('estoque_mov',`Importação em lote: ${ok} produtos adicionados`);
  renderEstoque();
}

// ── Modal de cadastro/edição de produto ──
let _prodEditId=null;
function abrirProdutoModal(id){
  _prodEditId=id||null;
  const p=id?produtoById(id):null;
  const cat=p?.categoria||'';
  setV('prod-categoria', cat);
  const catOutraWrap=document.getElementById('prod-catoutra-wrap');
  if(catOutraWrap) catOutraWrap.style.display=(cat==='Outro')?'':'none';
  setV('prod-catoutra', cat==='Outro'?'':'');
  setV('prod-nome',p?.nome||''); setV('prod-codigo',p?.codigo||'');
  setV('prod-unidade',p?.unidade||'un'); setV('prod-preco',p?.preco_venda?String(p.preco_venda):'');
  setV('prod-custo',p?.custo?String(p.custo):''); setV('prod-min',p?.estoque_minimo?String(p.estoque_minimo):'');
  setV('prod-leadtime',p?.lead_time_dias?String(p.lead_time_dias):''); setV('prod-seguranca',p?.estoque_seguranca?String(p.estoque_seguranca):'');
  setV('prod-lote',p?.lote_minimo?String(p.lote_minimo):'');
  setV('prod-lote-cod',p?.lote||''); setV('prod-validade',p?.validade||'');
  setV('prod-ncm',p?.ncm||''); setV('prod-cest',p?.cest||''); setV('prod-cfop',p?.cfop_padrao||'');
  setV('prod-origem',p?.origem||''); setV('prod-gtin',p?.gtin_ean||'');
  // Preencher select de fornecedor
  const selForn=document.getElementById('prod-fornecedor');
  if(selForn){ selForn.innerHTML='<option value="">— nenhum —</option>'+todosFornecedores.filter(f=>f.ativo!==false).map(f=>`<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join(''); selForn.value=p?.fornecedor_id||''; }
  const inicialWrap=document.getElementById('prod-inicial-wrap');
  if(inicialWrap) inicialWrap.style.display=id?'none':''; // saldo inicial só ao criar
  setV('prod-inicial','');
  document.getElementById('prod-modal-titulo').textContent=id?'Editar produto':'Novo produto';
  const desBtn=document.getElementById('prod-desativar-btn'); if(desBtn) desBtn.style.display=id?'block':'none';
  // ── Indicador / seletor de unidade ──
  const wrap=document.getElementById('prod-loja-wrap');
  if(wrap){
    const s=getSessao();
    const lojaFixa=p?.loja_id||s?.loja_id||lojaAtiva||'';
    if(lojaFixa){
      // Loja já definida (gestor com loja própria, master em loja específica, ou produto existente)
      const loja=getLoja(lojaFixa);
      const rotulo=id?'Unidade deste produto:':'Será cadastrado em:';
      wrap.innerHTML=`<div style="display:flex;align-items:center;gap:8px;background:var(--gray-light);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--gray)">🏪 ${rotulo} ${getLojaBadge(lojaFixa)}</div>`;
    } else {
      // Master no painel geral → precisa escolher a unidade
      const opcs=LOJAS.filter(l=>GRUPO_PRINCIPAL.includes(l.id)).map(l=>`<option value="${l.id}">${esc(l.nome)}</option>`).join('');
      wrap.innerHTML=`<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:var(--c1);text-transform:uppercase;letter-spacing:.5px">🏪 Em qual unidade cadastrar?</label><select id="prod-loja-select" style="width:100%;margin-top:4px;padding:9px 12px;border:2px solid var(--c1);border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;outline:none;color:var(--c2)">${opcs}</select></div>`;
    }
  }
  document.getElementById('prod-modal').style.display='flex';
}
function fecharProdutoModal(){ document.getElementById('prod-modal').style.display='none'; }
async function salvarProduto(){
  const nome=(gV('prod-nome')||'').trim();
  if(!nome){ toast('⚠️ Informe o nome do produto'); return; }
  const _cat=(gV('prod-categoria')==='Outro'?(gV('prod-catoutra')||'').trim():gV('prod-categoria')||'');
  if(!_cat){ toast('⚠️ Selecione a categoria do produto'); document.getElementById('prod-categoria')?.focus(); return; }
  const s=getSessao();
  const id=_prodEditId||'prod_'+Date.now();
  const existente=_prodEditId?produtoById(_prodEditId):null;
  const rec={
    id,
    loja_id: existente?.loja_id || s?.loja_id || document.getElementById('prod-loja-select')?.value || lojaAtiva || LOJA_PADRAO_ID,
    nome, codigo:(gV('prod-codigo')||'').trim(),
    unidade:gV('prod-unidade')||'un',
    preco_venda:parseFloat((gV('prod-preco')||'').replace(',','.'))||0,
    custo:parseFloat((gV('prod-custo')||'').replace(',','.'))||0,
    estoque_minimo:parseFloat((gV('prod-min')||'').replace(',','.'))||0,
    fornecedor_id:(gV('prod-fornecedor')||'')||null,
    lead_time_dias:parseFloat((gV('prod-leadtime')||'').replace(',','.'))||null,
    estoque_seguranca:parseFloat((gV('prod-seguranca')||'').replace(',','.'))||0,
    lote_minimo:parseFloat((gV('prod-lote')||'').replace(',','.'))||1,
    lote:(gV('prod-lote-cod')||'').trim()||null, validade:gV('prod-validade')||null,
    ncm:(gV('prod-ncm')||'').trim(), cest:(gV('prod-cest')||'').trim(),
    cfop_padrao:(gV('prod-cfop')||'').trim(), origem:(gV('prod-origem')||'').trim(),
    gtin_ean:(gV('prod-gtin')||'').trim(),
    categoria:_cat,
    ativo:true, data_criacao: existente?.data_criacao || new Date().toISOString()
  };
  const idx=todosProdutos.findIndex(x=>x.id===id);
  if(idx>=0) todosProdutos[idx]=rec; else todosProdutos.unshift(rec);
  lsProdSalvar(todosProdutos);
  if(dbOk&&db){ (async()=>{ try{ const r=await _comTimeout(dbUpsert('produtos',rec),20000,'produto'); if(r&&r.error) console.warn('[produto sync]',r.error.message); }catch(e){ console.warn('[produto sync bg]',e?.message||e); } })(); }
  // saldo inicial (só ao criar): vira um movimento de entrada
  if(!_prodEditId){
    const ini=parseFloat((gV('prod-inicial')||'').replace(',','.'))||0;
    if(ini!==0) registrarMovimento({produto_id:id, tipo:'entrada', quantidade:Math.abs(ini), custo_unit:rec.custo, motivo:'Saldo inicial', lojaId:rec.loja_id});
  }
  fecharProdutoModal();
  renderEstoque();
  toast(_prodEditId?'✅ Produto atualizado':'✅ Produto cadastrado');
}

// ── Modal de movimento (entrada / saída / ajuste) ──
let _movProdId=null, _movTipo='entrada';

function abrirMovModal(produtoId, tipo){
  _movProdId=produtoId; _movTipo=tipo;
  const p=produtoById(produtoId); if(!p) return;
  const config={
    entrada:{ titulo:'📦 Entrada de estoque', dica:'Use quando receber mercadoria, compra ou devolução de material.' },
    saida:{   titulo:'📤 Saída de estoque',   dica:'Use quando material sair sem estar vinculado a uma OS (perda, empréstimo, consumo interno).' },
    ajuste:{  titulo:'⚖️ Inventário / Corrigir saldo', dica:'Use para corrigir a quantidade real após contar o estoque fisicamente.' }
  };
  const cfg=config[tipo]||config.entrada;
  document.getElementById('mov-modal-titulo').innerHTML=
    `<span>${cfg.titulo}</span><button onclick="fecharMovModal()" aria-label="Fechar" style="background:none;border:none;cursor:pointer;color:var(--gray);font-size:18px;font-weight:700;line-height:1;margin-left:auto;padding:0 4px">×</button>`;
  document.getElementById('mov-saldo-atual').innerHTML=
    `<strong style="color:var(--c2)">${esc(p.nome)}</strong><br>`+
    `<span style="color:var(--gray)">Em estoque agora: <strong>${fmtQtd(disponivelProduto(produtoId))} ${esc(p.unidade||'un')}</strong></span><br>`+
    `<span style="font-size:11px;color:var(--gray);font-style:italic;margin-top:3px;display:block">${cfg.dica}</span>`;
  setV('mov-qtd',''); setV('mov-motivo','');
  document.getElementById('mov-qtd-label').textContent = tipo==='ajuste' ? 'Quantidade real contada agora' : 'Quantidade';
  const cw=document.getElementById('mov-custo-wrap'); if(cw) cw.style.display = tipo==='entrada' ? '' : 'none';
  setV('mov-custo', p.custo?String(p.custo):'');
  document.getElementById('mov-modal').style.display='flex';
  setTimeout(()=>document.getElementById('mov-qtd')?.focus(),80);
}
function fecharMovModal(){ document.getElementById('mov-modal').style.display='none'; }
function confirmarMovimento(){
  const p=produtoById(_movProdId); if(!p) return;
  const val=parseFloat((gV('mov-qtd')||'').replace(',','.'));
  if(isNaN(val)){ toast('⚠️ Informe a quantidade'); return; }
  const motivo=(gV('mov-motivo')||'').trim();
  if(_movTipo==='entrada'){
    const custo=parseFloat((gV('mov-custo')||'').replace(',','.'));
    const fisAntes=fisicaProdutoTotal(_movProdId); // ANTES de registrar, p/ o CMP
    registrarMovimento({produto_id:_movProdId, tipo:'entrada', quantidade:Math.abs(val), custo_unit:isNaN(custo)?p.custo:custo, motivo:motivo||'Entrada manual'});
    if(!isNaN(custo)) recomputarCMP(_movProdId, Math.abs(val), custo, fisAntes); // custo médio ponderado
  } else if(_movTipo==='saida'){
    registrarMovimento({produto_id:_movProdId, tipo:'saida', quantidade:-Math.abs(val), custo_unit:p.custo, motivo:motivo||'Saída manual'});
  } else { // ajuste: diferença entre saldo físico contado e atual
    if(!motivo){ toast('⚠️ Informe o motivo do ajuste'); document.getElementById('mov-motivo')?.focus(); return; }
    const atual=fisicaProduto(_movProdId);
    const diff=val-atual;
    if(diff===0){ toast('Saldo já está correto'); fecharMovModal(); return; }
    registrarMovimento({produto_id:_movProdId, tipo:'ajuste', quantidade:diff, custo_unit:p.custo, motivo:motivo});
  }
  fecharMovModal();
  renderEstoque();
  toast('✅ Movimento registrado');
}

// ── Transferência entre unidades ──
let _transfProdId=null;
function abrirTransfModal(produtoId){
  _transfProdId=produtoId;
  const p=produtoById(produtoId); if(!p) return;
  const origem=lojaAtiva||p.loja_id||LOJA_PADRAO_ID;
  document.getElementById('transf-modal-titulo').textContent='Transferir — '+p.nome;
  document.getElementById('transf-origem').textContent='De: '+getLojaNome(origem)+' (disponível: '+fmtQtd(disponivelProduto(produtoId))+')';
  const sel=document.getElementById('transf-destino');
  sel.innerHTML=LOJAS.filter(l=>l.id!==origem).map(l=>`<option value="${l.id}">${esc(l.nome)}</option>`).join('');
  setV('transf-qtd',''); setV('transf-motivo','');
  document.getElementById('transf-modal').style.display='flex';
  setTimeout(()=>document.getElementById('transf-qtd')?.focus(),80);
}
function fecharTransfModal(){ document.getElementById('transf-modal').style.display='none'; }
function confirmarTransferencia(){
  const q=parseFloat((gV('transf-qtd')||'').replace(',','.'));
  if(isNaN(q)||q<=0){ toast('⚠️ Informe a quantidade'); return; }
  const dest=gV('transf-destino');
  if(!dest){ toast('⚠️ Escolha a unidade de destino'); return; }
  const ok=transferirProduto(_transfProdId, q, dest, (gV('transf-motivo')||'').trim());
  if(ok){ fecharTransfModal(); toast('✅ Transferência registrada'); }
  else toast('⚠️ Não foi possível transferir');
}

// ── Histórico de um produto ──
let _histProdId=null, _histProdPag=0, _histProdFiltro='todos';
const _HIST_POR_PAG=25;
function abrirHistProduto(produtoId){
  _histProdId=produtoId; _histProdPag=0; _histProdFiltro='todos'; _acuraciaData=null;
  _renderHistProduto();
  document.getElementById('hist-prod-modal').style.display='flex';
}
function _renderHistProduto(){
  const produtoId=_histProdId;
  const p=produtoById(produtoId); if(!p) return;
  const tT={entrada:'＋ Entrada',saida:'− Saída',ajuste:'⚖ Ajuste',reserva:'🔒 Reserva',liberacao_reserva:'🔓 Libera',transf_entrada:'🔄 Transf.+',transf_saida:'🔄 Transf.−'};
  const tC={entrada:'var(--green)',saida:'#b45309',ajuste:'var(--gray)',reserva:'#7c3aed',liberacao_reserva:'#7c3aed',transf_entrada:'#0369a1',transf_saida:'#0369a1'};
  document.getElementById('hist-prod-titulo').innerHTML=`Histórico — ${esc(p.nome)} <button onclick="fecharHistProduto()" aria-label="Fechar" style="background:none;border:none;cursor:pointer;color:var(--gray);font-size:18px;font-weight:700;float:right;line-height:1">×</button>`;
  let todos=todosMovEstoque.filter(m=>m.produto_id===produtoId).sort((a,b)=>new Date(b.data)-new Date(a.data));
  if(_histProdFiltro!=='todos') todos=todos.filter(m=>m.tipo===_histProdFiltro);
  const body=document.getElementById('hist-prod-body');
  if(!todos.length){
    body.innerHTML=_acuraciaHTML(produtoId)+'<div style="padding:20px;text-align:center;color:var(--gray);font-size:13px">Nenhum movimento ainda.</div>';
    return;
  }
  const inicio=_histProdPag*_HIST_POR_PAG;
  const pagina=todos.slice(inicio,inicio+_HIST_POR_PAG);
  const temAntes=inicio>0, temDepois=inicio+_HIST_POR_PAG<todos.length;
  const filtros=[['todos','Todos'],['entrada','＋ Ent.'],['saida','− Saída'],['ajuste','⚖ Ajuste'],['reserva','🔒']];
  const filtrosHTML=filtros.map(([k,l])=>`<button onclick="_histProdFiltro='${k}';_histProdPag=0;_renderHistProduto()" style="font-size:11px;padding:3px 8px;border-radius:50px;border:1px solid ${_histProdFiltro===k?'var(--c1)':'var(--gray-light)'};background:${_histProdFiltro===k?'var(--c1)':'transparent'};color:${_histProdFiltro===k?'white':'var(--gray)'};cursor:pointer">${l}</button>`).join('');
  const navHTML=temAntes||temDepois?`<div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;font-size:12px;color:var(--gray)"><span>${inicio+1}–${Math.min(inicio+_HIST_POR_PAG,todos.length)} de ${todos.length}</span><div style="display:flex;gap:6px">${temAntes?`<button onclick="_histProdPag--;_renderHistProduto()" style="padding:2px 8px;border:1px solid var(--gray-light);border-radius:4px;cursor:pointer;background:none">←</button>`:''} ${temDepois?`<button onclick="_histProdPag++;_renderHistProduto()" style="padding:2px 8px;border:1px solid var(--gray-light);border-radius:4px;cursor:pointer;background:none">→</button>`:''}</div></div>`:'';
  body.innerHTML=_acuraciaHTML(produtoId)+renderHistoricoPreco(produtoId)+`<div style="display:flex;gap:6px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--gray-light);margin-bottom:4px;margin-top:8px">${filtrosHTML}</div>`
    +pagina.map(m=>{
      const d=new Date(m.data).toLocaleDateString('pt-BR')+' '+new Date(m.data).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      const q=parseFloat(m.quantidade)||0;
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-light)">
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:600;color:${tC[m.tipo]||'var(--c2)'}">${tT[m.tipo]||m.tipo} ${fmtQtd(q)}</div>
          <div style="font-size:11px;color:var(--gray);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.motivo||'')}${m.usuario?' · '+esc(m.usuario):''}</div>
        </div>
        <div style="font-size:11px;color:var(--gray);white-space:nowrap;text-align:right">${d}</div>
      </div>`;
    }).join('')+navHTML;
}
function fecharHistProduto(){ document.getElementById('hist-prod-modal').style.display='none'; }

// ══ ACURÁCIA DE INVENTÁRIO ════════════════════════
// O saldo é a soma dos movimentos, nunca um contador — então dá pra responder
// "quanto tinha no dia X" sem guardar nada novo: basta parar de somar em X.
// É o que o contador pede no fechamento e o que resolve a discussão de "isso
// já tinha acabado quando eu vendi?".
//
// Usa o MESMO recorte de loja de fisicaProduto() (filtrarPorLoja), pra que o
// último ponto da série bata exatamente com o número que a pessoa vê no card
// do produto. Uma série que não fecha com a tela é pior que série nenhuma.
function _movsProdutoOrdenados(produtoId){
  return filtrarPorLoja(todosMovEstoque||[])
    .filter(m=>m.produto_id===produtoId && _TIPOS_FISICOS.includes(m.tipo) && m.data)
    .map(m=>({dia:String(m.data).slice(0,10), q:parseFloat(m.quantidade)||0}))
    .sort((a,b)=>a.dia<b.dia?-1:a.dia>b.dia?1:0);
}
// Saldo físico ao FIM do dia informado (inclui os movimentos do próprio dia —
// é assim que se lê "o que tinha no estoque no dia 31").
function _saldoProdutoNaData(produtoId, dia){
  return _movsProdutoOrdenados(produtoId)
    .filter(m=>m.dia<=dia)
    .reduce((a,m)=>a+m.q, 0);
}
// Série diária do primeiro movimento até hoje, e os períodos em que o saldo
// ficou zerado ou negativo. Ruptura é contada a partir do PRIMEIRO movimento
// do produto, não do cadastro: produto cadastrado e nunca comprado não estava
// "em falta", estava por chegar.
function _rupturaProduto(produtoId, diasJanela){
  const movs=_movsProdutoOrdenados(produtoId);
  if(!movs.length) return null;
  const hoje=_hojeLocal();
  const limite=new Date(hoje+'T12:00:00'); limite.setDate(limite.getDate()-(diasJanela||90));
  const iniJanela=limite.toISOString().slice(0,10);
  const inicio = movs[0].dia > iniJanela ? movs[0].dia : iniJanela;
  if(inicio>hoje) return null;
  const p=produtoById(produtoId);
  const minimo=parseFloat(p?.estoque_minimo)||0;
  // saldo acumulado até a véspera do início da janela
  let saldo=movs.filter(m=>m.dia<inicio).reduce((a,m)=>a+m.q,0);
  const porDia={};
  movs.filter(m=>m.dia>=inicio).forEach(m=>{ porDia[m.dia]=(porDia[m.dia]||0)+m.q; });
  const periodos=[]; let atual=null;
  let diasZerado=0, diasAbaixoMin=0, total=0;
  const d=new Date(inicio+'T12:00:00'), fim=new Date(hoje+'T12:00:00');
  while(d<=fim){
    const dia=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    saldo+=porDia[dia]||0;
    total++;
    if(saldo<=0){
      diasZerado++;
      if(!atual) atual={de:dia, ate:dia};
      else atual.ate=dia;
    } else if(atual){ periodos.push(atual); atual=null; }
    if(minimo>0 && saldo<=minimo) diasAbaixoMin++;
    d.setDate(d.getDate()+1);
  }
  if(atual){ atual.aberto=true; periodos.push(atual); }
  return {inicio, fim:hoje, total, diasZerado, diasAbaixoMin, minimo,
    pctZerado: total?diasZerado/total*100:0,
    periodos: periodos.slice(-6).reverse(), nPeriodos: periodos.length};
}
function _diaBR(d){ try{ return new Date(d+'T12:00:00').toLocaleDateString('pt-BR'); }catch(e){ return d; } }
function _acuraciaHTML(produtoId){
  const p=produtoById(produtoId); if(!p) return '';
  const r=_rupturaProduto(produtoId, 90);
  const hoje=_hojeLocal();
  const dataSel=_acuraciaData||hoje;
  const saldoNa=_saldoProdutoNaData(produtoId, dataSel);
  const un=esc(p.unidade||'un');
  let rupturaTx;
  if(!r) rupturaTx='<div style="font-size:11.5px;color:var(--gray)">Sem movimento registrado — nada a medir ainda.</div>';
  else if(!r.diasZerado) rupturaTx=`<div style="font-size:11.5px;color:var(--green)">Nunca zerou nos últimos ${r.total} dia${r.total!==1?'s':''}.${r.minimo>0?` ${r.diasAbaixoMin} dia${r.diasAbaixoMin!==1?'s':''} no mínimo ou abaixo.`:''}</div>`;
  else rupturaTx=`
    <div style="font-size:11.5px;color:var(--warn);font-weight:600">Zerado em ${r.diasZerado} de ${r.total} dias (${r.pctZerado.toFixed(0)}%)${r.minimo>0?` · ${r.diasAbaixoMin} dia${r.diasAbaixoMin!==1?'s':''} no mínimo ou abaixo`:''}</div>
    <div style="font-size:11px;color:var(--gray);margin-top:3px">${r.periodos.map(x=>
      `${_diaBR(x.de)}${x.de!==x.ate?' → '+_diaBR(x.ate):''}${x.aberto?' (segue hoje)':''}`).join(' · ')}${r.nPeriodos>6?` · +${r.nPeriodos-6} antes`:''}</div>`;
  return `<div class="rd-card rd-card-dense" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Saldo em</span>
      <input type="date" value="${dataSel}" max="${hoje}" onchange="_acuraciaSetData(this.value)"
        style="padding:4px 7px;border:1.5px solid var(--gray-mid);border-radius:6px;font-size:12px;font-family:inherit">
      <span style="font-size:15px;font-weight:800;color:${saldoNa<=0?'var(--warn)':'var(--c2)'}">${fmtQtd(saldoNa)} ${un}</span>
    </div>
    ${rupturaTx}
  </div>`;
}
let _acuraciaData=null;
function _acuraciaSetData(v){ _acuraciaData=v||null; _renderHistProduto(); }

// ══════════════════════════════════════════════════
//  FORNECEDORES
// ══════════════════════════════════════════════════
let todosFornecedores = [];
function lsFornecLer(){ try{ return JSON.parse(ls('fluxa_fornecedores')||'[]'); }catch(e){ return []; } }
function lsFornecSalvar(l){ lsSet('fluxa_fornecedores', JSON.stringify(l)); }

async function loadFornecedores(){
  todosFornecedores = lsFornecLer();
  if(dbOk&&db){
    try{
      const {data}=await db.from('fornecedores').select('*').eq('empresa_id',EMPRESA_ID).order('nome',{ascending:true});
      if(data){ todosFornecedores=data; lsFornecSalvar(data); }
    }catch(e){ console.warn('[fornecedores]',e?.message||e); }
  }
}

function abrirFornecModal(){ loadFornecedores().then(()=>renderFornecList()); document.getElementById('fornec-modal').style.display='flex'; cancelarFornecedorForm(); }
function fecharFornecModal(){ document.getElementById('fornec-modal').style.display='none'; }

function renderFornecList(){
  const el=document.getElementById('fornec-lista'); if(!el) return;
  // Atualizar select de produto
  const selProd=document.getElementById('prod-fornecedor');
  if(selProd){ selProd.innerHTML='<option value="">— nenhum —</option>'+todosFornecedores.filter(f=>f.ativo!==false).map(f=>`<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join(''); }
  if(!todosFornecedores.filter(f=>f.ativo!==false).length){ el.innerHTML='<div style="padding:12px;text-align:center;color:var(--gray);font-size:13px">Nenhum fornecedor cadastrado.</div>'; return; }
  el.innerHTML=todosFornecedores.filter(f=>f.ativo!==false).map(f=>`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-light)">
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(f.nome)}</div>
        <div style="font-size:11px;color:var(--gray)">${[f.contato,f.whatsapp,f.email].filter(Boolean).map(esc).join(' · ')}</div>
        ${f.obs?`<div style="font-size:11px;color:var(--gray)">${esc(f.obs)}</div>`:''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${f.whatsapp?`<button onclick="window.open('https://wa.me/55${f.whatsapp.replace(/\D/g,'')}','_blank')" style="background:var(--green);color:white;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">📲</button>`:''}
        <button onclick="editarFornecedor('${f.id}')" style="background:var(--gray-light);color:var(--c2);border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">✎</button>
        <button onclick="deletarFornecedor('${f.id}')" style="background:var(--red-bg);color:var(--red);border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">✕</button>
      </div>
    </div>`).join('');
}

function cancelarFornecedorForm(){
  ['fnome','fcontato','fwhatsapp','femail','fobs'].forEach(id=>setV(id,''));
  setV('fornec-edit-id','');
  const t=document.getElementById('fornec-form-titulo'); if(t) t.textContent='＋ Novo fornecedor';
  const cb=document.getElementById('fornec-cancelar-btn'); if(cb) cb.style.display='none';
}
function editarFornecedor(id){
  const f=todosFornecedores.find(x=>x.id===id); if(!f) return;
  setV('fnome',f.nome||''); setV('fcontato',f.contato||''); setV('fwhatsapp',f.whatsapp||''); setV('femail',f.email||''); setV('fobs',f.obs||''); setV('fornec-edit-id',id);
  const t=document.getElementById('fornec-form-titulo'); if(t) t.textContent='✎ Editar fornecedor';
  const cb=document.getElementById('fornec-cancelar-btn'); if(cb) cb.style.display='';
}
async function salvarFornecedor(){
  const nome=(gV('fnome')||'').trim(); if(!nome){ toast('⚠️ Informe o nome do fornecedor'); return; }
  const editId=gV('fornec-edit-id')||'';
  const id=editId||'forn_'+Date.now();
  const s=getSessao();
  const rec={id, loja_id:lojaAtiva||LOJA_PADRAO_ID, nome, contato:(gV('fcontato')||'').trim(), whatsapp:(gV('fwhatsapp')||'').replace(/\D/g,''), email:(gV('femail')||'').trim(), obs:(gV('fobs')||'').trim(), ativo:true};
  const idx=todosFornecedores.findIndex(x=>x.id===id);
  if(idx>=0) todosFornecedores[idx]=rec; else todosFornecedores.unshift(rec);
  lsFornecSalvar(todosFornecedores);
  if(dbOk&&db){ (async()=>{ try{ await dbUpsert('fornecedores',rec); }catch(e){ console.warn('[fornecSave]',e?.message||e); } })(); }
  cancelarFornecedorForm(); renderFornecList(); toast(editId?'✅ Fornecedor atualizado':'✅ Fornecedor cadastrado');
}
async function deletarFornecedor(id){
  confirmar('Remover este fornecedor?', async ()=>{
    todosFornecedores=todosFornecedores.filter(f=>f.id!==id);
    lsFornecSalvar(todosFornecedores);
    if(dbOk&&db){ try{ await db.from('fornecedores').delete().eq('id',id); }catch(e){ console.warn('[fornecDel]',e?.message||e); } }
    renderFornecList(); toast('Fornecedor removido');
  }, 'Remover fornecedor');
}

function enviarListaComprasWhatsApp(fornecId){
  const itens=_calcListaCompras().filter(x=>x.p.fornecedor_id===fornecId);
  const forn=todosFornecedores.find(f=>f.id===fornecId);
  if(!forn?.whatsapp){ toast('Fornecedor sem WhatsApp cadastrado'); return; }
  const LC=getLojaConfig(lojaAtiva);
  let txt='🛒 *Pedido de compra* — '+(LC.nome||FLUXA_CONFIG.appName||'Empresa')+'\n'+new Date().toLocaleDateString('pt-BR')+'\n\n';
  txt+=itens.map(x=>`• ${x.p.nome}: *${fmtQtd(x.qtd)} ${x.p.unidade||''}*${x.motivo==='encomenda'?' ⚠️ urgente':''}`).join('\n');
  const total=itens.reduce((a,x)=>a+(parseFloat(x.p.custo)||0)*x.qtd,0);
  txt+=`\n\n💰 Total estimado: ${brl(total)}`;
  window.open(`https://wa.me/55${forn.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(txt)}`,'_blank');
}

// ══════════════════════════════════════════════════
//  PONTO DE PEDIDO
// ══════════════════════════════════════════════════
function pontoDePedido(pid){
  const p=produtoById(pid); if(!p) return 0;
  const lt=parseFloat(p.lead_time_dias)||0;
  const seg=parseFloat(p.estoque_seguranca)||0;
  const cdias=consumoDia(pid);
  return lt*cdias + seg;
}

// ══════════════════════════════════════════════════
//  ORDENS DE COMPRA (OC)
// ══════════════════════════════════════════════════
let todasOC = [];
let _ocEditItens = []; // [{produto_id, nome, unidade, qtd, custo_unit}]

function lsOCLer(){ try{ return JSON.parse(ls('fluxa_oc')||'[]'); }catch(e){ return []; } }
function lsOCSalvar(l){ lsSet('fluxa_oc', JSON.stringify(l)); }

async function loadOC(){
  todasOC = lsOCLer();
  if(dbOk&&db){
    try{
      const {data}=await db.from('ordens_compra').select('*').eq('empresa_id',EMPRESA_ID).order('data_criacao',{ascending:false}).limit(200);
      if(data){ todasOC=data; lsOCSalvar(data); }
    }catch(e){ console.warn('[OC load]',e?.message||e); }
  }
}

function abrirOCListModal(){ loadFornecedores(); loadOC().then(()=>renderOCList()); document.getElementById('oc-list-modal').style.display='flex'; }
function fecharOCListModal(){ document.getElementById('oc-list-modal').style.display='none'; }

function renderOCList(){
  const el=document.getElementById('oc-list-body'); if(!el) return;
  const statusLabel={rascunho:'Rascunho',enviada:'Enviada',recebida:'✅ Recebida',cancelada:'Cancelada'};
  const statusCor={rascunho:'var(--gray)',enviada:'var(--c1)',recebida:'var(--green)',cancelada:'var(--red)'};
  const lista=filtrarPorLoja(todasOC,'loja_id').sort((a,b)=>new Date(b.data_criacao)-new Date(a.data_criacao));
  if(!lista.length){ el.innerHTML='<div style="padding:18px;text-align:center;color:var(--gray);font-size:13px">Nenhuma OC criada.</div>'; return; }
  el.innerHTML=lista.map(oc=>{
    const forn=todosFornecedores.find(f=>f.id===oc.fornecedor_id);
    const itens=Array.isArray(oc.itens)?oc.itens:[];
    return `<div style="padding:10px 0;border-bottom:1px solid var(--gray-light)">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--c2)">OC #${oc.numero||'—'} · ${esc(forn?.nome||'Sem fornecedor')}</div>
          <div style="font-size:11px;color:var(--gray)">${new Date(oc.data_criacao).toLocaleDateString('pt-BR')} · ${itens.length} iten${itens.length!==1?'s':''} · ${brl(oc.total||0)}</div>
          ${oc.obs?`<div style="font-size:11px;color:var(--gray)">${esc(oc.obs)}</div>`:''}
        </div>
        <div style="flex-shrink:0;text-align:right">
          <div style="font-size:11px;font-weight:700;color:${statusCor[oc.status]||'var(--gray)'}">${statusLabel[oc.status]||oc.status}</div>
          <div style="display:flex;gap:4px;margin-top:4px;justify-content:flex-end">
            <button onclick="abrirOCForm('${oc.id}')" style="font-size:11px;background:var(--gray-light);color:var(--c2);border:none;border-radius:6px;padding:3px 8px;cursor:pointer">✎ Ver</button>
            ${oc.status!=='recebida'&&oc.status!=='cancelada'?`<button onclick="receberOC('${oc.id}')" style="font-size:11px;background:var(--green);color:white;border:none;border-radius:6px;padding:3px 8px;cursor:pointer">📦 Receber</button>`:''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function criarOCManual(){ _ocEditItens=[]; _abrirOCFormModal(null); }

function criarOCDaListaCompras(){
  const itens=_calcListaCompras();
  if(!itens.length){ toast('Nada para comprar'); return; }
  _ocEditItens=itens.map(x=>({produto_id:x.p.id, nome:x.p.nome, unidade:x.p.unidade||'un', qtd:x.qtd, custo_unit:parseFloat(x.p.custo)||0}));
  _abrirOCFormModal(null);
  fecharListaCompras();
  document.getElementById('oc-list-modal').style.display='none';
}

function criarOCDoGrupo(fornecId){
  const itens=_calcListaCompras().filter(x=>x.p.fornecedor_id===fornecId);
  _ocEditItens=itens.map(x=>({produto_id:x.p.id, nome:x.p.nome, unidade:x.p.unidade||'un', qtd:x.qtd, custo_unit:parseFloat(x.p.custo)||0}));
  _abrirOCFormModal(null);
  // pré-selecionar fornecedor
  setTimeout(()=>{ const sel=document.getElementById('oc-fornecedor'); if(sel) sel.value=fornecId; },50);
  fecharListaCompras();
}

function abrirOCForm(id){ const oc=todasOC.find(o=>o.id===id); if(!oc) return; _ocEditItens=Array.isArray(oc.itens)?oc.itens.map(x=>({...x})):[]; _abrirOCFormModal(oc); }

function _abrirOCFormModal(oc){
  loadFornecedores().then(()=>{
    const sel=document.getElementById('oc-fornecedor');
    if(sel) sel.innerHTML='<option value="">— selecionar —</option>'+todosFornecedores.filter(f=>f.ativo!==false).map(f=>`<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join('');
    const addSel=document.getElementById('oc-add-prod');
    if(addSel){ addSel.innerHTML='<option value="">＋ Adicionar produto…</option>'+produtosVisiveis().map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join(''); addSel.onchange=function(){ if(this.value) adicionarItemOC(this.value); this.value=''; }; }
    if(oc){
      setV('oc-edit-id',oc.id); setV('oc-obs',oc.obs||''); setV('oc-data',oc.data||'');
      setTimeout(()=>{ const s=document.getElementById('oc-fornecedor'); if(s) s.value=oc.fornecedor_id||''; },30);
      document.getElementById('oc-form-titulo').innerHTML=`OC #${oc.numero} <button onclick="fecharOCFormModal()" style="background:none;border:none;cursor:pointer;color:var(--gray);font-size:18px;font-weight:700;line-height:1;margin-left:auto;padding:0 4px">×</button>`;
    } else {
      setV('oc-edit-id',''); setV('oc-obs',''); setV('oc-data',_hojeLocal());
      document.getElementById('oc-form-titulo').innerHTML=`Nova Ordem de Compra <button onclick="fecharOCFormModal()" style="background:none;border:none;cursor:pointer;color:var(--gray);font-size:18px;font-weight:700;line-height:1;margin-left:auto;padding:0 4px">×</button>`;
    }
    renderOCItens();
    document.getElementById('oc-form-modal').style.display='flex';
  });
}
function fecharOCFormModal(){ document.getElementById('oc-form-modal').style.display='none'; }

function adicionarItemOC(produtoId){
  const p=produtoById(produtoId); if(!p) return;
  const ja=_ocEditItens.find(x=>x.produto_id===produtoId);
  if(ja){ ja.qtd++; } else { _ocEditItens.push({produto_id:produtoId, nome:p.nome, unidade:p.unidade||'un', qtd:1, custo_unit:parseFloat(p.custo)||0}); }
  renderOCItens();
}
function removeItemOC(i){ _ocEditItens.splice(i,1); renderOCItens(); }
function renderOCItens(){
  const el=document.getElementById('oc-itens-body'); if(!el) return;
  if(!_ocEditItens.length){ el.innerHTML='<div style="padding:12px;text-align:center;color:var(--gray);font-size:13px">Nenhum item. Adicione produtos abaixo.</div>'; document.getElementById('oc-total-row').textContent=''; return; }
  el.innerHTML=_ocEditItens.map((x,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--gray-light)">
      <div style="flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--c2)">${esc(x.nome)}</div>
      <input type="text" inputmode="decimal" value="${x.qtd}" oninput="_ocEditItens[${i}].qtd=parseFloat(this.value.replace(',','.'))||0;renderOCItens()" style="width:52px;padding:4px 6px;border:1.5px solid var(--gray-mid);border-radius:6px;font-size:12px;text-align:center;font-family:'Inter',sans-serif">
      <span style="font-size:11px;color:var(--gray)">${esc(x.unidade)}</span>
      <input type="text" inputmode="decimal" value="${x.custo_unit}" oninput="_ocEditItens[${i}].custo_unit=parseFloat(this.value.replace(',','.'))||0;renderOCItens()" style="width:70px;padding:4px 6px;border:1.5px solid var(--gray-mid);border-radius:6px;font-size:12px;text-align:right;font-family:'Inter',sans-serif" placeholder="R$">
      <button onclick="removeItemOC(${i})" style="background:var(--red-bg);color:var(--red);border:none;border-radius:6px;padding:3px 7px;font-size:12px;cursor:pointer">✕</button>
    </div>`).join('');
  const total=_ocEditItens.reduce((a,x)=>a+x.qtd*x.custo_unit,0);
  document.getElementById('oc-total-row').innerHTML=`Total: <strong>${brl(total)}</strong>`;
}

async function salvarOC(status){
  const fornId=(document.getElementById('oc-fornecedor')?.value||'').trim();
  if(!fornId){ toast('⚠️ Selecione o fornecedor'); return; }
  if(!_ocEditItens.length){ toast('⚠️ Adicione pelo menos um item'); return; }
  const editId=gV('oc-edit-id')||'';
  const id=editId||'oc_'+Date.now();
  const total=_ocEditItens.reduce((a,x)=>a+x.qtd*x.custo_unit,0);
  let numero;
  if(!editId){ const max=todasOC.reduce((a,o)=>Math.max(a,o.numero||0),0); numero=max+1; }
  const existente=todasOC.find(o=>o.id===editId);
  const rec={id, loja_id:lojaAtiva||LOJA_PADRAO_ID, numero:numero||existente?.numero||1, fornecedor_id:fornId, data:gV('oc-data')||_hojeLocal(), status: existente?.status==='recebida'?'recebida':(status||'rascunho'), itens:_ocEditItens, total, obs:(gV('oc-obs')||'').trim(), data_criacao:existente?.data_criacao||new Date().toISOString()};
  const idx=todasOC.findIndex(o=>o.id===id);
  if(idx>=0) todasOC[idx]=rec; else todasOC.unshift(rec);
  lsOCSalvar(todasOC);
  if(dbOk&&db){ (async()=>{ try{ await dbUpsert('ordens_compra',rec); }catch(e){ console.warn('[OC save]',e?.message||e); } })(); }
  fecharOCFormModal(); renderOCList(); toast(`✅ OC #${rec.numero} salva`);
}

async function receberOC(id){
  const oc=todasOC.find(o=>o.id===id); if(!oc) return;
  confirmar(`Confirmar recebimento da OC #${oc.numero}? Isso dará entrada automática no estoque para cada item.`, async()=>{
    const itens=Array.isArray(oc.itens)?oc.itens:[];
    itens.forEach(item=>{
      registrarMovimento({produto_id:item.produto_id, tipo:'entrada', quantidade:item.qtd, custo_unit:item.custo_unit, motivo:`Recebimento OC #${oc.numero}`, ref:`oc_${oc.id}_${item.produto_id}`});
    });
    const idx=todasOC.findIndex(o=>o.id===id);
    if(idx>=0){ todasOC[idx]={...oc,status:'recebida',data_recebimento:new Date().toISOString()}; lsOCSalvar(todasOC); if(dbOk&&db){ try{ await db.from('ordens_compra').update({status:'recebida',data_recebimento:new Date().toISOString()}).eq('id',id); }catch(e){ console.warn('[OC receber]',e?.message||e); } } }
    renderOCList(); renderEstoque(); toast(`✅ OC #${oc.numero} recebida — estoque atualizado`);
  }, 'Confirmar recebimento');
}

async function enviarOCWhatsApp(){
  const fornId=(document.getElementById('oc-fornecedor')?.value||'').trim();
  const forn=todosFornecedores.find(f=>f.id===fornId);
  await salvarOC('enviada');
  if(!forn?.whatsapp){ toast('OC salva. Fornecedor sem WhatsApp cadastrado.'); return; }
  const LC=getLojaConfig(lojaAtiva);
  const oc=todasOC.find(o=>o.id===(gV('oc-edit-id')||todasOC[0]?.id));
  let txt=`📄 *Ordem de Compra #${oc?.numero||'?'}*\n${LC.nome||FLUXA_CONFIG.appName||'Empresa'} · ${new Date().toLocaleDateString('pt-BR')}\n\n`;
  txt+=_ocEditItens.map(x=>`• ${x.nome}: *${fmtQtd(x.qtd)} ${x.unidade}* — ${brl(x.custo_unit)}/un`).join('\n');
  txt+=`\n\n💰 *Total: ${brl(_ocEditItens.reduce((a,x)=>a+x.qtd*x.custo_unit,0))}*`;
  if(oc?.obs) txt+=`\n📝 ${oc.obs}`;
  window.open(`https://wa.me/55${forn.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(txt)}`,'_blank');
}

// ══════════════════════════════════════════════════
//  BALANÇO DE INVENTÁRIO
// ══════════════════════════════════════════════════
let _balancoContagem = {}; // { produtoId: qtd_contada }

function abrirBalancoModal(){
  _balancoContagem = {};
  document.getElementById('balanco-busca').value='';
  renderBalancoLista();
  document.getElementById('balanco-modal').style.display='flex';
}
function fecharBalancoModal(){ document.getElementById('balanco-modal').style.display='none'; }

function renderBalancoLista(){
  const busca=(gV('balanco-busca')||'').toLowerCase().trim();
  const el=document.getElementById('balanco-body'); if(!el) return;
  const prods=produtosVisiveis().filter(p=>!busca||(p.nome||'').toLowerCase().includes(busca)||(p.codigo||'').toLowerCase().includes(busca));
  if(!prods.length){ el.innerHTML='<div style="padding:12px;text-align:center;color:var(--gray)">Nenhum produto encontrado.</div>'; _atualizarResumoBalanco(); return; }
  el.innerHTML=prods.map(p=>{
    const fis=fisicaProduto(p.id);
    const contado=_balancoContagem[p.id]!=null?_balancoContagem[p.id]:'';
    const diff=contado!==''?contado-fis:null;
    const diffStr=diff===null?'':(diff>0?`<span style="color:var(--green);font-weight:700">+${fmtQtd(diff)}</span>`:diff<0?`<span style="color:var(--red);font-weight:700">${fmtQtd(diff)}</span>`:`<span style="color:var(--gray)">ok</span>`);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-light)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600;color:var(--c2)">${esc(p.nome)}</div>
        <div style="font-size:11px;color:var(--gray)">Sistema: ${fmtQtd(fis)} ${esc(p.unidade||'un')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <input type="text" inputmode="decimal" placeholder="contado" value="${contado}" oninput="(function(v){_balancoContagem['${p.id}']=v===''?undefined:parseFloat(v.replace(',','.'))||0;_atualizarResumoBalanco();document.getElementById('bal-diff-${p.id}').innerHTML=v===''?'':(parseFloat(v.replace(',','.'))||0)-${fis}>=0&&v!==''?'<span style=&quot;color:var(--green);font-weight:700&quot;>+'+(parseFloat(v.replace(',','.'))||0-${fis})+'</span>':'<span style=&quot;color:var(--red);font-weight:700&quot;>'+(parseFloat(v.replace(',','.'))||0-${fis})+'</span>'})(this.value)" style="width:70px;padding:5px 8px;border:1.5px solid var(--gray-mid);border-radius:7px;font-size:12px;text-align:center;font-family:'Inter',sans-serif">
        <div id="bal-diff-${p.id}" style="font-size:12px;min-width:30px;text-align:center">${diffStr}</div>
      </div>
    </div>`;
  }).join('');
  _atualizarResumoBalanco();
}

function _atualizarResumoBalanco(){
  const res=document.getElementById('balanco-resumo'); if(!res) return;
  const contados=Object.entries(_balancoContagem).filter(([,v])=>v!=null);
  const comDiff=contados.filter(([id,v])=>{ const fis=fisicaProduto(id); return Math.abs((v||0)-fis)>0.001; });
  if(!contados.length){ res.innerHTML='<span style="color:var(--gray)">Preencha os campos acima com a contagem física.</span>'; return; }
  const positivos=comDiff.filter(([id,v])=>(v||0)>fisicaProduto(id)).length;
  const negativos=comDiff.filter(([id,v])=>(v||0)<fisicaProduto(id)).length;
  res.innerHTML=`<strong>${contados.length}</strong> produto${contados.length!==1?'s':''} contado${contados.length!==1?'s':''} · <span style="color:var(--green)">${positivos} sobra${positivos!==1?'s':''}</span> · <span style="color:var(--red)">${negativos} falta${negativos!==1?'s':''}</span> · ${comDiff.length} ajuste${comDiff.length!==1?'s':''} a registrar`;
}

function confirmarBalanco(){
  const comDiff=Object.entries(_balancoContagem).filter(([id,v])=>{ if(v==null) return false; const fis=fisicaProduto(id); return Math.abs((v||0)-fis)>0.001; });
  if(!comDiff.length){ toast('Nenhuma diferença encontrada.'); fecharBalancoModal(); return; }
  confirmar(`Registrar ${comDiff.length} ajuste${comDiff.length!==1?'s':''} de inventário? Esta ação não pode ser desfeita.`, ()=>{
    comDiff.forEach(([id,v])=>{
      const fis=fisicaProduto(id); const diff=(v||0)-fis;
      registrarMovimento({produto_id:id, tipo:'ajuste', quantidade:diff, custo_unit:produtoById(id)?.custo||0, motivo:'Balanço de inventário '+new Date().toLocaleDateString('pt-BR')});
    });
    fecharBalancoModal(); renderEstoque(); toast(`✅ ${comDiff.length} ajuste${comDiff.length!==1?'s':''} registrado${comDiff.length!==1?'s':''}`);
  }, 'Confirmar balanço');
}

// ══════════════════════════════════════════════════
//  HISTÓRICO DE PREÇO (custo ao longo do tempo)
// ══════════════════════════════════════════════════
function renderHistoricoPreco(produtoId){
  const entradas=todosMovEstoque.filter(m=>m.produto_id===produtoId&&m.tipo==='entrada'&&m.custo_unit!=null).sort((a,b)=>new Date(a.data)-new Date(b.data));
  if(entradas.length<2) return '';
  const max=Math.max(...entradas.map(e=>e.custo_unit||0))||1;
  const min=Math.min(...entradas.map(e=>e.custo_unit||0));
  const pts=entradas.slice(-12); // últimas 12 entradas
  const bars=pts.map(e=>{
    const pct=Math.max(8,Math.round(((e.custo_unit||0)-min)/(max-min||1)*64)+8);
    return `<div title="${new Date(e.data).toLocaleDateString('pt-BR')}: ${brl(e.custo_unit)}" style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:default">
      <div style="font-size:9px;color:var(--gray);writing-mode:vertical-rl;transform:rotate(180deg);max-height:36px;overflow:hidden">${brl(e.custo_unit)}</div>
      <div style="width:18px;background:var(--c1);border-radius:3px 3px 0 0;height:${pct}px;opacity:.8"></div>
      <div style="font-size:9px;color:var(--gray);white-space:nowrap">${new Date(e.data).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</div>
    </div>`;
  }).join('');
  const variacao=entradas.length>=2?((entradas[entradas.length-1].custo_unit-entradas[0].custo_unit)/entradas[0].custo_unit*100):0;
  return `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--gray-light)">
    <div style="font-size:11px;font-weight:700;color:var(--c1);margin-bottom:6px">📈 Histórico de custo (${entradas.length} entradas)</div>
    <div style="display:flex;gap:4px;align-items:flex-end;overflow-x:auto;padding-bottom:4px">${bars}</div>
    <div style="font-size:11px;color:var(--gray);margin-top:6px">Variação total: <strong style="color:${variacao>0?'var(--red)':variacao<0?'var(--green)':'var(--gray)'}">${variacao>0?'+':''}${variacao.toFixed(1)}%</strong> · Custo atual (CMP): <strong>${brl(produtoById(produtoId)?.custo||0)}</strong></div>
  </div>`;
}

// ══════════════════════════════════════════════════
//  INSIGHTS: PONTO DE PEDIDO
// ══════════════════════════════════════════════════
function _insightsPontoDePedido(prods){
  const alertas=prods.filter(p=>{
    const pp=pontoDePedido(p.id); if(pp<=0) return false;
    const disp=disponivelProduto(p.id);
    return disp<=pp && disp>=0; // abaixo do ponto de pedido mas ainda não em encomenda
  }).sort((a,b)=>disponivelProduto(a.id)/pontoDePedido(a.id)-disponivelProduto(b.id)/pontoDePedido(b.id));
  if(!alertas.length) return '';
  return `<div class="card"><div class="ct">🔔 Ponto de pedido atingido</div>
    <div style="font-size:11px;color:var(--gray);margin-bottom:8px">Produtos que precisam ser pedidos agora para não faltar durante o lead time do fornecedor.</div>
    ${alertas.slice(0,8).map(p=>{
      const pp=pontoDePedido(p.id), disp=disponivelProduto(p.id), lt=parseFloat(p.lead_time_dias)||0;
      const forn=todosFornecedores.find(f=>f.id===p.fornecedor_id);
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(p.nome)}</div>
          <div style="font-size:11px;color:var(--gray)">Disp.: ${fmtQtd(disp)} · PP: ${fmtQtd(pp)} · Lead: ${lt}d${forn?' · '+esc(forn.nome):''}</div>
        </div>
        <button class="tb g" style="font-size:10px;flex-shrink:0" onclick="abrirMovModal('${p.id}','entrada')">pedir</button>
      </div>`;
    }).join('')}
  </div>`;
}

// ══════════════════════════════════════════════════
//  ANÁLISE DE MARGENS
// ══════════════════════════════════════════════════
function _insightsMargem(prods){
  const comPreco=prods.filter(p=>(parseFloat(p.preco_venda)||0)>0&&(parseFloat(p.custo)||0)>0);
  if(!comPreco.length) return '';
  const comMargem=comPreco.map(p=>{ const pr=parseFloat(p.preco_venda), cu=parseFloat(p.custo); return {...p, margem:(pr-cu)/pr*100}; }).sort((a,b)=>a.margem-b.margem);
  const baixa=comMargem.filter(p=>p.margem<20);
  const media=comMargem.filter(p=>p.margem>=20&&p.margem<40);
  const alta=comMargem.filter(p=>p.margem>=40);
  const mediaGeral=comMargem.reduce((a,p)=>a+p.margem,0)/comMargem.length;
  return `<div class="card"><div class="ct">💰 Análise de margens</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <div style="flex:1;min-width:100px;border:1.5px solid var(--red);border-radius:10px;padding:8px 10px"><div style="font-size:12px;font-weight:700;color:var(--red)">Baixa &lt;20%<span style="float:right">${baixa.length}</span></div></div>
      <div style="flex:1;min-width:100px;border:1.5px solid var(--yellow);border-radius:10px;padding:8px 10px"><div style="font-size:12px;font-weight:700;color:var(--yellow)">Média 20–40%<span style="float:right">${media.length}</span></div></div>
      <div style="flex:1;min-width:100px;border:1.5px solid var(--green);border-radius:10px;padding:8px 10px"><div style="font-size:12px;font-weight:700;color:var(--green)">Alta ≥40%<span style="float:right">${alta.length}</span></div></div>
    </div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:8px">Margem média do catálogo: <strong style="color:var(--c2)">${mediaGeral.toFixed(1)}%</strong></div>
    ${baixa.length?`<div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:4px">⚠️ Margens críticas (revisar precificação)</div>`+baixa.slice(0,5).map(p=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--gray-light);font-size:12px"><span style="color:var(--c2)">${esc(p.nome)}</span><span style="color:var(--red);font-weight:700">${p.margem.toFixed(1)}%</span></div>`).join(''):''}
  </div>`;
}

// ──────────────────────────────────────────────────
//  SERVICE WORKER (PWA — funciona quando hospedado)
// ──────────────────────────────────────────────────
let _swRefreshing=false;
function _forcarAtualizacao(){
  if(_swRefreshing) return;
  _swRefreshing=true;
  toast('🔄 Nova versão disponível. Atualizando...');
  setTimeout(()=>location.reload(),1500);
}

// ── FILA OFFLINE: reenvio automático ao reconectar ──────────────
// Os saves são local-first: gravam no localStorage na hora e tentam subir ao
// banco em background. Se estava sem internet, os loaders de cada tela já
// reenviam os pendentes ao abrir a tela. Aqui garantimos o reenvio também
// assim que a conexão volta (sem precisar navegar) e num intervalo suave.
let _reenvioEmAndamento=false;
// Há algo salvo localmente que ainda não subiu ao banco?
function _temPendentes(){
  try{
    if((typeof lsOrcLer==='function'?lsOrcLer():[]).some(o=>String(o.id).startsWith('local_'))) return true;
    if((typeof lsVisLer==='function'?lsVisLer():[]).some(v=>v&&v._pendingSync===true)) return true;
    if((typeof lsAgLer==='function'?lsAgLer():[]).some(a=>String(a.id).startsWith('ag_'))) return true;
    if(JSON.parse(ls('fluxa_os_hist')||'[]').some(o=>String(o.id).startsWith('local_'))) return true;
  }catch(e){ console.warn('[temPendentes]', e?.message||e); }
  return false;
}
async function _reenviarPendentes(silencioso=true){
  if(!dbOk||!db||_reenvioEmAndamento||!navigator.onLine) return;
  if(silencioso && !_temPendentes()) return; // nada preso → não gasta rede à toa
  _reenvioEmAndamento=true;
  try{
    // Orçamentos presos só no aparelho (id local_*)
    try{ const soLocal=(typeof lsOrcLer==='function'?lsOrcLer():[]).filter(o=>String(o.id).startsWith('local_')); if(soLocal.length) await _reenviarOrcamentosLocais(soLocal); }catch(e){ console.warn('[reenvio orc]',e?.message||e); }
    // OS presas só no aparelho (id local_*)
    try{ const soLocalOS=JSON.parse(ls('fluxa_os_hist')||'[]').filter(o=>String(o.id).startsWith('local_')); if(soLocalOS.length) await _reenviarOSLocais(soLocalOS); }catch(e){ console.warn('[reenvio os]',e?.message||e); }
    // Vistorias pendentes (loadVistoriasRemoto reenvia as _pendingSync + sobe fotos)
    try{ await loadVistoriasRemoto?.(); }catch(e){ console.warn('[reenvio vis]',e?.message||e); }
    // Agendamentos presos (loadAgendamentos agora faz merge + reenvio)
    try{ await loadAgendamentos?.(); }catch(e){ console.warn('[reenvio ag]',e?.message||e); }
    if(!silencioso) toast('✅ Dados pendentes sincronizados');
  }finally{ _reenvioEmAndamento=false; }
}
window.addEventListener('online', ()=>{ toast('🌐 Conexão restaurada — sincronizando…'); _reenviarPendentes(false); });
// Rede de segurança: a cada 3 min, se online, empurra pendentes silenciosamente
setInterval(()=>{ if(navigator.onLine) _reenviarPendentes(true); }, 180000);

if('serviceWorker' in navigator){
  // Reload automático quando um novo SW assume o controle (nova versão deployada)
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!_swRefreshing){ _swRefreshing=true; location.reload(); }
  });
  navigator.serviceWorker.addEventListener('message',e=>{
    if(e.data?.type==='NEW_VERSION') _forcarAtualizacao();
  });
  navigator.serviceWorker.register('sw.js').then(reg=>{
    console.log('Service Worker registrado');
    setInterval(()=>reg.update(),60*1000);
  }).catch(()=>{});
}

// ── Detector de nova versão por ETag/Last-Modified ──
// Não depende de bumpar o sw.js: pergunta ao servidor se o index.html mudou.
// Assim, qualquer deploy aparece sozinho nas abas abertas (mobile e desktop).
let _appTag=null;
async function _verificarVersaoApp(){
  if(_swRefreshing) return;
  try{
    const res=await fetch(location.pathname+'?_v='+Date.now(),{method:'HEAD',cache:'no-store'});
    if(!res.ok) return;
    const tag=res.headers.get('ETag')||res.headers.get('Last-Modified');
    if(!tag) return;
    if(_appTag===null){ _appTag=tag; return; } // primeira leitura: só guarda
    if(tag!==_appTag){ _appTag=tag; _forcarAtualizacao(); }
  }catch(e){ /* offline — ignora silenciosamente */ }
}
// Primeira checagem após 5s e depois a cada 60s
setTimeout(_verificarVersaoApp,5*1000);
setInterval(_verificarVersaoApp,60*1000);
// Verifica também quando a aba volta ao foco (técnico reabre o app no celular)
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') _verificarVersaoApp(); });

// ═══════════════════════ CRM / FUNIL DE VENDAS ═══════════════════════
// Kanban de orçamentos por etapa + follow-ups + histórico de contatos.
// Colunas do banco (delta19): proximo_contato (date), crm_notas (jsonb), motivo_perda (text).
// Kill-switch por empresa: empresas.config.flags.crm === false esconde o módulo (padrão: ligado).
function _crmAtivo(){ try{ return !(FLUXA_CONFIG.flags && FLUXA_CONFIG.flags.crm===false); }catch(e){ return true; } }

const CRM_ETAPAS=[
  {id:'pendente',  nome:'Em negociação', cor:'#f59e0b'},
  {id:'aprovado',  nome:'Aprovado',      cor:'#16a34a'},
  {id:'concluido', nome:'Concluído',     cor:'#2563eb'},
  {id:'perdido',   nome:'Perdido',       cor:'#94a3b8'}
];
const CRM_MOTIVOS_PERDA=['Preço','Concorrência','Desistiu / adiou','Sem retorno','Outro'];
const _CRM_JANELA_DIAS=90; // Concluído/Perdido mostram só os últimos 90 dias (o resto fica no Histórico)
// Situação — por que a negociação está demorando (comum em manutenção/condomínio:
// decisão passa por síndico → conselho → assembleia, ou o cliente está comparando
// orçamentos com outros prestadores). Some quando o card sai de "pendente".
const CRM_SITUACOES=[
  {id:'aguardando_aprovacao', emoji:'🗳️', label:'Aguardando aprovação (síndico/conselho)'},
  {id:'concorrencia',         emoji:'⚔️', label:'Concorrência — comparando orçamentos'},
  {id:'negociando_valor',     emoji:'💰', label:'Negociando valor/condição'}
];
const CRM_PAPEIS_CONTATO=['Síndico','Síndico profissional','Conselho/Administradora','Zelador','Financeiro'];

function _crmEtapaDoOrc(o){
  const st=o.status||'pendente';
  if(st==='recusado'||st==='vencido') return 'perdido';
  if(st==='aprovado'){
    const osV=(todosOS||[]).find(x=>x.orcamento_id===o.id);
    return (osV&&osV.status==='concluido')?'concluido':'aprovado';
  }
  return 'pendente';
}
function _crmNotas(o){
  try{ const n=typeof o.crm_notas==='string'?JSON.parse(o.crm_notas):o.crm_notas; return Array.isArray(n)?n:[]; }
  catch(e){ return []; }
}
function _crmUltimoContatoTs(o){
  let t=new Date(o.data_criacao||Date.now()).getTime(); if(isNaN(t)) t=Date.now();
  _crmNotas(o).forEach(n=>{ const nt=new Date(n.data).getTime(); if(!isNaN(nt)&&nt>t) t=nt; });
  return t;
}
function _crmDiasSemContato(o){ return Math.floor((Date.now()-_crmUltimoContatoTs(o))/86400000); }
function _crmEsfriando(o){ return _crmEtapaDoOrc(o)==='pendente' && _crmDiasSemContato(o)>=7 && _crmFuStatus(o)!=='futuro'; }
function _crmFuStatus(o){ // 'atrasado' | 'hoje' | 'futuro' | null
  if(!o.proximo_contato) return null;
  const hoje=_hojeLocal();
  if(o.proximo_contato<hoje) return 'atrasado';
  if(o.proximo_contato===hoje) return 'hoje';
  return 'futuro';
}
function _crmDataBr(iso){ if(!iso) return ''; const p=String(iso).slice(0,10).split('-'); return p.length===3?`${p[2]}/${p[1]}`:iso; }
function _crmSituacaoCfg(id){ return CRM_SITUACOES.find(s=>s.id===id)||null; }
function _crmDiasNaEtapa(o){
  const ref=o.etapa_desde||o.data_criacao; if(!ref) return 0;
  const t=new Date(ref).getTime(); if(isNaN(t)) return 0;
  return Math.max(0,Math.floor((Date.now()-t)/86400000));
}
function _crmContatos(o){
  try{ const c=typeof o.crm_contatos==='string'?JSON.parse(o.crm_contatos):o.crm_contatos; return Array.isArray(c)?c:[]; }
  catch(e){ return []; }
}
// Cliente do orçamento — usado só pra detectar "tipo:condominio" e enriquecer a UX do funil,
// nunca pra decisão de negócio (fallback silencioso se o cadastro não tiver o campo).
function _crmCliente(o){
  try{
    const lista=lsCliLer();
    return (o.cliente_id&&lista.find(x=>x.id===o.cliente_id)) || lista.find(x=>x.nome===o.cliente) || null;
  }catch(e){ return null; }
}
function _crmEhCondominio(o){ return _crmCliente(o)?.tipo==='condominio'; }
// Mensagem de WhatsApp adaptada à situação real da negociação — cobrança educada,
// nunca genérica ("posso ajudar?"), reforçando o que falta pra decisão andar.
function notifOrcamentoPorSituacao(o){
  const nome=(o.cliente||'').split(' ')[0]||'';
  const sit=o.crm_situacao;
  const numero='#'+String(o.numero||'').padStart(3,'0');
  if(sit==='aguardando_aprovacao'){
    const prev=o.crm_decisao_prevista?` Fico no aguardo da reunião${o.crm_decisao_prevista?' do dia '+_crmDataBr(o.crm_decisao_prevista):''}.`:'';
    return `Olá${nome?', '+nome:''}! Passando para saber se já há novidade da aprovação do orçamento ${numero} pelo síndico/conselho.${prev} Qualquer dúvida adicional que ajude a decidir, é só chamar 🙂`;
  }
  if(sit==='concorrencia'){
    return `Olá${nome?', '+nome:''}! Sei que vocês devem estar avaliando outras opções para o serviço — fico à disposição para tirar dúvidas sobre o orçamento ${numero} ou ajustar alguma condição. Nosso diferencial é o acompanhamento e a garantia do serviço, não só o preço. Posso ajudar em algo?`;
  }
  if(sit==='negociando_valor'){
    return `Olá${nome?', '+nome:''}! Sobre o orçamento ${numero}, consigo ver com a gestão se cabe algum ajuste nas condições de pagamento para fechar. Qual seria o formato ideal pra vocês?`;
  }
  return typeof notifOrcamento==='function' ? notifOrcamento(o) : `Olá${nome?', '+nome:''}! Passando para saber sobre o orçamento ${numero}.`;
}

// Núcleo de cálculo do funil — compartilhado entre o board completo (renderCRM)
// e o resumo do Painel (renderPainelCRM), pra nunca divergir os dois números.
function _crmComputarStats(){
  const lista=filtrarPorLoja(todosOrc||[]);
  const limite=Date.now()-_CRM_JANELA_DIAS*86400000;
  const porEtapa={pendente:[],aprovado:[],concluido:[],perdido:[]};
  lista.forEach(o=>{
    const et=_crmEtapaDoOrc(o);
    if((et==='concluido'||et==='perdido')){
      const ref=new Date(o.data_aprovacao||o.data_criacao||0).getTime();
      if(ref&&ref<limite) return; // fechados antigos ficam só no Histórico
    }
    porEtapa[et].push(o);
  });
  const soma=arr=>arr.reduce((s,o)=>s+(parseFloat(o.total)||0),0);
  const neg=porEtapa.pendente;
  const decididos=lista.filter(o=>{
    const et=_crmEtapaDoOrc(o); if(et==='pendente') return false;
    const ref=new Date(o.data_aprovacao||o.data_criacao||0).getTime();
    return ref>=limite;
  });
  const ganhos=decididos.filter(o=>_crmEtapaDoOrc(o)!=='perdido').length;
  const fuDue=lista.filter(o=>['pendente','aprovado'].includes(_crmEtapaDoOrc(o))&&['atrasado','hoje'].includes(_crmFuStatus(o)));
  return {lista, porEtapa, soma, neg, negSoma:soma(neg), decididos, ganhos,
    conversao: decididos.length?Math.round(ganhos/decididos.length*100):null,
    fuDue, esfriandoQtd: neg.filter(_crmEsfriando).length};
}

// Resumo do funil pro Painel — mesmos números do board completo (via _crmComputarStats),
// só que compactos e com atalho pra abrir os itens que precisam de atenção agora.
function renderPainelCRM(){
  const body=document.getElementById('painel-crm-body'); if(!body) return;
  if(!_crmAtivo()){ document.getElementById('painel-crm-card').style.display='none'; return; }
  if(typeof verificarVencidos==='function') verificarVencidos();
  const {neg, negSoma, fuDue, conversao, esfriandoQtd}=_crmComputarStats();
  const atrasados=fuDue.filter(o=>_crmFuStatus(o)==='atrasado');
  body.innerHTML=`
    <div class="painel-crm-stats">
      <div class="painel-crm-stat"><div class="pcs-v">${brl(negSoma)}</div><div class="pcs-l">${neg.length} em negociação</div></div>
      <div class="painel-crm-stat"><div class="pcs-v">${conversao===null?'—':conversao+'%'}</div><div class="pcs-l">conversão (90d)</div></div>
      <div class="painel-crm-stat"><div class="pcs-v" style="color:${fuDue.length?'var(--yellow)':'inherit'}">${fuDue.length}</div><div class="pcs-l">follow-up hoje</div></div>
      <div class="painel-crm-stat"><div class="pcs-v" style="color:${esfriandoQtd?'var(--red)':'inherit'}">${esfriandoQtd}</div><div class="pcs-l">esfriando</div></div>
    </div>
    ${atrasados.length?`<div class="painel-crm-alerta" onclick="go('crm')">⚠️ ${atrasados.length} follow-up${atrasados.length===1?'':'s'} atrasado${atrasados.length===1?'':'s'} — <u>ver no funil</u></div>`:''}`;
}

// ══════════════════════════════════════════════════
//  CADÊNCIA DE RECOMPRA — portado do fluxa-app v1 (16/08), adaptado.
//
//  Achado ao portar: o motor de priorização do v1 (crmCandidatos, fora
//  desta seção) é calibrado com números medidos no histórico de vendas DA
//  FORTHEMP (taxa de conversão 6,8%/39,8% por "trilho equipamento/serviço",
//  regex de produto tipo /trocador|fromtherm|jelly/i — nomes de produto da
//  Forthemp, sem sentido nenhum pra manutenção de piscina). O Marcos
//  confirmou (2026-08-16): construir mesmo assim, mas com número neutro em
//  vez de copiar a calibração de outro negócio, e atrás de flag até ter
//  dado real pra calibrar de verdade. Por isso NÃO portei crmCandidatos()
//  nem a divisão em dois trilhos — o v2 já tem sua própria priorização de
//  follow-up (_crmComputarStats, sem calibração nenhuma, só data/dias).
//
//  O que ESTE bloco porta é analiseClientes()/cadenciaCandidatos()/
//  cadenciaProximos() — o ritmo de recompra é auto-referente (compara o
//  cliente com o HISTÓRICO DELE MESMO, não com uma taxa externa), então não
//  carrega nenhum número de outro negócio. Com banco zerado (nenhum
//  aprovado ainda) devolve listas vazias — comportamento correto, não bug.
//
//  Ativar: `flagAtiva('crm_cadencia')` — desligado por padrão (ver
//  admin_set_flag_empresa ou empresas.config.flags direto no banco).
// ══════════════════════════════════════════════════
function _cliChave(o){
  return o.cliente_id ? 'id:'+o.cliente_id : 'nome:'+String(o.cliente||'').trim().toLowerCase();
}

// Ritmo de compra por cliente: intervalo OBSERVADO entre aprovações reais
// (2+ compras), ou previsão TEÓRICA por volume de piscina (1 compra, com
// piscina cadastrada — usa demandaDiaria()/consumoTeoricoDias(), task CRM
// anterior). O intervalo observado sempre tem prioridade sobre o teórico.
function analiseClientes(){
  const orcs=filtrarPorLoja(todosOrc||[]).filter(o=>(o.cliente||'').trim());
  const aprov=orcs.filter(o=>o.status==='aprovado');
  const map=new Map();
  aprov.forEach(o=>{
    const k=_cliChave(o);
    if(!map.has(k)) map.set(k,{chave:k, nome:o.cliente, porId:!!o.cliente_id, orcs:[], valor:0});
    const g=map.get(k); g.orcs.push(o); g.valor+=parseFloat(o.total)||0;
    if(o.cliente_id) g.porId=true;
  });
  const lista=[...map.values()].map(g=>{
    const datas=g.orcs.map(o=>{ const ap=o.data_aprovacao?new Date(o.data_aprovacao):null;
      return (ap&&!isNaN(ap))?ap:_orcData(o); }).filter(d=>d&&!isNaN(d)).sort((a,b)=>a-b);
    const primeiro=datas[0], ultimo=datas[datas.length-1];
    let intervaloMedioDias=null;
    if(datas.length>=2){
      const intervalos=[];
      for(let i=1;i<datas.length;i++) intervalos.push((datas[i]-datas[i-1])/86400000);
      intervaloMedioDias=Math.round(intervalos.reduce((a,b)=>a+b,0)/intervalos.length);
    }
    const diasDesdeUltima = ultimo ? Math.round((new Date(_hojeLocal()+'T12:00:00')-ultimo)/86400000) : null;
    // Multiplicadores são heurística de bucket sobre dado real (não são
    // fato) — 1.3x/2.5x dão folga contra variação natural de agenda antes
    // de soar alarme.
    let ritmo=null;
    if(intervaloMedioDias && diasDesdeUltima!=null){
      ritmo = diasDesdeUltima<=intervaloMedioDias*1.3 ? 'em_dia'
            : diasDesdeUltima<=intervaloMedioDias*2.5 ? 'reduziu' : 'parou';
    }
    // Só pra quem comprou 1 vez e tem piscina com volume conhecido — some
    // sozinho assim que houver 2ª compra (o observado acima tem prioridade).
    let previsaoTeorica=null;
    if(g.porId && g.orcs.length===1 && !intervaloMedioDias && diasDesdeUltima!=null){
      const cid=g.chave.startsWith('id:')?g.chave.slice(3):null;
      const piscina=cid && (todasPiscinas||[]).find(p=>p.cliente_id===cid && p.ativo!==false && p.volume_m3);
      if(piscina){
        const calc=consumoTeoricoDias(piscina.tipo_tratamento, piscina.volume_m3, demandaDiaria(piscina), piscina.exposicao_solar);
        if(calc) previsaoTeorica={...calc, piscinaNome:piscina.nome, diasAte:calc.dias-diasDesdeUltima};
      }
    }
    return {...g, compras:g.orcs.length, ticket:g.valor/g.orcs.length,
      primeiro, ultimo, recompra:g.orcs.length>1,
      diasDesdeUltima, intervaloMedioDias, ritmo, previsaoTeorica};
  }).sort((a,b)=>b.valor-a.valor);
  return {lista};
}

const LS_CAD_FB='fluxa_cadencia_feedback';
// R-4: ls/lsSet (escopado por empresa), não localStorage direto — senão o
// "dispensei essa oportunidade" vaza entre empresas no mesmo aparelho.
function _cadFbLer(){ try{ return JSON.parse(ls(LS_CAD_FB)||'{}'); }catch(e){ return {}; } }
function _cadFbSalvar(m){ try{ lsSet(LS_CAD_FB, JSON.stringify(m)); }catch(e){ console.warn('[cadFb]', e?.message||e); } }
// 14 dias, não os poucos dias de um follow-up de orçamento — ciclo de
// recompra é de semanas/meses, cobrar de novo tão cedo seria chatice.
function _cadFbOculto(cid){
  const f=_cadFbLer()[cid]; if(!f) return false;
  return (Date.now()-f.dispensado_em) < 14*86400000;
}
function cadenciaDispensar(cid){
  const m=_cadFbLer(); m[cid]={dispensado_em:Date.now()}; _cadFbSalvar(m);
  toast('Ok, não aviso de novo por 14 dias');
  renderPainelCadencia();
  if(typeof renderPainelFilaHoje==='function') renderPainelFilaHoje();
}

// Já passou do próprio ritmo (ou da previsão teórica) — hora de avisar.
function cadenciaCandidatos(){
  const {lista}=analiseClientes();
  const observado=lista
    .filter(c=>c.porId && (c.ritmo==='reduziu'||c.ritmo==='parou') && !_cadFbOculto(c.chave.slice(3)))
    .map(c=>({...c, origem:'observado', atraso:c.diasDesdeUltima-c.intervaloMedioDias}));
  const teorico=lista
    .filter(c=>c.porId && c.previsaoTeorica && c.previsaoTeorica.diasAte<0 && !_cadFbOculto(c.chave.slice(3)))
    .map(c=>({...c, origem:'teorico', atraso:-c.previsaoTeorica.diasAte}));
  return [...observado, ...teorico].sort((a,b)=>b.atraso-a.atraso);
}
// Avisa ~7 dias ANTES de vencer o próprio ritmo — dá tempo de se antecipar.
const CADENCIA_JANELA_PROXIMOS=7;
function cadenciaProximos(){
  const {lista}=analiseClientes();
  const observado=lista
    .filter(c=>c.porId && c.ritmo==='em_dia' && c.intervaloMedioDias
      && (c.intervaloMedioDias-c.diasDesdeUltima)>=0
      && (c.intervaloMedioDias-c.diasDesdeUltima)<=CADENCIA_JANELA_PROXIMOS
      && !_cadFbOculto(c.chave.slice(3)))
    .map(c=>({...c, origem:'observado', faltam:c.intervaloMedioDias-c.diasDesdeUltima}));
  const teorico=lista
    .filter(c=>c.porId && c.previsaoTeorica
      && c.previsaoTeorica.diasAte>=0 && c.previsaoTeorica.diasAte<=CADENCIA_JANELA_PROXIMOS
      && !_cadFbOculto(c.chave.slice(3)))
    .map(c=>({...c, origem:'teorico', faltam:c.previsaoTeorica.diasAte}));
  return [...observado, ...teorico].sort((a,b)=>a.faltam-b.faltam);
}

// Card do Painel — mesmo padrão visual do painel-crm-card, atrás da flag
// 'crm_cadencia' (desligada por padrão). Chamado de dentro de
// renderPainelCRM()'s vizinho no boot da tela (ver go('painel')).
function renderPainelCadencia(){
  const card=document.getElementById('painel-cadencia-card'); if(!card) return;
  if(!flagAtiva('crm_cadencia')){ card.style.display='none'; return; }
  const atrasados=cadenciaCandidatos();
  const proximos=cadenciaProximos();
  if(!atrasados.length && !proximos.length){ card.style.display='none'; return; }
  card.style.display='';
  const body=document.getElementById('painel-cadencia-body'); if(!body) return;
  const linha=c=>`<div class="painel-crm-alerta" style="cursor:default;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px">
    <span>${esc(c.nome||'—')} — ${c.origem==='teorico'?'previsão por volume':'costuma comprar a cada '+c.intervaloMedioDias+'d'}</span>
    <button type="button" class="tb" onclick="cadenciaDispensar('${c.chave.slice(3)}')" title="Não avisar de novo por 14 dias">✕</button>
  </div>`;
  body.innerHTML =
    (atrasados.length?`<div class="painel-crm-stat" style="text-align:left;padding:0 0 4px"><b>${atrasados.length}</b> cliente${atrasados.length!==1?'s':''} atrasado${atrasados.length!==1?'s':''} na recompra</div>${atrasados.slice(0,5).map(linha).join('')}`:'') +
    (proximos.length?`<div class="painel-crm-stat" style="text-align:left;padding:8px 0 4px"><b>${proximos.length}</b> vai${proximos.length!==1?'ão':''} precisar em breve</div>${proximos.slice(0,5).map(linha).join('')}`:'');
}

// ══════════════════════════════════════════════════
//  FILA UNIFICADA "PRECISA DE VOCÊ HOJE" (17/08, task #45)
//  Junta follow-up do funil + cadência de recompra (atrás de flag) +
//  estoque a comprar numa lista só, ranqueada por urgência. Não calcula
//  nada novo — só lê o que _crmComputarStats()/cadenciaCandidatos()/
//  listaEncomendas() já calculam em outro lugar (cada um continua sendo a
//  fonte de verdade do próprio número) e ordena junto.
// ══════════════════════════════════════════════════
// ──────────────────────────────────────────────────
//  ALERTAS DERIVADOS NO SINO
// ──────────────────────────────────────────────────
// O sino já existia com o histórico de push (native.js). O que faltava era
// o que a fila "Precisa de você hoje" mostra: alertas DERIVADOS dos dados
// (follow-up vencido, recompra atrasada, material faltando). Esses só
// apareciam na tela do painel — quem não abre o painel nunca via. Aqui eles
// entram no mesmo sino, alcançáveis de qualquer tela, sem duplicar nenhum
// cálculo: só agrega os motores que já existem.
//
// Dispensar (✕) é snooze de 1 dia, não "marcar lido": alerta derivado não é
// um evento que aconteceu, é uma CONDIÇÃO — some quando o dado muda e volta
// se a condição voltar. Push é o contrário (evento), e continua lido de vez.
const LS_NOTIF_DISMISS='fluxa_notif_dismiss';
function _notifDismissLer(){ try{ return JSON.parse(ls(LS_NOTIF_DISMISS)||'{}'); }catch(e){ return {}; } }
function _notifDismissAtivo(id){ const t=_notifDismissLer()[id]; return !!t && (Date.now()-t)<86400000; }
function notifDispensar(id, ev){
  if(ev) ev.stopPropagation();
  const m=_notifDismissLer(); m[id]=Date.now();
  try{ lsSet(LS_NOTIF_DISMISS, JSON.stringify(m)); }catch(e){ console.warn('[notifDismiss]', e?.message||e); }
  toast('Ok, não aviso de novo por hoje');
  if(typeof renderNotificacoes==='function') renderNotificacoes();
}
// Cada bloco com try/catch próprio: erro num motor não pode apagar os avisos
// dos outros.
function getNotificacoes(){
  const out=[];
  try{
    if(_crmAtivo()){
      const {fuDue}=_crmComputarStats();
      const atrasados=fuDue.filter(o=>_crmFuStatus(o)==='atrasado').length;
      if(fuDue.length) out.push({id:'crm-fila', cor:'var(--c1)', icone:'📞',
        titulo:`${fuDue.length} follow-up${fuDue.length!==1?'s':''} a fazer`,
        sub: atrasados?`${atrasados} já atrasado${atrasados!==1?'s':''}`:'previstos pra hoje',
        acao:'Ver', fn:"go('crm')"});
    }
  }catch(e){ console.warn('[notif:fila]', e?.message||e); }
  try{
    if(flagAtiva('crm_cadencia')){
      const cad=cadenciaCandidatos();
      if(cad.length) out.push({id:'crm-cadencia', cor:'var(--c1)', icone:'🔁',
        titulo:`${cad.length} cliente${cad.length!==1?'s':''} atrasado${cad.length!==1?'s':''} na recompra`,
        sub:'Pelo próprio ritmo de consumo, já deveriam ter voltado',
        acao:'Ver', fn:"go('painel')"});
    }
  }catch(e){ console.warn('[notif:cadencia]', e?.message||e); }
  try{
    if(eGestor()){
      const enc=listaEncomendas();
      if(enc.length) out.push({id:'estoque-encomenda', cor:'var(--red)', icone:'📦',
        titulo:`${enc.length} produto${enc.length!==1?'s':''} em falta`,
        sub:`Vendido sem saldo — o mais crítico é ${enc[0].p.nome}`,
        acao:'Ver', fn:"go('estoque')"});
    }
  }catch(e){ console.warn('[notif:encomenda]', e?.message||e); }
  try{
    if(eGestor()){
      const grupos=_dupGrupos();
      const fichas=grupos.reduce((a,g)=>a+g.qtd,0);
      if(fichas) out.push({id:'clientes-duplicados', cor:'var(--yellow)', icone:'👥',
        titulo:`${fichas} ficha${fichas!==1?'s':''} de cliente duplicada${fichas!==1?'s':''}`,
        sub:'Nenhuma tem histórico vinculado — dá pra limpar com segurança',
        acao:'Revisar', fn:"go('clientes')"});
    }
  }catch(e){ console.warn('[notif:duplicados]', e?.message||e); }
  return out.filter(n=>n.id && !_notifDismissAtivo(n.id));
}
// Throttle: getNotificacoes() varre clientes/orçamentos/estoque, e o badge é
// chamado de vários pontos de navegação. 5s é curto o bastante pra parecer
// instantâneo e longo o bastante pra não recalcular em cascata.
let _notifBadgeUltimo=0;
function _notifAtualizarBadge(forcar){
  if(!forcar && Date.now()-_notifBadgeUltimo<5000) return;
  _notifBadgeUltimo=Date.now();
  try{ if(typeof _fluxaAtualizarBadgeNotif==='function') _fluxaAtualizarBadgeNotif(); }
  catch(e){ console.warn('[notif badge]', e?.message||e); }
}
function _notifCorBadge(cor){
  if(cor==='var(--red)') return 'icon-badge-red';
  if(cor==='var(--yellow)') return 'icon-badge-yellow';
  if(cor==='var(--c1)') return 'icon-badge-c1';
  return 'icon-badge-gray';
}
// HTML dos alertas derivados, consumido por renderNotificacoes() (native.js).
// Fica aqui porque depende dos motores de negócio, que só existem no app.js.
function _notifDerivadosHTML(){
  let itens=[];
  try{ itens=getNotificacoes(); }catch(e){ console.warn('[notif]', e?.message||e); return {html:'', qtd:0}; }
  const html=itens.map(n=>`
    <div class="notif-item notif-item-derivado nao-lida">
      <div class="notif-derivado-linha">
        <div class="icon-badge ${_notifCorBadge(n.cor)}">${n.icone}</div>
        <div style="flex:1;min-width:0">
          <div class="notif-item-titulo">${esc(n.titulo)}</div>
          <div class="notif-item-corpo">${esc(n.sub||'')}</div>
        </div>
      </div>
      <div class="notif-derivado-acts">
        <button class="tb g" onclick="closeNotificacoes();${n.fn}">${esc(n.acao)}</button>
        <button class="tb d" onclick="notifDispensar('${n.id}',event)" title="Dispensar por hoje">✕</button>
      </div>
    </div>`).join('');
  return {html, qtd:itens.length};
}

function _filaHojeItens(){
  const itens=[];
  // Oportunidades de vistoria: laudo do técnico esperando virar orçamento.
  // Crítico pesa mais que atenção; um clique já abre o orçamento pré-preenchido.
  _visOportunidades().forEach(op=>{
    itens.push({
      peso: op.criticos?0:1,
      icone: op.criticos?'🔧🔴':'🔧',
      titulo: op.cliente,
      sub: `vistoria de ${_visDataBR(op.data)} · ${op.total} ${op.total!==1?'itens':'item'} a orçar${op.criticos?` (${op.criticos} crítico${op.criticos!==1?'s':''})`:''}`,
      onclick: `orcarDaVistoria('${op.id}')`,
      dismiss: `event.stopPropagation();_visOportDismiss('${op.id}')`
    });
  });
  // OS atrasadas — agendada com data no passado. É o "aja agora" mais claro:
  // serviço marcado que não aconteceu. Peso máximo.
  {
    const _hj=_hojeLocal();
    filtrarPorLoja(todosOS||[])
      .filter(o=>o.status==='agendado' && o.data_servico && o.data_servico<_hj)
      .sort((a,b)=>(a.data_servico||'').localeCompare(b.data_servico||''))
      .slice(0,8)
      .forEach(o=>{
        const dias=Math.round((new Date(_hj+'T12:00:00')-new Date(o.data_servico+'T12:00:00'))/86400000);
        itens.push({
          peso:0, icone:'📋🔴',
          titulo:`${o.cliente||'—'} · OS #${String(o.numero||'').padStart(3,'0')}`,
          sub:`atrasada ${dias} dia${dias!==1?'s':''} · agendada ${_visDataBR(o.data_servico)}`,
          onclick:`verDetalhesOS('${o.id}')`
        });
      });
  }
  // Manutenção preventiva vencida/vencendo (planos recorrentes).
  _manutencoesPreventivas().forEach(m=>{
    const vencida=m.diasAte<0;
    const per={semanal:'semanal',quinzenal:'quinzenal',mensal:'mensal'}[m.periodicidade]||m.periodicidade;
    const quando = m.nuncaVistoriado ? `plano ${per} sem 1ª vistoria`
      : vencida ? `manutenção ${per} vencida há ${-m.diasAte} dia${m.diasAte!==-1?'s':''}`
      : m.diasAte===0 ? `manutenção ${per} vence hoje` : `manutenção ${per} vence em ${m.diasAte} dia${m.diasAte!==1?'s':''}`;
    itens.push({
      peso: vencida||m.nuncaVistoriado?2:3, icone:'🗓️',
      titulo: m.cliente + (m.local?` · ${m.local}`:''),
      sub: quando,
      onclick: `go('visitas')`,
      dismiss: `event.stopPropagation();_manutDismiss('${m.chave}')`
    });
  });
  if(_crmAtivo()){
    const {fuDue}=_crmComputarStats();
    fuDue.forEach(o=>{
      const atrasado=_crmFuStatus(o)==='atrasado';
      itens.push({
        peso: atrasado?0:2,
        icone: atrasado?'🔴':'🟡',
        titulo: o.cliente||'—',
        sub: `${atrasado?'follow-up atrasado':'follow-up hoje'} · #${String(o.numero||'').padStart(3,'0')} · ${brl(parseFloat(o.total)||0)}`,
        onclick: `abrirCrmCard('${o.id}')`
      });
    });
  }
  if(eGestor() && typeof listaEncomendas==='function'){
    listaEncomendas().slice(0,5).forEach(({p,falta})=>{
      itens.push({
        peso:1, icone:'📦',
        titulo: p.nome,
        sub: `faltam ${fmtQtd(falta)} ${p.unidade||'un'} — comprar`,
        onclick: `go('estoque')`
      });
    });
  }
  // Garantias vencendo/vencidas — janela de 30 dias. Renovar ou avisar o cliente
  // antes de virar problema. Peso baixo (não é urgente hoje).
  if(eGestor()){
    const _hjG=new Date(_hojeLocal()+'T12:00:00');
    filtrarPorLoja(todosEq||[])
      .map(e=>{ if(!e.garantia_vencimento) return null; const dias=Math.ceil((new Date(e.garantia_vencimento+'T12:00:00')-_hjG)/86400000); return dias<=30?{e,dias}:null; })
      .filter(Boolean)
      .sort((a,b)=>a.dias-b.dias)
      .slice(0,5)
      .forEach(({e,dias})=>{
        itens.push({
          peso:3, icone:'🛡️',
          titulo:`${[e.marca,e.modelo].filter(Boolean).join(' ')||e.tipo||'Equipamento'} · ${e.cliente_nome||'—'}`,
          sub: dias<0?`garantia vencida há ${-dias} dia${dias!==-1?'s':''}`:dias===0?'garantia vence hoje':`garantia vence em ${dias} dia${dias!==1?'s':''}`,
          onclick:`go('equipamentos')`
        });
      });
  }
  if(flagAtiva('crm_cadencia')){
    cadenciaCandidatos().slice(0,5).forEach(c=>{
      itens.push({
        peso:3, icone:'🔁',
        titulo: c.nome||'—',
        sub: c.origem==='teorico'?'previsão por volume — recompra atrasada':`costuma comprar a cada ${c.intervaloMedioDias}d — atrasado`,
        onclick: `go('painel')` // cadência já tem o próprio card com dispensar; aqui só sinaliza e leva pro painel
      });
    });
  }
  itens.sort((a,b)=>a.peso-b.peso);
  return itens;
}
function renderPainelFilaHoje(){
  const card=document.getElementById('painel-fila-card'); if(!card) return;
  const body=document.getElementById('painel-fila-body'); if(!body) return;
  const itens=_filaHojeItens();
  if(!itens.length){ card.style.display='none'; return; }
  card.style.display='';
  const total=itens.length;
  const mostrar=itens.slice(0,8);
  body.innerHTML =
    mostrar.map(it=>`<div class="fila-hoje-item" onclick="${it.onclick}">
      <span class="fila-hoje-ico">${it.icone}</span>
      <div class="fila-hoje-tx"><div class="fila-hoje-tit">${esc(it.titulo)}</div><div class="fila-hoje-sub">${esc(it.sub)}</div></div>
      ${it.dismiss?`<button class="fila-hoje-x" title="Dispensar" onclick="${it.dismiss}">✕</button>`:''}
    </div>`).join('')
    + (total>mostrar.length?`<div class="fila-hoje-mais">+ ${total-mostrar.length} outro${total-mostrar.length!==1?'s':''} item${total-mostrar.length!==1?'s':''}</div>`:'');
}

function renderCRM(){
  const board=document.getElementById('crm-board'); if(!board) return;
  if(typeof verificarVencidos==='function') verificarVencidos();
  const {porEtapa, soma, neg, negSoma, fuDue, conversao, esfriandoQtd}=_crmComputarStats();
  // Urgência primeiro: follow-up atrasado > hoje > esfriando > mais recentes
  const peso=o=>{ const f=_crmFuStatus(o); if(f==='atrasado') return 0; if(f==='hoje') return 1; if(_crmEsfriando(o)) return 2; return 3; };
  porEtapa.pendente.sort((a,b)=>peso(a)-peso(b)||new Date(b.data_criacao||0)-new Date(a.data_criacao||0));
  porEtapa.aprovado.sort((a,b)=>peso(a)-peso(b)||new Date(b.data_aprovacao||b.data_criacao||0)-new Date(a.data_aprovacao||a.data_criacao||0));
  porEtapa.concluido.sort((a,b)=>new Date(b.data_aprovacao||b.data_criacao||0)-new Date(a.data_aprovacao||a.data_criacao||0));
  porEtapa.perdido.sort((a,b)=>new Date(b.data_criacao||0)-new Date(a.data_criacao||0));

  // ── Stats ──
  document.getElementById('crm-d-neg').textContent=brl(negSoma);
  document.getElementById('crm-d-neg-q').textContent=`${neg.length} orçamento${neg.length===1?'':'s'}`;
  document.getElementById('crm-d-conv').textContent=conversao===null?'—':conversao+'%';
  document.getElementById('crm-d-fu').textContent=fuDue.length;
  document.getElementById('crm-d-fu-q').textContent=fuDue.some(o=>_crmFuStatus(o)==='atrasado')?'⚠️ há atrasados':'a contatar';
  document.getElementById('crm-d-frio').textContent=esfriandoQtd;

  // ── Follow-ups do dia ──
  const fuCard=document.getElementById('crm-fu-card');
  const fuLista=document.getElementById('crm-fu-lista');
  if(fuDue.length){
    fuCard.style.display='';
    fuLista.innerHTML=fuDue
      .sort((a,b)=>(a.proximo_contato||'').localeCompare(b.proximo_contato||''))
      .map(o=>{
        const atras=_crmFuStatus(o)==='atrasado';
        return `<div class="crm-fu-item">
          <div class="crm-fu-info" onclick="abrirCrmCard('${o.id}')" style="cursor:pointer">
            <div class="crm-fu-cli">${esc(o.cliente||'—')} <span class="crm-chip ${atras?'fu-atrasado':'fu-hoje'}">${atras?'atrasado · '+_crmDataBr(o.proximo_contato):'hoje'}</span></div>
            <div class="crm-fu-det">#${String(o.numero||'').padStart(3,'0')} · ${brl(parseFloat(o.total)||0)}</div>
          </div>
          ${o.tel_cliente?`<button class="tb" title="Chamar no WhatsApp" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifOrcamento(todosOrc.find(x=>x.id==='${o.id}')), '${esc(o.tel_cliente)}')">💬</button>`:''}
          <button class="tb" title="Marcar contato como feito" onclick="crmFollowupFeito('${o.id}')">✓</button>
        </div>`;
      }).join('');
  } else { fuCard.style.display='none'; fuLista.innerHTML=''; }

  // ── Kanban ──
  board.innerHTML=CRM_ETAPAS.map(et=>{
    const cards=porEtapa[et.id];
    const podeDrop=et.id!=='concluido';
    return `<div class="crm-col" data-etapa="${et.id}"
      ${podeDrop?`ondragover="_crmDragOver(event)" ondragleave="_crmDragLeave(event)" ondrop="_crmDrop(event,'${et.id}')"`:''}>
      <div class="crm-col-hdr">
        <div class="crm-col-titulo"><span class="crm-col-dot" style="background:${et.cor}"></span>${et.nome}</div>
        <span class="crm-col-count">${cards.length}</span>
      </div>
      <div class="crm-col-total">${brl(soma(cards))}${(et.id==='concluido'||et.id==='perdido')?` · ${_CRM_JANELA_DIAS}d`:''}</div>
      ${cards.length?cards.map(o=>_crmCardHTML(o,et.id)).join(''):`<div class="crm-vazio">${et.id==='pendente'?'Nenhum orçamento em negociação':'—'}</div>`}
    </div>`;
  }).join('');
}

function _crmCardHTML(o, etapa){
  const fu=_crmFuStatus(o);
  const frio=_crmEsfriando(o);
  const cls=fu==='atrasado'?'followup-atrasado':fu==='hoje'?'followup-hoje':frio?'esfriando':'';
  const dias=_crmDiasSemContato(o);
  const chips=[];
  const sitCfg=etapa==='pendente'?_crmSituacaoCfg(o.crm_situacao):null;
  if(sitCfg){
    const prev=sitCfg.id==='aguardando_aprovacao'&&o.crm_decisao_prevista?' · decide '+_crmDataBr(o.crm_decisao_prevista):'';
    chips.push(`<span class="crm-chip sit-${sitCfg.id}">${sitCfg.emoji}${prev}</span>`);
  }
  if(fu==='atrasado') chips.push(`<span class="crm-chip fu-atrasado">📞 ${_crmDataBr(o.proximo_contato)}</span>`);
  else if(fu==='hoje') chips.push(`<span class="crm-chip fu-hoje">📞 hoje</span>`);
  else if(fu==='futuro') chips.push(`<span class="crm-chip fu-futuro">📞 ${_crmDataBr(o.proximo_contato)}</span>`);
  if(frio) chips.push(`<span class="crm-chip frio">🧊 ${dias}d parado</span>`);
  if(etapa==='perdido'&&o.motivo_perda) chips.push(`<span class="crm-chip frio">${esc(o.motivo_perda)}</span>`);
  const notas=_crmNotas(o);
  if(notas.length) chips.push(`<span class="crm-chip frio">📝 ${notas.length}</span>`);
  const contatos=_crmContatos(o);
  if(contatos.length) chips.push(`<span class="crm-chip frio" title="Contatos envolvidos na decisão">🧵 ${contatos.length+1}</span>`);
  const condo=_crmEhCondominio(o);
  return `<div class="crm-card ${cls}" draggable="true"
    ondragstart="_crmDragStart(event,'${o.id}')" ondragend="_crmDragEnd(event)"
    onclick="abrirCrmCard('${o.id}')" role="button" tabindex="0"
    onkeydown="if(event.key==='Enter')abrirCrmCard('${o.id}')">
    <div class="crm-card-top"><div class="crm-card-cli">${condo?'🏢 ':''}${esc(o.cliente||'—')}</div><div class="crm-card-num">#${String(o.numero||'').padStart(3,'0')}</div></div>
    <div class="crm-card-valor">${brl(parseFloat(o.total)||0)}</div>
    <div class="crm-card-meta">${chips.join('')}${getOrigemBadge(o.origem_cliente)||''}</div>
  </div>`;
}

// ── Drag & drop (desktop) ──
let _crmDragId=null;
function _crmDragStart(ev,id){ _crmDragId=id; try{ ev.dataTransfer.effectAllowed='move'; ev.dataTransfer.setData('text/plain',id); }catch(e){} ev.target.classList.add('dragging'); }
function _crmDragEnd(ev){ ev.target.classList.remove('dragging'); document.querySelectorAll('.crm-col.drag-over').forEach(c=>c.classList.remove('drag-over')); }
function _crmDragOver(ev){ ev.preventDefault(); ev.currentTarget.classList.add('drag-over'); }
function _crmDragLeave(ev){ ev.currentTarget.classList.remove('drag-over'); }
function _crmDrop(ev,etapa){ ev.preventDefault(); ev.currentTarget.classList.remove('drag-over'); const id=_crmDragId; _crmDragId=null; if(id) crmMoverEtapa(id,etapa); }

function crmMoverEtapa(id, etapa){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const atual=_crmEtapaDoOrc(o);
  if(etapa===atual) return;
  if(etapa==='concluido'){ toast('Conclua a OS vinculada — o card vai pra "Concluído" sozinho.'); return; }
  if(etapa==='perdido'){ _crmPedirMotivoPerda(id); return; }
  fecharCrmCard();
  const extras=etapa==='pendente'?{motivo_perda:null}:undefined;
  _setStatusOrc(id, etapa, extras).then(()=>renderCRM()).catch(e=>console.warn('[crmMoverEtapa]', e?.message||e));
}

// ── Motivo de perda ──
let _crmMotivoSel=null;
function _crmPedirMotivoPerda(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  _crmMotivoSel=null;
  document.getElementById('crm-modal').innerHTML=`
    <h3>Marcar como perdido</h3>
    <div class="crm-modal-sub">#${String(o.numero||'').padStart(3,'0')} · ${esc(o.cliente||'')} — por que não fechou?</div>
    <div class="crm-etapa-btns">${CRM_MOTIVOS_PERDA.map(x=>`<button type="button" class="crm-motivo-chip" onclick="_crmSelMotivo(this)">${x}</button>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:18px">
      <button type="button" class="crm-etapa-btn" style="flex:1" onclick="fecharCrmCard()">Cancelar</button>
      <button type="button" class="btn-primary" style="flex:1" onclick="_crmConfirmarPerda('${id}')">Confirmar perda</button>
    </div>`;
  document.getElementById('crm-modal-bg').classList.add('on');
}
function _crmSelMotivo(btn){ document.querySelectorAll('.crm-motivo-chip').forEach(b=>b.classList.remove('sel')); btn.classList.add('sel'); _crmMotivoSel=btn.textContent; }
function _crmConfirmarPerda(id){
  fecharCrmCard();
  _setStatusOrc(id,'recusado',{motivo_perda:_crmMotivoSel||null}).then(()=>renderCRM()).catch(e=>console.warn('[crmPerda]', e?.message||e));
}

// ── Card / modal de detalhe ──
function abrirCrmCard(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const etapa=_crmEtapaDoOrc(o);
  const etCfg=CRM_ETAPAS.find(e=>e.id===etapa);
  const notas=_crmNotas(o).slice().reverse();
  const contatos=_crmContatos(o);
  const svs=(o.servicos||[]).map(s=>s.desc).filter(Boolean).join(', ');
  const diasEtapa=_crmDiasNaEtapa(o);
  const condo=_crmEhCondominio(o);
  const sitAtual=o.crm_situacao||'';
  document.getElementById('crm-modal').innerHTML=`
    <h3>${condo?'🏢 ':''}${esc(o.cliente||'—')} <span class="crm-card-num">#${String(o.numero||'').padStart(3,'0')}</span></h3>
    <div class="crm-modal-sub">
      <span class="crm-chip" style="background:${etCfg.cor}22;color:${etCfg.cor}">${etCfg.nome}</span>
      ${brl(parseFloat(o.total)||0)}${svs?' · '+esc(svs):''}
      ${etapa==='pendente'?` · há ${diasEtapa}d nesta etapa`:''}
      ${etapa==='perdido'&&o.motivo_perda?' · Motivo: '+esc(o.motivo_perda):''}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${o.tel_cliente?`<button type="button" class="crm-etapa-btn" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifOrcamentoPorSituacao(todosOrc.find(x=>x.id==='${id}')), '${esc(o.tel_cliente)}')">💬 ${sitAtual?'Mensagem p/ situação':'WhatsApp'}</button>`:''}
      <button type="button" class="crm-etapa-btn" onclick="fecharCrmCard();abrirOrc('${id}')">📄 Abrir orçamento</button>
    </div>
    ${etapa==='pendente'?`
    <div class="fl" style="margin-bottom:14px">
      <label>🎯 Por que ainda não fechou?</label>
      <select id="crm-situacao-sel" onchange="_crmToggleDecisaoField(this.value)">
        <option value="">— Aguardando retorno (padrão) —</option>
        ${CRM_SITUACOES.map(s=>`<option value="${s.id}" ${sitAtual===s.id?'selected':''}>${s.emoji} ${s.label}</option>`).join('')}
      </select>
    </div>
    <div class="fl" id="crm-decisao-wrap" style="margin-bottom:14px;display:${sitAtual==='aguardando_aprovacao'?'':'none'}">
      <label>🗓️ Previsão da assembleia/reunião de decisão</label>
      <input type="date" id="crm-decisao-data" value="${o.crm_decisao_prevista||''}">
    </div>
    <button type="button" class="crm-etapa-btn" style="width:100%;margin-bottom:16px" onclick="crmSalvarSituacao('${id}')">Salvar situação</button>
    `:''}
    <div class="fl" style="margin-bottom:14px">
      <label>📞 Próximo contato</label>
      <div style="display:flex;gap:8px">
        <input type="date" id="crm-fu-data" value="${o.proximo_contato||''}" style="flex:1">
        <button type="button" class="crm-etapa-btn" onclick="crmSalvarFollowup('${id}')">Salvar</button>
      </div>
    </div>
    <div class="fl" style="margin-bottom:6px">
      <label>🧵 Quem mais decide? ${condo?'(condomínio — síndico/conselho costumam decidir juntos)':''}</label>
      ${contatos.length?contatos.map((c,i)=>`<div class="crm-contato-item">
          <div class="crm-contato-info"><b>${esc(c.nome||'')}</b>${c.papel?' · '+esc(c.papel):''}${c.tel?' · '+esc(c.tel):''}</div>
          <button type="button" class="tb" title="Remover contato" onclick="crmRemoverContato('${id}',${i})">✕</button>
        </div>`).join(''):''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <input type="text" id="crm-ct-nome" placeholder="Nome" style="flex:2;min-width:100px">
        <input type="text" id="crm-ct-papel" list="crm-papeis-dl" placeholder="Papel (síndico...)" style="flex:2;min-width:120px">
        <input type="text" id="crm-ct-tel" placeholder="Telefone" style="flex:1;min-width:90px">
        <button type="button" class="crm-etapa-btn" onclick="crmAddContato('${id}')">+ Adicionar</button>
      </div>
      <datalist id="crm-papeis-dl">${CRM_PAPEIS_CONTATO.map(p=>`<option value="${p}">`).join('')}</datalist>
    </div>
    <div class="fl" style="margin-bottom:6px">
      <label>📝 Registrar contato</label>
      <div style="display:flex;gap:8px">
        <input type="text" id="crm-nota-txt" placeholder="Ex.: liguei, vai decidir semana que vem" style="flex:1">
        <button type="button" class="crm-etapa-btn" onclick="crmAddNota('${id}')">Adicionar</button>
      </div>
    </div>
    <div style="max-height:180px;overflow-y:auto;margin-bottom:14px">
      ${notas.length?notas.map(n=>`<div class="crm-nota-item">${esc(n.texto||'')}<div class="crm-nota-meta">${n.data?new Date(n.data).toLocaleDateString('pt-BR'):''}${n.usuario?' · '+esc(n.usuario):''}</div></div>`).join(''):'<div class="crm-vazio">Nenhum contato registrado ainda</div>'}
    </div>
    <div class="fl"><label>Mover para</label>
      <div class="crm-etapa-btns">
        ${CRM_ETAPAS.filter(e=>e.id!==etapa&&e.id!=='concluido').map(e=>`<button type="button" class="crm-etapa-btn" onclick="crmMoverEtapa('${id}','${e.id}')"><span class="crm-col-dot" style="background:${e.cor};display:inline-block;margin-right:4px"></span>${e.nome}</button>`).join('')}
      </div>
    </div>
    <button type="button" class="crm-etapa-btn" style="width:100%;margin-top:14px" onclick="fecharCrmCard()" aria-label="Fechar">Fechar</button>`;
  document.getElementById('crm-modal-bg').classList.add('on');
}
function _crmToggleDecisaoField(sit){
  const wrap=document.getElementById('crm-decisao-wrap'); if(!wrap) return;
  wrap.style.display=sit==='aguardando_aprovacao'?'':'none';
}
function fecharCrmCard(){ document.getElementById('crm-modal-bg').classList.remove('on'); }

// ── Persistência dos campos CRM (mesmo caminho local-first dos orçamentos) ──
function _crmPatch(id, changes){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  Object.assign(o, changes);
  lsOrcAtualizar(id, changes);
  if(dbOk&&db&&!String(id).startsWith('local_'))
    orcSyncUpdate(id, changes).catch(e=>console.warn('[crmPatch]', e?.message||e));
}
function crmSalvarSituacao(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const sit=gV('crm-situacao-sel')||null;
  const decisao=sit==='aguardando_aprovacao'?(gV('crm-decisao-data')||null):null;
  const changes={crm_situacao:sit, crm_decisao_prevista:decisao};
  // Sugere (nunca sobrescreve) o próximo contato: alguns dias após a decisão prevista,
  // respeitando o calendário real do condomínio em vez de cobrar antes da assembleia acontecer.
  if(sit==='aguardando_aprovacao' && decisao && !o.proximo_contato){
    const dt=new Date(decisao+'T00:00:00'); dt.setDate(dt.getDate()+2);
    changes.proximo_contato=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  }
  _crmPatch(id, changes);
  toast('🎯 Situação atualizada');
  abrirCrmCard(id); renderCRM();
}
function crmAddContato(id){
  const nome=(gV('crm-ct-nome')||'').trim();
  if(!nome){ toast('Informe pelo menos o nome do contato.'); return; }
  const papel=(gV('crm-ct-papel')||'').trim();
  const tel=(gV('crm-ct-tel')||'').trim();
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const contatos=_crmContatos(o);
  contatos.push({nome, papel, tel});
  _crmPatch(id,{crm_contatos:contatos});
  toast('🧵 Contato adicionado');
  abrirCrmCard(id); renderCRM();
}
function crmRemoverContato(id, idx){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const contatos=_crmContatos(o);
  contatos.splice(idx,1);
  _crmPatch(id,{crm_contatos:contatos});
  abrirCrmCard(id); renderCRM();
}
function crmSalvarFollowup(id){
  const v=gV('crm-fu-data')||null;
  _crmPatch(id,{proximo_contato:v});
  toast(v?'📞 Follow-up agendado':'Follow-up removido');
  abrirCrmCard(id); renderCRM();
}
function crmAddNota(id){
  const txt=(gV('crm-nota-txt')||'').trim();
  if(!txt){ toast('Escreva o que foi conversado.'); return; }
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const notas=_crmNotas(o);
  notas.push({data:new Date().toISOString(), texto:txt, usuario:getSessao()?.nome||''});
  _crmPatch(id,{crm_notas:notas});
  toast('📝 Contato registrado');
  abrirCrmCard(id); renderCRM();
}
function crmFollowupFeito(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const notas=_crmNotas(o);
  notas.push({data:new Date().toISOString(), texto:'Follow-up realizado', usuario:getSessao()?.nome||''});
  _crmPatch(id,{proximo_contato:null, crm_notas:notas});
  toast('✅ Follow-up concluído');
  renderCRM();
}
