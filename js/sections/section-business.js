import { createDocAccordion } from '../core/doc-loader.js';

export function initBusiness() {
  const container = document.getElementById('negocio-content');
  if (!container) return;

  container.innerHTML = buildFlowSteps() + buildDocsSection();

  // Append doc accordions (DOM nodes, not HTML strings)
  const docsWrapper = container.querySelector('.business-docs');
  if (docsWrapper) {
    docsWrapper.appendChild(
      createDocAccordion('001', 'Doc 001 — Visao Geral, Operacao e Fluxo Macro')
    );
    docsWrapper.appendChild(
      createDocAccordion('002', 'Doc 002 — Compra Programada, Disponibilidade Virtual e Vendas')
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Cross-docking flow steps                                          */
/* ------------------------------------------------------------------ */

const steps = [
  {
    num: '01',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>`,
    title: 'Compra Programada',
    desc: 'Planejamento diario de compras junto a frigorificos, com quantidades, cortes e previsao de chegada.',
    color: 'cyan',
  },
  {
    num: '02',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22V8"/><path d="M20 3l-8 5-8-5"/></svg>`,
    title: 'Desdobramento',
    desc: 'A compra e desdobrada em itens de disponibilidade virtual — cada peca ganha identidade comercial.',
    color: 'emerald',
  },
  {
    num: '03',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    title: 'Disponibilidade Virtual',
    desc: 'Saldo comercial visivel para os vendedores antes mesmo da mercadoria chegar fisicamente.',
    color: 'blue',
  },
  {
    num: '04',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    title: 'Venda por Peca',
    desc: 'Pedidos registrados por peca, com reserva de saldo e rastreabilidade desde a origem.',
    color: 'amber',
  },
  {
    num: '05',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    title: 'Operacao Fisica',
    desc: 'Recebimento, pesagem, conferencia de divergencias, corte e associacao de pecas ao destino.',
    color: 'purple',
  },
  {
    num: '06',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    title: 'Expedicao & Faturamento',
    desc: 'Montagem de carga, emissao de NF, seguro e liberacao do caminhao com validacao completa.',
    color: 'red',
  },
];

function buildFlowSteps() {
  const cards = steps
    .map(
      (s, i) => `
    <div class="card reveal" style="--card-delay: ${i * 100}ms; transition-delay: var(--card-delay);">
      <div class="business-step__header">
        <span class="business-step__num">${s.num}</span>
        <div class="card__icon card__icon--${s.color}">
          ${s.icon}
        </div>
      </div>
      <h3 class="card__title">${s.title}</h3>
      <p class="card__desc">${s.desc}</p>
      ${i < steps.length - 1 ? '<div class="business-step__arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>' : ''}
    </div>`
    )
    .join('');

  return `
    <div class="business-flow reveal">
      <div class="grid grid--3 business-flow__grid stagger">
        ${cards}
      </div>
    </div>
  `;
}

function buildDocsSection() {
  return `
    <div class="business-docs reveal" style="margin-top: var(--gap-2xl);">
      <h3 style="font-size: var(--font-size-xl); margin-bottom: var(--gap-md); color: var(--text-secondary);">
        Documentacao Relacionada
      </h3>
    </div>
  `;
}
