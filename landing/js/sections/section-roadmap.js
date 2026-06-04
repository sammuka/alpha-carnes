import { phases } from '../data/roadmap-phases.js';
import { createDocAccordion } from '../core/doc-loader.js';

let initialized = false;

export function initRoadmap() {
  const target = document.getElementById('roadmap-content');
  if (!target) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !initialized) {
          initialized = true;
          observer.disconnect();
          renderRoadmap(target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '200px' }
  );

  observer.observe(target);
}

function renderRoadmap(container) {
  // Build the timeline
  const timeline = document.createElement('div');
  timeline.className = 'timeline reveal';

  phases.forEach((phase) => {
    const item = document.createElement('div');
    item.className = 'timeline__item reveal';

    item.innerHTML = `
      <div class="timeline__marker" style="background: ${phase.color}; box-shadow: 0 0 20px ${phase.color}40;">
        ${phase.number}
      </div>
      <div class="timeline__card" data-phase="${phase.number}">
        <div class="timeline__card-title" style="color: ${phase.color};">
          Fase ${phase.number}: ${phase.title}
        </div>
        <div style="font-size: var(--font-size-sm); color: var(--text-muted);">
          Clique para expandir
        </div>
        <div class="timeline__card-expand">
          <div class="timeline__card-expand-inner">
            <div class="timeline__detail-label">Escopo</div>
            <ul class="timeline__scope-list">
              ${phase.scope.map((s) => `
                <li>
                  <span class="timeline__scope-dot" style="background: ${phase.color};"></span>
                  ${s}
                </li>
              `).join('')}
            </ul>

            <div class="timeline__detail-label">Resultado Esperado</div>
            <div class="timeline__detail-value">${phase.result}</div>

            <div class="timeline__detail-label">Dependencias</div>
            <div class="timeline__detail-value">${phase.dependencies}</div>

            <div class="timeline__detail-label">Risco Principal</div>
            <div class="timeline__detail-value" style="color: var(--accent-amber);">${phase.risk}</div>
          </div>
        </div>
      </div>
    `;

    // Click to expand/collapse
    const card = item.querySelector('.timeline__card');
    card.addEventListener('click', () => {
      const wasExpanded = card.classList.contains('expanded');

      // Collapse all other cards
      container.querySelectorAll('.timeline__card.expanded').forEach((c) => {
        c.classList.remove('expanded');
      });

      // Toggle this card
      if (!wasExpanded) {
        card.classList.add('expanded');
      }
    });

    timeline.appendChild(item);
  });

  container.appendChild(timeline);

  // Add doc accordion
  const docSection = document.createElement('div');
  docSection.className = 'reveal';
  docSection.style.marginTop = '2rem';
  docSection.appendChild(createDocAccordion('015', 'Doc 015 — Roadmap de Implantacao e Faseamento'));
  container.appendChild(docSection);
}
