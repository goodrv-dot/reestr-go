// ============================================================
// Експорт (ТЗ, розділ 8): Excel для людей і CSV для SendPulse.
// Вивантажується поточний відфільтрований список (пошук + фільтри).
// ============================================================
window.Exporter = (() => {
  const $ = (id) => document.getElementById(id);
  const PAGE = 1000;
  const MOBILE = ['39','50','63','66','67','68','73','75','77','89','91','92','93','94','95','96','97','98','99'];
  let prepared = null; // дані, підготовлені для CSV

  function init() {
    const { operator } = Persons.ctx();
    $('export-box').hidden = !operator.can_export;
    $('export-excel-btn').addEventListener('click', exportExcel);
    $('export-csv-btn').addEventListener('click', openCsvDialog);
    $('csv-close').addEventListener('click', () => $('csv-dialog').close());
    $('csv-download').addEventListener('click', downloadCsv);
    document.querySelectorAll('#csv-dialog input').forEach((i) => i.addEventListener('change', prepareCsv));
  }

  // ---------- Завантаження всіх відфільтрованих рядків ----------
  async function fetchAll(columns) {
    const all = [];
    for (let from = 0; ; from += PAGE) {
      let { query: q } = await Persons.buildQuery(columns);
      q = q.order('last_name').order('first_name').range(from, from + PAGE - 1);
      const { data, error } = await q;
      if (error) throw error;
      all.push(...data);
      if (data.length < PAGE) break;
    }
    return all;
  }

  async function fetchByPersons(table, columns, ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 150) {
      const { data, error } = await Persons.ctx().db.from(table).select(columns).in('person_id', ids.slice(i, i + 150));
      if (error) throw error;
      out.push(...data);
    }
    return out;
  }

  const fio = (p) => [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');
  const d = (v) => (v ? new Date(v).toLocaleDateString('uk-UA') : '');
  const yn = (b) => (b ? 'Так' : 'Ні');
  const years = (bd, until) => {
    if (!bd) return '';
    const b = new Date(bd), e = until ? new Date(until) : new Date();
    let a = e.getFullYear() - b.getFullYear();
    if (e < new Date(e.getFullYear(), b.getMonth(), b.getDate())) a--;
    return a;
  };

  // ---------- Excel ----------
  async function exportExcel() {
    const btn = $('export-excel-btn');
    btn.disabled = true; btn.textContent = 'Готуємо…';
    try {
      const { regions, cells, programs, units } = Persons.ctx();
      const persons = await fetchAll('*');
      if (!persons.length) { Persons.toast('Немає кого вивантажувати: список порожній.'); return; }
      const ids = persons.map((p) => p.id);
      const byId = new Map(persons.map((p) => [p.id, p]));
      const [children, relations] = await Promise.all([
        fetchByPersons('children', '*', ids),
        fetchByPersons('military_relations', '*', ids)
      ]);
      const unitName = (id, other) => (id ? units.get(id) : other) || '';

      const sheetPersons = persons.map((p) => ({
        'Прізвище': p.last_name, 'Ім’я': p.first_name, 'По батькові': p.patronymic || '',
        'Дата народження': d(p.birth_date), 'Вік': p.age ?? '', 'Стать': p.sex,
        'Телефон': p.phone || '', 'Email': p.email || '', 'Месенджер': p.preferred_messenger,
        'Згода на обробку ПД': d(p.consent_pd_at), 'Згода на повідомлення': yn(p.consent_messages), 'Відписався': yn(p.unsubscribed),
        'Військовий статус': p.military_status, 'Дата смерті': d(p.death_date),
        'Статуси ветерана': (p.veteran_statuses || []).join('; '),
        'Поранення': p.wounded, 'Дата поранення': d(p.wound_date), 'В/ч': p.military_unit_code || '',
        'Інвалідність': p.has_disability, 'Група': p.disability_group, 'Через війну': p.disability_war_related,
        'Відношення до МП': p.mp_relation, 'Характер відношення до МП': p.mp_relation_type,
        'Підрозділ МП': unitName(p.mp_unit_id, p.mp_unit_other),
        'Область': regions.get(p.region_id) || '', 'Населений пункт': p.settlement || '', 'ВПО': p.is_idp,
        'Є діти': p.has_children, 'Кількість дітей': p.children_count ?? '', 'Вік дітей': (p.children_ages || []).join(', '),
        'Осередок ГО': cells.get(p.cell_id) || '', 'Програми ГО': (p.program_ids || []).map((x) => programs.get(x)).join('; '),
        'Член ВКМПУ': yn(p.vkmpu_member),
        'Категорії особи': (p.person_categories || []).join('; '), 'Категорії родини': (p.family_categories || []).join('; '),
        'Критично доповнити': (p.issues_critical || []).length, 'Бажано доповнити': (p.issues_warning || []).length,
        'Коментар': p.comment || ''
      }));

      const sheetChildren = children
        .sort((a, b) => fio(byId.get(a.person_id)).localeCompare(fio(byId.get(b.person_id)), 'uk'))
        .map((c) => {
          const p = byId.get(c.person_id);
          return {
            'Батько / мати / представник': fio(p), 'Телефон': p.phone || '',
            'ПІБ дитини': c.full_name || '', 'Дата народження': d(c.birth_date), 'Вік': years(c.birth_date),
            'Стать': c.sex, 'Інтереси': (c.interests || []).join('; '), 'Особливі потреби': c.special_needs || '',
            'Область': regions.get(p.region_id) || ''
          };
        });

      const sheetRelations = relations
        .sort((a, b) => fio(byId.get(a.person_id)).localeCompare(fio(byId.get(b.person_id)), 'uk'))
        .map((r) => {
          const p = byId.get(r.person_id);
          return {
            'Особа': fio(p), 'Телефон особи': p.phone || '', 'Ступінь спорідненості': r.relation_degree,
            'ПІБ військового': r.related_full_name || '', 'Позивний': r.related_callsign || '',
            'Дата народження': d(r.related_birth_date), 'Дата загибелі / смерті': d(r.related_death_date),
            'Вік (на момент смерті)': years(r.related_birth_date, r.related_death_date),
            'Статус': r.related_status, 'МП': r.related_mp,
            'Підрозділ': unitName(r.related_unit_id, r.related_unit_other), 'В/ч': r.related_unit_code || ''
          };
        });

      const wb = XLSX.utils.book_new();
      const info = [
        ['Реєстр — вивантаження'],
        [],
        ['Дата і час', nowText()],
        ['Вивантажив', Persons.ctx().operator.full_name],
        [],
        ['Умови вибірки'],
        ...selection().map((l) => ['', l]),
        [],
        ['Осіб', persons.length],
        ['Дітей', children.length],
        ['Зв’язків з військовими', relations.length]
      ];
      const wsInfo = XLSX.utils.aoa_to_sheet(info);
      wsInfo['!cols'] = [{ wch: 24 }, { wch: 70 }];
      XLSX.utils.book_append_sheet(wb, wsInfo, 'Вибірка');
      addSheet(wb, 'Особи', sheetPersons);
      addSheet(wb, 'Діти', sheetChildren);
      addSheet(wb, 'Зв’язки', sheetRelations);
      XLSX.writeFile(wb, `reiestr_${stamp()}.xlsx`);
      await log('Excel', null, persons.length);
      Persons.toast(`Вивантажено: ${persons.length} осіб, ${children.length} дітей, ${relations.length} зв’язків`);
    } catch (e) {
      console.error(e);
      Persons.toast('Не вдалося сформувати Excel. Спробуйте ще раз.');
    } finally {
      btn.disabled = false; btn.textContent = 'Excel';
    }
  }

  function addSheet(wb, name, rows) {
    const ws = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['Немає даних']]);
    if (rows.length) {
      const keys = Object.keys(rows[0]);
      ws['!cols'] = keys.map((k) => ({
        wch: Math.min(45, Math.max(k.length, ...rows.slice(0, 300).map((r) => String(r[k] ?? '').length)) + 2)
      }));
      ws['!autofilter'] = { ref: ws['!ref'] };
    }
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  // ---------- CSV для SendPulse ----------
  async function openCsvDialog() {
    const dlg = $('csv-dialog');
    $('csv-summary').textContent = 'Рахуємо…';
    $('csv-skipped').innerHTML = '';
    $('csv-download').disabled = true;
    dlg.showModal();
    try {
      prepared = await fetchAll('id, last_name, first_name, patronymic, phone, preferred_messenger, consent_pd_at, consent_messages, unsubscribed, region_id, cell_id, family_categories, person_categories');
      prepareCsv();
    } catch (e) {
      console.error(e);
      $('csv-summary').textContent = 'Не вдалося завантажити дані. Спробуйте ще раз.';
    }
  }

  function skipReason(p, channel, includeUnknown) {
    if (!p.phone) return 'немає телефону';
    if (p.phone.startsWith('+380') && !MOBILE.includes(p.phone.slice(4, 6))) return 'стаціонарний номер';
    if (!p.consent_pd_at) return 'немає згоди на обробку ПД';
    if (p.unsubscribed) return 'відписався';
    if (!p.consent_messages) return 'немає згоди на повідомлення';
    if (p.preferred_messenger !== channel && !(includeUnknown && p.preferred_messenger === 'Не вказано')) {
      return `інший месенджер (${p.preferred_messenger})`;
    }
    return null;
  }

  function prepareCsv() {
    if (!prepared) return;
    const channel = document.querySelector('input[name="csv-channel"]:checked').value;
    const includeUnknown = $('csv-unknown').checked;
    const ok = [], skipped = [];
    prepared.forEach((p) => {
      const r = skipReason(p, channel, includeUnknown);
      if (r) skipped.push({ p, r }); else ok.push(p);
    });

    const reasons = {};
    skipped.forEach(({ r }) => { const k = r.startsWith('інший месенджер') ? 'інший месенджер' : r; reasons[k] = (reasons[k] || 0) + 1; });
    const parts = Object.entries(reasons).map(([k, v]) => `${v} — ${k}`);
    $('csv-summary').textContent =
      `Відібрано ${prepared.length}. До вивантаження в ${channel}: ${ok.length}.` +
      (skipped.length ? ` Пропущено ${skipped.length}: ${parts.join('; ')}.` : '');

    const ul = $('csv-skipped');
    ul.innerHTML = '';
    skipped.filter(({ r }) => !r.startsWith('інший месенджер')).slice(0, 200).forEach(({ p, r }) => {
      const li = document.createElement('li');
      li.textContent = `${fio(p)} — ${r}`;
      ul.appendChild(li);
    });
    $('csv-skipped-wrap').hidden = !ul.children.length;

    $('csv-download').disabled = !ok.length;
    $('csv-download').textContent = `Завантажити CSV (${ok.length})`;
    $('csv-download').dataset.channel = channel;
    prepared.ok = ok;
  }

  async function downloadCsv() {
    const { regions, cells } = Persons.ctx();
    const channel = $('csv-download').dataset.channel;
    const header = ['phone', 'name', 'last_name', 'full_name', 'region', 'cell', 'family_category', 'export_date', 'selection'];
    const when = nowText();
    const sel = `${channel}; ` + selection().join('; ');
    const rows = prepared.ok.map((p) => [
      p.phone.replace('+', ''), p.first_name, p.last_name, fio(p),
      regions.get(p.region_id) || '', cells.get(p.cell_id) || '', (p.family_categories || []).join('; '),
      when, sel
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sendpulse_${channel.toLowerCase()}_${stamp()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    await log('CSV SendPulse', channel, rows.length);
    $('csv-dialog').close();
    Persons.toast(`CSV для ${channel}: ${rows.length} контактів`);
  }

  function csvCell(v) {
    const s = String(v ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  const today = () => new Date().toISOString().slice(0, 10);
  const stamp = () => {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  };
  const nowText = () => new Date().toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });

  // Опис вибірки: пошук + фільтри
  function selection() {
    const q = $('search').value.trim();
    const lines = [...(q ? [`Пошук: ${q}`] : []), ...Filters.describe()];
    return lines.length ? lines : ['Без фільтрів (увесь реєстр)'];
  }

  // Журнал вивантажень (якщо таблиця існує)
  async function log(kind, channel, count) {
    try {
      const filters = selection().join('; ');
      await Persons.ctx().db.from('export_log').insert({ kind, channel, row_count: count, filters_note: filters });
    } catch (e) { console.warn('export_log', e); }
  }

  return { init };
})();
