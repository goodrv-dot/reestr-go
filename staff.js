// ============================================================
// Вкладка «Співробітники» (лише адміністратор).
// Облікові записи створює Edge Function manage-operators.
// ============================================================
window.Staff = (() => {
  const $ = (id) => document.getElementById(id);
  let db = null;
  let me = null;
  let mfaStatus = {};

  function init(client, userId) {
    db = client;
    me = userId;
    $('staff-add-btn').addEventListener('click', () => {
      $('staff-form').reset();
      $('staff-form-error').hidden = true;
      $('staff-dialog').showModal();
      $('st-email').focus();
    });
    $('staff-cancel').addEventListener('click', () => $('staff-dialog').close());
    $('staff-form').addEventListener('submit', create);
    $('pw-close').addEventListener('click', () => $('pw-dialog').close());
    $('pw-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('pw-value').textContent); $('pw-copy').textContent = 'Скопійовано'; }
      catch { $('pw-copy').textContent = 'Виділіть і скопіюйте вручну'; }
    });
    initMfaSetting();
    load();
  }

  async function initMfaSetting() {
    const sel = $('mfa-required');
    const { data } = await db.from('app_settings').select('value').eq('key', 'mfa_required').maybeSingle();
    sel.value = data ? data.value : 'none';
    sel.dataset.prev = sel.value;
    sel.addEventListener('change', async () => {
      const val = sel.value;
      if (val !== 'none') {
        const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal.currentLevel !== 'aal2') {
          alert('Спочатку підключіть 2FA собі: «Мій профіль» → «Увімкнути 2FA». Інакше ви втратите доступ до реєстру.');
          sel.value = sel.dataset.prev;
          return;
        }
        const who = val === 'all' ? 'усіх співробітників' : 'адміністраторів';
        if (!confirm(`Зробити 2FA обов’язковою для ${who}? Хто ще не підключив 2FA, при наступному вході побачить екран підключення.`)) {
          sel.value = sel.dataset.prev;
          return;
        }
      }
      const { error } = await db.from('app_settings')
        .update({ value: val, updated_at: new Date().toISOString() }).eq('key', 'mfa_required');
      if (error) { console.error(error); Persons.toast('Не вдалося зберегти налаштування'); sel.value = sel.dataset.prev; return; }
      sel.dataset.prev = val;
      Persons.toast(val === 'none' ? '2FA тепер за бажанням' : '2FA тепер обов’язкова');
    });
  }

  async function call(payload) {
    const { data, error } = await db.functions.invoke('manage-operators', { body: payload });
    if (error) {
      let msg = 'Не вдалося виконати дію';
      try { const b = await error.context.json(); if (b.error) msg = b.error; } catch {}
      throw new Error(msg);
    }
    return data;
  }

  async function load() {
    const { data, error } = await db.from('operators')
      .select('user_id, full_name, email, role, can_export, can_registry, can_import, can_cab200, can_cab300, cell_ids, active, must_change_password, created_at')
      .order('active', { ascending: false }).order('full_name');
    const tbody = $('staff-table').tBodies[0];
    tbody.innerHTML = '';
    if (error) { console.error(error); return; }
    try { mfaStatus = (await call({ action: 'mfa_status' })).status || {}; } catch { mfaStatus = {}; }
    data.forEach((o) => tbody.appendChild(row(o)));
  }

  function row(o) {
    const tr = document.createElement('tr');
    if (!o.active) tr.className = 'is-inactive';
    const self = o.user_id === me;

    const name = document.createElement('td');
    name.innerHTML = '<b></b><br><span class="muted"></span>';
    name.querySelector('b').textContent = o.full_name + (self ? ' (ви)' : '');
    name.querySelector('span').textContent = o.email || '';
    tr.appendChild(name);

    // Роль
    const tdRole = document.createElement('td');
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Роль ' + o.full_name);
    [['operator', 'Оператор'], ['admin', 'Адміністратор']].forEach(([v, t]) => sel.add(new Option(t, v)));
    sel.value = o.role;
    sel.disabled = self || !o.active;
    sel.addEventListener('change', () => act({ action: 'update', user_id: o.user_id, role: sel.value }, 'Роль змінено'));
    tdRole.appendChild(sel);
    tr.appendChild(tdRole);

    // Експорт
    const tdExp = document.createElement('td');
    if (o.role === 'admin') tdExp.innerHTML = '<span class="muted">усе (адміністратор)</span>';
    else {
      const cells = Persons.ctx().cells;
      const parts = [o.can_registry && 'Реєстр', o.can_registry && o.can_export && 'Експорт', o.can_registry && o.can_import && 'Імпорт', o.can_cab200 && 'Кабінет 200', o.can_cab300 && 'Кабінет 300'].filter(Boolean);
      const cn = (o.cell_ids || []).map((id) => cells.get(id)).filter(Boolean);
      const sum = document.createElement('div'); sum.className = 'acc-sum';
      sum.innerHTML = '<span></span><br><span class="muted"></span>';
      sum.firstChild.textContent = parts.length ? parts.join(' · ') : 'немає доступів';
      sum.lastChild.textContent = (o.can_cab200 || o.can_cab300) ? (cn.length ? (cn.length === cells.size ? 'усі осередки' : 'осередки: ' + cn.join(', ')) : 'осередки не вибрано — справ не бачить') : '';
      tdExp.appendChild(sum);
      if (o.active) tdExp.appendChild(btn('Змінити доступи', () => openAccess(o)));
    }
    tr.appendChild(tdExp);

    // 2FA
    const tdMfa = document.createElement('td');
    const on = mfaStatus[o.user_id];
    tdMfa.innerHTML = `<span class="mfa-state ${on ? 'is-on' : 'is-off'}">${on ? 'Увімкнено' : 'Вимкнено'}</span>`;
    tr.appendChild(tdMfa);

    // Стан
    const tdState = document.createElement('td');
    tdState.textContent = !o.active ? 'Деактивовано' : o.must_change_password ? 'Очікує зміни пароля' : 'Активний';
    tr.appendChild(tdState);

    // Дії
    const tdAct = document.createElement('td');
    tdAct.className = 'staff-actions';
    if (!self) {
      if (o.active) {
        tdAct.appendChild(btn('Скинути пароль', async () => {
          if (!confirm(`Видати ${o.full_name} новий тимчасовий пароль? Старий перестане діяти.`)) return;
          const r = await act({ action: 'reset_password', user_id: o.user_id });
          if (r) showPassword(o.full_name, o.email, r.password);
        }));
        if (mfaStatus[o.user_id]) {
          tdAct.appendChild(btn('Скинути 2FA', async () => {
            if (!confirm(`Скинути 2FA для ${o.full_name}? Використовуйте, якщо співробітник втратив телефон. Він підключить 2FA заново.`)) return;
            act({ action: 'reset_mfa', user_id: o.user_id }, '2FA скинуто');
          }));
        }
        tdAct.appendChild(btn('Деактивувати', async () => {
          if (!confirm(`Деактивувати ${o.full_name}? Доступ до реєстру зникне одразу.`)) return;
          act({ action: 'deactivate', user_id: o.user_id }, 'Деактивовано');
        }, 'btn-link-danger'));
      } else {
        tdAct.appendChild(btn('Повернути доступ', () => act({ action: 'activate', user_id: o.user_id }, 'Доступ повернуто')));
      }
    }
    tr.appendChild(tdAct);
    return tr;
  }

  // ---------- Доступи співробітника ----------
  function openAccess(o) {
    const d = $('acc-dialog'); const f = $('acc-form');
    $('acc-who').textContent = o.full_name;
    f.registry.checked = o.can_registry; f.export.checked = o.can_export; f.import.checked = o.can_import;
    f.cab200.checked = o.can_cab200; f.cab300.checked = o.can_cab300;
    const box = $('acc-cells'); box.innerHTML = '';
    [...Persons.ctx().cells].forEach(([id, n]) => {
      const l = document.createElement('label'); l.className = 'check';
      l.innerHTML = '<input type="checkbox" name="cell"> <span></span>';
      l.firstChild.value = id; l.firstChild.checked = (o.cell_ids || []).includes(id); l.lastChild.textContent = n;
      box.appendChild(l);
    });
    const sync = () => {
      f.export.disabled = f.import.disabled = !f.registry.checked;
      $('acc-cells-wrap').hidden = !(f.cab200.checked || f.cab300.checked);
    };
    f.oninput = sync; sync();
    $('acc-all').onclick = () => { const all = [...box.querySelectorAll('input')]; const on = all.some((i) => !i.checked); all.forEach((i) => { i.checked = on; }); };
    $('acc-cancel').onclick = () => d.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const cab = f.cab200.checked || f.cab300.checked;
      const cells = cab ? [...box.querySelectorAll('input:checked')].map((i) => Number(i.value)) : [];
      if (cab && !cells.length && !confirm('Осередки не вибрано: співробітник не побачить жодної справи. Зберегти так?')) return;
      const { error } = await db.rpc('set_operator_access', { p_user: o.user_id, p_registry: f.registry.checked, p_export: f.registry.checked && f.export.checked,
        p_import: f.registry.checked && f.import.checked, p_cab200: f.cab200.checked, p_cab300: f.cab300.checked, p_cells: cells });
      if (error) { console.error(error); Persons.toast('Не вдалося зберегти доступи'); return; }
      d.close(); Persons.toast('Доступи збережено. Співробітник побачить зміни після наступного входу.'); load();
    };
    d.showModal();
  }

  function btn(text, onClick, extra) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-link ' + (extra || '');
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  async function act(payload, okText) {
    try {
      const r = await call(payload);
      if (okText) Persons.toast(okText);
      load();
      return r;
    } catch (e) {
      Persons.toast(e.message);
      load();
      return null;
    }
  }

  async function create(e) {
    e.preventDefault();
    const f = $('staff-form');
    const payload = {
      action: 'create',
      email: f.email.value.trim(),
      full_name: f.full_name.value.trim(),
      role: f.role.value,
      can_export: f.can_export.checked
    };
    $('staff-save').disabled = true;
    try {
      const r = await call(payload);
      $('staff-dialog').close();
      showPassword(payload.full_name, payload.email, r.password);
      load();
    } catch (err) {
      $('staff-form-error').textContent = err.message;
      $('staff-form-error').hidden = false;
    } finally {
      $('staff-save').disabled = false;
    }
  }

  function showPassword(name, email, password) {
    $('pw-who').textContent = `${name} (${email})`;
    $('pw-value').textContent = password;
    $('pw-copy').textContent = 'Скопіювати';
    $('pw-dialog').showModal();
  }

  return { init };
})();
