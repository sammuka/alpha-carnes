import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { stateMachines } from '../data/state-definitions.js';

// Register dagre layout
try {
  cytoscape.use(dagre);
} catch (_) {
  // Already registered
}

/**
 * Convert a state machine definition into Cytoscape elements.
 * @param {string} machineKey - Key in stateMachines
 * @returns {{ nodes: object[], edges: object[] }}
 */
function buildElements(machineKey) {
  const machine = stateMachines[machineKey];
  if (!machine) throw new Error(`Unknown state machine: ${machineKey}`);

  const nodes = machine.states.map((s) => ({
    data: {
      id: s.id,
      label: s.label,
      group: machineKey,
      type: s.type,
    },
  }));

  const edges = machine.transitions.map((t, i) => ({
    data: {
      id: `${machineKey}_e${i}_${t.from}->${t.to}`,
      source: t.from,
      target: t.to,
      label: t.label,
    },
  }));

  return { nodes, edges };
}

/**
 * Create an interactive Cytoscape state machine diagram.
 * @param {HTMLElement} container - The DOM element to render into
 * @param {string} machineKey - Key in stateMachines (e.g. 'compraProgramada')
 * @param {object} options - Optional callbacks
 * @param {function} options.onStateClick - Called with state data on click
 * @returns {import('cytoscape').Core} The Cytoscape instance
 */
