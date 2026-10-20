// АВТОМАТИЧНО з cabinet.js (tools/build-legacy.mjs) — не редагувати вручну
window.Cabinet = (() => {
  const $ = (id) => document.getElementById(id);
  let db = null, me = null, isAdmin = false;
  let module = "200";
  const keep = (k, v) => {
    try {
      if (v) sessionStorage.setItem(k, v);
      else sessionStorage.removeItem(k);
    } catch (e) {
    }
  };
  try {
    module = sessionStorage.getItem("cab_module") || module;
  } catch (e) {
  }
  let defs = [], statuses = [], staff = /* @__PURE__ */ new Map(), cases = [];
  let marks = /* @__PURE__ */ new Map();
  const MARK_COLORS = ["#d64545", "#e8912d", "#e3c13b", "#3f9a5a", "#3b7dd8"];
  const MARK_NAMES = ["червона", "помаранчева", "жовта", "зелена", "синя"];
  let current = null;
  let preset = null;
  let quick = "";
  let seen = /* @__PURE__ */ new Map();
  let returnTo = null;
  const acc = () => window.ACCESS || { admin: isAdmin, registry: true, cab200: true, cab300: true, cells: [] };
  const isNew = (c) => !!c.transferred_at && c.transferred_by !== me && !(seen.get(c.id) >= c.transferred_at);
  const MOD_UI = {
    "200": { title: "Кабінет 200 — супровід родин загиблих", short: "200", word: "загиблий", date: "burial_date", dateWord: "поховання", reg: "notice_date", exec: "виконавець", newTitle: "Нова справа 200 — загиблий" },
    "300": { title: "Кабінет 300 — супровід поранених", short: "300", word: "поранений", date: "wound_date", dateWord: "поранення", reg: "appeal_date", exec: "відповідальний", newTitle: "Нова справа 300 — поранений" },
    bzv: { title: "Зниклі безвісти", short: "БЗВ", word: "зниклий безвісти", val: "missing_date", dateWord: "зникнення", reg: "notice_date", exec: "виконавець", newTitle: "Нова справа — зниклий безвісти" },
    pol: { title: "Звільнені з полону", short: "Звільнені з полону", word: "звільнений з полону", val: "release_date", dateWord: "звільнення", reg: "release_date", exec: "відповідальний", newTitle: "Нова справа — звільнений з полону" },
    vet: { title: "Ветерани", short: "Ветерани", word: "ветеран", date: "birth_date", dateWord: "народження", reg: "", exec: "виконавець", newTitle: "Нова справа — ветеран" }
  };
  const MODS = Object.keys(MOD_UI);
  const ui = () => MOD_UI[module] || MOD_UI["200"];
  const dateOf = (c) => (ui().val ? (c.vals || {})[ui().val] : c.person[ui().date]) || null;
  const today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const fmt = (iso) => iso ? iso.slice(0, 10).split("-").reverse().join(".") : "";
  const fio = (p) => [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(" ");
  const STATUS_OVERRIDE = {};
  const statusColor = (name, fromDb) => STATUS_OVERRIDE[name] || fromDb || "#8a96a1";
  const inkFor = (hex) => {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
    const [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255];
    return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#3d2e00" : "#ffffff";
  };
  const addDays = (iso, n) => {
    const d = /* @__PURE__ */ new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  function init(client, userId, admin) {
    db = client;
    me = userId;
    isAdmin = admin;
    document.querySelectorAll(".cab-mod").forEach((b) => b.addEventListener("click", () => {
      module = b.dataset.m;
      preset = null;
      picked.clear();
      withClosed = false;
      clearFilters(true);
      load();
    }));
    $("cab-preset-clear").addEventListener("click", () => {
      preset = null;
      render();
    });
    const lb = $("cab-lists-btn");
    lb.hidden = !(window.ACCESS && window.ACCESS.lists);
    lb.addEventListener("click", () => {
      window.__listsFrom = "cabinet";
      document.querySelector('.tab[data-tab="lists"]').click();
    });
    try {
      $("cab-sort").value = localStorage.getItem("cab_sort") || "new";
    } catch (e) {
    }
    if (!$("cab-sort").value) $("cab-sort").value = "new";
    try {
      $("cab-pin").checked = localStorage.getItem("cab_pin") !== "0";
    } catch (e) {
    }
    $("cab-pin").addEventListener("change", () => {
      try {
        localStorage.setItem("cab_pin", $("cab-pin").checked ? "1" : "0");
      } catch (e) {
      }
      render();
    });
    $("cab-sort").addEventListener("change", () => {
      try {
        localStorage.setItem("cab_sort", $("cab-sort").value);
      } catch (e) {
      }
      render();
    });
    ["cab-search", "cab-status", "cab-exec", "cab-resp", "cab-mark", "cab-cell", "cab-from", "cab-to"].forEach((id) => $(id).addEventListener("input", render));
    $("cab-date-clear").addEventListener("click", () => {
      $("cab-from").value = "";
      $("cab-to").value = "";
      render();
    });
    document.querySelectorAll(".cab-quick").forEach((b) => b.addEventListener("click", () => {
      quick = quick === b.dataset.q ? "" : b.dataset.q;
      render();
    }));
    $("cab-back").addEventListener("click", closeCase);
    $("cab-back2").addEventListener("click", closeCase);
    $("cab-pager").addEventListener("click", (e) => {
      const b = e.target.closest(".pg-btn");
      if (!b || b.disabled) return;
      page = Number(b.dataset.page);
      render();
      $("cab-table").scrollIntoView({ block: "start" });
    });
    $("cab-settings-btn").hidden = !isAdmin;
    if (isAdmin) {
      mirrorStatus();
      initBulk();
    }
    $("cab-mark-ui").hidden = false;
    initMarkFilter();
    $("cab-settings-btn").addEventListener("click", openSettings);
    $("cab-new-btn").addEventListener("click", openNew);
    $("cab-new-form").addEventListener("submit", submitNew);
    $("cab-new-cancel").addEventListener("click", () => $("cab-new").close());
    $("cab-set-close").addEventListener("click", () => {
      $("cab-settings").close();
      load();
    });
    window.addEventListener("popstate", () => {
      if (!$("cab-case").hidden) closeCase(true);
    });
    $("cab-case").addEventListener("focusout", () => {
      if (stagesPending) setTimeout(() => {
        if (stagesPending && !editingInCase()) renderStages();
      }, 0);
    });
  }
  let loadSeq = 0;
  let withClosed = false, closedTotal = 0, closedFor = "";
  async function load() {
    const my = ++loadSeq;
    const A = acc();
    if (!MOD_UI[module] || !A["cab" + module]) module = MODS.find((m) => A["cab" + m]) || "200";
    document.querySelectorAll(".cab-mod").forEach((b) => {
      b.hidden = !A["cab" + b.dataset.m];
    });
    $("cq-nocell-btn").hidden = false;
    keep("cab_module", module);
    document.querySelectorAll(".cab-mod").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === module)));
    $("cab-title").textContent = ui().title;
    $("cab-status-line").textContent = "Завантажуємо…";
    $("cab-date-label").textContent = `Дата ${ui().dateWord}:`;
    $("cab-sort").querySelector('[value="date"]').textContent = `за датою ${ui().dateWord}`;
    const [d, st, ops] = await Promise.all([
      db.from("case_stage_defs").select("*").eq("module", module).eq("active", true).order("sort"),
      db.from("case_statuses").select("*").eq("module", module).order("sort"),
      db.from("operators").select("user_id, full_name, active").order("full_name")
    ]);
    if (my !== loadSeq) return;
    defs = d.data || [];
    statuses = st.data || [];
    staff = new Map((ops.data || []).map((o) => [o.user_id, o.full_name]));
    if (withClosed && closedFor !== module) withClosed = false;
    closedFor = module;
    const closedNames = statuses.filter((x) => x.closed).map((x) => x.name);
    const inList = `(${closedNames.map((n) => `"${n.replace(/"/g, "")}"`).join(",")})`;
    const skipClosed = !withClosed && closedNames.length;
    if (skipClosed) {
      const { count } = await db.from("cases").select("id", { count: "exact", head: true }).eq("module", module).in("status", closedNames);
      closedTotal = count || 0;
    }
    const list = [];
    for (let from = 0; ; from += 1e3) {
      let q = db.from("cases").select("*, person:persons!cases_person_id_fkey(id, last_name, first_name, patronymic, military_status, death_date, burial_date, wounded, wound_date, birth_date, callsign, burial_place, military_unit_code, mp_unit_id, region_id, settlement, phone, comment), case_values(stage_key, value)").eq("module", module);
      if (skipClosed) q = q.or(`status.is.null,status.not.in.${inList}`);
      const { data, error } = await q.order("journal_id").range(from, from + 999);
      if (error) {
        console.error(error);
        $("cab-status-line").textContent = "Не вдалося завантажити справи.";
        return;
      }
      if (my !== loadSeq) return;
      list.push(...data);
      if (data.length < 1e3) break;
    }
    const ids = list.map((c) => c.person_id);
    const kin = /* @__PURE__ */ new Map();
    const chunks = [];
    for (let i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150));
    for (let i = 0; i < chunks.length; i += 4) {
      const res = await Promise.all(chunks.slice(i, i + 4).map((part) => db.from("military_relations").select("id, related_person_id, relation_degree, created_at, person:persons!military_relations_person_id_fkey(id, last_name, first_name, patronymic, phone, settlement)").in("related_person_id", part).order("created_at")));
      res.forEach(({ data }) => (data || []).forEach((r) => {
        if (r.person) kin.set(r.related_person_id, [...kin.get(r.related_person_id) || [], r]);
      }));
    }
    if (!skipClosed) closedTotal = 0;
    const sn = await db.from("case_seen").select("case_id, seen_at");
    const mk = /* @__PURE__ */ new Map();
    {
      for (let from = 0; ; from += 1e3) {
        const { data, error } = await db.from("case_marks").select("case_id, colors").order("case_id").range(from, from + 999);
        if (error) {
          console.error(error);
          break;
        }
        (data || []).forEach((r) => mk.set(r.case_id, r.colors || []));
        if (!data || data.length < 1e3) break;
      }
    }
    if (my !== loadSeq) return;
    marks = mk;
    cases = list;
    seen = new Map((sn.data || []).map((r) => [r.case_id, r.seen_at]));
    cases.forEach((c) => {
      c.vals = Object.fromEntries((c.case_values || []).map((v) => [v.stage_key, v.value]));
      c.kin = kin.get(c.person_id) || [];
      c.next = nextAction(c);
    });
    fillFilters();
    $("cab-status-line").textContent = "";
    render();
    badge();
    if (returnTo) {
      const id = returnTo;
      returnTo = null;
      if (cases.some((c) => c.id === id)) openCase(id, true);
    }
  }
  const isClosed = (c) => statuses.some((s) => s.name === c.status && s.closed);
  function nextAction(c) {
    let best = null;
    if (isClosed(c)) return null;
    defs.filter((d) => d.remind_after && d.remind_days != null).forEach((d) => {
      if (c.vals[d.key]) return;
      const base = c.vals[d.remind_after];
      if (!base || !/^\d{4}-\d{2}-\d{2}/.test(base)) return;
      const due = addDays(base.slice(0, 10), d.remind_days);
      if (!best || due < best.due) best = { key: d.key, kind: d.kind, label: d.label, due };
    });
    if (best) {
      best.days = Math.round((/* @__PURE__ */ new Date(best.due + "T00:00:00Z") - /* @__PURE__ */ new Date(today() + "T00:00:00Z")) / 864e5);
      best.overdue = best.days < 0;
      best.level = best.days < 0 ? "over" : best.days <= 3 ? "soon" : "later";
    }
    return best;
  }
  const plural = (n, a, b, c) => {
    const m = n % 100, k = n % 10;
    return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c;
  };
  const dueText = (x) => x.days < 0 ? `прострочено на ${-x.days} ${plural(-x.days, "день", "дні", "днів")}` : x.days === 0 ? "сьогодні" : x.days <= 3 ? `залишилось ${x.days} ${plural(x.days, "день", "дні", "днів")}` : `до ${fmt(x.due)}`;
  let todayAll = false;
  function renderToday() {
    const box = $("cab-today");
    const mineN = cases.filter((c) => c.executor_id === me).length;
    const scopeAll = todayAll || !mineN;
    const pool = cases.filter((c) => c.next && c.next.days <= 7 && (scopeAll || c.executor_id === me)).sort((a, b) => a.next.days - b.next.days);
    const over = pool.filter((c) => c.next.days < 0), now = pool.filter((c) => c.next.days === 0), week = pool.filter((c) => c.next.days > 0);
    box.hidden = false;
    box.className = "cab-today" + (over.length ? " has-over" : now.length ? " has-now" : "");
    box.innerHTML = `<div class="today-head"><h2></h2><span class="today-counts"></span><span class="today-scope"></span></div><ul class="today-list"></ul><p class="today-more"></p>`;
    box.querySelector("h2").textContent = scopeAll ? "На контролі — усі справи" : "Мої справи на сьогодні";
    const cnt = box.querySelector(".today-counts");
    const groups = { over, now, week };
    if (!todayTab || !groups[todayTab].length) todayTab = over.length ? "over" : now.length ? "now" : week.length ? "week" : "over";
    [["over", "Прострочено", over.length], ["now", "На сьогодні", now.length], ["week", "На цьому тижні", week.length]].forEach(([k, l, n]) => {
      const sp = document.createElement("button");
      sp.type = "button";
      sp.className = "today-n today-" + k + (n ? "" : " is-zero");
      sp.setAttribute("aria-pressed", String(k === todayTab));
      sp.disabled = !n;
      sp.title = n ? "Показати ці справи" : "Таких справ немає";
      sp.innerHTML = "<b></b> ";
      sp.firstChild.textContent = n;
      sp.append(l);
      sp.onclick = () => {
        todayTab = k;
        todayOpen = false;
        renderToday();
      };
      cnt.appendChild(sp);
    });
    const shown = groups[todayTab];
    if (mineN) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-link";
      b.textContent = scopeAll ? "лише мої" : "показати всі справи";
      b.onclick = () => {
        todayAll = !todayAll;
        renderToday();
      };
      box.querySelector(".today-scope").appendChild(b);
    }
    const ul = box.querySelector(".today-list");
    const LIMIT = todayOpen ? 60 : 4;
    shown.slice(0, LIMIT).forEach((c) => {
      const li = document.createElement("li");
      li.className = "today-item lvl-" + c.next.level;
      li.innerHTML = '<button type="button" class="btn-link today-name"></button><span class="today-what"></span><span class="today-due"></span><span class="today-act"></span>';
      li.children[0].textContent = fio(c.person);
      li.children[0].onclick = () => openCase(c.id);
      li.children[1].textContent = c.next.label;
      li.children[2].textContent = dueText(c.next);
      const done = document.createElement("button");
      done.type = "button";
      done.className = "btn-secondary btn-small";
      if (c.next.kind === "date") {
        done.textContent = "Зроблено";
        done.title = "Поставити сьогоднішню дату";
        done.onclick = () => markDone(c, done);
      } else {
        done.textContent = "Заповнити";
        done.onclick = () => openCase(c.id);
      }
      li.children[3].appendChild(done);
      ul.appendChild(li);
    });
    const more = box.querySelector(".today-more");
    if (!pool.length) {
      ul.remove();
      more.textContent = "Нічого термінового: прострочених і найближчих дій немає.";
      more.className = "today-more today-ok";
    } else if (shown.length > LIMIT || todayOpen) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-link";
      b.textContent = todayOpen ? "згорнути" : `показати ще ${Math.min(shown.length, 60) - LIMIT}` + (shown.length > 60 ? ` (усього ${shown.length} — решта у фільтрі «Прострочені»)` : "");
      b.onclick = () => {
        todayOpen = !todayOpen;
        renderToday();
      };
      more.appendChild(b);
    } else more.remove();
  }
  let todayOpen = false, todayTab = "";
  async function markDone(c, btn) {
    const k = c.next.key, label = c.next.label;
    btn.disabled = true;
    const { error } = await db.from("case_values").upsert({ case_id: c.id, stage_key: k, value: today(), source: "app", updated_by: me, updated_at: (/* @__PURE__ */ new Date()).toISOString() }, { onConflict: "case_id,stage_key" });
    if (error) {
      console.error(error);
      Persons.toast("Не вдалося зберегти");
      btn.disabled = false;
      return;
    }
    c.vals[k] = today();
    c.next = nextAction(c);
    Persons.toast(`${label}: зроблено сьогодні` + (c.next ? `. Далі — ${c.next.label}, ${dueText(c.next)}` : ""));
    render();
    badge();
  }
  function fillFilters() {
    const keep2 = (id) => $(id).value;
    const fill = (id, items, all) => {
      const v = keep2(id);
      const sel = $(id);
      sel.innerHTML = `<option value="">${all}</option>`;
      items.forEach(([val, label]) => sel.add(new Option(label, val)));
      sel.value = v;
    };
    fill("cab-status", statuses.map((s) => [s.name, s.name]), "Усі статуси");
    fill("cab-exec", [["none", "— без виконавця —"], ...[...staff].map(([id, n]) => [id, n])], "Усі виконавці");
    fill("cab-resp", [["none", "— без відповідального —"], ...[...staff].map(([id, n]) => [id, n])], "Усі відповідальні");
    const { cells } = Persons.ctx();
    fill("cab-cell", [["none", "— без осередку —"], ...[...cells].map(([id, n]) => [String(id), n])], "Усі осередки");
    if (isAdmin) {
      const people = [...staff].sort((a, b) => a[1].localeCompare(b[1], "uk"));
      fill("bk-exec", [["none", "— прибрати виконавця —"], ...people], "Виконавець: не змінювати");
      fill("bk-resp", [["none", "— прибрати відповідального —"], ...people], "Відповідальний: не змінювати");
      fill("bk-cell", [["none", "— без осередку —"], ...[...cells].map(([id, n]) => [String(id), n])], "Осередок: не змінювати");
      fill("bk-status", statuses.map((x) => [x.name, x.name]), "Статус: не змінювати");
    }
  }
  let bulkMode = false, lastList = [];
  const picked = /* @__PURE__ */ new Set();
  function initBulk() {
    $("cab-bulk-btn").hidden = false;
    $("cab-bulk-btn").addEventListener("click", () => {
      bulkMode = !bulkMode;
      picked.clear();
      bulkDisarm();
      bkMsg("");
      $("cab-bulk-btn").setAttribute("aria-pressed", String(bulkMode));
      render();
    });
    $("cab-sel-page").addEventListener("change", (e) => {
      pageItems().forEach((c) => e.target.checked ? picked.add(c.id) : picked.delete(c.id));
      render();
    });
    $("cab-bulk-page").addEventListener("click", () => {
      pageItems().forEach((c) => picked.add(c.id));
      render();
    });
    $("cab-bulk-all").addEventListener("click", () => {
      lastList.forEach((c) => picked.add(c.id));
      render();
    });
    $("cab-bulk-none").addEventListener("click", () => {
      picked.clear();
      render();
    });
    $("bk-apply").addEventListener("click", applyBulk);
    $("bk-cancel").addEventListener("click", () => {
      bulkDisarm();
      bkMsg("");
    });
    ["bk-exec", "bk-resp", "bk-cell", "bk-status"].forEach((id) => $(id).addEventListener("change", () => {
      bulkDisarm();
      bkMsg("");
    }));
    $("cab-load-btn").hidden = false;
    $("cab-load-btn").addEventListener("click", openLoad);
    $("cab-load-close").addEventListener("click", () => $("cab-load").close());
  }
  const pageItems = () => lastList.slice((page - 1) * PAGE, page * PAGE);
  function renderBulkBar() {
    $("cab-bulk").hidden = !bulkMode;
    document.querySelector("#cab-table th.cab-sel").hidden = !bulkMode;
    if (!bulkMode) return;
    $("cab-bulk-n").textContent = picked.size;
    $("cab-bulk-total").textContent = lastList.length;
    const pi = pageItems();
    $("cab-sel-page").checked = pi.length > 0 && pi.every((c) => picked.has(c.id));
    if (bulkArmed && !bulkArmed.endsWith("|" + [...picked].sort().join(","))) {
      bulkDisarm();
      bkMsg("");
    }
  }
  const withTimeout = (p, ms = 3e4) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  async function updateCases(ids, patch, onStep) {
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await withTimeout(db.from("cases").update(patch).in("id", ids.slice(i, i + 100)));
      if (error) throw error;
      if (onStep) onStep(Math.min(i + 100, ids.length), ids.length);
    }
  }
  let bulkArmed = null;
  const bkMsg = (t, bad) => {
    const m = $("bk-msg");
    m.textContent = t || "";
    m.classList.toggle("bad", !!bad);
  };
  function bulkPatch() {
    const v = (id) => $(id).value;
    const patch = {};
    if (v("bk-exec")) patch.executor_id = v("bk-exec") === "none" ? null : v("bk-exec");
    if (v("bk-resp")) patch.responsible_id = v("bk-resp") === "none" ? null : v("bk-resp");
    if (v("bk-cell")) patch.cell_id = v("bk-cell") === "none" ? null : Number(v("bk-cell"));
    if (v("bk-status")) patch.status = v("bk-status");
    return patch;
  }
  function bulkDisarm() {
    bulkArmed = null;
    $("bk-apply").textContent = "Застосувати";
    $("bk-cancel").hidden = true;
  }
  async function applyBulk() {
    const btn = $("bk-apply");
    if (!picked.size) {
      bkMsg("Спершу позначте справи галочками зліва (або «усі на сторінці»).", true);
      return;
    }
    const patch = bulkPatch();
    if (!Object.keys(patch).length) {
      bkMsg("Оберіть, що змінити: виконавця, відповідального, осередок чи статус.", true);
      return;
    }
    const key = JSON.stringify(patch) + "|" + [...picked].sort().join(",");
    if (bulkArmed !== key) {
      const what = [patch.executor_id !== void 0 && "виконавця", patch.responsible_id !== void 0 && "відповідального", patch.cell_id !== void 0 && "осередок", patch.status && "статус"].filter(Boolean).join(", ");
      bulkArmed = key;
      btn.textContent = `Так, змінити (${picked.size})`;
      $("bk-cancel").hidden = false;
      bkMsg(`Змінити ${what} у ${picked.size} справах? Натисніть «Так, змінити» ще раз.`);
      return;
    }
    bulkDisarm();
    btn.disabled = true;
    btn.textContent = "Зберігаємо…";
    const n = picked.size;
    bkMsg(`Надсилаємо зміни: 0 з ${n}…`);
    try {
      await updateCases([...picked], patch, (d, t) => {
        bkMsg(`Збережено ${d} з ${t}…`);
      });
      picked.clear();
      ["bk-exec", "bk-resp", "bk-cell", "bk-status"].forEach((id) => {
        $(id).value = "";
      });
      bkMsg(`✓ Оновлено справ: ${n}. Оновлюємо список…`);
      Persons.toast(`Оновлено справ: ${n}`);
      await load();
      bkMsg(`✓ Оновлено справ: ${n}.`);
    } catch (e) {
      console.error(e);
      bkMsg(e.message === "timeout" ? "Сервер не відповів за 30 с — нічого не змінено або змінено частково. Оновіть сторінку (F5) і перевірте." : "Не вдалося оновити: " + (e.message || e.code || "помилка"), true);
    } finally {
      btn.textContent = "Застосувати";
      btn.disabled = false;
    }
  }
  function openLoad() {
    const open = cases.filter((c) => !isClosed(c));
    const { cells } = Persons.ctx();
    const stat = (keyOf) => {
      const m = /* @__PURE__ */ new Map();
      open.forEach((c) => {
        const k = keyOf(c);
        const r = m.get(k) || { all: 0, over: 0, noContact: 0, problem: 0, noExec: 0 };
        r.all++;
        if (c.next && c.next.overdue) r.over++;
        if (!contactOf(c)) r.noContact++;
        if (c.status === "Проблема") r.problem++;
        if (!c.executor_id) r.noExec++;
        m.set(k, r);
      });
      return [...m].sort((a, b) => b[1].over - a[1].over || b[1].all - a[1].all);
    };
    const table = (el, rows, nameOf, onPick, withNoExec) => {
      const t = $(el);
      t.innerHTML = `<thead><tr><th></th><th>Відкритих</th><th>Прострочено</th><th>«Проблема»</th><th>Без контактної особи</th>${withNoExec ? "<th>Без виконавця</th>" : ""}</tr></thead><tbody></tbody>`;
      rows.forEach(([k, r]) => {
        const tr = document.createElement("tr");
        tr.className = "is-click";
        tr.innerHTML = `<td></td><td>${r.all}</td><td class="${r.over ? "n-bad" : ""}">${r.over}</td><td>${r.problem}</td><td class="${r.noContact ? "n-warn" : ""}">${r.noContact}</td>${withNoExec ? `<td class="${r.noExec ? "n-warn" : ""}">${r.noExec}</td>` : ""}`;
        tr.children[0].textContent = nameOf(k);
        tr.addEventListener("click", () => {
          onPick(k);
          $("cab-load").close();
        });
        t.tBodies[0].appendChild(tr);
      });
    };
    const reset = () => {
      quick = "";
      preset = null;
      ["cab-search", "cab-status", "cab-exec", "cab-resp", "cab-mark", "cab-cell", "cab-from", "cab-to"].forEach((id) => {
        $(id).value = "";
      });
    };
    table(
      "cab-load-exec",
      stat((c) => c.executor_id || ""),
      (k) => k ? staff.get(k) || "(невідомий)" : "— без виконавця —",
      (k) => {
        reset();
        $("cab-exec").value = k || "none";
        render();
      },
      false
    );
    table(
      "cab-load-cell",
      stat((c) => c.cell_id || 0),
      (k) => k ? cells.get(k) || "—" : "— без осередку —",
      (k) => {
        reset();
        $("cab-cell").value = k ? String(k) : "none";
        render();
      },
      true
    );
    $("cab-load").showModal();
  }
  function markDots(c) {
    const box = document.createElement("span");
    box.className = "mark-dots";
    const on = new Set(marks.get(c.id) || []);
    MARK_COLORS.forEach((col, i) => {
      const n = i + 1;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mark-dot" + (on.has(n) ? " is-on" : "");
      b.style.setProperty("--mk", col);
      b.title = (on.has(n) ? "Зняти " : "Поставити ") + MARK_NAMES[i] + " мітку";
      b.setAttribute("aria-pressed", String(on.has(n)));
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMark(c, n, b);
      });
      box.appendChild(b);
    });
    return box;
  }
  function initMarkFilter() {
    const list = document.querySelector("#cab-mark-ui .mark-ms-list");
    list.innerHTML = "";
    const opt = (val, label, col) => {
      const l = document.createElement("label");
      l.className = "check";
      l.innerHTML = '<input type="checkbox"> <span class="mark-dot"></span> <span></span>';
      l.firstChild.value = val;
      l.lastChild.textContent = label;
      const dot = l.querySelector(".mark-dot");
      if (col) {
        dot.style.setProperty("--mk", col);
        dot.classList.add("is-on");
      } else dot.classList.add("is-empty");
      list.appendChild(l);
    };
    MARK_COLORS.forEach((col, i) => opt(String(i + 1), MARK_NAMES[i], col));
    opt("none", "без міток", null);
    list.addEventListener("change", () => {
      $("cab-mark").value = [...list.querySelectorAll("input:checked")].map((i) => i.value).join(",");
      render();
    });
    document.addEventListener("click", (e) => {
      const d = $("cab-mark-ui");
      if (d.open && !d.contains(e.target)) d.open = false;
    });
    syncMarkFilter();
  }
  const FILTER_IDS = ["cab-search", "cab-status", "cab-exec", "cab-resp", "cab-mark", "cab-cell", "cab-from", "cab-to"];
  function clearFilters(silent) {
    FILTER_IDS.forEach((id) => {
      const el = $(id);
      if (el) el.value = "";
    });
    quick = "";
    preset = null;
    page = 1;
    syncMarkFilter();
    if (!silent) render();
  }
  function syncMarkFilter() {
    const ui2 = $("cab-mark-ui");
    if (!ui2 || ui2.hidden) return;
    const sel = new Set($("cab-mark").value.split(",").filter(Boolean));
    ui2.querySelectorAll(".mark-ms-list input").forEach((i) => {
      i.checked = sel.has(i.value);
    });
    ui2.querySelector(".mark-ms-label").textContent = sel.size ? "Мітки:" : "Усі мітки";
    const dots = ui2.querySelector(".mark-ms-dots");
    dots.innerHTML = "";
    MARK_COLORS.forEach((col, i) => {
      if (sel.size && !sel.has(String(i + 1))) return;
      const d = document.createElement("span");
      d.className = "mark-dot" + (sel.size ? " is-on" : "");
      d.style.setProperty("--mk", col);
      dots.appendChild(d);
    });
    if (sel.has("none")) {
      const d = document.createElement("span");
      d.className = "mark-dot is-empty";
      d.title = "без міток";
      dots.appendChild(d);
    }
    ui2.classList.toggle("is-active", sel.size > 0);
  }
  async function toggleMark(c, n, btn) {
    const cur = new Set(marks.get(c.id) || []);
    cur.has(n) ? cur.delete(n) : cur.add(n);
    const colors = [...cur].sort();
    btn.classList.toggle("is-on", cur.has(n));
    btn.setAttribute("aria-pressed", String(cur.has(n)));
    const { error } = colors.length ? await db.from("case_marks").upsert({ case_id: c.id, user_id: me, colors, updated_at: (/* @__PURE__ */ new Date()).toISOString() }) : await db.from("case_marks").delete().eq("case_id", c.id).eq("user_id", me);
    if (error) {
      console.error(error);
      Persons.toast("Не вдалося зберегти мітку");
      btn.classList.toggle("is-on");
      return;
    }
    if (colors.length) marks.set(c.id, colors);
    else marks.delete(c.id);
    if ($("cab-mark").value) render();
  }
  const norm = (t) => String(t || "").toLowerCase().replace(/[’'ʼ`]/g, "").replace(/\s+/g, " ");
  function matchSearch(c, q) {
    const words = norm(q).split(" ").filter(Boolean);
    const text = norm([fio(c.person), c.journal_id, ...c.kin.map((k) => fio(k.person))].join(" "));
    const phones = [c.person.phone, ...c.kin.map((k) => k.person.phone)].filter(Boolean).join(" ");
    return words.every((w) => {
      const d = w.replace(/\D/g, "");
      if (d.length >= 3 && d.length === w.replace(/[\s()+-]/g, "").length) return phones.includes(d) || text.includes(w);
      return text.includes(w);
    });
  }
  function filtered() {
    const q = $("cab-search").value.trim().toLowerCase();
    const st = $("cab-status").value, ex = $("cab-exec").value, rs = $("cab-resp").value, ce = $("cab-cell").value;
    const mkf = new Set($("cab-mark").value.split(",").filter(Boolean));
    const from = $("cab-from").value, to = $("cab-to").value;
    const stSel = $("cab-status").value;
    const markColors = [...mkf].some((x) => x !== "none");
    const showClosed = !!preset || quick === "closed" || !!q || markColors || statuses.some((s) => s.name === stSel && s.closed);
    if (showClosed && !withClosed && closedTotal) {
      withClosed = true;
      $("cab-status-line").textContent = "Довантажуємо закриті справи…";
      load();
    }
    return cases.filter((c) => {
      if (preset && !preset.ids.has(c.id)) return false;
      if (!showClosed && isClosed(c)) return false;
      if (quick === "closed" && !isClosed(c)) return false;
      if (from || to) {
        const d = dateOf(c);
        if (!d || from && d < from || to && d > to) return false;
      }
      if (q && !matchSearch(c, q)) return false;
      if (st && c.status !== st) return false;
      if (ex === "none" ? c.executor_id : ex && c.executor_id !== ex) return false;
      if (rs === "none" ? c.responsible_id : rs && c.responsible_id !== rs) return false;
      if (mkf.size) {
        const m = marks.get(c.id) || [];
        const hit = m.some((x) => mkf.has(String(x)));
        if (!(mkf.has("none") && !m.length || hit)) return false;
        if (markColors && isClosed(c) && !hit && !q && !preset && quick !== "closed" && !statuses.some((s) => s.name === stSel && s.closed)) return false;
      }
      if (ce === "none" ? c.cell_id : ce && String(c.cell_id) !== ce) return false;
      if (quick === "mine" && c.executor_id !== me) return false;
      if (quick === "overdue" && !(c.next && c.next.overdue)) return false;
      if (quick === "problem" && c.status !== "Проблема") return false;
      if (quick === "fresh" && !isNew(c)) return false;
      if (quick === "nocell" && c.cell_id) return false;
      return true;
    });
  }
  function sorted(list) {
    const mode = $("cab-sort").value || "new";
    const reg = (c) => ui().reg && c.vals[ui().reg] || "";
    const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    const num = (c) => Number(String(c.journal_id || "").split("-").pop()) || 0;
    const added = module === "200" ? (a, b) => num(a) - num(b) : (a, b) => cmp((a.created_at || "").slice(0, 16), (b.created_at || "").slice(0, 16)) || cmp(reg(a), reg(b)) || cmp(a.journal_id, b.journal_id);
    const byDate = (a, b) => {
      const x = dateOf(a) || "", y = dateOf(b) || "";
      return !x - !y || cmp(y, x);
    };
    const f = mode === "old" ? added : mode === "abc" ? (a, b) => fio(a.person).localeCompare(fio(b.person), "uk") : mode === "date" ? byDate : (a, b) => added(b, a);
    const pin = $("cab-pin").checked;
    const ov = (c) => c.next && c.next.overdue ? 0 : 1;
    return [...list].sort((a, b) => (pin ? ov(a) - ov(b) || (ov(a) === 0 ? a.next.days - b.next.days : 0) : 0) || f(a, b));
  }
  function gaps(c) {
    let crit = 0, soft = 0;
    const p = c.person, k = contactOf(c);
    if (!c.status) crit++;
    if (!c.executor_id) crit++;
    if (!c.cell_id) crit++;
    if (!k || !k.person.phone) crit++;
    Object.values(PERSON_FIELDS[module] || {}).flat().forEach(([key]) => {
      if (p[key] === null || p[key] === void 0 || p[key] === "") CRIT.has("p-" + key) ? crit++ : soft++;
    });
    defs.forEach((d) => {
      if ((d.section || "other") === "head" || c.vals[d.key]) return;
      const base = d.remind_after && c.vals[d.remind_after];
      const overdue = !isClosed(c) && base && /^\d{4}-\d{2}-\d{2}/.test(base) && addDays(base.slice(0, 10), d.remind_days || 0) < today();
      overdue || CRIT.has("s-" + d.key) ? crit++ : soft++;
    });
    return { crit, soft };
  }
  const PAGE = 100;
  let page = 1, lastSig = "";
  function noDateCount() {
    const f = $("cab-from").value, t = $("cab-to").value;
    $("cab-from").value = "";
    $("cab-to").value = "";
    const n = filtered().filter((c) => !dateOf(c)).length;
    $("cab-from").value = f;
    $("cab-to").value = t;
    return n;
  }
  function render() {
    syncMarkFilter();
    const list = sorted(filtered());
    lastList = list;
    const sig = [module, quick, ...["cab-search", "cab-status", "cab-exec", "cab-resp", "cab-mark", "cab-cell", "cab-from", "cab-to", "cab-sort"].map((id) => $(id).value), $("cab-pin").checked, preset ? preset.label : ""].join("|");
    if (sig !== lastSig) {
      page = 1;
      lastSig = sig;
    }
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page > pages) page = pages;
    const cnt = (f) => cases.filter((c) => !isClosed(c)).filter(f).length;
    const closedN = withClosed ? cases.filter(isClosed).length : closedTotal;
    $("cq-closed").textContent = closedN;
    $("cq-closed-btn").hidden = !closedN && quick !== "closed";
    $("cq-mine").textContent = cnt((c) => c.executor_id === me);
    $("cq-overdue").textContent = cnt((c) => c.next && c.next.overdue);
    $("cq-problem").textContent = cnt((c) => c.status === "Проблема");
    $("cq-fresh").textContent = cnt(isNew);
    $("cq-fresh-btn").hidden = !cnt(isNew) && quick !== "fresh";
    $("cq-nocell").textContent = cnt((c) => !c.cell_id);
    document.querySelectorAll(".cab-quick").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.q === quick)));
    $("cab-preset").hidden = !preset;
    if (preset) $("cab-preset-label").textContent = preset.label;
    const hasDate = !!($("cab-from").value || $("cab-to").value);
    $("cab-date-clear").hidden = !hasDate;
    $("cab-count").textContent = `${list.length} з ${cases.length}` + (closedN && !list.some(isClosed) ? ` · завершених приховано: ${closedN}` : "") + (hasDate ? ` · без дати: ${noDateCount()} (у період не потрапляють)` : "");
    const { cells } = Persons.ctx();
    const color = new Map(statuses.map((s) => [s.name, s.color]));
    const totalStages = defs.filter((d) => (d.section || "other") !== "head").length;
    const tb = $("cab-table").tBodies[0];
    tb.innerHTML = "";
    if (!list.length && cases.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 20;
      td.className = "cab-empty";
      td.textContent = `Фільтри приховують усі справи (${cases.length}). `;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-link";
      b.textContent = "Скинути фільтри";
      b.onclick = () => clearFilters();
      td.appendChild(b);
      tr.appendChild(td);
      tb.appendChild(tr);
    }
    list.slice((page - 1) * PAGE, page * PAGE).forEach((c) => {
      const tr = document.createElement("tr");
      const rec = contactOf(c);
      const filled = defs.filter((d) => (d.section || "other") !== "head" && c.vals[d.key]).length;
      const pct = totalStages ? Math.round(filled / totalStages * 100) : 0;
      tr.innerHTML = `
        <td class="cab-id"></td>
        <td class="cell-name"></td>
        <td class="cab-family"></td>
        <td class="cab-note"><span></span></td>
        <td></td>
        <td><span class="cab-status"></span></td>
        <td class="cab-exec"></td>
        <td class="cab-next"></td>
        <td><span class="cab-progress"><i style="width:${pct}%"></i></span> <span class="muted">${filled}/${totalStages}</span></td>`;
      tr.children[0].textContent = c.journal_id;
      {
        const g = gaps(c);
        const q = document.createElement("span");
        q.className = "cab-q";
        if (!g.crit && !g.soft) q.innerHTML = '<span class="q-ok" title="Усе заповнено">✓</span>';
        else q.innerHTML = (g.crit ? `<span class="q-pill q-pill-crit" title="Потрібно заповнити: ${g.crit}">${g.crit}</span>` : "") + (g.soft ? `<span class="q-pill q-pill-warn" title="Бажано заповнити: ${g.soft}">${g.soft}</span>` : "");
        tr.children[0].append(document.createElement("br"), q);
      }
      tr.children[1].textContent = fio(c.person);
      {
        const p = c.person;
        const lines = [];
        if (module === "200") {
          const b = [p.birth_date && "н. " + fmt(p.birth_date), p.death_date && "заг. " + fmt(p.death_date)].filter(Boolean).join(" · ");
          if (b) lines.push(b);
        }
        const d = dateOf(c);
        if (d && module !== "vet") lines.push(ui().dateWord + " " + fmt(d));
        lines.forEach((t) => {
          const m = document.createElement("span");
          m.className = "muted cab-date";
          m.textContent = t;
          tr.children[1].append(document.createElement("br"), m);
        });
      }
      tr.children[1].append(document.createElement("br"), markDots(c));
      if (isNew(c)) {
        const b = document.createElement("span");
        b.className = "cab-new-mark";
        b.textContent = "нова";
        b.title = "Справу передано у ваш осередок";
        tr.children[1].append(" ", b);
      }
      tr.children[2].innerHTML = rec ? '<span></span><br><span class="muted"></span>' : '<span class="muted">родину не встановлено</span>';
      if (rec) {
        tr.children[2].firstChild.textContent = `${rec.relation_degree}: ${fio(rec.person)}` + (c.kin.length > 1 ? ` (+${c.kin.length - 1})` : "");
        tr.children[2].lastChild.textContent = V.formatPhone(rec.person.phone) || "без телефону";
      }
      {
        const n = String(c.person.comment || "").trim();
        const el = tr.children[3].firstChild;
        el.textContent = n;
        if (n) tr.children[3].title = n;
        else tr.children[3].innerHTML = '<span class="muted">—</span>';
      }
      tr.children[4].textContent = cells.get(c.cell_id) || "—";
      const sp = tr.children[5].firstChild;
      sp.textContent = c.status || "—";
      const col = statusColor(c.status, color.get(c.status));
      sp.style.setProperty("--st", col);
      sp.style.color = inkFor(col);
      tr.children[6].textContent = staff.get(c.executor_id) || (c.vals.executor_legacy ? `(${c.vals.executor_legacy})` : "—");
      {
        const r = staff.get(c.responsible_id) || (c.vals.responsible ? `(${c.vals.responsible})` : "");
        if (r) {
          const m = document.createElement("span");
          m.className = "muted cab-resp-line";
          m.textContent = "відп.: " + r;
          tr.children[6].append(document.createElement("br"), m);
        }
      }
      if (c.next) {
        tr.children[7].innerHTML = '<span></span><br><span class="due-tag"></span>';
        tr.children[7].firstChild.textContent = c.next.label;
        tr.children[7].lastChild.textContent = dueText(c.next);
        tr.children[7].lastChild.classList.add("due-" + c.next.level);
        tr.classList.add("row-" + c.next.level);
      } else tr.children[7].textContent = "—";
      if (bulkMode) {
        const td = document.createElement("td");
        td.className = "cab-sel";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = picked.has(c.id);
        cb.setAttribute("aria-label", "Вибрати справу " + c.journal_id);
        td.addEventListener("click", (e) => e.stopPropagation());
        cb.addEventListener("change", () => {
          cb.checked ? picked.add(c.id) : picked.delete(c.id);
          renderBulkBar();
        });
        td.appendChild(cb);
        tr.prepend(td);
        if (picked.has(c.id)) tr.classList.add("is-picked");
      }
      tr.addEventListener("click", () => openCase(c.id));
      tb.appendChild(tr);
    });
    renderBulkBar();
    const pg = $("cab-pager");
    pg.hidden = pages <= 1;
    pg.innerHTML = "";
    if (pages > 1) {
      const nums = [.../* @__PURE__ */ new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
      let html = `<button type="button" class="pg-btn" data-page="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Попередня сторінка">‹</button>`, prev = 0;
      nums.forEach((n) => {
        if (n - prev > 1) html += '<span class="pg-gap">…</span>';
        html += `<button type="button" class="pg-btn${n === page ? " is-current" : ""}" data-page="${n}" ${n === page ? 'aria-current="page"' : ""}>${n}</button>`;
        prev = n;
      });
      html += `<button type="button" class="pg-btn" data-page="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="Наступна сторінка">›</button>`;
      html += `<span class="pg-info">${(page - 1) * PAGE + 1}–${Math.min(list.length, page * PAGE)} з ${list.length}</span>`;
      pg.innerHTML = html;
    }
    $("cab-empty").hidden = list.length > 0;
    renderToday();
  }
  const SECTIONS = {
    "200": [["person", "Особа"], ["notice", "Сповіщення"], ["family", "Родина"], ["burial", "Поховання"], ["support", "Супровід"], ["awards", "Нагороди і юридичне"], ["problems", "Проблеми"], ["other", "Інше"]],
    "300": [["person", "Особа"], ["treat", "Лікування"], ["docs", "Документи"], ["family", "Родина"], ["problems", "Проблеми"], ["other", "Інше"]],
    bzv: [["person", "Особа"], ["notice", "Сповіщення"], ["search", "Пошук"], ["family", "Родина"], ["problems", "Проблеми"], ["other", "Інше"]],
    pol: [["person", "Особа"], ["release", "Звільнення"], ["treat", "Реінтеграція і лікування"], ["docs", "Документи"], ["family", "Родина"], ["problems", "Проблеми"], ["other", "Інше"]],
    vet: [["person", "Особа"], ["state", "Стан і інвалідність"], ["family", "Родина"], ["problems", "Проблеми"], ["other", "Інше"]]
  };
  const PERSON_FIELDS = {
    "200": {
      person: [
        ["last_name", "Прізвище"],
        ["first_name", "Ім’я"],
        ["patronymic", "По батькові"],
        ["callsign", "Позивний"],
        ["birth_date", "Дата народження", "date"],
        ["death_date", "Дата загибелі", "date"],
        ["military_unit_code", "Військова частина", "code"],
        ["mp_unit_id", "Бригада", "unit"],
        ["region_id", "Регіон (область)", "region"]
      ],
      burial: [["burial_place", "Місце поховання"], ["burial_date", "Дата поховання", "date"]]
    },
    "300": {
      person: [
        ["last_name", "Прізвище"],
        ["first_name", "Ім’я"],
        ["patronymic", "По батькові"],
        ["callsign", "Позивний"],
        ["birth_date", "Дата народження", "date"],
        ["phone", "Номер телефону", "phone"],
        ["military_unit_code", "Військова частина", "code"],
        ["mp_unit_id", "Бригада", "unit"],
        ["region_id", "Регіон (область)", "region"],
        ["wound_date", "Дата поранення", "date"]
      ]
    },
    bzv: {
      person: [
        ["last_name", "Прізвище"],
        ["first_name", "Ім’я"],
        ["patronymic", "По батькові"],
        ["callsign", "Позивний"],
        ["birth_date", "Дата народження", "date"],
        ["military_unit_code", "Військова частина", "code"],
        ["mp_unit_id", "Бригада", "unit"],
        ["region_id", "Регіон (область)", "region"]
      ]
    },
    pol: {
      person: [
        ["last_name", "Прізвище"],
        ["first_name", "Ім’я"],
        ["patronymic", "По батькові"],
        ["callsign", "Позивний"],
        ["birth_date", "Дата народження", "date"],
        ["phone", "Номер телефону", "phone"],
        ["military_unit_code", "Військова частина", "code"],
        ["mp_unit_id", "Бригада", "unit"],
        ["region_id", "Регіон (область)", "region"]
      ]
    },
    vet: {
      person: [
        ["last_name", "Прізвище"],
        ["first_name", "Ім’я"],
        ["patronymic", "По батькові"],
        ["callsign", "Позивний"],
        ["birth_date", "Дата народження", "date"],
        ["phone", "Номер телефону", "phone"],
        ["military_unit_code", "Військова частина", "code"],
        ["mp_unit_id", "Бригада", "unit"],
        ["region_id", "Регіон (область)", "region"],
        ["settlement", "Місце проживання"]
      ]
    }
  };
  const P_LABELS = Object.fromEntries([["p_comment", "Примітки"], ...Object.values(PERSON_FIELDS).flatMap((m) => Object.values(m).flat()).map(([k, l]) => ["p_" + k, l])]);
  const UNIT_CODES = ["А0216", "А0878", "А1275", "А1325", "А1965", "А2062", "А2611", "А2613", "А2777", "А2802", "А3821", "А4210", "А4217", "А4548", "А4635", "А4765", "А4822", "А4916", "А4935", "А5025", "А5074", "А7053", "А7382"];
  const unitCodes = () => [.../* @__PURE__ */ new Set([...UNIT_CODES, ...cases.map((c) => c.person.military_unit_code).filter(Boolean)])].sort((a, b) => a.localeCompare(b, "uk"));
  let tab = "all";
  function phoneOf(el) {
    const raw = el.value.trim();
    const r = V.normalizePhone(raw);
    let hint = el.parentElement.querySelector(".field-err");
    if (!hint) {
      hint = document.createElement("span");
      hint.className = "field-err";
      el.after(hint);
    }
    const bad = raw && !r.value;
    el.classList.toggle("is-bad", !!bad);
    hint.textContent = bad ? `Невірний номер (${raw.replace(/\D/g, "").length} цифр) — не збережено. Приклад: 050 123 45 67` : r.warning || "";
    if (bad) {
      Persons.toast("Телефон введено з помилкою — не збережено");
      el.focus();
      return void 0;
    }
    return r.value;
  }
  function phonesInText(el) {
    const ex = V.extractPhones(el.value);
    const phones = ex.phones;
    const bad = ex.bad.filter((r) => /^(\+|0|380|80)/.test(r.trim()) && r.replace(/\D/g, "").length >= 9);
    let hint = el.parentElement.querySelector(".field-err");
    if (!hint) {
      hint = document.createElement("span");
      hint.className = "field-err";
      el.after(hint);
    }
    el.classList.toggle("is-bad", bad.length > 0);
    hint.textContent = bad.length ? `Невірний номер: ${bad.join(", ")} — не збережено. Приклад: 050 123 45 67, іноземний — з «+»` : phones.map((p) => p.warning).filter((w) => w && /ноземн/.test(w))[0] || "";
    if (bad.length) {
      Persons.toast("Телефон введено з помилкою — не збережено");
      el.focus();
      return false;
    }
    return true;
  }
  const nm = (x) => V.normalizeName(x).value || null;
  const badName = (...xs) => {
    const e = xs.map((x) => V.normalizeName(x).error).find(Boolean);
    if (e) Persons.toast("ПІБ: " + e);
    return !!e;
  };
  const esc = (s) => String(s != null ? s : "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const openPerson = (id) => {
    returnTo = current ? current.id : null;
    document.querySelector('.tab[data-tab="registry"]').click();
    Persons.openForm(id);
  };
  const secDefs = (sec) => defs.filter((d) => (d.section || "other") === sec);
  const contactOf = (c) => c.kin.find((k) => k.person.id === c.contact_person_id) || c.kin[0] || null;
  async function openCase(id, noPush) {
    current = cases.find((c2) => c2.id === id);
    if (!current) return;
    $("cab-list").hidden = true;
    $("cab-case").hidden = false;
    if (!noPush) history.pushState({ view: "case" }, "");
    window.scrollTo(0, 0);
    tab = "all";
    const c = current, p = c.person;
    keep("cab_case", c.journal_id);
    if (isNew(c) || !seen.has(c.id)) {
      const at = (/* @__PURE__ */ new Date()).toISOString();
      seen.set(c.id, at);
      db.from("case_seen").upsert({ case_id: c.id, user_id: me, seen_at: at }, { onConflict: "user_id,case_id" }).then(() => badge());
    }
    $("case-link").onclick = () => copyLink(`?case=${encodeURIComponent(c.journal_id)}`, `Посилання на справу ${c.journal_id} скопійовано`);
    $("case-open-person").onclick = () => openPerson(p.id);
    const sSel = $("case-status");
    sSel.innerHTML = "";
    statuses.forEach((s) => sSel.add(new Option(s.name, s.name)));
    if (c.status && !statuses.some((s) => s.name === c.status)) sSel.add(new Option(c.status, c.status));
    sSel.value = c.status || "";
    const staffSel = (id2, val, empty) => {
      const sel = $(id2);
      sel.innerHTML = `<option value="">${empty}</option>`;
      [...staff].forEach(([uid, n]) => sel.add(new Option(n, uid)));
      sel.value = val || "";
      return sel;
    };
    const eSel = staffSel("case-exec", c.executor_id, "— не призначено —");
    const rSel = staffSel("case-resp", c.responsible_id, "— не вказано —");
    const cSel = $("case-cell");
    cSel.innerHTML = '<option value="">— не вказано —</option>';
    [...Persons.ctx().cells].forEach(([cid, n]) => cSel.add(new Option(n, cid)));
    cSel.value = c.cell_id || "";
    cSel.disabled = !!acc().readOnly;
    sSel.onchange = () => saveCase({ status: sSel.value });
    eSel.onchange = () => saveCase({ executor_id: eSel.value || null });
    rSel.onchange = () => saveCase({ responsible_id: rSel.value || null });
    cSel.onchange = () => saveCase({ cell_id: cSel.value ? Number(cSel.value) : null });
    $("case-take").onclick = () => {
      eSel.value = me;
      saveCase({ executor_id: me });
    };
    renderHelpers();
    $("case-history-box").open = window.matchMedia("(min-width: 961px)").matches;
    const legacy = [c.vals.executor_legacy && `${ui().exec} — ${c.vals.executor_legacy}`, c.vals.responsible && `відповідальний — ${c.vals.responsible}`].filter(Boolean);
    $("case-legacy").textContent = legacy.length ? `Як було в журналі: ${legacy.join("; ")}` : "";
    renderHead();
    renderStages();
    loadHistory();
  }
  function renderHead() {
    const c = current, p = c.person;
    $("case-title").textContent = fio(p) + (p.callsign ? ` «${p.callsign}»` : "");
    const sub = $("case-sub");
    sub.textContent = `${c.journal_id} · ${ui().word}`;
    if (p.death_date) {
      const d = document.createElement("b");
      d.className = "death-date";
      d.textContent = `дата смерті ${fmt(p.death_date)}`;
      sub.append(" · ", d);
    }
    sub.append((p.burial_date ? ` · поховання ${fmt(p.burial_date)}` : "") + (p.wound_date ? ` · поранення ${fmt(p.wound_date)}` : "") + (c.next ? ` · далі: ${c.next.label}, ${dueText(c.next)}` : ""));
    $("case-take").hidden = c.executor_id === me;
    const box = $("case-contact");
    const k = contactOf(c);
    const docsLink = () => {
      const d = defs.find((x) => x.kind === "link" && safeUrl(c.vals[x.key]));
      if (!d) return;
      const a = document.createElement("a");
      a.className = "case-docs";
      a.href = c.vals[d.key];
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "📁 Документи";
      a.title = d.label;
      box.append(" · ", a);
    };
    if (!k) {
      box.innerHTML = '<span class="muted">Контактну особу не вказано — додайте рідних у розділі «Родина».</span>';
      docsLink();
      return;
    }
    box.innerHTML = '<span class="muted">Контактна особа:</span> <button type="button" class="btn-link case-contact-name" title="Відкрити картку в реєстрі"></button> <span class="muted"></span> <b class="case-phone"></b>';
    box.children[1].textContent = fio(k.person);
    box.children[1].onclick = () => openPerson(k.person.id);
    box.children[2].textContent = `(${k.relation_degree})`;
    box.children[3].textContent = k.person.phone ? V.formatPhone(k.person.phone) : "без телефону";
    docsLink();
  }
  function renderHelpers() {
    const c = current;
    const box = $("case-helpers");
    const names = (c.helper_ids || []).map((u) => staff.get(u)).filter(Boolean);
    box.innerHTML = `<summary></summary><div class="case-helpers-list"></div>`;
    box.firstChild.textContent = names.length ? names.join(", ") : "— ніхто —";
    [...staff].forEach(([uid, n]) => {
      if (uid === c.executor_id) return;
      const l = document.createElement("label");
      l.innerHTML = '<input type="checkbox"> <span></span>';
      l.lastChild.textContent = n;
      l.firstChild.checked = (c.helper_ids || []).includes(uid);
      l.firstChild.onchange = async () => {
        const set = new Set(c.helper_ids || []);
        l.firstChild.checked ? set.add(uid) : set.delete(uid);
        await saveCase({ helper_ids: [...set] });
        box.firstChild.textContent = (c.helper_ids || []).map((u) => staff.get(u)).filter(Boolean).join(", ") || "— ніхто —";
      };
      box.lastChild.appendChild(l);
    });
  }
  function closeCase(fromPop) {
    $("cab-case").hidden = true;
    $("cab-list").hidden = false;
    current = null;
    keep("cab_case", null);
    if (!fromPop && history.state && history.state.view === "case") history.back();
    render();
  }
  const safeUrl = (u) => /^https?:\/\/\S+$/i.test(String(u || "").trim());
  function fieldEl(f) {
    var _a;
    const wrap = document.createElement("div");
    wrap.className = "stage" + (f.cls ? " " + f.cls : "") + (f.id.endsWith("p-death_date") ? " is-death" : "");
    const id = "cf-" + f.id;
    const v = (_a = f.value) != null ? _a : "";
    let control;
    if (f.kind === "date") control = `<input id="${id}" type="date" value="${/^\d{4}-\d{2}-\d{2}/.test(v) ? String(v).slice(0, 10) : ""}">`;
    else if (f.kind === "list" || f.kind === "bool") {
      const base = f.kind === "bool" ? ["Так", "Ні"] : f.options || [];
      const opts = [.../* @__PURE__ */ new Set([...base, ...v && !base.includes(v) ? [v] : []])];
      control = `<select id="${id}"><option value=""></option>${opts.map((o) => `<option>${esc(o)}</option>`).join("")}</select>`;
    } else if (f.kind === "map") {
      control = `<select id="${id}"><option value=""></option>${[...f.options].map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("")}</select>`;
    } else if (f.kind === "link") {
      control = `<span class="link-field"><input id="${id}" type="url" inputmode="url" placeholder="https://drive.google.com/…"><a class="link-open" target="_blank" rel="noopener" hidden>Відкрити ↗</a></span>`;
    } else if (f.kind === "line" || f.kind === "phone") control = `<input id="${id}" type="${f.kind === "phone" ? "tel" : "text"}">`;
    else control = `<textarea id="${id}" rows="1"></textarea>`;
    wrap.innerHTML = `<label for="${id}"></label>${control}<p class="stage-hint"></p>`;
    wrap.querySelector("label").textContent = f.label;
    const el = wrap.querySelector("#" + id);
    if (f.kind !== "date") el.value = f.kind === "phone" ? V.formatPhone(v) || "" : String(v);
    if (f.kind === "link") {
      const a = wrap.querySelector(".link-open");
      if (safeUrl(v)) {
        a.href = v;
        a.hidden = false;
      }
    }
    if (f.hint) {
      wrap.querySelector(".stage-hint").textContent = f.hint;
      wrap.classList.add(f.state || "is-due");
    }
    if (v !== "" && v != null) wrap.classList.add("is-done");
    if (f.kind === "date") {
      const okYear = () => !el.value || Number(el.value.slice(0, 4)) >= 1900;
      el.addEventListener("change", () => {
        if (okYear()) f.onSave(el.value.trim(), el);
      });
      el.addEventListener("blur", () => {
        if (okYear()) return;
        Persons.toast("Рік має бути з чотирьох цифр, наприклад 2026");
        el.value = /^\d{4}-\d{2}-\d{2}/.test(v) ? String(v).slice(0, 10) : "";
      });
    } else el.addEventListener("change", () => f.onSave(el.value.trim(), el));
    if (el.tagName === "TEXTAREA") {
      const grow = () => {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      };
      el.addEventListener("input", grow);
      setTimeout(grow);
    }
    return wrap;
  }
  function sectionFields(sec) {
    const c = current, p = c.person;
    const { units, regions } = Persons.ctx();
    const out = [];
    ((PERSON_FIELDS[module] || {})[sec] || []).forEach(([key, label, type]) => {
      const kind = type === "code" ? "list" : type === "date" ? "date" : type === "unit" || type === "region" ? "map" : type === "phone" ? "phone" : key === "comment" ? "text" : "line";
      out.push({
        id: "p-" + key,
        label,
        kind,
        options: type === "code" ? unitCodes() : type === "unit" ? units : type === "region" ? regions : null,
        value: p[key],
        onSave: (val, el) => savePerson(key, val, type, el)
      });
    });
    secDefs(sec).forEach((d) => {
      var _a;
      const v = (_a = c.vals[d.key]) != null ? _a : "";
      const f = {
        id: "s-" + d.key,
        label: d.label,
        kind: d.kind === "text" ? "text" : d.kind,
        options: d.options,
        value: v,
        onSave: (val, el) => {
          if (d.kind === "link" && val && !safeUrl(val)) {
            Persons.toast("Вставте повне посилання, що починається з https://");
            el.value = v;
            return;
          }
          if (/контакт/i.test(d.label) && !phonesInText(el)) return;
          saveValue(d.key, val);
        }
      };
      if (!isClosed(c) && d.remind_after && !v && c.vals[d.remind_after] && /^\d{4}-\d{2}-\d{2}/.test(c.vals[d.remind_after])) {
        const due = addDays(c.vals[d.remind_after].slice(0, 10), d.remind_days || 0);
        f.hint = `Потрібно до ${fmt(due)}`;
        f.state = due < today() ? "is-overdue" : "is-due";
      }
      out.push(f);
    });
    return out;
  }
  const isFilled = (f) => f.value !== "" && f.value != null;
  let stagesPending = false;
  const editingInCase = () => {
    const a = document.activeElement;
    return !!a && !$("cab-case").hidden && $("cab-case").contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  };
  function refreshStages() {
    if (editingInCase()) {
      stagesPending = true;
      return;
    }
    stagesPending = false;
    renderStages();
  }
  function renderStages() {
    stagesPending = false;
    const c = current;
    const secs = SECTIONS[module].filter(([k]) => k === "family" || sectionFields(k).length);
    if (tab !== "all" && !secs.some(([k]) => k === tab)) tab = "all";
    const tabs = $("case-tabs");
    tabs.innerHTML = "";
    const chip = (k, label, count, crit) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "qchip case-tab sec-" + k + (crit ? " qchip-crit" : "");
      b.setAttribute("aria-pressed", String(k === tab));
      b.innerHTML = "<span></span> <b></b>";
      b.firstChild.textContent = label;
      b.lastChild.textContent = count;
      b.onclick = () => {
        tab = k;
        renderStages();
      };
      tabs.appendChild(b);
    };
    const all = secs.filter(([k]) => k !== "family").flatMap(([k]) => sectionFields(k));
    chip("all", "Усі розділи", `${all.filter(isFilled).length}/${all.length}`, false);
    secs.forEach(([k, label]) => {
      const fs = sectionFields(k);
      chip(k, label, k === "family" ? String(c.kin.length) : `${fs.filter(isFilled).length}/${fs.length}`, fs.some((f) => f.state === "is-overdue"));
    });
    const box = $("case-stages");
    box.innerHTML = "";
    secs.filter(([k]) => tab === "all" || k === tab).forEach(([k, label]) => {
      if (tab === "all") {
        const h = document.createElement("h3");
        h.className = "case-sec-title sec-" + k;
        h.textContent = label;
        box.appendChild(h);
      }
      if (k === "family") box.appendChild(familyEl());
      const fs = sectionFields(k);
      const shown = fs.filter((f) => isFilled(f) || f.hint), hidden = fs.filter((f) => !isFilled(f) && !f.hint);
      if (shown.length) {
        const grid = document.createElement("div");
        grid.className = "case-stages";
        shown.forEach((f) => grid.appendChild(fieldEl(f)));
        box.appendChild(grid);
      }
      if (hidden.length) {
        const det = document.createElement("details");
        det.className = "case-empty";
        det.open = tab !== "all" && !shown.length || emptyOpen.has(k);
        det.innerHTML = `<summary>Незаповнені поля (${hidden.length}): ${esc(hidden.map((f) => f.label).join(", "))}</summary><div class="case-stages"></div>`;
        det.addEventListener("toggle", () => {
          det.open ? emptyOpen.add(k) : emptyOpen.delete(k);
        });
        hidden.forEach((f) => det.lastChild.appendChild(fieldEl(f)));
        box.appendChild(det);
      }
    });
    renderMissing(secs);
    renderSummary(secs);
    const nb = $("case-notes");
    nb.innerHTML = "";
    nb.appendChild(fieldEl({ id: "p-comment", label: "Примітки (з журналу й картки)", kind: "text", value: c.person.comment, onSave: (val, el) => savePerson("comment", val, null, el) }));
  }
  const emptyOpen = /* @__PURE__ */ new Set();
  const CRIT = /* @__PURE__ */ new Set(["p-last_name", "p-first_name", "p-birth_date", "p-death_date", "p-wound_date", "p-military_unit_code", "p-mp_unit_id", "s-notice_date", "s-rank", "s-appeal_date"]);
  function showVal(f) {
    if (!isFilled(f)) return "—";
    if (f.kind === "date") return fmt(String(f.value));
    if (f.kind === "map") return f.options.get(Number(f.value)) || f.options.get(f.value) || String(f.value);
    if (f.kind === "phone") return V.formatPhone(f.value) || String(f.value);
    if (f.kind === "link") return "посилання ✓";
    return String(f.value);
  }
  function renderMissing(secs) {
    const c = current;
    const box = $("case-missing");
    box.innerHTML = "";
    const k = contactOf(c);
    const crit = [], soft = [];
    const top = () => window.scrollTo({ top: 0, behavior: "smooth" });
    const goField = (key, f) => () => {
      tab = "all";
      emptyOpen.add(key);
      renderStages();
      const el = document.getElementById("cf-" + f.id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }
    };
    const goFamily = () => {
      tab = "family";
      renderStages();
      $("case-tabs").scrollIntoView({ behavior: "smooth", block: "start" });
      const d = document.querySelector(".fam-add");
      if (d && !c.kin.length) d.open = true;
    };
    if (!c.status) crit.push(["Статус", top]);
    if (!c.executor_id) crit.push(["Виконавець", top]);
    if (!c.cell_id) crit.push(["Осередок", top]);
    if (!k) crit.push(["Контактна особа (рідних не додано)", goFamily]);
    else if (!k.person.phone) crit.push(["Телефон контактної особи", goFamily]);
    secs.filter(([key]) => key !== "family").forEach(([key]) => sectionFields(key).forEach((f) => {
      if (f.state === "is-overdue") crit.push([`${f.label} — прострочено`, goField(key, f)]);
      else if (!isFilled(f)) (CRIT.has(f.id) ? crit : soft).push([f.label, goField(key, f)]);
    }));
    const line = (cls, title, items) => {
      if (!items.length) return;
      const p = document.createElement("p");
      p.className = "miss " + cls;
      const b = document.createElement("b");
      b.textContent = title;
      p.appendChild(b);
      items.forEach(([label, go]) => {
        const x = document.createElement("button");
        x.type = "button";
        x.className = "miss-chip";
        x.textContent = label;
        x.onclick = go;
        p.append(" ", x);
      });
      box.appendChild(p);
    };
    line("miss-crit", `Потрібно заповнити (${crit.length}):`, crit);
    if (soft.length) {
      const det = document.createElement("details");
      det.className = "miss miss-soft";
      det.innerHTML = "<summary></summary>";
      det.firstChild.textContent = `Бажано заповнити (${soft.length})`;
      soft.forEach(([label, go]) => {
        const x = document.createElement("button");
        x.type = "button";
        x.className = "miss-chip";
        x.textContent = label;
        x.onclick = go;
        det.append(" ", x);
      });
      det.open = missOpen;
      det.addEventListener("toggle", () => {
        missOpen = det.open;
      });
      box.appendChild(det);
    }
    if (!crit.length && !soft.length) {
      const p = document.createElement("p");
      p.className = "miss miss-ok";
      p.textContent = "Усе заповнено.";
      box.appendChild(p);
    }
  }
  let missOpen = false;
  function syncAll() {
    const c = current;
    $("case-status").value = c.status || "";
    $("case-exec").value = c.executor_id || "";
    $("case-resp").value = c.responsible_id || "";
    $("case-cell").value = c.cell_id || "";
    renderHelpers();
    renderHead();
    renderStages();
  }
  function renderSummary(secs) {
    const c = current;
    const box = $("case-summary");
    box.innerHTML = "";
    let empty = 0, crit = 0;
    const group = (title, key) => {
      const g = document.createElement("div");
      g.className = "sum-group sec-" + key;
      g.innerHTML = '<h3></h3><div class="sum-grid"></div>';
      g.firstChild.textContent = title;
      box.appendChild(g);
      return g.lastChild;
    };
    const add = (grid, f, level, custom) => {
      const filled = f.text !== void 0 ? !!f.text : isFilled(f);
      const state = filled ? "" : level === "crit" ? "is-crit" : "is-empty";
      if (!filled) {
        empty++;
        if (level === "crit") crit++;
      }
      const d = document.createElement("div");
      d.className = "sum-cell" + (state ? " " + state : "") + (f.wide ? " sum-wide" : "") + (f.id === "p-death_date" ? " is-death" : "");
      d.innerHTML = '<span class="sum-l"></span><span class="sum-v"></span>';
      d.firstChild.textContent = f.label;
      d.lastChild.textContent = f.text !== void 0 ? f.text || "—" : showVal(f);
      if (f.readonly || window.ACCESS && window.ACCESS.readOnly) {
        d.classList.add("is-ro");
        grid.appendChild(d);
        return d;
      }
      const open = () => {
        if (d.classList.contains("is-edit")) return;
        if (custom) {
          custom(d);
          return;
        }
        d.classList.add("is-edit");
        d.lastChild.remove();
        const ed = fieldEl({ ...f, id: "sum-" + f.id, hint: null });
        ed.className = "sum-edit";
        d.appendChild(ed);
        const inp = ed.querySelector("input, select, textarea");
        inp.focus();
        inp.addEventListener("blur", () => setTimeout(() => {
          if (current === c && !inp.classList.contains("is-bad") && document.activeElement !== inp) renderSummary(secs);
        }, 250));
      };
      d.tabIndex = 0;
      d.title = "Натисніть, щоб змінити";
      d.onclick = open;
      d.onkeydown = (e) => {
        if (e.key === "Enter" && e.target === d) open();
      };
      grid.appendChild(d);
      return d;
    };
    const k = contactOf(c);
    const cells = Persons.ctx().cells;
    const save = (patch) => async () => {
      await saveCase(patch());
      syncAll();
    };
    const head = group("Справа", "head");
    add(head, { id: "h-status", label: "Статус", kind: "list", options: statuses.map((x) => x.name), value: c.status, onSave: (v) => {
      if (v) saveCase({ status: v }).then(syncAll);
    } }, "crit");
    add(head, { id: "h-exec", label: "Виконавець", kind: "map", options: staff, value: c.executor_id, onSave: (v) => saveCase({ executor_id: v || null }).then(syncAll) }, "crit");
    add(head, { id: "h-help", label: "Допомагають", text: (c.helper_ids || []).map((u) => staff.get(u)).filter(Boolean).join(", ") }, "soft", (d) => {
      d.classList.add("is-edit");
      d.lastChild.remove();
      const w = document.createElement("div");
      w.className = "sum-checks";
      [...staff].filter(([uid]) => uid !== c.executor_id).forEach(([uid, n]) => {
        const l = document.createElement("label");
        l.innerHTML = '<input type="checkbox"> <span></span>';
        l.lastChild.textContent = n;
        l.firstChild.checked = (c.helper_ids || []).includes(uid);
        l.firstChild.onchange = () => {
          const set = new Set(c.helper_ids || []);
          l.firstChild.checked ? set.add(uid) : set.delete(uid);
          saveCase({ helper_ids: [...set] }).then(() => {
            renderHelpers();
          });
        };
        w.appendChild(l);
      });
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "btn-link";
      ok.textContent = "Готово";
      ok.onclick = (e) => {
        e.stopPropagation();
        renderSummary(secs);
      };
      w.appendChild(ok);
      d.appendChild(w);
    });
    add(head, { id: "h-resp", label: "Відповідальний (по осередку)", kind: "map", options: staff, value: c.responsible_id, onSave: (v) => saveCase({ responsible_id: v || null }).then(syncAll) }, "soft");
    add(head, { id: "h-cell", label: "Осередок", kind: "map", options: cells, value: c.cell_id, readonly: !!acc().readOnly, onSave: (v) => saveCase({ cell_id: v ? Number(v) : null }).then(syncAll) }, "crit");
    add(head, {
      id: "h-contact",
      label: "Контактна особа",
      kind: "map",
      options: new Map(c.kin.map((x) => [x.person.id, `${fio(x.person)} (${x.relation_degree})`])),
      value: k ? k.person.id : "",
      readonly: !c.kin.length,
      onSave: (v) => {
        if (v) saveCase({ contact_person_id: v }).then(syncAll);
      }
    }, "crit");
    secs.forEach(([key, label]) => {
      const grid = group(label, key);
      if (key === "family") {
        c.kin.forEach((x, i) => {
          const n = c.kin.length > 1 ? ` ${i + 1}` : "";
          add(grid, { id: "k-n" + i, label: "Родич" + n, text: fio(x.person) }, "soft", () => openPerson(x.person.id));
          add(grid, { id: "k-d" + i, label: "Спорідненість" + n, kind: "list", options: OPT.relation_degree, value: x.relation_degree, onSave: async (v) => {
            if (!v) return;
            const { error } = await db.from("military_relations").update({ relation_degree: v }).eq("id", x.id);
            if (error) {
              console.error(error);
              Persons.toast("Не вдалося зберегти");
              return;
            }
            x.relation_degree = v;
            Persons.toast("Збережено");
            syncAll();
          } }, "soft");
          add(grid, { id: "k-p" + i, label: "Телефон" + n, kind: "phone", value: x.person.phone, onSave: async (v, el) => {
            const ph = phoneOf(el);
            if (ph === void 0) return;
            if (await updPerson(x.person.id, { phone: ph })) {
              x.person.phone = ph;
              syncAll();
            }
          } }, x === k ? "crit" : "soft");
          add(grid, { id: "k-s" + i, label: "Населений пункт, адреса" + n, kind: "line", value: x.person.settlement, onSave: async (v) => {
            if (await updPerson(x.person.id, { settlement: v || null })) {
              x.person.settlement = v || null;
              syncAll();
            }
          } }, "soft");
        });
        add(grid, { id: "k-add", label: "Рідні", text: c.kin.length ? "+ додати ще родича" : "" }, c.kin.length ? "soft" : "crit", () => {
          tab = "family";
          renderStages();
          $("case-tabs").scrollIntoView({ behavior: "smooth", block: "start" });
          const det = document.querySelector(".fam-add");
          if (det) {
            det.open = true;
            const i = det.querySelector("input");
            if (i) i.focus({ preventScroll: true });
          }
        });
        if (!c.kin.length) grid.lastChild.querySelector(".sum-v").textContent = "не додано — натисніть, щоб додати";
      }
      sectionFields(key).forEach((f) => add(grid, f, CRIT.has(f.id) || f.state === "is-overdue" ? "crit" : "soft"));
    });
    add(group("Примітки", "notes"), { id: "p-comment", label: "Примітки (з журналу й картки)", kind: "text", value: c.person.comment, wide: true, onSave: (val, el) => savePerson("comment", val, null, el).then(() => refreshStages()) }, "soft");
    $("case-summary-note").textContent = (empty ? `Незаповнено: ${empty}` + (crit ? `, з них важливих: ${crit} (червоні)` : "") + "." : "Усе заповнено.") + " Натисніть на будь-яке поле, щоб заповнити чи виправити — зберігається одразу.";
  }
  function familyEl() {
    const c = current;
    const wrap = document.createElement("div");
    wrap.className = "case-fam";
    const contact = contactOf(c);
    if (!c.kin.length) wrap.innerHTML = '<p class="muted">Рідних ще не додано.</p>';
    c.kin.forEach((k) => {
      const row = document.createElement("div");
      row.className = "fam-row";
      row.innerHTML = `
        <button type="button" class="btn-link fam-name" title="Відкрити картку в реєстрі"></button>
        <label>Спорідненість<select data-f="deg">${OPT.relation_degree.map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>
        <label>Телефон<input data-f="phone" type="tel"></label>
        <label>Населений пункт, адреса<input data-f="settlement"></label>
        <label class="fam-contact"><input type="radio" name="fam-contact"> контактна особа</label>`;
      const q = (f) => row.querySelector(`[data-f="${f}"]`);
      row.children[0].textContent = fio(k.person);
      row.children[0].onclick = () => openPerson(k.person.id);
      q("deg").value = k.relation_degree;
      q("phone").value = V.formatPhone(k.person.phone) || "";
      q("settlement").value = k.person.settlement || "";
      const radio = row.querySelector("[type=radio]");
      radio.checked = contact === k;
      radio.onchange = async () => {
        await saveCase({ contact_person_id: k.person.id });
        renderHead();
      };
      q("deg").onchange = async () => {
        const { error } = await db.from("military_relations").update({ relation_degree: q("deg").value }).eq("id", k.id);
        if (error) {
          console.error(error);
          Persons.toast("Не вдалося зберегти");
          return;
        }
        k.relation_degree = q("deg").value;
        Persons.toast("Збережено");
        renderHead();
      };
      q("phone").onchange = async () => {
        const ph = phoneOf(q("phone"));
        if (ph === void 0) return;
        if (await updPerson(k.person.id, { phone: ph })) {
          k.person.phone = ph;
          refreshStages();
          renderHead();
        }
      };
      q("settlement").onchange = async () => {
        const v = q("settlement").value.trim() || null;
        if (await updPerson(k.person.id, { settlement: v })) k.person.settlement = v;
      };
      wrap.appendChild(row);
    });
    const add = document.createElement("details");
    add.className = "fam-add";
    add.innerHTML = `<summary>+ Додати родича</summary>
      <form class="fam-row" novalidate>
        <label>Прізвище<input name="ln" required></label><label>Ім’я<input name="fn" required></label><label>По батькові<input name="pn"></label>
        <label>Спорідненість<select name="deg">${OPT.relation_degree.map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>
        <label>Телефон<input name="phone" type="tel"></label><label>Населений пункт, адреса<input name="st"></label>
        <button class="btn-primary btn-small" type="submit">Додати</button>
      </form>`;
    add.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      addKin(e.target);
    };
    wrap.appendChild(add);
    return wrap;
  }
  async function updPerson(id, patch) {
    const { error } = await db.from("persons").update(patch).eq("id", id);
    if (error) {
      console.error(error);
      Persons.toast(error.code === "23505" ? "Такий телефон уже є в іншій картці реєстру" : error.code === "23514" ? "Значення не пройшло перевірку (дата чи формат)" : "Не вдалося зберегти");
      return false;
    }
    Persons.toast("Збережено");
    return true;
  }
  async function addKin(form) {
    const c = current, p = c.person;
    const g = (n) => form.elements[n].value.trim();
    if (!g("ln") || !g("fn")) {
      Persons.toast("Вкажіть прізвище та ім’я");
      return;
    }
    if (badName(g("ln"), g("fn"), g("pn"))) return;
    const phv = phoneOf(form.elements.phone);
    if (phv === void 0) return;
    const ph = { value: phv };
    const btn = form.querySelector("button");
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const kinRec = { last_name: nm(g("ln")), first_name: nm(g("fn")), patronymic: g("pn") ? nm(g("pn")) : null, phone: ph.value, settlement: g("st") || null };
      const { data: res, error } = await db.rpc("add_case_kin", {
        p_case: c.id,
        p_last: kinRec.last_name,
        p_first: kinRec.first_name,
        p_patr: kinRec.patronymic || "",
        p_degree: g("deg"),
        p_phone: ph.value || "",
        p_settlement: kinRec.settlement || ""
      });
      if (error) {
        console.error(error);
        Persons.toast(error.code === "23505" ? "Людина з таким телефоном уже є в реєстрі — зверніться до адміністратора, щоб пов’язати картки" : "Не вдалося додати родича");
        return;
      }
      const np = { id: res.person_id, ...kinRec };
      const r2 = { data: { id: res.relation_id, related_person_id: p.id, relation_degree: g("deg") } };
      c.kin.push({ ...r2.data, person: np });
      if (module === "200" && c.status === "Родину не встановлено" && statuses.some((s) => s.name === "В роботі")) {
        await saveCase({ status: "В роботі" });
        $("case-status").value = "В роботі";
      }
      form.reset();
      Persons.toast("Родича додано");
      renderHead();
      refreshStages();
    } finally {
      btn.disabled = false;
    }
  }
  async function savePerson(key, val, type, el) {
    const c = current, p = c.person;
    let v = val || null;
    if (type === "phone") {
      v = phoneOf(el);
      if (v === void 0) return;
    }
    if (type === "unit" || type === "region") v = val ? Number(val) : null;
    if (["last_name", "first_name", "patronymic"].includes(key) && v && badName(v)) {
      el.value = p[key] || "";
      return;
    }
    if (key === "last_name" || key === "first_name") {
      if (!v) {
        Persons.toast("Прізвище та ім’я обов’язкові");
        el.value = p[key] || "";
        return;
      }
      v = nm(v);
    }
    if (key === "patronymic" && v) v = nm(v);
    const dd = key === "death_date" ? v : p.death_date, bd = key === "burial_date" ? v : p.burial_date;
    if ((key === "burial_date" || key === "death_date") && dd && bd && bd < dd) {
      Persons.toast("Дата поховання раніше дати загибелі — перевірте");
      el.value = p[key] || "";
      return;
    }
    if (!await updPerson(p.id, { [key]: v })) {
      refreshStages();
      return;
    }
    p[key] = v;
    renderHead();
    if (key !== "comment") refreshStages();
    loadHistory();
  }
  function openNew() {
    const d = $("cab-new");
    d.querySelector("form").reset();
    $("cab-new-title").textContent = ui().newTitle;
    const sel = $("cab-new-cell");
    sel.innerHTML = '<option value="">— не вказано —</option>';
    const A = acc();
    if (!isAdmin) sel.innerHTML = "";
    [...Persons.ctx().cells].filter(([cid]) => isAdmin || A.cells.includes(cid)).forEach(([cid, n]) => sel.add(new Option(n, cid)));
    if (!isAdmin && !sel.options.length) {
      Persons.toast("Вам не призначено жодного осередку — зверніться до адміністратора");
      return;
    }
    d.showModal();
  }
  async function mirrorStatus() {
    const el = $("cab-mirror");
    if (!el) return;
    const { data } = await db.rpc("mirror_status");
    if (!data || !(data.sheet_200 || data.sheet_300 || data.sheet_bzv || data.sheet_pol || data.sheet_vet)) return;
    const t = data.last_write ? new Date(data.last_write).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
    const bad = /^помилка/.test(data.last_status || "");
    el.innerHTML = "";
    el.append(bad ? "⚠ Google-дзеркало: помилка · " : `Google-дзеркало: оновлено ${t} · `);
    const links = [];
    [["200", data.sheet_200], ["300", data.sheet_300], ["БЗВ", data.sheet_bzv], ["Звільнені з полону", data.sheet_pol], ["Ветерани", data.sheet_vet]].forEach(([label, id]) => {
      if (!id) return;
      const same = links.find((l) => l[1] === id);
      if (same) same[0] += " / " + label;
      else links.push([label, id]);
    });
    links.forEach(([label, id], i) => {
      if (i) el.append(" · ");
      const a = document.createElement("a");
      a.href = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = label;
      el.append(a);
    });
    if (data.sheet_kids) {
      const a = document.createElement("a");
      a.href = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(data.sheet_kids)}/edit`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "анкети «Діти»";
      el.append(" · ", a);
    }
    const bkBad = /^помилка/.test(data.backup_status || "");
    const bk = data.backup_last ? new Date(data.backup_last).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
    el.append(bk && !bkBad ? ` · копія бази: ${bk}` : " · копія бази: ⚠ не налаштована");
    el.title = [data.last_status, data.backup_status].filter(Boolean).join("\n");
    el.classList.toggle("is-bad", bad);
    el.hidden = false;
  }
  let creating = false;
  async function submitNew(e) {
    e.preventDefault();
    const f = e.target;
    const g = (n) => f.elements[n].value.trim();
    if (!g("ln") || !g("fn")) {
      Persons.toast("Вкажіть прізвище та ім’я");
      return;
    }
    if (badName(g("ln"), g("fn"), g("pn"))) return;
    const full = [g("ln"), g("fn")].join(" ").toLowerCase();
    const dup = cases.find((c) => fio(c.person).toLowerCase().startsWith(full));
    if (dup && !confirm(`У кабінеті вже є справа ${dup.journal_id}: ${fio(dup.person)}. Усе одно створити нову?`)) return;
    if (creating) return;
    creating = true;
    const btn = f.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Створюємо…";
    let data, error;
    try {
      ({ data, error } = await db.rpc("create_case", {
        p_module: module,
        p_last: nm(g("ln")),
        p_first: nm(g("fn")),
        p_patr: g("pn") ? nm(g("pn")) : "",
        p_cell: g("cell") ? Number(g("cell")) : null
      }));
    } finally {
      creating = false;
      btn.disabled = false;
      btn.textContent = label;
    }
    if (error) {
      console.error(error);
      Persons.toast(/Немає доступу/.test(error.message || "") ? "Немає доступу до цього осередку" : "Не вдалося створити справу");
      return;
    }
    $("cab-new").close();
    await load();
    openCase(data);
  }
  async function saveValue(key, value) {
    const c = current;
    const { error } = await db.from("case_values").upsert(
      { case_id: c.id, stage_key: key, value: value || null, source: "app", updated_by: me, updated_at: (/* @__PURE__ */ new Date()).toISOString() },
      { onConflict: "case_id,stage_key" }
    );
    if (error) {
      console.error(error);
      Persons.toast("Не вдалося зберегти");
      return;
    }
    c.vals[key] = value || null;
    c.next = nextAction(c);
    Persons.toast("Збережено");
    renderHead();
    refreshStages();
    loadHistory();
  }
  async function saveCase(patch) {
    const c = current;
    let error;
    if ("cell_id" in patch && !isAdmin) {
      const mine = (acc().cells || []).includes(patch.cell_id);
      if (patch.cell_id && !mine && !confirm(`Передати справу в осередок «${Persons.ctx().cells.get(patch.cell_id) || ""}»?

Це не ваш осередок — після передачі справа зникне з вашого кабінету.`)) {
        $("case-cell").value = c.cell_id || "";
        renderHead();
        return false;
      }
      ({ error } = await db.rpc("set_case_cell", { p_case: c.id, p_cell: patch.cell_id }));
      const rest = { ...patch };
      delete rest.cell_id;
      if (!error && Object.keys(rest).length) ({ error } = await db.from("cases").update(rest).eq("id", c.id));
      if (!error && patch.cell_id && !mine) {
        Object.assign(c, patch);
        Persons.toast("Справу передано в інший осередок");
        closeCase();
        load();
        return;
      }
    } else ({ error } = await db.from("cases").update(patch).eq("id", c.id));
    if (error) {
      console.error(error);
      Persons.toast("Не вдалося зберегти" + (error.message && /осередок|доступу|перегляд/.test(error.message) ? ": " + error.message : ""));
      return;
    }
    Object.assign(c, patch);
    if ("status" in patch) {
      c.next = nextAction(c);
      renderHead();
      refreshStages();
    }
    $("case-take").hidden = c.executor_id === me;
    if ("executor_id" in patch) renderHelpers();
    Persons.toast("Збережено");
    loadHistory();
  }
  async function loadHistory() {
    const c = current;
    const { data } = await db.from("case_history").select("*").eq("case_id", c.id).order("changed_at", { ascending: false }).limit(100);
    const label = new Map(defs.map((d) => [d.key, d.label]));
    label.set("status", "Статус");
    label.set("executor", "Виконавець");
    label.set("cell", "Осередок");
    label.set("helpers", "Допомагають");
    label.set("responsible_staff", "Відповідальний (по осередку)");
    label.set("contact_person", "Контактна особа");
    Object.entries(P_LABELS).forEach(([k, l]) => label.set(k, l));
    const ul = $("case-history");
    ul.innerHTML = "";
    (data || []).forEach((h) => {
      const li = document.createElement("li");
      const src = h.source === "sheet" ? "у таблиці" : h.source === "import" ? "імпорт" : "у кабінеті";
      li.innerHTML = '<span class="muted"></span> <b></b>: <span></span>';
      li.children[0].textContent = `${new Date(h.changed_at).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" })} · ${staff.get(h.changed_by) || "—"} · ${src}`;
      li.children[1].textContent = label.get(h.field) || h.field;
      const fmtV = (x) => x && /^\d{4}-\d{2}-\d{2}$/.test(x) ? fmt(x) : x;
      li.children[2].textContent = h.old_value ? `${fmtV(h.old_value)} → ${fmtV(h.new_value) || "(порожньо)"}` : fmtV(h.new_value) || "(порожньо)";
      ul.appendChild(li);
    });
    if (!ul.children.length) ul.innerHTML = '<li class="muted">Змін ще не було.</li>';
  }
  async function copyLink(query, okText) {
    const url = `${location.origin}${location.pathname}${query}`;
    try {
      await navigator.clipboard.writeText(url);
      Persons.toast(okText);
    } catch (e) {
      prompt("Скопіюйте посилання:", url);
    }
  }
  async function openSettings() {
    var _a;
    const { data } = await db.from("case_stage_defs").select("*").eq("module", module).order("sort");
    const tb = $("cab-set-table").tBodies[0];
    tb.innerHTML = "";
    $("cab-set-title").textContent = `Поля справи — ${ui().short === ui().title ? ui().title : "кабінет " + ui().short}`;
    const keys = (data || []).map((d) => [d.key, d.label]);
    const row = (d) => {
      var _a2, _b;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input data-f="label"></td>
        <td><select data-f="section">${SECTIONS[module].filter(([k]) => k !== "family" || module).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}<option value="head">Шапка (з журналу)</option></select></td>
        <td><select data-f="kind"><option value="text">текст</option><option value="date">дата</option><option value="list">список</option><option value="bool">так/ні</option><option value="link">посилання</option></select></td>
        <td><input data-f="options" placeholder="через кому"></td>
        <td><select data-f="remind_after"><option value="">—</option>${keys.map(([k, l]) => `<option value="${k}">${l.replace(/</g, "&lt;")}</option>`).join("")}</select></td>
        <td><input data-f="remind_days" type="number" min="0" style="width:5rem"></td>
        <td><input data-f="sort" type="number" style="width:5rem"></td>
        <td><input data-f="active" type="checkbox"></td>
        <td><button type="button" class="btn-link" data-save>Зберегти</button></td>`;
      const q = (f) => tr.querySelector(`[data-f="${f}"]`);
      q("label").value = d.label || "";
      q("kind").value = d.kind || "text";
      q("section").value = d.section || "other";
      q("options").value = (d.options || []).join(", ");
      q("remind_after").value = d.remind_after || "";
      q("remind_days").value = (_a2 = d.remind_days) != null ? _a2 : "";
      q("sort").value = (_b = d.sort) != null ? _b : 0;
      q("active").checked = d.active !== false;
      tr.querySelector("[data-save]").onclick = async (ev) => {
        const sbtn = ev.currentTarget;
        if (sbtn.disabled) return;
        const rec = {
          module,
          label: q("label").value.trim(),
          kind: q("kind").value,
          section: q("section").value,
          options: q("options").value.split(",").map((x) => x.trim()).filter(Boolean),
          remind_after: q("remind_after").value || null,
          remind_days: q("remind_days").value === "" ? null : Number(q("remind_days").value),
          sort: Number(q("sort").value || 0),
          active: q("active").checked,
          sheet_column: d.sheet_column || q("label").value.trim()
        };
        if (!rec.label) {
          Persons.toast("Вкажіть назву етапу");
          return;
        }
        sbtn.disabled = true;
        const res = d.id ? await db.from("case_stage_defs").update(rec).eq("id", d.id) : await db.from("case_stage_defs").insert({ ...rec, key: "custom_" + Date.now().toString(36) });
        sbtn.disabled = false;
        if (res.error) {
          console.error(res.error);
          Persons.toast("Не вдалося зберегти етап");
          return;
        }
        Persons.toast("Етап збережено");
        openSettings();
      };
      return tr;
    };
    (data || []).forEach((d) => tb.appendChild(row(d)));
    tb.appendChild(row({ sort: (((_a = (data || []).slice(-1)[0]) == null ? void 0 : _a.sort) || 0) + 10, active: true }));
    if (!$("cab-settings").open) $("cab-settings").showModal();
  }
  async function openByJournal(jid) {
    module = /^300/.test(jid) ? "300" : /^БЗВ/i.test(jid) ? "bzv" : /^ПОЛ/i.test(jid) ? "pol" : /^ВЕТ/i.test(jid) ? "vet" : "200";
    await load();
    let c = cases.find((x) => x.journal_id === jid);
    if (!c && !withClosed) {
      withClosed = true;
      await load();
      c = cases.find((x) => x.journal_id === jid);
    }
    if (c) openCase(c.id);
    else Persons.toast(`Справу ${jid} не знайдено або немає доступу`);
  }
  const NOTE = {
    overdue: ["Прострочено", "n-over"],
    today: ["На сьогодні", "n-now"],
    new: ["Нова справа у вашому осередку", "n-new"],
    assigned: ["Вам призначено справу", "n-new"]
  };
  let notes = [], bellWired = false;
  async function badge() {
    const tabEl = document.querySelector('.tab[data-tab="cabinet"]');
    if (!tabEl || !db) return;
    const { data, error } = await db.rpc("my_notifications");
    if (error) {
      console.error(error);
      return;
    }
    notes = data || [];
    if (isAdmin) {
      const r = await db.rpc("robot_alert");
      if (r.data) notes = [{ kind: "robot", label: r.data }, ...notes];
    }
    if (window.Feedback) {
      const fb = await Feedback.counts().catch(() => ({ fresh: 0, replies: 0 }));
      if (fb.fresh) notes.push({ kind: "fb", label: `Нових пропозицій: ${fb.fresh}` });
      if (fb.replies) notes.push({ kind: "fb", label: `Відповіли на вашу пропозицію: ${fb.replies}` });
      Feedback.refreshDot();
    }
    appBadge(notes.length);
    const cnt = (k) => notes.filter((x) => x.kind === k).length;
    tabEl.textContent = "Кабінет";
    const pill = (n, cls, title) => {
      if (!n) return;
      const b = document.createElement("span");
      b.className = "tab-badge " + cls;
      b.textContent = n;
      b.title = title;
      tabEl.append(" ", b);
    };
    pill(cnt("new") + cnt("assigned"), "", "Нові та призначені вам справи");
    pill(cnt("overdue"), "tab-badge-over", "Прострочені дії у моїх справах");
    const bell = $("bell-btn");
    if (!bell) return;
    bell.hidden = false;
    const nb = $("bell-count");
    nb.textContent = notes.length > 99 ? "99+" : notes.length;
    nb.hidden = !notes.length;
    bell.classList.toggle("has-over", cnt("overdue") + cnt("robot") > 0);
    bell.title = notes.length ? `Сповіщень: ${notes.length}` : "Сповіщень немає";
    if (!bellWired) {
      bellWired = true;
      bell.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = $("bell-panel");
        p.hidden = !p.hidden;
        if (!p.hidden) renderBell();
      });
      document.addEventListener("click", (e) => {
        if (!e.target.closest("#bell-panel")) $("bell-panel").hidden = true;
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") $("bell-panel").hidden = true;
      });
      setInterval(() => {
        if (!document.hidden) badge();
      }, 5 * 60 * 1e3);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) badge();
      });
    }
    if (!$("bell-panel").hidden) renderBell();
  }
  const BASE_TITLE = document.title;
  let favBase = null;
  function appBadge(n) {
    document.title = n ? `(${n > 99 ? "99+" : n}) ${BASE_TITLE}` : BASE_TITLE;
    try {
      if ("setAppBadge" in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {
      });
    } catch (e) {
    }
    const link = document.querySelector('link[rel="icon"][sizes="32x32"]');
    if (!link) return;
    const draw = (img2) => {
      const c = document.createElement("canvas");
      c.width = c.height = 32;
      const g = c.getContext("2d");
      g.drawImage(img2, 0, 0, 32, 32);
      if (n) {
        g.fillStyle = "#d64545";
        g.beginPath();
        g.arc(22, 10, 10, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#fff";
        g.font = "bold 13px sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(n > 9 ? "9+" : String(n), 22, 11);
      }
      document.querySelectorAll('link[rel="icon"][type="image/svg+xml"]').forEach((l) => l.remove());
      link.href = c.toDataURL("image/png");
    };
    if (favBase) {
      draw(favBase);
      return;
    }
    const img = new Image();
    img.onload = () => {
      favBase = img;
      draw(img);
    };
    img.src = "icons/favicon-32.png";
  }
  function renderBell() {
    const p = $("bell-panel");
    p.innerHTML = "<h2>Сповіщення</h2>";
    if (!notes.length) {
      p.insertAdjacentHTML("beforeend", '<p class="muted">Нічого нового: прострочених дій, нових справ і відповідей немає.</p>');
      badgeHint(p);
      return;
    }
    notes.filter((x) => x.kind === "robot").forEach((x) => {
      const h = document.createElement("h3");
      h.className = "n-over";
      h.textContent = "⚠ Робот-дзеркало";
      p.appendChild(h);
      const m = document.createElement("p");
      m.className = "bell-robot";
      m.textContent = x.label + ". Дані в базі в порядку; не оновлюється лише Google-таблиця. Напишіть розробнику.";
      p.appendChild(m);
    });
    const fbn = notes.filter((x) => x.kind === "fb");
    if (fbn.length) {
      const h = document.createElement("h3");
      h.className = "n-new";
      h.textContent = "💬 Пропозиції";
      p.appendChild(h);
      const ul = document.createElement("ul");
      fbn.forEach((x) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bell-item";
        b.innerHTML = "<b></b>";
        b.firstChild.textContent = x.label;
        b.onclick = () => {
          p.hidden = true;
          Feedback.open();
        };
        li.appendChild(b);
        ul.appendChild(li);
      });
      p.appendChild(ul);
    }
    ["overdue", "today", "new", "assigned"].forEach((k) => {
      const list = notes.filter((x) => x.kind === k);
      if (!list.length) return;
      const h = document.createElement("h3");
      h.className = NOTE[k][1];
      h.textContent = `${NOTE[k][0]} — ${list.length}`;
      p.appendChild(h);
      const ul = document.createElement("ul");
      list.slice(0, 15).forEach((x) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bell-item";
        b.innerHTML = "<b></b><span></span>";
        b.firstChild.textContent = x.fio;
        b.lastChild.textContent = x.label ? `${x.label} · ${x.days < 0 ? `прострочено на ${-x.days} ${plural(-x.days, "день", "дні", "днів")}` : "сьогодні"}` : `справа ${x.journal_id}`;
        b.onclick = () => {
          p.hidden = true;
          document.querySelector('.tab[data-tab="cabinet"]').click();
          openByJournal(x.journal_id);
        };
        li.appendChild(b);
        ul.appendChild(li);
      });
      p.appendChild(ul);
      if (list.length > 15) {
        const m = document.createElement("p");
        m.className = "muted";
        m.textContent = `…і ще ${list.length - 15} — дивіться в кабінеті`;
        p.appendChild(m);
      }
    });
    badgeHint(p);
  }
  function badgeHint(p) {
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (!standalone || !("setAppBadge" in navigator) || !("Notification" in window)) return;
    const box = document.createElement("p");
    box.className = "bell-hint";
    if (Notification.permission === "default") {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-secondary btn-small";
      b.textContent = "📱 Показувати число на значку програми";
      b.onclick = async (e) => {
        e.stopPropagation();
        await Notification.requestPermission().catch(() => {
        });
        badge();
      };
      box.appendChild(b);
    } else if (Notification.permission === "denied") {
      box.classList.add("muted");
      box.textContent = "Число на значку вимкнено в налаштуваннях телефону: Параметри → Сповіщення → Реєстр → дозволити.";
    } else return;
    p.appendChild(box);
  }
  function openPreset(mod, ids, label) {
    module = mod;
    quick = "";
    preset = { ids: new Set(ids), label };
    withClosed = true;
    closedFor = mod;
    ["cab-search", "cab-status", "cab-exec", "cab-resp", "cab-mark", "cab-cell", "cab-from", "cab-to"].forEach((id) => {
      $(id).value = "";
    });
    if (!$("cab-case").hidden) {
      $("cab-case").hidden = true;
      $("cab-list").hidden = false;
      current = null;
    }
    document.querySelector('.tab[data-tab="cabinet"]').click();
  }
  return { init, load, openByJournal, badge, openPreset };
})();
