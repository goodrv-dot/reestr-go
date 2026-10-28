// ============================================================
// «Нотатки»: дві частини.
//  • Загальні — посилання на сайти й документи та довідник (телефони, служби, інше під рукою).
//    Веде адміністратор, бачать усі співробітники.
//  • Мої — особисті вкладки, посилання й довідник співробітника: бачить і править лише він.
// Дані вантажаться лише при відкритті вкладки. Телефони — текстом з кнопкою «копіювати» (без набору).
// ============================================================
window.Notes = (() => {
  const $ = (id) => document.getElementById(id);
  let db = null, me = null, isAdmin = false, wired = false;
  let part = 'shared', tabs = [], notes = [], tabId = null, editing = null, staffList = null, tabEditing = null;
  const tabPicked = new Set();
  const KIND = { link: '🔗 Посилання', contact: '📞 Довідник', text: '📝 Текст' };
  const safeUrl = (u) => { try { const x = new URL(String(u).trim()); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };
  const toast = (t) => Persons.toast(t);
  const canEdit = () => part === 'mine' || isAdmin;
  function linkify(el, text) {
    el.textContent = ''; const s = String(text || ''); const re = /\b(https?:\/\/[^\s<>"«»]+|www\.[^\s<>"«»]+)/gi; let last = 0, m;
    while ((m = re.exec(s))) {
      let url = m[0]; const tr = url.match(/[.,;:!?)\]]+$/); if (tr) url = url.slice(0, -tr[0].length);
      if (m.index > last) el.append(s.slice(last, m.index));
      const a = document.createElement('a'); a.href = /^www\./i.test(url) ? 'https://' + url : url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = url; a.className = 'fb-link'; el.append(a);
      last = m.index + url.length; re.lastIndex = last;
    }
    if (last < s.length) el.append(s.slice(last));
  }

  function init(client, userId, admin) {
    db = client; me = userId; isAdmin = !!admin;
    if (wired) return; wired = true;
    document.querySelectorAll('.notes-part').forEach((b) => b.addEventListener('click', () => { part = b.dataset.part; tabId = null; load(); }));
    $('notes-q').addEventListener('input', render);
    $('notes-tab-add').addEventListener('click', addTab);
    $('notes-add').addEventListener('click', () => openForm(null));
    $('notes-form').addEventListener('submit', save);
    $('notes-cancel').addEventListener('click', () => $('notes-dialog').close());
    $('notes-kind').addEventListener('change', syncKind);
    $('notes-tab-form').addEventListener('submit', saveTabDialog);
    $('notes-tab-cancel').addEventListener('click', () => $('notes-tab-dialog').close());
    document.querySelectorAll('input[name="notes-aud"]').forEach((r) => r.addEventListener('change', syncAud));
    $('notes-aud-q').addEventListener('input', renderStaffPick);
  }

  async function load() {
    document.querySelectorAll('.notes-part').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.part === part)));
    $('notes-lead').textContent = part === 'shared'
      ? (isAdmin ? 'Загальні нотатки ведете лише ви (адміністратор). Для кожної вкладки можна обрати, хто її бачить: усі співробітники або лише обрані (позначка 👥).' : 'Посилання й довідник від адміністратора. Змінює їх лише адміністратор.')
      : 'Ваші особисті вкладки: посилання, телефони, нагадування. Бачите й правите лише ви.';
    $('notes-status').textContent = 'Завантажуємо…';
    const shared = part === 'shared';
    let tq = db.from('note_tabs').select('id, name, sort, shared, user_id, audience').eq('shared', shared).order('sort').order('id');
    if (!shared) tq = tq.eq('user_id', me);
    const t = await tq;
    if (t.error) { console.error(t.error); $('notes-status').textContent = 'Не вдалося завантажити нотатки'; return; }
    tabs = t.data || [];
    let nq = db.from('notes').select('id, tab_id, kind, title, url, phone, body, sort, updated_at').eq('shared', shared).order('sort').order('id');
    if (!shared) nq = nq.eq('user_id', me);
    const n = await nq;
    if (n.error) { console.error(n.error); $('notes-status').textContent = 'Не вдалося завантажити нотатки'; return; }
    notes = n.data || [];
    if (!tabs.some((x) => x.id === tabId)) tabId = tabs[0] ? tabs[0].id : null;
    $('notes-status').textContent = '';
    render();
  }

  function render() {
    const q = $('notes-q').value.trim().toLowerCase();
    $('notes-tab-add').hidden = !canEdit();
    $('notes-add').hidden = !canEdit() || !tabs.length;
    // вкладки
    const bar = $('notes-tabs'); bar.innerHTML = '';
    tabs.forEach((t) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'qchip';
      b.setAttribute('aria-pressed', String(!q && t.id === tabId));
      const cnt = notes.filter((x) => x.tab_id === t.id).length;
      b.innerHTML = '<span></span> <b></b>'; b.firstChild.textContent = t.name; b.lastChild.textContent = cnt;
      if (t.shared && Array.isArray(t.audience)) {   // вкладка лише для обраних
        const who = t.audience.map((id) => (staffList && staffList.find((s) => s.user_id === id) || {}).full_name || Persons.ctx().staff.get(id) || '…');
        const a = document.createElement('span'); a.className = 'notes-aud'; a.textContent = ' 👥' + t.audience.length; b.insertBefore(a, b.lastChild);
        b.title = 'Бачать лише: ' + who.join(', ') + (isAdmin ? ' (і адміністратори)' : '');
      }
      b.onclick = () => { tabId = t.id; $('notes-q').value = ''; render(); };
      bar.appendChild(b);
    });
    const tab = tabs.find((x) => x.id === tabId);
    $('notes-tab-tools').hidden = !(canEdit() && tab && !q);
    if (tab && canEdit()) {
      $('notes-tab-rename').onclick = () => renameTab(tab);
      $('notes-tab-del').onclick = () => removeTab(tab);
      $('notes-tab-left').onclick = () => moveTab(tab, -1);
      $('notes-tab-right').onclick = () => moveTab(tab, 1);
    }
    // записи: пошук — по всіх вкладках цієї частини
    const list = q
      ? notes.filter((x) => [x.title, x.url, x.phone, x.body].some((v) => String(v || '').toLowerCase().includes(q)))
      : notes.filter((x) => x.tab_id === tabId);
    const box = $('notes-list'); box.innerHTML = '';
    if (!tabs.length) {
      box.innerHTML = canEdit() ? '<p class="muted">Вкладок ще немає. Натисніть «+ Вкладка» — напр., «Документи», «Сайти», «Телефони служб».</p>'
        : '<p class="muted">Адміністратор ще нічого не додав.</p>';
      return;
    }
    if (!list.length) { box.innerHTML = `<p class="muted">${q ? 'Нічого не знайдено.' : 'У цій вкладці порожньо.' + (canEdit() ? ' Натисніть «+ Запис».' : '')}</p>`; return; }
    list.forEach((x, i) => box.appendChild(card(x, q, i, list)));
  }

  function card(x, q, i, list) {
    const d = document.createElement('div'); d.className = 'note-card note-' + x.kind;
    const h = document.createElement('div'); h.className = 'note-h';
    const t = document.createElement('b'); t.className = 'note-title';
    const url = x.kind === 'link' ? safeUrl(x.url) : null;
    if (url) { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = x.title; t.append(a); }
    else t.textContent = x.title;
    h.append(t);
    if (q) { const tb = tabs.find((y) => y.id === x.tab_id); if (tb) { const s = document.createElement('span'); s.className = 'muted note-in'; s.textContent = '· ' + tb.name; h.append(s); } }
    if (canEdit()) {
      const tools = document.createElement('span'); tools.className = 'note-tools';
      const mk = (txt, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-link'; b.textContent = txt; b.title = title; b.onclick = fn; tools.append(b); };
      if (!q && i > 0) mk('↑', 'Вище', () => moveNote(x, list, -1));
      if (!q && i < list.length - 1) mk('↓', 'Нижче', () => moveNote(x, list, 1));
      mk('✎', 'Змінити', () => openForm(x));
      mk('✕', 'Видалити', () => removeNote(x));
      h.append(tools);
    }
    d.append(h);
    if (x.kind === 'contact' && x.phone) {
      const p = document.createElement('div'); p.className = 'note-phone';
      const s = document.createElement('span'); s.textContent = x.phone; p.append(s);
      const c = document.createElement('button'); c.type = 'button'; c.className = 'btn-link'; c.textContent = 'копіювати'; c.title = 'Скопіювати номер';
      c.onclick = async () => { try { await navigator.clipboard.writeText(x.phone); toast('Скопійовано'); } catch { toast('Не вдалося скопіювати — виділіть номер вручну'); } };
      p.append(V.callLinks(x.phone), ' ', c); d.append(p);
    }
    if (x.kind === 'link' && x.url && !url) { const w = document.createElement('div'); w.className = 'muted'; w.textContent = 'Посилання некоректне — змініть запис'; d.append(w); }
    if (x.body) { const b = document.createElement('div'); b.className = 'note-body'; linkify(b, x.body); d.append(b); }
    return d;
  }

  // ---------- вкладки ----------
  async function addTab() {
    if (part === 'shared') return openTabDialog(null);
    const name = (prompt('Назва вкладки (напр., «Документи», «Телефони служб»):') || '').trim().slice(0, 60);
    if (!name) return;
    const { data, error } = await db.from('note_tabs').insert({ shared: part === 'shared', name, sort: tabs.length }).select('id').single();
    if (error) { console.error(error); toast('Не вдалося додати вкладку'); return; }
    tabId = data.id; load();
  }
  async function renameTab(t) {
    if (t.shared) return openTabDialog(t);
    const name = (prompt('Нова назва вкладки:', t.name) || '').trim().slice(0, 60);
    if (!name || name === t.name) return;
    const { error } = await db.from('note_tabs').update({ name }).eq('id', t.id);
    if (error) { console.error(error); toast('Не вдалося перейменувати'); return; }
    load();
  }
  async function removeTab(t) {
    const n = notes.filter((x) => x.tab_id === t.id).length;
    if (!confirm(`Видалити вкладку «${t.name}»${n ? ` разом із записами (${n})` : ''}?`)) return;
    const { error } = await db.from('note_tabs').delete().eq('id', t.id);
    if (error) { console.error(error); toast('Не вдалося видалити'); return; }
    tabId = null; load();
  }
  async function moveTab(t, dir) {
    const i = tabs.indexOf(t), j = i + dir; if (j < 0 || j >= tabs.length) return;
    const a = tabs[i], b = tabs[j];
    await Promise.all([db.from('note_tabs').update({ sort: j }).eq('id', a.id), db.from('note_tabs').update({ sort: i }).eq('id', b.id)]);
    load();
  }

  // ---------- загальна вкладка: назва і хто бачить ----------
  async function openTabDialog(t) {
    tabEditing = t;
    if (!staffList) {
      const { data, error } = await db.from('operators').select('user_id, full_name, role').eq('active', true).order('full_name');
      if (error) { console.error(error); toast('Не вдалося завантажити співробітників'); return; }
      staffList = data || [];
    }
    $('notes-tab-dlg-title').textContent = t ? 'Змінити вкладку' : 'Нова загальна вкладка';
    $('notes-tab-name').value = t ? t.name : '';
    tabPicked.clear(); ((t && t.audience) || []).forEach((id) => tabPicked.add(id));
    document.querySelector(`input[name="notes-aud"][value="${t && Array.isArray(t.audience) ? 'some' : 'all'}"]`).checked = true;
    $('notes-aud-q').value = ''; $('notes-tab-err').hidden = true;
    syncAud(); renderStaffPick();
    $('notes-tab-dialog').showModal(); $('notes-tab-name').focus();
  }
  function syncAud() {
    const some = document.querySelector('input[name="notes-aud"]:checked').value === 'some';
    $('notes-aud-pick').hidden = !some;
    $('notes-aud-sum').textContent = some ? (tabPicked.size ? `Обрано: ${tabPicked.size} — ${[...tabPicked].map((id) => (staffList.find((s) => s.user_id === id) || {}).full_name || '—').join(', ')}` : 'Оберіть, хто бачитиме вкладку') : 'Вкладку бачать усі співробітники';
  }
  function renderStaffPick() {
    const q = $('notes-aud-q').value.trim().toLowerCase(); const box = $('notes-aud-list'); box.innerHTML = '';
    staffList.filter((s) => s.role !== 'admin' && (!q || String(s.full_name).toLowerCase().includes(q))).forEach((s) => {
      const l = document.createElement('label'); l.className = 'check';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = tabPicked.has(s.user_id);
      cb.onchange = () => { cb.checked ? tabPicked.add(s.user_id) : tabPicked.delete(s.user_id); syncAud(); };
      l.append(cb, ' ' + s.full_name); box.append(l);
    });
  }
  async function saveTabDialog(e) {
    e.preventDefault();
    const name = $('notes-tab-name').value.replace(/\s+/g, ' ').trim().slice(0, 60);
    const some = document.querySelector('input[name="notes-aud"]:checked').value === 'some';
    const err = (t) => { $('notes-tab-err').textContent = t; $('notes-tab-err').hidden = false; };
    if (!name) return err('Вкажіть назву вкладки');
    if (some && !tabPicked.size) return err('Оберіть хоча б одного співробітника або «Усім співробітникам»');
    const rec = { name, audience: some ? [...tabPicked] : null };
    const { data, error } = tabEditing ? await db.from('note_tabs').update(rec).eq('id', tabEditing.id).select('id').single()
      : await db.from('note_tabs').insert({ ...rec, shared: true, sort: tabs.length }).select('id').single();
    if (error) { console.error(error); return err('Не вдалося зберегти'); }
    $('notes-tab-dialog').close(); tabId = data.id; toast(some ? `Вкладку бачать лише обрані (${tabPicked.size}) і адміністратори` : 'Вкладку бачать усі'); load();
  }

  // ---------- записи ----------
  function syncKind() {
    const k = $('notes-kind').value;
    $('notes-url-wrap').hidden = k !== 'link';
    $('notes-phone-wrap').hidden = k !== 'contact';
    $('notes-body-label').textContent = k === 'text' ? 'Текст' : 'Примітка (необов’язково)';
  }
  function openForm(x) {
    editing = x;
    const f = $('notes-form'); f.reset();
    $('notes-dlg-title').textContent = x ? 'Змінити запис' : 'Новий запис';
    const tsel = $('notes-tab-sel'); tsel.innerHTML = '';
    tabs.forEach((t) => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; tsel.append(o); });
    tsel.value = String(x ? x.tab_id : tabId);
    $('notes-kind').value = x ? x.kind : 'link';
    f.title.value = x ? x.title : ''; f.url.value = x ? x.url || '' : ''; f.phone.value = x ? x.phone || '' : ''; f.body.value = x ? x.body || '' : '';
    $('notes-err').hidden = true;
    syncKind(); $('notes-dialog').showModal(); f.title.focus();
  }
  async function save(e) {
    e.preventDefault();
    const f = e.target, kind = $('notes-kind').value, err = $('notes-err');
    const rec = { tab_id: Number($('notes-tab-sel').value), kind, title: f.title.value.replace(/\s+/g, ' ').trim(),
      url: null, phone: null, body: f.body.value.trim() || null };
    const fail = (t) => { err.textContent = t; err.hidden = false; };
    if (!rec.title) return fail('Вкажіть назву');
    if (kind === 'link') { rec.url = safeUrl(f.url.value); if (!rec.url) return fail('Вставте повне посилання, що починається з https://'); }
    if (kind === 'contact') { rec.phone = f.phone.value.trim() || null; if (!rec.phone && !rec.body) return fail('Вкажіть телефон або примітку'); }
    if (kind === 'text' && !rec.body) return fail('Введіть текст');
    if (!editing) rec.sort = notes.filter((x) => x.tab_id === rec.tab_id).length;
    const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    const { error } = editing ? await db.from('notes').update(rec).eq('id', editing.id) : await db.from('notes').insert(rec);
    btn.disabled = false;
    if (error) { console.error(error); return fail('Не вдалося зберегти' + (/row-level|policy/i.test(error.message || '') ? ': немає прав' : '')); }
    $('notes-dialog').close(); tabId = rec.tab_id; toast('Збережено'); load();
  }
  async function removeNote(x) {
    if (!confirm(`Видалити «${x.title}»?`)) return;
    const { error } = await db.from('notes').delete().eq('id', x.id);
    if (error) { console.error(error); toast('Не вдалося видалити'); return; }
    load();
  }
  async function moveNote(x, list, dir) {
    const i = list.indexOf(x), j = i + dir; if (j < 0 || j >= list.length) return;
    const ord = list.slice(); ord.splice(i, 1); ord.splice(j, 0, x);
    await Promise.all(ord.map((n, k) => (n.sort !== k ? db.from('notes').update({ sort: k }).eq('id', n.id) : null)).filter(Boolean));
    load();
  }

  return { init, load };
})();
