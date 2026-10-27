// АВТОМАТИЧНО з nav.js (tools/build-legacy.mjs) — не редагувати вручну
const VIEWS = { registry: "registry-view", cabinet: "cabinet-view", dashboard: "dashboard-view", import: "import-view", lists: "lists-view", staff: "staff-view", notes: "notes-view", manual: "manual-view" };
function showTab(tab) {
  const lt = document.querySelector('.tab[data-tab="lists"]');
  const lit = tab === "lists" && lt && lt.hidden ? window.__listsFrom || (document.querySelector('.tab[data-tab="cabinet"]').hidden ? "registry" : "cabinet") : tab;
  document.querySelectorAll(".tab[data-tab]").forEach((b) => {
    const on = b.dataset.tab === lit;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-current", on ? "page" : "false");
    if (on) b.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  Object.entries(VIEWS).forEach(([k, id]) => {
    document.getElementById(id).hidden = k !== tab;
  });
  try {
    sessionStorage.setItem("last_tab", tab);
  } catch (e) {
  }
  if (window.Presence) Presence.tab(tab);
  if (tab === "dashboard") Dashboard.refresh();
  if (tab === "cabinet") Cabinet.load();
  if (tab === "lists") Lists.load();
  if (tab === "notes" && window.Notes) Notes.load();
}
document.querySelectorAll(".tab[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    const cur = history.state && history.state.tab;
    if (cur !== tab || history.state && history.state.view === "card") history.pushState({ view: "tab", tab }, "");
    showTab(tab);
    window.scrollTo(0, 0);
  });
});
history.replaceState({ view: "tab", tab: "registry" }, "");
window.addEventListener("popstate", (e) => {
  if (!e.state) return;
  if (e.state.view === "tab") showTab(e.state.tab || "registry");
});
document.addEventListener("click", (e) => {
  const a = e.target.closest('#manual-view a[href^="#"]');
  if (!a) return;
  const target = document.getElementById(a.getAttribute("href").slice(1));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  const h = target.querySelector("h2") || target;
  h.setAttribute("tabindex", "-1");
  h.focus({ preventScroll: true });
});
{
  const rb = document.getElementById("app-reload");
  if (rb) rb.addEventListener("click", async () => {
    rb.disabled = true;
    rb.textContent = "⟳ Оновлюємо…";
    try {
      await fetch(location.pathname, { cache: "reload" });
    } catch (e) {
    }
    location.reload();
  });
}
