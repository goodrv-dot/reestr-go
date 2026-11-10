// ============================================================
// Робот-дзеркало: побудова рядків журналу 200 / 300 з даних кабінету.
// Та сама логіка колонок, що й «Журнал 200 / 300» на сайті (journal.js).
// Чиста функція без мережі — щоб її можна було перевірити окремо.
// v10 (10.11.2026): індекси колонок рахуються один раз на модуль, а не для кожного значення
// (раніше нормалізація назв колонок у циклі по значеннях з’їдала ліміт процесорного часу).
// ============================================================

export const HEADERS: Record<string, string[]> = {
  '200': ['ID', 'Статус', 'Виконавець', 'Осередок ГО', '№ сповіщення', 'Дата сповіщення', 'Загиблий — Прізвище', 'Загиблий — Ім’я', 'Загиблий — По батькові', 'Позивний', 'Дата народження', 'Дата загибелі', 'Обставини смерті/загибелі', 'Звання', 'Посада', 'Військова частина', 'Бригада', 'Контакти підрозділу', 'ТЦК', 'Контакти ТЦК', 'Дата поховання', 'Місце поховання', 'Отримувач — Ступінь', 'Отримувач — Прізвище', 'Отримувач — Ім’я', 'Отримувач — По батькові', 'Отримувач — Телефон', 'Отримувач — Дод. телефон', 'Отримувач — Область', 'Отримувач — Населений пункт', 'Отримувач — Адреса', 'Родич 2 — Ступінь', 'Родич 2 — ПІБ', 'Родич 2 — Телефон', 'Родич 3 — Ступінь', 'Родич 3 — ПІБ', 'Родич 3 — Телефон', 'Зв’язок з родиною', 'Долучення до спільноти', 'Перший дзвінок', 'Другий дзвінок (через тиждень)', 'Третій дзвінок (через 2 місяці)', 'Відповідальний (по осередкам)', 'Виїзна команда, водій', 'Кореспонденція', 'Атрибутика', 'Вручення атрибутики', 'Табличка на хрест', 'Довідка про поховання', 'Присутність побратимів', 'Проблемні питання', 'Вирішення проблем', 'Юридичний супровід родини', 'Нагорода «За мужність»', 'Вручення Листа пошани', 'Нагорода «Морського піхотинця»', 'Примітки'],
  '300': ['ID', 'Відповідальний', 'Дата звернення', 'Осередок ГО', 'Стан', 'Дата смерті', 'Поранений — Прізвище', 'Поранений — Ім’я', 'Поранений — По батькові', 'Дата народження', 'Звання', 'Телефон', 'Дод. телефон', 'Бригада', 'В/ч', 'Дата поранення', 'УБД', 'Форма 001/о', 'Довідка про обставини травми', 'Місце реабілітації', 'Місце перебування зараз', 'Додаткові довідки', 'Родич 1 — Ступінь', 'Родич 1 — ПІБ', 'Родич 1 — Телефон', 'Родич 2 — Ступінь', 'Родич 2 — ПІБ', 'Родич 2 — Телефон', 'Родич 3 — Ступінь', 'Родич 3 — ПІБ', 'Родич 3 — Телефон', 'Проблематика', 'Примітки']
};
// Нові модулі: колонки як у журналах-джерелах (Google Таблиці «Зниклі безвісти», «Звільнені з полону», «Ветерани МП»)
// плюс номер справи, статус і осередок; ПІБ — трьома колонками, «в/ч, бригада» і «№ сповіщення/дата» — окремо
const KIN3 = [1, 2, 3].flatMap((n) => [`Родич ${n} — Ступінь`, `Родич ${n} — ПІБ`, `Родич ${n} — Телефон`]);
HEADERS['bzv'] = ['ID', 'Статус', 'Виконавець', 'Регіон', '№ сповіщення', 'Дата сповіщення', 'Зник безвісти', 'Звання', 'Прізвище', 'Ім’я', 'По батькові', 'Дата народження', 'В/ч', 'Бригада', 'Посада', 'Отримувач сповіщення', 'Спорідненість', 'Адреса отримувача', 'ЦВС', 'Тел.', 'Родич 2 — Ступінь', 'Родич 2 — ПІБ', 'Родич 2 — Телефон', 'Примітки'];
HEADERS['pol'] = ['ID', 'Статус', 'Відповідальний', 'Осередок ГО', 'Звання', 'Прізвище', 'Ім’я', 'По батькові', 'Дата народження', 'Номер телефону', 'В/ч', 'Бригада', 'Дата звільнення', 'Довідка форми 511', 'Місце реінтеграції', 'Місце лікування', 'Місце реабілітації', 'Місце перебування зараз', 'Довідка про обставини травми', 'Додаткові довідки', 'УБД', 'Місце народження', ...KIN3, 'Примітки'];
HEADERS['vet'] = ['ID', 'Статус', 'Виконавець', 'Регіон', 'Звання', 'Прізвище', 'Ім’я', 'По батькові', 'Дата народження', 'Номер телефону', 'Військова частина', 'Бригада', 'Місце проживання', 'Стан в/сл', 'Інвалідність', ...KIN3, 'Примітки'];
export const NEW_KINDS = ['bzv', 'pol', 'vet'];
export const TAB_NAME: Record<string, string> = { '200': '200', '300': '300', bzv: 'БЗВ', pol: 'Звільнені з полону', vet: 'Ветерани' };
const autoW = (h: string) => (/^ID$/.test(h) ? 11 : /Дата|Зник|Тел|Телефон|УБД|В\/ч|Звання|Ступінь|Спорідненість|Інвалідність/.test(h) ? 14 : /ПІБ|Адреса|Примітки|Місце|Посада|Довідка|Отримувач|ЦВС|Стан/.test(h) ? 26 : 16);
// ширина колонок як у шаблоні журналу (у символах)
export const WIDTHS: Record<string, number[]> = {
  '200': [11, 18, 16, 16, 12, 13, 18, 14, 18, 12, 13, 13, 30, 16, 16, 13, 14, 18, 16, 16, 13, 22, 14, 18, 14, 18, 15, 15, 18, 18, 26, 13, 26, 15, 13, 26, 15, 18, 18, 13, 15, 15, 16, 18, 18, 14, 14, 16, 12, 18, 24, 24, 18, 18, 18, 18, 30],
  '300': [11, 16, 13, 16, 16, 13, 18, 14, 18, 13, 16, 15, 15, 14, 12, 13, 14, 14, 16, 22, 22, 20, 13, 26, 15, 13, 26, 15, 13, 26, 15, 26, 30]
};
const EXTRA_COLS = ['Допомагають', 'Контактна особа'];
const ALIASES: Record<string, string> = { 'Місце перебування зараз': 'Місце перебування' };

