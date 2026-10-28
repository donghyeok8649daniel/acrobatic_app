// Cache only this fixed public allowlist. Never cache pages, API responses,
// private videos, credentials, or anything fetched after a team logs in.
const CACHE = 'acrobatic-public-v1';
const PUBLIC = ['/offline', '/favicon.svg', '/icons/app-192.png', '/icons/app-512.png', '/icons/maskable-512.png', '/icons/apple-touch-180.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('acrobatic-public-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/offline')) || Response.error()));
  } else if (PUBLIC.includes(url.pathname) && !url.search) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});

self.addEventListener('push', event => {
  let data={};try{data=event.data?.json()||{};}catch{}
  let url=new URL('/',self.location.origin);try{const target=new URL(data.url||'/',self.location.origin);if(target.origin===self.location.origin)url=target;}catch{}
  event.waitUntil(self.registration.showNotification(String(data.title||'Acrobatic'),{body:String(data.body||''),icon:'/icons/app-192.png',badge:'/icons/app-192.png',tag:String(data.tag||'club-update'),data:{url:url.href}}));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();let url=new URL('/',self.location.origin);try{const target=new URL(event.notification.data?.url||'/',self.location.origin);if(target.origin===self.location.origin)url=target;}catch{}
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const existing=clients.find(client=>new URL(client.url).origin===self.location.origin);if(existing){await existing.navigate(url.href);return existing.focus();}return self.clients.openWindow(url.href);}));
});
