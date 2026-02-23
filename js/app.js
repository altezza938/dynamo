/* ============================================
   Main Application Controller v2.0
   Navigation, dark mode, auto-save, and init.
   ============================================ */

const App = (() => {
  let currentSection = 'project';
  const STORAGE_KEY = 'soilnail_bim_project';

  function init() {
    // Initialize modules
    TerrainModule.init();
    NailsModule.init();
    PreviewModule.init();
    ExportModule.init();

    // Theme
    initTheme();

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => navigateTo(item.dataset.section));
    });

    // Section nav buttons (Next/Back)
    document.querySelectorAll('[data-go]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.go));
    });

    // Toggle handlers for nail params
    document.getElementById('variableLength').addEventListener('change', (e) => {
      document.getElementById('variableLengthConfig').classList.toggle('hidden', !e.target.checked);
    });

    document.getElementById('centralizers').addEventListener('change', (e) => {
      document.getElementById('centralizerSpacingRow').style.display = e.target.checked ? '' : 'none';
    });

    // Save / Load project
    document.getElementById('btnSaveProject').addEventListener('click', saveProject);
    document.getElementById('btnLoadProject').addEventListener('click', loadProjectFromFile);

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        const sections = ['project', 'terrain', 'nails', 'preview', 'export'];
        const num = parseInt(e.key);
        if (num >= 1 && num <= 5) {
          e.preventDefault();
          navigateTo(sections[num - 1]);
        }
      }
    });

    // Auto-restore from localStorage
    autoRestore();

    // Trigger resize for canvases after DOM is ready
    setTimeout(() => {
      TerrainModule.resizeCanvas();
      PreviewModule.resizeCanvas();
    }, 100);

    // Auto-save on input changes (debounced)
    let saveTimer = null;
    document.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(autoSave, 2000);
    });
  }

  function navigateTo(section) {
    currentSection = section;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Update content
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `section-${section}`);
    });

    // Resize canvases when switching to their sections
    if (section === 'terrain') {
      setTimeout(() => TerrainModule.resizeCanvas(), 50);
    } else if (section === 'preview') {
      setTimeout(() => PreviewModule.resizeCanvas(), 50);
    } else if (section === 'nails') {
      setTimeout(() => NailsModule.drawDiagram(), 50);
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- Theme ----
  function initTheme() {
    const saved = localStorage.getItem('soilnail_theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      // Detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }

    document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('soilnail_theme', next);

    // Redraw canvases for theme
    TerrainModule.draw();
    PreviewModule.draw();
    NailsModule.drawDiagram();
  }

  // ---- Toast ----
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3100);
  }

  // ---- Auto Save / Restore ----
  function autoSave() {
    try {
      const data = gatherProjectData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // Silently fail
    }
  }

  function autoRestore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      restoreProjectData(data);
    } catch (e) {
      // Silently fail
    }
  }

  function gatherProjectData() {
    return {
      version: '2.0',
      project: {
        name: document.getElementById('projectName').value,
        number: document.getElementById('projectNumber').value,
        description: document.getElementById('projectDesc').value,
        designer: document.getElementById('designer').value,
        checker: document.getElementById('checker').value,
      },
      coords: {
        system: document.getElementById('coordSystem').value,
        unitLength: document.getElementById('unitLength').value,
        unitAngle: document.getElementById('unitAngle').value,
        baseElevation: document.getElementById('baseElevation').value,
        baseEasting: document.getElementById('baseEasting').value,
        baseNorthing: document.getElementById('baseNorthing').value,
      },
      terrain: TerrainModule.getPoints(),
      nails: {
        length: document.getElementById('nailLength').value,
        inclination: document.getElementById('nailInclination').value,
        barDiameter: document.getElementById('barDiameter').value,
        drillDiameter: document.getElementById('drillDiameter').value,
        hSpacing: document.getElementById('hSpacing').value,
        vSpacing: document.getElementById('vSpacing').value,
        topOffset: document.getElementById('topOffset').value,
        bottomOffset: document.getElementById('bottomOffset').value,
        patternType: document.getElementById('patternType').value,
        wallExtent: document.getElementById('wallExtent').value,
        plateSize: document.getElementById('plateSize').value,
        plateThickness: document.getElementById('plateThickness').value,
        facingType: document.getElementById('facingType').value,
        steelGrade: document.getElementById('steelGrade').value,
        groutStrength: document.getElementById('groutStrength').value,
        corrosionProtection: document.getElementById('corrosionProtection').value,
        centralizers: document.getElementById('centralizers').checked,
        centralizerSpacing: document.getElementById('centralizerSpacing').value,
        variableLength: document.getElementById('variableLength').checked,
      }
    };
  }

  function restoreProjectData(data) {
    if (!data) return;

    // Project info
    if (data.project) {
      setVal('projectName', data.project.name);
      setVal('projectNumber', data.project.number);
      setVal('projectDesc', data.project.description);
      setVal('designer', data.project.designer);
      setVal('checker', data.project.checker);
    }

    // Coordinates
    if (data.coords) {
      setVal('coordSystem', data.coords.system);
      setVal('unitLength', data.coords.unitLength);
      setVal('unitAngle', data.coords.unitAngle);
      setVal('baseElevation', data.coords.baseElevation);
      setVal('baseEasting', data.coords.baseEasting);
      setVal('baseNorthing', data.coords.baseNorthing);
    }

    // Terrain
    if (data.terrain && data.terrain.length > 0) {
      TerrainModule.setPoints(data.terrain);
    }

    // Nail params
    if (data.nails) {
      setVal('nailLength', data.nails.length);
      setVal('nailInclination', data.nails.inclination);
      setVal('barDiameter', data.nails.barDiameter);
      setVal('drillDiameter', data.nails.drillDiameter);
      setVal('hSpacing', data.nails.hSpacing);
      setVal('vSpacing', data.nails.vSpacing);
      setVal('topOffset', data.nails.topOffset);
      setVal('bottomOffset', data.nails.bottomOffset);
      setVal('patternType', data.nails.patternType);
      setVal('wallExtent', data.nails.wallExtent);
      setVal('plateSize', data.nails.plateSize);
      setVal('plateThickness', data.nails.plateThickness);
      setVal('facingType', data.nails.facingType);
      setVal('steelGrade', data.nails.steelGrade);
      setVal('groutStrength', data.nails.groutStrength);
      setVal('corrosionProtection', data.nails.corrosionProtection);
      setVal('centralizerSpacing', data.nails.centralizerSpacing);

      if (data.nails.centralizers !== undefined) {
        document.getElementById('centralizers').checked = data.nails.centralizers;
        document.getElementById('centralizerSpacingRow').style.display = data.nails.centralizers ? '' : 'none';
      }
      if (data.nails.variableLength !== undefined) {
        document.getElementById('variableLength').checked = data.nails.variableLength;
        document.getElementById('variableLengthConfig').classList.toggle('hidden', !data.nails.variableLength);
      }
    }
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) {
      el.value = val;
    }
  }

  // ---- Save / Load to file ----
  function saveProject() {
    const data = gatherProjectData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = data.project.name || 'SoilNail_Project';
    a.download = name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.snproj.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Project saved to file', 'success');
  }

  function loadProjectFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.snproj.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          restoreProjectData(data);
          showToast('Project loaded successfully', 'success');
        } catch (err) {
          showToast('Failed to load project file', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { navigateTo, showToast };
})();
