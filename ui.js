// ============================================================
// Оформлення: кольорові розділи з іконками, підсвітка значень, кнопка «Нагору»
// ============================================================
window.Ui = (() => {
  const P = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    person:  P('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
    shield:  P('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
    health:  P('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
    anchor:  P('<circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 12H3a9 9 0 0 0 18 0h-2M8 10h8"/>'),
    family:  P('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17.5 14c2.5 0 4.5 1.5 4.5 4.5"/>'),
    child:   P('<circle cx="12" cy="6" r="3"/><path d="M8 21v-6l-2-3 3-2h6l3 2-2 3v6"/>'),
    phone:   P('<path d="M5 3h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>'),
    pin:     P('<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
    flag:    P('<path d="M5 21V4h11l-2 4 2 4H5"/>'),
    check:   P('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),
    tag:     P('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>')
  };

  // Назва розділу → колір і іконка
  const SECTIONS = [
    [/^Основні дані/, 'a-base', 'person'],
    [/^Військовий статус/, 'a-mil', 'shield'],
    [/^Інвалідність$/, 'a-health', 'health'],
    [/^Морська піхота/, 'a-mp', 'anchor'],
    [/^Пов’язані військові/, 'a-memory', 'family'],
    [/^Діти/, 'a-kids', 'child'],
    [/^Контакти/, 'a-contact', 'phone'],
    [/^Проживання/, 'a-place', 'pin'],
    [/^Організація/, 'a-org', 'flag'],
    [/^Стан картки/, 'a-base', 'check'],
    [/^Категорії/, 'a-mil', 'tag'],
    [/^Інвалідність і Морська/, 'a-mp', 'anchor'],
    [/^Вік і діти/, 'a-kids', 'child'],
    [/^Проживання і розсилки/, 'a-place', 'pin']
  ];

  function decorate(el, text) {
    const hit = SECTIONS.find(([re]) => re.test(text));
    if (!hit) return null;
    const [, cls, icon] = hit;
    return { cls, icon: ICONS[icon] };
  }

  // Розділи картки
  function decorateForm() {
    document.querySelectorAll('#person-form fieldset').forEach((fs) => {
      const legend = fs.querySelector('legend');
      if (!legend || legend.dataset.decorated) return;
      const d = decorate(fs, legend.textContent.trim());
      if (!d) return;
      fs.classList.add('fs-card', d.cls);
      legend.innerHTML = `<span class="sec-badge">${d.icon}<span>${legend.textContent}</span></span>`;
      legend.dataset.decorated = '1';
    });
  }

  // Групи у фільтрах (панель будується після входу)
  function decorateFilters() {
    document.querySelectorAll('#filters-panel .filter-group').forEach((p) => {
      if (p.dataset.decorated) return;
      const text = p.textContent.trim();
      // точніший збіг для «Інвалідність і Морська піхота» та «Проживання і розсилки»
      const hit = [...SECTIONS].reverse().find(([re]) => re.test(text));
      if (!hit) return;
      p.classList.add(hit[1]);
      p.innerHTML = `<span class="sec-badge">${ICONS[hit[2]]}<span>${text}</span></span>`;
      p.dataset.decorated = '1';
      const grid = p.nextElementSibling;
      if (grid) grid.classList.add('filter-grid-acc', hit[1]);
    });
  }

  // Підсвітка вибраних значень у полях
  const PAINT_KEYS = ['military_status', 'sex', 'has_disability', 'mp_relation', 'wounded', 'is_idp',
                      'related_status', 'related_mp', 'has_children', 'preferred_messenger'];
  function paintSelect(sel) {
    sel.dataset.v = sel.value;
  }
  function paint(root) {
    decorateForm();
    (root || document).querySelectorAll('select').forEach((sel) => {
      const key = sel.name || sel.dataset.k;
      if (PAINT_KEYS.includes(key)) { sel.classList.add('paint'); paintSelect(sel); }
    });
  }
  document.addEventListener('change', (e) => {
    if (e.target.matches && e.target.matches('select.paint')) paintSelect(e.target);
  });

  // Кнопка «Нагору»
  function initToTop() {
    const btn = document.getElementById('to-top');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { btn.hidden = window.scrollY < 500; ticking = false; });
    }, { passive: true });
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      const h = document.querySelector('.app-main:not([hidden]) h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    });
  }

  document.addEventListener('DOMContentLoaded', () => { decorateForm(); initToTop(); });
  // панель фільтрів створюється пізніше — стежимо за нею
  document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('filters-panel');
    if (panel) {
      decorateFilters();
      new MutationObserver(decorateFilters).observe(panel, { childList: true });
    }
  });

  return { paint };
})();
