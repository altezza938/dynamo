/* ============================================
   Soil Nail Calculation Module
   Calculates nail placement positions based on
   terrain profile and user parameters.
   ============================================ */

const NailsModule = (() => {

  // Get all parameters from the form
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

  // Find the point on the terrain profile at a given elevation
  function getTerrainXAtElevation(terrainPoints, elevation) {
    // Walk through terrain segments and find where elevation intersects
    for (let i = 0; i < terrainPoints.length - 1; i++) {
      const p1 = terrainPoints[i];
      const p2 = terrainPoints[i + 1];
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      if (elevation >= minY - 0.001 && elevation <= maxY + 0.001) {
        if (Math.abs(p2.y - p1.y) < 0.001) {
          // Horizontal segment at this elevation
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

  // Get the slope face normal direction at a given point (for proper nail insertion angle)
  function getSlopeNormalAtElevation(terrainPoints, elevation) {
    for (let i = 0; i < terrainPoints.length - 1; i++) {
      const p1 = terrainPoints[i];
      const p2 = terrainPoints[i + 1];
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      if (elevation >= minY - 0.001 && elevation <= maxY + 0.001) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const segAngle = Math.atan2(dy, dx);
        return segAngle;
      }
    }
    return Math.PI / 4; // default 45 degree slope
  }

  // Generate the 2D cross-section nail layout
  function generateLayout() {
    const params = getParams();
    const terrainPoints = TerrainModule.getPoints();

    if (terrainPoints.length < 2) {
      return { nails: [], rows: [], error: 'Define at least 2 terrain points first.' };
    }

    // Find the slope face: identify the portion of terrain that is not flat
    // Look for segments with slope angle > 15 degrees
    const ys = terrainPoints.map(p => p.y);
    const minElev = Math.min(...ys);
    const maxElev = Math.max(...ys);
    const slopeHeight = maxElev - minElev;

    if (slopeHeight < 0.5) {
      return { nails: [], rows: [], error: 'Terrain profile is too flat. Need slope height > 0.5m.' };
    }

    // Calculate row elevations
    const firstRowElev = maxElev - params.topOffset;
    const lastRowElev = minElev + params.bottomOffset;

    if (firstRowElev <= lastRowElev) {
      return { nails: [], rows: [], error: 'Top/bottom offsets are too large for this slope height.' };
    }

    const rows = [];
    let elevation = firstRowElev;
    let rowNum = 1;

    while (elevation >= lastRowElev) {
      const faceX = getTerrainXAtElevation(terrainPoints, elevation);
      if (faceX !== null) {
        const slopeAngle = getSlopeNormalAtElevation(terrainPoints, elevation);
        const inclRad = params.inclination * Math.PI / 180;

        // Nail starts at slope face, goes inward (generally into the slope)
        // "Inward" means in the direction away from the exposed face
        // For a slope going up-right, inward is to the left
        const nailStartX = faceX;
        const nailStartY = elevation;

        // Nail direction: horizontal component into slope, angled down by inclination
        // The nail goes into the hillside (negative X direction for a slope rising to the right)
        const nailEndX = nailStartX - params.nailLength * Math.cos(inclRad);
        const nailEndY = nailStartY - params.nailLength * Math.sin(inclRad);

        const row = {
          rowNumber: rowNum,
          elevation: elevation,
          faceX: faceX,
          nailLength: params.nailLength,
          inclination: params.inclination,
          start: { x: nailStartX, y: nailStartY },
          end: { x: nailEndX, y: nailEndY }
        };
        rows.push(row);
      }
      elevation -= params.vSpacing;
      rowNum++;
    }

    // Generate 3D positions (across the wall width)
    const nails3D = [];
    const nailsPerRow = Math.floor(params.wallExtent / params.hSpacing) + 1;
    const startOffset = -(params.wallExtent / 2);

    rows.forEach((row, rowIdx) => {
      for (let col = 0; col < nailsPerRow; col++) {
        let zOffset = startOffset + col * params.hSpacing;
        // Staggered pattern: offset odd rows by half spacing
        if (params.patternType === 'staggered' && rowIdx % 2 === 1) {
          zOffset += params.hSpacing / 2;
        }
        nails3D.push({
          id: `N${row.rowNumber}-${col + 1}`,
          row: row.rowNumber,
          col: col + 1,
          // Head (at slope face)
          headX: row.start.x,
          headY: row.start.y,
          headZ: zOffset,
          // Tip (end of nail)
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

  // Calculate quantities
  function calculateQuantities(layout) {
    if (!layout || layout.error) return null;

    const params = layout.params;
    const totalNails = layout.nails.length;
    const totalDrillLength = totalNails * params.nailLength;

    // Steel weight: pi * r^2 * length * density(7850 kg/m3)
    const barRadius = (params.barDiameter / 1000) / 2;
    const barArea = Math.PI * barRadius * barRadius;
    const steelWeightPerNail = barArea * params.nailLength * 7850;
    const totalSteelWeight = steelWeightPerNail * totalNails;

    // Grout volume: pi * (drillR^2 - barR^2) * length
    const drillRadius = (params.drillDiameter / 1000) / 2;
    const groutAreaPerM = Math.PI * (drillRadius * drillRadius - barRadius * barRadius);
    const groutVolumePerNail = groutAreaPerM * params.nailLength;
    const totalGroutVolume = groutVolumePerNail * totalNails;

    return {
      totalNails,
      totalRows: layout.rows.length,
      nailsPerRow: layout.nailsPerRow,
      totalDrillLength: totalDrillLength,
      totalSteelWeight: totalSteelWeight,
      totalGroutVolume: totalGroutVolume
    };
  }

  return { getParams, generateLayout, calculateQuantities };
})();
