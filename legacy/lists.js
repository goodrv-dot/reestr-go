// АВТОМАТИЧНО з lists.js (tools/build-legacy.mjs) — не редагувати вручну
window.Lists = /* @__PURE__ */ (() => {
  const $ = (id) => document.getElementById(id);
  const LIST_ST = ["Відкритий", "Подано", "Закрито"];
  const MEMBER_ST = ["Підготовка", "Подано", "Виконано", "Відмовлено"];
  let db = null, me = null, isAdmin = false, ready = false;
  let lists = [], current = null, members = [], ops = /* @__PURE__ */ new Map(), listOps = [], hiddenCnt = 0;
  const fio = (p) => [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(" ");
  const fmt = (iso) => iso ? String(iso).slice(0, 10).split("-").reverse().join(".") : "";
  const esc = (s) => String(s != null ? s : "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const toast = (t) => Persons.toast(t);
  const ro = () => !!(window.ACCESS && window.ACCESS.readOnly);
  const canEditMeta = (l) => isAdmin || l.owner_id === me || (l.shared_with || []).includes(me);
  const canShare = (l) => isAdmin || l.owner_id === me;
  function init(client, userId, admin) {
    db = client;
    me = userId;
    isAdmin = admin;
    if (ready) return;
    ready = true;
    $("lists-new").addEventListener("click", createList);
    $("list-back").addEventListener("click", () => {
      current = null;
      showIndex();
    });
    const tab = (t) => document.querySelector(`.tab[data-tab="${t}"]`);
    const rb = $("reg-lists-btn");
    rb.hidden = !(window.ACCESS && window.ACCESS.lists);
    rb.addEventListener("click", () => {
      window.__listsFrom = "registry";
      tab("lists").click();
    });
    $("lists-to-cab").addEventListener("click", () => {
      const t = tab(window.__listsFrom || "cabinet");
      if (t && !t.hidden) t.click();
    });
    $("lists-noreg").hidden = !!(window.ACCESS && window.ACCESS.registry);
    $("list-meta").addEventListener("change", saveMeta);
    $("list-add-q").addEventListener("input", debounce(searchPeople, 350));
    $("list-hide-done").addEventListener("change", () => {
      if (current) renderMembers();
    });
    $("list-print").addEventListener("click", () => printList());
    $("list-excel").addEventListener("click", excel);
    $("list-delete").addEventListener("click", removeList);
    $("list-kids-send").addEventListener("click", kidsSend);
    $("ks-close").addEventListener("click", () => $("ks-dialog").close());
    $("ks-dialog").addEventListener("close", () => {
      clearInterval(ks.timer);
      if (ks.changed && current) loadMembers();
    });
    $("tolist-cancel").addEventListener("click", () => $("tolist-dialog").close());
    $("tolist-form").addEventListener("submit", submitToList);
    window.addEventListener("afterprint", () => document.body.classList.remove("print-mode"));
    const fb = $("tolist-filter-btn");
    fb.hidden = ro();
    fb.addEventListener("click", () => addDialog({ filter: true, label: `Усі особи за поточним пошуком і фільтрами: ${$("count").textContent || ""}`.trim() }));
  }
  const OVER_RE = / · (⚠ ПРОСТРОЧЕНО: перенесено на .+)$/;
  function nameInto(el, name) {
    const m = String(name || "").match(OVER_RE);
    el.textContent = m ? name.slice(0, m.index) : name;
    if (m) {
      const sp = document.createElement("span");
      sp.className = "list-overdue";
      sp.textContent = m[1];
      el.append(" ", sp);
    }
  }
  const debounce = (f, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => f(...a), ms);
    };
  };
  async function load() {
    if (!db) return;
    const from = document.querySelector(`.tab[data-tab="${window.__listsFrom || "cabinet"}"]`);
    $("lists-to-cab").hidden = !from || from.hidden;
    $("lists-to-cab").textContent = { registry: "← Особи", kids: "← Діти" }[window.__listsFrom || "cabinet"] || "← Кабінет";
    const [l, o] = await Promise.all([
      db.from("person_lists").select("*, person_list_members(count)").order("created_at", { ascending: false }),
      db.from("operators").select("user_id, full_name, role, can_lists, can_registry, active").order("full_name")
    ]);
    if (l.error) {
      console.error(l.error);
      $("lists-status").textContent = "Не вдалося завантажити списки.";
      return;
    }
    lists = l.data || [];
    ops = new Map((o.data || []).map((x) => [x.user_id, x.full_name]));
    listOps = (o.data || []).filter((x) => x.active && (x.role === "admin" || x.can_lists));
    $("lists-status").textContent = "";
    if (current) {
      const c = lists.find((x) => x.id === current.id);
      if (c) {
        current = c;
        return openList(c.id);
      }
    }
    showIndex();
  }
  function showIndex() {
    $("list-one").hidden = true;
    $("lists-index").hidden = false;
    const tb = $("lists-table").tBodies[0];
    tb.innerHTML = "";
    lists.forEach((l) => {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td><b></b><br><span class="muted"></span></td><td><span class="list-st"></span></td><td></td><td></td><td></td>';
      nameInto(tr.children[0].firstChild, l.name);
      tr.children[0].lastChild.textContent = l.description || "";
      const st = tr.children[1].firstChild;
      st.textContent = l.status;
      st.dataset.st = l.status;
      tr.children[2].textContent = l.due_date ? fmt(l.due_date) : "—";
      tr.children[3].textContent = l.person_list_members && l.person_list_members[0] ? l.person_list_members[0].count : 0;
      tr.children[4].textContent = (ops.get(l.owner_id) || "—") + ((l.shared_with || []).length ? ` · спільний (${l.shared_with.length})` : "");
      tr.addEventListener("click", () => openList(l.id));
      tb.appendChild(tr);
    });
    $("lists-table").hidden = !lists.length;
    $("lists-empty").hidden = !!lists.length;
    $("lists-new").hidden = ro();
  }
  async function createList() {
    const name = prompt("Назва списку (напр. «Представити до нагороди — листопад 2026»):");
    if (!name || !name.trim()) return;
    const btn = $("lists-new");
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const { data, error } = await db.from("person_lists").insert({ name: name.trim(), owner_id: me }).select("*").single();
      if (error) {
        console.error(error);
        toast("Не вдалося створити список");
        return;
      }
      lists.unshift({ ...data, person_list_members: [{ count: 0 }] });
      openList(data.id);
    } finally {
      btn.disabled = false;
    }
  }
  async function openList(id) {
    current = lists.find((x) => x.id === id);
    if (!current) {
      pendingSend = false;
      return;
    }
    if (pendingSend) {
      pendingSend = false;
      if (isKidsList(current) && !ro()) setTimeout(kidsSend, 0);
    }
    $("lists-index").hidden = true;
    $("list-one").hidden = false;
    window.scrollTo(0, 0);
    const l = current, f = $("list-meta");
    nameInto($("list-title"), l.name);
    $("list-owner").textContent = `Автор: ${ops.get(l.owner_id) || "—"} · створено ${fmt(l.created_at)}`;
    f.name.value = l.name;
    f.description.value = l.description || "";
    f.due_date.value = l.due_date || "";
    f.status.innerHTML = LIST_ST.map((s) => `<option>${s}</option>`).join("");
    f.status.value = l.status;
    f.columns.value = (l.columns || []).join(", ");
    const edit = canEditMeta(l) && !ro();
    [...f.elements].forEach((el) => {
      el.disabled = !edit;
    });
    const box = $("list-share");
    box.innerHTML = "";
    $("list-share-wrap").hidden = !canShare(l) || ro();
    listOps.filter((o) => o.user_id !== l.owner_id).forEach((o) => {
      const lab = document.createElement("label");
      lab.className = "check";
      lab.innerHTML = '<input type="checkbox"> <span></span>';
      lab.firstChild.value = o.user_id;
      lab.firstChild.checked = (l.shared_with || []).includes(o.user_id);
      lab.lastChild.textContent = o.full_name;
      lab.firstChild.addEventListener("change", saveShare);
      box.appendChild(lab);
    });
    if (!box.children.length) box.innerHTML = '<p class="muted">Немає інших співробітників із доступом «Списки».</p>';
    $("list-delete").hidden = !canShare(l) || ro();
    $("list-kids-send").hidden = ro() || !isKidsList(l);
    $("list-excel").hidden = !Persons.ctx().operator.can_export;
    $("list-add").hidden = ro();
    $("list-add-q").value = "";
    $("list-add-res").innerHTML = "";
    await loadMembers();
  }
  async function saveMeta(e) {
    if (e.target.closest("#list-share")) return;
    const l = current, f = $("list-meta");
    const patch = {
      name: f.name.value.trim() || l.name,
      description: f.description.value.trim() || null,
      due_date: f.due_date.value || null,
      status: f.status.value,
      columns: f.columns.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12)
    };
    const { error } = await db.from("person_lists").update(patch).eq("id", l.id);
    if (error) {
      console.error(error);
      toast("Не вдалося зберегти");
      return;
    }
    Object.assign(l, patch);
    $("list-title").textContent = l.name;
    toast("Збережено");
    if ("columns" in patch) renderMembers();
  }
  async function saveShare() {
    const l = current;
    const shared = [...$("list-share").querySelectorAll("input:checked")].map((i) => i.value);
    const { error } = await db.from("person_lists").update({ shared_with: shared }).eq("id", l.id);
    if (error) {
      console.error(error);
      toast("Не вдалося змінити доступ");
      return;
    }
    l.shared_with = shared;
    toast(shared.length ? `Список відкрито для: ${shared.length}` : "Список лише ваш");
  }
  async function removeList() {
    const l = current;
    if (!confirm(`Видалити список «${l.name}»?

Люди залишаться в реєстрі — зникне лише сам список і позначки в ньому.`)) return;
    const { error } = await db.from("person_lists").delete().eq("id", l.id);
    if (error) {
      console.error(error);
      toast("Не вдалося видалити");
      return;
    }
    lists = lists.filter((x) => x.id !== l.id);
    current = null;
    toast("Список видалено");
    showIndex();
  }
  const P_COLS = "id, last_name, first_name, patronymic, birth_date, military_status, death_date, wound_date, military_unit_code, mp_unit_id, mp_unit_other, phone, extra_phones, settlement, cell_id, journal, cases!cases_person_id_fkey(journal_id)";
  async function loadMembers() {
    $("list-status").textContent = "Завантажуємо…";
    const all = [];
    for (let from = 0; ; from += 1e3) {
      const { data, error } = await db.from("person_list_members").select(`person_id, status, note, extra, added_at, person:persons(${P_COLS})`).eq("list_id", current.id).order("added_at").range(from, from + 999);
      if (error) {
        console.error(error);
        $("list-status").textContent = "Не вдалося завантажити людей списку.";
        return;
      }
      all.push(...data);
      if (data.length < 1e3) break;
    }
    const ids = all.map((m) => m.person_id);
    const kin = /* @__PURE__ */ new Map();
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await db.from("military_relations").select("related_person_id, relation_degree, person:persons!military_relations_person_id_fkey(last_name, first_name, patronymic, phone)").in("related_person_id", ids.slice(i, i + 150)).order("created_at");
      (data || []).forEach((r) => {
        if (r.person && !kin.has(r.related_person_id)) kin.set(r.related_person_id, r);
      });
    }
    const rel = /* @__PURE__ */ new Map(), kids = /* @__PURE__ */ new Map();
    for (let i = 0; i < ids.length; i += 150) {
      const part = ids.slice(i, i + 150);
      const [r1, r2] = await Promise.all([
        db.from("military_relations").select("person_id, relation_degree, related_full_name, soldier:persons!military_relations_related_person_id_fkey(last_name, first_name, patronymic, cases!cases_person_id_fkey(journal_id))").in("person_id", part),
        db.from("children").select("person_id, full_name, birth_date, part_status, part_until").in("person_id", part).order("birth_date")
      ]);
      (r1.data || []).forEach((r) => {
        if (!rel.has(r.person_id)) rel.set(r.person_id, []);
        rel.get(r.person_id).push(r);
      });
      (r2.data || []).forEach((c2) => {
        if (!kids.has(c2.person_id)) kids.set(c2.person_id, []);
        kids.get(c2.person_id).push(c2);
      });
    }
    members = all.filter((m) => m.person).map((m) => ({ ...m, kin: kin.get(m.person_id) || null, rel: rel.get(m.person_id) || [], kids: kids.get(m.person_id) || [] }));
    const jk = (m) => jidOf(m.person) || "￿";
    members.sort((a, b) => jk(a).localeCompare(jk(b), "uk", { numeric: true }));
    hiddenCnt = all.length - members.length;
    const c = lists.find((x) => x.id === current.id);
    if (c) c.person_list_members = [{ count: members.length }];
    $("list-status").textContent = "";
    renderMembers();
  }
  const rankOf = (p) => {
    const j = p.journal || {};
    for (const k of Object.keys(j)) {
      const v = j[k] && (j[k]["Звання"] || j[k]["звання"]);
      if (v) return String(v);
    }
    return "";
  };
  const unitOf = (p) => {
    const u = Persons.ctx().units;
    return p.mp_unit_id ? u.get(p.mp_unit_id) || "" : p.mp_unit_other || "";
  };
  const eventOf = (p) => p.death_date ? `загибель ${fmt(p.death_date)}` : p.wound_date ? `поранення ${fmt(p.wound_date)}` : "";
  const jidOf = (p) => (p && p.cases || []).map((c) => c.journal_id).filter(Boolean).sort().join(", ");
  const caseOf = (m) => jidOf(m.person) || [...new Set((m.rel || []).flatMap((r) => (r.soldier && r.soldier.cases || []).map((c) => c.journal_id)))].sort().join(", ");
  const soldierOf = (m) => (m.rel || []).map((r) => `${r.relation_degree}: ${r.soldier ? fio(r.soldier) : r.related_full_name || "?"}`).join("; ");
  const ageOf = (iso) => {
    if (!iso) return null;
    const b = /* @__PURE__ */ new Date(iso + "T00:00:00"), t = /* @__PURE__ */ new Date();
    let a = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || t.getMonth() === b.getMonth() && t.getDate() < b.getDate()) a -= 1;
    return a;
  };
  const kidMark = (c) => c.part_status === "Виняток" ? " ⭐" : c.part_status === "Не включати" ? " ⛔" : "";
  const yearOf = (iso) => iso ? String(iso).slice(0, 4) : "";
  const kidRange = () => {
    const f = $("list-kid-from"), t = $("list-kid-to");
    const a = f && f.value !== "" ? Number(f.value) : null, b = t && t.value !== "" ? Number(t.value) : null;
    return a === null && b === null ? null : [a != null ? a : 0, b != null ? b : 99];
  };
  const todayIso = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const kidsIn = (m) => {
    const r = kidRange();
    if (!r) return m.kids || [];
    return (m.kids || []).filter((c) => c.part_status === "Виняток" && (!c.part_until || c.part_until >= todayIso()) || c.part_status !== "Не включати" && ageOf(c.birth_date) !== null && ageOf(c.birth_date) >= r[0] && ageOf(c.birth_date) <= r[1]);
  };
  const kidsOf = (m) => kidsIn(m).map((c) => `${c.full_name || "дитина"}, ${c.birth_date ? yearOf(c.birth_date) + " р.н. (" + ageOf(c.birth_date) + " р.)" : "рік народження невідомий"}${kidMark(c)}`).join("\n");
  const kidsAges = (m) => kidsIn(m).filter((c) => c.part_status !== "Не включати").map((c) => ageOf(c.birth_date)).filter((x) => x !== null).join(", ");
  const phonesOf = (m) => [m.person.phone, ...m.person.extra_phones || []].filter(Boolean).map((x) => V.formatPhone(x) || x).filter((x, i, a) => a.indexOf(x) === i).join(", ");
  const kinOf = (m) => m.kin ? `${m.kin.relation_degree}: ${fio(m.kin.person)}${m.kin.person.phone ? ", " + V.formatPhone(m.kin.person.phone) : ""}` : "";
  function columnsAll() {
    const cells = Persons.ctx().cells;
    const base = [
      ["case", "Справа", caseOf],
      ["fio", "ПІБ", (m) => fio(m.person)],
      ["soldier", "Ким доводиться бійцю", soldierOf],
      ["phone", "Телефон для зв’язку", phonesOf],
      ["addr", "Населений пункт, адреса", (m) => m.person.settlement || ""],
      ["kids", "Діти (ПІБ, рік народження)", kidsOf],
      ["kidsage", "Вік дітей", kidsAges],
      ["st", "Статус у списку", (m) => m.status],
      ["note", "Примітка", (m) => m.note || ""],
      ["kin", "Контакт родини (для бійця)", kinOf],
      ["bd", "Дата народження", (m) => fmt(m.person.birth_date)],
      ["mstat", "Статус особи", (m) => m.person.military_status || ""],
      ["rank", "Звання", (m) => rankOf(m.person)],
      ["vch", "В/ч", (m) => m.person.military_unit_code || ""],
      ["unit", "Бригада", (m) => unitOf(m.person)],
      ["event", "Подія", (m) => eventOf(m.person)],
      ["cell", "Осередок", (m) => cells.get(m.person.cell_id) || ""]
    ];
    return [...base, ...(current.columns || []).map((c) => ["x:" + c, c, (m) => (m.extra || {})[c] || ""])];
  }
  function renderMembers() {
    const cols = current.columns || [];
    const head = $("list-members").tHead.rows[0];
    head.innerHTML = "<th>№</th><th>Справа</th><th>ПІБ</th><th>Відомості</th><th>Статус у списку</th><th>Примітка</th>" + cols.map((c) => `<th>${esc(c)}</th>`).join("") + "<th></th>";
    const tb = $("list-members").tBodies[0];
    tb.innerHTML = "";
    const edit = !ro();
    const hideDone = $("list-hide-done") && $("list-hide-done").checked;
    const shown = hideDone ? members.filter((m) => m.status !== "Виконано") : members;
    if (hideDone && !shown.length && members.length) tb.innerHTML = '<tr><td colspan="9" class="muted">Усе виконано 🎉 Зніміть «Сховати виконані», щоб побачити всіх.</td></tr>';
    shown.forEach((m, i) => {
      const p = m.person;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i + 1}</td><td class="list-jid"></td><td><a class="btn-link list-fio"></a><br><span class="muted"></span></td><td class="muted"></td>
        <td><select data-f="status">${MEMBER_ST.map((s) => `<option>${s}</option>`).join("")}</select></td>
        <td><textarea data-f="note" rows="1" class="list-note"></textarea></td>${cols.map((c) => `<td><input data-x="${esc(c)}"></td>`).join("")}
        <td><button type="button" class="btn-link list-rm" title="Прибрати зі списку">✕</button></td>`;
      tr.querySelector(".list-fio").textContent = fio(p);
      const ownJ = (p.cases || []).map((c) => c.journal_id).filter(Boolean).sort();
      const noteJ = ownJ.length ? [] : [...new Set((String(m.note || "").match(/(?:200|300|БЗВ|ПОЛ|ВЕТ)-\d{4}/gi) || []).map((x) => x.toUpperCase()))];
      {
        const a = tr.querySelector(".list-fio");
        const jid = (ownJ.length ? ownJ : noteJ)[0];
        if (jid) {
          a.href = "?case=" + encodeURIComponent(jid);
          a.title = `Відкрити справу ${jid} у кабінеті (правий клік — у новій вкладці)`;
          a.onclick = (e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            window.__caseReturn = { tab: "lists", y: window.scrollY, name: current && current.name };
            document.querySelector('.tab[data-tab="cabinet"]').click();
            Cabinet.openByJournal(jid);
          };
        } else {
          a.href = "?person=" + encodeURIComponent(p.id);
          a.title = "Відкрити картку особи (правий клік — у новій вкладці)";
          a.onclick = (e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            window.__cardReturn = "lists";
            document.querySelector('.tab[data-tab="registry"]').click();
            Persons.openForm(p.id);
          };
        }
      }
      {
        const td = tr.querySelector(".list-jid");
        const jids = ownJ.length ? ownJ : noteJ;
        if (!ownJ.length && noteJ.length) td.title = "Справа, де ця людина — родич";
        if (!jids.length) td.innerHTML = '<span class="muted">—</span>';
        jids.forEach((j, k) => {
          const a = document.createElement("a");
          a.className = "btn-link";
          a.textContent = j;
          a.href = "?case=" + encodeURIComponent(j);
          a.title = "Відкрити справу (правий клік — у новій вкладці)";
          a.onclick = (e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            window.__caseReturn = { tab: "lists", y: window.scrollY, name: current && current.name };
            document.querySelector('.tab[data-tab="cabinet"]').click();
            Cabinet.openByJournal(j);
          };
          if (k) td.append(document.createElement("br"));
          td.append(a);
        });
      }
      tr.children[2].lastChild.textContent = [fmt(p.birth_date), p.military_status].filter(Boolean).join(" · ");
      tr.children[3].textContent = [rankOf(p), p.military_unit_code, unitOf(p), eventOf(p), kinOf(m)].filter(Boolean).join(" · ");
      {
        const own = V.callLink(p.phone), kin = m.kin ? V.callLink(m.kin.person.phone) : null;
        if (own) tr.children[2].append(" ", own);
        if (kin) tr.children[3].append(" ", kin);
      }
      const sel = tr.querySelector('[data-f="status"]');
      sel.value = m.status;
      sel.disabled = !edit;
      sel.onchange = () => saveMember(m, { status: sel.value });
      const note = tr.querySelector('[data-f="note"]');
      note.value = m.note || "";
      note.disabled = !edit;
      {
        const grow = () => {
          note.style.height = "auto";
          note.style.height = Math.min(note.scrollHeight, 160) + "px";
        };
        note.addEventListener("input", grow);
        setTimeout(grow);
      }
      note.onchange = () => saveMember(m, { note: note.value.trim() || null });
      tr.querySelectorAll("[data-x]").forEach((inp) => {
        const key = inp.dataset.x;
        inp.value = (m.extra || {})[key] || "";
        inp.disabled = !edit;
        inp.onchange = () => saveMember(m, { extra: { ...m.extra || {}, [key]: inp.value.trim() } });
      });
      const rm = tr.querySelector(".list-rm");
      rm.hidden = !edit;
      rm.onclick = () => removeMember(m);
      tb.appendChild(tr);
    });
    $("list-count").textContent = `Осіб у списку: ${members.length}` + (members.length ? " · " + MEMBER_ST.map((s) => `${s.toLowerCase()}: ${members.filter((m) => m.status === s).length}`).join(", ") : "") + (hiddenCnt ? ` · ще ${hiddenCnt} — поза вашими справами, вам не видно` : "");
    $("list-members").hidden = !members.length;
    renderPrintCols();
  }
  async function saveMember(m, patch) {
    const { error } = await db.from("person_list_members").update(patch).eq("list_id", current.id).eq("person_id", m.person_id);
    if (error) {
      console.error(error);
      toast("Не вдалося зберегти");
      return;
    }
    Object.assign(m, patch);
    toast("Збережено");
    if ("status" in patch) $("list-count").textContent = `Осіб у списку: ${members.length} · ` + MEMBER_ST.map((s) => `${s.toLowerCase()}: ${members.filter((x) => x.status === s).length}`).join(", ");
  }
  async function removeMember(m) {
    if (!confirm(`Прибрати «${fio(m.person)}» зі списку? Картка в реєстрі залишиться.`)) return;
    const { error } = await db.from("person_list_members").delete().eq("list_id", current.id).eq("person_id", m.person_id);
    if (error) {
      console.error(error);
      toast("Не вдалося прибрати");
      return;
    }
    members = members.filter((x) => x !== m);
    renderMembers();
  }
  async function searchPeople() {
    const q = $("list-add-q").value.trim().replace(/[,()%*\\]/g, " ").trim();
    const box = $("list-add-res");
    box.innerHTML = "";
    if (q.length < 3) return;
    let query = db.from("persons").select("id, last_name, first_name, patronymic, birth_date, military_status, death_date, phone");
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 3 && words.every((w) => !/\d/.test(w))) {
      query = query.or(Persons.namesOr(words, await Persons.countNames(words, true) > 0));
    } else words.forEach((w) => {
      query = query.or(`last_name.ilike.%${w}%,first_name.ilike.%${w}%,patronymic.ilike.%${w}%`);
    });
    const { data, error } = await query.order("last_name").limit(15);
    if (error) {
      console.error(error);
      return;
    }
    const inList = new Set(members.map((m) => m.person_id));
    if (!data.length) {
      box.innerHTML = '<p class="muted">Нікого не знайдено.</p>';
      return;
    }
    data.forEach((p) => {
      const row = document.createElement("div");
      row.className = "list-res";
      row.innerHTML = '<span><b></b> <span class="muted"></span></span> <button type="button" class="btn-secondary btn-small"></button>';
      row.querySelector("b").textContent = fio(p);
      row.querySelector(".muted").textContent = [fmt(p.birth_date), p.military_status, p.death_date ? "загибель " + fmt(p.death_date) : ""].filter(Boolean).join(" · ");
      const b = row.querySelector("button");
      b.textContent = inList.has(p.id) ? "уже у списку" : "+ Додати";
      b.disabled = inList.has(p.id);
      b.onclick = async () => {
        b.disabled = true;
        if (await addIds(current.id, [p.id])) {
          b.textContent = "додано ✓";
          await loadMembers();
        } else b.disabled = false;
      };
      box.appendChild(row);
    });
  }
  async function addIds(listId, ids) {
    for (let i = 0; i < ids.length; i += 500) {
      const { error } = await db.from("person_list_members").upsert(ids.slice(i, i + 500).map((person_id) => ({ list_id: listId, person_id })), { onConflict: "list_id,person_id", ignoreDuplicates: true });
      if (error) {
        console.error(error);
        toast("Не вдалося додати");
        return false;
      }
    }
    return true;
  }
  function defaultCols() {
    const kinList = members.filter((m) => jidOf(m.person)).length < members.length / 2;
    return new Set(kinList ? ["case", "fio", "soldier", "phone", "addr", "kids", "st", "note"] : ["case", "fio", "bd", "rank", "vch", "unit", "event", "kin", "st", "note"]);
  }
  function renderPrintCols() {
    {
      const f = $("list-kid-from"), t = $("list-kid-to");
      if (f && t && f.dataset.list !== String(current.id)) {
        let v = null;
        try {
          v = JSON.parse(localStorage.getItem("list_kidage_" + current.id) || "null");
        } catch (e) {
          v = null;
        }
        if (!v) {
          const mm = String(current.name || "").match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/);
          if (mm && /діт|дит/i.test(current.name)) v = [mm[1], mm[2]];
        }
        f.value = v ? v[0] : "";
        t.value = v ? v[1] : "";
        f.dataset.list = String(current.id);
        const save = () => {
          try {
            localStorage.setItem("list_kidage_" + current.id, JSON.stringify([f.value, t.value]));
          } catch (e) {
          }
        };
        f.onchange = save;
        t.onchange = save;
      }
    }
    const box = $("list-cols");
    const saved = (() => {
      try {
        return JSON.parse(localStorage.getItem("list_cols2_" + current.id) || "null");
      } catch (e) {
        return null;
      }
    })();
    box.innerHTML = "";
    columnsAll().forEach(([key, label]) => {
      const l = document.createElement("label");
      l.className = "check";
      l.innerHTML = '<input type="checkbox"> <span></span>';
      l.firstChild.value = key;
      l.lastChild.textContent = label;
      l.firstChild.checked = saved ? saved.includes(key) : defaultCols().has(key);
      l.firstChild.onchange = () => {
        try {
          localStorage.setItem("list_cols2_" + current.id, JSON.stringify(pickedCols().map((c) => c[0])));
        } catch (e) {
        }
      };
      box.appendChild(l);
    });
  }
  const pickedCols = () => {
    const on = new Set([...$("list-cols").querySelectorAll("input:checked")].map((i) => i.value));
    return columnsAll().filter(([k]) => on.has(k));
  };
  function printList() {
    if (!members.length) {
      toast("У списку ще нікого немає");
      return;
    }
    const cols = pickedCols();
    const l = current;
    const area = $("print-area");
    area.innerHTML = `<h1></h1><p class="print-sub"></p><table><thead><tr><th>№</th>${cols.map(([, h]) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${members.map((m, i) => `<tr><td>${i + 1}</td>${cols.map(([, , f]) => `<td>${esc(f(m))}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <p class="print-sign">Склав(ла): ____________________ ${esc(Persons.ctx().operator.full_name || "")}  ·  ${(/* @__PURE__ */ new Date()).toLocaleDateString("uk-UA")}</p>`;
    area.querySelector("h1").textContent = l.name;
    area.querySelector(".print-sub").textContent = [l.description, l.due_date && `Термін: ${fmt(l.due_date)}`, `Осіб: ${members.length}`].filter(Boolean).join(" · ");
    document.body.classList.add("print-mode");
    logExport("Друк", members.length);
    setTimeout(() => window.print(), 50);
  }
  function excel() {
    if (!members.length) {
      toast("У списку ще нікого немає");
      return;
    }
    const cols = pickedCols();
    const aoa = [["№", ...cols.map(([, h]) => h)], ...members.map((m, i) => [i + 1, ...cols.map(([, , f]) => f(m))])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 5 }, ...cols.map(([k]) => ({ wch: ["fio", "kin", "note", "addr", "soldier"].includes(k) ? 34 : k === "kids" ? 48 : k === "phone" ? 22 : 16 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Список");
    const kidRows = members.flatMap((m) => kidsIn(m).map((c) => {
      var _a;
      return [caseOf(m), fio(m.person), phonesOf(m), m.person.settlement || "", c.full_name || "", yearOf(c.birth_date), (_a = ageOf(c.birth_date)) != null ? _a : "", fmt(c.birth_date), c.part_status || "Звичайний"];
    }));
    if (kidRows.length) {
      const wk = XLSX.utils.aoa_to_sheet([["Справа", "Батько / мати / опікун", "Телефон для зв’язку", "Населений пункт, адреса", "Дитина (ПІБ)", "Рік народження", "Вік", "Дата народження", "Статус участі"], ...kidRows]);
      wk["!cols"] = [{ wch: 12 }, { wch: 34 }, { wch: 22 }, { wch: 40 }, { wch: 30 }, { wch: 10 }, { wch: 6 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wk, "Діти");
    }
    const safe = current.name.replace(/[\\/?*[\]:"<>|]/g, " ").slice(0, 60).trim() || "spysok";
    XLSX.writeFile(wb, `${safe}.xlsx`);
    logExport("Excel", members.length);
  }
  function logExport(kind, n) {
    db.from("export_log").insert({ kind, channel: "Список", row_count: n, filters_note: "Список: " + current.name }).then(({ error }) => {
      if (error) console.warn("export_log", error);
    });
  }
  let pending = null;
  async function addDialog(opts) {
    pending = opts;
    const { data, error } = await db.from("person_lists").select("id, name, status").neq("status", "Закрито").order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast("Не вдалося завантажити списки");
      return;
    }
    const sel = $("tolist-select");
    sel.innerHTML = "";
    (data || []).forEach((l) => sel.add(new Option(l.name, l.id)));
    sel.add(new Option("+ Новий список…", "new"));
    $("tolist-what").textContent = opts.label;
    $("tolist-dialog").showModal();
  }
  async function submitToList(e) {
    e.preventDefault();
    const btn = $("tolist-form").querySelector('button[type="submit"]');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      let listId = $("tolist-select").value;
      if (listId === "new") {
        const name = prompt("Назва нового списку:");
        if (!name || !name.trim()) return;
        const { data, error } = await db.from("person_lists").insert({ name: name.trim(), owner_id: me }).select("id").single();
        if (error) {
          console.error(error);
          toast("Не вдалося створити список");
          return;
        }
        listId = data.id;
      }
      let ids = pending.ids || [];
      if (pending.filter) {
        ids = [];
        for (let from = 0; ; from += 1e3) {
          let { query: q } = await Persons.buildQuery("id");
          const { data, error } = await q.order("id").range(from, from + 999);
          if (error) {
            console.error(error);
            toast("Не вдалося отримати людей за фільтром");
            return;
          }
          ids.push(...data.map((x) => x.id));
          if (data.length < 1e3 || ids.length >= 5e3) break;
        }
        if (ids.length >= 5e3 && !confirm("За фільтром понад 5000 осіб — додати перші 5000?")) return;
      }
      if (!ids.length) {
        toast("Нікого додавати");
        return;
      }
      if (await addIds(Number(listId), ids.slice(0, 5e3))) {
        $("tolist-dialog").close();
        toast(`Додано до списку: ${Math.min(ids.length, 5e3)} (хто вже був — без повтору)`);
        if (pending.after) pending.after();
      }
    } finally {
      btn.disabled = false;
    }
  }
  const isKidsList = (l) => /^Анкета «Діти» (·|\(тест\))/.test(l.name || "");
  const ks = { items: [], i: 0, sent: 0, skipped: 0, wait: 0, timer: null, set: null, changed: false };
  const waDigits = (phone) => {
    const d = String(phone || "").replace(/\D/g, "");
    return d.length >= 9 ? d : "";
  };
  async function kidsSend() {
    const btn = $("list-kids-send");
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const [b, st] = await Promise.all([
        db.rpc("kids_mail_batch", { p_list: current.id }),
        db.from("app_settings").select("key, value").in("key", ["kids_form_url", "kids_form_text", "kids_form_text_self", "kids_form_text_cold", "kids_form_code_entry", "kids_mail_pause"])
      ]);
      if (b.error) {
        console.error(b.error);
        toast("Не вдалося підготувати розсилку: " + (b.error.message || ""));
        return;
      }
      const set = Object.fromEntries((st.data || []).map((r) => [r.key, r.value || ""]));
      if (!set.kids_form_url || !set.kids_form_text) {
        toast("Посилання чи текст анкети не задано — адміністратор вносить їх у «Налаштування полів»");
        return;
      }
      const ids = [...new Set((b.data || []).map((x) => x.rcpt_id))];
      const ex = /* @__PURE__ */ new Map();
      for (let i = 0; i < ids.length; i += 100) {
        const { data: ep } = await db.from("persons").select("id, extra_phones").in("id", ids.slice(i, i + 100));
        (ep || []).forEach((r) => ex.set(r.id, (r.extra_phones || []).filter((x) => waDigits(x))));
      }
      const cids = [...new Set((b.data || []).map((x) => x.case_id))];
      const cst = /* @__PURE__ */ new Map();
      for (let i = 0; i < cids.length; i += 100) {
        const { data: cs } = await db.from("cases").select("id, status").in("id", cids.slice(i, i + 100));
        (cs || []).forEach((r) => cst.set(r.id, r.status));
      }
      (b.data || []).forEach((x) => {
        x.cold = cst.get(x.case_id) === "Не беремо в роботу";
      });
      (b.data || []).forEach((x) => {
        x.phones = [x.rcpt_phone, ...ex.get(x.rcpt_id) || []].filter((ph, i, a) => waDigits(ph) && a.indexOf(ph) === i);
        x.phone = x.phones[0];
      });
      Object.assign(ks, {
        items: (b.data || []).filter((x) => x.phones.length),
        i: 0,
        sent: 0,
        skipped: 0,
        wait: 0,
        set,
        changed: false,
        pause: Math.max(0, Number(set.kids_mail_pause) || 60)
      });
      clearInterval(ks.timer);
      $("ks-dialog").showModal();
      ksRender();
    } finally {
      btn.disabled = false;
    }
  }
  function ksText(x) {
    const s = ks.set;
    const link = s.kids_form_code_entry ? s.kids_form_url.replace(/[?#].*$/, "") + "?usp=pp_url&" + encodeURIComponent(s.kids_form_code_entry) + "=" + x.code : s.kids_form_url;
    return (x.rcpt_self && s.kids_form_text_self || x.cold && s.kids_form_text_cold || s.kids_form_text).replace(/\{ім[’'`]?я\}/gi, [x.rcpt_first, x.rcpt_patr].filter(Boolean).join(" ")).replace(/\{оператор\}/gi, ops.get(me) || "співробітник").replace(/\{посилання\}/gi, link).replace(/\{загиблий\}/gi, x.soldier || "");
  }
  function ksTick() {
    clearInterval(ks.timer);
    if (ks.wait <= 0) return;
    ks.timer = setInterval(() => {
      ks.wait -= 1;
      const b = $("ks-next");
      if (ks.wait <= 0) {
        clearInterval(ks.timer);
        if (b) {
          b.disabled = false;
          b.textContent = "➡ Далі";
        }
      } else if (b) b.textContent = `⏳ Далі через ${ks.wait} с`;
    }, 1e3);
  }
  function ksRender() {
    const box = $("ks-body"), n = ks.items.length;
    if (ks.i >= n) {
      $("ks-progress").textContent = "";
      box.innerHTML = n ? `<p class="ks-done">Готово 🎉 Надіслано: <b>${ks.sent}</b>${ks.skipped ? `, пропущено: <b>${ks.skipped}</b> (лишились у списку)` : ""}.</p>` : "<p>У списку немає кому надсилати: усім уже надіслано, або в родини немає мобільного номера.</p>";
      return;
    }
    const x = ks.items[ks.i];
    $("ks-progress").textContent = `${ks.i + 1} з ${n} · надіслано ${ks.sent}${ks.skipped ? " · пропущено " + ks.skipped : ""}`;
    box.innerHTML = `<div class="ks-card"><div><b class="ks-jid"></b> <span class="ks-rep" hidden>🔁 повторно</span> <span class="ks-cold" hidden title="Справа «Не беремо в роботу»: з родиною ще не було контакту — надсилається «холодний» текст із представленням організації">🧊 перший контакт</span></div>
      <div>Кому: <b class="ks-who"></b> <span class="muted ks-deg"></span></div><div class="ks-ph"></div>
      <details class="ks-prev"><summary>Текст повідомлення</summary><pre class="ks-text"></pre></details></div>
      <ol class="ks-steps muted"><li>«💬 Відкрити WhatsApp» — текст уже набрано, позначка «надіслано» ставиться одразу.</li><li>У WhatsApp натисніть <b>Надіслати</b> (Enter).</li><li>Поверніться сюди — «➡ Далі».</li></ol>
      <p class="ks-marked" hidden>✅ Позначено «надіслано» — людина прибрана зі списку.</p>
      <div class="ks-actions"><button type="button" id="ks-open" class="btn-primary"></button>
      <button type="button" id="ks-next" class="btn-primary" hidden>➡ Далі</button>
      <button type="button" id="ks-skip" class="btn-secondary">⏭ Пропустити</button></div>`;
    box.querySelector(".ks-jid").textContent = x.journal_id;
    box.querySelector(".ks-rep").hidden = x.state !== "repeat";
    box.querySelector(".ks-cold").hidden = !x.cold;
    box.querySelector(".ks-who").textContent = x.rcpt_fio;
    box.querySelector(".ks-deg").textContent = x.rcpt_self ? "(сам/сама)" : x.rcpt_degree ? `(${x.rcpt_degree})` : "";
    {
      const ph = box.querySelector(".ks-ph");
      if (x.phones.length > 1) {
        const sel = document.createElement("select");
        sel.setAttribute("aria-label", "Номер для WhatsApp");
        x.phones.forEach((p, i) => sel.add(new Option(`${V.formatPhone(p) || p}${i ? " (дод.)" : " (основний)"}`, p)));
        sel.value = x.phone;
        sel.onchange = () => {
          x.phone = sel.value;
        };
        ph.append("Номер: ", sel);
      } else ph.textContent = V.formatPhone(x.phone) || x.phone;
    }
    box.querySelector(".ks-text").textContent = ksText(x);
    const open = $("ks-open"), next = $("ks-next"), skip = $("ks-skip");
    const showMarked = () => {
      box.querySelector(".ks-marked").hidden = false;
      skip.hidden = true;
      open.className = "btn-secondary";
      open.textContent = "💬 Відкрити WhatsApp ще раз";
      next.hidden = false;
      next.disabled = ks.wait > 0 && ks.i + 1 < n;
      next.textContent = next.disabled ? `⏳ Далі через ${ks.wait} с` : "➡ Далі";
    };
    open.textContent = "💬 Відкрити WhatsApp";
    open.title = "Відкриє WhatsApp з набраним повідомленням і одразу позначить «надіслано»";
    if (x.marked) showMarked();
    open.onclick = async () => {
      const w = window.open(`https://wa.me/${waDigits(x.phone)}?text=${encodeURIComponent(ksText(x))}`, "kids-wa");
      if (!w) {
        toast("Браузер заблокував вікно — дозвольте спливні вікна для цього сайту");
        return;
      }
      if (x.marked) return;
      open.disabled = true;
      const { error } = await db.rpc("kids_mail_mark", { p_list: current.id, p_case: x.case_id });
      open.disabled = false;
      if (error) {
        console.error(error);
        toast("WhatsApp відкрито, але позначку «надіслано» поставити не вдалося: " + (error.message || "") + ". Натисніть «💬» ще раз");
        return;
      }
      x.marked = true;
      ks.sent += 1;
      ks.changed = true;
      ks.wait = ks.pause;
      $("ks-progress").textContent = `${ks.i + 1} з ${n} · надіслано ${ks.sent}${ks.skipped ? " · пропущено " + ks.skipped : ""}`;
      showMarked();
      ksTick();
    };
    next.onclick = () => {
      ks.i += 1;
      ksRender();
    };
    skip.onclick = () => {
      ks.skipped += 1;
      ks.i += 1;
      ksRender();
    };
  }
  async function forPerson(personId) {
    if (!db || !(window.ACCESS && window.ACCESS.lists)) return [];
    const { data } = await db.from("person_list_members").select("status, list:person_lists(id, name)").eq("person_id", personId);
    return (data || []).filter((x) => x.list);
  }
  let pendingSend = false;
  function openById(id, send) {
    window.__listsFrom = "cabinet";
    current = { id };
    pendingSend = !!send;
    const t = document.querySelector('.tab[data-tab="lists"]');
    t.click();
  }
  return { init, load, addDialog, forPerson, openById };
})();
