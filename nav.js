// Перемикання вкладок + системна кнопка «Назад» (історія браузера)
const VIEWS = { registry: 'registry-view', cabinet: 'cabinet-view', dashboard: 'dashboard-view', import: 'import-view', staff: 'staff-view', manual: 'manual-view' };

function showTab(tab) {
  document.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  Object.entries(VIEWS).forEach(([k, id]) => { document.getElementById(id).hidden = k !== tab; });
  try { sessionStorage.setItem('last_tab', tab); } catch { /* без сховища — після F5 відкриється типова вкладка */ }
  if (tab === 'dashboard') Dashboard.refresh();
  if (tab === 'cabinet') Cabinet.load();
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    const cur = history.state && history.state.tab;
    if (cur !== tab || (history.state && history.state.view === 'card')) history.pushState({ view: 'tab', tab }, '');
    showTab(tab);
    window.scrollTo(0, 0);
  });
});

history.replaceState({ view: 'tab', tab: 'registry' }, '');
window.addEventListener('popstate', (e) => {
  if (!e.state) return;                       // перехід за якорем (#…) — вкладку не міняємо
  if (e.state.view === 'tab') showTab(e.state.tab || 'registry');
});

// Зміст «Мануалу»: прокрутка до розділу без зміни адреси й історії
document.addEventListener('click', (e) => {
  const a = e.target.closest('#manual-view a[href^="#"]');
  if (!a) return;
  const target = document.getElementById(a.getAttribute('href').slice(1));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  const h = target.querySelector('h2') || target;
  h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
});
