import * as d3 from 'd3';
import { erDomains, erEntities, erRelationships } from '../data/er-entities.js';
import { getColors, onThemeChange } from '../core/theme.js';

/**
 * Create an interactive Entity-Relationship diagram using D3 force-directed layout.
 * @param {HTMLElement} container - The DOM element to render into
 * @param {object} options - Optional callbacks and settings
 * @param {function} [options.onEntityClick] - Called with entity data on click, null on deselect
 * @returns {{ simulation, toggleDomain, destroy }} Controller object
 */
export function createErDiagram(container, options = {}) {
  // ── Constants ────────────────────────────────────────────────────
  const NODE_W = 140;
  const NODE_H = 50;
  const NODE_RX = 8;
  const FONT_SIZE = 11;
  const LABEL_FONT_SIZE = 9;

  // ── Dynamic colors from theme ───────────────────────────────────
  let c = getColors();

  // ── State ────────────────────────────────────────────────────────
  const hiddenDomains = new Set();
  let selectedEntityId = null;

  // ── Prepare data (deep copies for D3 mutation) ───────────────────
  let nodes = erEntities.map((e) => ({ ...e }));
  let links = erRelationships.map((r, i) => ({
    ...r,
    id: `rel-${i}`,
    source: r.source,
    target: r.target,
  }));

  // ── Container sizing ─────────────────────────────────────────────
  const width = container.clientWidth || 960;
  const height = 800;

  // ── SVG setup ────────────────────────────────────────────────────
  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('background', 'transparent')
    .style('cursor', 'grab');

  // Defs for arrowheads and glow filter
  const defs = svg.append('defs');

  // Arrowhead marker
  const arrowMarker = defs
    .append('marker')
    .attr('id', 'er-arrow')
    .attr('viewBox', '0 0 10 6')
    .attr('refX', 10)
    .attr('refY', 3)
    .attr('markerWidth', 10)
    .attr('markerHeight', 6)
    .attr('orient', 'auto');
  const arrowPath = arrowMarker
    .append('path')
    .attr('d', 'M0,0 L10,3 L0,6 Z')
    .attr('fill', c.edgeColor);

  // Highlighted arrowhead
  const arrowHlMarker = defs
    .append('marker')
    .attr('id', 'er-arrow-hl')
    .attr('viewBox', '0 0 10 6')
    .attr('refX', 10)
    .attr('refY', 3)
    .attr('markerWidth', 10)
    .attr('markerHeight', 6)
    .attr('orient', 'auto');
  const arrowHlPath = arrowHlMarker
    .append('path')
    .attr('d', 'M0,0 L10,3 L0,6 Z')
    .attr('fill', c.highlightColor);

  // Glow filter for hover
  const glowFilter = defs
    .append('filter')
    .attr('id', 'er-glow')
    .attr('x', '-30%')
    .attr('y', '-30%')
    .attr('width', '160%')
    .attr('height', '160%');
  glowFilter
    .append('feGaussianBlur')
    .attr('stdDeviation', '4')
    .attr('result', 'blur');
  glowFilter
    .append('feMerge')
    .selectAll('feMergeNode')
    .data(['blur', 'SourceGraphic'])
    .join('feMergeNode')
    .attr('in', (d) => d);

  // ── Zoom behaviour ───────────────────────────────────────────────
  const zoomGroup = svg.append('g').attr('class', 'er-zoom-group');

  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.15, 3])
    .on('zoom', (event) => {
      zoomGroup.attr('transform', event.transform);
    });

  svg.call(zoomBehavior);

  // Click on SVG background to deselect
  svg.on('click', (event) => {
    if (event.target === svg.node() || event.target.closest('.er-zoom-group') === zoomGroup.node()) {
      // Only if clicking on the SVG itself (not on a node)
      if (!event.target.closest('.er-node')) {
        clearSelection();
        if (options.onEntityClick) {
          options.onEntityClick(null);
        }
      }
    }
  });

  // ── Links layer ──────────────────────────────────────────────────
  const linkGroup = zoomGroup.append('g').attr('class', 'er-links');
  const labelGroup = zoomGroup.append('g').attr('class', 'er-link-labels');
  const nodeGroup = zoomGroup.append('g').attr('class', 'er-nodes');

  // ── Force simulation ─────────────────────────────────────────────
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(180)
    )
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force(
      'collide',
      d3.forceCollide().radius(NODE_W * 0.6).strength(0.7)
    )
    .force('x', d3.forceX(width / 2).strength(0.03))
    .force('y', d3.forceY(height / 2).strength(0.03))
    .alphaDecay(0.02)
    .on('tick', ticked);

  // ── Render functions ─────────────────────────────────────────────
  let linkEls, labelEls, nodeEls;

  function render() {
    const visibleNodes = nodes.filter((n) => !hiddenDomains.has(n.domain));
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleLinks = links.filter(
      (l) => {
        const srcId = typeof l.source === 'object' ? l.source.id : l.source;
        const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
        return visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId);
      }
    );

    // ── Links ────────────────────────────────────────────────────
    linkEls = linkGroup
      .selectAll('line.er-link')
      .data(visibleLinks, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append('line')
            .attr('class', 'er-link')
            .attr('stroke', c.edgeColor)
            .attr('stroke-width', 1.5)
            .attr('stroke-opacity', 0.6)
            .attr('marker-end', 'url(#er-arrow)'),
        (update) => update,
        (exit) => exit.remove()
      );

    // ── Link labels ──────────────────────────────────────────────
    labelEls = labelGroup
      .selectAll('text.er-link-label')
      .data(visibleLinks, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append('text')
            .attr('class', 'er-link-label')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', LABEL_FONT_SIZE)
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .attr('fill', c.textMuted)
            .attr('paint-order', 'stroke')
            .attr('stroke', c.bgSecondary)
            .attr('stroke-width', 3)
            .text((d) => d.cardinality),
        (update) => update.text((d) => d.cardinality),
        (exit) => exit.remove()
      );

    // ── Nodes ────────────────────────────────────────────────────
    nodeEls = nodeGroup
      .selectAll('g.er-node')
      .data(visibleNodes, (d) => d.id)
      .join(
        (enter) => {
          const g = enter
            .append('g')
            .attr('class', 'er-node')
            .style('cursor', 'pointer')
            .call(dragBehavior);

          // Background rect
          g.append('rect')
            .attr('width', NODE_W)
            .attr('height', NODE_H)
            .attr('rx', NODE_RX)
            .attr('ry', NODE_RX)
            .attr('x', -NODE_W / 2)
            .attr('y', -NODE_H / 2)
            .attr('fill', (d) => {
              const color = erDomains[d.domain]?.color || '#6b7280';
              return hexToRgba(color, 0.18);
            })
            .attr('stroke', (d) => erDomains[d.domain]?.color || '#6b7280')
            .attr('stroke-width', 1.5)
            .attr('stroke-opacity', 0.6);

          // Entity name label
          g.append('text')
            .attr('class', 'er-node-label')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', FONT_SIZE)
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .attr('font-weight', 600)
            .attr('fill', c.textPrimary)
            .attr('pointer-events', 'none')
            .text((d) => truncateText(d.name, 18));

          // Domain color indicator bar (top edge)
          g.append('rect')
            .attr('width', NODE_W - 2)
            .attr('height', 3)
            .attr('x', -(NODE_W / 2) + 1)
            .attr('y', -NODE_H / 2)
            .attr('rx', NODE_RX)
            .attr('ry', 0)
            .attr('fill', (d) => erDomains[d.domain]?.color || '#6b7280')
            .attr('opacity', 0.8);

          // Event handlers
          g.on('mouseenter', handleNodeHover)
            .on('mouseleave', handleNodeHoverOut)
            .on('click', handleNodeClick);

          return g;
        },
        (update) => update,
        (exit) => exit.remove()
      );

    // Restart simulation with visible data
    simulation.nodes(visibleNodes);
    simulation.force('link').links(visibleLinks);
    simulation.alpha(0.4).restart();
  }

  function ticked() {
    if (linkEls) {
      linkEls
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => shortenLine(d.source, d.target, NODE_W / 2 + 6).x)
        .attr('y2', (d) => shortenLine(d.source, d.target, NODE_W / 2 + 6).y);
    }

    if (labelEls) {
      labelEls
        .attr('x', (d) => (d.source.x + d.target.x) / 2)
        .attr('y', (d) => (d.source.y + d.target.y) / 2 - 8);
    }

    if (nodeEls) {
      nodeEls.attr('transform', (d) => `translate(${d.x},${d.y})`);
    }
  }

  // ── Interaction handlers ─────────────────────────────────────────
  function handleNodeHover(event, d) {
    if (selectedEntityId) return;
    d3.select(this).select('rect').attr('filter', 'url(#er-glow)');
    d3.select(this).select('rect')
      .transition()
      .duration(150)
      .attr('stroke-opacity', 1)
      .attr('stroke-width', 2.5);
  }

  function handleNodeHoverOut(event, d) {
    if (selectedEntityId === d.id) return;
    d3.select(this).select('rect').attr('filter', null);
    d3.select(this).select('rect')
      .transition()
      .duration(150)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5);
  }

  function handleNodeClick(event, d) {
    event.stopPropagation();

    if (selectedEntityId === d.id) {
      clearSelection();
      if (options.onEntityClick) {
        options.onEntityClick(null);
      }
      return;
    }

    selectedEntityId = d.id;

    // Find connected entity IDs
    const connectedIds = new Set([d.id]);
    const connectedLinkIds = new Set();

    links.forEach((l) => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      if (srcId === d.id) {
        connectedIds.add(tgtId);
        connectedLinkIds.add(l.id);
      }
      if (tgtId === d.id) {
        connectedIds.add(srcId);
        connectedLinkIds.add(l.id);
      }
    });

    // Dim all nodes
    nodeEls.each(function (nd) {
      const el = d3.select(this);
      if (connectedIds.has(nd.id)) {
        el.select('rect')
          .transition()
          .duration(200)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', 2.5)
          .attr('fill', hexToRgba(erDomains[nd.domain]?.color || '#6b7280', 0.3));
        el.select('.er-node-label')
          .transition()
          .duration(200)
          .attr('fill', c.textPrimary);
        if (nd.id === d.id) {
          el.select('rect').attr('filter', 'url(#er-glow)');
        }
      } else {
        el.select('rect')
          .transition()
          .duration(200)
          .attr('stroke-opacity', 0.15)
          .attr('stroke-width', 1)
          .attr('fill', hexToRgba(erDomains[nd.domain]?.color || '#6b7280', 0.05));
        el.select('.er-node-label')
          .transition()
          .duration(200)
          .attr('fill', c.edgeColor);
      }
    });

    // Dim / highlight links
    linkEls.each(function (ld) {
      const el = d3.select(this);
      if (connectedLinkIds.has(ld.id)) {
        el.transition()
          .duration(200)
          .attr('stroke', c.highlightColor)
          .attr('stroke-opacity', 0.9)
          .attr('stroke-width', 2.5)
          .attr('marker-end', 'url(#er-arrow-hl)');
      } else {
        el.transition()
          .duration(200)
          .attr('stroke', c.edgeDimmed)
          .attr('stroke-opacity', 0.25)
          .attr('stroke-width', 1)
          .attr('marker-end', 'url(#er-arrow)');
      }
    });

    // Dim / highlight link labels
    labelEls.each(function (ld) {
      const el = d3.select(this);
      if (connectedLinkIds.has(ld.id)) {
        el.transition().duration(200).attr('fill', c.highlightColor).attr('opacity', 1);
      } else {
        el.transition().duration(200).attr('fill', c.edgeColor).attr('opacity', 0.2);
      }
    });

    // Callback with full entity data
    if (options.onEntityClick) {
      const entity = erEntities.find((e) => e.id === d.id);
      const rels = erRelationships.filter((r) => r.source === d.id || r.target === d.id);
      options.onEntityClick({ ...entity, relationships: rels });
    }
  }

  function clearSelection() {
    selectedEntityId = null;

    if (nodeEls) {
      nodeEls.each(function (nd) {
        const el = d3.select(this);
        el.select('rect')
          .attr('filter', null)
          .transition()
          .duration(200)
          .attr('stroke-opacity', 0.6)
          .attr('stroke-width', 1.5)
          .attr('fill', hexToRgba(erDomains[nd.domain]?.color || '#6b7280', 0.18));
        el.select('.er-node-label')
          .transition()
          .duration(200)
          .attr('fill', c.textPrimary);
      });
    }

    if (linkEls) {
      linkEls
        .transition()
        .duration(200)
        .attr('stroke', c.edgeColor)
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1.5)
        .attr('marker-end', 'url(#er-arrow)');
    }

    if (labelEls) {
      labelEls
        .transition()
        .duration(200)
        .attr('fill', c.textMuted)
        .attr('opacity', 1);
    }
  }

  // ── Theme change handler ─────────────────────────────────────────
  onThemeChange((_theme, colors) => {
    c = colors;
    // Update SVG marker colors
    arrowPath.attr('fill', c.edgeColor);
    arrowHlPath.attr('fill', c.highlightColor);
    // Reset selection state with new colors
    clearSelection();
    // Update link label background stroke
    if (labelEls) {
      labelEls.attr('stroke', c.bgSecondary).attr('fill', c.textMuted);
    }
    // Update node text colors
    if (nodeEls) {
      nodeEls.select('.er-node-label').attr('fill', c.textPrimary);
    }
    // Update link colors
    if (linkEls) {
      linkEls.attr('stroke', c.edgeColor);
    }
  });

  // ── Drag behaviour ───────────────────────────────────────────────
  const dragBehavior = d3
    .drag()
    .on('start', (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      svg.style('cursor', 'grabbing');
    })
    .on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      svg.style('cursor', 'grab');
    });

  // ── Domain toggle ────────────────────────────────────────────────
  function toggleDomain(domainKey) {
    if (hiddenDomains.has(domainKey)) {
      hiddenDomains.delete(domainKey);
    } else {
      hiddenDomains.add(domainKey);
    }
    clearSelection();
    render();
  }

  // ── Toolbar ──────────────────────────────────────────────────────
  function createToolbar() {
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
        action: () => {
          clearSelection();
          svg
            .transition()
            .duration(500)
            .call(zoomBehavior.transform, d3.zoomIdentity);
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

    container.appendChild(toolbar);
    return toolbar;
  }

  // ── Legend ────────────────────────────────────────────────────────
  function createLegend() {
    const legend = document.createElement('div');
    legend.className = 'diagram-legend';

    Object.entries(erDomains).forEach(([key, { label, color }]) => {
      const item = document.createElement('div');
      item.className = 'diagram-legend__item';
      item.style.cursor = 'pointer';
      item.style.userSelect = 'none';
      item.innerHTML = `<span class="diagram-legend__dot" style="background:${color}"></span> ${label}`;
      item.title = `Clique para mostrar/ocultar ${label}`;

      item.addEventListener('click', () => {
        toggleDomain(key);
        item.style.opacity = hiddenDomains.has(key) ? '0.35' : '1';
      });

      legend.appendChild(item);
    });

    container.appendChild(legend);
    return legend;
  }

  // ── Utility functions ────────────────────────────────────────────
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function truncateText(text, maxLen) {
    return text.length > maxLen ? text.slice(0, maxLen - 1) + '\u2026' : text;
  }

  function shortenLine(source, target, offset) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const ratio = Math.max(0, (dist - offset) / dist);
    return {
      x: source.x + dx * ratio,
      y: source.y + dy * ratio,
    };
  }

  // ── Build UI ─────────────────────────────────────────────────────
  const toolbarEl = createToolbar();
  const legendEl = createLegend();

  // Initial render
  render();

  // ── Destroy helper ───────────────────────────────────────────────
  function destroy() {
    simulation.stop();
    svg.remove();
    toolbarEl.remove();
    legendEl.remove();
  }

  // ── Public API ───────────────────────────────────────────────────
  return {
    simulation,
    toggleDomain,
    destroy,
  };
}
