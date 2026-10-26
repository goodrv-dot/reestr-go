//@ Частина кабінету «Налаштування етапів (адміністратор)».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Налаштування етапів (адміністратор) ----------
  async function openSettings() {
    loadUnitsEditor();
    const { data } = await db.from('case_stage_defs').select('*').eq('module', module).order('sort');
    const tb = $('cab-set-table').tBodies[0]; tb.innerHTML = '';
    $('cab-set-title').textContent = `Поля справи — ${ui().short === ui().title ? ui().title : 'кабінет ' + ui().short}`;
    const keys = (data || []).map((d) => [d.key, d.label]);
    const row = (d) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input data-f="label"></td>
        <td><select data-f="section">${SECTIONS[module].filter(([k]) => k !== 'family' || module).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}<option value="head">Шапка (з журналу)</option></select></td>
        <td><select data-f="kind"><option value="text">текст</option><option value="date">дата</option><option value="list">список</option><option value="bool">так/ні</option><option value="link">посилання</option></select></td>
        <td><input data-f="options" placeholder="через кому"></td>
        <td><select data-f="remind_after"><option value="">—</option>${keys.map(([k, l]) => `<option value="${k}">${l.replace(/</g, '&lt;')}</option>`).join('')}</select></td>
        <td><input data-f="remind_days" type="number" min="0" style="width:5rem"></td>
        <td><input data-f="sort" type="number" style="width:5rem"></td>
        <td><input data-f="active" type="checkbox"></td>
        <td><button type="button" class="btn-link" data-save>Зберегти</button></td>`;
      const q = (f) => tr.querySelector(`[data-f="${f}"]`);
      q('label').value = d.label || ''; q('kind').value = d.kind || 'text'; q('section').value = d.section || 'other';
      q('options').value = (d.options || []).join(', '); q('remind_after').value = d.remind_after || '';
      q('remind_days').value = d.remind_days ?? ''; q('sort').value = d.sort ?? 0; q('active').checked = d.active !== false;
      tr.querySelector('[data-save]').onclick = async (ev) => {
        const sbtn = ev.currentTarget; if (sbtn.disabled) return;
        const rec = {
          module, label: q('label').value.trim(), kind: q('kind').value, section: q('section').value,
          options: q('options').value.split(',').map((x) => x.trim()).filter(Boolean),
          remind_after: q('remind_after').value || null,
          remind_days: q('remind_days').value === '' ? null : Number(q('remind_days').value),
          sort: Number(q('sort').value || 0), active: q('active').checked,
          sheet_column: d.sheet_column || q('label').value.trim()
        };
        if (!rec.label) { Persons.toast('Вкажіть назву етапу'); return; }
        sbtn.disabled = true;     // подвійний клік не створить два однакові поля
        const res = d.id
          ? await db.from('case_stage_defs').update(rec).eq('id', d.id)
          : await db.from('case_stage_defs').insert({ ...rec, key: 'custom_' + Date.now().toString(36) });
        sbtn.disabled = false;
        if (res.error) { console.error(res.error); Persons.toast('Не вдалося зберегти етап'); return; }
        Persons.toast('Етап збережено');
        openSettings();
      };
      return tr;
    };
    (data || []).forEach((d) => tb.appendChild(row(d)));
    tb.appendChild(row({ sort: ((data || []).slice(-1)[0]?.sort || 0) + 10, active: true }));
    if (!$('cab-settings').open) $('cab-settings').showModal();
  }

