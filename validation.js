// ============================================================
// Єдині правила перевірки даних (ТЗ, розділ 7).
// Використовуються всюди: ручне введення, імпорт, анкета, експорт.
// Кожна функція повертає { value } або { error }, інколи з { warning } / { fixed }.
// ============================================================
window.V = (() => {
  // Коди мобільних операторів України (після +380)
  const MOBILE_CODES = ['39','50','63','66','67','68','73','75','77','89','91','92','93','94','95','96','97','98','99'];

  // Коди країн для номерів, записаних без «+» (найчастіші для родин за кордоном)
  const COUNTRIES = {
    '31': 'Нідерланди', '32': 'Бельгія', '33': 'Франція', '34': 'Іспанія', '36': 'Угорщина', '39': 'Італія',
    '40': 'Румунія', '41': 'Швейцарія', '43': 'Австрія', '44': 'Велика Британія', '45': 'Данія', '46': 'Швеція',
    '47': 'Норвегія', '48': 'Польща', '49': 'Німеччина', '30': 'Греція', '351': 'Португалія', '353': 'Ірландія',
    '358': 'Фінляндія', '359': 'Болгарія', '370': 'Литва', '371': 'Латвія', '372': 'Естонія', '373': 'Молдова',
    '385': 'Хорватія', '420': 'Чехія', '421': 'Словаччина', '90': 'Туреччина', '972': 'Ізраїль', '995': 'Грузія',
    '1': 'США / Канада'
  };
  function countryOf(d) {
    for (const len of [3, 2, 1]) { const c = COUNTRIES[d.slice(0, len)]; if (c) return c; }
    return null;
  }

  function normalizePhone(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return { value: null };
    let d = s.replace(/\D/g, '');
    let v = null, foreign = null;
    if (d.startsWith('00') && d.length >= 11) d = d.slice(2);             // 0031… → 31…
    const plus = s.startsWith('+') || s.startsWith('00');
    if (plus && !d.startsWith('380')) { v = (d.length >= 8 && d.length <= 15) ? '+' + d : null; foreign = countryOf(d) || 'інша країна'; }
    else if (d.length === 12 && d.startsWith('380')) v = '+' + d;
    else if (d.length === 11 && d.startsWith('80'))  v = '+3' + d;
    else if (d.length === 10 && d.startsWith('0'))   v = '+38' + d;
    else if (d.length === 9 && d[0] !== '0')         v = '+380' + d;
    else if (d.length >= 10 && d.length <= 13 && countryOf(d)) { v = '+' + d; foreign = countryOf(d); }  // іноземний без «+»
    if (!v) return { error: 'Невірний номер. Приклад: 050 123 45 67' };
    const res = { value: v };
    if (foreign) { res.foreign = foreign; res.warning = `Іноземний номер (${foreign}) — перевірте`; return res; }
    if (v.startsWith('+380') && !MOBILE_CODES.includes(v.slice(4, 6))) {
      res.warning = 'Схоже на стаціонарний номер: у розсилку не потрапить';
    }
    return res;
  }

  // Повний номер у межах одного «шматка» без пробілів
  const complete = (a) =>
    (a[0] === '0' && a[1] !== '0' && a.length === 10) || (a.startsWith('380') && a.length === 12) ||
    (a.startsWith('80') && a.length === 11);

  // Витягти всі телефони з тексту: «0503412973 0956061889», «Іванова Марія 050 123 45 67», «тел: +31 6 1348 0140»
  // Повертає { phones: [{value, warning}], rest: текст без телефонів, bad: [нерозібрані шматки] }
  function extractPhones(text) {
    const src = String(text ?? '');
    const phones = [], bad = [];
    const re = /\+?\d[\d\s().\-]{6,}\d/g;
    const rest = src.replace(re, (run) => {
      if (run.trim().startsWith('+')) {
        const r = normalizePhone(run);
        if (r.value) phones.push(r); else bad.push(run.trim());
        return ' ';
      }
      let acc = '', accRaw = [];
      const flush = () => { if (acc) bad.push(accRaw.join(' ')); acc = ''; accRaw = []; };
      run.trim().split(/[\s().\-]+/).filter(Boolean).forEach((part) => {
        const d = part.replace(/\D/g, '');
        if (!acc) {
          const r = normalizePhone(d);
          if (r.value && (complete(d) || (d.length === 9 && d[0] !== '0') || r.foreign)) { phones.push(r); return; }
        }
        acc += d; accRaw.push(part);
        if (complete(acc)) { phones.push(normalizePhone(acc)); acc = ''; accRaw = []; }
        else if (acc.length > 13) flush();
      });
      if (acc) {
        const r = normalizePhone(acc);
        if (r.value) phones.push(r); else flush();
      }
      return ' ';
    });
    const uniq = [];
    phones.forEach((p) => { if (!uniq.some((u) => u.value === p.value)) uniq.push(p); });
    return {
      phones: uniq,
      bad,
      rest: rest
        .replace(/(^|\s)(тел|моб|телефон|номер|т)\.?\s*:?(?=\s|$)/gi, ' ')
        .replace(/[\/()]+/g, ' ')
        .replace(/\s+/g, ' ').replace(/^[\s,;:–—\-]+|[\s,;:–—\-]+$/g, '').trim()
    };
  }

  // +380501234567 → +380 50 123 45 67 (лише для показу)
  function formatPhone(v) {
    if (!v) return '';
    const m = v.match(/^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/);
    return m ? `+380 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : v;
  }

  function normalizeName(raw, required) {
    let s = String(raw ?? '').trim().replace(/\s+/g, ' ').replace(/[ʼ'`]/g, '’')
      .replace(/([A-Za-zА-ЯІЇЄҐ])\.(?=[A-Za-zА-ЯІЇЄҐ])/g, '$1. ');          // «Т.П.» → «Т. П.»
    if (!s) return required ? { error: 'Обов’язкове поле' } : { value: null };
    if (!/^[A-Za-zА-Яа-яІіЇїЄєҐґЁё’.\- ]+$/.test(s)) return { error: 'Лише літери, апостроф, дефіс і крапка (ініціали)' };
    s = s.replace(/(^|[ \-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
    return { value: s };
  }

  function normalizeEmail(raw) {
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s) return { value: null };
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? { value: s } : { error: 'Невірний формат пошти' };
  }

  function checkBirthDate(v) {
    if (!v) return { value: null };
    const d = new Date(v + 'T00:00:00');
    if (isNaN(d)) return { error: 'Невірна дата' };
    const now = new Date();
    if (d > now) return { error: 'Дата в майбутньому' };
    if ((now - d) / 31557600000 > 110) return { error: 'Перевірте рік народження' };
    return { value: v };
  }

  return { normalizePhone, extractPhones, formatPhone, normalizeName, normalizeEmail, checkBirthDate };
})();
