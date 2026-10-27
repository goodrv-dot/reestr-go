//@ Частина кабінету «Завантаження справ (повне й лише змін), довантаження завершених».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Завантаження ----------
  // Кілька завантажень можуть стартувати майже одночасно (вкладка + відновлення після F5) —
  // рахується лише найсвіжіше, старіші відкидаються, щоб список не задвоювався.
  let loadSeq = 0;
  // Закриті справи («Не беремо в роботу», «Архів», «Документи ✅») не вантажимо одразу — їх тисячі,
  // а працюють із відкритими. Довантажуємо, щойно знадобились: пошук, «Завершені», закритий статус, вибірка.
  let withClosed = false, closedTotal = 0, closedFor = '';
  // Економія трафіку: повністю справи вантажимо раз на 30 хв (або при зміні модуля / налаштувань),
  // а між тим — лише ті, що змінились (updated_at; база сама позначає справу зміненою при правці особи чи рідних)
  let lastFull = 0, syncAt = '', loadedKey = '', fullSeq = 0;
  const extraDone = new Set();   // які довантаження завершених справ уже зроблено (пошук, мітки)
  const CASE_SEL = '*, person:persons!cases_person_id_fkey(id, last_name, first_name, patronymic, military_status, death_date, burial_date, wounded, wound_date, birth_date, callsign, burial_place, military_unit_code, mp_unit_id, region_id, settlement, phone, comment, import_batch_id), case_values(stage_key, value)';
  async function fetchKin(pids) {
    const kin = new Map();
    const chunks = []; for (let i = 0; i < pids.length; i += 150) chunks.push(pids.slice(i, i + 150));
    for (let i = 0; i < chunks.length; i += 4) {
      const res = await Promise.all(chunks.slice(i, i + 4).map((part) => db.from('military_relations')
        .select('id, related_person_id, relation_degree, created_at, person:persons!military_relations_person_id_fkey(id, last_name, first_name, patronymic, phone, settlement)')
        .in('related_person_id', part).order('created_at')));
      res.forEach(({ data }) => (data || []).forEach((r) => { if (r.person) kin.set(r.related_person_id, [...(kin.get(r.related_person_id) || []), r]); }));
    }
    return kin;
  }
  function prep(c, kin) {
    c.vals = Object.fromEntries((c.case_values || []).map((v) => [v.stage_key, v.value]));
    c.kin = kin.get(c.person_id) || [];
    c.next = nextAction(c);
  }
  const maxUpd = (list, from) => list.reduce((m, c) => (c.updated_at && c.updated_at > m ? c.updated_at : m), from || '');
  // лише зміни з минулого разу (з запасом 2 хв); нічого не змінилось — майже порожня відповідь
  async function refresh() {
    const my = ++loadSeq;
    const since = new Date(Date.parse(syncAt) - 120000).toISOString();
    const { data, error } = await db.from('cases').select(CASE_SEL).eq('module', module).gt('updated_at', since).order('updated_at').limit(1000);
    if (error) { console.error(error); return; }
    if (my !== loadSeq) return;
    if (data.length >= 1000) return load({ full: true });
    const byId = new Map(cases.map((c) => [c.id, c]));
    const fresh = data.filter((c) => { const o = byId.get(c.id); return !o || o.updated_at !== c.updated_at; });
    syncAt = maxUpd(data, syncAt);
    if (!fresh.length) return;
    const kin = await fetchKin([...new Set(fresh.map((c) => c.person_id))]);
    if (my !== loadSeq) return;
    fresh.forEach((c) => {
      const o = byId.get(c.id);
      if (o) { Object.assign(o, c); prep(o, kin); return; }          // той самий об’єкт — відкрита справа не «відривається»
      if (isClosed(c) && !withClosed) return;                       // нова завершена — не тягнемо в список
      prep(c, kin); cases.push(c);
    });
    if ($('cab-case').hidden) render();
    badge();
  }
  async function load(opts = {}) {
    if (!opts.full && syncAt && loadedKey === module + '|' + (withClosed ? 1 : 0) && Date.now() - lastFull < 30 * 60 * 1000) return refresh();
    const my = ++loadSeq; fullSeq++;
    const A = acc();
    if (!MOD_UI[module] || !A['cab' + module]) module = MODS.find((m) => A['cab' + m]) || '200';
    document.querySelectorAll('.cab-mod').forEach((b) => { b.hidden = !A['cab' + b.dataset.m]; });
    $('cq-nocell-btn').hidden = false;   // справи без осередку бачать усі з доступом до кабінету (беруть у роботу за вказівкою адміна)
    keep('cab_module', module);
    document.querySelectorAll('.cab-mod').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === module)));
    $('cab-title').textContent = ui().title;
    $('cab-status-line').textContent = 'Завантажуємо…';
    $('cab-date-label').textContent = `Дата ${ui().dateWord}:`;
    $('cab-sort').querySelector('[value="date"]').textContent = `за датою ${ui().dateWord}`;
    const [d, st, ops] = await Promise.all([
      db.from('case_stage_defs').select('*').eq('module', module).eq('active', true).order('sort'),
      db.from('case_statuses').select('*').eq('module', module).order('sort'),
      db.from('operators').select('user_id, full_name, active').order('full_name')
    ]);
    if (my !== loadSeq) return;
    defs = d.data || []; statuses = st.data || [];
    staff = new Map((ops.data || []).map((o) => [o.user_id, o.full_name]));

    if (withClosed && closedFor !== module) withClosed = false;   // «закриті» довантажено для іншого модуля
    closedFor = module;
    const closedNames = statuses.filter((x) => x.closed).map((x) => x.name);
    const inList = `(${closedNames.map((n) => `"${n.replace(/"/g, '')}"`).join(',')})`;
    const skipClosed = !withClosed && closedNames.length;
    if (skipClosed) {
      const { count } = await db.from('cases').select('id', { count: 'exact', head: true }).eq('module', module).in('status', closedNames);
      closedTotal = count || 0;
    }
    const list = [];
    for (let from = 0; ; from += 1000) {
      let q = db.from('cases').select(CASE_SEL).eq('module', module);
      if (skipClosed) q = q.or(`status.is.null,status.not.in.${inList}`);
      const { data, error } = await q.order('journal_id').range(from, from + 999);
      if (error) { console.error(error); $('cab-status-line').textContent = 'Не вдалося завантажити справи.'; return; }
      if (my !== loadSeq) return;
      list.push(...data);
      if (data.length < 1000) break;
    }
    // родина: перший пов’язаний родич (отримувач)
    const kin = await fetchKin(list.map((c) => c.person_id));
    if (!skipClosed) closedTotal = 0;
    const sn = await db.from('case_seen').select('case_id, seen_at');
    // особисті кольорові мітки (кожен співробітник бачить лише свої)
    const mk = new Map();
    {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from('case_marks').select('case_id, colors').order('case_id').range(from, from + 999);
        if (error) { console.error(error); break; }
        (data || []).forEach((r) => mk.set(r.case_id, r.colors || []));
        if (!data || data.length < 1000) break;
      }
    }
    if (my !== loadSeq) return;
    marks = mk;
    cases = list;
    seen = new Map((sn.data || []).map((r) => [r.case_id, r.seen_at]));
    cases.forEach((c) => prep(c, kin));
    loadedKey = module + '|' + (withClosed ? 1 : 0); lastFull = Date.now(); syncAt = maxUpd(list) || new Date(0).toISOString(); extraDone.clear();
    fillFilters();
    $('cab-status-line').textContent = '';
    render();
    badge();
    if (returnTo) { const id = returnTo; returnTo = null; if (cases.some((c) => c.id === id)) openCase(id, true); }
  }

  // Найближча дія за правилами нагадувань
  // Завершені справи («Документи ✅», «Архів» — позначка closed у статусі): термінів і нагадувань немає
  const isClosed = (c) => statuses.some((s) => s.name === c.status && s.closed);
  function nextAction(c) {
    let best = null;
    if (isClosed(c)) return null;
    defs.filter((d) => d.remind_after && d.remind_days != null).forEach((d) => {
      if (c.vals[d.key]) return;                    // уже зроблено
      const base = c.vals[d.remind_after];
      if (!base || !/^\d{4}-\d{2}-\d{2}/.test(base)) return;
      const due = addDays(base.slice(0, 10), d.remind_days);
      if (!best || due < best.due) best = { key: d.key, kind: d.kind, label: d.label, due };
    });
    if (best) {
      best.days = Math.round((new Date(best.due + 'T00:00:00Z') - new Date(today() + 'T00:00:00Z')) / 86400000);   // <0 — прострочено
      best.overdue = best.days < 0;
      best.level = best.days < 0 ? 'over' : best.days <= 3 ? 'soon' : 'later';
    }
    return best;
  }
  const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
  const dueText = (x) => (x.days < 0 ? `прострочено на ${-x.days} ${plural(-x.days, 'день', 'дні', 'днів')}` : x.days === 0 ? 'сьогодні'
    : x.days <= 3 ? `залишилось ${x.days} ${plural(x.days, 'день', 'дні', 'днів')}` : `до ${fmt(x.due)}`);

