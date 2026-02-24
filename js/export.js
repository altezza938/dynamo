/* ============================================
   Export Module v2.0
   Generates BIM files: IFC (Revit), Dynamo .dyn,
   Dynamo JSON, DXF, AutoCAD Script, LandXML,
   CSV, and Summary Report.
   ============================================ */

const ExportModule = (() => {

  function init() {
    document.getElementById('btnExportIFC').addEventListener('click', exportIFC);
    document.getElementById('btnExportDYN').addEventListener('click', exportDYN);
    document.getElementById('btnExportJSON').addEventListener('click', exportJSON);
    document.getElementById('btnExportCSV').addEventListener('click', exportCSV);
    document.getElementById('btnExportSCR').addEventListener('click', exportSCR);
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
  // 1. IFC Export (for Revit)
  // ============================================
  function exportIFC() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();
    const params = NailsModule.getParams();

    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const projectGUID = generateIFCGUID();
    const siteGUID = generateIFCGUID();
    const buildingGUID = generateIFCGUID();
    const storeyGUID = generateIFCGUID();
    const ownerGUID = generateIFCGUID();
    const contextGUID = generateIFCGUID();
    const repContextGUID = generateIFCGUID();

    let lineNum = 1;
    const lines = [];
    const ids = {};

    function addLine(content) {
      const id = `#${lineNum}`;
      lines.push(`${id}=${content}`);
      lineNum++;
      return id;
    }

    // HEADER
    let ifc = '';
    ifc += 'ISO-10303-21;\n';
    ifc += 'HEADER;\n';
    ifc += `FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\n`;
    ifc += `FILE_NAME('${sanitizeFilename(info.name)}_SoilNails.ifc','${timestamp}',('${escapeIFC(info.designer)}'),('SoilNail BIM'),'SoilNail BIM v2.0','SoilNail BIM','');\n`;
    ifc += `FILE_SCHEMA(('IFC2X3'));\n`;
    ifc += 'ENDSEC;\n\n';
    ifc += 'DATA;\n';

    // Owner History
    const personId = addLine(`IFCPERSON($,$,'${escapeIFC(info.designer)}',$,$,$,$,$)`);
    const orgId = addLine(`IFCORGANIZATION($,'SoilNail BIM',$,$,$)`);
    const personOrgId = addLine(`IFCPERSONANDORGANIZATION(${personId},${orgId},$)`);
    const appId = addLine(`IFCAPPLICATION(${orgId},'2.0','SoilNail BIM','SoilNailBIM')`);
    const ownerHistoryId = addLine(`IFCOWNERHISTORY(${personOrgId},${appId},$,.NOCHANGE.,$,${personOrgId},${appId},${Math.floor(Date.now() / 1000)})`);

    // Units
    const dimExpId = addLine(`IFCDIMENSIONALEXPONENTS(0,0,0,0,0,0,0)`);
    const siLengthId = addLine(`IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
    const siAreaId = addLine(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`);
    const siVolId = addLine(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`);
    const siAngleId = addLine(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`);
    const degConvId = addLine(`IFCMEASUREWITHUNIT(IFCPLANEANGLEMEASURE(0.0174532925199),${siAngleId})`);
    const degUnitId = addLine(`IFCCONVERSIONBASEDUNIT(${dimExpId},.PLANEANGLEUNIT.,'DEGREE',${degConvId})`);
    const unitAssignId = addLine(`IFCUNITASSIGNMENT((${siLengthId},${siAreaId},${siVolId},${degUnitId}))`);

    // Geometric context
    const originId = addLine(`IFCCARTESIANPOINT((0.,0.,0.))`);
    const dirZId = addLine(`IFCDIRECTION((0.,0.,1.))`);
    const dirXId = addLine(`IFCDIRECTION((1.,0.,0.))`);
    const dirYId = addLine(`IFCDIRECTION((0.,1.,0.))`);
    const axis2d3dId = addLine(`IFCAXIS2PLACEMENT3D(${originId},${dirZId},${dirXId})`);
    const contextId = addLine(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${axis2d3dId},$)`);
    const bodyContextId = addLine(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${contextId},$,.MODEL_VIEW.,$)`);

    // Project
    const projectId = addLine(`IFCPROJECT('${projectGUID}',${ownerHistoryId},'${escapeIFC(info.name)}','${escapeIFC(info.description)}',$,$,$,(${contextId}),${unitAssignId})`);

    // Site
    const sitePlacementId = addLine(`IFCLOCALPLACEMENT($,${axis2d3dId})`);
    const siteId = addLine(`IFCSITE('${siteGUID}',${ownerHistoryId},'Site',$,$,${sitePlacementId},$,$,.ELEMENT.,$,$,$,$,$)`);

    // Building
    const buildingPlacementId = addLine(`IFCLOCALPLACEMENT(${sitePlacementId},${axis2d3dId})`);
    const buildingId = addLine(`IFCBUILDING('${buildingGUID}',${ownerHistoryId},'Soil Nail Wall',$,$,${buildingPlacementId},$,$,.ELEMENT.,$,$,$)`);

    // Storey
    const storeyPlacementId = addLine(`IFCLOCALPLACEMENT(${buildingPlacementId},${axis2d3dId})`);
    const storeyId = addLine(`IFCBUILDINGSTOREY('${storeyGUID}',${ownerHistoryId},'Ground Level',$,$,${storeyPlacementId},$,$,.ELEMENT.,0.)`);

    // Spatial structure
    const relSiteId = addLine(`IFCRELAGGREGATES('${generateIFCGUID()}',${ownerHistoryId},$,$,${projectId},(${siteId}))`);
    const relBuildingId = addLine(`IFCRELAGGREGATES('${generateIFCGUID()}',${ownerHistoryId},$,$,${siteId},(${buildingId}))`);
    const relStoreyId = addLine(`IFCRELAGGREGATES('${generateIFCGUID()}',${ownerHistoryId},$,$,${buildingId},(${storeyId}))`);

    // Circle profile for nails
    const barRadiusM = params.barDiameter / 2000;
    const circProfileId = addLine(`IFCCIRCLEPROFILEDEF(.AREA.,$,$,${barRadiusM})`);

    // Material
    const materialId = addLine(`IFCMATERIAL('Steel Grade ${params.steelGrade}')`);

    // Create each nail as an IfcMember
    const nailIds = [];
    layout.nails.forEach((nail) => {
      const hx = (nail.headX + info.baseEasting);
      const hy = (nail.headZ + info.baseNorthing);
      const hz = (nail.headY + info.baseElevation);

      const tx = (nail.tipX + info.baseEasting);
      const ty = (nail.tipZ + info.baseNorthing);
      const tz = (nail.tipY + info.baseElevation);

      // Direction vector
      const dx = tx - hx;
      const dy = ty - hy;
      const dz = tz - hz;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const ndx = dx / length;
      const ndy = dy / length;
      const ndz = dz / length;

      // Nail position
      const nailPtId = addLine(`IFCCARTESIANPOINT((${hx.toFixed(6)},${hy.toFixed(6)},${hz.toFixed(6)}))`);
      const nailDirId = addLine(`IFCDIRECTION((${ndx.toFixed(6)},${ndy.toFixed(6)},${ndz.toFixed(6)}))`);

      // Reference direction (perpendicular)
      let refX, refY, refZ;
      if (Math.abs(ndx) < 0.9) {
        refX = 0; refY = -ndz; refZ = ndy;
      } else {
        refX = -ndz; refY = 0; refZ = ndx;
      }
      const refLen = Math.sqrt(refX * refX + refY * refY + refZ * refZ) || 1;
      const refDirId = addLine(`IFCDIRECTION((${(refX / refLen).toFixed(6)},${(refY / refLen).toFixed(6)},${(refZ / refLen).toFixed(6)}))`);

      const nailAxisId = addLine(`IFCAXIS2PLACEMENT3D(${nailPtId},${nailDirId},${refDirId})`);
      const nailPlacementId = addLine(`IFCLOCALPLACEMENT(${storeyPlacementId},${nailAxisId})`);

      // Extruded solid
      const profilePlacementId = addLine(`IFCAXIS2PLACEMENT2D(${addLine(`IFCCARTESIANPOINT((0.,0.))`)},${addLine(`IFCDIRECTION((1.,0.))`)})`);
      const circProfileLocalId = addLine(`IFCCIRCLEPROFILEDEF(.AREA.,$,${profilePlacementId},${barRadiusM})`);
      const extrudeDirId = addLine(`IFCDIRECTION((0.,0.,1.))`);
      const solidId = addLine(`IFCEXTRUDEDAREASOLID(${circProfileLocalId},${axis2d3dId},${extrudeDirId},${length.toFixed(6)})`);

      // Shape representation
      const shapeRepId = addLine(`IFCSHAPEREPRESENTATION(${bodyContextId},'Body','SweptSolid',(${solidId}))`);
      const prodDefId = addLine(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shapeRepId}))`);

      // IfcMember
      const nailGUID = generateIFCGUID();
      const nailId = addLine(`IFCMEMBER('${nailGUID}',${ownerHistoryId},'${nail.id}','Soil Nail Row${nail.row} Col${nail.col}',$,${nailPlacementId},${prodDefId},$)`);
      nailIds.push(nailId);

      // Property set
      const propLengthId = addLine(`IFCPROPERTYSINGLEVALUE('NailLength',$,IFCLENGTHMEASURE(${nail.length}),$)`);
      const propIncId = addLine(`IFCPROPERTYSINGLEVALUE('Inclination',$,IFCPLANEANGLEMEASURE(${nail.inclination * 0.0174532925199}),$)`);
      const propBarDiaId = addLine(`IFCPROPERTYSINGLEVALUE('BarDiameter',$,IFCLENGTHMEASURE(${nail.barDiameter / 1000}),$)`);
      const propDrillDiaId = addLine(`IFCPROPERTYSINGLEVALUE('DrillHoleDiameter',$,IFCLENGTHMEASURE(${nail.drillDiameter / 1000}),$)`);
      const propRowId = addLine(`IFCPROPERTYSINGLEVALUE('Row',$,IFCINTEGER(${nail.row}),$)`);
      const propColId = addLine(`IFCPROPERTYSINGLEVALUE('Column',$,IFCINTEGER(${nail.col}),$)`);
      const propElevId = addLine(`IFCPROPERTYSINGLEVALUE('Elevation',$,IFCLENGTHMEASURE(${nail.elevation}),$)`);

      const psetId = addLine(`IFCPROPERTYSET('${generateIFCGUID()}',${ownerHistoryId},'SoilNail_Properties',$,(${propLengthId},${propIncId},${propBarDiaId},${propDrillDiaId},${propRowId},${propColId},${propElevId}))`);
      addLine(`IFCRELDEFINESBYPROPERTIES('${generateIFCGUID()}',${ownerHistoryId},$,$,(${nailId}),${psetId})`);
    });

    // Contain nails in storey
    if (nailIds.length > 0) {
      addLine(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${generateIFCGUID()}',${ownerHistoryId},$,$,(${nailIds.join(',')}),${storeyId})`);
    }

    // Material association
    if (nailIds.length > 0) {
      addLine(`IFCRELASSOCIATESMATERIAL('${generateIFCGUID()}',${ownerHistoryId},$,$,(${nailIds.join(',')}),${materialId})`);
    }

    ifc += lines.join(';\n') + ';\n';
    ifc += 'ENDSEC;\n';
    ifc += 'END-ISO-10303-21;\n';

    const filename = `${sanitizeFilename(info.name)}_SoilNails.ifc`;
    downloadFile(ifc, filename, 'application/x-step');
    App.showToast(`Downloaded ${filename} (${layout.nails.length} nails)`, 'success');
  }

  // ============================================
  // 2. Dynamo Script (.dyn)
  // ============================================
  function exportDYN() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();
    const params = NailsModule.getParams();

    // Build head and tip coordinate arrays
    const headPtsX = [], headPtsY = [], headPtsZ = [];
    const tipPtsX = [], tipPtsY = [], tipPtsZ = [];

    layout.nails.forEach(nail => {
      headPtsX.push(+(nail.headX + info.baseEasting).toFixed(4));
      headPtsY.push(+(nail.headZ + info.baseNorthing).toFixed(4));
      headPtsZ.push(+(nail.headY + info.baseElevation).toFixed(4));
      tipPtsX.push(+(nail.tipX + info.baseEasting).toFixed(4));
      tipPtsY.push(+(nail.tipZ + info.baseNorthing).toFixed(4));
      tipPtsZ.push(+(nail.tipY + info.baseElevation).toFixed(4));
    });

    // Dynamo workspace JSON
    const workspace = {
      Uuid: generateUUID(),
      IsCustomNode: false,
      Description: `Soil Nail Layout - ${info.name}`,
      Name: `SoilNails_${sanitizeFilename(info.name)}`,
      ElementResolver: { ResolutionMap: {} },
      Inputs: [],
      Outputs: [],
      Nodes: [],
      Connectors: [],
      Dependencies: [],
      NodeLibraryDependencies: [],
      Thumbnail: "",
      GraphDocumentationURL: null,
      ExtensionWorkspaceData: [],
      Author: info.designer || "SoilNail BIM",
      Linting: { activeLinter: "None", activeLinterId: "7b75fb68-9cb4-49b0-80d5-24e2cfbe0bbe", warningCount: 0, errorCount: 0 },
      Bindings: [],
      View: {
        Dynamo: {
          ScaleFactor: 1,
          HasRunWithoutCrash: false,
          IsVisibleInDynamoLibrary: true,
          Version: "2.18.1.5229",
          RunType: "Manual",
          RunPeriod: "1000"
        },
        Camera: { EyeX: 0, EyeY: 50, EyeZ: 50, LookX: 0, LookY: -1, LookZ: -1, UpX: 0, UpY: 1, UpZ: 0 },
        ConnectorPins: [],
        NodeViews: [],
        Annotations: [
          {
            Id: generateUUID(),
            Title: "Soil Nail BIM Generator Output",
            DescriptionText: `Generated by SoilNail BIM v2.0\nProject: ${info.name}\n${layout.nails.length} nails in ${layout.rows.length} rows`,
            IsExpanded: true,
            WidthAdjustment: 0,
            HeightAdjustment: 0,
            Nodes: [],
            HasNestedGroups: false,
            Left: -50,
            Top: -100,
            Width: 900,
            Height: 150,
            FontSize: 24,
            GroupStyleId: "00000000-0000-0000-0000-000000000000",
            InitialTop: 0,
            InitialHeight: 0,
            TextblockHeight: 0,
            Background: "#FFD4B896"
          }
        ]
      }
    };

    let nodeX = 0;
    const nodeY = 0;
    const nodeSpacingX = 300;
    const nodeSpacingY = 100;
    let nodeViews = [];

    // Helper to create a Code Block node
    function addCodeBlockNode(id, code, x, y, name) {
      workspace.Nodes.push({
        ConcreteType: "Dynamo.Graph.Nodes.CodeBlockNodeModel, DynamoCore",
        Id: id,
        NodeType: "CodeBlockNode",
        Inputs: [],
        Outputs: [{ Id: generateUUID(), Name: "", Description: "Value of expression", UsingDefaultValue: false }],
        Replication: "Disabled",
        Description: name || "Code Block",
        Code: code
      });
      nodeViews.push({ ShowGeometry: true, Name: name || "Code Block", Id: id, IsSetAsInput: false, IsSetAsOutput: false, Excluded: false, X: x, Y: y });
    }

    // Helper to create a built-in function node
    function addFunctionNode(id, funcName, concreteType, x, y, inputs, outputs) {
      workspace.Nodes.push({
        ConcreteType: concreteType,
        Id: id,
        NodeType: "ExtensionNode",
        Inputs: inputs,
        Outputs: outputs,
        Replication: "Disabled",
        Description: funcName
      });
      nodeViews.push({ ShowGeometry: true, Name: funcName, Id: id, IsSetAsInput: false, IsSetAsOutput: false, Excluded: false, X: x, Y: y });
    }

    // Node 1: Head points X array
    const headXId = generateUUID();
    addCodeBlockNode(headXId, JSON.stringify(headPtsX) + ';', nodeX, nodeY, 'Head Points X');

    // Node 2: Head points Y array
    const headYId = generateUUID();
    addCodeBlockNode(headYId, JSON.stringify(headPtsY) + ';', nodeX, nodeY + nodeSpacingY, 'Head Points Y');

    // Node 3: Head points Z array
    const headZId = generateUUID();
    addCodeBlockNode(headZId, JSON.stringify(headPtsZ) + ';', nodeX, nodeY + nodeSpacingY * 2, 'Head Points Z');

    // Node 4: Tip points X array
    const tipXId = generateUUID();
    addCodeBlockNode(tipXId, JSON.stringify(tipPtsX) + ';', nodeX, nodeY + nodeSpacingY * 4, 'Tip Points X');

    // Node 5: Tip points Y array
    const tipYId = generateUUID();
    addCodeBlockNode(tipYId, JSON.stringify(tipPtsY) + ';', nodeX, nodeY + nodeSpacingY * 5, 'Tip Points Y');

    // Node 6: Tip points Z array
    const tipZId = generateUUID();
    addCodeBlockNode(tipZId, JSON.stringify(tipPtsZ) + ';', nodeX, nodeY + nodeSpacingY * 6, 'Tip Points Z');

    nodeX += nodeSpacingX;

    // Node 7: Create head points using Point.ByCoordinates
    const headPointsId = generateUUID();
    addFunctionNode(headPointsId, 'Point.ByCoordinates',
      'Dynamo.Graph.Nodes.ZeroTouch.DSFunction, DynamoCore',
      nodeX, nodeY + nodeSpacingY,
      [
        { Id: generateUUID(), Name: "x", Description: "X coordinate", UsingDefaultValue: false },
        { Id: generateUUID(), Name: "y", Description: "Y coordinate", UsingDefaultValue: false },
        { Id: generateUUID(), Name: "z", Description: "Z coordinate", UsingDefaultValue: false }
      ],
      [{ Id: generateUUID(), Name: "Point", Description: "Point created", UsingDefaultValue: false }]
    );
    workspace.Nodes[workspace.Nodes.length - 1].FunctionSignature = "Autodesk.DesignScript.Geometry.Point.ByCoordinates@double,double,double";

    // Node 8: Create tip points
    const tipPointsId = generateUUID();
    addFunctionNode(tipPointsId, 'Point.ByCoordinates',
      'Dynamo.Graph.Nodes.ZeroTouch.DSFunction, DynamoCore',
      nodeX, nodeY + nodeSpacingY * 5,
      [
        { Id: generateUUID(), Name: "x", Description: "X coordinate", UsingDefaultValue: false },
        { Id: generateUUID(), Name: "y", Description: "Y coordinate", UsingDefaultValue: false },
        { Id: generateUUID(), Name: "z", Description: "Z coordinate", UsingDefaultValue: false }
      ],
      [{ Id: generateUUID(), Name: "Point", Description: "Point created", UsingDefaultValue: false }]
    );
    workspace.Nodes[workspace.Nodes.length - 1].FunctionSignature = "Autodesk.DesignScript.Geometry.Point.ByCoordinates@double,double,double";

    nodeX += nodeSpacingX;

    // Node 9: Create lines (Line.ByStartPointEndPoint)
    const lineNodeId = generateUUID();
    addFunctionNode(lineNodeId, 'Line.ByStartPointEndPoint',
      'Dynamo.Graph.Nodes.ZeroTouch.DSFunction, DynamoCore',
      nodeX, nodeY + nodeSpacingY * 3,
      [
        { Id: generateUUID(), Name: "startPoint", Description: "Start point", UsingDefaultValue: false },
        { Id: generateUUID(), Name: "endPoint", Description: "End point", UsingDefaultValue: false }
      ],
      [{ Id: generateUUID(), Name: "Line", Description: "Line created", UsingDefaultValue: false }]
    );
    workspace.Nodes[workspace.Nodes.length - 1].FunctionSignature = "Autodesk.DesignScript.Geometry.Line.ByStartPointEndPoint@Autodesk.DesignScript.Geometry.Point,Autodesk.DesignScript.Geometry.Point";

    // Add connectors
    function connect(startNodeId, startIdx, endNodeId, endIdx) {
      const startNode = workspace.Nodes.find(n => n.Id === startNodeId);
      const endNode = workspace.Nodes.find(n => n.Id === endNodeId);
      if (startNode && endNode) {
        workspace.Connectors.push({
          Start: startNode.Outputs[startIdx].Id,
          End: endNode.Inputs[endIdx].Id,
          Id: generateUUID()
        });
      }
    }

    // Head X,Y,Z -> Head Point.ByCoordinates
    connect(headXId, 0, headPointsId, 0);
    connect(headYId, 0, headPointsId, 1);
    connect(headZId, 0, headPointsId, 2);

    // Tip X,Y,Z -> Tip Point.ByCoordinates
    connect(tipXId, 0, tipPointsId, 0);
    connect(tipYId, 0, tipPointsId, 1);
    connect(tipZId, 0, tipPointsId, 2);

    // Head Points + Tip Points -> Line.ByStartPointEndPoint
    connect(headPointsId, 0, lineNodeId, 0);
    connect(tipPointsId, 0, lineNodeId, 1);

    // Assign node views
    workspace.View.NodeViews = nodeViews;

    const json = JSON.stringify(workspace, null, 2);
    const filename = `${sanitizeFilename(info.name)}_SoilNails.dyn`;
    downloadFile(json, filename, 'application/json');
    App.showToast(`Downloaded ${filename} - Open in Dynamo for Civil 3D/Revit`, 'success');
  }

  // ============================================
  // 3. Dynamo JSON Data
  // ============================================
  function exportJSON() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();
    const params = NailsModule.getParams();
    const qty = NailsModule.calculateQuantities(layout);

    const dynamoData = {
      metadata: {
        generator: 'SoilNail BIM v2.0',
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
  // 4. COGO Points CSV
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
  // 5. AutoCAD Script (.scr)
  // ============================================
  function exportSCR() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();

    let scr = '';
    scr += '-LAYER M SOIL_NAILS C 5 SOIL_NAILS \n';
    scr += '-LAYER M NAIL_HEADS C 1 NAIL_HEADS \n';
    scr += '-LAYER M DRILL_HOLES C 8 DRILL_HOLES \n';
    scr += '\n';

    layout.nails.forEach(nail => {
      const hx = (nail.headX + info.baseEasting).toFixed(4);
      const hy = (nail.headZ + info.baseNorthing).toFixed(4);
      const hz = (nail.headY + info.baseElevation).toFixed(4);
      const tx = (nail.tipX + info.baseEasting).toFixed(4);
      const ty = (nail.tipZ + info.baseNorthing).toFixed(4);
      const tz = (nail.tipY + info.baseElevation).toFixed(4);

      scr += `-LAYER S SOIL_NAILS \n`;
      scr += `LINE ${hx},${hy},${hz} ${tx},${ty},${tz} \n`;
      scr += `-LAYER S NAIL_HEADS \n`;
      scr += `POINT ${hx},${hy},${hz}\n`;
    });

    scr += 'ZOOM E\n';

    const filename = `${sanitizeFilename(info.name)}_AutoCAD_Script.scr`;
    downloadFile(scr, filename, 'text/plain');
    App.showToast(`Downloaded ${filename}`, 'success');
  }

  // ============================================
  // 6. DXF Drawing
  // ============================================
  function exportDXF() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();

    let dxf = '';

    // HEADER section
    dxf += '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$ACADVER\n1\nAC1015\n';
    dxf += '9\n$INSBASE\n10\n0.0\n20\n0.0\n30\n0.0\n';
    dxf += '0\nENDSEC\n';

    // TABLES section
    dxf += '0\nSECTION\n2\nTABLES\n';

    // Linetype table
    dxf += '0\nTABLE\n2\nLTYPE\n70\n1\n';
    dxf += '0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n';
    dxf += '0\nENDTAB\n';

    // Layer table
    dxf += '0\nTABLE\n2\nLAYER\n70\n5\n';
    dxf += '0\nLAYER\n2\nTERRAIN\n70\n0\n62\n30\n6\nCONTINUOUS\n';
    dxf += '0\nLAYER\n2\nSOIL_NAILS\n70\n0\n62\n5\n6\nCONTINUOUS\n';
    dxf += '0\nLAYER\n2\nNAIL_HEADS\n70\n0\n62\n1\n6\nCONTINUOUS\n';
    dxf += '0\nLAYER\n2\nDRILL_HOLES\n70\n0\n62\n8\n6\nCONTINUOUS\n';
    dxf += '0\nLAYER\n2\nSOIL_NAILS_3D\n70\n0\n62\n150\n6\nCONTINUOUS\n';
    dxf += '0\nENDTAB\n';

    dxf += '0\nENDSEC\n';

    // BLOCKS section (required by many DXF parsers)
    dxf += '0\nSECTION\n2\nBLOCKS\n';
    dxf += '0\nENDSEC\n';

    // ENTITIES section
    dxf += '0\nSECTION\n2\nENTITIES\n';

    // --- 2D Cross-Section (XY plane: X = distance, Y = elevation) ---

    // Terrain profile lines
    const terrain = TerrainModule.getPoints();
    if (terrain.length >= 2) {
      terrain.forEach((pt, i) => {
        if (i < terrain.length - 1) {
          const x1 = (pt.x + info.baseEasting).toFixed(4);
          const y1 = (pt.y + info.baseElevation).toFixed(4);
          const x2 = (terrain[i + 1].x + info.baseEasting).toFixed(4);
          const y2 = (terrain[i + 1].y + info.baseElevation).toFixed(4);
          dxf += `0\nLINE\n8\nTERRAIN\n`;
          dxf += `10\n${x1}\n20\n${y1}\n30\n0.0\n`;
          dxf += `11\n${x2}\n21\n${y2}\n31\n0.0\n`;
        }
      });
    }

    // Nail rows as 2D cross-section lines (one per row)
    layout.rows.forEach(row => {
      const sx = (row.start.x + info.baseEasting).toFixed(4);
      const sy = (row.start.y + info.baseElevation).toFixed(4);
      const ex = (row.end.x + info.baseEasting).toFixed(4);
      const ey = (row.end.y + info.baseElevation).toFixed(4);

      // Drill hole (wider line via LWPOLYLINE or just use LINE)
      dxf += `0\nLINE\n8\nDRILL_HOLES\n`;
      dxf += `10\n${sx}\n20\n${sy}\n30\n0.0\n`;
      dxf += `11\n${ex}\n21\n${ey}\n31\n0.0\n`;

      // Nail bar
      dxf += `0\nLINE\n8\nSOIL_NAILS\n`;
      dxf += `10\n${sx}\n20\n${sy}\n30\n0.0\n`;
      dxf += `11\n${ex}\n21\n${ey}\n31\n0.0\n`;

      // Nail head point
      dxf += `0\nPOINT\n8\nNAIL_HEADS\n`;
      dxf += `10\n${sx}\n20\n${sy}\n30\n0.0\n`;

      // Row label as TEXT
      dxf += `0\nTEXT\n8\nSOIL_NAILS\n`;
      dxf += `10\n${sx}\n20\n${sy}\n30\n0.0\n`;
      dxf += `40\n0.3\n`;
      dxf += `1\nR${row.rowNumber} L=${row.nailLength}m\n`;
    });

    // --- 3D Nails (full layout with lateral positions) ---
    layout.nails.forEach(nail => {
      const hx = (nail.headX + info.baseEasting).toFixed(4);
      const hy = (nail.headZ + info.baseNorthing).toFixed(4);
      const hz = (nail.headY + info.baseElevation).toFixed(4);
      const tx = (nail.tipX + info.baseEasting).toFixed(4);
      const ty = (nail.tipZ + info.baseNorthing).toFixed(4);
      const tz = (nail.tipY + info.baseElevation).toFixed(4);

      dxf += `0\nLINE\n8\nSOIL_NAILS_3D\n`;
      dxf += `10\n${hx}\n20\n${hy}\n30\n${hz}\n`;
      dxf += `11\n${tx}\n21\n${ty}\n31\n${tz}\n`;
    });

    dxf += '0\nENDSEC\n';
    dxf += '0\nEOF\n';

    const filename = `${sanitizeFilename(info.name)}_SoilNails.dxf`;
    downloadFile(dxf, filename, 'application/dxf');
    App.showToast(`Downloaded ${filename} (${layout.rows.length} rows + ${layout.nails.length} 3D nails)`, 'success');
  }

  // ============================================
  // 7. LandXML
  // ============================================
  function exportXML() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2">\n';
    xml += `  <Project name="${escapeXML(info.name)}" desc="${escapeXML(info.description)}">\n`;
    xml += `    <Feature name="SoilNailBIM" code="Generator">SoilNail BIM v2.0</Feature>\n`;
    xml += `  </Project>\n`;
    xml += `  <Units>\n    <Metric linearUnit="meter" areaUnit="squareMeter" volumeUnit="cubicMeter" angularUnit="decimal degrees"/>\n  </Units>\n`;

    xml += '  <CgPoints name="SoilNailHeads">\n';
    layout.nails.forEach((nail, idx) => {
      const n = (nail.headZ + info.baseNorthing).toFixed(4);
      const e = (nail.headX + info.baseEasting).toFixed(4);
      const el = (nail.headY + info.baseElevation).toFixed(4);
      xml += `    <CgPoint name="${nail.id}" pntRef="${idx + 1}" desc="SOIL_NAIL">${n} ${e} ${el}</CgPoint>\n`;
    });
    xml += '  </CgPoints>\n';

    const terrain = TerrainModule.getPoints();
    xml += '  <Surfaces>\n    <Surface name="TerrainProfile">\n      <Definition surfType="TIN">\n';
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
  // 8. Summary Report (HTML)
  // ============================================
  function exportReport() {
    const layout = getLayoutOrWarn();
    if (!layout) return;
    const info = getProjectInfo();
    const params = NailsModule.getParams();
    const qty = NailsModule.calculateQuantities(layout);
    const canvasImg = document.getElementById('previewCanvas').toDataURL('image/png');

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Soil Nail Report - ${escapeHTML(info.name)}</title>
<style>
  body { font-family: 'Segoe UI', -apple-system, Arial, sans-serif; color: #1e293b; max-width: 900px; margin: 0 auto; padding: 2rem; }
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
  Generated by SoilNail BIM v2.0 on ${new Date().toLocaleString()}
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

  function escapeIFC(str) {
    return (str || '').replace(/'/g, "''").replace(/\\/g, '\\\\');
  }

  // Generate IFC-compatible GUID (22 char base64)
  function generateIFCGUID() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
    let guid = '';
    for (let i = 0; i < 22; i++) {
      guid += chars.charAt(Math.floor(Math.random() * 64));
    }
    return guid;
  }

  // Generate standard UUID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  return { init };
})();
