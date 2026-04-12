import * as d3 from 'd3';
import {
  topologyNodes,
  topologyLinks,
  topologyNodeTypes,
} from '../data/topology-nodes.js';
import { getColors, onThemeChange } from '../core/theme.js';

/**
 * Create an interactive network topology diagram using D3.js.
 *
 * @param {HTMLElement} container - The DOM element to render into
 * @param {object} [options]
 * @param {function} [options.onNodeClick] - Called with node data on click, or null on deselect
 * @returns {{ svg: SVGElement, cleanup: function }}
 */
export function createTopologyDiagram(container, options = {}) {
  // ── Dimensions ───────────────────────────────────────────────────
  const viewBox = { w: 1000, h: 700 };
  const containerRect = container.getBoundingClientRect();
  const width = containerRect.width || 1000;
  const height = containerRect.height || 700;

  // ── Dynamic colors ──────────────────────────────────────────────
  let c = getColors();

  // ── State ────────────────────────────────────────────────────────
  let selectedNodeId = null;
  let visibleLinkTypes = new Set(['ethernet', 'wireless', 'serial', 'usb']);
  const timers = [];
  let packetInterval = null;

  // ── SVG root ─────────────────────────────────────────────────────
  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${viewBox.w} ${viewBox.h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('background', 'transparent')
    .style('font-family', 'Inter, system-ui, sans-serif');

  // Defs — glow filter
  const defs = svg.append('defs');
  const glowFilter = defs.append('filter').attr('id', 'glow');
  glowFilter
    .append('feGaussianBlur')
    .attr('stdDeviation', '3')
    .attr('result', 'coloredBlur');
  const feMerge = glowFilter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // ── Zoom behaviour ───────────────────────────────────────────────
  const zoomGroup = svg.append('g').attr('class', 'zoom-layer');

  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => {
      zoomGroup.attr('transform', event.transform);
    });

  svg.call(zoomBehavior);

  // Click on background to deselect
  svg.on('click', (event) => {
    if (event.target.tagName === 'svg' || event.target === svg.node()) {
      clearSelection();
      if (options.onNodeClick) options.onNodeClick(null);
    }
  });

  // ── Build lookup maps ────────────────────────────────────────────
  const nodeById = new Map(topologyNodes.map((n) => [n.id, n]));

  // Adjacency: nodeId → Set of link indices
  const adjacency = new Map();
  topologyNodes.forEach((n) => adjacency.set(n.id, new Set()));
  topologyLinks.forEach((link, i) => {
    adjacency.get(link.source)?.add(i);
    adjacency.get(link.target)?.add(i);
  });

  // ── Link stroke helper (inside closure for access to c) ─────────
  function linkStroke(type) {
    switch (type) {
      case 'ethernet': return c.edgeColor;
      case 'wireless': return '#06b6d4';
      case 'serial':   return '#f59e0b';
      case 'usb':      return '#8b5cf6';
      default:         return c.edgeColor;
    }
  }

  // ── Render links ─────────────────────────────────────────────────
  const linkGroup = zoomGroup.append('g').attr('class', 'links');

  const linkElements = linkGroup
    .selectAll('line')
    .data(topologyLinks)
    .join('line')
    .attr('x1', (d) => nodeById.get(d.source).x)
    .attr('y1', (d) => nodeById.get(d.source).y)
    .attr('x2', (d) => nodeById.get(d.target).x)
    .attr('y2', (d) => nodeById.get(d.target).y)
    .attr('stroke', (d) => linkStroke(d.type))
    .attr('stroke-width', (d) => (d.type === 'ethernet' ? 2 : 1.5))
    .attr('stroke-dasharray', (d) =>
      d.type === 'wireless' ? '6 4' : d.type === 'serial' || d.type === 'usb' ? '3 3' : 'none'
    )
    .attr('stroke-opacity', 0.5)
    .attr('data-link-type', (d) => d.type);

  // ── Render nodes ─────────────────────────────────────────────────
  const nodeGroup = zoomGroup.append('g').attr('class', 'nodes');

  const nodeContainers = nodeGroup
    .selectAll('g.node')
    .data(topologyNodes)
    .join('g')
    .attr('class', 'node')
    .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
    .style('cursor', 'pointer');

  // Rounded rect background
  nodeContainers
    .append('rect')
    .attr('class', 'node-bg')
    .attr('x', (d) => -typeDef(d).size / 2)
    .attr('y', (d) => -typeDef(d).size / 2.5)
    .attr('width', (d) => typeDef(d).size)
    .attr('height', (d) => typeDef(d).size * 0.7)
    .attr('rx', 10)
    .attr('ry', 10)
    .attr('fill', (d) => typeDef(d).color)
    .attr('fill-opacity', 0.15)
    .attr('stroke', (d) => typeDef(d).color)
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.6);

  // Emoji icon
  nodeContainers
    .append('text')
    .attr('class', 'node-icon')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('y', -2)
    .attr('font-size', (d) => typeDef(d).size * 0.38)
    .text((d) => typeDef(d).icon);

  // Label below node
  nodeContainers
    .append('text')
    .attr('class', 'node-label')
    .attr('text-anchor', 'middle')
    .attr('y', (d) => typeDef(d).size / 2.5 + 14)
    .attr('fill', c.textPrimary)
    .attr('font-size', '10px')
    .attr('font-weight', '600')
    .text((d) => d.label);

  // ── Interactivity ────────────────────────────────────────────────

  // Hover glow
  nodeContainers
    .on('mouseenter', function (event, d) {
      d3.select(this).select('.node-bg').attr('filter', 'url(#glow)').attr('stroke-opacity', 1);
    })
    .on('mouseleave', function () {
      if (!d3.select(this).classed('selected')) {
        d3.select(this).select('.node-bg').attr('filter', null).attr('stroke-opacity', 0.6);
      }
    });

  // Click node
  nodeContainers.on('click', function (event, d) {
    event.stopPropagation();
    clearSelection();

    selectedNodeId = d.id;
    const connectedLinks = adjacency.get(d.id) || new Set();
    const connectedNodeIds = new Set([d.id]);
    connectedLinks.forEach((i) => {
      connectedNodeIds.add(topologyLinks[i].source);
      connectedNodeIds.add(topologyLinks[i].target);
    });

    // Dim non-connected nodes
    nodeContainers.each(function (nd) {
      const g = d3.select(this);
      if (!connectedNodeIds.has(nd.id)) {
        g.select('.node-bg').attr('fill-opacity', 0.05).attr('stroke-opacity', 0.15);
        g.select('.node-label').attr('fill-opacity', 0.25);
        g.select('.node-icon').attr('opacity', 0.25);
      } else if (nd.id === d.id) {
        g.select('.node-bg').attr('filter', 'url(#glow)').attr('stroke-opacity', 1).attr('fill-opacity', 0.3);
        g.classed('selected', true);
      }
    });

    // Highlight connected links, dim others
    linkElements.each(function (ld, i) {
      const el = d3.select(this);
      if (connectedLinks.has(i)) {
        el.attr('stroke-opacity', 0.9).attr('stroke-width', 3);
      } else {
        el.attr('stroke-opacity', 0.08).attr('stroke-width', 1);
      }
    });

    if (options.onNodeClick) options.onNodeClick(d);
  });

  // ── Data packet animation ────────────────────────────────────────
  const packetColors = ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
  const packetLayer = zoomGroup.append('g').attr('class', 'packets');

  function spawnPacket() {
    // Pick a random visible ethernet/wireless link
    const eligible = topologyLinks.filter((l) =>
      (l.type === 'ethernet' || l.type === 'wireless') && visibleLinkTypes.has(l.type)
    );
    if (eligible.length === 0) return;

    const link = eligible[Math.floor(Math.random() * eligible.length)];
    const srcNode = nodeById.get(link.source);
    const tgtNode = nodeById.get(link.target);
    if (!srcNode || !tgtNode) return;

    const color = packetColors[Math.floor(Math.random() * packetColors.length)];

    packetLayer
      .append('circle')
      .attr('r', 4)
      .attr('cx', srcNode.x)
      .attr('cy', srcNode.y)
      .attr('fill', color)
      .attr('opacity', 0.9)
      .transition()
      .duration(1500)
      .ease(d3.easeLinear)
      .attr('cx', tgtNode.x)
      .attr('cy', tgtNode.y)
      .attr('opacity', 0)
      .remove();
  }

  packetInterval = setInterval(spawnPacket, 2000);
  // Spawn a few immediately for visual interest
  spawnPacket();
  setTimeout(spawnPacket, 500);
  setTimeout(spawnPacket, 1000);

  // ── Toolbar ──────────────────────────────────────────────────────
  const toolbar = buildToolbar(svg, zoomBehavior, viewBox);
  container.appendChild(toolbar);

  // ── Legend ────────────────────────────────────────────────────────
  const legend = buildLegend();
  container.appendChild(legend);

  // ── Layer toggle ─────────────────────────────────────────────────
  const layerToggle = buildLayerToggle((type, visible) => {
    if (visible) {
      visibleLinkTypes.add(type);
    } else {
      visibleLinkTypes.delete(type);
    }
    linkElements.attr('display', (d) => (visibleLinkTypes.has(d.type) ? null : 'none'));
  });
  container.appendChild(layerToggle);

  // ── Theme change ─────────────────────────────────────────────────
  onThemeChange((_theme, colors) => {
    c = colors;
    // Update node labels
    nodeContainers.select('.node-label').attr('fill', c.textPrimary);
    // Update ethernet/default link strokes
    linkElements.attr('stroke', (d) => linkStroke(d.type));
    // Reset selection to avoid stale dimmed colors
    if (selectedNodeId) clearSelection();
  });

  // ── Helpers ──────────────────────────────────────────────────────

  function clearSelection() {
    selectedNodeId = null;
    nodeContainers.each(function () {
      const g = d3.select(this);
      g.classed('selected', false);
      g.select('.node-bg').attr('filter', null).attr('fill-opacity', 0.15).attr('stroke-opacity', 0.6);
      g.select('.node-label').attr('fill-opacity', 1);
      g.select('.node-icon').attr('opacity', 1);
    });
    linkElements
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', (d) => (d.type === 'ethernet' ? 2 : 1.5));
  }

  function typeDef(node) {
    return topologyNodeTypes[node.type] || topologyNodeTypes.workstation;
  }

  // ── Cleanup ──────────────────────────────────────────────────────
  function cleanup() {
    if (packetInterval) clearInterval(packetInterval);
    timers.forEach((t) => t.stop?.());
    svg.remove();
    toolbar.remove();
    legend.remove();
    layerToggle.remove();
  }

  return { svg: svg.node(), cleanup };
}

