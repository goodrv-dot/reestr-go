// Мінімальний service worker: нічого не кешує (сайт завжди свіжий),
// потрібен телефонам для числа на значку програми та майбутніх push-сповіщень.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
// натиск на системне сповіщення — відкрити (або підняти) реєстр
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = all.find((c) => c.url.startsWith(self.registration.scope));
    if (w) return w.focus();
    return self.clients.openWindow(self.registration.scope);
  })());
});
