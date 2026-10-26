//@ Частина кабінету «Особисті кольорові мітки».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Особисті мітки (адміністратор): 5 кольорів, можна кілька або жодної ----------
  function markDots(c) {
    const box = document.createElement('span'); box.className = 'mark-dots';
    const on = new Set(marks.get(c.id) || []);
    MARK_COLORS.forEach((col, i) => {
      const n = i + 1;
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'mark-dot' + (on.has(n) ? ' is-on' : '');
      b.style.setProperty('--mk', col);
      b.title = (on.has(n) ? 'Зняти ' : 'Поставити ') + MARK_NAMES[i] + ' мітку';
      b.setAttribute('aria-pressed', String(on.has(n)));
      b.addEventListener('click', (e) => { e.stopPropagation(); toggleMark(c, n, b); });
      box.appendChild(b);
    });
    return box;
  }
  // Фільтр за мітками: кілька кольорів і «без міток» (АБО); значення — у прихованому полі cab-mark («1,3,none»)
  function initMarkFilter() {
    const list = document.querySelector('#cab-mark-ui .mark-ms-list'); list.innerHTML = '';
    const opt = (val, label, col) => {
      const l = document.createElement('label'); l.className = 'check';
      l.innerHTML = '<input type="checkbox"> <span class="mark-dot"></span> <span></span>';
      l.firstChild.value = val; l.lastChild.textContent = label;
      const dot = l.querySelector('.mark-dot');
      if (col) { dot.style.setProperty('--mk', col); dot.classList.add('is-on'); } else dot.classList.add('is-empty');
      list.appendChild(l);
    };
    MARK_COLORS.forEach((col, i) => opt(String(i + 1), MARK_NAMES[i], col));
    opt('none', 'без міток', null);
    list.addEventListener('change', () => {
      $('cab-mark').value = [...list.querySelectorAll('input:checked')].map((i) => i.value).join(',');
      render();
    });
    document.addEventListener('click', (e) => { const d = $('cab-mark-ui'); if (d.open && !d.contains(e.target)) d.open = false; });
    syncMarkFilter();
    $('cab-reset').addEventListener('click', () => clearFilters());
  }
  const FILTER_IDS = ['cab-search', 'cab-status', 'cab-exec', 'cab-resp', 'cab-mark', 'cab-cell', 'cab-region', 'cab-unit', 'cab-from', 'cab-to'];
  function clearFilters(silent) {
    if (!silent && $('cab-date-clear')) $('cab-date-clear').hidden = true;
    FILTER_IDS.forEach((id) => { const el = $(id); if (el) el.value = ''; });
    quick = ''; preset = null; page = 1;
    syncMarkFilter();
    if (!silent) render();
  }
  function syncMarkFilter() {
    const ui = $('cab-mark-ui'); if (!ui || ui.hidden) return;
    const sel = new Set($('cab-mark').value.split(',').filter(Boolean));
    ui.querySelectorAll('.mark-ms-list input').forEach((i) => { i.checked = sel.has(i.value); });
    ui.querySelector('.mark-ms-label').textContent = sel.size ? 'Мітки:' : 'Усі мітки';
    const dots = ui.querySelector('.mark-ms-dots'); dots.innerHTML = '';
    // для наочності: без вибору — усі 5 кольорів блідо; з вибором — лише обрані
    MARK_COLORS.forEach((col, i) => {
      if (sel.size && !sel.has(String(i + 1))) return;
      const d = document.createElement('span'); d.className = 'mark-dot' + (sel.size ? ' is-on' : ''); d.style.setProperty('--mk', col); dots.appendChild(d);
    });
    if (sel.has('none')) { const d = document.createElement('span'); d.className = 'mark-dot is-empty'; d.title = 'без міток'; dots.appendChild(d); }
    ui.classList.toggle('is-active', sel.size > 0);
  }

  async function toggleMark(c, n, btn) {
    const cur = new Set(marks.get(c.id) || []);
    cur.has(n) ? cur.delete(n) : cur.add(n);
    const colors = [...cur].sort();
    btn.classList.toggle('is-on', cur.has(n)); btn.setAttribute('aria-pressed', String(cur.has(n)));
    const { error } = colors.length
      ? await db.from('case_marks').upsert({ case_id: c.id, user_id: me, colors, updated_at: new Date().toISOString() })
      : await db.from('case_marks').delete().eq('case_id', c.id).eq('user_id', me);
    if (error) { console.error(error); Persons.toast('Не вдалося зберегти мітку'); btn.classList.toggle('is-on'); return; }
    if (colors.length) marks.set(c.id, colors); else marks.delete(c.id);
    if ($('cab-mark').value) render();
  }

