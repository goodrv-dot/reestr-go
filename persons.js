// ============================================================
// Особи: список, пошук, картка (основні дані, військовий статус,
// інвалідність, Морська піхота), видалення
// ============================================================
window.Persons = (() => {
  let db = null;
  let isAdmin = false;
  let operator = null;
  let started = false;
  let editingId = null;
  let editingConsentAt = null;
  let extraKeep = [];
  let programRoles = new Map();   // ролі в модулях відкритої картки (зберігаємо при редагуванні)
  const PAGE_SIZE = 100;
  let level = 'main';       // main — основні картки, extra — зв’язані, all — усі
  let page = 1;
  let listScrollY = 0;      // де був список, коли відкрили картку
  let searchTimer = null;
  const regions = new Map();
  const cells = new Map();
  const programs = new Map();
  const staff = new Map();   // user_id → ПІБ співробітника
  let units = [];          // підрозділи МП для рядків зв’язків
  let rowSeq = 0;          // унікальні id для полів у рядках
  const $ = (id) => document.getElementById(id);

  async function init(client, op) {
    db = client;
    isAdmin = op.role === 'admin';
    operator = op;
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

    // Осередки та програми ГО
    const [cres, pres] = await Promise.all([
      db.from('cells').select('id, name').eq('active', true).order('name'),
      db.from('programs').select('id, name').eq('active', true).order('id')
    ]);
    if (cres.error) throw cres.error;
    if (pres.error) throw pres.error;
    const cs = $('f-cell_id');
    cs.innerHTML = '<option value="">Не вказано</option>';
    cres.data.forEach((c) => { cells.set(c.id, c.name); cs.add(new Option(c.name, c.id)); });
    const pbox = $('programs-box');
    pbox.innerHTML = '';
    pres.data.forEach((pr) => {
      programs.set(pr.id, pr.name);
      const l = document.createElement('label');
      l.className = 'check';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.name = 'program'; cb.value = pr.id;
      l.append(cb, ' ' + pr.name);
      pbox.appendChild(l);
    });

    const ops = await db.from('operators').select('user_id, full_name');
    if (!ops.error && Array.isArray(ops.data)) ops.data.forEach((o) => staff.set(o.user_id, o.full_name));

    Filters.init({ regions, cells, programs }, () => { page = 1; loadList(); });

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
    fillSelect($('f-wounded'), OPT.yes_no_unknown);
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
        <div class="field" data-row-death><label for="r${n}-dd">Дата загибелі / смерті</label>
          <input id="r${n}-dd" type="date" data-k="related_death_date"><p class="hint" data-h="related_death_date"></p></div>
        <div class="field" data-row-death><label for="r${n}-bd2">Дата поховання</label>
          <input id="r${n}-bd2" type="date" data-k="related_burial_date"><p class="hint" data-h="related_burial_date"></p></div>
        <div class="field" data-row-death><label for="r${n}-bp">Місце поховання</label>
          <input id="r${n}-bp" data-k="related_burial_place"></div>
        <div class="field"><label for="r${n}-cs">Позивний</label>
          <input id="r${n}-cs" data-k="related_callsign"></div>
        <div class="field"><label for="r${n}-uc">В/ч (код частини)</label>
          <input id="r${n}-uc" data-k="related_unit_code" placeholder="А0216"></div>
        <div class="field"><label for="r${n}-mp">Відношення до МП</label>
          <select id="r${n}-mp" data-k="related_mp"></select></div>
        <div class="field" data-row-mp><label for="r${n}-unit">Підрозділ</label>
          <select id="r${n}-unit" data-k="related_unit"></select></div>
        <div class="field" data-row-other><label for="r${n}-other">Назва підрозділу <span class="req">*</span></label>
          <input id="r${n}-other" data-k="related_unit_other"><p class="hint" data-h="related_unit_other"></p></div>
      </div>
      <div class="row-links">
        <button type="button" class="btn-link" data-act="pick">Обрати з реєстру</button>
        <button type="button" class="btn-link" data-act="open" hidden>Відкрити картку військового →</button>
        <span class="row-linked" hidden>✓ пов’язано з карткою в реєстрі</span>
      </div>
      <div class="row-kin" hidden></div>
      <button type="button" class="btn-link btn-remove">Прибрати</button>`;

    const q = (k) => row.querySelector(`[data-k="${k}"]`);
    row.dataset.personId = r.related_person_id || '';
    const showLink = () => {
      const linked = !!row.dataset.personId;
      row.querySelector('[data-act="open"]').hidden = !linked;
      row.querySelector('.row-linked').hidden = !linked;
    };
    showLink();
    row.querySelector('[data-act="pick"]').addEventListener('click', () => Picker.open((pp) => {
      q('related_full_name').value = [pp.last_name, pp.first_name, pp.patronymic].filter(Boolean).join(' ');
      q('related_birth_date').value = pp.birth_date || '';
      q('related_status').value = OPT.related_status.includes(pp.military_status) ? pp.military_status : 'Невідомо';
      q('related_mp').value = pp.mp_relation === 'Так' ? 'Так' : q('related_mp').value;
      if (pp.mp_unit_id) q('related_unit').value = String(pp.mp_unit_id);
      if (pp.military_unit_code) q('related_unit_code').value = pp.military_unit_code;
      if (pp.death_date) q('related_death_date').value = pp.death_date;
      if (pp.burial_date) q('related_burial_date').value = pp.burial_date;
      row.dataset.personId = pp.id;
      showLink();
      row.querySelectorAll('select').forEach((x) => x.dispatchEvent(new Event('change', { bubbles: true })));
    }));
    row.querySelector('[data-act="open"]').addEventListener('click', () => {
      if (confirm('Перейти до картки військового? Незбережені зміни в цій картці буде втрачено.')) openForm(row.dataset.personId);
    });
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
    q('related_death_date').value = r.related_death_date || '';
    q('related_burial_date').value = r.related_burial_date || '';
    q('related_burial_place').value = r.related_burial_place || '';
    q('related_callsign').value = r.related_callsign || '';
    q('related_unit_code').value = r.related_unit_code || '';

    const vis = () => {
      const mp = q('related_mp').value === 'Так';
      row.querySelector('[data-row-mp]').hidden = !mp;
      row.querySelector('[data-row-other]').hidden = !mp || q('related_unit').value !== 'other';
      row.querySelectorAll('[data-row-death]').forEach((el) => { el.hidden = !OPT.deceased_statuses.includes(q('related_status').value); });
    };
    q('related_status').addEventListener('change', vis);
    q('related_mp').addEventListener('change', vis);
    q('related_unit').addEventListener('change', vis);
    row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
    vis();
    $('relations-list').appendChild(row);
    return row;
  }

  // ---------- Рідні в реєстрі (для картки військового) ----------
  let currentCard = null;
  async function loadKin(id) {
    const box = $('kin-box');
    box.hidden = !id;
    $('kin-list').innerHTML = '';
    if (!id) return;
    const { data: me } = await db.from('persons')
      .select('id, last_name, first_name, patronymic, birth_date, military_status, mp_relation, mp_unit_id, military_unit_code, death_date, burial_date, person_programs(program_id)')
      .eq('id', id).single();
    currentCard = me;
    const fio = [me.last_name, me.first_name, me.patronymic].filter(Boolean).join(' ');
    const [linked, byName] = await Promise.all([
      db.from('military_relations')
        .select('id, relation_degree, person:persons!military_relations_person_id_fkey(id, last_name, first_name, patronymic, phone)')
        .eq('related_person_id', id),
      db.from('military_relations')
        .select('id, relation_degree, person:persons!military_relations_person_id_fkey(id, last_name, first_name, patronymic, phone)')
        .is('related_person_id', null).eq('related_full_name', fio)
    ]);
    const ul = $('kin-list');
    const item = (rel, suggested) => {
      const li = document.createElement('li');
      const pr = rel.person;
      const name = [pr.last_name, pr.first_name, pr.patronymic].filter(Boolean).join(' ');
      li.innerHTML = '<span class="kin-deg"></span> <button type="button" class="btn-link kin-open"></button> <span class="muted kin-phone"></span>';
      li.querySelector('.kin-deg').textContent = rel.relation_degree + ' —';
      li.querySelector('.kin-open').textContent = name;
      li.querySelector('.kin-phone').textContent = V.formatPhone(pr.phone) || 'без телефону';
      li.querySelector('.kin-open').addEventListener('click', () => openForm(pr.id));
      if (suggested) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn-link kin-link'; b.textContent = 'Пов’язати';
        b.title = 'У цього родича вказано військового з таким самим ПІБ — пов’язати з цією карткою';
        b.addEventListener('click', async () => {
          const { error } = await db.from('military_relations').update({ related_person_id: id }).eq('id', rel.id);
          if (error) { toast('Не вдалося пов’язати'); return; }
          toast('Пов’язано'); loadKin(id);
        });
        li.append(' ', b);
        li.classList.add('is-suggested');
      }
      ul.appendChild(li);
    };
    (linked.data || []).forEach((r) => item(r, false));
    (byName.data || []).filter((r) => r.person && r.person.id !== id).forEach((r) => item(r, true));
    $('kin-empty').hidden = ul.children.length > 0;
  }

  // Інші рідні того ж військового (коли картки військового немає — напр., загиблий із «200»)
  async function loadOtherKin(id) {
    if (!id) return;
    const rows = [...document.querySelectorAll('#relations-list .row-card')];
    for (const row of rows) {
      const name = row.querySelector('[data-k="related_full_name"]').value.trim();
      const box = row.querySelector('.row-kin');
      box.hidden = true; box.innerHTML = '';
      if (!name) continue;
      const { data } = await db.from('military_relations')
        .select('relation_degree, person:persons!military_relations_person_id_fkey(id, last_name, first_name, patronymic, phone)')
        .eq('related_full_name', name).neq('person_id', id).limit(20);
      if (!data || !data.length) continue;
      box.innerHTML = '<span class="muted">Інші рідні цього військового в реєстрі:</span> ';
      data.forEach((r, k) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn-link';
        b.textContent = `${r.relation_degree} — ${[r.person.last_name, r.person.first_name].filter(Boolean).join(' ')}`;
        b.addEventListener('click', () => { if (confirm('Перейти до цієї картки? Незбережені зміни буде втрачено.')) openForm(r.person.id); });
        if (k) box.append(', ');
        box.appendChild(b);
      });
      box.hidden = false;
    }
  }

  function addRelative() {
    const me = currentCard;
    if (!me) return;
    const fio = [me.last_name, me.first_name, me.patronymic].filter(Boolean).join(' ');
    openForm(null, {
      relativeOf: {
        label: fio,
        programs: (me.person_programs || []).map((x) => x.program_id),
        relation: {
          related_person_id: me.id,
          related_full_name: fio,
          related_birth_date: me.birth_date,
          related_status: OPT.related_status.includes(me.military_status) ? me.military_status : 'Невідомо',
          related_mp: me.mp_relation === 'Так' ? 'Так' : 'Невідомо',
          related_unit_id: me.mp_unit_id,
          related_unit_code: me.military_unit_code,
          related_death_date: me.death_date,
          related_burial_date: me.burial_date
        }
      }
    });
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
        <div class="field"><label for="c${n}-sex">Стать</label>
          <select id="c${n}-sex" data-k="sex"></select></div>
        <div class="field field-span"><label for="c${n}-sn">Особливі потреби</label>
          <input id="c${n}-sn" data-k="special_needs" placeholder="Напр., потребує супроводу"></div>
      </div>
      <p class="sublabel">Інтереси дитини</p>
      <div class="checks checks-grid child-interests"></div>
      <button type="button" class="btn-link btn-remove">Прибрати</button>`;
    row.querySelector('[data-k="birth_date"]').value = c.birth_date || '';
    row.querySelector('[data-k="full_name"]').value = c.full_name || '';
    fillSelect(row.querySelector('[data-k="sex"]'), OPT.child_sex, c.sex || 'Не вказано');
    row.querySelector('[data-k="special_needs"]').value = c.special_needs || '';
    const ibox = row.querySelector('.child-interests');
    const have = new Set(c.interests || []);
    OPT.child_interests.forEach((v) => {
      const l = document.createElement('label');
      l.className = 'check';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = v; cb.checked = have.has(v);
      l.append(cb, ' ' + v);
      ibox.appendChild(l);
    });
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
    $('death-wrap').hidden = !OPT.deceased_statuses.includes(f.military_status.value);
    $('burial-wrap').hidden = $('death-wrap').hidden;
    $('burial-place-wrap').hidden = $('death-wrap').hidden;
  }

  function bind() {
    $('add-btn').addEventListener('click', () => openForm(null));
    $('back-btn').addEventListener('click', closeForm);
    $('cancel-btn').addEventListener('click', closeForm);
    $('pager').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-page]');
      if (!b || b.disabled) return;
      page = Number(b.dataset.page);
      loadList().then(() => $('persons-table').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    });
    // Системна кнопка «Назад»: закрити картку і повернутися до списку
    window.addEventListener('popstate', () => {
      if (!$('form-view').hidden) showList();
    });
    $('person-form').addEventListener('submit', save);
    $('delete-btn').addEventListener('click', removePerson);
    $('kin-add').addEventListener('click', addRelative);
    $('add-relation-btn').addEventListener('click', () => {
      const row = addRelationRow();
      Ui.paint(row);
      row.querySelector('select').focus();
    });
    $('add-child-btn').addEventListener('click', () => {
      const f = $('person-form');
      if (f.has_children.value !== 'Так') f.has_children.value = 'Так';
      const row = addChildRow();
      Ui.paint(row);
      row.querySelector('input').focus();
    });
    ['f-has_disability', 'f-mp_relation', 'f-mp_unit', 'f-military_status', 'f-wounded'].forEach((id) =>
      $(id).addEventListener('change', updateVisibility));
    document.querySelectorAll('.qchips .qchip').forEach((b) => b.addEventListener('click', () => {
      Filters.setQuality(Filters.getQuality() === b.dataset.q ? '' : b.dataset.q);
    }));
    $('reset-all').addEventListener('click', resetAll);
    document.querySelectorAll('.lvchip').forEach((b) => b.addEventListener('click', () => {
      level = b.dataset.level; page = 1; loadList();
    }));
    $('preset-clear').addEventListener('click', () => Filters.clearPreset());
    $('search').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { page = 1; loadList(); }, 300);
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

    // Телефони: одразу виправляємо формат, коли поле втрачає фокус
    ['phone', 'phone2', 'phone3'].forEach((k) => $('f-' + k).addEventListener('blur', () => {
      const r = V.normalizePhone($('f-' + k).value);
      if (r.value) $('f-' + k).value = V.formatPhone(r.value);
      setHint(k, r.error, r.warning);
    }));
  }

  // ---------- Список ----------
  function showList() {
    const fromCard = !$('form-view').hidden;
    $('form-view').hidden = true;
    $('list-view').hidden = false;
    loadList().then(() => { if (fromCard) window.scrollTo(0, listScrollY); });
  }

  // Закрити картку: якщо її відкриття додало крок в історію — повертаємось кроком назад
  function closeForm() {
    if (history.state && history.state.view === 'card') history.back();
    else showList();
  }

  function currentSearch() {
    return $('search').value.trim().replace(/[,()%*\\]/g, ' ').trim();
  }

  // Запит з урахуванням пошуку і фільтрів (для списку та експорту)
  // Повертає { query } (див. коментар у Filters.apply)
  async function buildQuery(columns, opts, skip) {
    let query = db.from('persons_view').select(columns, opts);
    const q = currentSearch();
    if (q) {
      const parts = [`last_name.ilike.%${q}%`, `first_name.ilike.%${q}%`, `patronymic.ilike.%${q}%`];
      const digits = q.replace(/\D/g, '');
      if (digits.length >= 3) parts.push(`phone.ilike.%${digits}%`);
      const full = digits.length >= 9 ? V.normalizePhone(digits).value : null;
      if (full) parts.push(`extra_phones.cs.{${full}}`);   // повний номер шукаємо й серед додаткових
      query = query.or(parts.join(','));
    }
    if (level !== 'all' && !(skip || []).includes('level')) query = applyLevel(query, level === 'main');
    return Filters.apply(query, db, skip);
  }

  // Рівень з урахуванням модуля: якщо в фільтрі обрано модуль(і) — роль саме в них
  function applyLevel(query, main) {
    const sel = (Filters.getState().program_ids || []).map(Number);
    if (sel.length) return query.overlaps(main ? 'main_program_ids' : 'linked_program_ids', sel);
    return query.eq('is_main', main);
  }

  // Модулі (програми ГО) → коротка плашка
  const MODULES = {
    'Супровід родин загиблих (200)': { label: '200', cls: 'm200', rank: 1 },
    'Супровід поранених (300)': { label: '300', cls: 'm300', rank: 2 },
    'Діти Морської піхоти': { label: 'Діти', cls: 'mkids', rank: 3 }
  };
  // Плашки: залита — основна в модулі, контурна — зв’язана в модулі
  function moduleBadges(programIds, mainIds, isExtra) {
    const frag = document.createDocumentFragment();
    const main = new Set((mainIds || []).map(Number));
    (programIds || []).map((id) => ({ id: Number(id), m: MODULES[programs.get(Number(id))] })).filter((x) => x.m)
      .sort((a, b) => a.m.rank - b.m.rank)
      .forEach(({ id, m }) => {
        const isMain = main.has(id);
        const b = document.createElement('span');
        b.className = 'mod ' + m.cls + (isMain ? '' : ' mod-linked');
        b.textContent = m.label;
        b.title = isMain ? `Основна картка в модулі ${m.label}` : `Зв’язана картка в модулі ${m.label} (родич)`;
        frag.appendChild(b);
      });
    if (!(programIds || []).length && isExtra) {
      const b = document.createElement('span'); b.className = 'mod mlinked'; b.textContent = 'зв’язана';
      frag.appendChild(b);
    }
    return frag;
  }
  function primaryModule(programIds, mainIds) {
    const pick = (ids) => (ids || []).map((id) => MODULES[programs.get(Number(id))]).filter(Boolean).sort((a, b) => a.rank - b.rank)[0]?.cls;
    return pick(mainIds) || (pick(programIds) ? 'mlinked' : '');
  }

  // Рівні карток: лічильники і перемикач
  async function loadLevelCounts() {
    const cnt = async (v) => {
      const { query } = await buildQuery('id', { count: 'exact', head: true }, ['level']);
      const { count } = await applyLevel(query, !v);
      return count ?? 0;
    };
    const [m, e] = await Promise.all([cnt(false), cnt(true)]);
    $('lv-main').textContent = m; $('lv-extra').textContent = e; $('lv-all').textContent = m + e;
    document.querySelectorAll('.lvchip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === level)));
  }
  function levelLabel() {
    return level === 'main' ? 'Картки: лише основні' : level === 'extra' ? 'Картки: лише зв’язані' : null;
  }

  // Лічильники для кнопок «Критичні / Бажано доповнити / Заповнені»
  // «Усі» — загальна кількість за поточними умовами (без фільтра стану),
  // «Бажано» = усі − критичні − заповнені (так менше запитів і числа завжди сходяться)
  async function countWith(f) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { query } = await buildQuery('id', { count: 'exact', head: true }, ['quality']);
      const { count, error } = await f(query);
      if (!error && typeof count === 'number') return count;
      console.warn('Лічильник стану картки: повтор', error);
    }
    return null;
  }

  let qcSeq = 0;
  async function loadQualityCounts() {
    const seq = ++qcSeq;
    const [all, crit, ok] = await Promise.all([
      countWith((q) => q),
      countWith((q) => q.gt('critical_count', 0)),
      countWith((q) => q.eq('critical_count', 0).eq('warning_count', 0))
    ]);
    if (seq !== qcSeq) return;          // уже прийшли новіші умови
    const show = (id, v) => { $(id).textContent = v ?? '—'; };
    show('qc-all', all);
    show('qc-crit', crit);
    show('qc-ok', ok);
    show('qc-warn', all !== null && crit !== null && ok !== null ? Math.max(0, all - crit - ok) : null);
    const cur = Filters.getQuality();
    document.querySelectorAll('.qchips .qchip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.q === cur)));
  }

  async function loadList() {
    $('reset-all').hidden = !hasSelection();
    loadQualityCounts().catch((e) => console.error(e));
    loadLevelCounts().catch((e) => console.error(e));
    let query;
    try {
      ({ query } = await buildQuery(
        'id, is_extra, is_main, program_ids, main_program_ids, last_name, first_name, patronymic, phone, extra_phones, region_id, person_categories, family_categories, created_at, critical_count, warning_count, comment, touchpoint, created_by, source',
        { count: 'exact' }));
    } catch (e) {
      console.error(e);
      setListStatus('Не вдалося застосувати фільтри. Оновіть сторінку.');
      return;
    }
    const from = (page - 1) * PAGE_SIZE;
    query = query.order('created_at', { ascending: false }).order('id').range(from, from + PAGE_SIZE - 1);
    const q = currentSearch();

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
    $('count-split').hidden = true;
    $('list-note').hidden = true;
    renderPager(count);

    if (!rows.length) {
      table.hidden = true;
      setListStatus(filtered
        ? 'За цими умовами нікого не знайдено. Змініть пошук або скиньте фільтри.'
        : 'Реєстр порожній. Натисніть «Додати особу», щоб внести першу.');
      return;
    }
    setListStatus('');
    table.hidden = false;

    rows.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.id = p.id;
      tr.tabIndex = 0;

      addCell(tr, String((page - 1) * PAGE_SIZE + idx + 1), 'cell-num');
      tr.appendChild(qualityCell(p.critical_count, p.warning_count));
      const nm = document.createElement('td');
      nm.className = 'cell-name';
      nm.textContent = [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');
      const badges = moduleBadges(p.program_ids, p.main_program_ids, p.is_extra);
      if (badges.childNodes.length) {
        const wrap = document.createElement('div'); wrap.className = 'mods'; wrap.appendChild(badges); nm.appendChild(wrap);
      }
      const pm = primaryModule(p.program_ids, p.main_program_ids);
      if (pm && pm !== 'mlinked') tr.dataset.module = pm;
      if (!p.is_main) tr.classList.add('is-linked');
      tr.appendChild(nm);
      const ph = document.createElement('td');
      ph.className = 'cell-phone';
      ph.textContent = V.formatPhone(p.phone) || '—';
      const nx = (p.extra_phones || []).length;
      if (nx) {
        const more = document.createElement('span');
        more.className = 'tag tag-more';
        more.textContent = `+${nx}`;
        more.title = p.extra_phones.map(V.formatPhone).join(', ');
        ph.append(' ', more);
      }
      tr.appendChild(ph);
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

      tr.appendChild(longCell(p.touchpoint));
      tr.appendChild(longCell(p.comment));

      const who = document.createElement('td');
      who.className = 'cell-who';
      who.innerHTML = '<span></span><br><span class="muted"></span>';
      who.firstChild.textContent = staff.get(p.created_by) || '—';
      who.lastChild.textContent = sourceLabel(p.source);
      tr.appendChild(who);
      tbody.appendChild(tr);
    });
  }

  // Сторінки списку
  function renderPager(count) {
    const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    if (page > pages) page = pages;
    const el = $('pager');
    el.hidden = pages <= 1;
    if (pages <= 1) { el.innerHTML = ''; return; }
    const from = (page - 1) * PAGE_SIZE + 1, to = Math.min(count, page * PAGE_SIZE);
    const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
    let html = `<button type="button" class="pg-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Попередня сторінка">‹</button>`;
    let prev = 0;
    nums.forEach((n) => {
      if (n - prev > 1) html += '<span class="pg-gap">…</span>';
      html += `<button type="button" class="pg-btn${n === page ? ' is-current' : ''}" data-page="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`;
      prev = n;
    });
    html += `<button type="button" class="pg-btn" data-page="${page + 1}" ${page === pages ? 'disabled' : ''} aria-label="Наступна сторінка">›</button>`;
    html += `<span class="pg-info">${from}–${to} з ${count}</span>`;
    el.innerHTML = html;
  }

  async function countExtras(total) {
    const { query } = await buildQuery('id', { count: 'exact', head: true });
    const { count } = await query.eq('is_extra', true);
    $('count-split').textContent = count ? `основних ${total - count} + додаткових (родичі) ${count}` : '';
    $('count-split').hidden = !count;
  }

  function longCell(text) {
    const td = document.createElement('td');
    td.className = 'cell-comment';
    if (text) {
      td.textContent = text.length > 110 ? text.slice(0, 110) + '…' : text;
      td.title = text;
    } else td.textContent = '—';
    return td;
  }

  function sourceLabel(src) {
    return { 'Вручну': 'вручну', 'Excel': 'імпорт Excel', 'Анкета': 'анкета', 'Google Таблиця': 'Google Таблиця' }[src] || src || '';
  }

  function qualityCell(crit, warn) {
    const td = document.createElement('td');
    td.className = 'cell-q';
    if (!crit && !warn) {
      td.innerHTML = '<span class="q-ok" title="Картка заповнена">✓</span>';
      return td;
    }
    const parts = [];
    if (crit) parts.push(`<span class="q-pill q-pill-crit" title="Критично: ${crit}">${crit}</span>`);
    if (warn) parts.push(`<span class="q-pill q-pill-warn" title="Бажано доповнити: ${warn}">${warn}</span>`);
    td.innerHTML = parts.join('');
    return td;
  }

  // Блок «Що потрібно доповнити» в картці
  async function showQuality(id) {
    const box = $('quality-box');
    box.hidden = true;
    if (!id) return;
    const { data, error } = await db.from('persons_view')
      .select('issues_critical, issues_warning').eq('id', id).single();
    if (error) { console.error(error); return; }
    const fill = (ul, items) => {
      ul.innerHTML = '';
      items.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
      ul.hidden = !items.length;
    };
    fill($('quality-critical'), data.issues_critical);
    fill($('quality-warning'), data.issues_warning);
    box.hidden = !data.issues_critical.length && !data.issues_warning.length;
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
  async function openForm(id, opts = {}) {
    const f = $('person-form');
    f.reset();
    clearHints();
    setFormError('');
    editingId = id;
    editingConsentAt = null;
    $('consent-date').textContent = '';
    extraKeep = [];
    programRoles = new Map();
    $('relations-list').innerHTML = '';
    $('children-list').innerHTML = '';

    if (id) {
      const { data, error } = await db.from('persons').select('*, person_veteran_statuses(status), military_relations!military_relations_person_id_fkey(*), children(*), person_programs(program_id, role)').eq('id', id).single();
      if (error) { console.error(error); toast('Не вдалося відкрити картку.'); return; }
      fillForm(data);
      $('form-title').textContent = [data.last_name, data.first_name, data.patronymic].filter(Boolean).join(' ');
      const pids = (data.person_programs || []).map((x) => x.program_id);
      const mids = (data.person_programs || []).filter((x) => x.role === 'main').map((x) => x.program_id);
      programRoles = new Map((data.person_programs || []).map((x) => [x.program_id, x.role]));
      $('form-badges').innerHTML = '';
      $('form-badges').appendChild(moduleBadges(pids, mids, data.is_extra));
      $('form-view').dataset.module = primaryModule(pids, mids) || (data.is_extra ? 'mlinked' : '');
      $('form-meta').textContent = `Додав(ла): ${staff.get(data.created_by) || 'невідомо'} · ${sourceLabel(data.source)} · ${new Date(data.created_at).toLocaleDateString('uk-UA')}`
        + (data.source_ref ? ` · файл «${data.source_ref}»` : '');
      $('form-meta').hidden = false;
    } else {
      $('form-title').textContent = opts.relativeOf ? `Новий родич: ${opts.relativeOf.label}` : 'Нова особа';
      $('form-badges').innerHTML = '';
      $('form-view').dataset.module = opts.relativeOf ? 'mlinked' : '';
      $('form-meta').hidden = true;
      if (opts.relativeOf) {
        $('person-form').is_extra.checked = true;
        // родич потрапляє в ті ж модулі, що й військовий, але як зв’язана картка
        (opts.relativeOf.programs || []).forEach((pid) => {
          programRoles.set(pid, 'linked');
          const cb = $('person-form').querySelector(`input[name="program"][value="${pid}"]`);
          if (cb) cb.checked = true;
        });
        const row = addRelationRow(opts.relativeOf.relation);
        Ui.paint(row);
      }
    }

    $('delete-btn').hidden = !(id && isAdmin);
    loadKin(id).catch((e) => console.error(e));
    Merge.render(id, isAdmin).catch((e) => console.error(e));
    loadOtherKin(id).catch((e) => console.error(e));
    Ui.paint($('person-form'));
    await showQuality(id);
    updateVisibility();
    if ($('form-view').hidden) listScrollY = window.scrollY;
    $('list-view').hidden = true;
    $('form-view').hidden = false;
    if (!history.state || history.state.view !== 'card') history.pushState({ view: 'card' }, '');
    window.scrollTo(0, 0);
    $('f-last_name').focus();
  }

  function fillForm(p) {
    const f = $('person-form');
    ['last_name', 'first_name', 'patronymic', 'birth_date', 'email', 'settlement', 'comment',
     'sex', 'preferred_messenger', 'is_idp'].forEach((k) => { f[k].value = p[k] ?? ''; });
    f.phone.value = V.formatPhone(p.phone);
    const ex = p.extra_phones || [];
    f.phone2.value = V.formatPhone(ex[0] || '');
    f.phone3.value = V.formatPhone(ex[1] || '');
    extraKeep = ex.slice(2);   // якщо з імпорту прийшло більше трьох — не губимо
    f.touchpoint.value = p.touchpoint ?? '';
    f.region_id.value = p.region_id ?? '';
    f.vkmpu_member.checked = p.vkmpu_member;
    f.is_extra.checked = !!p.is_extra;
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

    f.death_date.value = p.death_date || '';
    f.burial_date.value = p.burial_date || '';
    f.burial_place.value = p.burial_place || '';
    f.callsign.value = p.callsign || '';
    f.military_unit_code.value = p.military_unit_code || '';
    f.wounded.value = p.wounded;
    f.wound_date.value = p.wound_date || '';
    f.cell_id.value = p.cell_id ?? '';
    const pids = new Set((p.person_programs || []).map((x) => String(x.program_id)));
    f.querySelectorAll('input[name="program"]').forEach((cb) => { cb.checked = pids.has(cb.value); });

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
    const p2 = V.normalizePhone(f.phone2.value), p3 = V.normalizePhone(f.phone3.value);
    if (p2.error) { setHint('phone2', p2.error); ok = false; } else if (p2.warning) setHint('phone2', null, p2.warning);
    if (p3.error) { setHint('phone3', p3.error); ok = false; } else if (p3.warning) setHint('phone3', null, p3.warning);
    apply('email',      V.normalizeEmail(f.email.value));

    // Інвалідність
    rec.has_disability = f.has_disability.value;
    const dis = rec.has_disability === 'Так';
    rec.disability_group = dis ? f.disability_group.value : 'Не застосовується';
    rec.disability_war_related = dis ? f.disability_war_related.value : 'Не застосовується';

    // Морська піхота
    rec.military_status = f.military_status.value;
    rec.military_unit_code = f.military_unit_code.value.trim() || null;
    rec.cell_id = f.cell_id.value ? Number(f.cell_id.value) : null;
    rec.death_date = null;
    rec.burial_date = null;
    rec.callsign = f.callsign.value.trim() || null;
    rec.burial_place = OPT.deceased_statuses.includes(f.military_status.value) ? (f.burial_place.value.trim() || null) : null;
    rec.name_check = false;          // оператор переглянув і зберіг картку — ПІБ підтверджено
    rec.name_check_note = null;
    if (OPT.deceased_statuses.includes(rec.military_status)) {
      const dd = V.checkBirthDate(f.death_date.value);
      if (dd.error) { setHint('death_date', dd.error); ok = false; }
      else if (dd.value && rec.birth_date && dd.value < rec.birth_date) { setHint('death_date', 'Дата смерті раніше дати народження'); ok = false; }
      else rec.death_date = dd.value;
      const bu = V.checkBirthDate(f.burial_date.value);
      if (bu.error) { setHint('burial_date', bu.error); ok = false; }
      else if (bu.value && rec.death_date && bu.value < rec.death_date) { setHint('burial_date', 'Раніше дати смерті'); ok = false; }
      else rec.burial_date = bu.value;
    }
    rec.wounded = f.wounded.value;
    rec.wound_date = null;
    if (rec.wounded === 'Так') {
      const wd = V.checkBirthDate(f.wound_date.value);
      if (wd.error) { setHint('wound_date', wd.error); ok = false; } else rec.wound_date = wd.value;
    }
    const programIds = [...f.querySelectorAll('input[name="program"]:checked')].map((cb) => Number(cb.value));
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
        related_unit_other: null,
        related_person_id: row.dataset.personId || null,
        related_callsign: q('related_callsign').trim() || null,
        related_unit_code: q('related_unit_code').trim() || null,
        related_death_date: null,
        related_burial_date: null,
        related_burial_place: null
      };
      if (OPT.deceased_statuses.includes(r.related_status)) {
        const dd = V.checkBirthDate(q('related_death_date'));
        if (dd.error) { setRowHint(row, 'related_death_date', dd.error); ok = false; }
        else r.related_death_date = dd.value;
        const bu = V.checkBirthDate(q('related_burial_date'));
        if (bu.error) { setRowHint(row, 'related_burial_date', bu.error); ok = false; }
        else if (bu.value && r.related_death_date && bu.value < r.related_death_date) { setRowHint(row, 'related_burial_date', 'Раніше дати загибелі'); ok = false; }
        else r.related_burial_date = bu.value;
        r.related_burial_place = q('related_burial_place').trim() || null;
      }
      if (!r.relation_degree) { setRowHint(row, 'relation_degree', 'Оберіть ступінь спорідненості'); ok = false; }
      if (r.related_full_name.error) { setRowHint(row, 'related_full_name', r.related_full_name.error); ok = false; }
      r.related_full_name = r.related_full_name.value ?? null;
      const bd = V.checkBirthDate(q('related_birth_date'));
      if (bd.error) { setRowHint(row, 'related_birth_date', bd.error); ok = false; }
      r.related_birth_date = bd.value ?? null;
      if (r.related_death_date && r.related_birth_date && r.related_death_date < r.related_birth_date) {
        setRowHint(row, 'related_death_date', 'Дата смерті раніше дати народження'); ok = false;
      }
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
      children.push({
        birth_date: bd.value,
        full_name: name || null,
        sex: row.querySelector('[data-k="sex"]').value,
        special_needs: row.querySelector('[data-k="special_needs"]').value.trim() || null,
        interests: [...row.querySelectorAll('.child-interests input:checked')].map((cb) => cb.value)
      });
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

    // Додаткові телефони; якщо основний порожній — піднімаємо перший додатковий
    let extras = [p2.value, p3.value, ...extraKeep].filter(Boolean);
    if (!rec.phone && extras.length) rec.phone = extras.shift();
    rec.extra_phones = [...new Set(extras.filter((x) => x !== rec.phone))];
    rec.sex = f.sex.value;
    rec.preferred_messenger = f.preferred_messenger.value;
    rec.is_idp = f.is_idp.value;
    rec.region_id = f.region_id.value ? Number(f.region_id.value) : null;
    rec.settlement = f.settlement.value.trim() || null;
    rec.comment = f.comment.value.trim() || null;
    rec.touchpoint = f.touchpoint.value.trim() || null;
    rec.vkmpu_member = f.vkmpu_member.checked;
    rec.is_extra = f.is_extra.checked;
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
      if (!error) error = (await db.from('person_programs').delete().eq('person_id', personId)).error;
      if (!error && programIds.length) {
        error = (await db.from('person_programs').insert(programIds.map((program_id) => ({
          person_id: personId, program_id,
          role: programRoles.get(program_id) || (rec.is_extra ? 'linked' : 'main')
        })))).error;
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
    closeForm();
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
    closeForm();
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

  function ctx() {
    return { db, operator, regions, cells, programs, staff, sourceLabel, units: new Map(units.map((u) => [u.id, u.name])) };
  }

  // Скинути все: пошук, сегмент, фільтри, швидкий фільтр
  function resetAll() {
    $('search').value = '';
    if (window.Segments) Segments.clear();
    Filters.reset();          // викликає оновлення списку
  }
  function hasSelection() {
    return !!$('search').value.trim() || Filters.activeCount() > 0;
  }

  return { init, showList, buildQuery, ctx, toast, resetAll, hasSelection, openForm, levelLabel };
})();
