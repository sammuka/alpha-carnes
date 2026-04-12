import { docMapping, getGroups } from '../data/doc-mapping.js';
import { createDocAccordion } from '../core/doc-loader.js';

/**
 * Group display order and icons.
 */
const groupMeta = {
  operacao: { icon: '\u{1F504}', color: 'cyan' },
  funcional: { icon: '\u{2699}\u{FE0F}', color: 'blue' },
  inteligencia: { icon: '\u{1F4CA}', color: 'emerald' },
  tecnico: { icon: '\u{1F9F1}', color: 'purple' },
  seguranca: { icon: '\u{1F6E1}\u{FE0F}', color: 'red' },
  implantacao: { icon: '\u{1F680}', color: 'amber' },
};

const groupOrder = ['operacao', 'funcional', 'inteligencia', 'tecnico', 'seguranca', 'implantacao'];

/**
 * Renders the Documentation section into #documentacao-content.
 * Shows all 18 docs organized by group with accordions.
 */
export function initDocs() {
  const container = document.getElementById('documentacao-content');
  if (!container) return;

  const groups = getGroups();

  // Sort groups by predefined order
  const sortedGroups = groups.sort(
    (a, b) => groupOrder.indexOf(a.key) - groupOrder.indexOf(b.key)
  );

  sortedGroups.forEach((group, gi) => {
    const groupDocs = docMapping.filter((d) => d.group === group.key);
    if (groupDocs.length === 0) return;

    const meta = groupMeta[group.key] || { icon: '\u{1F4C4}', color: 'cyan' };

    // Group wrapper
    const section = document.createElement('div');
    section.className = 'docs-group reveal';
    section.style.marginBottom = 'var(--gap-xl)';

    // Group header
    const header = document.createElement('div');
    header.className = 'docs-group__header';
    header.innerHTML = `
      <div class="docs-group__icon" style="background:var(--accent-${meta.color}-dim);color:var(--accent-${meta.color});">
        ${meta.icon}
      </div>
      <div>
        <h3 class="docs-group__title" style="color:var(--accent-${meta.color});">${group.label}</h3>
        <span class="docs-group__count">${groupDocs.length} documento${groupDocs.length > 1 ? 's' : ''}</span>
      </div>
    `;
    section.appendChild(header);

    // Doc accordions
    groupDocs.forEach((doc) => {
      const accordion = createDocAccordion(doc.key, `${doc.key} — ${doc.title}`);
      section.appendChild(accordion);
    });

    container.appendChild(section);
  });
}
