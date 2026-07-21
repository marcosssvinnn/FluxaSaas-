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
// que o app é instalável. Decide se mostra o banner, e com qual texto.
function _fluxaAvaliarBannerInstalar(){
  const el = document.getElementById('pwa-install-banner');
  if (!el) return;
  if (fluxaModoStandalone() || _pwaDismissAtivo()){ el.classList.remove('on'); return; }
  const plataforma = fluxaPlataforma();
  if (plataforma === 'desktop') return; // instalar não resolve nada pra quem usa no computador
  if (plataforma === 'android' && !_fluxaInstallEvent) return; // Chrome ainda não liberou o prompt
  const corpo = document.getElementById('pwa-install-body');
  const btn = document.getElementById('pwa-install-btn');
  if (plataforma === 'ios'){
    corpo.innerHTML = 'Toque em <b>⬆️ Compartilhar</b> e depois em <b>"Adicionar à Tela de Início"</b> pra abrir o Fluxa como app, com notificações e tela cheia.';
    btn.style.display = 'none';
  } else {
    corpo.innerHTML = 'Instale o Fluxa como app pra abrir mais rápido, com notificações e tela cheia.';
    btn.style.display = '';
  }
  el.classList.add('on');
}
