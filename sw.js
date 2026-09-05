// Altere este número a cada novo deploy para forçar atualização em todos os dispositivos
// (não é mais obrigatório: o index.html detecta novas versões sozinho via ETag/Last-Modified)
const CACHE = 'fluxa-v59';

const URLS = [
  'libs/supabase.min.js',
  'libs/emailjs.min.js',
  'libs/html2pdf.bundle.min.js',
  'libs/chart.umd.min.js',
  'native.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(URLS).catch(() => {}))
  );
  self.skipWaiting(); // assume controle imediatamente
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => {
        // Avisa todas as abas abertas que há nova versão
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(clients => {
            clients.forEach(c => c.postMessage({ type: 'NEW_VERSION' }));
          });
      })
  );
  self.clients.claim(); // assume controle de todas as abas
});

self.addEventListener('fetch', e => {
  // Supabase API: sempre usa a rede, nunca cacheia
  if (e.request.url.includes('supabase.co')) return;

  const url = new URL(e.request.url);

  // index.html, app.js e styles.css: network-first para garantir a versão mais
  // recente a cada deploy (o app é único e precisa estar sempre em sincronia).
  // Se offline, usa o cache como fallback.
  if (url.pathname === '/' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')
      || url.pathname.endsWith('/app.js') || url.pathname.endsWith('/styles.css')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Demais recursos: cache-first com atualização em background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// ── Web Push (Sprint 1 do plano mobile) ──
// Payload enviado pela Edge Function enviar-push: { title, body, url }.

// Grava no mesmo IndexedDB que a Central de Notificações (native.js) lê —
// é a única forma confiável de persistir algo aqui: o Service Worker pode
// rodar sem nenhuma aba do Fluxa aberta, então localStorage/página não servem.
function _swSalvarNotificacao(data){
  return new Promise(resolve => {
    const req = indexedDB.open('fluxa-notificacoes', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('notificacoes')) db.createObjectStore('notificacoes', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('notificacoes', 'readwrite');
      tx.objectStore('notificacoes').add({ title: data.title, body: data.body, url: data.url, recebidaEm: Date.now(), lida: false });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

self.addEventListener('push', e => {
  let data = { title: 'Fluxa', body: 'Você tem uma notificação nova.', url: '/' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (err) {}
  e.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        data: { url: data.url || '/' },
      }),
      _swSalvarNotificacao(data),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
        clientsArr.forEach(c => c.postMessage({ type: 'FLUXA_NOTIF_NOVA' }));
      }),
    ])
  );
});

// Clique na notificação: foca uma aba já aberta do Fluxa, ou abre uma nova.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      const existente = clientsArr.find(c => 'focus' in c);
      if (existente) { existente.navigate(url).catch(() => {}); return existente.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
