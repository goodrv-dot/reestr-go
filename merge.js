// ============================================================
// Можливі дублікати та об’єднання карток (у картці особи)
// Об’єднує в ПОТОЧНУ картку: телефони, порожні поля, дітей, зв’язки,
// програми, статуси; друга картка видаляється (лише адміністратор).
// ============================================================
window.Merge = (() => {
  const $ = (id) => document.getElementById(id);
  const stem = (s) => String(s || '').toLowerCase().replace(/[^a-zа-яіїєґ]/gi, '').slice(0, 4);
  const lettersOf = (s) => String(s || '').toLowerCase().replace(/[^a-zа-яіїєґ’']/gi, '');
  const fio = (p) => [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');

  // Пошук кандидатів
  async function findCandidates(id) {
    const { db } = Persons.ctx();
    const { data: me } = await db.from('persons')
      .select('id, last_name, first_name, phone, extra_phones, name_check, military_relations!military_relations_person_id_fkey(related_full_name)')
      .eq('id', id).single();
    if (!me) return [];
    const COLS = 'id, last_name, first_name, patronymic, phone, extra_phones, name_check, source, created_at';
    const found = new Map();
    const add = (rows, why) => (rows || []).forEach((p) => {
      if (p.id === id) return;
      const prev = found.get(p.id);
      found.set(p.id, { ...p, why: prev ? prev.why + '; ' + why : why });
    });

    // а) те саме ім’я і схоже прізвище (Цибін / Цибіна)
    if (me.first_name && stem(me.last_name)) {
      const { data } = await db.from('persons').select(COLS)
        .ilike('last_name', `${stem(me.last_name)}%`).eq('first_name', me.first_name).limit(10);
      add(data, 'схоже ПІБ');
    }
    // б) спільний телефон
    const phones = [me.phone, ...(me.extra_phones || [])].filter(Boolean);
    if (phones.length) {
      const [a, b] = await Promise.all([
        db.from('persons').select(COLS).in('phone', phones),
        db.from('persons').select(COLS).overlaps('extra_phones', phones)
      ]);
      add(a.data, 'той самий телефон'); add(b.data, 'той самий телефон');
    }
    // в) тимчасова картка (ПІБ неповне), пов’язана з тим самим військовим
    const mil = (me.military_relations || []).map((r) => r.related_full_name).filter(Boolean);
    if (mil.length) {
      const { data } = await db.from('military_relations')
        .select('person:persons!military_relations_person_id_fkey(' + COLS + ')')
        .in('related_full_name', mil).limit(30);
      const others = (data || []).map((r) => r.person).filter((p) => p && (p.name_check || me.name_check));
      add(others, 'тимчасове ПІБ у родини того ж військового');
    }
    return [...found.values()];
  }

  async function render(id, isAdmin) {
    const box = $('dup-box');
    box.hidden = true;
    $('dup-list').innerHTML = '';
    if (!id) return;
    let cands = [];
    try { cands = await findCandidates(id); } catch (e) { console.error(e); return; }
    if (!cands.length) return;
    cands.forEach((c) => {
      const li = document.createElement('li');
      li.innerHTML = '<button type="button" class="btn-link dup-open"></button> <span class="muted dup-meta"></span> ';
      li.querySelector('.dup-open').textContent = fio(c) + (c.name_check ? ' (тимчасове ПІБ)' : '');
      li.querySelector('.dup-meta').textContent =
        `${V.formatPhone(c.phone) || 'без телефону'} · ${c.why}`;
      li.querySelector('.dup-open').addEventListener('click', () => {
        if (confirm('Перейти до цієї картки? Незбережені зміни буде втрачено.')) Persons.openForm(c.id);
      });
      if (isAdmin) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn-secondary btn-small';
        b.textContent = 'Об’єднати в цю картку';
        b.addEventListener('click', () => mergeInto(id, c));
        li.appendChild(b);
      }
      $('dup-list').appendChild(li);
    });
    $('dup-note').textContent = isAdmin
      ? 'Перевірте, що це та сама людина. Об’єднання перенесе в цю картку телефони, дітей, зв’язки й заповнить порожні поля, а другу картку видалить.'
      : 'Схоже на ту саму людину. Об’єднати картки може адміністратор.';
    box.hidden = false;
  }

  // ---------- Об’єднання ----------
  const EMPTY = (v) => v === null || v === undefined || v === '' ||
    ['Невідомо', 'Не вказано', 'Не застосовується'].includes(v);

  async function mergeInto(keepId, other) {
    if (!confirm(`Об’єднати «${fio(other)}» у поточну картку?\n\nДруга картка буде видалена, її дані — перенесені сюди. Скасувати неможливо.`)) return;
    const { db } = Persons.ctx();
    const EMB = '*, children(*), military_relations!military_relations_person_id_fkey(*), person_programs(program_id), person_veteran_statuses(status)';
    try {
      const [{ data: keep, error: e1 }, { data: oth, error: e2 }] = await Promise.all([
        db.from('persons').select(EMB).eq('id', keepId).single(),
        db.from('persons').select(EMB).eq('id', other.id).single()
      ]);
      if (e1 || e2) throw (e1 || e2);

      // 1. Телефони
      const phones = [...new Set([keep.phone, ...(keep.extra_phones || []), oth.phone, ...(oth.extra_phones || [])].filter(Boolean))];
      // 2. Порожні поля поточної картки беремо з другої
      const patch = {};
      const SKIP = ['id', 'created_at', 'updated_at', 'created_by', 'phone', 'extra_phones', 'children', 'military_relations',
        'person_programs', 'person_veteran_statuses', 'import_batch_id', 'name_check', 'name_check_note', 'comment', 'is_extra', 'source', 'source_ref'];
      Object.keys(oth).forEach((k) => {
        if (SKIP.includes(k)) return;
        if (EMPTY(keep[k]) && !EMPTY(oth[k])) patch[k] = oth[k];
        if (typeof oth[k] === 'boolean' && oth[k] && !keep[k] && ['vkmpu_member', 'consent_messages'].includes(k)) patch[k] = true;
      });
      if (keep.name_check && !oth.name_check) {
        Object.assign(patch, { last_name: oth.last_name, first_name: oth.first_name, patronymic: oth.patronymic, name_check: false, name_check_note: null });
      }
      if (oth.comment) patch.comment = [keep.comment, oth.comment].filter(Boolean).join('\n');
      if (!oth.is_extra && keep.is_extra) patch.is_extra = false;
      patch.phone = phones[0] || null;
      patch.extra_phones = phones.slice(1);
      if (!keep.consent_pd_at || (oth.consent_pd_at && oth.consent_pd_at < keep.consent_pd_at)) patch.consent_pd_at = oth.consent_pd_at || keep.consent_pd_at;

      // знімаємо телефони з другої картки, щоб не було конфлікту унікальності
      let r = await db.from('persons').update({ phone: null, extra_phones: [] }).eq('id', oth.id);
      if (r.error) throw r.error;
      r = await db.from('persons').update(patch).eq('id', keep.id);
      if (r.error) throw r.error;

      // 3. Діти (без повторів за датою народження)
      const kidDates = new Set((keep.children || []).map((c) => c.birth_date));
      const moveKids = (oth.children || []).filter((c) => !kidDates.has(c.birth_date)).map((c) => c.id);
      if (moveKids.length) { r = await db.from('children').update({ person_id: keep.id }).in('id', moveKids); if (r.error) throw r.error; }

      // 4. Зв’язки з військовими (без повторів за ПІБ військового)
      const relNames = new Set((keep.military_relations || []).map((x) => lettersOf(x.related_full_name)));
      const moveRels = (oth.military_relations || []).filter((x) => !relNames.has(lettersOf(x.related_full_name))).map((x) => x.id);
      if (moveRels.length) { r = await db.from('military_relations').update({ person_id: keep.id }).in('id', moveRels); if (r.error) throw r.error; }
      // посилання інших карток на другу картку → на поточну
      r = await db.from('military_relations').update({ related_person_id: keep.id }).eq('related_person_id', oth.id);
      if (r.error) throw r.error;

      // 5. Програми і статуси ветерана
      const progs = (oth.person_programs || []).map((x) => x.program_id).filter((pid) => !(keep.person_programs || []).some((y) => y.program_id === pid));
      if (progs.length) { r = await db.from('person_programs').insert(progs.map((program_id) => ({ person_id: keep.id, program_id }))); if (r.error) throw r.error; }
      const vets = (oth.person_veteran_statuses || []).map((x) => x.status).filter((st) => !(keep.person_veteran_statuses || []).some((y) => y.status === st));
      if (vets.length) { r = await db.from('person_veteran_statuses').insert(vets.map((status) => ({ person_id: keep.id, status }))); if (r.error) throw r.error; }

      // 6. Видалити другу картку
      r = await db.from('persons').delete().eq('id', oth.id).select('id');
      if (r.error || !r.data.length) throw r.error || new Error('Не вдалося видалити другу картку (потрібні права адміністратора)');

      Persons.toast('Картки об’єднано');
      Persons.openForm(keep.id);
    } catch (e) {
      console.error(e);
      alert('Не вдалося об’єднати картки: ' + (e.message || 'помилка бази') + '\nЧастину даних могло бути перенесено — перевірте обидві картки.');
      Persons.openForm(keepId);
    }
  }

  return { render };
})();
