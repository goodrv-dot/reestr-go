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
    ,
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

      const baseFill = (rec, first) => {
        const p = rec.person;
        if (first) Object.assign(p, parseAddress(g('addr'), ctx.regions, rec));
        p.cell_id = matchCell(g('cell'), ctx.cells, rec);
        p.consent_pd_at = new Date().toISOString();
        rec.info.push(GO_CONSENT_NOTE);
        if (first) {
          const n = clean(g('notes'));
          if (n) addComment(rec, n);
          notes.forEach((t) => addComment(rec, t));
        }
        common.forEach((w) => rec.warnings.push(w));
        rec.programs.push(program);
      };

      // --- Родину не встановлено → картка самого загиблого ---
      if (!entries.length) {
        const rec = newRecord(row);
        const p = rec.person;
        const fio = splitFio(fallenName);
        if (fio.error) { rec.errors.push(`Загиблий: ${fio.error}`); out.push(rec); return; }
        Object.assign(p, fio, {
          military_status: 'Загиблий', birth_date: fbd, death_date: fdd, burial_date: bdate,
          mp_relation: 'Так', mp_relation_type: 'Загиблий військовослужбовець МП',
          mp_unit_id: unit.id, mp_unit_other: unit.other, military_unit_code: clean(g('vch')) || null
        });
        baseFill(rec, true);
        if (clean(g('callsign'))) addComment(rec, `Позивний: ${clean(g('callsign'))}`);
        if (clean(g('bplace'))) addComment(rec, `Місце поховання: ${clean(g('bplace'))}`);
        rec.warnings.push('Родину не встановлено — внесено картку самого загиблого. Коли знайдуться рідні, додайте їх.');
        out.push(rec);
        return;
      }

      // --- Кожна людина — окрема картка зі зв’язком із загиблим ---
      entries.forEach((e, k) => {
        const rec = newRecord(row);
        const p = rec.person;
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
        if (entries.length > 1) rec.info.push(`Одна з ${entries.length} осіб у рядку`);
        if (e.fromContacts) { p.is_extra = true; rec.isRelative = true; }
        baseFill(rec, k === 0);
        rec.relations.push({ ...relTemplate, relation_degree: e.degree || 'Інший член сім’ї / родич' });
        out.push(rec);
      });
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
      kin: col(hdr, byName(/^контакти родичів/)), notes: col(hdr, byName(/^примітки/))
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
      p.wounded = 'Так';
      p.wound_date = toDate(g('wd'));
      if (!p.wound_date) rec.warnings.push('Не вказано дату поранення');
      p.mp_relation = 'Так';
      p.mp_relation_type = 'Діючий військовослужбовець МП';
      p.military_status = 'Діючий військовослужбовець';
      const notes = clean(g('notes'));
      if (notes) addComment(rec, notes);
      const died = /помер|загинув|загибел|смерт/i.test(notes);
      if (died) {
        p.military_status = 'Статус уточнюється';
        rec.warnings.push(`У примітках: «${notes}» — перевірте статус (поставлено «Статус уточнюється»)`);
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

      // Представник
      const fio = splitFio(splitNameCell(rec, g('rep')));
      if (fio.error) rec.errors.push(`Представник: ${fio.error}`);
      else Object.assign(p, fio);
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
      (r.vets || []).forEach((v) => { prev.vets = prev.vets || []; if (!prev.vets.includes(v)) prev.vets.push(v); });
      r.programs.forEach((pid) => { if (!prev.programs.includes(pid)) prev.programs.push(pid); });
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
    const COLS = 'id, phone, extra_phones, last_name, first_name, patronymic, email, region_id, settlement, cell_id, birth_date, consent_pd_at, consent_messages, children(birth_date, full_name), military_relations!military_relations_person_id_fkey(id, related_full_name, related_death_date, related_burial_date, related_burial_place, related_callsign, related_unit_code, related_person_id), person_programs(program_id)';
    const allPhones = (r) => [r.person.phone, ...(r.person.extra_phones || [])].filter(Boolean);
    const phones = [...new Set(list.flatMap(allPhones))];
    const found = new Map();
    const remember = (p) => [p.phone, ...(p.extra_phones || [])].filter(Boolean).forEach((ph) => { if (!found.has(ph)) found.set(ph, p); });
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
        byName.set(k, byName.has(k) ? 'many' : p);
      });
    }
    list.forEach((r) => {
      if (r.errors.length) { r.state = 'error'; r.include = false; return; }
      let ex = allPhones(r).map((ph) => found.get(ph)).find(Boolean);
      if (!ex && !r.person.phone && r.person.last_name) {
        const k = letters(r.person.last_name) + '|' + letters(r.person.first_name) + '|' + letters(r.person.patronymic);
        const m = byName.get(k);
        if (m && m !== 'many') { ex = m; r.info.push('Знайдено в реєстрі за ПІБ (телефону немає)'); }
        else if (m === 'many') r.warnings.push('У реєстрі кілька людей з таким ПІБ — буде створено нову картку, перевірте');
      }
      if (ex) {
        r.existing = ex;
        if (letters(ex.last_name) !== letters(r.person.last_name)) {
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
      let list = template.parse(rawRows, header, { ...ctx, programByName: progId });
      list = mergeByPhone(list);
      $('imp-status').textContent = 'Звіряємо з реєстром…';
      await matchExisting(list);
      records = list;
      renderPreview();
      $('imp-status').textContent = autoNote;
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
    const rel = records.filter((r) => r.isRelative).length;
    if (rel) {
      const info = document.createElement('span');
      info.className = 'imp-chip imp-chip-info';
      info.textContent = `Усього записів ${records.length} = ${records.length - rel} основних + ${rel} додаткових (родичі)`;
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
          tag.className = 'tag tag-extra'; tag.textContent = 'додаткова · родич';
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
    await insertChildren(db, data.id, r.relations, r.children, r.programs.filter(Boolean), r.vets);
    return data.id;
  }

  async function addToExisting(db, r) {
    const ex = r.existing;
    const patch = {};
    ['email', 'region_id', 'settlement', 'cell_id', 'birth_date', 'consent_pd_at'].forEach((k) => { if (!ex[k] && r.person[k]) patch[k] = r.person[k]; });
    if (!ex.consent_messages && r.person.consent_messages) patch.consent_messages = true;
    const known = new Set([ex.phone, ...(ex.extra_phones || [])].filter(Boolean));
    const newPhones = [r.person.phone, ...(r.person.extra_phones || [])].filter((ph) => ph && !known.has(ph));
    if (newPhones.length) {
      if (!ex.phone) { patch.phone = newPhones.shift(); }
      if (newPhones.length) patch.extra_phones = [...(ex.extra_phones || []), ...newPhones];
    }
    if (Object.keys(patch).length) {
      const { error } = await db.from('persons').update(patch).eq('id', ex.id);
      if (error) throw error;
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
      }
    }
    const progs = r.programs.filter((pid) => pid && !(ex.person_programs || []).some((x) => x.program_id === pid));
    if (kids.length) {
      const { error } = await db.from('persons').update({ has_children: 'Так' }).eq('id', ex.id);
      if (error) throw error;
    }
    await insertChildren(db, ex.id, rels, kids, progs, r.vets);
  }

  async function insertChildren(db, personId, rels, kids, progs, vets) {
    if (vets && vets.length) {
      const { error } = await db.from('person_veteran_statuses')
        .upsert(vets.map((status) => ({ person_id: personId, status })), { onConflict: 'person_id,status', ignoreDuplicates: true });
      if (error) throw error;
    }
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
