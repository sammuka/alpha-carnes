export function initChallenges() {
  const container = document.getElementById('desafios-content');
  if (!container) return;

  container.innerHTML = buildChallengeGrid();
}

/* ------------------------------------------------------------------ */
/*  Challenge cards data                                              */
/* ------------------------------------------------------------------ */

const challenges = [
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
    title: 'Controle Manual e Planilhas',
    desc: 'Risco de erro, retrabalho, falta de historico. Informacoes espalhadas em planilhas que ninguem consolida.',
    color: 'amber',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    title: 'Overbooking Silencioso',
    desc: 'Vendas acima da disponibilidade sem alerta. O problema so aparece na hora da expedicao, quando ja e tarde.',
    color: 'red',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    title: 'Sem Rastreabilidade',
    desc: 'Impossivel saber onde esta cada peca. Do recebimento a expedicao, nao ha trilha auditavel.',
    color: 'purple',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`,
    title: 'Divergencias Invisiveis',
    desc: 'Diferencas entre NF e recebido passam despercebidas. Prejuizos acumulados sem nenhum registro.',
    color: 'cyan',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    title: 'Zero Visao em Tempo Real',
    desc: 'Gestao reativa, sem dashboards. Decisoes baseadas em achismo e informacoes desatualizadas.',
    color: 'blue',
  },
  {
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    title: 'Faturamento Desconectado',
    desc: 'NF emitida sem validacao da carga real. Erros fiscais, seguros incorretos e retrabalho na liberacao.',
    color: 'emerald',
  },
];

/* ------------------------------------------------------------------ */
/*  Build grid HTML                                                   */
/* ------------------------------------------------------------------ */

function buildChallengeGrid() {
  const cards = challenges
    .map(
      (c) => `
    <div class="card reveal challenge-card">
      <div class="challenge-card__top-border" style="background: var(--accent-${c.color});"></div>
      <div class="card__icon card__icon--${c.color}">
        ${c.icon}
      </div>
      <h3 class="card__title">${c.title}</h3>
      <p class="card__desc">${c.desc}</p>
    </div>`
    )
    .join('');

  return `
    <div class="grid grid--3 stagger">
      ${cards}
    </div>
    <style>
      .challenge-card {
        position: relative;
        padding-top: 2.5rem;
      }
      .challenge-card__top-border {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      }
    </style>
  `;
}
