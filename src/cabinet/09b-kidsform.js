//@ Частина кабінету «Анкета «Діти» у WhatsApp».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Анкета «Діти» у WhatsApp (усі кабінети; строки — kidsDue) ----------
  // Посилання і два тексти — app_settings (kids_form_url, kids_form_text — родині, kids_form_text_self — самому бійцю), змінює адміністратор.
  // Підстановки: {ім’я} — ім’я та по батькові отримувача, {оператор} — хто надсилає, {посилання}, {загиблий} — ПІБ особи справи.
  const KIDS_TEXT_DEFAULT = 'Доброго дня, {ім’я}!\nМене звати {оператор}, я з ГО «Ветеранський корпус Морської піхоти». Ми поруч із вашою родиною.\n\nЯкщо у вашій родині є діти до 18 років, просимо заповнити коротку анкету — так ми зможемо запрошувати їх на оздоровлення, табори та інші програми підтримки:\n{посилання}\n\nЯкщо це не стосується вашої родини — просто напишіть нам про це у відповідь.\n\nЗбережіть, будь ласка, цей номер — за ним ви завжди можете звернутися до нас з питаннями чи по підтримку.\nБудь ласка, підтвердіть коротким повідомленням, що отримали. Дякуємо.';
  const KIDS_TEXT_SELF_DEFAULT = KIDS_TEXT_DEFAULT.replace('Ми поруч із вашою родиною.', 'Дякуємо вам за службу.');
  const kidsSet = { loaded: false, url: '', text: '', textSelf: '', entry: '' };
  async function loadKidsSet(force) {
    if (kidsSet.loaded && !force) return kidsSet;
    const { data, error } = await db.from('app_settings').select('key, value').in('key', ['kids_form_url', 'kids_form_text', 'kids_form_text_self', 'kids_form_code_entry']);
    if (error) { console.error(error); return kidsSet; }
    kidsSet.url = ''; kidsSet.text = ''; kidsSet.textSelf = '';
    (data || []).forEach((r) => { if (r.key === 'kids_form_url') kidsSet.url = r.value || ''; else if (r.key === 'kids_form_text') kidsSet.text = r.value || ''; else if (r.key === 'kids_form_code_entry') kidsSet.entry = r.value || ''; else kidsSet.textSelf = r.value || ''; });
    kidsSet.loaded = true; return kidsSet;
  }
  const waDigits = (phone) => { const d = String(phone || '').replace(/\D/g, ''); return d.length >= 9 ? d : ''; };
  // «Код анкети» — нейтральний код справи (перші 8 знаків її id), щоб відповідь прив’язалась саме до цієї справи.
  // Номер справи («200-…») родині не показуємо — це боляче.
  const caseCode = (c) => String(c.id).replace(/-/g, '').slice(0, 8).toUpperCase();
  const kidsLink = (c) => (kidsSet.entry && kidsSet.url
    ? kidsSet.url.replace(/[?#].*$/, '') + '?usp=pp_url&' + encodeURIComponent(kidsSet.entry) + '=' + caseCode(c) : kidsSet.url);
  const kidsText = (k) => ((k.self ? kidsSet.textSelf || KIDS_TEXT_SELF_DEFAULT : kidsSet.text || KIDS_TEXT_DEFAULT))
    .replace(/\{ім[’'`]?я\}/gi, [k.person.first_name, k.person.patronymic].filter(Boolean).join(' ') || '')
    .replace(/\{оператор\}/gi, staff.get(me) || 'співробітник')
    .replace(/\{посилання\}/gi, kidsLink(current))
    .replace(/\{загиблий\}/gi, fio(current.person));

  function kidsFormEl(c) {
    const box = document.createElement('div'); box.className = 'kids-form';
    if (c.vals.kids_form_filled) {   // діти вже є в картці родича (анкета / імпорт) або позначено вручну
      box.innerHTML = '<span class="kids-done">✅ Анкету «Діти» заповнено — надсилати не потрібно</span>'; return box;
    }
    const ks = kidsState(c);
    if (ks.k === 'nokids') { box.innerHTML = '<span class="kids-dnd">🚫 Дітей немає / не актуально — не надсилаємо</span>'; return box; }
    if (ks.k === 'dnd') { box.innerHTML = '<span class="kids-dnd">🔕 Не турбувати — більше не надсилаємо</span>'; return box; }
    const repeat = ks.k === 'repeat';
    if (ks.k === 'wait1' || ks.k === 'wait2') {
      box.innerHTML = `<span class="kids-wait">⏳ Чекаємо відповідь до ${fmt(ks.due)}</span> `;
      const no = document.createElement('button'); no.type = 'button'; no.className = 'btn-secondary btn-small';
      no.textContent = '🚫 Відповіли: дітей немає / не актуально';
      no.onclick = async () => { if (!c.vals.kids_form_none) await saveValue('kids_form_none', today()); };
      box.append(no); return box;
    }
    // 300 / полон / ветерани — першим пропонуємо саму особу справи (вона жива й знає своїх дітей), далі рідних
    const self = ['300', 'pol', 'vet'].includes(module) && waDigits(c.person.phone) ? [{ person: c.person, relation_degree: 'сам(а)', self: true }] : [];
    const withPhone = [...self, ...c.kin.filter((k) => waDigits(k.person.phone))];
    if (!withPhone.length) { box.innerHTML = (['300', 'pol', 'vet'].includes(module) ? '<span class="muted">Щоб надіслати анкету, внесіть телефон особи або додайте в «Родині» родича з телефоном.</span>' : '<span class="muted">Щоб надіслати анкету, додайте в «Родині» родича з телефоном.</span>'); return box; }
    const contact = contactOf(c);
    const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Кому надіслати');
    withPhone.forEach((k, i) => {
      const o = document.createElement('option'); o.value = String(i);
      o.textContent = `${fio(k.person)}${k.relation_degree ? ' (' + k.relation_degree + ')' : ''} · ${V.formatPhone(k.person.phone) || k.person.phone}`;
      if (self.length ? k === self[0] : k === contact) o.selected = true; sel.appendChild(o);
    });
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn-primary btn-small';
    btn.textContent = repeat ? '🔁 Надіслати повторно → WhatsApp' : '💬 Анкета «Діти» → WhatsApp';
    btn.title = 'Відкриє WhatsApp з цим абонентом і вже набраним повідомленням з посиланням — лишиться натиснути «Надіслати»';
    btn.onclick = async () => {
      const k = withPhone[Number(sel.value)] || withPhone[0];
      // вікно відкриваємо одразу (інакше браузер заблокує як спливне), адресу ставимо після завантаження налаштувань
      const w = window.open('', '_blank');
      await loadKidsSet();
      if (!kidsSet.url) { if (w) w.close(); Persons.toast('Посилання на анкету не задано — адміністратор вносить його в «Налаштування полів»'); return; }
      const href = `https://wa.me/${waDigits(k.person.phone)}?text=${encodeURIComponent(kidsText(k))}`;
      if (w) { try { w.opener = null; } catch (e) { /* */ } w.location.href = href; } else location.href = href;
      if (!c.vals.kids_form_sent) await saveValue('kids_form_sent', today());
      else if (repeat && !c.vals.kids_form_resent) await saveValue('kids_form_resent', today());
    };
    // родина відповіла, що дітей немає / не стосується — більше не надсилаємо
    const no = document.createElement('button'); no.type = 'button'; no.className = 'btn-secondary btn-small';
    no.textContent = '🚫 Дітей немає / не актуально';
    no.title = 'Родина відповіла, що анкета їх не стосується — більше не надсилаємо й не нагадуємо';
    no.onclick = async () => { if (!c.vals.kids_form_none) await saveValue('kids_form_none', today()); };
    box.append(sel, ' ', btn, ' ', no);
    if (withPhone.length === 1) sel.hidden = true, box.prepend(document.createTextNode(`Кому: ${fio(withPhone[0].person)} `));
    return box;
  }

  // Налаштування (адміністратор): посилання і текст
  async function loadKidsFormEditor() {
    const box = $('cab-kids-form'); if (!box) return;
    box.hidden = false;
    await loadKidsSet(true);
    // зведення по всіх кабінетах (лише адміністратор)
    const { data: sm } = await db.rpc('kids_form_summary');
    const MOD = { '200': '200', '300': '300', bzv: 'БЗВ', pol: 'Полон', vet: 'Ветерани' }, ORDER = ['none', 'wait1', 'repeat', 'wait2', 'dnd', 'nokids', 'filled'];
    const by = {}; (sm || []).forEach((r) => { (by[r.module] = by[r.module] || {})[r.state] = Number(r.n); });
    $('kf-summary').innerHTML = !sm || !sm.length ? '' : `<table class="kf-sum"><thead><tr><th></th>${ORDER.map((k) => `<th>${KIDS_LABEL[k]}</th>`).join('')}</tr></thead><tbody>${
      Object.keys(MOD).filter((m) => by[m]).map((m) => `<tr><th>${MOD[m]}</th>${ORDER.map((k) => `<td>${by[m][k] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('kf-url').value = kidsSet.url; $('kf-text').value = kidsSet.text || KIDS_TEXT_DEFAULT; $('kf-text-self').value = kidsSet.textSelf || KIDS_TEXT_SELF_DEFAULT;
    $('kf-save').onclick = async (ev) => {
      const b = ev.currentTarget; if (b.disabled) return;
      const url = $('kf-url').value.trim(), text = $('kf-text').value.trim(), textSelf = $('kf-text-self').value.trim();
      if (url && !safeUrl(url)) { Persons.toast('Вставте повне посилання, що починається з https://'); return; }
      b.disabled = true;
      const now = new Date().toISOString();
      const { error } = await db.from('app_settings').upsert([{ key: 'kids_form_url', value: url, updated_at: now }, { key: 'kids_form_text', value: text, updated_at: now }, { key: 'kids_form_text_self', value: textSelf, updated_at: now }], { onConflict: 'key' });
      b.disabled = false;
      if (error) { console.error(error); Persons.toast('Не вдалося зберегти'); return; }
      kidsSet.url = url; kidsSet.text = text; kidsSet.textSelf = textSelf; Persons.toast('Анкету «Діти» збережено');
    };
  }
