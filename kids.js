// ============================================================
// Вкладка «Діти»: один рядок — одна дитина (з батьками, контактами, військовим, участю в програмах).
// Доступ «Діти» (operators.can_kids) — для операторів по дітях; також бачать адміністратор і ті, хто має «Реєстр».
// Дані — одним запитом kids_tab_rows() (≈900 дітей), фільтрує браузер миттєво.
// Зміни — kids_child_save() (статус участі — лише адміністратор), участь у програмах — таблиця child_activities.
// ============================================================
window.Kids = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('.') : '');
  const today = () => new Date().toISOString().slice(0, 10);
  const ageOf = (iso) => { if (!iso) return null; const b = new Date(iso + 'T00:00:00'), t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a -= 1; return a; };
  const ACT_KINDS = ['Оздоровлення', 'Дитячий табір', 'Захід / свято', 'Спортивний захід', 'Освітня програма', 'Психологічна підтримка', 'Матеріальна допомога', 'Подарунок', 'Міжнародна програма', 'Інше'];
  const ACT_ST = ['Запрошено', 'Записано', 'Взяв(ла) участь', 'Відмова', 'Не з’явився(лась)'];
  const PAGE = 200;
  let db = null, isAdmin = false, canEdit = false, rows = [], shown = PAGE, loaded = false, busy = false;
  const toast = (m) => (window.Persons && Persons.toast ? Persons.toast(m) : alert(m));

  function init(dbc, admin) {
    db = dbc; isAdmin = !!admin; canEdit = !(window.ACCESS && window.ACCESS.readOnly);
    buildFilters();
    $('kids-reload').onclick = () => load(true);
    $('kids-excel').onclick = excel;
    $('kids-excel').hidden = !(window.ACCESS && (window.ACCESS.admin || Persons.ctx().operator.can_export));
    $('kids-tolist').hidden = !(window.ACCESS && window.ACCESS.lists);
    $('kids-tolist').onclick = toList;
    $('kids-more').onclick = () => { shown += PAGE; render(); };
    $('kids-reset').onclick = () => { $('kids-filters').querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = false; }); $('kids-filters').querySelectorAll('input:not([type=checkbox]), select').forEach((i) => { i.value = ''; }); syncSummaries(); apply(); };
  }

  async function load(force) {
    if (busy || (loaded && !force)) { if (loaded) apply(); return; }
    busy = true; $('kids-count').textContent = 'Завантажуємо…';
    const { data, error } = await db.rpc('kids_tab_rows');
    busy = false;
    if (error) { console.error(error); $('kids-count').textContent = 'Не вдалося завантажити дітей'; return; }
    rows = (data || []).map((r) => ({ ...r, age: ageOf(r.birth_date) }));
    loaded = true; apply();
  }

  // ---------- Фільтри ----------
  const MS = {};   // key → { el, values() }
  function msBox(key, label, options) {
    const d = document.createElement('details'); d.className = 'kids-ms'; d.dataset.key = key;
    d.innerHTML = `<summary><span class="kids-ms-l"></span> <span class="kids-ms-v muted">усі</span></summary><div class="kids-ms-list"></div>`;
    d.querySelector('.kids-ms-l').textContent = label;
    const list = d.querySelector('.kids-ms-list');
    options.forEach(([v, t]) => { const l = document.createElement('label'); l.className = 'check'; l.innerHTML = '<input type="checkbox"> <span></span>'; l.firstChild.value = v; l.lastChild.textContent = t; list.appendChild(l); });
    list.addEventListener('change', () => { syncSummaries(); apply(); });
    MS[key] = { el: d, values: () => [...list.querySelectorAll('input:checked')].map((i) => i.value) };
    return d;
  }
  function syncSummaries() {
    Object.values(MS).forEach((m) => { const v = m.values(); m.el.querySelector('.kids-ms-v').textContent = v.length ? (v.length === 1 ? m.el.querySelector(`input[value="${CSS.escape(v[0])}"]`).parentElement.textContent.trim() : `обрано ${v.length}`) : 'усі'; });
  }
  function buildFilters() {
    const box = $('kids-filters'); box.innerHTML = '';
    const ctx = Persons.ctx();
    const q = document.createElement('input'); q.type = 'search'; q.id = 'kids-q'; q.placeholder = 'Пошук: дитина, батьки, телефон, справа'; q.className = 'kids-q';
    let t = null; q.oninput = () => { clearTimeout(t); t = setTimeout(apply, 250); };
    const age = document.createElement('span'); age.className = 'kids-age';
    age.innerHTML = 'Вік <input id="kids-af" type="number" min="0" max="30" placeholder="від"> – <input id="kids-at" type="number" min="0" max="30" placeholder="до">';
    age.querySelectorAll('input').forEach((i) => { i.oninput = apply; });
    box.append(q, age,
      msBox('sex', 'Стать', [['Чоловіча', 'хлопчики'], ['Жіноча', 'дівчата'], ['', 'не вказано']]),
      msBox('region', 'Область', [...ctx.regions].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'uk')).map(([id, n]) => [String(id), n])),
      msBox('skind', 'Тип населеного пункту', ['Обласний центр', 'Інший населений пункт', 'Не визначено'].map((x) => [x, x])),
      msBox('fam', 'Категорія родини', OPT.family_categories.map((x) => [x, x])),
      msBox('prog', 'Модуль', [...ctx.programs].map(([id, n]) => [String(id), n])),
      msBox('int', 'Інтереси', OPT.child_interests.map((x) => [x, x])),
      msBox('part', 'Статус участі', [['Звичайний', 'Звичайний'], ['Виняток', '⭐ Виняток'], ['Не включати', '⛔ Не включати']]),
      msBox('act', 'Участь у програмах', [['none', 'ще ніде не брав(ла) участі'], ['any', 'брав(ла) участь хоч раз'], ...ACT_KINDS.map((k) => ['k:' + k, k])]));
    const hint = document.createElement('p'); hint.className = 'muted kids-hint';
    hint.textContent = 'Вік — повних років на сьогодні. Діти-винятки ⭐ показуються за будь-якого віку; «⛔ Не включати» — лише якщо обрано в «Статус участі».';
    box.append(hint);
  }

  function filtered() {
    const q = ($('kids-q').value || '').trim().toLowerCase();
    const af = $('kids-af').value, at = $('kids-at').value;
    const lo = af === '' ? null : Number(af), hi = at === '' ? null : Number(at);
    const v = (k) => MS[k].values();
    const sex = v('sex'), reg = v('region'), sk = v('skind'), fam = v('fam'), prog = v('prog').map(Number), int = v('int'), part = v('part'), act = v('act');
    const digits = q.replace(/\D/g, '');
    return rows.filter((r) => {
      const exc = r.part_status === 'Виняток' && (!r.part_until || r.part_until >= today());
      if (!part.length && r.part_status === 'Не включати') return false;
      if (part.length && !part.includes(r.part_status || 'Звичайний')) return false;
      if ((lo !== null || hi !== null) && !exc) { if (r.age === null) return false; if (lo !== null && r.age < lo) return false; if (hi !== null && r.age > hi) return false; }
      if (sex.length && !sex.includes(r.sex || '')) return false;
      if (reg.length && !reg.includes(String(r.region_id))) return false;
      if (sk.length && !sk.includes(r.settlement_kind)) return false;
      if (fam.length && !(r.family_categories || []).some((x) => fam.includes(x))) return false;
      if (prog.length && !(r.program_ids || []).some((x) => prog.includes(x))) return false;
      if (int.length && !(r.interests || []).some((x) => int.includes(x))) return false;
      if (act.length) {
        const done = (r.acts || []).filter((a) => a.status === 'Взяв(ла) участь');
        const ok = act.some((a) => (a === 'none' ? !done.length : a === 'any' ? done.length > 0 : (r.acts || []).some((x) => 'k:' + x.kind === a)));
        if (!ok) return false;
      }
      if (q) {
        const hay = [r.full_name, r.parent_fio, r.settlement, r.soldier && r.soldier.fio, r.soldier && r.soldier.case].join(' ').toLowerCase();
        const ph = [r.phone, ...(r.extra_phones || [])].join(' ').replace(/\D/g, '');
        if (!hay.includes(q) && !(digits.length >= 4 && ph.includes(digits))) return false;
      }
      return true;
    });
  }

  let cur = [];
  function apply() { shown = PAGE; render(); }
  function render() {
    if (!loaded) return;
    cur = filtered();
    const fams = new Set(cur.map((r) => r.parent_id)).size;
    const exc = cur.filter((r) => r.part_status === 'Виняток').length;
    $('kids-count').textContent = `${cur.length} дітей · ${fams} родин` + (exc ? ` · з них ⭐ винятків: ${exc}` : '') + ` (усього в базі: ${rows.length})`;
    const tb = $('kids-table').tBodies[0]; tb.innerHTML = '';
    const regions = Persons.ctx().regions;
    cur.slice(0, shown).forEach((r) => {
      const tr = document.createElement('tr');
      const mark = r.part_status === 'Виняток' ? ' <span class="tag tag-exc">⭐ виняток</span>' : r.part_status === 'Не включати' ? ' <span class="tag">⛔</span>' : (r.age !== null && r.age >= 18 ? ' <span class="tag tag-adult">🔞</span>' : '');
      const done = (r.acts || []).filter((a) => a.status === 'Взяв(ла) участь');
      tr.innerHTML = `<td><button type="button" class="btn-link kids-open"></button>${mark}<div class="muted kids-sub"></div></td>
        <td class="kids-agecell"></td>
        <td><span class="kids-par"></span><div class="muted kids-sub2"></div></td>
        <td class="kids-ph"></td>
        <td class="muted kids-place"></td>
        <td class="muted kids-sold"></td>
        <td class="kids-acts"></td>`;
      tr.querySelector('.kids-open').textContent = r.full_name || '(без ПІБ)';
      tr.querySelector('.kids-open').onclick = () => openChild(r);
      tr.querySelector('.kids-sub').textContent = [r.sex === 'Чоловіча' ? 'хлопчик' : r.sex === 'Жіноча' ? 'дівчинка' : '', (r.interests || []).join(', ')].filter(Boolean).join(' · ');
      tr.querySelector('.kids-agecell').innerHTML = r.age === null ? '<span class="muted">?</span>' : `<b>${r.age}</b> <span class="muted">(${esc(fmt(r.birth_date))})</span>`;
      tr.querySelector('.kids-par').textContent = r.parent_fio;
      tr.querySelector('.kids-sub2').textContent = r.rep_relation || (r.soldier && r.soldier.degree ? `${r.soldier.degree} військового` : '');
      phoneCell(tr.querySelector('.kids-ph'), r);
      tr.querySelector('.kids-place').textContent = [regions.get(r.region_id), r.settlement_kind === 'Обласний центр' ? 'обл. центр' : '', r.settlement].filter(Boolean).join(' · ');
      tr.querySelector('.kids-sold').textContent = r.soldier ? [r.soldier.fio, r.soldier.status, r.soldier.case].filter(Boolean).join(' · ') : '';
      tr.querySelector('.kids-acts').textContent = done.length ? `✅ ${done.length}` + (done[0] ? ` (${done[0].kind})` : '') : ((r.acts || []).length ? `📝 ${(r.acts || []).length}` : '—');
      tb.appendChild(tr);
    });
    $('kids-more').hidden = cur.length <= shown;
    $('kids-more').textContent = `Показати ще (${Math.min(PAGE, cur.length - shown)} з ${cur.length - shown})`;
    $('kids-empty').hidden = !!cur.length;
  }
  function phoneCell(td, r) {
    td.innerHTML = '';
    const phones = [r.phone, ...(r.extra_phones || [])].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
    if (!phones.length) { td.innerHTML = '<span class="muted">немає</span>'; return; }
    phones.slice(0, 2).forEach((p, i) => {
      const d = document.createElement('div');
      d.append(V.formatPhone(p) || p);
      const cl = V.callLink && V.callLink(p); if (cl) d.append(' ', cl);
      const dg = String(p).replace(/\D/g, ''); if (dg.length >= 9) { const a = document.createElement('a'); a.href = 'https://wa.me/' + dg; a.target = '_blank'; a.rel = 'noopener'; a.title = 'Написати у WhatsApp'; a.textContent = '💬'; d.append(' ', a); }
      if (i) d.className = 'muted';
      td.appendChild(d);
    });
  }

  // ---------- Картка дитини ----------
  async function openChild(r, isNew) {
    const dlg = $('kids-dlg'); const f = $('kids-form');
    $('kids-dlg-title').textContent = isNew ? `Нова дитина · ${r.parent_fio}` : (r.full_name || 'Дитина');
    $('kids-dlg-parent').innerHTML = '';
    { const p = $('kids-dlg-parent');
      const b = document.createElement('b'); b.textContent = r.parent_fio; p.append('Батьки / представник: ', b);
      if (r.soldier) p.append(` · ${[r.soldier.degree, r.soldier.fio, r.soldier.status, r.soldier.case].filter(Boolean).join(' · ')}`);
      const ph = document.createElement('div'); phoneCell(ph, r); p.append(ph);
      if (window.ACCESS && window.ACCESS.registry) { const a = document.createElement('a'); a.href = '?person=' + encodeURIComponent(r.parent_id); a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Відкрити картку батьків у «Особах» ↗'; p.append(a); }
    }
    f.full_name.value = isNew ? '' : (r.full_name || ''); f.birth_date.value = isNew ? '' : (r.birth_date || '');
    f.sex.value = isNew ? '' : (r.sex || ''); f.rep_relation.value = isNew ? (r.rep_relation || '') : (r.rep_relation || '');
    f.special_needs.value = isNew ? '' : (r.special_needs || '');
    const ib = $('kids-int'); ib.innerHTML = '';
    OPT.child_interests.forEach((x) => { const l = document.createElement('label'); l.className = 'check'; l.innerHTML = '<input type="checkbox" name="int"> <span></span>'; l.firstChild.value = x; l.firstChild.checked = !isNew && (r.interests || []).includes(x); l.lastChild.textContent = x; ib.appendChild(l); });
    f.part_status.value = isNew ? 'Звичайний' : (r.part_status || 'Звичайний'); f.part_reason.value = isNew ? '' : (r.part_reason || ''); f.part_until.value = isNew ? '' : (r.part_until || '');
    $('kids-part-wrap').querySelectorAll('input, select').forEach((el) => { el.disabled = !isAdmin; });
    $('kids-part-note').hidden = isAdmin;
    f.querySelectorAll('input, select, textarea, button[type=submit]').forEach((el) => { if (!canEdit) el.disabled = true; });
    $('kids-acts-wrap').hidden = !!isNew;
    $('kids-add-sib').hidden = !!isNew || !canEdit;
    $('kids-add-sib').onclick = () => { dlg.close(); openChild({ ...r }, true); };
    if (!isNew) loadActs(r);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const sb = f.querySelector('button[type=submit]'); if (sb.disabled) return; sb.disabled = true;
      const p = { full_name: f.full_name.value, birth_date: f.birth_date.value, sex: f.sex.value, rep_relation: f.rep_relation.value, special_needs: f.special_needs.value,
        interests: [...ib.querySelectorAll('input:checked')].map((i) => i.value) };
      if (isAdmin) Object.assign(p, { part_status: f.part_status.value, part_reason: f.part_reason.value, part_until: f.part_until.value });
      if (!p.full_name.trim()) { toast('Вкажіть ПІБ дитини'); sb.disabled = false; return; }
      const { error } = await db.rpc('kids_child_save', { p_id: isNew ? null : r.id, p_person: isNew ? r.parent_id : null, p });
      sb.disabled = false;
      if (error) { console.error(error); toast('Не вдалося зберегти: ' + (error.message || '')); return; }
      toast(isNew ? 'Дитину додано' : 'Збережено'); dlg.close(); load(true);
    };
    $('kids-dlg-close').onclick = () => dlg.close();
    dlg.showModal();
  }

  async function loadActs(r) {
    const box = $('kids-acts-list'); box.innerHTML = '<p class="muted">Завантажуємо…</p>';
    const { data, error } = await db.from('child_activities').select('id, kind, title, date_from, date_to, status, note, created_at').eq('child_id', r.id).order('date_from', { ascending: false, nullsFirst: false });
    if (error) { console.error(error); box.innerHTML = '<p class="muted">Не вдалося завантажити участь.</p>'; return; }
    box.innerHTML = '';
    if (!data.length) box.innerHTML = '<p class="muted">Ще не брав(ла) участі в жодній програмі.</p>';
    data.forEach((a) => {
      const d = document.createElement('div'); d.className = 'kids-act';
      d.innerHTML = '<span class="kids-act-t"></span> <button type="button" class="btn-link btn-small" title="Видалити запис">🗑</button>';
      d.querySelector('.kids-act-t').textContent = [a.status === 'Взяв(ла) участь' ? '✅' : a.status === 'Відмова' || a.status === 'Не з’явився(лась)' ? '✖' : '📝', a.kind, a.title, a.date_from && (fmt(a.date_from) + (a.date_to ? '–' + fmt(a.date_to) : '')), a.status, a.note].filter(Boolean).join(' · ');
      const del = d.querySelector('button'); del.hidden = !canEdit;
      del.onclick = async () => {
        if (!confirm('Видалити цей запис про участь?')) return;
        const { error: e2 } = await db.from('child_activities').delete().eq('id', a.id);
        if (e2) { console.error(e2); toast('Не вдалося видалити'); return; }
        loaded = false; loadActs(r); load(true);
      };
      box.appendChild(d);
    });
    const af = $('kids-act-form'); af.hidden = !canEdit;
    af.kind.innerHTML = ACT_KINDS.map((k) => `<option>${esc(k)}</option>`).join('');
    af.status.innerHTML = ACT_ST.map((k) => `<option${k === 'Взяв(ла) участь' ? ' selected' : ''}>${esc(k)}</option>`).join('');
    af.title.value = ''; af.date_from.value = ''; af.date_to.value = ''; af.note.value = '';
    af.onsubmit = async (e) => {
      e.preventDefault();
      const b = af.querySelector('button[type=submit]'); if (b.disabled) return; b.disabled = true;
      const { error: e3 } = await db.from('child_activities').insert({ child_id: r.id, kind: af.kind.value, title: af.title.value.trim() || null,
        date_from: af.date_from.value || null, date_to: af.date_to.value || null, status: af.status.value, note: af.note.value.trim() || null });
      b.disabled = false;
      if (e3) { console.error(e3); toast('Не вдалося додати'); return; }
      toast('Участь додано'); loadActs(r); load(true);
    };
  }

  // ---------- Масові дії ----------
  function toList() {
    if (!cur.length) { toast('Нікого не обрано фільтрами'); return; }
    const ids = [...new Set(cur.map((r) => r.parent_id))];
    Lists.addDialog({ ids, label: `Батьки дітей з вкладки «Діти»: ${ids.length} родин (${cur.length} дітей)` });
  }
  function excel() {
    if (!cur.length) { toast('Нікого не обрано фільтрами'); return; }
    const regions = Persons.ctx().regions;
    const aoa = [['Дитина (ПІБ)', 'Дата народження', 'Вік', 'Стать', 'Інтереси', 'Особливі потреби', 'Статус участі', 'Участь у програмах',
      'Батьки / представник', 'Ким доводиться', 'Телефон', 'Дод. телефони', 'Область', 'Населений пункт', 'Тип населеного пункту', 'Категорія родини', 'Військовий', 'Статус військового', 'Справа'],
      ...cur.map((r) => [r.full_name || '', fmt(r.birth_date), r.age ?? '', r.sex || '', (r.interests || []).join(', '), r.special_needs || '', r.part_status || 'Звичайний',
        (r.acts || []).map((a) => `${a.kind} (${a.status}${a.date ? ', ' + fmt(a.date) : ''})`).join('; '),
        r.parent_fio, r.rep_relation || (r.soldier && r.soldier.degree) || '', V.formatPhone(r.phone) || r.phone || '', (r.extra_phones || []).join(', '),
        regions.get(r.region_id) || '', r.settlement || '', r.settlement_kind || '', (r.family_categories || []).join('; '),
        r.soldier ? r.soldier.fio : '', r.soldier ? r.soldier.status : '', r.soldier ? r.soldier.case || '' : ''])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [30, 12, 5, 10, 30, 20, 12, 34, 32, 14, 18, 18, 16, 34, 18, 26, 32, 18, 12].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Діти');
    XLSX.writeFile(wb, `dity_${new Date().toISOString().slice(0, 10)}.xlsx`);
    db.from('export_log').insert({ kind: 'Excel', channel: 'Діти', row_count: cur.length, filters_note: 'Вкладка «Діти»: ' + $('kids-count').textContent }).then(({ error }) => { if (error) console.warn('export_log', error); });
  }

  return { init, load };
})();
