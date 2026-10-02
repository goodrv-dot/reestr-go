// ============================================================
// Двофакторний вхід (2FA, TOTP): підключення, код при вході, вимкнення
// ============================================================
window.Mfa = (() => {
  const $ = (id) => document.getElementById(id);
  let db = null;
  let onVerified = null;

  function init(client) {
    db = client;
    $('mfa-form').addEventListener('submit', submitVerify);
    $('mfa-code').addEventListener('input', () => {
      if ($('mfa-code').value.replace(/\D/g, '').length === 6) $('mfa-form').requestSubmit();
    });
    $('mfa-logout').addEventListener('click', () => window.appLogout());
    $('mfa-enroll-logout').addEventListener('click', () => window.appLogout());
  }

  async function verifiedFactor() {
    const { data, error } = await db.auth.mfa.listFactors();
    if (error) throw error;
    return (data.totp || []).find((f) => f.status === 'verified') || null;
  }

  async function enabled() {
    return !!(await verifiedFactor());
  }

  // ---------- Код при вході ----------
  function showVerify(onOk) {
    onVerified = onOk;
    screens('mfa-screen');
    $('mfa-code').value = '';
    setErr('mfa-error', '');
    $('mfa-code').focus();
  }

  async function submitVerify(e) {
    e.preventDefault();
    const code = $('mfa-code').value.replace(/\D/g, '');
    if (code.length !== 6) return setErr('mfa-error', 'Введіть 6 цифр із додатку.');
    $('mfa-btn').disabled = true;
    try {
      const factor = await verifiedFactor();
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) { setErr('mfa-error', 'Невірний або застарілий код. Спробуйте свіжий код із додатку.'); return; }
      onVerified && onVerified();
    } catch (err) {
      console.error(err);
      setErr('mfa-error', 'Не вдалося перевірити код. Перевірте інтернет.');
    } finally {
      $('mfa-btn').disabled = false;
    }
  }

  // ---------- Підключення ----------
  async function startEnroll() {
    const { data: list } = await db.auth.mfa.listFactors();
    for (const f of (list?.all || []).filter((x) => x.status !== 'verified')) {
      await db.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Реєстр ГО' });
    if (error) throw error;
    return data;
  }

  // Будує блок підключення в контейнері (екран або діалог)
  async function renderEnroll(container, onDone) {
    container.innerHTML = '<p class="muted">Готуємо QR-код…</p>';
    let enr;
    try { enr = await startEnroll(); }
    catch (e) {
      console.error(e);
      container.innerHTML = '<p class="form-error">Не вдалося почати підключення 2FA. Спробуйте пізніше.</p>';
      return;
    }
    const qr = enr.totp.qr_code.startsWith('<svg')
      ? 'data:image/svg+xml;utf-8,' + encodeURIComponent(enr.totp.qr_code)
      : enr.totp.qr_code;
    const onPhone = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
    const phoneBlock = `
          <div class="enroll-phone">
            <p><b>Налаштовуєте на цьому ж телефоні?</b> QR-код зі свого екрана не відсканувати — зробіть так:</p>
            <a class="btn-primary enroll-open" href="#">Відкрити в додатку-автентифікаторі</a>
            <p class="muted enroll-or">Якщо кнопка не відкрила додаток: скопіюйте ключ і в додатку оберіть «+» → «Ввести ключ налаштування» (назва: Реєстр ГО, тип: за часом).</p>
            <div class="secret-row"><code class="secret-code"></code><button type="button" class="btn-secondary btn-small copy-secret">Скопіювати ключ</button></div>
          </div>`;
    const qrBlock = `
          <div class="qr-box"><img alt="QR-код для додатку автентифікації" width="200" height="200"></div>`;
    container.innerHTML = `
      <ol class="enroll-steps">
        <li>Встановіть на телефон <b>Google Authenticator</b> або <b>Microsoft Authenticator</b> (безкоштовно).</li>
        <li>${onPhone
          ? `Додайте обліковий запис у додаток:${phoneBlock}<details class="secret"><summary>Налаштовуєте з комп’ютера? Показати QR-код</summary>${qrBlock}</details>`
          : `У додатку натисніть «+» → «Сканувати QR-код» і наведіть камеру телефона на екран:${qrBlock}<details class="secret"><summary>Не сканується або налаштовуєте на телефоні?</summary>${phoneBlock}</details>`}
        </li>
        <li>Поверніться сюди і введіть 6-значний код, який показує додаток (у Google Authenticator код копіюється дотиком):</li>
      </ol>
      <form class="enroll-form" novalidate>
        <label class="sr-only" for="enroll-code-${enr.id}">Код із додатку</label>
        <input id="enroll-code-${enr.id}" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">
        <p class="form-error" role="alert" hidden></p>
        <button type="submit" class="btn-primary">Підтвердити</button>
      </form>`;
    container.querySelector('img').src = qr;
    container.querySelector('.secret-code').textContent = enr.totp.secret.replace(/(.{4})/g, '$1 ').trim();
    container.querySelector('.enroll-open').href = enr.totp.uri;
    container.querySelector('.copy-secret').addEventListener('click', async (ev) => {
      try { await navigator.clipboard.writeText(enr.totp.secret); ev.target.textContent = 'Скопійовано'; }
      catch { ev.target.textContent = 'Виділіть ключ і скопіюйте'; }
    });
    const form = container.querySelector('form');
    const input = form.querySelector('input');
    const err = form.querySelector('.form-error');
    if (!onPhone) input.focus();
    input.addEventListener('input', () => {
      if (input.value.replace(/\D/g, '').length === 6) form.requestSubmit();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = input.value.replace(/\D/g, '');
      if (code.length !== 6) { err.textContent = 'Введіть 6 цифр.'; err.hidden = false; return; }
      form.querySelector('button').disabled = true;
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId: enr.id, code });
      form.querySelector('button').disabled = false;
      if (error) { err.textContent = 'Код не підійшов. Введіть свіжий код із додатку.'; err.hidden = false; return; }
      onDone && onDone();
    });
  }

  function showEnrollScreen(onOk) {
    screens('mfa-enroll-screen');
    renderEnroll($('mfa-enroll-box'), onOk);
  }

  async function disable() {
    const f = await verifiedFactor();
    if (!f) return;
    const { error } = await db.auth.mfa.unenroll({ factorId: f.id });
    if (error) throw error;
  }

  // ---------- Допоміжне ----------
  function screens(show) {
    ['loading', 'login-screen', 'pwchange-screen', 'app-screen', 'mfa-screen', 'mfa-enroll-screen']
      .forEach((id) => { $(id).hidden = id !== show; });
  }
  function setErr(id, t) { $(id).textContent = t; $(id).hidden = !t; }

  return { init, enabled, showVerify, showEnrollScreen, renderEnroll, disable };
})();
