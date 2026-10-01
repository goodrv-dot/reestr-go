// ============================================================
// Фільтри реєстру (ТЗ, розділ 8.1).
// Між різними фільтрами — «І»; всередині одного фільтра з кількома
// варіантами — «АБО» (наприклад, УБД або Учасник війни).
// ============================================================
window.Filters = (() => {
  let defs = [];
  let onChange = () => {};
  const $ = (id) => document.getElementById(id);

  function buildDefs({ regions, cells, programs }) {
    const toOpts = (m) => [...m].map(([id, name]) => ({ value: String(id), label: name }));
    const regionOpts = toOpts(regions);
    const o = (arr) => arr.map((v) => ({ value: v, label: v }));
    return [
      { group: 'Стан картки' },
      { key: 'quality', label: 'Потребує доповнення', type: 'select', options: [
        { value: 'crit', label: 'Є критичні' },
        { value: 'warn', label: 'Лише бажані' },
        { value: 'ok', label: 'Все заповнено' }] },
      { key: 'program_ids', label: 'Програми ГО', type: 'multi', op: 'overlaps', options: toOpts(programs) },
      { key: 'cell_id', label: 'Осередок ГО', type: 'multi', op: 'in', options: toOpts(cells) },

      { group: 'Категорії' },
      { key: 'person_categories', label: 'Категорія особи', type: 'multi', op: 'overlaps', options: o(OPT.person_categories) },
      { key: 'family_categories', label: 'Категорія родини', type: 'multi', op: 'overlaps', options: o(OPT.family_categories) },
      { key: 'military_status', label: 'Поточний статус особи', type: 'multi', op: 'in', options: o(OPT.military_status) },
      { key: 'veteran_statuses', label: 'Статус ветерана війни', type: 'multi', op: 'overlaps', options: o(OPT.veteran_statuses) },

      { group: 'Інвалідність і Морська піхота' },
      { key: 'has_disability', label: 'Інвалідність', type: 'multi', op: 'in', options: o(OPT.yes_no_unknown) },
      { key: 'disability_group', label: 'Група інвалідності', type: 'multi', op: 'in', options: o(OPT.disability_group) },
      { key: 'disability_war_related', label: 'Інвалідність через війну', type: 'multi', op: 'in', options: o(OPT.disability_war_related) },
      { key: 'mp_relation', label: 'Особисте відношення до МП', type: 'multi', op: 'in', options: o(OPT.yes_no_unknown) },
      { key: 'mp_family_link', label: 'Родинний зв’язок з МП', type: 'bool' },
      { key: 'wounded', label: 'Поранення', type: 'multi', op: 'in', options: o(OPT.yes_no_unknown) },

      { group: 'Вік і діти' },
      { key: 'age', label: 'Вік особи', type: 'range' },
      { key: 'has_minor_children', label: 'Є неповнолітні діти', type: 'bool' },
      { key: 'child_age', label: 'Є дитина віком', type: 'range' },
      { key: 'children_interests', label: 'Інтереси дітей', type: 'multi', op: 'overlaps', options: o(OPT.child_interests) },

      { group: 'Проживання і розсилки' },
      { key: 'region_id', label: 'Область', type: 'multi', op: 'in', options: regionOpts },
      { key: 'is_idp', label: 'ВПО', type: 'multi', op: 'in', options: o(OPT.yes_no_unknown) },
      { key: 'vkmpu_member', label: 'Член ВКМПУ', type: 'bool' },
      { key: 'preferred_messenger', label: 'Бажаний месенджер', type: 'multi', op: 'in', options: o(OPT.messengers) },
      { key: 'has_phone', label: 'Є телефон', type: 'bool' },
      { key: 'consent_messages', label: 'Згода на повідомлення', type: 'bool' },
      { key: 'unsubscribed', label: 'Відписався', type: 'bool' }
    ];
  }

  // ---------- Побудова панелі ----------
  function init(regions, changeHandler) {
    onChange = changeHandler;
    defs = buildDefs(regions);
    const panel = $('filters-panel');
    panel.innerHTML = '';
    let grid = null;

    defs.forEach((d) => {
      if (d.group) {
        const h = document.createElement('p');
        h.className = 'filter-group';
        h.textContent = d.group;
        panel.appendChild(h);
        grid = document.createElement('div');
        grid.className = 'filter-grid';
        panel.appendChild(grid);
        return;
      }
      grid.appendChild(buildControl(d));
    });

    const actions = document.createElement('div');
    actions.className = 'filter-actions';
    actions.innerHTML = '<button type="button" class="btn-secondary btn-small" id="filters-reset">Скинути всі фільтри</button>';
    panel.appendChild(actions);

    $('filters-reset').addEventListener('click', reset);

    // Відкритий може бути лише один список; клік поза ним — закрити
    panel.addEventListener('toggle', (e) => {
      if (e.target.open) panel.querySelectorAll('details.ms[open]').forEach((d) => { if (d !== e.target) d.open = false; });
    }, true);
    document.addEventListener('click', (e) => {
      if (!e.target.closest('details.ms')) panel.querySelectorAll('details.ms[open]').forEach((d) => { d.open = false; });
    });
    $('filters-toggle').addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      $('filters-toggle').setAttribute('aria-expanded', String(open));
    });
  }

  function buildControl(d) {
    const wrap = document.createElement('div');
    wrap.className = 'filter';
    wrap.dataset.key = d.key;

    if (d.type === 'multi') {
      const det = document.createElement('details');
      det.className = 'ms';
      const sum = document.createElement('summary');
      sum.innerHTML = `<span class="ms-label"></span><span class="ms-value">Усі</span>`;
      sum.querySelector('.ms-label').textContent = d.label;
      det.appendChild(sum);
      const list = document.createElement('div');
      list.className = 'ms-list';
      d.options.forEach((opt) => {
        const l = document.createElement('label');
        l.className = 'check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = opt.value;
        l.append(cb, ' ' + opt.label);
        list.appendChild(l);
      });
      det.appendChild(list);
      list.addEventListener('change', () => { updateSummary(wrap); changed(); });
      wrap.appendChild(det);
    }

    if (d.type === 'bool') {
      const id = 'flt-' + d.key;
      wrap.innerHTML = `<label class="filter-label" for="${id}"></label>
        <select id="${id}"><option value="">Будь-яке</option><option value="true">Так</option><option value="false">Ні</option></select>`;
      wrap.querySelector('label').textContent = d.label;
      wrap.querySelector('select').addEventListener('change', changed);
    }

    if (d.type === 'select') {
      const id = 'flt-' + d.key;
      wrap.innerHTML = `<label class="filter-label" for="${id}"></label><select id="${id}"><option value="">Будь-яке</option></select>`;
      wrap.querySelector('label').textContent = d.label;
      const sel = wrap.querySelector('select');
      d.options.forEach((opt) => sel.add(new Option(opt.label, opt.value)));
      sel.addEventListener('change', changed);
    }

    if (d.type === 'range') {
      const id = 'flt-' + d.key;
      wrap.innerHTML = `<span class="filter-label" id="${id}-l"></span>
        <div class="range">
          <input type="number" min="0" max="120" placeholder="від" aria-labelledby="${id}-l" data-r="from">
          <span aria-hidden="true">–</span>
          <input type="number" min="0" max="120" placeholder="до" aria-labelledby="${id}-l" data-r="to">
          <span class="muted">років</span>
        </div>`;
      wrap.querySelector('.filter-label').textContent = d.label;
      wrap.querySelectorAll('input').forEach((i) => i.addEventListener('input', changed));
    }
    return wrap;
  }

  function updateSummary(wrap) {
    const checked = wrap.querySelectorAll('.ms-list input:checked');
    const val = wrap.querySelector('.ms-value');
    val.textContent = !checked.length ? 'Усі'
      : checked.length === 1 ? checked[0].parentElement.textContent.trim()
      : `Обрано: ${checked.length}`;
    wrap.classList.toggle('is-active', checked.length > 0);
  }

  let timer = null;
  function changed() {
    const n = activeCount();
    $('filters-count').textContent = n ? String(n) : '';
    $('filters-count').hidden = !n;
    clearTimeout(timer);
    timer = setTimeout(onChange, 350);
  }

  // ---------- Поточні значення ----------
  function values() {
    const out = {};
    defs.filter((d) => d.key).forEach((d) => {
      const wrap = document.querySelector(`.filter[data-key="${d.key}"]`);
      if (d.type === 'multi') {
        const v = [...wrap.querySelectorAll('.ms-list input:checked')].map((c) => c.value);
        if (v.length) out[d.key] = v;
      } else if (d.type === 'bool') {
        const v = wrap.querySelector('select').value;
        if (v) out[d.key] = v === 'true';
      } else if (d.type === 'select') {
        const v = wrap.querySelector('select').value;
        if (v) out[d.key] = v;
      } else if (d.type === 'range') {
        const from = wrap.querySelector('[data-r="from"]').value;
        const to = wrap.querySelector('[data-r="to"]').value;
        if (from !== '' || to !== '') out[d.key] = { from: from === '' ? null : Number(from), to: to === '' ? null : Number(to) };
      }
    });
    return out;
  }

  function activeCount() { return Object.keys(values()).length; }

  function reset() {
    document.querySelectorAll('#filters-panel .ms-list input').forEach((c) => { c.checked = false; });
    document.querySelectorAll('#filters-panel .filter').forEach((w) => { if (w.querySelector('.ms-value')) updateSummary(w); });
    document.querySelectorAll('#filters-panel select').forEach((s) => { s.value = ''; });
    document.querySelectorAll('#filters-panel .range input').forEach((i) => { i.value = ''; });
    changed();
  }

  // ---------- Застосування до запиту Supabase ----------
  // Повертає { query } — обгортка потрібна, бо запит Supabase «thenable»:
  // якщо повернути його напряму з async-функції, він одразу виконається.
  // Фільтр за віком дитини потребує окремого запиту до таблиці children.
  async function apply(query, db, skip = []) {
    const v = values();
    skip.forEach((k) => delete v[k]);
    const NONE = '00000000-0000-0000-0000-000000000000';

    for (const d of defs) {
      if (!d.key || !(d.key in v)) continue;
      const val = v[d.key];

      if (d.key === 'quality') {
        if (val === 'crit') query = query.gt('critical_count', 0);
        if (val === 'warn') query = query.eq('critical_count', 0).gt('warning_count', 0);
        if (val === 'ok') query = query.eq('critical_count', 0).eq('warning_count', 0);
      } else if (d.key === 'has_phone') {
        query = val ? query.not('phone', 'is', null) : query.is('phone', null);
      } else if (d.key === 'age') {
        if (val.from !== null) query = query.gte('age', val.from);
        if (val.to !== null) query = query.lte('age', val.to);
      } else if (d.key === 'child_age') {
        const ids = await personsWithChildAge(db, val.from ?? 0, val.to ?? 17);
        query = query.in('id', ids.length ? ids : [NONE]);
      } else if (d.type === 'bool') {
        query = query.eq(d.key, val);
      } else if (d.op === 'overlaps') {
        query = query.overlaps(d.key, d.key === 'program_ids' ? val.map(Number) : val);
      } else if (d.op === 'in') {
        query = query.in(d.key, ['region_id', 'cell_id'].includes(d.key) ? val.map(Number) : val);
      }
    }
    return { query };
  }

  // Діти віком від..до повних років: дата народження у проміжку
  async function personsWithChildAge(db, from, to) {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    const latest = new Date(today); latest.setFullYear(today.getFullYear() - from);       // щонайменше from років
    const earliest = new Date(today); earliest.setFullYear(today.getFullYear() - to - 1); // ще немає to+1 років
    const { data, error } = await db.from('children')
      .select('person_id')
      .lte('birth_date', iso(latest))
      .gt('birth_date', iso(earliest));
    if (error) throw error;
    return [...new Set(data.map((r) => r.person_id))];
  }

  // Людський опис активних фільтрів: ['Програми ГО: …', 'Є дитина віком: від 6 до 14 років', …]
  function describe() {
    const v = values();
    const out = [];
    defs.forEach((d) => {
      if (!d.key || !(d.key in v)) return;
      const val = v[d.key];
      let text = '';
      if (d.type === 'multi') text = val.map((x) => (d.options.find((o) => o.value === x) || {}).label || x).join(', ');
      else if (d.type === 'bool') text = val ? 'Так' : 'Ні';
      else if (d.type === 'select') text = (d.options.find((o) => o.value === val) || {}).label || val;
      else if (d.type === 'range') {
        text = [val.from !== null ? `від ${val.from}` : '', val.to !== null ? `до ${val.to}` : ''].filter(Boolean).join(' ') + ' років';
      }
      out.push(`${d.label}: ${text}`);
    });
    return out;
  }

  // Швидкий фільтр за станом картки (кнопки над таблицею)
  function setQuality(val) {
    const sel = document.getElementById('flt-quality');
    if (!sel) return;
    sel.value = val;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function getQuality() {
    const sel = document.getElementById('flt-quality');
    return sel ? sel.value : '';
  }

  return { init, apply, activeCount, reset, describe, setQuality, getQuality };
})();
