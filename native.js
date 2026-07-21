// ─────────────────────────────────────────────────────────────────────────
// native.js — camada de detecção de "modo app" (PWA instalada na Tela de
// Início) e do prompt de instalação. Sem dependências externas; tudo aqui é
// feature-detection com fallback silencioso — o mesmo princípio que o app.js
// já usa pra dbOk/offline. Nenhuma função aqui é obrigatória pro resto do
// app funcionar; se este arquivo não carregar, o Fluxa continua normal.
// ─────────────────────────────────────────────────────────────────────────

function fluxaModoStandalone(){
  try{
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true; // Safari iOS legado
  }catch(e){ return false; }
}

function fluxaPlataforma(){
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

// Chave GLOBAL (não namespaced por empresa) — é preferência do aparelho, não do tenant.
const LS_PWA_DISMISS = 'fluxa_pwa_prompt_dismiss';
const PWA_SNOOZE_DIAS = 7;

function _pwaDismissAtivo(){
  const t = parseInt(localStorage.getItem(LS_PWA_DISMISS) || '0');
  return t > 0 && (Date.now() - t) < PWA_SNOOZE_DIAS * 24 * 60 * 60 * 1000;
}
function fluxaDispensarInstalar(){
  localStorage.setItem(LS_PWA_DISMISS, String(Date.now()));
  const el = document.getElementById('pwa-install-banner');
  if (el) el.classList.remove('on');
}

// Android/Chrome dispara este evento quando o app é instalável — guardamos
// pra poder abrir o prompt nativo de instalação a partir do nosso próprio botão.
let _fluxaInstallEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _fluxaInstallEvent = e;
  _fluxaAvaliarBannerInstalar();
});
window.addEventListener('appinstalled', () => {
  _fluxaInstallEvent = null;
  const el = document.getElementById('pwa-install-banner');
  if (el) el.classList.remove('on');
});

async function fluxaInstalarAgora(){
  if (!_fluxaInstallEvent) return;
  _fluxaInstallEvent.prompt();
  try{ await _fluxaInstallEvent.userChoice; }catch(e){}
  _fluxaInstallEvent = null;
}

// Chamado no boot (após login) e de novo quando o Chrome Android sinaliza
// que o app é instalável. Decide o que mostrar: banner de instalar (se ainda
// não instalado) OU banner de ativar notificações (se já instalado e a
// permissão nunca foi pedida) — nunca os dois ao mesmo tempo.
async function _fluxaAvaliarBannerInstalar(){
  const el = document.getElementById('pwa-install-banner');
  if (!el) return;

  if (!fluxaModoStandalone()){
    if (_pwaDismissAtivo()){ el.classList.remove('on'); return; }
    const plataforma = fluxaPlataforma();
    if (plataforma === 'desktop'){ el.classList.remove('on'); return; }
    if (plataforma === 'android' && !_fluxaInstallEvent){ el.classList.remove('on'); return; }
    const corpo = document.getElementById('pwa-install-body');
    const btn = document.getElementById('pwa-install-btn');
    if (plataforma === 'ios'){
      corpo.innerHTML = 'Toque em <b>⬆️ Compartilhar</b> e depois em <b>"Adicionar à Tela de Início"</b> pra abrir o Fluxa como app, com notificações e tela cheia.';
      btn.style.display = 'none';
      btn.onclick = null;
    } else {
      corpo.innerHTML = 'Instale o Fluxa como app pra abrir mais rápido, com notificações e tela cheia.';
      btn.style.display = '';
      btn.textContent = 'Instalar';
      btn.onclick = fluxaInstalarAgora;
    }
    el.classList.add('on');
    return;
  }

  // Já instalado — 3 estados possíveis, nunca dois ao mesmo tempo:
  // 1) notificação nunca pedida  2) biometria disponível e não ativada  3) nada a oferecer
  if ('Notification' in window){
    if (Notification.permission === 'granted'){ fluxaInscreverPush(); }
    else if (Notification.permission !== 'denied' && !_pwaDismissAtivo()){
      const corpo = document.getElementById('pwa-install-body');
      const btn = document.getElementById('pwa-install-btn');
      corpo.innerHTML = 'Ative as notificações pra saber na hora quando um cliente aprovar um orçamento, sem precisar abrir o app.';
      btn.style.display = '';
      btn.textContent = 'Ativar';
      btn.onclick = fluxaAtivarNotificacoes;
      el.classList.add('on');
      return;
    }
  }

  if (typeof authUser !== 'undefined' && authUser && !fluxaTemCredencialBiometrica(authUser.id) && !_pwaDismissAtivo()){
    const disponivel = await fluxaBiometriaDisponivel();
    if (disponivel){
      const corpo = document.getElementById('pwa-install-body');
      const btn = document.getElementById('pwa-install-btn');
      corpo.innerHTML = 'Ative o desbloqueio por Face ID/digital pra abrir o Fluxa mais rápido — e mais seguro se alguém pegar seu aparelho.';
      btn.style.display = '';
      btn.textContent = 'Ativar';
      btn.onclick = async () => {
        const ok = await fluxaAtivarBiometria();
        if (ok){ const b = document.getElementById('pwa-install-banner'); if (b) b.classList.remove('on'); }
      };
      el.classList.add('on');
      return;
    }
  }

  el.classList.remove('on');
}