const normCache = new Map<string, string>();
// назви колонок журналу повторюються в кожній справі — нормалізуємо кожну лише раз
export const normH = (h: unknown) => {
  const k = String(h ?? ''); let v = normCache.get(k);
  if (v === undefined) { v = k.toLowerCase().replace(/[’'ʼ`«»"]/g, '').replace(/[—–-]/g, ' ').replace(/\s+/g, ' ').trim(); if (normCache.size < 5000) normCache.set(k, v); }
  return v;
};
const phone = (p?: string | null) => (p && p.startsWith('+380') ? '0' + p.slice(4) : p || '');
const fio = (p: any) => [p?.last_name, p?.first_name, p?.patronymic].filter(Boolean).join(' ');
const ISO = /^\d{4}-\d{2}-\d{2}$/;
// дата → порядковий номер дня Google Таблиць (тоді в таблиці вона сортується як дата)
export const serial = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  return Number.isNaN(t) ? iso : (t - Date.UTC(1899, 11, 30)) / 86400000;
};

export type Input = {
  cases: any[];                       // справи з person, case_values, kin
  defs: { module: string; key: string; label: string; sheet_column: string | null; active: boolean; sort: number }[];
  ops: Map<string, string>; cells: Map<number, string>; regions: Map<number, string>; units: Map<number, string>;
  vets: Map<string, string[]>;
};
// cellOf — для аркуша осередку: значення фільтра (назва осередку) і колонка, за якою фільтрувати головний аркуш
export type Tab = { title: string; module: string; header: string[]; widths: number[]; rows: (string | number)[][]; dateCols: number[]; cellOf?: { name: string; col: number; known: string[] } };

export function buildTabs(inp: Input, cellNames: string[], kinds: string[] = ['200', '300']): Tab[] {
  const tabs: Tab[] = [];
  for (const kind of kinds) {
    const defs = inp.defs.filter((d) => d.module === kind);
    const colOfKey = new Map(defs.map((d) => [d.key, d.sheet_column || d.label]));
    const header = [...HEADERS[kind], ...EXTRA_COLS];
    const widths = [...(WIDTHS[kind] || HEADERS[kind].map(autoW)), 26, 30];
    // нові поля з «Налаштування полів», яких немає в шаблоні, — колонками в кінці
    defs.filter((d) => d.active && d.key !== 'executor_legacy').sort((a, b) => a.sort - b.sort).forEach((d) => {
      const name = (d.sheet_column || d.label).trim();
      if (name && !header.some((h) => normH(h) === normH(name))) { header.push(name); widths.push(20); }
    });
    // індекси колонок — один раз на модуль
    const byName = new Map<string, number>(); header.forEach((h, i) => { if (!byName.has(h)) byName.set(h, i); });
    const hNorm = header.map(normH);
    const byNorm = new Map<string, number>(); hNorm.forEach((n, i) => { if (!byNorm.has(n)) byNorm.set(n, i); });
    const aliasNorm = header.map((h) => normH(ALIASES[h] || ''));
    const keyCol = new Map<string, number>(); colOfKey.forEach((col, key) => keyCol.set(key, byNorm.get(normH(col)) ?? -1));
    const colOf = (name: string) => byName.get(name) ?? -1;
    const dates = new Set<number>();
    // порядок у дзеркалі: зворотний до порядку внесення — останні рядки журналу-джерела й нові справи вгорі
    // (за часом створення картки); «Не беремо в роботу» — окремим блоком у самому низу таблиці
    const NOT_TAKEN = 'Не беремо в роботу';
    const num = (c: any) => Number(String(c.journal_id).split('-').pop()) || 0;
    const born = (c: any) => String(c.person?.created_at || '');
    const list = inp.cases.filter((c) => c.module === kind)
      .sort((a, b) => Number(a.status === NOT_TAKEN) - Number(b.status === NOT_TAKEN) || (born(a) < born(b) ? 1 : born(a) > born(b) ? -1 : 0) || num(b) - num(a));
    const out: { cell: string; row: (string | number)[] }[] = [];

    for (const cs of list) {
      const p = cs.person || {};
      const row: (string | number)[] = new Array(header.length).fill('');
      const put = (c: number, v: unknown) => {
        if (c < 0 || v === null || v === undefined || v === '') return;
        const s = String(v);
        if (ISO.test(s)) { row[c] = serial(s); dates.add(c); } else row[c] = s;
      };
      const set = (name: string, v: unknown) => put(colOf(name), v);
      let rel: any[] = cs.kin || [];
      const contact = cs.contact_person_id ? rel.find((x) => x.person?.id === cs.contact_person_id) : null;
      if (contact) rel = [contact, ...rel.filter((x) => x !== contact)];

      set('ID', cs.journal_id);
      // колонки з журналу-джерела — один до одного за назвою
      const jd = (p.journal && p.journal[kind]) || null;
      if (jd) {
        const jn = new Map<string, unknown>(); for (const k in jd) jn.set(normH(k), jd[k]);
        for (let c = 0; c < header.length; c++) put(c, jn.get(hNorm[c]) ?? jn.get(aliasNorm[c]));
      }
      // дані кабінету
      const isNew = NEW_KINDS.includes(kind);
      set(kind === '300' ? 'Стан' : 'Статус', cs.status);
      if (cs.executor_id) set(kind === '300' || kind === 'pol' ? 'Відповідальний' : 'Виконавець', inp.ops.get(cs.executor_id));
      if (cs.responsible_id) set('Відповідальний (по осередкам)', inp.ops.get(cs.responsible_id));
      set('Допомагають', (cs.helper_ids || []).map((u: string) => inp.ops.get(u)).filter(Boolean).join(', '));
      const k0 = rel[0];
      if (k0) set('Контактна особа', `${fio(k0.person)} (${k0.relation_degree})` + (k0.person?.phone ? ', ' + phone(k0.person.phone) : ''));
      for (const v of cs.case_values || []) {
        if (!v.value || v.stage_key === 'executor_legacy') continue;
        const c = keyCol.get(v.stage_key);
        if (c === undefined) continue;
        put(c, v.value);
      }
      const cellName = inp.cells.get(cs.cell_id ?? p.cell_id) || '';
      set('Осередок ГО', cellName);
      set('Примітки', p.comment);
      if (isNew) {
        if (kind !== 'pol') set('Регіон', cellName);
        set('Прізвище', p.last_name); set('Ім’я', p.first_name); set('По батькові', p.patronymic);
        set('Дата народження', p.birth_date); set('Номер телефону', phone(p.phone));
        set(kind === 'vet' ? 'Військова частина' : 'В/ч', p.military_unit_code);
        set('Бригада', p.mp_unit_id ? inp.units.get(p.mp_unit_id) : p.mp_unit_other);
        set('Місце проживання', p.settlement);
        if (kind === 'bzv') {
          const [rec, k2] = rel;
          if (rec) {
            set('Отримувач сповіщення', fio(rec.person)); set('Спорідненість', rec.relation_degree);
            set('Адреса отримувача', [inp.regions.get(rec.person?.region_id), rec.person?.settlement].filter(Boolean).join(', '));
            set('Тел.', phone(rec.person?.phone));
          }
          if (k2) { set('Родич 2 — Ступінь', k2.relation_degree); set('Родич 2 — ПІБ', fio(k2.person)); set('Родич 2 — Телефон', phone(k2.person?.phone)); }
        } else {
          rel.slice(0, 3).forEach((x, i) => {
            set(`Родич ${i + 1} — Ступінь`, x.relation_degree); set(`Родич ${i + 1} — ПІБ`, fio(x.person)); set(`Родич ${i + 1} — Телефон`, phone(x.person?.phone));
          });
        }
      } else if (kind === '200') {
        set('Загиблий — Прізвище', p.last_name); set('Загиблий — Ім’я', p.first_name); set('Загиблий — По батькові', p.patronymic);
        set('Позивний', p.callsign); set('Дата народження', p.birth_date); set('Дата загибелі', p.death_date);
        set('Військова частина', p.military_unit_code); set('Бригада', p.mp_unit_id ? inp.units.get(p.mp_unit_id) : p.mp_unit_other);
        set('Дата поховання', p.burial_date); set('Місце поховання', p.burial_place);
        const [rec, k2, k3] = rel;
        if (rec) {
          const k = rec.person || {};
          set('Отримувач — Ступінь', rec.relation_degree); set('Отримувач — Прізвище', k.last_name);
          set('Отримувач — Ім’я', k.first_name); set('Отримувач — По батькові', k.patronymic);
          set('Отримувач — Телефон', phone(k.phone)); set('Отримувач — Дод. телефон', phone((k.extra_phones || [])[0]));
          set('Отримувач — Область', inp.regions.get(k.region_id)); set('Отримувач — Населений пункт', k.settlement);
        }
        ([[k2, 2], [k3, 3]] as [any, number][]).forEach(([x, n]) => {
          if (!x) return;
          set(`Родич ${n} — Ступінь`, x.relation_degree); set(`Родич ${n} — ПІБ`, fio(x.person)); set(`Родич ${n} — Телефон`, phone(x.person?.phone));
        });
      } else {
        set('Поранений — Прізвище', p.last_name); set('Поранений — Ім’я', p.first_name); set('Поранений — По батькові', p.patronymic);
        set('Дата народження', p.birth_date); set('Телефон', phone(p.phone)); set('Дод. телефон', phone((p.extra_phones || [])[0]));
        set('Бригада', p.mp_unit_id ? inp.units.get(p.mp_unit_id) : p.mp_unit_other); set('В/ч', p.military_unit_code);
        set('Дата поранення', p.wound_date);
        const ubd = colOf('УБД');
        if (ubd >= 0 && row[ubd] === '' && (inp.vets.get(p.id) || []).includes('Учасник бойових дій')) row[ubd] = 'Так';
        if (['Загиблий', 'Померлий ветеран'].includes(p.military_status)) { set('Стан', 'Помер'); set('Дата смерті', p.death_date); }
        rel.slice(0, 3).forEach((x, i) => {
          set(`Родич ${i + 1} — Ступінь`, x.relation_degree); set(`Родич ${i + 1} — ПІБ`, fio(x.person)); set(`Родич ${i + 1} — Телефон`, phone(x.person?.phone));
        });
        if (rel.length > 3) set('Проблематика', `Ще родичів у реєстрі: ${rel.length - 3}`);
      }
      out.push({ cell: cellName || 'Без осередку', row });
    }

    const dateCols = [...dates].sort((a, b) => a - b);
    tabs.push({ title: `Журнал ${TAB_NAME[kind] || kind}`, module: kind, header, widths, rows: out.map((o) => o.row), dateCols });
    // аркуш на кожен осередок довідника — навіть порожній; «Без осередку» — наприкінці.
    // Рядки аркуша осередку будує сама таблиця (формула FILTER з головного аркуша) — тут лише їх кількість для розміру сітки.
    const cellCol = colOf('Осередок ГО') >= 0 ? colOf('Осередок ГО') : colOf('Регіон');
    const names = [...cellNames].sort((a, b) => a.localeCompare(b, 'uk'));
    if (out.some((o) => o.cell === 'Без осередку')) names.push('Без осередку');
    for (const name of names) {
      const safe = name.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 90);
      tabs.push({ title: `${TAB_NAME[kind] || kind} ${safe}`, module: kind, header, widths, rows: out.filter((o) => o.cell === name).map((o) => o.row), dateCols,
        cellOf: { name, col: cellCol, known: cellNames } });
    }
  }
  return tabs;
}

// ------------------------------------------------------------
// Довідники для випадних списків — як у журналах Zhurnal_200_2026-10-06 і Zhurnal_300_2026-10-05:
// ті самі переліки й ті самі колонки. Осередки — завжди повний живий список із бази;
// до виконавців / відповідальних додаються співробітники з кабінету, яких у переліку ще немає.
// ------------------------------------------------------------
export type ListCol = { title: string; columns: string[]; values: string[] };
const FILE_LISTS: Record<string, ListCol[]> = {"200": [{"title": "Статус", "values": ["В роботі", "Документи ✅", "Проблема", "Родину не встановлено", "Архів"], "columns": ["Статус"]}, {"title": "Виконавці 200", "values": ["Савицька", "Руденко", "Варжель", "Парм", "Маштакова", "Супрун", "Фаріонова", "Гордєєва", "Дієва-Кльоц", "Ніколаєнко", "Стручкова", "Лілісон", "Дмитренко", "Прокопенко"], "columns": ["Виконавець", "Відповідальний (по осередкам)"]}, {"title": "Осередки", "values": ["Вінниця", "Волинь", "Дніпро", "Запоріжжя", "Івано-Франківськ", "Київщина", "Кропивницький", "Львів", "Миколаїв", "Одеса", "Полтава", "Суми", "Тернопіль", "Ужгород", "Харків", "Херсон", "Хмельницький", "Черкаси"], "columns": ["Осередок ГО"]}, {"title": "Звання", "values": ["матрос", "старший матрос", "солдат", "старший солдат", "молодший сержант", "сержант", "старший сержант", "головний сержант", "штаб-сержант", "майстер-сержант", "мічман", "молодший лейтенант", "лейтенант", "старший лейтенант", "капітан", "майор", "підполковник", "полковник"], "columns": ["Звання"]}, {"title": "В/ч", "values": ["А0216", "А0878", "А1275", "А1325", "А1965", "А2062", "А2611", "А2613", "А2777", "А2802", "А3821", "А4210", "А4217", "А4548", "А4635", "А4765", "А4822", "А4916", "А4935", "А5025", "А5074", "А7053", "А7382", "Інша"], "columns": ["Військова частина"]}, {"title": "Бригади", "values": ["1 ОБМП", "15 ОПЗ", "18 ОПТБ", "32 ОАБр", "34 ОБрМП", "35 ОБрМП", "36 ОБрМП", "37 ОБрМП", "38 ОБрМП", "39 ОБрМП", "40 ОБрМП", "66 ОАДн 406 ОАБр", "88 ОБМП", "137 ОБМП", "140 ОРБ", "143 ЦОДТ", "380 ОРБМП", "406 ОАБр", "426 ОПБС", "501 ОБМП", "503 ОБМП", "505 ОБМП", "Інший підрозділ"], "columns": ["Бригада"]}, {"title": "Ступені", "values": ["Дружина", "Чоловік", "Мати", "Батько", "Син", "Донька", "Брат", "Сестра", "Дід", "Баба", "Онук", "Онука", "Опікун", "Піклувальник", "Інший родич"], "columns": ["Родич 2 — Ступінь", "Отримувач — Ступінь", "Родич 3 — Ступінь"]}, {"title": "Області", "values": ["Вінницька", "Волинська", "Дніпропетровська", "Донецька", "Житомирська", "Закарпатська", "Запорізька", "Івано-Франківська", "Київська", "Кіровоградська", "Луганська", "Львівська", "Миколаївська", "Одеська", "Полтавська", "Рівненська", "Сумська", "Тернопільська", "Харківська", "Херсонська", "Хмельницька", "Черкаська", "Чернівецька", "Чернігівська", "Автономна Республіка Крим", "м. Київ", "м. Севастополь", "За кордоном"], "columns": ["Отримувач — Область"]}, {"title": "Атрибутика", "values": ["Відео та фото", "Немає"], "columns": ["Атрибутика"]}, {"title": "Табличка", "values": ["Замовлена", "Виготовлена", "Отримана", "Встановлена", "Не встигли виготовити", "Відмовились", "У родини"], "columns": ["Табличка на хрест"]}, {"title": "Є/Немає", "values": ["Є", "Немає"], "columns": ["Довідка про поховання"]}], "300": [{"title": "Відповідальні 300", "values": ["Супрун", "Гордєєва", "Марина", "Фаріонова", "Куліков"], "columns": ["Відповідальний"]}, {"title": "Осередки", "values": ["Вінниця", "Волинь", "Дніпро", "Запоріжжя", "Івано-Франківськ", "Київщина", "Кропивницький", "Львів", "Миколаїв", "Одеса", "Полтава", "Суми", "Тернопіль", "Ужгород", "Харків", "Херсон", "Хмельницький", "Черкаси"], "columns": ["Осередок ГО"]}, {"title": "Стан", "values": ["Лікується", "Реабілітація", "Виписаний", "Повернувся до служби", "Помер"], "columns": ["Стан"]}, {"title": "Звання", "values": ["матрос", "старший матрос", "солдат", "старший солдат", "молодший сержант", "сержант", "старший сержант", "головний сержант", "штаб-сержант", "майстер-сержант", "мічман", "молодший лейтенант", "лейтенант", "старший лейтенант", "капітан", "майор", "підполковник", "полковник"], "columns": ["Звання"]}, {"title": "Бригади", "values": ["1 ОБМП", "15 ОПЗ", "18 ОПТБ", "32 ОАБр", "34 ОБрМП", "35 ОБрМП", "36 ОБрМП", "37 ОБрМП", "38 ОБрМП", "39 ОБрМП", "40 ОБрМП", "66 ОАДн 406 ОАБр", "88 ОБМП", "137 ОБМП", "140 ОРБ", "143 ЦОДТ", "380 ОРБМП", "406 ОАБр", "426 ОПБС", "501 ОБМП", "503 ОБМП", "505 ОБМП", "Інший підрозділ"], "columns": ["Бригада"]}, {"title": "В/ч", "values": ["А0216", "А0878", "А1275", "А1325", "А1965", "А2062", "А2611", "А2613", "А2777", "А2802", "А3821", "А4210", "А4217", "А4548", "А4635", "А4765", "А4822", "А4916", "А4935", "А5025", "А5074", "А7053", "А7382", "Інша"], "columns": ["В/ч"]}, {"title": "УБД", "values": ["Так", "Ні", "Оформлюється"], "columns": ["УБД"]}, {"title": "Документ", "values": ["Є", "Немає", "Замовлено"], "columns": ["Форма 001/о"]}, {"title": "Ступені", "values": ["Дружина", "Чоловік", "Мати", "Батько", "Син", "Донька", "Брат", "Сестра", "Дід", "Баба", "Онук", "Онука", "Опікун", "Піклувальник", "Інший родич"], "columns": ["Родич 1 — Ступінь", "Родич 2 — Ступінь", "Родич 3 — Ступінь"]}]};

export function buildLists(inp: Input & { statuses: { module: string; name: string; sort: number }[]; defsFull: any[] }, tab: Tab): ListCol[] {
  const kind = tab.module;
  if (NEW_KINDS.includes(kind)) {
    // нові модулі: статуси, осередки, ступені й списки з «Налаштування полів» — із бази
    const cells = [...new Set([...inp.cells.values()])].sort((a, b) => a.localeCompare(b, 'uk'));
    const degrees = FILE_LISTS['300'].find((l) => l.title === 'Ступені')!.values;
    const ls: ListCol[] = [
      { title: 'Статус', columns: ['Статус'], values: inp.statuses.filter((x) => x.module === kind).sort((a, b) => a.sort - b.sort).map((x) => x.name) },
      { title: 'Осередки', columns: ['Регіон', 'Осередок ГО'], values: cells },
      { title: 'Ступені', columns: ['Спорідненість', ...KIN3.filter((h) => h.endsWith('Ступінь'))], values: degrees }
    ];
    inp.defsFull.filter((d: any) => d.module === kind && d.active && d.kind === 'list' && (d.options || []).length)
      .forEach((d: any) => ls.push({ title: String(d.sheet_column || d.label).slice(0, 40), columns: [d.sheet_column || d.label], values: d.options }));
    return ls.map((l) => ({ ...l, columns: l.columns.filter((c) => tab.header.includes(c)) })).filter((l) => l.columns.length && l.values.length);
  }
  const cells = [...new Set([...inp.cells.values()])].sort((a, b) => a.localeCompare(b, 'uk'));
  const ops = [...new Set([...inp.ops.values()].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
  return (FILE_LISTS[kind] || []).map((l) => {
    let values = [...l.values];
    if (l.title === 'Осередки') values = cells;
    // статуси з бази (напр. «Не беремо в роботу»), яких немає у списку журналу — додаємо в кінець
    if (l.title === 'Статус' || l.title === 'Стан') {
      inp.statuses.filter((st) => st.module === kind && !values.includes(st.name)).forEach((st) => values.push(st.name));
    }
    if (/^(Виконавці|Відповідальні)/.test(l.title)) {
      const known = new Set(values.map((v) => v.toLowerCase()));
      ops.forEach((o) => { const sur = o.split(/\s+/)[0].toLowerCase(); if (!known.has(sur) && !known.has(o.toLowerCase())) values.push(o); });
    }
    return { title: l.title, columns: l.columns.filter((c) => tab.header.includes(c)), values };
  }).filter((l) => l.columns.length && l.values.length);
}
