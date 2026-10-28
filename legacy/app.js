// АВТОМАТИЧНО з app.js (tools/build-legacy.mjs) — не редагувати вручну
const { SUPABASE_URL, SUPABASE_KEY, IDLE_MINUTES } = window.APP_CONFIG;
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { lock: async (_name, _timeout, fn) => fn() }
});
const $ = (id) => document.getElementById(id);
const ROLE_LABELS = { admin: "Адміністратор", operator: "Оператор" };
let currentOperator = null;
let currentUserId = null;
let mfaRequiredForMe = false;
let iAmAdmin = false;
Mfa.init(db);
const SCREENS = ["loading", "login-screen", "pwchange-screen", "app-screen", "mfa-screen", "mfa-enroll-screen"];
function show(id) {
  SCREENS.forEach((s) => {
    $(s).hidden = s !== id;
  });
}
function showLogin(message) {
  show("login-screen");
  setError(message || "");
  $("email").focus();
}
function showApp(operator, userId) {
  currentOperator = operator;
  currentUserId = userId;
  show("app-screen");
  $("user-name").textContent = operator.full_name;
  $("user-role").textContent = window.ACCESS && window.ACCESS.readOnly ? "Керівник · лише перегляд" : ROLE_LABELS[operator.role] || operator.role;
  startIdleTimer();
  try {
    Presence.start(db, userId, operator.full_name, operator.role === "admin");
  } catch (e) {
    console.error(e);
  }
  $("staff-tab").hidden = operator.role !== "admin";
  const A = window.ACCESS, hasCab = (A.cabMods || []).length > 0 || A.cab200 || A.cab300;
  const tabBtn = (t) => document.querySelector(`.tab[data-tab="${t}"]`);
  tabBtn("registry").hidden = !A.registry;
  tabBtn("dashboard").hidden = !A.registry;
  tabBtn("import").hidden = !A.import;
  tabBtn("cabinet").hidden = !hasCab;
  tabBtn("lists").hidden = !(A.lists && !hasCab && !A.registry);
  const erp = $("erp-link"), erpUrl = window.APP_CONFIG.ERP_URL;
  erp.hidden = !erpUrl;
  if (!erp.hidden) erp.href = erpUrl;
  Persons.init(db, operator).then(() => {
    if (!window.__exp) {
      Exporter.init();
      Importer.init();
      if (operator.role === "admin") Staff.init(db, userId);
      Segments.init(db, userId, operator.role === "admin");
      Cabinet.init(db, userId, operator.role === "admin");
      Feedback.init(db, userId, operator.role === "admin");
      try {
        QuickLinks.init(db, userId, operator.role === "admin");
      } catch (e) {
        console.error(e);
      }
      try {
        Notes.init(db, userId, operator.role === "admin");
      } catch (e) {
        console.error(e);
      }
      if (A.lists) Lists.init(db, userId, operator.role === "admin");
      window.__exp = true;
    }
    const prm = new URLSearchParams(location.search);
    let last = null, lastCase = null;
    try {
      last = sessionStorage.getItem("last_tab");
      lastCase = sessionStorage.getItem("cab_case");
    } catch (e) {
    }
    const back = !prm.get("case") && !prm.get("person") && last && tabBtn(last) && (!tabBtn(last).hidden || last === "lists" && A.lists) ? last : null;
    if (back) {
      tabBtn(back).click();
      if (back === "cabinet" && lastCase) Cabinet.openByJournal(lastCase);
      if (hasCab && back !== "cabinet") Cabinet.badge();
    } else if (!A.registry && !prm.get("case")) tabBtn(hasCab ? "cabinet" : "manual").click();
    else if (hasCab) Cabinet.badge();
    openDeepLink();
  }).catch((e) => {
    console.error(e);
    alert("Не вдалося завантажити довідники. Оновіть сторінку.");
  });
}
function lockReadOnly() {
  document.body.classList.add("read-only");
  const KEEP = /* @__PURE__ */ new Set(["back-btn", "cancel-btn", "person-link", "cab-back", "cab-back2", "case-open-person", "case-link"]);
  const lock = (root) => {
    root.querySelectorAll("input, select, textarea").forEach((el) => {
      el.disabled = true;
    });
    root.querySelectorAll("button.btn-primary, button.btn-secondary, button.btn-danger, button[data-save]").forEach((b) => {
      if (!KEEP.has(b.id)) b.hidden = true;
    });
  };
  const roots = ["person-form", "cab-case", "cab-today"];
  const run = () => roots.forEach((id) => {
    const r = document.getElementById(id);
    if (r) lock(r);
  });
  let t = null;
  new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(run, 30);
  }).observe(document.body, { childList: true, subtree: true });
  run();
}
function setError(text) {
  $("login-error").textContent = text;
  $("login-error").hidden = !text;
}
async function enterWithSession(session) {
  try {
    const userId = session.user.id;
    const { data: aal, error: aalErr } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalErr) throw aalErr;
    if (aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      Mfa.showVerify(() => continueEntry());
      return;
    }
    const { data: acc, error } = await db.rpc("my_access");
    if (error) throw error;
    if (!acc.found || !acc.active) {
      await db.auth.signOut();
      showLogin("Цей обліковий запис не має доступу до реєстру. Зверніться до адміністратора.");
      return;
    }
    if (acc.must_change_password) {
      showPasswordChange();
      return;
    }
    mfaRequiredForMe = acc.mfa_required === "all" || acc.mfa_required === "admins" && acc.role === "admin";
    iAmAdmin = acc.role === "admin";
    if (mfaRequiredForMe && aal.currentLevel !== "aal2") {
      Mfa.showEnrollScreen(() => continueEntry());
      return;
    }
    const { data: operator, error: opErr } = await db.from("operators").select("full_name, role, can_export, must_change_password, email").eq("user_id", userId).maybeSingle();
    if (opErr) throw opErr;
    if (!operator) {
      await db.auth.signOut();
      showLogin("Не вдалося підтвердити доступ. Увійдіть ще раз.");
      return;
    }
    const adm = operator.role === "admin";
    window.ACCESS = {
      admin: adm,
      registry: adm || !!acc.can_registry,
      import: adm || !!acc.can_import,
      cab200: adm || !!acc.can_cab200,
      cab300: adm || !!acc.can_cab300,
      cells: acc.cell_ids || [],
      readOnly: !adm && !!acc.read_only,
      lists: adm || !!acc.can_lists
    };
    (acc.cab_modules || []).forEach((m) => {
      window.ACCESS["cab" + m] = true;
    });
    window.ACCESS.cabMods = ["200", "300", ...acc.cab_modules || []].filter((m) => window.ACCESS["cab" + m]);
    if (window.ACCESS.readOnly) lockReadOnly();
    showApp(operator, userId);
  } catch (e) {
    console.error(e);
    showLogin("Не вдалося перевірити доступ. Перевірте інтернет і спробуйте ще раз.");
  }
}
async function continueEntry() {
  const { data } = await db.auth.getSession();
  if (data.session) await enterWithSession(data.session);
  else showLogin();
}
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) {
    setError("Введіть електронну пошту і пароль.");
    return;
  }
  $("login-btn").disabled = true;
  $("login-btn").textContent = "Перевіряємо…";
  setError("");
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  $("login-btn").disabled = false;
  $("login-btn").textContent = "Увійти";
  if (error) {
    const wrong = /invalid login credentials/i.test(error.message);
    const banned = /banned/i.test(error.message);
    setError(wrong ? "Невірна пошта або пароль." : banned ? "Обліковий запис деактивовано. Зверніться до адміністратора." : "Не вдалося увійти. Перевірте інтернет і спробуйте ще раз.");
    return;
  }
  $("password").value = "";
  await enterWithSession(data.session);
});
async function logout(message) {
  stopIdleTimer();
  try {
    Presence.stop();
  } catch (e) {
  }
  try {
    QuickLinks.stop();
  } catch (e) {
  }
  await db.auth.signOut();
  showLogin(message);
}
window.appLogout = logout;
$("logout-btn").addEventListener("click", () => logout());
const IDLE_MS = IDLE_MINUTES * 60 * 1e3;
const IDLE_KEY = "reestr_last_activity";
const IDLE_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"];
let idleWatch = null;
let lastWrite = 0;
function readLast() {
  try {
    return Number(localStorage.getItem(IDLE_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}
function markActivity() {
  const now = Date.now();
  const wasIdle = window.__lastAct && now - window.__lastAct > 15 * 60 * 1e3;
  window.__lastAct = now;
  if (wasIdle && !document.hidden) document.dispatchEvent(new Event("visibilitychange"));
  if (now - lastWrite < 1e4) return;
  lastWrite = now;
  try {
    localStorage.setItem(IDLE_KEY, String(now));
  } catch (e) {
  }
}
function isStale() {
  const last = readLast();
  return last > 0 && Date.now() - last > IDLE_MS;
}
function checkIdle() {
  if ($("app-screen").hidden) return;
  if (window.__importBusy) {
    lastWrite = 0;
    markActivity();
    return;
  }
  if (isStale()) logout(`Сесію завершено після ${IDLE_MINUTES} хвилин бездіяльності. Увійдіть знову.`);
}
function startIdleTimer() {
  lastWrite = 0;
  markActivity();
  IDLE_EVENTS.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));
  clearInterval(idleWatch);
  idleWatch = setInterval(checkIdle, 3e4);
}
function stopIdleTimer() {
  clearInterval(idleWatch);
  IDLE_EVENTS.forEach((ev) => window.removeEventListener(ev, markActivity));
  try {
    localStorage.removeItem(IDLE_KEY);
  } catch (e) {
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkIdle();
});
window.addEventListener("pageshow", checkIdle);
window.addEventListener("focus", checkIdle);
function showPasswordChange() {
  show("pwchange-screen");
  $("pw-new").focus();
}
$("pwchange-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const p1 = $("pw-new").value, p2 = $("pw-new2").value;
  const err = (t) => {
    $("pwchange-error").textContent = t;
    $("pwchange-error").hidden = !t;
  };
  if (p1.length < 10) return err("Пароль має містити щонайменше 10 символів.");
  if (p1 !== p2) return err("Паролі не збігаються.");
  err("");
  $("pwchange-btn").disabled = true;
  const { error } = await db.auth.updateUser({ password: p1 });
  if (!error) await db.rpc("password_changed");
  $("pwchange-btn").disabled = false;
  if (error) {
    console.error(error);
    return err(/same|different/i.test(error.message) ? "Новий пароль має відрізнятися від тимчасового." : "Не вдалося змінити пароль. Спробуйте ще раз.");
  }
  $("pw-new").value = "";
  $("pw-new2").value = "";
  continueEntry();
});
$("profile-btn").addEventListener("click", openProfile);
$("profile-close").addEventListener("click", () => $("profile-dialog").close());
async function openProfile() {
  $("pf-name").textContent = currentOperator.full_name;
  $("pf-email").textContent = currentOperator.email || "";
  $("pf-role").textContent = ROLE_LABELS[currentOperator.role] || currentOperator.role;
  $("pf-enroll-box").innerHTML = "";
  $("profile-dialog").showModal();
  await renderMfaStatus();
}
async function renderMfaStatus() {
  const on = await Mfa.enabled().catch(() => false);
  $("pf-mfa-status").textContent = on ? "Увімкнено" : "Вимкнено";
  $("pf-mfa-status").className = "mfa-state " + (on ? "is-on" : "is-off");
  $("pf-mfa-on").hidden = on;
  $("pf-mfa-off").hidden = !on || mfaRequiredForMe || !iAmAdmin;
  $("pf-mfa-note").textContent = mfaRequiredForMe ? "Для вашої ролі 2FA обов’язкова — вимкнути її не можна." : on && !iAmAdmin ? "При кожному вході після пароля система попросить код із додатку. Вимкнути 2FA може лише адміністратор; змінили або загубили телефон — напишіть адміністратору, він натисне «Скинути 2FA», і ви підключите її заново." : on ? "При кожному вході після пароля система попросить код із додатку." : "Рекомендуємо увімкнути: навіть якщо пароль стане відомий іншим, без вашого телефона увійти не вийде.";
}
$("pf-mfa-on").addEventListener("click", () => {
  $("pf-mfa-on").hidden = true;
  Mfa.renderEnroll($("pf-enroll-box"), async () => {
    $("pf-enroll-box").innerHTML = '<p class="tip">2FA увімкнено. Наступного разу після пароля введіть код із додатку.</p>';
    await renderMfaStatus();
    Persons.toast("2FA увімкнено");
  });
});
$("pf-mfa-off").addEventListener("click", async () => {
  if (!iAmAdmin) return;
  if (!confirm("Вимкнути двофакторний вхід? Обліковий запис буде захищено лише паролем.")) return;
  try {
    await Mfa.disable();
    Persons.toast("2FA вимкнено");
  } catch (e) {
    console.error(e);
    Persons.toast("Не вдалося вимкнути 2FA. Увійдіть заново з кодом і спробуйте ще раз.");
  }
  renderMfaStatus();
});
(async () => {
  const { data } = await db.auth.getSession();
  if (data.session && isStale()) {
    await db.auth.signOut();
    try {
      localStorage.removeItem(IDLE_KEY);
    } catch (e) {
    }
    showLogin(`Сесію завершено після ${IDLE_MINUTES} хвилин бездіяльності. Увійдіть знову.`);
    return;
  }
  if (data.session) await enterWithSession(data.session);
  else showLogin();
})();
function openDeepLink() {
  const prm = new URLSearchParams(location.search);
  const person = prm.get("person"), caseId = prm.get("case");
  if (!person && !caseId) return;
  history.replaceState(history.state, "", location.pathname);
  if (caseId) {
    document.querySelector('.tab[data-tab="cabinet"]').click();
    Cabinet.openByJournal(caseId);
  } else {
    Persons.openForm(person);
  }
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("sw", e));
  });
}
