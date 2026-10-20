// Заміна вікон <dialog> для Safari до 15.4 (ES5): реєструємо всі вікна сторінки й ті, що з’являться пізніше.
(function () {
  if (!window.dialogPolyfill) return;
  function reg() {
    Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (d) {
      if (d.__dp) return; d.__dp = 1;
      try { window.dialogPolyfill.registerDialog(d); } catch (e) { /* уже зареєстровано */ }
    });
  }
  reg();
  if (window.MutationObserver) new MutationObserver(reg).observe(document.body, { childList: true, subtree: true });
})();
