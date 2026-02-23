/* ============================================
   Terrain Profile Module
   Handles terrain cross-section definition via
   interactive canvas drawing and table input.
   ============================================ */

const TerrainModule = (() => {
  // State
  let points = [];
  let canvas, ctx;
  let mode = 'draw'; // 'draw' | 'select'
  let selectedPointIndex = -1;
  let dragging = false;
  let panOffset = { x: 60, y: 0 };
  let scale = 1;
  let hoveredPointIndex = -1;

  // Canvas coordinate system: world coords (meters) mapped to screen
  const PADDING = 60;
  const POINT_RADIUS = 6;
  const POINT_RADIUS_HOVER = 8;

  function init() {
    canvas = document.getElementById('terrainCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();

    // Event listeners
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    document.getElementById('btnDrawMode').addEventListener('click', () => setMode('draw'));
    document.getElementById('btnSelectMode').addEventListener('click', () => setMode('select'));
    document.getElementById('btnZoomFit').addEventListener('click', fitView);
    document.getElementById('btnClearTerrain').addEventListener('click', clearAll);
    document.getElementById('btnLoadSample').addEventListener('click', loadSample);
    document.getElementById('btnAddPoint').addEventListener('click', addPointFromTable);
    document.getElementById('btnSortPoints').addEventListener('click', sortPointsByX);
    document.getElementById('btnImportCSV').addEventListener('click', () => document.getElementById('csvFileInput').click());
    document.getElementById('csvFileInput').addEventListener('change', importCSV);

    window.addEventListener('resize', resizeCanvas);
    draw();
  }

  function resizeCanvas() {
    const card = canvas.parentElement;
    const rect = card.getBoundingClientRect();
    const toolbarH = card.querySelector('.canvas-toolbar')?.offsetHeight || 0;
    const hintH = card.querySelector('.canvas-hint')?.offsetHeight || 0;
    canvas.width = rect.width;
    canvas.height = Math.max(400, rect.height - toolbarH - hintH);
    draw();
  }

  function setMode(m) {
    mode = m;
    document.getElementById('btnDrawMode').classList.toggle('btn-primary', m === 'draw');
    document.getElementById('btnSelectMode').classList.toggle('btn-primary', m === 'select');
    canvas.style.cursor = m === 'draw' ? 'crosshair' : 'default';
  }

  // ---- Coordinate Transforms ----
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

  function fitView() {
    if (points.length < 2) {
      scale = 20;
      panOffset = { x: PADDING, y: 0 };
      draw();
      return;
    }
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const availW = canvas.width - PADDING * 2;
    const availH = canvas.height - PADDING * 2;
    scale = Math.min(availW / rangeX, availH / rangeY) * 0.85;
    panOffset.x = PADDING + (availW - rangeX * scale) / 2 - minX * scale;
    panOffset.y = -(PADDING + (availH - rangeY * scale) / 2 - minY * scale) + (canvas.height - PADDING * 2 - rangeY * scale) / 2;
    // Recalculate to properly center
    const testMin = worldToScreen(minX, minY);
    const testMax = worldToScreen(maxX, maxY);
    const centeredOffsetX = (canvas.width - (testMax.x - testMin.x)) / 2 - testMin.x + panOffset.x;
    panOffset.x = centeredOffsetX;
    draw();
  }

  // ---- Mouse Events ----
  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function findNearestPoint(sx, sy, threshold = 12) {
    let minDist = Infinity, idx = -1;
    points.forEach((p, i) => {
      const sp = worldToScreen(p.x, p.y);
      const d = Math.hypot(sp.x - sx, sp.y - sy);
      if (d < threshold && d < minDist) {
        minDist = d;
        idx = i;
      }
    });
    return idx;
  }

  function onMouseDown(e) {
    const pos = getMousePos(e);
    if (mode === 'draw') {
      const world = screenToWorld(pos.x, pos.y);
      // Round to 2 decimal places
      world.x = Math.round(world.x * 100) / 100;
      world.y = Math.round(world.y * 100) / 100;
      points.push(world);
      updateTable();
      updateStats();
      draw();
    } else if (mode === 'select') {
      selectedPointIndex = findNearestPoint(pos.x, pos.y);
      if (selectedPointIndex >= 0) {
        dragging = true;
        canvas.style.cursor = 'grabbing';
      }
    }
  }

  function onMouseMove(e) {
    const pos = getMousePos(e);
    const world = screenToWorld(pos.x, pos.y);
    document.getElementById('canvasCoords').textContent =
      `X: ${world.x.toFixed(2)} Y: ${world.y.toFixed(2)}`;

    if (mode === 'select' && dragging && selectedPointIndex >= 0) {
      points[selectedPointIndex].x = Math.round(world.x * 100) / 100;
      points[selectedPointIndex].y = Math.round(world.y * 100) / 100;
      updateTable();
      updateStats();
      draw();
    } else {
      const prev = hoveredPointIndex;
      hoveredPointIndex = findNearestPoint(pos.x, pos.y);
      if (prev !== hoveredPointIndex) draw();
      if (mode === 'select') {
        canvas.style.cursor = hoveredPointIndex >= 0 ? 'grab' : 'default';
      }
    }
  }

  function onMouseUp() {
    dragging = false;
    if (mode === 'select') {
      canvas.style.cursor = hoveredPointIndex >= 0 ? 'grab' : 'default';
    }
  }

  function onMouseLeave() {
    dragging = false;
    hoveredPointIndex = -1;
    document.getElementById('canvasCoords').textContent = 'X: -- Y: --';
    draw();
  }

  function onWheel(e) {
    e.preventDefault();
    const pos = getMousePos(e);
    const worldBefore = screenToWorld(pos.x, pos.y);
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    scale *= zoomFactor;
    scale = Math.max(1, Math.min(500, scale));
    const worldAfter = screenToWorld(pos.x, pos.y);
    panOffset.x += (worldAfter.x - worldBefore.x) * scale;
    panOffset.y -= (worldAfter.y - worldBefore.y) * scale;
    draw();
  }

  // ---- Drawing ----
  function draw() {
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    drawGrid();

    if (points.length > 0) {
      drawTerrainFill();
      drawTerrainLine();
      drawPoints();
    }
  }

  function drawGrid() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';

    // Determine nice grid spacing
    const rawStep = 50 / scale; // ~50px per grid line
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

    // Vertical lines
    for (let x = startX; x <= endX; x += step) {
      const sx = worldToScreen(x, 0).x;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
      ctx.fillText(formatNum(x), sx + 3, h - 5);
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += step) {
      const sy = worldToScreen(0, y).y;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
      ctx.fillText(formatNum(y), 5, sy - 3);
    }

    // Axis lines
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    const originScreen = worldToScreen(0, 0);
    ctx.beginPath();
    ctx.moveTo(0, originScreen.y);
    ctx.lineTo(w, originScreen.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(originScreen.x, 0);
    ctx.lineTo(originScreen.x, h);
    ctx.stroke();
  }

  function drawTerrainFill() {
    if (points.length < 2) return;
    const sorted = [...points].sort((a, b) => a.x - b.x);
    ctx.beginPath();
    const first = worldToScreen(sorted[0].x, sorted[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < sorted.length; i++) {
      const s = worldToScreen(sorted[i].x, sorted[i].y);
      ctx.lineTo(s.x, s.y);
    }
    // Close downward
    const lastPt = sorted[sorted.length - 1];
    const bottomY = Math.min(...sorted.map(p => p.y)) - 2;
    const br = worldToScreen(lastPt.x, bottomY);
    const bl = worldToScreen(sorted[0].x, bottomY);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(212,165,116,0.3)';
    ctx.fill();
  }

  function drawTerrainLine() {
    if (points.length < 2) return;
    const sorted = [...points].sort((a, b) => a.x - b.x);
    ctx.beginPath();
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    const first = worldToScreen(sorted[0].x, sorted[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < sorted.length; i++) {
      const s = worldToScreen(sorted[i].x, sorted[i].y);
      ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
  }

  function drawPoints() {
    points.forEach((p, i) => {
      const s = worldToScreen(p.x, p.y);
      const isHovered = i === hoveredPointIndex;
      const isSelected = i === selectedPointIndex && dragging;
      const r = isHovered || isSelected ? POINT_RADIUS_HOVER : POINT_RADIUS;

      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#ef4444' : isHovered ? '#2563eb' : '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#475569';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillText(`${i + 1}`, s.x + r + 4, s.y - 4);
    });
  }

  function formatNum(n) {
    if (Math.abs(n) < 0.001) return '0';
    if (Number.isInteger(n)) return n.toString();
    return n.toFixed(1);
  }

  // ---- Table ----
  function updateTable() {
    const tbody = document.getElementById('terrainTableBody');
    tbody.innerHTML = '';
    points.forEach((p, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><input type="number" value="${p.x}" step="0.1" data-index="${i}" data-field="x"></td>
        <td><input type="number" value="${p.y}" step="0.1" data-index="${i}" data-field="y"></td>
        <td><button class="btn-delete-row" data-index="${i}" title="Delete point">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button></td>`;
      tbody.appendChild(tr);
    });

    // Attach events to inputs
    tbody.querySelectorAll('input[type="number"]').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const field = e.target.dataset.field;
        points[idx][field] = parseFloat(e.target.value) || 0;
        updateStats();
        draw();
      });
    });

    // Attach delete buttons
    tbody.querySelectorAll('.btn-delete-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        points.splice(idx, 1);
        updateTable();
        updateStats();
        draw();
      });
    });
  }

  function addPointFromTable() {
    const lastPt = points.length > 0 ? points[points.length - 1] : { x: 0, y: 0 };
    points.push({ x: lastPt.x + 1, y: lastPt.y });
    updateTable();
    updateStats();
    draw();
  }

  function sortPointsByX() {
    points.sort((a, b) => a.x - b.x);
    updateTable();
    draw();
    if (typeof App !== 'undefined') App.showToast('Points sorted by X coordinate', 'info');
  }

  function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.trim().split('\n');
      let imported = 0;
      lines.forEach(line => {
        // Skip header lines
        if (line.match(/[a-zA-Z]/) && !line.match(/^[\d\s,.\-+]+$/)) return;
        const parts = line.split(/[,\t;]+/).map(s => parseFloat(s.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          points.push({ x: parts[0], y: parts[1] });
          imported++;
        }
      });
      updateTable();
      updateStats();
      fitView();
      if (typeof App !== 'undefined') App.showToast(`Imported ${imported} points from CSV`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ---- Stats ----
  function updateStats() {
    document.getElementById('statPoints').textContent = points.length;
    if (points.length < 2) {
      document.getElementById('statLength').textContent = '--';
      document.getElementById('statHeight').textContent = '--';
      document.getElementById('statAngle').textContent = '--';
      return;
    }
    const sorted = [...points].sort((a, b) => a.x - b.x);
    let totalLen = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalLen += Math.hypot(sorted[i].x - sorted[i - 1].x, sorted[i].y - sorted[i - 1].y);
    }
    const ys = sorted.map(p => p.y);
    const heightDiff = Math.max(...ys) - Math.min(...ys);
    const dx = sorted[sorted.length - 1].x - sorted[0].x;
    const avgAngle = dx > 0 ? Math.atan2(heightDiff, dx) * 180 / Math.PI : 0;

    document.getElementById('statLength').textContent = totalLen.toFixed(2) + ' m';
    document.getElementById('statHeight').textContent = heightDiff.toFixed(2) + ' m';
    document.getElementById('statAngle').textContent = avgAngle.toFixed(1) + '\u00B0';
  }

  function clearAll() {
    points = [];
    selectedPointIndex = -1;
    updateTable();
    updateStats();
    draw();
    if (typeof App !== 'undefined') App.showToast('Terrain profile cleared', 'info');
  }

  function loadSample() {
    // Sample: a typical soil nail slope profile
    points = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 1 },
      { x: 5, y: 4 },
      { x: 6, y: 6 },
      { x: 7, y: 8 },
      { x: 8, y: 9.5 },
      { x: 9, y: 10.5 },
      { x: 10, y: 11 },
      { x: 12, y: 11 },
      { x: 15, y: 11 }
    ];
    updateTable();
    updateStats();
    fitView();
    if (typeof App !== 'undefined') App.showToast('Sample slope profile loaded', 'success');
  }

  // Public API
  function getPoints() {
    return [...points].sort((a, b) => a.x - b.x);
  }

  function getSlopeSegments() {
    // Returns array of { start, end, length, angle } for each segment of the slope face
    const sorted = getPoints();
    const segments = [];
    for (let i = 1; i < sorted.length; i++) {
      const dx = sorted[i].x - sorted[i - 1].x;
      const dy = sorted[i].y - sorted[i - 1].y;
      segments.push({
        start: { x: sorted[i - 1].x, y: sorted[i - 1].y },
        end: { x: sorted[i].x, y: sorted[i].y },
        length: Math.hypot(dx, dy),
        angle: Math.atan2(dy, dx) * 180 / Math.PI
      });
    }
    return segments;
  }

  return { init, getPoints, getSlopeSegments, fitView, draw, resizeCanvas };
})();