export function createStateMachine(container, machineKey, options = {}) {
  const machine = stateMachines[machineKey];
  if (!machine) throw new Error(`Unknown state machine: ${machineKey}`);

  const { nodes, edges } = buildElements(machineKey);
  const elements = [...nodes, ...edges];
  const machineColor = machine.color;

  const cy = cytoscape({
    container,
    elements,
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: false,
    selectionType: 'single',

    style: [
      // Base node style
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '110px',
          'font-size': '11px',
          'font-weight': '600',
          'font-family': 'Inter, system-ui, sans-serif',
          'color': '#e2e8f0',
          'width': '120',
          'height': '50',
          'shape': 'round-rectangle',
          'background-color': machineColor,
          'background-opacity': 0.85,
          'border-width': 2,
          'border-color': machineColor,
          'border-opacity': 0.6,
          'text-outline-color': '#0a0f1e',
          'text-outline-width': '1px',
          'overlay-padding': '6px',
          'transition-property':
            'border-width, border-opacity, background-opacity, overlay-opacity',
          'transition-duration': '200ms',
        },
      },
      // Initial states: thicker border with brighter color
      {
        selector: 'node[type = "initial"]',
        style: {
          'border-width': 3,
          'border-color': '#e2e8f0',
          'border-opacity': 0.9,
        },
      },
      // Final states: double border effect
      {
        selector: 'node[type = "final"]',
        style: {
          'border-width': 3,
          'border-style': 'double',
          'border-color': '#e2e8f0',
          'border-opacity': 0.7,
          'background-opacity': 0.6,
        },
      },
      // Edge base style
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#475569',
          'target-arrow-color': '#475569',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 0.8,
          'line-style': 'dashed',
          'line-dash-pattern': [8, 4],
          'line-dash-offset': 0,
          'transition-property': 'line-color, target-arrow-color, width',
          'transition-duration': '200ms',
        },
      },
      // Edge labels
      {
        selector: 'edge[label]',
        style: {
          'label': 'data(label)',
          'font-size': '9px',
          'font-weight': '600',
          'color': '#94a3b8',
          'text-background-color': '#0f172a',
          'text-background-opacity': 0.9,
          'text-background-padding': '3px',
          'text-rotation': 'autorotate',
        },
      },
      // Highlighted node
      {
        selector: 'node.highlighted',
        style: {
          'border-width': 3,
          'border-opacity': 1,
          'background-opacity': 1,
          'overlay-color': machineColor,
          'overlay-opacity': 0.12,
        },
      },
      // Highlighted edge
      {
        selector: 'edge.highlighted',
        style: {
          'line-color': machineColor,
          'target-arrow-color': machineColor,
          'width': 3,
        },
      },
      // Dimmed nodes
      {
        selector: 'node.dimmed',
        style: {
          'background-opacity': 0.25,
          'border-opacity': 0.2,
          'color': '#64748b',
          'text-outline-opacity': 0.3,
        },
      },
      // Dimmed edges
      {
        selector: 'edge.dimmed',
        style: {
          'line-color': '#1e293b',
          'target-arrow-color': '#1e293b',
          'width': 1,
          'opacity': 0.4,
        },
      },
      // Hover glow
      {
        selector: 'node.hover-glow',
        style: {
          'border-width': 3,
          'border-opacity': 1,
          'overlay-color': machineColor,
          'overlay-opacity': 0.08,
        },
      },
    ],

    layout: {
      name: 'dagre',
      rankDir: 'LR',
      nodeSep: 40,
      rankSep: 70,
      edgeSep: 25,
      padding: 40,
      animate: false,
      spacingFactor: 1.15,
    },
  });

  // Edge dash animation via periodic update
  let dashOffset = 0;
  let animFrameId = null;
  const animateEdges = () => {
    dashOffset = (dashOffset + 1) % 24;
    cy.edges().forEach((edge) => {
      if (!edge.hasClass('highlighted') && !edge.hasClass('dimmed')) {
        edge.style('line-dash-offset', dashOffset);
      }
    });
    animFrameId = requestAnimationFrame(animateEdges);
  };
  animFrameId = requestAnimationFrame(animateEdges);

  // Clean up animation when instance is destroyed
  cy.on('destroy', () => {
    if (animFrameId) cancelAnimationFrame(animFrameId);
  });

  // Hover glow effect
  cy.on('mouseover', 'node', (evt) => {
    const node = evt.target;
    if (!node.hasClass('highlighted') && !node.hasClass('dimmed')) {
      node.addClass('hover-glow');
    }
  });

  cy.on('mouseout', 'node', (evt) => {
    evt.target.removeClass('hover-glow');
  });

  // Node click: highlight outgoing transitions and their target states
  cy.on('tap', 'node', (evt) => {
    const node = evt.target;
    clearHighlights(cy);

    const outgoingEdges = node.outgoers('edge');
    const targetNodes = outgoingEdges.targets();

    // Collect the IDs of the clicked node and its direct targets
    const activeNodeIds = new Set([node.id()]);
    targetNodes.forEach((t) => activeNodeIds.add(t.id()));

    const activeEdgeIds = new Set();
    outgoingEdges.forEach((e) => activeEdgeIds.add(e.id()));

    // Apply classes
    cy.elements().forEach((ele) => {
      if (ele.isNode()) {
        if (activeNodeIds.has(ele.id())) {
          ele.addClass('highlighted');
        } else {
          ele.addClass('dimmed');
        }
      } else if (ele.isEdge()) {
        if (activeEdgeIds.has(ele.id())) {
          ele.addClass('highlighted');
        } else {
          ele.addClass('dimmed');
        }
      }
    });

    if (options.onStateClick) {
      options.onStateClick(node.data());
    }
  });

  // Tap on background: clear highlights
  cy.on('tap', (evt) => {
    if (evt.target === cy) {
      clearHighlights(cy);
      if (options.onStateClick) {
        options.onStateClick(null);
      }
    }
  });

  // Build toolbar
  const toolbar = createToolbar(cy);
  container.parentElement.appendChild(toolbar);

  // Fit after layout with minimum zoom for readability
  cy.ready(() => {
    cy.fit(undefined, 30);
    if (cy.zoom() < 0.6) {
      cy.zoom({
        level: 0.6,
        renderedPosition: { x: cy.width() / 2, y: 100 },
      });
      cy.pan({
        x: cy.width() / 2 - cy.width() * 0.3,
        y: 20,
      });
    }
  });

  return cy;
}

/**
 * Create a tabbed state machine viewer with all 5 machines.
 * @param {HTMLElement} container - The DOM element to render into
 * @param {object} options - Optional callbacks
 * @param {function} options.onMachineChange - Called with (machineKey, machineData) on tab switch
 * @param {function} options.onStateClick - Forwarded to createStateMachine
 * @returns {{ destroy: function, setMachine: function }}
 */
