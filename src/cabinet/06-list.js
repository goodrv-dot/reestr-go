//@ Частина кабінету «Список справ: пошук, фільтри, лічильники, таблиця».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Список ----------
  // Пошук. Одне слово — як раніше: частина ПІБ, ID справи чи телефону.
  // Кілька слів («Богдан Олександр Олександрович») — усі слова мають належати ОДНІЙ людині
  // (військовому або одному з рідних), кожне — окремій частині ПІБ, з її початку
  // («Олександр» не «з’їдає» по батькові «Олександрович», якщо його вже вписано окремо).
  // Якщо є точний збіг усіх слів — показуємо лише точні.
  const norm = (t) => String(t || '').toLowerCase().replace(/[’'ʼ`]/g, '').replace(/\s+/g, ' ');
  const tokens = (p) => norm(fio(p)).split(/[\s-]+/).filter(Boolean);
  // чи можна розкласти слова по різних частинах ПІБ (перебір; слів і частин — до 4–5)
  function fits(words, toks, exact, used = []) {
    if (!words.length) return true;
    const [w, ...rest] = words;
    return toks.some((t, i) => !used.includes(i) && (exact ? t === w : t.startsWith(w)) && fits(rest, toks, exact, [...used, i]));
  }
  function matchCase(c, words, exact) {
    const names = [], other = [];
    words.forEach((w) => (/\d/.test(w) ? other : names).push(w));
    const phones = [c.person.phone, ...c.kin.map((k) => k.person.phone)].filter(Boolean).join(' ');
    const jid = norm(c.journal_id);
    if (!other.every((w) => { const d = w.replace(/\D/g, ''); return jid.includes(w) || (d.length >= 3 && d.length === w.replace(/[\s()+-]/g, '').length && phones.includes(d)); })) return false;
    if (!names.length) return true;
    return [c.person, ...c.kin.map((k) => k.person)].some((p) => p && fits(names, tokens(p), exact));
  }
  let exactMemo = { q: null, n: -1, v: false };
  function matchSearch(c, q) {
    const words = norm(q).split(' ').filter(Boolean);
    if (words.length === 1 && !/\d/.test(words[0])) {   // одне слово — частина будь-якого ПІБ
      const w = words[0];
      return norm(c.journal_id).includes(w) || [c.person, ...c.kin.map((k) => k.person)].some((p) => p && norm(fio(p)).includes(w));
    }
    if (words.length === 1) return matchCase(c, words, false);
    if (exactMemo.q !== q || exactMemo.n !== cases.length) exactMemo = { q, n: cases.length, v: cases.some((x) => matchCase(x, words, true)) };
    return matchCase(c, words, exactMemo.v);
  }

  // Довантажити лише потрібні завершені справи: знайдені пошуком (пошук робить база) або з моїми мітками
  let closedTimer = null;
  function wantClosed(q, withMarks) {
    clearTimeout(closedTimer);
    closedTimer = setTimeout(async () => {
      const seq = fullSeq, ids = new Set();
      const nq = norm(q);
      const qk = module + '|q|' + nq;
      if (nq && (/\d/.test(nq) || nq.replace(/\s/g, '').length >= 2) && !extraDone.has(qk)) {
        extraDone.add(qk);
        const { data, error } = await db.rpc('search_closed_cases', { p_module: module, p_q: q });
        if (error) { console.error(error); extraDone.delete(qk); }
        (data || []).forEach((r) => ids.add(typeof r === 'string' ? r : Object.values(r)[0]));
      }
      const mk = module + '|marks|' + marks.size;
      if (withMarks && !extraDone.has(mk)) { extraDone.add(mk); marks.forEach((_, id) => ids.add(id)); }
      if (seq !== fullSeq) return;
      const have = new Set(cases.map((c) => c.id));
      const need = [...ids].filter((id) => !have.has(id));
      if (need.length) await addCases(need);
    }, 300);
  }
  async function addCases(ids) {
    const seq = fullSeq, got = [];
    for (let i = 0; i < ids.length; i += 150) {
      const { data, error } = await db.from('cases').select(CASE_SEL).eq('module', module).in('id', ids.slice(i, i + 150));
      if (error) { console.error(error); return; }
      got.push(...(data || []));
    }
    if (seq !== fullSeq || !got.length) return;
    const kin = await fetchKin([...new Set(got.map((c) => c.person_id))]);
    if (seq !== fullSeq) return;
    const have = new Set(cases.map((c) => c.id));
    got.forEach((c) => { if (!have.has(c.id)) { prep(c, kin); cases.push(c); } });
    if ($('cab-case').hidden) render();
  }

  function filtered() {
    const q = $('cab-search').value.trim().toLowerCase();
    const st = $('cab-status').value, ex = $('cab-exec').value, rs = $('cab-resp').value, ce = $('cab-cell').value, rg = $('cab-region').value, un = $('cab-unit').value;
    const mkf = new Set($('cab-mark').value.split(',').filter(Boolean));
    const from = $('cab-from').value, to = $('cab-to').value;
    const stSel = $('cab-status').value;
    // вибрано колір мітки — показуємо справи з цією міткою з усіма статусами (і завершені теж)
    const markColors = [...mkf].some((x) => x !== 'none');
    const showClosed = !!preset || quick === 'closed' || !!q || markColors || statuses.some((s) => s.name === stSel && s.closed);
    if (showClosed && !withClosed && closedTotal) {
      // «Завершені» або завершений статус — потрібні всі; пошук і мітки — лише знайдені / позначені (сервер шукає сам)
      if (quick === 'closed' || statuses.some((s) => s.name === stSel && s.closed)) { withClosed = true; $('cab-status-line').textContent = 'Довантажуємо закриті справи…'; load(); }
      else wantClosed($('cab-search').value.trim(), markColors);
    }
    return cases.filter((c) => {
      if (preset && !preset.ids.has(c.id)) return false;
      if (!showClosed && isClosed(c)) return false;
      if (quick === 'closed' && !isClosed(c)) return false;
      if (from || to) { const d = dateOf(c); if (!d || (from && d < from) || (to && d > to)) return false; }
      if (q && !matchSearch(c, q)) return false;
      if (st && c.status !== st) return false;
      if (ex === 'none' ? c.executor_id : ex && c.executor_id !== ex) return false;
      if (rs === 'none' ? c.responsible_id : rs && c.responsible_id !== rs) return false;
      if (mkf.size) {
        const m = marks.get(c.id) || []; const hit = m.some((x) => mkf.has(String(x)));
        if (!((mkf.has('none') && !m.length) || hit)) return false;
        // завершені справи — лише якщо на них є обрана мітка (а не «без міток»), щоб не висипати тисячі закритих
        if (markColors && isClosed(c) && !hit && !q && !preset && quick !== 'closed' && !statuses.some((s) => s.name === stSel && s.closed)) return false;
      }
      if (ce === 'none' ? c.cell_id : ce && String(c.cell_id) !== ce) return false;
      { const r = c.person && c.person.region_id; if (rg === 'none' ? r : rg && String(r) !== rg) return false; }
      { const u = c.person && c.person.mp_unit_id; if (un === 'none' ? u : un && String(u) !== un) return false; }
      if (quick === 'mine' && c.executor_id !== me) return false;
      if (quick === 'overdue' && !(c.next && c.next.overdue)) return false;
      if (quick === 'problem' && !hasProblem(c)) return false;
      if (quick === 'acute' && probState(c) !== 'Гостра') return false;
      if (quick === 'minor' && probState(c) !== 'Незначна') return false;
      if (quick === 'fresh' && !isNew(c)) return false;
      if (quick === 'nocell' && c.cell_id) return false;
      return true;
    });
  }

  // Порядок списку. «Додавання»: час створення справи; для справ з одного імпорту (час однаковий) —
  // дата сповіщення (200) / звернення (300), далі номер справи.
  function sorted(list) {
    const mode = $('cab-sort').value || 'new';
    const reg = (c) => (ui().reg && c.vals[ui().reg]) || '';
    const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    const num = (c) => Number(String(c.journal_id || '').split('-').pop()) || 0;
    // 200: суворо за номером справи (номери = порядок рядків старого журналу, нові справи — наступні номери)
    const added = module === '200' ? (a, b) => num(a) - num(b)
      : (a, b) => cmp((a.created_at || '').slice(0, 16), (b.created_at || '').slice(0, 16)) || cmp(reg(a), reg(b)) || cmp(a.journal_id, b.journal_id);
    const byDate = (a, b) => { const x = dateOf(a) || '', y = dateOf(b) || ''; return (!x) - (!y) || cmp(y, x); };
    const f = mode === 'old' ? added : mode === 'abc' ? (a, b) => fio(a.person).localeCompare(fio(b.person), 'uk') : mode === 'date' ? byDate : (a, b) => added(b, a);
    const pin = $('cab-pin').checked;
    const ov = (c) => (c.next && c.next.overdue ? 0 : 1);
    return [...list].sort((a, b) => (pin ? ov(a) - ov(b) || (ov(a) === 0 ? a.next.days - b.next.days : 0) : 0) || f(a, b));
  }

  // Скільки не заповнено у справі: важливе (червоне) і решта (жовте) — та сама логіка, що в підказках справи
  function gaps(c) {
    let crit = 0, soft = 0; const p = c.person, k = contactOf(c);
    if (!c.status) crit++; if (!c.executor_id) crit++; if (!c.cell_id) crit++;
    if (!k || !k.person.phone) crit++;
    Object.values(PERSON_FIELDS[module] || {}).flat().forEach(([key]) => {
      if (p[key] === null || p[key] === undefined || p[key] === '') (CRIT.has('p-' + key) ? crit++ : soft++);
    });
    defs.forEach((d) => {
      if ((d.section || 'other') === 'head' || c.vals[d.key]) return;
      const base = d.remind_after && c.vals[d.remind_after];
      const overdue = !isClosed(c) && base && /^\d{4}-\d{2}-\d{2}/.test(base) && addDays(base.slice(0, 10), d.remind_days || 0) < today();
      (overdue || CRIT.has('s-' + d.key) ? crit++ : soft++);
    });
    return { crit, soft };
  }
  const PAGE = 100; let page = 1, lastSig = '';

  // Справи без дати, які пройшли б решту фільтрів (тобто «загубилися» саме через період)
  function noDateCount() {
    const f = $('cab-from').value, t = $('cab-to').value; $('cab-from').value = ''; $('cab-to').value = '';
    const n = filtered().filter((c) => !dateOf(c)).length;
    $('cab-from').value = f; $('cab-to').value = t; return n;
  }

  function render() {
    { const r = $('cab-reset'); if (r) r.hidden = !(quick || preset || FILTER_IDS.some((id) => $(id) && $(id).value)); }
    syncMarkFilter();
    const list = sorted(filtered());
    lastList = list;
    const sig = [module, quick, ...['cab-search', 'cab-status', 'cab-exec', 'cab-resp', 'cab-mark', 'cab-cell', 'cab-region', 'cab-unit', 'cab-from', 'cab-to', 'cab-sort'].map((id) => $(id).value), $('cab-pin').checked, preset ? preset.label : ''].join('|');
    if (sig !== lastSig) { page = 1; lastSig = sig; }
    const pages = Math.max(1, Math.ceil(list.length / PAGE)); if (page > pages) page = pages;
    // лічильники швидких фільтрів — з урахуванням усіх інших фільтрів (виконавець, статус, осередок, пошук…)
    const base = (() => { const q0 = quick; quick = ''; try { return filtered().filter((c) => !isClosed(c)); } finally { quick = q0; } })();
    const cnt = (f) => base.filter(f).length;
    // «Завершені»: коли закриті вже завантажені — теж з урахуванням інших фільтрів; до того — загальне число з бази
    const closedN = withClosed ? (() => { const q0 = quick; quick = 'closed'; try { return filtered().length; } finally { quick = q0; } })() : closedTotal;
    $('cq-closed').textContent = closedN; $('cq-closed-btn').hidden = !closedN && quick !== 'closed';
    $('cq-mine').textContent = cnt((c) => c.executor_id === me);
    $('cq-overdue').textContent = cnt((c) => c.next && c.next.overdue);
    $('cq-problem').textContent = cnt(hasProblem);
    { const n = cnt((c) => probState(c) === 'Гостра'); $('cq-acute').textContent = n; $('cq-acute-btn').hidden = !n && quick !== 'acute'; }
    { const n = cnt((c) => probState(c) === 'Незначна'); $('cq-minor').textContent = n; $('cq-minor-btn').hidden = !n && quick !== 'minor'; }
    $('cq-fresh').textContent = cnt(isNew);
    $('cq-fresh-btn').hidden = !cnt(isNew) && quick !== 'fresh';
    $('cq-nocell').textContent = cnt((c) => !c.cell_id);
    document.querySelectorAll('.cab-quick').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.q === quick)));
    $('cab-preset').hidden = !preset; if (preset) $('cab-preset-label').textContent = preset.label;
    const hasDate = !!($('cab-from').value || $('cab-to').value);
    $('cab-date-clear').hidden = !hasDate;
    $('cab-count').textContent = `${list.length} з ${cases.length}` + (closedN && !list.some(isClosed) ? ` · завершених приховано: ${closedN}` : '') + (hasDate ? ` · без дати: ${noDateCount()} (у період не потрапляють)` : '');
    const { cells } = Persons.ctx();
    const color = new Map(statuses.map((s) => [s.name, s.color]));
    const totalStages = defs.filter((d) => (d.section || 'other') !== 'head').length;
    const tb = $('cab-table').tBodies[0];
    tb.innerHTML = '';
    if (!list.length && cases.length) {
      // усе сховали фільтри — кажемо прямо й даємо одну кнопку
      const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 20; td.className = 'cab-empty';
      td.textContent = `Фільтри приховують усі справи (${cases.length}). `;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-link'; b.textContent = 'Скинути фільтри';
      b.onclick = () => clearFilters(); td.appendChild(b); tr.appendChild(td); tb.appendChild(tr);
    }
    list.slice((page - 1) * PAGE, page * PAGE).forEach((c) => {
      const tr = document.createElement('tr');
      const rec = contactOf(c);
      const filled = defs.filter((d) => (d.section || 'other') !== 'head' && c.vals[d.key]).length;
      const pct = totalStages ? Math.round((filled / totalStages) * 100) : 0;
      tr.innerHTML = `
        <td class="cab-id"></td>
        <td class="cell-name"></td>
        <td class="cab-family"></td>
        <td class="cab-note"><span></span></td>
        <td></td>
        <td><span class="cab-status"></span></td>
        <td class="cab-exec"></td>
        <td class="cab-next"></td>
        <td><span class="cab-progress"><i style="width:${pct}%"></i></span> <span class="muted">${filled}/${totalStages}</span></td>`;
      tr.children[0].textContent = c.journal_id;
      { const g = gaps(c); const q = document.createElement('span'); q.className = 'cab-q';
        if (!g.crit && !g.soft) q.innerHTML = '<span class="q-ok" title="Усе заповнено">✓</span>';
        else q.innerHTML = (g.crit ? `<span class="q-pill q-pill-crit" title="Потрібно заповнити: ${g.crit}">${g.crit}</span>` : '') + (g.soft ? `<span class="q-pill q-pill-warn" title="Бажано заповнити: ${g.soft}">${g.soft}</span>` : '');
        tr.children[0].append(document.createElement('br'), q); }
      tr.children[1].textContent = fio(c.person);
      { const p = c.person; const lines = [];
        // 200: народження й загибель — одним рядком, поховання — окремим
        if (module === '200') { const b = [p.birth_date && 'н. ' + fmt(p.birth_date), p.death_date && 'заг. ' + fmt(p.death_date)].filter(Boolean).join(' · '); if (b) lines.push(b); }
        const d = dateOf(c); if (d && module !== 'vet') lines.push(ui().dateWord + ' ' + fmt(d));
        lines.forEach((t) => { const m = document.createElement('span'); m.className = 'muted cab-date'; m.textContent = t; tr.children[1].append(document.createElement('br'), m); }); }
      tr.children[1].append(document.createElement('br'), markDots(c));
      if (isNew(c)) { const b = document.createElement('span'); b.className = 'cab-new-mark'; b.textContent = 'нова'; b.title = 'Справу передано у ваш осередок'; tr.children[1].append(' ', b); }
      tr.children[2].innerHTML = rec ? '<span></span><br><span class="muted"></span>' : '<span class="muted">родину не встановлено</span>';
      if (rec) {
        tr.children[2].firstChild.textContent = `${rec.relation_degree}: ${fio(rec.person)}` + (c.kin.length > 1 ? ` (+${c.kin.length - 1})` : '');
        tr.children[2].lastChild.textContent = V.formatPhone(rec.person.phone) || 'без телефону';
      }
      { const n = String(c.person.comment || '').trim(); const el = tr.children[3].firstChild;
        el.textContent = n; if (n) tr.children[3].title = n; else tr.children[3].innerHTML = '<span class="muted">—</span>'; }
      tr.children[4].textContent = cells.get(c.cell_id) || '—';
      { const rn = c.person && Persons.ctx().regions.get(c.person.region_id);
        if (rn && rn !== cells.get(c.cell_id)) { const m = document.createElement('span'); m.className = 'muted cab-date'; m.textContent = 'рег.: ' + rn; tr.children[4].append(document.createElement('br'), m); } }
      const sp = tr.children[5].firstChild;
      sp.textContent = c.status || '—';
      const col = statusColor(c.status, color.get(c.status));
      sp.style.setProperty('--st', col); sp.style.color = inkFor(col);
      { const ps = probState(c);
        if (ps) {
          const acute = ps === 'Гостра'; if (acute) tr.classList.add('cab-acute');
          const pb = document.createElement('span'); pb.className = 'cab-prob ' + (acute ? 'is-acute' : 'is-minor');
          pb.textContent = acute ? '⚠ Гостра проблема' : 'Незначна проблема';
          const txt = String(c.vals.problems || '').trim(); if (txt) pb.title = txt;
          tr.children[5].append(document.createElement('br'), pb);
          if (acute) { const d = document.createElement('span'); d.className = 'cab-prob-dot'; d.title = 'Гостра проблема' + (txt ? ': ' + txt : ''); tr.children[1].prepend(d); }
        } }
      tr.children[6].textContent = staff.get(c.executor_id) || (c.vals.executor_legacy ? `(${c.vals.executor_legacy})` : '—');
      { const r = staff.get(c.responsible_id) || (c.vals.responsible ? `(${c.vals.responsible})` : '');
        if (r) { const m = document.createElement('span'); m.className = 'muted cab-resp-line'; m.textContent = 'відп.: ' + r; tr.children[6].append(document.createElement('br'), m); } }
      if (c.next) {
        tr.children[7].innerHTML = '<span></span><br><span class="due-tag"></span>';
        tr.children[7].firstChild.textContent = c.next.label;
        tr.children[7].lastChild.textContent = dueText(c.next); tr.children[7].lastChild.classList.add('due-' + c.next.level);
        tr.classList.add('row-' + c.next.level);
      } else tr.children[7].textContent = '—';
      if (bulkMode) {
        const td = document.createElement('td'); td.className = 'cab-sel';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = picked.has(c.id);
        cb.setAttribute('aria-label', 'Вибрати справу ' + c.journal_id);
        td.addEventListener('click', (e) => e.stopPropagation());
        cb.addEventListener('change', () => { cb.checked ? picked.add(c.id) : picked.delete(c.id); renderBulkBar(); });
        td.appendChild(cb); tr.prepend(td);
        if (picked.has(c.id)) tr.classList.add('is-picked');
      }
      tr.addEventListener('click', () => openCase(c.id));
      tb.appendChild(tr);
    });
    renderBulkBar();
    // сторінки по 100
    const pg = $('cab-pager'); pg.hidden = pages <= 1; pg.innerHTML = '';
    if (pages > 1) {
      const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
      let html = `<button type="button" class="pg-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Попередня сторінка">‹</button>`, prev = 0;
      nums.forEach((n) => { if (n - prev > 1) html += '<span class="pg-gap">…</span>'; html += `<button type="button" class="pg-btn${n === page ? ' is-current' : ''}" data-page="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`; prev = n; });
      html += `<button type="button" class="pg-btn" data-page="${page + 1}" ${page === pages ? 'disabled' : ''} aria-label="Наступна сторінка">›</button>`;
      html += `<span class="pg-info">${(page - 1) * PAGE + 1}–${Math.min(list.length, page * PAGE)} з ${list.length}</span>`;
      pg.innerHTML = html;
    }
    $('cab-empty').hidden = list.length > 0;
    renderToday();
  }

