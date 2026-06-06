import { createDocAccordion } from '../core/doc-loader.js';

/**
 * Role definitions for the 11 access profiles.
 */
const roles = [
  { name: 'Admin do Sistema', perms: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { name: 'Comprador', perms: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Gestor Comercial', perms: [1, 1, 0, 0, 0, 0, 0, 0, 1, 0] },
  { name: 'Operador Comercial', perms: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Operador de Recebimento/Pesagem', perms: [0, 0, 1, 1, 0, 0, 0, 0, 0, 0] },
  { name: 'Operador de Corte', perms: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0] },
  { name: 'Operador de Expedicao', perms: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0] },
  { name: 'Conferente', perms: [0, 0, 1, 1, 0, 1, 0, 0, 0, 1] },
  { name: 'Faturamento/Fiscal', perms: [0, 0, 0, 0, 0, 0, 1, 0, 0, 1] },
  { name: 'Logistica/Liberacao', perms: [0, 0, 0, 0, 0, 1, 0, 1, 0, 0] },
  { name: 'Diretoria/Gestao Executiva', perms: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1] },
];

const capabilities = [
  'Compra',
  'Vendas',
  'Recebimento',
  'Pesagem',
  'Corte',
  'Expedicao',
  'Faturamento',
  'Liberacao',
  'Dashboards',
  'Auditoria',
];

/**
 * Renders the Security section into #seguranca-content.
 * Shows profile explanation, permission matrix, and doc 013 accordion.
 */
export function initSecurity() {
  const container = document.getElementById('seguranca-content');
  if (!container) return;

  // Intro text
  const intro = document.createElement('div');
  intro.className = 'reveal';
  intro.innerHTML = `
    <div class="card" style="margin-bottom:var(--gap-xl);">
      <div class="card__icon card__icon--red">
        \u{1F6E1}\u{FE0F}
      </div>
      <h3 class="card__title">11 Perfis de Acesso Operacionais</h3>
      <p class="card__desc">
        O sistema implementa segregacao de funcoes completa com 11 perfis de acesso distintos.
        Cada usuario possui exatamente as permissoes necessarias para suas atividades — nem mais, nem menos.
        Todas as acoes criticas sao registradas em trilha de auditoria inalteravel, garantindo
        conformidade, rastreabilidade e controle total sobre a operacao.
      </p>
      <div class="card__footer" style="flex-wrap:wrap;gap:0.5rem;">
        ${roles
          .map(
            (r) =>
              `<span class="badge badge--${r.perms.filter(Boolean).length > 5 ? 'red' : r.perms.filter(Boolean).length > 2 ? 'amber' : 'blue'}">${r.name}</span>`
          )
          .join('')}
      </div>
    </div>
  `;
  container.appendChild(intro);

  // Permission matrix
  const matrixWrapper = document.createElement('div');
  matrixWrapper.className = 'reveal';
  matrixWrapper.style.marginBottom = 'var(--gap-xl)';

  const matrixTitle = document.createElement('h3');
  matrixTitle.className = 'section__title';
  matrixTitle.style.fontSize = 'var(--font-size-2xl)';
  matrixTitle.style.marginBottom = 'var(--gap-lg)';
  matrixTitle.textContent = 'Matriz de Permissoes';

  const tableContainer = document.createElement('div');
  tableContainer.className = 'security-table-wrapper';

  const table = document.createElement('table');
  table.className = 'security-table';

  // Header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th class="security-table__role-header">Perfil</th>
      ${capabilities.map((cap) => `<th class="security-table__cap-header"><span>${cap}</span></th>`).join('')}
    </tr>
  `;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  roles.forEach((role) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="security-table__role-cell">${role.name}</td>
      ${role.perms
        .map(
          (p) =>
            `<td class="security-table__perm-cell ${p ? 'security-table__perm-cell--granted' : 'security-table__perm-cell--denied'}">
              ${p ? '<span class="security-check">\u2713</span>' : '<span class="security-cross">\u2717</span>'}
            </td>`
        )
        .join('')}
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  tableContainer.appendChild(table);
  matrixWrapper.appendChild(matrixTitle);
  matrixWrapper.appendChild(tableContainer);
  container.appendChild(matrixWrapper);

  // Doc 013 accordion
  const docSection = document.createElement('div');
  docSection.className = 'reveal';
  const docTitle = document.createElement('h3');
  docTitle.style.fontSize = 'var(--font-size-xl)';
  docTitle.style.marginBottom = 'var(--gap-md)';
  docTitle.style.color = 'var(--text-primary)';
  docTitle.textContent = 'Especificacao Completa';
  docSection.appendChild(docTitle);
  docSection.appendChild(createDocAccordion('013', '013 — Perfis de Acesso e Segregacao de Funcoes'));
  container.appendChild(docSection);
}
