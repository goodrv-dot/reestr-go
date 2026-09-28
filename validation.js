// ============================================================
// Єдині правила перевірки даних (ТЗ, розділ 7).
// Використовуються всюди: ручне введення, імпорт, анкета, експорт.
// Кожна функція повертає { value } або { error }, інколи з { warning } / { fixed }.
// ============================================================
window.V = (() => {
  // Коди мобільних операторів України (після +380)
  const MOBILE_CODES = ['39','50','63','66','67','68','73','75','77','89','91','92','93','94','95','96','97','98','99'];

  function normalizePhone(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return { value: null };
    const d = s.replace(/\D/g, '');
    let v = null;
    if (s.startsWith('+') && !d.startsWith('380')) v = (d.length >= 8 && d.length <= 15) ? '+' + d : null; // іноземний
    else if (d.length === 12 && d.startsWith('380')) v = '+' + d;
    else if (d.length === 11 && d.startsWith('80'))  v = '+3' + d;
    else if (d.length === 10 && d.startsWith('0'))   v = '+38' + d;
    else if (d.length === 9)                         v = '+380' + d;
    if (!v) return { error: 'Невірний номер. Приклад: 050 123 45 67' };
    const res = { value: v };
    if (v.startsWith('+380') && !MOBILE_CODES.includes(v.slice(4, 6))) {
      res.warning = 'Схоже на стаціонарний номер: у розсилку не потрапить';
    }
    return res;
  }

  // +380501234567 → +380 50 123 45 67 (лише для показу)
  function formatPhone(v) {
    if (!v) return '';
    const m = v.match(/^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/);
    return m ? `+380 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : v;
  }

  function normalizeName(raw, required) {
    let s = String(raw ?? '').trim().replace(/\s+/g, ' ').replace(/[ʼ'`]/g, '’');
    if (!s) return required ? { error: 'Обов’язкове поле' } : { value: null };
    if (!/^[A-Za-zА-Яа-яІіЇїЄєҐґЁё’\- ]+$/.test(s)) return { error: 'Лише літери, апостроф і дефіс' };
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

  return { normalizePhone, formatPhone, normalizeName, normalizeEmail, checkBirthDate };
})();
