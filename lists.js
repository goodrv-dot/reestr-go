// ============================================================
// «Списки» — ручні добірки осіб під задачу («Представити до нагороди — листопад»).
// Людина може бути в багатьох списках; у кожному — свій статус, примітка й додаткові колонки.
// Автор ділиться списком з колегами; друк (А4) і Excel.
// ============================================================
window.Lists = (() => {
  const $ = (id) => document.getElementById(id);
  const LIST_ST = ['Відкритий', 'Подано', 'Закрито'];
  const MEMBER_ST = ['Підготовка', 'Подано', 'Виконано', 'Відмовлено'];
  let db = null, me = null, isAdmin = false, ready = false;
  let lists = [], current = null, members = [], ops = new Map(), listOps = [], hiddenCnt = 0;
  const fio = (p) => [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');
  const fmt = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('.') : '');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const toast = (t) => Persons.toast(t);
  const ro = () => !!(window.ACCESS && window.ACCESS.readOnly);
  const canEditMeta = (l) => isAdmin || l.owner_id === me || (l.shared_with || []).includes(me);
  const canShare = (l) => isAdmin || l.owner_id === me;

  function init(client, userId, admin) {
    db = client; me = userId; isAdmin = admin;
    if (ready) return; ready = true;
    $('lists-new').addEventListener('click', createList);
    $('list-back').addEventListener('click', () => { current = null; showIndex(); });
    const tab = (t) => document.querySelector(`.tab[data-tab="${t}"]`);
    const rb = $('reg-lists-btn'); rb.hidden = !(window.ACCESS && window.ACCESS.lists);
    rb.addEventListener('click', () => { window.__listsFrom = 'registry'; tab('lists').click(); });
    // «← Назад» — туди, звідки відкрили списки (кабінет чи «Особи»)
    $('lists-to-cab').addEventListener('click', () => { const t = tab(window.__listsFrom || 'cabinet'); if (t && !t.hidden) t.click(); });
    $('lists-noreg').hidden = !!(window.ACCESS && window.ACCESS.registry);
    $('list-meta').addEventListener('change', saveMeta);
    $('list-add-q').addEventListener('input', debounce(searchPeople, 350));
    $('list-print').addEventListener('click', () => printList());
    $('list-excel').addEventListener('click', excel);
    $('list-delete').addEventListener('click', removeList);
    $('tolist-cancel').addEventListener('click', () => $('tolist-dialog').close());
    $('tolist-form').addEventListener('submit', submitToList);
    window.addEventListener('afterprint', () => document.body.classList.remove('print-mode'));
    // «Особи» → «📋 До списку»: усі, хто зараз у списку за пошуком і фільтрами
    const fb = $('tolist-filter-btn');
    fb.hidden = ro();
    fb.addEventListener('click', () => addDialog({ filter: true, label: `Усі особи за поточним пошуком і фільтрами: ${$('count').textContent || ''}`.trim() }));
  }
  const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

  // ---------- Перелік списків ----------
  async function load() {
    if (!db) return;
    const from = document.querySelector(`.tab[data-tab="${window.__listsFrom || 'cabinet'}"]`);
    $('lists-to-cab').hidden = !from || from.hidden;
    $('lists-to-cab').textContent = (window.__listsFrom || 'cabinet') === 'registry' ? '← Особи' : '← Кабінет';
    const [l, o] = await Promise.all([
      db.from('person_lists').select('*, person_list_members(count)').order('created_at', { ascending: false }),
      db.from('operators').select('user_id, full_name, role, can_lists, can_registry, active').order('full_name')
    ]);
    if (l.error) { console.error(l.error); $('lists-status').textContent = 'Не вдалося завантажити списки.'; return; }
    lists = l.data || [];
    ops = new Map((o.data || []).map((x) => [x.user_id, x.full_name]));
    listOps = (o.data || []).filter((x) => x.active && (x.role === 'admin' || x.can_lists));
    $('lists-status').textContent = '';
    if (current) { const c = lists.find((x) => x.id === current.id); if (c) { current = c; return openList(c.id); } }
    showIndex();
  }

  function showIndex() {
    $('list-one').hidden = true; $('lists-index').hidden = false;
    const tb = $('lists-table').tBodies[0]; tb.innerHTML = '';
    lists.forEach((l) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td><b></b><br><span class="muted"></span></td><td><span class="list-st"></span></td><td></td><td></td><td></td>';
      tr.children[0].firstChild.textContent = l.name;
      tr.children[0].lastChild.textContent = l.description || '';
      const st = tr.children[1].firstChild; st.textContent = l.status; st.dataset.st = l.status;
      tr.children[2].textContent = l.due_date ? fmt(l.due_date) : '—';
      tr.children[3].textContent = (l.person_list_members && l.person_list_members[0] ? l.person_list_members[0].count : 0);
      tr.children[4].textContent = (ops.get(l.owner_id) || '—') + ((l.shared_with || []).length ? ` · спільний (${l.shared_with.length})` : '');
      tr.addEventListener('click', () => openList(l.id));
      tb.appendChild(tr);
    });
    $('lists-table').hidden = !lists.length;
    $('lists-empty').hidden = !!lists.length;
    $('lists-new').hidden = ro();
  }

  async function createList() {
    const name = prompt('Назва списку (напр. «Представити до нагороди — листопад 2026»):');
    if (!name || !name.trim()) return;
    const btn = $('lists-new'); if (btn.disabled) return; btn.disabled = true;
    try {
      const { data, error } = await db.from('person_lists').insert({ name: name.trim(), owner_id: me }).select('*').single();
      if (error) { console.error(error); toast('Не вдалося створити список'); return; }
      lists.unshift({ ...data, person_list_members: [{ count: 0 }] });
      openList(data.id);
    } finally { btn.disabled = false; }
  }

  // ---------- Один список ----------
  async function openList(id) {
    current = lists.find((x) => x.id === id); if (!current) return;
    $('lists-index').hidden = true; $('list-one').hidden = false;
    window.scrollTo(0, 0);
    const l = current, f = $('list-meta');
    $('list-title').textContent = l.name;
    $('list-owner').textContent = `Автор: ${ops.get(l.owner_id) || '—'} · створено ${fmt(l.created_at)}`;
    f.name.value = l.name; f.description.value = l.description || ''; f.due_date.value = l.due_date || '';
    f.status.innerHTML = LIST_ST.map((s) => `<option>${s}</option>`).join(''); f.status.value = l.status;
    f.columns.value = (l.columns || []).join(', ');
    const edit = canEditMeta(l) && !ro();
    [...f.elements].forEach((el) => { el.disabled = !edit; });
    // з ким поділитися — лише автор / адміністратор
    const box = $('list-share'); box.innerHTML = '';
    $('list-share-wrap').hidden = !canShare(l) || ro();
    listOps.filter((o) => o.user_id !== l.owner_id).forEach((o) => {
      const lab = document.createElement('label'); lab.className = 'check';
      lab.innerHTML = '<input type="checkbox"> <span></span>';
      lab.firstChild.value = o.user_id; lab.firstChild.checked = (l.shared_with || []).includes(o.user_id); lab.lastChild.textContent = o.full_name;
      lab.firstChild.addEventListener('change', saveShare);
      box.appendChild(lab);
    });
    if (!box.children.length) box.innerHTML = '<p class="muted">Немає інших співробітників із доступом «Списки».</p>';
    $('list-delete').hidden = !canShare(l) || ro();
    $('list-excel').hidden = !Persons.ctx().operator.can_export;   // Excel — лише з правом «Експорт»
    $('list-add').hidden = ro();
    $('list-add-q').value = ''; $('list-add-res').innerHTML = '';
    await loadMembers();
  }

  async function saveMeta(e) {
    if (e.target.closest('#list-share')) return;
    const l = current, f = $('list-meta');
    const patch = { name: f.name.value.trim() || l.name, description: f.description.value.trim() || null, due_date: f.due_date.value || null,
      status: f.status.value, columns: f.columns.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12) };
    const { error } = await db.from('person_lists').update(patch).eq('id', l.id);
    if (error) { console.error(error); toast('Не вдалося зберегти'); return; }
    Object.assign(l, patch); $('list-title').textContent = l.name; toast('Збережено');
    if ('columns' in patch) renderMembers();
  }
  async function saveShare() {
    const l = current;
    const shared = [...$('list-share').querySelectorAll('input:checked')].map((i) => i.value);
    const { error } = await db.from('person_lists').update({ shared_with: shared }).eq('id', l.id);
    if (error) { console.error(error); toast('Не вдалося змінити доступ'); return; }
    l.shared_with = shared; toast(shared.length ? `Список відкрито для: ${shared.length}` : 'Список лише ваш');
  }
  async function removeList() {
    const l = current;
    if (!confirm(`Видалити список «${l.name}»?\n\nЛюди залишаться в реєстрі — зникне лише сам список і позначки в ньому.`)) return;
    const { error } = await db.from('person_lists').delete().eq('id', l.id);
    if (error) { console.error(error); toast('Не вдалося видалити'); return; }
    lists = lists.filter((x) => x.id !== l.id); current = null; toast('Список видалено'); showIndex();
  }

  // ---------- Люди в списку ----------
  const P_COLS = 'id, last_name, first_name, patronymic, birth_date, military_status, death_date, wound_date, military_unit_code, mp_unit_id, mp_unit_other, phone, cell_id, journal, cases!cases_person_id_fkey(journal_id)';
  async function loadMembers() {
    $('list-status').textContent = 'Завантажуємо…';
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('person_list_members').select(`person_id, status, note, extra, added_at, person:persons(${P_COLS})`)
        .eq('list_id', current.id).order('added_at').range(from, from + 999);
      if (error) { console.error(error); $('list-status').textContent = 'Не вдалося завантажити людей списку.'; return; }
      all.push(...data); if (data.length < 1000) break;
    }
    // контакт родини — перший родич
    const ids = all.map((m) => m.person_id); const kin = new Map();
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await db.from('military_relations').select('related_person_id, relation_degree, person:persons!military_relations_person_id_fkey(last_name, first_name, patronymic, phone)')
        .in('related_person_id', ids.slice(i, i + 150)).order('created_at');
      (data || []).forEach((r) => { if (r.person && !kin.has(r.related_person_id)) kin.set(r.related_person_id, r); });
    }
    members = all.filter((m) => m.person).map((m) => ({ ...m, kin: kin.get(m.person_id) || null }));
    // по номеру справи (200-0009, 200-0010…), люди без справи — у кінці в порядку додавання
    const jk = (m) => jidOf(m.person) || '\uffff';
    members.sort((a, b) => jk(a).localeCompare(jk(b), 'uk', { numeric: true }));
    hiddenCnt = all.length - members.length;   // люди поза вашими справами (спільний список)
    const c = lists.find((x) => x.id === current.id); if (c) c.person_list_members = [{ count: members.length }];
    $('list-status').textContent = '';
    renderMembers();
  }

  const rankOf = (p) => { const j = p.journal || {}; for (const k of Object.keys(j)) { const v = j[k] && (j[k]['Звання'] || j[k]['звання']); if (v) return String(v); } return ''; };
  const unitOf = (p) => { const u = Persons.ctx().units; return p.mp_unit_id ? (u.get(p.mp_unit_id) || '') : (p.mp_unit_other || ''); };
  const eventOf = (p) => (p.death_date ? `загибель ${fmt(p.death_date)}` : p.wound_date ? `поранення ${fmt(p.wound_date)}` : '');
  const jidOf = (p) => ((p && p.cases) || []).map((c) => c.journal_id).filter(Boolean).sort().join(', ');
  const kinOf = (m) => (m.kin ? `${m.kin.relation_degree}: ${fio(m.kin.person)}${m.kin.person.phone ? ', ' + V.formatPhone(m.kin.person.phone) : ''}` : '');

  // усі колонки для друку / Excel; key → [заголовок, значення]
  function columnsAll() {
    const cells = Persons.ctx().cells;
    const base = [
      ['case', 'Справа', (m) => jidOf(m.person)], ['fio', 'ПІБ', (m) => fio(m.person)], ['bd', 'Дата народження', (m) => fmt(m.person.birth_date)],
      ['mstat', 'Статус особи', (m) => m.person.military_status || ''], ['rank', 'Звання', (m) => rankOf(m.person)],
      ['vch', 'В/ч', (m) => m.person.military_unit_code || ''], ['unit', 'Бригада', (m) => unitOf(m.person)],
      ['event', 'Подія', (m) => eventOf(m.person)], ['cell', 'Осередок', (m) => cells.get(m.person.cell_id) || ''],
      ['phone', 'Телефон', (m) => V.formatPhone(m.person.phone) || ''], ['kin', 'Контакт родини', kinOf],
      ['st', 'Статус у списку', (m) => m.status], ['note', 'Примітка', (m) => m.note || '']
    ];
    return [...base, ...(current.columns || []).map((c) => ['x:' + c, c, (m) => (m.extra || {})[c] || ''])];
  }

  function renderMembers() {
    const cols = current.columns || [];
    const head = $('list-members').tHead.rows[0];
    head.innerHTML = '<th>№</th><th>Справа</th><th>ПІБ</th><th>Відомості</th><th>Статус у списку</th><th>Примітка</th>' + cols.map((c) => `<th>${esc(c)}</th>`).join('') + '<th></th>';
    const tb = $('list-members').tBodies[0]; tb.innerHTML = '';
    const edit = !ro();
    members.forEach((m, i) => {
      const p = m.person; const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td class="list-jid"></td><td><a class="btn-link list-fio"></a><br><span class="muted"></span></td><td class="muted"></td>
        <td><select data-f="status">${MEMBER_ST.map((s) => `<option>${s}</option>`).join('')}</select></td>
        <td><input data-f="note"></td>${cols.map((c) => `<td><input data-x="${esc(c)}"></td>`).join('')}
        <td><button type="button" class="btn-link list-rm" title="Прибрати зі списку">✕</button></td>`;
      tr.querySelector('.list-fio').textContent = fio(p);
      // справжнє посилання: правий клік → «Відкрити в новій вкладці», Ctrl/Cmd + клік чи середня кнопка — теж у новій вкладці
      // клік по ПІБ — відкриває СПРАВУ в кабінеті (як працюють оператори); якщо справи немає — картку особи
      { const a = tr.querySelector('.list-fio'); const jid = ((p.cases) || []).map((c) => c.journal_id).filter(Boolean).sort()[0];
        if (jid) {
          a.href = '?case=' + encodeURIComponent(jid); a.title = `Відкрити справу ${jid} у кабінеті (правий клік — у новій вкладці)`;
          a.onclick = (e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); document.querySelector('.tab[data-tab="cabinet"]').click(); Cabinet.openByJournal(jid); };
        } else {
          a.href = '?person=' + encodeURIComponent(p.id); a.title = 'Відкрити картку особи (правий клік — у новій вкладці)';
          a.onclick = (e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); window.__cardReturn = 'lists'; document.querySelector('.tab[data-tab="registry"]').click(); Persons.openForm(p.id); };
        } }
      { const td = tr.querySelector('.list-jid'); const jids = ((p.cases) || []).map((c) => c.journal_id).filter(Boolean).sort();
        if (!jids.length) td.innerHTML = '<span class="muted">—</span>';
        jids.forEach((j, k) => { const a = document.createElement('a'); a.className = 'btn-link'; a.textContent = j; a.href = '?case=' + encodeURIComponent(j); a.title = 'Відкрити справу (правий клік — у новій вкладці)';
          a.onclick = (e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); document.querySelector('.tab[data-tab="cabinet"]').click(); Cabinet.openByJournal(j); };
          if (k) td.append(document.createElement('br')); td.append(a); }); }
      tr.children[2].lastChild.textContent = [fmt(p.birth_date), p.military_status].filter(Boolean).join(' · ');
      tr.children[3].textContent = [rankOf(p), p.military_unit_code, unitOf(p), eventOf(p), kinOf(m)].filter(Boolean).join(' · ');
      { const own = V.callLink(p.phone), kin = m.kin ? V.callLink(m.kin.person.phone) : null;   // 📞 людині / родині
        if (own) tr.children[2].append(' ', own); if (kin) tr.children[3].append(' ', kin); }
      const sel = tr.querySelector('[data-f="status"]'); sel.value = m.status; sel.disabled = !edit;
      sel.onchange = () => saveMember(m, { status: sel.value });
      const note = tr.querySelector('[data-f="note"]'); note.value = m.note || ''; note.disabled = !edit;
      note.onchange = () => saveMember(m, { note: note.value.trim() || null });
      tr.querySelectorAll('[data-x]').forEach((inp) => {
        const key = inp.dataset.x; inp.value = (m.extra || {})[key] || ''; inp.disabled = !edit;
        inp.onchange = () => saveMember(m, { extra: { ...(m.extra || {}), [key]: inp.value.trim() } });
      });
      const rm = tr.querySelector('.list-rm'); rm.hidden = !edit;
      rm.onclick = () => removeMember(m);
      tb.appendChild(tr);
    });
    $('list-count').textContent = `Осіб у списку: ${members.length}` + (members.length ? ' · ' + MEMBER_ST.map((s) => `${s.toLowerCase()}: ${members.filter((m) => m.status === s).length}`).join(', ') : '')
      + (hiddenCnt ? ` · ще ${hiddenCnt} — поза вашими справами, вам не видно` : '');
    $('list-members').hidden = !members.length;
    renderPrintCols();
  }

  async function saveMember(m, patch) {
    const { error } = await db.from('person_list_members').update(patch).eq('list_id', current.id).eq('person_id', m.person_id);
    if (error) { console.error(error); toast('Не вдалося зберегти'); return; }
    Object.assign(m, patch); toast('Збережено');
    if ('status' in patch) $('list-count').textContent = `Осіб у списку: ${members.length} · ` + MEMBER_ST.map((s) => `${s.toLowerCase()}: ${members.filter((x) => x.status === s).length}`).join(', ');
  }
  async function removeMember(m) {
    if (!confirm(`Прибрати «${fio(m.person)}» зі списку? Картка в реєстрі залишиться.`)) return;
    const { error } = await db.from('person_list_members').delete().eq('list_id', current.id).eq('person_id', m.person_id);
    if (error) { console.error(error); toast('Не вдалося прибрати'); return; }
    members = members.filter((x) => x !== m); renderMembers();
  }

  // пошук людей у реєстрі й додавання
  async function searchPeople() {
    const q = $('list-add-q').value.trim().replace(/[,()%*\\]/g, ' ').trim();
    const box = $('list-add-res'); box.innerHTML = '';
    if (q.length < 3) return;
    let query = db.from('persons').select('id, last_name, first_name, patronymic, birth_date, military_status, death_date, phone');
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 3 && words.every((w) => !/\d/.test(w))) {
      // кілька слів — на різних частинах ПІБ однієї людини; точний збіг має пріоритет
      query = query.or(Persons.namesOr(words, (await Persons.countNames(words, true)) > 0));
    } else words.forEach((w) => { query = query.or(`last_name.ilike.%${w}%,first_name.ilike.%${w}%,patronymic.ilike.%${w}%`); });
    const { data, error } = await query.order('last_name').limit(15);
    if (error) { console.error(error); return; }
    const inList = new Set(members.map((m) => m.person_id));
    if (!data.length) { box.innerHTML = '<p class="muted">Нікого не знайдено.</p>'; return; }
    data.forEach((p) => {
      const row = document.createElement('div'); row.className = 'list-res';
      row.innerHTML = '<span><b></b> <span class="muted"></span></span> <button type="button" class="btn-secondary btn-small"></button>';
      row.querySelector('b').textContent = fio(p);
      row.querySelector('.muted').textContent = [fmt(p.birth_date), p.military_status, p.death_date ? 'загибель ' + fmt(p.death_date) : ''].filter(Boolean).join(' · ');
      const b = row.querySelector('button');
      b.textContent = inList.has(p.id) ? 'уже у списку' : '+ Додати'; b.disabled = inList.has(p.id);
      b.onclick = async () => { b.disabled = true; if (await addIds(current.id, [p.id])) { b.textContent = 'додано ✓'; await loadMembers(); } else b.disabled = false; };
      box.appendChild(row);
    });
  }

  // додати людей до списку (повтори ігноруються)
  async function addIds(listId, ids) {
    for (let i = 0; i < ids.length; i += 500) {
      const { error } = await db.from('person_list_members')
        .upsert(ids.slice(i, i + 500).map((person_id) => ({ list_id: listId, person_id })), { onConflict: 'list_id,person_id', ignoreDuplicates: true });
      if (error) { console.error(error); toast('Не вдалося додати'); return false; }
    }
    return true;
  }

  // ---------- Друк і Excel ----------
  function renderPrintCols() {
    const box = $('list-cols'); const saved = (() => { try { return JSON.parse(localStorage.getItem('list_cols_' + current.id) || 'null'); } catch { return null; } })();
    box.innerHTML = '';
    columnsAll().forEach(([key, label]) => {
      const l = document.createElement('label'); l.className = 'check';
      l.innerHTML = '<input type="checkbox"> <span></span>'; l.firstChild.value = key; l.lastChild.textContent = label;
      l.firstChild.checked = saved ? saved.includes(key) : !['phone', 'cell', 'mstat'].includes(key);
      l.firstChild.onchange = () => { try { localStorage.setItem('list_cols_' + current.id, JSON.stringify(pickedCols().map((c) => c[0]))); } catch { /* ок */ } };
      box.appendChild(l);
    });
  }
  const pickedCols = () => { const on = new Set([...$('list-cols').querySelectorAll('input:checked')].map((i) => i.value)); return columnsAll().filter(([k]) => on.has(k)); };

  function printList() {
    if (!members.length) { toast('У списку ще нікого немає'); return; }
    const cols = pickedCols(); const l = current;
    const area = $('print-area');
    area.innerHTML = `<h1></h1><p class="print-sub"></p><table><thead><tr><th>№</th>${cols.map(([, h]) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
      members.map((m, i) => `<tr><td>${i + 1}</td>${cols.map(([, , f]) => `<td>${esc(f(m))}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <p class="print-sign">Склав(ла): ____________________ ${esc(Persons.ctx().operator.full_name || '')}  ·  ${new Date().toLocaleDateString('uk-UA')}</p>`;
    area.querySelector('h1').textContent = l.name;
    area.querySelector('.print-sub').textContent = [l.description, l.due_date && `Термін: ${fmt(l.due_date)}`, `Осіб: ${members.length}`].filter(Boolean).join(' · ');
    document.body.classList.add('print-mode');
    logExport('Друк', members.length);
    setTimeout(() => window.print(), 50);
  }

  function excel() {
    if (!members.length) { toast('У списку ще нікого немає'); return; }
    const cols = pickedCols();
    const aoa = [['№', ...cols.map(([, h]) => h)], ...members.map((m, i) => [i + 1, ...cols.map(([, , f]) => f(m))])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 5 }, ...cols.map(([k]) => ({ wch: k === 'fio' || k === 'kin' || k === 'note' ? 34 : 16 }))];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Список');
    const safe = current.name.replace(/[\\/?*[\]:"<>|]/g, ' ').slice(0, 60).trim() || 'spysok';
    XLSX.writeFile(wb, `${safe}.xlsx`);
    logExport('Excel', members.length);
  }
  // кожне вивантаження й друк — у журнал (адміністратор бачить у «Співробітниках»)
  function logExport(kind, n) {
    db.from('export_log').insert({ kind, channel: 'Список', row_count: n, filters_note: 'Список: ' + current.name }).then(({ error }) => { if (error) console.warn('export_log', error); });
  }

  // ---------- «➕ До списку» з картки особи або з «Осіб» (усі за фільтром) ----------
  let pending = null;   // { ids: [...] } або { filter: true }
  async function addDialog(opts) {
    pending = opts;
    const { data, error } = await db.from('person_lists').select('id, name, status').neq('status', 'Закрито').order('created_at', { ascending: false });
    if (error) { console.error(error); toast('Не вдалося завантажити списки'); return; }
    const sel = $('tolist-select'); sel.innerHTML = '';
    (data || []).forEach((l) => sel.add(new Option(l.name, l.id)));
    sel.add(new Option('+ Новий список…', 'new'));
    $('tolist-what').textContent = opts.label;
    $('tolist-dialog').showModal();
  }
  async function submitToList(e) {
    e.preventDefault();
    const btn = $('tolist-form').querySelector('button[type="submit"]'); if (btn.disabled) return; btn.disabled = true;
    try {
      let listId = $('tolist-select').value;
      if (listId === 'new') {
        const name = prompt('Назва нового списку:'); if (!name || !name.trim()) return;
        const { data, error } = await db.from('person_lists').insert({ name: name.trim(), owner_id: me }).select('id').single();
        if (error) { console.error(error); toast('Не вдалося створити список'); return; }
        listId = data.id;
      }
      let ids = pending.ids || [];
      if (pending.filter) {
        ids = [];
        for (let from = 0; ; from += 1000) {
          let { query: q } = await Persons.buildQuery('id');
          const { data, error } = await q.order('id').range(from, from + 999);
          if (error) { console.error(error); toast('Не вдалося отримати людей за фільтром'); return; }
          ids.push(...data.map((x) => x.id)); if (data.length < 1000 || ids.length >= 5000) break;
        }
        if (ids.length >= 5000 && !confirm('За фільтром понад 5000 осіб — додати перші 5000?')) return;
      }
      if (!ids.length) { toast('Нікого додавати'); return; }
      if (await addIds(Number(listId), ids.slice(0, 5000))) {
        $('tolist-dialog').close(); toast(`Додано до списку: ${Math.min(ids.length, 5000)} (хто вже був — без повтору)`);
        if (pending.after) pending.after();
      }
    } finally { btn.disabled = false; }
  }

  // У картці особи: в яких списках людина є
  async function forPerson(personId) {
    if (!db || !(window.ACCESS && window.ACCESS.lists)) return [];
    const { data } = await db.from('person_list_members').select('status, list:person_lists(id, name)').eq('person_id', personId);
    return (data || []).filter((x) => x.list);
  }

  return { init, load, addDialog, forPerson };
})();
