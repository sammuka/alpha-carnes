import { marked } from 'marked';
import { getColors, onThemeChange } from './theme.js';

// Import all 18 docs as raw strings
import doc001 from '../../docs/001-visao-geral-operacao-e-fluxo-macro.md?raw';
import doc002 from '../../docs/002-compra-programada-disponibilidade-virtual-e-vendas.md?raw';
import doc003 from '../../docs/003-regras-funcionais-por-tela-bloco-estrutural.md?raw';
import doc004 from '../../docs/004-campos-e-acoes-detalhados-tela-compra-programada-e-pedido-venda.md?raw';
import doc005 from '../../docs/005-campos-e-acoes-detalhados-tela-disponibilidade-virtual-e-recebimento-com-divergencias.md?raw';
import doc006 from '../../docs/006-campos-e-acoes-detalhados-tela-pesagem-associacao-sugestiva-e-expedicao-caminhao.md?raw';
import doc007 from '../../docs/007-corte-transformacao-reetiquetagem-e-rastreabilidade-da-peca.md?raw';
import doc008 from '../../docs/008-faturamento-emissao-nf-seguro-bloqueios-fiscais-e-liberacao-do-caminhao.md?raw';
import doc009 from '../../docs/009-dashboards-operacionais-kpis-alertas-e-monitoramento-em-tempo-real.md?raw';
import doc010 from '../../docs/010-modelo-de-dados-conceitual-e-entidades-principais-do-sistema.md?raw';
import doc011 from '../../docs/011-modelo-logico-inicial-banco-de-dados-tabelas-e-relacionamentos.md?raw';
import doc012 from '../../docs/012-arquitetura-aplicacional-modulos-servicos-e-integracoes.md?raw';
import doc013 from '../../docs/013-perfis-acesso-papeis-aprovacoes-e-segregacao-de-funcoes.md?raw';
import doc014 from '../../docs/014-eventos-de-dominio-workflows-assincronos-e-atualizacao-em-tempo-real.md?raw';
import doc015 from '../../docs/015-roadmap-de-implantacao-fases-riscos-premissas-e-dependencias.md?raw';
import doc016 from '../../docs/016-wireframes-fluxos-por-tela.md?raw';
import doc017 from '../../docs/017-infraestrutura-e-equipamentos-recomendados-para-operacao.md?raw';
import doc018 from '../../docs/018-arquitetura-onpremises-e-topologia-de-equipamentos-minimos.md?raw';

const rawDocs = {
  '001': doc001, '002': doc002, '003': doc003, '004': doc004,
  '005': doc005, '006': doc006, '007': doc007, '008': doc008,
  '009': doc009, '010': doc010, '011': doc011, '012': doc012,
  '013': doc013, '014': doc014, '015': doc015, '016': doc016,
  '017': doc017, '018': doc018,
};

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Cache parsed HTML
const htmlCache = {};

/**
 * Get raw markdown for a doc by key (e.g. '001')
 */
export function getRawDoc(key) {
  return rawDocs[key] || '';
}

/**
 * Get parsed HTML for a doc by key.
 * Mermaid blocks are wrapped in <div class="mermaid"> for later rendering.
 */
export function getDocHtml(key) {
  if (htmlCache[key]) return htmlCache[key];

  const raw = rawDocs[key];
  if (!raw) return '';

  // Replace mermaid code blocks with div containers
  const processed = raw.replace(
    /```mermaid\s*\n([\s\S]*?)```/g,
    (_, code) => `<div class="mermaid-block" data-mermaid="${encodeURIComponent(code.trim())}">[Diagrama Mermaid]</div>`
  );

  const html = marked.parse(processed);
  htmlCache[key] = html;
  return html;
}

/**
 * Render all mermaid blocks inside a container.
 * Re-initializes mermaid with current theme colors on every call.
 */
let mermaidModule = null;

