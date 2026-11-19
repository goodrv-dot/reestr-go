//@ Частина кабінету «🔎 Усі — пошук по всіх модулях» (200 / 300 / БЗВ / Полон / Ветерани, включно із завершеними).
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Пошук по всіх модулях ----------
  // Сервер (search_all_cases) повертає лише справи, які співробітник має право відкрити. Клік — відкриває справу в її модулі.
  let allTimer = null, allSeq = 0;
  function initAllSearch() {
    const btn = $('cab-all-btn'), dlg = $('cab-all-dlg'), inp = $('cab-all-q'), out = $('cab-all-res');
    if (!btn || !dlg) return;
    btn.addEventListener('click', () => {
      const q = $('cab-search').value.trim();   // що вже набрано в пошуку модуля — переносимо
      if (q && !inp.value) inp.value = q;
      dlg.showModal(); inp.focus(); inp.select();
      if (inp.value.trim().length >= 2) runAll();
    });
    $('cab-all-close').addEventListener('click', () => dlg.close());
    inp.addEventListener('input', () => { clearTimeout(allTimer); allTimer = setTimeout(runAll, 350); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(allTimer); runAll(); } });
    async function runAll() {
      const q = inp.value.trim();
      if (q.length < 2) { out.innerHTML = '<p class="muted">Введіть щонайменше 2 символи: прізвище, ім’я, номер справи або телефон.</p>'; return; }
      const seq = ++allSeq;
      out.innerHTML = '<p class="muted">Шукаю…</p>';
      const { data, error } = await db.rpc('search_all_cases', { p_q: q });
      if (seq !== allSeq) return;   // уже набрали інше
      if (error) { console.error(error); out.innerHTML = '<p class="muted">Не вдалося виконати пошук.</p>'; return; }
      if (!data || !data.length) { out.innerHTML = '<p class="muted">Нічого не знайдено в жодному модулі (серед справ, до яких у вас є доступ).</p>'; return; }
      const by = {};
      data.forEach((r) => { (by[r.module] = by[r.module] || []).push(r); });
      out.innerHTML = '';
      const sum = document.createElement('p'); sum.className = 'muted';
      sum.textContent = `Знайдено: ${data.length}${data.length >= 200 ? ' (показано перші 200 — уточніть запит)' : ''} — ` +
        MODS.filter((m) => by[m]).map((m) => `${MOD_UI[m].short}: ${by[m].length}`).join(', ');
      out.appendChild(sum);
      MODS.filter((m) => by[m]).forEach((m) => {
        const h = document.createElement('h3'); h.className = `cab-all-mod cab-mod-${m}`; h.textContent = MOD_UI[m].title; out.appendChild(h);
        const ul = document.createElement('ul'); ul.className = 'cab-all-list';
        by[m].forEach((r) => {
          const li = document.createElement('li');
          const a = document.createElement('a'); a.href = caseHref(r.journal_id);
          a.innerHTML = `<b>${esc(r.journal_id)}</b> ${esc(r.fio)}`;
          a.addEventListener('click', (e) => { e.preventDefault(); dlg.close(); openByJournal(r.journal_id); });
          li.appendChild(a);
          const meta = [r.status, r.executor ? 'вик.: ' + r.executor : '', r.hit ? 'знайдено за: ' + r.hit : ''].filter(Boolean).join(' · ');
          if (meta) { const s = document.createElement('span'); s.className = 'muted'; s.textContent = ' — ' + meta; li.appendChild(s); }
          ul.appendChild(li);
        });
        out.appendChild(ul);
      });
    }
  }
