// Перемикання вкладок + системна кнопка «Назад» (історія браузера)
const VIEWS = { registry: 'registry-view', dashboard: 'dashboard-view', import: 'import-view', staff: 'staff-view', manual: 'manual-view' };

function showTab(tab) {
  document.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  Object.entries(VIEWS).forEach(([k, id]) => { document.getElementById(id).hidden = k !== tab; });
  if (tab === 'dashboard') Dashboard.refresh();
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
  const st = e.state || { view: 'tab', tab: 'registry' };
  if (st.view === 'tab') showTab(st.tab || 'registry');
});
