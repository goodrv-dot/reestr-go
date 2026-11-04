// АВТОМАТИЧНО з map.js (tools/build-legacy.mjs) — не редагувати вручну
window.BurialMap = /* @__PURE__ */ (() => {
  let db = null, map = null, layer = null, loading = null, data = null, wantFocus = null;
  const markers = /* @__PURE__ */ new Map();
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const PFX = { C: "с.", X: "с-ще", M: "м.", K: "м." };
  function init(client) {
    db = client;
  }
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((ok, fail) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "vendor/leaflet-1.9.4/leaflet.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "vendor/leaflet-1.9.4/leaflet.js";
      s.onload = ok;
      s.onerror = fail;
      document.head.appendChild(s);
    });
    return loading;
  }
  async function fetchData() {
    const { data: rows, error } = await db.from("cases").select("journal_id, module, person:persons!cases_person_id_fkey!inner(id, last_name, first_name, patronymic, burial_place, burial_katottg)").not("person.burial_place", "is", null).limit(5e3);
    if (error) throw error;
    const withPlace = (rows || []).filter((r) => r.person && String(r.person.burial_place || "").trim());
    const codes = [...new Set(withPlace.map((r) => r.person.burial_katottg).filter(Boolean))];
    const geo = /* @__PURE__ */ new Map(), names = /* @__PURE__ */ new Map();
    for (let i = 0; i < codes.length; i += 150) {
      const part = codes.slice(i, i + 150);
      const [g, k] = await Promise.all([
        db.from("katottg_geo").select("code, lat, lon").eq("status", "ok").in("code", part),
        db.from("katottg").select("code, name, cat, raion, oblast").in("code", part)
      ]);
      if (g.error) throw g.error;
      if (k.error) throw k.error;
      (g.data || []).forEach((x) => geo.set(x.code, x));
      (k.data || []).forEach((x) => names.set(x.code, x));
    }
    const places = /* @__PURE__ */ new Map();
    let noGeo = 0;
    withPlace.forEach((r) => {
      const c = r.person.burial_katottg;
      const g = c && geo.get(c);
      if (!g) {
        noGeo++;
        return;
      }
      if (!places.has(c)) places.set(c, { code: c, lat: g.lat, lon: g.lon, k: names.get(c), people: [] });
      places.get(c).people.push(r);
    });
    return { places: [...places.values()], total: withPlace.length, noGeo };
  }
  function placeTitle(k) {
    if (!k) return "";
    if (k.cat === "K") return "м. " + k.name;
    return `${PFX[k.cat] || ""} ${k.name}, ${k.raion} р-н, ${k.oblast}${/^Автономна/.test(k.oblast) ? "" : " обл."}`;
  }
  function popup(p) {
    const list = p.people.slice().sort((a, b) => (a.person.last_name || "").localeCompare(b.person.last_name || "", "uk")).map((r) => `<li><a href="?case=${encodeURIComponent(r.journal_id)}" data-jid="${esc(r.journal_id)}">${esc([r.person.last_name, r.person.first_name, r.person.patronymic].filter(Boolean).join(" "))}</a> <span class="muted">${esc(r.journal_id)}</span></li>`).join("");
    return `<div class="bm-pop"><b>${esc(placeTitle(p.k))}</b><div class="muted">Поховано: ${p.people.length}</div><ol>${list}</ol></div>`;
  }
  function draw() {
    layer.clearLayers();
    markers.clear();
    const bounds = [];
    data.places.forEach((p) => {
      const n = p.people.length;
      const m = L.circleMarker([p.lat, p.lon], { radius: Math.min(26, 6 + 3 * Math.sqrt(n)), color: "#7a1f1f", weight: 1.5, fillColor: "#b3261e", fillOpacity: 0.55 });
      m.bindTooltip(`${placeTitle(p.k)} — ${n}`);
      m.bindPopup(() => popup(p), { maxWidth: 340, maxHeight: 320 });
      m.addTo(layer);
      bounds.push([p.lat, p.lon]);
      markers.set(p.code, m);
    });
    const shown = data.total - data.noGeo;
    $("bm-sum").textContent = `На карті: ${shown} з ${data.total} поховань у ${data.places.length} населених пунктах.` + (data.noGeo ? ` Без точки на карті: ${data.noGeo} — місце поховання не вдалося однозначно визначити (див. список «Поховання — уточнити місце»).` : "");
    if (wantFocus && markers.has(wantFocus)) {
      const mk = markers.get(wantFocus);
      map.setView(mk.getLatLng(), 11);
      mk.openPopup();
      map.__fitted = true;
    } else if (bounds.length && !map.__fitted) {
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 9 });
      map.__fitted = true;
    }
    wantFocus = null;
  }
  function focus(code) {
    wantFocus = code;
    document.querySelector('.tab[data-tab="burialmap"]').click();
  }
  function placeLine(person) {
    const el = document.createElement("p");
    el.className = "bm-line";
    if (!String(person.burial_place || "").trim()) return el;
    if (!person.burial_katottg) {
      el.classList.add("is-warn");
      el.textContent = "⚠ Населений пункт не визначено — напишіть так: «с. Назва, Назва р-н, Назва обл.» (кладовище — далі після коми). Тоді поховання з’явиться на карті.";
      return el;
    }
    el.textContent = "📍 …";
    db.from("katottg").select("code, name, cat, raion, oblast").eq("code", person.burial_katottg).maybeSingle().then(({ data: k }) => {
      el.textContent = "📍 " + (k ? placeTitle(k) : "визначено") + " ";
      const a = document.createElement("a");
      a.href = "#";
      a.className = "btn-link";
      a.textContent = "Показати на карті";
      a.onclick = (e) => {
        e.preventDefault();
        focus(person.burial_katottg);
      };
      el.appendChild(a);
    });
    return el;
  }
  async function load() {
    $("bm-sum").textContent = "Завантаження…";
    try {
      await loadLeaflet();
      if (!map) {
        map = L.map("bm-map", { zoomControl: true }).setView([48.6, 31.3], 6);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
        layer = L.layerGroup().addTo(map);
        $("bm-map").addEventListener("click", (e) => {
          const a = e.target.closest("a[data-jid]");
          if (!a) return;
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          document.querySelector('.tab[data-tab="cabinet"]').click();
          Cabinet.openByJournal(a.dataset.jid);
        });
      }
      setTimeout(() => map.invalidateSize(), 50);
      try {
        await db.rpc("geo_collect");
      } catch (e) {
      }
      data = await fetchData();
      draw();
    } catch (e) {
      console.error(e);
      $("bm-sum").textContent = "Не вдалося завантажити карту. Перевірте інтернет і натисніть «⟳ Оновити».";
    }
  }
  return { init, load, focus, placeLine };
})();
