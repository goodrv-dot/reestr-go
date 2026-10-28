//@ Частина кабінету «Родина у справі».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Родина у справі ----------
  function familyEl() {
    const c = current; const wrap = document.createElement('div'); wrap.className = 'case-fam';
    const contact = contactOf(c);
    if (!c.kin.length) wrap.innerHTML = '<p class="muted">Рідних ще не додано.</p>';
    c.kin.forEach((k) => {
      const row = document.createElement('div'); row.className = 'fam-row';
      row.innerHTML = `
        <button type="button" class="btn-link fam-name" title="Відкрити картку в реєстрі"></button>
        <label>Спорідненість<select data-f="deg">${OPT.relation_degree.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>
        <label>Телефон<input data-f="phone" type="tel"></label>
        <label>Населений пункт, адреса<input data-f="settlement"></label>
        <label class="fam-contact"><input type="radio" name="fam-contact"> контактна особа</label>`;
      const q = (f) => row.querySelector(`[data-f="${f}"]`);
      row.children[0].textContent = fio(k.person); row.children[0].onclick = () => openPerson(k.person.id);
      q('deg').value = k.relation_degree; q('phone').value = V.formatPhone(k.person.phone) || ''; q('settlement').value = k.person.settlement || '';
      { const cl = callLink(k.person.phone); const lab = q('phone').parentElement;   // «Телефон 📞» над полем
        if (cl) { const h = document.createElement('span'); h.append('Телефон ', cl); lab.replaceChild(h, lab.firstChild); } }
      const radio = row.querySelector('[type=radio]'); radio.checked = contact === k;
      radio.onchange = async () => { await saveCase({ contact_person_id: k.person.id }); renderHead(); };
      q('deg').onchange = async () => {
        const { error } = await db.from('military_relations').update({ relation_degree: q('deg').value }).eq('id', k.id);
        if (error) { console.error(error); Persons.toast('Не вдалося зберегти'); return; }
        k.relation_degree = q('deg').value; Persons.toast('Збережено'); renderHead();
      };
      q('phone').onchange = async () => {
        const ph = phoneOf(q('phone')); if (ph === undefined) return;
        if (await updPerson(k.person.id, { phone: ph })) { k.person.phone = ph; refreshStages(); renderHead(); }
      };
      q('settlement').onchange = async () => {
        const v = q('settlement').value.trim() || null;
        if (await updPerson(k.person.id, { settlement: v })) k.person.settlement = v;
      };
      wrap.appendChild(row);
    });
    const add = document.createElement('details'); add.className = 'fam-add';
    add.innerHTML = `<summary>+ Додати родича</summary>
      <form class="fam-row" novalidate>
        <label>Прізвище<input name="ln" required></label><label>Ім’я<input name="fn" required></label><label>По батькові<input name="pn"></label>
        <label>Спорідненість<select name="deg">${OPT.relation_degree.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>
        <label>Телефон<input name="phone" type="tel"></label><label>Населений пункт, адреса<input name="st"></label>
        <button class="btn-primary btn-small" type="submit">Додати</button>
      </form>`;
    add.querySelector('form').onsubmit = (e) => { e.preventDefault(); addKin(e.target); };
    wrap.appendChild(add);
    return wrap;
  }

  async function updPerson(id, patch) {
    const { error } = await db.from('persons').update(patch).eq('id', id);
    if (error) {
      console.error(error);
      Persons.toast(error.code === '23505' ? 'Такий телефон уже є в іншій картці реєстру' : error.code === '23514' ? 'Значення не пройшло перевірку (дата чи формат)' : 'Не вдалося зберегти');
      return false;
    }
    Persons.toast('Збережено'); return true;
  }

  async function addKin(form) {
    const c = current, p = c.person; const g = (n) => form.elements[n].value.trim();
    if (!g('ln') || !g('fn')) { Persons.toast('Вкажіть прізвище та ім’я'); return; }
    if (badName(g('ln'), g('fn'), g('pn'))) return;
    const phv = phoneOf(form.elements.phone); if (phv === undefined) return;
    const ph = { value: phv };
    const btn = form.querySelector('button'); if (btn.disabled) return; btn.disabled = true;
    try {
      const kinRec = { last_name: nm(g('ln')), first_name: nm(g('fn')), patronymic: g('pn') ? nm(g('pn')) : null, phone: ph.value, settlement: g('st') || null };
      const { data: res, error } = await db.rpc('add_case_kin', { p_case: c.id, p_last: kinRec.last_name, p_first: kinRec.first_name, p_patr: kinRec.patronymic || '',
        p_degree: g('deg'), p_phone: ph.value || '', p_settlement: kinRec.settlement || '' });
      if (error) { console.error(error); Persons.toast(error.code === '23505' ? 'Людина з таким телефоном уже є в реєстрі — зверніться до адміністратора, щоб пов’язати картки' : 'Не вдалося додати родича'); return; }
      const np = { id: res.person_id, ...kinRec };
      const r2 = { data: { id: res.relation_id, related_person_id: p.id, relation_degree: g('deg') } };
      c.kin.push({ ...r2.data, person: np });
      if (module === '200' && c.status === 'Родину не встановлено' && statuses.some((s) => s.name === 'В роботі')) { await saveCase({ status: 'В роботі' }); $('case-status').value = 'В роботі'; }
      form.reset();    // щоб повторне «Додати» не створило того самого родича ще раз
      Persons.toast('Родича додано');
      renderHead(); refreshStages();
    } finally { btn.disabled = false; }
  }

  async function savePerson(key, val, type, el) {
    const c = current, p = c.person; let v = val || null;
    if (type === 'phone') { v = phoneOf(el); if (v === undefined) return; }
    if (type === 'unit' || type === 'region') v = val ? Number(val) : null;
    if (['last_name', 'first_name', 'patronymic'].includes(key) && v && badName(v)) { el.value = p[key] || ''; return; }
    if ((key === 'last_name' || key === 'first_name')) { if (!v) { Persons.toast('Прізвище та ім’я обов’язкові'); el.value = p[key] || ''; return; } v = nm(v); }
    if (key === 'patronymic' && v) v = nm(v);
    const dd = key === 'death_date' ? v : p.death_date, bd = key === 'burial_date' ? v : p.burial_date;
    if ((key === 'burial_date' || key === 'death_date') && dd && bd && bd < dd) { Persons.toast('Дата поховання раніше дати загибелі — перевірте'); el.value = p[key] || ''; return; }
    if (!(await updPerson(p.id, { [key]: v }))) { refreshStages(); return; }
    p[key] = v;
    renderHead(); if (key !== 'comment') refreshStages(); loadHistory();
  }

