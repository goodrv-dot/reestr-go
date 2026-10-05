// ============================================================
// Реєстр — вхід співробітника і запуск кабінету
// Порядок входу: пароль → код 2FA (якщо підключено) → перевірка доступу →
// зміна тимчасового пароля → обов'язкове підключення 2FA (якщо вимагається) → кабінет
// ============================================================
const { SUPABASE_URL, SUPABASE_KEY, IDLE_MINUTES } = window.APP_CONFIG;
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const ROLE_LABELS = { admin: 'Адміністратор', operator: 'Оператор' };
let currentOperator = null;
let currentUserId = null;
let mfaRequiredForMe = false;

Mfa.init(db);

// ---------- Екрани ----------
const SCREENS = ['loading', 'login-screen', 'pwchange-screen', 'app-screen', 'mfa-screen', 'mfa-enroll-screen'];
function show(id) { SCREENS.forEach((s) => { $(s).hidden = s !== id; }); }

function showLogin(message) {
  show('login-screen');
  setError(message || '');
  $('email').focus();
}

function showApp(operator, userId) {
  currentOperator = operator;
  currentUserId = userId;
  show('app-screen');
  $('user-name').textContent = operator.full_name;
  $('user-role').textContent = ROLE_LABELS[operator.role] || operator.role;
  startIdleTimer();
  $('staff-tab').hidden = operator.role !== 'admin';
  Persons.init(db, operator).then(() => {
    if (!window.__exp) {
      Exporter.init();
      Journal.init();
      Importer.init();
      if (operator.role === 'admin') Staff.init(db, userId);
      Segments.init(db, userId, operator.role === 'admin');
      Cabinet.init(db, userId, operator.role === 'admin');
      window.__exp = true;
    }
  }).catch((e) => {
    console.error(e);
    alert('Не вдалося завантажити довідники. Оновіть сторінку.');
  });
}

function setError(text) {
  $('login-error').textContent = text;
  $('login-error').hidden = !text;
}

// ---------- Послідовність входу ----------
async function enterWithSession(session) {
  try {
    const userId = session.user.id;

    // 1. Якщо 2FA підключена — спершу код
    const { data: aal, error: aalErr } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalErr) throw aalErr;
    if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      Mfa.showVerify(() => continueEntry());
      return;
    }

    // 2. Чи є доступ
    const { data: acc, error } = await db.rpc('my_access');
    if (error) throw error;
    if (!acc.found || !acc.active) {
      await db.auth.signOut();
      showLogin('Цей обліковий запис не має доступу до реєстру. Зверніться до адміністратора.');
      return;
    }

    // 3. Тимчасовий пароль
    if (acc.must_change_password) {
      showPasswordChange();
      return;
    }

    // 4. Обов'язкова 2FA, а її ще не підключено
    mfaRequiredForMe = acc.mfa_required === 'all' || (acc.mfa_required === 'admins' && acc.role === 'admin');
    if (mfaRequiredForMe && aal.currentLevel !== 'aal2') {
      Mfa.showEnrollScreen(() => continueEntry());
      return;
    }

    // 5. Кабінет
    const { data: operator, error: opErr } = await db.from('operators')
      .select('full_name, role, can_export, must_change_password, email')
      .eq('user_id', userId).maybeSingle();
    if (opErr) throw opErr;
    if (!operator) {
      await db.auth.signOut();
      showLogin('Не вдалося підтвердити доступ. Увійдіть ще раз.');
      return;
    }
    showApp(operator, userId);
  } catch (e) {
    console.error(e);
    showLogin('Не вдалося перевірити доступ. Перевірте інтернет і спробуйте ще раз.');
  }
}

async function continueEntry() {
  const { data } = await db.auth.getSession();
  if (data.session) await enterWithSession(data.session);
  else showLogin();
}

// ---------- Вхід ----------
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;

  if (!email || !password) {
    setError('Введіть електронну пошту і пароль.');
    return;
  }

  $('login-btn').disabled = true;
  $('login-btn').textContent = 'Перевіряємо…';
  setError('');

  const { data, error } = await db.auth.signInWithPassword({ email, password });

  $('login-btn').disabled = false;
  $('login-btn').textContent = 'Увійти';

  if (error) {
    const wrong = /invalid login credentials/i.test(error.message);
    const banned = /banned/i.test(error.message);
    setError(wrong ? 'Невірна пошта або пароль.'
      : banned ? 'Обліковий запис деактивовано. Зверніться до адміністратора.'
      : 'Не вдалося увійти. Перевірте інтернет і спробуйте ще раз.');
    return;
  }
  $('password').value = '';
  await enterWithSession(data.session);
});

// ---------- Вихід ----------
async function logout(message) {
  stopIdleTimer();
  await db.auth.signOut();
  showLogin(message);
}
window.appLogout = logout;
$('logout-btn').addEventListener('click', () => logout());

// ---------- Автовихід після бездіяльності ----------
// Час останньої дії зберігається в браузері: так автовихід спрацює, навіть якщо телефон
// «заморозив» сторінку, екран був вимкнений або сайт закрили й відкрили пізніше.
const IDLE_MS = IDLE_MINUTES * 60 * 1000;
const IDLE_KEY = 'reestr_last_activity';
const IDLE_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
let idleWatch = null;
let lastWrite = 0;

