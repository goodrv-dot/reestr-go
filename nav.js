// Перемикання вкладок «Особи» / «Імпорт» / «Мануал»
const VIEWS = { registry: 'registry-view', import: 'import-view', manual: 'manual-view' };
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-current', b === btn ? 'page' : 'false');
    });
    Object.entries(VIEWS).forEach(([k, id]) => { document.getElementById(id).hidden = k !== tab; });
    window.scrollTo(0, 0);
  });
});
