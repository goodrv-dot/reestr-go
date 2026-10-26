//@ Частина кабінету «Ядро: стан, допоміжні функції, init()».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
// ============================================================
// Робочий кабінет 200 / 300: справи, етапи супроводу, нагадування, історія
// Етапи й статуси налаштовуються (таблиці case_stage_defs, case_statuses).
// ============================================================
window.Cabinet = (() => {
  const $ = (id) => document.getElementById(id);
  let db = null, me = null, isAdmin = false;
  let module = '200';
  const keep = (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* ок */ } };
  try { module = sessionStorage.getItem('cab_module') || module; } catch { /* ок */ }
  let defs = [], statuses = [], staff = new Map(), cases = [];
  let marks = new Map();        // case_id → [1..5] — особисті мітки адміністратора
  const MARK_COLORS = ['#d64545', '#e8912d', '#e3c13b', '#3f9a5a', '#3b7dd8'];
  const MARK_NAMES = ['червона', 'помаранчева', 'жовта', 'зелена', 'синя'];
  let current = null;           // відкрита справа
  let preset = null;            // вибірка з дашборда: {ids:Set, label}
  let quick = '';               // mine | overdue | problem | fresh | nocell
  let seen = new Map();         // case_id → коли я відкривав справу
  let returnTo = null;          // справа, до якої повернутися після картки реєстру
  const acc = () => window.ACCESS || { admin: isAdmin, registry: true, cab200: true, cab300: true, cells: [] };
  const isNew = (c) => !!c.transferred_at && c.transferred_by !== me && !(seen.get(c.id) >= c.transferred_at);
  // Модулі кабінету: назва, ключова дата (для фільтра періоду й сортування), слово для шапки справи
  const MOD_UI = {
    '200': { title: 'Кабінет 200 — супровід родин загиблих', short: '200', word: 'загиблий', date: 'burial_date', dateWord: 'поховання', reg: 'notice_date', exec: 'виконавець', newTitle: 'Нова справа 200 — загиблий' },
    '300': { title: 'Кабінет 300 — супровід поранених', short: '300', word: 'поранений', date: 'wound_date', dateWord: 'поранення', reg: 'appeal_date', exec: 'відповідальний', newTitle: 'Нова справа 300 — поранений' },
    bzv: { title: 'Зниклі безвісти', short: 'БЗВ', word: 'зниклий безвісти', val: 'missing_date', dateWord: 'зникнення', reg: 'notice_date', exec: 'виконавець', newTitle: 'Нова справа — зниклий безвісти' },
    pol: { title: 'Звільнені з полону', short: 'Звільнені з полону', word: 'звільнений з полону', val: 'release_date', dateWord: 'звільнення', reg: 'release_date', exec: 'відповідальний', newTitle: 'Нова справа — звільнений з полону' },
    vet: { title: 'Ветерани', short: 'Ветерани', word: 'ветеран', date: 'birth_date', dateWord: 'народження', reg: '', exec: 'виконавець', newTitle: 'Нова справа — ветеран' }
  };
  const MODS = Object.keys(MOD_UI);
  const ui = () => MOD_UI[module] || MOD_UI['200'];
  // дата для фільтра періоду: 200 — поховання, 300 — поранення, БЗВ — зникнення, Звільнені з полону — звільнення, Ветерани — народження
  // Стан проблеми (поле «Стан проблеми» у розділі «Проблеми»): Гостра / Незначна підсвічують справу в списку
  const probState = (c) => { const v = (c.vals || {}).problem_state; return v === 'Гостра' || v === 'Незначна' ? v : ''; };
  const hasProblem = (c) => c.status === 'Проблема' || !!probState(c);
  const dateOf = (c) => (ui().val ? (c.vals || {})[ui().val] : c.person[ui().date]) || null;
  const today = () => new Date().toISOString().slice(0, 10);
  const fmt = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '');
  const fio = (p) => [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');
  // Кольори статусів: з бази, з уточненнями; текст темний на світлому тлі
  const STATUS_OVERRIDE = {};   // кольори беруться з налаштувань статусів у базі
  const statusColor = (name, fromDb) => STATUS_OVERRIDE[name] || fromDb || '#8a96a1';
  const inkFor = (hex) => {
    const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#3d2e00' : '#ffffff';
  };
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  function init(client, userId, admin) {
    db = client; me = userId; isAdmin = admin;
    // інший модуль — чистий список: фільтри з 200 (виконавець, статус, мітки, період…) у 300 приховали б усе
    document.querySelectorAll('.cab-mod').forEach((b) => b.addEventListener('click', () => { module = b.dataset.m; preset = null; picked.clear(); withClosed = false; clearFilters(true); load(); }));
    $('cab-preset-clear').addEventListener('click', () => { preset = null; render(); });
    const lb = $('cab-lists-btn'); lb.hidden = !(window.ACCESS && window.ACCESS.lists);
    lb.addEventListener('click', () => { window.__listsFrom = 'cabinet'; document.querySelector('.tab[data-tab="lists"]').click(); });
    try { $('cab-sort').value = localStorage.getItem('cab_sort') || 'new'; } catch { /* без сховища — типовий порядок */ }
    if (!$('cab-sort').value) $('cab-sort').value = 'new';
    try { $('cab-pin').checked = localStorage.getItem('cab_pin') !== '0'; } catch { /* ок */ }
    $('cab-pin').addEventListener('change', () => { try { localStorage.setItem('cab_pin', $('cab-pin').checked ? '1' : '0'); } catch { /* ок */ } render(); });
    $('cab-sort').addEventListener('change', () => { try { localStorage.setItem('cab_sort', $('cab-sort').value); } catch { /* ок */ } render(); });
    ['cab-search', 'cab-status', 'cab-exec', 'cab-resp', 'cab-mark', 'cab-cell', 'cab-region', 'cab-unit', 'cab-from', 'cab-to'].forEach((id) => $(id).addEventListener('input', render));
    $('cab-date-clear').addEventListener('click', () => { $('cab-from').value = ''; $('cab-to').value = ''; render(); });
    document.querySelectorAll('.cab-quick').forEach((b) => b.addEventListener('click', () => { quick = quick === b.dataset.q ? '' : b.dataset.q; render(); }));
    $('cab-back').addEventListener('click', closeCase);
    $('cab-back2').addEventListener('click', closeCase);   // унизу довгої справи (зручно на телефоні)
    $('cab-pager').addEventListener('click', (e) => { const b = e.target.closest('.pg-btn'); if (!b || b.disabled) return; page = Number(b.dataset.page); render(); $('cab-table').scrollIntoView({ block: 'start' }); });
    $('cab-settings-btn').hidden = !isAdmin;
    if (isAdmin) { mirrorStatus(); initBulk(); }   // «Кілька справ» — лише адміністратор
    $('cab-mark-ui').hidden = false; initMarkFilter();   // особисті мітки — у всіх (кожен бачить свої)
    $('cab-settings-btn').addEventListener('click', openSettings);
    $('cab-new-btn').addEventListener('click', openNew);
    $('cab-new-form').addEventListener('submit', submitNew);
    $('cab-new-cancel').addEventListener('click', () => $('cab-new').close());
    $('cab-set-close').addEventListener('click', () => { $('cab-settings').close(); load({ full: true }); });
    window.addEventListener('popstate', () => { if (!$('cab-case').hidden) closeCase(true); });
    // зміни колег підтягуються самі: раз на 3 хв і при поверненні до вкладки (лише змінені справи)
    const auto = () => { if (!document.hidden && !$('cabinet-view').hidden && syncAt) load(); };
    setInterval(auto, 3 * 60 * 1000);
    document.addEventListener('visibilitychange', auto);
    $('cab-case').addEventListener('focusout', () => {
      if (stagesPending) setTimeout(() => { if (stagesPending && !editingInCase()) renderStages(); }, 0);
    });
  }