function _urlBase64ParaUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

// Chave pública VAPID — segura pra ficar no cliente (é a metade pública do
// par; a privada mora só na Edge Function, nunca sai do servidor).
const FLUXA_VAPID_PUBLIC_KEY = 'BKJvzSs_K3IuPIyybiqQO2zWHWmWBa2GD58PiuYSiovp2pKaXKG2diFHq0YYWvqLy_WNug28jJLsfbYF8V-RYxg';

async function fluxaAtivarNotificacoes(){
  try{
    const perm = await Notification.requestPermission();
    const el = document.getElementById('pwa-install-banner');
    if (el) el.classList.remove('on');
    if (perm === 'granted') await fluxaInscreverPush();
  }catch(e){ console.warn('[push] permissão', e?.message||e); }
}

// ─────────────────────────────────────────────────────────────────────────
// Desbloqueio biométrico (Sprint 2, opt-in) — WebAuthn (Face ID/Touch ID/
// impressão digital via autenticador de plataforma do próprio aparelho).
//
// O que isso NÃO é: não é uma segunda camada de autenticação server-side —
// a sessão de conta (Supabase Auth) já é o que prova quem é o usuário pro
// banco, e ela já sobrevive fechar o app (persistida pelo próprio SDK).
// Isso é só um GATE de conveniência/segurança física: sem ele, qualquer
// pessoa que pegasse o aparelho destravado abriria o Fluxa direto, sem
// nenhum checkpoint. Por isso a credencial fica guardada localmente
// (localStorage, por aparelho) e a verificação nunca sai do navegador —
// não precisa de round-trip com o servidor pra este caso de uso.
// ─────────────────────────────────────────────────────────────────────────

function _bufParaB64url(buf){
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function _b64urlParaBuf(str){
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function fluxaBiometriaDisponivel(){
  if (!window.PublicKeyCredential || !navigator.credentials) return false;
  try{ return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch(e){ return false; }
}
function fluxaTemCredencialBiometrica(userId){
  return !!userId && localStorage.getItem('fluxa_webauthn_user') === userId && !!localStorage.getItem('fluxa_webauthn_cred');
}

// Registro — chamado a partir do banner (Sprint 0/1 reaproveitado, 3º estado).
async function fluxaAtivarBiometria(){
  if (typeof authUser === 'undefined' || !authUser) return false;
  try{
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Fluxa' },
        user: {
          id: new TextEncoder().encode(authUser.id),
          name: authUser.email || (typeof getSessao === 'function' ? getSessao()?.nome : '') || 'usuario',
          displayName: (typeof getSessao === 'function' ? getSessao()?.nome : '') || 'Usuário Fluxa',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'required' },
        timeout: 60000,
      },
    });
    if (!cred) return false;
    localStorage.setItem('fluxa_webauthn_cred', _bufParaB64url(cred.rawId));
    localStorage.setItem('fluxa_webauthn_user', authUser.id);
    return true;
  }catch(e){ console.warn('[webauthn] ativar', e?.message||e); return false; }
}