function readLast() {
  try { return Number(localStorage.getItem(IDLE_KEY)) || 0; } catch { return 0; }
}
function markActivity() {
  const now = Date.now();
  if (now - lastWrite < 10000) return;          // записуємо не частіше разу на 10 с
  lastWrite = now;
  try { localStorage.setItem(IDLE_KEY, String(now)); } catch { /* приватний режим */ }
}
function isStale() {
  const last = readLast();
  return last > 0 && Date.now() - last > IDLE_MS;
}
function checkIdle() {
  if ($('app-screen').hidden) return;
  if (isStale()) logout(`Сесію завершено після ${IDLE_MINUTES} хвилин бездіяльності. Увійдіть знову.`);
}
function startIdleTimer() {
  lastWrite = 0;
  markActivity();
  IDLE_EVENTS.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));
  clearInterval(idleWatch);
  idleWatch = setInterval(checkIdle, 30000);
}
function stopIdleTimer() {
  clearInterval(idleWatch);
  IDLE_EVENTS.forEach((ev) => window.removeEventListener(ev, markActivity));
  try { localStorage.removeItem(IDLE_KEY); } catch { /* */ }
}
// Повернулися до вкладки / розблокували телефон — одразу перевіряємо
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkIdle(); });
window.addEventListener('pageshow', checkIdle);
window.addEventListener('focus', checkIdle);

// ---------- Зміна тимчасового пароля при першому вході ----------
function showPasswordChange() {
  show('pwchange-screen');
  $('pw-new').focus();
}

$('pwchange-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const p1 = $('pw-new').value, p2 = $('pw-new2').value;
  const err = (t) => { $('pwchange-error').textContent = t; $('pwchange-error').hidden = !t; };
  if (p1.length < 10) return err('Пароль має містити щонайменше 10 символів.');
  if (p1 !== p2) return err('Паролі не збігаються.');
  err('');
  $('pwchange-btn').disabled = true;
  const { error } = await db.auth.updateUser({ password: p1 });
  if (!error) await db.rpc('password_changed');
  $('pwchange-btn').disabled = false;
  if (error) {
    console.error(error);
    return err(/same|different/i.test(error.message)
      ? 'Новий пароль має відрізнятися від тимчасового.'
      : 'Не вдалося змінити пароль. Спробуйте ще раз.');
  }
  $('pw-new').value = ''; $('pw-new2').value = '';
  continueEntry();
});

// ---------- Мій профіль ----------
$('profile-btn').addEventListener('click', openProfile);
$('profile-close').addEventListener('click', () => $('profile-dialog').close());

async function openProfile() {
  $('pf-name').textContent = currentOperator.full_name;
  $('pf-email').textContent = currentOperator.email || '';
  $('pf-role').textContent = ROLE_LABELS[currentOperator.role] || currentOperator.role;
  $('pf-enroll-box').innerHTML = '';
  $('profile-dialog').showModal();
  await renderMfaStatus();
}

async function renderMfaStatus() {
  const on = await Mfa.enabled().catch(() => false);
  $('pf-mfa-status').textContent = on ? 'Увімкнено' : 'Вимкнено';
  $('pf-mfa-status').className = 'mfa-state ' + (on ? 'is-on' : 'is-off');
  $('pf-mfa-on').hidden = on;
  $('pf-mfa-off').hidden = !on || mfaRequiredForMe;
  $('pf-mfa-note').textContent = mfaRequiredForMe
    ? 'Для вашої ролі 2FA обов’язкова — вимкнути її не можна.'
    : on ? 'При кожному вході після пароля система попросить код із додатку.'
         : 'Рекомендуємо увімкнути: навіть якщо пароль стане відомий іншим, без вашого телефона увійти не вийде.';
}

$('pf-mfa-on').addEventListener('click', () => {
  $('pf-mfa-on').hidden = true;
  Mfa.renderEnroll($('pf-enroll-box'), async () => {
    $('pf-enroll-box').innerHTML = '<p class="tip">2FA увімкнено. Наступного разу після пароля введіть код із додатку.</p>';
    await renderMfaStatus();
    Persons.toast('2FA увімкнено');
  });
});

$('pf-mfa-off').addEventListener('click', async () => {
  if (!confirm('Вимкнути двофакторний вхід? Обліковий запис буде захищено лише паролем.')) return;
  try {
    await Mfa.disable();
    Persons.toast('2FA вимкнено');
  } catch (e) {
    console.error(e);
    Persons.toast('Не вдалося вимкнути 2FA. Увійдіть заново з кодом і спробуйте ще раз.');
  }
  renderMfaStatus();
});

// ---------- Старт: якщо вже є сесія — продовжуємо вхід ----------
(async () => {
  const { data } = await db.auth.getSession();
  if (data.session && isStale()) {
    // сайт відкрили після довгої перерви — сесія вважається завершеною
    await db.auth.signOut();
    try { localStorage.removeItem(IDLE_KEY); } catch { /* */ }
    showLogin(`Сесію завершено після ${IDLE_MINUTES} хвилин бездіяльності. Увійдіть знову.`);
    return;
  }
  if (data.session) await enterWithSession(data.session);
  else showLogin();
})();
