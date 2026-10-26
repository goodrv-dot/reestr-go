//@ Частина кабінету «Довідник бригад (адміністратор)».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Довідник бригад (адміністратор) ----------
  async function loadUnitsEditor() {
    const tb = $('cab-units-table').tBodies[0]; tb.innerHTML = '';
    const { data, error } = await db.from('mp_units').select('id, name, sort, active').order('sort').order('name');
    if (error) { console.error(error); tb.innerHTML = '<tr><td colspan="4" class="muted">Не вдалося завантажити бригади</td></tr>'; return; }
    const row = (u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td><input data-f="name" placeholder="Назва, напр. 42 ОБрМП"></td><td><input data-f="sort" type="number" style="width:5rem"></td><td><input data-f="active" type="checkbox"></td><td><button type="button" class="btn-link" data-save></button></td>';
      const q = (f) => tr.querySelector(`[data-f="${f}"]`);
      q('name').value = u.name || ''; q('sort').value = u.sort ?? ''; q('active').checked = u.active !== false;
      const b = tr.querySelector('[data-save]'); b.textContent = u.id ? 'Зберегти' : 'Додати';
      b.onclick = async () => {
        if (b.disabled) return;
        const name = q('name').value.replace(/\s+/g, ' ').trim();
        if (!name) { Persons.toast('Вкажіть назву бригади'); return; }
        const sortN = q('sort').value === '' ? (parseInt(name, 10) || 999) : Number(q('sort').value);
        const rec = { name, sort: sortN, active: q('active').checked };
        b.disabled = true;
        const res = u.id ? await db.from('mp_units').update(rec).eq('id', u.id) : await db.from('mp_units').insert(rec);
        b.disabled = false;
        if (res.error) { console.error(res.error); Persons.toast(/duplicate|unique/i.test(res.error.message) ? 'Така бригада вже є' : 'Не вдалося зберегти бригаду'); return; }
        Persons.toast(u.id ? 'Бригаду збережено' : 'Бригаду додано');
        await Persons.reloadUnits().catch((e) => console.error(e));
        loadUnitsEditor();
      };
      return tr;
    };
    (data || []).forEach((u) => tb.appendChild(row(u)));
    tb.appendChild(row({ active: true }));
  }

  // Відкрити справу за посиланням ?case=200-0123
  async function openByJournal(jid) {
    module = /^300/.test(jid) ? '300' : /^БЗВ/i.test(jid) ? 'bzv' : /^ПОЛ/i.test(jid) ? 'pol' : /^ВЕТ/i.test(jid) ? 'vet' : '200';
    await load();
    let c = cases.find((x) => x.journal_id === jid);
    if (!c) {   // завершена справа — довантажуємо лише її
      const { data } = await db.from('cases').select('id').eq('journal_id', jid).maybeSingle();
      if (data) { await addCases([data.id]); c = cases.find((x) => x.journal_id === jid); }
    }
    if (c) openCase(c.id);
    else Persons.toast(`Справу ${jid} не знайдено або немає доступу`);
  }

