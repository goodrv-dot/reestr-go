//@ Частина кабінету «Зведення справи (усі поля дрібно)».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Зведення справи: усі поля дрібно, порожні підсвічені, правка на місці ----------
  const CRIT = new Set(['p-last_name', 'p-first_name', 'p-birth_date', 'p-death_date', 'p-wound_date', 'p-military_unit_code', 'p-mp_unit_id', 's-notice_date', 's-rank', 's-appeal_date']);
  function showVal(f) {
    if (!isFilled(f)) return '—';
    if (f.kind === 'date') return fmt(String(f.value));
    if (f.kind === 'map') return f.options.get(Number(f.value)) || f.options.get(f.value) || String(f.value);
    if (f.kind === 'phone') return V.formatPhone(f.value) || String(f.value);
    if (f.kind === 'link') return 'посилання ✓';
    return String(f.value);
  }
  // Підказки вгорі справи: що не заповнено (як «Стан картки» в реєстрі)
  function renderMissing(secs) {
    const c = current; const box = $('case-missing'); box.innerHTML = '';
    const k = contactOf(c); const crit = [], soft = [];
    const top = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    const goField = (key, f) => () => {
      tab = 'all'; emptyOpen.add(key); renderStages();
      const el = document.getElementById('cf-' + f.id); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
    };
    const goFamily = () => { tab = 'family'; renderStages(); $('case-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' }); const d = document.querySelector('.fam-add'); if (d && !c.kin.length) d.open = true; };
    if (!c.status) crit.push(['Статус', top]);
    if (!c.executor_id) crit.push(['Виконавець', top]);
    if (!c.cell_id) crit.push(['Осередок', top]);
    if (!k) crit.push(['Контактна особа (рідних не додано)', goFamily]);
    else if (!k.person.phone) crit.push(['Телефон контактної особи', goFamily]);
    secs.filter(([key]) => key !== 'family').forEach(([key]) => sectionFields(key).forEach((f) => {
      if (f.state === 'is-overdue') crit.push([`${f.label} — прострочено`, goField(key, f)]);
      else if (!isFilled(f)) (CRIT.has(f.id) ? crit : soft).push([f.label, goField(key, f)]);
    }));
    const line = (cls, title, items) => {
      if (!items.length) return;
      const p = document.createElement('p'); p.className = 'miss ' + cls;
      const b = document.createElement('b'); b.textContent = title; p.appendChild(b);
      items.forEach(([label, go]) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'miss-chip'; x.textContent = label; x.onclick = go; p.append(' ', x); });
      box.appendChild(p);
    };
    line('miss-crit', `Потрібно заповнити (${crit.length}):`, crit);
    if (soft.length) {
      const det = document.createElement('details'); det.className = 'miss miss-soft';
      det.innerHTML = '<summary></summary>'; det.firstChild.textContent = `Бажано заповнити (${soft.length})`;
      soft.forEach(([label, go]) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'miss-chip'; x.textContent = label; x.onclick = go; det.append(' ', x); });
      det.open = missOpen; det.addEventListener('toggle', () => { missOpen = det.open; });
      box.appendChild(det);
    }
    if (!crit.length && !soft.length) { const p = document.createElement('p'); p.className = 'miss miss-ok'; p.textContent = 'Усе заповнено.'; box.appendChild(p); }
  }
  let missOpen = false;

  // Після зміни з «Зведення» — оновити шапку, списки вгорі й обидва подання
  function syncAll() {
    const c = current;
    $('case-status').value = c.status || ''; $('case-exec').value = c.executor_id || '';
    $('case-resp').value = c.responsible_id || ''; $('case-cell').value = c.cell_id || '';
    renderHelpers(); renderHead(); renderStages();
  }
  function renderSummary(secs) {
    const c = current; const box = $('case-summary'); box.innerHTML = '';
    let empty = 0, crit = 0;
    const group = (title, key) => { const g = document.createElement('div'); g.className = 'sum-group sec-' + key; g.innerHTML = '<h3></h3><div class="sum-grid"></div>'; g.firstChild.textContent = title; box.appendChild(g); return g.lastChild; };
    // Клітинка: f = {id,label,kind,options,value,onSave}; state: '' | soft | crit (коли порожня); custom — власний редактор
    const add = (grid, f, level, custom) => {
      const filled = f.text !== undefined ? !!f.text : isFilled(f);
      const state = filled ? '' : level === 'crit' ? 'is-crit' : 'is-empty';
      if (!filled) { empty++; if (level === 'crit') crit++; }
      const d = document.createElement('div'); d.className = 'sum-cell' + (state ? ' ' + state : '') + (f.wide ? ' sum-wide' : '') + (f.id === 'p-death_date' ? ' is-death' : '');
      d.innerHTML = '<span class="sum-l"></span><span class="sum-v"></span>';
      d.firstChild.textContent = f.label; d.lastChild.textContent = f.text !== undefined ? (f.text || '—') : showVal(f);
      if (f.text === undefined && isFilled(f)) {   // 📞 біля телефонів (і телефонів у тексті)
        if (f.kind === 'phone') { const cl = V.callLink(f.value); if (cl) d.lastChild.after(' ', cl); }
        else if (f.kind === 'line' || f.kind === 'text') d.append(V.callLinks(String(f.value)));
      }
      if (f.readonly || (window.ACCESS && window.ACCESS.readOnly)) { d.classList.add('is-ro'); grid.appendChild(d); return d; }
      const open = () => {
        if (d.classList.contains('is-edit')) return;
        if (custom) { custom(d); return; }
        d.classList.add('is-edit'); d.lastChild.remove();
        const ed = fieldEl({ ...f, id: 'sum-' + f.id, hint: null }); ed.className = 'sum-edit';
        d.appendChild(ed);
        const inp = ed.querySelector('input, select, textarea'); inp.focus();
        inp.addEventListener('blur', () => setTimeout(() => { if (current === c && !inp.classList.contains('is-bad') && document.activeElement !== inp) renderSummary(secs); }, 250));
      };
      d.tabIndex = 0; d.title = 'Натисніть, щоб змінити'; d.onclick = open;
      d.onkeydown = (e) => { if (e.key === 'Enter' && e.target === d) open(); };
      grid.appendChild(d); return d;
    };
    const k = contactOf(c); const cells = Persons.ctx().cells;
    const save = (patch) => async () => { await saveCase(patch()); syncAll(); };
    // ---- Справа
    const head = group('Справа', 'head');
    add(head, { id: 'h-status', label: 'Статус', kind: 'list', options: statuses.map((x) => x.name), value: c.status, onSave: (v) => { if (v) saveCase({ status: v }).then(syncAll); } }, 'crit');
    add(head, { id: 'h-exec', label: 'Виконавець', kind: 'map', options: staff, value: c.executor_id, onSave: (v) => saveCase({ executor_id: v || null }).then(syncAll) }, 'crit');
    add(head, { id: 'h-help', label: 'Допомагають', text: (c.helper_ids || []).map((u) => staff.get(u)).filter(Boolean).join(', ') }, 'soft', (d) => {
      d.classList.add('is-edit'); d.lastChild.remove();
      const w = document.createElement('div'); w.className = 'sum-checks';
      [...staff].filter(([uid]) => uid !== c.executor_id).forEach(([uid, n]) => {
        const l = document.createElement('label'); l.innerHTML = '<input type="checkbox"> <span></span>'; l.lastChild.textContent = n;
        l.firstChild.checked = (c.helper_ids || []).includes(uid);
        l.firstChild.onchange = () => { const set = new Set(c.helper_ids || []); l.firstChild.checked ? set.add(uid) : set.delete(uid); saveCase({ helper_ids: [...set] }).then(() => { renderHelpers(); }); };
        w.appendChild(l);
      });
      const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn-link'; ok.textContent = 'Готово'; ok.onclick = (e) => { e.stopPropagation(); renderSummary(secs); };
      w.appendChild(ok); d.appendChild(w);
    });
    add(head, { id: 'h-resp', label: 'Відповідальний (по осередку)', kind: 'map', options: staff, value: c.responsible_id, onSave: (v) => saveCase({ responsible_id: v || null }).then(syncAll) }, 'soft');
    add(head, { id: 'h-cell', label: 'Осередок', kind: 'map', options: cells, value: c.cell_id, readonly: !!acc().readOnly, onSave: (v) => saveCase({ cell_id: v ? Number(v) : null }).then(syncAll) }, 'crit');
    add(head, { id: 'h-contact', label: 'Контактна особа', kind: 'map', options: new Map(c.kin.map((x) => [x.person.id, `${fio(x.person)} (${x.relation_degree})`])), value: k ? k.person.id : '',
      readonly: !c.kin.length, onSave: (v) => { if (v) saveCase({ contact_person_id: v }).then(syncAll); } }, 'crit');
    // ---- розділи
    secs.forEach(([key, label]) => {
      const grid = group(label, key);
      if (key === 'family') {
        c.kin.forEach((x, i) => {
          const n = c.kin.length > 1 ? ` ${i + 1}` : '';
          add(grid, { id: 'k-n' + i, label: 'Родич' + n, text: fio(x.person) }, 'soft', () => openPerson(x.person.id));
          add(grid, { id: 'k-d' + i, label: 'Спорідненість' + n, kind: 'list', options: OPT.relation_degree, value: x.relation_degree, onSave: async (v) => {
            if (!v) return; const { error } = await db.from('military_relations').update({ relation_degree: v }).eq('id', x.id);
            if (error) { console.error(error); Persons.toast('Не вдалося зберегти'); return; } x.relation_degree = v; Persons.toast('Збережено'); syncAll(); } }, 'soft');
          add(grid, { id: 'k-p' + i, label: 'Телефон' + n, kind: 'phone', value: x.person.phone, onSave: async (v, el) => {
            const ph = phoneOf(el); if (ph === undefined) return; if (await updPerson(x.person.id, { phone: ph })) { x.person.phone = ph; syncAll(); } } }, x === k ? 'crit' : 'soft');
          add(grid, { id: 'k-s' + i, label: 'Населений пункт, адреса' + n, kind: 'line', value: x.person.settlement, onSave: async (v) => {
            if (await updPerson(x.person.id, { settlement: v || null })) { x.person.settlement = v || null; syncAll(); } } }, 'soft');
        });
        add(grid, { id: 'k-add', label: 'Рідні', text: c.kin.length ? '+ додати ще родича' : '' }, c.kin.length ? 'soft' : 'crit', () => {
          tab = 'family'; renderStages(); $('case-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
          const det = document.querySelector('.fam-add'); if (det) { det.open = true; const i = det.querySelector('input'); if (i) i.focus({ preventScroll: true }); }
        });
        if (!c.kin.length) grid.lastChild.querySelector('.sum-v').textContent = 'не додано — натисніть, щоб додати';
      }
      sectionFields(key).forEach((f) => add(grid, f, CRIT.has(f.id) || f.state === 'is-overdue' ? 'crit' : 'soft'));
    });
    // ---- Примітки
    add(group('Примітки', 'notes'), { id: 'p-comment', label: 'Примітки (з журналу й картки)', kind: 'text', value: c.person.comment, wide: true, onSave: (val, el) => savePerson('comment', val, null, el).then(() => refreshStages()) }, 'soft');
    $('case-summary-note').textContent = (empty
      ? `Незаповнено: ${empty}` + (crit ? `, з них важливих: ${crit} (червоні)` : '') + '.'
      : 'Усе заповнено.') + ' Натисніть на будь-яке поле, щоб заповнити чи виправити — зберігається одразу.';
  }

