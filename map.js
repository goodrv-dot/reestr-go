// ============================================================
// Вкладка «Карта поховань» + у справі: де поховано, маршрут для водія.
//  • Кружок — населений пункт (КАТОТТГ → координати з OpenStreetMap), число — скільки поховано.
//  • Синя точка — точне місце поховання (ставить адміністратор: перетягнути маркер або вставити координати з Google Maps).
//  • Маршрут — від точки виїзду осередку (або іншої адреси) до місця поховання: км і час (OSRM, OpenStreetMap),
//    кнопка «Маршрут» відкриває Google Maps із прокладеним маршрутом, «Скопіювати для водія» — готовий текст.
// Leaflet підвантажується лише при першому відкритті карти.
// ============================================================
window.BurialMap = (() => {
  let db = null, map = null, layer = null, exactLayer = null, osm = null, sat = null, loading = null, data = null;
  let wantFocus = null, wantEdit = null, editMarker = null, cellsCache = null;
  const markers = new Map();
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PFX = { C: 'с.', X: 'с-ще', M: 'м.', K: 'м.' };
  const isAdmin = () => !!(window.ACCESS && window.ACCESS.admin);
  const toast = (t) => (window.Persons && Persons.toast ? Persons.toast(t) : alert(t));
  const fio = (p) => [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');
  const fix = (x) => Number(x).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  const gmaps = (o, d) => 'https://www.google.com/maps/dir/?api=1' + (o ? `&origin=${fix(o.lat)},${fix(o.lon)}` : '') + `&destination=${fix(d.lat)},${fix(d.lon)}&travelmode=driving`;

  function init(client) { db = client; }
  // карта поховань живе на «Дашборді» (показник «Карта поховань»)
  const openMap = () => { if (window.Dashboard && Dashboard.showBurials) Dashboard.showBurials(); };

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((ok, fail) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'vendor/leaflet-1.9.4/leaflet.css'; document.head.appendChild(css);
      const s = document.createElement('script'); s.src = 'vendor/leaflet-1.9.4/leaflet.js';
      s.onload = () => { L.Icon.Default.imagePath = 'vendor/leaflet-1.9.4/images/'; ok(); }; s.onerror = fail; document.head.appendChild(s);
    });
    return loading;
  }

  // «50.4501, 30.5234», посилання Google Maps (…/@50.45,30.52,17z, …!3d50.45!4d30.52, ?q=50.45,30.52)
  function parseCoords(t) {
    const s = String(t || '').trim(); let m;
    if ((m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/))) return { lat: +m[1], lon: +m[2] };
    if ((m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/))) return { lat: +m[1], lon: +m[2] };
    if ((m = s.match(/[?&](?:q|query|ll|destination|daddr)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i))) return { lat: +m[1], lon: +m[2] };
    if ((m = s.match(/(-?\d{1,2}\.\d{3,})\s*[,;\s]\s*(-?\d{1,2}\.\d{3,})/))) return { lat: +m[1], lon: +m[2] };
    return null;
  }
  const inUa = (c) => c && c.lat >= 43 && c.lat <= 53 && c.lon >= 21 && c.lon <= 41;

  async function fetchData() {
    // усі поховання — для всіх співробітників (сервер віддає лише потрібне карті; can_open — чи можна відкрити справу)
    const { data: raw, error } = await db.rpc('burial_map_data');
    if (error) throw error;
    const rows = (raw || []).map((x) => ({ journal_id: x.journal_id, module: x.module, cell_id: x.cell_id, can_open: x.can_open,
      person: { id: x.person_id, last_name: x.last_name, first_name: x.first_name, patronymic: x.patronymic, burial_place: x.burial_place,
        burial_katottg: x.burial_katottg, burial_lat: x.burial_lat, burial_lon: x.burial_lon } }));
    const withPlace = (rows || []).filter((r) => r.person && String(r.person.burial_place || '').trim());
    const codes = [...new Set(withPlace.map((r) => r.person.burial_katottg).filter(Boolean))];
    const geo = new Map(), names = new Map();
    for (let i = 0; i < codes.length; i += 150) {
      const part = codes.slice(i, i + 150);
      const [g, k] = await Promise.all([
        db.from('katottg_geo').select('code, lat, lon').eq('status', 'ok').in('code', part),
        db.from('katottg').select('code, name, cat, raion, oblast').in('code', part)]);
      if (g.error) throw g.error; if (k.error) throw k.error;
      (g.data || []).forEach((x) => geo.set(x.code, x));
      (k.data || []).forEach((x) => names.set(x.code, x));
    }
    const places = new Map(); let noGeo = 0; const exact = [];
    withPlace.forEach((r) => {
      if (r.person.burial_lat != null) exact.push(r);
      const c = r.person.burial_katottg; const g = c && geo.get(c);
      if (!g) { if (r.person.burial_lat == null) noGeo++; return; }
      if (!places.has(c)) places.set(c, { code: c, lat: g.lat, lon: g.lon, k: names.get(c), people: [] });
      places.get(c).people.push(r);
    });
    return { places: [...places.values()], exact, total: withPlace.length, noGeo, geo, names };
  }

  function placeTitle(k) {
    if (!k) return '';
    if (k.cat === 'K') return 'м. ' + k.name;
    return `${PFX[k.cat] || ''} ${k.name}, ${k.raion} р-н, ${k.oblast}${/^Автономна/.test(k.oblast) ? '' : ' обл.'}`;
  }

  const caseLink = (r) => (r.can_open === false ? `<span>${esc(fio(r.person))}</span>`
    : `<a href="?case=${encodeURIComponent(r.journal_id)}" data-jid="${esc(r.journal_id)}">${esc(fio(r.person))}</a>`) + ` <span class="muted">${esc(r.journal_id)}</span>`;
  function popup(p) {
    const list = p.people.slice().sort((a, b) => (a.person.last_name || '').localeCompare(b.person.last_name || '', 'uk'))
      .map((r) => `<li>${caseLink(r)}</li>`).join('');
    return `<div class="bm-pop"><b>${esc(placeTitle(p.k))}</b><div class="muted">Поховано: ${p.people.length}</div><ol>${list}</ol></div>`;
  }

  function draw() {
    layer.clearLayers(); exactLayer.clearLayers(); markers.clear();
    const bounds = [];
    data.places.forEach((p) => {
      const n = p.people.length;
      const m = L.circleMarker([p.lat, p.lon], { radius: Math.min(26, 6 + 3 * Math.sqrt(n)), color: '#7a1f1f', weight: 1.5, fillColor: '#b3261e', fillOpacity: 0.55 });
      m.bindTooltip(`${placeTitle(p.k)} — ${n}`);
      m.bindPopup(() => popup(p), { maxWidth: 340, maxHeight: 320 });
      m.addTo(layer); bounds.push([p.lat, p.lon]); markers.set(p.code, m);
    });
    const shown = data.total - data.noGeo;
    $('bm-sum').textContent = `На карті: ${shown} з ${data.total} поховань у ${data.places.length} населених пунктах` +
      '.' +
      (data.noGeo ? ` Без точки на карті: ${data.noGeo} — місце поховання не вдалося однозначно визначити (див. список «Поховання — уточнити місце»).` : '');
    if (wantFocus && wantFocus.exact) {
      // перехід зі справи: тимчасова мітка лише цього поховання (на загальній карті точних точок немає)
      const x = wantFocus.exact;
      const mk = L.marker([x.lat, x.lon]).addTo(exactLayer).bindPopup(`<div class="bm-pop"><b>🎯 ${esc(x.title)}</b><div class="muted">${fix(x.lat)}, ${fix(x.lon)}</div></div>`);
      map.setView([x.lat, x.lon], 16); mk.openPopup(); map.__fitted = true;
    } else if (wantFocus && markers.has(wantFocus.code)) {
      const mk = markers.get(wantFocus.code); map.setView(mk.getLatLng(), 11); mk.openPopup(); map.__fitted = true;
    } else if (bounds.length && !map.__fitted) { map.fitBounds(bounds, { padding: [20, 20], maxZoom: 9 }); map.__fitted = true; }
    wantFocus = null;
  }

  // ---------- уточнення точки (лише адміністратор) ----------
  function setSat(on) {
    if (on) { if (map.hasLayer(osm)) map.removeLayer(osm); if (!map.hasLayer(sat)) sat.addTo(map); }
    else { if (map.hasLayer(sat)) map.removeLayer(sat); if (!map.hasLayer(osm)) osm.addTo(map); }
  }
  function stopEdit() {
    if (editMarker) { map.removeLayer(editMarker); editMarker = null; }
    $('bm-edit').hidden = true;
    if (map) setSat(false);   // після уточнення — знову звичайна карта
  }
  // what: { title, start:{lat,lon}, zoom, save(lat,lon) → Promise<bool>, clear?() → Promise<bool> }
  function startEdit(what) {
    stopEdit();
    const box = $('bm-edit'); box.hidden = false;
    $('bm-edit-title').textContent = what.title;
    $('bm-edit-paste').value = '';
    $('bm-edit-clear').hidden = !what.clear;
    setSat(true);
    editMarker = L.marker([what.start.lat, what.start.lon], { draggable: true, autoPan: true }).addTo(map);
    map.setView([what.start.lat, what.start.lon], what.zoom || 16);
    const show = () => { const p = editMarker.getLatLng(); $('bm-edit-coords').textContent = `${fix(p.lat)}, ${fix(p.lng)}`; };
    editMarker.on('drag', show); show();
    map.off('click'); map.on('click', (e) => { if (editMarker) { editMarker.setLatLng(e.latlng); show(); } });
    $('bm-edit-apply').onclick = () => {
      const c = parseCoords($('bm-edit-paste').value);
      if (!inUa(c)) { toast('Не вдалося розпізнати координати в Україні. Скопіюйте з Google Maps числа на кшталт 50.4501, 30.5234'); return; }
      editMarker.setLatLng([c.lat, c.lon]); map.setView([c.lat, c.lon], 17); show();
    };
    $('bm-edit-cancel').onclick = () => { stopEdit(); map.off('click'); };
    $('bm-edit-save').onclick = async () => {
      const p = editMarker.getLatLng();
      if (await what.save(p.lat, p.lng)) { stopEdit(); map.off('click'); load(); }
    };
    $('bm-edit-clear').onclick = async () => { if (what.clear && confirm('Прибрати точну точку? Залишиться лише населений пункт.') && await what.clear()) { stopEdit(); map.off('click'); load(); } };
  }

  // Уточнити точку поховання особи (виклик зі справи / картки)
  function editPoint(person, start, onSaved) {
    wantEdit = { person, start, onSaved };
    openMap();
  }
  async function savePoint(person, lat, lon, onSaved) {
    const { error } = await db.rpc('set_burial_point', { p_person: person.id, p_lat: lat, p_lon: lon });
    if (error) { console.error(error); toast('Не вдалося зберегти точку: ' + (error.message || '')); return false; }
    person.burial_lat = lat; person.burial_lon = lon;
    toast(lat == null ? 'Точну точку прибрано' : 'Точку поховання збережено');
    if (onSaved) onSaved();
    return true;
  }

  // ---------- точки виїзду осередків (адміністратор) ----------
  async function cells(force) {
    if (cellsCache && !force) return cellsCache;
    const { data: rows } = await db.from('cells').select('id, name, active, base_lat, base_lon, base_label').order('name');
    cellsCache = rows || [];
    return cellsCache;
  }
  async function renderBases() {
    const box = $('bm-bases'); if (!box) return;
    $('bm-bases-wrap').hidden = !isAdmin();
    if (!isAdmin()) return;
    const list = (await cells(true)).filter((c) => c.active !== false);
    box.innerHTML = '';
    list.forEach((c) => {
      const row = document.createElement('div'); row.className = 'bm-base';
      row.innerHTML = '<span class="bm-base-n"></span> <span class="muted bm-base-v"></span> <button type="button" class="btn-link">Задати на карті</button>';
      row.querySelector('.bm-base-n').textContent = c.name;
      row.querySelector('.bm-base-v').textContent = c.base_lat != null ? `${c.base_label ? c.base_label + ' · ' : ''}${fix(c.base_lat)}, ${fix(c.base_lon)}` : 'не задано';
      row.querySelector('button').onclick = () => {
        const start = c.base_lat != null ? { lat: c.base_lat, lon: c.base_lon } : map.getCenter() && { lat: map.getCenter().lat, lon: map.getCenter().lng };
        startEdit({ title: `Точка виїзду: ${c.name}`, start, zoom: c.base_lat != null ? 15 : 7,
          save: async (lat, lon) => {
            const label = prompt('Підпис точки виїзду (напр. «Львів, офіс»):', c.base_label || c.name);
            const { error } = await db.from('cells').update({ base_lat: lat, base_lon: lon, base_label: (label || '').trim() || null }).eq('id', c.id);
            if (error) { console.error(error); toast('Не вдалося зберегти'); return false; }
            toast('Точку виїзду збережено'); cellsCache = null; renderBases(); return true;
          } });
      };
      box.appendChild(row);
    });
  }

  // ---------- маршрут ----------
  async function route(o, d) {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${fix(o.lon)},${fix(o.lat)};${fix(d.lon)},${fix(d.lat)}?overview=false`);
    const j = await r.json();
    if (j.code !== 'Ok' || !j.routes || !j.routes[0]) throw new Error(j.code || 'route');
    return { km: j.routes[0].distance / 1000, min: j.routes[0].duration / 60 };
  }
  const fmtRoute = (x) => { const h = Math.floor(x.min / 60), mm = Math.round(x.min % 60); return `≈ ${Math.round(x.km).toLocaleString('uk-UA')} км, ~${h ? h + ' год ' : ''}${mm} хв`; };
  async function geocode(q) {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ua&accept-language=uk&q=' + encodeURIComponent(q));
    const j = await r.json();
    return j && j[0] ? { lat: +j[0].lat, lon: +j[0].lon, label: j[0].display_name.split(',').slice(0, 2).join(',') } : null;
  }

  // Блок під полем «Місце поховання» (справа / картка особи):
  // 📍 населений пункт · 🎯 точна точка · Звідки → км/час · 🧭 Маршрут · 📋 Для водія · ✋ Уточнити (адмін)
  function placeLine(person, ctx = {}) {
    const el = document.createElement('div'); el.className = 'bm-line';
    if (!String(person.burial_place || '').trim()) return el;
    const exact = person.burial_lat != null;
    if (!person.burial_katottg && !exact) {
      el.classList.add('is-warn');
      el.textContent = '⚠ Населений пункт не визначено — напишіть так: «с. Назва, Назва р-н, Назва обл.» (кладовище — далі після коми). Тоді поховання з’явиться на карті.';
      if (isAdmin()) el.appendChild(document.createTextNode(' Або поставте точку вручну: '));
    }
    const head = document.createElement('div'); el.appendChild(head);
    let dest = exact ? { lat: person.burial_lat, lon: person.burial_lon } : null, placeName = '';
    const tools = document.createElement('div'); tools.className = 'bm-tools'; el.appendChild(tools);

    const build = () => {
      head.textContent = '';
      if (person.burial_katottg || placeName) head.append('📍 ' + (placeName || 'визначено') + ' ');
      if (exact) { const s = document.createElement('span'); s.className = 'bm-exact'; s.textContent = `🎯 точна точка ${fix(person.burial_lat)}, ${fix(person.burial_lon)} `; head.append(s); }
      else if (dest) { const s = document.createElement('span'); s.className = 'muted'; s.textContent = '(точка — центр населеного пункту) '; head.append(s); }
      if (dest && !ctx.inMap) {
        const a = document.createElement('a'); a.href = '#'; a.className = 'btn-link'; a.textContent = 'Показати на карті';
        a.onclick = (e) => { e.preventDefault(); wantFocus = { code: person.burial_katottg, exact: exact ? { lat: person.burial_lat, lon: person.burial_lon, title: fio(person) } : null }; openMap(); };
        head.append(a);
      }
      if (isAdmin()) {
        const b = document.createElement('a'); b.href = '#'; b.className = 'btn-link'; b.textContent = exact ? ' ✋ Змінити точку' : ' ✋ Уточнити точку';
        b.onclick = (e) => { e.preventDefault(); editPoint(person, dest || { lat: 48.6, lon: 31.3 }, ctx.onChange); };
        head.append(' · ', b);
      }
      if (!dest) return;
      // маршрут
      tools.innerHTML = `<label class="bm-from">🚗 Звідки: <select></select></label> <input class="bm-other" placeholder="місто або адреса" hidden>
        <span class="bm-km muted"></span>
        <a class="btn-small btn-secondary bm-go" target="_blank" rel="noopener">🧭 Маршрут</a>
        <button type="button" class="btn-small btn-secondary bm-copy">📋 Скопіювати для водія</button>`;
      const sel = tools.querySelector('select'), other = tools.querySelector('.bm-other'), km = tools.querySelector('.bm-km'), go = tools.querySelector('.bm-go');
      let origin = null, last = null;
      const upd = async () => {
        go.href = gmaps(origin, dest); last = null; km.textContent = '';
        if (!origin) return;
        km.textContent = 'рахую…';
        try { last = await route(origin, dest); km.textContent = fmtRoute(last); } catch (e) { km.textContent = 'км не пораховано (немає зв’язку з маршрутизатором)'; }
      };
      cells().then((list) => {
        const withBase = list.filter((c) => c.base_lat != null);
        sel.innerHTML = withBase.map((c) => `<option value="${c.id}">${esc(c.base_label || c.name)}</option>`).join('') +
          '<option value="other">Інша адреса…</option><option value="">— від мого місця (Google визначить сам)</option>';
        const def = withBase.find((c) => c.id === ctx.cellId) || withBase[0];
        sel.value = def ? String(def.id) : '';
        const pick = () => {
          other.hidden = sel.value !== 'other';
          if (sel.value === 'other') { origin = null; upd(); other.focus(); return; }
          const c = withBase.find((x) => String(x.id) === sel.value);
          origin = c ? { lat: c.base_lat, lon: c.base_lon, label: c.base_label || c.name } : null; upd();
        };
        sel.onchange = pick; pick();
      });
      other.onchange = async () => {
        const q = other.value.trim(); if (!q) return;
        km.textContent = 'шукаю…';
        try { origin = await geocode(q); } catch (e) { origin = null; }
        if (!origin) { km.textContent = 'адресу не знайдено'; return; }
        origin.label = q; upd();
      };
      tools.querySelector('.bm-copy').onclick = async () => {
        const lines = [
          `Поховання: ${fio(person)}${ctx.journalId ? ` (справа ${ctx.journalId})` : ''}`,
          String(person.burial_place || '').trim(),
          `Координати: ${fix(dest.lat)}, ${fix(dest.lon)}${exact ? '' : ' (приблизно — центр населеного пункту)'}`,
          origin && last ? `Маршрут: ${origin.label} → ${fmtRoute(last)}` : (origin ? `Звідки: ${origin.label}` : ''),
          `🧭 ${gmaps(origin, dest)}`].filter(Boolean);
        try { await navigator.clipboard.writeText(lines.join('\n')); toast('Скопійовано — вставте у Viber / Telegram'); }
        catch (e) { prompt('Скопіюйте текст:', lines.join(' | ')); }
      };
    };

    if (person.burial_katottg) {
      Promise.all([
        db.from('katottg').select('code, name, cat, raion, oblast').eq('code', person.burial_katottg).maybeSingle(),
        db.from('katottg_geo').select('lat, lon, status').eq('code', person.burial_katottg).maybeSingle()]).then(([k, g]) => {
        placeName = k.data ? placeTitle(k.data) : '';
        if (!dest && g.data && g.data.status === 'ok') dest = { lat: g.data.lat, lon: g.data.lon };
        build();
      });
    } else build();
    return el;
  }

  async function load() {
    $('bm-sum').textContent = 'Завантаження…';
    try {
      await loadLeaflet();
      if (!map) {
        map = L.map('bm-map', { zoomControl: true }).setView([48.6, 31.3], 6);
        osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
        sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Супутник &copy; Esri, Maxar, Earthstar Geographics' });
        L.control.layers({ 'Карта': osm, 'Супутник': sat }, null, { position: 'topright' }).addTo(map);
        layer = L.layerGroup().addTo(map); exactLayer = L.layerGroup().addTo(map);
        // посилання у спливаючому вікні відкривають справу в кабінеті
        $('bm-map').addEventListener('click', (e) => {
          const a = e.target.closest('a[data-jid]'); if (!a) return;
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault(); document.querySelector('.tab[data-tab="cabinet"]').click(); Cabinet.openByJournal(a.dataset.jid);
        });
      }
      setTimeout(() => map.invalidateSize(), 50);
      try { await db.rpc('geo_collect'); } catch (e) { /* координати нових місць підтягнуться наступного разу */ }
      data = await fetchData();
      draw();
      renderBases();
      if (wantEdit && isAdmin()) {
        const w = wantEdit; wantEdit = null;
        startEdit({ title: `Точка поховання: ${fio(w.person)}`, start: w.start, zoom: w.person.burial_lat != null ? 18 : 15,
          save: (lat, lon) => savePoint(w.person, lat, lon, w.onSaved),
          clear: w.person.burial_lat != null ? () => savePoint(w.person, null, null, w.onSaved) : null });
      }
    } catch (e) {
      console.error(e);
      $('bm-sum').textContent = 'Не вдалося завантажити карту. Перевірте інтернет і натисніть «⟳ Оновити».';
    }
  }

  return { init, load, placeLine, parseCoords };
})();
