// ============================================================
// Реєстр — вхід співробітника і запуск кабінету
// ============================================================
const { SUPABASE_URL, SUPABASE_KEY, IDLE_MINUTES } = window.APP_CONFIG;
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const ROLE_LABELS = { admin: 'Адміністратор', operator: 'Оператор' };

// ---------- Показ екранів ----------
function showLogin(message) {
  $('loading').hidden = true;
  $('pwchange-screen').hidden = true;
  $('app-screen').hidden = true;
  $('login-screen').hidden = false;
  setError(message || '');
  $('email').focus();
}

function showApp(operator, userId) {
  $('loading').hidden = true;
  $('login-screen').hidden = true;
  $('pwchange-screen').hidden = true;
  $('app-screen').hidden = false;
  $('user-name').textContent = operator.full_name;
  $('user-role').textContent = ROLE_LABELS[operator.role] || operator.role;
  startIdleTimer();
  $('staff-tab').hidden = operator.role !== 'admin';
  Persons.init(db, operator).then(() => {
    if (!window.__exp) {
      Exporter.init();
      Importer.init();
      if (operator.role === 'admin') Staff.init(db, userId);
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

// ---------- Перевірка, чи користувач є оператором ----------
async function loadOperator(userId) {
  const { data, error } = await db
    .from('operators')
    .select('full_name, role, can_export, must_change_password')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data; // null, якщо користувача немає в списку операторів
}

async function enterWithSession(session) {
  try {
    const operator = await loadOperator(session.user.id);
    if (!operator) {
      await db.auth.signOut();
      showLogin('Цей обліковий запис не має доступу до реєстру. Зверніться до адміністратора.');
      return;
    }
    if (operator.must_change_password) {
      showPasswordChange(operator, session.user.id);
      return;
    }
    showApp(operator, session.user.id);
  } catch (e) {
    console.error(e);
    showLogin('Не вдалося перевірити доступ. Перевірте інтернет і спробуйте ще раз.');
  }
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
    setError(wrong
      ? 'Невірна пошта або пароль.'
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
$('logout-btn').addEventListener('click', () => logout());

// ---------- Автовихід після бездіяльності ----------
let idleTimer = null;
const IDLE_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(
    () => logout(`Сесію завершено після ${IDLE_MINUTES} хвилин бездіяльності. Увійдіть знову.`),
    IDLE_MINUTES * 60 * 1000
  );
}
function startIdleTimer() {
  IDLE_EVENTS.forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));
  resetIdle();
}
function stopIdleTimer() {
  clearTimeout(idleTimer);
  IDLE_EVENTS.forEach((ev) => window.removeEventListener(ev, resetIdle));
}

// ---------- Старт: якщо вже є сесія — одразу в кабінет ----------
(async () => {
  const { data } = await db.auth.getSession();
  if (data.session) {
    await enterWithSession(data.session);
  } else {
    showLogin();
  }
})();

// ---------- Зміна тимчасового пароля при першому вході ----------
let pendingOperator = null;
let pendingUserId = null;
function showPasswordChange(operator, userId) {
  pendingOperator = operator;
  pendingUserId = userId;
  $('loading').hidden = true;
  $('login-screen').hidden = true;
  $('app-screen').hidden = true;
  $('pwchange-screen').hidden = false;
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
  showApp({ ...pendingOperator, must_change_password: false }, pendingUserId);
});