async function ensureMermaid() {
  if (!mermaidModule) {
    mermaidModule = (await import('mermaid')).default;
  }
  const mc = getColors().mermaid;
  mermaidModule.initialize({
    startOnLoad: false,
    theme: mc.theme,
    themeVariables: {
      darkMode: mc.darkMode,
      background: mc.bg,
      primaryColor: mc.primary,
      primaryTextColor: mc.text,
      primaryBorderColor: mc.border,
      lineColor: mc.line,
      secondaryColor: mc.secondary,
      tertiaryColor: mc.bg,
    },
  });
  return mermaidModule;
}

export async function renderMermaidBlocks(container) {
  const blocks = container.querySelectorAll('.mermaid-block');
  if (blocks.length === 0) return;

  const mermaid = await ensureMermaid();

  for (const block of blocks) {
    const code = decodeURIComponent(block.dataset.mermaid);
    try {
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      const { svg } = await mermaid.render(id, code);
      block.innerHTML = svg;
      block.classList.add('mermaid-rendered');
    } catch (err) {
      block.innerHTML = `<pre class="mermaid-error"><code>${code}</code></pre>`;
    }
  }
}

// Re-render all visible mermaid diagrams on theme change
onThemeChange(async () => {
  if (!mermaidModule) return;
  await renderMermaidBlocks(document.body);
});

// ──────────────────────────────────────────────
// Doc Modal (full-screen viewer for narrow contexts)
// ──────────────────────────────────────────────

let modalOverlay = null;

function ensureModal() {
  if (modalOverlay) return;
  modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = `
    <div class="modal modal--doc">
      <button class="modal__close" aria-label="Fechar">&times;</button>
      <div class="modal__header"></div>
      <div class="modal__body accordion__inner"></div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  modalOverlay.querySelector('.modal__close').addEventListener('click', closeDocModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeDocModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) closeDocModal();
  });
}

export function openDocModal(key, title) {
  ensureModal();
  const header = modalOverlay.querySelector('.modal__header');
  const body = modalOverlay.querySelector('.modal__body');

  header.textContent = title;
  body.innerHTML = getDocHtml(key);

  document.body.style.overflow = 'hidden';
  modalOverlay.classList.add('active');

  renderMermaidBlocks(body);
}

function closeDocModal() {
  if (modalOverlay) {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * Create a doc link button that opens the doc in a modal.
 */
export function createDocLink(key, title) {
  const btn = document.createElement('button');
  btn.className = 'doc-link';
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
    <span>${title}</span>
    <svg class="doc-link__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  `;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openDocModal(key, title);
  });
  return btn;
}

/**
 * Create an accordion with a doc's content.
 */
export function createDocAccordion(key, title) {
  const wrapper = document.createElement('div');
  wrapper.className = 'accordion';
  wrapper.innerHTML = `
    <button class="accordion__trigger" aria-expanded="false">
      <span>${title}</span>
      <svg class="accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <div class="accordion__content">
      <div class="accordion__inner"></div>
    </div>
  `;

  const trigger = wrapper.querySelector('.accordion__trigger');
  const content = wrapper.querySelector('.accordion__content');
  const inner = wrapper.querySelector('.accordion__inner');
  let loaded = false;

  trigger.addEventListener('click', async () => {
    const isOpen = wrapper.classList.toggle('open');
    trigger.setAttribute('aria-expanded', isOpen);

    if (isOpen) {
      if (!loaded) {
        inner.innerHTML = getDocHtml(key);
        await renderMermaidBlocks(inner);
        loaded = true;
      }
      content.style.maxHeight = content.scrollHeight + 'px';
      // After transition, allow natural height for dynamic content
      setTimeout(() => { content.style.maxHeight = 'none'; }, 500);
    } else {
      content.style.maxHeight = content.scrollHeight + 'px';
      requestAnimationFrame(() => { content.style.maxHeight = '0px'; });
    }
  });

  return wrapper;
}
