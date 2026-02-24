/* ============================================
   Soil Nail Calculation Module v3.0
   Nail placement, quantities, diagram, and
   GEO prescriptive design per GEOguide 7 and
   GEO Publication No. 1/2009.
   ============================================ */

const NailsModule = (() => {
  let diagramCanvas, diagramCtx;

  // ---- GEO Prescriptive Design Tables ----
  // Based on GEOguide 7 (2008), GEO Publication No. 1/2009,
  // and GEO Report No. 175 (Soil Nail Head Review)
  const GEO_PRESCRIPTIVE = {
    // Prescriptive nail design for soil cut slopes
    // Slope height ranges -> recommended parameters
    heightRanges: [
      { maxH: 3,  minRows: 2, barDia: 25, nailLength: 3,  drillDia: 100, plateSize: 200, plateThk: 15 },
      { maxH: 5,  minRows: 3, barDia: 25, nailLength: 4,  drillDia: 100, plateSize: 200, plateThk: 15 },
      { maxH: 7,  minRows: 4, barDia: 25, nailLength: 6,  drillDia: 100, plateSize: 200, plateThk: 20 },
      { maxH: 10, minRows: 5, barDia: 32, nailLength: 8,  drillDia: 115, plateSize: 250, plateThk: 20 },
      { maxH: 15, minRows: 7, barDia: 32, nailLength: 12, drillDia: 115, plateSize: 300, plateThk: 20 },
      { maxH: 20, minRows: 9, barDia: 40, nailLength: 16, drillDia: 150, plateSize: 300, plateThk: 25 }
    ],
    // Standard parameters (GEOguide 7 recommended)
    defaults: {
      inclination: 15,        // 10-20° below horizontal, 15° standard
      hSpacing: 1.5,          // 1.0-2.0m, 1.5m standard
      vSpacing: 1.5,          // 1.0-2.0m, 1.5m standard
      topOffset: 0.5,         // 0.5-1.0m from crest
      bottomOffset: 0.5,      // 0.3-0.5m from toe
      steelGrade: 500,        // Grade 500 high yield deformed bar
      groutStrength: 30,      // ≥20 MPa, typically 25-30 MPa
      centralizerSpacing: 1.0, // 1.0-2.0m
      corrosionProtection: 'class2', // Class II for permanent works
      facingType: 'shotcrete',       // Hard or soft facing
      patternType: 'staggered'       // Staggered preferred per GEO
    },
    // Prescriptive design limits
    limits: {
      maxSlopeHeight: 20,     // m, beyond this requires full analysis
      maxSlopeAngle: 70,      // degrees, prescriptive limit
      prescriptiveAngle: 55,  // degrees, standard prescriptive angle
      minNailLength: 3,       // m
      maxNailLength: 20,      // m
      minSpacing: 1.0,        // m
      maxSpacing: 2.0,        // m
      minInclination: 5,      // degrees
      maxInclination: 25,     // degrees (>20° not recommended)
      minDrillHole: 75,       // mm
      maxDrillHole: 200,      // mm
      minBarDia: 20,          // mm
      maxBarDia: 40           // mm
    }
  };

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

      // Auto-design button
      const btnAutoDesign = document.getElementById('btnAutoDesign');
      if (btnAutoDesign) {
        btnAutoDesign.addEventListener('click', applyPrescriptiveDesign);
      }

      window.addEventListener('resize', resizeDiagram);
      setTimeout(drawDiagram, 200);
    }
  }

  // ---- GEO Prescriptive Design Functions ----

  function getPrescriptiveParams(slopeHeight) {
    const ranges = GEO_PRESCRIPTIVE.heightRanges;
    let match = ranges[ranges.length - 1]; // default to largest
    for (const range of ranges) {
      if (slopeHeight <= range.maxH) {
        match = range;
        break;
      }
    }
    return {
      ...GEO_PRESCRIPTIVE.defaults,
      nailLength: match.nailLength,
      barDiameter: match.barDia,
      drillDiameter: match.drillDia,
      plateSize: match.plateSize,
      plateThickness: match.plateThk,
      minRows: match.minRows
    };
  }

  function applyPrescriptiveDesign() {
    const terrainPoints = TerrainModule.getPoints();
    if (terrainPoints.length < 2) {
      if (typeof App !== 'undefined') App.showToast('Define terrain profile first to use auto-design.', 'warning');
      return;
    }

    const ys = terrainPoints.map(p => p.y);
    const slopeHeight = Math.max(...ys) - Math.min(...ys);

    if (slopeHeight < 0.5) {
      if (typeof App !== 'undefined') App.showToast('Terrain is too flat for soil nail design.', 'warning');
      return;
    }

    // Calculate slope angle from terrain
    const sorted = [...terrainPoints].sort((a, b) => a.x - b.x);
    const slopeSegments = TerrainModule.getSlopeSegments();
    let maxSegAngle = 0;
    slopeSegments.forEach(seg => {
      const absAngle = Math.abs(seg.angle);
      if (absAngle > maxSegAngle) maxSegAngle = absAngle;
    });

    const prescriptive = getPrescriptiveParams(slopeHeight);

    // Adjust nail length for steep slopes (>55°): increase by ~20%
    let adjustedLength = prescriptive.nailLength;
    if (maxSegAngle > 55) {
      adjustedLength = Math.ceil(prescriptive.nailLength * 1.2);
    }

    // Apply to form fields
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) { el.value = val; el.dispatchEvent(new Event('input')); }
    };

    setVal('nailLength', adjustedLength);
    setVal('nailInclination', prescriptive.inclination);
    setVal('barDiameter', prescriptive.barDiameter);
    setVal('drillDiameter', prescriptive.drillDiameter);
    setVal('hSpacing', prescriptive.hSpacing);
    setVal('vSpacing', prescriptive.vSpacing);
    setVal('topOffset', prescriptive.topOffset);
    setVal('bottomOffset', prescriptive.bottomOffset);
    setVal('plateSize', prescriptive.plateSize);
    setVal('plateThickness', prescriptive.plateThickness);
    setVal('steelGrade', prescriptive.steelGrade);
    setVal('groutStrength', prescriptive.groutStrength);
    setVal('patternType', prescriptive.patternType);
    setVal('centralizerSpacing', prescriptive.centralizerSpacing);
    setVal('corrosionProtection', prescriptive.corrosionProtection);

    // Enable centralizers
    const centralEl = document.getElementById('centralizers');
    if (centralEl && !centralEl.checked) centralEl.click();

    // Show info
    const warnings = [];
    if (slopeHeight > GEO_PRESCRIPTIVE.limits.maxSlopeHeight) {
      warnings.push(`Slope height ${slopeHeight.toFixed(1)}m exceeds prescriptive limit of ${GEO_PRESCRIPTIVE.limits.maxSlopeHeight}m. Full geotechnical analysis required.`);
    }
    if (maxSegAngle > GEO_PRESCRIPTIVE.limits.maxSlopeAngle) {
      warnings.push(`Max slope angle ${maxSegAngle.toFixed(0)}° exceeds ${GEO_PRESCRIPTIVE.limits.maxSlopeAngle}° limit.`);
    }

    updateValidationDisplay(warnings);

    const msg = `GEO prescriptive design applied: H=${slopeHeight.toFixed(1)}m → L=${adjustedLength}m, T${prescriptive.barDiameter}, Ø${prescriptive.drillDiameter}mm drill`;
    if (typeof App !== 'undefined') App.showToast(msg, 'success');

    drawDiagram();
  }

  function validateDesign(params, slopeHeight) {
    const limits = GEO_PRESCRIPTIVE.limits;
    const warnings = [];

    // Check nail length vs slope height ratio
    const lhRatio = params.nailLength / slopeHeight;
    if (lhRatio < 0.6) {
      warnings.push(`Nail length/slope height ratio (${lhRatio.toFixed(2)}) is below recommended minimum of 0.6. Consider longer nails per GEOguide 7.`);
    }
    if (lhRatio > 1.5) {
      warnings.push(`Nail length/slope height ratio (${lhRatio.toFixed(2)}) exceeds typical range. Nails may be unnecessarily long.`);
    }

    // Spacing checks
    if (params.hSpacing < limits.minSpacing || params.hSpacing > limits.maxSpacing) {
      warnings.push(`Horizontal spacing ${params.hSpacing}m is outside recommended range (${limits.minSpacing}-${limits.maxSpacing}m) per GEOguide 7.`);
    }
    if (params.vSpacing < limits.minSpacing || params.vSpacing > limits.maxSpacing) {
      warnings.push(`Vertical spacing ${params.vSpacing}m is outside recommended range (${limits.minSpacing}-${limits.maxSpacing}m) per GEOguide 7.`);
    }

    // Inclination check
    if (params.inclination < limits.minInclination) {
      warnings.push(`Inclination ${params.inclination}° is below recommended minimum of ${limits.minInclination}°.`);
    }
    if (params.inclination > 20) {
      warnings.push(`Inclination ${params.inclination}° exceeds recommended 20° per GEOguide 7 Cl. 3.4.`);
    }

    // Drill hole vs bar diameter
    const drillBarRatio = params.drillDiameter / params.barDiameter;
    if (drillBarRatio < 2.5) {
      warnings.push(`Drill hole/bar diameter ratio (${drillBarRatio.toFixed(1)}) is low. Minimum annulus required for proper grout encapsulation per GEOguide 7.`);
    }

    // Grout strength
    if (params.groutStrength < 20) {
      warnings.push(`Grout strength ${params.groutStrength} MPa is below minimum 20 MPa per GEOguide 7 Cl. 4.3.`);
    }

    // Slope height check
    if (slopeHeight > limits.maxSlopeHeight) {
      warnings.push(`Slope height ${slopeHeight.toFixed(1)}m exceeds prescriptive design limit of ${limits.maxSlopeHeight}m. Full geotechnical analysis is required.`);
    }

    return warnings;
  }

  function updateValidationDisplay(warnings) {
    const container = document.getElementById('geoValidationWarnings');
    if (!container) return;

    if (warnings.length === 0) {
      container.innerHTML = '<div class="geo-validation-ok">Design parameters are within GEO recommended ranges.</div>';
      container.classList.remove('has-warnings');
    } else {
      container.innerHTML = warnings.map(w =>
        `<div class="geo-validation-warning"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${w}</div>`
      ).join('');
      container.classList.add('has-warnings');
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

    // Validate design against GEO guidelines
    const designWarnings = validateDesign(params, slopeHeight);
    updateValidationDisplay(designWarnings);

    return {
      nails: nails3D,
      rows: rows,
      nailsPerRow: nailsPerRow,
      params: params,
      slopeHeight: slopeHeight,
      warnings: designWarnings,
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

  return { init, getParams, generateLayout, calculateQuantities, drawDiagram, applyPrescriptiveDesign, getPrescriptiveParams, validateDesign, GEO_PRESCRIPTIVE };
})();
