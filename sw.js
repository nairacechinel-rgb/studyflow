// ===== SERVICE WORKER - STUDYFLOW =====
const CACHE_NAME = 'studyflow-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-regular-400.woff2'
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando arquivos...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[SW] Instalado com sucesso');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.warn('[SW] Erro ao cachear:', err);
      })
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Removendo cache antigo:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Ativado com sucesso');
        return self.clients.claim();
      })
  );
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  // ignora requisições que não sejam GET
  if (event.request.method !== 'GET') return;

  // ignora extensões do Chrome e outros esquemas não http
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // retorna do cache se existir
        if (cachedResponse) {
          return cachedResponse;
        }

        // senão busca na rede e armazena no cache
        return fetch(event.request)
          .then((networkResponse) => {
            // só cacheia respostas válidas
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type === 'opaque'
            ) {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          })
          .catch(() => {
            // se offline e não tem cache, retorna o index.html
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// ===== MESSAGES =====
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'StudyFlow';
  const options = {
    body: data.body || 'Você tem uma notificação',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('./');
      })
  );
});
