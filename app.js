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
  $('app-screen').hidden = true;
  $('login-screen').hidden = false;
  setError(message || '');
  $('email').focus();
}

function showApp(operator) {
  $('loading').hidden = true;
  $('login-screen').hidden = true;
  $('app-screen').hidden = false;
  $('user-name').textContent = operator.full_name;
  $('user-role').textContent = ROLE_LABELS[operator.role] || operator.role;
  startIdleTimer();
  Persons.init(db).catch((e) => {
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
    .select('full_name, role, can_export')
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
    showApp(operator);
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
