// Перемикання вкладок «Особи» / «Мануал»
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b === btn));
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-current', b === btn ? 'page' : 'false'));
    document.getElementById('registry-view').hidden = tab !== 'registry';
    document.getElementById('manual-view').hidden = tab !== 'manual';
    window.scrollTo(0, 0);
  });
});
