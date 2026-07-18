// Altere este número a cada novo deploy para forçar atualização em todos os dispositivos
// (não é mais obrigatório: o index.html detecta novas versões sozinho via ETag/Last-Modified)
const CACHE = 'fluxa-v23';

const URLS = [
  'libs/supabase.min.js',
  'libs/emailjs.min.js',
  'libs/html2pdf.bundle.min.js',
  'libs/chart.umd.min.js',
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
