//@ Частина кабінету «Блок «Сьогодні»: що горить у моїх справах».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- «Сьогодні»: що горить у моїх справах ----------
  let todayAll = false;
  function renderToday() {
    const box = $('cab-today');
    const mineN = cases.filter((c) => c.executor_id === me).length;
    const scopeAll = todayAll || !mineN;
    const pool = cases.filter((c) => c.next && c.next.days <= 7 && (scopeAll || c.executor_id === me)).sort((a, b) => a.next.days - b.next.days);
    const over = pool.filter((c) => c.next.days < 0), now = pool.filter((c) => c.next.days === 0), week = pool.filter((c) => c.next.days > 0);
    box.hidden = false; box.className = 'cab-today' + (over.length ? ' has-over' : now.length ? ' has-now' : '');
    box.innerHTML = `<div class="today-head"><h2></h2><span class="today-counts"></span><span class="today-scope"></span></div><ul class="today-list"></ul><p class="today-more"></p>`;
    box.querySelector('h2').textContent = scopeAll ? 'На контролі — усі справи' : 'Мої справи на сьогодні';
    const cnt = box.querySelector('.today-counts');
    const groups = { over, now, week };
    if (!todayTab || !groups[todayTab].length) todayTab = over.length ? 'over' : now.length ? 'now' : week.length ? 'week' : 'over';
    [['over', 'Прострочено', over.length], ['now', 'На сьогодні', now.length], ['week', 'На цьому тижні', week.length]].forEach(([k, l, n]) => {
      const sp = document.createElement('button'); sp.type = 'button'; sp.className = 'today-n today-' + k + (n ? '' : ' is-zero');
      sp.setAttribute('aria-pressed', String(k === todayTab)); sp.disabled = !n; sp.title = n ? 'Показати ці справи' : 'Таких справ немає';
      sp.innerHTML = '<b></b> '; sp.firstChild.textContent = n; sp.append(l);
      sp.onclick = () => { todayTab = k; todayOpen = false; renderToday(); };
      cnt.appendChild(sp);
    });
    const shown = groups[todayTab];
    if (mineN) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-link'; b.textContent = scopeAll ? 'лише мої' : 'показати всі справи'; b.onclick = () => { todayAll = !todayAll; renderToday(); }; box.querySelector('.today-scope').appendChild(b); }
    const ul = box.querySelector('.today-list'); const LIMIT = todayOpen ? 60 : 4;
    shown.slice(0, LIMIT).forEach((c) => {
      const li = document.createElement('li'); li.className = 'today-item lvl-' + c.next.level;
      li.innerHTML = '<button type="button" class="btn-link today-name"></button><span class="today-what"></span><span class="today-due"></span><span class="today-act"></span>';
      li.children[0].textContent = fio(c.person); li.children[0].onclick = () => openCase(c.id);
      li.children[1].textContent = c.next.label; li.children[2].textContent = dueText(c.next);
      const done = document.createElement('button'); done.type = 'button'; done.className = 'btn-secondary btn-small';
      if (c.next.kind === 'date') { done.textContent = 'Зроблено'; done.title = 'Поставити сьогоднішню дату'; done.onclick = () => markDone(c, done); }
      else { done.textContent = 'Заповнити'; done.onclick = () => openCase(c.id); }
      li.children[3].appendChild(done); ul.appendChild(li);
    });
    const more = box.querySelector('.today-more');
    if (!pool.length) { ul.remove(); more.textContent = 'Нічого термінового: прострочених і найближчих дій немає.'; more.className = 'today-more today-ok'; }
    else if (shown.length > LIMIT || todayOpen) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-link'; b.textContent = todayOpen ? 'згорнути' : `показати ще ${Math.min(shown.length, 60) - LIMIT}` + (shown.length > 60 ? ` (усього ${shown.length} — решта у фільтрі «Прострочені»)` : ''); b.onclick = () => { todayOpen = !todayOpen; renderToday(); }; more.appendChild(b); }
    else more.remove();
  }
  let todayOpen = false, todayTab = '';
  async function markDone(c, btn) {
    const k = c.next.key, label = c.next.label; btn.disabled = true;
    const { error } = await db.from('case_values').upsert({ case_id: c.id, stage_key: k, value: today(), source: 'app', updated_by: me, updated_at: new Date().toISOString() }, { onConflict: 'case_id,stage_key' });
    if (error) { console.error(error); Persons.toast('Не вдалося зберегти'); btn.disabled = false; return; }
    c.vals[k] = today(); c.next = nextAction(c);
    Persons.toast(`${label}: зроблено сьогодні` + (c.next ? `. Далі — ${c.next.label}, ${dueText(c.next)}` : ''));
    render(); badge();
  }

  function fillFilters() {
    const keep = (id) => $(id).value;
    const fill = (id, items, all) => {
      const v = keep(id); const sel = $(id);
      sel.innerHTML = `<option value="">${all}</option>`;
      items.forEach(([val, label]) => sel.add(new Option(label, val)));
      sel.value = v;
    };
    fill('cab-status', statuses.map((s) => [s.name, s.name]), 'Усі статуси');
    fill('cab-exec', [['none', '— без виконавця —'], ...[...staff].map(([id, n]) => [id, n])], 'Усі виконавці');
    fill('cab-resp', [['none', '— без відповідального —'], ...[...staff].map(([id, n]) => [id, n])], 'Усі відповідальні');
    const { cells } = Persons.ctx();
    fill('cab-cell', [['none', '— без осередку —'], ...[...cells].map(([id, n]) => [String(id), n])], 'Усі осередки');
    { const { regions } = Persons.ctx();
      fill('cab-region', [['none', '— без регіону —'], ...[...regions].map(([id, n]) => [String(id), n])], 'Усі регіони'); }
    { const { units } = Persons.ctx();
      fill('cab-unit', [['none', '— без бригади —'], ...[...units].map(([id, n]) => [String(id), n])], 'Усі бригади'); }
    if (isAdmin) {
      const people = [...staff].sort((a, b) => a[1].localeCompare(b[1], 'uk'));
      fill('bk-exec', [['none', '— прибрати виконавця —'], ...people], 'Виконавець: не змінювати');
      fill('bk-resp', [['none', '— прибрати відповідального —'], ...people], 'Відповідальний: не змінювати');
      fill('bk-cell', [['none', '— без осередку —'], ...[...cells].map(([id, n]) => [String(id), n])], 'Осередок: не змінювати');
      fill('bk-status', statuses.map((x) => [x.name, x.name]), 'Статус: не змінювати');
    }
  }

