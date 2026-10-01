// ============================================================
// Дашборд: карта України по областях (дані реєстру)
// Враховує пошук, фільтри і сегмент з вкладки «Особи».
// ============================================================
window.Dashboard = (() => {
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const METRICS = {
    persons:  { label: 'Осіб',                    calc: () => 1 },
    children: { label: 'Дітей',                   calc: (p) => (p.children_ages || []).length },
    minors:   { label: 'Неповнолітніх дітей',     calc: (p) => (p.children_ages || []).filter((a) => a < 18).length },
    critical: { label: 'Карток з критичними позначками', calc: (p) => (p.critical_count > 0 ? 1 : 0) },
    burials:  { label: 'Поховань' }
  };
  const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
  const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
  let burials = null;       // [{month:'2026-09', region:'Одеська'}]
  let period = { from: '', to: '' };
  let metric = 'persons';
  let rows = [];
  let byRegion = new Map();   // назва області → значення
  let ready = false;
  // Області, які завжди показуємо у списку (навіть з нулем)
  const ALWAYS = ['Луганська', 'Автономна Республіка Крим'];
  const short = (n) => (n === 'Автономна Республіка Крим' ? 'АР Крим' : n);
  function fullList() {
    const list = [...byRegion.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'uk'));
    ALWAYS.forEach((n) => { if (!byRegion.has(n)) list.push([n, 0]); });
    return list;
  }

  function init() {
    if (ready) return;
    ready = true;
    document.querySelectorAll('.dash-metric').forEach((b) => b.addEventListener('click', () => {
      metric = b.dataset.m;
      document.querySelectorAll('.dash-metric').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (metric === 'burials' && !burials) loadBurials().then(render); else render();
    }));
    $('dash-png').addEventListener('click', downloadPng);
    $('dash-refresh').addEventListener('click', () => { burials = null; refresh(); });
    $('dash-reset').addEventListener('click', () => { Persons.resetAll(); refresh(); });
    $('dash-from').addEventListener('change', () => { period.from = $('dash-from').value; fixPeriod('from'); render(); });
    $('dash-to').addEventListener('change', () => { period.to = $('dash-to').value; fixPeriod('to'); render(); });
    $('dash-all').addEventListener('click', () => {
      const ms = burialMonths();
      period = { from: ms[0] || '', to: ms[ms.length - 1] || '' };
      render();
    });
    buildMap();
  }

  // ---------- Карта ----------
  function buildMap() {
    const svg = $('dash-map');
    svg.setAttribute('viewBox', UA_MAP.viewBox);
    const gR = document.createElementNS(NS, 'g');
    const gL = document.createElementNS(NS, 'g');
    gL.setAttribute('class', 'map-labels');
    UA_MAP.regions.forEach((r) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', r.d);
      p.setAttribute('class', 'map-region');
      p.dataset.name = r.name;
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'button');
      gR.appendChild(p);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', r.cx); t.setAttribute('y', r.cy);
      t.setAttribute('class', 'map-value');
      t.dataset.name = r.name;
      gL.appendChild(t);
    });
    UA_MAP.points.forEach((pt) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', pt.cx); c.setAttribute('cy', pt.cy); c.setAttribute('r', 13);
      c.setAttribute('class', 'map-region map-city');
      c.dataset.name = pt.name;
      c.setAttribute('tabindex', '0');
      c.setAttribute('role', 'button');
      gR.appendChild(c);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', pt.cx + 18); t.setAttribute('y', pt.cy);
      t.setAttribute('class', 'map-value map-city-value');
      t.dataset.name = pt.name;
      gL.appendChild(t);
    });
    svg.append(gR, gL);

    const tip = $('dash-tip');
    const showTip = (el, ev) => {
      const v = byRegion.get(el.dataset.name) || 0;
      tip.textContent = `${short(el.dataset.name)}: ${v}`;
      tip.hidden = false;
      const box = $('dash-map-wrap').getBoundingClientRect();
      const x = ev ? ev.clientX - box.left : el.getBoundingClientRect().left - box.left + 20;
      const y = ev ? ev.clientY - box.top : el.getBoundingClientRect().top - box.top;
      tip.style.left = Math.min(x + 14, box.width - 180) + 'px';
      tip.style.top = (y + 14) + 'px';
    };
    svg.addEventListener('mousemove', (e) => {
      const el = e.target.closest('.map-region');
      if (el) showTip(el, e); else tip.hidden = true;
    });
    svg.addEventListener('mouseleave', () => { tip.hidden = true; });
    svg.addEventListener('focusin', (e) => { const el = e.target.closest('.map-region'); if (el) showTip(el); });
    svg.addEventListener('focusout', () => { tip.hidden = true; });
    svg.addEventListener('click', (e) => { const el = e.target.closest('.map-region'); if (el) openRegion(el.dataset.name); });
    svg.addEventListener('keydown', (e) => {
      const el = e.target.closest('.map-region');
      if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openRegion(el.dataset.name); }
    });
  }

  // ---------- Дані ----------
  async function refresh() {
    init();
    $('dash-status').textContent = 'Рахуємо…';
    try {
      rows = [];
      for (let from = 0; ; from += 1000) {
        const { query } = await Persons.buildQuery('region_id, children_ages, critical_count');
        const { data, error } = await query.order('id').range(from, from + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      if (metric === 'burials') await loadBurials();
      $('dash-status').textContent = '';
      const cond = selectionText();
      $('dash-cond').textContent = cond.length ? 'Умови: ' + cond.join('; ') : 'Увесь реєстр (без фільтрів)';
      $('dash-reset').hidden = !Persons.hasSelection();
      render();
    } catch (e) {
      console.error(e);
      $('dash-status').textContent = 'Не вдалося завантажити дані. Спробуйте ще раз.';
    }
  }

  function selectionText() {
    const seg = window.Segments && Segments.label();
    const q = $('search').value.trim();
    return [...(seg ? [seg] : []), ...(q ? [`Пошук: ${q}`] : []), ...Filters.describe()];
  }

  function render() {
    const { regions } = Persons.ctx();
    const isBur = metric === 'burials';
    $('dash-burials').hidden = !isBur;
    $('dash-cond').hidden = isBur;
    $('dash-hint').hidden = isBur;
    byRegion = new Map();
    let total = 0, noRegion = 0, abroad = 0;
    if (isBur) {
      if (!burials) return;
      $('dash-from').value = period.from; $('dash-to').value = period.to;
      burials.forEach((b) => {
        if (period.from && b.month < period.from) return;
        if (period.to && b.month > period.to) return;
        total++;
        if (!b.region) { noRegion++; return; }
        byRegion.set(b.region, (byRegion.get(b.region) || 0) + 1);
      });
      renderMonths();
    } else {
      const calc = METRICS[metric].calc;
      rows.forEach((p) => {
        const v = calc(p);
        total += v;
        const name = regions.get(p.region_id);
        if (!name) { noRegion += v; return; }
        if (name === 'За кордоном') { abroad += v; return; }
        byRegion.set(name, (byRegion.get(name) || 0) + v);
      });
    }
    const max = Math.max(0, ...byRegion.values());

    // Заливка і числа
    document.querySelectorAll('#dash-map .map-region').forEach((el) => {
      const v = byRegion.get(el.dataset.name) || 0;
      el.style.fill = v ? color(v / (max || 1)) : '';
      el.classList.toggle('is-empty', !v);
      el.setAttribute('aria-label', `${el.dataset.name}: ${v}`);
    });
    document.querySelectorAll('#dash-map .map-value').forEach((t) => {
      const v = byRegion.get(t.dataset.name) || 0;
      t.textContent = v || '';
      t.classList.toggle('on-dark', !t.classList.contains('map-city-value') && v / (max || 1) > 0.55);
    });

    // Легенда
    $('dash-legend-max').textContent = max || 0;
    $('dash-legend-min').textContent = max ? 1 : 0;
    $('dash-title').textContent = isBur ? `Поховання: ${periodText()}` : `${METRICS[metric].label} по областях`;

    // Підсумки
    $('dash-total').textContent = total;
    $('dash-total-label').textContent = METRICS[metric].label.toLowerCase();
    $('dash-noregion').textContent = noRegion;
    $('dash-abroad').textContent = abroad;

    // Список
    const list = fullList();
    const ul = $('dash-list');
    ul.innerHTML = '';
    if (!byRegion.size) ul.innerHTML = '<li class="muted">Немає даних за цими умовами</li>';
    list.forEach(([name, v]) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dash-row' + (v ? '' : ' is-zero');
      btn.innerHTML = '<span class="dash-name"></span><span class="dash-bar"><i></i></span><b></b>';
      btn.querySelector('.dash-name').textContent = short(name);
      btn.querySelector('i').style.width = `${(v / (max || 1)) * 100}%`;
      btn.querySelector('i').style.background = color(v / (max || 1));
      btn.querySelector('b').textContent = v;
      btn.title = 'Відкрити список осіб цієї області';
      btn.addEventListener('click', () => openRegion(name));
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  // ---------- Поховання ----------
  async function loadBurials() {
    const { db, regions } = Persons.ctx();
    $('dash-status').textContent = 'Рахуємо поховання…';
    const cres = await db.from('cells').select('id, region_id');
    const cellRegion = new Map((cres.data || []).map((c) => [c.id, c.region_id]));
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('military_relations')
        .select('related_full_name, related_death_date, related_burial_date, persons!inner(id, region_id, cell_id)')
        .eq('related_status', 'Загиблий').not('related_burial_date', 'is', null)
        .order('id').range(from, from + 999);
      if (error) { console.error(error); $('dash-status').textContent = 'Не вдалося завантажити поховання.'; burials = []; return; }
      all.push(...data);
      if (data.length < 1000) break;
    }
    // Картки самих загиблих (коли родину не встановлено)
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('persons')
        .select('id, last_name, first_name, patronymic, death_date, burial_date, region_id, cell_id')
        .eq('military_status', 'Загиблий').not('burial_date', 'is', null)
        .order('id').range(from, from + 999);
      if (error) { console.error(error); break; }
      data.forEach((p) => all.push({
        related_full_name: [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' '),
        related_death_date: p.death_date, related_burial_date: p.burial_date,
        persons: { id: p.id, region_id: p.region_id, cell_id: p.cell_id }
      }));
      if (data.length < 1000) break;
    }
    const seen = new Map();
    burials = [];
    all.forEach((r) => {
      const key = (r.related_full_name || '').toLowerCase().replace(/\s+/g, ' ').trim() + '|' + (r.related_death_date || r.related_burial_date);
      if (seen.has(key)) { seen.get(key).personIds.push(r.persons.id); return; }   // ще один родич того ж загиблого
      const rid = cellRegion.get(r.persons.cell_id) || r.persons.region_id;
      const name = regions.get(rid);
      const item = { month: r.related_burial_date.slice(0, 7), region: name && name !== 'За кордоном' ? name : null, personIds: [r.persons.id] };
      seen.set(key, item);
      burials.push(item);
    });
    const ms = burialMonths();
    const last = ms[ms.length - 1] || new Date().toISOString().slice(0, 7);
    if (!period.from) period = { from: last, to: last };
    $('dash-status').textContent = burials.length ? '' : 'Ще немає загиблих з датою поховання. Повторно імпортуйте журнал «200» — дати поховання доповняться.';
  }

  function burialMonths() { return [...new Set((burials || []).map((b) => b.month))].sort(); }

  function fixPeriod(changed) {
    if (period.from && period.to && period.from > period.to) {
      if (changed === 'from') period.to = period.from; else period.from = period.to;
    }
  }

  function monthName(ym, short) {
    if (!ym) return '';
    const [y, m] = ym.split('-').map(Number);
    return `${(short ? MONTHS_SHORT : MONTHS)[m - 1]} ${short ? String(y).slice(2) : y}`;
  }
  function periodText() {
    if (!period.from && !period.to) return 'увесь час';
    if (period.from === period.to) return monthName(period.from);
    return `${monthName(period.from)} — ${monthName(period.to)}`;
  }

  // Стовпчики по місяцях: 12 місяців, що закінчуються обраним «по»
  function renderMonths() {
    const svg = $('dash-months');
    const end = period.to || burialMonths().slice(-1)[0] || new Date().toISOString().slice(0, 7);
    const months = [];
    let [y, m] = end.split('-').map(Number);
    for (let i = 0; i < 12; i++) { months.unshift(`${y}-${String(m).padStart(2, '0')}`); m--; if (!m) { m = 12; y--; } }
    const counts = months.map((mm) => burials.filter((b) => b.month === mm).length);
    const max = Math.max(1, ...counts);
    const W = 720, H = 190, padB = 34, padT = 22, bw = W / 12;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    months.forEach((mm, i) => {
      const v = counts[i];
      const h = (H - padB - padT) * (v / max);
      const sel = (!period.from || mm >= period.from) && (!period.to || mm <= period.to);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'mbar' + (sel ? ' is-sel' : ''));
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `${monthName(mm)}: ${v}`);
      g.innerHTML = `<rect x="${i * bw + 6}" y="${padT}" width="${bw - 12}" height="${H - padB - padT}" class="mbar-hit"/>
        <rect x="${i * bw + 10}" y="${H - padB - h}" width="${bw - 20}" height="${Math.max(h, v ? 2 : 0)}" rx="3" class="mbar-fill"/>
        <text x="${i * bw + bw / 2}" y="${H - padB - h - 6}" class="mbar-val">${v || ''}</text>
        <text x="${i * bw + bw / 2}" y="${H - 12}" class="mbar-lbl">${monthName(mm, true)}</text>`;
      const pick = () => { period = { from: mm, to: mm }; render(); };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      svg.appendChild(g);
    });
  }

  // Світло-бірюзовий → темно-синій
  function color(t) {
    const a = [214, 238, 232], b = [19, 60, 85];
    const k = 0.15 + 0.85 * Math.max(0, Math.min(1, t));
    const c = a.map((x, i) => Math.round(x + (b[i] - x) * k));
    return `rgb(${c.join(',')})`;
  }

  // Клік по області → «Особи» з фільтром області
  // (для поховань — саме родини загиблих, похованих у цьому періоді)
  function openRegion(name) {
    if (metric === 'burials') {
      const ids = [];
      let n = 0;
      (burials || []).forEach((b) => {
        if (b.region !== name) return;
        if (period.from && b.month < period.from) return;
        if (period.to && b.month > period.to) return;
        n++;
        ids.push(...b.personIds);
      });
      Persons.resetAll();
      Filters.setPreset(ids, `Поховання: ${periodText()}, ${name} — родини ${n} загиблих`);
      document.querySelector('.tab[data-tab="registry"]').click();
      Persons.toast(`Родини загиблих: ${name}, ${periodText()}`);
      return;
    }
    const { regions } = Persons.ctx();
    const id = [...regions].find(([, n]) => n === name)?.[0];
    if (!id) return;
    const st = Filters.getState();
    st.region_id = [String(id)];
    Filters.setState(st);
    document.querySelector('.tab[data-tab="registry"]').click();
    Persons.toast(`Фільтр: ${name}`);
  }

  // ---------- PNG ----------
  async function downloadPng() {
    const map = $('dash-map').cloneNode(true);
    const [vx, vy, vw, vh] = UA_MAP.viewBox.split(' ').map(Number);
    const list = fullList();
    const perCol = Math.ceil(list.length / 3) || 1;
    const W = 1400, mapH = Math.round(W * vh / vw), head = 150, listH = perCol * 30 + 30, foot = 50, H = head + mapH + listH + foot;
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    map.querySelectorAll('.map-region').forEach((el) => {
      el.setAttribute('fill', el.style.fill || '#e3e7ea');
      el.setAttribute('stroke', '#ffffff');
      el.setAttribute('stroke-width', el.tagName === 'circle' ? 3 : 1.5);
    });
    map.querySelectorAll('.map-value').forEach((t) => {
      t.setAttribute('font-size', '22'); t.setAttribute('font-weight', '700'); t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-family', 'Arial, sans-serif');
      t.setAttribute('fill', t.classList.contains('on-dark') ? '#ffffff' : '#16222e');
    });
    const inner = map.innerHTML;
    const cond = metric === 'burials'
      ? 'За осередком ГО (або областю родини), кожен загиблий один раз'
      : (selectionText().join('; ') || 'Увесь реєстр');
    const svg = `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="40" y="60" font-family="Arial, sans-serif" font-size="36" font-weight="700" fill="#16222e">${esc($('dash-title').textContent)}</text>
      <text x="40" y="98" font-family="Arial, sans-serif" font-size="20" fill="#5b6875">${esc(cond).slice(0, 140)}</text>
      <text x="40" y="128" font-family="Arial, sans-serif" font-size="20" fill="#5b6875">Усього: ${esc($('dash-total').textContent)} · ${new Date().toLocaleDateString('uk-UA')}</text>
      <svg x="20" y="${head}" width="${W - 40}" height="${mapH}" viewBox="${UA_MAP.viewBox}">${inner}</svg>
      ${list.map(([n, v], i) => `<text x="${40 + Math.floor(i / perCol) * 440}" y="${head + mapH + 30 + (i % perCol) * 30}" font-family="Arial, sans-serif" font-size="20" fill="#16222e">${esc(short(n))} — <tspan font-weight="700">${v}</tspan></text>`).join('')}
      <text x="40" y="${H - 22}" font-family="Arial, sans-serif" font-size="16" fill="#8a96a1">Реєстр ГО · межі областей © OpenStreetMap</text>
    </svg>`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = metric === 'burials'
        ? `pohovannia_${period.from || 'all'}_${period.to || 'all'}.png`
        : `karta_${metric}_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  return { refresh };
})();
