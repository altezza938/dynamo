/* ============================================
   Soil Nail Calculation Module v2.0
   Nail placement, quantities, and diagram.
   ============================================ */

const NailsModule = (() => {
  let diagramCanvas, diagramCtx;

  function init() {
    diagramCanvas = document.getElementById('nailDiagramCanvas');
    if (diagramCanvas) {
      diagramCtx = diagramCanvas.getContext('2d');
      // Redraw diagram when params change
      const paramInputs = [
        'nailLength', 'nailInclination', 'barDiameter', 'drillDiameter',
        'hSpacing', 'vSpacing', 'plateSize', 'plateThickness'
      ];
      paramInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', drawDiagram);
      });

      window.addEventListener('resize', resizeDiagram);
      setTimeout(drawDiagram, 200);
    }
  }

  function getParams() {
    return {
      nailLength: parseFloat(document.getElementById('nailLength').value) || 6,
      inclination: parseFloat(document.getElementById('nailInclination').value) || 15,
      barDiameter: parseInt(document.getElementById('barDiameter').value) || 25,
      drillDiameter: parseInt(document.getElementById('drillDiameter').value) || 100,
      hSpacing: parseFloat(document.getElementById('hSpacing').value) || 1.5,
      vSpacing: parseFloat(document.getElementById('vSpacing').value) || 1.5,
      topOffset: parseFloat(document.getElementById('topOffset').value) || 0.5,
      bottomOffset: parseFloat(document.getElementById('bottomOffset').value) || 0.5,
      patternType: document.getElementById('patternType').value || 'rectangular',
      wallExtent: parseFloat(document.getElementById('wallExtent').value) || 10,
      plateSize: parseInt(document.getElementById('plateSize').value) || 200,
      plateThickness: parseInt(document.getElementById('plateThickness').value) || 15,
      facingType: document.getElementById('facingType').value || 'shotcrete',
      steelGrade: parseInt(document.getElementById('steelGrade').value) || 500,
      groutStrength: parseFloat(document.getElementById('groutStrength').value) || 30,
      corrosionProtection: document.getElementById('corrosionProtection').value || 'encapsulated',
      centralizers: document.getElementById('centralizers').checked,
      centralizerSpacing: parseFloat(document.getElementById('centralizerSpacing').value) || 1.0,
      variableLength: document.getElementById('variableLength').checked
    };
  }

  function getTerrainXAtElevation(terrainPoints, elevation) {
    for (let i = 0; i < terrainPoints.length - 1; i++) {
      const p1 = terrainPoints[i];
      const p2 = terrainPoints[i + 1];
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      if (elevation >= minY - 0.001 && elevation <= maxY + 0.001) {
        if (Math.abs(p2.y - p1.y) < 0.001) {
          return (p1.x + p2.x) / 2;
        }
        const t = (elevation - p1.y) / (p2.y - p1.y);
        if (t >= -0.001 && t <= 1.001) {
          return p1.x + t * (p2.x - p1.x);
        }
      }
    }
    return null;
  }

  function getSlopeNormalAtElevation(terrainPoints, elevation) {
    for (let i = 0; i < terrainPoints.length - 1; i++) {
      const p1 = terrainPoints[i];
      const p2 = terrainPoints[i + 1];
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      if (elevation >= minY - 0.001 && elevation <= maxY + 0.001) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.atan2(dy, dx);
      }
    }
    return Math.PI / 4;
  }

  function generateLayout() {
    const params = getParams();
    const terrainPoints = TerrainModule.getPoints();

    if (terrainPoints.length < 2) {
      return { nails: [], rows: [], error: 'Define at least 2 terrain points first.' };
    }

    const ys = terrainPoints.map(p => p.y);
    const minElev = Math.min(...ys);
    const maxElev = Math.max(...ys);
    const slopeHeight = maxElev - minElev;

    if (slopeHeight < 0.5) {
      return { nails: [], rows: [], error: 'Terrain profile is too flat. Need slope height > 0.5m.' };
    }

    const firstRowElev = maxElev - params.topOffset;
    const lastRowElev = minElev + params.bottomOffset;

    if (firstRowElev <= lastRowElev) {
      return { nails: [], rows: [], error: 'Top/bottom offsets are too large for this slope height.' };
    }

    // Determine which direction is "into the ground"
    // If the highest terrain point has greater X than the lowest, the slope
    // goes up-right and nails must go in the +X direction (into the hillside)
    const sortedByElev = [...terrainPoints].sort((a, b) => a.y - b.y);
    const lowestPt = sortedByElev[0];
    const highestPt = sortedByElev[sortedByElev.length - 1];
    const groundDirX = (highestPt.x >= lowestPt.x) ? 1 : -1;

    const rows = [];
    let elevation = firstRowElev;
    let rowNum = 1;

    while (elevation >= lastRowElev) {
      const faceX = getTerrainXAtElevation(terrainPoints, elevation);
      if (faceX !== null) {
        const inclRad = params.inclination * Math.PI / 180;

        const nailStartX = faceX;
        const nailStartY = elevation;
        const nailEndX = nailStartX + groundDirX * params.nailLength * Math.cos(inclRad);
        const nailEndY = nailStartY - params.nailLength * Math.sin(inclRad);

        rows.push({
          rowNumber: rowNum,
          elevation: elevation,
          faceX: faceX,
          nailLength: params.nailLength,
          inclination: params.inclination,
          start: { x: nailStartX, y: nailStartY },
          end: { x: nailEndX, y: nailEndY }
        });
      }
      elevation -= params.vSpacing;
      rowNum++;
    }

    // Generate 3D positions
    const nails3D = [];
    const nailsPerRow = Math.floor(params.wallExtent / params.hSpacing) + 1;
    const startOffset = -(params.wallExtent / 2);

    rows.forEach((row, rowIdx) => {
      for (let col = 0; col < nailsPerRow; col++) {
        let zOffset = startOffset + col * params.hSpacing;
        if (params.patternType === 'staggered' && rowIdx % 2 === 1) {
          zOffset += params.hSpacing / 2;
        }
        nails3D.push({
          id: `N${row.rowNumber}-${col + 1}`,
          row: row.rowNumber,
          col: col + 1,
          headX: row.start.x,
          headY: row.start.y,
          headZ: zOffset,
          tipX: row.end.x,
          tipY: row.end.y,
          tipZ: zOffset,
          length: row.nailLength,
          inclination: row.inclination,
          elevation: row.elevation,
          barDiameter: params.barDiameter,
          drillDiameter: params.drillDiameter
        });
      }
    });

    return {
      nails: nails3D,
      rows: rows,
      nailsPerRow: nailsPerRow,
      params: params,
      error: null
    };
  }

  function calculateQuantities(layout) {
    if (!layout || layout.error) return null;

    const params = layout.params;
    const totalNails = layout.nails.length;
    const totalDrillLength = totalNails * params.nailLength;

    const barRadius = (params.barDiameter / 1000) / 2;
    const barArea = Math.PI * barRadius * barRadius;
    const steelWeightPerNail = barArea * params.nailLength * 7850;
    const totalSteelWeight = steelWeightPerNail * totalNails;

    const drillRadius = (params.drillDiameter / 1000) / 2;
    const groutAreaPerM = Math.PI * (drillRadius * drillRadius - barRadius * barRadius);
    const groutVolumePerNail = groutAreaPerM * params.nailLength;
    const totalGroutVolume = groutVolumePerNail * totalNails;

    return {
      totalNails,
      totalRows: layout.rows.length,
      nailsPerRow: layout.nailsPerRow,
      totalDrillLength,
      totalSteelWeight,
      totalGroutVolume
    };
  }

  // ---- Nail Diagram ----
  function resizeDiagram() {
    if (!diagramCanvas) return;
    const card = diagramCanvas.parentElement;
    const rect = card.getBoundingClientRect();
    diagramCanvas.width = rect.width - 48; // account for card padding
    diagramCanvas.height = 180;
    drawDiagram();
  }

  function drawDiagram() {
    if (!diagramCanvas || !diagramCtx) {
      diagramCanvas = document.getElementById('nailDiagramCanvas');
      if (!diagramCanvas) return;
      diagramCtx = diagramCanvas.getContext('2d');
    }

    // Resize to fit container
    const card = diagramCanvas.parentElement;
    if (card) {
      const rect = card.getBoundingClientRect();
      const newW = Math.max(300, rect.width - 48);
      if (Math.abs(diagramCanvas.width - newW) > 10) {
        diagramCanvas.width = newW;
        diagramCanvas.height = 180;
      }
    }

    const params = getParams();
    const ctx = diagramCtx;
    const w = diagramCanvas.width;
    const h = diagramCanvas.height;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = isDark ? '#141828' : '#fefefe';
    ctx.fillRect(0, 0, w, h);

    const centerY = h / 2;
    const leftX = 60;
    const nailPixelLength = Math.min(w - 140, 500);
    const rightX = leftX + nailPixelLength;
    const inclRad = params.inclination * Math.PI / 180;

    // Nail end point (angled down)
    const endX = rightX;
    const endY = centerY + Math.tan(inclRad) * nailPixelLength;

    // Drill hole (wider background)
    ctx.beginPath();
    ctx.moveTo(leftX, centerY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = isDark ? 'rgba(163,163,163,0.2)' : 'rgba(163,163,163,0.3)';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Grout fill
    ctx.beginPath();
    ctx.moveTo(leftX, centerY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.12)';
    ctx.lineWidth = 16;
    ctx.stroke();

    // Steel bar
    ctx.beginPath();
    ctx.moveTo(leftX, centerY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Head plate
    const plateSize = 22;
    ctx.beginPath();
    ctx.rect(leftX - plateSize / 2, centerY - plateSize / 2, plateSize, plateSize);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = isDark ? '#1a1f35' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Centralizer marks
    if (params.centralizers) {
      const nailLenPixels = Math.hypot(endX - leftX, endY - centerY);
      const spacingPixels = (params.centralizerSpacing / params.nailLength) * nailLenPixels;
      const dx = (endX - leftX) / nailLenPixels;
      const dy = (endY - centerY) / nailLenPixels;
      for (let d = spacingPixels; d < nailLenPixels - 10; d += spacingPixels) {
        const cx = leftX + dx * d;
        const cy = centerY + dy * d;
        const nx = -dy, ny = dx;
        ctx.beginPath();
        ctx.moveTo(cx + nx * 10, cy + ny * 10);
        ctx.lineTo(cx - nx * 10, cy - ny * 10);
        ctx.strokeStyle = isDark ? '#64748b' : '#94a3b8';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    // Labels
    ctx.font = '600 11px Inter, -apple-system, sans-serif';
    ctx.fillStyle = isDark ? '#94a3b8' : '#475569';

    // Length label
    const midX = (leftX + endX) / 2;
    const midY = (centerY + endY) / 2;
    ctx.fillText(`L = ${params.nailLength}m`, midX - 20, midY - 16);

    // Angle label
    ctx.fillText(`${params.inclination}\u00B0`, leftX + 40, centerY - 8);

    // Angle arc
    ctx.beginPath();
    ctx.arc(leftX, centerY, 30, 0, inclRad, false);
    ctx.strokeStyle = isDark ? '#64748b' : '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Horizontal reference line (dashed)
    ctx.beginPath();
    ctx.moveTo(leftX, centerY);
    ctx.lineTo(leftX + 50, centerY);
    ctx.strokeStyle = isDark ? '#4a5568' : '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Component labels on the right
    const labelX = endX + 20;
    ctx.font = '500 10px Inter, -apple-system, sans-serif';

    const labels = [
      { color: '#ef4444', text: `Head plate ${params.plateSize}x${params.plateSize}x${params.plateThickness}mm` },
      { color: '#3b82f6', text: `Steel bar \u00D8${params.barDiameter}mm` },
      { color: isDark ? '#6b7280' : '#a3a3a3', text: `Drill hole \u00D8${params.drillDiameter}mm` },
    ];

    labels.forEach((label, i) => {
      const ly = 20 + i * 22;
      ctx.fillStyle = label.color;
      ctx.fillRect(labelX, ly - 4, 10, 10);
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.fillText(label.text, labelX + 16, ly + 5);
    });
  }

  return { init, getParams, generateLayout, calculateQuantities, drawDiagram };
})();
