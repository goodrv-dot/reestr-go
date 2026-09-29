// ============================================================
// Імпорт з Excel (ТЗ, розділ 6.4).
// Порядок: файл → шаблон → розбір і перевірка → попередній перегляд
// 🟢 нові / 🔵 доповнення наявних / 🟡 перевірити / 🔴 помилки → імпорт пакетом.
// ============================================================
window.Importer = (() => {
  const $ = (id) => document.getElementById(id);
  let records = [];      // підготовлені записи
  let fileName = '';
  let template = null;
  let rawRows = [];      // рядки файлу (для файлу помилок)
  let header = [];

  // ---------- Допоміжне ----------
  const clean = (v) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());
  const letters = (s) => clean(s).toLowerCase().replace(/[^a-zа-яіїєґ’']/gi, '');
  const pad = (n) => String(n).padStart(2, '0');

  // Дата з Excel: число (серійний номер), Date або текст «31.01.2013», «08,11.2021», «2013-01-31»
  function toDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v);
      return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
    }
    if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    const s = clean(v);
    let m = s.match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{4})/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }

  // «Прізвище Ім’я По батькові» → частини
  function splitFio(raw) {
    const n = V.normalizeName(raw, true);
    if (n.error) return { error: n.error === 'Обов’язкове поле' ? 'Немає ПІБ' : 'ПІБ: ' + n.error.toLowerCase() };
    const parts = n.value.split(' ');
    if (parts.length < 2) return { error: 'Потрібні щонайменше прізвище та ім’я' };
    return { last_name: parts[0], first_name: parts[1], patronymic: parts.slice(2).join(' ') || null };
  }

  const yearsOld = (iso) => {
    const b = new Date(iso + 'T00:00:00'), n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
    return a;
  };

  // Колонка за номером питання «10. …» або за словом у заголовку
  function col(hdr, test) {
    return hdr.findIndex((h) => test(clean(h)));
  }
  const byNum = (n) => (h) => h.startsWith(n + '.');

  // ============================================================
  // ШАБЛОНИ
  // ============================================================
  const TEMPLATES = [
    {
      id: 'kids_mp',
      label: 'Діти Морської піхоти (відповіді Google Форми)',
      program: 'Діти Морської піхоти',
      detect: (hdr) => hdr.some((h) => clean(h).startsWith('10.')) && hdr.some((h) => /дитин/i.test(clean(h))),
      parse: parseKids
    }
    // 200 і 300 — наступними кроками
  ];

  // ---------- Шаблон «Діти МП» ----------
  function parseKids(rows, hdr, ctx) {
    const c = {
      ts: col(hdr, (h) => /позначка|отметка|timestamp/i.test(h)),
      rep: col(hdr, byNum(1)), phone: col(hdr, byNum(2)), email: col(hdr, byNum(3)),
      region: col(hdr, byNum(4)), place: col(hdr, byNum(5)), cat: col(hdr, byNum(6)),
      mil: col(hdr, byNum(7)), unit: col(hdr, byNum(8)), kinToChild: col(hdr, byNum(9)),
      child: col(hdr, byNum(10)), cbd: col(hdr, byNum(11)), csex: col(hdr, byNum(12)),
      interests: col(hdr, byNum(13)), needs: col(hdr, byNum(14)), other: col(hdr, byNum(15)),
      consent: col(hdr, byNum(16))
    };
    const missing = Object.entries(c).filter(([k, v]) => v < 0 && k !== 'ts').map(([k]) => k);
    if (missing.length) throw new Error('У файлі бракує колонок форми. Перевірте, що це відповіді форми «Діти Морської піхоти».');

    const CAT = [
      [/загибл/i, 'Загиблий'], [/безвісти|зникл/i, 'Зниклий безвісти'], [/полон/i, 'Військовополонений'],
      [/ветеран/i, 'Ветеран'], [/діючий/i, 'Діючий військовослужбовець']
    ];
    const out = [];

    rows.forEach((r, i) => {
      const excelRow = i + 2;
      const g = (k) => (c[k] >= 0 ? r[c[k]] : null);
      if (!clean(g('rep')) && !clean(g('phone')) && !clean(g('child'))) return; // порожній рядок

      const rec = newRecord(excelRow);
      const p = rec.person;

      // Представник
      const fio = splitFio(g('rep'));
      if (fio.error) rec.errors.push(`Представник: ${fio.error}`);
      else Object.assign(p, fio);

      const ph = V.normalizePhone(clean(g('phone')));
      if (ph.error) rec.errors.push(`Телефон «${clean(g('phone'))}»: невірний формат`);
      else if (!ph.value) rec.warnings.push('Немає телефону: не потрапить у розсилку');
      else { p.phone = ph.value; if (ph.warning) rec.warnings.push(ph.warning); }

      const em = V.normalizeEmail(g('email'));
      if (em.error) rec.warnings.push(`Email «${clean(g('email'))}» невірний — не буде записаний`);
      else p.email = em.value;

      const regName = clean(g('region')).replace(/\s*обл(асть|\.)?$/i, '');
      if (regName) {
        const reg = [...ctx.regions].find(([, n]) => n.toLowerCase() === regName.toLowerCase());
        if (reg) p.region_id = reg[0];
        else rec.warnings.push(`Область «${regName}» не впізнано — вкажіть вручну`);
      }
      p.settlement = clean(g('place')) || null;

      const ts = toDate(g('ts'));
      if (/^так/i.test(clean(g('consent')))) {
        p.consent_pd_at = ts ? new Date(ts + 'T12:00:00').toISOString() : new Date().toISOString();
        p.consent_messages = true; // мета згоди у формі — інформування
      } else {
        rec.warnings.push('Немає згоди на обробку ПД у формі');
      }

      // Військовий
      const catText = clean(g('cat'));
      const status = (CAT.find(([re]) => re.test(catText)) || [null, 'Невідомо'])[1];
      if (status === 'Невідомо' && catText) rec.warnings.push(`Категорію «${catText}» не впізнано`);
      const milRaw = clean(g('mil'));
      const unitRaw = clean(g('unit'));
      const unit = matchUnit(unitRaw, ctx.units);

      const repL = letters(g('rep')), milL = letters(milRaw);
      const isSelf = milL && repL && milL === repL;
      const maybeSelf = !isSelf && milL.length >= 5 && repL.includes(milL);

      if (isSelf && ['Діючий військовослужбовець', 'Ветеран'].includes(status)) {
        p.military_status = status;
        p.mp_relation = 'Так';
        p.mp_relation_type = status === 'Ветеран' ? 'Ветеран МП' : 'Діючий військовослужбовець МП';
        p.mp_unit_id = unit.id; p.mp_unit_other = unit.other;
        rec.info.push('Представник сам є військовим МП');
      } else if (milRaw || status !== 'Невідомо') {
        const mf = V.normalizeName(milRaw, false);
        rec.relations.push({
          relation_degree: 'Інший член сім’ї / родич',
          related_full_name: mf.value || null,
          related_status: status,
          related_mp: 'Так',
          related_unit_id: unit.id, related_unit_other: unit.other
        });
        rec.warnings.push('Уточніть, ким представник доводиться військовому (у формі такого питання немає)');
        if (maybeSelf) rec.warnings.push('ПІБ військового схоже на ПІБ представника — можливо, це та сама людина');
      }
      if (unitRaw && !unit.id) rec.warnings.push(`Підрозділ «${unitRaw}» не знайдено в довіднику — записано текстом`);

      // Основна дитина
      const kid = makeChild(g('child'), g('cbd'), g('csex'), g('interests'), g('needs'), ts, rec);
      if (kid) rec.children.push(kid);

      // Інші діти (вільний текст)
      const other = String(g('other') ?? '').trim();
      if (/^так/i.test(other)) rec.info.push('Родина має інших дітей — очікуйте окремих анкет');
      else if (other && !/^(ні|немає|-)\.?$/i.test(other)) {
        other.split(/\n+/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
          const m = line.match(/^(.+?)\s+(\d{1,2}[.,/]\d{1,2}[.,/]\d{4})/);
          if (m) {
            const k = makeChild(m[1], m[2], null, null, null, ts, rec);
            if (k) rec.children.push(k);
          } else {
            rec.warnings.push(`Не вдалося розібрати дитину: «${line}» — додайте вручну`);
          }
        });
      }

      rec.programs.push(ctx.programByName(TEMPLATES[0].program));
      p.has_children = rec.children.length ? 'Так' : 'Невідомо';
      out.push(rec);
    });
    return out;
  }

  function makeChild(name, bd, sex, interests, needs, ts, rec) {
    const iso = toDate(bd);
    const nm = clean(name);
    if (!iso) { rec.errors.push(`Дитина «${nm || 'без імені'}»: немає або невірна дата народження`); return null; }
    const chk = V.checkBirthDate(iso);
    if (chk.error) { rec.errors.push(`Дитина «${nm}»: ${chk.error.toLowerCase()}`); return null; }
    if (ts && iso === ts) rec.warnings.push(`Дитина «${nm}»: дата народження збігається з датою заповнення форми — перевірте`);
    const age = yearsOld(iso);
    if (age >= 18) rec.warnings.push(`Дитина «${nm}»: ${age} років — перевірте, чи це дитина`);

    const list = clean(interests).split(/\s*,\s*/).filter(Boolean);
    const known = list.filter((x) => OPT.child_interests.includes(x));
    const unknown = list.filter((x) => !OPT.child_interests.includes(x));
    if (unknown.length) rec.warnings.push(`Невідомі інтереси: ${unknown.join(', ')}`);
    const nd = clean(needs);
    return {
      full_name: V.normalizeName(nm, false).value || nm || null,
      birth_date: iso,
      sex: ['Хлопець', 'Дівчина'].includes(clean(sex)) ? clean(sex) : 'Не вказано',
      interests: known,
      special_needs: /^(ні|немає|нема|-)\.?$/i.test(nd) || !nd ? null : nd
    };
  }

  function matchUnit(raw, units) {
    if (!raw) return { id: null, other: null };
    const s = clean(raw).toLowerCase();
    for (const [id, name] of units) {
      const n = name.toLowerCase();
      if (n === s || n.startsWith(s + ' ')) return { id, other: null };
    }
    return { id: null, other: clean(raw) };
  }

  function newRecord(row) {
    return {
      rows: [row], person: {}, relations: [], children: [], programs: [],
      errors: [], warnings: [], info: [], state: null, existing: null, include: true
    };
  }

  // Кілька анкет з одним телефоном → одна особа
  function mergeByPhone(list) {
    const map = new Map(), out = [];
    list.forEach((r) => {
      const key = r.person.phone;
      if (!key || r.errors.length) { out.push(r); return; }
      const prev = map.get(key);
      if (!prev) { map.set(key, r); out.push(r); return; }
      prev.rows.push(...r.rows);
      r.children.forEach((k) => {
        if (!prev.children.some((x) => x.birth_date === k.birth_date && letters(x.full_name) === letters(k.full_name))) prev.children.push(k);
      });
      r.relations.forEach((rel) => {
        if (!prev.relations.some((x) => letters(x.related_full_name) === letters(rel.related_full_name))) prev.relations.push(rel);
      });
      r.warnings.forEach((w) => { if (!prev.warnings.includes(w)) prev.warnings.push(w); });
      r.info.forEach((w) => { if (!prev.info.includes(w)) prev.info.push(w); });
      prev.info.push(`Об’єднано з рядком ${r.rows[0]} (той самий телефон)`);
      if (prev.children.length) prev.person.has_children = 'Так';
    });
    return out;
  }

  // Звірка з базою: хто вже є
  async function matchExisting(list) {
    const { db } = Persons.ctx();
    const phones = [...new Set(list.map((r) => r.person.phone).filter(Boolean))];
    const found = new Map();
    for (let i = 0; i < phones.length; i += 150) {
      const { data, error } = await db.from('persons')
        .select('id, phone, last_name, first_name, email, region_id, settlement, consent_pd_at, consent_messages, children(birth_date, full_name), military_relations(related_full_name), person_programs(program_id)')
        .in('phone', phones.slice(i, i + 150));
      if (error) throw error;
      data.forEach((p) => found.set(p.phone, p));
    }
    list.forEach((r) => {
      if (r.errors.length) { r.state = 'error'; r.include = false; return; }
      const ex = found.get(r.person.phone);
      if (ex) {
        r.existing = ex;
        if (letters(ex.last_name) !== letters(r.person.last_name)) {
          r.warnings.push(`Телефон уже є в реєстрі у «${ex.last_name} ${ex.first_name}» — перевірте, чи це та сама людина`);
        }
        const newKids = r.children.filter((k) => !(ex.children || []).some((x) => x.birth_date === k.birth_date));
        r.info.push(newKids.length ? `Уже є в реєстрі: буде додано дітей — ${newKids.length}` : 'Уже є в реєстрі: нових дітей немає');
      }
      r.state = r.warnings.length ? 'warn' : ex ? 'update' : 'new';
    });
  }

  // ============================================================
  // ІНТЕРФЕЙС
  // ============================================================
  function init() {
    const sel = $('imp-template');
    sel.innerHTML = '';
    TEMPLATES.forEach((t) => sel.add(new Option(t.label, t.id)));
    sel.add(new Option('Загиблі (200) — незабаром', '', false, false));
    sel.options[sel.options.length - 1].disabled = true;
    sel.add(new Option('Поранені (300) — незабаром', '', false, false));
    sel.options[sel.options.length - 1].disabled = true;

    $('imp-file').addEventListener('change', onFile);
    $('imp-run').addEventListener('click', runImport);
    $('imp-errors-btn').addEventListener('click', downloadErrors);
    $('imp-reset').addEventListener('click', resetView);
    $('imp-preview').addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-i]');
      if (cb) { records[Number(cb.dataset.i)].include = cb.checked; updateRunButton(); }
    });
    loadBatches();
  }

  function resetView() {
    records = []; rawRows = []; header = [];
    $('imp-file').value = '';
    $('imp-result').hidden = true;
    $('imp-status').textContent = '';
  }

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    fileName = file.name;
    template = TEMPLATES.find((t) => t.id === $('imp-template').value);
    $('imp-status').textContent = 'Читаємо файл…';
    $('imp-result').hidden = true;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const all = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
      header = all[0] || [];
      rawRows = all.slice(1);
      if (!template.detect(header)) {
        $('imp-status').textContent = 'Цей файл не схожий на обраний шаблон. Перевірте файл або шаблон.';
        return;
      }
      const ctx = Persons.ctx();
      const progId = (name) => [...ctx.programs].find(([, n]) => n === name)?.[0];
      let list = template.parse(rawRows, header, { ...ctx, programByName: progId });
      list = mergeByPhone(list);
      $('imp-status').textContent = 'Звіряємо з реєстром…';
      await matchExisting(list);
      records = list;
      renderPreview();
      $('imp-status').textContent = '';
    } catch (err) {
      console.error(err);
      $('imp-status').textContent = err.message && !/fetch|network/i.test(err.message)
        ? err.message : 'Не вдалося прочитати файл. Перевірте, що це Excel (.xlsx).';
    }
  }

  const STATE = {
    new: { label: 'Нова особа', cls: 'st-new' },
    update: { label: 'Доповнення', cls: 'st-upd' },
    warn: { label: 'Перевірити', cls: 'st-warn' },
    error: { label: 'Помилка', cls: 'st-err' }
  };

  function renderPreview() {
    const count = (s) => records.filter((r) => r.state === s).length;
    $('imp-summary').innerHTML = '';
    [['new', 'нових'], ['update', 'доповнень'], ['warn', 'перевірити'], ['error', 'з помилками']].forEach(([s, t]) => {
      const span = document.createElement('span');
      span.className = 'imp-chip ' + STATE[s].cls;
      span.textContent = `${count(s)} ${t}`;
      $('imp-summary').appendChild(span);
    });

    const tbody = $('imp-preview').tBodies[0];
    tbody.innerHTML = '';
    records.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.className = STATE[r.state].cls;
      const p = r.person;
      const cells = [
        null,
        r.rows.join(', '),
        [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ') || '—',
        V.formatPhone(p.phone) || '—',
        r.relations.map((x) => `${x.related_full_name || 'без ПІБ'} (${x.related_status})`).join('; ') || (p.military_status && p.military_status !== 'Не застосовується' ? `сам: ${p.military_status}` : '—'),
        r.children.map((k) => `${k.full_name || 'без ПІБ'}, ${yearsOld(k.birth_date)} р.`).join('; ') || '—'
      ];
      const td0 = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.dataset.i = i; cb.checked = r.include; cb.disabled = r.state === 'error';
      cb.setAttribute('aria-label', 'Імпортувати рядок ' + r.rows.join(', '));
      const badge = document.createElement('span');
      badge.className = 'st-badge'; badge.textContent = STATE[r.state].label;
      td0.append(cb, badge);
      tr.appendChild(td0);
      cells.slice(1).forEach((t) => { const td = document.createElement('td'); td.textContent = t; tr.appendChild(td); });

      const notes = document.createElement('td');
      const ul = document.createElement('ul');
      ul.className = 'imp-notes';
      [...r.errors.map((t) => ['n-err', t]), ...r.warnings.map((t) => ['n-warn', t]), ...r.info.map((t) => ['n-info', t])]
        .forEach(([cls, t]) => { const li = document.createElement('li'); li.className = cls; li.textContent = t; ul.appendChild(li); });
      notes.appendChild(ul);
      tr.appendChild(notes);
      tbody.appendChild(tr);
    });

    $('imp-errors-btn').hidden = !count('error');
    $('imp-result').hidden = false;
    updateRunButton();
  }

  function updateRunButton() {
    const n = records.filter((r) => r.include && r.state !== 'error').length;
    $('imp-run').disabled = !n;
    $('imp-run').textContent = `Імпортувати ${n}`;
  }

  // ---------- Імпорт ----------
  async function runImport() {
    const { db } = Persons.ctx();
    const todo = records.filter((r) => r.include && r.state !== 'error');
    if (!todo.length) return;
    if (!confirm(`Імпортувати ${todo.length} записів з файлу «${fileName}»?`)) return;

    $('imp-run').disabled = true;
    $('imp-status').textContent = 'Імпортуємо…';

    const { data: batch, error: be } = await db.from('import_batches')
      .insert({ file_name: fileName, template: template.label, rows_total: records.length })
      .select('id').single();
    if (be) { console.error(be); $('imp-status').textContent = 'Не вдалося створити пакет імпорту.'; return; }

    let done = 0, failed = 0;
    for (const r of todo) {
      try {
        if (r.existing) await addToExisting(db, r);
        else await createNew(db, r, batch.id);
        done++;
      } catch (e) {
        console.error(e);
        failed++;
        r.errors.push('Не вдалося записати: ' + (e.code === '23505' ? 'такий телефон уже є' : 'помилка бази'));
        r.state = 'error';
      }
      $('imp-status').textContent = `Імпортуємо… ${done + failed} з ${todo.length}`;
    }
    await db.from('import_batches').update({ rows_imported: done, rows_skipped: records.length - done }).eq('id', batch.id);

    $('imp-status').textContent = `Готово: імпортовано ${done}` + (failed ? `, не вдалося ${failed} (див. позначки нижче)` : '') + '.';
    renderPreview();
    records.forEach((r) => { if (r.state !== 'error') r.include = false; });
    updateRunButton();
    loadBatches();
    Persons.showList();
  }

  async function createNew(db, r, batchId) {
    const p = { ...r.person, source: 'Excel', source_ref: fileName, import_batch_id: batchId };
    const { data, error } = await db.from('persons').insert(p).select('id').single();
    if (error) throw error;
    await insertChildren(db, data.id, r.relations, r.children, r.programs.filter(Boolean));
  }

  async function addToExisting(db, r) {
    const ex = r.existing;
    const patch = {};
    ['email', 'region_id', 'settlement', 'consent_pd_at'].forEach((k) => { if (!ex[k] && r.person[k]) patch[k] = r.person[k]; });
    if (!ex.consent_messages && r.person.consent_messages) patch.consent_messages = true;
    if (Object.keys(patch).length) {
      const { error } = await db.from('persons').update(patch).eq('id', ex.id);
      if (error) throw error;
    }
    const kids = r.children.filter((k) => !(ex.children || []).some((x) => x.birth_date === k.birth_date));
    const rels = r.relations.filter((rel) => !(ex.military_relations || []).some((x) => letters(x.related_full_name) === letters(rel.related_full_name)));
    const progs = r.programs.filter((pid) => pid && !(ex.person_programs || []).some((x) => x.program_id === pid));
    if (kids.length) {
      const { error } = await db.from('persons').update({ has_children: 'Так' }).eq('id', ex.id);
      if (error) throw error;
    }
    await insertChildren(db, ex.id, rels, kids, progs);
  }

  async function insertChildren(db, personId, rels, kids, progs) {
    if (rels.length) {
      const { error } = await db.from('military_relations').insert(rels.map((x) => ({ ...x, person_id: personId })));
      if (error) throw error;
    }
    if (kids.length) {
      const { error } = await db.from('children').insert(kids.map((x) => ({ ...x, person_id: personId })));
      if (error) throw error;
    }
    if (progs.length) {
      const { error } = await db.from('person_programs').insert(progs.map((pid) => ({ person_id: personId, program_id: pid })));
      if (error) throw error;
    }
  }

  // ---------- Файл помилок ----------
  function downloadErrors() {
    const bad = records.filter((r) => r.state === 'error');
    const aoa = [['Причина', ...header]];
    bad.forEach((r) => r.rows.forEach((row) => aoa.push([r.errors.join('; '), ...(rawRows[row - 2] || [])])));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Помилки');
    XLSX.writeFile(wb, `pomylky_${fileName.replace(/\.xlsx?$/i, '')}.xlsx`);
  }

  // ---------- Пакети та відкат ----------
  async function loadBatches() {
    const { db, operator } = Persons.ctx();
    const { data, error } = await db.from('import_batches').select('*').order('created_at', { ascending: false }).limit(20);
    const tbody = $('imp-batches').tBodies[0];
    tbody.innerHTML = '';
    if (error || !data.length) { $('imp-batches-wrap').hidden = true; return; }
    $('imp-batches-wrap').hidden = false;
    data.forEach((b) => {
      const tr = document.createElement('tr');
      [new Date(b.created_at).toLocaleString('uk-UA'), b.file_name, b.template, `${b.rows_imported} з ${b.rows_total}`]
        .forEach((t) => { const td = document.createElement('td'); td.textContent = t; tr.appendChild(td); });
      const td = document.createElement('td');
      if (b.rolled_back_at) td.textContent = 'Відкочено ' + new Date(b.rolled_back_at).toLocaleDateString('uk-UA');
      else if (operator.role === 'admin') {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'btn-link btn-rollback'; btn.textContent = 'Відкотити';
        btn.addEventListener('click', () => rollback(b));
        td.appendChild(btn);
      }
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
  }

  async function rollback(b) {
    if (!confirm(`Відкотити імпорт «${b.file_name}»?\n\nБуде видалено осіб, СТВОРЕНИХ цим імпортом, разом з їхніми дітьми і зв’язками. Діти, додані до вже наявних осіб, залишаться — їх видаляйте вручну.`)) return;
    const { db } = Persons.ctx();
    const { data, error } = await db.from('persons').delete().eq('import_batch_id', b.id).select('id');
    if (error) { console.error(error); Persons.toast('Не вдалося відкотити.'); return; }
    await db.from('import_batches').update({ rolled_back_at: new Date().toISOString() }).eq('id', b.id);
    Persons.toast(`Відкочено: видалено ${data.length} осіб`);
    loadBatches();
    Persons.showList();
  }

  return { init, _test: { parseKids, toDate, splitFio, mergeByPhone } };
})();
