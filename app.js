// ══════════════════════════════════════════════════
//  SESSÃO — login multi-usuário
// ══════════════════════════════════════════════════
function getSessao(){ try{ return JSON.parse(sessionStorage.getItem('fluxa_user')||'null'); }catch(e){ return null; } }
function setSessao(u){ sessionStorage.setItem('fluxa_user',JSON.stringify(u)); }
function clearSessao(){ sessionStorage.removeItem('fluxa_user'); }
function eMaster(){ const s=getSessao(); return s?.perfil==='master'; }
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
function eTecnico(){ const s=getSessao(); return s?.perfil==='tecnico'; }
function getLojaFiltro(){ const s=getSessao(); return s?.loja_id||null; }

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
    'snb-form'         : gestor||vendas,
    'snb-history'      : gestor||vendas,
    'snb-clientes'     : gestor||vendas,
    'snb-agendamentos' : gestor||vendas,
    'snb-os'           : gestor||vendas,
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
  // Carrega estoque em background (gestor) — necessário p/ baixa automática e reservado
  if(eGestor()){ try{ loadEstoque(); }catch(e){ console.warn('[boot loadEstoque]', e?.message||e); } }

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
  const pagesVendasOk=['form','history','clientes','agendamentos','os'];
  const pagesTecnicoOk=['minhas-os','visitas','os']; // 'os' para abrir/preencher a OS atribuída
  if(tecnico && !pagesTecnicoOk.includes(pid)) go('minhas-os');
  if(vendas  && !pagesVendasOk.includes(pid))  go('form');
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

function mostrarTelaAuth(){
  resetMarcaSaaS(); // pré-login = marca neutra do produto (não herda tema de empresa)
  const a=document.getElementById('login-step-auth'); if(a) a.style.display='';
  const u=document.getElementById('login-step-users'); if(u) u.style.display='none';
  const sl=document.getElementById('login-step-loja'); if(sl) sl.classList.remove('show');
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
  document.getElementById('auth-err').textContent = '';
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
  document.title=(LC.nome||CFG.nome||'Fluxa')+' — Orçamentos';
}

