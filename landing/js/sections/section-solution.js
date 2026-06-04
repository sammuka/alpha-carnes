export function initSolution() {
  const container = document.getElementById('solucao-content');
  if (!container) return;

  container.innerHTML = buildOverview() + buildSystemMap();
}

/* ------------------------------------------------------------------ */
/*  Modules data                                                      */
/* ------------------------------------------------------------------ */

const modules = [
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>`,
    name: 'Compra Programada',
    desc: 'Planejamento e confirmacao de compras diarias',
    color: 'cyan',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    name: 'Disponibilidade Virtual',
    desc: 'Controle de saldo comercial por item',
    color: 'emerald',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    name: 'Pedidos de Venda',
    desc: 'Registro e reserva de pedidos por peca',
    color: 'blue',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    name: 'Recebimento',
    desc: 'Apuracao fisica e tratamento de divergencias',
    color: 'amber',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    name: 'Pesagem & Associacao',
    desc: 'Captura de peso e sugestao inteligente de destino',
    color: 'cyan',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 012 2v7"/><path d="M11 18H8a2 2 0 01-2-2V9"/></svg>`,
    name: 'Corte & Transformacao',
    desc: 'Desdobramento de pecas com rastreabilidade',
    color: 'purple',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    name: 'Expedicao',
    desc: 'Montagem de carga e controle de caminhao',
    color: 'emerald',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    name: 'Faturamento',
    desc: 'Emissao fiscal, seguro e liberacao',
    color: 'blue',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>`,
    name: 'Dashboards & Alertas',
    desc: 'Visibilidade total em tempo real',
    color: 'red',
  },
];

/* ------------------------------------------------------------------ */
/*  Build HTML                                                        */
/* ------------------------------------------------------------------ */

function buildOverview() {
  return `
    <div class="reveal" style="max-width: 800px; margin: 0 auto var(--gap-2xl); text-align: center;">
      <p style="font-size: var(--font-size-lg); color: var(--text-secondary); line-height: 1.8;">
        O sistema AlphaCarnes e composto por <strong style="color: var(--accent-cyan);">9 modulos funcionais</strong>
        que cobrem toda a cadeia operacional — da programacao de compra ate o faturamento e liberacao do caminhao.
        Cada modulo se conecta aos demais por eventos de dominio, garantindo rastreabilidade ponta a ponta.
      </p>
    </div>
  `;
}

function buildSystemMap() {
  const cards = modules
    .map(
      (m) => `
    <div class="card reveal solution-module-card">
      <div class="solution-module-card__accent" style="background: var(--accent-${m.color});"></div>
      <div class="card__icon card__icon--${m.color}">
        ${m.icon}
      </div>
      <h3 class="card__title" style="font-size: var(--font-size-base);">${m.name}</h3>
      <p class="card__desc" style="font-size: var(--font-size-xs);">${m.desc}</p>
    </div>`
    )
    .join('');

  return `
    <div class="solution-map reveal">
      <div class="grid grid--3 stagger solution-map__grid">
        ${cards}
      </div>
    </div>
    <style>
      .solution-map__grid {
        gap: var(--gap-md);
      }
      .solution-module-card {
        text-align: center;
        padding: 1.5rem 1rem;
        position: relative;
      }
      .solution-module-card .card__icon {
        margin-left: auto;
        margin-right: auto;
      }
      .solution-module-card .card__title {
        margin-top: var(--gap-xs);
      }
      .solution-module-card__accent {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 40px;
        height: 2px;
        border-radius: 1px;
        opacity: 0.6;
      }
    </style>
  `;
}