// ═══════════════════════════════════════════════════════════════════
// UI builders
// ═══════════════════════════════════════════════════════════════════

function buildToolbar(svg, zoomBehavior, viewBox) {
  const toolbar = document.createElement('div');
  toolbar.className = 'diagram-toolbar';

  const buttons = [
    {
      label: '+',
      title: 'Zoom In',
      action: () => svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.4),
    },
    {
      label: '\u2212',
      title: 'Zoom Out',
      action: () => svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.7),
    },
    {
      label: '[ ]',
      title: 'Ajustar Tela',
      action: () =>
        svg
          .transition()
          .duration(500)
          .call(zoomBehavior.transform, d3.zoomIdentity),
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

function buildLegend() {
  const legend = document.createElement('div');
  legend.className = 'diagram-legend';

  Object.entries(topologyNodeTypes).forEach(([, typeDef]) => {
    const item = document.createElement('div');
    item.className = 'diagram-legend__item';
    item.innerHTML = `<span class="diagram-legend__dot" style="background:${typeDef.color}"></span> ${typeDef.label}`;
    legend.appendChild(item);
  });

  return legend;
}

function buildLayerToggle(onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'diagram-toolbar';
  wrapper.style.top = 'auto';
  wrapper.style.bottom = '1rem';

  const layers = [
    { type: 'ethernet', label: 'Ethernet', checked: true },
    { type: 'wireless', label: 'Wi-Fi', checked: true },
    { type: 'serial', label: 'Serial', checked: true },
    { type: 'usb', label: 'USB', checked: true },
  ];

  layers.forEach(({ type, label, checked }) => {
    const lbl = document.createElement('label');
    lbl.className = 'diagram-toolbar__btn';
    lbl.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:11px;padding:4px 8px;cursor:pointer;';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.style.cssText = 'accent-color:#06b6d4;cursor:pointer;';
    cb.addEventListener('change', () => onChange(type, cb.checked));

    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(label));
    wrapper.appendChild(lbl);
  });

  return wrapper;
}
