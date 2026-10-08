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

  // Чи існує така дата насправді: 31.09 чи 29.02 у невисокосний рік браузер мовчки
  // перетворює на 1 жовтня / 1 березня — такі дати не приймаємо; рік — 1900–2100
  function realIso(y, m, d) {
    y = +y; m = +m; d = +d;
    if (!(y >= 1900 && y <= 2100) || m < 1 || m > 12 || d < 1) return null;
    const t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) {
      lastDateBad = `${pad(d)}.${pad(m)}.${y}`;
      if (curRow != null) badDates.set(curRow, [...new Set([...(badDates.get(curRow) || []), lastDateBad])]);
      return null;
    }
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  // Дата з Excel: число (серійний номер), Date або текст «31.01.2013», «08,11.2021», «2013-01-31»
  function toDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v);
      return d ? realIso(d.y, d.m, d.d) : null;
    }
    if (v instanceof Date) return isNaN(v) ? null : realIso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    const s = clean(v);
    let m = s.match(/^(\d{1,2})[.,/\-](\d{1,2})[.,/\-](\d{2,4})/);
    if (m) {
      let [, a, b, y] = m;
      let day = +a, mon = +b;
      if (mon > 12 && day <= 12) { [day, mon] = [mon, day]; lastDateFix = 'день і місяць переставлено'; }   // 12/25/2012 (американський формат)
      let year = +y;
      if (year < 100) {                                           // 0012 → 2012, 98 → 1998
        const cy = new Date().getFullYear() % 100;
        year = year <= cy ? 2000 + year : 1900 + year;
        lastDateFix = (lastDateFix ? lastDateFix + ', ' : '') + `рік «${y}» прочитано як ${year}`;
      }
      return realIso(year, mon, day);
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? realIso(m[1], m[2], m[3]) : null;
  }
  // Пояснення, якщо дату довелося виправити (читається одразу після toDate)
  let lastDateFix = '', lastDateBad = '';
  function toDateNote(v) {
    lastDateFix = ''; lastDateBad = '';
    const iso = toDate(v);
    return { iso, fix: lastDateBad ? `дати ${lastDateBad} не існує` : lastDateFix, bad: lastDateBad };
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
      id: 'kids_mp_v2',
      label: 'Діти Морської піхоти — нова форма (ПІБ трьома полями, до 5 дітей)',
      program: 'Діти Морської піхоти',
      detect: (hdr) => hdr.some((h) => /^10\.11\s/.test(clean(h))),
      parse: parseKidsV2
    },
    {
      id: 'kids_mp',
      label: 'Діти Морської піхоти (відповіді Google Форми, стара форма)',
      program: 'Діти Морської піхоти',
      detect: (hdr) => !hdr.some((h) => /^10\.11\s/.test(clean(h))) && hdr.some((h) => clean(h).startsWith('10.')) && hdr.some((h) => /дитин/i.test(clean(h))),
      parse: parseKids
    }
    ,
    {
      id: 'fallen_200_v2',
      label: 'Загиблі (200) — новий шаблон журналу',
      program: 'Супровід родин загиблих (200)',
      detect: (hdr) => hdr.some((h) => /^загиблий — прізвище/i.test(clean(h))),
      parse: (rows, hdr, ctx) => { const a = adapt200(rows, hdr); return parse200(a.rows, a.hdr, ctx); }
    },
    {
      id: 'wounded_300_v2',
      label: 'Поранені (300) — новий шаблон журналу',
      program: 'Супровід поранених (300)',
      detect: (hdr) => hdr.some((h) => /^поранений — прізвище/i.test(clean(h))),
      parse: (rows, hdr, ctx) => { const a = adapt300(rows, hdr); return parse300(a.rows, a.hdr, ctx); }
    },
    {
      id: 'fallen_200',
      label: 'Загиблі (200) — сповіщення родин',
      program: 'Супровід родин загиблих (200)',
      detect: (hdr) => hdr.some((h) => /отримувач сповіщення/i.test(clean(h))) && hdr.some((h) => /дата загибелі/i.test(clean(h))),
      parse: parse200
    },
    {
      id: 'wounded_300',
      label: 'Поранені (300)',
      program: 'Супровід поранених (300)',
      detect: (hdr) => hdr.some((h) => /контакти родичів/i.test(clean(h))) && hdr.some((h) => /дата поранення/i.test(clean(h))),
      parse: parse300
    }
  ];

  // ---------- Нові шаблони журналів (з блоками колонок) → старий формат ----------
  // Перетворюємо рядок нового шаблону на «старий» рядок і далі використовуємо вже відкалібрований розбір.
  const H = (hdr) => { const m = new Map(); hdr.forEach((h, i) => m.set(norm(h), i)); return m; };
  const pick = (map, r, name) => { const i = map.get(norm(name)); return i === undefined ? null : r[i]; };
  const joinText = (...xs) => xs.map((x) => (x instanceof Date ? x : clean(x))).filter(Boolean).join(' ');
  const kinLine = (deg, name, phone) => { const t = joinText(deg, name, phone); return t || null; };

  function adapt200(rows, hdr) {
    const m = H(hdr);
    // рядок-приклад із шаблону не імпортуємо
    rows = rows.map((r) => (r.some((v) => /Рядок-приклад/i.test(String(v ?? ''))) ? r.map(() => null) : r));
    const oldHdr = ['Регіон', "Прізвище, ім'я, по-батькові", 'Позивний', 'Дата народження', 'Дата загибелі', 'Військова частина', 'Бригада',
      'Отримувач сповіщення', 'Спорідненість', 'Адреса отримувача', 'Контакти отримувача', 'Примітки', 'Дата поховання', 'Місце поховання'];
    const out = rows.map((r) => {
      const g = (n) => pick(m, r, n);
      const contacts = [
        [g('Отримувач — Телефон'), g('Отримувач — Дод. телефон')].map(clean).filter(Boolean).join(' '),
        kinLine(g('Родич 2 — Ступінь'), g('Родич 2 — ПІБ'), g('Родич 2 — Телефон')),
        kinLine(g('Родич 3 — Ступінь'), g('Родич 3 — ПІБ'), g('Родич 3 — Телефон'))
      ].filter(Boolean).join('\n');
      const notes = [g('Примітки'), clean(g('Статус')) === 'Родину не встановлено' ? 'Родину не встановлено' : null].map(clean).filter(Boolean).join('. ');
      return [g('Осередок ГО'), joinText(g('Загиблий — Прізвище'), g('Загиблий — Ім’я'), g('Загиблий — По батькові')),
        g('Позивний'), g('Дата народження'), g('Дата загибелі'), g('Військова частина'), g('Бригада'),
        joinText(g('Отримувач — Прізвище'), g('Отримувач — Ім’я'), g('Отримувач — По батькові')),
        g('Отримувач — Ступінь'),
        [g('Отримувач — Область'), g('Отримувач — Населений пункт') ? 'м. ' + clean(g('Отримувач — Населений пункт')) : null, g('Отримувач — Адреса')].map(clean).filter(Boolean).join(', '),
        contacts, notes, g('Дата поховання'), g('Місце поховання')];
    });
    return { rows: out, hdr: oldHdr };
  }

  function adapt300(rows, hdr) {
    const m = H(hdr);
    // рядок-приклад із шаблону не імпортуємо
    rows = rows.map((r) => (r.some((v) => /Рядок-приклад/i.test(String(v ?? ''))) ? r.map(() => null) : r));
    const oldHdr = ['ПІБ', 'Дата народження', 'Номер телефону', 'В/ч, бригада', 'Дата поранення', 'УБД', 'Контакти родичів', 'Примітки', 'Осередок ГО'];
    const out = rows.map((r) => {
      const g = (n) => pick(m, r, n);
      const kin = [1, 2, 3].map((k) => kinLine(g(`Родич ${k} — Ступінь`), g(`Родич ${k} — ПІБ`), g(`Родич ${k} — Телефон`))).filter(Boolean).join('\n');
      const died = clean(g('Стан')) === 'Помер' ? `Помер${g('Дата смерті') ? ' ' + (toDate(g('Дата смерті')) || '') : ''}` : null;
      const notes = [died, g('Проблематика') ? 'Проблематика: ' + clean(g('Проблематика')) : null, g('Примітки')].map(clean).filter(Boolean).join('. ');
      return [joinText(g('Поранений — Прізвище'), g('Поранений — Ім’я'), g('Поранений — По батькові')),
        g('Дата народження'), [g('Телефон'), g('Дод. телефон')].map(clean).filter(Boolean).join(' '),
        clean(g('Бригада')) || g('В/ч'), g('Дата поранення'), g('УБД'), kin, notes, g('Осередок ГО')];
    });
    return { rows: out, hdr: oldHdr };
  }

  // Колонка за назвою (без урахування регістру, апострофів і пробілів)
  const norm = (h) => clean(h).toLowerCase().replace(/[’'ʼ`]/g, '').replace(/\s+/g, ' ');
  const byName = (re) => (h) => re.test(norm(h));

  // Згода: реєстри ГО надходять з підтвердженою згодою на обробку
  const GO_CONSENT_NOTE = 'Згода на обробку ПД: дані з бази ГО, підтверджені для обробки';

  // Обласні центри та великі міста → область
  const CITY_REGION = {
    'вінниця': 'Вінницька', 'луцьк': 'Волинська', 'дніпро': 'Дніпропетровська', 'кривий ріг': 'Дніпропетровська',
    'краматорськ': 'Донецька', 'слов’янськ': 'Донецька', 'маріуполь': 'Донецька', 'житомир': 'Житомирська',
    'ужгород': 'Закарпатська', 'запоріжжя': 'Запорізька', 'івано-франківськ': 'Івано-Франківська',
    'київ': 'м. Київ', 'біла церква': 'Київська', 'бровари': 'Київська', 'кропивницький': 'Кіровоградська',
    'львів': 'Львівська', 'миколаїв': 'Миколаївська', 'одеса': 'Одеська', 'полтава': 'Полтавська',
    'кременчук': 'Полтавська', 'рівне': 'Рівненська', 'суми': 'Сумська', 'тернопіль': 'Тернопільська',
    'харків': 'Харківська', 'херсон': 'Херсонська', 'хмельницький': 'Хмельницька', 'черкаси': 'Черкаська',
    'чернівці': 'Чернівецька', 'чернігів': 'Чернігівська'
  };

  // Адреса «м. Львів, вул. …» → населений пункт + область
  function parseAddress(raw, regions, rec) {
    const s = clean(raw).replace(/,\s*$/, '');
    if (!s) return {};
    const out = {};
    for (const [id, name] of regions) {
      const stem = name.replace(/ька$/, '').toLowerCase();
      if (stem.length > 4 && s.toLowerCase().includes(stem)) { out.region_id = id; break; }
    }
    const m = s.match(/(?:^|,\s*)(?:м\.|місто|с\.|село|смт\.?|сел\.)\s*([^,]+)/i);
    const place = clean(m ? m[1] : s.split(',')[0]);
    if (place) out.settlement = place;
    if (!out.region_id && place) {
      const reg = CITY_REGION[place.toLowerCase().replace(/'/g, '’')];
      const found = reg && [...regions].find(([, n]) => n === reg);
      if (found) out.region_id = found[0];
    }
    if (!out.region_id) rec.warnings.push(`Область за адресою «${s}» не визначено — вкажіть вручну`);
    return out;
  }

  const CELL_ALIASES = { 'і-ф': 'Івано-Франківськ', 'іф': 'Івано-Франківськ', 'київ': 'Київщина', 'луцьк': 'Волинь' };
  function matchCell(raw, cells, rec) {
    const s = clean(raw);
    if (!s) return null;
    const name = CELL_ALIASES[s.toLowerCase()] || s;
    const f = [...cells].find(([, n]) => n.toLowerCase() === name.toLowerCase());
    if (!f) rec.warnings.push(`Осередок «${s}» не знайдено в довіднику`);
    return f ? f[0] : null;
  }

  function matchDegree(raw) {
    const s = clean(raw).toLowerCase();
    return OPT.relation_degree.find((d) => d.toLowerCase() === s) || null;
  }

  // ---------- Розбір комірок з людьми (журнал «200») ----------
  // Як пишуть ступінь спорідненості → значення довідника
  const DEGREE_WORDS = [
    [/^(мати|мама|матір|матері)$/i, 'Мати'], [/^(батько|тато|отець)$/i, 'Батько'],
    [/^(дружина|жінка|вдова)$/i, 'Дружина'], [/^(чоловік)$/i, 'Чоловік'], [/^(син)$/i, 'Син'],
    [/^(донька|дочка|доч)$/i, 'Донька'], [/^(брат)$/i, 'Брат'], [/^(сестра)$/i, 'Сестра'],
    [/^(дід|дідусь)$/i, 'Дід'], [/^(баба|бабуся)$/i, 'Баба'], [/^(онук)$/i, 'Онук'], [/^(онука)$/i, 'Онука'],
    [/^(тітка|тьотя|дядько|дядя|племінник|племінниця|свекруха|теща|тесть|свекор|невістка|зять|кум|кума|опікун|піклувальник)$/i, 'Інший член сім’ї / родич']
  ];
  function detectDegree(text) {
    const t = clean(text).replace(/^[\s,;:–—\-]+/, '');
    const m = t.match(/^([\p{L}’']+)\s*[:\-–—,]?\s*(.*)$/u);
    if (m) {
      const hit = DEGREE_WORDS.find(([re]) => re.test(m[1]));
      if (hit) return { degree: hit[1], label: m[1].toLowerCase(), rest: clean(m[2]) };
    }
    return { degree: null, label: null, rest: t };
  }

  // Схоже на коментар, а не на ПІБ
  function isNote(text) {
    const t = clean(text);
    if (!t) return false;
    if (/(відсутн|немає|невідом|не встановл|інформац|рахуєть|не знайд|не вдалос|уточню|надійшл)/i.test(t)) return true;
    // речення: крапка і далі нове слово з великої, або дуже довгий шматок без розділювачів
    if (/[.!?]\s+\p{Lu}\p{Ll}/u.test(t)) return true;
    return String(text).split(/[\/\\;\n]+/).some((seg) => clean(seg).split(' ').length >= 7);
  }

  // Комірка → частини «[ступінь] [ПІБ] [телефони]»: розділювачі /, \, ;, новий рядок і межі телефонів
  function peopleChunks(text) {
    const out = [];
    String(text ?? '').split(/[\/\\;\n]+/).map((x) => x.trim()).filter(Boolean).forEach((part) => {
      const re = /\+?\d[\d\s().\-]{6,}\d/g;
      let last = 0, m, cur = null;
      const startText = (t) => {
        t = t.replace(/^[\s,;:–—\-]+|[\s,;:–—\-]+$/g, '').trim();
        if (t) { cur = { text: t, phones: [] }; out.push(cur); return true; }
        return false;
      };
      while ((m = re.exec(part))) {
        if (!startText(part.slice(last, m.index)) && !cur) { cur = { text: '', phones: [] }; out.push(cur); }
        cur.phones.push(...V.extractPhones(m[0]).phones);
        last = re.lastIndex;
      }
      startText(part.slice(last));
    });
    return out.map((c) => { const d = detectDegree(c.text); return { ...c, degree: d.degree, label: d.label, name: d.rest }; });
  }

  // ---------- Шаблон «200» ----------
  function parse200(rows, hdr, ctx) {
    const c = {
      cell: col(hdr, byName(/^регіон$/)), fallen: col(hdr, byName(/^прізвище, імя/)),
      callsign: col(hdr, byName(/^позивний/)), fbd: col(hdr, byName(/^дата народження/)),
      fdd: col(hdr, byName(/^дата загибелі/)), vch: col(hdr, byName(/^військова частина/)),
      brigade: col(hdr, byName(/^бригада/)), rec: col(hdr, byName(/^отримувач сповіщення/)),
      degree: col(hdr, byName(/^спорідненість/)), addr: col(hdr, byName(/^адреса отримувача/)),
      phone: col(hdr, byName(/^контакти отримувача/)), notes: col(hdr, byName(/^примітки/)),
      bdate: col(hdr, byName(/^дата поховання/)), bplace: col(hdr, byName(/^місце поховання/))
    };
    if ([c.fallen, c.rec, c.degree, c.phone].some((x) => x < 0)) throw new Error('У файлі бракує ключових колонок журналу «200».');
    const program = ctx.programByName('Супровід родин загиблих (200)');
    const out = [];
    const fallenByKey = new Map();   // кілька рядків про одного загиблого → одна основна картка

    rows.forEach((r, i) => {
      const raw = (k) => (c[k] >= 0 ? r[c[k]] : null);
      const g = raw;
      if (!clean(g('rec')) && !clean(g('fallen')) && !clean(g('phone'))) return;
      const row = i + 2;

      // --- Загиблий ---
      const fallenName = V.normalizeName(splitNameCell({ person: {}, warnings: [], info: [] }, g('fallen')), false).value || clean(g('fallen')) || null;
      const fallenParts = (fallenName || '').split(' ');
      const fbd = toDate(g('fbd')), fdd = toDate(g('fdd'));
      const bdate = toDate(g('bdate'));
      const unit = matchUnit(clean(g('brigade')), ctx.units);
      const common = [];   // попередження, спільні для всіх записів рядка
      if (!fdd) common.push('Не вказано дату загибелі');
      if (bdate && fdd && bdate < fdd) common.push('Дата поховання раніше дати загибелі — перевірте');
      if (bdate && bdate > new Date().toISOString().slice(0, 10)) common.push('Дата поховання в майбутньому — перевірте');
      if (clean(g('brigade')) && !unit.id) common.push(`Бригаду «${clean(g('brigade'))}» не знайдено в довіднику — записано текстом`);
      const relTemplate = {
        related_full_name: fallenName,
        related_callsign: clean(g('callsign')) || null,
        related_birth_date: fbd, related_death_date: fdd,
        related_status: 'Загиблий', related_mp: 'Так',
        related_unit_id: unit.id, related_unit_other: unit.other,
        related_unit_code: clean(g('vch')) || null,
        related_burial_date: bdate,
        related_burial_place: clean(g('bplace')) || null
      };

      // --- Хто в комірках «Отримувач» і «Контакти» ---
      const notes = [];
      const recRaw = String(g('rec') ?? '');
      const recNoPhones = V.extractPhones(recRaw).rest;
      let entries = [];
      if (isNote(recNoPhones)) notes.push(`Отримувач (з журналу): ${clean(recRaw)}`);
      else entries = peopleChunks(recRaw).filter((x) => x.name || x.degree || x.phones.length);

      const degreeList = clean(g('degree')).split(/\s*[\/\\;,]\s*/).filter(Boolean);
      entries.forEach((e, k) => {
        if (!e.degree && degreeList[k]) {
          const d = matchDegree(degreeList[k][0].toUpperCase() + degreeList[k].slice(1).toLowerCase());
          e.degree = d; e.label = d ? null : degreeList[k];
        }
      });

      peopleChunks(String(g('phone') ?? '')).forEach((e) => {
        if (!e.name && !e.degree) {
          const free = entries.filter((x) => !x.phones.length);
          if (free.length > 1 && e.phones.length > 1) {
            // кілька людей і кілька номерів — по одному за порядком, решта першому
            e.phones.forEach((ph, k) => (free[k] || free[0]).phones.push(ph));
          } else {
            const target = free[0] || entries[0];
            if (target) target.phones.push(...e.phones);
            else entries.push(e);
          }
        } else {
          e.fromContacts = true;     // родич, знайдений у «Контактах» — додаткова картка
          entries.push(e);
        }
      });
      if (!entries.some((e) => e.phones.length) && clean(g('phone')) && !V.extractPhones(String(g('phone'))).phones.length) {
        notes.push(`Телефон з файлу (не розпізнано): ${clean(g('phone'))}`);
      }

      // --- ОСНОВНА картка — сам загиблий (один на кілька рядків журналу) ---
      const fkey = letters(fallenName) + '|' + (fbd || '') + '|' + (fdd || '');
      let fallenRec = fallenByKey.get(fkey);
      if (!fallenRec) {
        fallenRec = newRecord(row);
        const fp = fallenRec.person;
        const fio = splitFio(fallenName);
        if (fio.error) { fallenRec.errors.push(`Загиблий: ${fio.error}`); out.push(fallenRec); return; }
        Object.assign(fp, fio, {
          military_status: 'Загиблий', birth_date: fbd, death_date: fdd, burial_date: bdate,
          burial_place: clean(g('bplace')) || null, callsign: clean(g('callsign')) || null,
          mp_relation: 'Так', mp_relation_type: 'Загиблий військовослужбовець МП',
          mp_unit_id: unit.id, mp_unit_other: unit.other, military_unit_code: clean(g('vch')) || null,
          has_children: 'Невідомо', is_extra: false
        });
        fp.cell_id = matchCell(g('cell'), ctx.cells, fallenRec);
        fp.consent_pd_at = new Date().toISOString();
        fallenRec.info.push(GO_CONSENT_NOTE);
        common.forEach((w) => fallenRec.warnings.push(w));
        fallenRec.programs.push(program);
        fallenRec.isFallen = true;
        fallenByKey.set(fkey, fallenRec);
        out.push(fallenRec);
      } else if (!fallenRec.rows.includes(row)) {
        fallenRec.rows.push(row);
        fallenRec.info.push(`Той самий загиблий у рядку ${row} — об’єднано`);
      }
      const fp = fallenRec.person;
      const n = clean(g('notes'));
      if (n) addComment(fallenRec, n);
      notes.forEach((t) => addComment(fallenRec, t));
      // область загиблого — за адресою родини (перший отримувач)
      const addr = parseAddress(g('addr'), ctx.regions, { warnings: [] });
      if (!fp.region_id && addr.region_id) fp.region_id = addr.region_id;
      if (!fp.settlement && addr.settlement) fp.settlement = addr.settlement;

      if (!entries.length) {
        if (!fallenRec.kinCount) fallenRec.noKinWarned = true;
        return;
      }

      // --- ЗВ’ЯЗАНІ картки — отримувачі й родичі (2-й рівень) ---
      entries.forEach((e, k) => {
        const rec = newRecord(row);
        const p = rec.person;
        rec.isRelative = true;
        rec.linkTo = fallenRec;          // після збереження загиблого — посилання на його картку
        p.is_extra = true;
        const words = V.normalizeName(e.name, false).value?.split(' ') || [];
        const surname = fallenParts[0] ? (FEMALE.includes(e.degree) ? femSurname(fallenParts[0]) : fallenParts[0]) : null;
        if (words.length >= 2) {
          Object.assign(p, { last_name: words[0], first_name: words[1], patronymic: words.slice(2).join(' ') || null });
        } else if (words.length === 1 && surname) {
          Object.assign(p, { last_name: surname, first_name: words[0], patronymic: null,
            name_check: true, name_check_note: 'вказано лише ім’я, прізвище підставлено з ПІБ загиблого' });
          rec.warnings.push(`Лише ім’я «${words[0]}» — прізвище «${surname}» підставлено, потрібно уточнити`);
        } else if (!words.length && surname) {
          const label = e.label || (e.degree ? e.degree.toLowerCase() : 'родич');
          Object.assign(p, { last_name: surname, first_name: label[0].toUpperCase() + label.slice(1), patronymic: null,
            name_check: true, name_check_note: `у файлі лише «${label}» без імені` });
          rec.warnings.push(`ПІБ не вказано (лише «${label}») — створено тимчасове ім’я, потрібно уточнити`);
        } else {
          rec.errors.push(`Не вдалося визначити ПІБ отримувача: «${clean(e.text) || clean(recRaw)}»`);
        }
        if (e.phones.length) addPhones(rec, e.phones);
        else rec.warnings.push('Немає телефону: не потрапить у розсилку');
        if (!e.degree) rec.warnings.push(`Спорідненість «${e.label || clean(g('degree')) || 'не вказано'}» не впізнано — уточніть`);
        else if (e.label && e.degree === 'Інший член сім’ї / родич') addComment(rec, `Спорідненість: ${e.label}`);
        if (k === 0 && !e.fromContacts) {
          Object.assign(p, parseAddress(g('addr'), ctx.regions, rec));
          rec.info.push('Отримувач сповіщення');
        }
        p.cell_id = fp.cell_id;
        p.consent_pd_at = new Date().toISOString();
        rec.info.push(`Родич загиблого ${fallenName} (зв’язана картка)`);
        rec.programs.push(program);
        rec.relations.push({ ...relTemplate, relation_degree: e.degree || 'Інший член сім’ї / родич' });
        fallenRec.kinCount = (fallenRec.kinCount || 0) + 1;
        out.push(rec);
      });
    });
    // загиблий без жодного родича в журналі
    fallenByKey.forEach((f) => {
      if (!f.kinCount) f.warnings.push('Родину не встановлено — коли знайдуться рідні, додайте їх кнопкою «+ Додати родича».');
    });
    return out;
  }

  // ---------- Шаблон «300» ----------
  const FEMALE = ['Дружина', 'Мати', 'Сестра', 'Донька', 'Баба', 'Онука'];
  function femSurname(s) {
    if (/(ов|ев|єв|ін|їн)$/i.test(s)) return s + 'а';
    if (/(ський|цький)$/i.test(s)) return s.replace(/ий$/i, 'а');
    return s;
  }

  function parse300(rows, hdr, ctx) {
    const c = {
      fio: col(hdr, byName(/^піб$/)), bd: col(hdr, byName(/^дата народження/)),
      phone: col(hdr, byName(/^номер телефону/)), vch: col(hdr, byName(/^в\/ч/)),
      wd: col(hdr, byName(/^дата поранення/)), ubd: col(hdr, byName(/^убд$/)),
      kin: col(hdr, byName(/^контакти родичів/)), notes: col(hdr, byName(/^примітки/)),
      cell: col(hdr, byName(/^осередок/))
    };
    if ([c.fio, c.kin].some((x) => x < 0)) throw new Error('У файлі бракує ключових колонок журналу «300».');
    const out = [];
    rows.forEach((r, i) => {
      const g = (k) => (c[k] >= 0 ? r[c[k]] : null);
      if (!clean(g('fio'))) return;
      const row = i + 2;
      const rec = newRecord(row);
      const p = rec.person;

      const fio = splitFio(splitNameCell(rec, g('fio')));
      if (fio.error) rec.errors.push(`Військовий: ${fio.error}`); else Object.assign(p, fio);
      setPhone(rec, g('phone'));
      const bd = toDate(g('bd'));
      if (bd) { const chk = V.checkBirthDate(bd); if (chk.error) rec.errors.push('Дата народження: ' + chk.error.toLowerCase()); else p.birth_date = bd; }
      const vch = clean(g('vch'));
      if (vch) {
        const unit = matchUnit(vch, ctx.units);
        if (unit.id) p.mp_unit_id = unit.id; else p.military_unit_code = vch;
      }
      if (c.cell >= 0) p.cell_id = matchCell(g('cell'), ctx.cells, rec);
      p.wounded = 'Так';
      p.wound_date = toDate(g('wd'));
      const wdRaw = clean(g('wd'));
      if (!p.wound_date && wdRaw) { addComment(rec, `Дата поранення (з журналу): ${wdRaw}`); rec.warnings.push(`Дату поранення «${wdRaw}» не розпізнано — записано в примітки`); }
      else if (!p.wound_date) rec.warnings.push('Не вказано дату поранення');
      const ubdRaw = clean(g('ubd'));
      if (ubdRaw) {
        const ubd = /^(так|є|\+|убд)/i.test(ubdRaw) ? 'Так' : /^(ні|немає|нема|-)/i.test(ubdRaw) ? 'Ні' : /оформ|збира|подан|процес/i.test(ubdRaw) ? 'Оформлюється' : ubdRaw;
        p.journal = { ...(p.journal || {}), '300': { ...((p.journal || {})['300'] || {}), 'УБД': ubd } };
      }
      p.mp_relation = 'Так';
      p.mp_relation_type = 'Діючий військовослужбовець МП';
      p.military_status = 'Діючий військовослужбовець';
      const notes = clean(g('notes'));
      if (notes) addComment(rec, notes);
      const died = /помер|загинув|загибел|смерт/i.test(notes);
      if (died) {
        p.military_status = 'Статус уточнюється';
        rec.diedNote = notes;            // звіримо з журналом «200» після розбору
      }
      if (/^(так|є|\+|убд)/i.test(clean(g('ubd')))) rec.vets = ['Учасник бойових дій'];
      p.consent_pd_at = new Date().toISOString();
      rec.info.push(GO_CONSENT_NOTE);
      rec.programs.push(ctx.programByName('Супровід поранених (300)'));
      out.push(rec);

      // Родичі з «Контакти родичів» → окремі картки, пов’язані з цим бійцем
      const soldierName = [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ') || null;
      const kinRaw = String(g('kin') ?? '');
      if (kinRaw.trim() && isNote(V.extractPhones(kinRaw).rest) && !V.extractPhones(kinRaw).phones.length) {
        addComment(rec, `Контакти родичів (з журналу): ${clean(kinRaw)}`);
        return;
      }
      peopleChunks(kinRaw).filter((e) => e.name || e.degree || e.phones.length).forEach((e) => {
        const kr = newRecord(row);
        kr.isRelative = true;
        kr.person.is_extra = true;
        kr.linkTo = rec;                       // після збереження бійця сюди підставимо його картку
        kr.soldierLabel = soldierName;
        const words = V.normalizeName(e.name, false).value?.split(' ') || [];
        const surname = p.last_name ? (FEMALE.includes(e.degree) ? femSurname(p.last_name) : p.last_name) : null;
        if (words.length >= 2) {
          Object.assign(kr.person, { last_name: words[0], first_name: words[1], patronymic: words.slice(2).join(' ') || null });
        } else if (words.length === 1 && surname) {
          Object.assign(kr.person, { last_name: surname, first_name: words[0], patronymic: null,
            name_check: true, name_check_note: 'вказано лише ім’я, прізвище підставлено з ПІБ бійця' });
          kr.warnings.push(`Лише ім’я «${words[0]}» — прізвище «${surname}» підставлено, потрібно уточнити`);
        } else if (!words.length && surname) {
          const label = e.label || (e.degree ? e.degree.toLowerCase() : 'родич');
          Object.assign(kr.person, { last_name: surname, first_name: label[0].toUpperCase() + label.slice(1), patronymic: null,
            name_check: true, name_check_note: `у файлі лише «${label}» без імені` });
          kr.warnings.push(`ПІБ не вказано (лише «${label}») — створено тимчасове ім’я, потрібно уточнити`);
        } else {
          kr.errors.push(`Родич «${clean(e.text)}»: не вдалося визначити ПІБ`);
        }
        if (e.phones.length) addPhones(kr, e.phones);
        else kr.warnings.push('Немає телефону: не потрапить у розсилку');
        if (!e.degree) kr.warnings.push(`Ступінь спорідненості не впізнано — уточніть`);
        else if (e.label && e.degree === 'Інший член сім’ї / родич') addComment(kr, `Спорідненість: ${e.label}`);
        kr.person.consent_pd_at = new Date().toISOString();
        kr.info.push(`Родич бійця ${soldierName || ''} (з колонки «Контакти родичів»)`);
        kr.relations.push({
          relation_degree: e.degree || 'Інший член сім’ї / родич',
          related_full_name: soldierName,
          related_birth_date: p.birth_date || null,
          related_status: died ? 'Невідомо' : 'Діючий військовослужбовець',
          related_mp: 'Так',
          related_unit_id: p.mp_unit_id || null,
          related_unit_code: p.military_unit_code || null
        });
        if (died) kr.warnings.push('Статус пораненого уточнюється — перевірте статус у зв’язку');
        kr.programs.push(ctx.programByName('Супровід поранених (300)'));
        out.push(kr);
      });
    });
    return out;
  }

  // Телефони з комірки (може бути кілька): перший — основний, решта — додаткові
  function setPhone(rec, raw) {
    const s = clean(raw);
    if (!s) {
      if (!rec.person.phone) rec.warnings.push('Немає телефону: не потрапить у розсилку');
      return;
    }
    const { phones, bad } = V.extractPhones(s);
    if (!phones.length) {
      // Не відкидаємо людину: номер зберігаємо в коментарі, щоб оператор виправив у картці
      const d = s.replace(/\D/g, '');
      const why = d.startsWith('0') && d.length === 11 ? 'зайва цифра'
        : d.startsWith('0') && d.length === 9 ? 'бракує цифри'
        : d.length < 9 ? 'замало цифр' : 'невідомий формат';
      rec.warnings.push(`Телефон «${s}» не розпізнано (${why}) — збережено в коментарі, виправте в картці`);
      addComment(rec, `Телефон з файлу (не розпізнано): ${s}`);
      return;
    }
    addPhones(rec, phones);
    if (bad.length) rec.warnings.push(`Частину телефону не розпізнано: «${bad.join(', ')}» — перевірте`);
  }

  function addComment(rec, text) {
    rec.person.comment = rec.person.comment ? `${rec.person.comment}\n${text}` : text;
  }

  function addPhones(rec, phones) {
    const p = rec.person;
    p.extra_phones = p.extra_phones || [];
    phones.forEach((ph) => {
      if (p.phone === ph.value || p.extra_phones.includes(ph.value)) return;
      if (!p.phone) p.phone = ph.value; else p.extra_phones.push(ph.value);
      if (ph.warning && !rec.warnings.includes(ph.warning)) rec.warnings.push(ph.warning);
    });
    if (p.extra_phones.length) rec.info.push(`Телефонів: ${1 + p.extra_phones.length} (основний + додаткові)`);
  }

  // ПІБ, у якому заодно записано телефон: «Іванова Марія 0501234567»
  function splitNameCell(rec, raw) {
    const { phones, rest } = V.extractPhones(clean(raw));
    if (phones.length) {
      addPhones(rec, phones);
      rec.info.push('Телефон знайдено в колонці з ПІБ — розділено');
    }
    return rest;
  }

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

      // Представник (може бути кілька через кому; цифри в ПІБ; лише одне слово)
      const repParts = splitNameCell(rec, g('rep')).split(/\s*[,;\/\\]\s*/).filter(Boolean);
      const childSurname = (V.normalizeName(clean(g('child')), false).value || '').split(' ')[0] || '';
      const repFio = (raw) => {
        let t = clean(raw), note = '';
        if (/\d/.test(t)) { t = t.replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim(); note = 'у ПІБ були цифри — прибрано'; }
        const f = splitFio(t);
        if (!f.error) return note ? { ...f, name_check: true, name_check_note: note } : f;
        const words = (V.normalizeName(t, false).value || '').split(' ').filter(Boolean);
        if (words.length === 1) {
          if (childSurname && letters(words[0]) === letters(childSurname)) {
            return { last_name: words[0], first_name: 'Представник', patronymic: null, name_check: true, name_check_note: 'вказано лише прізвище' };
          }
          if (childSurname) {
            return { last_name: childSurname, first_name: words[0], patronymic: null, name_check: true, name_check_note: 'вказано одне слово, прізвище взято з прізвища дитини' };
          }
          return { last_name: words[0], first_name: 'Представник', patronymic: null, name_check: true, name_check_note: 'вказано одне слово' };
        }
        return { error: f.error };
      };
      const fio = repFio(repParts[0] || '');
      if (fio.error) rec.errors.push(`Представник: ${fio.error}`);
      else {
        Object.assign(p, fio);
        if (fio.name_check) rec.warnings.push(`ПІБ представника: ${fio.name_check_note} — потрібно уточнити (у реєстрі буде червона позначка)`);
      }
      const extraReps = repParts.slice(1).map(repFio).filter((f) => !f.error);
      setPhone(rec, g('phone'));

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

      // Другий представник з тієї ж анкети → додаткова картка (без дітей, щоб не дублювати)
      extraReps.forEach((f) => {
        const kr = newRecord(rec.rows[0]);
        kr.isRelative = true;
        Object.assign(kr.person, f, { is_extra: true, region_id: p.region_id || null, settlement: p.settlement || null,
          consent_pd_at: p.consent_pd_at || null, has_children: rec.children.length ? 'Так' : 'Невідомо' });
        kr.relations = rec.relations.map((x) => ({ ...x }));
        kr.programs = [...rec.programs];
        // якщо в анкеті кілька телефонів — другий віддаємо другому представнику
        const ph = (p.extra_phones || []).shift();
        if (ph) { kr.person.phone = ph; kr.info.push('Телефон — другий номер з анкети'); }
        kr.warnings.push(ph ? 'Другий представник з тієї ж анкети — діти записані в основній картці'
          : 'Другий представник з тієї ж анкети — телефону немає, діти записані в основній картці');
        if (f.name_check) kr.warnings.push(`ПІБ: ${f.name_check_note} — потрібно уточнити`);
        addComment(kr, `Другий представник з анкети, основна картка: ${[p.last_name, p.first_name].filter(Boolean).join(' ')}`);
        out.push(kr);
      });
    });
    return out;
  }

  // ---------- «Діти МП», нова форма: ПІБ трьома полями, другий телефон, дата народження і стать представника, до 5 дітей ----------
  // Рядок перетворюємо на формат старої форми й далі працює вже відкалібрований розбір; нові поля дописуємо після нього.
  // Аркуш зі старими відповідями під новими заголовками (повне ПІБ в одній клітинці) теж проходить: порожні частини просто не додаються.
  function parseKidsV2(rows, hdr, ctx) {
    const hs = hdr.map((h) => clean(h));
    const top = (n) => hs.findIndex((h) => new RegExp('^' + n + '\\.\\s').test(h));            // «1. …»
    const sub = (k) => hs.findIndex((h) => new RegExp('^' + k.replace(/\./g, '\\.') + '\\s').test(h));   // «1.1 …», «10.11 …»
    const tsI = hs.findIndex((h) => /позначка|відмітка|отметка|timestamp/i.test(h));
    const I = {
      rep: [top(1), sub('1.1'), sub('1.2')], repBd: sub('1.3'), repSex: sub('1.4'),
      phone: top(2), phone2: sub('2.1'), email: top(3), region: top(4), place: top(5), cat: top(6),
      mil: [top(7), sub('7.1'), sub('7.2')], unit: top(8), kin: top(9),
      interests: top(11), needs: top(12), other: top(15),
      consent: hs.findIndex((h) => /підтверджую достовірність/i.test(h)),
      toMil: hs.findIndex((h) => /ким ви доводитеся військовому/i.test(h)),    // необов’язкове питання: якщо є у формі — знімає попередження
      milBd: hs.findIndex((h) => /дата народження\s+(морського піхотинця|військов)/i.test(h))   // необов’язкове: допомагає відрізнити однофамільців
    };
    const kidCols = (b) => ({ name: [sub(`10.${b}1`), sub(`10.${b}2`), sub(`10.${b}3`)], bd: sub(`10.${b}4`), sex: sub(`10.${b}5`) });
    const kids = [1, 2, 3, 4, 5].map(kidCols);
    if (I.rep[0] < 0 || I.phone < 0 || kids[0].name[0] < 0 || kids[0].bd < 0) throw new Error('У файлі бракує колонок нової форми «Діти Морської піхоти» (ПІБ представника, телефон, дитина 10.11–10.14).');
    const at = (r, i) => (i >= 0 ? r[i] : null);
    const join = (r, idx) => idx.map((i) => clean(at(r, i))).filter(Boolean).join(' ');
    const oldHdr = ['Позначка часу', '1. Представник', '2. Телефон', '3. Пошта', '4. Область', '5. Населений пункт', '6. Категорія', '7. Військовий', '8. Підрозділ',
      '9. Споріднення з дитиною', '10. Дитина', '11. Дата народження дитини', '12. Стать дитини', '13. Напрямки', '14. Особливі потреби', '15. Інші діти', '16. Згода'];
    const oldRows = rows.map((r) => [at(r, tsI), join(r, I.rep), [at(r, I.phone), at(r, I.phone2)].map(clean).filter(Boolean).join(' '), at(r, I.email), at(r, I.region),
      at(r, I.place), at(r, I.cat), join(r, I.mil), at(r, I.unit), at(r, I.kin), join(r, kids[0].name), at(r, kids[0].bd), at(r, kids[0].sex),
      at(r, I.interests), at(r, I.needs), at(r, I.other), at(r, I.consent)]);
    const out = parseKids(oldRows, oldHdr, ctx);
    const byRow = new Map(); out.forEach((rec) => { if (!rec.isRelative && !byRow.has(rec.rows[0])) byRow.set(rec.rows[0], rec); });
    rows.forEach((r, i) => {
      const rec = byRow.get(i + 2); if (!rec) return;
      const p = rec.person;
      // представник: дата народження і стать
      if (clean(at(r, I.repBd)) || at(r, I.repBd) instanceof Date) {
        const iso = toDate(at(r, I.repBd)); const chk = iso ? V.checkBirthDate(iso) : { error: 'невірна дата' };
        if (iso && !chk.error) {
          p.birth_date = iso;
          if (yearsOld(iso) < 16) rec.warnings.push(`Представнику ${yearsOld(iso)} років — перевірте дату народження`);
        } else rec.warnings.push(`Дата народження представника: ${String(chk.error || 'невірна дата').toLowerCase()} — не записано`);
      }
      const tm = clean(at(r, I.toMil));
      const noKinWarn = () => { rec.warnings = rec.warnings.filter((w) => !/ким представник доводиться військовому|схоже на ПІБ представника/.test(w)); };
      if (/^я сам/i.test(tm)) {
        // представник сам є військовим: зв’язок не потрібен, статус — у його картці
        const rel = rec.relations[0];
        const st = rel ? rel.related_status : p.military_status;
        if (rel && ['Діючий військовослужбовець', 'Ветеран'].includes(st)) {
          p.military_status = st; p.mp_relation = 'Так';
          p.mp_relation_type = st === 'Ветеран' ? 'Ветеран МП' : 'Діючий військовослужбовець МП';
          p.mp_unit_id = rel.related_unit_id; p.mp_unit_other = rel.related_unit_other;
          rec.relations = []; noKinWarn();
          rec.info.push('Представник сам є військовим МП (так вказано у формі)');
          if (letters(join(r, I.mil)) && letters(join(r, I.mil)) !== letters(join(r, I.rep))) rec.warnings.push('У формі вказано, що представник сам військовий, але ПІБ військового інше — перевірте');
        } else if (rel) rec.warnings.push(`У формі вказано «${tm}», але категорія родини — «${st}». Перевірте, хто заповнював анкету`);
      } else if (tm && rec.relations[0]) {
        const deg = OPT.relation_degree.find((d) => d.toLowerCase() === tm.toLowerCase());
        if (deg) { rec.relations[0].relation_degree = deg; rec.warnings = rec.warnings.filter((w) => !/ким представник доводиться військовому/.test(w)); }
        else rec.warnings.push(`Спорідненість із військовим «${tm}» не зі списку — вкажіть вручну`);
      }
      const mb = at(r, I.milBd);
      if (clean(mb) || mb instanceof Date) {
        const iso = toDate(mb); const chk = iso ? V.checkBirthDate(iso) : { error: 'невірна дата' };
        if (!iso || chk.error) rec.warnings.push(`Дата народження військового: ${String(chk.error || 'невірна дата').toLowerCase()} — не записано`);
        else if (rec.relations[0]) rec.relations[0].related_birth_date = iso;
        else if (!p.birth_date) p.birth_date = iso;      // представник сам військовий
      }
      const sx = clean(at(r, I.repSex)).toLowerCase();
      if (/^чол/.test(sx)) p.sex = 'Чоловіча'; else if (/^жін/.test(sx)) p.sex = 'Жіноча';
      // діти 2–5
      const ts = toDate(at(r, tsI));
      kids.slice(1).forEach((k, n) => {
        const name = join(r, k.name), bd = at(r, k.bd);
        if (!name && !clean(bd) && !(bd instanceof Date)) return;
        if (!name) { rec.warnings.push(`Дитина ${n + 2}: є дата народження, але немає ПІБ — не додано`); return; }
        const kid = makeChild(name, bd, at(r, k.sex), at(r, I.interests), null, ts, rec);
        if (kid && !rec.children.some((c) => c.full_name === kid.full_name && c.birth_date === kid.birth_date)) rec.children.push(kid);
      });
      if (rec.children.length) p.has_children = 'Так';
    });
    return out;
  }

  function makeChild(name, bd, sex, interests, needs, ts, rec) {
    const { iso, fix } = toDateNote(bd);
    const nm = clean(name);
    if (iso && fix) rec.warnings.push(`Дитина «${nm}»: дату «${clean(bd)}» виправлено (${fix}) → ${iso.split('-').reverse().join('.')} — перевірте`);
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

  // Роль у модулі: основна для «головного» запису рядка, зв’язана — для родичів;
  // окремі винятки (помер у «300» і є в «200») — через roleOverride
  function roleFor(rec, pid) {
    return (rec.roleOverride && rec.roleOverride[pid]) || (rec.isRelative ? 'linked' : 'main');
  }

  // неіснуючі дати по рядках файлу: рядок → ['31.09.2026', …]; потрапляють у попередження
  let curRow = null; const badDates = new Map();
  function newRecord(row) {
    curRow = row;
    return {
      rows: [row], person: {}, relations: [], children: [], programs: [],
      errors: [], warnings: [], info: [], state: null, existing: null, include: true
    };
  }

  // Колонки журналу, яких немає в реєстрі (звання, посада, етапи супроводу…) — зберігаємо як є,
  // щоб «Журнал 200 / 300» міг перенести їх назад один до одного
  const JOURNAL_SKIP = /(^id$|прізвище|імя|ім’я|по батькові|^піб|телефон|контакти отримувача|контакти родичів|отримувач|родич \d|спорідненість|адреса|дата народження|дата загибелі|дата поховання|місце поховання|позивний|^бригада|військова частина|^в\/ч|^регіон|осередок|^примітки|^убд$|дата поранення)/i;
  function captureJournal(list, template) {
    const key = /\(200\)/.test(template.program) ? '200' : /\(300\)/.test(template.program) ? '300' : null;
    if (!key) return;
    list.forEach((rec) => {
      if (rec.isRelative) return;
      const data = {};
      rec.rows.forEach((rowNo) => {
        const r = rawRows[rowNo - 2] || [];
        header.forEach((h, i) => {
          const name = clean(h);
          if (!name || JOURNAL_SKIP.test(name.replace(/[’']/g, ''))) return;
          const v = r[i];
          if (v === null || v === undefined || clean(v) === '' || data[name] !== undefined) return;
          const isDate = /дата|дзвінок/i.test(name);
          data[name] = isDate ? (toDate(v) || clean(v)) : (typeof v === 'number' ? v : clean(v));
        });
      });
      const prev = (rec.person.journal || {})[key] || {};   // значення, які вже поклав розбір (напр. УБД)
      if (Object.keys(data).length || Object.keys(prev).length) rec.person.journal = { ...(rec.person.journal || {}), [key]: { ...data, ...prev } };
    });
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
      (r.vets || []).forEach((v) => { prev.vets = prev.vets || []; if (!prev.vets.includes(v)) prev.vets.push(v); });
      // якщо хоч одна з анкет «основна» для свого модуля — роль за модулем зберігаємо
      r.programs.forEach((pid) => {
        if (!prev.programs.includes(pid)) prev.programs.push(pid);
        if (!r.isRelative) prev.roleOverride = { ...(prev.roleOverride || {}), [pid]: 'main' };
      });
      r.warnings.forEach((w) => { if (!prev.warnings.includes(w)) prev.warnings.push(w); });
      r.info.forEach((w) => { if (!prev.info.includes(w)) prev.info.push(w); });
      prev.info.push(`Об’єднано з рядком ${r.rows[0]} (той самий телефон)`);
      if (prev.children.length) prev.person.has_children = 'Так';
    });
    return out;
  }

  // Звірка з базою: хто вже є
  // «300»: поранений помер → шукаємо його в даних «200» і беремо звідти дані про загибель
  async function crossCheck200(list, db) {
    const dead = list.filter((r) => r.diedNote && r.person.last_name);
    if (!dead.length) return;
    for (const r of dead) {
      const p = r.person;
      const fullName = [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');
      const [rel, card] = await Promise.all([
        db.from('military_relations')
          .select('related_full_name, related_birth_date, related_death_date, related_burial_date, related_burial_place, related_callsign, related_unit_id, related_unit_other, related_unit_code')
          .eq('related_status', 'Загиблий').ilike('related_full_name', `${p.last_name}%`).limit(20),
        db.from('persons')
          .select('id, phone, extra_phones, name_check, is_extra, last_name, first_name, patronymic, email, region_id, settlement, cell_id, birth_date, wound_date, death_date, burial_date, consent_pd_at, consent_messages, children(birth_date, full_name), military_relations!military_relations_person_id_fkey(id, related_full_name), person_programs(program_id, role)')
          .eq('military_status', 'Загиблий').ilike('last_name', `${p.last_name.slice(0, 4)}%`).limit(20)
      ]);
      const same = (n, bd) => letters(n) === letters(fullName) && (!bd || !p.birth_date || bd === p.birth_date);
      const r200 = (rel.data || []).find((x) => same(x.related_full_name, x.related_birth_date));
      const c200 = (card.data || []).find((x) => same([x.last_name, x.first_name, x.patronymic].filter(Boolean).join(' '), x.birth_date));
      if (!r200 && !c200) {
        r.warnings.push(`У примітках: «${r.diedNote}». У журналі «200» не знайдено — статус «Статус уточнюється», уточніть`);
        continue;
      }
      const src = r200 || {};
      p.military_status = 'Загиблий';
      p.death_date = src.related_death_date || c200?.death_date || null;
      p.burial_date = src.related_burial_date || c200?.burial_date || null;
      if (src.related_unit_id) { p.mp_unit_id = src.related_unit_id; p.mp_unit_other = null; }
      if (src.related_unit_code && !p.military_unit_code) p.military_unit_code = src.related_unit_code;
      p.mp_relation_type = 'Загиблий військовослужбовець МП';
      if (src.related_burial_place) addComment(r, `Місце поховання: ${src.related_burial_place}`);
      if (src.related_callsign) addComment(r, `Позивний: ${src.related_callsign}`);
      const prog200 = [...Persons.ctx().programs].find(([, n]) => n === 'Супровід родин загиблих (200)')?.[0];
      if (prog200 && !r.programs.includes(prog200)) r.programs.push(prog200);
      const prog300 = [...Persons.ctx().programs].find(([, n]) => n === 'Супровід поранених (300)')?.[0];
      r.roleOverride = { ...(r.roleOverride || {}), [prog200]: 'main', [prog300]: 'linked' };
      r.info.push('Знайдено в журналі «200»: статус «Загиблий», дати загибелі й поховання взято звідти (основний модуль — 200)');
      if (c200) { r.mergeTo200 = c200; r.info.push('У реєстрі вже є картка цього загиблого з «200» — дані буде об’єднано з нею'); }
      // родичі з «300» — зв’язані картки до загиблого
      list.filter((k) => k.linkTo === r).forEach((k) => k.relations.forEach((x) => {
        Object.assign(x, { related_status: 'Загиблий', related_death_date: p.death_date, related_burial_date: p.burial_date });
        k.warnings = k.warnings.filter((w) => !w.startsWith('Статус пораненого уточнюється'));
      }));
    }
  }

  async function matchExisting(list) {
    const { db } = Persons.ctx();
    await crossCheck200(list, db);
    const COLS = 'id, journal, phone, extra_phones, name_check, is_extra, last_name, first_name, patronymic, email, region_id, settlement, cell_id, birth_date, consent_pd_at, consent_messages, children(birth_date, full_name), military_relations!military_relations_person_id_fkey(id, related_full_name, related_death_date, related_burial_date, related_burial_place, related_callsign, related_unit_code, related_person_id), person_programs(program_id, role)';
    const allPhones = (r) => [r.person.phone, ...(r.person.extra_phones || [])].filter(Boolean);
    const phones = [...new Set(list.flatMap(allPhones))];
    const found = new Map();
    const byId = new Map();     // одна й та сама людина = один об’єкт (щоб кілька рядків файлу бачили зміни одне одного)
    const one = (p) => { if (!byId.has(p.id)) byId.set(p.id, p); return byId.get(p.id); };
    const remember = (p) => { p = one(p); [p.phone, ...(p.extra_phones || [])].filter(Boolean).forEach((ph) => { if (!found.has(ph)) found.set(ph, p); }); };
    for (let i = 0; i < phones.length; i += 100) {
      const chunk = phones.slice(i, i + 100);
      const [a, b] = await Promise.all([
        db.from('persons').select(COLS).in('phone', chunk),
        db.from('persons').select(COLS).overlaps('extra_phones', chunk)
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      [...a.data, ...b.data].forEach(remember);
    }
    // Без телефону — шукаємо за ПІБ (лише точний і єдиний збіг), щоб повторний імпорт не дублював
    const noPhone = list.filter((r) => !r.person.phone && r.person.last_name && !r.errors.length);
    const byName = new Map();
    const lastNames = [...new Set(noPhone.map((r) => r.person.last_name))];
    for (let i = 0; i < lastNames.length; i += 100) {
      const { data, error } = await db.from('persons').select(COLS).in('last_name', lastNames.slice(i, i + 100));
      if (error) throw error;
      data.forEach((p) => {
        const k = letters(p.last_name) + '|' + letters(p.first_name) + '|' + letters(p.patronymic);
        p = one(p);
        byName.set(k, byName.has(k) && byName.get(k) !== p ? 'many' : p);
      });
    }
    list.forEach((r) => {
      if (r.errors.length) { r.state = 'error'; r.include = false; return; }
      let ex = allPhones(r).map((ph) => found.get(ph)).find(Boolean);
      if (!ex && r.mergeTo200) ex = r.mergeTo200;
      if (!ex && !r.person.phone && r.person.last_name) {
        const k = letters(r.person.last_name) + '|' + letters(r.person.first_name) + '|' + letters(r.person.patronymic);
        const m = byName.get(k);
        if (m && m !== 'many') { ex = m; r.info.push('Знайдено в реєстрі за ПІБ (телефону немає)'); }
        else if (m === 'many') r.warnings.push('У реєстрі кілька людей з таким ПІБ — буде створено нову картку, перевірте');
      }
      if (ex) {
        r.existing = ex;
        const fullNew = r.person.last_name && r.person.first_name && !r.person.name_check;
        if (ex.name_check && fullNew) {
          // у реєстрі тимчасове ПІБ (напр. «Цибін Родич») — новий файл дає справжнє
          r.fixName = true;
          r.info.push(`Тимчасове ПІБ «${ex.last_name} ${ex.first_name}» буде замінено на «${[r.person.last_name, r.person.first_name, r.person.patronymic].filter(Boolean).join(' ')}»`);
        } else if (letters(ex.last_name).slice(0, 4) !== letters(r.person.last_name).slice(0, 4)) {
          r.warnings.push(`Телефон уже є в реєстрі у «${ex.last_name} ${ex.first_name}» — перевірте, чи це та сама людина`);
        }
        const newKids = r.children.filter((k) => !(ex.children || []).some((x) => x.birth_date === k.birth_date));
        r.info.push(newKids.length ? `Уже є в реєстрі: буде додано дітей — ${newKids.length}` : 'Уже є в реєстрі: нових дітей немає');
        const burialFix = r.relations.filter((rel) => rel.related_burial_date &&
          (ex.military_relations || []).some((x) => letters(x.related_full_name) === letters(rel.related_full_name) && !x.related_burial_date)).length;
        if (burialFix) r.info.push(`Буде доповнено дату поховання: ${burialFix}`);
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

    $('imp-file').addEventListener('change', onFile);
    $('imp-form-btn').addEventListener('click', onForm);
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
    records = []; rawRows = []; header = []; fromForm = null;
    $('imp-file').value = '';
    $('imp-result').hidden = true;
    $('imp-status').textContent = '';
  }

  // ---------- Анкети з Google Форми (читає робот, далі — той самий перегляд) ----------
  let fromForm = null;      // { maxRow } — якщо поточний перегляд узято з форми
  async function onForm() {
    const btn = $('imp-form-btn');
    const showAll = $('imp-form-all').checked;
    btn.disabled = true;
    $('imp-status').textContent = 'Робот читає таблицю анкет…';
    $('imp-result').hidden = true;
    try {
      const { db } = Persons.ctx();
      const { data, error } = await db.functions.invoke('kids-form', { body: { action: 'read' } });
      if (error || !data?.ok) {
        let msg = data?.error;
        if (!msg && error?.context?.json) msg = (await error.context.json().catch(() => ({}))).error;
        throw new Error(msg || 'Не вдалося прочитати таблицю анкет.');
      }
      const total = data.rows.length;
      const from = showAll ? 0 : data.seen;
      if (total + 1 <= from) {
        $('imp-status').textContent = `Нових анкет немає (у таблиці ${total}, усі вже розібрано). Щоб переглянути старі — позначте «показати й раніше розібрані».`;
        return;
      }
      template = TEMPLATES.find((t) => t.id === 'kids_mp_v2');
      $('imp-template').value = template.id;
      fileName = 'Google Форма: ' + (data.title || 'анкети');
      fromForm = { maxRow: total + 1 };
      await processTable([data.header, ...data.rows], (r) => r.rows[0] > from,
        showAll ? `Усі анкети з таблиці (${total}). ` : `Нові анкети: рядки ${from + 1}–${total + 1} таблиці. `);
    } catch (err) {
      console.error(err);
      $('imp-status').textContent = err.message || 'Не вдалося прочитати таблицю анкет.';
    } finally { btn.disabled = false; }
  }

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    fileName = file.name;
    fromForm = null;
    template = TEMPLATES.find((t) => t.id === $('imp-template').value);
    $('imp-status').textContent = 'Читаємо файл…';
    $('imp-result').hidden = true;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      // аркуш із даними: перший, чий заголовок підходить під якийсь шаблон (у шаблонах першим іде «Як заповнювати»)
      const sheetRows = (n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
      // для пошуку читаємо лише перший рядок кожного аркуша (інші аркуші бувають дуже «широкими» й повільними)
      const firstRow = (n) => {
        const ws = wb.Sheets[n];
        if (!ws || !ws['!ref']) return [];
        const rg = XLSX.utils.decode_range(ws['!ref']);
        rg.e.r = rg.s.r; rg.e.c = Math.min(rg.e.c, rg.s.c + 200);
        return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, range: rg })[0] || [];
      };
      const dataSheet = wb.SheetNames.find((n) => TEMPLATES.some((t) => t.detect(firstRow(n)))) || wb.SheetNames[0];
      await processTable(sheetRows(dataSheet));
    } catch (err) {
      console.error(err);
      $('imp-status').textContent = err.message && !/fetch|network/i.test(err.message)
        ? err.message : 'Не вдалося прочитати файл. Перевірте, що це Excel (.xlsx).';
    }
  }

  // Спільний розбір: таблиця (рядки з заголовком) → записи → звірка з реєстром → перегляд
  async function processTable(all, keep = null, note = '') {
    header = all[0] || [];
    rawRows = all.slice(1);
    let autoNote = '';
    if (!template.detect(header)) {
      const other = TEMPLATES.find((t) => t.detect(header));
      if (!other) {
        $('imp-status').textContent = 'Файл не схожий на жоден шаблон (Діти МП, 200, 300). Перевірте, що це потрібна таблиця.';
        return;
      }
      template = other;
      $('imp-template').value = other.id;
      autoNote = `Шаблон визначено автоматично: «${other.label}». `;
    }
    const ctx = Persons.ctx();
    const progId = (name) => [...ctx.programs].find(([, n]) => n === name)?.[0];
    badDates.clear(); curRow = null;
    let list = template.parse(rawRows, header, { ...ctx, programByName: progId });
    list.forEach((r) => {
      if (r.isRelative) return;
      const bad = badDates.get(r.rows[0]);
      if (bad) r.warnings.push(`Дати ${bad.join(', ')} не існує (у місяці менше днів) — не записано, внесіть правильну в картці`);
    });
    captureJournal(list, template);
    if (keep) list = list.filter(keep);
    list = mergeByPhone(list);
    $('imp-status').textContent = 'Звіряємо з реєстром…';
    await matchExisting(list);
    records = list;
    renderPreview();
    $('imp-status').textContent = note + autoNote;
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
    const rel = records.filter((r) => r.isRelative).length;
    if (rel) {
      const info = document.createElement('span');
      info.className = 'imp-chip imp-chip-info';
      info.textContent = `Усього записів ${records.length} = ${records.length - rel} основних + ${rel} зв’язаних (родичі)`;
      $('imp-summary').appendChild(info);
    }

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
      cells.slice(1).forEach((t, k) => {
        const td = document.createElement('td');
        td.textContent = t;
        if (k === 1 && r.isRelative) {
          td.className = 'imp-relative';
          const tag = document.createElement('span');
          tag.className = 'mod mlinked'; tag.textContent = 'зв’язана';
          td.prepend(tag, ' ');
        }
        tr.appendChild(td);
      });
      if (r.isRelative) tr.classList.add('is-relative');

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
        // Родич → посилання на картку свого бійця (бійця записано раніше в цьому ж імпорті)
        if (r.linkTo && r.linkTo.savedId) r.relations.forEach((rel) => { rel.related_person_id = r.linkTo.savedId; });
        if (r.existing) { await addToExisting(db, r); r.savedId = r.existing.id; }
        else r.savedId = await createNew(db, r, batch.id);
        done++;
      } catch (e) {
        console.error(e);
        failed++;
        r.errors.push('Не вдалося записати: ' + dbError(e));
        r.state = 'error';
      }
      $('imp-status').textContent = `Імпортуємо… ${done + failed} з ${todo.length}`;
    }
    await db.from('import_batches').update({ rows_imported: done, rows_skipped: records.length - done }).eq('id', batch.id);
    // анкети з форми: запам’ятовуємо, до якого рядка таблиці вже розібрано (наступного разу — лише нові)
    if (fromForm) {
      const { error: me } = await db.functions.invoke('kids-form', { body: { action: 'mark', row: fromForm.maxRow } });
      if (me) console.error(me);
    }
    // кабінет 200 / 300: нові справи й етапи з журналу
    if (/\((200|300)\)/.test(template.program)) {
      const { data: sc, error: se } = await db.rpc('sync_cases_from_registry');
      if (se) console.error(se); else if (sc && (sc.new200 || sc.new300)) Persons.toast(`Кабінет: нових справ ${sc.new200 + sc.new300}`);
    }

    $('imp-status').textContent = `Готово: імпортовано ${done}` + (failed ? `, не вдалося ${failed} (див. позначки нижче)` : '') + '.';
    renderPreview();
    records.forEach((r) => { if (r.state !== 'error') r.include = false; });
    updateRunButton();
    loadBatches();
    Persons.showList();
  }

  // Зрозуміле пояснення помилки бази
  function dbError(e) {
    const m = `${e.message || ''} ${e.details || ''}`;
    const C = {
      persons_phone_uniq: 'цей телефон уже належить іншій картці в реєстрі',
      persons_birth_date_check: 'дата народження поза межами (раніше 1900 р. або в майбутньому)',
      persons_phone_check: 'невірний формат телефону',
      persons_email_check: 'невірний формат email',
      persons_death_after_birth: 'дата смерті раніше дати народження',
      persons_death_not_future: 'дата смерті в майбутньому',
      persons_wound_not_future: 'дата поранення в майбутньому',
      persons_extra_phones_format: 'невірний формат додаткового телефону',
      rel_death_after_birth: 'у військового дата загибелі раніше дати народження',
      rel_death_not_future: 'у військового дата загибелі в майбутньому',
      children_birth_date_check: 'дата народження дитини в майбутньому',
      military_relations_relation_degree_check: 'невідомий ступінь спорідненості'
    };
    const hit = Object.keys(C).find((k) => m.includes(k));
    if (hit) return C[hit];
    if (e.code === '23505') return 'такий запис уже є (дублікат)';
    return 'помилка бази' + (e.message ? ` (${e.message})` : '');
  }

  async function createNew(db, r, batchId) {
    const p = { ...r.person, source: fromForm ? 'Анкета' : 'Excel', source_ref: fileName, import_batch_id: batchId };
    const { data, error } = await db.from('persons').insert(p).select('id').single();
    if (error) throw error;
    await insertChildren(db, data.id, r.relations, r.children,
      r.programs.filter(Boolean).map((pid) => ({ program_id: pid, role: roleFor(r, pid) })), r.vets);
    return data.id;
  }

  async function addToExisting(db, r) {
    const ex = r.existing;
    const patch = {};
    ['email', 'region_id', 'settlement', 'cell_id', 'birth_date', 'consent_pd_at', 'wound_date'].forEach((k) => { if (!ex[k] && r.person[k]) patch[k] = r.person[k]; });
    if (r.fixName) {
      Object.assign(patch, { last_name: r.person.last_name, first_name: r.person.first_name,
        patronymic: r.person.patronymic || null, name_check: false, name_check_note: null });
    }
    if (!ex.consent_messages && r.person.consent_messages) patch.consent_messages = true;
    if (ex.is_extra && !r.isRelative) patch.is_extra = false;
    if (r.person.journal) {
      const j = { ...(ex.journal || {}) };
      Object.entries(r.person.journal).forEach(([k, v]) => { j[k] = { ...(j[k] || {}), ...v }; });
      patch.journal = j;
    }     // людина основна хоча б в одному модулі
    ['military_status', 'death_date', 'burial_date', 'mp_relation_type'].forEach((k) => {
      if (r.diedNote && r.person[k] && r.person.military_status === 'Загиблий') patch[k] = r.person[k];
    });
    const known = new Set([ex.phone, ...(ex.extra_phones || [])].filter(Boolean));
    const newPhones = [r.person.phone, ...(r.person.extra_phones || [])].filter((ph) => ph && !known.has(ph));
    if (newPhones.length) {
      if (!ex.phone) { patch.phone = newPhones.shift(); }
      if (newPhones.length) patch.extra_phones = [...(ex.extra_phones || []), ...newPhones];
    }
    if (Object.keys(patch).length) {
      const { error } = await db.from('persons').update(patch).eq('id', ex.id);
      if (error) throw error;
      Object.assign(ex, patch);
    }
    const kids = r.children.filter((k) => !(ex.children || []).some((x) => x.birth_date === k.birth_date));
    const rels = r.relations.filter((rel) => !(ex.military_relations || []).some((x) => letters(x.related_full_name) === letters(rel.related_full_name)));
    // Наявні зв’язки: доповнюємо порожні поля (дата поховання, місце, дата загибелі, позивний, в/ч)
    for (const rel of r.relations) {
      const old = (ex.military_relations || []).find((x) => letters(x.related_full_name) === letters(rel.related_full_name));
      if (!old) continue;
      const fix = {};
      ['related_burial_date', 'related_burial_place', 'related_death_date', 'related_callsign', 'related_unit_code', 'related_person_id']
        .forEach((k) => { if (!old[k] && rel[k]) fix[k] = rel[k]; });
      if (Object.keys(fix).length) {
        const { error } = await db.from('military_relations').update(fix).eq('id', old.id);
        if (error) throw error;
        Object.assign(old, fix);
      }
    }
    const progs = [];
    for (const pid of r.programs.filter(Boolean)) {
      const role = roleFor(r, pid);
      const old = (ex.person_programs || []).find((x) => x.program_id === pid);
      if (!old) progs.push({ program_id: pid, role });
      else if (old.role === 'linked' && role === 'main') {
        // у цьому модулі людина тепер основна
        const { error } = await db.from('person_programs').update({ role: 'main' }).eq('person_id', ex.id).eq('program_id', pid);
        if (error) throw error;
        old.role = 'main';
      } else if (old.role === 'main' && role === 'linked' && r.roleOverride && r.roleOverride[pid] === 'linked') {
        // помер у «300»: у модулі 300 стає зв’язаним (основний — у 200)
        const { error } = await db.from('person_programs').update({ role: 'linked' }).eq('person_id', ex.id).eq('program_id', pid);
        if (error) throw error;
        old.role = 'linked';
      }
    }
    if (kids.length) {
      const { error } = await db.from('persons').update({ has_children: 'Так' }).eq('id', ex.id);
      if (error) throw error;
    }
    await insertChildren(db, ex.id, rels, kids, progs, r.vets);
    // запам’ятати, що вже додано — наступний рядок файлу про цю ж людину не дублюватиме
    ex.children = [...(ex.children || []), ...kids];
    ex.military_relations = [...(ex.military_relations || []), ...rels];
    ex.person_programs = [...(ex.person_programs || []), ...progs];
  }

  async function insertChildren(db, personId, rels, kids, progs, vets) {
    if (vets && vets.length) {
      const { error } = await db.from('person_veteran_statuses')
        .upsert(vets.map((status) => ({ person_id: personId, status })), { onConflict: 'person_id,status', ignoreDuplicates: true });
      if (error) throw error;
    }
    if (rels.length) {
      const { data, error } = await db.from('military_relations').insert(rels.map((x) => ({ ...x, person_id: personId }))).select('id');
      if (error) throw error;
      (data || []).forEach((row, k) => { if (rels[k]) rels[k].id = row.id; });   // id потрібен для подальших доповнень
    }
    if (kids.length) {
      const { error } = await db.from('children').insert(kids.map((x) => ({ ...x, person_id: personId })));
      if (error) throw error;
    }
    if (progs.length) {
      const { error } = await db.from('person_programs')
        .upsert(progs.map((x) => ({ person_id: personId, program_id: x.program_id, role: x.role })), { onConflict: 'person_id,program_id', ignoreDuplicates: true });
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

  return { init, _test: { parseKids, parseKidsV2, TEMPLATES, toDate, splitFio, mergeByPhone } };
})();
