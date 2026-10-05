// ============================================================
// «Вивантажити як журнал 200 / 300»: дані реєстру → новий шаблон журналу
// (зі списками й перевірками). Файл збирається в браузері — дані нікуди не передаються.
// ============================================================
window.Journal = (() => {
  const $ = (id) => document.getElementById(id);
  const EXCELJS = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  let loading = null;

  function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve();
    if (!loading) {
      loading = new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = EXCELJS; s.onload = ok; s.onerror = () => fail(new Error('Не вдалося завантажити бібліотеку Excel'));
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  const normH = (h) => String(h || '').toLowerCase().replace(/[’'ʼ`«»"]/g, '').replace(/[—–-]/g, ' ').replace(/\s+/g, ' ').trim();
  // назви колонок у старих журналах, що відрізняються від шаблону
  const ALIASES = {
    'Обставини смерті/загибелі': 'Обставини смерті/загибелі',
    'Відповідальний (по осередкам)': 'Відповідальний (по осередкам)',
    'Відповідальний': 'Відповідальний',
    'Місце перебування зараз': 'Місце перебування',
    'Форма 001/о': 'Форма 001/о'
  };
  const phone = (p) => (p && p.startsWith('+380') ? '0' + p.slice(4) : p || '');
  const dt = (iso) => (iso ? new Date(iso + 'T00:00:00') : null);

  async function exportJournal(kind) {
    const btn = $(`journal-${kind}`);
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Готуємо…';
    try {
      await loadExcelJS();
      const { db, programs, cells, units } = Persons.ctx();
      const progName = kind === '200' ? 'Супровід родин загиблих (200)' : 'Супровід поранених (300)';
      const pid = [...programs].find(([, n]) => n === progName)?.[0];
      if (!pid) throw new Error('Не знайдено програму ' + progName);

      // основні картки модуля з урахуванням поточних фільтрів (напр. осередок)
      const persons = [];
      for (let from = 0; ; from += 1000) {
        const { query } = await Persons.buildQuery('*', undefined, ['level']);
        const q2 = kind === '200' ? query.overlaps('main_program_ids', [pid]) : query.overlaps('program_ids', [pid]);
        const { data, error } = await q2.order('last_name').order('first_name').range(from, from + 999);
        if (error) throw error;
        // «300»: усі поранені рядка журналу, у т.ч. ті, хто помер (у 300 вони стали зв’язаними, основні — у 200)
        persons.push(...(kind === '200' ? data : data.filter((p) =>
          (p.main_program_ids || []).includes(pid) || ['Загиблий', 'Померлий ветеран'].includes(p.military_status))));
        if (data.length < 1000) break;
      }
      if (!persons.length) { Persons.toast(`Немає основних карток модуля ${kind} за цими умовами.`); return; }

      // рідні (зв’язані картки, що посилаються на військового)
      const ids = persons.map((p) => p.id);
      const kin = new Map();
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error } = await db.from('military_relations')
          .select('related_person_id, relation_degree, created_at, person:persons!military_relations_person_id_fkey(last_name, first_name, patronymic, phone, extra_phones, region_id, settlement)')
          .in('related_person_id', ids.slice(i, i + 150)).order('created_at');
        if (error) throw error;
        data.forEach((r) => { if (r.person) kin.set(r.related_person_id, [...(kin.get(r.related_person_id) || []), r]); });
      }
      const vets = new Map();
      if (kind === '300') {
        for (let i = 0; i < ids.length; i += 150) {
          const { data } = await db.from('person_veteran_statuses').select('person_id, status').in('person_id', ids.slice(i, i + 150));
          (data || []).forEach((v) => vets.set(v.person_id, [...(vets.get(v.person_id) || []), v.status]));
        }
      }

      // шаблон із сайту — у ньому списки, перевірки, кольори
      const buf = await (await fetch(`templates/Shablon_${kind}_zhurnal.xlsx?v=${Date.now()}`)).arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.getWorksheet(`Журнал ${kind}`);
      // ExcelJS розбиває перевірки на окремі клітинки й дублює діапазони — збираємо назад по колонках
      const byCol = {};
      Object.entries(ws.dataValidations.model).forEach(([addr, rule]) => {
        const col = addr.replace(/[0-9$]/g, '');
        if (!byCol[col]) byCol[col] = rule;
      });
      ws.dataValidations.model = {};
      Object.entries(byCol).forEach(([col, rule]) => ws.dataValidations.add(`${col}2:${col}1000`, rule));
      const hdr = ws.getRow(1).values;                       // [ , 'ID', 'Статус', …]
      const colOf = (name) => hdr.findIndex((h) => String(h || '').trim() === name);
      // прибираємо рядок-приклад (значення й жовте оформлення)
      ws.getRow(2).eachCell({ includeEmpty: true }, (c) => { c.value = null; c.fill = { type: 'pattern', pattern: 'none' }; c.font = { name: 'Arial' }; });
      const { regions } = Persons.ctx();
      const fio = (p) => [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');

      persons.forEach((p, idx) => {
        const r = idx + 2;
        const set = (name, v) => { const c = colOf(name); if (c > 0 && v !== null && v !== undefined && v !== '') ws.getCell(r, c).value = v; };
        const rel = kin.get(p.id) || [];
        set('ID', `${kind}-${String(idx + 1).padStart(4, '0')}`);
        // колонки з журналу-джерела (звання, посада, етапи супроводу…) — один до одного за назвою
        const jd = (p.journal && p.journal[kind]) || {};
        const jn = new Map(Object.entries(jd).map(([k, v]) => [normH(k), v]));
        hdr.forEach((h, c) => {
          if (!h || c === 0) return;
          const v = jn.get(normH(h)) ?? jn.get(normH(ALIASES[String(h).trim()] || ''));
          if (v === undefined || v === null || v === '') return;
          const isDate = /^\d{4}-\d{2}-\d{2}$/.test(String(v));
          ws.getCell(r, c).value = isDate ? dt(v) : v;
        });
        set('Осередок ГО', cells.get(p.cell_id));
        set('Примітки', p.comment);
        if (kind === '200') {
          set('Загиблий — Прізвище', p.last_name); set('Загиблий — Ім’я', p.first_name); set('Загиблий — По батькові', p.patronymic);
          set('Позивний', p.callsign); set('Дата народження', dt(p.birth_date)); set('Дата загибелі', dt(p.death_date));
          set('Військова частина', p.military_unit_code); set('Бригада', p.mp_unit_id ? units.get(p.mp_unit_id) : p.mp_unit_other);
          set('Дата поховання', dt(p.burial_date)); set('Місце поховання', p.burial_place);
          if (!rel.length) set('Статус', 'Родину не встановлено');
          const [rec, k2, k3] = rel;
          if (rec) {
            const k = rec.person;
            set('Отримувач — Ступінь', rec.relation_degree); set('Отримувач — Прізвище', k.last_name);
            set('Отримувач — Ім’я', k.first_name); set('Отримувач — По батькові', k.patronymic);
            set('Отримувач — Телефон', phone(k.phone)); set('Отримувач — Дод. телефон', phone((k.extra_phones || [])[0]));
            set('Отримувач — Область', regions.get(k.region_id)); set('Отримувач — Населений пункт', k.settlement);
          }
          [[k2, 2], [k3, 3]].forEach(([x, n]) => {
            if (!x) return;
            set(`Родич ${n} — Ступінь`, x.relation_degree); set(`Родич ${n} — ПІБ`, fio(x.person)); set(`Родич ${n} — Телефон`, phone(x.person.phone));
          });
        } else {
          set('Поранений — Прізвище', p.last_name); set('Поранений — Ім’я', p.first_name); set('Поранений — По батькові', p.patronymic);
          set('Дата народження', dt(p.birth_date)); set('Телефон', phone(p.phone)); set('Дод. телефон', phone((p.extra_phones || [])[0]));
          set('Бригада', p.mp_unit_id ? units.get(p.mp_unit_id) : p.mp_unit_other); set('В/ч', p.military_unit_code);
          set('Дата поранення', dt(p.wound_date));
          set('УБД', (vets.get(p.id) || []).includes('Учасник бойових дій') ? 'Так' : '');
          if (['Загиблий', 'Померлий ветеран'].includes(p.military_status)) { set('Стан', 'Помер'); set('Дата смерті', dt(p.death_date)); }
          rel.slice(0, 3).forEach((x, i) => {
            set(`Родич ${i + 1} — Ступінь`, x.relation_degree); set(`Родич ${i + 1} — ПІБ`, fio(x.person)); set(`Родич ${i + 1} — Телефон`, phone(x.person.phone));
          });
          if (rel.length > 3) set('Проблематика', `Ще родичів у реєстрі: ${rel.length - 3}`);
        }
      });

      const out = await wb.xlsx.writeBuffer();
      const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Zhurnal_${kind}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      Persons.toast(`Журнал ${kind}: ${persons.length} рядків`);
    } catch (e) {
      console.error(e);
      Persons.toast('Не вдалося сформувати журнал: ' + (e.message || 'помилка'));
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  function init() {
    ['200', '300'].forEach((k) => $(`journal-${k}`).addEventListener('click', () => exportJournal(k)));
  }
  return { init };
})();
