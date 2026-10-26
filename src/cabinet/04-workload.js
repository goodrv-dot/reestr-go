//@ Частина кабінету ««Навантаження» (адміністратор)».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Навантаження (адміністратор): хто скільки веде, де просідає ----------
  function openLoad() {
    const open = cases.filter((c) => !isClosed(c));
    const { cells } = Persons.ctx();
    const stat = (keyOf) => {
      const m = new Map();
      open.forEach((c) => {
        const k = keyOf(c); const r = m.get(k) || { all: 0, over: 0, noContact: 0, problem: 0, noExec: 0 };
        r.all++; if (c.next && c.next.overdue) r.over++; if (!contactOf(c)) r.noContact++;
        if (c.status === 'Проблема') r.problem++; if (!c.executor_id) r.noExec++;
        m.set(k, r);
      });
      return [...m].sort((a, b) => b[1].over - a[1].over || b[1].all - a[1].all);
    };
    const table = (el, rows, nameOf, onPick, withNoExec) => {
      const t = $(el);
      t.innerHTML = `<thead><tr><th></th><th>Відкритих</th><th>Прострочено</th><th>«Проблема»</th><th>Без контактної особи</th>${withNoExec ? '<th>Без виконавця</th>' : ''}</tr></thead><tbody></tbody>`;
      rows.forEach(([k, r]) => {
        const tr = document.createElement('tr'); tr.className = 'is-click';
        tr.innerHTML = `<td></td><td>${r.all}</td><td class="${r.over ? 'n-bad' : ''}">${r.over}</td><td>${r.problem}</td><td class="${r.noContact ? 'n-warn' : ''}">${r.noContact}</td>${withNoExec ? `<td class="${r.noExec ? 'n-warn' : ''}">${r.noExec}</td>` : ''}`;
        tr.children[0].textContent = nameOf(k);
        tr.addEventListener('click', () => { onPick(k); $('cab-load').close(); });
        t.tBodies[0].appendChild(tr);
      });
    };
    const reset = () => { quick = ''; preset = null; ['cab-search', 'cab-status', 'cab-exec', 'cab-resp', 'cab-mark', 'cab-cell', 'cab-region', 'cab-unit', 'cab-from', 'cab-to'].forEach((id) => { $(id).value = ''; }); };
    table('cab-load-exec', stat((c) => c.executor_id || ''), (k) => (k ? staff.get(k) || '(невідомий)' : '— без виконавця —'),
      (k) => { reset(); $('cab-exec').value = k || 'none'; render(); }, false);
    table('cab-load-cell', stat((c) => c.cell_id || 0), (k) => (k ? cells.get(k) || '—' : '— без осередку —'),
      (k) => { reset(); $('cab-cell').value = k ? String(k) : 'none'; render(); }, true);
    $('cab-load').showModal();
  }

