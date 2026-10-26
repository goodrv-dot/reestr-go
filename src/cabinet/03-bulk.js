//@ Частина кабінету ««Кілька справ» — масові дії (адміністратор)».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Масові дії (адміністратор): кілька справ одразу ----------
  let bulkMode = false, lastList = [];
  const picked = new Set();
  function initBulk() {
    $('cab-bulk-btn').hidden = false;
    document.querySelector('#cab-bulk .bk-admin').hidden = !isAdmin;
    { const m = $('bk-mark'); m.innerHTML = '';
      const o = (v, t) => { const x = document.createElement('option'); x.value = v; x.textContent = t; m.append(x); };
      o('', 'Мітка: не змінювати');
      MARK_NAMES.forEach((n, i) => o('+' + (i + 1), '+ ' + n));
      MARK_NAMES.forEach((n, i) => o('-' + (i + 1), '− зняти ' + n.replace(/а$/, 'у').replace(/я$/, 'ю')));
      o('clear', '− зняти всі мої мітки'); }
    $('cab-bulk-btn').addEventListener('click', () => {
      bulkMode = !bulkMode; picked.clear(); bulkDisarm(); bkMsg('');
      $('cab-bulk-btn').setAttribute('aria-pressed', String(bulkMode));
      render();
    });
    $('cab-sel-page').addEventListener('change', (e) => {
      pageItems().forEach((c) => (e.target.checked ? picked.add(c.id) : picked.delete(c.id))); render();
    });
    $('cab-bulk-page').addEventListener('click', () => { pageItems().forEach((c) => picked.add(c.id)); render(); });
    $('cab-bulk-all').addEventListener('click', () => { lastList.forEach((c) => picked.add(c.id)); render(); });
    $('cab-bulk-none').addEventListener('click', () => { picked.clear(); render(); });
    $('bk-apply').addEventListener('click', applyBulk);
    $('bk-cancel').addEventListener('click', () => { bulkDisarm(); bkMsg(''); });
    ['bk-mark', 'bk-exec', 'bk-resp', 'bk-cell', 'bk-status'].forEach((id) => $(id).addEventListener('change', () => { bulkDisarm(); bkMsg(''); }));
    if (!isAdmin) return;
    $('cab-load-btn').hidden = false;
    $('cab-load-btn').addEventListener('click', openLoad);
    $('cab-load-close').addEventListener('click', () => $('cab-load').close());
  }
  const pageItems = () => lastList.slice((page - 1) * PAGE, page * PAGE);
  function renderBulkBar() {
    $('cab-bulk').hidden = !bulkMode;
    document.querySelector('#cab-table th.cab-sel').hidden = !bulkMode;
    if (!bulkMode) return;
    $('cab-bulk-n').textContent = picked.size;
    $('cab-bulk-total').textContent = lastList.length;
    const pi = pageItems();
    $('cab-sel-page').checked = pi.length > 0 && pi.every((c) => picked.has(c.id));
    if (bulkArmed && !bulkArmed.endsWith('|' + [...picked].sort().join(','))) { bulkDisarm(); bkMsg(''); }
  }
  // оновлення порціями; кожна зміна потрапляє в історію справи (тригер у базі)
  // не чекаємо вічно: якщо сервер не відповів за 30 с — показуємо помилку, а не нескінченне «Зберігаємо…»
  const withTimeout = (p, ms = 30000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  async function updateCases(ids, patch, onStep) {
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await withTimeout(db.from('cases').update(patch).in('id', ids.slice(i, i + 100)));
      if (error) throw error;
      if (onStep) onStep(Math.min(i + 100, ids.length), ids.length);
    }
  }
  // мої мітки для багатьох справ: «+3» — додати жовту, «-3» — зняти, «clear» — зняти всі
  async function bulkMarks(ids, mk, onStep) {
    const up = [], del = [];
    ids.forEach((id) => {
      const cur = new Set(marks.get(id) || []);
      if (mk === 'clear') cur.clear(); else { const n = Number(mk.slice(1)); mk[0] === '+' ? cur.add(n) : cur.delete(n); }
      const colors = [...cur].sort();
      if (colors.length) up.push({ case_id: id, user_id: me, colors, updated_at: new Date().toISOString() }); else if (marks.has(id)) del.push(id);
    });
    let done = 0;
    for (let i = 0; i < up.length; i += 200) {
      const part = up.slice(i, i + 200);
      const { error } = await withTimeout(db.from('case_marks').upsert(part));
      if (error) throw error;
      part.forEach((r) => marks.set(r.case_id, r.colors)); done += part.length; if (onStep) onStep(done, ids.length);
    }
    for (let i = 0; i < del.length; i += 200) {
      const part = del.slice(i, i + 200);
      const { error } = await withTimeout(db.from('case_marks').delete().eq('user_id', me).in('case_id', part));
      if (error) throw error;
      part.forEach((id) => marks.delete(id)); done += part.length; if (onStep) onStep(done, ids.length);
    }
  }
  // Підтвердження — прямо на панелі (без вікна браузера: Chrome інколи тихо блокує такі вікна,
  // і тоді здається, що кнопка «залипла»). Кожен крок пише, що відбувається.
  let bulkArmed = null;
  const bkMsg = (t, bad) => { const m = $('bk-msg'); m.textContent = t || ''; m.classList.toggle('bad', !!bad); };
  function bulkPatch() {
    const v = (id) => $(id).value;
    const patch = {};
    if (v('bk-exec')) patch.executor_id = v('bk-exec') === 'none' ? null : v('bk-exec');
    if (v('bk-resp')) patch.responsible_id = v('bk-resp') === 'none' ? null : v('bk-resp');
    if (v('bk-cell')) patch.cell_id = v('bk-cell') === 'none' ? null : Number(v('bk-cell'));
    if (v('bk-status')) patch.status = v('bk-status');
    return patch;
  }
  function bulkDisarm() {
    bulkArmed = null;
    $('bk-apply').textContent = 'Застосувати'; $('bk-cancel').hidden = true;
  }
  async function applyBulk() {
    const btn = $('bk-apply');
    if (!picked.size) { bkMsg('Спершу позначте справи галочками зліва (або «усі на сторінці»).', true); return; }
    const patch = isAdmin ? bulkPatch() : {};
    const mk = $('bk-mark').value;
    if (!Object.keys(patch).length && !mk) { bkMsg(isAdmin ? 'Оберіть, що змінити: мітку, виконавця, відповідального, осередок чи статус.' : 'Оберіть мітку: поставити чи зняти колір.', true); return; }
    const key = JSON.stringify(patch) + mk + '|' + [...picked].sort().join(',');
    if (bulkArmed !== key) {
      const what = [mk && 'мітку', patch.executor_id !== undefined && 'виконавця', patch.responsible_id !== undefined && 'відповідального', patch.cell_id !== undefined && 'осередок', patch.status && 'статус'].filter(Boolean).join(', ');
      bulkArmed = key;
      btn.textContent = `Так, змінити (${picked.size})`; $('bk-cancel').hidden = false;
      bkMsg(`Змінити ${what} у ${picked.size} справах? Натисніть «Так, змінити» ще раз.`);
      return;
    }
    bulkDisarm();
    btn.disabled = true; btn.textContent = 'Зберігаємо…';
    const n = picked.size;
    bkMsg(`Надсилаємо зміни: 0 з ${n}…`);
    try {
      if (mk) await bulkMarks([...picked], mk, (d, t) => { bkMsg(`Мітки: ${d} з ${t}…`); });
      if (Object.keys(patch).length) await updateCases([...picked], patch, (d, t) => { bkMsg(`Збережено ${d} з ${t}…`); });
      picked.clear(); ['bk-mark', 'bk-exec', 'bk-resp', 'bk-cell', 'bk-status'].forEach((id) => { $(id).value = ''; });
      Persons.toast(`Оновлено справ: ${n}`);
      if (Object.keys(patch).length) { bkMsg(`✓ Оновлено справ: ${n}. Оновлюємо список…`); await load(); } else render();
      bkMsg(`✓ Оновлено справ: ${n}.`);
    } catch (e) {
      console.error(e);
      bkMsg(e.message === 'timeout'
        ? 'Сервер не відповів за 30 с — нічого не змінено або змінено частково. Оновіть сторінку (F5) і перевірте.'
        : 'Не вдалося оновити: ' + (e.message || e.code || 'помилка') , true);
    } finally { btn.textContent = 'Застосувати'; btn.disabled = false; }
  }

