//@ Частина кабінету «Нова справа».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Нова справа ----------
  function openNew() {
    const d = $('cab-new'); d.querySelector('form').reset();
    $('cab-new-title').textContent = ui().newTitle;
    const sel = $('cab-new-cell'); sel.innerHTML = '<option value="">— не вказано —</option>';
    const A = acc();
    if (!isAdmin) sel.innerHTML = '';
    [...Persons.ctx().cells].filter(([cid]) => isAdmin || A.cells.includes(cid)).forEach(([cid, n]) => sel.add(new Option(n, cid)));
    if (!isAdmin && !sel.options.length) { Persons.toast('Вам не призначено жодного осередку — зверніться до адміністратора'); return; }
    d.showModal();
  }
  // адміністратору: коли Google-дзеркало оновлювалось і чи без помилок
  async function mirrorStatus() {
    const el = $('cab-mirror'); if (!el) return;
    const { data } = await db.rpc('mirror_status');
    if (!data || !(data.sheet_200 || data.sheet_300 || data.sheet_bzv || data.sheet_pol || data.sheet_vet)) return;
    const t = data.last_write ? new Date(data.last_write).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    const bad = /^помилка/.test(data.last_status || '');
    el.innerHTML = '';
    el.append(bad ? '⚠ Google-дзеркало: помилка · ' : `Google-дзеркало: оновлено ${t} · `);
    // кожен модуль — своя таблиця; якщо таблиця спільна — одне посилання
    const links = [];
    [['200', data.sheet_200], ['300', data.sheet_300], ['БЗВ', data.sheet_bzv], ['Звільнені з полону', data.sheet_pol], ['Ветерани', data.sheet_vet]]
      .forEach(([label, id]) => { if (!id) return; const same = links.find((l) => l[1] === id); if (same) same[0] += ' / ' + label; else links.push([label, id]); });
    links.forEach(([label, id], i) => {
      if (i) el.append(' · ');
      const a = document.createElement('a');
      a.href = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`; a.target = '_blank'; a.rel = 'noopener'; a.textContent = label;
      el.append(a);
    });
    // джерело анкет «Діти» (Google Форма) — не дзеркало, лише для зручності
    if (data.sheet_kids) {
      const a = document.createElement('a');
      a.href = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(data.sheet_kids)}/edit`; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'анкети «Діти»';
      el.append(' · ', a);
    }
    // резервна копія бази
    const bkBad = /^помилка/.test(data.backup_status || '');
    const bk = data.backup_last ? new Date(data.backup_last).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
    el.append(bk && !bkBad ? ` · копія бази: ${bk}` : ' · копія бази: ⚠ не налаштована');
    el.title = [data.last_status, data.backup_status].filter(Boolean).join('\n');
    el.classList.toggle('is-bad', bad); el.hidden = false;
  }

  let creating = false;
  async function submitNew(e) {
    e.preventDefault(); const f = e.target; const g = (n) => f.elements[n].value.trim();
    if (!g('ln') || !g('fn')) { Persons.toast('Вкажіть прізвище та ім’я'); return; }
    if (badName(g('ln'), g('fn'), g('pn'))) return;
    // двійники: база шукає серед УСІХ справ модуля (і завершених, і чужих осередків) — повертає лише номери справ
    let dups = [];
    { const r = await db.rpc('find_case_duplicates', { p_module: module, p_last: nm(g('ln')), p_first: nm(g('fn')), p_patr: g('pn') ? nm(g('pn')) : '' });
      if (!r.error) dups = r.data || [];
      else { const full = [g('ln'), g('fn')].join(' ').toLowerCase(); dups = cases.filter((c) => fio(c.person).toLowerCase().startsWith(full)).map((c) => c.journal_id); } }
    if (dups.length && !confirm(`Справа з таким ПІБ уже є: ${dups.join(', ')}.\n\nСкоріше за все, це та сама людина — відкрийте наявну справу (пошук за номером), а не створюйте нову.\n\nСтворити ще одну справу все одно (лише якщо це точно інша людина — повний тезка)?`)) return;
    // одне натискання — одна справа: кнопка блокується до відповіді сервера
    if (creating) return;
    creating = true;
    const btn = f.querySelector('button[type="submit"]'); const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Створюємо…';
    let data, error;
    try {
      ({ data, error } = await db.rpc('create_case', { p_module: module, p_last: nm(g('ln')), p_first: nm(g('fn')),
        p_patr: g('pn') ? nm(g('pn')) : '', p_cell: g('cell') ? Number(g('cell')) : null }));
    } finally { creating = false; btn.disabled = false; btn.textContent = label; }
    if (error) { console.error(error); Persons.toast(/Немає доступу/.test(error.message || '') ? 'Немає доступу до цього осередку' : 'Не вдалося створити справу'); return; }
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
    renderHead(); refreshStages();
    loadHistory();
  }

  async function saveCase(patch) {
    const c = current;
    let error;
    if ('cell_id' in patch && !isAdmin) {
      // осередок оператор змінює сам (через базу — з перевіркою доступу); у чужий осередок — після підтвердження
      const mine = (acc().cells || []).includes(patch.cell_id);
      if (patch.cell_id && !mine && !confirm(`Передати справу в осередок «${Persons.ctx().cells.get(patch.cell_id) || ''}»?\n\nЦе не ваш осередок — після передачі справа зникне з вашого кабінету.`)) {
        $('case-cell').value = c.cell_id || ''; renderHead(); return false;
      }
      ({ error } = await db.rpc('set_case_cell', { p_case: c.id, p_cell: patch.cell_id }));
      const rest = { ...patch }; delete rest.cell_id;
      if (!error && Object.keys(rest).length) ({ error } = await db.from('cases').update(rest).eq('id', c.id));
      if (!error && patch.cell_id && !mine) { Object.assign(c, patch); cases = cases.filter((x) => x.id !== c.id); Persons.toast('Справу передано в інший осередок'); closeCase(); load(); return; }
    } else ({ error } = await db.from('cases').update(patch).eq('id', c.id));
    if (error) { console.error(error); Persons.toast('Не вдалося зберегти' + (error.message && /осередок|доступу|перегляд/.test(error.message) ? ': ' + error.message : '')); return; }
    Object.assign(c, patch);
    if ('status' in patch) { c.next = nextAction(c); renderHead(); refreshStages(); }
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