// Verificação — usada na tela de bloqueio, antes do boot continuar.
async function fluxaVerificarBiometria(){
  const credId = localStorage.getItem('fluxa_webauthn_cred');
  if (!credId) return true; // sem credencial registrada: sem gate, nada a verificar
  try{
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: _b64urlParaBuf(credId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!assertion;
  }catch(e){ console.warn('[webauthn] verificar', e?.message||e); return false; }
}

function mostrarTelaBloqueioBiometrico(){
  const el = document.getElementById('biometric-lock-overlay');
  if (el) el.style.display = 'flex';
}
async function fluxaDesbloquearBiometria(){
  const status = document.getElementById('biometric-lock-status');
  if (status) status.textContent = 'Verificando…';
  const ok = await fluxaVerificarBiometria();
  if (ok){
    sessionStorage.setItem('fluxa_webauthn_ok', '1');
    location.reload();
  } else if (status){
    status.textContent = 'Não foi possível verificar. Tente de novo.';
  }
}
// Escape hatch: biometria falhando/indisponível — sai da conta e volta pra
// tela de login normal (e-mail/senha ou nome+PIN), sem meio-termo confuso.
function fluxaUsarOutroLogin(){
  localStorage.removeItem('fluxa_webauthn_cred');
  localStorage.removeItem('fluxa_webauthn_user');
  if (typeof authLogout === 'function') authLogout();
  else location.reload();
}

// Registra (ou reaproveita) a inscrição de push do navegador e salva no banco.
// Idempotente: se já existe uma linha com esse endpoint, só reativa; nunca duplica.
async function fluxaInscreverPush(){
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (typeof db === 'undefined' || !db || typeof authUser === 'undefined' || !authUser || typeof EMPRESA_ID === 'undefined' || !EMPRESA_ID) return false;
  try{
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ParaUint8Array(FLUXA_VAPID_PUBLIC_KEY),
      });
    }
    const json = sub.toJSON();
    const { data: existente } = await db.from('push_subscriptions').select('id').eq('endpoint', json.endpoint).maybeSingle();
    if (existente){
      await db.from('push_subscriptions').update({ ativo: true }).eq('id', existente.id);
    } else if (typeof dbInsert === 'function'){
      await dbInsert('push_subscriptions', {
        id: 'push_' + Date.now(),
        user_id: authUser.id,
        usuario_nome: (typeof getSessao === 'function' ? getSessao()?.nome : '') || '',
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth_key: json.keys.auth,
        user_agent: navigator.userAgent,
        ativo: true,
      });
    }
    return true;
  }catch(e){ console.warn('[push] inscrever', e?.message||e); return false; }
}

// ─────────────────────────────────────────────────────────────────────────
// Central de Notificações (Sprint 4) — histórico das notificações push
// recebidas, mesmo as que chegaram com o app fechado. O Service Worker
// escreve direto no IndexedDB (não tem window lá); esta camada só lê/marca
// como lida — mesmo banco (fluxa-notificacoes), mesmo object store.
// IndexedDB (não localStorage) porque é o único armazenamento que um
// Service Worker acessa de forma confiável sem uma página aberta.
// ─────────────────────────────────────────────────────────────────────────

const FLUXA_NOTIF_DB = 'fluxa-notificacoes';
function _abrirNotifDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FLUXA_NOTIF_DB, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains('notificacoes')){
        idb.createObjectStore('notificacoes', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fluxaListarNotificacoes(limite){
  limite = limite || 30;
  try{
    const idb = await _abrirNotifDB();
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction('notificacoes', 'readonly');
      const req = tx.objectStore('notificacoes').getAll();
      req.onsuccess = () => {
        const todas = (req.result || []).sort((a, b) => b.recebidaEm - a.recebidaEm);
        resolve(todas.slice(0, limite));
      };
      req.onerror = () => reject(req.error);
    });
  }catch(e){ console.warn('[notif] listar', e?.message||e); return []; }
}

