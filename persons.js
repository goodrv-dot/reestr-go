// ============================================================
// Особи: список, пошук, картка (основні дані, військовий статус,
// інвалідність, Морська піхота), видалення
// ============================================================
window.Persons = (() => {
  let db = null;
  let isAdmin = false;
  let started = false;
  let editingId = null;
  let editingConsentAt = null;
  let searchTimer = null;
  const regions = new Map();
  let units = [];          // підрозділи МП для рядків зв’язків
  let rowSeq = 0;          // унікальні id для полів у рядках
  const $ = (id) => document.getElementById(id);

  async function init(client, operator) {
    db = client;
    isAdmin = operator.role === 'admin';
    if (!started) {
      await loadDicts();
      bind();
      started = true;
    }
    showList();
  }

  async function loadDicts() {
    // Області
    const { data, error } = await db.from('regions').select('id, name').order('sort');
    if (error) throw error;
    const sel = $('f-region_id');
    sel.innerHTML = '<option value="">Не вказано</option>';
    data.forEach((r) => { regions.set(r.id, r.name); sel.add(new Option(r.name, r.id)); });

    Filters.init(regions, loadList);

    // Підрозділи МП
    const ures = await db.from('mp_units').select('id, name').eq('active', true).order('name');
    if (ures.error) throw ures.error;
    units = ures.data;
    fillUnitSelect($('f-mp_unit'));

    // Варіанти з документа керівника
    fillSelect($('f-military_status'), OPT.military_status);
    fillSelect($('f-has_disability'), OPT.yes_no_unknown);
    fillSelect($('f-disability_group'), OPT.disability_group);
    fillSelect($('f-disability_war_related'), OPT.disability_war_related);
    fillSelect($('f-mp_relation'), OPT.yes_no_unknown);
    fillSelect($('f-has_children'), OPT.yes_no_unknown);
    fillSelect($('f-mp_relation_type'), OPT.mp_relation_type);
    $('f-mp_relation_type').insertBefore(new Option('Оберіть…', ''), $('f-mp_relation_type').firstChild);

    // Статуси ветерана — прапорці
    const box = $('vet-statuses');
    box.innerHTML = '';
    OPT.veteran_statuses.forEach((v) => {
      const label = document.createElement('label');
      label.className = 'check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = 'vet_status';
      cb.value = v;
      label.append(cb, ' ' + v);
      box.appendChild(label);
    });
  }

  function fillUnitSelect(sel) {
    sel.innerHTML = '<option value="">Невідомо</option>';
    units.forEach((x) => sel.add(new Option(x.name, x.id)));
    sel.add(new Option('Інший підрозділ', 'other'));
  }

  // ---------- Рядки: пов’язані військові особи ----------
  function addRelationRow(r = {}) {
    const n = ++rowSeq;
    const row = document.createElement('div');
    row.className = 'row-card';
    row.dataset.kind = 'relation';
    row.innerHTML = `
      <div class="grid">
        <div class="field"><label for="r${n}-degree">Ступінь спорідненості <span class="req">*</span></label>
          <select id="r${n}-degree" data-k="relation_degree"></select><p class="hint" data-h="relation_degree"></p></div>
        <div class="field"><label for="r${n}-name">ПІБ військового</label>
          <input id="r${n}-name" data-k="related_full_name"><p class="hint" data-h="related_full_name"></p></div>
        <div class="field"><label for="r${n}-bd">Дата народження</label>
          <input id="r${n}-bd" type="date" data-k="related_birth_date"><p class="hint" data-h="related_birth_date"></p></div>
        <div class="field"><label for="r${n}-status">Статус</label>
          <select id="r${n}-status" data-k="related_status"></select></div>
        <div class="field"><label for="r${n}-mp">Відношення до МП</label>
          <select id="r${n}-mp" data-k="related_mp"></select></div>
        <div class="field" data-row-mp><label for="r${n}-unit">Підрозділ</label>
          <select id="r${n}-unit" data-k="related_unit"></select></div>
        <div class="field" data-row-other><label for="r${n}-other">Назва підрозділу <span class="req">*</span></label>
          <input id="r${n}-other" data-k="related_unit_other"><p class="hint" data-h="related_unit_other"></p></div>
      </div>
      <button type="button" class="btn-link btn-remove">Прибрати</button>`;

    const q = (k) => row.querySelector(`[data-k="${k}"]`);
    const degree = q('relation_degree');
    degree.add(new Option('Оберіть…', ''));
    OPT.relation_degree.forEach((v) => degree.add(new Option(v, v)));
    fillSelect(q('related_status'), OPT.related_status);
    fillSelect(q('related_mp'), OPT.yes_no_unknown);
    fillUnitSelect(q('related_unit'));

    degree.value = r.relation_degree || '';
    q('related_full_name').value = r.related_full_name || '';
    q('related_birth_date').value = r.related_birth_date || '';
    q('related_status').value = r.related_status || 'Невідомо';
    q('related_mp').value = r.related_mp || 'Невідомо';
    q('related_unit').value = r.related_unit_id ? String(r.related_unit_id) : (r.related_unit_other ? 'other' : '');
    q('related_unit_other').value = r.related_unit_other || '';

    const vis = () => {
      const mp = q('related_mp').value === 'Так';
      row.querySelector('[data-row-mp]').hidden = !mp;
      row.querySelector('[data-row-other]').hidden = !mp || q('related_unit').value !== 'other';
    };
    q('related_mp').addEventListener('change', vis);
    q('related_unit').addEventListener('change', vis);
    row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
    vis();
    $('relations-list').appendChild(row);
    return row;
  }

  // ---------- Рядки: діти ----------
  function addChildRow(c = {}) {
    const n = ++rowSeq;
    const row = document.createElement('div');
    row.className = 'row-card row-card-compact';
    row.dataset.kind = 'child';
    row.innerHTML = `
      <div class="grid">
        <div class="field"><label for="c${n}-bd">Дата народження <span class="req">*</span></label>
          <input id="c${n}-bd" type="date" data-k="birth_date"><p class="hint" data-h="birth_date"></p></div>
        <div class="field"><label for="c${n}-name">ПІБ дитини</label>
          <input id="c${n}-name" data-k="full_name"></div>
      </div>
      <button type="button" class="btn-link btn-remove">Прибрати</button>`;
    row.querySelector('[data-k="birth_date"]').value = c.birth_date || '';
    row.querySelector('[data-k="full_name"]').value = c.full_name || '';
    row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
    $('children-list').appendChild(row);
    return row;
  }

  function setRowHint(row, key, error, warning) {
    const h = row.querySelector(`[data-h="${key}"]`);
    const input = row.querySelector(`[data-k="${key}"]`);
    if (input) input.setAttribute('aria-invalid', error ? 'true' : 'false');
    if (h) {
      h.textContent = error || warning || '';
      h.className = 'hint' + (error ? ' hint-err' : warning ? ' hint-warn' : '');
    }
  }

  // Показ залежних полів: група інвалідності, дані про МП
  function updateVisibility() {
    const f = $('person-form');
    document.querySelectorAll('#person-form [data-show-if]').forEach((el) => {
      el.hidden = f[el.dataset.showIf].value !== 'Так';
    });
    $('mp-unit-other-wrap').hidden = f.mp_relation.value !== 'Так' || f.mp_unit.value !== 'other';
  }

  function bind() {
    $('add-btn').addEventListener('click', () => openForm(null));
    $('back-btn').addEventListener('click', showList);
    $('cancel-btn').addEventListener('click', showList);
    $('person-form').addEventListener('submit', save);
    $('delete-btn').addEventListener('click', removePerson);
    $('add-relation-btn').addEventListener('click', () => {
      addRelationRow().querySelector('select').focus();
    });
    $('add-child-btn').addEventListener('click', () => {
      const f = $('person-form');
      if (f.has_children.value !== 'Так') f.has_children.value = 'Так';
      addChildRow().querySelector('input').focus();
    });
    ['f-has_disability', 'f-mp_relation', 'f-mp_unit'].forEach((id) =>
      $(id).addEventListener('change', updateVisibility));
    $('search').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadList, 300);
    });

    const tbody = $('persons-table').tBodies[0];
    tbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) openForm(tr.dataset.id);
    });
    tbody.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openForm(tr.dataset.id); }
    });

    // Телефон: одразу виправляємо формат, коли поле втрачає фокус
    $('f-phone').addEventListener('blur', () => {
      const r = V.normalizePhone($('f-phone').value);
      if (r.value) $('f-phone').value = V.formatPhone(r.value);
      setHint('phone', r.error, r.warning);
    });
  }

  // ---------- Список ----------
  function showList() {
    $('form-view').hidden = true;
    $('list-view').hidden = false;
    loadList();
  }

  async function loadList() {
    const raw = $('search').value.trim();
    const q = raw.replace(/[,()%*\\]/g, ' ').trim();

    let query = db
      .from('persons_view')
      .select('id, last_name, first_name, patronymic, phone, region_id, person_categories, family_categories, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(200);

    if (q) {
      const parts = [`last_name.ilike.%${q}%`, `first_name.ilike.%${q}%`, `patronymic.ilike.%${q}%`];
      const digits = q.replace(/\D/g, '');
      if (digits.length >= 3) parts.push(`phone.ilike.%${digits}%`);
      query = query.or(parts.join(','));
    }

    try {
      query = await Filters.apply(query, db);
    } catch (e) {
      console.error(e);
      setListStatus('Не вдалося застосувати фільтри. Оновіть сторінку.');
      return;
    }

    const { data, error, count } = await query;
    if (error) {
      console.error(error);
      setListStatus('Не вдалося завантажити список. Оновіть сторінку.');
      return;
    }
    renderList(data, count, q);
  }

  function renderList(rows, count, q) {
    const table = $('persons-table');
    const tbody = table.tBodies[0];
    tbody.innerHTML = '';
    const filtered = q || Filters.activeCount() > 0;
    $('count').textContent = filtered ? `${count} знайдено` : `${count}`;
    $('list-note').hidden = count <= rows.length;
    $('list-note').textContent = `Показано перші ${rows.length} з ${count}. Уточніть пошук або фільтри.`;

    if (!rows.length) {
      table.hidden = true;
      setListStatus(filtered
        ? 'За цими умовами нікого не знайдено. Змініть пошук або скиньте фільтри.'
        : 'Реєстр порожній. Натисніть «Додати особу», щоб внести першу.');
      return;
    }
    setListStatus('');
    table.hidden = false;

    rows.forEach((p) => {
      const tr = document.createElement('tr');
      tr.dataset.id = p.id;
      tr.tabIndex = 0;

      addCell(tr, [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' '), 'cell-name');
      addCell(tr, V.formatPhone(p.phone) || '—');
      addCell(tr, regions.get(p.region_id) || '—');

      const cats = [...new Set([...(p.person_categories || []), ...(p.family_categories || [])])];
      const td = document.createElement('td');
      cats.slice(0, 2).forEach((c) => {
        const s = document.createElement('span');
        s.className = 'tag';
        s.textContent = c;
        td.appendChild(s);
      });
      if (cats.length > 2) {
        const more = document.createElement('span');
        more.className = 'tag tag-more';
        more.textContent = `+${cats.length - 2}`;
        td.appendChild(more);
      }
      if (!cats.length) td.textContent = '—';
      tr.appendChild(td);

      addCell(tr, new Date(p.created_at).toLocaleDateString('uk-UA'));
      tbody.appendChild(tr);
    });
  }

  function addCell(tr, text, cls) {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    tr.appendChild(td);
  }

  function setListStatus(text) {
    $('list-status').textContent = text;
    $('list-status').hidden = !text;
  }

  // ---------- Форма ----------
  async function openForm(id) {
    const f = $('person-form');
    f.reset();
    clearHints();
    setFormError('');
    editingId = id;
    editingConsentAt = null;
    $('consent-date').textContent = '';
    $('relations-list').innerHTML = '';
    $('children-list').innerHTML = '';

    if (id) {
      const { data, error } = await db.from('persons').select('*, person_veteran_statuses(status), military_relations(*), children(*)').eq('id', id).single();
      if (error) { console.error(error); toast('Не вдалося відкрити картку.'); return; }
      fillForm(data);
      $('form-title').textContent = [data.last_name, data.first_name, data.patronymic].filter(Boolean).join(' ');
    } else {
      $('form-title').textContent = 'Нова особа';
    }

    $('delete-btn').hidden = !(id && isAdmin);
    updateVisibility();
    $('list-view').hidden = true;
    $('form-view').hidden = false;
    window.scrollTo(0, 0);
    $('f-last_name').focus();
  }

  function fillForm(p) {
    const f = $('person-form');
    ['last_name', 'first_name', 'patronymic', 'birth_date', 'email', 'settlement', 'comment',
     'sex', 'preferred_messenger', 'is_idp'].forEach((k) => { f[k].value = p[k] ?? ''; });
    f.phone.value = V.formatPhone(p.phone);
    f.region_id.value = p.region_id ?? '';
    f.vkmpu_member.checked = p.vkmpu_member;
    f.consent_messages.checked = p.consent_messages;
    f.unsubscribed.checked = p.unsubscribed;
    f.consent_pd.checked = !!p.consent_pd_at;

    const na = (v) => (v === 'Не застосовується' ? '' : v);
    f.military_status.value = p.military_status;
    f.has_disability.value = p.has_disability;
    f.disability_group.value = na(p.disability_group) || 'Невідомо';
    f.disability_war_related.value = na(p.disability_war_related) || 'Невідомо';
    f.mp_relation.value = p.mp_relation;
    f.mp_relation_type.value = na(p.mp_relation_type);
    f.mp_unit.value = p.mp_unit_id ? String(p.mp_unit_id) : (p.mp_unit_other ? 'other' : '');
    f.mp_unit_other.value = p.mp_unit_other ?? '';
    const vs = new Set((p.person_veteran_statuses || []).map((x) => x.status));
    f.querySelectorAll('input[name="vet_status"]').forEach((cb) => { cb.checked = vs.has(cb.value); });

    f.has_children.value = p.has_children;
    f.children_count.value = p.children_count ?? '';
    (p.military_relations || [])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .forEach((r) => addRelationRow(r));
    (p.children || [])
      .sort((a, b) => a.birth_date.localeCompare(b.birth_date))
      .forEach((c) => addChildRow(c));
    editingConsentAt = p.consent_pd_at;
    if (p.consent_pd_at) {
      $('consent-date').textContent = `надано ${new Date(p.consent_pd_at).toLocaleDateString('uk-UA')}`;
    }
  }

  async function save(e) {
    e.preventDefault();
    clearHints();
    setFormError('');
    const f = $('person-form');
    const rec = {};
    let ok = true;

    const apply = (name, r) => {
      if (r.error) { setHint(name, r.error); ok = false; }
      else { rec[name] = r.value; if (r.warning) setHint(name, null, r.warning); }
    };

    apply('last_name',  V.normalizeName(f.last_name.value, true));
    apply('first_name', V.normalizeName(f.first_name.value, true));
    apply('patronymic', V.normalizeName(f.patronymic.value, false));
    apply('birth_date', V.checkBirthDate(f.birth_date.value));
    apply('phone',      V.normalizePhone(f.phone.value));
    apply('email',      V.normalizeEmail(f.email.value));

    // Інвалідність
    rec.has_disability = f.has_disability.value;
    const dis = rec.has_disability === 'Так';
    rec.disability_group = dis ? f.disability_group.value : 'Не застосовується';
    rec.disability_war_related = dis ? f.disability_war_related.value : 'Не застосовується';

    // Морська піхота
    rec.military_status = f.military_status.value;
    rec.mp_relation = f.mp_relation.value;
    if (rec.mp_relation === 'Так') {
      rec.mp_relation_type = f.mp_relation_type.value;
      if (!rec.mp_relation_type) { setHint('mp_relation_type', 'Оберіть характер відношення'); ok = false; }
      const unit = f.mp_unit.value;
      rec.mp_unit_id = unit && unit !== 'other' ? Number(unit) : null;
      rec.mp_unit_other = unit === 'other' ? (f.mp_unit_other.value.trim() || null) : null;
      if (unit === 'other' && !rec.mp_unit_other) { setHint('mp_unit_other', 'Вкажіть назву підрозділу'); ok = false; }
    } else {
      rec.mp_relation_type = 'Не застосовується';
      rec.mp_unit_id = null;
      rec.mp_unit_other = null;
    }

    const vetStatuses = [...f.querySelectorAll('input[name="vet_status"]:checked')].map((cb) => cb.value);

    // Пов’язані військові особи
    const relations = [];
    document.querySelectorAll('#relations-list .row-card').forEach((row) => {
      const q = (k) => row.querySelector(`[data-k="${k}"]`).value;
      const r = {
        relation_degree: q('relation_degree'),
        related_full_name: V.normalizeName(q('related_full_name'), false),
        related_status: q('related_status'),
        related_mp: q('related_mp'),
        related_unit_id: null,
        related_unit_other: null
      };
      if (!r.relation_degree) { setRowHint(row, 'relation_degree', 'Оберіть ступінь спорідненості'); ok = false; }
      if (r.related_full_name.error) { setRowHint(row, 'related_full_name', r.related_full_name.error); ok = false; }
      r.related_full_name = r.related_full_name.value ?? null;
      const bd = V.checkBirthDate(q('related_birth_date'));
      if (bd.error) { setRowHint(row, 'related_birth_date', bd.error); ok = false; }
      r.related_birth_date = bd.value ?? null;
      if (r.related_mp === 'Так') {
        const u = q('related_unit');
        r.related_unit_id = u && u !== 'other' ? Number(u) : null;
        r.related_unit_other = u === 'other' ? (q('related_unit_other').trim() || null) : null;
        if (u === 'other' && !r.related_unit_other) { setRowHint(row, 'related_unit_other', 'Вкажіть назву підрозділу'); ok = false; }
      }
      relations.push(r);
    });

    // Діти
    rec.has_children = f.has_children.value;
    const children = [];
    document.querySelectorAll('#children-list .row-card').forEach((row) => {
      const raw = row.querySelector('[data-k="birth_date"]').value;
      const bd = V.checkBirthDate(raw);
      if (!raw) { setRowHint(row, 'birth_date', 'Вкажіть дату народження'); ok = false; return; }
      if (bd.error) { setRowHint(row, 'birth_date', bd.error); ok = false; return; }
      if (rec.birth_date && bd.value <= rec.birth_date) {
        setRowHint(row, 'birth_date', 'Дитина не може бути старшою за батьків'); ok = false; return;
      }
      const name = row.querySelector('[data-k="full_name"]').value.trim();
      children.push({ birth_date: bd.value, full_name: name || null });
    });
    const cnt = f.children_count.value === '' ? null : Number(f.children_count.value);
    if (cnt !== null && (!Number.isInteger(cnt) || cnt < 0 || cnt > 30)) {
      setHint('children_count', 'Число від 0 до 30'); ok = false;
    }
    rec.children_count = cnt;
    if (children.length) {
      rec.has_children = 'Так';
      if (rec.children_count === null || rec.children_count < children.length) rec.children_count = children.length;
    }
    if (rec.has_children === 'Ні' && rec.children_count > 0) {
      setHint('children_count', 'Вказано «Є діти: Ні», але кількість більше нуля'); ok = false;
    }

    if (!ok) {
      setFormError('Виправте поля, позначені червоним.');
      const firstBad = f.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return;
    }

    rec.sex = f.sex.value;
    rec.preferred_messenger = f.preferred_messenger.value;
    rec.is_idp = f.is_idp.value;
    rec.region_id = f.region_id.value ? Number(f.region_id.value) : null;
    rec.settlement = f.settlement.value.trim() || null;
    rec.comment = f.comment.value.trim() || null;
    rec.vkmpu_member = f.vkmpu_member.checked;
    rec.consent_messages = f.consent_messages.checked;
    rec.unsubscribed = f.unsubscribed.checked;
    rec.consent_pd_at = f.consent_pd.checked ? (editingConsentAt || new Date().toISOString()) : null;

    $('save-btn').disabled = true;
    const res = editingId
      ? await db.from('persons').update(rec).eq('id', editingId).select('id').single()
      : await db.from('persons').insert(rec).select('id').single();
    let error = res.error;

    // Статуси ветерана: замінюємо повністю
    if (!error) {
      const personId = res.data.id;
      const del = await db.from('person_veteran_statuses').delete().eq('person_id', personId);
      error = del.error;
      if (!error && vetStatuses.length) {
        const ins = await db.from('person_veteran_statuses')
          .insert(vetStatuses.map((status) => ({ person_id: personId, status })));
        error = ins.error;
      }
      // Зв’язки і діти: замінюємо повністю поточним набором з картки
      if (!error) error = (await db.from('military_relations').delete().eq('person_id', personId)).error;
      if (!error && relations.length) {
        error = (await db.from('military_relations').insert(relations.map((r) => ({ ...r, person_id: personId })))).error;
      }
      if (!error) error = (await db.from('children').delete().eq('person_id', personId)).error;
      if (!error && children.length) {
        error = (await db.from('children').insert(children.map((c) => ({ ...c, person_id: personId })))).error;
      }
    }
    $('save-btn').disabled = false;

    if (error) {
      console.error(error);
      if (error.code === '23505') {
        setHint('phone', 'Особа з таким телефоном уже є в реєстрі');
        setFormError('Такий телефон уже є в реєстрі. Знайдіть цю особу через пошук.');
      } else {
        setFormError('Не вдалося зберегти. Перевірте інтернет і спробуйте ще раз.');
      }
      return;
    }

    toast(editingId ? 'Зміни збережено' : 'Особу додано');
    showList();
  }

  // ---------- Видалення (лише адміністратор) ----------
  async function removePerson() {
    if (!editingId || !isAdmin) return;
    const name = $('form-title').textContent;
    if (!confirm(`Видалити «${name}» з реєстру?\n\nРазом з особою буде видалено її статуси, пов’язаних осіб і дітей. Відновити неможливо.`)) return;

    const { data, error } = await db.from('persons').delete().eq('id', editingId).select('id');
    if (error || !data.length) {
      console.error(error);
      setFormError('Не вдалося видалити. Можливо, у вас немає прав на видалення.');
      return;
    }
    toast('Особу видалено');
    showList();
  }

  // ---------- Підказки під полями ----------
  function setHint(name, error, warning) {
    const input = $('f-' + name);
    const hint = $('h-' + name);
    if (!input || !hint) return;
    input.setAttribute('aria-invalid', error ? 'true' : 'false');
    hint.textContent = error || warning || '';
    hint.className = 'hint' + (error ? ' hint-err' : warning ? ' hint-warn' : '');
  }

  function clearHints() {
    document.querySelectorAll('#person-form .hint').forEach((h) => { h.textContent = ''; h.className = 'hint'; });
    document.querySelectorAll('#person-form [aria-invalid]').forEach((i) => i.setAttribute('aria-invalid', 'false'));
    document.querySelectorAll('#person-form .row-card .hint').forEach((h) => { h.textContent = ''; h.className = 'hint'; });
  }

  function setFormError(text) {
    $('form-error').textContent = text;
    $('form-error').hidden = !text;
  }

  let toastTimer = null;
  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
  }

  return { init, showList };
})();
