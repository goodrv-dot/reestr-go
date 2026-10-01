// ============================================================
// «Обрати з реєстру»: пошук картки військового для зв’язку
// ============================================================
window.Picker = (() => {
  const $ = (id) => document.getElementById(id);
  let onPick = null, timer = null, ready = false;

  function init() {
    if (ready) return;
    ready = true;
    $('pick-q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 300); });
    $('pick-close').addEventListener('click', () => $('pick-dialog').close());
  }

  function open(cb) {
    init();
    onPick = cb;
    $('pick-q').value = '';
    $('pick-list').innerHTML = '<li class="muted">Почніть вводити прізвище (від 2 літер)</li>';
    $('pick-dialog').showModal();
    $('pick-q').focus();
  }

  async function search() {
    const q = $('pick-q').value.trim().replace(/[,()%*\\]/g, ' ').trim();
    const ul = $('pick-list');
    if (q.length < 2) { ul.innerHTML = '<li class="muted">Почніть вводити прізвище (від 2 літер)</li>'; return; }
    const { db } = Persons.ctx();
    const words = q.split(/\s+/);
    let query = db.from('persons')
      .select('id, last_name, first_name, patronymic, birth_date, military_status, mp_relation, mp_unit_id, military_unit_code, death_date, burial_date, phone')
      .ilike('last_name', `${words[0]}%`).limit(30);
    if (words[1]) query = query.ilike('first_name', `${words[1]}%`);
    const { data, error } = await query;
    if (error) { console.error(error); ul.innerHTML = '<li class="muted">Помилка пошуку</li>'; return; }
    // спочатку військові
    data.sort((a, b) => (a.military_status === 'Не застосовується') - (b.military_status === 'Не застосовується'));
    ul.innerHTML = '';
    if (!data.length) { ul.innerHTML = '<li class="muted">Нікого не знайдено</li>'; return; }
    data.forEach((p) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick-item';
      const name = [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');
      const meta = [p.military_status !== 'Не застосовується' ? p.military_status : 'не військовий',
        p.birth_date ? 'н. ' + new Date(p.birth_date).toLocaleDateString('uk-UA') : null].filter(Boolean).join(' · ');
      b.innerHTML = '<b></b><span class="muted"></span>';
      b.querySelector('b').textContent = name;
      b.querySelector('span').textContent = meta;
      b.addEventListener('click', () => { $('pick-dialog').close(); onPick && onPick(p); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  return { open };
})();
