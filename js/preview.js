/* ============================================
   Preview Module
   Renders the cross-section with soil nails
   on the preview canvas.
   ============================================ */

const PreviewModule = (() => {
  let canvas, ctx;
  let layout = null;
  let panOffset = { x: 80, y: 0 };
  let scale = 1;
  let showGrid = true;
  let showDimensions = true;
  let showLabels = true;
  let isPanning = false;
  let lastPan = { x: 0, y: 0 };

  const PADDING = 80;

  function init() {
    canvas = document.getElementById('previewCanvas');
    ctx = canvas.getContext('2d');

    document.getElementById('btnGenerateLayout').addEventListener('click', generate);
    document.getElementById('btnToggleGrid').addEventListener('click', toggleGrid);
    document.getElementById('btnToggleDimensions').addEventListener('click', toggleDimensions);
    document.getElementById('btnToggleLabels').addEventListener('click', toggleLabels);
    document.getElementById('btnPreviewZoomFit').addEventListener('click', fitView);

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    const card = canvas.parentElement;
    const rect = card.getBoundingClientRect();
    const toolbarH = card.querySelector('.canvas-toolbar')?.offsetHeight || 0;
    const legendH = card.querySelector('.preview-legend')?.offsetHeight || 0;
    canvas.width = rect.width;
    canvas.height = Math.max(400, rect.height - toolbarH - legendH);
    draw();
  }

  function worldToScreen(wx, wy) {
    return {
      x: panOffset.x + wx * scale,
      y: canvas.height - PADDING - wy * scale + panOffset.y
    };
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - panOffset.x) / scale,
      y: (canvas.height - PADDING - sy + panOffset.y) / scale
    };
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);
    document.getElementById('previewCoords').textContent =
      `X: ${world.x.toFixed(2)} Y: ${world.y.toFixed(2)}`;

    if (isPanning) {
      panOffset.x += e.clientX - lastPan.x;
      panOffset.y += e.clientY - lastPan.y;
      lastPan = { x: e.clientX, y: e.clientY };
      draw();
    }
  }

  function onMouseDown(e) {
    isPanning = true;
    lastPan = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
  }

  function onMouseUp() {
    isPanning = false;
    canvas.style.cursor = 'crosshair';
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldBefore = screenToWorld(sx, sy);
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    scale *= zoomFactor;
    scale = Math.max(1, Math.min(500, scale));
    const worldAfter = screenToWorld(sx, sy);
    panOffset.x += (worldAfter.x - worldBefore.x) * scale;
    panOffset.y -= (worldAfter.y - worldBefore.y) * scale;
    draw();
  }

  function toggleGrid() {
    showGrid = !showGrid;
    document.getElementById('btnToggleGrid').classList.toggle('btn-primary', showGrid);
    draw();
  }

  function toggleDimensions() {
    showDimensions = !showDimensions;
    document.getElementById('btnToggleDimensions').classList.toggle('btn-primary', showDimensions);
    draw();
  }

  function toggleLabels() {
    showLabels = !showLabels;
    document.getElementById('btnToggleLabels').classList.toggle('btn-primary', showLabels);
    draw();
  }

  function generate() {
    layout = NailsModule.generateLayout();
    if (layout.error) {
      App.showToast(layout.error, 'error');
      return;
    }
    updateSummary();
    updateRowTable();
    resizeCanvas();
    fitView();
    App.showToast(`Generated ${layout.rows.length} rows, ${layout.nails.length} total nails`, 'success');
  }

  function fitView() {
    const terrainPoints = TerrainModule.getPoints();
    if (terrainPoints.length < 2 && (!layout || !layout.rows.length)) {
      scale = 30;
      panOffset = { x: PADDING, y: 0 };
      draw();
      return;
    }

    // Collect all relevant points
    const allX = terrainPoints.map(p => p.x);
    const allY = terrainPoints.map(p => p.y);
    if (layout && layout.rows.length) {
      layout.rows.forEach(r => {
        allX.push(r.start.x, r.end.x);
        allY.push(r.start.y, r.end.y);
      });
    }

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const rangeX = (maxX - minX) || 1;
    const rangeY = (maxY - minY) || 1;
    const availW = canvas.width - PADDING * 2;
    const availH = canvas.height - PADDING * 2;
    scale = Math.min(availW / rangeX, availH / rangeY) * 0.8;
    panOffset.x = PADDING + (availW - rangeX * scale) / 2 - minX * scale;
    panOffset.y = 0;

    // Adjust vertical centering
    const topScreen = worldToScreen(0, maxY);
    const botScreen = worldToScreen(0, minY);
    const midScreen = (topScreen.y + botScreen.y) / 2;
    const canvasMid = canvas.height / 2;
    panOffset.y += canvasMid - midScreen;

    draw();
  }

  function draw() {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (showGrid) drawGrid();
    drawTerrain();
    if (layout && layout.rows.length) {
      drawNails();
      if (showDimensions) drawDimensions();
    }
  }

  function drawGrid() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';

    const rawStep = 60 / scale;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    let step = mag;
    if (rawStep / mag > 5) step = mag * 10;
    else if (rawStep / mag > 2) step = mag * 5;
    else if (rawStep / mag > 1) step = mag * 2;

    const worldTL = screenToWorld(0, 0);
    const worldBR = screenToWorld(w, h);
    const startX = Math.floor(worldTL.x / step) * step;
    const endX = Math.ceil(worldBR.x / step) * step;
    const startY = Math.floor(worldBR.y / step) * step;
    const endY = Math.ceil(worldTL.y / step) * step;

    for (let x = startX; x <= endX; x += step) {
      const sx = worldToScreen(x, 0).x;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
      ctx.fillText(fmtNum(x), sx + 2, h - 4);
    }
    for (let y = startY; y <= endY; y += step) {
      const sy = worldToScreen(0, y).y;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
      ctx.fillText(fmtNum(y), 4, sy - 3);
    }
  }

  function drawTerrain() {
    const points = TerrainModule.getPoints();
    if (points.length < 2) return;

    // Ground fill
    ctx.beginPath();
    const first = worldToScreen(points[0].x, points[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const s = worldToScreen(points[i].x, points[i].y);
      ctx.lineTo(s.x, s.y);
    }
    const bottomY = Math.min(...points.map(p => p.y)) - 3;
    const br = worldToScreen(points[points.length - 1].x, bottomY);
    const bl = worldToScreen(points[0].x, bottomY);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();

    // Hatch pattern for soil
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(180, 140, 90, 0.35)');
    gradient.addColorStop(1, 'rgba(140, 100, 60, 0.45)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Terrain surface line
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const s = worldToScreen(points[i].x, points[i].y);
      ctx.lineTo(s.x, s.y);
    }
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Surface dots
    points.forEach(p => {
      const s = worldToScreen(p.x, p.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#6b4423';
      ctx.fill();
    });
  }

  function drawNails() {
    if (!layout || !layout.rows) return;

    layout.rows.forEach((row, idx) => {
      const startS = worldToScreen(row.start.x, row.start.y);
      const endS = worldToScreen(row.end.x, row.end.y);

      // Drill hole (wider, lighter)
      ctx.beginPath();
      ctx.moveTo(startS.x, startS.y);
      ctx.lineTo(endS.x, endS.y);
      ctx.strokeStyle = 'rgba(163,163,163,0.4)';
      ctx.lineWidth = Math.max(3, (layout.params.drillDiameter / 1000) * scale * 0.8);
      ctx.stroke();

      // Nail bar
      ctx.beginPath();
      ctx.moveTo(startS.x, startS.y);
      ctx.lineTo(endS.x, endS.y);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = Math.max(1.5, (layout.params.barDiameter / 1000) * scale * 0.5);
      ctx.stroke();

      // Head plate
      const plateWorldSize = layout.params.plateSize / 1000;
      const platePx = Math.max(6, plateWorldSize * scale);
      ctx.beginPath();
      ctx.arc(startS.x, startS.y, platePx / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Nail tip marker
      ctx.beginPath();
      ctx.arc(endS.x, endS.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();

      // Labels
      if (showLabels) {
        ctx.font = '11px -apple-system, sans-serif';
        ctx.fillStyle = '#1e40af';
        ctx.fillText(`R${row.rowNumber}`, startS.x + 8, startS.y - 6);
      }
    });
  }

  function drawDimensions() {
    if (!layout || layout.rows.length < 2) return;
    const rows = layout.rows;
    const params = layout.params;

    // Vertical spacing dimension line
    const firstRow = rows[0];
    const secondRow = rows[1];
    const dimX = worldToScreen(firstRow.start.x, 0).x + 30;

    const s1 = worldToScreen(firstRow.start.x, firstRow.elevation);
    const s2 = worldToScreen(secondRow.start.x, secondRow.elevation);

    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;

    // Horizontal extension lines
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y); ctx.lineTo(dimX + 10, s1.y);
    ctx.moveTo(s2.x, s2.y); ctx.lineTo(dimX + 10, s2.y);
    ctx.stroke();

    // Vertical dimension line
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(dimX, s1.y); ctx.lineTo(dimX, s2.y);
    ctx.stroke();

    // Arrowheads
    drawArrowhead(ctx, dimX, s1.y, 0, -1);
    drawArrowhead(ctx, dimX, s2.y, 0, 1);

    // Dimension text
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = '#475569';
    const midY = (s1.y + s2.y) / 2;
    ctx.fillText(`${params.vSpacing.toFixed(1)}m`, dimX + 5, midY + 3);

    // Nail length dimension (on first nail)
    if (rows.length > 0) {
      const r = rows[0];
      const ns = worldToScreen(r.start.x, r.start.y);
      const ne = worldToScreen(r.end.x, r.end.y);
      const mx = (ns.x + ne.x) / 2;
      const my = (ns.y + ne.y) / 2;
      ctx.fillStyle = '#1e40af';
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.fillText(`L=${r.nailLength}m @ ${r.inclination}\u00B0`, mx, my - 10);
    }
  }

  function drawArrowhead(context, x, y, dx, dy) {
    const size = 5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - size * 0.5, y - size * dy);
    context.lineTo(x + size * 0.5, y - size * dy);
    context.closePath();
    context.fillStyle = '#94a3b8';
    context.fill();
  }

  function updateSummary() {
    if (!layout || layout.error) return;
    const qty = NailsModule.calculateQuantities(layout);
    if (!qty) return;

    document.getElementById('summNailCount').textContent = layout.rows.length;
    document.getElementById('summRowCount').textContent = qty.totalRows;
    document.getElementById('summNailsPerRow').textContent = qty.nailsPerRow;
    document.getElementById('summTotalNails3D').textContent = qty.totalNails;
    document.getElementById('summDrillLength').textContent = qty.totalDrillLength.toFixed(1) + ' m';
    document.getElementById('summSteelWeight').textContent = (qty.totalSteelWeight / 1000).toFixed(2) + ' t';
    document.getElementById('summGroutVol').textContent = qty.totalGroutVolume.toFixed(2) + ' m\u00B3';
  }

  function updateRowTable() {
    if (!layout || !layout.rows) return;
    const tbody = document.getElementById('rowDetailsBody');
    tbody.innerHTML = '';
    layout.rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.rowNumber}</td>
        <td>${row.elevation.toFixed(2)}</td>
        <td>${row.nailLength.toFixed(1)}</td>
        <td>${row.inclination}\u00B0</td>`;
      tbody.appendChild(tr);
    });
  }

  function getLayout() {
    return layout;
  }

  function fmtNum(n) {
    if (Math.abs(n) < 0.001) return '0';
    if (Number.isInteger(n)) return n.toString();
    return n.toFixed(1);
  }

  return { init, generate, getLayout, fitView, draw, resizeCanvas };
})();
