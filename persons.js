// ============================================================
// Особи: список, пошук, додавання і редагування (крок 5 — основні дані)
// ============================================================
window.Persons = (() => {
  let db = null;
  let started = false;
  let editingId = null;
  let editingConsentAt = null;
  let searchTimer = null;
  const regions = new Map();
  const $ = (id) => document.getElementById(id);

  async function init(client) {
    db = client;
    if (!started) {
      await loadRegions();
      bind();
      started = true;
    }
    showList();
  }

  async function loadRegions() {
    const { data, error } = await db.from('regions').select('id, name').order('sort');
    if (error) throw error;
    const sel = $('f-region_id');
    sel.innerHTML = '<option value="">Не вказано</option>';
    data.forEach((r) => { regions.set(r.id, r.name); sel.add(new Option(r.name, r.id)); });
  }

  function bind() {
    $('add-btn').addEventListener('click', () => openForm(null));
    $('back-btn').addEventListener('click', showList);
    $('cancel-btn').addEventListener('click', showList);
    $('person-form').addEventListener('submit', save);
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
    $('count').textContent = q ? `${count} знайдено` : `${count}`;

    if (!rows.length) {
      table.hidden = true;
      setListStatus(q
        ? `За запитом «${q}» нікого не знайдено.`
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

    if (id) {
      const { data, error } = await db.from('persons').select('*').eq('id', id).single();
      if (error) { console.error(error); toast('Не вдалося відкрити картку.'); return; }
      fillForm(data);
      $('form-title').textContent = [data.last_name, data.first_name, data.patronymic].filter(Boolean).join(' ');
    } else {
      $('form-title').textContent = 'Нова особа';
    }

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
    const { error } = editingId
      ? await db.from('persons').update(rec).eq('id', editingId)
      : await db.from('persons').insert(rec);
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
