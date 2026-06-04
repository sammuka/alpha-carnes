import { createDocAccordion } from '../core/doc-loader.js';
import { erDomains } from '../data/er-entities.js';

let initialized = false;

const layers = [
  {
    title: 'Frontend Admin (Web)',
    description: 'Painel administrativo para gestores e supervisores. Dashboards, relatorios, configuracoes, regras de desdobramento, perfis de acesso. React + interface responsiva.',
    color: '#06b6d4',
  },
  {
    title: 'Frontend Operacional (Tablet/Desktop)',
    description: 'Telas operacionais otimizadas para balanca, pesagem, expedicao. Interface touch-friendly, modo offline-first, leitura de QR Code.',
    color: '#3b82f6',
  },
  {
    title: 'Backend Core (API)',
    description: 'Nucleo do sistema: regras de negocio, validacoes, transacoes, autenticacao, autorizacao. API REST com Node.js, arquitetura modular monolitica preparada para microservicos.',
    color: '#10b981',
  },
  {
    title: 'Servicos Especializados',
    description: 'Integracao com SEFAZ (NF-e), balancas seriais, impressoras termicas ZPL, geracao de QR Code, motor de sugestao inteligente, servico de eventos em tempo real.',
    color: '#a855f7',
  },
  {
    title: 'Infraestrutura & Dados',
    description: 'PostgreSQL com replicacao, Redis para cache e filas, servidor on-premises, rede segmentada, backup automatizado, monitoramento com Prometheus + Grafana.',
    color: '#ef4444',
  },
];

export function initArchitecture() {
  const target = document.getElementById('arquitetura-content');
  if (!target) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !initialized) {
          initialized = true;
          observer.disconnect();
          renderArchitecture(target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '200px' }
  );

  observer.observe(target);
}