export function createStateMachineTabs(container, options = {}) {
  const machineKeys = Object.keys(stateMachines);
  let activeMachineKey = machineKeys[0];
  let cyInstance = null;

  // Create tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'state-machine-tabs';
  tabBar.style.cssText = [
    'display: flex',
    'flex-direction: row',
    'gap: 4px',
    'padding: 6px 8px',
    'margin-bottom: 12px',
    'border-radius: 10px',
    'background: rgba(15, 23, 42, 0.6)',
    'backdrop-filter: blur(12px)',
    '-webkit-backdrop-filter: blur(12px)',
    'border: 1px solid rgba(148, 163, 184, 0.1)',
    'overflow-x: auto',
    'flex-wrap: wrap',
  ].join(';');

  // Create diagram container
  const diagramWrapper = document.createElement('div');
  diagramWrapper.style.cssText = 'position: relative; width: 100%; flex: 1; min-height: 0;';

  const diagramEl = document.createElement('div');
  diagramEl.style.cssText = 'width: 100%; height: 100%; min-height: 380px;';
  diagramWrapper.appendChild(diagramEl);

  container.appendChild(tabBar);
  container.appendChild(diagramWrapper);

  /** Build one tab button per machine */
  const tabButtons = {};
  machineKeys.forEach((key) => {
    const machine = stateMachines[key];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = machine.label;
    btn.className = 'state-machine-tab';
    btn.style.cssText = [
      'padding: 8px 16px',
      'border: none',
      'border-bottom: 2px solid transparent',
      'border-radius: 6px 6px 0 0',
      'background: rgba(30, 41, 59, 0.5)',
      'color: #94a3b8',
      'font-size: 12px',
      'font-weight: 600',
      'font-family: Inter, system-ui, sans-serif',
      'cursor: pointer',
      'white-space: nowrap',
      'transition: color 0.2s, border-color 0.2s, background 0.2s',
    ].join(';');

    btn.addEventListener('mouseenter', () => {
      if (key !== activeMachineKey) {
        btn.style.color = '#cbd5e1';
        btn.style.background = 'rgba(30, 41, 59, 0.7)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (key !== activeMachineKey) {
        btn.style.color = '#94a3b8';
        btn.style.background = 'rgba(30, 41, 59, 0.5)';
      }
    });

    btn.addEventListener('click', () => {
      if (key === activeMachineKey) return;
      setActiveTab(key);
    });

    tabBar.appendChild(btn);
    tabButtons[key] = btn;
  });

  /** Activate a tab and (re)create the diagram */
  function setActiveTab(key) {
    activeMachineKey = key;

    // Update tab button styling
    machineKeys.forEach((k) => {
      const btn = tabButtons[k];
      if (k === key) {
        btn.style.color = '#e2e8f0';
        btn.style.borderBottomColor = '#06b6d4';
        btn.style.background = 'rgba(6, 182, 212, 0.08)';
      } else {
        btn.style.color = '#94a3b8';
        btn.style.borderBottomColor = 'transparent';
        btn.style.background = 'rgba(30, 41, 59, 0.5)';
      }
    });

    // Destroy existing diagram and toolbar
    if (cyInstance) {
      cyInstance.destroy();
      cyInstance = null;
    }
    // Remove any existing toolbar from the wrapper
    const existingToolbar = diagramWrapper.querySelector('.diagram-toolbar');
    if (existingToolbar) existingToolbar.remove();

    // Clear the diagram element
    diagramEl.innerHTML = '';

    // Create fresh diagram
    cyInstance = createStateMachine(diagramEl, key, {
      onStateClick: options.onStateClick,
    });

    // Notify callback
    if (options.onMachineChange) {
      options.onMachineChange(key, stateMachines[key]);
    }
  }

  // Show first machine by default
  setActiveTab(activeMachineKey);

  return {
    /** Destroy the entire tabbed viewer */
    destroy() {
      if (cyInstance) {
        cyInstance.destroy();
        cyInstance = null;
      }
      container.removeChild(tabBar);
      container.removeChild(diagramWrapper);
    },
    /** Programmatically switch to a machine */
    setMachine(key) {
      if (stateMachines[key]) setActiveTab(key);
    },
  };
}

// ──────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────

function clearHighlights(cy) {
  cy.elements().removeClass('highlighted dimmed hover-glow');
}

function createToolbar(cy) {
  const toolbar = document.createElement('div');
  toolbar.className = 'diagram-toolbar';

  const buttons = [
    {
      label: '+',
      title: 'Zoom In',
      action: () =>
        cy.zoom({
          level: cy.zoom() * 1.3,
          renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
        }),
    },
    {
      label: '-',
      title: 'Zoom Out',
      action: () =>
        cy.zoom({
          level: cy.zoom() * 0.7,
          renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
        }),
    },
    {
      label: '[ ]',
      title: 'Ajustar Tela',
      action: () => {
        clearHighlights(cy);
        cy.fit(undefined, 40);
      },
    },
  ];

  buttons.forEach(({ label, title, action }) => {
    const btn = document.createElement('button');
    btn.className = 'diagram-toolbar__btn';
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', action);
    toolbar.appendChild(btn);
  });

  return toolbar;
}
