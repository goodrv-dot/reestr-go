//@ Частина кабінету «Справа: відкриття, шапка, етапи, збереження».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Справа ----------
  const SECTIONS = {
    '200': [['person', 'Особа'], ['notice', 'Сповіщення'], ['family', 'Родина'], ['burial', 'Поховання'], ['support', 'Супровід'], ['awards', 'Нагороди і юридичне'], ['problems', 'Проблеми'], ['other', 'Інше']],
    '300': [['person', 'Особа'], ['treat', 'Лікування'], ['docs', 'Документи'], ['family', 'Родина'], ['problems', 'Проблеми'], ['other', 'Інше']],
    bzv: [['person', 'Особа'], ['notice', 'Сповіщення'], ['search', 'Пошук'], ['family', 'Родина'], ['problems', 'Проблеми'], ['other', 'Інше']],
    pol: [['person', 'Особа'], ['release', 'Звільнення'], ['treat', 'Реінтеграція і лікування'], ['docs', 'Документи'], ['family', 'Родина'], ['problems', 'Проблеми'], ['other', 'Інше']],
    vet: [['person', 'Особа'], ['state', 'Стан і інвалідність'], ['family', 'Родина'], ['problems', 'Проблеми'], ['other', 'Інше']]
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
    },
    bzv: {
      person: [['last_name', 'Прізвище'], ['first_name', 'Ім’я'], ['patronymic', 'По батькові'], ['callsign', 'Позивний'], ['birth_date', 'Дата народження', 'date'],
        ['military_unit_code', 'Військова частина', 'code'], ['mp_unit_id', 'Бригада', 'unit'], ['region_id', 'Регіон (область)', 'region']]
    },
    pol: {
      person: [['last_name', 'Прізвище'], ['first_name', 'Ім’я'], ['patronymic', 'По батькові'], ['callsign', 'Позивний'], ['birth_date', 'Дата народження', 'date'],
        ['phone', 'Номер телефону', 'phone'], ['military_unit_code', 'Військова частина', 'code'], ['mp_unit_id', 'Бригада', 'unit'], ['region_id', 'Регіон (область)', 'region']]
    },
    vet: {
      person: [['last_name', 'Прізвище'], ['first_name', 'Ім’я'], ['patronymic', 'По батькові'], ['callsign', 'Позивний'], ['birth_date', 'Дата народження', 'date'],
        ['phone', 'Номер телефону', 'phone'], ['military_unit_code', 'Військова частина', 'code'], ['mp_unit_id', 'Бригада', 'unit'], ['region_id', 'Регіон (область)', 'region'],
        ['settlement', 'Місце проживання']]
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
  // Телефони всередині тексту («черговий 050 123 45 67»): неправильний номер не зберігаємо
  function phonesInText(el) {
    const ex = V.extractPhones(el.value); const phones = ex.phones;
    // «схоже на телефон»: починається з +, 0, 380 чи 80 і має від 9 цифр (дати й номери наказів не чіпаємо)
    const bad = ex.bad.filter((r) => /^(\+|0|380|80)/.test(r.trim()) && r.replace(/\D/g, '').length >= 9);
    let hint = el.parentElement.querySelector('.field-err');
    if (!hint) { hint = document.createElement('span'); hint.className = 'field-err'; el.after(hint); }
    el.classList.toggle('is-bad', bad.length > 0);
    hint.textContent = bad.length ? `Невірний номер: ${bad.join(', ')} — не збережено. Приклад: 050 123 45 67, іноземний — з «+»` : (phones.map((p) => p.warning).filter((w) => w && /ноземн/.test(w))[0] || '');
    if (bad.length) { Persons.toast('Телефон введено з помилкою — не збережено'); el.focus(); return false; }
    return true;
  }
  const nm = (x) => V.normalizeName(x).value || null;
  const badName = (...xs) => { const e = xs.map((x) => V.normalizeName(x).error).find(Boolean); if (e) Persons.toast('ПІБ: ' + e); return !!e; };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const openPerson = (id) => { returnTo = current ? current.id : null; document.querySelector('.tab[data-tab="registry"]').click(); Persons.openForm(id); };
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
    keep('cab_case', c.journal_id);           // після F5 відкриємо цю ж справу
    if (isNew(c) || !seen.has(c.id)) { const at = new Date().toISOString(); seen.set(c.id, at); db.from('case_seen').upsert({ case_id: c.id, user_id: me, seen_at: at }, { onConflict: 'user_id,case_id' }).then(() => badge()); }
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
    cSel.disabled = !!acc().readOnly;   // осередок змінюють і оператори (у чужий — з підтвердженням)
    sSel.onchange = () => saveCase({ status: sSel.value });
    eSel.onchange = () => saveCase({ executor_id: eSel.value || null });
    rSel.onchange = () => saveCase({ responsible_id: rSel.value || null });
    cSel.onchange = () => saveCase({ cell_id: cSel.value ? Number(cSel.value) : null });
    $('case-take').onclick = () => { eSel.value = me; saveCase({ executor_id: me }); };
    renderHelpers();
    $('case-history-box').open = window.matchMedia('(min-width: 961px)').matches;   // на телефоні історію згорнуто
    const legacy = [c.vals.executor_legacy && `${ui().exec} — ${c.vals.executor_legacy}`, c.vals.responsible && `відповідальний — ${c.vals.responsible}`].filter(Boolean);
    $('case-legacy').textContent = legacy.length ? `Як було в журналі: ${legacy.join('; ')}` : '';
    renderHead();
    renderStages();
    loadHistory();
  }

  function renderHead() {
    const c = current, p = c.person;
    $('case-title').textContent = fio(p) + (p.callsign ? ` «${p.callsign}»` : '');
    const sub = $('case-sub');
    sub.textContent = `${c.journal_id} · ${ui().word}`;
    { const cr = createdOf(c); if (cr) sub.append(' · ' + cr.full); }
    if (p.death_date) { const d = document.createElement('b'); d.className = 'death-date'; d.textContent = `дата смерті ${fmt(p.death_date)}`; sub.append(' · ', d); }
    sub.append((p.burial_date ? ` · поховання ${fmt(p.burial_date)}` : '') +
      (p.wound_date ? ` · поранення ${fmt(p.wound_date)}` : '') + (c.next ? ` · далі: ${c.next.label}, ${dueText(c.next)}` : ''));
    $('case-take').hidden = c.executor_id === me;
    const box = $('case-contact'); const k = contactOf(c);
    // посилання на папку з документами (поле типу «посилання» з «Налаштування полів»)
    const docsLink = () => {
      const d = defs.find((x) => x.kind === 'link' && safeUrl(c.vals[x.key]));
      if (!d) return;
      const a = document.createElement('a');
      a.className = 'case-docs'; a.href = c.vals[d.key]; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '📁 Документи'; a.title = d.label;
      box.append(' · ', a);
    };
    if (!k) { box.innerHTML = '<span class="muted">Контактну особу не вказано — додайте рідних у розділі «Родина».</span>'; docsLink(); return; }
    box.innerHTML = '<span class="muted">Контактна особа:</span> <button type="button" class="btn-link case-contact-name" title="Відкрити картку в реєстрі"></button> <span class="muted"></span> <b class="case-phone"></b>';
    box.children[1].textContent = fio(k.person);
    box.children[1].onclick = () => openPerson(k.person.id);
    box.children[2].textContent = `(${k.relation_degree})`;
    box.children[3].textContent = k.person.phone ? V.formatPhone(k.person.phone) : 'без телефону';
    { const cl = callLink(k.person.phone); if (cl) box.children[3].after(' ', cl); }
    docsLink();
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
    current = null; keep('cab_case', null);
    if (!fromPop && history.state && history.state.view === 'case') history.back();
    render();
  }

  // Одне поле: {id,label,kind,options,value,hint,state,onSave}
  const safeUrl = (u) => /^https?:\/\/\S+$/i.test(String(u || '').trim());
  function fieldEl(f) {
    const wrap = document.createElement('div');
    wrap.className = 'stage' + (f.cls ? ' ' + f.cls : '') + (f.id.endsWith('p-death_date') ? ' is-death' : '');
    const id = 'cf-' + f.id; const v = f.value ?? '';
    let control;
    if (f.kind === 'date') control = `<input id="${id}" type="date" value="${/^\d{4}-\d{2}-\d{2}/.test(v) ? String(v).slice(0, 10) : ''}">`;
    else if (f.kind === 'list' || f.kind === 'bool') {
      const base = f.kind === 'bool' ? ['Так', 'Ні'] : (f.options || []);
      const opts = [...new Set([...base, ...(v && !base.includes(v) ? [v] : [])])];
      control = `<select id="${id}"><option value=""></option>${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`;
    } else if (f.kind === 'map') {
      control = `<select id="${id}"><option value=""></option>${[...f.options].map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select>`;
    } else if (f.kind === 'link') {
      control = `<span class="link-field"><input id="${id}" type="url" inputmode="url" placeholder="https://drive.google.com/…"><a class="link-open" target="_blank" rel="noopener" hidden>Відкрити ↗</a></span>`;
    } else if (f.kind === 'line' || f.kind === 'phone') control = `<input id="${id}" type="${f.kind === 'phone' ? 'tel' : 'text'}">`;
    else control = `<textarea id="${id}" rows="1"></textarea>`;
    wrap.innerHTML = `<label for="${id}"></label>${control}<p class="stage-hint"></p>`;
    wrap.querySelector('label').textContent = f.label;
    const el = wrap.querySelector('#' + id);
    if (f.kind !== 'date') el.value = f.kind === 'phone' ? (V.formatPhone(v) || '') : String(v);
    if (f.kind === 'link') { const a = wrap.querySelector('.link-open'); if (safeUrl(v)) { a.href = v; a.hidden = false; } }
    if (f.hint) { wrap.querySelector('.stage-hint').textContent = f.hint; wrap.classList.add(f.state || 'is-due'); }
    if (v !== '' && v != null) wrap.classList.add('is-done');
    if (f.kind === 'date') {
      // поки рік набирається («2» → 0002, «20» → 0020) браузер уже вважає дату повною — не зберігаємо, чекаємо 4 цифри
      const okYear = () => !el.value || Number(el.value.slice(0, 4)) >= 1900;
      el.addEventListener('change', () => { if (okYear()) f.onSave(el.value.trim(), el); });
      el.addEventListener('blur', () => {
        if (okYear()) return;
        Persons.toast('Рік має бути з чотирьох цифр, наприклад 2026');
        el.value = /^\d{4}-\d{2}-\d{2}/.test(v) ? String(v).slice(0, 10) : '';
      });
    } else el.addEventListener('change', () => f.onSave(el.value.trim(), el));
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
        onSave: (val, el) => {
          if (d.kind === 'link' && val && !safeUrl(val)) { Persons.toast('Вставте повне посилання, що починається з https://'); el.value = v; return; }
          if (/контакт/i.test(d.label) && !phonesInText(el)) return; saveValue(d.key, val);
        } };
      if (d.key === 'solutions' && !v && c.vals.problem_state === 'Вирішена') { f.hint = 'Проблему позначено «Вирішена» — опишіть, як вирішено'; f.state = 'is-due'; }
      if (d.key === 'problem_state' && !v && String(c.vals.problems || '').trim()) { f.hint = 'Оцініть стан проблеми'; f.state = 'is-due'; }
      if (!isClosed(c) && d.remind_after && !v && c.vals[d.remind_after] && /^\d{4}-\d{2}-\d{2}/.test(c.vals[d.remind_after])) {
        const due = addDays(c.vals[d.remind_after].slice(0, 10), d.remind_days || 0);
        f.hint = `Потрібно до ${fmt(due)}`; f.state = due < today() ? 'is-overdue' : 'is-due';
      }
      out.push(f);
    });
    return out;
  }
  const isFilled = (f) => f.value !== '' && f.value != null;

  // Після збереження поля справу перемальовуємо НЕ одразу, якщо оператор уже пише в іншому полі цієї справи:
  // інакше перемальовка стирала б набраний текст і збивала курсор («підвисання»). Перемальовуємо, щойно він вийде з полів.
  let stagesPending = false;
  const editingInCase = () => {
    const a = document.activeElement;
    return !!a && !$('cab-case').hidden && $('cab-case').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  };
  function refreshStages() {
    if (editingInCase()) { stagesPending = true; return; }
    stagesPending = false; renderStages();
  }
  function renderStages() {
    stagesPending = false;
    const c = current;
    const secs = SECTIONS[module].filter(([k]) => k === 'family' || sectionFields(k).length);
    if (tab !== 'all' && !secs.some(([k]) => k === tab)) tab = 'all';
    const tabs = $('case-tabs'); tabs.innerHTML = '';
    const chip = (k, label, count, crit) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'qchip case-tab sec-' + k + (crit ? ' qchip-crit' : ''); b.setAttribute('aria-pressed', String(k === tab));
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
      if (tab === 'all') { const h = document.createElement('h3'); h.className = 'case-sec-title sec-' + k; h.textContent = label; box.appendChild(h); }
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
    renderMissing(secs);
    renderSummary(secs);
    // Примітки — завжди на видноті
    const nb = $('case-notes'); nb.innerHTML = '';
    nb.appendChild(fieldEl({ id: 'p-comment', label: 'Примітки (з журналу й картки)', kind: 'text', value: c.person.comment, onSave: (val, el) => savePerson('comment', val, null, el) }));
  }
  const emptyOpen = new Set();