async function renderArchitecture(container) {
  // Stack diagram
  const stack = document.createElement('div');
  stack.className = 'arch-stack';

  layers.forEach((layer, idx) => {
    const layerEl = document.createElement('div');
    layerEl.className = 'arch-layer reveal';
    layerEl.style.transitionDelay = `${idx * 100}ms`;

    layerEl.innerHTML = `
      <div class="arch-layer__number" style="background: ${layer.color};">
        ${idx + 1}
      </div>
      <div class="arch-layer__content">
        <div class="arch-layer__title">${layer.title}</div>
        <div class="arch-layer__desc">${layer.description}</div>
      </div>
    `;

    layerEl.addEventListener('mouseenter', () => {
      layerEl.style.borderColor = layer.color + '40';
      layerEl.style.boxShadow = `0 0 20px ${layer.color}15`;
    });
    layerEl.addEventListener('mouseleave', () => {
      layerEl.style.borderColor = '';
      layerEl.style.boxShadow = '';
    });

    stack.appendChild(layerEl);
  });

  container.appendChild(stack);

  const hint = document.createElement('div');
  hint.className = 'reveal';
  hint.style.textAlign = 'center';
  hint.style.marginBottom = 'var(--gap-2xl)';
  hint.style.color = 'var(--text-muted)';
  hint.style.fontSize = 'var(--font-size-sm)';
  hint.textContent = 'Cada camada se comunica com a adjacente via contratos bem definidos (APIs, eventos, filas).';
  container.appendChild(hint);

  // ── ER Diagram ──────────────────────────────────────────────────
  const erSection = document.createElement('div');
  erSection.className = 'reveal';
  erSection.style.marginTop = '2rem';
  erSection.innerHTML = `
    <h3 style="font-size: var(--font-size-2xl); font-weight: 700; margin-bottom: 0.5rem; color: var(--text-primary);">Modelo de Dados</h3>
    <p style="color: var(--text-secondary); font-size: var(--font-size-sm); margin-bottom: var(--gap-md);">
      ${Object.keys(erDomains).length} dominios, 27+ entidades. Clique em uma entidade para explorar atributos e relacionamentos.
    </p>
    <div class="diagram-container" style="position:relative;">
      <div id="er-diagram" class="d3-container">
        <div class="diagram-loading">
          <div class="diagram-loading__spinner"></div>
          <span>Carregando diagrama ER...</span>
        </div>
      </div>
    </div>
    <div class="er-info-panel" id="er-info-panel">
      <div class="topology-info-panel__placeholder">
        Clique em uma entidade para ver atributos, estados e relacionamentos.
      </div>
    </div>
  `;
  container.appendChild(erSection);

  // ── State Machines ──────────────────────────────────────────────
  const smSection = document.createElement('div');
  smSection.className = 'reveal';
  smSection.style.marginTop = '2.5rem';
  smSection.innerHTML = `
    <h3 style="font-size: var(--font-size-2xl); font-weight: 700; margin-bottom: 0.5rem; color: var(--text-primary);">Maquinas de Estado</h3>
    <p style="color: var(--text-secondary); font-size: var(--font-size-sm); margin-bottom: var(--gap-md);">
      5 entidades com ciclo de vida controlado. Navegue entre elas para ver estados e transicoes.
    </p>
    <div id="state-machine-host" style="position:relative;"></div>
  `;
  container.appendChild(smSection);

  // ── Doc Accordions ──────────────────────────────────────────────
  const docsSection = document.createElement('div');
  docsSection.className = 'reveal';
  docsSection.style.marginTop = '2rem';

  const docEntries = [
    { key: '010', title: 'Doc 010 — Modelo de Dados Conceitual e Entidades Principais' },
    { key: '011', title: 'Doc 011 — Modelo Logico do Banco de Dados' },
    { key: '012', title: 'Doc 012 — Arquitetura Aplicacional, Modulos e Servicos' },
    { key: '014', title: 'Doc 014 — Eventos de Dominio e Tempo Real' },
  ];

  docEntries.forEach(({ key, title }) => {
    docsSection.appendChild(createDocAccordion(key, title));
  });

  container.appendChild(docsSection);

  // ── Lazy-load interactive diagrams ──────────────────────────────
  try {
    const { createErDiagram } = await import('../diagrams/er-diagram.js');
    const erEl = document.getElementById('er-diagram');
    erEl.innerHTML = '';
    createErDiagram(erEl, {
      onEntityClick: (entityData) => updateErInfoPanel(entityData),
    });
  } catch (err) {
    console.error('Failed to load ER diagram:', err);
    const erEl = document.getElementById('er-diagram');
    if (erEl) {
      erEl.innerHTML = '<div class="diagram-loading"><span style="color: var(--accent-red);">Erro ao carregar diagrama ER.</span></div>';
    }
  }

  try {
    const { createStateMachineTabs } = await import('../diagrams/state-machine.js');
    const smHost = document.getElementById('state-machine-host');
    createStateMachineTabs(smHost);
  } catch (err) {
    console.error('Failed to load state machines:', err);
    const smHost = document.getElementById('state-machine-host');
    if (smHost) {
      smHost.innerHTML = '<div class="diagram-loading"><span style="color: var(--accent-red);">Erro ao carregar maquinas de estado.</span></div>';
    }
  }
}

function updateErInfoPanel(entityData) {
  const panel = document.getElementById('er-info-panel');
  if (!panel) return;

  if (!entityData) {
    panel.classList.remove('active');
    panel.innerHTML = '<div class="topology-info-panel__placeholder">Clique em uma entidade para ver atributos, estados e relacionamentos.</div>';
    return;
  }

  const domain = erDomains[entityData.domain];
  const domainColor = domain ? domain.color : 'var(--text-muted)';
  const domainLabel = domain ? domain.label : entityData.domain;

  const attrsHtml = (entityData.attributes || [])
    .map((a) => `<span class="er-info-panel__attr">${a}</span>`)
    .join('');

  const statesHtml = (entityData.states || [])
    .map((s) => `<span class="er-info-panel__state" style="background: ${domainColor}20; color: ${domainColor};">${s}</span>`)
    .join('');

  panel.classList.add('active');
  panel.innerHTML = `
    <div class="er-info-panel__domain" style="color: ${domainColor}">${domainLabel}</div>
    <div class="er-info-panel__title">${entityData.name}</div>
    ${attrsHtml ? `<div style="margin-top:0.5rem;font-size:var(--font-size-xs);color:var(--text-muted);font-weight:600;">ATRIBUTOS</div><div class="er-info-panel__attrs">${attrsHtml}</div>` : ''}
    ${statesHtml ? `<div style="margin-top:0.75rem;font-size:var(--font-size-xs);color:var(--text-muted);font-weight:600;">ESTADOS</div><div class="er-info-panel__states">${statesHtml}</div>` : ''}
  `;
}
