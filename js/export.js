/* ============================================
   Export Module
   Generates output files for Civil 3D, Dynamo,
   AutoCAD, and other formats.
   ============================================ */

const ExportModule = (() => {

  function init() {
    document.getElementById('btnExportCSV').addEventListener('click', exportCSV);
    document.getElementById('btnExportSCR').addEventListener('click', exportSCR);
    document.getElementById('btnExportJSON').addEventListener('click', exportJSON);
    document.getElementById('btnExportDXF').addEventListener('click', exportDXF);
    document.getElementById('btnExportXML').addEventListener('click', exportXML);
    document.getElementById('btnExportReport').addEventListener('click', exportReport);
  }

  function getLayoutOrWarn() {
    const layout = PreviewModule.getLayout();
    if (!layout || layout.error || !layout.nails || layout.nails.length === 0) {
      App.showToast('Generate a nail layout first (Preview tab).', 'warning');
      return null;
    }
    return layout;
  }

  function getProjectInfo() {
    return {
      name: document.getElementById('projectName').value || 'Untitled Project',
      number: document.getElementById('projectNumber').value || '--',
      description: document.getElementById('projectDesc').value || '',
      designer: document.getElementById('designer').value || '',
      checker: document.getElementById('checker').value || '',
      coordSystem: document.getElementById('coordSystem').value,
      unitLength: document.getElementById('unitLength').value,
      baseElevation: parseFloat(document.getElementById('baseElevation').value) || 0,
      baseEasting: parseFloat(document.getElementById('baseEasting').value) || 0,
      baseNorthing: parseFloat(document.getElementById('baseNorthing').value) || 0
    };
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================
  // 1. COGO Points CSV
  // ============================================
  function exportCSV() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();

    let csv = 'PointNumber,Easting,Northing,Elevation,Description,NailLength,Inclination,BarDiameter,Row,Column\n';

    layout.nails.forEach((nail, idx) => {
      const easting = (nail.headX + info.baseEasting).toFixed(4);
      const northing = (nail.headZ + info.baseNorthing).toFixed(4);
      const elevation = (nail.headY + info.baseElevation).toFixed(4);
      const desc = `SOIL_NAIL_${nail.id}`;
      csv += `${idx + 1},${easting},${northing},${elevation},${desc},${nail.length},${nail.inclination},${nail.barDiameter},${nail.row},${nail.col}\n`;
    });

    const filename = `${sanitizeFilename(info.name)}_COGO_Points.csv`;
    downloadFile(csv, filename, 'text/csv');
    App.showToast(`Downloaded ${filename}`, 'success');
  }

  // ============================================
  // 2. AutoCAD Script (.scr)
  // ============================================
  function exportSCR() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();

    let scr = '';
    // Setup
    scr += '-LAYER M SOIL_NAILS C 5 SOIL_NAILS \n';
    scr += '-LAYER M NAIL_HEADS C 1 NAIL_HEADS \n';
    scr += '-LAYER M DRILL_HOLES C 8 DRILL_HOLES \n';
    scr += '\n';

    // Draw each nail as a 3D line
    layout.nails.forEach(nail => {
      const hx = (nail.headX + info.baseEasting).toFixed(4);
      const hy = (nail.headZ + info.baseNorthing).toFixed(4);
      const hz = (nail.headY + info.baseElevation).toFixed(4);
      const tx = (nail.tipX + info.baseEasting).toFixed(4);
      const ty = (nail.tipZ + info.baseNorthing).toFixed(4);
      const tz = (nail.tipY + info.baseElevation).toFixed(4);

      // Nail line
      scr += `-LAYER S SOIL_NAILS \n`;
      scr += `LINE ${hx},${hy},${hz} ${tx},${ty},${tz} \n`;

      // Head plate as point
      scr += `-LAYER S NAIL_HEADS \n`;
      scr += `POINT ${hx},${hy},${hz}\n`;
    });

    scr += 'ZOOM E\n';

    const filename = `${sanitizeFilename(info.name)}_AutoCAD_Script.scr`;
    downloadFile(scr, filename, 'text/plain');
    App.showToast(`Downloaded ${filename}`, 'success');
  }

  // ============================================
  // 3. Dynamo JSON
  // ============================================
  function exportJSON() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();
    const params = NailsModule.getParams();
    const qty = NailsModule.calculateQuantities(layout);

    const dynamoData = {
      metadata: {
        generator: 'SoilNail BIM v1.0',
        project: info.name,
        projectNumber: info.number,
        designer: info.designer,
        date: new Date().toISOString(),
        coordinateSystem: info.coordSystem,
        units: info.unitLength
      },
      parameters: {
        nailLength: params.nailLength,
        inclination: params.inclination,
        barDiameter: params.barDiameter,
        drillDiameter: params.drillDiameter,
        horizontalSpacing: params.hSpacing,
        verticalSpacing: params.vSpacing,
        topOffset: params.topOffset,
        bottomOffset: params.bottomOffset,
        patternType: params.patternType,
        wallExtent: params.wallExtent,
        plateSize: params.plateSize,
        plateThickness: params.plateThickness,
        facingType: params.facingType,
        steelGrade: params.steelGrade,
        groutStrength: params.groutStrength,
        corrosionProtection: params.corrosionProtection,
        centralizers: params.centralizers,
        centralizerSpacing: params.centralizerSpacing
      },
      terrainProfile: TerrainModule.getPoints(),
      offsets: {
        baseEasting: info.baseEasting,
        baseNorthing: info.baseNorthing,
        baseElevation: info.baseElevation
      },
      rows: layout.rows.map(r => ({
        rowNumber: r.rowNumber,
        elevation: r.elevation,
        faceX: r.faceX,
        nailLength: r.nailLength,
        inclination: r.inclination,
        startPoint: r.start,
        endPoint: r.end
      })),
      nails: layout.nails.map(n => ({
        id: n.id,
        row: n.row,
        column: n.col,
        headPoint: {
          x: n.headX + info.baseEasting,
          y: n.headZ + info.baseNorthing,
          z: n.headY + info.baseElevation
        },
        tipPoint: {
          x: n.tipX + info.baseEasting,
          y: n.tipZ + info.baseNorthing,
          z: n.tipY + info.baseElevation
        },
        length: n.length,
        inclination: n.inclination,
        barDiameter: n.barDiameter,
        drillDiameter: n.drillDiameter
      })),
      quantities: qty
    };

    const json = JSON.stringify(dynamoData, null, 2);
    const filename = `${sanitizeFilename(info.name)}_Dynamo_Data.json`;
    downloadFile(json, filename, 'application/json');
    App.showToast(`Downloaded ${filename}`, 'success');
  }

  // ============================================
  // 4. DXF Drawing
  // ============================================
  function exportDXF() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();

    let dxf = '';

    // DXF Header
    dxf += '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$ACADVER\n1\nAC1015\n';
    dxf += '0\nENDSEC\n';

    // Tables section with layers
    dxf += '0\nSECTION\n2\nTABLES\n';
    dxf += '0\nTABLE\n2\nLAYER\n';

    // Soil nails layer (blue)
    dxf += '0\nLAYER\n2\nSOIL_NAILS\n70\n0\n62\n5\n6\nCONTINUOUS\n';
    // Nail heads layer (red)
    dxf += '0\nLAYER\n2\nNAIL_HEADS\n70\n0\n62\n1\n6\nCONTINUOUS\n';
    // Drill holes layer (gray)
    dxf += '0\nLAYER\n2\nDRILL_HOLES\n70\n0\n62\n8\n6\nCONTINUOUS\n';
    // Terrain layer (brown/yellow)
    dxf += '0\nLAYER\n2\nTERRAIN\n70\n0\n62\n40\n6\nCONTINUOUS\n';

    dxf += '0\nENDTAB\n';
    dxf += '0\nENDSEC\n';

    // Entities section
    dxf += '0\nSECTION\n2\nENTITIES\n';

    // Terrain polyline (2D cross-section in XZ plane)
    const terrain = TerrainModule.getPoints();
    if (terrain.length >= 2) {
      terrain.forEach((pt, i) => {
        if (i < terrain.length - 1) {
          const x1 = (pt.x + info.baseEasting).toFixed(4);
          const z1 = (pt.y + info.baseElevation).toFixed(4);
          const x2 = (terrain[i + 1].x + info.baseEasting).toFixed(4);
          const z2 = (terrain[i + 1].y + info.baseElevation).toFixed(4);
          dxf += `0\nLINE\n8\nTERRAIN\n`;
          dxf += `10\n${x1}\n20\n0.0000\n30\n${z1}\n`;
          dxf += `11\n${x2}\n21\n0.0000\n31\n${z2}\n`;
        }
      });
    }

    // Nail lines (3D)
    layout.nails.forEach(nail => {
      const hx = (nail.headX + info.baseEasting).toFixed(4);
      const hy = (nail.headZ + info.baseNorthing).toFixed(4);
      const hz = (nail.headY + info.baseElevation).toFixed(4);
      const tx = (nail.tipX + info.baseEasting).toFixed(4);
      const ty = (nail.tipZ + info.baseNorthing).toFixed(4);
      const tz = (nail.tipY + info.baseElevation).toFixed(4);

      // Nail line
      dxf += `0\nLINE\n8\nSOIL_NAILS\n`;
      dxf += `10\n${hx}\n20\n${hy}\n30\n${hz}\n`;
      dxf += `11\n${tx}\n21\n${ty}\n31\n${tz}\n`;

      // Head point
      dxf += `0\nPOINT\n8\nNAIL_HEADS\n`;
      dxf += `10\n${hx}\n20\n${hy}\n30\n${hz}\n`;
    });

    dxf += '0\nENDSEC\n';
    dxf += '0\nEOF\n';

    const filename = `${sanitizeFilename(info.name)}_SoilNails.dxf`;
    downloadFile(dxf, filename, 'application/dxf');
    App.showToast(`Downloaded ${filename}`, 'success');
  }

  // ============================================
  // 5. LandXML
  // ============================================
  function exportXML() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2">\n';
    xml += `  <Project name="${escapeXML(info.name)}" desc="${escapeXML(info.description)}">\n`;
    xml += `    <Feature name="SoilNailBIM" code="Generator">SoilNail BIM v1.0</Feature>\n`;
    xml += `  </Project>\n`;
    xml += `  <Units>\n    <Metric linearUnit="meter" areaUnit="squareMeter" volumeUnit="cubicMeter" angularUnit="decimal degrees"/>\n  </Units>\n`;

    // CgPoints for nail heads
    xml += '  <CgPoints name="SoilNailHeads">\n';
    layout.nails.forEach((nail, idx) => {
      const n = (nail.headZ + info.baseNorthing).toFixed(4);
      const e = (nail.headX + info.baseEasting).toFixed(4);
      const el = (nail.headY + info.baseElevation).toFixed(4);
      xml += `    <CgPoint name="${nail.id}" pntRef="${idx + 1}" desc="SOIL_NAIL">${n} ${e} ${el}</CgPoint>\n`;
    });
    xml += '  </CgPoints>\n';

    // Terrain surface
    xml += '  <Surfaces>\n    <Surface name="TerrainProfile">\n      <Definition surfType="TIN">\n';
    const terrain = TerrainModule.getPoints();
    xml += '        <Pnts>\n';
    terrain.forEach((pt, i) => {
      xml += `          <P id="${i + 1}">${(pt.y + info.baseElevation).toFixed(4)} ${(pt.x + info.baseEasting).toFixed(4)} 0.0000</P>\n`;
    });
    xml += '        </Pnts>\n        <Faces></Faces>\n';
    xml += '      </Definition>\n    </Surface>\n  </Surfaces>\n';

    xml += '</LandXML>\n';

    const filename = `${sanitizeFilename(info.name)}_LandXML.xml`;
    downloadFile(xml, filename, 'application/xml');
    App.showToast(`Downloaded ${filename}`, 'success');
  }

  // ============================================
  // 6. Summary Report (HTML)
  // ============================================
  function exportReport() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();
    const params = NailsModule.getParams();
    const qty = NailsModule.calculateQuantities(layout);

    // Capture the preview canvas as image
    const canvasImg = document.getElementById('previewCanvas').toDataURL('image/png');

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Soil Nail Report - ${escapeHTML(info.name)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1e293b; max-width: 900px; margin: 0 auto; padding: 2rem; }
  h1 { font-size: 1.8rem; border-bottom: 3px solid #3b82f6; padding-bottom: 0.5rem; }
  h2 { font-size: 1.2rem; color: #3b82f6; margin-top: 2rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
  th, td { padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem 2rem; }
  .info-label { font-weight: 600; color: #64748b; }
  .cross-section { width: 100%; margin: 1rem 0; border: 1px solid #e2e8f0; border-radius: 4px; }
  .footer { margin-top: 2rem; font-size: 0.8rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 0.5rem; }
  @media print { body { padding: 1rem; } }
</style>
</head>
<body>
<h1>Soil Nail Design Report</h1>

<h2>Project Information</h2>
<div class="info-grid">
  <div><span class="info-label">Project Name:</span> ${escapeHTML(info.name)}</div>
  <div><span class="info-label">Project Number:</span> ${escapeHTML(info.number)}</div>
  <div><span class="info-label">Designer:</span> ${escapeHTML(info.designer)}</div>
  <div><span class="info-label">Checker:</span> ${escapeHTML(info.checker)}</div>
  <div><span class="info-label">Coordinate System:</span> ${info.coordSystem}</div>
  <div><span class="info-label">Date:</span> ${new Date().toLocaleDateString()}</div>
</div>
${info.description ? `<p>${escapeHTML(info.description)}</p>` : ''}

<h2>Design Parameters</h2>
<table>
  <tr><th>Parameter</th><th>Value</th><th>Parameter</th><th>Value</th></tr>
  <tr><td>Nail Length</td><td>${params.nailLength} m</td><td>Bar Diameter</td><td>${params.barDiameter} mm</td></tr>
  <tr><td>Inclination</td><td>${params.inclination}&deg;</td><td>Drill Hole Diameter</td><td>${params.drillDiameter} mm</td></tr>
  <tr><td>Horizontal Spacing</td><td>${params.hSpacing} m</td><td>Vertical Spacing</td><td>${params.vSpacing} m</td></tr>
  <tr><td>Top Offset</td><td>${params.topOffset} m</td><td>Bottom Offset</td><td>${params.bottomOffset} m</td></tr>
  <tr><td>Pattern</td><td>${params.patternType}</td><td>Wall Extent</td><td>${params.wallExtent} m</td></tr>
  <tr><td>Plate Size</td><td>${params.plateSize} x ${params.plateSize} mm</td><td>Plate Thickness</td><td>${params.plateThickness} mm</td></tr>
  <tr><td>Steel Grade</td><td>${params.steelGrade} MPa</td><td>Grout Strength</td><td>${params.groutStrength} MPa</td></tr>
  <tr><td>Corrosion Protection</td><td>${params.corrosionProtection}</td><td>Facing</td><td>${params.facingType}</td></tr>
</table>

<h2>Cross-Section</h2>
<img class="cross-section" src="${canvasImg}" alt="Cross-section preview">

<h2>Quantities Summary</h2>
<table>
  <tr><th>Item</th><th>Quantity</th></tr>
  <tr><td>Number of Rows</td><td>${qty.totalRows}</td></tr>
  <tr><td>Nails per Row</td><td>${qty.nailsPerRow}</td></tr>
  <tr><td>Total Nails</td><td>${qty.totalNails}</td></tr>
  <tr><td>Total Drill Length</td><td>${qty.totalDrillLength.toFixed(1)} m</td></tr>
  <tr><td>Total Steel Weight (est.)</td><td>${(qty.totalSteelWeight / 1000).toFixed(2)} tonnes</td></tr>
  <tr><td>Total Grout Volume (est.)</td><td>${qty.totalGroutVolume.toFixed(2)} m&sup3;</td></tr>
</table>

<h2>Row Schedule</h2>
<table>
  <tr><th>Row</th><th>Elevation (m)</th><th>Nail Length (m)</th><th>Inclination</th></tr>
  ${layout.rows.map(r => `<tr><td>${r.rowNumber}</td><td>${r.elevation.toFixed(2)}</td><td>${r.nailLength.toFixed(1)}</td><td>${r.inclination}&deg;</td></tr>`).join('\n  ')}
</table>

<div class="footer">
  Generated by SoilNail BIM v1.0 on ${new Date().toLocaleString()}
</div>
</body>
</html>`;

    const filename = `${sanitizeFilename(info.name)}_Report.html`;
    downloadFile(html, filename, 'text/html');
    App.showToast(`Downloaded ${filename}`, 'success');
  }

  // ---- Utilities ----
  function sanitizeFilename(name) {
    return (name || 'SoilNail_Project').replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 60);
  }

  function escapeXML(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeHTML(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  return { init };
})();
