//@ Частина кабінету «Дзвіночок і лічильники на вкладці».
//@ Файли src/cabinet/*.js склеюються по порядку в cabinet.js: node tools/build-cabinet.mjs (рядки //@ не потрапляють у збірку).
  // ---------- Дзвіночок: сповіщення для мене (виконавця) + лічильники на вкладці ----------
  const NOTE = {
    overdue: ['Прострочено', 'n-over'], today: ['На сьогодні', 'n-now'],
    new: ['Нова справа у вашому осередку', 'n-new'], assigned: ['Вам призначено справу', 'n-new']
  };
  let notes = [], bellWired = false;
  // дзвіночок: не частіше ніж раз на 20 с (відкриття кількох справ поспіль — один запит)
  let badgeAt = 0, badgeTimer = null;
  function badge() {
    const wait = badgeAt + 20000 - Date.now();
    if (wait > 0) { if (!badgeTimer) badgeTimer = setTimeout(() => { badgeTimer = null; badge(); }, wait); return Promise.resolve(); }
    badgeAt = Date.now();
    return badgeNow();
  }
  async function badgeNow() {
    const tabEl = document.querySelector('.tab[data-tab="cabinet"]'); if (!tabEl || !db) return;
    const { data, error } = await db.rpc('my_notifications');
    if (error) { console.error(error); return; }
    notes = data || [];
    if (isAdmin) {                                   // адміністратору — ще й збій робота-дзеркала
      const r = await db.rpc('robot_alert');
      if (r.data) notes = [{ kind: 'robot', label: r.data }, ...notes];
    }
    // «Чат / Задачі»: розмови, де є щось нове не від мене
    if (window.Feedback) {
      const fb = await Feedback.counts().catch(() => ({ fresh: 0 }));
      if (fb.fresh) notes.push({ kind: 'fb', label: `Нове в чаті / задачах: ${fb.fresh}` });
      Feedback.refreshDot(fb);   // ті самі числа — без другого запиту
    }
    appBadge(notes.length);
    const cnt = (k) => notes.filter((x) => x.kind === k).length;
    tabEl.textContent = 'Кабінет';
    const pill = (n, cls, title) => { if (!n) return; const b = document.createElement('span'); b.className = 'tab-badge ' + cls; b.textContent = n; b.title = title; tabEl.append(' ', b); };
    pill(cnt('new') + cnt('assigned'), '', 'Нові та призначені вам справи');
    pill(cnt('overdue'), 'tab-badge-over', 'Прострочені дії у моїх справах');
    const bell = $('bell-btn'); if (!bell) return;
    bell.hidden = false;
    const nb = $('bell-count'); nb.textContent = notes.length > 99 ? '99+' : notes.length; nb.hidden = !notes.length;
    bell.classList.toggle('has-over', cnt('overdue') + cnt('robot') > 0);
    bell.title = notes.length ? `Сповіщень: ${notes.length}` : 'Сповіщень немає';
    ring();
    if (!bellWired) {
      bellWired = true;
      bell.addEventListener('click', (e) => { e.stopPropagation(); const p = $('bell-panel'); p.hidden = !p.hidden; if (!p.hidden) { renderBell(); markHeard(); } });
      document.addEventListener('click', (e) => { if (!e.target.closest('#bell-panel')) $('bell-panel').hidden = true; });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('bell-panel').hidden = true; });
      setInterval(() => { if (!document.hidden) badge(); }, 5 * 60 * 1000);       // оновлення раз на 5 хв
      document.addEventListener('visibilitychange', () => { if (!document.hidden) badge(); });
    }
    if (!$('bell-panel').hidden) renderBell();
  }
  // Мерехтіння й звук: дзвіночок блимає, доки є сповіщення, яких я ще не бачив (відкриття панелі = «побачив»).
  // Звук — коли під час роботи з’являється нове сповіщення. Без додаткових запитів до бази.
  const nkey = (x) => [x.kind, x.case_id || '', x.label || ''].join('|');
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* приватний режим */ } };
  let heard = null, heardFor = null, ringFirst = true, prevFresh = 0;
  function ring() {
    if (heardFor !== me) { heardFor = me; try { heard = new Set(JSON.parse(lsGet('bell_heard_' + me) || '[]')); } catch { heard = new Set(); } }
    const fresh = notes.filter((x) => !heard.has(nkey(x))).length;
    $('bell-btn').classList.toggle('bell-ring', fresh > 0);
    if (!ringFirst && fresh > prevFresh && lsGet('bell_mute') !== '1') beep();
    ringFirst = false; prevFresh = fresh;
  }
  function markHeard() {
    heard = new Set(notes.map(nkey)); lsSet('bell_heard_' + me, JSON.stringify([...heard].slice(0, 500)));
    prevFresh = 0; $('bell-btn').classList.remove('bell-ring');
  }
  function beep() {
    try {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
      const ac = beep.ac || (beep.ac = new A()); if (ac.state === 'suspended') ac.resume();
      [[880, 0], [1320, 0.18]].forEach(([f, t]) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
        const t0 = ac.currentTime + t; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + 0.4);
      });
    } catch { /* без звуку */ }
  }
  // Число сповіщень — на ярлику: у назві вкладки, на значку вкладки і (для встановленого застосунку) на іконці
  const BASE_TITLE = document.title;
  let favBase = null;
  function appBadge(n) {
    document.title = n ? `(${n > 99 ? '99+' : n}) ${BASE_TITLE}` : BASE_TITLE;
    try { if ('setAppBadge' in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch { /* немає підтримки */ }
    const link = document.querySelector('link[rel="icon"][sizes="32x32"]'); if (!link) return;
    const draw = (img) => {
      const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
      g.drawImage(img, 0, 0, 32, 32);
      if (n) {
        g.fillStyle = '#d64545'; g.beginPath(); g.arc(22, 10, 10, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(n > 9 ? '9+' : String(n), 22, 11);
      }
      // svg-іконку прибираємо, щоб браузер показав саме намальований значок
      document.querySelectorAll('link[rel="icon"][type="image/svg+xml"]').forEach((l) => l.remove());
      link.href = c.toDataURL('image/png');
    };
    if (favBase) { draw(favBase); return; }
    const img = new Image(); img.onload = () => { favBase = img; draw(img); }; img.src = 'icons/favicon-32.png';
  }

  function renderBell() {
    const p = $('bell-panel'); p.innerHTML = '<h2>Сповіщення</h2>';
    { const b = document.createElement('button'); b.type = 'button'; b.className = 'link-btn bell-mute';
      const lbl = () => { b.textContent = lsGet('bell_mute') === '1' ? '🔕 Звук вимкнено' : '🔔 Звук увімкнено'; };
      lbl(); b.title = 'Звук при новому сповіщенні'; b.onclick = (e) => { e.stopPropagation(); lsSet('bell_mute', lsGet('bell_mute') === '1' ? '0' : '1'); lbl(); if (lsGet('bell_mute') !== '1') beep(); };
      p.appendChild(b); }
    if (!notes.length) { p.insertAdjacentHTML('beforeend', '<p class="muted">Нічого нового: прострочених дій, нових справ і відповідей немає.</p>'); badgeHint(p); return; }
    notes.filter((x) => x.kind === 'robot').forEach((x) => {
      const h = document.createElement('h3'); h.className = 'n-over'; h.textContent = '⚠ Робот-дзеркало'; p.appendChild(h);
      const m = document.createElement('p'); m.className = 'bell-robot'; m.textContent = x.label + '. Дані в базі в порядку; не оновлюється лише Google-таблиця. Напишіть розробнику.'; p.appendChild(m);
    });
    const fbn = notes.filter((x) => x.kind === 'fb');
    if (fbn.length) {
      const h = document.createElement('h3'); h.className = 'n-new'; h.textContent = '💬 Чат / Задачі'; p.appendChild(h);
      const ul = document.createElement('ul');
      fbn.forEach((x) => {
        const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.className = 'bell-item';
        b.innerHTML = '<b></b>'; b.firstChild.textContent = x.label;
        b.onclick = () => { p.hidden = true; Feedback.open(); };
        li.appendChild(b); ul.appendChild(li);
      });
      p.appendChild(ul);
    }
    ['overdue', 'today', 'new', 'assigned'].forEach((k) => {
      const list = notes.filter((x) => x.kind === k); if (!list.length) return;
      const h = document.createElement('h3'); h.className = NOTE[k][1]; h.textContent = `${NOTE[k][0]} — ${list.length}`; p.appendChild(h);
      const ul = document.createElement('ul');
      list.slice(0, 15).forEach((x) => {
        const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.className = 'bell-item';
        b.innerHTML = '<b></b><span></span>';
        b.firstChild.textContent = x.fio;
        b.lastChild.textContent = x.label ? `${x.label} · ${x.days < 0 ? `прострочено на ${-x.days} ${plural(-x.days, 'день', 'дні', 'днів')}` : 'сьогодні'}` : `справа ${x.journal_id}`;
        b.onclick = () => { p.hidden = true; document.querySelector('.tab[data-tab="cabinet"]').click(); openByJournal(x.journal_id); };
        li.appendChild(b); ul.appendChild(li);
      });
      p.appendChild(ul);
      if (list.length > 15) { const m = document.createElement('p'); m.className = 'muted'; m.textContent = `…і ще ${list.length - 15} — дивіться в кабінеті`; p.appendChild(m); }
    });
    badgeHint(p);
  }

  // Число на значку встановленої програми. iPhone/iPad (iOS 16.4+) показують його лише після дозволу на сповіщення —
  // просимо дозвіл кнопкою (без натиску телефон не дозволяє). Android число на значку від сайтів не показує.
  function badgeHint(p) {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (!standalone || !('setAppBadge' in navigator) || !('Notification' in window)) return;
    const box = document.createElement('p'); box.className = 'bell-hint';
    if (Notification.permission === 'default') {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-secondary btn-small';
      b.textContent = '📱 Показувати число на значку програми';
      b.onclick = async (e) => { e.stopPropagation(); await Notification.requestPermission().catch(() => {}); badge(); };
      box.appendChild(b);
    } else if (Notification.permission === 'denied') {
      box.classList.add('muted');
      box.textContent = 'Число на значку вимкнено в налаштуваннях телефону: Параметри → Сповіщення → Реєстр → дозволити.';
    } else return;
    p.appendChild(box);
  }

  // Відкрити кабінет із готовою вибіркою справ (з дашборда)
  function openPreset(mod, ids, label) {
    module = mod; quick = ''; preset = { ids: new Set(ids), label }; withClosed = true; closedFor = mod;
    ['cab-search', 'cab-status', 'cab-exec', 'cab-resp', 'cab-mark', 'cab-cell', 'cab-region', 'cab-unit', 'cab-from', 'cab-to'].forEach((id) => { $(id).value = ''; });
    if (!$('cab-case').hidden) { $('cab-case').hidden = true; $('cab-list').hidden = false; current = null; }
    document.querySelector('.tab[data-tab="cabinet"]').click();
  }

  return { init, load, openByJournal, badge, openPreset };
})();
