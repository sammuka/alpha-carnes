import { createDocAccordion } from '../core/doc-loader.js';
import { flowGroups } from '../data/flow-nodes.js';

let initialized = false;

export function initFlow() {
  const target = document.getElementById('fluxo-content');
  if (!target) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !initialized) {
          initialized = true;
          observer.disconnect();
          renderFlow(target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '200px' }
  );

  observer.observe(target);
}

async function renderFlow(container) {
  // Build the diagram wrapper
  container.innerHTML = `
    <div class="diagram-container reveal" style="position:relative;">
      <div id="macro-flow-diagram" class="cytoscape-container">
        <div class="diagram-loading">
          <div class="diagram-loading__spinner"></div>
          <span>Carregando diagrama...</span>
        </div>
      </div>
    </div>
    <div class="flow-info-panel reveal" id="flow-info-panel">
      <div class="flow-info-panel__placeholder">
        Clique em uma etapa do fluxo para ver detalhes. Use scroll para zoom e arraste para navegar.
      </div>
    </div>
  `;

  // Add doc accordion
  const docSection = document.createElement('div');
  docSection.className = 'reveal';
  docSection.style.marginTop = '2rem';
  docSection.appendChild(createDocAccordion('001', 'Doc 001 — Visao Geral, Operacao e Fluxo Macro'));
  container.appendChild(docSection);

  // Lazy-load and create the diagram
  try {
    const { createMacroFlow } = await import('../diagrams/macro-flow.js');

    const diagramEl = document.getElementById('macro-flow-diagram');
    // Clear the loading state
    diagramEl.innerHTML = '';

    createMacroFlow(diagramEl, {
      onNodeClick: (nodeData) => {
        updateInfoPanel(nodeData);
      },
    });
  } catch (err) {
    console.error('Failed to load macro flow diagram:', err);
    const diagramEl = document.getElementById('macro-flow-diagram');
    if (diagramEl) {
      diagramEl.innerHTML = `
        <div class="diagram-loading">
          <span style="color: var(--accent-red);">Erro ao carregar diagrama. Recarregue a pagina.</span>
        </div>
      `;
    }
  }
}

function updateInfoPanel(nodeData) {
  const panel = document.getElementById('flow-info-panel');
  if (!panel) return;

  if (!nodeData) {
    panel.classList.remove('active');
    panel.innerHTML = `
      <div class="flow-info-panel__placeholder">
        Clique em uma etapa do fluxo para ver detalhes. Use scroll para zoom e arraste para navegar.
      </div>
    `;
    return;
  }

  const group = flowGroups[nodeData.group];
  panel.classList.add('active');
  panel.innerHTML = `
    <div class="flow-info-panel__group" style="color: ${group ? group.color : 'var(--text-muted)'}">
      ${group ? group.label : nodeData.group}
    </div>
    <div class="flow-info-panel__title">${nodeData.label}</div>
    <div class="flow-info-panel__desc">${nodeData.description}</div>
    ${nodeData.type === 'decision' ? '<div style="margin-top:0.5rem;"><span class="badge badge--amber">Ponto de Decisao</span></div>' : ''}
  `;
}
