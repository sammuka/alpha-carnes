import { modules } from '../data/module-definitions.js';
import { createDocLink } from '../core/doc-loader.js';
import { docMapping } from '../data/doc-mapping.js';

/**
 * Renders the Modules section into #modulos-content.
 * Shows 9 module cards in a responsive grid with tilt effect,
 * each expandable to show related documentation.
 */
export function initModules() {
  const container = document.getElementById('modulos-content');
  if (!container) return;

  // Build the grid
  const grid = document.createElement('div');
  grid.className = 'grid grid--auto stagger';

  modules.forEach((mod, index) => {
    const card = buildModuleCard(mod, index);
    grid.appendChild(card);
  });

  container.appendChild(grid);

  // Init Vanilla Tilt on cards after they are in the DOM
  requestAnimationFrame(() => {
    initTilt(container);
  });
}

/**
 * Build a single module card element.
 */
function buildModuleCard(mod, index) {
  const card = document.createElement('div');
  card.className = 'card module-card reveal';
  card.setAttribute('data-tilt', '');
  card.setAttribute('data-tilt-max', '8');
  card.setAttribute('data-tilt-speed', '400');
  card.setAttribute('data-tilt-glare', 'true');
  card.setAttribute('data-tilt-max-glare', '0.15');
  card.style.setProperty('--card-accent', `var(--accent-${mod.color})`);
  card.style.setProperty('--card-accent-dim', `var(--accent-${mod.color}-dim)`);

  // Icon
  const iconEl = document.createElement('div');
  iconEl.className = `card__icon card__icon--${mod.color}`;
  iconEl.textContent = mod.icon;

  // Title
  const titleEl = document.createElement('h3');
  titleEl.className = 'card__title';
  titleEl.textContent = mod.title;

  // Summary
  const descEl = document.createElement('p');
  descEl.className = 'card__desc';
  descEl.textContent = mod.summary;

  // Feature list
  const featureList = document.createElement('ul');
  featureList.className = 'module-card__features';
  mod.features.forEach((feat) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="module-card__check" style="color:var(--accent-${mod.color});">\u2713</span> ${feat}`;
    featureList.appendChild(li);
  });

  // Docs button
  const footer = document.createElement('div');
  footer.className = 'card__footer';

  const docsBtn = document.createElement('button');
  docsBtn.className = 'btn btn--ghost btn--sm';
  docsBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Ver documentacao`;

  // Doc count badge
  const docBadge = document.createElement('span');
  docBadge.className = `badge badge--${mod.color}`;
  docBadge.textContent = `${mod.docs.length} doc${mod.docs.length > 1 ? 's' : ''}`;

  footer.appendChild(docsBtn);
  footer.appendChild(docBadge);

  // Accordion container (hidden until button click)
  const accordionWrapper = document.createElement('div');
  accordionWrapper.className = 'module-card__docs';
  accordionWrapper.style.display = 'none';

  // Build doc accordions
  mod.docs.forEach((docKey) => {
    const docMeta = docMapping.find((d) => d.key === docKey);
    if (docMeta) {
      const link = createDocLink(docKey, `${docKey} — ${docMeta.shortTitle}`);
      accordionWrapper.appendChild(link);
    }
  });

  // Toggle docs visibility
  let docsVisible = false;
  docsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    docsVisible = !docsVisible;
    accordionWrapper.style.display = docsVisible ? 'block' : 'none';
    docsBtn.innerHTML = docsVisible
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg> Ocultar documentacao`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Ver documentacao`;
  });

  // Assemble card
  card.appendChild(iconEl);
  card.appendChild(titleEl);
  card.appendChild(descEl);
  card.appendChild(featureList);
  card.appendChild(footer);
  card.appendChild(accordionWrapper);

  return card;
}

/**
 * Initialize Vanilla Tilt on cards.
 */
function initTilt(container) {
  if (!window.VanillaTilt) return;
  const cards = container.querySelectorAll('[data-tilt]');
  cards.forEach((card) => {
    window.VanillaTilt.init(card, {
      max: 8,
      speed: 400,
      glare: true,
      'max-glare': 0.15,
    });
  });
}
