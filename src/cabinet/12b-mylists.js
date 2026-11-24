//@ Частина кабінету «Мої списки»: робочі списки, призначені мені (розсилка «Діти», адреси, поховання…).
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- «Мої списки» під блоком «Сьогодні» ----------
  // Показуємо списки, де я — адресат (shared_with) або автор, і в яких ще хтось є. Клік — відкриває список;
  // у списку «Анкета «Діти»» — одразу кнопка «▶ Розіслати». Запит — не частіше ніж раз на хвилину.
  let myListsAt = 0, myLists = [];
  async function renderMyLists(force) {
    const box = $('cab-mylists'); if (!box || !db || !me) return;
    if (force || Date.now() - myListsAt > 60000) {
      const { data, error } = await db.from('person_lists').select('id, name, due_date, status, person_list_members(count)')
        .or(`owner_id.eq.${me},shared_with.cs.{${me}}`).order('name');
      if (error) { console.error(error); return; }
      myListsAt = Date.now();
      myLists = (data || []).map((l) => ({ ...l, n: (l.person_list_members && l.person_list_members[0] && l.person_list_members[0].count) || 0 }))
        .filter((l) => l.n > 0 && l.status !== 'Виконано' && l.status !== 'Архів');
    }
    box.hidden = !myLists.length; box.innerHTML = '';
    if (!myLists.length) return;
    const kids = (l) => /^Анкета «Діти» (·|\(тест\))/.test(l.name);
    const order = (l) => (kids(l) ? 0 : /^Адреси/.test(l.name) ? 1 : /^Поховання/.test(l.name) ? 2 : 3);
    const h = document.createElement('h2'); h.textContent = 'Мої списки'; box.appendChild(h);
    const ul = document.createElement('ul'); ul.className = 'mylists';
    [...myLists].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, 'uk')).forEach((l) => {
      const li = document.createElement('li'); li.className = 'mylist' + (kids(l) ? ' mylist-kids' : '');
      const due = l.due_date && l.due_date < today() ? ' mylist-over' : '';
      li.innerHTML = `<button type="button" class="btn-link mylist-name"></button> <span class="mylist-n${due}"></span> <span class="mylist-act"></span>`;
      const nm = li.querySelector('.mylist-name');
      let nmTxt = l.name; const cm = nmTxt.match(/ · ((?:🧊|🔀)[^·]*)$/); if (cm) nmTxt = nmTxt.slice(0, cm.index);
      const om = nmTxt.match(/ · (⚠ ПРОСТРОЧЕНО: перенесено на .+)$/);
      nm.textContent = (om ? nmTxt.slice(0, om.index) : nmTxt).replace(/ — до виконання$/, '');
      if (cm) { const sp = document.createElement('span'); sp.className = 'list-cold'; sp.textContent = cm[1]; nm.after(' ', sp); }
      if (om) { const sp = document.createElement('span'); sp.className = 'list-overdue'; sp.textContent = om[1]; nm.after(' ', sp); }
      nm.title = 'Відкрити список'; nm.onclick = () => Lists.openById(l.id);
      li.querySelector('.mylist-n').textContent = `${l.n} ${plural(l.n, 'особа', 'особи', 'осіб')}`;
      if (kids(l)) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-primary btn-small';
        b.textContent = '▶ Розіслати'; b.title = 'Відкрити список і почати розсилку анкети через WhatsApp';
        b.onclick = () => Lists.openById(l.id, true);
        li.querySelector('.mylist-act').appendChild(b);
      }
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }
