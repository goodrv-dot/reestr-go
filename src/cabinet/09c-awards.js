//@ Частина кабінету «Нагороди у справі» (таблиці case_awards + довідник award_types).
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Нагороди у справі ----------
  // Одна справа — кілька нагород. Кожна: вид (довідник), посмертно, стан, кому вручено (з «Родини»), дата, ким/де, № документа, примітка.
  const AWARD_ST = ['подано', 'погоджено', 'є', 'вручено', 'відмовлено', 'не подаємо'];
  const AWARD_ST_LABEL = { 'подано': '📝 подано', 'погоджено': '👍 погоджено', 'є': '🎖 є (ще не вручено)', 'вручено': '✅ вручено', 'відмовлено': '✖ відмовлено', 'не подаємо': '— не подаємо' };
  const awardsOf = (c) => c.case_awards || (c.case_awards = []);
  const awardName = (a) => {
    const t = awardTypes.find((x) => x.id === a.award_type_id);
    return [t ? t.name : 'Нагорода', a.award_other].filter(Boolean).join(': ');
  };
  // коротко для списку справ і підказки
  const awardsText = (c) => awardsOf(c).map((a) => `${awardName(a)} — ${a.status}${a.posthumous ? ' (посмертно)' : ''}`).join('\n');
  // фільтр у списку: any | handed | notyet | submitted | refused | none | t:<id>
  function awardMatch(c, f) {
    const xs = awardsOf(c);
    if (f === 'none') return !xs.some((a) => !['відмовлено', 'не подаємо'].includes(a.status));
    if (f === 'any') return xs.some((a) => !['відмовлено', 'не подаємо'].includes(a.status));
    if (f === 'handed') return xs.some((a) => a.status === 'вручено');
    if (f === 'notyet') return xs.some((a) => a.status === 'є' || a.status === 'погоджено');
    if (f === 'submitted') return xs.some((a) => a.status === 'подано');
    if (f === 'refused') return xs.some((a) => a.status === 'відмовлено' || a.status === 'не подаємо');
    if (f.startsWith('t:')) return xs.some((a) => String(a.award_type_id) === f.slice(2));
    return true;
  }
  function awardsChip(c) {
    const xs = awardsOf(c); if (!xs.length) return '';
    const h = xs.filter((a) => a.status === 'вручено').length;
    const live = xs.filter((a) => !['відмовлено', 'не подаємо'].includes(a.status)).length;
    return live ? (h === live ? `✅ ${h}` : `${h}/${live}`) : '—';
  }

  function awardsEl() {
    const c = current; const ro = !!acc().readOnly;
    const wrap = document.createElement('div'); wrap.className = 'case-awards';
    const xs = awardsOf(c);
    if (!xs.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Нагород ще не внесено.'; wrap.appendChild(p); }
    xs.forEach((a) => wrap.appendChild(awardRow(c, a, ro)));
    if (!ro) {
      const add = document.createElement('button'); add.type = 'button'; add.className = 'btn-secondary'; add.textContent = '➕ Додати нагороду';
      add.onclick = async () => {
        add.disabled = true;
        const row = { case_id: c.id, award_type_id: null, posthumous: module === '200', status: 'є' };
        const { data, error } = await db.from('case_awards').insert(row).select('id, award_type_id, award_other, posthumous, status, recipient_person_id, handed_at, handed_by, doc_no, note').single();
        add.disabled = false;
        if (error) { console.error(error); Persons.toast('Не вдалося додати нагороду'); return; }
        xs.push(data); c.updated_at = new Date().toISOString();
        renderStages(); loadHistory();
        const sel = document.querySelector(`.award-row[data-id="${data.id}"] [data-f="award_type_id"]`); if (sel) sel.focus();
      };
      wrap.appendChild(add);
    }
    return wrap;
  }

  function awardRow(c, a, ro) {
    const row = document.createElement('div'); row.className = 'award-row' + (a.status === 'вручено' ? ' is-handed' : ''); row.dataset.id = a.id;
    const kinOpts = c.kin.map((k) => `<option value="${k.person.id}">${esc(k.relation_degree + ': ' + fio(k.person))}</option>`).join('');
    row.innerHTML = `
      <label class="aw-type">Нагорода<select data-f="award_type_id"><option value="">— оберіть —</option>${awardTypes.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
      <label class="aw-other">Назва / уточнення<input data-f="award_other" placeholder="напр., ступінь, назва іншої нагороди"></label>
      <label class="aw-st">Стан<select data-f="status">${AWARD_ST.map((s) => `<option value="${s}">${esc(AWARD_ST_LABEL[s])}</option>`).join('')}</select></label>
      <label class="aw-post"><input type="checkbox" data-f="posthumous"> посмертно</label>
      <label class="aw-to">Кому вручено<select data-f="recipient_person_id"><option value="">—</option>${kinOpts}</select></label>
      <label class="aw-date">Дата вручення<input type="date" data-f="handed_at"></label>
      <label class="aw-by">Ким / де вручено<input data-f="handed_by" placeholder="напр., командир бригади, м. Запоріжжя"></label>
      <label class="aw-doc">№ указу / наказу<input data-f="doc_no"></label>
      <label class="aw-note">Примітка<textarea rows="1" data-f="note"></textarea></label>
      <button type="button" class="btn-link aw-del" title="Видалити цю нагороду зі справи">🗑 Видалити</button>`;
    const q = (f) => row.querySelector(`[data-f="${f}"]`);
    q('award_type_id').value = a.award_type_id || '';
    q('award_other').value = a.award_other || '';
    q('status').value = a.status || 'є';
    q('posthumous').checked = !!a.posthumous;
    if (a.recipient_person_id && !c.kin.some((k) => k.person.id === a.recipient_person_id)) q('recipient_person_id').add(new Option('(родич не в цій справі)', a.recipient_person_id));
    q('recipient_person_id').value = a.recipient_person_id || '';
    q('handed_at').value = a.handed_at || '';
    q('handed_by').value = a.handed_by || '';
    q('doc_no').value = a.doc_no || '';
    q('note').value = a.note || '';
    const save = async (patch) => {
      const { error } = await db.from('case_awards').update(patch).eq('id', a.id);
      if (error) { console.error(error); Persons.toast('Не вдалося зберегти'); return false; }
      Object.assign(a, patch); c.updated_at = new Date().toISOString();
      Persons.toast('Збережено'); loadHistory(); return true;
    };
    q('award_type_id').onchange = () => save({ award_type_id: q('award_type_id').value ? Number(q('award_type_id').value) : null });
    ['award_other', 'handed_by', 'doc_no', 'note'].forEach((f) => { q(f).onchange = () => save({ [f]: q(f).value.trim() || null }); });
    q('posthumous').onchange = () => save({ posthumous: q('posthumous').checked });
    q('recipient_person_id').onchange = () => save({ recipient_person_id: q('recipient_person_id').value || null });
    q('handed_at').onchange = async () => {
      const d = q('handed_at').value || null;
      const patch = { handed_at: d };
      if (d && a.status !== 'вручено') { patch.status = 'вручено'; q('status').value = 'вручено'; }   // є дата вручення — отже вручено
      if (await save(patch)) row.classList.toggle('is-handed', a.status === 'вручено');
    };
    q('status').onchange = async () => { if (await save({ status: q('status').value })) { row.classList.toggle('is-handed', a.status === 'вручено'); renderStages(); } };
    row.querySelector('.aw-del').onclick = async () => {
      if (!confirm(`Видалити нагороду «${awardName(a)}» зі справи?`)) return;
      const { error } = await db.from('case_awards').delete().eq('id', a.id);
      if (error) { console.error(error); Persons.toast('Не вдалося видалити'); return; }
      c.case_awards = awardsOf(c).filter((x) => x !== a);
      Persons.toast('Нагороду видалено'); renderStages(); loadHistory();
    };
    if (ro) row.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = true; });
    return row;
  }
