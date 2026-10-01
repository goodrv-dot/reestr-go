// ============================================================
// Сегменти — збережені набори фільтрів для розсилок (ТЗ, розділ 8.1)
// Зберігаються умови, а не список людей: сегмент завжди актуальний.
// ============================================================
window.Segments = (() => {
  const $ = (id) => document.getElementById(id);
  let db = null;
  let me = null;
  let isAdmin = false;
  let list = [];
  let current = null;     // обраний сегмент
  let applying = false;   // щоб не позначати «змінено» під час застосування

  async function init(client, userId, admin) {
    db = client; me = userId; isAdmin = admin;
    $('segment-select').addEventListener('change', onSelect);
    $('segment-save').addEventListener('click', openSaveDialog);
    $('segment-update').addEventListener('click', updateCurrent);
    $('segment-delete').addEventListener('click', deleteCurrent);
    $('seg-form').addEventListener('submit', saveNew);
    $('seg-cancel').addEventListener('click', () => $('seg-dialog').close());
    document.addEventListener('filters-changed', markDirty);
    $('search').addEventListener('input', markDirty);
    await load();
  }

  async function load(selectId) {
    const { data, error } = await db.from('segments').select('*').order('name');
    if (error) { console.error(error); return; }
    list = data;
    const sel = $('segment-select');
    sel.innerHTML = '<option value="">— не обрано —</option>';
    list.forEach((s) => sel.add(new Option(s.name, s.id)));
    sel.value = selectId || (current ? current.id : '');
    current = list.find((s) => s.id === sel.value) || null;
    refreshButtons(false);
  }

  function state() {
    return { search: $('search').value.trim(), filters: Filters.getState() };
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function onSelect() {
    current = list.find((s) => s.id === $('segment-select').value) || null;
    if (!current) { refreshButtons(false); return; }
    applying = true;
    $('search').value = current.filters.search || '';
    Filters.setState(current.filters.filters || {});
    applying = false;
    refreshButtons(false);
    Persons.toast(`Сегмент «${current.name}»`);
  }

  function markDirty() {
    if (applying || !current) return;
    refreshButtons(!same(state(), current.filters));
  }

  function canEdit(seg) { return seg && (seg.created_by === me || isAdmin); }

  function refreshButtons(dirty) {
    $('segment-dirty').hidden = !dirty;
    $('segment-update').hidden = !(current && dirty && canEdit(current));
    $('segment-delete').hidden = !(current && canEdit(current));
  }

  // ---------- Збереження ----------
  function openSaveDialog() {
    if (Filters.activeCount() === 0 && !$('search').value.trim()) {
      Persons.toast('Спочатку налаштуйте фільтри — потім збережіть їх як сегмент.');
      return;
    }
    $('seg-form').reset();
    $('seg-error').hidden = true;
    $('seg-conditions').innerHTML = '';
    [...($('search').value.trim() ? [`Пошук: ${$('search').value.trim()}`] : []), ...Filters.describe()].forEach((t) => {
      const li = document.createElement('li'); li.textContent = t; $('seg-conditions').appendChild(li);
    });
    $('seg-dialog').showModal();
    $('seg-name').focus();
  }

  async function saveNew(e) {
    e.preventDefault();
    const name = $('seg-name').value.trim();
    if (name.length < 3) { showErr('Назва — щонайменше 3 символи.'); return; }
    const { data, error } = await db.from('segments').insert({ name, filters: state() }).select('id').single();
    if (error) {
      console.error(error);
      showErr(error.code === '23505' ? 'Сегмент з такою назвою вже є.' : 'Не вдалося зберегти сегмент.');
      return;
    }
    $('seg-dialog').close();
    await load(data.id);
    Persons.toast(`Сегмент «${name}» збережено`);
  }

  async function updateCurrent() {
    if (!current) return;
    if (!confirm(`Оновити умови сегмента «${current.name}» поточними фільтрами?`)) return;
    const { error } = await db.from('segments')
      .update({ filters: state(), updated_at: new Date().toISOString() }).eq('id', current.id);
    if (error) { console.error(error); Persons.toast('Не вдалося оновити сегмент'); return; }
    await load(current.id);
    Persons.toast('Сегмент оновлено');
  }

  async function deleteCurrent() {
    if (!current) return;
    if (!confirm(`Видалити сегмент «${current.name}»? Люди в реєстрі не зміняться — видаляються лише збережені умови.`)) return;
    const { error } = await db.from('segments').delete().eq('id', current.id);
    if (error) { console.error(error); Persons.toast('Не вдалося видалити сегмент'); return; }
    current = null;
    await load('');
    Persons.toast('Сегмент видалено');
  }

  function showErr(t) { $('seg-error').textContent = t; $('seg-error').hidden = false; }

  // Для мітки у вивантаженнях
  function label() {
    if (!current) return null;
    return `Сегмент: ${current.name}` + ($('segment-dirty').hidden ? '' : ' (умови змінено)');
  }

  function clear() {
    current = null;
    if ($('segment-select')) $('segment-select').value = '';
    refreshButtons(false);
  }

  return { init, label, clear };
})();
