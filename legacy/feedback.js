// АВТОМАТИЧНО з feedback.js (tools/build-legacy.mjs) — не редагувати вручну
window.Feedback = /* @__PURE__ */ (() => {
  const $ = (id) => document.getElementById(id);
  const STATUSES = ["Нове", "Розглядаємо", "Зроблено", "Відхилено"];
  const ST_CLS = { "Нове": "fb-st-new", "Розглядаємо": "fb-st-work", "Зроблено": "fb-st-done", "Відхилено": "fb-st-no" };
  let db = null, me = null, isAdmin = false, items = [], wired = false;
  function init(client, userId, admin) {
    db = client;
    me = userId;
    isAdmin = admin;
    if (wired) return;
    wired = true;
    $("fb-btn").hidden = false;
    $("fb-btn").addEventListener("click", open);
    $("fb-close").addEventListener("click", () => $("fb-dialog").close());
    $("fb-form").addEventListener("submit", send);
    $("fb-filter").addEventListener("change", render);
    $("fb-list").addEventListener("click", onListClick);
    refreshDot();
    setInterval(() => {
      if (!document.hidden) refreshDot();
    }, 5 * 60 * 1e3);
  }
  async function counts() {
    if (!db) return { fresh: 0, replies: 0 };
    const [a, b] = await Promise.all([
      isAdmin ? db.from("feedback").select("id", { count: "exact", head: true }).eq("status", "Нове") : Promise.resolve({ count: 0 }),
      db.from("feedback").select("id", { count: "exact", head: true }).eq("user_id", me).eq("author_unseen", true)
    ]);
    return { fresh: a.count || 0, replies: b.count || 0 };
  }
  async function refreshDot() {
    const c = await counts().catch(() => ({ fresh: 0, replies: 0 }));
    const n = c.fresh + c.replies;
    const dot = $("fb-count");
    dot.textContent = n > 99 ? "99+" : n;
    dot.hidden = !n;
    $("fb-btn").title = n ? `Пропозиції: ${c.fresh ? `нових ${c.fresh}` : ""}${c.fresh && c.replies ? ", " : ""}${c.replies ? `відповідей вам ${c.replies}` : ""}` : "Пропозиції щодо програми";
    return c;
  }
  async function open() {
    $("fb-dialog").showModal();
    $("fb-status").textContent = "Завантажуємо…";
    await load();
    $("fb-status").textContent = "";
    if (items.some((x) => x.user_id === me && x.author_unseen)) {
      await db.rpc("feedback_mark_seen");
      refreshDot();
      if (window.Cabinet && Cabinet.badge) Cabinet.badge();
    }
  }
  async function load() {
    const { data, error } = await db.from("feedback").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) {
      console.error(error);
      $("fb-status").textContent = "Не вдалося завантажити пропозиції";
      return;
    }
    items = data || [];
    render();
  }
  const fmt = (t) => new Date(t).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  function render() {
    const f = $("fb-filter").value;
    const list = items.filter((x) => f === "mine" ? x.user_id === me : f ? x.status === f : true);
    const box = $("fb-list");
    box.innerHTML = "";
    if (!list.length) {
      box.innerHTML = '<p class="muted">Поки що тут порожньо. Напишіть першу пропозицію!</p>';
      return;
    }
    list.forEach((x) => {
      const art = document.createElement("article");
      art.className = "fb-item" + (x.user_id === me ? " is-mine" : "") + (x.user_id === me && x.author_unseen ? " is-unseen" : "");
      art.dataset.id = x.id;
      art.innerHTML = `<header><b></b> <span class="muted"></span> <span class="fb-st"></span></header><p class="fb-body"></p>`;
      art.querySelector("b").textContent = x.author || "Співробітник";
      art.querySelector(".muted").textContent = fmt(x.created_at);
      const st = art.querySelector(".fb-st");
      st.textContent = x.status;
      st.classList.add(ST_CLS[x.status] || "");
      art.querySelector(".fb-body").textContent = x.body;
      if (x.reply) {
        const r = document.createElement("p");
        r.className = "fb-reply";
        r.innerHTML = "<b>Відповідь:</b> <span></span>";
        r.lastChild.textContent = x.reply;
        art.appendChild(r);
      }
      const act = document.createElement("div");
      act.className = "fb-actions";
      if (isAdmin) {
        const sel = document.createElement("select");
        sel.className = "fb-set-status";
        sel.setAttribute("aria-label", "Статус");
        STATUSES.forEach((s) => sel.add(new Option(s, s)));
        sel.value = x.status;
        const ta = document.createElement("textarea");
        ta.className = "fb-set-reply";
        ta.rows = 2;
        ta.maxLength = 2e3;
        ta.placeholder = "Відповідь автору (необов’язково)";
        ta.value = x.reply || "";
        const save = document.createElement("button");
        save.type = "button";
        save.className = "btn-secondary btn-small";
        save.dataset.act = "save";
        save.textContent = "Зберегти";
        act.append(sel, ta, save);
      }
      if (isAdmin || x.user_id === me) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn-link btn-link-danger";
        del.dataset.act = "del";
        del.textContent = "Видалити";
        act.appendChild(del);
      }
      if (act.children.length) art.appendChild(act);
      box.appendChild(art);
    });
  }
  async function onListClick(e) {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const art = btn.closest(".fb-item");
    const id = Number(art.dataset.id);
    if (btn.dataset.act === "del") {
      if (!confirm("Видалити цю пропозицію?")) return;
      const { error } = await db.from("feedback").delete().eq("id", id);
      if (error) {
        console.error(error);
        Persons.toast("Не вдалося видалити");
        return;
      }
      items = items.filter((x) => x.id !== id);
      render();
      refreshDot();
      return;
    }
    if (btn.dataset.act === "save") {
      const status = art.querySelector(".fb-set-status").value;
      const reply = art.querySelector(".fb-set-reply").value.trim() || null;
      btn.disabled = true;
      const { data, error } = await db.from("feedback").update({ status, reply }).eq("id", id).select("*").single();
      btn.disabled = false;
      if (error) {
        console.error(error);
        Persons.toast("Не вдалося зберегти");
        return;
      }
      items = items.map((x) => x.id === id ? data : x);
      render();
      refreshDot();
      if (window.Cabinet && Cabinet.badge) Cabinet.badge();
      Persons.toast("Збережено — автор побачить відповідь у дзвіночку");
    }
  }
  async function send(e) {
    e.preventDefault();
    const ta = $("fb-text");
    const body = ta.value.trim();
    if (!body) {
      ta.focus();
      return;
    }
    const btn = $("fb-send");
    btn.disabled = true;
    const { data, error } = await db.from("feedback").insert({ body }).select("*").single();
    btn.disabled = false;
    if (error) {
      console.error(error);
      Persons.toast("Не вдалося надіслати");
      return;
    }
    ta.value = "";
    items = [data, ...items];
    $("fb-filter").value = "";
    render();
    Persons.toast("Дякуємо! Пропозицію надіслано");
    refreshDot();
  }
  return { init, counts, open, refreshDot };
})();