async function fluxaMarcarNotificacoesLidas(){
  try{
    const idb = await _abrirNotifDB();
    await new Promise((resolve) => {
      const tx = idb.transaction('notificacoes', 'readwrite');
      const req = tx.objectStore('notificacoes').openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor){
          const v = cursor.value;
          if (!v.lida){ v.lida = true; cursor.update(v); }
          cursor.continue();
        } else resolve();
      };
      req.onerror = () => resolve();
    });
  }catch(e){ console.warn('[notif] marcar lidas', e?.message||e); }
}

async function _fluxaAtualizarBadgeNotif(){
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const lista = await fluxaListarNotificacoes(50);
  const naoLidas = lista.filter((n) => !n.lida).length;
  badge.textContent = naoLidas > 9 ? '9+' : String(naoLidas);
  badge.style.display = naoLidas > 0 ? 'flex' : 'none';
}

function _fluxaTempoRelativo(ts){
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

async function renderNotificacoes(){
  const el = document.getElementById('notif-lista');
  if (!el) return;
  const lista = await fluxaListarNotificacoes(30);
  el.innerHTML = lista.length
    ? lista.map((n) => `
      <button class="notif-item${n.lida ? '' : ' nao-lida'}" onclick="_fluxaAbrirNotif(${n.id})">
        <div class="notif-item-titulo">${esc(n.title || 'Fluxa')}</div>
        <div class="notif-item-corpo">${esc(n.body || '')}</div>
        <div class="notif-item-tempo">${_fluxaTempoRelativo(n.recebidaEm)}</div>
      </button>`).join('')
    : '<div class="notif-vazio">Nenhuma notificação ainda</div>';
  _fluxaAtualizarBadgeNotif();
}

async function _fluxaAbrirNotif(id){
  try{
    const idb = await _abrirNotifDB();
    const tx = idb.transaction('notificacoes', 'readwrite');
    const store = tx.objectStore('notificacoes');
    const n = await new Promise((resolve) => { const r = store.get(id); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null); });
    if (n && !n.lida){ n.lida = true; store.put(n); }
    // O "url" da notificação é sempre uma página interna (ex.: "/#history"),
    // nunca uma rota de servidor de verdade — o app é 100% client-side. Extrai
    // o nome da página e navega com go() (mesma função que a sidebar usa,
    // já cuida de permissão por perfil) em vez de só trocar o hash — o hash
    // sozinho não dispara navegação nenhuma pras páginas internas do app,
    // só pras rotas públicas especiais (#portal, #eq, #termos...).
    if (n && n.url){
      const alvo = (n.url.includes('#') ? n.url.split('#').pop() : n.url.replace(/^\//, '')).trim();
      const rotasPublicas = ['portal', 'eq', 'termos', 'privacidade', 'recuperar'];
      if (alvo && rotasPublicas.some((p) => alvo.startsWith(p))) location.hash = alvo;
      else if (alvo && typeof go === 'function') { try{ go(alvo); }catch(err){ console.warn('[notif] go', err?.message||err); } }
    }
  }catch(e){ console.warn('[notif] abrir', e?.message||e); }
  toggleNotificacoes(false);
  renderNotificacoes();
}

function closeNotificacoes(){ const m = document.getElementById('notif-menu'); if (m) m.style.display = 'none'; }
document.addEventListener('click', (e) => { if (!e.target.closest('#notif-wrap')) closeNotificacoes(); });

function toggleNotificacoes(forcar){
  const menu = document.getElementById('notif-menu');
  if (!menu) return;
  const abrir = forcar !== undefined ? forcar : menu.style.display === 'none';
  if (abrir && typeof closeGear === 'function') closeGear();
  menu.style.display = abrir ? 'block' : 'none';
  if (abrir) renderNotificacoes();
}

// Recebe o aviso do Service Worker (postMessage) de que uma notificação nova
// chegou — atualiza o badge na hora, sem esperar o próximo boot/foco de aba.
if (typeof navigator !== 'undefined' && navigator.serviceWorker){
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'FLUXA_NOTIF_NOVA') _fluxaAtualizarBadgeNotif();
  });
}
