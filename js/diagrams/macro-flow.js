import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { flowNodes, flowEdges, flowGroups } from '../data/flow-nodes.js';

// Register dagre layout
cytoscape.use(dagre);

/**
 * Create the interactive macro operational flow diagram.
 * @param {HTMLElement} container - The DOM element to render into
 * @param {object} options - Optional callbacks
 * @param {function} options.onNodeClick - Called with node data on click
 */
export function createMacroFlow(container, options = {}) {
  // Build Cytoscape-compatible elements
  const elements = [
    ...flowNodes,
    ...flowEdges.map((e) => ({
      data: {
        ...e.data,
        id: `${e.data.source}->${e.data.target}`,
      },
    })),
  ];

  // Build style rules for each group
  const groupStyles = Object.entries(flowGroups).map(([groupKey, groupDef]) => ({
    selector: `node[group = "${groupKey}"]`,
    style: {
      'background-color': groupDef.color,
      'border-color': groupDef.color,
    },
  }));

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
          'width': '130',
          'height': '55',
          'shape': 'round-rectangle',
          'border-width': 2,
          'border-opacity': 0.6,
          'background-opacity': 0.85,
          'text-outline-color': '#0a0f1e',
          'text-outline-width': '1px',
          'overlay-padding': '6px',
          'transition-property': 'border-width, border-opacity, background-opacity, overlay-opacity',
          'transition-duration': '200ms',
        },
      },
      // Decision nodes as diamonds
      {
        selector: 'node[type = "decision"]',
        style: {
          'shape': 'diamond',
          'width': '100',
          'height': '80',
          'text-max-width': '90px',
          'font-size': '10px',
        },
      },
      // Group-specific colors
      ...groupStyles,
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
          'overlay-color': '#06b6d4',
          'overlay-opacity': 0.12,
        },
      },
      // Highlighted edge
      {
        selector: 'edge.highlighted',
        style: {
          'line-color': '#06b6d4',
          'target-arrow-color': '#06b6d4',
          'width': 3,
        },
      },
      // Dimmed (non-path) nodes
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
          'overlay-color': '#06b6d4',
          'overlay-opacity': 0.08,
        },
      },
    ],

    layout: {
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: 50,
      rankSep: 80,
      edgeSep: 30,
      padding: 40,
      animate: false,
      spacingFactor: 1.2,
    },
  });

  // Edge dash animation via periodic update
  let dashOffset = 0;
  const animateEdges = () => {
    dashOffset = (dashOffset + 1) % 24;
    cy.edges().forEach((edge) => {
      if (!edge.hasClass('highlighted') && !edge.hasClass('dimmed')) {
        edge.style('line-dash-offset', dashOffset);
      }
    });
    requestAnimationFrame(animateEdges);
  };
  requestAnimationFrame(animateEdges);

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

  // Node click: highlight path (BFS upstream + downstream)
  cy.on('tap', 'node', (evt) => {
    const node = evt.target;
    clearHighlights(cy);

    // BFS downstream
    const downstream = cy.elements().bfs({
      roots: node,
      visit: () => {},
      directed: true,
    });

    // BFS upstream (reverse edges)
    const upstream = cy.elements().bfs({
      roots: node,
      visit: () => {},
      directed: true,
    });

    // For upstream, we need to traverse predecessors manually
    const pathNodes = new Set();
    const pathEdges = new Set();

    // Add clicked node
    pathNodes.add(node.id());

    // Downstream traversal
    const queue = [node.id()];
    while (queue.length) {
      const current = queue.shift();
      const currentNode = cy.getElementById(current);
      currentNode.outgoers('edge').forEach((edge) => {
        const targetId = edge.target().id();
        pathEdges.add(edge.id());
        if (!pathNodes.has(targetId)) {
          pathNodes.add(targetId);
          queue.push(targetId);
        }
      });
    }

    // Upstream traversal
    const upQueue = [node.id()];
    while (upQueue.length) {
      const current = upQueue.shift();
      const currentNode = cy.getElementById(current);
      currentNode.incomers('edge').forEach((edge) => {
        const sourceId = edge.source().id();
        pathEdges.add(edge.id());
        if (!pathNodes.has(sourceId)) {
          pathNodes.add(sourceId);
          upQueue.push(sourceId);
        }
      });
    }

    // Apply classes
    cy.elements().forEach((ele) => {
      if (ele.isNode()) {
        if (pathNodes.has(ele.id())) {
          ele.addClass('highlighted');
        } else {
          ele.addClass('dimmed');
        }
      } else if (ele.isEdge()) {
        if (pathEdges.has(ele.id())) {
          ele.addClass('highlighted');
        } else {
          ele.addClass('dimmed');
        }
      }
    });

    // Callback
    if (options.onNodeClick) {
      options.onNodeClick(node.data());
    }
  });

  // Tap on background: clear
  cy.on('tap', (evt) => {
    if (evt.target === cy) {
      clearHighlights(cy);
      if (options.onNodeClick) {
        options.onNodeClick(null);
      }
    }
  });

  // Build toolbar
  const toolbar = createToolbar(cy);
  container.parentElement.appendChild(toolbar);

  // Build legend
  const legend = createLegend();
  container.parentElement.appendChild(legend);

  // Fit after layout with minimum zoom for readability
  cy.ready(() => {
    cy.fit(undefined, 30);
    // Ensure zoom is high enough for labels to be readable
    if (cy.zoom() < 0.6) {
      cy.zoom({ level: 0.6, renderedPosition: { x: cy.width() / 2, y: 100 } });
      cy.pan({ x: cy.width() / 2 - cy.width() * 0.3, y: 20 });
    }
  });

  return cy;
}

function clearHighlights(cy) {
  cy.elements().removeClass('highlighted dimmed hover-glow');
}

function createToolbar(cy) {
  const toolbar = document.createElement('div');
  toolbar.className = 'diagram-toolbar';

  const buttons = [
    { label: '+', title: 'Zoom In', action: () => cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }) },
    { label: '-', title: 'Zoom Out', action: () => cy.zoom({ level: cy.zoom() * 0.7, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }) },
    { label: '[ ]', title: 'Ajustar Tela', action: () => { clearHighlights(cy); cy.fit(undefined, 40); } },
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

function createLegend() {
  const legend = document.createElement('div');
  legend.className = 'diagram-legend';

  Object.values(flowGroups).forEach(({ label, color }) => {
    const item = document.createElement('div');
    item.className = 'diagram-legend__item';
    item.innerHTML = `<span class="diagram-legend__dot" style="background:${color}"></span> ${label}`;
    legend.appendChild(item);
  });

  return legend;
}
