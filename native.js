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
function _fluxaAvaliarBannerInstalar(){
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

  // Já instalado — se a permissão de notificação nunca foi pedida, oferece ativar.
  // Se já foi concedida antes (ex.: reinstalou o app), garante a inscrição sem perguntar de novo.
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted'){ fluxaInscreverPush(); return; }
  if (Notification.permission === 'denied') return; // respeitou a negativa, não insiste
  if (_pwaDismissAtivo()) return;

  const corpo = document.getElementById('pwa-install-body');
  const btn = document.getElementById('pwa-install-btn');
  corpo.innerHTML = 'Ative as notificações pra saber na hora quando um cliente aprovar um orçamento, sem precisar abrir o app.';
  btn.style.display = '';
  btn.textContent = 'Ativar';
  btn.onclick = fluxaAtivarNotificacoes;
  el.classList.add('on');
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
