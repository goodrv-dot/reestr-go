// ============================================================
// «Швидкий доступ» (скріпка вгорі праворуч): готові посилання на робочі сервіси,
// посилання від адміністратора (для всіх) і власні посилання співробітника.
// Дані з бази тягнуться лише при відкритті панелі.
// ============================================================
window.QuickLinks = (() => {
  const $ = (id) => document.getElementById(id);
  let db = null, me = null, isAdmin = false, wired = false, links = [];
  const BASE = [
    ['Комунікація', [['✉️', 'Gmail', 'https://mail.google.com/'], ['📅', 'Google Calendar', 'https://calendar.google.com/'],
      ['💬', 'WhatsApp', 'https://web.whatsapp.com/'], ['📹', 'Google Meet', 'https://meet.google.com/']]],
    ['Робота з матеріалами', [['🎓', 'Google Classroom', 'https://classroom.google.com/'], ['📝', 'Google Keep', 'https://keep.google.com/'],
      ['📁', 'Google Drive', 'https://drive.google.com/'], ['📊', 'Google Таблиці', 'https://docs.google.com/spreadsheets/']]],
    ['Інше', [['🎙️', 'Fathom', 'https://fathom.video/'], ['✨', 'Gemini', 'https://gemini.google.com/']]]
  ];
  // «📁 Назва» → ['📁', 'Назва']; без емодзі — 🔗
  const split = (t) => { const m = String(t).match(/^(\p{Extended_Pictographic}️?)\s*(.+)$/u); return m ? [m[1], m[2]] : ['🔗', String(t)]; };
  const safe = (u) => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };

  function init(client, userId, admin) {
    db = client; me = userId; isAdmin = !!admin;
    const btn = $('ql-btn'); if (!btn) return;
    btn.hidden = false;
    if (wired) return; wired = true;
    btn.addEventListener('click', (e) => { e.stopPropagation(); const p = $('ql-panel'); p.hidden = !p.hidden; if (!p.hidden) open(); });
    document.addEventListener('click', (e) => { if (!e.target.closest('#ql-panel') && !e.target.closest('#ql-btn')) $('ql-panel').hidden = true; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('ql-panel').hidden = true; });
  }
  function stop() { const b = $('ql-btn'); if (b) b.hidden = true; const p = $('ql-panel'); if (p) p.hidden = true; links = []; }

  async function open() {
    render();
    const { data, error } = await db.from('quick_links').select('id, user_id, title, url, shared').order('shared', { ascending: false }).order('sort').order('id');
    if (error) { console.error(error); return; }
    links = data || []; render();
  }

  function item(icon, title, url, del) {
    const row = document.createElement('div'); row.className = 'ql-row';
    const a = document.createElement('a'); a.className = 'ql-link'; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    const i = document.createElement('span'); i.className = 'ql-ico'; i.textContent = icon; a.append(i, document.createTextNode(title));
    row.append(a);
    if (del) { const x = document.createElement('button'); x.type = 'button'; x.className = 'ql-del'; x.textContent = '✕'; x.title = 'Прибрати посилання'; x.onclick = del; row.append(x); }
    return row;
  }
  function group(p, name, rows) {
    if (!rows.length) return;
    const h = document.createElement('h3'); h.className = 'ql-h'; h.textContent = name; p.append(h);
    rows.forEach((r) => p.append(r));
  }

  function render() {
    const p = $('ql-panel'); p.innerHTML = '<h2>Швидкий доступ</h2>';
    BASE.forEach(([g, list]) => group(p, g, list.map(([ic, t, u]) => item(ic, t, u))));
    const mk = (l) => { const u = safe(l.url); if (!u) return null; const [ic, t] = split(l.title);
      const canDel = l.user_id === me || (l.shared && isAdmin);
      return item(ic, t, u, canDel ? async () => {
        if (!confirm(`Прибрати посилання «${t}»?`)) return;
        const { error } = await db.from('quick_links').delete().eq('id', l.id);
        if (error) { console.error(error); Persons.toast('Не вдалося прибрати посилання'); return; }
        links = links.filter((x) => x.id !== l.id); render();
      } : null); };
    group(p, 'Від адміністратора', links.filter((l) => l.shared).map(mk).filter(Boolean));
    group(p, 'Мої посилання', links.filter((l) => !l.shared && l.user_id === me).map(mk).filter(Boolean));

    const f = document.createElement('form'); f.className = 'ql-form'; f.noValidate = true;
    f.innerHTML = `<input name="t" maxlength="80" placeholder="Назва (можна з емодзі на початку: 📁 Документи)" aria-label="Назва посилання">
      <input name="u" type="url" maxlength="1000" placeholder="https://…" aria-label="Адреса посилання">
      ${isAdmin ? '<label class="ql-shared"><input name="s" type="checkbox"> для всіх співробітників</label>' : ''}
      <button class="btn-primary btn-small" type="submit">+ Моє посилання</button>`;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const title = f.t.value.replace(/\s+/g, ' ').trim(); const url = safe(f.u.value.trim());
      if (!title) { Persons.toast('Вкажіть назву'); f.t.focus(); return; }
      if (!url) { Persons.toast('Вставте повне посилання, що починається з https://'); f.u.focus(); return; }
      const shared = !!(f.s && f.s.checked);
      const btn = f.querySelector('button'); btn.disabled = true;
      const { data, error } = await db.from('quick_links').insert({ title, url, shared, sort: links.length }).select('id, user_id, title, url, shared').single();
      btn.disabled = false;
      if (error) { console.error(error); Persons.toast('Не вдалося додати посилання'); return; }
      links.push(data); render(); Persons.toast(shared ? 'Посилання додано для всіх' : 'Посилання додано');
    };
    p.append(document.createElement('hr'), f);
  }
  return { init, stop };
})();
