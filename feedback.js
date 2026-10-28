// ============================================================
// «Чат / Задачі» — розмови між співробітниками: одному, кільком, усім або адміністраторам
// (пропозиції щодо програми). У кожного одержувача свій статус задачі; під повідомленням — переписка.
// Нове видно на значку 💬 і в дзвіночку. API для кабінету: init, counts, open, refreshDot.
// ============================================================
window.Feedback = (() => {
  // Текст повідомлення з активними посиланнями: https://… і www.… відкриваються в новій вкладці
  function linkify(el, text) {
    el.textContent = '';
    const re = /\b(https?:\/\/[^\s<>"«»]+|www\.[^\s<>"«»]+)/gi; let last = 0, m;
    const s = String(text || '');
    while ((m = re.exec(s))) {
      let url = m[0]; const trail = url.match(/[.,;:!?)\]]+$/); if (trail) url = url.slice(0, -trail[0].length);
      if (m.index > last) el.append(s.slice(last, m.index));
      const href = /^www\./i.test(url) ? 'https://' + url : url;
      let ok = false; try { ok = /^https?:$/.test(new URL(href).protocol); } catch { ok = false; }
      if (ok) { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = url; a.className = 'fb-link'; el.append(a); }
      else el.append(url);
      last = m.index + url.length; re.lastIndex = last;
    }
    if (last < s.length) el.append(s.slice(last));
  }
  const $ = (id) => document.getElementById(id);
  const STATUSES = ['Нове', 'В роботі', 'Зроблено', 'Відхилено'];
  const ST_CLS = { 'Нове': 'fb-st-new', 'В роботі': 'fb-st-work', 'Зроблено': 'fb-st-done', 'Відхилено': 'fb-st-no' };
  let db = null, me = null, isAdmin = false, wired = false;
  let threads = [], members = new Map(), ops = [], current = null, timer = null;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (t) => new Date(t).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const toast = (t) => Persons.toast(t);

  function init(client, userId, admin) {
    db = client; me = userId; isAdmin = admin;
    if (wired) return; wired = true;
    $('fb-btn').hidden = false;
    $('fb-btn').addEventListener('click', () => open());
    $('fb-close').addEventListener('click', close);
    $('fb-dialog').addEventListener('close', () => { clearInterval(timer); timer = null; });
    $('fb-new').addEventListener('click', showCompose);
    $('fb-compose-cancel').addEventListener('click', showList);
    $('fb-form').addEventListener('submit', send);
    $('fb-filter').addEventListener('change', renderList);
    $('fb-back').addEventListener('click', () => { current = null; showList(); load(); });
    $('fb-reply-form').addEventListener('submit', reply);
    $('fb-my-status').addEventListener('change', setStatus);
    $('fb-delete').addEventListener('click', removeThread);
    $('fb-to-all').addEventListener('change', syncTo);
    $('fb-to-admins').addEventListener('change', syncTo);
    $('fb-to-q').addEventListener('input', renderOps);
    refreshDot();
    setInterval(() => { const b = $('bell-btn'); const idle = window.__lastAct && Date.now() - window.__lastAct > 15 * 60 * 1000; if (!document.hidden && !idle && (!b || b.hidden)) refreshDot(); }, 10 * 60 * 1000);   // з кабінетом це робить дзвіночок
  }

  // для дзвіночка: fresh — нові/непрочитані розмови, replies — мої відкриті задачі (Нове / В роботі)
  async function counts() {
    if (!db) return { fresh: 0, replies: 0 };
    const { data } = await db.rpc('chat_unread');
    return { fresh: (data && data.unread) || 0, replies: 0, todo: (data && data.todo) || 0 };
  }
  async function refreshDot(known) {
    const c = known || await counts().catch(() => ({ fresh: 0, todo: 0 }));
    const dot = $('fb-count'); dot.textContent = c.fresh > 99 ? '99+' : c.fresh; dot.hidden = !c.fresh;
    $('fb-btn').title = 'Чат / Задачі' + (c.fresh ? ` — нового: ${c.fresh}` : '') + (c.todo ? ` · мої відкриті задачі: ${c.todo}` : '');
    return c;
  }

  // ---------- відкриття, перелік ----------
  async function open(threadId) {
    if (!$('fb-dialog').open) $('fb-dialog').showModal();
    $('fb-status').textContent = 'Завантажуємо…';
    await Promise.all([load(), loadOps()]);
    $('fb-status').textContent = '';
    if (threadId) openThread(threadId); else showList();
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden && $('fb-dialog').open) (current ? openThread(current.id, true) : load()); }, 60 * 1000);
  }
  function close() { $('fb-dialog').close(); refreshDot(); if (window.Cabinet && Cabinet.badge) Cabinet.badge(); }
  async function loadOps() {
    if (ops.length) return;
    const { data } = await db.from('operators').select('user_id, full_name, role, active').order('full_name');
    ops = (data || []).filter((o) => o.active);
  }
  async function load() {
    const [t, m] = await Promise.all([
      db.from('chat_threads').select('*').order('last_at', { ascending: false }).limit(300),
      db.from('chat_members').select('thread_id, user_id, status, seen_at, status_at')
    ]);
    if (t.error) { console.error(t.error); $('fb-status').textContent = 'Не вдалося завантажити повідомлення'; return; }
    threads = t.data || [];
    members = new Map();
    (m.data || []).forEach((x) => { const a = members.get(x.thread_id) || []; a.push(x); members.set(x.thread_id, a); });
    if (!current) renderList();
  }
  const mine = (t) => (members.get(t.id) || []).find((x) => x.user_id === me) || {};
  const unread = (t) => { const m = mine(t); return (!m.seen_at || m.seen_at < t.last_at) && (t.last_by || t.author_id) !== me; };
  const recipients = (t) => (members.get(t.id) || []).filter((x) => x.user_id !== t.author_id);
  const opName = (id) => (ops.find((o) => o.user_id === id) || {}).full_name || 'Співробітник';
  const toLabel = (t) => (t.kind === 'idea' ? 'адміністраторам' : t.to_all ? 'усім' : recipients(t).map((x) => opName(x.user_id)).join(', '));

  function showList() {
    $('fb-view-list').hidden = false; $('fb-view-compose').hidden = true; $('fb-view-thread').hidden = true;
    renderList();
  }
  function renderList() {
    const f = $('fb-filter').value;
    const list = threads.filter((t) => {
      const m = mine(t);
      if (f === 'in') return t.author_id !== me;
      if (f === 'out') return t.author_id === me;
      if (f === 'open') return m.status === 'Нове' || m.status === 'В роботі';
      if (f === 'unread') return unread(t);
      return true;
    });
    const box = $('fb-list'); box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<p class="muted">Тут поки порожньо. Натисніть «+ Нове повідомлення».</p>'; return; }
    list.forEach((t) => {
      const m = mine(t); const rs = recipients(t);
      const done = rs.filter((x) => x.status === 'Зроблено').length;
      const a = document.createElement('button'); a.type = 'button';
      a.className = 'fb-item fb-row' + (t.author_id === me ? ' is-mine' : '') + (unread(t) ? ' is-unseen' : '');
      a.innerHTML = `<header><b class="fb-t"></b> <span class="muted fb-meta"></span>${m.status ? `<span class="fb-st ${ST_CLS[m.status] || ''}">${esc(m.status)}</span>` : ''}</header><p class="fb-body"></p>`;
      a.querySelector('.fb-t').textContent = t.title || (t.kind === 'idea' ? 'Пропозиція щодо програми' : 'Повідомлення');
      a.querySelector('.fb-meta').textContent = `${t.author_id === me ? 'ви' : t.author} → ${toLabel(t)} · ${fmt(t.last_at)}` + (t.author_id === me && rs.length > 1 ? ` · виконали ${done} з ${rs.length}` : '');
      a.querySelector('.fb-body').textContent = t.body.length > 220 ? t.body.slice(0, 220) + '…' : t.body;
      a.onclick = () => openThread(t.id);
      box.appendChild(a);
    });
  }

  // ---------- нове повідомлення ----------
  function showCompose() {
    $('fb-view-list').hidden = true; $('fb-view-compose').hidden = false; $('fb-view-thread').hidden = true;
    $('fb-to-all').checked = false; $('fb-to-admins').checked = false; $('fb-to-q').value = ''; $('fb-title-in').value = ''; $('fb-text').value = '';
    picked.clear(); renderOps(); syncTo(); $('fb-to-q').focus();
  }
  const picked = new Set();
  function renderOps() {
    const q = $('fb-to-q').value.trim().toLowerCase();
    const box = $('fb-to-list'); box.innerHTML = '';
    ops.filter((o) => o.user_id !== me && (!q || o.full_name.toLowerCase().includes(q))).forEach((o) => {
      const l = document.createElement('label'); l.className = 'check';
      l.innerHTML = '<input type="checkbox"> <span></span>';
      l.firstChild.checked = picked.has(o.user_id); l.lastChild.textContent = o.full_name + (o.role === 'admin' ? ' (адмін)' : '');
      l.firstChild.onchange = () => { l.firstChild.checked ? picked.add(o.user_id) : picked.delete(o.user_id); syncTo(); };
      box.appendChild(l);
    });
  }
  function syncTo() {
    const all = $('fb-to-all').checked, adm = $('fb-to-admins').checked;
    if (all && adm) { $('fb-to-admins').checked = false; return syncTo(); }
    $('fb-to-pick').hidden = all || adm;
    $('fb-to-sum').textContent = adm ? 'Отримають усі адміністратори (пропозиція щодо програми)' : all ? `Отримають усі співробітники (${ops.length - 1})` : picked.size ? `Обрано: ${[...picked].map(opName).join(', ')}` : 'Оберіть, кому надіслати';
  }
  async function send(e) {
    e.preventDefault();
    const body = $('fb-text').value.trim(); if (!body) { $('fb-text').focus(); return; }
    const all = $('fb-to-all').checked, adm = $('fb-to-admins').checked;
    if (!all && !adm && !picked.size) { toast('Оберіть, кому надіслати'); return; }
    const btn = $('fb-send'); btn.disabled = true;
    const { data, error } = await db.rpc('chat_create', { p_title: $('fb-title-in').value.trim() || null, p_body: body, p_to: [...picked], p_all: all, p_kind: adm ? 'idea' : 'task' });
    btn.disabled = false;
    if (error) { console.error(error); toast('Не вдалося надіслати: ' + (error.message || '')); return; }
    toast('Надіслано');
    await load(); openThread(data);
  }

  // ---------- розмова ----------
  async function openThread(id, quiet) {
    let t = threads.find((x) => x.id === id);
    if (!t || quiet) { await load(); t = threads.find((x) => x.id === id); }
    if (!t) { showList(); return; }
    current = t;
    $('fb-view-list').hidden = true; $('fb-view-compose').hidden = true; $('fb-view-thread').hidden = false;
    $('fb-th-title').textContent = t.title || (t.kind === 'idea' ? 'Пропозиція щодо програми' : 'Повідомлення');
    $('fb-th-meta').textContent = `${t.author_id === me ? 'Ви' : t.author} → ${toLabel(t)} · ${fmt(t.created_at)}`;
    linkify($('fb-th-body'), t.body);
    // статуси одержувачів
    const rs = recipients(t); const chips = $('fb-th-members'); chips.innerHTML = '';
    rs.forEach((x) => {
      const s = document.createElement('span'); s.className = 'fb-member';
      s.innerHTML = '<span></span> <span class="fb-st"></span>';
      s.firstChild.textContent = x.user_id === me ? 'Ви' : opName(x.user_id);
      s.lastChild.textContent = x.status || '—'; s.lastChild.classList.add(ST_CLS[x.status] || '');
      if (x.status_at) s.title = 'Статус змінено ' + fmt(x.status_at);
      chips.appendChild(s);
    });
    const m = mine(t);
    $('fb-my-status-wrap').hidden = !m.status;
    if (m.status) $('fb-my-status').value = m.status;
    $('fb-delete').hidden = !(t.author_id === me || isAdmin);
    // переписка
    const { data } = await db.from('chat_messages').select('*').eq('thread_id', t.id).order('created_at');
    const box = $('fb-msgs'); box.innerHTML = '';
    (data || []).forEach((x) => {
      const d = document.createElement('div'); d.className = 'fb-msg' + (x.user_id === me ? ' is-mine' : '');
      d.innerHTML = '<div class="fb-msg-h"><b></b> <span class="muted"></span></div><div class="fb-msg-b"></div>';
      d.querySelector('b').textContent = x.user_id === me ? 'Ви' : (x.author || 'Співробітник');
      d.querySelector('.muted').textContent = fmt(x.created_at);
      linkify(d.querySelector('.fb-msg-b'), x.body);
      box.appendChild(d);
    });
    if (!(data || []).length) box.innerHTML = '<p class="muted">Відповідей ще немає.</p>';
    if (unread(t)) { await db.rpc('chat_seen', { p_thread: t.id }); m.seen_at = new Date().toISOString(); refreshDot(); if (window.Cabinet && Cabinet.badge) Cabinet.badge(); }
  }
  async function reply(e) {
    e.preventDefault(); if (!current) return;
    const ta = $('fb-reply'); const body = ta.value.trim(); if (!body) { ta.focus(); return; }
    const btn = $('fb-reply-send'); btn.disabled = true;
    const { error } = await db.rpc('chat_post', { p_thread: current.id, p_body: body });
    btn.disabled = false;
    if (error) { console.error(error); toast('Не вдалося надіслати'); return; }
    ta.value = ''; openThread(current.id, true);
  }
  async function setStatus() {
    if (!current) return;
    const { error } = await db.rpc('chat_set_status', { p_thread: current.id, p_status: $('fb-my-status').value });
    if (error) { console.error(error); toast('Не вдалося змінити статус'); return; }
    toast('Статус змінено — автор побачить'); openThread(current.id, true); refreshDot();
  }
  async function removeThread() {
    if (!current || !confirm('Видалити цю розмову для всіх учасників?')) return;
    const { error } = await db.from('chat_threads').delete().eq('id', current.id);
    if (error) { console.error(error); toast('Не вдалося видалити'); return; }
    current = null; await load(); showList(); refreshDot();
  }

  return { init, counts, open, refreshDot };
})();
