// ============================================================
// Завантажувач скриптів (ES5). Сучасні браузери отримують звичайні файли,
// старіші iPhone / Safari (до iOS 14) — версії з папки legacy/ (той самий код, переписаний старим синтаксисом).
// Якщо немає вікон <dialog> (Safari до 15.4) — підключається заміна вікон.
// Перевірити старий режим у будь-якому браузері: додати до адреси ?legacy=1
// ============================================================
(function () {
  var me = document.currentScript || document.querySelector('script[src*="boot.js"]');
  var m = me && me.src.match(/[?&]v=(\d+)/); var V = m ? m[1] : '';
  var force = /[?&]legacy=1/.test(location.search);
  var modern = !force;
  // eval заборонено політикою безпеки сайту (CSP), тож синтаксис не перевіряємо напряму:
  // Promise.any з’явився в тих самих версіях браузерів, що й «??=» (Safari 14, Chrome 85, Firefox 79) — найновіше, що є в коді
  if (modern && typeof Promise.any !== 'function') modern = false;
  var needDialog = force || typeof HTMLDialogElement !== 'function' || !('showModal' in document.createElement('dialog'));
  window.__legacy = !modern;

  var APP = ['config.js', 'options.js', 'ui.js', 'validation.js', 'filters.js', 'segments.js', 'picker.js', 'merge.js', 'persons.js',
    'export.js', 'import.js', 'mfa.js', 'staff.js', 'ua-map.js', 'dashboard.js', 'cabinet.js', 'lists.js', 'presence.js',
    'feedback.js', 'nav.js', 'app.js'];
  var list = ['polyfills.js'];
  if (needDialog) list.push('vendor/dialog-polyfill-0.5.6.js');
  list.push(modern ? 'vendor/supabase-2.117.3.js' : 'legacy/vendor/supabase-2.117.3.js');
  list.push('vendor/xlsx-0.18.5.full.min.js');
  APP.forEach(function (f) { list.push(modern ? f : 'legacy/' + f); });

  if (needDialog) {
    // стилі заміни — перед нашими, щоб наш вигляд вікон мав перевагу
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'vendor/dialog-polyfill-0.5.6.css';
    var first = document.querySelector('link[rel="stylesheet"]'); first.parentNode.insertBefore(css, first);
  }
  // document.write — скрипти виконуються по черзі ще під час розбору сторінки (як звичайні <script>),
  // тож DOMContentLoaded і load працюють як раніше
  var html = '';
  list.forEach(function (f) { html += '<script src="' + f + (/^vendor\//.test(f) ? '' : '?v=' + V) + '"><\/script>'; });
  if (needDialog) html += '<script src="dialog-init.js?v=' + V + '"><\/script>';
  document.write(html);
})();