// Atualiza o select de técnicos de acordo com a loja selecionada no form
function atualizarTecsPorLoja(lojaId, selectId){
  const sel=document.getElementById(selectId); if(!sel) return;
  const loja=getLoja(lojaId);
  const tecs=loja?loja.tecs:(CFG.tecnicos||LOJAS.flatMap(l=>l.tecs).filter((v,i,a)=>a.indexOf(v)===i));
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
      const {data}=await db.from('usuarios').select('*').eq('empresa_id',EMPRESA_ID).eq('ativo',true).order('nome');
      if(data){
        // Registros locais temporários (usr_xxx) não presentes no Supabase
        const locaisNaoSincronizados=local.filter(u=>
          String(u.id).startsWith('usr_') &&
          !data.find(d=>d.nome===u.nome && d.perfil===u.perfil)
        );
        for(const u of locaisNaoSincronizados){
          try{
            const payload={nome:u.nome,perfil:u.perfil,loja_id:u.loja_id||null,loja_nome:u.loja_nome||null,pin:u.pin||null,ativo:true};
            const {data:ins}=await dbInsert('usuarios', payload);
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
function avBtn(id, perfil, nome, sub, cor, lojaId, slim=false){
  const lojaParam = lojaId ? `'${lojaId}'` : 'null';
  const inicial = nome.charAt(0).toUpperCase();
  const badgeLbl = perfil==='gestor'?'Gestão':perfil==='vendas'?'Vendas':'Técnico';
  return `<button class="login-av-btn${slim?' slim':''}" onclick="selecionarUserLogin(this,'${id}','${perfil}','${esc(nome)}',${lojaParam})">
    <div class="login-av-circle" style="background:${cor}">${inicial}</div>
    <div class="login-av-info">
      <div class="login-av-nome">${esc(nome)}</div>
      <div class="login-av-sub">${esc(sub)}</div>
    </div>
    ${slim?'':`<span class="login-av-badge ${perfil}">${badgeLbl}</span><span class="login-av-arrow">›</span>`}
  </button>`;
}

function atualizarDotsPIN(val){
  // No novo formulário não há dots visuais — apenas foco automático ao completar 4 dígitos
  if(val && val.length === 4) setTimeout(fazerLogin, 80);
}

function toggleLoginTecs(){ /* removido — novo formulário não tem seções colapsáveis */ }

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
  loginUserSelecionado = {id:u.id, perfil:u.perfil, nome:u.nome, loja_id:u.loja_id};
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

async function pinValido(input, stored){
  if(!stored) return false;
  // Aceita apenas hash SHA-256 (64 chars hex). Texto plano não é mais suportado.
  if(stored.length === 64){ const h = await hashPIN(input); return h === stored; }
  // PIN legado (texto plano): força migração para hash no próximo login
  if(stored === input){
    console.warn('[fluxa] PIN legado detectado — atualize o PIN do usuário para hash.');
    return true;
  }
  return false;
}

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
    loginUserSelecionado = {id:u.id, perfil:u.perfil, nome:u.nome, loja_id:u.loja_id};
  }

  const pin = document.getElementById('pin-input').value;
  if(!pin || pin.length < 4){ err.textContent='Digite os 4 dígitos da senha.'; return; }

  let pinCorreto = false;
  if(loginUserSelecionado.id === '__gestor__'){
    pinCorreto = await pinValido(pin, CFG.pin||'1234');
  } else {
    const u = todosUsuarios.find(x=>x.id===loginUserSelecionado.id);
    if(u){
      pinCorreto = await pinValido(pin, u.pin);
      if(!pinCorreto && !u.pin) pinCorreto = await pinValido(pin, CFG.pin||'1234');
    }
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
      go('history');
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
  go('history');
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

function deselecionarUser(){
  loginUserSelecionado=null;
  document.getElementById('login-step-loja').classList.remove('show');
  document.getElementById('login-step-users').style.display='';
  const ni=document.getElementById('login-nome-input'); if(ni) ni.value='';
  const pi=document.getElementById('pin-input'); if(pi) pi.value='';
  const box=document.getElementById('login-nome-sugestoes'); if(box){ box.style.display='none'; box.innerHTML=''; }
  document.getElementById('login-err').textContent='';
}

// ══════════════════════════════════════════════════
//  CFG — configurações da empresa (white-label)
// ══════════════════════════════════════════════════
const CFG_DEF = {
  nome:'Minha Empresa', sub:'Serviços', tel:'', whatsapp:'', cidades:'',
  tagline:'', cor:'#C45E0A', cor2:'#2B3244', logoB64:'', segmento:'geral',
  svcs:['Serviço 1','Serviço 2','Serviço 3'], pin:'1234',
  tecnicos:['Marcos','Josimar','Eldecir','Bruno'],
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
let todosOS = [], filtroOSSt = localStorage.getItem('fluxa_filtroOSSt')||'todos', buscaOS = '', filtroOSTec = '';
let osEditId = null; // id da OS sendo editada (null = nova) — evita duplicar ao salvar
let filtroPeriodo = ''; // legado — não mais usado na tabela principal
let orcMesRef = ''; // YYYY-MM ou '' = todos os períodos
let osFotos = ['','',''];
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
  atualizarSQL();
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
    // Reage a login/logout (inclusive em outra aba)
    try{ db.auth.onAuthStateChange((_ev, s)=>{ authUser = s?.user || null; }); }catch(e){ console.warn('[onAuthStateChange]', e?.message||e); }
  }

  let modoAdminPlataforma = false;
  if(temCreds && !authSession){
    // Sem sessão de conta → tela de autenticação (login / criar empresa).
    mostrarTelaAuth();
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

  // ── Credenciais do Supabase (ponto único: constantes SUPABASE_URL/ANON_KEY) ──
  const sbUrl = SUPABASE_URL;
  const sbKey = SUPABASE_ANON_KEY;
  go('form');

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
//  SQL SETUP
// ──────────────────────────────────────────────────
function atualizarSQL(){
  document.getElementById('sql-code').textContent =
`CREATE TABLE IF NOT EXISTS orcamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero integer, cliente text, local_servico text,
  tel_cliente text, servicos jsonb,
  subtotal numeric(10,2), desconto numeric(10,2),
  total numeric(10,2), pagamento text,
  validade_dias integer, validade_data text,
  data_servico text, escopo text, obs text,
  foto_base64 text,
  valor_recebido numeric(10,2) DEFAULT 0,
  status text DEFAULT 'pendente',
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordens_servico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero integer, orcamento_id uuid,
  cliente text, local_servico text,
  data_servico text, hora text,
  tecnico text, servicos jsonb,
  materiais text, obs_tecnica text,
  total numeric(10,2) DEFAULT 0,
  valor_recebido numeric(10,2) DEFAULT 0,
  status text DEFAULT 'agendado',
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS empresa_config (
  id integer PRIMARY KEY DEFAULT 1,
  dados jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text, telefone text, endereco text,
  data_criacao timestamptz DEFAULT now()
);

ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS nota_interna text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS fotos jsonb DEFAULT '[]';
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS video_link text;
ALTER PUBLICATION supabase_realtime ADD TABLE clientes;

CREATE TABLE IF NOT EXISTS agendamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente text,
  local_servico text,
  tecnico text,
  tipo_servico text,
  periodicidade text,
  dia_semana integer,
  horario text,
  data_inicio text,
  data_fim text,
  obs text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS agendamento_id uuid;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checkin_time timestamptz;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checkout_time timestamptz;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS duracao_min integer;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS origem_cliente text;
ALTER PUBLICATION supabase_realtime ADD TABLE agendamentos;

CREATE TABLE IF NOT EXISTS vistorias (
  id text PRIMARY KEY,
  loja_id text,
  cliente text,
  local text,
  data text,
  hora text,
  tecnico text,
  mes_ref text,
  hora_checkin text,
  hora_checkout text,
  obs_geral text,
  email_responsavel text,
  equipamentos jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS email_responsavel text;
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE clientes   ADD COLUMN IF NOT EXISTS email_responsavel text;
ALTER PUBLICATION supabase_realtime ADD TABLE vistorias;

CREATE TABLE IF NOT EXISTS equipamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid,
  cliente_nome text,
  tipo text,
  marca text,
  modelo text,
  potencia text,
  numero_serie text,
  data_instalacao text,
  garantia_meses integer DEFAULT 12,
  garantia_vencimento text,
  obs text,
  foto_base64 text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);
ALTER PUBLICATION supabase_realtime ADD TABLE equipamentos;

CREATE TABLE IF NOT EXISTS despesas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id uuid,
  os_numero integer,
  tecnico text,
  data text,
  tipo text,
  valor numeric(10,2),
  descricao text,
  foto_base64 text,
  status text DEFAULT 'pendente',
  data_criacao timestamptz DEFAULT now()
);
ALTER PUBLICATION supabase_realtime ADD TABLE despesas;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_token uuid DEFAULT gen_random_uuid();
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_ativo boolean DEFAULT true;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS cnpj text;

-- ══ MULTI-LOJA ══
CREATE TABLE IF NOT EXISTS lojas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text, cnpj text, razao_social text,
  inscricao_estadual text, inscricao_municipal text,
  regime_tributario text,
  endereco text, tel text, cidade text,
  logo_base64 text, cor_primaria text,
  focusnfe_token text,
  focusnfe_ambiente text DEFAULT 'homologacao',
  iss_aliquota numeric(5,2) DEFAULT 2.0,
  codigo_servico_municipal text DEFAULT '7.10',
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  pin text,
  perfil text DEFAULT 'tecnico',
  loja_id uuid REFERENCES lojas(id),
  loja_nome text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS loja_id text; -- fix #B: text, não uuid (valores são strings como 'fortemp-camboriu')
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS lojas jsonb DEFAULT '[]';
ALTER TABLE agendamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE equipamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE despesas       ADD COLUMN IF NOT EXISTS loja_id text;

-- ══ NOTA FISCAL ══
CREATE TABLE IF NOT EXISTS notas_fiscais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid,
  orcamento_id uuid,
  tipo text,
  referencia text UNIQUE,
  numero integer, serie text, chave_acesso text,
  status text DEFAULT 'pendente',
  xml_autorizado text,
  pdf_danfe_url text,
  protocolo text, motivo_rejeicao text,
  dados_envio jsonb,
  data_emissao timestamptz DEFAULT now(),
  data_criacao timestamptz DEFAULT now()
);

-- ══ ESTOQUE ══
CREATE TABLE IF NOT EXISTS produtos (
  id text PRIMARY KEY, loja_id text,
  nome text, codigo text, unidade text DEFAULT 'un',
  preco_venda numeric(10,2) DEFAULT 0, custo numeric(10,2) DEFAULT 0,
  estoque_minimo numeric(10,2) DEFAULT 0,
  ncm text, cest text, cfop_padrao text, origem text, gtin_ean text,
  ativo boolean DEFAULT true, data_criacao timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id text PRIMARY KEY, loja_id text, produto_id text,
  tipo text, quantidade numeric(10,2), custo_unit numeric(10,2),
  motivo text, ref text, usuario text, data timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mov_produto ON estoque_movimentos(produto_id);
CREATE INDEX IF NOT EXISTS idx_mov_ref ON estoque_movimentos(ref);`;
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
    const dbIds=new Set((data||[]).map(x=>x.id));
    // Merge: BD é fonte de verdade + preserva clientes criados offline
    const merged=[...(data||[])];
    const soLocal=local.filter(l=>!dbIds.has(l.id));
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
    const loginTagline=document.getElementById('login-brand-tagline');
    if(loginTagline) loginTagline.textContent=CFG.tagline||'';
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
  setV('cfg-tecnicos', (CFG.tecnicos||[]).join('\n'));
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
  CFG.tecnicos = gV('cfg-tecnicos').split('\n').map(s=>s.trim()).filter(Boolean);
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
async function salvarBD(){
  const url=gV('sb-url').trim(), key=gV('sb-key').trim();
  const msg=document.getElementById('bd-msg'), btn=document.getElementById('btn-bd');
  if(!url||!key){ msg.style.color='var(--red)'; msg.textContent='Preencha URL e chave.'; return; }
  btn.disabled=true; btn.textContent='Testando…'; msg.textContent='';
  const ok=await conectarDB(url,key,true);
  if(ok){ lsSet('sb_url',url); lsSet('sb_key',key); await carregarCFGremoto(); aplicarCFG();
    msg.style.color='var(--green)'; msg.textContent='✅ Conectado! Abrindo o app…';
    const backRow=document.getElementById('setup-back-row'); if(backRow) backRow.style.display='flex';
    setTimeout(()=>go('form'),1100);
  } else { msg.style.color='var(--red)'; msg.textContent='❌ Verifique URL e chave.'; }
  btn.disabled=false; btn.textContent='Conectar e Salvar';
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
  const _vendas  = eVendas();
  const _tecnico = eTecnico();
  const _gestor  = eGestor();
  const pagesVendas  = ['form','history','clientes','agendamentos','os'];
  const pagesTecnico = ['minhas-os','visitas','os']; // 'os' para abrir/preencher a OS atribuída
  if(_vendas  && !pagesVendas.includes(p))  { toast('Você não tem acesso a essa área.'); return; }
  if(_tecnico && !pagesTecnico.includes(p)) { toast('Você não tem acesso a essa área.'); return; }
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
  if(p==='portal') { /* página gerenciada por checkPortalHash */ }
  if(p==='history'){ initOrcMes(); loadHist(); setTimeout(renderGraficoDash,200); }
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
  }
  if(p==='os-history') loadOSHist();
  if(p==='clientes'){ renderClientes(); carregarClientesRemoto(); }
  if(p==='empresa') preencherFormEmpresa();
  if(p==='equipamentos') loadEquipamentos();
  if(p==='agendamentos'){ loadAgendamentos(); populaTecSelects(); initCal(); renderCal(); }
  if(p==='despesas') loadDespesas();
  if(p==='estoque') loadEstoque();
  if(p==='produtividade'){ loadProdutividade(); setTimeout(renderRelatorioFinanceiro,300); }
  if(p==='analises') loadAnalises();
  if(p==='plataforma') loadPlataforma();
  if(p==='usuarios') loadUsuarios();
  if(p==='auditoria') loadAuditoria();
  if(p==='minhas-os') loadMinhasOS();
  if(p==='visitas'){
    initVisitas();
    // Todos os perfis caem direto na aba Locais (acompanhamento mensal)
    // "Nova Vistoria" fica acessível pela aba, mas não é a tela inicial
    visTab('locais');
  }
  // Atualiza técnicos disponíveis quando abre form de OS
  if(p==='os'){
    if(!osEditId) restaurarRascunho('os'); // não restaura draft quando editando OS existente
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
  m.style.display=m.style.display==='none'?'block':'none';
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
  let numStr='???';
  try{
    if(dbOk&&db){
      const {data:insOS}=await dbInsertNumerado('ordens_servico',{
        orcamento_id:editId||null, cliente:dados.cli,
        local_servico:dados.loc, data_servico:data, hora, tecnico:tec,
        servicos:osSvcsData, materiais:'', obs_tecnica:'', total:dados.tot, status:'agendado'
      });
      const num=insOS?.numero||1;
      numStr=String(num).padStart(3,'0');
    }else{
      const n=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',n); numStr=String(n).padStart(3,'0');
    }
    // Preenche ambos docs e imprime juntos
    const numOrcStr=String(orcNum||0).padStart(3,'0');
    preencherDocOrc(dados, numOrcStr);
    const osDados={ cli:dados.cli, loc:dados.loc, data, hora, tec, tot:dados.tot, mat:'', obs:'', svcs:osSvcsData, loja_id:dados.loja_id||LOJA_PADRAO_ID };
    preencherDocOS(osDados, numStr);
    imprimirDoc('both');
  }catch(e){ console.error('criarOSjunto:',e); toast('⚠️ Erro ao gerar OS: '+e.message); }
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
function fecharAprovOS(){ document.getElementById('aprov-os-bg').classList.remove('on'); }

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
    const osSvcs=(orc.servicos||[]).map(s=>({desc:s.desc||s.d||'',produto_id:s.produto_id||null,qty:s.qty||1,precoUnit:parseFloat(s.p||s.preco||0)||0}));
    let numStr='???';
    if(dbOk&&db){
      const {data:insOS,error}=await dbInsertNumerado('ordens_servico',{
        orcamento_id:String(orcId).startsWith('local_')?null:orcId,
        cliente:orc.cliente, local_servico:orc.local_servico,
        data_servico:data, hora, tecnico:tec,
        servicos:osSvcs, materiais:'', obs_tecnica:'',
        total:orc.total, status:'agendado', loja_id:orc.loja_id||LOJA_PADRAO_ID
      });
      if(error) throw error;
      const num=insOS?.numero||1;
      numStr=String(num).padStart(3,'0');
    }else{
      const n=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',String(n)); numStr=String(n).padStart(3,'0');
    }
    fecharAprovOS();
    const dataFmt=new Date(data+'T12:00:00').toLocaleDateString('pt-BR');
    toast(`✅ OS #${numStr} criada — agendada para ${dataFmt} às ${hora} · Técnico: ${tec}`);
    logAcao('os_criada',`#${numStr} via aprovação do orçamento #${String(orc.numero||'?').padStart(3,'0')}`);
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
  ['cli','loc','tel-cli','cnpj-cli','obs','escopo','data-svc','data-orc','nota-interna','origem-cli','origem-cli-outro','pag-parcelas','pag-entrada'].forEach(id=>setV(id,''));
  updOrigemCli();
  setV('pag','A combinar'); setV('val','5'); setV('disc-v',''); setV('disc-t','R$');
  setV('orc-loja', lojaAtiva||LOJA_PADRAO_ID);
  renderSvcs(); upd();
  renderFotosOrcSlots();
  // Reset OS toggle
  const tog=document.getElementById('toggle-os'); if(tog) tog.checked=false;
  const osf=document.getElementById('os-inline-fields'); if(osf) osf.style.display='none';
  ['os-inline-data','os-inline-hora','os-inline-tec'].forEach(id=>{const el=document.getElementById(id);if(el){el.value=id==='os-inline-hora'?'08:00':'';}});
  const bb=document.getElementById('form-back-bar'); if(bb) bb.style.display='none';
}
function novoOrc(){
  limparRascunho('form'); window._skipDraftForm=true; // novo orçamento = começar do zero, sem rascunho antigo
  _limparCamposOrc();
  go('form');
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
      <input type="file" id="forc-inp-${i}" accept="image/*" capture="environment" style="display:none" onchange="carregarFotoOrc(this,${i})">
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
      if(pTotal>0){
        if(temMultiWA&&qty>1) detalhe=` — ${qty}× ${brl(pUnit)} = *${brl(pTotal)}*`;
        else detalhe=` — *${brl(pTotal)}*`;
      }
      tx+=`  ${i+1}. ${sv.d.trim()}${detalhe}\n`;
    });
    tx+=`\n`;
  }
  if(d>0){
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
      cliente:dados.cli, local_servico:dados.loc, tel_cliente:dados.tel, cnpj:dados.cnpj||null,
      loja_id:dados.loja_id||LOJA_PADRAO_ID,
      origem_cliente:dados.origem||null,
      servicos:dados.svcs, subtotal:dados.sub, desconto:dados.desc, total:dados.tot,
      pagamento:dados.pagFormatado, pag_cod:dados.pag, pag_parcelas:dados.pagParcelas, pag_entrada:dados.pagEntrada,
      validade_dias:dados.dias, validade_data:dados.vData,
      data_servico:dados.dataSvc, escopo:dados.escopo, obs:dados.obs,
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
      if(dbOk&&db&&!String(editId).startsWith('local_'))
        orcSyncUpdate(editId, camposBase).then(r=>{ if(r.error) console.warn('[salvarApenas] update falhou:', r.error.message); }).catch(e=>console.warn('[salvarApenas] update erro:', e?.message||e));
      _autoSalvarCliente(dados.cli, dados.tel, dados.loc, dados.cnpj, dados.loja_id);
      toast('✅ Orçamento atualizado!');
    } else {
      // ── NOVO ──
      const tempId='local_'+Date.now();
      const num=lsOrcProxNum(); savedNum=num;
      const rec={...camposBase, id:tempId, numero:num, status:'pendente', data_criacao:now};
      _autoSalvarCliente(dados.cli, dados.tel, dados.loc, dados.cnpj, dados.loja_id);
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
            const {data:ins,error:insErr}=await dbInsertNumerado('orcamentos',{...camposBase,status:'pendente',data_criacao:now});
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

function mostrarBannerNovo(num){
  const numStr=num?'#'+String(num).padStart(3,'0'):'';
  const existing=document.getElementById('banner-novo');
  if(existing) existing.remove();
  const banner=document.createElement('div');
  banner.id='banner-novo';
  banner.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#16a34a;color:white;padding:14px 22px;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.2);display:flex;align-items:center;gap:14px;z-index:999;font-family:Inter,sans-serif;font-size:14px;font-weight:600';
  banner.innerHTML=`<span>✅ Orçamento ${numStr} salvo!</span><button onclick="novoOrc();this.parentElement.remove()" style="background:rgba(255,255,255,.25);border:none;color:white;padding:6px 14px;border-radius:8px;cursor:pointer;font-family:Inter,sans-serif;font-size:13px;font-weight:700">＋ Novo Orçamento</button><button onclick="this.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:18px;line-height:1;padding:0 4px">×</button>`;
  document.body.appendChild(banner);
  setTimeout(()=>{ if(banner.parentElement) banner.remove(); },8000);
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
    cliente:dados.cli, local_servico:dados.loc, tel_cliente:dados.tel, cnpj:dados.cnpj||null,
    loja_id:dados.loja_id||LOJA_PADRAO_ID,
    origem_cliente:dados.origem||null,
    servicos:dados.svcs, subtotal:dados.sub, desconto:dados.desc, total:dados.tot,
    pagamento:dados.pagFormatado, pag_cod:dados.pag, pag_parcelas:dados.pagParcelas, pag_entrada:dados.pagEntrada,
    validade_dias:dados.dias, validade_data:dados.vData,
    data_servico:dados.dataSvc, escopo:dados.escopo, obs:dados.obs,
    foto_base64:fotosB64.filter(Boolean).length?JSON.stringify(fotosB64.filter(Boolean)):null, nota_interna:gV('nota-interna')||null
  };
  let num=null;
  _autoSalvarCliente(dados.cli, dados.tel, dados.loc, dados.cnpj, dados.loja_id);

  if(editId){
    // Editando: mantém número existente
    const existing=todosOrc.find(x=>x.id===editId)||{};
    num=existing.numero||lsOrcProxNum();
    const updated={...existing,...camposBase,id:editId,numero:num};
    lsOrcUpsert(updated);
    const idx=todosOrc.findIndex(x=>x.id===editId);
    if(idx>=0) todosOrc[idx]=updated;
    if(dbOk&&db&&!String(editId).startsWith('local_'))
      orcSyncUpdate(editId, camposBase).then(r=>{ if(r.error) console.warn('[gerarPDF] update falhou:', r.error.message); }).catch(e=>console.warn('[gerarPDF] update erro:', e?.message||e));
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
      (async()=>{
        try{
          const {data:ins,error:insErr}=await dbInsertNumerado('orcamentos',{...camposBase,status:'pendente',data_criacao:now});
          if(insErr){ console.warn('gerarPDF: sync BD falhou — orçamento permanece local:', insErr.message); return; }
          if(ins){
            lsOrcRemover(tempId);
            lsOrcUpsert(ins);
            todosOrc=todosOrc.filter(x=>x.id!==tempId);
            todosOrc.unshift(ins);
            if(editId===tempId) editId=ins.id; // só atualiza se AINDA estiver neste orçamento
            num=ins.numero;
            atualizarDash(); renderTabela();
          }
        }catch(e){ console.warn('gerarPDF: sync BD falhou:', e?.message||e); }
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
  return { cli:gV('cli')||'—', loc:gV('loc'), tel:gV('tel-cli'), cnpj:gV('cnpj-cli'),
    loja_id:gV('orc-loja')||LOJA_PADRAO_ID,
    origem:getOrigemCli(),
    pag:gV('pag'), pagFormatado:formatPagamento(gV('pag'),tot()),
    pagParcelas:parseInt(gV('pag-parcelas'))||null,
    pagEntrada:parseFloat((gV('pag-entrada')||'').replace(',','.'))||null,
    dias, obs:gV('obs'),
    escopo:gV('escopo'), dataSvc:gV('data-svc'), dataStr, vData, sub:sub(), desc:disc(sub()), tot:tot(),
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
  const temMulti=d.svcs.some(s=>(parseInt(s.qty)||1)>1);
  document.getElementById('pd-thead-orc').innerHTML=temMulti
    ?'<th>#</th><th>Descrição</th><th>Qtd × Unit.</th><th>Total</th>'
    :'<th>#</th><th>Descrição</th><th>Valor</th>';
  d.svcs.forEach((s,i)=>{
    const tr=document.createElement('tr');
    const qty=parseInt(s.qty)||1;
    if(temMulti){
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
  if(d.desc>0){
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
function resetChecklist(){ osChecklist=OS_CHECKLIST_DEFAULT.map(x=>({...x})); renderOsChecklist(); }
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

async function gerarOSPDF(modo='os'){
  const dados={
    cli:gV('os-cli')||'—', loc:gV('os-loc'), cnpj:gV('os-cnpj')||null, data:gV('os-data'), hora:gV('os-hora'),
    tec:gV('os-tec'), tot:parseFloat(gV('os-total'))||0,
    mat:gV('os-mat'), obs:gV('os-obs'),
    svcs:osSvcs.filter(s=>s.d.trim()).map(s=>s.d.trim()),
    fotos:osFotos.filter(Boolean), videoLink:gV('os-video-link'),
    checklist: osChecklist.filter(x=>x.checked),
    loja_id: gV('os-loja')||LOJA_PADRAO_ID
  };
  let numStr='???';
  if(dbOk&&db){
    try{
      const orcId=osOrcId||null;
      const lojaIdOS=gV('os-loja')||LOJA_PADRAO_ID;
      const payload={orcamento_id:orcId,loja_id:lojaIdOS,cliente:dados.cli,local_servico:dados.loc,cnpj:dados.cnpj||null,data_servico:dados.data,hora:dados.hora,tecnico:dados.tec,servicos:dados.svcs,materiais:dados.mat,obs_tecnica:dados.obs,total:dados.tot,fotos:dados.fotos,video_link:dados.videoLink||null,checklist:dados.checklist.length?JSON.stringify(dados.checklist):null};
      if(osEditId && !String(osEditId).startsWith('local_')){
        // EDIÇÃO: atualiza a OS existente (mantém número e status)
        const existente=todosOS.find(x=>x.id===osEditId);
        await db.from('ordens_servico').update(payload).eq('id',osEditId);
        numStr=String(existente?.numero||'').padStart(3,'0')||'???';
        toast('✅ OS atualizada');
      } else {
        const {data:insOS}=await dbInsertNumerado('ordens_servico',{...payload,status:'agendado'});
        numStr=String(insOS?.numero||'').padStart(3,'0')||'???';
      }
    }catch(e){ numStr='???'; console.warn('[gerarOSPDF] falha ao salvar OS no banco:', e?.message||e); toast('⚠️ OS não foi salva no banco — verifique a conexão'); }
  } else { const n=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',n); numStr=String(n).padStart(3,'0'); }

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

  autoSalvarClienteDoOrc({cli:dados.cli, loc:dados.loc, tel:dados.tel||'', cnpj:dados.cnpj||''});
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
  // fotos OS no PDF
  const fotosEl=document.getElementById('pd-fotos-os');
  const fotosArr=(d.fotos||[]).filter(Boolean);
  if(fotosEl){
    if(fotosArr.length){
      fotosEl.style.display='block';
      fotosEl.innerHTML='<div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:8px">Fotos do Serviço</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
        fotosArr.map(f=>`<img src="${f}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;border:1px solid #e9ecef">`).join('')+'</div>';
      if(d.videoLink) fotosEl.innerHTML+=`<div style="margin-top:8px;font-size:11px;color:#6b7280">📹 Vídeo: <a href="${esc(d.videoLink)}">${esc(d.videoLink)}</a></div>`;
    } else { fotosEl.style.display='none'; fotosEl.innerHTML=''; }
  }
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
      const {data,error}=await db.from('orcamentos').select('*').eq('empresa_id',EMPRESA_ID).order('data_criacao',{ascending:false});
      if(error) throw error;
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
    const novo={id:'cli_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),nome,tel:o.tel_cliente||'',end:o.local_servico||'',cnpj:o.cnpj||'',email_responsavel:'',tipo:'',portal_token:crypto.randomUUID(),loja_id:lojaId};
    lista.unshift(novo); mudou=true;
    if(dbOk&&db) dbInsert('clientes',{id:novo.id,nome,telefone:novo.tel||null,endereco:novo.end||null,cnpj:novo.cnpj||null,loja_id:lojaId,portal_token:novo.portal_token}).catch(()=>{});
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
  const aRec=aprov.reduce((a,o)=>a+(o.total||0)-(o.valor_recebido||0),0);
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
  renderTabela();
}
function buscar(v){ busca=v.toLowerCase(); renderTabela(); }

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

function filtrarPorPeriodo(val){ filtroPeriodo=val; renderTabela(); } // legado

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
  atualizarDash(); renderTabela();
}

function orcVerTodos(){
  orcMesRef='';
  _renderOrcMesLabel();
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

function renderOrcMiniKpis(lista){
  const el=document.getElementById('orc-mini-kpis'); if(!el) return;
  const ocultarFin=eVendas();
  const total=lista.length;
  const soma=lista.reduce((a,o)=>a+(o.total||0),0);
  const aprov=lista.filter(o=>o.status==='aprovado');
  const somaA=aprov.reduce((a,o)=>a+(o.total||0),0);
  const pend=lista.filter(o=>o.status==='pendente').length;
  const rec=lista.filter(o=>o.status==='recusado').length;
  const venc=lista.filter(o=>o.status==='vencido').length;
  const tick=total>0?soma/total:0;
  el.innerHTML=`
    <div class="orc-mini-kpi" style="background:#fff7ed;border-left-color:var(--c1)">
      <div class="orc-mini-kpi-lbl">Total emitido</div>
      <div class="orc-mini-kpi-val">${ocultarFin?total+' orç.':brl(soma)}</div>
      <div class="orc-mini-kpi-sub">${total} orçamento${total!==1?'s':''}</div>
    </div>
    <div class="orc-mini-kpi" style="background:#f0fdf4;border-left-color:var(--green)">
      <div class="orc-mini-kpi-lbl">✅ Aprovados</div>
      <div class="orc-mini-kpi-val" style="color:var(--green)">${ocultarFin?aprov.length:brl(somaA)}</div>
      <div class="orc-mini-kpi-sub">${aprov.length} aprovado${aprov.length!==1?'s':''}</div>
    </div>
    <div class="orc-mini-kpi" style="background:#fffbeb;border-left-color:var(--yellow)">
      <div class="orc-mini-kpi-lbl">⏳ Pendentes</div>
      <div class="orc-mini-kpi-val" style="color:var(--yellow)">${pend}</div>
      <div class="orc-mini-kpi-sub">${ocultarFin?'':tick>0?'Ticket: '+brl(tick):''}</div>
    </div>
    <div class="orc-mini-kpi" style="background:#fef2f2;border-left-color:var(--red)">
      <div class="orc-mini-kpi-lbl">❌ Recusados/Vencidos</div>
      <div class="orc-mini-kpi-val" style="color:var(--red)">${rec+venc}</div>
      <div class="orc-mini-kpi-sub">${rec} recusado${rec!==1?'s':''} · ${venc} vencido${venc!==1?'s':''}</div>
    </div>`;
}

function renderTabela(){
  // auto-vence orçamentos pendentes com prazo expirado
  autoVencerOrc(todosOrc);
  // base: filtro por mês de vigência
  let listaMes=_orcListaMes();
  // Renderiza mini KPIs para o período selecionado (antes dos filtros de status/busca)
  renderOrcMiniKpis(listaMes);
  let lista=listaMes;
  if(filtroSt!=='todos') lista=lista.filter(o=>o.status===filtroSt);
  if(busca) lista=lista.filter(o=>
    (o.cliente||'').toLowerCase().includes(busca)||
    (o.local_servico||'').toLowerCase().includes(busca)||
    String(o.numero||'').includes(busca.replace('#',''))
  );
  if(!lista.length){
    const msgBusca=busca?`Nenhum resultado para "<strong>${esc(busca)}</strong>"`:
      orcMesRef?`Nenhum orçamento em ${_renderOrcMesLabelStr()}.`:'Nenhum orçamento encontrado.';
    document.getElementById('hist-body').innerHTML=`<div class="empty-st"><div class="ei">📭</div><p>${msgBusca}</p><button class="btn-primary" style="margin-top:12px" onclick="novoOrc();go('form')">＋ Criar Orçamento</button></div>`; return;
  }
  const sopts=s=>['pendente','aprovado','recusado','vencido'].map(x=>`<option value="${x}" ${x===s?'selected':''}>${x.charAt(0).toUpperCase()+x.slice(1)}</option>`).join('');
  const ocultarFinanceiro=eVendas();
  let h=`<div class="htw"><table class="ht"><thead><tr><th>#</th><th>Cliente</th>${ocultarFinanceiro?'':'<th>Total / Recebido</th>'}<th>Data</th><th>Status</th><th>Ações</th></tr></thead><tbody>`;
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
    h+=`<tr>
      <td><span class="on">#${num}</span>${pendSync?'<div title="Não sincronizado com o banco — aguardando conexão" style="font-size:9px;font-weight:700;color:#dc2626;background:#fee2e2;border-radius:4px;padding:1px 5px;margin-top:2px;text-align:center">⚠ PEND.</div>':''}</td>
      <td><div class="ocl">${esc(o.cliente||'—')}${notaIcon}</div><div class="oloc">${esc(o.local_servico||'')}</div><div class="osvc" title="${esc(svs)}">${esc(svs)}</div><div style="margin-top:3px;display:flex;gap:5px;flex-wrap:wrap;align-items:center">${getLojaBadge(o.loja_id)}${getOrigemBadge(o.origem_cliente)}</div>${(()=>{ const etapas=[]; const st=o.status||'pendente'; const osVinc=(todosOS||[]).find(x=>x.orcamento_id===o.id); const entregue=!orcTemEntregaPendente(o)&&(o.servicos||[]).some(s=>s.produto_id); const etApr=st==='aprovado'||st==='recusado'||osVinc||entregue; const etOS=!!osVinc; const etConc=osVinc?.status==='concluido'; const dot=(ok,lbl)=>`<span style="display:flex;align-items:center;gap:2px;font-size:10px;color:${ok?'#16a34a':'#9ca3af'};font-weight:${ok?'700':'400'}">${ok?'●':'○'} ${lbl}</span>`; return `<div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">${dot(true,'Criado')}›${dot(etApr,'Aprovado')}›${dot(etOS,'OS')}›${dot(etConc,'Concluído')}</div>`; })()}</td>
      ${ocultarFinanceiro?'':'<td><span class="otot">'+brl(ttl)+'</span><br><span class="'+recCl+'" style="font-size:11px">'+recTxt+'</span></td>'}
      <td><span class="odt">${dt}</span></td>
      <td><select class="ss ${o.status||'pendente'}" onchange="mudarSt('${o.id}',this)">${sopts(o.status||'pendente')}</select></td>
      <td><div class="ta">
        <button class="tb" title="Ver PDF" onclick="verOrcPDF('${o.id}')">👁</button>
        <button class="tb" title="Editar" onclick="abrirOrc('${o.id}')">✎</button>
        <button class="tb" title="Duplicar" onclick="duplicarOrc('${o.id}')">⧉</button>
        ${(()=>{ const osVinc=(todosOS||[]).find(x=>x.orcamento_id===o.id); if(osVinc){ const stOS=osVinc.status||'agendado'; const stLabel={agendado:'agendada',em_andamento:'em andamento',concluido:'concluída'}[stOS]||stOS; return `<button class="tb" title="OS #${String(osVinc.numero||'').padStart(3,'0')} — ${stLabel}" onclick="verDetalhesOS('${osVinc.id}')" style="background:#16a34a;color:white;border-color:#16a34a;font-weight:700">✅ OS#${String(osVinc.numero||'').padStart(3,'0')}</button>`; } if(o.status==='aprovado') return `<button class="tb" title="Gerar Ordem de Serviço" onclick="gerarOS_deOrc('${o.id}')" style="background:#C45E0A;color:white;border-color:#C45E0A;font-weight:700">📋 Gerar OS</button>`; return `<button class="tb" title="Gerar OS" onclick="gerarOS_deOrc('${o.id}')">📋</button>`; })()}
        ${orcTemEntregaPendente(o)?`<button class="tb g" title="Marcar como entregue (baixa do estoque)" onclick="entregarOrcamento(getNC('${o.id}'),'manual')">📦 Entregar</button>`:''}
        ${ocultarFinanceiro?'':'<button class="tb g" title="Registrar pagamento" onclick="abrirModalPg(\''+o.id+'\','+ttl+')">💰</button>'}
        ${o.status==='aprovado'?`<button class="tb" title="Corrigir mês de aprovação no faturamento" onclick="corrigirDataAprovacao('${o.id}')" style="font-size:10px;font-weight:700;color:#b45309;border-color:#fbbf24;background:#fef9c3">MÊS</button>`:''}
        ${!ocultarFinanceiro&&o.status==='aprovado'?`<button class="tb" title="Emitir Nota Fiscal" onclick="abrirModalNFe('${o.id}')" style="background:#7c3aed;color:white;border-radius:6px;padding:4px 7px;font-size:11px;font-weight:700;border:none;cursor:pointer">NF</button>`:''}
        <button class="tb" title="Enviar no WhatsApp" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifOrcamento(getNC('${o.id}')), '${o.tel_cliente||''}')">💬 WA</button>
        ${ocultarFinanceiro?'':'<button class="tb d" title="Excluir" onclick="excluirOrc(\''+o.id+'\')">🗑</button>'}
      </div></td>
    </tr>`;
  });
  h+='</tbody></table></div>';
  document.getElementById('hist-body').innerHTML=h;
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
  const changes={status:st};
  if(st==='aprovado') changes.data_aprovacao=new Date().toISOString();
  const o=todosOrc.find(x=>x.id===id); if(o) Object.assign(o, changes);
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

function abrirOrc(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  editId=id;
  setV('cli',o.cliente||''); setV('loc',o.local_servico||''); setV('tel-cli',o.tel_cliente||''); setV('cnpj-cli',o.cnpj||'');
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
  svcs=(o.servicos||[]).map(s=>({id:Date.now()+Math.random(),d:s.desc,p:String(s.precoUnit||s.preco||''),qty:s.qty||1,produto_id:s.produto_id||null}));
  if(!svcs.length) svcs=[{id:Date.now(),d:'',p:''}];
  // Compatibilidade: antigo=string, novo=JSON array
  try{
    const raw=o.foto_base64||'';
    fotosB64=raw.startsWith('[')?JSON.parse(raw):(raw?[raw]:[]);
  }catch(e){ fotosB64=[]; }
  renderFotosOrcSlots();
  renderSvcs(); upd(); go('form');
  const bb=document.getElementById('form-back-bar');
  const bl=document.getElementById('form-back-label');
  if(bb){ bb.style.display='flex'; }
  if(bl){ bl.textContent='Editando ORC #'+String(o.numero).padStart(3,'0'); }
  toast('✏️ Editando Orçamento #'+String(o.numero).padStart(3,'0'));
}

function verOrcPDF(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const numStr=String(o.numero||'').padStart(3,'0');
  const dadosOrc={
    cli:o.cliente||'—', loc:o.local_servico||'', tel:o.tel_cliente||'', cnpj:o.cnpj||'',
    pag:o.pag_cod||o.pagamento||'A combinar', pagFormatado:o.pagamento||'A combinar',
    dias:o.validade_dias||5, obs:o.obs||'', escopo:o.escopo||'',
    dataSvc:o.data_servico||'', vData:o.validade_data||'',
    dataStr:new Date(o.data_criacao||Date.now()).toLocaleDateString('pt-BR'),
    sub:o.subtotal||0, desc:o.desconto||0, tot:o.total||0,
    svcs:o.servicos||[], loja_id:o.loja_id||LOJA_PADRAO_ID
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
  setV('cli',o.cliente||''); setV('loc',o.local_servico||''); setV('tel-cli',o.tel_cliente||''); setV('cnpj-cli',o.cnpj||'');
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
  limparRascunho('form'); window._skipDraftForm=true; // não deixar rascunho antigo sobrescrever os dados duplicados
  renderSvcs(); upd(); go('form');
  toast('📋 Orçamento duplicado — edite e salve como novo');
}

function gerarOS_deOrc(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  osEditId = null;
  osOrcId = id;
  setV('os-cli',o.cliente||''); setV('os-loc',o.local_servico||''); setV('os-cnpj',o.cnpj||'');
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
  osFotos=['','',''];
  [0,1,2].forEach(i=>{
    const prev=document.getElementById('os-foto-prev-'+i);
    const btn=document.getElementById('os-btn-rm-foto-'+i);
    const lbl=document.getElementById('os-foto-lbl-'+i);
    const inp=document.getElementById('os-foto-inp-'+i);
    if(prev) prev.style.display='none';
    if(btn) btn.style.display='none';
    if(lbl) lbl.textContent='Tirar/selecionar';
    if(inp) inp.value='';
  });
  setV('os-video-link','');
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
  ['os-cli','os-loc','os-cnpj','os-obs','os-mat','os-total','os-tec'].forEach(id=>setV(id,''));
  setV('os-data', _hojeLocal());
  setV('os-hora','08:00');
  osSvcs=[{id:Date.now(),d:''}]; renderOSSvcs();
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
async function loadOSHist(){
  document.getElementById('osh-body').innerHTML='<div class="load"><div class="spin"></div> Carregando…</div>';
  if(dbOk&&db){
    try{
      const {data,error}=await db.from('ordens_servico').select('*').eq('empresa_id',EMPRESA_ID).order('data_criacao',{ascending:false});
      if(error) throw error;
      todosOS=data||[];
    }catch(e){ console.warn('loadOSHist erro:',e.message); todosOS=[]; }
  } else { todosOS=[]; }
  renderOSTabela();
}

function filtOS(btn){
  document.querySelectorAll('#page-os-history .fb[data-oss]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); filtroOSSt=btn.dataset.oss;
  localStorage.setItem('fluxa_filtroOSSt', filtroOSSt);
  renderOSTabela();
}
function buscarOS(v){ buscaOS=v.toLowerCase(); renderOSTabela(); }
function filtTecOS(val){ filtroOSTec=val; renderOSTabela(); }

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
  if(!lista.length){ document.getElementById('osh-body').innerHTML=`<div class="empty-st"><div class="ei">📋</div><p>Nenhuma OS encontrada.</p><button class="btn-primary" style="margin-top:12px" onclick="novaOS();go('os')">＋ Nova OS</button></div>`; return; }
  // Ordena: pendentes/atrasadas por data crescente primeiro; concluídas/canceladas no final
  const _hoje=_hojeLocal();
  lista=lista.slice().sort((a,b)=>{
    const ac=a.status==='concluido'||a.status==='cancelado';
    const bc=b.status==='concluido'||b.status==='cancelado';
    if(ac&&!bc) return 1; if(!ac&&bc) return -1;
    const da=a.data_servico||'9999'; const db2=b.data_servico||'9999';
    return da<db2?-1:da>db2?1:0;
  });
  let h=`<div class="htw"><table class="ht"><thead><tr><th>#</th><th>Cliente</th><th>Local</th><th>Data</th><th>Técnico</th><th>Status</th><th>Ações</th></tr></thead><tbody>`;
  lista.forEach(o=>{
    _nc[o.id]=o;
    const num=String(o.numero||'—').padStart(3,'0');
    const dt=o.data_servico?new Date(o.data_servico+'T12:00:00').toLocaleDateString('pt-BR'):(o.data_criacao?new Date(o.data_criacao).toLocaleDateString('pt-BR'):'—');
    const atrasado=o.status==='agendado'&&o.data_servico&&o.data_servico<_hoje;
    const stCl=o.status==='concluido'?'os-concluido':o.status==='cancelado'?'os-cancelado':atrasado?'os-atrasado':'os-agendado';
    const stTx=o.status==='concluido'?'✅ Concluído':o.status==='cancelado'?'Cancelado':atrasado?'⚠️ Atrasado':'📅 Agendado';
    h+=`<tr>
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
        ${o.status==='agendado'||atrasado?`<button class="tb" title="Lembrete de visita" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifVisita(getNC('${o.id}')), '${o.tel_cliente||''}')">📅💬</button>`:''}
        <button class="tb d" onclick="excluirOS('${o.id}')">🗑</button>
      </div></td>
    </tr>`;
  });
  h+='</tbody></table></div>';
  document.getElementById('osh-body').innerHTML=h;
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
function _abrirOSForm(o){
  osEditId=o.id;
  osOrcId=o.orcamento_id||null;
  setV('os-cli',o.cliente||''); setV('os-loc',o.local_servico||'');
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
  osFotos=(o.fotos||[]).concat(['','','']).slice(0,3);
  osFotos.forEach((f,i)=>{
    const prev=document.getElementById('os-foto-prev-'+i);
    const btn=document.getElementById('os-btn-rm-foto-'+i);
    const lbl=document.getElementById('os-foto-lbl-'+i);
    if(f){prev.src=f;prev.style.display='block';if(btn)btn.style.display='block';if(lbl)lbl.textContent='Foto carregada';}
    else{prev.style.display='none';if(btn)btn.style.display='none';if(lbl)lbl.textContent='Tirar/selecionar';}
  });
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
  ['os-cli','os-loc','os-data','os-hora','os-cnpj'].forEach(fid=>{
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
  const tudoTratado = itens.every(s=>_entregueProdutoOrc(orc.id,s.produto_id));
  const podeBaixar = orc.status==='aprovado' && !tudoTratado;
  lista.innerHTML=itens.map(s=>{
    const p=produtoById(s.produto_id);
    const qty=parseInt(s.qty)||1;
    const tratado=_entregueProdutoOrc(orc.id,s.produto_id);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-light)">
      <input type="checkbox" class="os-item-chk" data-pid="${s.produto_id}" ${tratado?'disabled':'checked'} style="width:18px;height:18px;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(p?p.nome:(s.desc||'produto'))}</div>
        <div style="font-size:11px;color:var(--gray)">${tratado?'✅ já confirmado':'pedido: '+fmtQtd(qty)+' '+(p?.unidade||'')}</div>
      </div>
      ${tratado?'':`<input type="number" class="os-item-qty" data-pid="${s.produto_id}" value="${qty}" min="0" step="1" title="Qtd levada" style="width:64px;padding:6px;border:1.5px solid var(--gray-mid);border-radius:8px;font-size:13px;text-align:center">`}
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
async function loadMinhasOS(){
  const sess = getSessao();
  if(!sess || sess.perfil !== 'tecnico'){ go('home'); return; }
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
function carregarOSFoto(inp, idx){
  const f=inp.files[0]; if(!f) return;
  if(f.size > FOTO_MAX_BYTES){ toast('⚠️ Foto muito grande (máx 20 MB).'); inp.value=''; return; }
  const r=new FileReader();
  r.onload=e=>{
    osFotos[idx]=e.target.result;
    const prev=document.getElementById('os-foto-prev-'+idx);
    const lbl=document.getElementById('os-foto-lbl-'+idx);
    const btn=document.getElementById('os-btn-rm-foto-'+idx);
    prev.src=e.target.result; prev.style.display='block';
    if(lbl) lbl.textContent=f.name;
    if(btn) btn.style.display='block';
  };
  r.readAsDataURL(f);
}
function removerOSFoto(idx){
  osFotos[idx]='';
  const prev=document.getElementById('os-foto-prev-'+idx);
  const lbl=document.getElementById('os-foto-lbl-'+idx);
  const btn=document.getElementById('os-btn-rm-foto-'+idx);
  const inp=document.getElementById('os-foto-inp-'+idx);
  if(prev) prev.style.display='none';
  if(lbl) lbl.textContent='Tirar/selecionar';
  if(btn) btn.style.display='none';
  if(inp) inp.value='';
}

// ──────────────────────────────────────────────────
//  CLIENTES
// ──────────────────────────────────────────────────
const LS_CLI_FULL='fluxa_clientes_full';
function lsCliLer(){ try{ return JSON.parse(ls(LS_CLI_FULL)||'[]'); }catch(e){ return []; } }
function lsCliSalvar(l){ lsSet(LS_CLI_FULL,JSON.stringify(l)); }


function renderClientes(){
  // v2: filtro genérico por unidade/grupo ativo (sem nome de empresa chumbado)
  let lista=filtrarPorLoja(lsCliLer());
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
  if(!lista.length){ el.innerHTML=`<div class="empty-st"><div class="ei">👥</div><p>${busca?'Nenhum cliente encontrado.':'Nenhum cliente cadastrado.'}</p>${busca?'':'<button class="btn-primary" style="margin-top:12px" onclick="mostrarFormCliente()">＋ Cadastrar Cliente</button>'}</div>`; return; }
  el.innerHTML=lista.map(c=>{
    const fat=fatPorNome[(c.nome||'').toLowerCase()]||0;
    const lojas=(c.lojas||[c.loja_id]).filter(Boolean);
    const lojasBadges=lojas.map(lid=>getLojaBadge(lid)).filter(Boolean).join('');
    return `
    <div class="cli-card">
      <div class="cli-card-info">
        <div class="cli-card-nome">${esc(c.nome)}${fat>0?` <span style="font-size:10px;background:var(--green-bg);color:var(--green);padding:1px 7px;border-radius:50px;font-weight:700">${brl(fat)}</span>`:''}</div>
        <div class="cli-card-det">${[c.tel||c.telefone,c.cnpj,c.end||c.endereco].filter(Boolean).map(x=>esc(x)).join(' · ')||'—'}${c.email_responsavel?' · ✉️ '+esc(c.email_responsavel):''}</div>
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
      ${cli.tel||cli.email_responsavel||cli.cnpj?`<div class="chi-contato">
        ${cli.tel?`<span>📞 ${esc(cli.tel)}</span>`:''}
        ${cli.email_responsavel?`<span>✉ ${esc(cli.email_responsavel)}</span>`:''}
        ${cli.cnpj?`<span>🏢 ${esc(cli.cnpj)}</span>`:''}
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

function excluirCliente(id){
  confirmar('Excluir este cliente?', ()=>{ const lista=lsCliLer().filter(x=>x.id!==id); lsCliSalvar(lista); renderClientes(); toast('🗑 Cliente removido'); }, 'Excluir Cliente');
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

// Auto-cadastra cliente ao gerar orçamento/OS.
// Auto-cadastra cliente ao salvar orçamento. v2: a base já é escopada por empresa
// (RLS + empresa_id), então dedup é por nome.
function _autoSalvarCliente(nome, tel, end, cnpj, lojaId){
  if(!nome||nome==='—') return;
  const nomeL=nome.toLowerCase();
  const lista=lsCliLer();
  const idx=lista.findIndex(c=>(c.nome||'').toLowerCase()===nomeL);
  if(idx>=0) return; // já existe
  const novo={id:'cli_'+Date.now(),nome,tel:tel||'',end:end||'',cnpj:cnpj||'',email_responsavel:'',tipo:'',portal_token:crypto.randomUUID(),loja_id:lojaId||null};
  lista.unshift(novo); lsCliSalvar(lista);
  if(dbOk&&db) dbInsert('clientes',{id:novo.id,nome,telefone:tel||null,endereco:end||null,cnpj:cnpj||null,loja_id:novo.loja_id,portal_token:novo.portal_token}).catch(()=>{});
}

async function salvarNovoCliente(){
  const nome=gV('cli-new-nome').trim();
  if(!nome){ toast('⚠️ Informe o nome do cliente'); return; }
  if(_cliEditId){
    // modo edição
    const lista=lsCliLer();
    const idx=lista.findIndex(x=>x.id===_cliEditId);
    if(idx>=0){
      lista[idx]={...lista[idx], nome, tel:gV('cli-new-tel').trim(), end:gV('cli-new-end').trim(), cnpj:gV('cli-new-cnpj').trim(), email_responsavel:gV('cli-new-email').trim(), tipo:document.getElementById('cli-new-tipo')?.value||''};
      lsCliSalvar(lista);
      if(dbOk&&db&&!String(_cliEditId).startsWith('cli_')){ dbUpdate('clientes',{nome,telefone:lista[idx].tel,endereco:lista[idx].end,cnpj:lista[idx].cnpj||null,email_responsavel:lista[idx].email_responsavel||null,tipo:lista[idx].tipo||null},'id',_cliEditId).catch(e=>console.warn('cli update sync:',e?.message||e)); }
    }
    _cliEditId=null;
    document.getElementById('cli-form-wrap').style.display='none';
    renderClientes(); toast('✅ Cliente atualizado!'); return;
  }
  // modo novo
  const novo={id:'cli_'+Date.now(), nome, tel:gV('cli-new-tel').trim(), end:gV('cli-new-end').trim(), cnpj:gV('cli-new-cnpj').trim(), email_responsavel:gV('cli-new-email').trim(), tipo:document.getElementById('cli-new-tipo')?.value||'', portal_token:crypto.randomUUID(), loja_id:lojaAtiva||LOJA_PADRAO_ID};
  const lista=lsCliLer(); lista.unshift(novo); lsCliSalvar(lista);
  if(dbOk&&db){
    dbInsert('clientes',{id:novo.id,nome:novo.nome,telefone:novo.tel,endereco:novo.end,cnpj:novo.cnpj||null,email_responsavel:novo.email_responsavel||null,tipo:novo.tipo||null,loja_id:novo.loja_id,portal_token:novo.portal_token}).catch(e=>console.warn('cli sync:',e?.message||e));
  }
  document.getElementById('cli-form-wrap').style.display='none';
  renderClientes(); toast('✅ Cliente salvo!');
}

function mostrarFormCliente(){
  _cliEditId=null;
  const wrap=document.getElementById('cli-form-wrap');
  ['cli-new-nome','cli-new-tel','cli-new-end','cli-new-cnpj'].forEach(id=>setV(id,''));
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
  cadastrados.forEach(c=>{ if(c.nome) vistos.set(c.nome.toLowerCase(),{nome:c.nome,end:c.end||c.endereco||'',tel:c.tel||c.telefone||'',cnpj:c.cnpj||'',_cadastrado:true}); });
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
  if(!val||val.length<2){ box.style.display='none'; return; }
  const q=val.toLowerCase(); const qd=q.replace(/\D/g,'');
  const lista=_baseClientesUnificada().filter(c=>
    (c.nome||'').toLowerCase().includes(q)||(qd&&(c.cnpj||'').replace(/\D/g,'').includes(qd))
  ).sort((a,b)=>(b._cadastrado-a._cadastrado)).slice(0,6);
  if(!lista.length){ box.style.display='none'; return; }
  box.innerHTML=lista.map(c=>`<div class="cli-suggestion-item" onmousedown="selecionarSugestaoCli('${esc(c.nome)}','${esc(c.end||'')}','${esc(c.tel||'')}','${esc(c.cnpj||'')}')"><div class="cli-sug-name">${esc(c.nome)}${c._cadastrado?'':' <span style=\'font-size:10px;color:var(--gray);font-weight:400\'>(sem cadastro)</span>'}</div><div class="cli-sug-tel">${[c.tel,c.cnpj].filter(Boolean).map(x=>esc(x)).join(' · ')}</div></div>`).join('');
  box.style.display='block';
}
function selecionarSugestaoCli(nome,end,tel,cnpj){
  setV('cli',nome); if(end) setV('loc',end); if(tel) setV('tel-cli',tel); if(cnpj) setV('cnpj-cli',cnpj);
  // Cliente da base → pré-sugere origem "Já é cliente" (editável)
  if(!gV('origem-cli')) setOrigemCli('Já é cliente');
  document.getElementById('cli-suggestions').style.display='none'; upd();
}
function hideSugCli(){ const b=document.getElementById('cli-suggestions'); if(b) b.style.display='none'; }

function mostrarSugestoesCliOS(val){
  const box=document.getElementById('os-cli-suggestions'); if(!box) return;
  if(!val||val.length<2){ box.style.display='none'; return; }
  const q=val.toLowerCase(); const qd=q.replace(/\D/g,'');
  const lista=_baseClientesUnificada().filter(c=>
    (c.nome||'').toLowerCase().includes(q)||(qd&&(c.cnpj||'').replace(/\D/g,'').includes(qd))
  ).sort((a,b)=>(b._cadastrado-a._cadastrado)).slice(0,6);
  if(!lista.length){ box.style.display='none'; return; }
  box.innerHTML=lista.map(c=>`<div class="cli-suggestion-item" onmousedown="selecionarSugestaoCliOS('${esc(c.nome)}','${esc(c.end||'')}','${esc(c.cnpj||'')}')"><div class="cli-sug-name">${esc(c.nome)}${c._cadastrado?'':' <span style=\'font-size:10px;color:var(--gray);font-weight:400\'>(sem cadastro)</span>'}</div><div class="cli-sug-tel">${[c.tel,c.cnpj].filter(Boolean).map(x=>esc(x)).join(' · ')}</div></div>`).join('');
  box.style.display='block';
}
function selecionarSugestaoCliOS(nome,end,cnpj){
  setV('os-cli',nome); if(end) setV('os-loc',end); if(cnpj) setV('os-cnpj',cnpj);
  document.getElementById('os-cli-suggestions').style.display='none';
}
function hideSugCliOS(){ const b=document.getElementById('os-cli-suggestions'); if(b) b.style.display='none'; }

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
    <div class="modal-cli-item" onmousedown="selecionarCliModal('${esc(c.nome)}','${esc(c.end||'')}','${esc(c.tel||'')}','${esc(c.cnpj||'')}')">
      <div class="mcn">${esc(c.nome)}</div>
      <div class="mcd">${[c.end,c.tel,c.cnpj].filter(Boolean).map(x=>esc(x)).join('  ·  ')}</div>
    </div>`).join('');
}
function selecionarCliModal(nome, end, tel, cnpj){
  if(_buscaCliCtx === 'os'){
    setV('os-cli', nome);
    if(end) setV('os-loc', end);
    if(cnpj) setV('os-cnpj', cnpj);
  } else if(_buscaCliCtx === 'vis'){
    setV('vis-cli', nome);
    if(end) setV('vis-loc', end);
    // auto-fill email from client record
    const clis=JSON.parse(ls('fluxa_clientes_full')||'[]');
    const cliVis=clis.find(c=>(c.nome||'')=== nome);
    if(cliVis?.email_responsavel){
      setV('vis-email-resp', cliVis.email_responsavel);
      const st=document.getElementById('vis-email-status'); if(st) st.textContent=`📧 ${cliVis.email_responsavel} (do cadastro)`;
    }
  } else {
    setV('cli', nome);
    if(end) setV('loc', end);
    if(tel) setV('tel-cli', tel);
    if(cnpj) setV('cnpj-cli', cnpj);
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
      if(mudou){ lsCliSalvar(lista); atualizados++; }
    } else {
      const novo={id:'cli_'+Date.now()+Math.random(),nome:o.cliente,tel:o.tel_cliente||'',end:o.local_servico||'',cnpj:o.cnpj||'',portal_token:crypto.randomUUID()};
      lista.unshift(novo); lsCliSalvar(lista);
      if(dbOk&&db){ dbInsert('clientes',{id:novo.id,nome:novo.nome,telefone:novo.tel,endereco:novo.end,cnpj:novo.cnpj||null,loja_id:lojaAtiva||LOJA_PADRAO_ID,portal_token:novo.portal_token}).catch(e=>console.warn('[cli:insert]',e?.message||e)); }
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
    if(mudou){ lsCliSalvar(lista); if(dbOk&&db&&!String(existe.id).startsWith('cli_')) { try{ await db.from('clientes').update({telefone:existe.tel,endereco:existe.end,cnpj:existe.cnpj||null}).eq('id',existe.id); }catch(e){ console.warn('[cli:update]', e?.message||e); } } }
    return;
  }
  const novo={id:'cli_'+Date.now(),nome:dados.cli,tel:dados.tel||'',end:dados.loc||'',cnpj:dados.cnpj||'',portal_token:crypto.randomUUID()};
  lista.unshift(novo); lsCliSalvar(lista);
  if(dbOk&&db){ dbInsert('clientes',{id:novo.id,nome:novo.nome,telefone:novo.tel,endereco:novo.end,cnpj:novo.cnpj||null,loja_id:novo.loja_id||LOJA_PADRAO_ID,portal_token:novo.portal_token}).catch(e=>console.warn('[cli:auto-insert]',e?.message||e)); }
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
window.addEventListener('beforeprint',()=>{
  const showOrc = printMode==='orc' || printMode==='both';
  const showOs  = printMode==='os'  || printMode==='both';
  const showVis = printMode==='vis';
  document.getElementById('pdoc-orc').classList.toggle('print-active', showOrc);
  document.getElementById('pdoc-os').classList.toggle('print-active',  showOs);
  // pdoc-visita: se n\u00E3o for modo vis, garante que n\u00E3o aparece
  const pdocVis = document.getElementById('pdoc-visita');
  if(pdocVis && !showVis) pdocVis.classList.remove('print-active');
  // Auto-name the PDF file
  _printTitleBackup = document.title;
  try{
    if(showVis){
      // Nome: VISTORIA_NomeCliente_dd-mm-aaaa
      const cliEl = document.getElementById('pd-cli-nm-vis');
      const numEl = document.getElementById('pd-num-vis');
      const cli = (cliEl?.textContent||'').replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g,'').trim().replace(/\s+/g,'_');
      const dt  = (numEl?.textContent||'').replace(/\//g,'-');
      document.title = cli ? `Vistoria_${cli}_${dt}` : `Vistoria_${dt||'relatorio'}`;
    } else {
      const refMode = printMode==='os' ? 'os' : 'orc';
      const numEl = document.getElementById('pd-num-'+refMode);
      const cliEl = document.getElementById('pd-cli-nm-'+refMode);
      const num = (numEl?.textContent||'').replace(/[^0-9]/g,'').padStart(3,'0');
      const cli = (cliEl?.textContent||'').replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g,'').trim().replace(/\s+/g,'_');
      const prefix = printMode==='os'?'OS':printMode==='both'?'ORC+OS':'ORC';
      if(cli && num) document.title = `${cli}_${prefix}${num}`;
      else if(num) document.title = `${prefix}${num}`;
    }
  }catch(e){}
});
window.addEventListener('afterprint',()=>{
  document.getElementById('pdoc-orc').classList.remove('print-active');
  document.getElementById('pdoc-os').classList.remove('print-active');
  document.getElementById('pdoc-visita')?.classList.remove('print-active');
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
  document.getElementById('pdoc-orc')?.classList.toggle('print-active', showOrc);
  document.getElementById('pdoc-os')?.classList.toggle('print-active',  showOs);
  document.getElementById('pdoc-visita')?.classList.toggle('print-active', showVis);
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
      toast('🔔 Novo orçamento #'+String(novo.numero||'').padStart(3,'0')+' (outro dispositivo)');
    })
    .on('postgres_changes',_rtCfg('UPDATE','orcamentos'), p=>{
      const novo=p.new;
      lsOrcUpsert(novo);
      const idx=todosOrc.findIndex(x=>x.id===novo.id);
      if(idx>=0) todosOrc[idx]={...todosOrc[idx],...novo}; else todosOrc.unshift(novo);
      atualizarDash();
      if(document.getElementById('page-history').classList.contains('on')) renderTabela();
      // Reconcilia a reserva de estoque quando o status muda (ex.: cliente aprovou
      // pelo portal → este app, logado como gestor, faz a reserva). É idempotente.
      try{ if(typeof sincronizarReservaOrcamento==='function' && !eVendas()) sincronizarReservaOrcamento(novo); }catch(e){ console.warn('[rt orc reserva]', e?.message||e); }
    })
    .on('postgres_changes',_rtCfg('DELETE','orcamentos'), p=>{
      const id=p.old.id;
      todosOrc=todosOrc.filter(x=>x.id!==id);
      lsOrcRemover(id);
      atualizarDash();
      if(document.getElementById('page-history').classList.contains('on')) renderTabela();
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
  if(k==='fluxa_empresa_id'||k==='sb_url'||k==='sb_key'||k==='fluxa_sbar_col'
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

// M-01 — Diálogo de confirmação acessível (substitui window.confirm)
function confirmar(msg, cbSim, titulo, cbNao, labelNao, labelSim){
  const bg = document.getElementById('confirmar-modal-bg');
  const titEl = document.getElementById('confirmar-titulo');
  const msgEl = document.getElementById('confirmar-msg');
  const simBtn = document.getElementById('confirmar-sim');
  const naoBtn = document.getElementById('confirmar-nao');
  if(!bg){ cbSim(); return; } // fallback sem modal: confirma direto (PWA nunca cai aqui)
  titEl.textContent = titulo || 'Confirmar';
  msgEl.textContent = msg;
  naoBtn.textContent = labelNao || 'Cancelar';
  simBtn.textContent = labelSim || 'Confirmar';
  bg.classList.add('on');
  const fechar = () => { bg.classList.remove('on'); simBtn.onclick = null; naoBtn.textContent='Cancelar'; simBtn.textContent='Confirmar'; };
  naoBtn.onclick = () => { fechar(); if(cbNao) cbNao(); };
  simBtn.onclick = () => { fechar(); cbSim(); };
  setTimeout(()=>simBtn.focus(), 50);
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

function btnNotif(msg, tel){
  return `<button class="tb" title="Copiar mensagem" onclick='copiarNotif(${JSON.stringify(msg)})'>📋 Copiar</button>
          <button class="tb" style="background:var(--wa);color:white;border-color:var(--wa)" title="Enviar WhatsApp" onclick='enviarNotifWA(${JSON.stringify(msg)}, ${JSON.stringify(tel||'')})'>💬 WA</button>`;
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
    document.getElementById('portal-os-lista').innerHTML=concluidas.map(o=>`
      <div class="portal-os-item">
        <div class="portal-os-data">${o.data_servico?new Date(o.data_servico+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</div>
        <div class="portal-os-desc">${esc((o.servicos||[]).join(', ')||'Serviço')}</div>
        <span class="os-badge os-concluido">✅</span>
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
async function verificarAssinaturaOrc(o){
  if(!o||!o.assinatura_hash) return 'sem_hash';
  const h=await _hashDocumentoOrc(o);
  return h===o.assinatura_hash ? 'ok' : 'alterado';
}
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

function copiarLinkPortal(id){
  const lista=lsCliLer();
  const cli=lista.find(x=>x.id===id); if(!cli||!cli.portal_token) return;
  const url=window.location.origin+window.location.pathname+'#portal/'+cli.portal_token;
  const msg=`Olá, ${cli.nome}! 👋\n\nAcesse seu portal exclusivo para acompanhar seus agendamentos, histórico de serviços e orçamentos:\n\n${url}\n\nQualquer dúvida estamos à disposição!\n*${CFG.nome}*`;
  navigator.clipboard.writeText(msg).then(()=>toast('✅ Link do portal copiado!')).catch(()=>toast('✅ Copiado!'));
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
  return { total:os.length, conc:conc.length, canc:canc.length, taxa, tempoMed, desp, clientes, faturamento };
}
// Config de comissão/metas (global, editável na tela de Produtividade)
function getComissaoPct(){ return parseFloat(ls('fluxa_comissao_pct')||'0')||0; }
function getMetaTec(){ return parseFloat(ls('fluxa_meta_tec')||'0')||0; }
function setComissaoPct(v){ lsSet('fluxa_comissao_pct', String(parseFloat(v)||0)); renderProd(); }
function setMetaTec(v){ lsSet('fluxa_meta_tec', String(parseFloat(v)||0)); renderProd(); }

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
function renderContasReceber(){
  const tbody=document.getElementById('cr-tabela-body'); if(!tbody) return;
  const resumo=document.getElementById('cr-resumo');
  const aprov=filtrarPorLoja(todosOrc).filter(o=>o.status==='aprovado');
  const comSaldo=aprov.map(o=>({o, saldo:(o.total||0)-(o.valor_recebido||0)}))
                      .filter(x=>x.saldo>0.005)
                      .sort((a,b)=>b.saldo-a.saldo);
  const totalReceber=comSaldo.reduce((a,x)=>a+x.saldo,0);
  const totalRecebido=aprov.reduce((a,o)=>a+(o.valor_recebido||0),0);
  const totalAprovado=aprov.reduce((a,o)=>a+(o.total||0),0);
  if(resumo){
    const chip=(lbl,val,cor)=>`<div style="flex:1;min-width:130px;background:var(--gray-light);border-radius:10px;padding:10px 14px">
      <div style="font-size:11px;color:var(--gray);font-weight:600;text-transform:uppercase;letter-spacing:.5px">${lbl}</div>
      <div style="font-size:18px;font-weight:800;color:${cor}">${brl(val)}</div></div>`;
    resumo.innerHTML=chip('A Receber',totalReceber,'var(--red)')+chip('Já Recebido',totalRecebido,'var(--green)')+chip('Total Aprovado',totalAprovado,'var(--c2)');
  }
  if(!comSaldo.length){ tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:18px">✅ Nenhum saldo em aberto — tudo recebido!</td></tr>'; return; }
  tbody.innerHTML=comSaldo.map(({o,saldo})=>{
    const num=String(o.numero||'—').padStart(3,'0');
    const rec=o.valor_recebido||0;
    const parcial=rec>0;
    return `<tr>
      <td><strong>#${num}</strong></td>
      <td>${esc(o.cliente||'—')}${parcial?' <span style="font-size:10px;background:var(--yellow-bg);color:var(--yellow);padding:1px 6px;border-radius:50px;font-weight:700">parcial</span>':''}</td>
      <td>${brl(o.total||0)}</td>
      <td>${rec>0?brl(rec):'—'}</td>
      <td><strong style="color:var(--red)">${brl(saldo)}</strong></td>
      <td><button class="tb g" style="font-size:11px" onclick="abrirModalPg('${o.id}',${o.total||0})">💰 Registrar</button></td>
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

async function salvarDespesa(){
  const tec=gV('desp-tec'), tipo=gV('desp-tipo'), valor=parseFloat(gV('desp-valor'))||0;
  if(!tec||!tipo||!valor){ toast('⚠️ Informe técnico, tipo e valor'); return; }
  lsSet('fluxa_ultimo_tec',tec);
  const osInput=gV('desp-os-num');
  let osNum=null; const m=osInput.match(/\d+/); if(m) osNum=parseInt(m[0]);
  const dados={ tecnico:tec, data:gV('desp-data'), tipo, valor, descricao:gV('desp-desc'), os_numero:osNum||null, foto_base64:despFotoB64||null, status:'pendente', loja_id:lojaAtiva||LOJA_PADRAO_ID };
  const rec={...dados, id:'desp_'+Date.now(), data_criacao:new Date().toISOString()};
  todasDesp.unshift(rec); lsDespSalvar(todasDesp);
  if(dbOk&&db){
    (async()=>{
      try{ const {data:ins}=await dbInsert('despesas', dados);
        if(ins){ todasDesp=todasDesp.filter(x=>x.id!==rec.id); todasDesp.unshift(ins); lsDespSalvar(todasDesp); }
      }catch(e){ console.warn('desp sync:',e.message); }
    })();
  }
  fecharFormDesp(); renderDespesas(); toast('✅ Despesa registrada!');
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
      if(data){ todasDesp=data; lsDespSalvar(todasDesp); renderDespesas(); }
    }catch(e){ console.warn('[loadDespesas]', e?.message||e); }
  }
}

function renderDespesas(){
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

function getTecnicos(){ return CFG.tecnicos || LOJAS.flatMap(l=>l.tecs||[]).filter((v,i,a)=>a.indexOf(v)===i); }

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
    (async()=>{
      try{
        const {data:ins}=await dbInsert('agendamentos', dados);
        if(ins){ todosAg=todosAg.filter(x=>x.id!==rec.id); todosAg.unshift(ins); lsAgSalvar(todosAg); }
      }catch(e){ console.warn('ag sync:',e.message); }
    })();
  }
  fecharFormAg(); renderAgLista(); renderCal();
  toast('✅ Agendamento salvo! OS geradas automaticamente.');
}

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
        const soLocalAg=todosAg.filter(x=>String(x.id).startsWith('ag_')&&!idAg.has(x.id));
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

function renderCal(){
  const el=document.getElementById('cal-tabela'); if(!el) return;
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
  const o=getNC(id)||todosOS.find(x=>x.id===id)||(()=>{ try{ return JSON.parse(ls('fluxa_os_hist')||'[]').find(x=>x.id===id); }catch(e){ return null; } })();
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
  toast('📍 Check-in realizado!');
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
  // Captura o que o técnico preencheu na OS para salvar JUNTO com o check-out
  const chkOk = (osChecklist||[]).filter(x=>x.checked);
  const dadosPreenchidos = {
    obs_tecnica: gV('os-obs')||'',
    materiais: gV('os-mat')||'',
    fotos: (osFotos||[]).filter(Boolean),
    video_link: gV('os-video-link')||null,
    checklist: chkOk.length?JSON.stringify(chkOk):null,
    tecnico: gV('os-tec-checkin')||gV('os-tec')||''
  };
  if(dbOk&&db&&osCheckinId&&!String(osCheckinId).startsWith('local_')){
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
  } else {
    ['eq-cli-nome','eq-tipo','eq-marca','eq-modelo','eq-potencia','eq-serie','eq-instalacao','eq-obs'].forEach(id=>setV(id,''));
    setV('eq-garantia','12'); setV('eq-garantia-venc','');
    eqFotoB64='';
    const prev=document.getElementById('eq-foto-prev'); prev.style.display='none';
    document.getElementById('eq-btn-rm-foto').style.display='none';
    document.getElementById('eq-foto-lbl').textContent='Tirar foto ou selecionar imagem';
  }
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

function filtrarClientesEq(v){
  const dl=document.getElementById('eq-cli-list'); dl.innerHTML='';
  const clientes=JSON.parse(ls('fluxa_clientes_full')||'[]');
  clientes.filter(c=>(c.nome||'').toLowerCase().includes(v.toLowerCase())).slice(0,8).forEach(c=>{
    const opt=document.createElement('option'); opt.value=c.nome; dl.appendChild(opt);
  });
}

async function salvarEquipamento(){
  const nome=gV('eq-cli-nome').trim(), tipo=gV('eq-tipo');
  if(!nome||!tipo){ toast('⚠️ Informe o cliente e o tipo'); return; }
  const _btnEq=document.querySelector('button[onclick="salvarEquipamento()"]');
  if(_btnEq){ _btnEq.disabled=true; _btnEq.textContent='Salvando…'; }
  const venc=calcVencGarantia();
  const dados={
    cliente_nome:nome, tipo, marca:gV('eq-marca'), modelo:gV('eq-modelo'),
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
      (async()=>{
        try{
          const {data:ins}=await dbInsert('equipamentos', dados);
          if(ins){ todosEq=todosEq.filter(x=>x.id!==tempId); todosEq.unshift(ins); lsEqSalvar(todosEq); renderEqGrid(); }
        }catch(e){ console.warn('eq sync falhou:',e.message); }
      })();
    }
    toast('✅ Equipamento salvo!');
  }
  if(_btnEq){ _btnEq.disabled=false; _btnEq.textContent='💾 Salvar Equipamento'; }
  fecharFormEq(); renderEqGrid(); verificarAlertasGarantia();
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
      todosEq=data; lsEqSalvar(todosEq); renderEqGrid(); verificarAlertasGarantia();
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
        <button class="tb" onclick="verQR('${eq.id}')">🔳 QR Code</button>
        <button class="tb" onclick="abrirFormEq('${eq.id}')">✎ Editar</button>
        <button class="tb" title="Notif. garantia" onclick='copiarNotif(notifGarantia(${JSON.stringify(eq)}))'>⚠️💬</button>
        <button class="tb d" onclick="excluirEq('${eq.id}')">🗑</button>
      </div>`;
    el.appendChild(card);
  });
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
  el.innerHTML=`<div style="background:var(--yellow-bg);border:1px solid var(--yellow);border-radius:10px;padding:12px 16px;font-size:13px;color:var(--yellow);font-weight:600">
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
function checkQRHash(){
  const hash=window.location.hash;
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
        <div class="usr-det">${u.loja_nome?'Loja: '+esc(u.loja_nome)+' · ':''}PIN: ${u.pin?'✅ definido':'⚠️ não definido'}</div>
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
    if(dbOk&&db&&!String(_usrEditId).startsWith('usr_')&&!String(_usrEditId).startsWith('tec_')){
      try{ await dbUpdate('usuarios', upd, 'id', _usrEditId); }catch(e){ console.warn('[editUsr]',e?.message||e); }
    } else if(dbOk&&db){ // id local → tenta upsert pelo registro inteiro
      try{ await dbUpsert('usuarios', todosUsuarios[i]); }catch(e){ console.warn('[editUsr upsert]',e?.message||e); }
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
      const {data:ins}=await dbInsert('usuarios', dados);
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
    try{ await db.from('usuarios').update({ativo:false}).eq('id',id); }catch(e){ console.warn('usr delete sync:',e.message); }
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
  const tecList=(typeof CFG!=='undefined'&&CFG.tecnicos)?CFG.tecnicos:[];
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

// ── CONCLUIR VISITA — equipamentos no modal ──────────────────────────────────
let _cvEquipData={}; // {idx: {status, obs, fotos:[]}}

function renderConcluirVisEquips(equips){
  _cvEquipData={};
  const wrap=document.getElementById('concluir-vis-equips-wrap');
  const list=document.getElementById('concluir-vis-equip-list');
  if(!wrap||!list) return;
  if(!equips||!equips.length){ wrap.style.display='none'; return; }
  wrap.style.display='';
  equips.forEach((_,i)=>{ _cvEquipData[i]={status:'',obs:'',fotos:[]}; });
  list.innerHTML=equips.map((eq,i)=>`
    <div class="cv-eq-row" id="cv-eq-row-${i}">
      <div class="cv-eq-hdr">
        <div>
          <div class="cv-eq-name">⚙️ ${esc(eq.nome||'Equipamento')}</div>
          ${(eq.modelo||eq.potencia)?`<div class="cv-eq-sub">${[eq.modelo,eq.potencia].filter(Boolean).map(esc).join(' · ')}</div>`:''}
        </div>
        <div class="cv-eq-badges">
          <button class="cv-eq-badge bom" id="cv-eq-b-bom-${i}" onclick="setCvEquipStatus(${i},'bom')">✓ Bom</button>
          <button class="cv-eq-badge atencao" id="cv-eq-b-atencao-${i}" onclick="setCvEquipStatus(${i},'atencao')">⚠ Atenção</button>
          <button class="cv-eq-badge critico" id="cv-eq-b-critico-${i}" onclick="setCvEquipStatus(${i},'critico')">✕ Crítico</button>
          <button class="cv-eq-badge na" id="cv-eq-b-na-${i}" onclick="setCvEquipStatus(${i},'na')">— N/A</button>
        </div>
      </div>
      <textarea class="cv-eq-obs" rows="2" placeholder="Descrição da condição do equipamento…" oninput="_cvEquipData[${i}].obs=this.value" id="cv-eq-obs-${i}"></textarea>
      <div class="cv-eq-fotos" id="cv-eq-fotos-${i}">
        <input type="file" accept="image/*" id="cv-eq-file-${i}" style="display:none" onchange="cvCapturarFoto(${i},this)">
        <button type="button" class="cv-eq-foto-btn" onclick="document.getElementById('cv-eq-file-${i}').click()">📷 Foto</button>
      </div>
    </div>
  `).join('');
}

function setCvEquipStatus(idx,status){
  _cvEquipData[idx].status=status;
  ['bom','atencao','critico','na'].forEach(s=>{
    const btn=document.getElementById(`cv-eq-b-${s}-${idx}`);
    if(btn){ btn.classList.toggle('on',s===status); }
  });
  const row=document.getElementById(`cv-eq-row-${idx}`);
  if(row){ row.className='cv-eq-row'+(status&&status!=='na'?' st-'+status:''); }
}

function cvCapturarFoto(idx,input){
  const files=input.files; if(!files||!files.length) return;
  const file=files[0];
  const reader=new FileReader();
  reader.onload=async e=>{
    const compressed=await compressImage(e.target.result); // fix #5: comprime antes de armazenar
    _cvEquipData[idx].fotos=_cvEquipData[idx].fotos||[];
    _cvEquipData[idx].fotos.push(compressed);
    const fotosDiv=document.getElementById(`cv-eq-fotos-${idx}`);
    if(fotosDiv){
      const img=document.createElement('img');
      img.src=compressed; img.className='cv-eq-thumb';
      img.title='Clique para remover';
      const fotoIdx=_cvEquipData[idx].fotos.length-1;
      img.onclick=()=>{ _cvEquipData[idx].fotos.splice(fotoIdx,1); img.remove(); };
      // insere antes do botão de adicionar
      const btn=fotosDiv.querySelector('.cv-eq-foto-btn');
      fotosDiv.insertBefore(img,btn);
    }
    input.value=''; // reset para permitir nova foto
  };
  reader.readAsDataURL(file);
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

// Abre o modal de conclusão de visita com todos os dados do plano pré-preenchidos
function iniciarVistoriaLocal(id){
  const loc=locaisVistoria.find(x=>x.id===id);
  if(!loc) return;
  window._concluirVisLocalId=id;
  const s=getSessao();
  // Cabeçalho
  document.getElementById('concluir-vis-id').value=id;
  document.getElementById('concluir-vis-nome').textContent=loc.cliente+' — '+loc.local;
  // Data = hoje
  document.getElementById('concluir-vis-data').value=_hojeLocal();
  // Horário = hora preferencial do plano, ou hora atual
  const horaEl=document.getElementById('concluir-vis-hora');
  if(horaEl) horaEl.value=loc.hora_pref||new Date().toTimeString().slice(0,5);
  // Técnico = responsável do plano, ou técnico logado
  document.getElementById('concluir-vis-tec').value=loc.tecnico||s?.nome||'';
  // Observações
  document.getElementById('concluir-vis-obs').value='';
  // Equipamentos do plano
  const equips=normalizeLocEquips(loc.equipamentos||[]);
  renderConcluirVisEquips(equips);
  // Guarda lista para salvar depois
  window._concluirVisEquips=equips;
  document.getElementById('concluir-vis-bg').classList.add('on');
}
function fecharConcluirVis(){
  document.getElementById('concluir-vis-bg').classList.remove('on');
  window._concluirVisLocalId=null;
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
async function salvarConcluirVis(){
  const id=window._concluirVisLocalId;
  const loc=locaisVistoria.find(x=>x.id===id);
  if(!loc){ fecharConcluirVis(); return; }
  const data=document.getElementById('concluir-vis-data').value||_hojeLocal();
  const hora=document.getElementById('concluir-vis-hora')?.value||new Date().toTimeString().slice(0,5);
  const tec=document.getElementById('concluir-vis-tec').value.trim();
  const obs=document.getElementById('concluir-vis-obs').value.trim();
  const s=getSessao();
  const lojaId=_lojaDaVistoria(loc); // herda a empresa do plano (consistente com os demais fluxos)
  const mes=data.slice(0,7); // usa mês da data informada, não visMesRef
  // Idempotência: se já há vistoria deste local neste mês, atualiza em vez de duplicar
  const _jaExiste=_vistoriaExistente(id, mes);
  // Monta array de equipamentos com status/obs/fotos coletados no modal
  const equipsBase=window._concluirVisEquips||[];
  const equipamentos=equipsBase.map((eq,i)=>({
    id:eq.id,
    nome:eq.nome,
    modelo:eq.modelo||'',
    potencia:eq.potencia||'',
    emoji:'⚙️',
    status:(_cvEquipData[i]?.status)||'na',
    obs:(_cvEquipData[i]?.obs)||'',
    fotos:(_cvEquipData[i]?.fotos)||[]
  }));
  const rec={
    id:_jaExiste?_jaExiste.id:('vis_'+Date.now()),
    loja_id:lojaId,
    local_id:id,
    cliente:loc.cliente,
    local:loc.local,
    data,
    hora,
    hora_checkin:hora,
    hora_checkout:'',
    tecnico:tec||s?.nome||'',
    mes_ref:mes,
    obs_geral:obs,
    email_responsavel:loc.email_responsavel||null,
    equipamentos,
    created_at:_jaExiste?.created_at||new Date().toISOString()
  };
  // Atualiza no lugar se já existia (idempotente); senão insere no topo
  const lista=lsVisLer();
  const _ix=lista.findIndex(x=>x.id===rec.id);
  if(_ix>=0) lista[_ix]=rec; else lista.unshift(rec);
  lsVisSalvar(lista);
  if(dbOk&&db){
    // Sincroniza em background (não trava o fechamento do modal)
    (async()=>{
      try{
        // Sobe as fotos para o Storage e troca base64 por URL (igual ao salvarVistoria).
        const recComUrls = await _uploadFotosVistoria(rec);
        // Atualiza o local com as URLs que subiram (mantém base64 onde falhou)
        const l=lsVisLer(); const ix=l.findIndex(x=>x.id===rec.id);
        if(ix>=0){ l[ix]=recComUrls; lsVisSalvar(l); }
        // Envia ao banco com fotos como URL (null onde não subiu) — linha leve, sem base64
        const recParaSupabase = {
          ...recComUrls,
          equipamentos:(recComUrls.equipamentos||[]).map(eq=>({...eq, fotos:(eq.fotos||[]).map(f=>f&&f.startsWith('http')?f:null)}))
        };
        const r=await _comTimeout(dbUpsert('vistorias', recParaSupabase), 20000, 'vis rápida');
        if(r&&r.error) console.warn('vis rápida Supabase:', r.error.message);
      }
      catch(e){ console.warn('vis rápida Supabase (bg):',e?.message||e); }
    })();
  }
  // Marca a OS do agendamento deste mês como concluída
  if(loc.agendamento_id){
    const mesStr=data.slice(0,7); // YYYY-MM
    const osLocal=JSON.parse(ls('fluxa_os_hist')||'[]');
    const osIdx=osLocal.findIndex(o=>o.agendamento_id===loc.agendamento_id&&o.data_servico&&o.data_servico.startsWith(mesStr)&&o.status==='agendado');
    if(osIdx>=0){
      osLocal[osIdx].status='concluido';
      osLocal[osIdx].obs_tecnica=(osLocal[osIdx].obs_tecnica?osLocal[osIdx].obs_tecnica+'\n':'')+obs;
      lsSet('fluxa_os_hist',JSON.stringify(osLocal.slice(0,200)));
      if(dbOk&&db){ db.from('ordens_servico').update({status:'concluido'}).eq('id',osLocal[osIdx].id).then(()=>{}).catch(()=>{}); }
      _entregarPelaOS(osLocal[osIdx].id); // baixa do estoque do orçamento vinculado
    }
  }
  fecharConcluirVis();
  renderLocaisTab();
  renderVisHistorico();
  toast('✅ Visita registrada!');
  // Envia e-mail se houver responsável
  if(rec.email_responsavel && emailJSConfigurado()){
    const ok=await enviarEmailVistoria(rec);
    if(ok) toast('📧 Relatório enviado por e-mail');
  }
}
// Abre formulário completo (equipamentos, fotos, checkin/checkout)
function concluirVisDetalhada(){
  const id=window._concluirVisLocalId;
  fecharConcluirVis();
  const loc=locaisVistoria.find(x=>x.id===id);
  if(!loc) return;
  // Converte equipamentos do plano para o formato do formulário completo
  const equipsPlano=normalizeLocEquips(loc.equipamentos||[]);
  visEquipSelecionados=equipsPlano.map(e=>e.id);
  // Pré-carrega dados nos equipamentos do formulário (para mostrar modelo/potência)
  visEquipDados={};
  equipsPlano.forEach(e=>{ visEquipDados[e.id]={status:'na',obs:'',fotos:[],modelo:e.modelo,potencia:e.potencia}; });
  // Abre formulário completo com dados do local
  novaVistoria(loc.cliente, loc.local, loc.tecnico||'');
  setTimeout(()=>{
    const emailEl=document.getElementById('vis-email-resp');
    if(emailEl && loc.email_responsavel) emailEl.value=loc.email_responsavel;
    const mesEl=document.getElementById('vis-mes-ref');
    const _n=new Date();
    const mesData=`${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}`;
    if(mesEl) mesEl.value=mesData;
    const horaEl=document.getElementById('vis-hora');
    if(horaEl && loc.hora_pref) horaEl.value=loc.hora_pref;
    window._visLocalId=id;
    // Adiciona equipamentos customizados ao grid
    _visEquipsCustom=equipsPlano;
    renderVisEquipGrid();
  }, 80);
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

let _visEquipsCustom=[]; // equipamentos vindos de um plano de acompanhamento

// ── Grid de vistoria por equipamento ──
function renderVisEquipGrid(){
  const el = document.getElementById('vis-equip-grid'); if(!el) return;
  el.innerHTML = '';
  // Esconde/mostra o bloco de equipamentos
  const card = document.getElementById('vis-equip-card');
  const hasEquips=visEquipSelecionados.length>0||_visEquipsCustom.length>0;
  if(card) card.style.display=hasEquips?'':'none';

  // Renderiza equipamentos customizados do plano (se existirem)
  const customIds=_visEquipsCustom.map(e=>e.id);
  if(_visEquipsCustom.length){
    const secTit=document.createElement('div');
    secTit.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin-bottom:8px';
    secTit.textContent='Equipamentos do plano';
    el.appendChild(secTit);
    _visEquipsCustom.forEach(ceq=>{
      const id=ceq.id;
      if(!visEquipDados[id]) visEquipDados[id]={status:'na',obs:'',fotos:[]};
      const d=visEquipDados[id];
      el.appendChild(buildEquipBlock(id,ceq.emoji||'⚙️',ceq.nome,d,ceq.modelo,ceq.potencia));
    });
  }

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
      el.appendChild(buildEquipBlock(id,def.emoji,def.nome,d,'',''));
    });
  }
}

function buildEquipBlock(id,emoji,nome,d,modelo,potencia){
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
}

function visUpdObs(id, val){
  if(!visEquipDados[id]) visEquipDados[id]={ status:'na', obs:'', fotos:[] };
  visEquipDados[id].obs = val;
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
  };
  r.readAsDataURL(f);
}
function visRemoverFoto(id, idx){
  if(visEquipDados[id]?.fotos) visEquipDados[id].fotos[idx]=null;
  renderVisEquipGrid();
}

// Faz upload de uma foto (base64) para o Supabase Storage e retorna a URL pública.
// Retorna null se falhar (a foto base64 original fica preservada localmente).
async function _uploadFotoStorage(base64, path){
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
    const { error } = await db.storage.from('vistorias-fotos').upload(fullPath, blob, { contentType:mime, upsert:true });
    if(error){ console.warn('[uploadFoto]', error.message); return null; }
    const { data:pub } = db.storage.from('vistorias-fotos').getPublicUrl(fullPath);
    return pub?.publicUrl || null;
  }catch(e){ console.warn('[uploadFoto]', e?.message||e); return null; }
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

// ── Autocomplete cliente no campo vis-cli ──
function mostrarSugestoesCliVis(val){
  const sug = document.getElementById('vis-cli-suggestions'); if(!sug) return;
  if(!val||val.length<2){ sug.style.display='none'; return; }
  const clientes = JSON.parse(ls('fluxa_clientes_full')||'[]');
  const hits = clientes.filter(c=>(c.nome||'').toLowerCase().includes(val.toLowerCase())).slice(0,5);
  if(!hits.length){ sug.style.display='none'; return; }
  sug.innerHTML = hits.map(c=>`<div class="cli-suggestion-item" onmousedown="selecionarCliVis('${esc(c.nome||'')}','${esc(c.local||c.endereco||'')}')"><div class="cli-sug-name">${esc(c.nome)}</div><div class="cli-sug-tel">${esc(c.local||c.endereco||c.tel||'')}</div></div>`).join('');
  sug.style.display='block';
}
function hideSugCliVis(){ const el=document.getElementById('vis-cli-suggestions'); if(el) el.style.display='none'; }
function selecionarCliVis(nome, local){
  const inp=document.getElementById('vis-cli'); if(inp) inp.value=nome;
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
  _visEquipsCustom = customEquips.map(e=>({id:e.id, nome:e.nome, emoji:e.emoji||'⚙️', modelo:e.modelo||'', potencia:e.potencia||''}));
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
      return {id:ceq.id,nome:ceq.nome,emoji:ceq.emoji||'⚙️',modelo:ceq.modelo||'',potencia:ceq.potencia||'',status:d.status,obs:d.obs||'',fotos:(d.fotos||[]).filter(Boolean)};
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
function _montarRecVistoria(){
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
  return {
    id,
    loja_id: _lojaRec,
    local_id: window._visLocalId||'',
    cliente:(document.getElementById('vis-cli')?.value||'').trim(),
    local:(document.getElementById('vis-loc')?.value||'').trim(),
    data: document.getElementById('vis-data')?.value||_hojeLocal(),
    hora,
    tecnico: (document.getElementById('vis-tec')?.value||'')||(s?.nome||''),
    mes_ref: mesRef,
    hora_checkin: visCheckinTime?visCheckinTime.toTimeString().slice(0,5):hora,
    hora_checkout: visCheckoutTime?visCheckoutTime.toTimeString().slice(0,5):null,
    obs_geral: document.getElementById('vis-obs')?.value||'',
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
    const rec = _montarRecVistoria();
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
  // Limpa campos do form
  ['vis-cli','vis-loc','vis-hora','vis-obs','vis-email-resp'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const hoje = new Date();
  const _ld=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  const dd = document.getElementById('vis-data'); if(dd) dd.value = _ld;
  const mm = document.getElementById('vis-mes-ref'); if(mm) mm.value = _ld.slice(0,7);
  const st = document.getElementById('vis-email-status'); if(st) st.textContent='';
  renderVisChips();
  renderVisEquipGrid();
}

// ── Finalizar vistoria: salva, limpa o form e navega para o histórico ──
async function finalizarVistoria(){
  const ok = await salvarVistoria();
  if(ok){
    _limparFormVistoria(); // previne re-submit acidental ao voltar para "Nova Vistoria"
    setTimeout(()=>visTab('hist'), 300);
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
    const statCard=(val,lbl,cor,bg)=>`<div style="background:${bg};border-radius:12px;padding:14px 10px;text-align:center"><div style="font-size:24px;font-weight:800;color:${cor}">${val}</div><div style="font-size:10px;font-weight:600;color:${cor};opacity:.8;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">${lbl}</div></div>`;
    statsEl.innerHTML=statCard(total,'Vistorias','var(--c2)','var(--white)')+statCard(comAtencao,'c/ Atenção','var(--yellow)','var(--yellow-bg)')+statCard(comCritico,'c/ Crítico','var(--red)','var(--red-bg)');
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
  const rec=_montarRecVistoria();
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
      const fotosHtml=fotosArr.length
        ?`<div class="pd-vis-equip-fotos">${fotosArr.map((f,i)=>`
            <div class="pd-vis-foto-item">
              <img src="${f}" alt="Foto ${i+1}">
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

  // Footer
  const tel=LC.tel||''; const email=LC.email||'';
  if(footEl){ footEl.style.background=cor2; footEl.textContent=`${LC.nome||''}${tel?' · '+tel:''}${email?' · '+email:''}`; }
  const metaEl=document.getElementById('pd-meta-vis');
  if(metaEl) metaEl.innerHTML=`${LC.nome||''}${tel?'<br>'+tel:''}`;
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
  set('vis-cli',vis.cliente); set('vis-loc',vis.local);
  const _en=new Date(); const _ed=`${_en.getFullYear()}-${String(_en.getMonth()+1).padStart(2,'0')}-${String(_en.getDate()).padStart(2,'0')}`;
  set('vis-data',vis.data||_ed);
  set('vis-mes-ref',vis.mes_ref||_ed.slice(0,7));
  set('vis-hora',vis.hora||vis.hora_checkin||'');
  set('vis-obs',vis.obs_geral);
  set('vis-email-resp',vis.email_responsavel);
  const tecSel=document.getElementById('vis-tec');
  if(tecSel&&vis.tecnico){ for(const o of tecSel.options){ if(o.text===vis.tecnico||o.value===vis.tecnico){ o.selected=true; break; } } }
  // Equipamentos: separa padrão de custom e PRESERVA status/obs/fotos
  const stdDefs=VIS_EQUIPAMENTOS_DEFAULT.map(x=>x.id);
  visEquipSelecionados=equips.filter(e=>stdDefs.includes(e.id)).map(e=>e.id);
  _visEquipsCustom=equips.filter(e=>!stdDefs.includes(e.id)).map(e=>({id:e.id,nome:e.nome,emoji:e.emoji||'⚙️',modelo:e.modelo||'',potencia:e.potencia||''}));
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
function movRefExiste(ref){ return todosMovEstoque.some(m=>m.ref===ref); }

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

// Um produto de um orçamento já foi TRATADO na entrega (baixado ou marcado como não-levado)?
function _entregueProdutoOrc(orcId, pid){
  return todosMovEstoque.some(m=> m.ref==='baixa:orc:'+orcId+':'+pid || m.ref==='libres:orc:'+orcId+':'+pid);
}
// Orçamento aprovado com produtos ainda não entregues?
function orcTemEntregaPendente(orc){
  if(!orc||orc.status!=='aprovado') return false;
  return (orc.servicos||[]).some(s=>s.produto_id && !_entregueProdutoOrc(orc.id,s.produto_id));
}

// ── Reconciliação da RESERVA de um orçamento (aprovar/reverter/editar/excluir) ──
// Aprovado e não entregue → reserva os produtos. Reverteu/excluiu/entregou → libera.
// Idempotente: lança só a diferença entre o que deveria estar reservado e o que já está.
function sincronizarReservaOrcamento(orc){
  if(!orc||!orc.id) return;
  const aprovado = orc.status==='aprovado';
  const desejado={};
  if(aprovado){
    (orc.servicos||[]).filter(s=>s.produto_id).forEach(s=>{
      if(_entregueProdutoOrc(orc.id,s.produto_id)) return; // já entregue → não reserva
      desejado[s.produto_id]=(desejado[s.produto_id]||0)+(parseInt(s.qty)||1);
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
function entregarOrcamento(orc, origem, qtyMap){
  if(!orc||!orc.id) return;
  if(orc.status!=='aprovado'){ if(origem==='manual'||origem==='validar') toast('⚠️ Só dá baixa de orçamento aprovado'); return; }
  let baixou=false;
  (orc.servicos||[]).filter(s=>s.produto_id).forEach(s=>{
    const pid=s.produto_id;
    if(_entregueProdutoOrc(orc.id,pid)) return; // já tratado
    const reservado=Math.abs(parseInt(s.qty)||1);
    const levado = qtyMap && (pid in qtyMap) ? Math.max(0,Math.abs(parseFloat(qtyMap[pid])||0)) : reservado;
    const p=produtoById(pid);
    const numStr=String(orc.numero||'').padStart(3,'0');
    if(levado>0){
      registrarMovimento({produto_id:pid, tipo:'saida', quantidade:-levado, custo_unit:p?p.custo:null, motivo:'Entrega orçamento #'+numStr, ref:'baixa:orc:'+orc.id+':'+pid, lojaId:orc.loja_id});
    }
    // libera SEMPRE a reserva (item resolvido na entrega, levando tudo, parte ou nada)
    registrarMovimento({produto_id:pid, tipo:'liberacao_reserva', quantidade:-reservado, custo_unit:null, motivo:(levado>0?'Baixa entrega #':'Item não levado #')+numStr, ref:'libres:orc:'+orc.id+':'+pid, lojaId:orc.loja_id});
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
  const kpis=document.getElementById('estoque-kpis');
  if(kpis) kpis.innerHTML=`
    <div class="dc o"><div class="dl">Valor em estoque</div><div class="dv">${brl(valorEstoque)}</div><div class="ds">${todos.length} produto${todos.length!==1?'s':''}</div></div>
    <div class="dc ${enc.length?'r':'g'}" style="cursor:pointer" onclick="filtEstoque('comprar')"><div class="dl">A comprar (encomenda)</div><div class="dv">${enc.length}</div><div class="ds">${brl(valorEncomenda)}</div></div>
    <div class="dc y" style="cursor:pointer" onclick="filtEstoque('repor')"><div class="dl">Repor (mínimo)</div><div class="dv">${repor.length}</div><div class="ds">abaixo do mínimo</div></div>
    <div class="dc b" style="cursor:pointer" onclick="filtEstoque('parados')"><div class="dl">Capital parado</div><div class="dv">${brl(valorParado)}</div><div class="ds">${parados.length} sem giro (90d)</div></div>
    ${vencendo.length?`<div class="dc r" style="cursor:pointer" onclick="filtEstoque('validade')"><div class="dl">Validade</div><div class="dv">${vencendo.length}</div><div class="ds">vencendo/vencido</div></div>`:''}`;

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
function toggleMenuEstoque(id){
  // Fecha todos os outros menus abertos primeiro
  document.querySelectorAll('[id^="emenu_"]').forEach(el=>{ if(el.id!==id) el.style.display='none'; });
  const el=document.getElementById(id); if(el) el.style.display=el.style.display==='none'?'block':'none';
  // Fecha ao clicar fora
  setTimeout(()=>{
    function fora(e){ if(!document.getElementById(id)?.contains(e.target)){ const m=document.getElementById(id); if(m) m.style.display='none'; document.removeEventListener('click',fora); } }
    document.addEventListener('click',fora);
  },10);
}

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
  _histProdId=produtoId; _histProdPag=0; _histProdFiltro='todos';
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
    body.innerHTML='<div style="padding:20px;text-align:center;color:var(--gray);font-size:13px">Nenhum movimento ainda.</div>';
    return;
  }
  const inicio=_histProdPag*_HIST_POR_PAG;
  const pagina=todos.slice(inicio,inicio+_HIST_POR_PAG);
  const temAntes=inicio>0, temDepois=inicio+_HIST_POR_PAG<todos.length;
  const filtros=[['todos','Todos'],['entrada','＋ Ent.'],['saida','− Saída'],['ajuste','⚖ Ajuste'],['reserva','🔒']];
  const filtrosHTML=filtros.map(([k,l])=>`<button onclick="_histProdFiltro='${k}';_histProdPag=0;_renderHistProduto()" style="font-size:11px;padding:3px 8px;border-radius:50px;border:1px solid ${_histProdFiltro===k?'var(--c1)':'var(--gray-light)'};background:${_histProdFiltro===k?'var(--c1)':'transparent'};color:${_histProdFiltro===k?'white':'var(--gray)'};cursor:pointer">${l}</button>`).join('');
  const navHTML=temAntes||temDepois?`<div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;font-size:12px;color:var(--gray)"><span>${inicio+1}–${Math.min(inicio+_HIST_POR_PAG,todos.length)} de ${todos.length}</span><div style="display:flex;gap:6px">${temAntes?`<button onclick="_histProdPag--;_renderHistProduto()" style="padding:2px 8px;border:1px solid var(--gray-light);border-radius:4px;cursor:pointer;background:none">←</button>`:''} ${temDepois?`<button onclick="_histProdPag++;_renderHistProduto()" style="padding:2px 8px;border:1px solid var(--gray-light);border-radius:4px;cursor:pointer;background:none">→</button>`:''}</div></div>`:'';
  body.innerHTML=renderHistoricoPreco(produtoId)+`<div style="display:flex;gap:6px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--gray-light);margin-bottom:4px;margin-top:8px">${filtrosHTML}</div>`
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
