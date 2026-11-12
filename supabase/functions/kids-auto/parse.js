// @ts-nocheck
// КОПІЯ розбору анкети «Діти МП» з import.js (кабінет «Імпорт») — щоб робот розбирав анкети так само, як ручний імпорт.
// Якщо змінюєте розбір у import.js (parseKids / parseKidsV2 / makeChild / mergeByPhone) — перенесіть зміни сюди.
import './shim.js';
import './validation.js';   // копія ../../validation.js на момент збірки
import './options.js';         // копія ../../options.js на момент збірки
const V = globalThis.V, OPT = globalThis.OPT;
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
      // серійний номер дати Google Таблиць / Excel (дні від 30.12.1899), дробова частина — час
      const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
      return realIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
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
  const OTHER_DEG = 'Інший член сім’ї / родич';
  function matchDegree(raw) {
    const s = clean(raw).toLowerCase().replace(/['ʼ`]/g, '’');
    return OPT.relation_degree.find((d) => d.toLowerCase() === s) || detectDegree(s).degree || null;
  }
  // Ким представник доводиться дитині (анкета «Діти МП», питання 9) → значення довідника + стать представника
  const REP_WORDS = [
    [/^(мати|мама|матір)/i, 'Мати', 'Жіноча'], [/^(батько|тато|отець)/i, 'Батько', 'Чоловіча'],
    [/^(баба|бабуся|бабця)/i, 'Баба', 'Жіноча'], [/^(дід|дідусь)/i, 'Дід', 'Чоловіча'],
    [/^опікун/i, 'Опікун', null], [/^піклувальн/i, 'Піклувальник', null], [/^усинов/i, 'Усиновлювач', null]
  ];
  function matchRepRelation(raw) {
    const s = clean(raw); if (!s) return { rel: null, sex: null };
    const hit = REP_WORDS.find(([re]) => re.test(s));
    return hit ? { rel: hit[1], sex: hit[2] } : { rel: 'Інший родич', sex: null, unknown: s };
  }

  // ---------- Розбір комірок з людьми (журнал «200») ----------
  // Як пишуть ступінь спорідненості → значення довідника
  const DEGREE_WORDS = [
    [/^(мати|мама|матір|матері|матуся)$/i, 'Мати'], [/^(батько|тато|отець|татко|батька)$/i, 'Батько'],
    [/^(дружина|жінка|вдова|цивільна|дружини)$/i, 'Дружина'], [/^(чоловік|цивільний|вдівець)$/i, 'Чоловік'], [/^(син|сина|синок)$/i, 'Син'],
    [/^(донька|дочка|доч|доня|доньки|дочки)$/i, 'Донька'], [/^(брат|брата)$/i, 'Брат'], [/^(сестра|сестри)$/i, 'Сестра'],
    [/^(дід|дідусь)$/i, 'Дід'], [/^(баба|бабуся|бабця)$/i, 'Баба'], [/^(онук)$/i, 'Онук'], [/^(онука|онучка)$/i, 'Онука'],
    [/^(опікун|опікунка)$/i, 'Опікун'], [/^(піклувальник|піклувальниця)$/i, 'Піклувальник'], [/^(усиновлювач|усиновлювачка)$/i, 'Усиновлювач'],
    [/^(тітка|тьотя)$/i, 'Тітка'], [/^(дядько|дядя)$/i, 'Дядько'], [/^племінник$/i, 'Племінник'], [/^племінниця$/i, 'Племінниця'],
    [/^свекруха$/i, 'Свекруха'], [/^свекор$/i, 'Свекор'], [/^теща$/i, 'Теща'], [/^тесть$/i, 'Тесть'], [/^невістка$/i, 'Невістка'], [/^зять$/i, 'Зять'],
    [/^вітчим$/i, 'Вітчим'], [/^мачуха$/i, 'Мачуха'], [/^(хрещений|хресний)$/i, 'Хрещений батько'], [/^(хрещена|хресна)$/i, 'Хрещена мати'],
    [/^наречен(а|ая)$/i, 'Наречена'], [/^наречений$/i, 'Наречений'],
    [/^(кум|кума|родич|родичка)$/i, 'Інший член сім’ї / родич']
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
      // 9. Ким представник доводиться дитині → у дитину; заодно стать представника (мати/баба — жіноча, батько/дід — чоловіча)
      const rr = matchRepRelation(g('kinToChild'));
      if (rr.unknown) rec.warnings.push(`Споріднення з дитиною «${rr.unknown}» не зі списку — записано «Інший родич»`);
      if (rr.sex && (!p.sex || p.sex === 'Не вказано')) p.sex = rr.sex;
      rec._repRel = rr.rel;

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

      if (rec._repRel) rec.children.forEach((k) => { k.rep_relation = rec._repRel; });
      keepRest(p, hdr.map((h) => clean(h)), r, new Set(Object.values(c).filter((i) => i >= 0)));
      rec.programs.push(ctx.programByName('Діти Морської піхоти'));   // явно: порядок шаблонів у списку може змінюватись
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
    // усі колонки, які розбираються в поля картки; решта відповідей зберігається як є («Анкета — інші відповіді»), щоб нічого не загубилось
    const used = new Set([tsI, ...Object.values(I).flat(), ...kids.flatMap((k) => [...k.name, k.bd, k.sex])].filter((i) => i >= 0));
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
        const deg = matchDegree(tm);
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
      keepRest(p, hs, r, used);
      const sx = clean(at(r, I.repSex)).toLowerCase();
      if (/^чол/.test(sx)) p.sex = 'Чоловіча'; else if (/^жін/.test(sx)) p.sex = 'Жіноча';
      // діти 2–5
      const ts = toDate(at(r, tsI));
      kids.slice(1).forEach((k, n) => {
        const name = join(r, k.name), bd = at(r, k.bd);
        if (!name && !clean(bd) && !(bd instanceof Date)) return;
        if (!name) { rec.warnings.push(`Дитина ${n + 2}: є дата народження, але немає ПІБ — не додано`); return; }
        const kid = makeChild(name, bd, at(r, k.sex), at(r, I.interests), null, ts, rec);
        if (kid && rec._repRel) kid.rep_relation = rec._repRel;
        if (kid && !rec.children.some((c) => c.full_name === kid.full_name && c.birth_date === kid.birth_date)) rec.children.push(kid);
      });
      if (rec.children.length) p.has_children = 'Так';
    });
    return out;
  }

  // Відповіді анкети без окремого поля в картці → persons.journal['Анкета'] (видно в картці, «Дані з журналу»)
  function keepRest(p, hs, r, used) {
    const rest = {};
    hs.forEach((h, i) => {
      if (!h || used.has(i)) return;
      let v = r[i];
      if (v instanceof Date) v = toDate(v);
      v = clean(v);
      if (v) rest[h.slice(0, 120)] = v.slice(0, 2000);
    });
    if (Object.keys(rest).length) p.journal = { ...(p.journal || {}), 'Анкета': rest };
  }
  // «Хлопчик», «хлопець», «син» → Хлопець; «Дівчинка», «дівчина», «донька» → Дівчина
  function childSex(raw) {
    const s = clean(raw).toLowerCase();
    if (/^(хлоп|син|чол)/.test(s)) return 'Хлопець';
    if (/^(дівч|доньк|дочк|жін)/.test(s)) return 'Дівчина';
    return 'Не вказано';
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
      sex: childSex(sex),
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

  let curRow = null; const badDates = new Map();
  function newRecord(row) {
    curRow = row;
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

export { parseKidsV2, mergeByPhone, letters, clean, badDates, OTHER_DEG };
