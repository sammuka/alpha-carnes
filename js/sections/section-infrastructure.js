import { createDocAccordion } from '../core/doc-loader.js';

let initialized = false;

const equipmentCategories = [
  {
    icon: '\u{1F5A5}',
    title: 'Servidor',
    qty: 1,
    description: 'Servidor principal on-premises. CPU 8+ cores, 32GB RAM, SSD NVMe, RAID. Hospeda backend, banco de dados e servicos.',
    color: 'var(--accent-cyan)',
  },
  {
    icon: '\u{1F4BB}',
    title: 'Estacoes Linux',
    qty: 6,
    description: 'Estacoes de trabalho com Linux. Pesagem (3), recebimento (1), expedicao (1), administrativo (1). Mini PCs ou thin clients.',
    color: 'var(--accent-blue)',
  },
  {
    icon: '\u{1F5A8}',
    title: 'Impressoras',
    qty: 4,
    description: 'Impressoras termicas para etiquetas ZPL. Postos de pesagem (3), expedicao (1). Zebra GC420d ou compativel.',
    color: 'var(--accent-emerald)',
  },
  {
    icon: '\u{1F4F1}',
    title: 'Tablets',
    qty: 3,
    description: 'Tablets Android para operacoes moveis. Conferencia de carga, recebimento rapido, consulta de pedidos na doca.',
    color: 'var(--accent-amber)',
  },
  {
    icon: '\u{1F4F7}',
    title: 'Leitores QR',
    qty: 5,
    description: 'Leitores de QR Code (USB ou Bluetooth). Pesagem, expedicao, conferencia de carga. Leitura rapida de etiquetas.',
    color: 'var(--accent-purple)',
  },
  {
    icon: '\u{1F4FA}',
    title: 'TV Dashboard',
    qty: 2,
    description: 'Smart TVs 43"+ para dashboards em tempo real. Area operacional (1) e sala do gestor (1). Exibem KPIs e alertas.',
    color: 'var(--accent-red)',
  },
  {
    icon: '\u{1F310}',
    title: 'Rede',
    qty: 1,
    description: 'Infraestrutura de rede: switch gerenciavel, access points Wi-Fi, VLAN segmentada (operacional, admin, IoT), link de internet redundante.',
    color: 'var(--accent-cyan)',
  },
];

export function initInfrastructure() {
  const target = document.getElementById('infraestrutura-content');
  if (!target) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !initialized) {
          initialized = true;
          observer.disconnect();
          renderInfrastructure(target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '200px' }
  );

  observer.observe(target);
}

async function renderInfrastructure(container) {
  // Equipment grid
  const grid = document.createElement('div');
  grid.className = 'equip-grid stagger';

  equipmentCategories.forEach((equip) => {
    const card = document.createElement('div');
    card.className = 'equip-card';
    card.innerHTML = `
      <div class="equip-card__icon">${equip.icon}</div>
      <div class="equip-card__title">${equip.title}</div>
      <div class="equip-card__qty">${equip.qty}</div>
      <div class="equip-card__desc">${equip.description}</div>
    `;
    grid.appendChild(card);
  });

  container.appendChild(grid);

  // Total equipment summary
  const total = equipmentCategories.reduce((sum, e) => sum + e.qty, 0);
  const summary = document.createElement('div');
  summary.className = 'reveal';
  summary.style.cssText = 'text-align:center; margin-bottom: var(--gap-2xl); padding: 1.5rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);';
  summary.innerHTML = `
    <div style="font-size: var(--font-size-sm); color: var(--text-muted); margin-bottom: 0.5rem;">Total de Equipamentos</div>
    <div style="font-size: var(--font-size-4xl); font-weight: 800; background: linear-gradient(135deg, var(--accent-cyan), var(--accent-emerald)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
      ${total} itens
    </div>
    <div style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-top: 0.5rem;">
      Investimento em infraestrutura fisica para operacao completa
    </div>
  `;
  container.appendChild(summary);

  // ── Topology Diagram ────────────────────────────────────────────
  const topoSection = document.createElement('div');
  topoSection.className = 'reveal';
  topoSection.style.marginTop = '2rem';
  topoSection.innerHTML = `
    <h3 style="font-size: var(--font-size-2xl); font-weight: 700; margin-bottom: 0.5rem; color: var(--text-primary);">Topologia de Rede</h3>
    <p style="color: var(--text-secondary); font-size: var(--font-size-sm); margin-bottom: var(--gap-md);">
      Visualizacao interativa da infraestrutura de rede. Clique em um equipamento para ver detalhes.
    </p>
    <div class="diagram-container" style="position:relative;">
      <div id="topology-diagram" class="d3-container">
        <div class="diagram-loading">
          <div class="diagram-loading__spinner"></div>
          <span>Carregando topologia...</span>
        </div>
      </div>
    </div>
    <div class="topology-info-panel" id="topology-info-panel">
      <div class="topology-info-panel__placeholder">
        Clique em um equipamento para ver especificacoes e funcao na rede.
      </div>
    </div>
  `;
  container.appendChild(topoSection);

  // Doc accordions
  const docsSection = document.createElement('div');
  docsSection.className = 'reveal';
  docsSection.style.marginTop = '2rem';

  const docEntries = [
    { key: '017', title: 'Doc 017 — Infraestrutura e Equipamentos' },
    { key: '018', title: 'Doc 018 — Arquitetura On-Premises e Topologia' },
  ];

  docEntries.forEach(({ key, title }) => {
    docsSection.appendChild(createDocAccordion(key, title));
  });

  container.appendChild(docsSection);

  // Lazy-load topology diagram
  try {
    const { createTopologyDiagram } = await import('../diagrams/topology-diagram.js');
    const topoEl = document.getElementById('topology-diagram');
    topoEl.innerHTML = '';
    createTopologyDiagram(topoEl, {
      onNodeClick: (nodeData) => updateTopologyPanel(nodeData),
    });
  } catch (err) {
    console.error('Failed to load topology diagram:', err);
    const topoEl = document.getElementById('topology-diagram');
    if (topoEl) {
      topoEl.innerHTML = '<div class="diagram-loading"><span style="color: var(--accent-red);">Erro ao carregar topologia.</span></div>';
    }
  }
}

function updateTopologyPanel(nodeData) {
  const panel = document.getElementById('topology-info-panel');
  if (!panel) return;

  if (!nodeData) {
    panel.classList.remove('active');
    panel.innerHTML = '<div class="topology-info-panel__placeholder">Clique em um equipamento para ver especificacoes e funcao na rede.</div>';
    return;
  }

  panel.classList.add('active');
  panel.innerHTML = `
    <div class="topology-info-panel__title">${nodeData.label}</div>
    ${nodeData.specs ? `<div class="topology-info-panel__specs">${nodeData.specs}</div>` : ''}
    ${nodeData.purpose ? `<div class="topology-info-panel__purpose">${nodeData.purpose}</div>` : ''}
  `;
}
