import { dashboardTabs } from '../data/kpi-definitions.js';
import { createDocAccordion } from '../core/doc-loader.js';
import { animateCounters } from '../core/animations.js';

let initialized = false;

export function initIntelligence() {
  const target = document.getElementById('inteligencia-content');
  if (!target) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !initialized) {
          initialized = true;
          observer.disconnect();
          renderIntelligence(target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '200px' }
  );

  observer.observe(target);
}

function renderIntelligence(container) {
  // Tab navigation
  const tabNav = document.createElement('div');
  tabNav.className = 'dash-tabs reveal';

  dashboardTabs.forEach((tab, idx) => {
    const btn = document.createElement('button');
    btn.className = `dash-tab ${idx === 0 ? 'active' : ''}`;
    btn.textContent = tab.label;
    btn.dataset.tabId = tab.id;
    btn.addEventListener('click', () => switchTab(tab.id, container));
    tabNav.appendChild(btn);
  });

  container.appendChild(tabNav);

  // Preview area
  const preview = document.createElement('div');
  preview.className = 'dash-preview reveal';
  preview.id = 'dash-preview';
  container.appendChild(preview);

  // Render first tab
  renderTab(dashboardTabs[0], preview);

  // Doc accordion
  const docSection = document.createElement('div');
  docSection.className = 'reveal';
  docSection.style.marginTop = '2rem';
  docSection.appendChild(createDocAccordion('009', 'Doc 009 — Dashboards, KPIs, Alertas e Monitoramento em Tempo Real'));
  container.appendChild(docSection);
}

function switchTab(tabId, container) {
  // Update active tab
  container.querySelectorAll('.dash-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tabId === tabId);
  });

  // Find tab data
  const tab = dashboardTabs.find((t) => t.id === tabId);
  if (!tab) return;

  const preview = document.getElementById('dash-preview');
  if (!preview) return;

  renderTab(tab, preview);
}

function renderTab(tab, preview) {
  // KPI cards
  const kpiHtml = tab.kpis.map((kpi) => `
    <div class="dash-kpi-card">
      <div class="dash-kpi-value dash-kpi-value--${kpi.color}" data-count="${kpi.value}" data-prefix="${kpi.prefix || ''}" data-suffix="${kpi.suffix || ''}">
        0
      </div>
      <div class="dash-kpi-label">${kpi.label}</div>
    </div>
  `).join('');

  // Alert items
  const alertsHtml = tab.alerts.map((alert) => `
    <div class="dash-alert-item">
      <span class="dash-alert-dot dash-alert-dot--${alert.level}"></span>
      <span>${alert.text}</span>
    </div>
  `).join('');

  // Progress items
  const progressHtml = (tab.progress || []).map((item) => `
    <div class="dash-progress-item">
      <div class="dash-progress-item__header">
        <span class="dash-progress-item__label">${item.label}</span>
        <span class="dash-progress-item__value">${item.value}%</span>
      </div>
      <div class="progress">
        <div class="progress__fill" data-width="${item.value}"></div>
      </div>
    </div>
  `).join('');

  preview.innerHTML = `
    <div class="dash-kpi-grid">
      ${kpiHtml}
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-lg);">
      <div class="dash-alerts">
        <div class="dash-alerts__title">Alertas Ativos</div>
        ${alertsHtml}
      </div>
      <div class="dash-progress">
        <div class="dash-progress__title">Progresso</div>
        ${progressHtml}
      </div>
    </div>
  `;

  // Animate KPI counters
  animateCounters(preview);

  // Animate progress bars
  requestAnimationFrame(() => {
    preview.querySelectorAll('.progress__fill').forEach((bar) => {
      const width = bar.dataset.width;
      requestAnimationFrame(() => {
        bar.style.width = width + '%';
      });
    });
  });
}
