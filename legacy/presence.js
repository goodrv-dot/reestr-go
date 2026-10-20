// АВТОМАТИЧНО з presence.js (tools/build-legacy.mjs) — не редагувати вручну
window.Presence = /* @__PURE__ */ (() => {
  const $ = (id) => document.getElementById(id);
  const TABS = { registry: "Особи", cabinet: "Кабінет", dashboard: "Дашборд", import: "Імпорт", lists: "Списки", staff: "Співробітники", manual: "Мануал" };
  let ch = null, me = null, info = null, isAdmin = false, ready = false, idleTimer = null;
  const esc = (s) => String(s != null ? s : "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const hm = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  };
  async function start(db, userId, name, admin) {
    stop();
    me = userId;
    isAdmin = admin;
    info = { user_id: userId, name, tab: currentTab(), since: (/* @__PURE__ */ new Date()).toISOString(), away: document.hidden };
    try {
      const { data } = await db.auth.getSession();
      if (data && data.session) db.realtime.setAuth(data.session.access_token);
    } catch (e) {
    }
    ch = db.channel("online", { config: { private: true, presence: { key: userId } } });
    ch.on("presence", { event: "sync" }, render);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") ch.track(info);
    });
    if (!ready) {
      ready = true;
      document.addEventListener("visibilitychange", () => update({ away: document.hidden }));
      const btn = $("online-btn");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = $("online-panel");
        p.hidden = !p.hidden;
        if (!p.hidden) render();
      });
      document.addEventListener("click", (e) => {
        if (!e.target.closest("#online-panel")) $("online-panel").hidden = true;
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") $("online-panel").hidden = true;
      });
    }
    $("online-btn").hidden = !isAdmin;
  }
  function currentTab() {
    const a = document.querySelector(".tab.is-active[data-tab]");
    return a ? a.dataset.tab : "";
  }
  function update(patch) {
    if (!ch || !info) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      info = { ...info, ...patch };
      ch.track(info).catch(() => {
      });
    }, 300);
  }
  const tab = (t) => update({ tab: t });
  function stop() {
    if (ch) {
      try {
        ch.untrack();
        ch.unsubscribe();
      } catch (e) {
      }
      ch = null;
    }
    const b = $("online-btn");
    if (b) b.hidden = true;
    const p = $("online-panel");
    if (p) p.hidden = true;
  }
  function people() {
    if (!ch) return [];
    const st = ch.presenceState();
    const out = [];
    Object.values(st).forEach((metas) => {
      const list = metas.slice().sort((a, b) => Number(a.away) - Number(b.away));
      const m = list[0];
      if (!m) return;
      out.push({ ...m, windows: metas.length, since: metas.map((x) => x.since).sort()[0] });
    });
    return out.sort((a, b) => Number(a.away) - Number(b.away) || String(a.name).localeCompare(String(b.name), "uk"));
  }
  function render() {
    if (!isAdmin) return;
    const ps = people();
    const active = ps.filter((p2) => !p2.away).length;
    $("online-count").textContent = String(ps.length);
    $("online-btn").title = `Зараз у програмі: ${ps.length}` + (ps.length - active ? ` (з них ${ps.length - active} — вкладка у фоні)` : "");
    const p = $("online-panel");
    if (p.hidden) return;
    p.innerHTML = `<h2>Зараз у програмі: ${ps.length}</h2>` + (ps.length ? '<ul class="online-list">' + ps.map((x) => `<li class="${x.away ? "is-away" : ""}"><span class="online-dot" aria-hidden="true"></span><b>${esc(x.name)}${x.user_id === me ? " (ви)" : ""}</b>
          <span class="muted">${esc(TABS[x.tab] || "")}${x.away ? " · вкладка у фоні" : ""} · з ${hm(x.since)}${x.windows > 1 ? ` · вкладок: ${x.windows}` : ""}</span></li>`).join("") + "</ul>" : '<p class="muted">Нікого.</p>') + '<p class="muted online-note">Видно лише адміністраторам. Сіра крапка — програма відкрита, але вкладка браузера зараз не активна.</p>';
  }
  return { start, stop, tab };
})();
