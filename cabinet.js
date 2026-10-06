// ============================================================
// Робочий кабінет 200 / 300: справи, етапи супроводу, нагадування, історія
// Етапи й статуси налаштовуються (таблиці case_stage_defs, case_statuses).
// ============================================================
window.Cabinet = (() => {
  const $ = (id) => document.getElementById(id);
  let db = null, me = null, isAdmin = false;
  let module = '200';
  let defs = [], statuses = [], staff = new Map(), cases = [];
  let current = null;           // відкрита справа
  let quick = '';               // mine | overdue | problem
  const today = () => new Date().toISOString().slice(0, 10);
  const fmt = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '');
  const fio = (p) => [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');
  // Кольори статусів: з бази, з уточненнями; текст темний на світлому тлі
  const STATUS_OVERRIDE = { 'В роботі': '#f2b705' };
  const statusColor = (name, fromDb) => STATUS_OVERRIDE[name] || fromDb || '#8a96a1';
  const inkFor = (hex) => {
    const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#3d2e00' : '#ffffff';
  };
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  function init(client, userId, admin) {
    db = client; me = userId; isAdmin = admin;
    document.querySelectorAll('.cab-mod').forEach((b) => b.addEventListener('click', () => { module = b.dataset.m; quick = ''; load(); }));
    ['cab-search', 'cab-status', 'cab-exec', 'cab-cell'].forEach((id) => $(id).addEventListener('input', render));
    document.querySelectorAll('.cab-quick').forEach((b) => b.addEventListener('click', () => { quick = quick === b.dataset.q ? '' : b.dataset.q; render(); }));
    $('cab-back').addEventListener('click', closeCase);
    $('cab-settings-btn').hidden = !isAdmin;
    $('cab-settings-btn').addEventListener('click', openSettings);
    $('cab-set-close').addEventListener('click', () => { $('cab-settings').close(); load(); });
    window.addEventListener('popstate', () => { if (!$('cab-case').hidden) closeCase(true); });
  }

  // ---------- Завантаження ----------
  async function load() {
    document.querySelectorAll('.cab-mod').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === module)));
    $('cab-title').textContent = module === '200' ? 'Кабінет 200 — супровід родин загиблих' : 'Кабінет 300 — супровід поранених';
    $('cab-status-line').textContent = 'Завантажуємо…';
    const [d, st, ops] = await Promise.all([
      db.from('case_stage_defs').select('*').eq('module', module).eq('active', true).order('sort'),
      db.from('case_statuses').select('*').eq('module', module).order('sort'),
      db.from('operators').select('user_id, full_name, active').order('full_name')
    ]);
    defs = d.data || []; statuses = st.data || [];
    staff = new Map((ops.data || []).map((o) => [o.user_id, o.full_name]));

    cases = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('cases')
        .select('*, person:persons(id, last_name, first_name, patronymic, military_status, death_date, burial_date, wounded, wound_date), case_values(stage_key, value)')
        .eq('module', module).order('journal_id').range(from, from + 999);
      if (error) { console.error(error); $('cab-status-line').textContent = 'Не вдалося завантажити справи.'; return; }
      cases.push(...data);
      if (data.length < 1000) break;
    }
    // родина: перший пов’язаний родич (отримувач)
    const ids = cases.map((c) => c.person_id);
    const kin = new Map();
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await db.from('military_relations')
        .select('related_person_id, relation_degree, created_at, person:persons!military_relations_person_id_fkey(id, last_name, first_name, phone)')
        .in('related_person_id', ids.slice(i, i + 150)).order('created_at');
      (data || []).forEach((r) => { if (r.person) kin.set(r.related_person_id, [...(kin.get(r.related_person_id) || []), r]); });
    }
    cases.forEach((c) => {
      c.vals = Object.fromEntries((c.case_values || []).map((v) => [v.stage_key, v.value]));
      c.kin = kin.get(c.person_id) || [];
      c.next = nextAction(c);
    });
    fillFilters();
    $('cab-status-line').textContent = '';
    render();
  }

  // Найближча дія за правилами нагадувань
  function nextAction(c) {
    let best = null;
    defs.filter((d) => d.remind_after && d.remind_days != null).forEach((d) => {
      if (c.vals[d.key]) return;                    // уже зроблено
      const base = c.vals[d.remind_after];
      if (!base || !/^\d{4}-\d{2}-\d{2}/.test(base)) return;
      const due = addDays(base.slice(0, 10), d.remind_days);
      if (!best || due < best.due) best = { label: d.label, due, overdue: due < today() };
    });
    return best;
  }

  function fillFilters() {
    const keep = (id) => $(id).value;
    const fill = (id, items, all) => {
      const v = keep(id); const sel = $(id);
      sel.innerHTML = `<option value="">${all}</option>`;
      items.forEach(([val, label]) => sel.add(new Option(label, val)));
      sel.value = v;
    };
    fill('cab-status', statuses.map((s) => [s.name, s.name]), 'Усі статуси');
    fill('cab-exec', [['none', '— без виконавця —'], ...[...staff].map(([id, n]) => [id, n])], 'Усі виконавці');
    const { cells } = Persons.ctx();
    fill('cab-cell', [['none', '— без осередку —'], ...[...cells].map(([id, n]) => [String(id), n])], 'Усі осередки');
  }

  // ---------- Список ----------
  function filtered() {
    const q = $('cab-search').value.trim().toLowerCase();
    const st = $('cab-status').value, ex = $('cab-exec').value, ce = $('cab-cell').value;
    return cases.filter((c) => {
      if (q && !(fio(c.person).toLowerCase().includes(q) || c.journal_id.toLowerCase().includes(q) ||
        c.kin.some((k) => fio(k.person).toLowerCase().includes(q) || (k.person.phone || '').includes(q.replace(/\D/g, '') || '§')))) return false;
      if (st && c.status !== st) return false;
      if (ex === 'none' ? c.executor_id : ex && c.executor_id !== ex) return false;
      if (ce === 'none' ? c.cell_id : ce && String(c.cell_id) !== ce) return false;
      if (quick === 'mine' && c.executor_id !== me) return false;
      if (quick === 'overdue' && !(c.next && c.next.overdue)) return false;
      if (quick === 'problem' && c.status !== 'Проблема') return false;
      return true;
    });
  }

  function render() {
    const list = filtered();
    const cnt = (f) => cases.filter(f).length;
    $('cq-mine').textContent = cnt((c) => c.executor_id === me);
    $('cq-overdue').textContent = cnt((c) => c.next && c.next.overdue);
    $('cq-problem').textContent = cnt((c) => c.status === 'Проблема');
    document.querySelectorAll('.cab-quick').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.q === quick)));
    $('cab-count').textContent = `${list.length} з ${cases.length}`;
    const { cells } = Persons.ctx();
    const color = new Map(statuses.map((s) => [s.name, s.color]));
    const totalStages = defs.filter((d) => d.key !== 'executor_legacy').length;
    const tb = $('cab-table').tBodies[0];
    tb.innerHTML = '';
    list.slice(0, 500).forEach((c) => {
      const tr = document.createElement('tr');
      const rec = c.kin[0];
      const filled = defs.filter((d) => d.key !== 'executor_legacy' && c.vals[d.key]).length;
      const pct = totalStages ? Math.round((filled / totalStages) * 100) : 0;
      tr.innerHTML = `
        <td class="cab-id"></td>
        <td class="cell-name"></td>
        <td class="cab-family"></td>
        <td></td>
        <td><span class="cab-status"></span></td>
        <td class="cab-exec"></td>
        <td class="cab-next"></td>
        <td><span class="cab-progress"><i style="width:${pct}%"></i></span> <span class="muted">${filled}/${totalStages}</span></td>`;
      tr.children[0].textContent = c.journal_id;
      tr.children[1].textContent = fio(c.person);
      tr.children[2].innerHTML = rec ? '<span></span><br><span class="muted"></span>' : '<span class="muted">родину не встановлено</span>';
      if (rec) {
        tr.children[2].firstChild.textContent = `${rec.relation_degree}: ${fio(rec.person)}` + (c.kin.length > 1 ? ` (+${c.kin.length - 1})` : '');
        tr.children[2].lastChild.textContent = V.formatPhone(rec.person.phone) || 'без телефону';
      }
      tr.children[3].textContent = cells.get(c.cell_id) || '—';
      const sp = tr.children[4].firstChild;
      sp.textContent = c.status || '—';
      const col = statusColor(c.status, color.get(c.status));
      sp.style.setProperty('--st', col); sp.style.color = inkFor(col);
      tr.children[5].textContent = staff.get(c.executor_id) || (c.vals.executor_legacy ? `(${c.vals.executor_legacy})` : '—');
      if (c.next) {
        tr.children[6].textContent = `${c.next.label} — до ${fmt(c.next.due)}`;
        tr.children[6].classList.toggle('is-overdue', c.next.overdue);
      } else tr.children[6].textContent = '—';
      tr.addEventListener('click', () => openCase(c.id));
      tb.appendChild(tr);
    });
    $('cab-more').hidden = list.length <= 500;
    $('cab-empty').hidden = list.length > 0;
  }

  // ---------- Справа ----------
  async function openCase(id, noPush) {
    current = cases.find((c) => c.id === id);
    if (!current) return;
    $('cab-list').hidden = true; $('cab-case').hidden = false;
    if (!noPush) history.pushState({ view: 'case' }, '');
    window.scrollTo(0, 0);
    const c = current, p = c.person;
    $('case-title').textContent = fio(p);
    $('case-sub').textContent = `${c.journal_id} · ${module === '200' ? 'загиблий' : 'поранений'}` +
      (p.death_date ? ` · дата смерті ${fmt(p.death_date)}` : '') + (p.burial_date ? ` · поховання ${fmt(p.burial_date)}` : '') +
      (p.wound_date ? ` · поранення ${fmt(p.wound_date)}` : '');
    $('case-link').onclick = () => copyLink(`?case=${encodeURIComponent(c.journal_id)}`, `Посилання на справу ${c.journal_id} скопійовано`);
    $('case-open-person').onclick = () => { document.querySelector('.tab[data-tab="registry"]').click(); Persons.openForm(p.id); };

    // статус / виконавець / осередок
    const sSel = $('case-status'); sSel.innerHTML = '';
    statuses.forEach((s) => sSel.add(new Option(s.name, s.name)));
    if (c.status && !statuses.some((s) => s.name === c.status)) sSel.add(new Option(c.status, c.status));
    sSel.value = c.status || '';
    const eSel = $('case-exec'); eSel.innerHTML = '<option value="">— не призначено —</option>';
    [...staff].forEach(([uid, n]) => eSel.add(new Option(n, uid)));
    eSel.value = c.executor_id || '';
    const cSel = $('case-cell'); cSel.innerHTML = '<option value="">— не вказано —</option>';
    [...Persons.ctx().cells].forEach(([cid, n]) => cSel.add(new Option(n, cid)));
    cSel.value = c.cell_id || '';
    cSel.disabled = !isAdmin;   // передача між осередками — етап B
    sSel.onchange = () => saveCase({ status: sSel.value });
    eSel.onchange = () => saveCase({ executor_id: eSel.value || null });
    cSel.onchange = () => saveCase({ cell_id: cSel.value ? Number(cSel.value) : null });
    $('case-take').hidden = c.executor_id === me;
    $('case-take').onclick = () => { eSel.value = me; saveCase({ executor_id: me }); };

    // родина
    const fam = $('case-family'); fam.innerHTML = '';
    if (!c.kin.length) fam.innerHTML = '<li class="muted">Родину не встановлено. Додайте рідних у картці загиблого кнопкою «+ Додати родича».</li>';
    c.kin.forEach((k) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="muted"></span> <button type="button" class="btn-link"></button> <a></a>';
      li.children[0].textContent = k.relation_degree + ' —';
      li.children[1].textContent = fio(k.person);
      li.children[1].onclick = () => { document.querySelector('.tab[data-tab="registry"]').click(); Persons.openForm(k.person.id); };
      if (k.person.phone) { li.children[2].textContent = V.formatPhone(k.person.phone); li.children[2].href = 'tel:' + k.person.phone; }
      else li.children[2].textContent = 'без телефону';
      fam.appendChild(li);
    });

    renderStages();
    loadHistory();
  }

  function closeCase(fromPop) {
    $('cab-case').hidden = true; $('cab-list').hidden = false;
    current = null;
    if (!fromPop && history.state && history.state.view === 'case') history.back();
    render();
  }

  function renderStages() {
    const c = current;
    const box = $('case-stages'); box.innerHTML = '';
    defs.forEach((d) => {
      const wrap = document.createElement('div');
      wrap.className = 'stage stage-' + d.key;
      const id = 'st-' + d.key;
      const v = c.vals[d.key] ?? '';
      let control;
      if (d.kind === 'date') {
        control = `<input id="${id}" type="date" value="${/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : ''}">`;
      } else if (d.kind === 'list') {
        const opts = [...new Set([...(d.options || []), ...(v && !(d.options || []).includes(v) ? [v] : [])])];
        control = `<select id="${id}"><option value=""></option>${opts.map((o) => `<option>${o.replace(/</g, '&lt;')}</option>`).join('')}</select>`;
      } else if (d.kind === 'bool') {
        control = `<select id="${id}"><option value=""></option><option>Так</option><option>Ні</option></select>`;
      } else {
        control = `<textarea id="${id}" rows="1"></textarea>`;
      }
      wrap.innerHTML = `<label for="${id}"></label>${control}<p class="stage-hint"></p>`;
      wrap.querySelector('label').textContent = d.label;
      const el = wrap.querySelector('#' + id);
      if (d.kind === 'list' || d.kind === 'bool') el.value = v;
      if (d.kind === 'text') el.value = v;
      // нагадування
      if (d.remind_after && !v && c.vals[d.remind_after] && /^\d{4}-\d{2}-\d{2}/.test(c.vals[d.remind_after])) {
        const due = addDays(c.vals[d.remind_after].slice(0, 10), d.remind_days || 0);
        wrap.querySelector('.stage-hint').textContent = `Потрібно до ${fmt(due)}`;
        wrap.classList.add(due < today() ? 'is-overdue' : 'is-due');
      }
      if (v) wrap.classList.add('is-done');
      el.addEventListener('change', () => saveValue(d.key, el.value.trim()));
      if (d.kind === 'text') el.addEventListener('input', () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; });
      box.appendChild(wrap);
      if (d.kind === 'text') setTimeout(() => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; });
    });
  }

  async function saveValue(key, value) {
    const c = current;
    const { error } = await db.from('case_values')
      .upsert({ case_id: c.id, stage_key: key, value: value || null, source: 'app', updated_by: me, updated_at: new Date().toISOString() },
        { onConflict: 'case_id,stage_key' });
    if (error) { console.error(error); Persons.toast('Не вдалося зберегти'); return; }
    c.vals[key] = value || null;
    c.next = nextAction(c);
    Persons.toast('Збережено');
    renderStages();
    loadHistory();
  }

  async function saveCase(patch) {
    const c = current;
    const { error } = await db.from('cases').update(patch).eq('id', c.id);
    if (error) { console.error(error); Persons.toast('Не вдалося зберегти'); return; }
    Object.assign(c, patch);
    $('case-take').hidden = c.executor_id === me;
    Persons.toast('Збережено');
    loadHistory();
  }

  async function loadHistory() {
    const c = current;
    const { data } = await db.from('case_history').select('*').eq('case_id', c.id).order('changed_at', { ascending: false }).limit(100);
    const label = new Map(defs.map((d) => [d.key, d.label]));
    label.set('status', 'Статус'); label.set('executor', 'Виконавець'); label.set('cell', 'Осередок');
    const ul = $('case-history'); ul.innerHTML = '';
    (data || []).forEach((h) => {
      const li = document.createElement('li');
      const src = h.source === 'sheet' ? 'у таблиці' : h.source === 'import' ? 'імпорт' : 'у кабінеті';
      li.innerHTML = '<span class="muted"></span> <b></b>: <span></span>';
      li.children[0].textContent = `${new Date(h.changed_at).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })} · ${staff.get(h.changed_by) || '—'} · ${src}`;
      li.children[1].textContent = label.get(h.field) || h.field;
      const fmtV = (x) => (x && /^\d{4}-\d{2}-\d{2}$/.test(x) ? fmt(x) : x);
      li.children[2].textContent = h.old_value ? `${fmtV(h.old_value)} → ${fmtV(h.new_value) || '(порожньо)'}` : (fmtV(h.new_value) || '(порожньо)');
      ul.appendChild(li);
    });
    if (!ul.children.length) ul.innerHTML = '<li class="muted">Змін ще не було.</li>';
  }

  async function copyLink(query, okText) {
    const url = `${location.origin}${location.pathname}${query}`;
    try { await navigator.clipboard.writeText(url); Persons.toast(okText); }
    catch { prompt('Скопіюйте посилання:', url); }
  }

  // ---------- Налаштування етапів (адміністратор) ----------
  async function openSettings() {
    const { data } = await db.from('case_stage_defs').select('*').eq('module', module).order('sort');
    const tb = $('cab-set-table').tBodies[0]; tb.innerHTML = '';
    $('cab-set-title').textContent = `Етапи кабінету ${module}`;
    const keys = (data || []).map((d) => [d.key, d.label]);
    const row = (d) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input data-f="label"></td>
        <td><select data-f="kind"><option value="text">текст</option><option value="date">дата</option><option value="list">список</option><option value="bool">так/ні</option></select></td>
        <td><input data-f="options" placeholder="через кому"></td>
        <td><select data-f="remind_after"><option value="">—</option>${keys.map(([k, l]) => `<option value="${k}">${l.replace(/</g, '&lt;')}</option>`).join('')}</select></td>
        <td><input data-f="remind_days" type="number" min="0" style="width:5rem"></td>
        <td><input data-f="sort" type="number" style="width:5rem"></td>
        <td><input data-f="active" type="checkbox"></td>
        <td><button type="button" class="btn-link" data-save>Зберегти</button></td>`;
      const q = (f) => tr.querySelector(`[data-f="${f}"]`);
      q('label').value = d.label || ''; q('kind').value = d.kind || 'text';
      q('options').value = (d.options || []).join(', '); q('remind_after').value = d.remind_after || '';
      q('remind_days').value = d.remind_days ?? ''; q('sort').value = d.sort ?? 0; q('active').checked = d.active !== false;
      tr.querySelector('[data-save]').onclick = async () => {
        const rec = {
          module, label: q('label').value.trim(), kind: q('kind').value,
          options: q('options').value.split(',').map((x) => x.trim()).filter(Boolean),
          remind_after: q('remind_after').value || null,
          remind_days: q('remind_days').value === '' ? null : Number(q('remind_days').value),
          sort: Number(q('sort').value || 0), active: q('active').checked,
          sheet_column: d.sheet_column || q('label').value.trim()
        };
        if (!rec.label) { Persons.toast('Вкажіть назву етапу'); return; }
        const res = d.id
          ? await db.from('case_stage_defs').update(rec).eq('id', d.id)
          : await db.from('case_stage_defs').insert({ ...rec, key: 'custom_' + Date.now().toString(36) });
        if (res.error) { console.error(res.error); Persons.toast('Не вдалося зберегти етап'); return; }
        Persons.toast('Етап збережено');
        openSettings();
      };
      return tr;
    };
    (data || []).forEach((d) => tb.appendChild(row(d)));
    tb.appendChild(row({ sort: ((data || []).slice(-1)[0]?.sort || 0) + 10, active: true }));
    if (!$('cab-settings').open) $('cab-settings').showModal();
  }

  // Відкрити справу за посиланням ?case=200-0123
  async function openByJournal(jid) {
    module = jid.startsWith('300') ? '300' : '200';
    await load();
    const c = cases.find((x) => x.journal_id === jid);
    if (c) openCase(c.id);
    else Persons.toast(`Справу ${jid} не знайдено або немає доступу`);
  }

  return { init, load, openByJournal };
})();
