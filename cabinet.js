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
    document.querySelectorAll('.cab-mod').forEach((b) => b.addEventListener('click', () => { module = b.dataset.m; quick = ''; load(); }));
    ['cab-search', 'cab-status', 'cab-exec', 'cab-cell'].forEach((id) => $(id).addEventListener('input', render));
    document.querySelectorAll('.cab-quick').forEach((b) => b.addEventListener('click', () => { quick = quick === b.dataset.q ? '' : b.dataset.q; render(); }));
    $('cab-back').addEventListener('click', closeCase);
    $('cab-settings-btn').hidden = !isAdmin;
    $('cab-settings-btn').addEventListener('click', openSettings);
    $('cab-new-btn').addEventListener('click', openNew);
    $('cab-new-form').addEventListener('submit', submitNew);
    $('cab-new-cancel').addEventListener('click', () => $('cab-new').close());
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
        .select('*, person:persons!cases_person_id_fkey(id, last_name, first_name, patronymic, military_status, death_date, burial_date, wounded, wound_date, birth_date, callsign, burial_place, military_unit_code, mp_unit_id, region_id, settlement, phone, comment), case_values(stage_key, value)')
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
        .select('id, related_person_id, relation_degree, created_at, person:persons!military_relations_person_id_fkey(id, last_name, first_name, patronymic, phone, settlement)')
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
    const totalStages = defs.filter((d) => (d.section || 'other') !== 'head').length;
    const tb = $('cab-table').tBodies[0];
    tb.innerHTML = '';
    list.slice(0, 500).forEach((c) => {
      const tr = document.createElement('tr');
      const rec = contactOf(c);
      const filled = defs.filter((d) => (d.section || 'other') !== 'head' && c.vals[d.key]).length;
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
  const SECTIONS = {
    '200': [['person', 'Особа'], ['notice', 'Сповіщення'], ['family', 'Родина'], ['burial', 'Поховання'], ['support', 'Супровід'], ['awards', 'Нагороди і юридичне'], ['problems', 'Проблеми'], ['other', 'Інше']],
    '300': [['person', 'Особа'], ['treat', 'Лікування'], ['docs', 'Документи'], ['family', 'Родина'], ['problems', 'Проблеми'], ['other', 'Інше']]
  };
  // Поля особи, які редагуються у справі й одразу потрапляють у картку реєстру
  const PERSON_FIELDS = {
    '200': {
      person: [['last_name', 'Прізвище'], ['first_name', 'Ім’я'], ['patronymic', 'По батькові'], ['callsign', 'Позивний'], ['birth_date', 'Дата народження', 'date'],
        ['death_date', 'Дата загибелі', 'date'], ['military_unit_code', 'Військова частина', 'code'], ['mp_unit_id', 'Бригада', 'unit'], ['region_id', 'Регіон (область)', 'region']],
      burial: [['burial_place', 'Місце поховання'], ['burial_date', 'Дата поховання', 'date']]
    },
    '300': {
      person: [['last_name', 'Прізвище'], ['first_name', 'Ім’я'], ['patronymic', 'По батькові'], ['callsign', 'Позивний'], ['birth_date', 'Дата народження', 'date'],
        ['phone', 'Номер телефону', 'phone'], ['military_unit_code', 'Військова частина', 'code'], ['mp_unit_id', 'Бригада', 'unit'], ['region_id', 'Регіон (область)', 'region'],
        ['wound_date', 'Дата поранення', 'date']]
    }
  };
  const P_LABELS = Object.fromEntries([['p_comment', 'Примітки'], ...Object.values(PERSON_FIELDS).flatMap((m) => Object.values(m).flat()).map(([k, l]) => ['p_' + k, l])]);
  const UNIT_CODES = ['А0216', 'А0878', 'А1275', 'А1325', 'А1965', 'А2062', 'А2611', 'А2613', 'А2777', 'А2802', 'А3821', 'А4210', 'А4217', 'А4548', 'А4635', 'А4765', 'А4822', 'А4916', 'А4935', 'А5025', 'А5074', 'А7053', 'А7382'];
  const unitCodes = () => [...new Set([...UNIT_CODES, ...cases.map((c) => c.person.military_unit_code).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'uk'));
  let tab = 'all';
  // Телефон: рівно 10 цифр після 0 (або +380…); помилку показуємо біля поля й не зберігаємо
  function phoneOf(el) {
    const raw = el.value.trim(); const r = V.normalizePhone(raw);
    let hint = el.parentElement.querySelector('.field-err');
    if (!hint) { hint = document.createElement('span'); hint.className = 'field-err'; el.after(hint); }
    const bad = raw && !r.value;
    el.classList.toggle('is-bad', !!bad);
    hint.textContent = bad ? `Невірний номер (${raw.replace(/\D/g, '').length} цифр) — не збережено. Приклад: 050 123 45 67` : (r.warning || '');
    if (bad) { Persons.toast('Телефон введено з помилкою — не збережено'); el.focus(); return undefined; }
    return r.value;
  }
  const nm = (x) => V.normalizeName(x).value || null;
  const badName = (...xs) => { const e = xs.map((x) => V.normalizeName(x).error).find(Boolean); if (e) Persons.toast('ПІБ: ' + e); return !!e; };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const openPerson = (id) => { document.querySelector('.tab[data-tab="registry"]').click(); Persons.openForm(id); };
  const secDefs = (sec) => defs.filter((d) => (d.section || 'other') === sec);
  const contactOf = (c) => c.kin.find((k) => k.person.id === c.contact_person_id) || c.kin[0] || null;

  async function openCase(id, noPush) {
    current = cases.find((c) => c.id === id);
    if (!current) return;
    $('cab-list').hidden = true; $('cab-case').hidden = false;
    if (!noPush) history.pushState({ view: 'case' }, '');
    window.scrollTo(0, 0);
    tab = 'all';
    const c = current, p = c.person;
    $('case-link').onclick = () => copyLink(`?case=${encodeURIComponent(c.journal_id)}`, `Посилання на справу ${c.journal_id} скопійовано`);
    $('case-open-person').onclick = () => openPerson(p.id);

    const sSel = $('case-status'); sSel.innerHTML = '';
    statuses.forEach((s) => sSel.add(new Option(s.name, s.name)));
    if (c.status && !statuses.some((s) => s.name === c.status)) sSel.add(new Option(c.status, c.status));
    sSel.value = c.status || '';
    const staffSel = (id, val, empty) => {
      const sel = $(id); sel.innerHTML = `<option value="">${empty}</option>`;
      [...staff].forEach(([uid, n]) => sel.add(new Option(n, uid)));
      sel.value = val || ''; return sel;
    };
    const eSel = staffSel('case-exec', c.executor_id, '— не призначено —');
    const rSel = staffSel('case-resp', c.responsible_id, '— не вказано —');
    const cSel = $('case-cell'); cSel.innerHTML = '<option value="">— не вказано —</option>';
    [...Persons.ctx().cells].forEach(([cid, n]) => cSel.add(new Option(n, cid)));
    cSel.value = c.cell_id || '';
    cSel.disabled = !isAdmin;   // передача між осередками — етап B
    sSel.onchange = () => saveCase({ status: sSel.value });
    eSel.onchange = () => saveCase({ executor_id: eSel.value || null });
    rSel.onchange = () => saveCase({ responsible_id: rSel.value || null });
    cSel.onchange = () => saveCase({ cell_id: cSel.value ? Number(cSel.value) : null });
    $('case-take').onclick = () => { eSel.value = me; saveCase({ executor_id: me }); };
    renderHelpers();
    const legacy = [c.vals.executor_legacy && `виконавець — ${c.vals.executor_legacy}`, c.vals.responsible && `відповідальний — ${c.vals.responsible}`].filter(Boolean);
    $('case-legacy').textContent = legacy.length ? `Як було в журналі: ${legacy.join('; ')}` : '';
    renderHead();
    renderStages();
    loadHistory();
  }

  function renderHead() {
    const c = current, p = c.person;
    $('case-title').textContent = fio(p) + (p.callsign ? ` «${p.callsign}»` : '');
    $('case-sub').textContent = `${c.journal_id} · ${module === '200' ? 'загиблий' : 'поранений'}` +
      (p.death_date ? ` · дата смерті ${fmt(p.death_date)}` : '') + (p.burial_date ? ` · поховання ${fmt(p.burial_date)}` : '') +
      (p.wound_date ? ` · поранення ${fmt(p.wound_date)}` : '') + (c.next ? ` · далі: ${c.next.label} до ${fmt(c.next.due)}` : '');
    $('case-take').hidden = c.executor_id === me;
    const box = $('case-contact'); const k = contactOf(c);
    if (!k) { box.innerHTML = '<span class="muted">Контактну особу не вказано — додайте рідних у розділі «Родина».</span>'; return; }
    box.innerHTML = '<span class="muted">Контактна особа:</span> <b></b> <span class="muted"></span> <b class="case-phone"></b>';
    box.children[1].textContent = fio(k.person);
    box.children[2].textContent = `(${k.relation_degree})`;
    box.children[3].textContent = k.person.phone ? V.formatPhone(k.person.phone) : 'без телефону';
  }

  function renderHelpers() {
    const c = current; const box = $('case-helpers');
    const names = (c.helper_ids || []).map((u) => staff.get(u)).filter(Boolean);
    box.innerHTML = `<summary></summary><div class="case-helpers-list"></div>`;
    box.firstChild.textContent = names.length ? names.join(', ') : '— ніхто —';
    [...staff].forEach(([uid, n]) => {
      if (uid === c.executor_id) return;
      const l = document.createElement('label');
      l.innerHTML = '<input type="checkbox"> <span></span>';
      l.lastChild.textContent = n;
      l.firstChild.checked = (c.helper_ids || []).includes(uid);
      l.firstChild.onchange = async () => {
        const set = new Set(c.helper_ids || []); l.firstChild.checked ? set.add(uid) : set.delete(uid);
        await saveCase({ helper_ids: [...set] });
        box.firstChild.textContent = (c.helper_ids || []).map((u) => staff.get(u)).filter(Boolean).join(', ') || '— ніхто —';
      };
      box.lastChild.appendChild(l);
    });
  }

  function closeCase(fromPop) {
    $('cab-case').hidden = true; $('cab-list').hidden = false;
    current = null;
    if (!fromPop && history.state && history.state.view === 'case') history.back();
    render();
  }

  // Одне поле: {id,label,kind,options,value,hint,state,onSave}
  function fieldEl(f) {
    const wrap = document.createElement('div');
    wrap.className = 'stage' + (f.cls ? ' ' + f.cls : '');
    const id = 'cf-' + f.id; const v = f.value ?? '';
    let control;
    if (f.kind === 'date') control = `<input id="${id}" type="date" value="${/^\d{4}-\d{2}-\d{2}/.test(v) ? String(v).slice(0, 10) : ''}">`;
    else if (f.kind === 'list' || f.kind === 'bool') {
      const base = f.kind === 'bool' ? ['Так', 'Ні'] : (f.options || []);
      const opts = [...new Set([...base, ...(v && !base.includes(v) ? [v] : [])])];
      control = `<select id="${id}"><option value=""></option>${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`;
    } else if (f.kind === 'map') {
      control = `<select id="${id}"><option value=""></option>${[...f.options].map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select>`;
    } else if (f.kind === 'line' || f.kind === 'phone') control = `<input id="${id}" type="${f.kind === 'phone' ? 'tel' : 'text'}">`;
    else control = `<textarea id="${id}" rows="1"></textarea>`;
    wrap.innerHTML = `<label for="${id}"></label>${control}<p class="stage-hint"></p>`;
    wrap.querySelector('label').textContent = f.label;
    const el = wrap.querySelector('#' + id);
    if (f.kind !== 'date') el.value = f.kind === 'phone' ? (V.formatPhone(v) || '') : String(v);
    if (f.hint) { wrap.querySelector('.stage-hint').textContent = f.hint; wrap.classList.add(f.state || 'is-due'); }
    if (v !== '' && v != null) wrap.classList.add('is-done');
    el.addEventListener('change', () => f.onSave(el.value.trim(), el));
    if (el.tagName === 'TEXTAREA') {
      const grow = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
      el.addEventListener('input', grow); setTimeout(grow);
    }
    return wrap;
  }

  function sectionFields(sec) {
    const c = current, p = c.person; const { units, regions } = Persons.ctx();
    const out = [];
    ((PERSON_FIELDS[module] || {})[sec] || []).forEach(([key, label, type]) => {
      const kind = type === 'code' ? 'list' : type === 'date' ? 'date' : type === 'unit' || type === 'region' ? 'map' : type === 'phone' ? 'phone' : key === 'comment' ? 'text' : 'line';
      out.push({ id: 'p-' + key, label, kind, options: type === 'code' ? unitCodes() : type === 'unit' ? units : type === 'region' ? regions : null,
        value: p[key], onSave: (val, el) => savePerson(key, val, type, el) });
    });
    secDefs(sec).forEach((d) => {
      const v = c.vals[d.key] ?? ''; const f = { id: 's-' + d.key, label: d.label, kind: d.kind === 'text' ? 'text' : d.kind, options: d.options, value: v,
        onSave: (val) => saveValue(d.key, val) };
      if (d.remind_after && !v && c.vals[d.remind_after] && /^\d{4}-\d{2}-\d{2}/.test(c.vals[d.remind_after])) {
        const due = addDays(c.vals[d.remind_after].slice(0, 10), d.remind_days || 0);
        f.hint = `Потрібно до ${fmt(due)}`; f.state = due < today() ? 'is-overdue' : 'is-due';
      }
      out.push(f);
    });
    return out;
  }
  const isFilled = (f) => f.value !== '' && f.value != null;

  function renderStages() {
    const c = current;
    const secs = SECTIONS[module].filter(([k]) => k === 'family' || sectionFields(k).length);
    if (tab !== 'all' && !secs.some(([k]) => k === tab)) tab = 'all';
    const tabs = $('case-tabs'); tabs.innerHTML = '';
    const chip = (k, label, count, crit) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'qchip case-tab' + (crit ? ' qchip-crit' : ''); b.setAttribute('aria-pressed', String(k === tab));
      b.innerHTML = '<span></span> <b></b>'; b.firstChild.textContent = label; b.lastChild.textContent = count;
      b.onclick = () => { tab = k; renderStages(); };
      tabs.appendChild(b);
    };
    const all = secs.filter(([k]) => k !== 'family').flatMap(([k]) => sectionFields(k));
    chip('all', 'Усі розділи', `${all.filter(isFilled).length}/${all.length}`, false);
    secs.forEach(([k, label]) => {
      const fs = sectionFields(k);
      chip(k, label, k === 'family' ? String(c.kin.length) : `${fs.filter(isFilled).length}/${fs.length}`, fs.some((f) => f.state === 'is-overdue'));
    });
    const box = $('case-stages'); box.innerHTML = '';
    secs.filter(([k]) => tab === 'all' || k === tab).forEach(([k, label]) => {
      if (tab === 'all') { const h = document.createElement('h3'); h.className = 'case-sec-title'; h.textContent = label; box.appendChild(h); }
      if (k === 'family') box.appendChild(familyEl());
      const fs = sectionFields(k);
      const shown = fs.filter((f) => isFilled(f) || f.hint), hidden = fs.filter((f) => !isFilled(f) && !f.hint);
      if (shown.length) { const grid = document.createElement('div'); grid.className = 'case-stages'; shown.forEach((f) => grid.appendChild(fieldEl(f))); box.appendChild(grid); }
      if (hidden.length) {
        const det = document.createElement('details'); det.className = 'case-empty';
        det.open = (tab !== 'all' && !shown.length) || emptyOpen.has(k);
        det.innerHTML = `<summary>Незаповнені поля (${hidden.length}): ${esc(hidden.map((f) => f.label).join(', '))}</summary><div class="case-stages"></div>`;
        det.addEventListener('toggle', () => { det.open ? emptyOpen.add(k) : emptyOpen.delete(k); });
        hidden.forEach((f) => det.lastChild.appendChild(fieldEl(f)));
        box.appendChild(det);
      }
    });
    // Примітки — завжди на видноті
    const nb = $('case-notes'); nb.innerHTML = '';
    nb.appendChild(fieldEl({ id: 'p-comment', label: 'Примітки (з журналу й картки)', kind: 'text', value: c.person.comment, onSave: (val, el) => savePerson('comment', val, null, el) }));
  }
  const emptyOpen = new Set();

  // ---------- Родина у справі ----------
  function familyEl() {
    const c = current; const wrap = document.createElement('div'); wrap.className = 'case-fam';
    const contact = contactOf(c);
    if (!c.kin.length) wrap.innerHTML = '<p class="muted">Рідних ще не додано.</p>';
    c.kin.forEach((k) => {
      const row = document.createElement('div'); row.className = 'fam-row';
      row.innerHTML = `
        <button type="button" class="btn-link fam-name" title="Відкрити картку в реєстрі"></button>
        <label>Спорідненість<select data-f="deg">${OPT.relation_degree.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>
        <label>Телефон<input data-f="phone" type="tel"></label>
        <label>Населений пункт, адреса<input data-f="settlement"></label>
        <label class="fam-contact"><input type="radio" name="fam-contact"> контактна особа</label>`;
      const q = (f) => row.querySelector(`[data-f="${f}"]`);
      row.children[0].textContent = fio(k.person); row.children[0].onclick = () => openPerson(k.person.id);
      q('deg').value = k.relation_degree; q('phone').value = V.formatPhone(k.person.phone) || ''; q('settlement').value = k.person.settlement || '';
      const radio = row.querySelector('[type=radio]'); radio.checked = contact === k;
      radio.onchange = async () => { await saveCase({ contact_person_id: k.person.id }); renderHead(); };
      q('deg').onchange = async () => {
        const { error } = await db.from('military_relations').update({ relation_degree: q('deg').value }).eq('id', k.id);
        if (error) { console.error(error); Persons.toast('Не вдалося зберегти'); return; }
        k.relation_degree = q('deg').value; Persons.toast('Збережено'); renderHead();
      };
      q('phone').onchange = async () => {
        const ph = phoneOf(q('phone')); if (ph === undefined) return;
        if (await updPerson(k.person.id, { phone: ph })) { k.person.phone = ph; renderStages(); renderHead(); }
      };
      q('settlement').onchange = async () => {
        const v = q('settlement').value.trim() || null;
        if (await updPerson(k.person.id, { settlement: v })) k.person.settlement = v;
      };
      wrap.appendChild(row);
    });
    const add = document.createElement('details'); add.className = 'fam-add';
    add.innerHTML = `<summary>+ Додати родича</summary>
      <form class="fam-row" novalidate>
        <label>Прізвище<input name="ln" required></label><label>Ім’я<input name="fn" required></label><label>По батькові<input name="pn"></label>
        <label>Спорідненість<select name="deg">${OPT.relation_degree.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>
        <label>Телефон<input name="phone" type="tel"></label><label>Населений пункт, адреса<input name="st"></label>
        <button class="btn-primary btn-small" type="submit">Додати</button>
      </form>`;
    add.querySelector('form').onsubmit = (e) => { e.preventDefault(); addKin(e.target); };
    wrap.appendChild(add);
    return wrap;
  }

  async function updPerson(id, patch) {
    const { error } = await db.from('persons').update(patch).eq('id', id);
    if (error) {
      console.error(error);
      Persons.toast(error.code === '23505' ? 'Такий телефон уже є в іншій картці реєстру' : error.code === '23514' ? 'Значення не пройшло перевірку (дата чи формат)' : 'Не вдалося зберегти');
      return false;
    }
    Persons.toast('Збережено'); return true;
  }

  async function addKin(form) {
    const c = current, p = c.person; const g = (n) => form.elements[n].value.trim();
    if (!g('ln') || !g('fn')) { Persons.toast('Вкажіть прізвище та ім’я'); return; }
    if (badName(g('ln'), g('fn'), g('pn'))) return;
    const phv = phoneOf(form.elements.phone); if (phv === undefined) return;
    const ph = { value: phv };
    const btn = form.querySelector('button'); btn.disabled = true;
    try {
      const { data: np, error } = await db.from('persons').insert({
        last_name: nm(g('ln')), first_name: nm(g('fn')), patronymic: g('pn') ? nm(g('pn')) : null,
        phone: ph.value, settlement: g('st') || null, cell_id: c.cell_id, region_id: p.region_id || null, created_by: me, source: 'Вручну'
      }).select('id, last_name, first_name, patronymic, phone, settlement').single();
      if (error) { console.error(error); Persons.toast(error.code === '23505' ? 'Людина з таким телефоном уже є в реєстрі — додайте зв’язок у її картці' : 'Не вдалося додати родича'); return; }
      const progName = module === '200' ? 'Супровід родин загиблих (200)' : 'Супровід поранених (300)';
      const prog = [...Persons.ctx().programs].find(([, n]) => n === progName);
      if (prog) await db.from('person_programs').insert({ person_id: np.id, program_id: prog[0], role: 'linked' });
      const rel = {
        person_id: np.id, related_person_id: p.id, relation_degree: g('deg'), related_full_name: fio(p),
        related_status: OPT.related_status.includes(p.military_status) ? p.military_status : 'Невідомо', related_mp: 'Так',
        related_birth_date: p.birth_date, related_death_date: p.death_date, related_burial_date: p.burial_date,
        related_burial_place: p.burial_place, related_callsign: p.callsign, related_unit_id: p.mp_unit_id, related_unit_code: p.military_unit_code
      };
      const r2 = await db.from('military_relations').insert(rel).select('id, related_person_id, relation_degree, created_at').single();
      if (r2.error) { console.error(r2.error); Persons.toast('Картку створено, але зв’язок не записався — додайте його в картці родича'); return; }
      c.kin.push({ ...r2.data, person: np });
      if (module === '200' && c.status === 'Родину не встановлено' && statuses.some((s) => s.name === 'В роботі')) { await saveCase({ status: 'В роботі' }); $('case-status').value = 'В роботі'; }
      Persons.toast('Родича додано');
      renderHead(); renderStages();
    } finally { btn.disabled = false; }
  }

  async function savePerson(key, val, type, el) {
    const c = current, p = c.person; let v = val || null;
    if (type === 'phone') { v = phoneOf(el); if (v === undefined) return; }
    if (type === 'unit' || type === 'region') v = val ? Number(val) : null;
    if (['last_name', 'first_name', 'patronymic'].includes(key) && v && badName(v)) { el.value = p[key] || ''; return; }
    if ((key === 'last_name' || key === 'first_name')) { if (!v) { Persons.toast('Прізвище та ім’я обов’язкові'); el.value = p[key] || ''; return; } v = nm(v); }
    if (key === 'patronymic' && v) v = nm(v);
    const dd = key === 'death_date' ? v : p.death_date, bd = key === 'burial_date' ? v : p.burial_date;
    if ((key === 'burial_date' || key === 'death_date') && dd && bd && bd < dd) { Persons.toast('Дата поховання раніше дати загибелі — перевірте'); el.value = p[key] || ''; return; }
    if (!(await updPerson(p.id, { [key]: v }))) { renderStages(); return; }
    p[key] = v;
    renderHead(); if (key !== 'comment') renderStages(); loadHistory();
  }

  // ---------- Нова справа ----------
  function openNew() {
    const d = $('cab-new'); d.querySelector('form').reset();
    $('cab-new-title').textContent = module === '200' ? 'Нова справа 200 — загиблий' : 'Нова справа 300 — поранений';
    const sel = $('cab-new-cell'); sel.innerHTML = '<option value="">— не вказано —</option>';
    [...Persons.ctx().cells].forEach(([cid, n]) => sel.add(new Option(n, cid)));
    d.showModal();
  }
  async function submitNew(e) {
    e.preventDefault(); const f = e.target; const g = (n) => f.elements[n].value.trim();
    if (!g('ln') || !g('fn')) { Persons.toast('Вкажіть прізвище та ім’я'); return; }
    if (badName(g('ln'), g('fn'), g('pn'))) return;
    const full = [g('ln'), g('fn')].join(' ').toLowerCase();
    const dup = cases.find((c) => fio(c.person).toLowerCase().startsWith(full));
    if (dup && !confirm(`У кабінеті вже є справа ${dup.journal_id}: ${fio(dup.person)}. Усе одно створити нову?`)) return;
    const { data, error } = await db.rpc('create_case', { p_module: module, p_last: nm(g('ln')), p_first: nm(g('fn')),
      p_patr: g('pn') ? nm(g('pn')) : '', p_cell: g('cell') ? Number(g('cell')) : null });
    if (error) { console.error(error); Persons.toast('Не вдалося створити справу'); return; }
    $('cab-new').close();
    await load();
    openCase(data);
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
    renderHead(); renderStages();
    loadHistory();
  }

  async function saveCase(patch) {
    const c = current;
    const { error } = await db.from('cases').update(patch).eq('id', c.id);
    if (error) { console.error(error); Persons.toast('Не вдалося зберегти'); return; }
    Object.assign(c, patch);
    $('case-take').hidden = c.executor_id === me;
    if ('executor_id' in patch) renderHelpers();
    Persons.toast('Збережено');
    loadHistory();
  }

  async function loadHistory() {
    const c = current;
    const { data } = await db.from('case_history').select('*').eq('case_id', c.id).order('changed_at', { ascending: false }).limit(100);
    const label = new Map(defs.map((d) => [d.key, d.label]));
    label.set('status', 'Статус'); label.set('executor', 'Виконавець'); label.set('cell', 'Осередок');
    label.set('helpers', 'Допомагають'); label.set('responsible_staff', 'Відповідальний (по осередку)'); label.set('contact_person', 'Контактна особа');
    Object.entries(P_LABELS).forEach(([k, l]) => label.set(k, l));
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
    $('cab-set-title').textContent = `Поля справи — кабінет ${module}`;
    const keys = (data || []).map((d) => [d.key, d.label]);
    const row = (d) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input data-f="label"></td>
        <td><select data-f="section">${SECTIONS[module].filter(([k]) => k !== 'family' || module).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}<option value="head">Шапка (з журналу)</option></select></td>
        <td><select data-f="kind"><option value="text">текст</option><option value="date">дата</option><option value="list">список</option><option value="bool">так/ні</option></select></td>
        <td><input data-f="options" placeholder="через кому"></td>
        <td><select data-f="remind_after"><option value="">—</option>${keys.map(([k, l]) => `<option value="${k}">${l.replace(/</g, '&lt;')}</option>`).join('')}</select></td>
        <td><input data-f="remind_days" type="number" min="0" style="width:5rem"></td>
        <td><input data-f="sort" type="number" style="width:5rem"></td>
        <td><input data-f="active" type="checkbox"></td>
        <td><button type="button" class="btn-link" data-save>Зберегти</button></td>`;
      const q = (f) => tr.querySelector(`[data-f="${f}"]`);
      q('label').value = d.label || ''; q('kind').value = d.kind || 'text'; q('section').value = d.section || 'other';
      q('options').value = (d.options || []).join(', '); q('remind_after').value = d.remind_after || '';
      q('remind_days').value = d.remind_days ?? ''; q('sort').value = d.sort ?? 0; q('active').checked = d.active !== false;
      tr.querySelector('[data-save]').onclick = async () => {
        const rec = {
          module, label: q('label').value.trim(), kind: q('kind').value, section: q('section').value,
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
