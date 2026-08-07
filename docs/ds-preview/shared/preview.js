// Interações mínimas de demonstração do protótipo DS (sem framework).
document.addEventListener('click', (e) => {
  // popovers (combobox/datepicker): [data-pop-trigger="#id"]
  const t = e.target.closest('[data-pop-trigger]');
  if (t) {
    const pop = document.querySelector(t.getAttribute('data-pop-trigger'));
    document.querySelectorAll('.popover.open').forEach(p => { if (p !== pop) p.classList.remove('open'); });
    pop && pop.classList.toggle('open');
    e.stopPropagation();
    return;
  }
  if (!e.target.closest('.popover')) {
    document.querySelectorAll('.popover.open').forEach(p => p.classList.remove('open'));
  }

  // modal
  const mo = e.target.closest('[data-modal-open]');
  if (mo) document.querySelector(mo.getAttribute('data-modal-open'))?.classList.add('open');
  const mc = e.target.closest('[data-modal-close]');
  if (mc) mc.closest('.modal-backdrop')?.classList.remove('open');
  if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('open');

  // tabs: [data-tab-group] botões .tab; painéis [data-tab-panel]
  const tab = e.target.closest('.tab[data-tab]');
  if (tab) {
    const group = tab.closest('[data-tab-group]');
    group.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    const scope = group.getAttribute('data-tab-group');
    document.querySelectorAll(`[data-tab-panel][data-scope="${scope}"]`).forEach(p => {
      p.style.display = p.getAttribute('data-tab-panel') === tab.getAttribute('data-tab') ? '' : 'none';
    });
  }

  // segmented
  const seg = e.target.closest('.seg button');
  if (seg) {
    seg.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    seg.classList.add('active');
  }

  // chips toggle
  const chip = e.target.closest('.chip[data-toggle]');
  if (chip) chip.classList.toggle('on');

  // seleção de linha
  const row = e.target.closest('tr[data-selectable]');
  if (row) {
    row.closest('tbody').querySelectorAll('tr.sel').forEach(r => r.classList.remove('sel'));
    row.classList.add('sel');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.popover.open, .modal-backdrop.open').forEach(p => p.classList.remove('open'));
  }
});
